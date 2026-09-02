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
for the full design and reasoning; this repo doesn't yet contain the release workflow itself — that
design is still in `Drafting`, with open questions still unresolved. This repo exists now so the
design can reference a real home rather than a placeholder.

## Why a separate repo

Not the hub (`mootmaker` — deliberately holds no deployed code, and firing real deploys from a docs
repo blurs that), and not one of the three component repos it releases (arbitrarily picking one to
coordinate the other two is worse than a dedicated, single-minded home). See the design doc's own
"Trade-offs and decisions" for the fuller reasoning.

## What will live here

Once built: `release.yml` (the `workflow_dispatch`-triggered orchestrator — version computation,
tagging, sequencing each component's own build/deploy through `test` then `production`, smoke-test
invocation, and the GitHub Release that records what happened), and the cross-component smoke-test
suites (exact location still an open question in the design doc).

Each component repo (`mootmaker-api`, `mootmaker-webapp`, `mootmaker-demo-data`) owns its own
build-and-deploy logic as a reusable workflow (`on: workflow_call`) — this repo calls those, it
doesn't duplicate them.
