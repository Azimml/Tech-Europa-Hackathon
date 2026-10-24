# Schutzengel: a guardian angel for phone calls

> Built at the **Agentic AI Hack by Jamie × {Tech: Europe}**, Berlin, 24 Oct 2026, with **Reson8** and **Anthropic Claude**.

Schutzengel listens to an older person's phone call on speakerphone and transcribes it live with Reson8. Claude scores every sentence for scam signals. The moment it becomes a scam, Schutzengel warns her on her phone, alerts her daughter, drafts a police report, and asks a human to approve calling the police.

## Why

Every day, fake police officers, "grandchildren in trouble", fake bank fraud departments and fake tech-support agents call older people and talk them out of their savings. These scams build up over several minutes: an authority claim, then fear, then secrecy, then the request for money. By the time the victim notices, the money is gone. Schutzengel catches the scam while the call is still running.

## How it works

```
Phone call on speaker → laptop microphone
  → Reson8 realtime speech-to-text (2 speakers separated, scam vocabulary passed as "phrases")
  → Claude scorer after every sentence: risk + 4 signals as strict JSON
       claims authority · asks for money/valuables/PIN/remote access · pressure · secrecy
  → risk level: safe → caution → scam   (during a call it only goes up)
  → on "scam": instant warning on grandma's phone (no waiting for the agent)
  → Claude agent with tools:
       warn_grandma → notify_family (ntfy push) → draft_police_report
       → request_police_call (nothing is dialled until a human clicks Approve)
```

- **Reson8** is the ears: live transcription, speaker separation, and recognition tuned to scam vocabulary.
- **Claude** is the brain:
  - A scorer re-reads the whole call after each sentence, because scams only make sense as a story.
  - An agent acts on its own but keeps a human in control of the irreversible step (calling the police).

## Status: handoff

### Done
- **Server** (TypeScript, Express), passes `npm run typecheck`:
  - [x] Live call state, pushed to every screen over Server-Sent Events
  - [x] Reson8 token minting, so the browser streams audio without ever seeing the API key
  - [x] Claude scorer with structured outputs (`server/scorer.ts`)
  - [x] Claude agent with 4 tools on the SDK tool runner (`server/agent.ts`)
  - [x] Human approval flow for calling the police
  - [x] Push notifications through ntfy
  - [x] Replay of scripted calls through the real pipeline, with no microphone needed
- **Test data:** 80 calls (40 scam, 40 normal) from a public dataset in `eval/dataset.json`. Source, license and caveats are in [eval/DATASET.md](eval/DATASET.md).
- **Demo content:** 10 handwritten demo calls in `eval/demo-scripts.json`, and the 5-minute live-demo runbook in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

### Next, in order
1. **Dashboard** `public/index.html`:
   - Microphone capture: an AudioWorklet resamples to 16 kHz PCM16 and sends it to the Reson8 WebSocket, then `POST /api/segment` with each final sentence.
   - Panels: live transcript (interim text in grey), risk meter and the 4 signal bars, agent step log, police report, the "Call 110?" approve card, and metrics (reaction time, scorer latency).
2. **Phone page** `public/phone.html` (installable web app): a big green / yellow / red status. On a scam, the whole screen turns red, the phone vibrates and the warning is read aloud. One tap on "Start protection" first, because browsers require a tap before they allow sound or vibration.
3. **Eval runner** `eval/run-eval.ts` (`npm run eval`): feed each test call turn by turn and report scams caught, false alarms, turns until detection, and scorer latency. Run it both on full transcripts and on caller turns only (see the caveats in DATASET.md).
4. **Keys:** add them to `.env`, test with a real phone call on speaker, and tune `SCAM_THRESHOLD` / `CAUTION_THRESHOLD` using the eval.
5. **Stage setup:**
   - Run `cloudflared tunnel --url http://localhost:3000` so the phone can open `/phone` over https.
   - Create two ntfy topics: one for grandma's phone, one for the daughter's phone.
   - Mirror the phone on the projector with `scrcpy`.
