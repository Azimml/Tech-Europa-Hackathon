# Proposal

## Why

In testing, the person who phoned in was correctly labelled **Caller**, but the person who answered stayed **"Speaker 2"** until the end of the call.

Cause (verified on the running system):
- The `:3000` server process started at 14:12, before the role id was renamed from `grandma` to `receiver` in the server code (14:55).
- That old server sends the receiver's lines with `role: "grandma"`.
- The dashboard is served from disk and is newer. It only knows `caller`/`receiver`, so it falls back to the neutral "Speaker N" label for the receiver.

Restarting the server fixes it, but the dashboard gave no hint that it was talking to an outdated server. Labels were also decided only from whatever role string arrived, even though there are only two people on the call. Once one of them is the Caller, the other one can only be the Receiver.

## What Changes

- **The dashboard enforces the two-person rule.** Once any speaker in the call is identified as the Caller, every other speaker is shown as **Receiver**: past lines, new lines and interim lines. This holds whatever the role string says and in whatever order the events arrive. Before identification, labels stay neutral ("Speaker 1/2"), as specified in `speaker-roles`.
- **The legacy role value `grandma` is read as `receiver`** by the dashboard. This is the same mapping the server already uses for the stored test data.
- **The dashboard warns about an outdated server:**
  - The server reports a protocol version in `/api/config`. The new value is 2; servers before this change report none.
  - If the server reports none or an older version, the dashboard shows a clear banner: "The server is running older code. Restart it (`npm run dev`) and reload this page."
  - In this state the dashboard still works as well as it can (the two rules above).
- **Tests** reproduce the exact failure with a stub "old server" (roles sent as `grandma`, and a receiver whose first line arrives after the caller was identified). They check that the receiver is labelled "Receiver" and that the banner appears.

## Capabilities

### New Capabilities
- `label-consistency`: how the dashboard derives the Caller/Receiver label for every line from the call's identification. It covers the two-person rule, tolerance of legacy role values, and the warning when the server is too old to label correctly.

### Modified Capabilities
- None in `openspec/specs/`, which is still empty. Related unarchived specs:
  - `single-warning-and-caller-detection` → `speaker-roles` defines when identification happens (server side); this change adds how the dashboard displays it.
  - `fresh-dashboards-and-fitting-phone` → `dashboard-freshness` handles *old dashboards with a new server* (silence and reload). This change handles the reverse, *a new dashboard with an old server* (warning banner).

  No requirement text conflicts, so no reconciliation is needed. Both changes touch `public/app.js` and `/api/config`; see design.md for how they combine.

## Impact

- `public/app.js`: `speakerName()` applies the two-person rule and the alias, plus a protocol check and banner on load.
- `public/index.html` / `style.css`: the banner element.
- `server/index.ts`: `/api/config` gains `protocol: 2`.
- Tests:
  - a new `/tmp/e2e/old-server-test.mjs`, with a stub server on port 3202 that serves `public/` and scripted events
  - the story replay test re-run as a regression on :3201
- Docs: the README troubleshooting line "Receiver shown as Speaker 2 → restart the server".
- **Operator action now:** restart `:3000` (`npm run dev`) and reload the dashboard.
- No new dependencies; no scoring, prompt or eval change.
