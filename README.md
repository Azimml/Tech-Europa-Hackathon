# Schutzengel: a guardian angel for phone calls

> Built at the **Agentic AI Hack by Jamie × {Tech: Europe}**, Berlin, 24 Oct 2026, with **Reson8** and **Anthropic Claude**.

Schutzengel listens to an older person's phone call on speakerphone and catches a scam **while the call is still running**. Reson8 transcribes the call live. Claude reads every sentence, and the moment the call turns into a scam it warns the person on the phone, alerts their trusted contact, drafts a police report, and asks a human before calling the police.

**🎥 Demo video:** [Loom link](LOOM_LINK_HERE) · **📄 Demo runbook:** [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)

![Dashboard in alarm state: the scam warning on the receiver's phone, evidence tags in the transcript, the risk line climbing over the alarm threshold, and Claude's actions below](docs/dashboard-alarm.png)

## Why

Fake police officers, "grandchildren in trouble" and fake bank staff call older people and talk them out of their savings. In 2025, fake police officers alone took **€49.5 million** from people in Germany, up from €30.1 million the year before, and shock calls and the grandchild trick took about **€49 million** more. Those are only the reported cases (BKA crime statistics, [reported by dpa](https://www.t-online.de/nachrichten/panorama/kriminalitaet/id_101376512/schaden-durch-falsche-polizisten-stark-gestiegen.html)).

These scams follow a script that builds up over minutes: an authority claim, then fear, then secrecy, then the demand for money. Keyword filters miss that, and number blocking fails because scammers fake the caller ID. Schutzengel reads the conversation as a story, as it happens.

## Results at a glance

Tested on **90 labelled calls** (80 public, 10 handwritten), through the same scorer and thresholds as the live system:

- **36/36** public scams that asked for money were caught (38/40 of all scams)
- **0/40** false alarms on normal calls
- **80/80** callers identified correctly, whoever spoke first
- On the handwritten calls, the alarm fired a median of **4 turns before** the money request
- The alarm sounds about **1.6 s** after the triggering sentence in a live test

Full numbers and caveats are under [Evaluation](#evaluation).

## Run it yourself (about 5 minutes)

**You need:**
- Node.js **20.12 or newer**
- Chrome
- an [Anthropic API key](https://console.anthropic.com)
- a [Reson8 API key](https://console.reson8.dev), only for live listening; the replay works without it

```bash
git clone https://github.com/Azimml/Tech-Europa-Hackathon.git
cd Tech-Europa-Hackathon
npm install
cp .env.example .env      # put ANTHROPIC_API_KEY (and RESON8_API_KEY) in .env
npm run dev               # open http://localhost:3000 in Chrome
```

The footer shows **Reson8** and **Claude** with a green dot when the keys are set.

### Option A: watch a scripted call (no microphone needed)

1. In the header, pick **"SCAM: Fake detective wants to collect cash and jewelry"** and click **Replay** (or press **R**).
2. Watch the call play out through the real Claude scorer and agent:
   - the warning signs light up, with a tag on the exact sentence
   - the screen turns amber, then red with an alarm tone
   - the receiver's phone shows the warning
   - Claude alerts the trusted contact, drafts the police report and asks for approval to call 110
3. Click **Approve**, then the steps under "Claude acts" to see each output. Press **E** for the evaluation view.
4. For a normal call that stays green, pick **"normal: …"** and replay it.

### Option B: a live call with your microphone

1. Click **Listen** and allow the microphone.
2. Two people read the scam call from [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md), taking turns about 20–30 cm from the laptop. Claude works out who the caller is from what is said.
3. Click **New call** (or press **N**) to start over.

**Useful keys:** **P** presenter mode (hides operator controls) · **E** evaluation · **1–4** show a Claude step · **A**/**D** approve or decline · **?** all keys.

**Optional:** open the address the server prints as `phone http://…/phone` on a phone on the same Wi-Fi. That phone becomes the receiver's screen and shows the warning when the alarm fires.

## How it works

```
Phone call on speaker → laptop microphone
  → Reson8 realtime speech-to-text (2 voices separated, scam vocabulary as "phrases")
  → Claude Haiku 5.5 after every sentence: re-reads the whole call, returns strict JSON
       risk + 4 signals: claims authority · asks for money · pressure · secrecy
       + scam type + which speaker is the caller + (once risky) the warning for the receiver
  → level: safe → caution → scam   (never goes down during a call)
  → on "scam": one alarm tone + the warning on the receiver's screen, instantly
  → Claude Opus 5.5 agent with tools:
       notify_trusted_contact → draft_police_report
       → request_police_call  (nothing is dialled until a human clicks Approve)
```

- **Reson8 is the ears:** live transcription, speaker separation, recognition tuned to scam vocabulary. The browser streams audio with a short-lived token and never sees the API key.
- **Claude Haiku 5.5 is the reflex:**
  - It scores every sentence in about 1.5–2 s with structured outputs.
  - It re-reads the whole call each time, because scams only make sense as a story.
  - It identifies the caller from the content, not from who spoke first.
  - It writes the receiver's warning in the same step, so the alarm needs no extra round-trip.
- **Claude Opus 5.5 is the brain:**
  - It only runs on scam calls, as an agent on the SDK tool runner.
  - It alerts the trusted contact with the caller's exact words and writes a police report from the transcript only.
  - When money is demanded, it asks a human to approve calling 110.
- **Why two models:** in our eval Haiku matched Opus on every scam that asked for money, about 1 s faster and at 1/40 of the price per token. The agent stays on Opus, where quality matters and it runs rarely.

## Evaluation

`npm run eval` replays labelled calls turn by turn through the **same code as the live system** (`scoreCall`, `levelFor` and `escalate` from `server/scorer.ts`). It never starts the agent or sends notifications.

```bash
npm run eval                              # both datasets, both modes (~1,300 scorer calls, ~10 min)
npm run eval -- --limit 10 --only demo    # quick smoke run (5 scam + 5 normal)
```

> Every run overwrites `public/eval-results.json`, which feeds the dashboard's evaluation view. That includes `--limit` runs, so re-run the full eval afterwards.

**Datasets and modes:**
- **Datasets:** 80 public test calls (`eval/dataset.json`; source, license and caveats in [eval/DATASET.md](eval/DATASET.md)) and 10 handwritten calls (`eval/demo-scripts.json`).
- **Modes:** `full` is the whole transcript. `caller` drops the receiver's lines, so the score can't lean on the receiver pushing back.
- **Lead:** the money-request turn minus the alarm turn. A positive number means the alarm came *before* the caller asked for money, cards, PINs or remote access.

**Results** (scorer Claude Haiku 5.5, effort `low`, thresholds 0.8 / 0.5, 0 errors). The scorer sees speaker-numbered lines. In half of the public calls the receiver's opening "Hello." is dropped, so the caller speaks first.

| Dataset | Mode | Scams caught | False alarms | Normal calls ≥ caution | Alarm vs money request (median) | Caller identified (after 2nd caller turn / end) | Scorer latency p50 / p95 |
|---|---|---|---|---|---|---|---|
| Public (80) | full | 38/40, **36/36 that asked for money** | **0/40** | 3/40 | on the money-request turn | 68/70 / **80/80** | 2.0 s / 8.5 s |
| Public (80) | caller only | 37/40, 36/36 that asked for money | 0/40 | 0/40 | on the money-request turn | n/a | 1.6 s / 3.2 s |
| Handwritten (10) | full | **5/5** | **0/5** | 0/5 | **4 turns before** | 10/10 / 10/10 | 1.5 s / 2.1 s |
| Handwritten (10) | caller only | 5/5 | 0/5 | 0/5 | 4 turns before | n/a | 1.6 s / 2.3 s |

- **Misses:** the 2 missed public scams are calls where the receiver hung up before any request.
- **Caution:** the 3 normal calls at `caution` showed yellow only, with no warning and no alarm.
- **Latency:** the 8.5 s p95 came from a few slow API responses during that run; an earlier Haiku run of the same set had a p95 of 3.3 s.
- **Opus comparison:** with Claude Opus 5.5 as the scorer: 36/40 (36/36 that asked for money), 0/40 false alarms, 80/80 callers identified, p50 2.6 s.

**Caveat:** the public dataset is synthetic, US-centric and English-only. Read these numbers as a sanity check, not as real-world accuracy.

## Privacy and safety

- Audio is processed live and never stored. Reson8 keeps no audio and runs on EU servers.
- The transcript lives only in memory for the current call. Nothing is recorded, which matters in Germany, where §201 StGB covers recording calls.
- A human must approve any call to the police. In this demo the call is simulated.
- The agent (Opus) uses Anthropic's server-side refusal fallback. Haiku has no server-side fallback; if a sentence is ever declined, the next sentence re-scores the whole call.

## Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | (none) | Claude API key |
| `RESON8_API_KEY` | (none) | Reson8 key, needed for live listening only |
| `SCORER_MODEL` / `SCORER_EFFORT` | `claude-haiku-5-5` / `low` | Model that scores every sentence |
| `AGENT_MODEL` / `AGENT_EFFORT` | `claude-opus-5-5` / `low` | Model that acts once a scam is detected |
| `CALL_LANGUAGE` | `en` | Reson8 language code; scam phrases exist for `en` and `de` |
| `NTFY_FAMILY_TOPIC` / `NTFY_PHONE_TOPIC` | (none) | Optional [ntfy](https://ntfy.sh) push topics for the trusted contact and the receiver; without them, alerts show on the dashboard |
| `SCAM_THRESHOLD` / `CAUTION_THRESHOLD` | `0.8` / `0.5` | Risk levels for red and yellow |

## Troubleshooting

| Symptom | Fix |
|---|---|
| The Reson8 or Claude chip in the footer is red | The key is missing from `.env`. Add it and restart `npm run dev`. |
| "Listening stopped: …" under the header | Check the Reson8 key and the microphone permission. Replay still works without them. |
| No alarm tone | Browsers need one click first: click **Sound off**, then **Sound on**. |
| The alarm sounds twice | A second dashboard tab is open (the footer says "2 screens connected"). Close it. |
| Amber "server is running older code" banner | Restart `npm run dev` and reload the page. |

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/config` | Which keys and features are configured, models, thresholds |
| GET | `/api/events` | Server-Sent Events stream of the call (`state`, `segment`, `score`, `alarm`, `roles`, `agent`, `family`, `report`, `approval`, `hangup`, `error`, `screens`). `?client=phone` marks a phone view |
| GET | `/phone` | The receiver's screen alone, for a real phone |
| GET | `/api/reson8/session` | Short-lived Reson8 token and WebSocket URL |
| POST | `/api/segment` | `{ speakerId, text }`: add a transcript sentence |
| POST | `/api/replay` | `{ id }`: replay a scripted call (`GET /api/scripts` lists them) |
| POST | `/api/approval/:id` | `{ approve }`: decide on the agent's "call 110" request |
| POST | `/api/reset` · `/api/hangup` · `/api/roles/swap` | New call · end the call · swap the Caller and Receiver labels |

## Project layout

```
server/
  index.ts      HTTP routes
  pipeline.ts   segment → score → level → warning → agent → approval
  scorer.ts     Claude scorer (structured outputs) + risk levels
  agent.ts      Claude agent + tools (tool runner)
  hub.ts        call state + Server-Sent Events
  reson8.ts     Reson8 token + WebSocket URL
  notify.ts     ntfy push notifications
  replay.ts     scripted calls without audio
public/         dashboard (one page, no build step): index.html, app.js, style.css, audio-worklet.js
eval/           run-eval.ts, the datasets, DATASET.md
docs/           DEMO_SCRIPT.md (live demo runbook), screenshot
openspec/       the team's specs and change history
```

## Built with

- [Reson8](https://reson8.dev) realtime speech-to-text
- [Anthropic Claude API](https://platform.claude.com): `@anthropic-ai/sdk` tool runner, structured outputs, Claude Haiku 5.5 (scorer) and Claude Opus 5.5 (agent)
- TypeScript, Express, Zod, tsx; [ntfy](https://ntfy.sh) for optional push notifications
- Test data: [BothBosu/multi-agent-scam-conversation](https://huggingface.co/datasets/BothBosu/multi-agent-scam-conversation) (Apache-2.0)

All project code was written during the hackathon on 24 Oct 2026.
