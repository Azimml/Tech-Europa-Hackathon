# Spec Delta

## Purpose

Decides which voice in a call is the caller and which is the receiver (the person who answered), from what is being said rather than from who spoke first, and labels the transcript accordingly. A human can always override.

## ADDED Requirements

### Requirement: Roles decided from content, not speaking order
The system MUST NOT assign the caller or protected-person role based on which speaker talked first. Roles SHALL be decided by Claude from the conversation content, such as who introduces themselves or asks for the person by name, and who answers the phone or is addressed.

#### Scenario: Caller speaks first
- **WHEN** the call starts with speaker A saying "Hello, am I speaking with Mrs. Erika Schneider? This is Detective Wagner" and speaker B answering "Yes, speaking"
- **THEN** speaker A is labelled Caller and speaker B is labelled Receiver

#### Scenario: Receiver speaks first
- **WHEN** the call starts with speaker A saying "Hello?" and speaker B saying "Hi Grandma, it's Max"
- **THEN** speaker A is labelled Receiver and speaker B is labelled Caller

### Requirement: Neutral labels until identified
Until the roles are identified, transcript lines SHALL be labelled with neutral speaker names ("Speaker 1", "Speaker 2", numbered in order of first appearance). They MUST NOT be shown as Caller or Receiver.

#### Scenario: Only one person has spoken
- **WHEN** only one speaker has said "Hello?" so far
- **THEN** the line is labelled "Speaker 1"

### Requirement: Relabel the whole call on identification
When the roles are identified, the system SHALL relabel every earlier line of the call and label later lines the same way. It SHALL show a brief indication that the caller was identified.

#### Scenario: Identification after three lines
- **WHEN** Claude identifies speaker 2 as the caller after three lines
- **THEN** all three earlier lines and every later line show Caller or Receiver accordingly, and a "Caller identified" note appears

### Requirement: Stable roles
Once identified, roles SHALL change automatically only if two consecutive scoring results both name the other speaker as the caller. A single disagreeing or "unknown" result MUST NOT change the labels.

#### Scenario: One contradicting answer
- **WHEN** roles are identified and the next scoring result names the other speaker, but the result after that agrees with the original roles
- **THEN** the labels never change

### Requirement: Manual override wins
The Swap speakers control SHALL flip the roles for the whole call. After a manual swap, automatic identification MUST NOT change the roles again for that call. A new call starts with automatic identification again.

#### Scenario: Swap after automatic identification
- **WHEN** the operator swaps speakers and later scoring results disagree with the swapped roles
- **THEN** the swapped roles stay in place until the call is reset

### Requirement: Scoring does not depend on correct labels
The scam scorer SHALL receive speaker-numbered lines, not role-labelled lines. Its detection therefore cannot be misled by wrong role labels, and it decides from content who is calling.

#### Scenario: Roles not yet identified
- **WHEN** the scorer runs before roles are identified
- **THEN** it still scores the call from the speaker-numbered transcript, and the result can include the caller identification

### Requirement: Evaluation of caller identification
The evaluation harness SHALL make the caller the first speaker in about half of the calls, by dropping the protected person's opening greeting in those calls. Speakers are numbered by first appearance. It SHALL report, for full-transcript runs, how often the caller was identified correctly after the caller's second turn and at the last scored turn.

#### Scenario: Caller speaks first in the eval
- **WHEN** a dataset call starts with the protected person saying "Hello." and the harness selects it for the caller-first variant
- **THEN** that greeting is left out, the caller becomes "Speaker 1", and the identification counts as correct only if the scorer names speaker 1 as the caller

#### Scenario: Turn indices preserved
- **WHEN** the greeting is dropped
- **THEN** the alarm turn and the money-request lead are still measured against the original turn numbers
