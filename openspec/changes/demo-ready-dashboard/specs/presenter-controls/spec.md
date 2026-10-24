# Spec Delta

## Purpose

Defines how the presenter runs the demo without operator clutter on the projector: a presenter mode that hides the operator controls, and single-key shortcuts for every action in the runbook.

## ADDED Requirements

### Requirement: Presenter mode
The dashboard SHALL offer a presenter mode, toggled with the P key or a header button. It hides the operator controls (Hang up, Swap speakers, Sound, the replay picker and Replay) and keeps Listen and New call. In presenter mode the dashboards counter SHALL stay hidden unless more than one dashboard is connected. The mode SHALL be off by default, remembered per browser, and settable with `?presenter=1` or `?presenter=0` in the URL.

#### Scenario: Normal call on the projector
- **WHEN** presenter mode is on and the normal call is demonstrated
- **THEN** the header shows no replay picker, so no "SCAM: …" script title is visible

#### Scenario: Second dashboard opened in presenter mode
- **WHEN** presenter mode is on and a second dashboard connects
- **THEN** the amber dashboards counter appears in the footer

### Requirement: Single-key shortcuts
The dashboard SHALL map single keys to the runbook's actions:
- L: listen or stop listening
- N: new call
- A / D: approve / decline the police call
- 1–4: show a step of "Claude acts"
- E: evaluation view
- H: hang up
- R: replay the selected call
- S: sound on or off
- W: swap speakers
- P: presenter mode
- ?: the list of keys
- Esc: close an overlay

The keys SHALL work while the operator controls are hidden. They SHALL be ignored while a modifier key is held or the replay picker has focus.

#### Scenario: Approve without the mouse
- **WHEN** a police-call request is pending and the presenter presses A
- **THEN** the request is approved, exactly as with the Approve button

#### Scenario: Browser shortcuts keep working
- **WHEN** the presenter presses Cmd+R or Ctrl+R
- **THEN** the page reloads and no shortcut runs
