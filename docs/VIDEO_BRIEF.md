# Brief for making the demo video (Pay Alone)

Written 18 Nov 2026, about 2:50 PM WAT, for a Claude session on the owner's laptop that will produce the 3-minute demo video. Read this first, then `docs/DEMO_SCRIPT.md` (the scene-by-scene script) and `README.md` (the honest feature table).

## 1. Deadline and what is being submitted
- **Submission deadline: Wed 18 Nov 2026, 5:00 PM WAT.** The video must be finished, uploaded and linked in the form before then. Leave about 30 minutes for upload and the form. A simple video that is finished beats a rich one that is not.
- Submission items (from `docs/hackathon-participant-guide.md`, section 04): the code repository link with the **submitted commit hash**, and a **demo video, maximum 3 minutes, showing the user problem, the working product and the payment integration**. Slides are optional.
- Qualifying rules that touch the video:
  - Show the authorization and payment flow.
  - Clearly separate **working, simulated and planned**.
  - Show **no keys, tokens, passwords or sensitive personal information**. Before export, check every frame for these: browser tabs, URL bars with tokens, the ElevenLabs or Vercel dashboards, email addresses, phone notifications.

## 2. How judges score (this decides what the video emphasises)
| Criterion | Weight | What the video must make obvious |
|---|---|---|
| Financial inclusion impact | **30%** | A specific person (a blind customer, Gloria), a real barrier (she must hand her card and PIN to a helper, and helpers steal), and a credible benefit (she pays alone) |
| Open Payments integration | **25%** | Real Open Payments on the Interledger test wallet: incoming payment, quote, interactive grant with a spending limit, outgoing payment, and **the wallet itself refusing** a payment over the limit |
| Prototype execution | 20% | It works live, end to end, with honest limitations |
| Usability and accessibility | 15% | No reading needed: Siri opens it, the voice starts by itself, the whole screen is one button, and the fingerprint approves |
| Originality and practical potential | 10% | "Remove the helper" idea; the next steps (Igbo voice, ATM cash via Interswitch Paycode, testing with blind users) |

Each judge gives 0 to 5 per criterion. Ties go to inclusion impact first, then Open Payments. **Spend the most screen time on the problem and on the real payment.**

## 3. The project in one paragraph
Pay Alone is a wallet that blind, elderly and non-reading people operate **alone**, without a helper. The customer sets a weekly spending limit once, on the wallet's own consent page (an Open Payments interactive grant with `limits.debitAmount` and an interval). After that, a seller sends a request using the customer's six-digit pay code. Pay Alone's live voice (ElevenLabs agent, Nigerian voice, can be interrupted, switches to Pidgin, Yoruba and Hausa by itself) reads the exact amount from the wallet's **quote** and answers questions ("who is this?", "how much is left?"). The **fingerprint** (Touch ID passkey) approves. Voice never moves money. The wallet, not our server, refuses anything over the limit.

- Hosted app: https://payalone.vercel.app. The customer uses `/wallet` (iPad); the seller uses `/merchant` (PC).
- It runs on the real Interledger test wallet with test money (USD).
- Names in the demo:
  - Customer: "Gloria", on the iPad.
  - Seller: "Mama Chris", on the PC.

## 4. What the video should show (3:00 max)
Follow `docs/DEMO_SCRIPT.md`. Compressed:
1. **0:00–0:25 Problem.** Gloria is blind. Today she gives her card and PIN to a helper. Pay Alone removes the helper.
2. **0:25–0:45 One-time setup.** The pay code (QR and digits) and the spending limit set once on the wallet's consent page.
3. **0:45–1:50 Payment by talking.**
   - Start with the iPad locked. Hold Home and say "My wallet": Touch ID unlocks the iPad and the app opens.
   - The voice starts by itself and reads the request from the quote. Gloria asks questions, says "Pay", and the agent tells her to rest her finger on the Home button.
   - Touch ID approves. The seller screen shows **Paid**.
4. **1:50–2:20 The wallet says no.** Request more than the limit allows. The wallet refuses (403) and no money moves.
5. **2:20–2:45 Open Payments under the hood.** One diagram: incoming payment → quote → grant with limit and interval → outgoing payment. It uses two apps, two wallets and two keys. The README section "How Open Payments is used" has the exact steps.
6. **2:45–3:00 Honest close.** Use the wording in DEMO_SCRIPT ("Working / Simulated: nothing in this video / Not yet").
   - Optionally add one line on what comes next: ATM cash with a fingerprint-approved one-time code via Interswitch Paycode, read privately (see `docs/atm-accessibility-nigeria.md`). Say it is a plan.

Production tips:
- Put captions on every spoken line, so judges hear and read it.
- Add a small on-screen label "Real Interledger test wallet, test money".
- Show the seller screen and the iPad side by side, or cut between them.

## 5. Honest status (do not claim more than this)
**Verified on the owner's iPad Air 3 (iPadOS 26):**
- Siri Shortcut "My wallet" opens the app from the lock screen with Touch ID.
- The voice starts on open.
- Pidgin is detected and answered.
- The call ends properly.
- The dashboard renders.
- A $5 payment by voice was approved with Touch ID.
- Payments and the over-limit refusal work on the real test wallet.

**Built but not verified on the iPad yet:**
- Yoruba switching.
- The "Hello Pay Alone" wake after a call.
- The agent's Home-button instruction.
- "Show my QR code" by voice.
- The lock-screen wallpaper Shortcut.

If one of these works on camera, show it. If not, leave it out. Don't fake it.

**Not working:** lock-screen push alerts on this iPad. Apple accepts them but the iPad never delivered them. Say so if alerts are mentioned.

**Not supported:** Igbo in the live voice. ElevenLabs Agents has no Igbo, so the agent replies in English. An Igbo conversation is planned.

**Voice credits:** the ElevenLabs free credits ran out. The owner was upgrading to Starter (about 75 agent minutes). If the voice won't connect (the orb stays amber, or there's an apology), the credits are the likely cause.

## 6. Material available
- **Real call recordings** (MP3, mono, 16 kHz), downloaded from ElevenLabs. They are **not in git** because they hold the owner's voice. The owner has them as chat attachments; on the cloud machine they are in `demo-audio/`.

  | File | Call |
  |---|---|
  | `1334-payment-language-switch.mp3` | 4:32, a payment and a switch to Pidgin. Best |
  | `1316-send-money.mp3` | Send money |
  | `0723-send-money-mama-chris.mp3` | Send money to Mama Chris |
  | `0716-refusal-correction.mp3` | Refusal, then correction |
  | `0721-payment-history.mp3` | Payment history |

  Use a recording only over footage of that same call, or labelled "Real call recorded 18 Nov, test money". Never put it under footage of a different payment.
- Evidence for the problem: `docs/PITCH_EVIDENCE.md`.
- ATM research and the cash idea: `docs/atm-accessibility-nigeria.md`.
- Architecture: README, "How Open Payments is used". Code: `src/lib/op/real.ts`, `src/lib/domain.ts`, `src/lib/approval.ts`.

## 7. Rules for you, the video session
- Never fabricate a result, balance or screen. Label anything simulated. Nothing in the planned video is simulated.
- No secrets or personal data in the video, the repo or any upload, including the owner's email.
- Don't change the app's code for the video unless the owner asks. The cloud session handles the code, deploys and the final merge.
- Once the video is uploaded, tell the owner to give the cloud session the link. It records the video link and the submitted commit hash in the README and merges the branch into `main` before 5 PM.
