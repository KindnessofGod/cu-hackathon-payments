/**
 * The browser reports why the live voice failed, so it shows in the server logs. Only short technical
 * text (error names and messages, browser name) is accepted; nothing is stored.
 */
export async function POST(req: Request) {
  const text = (await req.text().catch(() => "")).slice(0, 600).replace(/[^\x20-\x7e]/g, "?");
  console.error("live voice (browser):", text);
  return new Response(null, { status: 204 });
}
