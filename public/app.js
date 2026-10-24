// Schutzengel dashboard: tells the live call from /api/events as a story (status,
// conversation, receiver's screen, what Claude does), listens to the laptop
// microphone through Reson8, and sounds one alarm tone per scam call.

const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = (id, cls = "icon") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

// [key, name, icon, what the sign means until Claude finds it]
const SIGNALS = [
  ["claims_authority", "Authority", "i-landmark", "Claims to be police, a bank, an official or family"],
  ["asks_money", "Money ask", "i-banknote", "Asks for cash, valuables, card details or PINs"],
  ["pressure", "Pressure", "i-timer", "Creates fear, panic or urgency"],
  ["secrecy", "Secrecy", "i-lock", "Says keep it secret, or don't hang up"],
];
const LIT_AT = 0.6;
const WHO = { caller: "Caller", receiver: "Receiver" };
const EXPECTED_PROTOCOL = 2; // server protocol this page needs (see /api/config)
// /phone redirects to ?view=phone: only the receiver's screen, for a real phone.
const PHONE_VIEW = new URLSearchParams(location.search).get("view") === "phone";

// Servers from before the rename still send "grandma" for the receiver.
const normRole = (role) => (role === "grandma" ? "receiver" : role);

// ---------------------------------------------------------------------------
// Call state: replaced on "state", patched by every other event.

let call = null;
let connected = false;
let loadedBuild = null; // server build this page first saw
let screens = 0;
let phones = 0; // receiver phone views, counted apart from dashboards
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
    phones = event.phones ?? 0;
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
      call.hungUpAt = event.at;
      break;
    case "error":
      toast(`${event.where ?? "server"}: ${event.message}`);
      break;
    case "screens":
      screens = event.count;
      phones = event.phones ?? 0;
      break;
  }
}

