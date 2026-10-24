# Tasks

Estimated about 1.5 h. Run all browser tests against a separate server (`PORT=3201`), never against `:3000` while someone uses it.

## 1. Stale dashboards stay silent (dashboard-freshness)

- [x] 1.1 Server: emit the alarm as `{type: "alarm", warning, source, reactionMs}` (no `alert` event any more) in `server/pipeline.ts`. Verify with an event stream during a replay on :3201: exactly one `alarm` event, no `alert` event
- [x] 1.2 Server: `BUILD_ID` set at startup. `hub.snapshot()` includes `buildId` and `screens` (connected client count). Broadcast `{type: "screens", count}` on connect and disconnect. `/api/config` includes `buildId`. Verify with curl that config and the first snapshot carry the same `buildId`, and that opening a second event stream broadcasts `screens: 2`
- [x] 1.3 Dashboard (`public/app.js`):
  - handle `alarm` (`event.warning`) instead of `alert`
  - remember the first snapshot's `buildId` and reload once (sessionStorage guard) when a later snapshot differs
  - footer "N screen(s) connected · build xxxx", amber when N > 1
  - expose `window.__schutzengel = { apply, render }` for tests

  Verify that `node --check` passes and the story replay test still passes after updating it for `alarm`
- [x] 1.4 Stale-tab test `/tmp/e2e/stale-tab-test.mjs`: an old-shaped client (EventSource, speaks `event.message` on `alert`, counted) next to the current dashboard during a scam replay. Verify that the old client makes 0 speech calls and the current dashboard plays exactly one tone
- [x] 1.5 Resilience test: restarting the server makes an open dashboard reload exactly once and reconnect; a brief disconnect without a restart doesn't reload; the screens counter goes 1 → 2 → 1 when a second page opens and closes. Verify that `resilience-test.mjs` reports ALL PASSED

## 2. Phone mockup that always fits (receiver-screen)

- [x] 2.1 `public/index.html`: phone screen structure: notch spacer, head (⚠ icon + label), body (warning), hang-up bar. `public/style.css`:
  - `.phone-col` at 40%, the phone at `aspect-ratio: 11/16` with `height: 100%` and `max-width: 100%`
  - container-query label sizing
  - body `flex: 1; min-height: 0; overflow: hidden`
  - hang-up bar shown only at the scam level
  - safe and caution centred

  Verify with screenshots at 1470×956 and 1920×1080 in the safe, caution and scam states: the notch never overlaps text
- [x] 2.2 `fitWarning()` in `public/app.js` (start at `min(30px, bodyWidth/8)`, shrink in 1 px steps to 11 px while the body overflows), called after `renderPhone()` and from a `ResizeObserver` on the phone body. Verify with `/tmp/e2e/phone-fit.mjs` (8 sizes × 12/30/40-word warnings, driven via `__schutzengel.apply`): 0 overflows, font ≥ 11 px, the 12-word warning larger than the 40-word one at each size, and re-fitting after a resize from 1920×1080 to 1280×720 passes
- [x] 2.3 Raise the compact breakpoint to `max-width: 1600px`. Verify in `phone-fit.mjs` that the header and footer are each one row at 1280, 1366, 1440, 1470, 1512 and 1600 px wide

## 3. Docs, spec reconciliation and regression

- [x] 3.1 `docs/DEMO_SCRIPT.md` pre-flight: "Only one dashboard open: the footer says 1 screen connected; close VS Code preview tabs", plus "the server was restarted after the last code change (the build id in the footer matches the one shown when the server starts)". `README.md`: mention the screens counter and build id. Verify that both files mention "screen connected"
- [x] 3.2 Reconcile `openspec/changes/generic-names-beep-story-ui/specs/dashboard-layout/spec.md`: "Conversation and receiver side by side" refers to the receiver-screen capability for the phone, and "Projector resolutions" lists the sizes of the receiver-screen requirement. Verify that `openspec validate --strict` passes for all four changes
- [x] 3.3 Regression: run the story replay test, the story live-mic test and the eval-tile test on :3201 (updated for `alarm` and the new phone markup), plus `npm run typecheck`. Verify they all report ALL PASSED and typecheck exits 0
- [x] 3.4 Re-take `docs/dashboard-alarm.png` at 1920×1080 in scam state with a pending 110 request. Verify by viewing it that the warning fits inside the phone

## Workflow follow-up

- Archive after the hackathon, in order: `build-hackathon-demo`, `single-warning-and-caller-detection`, `generic-names-beep-story-ui`, `fresh-dashboards-and-fitting-phone`.
