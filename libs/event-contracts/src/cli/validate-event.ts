/**
 * Poke the contracts from a terminal before the write path exists (phase 3):
 *
 *   pnpm contracts:validate examples/lesson-completed.json
 *   cat event.json | pnpm contracts:validate
 *
 * Exits 0 when the event would be accepted, 1 when it would be dead-lettered,
 * printing the reason for each problem — the same taxonomy the gateway will use.
 */
import { readFileSync } from 'node:fs';
import { EventContracts } from '../contracts/contracts';

function readInput(path: string | undefined): string {
  return readFileSync(path ?? 0, 'utf8');
}

function main(): number {
  const contracts = EventContracts.fromPlan();
  const raw = readInput(process.argv[2]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    process.stderr.write(`Not JSON: ${(error as Error).message}\n`);
    return 1;
  }

  const events: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  if (events.length === 0) {
    process.stderr.write('No events to validate: the batch is empty\n');
    return 1;
  }

  let rejected = 0;

  for (const [index, event] of events.entries()) {
    const label = events.length === 1 ? 'event' : `event[${index}]`;
    const result = contracts.validate(event);

    if (result.valid) {
      process.stdout.write(`accepted  ${label}  ${result.contract.key}\n`);
      continue;
    }

    rejected += 1;
    process.stdout.write(`rejected  ${label}\n`);
    for (const problem of result.rejections) {
      const field = problem.field === '' ? '(envelope)' : problem.field;
      process.stdout.write(
        `  ${problem.reason}  ${field}: ${problem.detail}\n`,
      );
    }
  }

  return rejected === 0 ? 0 : 1;
}

process.exitCode = main();
