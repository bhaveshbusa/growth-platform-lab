# Architecture

Current state is phase 1: one runnable application and the tracking plan. The target shape below is what the phases build towards; components appear here as they land.

## Target shape

```
Browser (demo app)  ──►  event-gateway  ──►  event stream  ──┬──►  identity-service   ──►  profile store
   SDK: page/track/         validate,          durable,      ├──►  warehouse-sink     ──►  analytical store
   identify, consent,       dedupe,            replayable    └──►  activation-worker  ──►  destinations
   trace context            consent, DLQ                                                   (+ suppression)

                    all components  ──►  OpenTelemetry Collector  ──►  traces / metrics / logs backends ──► dashboards
```

| Component           | Owns                                                                    | Introduced   |
| ------------------- | ----------------------------------------------------------------------- | ------------ |
| `event-gateway`     | The public write path: validation, idempotency, consent, dead-lettering | Phase 1      |
| Browser SDK         | Anonymous id, event queueing, trace context propagation                 | Phase 4      |
| Event stream        | Durable, replayable hand-off between collection and processing          | Phase 5      |
| `identity-service`  | Profiles, anonymous-to-known stitching, traits, segments                | Phase 6      |
| `warehouse-sink`    | Analytical storage and models (sessions, funnels, retention)            | Phase 8      |
| `activation-worker` | Destination delivery, retries, suppression, deletion                    | Phase 11     |
| Observability stack | Traces, metrics, logs, dashboards, SLOs, alerting                       | Phases 12-15 |

## Current state (phase 1)

`event-gateway` is a Nest application with liveness and readiness endpoints and no dependencies. Readiness returns ready because there is nothing yet to be unready about; from phase 2 onward it must report the truth about the components it depends on, and it must fail when they are unavailable.

## Standing constraints

- **Collection outlives processing.** An accepted event is durable before enrichment, identity resolution, or analytics touch it. Downstream outages must not become client errors.
- **Telemetry is a passenger.** Losing the observability stack degrades insight, never availability.
- **The pipeline observes itself.** Data freshness, stream lag, dead-letter volume, and identity-merge rates are product signals, because silent lateness is the characteristic failure of analytics systems.
- **The plan bounds the data.** Anything absent from `docs/tracking-plan.yaml` is not collectable; anything personal lives on the profile, not on events.
