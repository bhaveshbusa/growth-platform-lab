import {
  loadTrackingPlan,
  type PlanEvent,
  type PlanProperty,
  type TrackingPlan,
} from '../plan/tracking-plan';
import { rejection, type Rejection } from './rejection';

/** The wire shape the gateway will accept from phase 3 onward. */
export interface EventEnvelope {
  /** Client-minted idempotency key; phase 3 deduplicates on it. */
  message_id: string;
  event: string;
  version: number;
  /** When the client emitted it. The gateway stamps its own received_at. */
  sent_at: string;
  anonymous_id: string;
  user_id?: string;
  source: 'client' | 'server';
  /** One boolean per purpose in the plan. Enforced from phase 3. */
  consent: Record<string, boolean>;
  context?: Record<string, unknown>;
  properties: Record<string, unknown>;
}

export type ValidationResult =
  | { valid: true; event: EventEnvelope; contract: EventContract }
  | { valid: false; rejections: Rejection[] };

export interface EventContract {
  /** name@version, the key a dead-letter or a warehouse table is grouped by. */
  key: string;
  event: PlanEvent;
  properties: ReadonlyMap<string, PlanProperty>;
}

/**
 * Envelope fields are closed, like properties: a client that can add fields to
 * the envelope can smuggle data past review just as easily as one that adds
 * properties.
 */
const ENVELOPE_FIELDS = [
  'message_id',
  'event',
  'version',
  'sent_at',
  'anonymous_id',
  'user_id',
  'source',
  'consent',
  'context',
  'properties',
] as const;

const TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function contractKey(name: string, version: number): string {
  return `${name}@${version}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Does this value satisfy the plan's declared type? Returns the rejection
 * reason rather than a boolean, so the caller can distinguish "wrong type"
 * from "value outside the allowed set" — they mean different things to whoever
 * reads the dead-letter queue.
 */
function checkProperty(
  property: PlanProperty,
  value: unknown,
): Rejection | undefined {
  const field = `properties.${property.name}`;

  switch (property.type) {
    case 'string':
    case 'enum':
      if (typeof value !== 'string') {
        return rejection('property_type_invalid', field, 'expected a string');
      }
      break;
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return rejection('property_type_invalid', field, 'expected an integer');
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return rejection('property_type_invalid', field, 'expected a boolean');
      }
      break;
    case 'timestamp':
      if (typeof value !== 'string' || !TIMESTAMP.test(value)) {
        return rejection(
          'property_type_invalid',
          field,
          'expected an ISO 8601 timestamp',
        );
      }
      break;
  }

  if (
    property.type === 'enum' &&
    property.values !== undefined &&
    !property.values.includes(value as string)
  ) {
    return rejection(
      'property_value_not_allowed',
      field,
      `allowed values are ${property.values.join(', ')}`,
    );
  }

  return undefined;
}

/**
 * Contracts compiled from the plan. Nothing here is hand-written per event: add
 * an event to docs/tracking-plan.yaml and it becomes acceptable; remove it and
 * it stops being acceptable, without touching this file.
 */
export class EventContracts {
  private readonly byKey: Map<string, EventContract>;
  private readonly versionsByName: Map<string, number[]>;

  constructor(readonly plan: TrackingPlan) {
    this.byKey = new Map();
    this.versionsByName = new Map();

    for (const event of plan.events) {
      const properties = new Map<string, PlanProperty>();
      for (const property of event.properties) {
        properties.set(property.name, property);
      }

      const key = contractKey(event.name, event.version);
      this.byKey.set(key, { event, key, properties });
      this.versionsByName.set(event.name, [
        ...(this.versionsByName.get(event.name) ?? []),
        event.version,
      ]);
    }
  }

  static fromPlan(path?: string): EventContracts {
    return new EventContracts(loadTrackingPlan(path));
  }

  get size(): number {
    return this.byKey.size;
  }

  get(name: string, version: number): EventContract | undefined {
    return this.byKey.get(contractKey(name, version));
  }

  versions(name: string): number[] {
    return this.versionsByName.get(name) ?? [];
  }

  /**
   * Validate one event against the plan, reporting *every* problem rather than
   * the first: a client that has three things wrong should learn all three from
   * one rejected batch instead of three deploys.
   */
  validate(input: unknown): ValidationResult {
    if (!isRecord(input)) {
      return {
        rejections: [rejection('malformed_envelope', '', 'expected an object')],
        valid: false,
      };
    }

    const rejections = this.checkEnvelope(input);
    if (rejections.length > 0) {
      return { rejections, valid: false };
    }

    const envelope = input as unknown as EventEnvelope;
    const contract = this.get(envelope.event, envelope.version);
    if (contract === undefined) {
      const known = this.versions(envelope.event);
      return {
        rejections: [
          known.length === 0
            ? rejection(
                'unknown_event',
                'event',
                'not described by the tracking plan',
              )
            : rejection(
                'unknown_event_version',
                'version',
                `the plan describes version(s) ${known.join(', ')}`,
              ),
        ],
        valid: false,
      };
    }

    const problems = [
      ...this.checkSource(envelope, contract),
      ...this.checkProperties(envelope, contract),
    ];

    return problems.length > 0
      ? { rejections: problems, valid: false }
      : { contract, event: envelope, valid: true };
  }

  private checkEnvelope(input: Record<string, unknown>): Rejection[] {
    const rejections: Rejection[] = [];

    if (!isNonEmptyString(input.message_id)) {
      rejections.push(
        rejection(
          'malformed_envelope',
          'message_id',
          'expected a non-empty string',
        ),
      );
    }
    if (!isNonEmptyString(input.event)) {
      rejections.push(
        rejection('malformed_envelope', 'event', 'expected a non-empty string'),
      );
    }
    if (typeof input.version !== 'number' || !Number.isInteger(input.version)) {
      rejections.push(
        rejection('malformed_envelope', 'version', 'expected an integer'),
      );
    }
    if (typeof input.sent_at !== 'string' || !TIMESTAMP.test(input.sent_at)) {
      rejections.push(
        rejection(
          'malformed_envelope',
          'sent_at',
          'expected an ISO 8601 timestamp',
        ),
      );
    }
    if (input.source !== 'client' && input.source !== 'server') {
      rejections.push(
        rejection(
          'malformed_envelope',
          'source',
          'expected "client" or "server"',
        ),
      );
    }
    if (!isRecord(input.properties)) {
      rejections.push(
        rejection('malformed_envelope', 'properties', 'expected an object'),
      );
    }
    if (input.context !== undefined && !isRecord(input.context)) {
      rejections.push(
        rejection('malformed_envelope', 'context', 'expected an object'),
      );
    }
    if (input.user_id !== undefined && !isNonEmptyString(input.user_id)) {
      rejections.push(
        rejection(
          'malformed_envelope',
          'user_id',
          'expected a non-empty string',
        ),
      );
    }

    for (const field of Object.keys(input)) {
      if (
        !ENVELOPE_FIELDS.includes(field as (typeof ENVELOPE_FIELDS)[number])
      ) {
        rejections.push(
          rejection('malformed_envelope', field, 'not an envelope field'),
        );
      }
    }

    rejections.push(...this.checkConsent(input.consent));

    // Identity is its own reason: an event nobody can be attributed to is not
    // a schema problem, it is a lost event.
    if (!isNonEmptyString(input.anonymous_id)) {
      rejections.push(
        rejection(
          'identity_missing',
          'anonymous_id',
          'expected a non-empty string',
        ),
      );
    }

    return rejections;
  }

  private checkConsent(consent: unknown): Rejection[] {
    if (!isRecord(consent)) {
      return [rejection('malformed_envelope', 'consent', 'expected an object')];
    }

    const rejections: Rejection[] = [];
    for (const purpose of this.plan.purposes) {
      if (typeof consent[purpose] !== 'boolean') {
        rejections.push(
          rejection(
            'malformed_envelope',
            `consent.${purpose}`,
            'expected a boolean decision for every purpose in the plan',
          ),
        );
      }
    }
    for (const purpose of Object.keys(consent)) {
      if (!this.plan.purposes.includes(purpose)) {
        rejections.push(
          rejection(
            'malformed_envelope',
            `consent.${purpose}`,
            'not a purpose in the tracking plan',
          ),
        );
      }
    }
    return rejections;
  }

  private checkSource(
    envelope: EventEnvelope,
    contract: EventContract,
  ): Rejection[] {
    if (contract.event.source === 'server' && envelope.source !== 'server') {
      return [
        rejection(
          'server_only_event_from_client',
          'source',
          `the plan marks ${contract.key} as server-sourced`,
        ),
      ];
    }
    return [];
  }

  private checkProperties(
    envelope: EventEnvelope,
    contract: EventContract,
  ): Rejection[] {
    const rejections: Rejection[] = [];
    const sent = envelope.properties;

    for (const [name, property] of contract.properties) {
      const value = sent[name];
      if (value === undefined || value === null) {
        if (property.required) {
          rejections.push(
            rejection(
              'missing_required_property',
              `properties.${name}`,
              'required by the tracking plan',
            ),
          );
        }
        continue;
      }

      const problem = checkProperty(property, value);
      if (problem !== undefined) {
        rejections.push(problem);
      }
    }

    // Unknown properties are refused, not dropped: silently discarding them
    // means a client keeps sending data nobody reviewed and nobody stores.
    for (const name of Object.keys(sent)) {
      if (!contract.properties.has(name)) {
        rejections.push(
          rejection(
            'unknown_property',
            `properties.${name}`,
            `not described by ${contract.key}`,
          ),
        );
      }
    }

    return rejections;
  }
}
