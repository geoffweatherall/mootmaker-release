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

**Status: partially built (2026-09-03).** The design's four blocking open questions are resolved and
build-out is under way, though the design itself remains `Drafting` until Geoff promotes it.
`.github/workflows/release.yml` now implements version computation, the three component builds,
tagging, and the release record. The promotion stages — deploy to `test`, smoke tests, deploy to
`production`, and automatic rollback — are **not built yet**: they depend on the smoke-test suites
(below) and on `test` being stood up, which has not happened. Running `release.yml` today builds,
acceptance-tests and tags all three components, and publishes a GitHub Release; it deploys nothing.

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
| deploy to `test` → smoke test `test` | not built |
| deploy to `production` → smoke test `production` → rollback on failure | not built |
| `record-outcome` — the GitHub Release, or a FAILED prerelease, or an issue | built |

Two things in there are easy to break by rearranging and are commented as such in the workflow:
tags are pushed **only after** all three builds pass, so a tag always names a proven commit; and
`record-outcome` runs `if: always()` and branches on the tag job's **own output** rather than on
whether later jobs succeeded, which is what prevents tags existing with nothing recording them.

Still to come: the cross-component smoke-test suites, and this repo's Node/Playwright setup, which
does not exist yet.

Each component repo (`mootmaker-api`, `mootmaker-webapp`, `mootmaker-demo-data`) owns its own
build-and-deploy logic as a reusable workflow (`on: workflow_call`) — this repo calls those, it
doesn't duplicate them.
