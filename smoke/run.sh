#!/usr/bin/env bash
# Runs a smoke suite against an ALREADY-DEPLOYED environment. See
# ../mootmaker/designs/archive/ci-cd-pipeline.md Decision 9.
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
# Still needed: the smoke suites import mootmaker-webapp's shared email and account helpers.
webapp_dir="${repo_root}/../mootmaker-webapp"

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

if [[ ! -d "${webapp_dir}" ]]; then
  echo "Expected to find ${webapp_dir} as a sibling checkout." >&2
  exit 1
fi

# Everything the suites need is looked up in SSM Parameter Store, where each component publishes
# what it owns (mootmaker-api#94). No other component's repository or Terraform state is read, so
# this needs only AWS credentials that can read /mootmaker/<environment>/* and
# /mootmaker/email-testing/*.
ssm_value() {
  local value
  if ! value="$(aws ssm get-parameter --name "$1" --with-decryption --query Parameter.Value --output text 2>&1)"; then
    echo "Could not read SSM parameter $1 - has '${environment}' been deployed? ${value}" >&2
    exit 1
  fi
  printf '%s' "${value}"
}

DEMO_USER_EMAIL="$(ssm_value "/mootmaker/${environment}/api/demo-user/email")"
DEMO_USER_PASSWORD="$(ssm_value "/mootmaker/${environment}/api/demo-user/password")"
# Published by mootmaker-webapp's own Terraform rather than built from the environment name, so a
# change to the domain layout cannot silently point the smoke test at a URL that does not exist.
WEBAPP_URL="$(ssm_value "/mootmaker/${environment}/webapp/site-url")"
# The email pipeline is persistent shared infrastructure owned by mootmaker-email-testing - one
# queue for the whole project, not one per environment. Only the mutating suite reads it, but
# populating it unconditionally keeps this script's two paths identical up to the final command.
SQS_QUEUE_URL="$(ssm_value /mootmaker/email-testing/sqs-queue-url)"
export DEMO_USER_EMAIL DEMO_USER_PASSWORD WEBAPP_URL SQS_QUEUE_URL

# The mutating suite creates (and removes) its own room over the API, because the account it signs
# up is a standard user and cannot. The read-only production suite never needs these.
if [[ "${stage}" == "test" ]]; then
  GRAPHQL_API_URL="$(ssm_value "/mootmaker/${environment}/api/graphql-url")"
  M2M_TOKEN_URL="$(ssm_value "/mootmaker/${environment}/api/m2m-client/token-url")"
  M2M_CLIENT_ID="$(ssm_value "/mootmaker/${environment}/api/m2m-client/client-id")"
  M2M_CLIENT_SECRET="$(ssm_value "/mootmaker/${environment}/api/m2m-client/client-secret")"
  M2M_SCOPE="$(ssm_value "/mootmaker/${environment}/api/m2m-client/scope")"
  export GRAPHQL_API_URL M2M_TOKEN_URL M2M_CLIENT_ID M2M_CLIENT_SECRET M2M_SCOPE
fi

echo "Smoke-testing '${environment}' (${stage} stage) at ${WEBAPP_URL}..." >&2

cd "${repo_root}"
npm run "smoke:${stage}"
