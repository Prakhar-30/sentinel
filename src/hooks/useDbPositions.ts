/**
 * SENTINEL — useDbPositions
 *
 * Fetches positions and exit history from the backend API (Supabase-backed).
 * Also triggers a sync so the DB is always up to date.
 *
 * Falls back to on-chain hook if the API fails.
 */

import { useState, useEffect, useCallback } from "react";
import { LPPosition, ExitEvent, UsePositionsResult } from "@/hooks/usePositions";
import { DbPosition, DbExitEvent } from "@/lib/supabase";

// ── Map DB row → LPPosition ────────────────────────────────────────────────
function mapDbPosition(row: DbPosition): LPPosition {
  return {
    id:                     row.position_id,
    pair:                   row.pair,
    token0:                 row.token0,
    token1:                 row.token1,
    pairSymbol:             row.pair_symbol ?? undefined,
    lpAmount:               BigInt(row.lp_amount),
    entryReserve0:          BigInt(row.entry_reserve0),
    entryReserve1:          BigInt(row.entry_reserve1),
    divergenceThresholdBps: BigInt(row.divergence_threshold_bps),
    status:                 row.status,
    createdAt:              row.registered_at ? Math.floor(new Date(row.registered_at).getTime() / 1000) : 0,
    exitedAt:               row.exited_at     ? Math.floor(new Date(row.exited_at).getTime() / 1000)     : 0,
  };
}

// ── Map DB row → ExitEvent ─────────────────────────────────────────────────
function mapDbExit(row: DbExitEvent): ExitEvent {
  return {
    positionId:      row.position_id,
    pair:            row.pair,
    lpAmountBurned:  BigInt(row.lp_amount_burned),
    amount0Received: BigInt(row.amount0_received),
    amount1Received: BigInt(row.amount1_received),
    txHash:          row.tx_hash,
    blockNumber:     row.block_number,
    timestamp:       row.block_timestamp
      ? Math.floor(new Date(row.block_timestamp).getTime() / 1000)
      : undefined,
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useDbPositions(
  callbackAddress?: string,
  deployBlock = 0,
  chainId = 11155111,
  walletAddress?: string,
): UsePositionsResult {
  const [positions,   setPositions]   = useState<LPPosition[]>([]);
  const [exitHistory, setExitHistory] = useState<ExitEvent[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!callbackAddress || !walletAddress) return;

    setLoading(true);
    setError(null);

    try {
      // ── 1. Trigger sync (fire-and-forget style — don't await fully) ──
      fetch("/api/positions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackAddress, wallet: walletAddress, chainId, deployBlock }),
      }).catch(console.error); // non-blocking

      // ── 2. Give sync a moment, then fetch from DB ──────────────────
      await new Promise(r => setTimeout(r, 1200));

      const [posRes, exitRes] = await Promise.all([
        fetch(`/api/positions?wallet=${walletAddress}&chainId=${chainId}&callback=${callbackAddress}`),
        fetch(`/api/exits?wallet=${walletAddress}&chainId=${chainId}&callback=${callbackAddress}`),
      ]);

      if (!posRes.ok || !exitRes.ok) {
        throw new Error("API error fetching positions");
      }

      const { positions: rawPos }  = await posRes.json();
      const { exits: rawExits }    = await exitRes.json();

      setPositions((rawPos  as DbPosition[]).map(mapDbPosition));
      setExitHistory((rawExits as DbExitEvent[]).map(mapDbExit));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load positions";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [callbackAddress, walletAddress, chainId, deployBlock]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh active positions every 30s
  useEffect(() => {
    const hasActive = positions.some(p => p.status === "Active");
    if (!hasActive) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [positions, load]);

  return { positions, exitHistory, loading, error, refresh: load };
}