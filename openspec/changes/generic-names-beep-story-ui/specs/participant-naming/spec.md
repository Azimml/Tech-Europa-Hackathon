# Spec Delta

## Purpose

Defines the generic names for the people in and around a protected call (Caller, Receiver, Trusted contact), so the product never depends on a fictional persona's name in its interface, prompts or notifications.

## ADDED Requirements

### Requirement: Generic names in the dashboard
Once roles are identified, the dashboard SHALL label the person who phoned in as "Caller" and the person who answered as "Receiver". It SHALL call the alerted family member "Trusted contact". It MUST NOT show the persona names "Erika" or "Lena" in any label, heading, button, tooltip, placeholder or status text.

#### Scenario: Identified call
- **WHEN** Claude has identified the caller
- **THEN** transcript lines are labelled "Caller" and "Receiver", and the panel showing the alerted family member is titled with "Trusted contact"

#### Scenario: Persona names absent from the interface
- **WHEN** the dashboard is rendered in any state (idle, caution, scam, approved)
- **THEN** no element text outside the transcript and the drafted report contains "Erika" or "Lena"

### Requirement: Generic names in prompts and notifications
The scorer and agent instructions SHALL refer to "the caller", "the receiver" and "the trusted contact". Notification titles and texts to the trusted contact SHALL use the same generic terms.

#### Scenario: Trusted contact notification
- **WHEN** the agent alerts the trusted contact
- **THEN** the notification title reads "Scam call in progress" (or similar generic wording) and contains no persona name

#### Scenario: Agent instructions
- **WHEN** the agent runs
- **THEN** its instructions name no persona, and its tool for alerting family is described as alerting the trusted contact

### Requirement: Names spoken in the call are kept
Names that occur in what people actually say on the call, and that therefore appear in the transcript or in facts quoted in the drafted police report, SHALL be shown as said. They are call content, not product labels.

#### Scenario: Scammer uses a name
- **WHEN** the caller says "Am I speaking with Mrs. Erika Schneider?"
- **THEN** the transcript line shows that sentence unchanged, labelled "Caller"

### Requirement: Stored test data keeps its format
Existing test and demo call files SHALL remain valid without editing. Their role value for the person who answered SHALL be read as the receiver.

#### Scenario: Replay of a stored demo call
- **WHEN** a stored demo call whose turns use the role value "grandma" is replayed or evaluated
- **THEN** those turns are treated as the receiver's turns
