import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const ALLOWED_TYPES = ['string', 'integer', 'boolean', 'timestamp', 'enum'];
const ALLOWED_PII = ['none', 'pseudonymous', 'personal', 'sensitive'];
const ALLOWED_SOURCES = ['client', 'server'];
const OWNERS = ['growth', 'learning', 'monetisation'];
const IRREGULAR_PAST_TENSE = ['sent', 'lost', 'won', 'left', 'built', 'paid'];
const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const UNIT_BEARING = ['duration', 'price', 'amount', 'goal', 'interval'];
const UNIT_SUFFIXES = [
  '_seconds',
  '_ms',
  '_minutes',
  '_days',
  '_minor_units',
  '_percent',
];

interface PlanProperty {
  name: string;
  type: string;
  required?: boolean;
  pii: string;
  description?: string;
  purpose?: string;
  values?: string[];
}

interface PlanEvent {
  name: string;
  version: number;
  description: string;
  owner: string;
  purpose: string;
  source?: string;
  properties: PlanProperty[];
}

interface TrackingPlan {
  version: number;
  product: string;
  purposes: string[];
  pii_classes: string[];
  identity: {
    anonymous_id: { description: string; pii: string };
    user_id: { description: string; pii: string };
    traits: PlanProperty[];
  };
  events: PlanEvent[];
}

const plan = parse(
  readFileSync(join(__dirname, 'tracking-plan.yaml'), 'utf8'),
) as TrackingPlan;

const isPastTense = (verb: string): boolean =>
  verb.endsWith('ed') || IRREGULAR_PAST_TENSE.includes(verb);

const hasUnitSuffix = (name: string): boolean =>
  UNIT_SUFFIXES.some((suffix) => name.endsWith(suffix));

const needsUnitSuffix = (property: PlanProperty): boolean =>
  property.type === 'integer' &&
  UNIT_BEARING.some((word) => property.name.includes(word));

describe('tracking plan', () => {
  it('declares a product, a plan version, purposes, and PII classes', () => {
    expect(plan.product).toEqual(expect.any(String));
    expect(plan.version).toBeGreaterThanOrEqual(1);
    expect(plan.purposes.length).toBeGreaterThan(0);
    expect(plan.pii_classes).toEqual(ALLOWED_PII);
  });

  it('has at least one event', () => {
    expect(plan.events.length).toBeGreaterThan(0);
  });

  it('names every event object_action in snake_case with a past-tense action', () => {
    for (const event of plan.events) {
      expect(event.name).toMatch(SNAKE_CASE);

      const segments = event.name.split('_');
      expect(segments.length).toBeGreaterThanOrEqual(2);
      expect(isPastTense(segments[segments.length - 1])).toBe(true);
    }
  });

  it('keeps event names unique', () => {
    const names = plan.events.map((event) => `${event.name}.v${event.version}`);

    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every event a version, description, owner, and declared purpose', () => {
    for (const event of plan.events) {
      expect(event.version).toBeGreaterThanOrEqual(1);
      expect(event.description.length).toBeGreaterThan(20);
      expect(OWNERS).toContain(event.owner);
      expect(plan.purposes).toContain(event.purpose);

      if (event.source !== undefined) {
        expect(ALLOWED_SOURCES).toContain(event.source);
      }
    }
  });

  it('emits money events from the server only', () => {
    const moneyEvents = plan.events.filter((event) =>
      event.name.startsWith('subscription_'),
    );

    expect(moneyEvents.length).toBeGreaterThan(0);
    for (const event of moneyEvents) {
      expect(event.source).toBe('server');
    }
  });

  describe.each(plan.events.map((event) => [event.name, event] as const))(
    '%s',
    (_name, event) => {
      it('describes every property with a type, requiredness, and PII class', () => {
        expect(event.properties.length).toBeGreaterThan(0);

        for (const property of event.properties) {
          expect(property.name).toMatch(SNAKE_CASE);
          expect(ALLOWED_TYPES).toContain(property.type);
          expect(typeof property.required).toBe('boolean');
          expect(ALLOWED_PII).toContain(property.pii);
          expect(property.description ?? '').not.toHaveLength(0);
        }
      });

      it('enumerates allowed values for enum properties', () => {
        for (const property of event.properties) {
          if (property.type === 'enum') {
            expect(property.values ?? []).not.toHaveLength(0);
          }
        }
      });

      it('suffixes unit-bearing properties with their unit', () => {
        for (const property of event.properties) {
          if (needsUnitSuffix(property)) {
            expect(hasUnitSuffix(property.name)).toBe(true);
          }
        }
      });

      it('keeps personal and sensitive data out of event properties', () => {
        for (const property of event.properties) {
          expect(property.pii).not.toBe('personal');
          expect(property.pii).not.toBe('sensitive');
        }
      });

      it('keeps property names unique', () => {
        const names = event.properties.map((property) => property.name);

        expect(new Set(names).size).toBe(names.length);
      });
    },
  );

  describe('identity', () => {
    it('separates the anonymous id from the user id', () => {
      expect(plan.identity.anonymous_id.pii).toBe('pseudonymous');
      expect(plan.identity.user_id.pii).toBe('pseudonymous');
    });

    it('confines personal data to traits, each with a purpose', () => {
      for (const trait of plan.identity.traits) {
        expect(trait.name).toMatch(SNAKE_CASE);
        expect(ALLOWED_TYPES).toContain(trait.type);
        expect(ALLOWED_PII).toContain(trait.pii);
        expect(trait.pii).not.toBe('sensitive');
        expect(plan.purposes).toContain(trait.purpose ?? '');
      }
    });

    it('models the anonymous-to-known transition with a signup event', () => {
      expect(plan.events.map((event) => event.name)).toContain(
        'signup_completed',
      );
    });
  });
});
