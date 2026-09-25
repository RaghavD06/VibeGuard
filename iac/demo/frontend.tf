resource "aws_s3_bucket" "frontend" {
  bucket        = "${var.project_name}-frontend-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "frontend" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend.json
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_response_headers_policy" "security" {
  name = "Managed-SecurityHeadersPolicy"
}

# CloudFront proxies browser API calls to the EC2 origin on the same public
# hostname. Remove Origin only for that exact same-origin case so the API keeps
# rejecting cross-origin callers. The frontend branch replaces the former
# distribution-wide error mapping with a deterministic SPA navigation rewrite.
resource "aws_cloudfront_function" "request_router" {
  name    = "${var.project_name}-request-router"
  runtime = "cloudfront-js-2.0"
  comment = "Normalize same-origin API requests and route SPA navigation"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      if (uri.startsWith('/api/')) {
        var origin = request.headers.origin;
        var host = request.headers.host;
        if (origin && host && origin.value === 'https://' + host.value) {
          delete request.headers.origin;
        }
        return request;
      }

      var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
      if ((request.method === 'GET' || request.method === 'HEAD') &&
          (uri.endsWith('/') || lastSegment.indexOf('.') === -1)) {
        request.uri = '/index.html';
      }

      return request;
    }
  EOT
}

resource "aws_cloudfront_origin_request_policy" "api" {
  name = "${var.project_name}-api"

  cookies_config { cookie_behavior = "none" }

  headers_config {
    header_behavior = "whitelist"
    headers { items = ["Authorization", "Content-Type", "Accept", "X-Requested-With"] }
  }

  query_strings_config { query_string_behavior = "all" }
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    domain_name = aws_instance.api.public_dns
    origin_id   = "api"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "frontend"
    viewer_protocol_policy     = "redirect-to-https"
    min_ttl                    = 0
    default_ttl                = 3600
    max_ttl                    = 86400
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.request_router.arn
    }

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = toset(["/api/*", "/health", "/ready"])
    content {
      path_pattern               = ordered_cache_behavior.value
      allowed_methods            = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods             = ["GET", "HEAD"]
      target_origin_id           = "api"
      viewer_protocol_policy     = "redirect-to-https"
      cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
      origin_request_policy_id   = aws_cloudfront_origin_request_policy.api.id
      response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id

      dynamic "function_association" {
        for_each = ordered_cache_behavior.value == "/api/*" ? [1] : []
        content {
          event_type   = "viewer-request"
          function_arn = aws_cloudfront_function.request_router.arn
        }
      }
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # AWS fixes this to TLSv1 when the CloudFront default certificate is used.
    # Declaring the provider's returned value avoids a perpetual plan diff.
    minimum_protocol_version = "TLSv1"
  }
}
