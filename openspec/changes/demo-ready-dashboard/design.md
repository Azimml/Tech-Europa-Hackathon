# Design

## Context

- **The browser tests define the DOM contract.** The tests are `phone-fit.mjs`, `story-replay-test.mjs`, `story-live-test.mjs`, `old-server-test.mjs`, `resilience-test.mjs`, `stale-tab-test.mjs` and `eval-tile-test.mjs`, and they assert:
  - `body.className` is exactly `level-<level>`
  - each `#transcript li` (except `.idle` and `.interim`) starts with `Caller:`, `Receiver:` or `Speaker N:`, and there are no other `li`s
  - `#details` starts with the step's heading
  - agent-log entries start with the tool name
  - `.step` has its state as the second class and carries `.sub`
  - `#phone-label`, `#phone-warning`, `.phone-hangup`, `.notch` and `.phone-head` exist, and the phone is 35–50% of the receiver panel width
  - `#screens` reads "N screen(s) connected · build xxxx"
  - `#eval-text` keeps its wording
  - the operator controls are clickable by default
  - exactly three oscillators per alarm
- **Layout.** The story grid, the 1600 px compact breakpoint and the phone's auto-fit loop are tested at nine sizes.

## Goals / Non-Goals

**Goals:**
- A projector screen that looks like a product: no operator clutter, a phone that looks like a phone, and a strong alarm moment.
- The "why" visible from the back of the room: which sentence did what, how the risk built up, and how well it was tested.
- Every existing test passes unchanged.

**Non-Goals:**
- Changing the scorer, prompts, agent, events or eval.
- A framework, a build step or web fonts (the venue network must not be able to break the page).
- Making the real-phone view part of the main runbook.

## Decisions

1. **Presenter mode lives on `<html>`, not `<body>`.** The body's class is rewritten per level and asserted exactly. The mode is off by default, because the tests click operator controls, and the pre-flight list ends with P. The mode is stored in `localStorage` (inside try/catch), so the build-id reload keeps it.
2. **The transcript is patched in place, not redrawn.**
   - A `Map` from segment id to `<li>` lets a new line slide in once and a relabelled line flash. Interim updates many times a second no longer recreate every line.
   - The colon after the label stays in the DOM, visually hidden (`.sr`), so `textContent` still reads "Caller: …".
   - `.who` is `position: relative`. Without it, the absolutely positioned colon of lines scrolled out of view escaped the scroller and stretched the document to 1262 px, so a focus or click could scroll the whole dashboard.
3. **Evidence tags are anchored to the caller.** A score covers the call up to its `segmentId`, and segments can be folded into one score. Each tag goes on the caller's line at or before that segment; with no caller identified yet, it goes on the segment itself.
4. **The risk chart is inline SVG.**
   - It is drawn in pixel coordinates sized to its box and redrawn on resize, so strokes and dots stay crisp.
   - The colour comes from a vertical gradient with stops at the thresholds.
   - The threshold labels sit right of the plot.
   - It always has at least 12 slots, so early in a call the line grows from the left instead of stretching.
5. **`setHtml` caches markup.** The tracker, details, agent log and chart only touch the DOM when their markup changes. Scroll positions survive, and the pending step's ring doesn't restart on every event.
6. **Phone modes are classes on one DOM:** `lock`, `call`, `alert` and `ended`, plus the existing `phone-<level>`.
   - `#phone-body` moved before the caller info, so the caution banner and its hint form one card.
   - Auto-fit only runs on scam; caution text is sized in CSS. The scam structure, sizes and fit loop are unchanged.
   - The border stays a fixed width, because `--pw` comes from `clientWidth`.
7. **The phone view reuses the same page.**
   - `/phone` redirects to `/?view=phone`, which hides everything but the phone and opens `/api/events?client=phone`.
   - The hub counts phone clients apart: `screens` excludes them and `phones` is added. Existing tests and the stale-tab warning behave as before.
   - The page asks for one tap before it can play sound, which mobile browsers require.
8. **Fit at every size.**
   - At 1680×1050 the full header and footer wrapped onto two rows, which pushed the phone to 34% of the panel. Between 1601 and 1850 px the tagline and the footer's secondary eval text are hidden, and the select is capped at 340 px.
   - The story rows are 1.5fr / 1fr. Measured with the LIVE pill and two dashboards connected: one-row header and footer at all nine sizes, the phone at 38–41% of the panel, no page scroll.

## Risks / Trade-offs

- **[A large UI change late in the day]** → Same state, events and controls. Every existing test passes unchanged. Rollback: `git checkout public/ server/index.ts server/hub.ts`.
- **[The presenter forgets P]** → It is a pre-flight item, and the dashboard works fully without it.
- **[Venue Wi-Fi isolates devices, so the phone can't reach the laptop]** → The phone view is optional: use a phone hotspot or skip it. The main demo doesn't depend on it.
- **[iOS mutes Web Audio in silent mode]** → The arm screen tells the user to keep the ringer on.
- **[Single-letter keys could be pressed by accident]** → A and D only act while a police request is pending; nothing irreversible happens (the 110 call is simulated and asked once).

## Migration Plan

Restart the server (`npm run dev`) and reload the dashboard. No data changes.

## Open Questions

- None blocking.
