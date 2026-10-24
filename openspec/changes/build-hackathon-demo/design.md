# Design

## Context

What exists today, as read from `server/`:
- `pipeline.ts` turns segments into scores, levels, alerts, agent runs and approvals.
- `hub.ts` pushes every change as one SSE stream at `/api/events`. The first message is a full `state` snapshot. After it come incremental events: `segment`, `score`, `alert`, `agent`, `family`, `report`, `approval`, `hangup`, `error`.
- `index.ts` already serves `public/` statically, but the folder does not exist.
- `reson8.ts` mints a token and returns a fully parameterised WebSocket URL: PCM16, 16 kHz, mono, `diarize=true`, `max_speakers=2`, interim results, scam phrases.
- `replay.ts` drives scripted calls through the real pipeline.
- `notify.ts` already falls back to "shown on dashboard only" when no ntfy topic is set.

**Most of the system is already built.** This change adds one browser page and one eval script, plus one small server addition: the police-call follow-up (Decision 10).

Constraints:
- About 8 hours of work, then submit by about 18:30.
- One laptop, no phones.
- No new dependencies and no build step.
- A noisy hall.

`money_turn` in both datasets is a **0-based index** into `turns` (checked: `scam-fake-police` index 12 is the "collect your cash and jewelry" line).

## System design

```
  +------------------------------- ONE LAPTOP --------------------------------+
  |                                                                           |
  |   Teammate A (scammer) --+                                                |
  |                          +--> laptop mic                                  |
  |   Teammate B (Erika) ----+       |                                        |
  |                                  v                                        |
  |   +--------------- BROWSER: dashboard at localhost:3000 ---------------+  |
  |   |  AudioWorklet: mic -> 16 kHz PCM16 ---------------------------+    |  |
  |   |                                                               |    |  |
  |   |  [transcript] [risk + 4 signals] [Erika's screen] [Lena]      |    |  |
  |   |  [agent log]  [police report]    [Call 110? Approve]          |    |  |
  |   +------^------------------------------------------|-------------|----+  |
  |          | SSE (live state)       POST /api/segment |             |       |
  |   +------|------------------------------------------v-----+       |       |
  |   |      NODE SERVER  (built; +110 follow-up)              |       |       |
  |   |  segment -> scorer -> safe / caution / SCAM           |       |       |
  |   |               |  SCAM: instant warning                |       |       |
  |   |               v                                       |       |       |
  |   |            agent: warn Erika, tell Lena,              |       |       |
  |   |                   police report, ask "Call 110?"      |       |       |
  |   +------------|--------------------------------^---------+       |       |
  +----------------|--------------------------------|-----------------|-------+
                   v                                |                 v
            +-------------+                         |       +-------------------+
            | Claude API  |                         +-------| Reson8 realtime   |
            | scorer +    |      final sentences + speaker  | STT (WebSocket),  |
            | agent       |      come back to the browser   | speaker 0 / 1     |
            +-------------+                                 +-------------------+
```

Only four moving parts: **browser, Node server, Reson8, Claude.** The browser is the only new code, apart from the offline eval script.

### How the two voices are separated

The two people speak into the same mic. Reson8's diarization groups sentences by voice (pitch, timbre) into speaker 0 and speaker 1. The server labels whichever speaker talks first as Erika. The demo makes this reliable in three ways:
1. Erika always opens with "Hello?".
2. The speakers take turns with a short pause.
3. Pick teammates with clearly different voices.

If the labels still come out backwards, use the Swap button. If they're missing, the scorer's prompt already tells Claude to work out who is calling from what is said.

### The moment that wins the demo

```
 t ->  caller: "Detective Inspector"  "savings unsafe"   "don't tell Lena"   "officer collects cash"
               |                       |                  |                   |
 Reson8        ~0.3-0.8 s final per sentence
 Claude score  ~1-3 s:  CAUTION        pressure up        secrecy up          SCAM
 dashboard     authority bar + quote   pressure bar       secrecy bar         ALARM (< 200 ms)
                                                                              |
     +------------------------------------------------------------------------+
     v
     0 s     Erika's panel RED + laptop speaks the warning (mic paused while speaking)
     3-8 s   Claude agent: better warning -> Lena's card -> police report -> "Call 110?"
     human   presenter clicks Approve
```

### Dashboard layout (one 16:9 projected screen)

