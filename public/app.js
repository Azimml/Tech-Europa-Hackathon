// Schutzengel dashboard: tells the live call from /api/events as a story (status,
// conversation, receiver's screen, what Claude does), listens to the laptop
// microphone through Reson8, and sounds one alarm tone per scam call.

const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const SIGNALS = [
  ["claims_authority", "Authority"],
  ["asks_money", "Money ask"],
  ["pressure", "Pressure"],
  ["secrecy", "Secrecy"],
];
const LIT_AT = 0.6;
const WHO = { caller: "Caller", receiver: "Receiver" };
const EXPECTED_PROTOCOL = 2; // server protocol this page needs (see /api/config)

// Servers from before the rename still send "grandma" for the receiver.
const normRole = (role) => (role === "grandma" ? "receiver" : role);

// ---------------------------------------------------------------------------
// Call state: replaced on "state", patched by every other event.

let call = null;
let connected = false;
let loadedBuild = null; // server build this page first saw
let screens = 0;
let interim = null; // { speakerId, text } while Reson8 is still hearing a sentence

// A different build id means the server restarted (possibly with new code):
// reload once so this tab never keeps running stale code.
function checkBuild(buildId) {
  if (!buildId) return false;
  if (loadedBuild === null) loadedBuild = buildId;
  if (buildId === loadedBuild || sessionStorage.getItem("schutzengel-reloaded-for") === buildId) return false;
  sessionStorage.setItem("schutzengel-reloaded-for", buildId);
  location.reload();
  return true;
}

function apply(event) {
  if (event.type === "state") {
    if (checkBuild(event.buildId)) return;
    if (typeof event.screens === "number") screens = event.screens;
    const isNewCall = !call || call.id !== event.call.id;
    call = event.call;
    call.speakers ??= [];
    call.roles = Object.fromEntries(Object.entries(call.roles ?? {}).map(([key, role]) => [key, normRole(role)]));
    for (const segment of call.segments) segment.role = normRole(segment.role);
    if (isNewCall) {
      interim = null;
      selectedStep = null;
      shownSteps = "";
    }
    // Joining a call that already raised its alarm: show it, stay silent.
    if (call.alertAt !== null) alarmPlayedFor = call.id;
    return;
  }
  if (!call) return;
  switch (event.type) {
    case "segment": {
      event.segment.role = normRole(event.segment.role);
      call.segments.push(event.segment);
      const key = keyOf(event.segment.speakerId);
      if (key !== null && !call.speakers.includes(key)) call.speakers.push(key);
      // The server may assign a newly heard voice its role on arrival (the other
      // role is already known), so the line carries the up-to-date role.
      if (key !== null && event.segment.role !== "unknown") call.roles[key] = event.segment.role;
      break;
    }
    case "score":
      call.scores.push(event.score);
      call.level = event.score.level;
      break;
    case "alarm":
      // One warning per call: a second alarm never replaces or repeats it.
      if (call.warning) break;
      call.warning = event.warning;
      call.reactionMs = event.reactionMs;
      call.alertAt ??= Date.now();
      alarmOnce();
      break;
    case "roles":
      note(
        event.source === "manual"
          ? "Speakers set manually"
          : `Caller identified by Claude: ${event.caller}`,
      );
      break;
    case "agent":
      call.agent.status = event.status;
      call.agent.steps.push(event.step);
      break;
    case "family":
      call.family = event.family;
      break;
    case "report":
      call.report = event.report;
      break;
    case "approval":
      call.approval = event.approval;
      break;
    case "hangup":
      call.hungUp = true;
      break;
    case "error":
      toast(`${event.where ?? "server"}: ${event.message}`);
      break;
    case "screens":
      screens = event.count;
      break;
  }
}

function connect() {
  const source = new EventSource("/api/events");
  source.onmessage = (message) => {
    const event = JSON.parse(message.data);
    if (event.type === "state") connected = true;
    apply(event);
    render();
  };
  // EventSource reconnects by itself; the server answers with a fresh snapshot.
  source.onerror = () => {
    connected = false;
    renderConnection();
  };
}

// ---------------------------------------------------------------------------
// Rendering

