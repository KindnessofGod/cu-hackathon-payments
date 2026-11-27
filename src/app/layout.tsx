import type { Metadata, Viewport } from "next";
import { isSimulated } from "@/lib/op";
import { currentCustomer } from "@/lib/http";
import { Outfit } from "next/font/google";
import "./globals.css";

const sans = Outfit({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pay Alone",
  description: "A wallet that blind, elderly and non-reading people can operate alone. Built on Open Payments.",
  appleWebApp: { capable: true, title: "Pay Alone", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f3f8f4" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = !isSimulated() && Boolean((await currentCustomer().catch(() => null))?.demo);
  return (
    <html lang="en" className={sans.variable}>
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
