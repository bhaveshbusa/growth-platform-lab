## Instructor prompt: contracts compiled from the plan

Phase 2's claim is narrow and worth testing: the plan is the source of truth, and validation is a _view_ of it. This step is where they find out whether that claim is real or marketing. Covers RFC 0002.

### 1. Read the contract, then predict

Open `docs/rfcs/0002-event-contracts-and-validation.md` — the decision section only — and `libs/event-contracts/src/contracts/contracts.ts`. Ask, before they read the code closely:

> Search the library for the word `lesson_completed`. How many hits do you expect?

None outside the tests and the generated file. That is the whole design: `EventContracts` walks the plan and builds a contract per `name@version`, so the events are data, not code.

Then the envelope (`EventEnvelope`). Two questions worth sitting with:

- Why does `message_id` exist when nothing deduplicates yet? Because the key has to be chosen by the client, and clients ship. Phase 3 needs it; phase 3 cannot add it retroactively to an app already on someone's phone.
- Why must `consent` carry a boolean for _every_ purpose the plan declares, while a `false` value still validates? Contracts answer "is this well-formed and planned?" — enforcement is the gateway's job in phase 3. "We do not know what they agreed to" is the one state the pipeline refuses to carry.

### 2. Predict rejection reasons before running anything

Open `examples/events/rejected.json` — five events, each wrong in one way — and have them predict the reason for each from the taxonomy in RFC 0002 before running:

```bash
pnpm contracts:validate examples/events/rejected.json; echo "exit=$?"
```

Expect `unknown_event`, `property_type_invalid`, `unknown_property`, `server_only_event_from_client`, `unknown_event_version`, exit 1.

Three things to draw out:

- The reasons name **who fixes it**, not just what is wrong. `unknown_property` is a taxonomy conversation; `property_type_invalid` is a one-line SDK fix; `server_only_event_from_client` may mean someone is lying to you. Ask why a single `invalid_event` reason would make the phase 3 dead-letter queue useless.
- The event with `learner_email` is refused rather than having the property dropped. Ask which is friendlier and which is safer. Dropping keeps the client working while quietly collecting nothing — and the person who added it believes it is being collected.
- Look at what a rejection contains: reason, field path, detail — never the value. Rejections get logged, and the most common unplanned property is a personal one.

### 3. Prove the derivation (the important drill)

Invent an event in `docs/tracking-plan.yaml` — for example `lesson_bookmarked`, version 1, owner `learning`, purpose `product_analytics`, with one required `lesson_id` string, `pii: none`, plus a description. Then write a payload for it and validate:

```bash
pnpm contracts:validate /tmp/bookmarked.json
```

It is accepted, with no code change anywhere. Ask them what would have had to happen if validation were hand-written DTOs: a new file, a new test, and a chance for the two descriptions to disagree.

Now run `pnpm test`. The generated-types drift test **fails**: the plan changed and `libs/event-contracts/src/generated/events.ts` did not. Run `pnpm contracts:generate`, look at the diff (a new interface, a new key, a new fingerprint), and run the tests again.

> Why is generated code checked in, when it could be built on demand?

Because a build step nobody runs produces types that quietly describe last month's plan. Checked-in generated code makes the drift visible in review, at the cost of diff noise. Ask them which cost they would rather pay — this is the trade RFC 0002 makes explicitly.

### 4. Break it on purpose

Each edit to `docs/tracking-plan.yaml`; predict first, then run.

1. Remove the `score` property from `lesson_completed`. Validate `examples/events/lesson-completed.json` → `unknown_property`. A previously valid event is now off-plan: removing from a plan is as breaking as renaming, because shipped clients keep sending it.
2. Change `subscription_started`'s `source: server` to `client` and validate the fourth event in `rejected.json` → **accepted**. The trust boundary lives in the plan, so a one-word plan edit lets a browser mint revenue events. Ask who reviews that line, and how they would notice it changing.
3. Make the plan unparseable (delete the `purposes:` block), then start the gateway and hit all three endpoints:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/health/live    # 200
   curl -s -w ' [%{http_code}]\n' http://localhost:3000/health/ready            # not_ready [503]
   curl -s -w ' [%{http_code}]\n' http://localhost:3000/v1/contracts            # [503]
   ```

   Live but not ready, and it says why. Ask what would be wrong with crashing instead (liveness and readiness would carry the same information, and you lose the ability to ask a running instance what is broken), and what would be wrong with starting up with an empty contract set (a collector that accepts everything — a data quality incident with excellent uptime).

4. The sharp one: rename `lesson_completed`'s `score` to `score_percent`, run `pnpm contracts:generate`, and run `pnpm test`. Everything is green. Ask them to explain why the suite is happy about a change that would split a metric in production — the same lesson as the previous step's edit 6, now with the generated types complicit. The fingerprint changed, which is the only signal anyone gets; making that signal enforceable is a review rule, not a test.

Then restore: `git checkout docs/tracking-plan.yaml libs/event-contracts/src/generated/events.ts`.

### 5. Verify and close

Run the step's verification (it also requires a clean working tree, so the drills must be reverted). Then `step_complete`, a reflection, and close:

> Phase 3 turns this into a write path: batches, idempotency on `message_id`, consent enforcement, and dead-letters carrying these reasons. Before you go on, ask yourself what you would want to _see_ when a client starts sending 10% of events with `property_type_invalid` at 3am — that question is what phases 12-15 exist to answer.
