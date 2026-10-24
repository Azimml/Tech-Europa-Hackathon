# Spec Delta

## Purpose

Defines how the dashboard shows why a call is risky: the risk after every sentence, tags on the exact lines that set off each warning sign and level, and Claude's reasons in its own words.

## ADDED Requirements

### Requirement: Risk over time
The status bar SHALL show the current risk as a percentage, and a line with one point per scored sentence, coloured by the caution and alarm thresholds. Both thresholds SHALL be drawn as labelled dashed lines, and the alarm moment SHALL be marked. The thresholds SHALL come from the server configuration, with 0.5 and 0.8 as defaults.

#### Scenario: A scam builds up
- **WHEN** a scam call goes from safe to caution to scam
- **THEN** the line climbs through the caution line and over the alarm line, and a marker shows the sentence that raised the alarm

#### Scenario: Normal call
- **WHEN** a normal call stays safe
- **THEN** the line stays below the caution line

### Requirement: Evidence tags
The transcript SHALL tag the caller's line at or before the score that:
- first lit each warning sign (the tag names the sign)
- first turned the call to caution
- raised the alarm (the tag shows the reaction time)

Tags SHALL NOT change the line's label text, which still starts with "Caller:", "Receiver:" or "Speaker N:".

#### Scenario: Alarm on the secrecy line
- **WHEN** the alarm fires on the line that asks the receiver not to tell anyone
- **THEN** that line carries a Secrecy tag and an Alarm tag with the reaction time

### Requirement: Claude's reasons as written
Claude's reasons SHALL be shown after a "Claude" tag, exactly as Claude wrote them and without added quote marks. Quote marks around a quote SHALL only be removed when they wrap the whole text and no other quote marks occur inside it.

#### Scenario: Reason with inner quotes
- **WHEN** Claude's reason is `"Detective Inspector Wagner" says "your savings are not safe"`
- **THEN** it is shown with all four quote marks
