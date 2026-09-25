resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}-api"
  image_tag_mutability = "IMMUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Retain the newest five demo images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ec2/${var.project_name}-api"
  retention_in_days = 14
}

resource "aws_secretsmanager_secret" "application" {
  name                    = "${var.project_name}-application"
  recovery_window_in_days = 0

  tags = { Purpose = "JWT and optional NVIDIA API credentials" }
}

# Secret values are deliberately excluded from Terraform and its state. Before
# starting EC2, populate JSON containing JWT_SECRET and, only with explicit user
# approval, NVIDIA_API_KEY through the AWS CLI or console.
