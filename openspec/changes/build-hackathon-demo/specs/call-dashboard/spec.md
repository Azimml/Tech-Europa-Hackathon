# Spec Delta

## Purpose

The single demo screen for a protected call, running on one laptop. It listens to the conversation through the laptop microphone and shows how Claude reads the call as it unfolds. It shows what the receiver and their trusted contact would each see (see participant-naming), and keeps the one irreversible action (calling the police) behind a human click.

## ADDED Requirements

### Requirement: Dashboard served at the root URL
The system SHALL serve the dashboard at `/`. It SHALL show the current call state within 1 second of loading, including a call that is already in progress, without a page reload or build step.

#### Scenario: Opening mid-call
- **WHEN** the dashboard is opened while a call already has segments and scores
- **THEN** it renders the existing transcript, risk level, signals, agent steps, report and approval from the initial state event

#### Scenario: Server restarts
- **WHEN** the event stream drops
- **THEN** the dashboard shows a "reconnecting" indicator and resumes from a fresh state snapshot once the stream is back

### Requirement: Live listening from the laptop microphone
When the operator starts listening, the dashboard SHALL capture the laptop microphone and stream it to Reson8 using a short-lived token from the server. The API key MUST NOT reach the browser. Each final sentence SHALL be submitted as a call segment with Reson8's speaker id.

#### Scenario: Start listening
- **WHEN** the operator clicks "Listen" and grants microphone permission
- **THEN** a listening indicator turns on and sentences spoken by the two people at the laptop appear in the transcript as they are finalised

#### Scenario: Reson8 not configured
- **WHEN** the server reports that Reson8 is not configured or token minting fails
- **THEN** the dashboard shows the error next to the Listen control and leaves replay available

#### Scenario: No speaker id from Reson8
- **WHEN** a final sentence arrives without a speaker id
- **THEN** it is still submitted and shown, labelled as an unknown speaker

### Requirement: Live transcript with speaker roles
The dashboard SHALL show final segments with their speaker label: Caller or Receiver once the roles are identified, a neutral "Speaker N" before that (see the speaker-roles capability). It SHALL show the in-progress interim text in a visually muted style that is replaced when the sentence is finalised.

#### Scenario: Interim then final
- **WHEN** Reson8 sends interim text followed by the final text for the same utterance
- **THEN** the muted interim line is replaced by one final line with its speaker label

### Requirement: Speaker role correction
The dashboard SHALL offer a control that swaps the Caller and Receiver labels for the whole call. A swap is a manual override that automatic identification does not undo for that call.

#### Scenario: Roles detected backwards
- **WHEN** the operator clicks "Swap speakers"
- **THEN** every segment's label flips, later segments use the corrected mapping, and a "Speakers set manually" note appears

### Requirement: Risk meter and signal breakdown
The dashboard SHALL show, on every score update: the overall risk (0 to 1), the level (safe, caution, scam) as a colour state, the four signal strengths (authority claim, money or valuables request, pressure, secrecy), the detected scam type, and Claude's short reason.

#### Scenario: Signal lights up
- **WHEN** a score arrives where a signal crosses 0.6 for the first time in the call
- **THEN** that signal is visibly highlighted and shows the reason text from that score

#### Scenario: Level never drops during a call
- **WHEN** a later score has lower risk than an earlier scam-level score
- **THEN** the displayed level stays at scam while the risk bar shows the latest value

### Requirement: Receiver's screen
The dashboard SHALL include a view standing in for the receiver's device, shown as a phone mockup (see dashboard-layout). It shows one colour state with a large label: green "Protected", amber "Be careful", or red with the current warning text. It updates within 1 second of each level change and returns to green when a new call starts.

#### Scenario: Caution
- **WHEN** the call level becomes caution
- **THEN** the receiver's screen turns amber with the label "Be careful"

#### Scenario: New call resets
- **WHEN** the operator resets the call
- **THEN** the receiver's screen returns to green "Protected"

