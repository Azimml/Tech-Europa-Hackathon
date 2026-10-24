// Wires the pieces together: transcript segment -> scorer -> risk level ->
// instant warning -> Claude agent actions -> human approval for the police.
import { randomUUID } from "node:crypto";
import { runAgent } from "./agent.js";
import { config } from "./config.js";
import { hub, type Role, type Score, type Segment } from "./hub.js";
import { push } from "./notify.js";
import { escalate, levelFor, scoreCall } from "./scorer.js";

export const DEFAULT_WARNING = "This looks like a scam call. Hang up now. Real police never ask for money.";

let segmentCounter = 0;

function roleFor(speakerId: number | null): Role {
  if (speakerId === null) return "unknown";
  const roles = hub.call.roles;
  const key = String(speakerId);
  if (!roles[key]) {
    // The person who answers usually speaks first ("Hello?").
    roles[key] = Object.values(roles).includes("grandma") ? "caller" : "grandma";
  }
  return roles[key];
}

export function addSegment(speakerId: number | null, text: string): Segment | null {
  const call = hub.call;
  const clean = text.trim();
  if (!clean || call.hungUp) return null;
  const segment: Segment = { id: ++segmentCounter, speakerId, role: roleFor(speakerId), text: clean, at: Date.now() };
  call.segments.push(segment);
  hub.send({ type: "segment", segment });
  void scheduleScore();
  return segment;
}

export function setRoles(roles: Record<string, Role>): void {
  hub.call.roles = { ...roles };
}

export function swapRoles(): void {
  const call = hub.call;
  const flip = (role: Role): Role => (role === "caller" ? "grandma" : role === "grandma" ? "caller" : role);
  for (const key of Object.keys(call.roles)) call.roles[key] = flip(call.roles[key]);
  for (const segment of call.segments) segment.role = flip(segment.role);
  hub.send(hub.snapshot());
}

// One scoring request at a time; segments that arrive meanwhile are folded
// into the next request, so the meter always reflects the latest transcript.
let scoring = false;
let dirty = false;

async function scheduleScore(): Promise<void> {
  if (scoring) {
    dirty = true;
    return;
  }
  scoring = true;
  try {
    do {
      dirty = false;
      const call = hub.call;
      const segments = call.segments.slice();
      const last = segments.at(-1);
      if (!last) break;
      const result = await scoreCall(segments.map((s) => ({ role: s.role, text: s.text })));
      if (hub.call !== call) break; // a new call started while we were scoring
      const level = escalate(call.level, levelFor(result.signals));
      const score: Score = { segmentId: last.id, ...result, level, at: Date.now() };
      call.scores.push(score);
      call.level = level;
      hub.send({ type: "score", score });
      if (level === "scam" && call.alertAt === null) onScam(last);
    } while (dirty);
  } catch (err) {
    hub.send({ type: "error", where: "scorer", message: (err as Error).message });
  } finally {
    scoring = false;
  }
}

function onScam(trigger: Segment): void {
  const call = hub.call;
  call.alertAt = Date.now();
  call.reactionMs = call.alertAt - trigger.at;
  call.warning = DEFAULT_WARNING;
  // Fast path: warn before the agent has even started thinking.
  hub.send({ type: "alert", message: DEFAULT_WARNING, source: "detector", reactionMs: call.reactionMs });
  void push(config.ntfyPhoneTopic, "Schutzengel: scam call!", DEFAULT_WARNING, ["rotating_light"]);
  void startAgent();
}

function transcriptText(segments: Segment[]): string {
  const label = { caller: "Caller", grandma: "Erika", unknown: "Unknown" } as const;
  return segments.map((s) => `${label[s.role]}: ${s.text}`).join("\n");
}

async function startAgent(): Promise<void> {
  const call = hub.call;
  const current = () => hub.call === call;
  const step = (kind: "start" | "tool" | "done" | "error", detail: string, tool?: string) => {
    if (!current()) return;
    const entry = { kind, tool, detail, at: Date.now() };
    call.agent.steps.push(entry);
    hub.send({ type: "agent", status: call.agent.status, step: entry });
  };

  call.agent.status = "running";
  step("start", `Claude (${config.agentModel}) is reading the call`);
  const lastScore = call.scores.at(-1);

  try {
    const summary = await runAgent(transcriptText(call.segments), lastScore!.signals, {
      log: (tool, detail) => step("tool", detail, tool),
      warnGrandma: async (message) => {
        if (!current()) return "Call already ended.";
        call.warning = message;
        hub.send({ type: "alert", message, source: "claude", reactionMs: call.reactionMs });
        const result = await push(config.ntfyPhoneTopic, "Schutzengel warning", message, ["rotating_light"]);
        return `Warning shown on Erika's phone. ${result.note}`;
      },
      notifyFamily: async (summary, quotes) => {
        if (!current()) return "Call already ended.";
        const body = quotes.length ? `${summary}\n\nCaller said: "${quotes.join('" / "')}"` : summary;
        const result = await push(config.ntfyFamilyTopic, "Erika is getting a scam call", body, ["warning"]);
        call.family = { summary, quotes, delivered: result.delivered, note: result.note };
        hub.send({ type: "family", family: call.family });
        return result.delivered ? "Lena was notified." : `Shown on the dashboard (${result.note}).`;
      },
      draftPoliceReport: async (report) => {
        if (!current()) return "Call already ended.";
        call.report = report;
        hub.send({ type: "report", report });
        return "Police report drafted.";
      },
      requestPoliceCall: async (reason, evidence) => {
        if (!current()) return "Call already ended.";
        if (call.approval) return `Already requested; status: ${call.approval.status}. Do not request again.`;
        call.approval = { id: randomUUID(), action: "call_police", reason, evidence, status: "pending", at: Date.now() };
        hub.send({ type: "approval", approval: call.approval });
        return "Request shown to the family member. A human must approve before anything is dialled. Do not call this tool again.";
      },
    });
    if (!current()) return;
    call.agent.status = "done";
    step("done", summary);
  } catch (err) {
    if (!current()) return;
    call.agent.status = "error";
    step("error", (err as Error).message);
  }
}

export async function decideApproval(id: string, approve: boolean): Promise<boolean> {
  const approval = hub.call.approval;
  if (!approval || approval.id !== id || approval.status !== "pending") return false;
  approval.status = approve ? "approved" : "declined";
  hub.send({ type: "approval", approval });
  if (approve) {
    await push(
      config.ntfyFamilyTopic,
      "Police are being called",
      "You approved calling 110 about the scam call to Erika (simulated in this demo).",
      ["police_car"],
    );
  }
  return true;
}

export function hangUp(): void {
  hub.call.hungUp = true;
  hub.send({ type: "hangup", at: Date.now() });
}
