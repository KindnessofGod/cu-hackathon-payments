# CU Next Gen Hackathon: Participant Guide & Registration

Source: the organizers' Notion page https://nextgencu.notion.site/CU-Next-Gen-Hackathon-Participant-Guide-Registration-415eb48b72668158af35f17fc39a12f3 (short link bit.ly/cunextgenhack). Captured 14 Nov and re-read 15 Nov 2026. Details marked "to be confirmed" on the page may have changed. Telegram: https://t.me/+zsB6mr8qM4JhODg8

**Tagline:** Build for financial inclusion. A student hackathon building practical solutions with Interledger Open Payments. Open to students across all universities. Teams of 2 or more. Over 2 million NGN in prizes and rewards, plus swag and mentorship.

## Read on 15 Nov: what the page does and does not provide
- It names **no wallets, API keys, credits, sandbox or starter code**. Tooling is deferred to the onboarding call: "Use the tools and testing environment confirmed during onboarding."
- The only learning links are five docs pages: Open Payments documentation, Payment resources and flow, Outgoing payment authorization, Official Open Payments specifications, Interledger Foundation.
- Placeholders still unfilled: submission form link ("live by Tuesday 12AM"), technical support channel and hours, team confirmation deadline.
- Sections 06 (rules, proposed) and parts of 07 (FAQs) have collapsed sub-toggles whose text was not readable. The AI-tool rule is therefore unconfirmed.
- Support: official announcements on Telegram; registration and submission problems to @ojumah on Telegram.

## 01. The challenge and tracks

### The challenge
Build a solution that helps an underserved person, business, or community send, receive, understand, or manage payments more easily.

Your project should answer:
1. Who experiences the problem?
2. What makes their current payment experience difficult, costly, inaccessible, or unreliable?
3. How does your prototype improve that experience?
4. Where does the Open Payments API fit into your working solution, and how do any other Interledger technologies support it?
5. What evidence or reasonable assumptions support your approach?

### Tracks
Build a working prototype using the Interledger Open Payments API. Choose one primary track according to the main payment problem.

**Track 1: Cross-Border and Cross-Currency Payments.** Make sending and receiving payments across countries, currencies, or payment networks easier and more transparent. Demonstrate a supported test payment flow from sender to recipient, with clear amounts, currency information, user authorization and transaction status.

**Track 2: Inclusive Payments and Financial Access (ours).** Help people and small businesses overcome barriers to using digital payments, including cost, accessibility, language, and digital confidence. Example directions: simple merchant payments, accessible payment interfaces, conversational payment experiences, community fundraising. Demonstrate a working Open Payments journey designed for a clearly defined underserved audience, explaining which barrier it removes and how users retain control.

**Track 3: Payment Automation and Financial Workflows.** Reduce manual work, friction, and errors in collecting, distributing, or managing payments. Demonstrate a functioning workflow with authorization, clear payment status, and handling of unsuccessful payments.

**Across all tracks:** Financial inclusion, accessibility, and transparent payment information matter. **Prototype scope:** Use testnet funds and synthetic data where necessary. Clearly distinguish implemented, simulated, and planned features.

### About Open Payments
An open API standard that financial service providers can implement for interoperability when setting up and completing payments, stewarded by the Interledger Foundation. A typical flow uses authorization grants and three resource types: an incoming payment, a quote, and an outgoing payment. The prototype should show how these capabilities support a useful experience for the intended users.

Do not assume any particular bank, wallet, country, currency, or payment corridor is supported without checking the provider documentation.

## 02. Eligibility and how to join
- Open to students across all universities; every team member must be a current university student. Minimum 2 per team. Each participant on one team only. One lead for registration, submission and communications.
- Organizers, judges, and anyone with privileged access to scoring must not compete for prizes.
- Steps: register by 11:59 PM WAT Sat 14 Nov; join Telegram; confirm team (deadline not stated); attend onboarding Sun 15 Nov 2:00 PM WAT; build during the official window and keep a record; submit before the deadline; if shortlisted, confirm availability for Hacker House.
- Registration does not guarantee selection for Hacker House, a prize, or further funding.

