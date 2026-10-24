# Spec Delta

## Purpose

Defines the phone mockup that shows what the receiver sees during a call: a clear status, and on a scam a structured warning whose text always fits inside the phone's screen at every supported resolution.

## ADDED Requirements

### Requirement: Phone size within the receiver panel
The phone mockup SHALL take about 40% of the receiver panel's width (between 35% and 50%), with the warning signs using the rest. It SHALL keep a phone-like portrait shape and a visible notch that does not cover any text.

#### Scenario: Laptop screen
- **WHEN** the dashboard is shown at 1470×956
- **THEN** the phone is at least 35% of the receiver panel's width and the notch does not overlap the status label

### Requirement: Structured scam content
At the scam level, the phone SHALL show, top to bottom: a warning icon, the label "SCAM CALL", the call's warning text, and a fixed "Hang up" bar at the bottom of the screen. At the safe and caution levels it SHALL show "Protected", or "Be careful" with a one-line hint.

#### Scenario: Scam
- **WHEN** the call reaches the scam level
- **THEN** the phone shows the icon, "SCAM CALL", the warning text and the "Hang up" bar, in that order

### Requirement: Warning text always fits
The warning text SHALL be sized to fit inside the phone's screen, between the label and the "Hang up" bar, without overflowing or being cut off. It starts from a large size and shrinks only as much as needed, never below 11 px. Fitting SHALL be redone whenever the warning changes or the window is resized. This SHALL hold at 1280×720, 1366×768, 1440×900, 1470×956, 1512×982, 1680×1050, 1920×1080 and 2560×1440, for warnings up to 40 words (the longest the system accepts).

#### Scenario: Longest warning on a laptop
- **WHEN** a 40-word warning is shown at 1470×956
- **THEN** all of its text is visible inside the phone's screen, above the "Hang up" bar

#### Scenario: Short warning stays large
- **WHEN** a 12-word warning is shown at 1920×1080
- **THEN** it is shown at a larger font size than a 40-word warning at the same resolution

#### Scenario: Window resized
- **WHEN** the window is resized from 1920×1080 to 1280×720 while a warning is shown
- **THEN** the warning is re-fitted and still fits

### Requirement: Header and footer on one row on laptops
At widths from 1280 px up to 1600 px, the header controls and the footer SHALL each fit on a single row.

#### Scenario: MacBook-sized screen
- **WHEN** the dashboard is shown at 1470×956
- **THEN** the header is one row high and the footer is one row high
