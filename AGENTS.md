# mootmaker-release

Hosts the release pipeline that ships `mootmaker-api`, `mootmaker-webapp`, and
`mootmaker-demo-data` to `test` and `production` together, on deliberate, explicit trigger — never
on merge to `main`.

**Start by reading [README.md](README.md)**, then
[`../mootmaker/designs/ci-cd-pipeline.md`](https://github.com/geoffweatherall/mootmaker/blob/main/designs/ci-cd-pipeline.md)
for the actual design.

## Working here

- **`release.yml` is complete and in regular use.** Every stage exists and runs: version
  computation, the three component builds, tagging, promotion to `test` and then `production` with a
  smoke test either side, automatic rollback, and the release record. The README's stage table is
  the current picture.
- **Running `release.yml` deploys to `test` and then `production`.** It pushes real `vX.Y.Z` tags to
  all four repositories, deploys both standing environments, and creates a GitHub Release. A failed
  attempt still consumes its version number — tags are never reused, and a **retry always uses
  `patch`**, never a repeat of the original bump, which would double-count it. Do not dispatch it
  casually to "see what happens", and read "Before starting a release" in the README first.
- **Scan the open issues before dispatching a release.** Across `mootmaker`, the three components
  and this repo — not just the repo whose change prompted the release. Nothing in `release.yml`
  gates on whether now is a good moment, so this is the check that catches a manual prerequisite
  the pipeline has no step for, or a known-broken path the run is about to exercise for the first
  time. The README's "Before starting a release" gives the command and the three shapes to look for.
- **The PAT is the one long-lived credential in this design.** `RELEASE_TAG_PAT` is `contents: write`
  on exactly four repos and is used in exactly one place, the `tag` job. Its value must never be
  echoed, logged, or pass through a session.
- **This repo doesn't own any component's build/deploy logic.** `mootmaker-api`,
  `mootmaker-webapp`, and `mootmaker-demo-data` each own their own build-and-deploy as a reusable
  workflow (`on: workflow_call`) in their own repo; whatever lands here calls those, rather than
  reimplementing them.
- **A release touches `test` and `production` — both real, standing environments.** Treat anything
  here with the same care as those repos' own `deploy.sh production`.

---

## Project-wide rules

This repository is part of the **mootmaker** project. The workflow rules that apply everywhere live
in the hub repository, which you should find checked out as a sibling directory:

    ../mootmaker/docs/process/README.md

On GitHub: <https://github.com/geoffweatherall/mootmaker/blob/main/docs/process/README.md>

**Read it before doing any non-trivial work here.** The short version:

- Work of any real size starts with a **design document** (`../mootmaker/designs/`), not with code.
- Bugs and small changes start with a **GitHub issue in this repository**, so `Closes #N` works.
- All work happens on a **branch** and lands via a **pull request**. There is no approval step —
  reading the diff is the review, merging is the approval.
- **A green acceptance run against a real deployed environment** is the definition of working — not
  a passing unit suite, and not a successful deploy.
- **Environments are `production`, `test`, or ephemeral.** `test` and `production` change only
  through `release.yml` in mootmaker-release — never `./deploy.sh` by hand. Everything else is
  ephemeral: tear down any you create, as part of finishing rather than as a tidy-up afterwards.
- **If your change makes a document wrong, fixing it is part of the change.**
- **Verify against reality, not your own output.** A script exiting zero is not evidence that the
  thing it was meant to do happened.
- **Say what actually happened.** Failing tests get reported with their output; skipped steps get
  named.

Also useful: [`../mootmaker/docs/roles/`](https://github.com/geoffweatherall/mootmaker/blob/main/docs/roles/)
for which kind of work you are doing, and
[`../mootmaker/tools/workstation/check.sh`](https://github.com/geoffweatherall/mootmaker/blob/main/tools/workstation/check.sh)
if something is not installed.

`CLAUDE.md` in this repository is a symlink to this file.
