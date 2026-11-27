// Tells the owner a judge is waiting. Best effort, two cheap channels, either or both:
//   NTFY_TOPIC       a phone push through ntfy (free app, no account). Carries only the judge's name and competition.
//   BREVO_API_KEY + ALERT_EMAIL_TO + ALERT_EMAIL_FROM   an email through Brevo, with the full details.
// Nothing here can approve anything: the link opens a page where the owner taps Approve or Deny.
export async function alertOwner(a: { title: string; line: string; details: string; link: string }): Promise<{ ntfy: boolean; email: boolean }> {
  const out = { ntfy: false, email: false };
  const topic = process.env.NTFY_TOPIC?.trim();
  if (topic) {
    const server = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, "");
    out.ntfy = await fetch(`${server}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: { Title: a.title.replace(/[^\x20-\x7e]/g, ""), Click: a.link, Priority: "high", Tags: "bell", Actions: `view, Review, ${a.link}` },
      body: a.line,
      signal: AbortSignal.timeout(6000),
    })
      .then((r) => r.ok)
      .catch(() => false);
  }
  const key = process.env.BREVO_API_KEY?.trim();
  const to = process.env.ALERT_EMAIL_TO?.trim();
  const from = process.env.ALERT_EMAIL_FROM?.trim();
  if (key && to && from) {
    out.email = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: from, name: "Pay Alone" }, to: [{ email: to }], subject: a.title, textContent: `${a.details}\n\nReview and approve or deny:\n${a.link}\n` }),
      signal: AbortSignal.timeout(8000),
    })
      .then((r) => r.ok)
      .catch(() => false);
  }
  return out;
}
