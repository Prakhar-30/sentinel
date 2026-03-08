/**
 * SENTINEL API — /api/contracts
 *
 * GET  ?wallet=0x...&chainId=11155111   → fetch saved contracts for a wallet
 * POST body: { wallet, chainId, callbackAddress, reactiveAddress, callbackDeployBlock }
 *            → upsert contract record
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { ethers } from "ethers";

function normalise(addr: string) {
  return addr.toLowerCase();
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet  = searchParams.get("wallet");
  const chainId = parseInt(searchParams.get("chainId") ?? "11155111");

  if (!wallet || !ethers.isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("contracts")
    .select("*")
    .ilike("wallet_address", normalise(wallet))
    .eq("chain_id", chainId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[/api/contracts GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contracts: data ?? [] });
}

// ── POST ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: {
    wallet: string;
    chainId?: number;
    callbackAddress: string;
    reactiveAddress?: string;
    callbackDeployBlock?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    wallet,
    chainId = 11155111,
    callbackAddress,
    reactiveAddress,
    callbackDeployBlock = 0,
  } = body;

  if (!wallet || !ethers.isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  if (!callbackAddress || !ethers.isAddress(callbackAddress)) {
    return NextResponse.json({ error: "Invalid callbackAddress" }, { status: 400 });
  }

  const db = createAdminClient();

  const record = {
    wallet_address:        normalise(wallet),
    chain_id:              chainId,
    callback_address:      normalise(callbackAddress),
    reactive_address:      reactiveAddress ? normalise(reactiveAddress) : null,
    callback_deploy_block: callbackDeployBlock,
  };

  const { data, error } = await db
    .from("contracts")
    .upsert(record, {
      onConflict: "wallet_address,chain_id,callback_address",
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    console.error("[/api/contracts POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contract: data }, { status: 201 });
}