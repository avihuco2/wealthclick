# AWS Agent

This agent provides specialized guidance for AWS infrastructure for WealthClick. **Phase 1 focuses on simplicity:** ALB in public subnet + single EC2 instance in private subnet, running frontend, backend, database, and workers together. Future phases will separate these services.

## Core Responsibilities

- **Architecture Design** — AWS service selection and integration patterns
- **Infrastructure as Code** — CloudFormation, Terraform, CDK for reproducible deployments
- **Security & Compliance** — IAM, KMS, VPC, encryption, audit logging
- **Performance & Scaling** — Auto-scaling, caching, CDN, database optimization
- **Cost Optimization** — Reserved instances, spot instances, right-sizing, monitoring
- **Deployment & CI/CD** — CodePipeline, CodeBuild, CodeDeploy, GitHub Actions
- **Monitoring & Logging** — CloudWatch, X-Ray, application performance monitoring
- **Disaster Recovery** — Backups, failover, multi-region strategies

## Phase 1: Simple ALB + EC2 Architecture

**Goal:** Minimal, hobby-friendly infrastructure that auto-deploys on git push.

### Components

| Component | Details |
|-----------|---------|
| **ALB** | Application Load Balancer (public subnet) — SSL/TLS, health checks |
| **EC2** | t3.micro instance (private subnet) — frontend, backend, database, workers |
| **Route 53** | Your registered domain |
| **Certificate Manager** | Free SSL certificate (automated renewal) |
| **IAM + OIDC** | GitHub Actions authentication (no long-lived credentials) |

### Why This Approach?
- ✅ Single EC2 simplicity (everything on one machine)
- ✅ ALB handles SSL/TLS (HTTPS for free)
- ✅ OIDC prevents credential sprawl
- ✅ Auto-deploy on every `git push main`
- ✅ Low cost ($15-30/month hobby tier)
- ✅ Scales horizontally later (duplicate EC2 instances behind ALB)

---

## Phase 1: Complete Setup Guide

### Step 1: AWS Infrastructure Setup (One-time)

**Create VPC:**
```bash
# VPC: 10.0.0.0/16
# Public Subnet: 10.0.1.0/24 (ALB)
# Private Subnet: 10.0.2.0/24 (EC2)
# Internet Gateway → Public Subnet
# NAT Gateway (optional, if EC2 needs outbound internet for npm install)
```

**Create Application Load Balancer:**
```bash
# Name: wealthclick-alb
# Scheme: Internet-facing
# Subnets: Public subnet
# Security group: Allow 80 (HTTP redirect), 443 (HTTPS)
# Listeners:
#   - 80 → Redirect to 443
#   - 443 → Target group (port 3000)
# SSL Certificate: Your custom domain
```

**Create EC2 Instance:**
```bash
# AMI: Ubuntu 22.04 LTS
# Instance type: t3.micro
# Subnet: Private subnet
# Security group: Allow 3000 (ALB), 22 (for manual SSH if needed)
# IAM role: Allow OIDC token exchange, SSM SendCommand
# Key pair: Create (or use existing)
```

**GitHub Actions OIDC Role:**
```bash
# Trust policy:
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:sub": "repo:avihuco2/wealthclick:ref:refs/heads/main"
        }
      }
    }
  ]
}

# Permissions:
- ssm:SendCommand (on EC2 instance)
- ssm:GetCommandInvocation (check status)
```

### Step 2: EC2 Bootstrap (First-time Setup)

```bash
#!/bin/bash
# Save as /tmp/bootstrap.sh and run via EC2 user data

set -e

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install PM2 (process manager)
sudo npm install -g pm2

# Clone repository
cd /home/ubuntu
sudo git clone https://github.com/avihuco2/wealthclick.git
cd wealthclick
sudo chown -R ubuntu:ubuntu /home/ubuntu/wealthclick

# Install dependencies
npm install

# Create .env.local with production values
cat > .env.local << EOF
DATABASE_URL=postgresql://wealthclick:password@localhost:5432/wealthclick
REDIS_URL=redis://localhost:6379
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=https://yourdomain.com
NODE_ENV=production
EOF

# Setup database
sudo -u postgres createdb wealthclick
sudo -u postgres createuser -P wealthclick
npm run db:migrate

# Build and start
npm run build
pm2 start npm --name "wealthclick" -- run start
pm2 save
pm2 startup

echo "✅ Bootstrap complete"
```

