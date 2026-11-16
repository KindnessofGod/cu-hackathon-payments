import { gateway, isSimulated, OpError } from "@/lib/op";
import { getStore } from "@/lib/store";
import { ok } from "@/lib/http";

// Says whether each piece is reachable. Never returns keys, tokens or connection details.
async function check(fn: () => Promise<unknown>) {
  try {
    const value = await fn();
    return { ok: true, ...(value && typeof value === "object" ? value : {}) };
  } catch (e) {
    if (e instanceof OpError) return { ok: false, kind: e.kind, message: e.message, walletSaid: e.detail ? [e.detail.status, e.detail.code, e.detail.description].filter(Boolean).join(" ") : undefined };
    return { ok: false, message: e instanceof Error ? e.message.replace(/postgres(ql)?:\/\/\S+/gi, "[connection string hidden]") : "error" };
  }
}

export async function GET() {
  const simulated = isSimulated();
  const wallet = (role: "merchant" | "wallet", envName: string) =>
    check(async () => {
      const url = simulated ? undefined : process.env[envName];
      if (!simulated && !url) throw new Error(`${envName} is not set`);
      const w = await gateway(role).getWallet(url ?? `https://mock-wallet.invalid/${role === "merchant" ? "mama-chidi-shop" : "ada"}`);
      return { walletAddress: w.id, publicName: w.publicName, assetCode: w.assetCode, assetScale: w.assetScale };
    });
  const [seller, customer, store] = await Promise.all([
    wallet("merchant", "RECEIVER_WALLET_ADDRESS_URL"),
    wallet("wallet", "PAYER_WALLET_ADDRESS_URL"),
    check(async () => {
      await getStore().put("health", "last", { at: new Date().toISOString() });
      return { kind: process.env.DATABASE_URL ? "postgres" : "file" };
    }),
  ]);
  return ok({ simulated, seller, customer, store, appSecretSet: (process.env.APP_SECRET ?? "").length >= 32 });
}
