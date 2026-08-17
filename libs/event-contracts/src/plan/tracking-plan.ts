import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';

/**
 * The tracking plan as data. Every type here mirrors docs/tracking-plan.yaml,
 * because the plan — not this code — is the source of truth for what the
 * product may emit.
 */
export const PROPERTY_TYPES = [
  'string',
  'integer',
  'boolean',
  'timestamp',
  'enum',
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PII_CLASSES = [
  'none',
  'pseudonymous',
  'personal',
  'sensitive',
] as const;

export type PiiClass = (typeof PII_CLASSES)[number];

export type EventSource = 'client' | 'server';

export interface PlanProperty {
  name: string;
  type: PropertyType;
  required: boolean;
  pii: PiiClass;
  description: string;
  values?: string[];
}

export interface PlanEvent {
  name: string;
  version: number;
  description: string;
  owner: string;
  purpose: string;
  source: EventSource;
  properties: PlanProperty[];
}

export interface TrackingPlan {
  version: number;
  product: string;
  purposes: string[];
  events: PlanEvent[];
}

/**
 * Thrown when the plan cannot be turned into contracts at all. The gateway
 * treats this as a readiness failure rather than starting up and guessing:
 * a collector with no contract accepts anything, which is worse than refusing
 * traffic.
 */
export class TrackingPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrackingPlanError';
  }
}

const PLAN_RELATIVE_PATH = join('docs', 'tracking-plan.yaml');

/**
 * Find docs/tracking-plan.yaml by walking up from this file, so the plan
 * resolves the same way from source, from dist, and from a test runner.
 * TRACKING_PLAN_PATH overrides it — the workouts use that to point the gateway
 * at a deliberately broken plan.
 */
export function resolveTrackingPlanPath(): string {
  const override = process.env.TRACKING_PLAN_PATH;
  if (override !== undefined && override !== '') {
    return override;
  }

  let directory = __dirname;
  for (;;) {
    const candidate = join(directory, PLAN_RELATIVE_PATH);
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      throw new TrackingPlanError(
        `Could not find ${PLAN_RELATIVE_PATH} above ${__dirname}; set TRACKING_PLAN_PATH`,
      );
    }
    directory = parent;
  }
}

function requireString(
  value: unknown,
  where: string,
  field: string,
  allowed?: readonly string[],
): string {
  if (typeof value !== 'string' || value === '') {
    throw new TrackingPlanError(
      `${where}: ${field} must be a non-empty string`,
    );
  }
  if (allowed !== undefined && !allowed.includes(value)) {
    throw new TrackingPlanError(
      `${where}: ${field} must be one of ${allowed.join(', ')}; got "${value}"`,
    );
  }
  return value;
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TrackingPlanError(`${where} must be a mapping`);
  }
  return value as Record<string, unknown>;
}

function parseProperty(raw: unknown, where: string): PlanProperty {
  const record = asRecord(raw, where);
  const name = requireString(record.name, where, 'name');
  const property: PlanProperty = {
    description: requireString(
      record.description,
      `${where}.${name}`,
      'description',
    ),
    name,
    pii: requireString(
      record.pii,
      `${where}.${name}`,
      'pii',
      PII_CLASSES,
    ) as PiiClass,
    required: record.required === true,
    type: requireString(
      record.type,
      `${where}.${name}`,
      'type',
      PROPERTY_TYPES,
    ) as PropertyType,
  };

  if (property.type === 'enum') {
    const values = record.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new TrackingPlanError(
        `${where}.${name}: enum properties must declare values`,
      );
    }
    property.values = values.map((value, index) =>
      requireString(value, `${where}.${name}`, `values[${index}]`),
    );
  }

  return property;
}

function parseEvent(raw: unknown, index: number): PlanEvent {
  const record = asRecord(raw, `events[${index}]`);
  const name = requireString(record.name, `events[${index}]`, 'name');
  const where = `event ${name}`;

  const version = record.version;
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    throw new TrackingPlanError(`${where}: version must be a positive integer`);
  }

  const properties = record.properties;
  if (!Array.isArray(properties)) {
    throw new TrackingPlanError(`${where}: properties must be a list`);
  }

  return {
    description: requireString(record.description, where, 'description'),
    name,
    owner: requireString(record.owner, where, 'owner'),
    properties: properties.map((property) => parseProperty(property, where)),
    purpose: requireString(record.purpose, where, 'purpose'),
    // Events are client-sent unless the plan says otherwise; money events say otherwise.
    source: (record.source === undefined
      ? 'client'
      : requireString(record.source, where, 'source', [
          'client',
          'server',
        ])) as EventSource,
    version,
  };
}

export function parseTrackingPlan(yaml: string): TrackingPlan {
  const document = asRecord(parse(yaml), 'tracking plan');

  const version = document.version;
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    throw new TrackingPlanError(
      'tracking plan: version must be a positive integer',
    );
  }

  const purposes = document.purposes;
  if (!Array.isArray(purposes) || purposes.length === 0) {
    throw new TrackingPlanError(
      'tracking plan: purposes must be a non-empty list',
    );
  }

  const events = document.events;
  if (!Array.isArray(events) || events.length === 0) {
    throw new TrackingPlanError(
      'tracking plan: events must be a non-empty list',
    );
  }

  return {
    events: events.map((event, index) => parseEvent(event, index)),
    product: requireString(document.product, 'tracking plan', 'product'),
    purposes: purposes.map((purpose, index) =>
      requireString(purpose, 'tracking plan', `purposes[${index}]`),
    ),
    version,
  };
}

export function loadTrackingPlan(
  path: string = resolveTrackingPlanPath(),
): TrackingPlan {
  return parseTrackingPlan(readFileSync(path, 'utf8'));
}
