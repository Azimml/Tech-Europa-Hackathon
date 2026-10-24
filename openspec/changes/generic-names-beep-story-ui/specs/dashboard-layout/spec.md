# Spec Delta

## Purpose

Defines the story layout of the dashboard: one screen that tells the call as a story, from status to conversation to the receiver's screen to what Claude does about it, readable on a projector.

## ADDED Requirements

### Requirement: Status bar
The dashboard SHALL show a full-width status bar above the content area. It contains the current level in large type, a risk bar, the detected scam type, Claude's latest short reason, and, once an alarm has fired, the reaction time. The bar's colour SHALL follow the level (green safe, amber caution, red scam).

#### Scenario: Call turns into a scam
- **WHEN** the level becomes scam
- **THEN** the status bar turns red, shows "SCAM", the scam type and the reaction time, within 200 ms of the alert

### Requirement: Conversation and receiver side by side
Below the status bar, the dashboard SHALL show the live transcript on the left. On the right it shows a phone-shaped mockup of the receiver's screen (Protected / Be careful / scam warning; size, content and text fitting are defined by the receiver-screen capability) next to the four signal bars with their quotes.

#### Scenario: Caution
- **WHEN** the level becomes caution
- **THEN** the phone mockup shows "Be careful" in amber while the transcript stays visible on the left

### Requirement: Action tracker
Along the bottom, the dashboard SHALL show Claude's response as a sequence of four steps: Alarm, Trusted contact alerted, Police report, Call 110?. Each step is shown as waiting, in progress or done, with the time it completed. The Call 110? step SHALL carry the Approve and Decline controls while a request is pending.

#### Scenario: Agent works through the steps
- **WHEN** the alarm fires and the agent then alerts the trusted contact, drafts the report and requests the police call
- **THEN** the steps turn done in that order and the Call 110? step offers Approve and Decline

#### Scenario: No police request
- **WHEN** a call reaches the scam level but no police-call request is made
- **THEN** the Call 110? step stays waiting and offers no controls

### Requirement: Step details
Below the tracker, the dashboard SHALL show the content of one step: the trusted-contact message with quotes, the police report fields with key quotes, or the approval reason and evidence. By default it follows the latest completed step, and the operator SHALL be able to select any completed step to view it. The agent's raw step log SHALL be available in an expandable details view.

#### Scenario: Report drafted
- **WHEN** the police report is drafted
- **THEN** the detail area shows the report without any click

#### Scenario: Operator selects an earlier step
- **WHEN** the operator clicks the Trusted contact step after the report was drafted
- **THEN** the detail area shows the trusted-contact message until the operator selects another step or a new step completes

### Requirement: Idle state
With no segments in the current call, the dashboard SHALL show a short explanation of the pipeline (microphone → speech recognition → Claude → receiver and trusted contact) in place of the empty transcript and an empty tracker.

#### Scenario: Fresh call
- **WHEN** the operator resets the call
- **THEN** the idle explanation is shown and every tracker step is waiting

### Requirement: Footer
The dashboard SHALL show a slim footer with the readiness indicators, the scorer latency and, when evaluation results exist, the headline evaluation numbers.

#### Scenario: Evaluation results available
- **WHEN** an evaluation results file exists
- **THEN** the footer shows scams caught, false alarms and the median scorer latency

### Requirement: Projector resolutions
The layout SHALL fit within a single screen without page scrolling at 1280×720, 1366×768, 1440×900, 1470×956, 1512×982, 1680×1050, 1920×1080 and 2560×1440 (the sizes of the receiver-screen requirement). At every size the status bar, the phone mockup's warning text, all four signal names and the four tracker steps SHALL be fully visible. Long content (transcript, details) scrolls inside its own area.

#### Scenario: 1280x720 projector in alarm state
- **WHEN** the dashboard is shown at 1280×720 during a scam with a pending police request
- **THEN** the page has no scrollbar, and the status bar, the full warning in the phone mockup, the four signals and the four steps with Approve/Decline are all visible
