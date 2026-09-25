resource "aws_instance" "api" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public_api.id
  vpc_security_group_ids      = [aws_security_group.api.id]
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.api.name

  user_data_replace_on_change = true
  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    aws_region     = var.aws_region
    db_secret_arn  = aws_db_instance.postgres.master_user_secret[0].secret_arn
    app_secret_arn = aws_secretsmanager_secret.application.arn
    db_host        = aws_db_instance.postgres.address
    db_name        = aws_db_instance.postgres.db_name
    ecr_registry   = split("/", aws_ecr_repository.api.repository_url)[0]
    image_uri      = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
    log_group      = aws_cloudwatch_log_group.api.name
  })

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted             = true
    volume_type           = "gp3"
    volume_size           = 20
    delete_on_termination = true
  }

  tags = { Name = "${var.project_name}-api" }

  depends_on = [
    aws_iam_role_policy.runtime,
    aws_iam_role_policy_attachment.ecr_read,
    aws_cloudwatch_log_group.api
  ]
}