function render() {
  renderConnection();
  renderScreens();
  if (!call) return;
  document.body.className = `level-${call.level}`;
  const states = stepStates();
  renderStatus();
  renderTranscript();
  renderPhone();
  renderSignals();
  renderTracker(states);
  renderDetails(visibleStep(states));
  renderAgentLog();
  renderMetrics();
}

function renderConnection() {
  $("conn").hidden = connected;
}

const keyOf = (speakerId) => (speakerId === null || speakerId === undefined ? null : String(speakerId));
// Claude sometimes wraps quotes in quote marks itself; we add our own.
const unquote = (text) => String(text ?? "").replace(/^["“”']+|["“”']+$/g, "");
const seconds = (ms) => (ms === null || ms === undefined ? "–" : `${(ms / 1000).toFixed(1)} s`);
const clock = (at) => (at ? new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");

function renderStatus() {
  const last = call.scores.at(-1);
  const risk = last?.signals.risk ?? 0;
  $("risk-fill").style.width = `${Math.round(risk * 100)}%`;
  $("risk-value").textContent = risk.toFixed(2);
  $("level").textContent = call.level.toUpperCase();
  const type = last?.signals.scam_type;
  $("scam-type").textContent = type && type !== "none" ? type.replaceAll("_", " ") : "";
  $("reason").textContent = last ? `“${unquote(last.signals.reason)}”` : "";
  $("reaction").textContent =
    call.reactionMs !== null && call.reactionMs !== undefined
      ? `Alarm ${seconds(call.reactionMs)} after the triggering sentence`
      : "";
}

// Two people on a call: once one of them is the Caller, everyone else is the
// Receiver, whatever role the line arrived with. Until then "Speaker N" by first
// appearance, and "Speaker ?" for a voice without speaker separation.
function callerKey() {
  const fromRoles = Object.keys(call.roles).find((key) => call.roles[key] === "caller");
  if (fromRoles !== undefined) return fromRoles;
  const segment = call.segments.find((s) => s.role === "caller" && keyOf(s.speakerId) !== null);
  return segment ? keyOf(segment.speakerId) : null;
}

function speakerName(speakerId) {
  const key = keyOf(speakerId);
  if (key === null) return { role: "unknown", name: "Speaker ?" };
  const caller = callerKey();
  if (caller !== null) {
    const role = key === caller ? "caller" : "receiver";
    return { role, name: WHO[role] };
  }
  // No caller yet, but the operator may have set Speaker 1 = Receiver.
  if (call.roles[key] === "receiver") return { role: "receiver", name: WHO.receiver };
  const index = call.speakers.indexOf(key);
  return { role: "unknown", name: index >= 0 ? `Speaker ${index + 1}` : "Speaker ?" };
}

const IDLE = `<li class="idle">
  <div>Waiting for a call. Press <b>Listen</b>, or pick a replay.</div>
  <div class="pipeline">
    <span class="node">Microphone</span><span>→</span>
    <span class="node">Reson8 speech-to-text</span><span>→</span>
    <span class="node">Claude reads every sentence</span><span>→</span>
    <span class="node">Receiver &amp; trusted contact</span>
  </div>
  <div class="idle-hint">Speakers show as "Speaker 1 / 2" until Claude works out who is calling.</div>
</li>`;

function renderTranscript() {
  const list = $("transcript");
  const line = (speakerId, text, extra = "") => {
    const { role, name } = speakerName(speakerId);
    return `<li class="${role}${extra}"><span class="who">${name}:</span>${esc(text)}</li>`;
  };
  const lines = call.segments.map((s) => line(s.speakerId, s.text));
  if (interim?.text) lines.push(line(interim.speakerId, interim.text, " interim"));
  list.innerHTML = lines.length ? lines.join("") : IDLE;
  list.scrollTop = list.scrollHeight;
}

function renderPhone() {
  $("phone").className = `phone phone-${call.level}`;
  $("phone-label").textContent = { safe: "Protected", caution: "Be careful", scam: "SCAM CALL" }[call.level];
  const text = call.level === "scam" ? (call.warning ?? "") : call.level === "caution" ? "This call has warning signs." : "";
  if ($("phone-warning").textContent !== text) $("phone-warning").textContent = text;
  fitPhone();
}

// The warning starts large and shrinks 1 px at a time until it fits between the
// label and the "Hang up" bar, never below 11 px. Re-run when the phone resizes.
const MIN_WARNING_PX = 11;
function fitPhone() {
  const phone = $("phone");
  const body = $("phone-body");
  const text = $("phone-warning");
  phone.style.setProperty("--pw", `${phone.clientWidth}px`);
  if (!text.textContent) {
    text.style.fontSize = "";
    return;
  }
  const isScam = phone.classList.contains("phone-scam");
  let size = Math.max(MIN_WARNING_PX, Math.min(isScam ? 40 : 20, Math.floor(body.clientWidth / 7)));
  text.style.fontSize = `${size}px`;
  while (size > MIN_WARNING_PX && (body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1)) {
    size -= 1;
    text.style.fontSize = `${size}px`;
  }
}
new ResizeObserver(() => requestAnimationFrame(fitPhone)).observe(document.getElementById("phone"));

function renderSignals() {
  const last = call.scores.at(-1);
  $("signals").innerHTML = SIGNALS.map(([key, name]) => {
    const value = last?.signals[key] ?? 0;
    // The quote stays with the score that first lit the signal, so the story builds up.
    const first = call.scores.find((s) => s.signals[key] >= LIT_AT);
    return `<div class="signal${first ? " lit" : ""}">
      <span class="name">${name}</span>
      <span class="bar-bg"><span class="bar-fg" style="width:${Math.round(value * 100)}%"></span></span>
      <span class="num">${value.toFixed(2)}</span>
      ${first ? `<span class="quote">${esc(unquote(first.signals.reason))}</span>` : ""}
    </div>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// "Claude acts": four steps derived from the call state.

const STEPS = [
  ["alarm", "Alarm"],
  ["contact", "Trusted contact alerted"],
  ["report", "Police report"],
  ["police", "Call 110?"],
];

const toolTimes = (tool) => call.agent.steps.filter((s) => s.kind === "tool" && s.tool === tool).map((s) => s.at);

function stepStates() {
  const drafts = toolTimes("draft_police_report");
  const approval = call.approval;
  const states = {
    alarm: call.alertAt
      ? { state: "done", sub: `tone · ${clock(call.alertAt)}` }
      : { state: "waiting", sub: "when the call turns into a scam" },
    contact: call.family
      ? { state: "done", sub: `${call.family.delivered ? "push sent" : "on dashboard"} · ${clock(toolTimes("notify_trusted_contact")[0])}` }
      : { state: "waiting", sub: "the caller's words, sent at once" },
    report: call.report
      ? { state: "done", sub: `${drafts.length > 1 ? "updated" : "drafted"} · ${clock(drafts.at(-1))}` }
      : { state: "waiting", sub: "facts from the transcript" },
    police: !approval
      ? { state: "waiting", sub: "only after a demand for money" }
      : approval.status === "pending"
        ? { state: "pending", sub: "needs a human decision" }
        : { state: "done", sub: approval.status === "approved" ? "approved (simulated)" : "declined" },
  };
  // While the agent works, the next unfinished step shows as in progress.
  if (call.agent.status === "running") {
    const next = ["contact", "report"].find((key) => states[key].state === "waiting");
    if (next) states[next] = { state: "active", sub: "Claude is working…" };
  }
  return states;
}

let selectedStep = null; // null: follow the latest completed step
let shownSteps = "";

function visibleStep(states) {
  const available = STEPS.map(([key]) => key).filter((key) => ["done", "pending"].includes(states[key].state));
  // Any step changing (new, or pending -> done) means: follow it again.
  const signature = available.map((key) => `${key}:${states[key].state}`).join();
  if (signature !== shownSteps) {
    shownSteps = signature;
    selectedStep = null;
  }
  return selectedStep && available.includes(selectedStep) ? selectedStep : (available.at(-1) ?? null);
}

function approvalButtons() {
  return `<div class="buttons"><button class="approve" data-approve="true">Approve</button><button data-approve="false">Decline</button></div>`;
}

function renderTracker(states) {
  const shown = visibleStep(states);
  $("tracker").innerHTML = STEPS.map(([key, title], index) => {
    const { state, sub } = states[key];
    const mark = state === "done" ? "✓" : state === "pending" ? "!" : state === "active" ? "" : String(index + 1);
    return `<li class="step ${state}${key === shown ? " selected" : ""}" data-step="${key}">
      <span class="mark">${mark}</span>
      <span class="title">${title}</span>
      <span class="sub">${esc(sub)}</span>
      ${state === "pending" ? approvalButtons() : ""}
    </li>`;
  }).join("");
}

function renderDetails(key) {
  const box = $("details");
  if (key === "alarm") {
    const last = call.scores.find((s) => s.level === "scam") ?? call.scores.at(-1);
    box.innerHTML = `<h3>Warning on the receiver's screen</h3>
      <div class="warning-text">${esc(call.warning)}</div>
      <div class="note">Alarm tone ${seconds(call.reactionMs)} after the sentence${last ? ` · Claude: “${esc(unquote(last.signals.reason))}”` : ""}</div>`;
  } else if (key === "contact") {
    const family = call.family;
    box.innerHTML = `<h3>Message to the trusted contact: “Scam call in progress”</h3>
      <div>${esc(family.summary)}</div>
      ${family.quotes.length ? `<ul class="quotes">${family.quotes.map((q) => `<li>“${esc(unquote(q))}”</li>`).join("")}</ul>` : ""}
      <div class="note">${family.delivered ? "Push notification delivered" : "Shown on this dashboard (no push channel in this demo)"}</div>`;
  } else if (key === "report") {
    const report = call.report;
    const rows = [
      ["Summary", report.summary],
      ["Claimed to be", report.caller_claimed_identity],
      ["Demands", report.demands],
      ["Pressure", report.pressure_tactics],
      ["Handover", report.handover_details],
      ["Scam type", report.scam_type],
    ];
    box.innerHTML = `<h3>Police report (draft)</h3>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <ul class="quotes">${report.key_quotes.map((q) => `<li>“${esc(unquote(q))}”</li>`).join("")}</ul>`;
  } else if (key === "police") {
    const approval = call.approval;
    const head = { pending: "Call the police (110)?", approved: "Approved: calling 110", declined: "Declined: police not called" }[approval.status];
    box.innerHTML = `<h3>${head}</h3>
      <div>${esc(approval.reason)}</div>
      <div class="evidence">“${esc(unquote(approval.evidence))}”</div>
      ${approval.status === "pending" ? approvalButtons() : ""}
      <div class="note">${approval.status === "approved" ? "Simulated in this demo: nothing is dialled." : "Nothing is dialled until a human approves."}</div>`;
  } else {
    box.innerHTML = `<p class="muted">When a call turns into a scam, Claude sounds the alarm, alerts the trusted contact, drafts a police report and asks a human before calling 110. Each step appears here.</p>`;
  }
}

function renderAgentLog() {
  const pill = $("agent-status");
  pill.textContent = call.agent.status;
  pill.className = `pill ${call.agent.status}`;
  $("agent-steps").innerHTML =
    call.agent.steps
      .map((step) => {
        if (step.kind === "tool") return `<li><span class="tool">${esc(step.tool)}</span>${esc(step.detail)}</li>`;
        if (step.kind === "error") return `<li class="error">Error: ${esc(step.detail)}</li>`;
        return `<li class="muted">${esc(step.detail)}</li>`;
      })
      .join("") || `<li class="muted">Starts automatically when a scam is detected.</li>`;
}

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

function renderMetrics() {
  const latencies = call.scores.map((s) => s.latencyMs);
  $("m-latency").textContent = seconds(latencies.at(-1));
  $("m-median").textContent = seconds(median(latencies));
  renderScreens();
}

function renderScreens() {
  $("screens").textContent = `${screens} screen${screens === 1 ? "" : "s"} connected${loadedBuild ? ` · build ${loadedBuild.slice(-4)}` : ""}`;
  $("screens-tile").classList.toggle("warn", screens > 1);
}

let noteTimer = null;
function note(text) {
  const box = $("roles-note");
  box.textContent = text;
  box.hidden = false;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => (box.hidden = true), 5000);
}

let toastTimer = null;
function toast(text) {
  const box = $("toast");
  box.textContent = text;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.hidden = true), 6000);
}

// ---------------------------------------------------------------------------
// Alarm tone: one short beep pattern per scam call instead of speech. The mic
// is gated meanwhile so Reson8 does not transcribe the tone.

const PULSES = [880, 660, 880]; // Hz
const PULSE_S = 0.35;
const GAP_S = 0.1;
const GATE_TAIL_MS = 400;

let soundOn = true;
let audio = null;
let alarmPlayedFor = null; // call id whose alarm already sounded
let micGateUntil = 0;

// Browsers only allow sound after a click: called from Listen, Replay and Sound.
function unlockSound() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  audio ??= new Context();
  void audio.resume();
}

function playAlarm() {
  if (!soundOn || !audio) return;
  const start = audio.currentTime + 0.02;
  PULSES.forEach((frequency, i) => {
    const at = start + i * (PULSE_S + GAP_S);
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = frequency;
    // Short fade in and out so the pulses don't click.
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
    gain.gain.setValueAtTime(0.2, at + PULSE_S - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + PULSE_S);
    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + PULSE_S + 0.02);
  });
  micGateUntil = performance.now() + PULSES.length * (PULSE_S + GAP_S) * 1000 + GATE_TAIL_MS;
}

function alarmOnce() {
  if (alarmPlayedFor === call.id) return;
  alarmPlayedFor = call.id;
  playAlarm();
}

const micGated = () => performance.now() < micGateUntil;

// ---------------------------------------------------------------------------
// Live listening: mic -> AudioWorklet (16 kHz PCM16) -> Reson8 WebSocket.

/*
 * Reson8 realtime messages, as observed in the spike (two different voices,
 * 16 kHz PCM16, diarize=true, include_interim=true):
 *   {"type":"transcript","text":"Hello, the police","is_final":false,"speaker_id":0}
 *   {"type":"transcript","text":"Hello, the police. Oh my goodness, what happened?","is_final":true,"speaker_id":0}
 *   {"type":"flush_confirmation","id":"abc"}
 * - is_final marks interim vs final; speaker_id is a 0-based integer per message.
 * - Interim text keeps growing across both speakers until something finalises it.
 * - Finals come ~3 s after a speaker stops on their own. After a
 *   {"type":"flush_request","id":...} they arrive ~0.3 s later, already split per
 *   speaker. So we flush after ~600 ms of silence.
 * - The two voices got different speaker ids in every final. Real teammates still
 *   need checking live (task 4.5).
 * - Auth from the browser: new WebSocket(url, ["bearer", token]).
 */
function toTranscriptEvent(message) {
  if (message?.type !== "transcript" || typeof message.text !== "string") return null;
  return {
    kind: message.is_final === false ? "interim" : "final",
    speakerId: typeof message.speaker_id === "number" ? message.speaker_id : null,
    text: message.text.trim(),
  };
}

const SILENCE_FLUSH_MS = 600;
const MAX_UTTERANCE_MS = 15000; // flush anyway when a noisy room never goes quiet

const mic = {
  active: false,
  stream: null,
  context: null,
  socket: null,
  reconnects: 0,
  noiseFloor: 0.005,
  inSpeech: false,
  silentMs: 0,
  speechMs: 0,
  ignoreUntilFlush: null,
  flushCount: 0,
};

function flush(id = `f${++mic.flushCount}`) {
  if (mic.socket?.readyState === WebSocket.OPEN) mic.socket.send(JSON.stringify({ type: "flush_request", id }));
  return id;
}

function onFrame(frame, rms) {
  const socket = mic.socket;
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  if (micGated()) {
    mic.inSpeech = false;
    mic.silentMs = mic.speechMs = 0;
    return;
  }
  socket.send(frame.buffer);

  // Simple voice activity detection on a slowly adapting noise floor.
  mic.noiseFloor = rms < mic.noiseFloor ? mic.noiseFloor * 0.9 + rms * 0.1 : mic.noiseFloor * 0.999 + rms * 0.001;
  const speaking = rms > Math.max(0.004, mic.noiseFloor * 2.5);
  if (speaking) {
    mic.inSpeech = true;
    mic.silentMs = 0;
    mic.speechMs += 20;
    if (mic.speechMs >= MAX_UTTERANCE_MS) {
      flush();
      mic.speechMs = 0;
    }
  } else if (mic.inSpeech) {
    mic.silentMs += 20;
    if (mic.silentMs >= SILENCE_FLUSH_MS) {
      flush();
      mic.inSpeech = false;
      mic.speechMs = 0;
    }
  }
}

function onReson8Message(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (message.type === "flush_confirmation") {
    if (message.id === mic.ignoreUntilFlush) mic.ignoreUntilFlush = null;
    return;
  }
  const event = toTranscriptEvent(message);
  if (!event) return;
  // After a reset, anything Reson8 still had buffered belongs to the old call.
  if (mic.ignoreUntilFlush) return;
  if (event.kind === "interim") {
    interim = { speakerId: event.speakerId, text: event.text };
  } else {
    interim = null;
    if (event.text) void post("/api/segment", { speakerId: event.speakerId, text: event.text });
  }
  if (call) renderTranscript();
}

async function openSocket() {
  const res = await fetch("/api/reson8/session");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Reson8 session failed (${res.status})`);
  const socket = new WebSocket(body.url, ["bearer", body.token]);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error("Could not connect to Reson8"));
  });
  socket.onmessage = (e) => typeof e.data === "string" && onReson8Message(e.data);
  socket.onclose = (e) => {
    if (mic.socket !== socket || !mic.active) return;
    mic.socket = null;
    // 1011 / 1006 per the Reson8 docs: reconnect and keep listening.
    if (mic.reconnects++ < 3) {
      setTimeout(() => mic.active && openSocket().then((s) => (mic.socket = s)).catch(listenFailed), 1000);
    } else {
      listenFailed(new Error(`Reson8 closed the connection (${e.code} ${e.reason})`));
    }
  };
  mic.reconnects = 0;
  return socket;
}

async function startListening() {
  showListenError(null);
  mic.active = true;
  renderListening("Connecting…");
  try {
    // Created inside the click so the browser lets it run.
    mic.context = new AudioContext();
    // Reson8 first: frames captured before the socket is open would be lost,
    // and the opening words are often what identifies the speakers.
    mic.socket = await openSocket();
    mic.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    await mic.context.audioWorklet.addModule("/audio-worklet.js");
    await mic.context.resume();
    const source = mic.context.createMediaStreamSource(mic.stream);
    const worklet = new AudioWorkletNode(mic.context, "pcm16-processor");
    worklet.port.onmessage = (e) => onFrame(e.data.frame, e.data.rms);
    // A silent path to the speakers keeps the graph running without feedback.
    const mute = mic.context.createGain();
    mute.gain.value = 0;
    source.connect(worklet).connect(mute).connect(mic.context.destination);
    renderListening();
  } catch (err) {
    listenFailed(err);
  }
}

function stopListening() {
  const socket = mic.socket;
  mic.active = false;
  mic.socket = null;
  if (socket?.readyState === WebSocket.OPEN) {
    // Let Reson8 finalise the last sentence before closing.
    socket.send(JSON.stringify({ type: "flush_request", id: "stop" }));
    socket.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      if (e.data.includes('"flush_confirmation"')) return socket.close(1000);
      onReson8Message(e.data); // the last final sentence is still posted
    };
    setTimeout(() => socket.readyState === WebSocket.OPEN && socket.close(1000), 2000);
  } else {
    socket?.close(1000);
  }
  mic.stream?.getTracks().forEach((t) => t.stop());
  void mic.context?.close();
  mic.stream = mic.context = null;
  interim = null;
  renderListening();
  if (call) renderTranscript();
}

