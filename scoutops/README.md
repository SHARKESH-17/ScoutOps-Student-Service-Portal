# ScoutOps

ScoutOps is a campus issue and maintenance management application built with Express, PostgreSQL, and a static web dashboard. It includes versioned database migrations, role-based API access, operational metrics, Docker Compose deployment, and a Jenkins pipeline.

## Features

- Issue reporting and workflow management with reporter, staff, and admin roles.
- Staff assignment and a database-backed status-change audit trail.
- PostgreSQL schema migrations applied transactionally under an advisory lock.
- Login rate limits, API rate limits, JWT authentication, and protected Prometheus metrics.
- Nginx TLS termination, HTTP-to-HTTPS redirects, and security response headers.
- Separate application and internal database networks; PostgreSQL has no published host port.
- Unit tests plus PostgreSQL-backed integration tests.
- Versioned container images, health-gated deployment, and an explicit rollback script.

## Requirements

- Node.js 20 or later and npm.
- Docker Engine and Docker Compose v2 for local or container deployments.
- PostgreSQL 16 for non-Docker development.

## Configure and run locally

Create a local environment file and provide unique secret values. Do not commit `.env`.

```bash
cp .env.example .env
```

Set at least `DB_PASSWORD`, `JWT_SECRET`, `ADMIN_PASSWORD`, and `METRICS_TOKEN` in `.env`. Use random URL-safe values (for example, 32 random bytes encoded as hexadecimal) for JWT and metrics secrets and a password of at least 12 characters for the bootstrap admin. `ADMIN_USERNAME` is the initial administrator account. For monitoring, also set `GRAFANA_ADMIN_PASSWORD`.

Start the application and PostgreSQL:

```bash
docker compose up --build
```

The app runs migrations and creates the bootstrap administrator if that username is not already present. Open `http://localhost:3000` and sign in. The development app is bound to loopback; PostgreSQL is accessible only to containers on its internal network.

For direct Node.js development, start a PostgreSQL instance and export the same database/authentication variables before running:

```bash
npm ci
npm start
```

## Roles and API

All `/api` routes except `POST /api/auth/login` require `Authorization: Bearer <JWT>`. Tokens expire after eight hours.

| Role | Permissions |
| --- | --- |
| `reporter` | View issues and report new issues |
| `staff` | Reporter permissions, update status/details, view history, and assign staff |
| `admin` | Staff permissions, create reporter/staff accounts, and delete issues |

The bootstrap admin is created from `ADMIN_USERNAME` and `ADMIN_PASSWORD`. The bootstrap command never changes an existing account's password. Admins can create accounts with:

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"maintenance","password":"use-a-unique-long-password","role":"staff"}'
```

Key endpoints:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET|POST /api/issues`
- `GET|PUT|DELETE /api/issues/:id`
- `PATCH /api/issues/:id/status`
- `PATCH /api/issues/:id/assignment`
- `GET /api/issues/:id/history`
- `GET /health` and `GET /health/db`
- `GET /metrics` (requires `Authorization: Bearer $METRICS_TOKEN`)

The UI stores the access token in tab-scoped session storage and escapes issue data before rendering it. Serve it only over HTTPS outside local development.

## Migrations

Numbered SQL migrations live in `db/migrations/`. On startup the app:

1. Acquires a PostgreSQL advisory lock.
2. Applies each pending migration in its own transaction.
3. Records successful migration versions in `schema_migrations`.

Run or inspect migrations explicitly with `npm run migrate` or `npm run migrate:status`. Do not edit an already-applied migration; add a new numbered migration instead. Migration `003_users_assignments_history.sql` adds user roles, issue assignment, and the status-history trigger.

## Tests

Unit tests do not need a database:

```bash
npm test
```

The integration suite uses a real PostgreSQL 16 container and exercises login, persistence, and status history:

```bash
export DB_PASSWORD="$(openssl rand -hex 24)"
docker compose -f docker-compose.test.yml up -d --wait
export DB_HOST=127.0.0.1 DB_PORT=5432 DB_NAME=scoutops_test DB_USER=scoutops_test
export ADMIN_USERNAME=integration-admin ADMIN_PASSWORD="$(openssl rand -hex 24)"
export JWT_SECRET="$(openssl rand -hex 32)"
npm run migrate
npm run user:bootstrap
npm run test:integration
docker compose -f docker-compose.test.yml down -v
```

