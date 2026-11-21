"use client";
// Stage mode only: sends a live copy of this screen to the studio, so the audience sees exactly what the
// customer's iPad shows (home, savings, stocks, the payment sheet), drawn with the app's own styles.
// What is sent: the page's HTML (no scripts, no typed passwords), the stylesheet links, the screen size and
// the scroll positions. It goes over the studio's secret channel only (see stage.ts) and nothing is stored.
// The 3D orb is a canvas, which HTML cannot carry; the studio draws its own orb in the same place.
import { stageSend } from "./stage";

const SKIP = new Set(["SCRIPT", "NOSCRIPT", "NEXT-ROUTE-ANNOUNCER", "NEXTJS-PORTAL", "TEMPLATE", "IFRAME"]);
const MAX_BYTES = 180_000; // Supabase Realtime broadcast messages must stay small

async function gzipB64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Copies one element for the studio: form values and scroll offsets written in, private bits left out. */
function copyOf(el: Element): Element {
  const clone = el.cloneNode(true) as Element;
  const a = [el, ...el.querySelectorAll("*")];
  const b = [clone, ...clone.querySelectorAll("*")];
  for (let i = 0; i < a.length && i < b.length; i++) {
    const o = a[i] as HTMLElement;
    const c = b[i] as HTMLElement;
    if (o.scrollTop || o.scrollLeft) c.setAttribute("data-mscroll", `${Math.round(o.scrollTop)},${Math.round(o.scrollLeft)}`);
    if (o instanceof HTMLInputElement) {
      if (o.type === "password") c.setAttribute("value", "");
      else if (o.type === "checkbox" || o.type === "radio") {
        if (o.checked) c.setAttribute("checked", "");
        else c.removeAttribute("checked");
      } else c.setAttribute("value", o.value);
    } else if (o instanceof HTMLTextAreaElement) c.textContent = o.value;
    else if (o instanceof HTMLCanvasElement) c.replaceWith(document.createElement("i"));
    else if (o instanceof HTMLVideoElement) {
      // A live camera cannot be copied as HTML: show a plain "camera" box of the same size instead.
      const box = document.createElement("div");
      const r = o.getBoundingClientRect();
      box.setAttribute("style", `width:${Math.round(r.width)}px;height:${Math.round(r.height)}px;background:#111;color:#fff;display:grid;place-items:center;border-radius:12px;font:600 18px system-ui`);
      box.textContent = "Camera: scanning the QR code…";
      c.replaceWith(box);
    }
  }
  for (const s of clone.querySelectorAll("script, noscript, iframe, template")) s.remove();
  return clone;
}

function snapshot(): string {
  const parts: string[] = [];
  for (const el of document.body.children) {
    if (SKIP.has(el.tagName)) continue;
    parts.push(copyOf(el).outerHTML);
  }
  return parts.join("");
}

function headInfo() {
  const css = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((l) => l.href);
  const styles = [...document.querySelectorAll("head style")].map((s) => s.textContent ?? "").join("\n");
  return { css, styles, htmlClass: document.documentElement.className, htmlStyle: document.documentElement.getAttribute("style") ?? "", bodyClass: document.body.className, lang: document.documentElement.lang };
}

/** Starts mirroring; returns a stop function. "customer" is Gloria's iPad, "merchant" the seller's phone. */
export function startMirror(report?: (why: string) => void, side: "customer" | "merchant" = "customer"): () => void {
  const ev = side === "merchant" ? ({ dom: "mdom", head: "mhead", scroll: "mscroll" } as const) : ({ dom: "dom", head: "head", scroll: "scroll" } as const);
  let last = "";
  let lastHead = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let busy = false;
  let lastSent = 0;
  let warned = false;

  const send = async (force = false) => {
    timer = null;
    if (busy) return void schedule();
    busy = true;
    try {
      const head = JSON.stringify(headInfo());
      if (force || head !== lastHead) {
        lastHead = head;
        stageSend(ev.head, JSON.parse(head));
      }
      const html = snapshot();
      if (!force && html === last) {
        stageSend(ev.scroll, { sy: Math.round(window.scrollY), sx: Math.round(window.scrollX) });
        return;
      }
      last = html;
      const z = await gzipB64(html);
      if (z.length > MAX_BYTES) {
        if (!warned) report?.(`screen copy too big (${z.length} bytes)`);
        warned = true;
        return;
      }
      lastSent = Date.now();
      stageSend(ev.dom, { z, w: window.innerWidth, h: window.innerHeight, sy: Math.round(window.scrollY), sx: Math.round(window.scrollX) });
    } catch (e) {
      if (!warned) report?.(`screen copy failed: ${e instanceof Error ? e.message : String(e)}`);
      warned = true;
    } finally {
      busy = false;
    }
  };
  // At most about five copies a second; a burst of changes becomes one copy.
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => void send(), Math.max(0, 200 - (Date.now() - lastSent)));
  };

  const mo = new MutationObserver((list) => {
    // The orb rewrites its own style every frame; that alone is not a change worth sending.
    if (list.every((m) => (m.target as Element).closest?.(".glass-orb") || m.target.parentElement?.closest(".glass-orb"))) return;
    schedule();
  });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  const onScroll = () => schedule();
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  window.addEventListener("resize", onScroll);
  window.addEventListener("input", onScroll, true);
  // A full copy every few seconds, so a studio screen opened late catches up.
  const full = setInterval(() => void send(true), 4000);
  setTimeout(() => void send(true), 500);
  return () => {
    mo.disconnect();
    window.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", onScroll);
    window.removeEventListener("input", onScroll, true);
    clearInterval(full);
    if (timer) clearTimeout(timer);
  };
}
