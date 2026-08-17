# Growth Platform Lab

A small, deliberately breakable system for learning **observability** (traces, metrics, logs), **customer data platform (CDP)** mechanics (event collection, identity resolution, segmentation, activation), and **product analytics** (funnels, activation, retention, experiments) — by building them one reviewable phase at a time.

The subject product is **Lingostreak**, a fictional language-learning subscription app: people browse anonymously, sign up, take lessons, hit a paywall, and subscribe. That journey is what makes identity resolution genuinely hard and retention metrics genuinely meaningful.

This repository is **not a production analytics platform** and must not be used to collect real user data.

## Current scope (phase 1)

- `event-gateway` — the future public write path; currently a runnable Nest application with liveness and readiness endpoints and no dependencies
- `docs/tracking-plan.yaml` — the machine-readable tracking plan: every event, property, type, owner, consent purpose, and PII class, with conventions enforced by `pnpm test`
- `docs/tracking-plan.md` — the conventions and the reasoning behind them
- [RFC 0001](docs/rfcs/0001-scope-service-boundaries-and-event-taxonomy.md) — scope, service boundaries, event taxonomy, and the two standing observability rules
- [Architecture](docs/architecture.md) — target shape and what exists today

Nothing is collected yet. Phase 1 deliberately ships the taxonomy and the boundaries before the pipeline, because taxonomy is the only decision here that cannot be corrected later.

## Learning path

Sixteen phases, each documented in an RFC and implemented in a single `feat:` commit tagged `phase-NN`, so the git history doubles as a curriculum. Infrastructure is introduced only when a phase needs it.

| Phase | Topic                                                                 | RFC                                                                   |
| ----- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1     | Scope, service boundaries, and event taxonomy                         | [0001](docs/rfcs/0001-scope-service-boundaries-and-event-taxonomy.md) |
| 2     | Event contracts and validation derived from the plan                  | planned                                                               |
| 3     | Event gateway: batch ingestion, idempotency, consent, dead-lettering  | planned                                                               |
| 4     | Browser SDK and demo app instrumentation                              | planned                                                               |
| 5     | Durable event stream and replay                                       | planned                                                               |
| 6     | Identity resolution and the profile store                             | planned                                                               |
| 7     | Segments and computed traits                                          | planned                                                               |
| 8     | Analytical warehouse sink and models                                  | planned                                                               |
| 9     | Product analytics: activation, funnels, retention, cohorts            | planned                                                               |
| 10    | Experimentation: flags, exposure events, reading results honestly     | planned                                                               |
| 11    | Activation, reverse ETL, and privacy (consent, suppression, deletion) | planned                                                               |
| 12    | Structured logs and correlation                                       | planned                                                               |
| 13    | Metrics: RED, USE, business metrics, and cardinality                  | planned                                                               |
| 14    | Distributed tracing from the browser to the sinks                     | planned                                                               |
| 15    | SLOs, burn-rate alerting, and incident drills                         | planned                                                               |
| 16    | Containers and deployment (optional rung)                             | planned                                                               |

Phases 12-15 come last in the repository's history but not in importance: each earlier phase is instrumented as it is built, and these phases make that instrumentation a coherent, alertable whole.

### Learn with your AI agent

The repository ships a zero-dependency MCP server that turns the phases into guided workouts: your agent delivers each lesson interactively, has you break the system on purpose, and only records progress once objective verification passes against your running system. Claude Code picks it up automatically from `.mcp.json`; other clients register a stdio server with `node tools/learning-mcp/server.js`. Then say **"Start the growth platform workout."**

See the [Agentic Learning Experience guide](learning/README.md).

## Prerequisites

- Node.js 20 or newer (Node.js 22 LTS recommended)
- pnpm 10 or newer
- Docker with Docker Compose (needed from phase 2 onward)

## Install and run

```bash
pnpm install
cp .env.example .env
pnpm start:event-gateway:dev
```

```bash
curl -s http://localhost:3000/health/live    # {"status":"ok"}
curl -s http://localhost:3000/health/ready   # {"status":"ready"}
```

`.env` is ignored by Git; `.env.example` is the documented default.

## Checks

```bash
pnpm lint
pnpm test        # unit tests and tracking-plan convention checks
pnpm test:e2e    # health endpoints over HTTP
pnpm build
```

## Changing the tracking plan

Edit `docs/tracking-plan.yaml` in a pull request and run `pnpm test`. The conventions in [docs/tracking-plan.md](docs/tracking-plan.md) — `object_action` past-tense names, typed and unit-suffixed properties, an owner and consent purpose per event, no personal data on events, additive-only changes within a version — are enforced by tests rather than by review alone.

## License

MIT — see [LICENSE](LICENSE).