function connect() {
  const source = new EventSource(PHONE_VIEW ? "/api/events?client=phone" : "/api/events");
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
// Claude sometimes wraps a quote in quote marks itself; we add our own. Only text
// that is one quote from end to end loses its outer marks, so inner quotes stay paired.
const unquote = (text) => {
  const value = String(text ?? "").trim();
  return /^["“”'].+["“”']$/s.test(value) && !/["“”]/.test(value.slice(1, -1)) ? value.slice(1, -1) : value;
};
const seconds = (ms) => (ms === null || ms === undefined ? "–" : `${(ms / 1000).toFixed(1)} s`);
const clock = (at) => (at ? new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");
const pct = (value) => `${Math.round((value ?? 0) * 100)}%`;
const two = (n) => String(n).padStart(2, "0");
const duration = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${two(Math.floor(total / 60))}:${two(total % 60)}`;
};

// innerHTML only when the markup changed: keeps scroll positions and running animations.
const shownHtml = new WeakMap();
function setHtml(el, html) {
  if (shownHtml.get(el) === html) return false;
  el.innerHTML = html;
  shownHtml.set(el, html);
  return true;
}

function renderStatus() {
  const last = call.scores.at(-1);
  const risk = last?.signals.risk ?? 0;
  $("risk-value").textContent = pct(risk);
  $("level").textContent = call.level.toUpperCase();
  const type = last?.signals.scam_type;
  const typeText = type && type !== "none" ? type.replaceAll("_", " ") : "";
  $("scam-type").textContent = call.hungUp ? [typeText, "call ended"].filter(Boolean).join(" · ") : typeText;
  // Claude's reason is its own words (often quoting the caller), shown as written.
  setHtml($("reason"), last ? `<span class="claude-tag">${icon("i-sparkles")}Claude</span>${esc(last.signals.reason)}` : "");
  $("reaction").textContent =
    call.reactionMs !== null && call.reactionMs !== undefined
      ? `Alarm ${seconds(call.reactionMs)} after the triggering sentence`
      : "";
  renderRiskChart();
}

// Risk after every scored sentence, so the audience sees the scam build up, with the
// caution and alarm thresholds as dashed lines. Thresholds come from /api/config.
let thresholds = { scam: 0.8, caution: 0.5 };

function renderRiskChart() {
  const box = $("risk-chart");
  const w = box.clientWidth;
  const h = box.clientHeight;
  if (!call || !w || !h) return;
  const pad = 5;
  // The threshold labels sit right of the plot, so the line never runs into them.
  const labels = Math.max($("th-scam").offsetWidth, $("th-caution").offsetWidth) + 10;
  const plotW = w - labels;
  const scores = call.scores;
  const slots = Math.max(scores.length, 12); // early in the call the line grows from the left
  const x = (i) => pad + (i / (slots - 1)) * (plotW - 2 * pad);
  const y = (risk) => pad + (1 - risk) * (h - 2 * pad);
  const f = (n) => n.toFixed(1);
  const points = scores.map((score, i) => [x(i), y(score.signals.risk)]);
  const line = points.map(([px, py], i) => `${i ? "L" : "M"}${f(px)} ${f(py)}`).join("");
  const stops = [
    [0, "--safe"],
    [thresholds.caution - 0.04, "--safe"],
    [thresholds.caution, "--caution"],
    [thresholds.scam - 0.04, "--caution"],
    [thresholds.scam, "--scam"],
    [1, "--scam"],
  ]
    .map(([offset, color]) => `<stop offset="${offset}" style="stop-color: var(${color})"/>`)
    .join("");
  let svg = `<defs><linearGradient id="risk-grad" gradientUnits="userSpaceOnUse" x1="0" y1="${f(y(0))}" x2="0" y2="${f(y(1))}">${stops}</linearGradient></defs>`;
  for (const [key, color] of [["scam", "#fca5a5"], ["caution", "#fcd34d"]]) {
    svg += `<line class="th-line" x1="0" x2="${f(plotW)}" y1="${f(y(thresholds[key]))}" y2="${f(y(thresholds[key]))}" stroke="${color}" stroke-opacity="0.55"/>`;
  }
  if (points.length) {
    const last = points.at(-1);
    const alarmAt = scores.findIndex((score) => score.level === "scam");
    svg += `<path d="${line}L${f(last[0])} ${f(y(0))}L${f(points[0][0])} ${f(y(0))}Z" fill="url(#risk-grad)" opacity="0.18"/>`;
    svg += `<path class="risk-line" d="${line}" stroke="url(#risk-grad)"/>`;
    if (alarmAt >= 0) svg += `<line class="alarm-mark" x1="${f(x(alarmAt))}" x2="${f(x(alarmAt))}" y1="0" y2="${h}"/>`;
    svg += `<circle class="risk-dot" cx="${f(last[0])}" cy="${f(last[1])}" r="5" style="fill: var(--level)"/>`;
  }
  setHtml($("risk-svg"), svg);
  $("th-scam").style.top = `${y(thresholds.scam)}px`;
  $("th-caution").style.top = `${y(thresholds.caution)}px`;
  $("risk-empty").hidden = points.length > 0;
}
new ResizeObserver(() => requestAnimationFrame(renderRiskChart)).observe(document.getElementById("risk-chart"));

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
  <div class="hero">
    <svg class="hero-logo" viewBox="0 0 32 32" aria-hidden="true"><use href="#logo"/></svg>
    <div>
      <div class="hero-title">A guardian angel on the line</div>
      <div class="hero-sub">Schutzengel listens to the call on speakerphone. Claude reads every sentence and steps in before the money leaves the house.</div>
    </div>
  </div>
  <div class="pipeline">
    <div class="node">${icon("i-mic")}<b>Microphone</b>the call on speaker</div>
    ${icon("i-arrow", "icon arrow")}
    <div class="node">${icon("i-audio")}<b>Reson8</b>live speech-to-text, two voices</div>
    ${icon("i-arrow", "icon arrow")}
    <div class="node claude">${icon("i-sparkles")}<b>Claude</b>reads every sentence, spots the scam</div>
    ${icon("i-arrow", "icon arrow")}
    <div class="node">${icon("i-shield-check")}<b>Receiver &amp; trusted contact</b>warned within seconds</div>
  </div>
  <div class="idle-hint"><span class="pulse-dot"></span><span>Waiting for a call<span class="op">: press <b>Listen</b>, or pick a replay</span>. Claude also works out who is calling, whoever speaks first.</span></div>
</li>`;

const TAG_ICON = { claims_authority: "i-landmark", asks_money: "i-banknote", pressure: "i-timer", secrecy: "i-lock", caution: "i-alert", alarm: "i-siren" };

// The label keeps its colon for copy and screen readers ("Caller: ..."); the bubble hides it.
const bubble = (name, text) =>
  `<div class="bubble"><span class="who">${name}<span class="sr">:</span></span><span class="text">${esc(text)}</span></div>`;
const tagsHtml = (tags) =>
  tags.length
    ? `<div class="tags">${tags.map((t) => `<span class="tag tag-${t.kind}">${icon(TAG_ICON[t.kind])}${esc(t.label)}${t.time ? ` · <span class="tag-time">${esc(t.time)}</span>` : ""}</span>`).join("")}</div>`
    : "";

// Which line set off what: the first score that lit each warning sign, turned the
// call amber, or raised the alarm. A score covers the call up to its segment, so the
// tag goes on the caller's line at or before it.
function lineTags() {
  const tags = new Map();
  const add = (score, tag) => {
    if (!score) return;
    const id = anchorLine(score.segmentId);
    if (id === null) return;
    if (!tags.has(id)) tags.set(id, []);
    tags.get(id).push(tag);
  };
  for (const [key, name] of SIGNALS) add(call.scores.find((s) => s.signals[key] >= LIT_AT), { kind: key, label: name });
  const firstRisky = call.scores.find((s) => s.level !== "safe");
  if (firstRisky?.level === "caution") add(firstRisky, { kind: "caution", label: "Caution" });
  const time = call.reactionMs !== null && call.reactionMs !== undefined ? seconds(call.reactionMs) : "";
  add(call.scores.find((s) => s.level === "scam"), { kind: "alarm", label: "Alarm", time });
  return tags;
}

function anchorLine(segmentId) {
  const index = call.segments.findIndex((s) => s.id === segmentId);
  if (index < 0) return null;
  for (let i = index; i >= 0; i--) {
    if (speakerName(call.segments[i].speakerId).role === "caller") return call.segments[i].id;
  }
  return segmentId;
}

// Lines are kept and patched rather than redrawn, so a new line can slide in and a
// relabelled one can flash without the rest of the transcript flickering.
const rendered = new Map(); // segment id -> { li, sig, role }
let transcriptFor = null;

function renderTranscript() {
  const list = $("transcript");
  if (transcriptFor !== call.id) {
    transcriptFor = call.id;
    rendered.clear();
    list.innerHTML = "";
  }
  if (!call.segments.length && !interim?.text) {
    if (!list.querySelector(".idle")) {
      list.innerHTML = IDLE;
      rendered.clear();
    }
    return;
  }
  list.querySelector(".idle")?.remove();
  const stick = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  const tags = lineTags();
  let interimLi = list.querySelector(":scope > li.interim");
  let added = false;
  for (const segment of call.segments) {
    const { role, name } = speakerName(segment.speakerId);
    const lineTagList = tags.get(segment.id) ?? [];
    const sig = `${role}|${name}|${lineTagList.map((t) => t.kind + t.label + (t.time ?? "")).join()}`;
    let entry = rendered.get(segment.id);
    if (!entry) {
      entry = { li: document.createElement("li"), sig: null, role: null };
      list.insertBefore(entry.li, interimLi);
      rendered.set(segment.id, entry);
      added = true;
    }
    if (entry.sig === sig) continue;
    const relabel = entry.role !== null && entry.role !== role;
    entry.li.className = `msg ${role}${entry.sig === null ? " enter" : ""}${relabel ? " relabel" : ""}`;
    entry.li.innerHTML = bubble(name, segment.text) + tagsHtml(lineTagList);
    entry.sig = sig;
    entry.role = role;
  }
  if (interim?.text) {
    const { role, name } = speakerName(interim.speakerId);
    if (!interimLi) {
      interimLi = document.createElement("li");
      list.appendChild(interimLi);
      added = true;
    }
    interimLi.className = `msg ${role} interim`;
    interimLi.innerHTML = bubble(name, interim.text);
  } else {
    interimLi?.remove();
  }
  if (added || stick) list.scrollTop = list.scrollHeight;
}

// The receiver's phone: a lock screen before the call, the call screen while it is
// safe (amber banner on caution), a full red takeover on scam, "Call ended" after.
function phoneMode() {
  if (call.hungUp) return "ended";
  if (call.level === "scam") return "alert";
  return call.segments.length ? "call" : "lock";
}

function renderPhone() {
  $("phone").className = `phone phone-${call.level} ${phoneMode()}`;
  $("phone-label").textContent = { safe: "Protected", caution: "Be careful", scam: "SCAM CALL" }[call.level];
  const text = call.level === "scam" ? (call.warning ?? "") : call.level === "caution" ? "This call has warning signs." : "";
  if ($("phone-warning").textContent !== text) $("phone-warning").textContent = text;
  $("ended-note").textContent = call.level === "scam" ? "Well done for hanging up. This was a scam call." : "";
  renderClock();
  fitPhone();
}

// Phone clock, lock screen and call timer; ticks every second.
function renderClock() {
  const now = new Date();
  const time = `${two(now.getHours())}:${two(now.getMinutes())}`;
  $("phone-clock").textContent = time;
  $("lock-time").textContent = time;
  $("lock-date").textContent = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  if (!call) return;
  const start = call.segments[0]?.at;
  const end = call.hungUp ? (call.hungUpAt ?? call.segments.at(-1)?.at ?? Date.now()) : Date.now();
  const elapsed = start ? duration(end - start) : "00:00";
  $("phone-timer").textContent = elapsed;
  $("ended-duration").textContent = elapsed;
}
setInterval(renderClock, 1000);

// The scam warning starts large and shrinks 1 px at a time until it fits between the
// label and the "Hang up" bar, never below 11 px. Re-run when the phone resizes.
const MIN_WARNING_PX = 11;
function fitPhone() {
  const phone = $("phone");
  const body = $("phone-body");
  const text = $("phone-warning");
  phone.style.setProperty("--pw", `${phone.clientWidth}px`);
  if (!text.textContent || !phone.classList.contains("phone-scam")) {
    text.style.fontSize = "";
    return;
  }
  let size = Math.max(MIN_WARNING_PX, Math.min(40, Math.floor(body.clientWidth / 7)));
  text.style.fontSize = `${size}px`;
  while (size > MIN_WARNING_PX && (body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1)) {
    size -= 1;
    text.style.fontSize = `${size}px`;
  }
}
new ResizeObserver(() => requestAnimationFrame(fitPhone)).observe(document.getElementById("phone"));

// Rows are built once and then updated, so the bars grow instead of jumping.
function renderSignals() {
  const box = $("signals");
  if (!box.children.length) {
    box.innerHTML = SIGNALS.map(
      ([key, name, iconId]) =>
        `<div class="signal" data-key="${key}"><span class="sig-icon">${icon(iconId, "")}</span><span class="name">${name}</span><span class="bar-bg"><span class="bar-fg"></span></span><span class="num"></span><span class="note"></span></div>`,
    ).join("");
  }
  const last = call.scores.at(-1);
  for (const [key, , , hint] of SIGNALS) {
    const row = box.querySelector(`[data-key="${key}"]`);
    const value = last?.signals[key] ?? 0;
    // The quote stays with the score that first lit the signal, so the story builds up.
    const first = call.scores.find((s) => s.signals[key] >= LIT_AT);
    const wasLit = row.classList.contains("lit");
    row.classList.toggle("lit", Boolean(first));
    // Pop only when the newest score lit it, not when a dashboard joins mid-call.
    if (first && !wasLit && first === last) {
      row.classList.remove("pop");
      void row.offsetWidth;
      row.classList.add("pop");
    }
    row.querySelector(".bar-fg").style.width = `${Math.round(value * 100)}%`;
    row.querySelector(".num").textContent = pct(value);
    const note = row.querySelector(".note");
    note.className = first ? "note quote" : "note hint";
    note.textContent = first ? first.signals.reason : hint;
  }
}

// ---------------------------------------------------------------------------
// "Claude acts": four steps derived from the call state.

const STEPS = [
  ["alarm", "Alarm", "i-bell"],
  ["contact", "Trusted contact alerted", "i-send"],
  ["report", "Police report", "i-file"],
  ["police", "Call 110?", "i-phone"],
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
  return `<div class="buttons"><button class="approve" data-approve="true">${icon("i-check")}Approve</button><button data-approve="false">Decline</button></div>`;
}

function renderTracker(states) {
  const shown = visibleStep(states);
  const html = STEPS.map(([key, title, iconId], index) => {
    const { state, sub } = states[key];
    const mark = state === "done" ? icon("i-check") : state === "pending" ? "!" : state === "active" ? "" : String(index + 1);
    return `<li class="step ${state}${key === shown ? " selected" : ""}" data-step="${key}">
      <span class="mark">${mark}</span>
      <span class="title">${icon(iconId, "icon step-icon")}${title}</span>
      <span class="sub">${esc(sub)}</span>
      ${state === "pending" ? approvalButtons() : ""}
    </li>`;
  }).join("");
  setHtml($("tracker"), html);
}

// Each detail starts with its heading text (no leading whitespace): tests and the
// presenter read it as the step's title.
function renderDetails(key) {
  let html;
  if (key === "alarm") {
    const last = call.scores.find((s) => s.level === "scam") ?? call.scores.at(-1);
    html =
      `<h3>${icon("i-bell")}Warning on the receiver's screen</h3>` +
      `<div class="warning-text">${esc(call.warning)}</div>` +
      `<div class="note">Alarm tone ${seconds(call.reactionMs)} after the sentence${last ? ` · Claude: ${esc(last.signals.reason)}` : ""}</div>`;
  } else if (key === "contact") {
    const family = call.family;
    html =
      `<h3>${icon("i-send")}Message to the trusted contact: “Scam call in progress”</h3>` +
      `<div class="notif"><div class="notif-app"><svg viewBox="0 0 32 32" aria-hidden="true"><use href="#logo"/></svg>Schutzengel<span class="when">${esc(clock(toolTimes("notify_trusted_contact")[0]))}</span></div>` +
      `<div class="notif-title">Scam call in progress</div><div>${esc(family.summary)}</div>` +
      (family.quotes.length ? `<ul class="quotes">${family.quotes.map((q) => `<li>“${esc(unquote(q))}”</li>`).join("")}</ul>` : "") +
      `</div><div class="note">${family.delivered ? "Push notification delivered" : "Shown on this dashboard (no push channel in this demo)"}</div>`;
  } else if (key === "report") {
    const report = call.report;
    const drafts = toolTimes("draft_police_report");
    const rows = [
      ["Summary", report.summary],
      ["Claimed to be", report.caller_claimed_identity],
      ["Demands", report.demands],
      ["Pressure", report.pressure_tactics],
      ["Handover", report.handover_details],
      ["Scam type", report.scam_type],
    ];
    html =
      `<h3>${icon("i-file")}Police report (draft)</h3>` +
      `<div class="report-doc"><span class="stamp">DRAFT</span>` +
      `<div class="doc-head">Phone scam attempt · ${drafts.length > 1 ? "updated" : "drafted"} ${esc(clock(drafts.at(-1)))} · from the transcript only</div>` +
      `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` +
      `<ul class="quotes">${report.key_quotes.map((q) => `<li>“${esc(unquote(q))}”</li>`).join("")}</ul></div>`;
  } else if (key === "police") {
    const approval = call.approval;
    const head = { pending: "Call the police (110)?", approved: "Approved: calling 110", declined: "Declined: police not called" }[approval.status];
    html =
      `<h3>${icon("i-phone")}${head}</h3>` +
      `<div class="ask${approval.status === "pending" ? "" : " decided"}"><div>${esc(approval.reason)}</div>` +
      `<div class="evidence">“${esc(unquote(approval.evidence))}”</div>` +
      (approval.status === "pending" ? approvalButtons() : "") +
      `<div class="note">${approval.status === "approved" ? "Simulated in this demo: nothing is dialled." : "Nothing is dialled until a human approves."}</div></div>`;
  } else {
    html =
      `<div class="details-empty"><p>When a call turns into a scam, Claude sounds the alarm, alerts the trusted contact, drafts a police report and asks a human before calling 110. Each step appears here.</p>` +
      `<div class="promises"><span>${icon("i-zap")}Alarm seconds after the sentence</span><span>${icon("i-users")}The trusted contact gets the caller's words</span><span>${icon("i-check")}A human approves any police call</span></div></div>`;
  }
  setHtml($("details"), html);
}

const AGENT_STATUS = { idle: "standing by", running: "working…", done: "done", error: "error" };

function renderAgentLog() {
  const pill = $("agent-status");
  pill.textContent = AGENT_STATUS[call.agent.status] ?? call.agent.status;
  pill.className = `pill ${call.agent.status}`;
  // The time is drawn from data-time by CSS, so each entry still starts with its tool name.
  const html =
    call.agent.steps
      .map((step) => {
        const time = `data-time="${esc(clock(step.at))}"`;
        if (step.kind === "tool") return `<li ${time}><span class="tool">${esc(step.tool)}</span>${esc(step.detail)}</li>`;
        if (step.kind === "error") return `<li ${time} class="error">Error: ${esc(step.detail)}</li>`;
        return `<li ${time} class="muted">${esc(step.detail)}</li>`;
      })
      .join("") || `<li class="muted">Starts automatically when a scam is detected.</li>`;
  if (setHtml($("agent-steps"), html)) $("agent-log").scrollTop = $("agent-log").scrollHeight;
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
  const phoneText = phones ? ` · ${phones} phone${phones === 1 ? "" : "s"}` : "";
  $("screens").textContent = `${screens} screen${screens === 1 ? "" : "s"} connected${phoneText}${loadedBuild ? ` · build ${loadedBuild.slice(-4)}` : ""}`;
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

// One red flash across the screen with the alarm, also when the sound is off.
function flashAlarm() {
  const flash = $("flash");
  flash.classList.remove("go");
  void flash.offsetWidth;
  flash.classList.add("go");
}

function alarmOnce() {
  if (alarmPlayedFor === call.id) return;
  alarmPlayedFor = call.id;
  flashAlarm();
  playAlarm();
  if (PHONE_VIEW) navigator.vibrate?.([400, 150, 400, 150, 400]);
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
  level: 0, // latest frame RMS, for the level meter in the header
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
    worklet.port.onmessage = (e) => {
      mic.level = e.data.rms;
      onFrame(e.data.frame, e.data.rms);
    };
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
  $("listen").querySelector(".label").textContent = pending ?? (mic.active ? "Stop listening" : "Listen");
  $("listen").classList.toggle("on", mic.active);
  if (mic.active && !pending && vuFrame === null) vuFrame = requestAnimationFrame(vuLoop);
}

// Level meter next to LISTENING: shows the room is being heard, flat while the alarm tone gates the mic.
const VU_SHAPE = [0.55, 0.85, 1, 0.75, 0.5];
let vuLevel = 0;
let vuFrame = null;
function vuLoop() {
  const target = mic.active && !micGated() ? Math.min(1, Math.sqrt(Math.max(0, mic.level - mic.noiseFloor)) * 5) : 0;
  vuLevel += (target - vuLevel) * 0.3;
  [...$("vu").children].forEach((bar, i) => (bar.style.transform = `scaleY(${Math.max(0.12, vuLevel * VU_SHAPE[i]).toFixed(3)})`));
  vuFrame = mic.active ? requestAnimationFrame(vuLoop) : null;
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

async function decide(approve) {
  if (call?.approval?.status !== "pending") return;
  const res = await post(`/api/approval/${call.approval.id}`, { approve });
  if (res.status === 409) toast("Already decided: the first decision stands.");
}

function selectStep(key) {
  if (!call || !["done", "pending"].includes(stepStates()[key].state)) return;
  selectedStep = key;
  render();
}

// Presenter mode hides the operator controls (only Listen and New call stay) and is
// remembered per browser; ?presenter=1 or ?presenter=0 in the URL sets it too.
const PRESENTER_KEY = "schutzengel-presenter";
const isPresenter = () => document.documentElement.classList.contains("presenter");

function setPresenter(on) {
  document.documentElement.classList.toggle("presenter", on);
  $("mode").setAttribute("aria-pressed", String(on));
  $("mode").title = on ? "Show the operator controls (P)" : "Presenter mode: hide the operator controls (P)";
  try {
    localStorage.setItem(PRESENTER_KEY, on ? "1" : "0");
  } catch {
    // storage blocked: the mode just isn't remembered
  }
}

function initPresenter() {
  let on = false;
  try {
    on = localStorage.getItem(PRESENTER_KEY) === "1";
  } catch {
    // storage blocked
  }
  const param = new URLSearchParams(location.search).get("presenter");
  if (param !== null) on = param !== "0";
  setPresenter(on);
}

const OVERLAYS = ["eval-view", "help"];
function toggleOverlay(id, open = $(id).hidden) {
  for (const other of OVERLAYS) $(other).hidden = other !== id || !open;
}
const closeOverlays = () => OVERLAYS.forEach((id) => ($(id).hidden = true));

// Single keys for the presenter, so the demo needs no mouse (see the ? overlay).
const STEP_KEYS = { 1: "alarm", 2: "contact", 3: "report", 4: "police" };
const KEYS = {
  l: () => $("listen").click(),
  n: () => $("reset").click(),
  h: () => $("hangup").click(),
  w: () => $("swap").click(),
  s: () => $("sound").click(),
  r: () => $("replay").click(),
  a: () => decide(true),
  d: () => decide(false),
  e: () => toggleOverlay("eval-view"),
  p: () => setPresenter(!isPresenter()),
  "?": () => toggleOverlay("help"),
  Escape: closeOverlays,
};

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (e.target instanceof Element && e.target.closest("input, select, textarea")) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const action = STEP_KEYS[key] ? () => selectStep(STEP_KEYS[key]) : KEYS[key];
  if (!action) return;
  e.preventDefault();
  action();
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
    $("sound").querySelector(".label").textContent = soundOn ? "Sound on" : "Sound off";
    $("sound").querySelector("use").setAttribute("href", soundOn ? "#i-volume" : "#i-volume-x");
    $("sound").setAttribute("aria-pressed", String(soundOn));
    if (soundOn) unlockSound();
  };
  $("replay").onclick = async () => {
    unlockSound();
    if (mic.active) stopListening(); // a replay and a live mic in one call would mix
    const res = await post("/api/replay", { id: $("script").value });
    if (!res.ok) toast("Replay not found");
  };
  // The picker would swallow the shortcut keys while it has focus.
  $("script").onchange = () => $("script").blur();
  $("mode").onclick = () => setPresenter(!isPresenter());
  $("eval").onclick = () => toggleOverlay("eval-view", true);
  $("eval").onkeydown = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggleOverlay("eval-view", true);
  };
  for (const id of OVERLAYS) {
    $(id).addEventListener("click", (e) => {
      if (e.target === e.currentTarget || e.target.closest("[data-close]")) toggleOverlay(id, false);
    });
  }
  // Approve / Decline live in the tracker and in the details; steps are clickable.
  document.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-approve]");
    if (button) return void decide(button.dataset.approve === "true");
    const step = e.target.closest("#tracker .step.done, #tracker .step.pending");
    if (step) selectStep(step.dataset.step);
  });
  document.addEventListener("keydown", onKey);
}

