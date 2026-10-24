# Spec Delta

## Purpose

Makes sure that only up-to-date dashboard code reacts to an alarm, and that the operator can see when more than one dashboard is open. A forgotten or outdated tab can then never read warnings aloud or show stale behaviour during a demo.

## ADDED Requirements

### Requirement: Alarm event not understood by outdated dashboards
The server SHALL announce a call's alarm as an event named "alarm" that carries the warning text in a field named "warning". It MUST NOT also send the alarm in the earlier "alert" form, so dashboards running earlier code, which only reacted to "alert" with a "message" field, ignore it and make no sound.

#### Scenario: Old dashboard open during a scam
- **WHEN** a dashboard running earlier code is connected and a call reaches the scam level
- **THEN** that dashboard plays no tone and reads nothing aloud, while the current dashboard shows the alarm and plays its tone

### Requirement: Build id handshake
The server SHALL have a build id that changes every time it starts. It SHALL report the id in its configuration endpoint and in every full state snapshot. A dashboard SHALL remember the build id it loaded with, and SHALL reload itself once when a snapshot reports a different id.

#### Scenario: Server restarted with new code
- **WHEN** the server restarts while a dashboard is open and the dashboard reconnects
- **THEN** the dashboard reloads once, comes back connected to the restarted server, and does not reload again

#### Scenario: Normal reconnect
- **WHEN** the event stream drops briefly and reconnects to the same server process
- **THEN** the dashboard does not reload

### Requirement: Connected dashboards visible
The dashboard footer SHALL show how many dashboards are currently connected to the server, updated within 2 seconds of a dashboard connecting or disconnecting. It SHALL show the short build id.

#### Scenario: Second dashboard opened
- **WHEN** a second dashboard connects to the same server
- **THEN** both footers show "2 screens connected" within 2 seconds

#### Scenario: Second dashboard closed
- **WHEN** the second dashboard is closed
- **THEN** the remaining footer shows "1 screen connected" within 2 seconds
