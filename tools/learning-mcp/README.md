# growth-lab-guide — guided learning MCP server

An MCP server that turns this repository into a guided, verified learning experience. Connect it to any MCP-capable agent (Claude Code, Cursor, etc.) and the agent becomes an instructor: it fetches step prompts, works through them with you against the real system, and only records progress after objective verification passes.

## Setup (learner)

None. The server has **zero dependencies** — Node.js 20+ is all you need.

Claude Code discovers the server automatically via the repo-root `.mcp.json`. For other MCP clients, register a stdio server with command `node tools/learning-mcp/server.js` (any working directory — paths are resolved relative to this file).

Then, in your agent: **"Start the growth platform workout."**

## How it works

- Workout content is **data**, in `learning/workouts/<workout>/workout.json` plus Markdown step prompts. No content lives in code, so it can later be served remotely unchanged.
- Progress is **local**, in `.learning/progress.json` (gitignored). No account, no telemetry.
- Each step can define `verify` checks — real shell commands run in the repo root (e.g. is Postgres healthy, do migrations show applied, does the readiness endpoint answer). `step_complete` refuses until they pass, which keeps the experience honest.

## Tools

| Tool | Purpose |
| ---- | ------- |
| `workout_list` / `progress_get` | Orient and resume: workouts, steps, saved progress |
| `workout_get` | One workout's structure and validation questions |
| `step_get_prompt` | Fetch instructor prompt for a step (marks it started) |
| `step_verify` | Run the step's objective checks against the learner's system |
| `step_complete` | Record completion (requires passed verification; `force` needs learner consent) |
| `reflection_submit` | Save an end-of-workout reflection to the local journal |
| `preference_set` | Persist learner preferences, notably `command_mode`: `learner` (they type project commands and report back) or `agent` (the agent executes) |

## Progress UI

```bash
node tools/learning-mcp/ui.js   # http://localhost:5858
```

A read-only page showing workouts, step status, and reflections from the same progress file.

## Phase tags (maintainer)

Learners clone the finished system; from workout 2 on, workouts move them back in time using `phase-NN` tags. Each phase commit declares itself with a `Phase: NN` trailer, and the tags exist only for phases that have landed on `main`. After history changes, refresh and push tags:

```bash
bash tools/learning-mcp/tag-phases.sh
git push origin --tags
```

## Fresh start / reset

A returning learner (or the maintainer) can reset with: `git switch main`, deleting `.learning/progress.json`, and (from phase 2 onward) `docker compose down -v`, and optionally deleting `.env` and `.learning/progress.json`. The orientation step offers this automatically when it detects prior state.

## Authoring new workouts

Copy `learning/workouts/01-say-it-right/` as a template. A workout is a `workout.json` with ordered steps; each step has a `prompt` (Markdown written *for the agent as instructor*, not for pasting at the learner), a `validates` question, optional `verify` checks (`command`, optional `expect_match` regex, optional `timeout_seconds`), and a `next` step id.
