# Proposal

## Why

Testing the story-layout dashboard showed two problems.

1. **A robot voice still reads the warning, even though the new dashboard only beeps.**
   - The cause is not the current code: it contains no speech.
   - The voice comes from a **second, stale dashboard**. A VS Code built-in browser tab still runs an older `app.js`, and it holds two event-stream connections to `:3000` next to the Chrome tab. Every dashboard receives the same `alert` event, and the old code reads `event.message` aloud.
   - The `:3000` server was also started before the latest server changes.
   - Nothing tells the operator that a tab is out of date, so this can happen again on stage. For example, a laptop with a forgotten preview tab, or a server restarted with new code while old tabs stay open.
2. **The scam warning spills out of the phone mockup.** With a 30-word warning, the text overflows by 8 to 17 px at 1470×956, 1512×982, 1920×1080 and 2560×1440.
   - The phone is only 141 to 191 px wide, while the panel next to it has room to spare.
   - The font size follows the screen width (`1vw`), not the amount of text.
   - The notch overlaps "SCAM CALL".
   - On the same 1470×956 screen, the header controls wrap onto a second row and the footer's evaluation line wraps too.

## What Changes

- **Stale dashboards can no longer make sound or show a wrong alarm:**
  - The alarm event is renamed from `alert` to `alarm`, with the text in a new `warning` field. Dashboards running older code ignore unknown events, so a forgotten old tab stays silent. **BREAKING** for any client listening to `alert`; the dashboard is the only client.
  - **Version handshake:** the server gets a build id when it starts. It reports the id in `/api/config` and in every `state` snapshot. A dashboard that sees a different id than the one it loaded with, for example after a server restart with new code, **reloads itself once**, so no tab keeps running old code.
  - The footer shows the build id and the number of dashboards connected ("2 screens connected"), so a second open dashboard is visible at a glance.
- **A phone mockup whose warning always fits:**
  - **A bigger phone.** It takes about 40% of the receiver panel's width (the warning signs keep the rest), uses a less narrow screen shape, and leaves enough top padding to clear the notch.
  - **Structured content:** a ⚠ icon, "SCAM CALL", the warning text, and a fixed "Hang up" bar at the bottom.
  - **Auto-fit text:** the warning starts at a large size and shrinks step by step until it fits inside the phone's screen (minimum 11 px). It re-fits whenever the text or the window size changes. In the worst case, the longest allowed warning (40 words), the text still fits, with nothing cut off or overflowing.
- **No wrapping on common laptop screens:** the compact header and footer apply up to 1600 px wide (was 1450), so at 1470 and 1512 px the header and footer stay on one row.

## Capabilities

### New Capabilities
- `dashboard-freshness`: guarantees that only up-to-date dashboard code reacts to alarms. Covers the alarm event's name and shape, the build-id handshake with a one-time reload, and visibility of how many dashboards are connected.
- `receiver-screen`: the phone mockup showing the receiver's view. Covers its states, its size relative to the panel, the structured scam content, and the rule that the warning text always fits within the screen at every supported resolution.

### Modified Capabilities
- None in `openspec/specs/`, which is still empty. The unarchived change `generic-names-beep-story-ui` has a `dashboard-layout` spec whose "Projector resolutions" requirement only checks 1920×1080 and 1280×720. A task extends it to the sizes tested here and points the phone requirements to `receiver-screen`.

## Impact

- **Server:**
  - `server/hub.ts`: `buildId`, client count, the snapshot fields
  - `server/pipeline.ts`: the event is now `alarm` with a `warning` field
  - `server/index.ts`: `/api/config` gains `buildId`
- **Dashboard:**
  - `public/app.js`: handle `alarm`, the handshake/reload, `fitWarning()`, connected-screens and build id in the footer
  - `public/index.html`: phone content structure
  - `public/style.css`: phone size and shape, the compact breakpoint raised to 1600 px
- **Tests:**
  - `/tmp/e2e/phone-fit.mjs`: fit matrix of 8 sizes × 3 warning lengths (short, 30 words, 40 words)
  - the story replay, live mic and resilience tests updated for the `alarm` event and the reload on restart
  - a new stale-tab test that loads an old-shaped client and checks it stays silent
- **Operator action now:** close the VS Code preview tab and restart `:3000` (`npm run dev`). This is noted in the runbook pre-flight list ("one dashboard open"), which the new footer counter makes checkable.
- No new dependencies. No changes to scoring, prompts or eval.
