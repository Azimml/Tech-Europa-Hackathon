# Tasks

Estimated about 3 h. Browser tests reuse `/tmp/e2e` (puppeteer-core with the system Chrome). Run browser tests only when no one else is using the dashboard on :3000, or start a second server on another port for them.

## 1. Generic names on the server (participant-naming)

- [x] 1.1 Rename the role id: `Role = "caller" | "receiver" | "unknown"` in `server/hub.ts`. Update `server/pipeline.ts` (roleFor, assignRoles, swap, comments). Add a `toRole()` mapping (`"grandma"` → `"receiver"`) used by `server/replay.ts` and `eval/run-eval.ts`; the JSON files stay unchanged. Verify that `npm run typecheck` passes and `grep -rn grandma server public` finds only the mapping helper
- [x] 1.2 Agent wording in `server/agent.ts`:
  - both prompts say "the receiver" / "their trusted contact", with no persona names
  - rename `notify_family` → `notify_trusted_contact` (description "Send an urgent push notification to the receiver's trusted contact")
  - update the `AgentActions` method name and the pipeline handler

  Verify that `grep -n -i "erika\|lena\|daughter" server/agent.ts` returns nothing and typecheck passes
- [x] 1.3 In `server/pipeline.ts`:
  - agent transcript labels "Caller" / "Receiver"
  - notification titles and texts become generic ("Scam call in progress", "Police call approved…"), with tool results saying "trusted contact"
  - in `server/scorer.ts`, the `warning` description says "shown on the receiver's screen" (not "read aloud") and "the receiver"

  Verify that `grep -rn -i "erika\|lena" server/*.ts` matches only `reson8.ts` (recognition phrases for scripted dialogue) and `replay.ts` built-in dialogue
- [x] 1.4 Eval smoke run: `npm run eval -- --limit 10` (both datasets, both modes; back up and restore `public/eval-results.json` afterwards). Verify that detection is unchanged on the subset (all scams with a demand caught, 0 false alarms) and caller identification is 100% on the subset

## 2. Alarm tone instead of speech (alarm-sound)

- [x] 2.1 In `public/app.js`:
  - remove `speechSynthesis` usage (`speak`, `unlockSpeech`, `voiceOn`)
  - add `unlockSound()` (create and resume an `AudioContext` on the first Listen/Replay/Sound click) and `playAlarm()` (three pulses 880/660 Hz, about 1.4 s, gain envelope)
  - play once per call (`alarmPlayedFor` guard), and stay silent when joining an alarmed call via a snapshot

  Verify in the browser test with a stubbed `AudioContext` that exactly one tone starts per scam call and none for a normal call or a mid-call join
- [x] 2.2 Mic gate on the tone: set `micGateUntil = now + duration + 400 ms` when the tone starts. `micGated()` no longer checks speech. There's no gate when sound is off. Verify in the live-mic test that no audio frames are sent during the tone window and that streaming resumes
- [x] 2.3 The `#voice` toggle becomes "Sound on/off" (`#sound`). Off means visual-only. Verify in the browser test that with sound off no tone starts and the alarm still renders

## 3. Story layout (dashboard-layout, participant-naming)

- [x] 3.1 Rewrite `public/index.html` into the named grid areas: status bar, transcript, receiver column (phone mockup + signals), tracker, details, footer, with generic headings and no persona names anywhere. Verify that the page loads with no console errors and `document.body.innerText` contains no "Erika"/"Lena" in the idle state
- [x] 3.2 Rewrite `public/style.css` for the story layout: status bar tinted by level with the alarm pulse, phone mockup, signal bars, tracker steps (waiting / in progress / done), details card, footer, idle pipeline strip, plus the 720p media query. Verify with screenshots at 1920×1080 and 1280×720 in idle, caution and scam+pending-approval states: no page scrollbar, and the status bar, the full warning, the 4 signals and the 4 steps all visible
- [x] 3.3 Rendering in `public/app.js`:
  - `renderStatus`, `renderPhone`, the signals (kept), `renderTranscript` (labels Caller/Receiver/Speaker N, idle strip when empty)
  - `renderTracker` (steps derived from `alertAt`, `family`, `report`, `approval`, agent status, with times from agent steps)
  - `renderDetails` (follow the latest step, click to select, Agent log in `<details>`)
  - Approve/Decline via `data-approve` in the tracker and details
  - the roles note and eval footer kept

  Verify through the replay test: steps turn done in order, the details area follows the latest step, clicking a step shows its content, and approval works with 409 → "already decided"
- [x] 3.4 Name sweep of the dashboard: the swap tooltip says "Swap Caller and Receiver labels", the roles note reads "Caller identified by Claude: Speaker N", Speaker N labels stay as they are. Verify that the replay test asserts no "Erika"/"Lena" in any rendered text outside the transcript and report in idle, caution and scam states

## 4. Docs and spec reconciliation

- [x] 4.1 Update `docs/DEMO_SCRIPT.md`:
  - cast as Caller (scammer) / Receiver, the presenter's narration about "the receiver" and "their trusted contact" (the scripted dialogue keeps the names)
  - the alarm is a tone, about 2 s of silence instead of about 6 s
  - the walkthrough follows the new screen order: status bar → phone → tracker steps → details → Approve
  - the pre-flight step "click Sound once"
  - the shot list updated

  Verify that the runbook mentions no speech/voice and that every screen element it names exists
- [x] 4.2 Update `README.md`: the names in Status/How it works, "alarm tone" instead of "read aloud", a new dashboard screenshot (`docs/dashboard-alarm.png`, retaken in scam + pending approval at 1920×1080). Verify that the README contains no "Erika"/"Lena" outside quoted call dialogue
- [x] 4.3 Reconcile the unarchived specs:
  - `build-hackathon-demo/specs/call-dashboard`: Erika's screen → Receiver's screen, Lena's alert → Trusted contact, spoken warning → alarm tone, layout → see dashboard-layout
  - `single-warning-and-caller-detection/specs/scam-warning` ("spoken once" → "one alarm tone") and `/specs/speaker-roles` (Erika → Receiver)

  Verify that `openspec validate --strict` passes for all three changes

## 5. End-to-end verification

- [x] 5.1 Update `/tmp/e2e/replay-test.mjs` for the new selectors and behaviour (tone stub, tracker, details, labels, no persona names), and run it. Verify that it reports ALL PASSED
- [x] 5.2 Update `/tmp/e2e/live-mic-test.mjs` (caller-first audio, one tone, mic gate on the tone window, Caller/Receiver labels) and run it on a quiet server. This also covers task 5.4 of `single-warning-and-caller-detection`. Verify that it reports ALL PASSED
- [x] 5.3 Run `resilience-test.mjs` and `eval-tile-test.mjs` (selectors updated). Verify that both report ALL PASSED
- [x] 5.4 Final: `npm run typecheck` exits 0, and `openspec validate --strict` passes for all three changes. Verify the exit codes

## Workflow follow-up

- Archive in order after the hackathon: `build-hackathon-demo`, `single-warning-and-caller-detection`, `generic-names-beep-story-ui`.