```
+--------------------------------------------------------------------------------+
| SCHUTZENGEL  (*) LISTENING  [Listen] [End/Reset] [Swap] [Voice on] [Replay v][>] |
+-------------------------------+----------------------+-------------------------+
| LIVE TRANSCRIPT               | RISK [###########--] | ERIKA'S SCREEN          |
|  Erika:  Hello?               |  0.86   *** SCAM *** | +---------------------+ |
|  Caller: This is Detective... |  fake_police         | |  !! THIS IS NOT THE | |
|  Erika:  The police? ...      | Authority [#######]  | |  POLICE. HANG UP.   | |
|  Caller: ...collect your cash | Money ask [###### ]  | |  Do not hand over   | |
|  Caller: (grey) and stay o... | Pressure  [#####  ]  | |  money.             | |
|                               | Secrecy   [###### ]  | +---------------------+ |
|                               | "officer will        | reaction: 1.9 s         |
|                               |  collect your cash"  |                         |
+-------------------------------+----------------------+-------------------------+
| CLAUDE AGENT                  | POLICE REPORT        | LENA'S ALERT            |
|  > warn_grandma               |  claimed: Det. Insp. |  "Mum is getting a fake |
|  > notify_family              |  demands: cash, 9pm  |   police call..."       |
|  > draft_police_report        |  +----------------+  |  "don't tell your       |
|  > request_police_call        |  |CALL 110?       |  |   daughter"             |
|                               |  |[Approve][Decl.]|  |                         |
+-------------------------------+--+----------------+--+-------------------------+
| scorer p50 1.4 s | Reson8 ok  Claude ok | EVAL: 39/40 caught, 0/40 false, +3 turns |
+--------------------------------------------------------------------------------+
```

## Goals / Non-Goals

**Goals:**
- Every pipeline stage is visible on one projected screen, so judges can see what Reson8 and Claude each contribute.
- The demo still works when the mic, network or Reson8 fails, by falling back to replay with the identical UI.
- A believable eval number that comes from the production scorer code path.
- No changes to the scorer, and only one additive change to the pipeline, so nothing that already works can break.

**Non-Goals:**
- Phones, tunnels, push notifications, installable apps.
- A separate window per persona. Erika and Lena are panels on the one screen.
- Responsive layout. It's a fixed 16:9 projector layout.
- Persistent storage, parallel calls, API auth.

## Decisions

1. **One static page (`index.html` + `style.css` + `app.js` + `audio-worklet.js`), no framework or bundler.**
   The server already serves `public/`, and SSE plus a small render function is a few hundred lines.
   - *Alternatives*: Vite + React (setup time, a build step, a new dependency).

2. **State-reducer client.** The client keeps one `call` object. It replaces it on each `state` event and patches it on incremental events, then re-renders whole panels. This makes reconnects trivial: `EventSource` reconnects automatically, and the server sends a fresh snapshot.
   - *Alternative*: direct DOM updates per event. It drifts when the page joins a call midway.