// The phone view only shows the receiver's screen: one tap arms the alarm sound (phones
// only allow audio after a touch), and "Hang up" on the scam warning really ends the call.
// The small red button of the call screen does nothing: it sits under the thumb of
// whoever holds the phone, and an accidental tap would end the demo call.
function wirePhone() {
  document.documentElement.classList.add("view-phone");
  $("arm").hidden = false;
  $("arm").addEventListener("click", () => {
    unlockSound();
    $("arm").hidden = true;
  });
  $("phone").addEventListener("click", (e) => {
    if (e.target.closest(".phone-hangup")) void post("/api/hangup");
  });
}

async function loadScripts() {
  const scripts = await (await fetch("/api/scripts")).json();
  $("script").innerHTML = scripts
    .map((s) => `<option value="${esc(s.id)}">${s.label === "scam" ? "SCAM" : "normal"}: ${esc(s.title)}</option>`)
    .join("");
  if (scripts.some((s) => s.id === "scam-fake-police")) $("script").value = "scam-fake-police";
}

// "claude-opus-5-5" -> "Opus 5.5" for the footer chip.
const modelName = (id) => {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(id ?? "");
  return match ? `${match[1][0].toUpperCase()}${match[1].slice(1)} ${match[2]}${match[3] ? `.${match[3]}` : ""}` : "";
};

