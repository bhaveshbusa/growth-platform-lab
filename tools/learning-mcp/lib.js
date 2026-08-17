// Shared library: workout loading, progress store, verification runner.
// Content lives in learning/workouts/** as JSON + Markdown (data, not code),
// so the same content could later be served remotely without rewriting.
// Zero runtime dependencies by design: `node server.js` works straight after clone.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Repo root = two levels up from tools/learning-mcp
export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const WORKOUTS_DIR = path.join(REPO_ROOT, "learning", "workouts");
export const PROGRESS_DIR = path.join(REPO_ROOT, ".learning");
export const PROGRESS_FILE = path.join(PROGRESS_DIR, "progress.json");

// ---------- Workout content ----------

export function loadWorkouts() {
  if (!fs.existsSync(WORKOUTS_DIR)) return [];
  return fs
    .readdirSync(WORKOUTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const file = path.join(WORKOUTS_DIR, d.name, "workout.json");
      if (!fs.existsSync(file)) return null;
      const def = JSON.parse(fs.readFileSync(file, "utf8"));
      def.dir = path.join(WORKOUTS_DIR, d.name);
      return def;
    })
    .filter(Boolean)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export function getWorkout(workoutId) {
  const w = loadWorkouts().find((w) => w.id === workoutId);
  if (!w) throw new Error(`Unknown workout '${workoutId}'. Use workout_list to see available workouts.`);
  return w;
}

export function getStep(workoutId, stepId) {
  const w = getWorkout(workoutId);
  const s = (w.steps || []).find((s) => s.id === stepId);
  if (!s) {
    const ids = (w.steps || []).map((s) => s.id).join(", ");
    throw new Error(`Unknown step '${stepId}' in workout '${workoutId}'. Steps: ${ids}`);
  }
  return { workout: w, step: s };
}

export function readStepPrompt(workout, step) {
  const file = path.join(workout.dir, step.prompt);
  return fs.readFileSync(file, "utf8");
}

// ---------- Progress store ----------

function emptyProgress() {
  return { version: 1, startedAt: new Date().toISOString(), workouts: {}, reflections: [] };
}

export function readProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  } catch {
    return emptyProgress();
  }
}

export function writeProgress(progress) {
  fs.mkdirSync(PROGRESS_DIR, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

export function stepState(progress, workoutId, stepId) {
  progress.workouts[workoutId] ??= { steps: {} };
  progress.workouts[workoutId].steps[stepId] ??= { status: "not_started" };
  return progress.workouts[workoutId].steps[stepId];
}

export function markStepStarted(workoutId, stepId) {
  const progress = readProgress();
  const st = stepState(progress, workoutId, stepId);
  if (st.status === "not_started") {
    st.status = "in_progress";
    st.startedAt = new Date().toISOString();
  }
  writeProgress(progress);
  return st;
}

export function markStepVerified(workoutId, stepId, passed, results) {
  const progress = readProgress();
  const st = stepState(progress, workoutId, stepId);
  st.lastVerify = { at: new Date().toISOString(), passed, results };
  writeProgress(progress);
  return st;
}

export function markStepComplete(workoutId, stepId, { force = false } = {}) {
  const { workout, step } = getStep(workoutId, stepId);
  const progress = readProgress();
  const st = stepState(progress, workoutId, stepId);
  const hasChecks = (step.verify || []).length > 0;
  if (hasChecks && !force && !(st.lastVerify && st.lastVerify.passed)) {
    throw new Error(
      `Step '${stepId}' has verification checks that have not passed yet. ` +
        `Run step_verify first (or pass force=true with a reason the learner has accepted).`
    );
  }
  st.status = "completed";
  st.completedAt = new Date().toISOString();
  const remaining = (workout.steps || []).filter(
    (s) => stepState(progress, workoutId, s.id).status !== "completed"
  );
  if (remaining.length === 0) {
    progress.workouts[workoutId].completedAt = new Date().toISOString();
  }
  writeProgress(progress);
  return { state: st, nextStep: step.next ?? null, workoutComplete: remaining.length === 0 };
}

export function setPreference(key, value) {
  const progress = readProgress();
  progress.preferences ??= {};
  progress.preferences[key] = value;
  writeProgress(progress);
  return progress.preferences;
}

export function addReflection(workoutId, text) {
  const progress = readProgress();
  progress.reflections.push({ workoutId, text, at: new Date().toISOString() });
  writeProgress(progress);
}

export function progressSummary() {
  const progress = readProgress();
  const workouts = loadWorkouts().map((w) => {
    const steps = (w.steps || []).map((s) => {
      const st = (progress.workouts[w.id]?.steps ?? {})[s.id] ?? { status: "not_started" };
      return { id: s.id, title: s.title, status: st.status, completedAt: st.completedAt ?? null };
    });
    const done = steps.filter((s) => s.status === "completed").length;
    return { id: w.id, name: w.name, order: w.order, phases: w.phases, steps, done, total: steps.length };
  });
  return { workouts, reflections: progress.reflections, preferences: progress.preferences ?? {} };
}

// ---------- Verification runner ----------

export async function runVerification(workoutId, stepId) {
  const { step } = getStep(workoutId, stepId);
  const checks = step.verify || [];
  const results = [];
  for (const check of checks) {
    const started = Date.now();
    let passed = false;
    let output = "";
    try {
      const { stdout, stderr } = await execFileP("bash", ["-lc", check.command], {
        cwd: REPO_ROOT,
        timeout: (check.timeout_seconds ?? 60) * 1000,
        maxBuffer: 1024 * 1024,
      });
      output = (stdout + stderr).trim();
      passed = check.expect_match ? new RegExp(check.expect_match, "m").test(output) : true;
    } catch (err) {
      output = ((err.stdout ?? "") + (err.stderr ?? "") + (err.message ?? "")).trim();
      passed = false;
    }
    results.push({
      name: check.name,
      command: check.command,
      passed,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      output: output.slice(-2000),
    });
  }
  const allPassed = results.every((r) => r.passed);
  markStepVerified(workoutId, stepId, allPassed, results.map(({ name, passed }) => ({ name, passed })));
  return { passed: allPassed, results };
}
