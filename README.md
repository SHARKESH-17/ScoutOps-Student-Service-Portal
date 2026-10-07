# ScoutOps

## Find. Track. Resolve.

ScoutOps is a campus issue and maintenance management application that allows students and staff to report infrastructure problems and enables maintenance teams to track, manage, assign, and resolve those issues. The platform centralizes issue intake, prioritization, status updates, and resolution tracking for a modern campus operations team. It also demonstrates a complete DevOps lifecycle through GitHub, Jenkins, Docker, automated testing, production-style deployments, and monitoring with Prometheus and Grafana.

## Project Overview

ScoutOps is designed for campus maintenance and infrastructure management. It allows users to report problems including broken classroom equipment, electrical faults, plumbing issues, Wi-Fi outages, cleaning problems, damaged furniture, laboratory equipment failures, security concerns, and other campus maintenance requests.

The system provides a professional web interface, validates issue payloads, stores records in PostgreSQL, exposes a REST API, and supports operations monitoring and alerting. The application is production-oriented and suited for deployment on Ubuntu Linux hosts such as AWS EC2 instances.

## Project Objectives

- Centralized issue reporting
- Issue tracking
- Status management
- Database persistence
- REST API
- Containerization
- Automated testing
- CI/CD
- Production deployment
- Monitoring
- Alerting
- Backup
- Rollback

## Architecture

### Application Architecture

```text
User
 ↓
ScoutOps Web UI
 ↓
Express REST API
 ↓
PostgreSQL
```

### DevOps Architecture

```text
Developer
 ↓
GitHub
 ↓
Jenkins
 ↓
Tests
 ↓
Docker Build
 ↓
Deployment
 ↓
ScoutOps
 ↓
PostgreSQL
```

### Monitoring Architecture

```text
ScoutOps
 ↓
Prometheus
 ↓
Grafana
 ↓
Alerts
```

## Technology Stack

- Node.js 20 LTS: JavaScript runtime for the API and application logic.
- Express.js: Web framework that powers the REST API and static UI.
- PostgreSQL: Relational database for persistent issue records.
- HTML5/CSS3/Vanilla JavaScript: Frontend interface for reporting and managing issues.
- Jest + Supertest: Automated API and application testing.
- Docker + Docker Compose: Containerization for local and production deployments.
- Prometheus: Metrics collection and alerting data source.
- Grafana: Visualization, dashboards, and datasource integration.
- Jenkins: CI/CD automation and pipeline validation.
- GitHub: Source control and webhook-driven automation.
- prom-client: Node.js Prometheus metrics instrumentation.
- Ubuntu/Linux: Host environment for EC2 and service deployment.

## Project Structure

```text
scoutops/
├── src/
│   ├── app.js
│   ├── server.js
│   └── db.js
│
├── public/
│   └── index.html
│
├── tests/
│   └── app.test.js
│
├── db/
│   └── init.sql
│
├── scripts/
│   ├── deploy.sh
│   ├── rollback.sh
│   ├── backup.sh
│   └── cleanup.sh
│
├── monitoring/
│   ├── docker-compose.monitoring.yml
│   ├── prometheus.yml
│   ├── alerts.yml
│   └── grafana-datasource.yml
│
├── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
├── Jenkinsfile
├── .env.example
├── LICENSE
├── README.md
├── package.json
├── package-lock.json
└── .gitignore (if created locally and not committed)
```

## Prerequisites

The following tools are required for a fresh Ubuntu machine:

- Ubuntu 22.04+ or later
- Git
- Node.js 20 LTS
- npm
- Docker
- Docker Compose v2
- PostgreSQL client tools (for backup and database inspection)
- Jenkins (for CI/CD workflow)

Version check commands:

```bash
node --version
npm --version
git --version
docker --version
docker compose version
```

## Installation

On a fresh Ubuntu machine:

