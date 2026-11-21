import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import type { Customer } from "@/lib/domain";
import { sign } from "@/lib/secret";
import { getStore } from "@/lib/store";

/**
 * The customer's lock-screen picture (pay code and QR) as a PNG, at a private link, so an Apple
 * Shortcut can fetch it and set it as the lock screen with no sign-in. The link is signed with the
 * app secret; the picture shows only the pay code, which cannot take money.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; sig: string }> }) {
  const { id, sig } = await ctx.params;
  const c = /^[A-Za-z0-9_-]{6,40}$/.test(id) ? await getStore().get<Customer>("customers", id) : null;
  if (!c || sign(`lockscreen:${c.id}:${c.payCode}`).slice(0, 32) !== sig) return new Response("Not found", { status: 404 });
  const qr = await QRCode.toDataURL(`paycode:${c.payCode}`, { errorCorrectionLevel: "H", margin: 1, width: 640, color: { dark: "#0f3b30", light: "#ffffff" } });
  const code = c.payCode.split("").join(" ");
  // An iPad wallpaper fills the screen upright AND sideways, so iOS zooms a tall picture until the QR
  // falls off the edge. A square picture the size of the long side (iPad Air 3: 2224) fits both ways;
  // only its middle 1668 x 1668 shows in both, so the card sits there, below the lock-screen clock.
  const w = 2224;
  const h = 2224;
  return new ImageResponse(
    (
      <div style={{ width: w, height: h, display: "flex", alignItems: "flex-start", justifyContent: "center", background: "linear-gradient(180deg, #e8f1e3 0%, #f4f8f1 55%, #dfeed6 100%)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 760, background: "#0f3b30", borderRadius: 70, padding: "44px 70px 48px", boxShadow: "0 30px 70px rgba(15,59,48,0.35)" }}>
          <div style={{ display: "flex", background: "#ffffff", borderRadius: 40, padding: 28 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={600} height={600} alt="" />
          </div>
          <div style={{ display: "flex", marginTop: 30, color: "#c3e88f", fontSize: 42, fontWeight: 600, letterSpacing: 2 }}>PAY CODE</div>
          <div style={{ display: "flex", marginTop: 4, color: "#ffffff", fontSize: 110, fontWeight: 700, letterSpacing: 8 }}>{code}</div>
          <div style={{ display: "flex", marginTop: 10, color: "rgba(255,255,255,0.75)", fontSize: 34 }}>Show this to a seller. It cannot take money.</div>
        </div>
      </div>
    ),
    { width: w, height: h, headers: { "cache-control": "no-store" } },
  );
}
