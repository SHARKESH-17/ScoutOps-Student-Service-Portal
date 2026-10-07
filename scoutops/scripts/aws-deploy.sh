#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

required=(AWS_REGION AWS_INSTANCE_ID)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "$name must be configured in the environment or .env." >&2
    exit 1
  fi
done

command -v aws >/dev/null 2>&1 || { echo "AWS CLI v2 is required." >&2; exit 1; }

command_id="$(aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$AWS_INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "Deploy ScoutOps using the configured immutable image tag" \
  --parameters 'commands=["cd /opt/scoutops/scoutops && bash scripts/deploy.sh"]' \
  --query 'Command.CommandId' \
  --output text)"

echo "Deployment command submitted: $command_id"
for attempt in $(seq 1 60); do
  status="$(aws ssm get-command-invocation \
    --region "$AWS_REGION" \
    --command-id "$command_id" \
    --instance-id "$AWS_INSTANCE_ID" \
    --query 'Status' \
    --output text 2>/dev/null || true)"
  case "$status" in
    Success)
      echo "ScoutOps deployment completed successfully."
      exit 0
      ;;
    Failed|Cancelled|TimedOut)
      aws ssm get-command-invocation \
        --region "$AWS_REGION" \
        --command-id "$command_id" \
        --instance-id "$AWS_INSTANCE_ID" \
        --query '{status:Status,stdout:StandardOutputContent,stderr:StandardErrorContent}' \
        --output json >&2
      exit 1
      ;;
  esac
  sleep 5
done

echo "Timed out while waiting for the AWS Systems Manager deployment command." >&2
exit 1
