# Demo script (3-minute video, and the 5-minute live pitch)

Everything shown is the hosted app on the **real Interledger test wallet** (test money). Nothing in this script is simulated; if a step fails on the day, say so and show the recorded run instead of faking it.

## Before recording
- **iPad (customer):** charged and on a network that resolves the test wallet (if pages fail with "server can't be found", switch DNS, for example the 1.1.1.1 app). `https://payalone.vercel.app/wallet` open (Home Screen icon if added). Fingerprint set up, weekly limit set, volume up, silent switch off. Voice language chosen in "Voice and settings". Passwords provider set to Apple Passwords (Settings > Apps > Safari > AutoFill & Passwords), so the fingerprint step is one Apple sheet.
- **PC (seller):** `https://payalone.vercel.app/merchant` open, the iPad's pay code in "recent customers".
- **Native iPad app:** use it only if "Verify App" has succeeded (see BUILD_LOG 17 Nov). Then the request is read out and the app listens with no tap, and Touch ID is Apple's plain prompt.
- Screen-record the iPad (Control Center > Screen Recording, with microphone on) and the PC at the same time, or film both screens.

## The 3 minutes

**0:00-0:25: The problem.** "Mama Chris sells food. Her customer, Gloria, is blind. To pay today Gloria hands her card and PIN to a helper, and helpers steal. Banks refuse her a card; apps and ATMs do not talk. Pay Alone removes the helper." (One line of evidence from `docs/PITCH_EVIDENCE.md`.)

**0:25-0:45: Set up once (show, do not redo).** On the iPad: the pay code (six digits, spoken aloud, also a QR lock-screen picture). The spending limit was set once on the wallet's own consent page (show the limit meter). "From now on she never leaves the app, and the wallet itself refuses anything over the limit."

**0:45-1:50: A payment, by voice.** On the PC, the seller types Gloria's pay code and USD 2, and sends.
- iPad: the whole screen becomes one button. One tap (none in the native app). The app reads, in the chosen language: who is asking, the amount, and the exact amount that will leave her account, taken from the wallet's quote.
- Gloria: "Who is this?" The app: "This is Mama Chris. You have paid them before."
- Gloria: "How much is left?" The app: what is left of her limit, and what will be left after this payment.
- Gloria: "Pay." The fingerprint prompt opens; she rests her finger on the Home button. "Voice never moves money: the fingerprint signs this one request, bound to this quote and amount."
- iPad: "Paid. USD 2 left your account for Mama Chris. ... is left of your limit." PC: the seller sees **Paid**, the amount the wallet reports as received.

**1:50-2:20: The wallet says no.** Seller requests more than is left (for example USD 40 on a USD 30 limit). Gloria asks "How much is left?" and hears that this is more than what is left. She says "Pay" anyway: the **wallet** refuses (HTTP 403); no money moves; the app explains it by our own record. Optionally a request where she says "No": refused, the seller sees a neutral "not paid".

**2:20-2:45: Open Payments under the hood.** One slide or the README diagram: incoming payment (seller) > quote (customer) > one interactive grant with `limits.debitAmount` and a weekly `interval` > outgoing payments under that grant, token rotation, callback hash check. Two separate apps, two wallets, two keys.

**2:45-3:00: Honest close.** "Working: everything you saw, on the test wallet. Simulated: nothing in this video. Not yet: lock-screen notifications, screen-reader testing with blind users, and native-speaker checks of the Yoruba, Igbo, Hausa and Pidgin wording. Next: test with blind users at a Lagos market."

## If something fails live
- Voice service slow: after 4 seconds the device's English voice takes over automatically. Say so.
- Microphone not heard: tap the screen; the request is read again. "Refuse this request" is always at the bottom of the screen.
- Test wallet unreachable: show the recorded video; never fake a result.
