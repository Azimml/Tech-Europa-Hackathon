# Schutzengel: Live Demo Runbook (5 min, one laptop)

**Setup:** one laptop on the projector, showing the dashboard at `http://localhost:3000`. No phones. On screen, the **Receiver's screen** (a phone mockup) stands in for the protected person's phone, and the **Trusted contact alerted** step stands in for the message to their family member.

**Cast**
- **Presenter**: talks to the judges and drives the laptop (Listen, Approve, Reset).
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

---

## Pre-flight checklist (do it 10 minutes before you go on)

- [ ] `npm run dev` was (re)started **after** the last code change, and the dashboard is open full screen (F11) on the projector. No amber "server is running older code" banner under the header.
- [ ] **Only one dashboard open:** the footer says **1 screen connected**. If it says 2 or more, close the other tabs (including VS Code's built-in browser/preview).
- [ ] The footer shows **Reson8** and **Claude** chips in green.
- [ ] The **Evaluation** numbers appear in the footer. If not, run `npm run eval` (about 7 min).
- [ ] The microphone permission has been granted once. Click **Listen**, say "test", check that it appears, then click **End call / Reset**. That click also unlocks the alarm tone.
- [ ] **Sound on** is set, and the laptop volume is at about 70%.
- [ ] The replay picker is set to **SCAM: Fake detective wants to collect cash and jewelry**, ready for the fallback.
- [ ] You know where **Swap speakers** is (in the header). It is a manual override: after you click it, Claude stops relabelling for that call.
- [ ] Notifications are silenced, and the screen saver is off.

## 1. Opening hook (presenter)

> "Every day in Germany, scammers posing as police officers, bank staff or grandchildren call older people, and the money is often handed over at the front door, in cash, by people who live alone. *(Swap in a verified figure here, e.g. from the BKA or Polizei-Beratung, if you have one.)* Tonight a 78-year-old widow in Berlin gets a call from 'the police'. This is Schutzengel: a guardian angel that listens to the call with her and steps in before the money leaves the house. My two teammates play the call; this laptop plays Schutzengel."

## 2. Normal call first (~20 s): show that it stays green

Presenter clicks **Listen**: *"First, a normal call. Her grandson."*

| | Line |
|---|---|
| Receiver | "Hello?" *(the receiver happens to speak first here; in the scam call the caller does)* |
| Caller (as Max) | "Hi Grandma, it's Max! Are we still on for Sunday lunch?" |
| Receiver | "Of course, darling! I'm making potato salad." |
| Caller (as Max) | "Perfect. And I'll pay you back the forty euros for the train ticket, I promise." |
| Receiver | "Oh, don't worry about that. See you Sunday!" |

**Cue:** point at the transcript: the first line said "Speaker 1" until Claude worked out who is calling, then everything switched to Receiver and Caller. Point at the green status bar. *"Money was mentioned, family was mentioned, and it stays green. It isn't keyword matching. Claude reads the whole conversation."*
Click **End call / Reset**. Listening keeps running, and the screen goes back to the "how it works" view.

## 3. The live scam call (~2 min including talking)

Rules for the speakers:
- **One person at a time.**
- **After every line, pause until it appears in the transcript.** The grey text turns into a labelled line about a second after you stop.
- **When the alarm tone sounds, pause about 2 s.** Speech during the tone is deliberately not transcribed.

| # | Speaker | Line | What the screen does / what the presenter says |
|---|---|---|---|
| 1 | Caller | "Good evening, am I speaking with Mrs. Erika Schneider?" | **The caller speaks first.** The line shows as "Speaker 1". *"Reson8 is transcribing the room in real time and separating the two voices. Claude works out who is calling from what is said."* In testing, the labels switch to **Caller** right after this line, with the note "Caller identified by Claude". |
| 2 | Receiver | "Yes, speaking. Who is this?" | Labelled **Receiver**. If labels are ever wrong, click **Swap speakers**. |
| 3 | Caller | "This is Detective Inspector Wagner, Berlin police, criminal investigation department. Don't worry, you're not in trouble." | The **Authority** warning sign lights up, with Claude's quote under it. *"First sign: claims to be police."* |
| 4 | Receiver | "The police? Oh my goodness, what happened?" | |
| 5 | Caller | "Tonight we arrested a burglary gang in your street. Your name was on their list. And someone at your bank is working with them, your savings are not safe." | **The status bar turns AMBER: CAUTION** (observed in testing on this line). The phone mockup says "Be careful". *"Second sign: fear, a threat to her savings."* |
| 6 | Receiver | "Oh dear. What should I do?" | |
| 7 | Caller | "It's very important you don't tell anyone about this call. Not even your daughter." | **ALARM** (observed 2.5 to 3 s after this line): the status bar turns red, the **alarm tone** sounds once, and the phone mockup shows the warning. **Pause 2 s.** |

**Right after the alarm, the presenter walks the screen top to bottom:**
1. **Status bar**: *"SCAM, fake police, about three seconds after the sentence, with Claude's reason quoted."*
2. **Receiver's screen**: *"She hears an alarm and sees a calm warning: 'Real police never tell you to keep secrets from family… hang up now.' Claude wrote it for this exact scam, in the same step that raised the alarm. It fired before any money was mentioned, on the secrecy alone."*
3. **Claude acts**, step by step: *"Alarm, done. Trusted contact alerted, with the caller's exact words. Police report drafted."* Click the steps to show the message and the report.

Then the call continues:

| # | Speaker | Line | What the screen does / what the presenter says |
|---|---|---|---|
| 8 | Receiver | "Not even Lena?" | |
| 9 | Caller | "Not even her. An officer will come by tonight at nine to collect your cash and jewelry for safekeeping. Put it all in an envelope." | **The money demand.** About 10 s later the **Police report** step shows "updated" (demand + 9 pm pickup), and **Call 110?** turns red with **Approve / Decline**. |
| 10 | Caller | "And stay on the line with me until he arrives. Don't hang up." | *"And the classic one: don't hang up, so she can't call anyone to check."* |

4. **Call 110?**: *"The report now has the demand, the time and the handover, which is the part victims struggle with most afterwards. We never call the police automatically. A human approves."* Click **Approve**. *"Simulated here, nothing is dialled."*

Receiver (optional, final beat): "...You know what, I'm going to hang up and call my daughter."

## 4. Tech walkthrough (presenter, ~80 s)

- The laptop mic streams 16 kHz audio to **Reson8**, which transcribes live and separates the two speakers. The browser flushes after each pause so every sentence lands in about a second.
- After every sentence, **Claude** re-reads the whole call and returns strict JSON: an overall risk score, the four warning signs (authority, money ask, pressure, secrecy), the scam type, a one-line quote, which speaker is the caller, and (once risky) the warning for the receiver. That's why the bars climb step by step instead of jumping at a keyword.
- Because the same call says who the caller is, the labels don't depend on who spoke first. Because it has already written the warning, the alarm fires instantly, once, as a tone plus text. Then the **Claude agent** uses tools: alert the trusted contact, draft the report. On a later money demand it updates the report and asks a human to approve calling 110.
- **Evaluation** (point at the footer): the same scorer code replayed turn by turn over 80 labelled public test calls plus our 10 handwritten ones. Say the numbers: scams caught, false alarms, caller identified, latency. Caveat: *"The public set is synthetic and US-centric, so treat it as a sanity check."*

## 5. Close (presenter)

> "In real life this runs on the receiver's own phone while it's on speaker; today the laptop plays that part. And on privacy: the audio is processed live and nothing is recorded. The transcript lives only in memory for the call, and is only used for the police report. Scammers have a script. Now the people they call have one too: Schutzengel."

## 6. If something goes wrong

| Problem | Do this |
|---|---|
| Labels are backwards, or stay "Speaker 1/2" too long | Click **Swap speakers**. If the speakers were not identified yet, this sets Speaker 1 = Receiver, Speaker 2 = Caller. Every line flips, including future ones, and Claude stops relabelling for this call. |
| Lines don't appear / mic dead / Reson8 error under the header | Say: *"Wi-Fi is fighting us, here's the same pipeline on the recorded call."* Click **Replay** (the picker is already on the fake-police script). It runs through the real Claude scorer and agent and looks identical. |
| The room is very loud and the transcript is garbled | Move closer to the mic, speak slower. If it's still bad, switch to Replay. |
| No alarm tone | The browser needs one click before it may play sound: click **Sound off** and **Sound on** once. The red alarm still works without sound. |
| The alarm hasn't fired by the secrecy line | Keep going: the money line (9) will trigger it. Pause a little longer after each line. |
| A robot voice reads the warning, or you hear the alarm twice | Another, older dashboard is open somewhere. The footer shows "2 screens connected": close the other tab (often a VS Code preview). |
| The receiver stays "Speaker 2", or an amber "older code" banner appears | The server process is older than the page: restart it (`npm run dev`) and reload. |
| Anything stuck | **End call / Reset**, then start the call again from the first line. |

## 7. Rehearsal

- Rehearse twice, end to end, with a timer, once in a noisy spot. Write down the second each warning sign lights up, so you know how long to pause.
- One person owns the clock and signals "30 seconds left".

## 8. Shot list: 2-minute submission video

Film the product being used for real. No slides with AI-generated graphics, no stock footage.

| # | Time | Shot |
|---|---|---|
| 1 | 0:00–0:10 | Title card over the dashboard: "A 78-year-old in Berlin. Tonight 'the police' call." |
| 2 | 0:10–0:20 | The two teammates at the laptop. The presenter clicks Listen: green status, "Protected". |
| 3 | 0:20–0:35 | The quick normal call (grandson). Transcript scrolls, status stays green. Caption: "Normal calls stay quiet." |
| 4 | 0:35–1:10 | The fake police call. Screen recording: "Speaker 1" turning into "Caller", warning signs lighting up one by one with Claude's quotes, the status bar turning amber. |
| 5 | 1:10–1:25 | The secrecy line, then RED with the alarm tone audible. The receiver's screen with the warning. Hold for 2 seconds. |
| 6 | 1:25–1:35 | The Claude-acts steps turning done; click Trusted contact, then the report. |
| 7 | 1:35–1:45 | The money line, the report "updated", "Call 110?", the cursor clicking Approve. |
| 8 | 1:45–1:55 | The eval numbers and the `npm run eval` table. Caption: scams caught / false alarms / caller identified. |
| 9 | 1:55–2:00 | End card: "Schutzengel" plus the team names. |

Record clean audio (the laptop's screen recorder with the mic on), add captions for every spoken line, and keep the real UI on screen as much as possible.
