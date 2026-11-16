// Drives both apps through their HTTP routes, the way the two screens do.
//
//   MOCK_OP=1  the whole journey runs unattended against the SIMULATED wallet (proves our code paths only).
//   real mode  stops at the wallet's consent page, because a person must approve there. It prints the link.
//
// Usage: start the app (npm run dev), then: npm run e2e
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let cookie = "";
let failed = 0;

async function call(path, { method = "GET", body, redirect = "follow" } = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, location: res.headers.get("location") };
}

function check(name, ok, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

const fmt = (a) => (a ? `${a.assetCode} ${a.value} (scale ${a.assetScale})` : "none");

async function consent(redirectUrl, approve) {
  // Simulated consent only. A real wallet's consent page needs a person.
  const grant = new URL(redirectUrl, BASE).searchParams.get("grant");
  const d = await call("/api/mock-wallet/consent", { method: "POST", body: { grant, approve } });
  const back = new URL(d.json.redirectUrl);
  const r = await call(back.pathname + back.search, { redirect: "manual" });
  return new URL(r.location, BASE).searchParams;
}

async function request(payCode, amount) {
  const made = await call("/api/merchant/requests", { method: "POST", body: { payCode, amount } });
  if (!made.json?.id) throw new Error("request not created: " + JSON.stringify(made.json));
  const state = await call("/api/wallet/state");
  return { id: made.json.id, pending: state.json.pending };
}

const approve = (p) => call(`/api/wallet/requests/${p.id}/approve`, { method: "POST", body: { proof: { method: "confirm-button", challenge: p.challenge } } });
const merchantSees = async (id) => (await call(`/api/merchant/requests/${id}`)).json;

const m = await call("/api/merchant");
if (m.status !== 200) {
  console.log("SKIP  the app is not configured:", m.json?.error?.message ?? m.status);
  process.exit(0);
}
const simulated = m.json.simulated;
console.log(`Mode: ${simulated ? "SIMULATED wallet (not Open Payments)" : "REAL test wallet"}`);
check("seller wallet resolves", true, `${m.json.merchant.name} in ${m.json.merchant.assetCode}`);

const s0 = await call("/api/wallet/state");
const setup = await call("/api/wallet/setup", { method: "POST", body: { walletAddress: s0.json.suggestedWalletAddress } });
check("customer wallet resolves", setup.status === 200, setup.json?.customer?.walletAddress ?? JSON.stringify(setup.json));
const payCode = setup.json.customer.payCode;

// 1. One payment, consent on the wallet's page.
const r1 = await request(payCode, "2000");
check("quote comes from the payer wallet", Boolean(r1.pending?.debitAmount), `debit ${fmt(r1.pending?.debitAmount)}, receive ${fmt(r1.pending?.receiveAmount)}`);
const a1 = await approve(r1.pending);
check("no limit yet, so the wallet must be asked", Boolean(a1.json.redirectUrl));
if (!simulated) {
  console.log("\nA person must approve on the wallet's page now. Open this link in a browser where the customer app is set up:");
  console.log(a1.json.redirectUrl);
  console.log("The unattended part of this script ends here in real mode.");
  process.exit(failed ? 1 : 0);
}
const back1 = await consent(a1.json.redirectUrl, true);
check("one-time payment made", back1.get("outcome") === "paid", back1.get("message") ?? "");
const seen1 = await merchantSees(r1.id);
check("seller's wallet reports the amount received", seen1.status === "received" && seen1.received.value === r1.pending.receiveAmount.value, fmt(seen1.received));

// 2. An approval cannot be reused or forged.
const r2 = await request(payCode, "500");
const forged = await call(`/api/wallet/requests/${r2.id}/approve`, { method: "POST", body: { proof: { method: "confirm-button", challenge: r1.pending.challenge } } });
check("an approval for another payment is refused", forged.status === 403);
const none = await call(`/api/wallet/requests/${r2.id}/approve`, { method: "POST", body: {} });
check("a payment with no approval is refused", none.status === 403);

// 3. Declining on the wallet's page.
const a2 = await approve(r2.pending);
const back2 = await consent(a2.json.redirectUrl, false);
check("refusing on the wallet's page pays nothing", back2.get("outcome") === "declined");
check("seller sees the refusal", (await merchantSees(r2.id)).status === "declined");

// 4. Set a weekly limit once, then approve in the app.
const cap = await call("/api/wallet/cap", { method: "POST", body: { amount: "5000", every: "week" } });
const back3 = await consent(cap.json.redirectUrl, true);
check("limit set after one consent", back3.get("outcome") === "cap_set");
const r3 = await request(payCode, "3000");
const a3 = await approve(r3.pending);
check("payment under the limit needs no redirect", a3.json.request?.status === "paid" && !a3.json.redirectUrl);
const st = (await call("/api/wallet/state")).json.customer.cap;
check("left of limit is tracked", st.left.value === String(BigInt(st.limit.value) - BigInt(a3.json.request.paid.debitAmount.value)), `left ${fmt(st.left)}`);

// 5. Over the limit: the wallet refuses.
const r4 = await request(payCode, "3000");
const a4 = await approve(r4.pending);
check("payment over the limit is refused by the wallet", a4.json.request?.status === "failed" && a4.json.request.failure.kind === "limit_exceeded", a4.json.request?.failure?.walletSaid ?? "");
check("seller received nothing for it", (await merchantSees(r4.id)).received.value === "0");

// 6. Stop everything.
const stop = await call("/api/wallet/stop", { method: "POST" });
check("stop everything cancels the permission", stop.status === 200);
const r5 = await request(payCode, "100");
const a5 = await approve(r5.pending);
check("after stopping, the next payment needs fresh consent", Boolean(a5.json.redirectUrl));

// 7. Bad inputs.
check("unknown pay code is refused", (await call("/api/merchant/requests", { method: "POST", body: { payCode: "000000", amount: "10" } })).status === 404);
check("bad amount is refused", (await call("/api/merchant/requests", { method: "POST", body: { payCode, amount: "-5" } })).status === 400);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed (simulated wallet).");
process.exit(failed ? 1 : 0);
