import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EventContracts } from './contracts';
import { resolveTrackingPlanPath } from '../plan/tracking-plan';

const contracts = EventContracts.fromPlan();
const examples = join(
  resolveTrackingPlanPath(),
  '..',
  '..',
  'examples',
  'events',
);

function load(file: string): unknown {
  return JSON.parse(readFileSync(join(examples, file), 'utf8')) as unknown;
}

/**
 * The examples are documentation, and documentation rots. These keep
 * examples/events/README.md honest.
 */
describe('the example payloads', () => {
  it('accepts examples/events/lesson-completed.json', () => {
    expect(contracts.validate(load('lesson-completed.json')).valid).toBe(true);
  });

  it('rejects each event in examples/events/rejected.json for the documented reason', () => {
    const events = load('rejected.json') as unknown[];

    const reasons = events.map((event) => {
      const result = contracts.validate(event);
      return result.valid
        ? 'accepted'
        : result.rejections.map((r) => r.reason).join(',');
    });

    expect(reasons).toEqual([
      'unknown_event',
      'property_type_invalid',
      'unknown_property',
      'server_only_event_from_client',
      'unknown_event_version',
    ]);
  });
});
