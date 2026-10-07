data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ssm_parameter" "amazon_linux_2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-vpc"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-${var.environment}-igw"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-public-${count.index + 1}"
    Environment = var.environment
    Project     = var.project_name
    Tier        = "public"
  }
}

resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "${var.project_name}-${var.environment}-private-${count.index + 1}"
    Environment = var.environment
    Project     = var.project_name
    Tier        = "private"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-public-rt"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "app" {
  name        = "${var.project_name}-${var.environment}-app-sg"
  description = "Allow HTTP/HTTPS and SSH access to the app instance."
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-app-sg"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_security_group" "db" {
  name        = "${var.project_name}-${var.environment}-db-sg"
  description = "Allow database access from the app tier."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from app tier"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-db-sg"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnets"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name        = "${var.project_name}-${var.environment}-db-subnets"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "${var.project_name}-${var.environment}-db"
  allocated_storage      = 20
  db_name                = var.db_name
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = var.db_instance_class
  username               = var.db_username
  manage_master_user_password = true
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  storage_encrypted      = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "${var.project_name}-${var.environment}-final"
  backup_retention_period = 7
  deletion_protection    = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-db"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-${var.environment}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "read_runtime_secrets" {
  name = "${var.project_name}-${var.environment}-read-runtime-secrets"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = concat([aws_db_instance.postgres.master_user_secret[0].secret_arn], var.runtime_secret_arns)
    }]
  })
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-${var.environment}-instance-profile"
  role = aws_iam_role.ec2_role.name
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.amazon_linux_2023_ami.value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  depends_on = [
    aws_iam_role_policy_attachment.ssm_core,
    aws_iam_role_policy.read_runtime_secrets,
  ]

  user_data = <<-EOF
              #!/bin/bash
              set -eu
              umask 077
              dnf update -y
              dnf install -y docker docker-compose-plugin git awscli python3
              systemctl enable docker
              systemctl start docker
              mkdir -p /opt/scoutops
              cd /opt/scoutops
              git clone --depth 1 https://github.com/SHARKESH-17/ScoutOps-Student-Service-Portal.git .
              DB_SECRET=$(aws secretsmanager get-secret-value --secret-id ${aws_db_instance.postgres.master_user_secret[0].secret_arn} --query SecretString --output text --region ${var.aws_region})
              DB_USER=$(python3 -c "import json,sys; print(json.load(sys.stdin)['username'])" <<< "$DB_SECRET")
              DB_PASSWORD=$(python3 -c "import json,sys; print(json.load(sys.stdin)['password'])" <<< "$DB_SECRET")
              JWT_SECRET=$(aws secretsmanager get-secret-value --secret-id ${var.runtime_secret_arns[0]} --query SecretString --output text --region ${var.aws_region})
              ADMIN_SECRET=$(aws secretsmanager get-secret-value --secret-id ${var.runtime_secret_arns[1]} --query SecretString --output text --region ${var.aws_region})
              ADMIN_USERNAME=$(python3 -c "import json,sys; print(json.load(sys.stdin)['username'])" <<< "$ADMIN_SECRET")
              ADMIN_PASSWORD=$(python3 -c "import json,sys; print(json.load(sys.stdin)['password'])" <<< "$ADMIN_SECRET")
              METRICS_TOKEN=$(aws secretsmanager get-secret-value --secret-id ${var.runtime_secret_arns[2]} --query SecretString --output text --region ${var.aws_region})
              TLS_SECRET=$(aws secretsmanager get-secret-value --secret-id ${var.runtime_secret_arns[3]} --query SecretString --output text --region ${var.aws_region})
              mkdir -p /opt/scoutops/scoutops/tls
              python3 -c "import json,sys; s=json.load(sys.stdin); open('/opt/scoutops/scoutops/tls/fullchain.pem','w').write(s['fullchain']); open('/opt/scoutops/scoutops/tls/privkey.pem','w').write(s['privkey'])" <<< "$TLS_SECRET"
              chmod 600 /opt/scoutops/scoutops/tls/privkey.pem
              export DB_HOST=${aws_db_instance.postgres.address}
              export DB_PORT=5432
              export DB_NAME=${var.db_name}
              export DB_USER DB_PASSWORD JWT_SECRET ADMIN_USERNAME ADMIN_PASSWORD METRICS_TOKEN
              export SCOUTOPS_IMAGE_REPOSITORY=${var.image_repository}
              export SCOUTOPS_IMAGE_TAG=${var.image_tag}
              export TLS_CERT_DIR=/opt/scoutops/scoutops/tls
              export TLS_HOSTNAME=${var.tls_hostname}
              python3 - <<'PY'
              import os
              import shlex
              values = {
                  "NODE_ENV": "production",
                  "DB_HOST": os.environ["DB_HOST"],
                  "DB_PORT": os.environ["DB_PORT"],
                  "DB_NAME": os.environ["DB_NAME"],
                  "DB_USER": os.environ["DB_USER"],
                  "DB_PASSWORD": os.environ["DB_PASSWORD"],
                  "JWT_SECRET": os.environ["JWT_SECRET"],
                  "ADMIN_USERNAME": os.environ["ADMIN_USERNAME"],
                  "ADMIN_PASSWORD": os.environ["ADMIN_PASSWORD"],
                  "METRICS_TOKEN": os.environ["METRICS_TOKEN"],
                  "SCOUTOPS_IMAGE_REPOSITORY": os.environ["SCOUTOPS_IMAGE_REPOSITORY"],
                  "SCOUTOPS_IMAGE_TAG": os.environ["SCOUTOPS_IMAGE_TAG"],
                  "TLS_CERT_DIR": os.environ["TLS_CERT_DIR"],
                  "TLS_HOSTNAME": os.environ["TLS_HOSTNAME"],
                  "TRUST_PROXY": "true",
              }
              with open("/opt/scoutops/scoutops/.env", "w", encoding="utf-8") as env_file:
                  for key, value in values.items():
                      env_file.write(f"{key}={shlex.quote(value)}\n")
              PY
              chmod 600 /opt/scoutops/scoutops/.env
              cd /opt/scoutops/scoutops
              docker compose -f docker-compose.prod.yml up -d
              EOF

  tags = {
    Name        = "${var.project_name}-${var.environment}-app"
    Environment = var.environment
    Project     = var.project_name
  }
}

output "app_url" {
  description = "HTTPS URL configured for the ScoutOps deployment."
  value       = "https://${var.tls_hostname}"
}

output "app_public_ip" {
  description = "Public IPv4 address to point the TLS hostname at."
  value       = aws_instance.app.public_ip
}

output "database_endpoint" {
  description = "Address of the PostgreSQL database."
  value       = aws_db_instance.postgres.address
}
