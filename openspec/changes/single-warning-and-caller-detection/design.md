# Design

## Context

How the code works today:
- **Warning.** `pipeline.onScam` sends the fixed `DEFAULT_WARNING` as an `alert` (source "detector") and pushes it to the phone topic. A few seconds later the agent's first tool, `warn_grandma`, sends a second `alert` (source "claude") and a second phone push. The dashboard replaces the text and `speak()`s every distinct text, so the laptop reads both. Each spoken warning also mutes the microphone (`micGated`), so speech is dropped twice. With no ntfy topics set, the "two notification sounds" are these two spoken warnings.
- **Roles.** `pipeline.roleFor` labels the first speaker id it sees as `grandma` and the next as `caller`. `scheduleScore` passes `{role, text}` to `scoreCall`, which prints "Caller:" or "Person who answered:". `replay.ts` presets `{"0": grandma, "1": caller}`. `swapRoles` flips the labels and broadcasts a fresh `state`.
- The scorer already runs after every sentence, with structured outputs and a strict JSON schema (`OUTPUT_SCHEMA` + Zod `SignalsSchema`).

## Goals / Non-Goals

**Goals:**
- One specific warning, ready at the moment of the alarm, with no extra model call and no second wait.
- Roles from content, with no extra model call: piggyback on the scorer that already runs.
- Labels that don't flip-flop, and a human override that always wins.

**Non-Goals:**
- Recognising Erika's voice across calls (voice enrollment). Reson8 speaker ids are only meaningful within one session.
- Naming the caller by their claimed identity in the labels. The police report already carries it.
- Changes to the thresholds, the escalation rules or the follow-up logic.

## Decisions

1. **The scorer writes the warning: one new field in the existing JSON (`warning`).**
   - The schema description says: at most 25 words, plain language, specific to the scam type, tell her to hang up. It must not claim Lena or the police have been told. It must be an empty string when risk < 0.5, which keeps output tokens (and latency) unchanged on ordinary turns.
   - `onScam` takes the alarm score's `warning`. It's accepted if it is non-empty and ≤ 40 words. Otherwise the fallback is `FALLBACK_WARNINGS[scam_type]` (a fixed text per `SCAM_TYPES` entry), and the general text is used only for `none`/`other`.
   - *Alternatives:*
     - Fixed text per scam type only: instant and predictable, but less specific than Claude's quote-aware text. It's kept as the fallback.
     - Keep the agent's warning but don't speak the first one: Erika would wait about 5 to 8 s for any warning. Rejected.

2. **Remove `warn_grandma` from the agent.** The alarm pass keeps `notify_family`, `draft_police_report` and `request_police_call`, and its system prompt says Erika has already been warned. `AgentActions.warnGrandma` and its pipeline handler are removed.
   - This gives exactly one `alert` event and at most one phone push per call, structurally.
   - The dashboard also ignores a later `alert` if a warning already exists, as a second guard.

3. **Speaker-numbered transcript for the scorer, plus `caller_speaker` in its output.**
   - `Turn` becomes `{ speaker: string, text }`, where the speaker is "Speaker 1", "Speaker 2" (by first appearance in the call) or "Unknown speaker".
   - The new output field is `caller_speaker: "unknown" | "1" | "2"`. The prompt says "unknown" unless the content makes it clear. Typical cues: who introduces themselves, who asks for the person by name or says "this is…", who answers "Hello?", "speaking" or "yes, this is she".
   - Detection uses the same transcript, so wrong labels can no longer mislead the score.
   - *Alternative:* a separate classifier call. Rejected: an extra request per sentence, plus more latency and cost.

4. **Role state on the call (`hub.ts`).**
   - New fields: `speakers: string[]` (speaker-id keys in order of first appearance, which gives the "Speaker N" numbers), `rolesSource: "none" | "claude" | "manual"` and `pendingCaller: { speaker: string; count: number } | null`.
   - `roles` stays `Record<speakerKey, Role>`. Segments start as `unknown` and get `caller`/`grandma` when identified.
   - Adoption rule, applied after each score unless `rolesSource === "manual"`:
     - `none`: a definite answer is adopted at once.
     - `claude`: an answer that agrees with the current roles, or "unknown", clears `pendingCaller`. A disagreeing answer increments it, and the roles switch only when it reaches 2.
   - On adoption or switch, all segments are relabelled and a `state` snapshot plus a `roles` event (`{ caller: "Speaker 2", source }`) are broadcast, so the dashboard can show "Caller identified".
   - The adoption runs on every score, including the ones before any alarm, and its result also changes the labels the agent sees.

