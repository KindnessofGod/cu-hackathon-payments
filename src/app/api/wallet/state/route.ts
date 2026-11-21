import { balanceEstimate, customerHistory, latestFinished, pendingRequest, publicCustomer, publicRequest } from "@/lib/domain";
import { currentCustomer, fail, ok } from "@/lib/http";
import { isSimulated } from "@/lib/op";
import { MOCK_HOST } from "@/lib/op/mock";

export async function GET() {
  try {
    const simulated = isSimulated();
    const customer = await currentCustomer();
    if (!customer) {
      return ok({ simulated, customer: null, suggestedWalletAddress: simulated ? `${MOCK_HOST}/ada` : (process.env.PAYER_WALLET_ADDRESS_URL ?? "") });
    }
    const pending = await pendingRequest(customer);
    const last = await latestFinished(customer);
    return ok({
      simulated,
      customer: { ...publicCustomer(customer), balance: await balanceEstimate(customer) },
      pending: pending && (pending.status === "quoted" || pending.status === "waiting") ? publicRequest(pending, customer) : null,
      history: await customerHistory(customer),
      last: pending && pending.status === "failed" ? publicRequest(pending, customer) : last ? publicRequest(last, customer) : null,
    });
  } catch (e) {
    return fail(e);
  }
}
