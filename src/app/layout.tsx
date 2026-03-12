import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";
import { Navbar } from "@/components/Navbar";
import { UsernameGate } from "@/components/username/UsernameGate";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "SENTINEL — Automated IL Protection",
  description:
    "Reactive smart contract system that automatically removes your Uniswap V2 liquidity when impermanent loss divergence exceeds your threshold. Zero manual intervention.",
  keywords: ["Uniswap V2", "impermanent loss", "LP protection", "reactive contracts", "DeFi"],
  openGraph: {
    title: "SENTINEL — Automated IL Protection",
    description: "Set your threshold. Walk away. SENTINEL watches the pool.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ibmPlexMono.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-[#080808] text-[#e8e8e8] font-mono antialiased">
        <Web3Provider>
          {/* UsernameGate — shows modal on first connect if no username set */}
          <UsernameGate>
            <div className="fixed inset-0 pointer-events-none z-50 scanlines" aria-hidden />
            <Navbar />
            <main>{children}</main>
          </UsernameGate>
        </Web3Provider>
      </body>
    </html>
  );
}