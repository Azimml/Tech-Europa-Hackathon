# Tasks

Time budget: about 8 h, submit by 18:30. With two people, groups 2 and 4 (dashboard) and group 3 (eval) run in parallel. Hard checkpoint: by hour 3.5 a replay-driven demo must work end to end on the dashboard.

```
 h0     h1          h2          h3    h3.5      h4.5       h5.5            h7         h8
 |--1--|-----2 dashboard (replay)------|--4 live mic--|--5 tune--|--6 rehearse--|--7 submit--|
       |----3 eval-----------|                        ^
                                   ^ CHECKPOINT: replay demo works
```

## 1. Setup and spikes (h0, ~45 min)

- [x] 1.1 Copy `.env.example` to `.env` and add `ANTHROPIC_API_KEY` and `RESON8_API_KEY` (leave the ntfy topics empty). Verify by starting `npm run dev` with no "missing key" warnings and checking that `curl localhost:3000/api/config` shows `reson8` and `anthropic` as `true`
- [x] 1.2 Smoke-test the existing pipeline without UI: run `curl -N localhost:3000/api/events` and `POST /api/replay {"id":"scam-fake-police"}`. Verify that `score` events climb to `scam`, then `alert`, `agent`, `family`, `report` and `approval` events arrive. Note the scorer `latencyMs`
- [x] 1.3 Reson8 spike: a throwaway page that streams the laptop mic and `console.log`s the raw messages while two teammates take turns talking. Verify by recording which fields mark interim vs final, where the speaker id lives, and whether the two voices get different ids reliably, as a comment at the top of `toTranscriptEvent` in `public/app.js`

## 2. Dashboard on replay (h1-h3.5, call-dashboard)

- [x] 2.1 In `public/app.js`, build an EventSource client plus a reducer (replace on `state`, patch on `segment`/`score`/`alert`/`agent`/`family`/`report`/`approval`/`hangup`/`error`) and a connected flag with a "reconnecting" indicator. Verify by opening the dashboard mid-replay (it renders the full call so far), and by restarting the server (the indicator shows, then it recovers)
- [x] 2.2 Create `public/index.html` + `public/style.css` with the 16:9 grid from design.md (header controls, transcript, risk panel, Erika's screen, agent log, police report + approval, Lena's alert, metrics bar), using high contrast and large type. Verify that it reads from 5 m away on the projector or a large screen
- [x] 2.3 Render the transcript with Erika/Caller/Unknown labels and auto-scroll. Add the Swap speakers button (`POST /api/roles/swap`). Verify that the labels flip during a replay
- [x] 2.4 Render the risk meter, the level colour state and the 4 signal bars. On first crossing 0.6, highlight the signal and attach that score's `reason`. Show `scam_type`. Keep the displayed level monotonic. Verify with `scam-fake-police` (bars light up step by step) and `normal-grandson-lunch` (stays green)
- [x] 2.5 Erika's screen panel: green "Protected" / yellow "Be careful" / red with the warning in huge type, plus the alarm state on the `alert` event with reaction time from `reactionMs`, and the text replaced when the `source: "claude"` alert arrives. Reset to green on a new call. Verify with replay: green → yellow → red, default warning then Claude's warning
- [x] 2.6 Spoken warning: `speechSynthesis` speaks each distinct warning text once, with a "Voice on/off" toggle in the header (the Listen/Replay click unlocks audio). Verify with replay that the default and Claude warnings are each spoken exactly once and that muting silences them
- [x] 2.7 Render the agent step log, Lena's alert card (summary, quotes, "shown on dashboard" vs delivered note) and the police report card (all fields + key quotes). Verify after a full replay that all three are populated
- [x] 2.10 Police-call follow-up in `server/pipeline.ts` + a follow-up mode in `server/agent.ts` (design Decision 10). Verify with replay of `scam-fake-police`: after the money line, a pending approval appears and the report's demands/handover mention the cash and jewelry pickup. With `normal-grandson-lunch`, no follow-up runs. `npm run typecheck` passes
- [x] 2.8 "Call 110?" card with reason, evidence and Approve/Decline buttons (`POST /api/approval/:id`). Show approved/declined state and the "simulated in this demo" note, and treat a 409 response as "already decided". Verify that a second click leaves the status unchanged
- [x] 2.9 Controls and tiles: End call/Reset (`/api/reset`), Hang up (`/api/hangup`), a replay picker filled from `/api/scripts`, readiness chips (Reson8, Claude) from `/api/config`, and a scorer-latency tile. Verify that every control works during a replay and that removing `RESON8_API_KEY` turns its chip red

## 3. Evaluation harness (h1-h3, scam-eval)