function listenFailed(err) {
  stopListening();
  showListenError(err.message);
}

function showListenError(text) {
  $("listen-error").hidden = !text;
  $("listen-error").textContent = text ? `Listening stopped: ${text}. Replay still works.` : "";
}

function renderListening(pending) {
  $("live").hidden = !mic.active || Boolean(pending);
  $("listen").textContent = pending ?? (mic.active ? "Stop listening" : "Listen");
  $("listen").classList.toggle("on", mic.active);
}

// ---------------------------------------------------------------------------
// Controls

async function post(path, body = {}) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res;
}

function wireControls() {
  $("listen").onclick = () => {
    unlockSound();
    mic.active ? stopListening() : void startListening();
  };
  $("reset").onclick = async () => {
    if (mic.active) {
      mic.ignoreUntilFlush = flush("reset");
      interim = null;
    }
    await post("/api/reset");
  };
  $("hangup").onclick = () => post("/api/hangup");
  $("swap").onclick = () => post("/api/roles/swap");
  $("sound").onclick = () => {
    soundOn = !soundOn;
    $("sound").textContent = soundOn ? "Sound on" : "Sound off";
    $("sound").setAttribute("aria-pressed", String(soundOn));
    if (soundOn) unlockSound();
  };
  $("replay").onclick = async () => {
    unlockSound();
    if (mic.active) stopListening(); // a replay and a live mic in one call would mix
    const res = await post("/api/replay", { id: $("script").value });
    if (!res.ok) toast("Replay not found");
  };
  // Approve / Decline live in the tracker and in the details; steps are clickable.
  document.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-approve]");
    if (button && call?.approval) {
      const res = await post(`/api/approval/${call.approval.id}`, { approve: button.dataset.approve === "true" });
      if (res.status === 409) toast("Already decided: the first decision stands.");
      return;
    }
    const step = e.target.closest("#tracker .step.done, #tracker .step.pending");
    if (step && call) {
      selectedStep = step.dataset.step;
      render();
    }
  });
}

