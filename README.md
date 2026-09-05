# mootmaker-release

A project that is part of my [Claude Code exploration](https://github.com/geoffweatherall/mootmaker).

## Purpose

Hosts the release pipeline that ships [mootmaker-api](https://github.com/geoffweatherall/mootmaker-api),
[mootmaker-webapp](https://github.com/geoffweatherall/mootmaker-webapp), and
[mootmaker-demo-data](https://github.com/geoffweatherall/mootmaker-demo-data) to `test` and
`production` — versioning, tagging, building and acceptance-testing all three together, promoting
through `test`, then `production`, with a smoke test at each stage.

Releasing is a deliberate, explicitly-initiated act (`gh workflow run` — a human or an AI), never a
side effect of merging to `main`. See
[mootmaker/designs/ci-cd-pipeline.md](https://github.com/geoffweatherall/mootmaker/blob/main/designs/ci-cd-pipeline.md)
for the full design and reasoning.

**Status: built and in regular use (updated 2026-09-05).** The design itself remains `Drafting`
until Geoff promotes it, but every stage now exists and runs: version computation, the three
component builds, tagging, promotion to `test` and then `production` with a smoke test either side,
automatic rollback, and the release record. Twenty versions have run through it so far; ten
recorded a failure, which is visible precisely because a failed run publishes a `FAILED` prerelease
rather than silently discarding the version it claimed.

Running `release.yml` today builds, acceptance-tests and tags all three components, deploys them to
`test`, smoke-tests that, promotes the same artifacts to `production`, smoke-tests again, and rolls
`production` back automatically if that fails.

## Why a separate repo

Not the hub (`mootmaker` — deliberately holds no deployed code, and firing real deploys from a docs
repo blurs that), and not one of the three component repos it releases (arbitrarily picking one to
coordinate the other two is worse than a dedicated, single-minded home). See the design doc's own
"Trade-offs and decisions" for the fuller reasoning.

## What lives here

`.github/workflows/release.yml` — the `workflow_dispatch`-triggered orchestrator, taking a `bump`
input (`patch`/`minor`/`major`). Built so far:

| Stage | Status |
|---|---|
| `compute-version` — next version from this repo's GitHub Releases; pins each component's commit | built |
| `build-api` / `build-webapp` / `build-demo-data` — each component's own `release-build.yml`, in parallel | built |
| `tag` — pushes `vX.Y.Z` to all four repos, only once every build is green | built |
| `deploy-test` → `smoke-test-test` | built |
| `deploy-production` → `smoke-test-production` → `rollback-production` → `smoke-test-rollback` | built |
| `record-outcome` — the GitHub Release, or a FAILED prerelease, or an issue | built |

Two things in there are easy to break by rearranging and are commented as such in the workflow:
tags are pushed **only after** all three builds pass, so a tag always names a proven commit; and
`record-outcome` runs `if: always()` and branches on the tag job's **own output** rather than on
whether later jobs succeeded, which is what prevents tags existing with nothing recording them.

The cross-component smoke-test suites live in `smoke/` (Playwright, with its own `run.sh` and
config), and `scripts/` holds the CloudWatch log shipping that gives each release durable detail
behind its GitHub Release summary.

[docs/release-confidence.md](docs/release-confidence.md) covers a question this pipeline raised and
then made measurable: **how many consecutive green releases are enough** to believe an intermittent
fault is fixed — why sampling can show a rate improved but cannot show it is small, what 60 runs
would actually cost in wall-clock and AWS spend, and why the deterministic regression test matters
more than the run count.

Each component repo (`mootmaker-api`, `mootmaker-webapp`, `mootmaker-demo-data`) owns its own
build-and-deploy logic as a reusable workflow (`on: workflow_call`) — this repo calls those, it
doesn't duplicate them.