6. **Rehearse** [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) twice and record a backup run.
7. **Submit by about 18:30.** The deadline is 19:00, but the live dashboard countdown can differ from it. Submit:
   - this public repo with the README
   - a 2-minute video of the product in use
   - a written explanation of the project

## Run it

```bash
npm install
cp .env.example .env     # add RESON8_API_KEY and ANTHROPIC_API_KEY
npm run dev              # http://localhost:3000  ·  phone page: http://localhost:3000/phone
```

To test without a microphone, replay a scripted call and watch the event stream:

```bash
curl -N http://localhost:3000/api/events          # terminal 1
curl -X POST http://localhost:3000/api/replay \
  -H "Content-Type: application/json" -d '{"id":"scam-fake-police"}'   # terminal 2
```

## Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `RESON8_API_KEY` | (none) | Reson8 key from console.reson8.dev |
| `ANTHROPIC_API_KEY` | (none) | Claude API key |
| `SCORER_MODEL` / `SCORER_EFFORT` | `claude-opus-5-5` / `low` | Model that scores every sentence |
| `AGENT_MODEL` / `AGENT_EFFORT` | `claude-opus-5-5` / `low` | Model that acts once a scam is detected |
| `CALL_LANGUAGE` | `en` | Reson8 language code; scam phrases exist for `en` and `de` |
| `NTFY_FAMILY_TOPIC` | (none) | ntfy topic on the daughter's phone |
| `NTFY_PHONE_TOPIC` | (none) | ntfy topic on grandma's phone (backup for the phone page) |
| `SCAM_THRESHOLD` / `CAUTION_THRESHOLD` | `0.8` / `0.5` | Risk levels for red and yellow |

Both Claude calls use Anthropic's server-side refusal fallback (`fallbacks: "default"`). If a safety classifier declines a request, the API retries it on a fallback model instead of failing.

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/config` | Which keys and features are configured |
| GET | `/api/events` | Server-Sent Events stream. Event types: `state`, `segment`, `score`, `alert`, `agent`, `family`, `report`, `approval`, `hangup`, `error` |
| GET | `/api/reson8/session` | `{ token, url }`: short-lived Reson8 token plus the WebSocket URL with all parameters |
| POST | `/api/segment` | `{ speakerId, text }`: add a final transcript sentence. The first speaker becomes "grandma", the other "caller" |
| POST | `/api/roles/swap` | Swap the caller and grandma labels if speaker separation got them backwards |
| POST | `/api/reset` | Start a new call |
| GET | `/api/scripts` | List the replayable scripted calls |
| POST | `/api/replay` | `{ id }`: replay a scripted call through the pipeline |
| POST | `/api/approval/:id` | `{ approve: true \| false }`: decide on the agent's "call 110" request |
| POST | `/api/hangup` | Mark the call as ended |

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
eval/
  dataset.json       80 test calls (public dataset)
  demo-scripts.json  10 handwritten demo calls
  DATASET.md         source, license, caveats
docs/
  DEMO_SCRIPT.md     live demo runbook
public/              dashboard + phone page (next)
```

## Privacy

- Audio is processed live and never stored: Reson8 keeps no audio and runs on EU servers.
- Transcripts live only in memory for the current call.
- Nothing is recorded. This matters in Germany, where §201 StGB covers recording calls.

## Built with, and prior work

- [Reson8](https://reson8.dev) realtime speech-to-text
- [Anthropic Claude API](https://platform.claude.com): `@anthropic-ai/sdk` tool runner, structured outputs, Claude Opus 5.5
- Express, Zod, tsx
- [ntfy](https://ntfy.sh) push notifications, Cloudflare quick tunnel, [scrcpy](https://github.com/Genymobile/scrcpy)
- Test data: [BothBosu/multi-agent-scam-conversation](https://huggingface.co/datasets/BothBosu/multi-agent-scam-conversation) (Apache-2.0)

All project code was written during the hackathon on 24 Oct 2026. The repository also contains the team's OpenSpec setup (`.claude/`, `openspec/`).
