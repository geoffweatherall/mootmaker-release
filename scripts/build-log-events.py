"""Turns one stage's output file into a PutLogEvents payload.

Separate from ship-to-cloudwatch.sh so the shell stays readable: the batching rules below are
fiddly enough that inlining them as a heredoc made the surrounding error handling hard to follow.

Decision 11's consistent fields - version, stage, component, environment, outcome - are attached to
every line, which is what makes the saved Logs Insights queries in deploy/terraform/logs.tf able to
filter rather than just archive.
"""

import io
import json
import sys

# PutLogEvents caps a single event at 256KB. Leave headroom for the JSON envelope around each line.
MAX_LINE = 200_000

# The API also caps a batch at 1MB and 10,000 events. Ship the TAIL rather than the head when a
# stage is unusually chatty - the end of a failed terraform apply is where the error is.
MAX_EVENTS = 5_000


def main() -> int:
    path, version, stage, component, environment, outcome, ts = sys.argv[1:8]
    timestamp = int(ts)

    raw = io.open(path, encoding="utf-8", errors="replace").read()

    events = []
    for offset, line in enumerate(raw.splitlines()):
        if not line.strip():
            continue
        if len(line) > MAX_LINE:
            line = line[:MAX_LINE] + " …[truncated]"
        events.append(
            {
                # Monotonic within the batch: PutLogEvents requires events in timestamp order.
                "timestamp": timestamp + offset,
                "message": json.dumps(
                    {
                        "version": version,
                        "stage": stage,
                        "component": component,
                        "environment": environment,
                        "outcome": outcome,
                        "line": line,
                    }
                ),
            }
        )

    if len(events) > MAX_EVENTS:
        events = events[-MAX_EVENTS:]

    json.dump(events, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
