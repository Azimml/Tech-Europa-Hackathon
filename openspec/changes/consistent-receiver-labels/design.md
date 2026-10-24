# Design

## Context

- `public/app.js` `speakerName(speakerId)` labels a line Caller or Receiver only if `call.roles[key]` is exactly `"caller"` or `"receiver"`; anything else shows "Speaker N".
  - `call.roles` comes from state snapshots, and from the segment reducer (`call.roles[key] = segment.role` when it isn't `"unknown"`).
- The running `:3000` server (started 14:12) predates the server rename (14:55). It sends `"grandma"`, which hits the fallback.
- The server-side logic (`pipeline.roleFor` + `assignRoles`) already applies the two-person rule. The dashboard just didn't, so any mismatch in role strings or event timing shows up as "Speaker 2".

## Goals / Non-Goals

**Goals:**
- Once a caller is known, the other speaker is always shown as Receiver, robust to role strings and event order.
- Make an outdated server visible instead of silently mislabelling.

**Non-Goals:**
- Changing how the server identifies roles, or the speaker-roles rules (neutral labels before identification, stability, manual override).
- Supporting more than two speakers. Reson8 is configured with `max_speakers=2`.

## Decisions

1. **The label is derived from the caller key, not from each line's role.**
   - `callerKey` = the speaker key whose role, normalised, is `caller`, taken from `call.roles`, or failing that from any segment with `role === "caller"`.
   - If a `callerKey` exists and the line has a speaker key: the label is Caller when `key === callerKey`, otherwise Receiver.
   - If there is no caller yet: use the line's own normalised role if it is `receiver` (for example a manual swap before identification sets Speaker 1 = Receiver), otherwise "Speaker N".
   - Lines without a speaker id stay "Speaker ?".
   - *Alternative:* fix only the alias. Rejected: the event-order case (receiver first heard after identification, on a stale client) would remain.

2. **One normalisation helper:** `normRole(r)` maps `"grandma"` → `"receiver"`. It's used in the segment reducer, on state snapshots and in `speakerName`.

3. **Protocol version, not build id.**
   - `/api/config` returns `protocol: 2`. The dashboard has `EXPECTED_PROTOCOL = 2`.
   - `loadReadiness()` already fetches the config. If `(config.protocol ?? 0) < 2`, it shows `#server-banner`: "The server is running older code. Restart it (npm run dev) and reload this page."
   - This answers "is the server new enough for this page?". The planned build-id handshake (fresh-dashboards change) answers the different question "did the server restart since this page loaded?". Both can coexist. If that change is applied too, its config already gains `buildId`, and `protocol` sits next to it.
   - *Alternative:* compare build ids. That doesn't work against a server that predates both changes, which is exactly today's case.

4. **The test uses a stub server instead of an old checkout.** `/tmp/e2e/old-server-test.mjs` starts a small Node HTTP server on port 3202. It serves `public/` from the repo and the endpoints the dashboard calls (`/api/config` without `protocol`, `/api/scripts`, `/eval-results.json` → 404), and plays a scripted event stream on `/api/events`:
   - run A, an old server: the state snapshot gives roles `{1: caller, 0: grandma}`, segments carry `grandma` / `caller`
   - run B, event order: an empty state, then a segment from speaker 1 (`unknown`), then a state with roles `{1: caller}`, then speaker 0's first segment with role `unknown`

   The test asserts the labels, the banner, and the absence of the banner when `protocol: 2` is reported.

## Risks / Trade-offs

- **[The two-person rule hides a real third speaker]** → Not possible with `max_speakers=2`. If it ever happened, a third voice would be shown as Receiver, which is the safer default for warnings.
- **[The rule overrides a manual swap?]** → No. A swap changes `call.roles` on the server and broadcasts a snapshot, so `callerKey` follows it.
- **[Overlap with the unapplied `fresh-dashboards-and-fitting-phone` change in `app.js` / `index.ts`]** → The edits are in different functions (`speakerName`/`loadReadiness` here; the event handling, handshake and phone there). Apply in either order. Each change's tests run against the combined code.

## Migration Plan

Restart the server and reload. Old servers keep working, with the banner and correct labels. To roll back, revert the commit.

## Open Questions

- None.
