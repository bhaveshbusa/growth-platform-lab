/**
 * Why an event was refused. This taxonomy is deliberately finite and blunt:
 * from phase 3 the gateway dead-letters with one of these reasons, and a
 * dead-letter you cannot group by reason is a dead-letter you will never
 * triage. "Invalid" is not a reason.
 */
export const REJECTION_REASONS = [
  /** The envelope itself is unusable: wrong shape, missing required field. */
  'malformed_envelope',
  /** No anonymous_id, so the event cannot be attributed to anyone at all. */
  'identity_missing',
  /** The plan has no such event. Usually a client shipped something unreviewed. */
  'unknown_event',
  /** The event exists, but not at that version. */
  'unknown_event_version',
  /** A browser claimed an event the plan reserves for the server (money events). */
  'server_only_event_from_client',
  /** A property the plan marks required is absent. */
  'missing_required_property',
  /** A property the plan does not describe was sent. */
  'unknown_property',
  /** Present, described, wrong type. */
  'property_type_invalid',
  /** Present, right type, outside the plan's allowed values. */
  'property_value_not_allowed',
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

export interface Rejection {
  reason: RejectionReason;
  /** Dotted path to the offending field, for example properties.duration_seconds. */
  field: string;
  /** Human-readable detail. Safe to log: never contains the value itself. */
  detail: string;
}

export function rejection(
  reason: RejectionReason,
  field: string,
  detail: string,
): Rejection {
  return { detail, field, reason };
}
