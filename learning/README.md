# Agentic Learning Experience

Learn this platform by being guided through it. The repository ships a local MCP server that turns your AI agent (Claude Code, Cursor, or any MCP-capable client) into an instructor: it fetches lesson steps, works through them with you against the _running system_, verifies your work with real commands, and tracks your progress locally.

Docs tell. Agents teach. The difference is verification: a step is only complete when objective checks pass on your machine — the tracking plan actually holds, the event actually reached the warehouse, the trace actually spans the async gap.

## Quick start

1. Clone the repo and install the [prerequisites](../README.md#prerequisites).
2. Open your agent in the repo. Claude Code discovers the learning server automatically via `.mcp.json`; for other clients, register a stdio MCP server with command `node tools/learning-mcp/server.js`.
3. Say: **"Start the growth platform workout."**

The server has zero dependencies, and there is no account, signup, or telemetry. Everything is local; progress lives in `.learning/progress.json` (gitignored).

## The curriculum

Workouts land with the phases they teach. Planned shape:

| #   | Workout        | Phases | What you learn (and break)                                                                                                                                                                         | Status                    |
| --- | -------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Say It Right   | 1-2    | Taxonomy, tracking plan as code, contracts and versioning — propose a "harmless" event change and watch the tests explain why it is not, then invent an event and watch validation follow the plan | phase 1-2 steps available |
| 2   | The Front Door | 3-5    | Ingestion, idempotency, consent, dead-letters, durable streams — replay a batch, kill the stream mid-flow                                                                                          | planned                   |
| 3   | Who Is This?   | 6-7    | Identity resolution, trait merges, segments — stitch two identities wrongly, then fix the rules                                                                                                    | planned                   |
| 4   | Ask the Data   | 8-10   | Warehouse models, activation, funnels, retention, experiments — mis-stitch sessions and watch the funnel lie                                                                                       | planned                   |
| 5   | Seeing Inside  | 12-14  | Logs, metrics, traces end to end including the browser — drop the collector, blow up cardinality                                                                                                   | planned                   |
| 6   | 3am            | 15-16  | SLOs, burn rates, incident drills — five failure injections, diagnosed from telemetry alone                                                                                                        | planned                   |

From workout 2 on, workouts use `phase-NN` git tags to travel back in time, so you can stand in the world before a component existed and see what was missing. A tag is pushed as each phase lands, so `git tag -l` shows how far the lab has got; workout 1 needs no tag, because phase 1 _is_ the beginning.

## How a session feels

You talk to your agent; the agent drives the lesson. It asks about your background and paces accordingly, has you predict outcomes before running commands, and will not record a step as done until verification passes. At the start of each workout it asks whether **you** type the project commands and report back (recommended — typing builds retention) or the agent executes on your behalf; your choice is remembered.

You can stop at any time. Days later, in a fresh session, say "continue the workout" — progress and reflections persist locally, so the agent resumes where you left off.

A read-only progress dashboard is available at any time:

```bash
pnpm learning:ui   # http://localhost:5858
```

## Starting fresh

`git switch main`, delete `.learning/progress.json`, and (from phase 5 onward) `docker compose down -v` to drop containers and data volumes. The orientation step detects prior state and offers this.

## For authors

Workout content is data — `workouts/<name>/workout.json` plus Markdown instructor prompts — so lessons are reviewed like any other doc. See [tools/learning-mcp/README.md](../tools/learning-mcp/README.md) for the tool surface, phase tags, and the authoring guide.
