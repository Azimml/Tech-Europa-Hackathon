# Spec Delta

## Purpose

Defines how the dashboard turns the call's caller identification into a Caller or Receiver label for every transcript line, so that once the caller is known the other person can never be left as "Speaker N". It also warns the operator when the server is too old to label correctly.

## ADDED Requirements

### Requirement: Two-person rule
Once any speaker in the current call is identified as the Caller, the dashboard SHALL label every other speaker of that call as Receiver. This applies to earlier lines, later lines and interim lines, whatever role value those lines carry and in whatever order the events arrive. Before any speaker is identified, lines SHALL keep their neutral "Speaker N" labels.

#### Scenario: Receiver's first line arrives after the caller was identified
- **WHEN** speaker 1 has been identified as the Caller, and speaker 2's first line then arrives with no role
- **THEN** speaker 2's line is labelled "Receiver"

#### Scenario: Receiver's lines carry an unknown role value
- **WHEN** the caller is identified and the other speaker's lines arrive with a role value the dashboard does not recognise
- **THEN** those lines are labelled "Receiver" and the caller's lines "Caller"

#### Scenario: Nobody identified yet
- **WHEN** two speakers have talked and no caller has been identified
- **THEN** the lines are labelled "Speaker 1" and "Speaker 2"

### Requirement: Legacy role value
The dashboard SHALL treat the role value "grandma" as "receiver" wherever it appears in call state or events.

#### Scenario: Older server
- **WHEN** a server sends the receiver's lines with the role "grandma"
- **THEN** they are labelled "Receiver"

### Requirement: Outdated server warning
The server SHALL report a protocol version (2 for this change) in its configuration endpoint. When the reported version is missing or lower than the version the dashboard expects, the dashboard SHALL show a banner telling the operator to restart the server and reload the page. It SHALL keep working with the rules above.

#### Scenario: Dashboard served next to an old server process
- **WHEN** the configuration endpoint reports no protocol version
- **THEN** a banner reads that the server is running older code and should be restarted with `npm run dev`, and transcript labels still follow the two-person rule

#### Scenario: Up-to-date server
- **WHEN** the configuration endpoint reports protocol version 2
- **THEN** no banner is shown
