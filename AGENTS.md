# mootmaker-release

The release pipeline: `release.yml` versions, builds, tests and tags every component together and
promotes it through `test` to `production`.

**Read [README.md](README.md) first**, including "Before starting a release". Keep it true in the same pull
request as any change to the pipeline.

## Working here

- **Running `release.yml` deploys to `test` and `production`.** It pushes real `vX.Y.Z` tags to five
  repositories and creates a GitHub Release. Never dispatch it to "see what happens"; dispatch it only
  when a release is wanted, after the checks in the README.
- **A failed attempt uses up its version, and a retry always uses `patch`.** Tags are never reused or
  removed.
- **`RELEASE_TAG_PAT` is the one long-lived credential.** It is used only by the `tag` job. Its value must
  never be echoed, logged, or pass through a session.
- **This repository owns no component's build or deploy.** Each component's `release-build.yml` (a
  reusable workflow) does that; change it there, and call it from here.
- **Reusable workflows run as this repository.** The AWS role trusts `mootmaker-release` at `main`, and a
  called workflow presents the caller's identity, so the components' release builds run under that trust.
  `main` is protected accordingly: a pull request is required, for admins too (mootmaker-release#91).
- **Respect the load-bearing orderings** listed in the README and commented in the workflow: tag only after
  every build, `record-outcome` always runs, only the web smoke decides rollback.
- **The production smoke suite is read-only.** Proving a write in production is a design change, not a
  test change.
- **Test the fail-fast action with `.github/actions/fail-fast/test.sh`** after changing it.

---

## Project-wide rules

This repository is part of **Mootmaker**. The hub repository, checked out as a sibling at
`../mootmaker`, holds what applies everywhere:

- How work is done: [`../mootmaker/docs/process/README.md`](https://github.com/geoffweatherall/mootmaker/blob/main/docs/process/README.md).
  Read it before any non-trivial work.
- How the system fits together: [`../mootmaker/docs/overview/`](https://github.com/geoffweatherall/mootmaker/tree/main/docs/overview).
- What to do when something is wrong: [`../mootmaker/docs/runbooks/`](https://github.com/geoffweatherall/mootmaker/blob/main/docs/runbooks/README.md).

The short version:

- Work of any real size starts with a **design** (`../mootmaker/designs/`); a bug or small change starts
  with a **GitHub issue in this repository**, so `Closes #N` works.
- Everything lands on a **branch** through a **pull request**. Reading the diff is the review; merging is
  the approval.
- **A green acceptance run against a real deployed environment** is the definition of working.
- **`test` and `production` change only through a release** (`release.yml` in mootmaker-release). Use an
  ephemeral environment for your own work, and tear it down when you finish.
- **Say what something costs in AWS before creating it.** Under NZ$1 one-off, go ahead and state it;
  more, or anything recurring, ask first.
- **Keep documentation and comments true and current.** If a change makes a document wrong, fixing it is
  part of the change. Describe what is, not how it got here; a comment says what and why.
- **Verify against reality, not your own output**, and **say what actually happened**, including
  failures and skipped steps.

Something not installed? [`../mootmaker/tools/workstation/check.sh`](https://github.com/geoffweatherall/mootmaker/blob/main/tools/workstation/check.sh).

`CLAUDE.md` in this repository is a symlink to this file.
