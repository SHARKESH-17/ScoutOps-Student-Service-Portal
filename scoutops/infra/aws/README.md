# AWS infrastructure (Terraform)

This template provisions a VPC, an EC2 app host, and private encrypted RDS PostgreSQL. The app host uses Systems Manager instead of SSH ingress and reads only the configured runtime Secrets Manager secrets plus the RDS-managed master secret. Database traffic is restricted to the app security group.

## Usage

Supply `image_repository`, immutable `image_tag`, `tls_hostname`, and `runtime_secret_arns` in `terraform.tfvars` or through `TF_VAR_*` environment variables. `runtime_secret_arns` must contain four secret ARNs in this order: JWT secret, bootstrap admin JSON (`username` and `password`), metrics token, and TLS certificate JSON (`fullchain` and `privkey`). The image must be publicly pullable by the EC2 host.

```bash
cd infra/aws
terraform init
terraform plan
terraform apply
```

Never commit `terraform.tfvars`, state files, or secret values. Use a remote encrypted state backend and review resource costs, AMI package availability, and recovery requirements before applying. This template has not been tested against a live AWS account.
