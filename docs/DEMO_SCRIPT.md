# Schutzengel – Live Demo Runbook (5 min)

**Cast**
- **Presenter**: talks to the judges and drives the laptop.
- **Scammer**: teammate on a second phone, standing a few steps away. Reads the caller lines.
- **Erika**: teammate holding "Erika's phone" on speaker, next to the laptop mic. Reads Erika's lines. (The presenter can play Erika if you only have two people.)
- **Screens**: laptop (live transcript, risk meter, signal chips), Erika's phone (warning screen), Lena's phone (daughter alert), police report panel with the **Approve 110** button.

**Timing**

| Block | Time |
|---|---|
| 1. Hook | 0:00 – 0:20 |
| 2. Normal call | 0:20 – 0:50 |
| 3+4. Live scam call | 0:50 – 2:50 |
| Tech walkthrough (pipeline: Reson8 -> Claude -> alerts) | 2:50 – 4:15 |
| 5. Close | 4:15 – 5:00 |

---

## 1. Opening hook (presenter)

> "Every day in Germany, scammers posing as police officers, bank staff or grandchildren call older people, and the money is often handed over at the front door, in cash, by people who live alone. *(Swap in a verified figure here, e.g. from the BKA or Polizei-Beratung, if you have one.)* Erika is 78, a widow in Berlin, and tonight she gets a call from 'the police'. This is Schutzengel: a guardian angel that listens to the call with her and steps in before the money leaves the house."

## 2. Normal call first (~20 s): show that it stays green

Presenter: *"First, a normal call. Her grandson."*

| | Line |
|---|---|
| Scammer (as Max) | "Hi Grandma, it's Max! Are we still on for Sunday lunch?" |
| Erika | "Of course, darling! I'm making potato salad." |
| Scammer (as Max) | "Perfect. And I'll pay you back the forty euros for the train ticket, I promise." |
| Erika | "Oh, don't worry about that. See you Sunday!" |

**Cue:** point at the meter. *"Money was mentioned, family was mentioned, and it stays green. It isn't keyword matching. Claude reads the whole conversation."*
Hit **End call / reset**.

## 3 + 4. The live scam call (~90 s of call, ~2 min including talking)

Rule for the speakers: **one person at a time, a short pause after every line** so the transcript and score can catch up. Do not read the next line until the transcript shows the previous one.

| # | Speaker | Line | Stage cue / what the presenter does |
|---|---|---|---|
| 1 | Scammer | "Good evening, am I speaking with Mrs. Erika Schneider?" | Transcript appears live. Presenter: *"Reson8 is transcribing the speakerphone in real time."* |
| 2 | Erika | "Yes, speaking. Who is this?" | Meter green. |
| 3 | Scammer | "This is Detective Inspector Wagner, Berlin police, criminal investigation department. Don't worry, you're not in trouble." | **Pause until the meter turns yellow** and the *Authority claim* chip lights up. Presenter points: *"First signal: claims to be police."* |
| 4 | Erika | "The police? Oh my goodness, what happened?" | |
| 5 | Scammer | "Tonight we arrested a burglary gang in your street. Your name was on their list. And someone at your bank is working with them, your savings are not safe." | **Pause.** *Fear / urgency* chip. Presenter: *"Second signal: fear, a threat to her savings."* |
| 6 | Erika | "Oh dear. What should I do?" | |
| 7 | Scammer | "It's very important you don't tell anyone about this call. Not even your daughter." | **Pause until the meter turns orange/red** and the *Secrecy* chip lights. Presenter: *"Third signal: secrecy. Real police never say 'don't tell your daughter'."* |
| 8 | Erika | "Not even Lena?" | |
| 9 | Scammer | "Not even her. An officer will come by tonight at nine to collect your cash and jewelry for safekeeping. Put it all in an envelope." | **The money request. Meter goes RED, alarm fires.** Do not talk over the next 3 seconds, let the room see it. |
| 10 | Scammer | "And stay on the line with me until he arrives. Don't hang up." | Presenter: *"And the classic one: don't hang up, so she can't call anyone to check."* |

**While the alarm is up, the presenter walks through the screens in this order (point at each one):**

