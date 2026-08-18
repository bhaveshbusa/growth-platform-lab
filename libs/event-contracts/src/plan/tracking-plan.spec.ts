import {
  TrackingPlanError,
  loadTrackingPlan,
  parseTrackingPlan,
  resolveTrackingPlanPath,
} from './tracking-plan';

const MINIMAL = `
version: 1
product: lingostreak
purposes: [product_analytics]
events:
  - name: lesson_started
    version: 1
    description: A lesson was opened.
    owner: learning
    purpose: product_analytics
    properties:
      - name: lesson_id
        type: string
        required: true
        pii: none
        description: Stable lesson identifier.
`;

function withPlan(yaml: string): () => void {
  return () => {
    parseTrackingPlan(yaml);
  };
}

describe('the tracking plan loader', () => {
  it('loads the plan that ships with the repository', () => {
    const plan = loadTrackingPlan();

    expect(plan.product).toBe('lingostreak');
    expect(plan.events.length).toBeGreaterThan(0);
  });

  it('finds the plan without being told where it is', () => {
    expect(resolveTrackingPlanPath()).toContain('docs/tracking-plan.yaml');
  });

  it('honours TRACKING_PLAN_PATH so a workout can point at a broken plan', () => {
    const previous = process.env.TRACKING_PLAN_PATH;
    process.env.TRACKING_PLAN_PATH = '/tmp/some-other-plan.yaml';

    try {
      expect(resolveTrackingPlanPath()).toBe('/tmp/some-other-plan.yaml');
    } finally {
      if (previous === undefined) {
        delete process.env.TRACKING_PLAN_PATH;
      } else {
        process.env.TRACKING_PLAN_PATH = previous;
      }
    }
  });

  it('defaults a source-less event to client, and keeps a declared source', () => {
    const plan = parseTrackingPlan(MINIMAL);

    expect(plan.events[0].source).toBe('client');
    expect(
      parseTrackingPlan(
        MINIMAL.replace(
          '    owner: learning',
          '    source: server\n    owner: learning',
        ),
      ).events[0].source,
    ).toBe('server');
  });

  it('reads requiredness as an explicit true, never as a truthy accident', () => {
    const plan = parseTrackingPlan(
      MINIMAL.replace('required: true', 'required: "yes"'),
    );

    expect(plan.events[0].properties[0].required).toBe(false);
  });

  describe('refuses to compile a plan it cannot trust', () => {
    it.each([
      ['no events', MINIMAL.replace(/events:[\s\S]*/, 'events: []')],
      [
        'no purposes',
        MINIMAL.replace('purposes: [product_analytics]', 'purposes: []'),
      ],
      [
        'an unknown property type',
        MINIMAL.replace('type: string', 'type: json'),
      ],
      [
        'an unknown pii class',
        MINIMAL.replace('pii: none', 'pii: probably_fine'),
      ],
      ['an unknown source', `${MINIMAL}    source: carrier_pigeon\n`],
      ['a missing description', MINIMAL.replace(/^ {8}description:.*$/m, '')],
      [
        'a zero version',
        MINIMAL.replace('version: 1\nproduct', 'version: 0\nproduct'),
      ],
      ['an enum with no values', MINIMAL.replace('type: string', 'type: enum')],
    ])('rejects a plan with %s', (_case, yaml) => {
      expect(withPlan(yaml)).toThrow(TrackingPlanError);
    });
  });
});
