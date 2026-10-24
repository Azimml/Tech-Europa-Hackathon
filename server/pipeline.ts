// Wires the pieces together: transcript segment -> scorer -> risk level ->
// instant warning -> Claude agent actions -> human approval for the police.
import { randomUUID } from "node:crypto";
import { runAgent, type AgentMode } from "./agent.js";
import { config } from "./config.js";
import { hub, type Call, type Role, type Score, type Segment } from "./hub.js";
import { push } from "./notify.js";
import { escalate, levelFor, scoreCall, warningFor, type Signals } from "./scorer.js";

let segmentCounter = 0;

const keyOf = (speakerId: number | null): string | null => (speakerId === null ? null : String(speakerId));

// "Speaker 1", "Speaker 2" in order of first appearance. The numbers say
// nothing about who called; Claude decides that from the content.
function speakerLabel(call: Call, key: string | null): string {
  return key === null ? "Unknown speaker" : `Speaker ${call.speakers.indexOf(key) + 1}`;
}

function roleFor(call: Call, key: string | null): Role {
  if (key === null) return "unknown";
  if (!call.speakers.includes(key)) call.speakers.push(key);
  if (!call.roles[key] && call.rolesSource !== "none") {
    // Roles are known and a second voice appears: it gets the remaining role.
    call.roles[key] = Object.values(call.roles).includes("caller") ? "receiver" : "caller";
  }
  return call.roles[key] ?? "unknown";
}

export function addSegment(speakerId: number | null, text: string): Segment | null {
  const call = hub.call;
  const clean = text.trim();
  if (!clean || call.hungUp) return null;
  const role = roleFor(call, keyOf(speakerId));
  const segment: Segment = { id: ++segmentCounter, speakerId, role, text: clean, at: Date.now() };
  call.segments.push(segment);
  hub.send({ type: "segment", segment });
  void scheduleScore();
  return segment;
}

// The caller key gets "caller", every other seen speaker "receiver"; all lines are relabelled.
function assignRoles(call: Call, callerKey: string | undefined): void {
  call.roles = {};
  for (const key of call.speakers) call.roles[key] = key === callerKey ? "caller" : "receiver";
  for (const segment of call.segments) {
    const key = keyOf(segment.speakerId);
    segment.role = key === null ? "unknown" : (call.roles[key] ?? "unknown");
  }
}

function announceRoles(call: Call): void {
  const callerKey = Object.keys(call.roles).find((key) => call.roles[key] === "caller");
  hub.send(hub.snapshot());
  hub.send({ type: "roles", source: call.rolesSource, caller: callerKey ? speakerLabel(call, callerKey) : null });
}

// Adopts Claude's caller identification. Once set, a different answer needs
// two scores in a row to switch, and a manual swap is never overridden.
function adoptRoles(call: Call, callerSpeaker: Signals["caller_speaker"]): void {
  if (call.rolesSource === "manual") return;
  if (callerSpeaker === "unknown") {
    call.pendingCaller = null;
    return;
  }
  const key = call.speakers[Number(callerSpeaker) - 1];
  if (key === undefined) return; // names a speaker we have not heard
  if (call.rolesSource === "claude") {
    if (call.roles[key] === "caller") {
      call.pendingCaller = null;
      return;
    }
    const count = call.pendingCaller?.speaker === key ? call.pendingCaller.count + 1 : 1;
    if (count < 2) {
      call.pendingCaller = { speaker: key, count };
      return;
    }
  }
  assignRoles(call, key);
  call.rolesSource = "claude";
  call.pendingCaller = null;
  announceRoles(call);
}

export function swapRoles(): void {
  const call = hub.call;
  if (call.rolesSource === "none") {
    // Not identified yet: the operator's click sets Speaker 1 = Receiver, Speaker 2 = Caller.
    assignRoles(call, call.speakers[1]);
  } else {
    const flip = (role: Role): Role => (role === "caller" ? "receiver" : role === "receiver" ? "caller" : role);
    for (const key of Object.keys(call.roles)) call.roles[key] = flip(call.roles[key]);
    for (const segment of call.segments) segment.role = flip(segment.role);
  }
  call.rolesSource = "manual";
  call.pendingCaller = null;
  announceRoles(call);
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
      const turns = segments.map((s) => ({ speaker: speakerLabel(call, keyOf(s.speakerId)), text: s.text }));
      const result = await scoreCall(turns);
      if (hub.call !== call) break; // a new call started while we were scoring
      adoptRoles(call, result.signals.caller_speaker);
      const level = escalate(call.level, levelFor(result.signals));
      const score: Score = { segmentId: last.id, ...result, level, at: Date.now() };
      call.scores.push(score);
      call.level = level;
      hub.send({ type: "score", score });
      if (level === "scam" && call.alertAt === null) onScam(last, result.signals);
      else maybeFollowUp(call);
    } while (dirty);
  } catch (err) {
    hub.send({ type: "error", where: "scorer", message: (err as Error).message });
  } finally {
    scoring = false;
  }
}

