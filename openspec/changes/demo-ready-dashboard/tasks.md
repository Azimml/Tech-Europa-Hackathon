# Tasks

Run browser tests only against test servers (:3201 for the real server, :3202 for the stub), never against `:3000` while it is in use. Screenshots of every state are made by `/tmp/ui-review/shots.mjs`, which feeds call states into the page's own reducer and makes no API calls.

## 1. Review

- [x] 1.1 Render idle, safe, caution and scam at 1920×1080 and 1470×956, and list what reads as an internal tool: the "SCAM: …" replay picker on stage, the flat phone, the empty idle screen, the 16 px eval line, broken quote marks, endless pulsing, decimals, the GitHub palette, and the dead `/phone` route. Verify that each item is visible in a screenshot

## 2. Layout and look (call-evidence, receiver-phone)

- [x] 2.1 `public/index.html`: icon sprite and logo, favicon, the new header/status/phone/footer markup, and the overlays (evaluation, keys, phone arm, alarm flash). Every element id the tests use is kept. Verify that the page loads with no console errors
- [x] 2.2 `public/style.css` rewritten: palette and `@property --level` fade, chat bubbles and tags, phone modes (lock, call, caution banner, scam, ended), warning signs with descriptions, tracker connectors, detail cards, the terminal agent log, overlays, presenter mode, compact breakpoints, reduced motion. Verify with screenshots of 10 scenes at 1920×1080, 1470×956 and 1280×720: no page scroll anywhere
- [x] 2.3 `public/app.js`: the transcript is patched in place, with evidence tags anchored to the caller's line; the risk chart; the phone modes and clock; signal rows updated in place; `setHtml` caching for the tracker, details and log; Claude's reasons shown as written, with a safe `unquote()`. Verify in the scam screenshot that the tags sit on the secrecy line, the chart crosses both thresholds, and the inner quotes are intact
- [x] 2.4 Fix the page stretch found in review: `.who { position: relative }` keeps the hidden colon inside the transcript scroller (the document was 1262 px tall). Verify that `document.documentElement.scrollHeight === innerHeight` after clicking a tracker step
- [x] 2.5 Fit: cap the select width, hide the tagline and eval extras between 1601 and 1850 px, and give the story rows 1.5fr / 1fr. Verify with the LIVE pill shown and "2 screens connected": a one-row header and footer at all 9 sizes, the phone at 38–41% of the panel, and `phone-fit.mjs` ALL PASSED

## 3. Presenter (presenter-controls, evaluation-view)

- [x] 3.1 Presenter mode on `<html>` (P, the header button, `?presenter=`, `localStorage`), the single-key shortcuts and the `?` overlay. Verify the presenter screenshot (only Listen and New call in the header) and that the keys 2 and E work in the screenshot script
- [x] 3.2 Evaluation view from `eval-results.json`, with cards, the run table and the caveat. Verify the screenshot at 1920×1080 and 1280×720 without scrolling
- [x] 3.3 Alarm flash (also with sound off), three pulses then hold, and the mic level meter in the LISTENING pill. Verify that `story-replay-test.mjs` still counts exactly 3 oscillators per alarm

## 4. Phone view (receiver-phone)

- [x] 4.1 `server/hub.ts`: phone clients counted apart (`screens`, `phones`). `server/index.ts`: `/phone` → `/?view=phone`, `client=phone` on `/api/events`, the LAN address in the start log, and thresholds in `/api/config`. Verify that `npm run typecheck` exits 0
- [x] 4.2 `public/app.js`: `PHONE_VIEW`, tap to arm, Hang up from the phone, vibration, and the phone count in the footer. Verify that `/tmp/ui-review/phone-view.mjs` reports ALL PASSED (fills a 390×844 screen, "1 screen connected · 1 phone", not amber, hang-up ends the call)

## 5. Regression and docs

- [x] 5.1 Existing tests, unchanged, on :3201: `phone-fit.mjs`, `old-server-test.mjs`, `eval-tile-test.mjs`, `resilience-test.mjs`, `stale-tab-test.mjs` and `story-replay-test.mjs`. Verify that each reports ALL PASSED
- [x] 5.2 `story-live-test.mjs` (fake mic → Reson8 → Claude) and `stale-tab-test.mjs` after the phone-view changes. Verify ALL PASSED and no page errors from the level meter
- [x] 5.3 `docs/DEMO_SCRIPT.md`: the keys table, presenter mode in the pre-flight list, "New call", the new cues (tags, risk line, banner, flash, Call ended), the evaluation view in the walkthrough and video, and an optional real-phone section. `README.md`: the dashboard status, the `/phone` route, and the corrected event list (`alarm`, `roles`, `screens`). Verify that neither file mentions "End call / Reset"
- [x] 5.4 Re-take `docs/dashboard-alarm.png` from a real replay of `scam-fake-police` in presenter mode at 1920×1080 with the 110 request pending, the transcript scrolled to the alarm line. Verify by viewing it
- [x] 5.5 `openspec validate --strict` passes for this change and for `generic-names-beep-story-ui`

## Workflow follow-up

- Archive after the hackathon together with the other open changes (oldest first).
