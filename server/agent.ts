// The "brain": once the scorer flags a scam, a Claude agent reads the whole
// call and acts through tools. Calling the police always waits for a human.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config.js";
import type { PoliceReport } from "./hub.js";
import type { Signals } from "./scorer.js";

const client = new Anthropic();

export interface AgentActions {
  notifyTrustedContact(summary: string, quotes: string[]): Promise<string>;
  draftPoliceReport(report: PoliceReport): Promise<string>;
  requestPoliceCall(reason: string, evidence: string): Promise<string>;
  log(tool: string, detail: string): void;
}

const SYSTEM = `You are Schutzengel, a guardian angel that protects the receiver of a phone call (often an older person living alone).
The live scam detector has just flagged the current call, and the receiver has already been shown a warning; do not warn them again.
Act immediately, in this order:
1. notify_trusted_contact: tell the receiver's trusted contact what is happening, quoting the caller's key words. In the summary, refer to the receiver as "the receiver", never by a name heard on the call.
2. draft_police_report: a factual report from the transcript only. Write "not mentioned" for anything not said. Never invent names, numbers or addresses.
3. request_police_call: only if the caller demanded money, valuables, card details/PINs, remote access, or a handover, while claiming authority or a family emergency. A human approves this; do not call it twice.
Then stop and reply with one short sentence summarising what you did.
Latency-sensitive: the receiver may be about to hand over their savings, so call the tools right away without deliberating.`;

// Runs when the caller demands money or valuables after the alarm already fired
// (the first pass usually runs on a secrecy line, before any demand).
const FOLLOW_UP_SYSTEM = `You are Schutzengel, a guardian angel that protects the receiver of a phone call (often an older person living alone).
The receiver has already been warned and their trusted contact has already been told about this scam call. The live detector now reports that the caller has made a demand for money or valuables.
Act immediately, in this order:
1. draft_police_report: rewrite the report from the full transcript, now including the demand and any handover details (who, what, when, where). Write "not mentioned" for anything not said. Never invent names, numbers or addresses.
2. request_police_call: only if the caller demanded money, valuables, card details/PINs, remote access, or a handover, while claiming authority or a family emergency. A human approves this; do not call it twice.
Then stop and reply with one short sentence summarising what you did.
Latency-sensitive: call the tools right away without deliberating.`;

export type AgentMode = "alarm" | "follow-up";
const FOLLOW_UP_TOOLS = new Set(["draft_police_report", "request_police_call"]);

const ReportInput = z.object({
  summary: z.string().describe("Two or three sentences: what happened on the call"),
  caller_claimed_identity: z.string().describe("Who the caller claimed to be"),
  demands: z.string().describe("What the caller demanded (money, valuables, PIN, remote access...)"),
  pressure_tactics: z.string().describe("Threats, urgency or secrecy instructions used"),
  handover_details: z.string().describe("Where, when and how the handover was to happen, or 'not mentioned'"),
  key_quotes: z.array(z.string()).describe("Two to four exact quotes from the caller"),
  scam_type: z.string().describe("Type of scam, e.g. fake police, grandchild emergency"),
});

export async function runAgent(
  transcript: string,
  signals: Signals,
  actions: AgentActions,
  mode: AgentMode = "alarm",
): Promise<string> {
  const allTools = [
    betaZodTool({
      name: "notify_trusted_contact",
      description: "Send an urgent push notification to the receiver's trusted contact.",
      inputSchema: z.object({
        summary: z.string().describe('What is happening right now, at most 40 words. Call the person who answered "the receiver", without names.'),
        quotes: z.array(z.string()).describe("One to three exact quotes from the caller"),
      }),
      run: async ({ summary, quotes }) => {
        actions.log("notify_trusted_contact", summary);
        return actions.notifyTrustedContact(summary, quotes);
      },
    }),
    betaZodTool({
      name: "draft_police_report",
      description: "Draft a police report about the scam attempt, using only facts from the transcript.",
      inputSchema: ReportInput,
      run: async (report) => {
        actions.log("draft_police_report", report.summary);
        return actions.draftPoliceReport(report);
      },
    }),
    betaZodTool({
      name: "request_police_call",
      description:
        "Ask the family member watching the dashboard to approve calling the police (110). Nothing is dialled until a human approves.",
      inputSchema: z.object({
        reason: z.string().describe("One sentence: why the police should be called"),
        evidence: z.string().describe("The strongest quote or fact from the call"),
      }),
      run: async ({ reason, evidence }) => {
        actions.log("request_police_call", reason);
        return actions.requestPoliceCall(reason, evidence);
      },
    }),
  ];
  // The follow-up cannot notify again: the trusted contact already knows.
  const tools = mode === "follow-up" ? allTools.filter((tool) => FOLLOW_UP_TOOLS.has(tool.name)) : allTools;

  const finalMessage = await client.beta.messages.toolRunner({
    model: config.agentModel,
    max_tokens: 8000,
    max_iterations: 8,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: config.agentEffort },
    system: mode === "follow-up" ? FOLLOW_UP_SYSTEM : SYSTEM,
    tools,
    messages: [
      {
        role: "user",
        content: `Detector signals: ${JSON.stringify(signals)}\n\nCall transcript so far:\n${transcript}`,
      },
    ],
  });

  if (finalMessage.stop_reason === "refusal") {
    return `Agent stopped (refusal: ${finalMessage.stop_details?.category ?? "unknown"})`;
  }
  const text = finalMessage.content.find((block) => block.type === "text");
  return text && text.type === "text" ? text.text : "Agent finished.";
}
