# AWS infrastructure (Terraform)

This folder contains a minimal Terraform deployment for the ScoutOps app in a VPC with:

- 1 public subnet and 1 private subnet pair
- 1 EC2 instance to run the application
- 1 RDS PostgreSQL instance in the private subnet
- Security groups for app and database tiers

## Usage

```bash
cd infra/aws
terraform init
terraform plan
terraform apply
```

## Notes

- Replace the default database password before production use.
- This is a base template for demonstration and iteration; production hardening should add:
  - ALB + target groups
  - TLS via ACM + Route53
  - IAM least-privilege policies
  - EBS snapshots / backups
  - Secrets Manager for DB credentials
  - CloudWatch alarms and log aggregation
