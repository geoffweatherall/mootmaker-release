# How many consecutive green releases are enough?

When an intermittent test failure has been diagnosed and fixed, how many clean release runs should
follow before believing it?

Written down because the intuitive answer — "run it until you feel good about it" — turns out to be
both expensive and much weaker evidence than it feels like, and because this pipeline makes the
costs measurable enough to reason about properly.

## Two different questions

"Is it fixed?" hides two questions with different answers.

**Has the failure rate changed?** If a fault fired on roughly 1 run in 3, the chance of seeing *n*
clean runs anyway is `(2/3)ⁿ`.

**How low is the rate now?** Different sum. With zero failures in *n* trials, the
[rule of three](https://en.wikipedia.org/wiki/Rule_of_three_%28statistics%29) puts the 95% upper
confidence bound at roughly `3/n`.

| Consecutive greens | P(this happens if the rate were still 1-in-3) | 95% upper bound on the true rate |
|---|---|---|
| 3 | 30% | — |
| 5 | 13% | 60% |
| 7 | 5.9% | 43% |
| 10 | 1.7% | 30% |
| 30 | 0.005% | 10% |
| 60 | ~0% | 5% |

The left column reaches the conventional threshold at 7 runs. The right column is the sobering one:
**7 clean runs only establishes that the failure rate is probably below 43%.** Bounding it under 5%
would take about 60 runs.

It gets worse for rarer faults. A 1-in-10 fault survives 5 clean runs 59% of the time, so five
greens barely distinguishes "fixed" from "1-in-10" at all.

**Sampling can show a rate improved. It cannot show a rate is small.** Not at any number of runs
anyone would sit through.

## What 60 runs would actually cost

This pipeline makes that concrete rather than hypothetical:

| | Per release | × 60 |
|---|---|---|
| Wall clock | ~57 min | **57 hours** |
| AWS | ~$0.10 | ~$6 |
| Claude tokens (green) | a few thousand | ~200k |

The money is irrelevant — this whole system costs about $0.60/month at rest plus roughly $0.10 per
acceptance run (see
[running costs](https://github.com/geoffweatherall/mootmaker/blob/main/docs/reference/running-costs.md)).
**Wall-clock time is the binding constraint**, and 57 hours to buy a 5% bound is a bad trade.

### Token cost is asymmetric, and that matters

A **green** run costs almost nothing to supervise: a completion notification, one or two calls to
confirm the job breakdown, a line of report. Two or three tool calls.

A **failure** costs one to two orders of magnitude more. The layout-shift bug found on 2026-09-05
took roughly thirty tool calls: downloading the diagnostics artifact, reading the aria snapshot and
the failure screenshot, unzipping the trace, parsing its action timings, resolving its delta-encoded
DOM snapshots to diff the page across the failing click, cross-referencing the network log, reading
the source, writing the fix and a regression test, proving the test failed without the fix, then the
PR.

That asymmetry is the right way round, and it is *why* the green-run count matters less than it
seems. Green runs are cheap to accumulate and tell you little. Failures are expensive and tell you
almost everything. **Optimise for extracting maximum information from failures, not for accumulating
greens.**

## The evidence that actually settles it

The strongest evidence for a fix is not statistical at all.

Every one of the seven root causes found during this build-out ended with a **deterministic
regression test that fails before the fix and passes after it**. That is categorically better
evidence than any number of clean runs: it demonstrates the mechanism, on demand, in seconds.

So release runs are not confirming the known fixes — the unit and integration suites do that, every
PR, for free. Releases sample for **causes nobody has found yet**. That reframing is what makes a
finite number defensible: you are not trying to prove absence, you are deciding how long to keep
looking.

## The recommendation: five, then stop counting

Five consecutive green releases, then stop treating the count as the thing that matters.

The justification is not statistical significance — five greens only bounds the rate below 60%, and
saying otherwise would be dressing up a judgement call as arithmetic. It is:

1. **Marginal information per run collapses** while wall-clock cost stays flat. Run 6 tells you far
   less than run 2 did.
2. **The known causes are already proven fixed** by deterministic tests, which is stronger evidence
   than sampling could ever provide.
3. **Normal operation keeps sampling for free.** Every future release is another trial. Stopping the
   dedicated hunt does not stop the evidence accumulating; it stops *waiting around* for it.
4. **The cost of finding out later has collapsed.** Diagnostics upload on failure, the trace-analysis
   method is written down, and the last three root causes each took hours rather than days. Accepting
   residual uncertainty is cheap when being wrong is cheap.

Point 4 is the real argument, and it generalises: you don't need certainty up front when the cost of
being wrong later has fallen. Same shape as
[cost models ageing](https://github.com/geoffweatherall/mootmaker/blob/main/docs/showcase/learnings.md#cost-models-age-the-rules-they-justified-dont).

## What to do when the count breaks

A failure during the run-up is **good news, not a setback**. It is worth more than the greens it
interrupted: it is a reproduction, with a full diagnostics artifact attached, of something still
unfixed.

So: reset the count, but treat the failure as the win. The counting exists only to decide when to
stop looking, and a failure means the answer is "not yet" — which is exactly what you wanted the
process to tell you.

Do not weaken the test to make the count go up. That trades away the only mechanism that produced
any of this information. See the design's
["What the gate exposed"](https://github.com/geoffweatherall/mootmaker/blob/main/designs/ci-cd-pipeline.md)
for what that instinct would have cost — seven real defects, every one first seen as a flake.
