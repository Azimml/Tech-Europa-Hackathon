# Spec Delta

## Purpose

Defines how the protected person is warned when a call turns into a scam. One plain-language message, specific to what the caller is doing, available at the moment of the alarm and delivered exactly once.

## ADDED Requirements

### Requirement: Specific warning at the moment of the alarm
When a call first reaches the scam level, the warning shown to the receiver SHALL be specific to the scam in progress (for example fake police, relative emergency, fake bank, tech support, tax office). It SHALL come from the same scoring result that raised the alarm, so it adds no wait after the alarm. It SHALL be at most 25 words and tell the receiver to hang up.

#### Scenario: Fake police alarm
- **WHEN** a caller claiming to be police demands secrecy and the call reaches the scam level
- **THEN** the first warning the receiver sees refers to the police pretence (for example "Real police never ask you to keep secrets or hand over cash. Hang up now."), not a generic message

#### Scenario: Grandchild emergency alarm
- **WHEN** a caller claiming to be a grandchild in trouble asks for money and the call reaches the scam level
- **THEN** the first warning the receiver sees refers to the family-emergency pretence, not to the police

### Requirement: Fallback warning by scam type
If the scoring result that raised the alarm contains no usable warning text (empty or longer than 40 words), the system SHALL use a fixed warning chosen by the detected scam type. It SHALL use a general warning only when the scam type is unknown.

#### Scenario: Scorer gives no warning text
- **WHEN** the alarm is raised by a score whose warning is empty and whose scam type is "fake_bank"
- **THEN** the receiver sees the fixed fake-bank warning (about bank staff never asking for PINs or card pickups)

### Requirement: Exactly one warning per alarm
For each call, the system SHALL deliver one warning text to the receiver. Nothing SHALL later replace it or add to it, so it is shown once, accompanied by at most one alarm tone (see alarm-sound), and sent at most once to the receiver's push channel. The automatic agent MUST NOT warn the receiver again.

#### Scenario: Agent runs after the alarm
- **WHEN** the agent alerts the trusted contact, drafts the report and requests the police call after the alarm
- **THEN** the receiver's warning text is unchanged, no further alarm tone plays, and no second push goes to the receiver's channel

#### Scenario: Later scores during the same call
- **WHEN** further scam-level scores arrive with different warning text
- **THEN** the warning shown stays the one from the alarm moment

### Requirement: Warning stays factual
The warning MUST NOT claim actions that have not happened yet at the moment of the alarm (for example that the trusted contact has already been told or that the police have been called).

#### Scenario: Alarm before the agent acts
- **WHEN** the warning is shown at the moment of the alarm
- **THEN** it does not say that the trusted contact or the police have been informed
