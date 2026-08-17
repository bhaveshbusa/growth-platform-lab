import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type {
  PlanEvent,
  PlanProperty,
  TrackingPlan,
} from '../plan/tracking-plan';

export const GENERATED_TYPES_PATH = join(
  __dirname,
  '..',
  'generated',
  'events.ts',
);

export const REGENERATE_COMMAND = 'pnpm contracts:generate';

/**
 * Fingerprint the plan's *meaning*, not its bytes: reformatting the YAML or
 * editing a comment must not invalidate generated code, while renaming a
 * property must.
 */
export function fingerprintPlan(plan: TrackingPlan): string {
  const hash = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return `sha256:${hash.slice(0, 16)}`;
}

function pascalCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function interfaceName(event: PlanEvent): string {
  return `${pascalCase(event.name)}V${event.version}`;
}

function propertyType(property: PlanProperty): string {
  switch (property.type) {
    case 'enum':
      return (property.values ?? []).map((value) => `'${value}'`).join(' | ');
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'string':
    case 'timestamp':
      return 'string';
  }
}

function renderEvent(event: PlanEvent): string {
  const properties = event.properties.map((property) => {
    const optional = property.required ? '' : '?';
    return [
      `  /** ${property.description} */`,
      `  ${property.name}${optional}: ${propertyType(property)};`,
    ].join('\n');
  });

  return [
    `/**`,
    ` * ${event.description}`,
    ` *`,
    ` * Owner: ${event.owner}. Purpose: ${event.purpose}. Source: ${event.source}.`,
    ` */`,
    `export interface ${interfaceName(event)} {`,
    properties.join('\n'),
    `}`,
  ].join('\n');
}

/**
 * Render the typed view of the plan. The generated file is checked in and a
 * test fails when it drifts, so a plan change and its types travel in the same
 * pull request — the alternative is a build step nobody runs and types that
 * quietly describe last month's plan.
 */
export function renderEventTypes(plan: TrackingPlan): string {
  const events = [...plan.events].sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(
      `${right.name}@${right.version}`,
    ),
  );

  const keys = events.map((event) => `  '${event.name}@${event.version}',`);
  const propertiesByKey = events.map(
    (event) => `  '${event.name}@${event.version}': ${interfaceName(event)};`,
  );

  return [
    `// Generated from docs/tracking-plan.yaml by \`${REGENERATE_COMMAND}\`. Do not edit.`,
    `//`,
    `// The tracking plan is the source of truth; this file is a typed view of it.`,
    `// A test fails if the two disagree.`,
    ``,
    `export const PLAN_VERSION = ${plan.version};`,
    `export const PLAN_PRODUCT = '${plan.product}';`,
    `export const PLAN_FINGERPRINT = '${fingerprintPlan(plan)}';`,
    ``,
    `export const CONSENT_PURPOSES = [`,
    ...plan.purposes.map((purpose) => `  '${purpose}',`),
    `] as const;`,
    ``,
    `export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];`,
    ``,
    `export const EVENT_KEYS = [`,
    ...keys,
    `] as const;`,
    ``,
    `export type EventKey = (typeof EVENT_KEYS)[number];`,
    ``,
    ...events.map((event) => `${renderEvent(event)}\n`),
    `/** Properties each planned event carries, keyed by name@version. */`,
    `export interface EventPropertiesByKey {`,
    ...propertiesByKey,
    `}`,
    ``,
  ].join('\n');
}