### Requirement: Scam alarm moment
When the call reaches the scam level, the dashboard SHALL switch to an unmistakable alarm state within 200 ms of the alert, turn the receiver's screen red with the call's one warning (see the scam-warning capability), and show the reaction time (from the triggering sentence to the alarm). The warning text MUST NOT change afterwards during that call.

#### Scenario: Alarm with a specific warning
- **WHEN** the alert arrives with a warning specific to the scam
- **THEN** the alarm and the receiver's screen show that warning, it stays unchanged for the rest of the call, and the reaction time stays visible

### Requirement: Alarm tone without self-transcription
Unless the operator has turned sound off, the dashboard SHALL play one short alarm tone per scam call and MUST NOT read any text aloud (see alarm-sound). Microphone audio MUST NOT be sent to speech recognition while the tone plays.

#### Scenario: Tone during live listening
- **WHEN** the tone plays while the dashboard is listening
- **THEN** no audio is sent during the tone, and listening continues after it

#### Scenario: Sound off
- **WHEN** the operator has turned sound off
- **THEN** the alarm appears visually only and no tone plays

### Requirement: Trusted contact message
The dashboard SHALL show the message the agent sent to the receiver's trusted contact: the summary and the caller's quotes. It SHALL show whether a push notification was actually delivered or the message was shown on the dashboard only.

#### Scenario: No push configured
- **WHEN** the agent alerts the trusted contact and no push topic is configured
- **THEN** the message shows the summary and quotes and is labelled as shown on the dashboard

### Requirement: Agent activity and police report
The dashboard SHALL show each agent step as it happens (tool name and detail) and the drafted police report fields, including the key quotes.

#### Scenario: Agent runs its tools
- **WHEN** agent and report events arrive
- **THEN** each step appears in order in the agent log and the report card fills in without a reload

### Requirement: Human approval for calling the police
The dashboard SHALL show a pending police-call request with its reason and evidence and offer Approve and Decline. Nothing SHALL be presented as dialled until a human approves.

#### Scenario: Approve
- **WHEN** the operator clicks Approve on a pending request
- **THEN** the request shows as approved, and the dashboard states that the police call is simulated in this demo

#### Scenario: Already decided
- **WHEN** a decision is submitted for a request that is no longer pending
- **THEN** the dashboard shows the current status and does not change it

### Requirement: Police-call request after a later money demand
If the alarm fired before the caller demanded money or valuables, then when the scorer later reports a clear demand and no police-call request exists yet, the system SHALL run a follow-up. It may update the police report and request the police call. It MUST NOT warn the receiver or notify the trusted contact again, and SHALL run at most twice per call.

#### Scenario: Alarm on secrecy, demand later
- **WHEN** the alarm fired on a secrecy line and a later caller line demands that cash and jewelry be handed to an "officer"
- **THEN** a pending "Call 110?" request appears and the police report includes the demand and handover details

#### Scenario: No demand after the alarm
- **WHEN** the caller never demands money or valuables after the alarm
- **THEN** no follow-up runs and no police-call request is created

### Requirement: Call controls and replay fallback
The dashboard SHALL offer End call / Reset, and a picker of the scripted calls that replays the selected call through the real pipeline without a microphone.

#### Scenario: Replay a scripted scam
- **WHEN** the operator selects "scam-fake-police" and starts the replay
- **THEN** a new call begins and the transcript, scores, alarm, the receiver's screen, the trusted-contact message and agent outputs appear exactly as in a live call

### Requirement: Performance and readiness tiles
The dashboard SHALL show the latest scorer latency, the reaction time once an alarm has fired, and whether Reson8 and Claude are configured.

#### Scenario: Missing key before going on stage
- **WHEN** the configuration reports that the Reson8 or Claude key is missing
- **THEN** the matching readiness indicator is shown as not ready

### Requirement: Evaluation scoreboard
When published evaluation results exist, the dashboard SHALL show the headline numbers: detection rate, false alarm rate, median turns of early warning, and median scorer latency.

#### Scenario: No results yet
- **WHEN** no evaluation results file is available
- **THEN** the scoreboard tile is hidden and the rest of the dashboard works normally