```bash
sudo apt-get update
sudo apt-get install -y curl git ca-certificates docker.io docker-compose-plugin postgresql-client

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

For Jenkins installation, refer to the Jenkins setup section in this README.

## Clone Project

```bash
git clone <repository-url>
cd scoutops
```

Replace `<repository-url>` with the actual Git remote URL for your project repository.

## Environment

Create a local environment file from the example:

```bash
cp .env.example .env
```

The `.env.example` file contains:

```env
NODE_ENV=development
PORT=3000

DB_HOST=postgres
DB_PORT=5432
DB_NAME=scoutops
DB_USER=scoutops_user
DB_PASSWORD=change_me

PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
APP_IMAGE_TAG=latest
SCOUTOPS_IMAGE_TAG=latest
```

Important:

- `.env` must not be committed to Git.
- Keep production credentials in a secure secrets manager or Jenkins credentials.
- Do not hardcode production secrets in files committed to Git.

## Local Node Execution

Install dependencies and run tests:

```bash
npm ci
npm test
npm start
```

The application requires PostgreSQL to be running locally or accessible through the configured database host. In local development, the preferred path is Docker Compose.

Verify the app:

```bash
curl http://localhost:3000
```

## Docker Execution

Build the image:

```bash
docker build -t scoutops:latest .
```

Start the stack:

```bash
docker compose up --build
```

Start in detached mode:

```bash
docker compose up -d --build
```

Check running services:

```bash
docker compose ps
```

Logs:

```bash
docker compose logs
docker compose logs scoutops-app
docker compose logs postgres
```

Verify the local app:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/db
curl http://localhost:3000/metrics
```

## Application Testing

The application exposes the following APIs:

- `GET /`
- `GET /health`
- `GET /health/db`
- `GET /metrics`
- `GET /api/issues`
- `GET /api/issues/:id`
- `POST /api/issues`
- `PUT /api/issues/:id`
- `DELETE /api/issues/:id`
- `PATCH /api/issues/:id/status`

Example curl commands:

```bash
curl http://localhost:3000/api/issues

curl -X POST http://localhost:3000/api/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Water leak in dormitory",
    "description": "The drain is backing up in the second-floor restroom.",
    "category": "PLUMBING",
    "location": "Dormitory Wing B",
    "priority": "HIGH",
    "status": "OPEN",
    "reporter_name": "Campus Resident"
  }'

curl -X PUT http://localhost:3000/api/issues/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated issue",
    "description": "Issue corrected after inspection.",
    "category": "ELECTRICAL",
    "location": "Engineering Hall",
    "priority": "MEDIUM",
    "status": "RESOLVED",
    "reporter_name": "Maintenance Supervisor"
  }'

curl -X PATCH http://localhost:3000/api/issues/1/status \
  -H "Content-Type: application/json" \
  -d '{"status":"RESOLVED"}'

curl -X DELETE http://localhost:3000/api/issues/1
```

## Database

Initialize the database and seed demo records:

```bash
docker compose exec postgres psql \
  -U scoutops_user \
  -d scoutops
```

Then inspect tables:

```sql
\dt
SELECT * FROM issues;
```

The application uses a persistent Docker volume for PostgreSQL, which keeps the database state between restarts unless explicitly removed with `docker compose down -v`.

## Stop and Start

Stop the stack:

```bash
docker compose down
```

Restart the stack:

```bash
docker compose up -d
```

Danger:

```bash
docker compose down -v
```

This removes persistent local database volumes and destroys saved data.

## Production

Build a production stack:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Verify containers:

```bash
docker compose -f docker-compose.prod.yml ps
```

View logs:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

## Deployment Script

Make all scripts executable:

```bash
chmod +x scripts/*.sh
```

Run the deployment script:

```bash
./scripts/deploy.sh
```

The script validates the Docker environment, builds the production image, starts the PostgreSQL database containers, waits for health checks, verifies the service, and prints the deployment URL.

## Database Backup

Create a backup:

```bash
./scripts/backup.sh
```

The script connects to PostgreSQL using the configured environment variables, stores the backup under `backups/`, includes a timestamp in the filename, and prints a restore example.

## Rollback

Execute the rollback process:

