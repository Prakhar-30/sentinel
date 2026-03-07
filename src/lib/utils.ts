import { ethers } from "ethers";

// ── Address formatting ────────────────────────────────────────────────────────

export const shortAddr = (addr: string) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

export const isAddr = (v: string) => {
  try { return ethers.isAddress(v); } catch { return false; }
};

// ── Number formatting ─────────────────────────────────────────────────────────

/** Format wei bigint to human-readable with given decimals */
export const formatUnits = (val: bigint, decimals = 18, displayDecimals = 4) =>
  parseFloat(ethers.formatUnits(val, decimals)).toFixed(displayDecimals);

/** Format basis points as percentage string: 2000 → "20.00%" */
export const bpsToPercent = (bps: bigint | number): string => {
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  return (n / 100).toFixed(2) + "%";
};

/** Clamp divergence BPS for display (cap at 10000) */
export const clampBps = (bps: bigint | number): number =>
  Math.min(typeof bps === "bigint" ? Number(bps) : bps, 10000);

/** Divergence → fill color */
export const divergenceColor = (bps: number, thresholdBps: number): string => {
  const pct = bps / thresholdBps;
  if (pct >= 1)   return "#FF2D2D";
  if (pct >= 0.8) return "#FFB800";
  return "#39FF14";
};

// ── Date formatting ───────────────────────────────────────────────────────────

export const formatTs = (unixSec: number): string => {
  if (!unixSec) return "—";
  return new Date(unixSec * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour:  "2-digit", minute: "2-digit",
  });
};

export const timeAgo = (unixSec: number): string => {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ── Explorer links ────────────────────────────────────────────────────────────

export const explorerTx   = (base: string, hash: string)  => `${base}/tx/${hash}`;
export const explorerAddr = (base: string, addr: string)  => `${base}/address/${addr}`;

// ── LP position calculations ──────────────────────────────────────────────────

/**
 * Compute impermanent loss % from price ratio change
 * p = current_price / entry_price
 * IL = 2*sqrt(p)/(1+p) - 1
 */
export const computeIL = (entryR0: bigint, entryR1: bigint, curR0: bigint, curR1: bigint): number => {
  if (entryR1 === 0n || curR1 === 0n) return 0;
  const p0 = Number(entryR0) / Number(entryR1);
  const p1 = Number(curR0)   / Number(curR1);
  if (p0 === 0) return 0;
  const p = p1 / p0;
  return (2 * Math.sqrt(p) / (1 + p) - 1) * 100; // as %
};

/** Share of pool this LP amount represents */
export const lpShare = (lpAmount: bigint, totalSupply: bigint): number => {
  if (totalSupply === 0n) return 0;
  return Number((lpAmount * 10000n) / totalSupply) / 100;
};