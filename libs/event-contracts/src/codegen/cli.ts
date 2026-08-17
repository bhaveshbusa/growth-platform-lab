import { writeFileSync } from 'node:fs';
import {
  loadTrackingPlan,
  resolveTrackingPlanPath,
} from '../plan/tracking-plan';
import { GENERATED_TYPES_PATH, renderEventTypes } from './generate-types';

const planPath = resolveTrackingPlanPath();
writeFileSync(
  GENERATED_TYPES_PATH,
  renderEventTypes(loadTrackingPlan(planPath)),
  'utf8',
);
process.stdout.write(`Generated ${GENERATED_TYPES_PATH} from ${planPath}\n`);
