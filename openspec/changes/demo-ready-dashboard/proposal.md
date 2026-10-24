# Proposal

## Why

A review before the demo found that the dashboard reads as an internal operations tool rather than a product, and that its strongest evidence is hard to see from the room. The review used screenshots of idle, safe, caution and scam at 1920×1080 and 1470×956.

- **The replay picker gives the ending away.** It sits in the header for the whole demo and reads "SCAM: Fake detective wants to collect cash and jewelry", even during the normal call. Six more operator buttons sit next to it.
- **The receiver's phone is a flat coloured rectangle with one word on it.** During a safe call it is the biggest, brightest thing on screen, and it doesn't look like a phone call, so the red takeover is less dramatic than it could be.
- **The idle screen is mostly empty panels**, and it is what judges see during the opening.
- **The evaluation is hard to read.** It is the strongest evidence, but it is one 16 px footer line (13 px and cut short on laptops).
- **Claude's reasons show broken quote marks**, for example `Detective Inspector Wagner" says "your savings…`, visible in the README screenshot.
  - `unquote()` strips the outer marks of reasons that contain inner quotes.
  - The status bar wraps Claude's own summary in quote marks, as if the caller had said it.
- **The status bar and the phone pulse at 1 Hz** for as long as the call stays red.
- **It looks like a developer tool:**
  - risk shown as `0.74`
  - GitHub's dark-theme colours
  - build ids and screen counts on stage
- **`/phone` is a dead link.** It redirects to a `phone.html` that doesn't exist, while the server log advertises it.

## What Changes

- **Presenter mode and keys:**
  - **P** hides the operator controls. Only Listen and New call stay, and the Dashboards tile only shows when a second dashboard connects.
  - Single keys run the demo: L, N, A/D, 1–4, E, H, R, S, W, ? and Esc.
  - Off by default and remembered per browser; `?presenter=1` sets it.
- **The receiver's phone as a real phone:**
  - a lock screen with clock and "Protected" before a call
  - the call screen (avatar, timer, call buttons) while the call is safe
  - an amber "Be careful" banner with its hint on caution
  - the full red warning on scam, with the same structure and auto-fit as before
  - "Call ended" with the duration after Hang up
- **Evidence in the conversation:**
  - The transcript becomes chat bubbles, caller on the left and receiver on the right.
  - Tags mark the line that first lit each warning sign, turned the call amber and raised the alarm (with the reaction time).
  - The status bar shows the risk as a percentage and a risk-over-time line: one point per sentence, the caution and alarm thresholds (now reported by `/api/config`) and the alarm moment.
- **Claude's words as written:** reasons follow a "Claude" tag without added quote marks. `unquote()` only strips marks that wrap the whole text.
- **Evaluation view:** E (or a click on the footer tile) opens the headline numbers as large cards plus the per-run table, from `eval-results.json`.
- **Alarm moment:**
  - one red flash around the screen with the tone, also when the sound is off
  - the status bar and the phone pulse three times, then hold
  - no animation for users who prefer reduced motion
- **Look:**
  - a halo-and-shield logo, also used as the favicon
  - a navy palette with a level-tinted background that fades between levels
  - icons throughout
  - warning signs that say what they mean until Claude finds them
  - a step tracker with connectors
  - a push-notification card for the trusted contact, a police-report document, and a timestamped agent log
  - panels keep their scroll position across updates
- **Live feedback:** a level meter next to LISTENING, flat while the alarm tone gates the mic.
- **Receiver phone view (optional, not in the runbook's main path):** `/phone` now opens the receiver's screen alone, for a real phone on the same network.
  - A tap arms the alarm sound, the phone vibrates where supported, and its Hang up buttons end the call.
  - The server counts phone views apart from dashboards, so the stale-tab warning is unaffected.
  - The server prints the phone's LAN address at start.

## Capabilities

### New Capabilities
- `presenter-controls`: presenter mode and the single-key shortcuts.
- `call-evidence`: the risk-over-time chart, the evidence tags in the transcript, and Claude's reasons shown as written.
- `receiver-phone`: the receiver's phone states (lock, call, caution banner, scam, ended) and the phone view at `/phone`.
- `evaluation-view`: the full-screen evaluation.

### Modified Capabilities
- None in `openspec/specs/`, which is still empty.
- **Reconciled** in the unarchived change `generic-names-beep-story-ui` → `dashboard-layout`: the "Status bar" requirement said "a risk bar"; it now says the risk as a percentage with a risk-over-time chart.
- The scam content and fitting rules of `fresh-dashboards-and-fitting-phone` → `receiver-screen` still hold unchanged.

## Impact

- **Dashboard:**
  - `public/index.html` and `public/style.css` are rewritten.
  - `public/app.js` rendering and controls are rewritten. The reducer, the SSE client, the mic/Reson8 pipeline and the alarm tone are unchanged, except that the worklet's frame level is stored for the meter.
- **Server:**
  - `server/index.ts`: `/api/config` thresholds, the `/phone` redirect, `client=phone` on `/api/events`, the LAN address in the start log.
  - `server/hub.ts`: phone views counted apart.
  - No change to scoring, prompts, the agent or the eval.
- **Docs:**
  - `docs/DEMO_SCRIPT.md`: keys, presenter mode, the new cues, "New call".
  - `README.md`: dashboard status, screenshot.
- **Tests:** every existing browser test passes unchanged: phone-fit (9 sizes), old-server, eval-tile, resilience, stale-tab, story-replay and story-live. A new `/tmp/ui-review/phone-view.mjs` covers the phone view.
- No new dependencies, no build step.
