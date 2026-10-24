// Live call state plus the Server-Sent Events channel that pushes every
// change to the dashboard (and the receiver's screen).
import type { Response } from "express";
import type { Level, Signals } from "./scorer.js";

export type { Level };
export type Role = "caller" | "receiver" | "unknown";

// Stored test and demo calls still say "grandma" for the person who answered.
export function toRole(stored: string): Role {
  if (stored === "caller") return "caller";
  if (stored === "receiver" || stored === "grandma") return "receiver";
  return "unknown";
}

export interface Segment {
  id: number;
  speakerId: number | null;
  role: Role;
  text: string;
  at: number;
}

export interface Score {
  segmentId: number;
  signals: Signals;
  level: Level;
  latencyMs: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  at: number;
}

export interface AgentStep {
  kind: "start" | "tool" | "done" | "error";
  tool?: string;
  detail: string;
  at: number;
}

export interface PoliceReport {
  summary: string;
  caller_claimed_identity: string;
  demands: string;
  pressure_tactics: string;
  handover_details: string;
  key_quotes: string[];
  scam_type: string;
}

export interface FamilyMessage {
  summary: string;
  quotes: string[];
  delivered: boolean;
  note: string;
}

export interface Approval {
  id: string;
  action: "call_police";
  reason: string;
  evidence: string;
  status: "pending" | "approved" | "declined";
  at: number;
}

export interface Call {
  id: number;
  startedAt: number;
  segments: Segment[];
  scores: Score[];
  level: Level;
  // Speaker-id keys in order of first appearance ("Speaker 1", "Speaker 2").
  speakers: string[];
  roles: Record<string, Role>;
  // Who decided the roles: nobody yet, Claude from the content, or the operator.
  rolesSource: "none" | "claude" | "manual";
  // A disagreeing caller identification waiting for confirmation.
  pendingCaller: { speaker: string; count: number } | null;
  alertAt: number | null;
  reactionMs: number | null;
  warning: string | null;
  agent: { status: "idle" | "running" | "done" | "error"; steps: AgentStep[] };
  report: PoliceReport | null;
  family: FamilyMessage | null;
  approval: Approval | null;
  hungUp: boolean;
}

let callCounter = 0;

// Changes on every server start, so open dashboards can tell they talk to a restarted server.
export const BUILD_ID = Date.now().toString(36);

function newCall(): Call {
  return {
    id: ++callCounter,
    startedAt: Date.now(),
    segments: [],
    scores: [],
    level: "safe",
    speakers: [],
    roles: {},
    rolesSource: "none",
    pendingCaller: null,
    alertAt: null,
    reactionMs: null,
    warning: null,
    agent: { status: "idle", steps: [] },
    report: null,
    family: null,
    approval: null,
    hungUp: false,
  };
}

class Hub {
  private clients = new Set<Response>();
  // Receiver phone views (/phone) get every event too, but are not dashboards.
  private phones = new Set<Response>();
  call: Call = newCall();

  attach(res: Response, kind: "dashboard" | "phone" = "dashboard"): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    this.clients.add(res);
    if (kind === "phone") this.phones.add(res);
    res.write(`data: ${JSON.stringify(this.snapshot())}\n\n`);
    this.sendScreens();
    res.on("close", () => {
      this.clients.delete(res);
      this.phones.delete(res);
      this.sendScreens();
    });
  }

  // How many dashboards are connected: a forgotten second tab becomes visible.
  // Phone views are counted apart, so an open phone never looks like a stale tab.
  private sendScreens(): void {
    this.send({ type: "screens", count: this.clients.size - this.phones.size, phones: this.phones.size });
  }

  send(event: { type: string; [key: string]: unknown }): void {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) client.write(line);
  }

  snapshot() {
    return { type: "state", call: this.call, buildId: BUILD_ID, screens: this.clients.size - this.phones.size, phones: this.phones.size };
  }

  reset(): Call {
    this.call = newCall();
    this.send(this.snapshot());
    return this.call;
  }

  // Comment lines keep proxies (and the Cloudflare tunnel) from closing idle streams.
  startHeartbeat(): void {
    setInterval(() => {
      for (const client of this.clients) client.write(": ping\n\n");
    }, 15_000).unref();
  }
}

export const hub = new Hub();
