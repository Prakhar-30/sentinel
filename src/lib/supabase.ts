/**
 * SENTINEL — Supabase client helpers
 *
 * browser  → uses anon key (safe for client)
 * server   → uses service_role key (API routes only — never send to client)
 */

import { createClient } from "@supabase/supabase-js";

const url            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// ── Browser client — uses publishable key (safe to expose) ────────────────
export const supabase = createClient(url, publishableKey);

// ── Server-side admin client — uses secret key (API routes only) ──────────
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(url, secretKey, {
    auth: { persistSession: false },
  });
}

// ── Type helpers ───────────────────────────────────────────────────────────
export type DbContract = {
  id: number;
  wallet_address: string;
  chain_id: number;
  callback_address: string;
  reactive_address: string | null;
  callback_deploy_block: number;
  created_at: string;
  updated_at: string;
};

export type DbPosition = {
  id: number;
  position_id: number;
  callback_address: string;
  wallet_address: string;
  chain_id: number;
  pair: string;
  token0: string;
  token1: string;
  pair_symbol: string | null;
  lp_amount: string;
  entry_reserve0: string;
  entry_reserve1: string;
  divergence_threshold_bps: number;
  status: "Active" | "Paused" | "Cancelled" | "Exited";
  registered_tx_hash: string | null;
  registered_block: number | null;
  registered_at: string | null;
  exited_tx_hash: string | null;
  exited_block: number | null;
  exited_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbExitEvent = {
  id: number;
  position_id: number;
  callback_address: string;
  wallet_address: string;
  chain_id: number;
  pair: string;
  lp_amount_burned: string;
  amount0_received: string;
  amount1_received: string;
  tx_hash: string;
  block_number: number;
  block_timestamp: string | null;
  created_at: string;
};