// Replays labelled calls turn by turn through the real scorer and the real level
// rules (levelFor + escalate), without the agent or any notifications.
//
//   npm run eval                                  # both datasets, both modes
//   npm run eval -- --limit 10 --only demo        # quick smoke run
//   npm run eval -- --mode caller                 # caller turns only
//   EVAL_CONCURRENCY=8 npm run eval               # parallel calls (default 6)
//   SCORER_MODEL=claude-haiku-5-5 npm run eval -- --out eval/results-haiku.json
//                                                 # compare a model without replacing the dashboard numbers
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../server/config.js";
import { toRole, type Role } from "../server/hub.js";
import { escalate, levelFor, scoreCall, type Level, type Turn } from "../server/scorer.js";

interface LabelledCall {
  id: string;
  title: string;
  label: "scam" | "normal";
  money_turn: number | null; // 0-based index into turns of the first money request
  turns: { role: Role; text: string }[];
}

type DatasetName = "dataset" | "demo";
type Mode = "full" | "caller";

interface CallResult {
  id: string;
  label: "scam" | "normal";
  maxLevel: Level;
  alarmTurn: number | null; // original turn index where the level first became scam
  moneyTurn: number | null;
  lead: number | null; // moneyTurn - alarmTurn: > 0 means warned before the money request
  scoredTurns: number;
  errors: number;
  latencies: number[];
  callerFirst: boolean; // the caller is "Speaker 1"
  rolesAfter2: boolean | null; // caller identified correctly after the caller's 2nd turn (full mode)
  rolesFinal: boolean | null; // ... at the last scored turn (full mode)
}

const FILES: Record<DatasetName, string> = { dataset: "dataset.json", demo: "demo-scripts.json" };

function parseArgs(argv: string[]) {
  const options = {
    limit: Infinity,
    only: null as DatasetName | null,
    modes: ["full", "caller"] as Mode[],
    out: "../public/eval-results.json",
  };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    if (argv[i] === "--limit") options.limit = Number(value);
    else if (argv[i] === "--out") options.out = value;
    else if (argv[i] === "--only") options.only = value as DatasetName;
    else if (argv[i] === "--mode") options.modes = value === "both" ? ["full", "caller"] : [value as Mode];
    else continue;
    i++;
  }
  if (!Number.isFinite(options.limit) && options.limit !== Infinity) throw new Error("--limit needs a number");
  if (options.only && !(options.only in FILES)) throw new Error("--only must be dataset or demo");
  if (options.modes.some((m) => m !== "full" && m !== "caller")) throw new Error("--mode must be full, caller or both");
  return options;
}

async function load(name: DatasetName): Promise<LabelledCall[]> {
  const raw = JSON.parse(await readFile(new URL(FILES[name], import.meta.url), "utf8")) as LabelledCall[];
  // The files keep their "grandma" role value; in code it is the receiver.
  return raw.map((call) => ({ ...call, turns: call.turns.map((turn) => ({ ...turn, role: toRole(turn.role) })) }));
}

