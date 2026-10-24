import express from "express";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { BUILD_ID, hub } from "./hub.js";
import { addSegment, decideApproval, hangUp, swapRoles } from "./pipeline.js";
import { HttpError, reson8Session } from "./reson8.js";
import { loadScripts, replay, stopReplay } from "./replay.js";

const app = express();
app.use(express.json());
app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));

app.get("/phone", (_req, res) => res.redirect("/phone.html"));

app.get("/api/config", (_req, res) => {
  res.json({
    // Bumped when the dashboard needs newer server behaviour (2: "receiver" role, caller identification).
    protocol: 2,
    buildId: BUILD_ID,
    reson8: Boolean(config.reson8ApiKey),
    anthropic: config.anthropicKeySet,
    familyPush: Boolean(config.ntfyFamilyTopic),
    phonePush: Boolean(config.ntfyPhoneTopic),
    scorerModel: config.scorerModel,
    agentModel: config.agentModel,
    language: config.language,
  });
});

app.get("/api/events", (_req, res) => hub.attach(res));

app.get("/api/reson8/session", async (_req, res) => {
  try {
    res.json(await reson8Session());
  } catch (err) {
    res.status(err instanceof HttpError ? err.status : 500).json({ error: (err as Error).message });
  }
});

app.post("/api/segment", (req, res) => {
  const { speakerId, text } = req.body as { speakerId?: number | null; text?: string };
  if (typeof text !== "string") return void res.status(400).json({ error: "text is required" });
  const segment = addSegment(typeof speakerId === "number" ? speakerId : null, text);
  res.json({ ok: true, segment });
});

app.post("/api/reset", (_req, res) => {
  stopReplay();
  res.json({ ok: true, callId: hub.reset().id });
});

app.post("/api/roles/swap", (_req, res) => {
  swapRoles();
  res.json({ ok: true });
});

app.get("/api/scripts", async (_req, res) => {
  const scripts = await loadScripts();
  res.json(scripts.map(({ id, title, label }) => ({ id, title, label })));
});

app.post("/api/replay", async (req, res) => {
  const ok = await replay(String((req.body as { id?: string }).id ?? ""));
  res.status(ok ? 200 : 404).json({ ok });
});

app.post("/api/approval/:id", async (req, res) => {
  const ok = await decideApproval(req.params.id, Boolean((req.body as { approve?: boolean }).approve));
  res.status(ok ? 200 : 409).json({ ok });
});

app.post("/api/hangup", (_req, res) => {
  hangUp();
  res.json({ ok: true });
});

hub.startHeartbeat();
app.listen(config.port, () => {
  console.log(`Schutzengel running:  dashboard http://localhost:${config.port}   phone http://localhost:${config.port}/phone`);
  if (!config.reson8ApiKey) console.warn("RESON8_API_KEY missing: live listening is disabled (replay still works).");
  if (!config.anthropicKeySet) console.warn("ANTHROPIC_API_KEY missing: scoring and the agent will fail.");
});
