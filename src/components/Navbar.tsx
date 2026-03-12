"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useUsername } from "@/hooks/useUsername";

const NAV_LINKS = [
  { href: "/",          label: "HOME" },
  { href: "/protect",   label: "PROTECT" },
  { href: "/dashboard", label: "DASHBOARD" },
];

export function Navbar() {
  const pathname             = usePathname();
  const { address, isConnected } = useAccount();
  const { username }         = useUsername(address);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b-2 border-[#1e1e1e] bg-[#080808]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* ── Wordmark ── */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/logo.png"
            alt="SENTINEL logo"
            width={36}
            height={36}
            className="object-contain"
            priority
          />
          <span className="text-base font-bold tracking-[0.2em] text-[#39FF14] flicker">
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
                    ? "text-[#39FF14] border-b-2 border-[#39FF14]"
                    : "text-[#666] hover:text-[#e8e8e8]"
                  }
                `}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* ── Right side: username + wallet ── */}
        <div className="flex items-center gap-3">

          {/* Username badge — shown when connected and username is set */}
          {isConnected && username && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 border border-[#39FF14]/20 bg-[#39FF14]/5 font-mono text-[10px] text-[#39FF14]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14]" />
              {username}
            </div>
          )}

          {/* RainbowKit button — already shows chain + account */}
          <ConnectButton
            accountStatus="avatar"
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="h-px bg-[#39FF14] opacity-20" />
    </nav>
  );
}