```bash
./scripts/rollback.sh
```

The rollback script checks the currently deployed image tag, identifies a previous valid version, brings the application down, re-launches the previous image, and verifies the health endpoint before reporting success.

## Cleanup

Run cleanup:

```bash
./scripts/cleanup.sh
```

The script removes stopped containers, unused networks, and stale Docker resources. It does not delete production PostgreSQL volumes automatically unless the explicit `--delete-volumes` flag is passed and confirmed by the operator.

## Prometheus

Start the monitoring stack:

```bash
docker compose \
  -f monitoring/docker-compose.monitoring.yml \
  up -d
```

Open the Prometheus UI at:

```text
http://localhost:9090
```

Then navigate to `Status -> Targets` and verify the ScoutOps target shows `UP`.

Useful queries:

```promql
up{job="scoutops"}
rate(scoutops_http_requests_total[5m])
histogram_quantile(0.95, sum(rate(scoutops_http_request_duration_seconds_bucket[5m])) by (le))
```

## Grafana

Open Grafana at:

```text
http://localhost:3001
```

Login credentials:

- Username: `admin`
- Password: `admin`

The datasource is provisioned automatically with the Prometheus URL `http://prometheus:9090`.

## Alerts

The monitoring stack includes these alert rules:

- `ScoutOpsApplicationDown`
- `ScoutOpsHighErrorRate`
- `ScoutOpsHighLatency`

These can be reviewed via the Prometheus Alerts page or Grafana dashboards after the monitoring stack is running.

## Jenkins Setup

1. Install Jenkins on a controller or VM.
2. Install required plugins such as GitHub, Pipeline, and Docker pipeline support.
3. Install Git and Docker on the Jenkins agent.
4. Add the Jenkins user to the Docker group so the agent can run Docker commands.
5. Configure Jenkins credentials for GitHub and deployment automation.
6. Configure a Jenkins agent with connectivity to the controller.
7. Create a pipeline project and point it to this repository.
8. Use the included `Jenkinsfile` for CI/CD automation.

Required tools on the agent:

- Git
- Node.js
- npm
- Docker
- Docker Compose plugin
- curl

Docker permissions:

```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

## Jenkins Pipeline

The declarative pipeline performs the following stages:

1. Checkout
2. Install Dependencies
3. Run Tests
4. Build Docker Image
5. Validate
6. Deploy
7. Health Check

If tests fail or the Docker build fails, the pipeline stops and deployment does not continue.

## GitHub Webhook

To connect GitHub to Jenkins, use the webhook URL:

```text
https://<jenkins-domain>/github-webhook/
```

In GitHub:

- Go to `Settings`
- Select `Webhooks`
- Click `Add webhook`
- Set the payload type to `application/json`
- Point the webhook to the Jenkins URL above
- Select the relevant repository events

## Complete CI/CD Test

```bash
git add .
git commit -m "Update ScoutOps application"
git push origin main
```

Then verify:

- GitHub receives the push.
- Jenkins receives the webhook.
- Jenkins runs the pipeline.
- Tests pass.
- Docker build succeeds.
- Deployment step runs according to the environment.
- Health checks pass.

## Failure Test

A controlled pipeline failure can be created intentionally by breaking a test or build step, pushing to the repository, and confirming that the Jenkins pipeline fails before deployment continues.

## Monitoring Failure Test

```bash
docker stop scoutops-app
```

Prometheus should report the ScoutOps target as unavailable or `DOWN` until the app is restored:

```bash
docker start scoutops-app
```

## Backup/Recovery Test

1. Create a new issue through the UI or API.
2. Run the backup script:
   ```bash
   ./scripts/backup.sh
   ```
3. Verify the backup file exists under `backups/`.
4. Restore the backup into a temporary or test database environment.
5. Confirm the issue exists in the database.

## Complete Execution Procedure

### Step 1: Install prerequisites
Purpose: Prepare a working Ubuntu/Linux build environment.
Command:
```bash
sudo apt-get update
sudo apt-get install -y curl git ca-certificates docker.io docker-compose-plugin postgresql-client
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Expected output: Node, Docker, and Git installed successfully.
Verification: `node --version`, `docker --version`, `docker compose version`.
Troubleshooting: Ensure Docker service is running with `sudo systemctl status docker`.