5. **Swap = manual override.**
   - If roles are identified, swap flips them.
   - If not, swap assigns Speaker 1 = Erika and Speaker 2 = Caller, which is the old default and gives the operator one-click control.
   - Either way it sets `rolesSource = "manual"`, and automatic adoption stops for that call. `reset` starts a new call with `none`.

6. **Agent transcript labels.** `transcriptText` uses `Erika`/`Caller` when known, otherwise "Speaker N".

7. **Replay mirrors live.** `replay.ts` drops `setRoles` and keeps mapping script roles to speaker ids (grandma 0, caller 1), so the server never sees the roles. `scam-fake-police` starts with the caller, so the fallback demo exercises the "caller speaks first" case. `setRoles` is removed if unused.

8. **Dashboard.**
   - The label is `Erika` / `Caller` / `Speaker N` (neutral grey style) / `Speaker ?` for an interim line from a not-yet-seen speaker.
   - It shows a 5 s note "Caller identified: Speaker 2" when `rolesSource` changes to `claude`, or "Speakers set manually" after a swap.
   - The `alert` handler sets the warning only if none exists, and speaks it once.
   - The Erika panel and the runbook drop the "replaced by Claude's warning" behaviour.

9. **Eval.**
   - `evaluateCall` builds speaker-numbered turns. A deterministic choice (a hash of the call id, so roughly half) drops a leading receiver greeting of 3 words or fewer, making the caller Speaker 1. The original indices are kept for `money_turn`/lead.
   - In full mode it records `caller_speaker` after the caller's second turn and at the last scored turn, and reports the share that is correct (`rolesAfter2`, `rolesFinal`), split by caller-first and receiver-first.
   - In caller-only mode there is only one speaker, so it reports nothing on roles there.
   - It is re-run fully, and the README table and dashboard tile are updated. Detection must not regress: the scam catch rate should stay ≥ 36/36 with a demand and 0/40 false alarms, and p50 latency at most 2.8 s.

```
  Reson8 final (speaker_id 0/1)
        |
        v
  addSegment: speakers[] order -> "Speaker 1/2", role = roles[key] ?? unknown
        |
        v
  scoreCall("Speaker 1: Hello, am I speaking with Mrs. Schneider? ...")
        |
        +--> signals + warning + caller_speaker
        |
        +--> adoptRoles(): none -> adopt | claude -> needs 2 disagreeing | manual -> ignore
        |        \--> relabel segments, broadcast state + {type:"roles"}
        |
        +--> level == scam (first time) --> onScam: warning = score.warning || FALLBACK[type]
                                                 alert x1, phone push x1, speak x1
                                                 agent: notify_family, report, 110 (no warn)
```

## Risks / Trade-offs

- **[The scorer's warning adds output tokens]** → It's only produced when risk ≥ 0.5, about 30 to 40 tokens. The eval measures p50 latency, and the acceptance limit is 2.8 s.
- **[Claude names the wrong caller early]** → It is told to answer "unknown" unless the content is clear. Switching later needs 2 agreeing results. Swap overrides. The eval measures accuracy after the caller's second turn.
- **[A scorer prompt change shifts detection]** → Full eval re-run with a no-regression check (Decision 9). If it regresses, the role and warning instructions get tightened before the demo.
- **[An invalid or very long warning]** → A word-count check plus the scam-type fallback. Zod enforces that it's a string.
- **[Removing `warn_grandma` changes the agent's story in the log]** → The log still shows Lena, the report and 110. The runbook narration changes from "Claude replaces the warning" to "the warning is written by Claude at the moment of the alarm".
- **[The in-flight `build-hackathon-demo` spec contradicts this change]** → A task updates its `call-dashboard` requirements (alarm moment, spoken warning, transcript roles, swap) so both changes archive consistently.
- **[Neutral labels for the first one or two lines look unfinished]** → That's deliberate and lasts only seconds. The "Caller identified" note turns it into a visible bit of Claude reasoning on stage.

## Migration Plan

No data to migrate. Deploy by restarting the server. To roll back, revert the commit. The old behaviour (first speaker = Erika, two warnings) comes back.

## Open Questions

- None that block. The exact wording of the fallback warnings per scam type is decided during implementation and reviewed in the replay test.
