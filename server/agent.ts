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
  warnGrandma(message: string): Promise<string>;
  notifyFamily(summary: string, quotes: string[]): Promise<string>;
  draftPoliceReport(report: PoliceReport): Promise<string>;
  requestPoliceCall(reason: string, evidence: string): Promise<string>;
  log(tool: string, detail: string): void;
}

const SYSTEM = `You are Schutzengel, a guardian angel that protects Erika, 78, during phone calls. She lives alone; her daughter is Lena.
The live scam detector has just flagged the current call. Act immediately, in this order:
1. warn_grandma: one calm, plain-language warning she can read and hear (at most 25 words). Name what the caller is doing and tell her to hang up. Example: "This is a scam. Real police never collect money or jewelry. Hang up now. Lena has been told."
2. notify_family: tell Lena what is happening, quoting the caller's key words.
3. draft_police_report: a factual report from the transcript only. Write "not mentioned" for anything not said. Never invent names, numbers or addresses.
4. request_police_call: only if the caller demanded money, valuables, card details/PINs, remote access, or a handover, while claiming authority or a family emergency. A human approves this; do not call it twice.
Then stop and reply with one short sentence summarising what you did.
Latency-sensitive: Erika may be about to hand over her savings, so call the tools right away without deliberating.`;

const ReportInput = z.object({
  summary: z.string().describe("Two or three sentences: what happened on the call"),
  caller_claimed_identity: z.string().describe("Who the caller claimed to be"),
  demands: z.string().describe("What the caller demanded (money, valuables, PIN, remote access...)"),
  pressure_tactics: z.string().describe("Threats, urgency or secrecy instructions used"),
  handover_details: z.string().describe("Where, when and how the handover was to happen, or 'not mentioned'"),
  key_quotes: z.array(z.string()).describe("Two to four exact quotes from the caller"),
  scam_type: z.string().describe("Type of scam, e.g. fake police, grandchild emergency"),
});

export async function runAgent(transcript: string, signals: Signals, actions: AgentActions): Promise<string> {
  const tools = [
    betaZodTool({
      name: "warn_grandma",
      description: "Show and read out a short warning on Erika's phone, on top of the call.",
      inputSchema: z.object({ message: z.string().describe("At most 25 words, plain language") }),
      run: async ({ message }) => {
        actions.log("warn_grandma", message);
        return actions.warnGrandma(message);
      },
    }),
    betaZodTool({
      name: "notify_family",
      description: "Send an urgent push notification to Erika's daughter Lena.",
      inputSchema: z.object({
        summary: z.string().describe("What is happening right now, at most 40 words"),
        quotes: z.array(z.string()).describe("One to three exact quotes from the caller"),
      }),
      run: async ({ summary, quotes }) => {
        actions.log("notify_family", summary);
        return actions.notifyFamily(summary, quotes);
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

  const finalMessage = await client.beta.messages.toolRunner({
    model: config.agentModel,
    max_tokens: 8000,
    max_iterations: 8,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: config.agentEffort },
    system: SYSTEM,
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