### Step 2: Clone ScoutOps
Purpose: Retrieve the project source code.
Command:
```bash
git clone <repository-url>
cd scoutops
```
Expected output: Project directory created locally.
Verification: `ls` shows the ScoutOps project files.
Troubleshooting: Check the remote URL and credentials.

### Step 3: Enter the project directory
Purpose: Start within the ScoutOps repository.
Command:
```bash
cd scoutops
```
Expected output: Repository root visible.
Verification: `pwd` and `ls`.

### Step 4: Create `.env`
Purpose: Store environment configuration.
Command:
```bash
cp .env.example .env
```
Expected output: `.env` created.
Verification: `cat .env`.
Troubleshooting: Ensure `.env` is ignored by Git.

### Step 5: Install dependencies
Purpose: Install required Node modules.
Command:
```bash
npm ci
```
Expected output: Packages installed successfully.
Verification: `npm test` runs without install errors.
Troubleshooting: Use `npm cache clean --force` if necessary.

### Step 6: Run tests
Purpose: Validate application behavior.
Command:
```bash
npm test
```
Expected output: Jest passes all tests.
Verification: Exit code 0.
Troubleshooting: Review failing tests and correct the application or test setup.

### Step 7: Build Docker image
Purpose: Build a production-ready container image.
Command:
```bash
docker build -t scoutops:latest .
```
Expected output: `Successfully tagged scoutops:latest`.
Verification: `docker image ls | grep scoutops`.
Troubleshooting: Docker daemon must be running.

### Step 8: Start Docker Compose
Purpose: Launch the application and database together.
Command:
```bash
docker compose up -d --build
```
Expected output: Containers created and started.
Verification: `docker compose ps`.
Troubleshooting: Check logs with `docker compose logs`.

### Step 9: Verify containers
Purpose: Ensure the stack is healthy.
Command:
```bash
docker compose ps
```
Expected output: `scoutops-app` and `postgres` running.
Verification: Health checks pass.
Troubleshooting: Inspect container logs.

### Step 10: Open ScoutOps
Purpose: Use the web UI.
Command:
```text
http://localhost:3000
```
Expected output: ScoutOps dashboard loads.
Verification: UI renders with the issue form and issue list.
Troubleshooting: Check the port binding and Docker logs if the page is unavailable.

### Step 11: Check the health endpoint
Purpose: Confirm app health.
Command:
```bash
curl http://localhost:3000/health
```
Expected output: `{"status":"UP","service":"scoutops"}`
Verification: HTTP 200.
Troubleshooting: Verify the app container is running and listening on port 3000.

### Step 12: Check database health
Purpose: Confirm PostgreSQL connectivity.
Command:
```bash
curl http://localhost:3000/health/db
```
Expected output: `{"status":"UP","database":"connected"}`
Verification: Response code 200.
Troubleshooting: Check the database container and environment variables.

### Step 13: Check metrics
Purpose: Validate Prometheus-compatible metrics are exposed.
Command:
```bash
curl http://localhost:3000/metrics
```
Expected output: Prometheus metrics output.
Verification: Response contains lines such as `scoutops_http_requests_total`.
Troubleshooting: Check the Prometheus client instrumentation in `src/app.js`.

### Step 14: Create an issue
Purpose: Test the issue creation workflow.
Command:
```bash
curl -X POST http://localhost:3000/api/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test issue",
    "description": "A sample campus issue to validate the pipeline.",
    "category": "ELECTRICAL",
    "location": "Main Hall",
    "priority": "MEDIUM",
    "status": "OPEN",
    "reporter_name": "Test Operator"
  }'
```
Expected output: JSON issue representation.
Verification: The new issue appears in the issue list.
Troubleshooting: Validate the JSON payload matches the required fields.

