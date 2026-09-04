#!/usr/bin/env bash
# Deploys the release pipeline's own shared infrastructure: the CloudWatch log group every release
# stage ships its structured output to, and the saved queries over it (Decision 11).
#
# Unlike mootmaker-api/webapp/demo-data, this takes NO environment argument - like
# mootmaker-domain, there is exactly one release pipeline and one log group, shared by every
# environment a release touches. A release spans test and production together, so splitting the
# log group by environment would scatter one release's story across two places; the `environment`
# field inside each event distinguishes them instead.
#
# NOTE: `terraform apply -auto-approve` creates real AWS resources in whatever account/credentials
# are active.
set -euo pipefail
cd "$(dirname "$0")"

echo "Deploying mootmaker-release's log infrastructure..."

terraform -chdir=deploy/terraform init -backend-config=backend.hcl -input=false
terraform -chdir=deploy/terraform apply -auto-approve

echo
echo "Log group: $(terraform -chdir=deploy/terraform output -raw log_group_name)"
