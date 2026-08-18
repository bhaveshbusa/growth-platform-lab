import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface CliRun {
  status: number;
  stdout: string;
  stderr: string;
}

function run(contents: string): CliRun {
  const path = join(mkdtempSync(join(tmpdir(), 'events-')), 'events.json');
  writeFileSync(path, contents, 'utf8');

  try {
    return {
      status: 0,
      stderr: '',
      stdout: execFileSync(
        process.execPath,
        [
          require.resolve('ts-node/dist/bin'),
          '--project',
          join(__dirname, '..', '..', '..', '..', 'tsconfig.json'),
          join(__dirname, 'validate-event.ts'),
          path,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ),
    };
  } catch (error) {
    const failure = error as { status: number; stdout: string; stderr: string };
    return {
      status: failure.status,
      stderr: failure.stderr,
      stdout: failure.stdout,
    };
  }
}

describe('contracts:validate', () => {
  jest.setTimeout(60_000);

  it('refuses an empty batch rather than reporting success', () => {
    const result = run('[]');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('empty');
  });

  it('exits non-zero when any event in a batch is rejected', () => {
    const result = run('[5]');

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('malformed_envelope');
  });
});
