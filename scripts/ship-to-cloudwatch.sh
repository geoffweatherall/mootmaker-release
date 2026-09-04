#!/usr/bin/env bash
# Ships one release stage's structured output to /mootmaker/release-pipeline (Decision 11).
#
# Usage: ship-to-cloudwatch.sh <version> <stage> <component> <environment> <outcome> <file>
#
# version/stage/component/environment/outcome are the consistent fields Decision 11 names as what
# makes this queryable rather than merely archived - the saved Logs Insights queries in
# deploy/terraform/logs.tf read exactly these back.
#
# NON-FATAL BY DESIGN. Decision 11 is explicit that a put-log-events call which errors - a
# transient throttle, a permission gap - must not fail the release stage it is attached to.
# Logging is diagnostic infrastructure, not the release's purpose; a release that deployed cleanly
# and passed its smoke tests should not be blocked or rolled back because a log call hiccupped.
#
# So this always exits 0. It does NOT swallow errors silently, though - that would defeat
# troubleshooting a genuinely broken shipping path - it reports them to stderr and carries on.
set -uo pipefail

LOG_GROUP="/mootmaker/release-pipeline"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

version="${1:?usage: ship-to-cloudwatch.sh <version> <stage> <component> <environment> <outcome> <file>}"
stage="${2:?}"
component="${3:?}"
environment="${4:?}"
outcome="${5:?}"
file="${6:?}"

warn() { echo "ship-to-cloudwatch: $*" >&2; }

if [[ ! -f "${file}" ]]; then
  warn "nothing to ship - ${file} does not exist"
  exit 0
fi

# One stream per stage per release, so a version's story reads in order rather than interleaving
# with concurrent stages. Streams are free; the group is what carries the retention policy.
stream="${version}/${stage}/${component}"
payload="$(mktemp)"
trap 'rm -f "${payload}"' EXIT

if ! python3 "${script_dir}/build-log-events.py" \
  "${file}" "${version}" "${stage}" "${component}" "${environment}" "${outcome}" \
  "$(date -u +%s000)" > "${payload}" 2>/dev/null; then
  warn "could not build the event payload from ${file} - skipping"
  exit 0
fi

if [[ ! -s "${payload}" ]] || [[ "$(cat "${payload}")" == "[]" ]]; then
  warn "no loggable lines in ${file} - skipping"
  exit 0
fi

# Already exists when a stage is retried, which is not an error worth reporting.
aws logs create-log-stream \
  --log-group-name "${LOG_GROUP}" \
  --log-stream-name "${stream}" >/dev/null 2>&1 || true

if aws logs put-log-events \
  --log-group-name "${LOG_GROUP}" \
  --log-stream-name "${stream}" \
  --log-events "file://${payload}" >/dev/null 2>&1; then
  echo "Shipped ${file} to ${LOG_GROUP} (${stream})"
else
  warn "put-log-events failed for ${stream} - the release is unaffected, but this stage's detail is missing from CloudWatch"
fi

exit 0
