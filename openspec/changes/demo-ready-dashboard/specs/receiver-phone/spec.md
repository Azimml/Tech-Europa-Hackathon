# Spec Delta

## Purpose

Defines what the receiver's phone shows before, during and after a call, beyond the scam warning in the receiver-screen capability, and the phone view for a real phone.

## ADDED Requirements

### Requirement: Phone states
The receiver's phone SHALL show:
- **before the call has any line:** a lock screen with the clock, the date and "Protected"
- **while the call is safe:** the call screen (avatar, "Unknown caller", a running call timer, call buttons) with a "Protected" badge
- **on caution:** an amber "Be careful" banner with its hint above the call screen
- **on scam:** the scam warning defined by the receiver-screen capability
- **after the call is hung up:** "Call ended" with the call's duration

#### Scenario: Call starts
- **WHEN** the first line of a call arrives
- **THEN** the lock screen turns into the call screen and its timer starts

#### Scenario: Hang up after a scam
- **WHEN** the operator hangs up a call that reached scam
- **THEN** the phone shows "Call ended", the duration and "Well done for hanging up. This was a scam call."

### Requirement: Phone view
`/phone` SHALL open the receiver's phone alone, filling the device's screen. The first tap SHALL enable the alarm sound. The "Hang up" button of the scam warning SHALL end the call; the call screen's end button SHALL NOT, so an accidental tap by whoever holds the phone cannot end the demo call.

#### Scenario: The receiver hangs up on the phone
- **WHEN** the scam warning shows on the phone view and the receiver taps "Hang up"
- **THEN** the call is marked as ended on the server and every screen shows "Call ended"

#### Scenario: Accidental tap during the call
- **WHEN** the call is still safe and the person holding the phone touches the red end button
- **THEN** the call continues

### Requirement: Phone clients counted apart
The phone view SHALL connect to the event stream as a phone client. The server SHALL count phone clients apart from dashboards, so a phone view never raises the second-dashboard warning, and SHALL print the phone address when it starts.

#### Scenario: A phone joins during the demo
- **WHEN** a phone opens `/phone` while one dashboard is open
- **THEN** the dashboard footer reads "1 screen connected · 1 phone" and is not amber
