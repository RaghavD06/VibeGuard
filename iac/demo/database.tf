resource "aws_db_subnet_group" "database" {
  name       = "${var.project_name}-database"
  subnet_ids = [aws_subnet.private_db_a.id, aws_subnet.private_db_b.id]

  tags = { Name = "${var.project_name}-database" }
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${var.project_name}-postgres15"
  family = "postgres15"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
}

resource "aws_db_instance" "postgres" {
  identifier                  = "${var.project_name}-postgres"
  allocated_storage           = 20
  max_allocated_storage       = 25
  storage_type                = "gp3"
  engine                      = "postgres"
  engine_version              = "15"
  instance_class              = "db.t3.micro"
  db_name                     = "vibeguard"
  username                    = "vibeguard_admin"
  manage_master_user_password = true
  storage_encrypted           = true
  publicly_accessible         = false
  multi_az                    = false

  backup_retention_period             = 1
  auto_minor_version_upgrade          = true
  copy_tags_to_snapshot               = false
  enabled_cloudwatch_logs_exports     = ["postgresql"]
  performance_insights_enabled        = false
  monitoring_interval                 = 0
  iam_database_authentication_enabled = true
  parameter_group_name                = aws_db_parameter_group.postgres.name

  deletion_protection       = false
  skip_final_snapshot       = true
  delete_automated_backups  = true
  db_subnet_group_name      = aws_db_subnet_group.database.name
  vpc_security_group_ids    = [aws_security_group.database.id]
  apply_immediately         = true
}
