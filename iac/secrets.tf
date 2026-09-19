# Secrets Manager
resource "aws_secretsmanager_secret" "api_keys" {
  name = "${var.project_name}-api-keys"
}

# Populate secret values through the AWS API outside Terraform. Secret contents
# must never be written into Terraform state.

resource "aws_iam_policy" "secrets_access" {
  name        = "${var.project_name}-secrets-access"
  description = "Allow ECS to read secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.api_keys.arn,
          aws_db_instance.postgres.master_user_secret[0].secret_arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_secrets_access" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.secrets_access.arn
}
