output "alb_dns_name" {
  description = "ALB DNS name — point your domain CNAME here, or use directly for HTTP testing"
  value       = aws_lb.main.dns_name
}

output "ec2_instance_id" {
  description = "EC2 instance ID — set as EC2_INSTANCE_ID GitHub secret"
  value       = aws_instance.app.id
}

output "github_actions_role_arn" {
  description = "GitHub Actions IAM role ARN — set as AWS_ROLE_TO_ASSUME GitHub secret"
  value       = aws_iam_role.github_actions.arn
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "nat_gateway_ip" {
  description = "NAT Gateway public IP — whitelist in any external firewall if needed"
  value       = aws_eip.nat.public_ip
}

output "private_subnet_id" {
  description = "Private subnet ID (EC2)"
  value       = aws_subnet.private.id
}

output "ssm_connect_command" {
  description = "Command to connect to EC2 via SSM Session Manager"
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.aws_region} --profile ${var.aws_profile}"
}

output "next_steps" {
  description = "What to do after terraform apply"
  value       = <<-EOT

    ✅ Infrastructure created. Next steps:

    1. CONNECT to EC2 and fill in secrets:
       ${join("", ["aws ssm start-session --target ", aws_instance.app.id, " --region ", var.aws_region, " --profile ", var.aws_profile])}
       → sudo nano /opt/wealthclick/apps/web/.env
       → sudo -u ubuntu pm2 restart wealthclick

    2. TEST the app (HTTP):
       http://${aws_lb.main.dns_name}

    3. SET GitHub repository secrets:
       AWS_ROLE_TO_ASSUME = ${aws_iam_role.github_actions.arn}
       EC2_INSTANCE_ID    = ${aws_instance.app.id}

    4. ADD certificate (after domain is registered):
       terraform apply -var="certificate_arn=arn:aws:acm:..."

  EOT
}
