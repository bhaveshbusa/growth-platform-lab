# @growth/event-contracts

Event contracts **compiled from** `docs/tracking-plan.yaml`. No file here names an event: add one to the plan and it becomes acceptable, remove it and it stops being. See [RFC 0002](../../docs/rfcs/0002-event-contracts-and-validation.md).

```ts
import { EventContracts } from '@growth/event-contracts';

const contracts = EventContracts.fromPlan(); // throws if the plan cannot be trusted
const result = contracts.validate(payload);

if (!result.valid) {
  // [{ reason: 'property_type_invalid', field: 'properties.score', detail: '…' }]
  result.rejections;
}
```

| Path             | Holds                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| `src/plan/`      | Strict loader for the tracking plan; refuses a plan it cannot trust    |
| `src/contracts/` | Envelope and property validation, and the closed set of reject reasons |
| `src/codegen/`   | Renders the typed view of the plan                                     |
| `src/generated/` | That typed view, checked in; a test fails if it drifts from the plan   |
| `src/cli/`       | `pnpm contracts:validate <file.json>`                                  |

Validation reports every problem for an event, never the first only, and rejections carry a field path but never the offending value — they get logged, and the most common unplanned property is a personal one.

After changing the plan:

```bash
pnpm contracts:generate   # refresh src/generated/events.ts
pnpm test                 # the drift check keeps plan and types in one pull request
```

The plan is located by walking up from this package until `docs/tracking-plan.yaml` is found; `TRACKING_PLAN_PATH` overrides it, which is how the workouts point a running gateway at a deliberately broken plan.
