/**
 * SENTINEL API — /api/positions/sync
 *
 * POST body: { callbackAddress, wallet, chainId?, deployBlock? }
 *
 * Scans on-chain events from (last synced block) → latest:
 *   • PositionRegistered  → upsert into positions table
 *   • PositionExited      → upsert into exit_events, update position status
 *   • PositionCancelled   → update position status
 *   • PositionPaused      → update position status
 *   • PositionResumed     → update position status
 *
 * Saves last synced block in sync_log so subsequent calls are incremental.
 */

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createAdminClient } from "@/lib/supabase";
import { CALLBACK_ABI } from "@/config/abis";
import { DESTINATION_CHAINS } from "@/config/chains.config";

const MAX_BLOCK_RANGE = 10; // Alchemy free tier hard limit

function normalise(addr: string) {
  return addr.toLowerCase();
}

// ── Token symbol cache (per process) ──────────────────────────────────────
const symbolCache: Record<string, string> = {};
async function getSymbol(addr: string, provider: ethers.JsonRpcProvider) {
  if (symbolCache[addr]) return symbolCache[addr];
  try {
    const c = new ethers.Contract(addr, ["function symbol() view returns (string)"], provider);
    const s = await c.symbol();
    symbolCache[addr] = s;
    return s;
  } catch {
    return addr.slice(0, 6);
  }
}

