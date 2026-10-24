# Schutzengel: Live Demo Runbook (5 min, one laptop)

**Setup:** one laptop on the projector, showing the dashboard at `http://localhost:3000`. No phones needed (an optional real-phone view is described near the end). On screen, the **Receiver's screen** (a phone mockup) stands in for the protected person's phone, and the **Trusted contact alerted** step stands in for the message to their family member.

**Cast**
- **Presenter**: talks to the judges and drives the laptop (Listen, Approve, New call), ideally with single keys so nobody hunts for the mouse (see **Keys** below).
- **Caller**: teammate at the laptop mic, reading the scammer's lines (and the grandson's in the normal call).
- **Receiver**: teammate at the laptop mic, reading the lines of the person who answered.

Pick two people with **clearly different voices**. Reson8 tells the speakers apart by voice. Both stand 20 to 30 cm from the laptop, side by side. Names spoken *in* the lines below ("Mrs. Erika Schneider", "Lena") are part of the story; the product itself only says Caller, Receiver and Trusted contact.

**Timing**

| Block | Time |
|---|---|
| 1. Hook | 0:00 – 0:20 |
| 2. Normal call | 0:20 – 0:50 |
| 3. Live scam call | 0:50 – 2:50 |
| 4. Tech walkthrough + eval numbers | 2:50 – 4:15 |
| 5. Close | 4:15 – 5:00 |

**Keys** (press **?** on the dashboard for this list)

| Key | Does |
|---|---|
| **P** | Presenter mode: hides the operator controls, so the header only shows **Listen** and **New call** (and the replay picker no longer gives away "SCAM: …"). Press again to bring them back. Remembered in this browser. |
| **L** / **N** | Listen (or stop) / New call |
| **A** / **D** | Approve / decline the police call |
| **1** – **4** | Show a step of "Claude acts": 1 Alarm, 2 Trusted contact, 3 Police report, 4 Call 110? |
| **E** | Evaluation view (big numbers for the tech walkthrough); **Esc** closes it |
| **H** | Hang up: the receiver's screen shows "Call ended" |
| **R** / **W** / **S** | Replay the selected call / Swap speakers / Sound on-off |

---

## Pre-flight checklist (do it 10 minutes before you go on)

