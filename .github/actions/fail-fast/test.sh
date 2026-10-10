#!/usr/bin/env bash
# Tests for fail-fast, against fixture job lists instead of the GitHub API. Run: ./test.sh
set -uo pipefail
cd "$(dirname "$0")"

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
export FAIL_FAST_JOBS_FILE="${tmp}/jobs.json"
export RUNNER_NAME="runner-me"
export FAIL_FAST_INTERVAL=1 FAIL_FAST_GRACE=2
unset GH_TOKEN FAIL_FAST_TOKEN_FILE

failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; failures=$((failures + 1)); }

jobs() { printf '%s' "$1" > "${FAIL_FAST_JOBS_FILE}"; }

me='{"name":"build-webapp / build","runner_name":"runner-me","status":"in_progress","conclusion":null,"steps":[{"name":"Build","conclusion":"success"},{"name":"Acceptance tests","conclusion":null}]}'
ok_sibling='{"name":"build-api / build","runner_name":"runner-api","status":"in_progress","conclusion":null,"steps":[{"name":"Build and unit test","conclusion":"success"}]}'
failed_step='{"name":"build-android / build","runner_name":"runner-and","status":"in_progress","conclusion":null,"steps":[{"name":"Build and sign","conclusion":"failure"},{"name":"Tear down the environment","conclusion":null}]}'
failed_job='{"name":"build-demo-data / build","runner_name":"runner-demo","status":"completed","conclusion":"failure","steps":[]}'
timed_out='{"name":"build-api / build","runner_name":"runner-api","status":"completed","conclusion":"timed_out","steps":[]}'
skipped='{"name":"build-android / build","runner_name":null,"status":"completed","conclusion":"skipped","steps":[]}'
me_failed='{"name":"build-webapp / build","runner_name":"runner-me","status":"in_progress","conclusion":null,"steps":[{"name":"Lint","conclusion":"failure"}]}'

# --- check ---------------------------------------------------------------------------------------

jobs "{\"jobs\":[${me},${ok_sibling},${skipped}]}"
if ./fail-fast check >/dev/null; then pass "check: healthy siblings pass"; else fail "check: healthy siblings pass"; fi

jobs "{\"jobs\":[${me},${ok_sibling},${failed_step}]}"
out="$(./fail-fast check)"; status=$?
if [[ ${status} -eq 1 && "${out}" == *"Stopped early"*"build-android / build: Build and sign"* ]]; then
  pass "check: a failed step in a running sibling stops"
else fail "check: a failed step in a running sibling stops (status ${status}: ${out})"; fi

jobs "{\"jobs\":[${me},${failed_job}]}"
if ! ./fail-fast check >/dev/null; then pass "check: a failed sibling job stops"; else fail "check: a failed sibling job stops"; fi

jobs "{\"jobs\":[${me},${timed_out}]}"
if ! ./fail-fast check >/dev/null; then pass "check: a timed-out sibling stops"; else fail "check: a timed-out sibling stops"; fi

jobs "{\"jobs\":[${me_failed},${ok_sibling}]}"
if ./fail-fast check >/dev/null; then pass "check: its own job's failures are ignored"; else fail "check: its own job's failures are ignored"; fi

rm -f "${FAIL_FAST_JOBS_FILE}"
if ./fail-fast check >/dev/null 2>&1; then pass "check: unreadable jobs carry on"; else fail "check: unreadable jobs carry on"; fi

# --- run -----------------------------------------------------------------------------------------

jobs "{\"jobs\":[${me},${ok_sibling}]}"
if ./fail-fast run -- true; then pass "run: passes a command's success through"; else fail "run: passes a command's success through"; fi

./fail-fast run -- bash -c 'exit 7'; status=$?
if [[ ${status} -eq 7 ]]; then pass "run: passes a command's exit status through"; else fail "run: passes a command's exit status through (got ${status})"; fi

out="$(./fail-fast run -- echo hello)"
if [[ "${out}" == "hello" ]]; then pass "run: command output reaches the log"; else fail "run: command output reaches the log (${out})"; fi

start=$SECONDS
./fail-fast run -- sleep 2; status=$?
if [[ ${status} -eq 0 && $((SECONDS - start)) -lt 5 ]]; then pass "run: notices a command finishing"; else fail "run: notices a command finishing (status ${status}, $((SECONDS - start))s)"; fi

jobs "{\"jobs\":[${me},${failed_step}]}"
if ! ./fail-fast run -- touch "${tmp}/started" >/dev/null; then
  if [[ ! -e "${tmp}/started" ]]; then pass "run: does not start when a sibling already failed"
  else fail "run: does not start when a sibling already failed (it started)"; fi
else fail "run: does not start when a sibling already failed (it succeeded)"; fi

# A sibling fails while the command runs: the whole process group must stop, children included.
jobs "{\"jobs\":[${me},${ok_sibling}]}"
( sleep 2; jobs "{\"jobs\":[${me},${failed_step}]}" ) &
start=$SECONDS
out="$(./fail-fast run -- bash -c 'sleep 300 & echo $! > '"${tmp}"'/child; wait')"; status=$?
elapsed=$((SECONDS - start))
child="$(cat "${tmp}/child" 2>/dev/null)"
if [[ ${status} -eq 1 && ${elapsed} -lt 15 && "${out}" == *"Stopped early"* ]]; then
  pass "run: stops when a sibling fails mid-run (${elapsed}s)"
else fail "run: stops when a sibling fails mid-run (status ${status}, ${elapsed}s)"; fi
if [[ -n "${child}" ]] && ! kill -0 "${child}" 2>/dev/null; then pass "run: stops the command's children too"
else fail "run: stops the command's children too (pid ${child} still running)"; kill "${child}" 2>/dev/null; fi

# A command that ignores SIGTERM is killed after the grace period.
jobs "{\"jobs\":[${me},${ok_sibling}]}"
( sleep 2; jobs "{\"jobs\":[${me},${failed_job}]}" ) &
start=$SECONDS
./fail-fast run -- bash -c 'trap "" TERM; sleep 300' >/dev/null; status=$?
elapsed=$((SECONDS - start))
if [[ ${status} -eq 1 && ${elapsed} -lt 15 ]]; then pass "run: kills a command that ignores TERM (${elapsed}s)"
else fail "run: kills a command that ignores TERM (status ${status}, ${elapsed}s)"; fi

# The GitHub API being unreadable mid-run must not stop the command.
jobs "{\"jobs\":[${me},${ok_sibling}]}"
( sleep 1; rm -f "${FAIL_FAST_JOBS_FILE}" ) &
./fail-fast run -- sleep 4 2>/dev/null; status=$?
if [[ ${status} -eq 0 ]]; then pass "run: an unreadable API mid-run carries on"; else fail "run: an unreadable API mid-run carries on (status ${status})"; fi

wait
echo
if [[ ${failures} -eq 0 ]]; then echo "All fail-fast tests passed."; else echo "${failures} fail-fast test(s) FAILED."; exit 1; fi
