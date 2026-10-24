// The fast "reflex" layer: after every sentence, Claude re-reads the call so far
// and returns scam signals as strict JSON (structured outputs).
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { config } from "./config.js";

const client = new Anthropic();

export const SCAM_TYPES = [
  "none",
  "fake_police",
  "relative_emergency",
  "fake_bank",
  "tech_support",
  "government_or_tax",
  "prize_or_lottery",
  "romance_or_investment",
  "other",
] as const;

export const CALLER_SPEAKERS = ["unknown", "1", "2"] as const;

const SignalsSchema = z.object({
  risk: z.number(),
  claims_authority: z.number(),
  asks_money: z.number(),
  pressure: z.number(),
  secrecy: z.number(),
  scam_type: z.enum(SCAM_TYPES),
  reason: z.string(),
  warning: z.string(),
  caller_speaker: z.enum(CALLER_SPEAKERS),
});

export type Signals = z.infer<typeof SignalsSchema>;
export type Level = "safe" | "caution" | "scam";

// Speakers are numbered by first appearance ("Speaker 1", "Speaker 2"); the
// scorer decides from the content which of them is the caller.
export interface Turn {
  speaker: string;
  text: string;
}

export interface ScoreResult {
  signals: Signals;
  latencyMs: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const probability = (description: string) => ({ type: "number", description });

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    risk: probability("0 to 1: probability that this call is a scam attempt"),
    claims_authority: probability(
      "0 to 1: the caller presents as police, prosecutor, court, bank, tax office, government, tech support, or a relative in trouble",
    ),
    asks_money: probability(
      "0 to 1: the caller asks for money, cash, gold, jewelry, gift cards, crypto, a transfer, card details, PINs, passwords, remote access, or a handover of valuables",
    ),
    pressure: probability("0 to 1: the caller creates fear, panic, or urgency"),
    secrecy: probability(
      "0 to 1: the caller says to keep it secret, not to tell family or the bank, or not to hang up",
    ),
    scam_type: { type: "string", enum: [...SCAM_TYPES] },
    reason: { type: "string", description: "At most 12 words: the main evidence, quoting the caller if possible" },
    warning: {
      type: "string",
      description:
        "Empty string when risk is below 0.5. Otherwise the warning shown on the receiver's screen (the person who answered): at most 25 words, calm plain language, specific to what this caller is pretending (e.g. real police never collect cash or tell you to keep secrets), ending with telling them to hang up. Never say that a trusted contact, family or the police have already been told.",
    },
    caller_speaker: {
      type: "string",
      enum: [...CALLER_SPEAKERS],
      description:
        "Which numbered speaker is the CALLER (the one who phoned in), or unknown if the content does not make it clear yet",
    },
  },
  required: ["risk", "claims_authority", "asks_money", "pressure", "secrecy", "scam_type", "reason", "warning", "caller_speaker"],
  additionalProperties: false,
};

const SYSTEM = `You are the scam detector inside Schutzengel, a guardian for older people's phone calls.
You read the transcript of a phone call that is still in progress and judge, from everything said so far, whether the CALLER is trying to scam the receiver (the person who answered).

Speakers are numbered by automatic speaker separation in order of first appearance; the numbers say nothing about who called. Decide from the content who is the caller: the caller typically introduces themselves ("this is Detective...", "it's Max"), asks for the person by name ("am I speaking with Mrs. Schneider?") and drives the conversation; the person who answered says things like "Hello?", "speaking", "who is this?". Either of them may speak first. Answer caller_speaker "unknown" until the content makes it clear. A line may be labelled "Unknown speaker" when separation failed.

Scam patterns to recognise include: fake police or prosecutors who want to "protect" savings or valuables, a grandchild or relative in an emergency who urgently needs money, a fake bank fraud department asking for PINs or card pickup, fake tech support asking for remote access or payment, fake tax or government officials threatening arrest, prizes that require a fee, and romance or investment pitches.

Calibration:
- Ordinary calls (family, friends, doctors, deliveries, the person's real bank) with no request for money, credentials, remote access or secrecy stay below 0.2.
- Money talk alone is not a scam when the context is ordinary, such as a grandson saying he will pay back a train ticket.
- Go above 0.8 only when several signals combine, such as an authority claim plus pressure plus a request for money or valuables.
- Score what has been said so far. Early in a scam, before any request, risk should be moderate rather than high.`;

const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export async function scoreCall(turns: Turn[]): Promise<ScoreResult> {
  const transcript = turns.map((turn) => `${turn.speaker}: ${turn.text}`).join("\n");
  const started = performance.now();

  const response = await client.beta.messages.create({
    model: config.scorerModel,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: config.scorerEffort,
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    system: SYSTEM,
    messages: [{ role: "user", content: `Call transcript so far:\n${transcript}` }],
  });

  const latencyMs = Math.round(performance.now() - started);
  if (response.stop_reason === "refusal") {
    throw new Error(`scorer refused: ${response.stop_details?.category ?? "unknown category"}`);
  }
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error(`scorer returned no text (stop: ${response.stop_reason})`);

  const parsed = SignalsSchema.parse(JSON.parse(text.text));
  return {
    signals: {
      ...parsed,
      risk: clamp(parsed.risk),
      claims_authority: clamp(parsed.claims_authority),
      asks_money: clamp(parsed.asks_money),
      pressure: clamp(parsed.pressure),
      secrecy: clamp(parsed.secrecy),
    },
    latencyMs,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// Used when the alarm score carries no usable warning text.
export const FALLBACK_WARNINGS: Record<(typeof SCAM_TYPES)[number], string> = {
  none: "This call has the signs of a scam. Do not give money, details or valuables to anyone. Hang up now.",
  other: "This call has the signs of a scam. Do not give money, details or valuables to anyone. Hang up now.",
  fake_police: "This is not the police. Real police never collect cash or valuables or ask you to keep secrets. Hang up now.",
  relative_emergency:
    "This may not be your family. Never send money to an emergency call. Hang up and call your family on their usual number.",
  fake_bank: "Your bank never asks for your PIN, card or a pickup at your door. Hang up and call the number on your card.",
  tech_support: "Real companies never call to fix your computer. Do not install anything or pay. Hang up now.",
  government_or_tax:
    "Tax offices and authorities never demand payment or threaten arrest by phone. Do not pay anything. Hang up now.",
  prize_or_lottery: "Real prizes never cost a fee. Do not pay or share any details. Hang up now.",
  romance_or_investment: "Never send money to someone on the phone you have not met. This looks like a scam. Hang up now.",
};

const MAX_WARNING_WORDS = 40;

// The warning written by the scorer, or a fixed one for the scam type.
export function warningFor(signals: Signals): string {
  const text = signals.warning.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return text && words <= MAX_WARNING_WORDS ? text : FALLBACK_WARNINGS[signals.scam_type];
}

// A warning needs a high overall risk plus a concrete ask (or secrecy), so a
// scary-sounding but harmless call does not trip the alarm on its own.
export function levelFor(signals: Signals): Level {
  const concreteAsk = signals.asks_money >= 0.6 || signals.secrecy >= 0.6;
  if (signals.risk >= config.scamThreshold && (concreteAsk || signals.risk >= 0.92)) return "scam";
  if (signals.risk >= config.cautionThreshold) return "caution";
  return "safe";
}

const ORDER: Level[] = ["safe", "caution", "scam"];

// During a call the level only goes up: one calm sentence does not undo a scam.
export function escalate(current: Level, next: Level): Level {
  return ORDER.indexOf(next) > ORDER.indexOf(current) ? next : current;
}
