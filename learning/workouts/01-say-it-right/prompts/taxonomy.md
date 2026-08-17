## Instructor prompt: the tracking plan, and breaking it

The heart of phase 1. They should leave able to review someone else's tracking plan and find the landmines.

### 1. Read the plan as a reviewer

Open `docs/tracking-plan.yaml`. Do not walk through it line by line — instead ask them to review it as if it were a pull request and find three things they would question. Good things to notice: `subscription_started` is `source: server`; `price_minor_units` rather than `price`; the funnel is expressible from these events alone; `email` exists as a trait but never as an event property.

Then `docs/tracking-plan.md` for the conventions, and ask **why each rule exists** rather than what it says:

- `object_action`, past tense — events are facts about the past; `complete_lesson` reads like a command, and commands can fail.
- Values in properties, not in names — `lesson_completed_with_high_score` cannot be aggregated with `lesson_completed`, and the split is permanent.
- Unit suffixes — `duration` starts an argument in every review; `duration_seconds` ends it.
- Per-property PII class, personal data confined to traits — this is what makes phase 11's deletion request a bounded operation instead of a search of every warehouse table.
- Per-event consent purpose — "do not use my data for marketing" is unenforceable if the event does not say what it is for.

### 2. The versioning question

> Which changes to a shipped event are safe within version 1, and which force a version 2?

Safe: adding an **optional** property. Breaking: renaming, retyping, removing, or narrowing an enum. Then the question that matters:

> A mobile client shipped `lesson_completed` with `score`. You rename it to `score_percent`. What actually happens?

Old clients keep sending `score` for months — people do not update apps. So you get two names for one fact, dashboards that quietly halve, a coalesce in every query forever, and no way to reconstruct history. This is why the plan is versioned and why the taxonomy is authored in phase 1 rather than after the pipeline works: instrumentation lives in code you have already shipped.

### 3. Break it on purpose

Have them make each of these edits to `docs/tracking-plan.yaml`, predict the outcome, then run `pnpm exec jest docs/tracking-plan.spec.ts`:

1. Rename `lesson_completed` to `complete_lesson` → the naming and past-tense checks fail.
2. Add `email` (type `string`, `pii: personal`) to `signup_completed`'s properties → the "no personal data on events" check fails. Ask where it belongs instead, and why the profile is a better home.
3. Rename `duration_seconds` to `duration` → the unit-suffix check fails.
4. Add a property with no `type` or no `pii` → the completeness check fails.
5. The interesting one: add a **new optional property** (`device_type`, `string`, `required: false`, `pii: none`, with a description) → tests pass, because that change is additive and safe. Ask them to explain the asymmetry in their own words.

Then restore the file: `git checkout docs/tracking-plan.yaml`.

Note what the tests do _not_ catch: whether the property is worth collecting, whether the enum values match reality, whether anyone owns the event. Tests enforce conventions; review enforces judgement. Ask which of the five edits above a reviewer would need to catch even if the tests passed.

### 4. Look forward

The plan is machine-readable because phase 2 derives validators from it, so the gateway can reject anything the plan does not describe. Ask them to predict what should happen to an event that is not in the plan: dropped, accepted, or dead-lettered? Dead-lettered with a reason — you keep the evidence, because an unplanned event usually means a client shipped something nobody reviewed, and you want to know which.

### 5. Verify and close

Run the step's verification — note it also checks the working tree is clean, so the break-it edits must be reverted. `step_complete`, reflection, and close the workout: "Phase 2 turns this plan into contracts and validation. Until then, the plan is the whole system — which is roughly the point."
