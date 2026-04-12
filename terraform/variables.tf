variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "il-central-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use (SSO)"
  type        = string
  default     = "Sanbox_NIM"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Used as a prefix for all resource names"
  type        = string
  default     = "wealthclick"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDRs for the two public subnets (one per AZ, used by ALB)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidr" {
  description = "CIDR for the private subnet (used by EC2)"
  type        = string
  default     = "10.0.10.0/24"
}

variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "ec2_volume_size_gb" {
  description = "Root EBS volume size in GB"
  type        = number
  default     = 20
}

variable "app_port" {
  description = "Port the Next.js app listens on"
  type        = number
  default     = 3000
}

variable "certificate_arn" {
  description = <<-EOT
    ACM certificate ARN for HTTPS on the ALB.
    Must be in the same region as the ALB (il-central-1).
    Leave empty during initial HTTP-only deployment; add after cert is issued.
  EOT
  type    = string
  default = ""

  validation {
    condition     = var.certificate_arn == "" || can(regex("^arn:aws:acm:", var.certificate_arn))
    error_message = "certificate_arn must be empty or a valid ACM ARN (arn:aws:acm:...)."
  }
}

variable "github_repo" {
  description = "GitHub repository in org/repo format for OIDC trust"
  type        = string
  default     = "avihuco2/wealthclick"
}

variable "github_branch" {
  description = "Branch allowed to trigger deployments via OIDC"
  type        = string
  default     = "main"
}
