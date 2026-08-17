import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContractsService } from './contracts.service';

function planFile(contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'plan-')), 'tracking-plan.yaml');
  writeFileSync(path, contents, 'utf8');
  return path;
}

describe('ContractsService', () => {
  const previous = process.env.TRACKING_PLAN_PATH;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.TRACKING_PLAN_PATH;
    } else {
      process.env.TRACKING_PLAN_PATH = previous;
    }
  });

  it('compiles the repository plan at startup', () => {
    const service = new ContractsService();
    service.onModuleInit();

    expect(service.status).toBe('ok');
    expect(service.current?.size).toBeGreaterThan(0);
    expect(service.error).toBeUndefined();
  });

  it('survives an unusable plan instead of crashing the process', () => {
    process.env.TRACKING_PLAN_PATH = planFile(
      'version: 1\nproduct: lingostreak\n',
    );

    const service = new ContractsService();
    service.onModuleInit();

    expect(service.status).toBe('failed');
    expect(service.current).toBeUndefined();
    expect(service.error).toContain('purposes');
  });

  it('reports a missing plan as a failure, not as an empty plan', () => {
    process.env.TRACKING_PLAN_PATH = join(tmpdir(), 'no-such-plan.yaml');

    const service = new ContractsService();
    service.onModuleInit();

    expect(service.status).toBe('failed');
    expect(service.error).toContain('no-such-plan.yaml');
  });
});
