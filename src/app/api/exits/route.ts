/**
 * SENTINEL API — /api/exits
 *
 * GET ?wallet=0x...&chainId=11155111
 *     → returns all exit events (execution history) for the wallet
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { ethers } from "ethers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet   = searchParams.get("wallet");
  const chainId  = parseInt(searchParams.get("chainId") ?? "11155111");
  const callback = searchParams.get("callback");

  if (!wallet || !ethers.isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  const db = createAdminClient();

  let query = db
    .from("exit_events")
    .select("*")
    .ilike("wallet_address", wallet.toLowerCase())
    .eq("chain_id", chainId)
    .order("block_number", { ascending: false });

  if (callback) query = query.ilike("callback_address", callback.toLowerCase());

  const { data, error } = await query;

  if (error) {
    console.error("[/api/exits GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ exits: data ?? [] });
}