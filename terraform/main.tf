terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Local state for initial bootstrap.
  # After first apply, migrate to S3:
  #   1. Uncomment the backend block below
  #   2. Run: terraform init -migrate-state
  #
  # backend "s3" {
  #   bucket         = "wealthclick-terraform-state-930458520260"
  #   key            = "production/terraform.tfstate"
  #   region         = "il-central-1"
  #   encrypt        = true
  #   dynamodb_table = "wealthclick-terraform-locks"
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = "wealthclick"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
