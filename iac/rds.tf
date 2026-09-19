# RDS PostgreSQL Database
resource "aws_db_subnet_group" "db_subnet" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = [aws_subnet.private_db_1.id, aws_subnet.private_db_2.id]

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

resource "aws_security_group" "rds_sg" {
  name        = "${var.project_name}-rds-sg"
  description = "Allow inbound traffic from ECS only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    protocol        = "tcp"
    from_port       = 5432
    to_port         = 5432
    security_groups = [aws_security_group.ecs_sg.id]
  }

}

resource "aws_db_parameter_group" "postgres" {
  name   = "${var.project_name}-postgres15"
  family = "postgres15"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
  parameter {
    name  = "log_connections"
    value = "1"
  }
  parameter {
    name  = "log_disconnections"
    value = "1"
  }
}

resource "aws_iam_role" "rds_monitoring" {
  name = "${var.project_name}-rds-monitoring"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_db_instance" "postgres" {
  identifier                            = "${var.project_name}-db"
  allocated_storage                     = 20
  storage_type                          = "gp2"
  engine                                = "postgres"
  engine_version                        = "15"
  instance_class                        = "db.t3.micro"
  db_name                               = "vibeguard"
  username                              = "vibeguard_admin"
  manage_master_user_password           = true
  storage_encrypted                     = true
  publicly_accessible                   = false
  backup_retention_period               = 7
  auto_minor_version_upgrade            = true
  copy_tags_to_snapshot                 = true
  multi_az                              = false
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_monitoring.arn
  iam_database_authentication_enabled   = true
  parameter_group_name                  = aws_db_parameter_group.postgres.name
  skip_final_snapshot                   = false
  final_snapshot_identifier             = "${var.project_name}-final-snapshot"
  deletion_protection                   = true

  db_subnet_group_name   = aws_db_subnet_group.db_subnet.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
}
