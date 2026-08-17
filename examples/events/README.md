# Example events

Payloads for poking the contracts from a terminal:

```bash
pnpm contracts:validate examples/events/lesson-completed.json   # exit 0
pnpm contracts:validate examples/events/rejected.json           # exit 1
```

`lesson-completed.json` is a well-formed event from a known learner: both ids
are present, because identity resolution (phase 6) needs the anonymous id to
stitch the pre-signup history onto the account.

`rejected.json` is a batch where every event is wrong in exactly one way. Predict
the reason before running it:

| Event                    | What is wrong                                           | Reason                          |
| ------------------------ | ------------------------------------------------------- | ------------------------------- |
| `lesson_abandoned@1`     | the plan has no such event                              | `unknown_event`                 |
| `lesson_completed@1`     | `score` is planned as an integer, sent as a string      | `property_type_invalid`         |
| `lesson_completed@1`     | carries `learner_email`, which the plan never described | `unknown_property`              |
| `subscription_started@1` | a browser claiming money changed hands                  | `server_only_event_from_client` |
| `signup_started@2`       | the event exists, that version does not                 | `unknown_event_version`         |

The third one is the interesting failure: personal data on an event is not
merely off-plan, it is unreviewed personal data in the collection path. Traits
belong in the identity model, which is why the plan keeps `email` there and the
contract refuses it here.
