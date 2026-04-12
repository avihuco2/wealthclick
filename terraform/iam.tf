# ── GitHub Actions OIDC Provider ──────────────────────────────────────────────
# Allows GitHub Actions to exchange a short-lived OIDC token for AWS credentials.
# No long-lived secrets stored in GitHub.

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  # Thumbprint of the GitHub Actions OIDC intermediate CA certificate.
  # AWS independently validates the full certificate chain for OIDC,
  # so this thumbprint is a secondary check. Update if GitHub rotates their cert.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# ── GitHub Actions IAM Role ───────────────────────────────────────────────────

resource "aws_iam_role" "github_actions" {
  name = "${var.project_name}-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github_actions.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          # Restrict to main branch pushes only
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/${var.github_branch}"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "${var.project_name}-deploy-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SSMSendCommand"
        Effect = "Allow"
        Action = [
          "ssm:SendCommand",
          "ssm:GetCommandInvocation",
        ]
        Resource = [
          # Scope SendCommand to this document only
          "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript",
          # Scope to instances tagged Project=wealthclick in this account
          "arn:aws:ec2:${var.aws_region}:930458520260:instance/*",
        ]
        Condition = {
          StringEquals = {
            "aws:ResourceTag/Project" = "wealthclick"
          }
        }
      },
      {
        # GetCommandInvocation needs * resource (no resource-level constraint)
        Sid      = "SSMGetInvocation"
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation"]
        Resource = ["*"]
      },
      {
        Sid    = "EC2Describe"
        Effect = "Allow"
        Action = ["ec2:DescribeInstances"]
        # DescribeInstances does not support resource-level constraints
        Resource = ["*"]
      },
    ]
  })
}
