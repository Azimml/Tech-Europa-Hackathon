# Evaluation dataset

`dataset.json` holds 80 phone calls in the shared Schutzengel call format: 40 scam and 40 normal.

## Source

- **Dataset:** BothBosu/multi-agent-scam-conversation, "Synthetic Multi-Turn Scam and Non-Scam Phone Conversation Dataset with Agentic Personalities"
- **URL:** https://huggingface.co/datasets/BothBosu/multi-agent-scam-conversation
- **License:** Apache License 2.0, as stated on the dataset card. Evaluation use is allowed. Keep the attribution.
- **Split used:** `test` (320 rows: 160 scam, 160 non-scam), downloaded with the Hugging Face datasets-server `/rows` API.
- **Other datasets checked:** BothBosu/scam-dialogue and BothBosu/Scammer-Conversation are also Apache-2.0. I used the multi-agent dataset because it has clear binary labels, a balanced type taxonomy, and receivers with different personalities, which makes the conversations more varied.

## Conversion

- The dataset's `Suspect:` speaker became `caller` and `Innocent:` became `grandma` (the person who received the call). The dataset calls the caller "Suspect" even in the normal calls.
- Mapping from dataset `type` to `scam_type`:
  - `ssn` (fake Social Security Administration) → `government_or_tax`
  - `support` (fake tech support) → `tech_support`
  - `reward` (sweepstakes/prize) → `prize_or_lottery`
  - `refund` (fake overpayment refund) → `other`
  - All normal types (`appointment`, `delivery`, `insurance`, `wrong` number) → `scam_type: null`
- **`money_turn` was checked by hand for all 40 scam calls.** It is the first caller turn that asks for money or a fee, card or bank details, gift-card/MoneyPak numbers, a Western Union transfer, or remote access/software install. I also counted requests for the **Social Security number (including the last 4 digits)** as a money_turn, because in these scripts the SSN works as the key to the victim's finances. Asking only for a mailing address, name or date of birth did not count. 4 scam calls never reach a money request (the receiver hangs up first), so their `money_turn` is `null`. All normal calls have `money_turn: null`. The insurance sales calls quote prices but never ask for payment details.
- Filters: 4–40 turns, both speakers present, Latin-script text only. All 320 test rows passed.
- `id` = `bb-mas-test-<row>-<type>`. `source` gives the split and row index, so you can trace each call back to the original row.

## Sampling (deterministic)

The test split was taken in row order and grouped by label and then by dataset `type`. Within each type the rows were interleaved round-robin across receiver personalities. The script then took items round-robin across types until it had 40 per label. That gives exactly 10 calls per type. The conversion script is not part of the project. Rerunning it on the same raw files produces the same output.

## Counts

| label | scam_type / type | n |
|---|---|---|
| scam | government_or_tax (ssn) | 10 |
| scam | tech_support (support) | 10 |
| scam | prize_or_lottery (reward) | 10 |
| scam | other (refund) | 10 |
| normal | appointment | 10 |
| normal | delivery | 10 |
| normal | insurance (sales call) | 10 |
| normal | wrong number | 10 |

Receiver personalities: aggressive 16, anxious 16, and 8 each for confused, distracted, greedy, polite, skeptical and trusting. Turns per call: 5–20, mean 12.3. Every call starts with the receiver saying "Hello."

## Caveats (state these on stage)

- **Synthetic data.** Two LLM agents (Autogen with the Together API) generated these calls. They are not real recordings. The scammers are wordy and often explicit ("purchase a Green Dot gift card"), so detection is probably easier than on real calls. Treat the score as an upper bound or sanity check, not as real-world accuracy.
- **US-centric.** The scams are about the SSA, Western Union, Green Dot and Microsoft-style tech support. The scam types that matter most for the German pitch are **missing**: fake police ("falscher Polizeibeamter"), relative emergency ("Enkeltrick" / "Schockanruf"), fake bank and romance/investment scams. We should add handwritten calls for those separately.
- **English only.** Text is clean, with no ASR errors. Real Reson8 transcripts will contain recognition errors, and speaker roles may be missing or wrong.
- **Many receivers push back.** Aggressive and skeptical receivers often call out the scam themselves ("You're just trying to scam me"). A model can pick up on the grandma's words instead of the caller's. If you want to measure caller-only detection, run a second evaluation on caller turns only.
- **Few hard negatives.** Insurance sales calls (prices, "limited offers") are the closest normal calls to a scam. None of the normal calls is a real bank, police or doctor call that asks for verification.
- **Template repetition.** Names (Johnson, Karen, Rachel) and phrasings repeat a lot. With n = 80, one error moves accuracy by about 1.25 points.
- `money_turn` is a judgement call, especially the decision to count SSN requests (see above).
