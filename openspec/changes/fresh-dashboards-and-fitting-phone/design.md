# Design

## Context

- **The voice.** Observed with `lsof` on `:3000`: one Chrome connection (the current dashboard, which beeps) and two "Code Helper" connections. Those come from a VS Code built-in browser/preview tab with an older `app.js` that still has `speechSynthesis` and reacts to `{type: "alert", message}`.
  - The server process on `:3000` was started at 14:12, before the latest changes.
  - The current code has no speech (`grep` finds none).
  - All dashboards get every event (`hub.send` broadcasts to every SSE client).
- **The phone.** `.phone-col` is `flex: 0 0 auto` and sized by `.phone`'s `max-height: 360px` and `aspect-ratio: 9/17`, so the phone ends up 141 to 191 px wide.
  - `.phone-warning` uses `clamp(13px, 1vw, 19px)`, which depends on the viewport width, not on the text length.
  - Measured with a 30-word warning, the text overflows by 8 to 17 px at 1470, 1512, 1920 and 2560 px wide.
  - The `padding-top: 26px` doesn't clear the notch once the label wraps.
  - The compact media query starts at ≤ 1450 px, so a 1470 px-wide laptop gets desktop-size controls that wrap onto two rows.

## Goals / Non-Goals

**Goals:**
- Outdated dashboards can't make sound or react to alarms, and tabs reload themselves after a server restart.
- An open second dashboard is visible.
- The phone's warning fits at every tested size and warning length, and stays as large as possible.

**Non-Goals:**
- Closing or killing other tabs remotely (not possible from a page, and not wanted).
- Changing the warning length limits or the scorer.
- A redesign of the rest of the layout beyond the breakpoint change.

## Decisions

1. **Rename the event (`alert` → `alarm`, `message` → `warning`)** instead of only adding a version check.
   - Code already running in a stale tab can't be changed. It ignores unknown event types, so the rename is the only server-side way to make *today's* forgotten tabs go silent.
   - *Alternative:* keep `alert` and rely on the handshake. That doesn't help: the old tabs have no handshake code.

2. **The build id is the server start time.**
   - `BUILD_ID = Date.now().toString(36)` is created at startup. It's added to `hub.snapshot()` (`buildId`) and `/api/config`.
   - The dashboard stores the id from its **first** `state` snapshot. When a later snapshot carries a different id, it calls `location.reload()`.
   - A `sessionStorage` guard (`reloadedFor = buildId`) prevents reload loops.
   - A brief disconnect to the same process gives the same id, so nothing reloads.
   - *Alternative:* a hash of the `public/` files. That misses server-only changes; the start time covers every restart, which is what matters.
   - *Trade-off:* with `npm run dev` (tsx watch), saving a server file restarts the server, which reloads open dashboards and stops listening. That's acceptable: nobody edits code during the demo.

3. **Connected-screens counter.** `Hub` already tracks `clients`. On attach and close it broadcasts `{type: "screens", count}`, and the snapshot includes `screens`. The footer shows "N screen(s) connected · build xxxx" and turns amber when N > 1.

4. **Phone sizing.**
   - `.phone-col { flex: 0 0 40% }`.
   - `.phone { height: 100%; aspect-ratio: 11 / 16; max-width: 100%; margin: 0 auto }`, which is a little wider than before, so the text gets more width.
   - The inner screen becomes a flex column:
     - a notch spacer (fixed 22 px)
     - icon + label (`.phone-head`)
     - `.phone-body` (`flex: 1; min-height: 0; overflow: hidden`), which holds the warning
     - `.phone-hangup` bar ("Hang up", fixed height)

     The notch spacer replaces the top padding, so text never sits under the notch.
   - At safe and caution, the body shows the big label and hint centred, and the hang-up bar is hidden.

5. **Auto-fit with a measured shrink loop.**
   - `fitWarning()` sets the warning's font size to a starting size (`min(30px, bodyWidth / 8)`), then lowers it in 1 px steps while `scrollHeight > clientHeight` of `.phone-body`. It stops at 11 px. That's at most about 20 layout reads, which is cheap.
   - It runs after `renderPhone()` at the scam level, and from a `ResizeObserver` on `.phone-body` (covers window resizes and layout changes).
   - The label also scales with the phone width via a CSS `clamp` on container units (`cqw`, with `container-type: inline-size` on `.phone`).
   - *Alternatives:*
     - Pure CSS `cqw` sizing: it still overflows for long text, because it can't measure height.
     - Truncation or ellipsis: it would hide part of the warning. Rejected.

6. **Breakpoint.** The compact rules move from `max-width: 1450px` to `max-width: 1600px` (the `max-height: 820px` condition is kept), so 1470 and 1512 px-wide laptops get one-row header and footer. This is verified by measuring header and footer heights in the fit test.

7. **Tests.**
   - `phone-fit.mjs`: 8 sizes × 3 warnings (12, 30 and 40 words), driven through the real `fitWarning` by sending a synthetic `alarm` through the dashboard's own reducer (exposed for tests as `window.__schutzengel.apply`). It asserts no overflow, the minimum font size, that a short warning renders larger than a long one, that the notch doesn't overlap the label, and one-row header and footer from 1280 to 1600.
   - `stale-tab-test.mjs`: an "old client" (EventSource with the previous handler and a speech counter) plus the current dashboard during a replay. The old client gets 0 speech calls; the current one gets 1 tone.
   - Resilience test: on a server restart, the page reloads exactly once and is connected afterwards.

## Risks / Trade-offs

- **[A reload during a live demo]** → It only happens on a server restart, and the runbook says not to restart during the demo. The footer shows the build id, so a restart is visible.
- **[A ResizeObserver loop warning]** → The fit changes only the font size inside a fixed-size box, not the box itself, so it won't trigger a resize cycle. The test checks there are no console errors.
- **[11 px text is small on a projector]** → It's only reached with 40-word warnings at 1280×720. The scorer is asked for 25 words or fewer, so typical warnings render at 14 to 22 px. The test logs the font sizes.
- **[Exposing the reducer on `window` for tests]** → It's read-only use and harmless in a demo app. It's named `__schutzengel` to show it's internal.

## Migration Plan

Restart the server and reload the dashboards. Older tabs go silent automatically. Close them using the footer counter as a check. To roll back, revert the commit.

## Open Questions

- None.
