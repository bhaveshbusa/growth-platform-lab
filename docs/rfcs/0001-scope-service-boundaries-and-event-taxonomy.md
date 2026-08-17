# RFC 0001: Project Scope, Service Boundaries, and Event Taxonomy

## Status

Accepted

## Context

This project exists to learn three related disciplines by building them: **observability** (traces, metrics, logs), **customer data platform** mechanics (event collection, identity resolution, segmentation, activation), and **product analytics** (funnels, activation, retention, experiments). Reading about them teaches vocabulary; operating a system that is deliberately broken teaches judgement.

The subject product is Lingostreak, a fictional language-learning subscription app. It is chosen because it produces the two conditions the disciplines need: an **anonymous-to-known journey** (people browse before they sign up, which is the only reason identity resolution is hard) and a **repeat-usage funnel** (which is the only reason retention and activation metrics mean anything).

This repository is **not a production analytics platform** and must not be used to collect real user data.

Building the whole stack at once would hide the reasoning behind each part. As in a phased delivery, each phase must be independently reviewable, must leave the system runnable, and must introduce infrastructure only when a phase needs it.

## Decision

### Boundaries

Four runtime concerns, kept separate because they fail differently and are owned differently:

- **event-gateway** — the only public write path. Validates against the tracking plan, deduplicates, enforces consent, and dead-letters what it cannot accept. It is the boundary where untrusted input becomes trusted data.
- **identity-service** — owns profiles: anonymous-to-known stitching, trait merge rules, computed traits, and segment membership. This is the CDP core.
- **warehouse-sink** — owns analytical storage and the models built on it (sessions, funnel steps, retention cohorts).
- **activation-worker** — owns outbound delivery to destinations, including suppression and deletion handling.

The demo web app is a separate client, not part of the platform; it exists so the events are real rather than synthetic curl calls.

The gateway does not resolve identity, the identity service does not answer analytical queries, and the warehouse does not call destinations. Each of the three later concerns consumes the event stream rather than being called by the gateway, so a slow or failing consumer cannot reject a learner's event.

### Data flow

Events are collected once and fanned out asynchronously. Collection must survive every downstream component being down: an accepted event is durable before any processing happens. This is what makes "did we lose data?" answerable, and it is the property most vendor-agnostic CDP designs share.

### Taxonomy first

The tracking plan (`docs/tracking-plan.yaml`, explained in `docs/tracking-plan.md`) is authored in phase 1, before any collection code exists, and is machine-readable so later phases derive validators from it rather than restating it. Event naming is `object_action` with a past-tense action; properties are typed, unit-suffixed, and carry a PII class; every event carries an owner and a consent purpose.

Taxonomy is placed first because it is the only decision here that cannot be corrected later: instrumentation ships inside clients, so renames fracture history and untyped properties poison warehouse columns.

### Observability is a phase-one stance, not a phase-twelve feature

Two rules hold from the start, and later phases implement them rather than retrofit them:

1. **Telemetry is a passenger, never the driver.** Losing the collector, the metrics backend, or the log store must never reject an event or fail a request.
2. **The pipeline observes itself.** Data platforms fail quietly — late, partial, or duplicated data looks exactly like low traffic. Freshness, lag, dead-letter volume, and identity-merge behaviour are therefore first-class signals, not afterthoughts.

### Phase 1 deliverable

A pnpm-managed TypeScript monorepo with one runnable Nest application (`event-gateway`) exposing honest liveness and readiness endpoints, the tracking plan with automated convention checks, and the guided-learning MCP server so the repository can teach the phases as they land. No persistence, no streaming, no collection endpoint yet.

## Alternatives considered

- **Use an off-the-shelf CDP and analytics tool (Segment, PostHog, RudderStack) and instrument against it.** Fastest route to dashboards, and the correct choice for a real product; it teaches a vendor's UI rather than identity resolution, consent enforcement, or why your funnel numbers disagree. Rejected as the primary path, kept as an optional comparison destination in phase 11.
- **One service for collection, identity, analytics, and activation.** Simpler to run; hides that these components have different failure modes, scaling profiles, and owners, and makes "collection stayed up while enrichment was broken" impossible to demonstrate.
- **Synchronous fan-out from the gateway.** Removes the stream and its lag; also makes every downstream failure a client-facing error, which is the mistake this system is meant to teach against.
- **Defer the tracking plan until the pipeline works.** Conventional and common; produces exactly the unfixable taxonomy debt the project is trying to study.
- **Introduce the full observability stack in phase 1.** Reaches the target shape sooner; makes the individual instrumentation decisions unreviewable and unmemorable.

## Consequences

- Untrusted input is normalised in exactly one place, so validation, consent, and deduplication rules cannot drift between services.
- Downstream consumers are eventually consistent with collection. Freshness and lag become explicit, measured concerns rather than assumptions.
- The tracking plan becomes a reviewed artefact with tests; adding an event is a pull request, not a client-side improvisation.
- Personal data is confined to identity traits, which keeps deletion and suppression tractable in phase 11.
- Until later phases land, the repository demonstrates intent more than behaviour: phase 1 collects nothing.
- Four services plus a stream plus an observability stack is more moving parts than the product warrants. That cost is accepted deliberately, because the moving parts are the subject matter.
