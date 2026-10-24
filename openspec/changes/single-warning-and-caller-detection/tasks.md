# Tasks

Estimated about 2.5 h including the eval re-run. Browser tests reuse the harness in `/tmp/e2e` (puppeteer-core with the system Chrome). If it's gone, recreate it as in the previous change.

## 1. Scorer: warning + caller identification (scam-warning, speaker-roles)

- [x] 1.1 In `server/scorer.ts`:
  - change `Turn` to `{ speaker: string; text: string }` and print lines as `Speaker N: …`
  - add `warning` (string) and `caller_speaker` (`"unknown" | "1" | "2"`) to `OUTPUT_SCHEMA` and `SignalsSchema`
  - extend the system prompt: decide roles from content, "unknown" unless clear, warning ≤ 25 words, specific, empty when risk < 0.5, no claims that Lena or the police have been told

  Verify that `npm run typecheck` passes after the callers are updated (1.2, 3.x)
- [x] 1.2 Add `FALLBACK_WARNINGS` (one fixed text per `SCAM_TYPES` entry, general text for none/other) and `warningFor(signals)` (use `signals.warning` if non-empty and ≤ 40 words, else the fallback). Verify with a small `tsx` check script that an empty warning with `fake_bank` returns the bank text, and that a 60-word warning falls back

## 2. One warning per alarm (scam-warning)

- [x] 2.1 In `server/pipeline.ts`: remove `DEFAULT_WARNING`. `onScam` uses `warningFor(score.signals)` for `call.warning`, the single `alert` event, and the single phone push. Verify by replaying `scam-fake-police` with `curl -N /api/events`: exactly one `alert` event, and its text mentions police or secrecy rather than the old generic text
- [x] 2.2 In `server/agent.ts`: remove the `warn_grandma` tool and `AgentActions.warnGrandma`, renumber the alarm prompt steps, and state that Erika has already been warned. Remove the handler in `pipeline.ts`. Verify that the replay event stream has no `alert` event after the agent starts, and that the agent log still shows notify_family, the report and the 110 follow-up
- [x] 2.3 In `public/app.js`: on `alert`, set and speak the warning only if `call.warning` is empty. Remove any "replaced by Claude" assumptions. Verify with the replay browser test that `__spoken.length === 1` and that Erika's panel text never changes after the alarm

## 3. Speaker roles from content (speaker-roles)

- [x] 3.1 In `server/hub.ts`: add `speakers: string[]`, `rolesSource: "none" | "claude" | "manual"` and `pendingCaller` to `Call` and `newCall()`. Verify that `npm run typecheck` passes
- [x] 3.2 In `server/pipeline.ts`:
  - remove the first-speaker guess in `roleFor`: record speakers in order, role = `roles[key] ?? "unknown"`
  - send `{ speaker: label, text }` to `scoreCall`
  - add `adoptRoles(call, caller_speaker)` with the none / claude (2 consecutive disagreeing) / manual rules: relabel segments, broadcast `state` + a `roles` event
  - `transcriptText` uses Erika/Caller/Speaker N

  Verify via replay of `scam-fake-police` (the caller speaks first) that the caller's lines end up labelled Caller and Erika's lines Erika
- [x] 3.3 `swapRoles`: flip when identified, otherwise assign Speaker 1 = Erika / Speaker 2 = Caller; set `rolesSource = "manual"`. Verify that after a swap mid-replay, later scores don't change the labels, and that Reset brings back automatic identification
- [x] 3.4 `server/replay.ts`: remove the `setRoles` preset (and `setRoles` itself if unused). Verify that `normal-grandson-lunch` (Erika first) and `scam-fake-police` (caller first) are both labelled correctly
- [x] 3.5 `public/app.js` + `style.css`:
  - labels Erika / Caller / Speaker N (neutral style) / Speaker ? for interim lines from an unseen speaker
  - a 5 s note "Caller identified: Speaker N" on the switch to `claude`, and "Speakers set manually" after a swap

  Verify in the browser that the first line shows "Speaker 1" before identification, and that the note appears

## 4. Evaluation (speaker-roles, regression for scam-warning)

- [x] 4.1 In `eval/run-eval.ts`:
  - speaker-numbered turns
  - a deterministic caller-first variant for about half the calls (drop a leading receiver greeting of ≤ 3 words, keep the original indices)
  - record `caller_speaker` after the caller's 2nd turn and at the last scored turn (full mode)
  - add `rolesAfter2`/`rolesFinal` (overall and split caller-first / receiver-first) to the summary, the table and `eval-results.json`

  Verify that `npm run eval -- --limit 6 --only demo --mode full` prints the role accuracy
- [x] 4.2 Full eval re-run (`EVAL_CONCURRENCY=8 npm run eval`). Verify there is no regression:
  - public scams with a demand: 36/36 caught
  - 0/40 false alarms
  - demo 5/5 and 0/5
  - p50 latency ≤ 2.8 s
  - role accuracy reported

  If it regresses, tighten the prompt and re-run
  - Result (24 Oct): detection unchanged (36/36, 0/40, 5/5, 0/5). Caller ID 80/80 at the end and 70/70 after the 2nd caller turn on the public set, 10/10 demo. p50 full transcript 2.6 s public / 2.7 s demo ✓. **Exception:** demo caller-only p50 2.9 s (offline-only mode, n≈53, re-run after an API spike), about +0.3 s vs before because of the new output fields.
- [x] 4.3 Update the README Evaluation table (new numbers + the caller-identification row) and the description of warnings and roles in Status. Show role accuracy in the dashboard eval tile only if it fits on one line. Verify that the eval tile test passes

## 5. Docs, spec reconciliation and end-to-end tests

- [x] 5.1 Update `docs/DEMO_SCRIPT.md`:
  - Erika no longer has to speak first. Mention "Speaker 1/2 until Claude identifies the caller", as a beat to point at
  - the freeze after the alarm is now about 6 s (one warning)
  - remove the "Claude replaces the warning" narration
  - Swap = manual override

  Verify that the runbook matches the new behaviour in a replay walk-through
- [x] 5.2 Reconcile `openspec/changes/build-hackathon-demo/specs/call-dashboard/spec.md`:
  - "Scam alarm moment" no longer has Claude replacing the warning
  - "Spoken warning" is about one warning
  - "Live transcript with speaker roles" and "Speaker role correction" point to speaker-roles behaviour

  Verify that `openspec validate build-hackathon-demo --strict` and `openspec validate single-warning-and-caller-detection --strict` both pass
- [x] 5.3 Update the replay browser test: one spoken warning, Erika's text constant after the alarm, the caller-first labels correct on `scam-fake-police`, the "Caller identified" note, swap locking. Verify that `node /tmp/e2e/replay-test.mjs` reports ALL PASSED
- [x] 5.4 Update the live-mic browser test: make the audio caller-first (the scammer's "Hello, am I speaking with Mrs. Erika Schneider?" before Erika speaks), expect one spoken warning and the right labels. Verify that `node /tmp/e2e/live-mic-test.mjs` reports ALL PASSED, and that `resilience-test.mjs` still passes
  - Done in `generic-names-beep-story-ui` (task 5.2, `/tmp/e2e/story-live-test.mjs`): caller-first audio, correct Caller/Receiver labels, one alarm tone (the warning is no longer spoken, per that change), mic gated during the tone. ALL PASSED.
- [x] 5.5 Final checks: `npm run typecheck` and `openspec validate --strict` for both changes pass. Verify that both commands exit with code 0

## Workflow follow-up

- Archive `build-hackathon-demo` first, then this change, after the hackathon.
