# AWS cost-controlled deployment audit

Audit date: 2026-09-24. Account: `787565887338`. Region: `us-east-1`.
No resource has been applied by this work.

## Verified account status

- Billing Credits showed **Active credits: 0**.
- Free Tier usage showed only the always-free AWS Glue request allowance. It did
  not show an active EC2 or RDS offer.
- Cost Explorer returned `0 USD` estimated unblended cost for 2026-09-01 through
  2026-09-25.
- `aws budgets describe-budgets` returned no budgets.
- A tag inventory for `Project=VibeGuard` returned no resources both before and
  after planning.

The deployment must therefore be evaluated as fully billable. A Budget is part
of the optimized plan, but it is an alert and cannot cap spending.

## Original 41-resource plan

Authenticated result: **41 add, 0 change, 0 destroy**.

| Resources | Purpose | Cost behavior | Decision |
|---|---|---|---|
| VPC, default SG, internet gateway | Required network boundary | No hourly charge | Keep |
| 2 public subnets, 2 private DB subnets | ALB/ECS and isolated RDS placement | No direct charge | Reduce to 1 public + 2 private |
| Public route table + 2 associations | Internet routing | No direct charge | Reduce to 1 association |
| ALB SG, ECS SG, RDS SG | Network access control | No direct charge | Replace with EC2 + RDS SGs |
| ALB, target group, listener | Production load balancing | ALB hourly + LCU; usually 2 public IPv4s | Remove for demo |
| ECS cluster, task definition, service | Managed container compute | Fargate vCPU/RAM + 1 public IPv4 | Replace with one EC2 Docker host |
| ECS execution role + 2 attachments/policies | ECR, log, secret access | No direct charge | Replace with least-privilege EC2 role |
| ECR repository + lifecycle policy | Docker registry | Image storage/scan usage | Keep, retain only 5 images |
| CloudWatch log group | Application logs | Ingest/storage | Keep, reduce 365 to 14 days |
| RDS subnet group, SG, parameter group | Private PostgreSQL | No separate charge | Keep |
| RDS db.t3.micro | Persistent PostgreSQL | Instance hourly + storage/backups | Keep Single-AZ |
| RDS monitoring role + attachment | Enhanced metrics | Monitoring/log usage | Remove for demo |
| S3 bucket, access block, encryption, versioning, lifecycle, policy | Private frontend | Storage/requests | Keep; remove versioning for temporary demo |
| CloudFront distribution, OAC, origin request policy | HTTPS frontend/API edge | Requests/data transfer | Keep for secure HTTPS and same-origin API |
| Secrets Manager secret | Runtime credentials | Per-secret monthly + API usage | Keep, values outside Terraform |

There is no NAT gateway in the original plan.

The main fixed-cost drivers were the ALB, Fargate task, RDS instance/storage,
and three expected public IPv4 addresses. CloudFront, S3, ECR, CloudWatch,
Secrets Manager, backups, requests, scanning, and data transfer are usage based.

## Optimized 30-resource plan

Authenticated result: **30 add, 0 change, 0 destroy**. Terraform 1.16.3 and AWS
provider 5.100.0 passed initialization, formatting, validation, and planning.

The optimized architecture uses:

- private S3 + CloudFront for HTTPS dashboard delivery and API proxying;
- one public `t3.small` EC2 instance running the API Docker image from ECR;
- CloudFront-origin-only HTTP ingress, IMDSv2, encrypted gp3 root storage, and no SSH;
- private, encrypted, Single-AZ `db.t3.micro` PostgreSQL with an AWS-managed password;
- Secrets Manager for JWT and optional NVIDIA credentials, absent from Terraform state;
- least-privilege EC2 IAM, 14-day CloudWatch logs, immutable ECR tags and five-image retention;
- a $50 monthly account budget with forecasted 50%, actual 80%, and actual 100% alerts.

AWS Pricing API returned `0.0208 USD/hour` for Linux `t3.small` and
`0.0180 USD/hour` for Single-AZ PostgreSQL `db.t3.micro` in us-east-1.
Adding one public IPv4, 20 GB EC2 gp3, 20 GB RDS gp3, and one secret gives an
estimated fixed baseline of about **$0.050/hour**, **$1.22/day**, **$8.5/7 days**,
and **$36–40/30 days**. Requests, logs, image storage/scanning, data transfer,
CloudFront, S3, and excess backups are additional usage-based costs.

This is materially cheaper than the original estimated $50–65/month plan, but
with zero verified credits it still creates out-of-pocket charges.

## Commands and evidence

```text
~/bin/terraform init -input=false
# exit 0
~/bin/terraform fmt -check -recursive
# exit 0
~/bin/terraform validate
# exit 0
~/bin/terraform plan -input=false -lock=false -no-color \
  -var='budget_email=plan-only@example.invalid' \
  -out=/tmp/vibeguard-demo.tfplan
# Plan: 30 to add, 0 to change, 0 to destroy. Exit 0.

aws resourcegroupstaggingapi get-resources --region us-east-1 \
  --tag-filters Key=Project,Values=VibeGuard \
  --query 'ResourceTagMappingList[].ResourceARN' --output text
# empty

aws ce get-cost-and-usage \
  --time-period Start=2026-09-01,End=2026-09-25 \
  --granularity MONTHLY --metrics UnblendedCost
# Amount: 0 USD; Estimated: true
```

The plan used `plan-only@example.invalid` solely to validate the Budget resource.
A real notification email is required before apply.

## Apply gate and cleanup

Apply is blocked because the account has no verified credits, the real Budget
subscriber email has not been supplied, and transfer of the NVIDIA credential
has not been approved. NVIDIA is optional; the system can deploy without it.

When those gates are resolved, follow `iac/demo/README.md`: apply the Budget
first, stage ECR/RDS/Secrets, populate a generated JWT secret out-of-band, push
the immutable image, and then apply the reviewed full plan. Capture smoke-test
evidence before any production-readiness claim.

Cleanup command:

```bash
terraform -chdir=iac/demo destroy -var='budget_email=<real-alert-email>'
```

This deletes the temporary EC2 host and root volume, RDS database and automated
backups without a final snapshot, frontend objects/bucket, CloudFront, ECR images
and repository, log group, secret, IAM, Budget, and networking. Run a final tag
inventory and Billing check after destroy. Do not destroy without explicit user
instruction.
