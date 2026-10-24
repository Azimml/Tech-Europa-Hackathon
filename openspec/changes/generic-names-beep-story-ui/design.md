# Design

## Context

- **Names.** "Erika"/"Lena" appear in:
  - `server/agent.ts`: both system prompts and the `notify_family` description
  - `server/pipeline.ts`: transcript labels for the agent, three notification texts, a comment
  - `public/`: the `WHO` map, the panel headings `#erika` / `#lena`, the swap tooltip, the Lena card texts, CSS class names
  - the role id `grandma` in `Role` (`hub.ts`), `pipeline.ts`, `replay.ts` and `run-eval.ts`
  - the dataset and demo-script JSON files (`"role": "grandma"`)

  `server/scorer.ts` already says "the person who answered", but its `warning` description still says "read aloud". The scripted calls' dialogue mentions the names; that's call content.
- **Speech.** `public/app.js` `speak()` uses `speechSynthesis`, unlocked by a silent utterance on the first click. `micGated()` checks `speechSynthesis.speaking`, plus a 500 ms `micGateUntil` tail. The Voice toggle is `#voice`.
- **Layout.** A 3×2 grid of equal panels with a header and a footer (`index.html`, `style.css`), rendered by `render*()` functions in `app.js` from the reducer's `call` state.

## Goals / Non-Goals

**Goals:**
- No persona names in the product surface, using one consistent vocabulary: Caller / Receiver / Trusted contact.
- An audible alarm that never talks over the call.
- A layout where a judge can follow the story at a glance, from the back of the room, at 1080p and 720p.

**Non-Goals:**
- Changing the scorer logic, thresholds, eval method or server events. The layout uses the existing state and events.
- Editing the dataset JSON files, or the names in scripted dialogue.
- A configurable display name for the receiver (e.g. "Mum"). Possible later, not now.
- A light theme or a framework.

## Decisions

1. **Rename the role id to `receiver` in code, map stored data on load.**
   - The `Role` type becomes `"caller" | "receiver" | "unknown"`.
   - `replay.ts` and `run-eval.ts` accept `"grandma"` from JSON and map it with a one-line `toRole()` helper.
   - *Alternative:* keep `grandma` internally and only rename labels. Rejected: the id shows up in SSE/state JSON and code that judges may read, so it should be consistent.

2. **Vocabulary:**
   - transcript labels "Caller" / "Receiver"
   - phone mockup title "Receiver's screen"
   - tracker step "Trusted contact alerted", detail card title "Message to trusted contact"
   - notification titles "Scam call in progress" (alert) and "Police call approved" (confirmation)
   - agent prompts: "the receiver (often an older person living alone)" / "their trusted contact"

   - The agent tool `notify_family` is renamed to `notify_trusted_contact`, because the tool name is visible in the agent log. The tool-runner flow is unchanged; only the pipeline log and tests reference the name.
   - *Alternative:* keep the old id and change only the description. Rejected: the dashboard's agent log would still say "family".

3. **The alarm tone is synthesized with Web Audio. No audio files.**
   - `playAlarm()` makes three 0.35 s pulses alternating 880 Hz and 660 Hz on a square-ish wave, with a 0.1 s gap, about 1.4 s in total, through a gain envelope so it doesn't click.
   - The `AudioContext` is created and resumed on the first Listen, Replay or Sound click (`unlockSound()`).
   - It plays once per call: a `alarmPlayedFor = call.id` guard. Joining an alarmed call through a `state` snapshot marks it as played without sound.
   - *Alternatives:*
     - An `<audio>` file: needs an asset, and autoplay quirks.
     - Keep speech plus a beep: the user explicitly doesn't want speech.

4. **Mic gate on the tone.** `micGateUntil = now + toneDuration + 400 ms` is set when the tone starts. `micGated()` no longer looks at `speechSynthesis`. With Sound off, there is no gate.

5. **The story layout is a CSS grid with named areas.** No framework.
   ```
   grid-template-areas:
     "status   status"
     "talk     receiver"
     "tracker  tracker"
     "details  details";
   columns: 1.15fr 1fr;  rows: auto 1fr auto minmax(0, 0.8fr)
   ```
   - **Status bar:** the level word (very large), a full-width risk bar, scam type, reason, reaction time. The background tints to the level colour, and the existing alarm frame pulse moves here.
   - **Receiver column:** a phone mockup (rounded frame, notch, about 9:16, its height capped by the row) showing Protected / Be careful / SCAM + warning, next to the signal bars (the existing markup, restyled).
   - **Tracker:** four steps derived from state:
     1. Alarm: done when `alertAt`
     2. Trusted contact: done when `family`
     3. Report: done when `report`; "updated" if more than one `draft_police_report` step happened
     4. Call 110?: pending with buttons when `approval.status === "pending"`, done when approved/declined

     "In progress" means the agent is running and the step isn't done yet. Times come from the matching agent step's `at`.
   - **Details:** `selectedStep` (null means follow the latest completed step). A click selects a step. When a new step completes, the selection goes back to following the latest step. A `<details>` element "Agent log" holds the raw step list.
   - **Idle:** with no segments, the transcript area shows a three-icon pipeline strip "Microphone → Reson8 speech-to-text → Claude → Receiver & Trusted contact", and the tracker steps are greyed out.
   - **Footer:** readiness chips, latency tiles, eval text.
   - **720p:** a media query (≤ 1450×820) reduces type, the phone mockup switches to a compact card (no frame), signal quotes are shortened to one line, and the details area becomes a fixed-height scroll area. A screenshot check covers 1920×1080 and 1280×720.

6. **Rendering stays state-driven.** The reducer and SSE client don't change. The `render*()` functions are rewritten for the new DOM, and new ones are added: `renderStatus`, `renderPhone`, `renderTracker`, `renderDetails`. Event handling for approval moves to the tracker or details buttons (`data-approve`).

7. **Reconcile the unarchived specs** in `build-hackathon-demo` (`call-dashboard`) and `single-warning-and-caller-detection` (`scam-warning`, `speaker-roles`). Persona names become the generic terms, "spoken"/"read aloud" becomes "alarm tone", and the panel-layout requirements point to `dashboard-layout`.

## Risks / Trade-offs

- **[Browsers block audio until there is user interaction]** → The tone context is unlocked on the operator's first click (Listen/Replay/Sound). The pre-flight checklist in the runbook includes one click. If audio is still blocked, the alarm stays visual (no error).
- **[A large UI rewrite late in the day]** → Same state, events and controls. Only the DOM and CSS change, the browser tests are updated, and screenshots at two sizes are checked before marking done. If time runs out, the previous UI is one `git checkout public/` away.
- **[Renaming the tool touches the agent logic]** → The tool-runner flow is unchanged, and the replay test checks that the step and the trusted-contact card appear.
- **[Prompt wording changes could shift scores slightly]** → Only nouns change. An eval smoke run (`--limit 10`, both datasets) must still show 5/5 caught, 0/5 false alarms and correct caller identification before marking done.
- **[A tone without words is less self-explanatory to an older receiver in real life]** → For the demo the written warning is on screen. A real product could add an optional spoken mode later (out of scope).

## Migration Plan

Restart the server and reload the dashboard. To roll back, revert the commit. No data changes.

## Open Questions

- None blocking. Exact colours and spacing are tuned against the screenshots during implementation.
