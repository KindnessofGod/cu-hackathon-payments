# Judge demo: how it works and how to run it

## What a judge sees
`/demo` shows a **simulated** customer and a **simulated** seller side by side on one device (tabs on a phone). The customer already has a ₦50,000 weekly limit. No setup, no second device. It runs on the simulated wallet with play money: no real wallet, no real money. The AI never approves or pays; the customer approves each payment (a tap, or a fingerprint if they turn it on).

## Voice, three ways
| State | Who | What works |
|---|---|---|
| Locked (default) | anyone | The whole demo by touch, with the browser's own voice. |
| Own ElevenLabs key | any visitor | Spoken read-back and spoken answers ("pay", "no"), paid from **their** key. Not the live conversation (the live agent lives in the owner's ElevenLabs account). |
| Judge access | approved judge | Live conversation with the Pay Alone agent, on the owner's credits, inside hard caps. |

The visitor's key is checked once, then kept only in an encrypted `httpOnly` cookie that ends when the browser closes. It is never saved in our database and never logged. Our server forwards each speech request to ElevenLabs with it.

## Caps on judge access (all changeable, defaults shown)
- Window: 24 hours (`JUDGE_HOURS`).
- Live conversations: 3 per judge (`JUDGE_AGENT_SESSIONS`), each at most 10 minutes (the agent's own limit), so at most 30 minutes per judge.
- Spoken sentences 150, spoken answers 80.
- Across all judges: 30 live conversations per day (`JUDGE_GLOBAL_AGENT_PER_DAY`).
- Requests: 3 per connection per hour, 40 waiting at once, a hidden field for bots.
Only the owner can approve; nobody gets the owner's credits without a tap from the owner.

## One-time setup (Vercel)
1. Open vercel.com, then the **payalone** project, then **Settings**, then **Environment Variables**.
2. Add `NTFY_TOPIC` with a long random word string (for example `payalone-judges-k4r9x2m7q1`). Production. Save.
3. Install the free **ntfy** app on your phone. Tap **+**, type the same topic, tap **Subscribe**. Allow notifications.
4. (Optional email) add `BREVO_API_KEY`, `ALERT_EMAIL_TO` (your email) and `ALERT_EMAIL_FROM` (an address you already send from in Brevo).
5. Go to **Deployments**, tap the three dots on the latest one, tap **Redeploy**. (This project does not deploy from GitHub by itself.)

## When a judge asks
Your phone shows "Pay Alone: judge access request" with their name and competition. Tap it, check the name, tap **Approve** or **Deny**. Their page unlocks voice within seconds. You can also open `/judge/approve` and enter your merchant key to see all requests, approve, or deny, and how much each used. To cut someone off, tap **Deny** on them.

The ntfy message carries only the name and competition (ntfy.sh is a public service). The email, if set up, carries their email too.

## Not changed
Real-wallet customers (your own devices, anyone who sets up with a real Interledger test wallet address) keep working as before, with the owner's voice. Set `VOICE_GATE_ALL=1` to put them behind the same lock.
