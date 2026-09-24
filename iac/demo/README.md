# VibeGuard cost-controlled AWS demo

This independent Terraform root preserves the production stack in `iac/` while
providing a temporary, lower-cost AWS demonstration. It uses one `t3.small` EC2
Docker host instead of an ALB plus ECS/Fargate. PostgreSQL remains private on a
single-AZ `db.t3.micro` RDS instance. CloudFront serves the private S3 dashboard
and proxies API and health requests to EC2. The API security group accepts HTTP
only from the AWS-managed CloudFront origin prefix list; SSH is not exposed.

No secret values are stored in Terraform state. The application secret is
created empty and must be populated out-of-band. Do not add the NVIDIA key
without the account owner's explicit approval.

## Cost gate

The account must be treated as fully billable unless the Billing console shows
an applicable offer. The expected on-demand baseline in us-east-1 is about
$35–40 for a continuous 30-day run, about $8–10 for seven days, plus traffic
and request usage. AWS Budgets alerts do not cap or stop spending.

## Safe staged deployment

Copy `terraform.tfvars.example` to an untracked `terraform.tfvars` and set the
real budget alert email. Review every plan before applying.

```bash
terraform init
terraform fmt -check -recursive
terraform validate
terraform plan -out=demo.tfplan
```

Create the budget first, then the image repository and runtime dependencies.
These are intentionally separate gates so an empty repository cannot boot a
broken API host.

```bash
terraform apply -target=aws_budgets_budget.monthly
terraform apply \
  -target=aws_ecr_repository.api \
  -target=aws_ecr_lifecycle_policy.api \
  -target=aws_secretsmanager_secret.application \
  -target=aws_cloudwatch_log_group.api \
  -target=aws_db_instance.postgres
```

Populate the application secret with a freshly generated JWT secret. NVIDIA is
optional and omitted here. This command intentionally reads the JWT from a
prompt rather than placing it in shell history:

```bash
read -rsp "JWT secret: " JWT_SECRET && echo
aws secretsmanager put-secret-value \
  --secret-id vibeguard-demo-application \
  --secret-string "$(jq -nc --arg jwt "$JWT_SECRET" '{JWT_SECRET:$jwt}')"
unset JWT_SECRET
```

Build and push the exact commit-tagged image, then create the remaining stack:

```bash
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGION="us-east-1"
TAG="94292de"
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
docker build -f Dockerfile.api -t "vibeguard-api:$TAG" ../..
docker tag "vibeguard-api:$TAG" \
  "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/vibeguard-demo-api:$TAG"
docker push "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/vibeguard-demo-api:$TAG"
terraform apply
npm --workspace apps/web run build
aws s3 sync ../../apps/web/dist "s3://$(terraform output -raw frontend_bucket_name)" --delete
```

Smoke-test `/health`, `/ready`, registration, login, telemetry upload, and the
dashboard through `terraform output -raw cloudfront_url`.

## Cleanup

Export any required evidence first. Emptying the frontend bucket is unnecessary
because it has `force_destroy = true`; RDS skips a final snapshot for this demo.

```bash
terraform destroy
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=VibeGuard
```

Confirm the final tagged-resource query is empty and check Billing after destroy.
