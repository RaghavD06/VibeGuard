output "cloudfront_url" {
  description = "Public HTTPS URL for the dashboard and API."
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "frontend_bucket_name" {
  description = "Private S3 bucket for the compiled dashboard."
  value       = aws_s3_bucket.frontend.id
}

output "ecr_repository_url" {
  description = "ECR repository used by the API host."
  value       = aws_ecr_repository.api.repository_url
}

output "api_instance_id" {
  description = "EC2 API host identifier."
  value       = aws_instance.api.id
}

output "application_secret_arn" {
  description = "Populate this secret out-of-band before creating the EC2 instance."
  value       = aws_secretsmanager_secret.application.arn
}