// The one warning of the call: written by the scorer that raised the alarm (or
// a fixed text for the scam type), shown, spoken and pushed exactly once.
function onScam(trigger: Segment, signals: Signals): void {
  const call = hub.call;
  call.alertAt = Date.now();
  call.reactionMs = call.alertAt - trigger.at;
  call.warning = warningFor(signals);
  // Named "alarm" (not the earlier "alert"): dashboards still running older code ignore
  // it, so a forgotten old tab can never read the warning aloud.
  hub.send({ type: "alarm", warning: call.warning, source: "detector", reactionMs: call.reactionMs });
  void push(config.ntfyPhoneTopic, "Schutzengel: scam call!", call.warning, ["rotating_light"]);
  void startAgent();
}

// The alarm usually fires on secrecy, before the money request, and the agent
// only asks for the police once there is a demand. So a clear demand after the
// alarm runs a short follow-up pass (report update + police request only).
const FOLLOW_UP_MONEY = 0.8;
const MAX_FOLLOW_UPS = 2;
const followUps = new WeakMap<Call, { count: number; money: number }>();

function maybeFollowUp(call: Call): void {
  if (hub.call !== call || call.alertAt === null || call.approval || call.agent.status === "running") return;
  const money = call.scores.at(-1)?.signals.asks_money ?? 0;
  const done = followUps.get(call) ?? { count: 0, money: 0 };
  if (money < FOLLOW_UP_MONEY || money <= done.money || done.count >= MAX_FOLLOW_UPS) return;
  followUps.set(call, { count: done.count + 1, money });
  void startAgent("follow-up");
}

function transcriptText(call: Call): string {
  const name = (s: Segment) =>
    s.role === "caller" ? "Caller" : s.role === "receiver" ? "Receiver" : speakerLabel(call, keyOf(s.speakerId));
  return call.segments.map((s) => `${name(s)}: ${s.text}`).join("\n");
}

async function startAgent(mode: AgentMode = "alarm"): Promise<void> {
  const call = hub.call;
  const current = () => hub.call === call;
  const step = (kind: "start" | "tool" | "done" | "error", detail: string, tool?: string) => {
    if (!current()) return;
    const entry = { kind, tool, detail, at: Date.now() };
    call.agent.steps.push(entry);
    hub.send({ type: "agent", status: call.agent.status, step: entry });
  };

  call.agent.status = "running";
  step(
    "start",
    mode === "alarm"
      ? `Claude (${config.agentModel}) is reading the call`
      : "Caller demanded money or valuables: Claude updates the report and decides on the police",
  );
  const lastScore = call.scores.at(-1);

  try {
    const summary = await runAgent(transcriptText(call), lastScore!.signals, {
      log: (tool, detail) => step("tool", detail, tool),
      notifyTrustedContact: async (summary, quotes) => {
        if (!current()) return "Call already ended.";
        const body = quotes.length ? `${summary}\n\nCaller said: "${quotes.join('" / "')}"` : summary;
        const result = await push(config.ntfyFamilyTopic, "Scam call in progress", body, ["warning"]);
        call.family = { summary, quotes, delivered: result.delivered, note: result.note };
        hub.send({ type: "family", family: call.family });
        return result.delivered ? "The trusted contact was notified." : `Shown on the dashboard (${result.note}).`;
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
    }, mode);
    if (!current()) return;
    call.agent.status = "done";
    step("done", summary);
  } catch (err) {
    if (!current()) return;
    call.agent.status = "error";
    step("error", (err as Error).message);
  }
  // A demand may have been scored while this pass was running.
  maybeFollowUp(call);
}

export async function decideApproval(id: string, approve: boolean): Promise<boolean> {
  const approval = hub.call.approval;
  if (!approval || approval.id !== id || approval.status !== "pending") return false;
  approval.status = approve ? "approved" : "declined";
  hub.send({ type: "approval", approval });
  if (approve) {
    await push(
      config.ntfyFamilyTopic,
      "Police call approved",
      "You approved calling 110 about the scam call to the receiver (simulated in this demo).",
      ["police_car"],
    );
  }
  return true;
}

export function hangUp(): void {
  hub.call.hungUp = true;
  hub.send({ type: "hangup", at: Date.now() });
}
