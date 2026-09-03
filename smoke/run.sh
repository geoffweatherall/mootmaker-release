#!/usr/bin/env bash
# Runs a smoke suite against an ALREADY-DEPLOYED environment. See
# ../mootmaker/designs/ci-cd-pipeline.md Decision 9.
#
# This script never creates or tears down an environment - the release pipeline deploys, then calls
# this. That is the opposite of mootmaker-webapp's e2e/acceptance run.sh, which may create its own
# ephemeral environment; a smoke test's whole purpose is to check the environment the release just
# produced.
#
# Usage:
#   ./smoke/run.sh test <environment>         the mutating suite (signup, meeting, reset, delete)
#   ./smoke/run.sh production <environment>   the strictly read-only suite
#
# The stage is an explicit argument rather than inferred from the environment name, so pointing the
# mutating suite at production takes a deliberate, visible mistake rather than a typo. It is also
# refused outright below.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="${script_dir}/.."
api_dir="${repo_root}/../mootmaker-api"
webapp_dir="${repo_root}/../mootmaker-webapp"
email_testing_dir="${repo_root}/../mootmaker-email-testing"

stage="${1:-}"
environment="${2:-}"
if [[ -z "${stage}" || -z "${environment}" ]]; then
  echo "Usage: ./smoke/run.sh <test|production> <environment>" >&2
  exit 1
fi
if [[ "${stage}" != "test" && "${stage}" != "production" ]]; then
  echo "stage must be 'test' or 'production', got '${stage}'" >&2
  exit 1
fi

# Decision 9 is emphatic that production takes NO writes from this layer. The mutating suite signs
# up accounts, creates meetings, resets passwords and deletes accounts - none of which may ever
# touch production, so this refuses the combination rather than trusting the caller.
if [[ "${stage}" == "test" && "${environment}" == "production" ]]; then
  echo "Refusing to run the mutating 'test' suite against production - production is read-only for smoke tests (Decision 9)." >&2
  exit 1
fi

for dir in "${api_dir}" "${webapp_dir}" "${email_testing_dir}"; do
  if [[ ! -d "${dir}" ]]; then
    echo "Expected to find ${dir} as a sibling checkout." >&2
    exit 1
  fi
done

# Populates GRAPHQL_API_URL, COGNITO_USER_POOL_ID, COGNITO_WEBAPP_CLIENT_ID, DEMO_USER_EMAIL,
# DEMO_USER_PASSWORD and friends from this environment's deployed Terraform outputs.
# shellcheck source=/dev/null
source "${api_dir}/authenticate.sh" "${environment}"

# The site URL comes from mootmaker-webapp's state rather than being constructed from the
# environment name, so a change to the domain layout cannot silently point the smoke test at a URL
# that does not exist.
webapp_tf_data_dir="${webapp_dir}/deploy/terraform/.terraform-${environment}"
TF_DATA_DIR="${webapp_tf_data_dir}" terraform -chdir="${webapp_dir}/deploy/terraform" init \
  -backend-config=backend.hcl \
  -backend-config="key=${environment}/mootmaker-webapp/terraform.tfstate" \
  -input=false >/dev/null
WEBAPP_URL="$(TF_DATA_DIR="${webapp_tf_data_dir}" terraform -chdir="${webapp_dir}/deploy/terraform" output -raw site_url)"
export WEBAPP_URL

# The email pipeline is persistent shared infrastructure owned by mootmaker-email-testing - one
# queue for the whole project, not one per environment. Only the mutating suite reads it, but
# populating it unconditionally keeps this script's two paths identical up to the final command.
terraform -chdir="${email_testing_dir}/deploy/terraform" init -backend-config=backend.hcl -input=false >/dev/null
SQS_QUEUE_URL="$(terraform -chdir="${email_testing_dir}/deploy/terraform" output -raw sqs_queue_url)"
export SQS_QUEUE_URL

echo "Smoke-testing '${environment}' (${stage} stage) at ${WEBAPP_URL}..." >&2

cd "${repo_root}"
npm run "smoke:${stage}"