async function loadScripts() {
  const scripts = await (await fetch("/api/scripts")).json();
  $("script").innerHTML = scripts
    .map((s) => `<option value="${esc(s.id)}">${s.label === "scam" ? "SCAM" : "normal"}: ${esc(s.title)}</option>`)
    .join("");
  if (scripts.some((s) => s.id === "scam-fake-police")) $("script").value = "scam-fake-police";
}

async function loadReadiness() {
  const config = await (await fetch("/api/config")).json();
  const chip = (ok, name) => `<span class="chip ${ok ? "ok" : "bad"}">${name}</span>`;
  $("ready").innerHTML = chip(config.reson8, "Reson8") + chip(config.anthropic, "Claude");
  // A page newer than the server process: labels and events may not match.
  $("server-banner").hidden = (config.protocol ?? 0) >= EXPECTED_PROTOCOL;
  $("ready").title = `scorer ${config.scorerModel}, agent ${config.agentModel}, language ${config.language}`;
}

// The eval scoreboard comes from `npm run eval`; no file means no tile.
async function loadEval() {
  try {
    const res = await fetch("/eval-results.json", { cache: "no-store" });
    if (!res.ok) throw new Error("no results");
    const results = await res.json();
    const runs = results.runs ?? [];
    const run = runs.find((r) => r.dataset === "dataset" && r.mode === "full") ?? runs[0];
    if (!run) throw new Error("empty results");
    const demand =
      run.scamsWithDemand !== undefined && run.scamsWithDemand < run.scams
        ? ` (${run.detectedWithDemand}/${run.scamsWithDemand} that asked for money)`
        : "";
    const lead =
      run.leadMedian === null
        ? ""
        : run.leadMedian > 0
          ? ` · median alarm ${run.leadMedian} turns before the money ask`
          : run.leadMedian === 0
            ? " · median alarm at the money ask"
            : ` · median alarm ${-run.leadMedian} turns after the money ask`;
    const roles = run.rolesFinal ? ` · caller identified ${run.rolesFinal.correct}/${run.rolesFinal.total}` : "";
    // On small screens only the headline stays; the rest is hidden by CSS.
    $("eval-text").innerHTML =
      esc(`caught ${run.detected}/${run.scams} scams`) +
      `<span class="eval-extra">${esc(demand)}</span>` +
      esc(` · false alarms ${run.falseAlarms}/${run.normals}`) +
      `<span class="eval-extra">${esc(lead)}</span>` +
      esc(` · p50 ${seconds(run.latencyP50)}`) +
      `<span class="eval-roles">${esc(roles)}</span>`;
    $("eval").title = `${run.dataset}, ${run.mode} transcript, ${results.model}, ${results.generatedAt}`;
    $("eval").hidden = false;
  } catch {
    $("eval").hidden = true;
  }
}

// For the browser tests: drive the reducer and renderer directly.
window.__schutzengel = { apply, render };

wireControls();
connect();
void loadScripts();
void loadReadiness();
void loadEval();
setInterval(loadEval, 15000);
