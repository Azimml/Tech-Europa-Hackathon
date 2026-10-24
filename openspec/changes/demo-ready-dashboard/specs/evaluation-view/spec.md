# Spec Delta

## Purpose

Defines the full-screen evaluation that the presenter opens during the tech walkthrough, so the test results are readable from the back of the room.

## ADDED Requirements

### Requirement: Evaluation view
When evaluation results exist, E or a click on the footer's evaluation tile SHALL open a full-screen view. It contains:
- large numbers for: scams caught among those that asked for money, false alarms on normal calls, caller identification, and the median scorer latency
- a table of every dataset and mode
- the dataset caveat, with the model, effort, thresholds and run time

Esc, E or a click outside the view SHALL close it. Without results, the view SHALL say how to create them.

#### Scenario: Tech walkthrough
- **WHEN** the presenter presses E with a results file present
- **THEN** the view shows the headline numbers of that file as large cards, and fits at 1280×720 without scrolling

#### Scenario: No results yet
- **WHEN** the results file is missing and the presenter presses E
- **THEN** the view says to run `npm run eval`
