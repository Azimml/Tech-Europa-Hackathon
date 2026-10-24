# Proposal

## Why

Rehearsals raised three issues:
- **The fixed persona names don't fit a product demo.** The dashboard, the agent prompts and the notifications all say "Erika" and "Lena", which ties the product to one fictional family.
- **The spoken warning gets in the way.** The laptop reading a sentence aloud talks over the people on the call, mutes the microphone for about 6 s, and sounds robotic.
- **The alarm moment doesn't stand out on screen.** All six dashboard panels have equal weight, so what Claude does after the alarm reads as a text log rather than a story.

## What Changes

- **Generic participant names everywhere in the product:**
  - **Caller** and **Receiver** (the person who answered) in the transcript, the scorer and agent prompts, and the swap control
  - **Trusted contact** for the family member who is alerted, in the agent's tool, the notification titles and texts, and the dashboard
  - The internal role id `grandma` becomes `receiver` in server and dashboard code. The dataset and demo-script JSON files keep `"grandma"` and are mapped on load.
  - Names spoken *inside* scripted call dialogue (e.g. the scammer asking for "Mrs. Erika Schneider") stay, because they are realistic call content.
- **An alarm sound instead of speech:**
  - When a call turns into a scam, the dashboard plays one short alarm tone (about 1.5 s, three pulses) and no longer reads anything aloud. The written warning on the receiver's screen stays.
  - The microphone stops sending audio to Reson8 while the tone plays (plus a short tail), so the gap in the transcript drops from about 6 s to about 2 s.
  - The **Voice on/off** toggle becomes **Sound on/off**.
  - **BREAKING** (dashboard behaviour): speech synthesis is removed.
- **A story layout for the dashboard:**
  1. a full-width **status bar** at the top: level, risk bar, scam type, Claude's quote, reaction time
  2. the **transcript** on the left
  3. a **phone mockup of the receiver's screen** next to the four **signal bars** on the right
  4. a **"Claude acts" step tracker** along the bottom: Alarm → Trusted contact alerted → Police report → Call 110? (Approve / Decline). Below the tracker, a detail area shows the selected step (by default the latest one): the trusted-contact message, the report, or the approval request. The raw agent log moves to an expandable "details" view.
  5. a slim footer with readiness, latency and the eval numbers

  The layout works at 1920×1080 and 1280×720. When idle, it shows a short "how it works" strip instead of empty panels.

## Capabilities

### New Capabilities
- `participant-naming`: the generic names used for the people in and around a protected call, across the dashboard, the prompts and the notifications.
- `alarm-sound`: how the alarm is made audible on the dashboard: one tone per alarm, no speech, a mic gate, and the sound toggle.
- `dashboard-layout`: the story-layout arrangement of the dashboard: status bar, transcript, receiver phone mockup, signals, action tracker with a detail area, footer, idle state and supported resolutions.

### Modified Capabilities
- None in `openspec/specs/`, which is still empty. **Conflicts to resolve** in the two unarchived changes, both of which this change replaces:
  - `build-hackathon-demo` → `call-dashboard`:
    - "Erika's screen panel", "Lena's alert card", "Spoken warning without self-transcription", the "Erika" labels, and the panel arrangement
  - `single-warning-and-caller-detection` → `scam-warning`:
    - "Exactly one warning per alarm" says the warning is "spoken once"
  - `single-warning-and-caller-detection` → `speaker-roles`:
    - uses "Erika" as the label

  The tasks include reconciling those specs.

## Impact

- **Server:**
  - `server/agent.ts`: prompts, the `notify_family` description, "trusted contact"
  - `server/pipeline.ts`: role id, labels, notification texts
  - `server/hub.ts`: `Role` type
  - `server/replay.ts`, `eval/run-eval.ts`: map `grandma` → `receiver` on load
  - `server/scorer.ts`: prompt wording "receiver"

  No change to scoring logic, thresholds or the eval method, so no full eval re-run is needed. A `--limit` smoke run confirms the prompt wording didn't change behaviour.
- **Dashboard:** `public/index.html`, `public/style.css` and `public/app.js` are largely rewritten for the layout. The reducer, the SSE client, the mic/Reson8 code and the worklet are kept.
- **Tests:** the browser tests in `/tmp/e2e` (replay, live mic, resilience, eval tile) are updated for the new selectors, the tone instead of speech, and the new labels.
- **Docs:** README (names, screenshot, status) and `docs/DEMO_SCRIPT.md` (cast as Caller/Receiver, the tone, the new screen walkthrough).
- **Earlier change:** task 5.4 of `single-warning-and-caller-detection` (the caller-first live test) is covered by this change's updated live test.
- No new dependencies.
