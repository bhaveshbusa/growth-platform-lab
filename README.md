# Growth Platform Lab

A small, deliberately breakable system for learning **observability** (traces, metrics, logs), **customer data platform (CDP)** mechanics (event collection, identity resolution, segmentation, activation), and **product analytics** (funnels, activation, retention, experiments) — by building them one reviewable phase at a time.

The subject product is **Lingostreak**, a fictional language-learning subscription app: people browse anonymously, sign up, take lessons, hit a paywall, and subscribe. That journey is what makes identity resolution genuinely hard and retention metrics genuinely meaningful.

This repository is **not a production analytics platform** and must not be used to collect real user data.

## Current scope (phase 2)

- `event-gateway` — the future public write path; today it publishes the contract catalogue and reports itself unready when the tracking plan will not compile
- `libs/event-contracts` — contracts **compiled from** the tracking plan: envelope and property validation, a closed set of rejection reasons, and generated TypeScript types
- `docs/tracking-plan.yaml` — the machine-readable tracking plan: every event, property, type, owner, consent purpose, and PII class, with conventions enforced by `pnpm test`
- `docs/tracking-plan.md` — the conventions and the reasoning behind them
- [RFC 0001](docs/rfcs/0001-scope-service-boundaries-and-event-taxonomy.md) — scope, service boundaries, event taxonomy, and the two standing observability rules
- [RFC 0002](docs/rfcs/0002-event-contracts-and-validation.md) — contracts derived from the plan, the rejection taxonomy, and why generated types are checked in
- [Architecture](docs/architecture.md) — target shape and what exists today

Nothing is collected yet: there is no `POST /v1/events` until phase 3. Phase 2 can tell you an event is wrong; it cannot yet tell you it happened.

## Learning path

Sixteen phases, each documented in an RFC and implemented in a single `feat:` commit tagged `phase-NN`, so the git history doubles as a curriculum. Infrastructure is introduced only when a phase needs it.

| Phase | Topic                                                                 | RFC                                                                   |
| ----- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1     | Scope, service boundaries, and event taxonomy                         | [0001](docs/rfcs/0001-scope-service-boundaries-and-event-taxonomy.md) |
| 2     | Event contracts and validation derived from the plan                  | [0002](docs/rfcs/0002-event-contracts-and-validation.md)              |
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
- Docker with Docker Compose (needed from phase 5 onward)

## Install and run

```bash
pnpm install
cp .env.example .env
pnpm start:event-gateway:dev
```

```bash
curl -s http://localhost:3000/health/live                    # {"status":"ok"}
curl -s http://localhost:3000/health/ready                   # ready, plus the checks behind the verdict
curl -s http://localhost:3000/v1/contracts                   # every event a client may send
curl -s http://localhost:3000/v1/contracts/lesson_completed/1
```

`.env` is ignored by Git; `.env.example` is the documented default.

## Trying the contracts

The write path arrives in phase 3, so validation is exercised from the terminal:

```bash
pnpm contracts:validate examples/events/lesson-completed.json   # accepted, exit 0
pnpm contracts:validate examples/events/rejected.json           # one reason per event, exit 1
```

Each rejection names a reason from a closed taxonomy (`unknown_event`, `property_type_invalid`,
`server_only_event_from_client`, …) and the field, never the offending value. See
[examples/events/README.md](examples/events/README.md) and [RFC 0002](docs/rfcs/0002-event-contracts-and-validation.md).

## Checks

```bash
pnpm lint
pnpm test        # unit tests and tracking-plan convention checks
pnpm test:e2e    # health endpoints over HTTP
pnpm build
```

## Changing the tracking plan

Edit `docs/tracking-plan.yaml` in a pull request, run `pnpm contracts:generate` to refresh the generated types, and run `pnpm test`. Validation is compiled from the plan, so nothing else has to be edited: a new event becomes acceptable, and a removed one stops being acceptable. The conventions in [docs/tracking-plan.md](docs/tracking-plan.md) — `object_action` past-tense names, typed and unit-suffixed properties, an owner and consent purpose per event, no personal data on events — are enforced by tests rather than by review alone. The additive-only rule for changes _within_ a version is currently enforced by review: the tests judge the plan as it stands, not the diff against the previous version.

## License

MIT — see [LICENSE](LICENSE).
