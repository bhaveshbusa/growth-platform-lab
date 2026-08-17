## Instructor prompt: boundaries

RFC 0001's Decision section. The goal is that they can defend the boundaries — and name what the boundaries cost.

### 1. Predict before reading

Ask them to sketch, from what they know of CDPs and analytics tools, the components needed to get an event from a browser into a funnel chart and into a marketing tool. Let them draw it badly; that is the point. Then read the diagram in `docs/architecture.md` and RFC 0001's _Boundaries_ and _Data flow_.

Compare their sketch to the four components: `event-gateway`, `identity-service`, `warehouse-sink`, `activation-worker`. Ask what each **owns** — the answer should be in terms of facts and failure, not technology.

### 2. The load-bearing question

> The gateway must accept an event even when identity resolution, the warehouse, and every destination are down. Why, and what does that force to be true?

Work it through with them:

- The event is a **fact that already happened**. Refusing it does not undo the lesson the learner completed; it destroys the record of it. Unlike a payment, there is no retry from the user.
- The browser is a terrible queue: tabs close, networks drop, and a client that must wait for enrichment turns a downstream outage into visible product latency.
- Therefore collection must be durable **before** processing, and downstream components must consume a replayable stream rather than being called synchronously. Phase 5 exists to make that true; phase 3's dead-letter path exists so an event that _cannot_ be understood is still retained rather than silently dropped.

Then push the other way: what does this cost? Eventual consistency (a profile is stale for a while), duplicate delivery (at-least-once, so idempotency becomes the consumers' problem), and the operational reality that "the data is late" now looks exactly like "traffic is low". That last one is why RFC 0001 promotes pipeline freshness and lag to first-class signals — ask them how they would notice a two-hour lag today, with no metrics anywhere. The honest answer is: they would not.

### 3. Two rules that constrain every later phase

From RFC 0001: telemetry is a passenger, never the driver; and the pipeline observes itself. Ask for a concrete violation of each — for example, a request handler that fails when the OTel collector is unreachable (rule 1), or a dashboard that shows only request rates while the stream silently falls two hours behind (rule 2). If they can produce good violations, they have understood the rules.

### 4. Alternatives, taken seriously

Have them argue the case _for_ buying Segment plus Amplitude instead of building this. It is a strong case, and RFC 0001 concedes it: for a real product, buy. The lab exists because the vendor UI hides exactly the mechanics they are trying to learn. An engineer who can only say "we built it ourselves" is less useful than one who can say why they would not.

### 5. Verify and close

Run the step's verification (RFC present, `pnpm test` green). Ask what the passing test suite proves at this stage — almost nothing about behaviour, and quite a lot about the tracking plan, which is the next step's subject. `step_complete`, reflection, then: "now the only decision in this repository that cannot be undone."
