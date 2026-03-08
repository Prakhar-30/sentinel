"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

// ── Interactive terminal (client-only) ────────────────────────────────────────
const InteractiveTerminal = dynamic(
  () => import("@/components/InteractiveTerminal"),
  { ssr: false }
);

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return;
      started.current = true;
      obs.disconnect();
      let cur = 0;
      const step = Math.ceil(target / 60);
      const t = setInterval(() => {
        cur = Math.min(cur + step, target);
        setVal(cur);
        if (cur >= target) clearInterval(t);
      }, 22);
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ── Divergence demo ───────────────────────────────────────────────────────────
function DivergenceDemo() {
  const [bps, setBps] = useState(0);
  const threshold = 2000;
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let v = 0;
    const t = setInterval(() => {
      v = Math.min(v + 55, 8750);
      setBps(v);
      if (v >= 8750) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, []);

  const pct          = Math.min((bps / 10000) * 100, 100);
  const thresholdPct = (threshold / 10000) * 100;
  const breached     = bps >= threshold;
  const fillColor    = breached ? "#FF2D2D" : bps > 1200 ? "#FFB800" : "#39FF14";

  return (
    <div className="panel p-5 corner-accent font-mono text-xs space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-[#666] tracking-widest uppercase">RESERVE RATIO DIVERGENCE</span>
        <span className="font-bold text-sm" style={{ color: fillColor, textShadow: `0 0 10px ${fillColor}60` }}>
          {(bps / 100).toFixed(2)}%
        </span>
      </div>
      <div className="divergence-bar">
        <div className="divergence-fill" style={{ width: `${pct}%`, background: fillColor }} />
        <div className="absolute top-0 bottom-0 w-px bg-[#FFB800]" style={{ left: `${thresholdPct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-[#444]">
        <span>0%</span>
        <span style={{ color: "#FFB800", marginLeft: `${thresholdPct - 12}%` }}>▲ THRESHOLD 20%</span>
        <span>100%</span>
      </div>
      {breached && (
        <div className="text-[#FF2D2D] text-[11px] tracking-widest animate-pulse border border-[#FF2D2D] px-3 py-1.5 text-center">
          ⚠ THRESHOLD BREACHED — EXIT TRIGGERED — 8750 BPS
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
        {[
          ["ENTRY RATIO",   "1.000"],
          ["CURRENT RATIO", "1.875"],
          ["DIVERGENCE",    "8750 bps"],
          ["STATUS",        breached ? "EXITING" : "MONITORING"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-[#1a1a1a] pb-1">
            <span className="text-[#555]">{k}</span>
            <span style={{ color: k === "STATUS" && breached ? "#FF2D2D" : "#e8e8e8" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    num: "01", icon: "⬡",
    title: "DEPLOY YOUR CONTRACT",
    body: "Each user deploys their own private instance of the callback contract on Sepolia. Isolated position management — no shared state, no shared risk.",
  },
  {
    num: "02", icon: "◈",
    title: "REGISTER A POSITION",
    body: "Specify your Uniswap V2 pair, the LP token amount to protect, and your divergence threshold in basis points. The entry reserve snapshot is taken on-chain at registration time.",
  },
  {
    num: "03", icon: "◎",
    title: "REACTIVE NETWORK WATCHES",
    body: "Your Reactive contract on Lasna subscribes to the pair's Sync events. Every on-chain swap is evaluated. Divergence is computed via cross-multiplied reserve ratios — no oracles, no off-chain runners.",
  },
  {
    num: "04", icon: "◆",
    title: "AUTO-EXIT ON BREACH",
    body: "When divergence exceeds your threshold, the Reactive contract fires a callback. Your LP tokens are pulled from your wallet, burned via the Uniswap V2 router, and both tokens are returned to you. Zero manual intervention.",
  },
];

const IL_TABLE = [
  { price_change: "±10%",  il: "0.11%"  },
  { price_change: "±25%",  il: "0.60%"  },
  { price_change: "±50%",  il: "2.02%"  },
  { price_change: "±75%",  il: "5.02%"  },
  { price_change: "±100%", il: "5.72%"  },
  { price_change: "±200%", il: "13.40%" },
  { price_change: "±500%", il: "25.46%" },
];

// ── Sticky Terminal Widget ────────────────────────────────────────────────────
function StickyTerminal() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">

      {/* Terminal panel — slides up when open */}
      <div
        className={`transition-all duration-300 origin-bottom-right ${
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{ width: "min(480px, calc(100vw - 3rem))" }}
      >
        <InteractiveTerminal />
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#080808] border-2 border-[#39FF14] text-[#39FF14] font-mono text-xs tracking-widest uppercase transition-all hover:bg-[#39FF14] hover:text-black"
        style={{
          clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
          boxShadow: open ? "0 0 20px rgba(57,255,20,0.35)" : "none",
        }}
      >
        {/* Pulse dot */}
        <span className={`inline-block w-2 h-2 rounded-full ${open ? "bg-black" : "bg-[#39FF14]"} pulse-dot`} />
        {open ? "CLOSE TERMINAL" : "OPEN TERMINAL"}
        {/* Chevron */}
        <span
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ fontSize: "10px" }}
        >
          ▲
        </span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen pt-14">

      {/* ── STICKY TERMINAL ──────────────────────────────────────────────── */}
      <StickyTerminal />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex flex-col items-center justify-center px-4 overflow-hidden">

        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#39FF14 1px, transparent 1px), linear-gradient(90deg, #39FF14 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, transparent 40%, #080808 100%)" }}
        />

        {/* Main heading */}
        <div className="text-center max-w-4xl mx-auto z-10">
          <div className="text-[10px] tracking-[0.4em] text-[#39FF14] mb-4 uppercase">
            Reactive Smart Contract System
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-none mb-4">
            <span className="text-[#e8e8e8]">STOP LOSING</span>
            <br />
            <span
              className="text-[#39FF14]"
              style={{ textShadow: "0 0 40px rgba(57,255,20,0.4), 0 0 80px rgba(57,255,20,0.15)" }}
            >
              TO THE POOL
            </span>
          </h1>

          <p className="text-[#666] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mt-6 mb-10 font-mono">
            SENTINEL monitors your Uniswap V2 LP position in real time and{" "}
            <span className="text-[#e8e8e8]">automatically removes your liquidity</span>{" "}
            the moment reserve divergence exceeds your threshold.{" "}
            <span className="text-[#39FF14]">No bots. No oracles. No manual intervention.</span>
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isConnected ? (
              <Link href="/protect" className="btn-sentinel text-sm px-8 py-3">
                DEPLOY &amp; PROTECT
              </Link>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button onClick={openConnectModal} className="btn-sentinel text-sm px-8 py-3">
                    CONNECT WALLET
                  </button>
                )}
              </ConnectButton.Custom>
            )}
            <Link href="/dashboard" className="btn-sentinel btn-sentinel-ghost text-sm px-8 py-3">
              VIEW DASHBOARD
            </Link>
          </div>

          {/* Terminal hint */}
          <div className="mt-8 flex items-center justify-center gap-2 text-[10px] tracking-widest text-[#444]">
            <span className="pulse-dot" style={{ width: 6, height: 6 }} />
            TERMINAL ACTIVE — BOTTOM RIGHT
            <span className="pulse-dot" style={{ width: 6, height: 6 }} />
          </div>

          <div className="mt-3 text-[10px] tracking-widest text-[#333]">
            ◈ RUNNING ON ETHEREUM SEPOLIA × REACTIVE LASNA TESTNET ◈
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#333] text-[10px] tracking-widest">
          <span>SCROLL</span>
          <div className="w-px h-8 bg-[#333]" />
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────────────── */}
      <section className="border-y-2 border-[#1e1e1e] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-0 divide-x-0 md:divide-x divide-[#1e1e1e]">
          {[
            { label: "CHAINS SUPPORTED",   value: 1,    suffix: ""     },
            { label: "BLOCK LATENCY",      value: 1,    suffix: " blk" },
            { label: "MANUAL OPS NEEDED",  value: 0,    suffix: ""     },
            { label: "MAX DIVERGENCE BPS", value: 9999, suffix: ""     },
          ].map(({ label, value, suffix }) => (
            <div key={label} className="px-6 py-3 text-center">
              <div className="text-2xl font-bold text-[#39FF14] mb-1">
                <Counter target={value} suffix={suffix} />
              </div>
              <div className="text-[10px] text-[#555] tracking-[0.15em]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── DIVERGENCE DEMO ──────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-[10px] tracking-[0.35em] text-[#39FF14] mb-3 uppercase">
            Live Demo Replay — June 2025 Test
          </div>
          <h2 className="text-3xl font-bold text-[#e8e8e8] mb-5 leading-tight">
            WATCH THE BREACH.<br />
            <span className="text-[#39FF14]">WATCH THE EXIT.</span>
          </h2>
          <p className="text-[#666] text-sm leading-relaxed mb-6">
            In our test execution, a 5 TOKEN0 swap shifted reserves from{" "}
            <span className="text-[#e8e8e8]">10:10</span> to{" "}
            <span className="text-[#e8e8e8]">15:8</span>, causing{" "}
            <span className="text-[#FF2D2D]">8750 bps (87.5%) divergence</span> — well beyond the
            2000 bps threshold. SENTINEL auto-exited the position within the same block.
          </p>
          <div className="space-y-2 text-xs text-[#555] font-mono">
            {[
              ["ENTRY RESERVES",    "10e18 / 10e18",           "#e8e8e8"],
              ["POST-SWAP RESERVES","15e18 / 8e18",            "#e8e8e8"],
              ["THRESHOLD",         "2000 bps (20%)",          "#FFB800"],
              ["ACTUAL DIVERGENCE", "8750 bps (87.5%)",        "#FF2D2D"],
              ["TRIGGER STATUS",    "BREACHED — AUTO-EXITED",  "#39FF14"],
            ].map(([k, v, c]) => (
              <div key={k} className="data-row">
                <span className="data-label">{k}</span>
                <span style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <DivergenceDemo />
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="border-t-2 border-[#1a1a1a] bg-[#0a0a0a] py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-[10px] tracking-[0.35em] text-[#39FF14] mb-3">PROTOCOL ARCHITECTURE</div>
            <h2 className="text-3xl font-bold text-[#e8e8e8]">HOW SENTINEL WORKS</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#1a1a1a]">
            {STEPS.map((s, i) => (
              <div key={s.num} className="bg-[#0a0a0a] p-7 relative group hover:bg-[#0f0f0f] transition-colors">
                <div className="text-[60px] font-bold text-[#111] leading-none mb-4 select-none group-hover:text-[#161616] transition-colors">
                  {s.num}
                </div>
                <div className="text-xl text-[#39FF14] mb-3">{s.icon}</div>
                <h3 className="text-sm font-bold tracking-widest text-[#e8e8e8] mb-3">{s.title}</h3>
                <p className="text-xs text-[#555] leading-relaxed">{s.body}</p>
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 text-[#333] text-lg z-10">›</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IL REFERENCE TABLE ───────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-16 items-start">
        <div>
          <div className="text-[10px] tracking-[0.35em] text-[#39FF14] mb-3">IMPERMANENT LOSS REFERENCE</div>
          <h2 className="text-3xl font-bold text-[#e8e8e8] mb-5 leading-tight">
            KNOW YOUR<br />
            <span className="text-[#FFB800]">EXPOSURE</span>
          </h2>
          <p className="text-[#666] text-sm leading-relaxed mb-6">
            Impermanent loss is the divergence between holding tokens and providing them as liquidity.
            The wider the price move, the worse the loss. Set your SENTINEL threshold to exit before it compounds.
          </p>
          <p className="text-[#555] text-xs leading-relaxed">
            IL is calculated as: <span className="text-[#e8e8e8]">2√p/(1+p) − 1</span> where{" "}
            <span className="text-[#e8e8e8]">p</span> is the price ratio between entry and current.
            SENTINEL monitors reserve ratio divergence as a real-time proxy for this.
          </p>
        </div>
        <div className="panel">
          <div className="px-5 py-3 border-b border-[#1e1e1e] flex justify-between text-[10px] text-[#444] tracking-widest">
            <span>PRICE CHANGE</span>
            <span>IL LOSS</span>
          </div>
          {IL_TABLE.map(({ price_change, il }) => (
            <div key={price_change} className="data-row px-5">
              <span className="data-label">{price_change}</span>
              <span className="text-[#e8e8e8]">{il}</span>
            </div>
          ))}
          <div className="px-5 py-3 text-[10px] text-[#444] border-t border-[#1e1e1e]">
            Source: Uniswap V2 constant product formula
          </div>
        </div>
      </section>

      {/* ── TWO CHAINS ───────────────────────────────────────────────────── */}
      <section className="border-t-2 border-[#1a1a1a] bg-[#0a0a0a] py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-[10px] tracking-[0.35em] text-[#39FF14] mb-3">DUAL-CHAIN ARCHITECTURE</div>
            <h2 className="text-3xl font-bold text-[#e8e8e8]">TWO CHAINS. ONE SYSTEM.</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-px bg-[#1a1a1a] max-w-4xl mx-auto">
            {[
              {
                chain: "ETHEREUM SEPOLIA", badge: "DESTINATION CHAIN", color: "#39FF14",
                contract: "UniswapV2ILProtectionCallback",
                points: ["Manages LP position registry","Holds entry reserve snapshots","Executes removeLiquidity() on breach","Returns token0 + token1 to owner","Pause / cancel / resume controls"],
              },
              {
                chain: "REACTIVE LASNA", badge: "REACTIVE CHAIN", color: "#00F5FF",
                contract: "UniswapV2ILProtectionReactive",
                points: ["Subscribes to Uniswap V2 Sync events","Computes divergence on every swap","Fires Callback when threshold breached","Dynamic pair subscribe / unsubscribe","5-minute cooldown between triggers"],
              },
            ].map(({ chain, badge, color, contract, points }) => (
              <div key={chain} className="bg-[#0a0a0a] p-8">
                <div className="text-[10px] tracking-widest mb-1 badge" style={{ color, borderColor: color }}>
                  {badge}
                </div>
                <div className="text-xl font-bold text-[#e8e8e8] mt-4 mb-1">{chain}</div>
                <div className="text-[11px] font-mono mb-5" style={{ color }}>{contract}</div>
                <ul className="space-y-2">
                  {points.map(p => (
                    <li key={p} className="flex gap-3 text-xs text-[#666]">
                      <span style={{ color }}>›</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="py-28 px-4 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#39FF14 1px, transparent 1px), linear-gradient(90deg, #39FF14 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="text-[10px] tracking-[0.4em] text-[#39FF14] mb-4">READY TO PROTECT YOUR POSITION?</div>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#e8e8e8] mb-4 leading-tight">
            SET YOUR THRESHOLD.<br />
            <span className="text-[#39FF14]" style={{ textShadow: "0 0 30px rgba(57,255,20,0.35)" }}>
              WALK AWAY.
            </span>
          </h2>
          <p className="text-[#555] text-sm mb-10 leading-relaxed">
            SENTINEL watches the pool so you don't have to. Fully on-chain, fully reactive, fully your contract.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isConnected ? (
              <Link href="/protect" className="btn-sentinel px-10 py-3 text-sm">
                DEPLOY &amp; PROTECT →
              </Link>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button onClick={openConnectModal} className="btn-sentinel px-10 py-3 text-sm">
                    CONNECT WALLET →
                  </button>
                )}
              </ConnectButton.Custom>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t-2 border-[#1a1a1a] py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-[#444]">
          <div className="flex items-center gap-2">
            <span className="text-[#39FF14]">◈</span>
            <span className="tracking-widest">SENTINEL v1.0.0</span>
          </div>
          <div className="tracking-widest">SEPOLIA × REACTIVE LASNA — TESTNET ONLY</div>
          <div className="tracking-widest">
            BUILT ON{" "}
            <a href="https://reactive.network" target="_blank" rel="noopener noreferrer" className="text-[#39FF14] hover:underline">
              REACTIVE NETWORK
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}