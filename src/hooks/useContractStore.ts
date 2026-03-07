/**
 * SENTINEL — Contract Address Store
 *
 * Persists the user's deployed callback and reactive contract addresses
 * in localStorage, keyed by wallet address so each user has their own slot.
 * No database needed — everything lives in the browser tied to the wallet.
 */

import { useState, useEffect, useCallback } from "react";

export interface ContractAddresses {
  callbackAddress: string;
  reactiveAddress: string;
  deployedAt: number; // unix ms
  deployedOnChainId: number;
  /** The block the callback was deployed at — used as startBlock for event scans */
  callbackDeployBlock: number;
}

const STORE_KEY = (wallet: string) => `sentinel:contracts:${wallet.toLowerCase()}`;

export function useContractStore(walletAddress?: string) {
  const [addresses, setAddresses] = useState<ContractAddresses | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount / wallet change
  useEffect(() => {
    if (!walletAddress) { setAddresses(null); setLoaded(true); return; }
    try {
      const raw = localStorage.getItem(STORE_KEY(walletAddress));
      setAddresses(raw ? JSON.parse(raw) : null);
    } catch {
      setAddresses(null);
    }
    setLoaded(true);
  }, [walletAddress]);

  const save = useCallback((data: ContractAddresses) => {
    if (!walletAddress) return;
    localStorage.setItem(STORE_KEY(walletAddress), JSON.stringify(data));
    setAddresses(data);
  }, [walletAddress]);

  const clear = useCallback(() => {
    if (!walletAddress) return;
    localStorage.removeItem(STORE_KEY(walletAddress));
    setAddresses(null);
  }, [walletAddress]);

  /** Allow user to manually input existing contract addresses */
  const setManual = useCallback((
    callbackAddress: string,
    reactiveAddress: string,
    chainId: number,
    deployBlock = 0,
  ) => {
    const data: ContractAddresses = {
      callbackAddress,
      reactiveAddress,
      deployedAt: Date.now(),
      deployedOnChainId: chainId,
      callbackDeployBlock: deployBlock,
    };
    save(data);
  }, [save]);

  return { addresses, loaded, save, clear, setManual };
}