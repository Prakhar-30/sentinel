/**
 * SENTINEL API — /api/positions
 *
 * GET ?wallet=0x...&chainId=11155111&status=Active
 *     → returns all DB-stored positions for the wallet
 *
 * Optionally filter by status: Active | Paused | Cancelled | Exited
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { ethers } from "ethers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet   = searchParams.get("wallet");
  const chainId  = parseInt(searchParams.get("chainId") ?? "11155111");
  const status   = searchParams.get("status");   // optional filter
  const callback = searchParams.get("callback"); // optional filter by contract

  if (!wallet || !ethers.isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  const db = createAdminClient();

  let query = db
    .from("positions")
    .select("*")
    .ilike("wallet_address", wallet.toLowerCase())
    .eq("chain_id", chainId)
    .order("registered_block", { ascending: false });

  if (status) query = query.eq("status", status);
  if (callback) query = query.ilike("callback_address", callback.toLowerCase());

  const { data, error } = await query;

  if (error) {
    console.error("[/api/positions GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ positions: data ?? [] });
}