// Keeps scams and normal calls balanced when --limit is used.
function sample(calls: LabelledCall[], limit: number): LabelledCall[] {
  if (limit >= calls.length) return calls;
  const scams = calls.filter((c) => c.label === "scam");
  const normals = calls.filter((c) => c.label === "normal");
  return [...scams.slice(0, Math.ceil(limit / 2)), ...normals.slice(0, Math.floor(limit / 2))];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function scoreWithRetry(turns: Turn[]) {
  try {
    return await scoreCall(turns);
  } catch {
    await sleep(1000);
    return await scoreCall(turns);
  }
}

// Deterministic, roughly half of the calls: hash of the call id.
function callerFirstVariant(id: string): boolean {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 2 === 0;
}

async function evaluateCall(call: LabelledCall, mode: Mode): Promise<CallResult> {
  // Keep each turn's original index so money_turn still lines up after filtering.
  let indexed = call.turns.map((turn, index) => ({ ...turn, index }));
  if (mode === "caller") {
    indexed = indexed.filter((turn) => turn.role === "caller");
  } else if (callerFirstVariant(call.id) && indexed[0]?.role === "receiver" && indexed[0].text.split(/\s+/).length <= 3) {
    // Drop the receiver's "Hello." so the caller speaks first: speaking order must not give the roles away.
    indexed = indexed.slice(1);
  }
  // Speakers are numbered by first appearance, as in the live pipeline.
  const order: string[] = [];
  const turns = indexed.map((turn) => {
    if (!order.includes(turn.role)) order.push(turn.role);
    return { ...turn, speaker: `Speaker ${order.indexOf(turn.role) + 1}` };
  });
  const callerNumber = String(order.indexOf("caller") + 1);
  let lastCaller: string | null = null;
  let callerTurns = 0;
  let rolesAfter2: boolean | null = null;

  let level: Level = "safe";
  let alarmTurn: number | null = null;
  let errors = 0;
  let scoredTurns = 0;
  const latencies: number[] = [];

  for (let i = 0; i < turns.length; i++) {
    const prefix = turns.slice(0, i + 1).map(({ speaker, text }) => ({ speaker, text }));
    if (turns[i].role === "caller") callerTurns++;
    try {
      const result = await scoreWithRetry(prefix);
      latencies.push(result.latencyMs);
      level = escalate(level, levelFor(result.signals));
      lastCaller = result.signals.caller_speaker;
      if (callerTurns === 2 && turns[i].role === "caller") rolesAfter2 = lastCaller === callerNumber;
    } catch {
      errors++; // keep the previous level, as the live pipeline does
    }
    scoredTurns++;
    if (level === "scam") {
      alarmTurn = turns[i].index;
      break; // the level can never go back down, so the rest of the call changes nothing
    }
  }

  const lead = alarmTurn !== null && call.money_turn !== null ? call.money_turn - alarmTurn : null;
  // Caller-only transcripts have one speaker, so there is nothing to identify.
  const full = mode === "full";
  return {
    id: call.id,
    label: call.label,
    maxLevel: level,
    alarmTurn,
    moneyTurn: call.money_turn,
    lead,
    scoredTurns,
    errors,
    latencies,
    callerFirst: turns[0]?.role === "caller",
    rolesAfter2: full ? rolesAfter2 : null,
    rolesFinal: full && lastCaller !== null ? lastCaller === callerNumber : null,
  };
}

async function pool<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const percentile = (values: number[], p: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

function summarise(dataset: DatasetName, mode: Mode, results: CallResult[]) {
  const scams = results.filter((r) => r.label === "scam");
  const normals = results.filter((r) => r.label === "normal");
  const leads = scams.map((r) => r.lead).filter((lead): lead is number => lead !== null);
  const latencies = results.flatMap((r) => r.latencies);
  const share = (rows: CallResult[], pick: (r: CallResult) => boolean | null) => {
    const known = rows.map(pick).filter((v): v is boolean => v !== null);
    return known.length ? { correct: known.filter(Boolean).length, total: known.length } : null;
  };
  return {
    dataset,
    mode,
    scams: scams.length,
    normals: normals.length,
    detected: scams.filter((r) => r.maxLevel === "scam").length,
    // Scams where the caller actually got to a money request (money_turn set).
    scamsWithDemand: scams.filter((r) => r.moneyTurn !== null).length,
    detectedWithDemand: scams.filter((r) => r.moneyTurn !== null && r.maxLevel === "scam").length,
    falseAlarms: normals.filter((r) => r.maxLevel === "scam").length,
    cautionOnNormal: normals.filter((r) => r.maxLevel !== "safe").length,
    leadMedian: percentile(leads, 50),
    leadMin: percentile(leads, 0),
    leadCount: leads.length,
    warnedBeforeMoney: leads.filter((lead) => lead > 0).length,
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    // Caller identification (full mode only): after the caller's 2nd turn and at the end.
    rolesAfter2: share(results, (r) => r.rolesAfter2),
    rolesFinal: share(results, (r) => r.rolesFinal),
    rolesFinalCallerFirst: share(results.filter((r) => r.callerFirst), (r) => r.rolesFinal),
    rolesFinalReceiverFirst: share(results.filter((r) => !r.callerFirst), (r) => r.rolesFinal),
    scorerCalls: results.reduce((sum, r) => sum + r.scoredTurns, 0),
    errors: results.reduce((sum, r) => sum + r.errors, 0),
    missed: scams.filter((r) => r.maxLevel !== "scam").map((r) => r.id),
    falseAlarmIds: normals.filter((r) => r.maxLevel === "scam").map((r) => r.id),
  };
}

type Summary = ReturnType<typeof summarise>;

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "-");
const secs = (ms: number | null) => (ms === null ? "-" : `${(ms / 1000).toFixed(1)}s`);
const frac = (s: { correct: number; total: number } | null) => (s ? `${s.correct}/${s.total}` : "-");
const signed = (n: number | null) => (n === null ? "-" : `${n > 0 ? "+" : ""}${n}`);

function printTable(runs: Summary[]) {
  const rows = runs.map((r) => [
    r.dataset,
    r.mode,
    `${r.detected}/${r.scams} (${pct(r.detected, r.scams)}), ${r.detectedWithDemand}/${r.scamsWithDemand} w/ demand`,
    `${r.falseAlarms}/${r.normals} (${pct(r.falseAlarms, r.normals)})`,
    `${r.cautionOnNormal}/${r.normals}`,
    `${signed(r.leadMedian)} / ${signed(r.leadMin)}`,
    `${r.warnedBeforeMoney}/${r.leadCount}`,
    `${secs(r.latencyP50)} / ${secs(r.latencyP95)}`,
    r.rolesAfter2 || r.rolesFinal ? `${frac(r.rolesAfter2)} / ${frac(r.rolesFinal)}` : "-",
    String(r.errors),
  ]);
  const header = ["dataset", "mode", "scams caught", "false alarms", "normal>=caution", "lead med/min", "before money", "latency p50/p95", "caller id 2nd/end", "errors"];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(`\n${line(header)}\n${widths.map((w) => "-".repeat(w)).join("  ")}`);
  for (const row of rows) console.log(line(row));
  for (const r of runs) {
    if (r.rolesFinal) {
      console.log(`\n${r.dataset}/${r.mode} caller id at end: caller spoke first ${frac(r.rolesFinalCallerFirst)}, receiver spoke first ${frac(r.rolesFinalReceiverFirst)}`);
    }
    if (r.missed.length) console.log(`\n${r.dataset}/${r.mode} missed scams: ${r.missed.join(", ")}`);
    if (r.falseAlarmIds.length) console.log(`${r.dataset}/${r.mode} false alarms: ${r.falseAlarmIds.join(", ")}`);
  }
  console.log("\nlead = money-request turn minus alarm turn; positive means the alarm came before the money request.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!config.anthropicKeySet) throw new Error("ANTHROPIC_API_KEY is not set (.env)");
  const concurrency = Math.max(1, Number(process.env.EVAL_CONCURRENCY) || 6);
  const datasets: DatasetName[] = options.only ? [options.only] : ["dataset", "demo"];
  console.log(
    `Scorer ${config.scorerModel} (effort ${config.scorerEffort}), thresholds scam ${config.scamThreshold} / caution ${config.cautionThreshold}, concurrency ${concurrency}`,
  );

  const runs: Summary[] = [];
  for (const dataset of datasets) {
    const calls = sample(await load(dataset), options.limit);
    for (const mode of options.modes) {
      let done = 0;
      const started = Date.now();
      const results = await pool(calls, concurrency, async (call) => {
        const result = await evaluateCall(call, mode);
        done++;
        const outcome = result.maxLevel === "scam" ? `ALARM@${result.alarmTurn}` : result.maxLevel;
        const ok = (result.label === "scam") === (result.maxLevel === "scam") ? "ok " : "XX ";
        process.stdout.write(`  [${dataset}/${mode} ${done}/${calls.length}] ${ok}${call.label.padEnd(6)} ${outcome.padEnd(9)} ${call.id}\n`);
        return result;
      });
      const summary = summarise(dataset, mode, results);
      runs.push(summary);
      console.log(`  ${dataset}/${mode}: ${summary.scorerCalls} scorer calls in ${Math.round((Date.now() - started) / 1000)}s`);
    }
  }

  printTable(runs);
  const output = {
    generatedAt: new Date().toISOString(),
    model: config.scorerModel,
    effort: config.scorerEffort,
    thresholds: { scam: config.scamThreshold, caution: config.cautionThreshold },
    limit: Number.isFinite(options.limit) ? options.limit : null,
    runs,
  };
  // --out is relative to the current directory; the default feeds the dashboard tile.
  const target = options.out === "../public/eval-results.json"
    ? new URL(options.out, import.meta.url)
    : pathToFileURL(resolve(options.out));
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`\nWrote ${target.pathname}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
