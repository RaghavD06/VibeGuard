resource "aws_vpc" "main" {
  cidr_block           = "10.10.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${var.project_name}-vpc" }
}

resource "aws_default_security_group" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-igw" }
}

resource "aws_subnet" "public_api" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.10.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-public-api" }
}

resource "aws_subnet" "private_db_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.10.11.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = { Name = "${var.project_name}-private-db-a" }
}

resource "aws_subnet" "private_db_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.10.12.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = { Name = "${var.project_name}-private-db-b" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project_name}-public" }
}

resource "aws_route_table_association" "public_api" {
  subnet_id      = aws_subnet.public_api.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "api" {
  name        = "${var.project_name}-api"
  description = "Allow HTTP only from the CloudFront origin network"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "CloudFront origin HTTP"
    protocol        = "tcp"
    from_port       = 80
    to_port         = 80
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin.id]
  }

  egress {
    description = "HTTPS for ECR, AWS APIs, and optional NVIDIA NIM"
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "PostgreSQL in the VPC"
    protocol    = "tcp"
    from_port   = 5432
    to_port     = 5432
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    description = "DNS over UDP"
    protocol    = "udp"
    from_port   = 53
    to_port     = 53
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS over TCP"
    protocol    = "tcp"
    from_port   = 53
    to_port     = 53
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-api" }
}

resource "aws_security_group" "database" {
  name        = "${var.project_name}-database"
  description = "Allow PostgreSQL only from the API instance"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from API"
    protocol        = "tcp"
    from_port       = 5432
    to_port         = 5432
    security_groups = [aws_security_group.api.id]
  }

  tags = { Name = "${var.project_name}-database" }
}