async function loadReadiness() {
  const config = await (await fetch("/api/config")).json();
  const chip = (ok, name) => `<span class="chip ${ok ? "ok" : "bad"}">${esc(name)}</span>`;
  $("ready").innerHTML = chip(config.reson8, "Reson8") + chip(config.anthropic, ["Claude", modelName(config.scorerModel)].filter(Boolean).join(" "));
  // A page newer than the server process: labels and events may not match.
  $("server-banner").hidden = (config.protocol ?? 0) >= EXPECTED_PROTOCOL;
  $("ready").title = `scorer ${config.scorerModel}, agent ${config.agentModel}, language ${config.language}`;
  if (typeof config.scamThreshold === "number" && typeof config.cautionThreshold === "number") {
    thresholds = { scam: config.scamThreshold, caution: config.cautionThreshold };
    renderRiskChart();
  }
}

// The eval scoreboard comes from `npm run eval`; no file means no tile.
let evalResults = null;

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
      `caught <b>${esc(`${run.detected}/${run.scams}`)}</b> scams` +
      `<span class="eval-extra">${esc(demand)}</span>` +
      ` · false alarms <b>${esc(`${run.falseAlarms}/${run.normals}`)}</b>` +
      `<span class="eval-extra">${esc(lead)}</span>` +
      esc(` · p50 ${seconds(run.latencyP50)}`) +
      `<span class="eval-roles">${esc(roles)}</span>`;
    $("eval").title = `${run.dataset}, ${run.mode} transcript, ${results.model}, ${results.generatedAt}. Click or press E for the full evaluation.`;
    $("eval").hidden = false;
    evalResults = results;
  } catch {
    $("eval").hidden = true;
    evalResults = null;
  }
  renderEvalView();
}