- [x] 3.1 Create `eval/run-eval.ts`: load both datasets, flags `--limit`, `--only dataset|demo`, `--mode full|caller|both`, `EVAL_CONCURRENCY` (default 6), and a promise pool across calls with sequential turns within a call. Verify that `npm run eval -- --limit 3 --only demo` prints progress
- [x] 3.2 Per call, score each prefix with `scoreCall`, apply `levelFor` + `escalate`, and stop at the first `scam`. Retry a failed turn once, then record it as an error and keep the previous level. In caller-only mode, map back to the original turn index (`money_turn` is 0-based). Verify on `scam-fake-police` that the alarm turn and lead (`money_turn - alarm_turn`) are printed
- [x] 3.3 Aggregate per dataset × mode: detection rate, false alarm rate, caution rate on normal calls, median/min early-warning lead, p50/p95 latency, error count, missed-scam and false-alarm ids. Print a summary table. Verify that the `--limit 10` numbers look plausible
- [x] 3.4 Write `public/eval-results.json` (metrics + model, effort, thresholds, timestamp, misses). Verify that it is served at `/eval-results.json` as valid JSON
- [x] 3.5 Add the dashboard eval tile (fetch `/eval-results.json`, hide on 404): caught X/40, false alarms Y/40, median lead +N turns, p50 latency. Verify that the tile appears after a run and disappears when the file is deleted
- [x] 3.6 Add an "Evaluation" section to `README.md` with the command, flags and how to read the metrics (lead > 0 = warned before the money request). Link the caveats in `eval/DATASET.md`. Verify that the documented command runs as written

## 4. Live listening (h3.5-h4.5, call-dashboard)

- [x] 4.1 Create `public/audio-worklet.js`: downsample float32 at the context rate to 16 kHz PCM16 and post 20 ms `Int16Array` frames. Verify in the browser console that 48 kHz input yields 320-sample frames
- [x] 4.2 Listen button: `getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}})` → worklet → `GET /api/reson8/session` → open the WebSocket the way the 1.3 spike found it works → send binary frames. Add a listening indicator and a stop control. Show the error inline when the session call fails. Verify that speaking produces Reson8 messages
- [x] 4.3 Implement `toTranscriptEvent` from the spike notes. Show interim text as a grey line. On final, `POST /api/segment {speakerId, text}` (`null` if absent) and clear the interim line. Verify that two teammates talking in turn appear as correctly labelled final lines
- [x] 4.4 Mic gate: drop audio frames while `speechSynthesis.speaking` is true. Verify in a live run that the spoken warning creates no transcript segment and that listening resumes afterwards
- [ ] 4.5 Live end-to-end run of the scam script by two teammates at the laptop. Verify that the level reaches scam on the money-request line and that the agent outputs arrive. Note the per-line latency

## 5. Tune and harden (h4.5-h5.5)

- [x] 5.1 Run the full eval (`--mode both`) with the default scorer. If p50 latency > ~2.5 s, re-run with `SCORER_MODEL=claude-haiku-5-5` and choose a model. Adjust `SCAM_THRESHOLD`/`CAUTION_THRESHOLD` only if the eval supports it. Verify that the chosen config is written in `.env` and that `public/eval-results.json` reflects it
- [x] 5.2 Replay all 10 demo scripts. Verify that all 5 scams reach scam and that all 5 normal calls stay below scam. Write down which line triggers caution and scam for `scam-fake-police`
- [x] 5.3 Rewrite `docs/DEMO_SCRIPT.md` for one laptop: cast (scammer + Erika at the mic, presenter at the keyboard), Erika's "Hello?" as line 0, the observed trigger lines, which panel to point at when, a pre-flight checklist (readiness chips green, Voice on, mic permission granted, replay picker set to `scam-fake-police`, Swap button location) and the replay fallback. Remove the phone, tunnel, ntfy and scrcpy instructions. Verify that a teammate can run the demo from it without asking questions
- [x] 5.4 `npm run typecheck` passes with `eval/run-eval.ts` included. Verify the exit code is 0

## 6. Rehearsal (h5.5-h7)

- [ ] 6.1 Rehearse the full 5-minute runbook live twice with a timer, once in a noisy spot. Verify that both runs finish under 5:00 with the alarm on the money line
- [ ] 6.2 Record a backup screen recording of a full live run (with audio) and capture the footage for the 2-minute video. Verify that the files play back with clear audio

## 7. Submission (h7-h8, done by 18:30)

- [ ] 7.1 Update `README.md`: status ticks (dashboard, eval), the laptop-only setup, the eval headline numbers, a dashboard screenshot in alarm state, and remove the phone/tunnel/ntfy steps from "Next". Verify that the README renders correctly on GitHub
- [ ] 7.2 Edit and upload the 2-minute video, and write the project explanation (problem, Reson8 + Claude roles, human-in-the-loop, eval + caveats, privacy). Verify that the submission form is accepted before 18:30

## Workflow follow-up

- After the hackathon, sync the specs and archive the change with `/opsx:archive`.
