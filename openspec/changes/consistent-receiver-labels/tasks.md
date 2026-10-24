# Tasks

Estimated about 45 min. Run browser tests only against test servers (:3201 for the real server, :3202 for the stub), never against `:3000` while it is in use.

## 1. Reproduce first

- [x] 1.1 Write `/tmp/e2e/old-server-test.mjs`: a stub server on :3202 serving `public/`, `/api/config` (protocol configurable), `/api/scripts`, a 404 for `/eval-results.json`, and the scripted `/api/events` runs A (an old server sending `grandma`) and B (the receiver first heard after identification, role `unknown`). Verify that it fails against the current dashboard with the receiver shown as "Speaker 2" (that is the reported bug)

## 2. Labels (label-consistency)

- [x] 2.1 `public/app.js`: add `normRole()` (`grandma` → `receiver`), applied in the segment reducer and to snapshot roles. Verify that run A of the stub test labels the receiver's lines "Receiver"
- [x] 2.2 `public/app.js`: in `speakerName()`, apply the two-person rule (find `callerKey`; any other keyed speaker is Receiver; no caller → the normalised role, else "Speaker N"; no key → "Speaker ?"). Verify that run B labels speaker 0 "Receiver" on all lines, including its first, and that neutral labels still show before identification

## 3. Outdated server warning (label-consistency)

- [x] 3.1 `server/index.ts`: `/api/config` returns `protocol: 2`. `public/index.html` + `style.css`: `#server-banner` (hidden by default, amber, below the header). `public/app.js`: `EXPECTED_PROTOCOL = 2`, and show the banner from `loadReadiness()` when the config protocol is missing or lower. Verify that the stub test shows the banner with no protocol and no banner with protocol 2, and that `curl :3201/api/config` includes `"protocol":2`

## 4. Regression and docs

- [x] 4.1 Re-run the story replay test and story live-mic test on :3201. Verify both report ALL PASSED, with Caller/Receiver labels unchanged in normal operation
- [x] 4.2 README troubleshooting: "Receiver shown as Speaker 2, or an amber 'older code' banner → restart the server (`npm run dev`) and reload". Same line in the `docs/DEMO_SCRIPT.md` fallback table. `npm run typecheck` exits 0, and `openspec validate --strict` passes for this change. Verify by running both commands

## Workflow follow-up

- Archive after the hackathon together with the other open changes (oldest first).