const leadText = (lead) => {
  if (lead === null || lead === undefined) return "–";
  if (lead === 0) return "on the money request";
  const turns = `${Math.abs(lead)} turn${Math.abs(lead) === 1 ? "" : "s"}`;
  return lead > 0 ? `${turns} before the money request` : `${turns} after the money request`;
};

// Full-screen evaluation (E or click the footer tile) for the tech walkthrough.
function renderEvalView() {
  const runs = evalResults?.runs ?? [];
  const find = (dataset, mode) => runs.find((r) => r.dataset === dataset && r.mode === mode);
  const pub = find("dataset", "full") ?? runs[0];
  const head = (title, sub) =>
    `<div class="sheet-head"><div><div class="eyebrow">Evaluation</div><h2 class="sheet-title">${title}</h2><p class="sheet-sub">${sub}</p></div><button class="ghost close" data-close>Esc</button></div>`;
  if (!pub) {
    setHtml($("eval-sheet"), head("No results yet", "Run <code>npm run eval</code> to replay the labelled calls through the scorer."));
    return;
  }
  const calls = runs.filter((r) => r.mode === "full").reduce((sum, r) => sum + r.scams + r.normals, 0);
  const withDemand = pub.scamsWithDemand ?? pub.scams;
  const noDemand = pub.scams - withDemand;
  const stats = [
    {
      good: true,
      big: `${pub.detectedWithDemand ?? pub.detected}/${withDemand}`,
      label: "scams caught that asked for money",
      sub: `${pub.detected}/${pub.scams} of all scam calls${noDemand ? `; ${noDemand} never got to a money request` : ""}`,
    },
    {
      good: pub.falseAlarms === 0,
      big: `${pub.falseAlarms}/${pub.normals}`,
      label: "false alarms on normal calls",
      sub: pub.cautionOnNormal ? `${pub.cautionOnNormal}/${pub.normals} showed caution: yellow only, no warning` : "not one normal call even reached caution",
    },
    pub.rolesFinal && { big: `${pub.rolesFinal.correct}/${pub.rolesFinal.total}`, label: "caller identified correctly", sub: "from what is said, not from who speaks first" },
    { big: seconds(pub.latencyP50), label: "Claude per sentence (median)", sub: `p95 ${seconds(pub.latencyP95)}` },
  ].filter(Boolean);
  const DATASETS = { dataset: "Public test calls", demo: "Handwritten demo calls" };
  const MODES = { full: "whole call", caller: "caller's lines only" };
  const rows = runs
    .map((r) => {
      const demand = r.scamsWithDemand !== undefined && r.scamsWithDemand < r.scams ? ` (${r.detectedWithDemand}/${r.scamsWithDemand} that asked for money)` : "";
      return `<tr><td>${esc(DATASETS[r.dataset] ?? r.dataset)} (${r.scams + r.normals})</td><td>${esc(MODES[r.mode] ?? r.mode)}</td>` +
        `<td class="${r.detectedWithDemand === r.scamsWithDemand ? "ok" : ""}">${r.detected}/${r.scams}${esc(demand)}</td>` +
        `<td class="${r.falseAlarms === 0 ? "ok" : ""}">${r.falseAlarms}/${r.normals}</td><td>${esc(leadText(r.leadMedian))}</td><td>${seconds(r.latencyP50)}</td></tr>`;
    })
    .join("");
  const t = evalResults.thresholds ?? thresholds;
  const when = evalResults.generatedAt ? new Date(evalResults.generatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  setHtml(
    $("eval-sheet"),
    head(`Tested on ${calls} labelled calls`, "The same Claude scorer and thresholds as the live system, replayed sentence by sentence. It never starts the agent or sends anything.") +
      `<div class="stats">${stats.map((s) => `<div class="stat${s.good ? " good" : ""}"><div class="big">${esc(s.big)}</div><div class="lbl">${esc(s.label)}</div><div class="sub">${esc(s.sub)}</div></div>`).join("")}</div>` +
      `<table class="runs"><thead><tr><th>Calls</th><th>Transcript</th><th>Scams caught</th><th>False alarms</th><th>Alarm vs. money request (median)</th><th>Claude p50</th></tr></thead><tbody>${rows}</tbody></table>` +
      `<p class="caveat">The public set is synthetic, US-centric and English-only: read it as a sanity check, not real-world accuracy. ` +
      `${esc(evalResults.model ?? "")}, effort ${esc(evalResults.effort ?? "–")}, thresholds ${esc(t.scam)} / ${esc(t.caution)}${when ? `, run ${esc(when)}` : ""}.</p>`,
  );
}

// For the browser tests: drive the reducer and renderer directly.
window.__schutzengel = { apply, render };

renderClock();
if (PHONE_VIEW) {
  wirePhone();
  connect();
} else {
  initPresenter();
  wireControls();
  connect();
  void loadScripts();
  void loadReadiness();
  void loadEval();
  setInterval(loadEval, 15000);
}
