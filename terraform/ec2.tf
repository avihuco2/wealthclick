# ── Ubuntu 22.04 LTS AMI ─────────────────────────────────────────────────────

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# ── EC2 IAM Role (SSM access) ─────────────────────────────────────────────────

resource "aws_iam_role" "ec2" {
  name = "${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "ec2_bedrock" {
  name = "${var.project_name}-ec2-bedrock-policy"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "BedrockInvoke"
        Effect = "Allow"
        Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
        # Wildcard covers all current and future foundation models —
        # the user's model picker controls which models are actually used.
        Resource = ["arn:aws:bedrock:*::foundation-model/*"]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ── EC2 Instance ──────────────────────────────────────────────────────────────

resource "aws_instance" "app" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.ec2_instance_type
  subnet_id     = aws_subnet.private.id

  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  associate_public_ip_address = false

  # userdata runs once at first boot only.
  # Set to false so Terraform won't destroy/recreate the instance
  # if the userdata script is later changed.
  user_data_replace_on_change = false
  user_data = base64encode(
    templatefile("${path.module}/scripts/userdata.sh", {
      github_repo = var.github_repo
    })
  )

  root_block_device {
    volume_size           = var.ec2_volume_size_gb
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = { Name = "${var.project_name}-app" }
}
