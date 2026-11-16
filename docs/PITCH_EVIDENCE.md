# Pitch evidence summary (for the inclusion case)

Short version for the repo. The full research (34 sourced user stories, 32 first-hand quotes, past-winner analysis, scoring) is in the owner's Claude Project "CU BUILD HACKATHON": `user-stories-disability-elderly-banking.md` and `hackathon-research-report-best-problem.md`. Check each figure at its source before putting it on a slide; most were read as page summaries.

## The problem in one paragraph
Many blind, elderly and non-reading Nigerians have money in an account but cannot use it alone. Banks refuse cards, apps and ATMs do not talk, so they hand their card and PIN to a helper. Helpers (strangers at ATMs, and sometimes relatives) swap cards and take money. The fix people are offered is to depend on someone else.

## Patterns across 34 stories
| Pattern | Stories |
|---|---|
| The bank refuses independence (card refused, co-signer, indemnity, "bring a guide") | 1-13, 16 |
| The helper steals (card swap, extra withdrawals) | 15, 21, 23-26, 29-31 |
| The person cannot tell what happened (no speech, alerts late) | 8, 24, 32, 34 |
| Nobody fixes it afterwards | 14, 18, 32 |
| Buildings and staff (out of software scope) | 9, 17-20 |

## Figures (with caveats)
- About 40 million Nigerians with disabilities, per the CBN (Sept 2026, Nairametrics); another body says 35.5 million. Neither is a census.
- A survey of 10 banks by the Association for the Blind found most mobile apps largely unusable (Vanguard, Jan 2026; method and date not given).
- Literacy 60.9% in the NBS 2023/24 household survey (women 56%); a UNESCO-based figure says 70.4%.
- ATM card-swap losses in police reports: 495,000 NGN (Enugu, 63-year-old man), over 2 million NGN (Nnewi, visually impaired widow), 523,600 NGN (Port Harcourt).
- Formal financial inclusion 73% of adults (EFInA 2026), yet digital finance use is 58% for women and 47% in rural areas.
- 25% of unbanked Nigerian adults cite distrust (Findex 2025).

## Honest limits for the pitch
- Setup consent is on the wallet provider's page; its screen-reader accessibility is untested.
- Users without a smartphone are not covered (USSD or voice call: planned).
- Our server holds the capped spending permission.
- Evidence gap: most stories are from blind people in the South; few elderly or non-reading people in their own words. Interviews near Ota were planned.
- No Nigerian bank or wallet supports Open Payments yet; this is a prototype on test money that shows a capped, revocable permission is possible on an open standard.
