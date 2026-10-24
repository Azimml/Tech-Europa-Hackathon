# Spec Delta

## Purpose

An offline evaluation harness that runs the production scam scorer and the production level rules over labelled calls, turn by turn. It answers three questions with numbers: does it catch scams, does it stay quiet on normal calls, and does it warn before the money request.

## ADDED Requirements

### Requirement: Turn-by-turn replay through the real scorer
`npm run eval` SHALL feed each labelled call through the same scorer and the same level rules (thresholds, concrete-ask rule, level never decreasing) that the live system uses. It SHALL score the call after each turn, using all turns up to that point. It MUST NOT trigger the agent, push notifications or approvals.

#### Scenario: A scam call is scored
- **WHEN** a scam call with 12 turns is evaluated
- **THEN** the harness records the level after each turn and the first turn at which the level became scam (if any)

### Requirement: Datasets and modes
The harness SHALL evaluate both `eval/dataset.json` and `eval/demo-scripts.json`. It SHALL support two modes: full transcript, and caller turns only (the protected person's turns removed). Results SHALL be reported per dataset and per mode.

#### Scenario: Caller-only mode
- **WHEN** the harness runs in caller-only mode
- **THEN** the scorer never sees the protected person's turns, and the results are labelled as caller-only

### Requirement: Headline metrics
For each dataset and mode the harness SHALL report:
- detection rate (scam calls that reached scam level)
- false alarm rate (normal calls that reached scam level)
- caution rate on normal calls
- for detected scams with a known money turn, how many turns before or after the money turn the alarm fired
- p50 and p95 scorer latency

#### Scenario: Alarm before the money request
- **WHEN** a scam's money turn is turn 9 and the level first became scam at turn 7
- **THEN** that call counts as detected with an early-warning lead of 2 turns

#### Scenario: Scam that never reaches a money request
- **WHEN** a scam call has no money turn
- **THEN** it counts towards the detection rate but is left out of the early-warning statistics

### Requirement: Bounded cost and runtime
The harness SHALL limit concurrent scorer requests to a configurable number. It SHALL accept a call limit and a dataset filter so a quick subset can run first. It SHALL print progress while it runs.

#### Scenario: Smoke run
- **WHEN** the harness is run with a limit of 10 calls
- **THEN** it evaluates at most 10 calls per dataset and prints the same report format

### Requirement: Failure tolerance
A scorer error on one turn MUST NOT abort the run. The harness SHALL retry once. If it still fails, the turn is recorded as an error, the call's previous level is kept, and the report shows the total error count.

#### Scenario: Transient API error
- **WHEN** one scorer request fails twice
- **THEN** the run completes and the report shows 1 errored turn

### Requirement: Published results
The harness SHALL print a readable summary table. It SHALL write machine-readable results, including the headline metrics, the scorer model, effort and thresholds, and a timestamp, to a file the dashboard can load. It SHALL also include the list of missed scams and false alarms with their call ids.

#### Scenario: Results available to the dashboard
- **WHEN** a run completes
- **THEN** the results file is overwritten with the new metrics, and the misses and false alarms are listed by call id