// ── POST ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: {
    callbackAddress: string;
    wallet: string;
    chainId?: number;
    deployBlock?: number;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { callbackAddress, wallet, chainId = 11155111, deployBlock = 0 } = body;

  if (!ethers.isAddress(callbackAddress))
    return NextResponse.json({ error: "Invalid callbackAddress" }, { status: 400 });
  if (!ethers.isAddress(wallet))
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });

  // ── Find chain config ──────────────────────────────────────────────────
  const chainCfg = DESTINATION_CHAINS[chainId];
  if (!chainCfg)
    return NextResponse.json({ error: `Unknown chainId ${chainId}` }, { status: 400 });

  // Use env var if set, otherwise fall back to chainCfg rpcUrl
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC
    ?? process.env.SEPOLIA_RPC
    ?? chainCfg.rpcUrl;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const iface    = new ethers.Interface(CALLBACK_ABI);
  const db       = createAdminClient();

  // ── Get last synced block ──────────────────────────────────────────────
  const cbNorm = normalise(callbackAddress);
  let fromBlock = deployBlock;

  const { data: syncData } = await db
    .from("sync_log")
    .select("last_synced_block")
    .ilike("callback_address", cbNorm)
    .single();

  if (syncData && syncData.last_synced_block > fromBlock) {
    fromBlock = syncData.last_synced_block + 1;
  }

  const latestBlock = await provider.getBlockNumber();
  if (fromBlock > latestBlock) {
    return NextResponse.json({ synced: 0, upToBlock: latestBlock });
  }

  // On first sync (no prior sync_log entry), don't scan from genesis —
  // scan from deployBlock or last 1000 blocks, whichever is more recent.
  // This avoids scanning thousands of blocks on first run.
  const smartFrom = syncData
    ? fromBlock                                          // incremental — use last synced
    : Math.max(fromBlock, latestBlock - 1000);          // first run — last 1000 blocks max

  // ── Fetch events in chunks ─────────────────────────────────────────────
  const topics = {
    PositionRegistered: iface.getEvent("PositionRegistered")!.topicHash,
    PositionExited:     iface.getEvent("PositionExited")!.topicHash,
    PositionCancelled:  iface.getEvent("PositionCancelled")!.topicHash,
    PositionPaused:     iface.getEvent("PositionPaused")!.topicHash,
    PositionResumed:    iface.getEvent("PositionResumed")!.topicHash,
  };

  const allTopics = Object.values(topics);
  const allLogs: ethers.Log[] = [];

  for (let start = smartFrom; start <= latestBlock; start += MAX_BLOCK_RANGE) {
    const end = Math.min(start + MAX_BLOCK_RANGE - 1, latestBlock);
    const logs = await provider.getLogs({
      address: callbackAddress,
      topics:  [allTopics],
      fromBlock: start,
      toBlock:   end,
    });
    allLogs.push(...logs);
  }

  // ── Process events ─────────────────────────────────────────────────────
  let synced = 0;

  // Sort ascending so status updates are applied in order
  allLogs.sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);

  for (const log of allLogs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (!parsed) continue;

      // ── PositionRegistered ─────────────────────────────────────────────
      if (parsed.name === "PositionRegistered") {
        const {
          pair, positionId, token0, token1,
          lpAmount, entryReserve0, entryReserve1, divergenceThresholdBps
        } = parsed.args;

        const [sym0, sym1] = await Promise.all([
          getSymbol(token0, provider),
          getSymbol(token1, provider),
        ]);

        // Get block timestamp
        let registeredAt: string | null = null;
        try {
          const blk = await provider.getBlock(log.blockNumber);
          if (blk) registeredAt = new Date(blk.timestamp * 1000).toISOString();
        } catch {}

        await db.from("positions").upsert({
          position_id:              Number(positionId),
          callback_address:         cbNorm,
          wallet_address:           normalise(wallet),
          chain_id:                 chainId,
          pair:                     normalise(pair),
          token0:                   normalise(token0),
          token1:                   normalise(token1),
          pair_symbol:              `${sym0}/${sym1}`,
          lp_amount:                lpAmount.toString(),
          entry_reserve0:           entryReserve0.toString(),
          entry_reserve1:           entryReserve1.toString(),
          divergence_threshold_bps: Number(divergenceThresholdBps),
          status:                   "Active",
          registered_tx_hash:       log.transactionHash,
          registered_block:         log.blockNumber,
          registered_at:            registeredAt,
        }, { onConflict: "callback_address,position_id" });

        synced++;
      }

      // ── PositionExited ─────────────────────────────────────────────────
      else if (parsed.name === "PositionExited") {
        const { pair, positionId, lpAmountBurned, amount0Received, amount1Received } = parsed.args;

        let blockTs: string | null = null;
        try {
          const blk = await provider.getBlock(log.blockNumber);
          if (blk) blockTs = new Date(blk.timestamp * 1000).toISOString();
        } catch {}

        await db.from("exit_events").upsert({
          position_id:      Number(positionId),
          callback_address: cbNorm,
          wallet_address:   normalise(wallet),
          chain_id:         chainId,
          pair:             normalise(pair),
          lp_amount_burned: lpAmountBurned.toString(),
          amount0_received: amount0Received.toString(),
          amount1_received: amount1Received.toString(),
          tx_hash:          log.transactionHash,
          block_number:     log.blockNumber,
          block_timestamp:  blockTs,
        }, { onConflict: "tx_hash,position_id" });

        // Update position status
        await db.from("positions")
          .update({
            status:         "Exited",
            exited_tx_hash: log.transactionHash,
            exited_block:   log.blockNumber,
            exited_at:      blockTs,
          })
          .eq("callback_address", cbNorm)
          .eq("position_id", Number(positionId));

        synced++;
      }

      // ── Status-only events ────────────────────────────────────────────
      else if (parsed.name === "PositionCancelled") {
        await db.from("positions")
          .update({ status: "Cancelled" })
          .eq("callback_address", cbNorm)
          .eq("position_id", Number(parsed.args.positionId));
        synced++;
      }
      else if (parsed.name === "PositionPaused") {
        await db.from("positions")
          .update({ status: "Paused" })
          .eq("callback_address", cbNorm)
          .eq("position_id", Number(parsed.args.positionId));
        synced++;
      }
      else if (parsed.name === "PositionResumed") {
        await db.from("positions")
          .update({ status: "Active" })
          .eq("callback_address", cbNorm)
          .eq("position_id", Number(parsed.args.positionId));
        synced++;
      }
    } catch (e) {
      console.error("[sync] Failed to parse log", log.transactionHash, e);
    }
  }

  // ── Update sync_log ────────────────────────────────────────────────────
  await db.from("sync_log").upsert({
    callback_address:  cbNorm,
    chain_id:          chainId,
    last_synced_block: latestBlock,
    last_synced_at:    new Date().toISOString(),
  }, { onConflict: "callback_address" });

  return NextResponse.json({ synced, fromBlock, upToBlock: latestBlock, totalLogs: allLogs.length });
}