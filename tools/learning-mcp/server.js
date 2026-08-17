#!/usr/bin/env node
// Growth Platform Lab — guided learning MCP server (stdio, zero dependencies).
// Implements the MCP surface an agent client needs: initialize, tools/list,
// tools/call, ping — as newline-delimited JSON-RPC 2.0 over stdio.
//
// Tools follow the acquire → shape → verify → deliver loop: fetch a step
// prompt, work it with the learner, verify against the real system, and only
// then record completion in .learning/progress.json.
import readline from "node:readline";
import {
  getWorkout,
  getStep,
  readStepPrompt,
  markStepStarted,
  markStepComplete,
  addReflection,
  setPreference,
  progressSummary,
  runVerification,
} from "./lib.js";

const SERVER_INFO = { name: "growth-lab-guide", version: "0.1.0" };
const PROTOCOL_FALLBACK = "2025-06-18";

// ---------- Tool definitions ----------

const str = (desc) => ({ type: "string", description: desc });

const TOOLS = [
  {
    name: "workout_list",
    description:
      "List all guided workouts with the learner's progress. Call this first in a session to orient: it shows what exists, what is done, and where the learner left off.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => progressSummary(),
  },
  {
    name: "workout_get",
    description:
      "Get one workout's full structure: goal, phases covered, ordered steps with titles and validation questions. Use to preview or plan; does not modify progress.",
    inputSchema: {
      type: "object",
      properties: { workout_id: str("Workout id, e.g. 'foundations'") },
      required: ["workout_id"],
    },
    handler: async ({ workout_id }) => {
      const { dir, ...rest } = getWorkout(workout_id);
      return rest;
    },
  },
  {
    name: "step_get_prompt",
    description:
      "Fetch the instructor prompt for a step and mark it started. The prompt is written for YOU (the agent) to guide the learner interactively — do not paste it verbatim; execute it conversationally, one action at a time, adapting depth to the learner.",
    inputSchema: {
      type: "object",
      properties: { workout_id: str("Workout id"), step_id: str("Step id") },
      required: ["workout_id", "step_id"],
    },
    handler: async ({ workout_id, step_id }) => {
      const { workout, step } = getStep(workout_id, step_id);
      markStepStarted(workout_id, step_id);
      const prompt = readStepPrompt(workout, step);
      const validates = step.validates
        ? `\n\n---\nValidation question to confirm with the learner before verifying: ${step.validates}`
        : "";
      return `# ${workout.name} — ${step.title}\n\n${prompt}${validates}`;
    },
  },
  {
    name: "step_verify",
    description:
      "Run the step's objective verification checks against the learner's actual system (shell commands in the repo root). Returns pass/fail per check with output. A step with checks cannot be completed until these pass.",
    inputSchema: {
      type: "object",
      properties: { workout_id: str("Workout id"), step_id: str("Step id") },
      required: ["workout_id", "step_id"],
    },
    handler: async ({ workout_id, step_id }) => runVerification(workout_id, step_id),
  },
  {
    name: "step_complete",
    description:
      "Mark a step completed. Refuses if the step's verification has not passed (override with force=true only if the learner explicitly accepts skipping, e.g. no Docker available). Returns the next step id.",
    inputSchema: {
      type: "object",
      properties: {
        workout_id: str("Workout id"),
        step_id: str("Step id"),
        force: { type: "boolean", description: "Skip the verification requirement. Use only with learner consent." },
      },
      required: ["workout_id", "step_id"],
    },
    handler: async ({ workout_id, step_id, force }) => markStepComplete(workout_id, step_id, { force }),
  },
  {
    name: "progress_get",
    description:
      "Get the learner's saved progress and reflections across all workouts. Use at the start of a session to resume where they left off.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => progressSummary(),
  },
  {
    name: "preference_set",
    description:
      "Persist a learner preference across sessions (stored in local progress). Most important: command_mode = 'learner' (they type project commands themselves and report results — better for learning) or 'agent' (you run commands on their behalf). Honor the stored preference in every session; learners can change it any time.",
    inputSchema: {
      type: "object",
      properties: {
        key: str("Preference name, e.g. 'command_mode'"),
        value: str("Preference value, e.g. 'learner' or 'agent'"),
      },
      required: ["key", "value"],
    },
    handler: async ({ key, value }) => ({ preferences: setPreference(key, value) }),
  },
  {
    name: "reflection_submit",
    description:
      "Save the learner's end-of-workout reflection (their own words) to the local journal. Ask for the reflection after the last step of a workout: what clicked, what is still shaky.",
    inputSchema: {
      type: "object",
      properties: { workout_id: str("Workout id"), reflection: str("The learner's reflection, in their own words") },
      required: ["workout_id", "reflection"],
    },
    handler: async ({ workout_id, reflection }) => {
      addReflection(workout_id, reflection);
      return { saved: true };
    },
  },
];

// ---------- JSON-RPC over stdio ----------

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const replyError = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  switch (method) {
    case "initialize":
      return reply(id, {
        protocolVersion: params?.protocolVersion ?? PROTOCOL_FALLBACK,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Guided learning for Growth Platform Lab. Start with workout_list to orient, " +
          "then drive each step: step_get_prompt → work it with the learner → step_verify → step_complete. " +
          "Prompts are instructor notes for you, not text to paste at the learner. " +
          "Check preferences in workout_list output: if command_mode is 'learner', have the learner type " +
          "project commands themselves and report results back; if unset, ask once and save with preference_set.",
      });
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return replyError(id, -32602, `Unknown tool: ${params?.name}`);
      try {
        const result = await tool.handler(params?.arguments ?? {});
        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return reply(id, { content: [{ type: "text", text }] });
      } catch (err) {
        return reply(id, { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });
      }
    }
    default:
      if (isRequest) return replyError(id, -32601, `Method not found: ${method}`);
    // Notifications (e.g. notifications/initialized) are ignored.
  }
}

let pending = 0;
const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return replyError(null, -32700, "Parse error");
  }
  pending += 1;
  handle(msg)
    .catch((err) => {
      if (msg.id !== undefined && msg.id !== null) replyError(msg.id, -32603, err.message);
    })
    .finally(() => {
      pending -= 1;
    });
});
rl.on("close", () => {
  // Let in-flight requests (e.g. a long step_verify) finish before exiting.
  const waitAndExit = () => (pending === 0 ? process.exit(0) : setTimeout(waitAndExit, 100));
  waitAndExit();
});
