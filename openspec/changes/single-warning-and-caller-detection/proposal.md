# Proposal

## Why

Rehearsing the one-laptop demo showed three problems:

1. **Erika gets a generic warning first.** When the alarm fires, her screen shows the hard-coded "This looks like a scam call. Hang up now. Real police never ask for money." for every scam type (`DEFAULT_WARNING` in `server/pipeline.ts`). A few seconds later the Claude agent's specific warning replaces it through `warn_grandma`.
2. **Two sounds, back to back.** No ntfy topics are configured (`NTFY_*_TOPIC` are empty), so no pushes go out. The two sounds are the laptop reading **both** warnings aloud one after the other. Problems 1 and 2 have the same root cause: there are two warnings per alarm. The second one also mutes the microphone for a second time, about 8 s after the first.
3. **Wrong names when the caller speaks first.** `pipeline.roleFor` labels whoever speaks first as "Erika". If the caller opens with "Hello", every line is labelled backwards until someone clicks Swap. The scorer is then also told the wrong roles.

## What Changes

- **One specific warning per alarm, at the moment of the alarm.**
  - The scorer, which already runs after every sentence, also writes a short warning for Erika whenever the call looks risky. The instant alarm uses that text, so Erika sees and hears the specific message ("Real police never collect cash or jewelry at your door. Hang up now.") with no extra wait.
  - If that text is ever missing, a short warning chosen by scam type is used instead (fake police, grandchild emergency, fake bank, tech support, and so on). The old one-size-fits-all text is gone.
  - The agent no longer warns Erika. It keeps alerting Lena, drafting the police report, and requesting the 110 call. **BREAKING** (agent tool set): `warn_grandma` is removed.
  - Result: exactly one warning text, spoken once, and the mic muted only once per alarm. If push topics are configured, Erika's phone topic gets at most one push per alarm.
- **Claude identifies the caller and the protected person from the conversation itself.**
  - The scorer now receives speaker-numbered lines ("Speaker 1: …") instead of guessed roles. It also reports which speaker is the caller, or "unknown" if it can't tell yet.
  - Until the speakers are identified, the transcript shows neutral labels ("Speaker 1", "Speaker 2"). Once Claude names the caller, all lines, past and future, are relabelled "Caller" and "Erika". A brief "Caller identified" note appears.
  - A later contradicting answer only switches the labels after two scores in a row agree on it.
  - **Swap speakers** stays as a manual override. After a manual swap, Claude no longer changes the labels for that call.
  - Replay no longer presets the roles, so it exercises the same identification as a live call.
- **Evaluation covers both changes.**
  - The eval sends speaker-numbered turns. In half of the calls the receiver's opening "Hello." is dropped so the caller speaks first, which means "whoever speaks first" can't be used as a shortcut.
  - It reports **caller identification accuracy** (correct after the first two caller turns, and at the end), alongside the existing detection metrics.
  - It is re-run, because the scorer prompt changes.

## Capabilities

### New Capabilities
- `scam-warning`: what Erika is warned with when a call turns into a scam. One specific message, available at the moment of the alarm and delivered once, with no generic first message and no second spoken warning.
- `speaker-roles`: deciding which voice is the caller and which is the protected person, from what is said rather than who spoke first. Covers neutral labels until then, relabelling, stability against flip-flopping, and the manual override.

### Modified Capabilities
- None in `openspec/specs/`, which is still empty. **Conflict to resolve:** the in-flight change `build-hackathon-demo` (not yet archived) has `call-dashboard` requirements that this change replaces:
  - "Scam alarm moment" (Claude's later warning replaces the text)
  - "Spoken warning without self-transcription" (each *distinct* warning text read once, assuming two)
  - "Live transcript with speaker roles" / "Speaker role correction" (first-speaker labelling)

  The tasks include reconciling that change's spec before either change is archived.

## Impact

- **Server:**
  - `server/scorer.ts`: new output fields `warning` and `caller_speaker`, speaker-numbered transcript input, prompt additions
  - `server/pipeline.ts`: warning from the score, role adoption, no first-speaker guess, swap locks the roles
  - `server/agent.ts`: `warn_grandma` removed from the alarm pass
  - `server/hub.ts`: per-call role state (`rolesSource`, a pending switch)
  - `server/replay.ts`: no preset roles
- **Dashboard** (`public/app.js`, `style.css`):
  - neutral "Speaker N" labels
  - a "Caller identified" note
  - no text replacement and no second speech on a later alert
- **Eval** (`eval/run-eval.ts`): speaker-numbered turns with a randomised order, caller identification accuracy, then a re-run (about 7 min of API calls). README results are updated.
- **Docs:** `docs/DEMO_SCRIPT.md`: Erika no longer has to speak first. The "freeze" after the alarm drops from about 15 s to about 6 s (one warning).
- **Latency:** the scorer writes about 25 more words, but only when risk is ≥ 0.5 (an empty string otherwise). The latency is measured in the eval. The target is p50 at most 2.8 s (currently 2.3 s).
- No new dependencies.
