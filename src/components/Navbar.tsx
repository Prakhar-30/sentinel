"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useChainId } from "wagmi";
import { getDestinationChain } from "@/config/chains.config";

const NAV_LINKS = [
  { href: "/",          label: "HOME" },
  { href: "/protect",   label: "PROTECT" },
  { href: "/dashboard", label: "DASHBOARD" },
];

export function Navbar() {
  const pathname  = usePathname();
  const chainId   = useChainId();
  const chainConf = getDestinationChain(chainId);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b-2 border-[#1e1e1e] bg-[#080808]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* ── Wordmark ── */}
        <Link href="/" className="flex items-center gap-3 group">
          {/* SVG icon: stylised shield/eye */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-neon-green">
            <path
              d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2z"
              stroke="#39FF14"
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx="12" cy="12" r="3" fill="#39FF14" opacity="0.8" />
            <path d="M12 9v1M12 14v1M9 12h1M14 12h1" stroke="#39FF14" strokeWidth="1" />
          </svg>
          <span className="text-base font-bold tracking-[0.2em] text-neon-green flicker">
            SENTINEL
          </span>
        </Link>

        {/* ── Nav links ── */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`
                  px-4 py-1.5 text-xs font-semibold tracking-[0.15em] transition-colors
                  ${active
                    ? "text-neon-green border-b-2 border-neon-green"
                    : "text-[#666] hover:text-[#e8e8e8]"
                  }
                `}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* ── Right side: network badge + wallet ── */}
        <div className="flex items-center gap-3">
          {chainConf.isTestnet && (
            <span className="badge badge-testnet hidden sm:flex">
              <span className="pulse-dot" style={{ background: "#00F5FF", boxShadow: "0 0 0 0 rgba(0,245,255,0.6)" }} />
              {chainConf.label}
            </span>
          )}
          <ConnectButton
            accountStatus="avatar"
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="h-px bg-neon-green opacity-20" />
    </nav>
  );
}