"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ethers } from "ethers";
import { useContractStore } from "@/hooks/useContractStore";
import { usePositions, LPPosition, ExitEvent } from "@/hooks/usePositions";
import { CALLBACK_ABI } from "@/config/abis";
import { getDestinationChain } from "@/config/chains.config";
import {
  shortAddr, formatUnits, bpsToPercent, divergenceColor,
  clampBps, formatTs, timeAgo, explorerAddr, explorerTx, computeIL,
} from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] tracking-[0.35em] text-[#39FF14] uppercase mb-1">{children}</div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="data-row text-xs">
      <span className="data-label">{label}</span>
      <span className="text-[#e8e8e8]">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: LPPosition["status"] }) {
  const cls = {
    Active:    "badge-active",
    Paused:    "badge-paused",
    Cancelled: "badge-cancelled",
    Exited:    "badge-exited",
  }[status];
  const dot = status === "Active"
    ? <span className="pulse-dot" />
    : <span className="inline-block w-2 h-2 rounded-full bg-current opacity-50" />;
  return <span className={`badge ${cls}`}>{dot}{status}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Position Card
// ─────────────────────────────────────────────────────────────────────────────

function PositionCard({
  pos,
  callbackAddress,
  chainId,
  onAction,
}: {
  pos: LPPosition;
  callbackAddress: string;
  chainId: number;
  onAction: () => void;
}) {
  const chain    = getDestinationChain(chainId);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");

  const divBps      = Number(pos.currentDivergenceBps ?? 0n);
  const threshBps   = Number(pos.divergenceThresholdBps);
  const fillPct     = Math.min((divBps / threshBps) * 100, 100);
  const fillColor   = divergenceColor(divBps, threshBps);
  const ilPct       = computeIL(pos.entryReserve0, pos.entryReserve1, pos.entryReserve0, pos.entryReserve1);

  const panelClass =
    pos.status === "Active"    ? "panel panel-active" :
    pos.status === "Paused"    ? "panel panel-warn"   :
    pos.status === "Exited"    ? "panel"               :
                                 "panel";

  const callAction = async (fn: string) => {
    setBusy(true); setErr("");
    try {
      const ethereum = (window as Window & { ethereum?: ethers.Eip1193Provider }).ethereum;
      if (!ethereum) throw new Error("No wallet detected.");
      const provider = new ethers.BrowserProvider(ethereum, "any");
      const signer   = await provider.getSigner();
      const cb       = new ethers.Contract(callbackAddress, CALLBACK_ABI, signer);
      const tx       = await cb[fn](pos.id);
      await tx.wait(1);
      onAction();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message.slice(0, 100) : "Transaction failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${panelClass} p-5 relative corner-accent`}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] text-[#555] tracking-widest mb-1">POSITION #{pos.id}</div>
          <div className="text-sm font-bold text-[#e8e8e8]">{pos.pairSymbol ?? "UNI-V2"}</div>
          <div className="text-[10px] text-[#444] mt-0.5 font-mono">
            <a href={explorerAddr(chain.explorerUrl, pos.pair)} target="_blank" rel="noopener noreferrer" className="hover:text-[#39FF14]">
              {shortAddr(pos.pair)}
            </a>
          </div>
        </div>
        <StatusBadge status={pos.status} />
      </div>

      {/* Divergence bar — only for active positions */}
      {pos.status === "Active" && pos.currentDivergenceBps !== undefined && (
        <div className="mb-4">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-[#555]">DIVERGENCE</span>
            <span style={{ color: fillColor }}>{bpsToPercent(divBps)} / {bpsToPercent(threshBps)}</span>
          </div>
          <div className="divergence-bar">
            <div className="divergence-fill" style={{ width: `${fillPct}%`, background: fillColor }} />
            <div className="absolute top-0 bottom-0 w-px bg-[#FFB800] opacity-60" style={{ left: "100%" }} />
          </div>
          {divBps >= threshBps && (
            <div className="text-[10px] text-[#FF2D2D] mt-1 animate-pulse tracking-widest">
              ⚠ THRESHOLD BREACHED — EXIT PENDING
            </div>
          )}
        </div>
      )}

      {/* Data rows */}
      <div className="space-y-0 mb-4">
        <DataRow label="LP AMOUNT"   value={`${formatUnits(pos.lpAmount, 18, 6)} LP`} />
        <DataRow label="ENTRY R0/R1" value={
          pos.entryReserve1 > 0n
            ? (Number(pos.entryReserve0) / Number(pos.entryReserve1)).toFixed(6)
            : "—"
        } />
        <DataRow label="THRESHOLD"   value={bpsToPercent(pos.divergenceThresholdBps)} />
        <DataRow label="REGISTERED"  value={formatTs(pos.createdAt)} />
        {pos.exitedAt > 0 && (
          <DataRow label="EXITED AT" value={formatTs(pos.exitedAt)} />
        )}
      </div>

      {/* Error */}
      {err && <div className="text-[11px] text-[#FF2D2D] mb-2">{err}</div>}

      {/* Action buttons */}
      {pos.status === "Active" && (
        <div className="flex gap-2">
          <button className="btn-sentinel btn-sentinel-ghost text-[10px] px-3 py-1.5 flex-1" onClick={() => callAction("pausePosition")} disabled={busy}>
            PAUSE
          </button>
          <button className="btn-sentinel btn-sentinel-danger text-[10px] px-3 py-1.5 flex-1" onClick={() => callAction("cancelPosition")} disabled={busy}>
            CANCEL
          </button>
        </div>
      )}

      {pos.status === "Paused" && (
        <div className="flex gap-2">
          <button className="btn-sentinel text-[10px] px-3 py-1.5 flex-1" onClick={() => callAction("resumePosition")} disabled={busy}>
            RESUME
          </button>
          <button className="btn-sentinel btn-sentinel-danger text-[10px] px-3 py-1.5 flex-1" onClick={() => callAction("cancelPosition")} disabled={busy}>
            CANCEL
          </button>
        </div>
      )}

      {busy && (
        <div className="text-[10px] text-[#FFB800] animate-pulse tracking-widest mt-2">⟳ PROCESSING...</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit History Row
// ─────────────────────────────────────────────────────────────────────────────

function ExitRow({ ev, explorerBase }: { ev: ExitEvent; explorerBase: string }) {
  return (
    <div className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-[#111] text-xs hover:bg-[#0f0f0f] transition-colors">
      <div className="text-[#555]">#{ev.positionId}</div>
      <div className="text-[#e8e8e8] font-mono text-[10px]">
        <a href={explorerAddr(explorerBase, ev.pair)} target="_blank" rel="noopener noreferrer" className="hover:text-[#39FF14]">
          {shortAddr(ev.pair)}
        </a>
      </div>
      <div className="text-[#e8e8e8]">{formatUnits(ev.lpAmountBurned, 18, 4)} LP</div>
      <div className="text-[#39FF14] text-[10px]">
        {formatUnits(ev.amount0Received, 18, 4)} / {formatUnits(ev.amount1Received, 18, 4)}
      </div>
      <div className="text-[#555] text-[10px]">
        {ev.timestamp ? timeAgo(ev.timestamp) : `blk ${ev.blockNumber}`}
        <a href={explorerTx(explorerBase, ev.txHash)} target="_blank" rel="noopener noreferrer" className="ml-2 text-[#39FF14] hover:underline">
          ↗
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Bar
// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ positions, exits }: { positions: LPPosition[]; exits: ExitEvent[] }) {
  const active    = positions.filter(p => p.status === "Active").length;
  const paused    = positions.filter(p => p.status === "Paused").length;
  const exited    = positions.filter(p => p.status === "Exited").length;
  const cancelled = positions.filter(p => p.status === "Cancelled").length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#1a1a1a] mb-8 border border-[#1a1a1a]">
      {[
        { label: "ACTIVE",    value: active,    color: "#39FF14" },
        { label: "PAUSED",    value: paused,    color: "#FFB800" },
        { label: "EXITED",    value: exited,    color: "#666"    },
        { label: "CANCELLED", value: cancelled, color: "#FF2D2D" },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-[#0a0a0a] px-5 py-4 text-center">
          <div className="text-2xl font-bold mb-1" style={{ color }}>{value}</div>
          <div className="text-[10px] text-[#444] tracking-widest">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

type FilterTab = "all" | "active" | "paused" | "exited" | "cancelled";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const chain   = getDestinationChain(chainId);
  const { addresses, loaded } = useContractStore(address);
  const [filter, setFilter] = useState<FilterTab>("all");

  const { positions, exitHistory, loading, error, refresh } = usePositions(
    addresses?.callbackAddress,
    addresses?.callbackDeployBlock,
    chainId,
  );

  const filtered = filter === "all"
    ? positions
    : positions.filter(p => p.status.toLowerCase() === filter);

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center px-4">
        <div className="panel p-10 text-center max-w-sm w-full corner-accent">
          <div className="text-[#39FF14] text-3xl mb-4">◎</div>
          <div className="text-sm font-bold tracking-widest mb-2">WALLET REQUIRED</div>
          <div className="text-xs text-[#555] mb-6 leading-relaxed">
            Connect your wallet to view your SENTINEL dashboard.
          </div>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (loaded && !addresses) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center px-4">
        <div className="panel p-10 text-center max-w-md w-full corner-accent">
          <div className="text-[#39FF14] text-3xl mb-4">◈</div>
          <div className="text-sm font-bold tracking-widest mb-2">NO CONTRACTS FOUND</div>
          <div className="text-xs text-[#555] mb-6 leading-relaxed">
            Deploy your SENTINEL contracts first to start monitoring positions.
          </div>
          <Link href="/protect" className="btn-sentinel text-xs px-6 py-3">
            GO TO PROTECT →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-14 pb-20">

      {/* ── Page header ── */}
      <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[10px] tracking-[0.35em] text-[#39FF14] mb-2">MISSION CONTROL</div>
            <h1 className="text-3xl font-bold text-[#e8e8e8] mb-1">DASHBOARD</h1>
            <p className="text-[#555] text-sm">
              Live position monitor — auto-refreshes every 30s for active positions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {addresses && (
              <div className="text-[10px] text-[#444] font-mono hidden sm:block">
                CB: <span className="text-[#666]">{shortAddr(addresses.callbackAddress)}</span>
              </div>
            )}
            <button
              className="btn-sentinel btn-sentinel-ghost text-[10px] px-4 py-2"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? "⟳ LOADING..." : "↺ REFRESH"}
            </button>
            <Link href="/protect" className="btn-sentinel text-[10px] px-4 py-2">
              + NEW POSITION
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Stats */}
        <StatsBar positions={positions} exits={exitHistory} />

        {/* Live indicator */}
        {positions.some(p => p.status === "Active") && (
          <div className="flex items-center gap-2 text-[11px] text-[#39FF14] mb-6 tracking-widest">
            <span className="pulse-dot" />
            SENTINEL ACTIVE — MONITORING {positions.filter(p => p.status === "Active").length} POSITION(S)
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="border border-[#FF2D2D] p-4 text-[11px] text-[#FF2D2D] mb-6">
            {error}
          </div>
        )}

        {/* ── POSITIONS ── */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>LP POSITIONS</SectionLabel>
            {/* Filter tabs */}
            <div className="flex gap-1">
              {(["all","active","paused","exited","cancelled"] as FilterTab[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[10px] px-3 py-1 tracking-widest transition-colors border
                    ${filter === f
                      ? "border-[#39FF14] text-[#39FF14]"
                      : "border-[#1a1a1a] text-[#444] hover:border-[#333] hover:text-[#666]"}`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {loading && positions.length === 0 ? (
            <div className="panel p-12 text-center text-[#444] text-xs tracking-widest animate-pulse">
              SCANNING CHAIN...
            </div>
          ) : filtered.length === 0 ? (
            <div className="panel p-12 text-center text-[#333] text-xs tracking-widest">
              {filter === "all"
                ? "NO POSITIONS FOUND — REGISTER ONE ON THE PROTECT PAGE"
                : `NO ${filter.toUpperCase()} POSITIONS`}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(pos => (
                <PositionCard
                  key={pos.id}
                  pos={pos}
                  callbackAddress={addresses!.callbackAddress}
                  chainId={chainId}
                  onAction={refresh}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── EXIT HISTORY ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>EXECUTION HISTORY</SectionLabel>
            <span className="text-[10px] text-[#444]">
              SCANNING FROM BLOCK {addresses?.callbackDeployBlock || "latest−10000"}
            </span>
          </div>

          {exitHistory.length === 0 ? (
            <div className="panel p-8 text-center text-[#333] text-xs tracking-widest">
              NO EXITS RECORDED YET
            </div>
          ) : (
            <div className="panel overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-5 gap-2 px-4 py-2 border-b border-[#1a1a1a] text-[10px] text-[#444] tracking-widest">
                <span>POS ID</span>
                <span>PAIR</span>
                <span>LP BURNED</span>
                <span>RECEIVED (T0/T1)</span>
                <span>WHEN</span>
              </div>
              {exitHistory.map((ev, i) => (
                <ExitRow key={i} ev={ev} explorerBase={chain.explorerUrl} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}