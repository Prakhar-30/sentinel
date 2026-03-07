/**
 * SENTINEL — Uniswap V2 Pair Info Hook
 *
 * Given a pair address, resolves token symbols, decimals,
 * current reserves, and the user's LP token balance.
 */

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { UNISWAP_V2_PAIR_ABI, ERC20_ABI } from "@/config/abis";
import { getDestinationChain } from "@/config/chains.config";

export interface PairInfo {
  pairAddress: string;
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  reserve0: bigint;
  reserve1: bigint;
  userLpBalance: bigint;
  totalSupply: bigint;
  ratio: number; // reserve0/reserve1 as float
}

export function usePairInfo(
  pairAddress?: string,
  userAddress?: string,
  chainId = 11155111,
) {
  const [info, setInfo]       = useState<PairInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!pairAddress || !ethers.isAddress(pairAddress)) {
      setInfo(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const chain    = getDestinationChain(chainId);
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        const pair     = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);

        const [token0Addr, token1Addr, reserves, totalSupply] = await Promise.all([
          pair.token0(),
          pair.token1(),
          pair.getReserves(),
          pair.totalSupply(),
        ]);

        const t0 = new ethers.Contract(token0Addr, ERC20_ABI, provider);
        const t1 = new ethers.Contract(token1Addr, ERC20_ABI, provider);

        const [sym0, sym1, dec0, dec1] = await Promise.all([
          t0.symbol().catch(() => "TK0"),
          t1.symbol().catch(() => "TK1"),
          t0.decimals().catch(() => 18),
          t1.decimals().catch(() => 18),
        ]);

        let userLpBalance = 0n;
        if (userAddress && ethers.isAddress(userAddress)) {
          userLpBalance = await pair.balanceOf(userAddress).catch(() => 0n);
        }

        const r0 = BigInt(reserves.reserve0);
        const r1 = BigInt(reserves.reserve1);

        const ratio =
          r1 > 0n
            ? Number(r0 * 10000n / r1) / 10000
            : 0;

        if (!cancelled) {
          setInfo({
            pairAddress,
            token0:        token0Addr,
            token1:        token1Addr,
            symbol0:       sym0,
            symbol1:       sym1,
            decimals0:     Number(dec0),
            decimals1:     Number(dec1),
            reserve0:      r0,
            reserve1:      r1,
            userLpBalance: BigInt(userLpBalance),
            totalSupply:   BigInt(totalSupply),
            ratio,
          });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load pair");
          setInfo(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pairAddress, userAddress, chainId]);

  return { info, loading, error };
}