## 03. Schedule (all times WAT, UTC+1)
| Milestone | Date | Time |
|---|---|---|
| Registration closes | Sat 14 Nov 2026 | 11:59 PM |
| Participant onboarding | Sun 15 Nov 2026 | 2:00 PM |
| **Project submission deadline** | **Wed 18 Nov 2026** | **5:00 PM** |
| Finalists notified | Thu 19 Nov 2026 | 7:00 AM |
| Hacker House day 1 | Thu 19 Nov 2026 | 4:00-7:00 PM (selected finalists) |
| Hacker House day 2 | Fri 20 Nov 2026 | 2:00-6:00 PM (selected finalists) |
| Final pitches | Sat 21 Nov 2026 | During the conference |

**Build window:** Competitive implementation starts after the Sunday onboarding call. Research, learning and team formation may happen beforehand. **All earlier code must be disclosed.**

**Hacker House:** in person at Hebron Startup Lab, no online participation; meals, internet and swag covered; bring your own laptop. Thursday: check-in, technical review, mentor feedback, user journey review, focused building. Friday: integration testing, demo reliability checks, pitch coaching, rehearsal.

**Final pitches:** 5-minute demonstration plus 3-minute Q&A. The final prototype is scored with the published rubric, without carrying over shortlisting scores. Teams must keep the initial deadline submission and clearly show improvements made during Hacker House.

## 04. Submission requirements
| Required item | What judges need |
|---|---|
| Team details | Team name, members, roles, lead contact |
| Project overview | Project name, primary track, intended users, problem statement |
| Inclusion case | The barrier addressed, expected benefit, evidence, assumptions |
| Code repository | Accessible link, submitted commit hash, dependency/license information |
| Demo video | Proposed maximum 3 minutes showing the user problem, working product, and payment integration |
| Prototype access | Working URL if hosted; otherwise reproducible local setup and safe test instructions |
| Next steps | What the team would validate or improve after the event |

A slide deck is optional for the initial submission. Do not submit passwords or API keys through public forms or repositories.

**To qualify for judging, a project must:**
- Address financial inclusion through a defined user problem.
- Include a working prototype with a meaningful Open Payments integration in an approved test environment. A logo, mention, or disconnected API call is insufficient.
- Demonstrate the relevant authorization and payment flow.
- Include setup instructions and enough evidence for judges to reproduce or assess the demonstration.
- Keep private keys, tokens, credentials, and sensitive personal information out of repositories, videos, and submission materials.

Any programming language or framework may be used if compatible with the chosen tools. Use test funds and synthetic data. Real customer money and production deployment are not required.

**Before you submit:** team information accurate; primary track and users clear; meaningful Open Payments integration shown; demo distinguishes working, simulated and planned; repository, video and prototype links accessible; limitations, prior-work disclosures, AI/external assistance disclosures and dependency credits included; submitted code version recorded; no credentials or sensitive personal information; official form completed before the deadline.

## 05. Judging
| Criterion | Weight | What judges assess |
|---|---|---|
| Financial inclusion impact | 30% | A specific underserved audience, meaningful barrier, and credible benefit |
| Open Payments integration | 25% | Functional, relevant use of the standard and appropriate authorization |
| Prototype execution | 20% | Core functionality, reliability, technical choices, honest handling of limitations |
| Usability and accessibility | 15% | A clear user journey suited to the target audience and context |
| Originality and practical potential | 10% | A thoughtful approach and realistic path to further validation |

Proposed scoring: each judge awards 0-5 per criterion; weighted total = sum of (score / 5 x weight); totals averaged across eligible, non-conflicted judges. Ties: financial inclusion impact first, then Open Payments integration, then panel deliberation.

Finalist capacity: 10 teams. Selection announced Thu 19 Nov 7:00 AM WAT. Acceptance deadline and reserve-team process: Thu 19 Nov 11:59 AM WAT. Prizes: over 2 million NGN plus swag and mentorship; categories and distribution to be announced.

## 06-07. Rules, code of conduct, FAQs
Rules are labelled "proposed" and cover: original work and existing projects, AI and external assistance, fair participation, deadlines and submission changes, ownership and licensing, rule enforcement. Their text was not readable. Code of conduct: respect; no harassment; ask permission before photographing or recording people; do not share another team's unpublished work; report concerns privately to @ojumah on Telegram.

FAQ answer that was readable: keep the submitted version for shortlisting; selected finalists may improve it during Hacker House and must record those changes separately. Final pitches take place during the conference on Sat 21 Nov; exact time to be announced.
