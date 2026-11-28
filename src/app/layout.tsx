import type { Metadata, Viewport } from "next";
import { isSimulated } from "@/lib/op";
import { currentCustomer } from "@/lib/http";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import "./app-v5.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pay Alone",
  description: "Money on your own terms for people who can't see a screen or read, starting with payments they approve alone. Built on Open Payments.",
  appleWebApp: { capable: true, title: "Pay Alone", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f3ec" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = !isSimulated() && Boolean((await currentCustomer().catch(() => null))?.demo);
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className={isSimulated() ? "simulated" : undefined}>
        {isSimulated() && (
          <div className="banner" role="note">
            SIMULATED: pretend wallet. No Open Payments calls are being made.
          </div>
        )}
        {demo && (
          <div className="banner" role="note">
            SIMULATED DEMO: pretend wallet, play money. No real money moves.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
