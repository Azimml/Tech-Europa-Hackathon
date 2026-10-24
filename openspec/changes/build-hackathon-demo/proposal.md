# Proposal

## Why

The Schutzengel backend is done: live call state over SSE, the Claude scorer, the Claude agent with 4 tools, human approval and replay all work. But the judges have nothing to look at yet. There is no `public/` folder, so `/` returns 404. There is also no `eval/run-eval.ts`, so `npm run eval` fails. Submission is due at about 18:30 today (24 Oct 2026), so roughly 8 working hours are left.

The demo runs on **one laptop, with no phones**. Two teammates act out the call live at the laptop microphone, and everything the judges need to see is on a single projected screen.

## What Changes

- **New `public/index.html` "mission control" dashboard** (static HTML, CSS and JS, no build step), fed only by `/api/events`:
  - live transcript with grey interim text and speaker labels
  - a large risk meter and the 4 signal bars, each showing Claude's `reason` quote when it lights up
  - the agent's step-by-step log, the police report card, and the "Call 110?" approve/decline card
  - **"Erika's screen" panel**: a stand-in for her device. It goes green, yellow or red, shows the warning in huge type, and reads it aloud through the laptop speakers.
  - **"Lena's alert" card**: shows the family message the agent sent, with its quotes.
  - metric tiles (reaction time, scorer latency) and an eval scoreboard tile
- **Live listening from the laptop microphone**: the mic goes through an AudioWorklet that converts it to 16 kHz PCM16, streams it to the Reson8 WebSocket with a server-minted token, and sends each final sentence to `POST /api/segment`. Reson8's speaker separation tells the two live voices apart.
  - Controls: Listen, End call/Reset, Swap speakers, plus a replay picker for the scripted calls as the offline fallback.
  - While the spoken warning plays, audio is not sent to Reson8, so the laptop doesn't transcribe its own voice.
- **New `eval/run-eval.ts`** (`npm run eval`): replays the 80 dataset calls plus the 10 demo calls through the real scorer and the real `levelFor`/`escalate` logic, turn by turn. It reports:
  - detection rate and false alarm rate
  - turns from detection to the money request (positive = caught early)
  - p50/p95 scorer latency

  It runs once on full transcripts and once on caller turns only. The results go to `public/eval-results.json` so the dashboard can show them.
- **Police-call follow-up (added after testing)**: the alarm usually fires on the secrecy line, before the money request. The agent runs only once, at the alarm, so it never requests the police call. After the alarm, a clear money or valuables demand (`asks_money` ≥ 0.8) now starts a short follow-up agent pass. That pass can update the police report and request the 110 call, at most twice per call. A human still approves.
- **Demo runbook rewritten for one laptop**: two speakers at the mic, Erika says "Hello?" first (the server labels the first speaker as Erika), a pre-flight checklist, and the replay fallback.
- **Out of scope**:
  - phones of any kind (no guardian phone page, Cloudflare tunnel, vibration, screen mirroring, or lock-screen approval)
  - real telephony or dialling 110
  - storing audio or transcripts
  - accounts
  - new frameworks or build tooling
  - changes to the scorer

  The existing ntfy code stays as it is. With no topics configured, it already reports "shown on dashboard only".

## Capabilities

### New Capabilities
- `call-dashboard`: the single demo screen. Live listening (mic → Reson8 → segments), the visible call state (transcript, risk, signals, agent steps, report), Erika's warning view, Lena's alert view, the human approval control, and the replay fallback.
- `scam-eval`: the offline evaluation harness. Measures detection, false alarms, how early the alarm fires, and latency of the real scorer on labelled calls, and publishes the results.

### Modified Capabilities
- None. There are no existing specs.

## Impact

- **New files**: `public/index.html`, `public/style.css`, `public/app.js`, `public/audio-worklet.js`, `eval/run-eval.ts`, `public/eval-results.json` (generated).
- **Server**: one small addition in `server/pipeline.ts` and `server/agent.ts`, the police-call follow-up (added after testing, see What Changes). The scorer is unchanged.
- **Docs**: `docs/DEMO_SCRIPT.md` is rewritten for the laptop-only setup. `README.md` gets updated status and an evaluation section.
- **External**: Reson8 realtime WebSocket (from the browser) and the Anthropic API (the eval runs about 1,500 to 2,000 short scorer calls, so the cost needs a budget check). The tunnel and ntfy are not needed.
- **No new npm dependencies.**