1. **Erika's phone** (hold it up): *"Erika sees a big, calm warning: 'This is not the police. Hang up. Do not hand over money.' Large text, no jargon."*
2. **Lena's phone** (hold it up / point): *"At the same moment her daughter Lena gets an alert with what was said, so she can call her mum right away."*
3. **Police report panel** (laptop): *"Claude has already drafted the police report: time, the caller's claims, the exact quotes, the requested handover tonight at nine. That's the part victims struggle with most afterwards."*
4. **Approve 110 button**: *"We never call the police automatically. Lena or Erika approves with one tap, and the report goes with the call."* Tap it.

Erika (optional, final beat): "...You know what, I'm going to hang up and call my daughter." *(hang up)*

## Tech walkthrough (presenter, ~80 s)

- Audio from the speakerphone is streamed to **Reson8** for live speech-to-text.
- Every finished sentence goes to **Claude** with the whole call so far. Claude returns a risk score plus which signals it found (authority, pressure, secrecy, money/valuables handover, remote access, gift cards/crypto) and a one-line reason. That's why the meter climbs step by step instead of jumping at a keyword.
- Over the threshold: warn Erika, alert Lena, draft the police report.
- **Evaluation**: we tested on a labeled set of real scam transcripts and normal calls, including near-misses (real bank advisor mentioning PINs, the grandson paying back money, a courier at the door). Show the eval numbers: detection rate, false alarms, and **how many turns before the money request** the alarm fires.

## 5. Close (presenter)

> "How does it reach Erika? No new phone, no app to learn: her daughter sets up call forwarding for unknown numbers to a Schutzengel number, and Schutzengel listens alongside her. And on privacy: the audio is processed live and nothing is recorded. Only when there is an alarm do we keep the text of the call, for the police report. Scammers have a script. Now Erika has one too: Schutzengel."

## 6. Practical tips

- **Setup**: Erika's phone on speaker, **right next to the laptop mic** (10–20 cm). Phone volume at max, laptop input gain checked beforehand. Scammer on the second phone a few steps away so you don't get feedback.
- **Speaking**: clear, slightly slower than normal, **one person at a time**, short pause after every line. Don't laugh into the mic.
- **Before going on stage**: fresh browser tab, logged in, both phones unlocked with screen timeout off, Lena's phone showing the alert screen, Wi-Fi / hotspot tested, API keys checked, notifications silenced.
- **Fallback if the room is too loud or the network dies**:
  1. Play the **pre-recorded scam call** through a speaker held next to the mic (have the file open and cued up).
  2. If audio fails completely, run the **replay mode** with the `scam-fake-police` script from `eval/demo-scripts.json` (text fed sentence by sentence). Say so openly: *"Wi-Fi is fighting us, here's the same pipeline on the recorded call."*
- **Rehearse twice, end to end, with a timer**, once in a noisy spot. Write down the exact second each signal lights up so you know how long to pause.
- Have one person own the clock and signal "30 seconds left".

## 7. Shot list: 2-minute submission video

Film the product being used for real. No slides with AI-generated graphics, no stock footage.

| # | Time | Shot |
|---|---|---|
| 1 | 0:00–0:10 | Close-up: an older person's hand picks up a ringing phone at a kitchen table. Caption: "Erika, 78, Berlin." |
| 2 | 0:10–0:20 | Phone put on speaker next to the laptop; the Schutzengel screen shows "Listening", meter green. |
| 3 | 0:20–0:35 | Quick normal call (grandson), transcript scrolling, meter stays green. Caption: "Normal calls stay quiet." |
| 4 | 0:35–1:10 | The fake police call. Split screen: speaker's face / phone on the left, live transcript + meter on the right. Signal chips light up one by one (authority, fear, secrecy). |
| 5 | 1:10–1:20 | Money request, meter goes red. Hard cut to Erika's phone with the warning, held for 2 seconds. |
| 6 | 1:20–1:30 | Lena's phone buzzing on a desk somewhere else, alert opened. |
| 7 | 1:30–1:40 | Screen recording: police report draft, cursor taps **Approve 110**. |
| 8 | 1:40–1:52 | Fast screen recording of the pipeline and eval results (Reson8 transcript stream, Claude score JSON, accuracy / false alarm numbers). |
| 9 | 1:52–2:00 | Erika hanging up and calling Lena. End card: "Schutzengel" plus the team names. |

Record the audio cleanly (lapel mic or phone close to the speaker), add captions for every spoken line, and keep the real UI on screen as much as possible.
