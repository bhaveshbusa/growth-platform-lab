---
name: testing-growth-platform-lab
description: How to run, verify, and adversarially test the Growth Platform Lab monorepo — the event-gateway service, the tracking-plan convention tests, the learning MCP harness, and the phase-tagging script. Use when testing any phase of this repo.
---

# Testing Growth Platform Lab

## Environment

- Node 20+, pnpm 10+. pnpm is installed to `~/.npm-global/bin`, which is **not** on the default
  non-login `PATH`. Always export it first:
  `export PATH="$HOME/.npm-global/bin:$PATH"`.
- This matters beyond convenience: the learning harness runs its verification commands through
  `bash -lc`, and one check is `pnpm --version`. If `~/.npm-global/bin` is missing from the PATH
  that the harness process inherits, that check fails for environment reasons, not repo reasons.
  `~/.bashrc` exports it, but `.bashrc` is skipped for non-interactive shells — so export it in the
  parent process before launching `tools/learning-mcp/server.js`.
- No secrets, no Docker, no external services are needed for phase 1.

## Gate commands

```bash
pnpm install && pnpm lint && pnpm format:check && pnpm test && pnpm test:e2e && pnpm build
```

`pnpm test` runs both `apps/**/*.spec.ts` and `docs/**/*.spec.ts` (the tracking-plan checks).

## Running the gateway

```bash
pnpm build
EVENT_GATEWAY_PORT=3000 node dist/apps/event-gateway/main.js
curl -s localhost:3000/health/live    # {"status":"ok"}
curl -s localhost:3000/health/ready   # {"status":"ready"}
```

**Beware `pkill -f`.** Patterns like `pkill -f "dist/apps/event-gateway/main.js"` match the shell's
own command line and kill your shell session mid-command (leaving orphaned node processes). Put the
`pkill` in its own tool call, use a bracket-escaped pattern (`event-gateway/main[.]js`), and never in
the same command line as a `node dist/apps/event-gateway/main.js` invocation. Afterwards verify with
`pgrep -af event-gateway/main` and `kill -9` any survivor.

**`.env` is not loaded.** There is no dotenv/ConfigModule wiring, so `cp .env.example .env` (which
the README and the orientation prompt instruct) has no effect on the app. Configuration only works
via real environment variables. Test this explicitly by putting a distinctive port in `.env`,
starting with `env -u EVENT_GATEWAY_PORT`, and confirming which port actually binds.

## Adversarially testing the tracking plan

The real question is whether `docs/tracking-plan.spec.ts` rejects bad plans. Mutate
`docs/tracking-plan.yaml`, run `pnpm test`, assert the **named** failing assertion, then
`git checkout docs/tracking-plan.yaml` between mutations. Mutations that must fail:

| Mutation | Failing assertion |
| --- | --- |
| `lesson_completed` → `complete_lesson` | `names every event object_action ... past-tense action` |
| `duration_seconds` → `duration` | `suffixes unit-bearing properties with their unit` |
| set `pii: personal` on an event property | `keeps personal and sensitive data out of event properties` |
| `subscription_*` `source: server` → `client` | `emits money events from the server only` |
| duplicate an event block (same name+version) | `keeps event names unique` |
| delete a property's `type` or `pii` | `describes every property with a type, requiredness, and PII class` |

Always include a **control**: adding an optional non-PII property with a description
(`device_type`/`string`/`required: false`/`pii: none`) must still pass. A suite that rejects
everything is useless.

Known overclaim to re-check on future phases: README and `docs/tracking-plan.md` say `pnpm test`
enforces "additive-only changes within a version", but no baseline/snapshot of the plan exists, so a
breaking rename (e.g. `score` → `score_percent` with no version bump) passes. Verify whether a later
phase adds a snapshot before trusting that claim.

## Testing the learning MCP harness

It speaks newline-delimited JSON-RPC 2.0 over stdio (`initialize`, `ping`, `tools/list`,
`tools/call`). Drive it with a small Node client that spawns
`node tools/learning-mcp/server.js` with `stdio: ["pipe","pipe","inherit"]`, writes one JSON object
per line, and reads responses by `id`. Tool results come back as `result.content[0].text`.

High-value adversarial checks:

- `step_verify say_it_right/orientation` with the gateway **stopped** must return `passed: false`
  with only the readiness check failing; `step_complete` must then error with
  "verification checks that have not passed yet". Start the gateway and both must succeed
  (`nextStep: "boundaries"`).
- `step_verify say_it_right/taxonomy` with a dirty `docs/tracking-plan.yaml` must fail on **both** the
  jest check and the "working tree is clean" check.
- Known cheat vector: the tree-clean check is `git status --porcelain docs/tracking-plan.yaml` only.
  Weakening `docs/tracking-plan.spec.ts` (deleting an assertion) while leaving the YAML clean makes
  verification pass. Re-test this if the checks change.
- Progress writes to `.learning/progress.json`, which is gitignored — `git status` must stay clean.
  Delete `.learning/` to reset to a first-run state.

Progress UI: `pnpm learning:ui` → http://localhost:5858 (also `/api/progress` JSON). It is read-only,
so prove it is live by mutating progress through MCP tools and reloading the page.

## Phase tags

`bash tools/learning-mcp/tag-phases.sh` tags commits on **main** carrying a `Phase: NN` commit
trailer. On a feature branch (phase commit not yet on main) it correctly prints
"No commits with a 'Phase: NN' trailer found on main", exits 1, and creates no tags. To positive-test
it without touching the repo, clone to /tmp, fast-forward main, and run it there.

Latent bug to watch: `printf -v tag "phase-%02d" "$phase"` fails with
`invalid octal number` if the trailer is written zero-padded (`Phase: 08`); with `set -e` the script
aborts. Trailers must be unpadded (`Phase: 8`).

Docs claim workouts use `phase-NN` tags (`git switch --detach phase-NN`), but tags only exist after
the maintainer runs the script post-merge. `git tag -l` being empty is expected pre-merge — flag it as
a learner-facing gap rather than a code bug.

## Teardown

Kill the gateway and UI, `rm -f .env`, `git checkout docs/tracking-plan.yaml`, then confirm
`git status --porcelain` is empty and `git tag -l` is empty.