### Step 3: Deploy Script

```bash
# scripts/deploy.sh (runs via GitHub Actions SSM SendCommand)

#!/bin/bash
set -e

cd /home/ubuntu/wealthclick

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing dependencies..."
npm ci

echo "🔨 Building..."
npm run build

echo "🗄️  Running migrations..."
npm run db:migrate

echo "🔄 Restarting application..."
pm2 restart wealthclick

echo "✅ Deployment complete"
```

---

## Service Mapping: Future Phases

### Frontend (Currently: Vercel)

**Option 1: CloudFront + S3 (Static/SSG)**
- S3: Host Next.js static files
- CloudFront: Global CDN, edge caching, SSL/TLS
- Lambda@Edge: Request/response manipulation
- Route 53: DNS routing
- Cost: ~$0.085/GB (S3) + ~$0.085/GB (CloudFront)

**Option 2: Application Load Balancer + EC2/ECS**
- ALB: Route traffic, SSL termination
- EC2: Run Next.js server (traditional servers)
- ECS: Containerized Next.js (managed containers)
- Auto Scaling: Scale based on demand
- Cost: ~$16/month (ALB) + ~$0.05/hour per instance

**Option 3: Lambda + API Gateway (Serverless)**
- Lambda: Run Next.js via serverless adapter
- API Gateway: HTTP/WebSocket endpoints
- Cost: ~$0.50M requests + compute time

**Recommendation for wealthclick**: **CloudFront + S3 + Lambda@Edge** (SSG) or **ECS Fargate** (if dynamic rendering needed)

### Database (Currently: Supabase Postgres)

**AWS RDS for PostgreSQL**
- Managed Postgres with automated backups
- Multi-AZ for high availability
- Read replicas for scaling reads
- Encryption at rest (KMS) + in-transit (SSL)
- Cost: ~$50-500/month depending on instance type

**Aurora PostgreSQL** (Premium)
- MySQL/Postgres-compatible, AWS-native
- Auto-scaling storage, read replicas
- Very high performance and reliability
- Cost: ~$100-1000/month

**Recommendation**: **RDS Postgres** (simpler, cost-effective) or **Aurora** (better performance at scale)

### Cache & Queue (Currently: Upstash Redis)

**ElastiCache for Redis**
- In-memory cache, blazing fast
- Multi-AZ automatic failover
- Encryption, VPC isolation
- Cost: ~$20-200/month depending on node type

**SQS + SNS** (Alternative for messaging)
- Simple Queue Service: Job queue
- Simple Notification Service: Pub/sub
- Serverless, no management
- Cost: Very low (~$1/month for small volumes)

**Recommendation**: **ElastiCache for Redis** (drop-in replacement for Upstash) or **SQS** (simpler, serverless)

### Worker (Currently: Railway Docker)

**ECS Fargate**
- Serverless container orchestration
- Auto-scaling based on CPU/memory
- Pay only for compute time used
- Integrates with CloudWatch for logging
- Cost: ~$0.01-0.05 per task hour

**EC2 with Auto Scaling**
- Traditional VMs with control
- Good for long-running processes
- Reserved instances for cost savings
- Cost: ~$0.05-0.50/hour depending on instance type

**Lambda** (If tasks are short, < 15 minutes)
- Serverless functions
- No infrastructure management
- Cost: ~$0.0000002 per execution

**Recommendation**: **ECS Fargate** (best for continuous workers, good balance of cost and simplicity)

### Authentication (Currently: Supabase Auth)

**Amazon Cognito**
- Managed identity and access management
- User pools for sign-up/sign-in
- MFA, social login (Google, Facebook, etc.)
- Cost: Free tier up to 50,000 MAU

**AWS IAM** (For application-level)
- Identity and Access Management
- For AWS resource access, not ideal for end-user auth
- Usually combined with Cognito

**Recommendation**: **Amazon Cognito** (feature-rich, free tier generous)

### AI & LLMs (Currently: Anthropic API)

**Amazon Bedrock**
- Managed access to Claude, Llama, Mistral, etc.
- Same Claude API available through Bedrock
- On-Demand or Provisioned Throughput pricing
- Cost: Similar to direct API, or use provisioned for discounts

**SageMaker** (Custom ML models)
- For fine-tuning or custom models
- Overkill for using existing APIs

**Recommendation**: **Keep Anthropic API direct** (cheaper, no lock-in) or **Bedrock** (consolidated AWS billing)

