#!/usr/bin/env bash
# Maintainer script: tag each phase commit on main as phase-NN and push.
# Phase commits declare themselves with a "Phase: NN" trailer in the commit
# message, so ordinary commits (fixes, docs, chores) can live on main without
# shifting the tags. Workout prompts reference these tags so learners can roll
# the working tree back to any phase with:  git switch --detach phase-NN
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

tagged=0
while read -r sha phase; do
  [ -n "$phase" ] || continue
  printf -v tag "phase-%02d" "$phase"
  git tag -f "$tag" "$sha"
  echo "$tag -> ${sha:0:7}  $(git log -1 --format=%s "$sha")"
  tagged=$((tagged + 1))
done < <(git log --reverse --format='%H %(trailers:key=Phase,valueonly,separator=)' main)

if [ "$tagged" -eq 0 ]; then
  echo "No commits with a 'Phase: NN' trailer found on main" >&2
  exit 1
fi

echo
echo "Tagged $tagged phase commit(s). Push with:  git push origin --tags --force"
