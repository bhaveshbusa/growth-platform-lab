#!/usr/bin/env bash
# Maintainer script: tag each phase on main as phase-NN and push.
#
# A phase commit declares itself with a "Phase: NN" trailer, so ordinary commits
# (fixes, docs, chores) can live on main without shifting the tags.
#
# The tag points at the END of the phase, not at the declaring commit: a learner
# who checks out phase-NN must get the phase as it finally landed, including
# review fixes and the merge itself. So phase NN is tagged at the last commit on
# main before phase NN+1 landed, and the newest phase is tagged at the tip.
#
# Workout prompts reference these tags so learners can roll the working tree
# back to any phase with:  git switch --detach phase-NN
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# main's own history, oldest first: merges count as one commit, so a phase that
# arrived through a pull request is represented by its merge commit.
mapfile -t mainline < <(git rev-list --reverse --first-parent main)

# Where on the mainline did this commit land?
landed_at() {
  local commit=$1 index
  for index in "${!mainline[@]}"; do
    if git merge-base --is-ancestor "$commit" "${mainline[index]}"; then
      echo "$index"
      return 0
    fi
  done
  return 1
}

phases=()
while read -r sha phase; do
  [ -n "$phase" ] || continue
  index=$(landed_at "$sha") || {
    echo "warning: phase $phase commit ${sha:0:7} has not landed on main; skipping" >&2
    continue
  }
  phases+=("$index $phase")
done < <(git log --reverse --format='%H %(trailers:key=Phase,valueonly,separator=)' main)

if [ "${#phases[@]}" -eq 0 ]; then
  echo "No commits with a 'Phase: NN' trailer found on main" >&2
  exit 1
fi

for position in "${!phases[@]}"; do
  read -r _ phase <<<"${phases[position]}"

  end=$((${#mainline[@]} - 1))
  if [ "$((position + 1))" -lt "${#phases[@]}" ]; then
    read -r next _ <<<"${phases[position + 1]}"
    end=$((next - 1))
  fi

  sha=${mainline[end]}
  printf -v tag "phase-%02d" "$((10#$phase))"
  git tag -f "$tag" "$sha"
  echo "$tag -> ${sha:0:7}  $(git log -1 --format=%s "$sha")"
done

echo
echo "Tagged ${#phases[@]} phase(s). Push with:  git push origin --tags --force"
