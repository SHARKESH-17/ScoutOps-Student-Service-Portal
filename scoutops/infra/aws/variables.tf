variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Short project name used in resource naming."
  type        = string
  default     = "scoutops"
}

variable "environment" {
  description = "Deployment environment tag value."
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets."
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24"]
}

variable "instance_type" {
  description = "EC2 instance type for the app node."
  type        = string
  default     = "t3.micro"
}

variable "db_instance_class" {
  description = "RDS instance class for PostgreSQL."
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Name of the PostgreSQL database."
  type        = string
  default     = "scoutops"
}

variable "db_username" {
  description = "Master username for PostgreSQL."
  type        = string
  default     = "scoutopsadmin"
  sensitive   = true
}

variable "image_repository" {
  description = "Published ScoutOps container image repository."
  type        = string
}

variable "image_tag" {
  description = "Immutable ScoutOps image tag to deploy."
  type        = string

  validation {
    condition     = can(regex("^[0-9]+-[0-9a-f]{12}$", var.image_tag))
    error_message = "Use the Jenkins immutable <build-number>-<12-character-git-sha> image tag."
  }
}

variable "tls_hostname" {
  description = "DNS hostname covered by the TLS certificate."
  type        = string
}

variable "runtime_secret_arns" {
  description = "Secret ARNs in this order: JWT secret, bootstrap admin JSON, metrics token, and TLS certificate JSON."
  type        = list(string)
  sensitive   = true

  validation {
    condition     = length(var.runtime_secret_arns) == 4
    error_message = "Provide exactly four runtime secret ARNs: JWT, admin, metrics, and TLS."
  }
}