3. **Audio: an AudioWorklet resamples to 16 kHz PCM16 in the browser and sends binary frames straight to Reson8.**
   - `getUserMedia` with `echoCancellation: true` (it also helps against the laptop's own spoken warning), `noiseSuppression: true`, `autoGainControl: true`. The voices are live in front of the mic, so the browser's default voice processing helps here.
   - Linear-interpolation downsampling, 20 ms frames.
   - The server never touches audio, which keeps latency and the privacy claim intact.
   - *Alternative*: proxy the audio through Node. That adds a hop and gives no benefit.

4. **Parsing Reson8 messages is isolated in one function** (`toTranscriptEvent(msg) -> {kind: interim|final, speakerId, text}`), so the unknown message format only touches one place. The first build task is a 20-minute spike that logs real messages from two people speaking at the mic. If diarization gives no speaker id, send `speakerId: null`.
   - **Found in the spike:** Reson8's interim text keeps growing across both speakers, and finals only arrive about 3 s after a pause. A `flush_request` returns finals in about 0.3 s, already split per speaker. So the client runs simple voice-activity detection (an RMS level against an adapting noise floor) and flushes after 600 ms of silence, or after 15 s of continuous sound in a noisy room.
   - The socket is opened *before* the mic starts. Otherwise Erika's opening "Hello?" is lost, which flips the speaker roles.

5. **Get the roles right through the script, not by changing the server.** `pipeline.roleFor` labels the first speaker as Erika, so the runbook starts with Erika's "Hello?". The Swap button is the safety net.
   - *Alternative*: change the server heuristic. Rejected: the script fixes it at no cost.

6. **Spoken warning with a mic gate.** `speechSynthesis` speaks each distinct warning text once, and the Listen or Replay click counts as the user gesture that unlocks audio.
   - While `speechSynthesis.speaking` is true, the client drops audio frames instead of sending them to Reson8. This keeps the warning from being transcribed back into the call.
   - Echo cancellation (Decision 3) is the second layer of protection.
   - A "Voice on/off" toggle covers a hall where audio is a problem.
   - *Alternative*: stop listening at the alarm. Rejected, because the "don't hang up" line after the money request is part of the story.

7. **Erika and Lena are panels, not windows.** Erika's panel comes from `call.level` and `call.warning`. Lena's card comes from `call.family`. No new server state is needed. The ntfy fallback text ("shown on dashboard only") is shown honestly on the card.

8. **The eval imports `scoreCall`, `levelFor` and `escalate` directly from `server/scorer.ts`** instead of going through HTTP replay. This uses the same prompt, schema, thresholds and escalation, with no agent and no real-time pacing.
   - Concurrency is a promise pool (`EVAL_CONCURRENCY`, default 6). Flags: `--limit N`, `--only dataset|demo`, `--mode full|caller|both`.
   - Turns within a call run in order. Each call stops early once it reaches scam level, because the level can't go back down.
   - In caller-only mode, keep a mapping to the original turn index. Lead = `money_turn - alarm_turn`, so a positive number means the alarm came before the money request.
   - Results go to `public/eval-results.json`, which the dashboard loads with a 404-tolerant fetch.
   - Estimated cost: about 1,500 to 2,000 short requests. Run `--limit 10` first.

9. **The eval decides the scorer model.** The default is Opus 5.5 at effort `low`. If eval p50 latency is above ~2.5 s, re-run with `SCORER_MODEL=claude-haiku-5-5` and choose. This is a config change only.

10. **Police-call follow-up after a later money demand** (found while testing).
   - The alarm usually fires on secrecy, 4 turns before the money request. The agent runs once and, following its rules, does not request 110 without a demand.
   - The fix: after the alarm, each new score is checked. If `asks_money` ≥ 0.8, it is higher than at any earlier follow-up, there is no approval yet, and the agent is idle, a follow-up pass runs. If the money score arrives while the first agent pass is still running, the check repeats when that pass finishes.
   - The follow-up only has `draft_police_report` (to add the demand and handover details) and `request_police_call`. It has no tool to warn or notify, so nothing is spoken mid-call. It runs at most 2 times per call.
   - On stage this gives two beats: the early warning on the secrecy line, then "Call 110?" on the money line.
   - *Alternatives*:
     - Loosen the agent's rule so it requests 110 without a demand. Rejected: weaker evidence.
     - Re-run the full agent. Rejected: it would repeat the warnings and notifications.

## Risks / Trade-offs

- **[Two live voices through one mic are harder to separate than phone audio vs room audio]** → Use clearly different voices, take turns with pauses, and have Erika open with "Hello?". The Swap button is the backup, and the scorer judges from content when labels are wrong. Check this in the first-hour spike.
- **[Reson8 message format differs from assumptions]** → One adapter function, tested in the spike.
- **[Hall noise]** → Speak 20-30 cm from the laptop, with noise suppression on. Fallback: replay mode, said openly on stage.
- **[The laptop's spoken warning gets transcribed]** → The mic gate (Decision 6) plus echo cancellation. The Voice toggle is the last resort.
- **[Scorer latency makes the meter lag the speakers]** → Pauses in the runbook. Sentences that arrive during a score are merged into the next one. Eval picks the model. The latency tile keeps it honest.
- **[Alarm fires early or late on the stage script]** → Rehearse with replay plus live runs, and tune the thresholds using the eval report. Write down which line triggers each level.
- **[Eval numbers look too good on synthetic data]** → Show both modes, and state the caveats from `eval/DATASET.md`.
- **[Time overrun]** → A replay-driven demo has to work by hour 3.5. Polish comes only after the full rehearsal.

## Migration Plan

Additive only: `npm run dev`, then open `http://localhost:3000` on the projector. To roll back, delete `public/`. The server is untouched.

## Open Questions

- The exact Reson8 realtime message schema (interim vs final flag, where the speaker id lives). Answered by the spike; it only touches the adapter.
