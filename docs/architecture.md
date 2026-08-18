# Architecture

Current state is phase 2: one runnable application, the tracking plan, and the contracts compiled from it. The target shape below is what the phases build towards; components appear here as they land.

## Target shape

```
Browser (demo app)  ──►  event-gateway  ──►  event stream  ──┬──►  identity-service   ──►  profile store
   SDK: page/track/         validate,          durable,      ├──►  warehouse-sink     ──►  analytical store
   identify, consent,       dedupe,            replayable    └──►  activation-worker  ──►  destinations
   trace context            consent, DLQ                                                   (+ suppression)

                    all components  ──►  OpenTelemetry Collector  ──►  traces / metrics / logs backends ──► dashboards
```

| Component              | Owns                                                                             | Introduced   |
| ---------------------- | -------------------------------------------------------------------------------- | ------------ |
| `event-gateway`        | The public write path: validation, idempotency, consent, dead-lettering          | Phase 1      |
| `libs/event-contracts` | Contracts compiled from the plan: validation, rejection reasons, generated types | Phase 2      |
| Browser SDK            | Anonymous id, event queueing, trace context propagation                          | Phase 4      |
| Event stream           | Durable, replayable hand-off between collection and processing                   | Phase 5      |
| `identity-service`     | Profiles, anonymous-to-known stitching, traits, segments                         | Phase 6      |
| `warehouse-sink`       | Analytical storage and models (sessions, funnels, retention)                     | Phase 8      |
| `activation-worker`    | Destination delivery, retries, suppression, deletion                             | Phase 11     |
| Observability stack    | Traces, metrics, logs, dashboards, SLOs, alerting                                | Phases 12-15 |

## Current state (phase 2)

`event-gateway` compiles the tracking plan into event contracts at startup and publishes them at `GET /v1/contracts`. There is still no write path — `POST /v1/events` arrives in phase 3 — so the only way to exercise validation is `pnpm contracts:validate <file.json>`.

Readiness is now honest about something real: if the plan will not compile, the process stays live and reports `not_ready` with 503, because a collector with no contract accepts everything. That is the shape every later readiness check follows as the stream and the profile store arrive.

```
docs/tracking-plan.yaml  ──►  libs/event-contracts  ──┬──►  validation (envelope + properties, typed rejection reasons)
     (source of truth)         compiled at startup    ├──►  generated types (checked in; drift fails a test)
                                                      └──►  event-gateway: GET /v1/contracts, readiness
```

## Standing constraints

- **Collection outlives processing.** An accepted event is durable before enrichment, identity resolution, or analytics touch it. Downstream outages must not become client errors.
- **Telemetry is a passenger.** Losing the observability stack degrades insight, never availability.
- **The pipeline observes itself.** Data freshness, stream lag, dead-letter volume, and identity-merge rates are product signals, because silent lateness is the characteristic failure of analytics systems.
- **The plan is compiled, never copied.** Validators, types, and the published catalogue are views of `docs/tracking-plan.yaml`. A second hand-written description of an event is a bug, even when it agrees.
- **The plan bounds the data.** Anything absent from `docs/tracking-plan.yaml` is not collectable; anything personal lives on the profile, not on events.
