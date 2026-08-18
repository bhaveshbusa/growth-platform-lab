import { readFileSync } from 'node:fs';
import {
  loadTrackingPlan,
  parseTrackingPlan,
  resolveTrackingPlanPath,
} from '../plan/tracking-plan';
import { PLAN_FINGERPRINT } from '../generated/events';
import {
  GENERATED_TYPES_PATH,
  REGENERATE_COMMAND,
  fingerprintPlan,
  renderEventTypes,
} from './generate-types';

const plan = loadTrackingPlan();

describe('the generated typed view of the plan', () => {
  it(`matches the plan (run \`${REGENERATE_COMMAND}\` if this fails)`, () => {
    expect(readFileSync(GENERATED_TYPES_PATH, 'utf8')).toBe(
      renderEventTypes(plan),
    );
  });

  it('carries the fingerprint of the plan it was generated from', () => {
    expect(PLAN_FINGERPRINT).toBe(fingerprintPlan(plan));
  });

  it('is stable, so an unchanged plan never produces a diff', () => {
    expect(renderEventTypes(plan)).toBe(renderEventTypes(plan));
  });

  it('renders required and optional properties differently', () => {
    const rendered = renderEventTypes(plan);

    expect(rendered).toContain('  path: string;');
    expect(rendered).toContain('  referrer_host?: string;');
  });

  it('renders an enum as a union of its allowed values', () => {
    expect(renderEventTypes(plan)).toContain(
      "  method: 'email' | 'google' | 'apple';",
    );
  });

  it('fingerprints meaning, not formatting', () => {
    const yaml = readFileSync(resolveTrackingPlanPath(), 'utf8');
    const reformatted = `# A comment nobody should have to regenerate for.\n${yaml}\n\n`;

    expect(fingerprintPlan(parseTrackingPlan(reformatted))).toBe(
      fingerprintPlan(plan),
    );
  });

  it('changes fingerprint when a property is renamed', () => {
    const renamed = parseTrackingPlan(
      JSON.stringify(plan).replace('lesson_id', 'lessonId'),
    );

    expect(fingerprintPlan(renamed)).not.toBe(fingerprintPlan(plan));
  });
});
