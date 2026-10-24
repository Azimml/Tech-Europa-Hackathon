// Live call state plus the Server-Sent Events channel that pushes every
// change to the dashboard and to grandma's phone.
import type { Response } from "express";
import type { Level, Signals } from "./scorer.js";

export type { Level };
export type Role = "caller" | "grandma" | "unknown";

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
  roles: Record<string, Role>;
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

function newCall(): Call {
  return {
    id: ++callCounter,
    startedAt: Date.now(),
    segments: [],
    scores: [],
    level: "safe",
    roles: {},
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
  call: Call = newCall();

  attach(res: Response): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify(this.snapshot())}\n\n`);
    this.clients.add(res);
    res.on("close", () => this.clients.delete(res));
  }

  send(event: { type: string; [key: string]: unknown }): void {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) client.write(line);
  }

  snapshot() {
    return { type: "state", call: this.call };
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