### Step 15: Update an issue
Purpose: Confirm the update API works.
Command:
```bash
curl -X PUT http://localhost:3000/api/issues/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Updated issue",
    "description":"Issue updated for validation.",
    "category":"PLUMBING",
    "location":"West Wing",
    "priority":"HIGH",
    "status":"ASSIGNED",
    "reporter_name":"Ops Team"
  }'
```
Expected output: Updated issue JSON.
Verification: Response reflects the changed values.

### Step 16: Change issue status
Purpose: Validate status transitions.
Command:
```bash
curl -X PATCH http://localhost:3000/api/issues/1/status \
  -H "Content-Type: application/json" \
  -d '{"status":"RESOLVED"}'
```
Expected output: Updated issue and status value.
Verification: Status changes from `OPEN`/`ASSIGNED` to `RESOLVED`.

### Step 17: Delete/test issue
Purpose: Confirm delete operations.
Command:
```bash
curl -X DELETE http://localhost:3000/api/issues/1
```
Expected output: Success message and deleted object.
Verification: Issue no longer appears in the list.
Troubleshooting: Use a known valid issue ID.

### Step 18: Build production environment
Purpose: Prepare the production-ready stack.
Command:
```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```
Expected output: Production services report healthy.
Verification: `docker compose -f docker-compose.prod.yml ps`.
Troubleshooting: Ensure your environment variables are set correctly.

### Step 19: Run deployment script
Purpose: Execute the production deployment automation.
Command:
```bash
./scripts/deploy.sh
```
Expected output: Application deploys and health checks pass.
Verification: `curl http://localhost:3000/health`.
Troubleshooting: Check Docker and environment variable configuration.

### Step 20: Run database backup
Purpose: Capture a consistent database snapshot.
Command:
```bash
./scripts/backup.sh
```
Expected output: Backup file created in `backups/`.
Verification: `ls backups` shows a timestamped SQL dump.
Troubleshooting: Ensure pg_dump is installed and DB credentials are valid.

### Step 21: Start Prometheus
Purpose: Monitor the application metrics.
Command:
```bash
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```
Expected output: Prometheus and Grafana start.
Verification: `docker compose -f monitoring/docker-compose.monitoring.yml ps`.
Troubleshooting: Ensure the `scoutops-network` exists or was created by the app stack.

### Step 22: Verify Prometheus target
Purpose: Confirm Prometheus is scraping ScoutOps metrics.
Command:
```text
http://localhost:9090
```
Expected output: `UP` target under `Status -> Targets`.
Verification: `job="scoutops"` target is healthy.
Troubleshooting: Check the target name and `prometheus.yml` scrape config.

### Step 23: Start/access Grafana
Purpose: View dashboards and metrics visually.
Command:
```text
http://localhost:3001
```
Expected output: Grafana login page displayed.
Verification: Login with `admin` / `admin` and validate datasource connectivity.
Troubleshooting: Confirm the Grafana datasource file is mounted correctly.

### Step 24: Verify Grafana datasource
Purpose: Confirm Prometheus is attached as the default datasource.
Command:
```text
Grafana -> Connections -> Data sources
```
Expected output: Prometheus data source configured and connected.
Verification: Prometheus datasource is available in the dashboard.
Troubleshooting: Check the `grafana-datasource.yml` provisioning file.

### Step 25: Verify Prometheus alerts
Purpose: Confirm alert rules are active.
Command:
```text
Prometheus -> Alerts
```
Expected output: Alerts visible and configured.
Verification: `ScoutOpsApplicationDown`, `ScoutOpsHighErrorRate`, and `ScoutOpsHighLatency` appear.
Troubleshooting: Validate the PromQL expressions in `monitoring/alerts.yml`.

### Step 26: Configure Jenkins
Purpose: Support CI/CD automation.
Command:
```text
Install Jenkins and configure the agent.
```
Expected output: Jenkins controller and agent can communicate.
Verification: Agent status shows online.
Troubleshooting: Check Docker permissions and network connectivity.

