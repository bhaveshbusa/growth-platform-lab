import { EventContracts, type EventEnvelope } from './contracts';
import { parseTrackingPlan } from '../plan/tracking-plan';
import type { RejectionReason } from './rejection';

const contracts = EventContracts.fromPlan();

const LESSON_COMPLETED = {
  duration_seconds: 240,
  lesson_id: 'l_greetings_01',
  score: 92,
};

function envelope(
  overrides: Partial<EventEnvelope> = {},
): Record<string, unknown> {
  return {
    anonymous_id: 'anon_7f3c',
    consent: {
      marketing: false,
      personalisation: true,
      product_analytics: true,
    },
    context: { locale: 'en-GB', path: '/lesson/:id' },
    event: 'lesson_completed',
    message_id: '018f4c9e-0000-7000-8000-000000000001',
    properties: { ...LESSON_COMPLETED },
    sent_at: '2026-02-01T10:00:00.000Z',
    source: 'client',
    version: 1,
    ...overrides,
  };
}

function reasonsFor(input: Record<string, unknown>): RejectionReason[] {
  const result = contracts.validate(input);
  if (result.valid) {
    return [];
  }
  return result.rejections.map((problem) => problem.reason);
}

describe('EventContracts', () => {
  it('compiles one contract per planned event version', () => {
    expect(contracts.size).toBe(contracts.plan.events.length);
    expect(contracts.get('lesson_completed', 1)?.key).toBe(
      'lesson_completed@1',
    );
  });

  it('accepts an event that matches the plan', () => {
    const result = contracts.validate(envelope());

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.contract.key).toBe('lesson_completed@1');
    }
  });

  it('accepts an event that omits an optional property', () => {
    const result = contracts.validate(
      envelope({ event: 'page_viewed', properties: { path: '/pricing' } }),
    );

    expect(result.valid).toBe(true);
  });

  describe('the envelope', () => {
    it.each([
      ['message_id', { message_id: '' }],
      ['sent_at', { sent_at: '01/02/2026' }],
      ['source', { source: 'mobile' }],
      ['properties', { properties: [] }],
      ['context', { context: 'en-GB' }],
      ['user_id', { user_id: '' }],
    ])('rejects a malformed %s', (_field, overrides) => {
      expect(
        reasonsFor(envelope(overrides as Partial<EventEnvelope>)),
      ).toContain('malformed_envelope');
    });

    it('refuses an envelope field the contract never described', () => {
      const result = contracts.validate({
        ...envelope(),
        learner_email: 'someone@example.test',
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejections).toEqual([
          {
            detail: 'not an envelope field',
            field: 'learner_email',
            reason: 'malformed_envelope',
          },
        ]);
      }
    });

    it('rejects a non-object payload', () => {
      expect(
        reasonsFor('lesson_completed' as unknown as Record<string, unknown>),
      ).toEqual(['malformed_envelope']);
    });

    it('rejects an event with no anonymous_id as a lost identity, not a schema fault', () => {
      const result = contracts.validate(envelope({ anonymous_id: '' }));

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejections).toEqual([
          {
            detail: 'expected a non-empty string',
            field: 'anonymous_id',
            reason: 'identity_missing',
          },
        ]);
      }
    });

    it('accepts a known learner carrying both ids, because stitching needs both', () => {
      const result = contracts.validate(envelope({ user_id: 'usr_412' }));

      expect(result.valid).toBe(true);
    });

    it('requires a decision for every purpose the plan declares', () => {
      const result = contracts.validate(
        envelope({
          consent: { product_analytics: true },
        }),
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejections.map((problem) => problem.field)).toEqual([
          'consent.personalisation',
          'consent.marketing',
        ]);
      }
    });

    it('rejects consent for a purpose the plan never declared', () => {
      const consent = {
        marketing: false,
        personalisation: true,
        product_analytics: true,
        resale: true,
      };

      const result = contracts.validate(envelope({ consent }));

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejections[0].field).toBe('consent.resale');
      }
    });

    it('does not enforce the decisions themselves; the gateway does that in phase 3', () => {
      const consent = {
        marketing: false,
        personalisation: false,
        product_analytics: false,
      };

      expect(contracts.validate(envelope({ consent })).valid).toBe(true);
    });
  });

  describe('the event name and version', () => {
    it('rejects an event the plan never described', () => {
      expect(reasonsFor(envelope({ event: 'lesson_abandoned' }))).toEqual([
        'unknown_event',
      ]);
    });

    it('distinguishes an unknown version from an unknown event', () => {
      const result = contracts.validate(envelope({ version: 2 }));

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejections).toEqual([
          {
            detail: 'the plan describes version(s) 1',
            field: 'version',
            reason: 'unknown_event_version',
          },
        ]);
      }
    });
  });

  describe('trust', () => {
    it('refuses a money event claimed by a browser', () => {
      const money = {
        event: 'subscription_started',
        properties: { currency: 'GBP', plan: 'annual', price_minor_units: 999 },
        source: 'client' as const,
      };

      expect(reasonsFor(envelope(money))).toEqual([
        'server_only_event_from_client',
      ]);
      expect(
        contracts.validate(envelope({ ...money, source: 'server' })).valid,
      ).toBe(true);
    });

    it('lets the server emit an event the plan allows from either side', () => {
      expect(contracts.validate(envelope({ source: 'server' })).valid).toBe(
        true,
      );
    });
  });

  describe('properties', () => {
    it('reports a missing required property', () => {
      const result = contracts.validate(
        envelope({ properties: { duration_seconds: 240, score: 92 } }),
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejections).toEqual([
          {
            detail: 'required by the tracking plan',
            field: 'properties.lesson_id',
            reason: 'missing_required_property',
          },
        ]);
      }
    });

    it('treats null like absent, so an unset optional never becomes a type error', () => {
      const result = contracts.validate(
        envelope({
          event: 'page_viewed',
          properties: { path: '/pricing', referrer_host: null },
        }),
      );

      expect(result.valid).toBe(true);
    });

    it.each([
      ['string', { lesson_id: 42 }, 'property_type_invalid'],
      ['integer', { score: '92' }, 'property_type_invalid'],
      ['integer that is fractional', { score: 92.5 }, 'property_type_invalid'],
    ])('rejects a %s property of the wrong type', (_case, override, reason) => {
      const properties = { ...LESSON_COMPLETED, ...override };

      expect(reasonsFor(envelope({ properties }))).toEqual([reason]);
    });

    it('separates "not a member of the enum" from "not a string"', () => {
      const wrongValue = {
        event: 'signup_started',
        properties: { method: 'facebook' },
      };
      const wrongType = { event: 'signup_started', properties: { method: 7 } };

      expect(reasonsFor(envelope(wrongValue))).toEqual([
        'property_value_not_allowed',
      ]);
      expect(reasonsFor(envelope(wrongType))).toEqual([
        'property_type_invalid',
      ]);
    });

    it('refuses an unplanned property instead of quietly dropping it', () => {
      const properties = { ...LESSON_COMPLETED, learner_email: 'a@b.test' };

      const result = contracts.validate(envelope({ properties }));

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejections).toEqual([
          {
            detail: 'not described by lesson_completed@1',
            field: 'properties.learner_email',
            reason: 'unknown_property',
          },
        ]);
      }
    });

    it('reports every problem at once, so one rejection teaches the whole fix', () => {
      const properties = { duration_seconds: '240', extra: true, score: 92 };

      expect(reasonsFor(envelope({ properties })).sort()).toEqual([
        'missing_required_property',
        'property_type_invalid',
        'unknown_property',
      ]);
    });

    it('never echoes the offending value, because rejections get logged', () => {
      const properties = { ...LESSON_COMPLETED, learner_email: 'a@b.test' };
      const result = contracts.validate(envelope({ properties }));

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(JSON.stringify(result.rejections)).not.toContain('a@b.test');
      }
    });
  });

  it('derives acceptance from the plan rather than from this code', () => {
    const plan = parseTrackingPlan(`
version: 1
product: lingostreak
purposes: [product_analytics]
events:
  - name: kettle_boiled
    version: 3
    description: Nothing to do with language learning.
    owner: growth
    purpose: product_analytics
    properties:
      - name: temperature_celsius
        type: integer
        required: true
        pii: none
        description: Water temperature.
`);

    const invented = new EventContracts(plan);
    const boiled = {
      anonymous_id: 'anon_1',
      consent: { product_analytics: true },
      event: 'kettle_boiled',
      message_id: 'm1',
      properties: { temperature_celsius: 100 },
      sent_at: '2026-02-01T10:00:00Z',
      source: 'client',
      version: 3,
    };

    expect(invented.validate(boiled).valid).toBe(true);
    // The same event against the real plan is unknown: the plan decides, not the validator.
    expect(
      reasonsFor(
        envelope({
          event: 'kettle_boiled',
          properties: { temperature_celsius: 100 },
          version: 3,
        }),
      ),
    ).toEqual(['unknown_event']);
  });
});
