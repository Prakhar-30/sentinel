/**
 * SENTINEL — useContractStore
 *
 * Persists deployed contract addresses for a wallet.
 * Source of truth priority: localStorage (instant) → Supabase DB (cross-device)
 *
 * On first load: checks DB for saved contracts so users don't lose their
 * addresses when switching devices or clearing local storage.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

export interface ContractAddresses {
  callbackAddress:      string;
  reactiveAddress:      string;
  callbackDeployBlock:  number;
}

const LS_KEY = (wallet: string, chainId: number) =>
  `sentinel_contracts_${wallet.toLowerCase()}_${chainId}`;

// ── Save to DB (fire-and-forget) ──────────────────────────────────────────
async function saveToDb(
  wallet: string,
  chainId: number,
  addresses: ContractAddresses,
) {
  try {
    await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        chainId,
        callbackAddress:     addresses.callbackAddress,
        reactiveAddress:     addresses.reactiveAddress,
        callbackDeployBlock: addresses.callbackDeployBlock,
      }),
    });
  } catch (e) {
    console.warn("[useContractStore] DB save failed (non-fatal):", e);
  }
}

// ── Load from DB ──────────────────────────────────────────────────────────
async function loadFromDb(
  wallet: string,
  chainId: number,
): Promise<ContractAddresses | null> {
  try {
    const res = await fetch(`/api/contracts?wallet=${wallet}&chainId=${chainId}`);
    if (!res.ok) return null;
    const { contracts } = await res.json();
    if (!contracts?.length) return null;
    const c = contracts[0];
    return {
      callbackAddress:     c.callback_address,
      reactiveAddress:     c.reactive_address ?? "",
      callbackDeployBlock: c.callback_deploy_block ?? 0,
    };
  } catch {
    return null;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useContractStore(
  wallet?: string,
  chainId = 11155111,
) {
  const [addresses, setAddresses] = useState<ContractAddresses | null>(null);
  const [loaded,    setLoaded]    = useState(false);

  // ── Initial load: localStorage first, then DB ──────────────────────────
  useEffect(() => {
    if (!wallet) { setLoaded(true); return; }

    const key = LS_KEY(wallet, chainId);
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;

    if (raw) {
      try {
        setAddresses(JSON.parse(raw));
        setLoaded(true);
        // Also try to hydrate from DB in background (in case user has newer data)
        loadFromDb(wallet, chainId).then(dbData => {
          if (dbData) {
            setAddresses(dbData);
            localStorage.setItem(key, JSON.stringify(dbData));
          }
        });
        return;
      } catch {}
    }

    // No local data — try DB
    loadFromDb(wallet, chainId).then(dbData => {
      if (dbData) {
        setAddresses(dbData);
        localStorage.setItem(key, JSON.stringify(dbData));
      }
      setLoaded(true);
    });
  }, [wallet, chainId]);

  // ── Save ───────────────────────────────────────────────────────────────
  const save = useCallback(
    (addr: ContractAddresses) => {
      setAddresses(addr);
      if (!wallet) return;
      const key = LS_KEY(wallet, chainId);
      localStorage.setItem(key, JSON.stringify(addr));
      saveToDb(wallet, chainId, addr);
    },
    [wallet, chainId],
  );

  // ── Clear ──────────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    setAddresses(null);
    if (!wallet) return;
    localStorage.removeItem(LS_KEY(wallet, chainId));
  }, [wallet, chainId]);

  // ── setManual — convenience wrapper used by ManualConnectPanel ─────────
  const setManual = useCallback(
    (
      callbackAddress: string,
      reactiveAddress: string,
      _chainId: number,
      deployBlock = 0,
    ) => {
      save({
        callbackAddress,
        reactiveAddress,
        callbackDeployBlock: deployBlock,
      });
    },
    [save],
  );

  return { addresses, loaded, save, clear, setManual };
}