### Step 27: Configure GitHub webhook
Purpose: Trigger Jenkins from GitHub pushes.
Command:
```text
GitHub -> Settings -> Webhooks -> Add webhook
```
Expected output: Webhook created for `https://<jenkins-domain>/github-webhook/`.
Verification: GitHub reports the webhook as active.
Troubleshooting: Check the Jenkins domain and GitHub permissions.

### Step 28: Push code
Purpose: Trigger CI/CD pipeline.
Command:
```bash
git add .
git commit -m "Update ScoutOps application"
git push origin main
```
Expected output: Code is pushed to the repository.
Verification: GitHub shows the push and Jenkins launches the job.
Troubleshooting: Check hook settings and credentials.

### Step 29: Verify Jenkins pipeline
Purpose: Confirm automated deployment pipeline.
Command:
```text
Jenkins -> Pipeline run
```
Expected output: Stages succeed or fail clearly with logs.
Verification: Checkout, install, test, Docker build, deploy, and health checks complete.
Troubleshooting: Review Jenkins logs and stage outputs.

### Step 30: Verify production deployment
Purpose: Confirm deployment matches the production environment.
Command:
```bash
docker compose -f docker-compose.prod.yml ps
curl http://localhost:3000/health
```
Expected output: Containers healthy and health endpoint returns `UP`.
Verification: Production stack is live.
Troubleshooting: Review environment variables and image tags.

### Step 31: Perform controlled CI failure test
Purpose: Verify the pipeline fails when the build is broken.
Command:
```bash
# Intentionally break a test, commit, and push.
```
Expected output: Jenkins pipeline fails and deployment stops.
Verification: No production deployment occurs on failure.
Troubleshooting: Fix the issue and push the corrected code again.

### Step 32: Perform monitoring failure test
Purpose: Validate Prometheus alerts detect outages.
Command:
```bash
docker stop scoutops-app
```
Expected output: Prometheus reports the target as unavailable.
Verification: `docker start scoutops-app` restores the target to `UP`.
Troubleshooting: Ensure the app container name matches `scoutops-app`.

### Step 33: Perform backup/recovery test
Purpose: Validate disaster recovery readiness.
Command:
```bash
./scripts/backup.sh
```
Expected output: A SQL dump exists in `backups/`.
Verification: Restoring the dump reproduces the issue data.
Troubleshooting: Ensure PostgreSQL credentials and permissions are valid.

### Step 34: Perform rollback test
Purpose: Ensure previous versions can be re-deployed safely.
Command:
```bash
./scripts/rollback.sh
```
Expected output: Previous image tag is restored and health-check passes.
Verification: `curl http://localhost:3000/health` returns `UP`.
Troubleshooting: Confirm an earlier image tag is available from Docker.

### Step 35: Perform cleanup
Purpose: Remove stale Docker artifacts and free system resources.
Command:
```bash
./scripts/cleanup.sh
```
Expected output: Stopped containers and unused resources are removed.
Verification: `docker system df` shows reduced usage.
Troubleshooting: Use `--delete-volumes` only with explicit confirmation and only when intentional.

## Troubleshooting

### 1. Docker daemon not running
Command:
```bash
sudo systemctl status docker
sudo systemctl start docker
```
Diagnostic: `docker ps` and `docker info`.

### 2. Port already in use
Command:
```bash
ss -tulpn | grep 3000
ss -tulpn | grep 5432
```
Solution: Stop the conflicting process or change the application port in `.env` and Docker Compose settings.

### 3. PostgreSQL connection refused
Command:
```bash
docker compose logs postgres
psql -h localhost -p 5432 -U scoutops_user -d scoutops
```
Solution: Ensure `postgres` is healthy and the `DB_HOST` value matches the Docker service name.

### 4. PostgreSQL authentication failure
Command:
```bash
docker compose logs postgres
```
Solution: Check `.env` credentials and the `POSTGRES_USER` and `POSTGRES_PASSWORD` values in Compose files.

