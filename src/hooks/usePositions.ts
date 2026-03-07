/**
 * SENTINEL — Position Data Hook
 *
 * Reads all LP positions from the callback contract on-chain.
 * Fetches live divergence for active positions.
 * Scans event logs for execution history (PositionExited events).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { CALLBACK_ABI } from "@/config/abis";
import { getDestinationChain } from "@/config/chains.config";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PositionStatus = "Active" | "Paused" | "Cancelled" | "Exited";

const STATUS_MAP: Record<number, PositionStatus> = {
  0: "Active",
  1: "Paused",
  2: "Cancelled",
  3: "Exited",
};

export interface LPPosition {
  id: number;
  pair: string;
  token0: string;
  token1: string;
  lpAmount: bigint;
  entryReserve0: bigint;
  entryReserve1: bigint;
  divergenceThresholdBps: bigint;
  status: PositionStatus;
  createdAt: number;
  exitedAt: number;
  // enriched fields
  currentDivergenceBps?: bigint;
  pairSymbol?: string;
}

export interface ExitEvent {
  positionId: number;
  pair: string;
  lpAmountBurned: bigint;
  amount0Received: bigint;
  amount1Received: bigint;
  txHash: string;
  blockNumber: number;
  timestamp?: number;
}

export interface UsePositionsResult {
  positions: LPPosition[];
  exitHistory: ExitEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePositions(
  callbackAddress?: string,
  deployBlock = 0,
  chainId = 11155111,
): UsePositionsResult {
  const [positions, setPositions]     = useState<LPPosition[]>([]);
  const [exitHistory, setExitHistory] = useState<ExitEvent[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const refreshTokenRef               = useRef(0);

  const fetch = useCallback(async () => {
    if (!callbackAddress || !ethers.isAddress(callbackAddress)) return;

    setLoading(true);
    setError(null);
    const token = ++refreshTokenRef.current;

    try {
      const chain    = getDestinationChain(chainId);
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
      const contract = new ethers.Contract(callbackAddress, CALLBACK_ABI, provider);

      // ── 1. Fetch all position IDs ────────────────────────────────────────
      const ids: bigint[] = await contract.getAllPositions();

      // ── 2. Fetch each position struct ────────────────────────────────────
      const rawPositions = await Promise.all(
        ids.map(id => contract.positions(id))
      );

      // ── 3. Fetch current divergence for Active positions ─────────────────
      const positionsWithDivergence = await Promise.all(
        rawPositions.map(async (p, i) => {
          const status = STATUS_MAP[Number(p.status)] ?? "Cancelled";
          let currentDivergenceBps: bigint | undefined;

          if (status === "Active") {
            try {
              currentDivergenceBps = await contract.getCurrentDivergenceBps(ids[i]);
            } catch {
              currentDivergenceBps = undefined;
            }
          }

          // ── Resolve pair symbol (best-effort) ──────────────────────────
          let pairSymbol = "UNI-V2";
          try {
            const pairContract = new ethers.Contract(p.pair, [
              "function token0() view returns (address)",
              "function token1() view returns (address)",
            ], provider);
            const [t0Addr, t1Addr] = await Promise.all([
              pairContract.token0(),
              pairContract.token1(),
            ]);
            const erc20ABI = ["function symbol() view returns (string)"];
            const [sym0, sym1] = await Promise.all([
              new ethers.Contract(t0Addr, erc20ABI, provider).symbol().catch(() => "TK0"),
              new ethers.Contract(t1Addr, erc20ABI, provider).symbol().catch(() => "TK1"),
            ]);
            pairSymbol = `${sym0}/${sym1}`;
          } catch { /* use default */ }

          const pos: LPPosition = {
            id:                     Number(ids[i]),
            pair:                   p.pair,
            token0:                 p.token0,
            token1:                 p.token1,
            lpAmount:               BigInt(p.lpAmount),
            entryReserve0:          BigInt(p.entryReserve0),
            entryReserve1:          BigInt(p.entryReserve1),
            divergenceThresholdBps: BigInt(p.divergenceThresholdBps),
            status,
            createdAt:              Number(p.createdAt),
            exitedAt:               Number(p.exitedAt),
            currentDivergenceBps,
            pairSymbol,
          };
          return pos;
        })
      );

      // ── 4. Scan for PositionExited events from deploy block ──────────────
      const iface     = new ethers.Interface(CALLBACK_ABI);
      const exitTopic = iface.getEvent("PositionExited")!.topicHash;

      const latestBlock = await provider.getBlockNumber();
      const fromBlock   = deployBlock > 0
        ? deployBlock
        : Math.max(0, latestBlock - 10000);
      const batchSize   = chain.eventScanBatchSize; // 2000 per batch

      const exits: ExitEvent[] = [];

      // Scan in batches to stay within Alchemy's getLogs limits
      for (let from = fromBlock; from <= latestBlock; from += batchSize) {
        const to = Math.min(from + batchSize - 1, latestBlock);
        try {
          const logs = await provider.getLogs({
            address:   callbackAddress,
            topics:    [exitTopic],
            fromBlock: from,
            toBlock:   to,
          });

          for (const log of logs) {
            try {
              const parsed = iface.parseLog(log);
              if (!parsed) continue;
              exits.push({
                positionId:      Number(parsed.args.positionId),
                pair:            parsed.args.pair,
                lpAmountBurned:  BigInt(parsed.args.lpAmountBurned),
                amount0Received: BigInt(parsed.args.amount0Received),
                amount1Received: BigInt(parsed.args.amount1Received),
                txHash:          log.transactionHash,
                blockNumber:     log.blockNumber,
              });
            } catch { /* skip malformed logs */ }
          }
        } catch (batchErr) {
          // If a batch fails, skip it and continue — don't abort entire scan
          console.warn(`Log scan batch ${from}-${to} failed:`, batchErr);
        }
      }

      // ── 5. Enrich exit events with block timestamps ──────────────────────
      const enriched = await Promise.all(
        exits.map(async e => {
          try {
            const block = await provider.getBlock(e.blockNumber);
            return { ...e, timestamp: block?.timestamp };
          } catch {
            return e;
          }
        })
      );

      if (token !== refreshTokenRef.current) return; // stale

      setPositions(positionsWithDivergence.sort((a, b) => b.id - a.id));
      setExitHistory(enriched.sort((a, b) => b.blockNumber - a.blockNumber));

    } catch (e: unknown) {
      if (token !== refreshTokenRef.current) return;
      const msg = e instanceof Error ? e.message : "Failed to load positions";
      setError(msg);
    } finally {
      if (token === refreshTokenRef.current) setLoading(false);
    }
  }, [callbackAddress, deployBlock, chainId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Auto-refresh active positions every 30s
  useEffect(() => {
    const hasActive = positions.some(p => p.status === "Active");
    if (!hasActive) return;
    const t = setInterval(fetch, 30_000);
    return () => clearInterval(t);
  }, [positions, fetch]);

  return { positions, exitHistory, loading, error, refresh: fetch };
}