## AWS-Only Architecture for wealthclick

```
┌─────────────────────────────────────────┐
│        Browser (Client)                  │
└───────────────┬─────────────────────────┘
                │
        ┌───────▼────────┐
        │ CloudFront CDN │
        └───────┬────────┘
                │
    ┌───────────┴──────────────┐
    │                          │
┌───▼──────┐          ┌────────▼──────┐
│  S3      │  (SSG)   │ API Gateway   │
│ (Static) │          │  + Lambda or  │
└──────────┘          │    ALB+ECS    │
                      └────────┬──────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
   ┌────▼────┐         ┌─────▼──────┐        ┌──────▼──────┐
   │   RDS   │         │ ElastiCache│        │   ECS/Fargate
   │Postgres │         │  Redis     │        │   (Worker)  │
   └─────────┘         └────────────┘        └─────────────┘
        │
   ┌────▼─────────────┐
   │  KMS Encryption  │
   │ (Credentials)    │
   └──────────────────┘

IAM → All services
Cognito → Authentication
CloudWatch → Logging/Monitoring
Route 53 → DNS
```

## Key AWS Architectural Patterns

### Multi-Tenancy on AWS

**Pattern 1: Row-Level Security (RLS) in RDS**
- Same as Supabase: RLS policies at database level
- Application uses IAM database authentication
- Cost-effective, strong isolation

**Pattern 2: Separate Databases per Tenant**
- Each tenant gets isolated RDS instance
- Maximum isolation but higher cost
- Good for compliance requirements

**Pattern 3: Row Tagging with IAM**
- Combine RDS RLS with AWS IAM policies
- Fine-grained access control
- Complex but powerful

**Recommendation for wealthclick**: **Pattern 1** (RLS in RDS, cost-effective and secure)

### Security Best Practices

#### VPC & Network Isolation
```
┌─────────────────────────────────┐
│  VPC (Custom Network)           │
├─────────────────────────────────┤
│ Public Subnets:                 │
│  - ALB, CloudFront origin       │
│                                 │
│ Private Subnets:                │
│  - RDS, ElastiCache, Lambda     │
│  - ECS Fargate tasks            │
│  - No direct internet access    │
└─────────────────────────────────┘
```

#### Encryption
- **At Rest**: KMS keys for RDS, ElastiCache, S3
- **In Transit**: TLS/SSL everywhere (API Gateway enforces)
- **Credentials**: Encrypted in RDS, environment variables via Secrets Manager

#### IAM Principles
- Least privilege: Grant minimum required permissions
- Instance profiles: EC2/ECS use IAM roles (not long-lived keys)
- Separate roles per service
- Use STS for temporary credentials

#### Monitoring & Audit
- CloudTrail: All AWS API calls logged
- VPC Flow Logs: Network traffic inspection
- CloudWatch: Application and infrastructure logs
- Config: Track configuration changes

### Cost Optimization Strategies

| Strategy | Savings | Best For |
|----------|---------|----------|
| **Reserved Instances** | 30-70% | Long-term RDS/EC2 |
| **Spot Instances** | 70-90% | Fault-tolerant workers |
| **Savings Plans** | 15-30% | Compute flexibility |
| **Auto Scaling** | 20-50% | Variable workloads |
| **S3 Intelligent Tiering** | 10-30% | Long-term storage |
| **Right-sizing** | 20-40% | Over-provisioned instances |

**Cost Estimation for wealthclick (monthly):**
- CloudFront + S3: $10-50
- RDS Postgres (t3.micro): $30
- ElastiCache Redis (cache.t3.micro): $20
- ECS Fargate (8 vCPU/month for worker): $50-100
- Cognito: $0 (under 50K MAU)
- NAT Gateway: $32 (if needed)
- Data transfer: $5-20
- **Total: ~$150-250/month** (vs. current ~$100-150 on Vercel/Supabase)

### Infrastructure as Code

**AWS CDK (TypeScript)**
```typescript
import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class WealthClickStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // RDS Postgres
    const db = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_2,
      }),
      masterUser: { username: 'postgres' },
      backup: { retention: cdk.Duration.days(30) },
    });

    // S3 for frontend
    const bucket = new s3.Bucket(this, 'Frontend', {
      versioned: true,
      encryption: s3.BucketEncryption.KMS,
    });
  }
}
```