### 5. Application container exits
Command:
```bash
docker compose logs scoutops-app
docker ps -a
```
Solution: Check Node process errors, environment variables, and the database connection settings.

### 6. Health check failure
Command:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/db
```
Solution: Review the app logs and PostgreSQL service status.

### 7. Docker permission denied
Command:
```bash
sudo usermod -aG docker $USER
newgrp docker
```
Solution: Log out and back in or restart the terminal session.

### 8. Jenkins Docker permission denied
Command:
```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```
Solution: Reopen the Jenkins agent and verify Docker access works from the agent process.

### 9. Jenkins agent offline
Command:
```text
Manage Jenkins -> Nodes
```
Solution: Verify connectivity, agent labels, and Java runtime compatibility.

### 10. GitHub authentication failure
Command:
```bash
git remote -v
git config --global --list
```
Solution: Reconfigure SSH keys or GitHub token credentials for the repository.

### 11. Jenkins pipeline failure
Command:
```text
Jenkins -> Pipeline -> Console Output
```
Solution: Review the failing test/build step and fix the code or configuration issue.

### 12. npm test failure
Command:
```bash
npm test -- --runInBand
```
Solution: Inspect failing assertions and fix issues before redeploying.

### 13. Prometheus target DOWN
Command:
```bash
docker compose -f monitoring/docker-compose.monitoring.yml logs prometheus
```
Solution: Verify the service name `scoutops-app` is reachable on the same Docker network.

### 14. Grafana datasource failure
Command:
```bash
docker compose -f monitoring/docker-compose.monitoring.yml logs grafana
```
Solution: Verify the datasource configuration references `http://prometheus:9090` and the monitoring stack is running.

### 15. Shell script permission denied
Command:
```bash
chmod +x scripts/*.sh
```
Solution: Ensure the scripts are executable before running them directly.

### 16. Missing environment variable
Command:
```bash
env | grep -E 'DB_|PORT|NODE_ENV'
```
Solution: Populate `.env` from `.env.example` and restart the containers.

### 17. Database initialization failure
Command:
```bash
docker compose logs postgres
docker compose exec postgres psql -U scoutops_user -d scoutops -c '\dt'
```
Solution: Check `db/init.sql` for syntax issues and the `POSTGRES_DB`/`POSTGRES_USER` environment variables.

### 18. Docker network issue
Command:
```bash
docker network ls
docker inspect scoutops-network
```
Solution: Ensure all compose stacks use the same network name and recreate the network if necessary.

## Security

- Never commit `.env` to Git.
- Never hardcode secrets into source control.
- Use Jenkins credentials for pipeline secrets.
- Use parameterized SQL queries in the database layer.
- Run containers as non-root where practical.
- Use least privilege for services and deployments.
- Restrict exposed ports in production.
- Use secure SSH configuration for deployment.
- Do not store private keys in Git.

## Validation

Before finalizing the project we validated the following:

1. Correct filesystem structure.
2. package.json syntax.
3. package-lock.json exists.
4. Dependencies install correctly.
5. `npm test` passes.
6. Dockerfile is valid.
7. docker-compose.yml is valid.
8. docker-compose.prod.yml is valid.
9. Monitoring Compose file is valid.
10. Prometheus configuration is valid.
11. Alert configuration is valid.
12. Grafana datasource file is valid.
13. SQL is valid.
14. Scripts are executable.
15. Jenkinsfile is valid.
16. Application starts successfully.
17. PostgreSQL starts successfully.
18. Database initialization runs correctly.
19. `/health` returns the expected status.
20. `/health/db` returns a database status.
21. `/metrics` returns Prometheus metrics.
22. CRUD APIs work correctly.
23. Prometheus scrapes the ScoutOps app.
24. Grafana connects to Prometheus.
25. No secrets are hardcoded in committed files.
26. README commands match the implementation.

## Final Delivery

The final deliverable is a ready-to-extract `scoutops.zip` archive containing the ScoutOps project folder at the top level.

This project is branded as SCOUTOPS and uses the tagline: `Find. Track. Resolve.`
