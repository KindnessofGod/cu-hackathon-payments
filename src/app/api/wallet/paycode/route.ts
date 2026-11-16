import QRCode from "qrcode";
import { fail, requireCustomer } from "@/lib/http";

/** The customer's pay code as a QR image. It only lets a seller ask; it cannot move money. */
export async function GET() {
  try {
    const c = await requireCustomer();
    const svg = await QRCode.toString(`paycode:${c.payCode}`, { type: "svg", errorCorrectionLevel: "H", margin: 2 });
    return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
