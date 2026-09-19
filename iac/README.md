# VibeGuard Infrastructure as Code (IaC)

This directory contains the Terraform configuration to deploy the VibeGuard monorepo to AWS.

## Architecture
- **Frontend**: private S3 bucket + CloudFront (global CDN)
- **Backend**: ECS Fargate (Serverless Docker) + Application Load Balancer
- **Registry**: AWS ECR
- **Database**: encrypted RDS PostgreSQL in isolated subnets with an AWS-managed master password
- **Network**: public ALB/ECS subnets, isolated database subnets, and source-restricted security groups

## Prerequisites
1. [AWS CLI](https://aws.amazon.com/cli/) installed and configured (`aws configure`)
2. [Terraform](https://developer.hashicorp.com/terraform/downloads) installed
3. [Docker](https://docs.docker.com/get-docker/) installed

## Deployment Steps

### 1. Initialize and create the ECR repository
The release image must exist before ECS can start. Create ECR first:
```bash
cd iac
terraform init
terraform apply -target=aws_ecr_repository.api -target=aws_ecr_lifecycle_policy.api
```

### 2. Build and Push the Backend API
After the ECR repository is created, build the Docker image and push it to AWS:
```bash
# Get the ECR repository URI from the AWS Console or Terraform state
export ECR_URI="<your_account_id>.dkr.ecr.<region>.amazonaws.com/vibeguard-api"

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URI

# Build from the root of the monorepo (not the iac folder)
cd ..
docker build -t vibeguard-api -f Dockerfile.api .

# Tag and Push
export RELEASE_TAG="$(git rev-parse --short=12 HEAD)"
docker tag vibeguard-api:latest "$ECR_URI:$RELEASE_TAG"
docker push "$ECR_URI:$RELEASE_TAG"
```

### 3. Create the database and populate runtime secrets
Create RDS and the empty application secret before starting ECS:
```bash
terraform apply \
  -target=aws_db_instance.postgres \
  -target=aws_secretsmanager_secret.api_keys
```

Populate the application secret outside Terraform so secret values never enter Terraform state:
```bash
aws secretsmanager put-secret-value \
  --secret-id vibeguard-api-keys \
  --secret-string "$(jq -n --arg jwt "$JWT_SECRET" --arg nim "$NVIDIA_API_KEY" '{JWT_SECRET:$jwt,NVIDIA_API_KEY:$nim}')"
terraform apply -var="api_image_tag=$RELEASE_TAG"
```

### 4. Deploy the Frontend
Build the Vite React app and sync it to the new S3 bucket:
```bash
# Build the frontend
npm run build --workspace=apps/web

# Sync to S3 (replace with your bucket name from Terraform output)
FRONTEND_BUCKET="$(terraform -chdir=iac output -raw frontend_bucket_name)"
aws s3 sync apps/web/dist "s3://$FRONTEND_BUCKET" --delete
```

CloudFront routes `/api/*` to the load balancer, so the browser uses the same HTTPS origin for the dashboard and API. Build the web app with its default `VITE_API_URL=/`.

## Cleanup
To destroy all resources and stop incurring AWS charges:
```bash
terraform destroy
```
