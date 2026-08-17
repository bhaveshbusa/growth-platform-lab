# The tracking plan

`docs/tracking-plan.yaml` is the machine-readable plan: every event this product may emit, its properties, types, owner, purpose, and PII class. This document explains the conventions it enforces and why they exist.

Bad event taxonomy is the one mistake in analytics you cannot fix later. Instrumentation lives in shipped clients, so a renamed event splits your history; an untyped property poisons a column; a missing purpose makes consent unenforceable. So the plan comes before the pipeline — phase 1, not phase 9.

## Naming

- Event names are `object_action`, snake_case, and the action is **past tense**: `lesson_completed`, not `completeLesson` or `Complete Lesson`. Events are facts about things that already happened.
- One event per fact. `lesson_completed` with `score` beats `lesson_completed_with_high_score`; values belong in properties, not in names.
- Property names are snake_case, unabbreviated, and unit-suffixed when they carry a unit: `duration_seconds`, `price_minor_units`, `weekly_goal_minutes`. `duration` alone starts an argument every time it is read.
- The same concept keeps the same property name in every event. `lesson_id` is `lesson_id` everywhere.
- No `page_viewed` variants per screen. Screens are a property (`path`), not a taxonomy.

## Typing and evolution

Every property declares a `type` (`string`, `integer`, `boolean`, `timestamp`, `enum`) and, for enums, its allowed `values`. Types are contracts with the warehouse: change a type and either the sink rejects rows or the column silently coerces, which is worse.

Events are versioned. Within a version, changes must be **additive and optional** — a new optional property is fine, and old clients that omit it stay valid. Anything else is a new version:

- Renaming a property, changing its type, removing it, or narrowing an enum is **breaking**.
- Breaking changes ship as `<event>` version 2 alongside version 1, because version 1 clients keep sending for as long as people avoid app updates.
- Deprecation is a plan change plus a migration window, never a silent switch.

## Ownership, purpose, PII

Three fields exist per event to make later phases possible rather than to satisfy bureaucracy:

- `owner` — the team that answers "did this event change?". Unowned events rot.
- `purpose` — what the data may be used for (`product_analytics`, `personalisation`, `marketing`). Consent is captured per purpose, so activation in phase 11 filters by it. Without a purpose on the event, "do not use my data for marketing" is unenforceable.
- `pii` — per property: `none`, `pseudonymous`, `personal`, or `sensitive`. `sensitive` is never accepted. Personal data is confined to identity traits, never to event properties, so warehouse tables stay free of names and emails and deletion has a small blast radius.

## Identity

The plan separates **anonymous_id** (minted by the browser SDK, present from the first page view) from **user_id** (exists only after `signup_completed`). Everything before signup is attributable only to the anonymous id; stitching the two is the CDP's job in phase 6, and `signup_completed` is the moment the join becomes possible. Traits — email, display name, plan — attach to the profile via `identify`, not to events.

Client-emitted events are declared by omission; events that must not be trusted from a browser carry `source: server`. Money events (`subscription_started`, `subscription_cancelled`) are server-sourced, because a browser can send anything and revenue that can be forged is revenue you cannot report.

## The funnel this plan supports

```
page_viewed → signup_started → signup_completed → onboarding_completed
           → lesson_started → lesson_completed → paywall_viewed
           → checkout_started → subscription_started
```

with `streak_extended` and repeated `lesson_completed` carrying retention, and `subscription_cancelled` closing the loop. Every analytics question in phase 9 (activation, funnel conversion, D1/D7 retention, cohorts) must be answerable from these events alone — if a question needs an event that is not here, the plan changes first, in review, with a version.

## Changing the plan

1. Edit `docs/tracking-plan.yaml` in a pull request; the diff is the review artefact.
2. `pnpm test` enforces the conventions above (naming, types, required metadata, no `sensitive` data, additive-only versioning rules).
3. From phase 2 on, validators are derived from this file, so the gateway rejects anything the plan does not describe — an unplanned event is a dead-lettered event, not a new column.
