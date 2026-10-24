// Loads .env (Node 21.7+) before anything reads process.env.
try {
  process.loadEnvFile();
} catch {
  // No .env yet: keys can still come from the shell environment.
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

function num(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && process.env[name] !== "" ? value : fallback;
}

export const config = {
  port: num("PORT", 3000),
  reson8ApiKey: process.env.RESON8_API_KEY ?? "",
  anthropicKeySet: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  // Haiku for the per-sentence scorer: same accuracy as Opus on the eval, ~1 s faster.
  scorerModel: process.env.SCORER_MODEL || "claude-haiku-5-5",
  scorerEffort: (process.env.SCORER_EFFORT || "low") as Effort,
  agentModel: process.env.AGENT_MODEL || "claude-opus-5-5",
  agentEffort: (process.env.AGENT_EFFORT || "low") as Effort,
  language: process.env.CALL_LANGUAGE || "en",
  ntfyServer: process.env.NTFY_SERVER || "https://ntfy.sh",
  ntfyFamilyTopic: process.env.NTFY_FAMILY_TOPIC ?? "",
  ntfyPhoneTopic: process.env.NTFY_PHONE_TOPIC ?? "",
  scamThreshold: num("SCAM_THRESHOLD", 0.8),
  cautionThreshold: num("CAUTION_THRESHOLD", 0.5),
};