The Jenkins pipeline runs both suites against this PostgreSQL service. Configure secret-text Jenkins credentials `scoutops-test-db-password`, `scoutops-test-admin-password`, `scoutops-test-jwt-secret`, and `scoutops-test-metrics-token`, a registry username/password credential `scoutops-registry`, and an SSH private-key credential `scoutops-deploy-ssh`. Set `SCOUTOPS_IMAGE_REPOSITORY` in Jenkins; deployments additionally require `SCOUTOPS_DEPLOY_HOST` and `SCOUTOPS_DEPLOY_PATH`. The Deploy stage runs only from `main`.

## Production deployment

The production Compose stack runs the app, PostgreSQL, and Nginx. Only Nginx publishes ports 80 and 443; PostgreSQL has no host binding and is isolated on an internal network. The Jenkins deploy host must be able to pull the published image (the AWS Terraform template expects a public image). Nginx redirects HTTP to HTTPS and expects these files in the directory configured by `TLS_CERT_DIR`:

- `fullchain.pem`
- `privkey.pem`

Provision a valid certificate for the production hostname before starting the stack. Configure a production `.env` outside version control with:

- `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `METRICS_TOKEN`
- `SCOUTOPS_IMAGE_REPOSITORY`, `SCOUTOPS_IMAGE_TAG` (an immutable build tag, never `latest`)
- `TLS_CERT_DIR`
- `TLS_HOSTNAME` (the hostname covered by the installed certificate)

Deploy an already-published image with:

```bash
SCOUTOPS_IMAGE_REPOSITORY=registry.example/scoutops \
SCOUTOPS_IMAGE_TAG=123-a1b2c3d4e5f6 \
bash scripts/deploy.sh
```

The deploy script pulls the immutable tag, starts the production stack, checks HTTPS using `TLS_HOSTNAME`, and records the prior image tag in `.scoutops-previous-tag`. Roll back to that exact tag with:

```bash
bash scripts/rollback.sh
```

Both scripts require Docker Compose and `curl`; rollback is available after at least one earlier healthy deployment has been recorded. Database migrations are additive in this project; restoring an older image does not reverse a migration.

### Monitoring

Prometheus reads `METRICS_TOKEN` from the environment and sends it as a bearer token. Start the monitoring stack from the ScoutOps directory after the app stack has created `scoutops-app-network`:

```bash
METRICS_TOKEN="$METRICS_TOKEN" \
GRAFANA_ADMIN_PASSWORD="$GRAFANA_ADMIN_PASSWORD" \
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```

Prometheus and Grafana bind to loopback by default. Do not expose them directly to the public internet.

## AWS Terraform template

`infra/aws` provisions a VPC, public app host, private PostgreSQL RDS instance, security groups, and an EC2 role using Systems Manager instead of public SSH. RDS creates and stores its master password through Secrets Manager; PostgreSQL is not publicly accessible. The app host reads runtime secrets through a narrowly scoped IAM policy. `scripts/aws-deploy.sh` can trigger the configured deploy script through Systems Manager by setting `AWS_REGION` and `AWS_INSTANCE_ID`.

Terraform requires:

- `image_repository`, immutable `image_tag`, and `tls_hostname` for a publicly pullable application image and its TLS certificate.
- `runtime_secret_arns` in this order: JWT secret, admin JSON (`username` and `password`), metrics token, and TLS JSON (`fullchain` and `privkey`).
- A Terraform state backend with encryption and access control. Terraform state contains infrastructure metadata and must be protected.

Initialize, review, and apply only after configuring the required variables and AWS credentials:

```bash
cd infra/aws
terraform init
terraform plan
terraform apply
```

This template has not been applied to a live AWS account. Confirm region-specific quotas, costs, Docker Compose availability on the selected AMI, image access, secret formats, certificate validity, and production recovery requirements before use.

## Repository layout

```text
scoutops/
├── db/migrations/       # Versioned schema changes
├── infra/aws/           # Terraform deployment template
├── monitoring/          # Prometheus and Grafana configuration
├── nginx/               # TLS reverse proxy configuration
├── public/              # Dashboard UI
├── scripts/             # Migration, deploy, rollback, and operations tools
├── src/                 # Express API and PostgreSQL client
└── tests/                # Unit and real-PostgreSQL integration tests
```