- [ ] `npm run dev` was (re)started **after** the last code change, and the dashboard is open full screen on the projector (Chrome on a Mac: **⌃⌘F**, Control-Command-F; F11 on a Mac shows the desktop instead. F11 on Windows). No amber "server is running older code" banner under the header.
- [ ] **Only one dashboard open:** the footer says **1 screen connected**. If it says 2 or more, close the other tabs (including VS Code's built-in browser/preview). In presenter mode this tile is hidden and only reappears, amber, when a second dashboard connects.
- [ ] The footer shows **Reson8** and **Claude** under "Powered by", both with a green dot. The Claude chip names the scorer model, e.g. "Claude Haiku 5.5". If it says Opus although you want Haiku, `SCORER_MODEL` in your `.env` overrides the default.
- [ ] The **Evaluation** numbers appear in the footer. Press **E**: the evaluation view opens; **Esc** closes it. If there are no numbers, run `npm run eval` (about 7 min).
- [ ] The microphone permission has been granted once. Click **Listen**, say "test", check that it appears and that the little level meter next to LISTENING moves, then click **New call**. That click also unlocks the alarm tone.
- [ ] **Sound on** is set, and the laptop volume is at about 70%.
- [ ] The replay picker is set to **SCAM: Fake detective wants to collect cash and jewelry**, ready for the fallback (**R** replays it, even in presenter mode).
- [ ] **Swap speakers** is a manual override (in the header, or **W**): after you use it, Claude stops relabelling for that call.
- [ ] Press **P** for presenter mode as the last step. The header now only shows Listen and New call.
- [ ] Notifications are silenced, and the screen saver is off.

## 1. Opening hook (presenter)

> "Every day in Germany, scammers posing as police officers, bank staff or grandchildren call older people, and the money is often handed over at the front door, in cash, by people who live alone. Last year, fake police officers alone took 49.5 million euros from people in Germany, almost two thirds more than the year before. Add the 'grandchild in trouble' shock calls and it's close to 100 million, and that's only what was reported. Tonight a 78-year-old widow in Berlin gets a call from 'the police'. This is Schutzengel: a guardian angel that listens to the call with her and steps in before the money leaves the house. My two teammates play the call; this laptop plays Schutzengel."

*Source for the figures, if a judge asks: BKA, police crime statistics (PKS) 2025, reported by dpa in August 2026. "Falscher Polizist": 49.5 million euros and 4,646 reported cases in 2025, against 30.1 million and 3,946 in 2024. "Schockanruf / Enkeltrick": about 49.0 million euros in 2025 ([t-online](https://www.t-online.de/nachrichten/panorama/kriminalitaet/id_101376512/schaden-durch-falsche-polizisten-stark-gestiegen.html)).*

## 2. Normal call first (~20 s): show that it stays green

Presenter clicks **Listen**: *"First, a normal call. Her grandson."*

| | Line |
|---|---|
| Receiver | "Hello?" *(the receiver happens to speak first here; in the scam call the caller does)* |
| Caller (as Max) | "Hi Grandma, it's Max! Are we still on for Sunday lunch?" |
| Receiver | "Of course, darling! I'm making potato salad." |
| Caller (as Max) | "Perfect. And I'll pay you back the forty euros for the train ticket, I promise." |
| Receiver | "Oh, don't worry about that. See you Sunday!" |

**Cue:** point at the transcript: the first line said "Speaker 1" until Claude worked out who is calling, then everything switched to Receiver and Caller (the receiver's lines move to the right, next to their phone). Point at the green status bar and the risk line that stays flat at the bottom. *"Money was mentioned, family was mentioned, and it stays green. It isn't keyword matching. Claude reads the whole conversation."*
Click **New call** (or press **N**). Listening keeps running, and the screen goes back to the "how it works" view, with the receiver's phone on its lock screen.

## 3. The live scam call (~2 min including talking)

Rules for the speakers:
- **One person at a time.**
- **After every line, pause until it appears in the transcript.** The grey text turns into a labelled line about a second after you stop.
- **When the alarm tone sounds, pause about 2 s.** Speech during the tone is deliberately not transcribed.

| # | Speaker | Line | What the screen does / what the presenter says |
|---|---|---|---|
| 1 | Caller | "Good evening, am I speaking with Mrs. Erika Schneider?" | **The caller speaks first.** The line shows as "Speaker 1". *"Reson8 is transcribing the room in real time and separating the two voices. Claude works out who is calling from what is said."* In testing, the labels switch to **Caller** right after this line, with the note "Caller identified by Claude". |
| 2 | Receiver | "Yes, speaking. Who is this?" | Labelled **Receiver**, on the right. If labels are ever wrong, press **W** (Swap speakers). |
| 3 | Caller | "This is Detective Inspector Wagner, Berlin police, criminal investigation department. Don't worry, you're not in trouble." | The **Authority** warning sign lights up with Claude's evidence, and the line gets an **AUTHORITY** tag. *"First sign: claims to be police. Claude marks the exact sentence."* |
| 4 | Receiver | "The police? Oh my goodness, what happened?" | |
| 5 | Caller | "Tonight we arrested a burglary gang in your street. Your name was on their list. And someone at your bank is working with them, your savings are not safe." | **The status bar turns AMBER: CAUTION** (observed in testing on this line), the line gets **PRESSURE** and **CAUTION** tags, and an amber **"Be careful"** banner appears on the receiver's call screen. *"Second sign: fear, a threat to her savings."* |
| 6 | Receiver | "Oh dear. What should I do?" | |
| 7 | Caller | "It's very important you don't tell anyone about this call. Not even your daughter." | **ALARM** (2.5 to 3 s after this line with the Opus scorer; Haiku is about 1 s faster, so note the time in rehearsal): the screen edges flash red once, the status bar turns red, the **alarm tone** sounds once, the receiver's phone turns into the full-screen warning, and the line gets a red **ALARM** tag with the reaction time. **Pause 2 s.** |

**Right after the alarm, the presenter walks the screen top to bottom:**
1. **Status bar**: *"SCAM, fake police, two seconds after the sentence, with Claude's reason."* (Say the reaction time the status bar shows.) Point at the risk line: *"Every dot is one sentence. You can see the scam build up: green, amber, and over the alarm line here."*
2. **Receiver's screen**: *"She hears an alarm and sees a calm warning: 'Real police never tell you to keep secrets from family… hang up now.' Claude wrote it for this exact scam, in the same step that raised the alarm. It fired before any money was mentioned, on the secrecy alone."*
3. **Claude acts**, step by step: *"Alarm, done. Trusted contact alerted, with the caller's exact words. Police report drafted."* Press **2** for the message to the trusted contact and **3** for the police report (or click the steps).

Then the call continues:

| # | Speaker | Line | What the screen does / what the presenter says |
|---|---|---|---|
| 8 | Receiver | "Not even Lena?" | |
| 9 | Caller | "Not even her. An officer will come by tonight at nine to collect your cash and jewelry for safekeeping. Put it all in an envelope." | **The money demand.** About 10 s later the **Police report** step shows "updated" (demand + 9 pm pickup), and **Call 110?** turns red with **Approve / Decline**. |
| 10 | Caller | "And stay on the line with me until he arrives. Don't hang up." | *"And the classic one: don't hang up, so she can't call anyone to check."* |

4. **Call 110?**: *"The report now has the demand, the time and the handover, which is the part victims struggle with most afterwards. We never call the police automatically. A human approves."* Click **Approve** (or press **A**). *"Simulated here, nothing is dialled."*

Receiver (optional, final beat): "...You know what, I'm going to hang up and call my daughter." The presenter presses **H**: the receiver's screen shows **"Call ended. Well done for hanging up."**

## 4. Tech walkthrough (presenter, ~80 s)

- The laptop mic streams 16 kHz audio to **Reson8**, which transcribes live and separates the two speakers. The browser flushes after each pause so every sentence lands in about a second.
- After every sentence, **Claude** re-reads the whole call and returns strict JSON: an overall risk score, the four warning signs (authority, money ask, pressure, secrecy), the scam type, a one-line quote, which speaker is the caller, and (once risky) the warning for the receiver. That's why the bars climb step by step instead of jumping at a keyword.
- Because the same call says who the caller is, the labels don't depend on who spoke first. Because it has already written the warning, the alarm fires instantly, once, as a tone plus text. Then the **Claude agent** uses tools: alert the trusted contact, draft the report. On a later money demand it updates the report and asks a human to approve calling 110.
- **Evaluation**: press **E** for the evaluation view (big enough to read from the back). The same scorer code replayed turn by turn over 80 labelled public test calls plus our 10 handwritten ones. Say the numbers: scams caught, false alarms, caller identified, latency. Caveat: *"The public set is synthetic and US-centric, so treat it as a sanity check."* **Esc** closes it.

## 5. Close (presenter)

> "In real life this runs on the receiver's own phone while it's on speaker; today the laptop plays that part. And on privacy: the audio is processed live and nothing is recorded. The transcript lives only in memory for the call, and is only used for the police report. Scammers have a script. Now the people they call have one too: Schutzengel."

## 6. If something goes wrong

| Problem | Do this |
|---|---|
| Labels are backwards, or stay "Speaker 1/2" too long | Press **W** (or click **Swap speakers**). If the speakers were not identified yet, this sets Speaker 1 = Receiver, Speaker 2 = Caller. Every line flips, including future ones, and Claude stops relabelling for this call. |
| Lines don't appear / mic dead / Reson8 error under the header | Say: *"Wi-Fi is fighting us, here's the same pipeline on the recorded call."* Press **R** (or click **Replay**; the picker is already on the fake-police script). It runs through the real Claude scorer and agent and looks identical. |
| You need a button that presenter mode hides | Press **P** to show the operator controls again, or use its key from the list above. |
| The room is very loud and the transcript is garbled | Move closer to the mic, speak slower. If it's still bad, switch to Replay. |
| No alarm tone | The browser needs one click before it may play sound: click **Sound off** and **Sound on** once. The red alarm still works without sound. |
| The alarm hasn't fired by the secrecy line | Keep going: the money line (9) will trigger it. Pause a little longer after each line. |
| A robot voice reads the warning, or you hear the alarm twice | Another, older dashboard is open somewhere. The footer shows "2 screens connected": close the other tab (often a VS Code preview). |
| The receiver stays "Speaker 2", or an amber "older code" banner appears | The server process is older than the page: restart it (`npm run dev`) and reload. |
| Anything stuck | **New call** (**N**), then start the call again from the first line. |

## Optional: the receiver's screen on a real phone

Only if both of you have rehearsed it; the demo above never needs it.

1. When `npm run dev` starts, it prints `phone http://<laptop address>:3000/phone`. Open that on a phone **on the same Wi-Fi**. If the venue Wi-Fi blocks devices from seeing each other, put the laptop on the phone's hotspot instead.
2. Tap the screen once (this turns on the alarm sound) and keep the ringer on: a phone in silent mode mutes the alarm.
3. The dashboard footer now says "1 screen connected · 1 phone" (not amber: a phone is not a stale tab).
4. The **Receiver** holds the phone during the scam call: it shows "Protected", then the amber "Be careful" banner, then the red warning with the alarm tone, at the same moment as the dashboard. For the final beat they tap **Hang up** on the phone, and every screen shows "Call ended".

## 7. Rehearsal

- Rehearse twice, end to end, with a timer, once in a noisy spot. Write down the second each warning sign lights up, so you know how long to pause.
- One person owns the clock and signals "30 seconds left".

## 8. Shot list: 2-minute submission video

Film the product being used for real. No slides with AI-generated graphics, no stock footage.

| # | Time | Shot |
|---|---|---|
| 1 | 0:00–0:10 | Title card over the dashboard: "A 78-year-old in Berlin. Tonight 'the police' call." |
| 2 | 0:10–0:20 | The two teammates at the laptop. The presenter clicks Listen (presenter mode on, **P**): green status, the receiver's phone on its lock screen with "Protected". |
| 3 | 0:20–0:35 | The quick normal call (grandson). Transcript scrolls, status stays green, the risk line stays flat. Caption: "Normal calls stay quiet." |
| 4 | 0:35–1:10 | The fake police call. Screen recording: "Speaker 1" turning into "Caller", warning signs lighting up one by one with Claude's evidence and tags on the exact lines, the risk line climbing, the status bar and the phone banner turning amber. |
| 5 | 1:10–1:25 | The secrecy line, then the red flash and RED with the alarm tone audible, the ALARM tag on the line. The receiver's screen with the warning. Hold for 2 seconds. |
| 6 | 1:25–1:35 | The Claude-acts steps turning done; press 2 (the push notification to the trusted contact), then 3 (the police report). |
| 7 | 1:35–1:45 | The money line, the report "updated", "Call 110?", the cursor clicking Approve. Optional: H, "Call ended". |
| 8 | 1:45–1:55 | The evaluation view (**E**) and the `npm run eval` table. Caption: scams caught / false alarms / caller identified. |
| 9 | 1:55–2:00 | End card: "Schutzengel" plus the team names. |

Record clean audio (the laptop's screen recorder with the mic on), add captions for every spoken line, and keep the real UI on screen as much as possible.