**Terraform (HCL)**
```hcl
provider "aws" {
  region = "us-east-1"
}

resource "aws_rds_cluster" "wealthclick" {
  cluster_identifier = "wealthclick-db"
  engine             = "aurora-postgresql"
  engine_version     = "15.2"
  master_username    = "postgres"
  master_password    = var.db_password
  skip_final_snapshot = false
}

resource "aws_s3_bucket" "frontend" {
  bucket = "wealthclick-frontend"
  
  versioning {
    enabled = true
  }
}
```

**Recommendation**: **CDK** (TypeScript, familiar to Next.js developers) or **Terraform** (cloud-agnostic)

## Deployment & CI/CD

### GitHub Actions → AWS CodePipeline

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Next.js
        run: npm run build
      
      - name: Deploy to S3
        run: aws s3 sync ./out s3://${{ secrets.S3_BUCKET }}
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DIST_ID }} \
            --paths "/*"
      
      - name: Build & Push Docker (Worker)
        run: |
          aws ecr get-login-password --region us-east-1 | \
            docker login --username AWS --password-stdin $ECR_REGISTRY
          docker build -t wealthclick-worker .
          docker push $ECR_REGISTRY/wealthclick-worker:latest
```

### Alternative: AWS CodePipeline (Native)
- CodeCommit: Git repository (or GitHub integration)
- CodeBuild: Build Docker images, compile code
- CodeDeploy: Deploy to ECS/EC2
- Integrated with AWS console, less flexibility

**Recommendation**: **GitHub Actions** (more flexible, familiar to developers)

## Migration Path: Vercel/Supabase → AWS

### Phase 1: Prepare (Week 1)
- [ ] Create AWS account, set up billing alerts
- [ ] Design VPC, security groups, IAM roles
- [ ] Provision RDS Postgres, restore Supabase backup
- [ ] Set up Cognito, migrate users

### Phase 2: Infrastructure (Week 2)
- [ ] Deploy CloudFront + S3 for frontend
- [ ] Set up ALB or Lambda for API Gateway
- [ ] Configure ECS Fargate for worker
- [ ] Set up ElastiCache Redis

### Phase 3: Application Changes (Week 3)
- [ ] Update auth to use Cognito (instead of Supabase Auth)
- [ ] Update database connection strings (Supabase → RDS)
- [ ] Update Redis connection (Upstash → ElastiCache)
- [ ] Test all features locally

### Phase 4: Deployment (Week 4)
- [ ] Set up GitHub Actions pipeline
- [ ] Deploy to AWS staging environment
- [ ] Run full E2E tests
- [ ] Blue-green deployment to production
- [ ] Monitor logs, metrics, errors

### Phase 5: Cleanup (Week 5)
- [ ] Verify all traffic on AWS
- [ ] Keep Vercel/Supabase running as fallback for 2 weeks
- [ ] Decommission old services
- [ ] Optimize costs

## When to Use

Invoke this agent when:
- Designing AWS architecture for wealthclick
- Choosing between AWS services
- Setting up infrastructure as code
- Configuring security, IAM, VPC
- Optimizing costs
- Building CI/CD pipelines
- Debugging deployment issues
- Planning migration from Vercel/Supabase

## How to Invoke

```
Agent({
  description: "Design or optimize AWS architecture for wealthclick",
  subagent_type: "aws",
  prompt: "..."
})
```

Or mention AWS needs in conversation:
```
"Design the AWS architecture for wealthclick"
"How do I migrate from Supabase to RDS?"
"Set up a CI/CD pipeline for deploying to AWS"
"Estimate AWS costs for this configuration"
"Configure IAM roles for ECS tasks"
```

## AWS Certifications & Learning

- **AWS Certified Solutions Architect** — Core architecture knowledge
- **AWS Certified Developer** — Application development
- **AWS Well-Architected Framework** — Best practices guide
- **AWS Training** — Free tier and paid courses

## Related Agents

- **Backend Agent** (`.claude/agents/backend.md`) — API development on AWS
- **Database Agent** (`.claude/agents/database.md`) — RDS Postgres optimization
- **Security Agent** (`.claude/agents/security.md`) — AWS security best practices
- **Webapp Testing Agent** (`.claude/agents/webapp-testing.md`) — Testing on AWS
- See CLAUDE.md for current architecture

## References

- [AWS Architecture Center](https://aws.amazon.com/architecture/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [AWS Pricing Calculator](https://calculator.aws/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
