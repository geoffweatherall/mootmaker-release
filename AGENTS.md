# mootmaker-release

Hosts the release pipeline that ships `mootmaker-api`, `mootmaker-webapp`, and
`mootmaker-demo-data` to `test` and `production` together, on deliberate, explicit trigger — never
on merge to `main`.

**Start by reading [README.md](README.md)**, then
[`../mootmaker/designs/ci-cd-pipeline.md`](https://github.com/geoffweatherall/mootmaker/blob/main/designs/ci-cd-pipeline.md)
for the actual design — this repo is currently just its scaffolded home, not yet an implementation.

## Working here

- **Nothing here runs yet.** The design is still `Drafting`, with blocking open questions
  unresolved (see the design doc's "Open questions"). Don't build `release.yml` ahead of those
  being settled — check the design doc's own Status before starting.
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
- **Environments are `production` or ephemeral.** Tear down any ephemeral environment you create;
  that is part of finishing, not a tidy-up afterwards.
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
