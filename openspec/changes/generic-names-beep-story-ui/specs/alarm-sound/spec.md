# Spec Delta

## Purpose

Defines how the scam alarm is made audible on the dashboard: one short alarm tone per alarm instead of synthesized speech, without the tone leaking into the transcript, and with a control to silence it.

## ADDED Requirements

### Requirement: Alarm tone instead of speech
When a call first reaches the scam level, the dashboard SHALL play one short alarm tone (at most 2 seconds) and MUST NOT read any text aloud. The written warning SHALL still appear on the receiver's screen.

#### Scenario: Scam detected
- **WHEN** the alert for a call arrives
- **THEN** one alarm tone plays, no speech synthesis is used, and the warning text is shown on the receiver's screen

### Requirement: One tone per call
The alarm tone SHALL play at most once per call. It MUST NOT replay for later alerts, later scores, the agent's actions, or when a dashboard joins a call that already raised its alarm.

#### Scenario: Agent finishes after the alarm
- **WHEN** the agent alerts the trusted contact, drafts the report and requests the police call
- **THEN** no further tone plays

#### Scenario: Dashboard opened during an alarmed call
- **WHEN** a dashboard connects to a call that is already at the scam level
- **THEN** it shows the alarm state silently

### Requirement: Tone does not reach speech recognition
While the alarm tone plays, and for a short tail after it (at most 500 ms), the dashboard MUST NOT send microphone audio to speech recognition. Listening SHALL continue afterwards.

#### Scenario: Tone during live listening
- **WHEN** the tone plays while the dashboard is listening
- **THEN** no audio frames are sent during the tone and its tail, and audio streaming resumes after it

### Requirement: Sound toggle
The dashboard SHALL offer a "Sound on/off" control. With sound off, the alarm is visual only and the microphone is not muted for the tone. The browser's audio SHALL be unlocked by the operator's first click on Listen, Replay or the toggle, so the tone can play at the alarm.

#### Scenario: Sound off
- **WHEN** the operator has turned sound off and a call reaches the scam level
- **THEN** no tone plays and the alarm state and warning are shown
