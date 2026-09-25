terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

variable "aws_region" {
  description = "AWS region for the demo stack."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefix used for demo resources."
  type        = string
  default     = "vibeguard-demo"
}

variable "api_image_tag" {
  description = "Immutable API image tag already pushed to ECR."
  type        = string
  default     = "dc97759"

  validation {
    condition     = can(regex("^[0-9a-f]{7,40}$", var.api_image_tag))
    error_message = "api_image_tag must be an immutable Git commit SHA, never latest."
  }
}

variable "instance_type" {
  description = "EC2 instance size for the Docker API host."
  type        = string
  default     = "t3.small"

  validation {
    condition     = contains(["t3.micro", "t3.small"], var.instance_type)
    error_message = "instance_type is limited to t3.micro or t3.small for cost control."
  }
}

variable "monthly_budget_usd" {
  description = "Monthly cost budget in USD."
  type        = number
  default     = 50

  validation {
    condition     = var.monthly_budget_usd > 0 && var.monthly_budget_usd <= 100
    error_message = "monthly_budget_usd must be greater than 0 and no more than 100."
  }
}

variable "budget_email" {
  description = "Email that receives AWS Budget alerts. Required before any apply."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.budget_email))
    error_message = "budget_email must be a valid email address."
  }
}

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ec2_managed_prefix_list" "cloudfront_origin" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  common_tags = {
    Project     = "VibeGuard"
    Environment = "demo"
    ManagedBy   = "Terraform"
    CostControl = "temporary"
  }
}
