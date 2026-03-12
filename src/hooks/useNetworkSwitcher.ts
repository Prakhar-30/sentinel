import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import {
  DESTINATION_CHAINS,
  REACTIVE_CHAINS,
  DEFAULT_DESTINATION_CHAIN_ID,
  DEFAULT_REACTIVE_CHAIN_ID,
} from "@/config/chains.config";

export type NetworkStatus = "idle" | "switching" | "success" | "error";

export function useNetworkSwitcher() {
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [status, setStatus] = useState<NetworkStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const destChain   = DESTINATION_CHAINS[currentChainId];
  const reactChain  = REACTIVE_CHAINS[currentChainId];
  const currentLabel = destChain?.label ?? reactChain?.label ?? "Unknown";

  /**
   * Switch to any chain by chainId + rpcUrl.
   * Falls back to wallet_addEthereumChain if chain isn't in the wallet yet.
   */
  const switchToChainId = useCallback(
    async (
      targetChainId: number,
      chainMeta: {
        name: string;
        rpcUrl: string;
        explorerUrl: string;
        nativeCurrency: string;
      }
    ): Promise<boolean> => {
      if (!isConnected) { setErrorMsg("Wallet not connected"); return false; }
      if (currentChainId === targetChainId) return true;

      setStatus("switching");
      setErrorMsg(null);

      try {
        await switchChainAsync({ chainId: targetChainId });
        setStatus("success");
        return true;
      } catch (err: unknown) {
        const code = (err as { code?: number }).code;
        // Chain not added to wallet yet
        if (code === 4902 || code === -32603) {
          try {
            await (window as Window & {
              ethereum?: { request: (a: unknown) => Promise<unknown> };
            }).ethereum?.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: `0x${targetChainId.toString(16)}`,
                chainName: chainMeta.name,
                rpcUrls: [chainMeta.rpcUrl],
                blockExplorerUrls: [chainMeta.explorerUrl],
                nativeCurrency: {
                  name: chainMeta.nativeCurrency,
                  symbol: chainMeta.nativeCurrency,
                  decimals: 18,
                },
              }],
            });
            await switchChainAsync({ chainId: targetChainId });
            setStatus("success");
            return true;
          } catch {
            setErrorMsg("Failed to add network to wallet");
            setStatus("error");
            return false;
          }
        }
        setErrorMsg("User rejected network switch");
        setStatus("error");
        return false;
      }
    },
    [isConnected, currentChainId, switchChainAsync]
  );

  // Convenience: switch to Sepolia
  const switchToSepolia = useCallback(() => {
    const c = DESTINATION_CHAINS[DEFAULT_DESTINATION_CHAIN_ID];
    return switchToChainId(c.chainId, {
      name: c.name,
      rpcUrl: c.rpcUrl,
      explorerUrl: c.explorerUrl,
      nativeCurrency: c.nativeCurrency,
    });
  }, [switchToChainId]);

  // Convenience: switch to Reactive Lasna
  const switchToLasna = useCallback(() => {
    const c = REACTIVE_CHAINS[DEFAULT_REACTIVE_CHAIN_ID];
    return switchToChainId(c.chainId, {
      name: c.name,
      rpcUrl: c.rpcUrl,
      explorerUrl: c.explorerUrl,
      nativeCurrency: c.nativeCurrency,
    });
  }, [switchToChainId]);

  /**
   * Polls until wallet confirms it's on targetChainId.
   * Use after switchToChainId to ensure state is settled before next step.
   */
  const waitForChain = useCallback(
    (targetChainId: number, timeoutMs = 20000): Promise<boolean> =>
      new Promise((resolve) => {
        const start = Date.now();
        const iv = setInterval(() => {
          // Read chainId fresh from window.ethereum
          const provider = (window as Window & {
            ethereum?: { request: (a: unknown) => Promise<unknown> };
          }).ethereum;
          provider
            ?.request({ method: "eth_chainId" })
            .then((hex: unknown) => {
              if (parseInt(hex as string, 16) === targetChainId) {
                clearInterval(iv);
                resolve(true);
              }
            })
            .catch(() => {});
          if (Date.now() - start > timeoutMs) {
            clearInterval(iv);
            resolve(false);
          }
        }, 400);
      }),
    []
  );

  // Reset status when chain actually changes
  useEffect(() => {
    if (status === "switching" || status === "success") setStatus("idle");
  }, [currentChainId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    currentChainId,
    currentLabel,
    switchToSepolia,
    switchToLasna,
    switchToChainId,
    waitForChain,
    status,
    errorMsg,
    isOnSepolia: currentChainId === DEFAULT_DESTINATION_CHAIN_ID,
    isOnLasna:   currentChainId === DEFAULT_REACTIVE_CHAIN_ID,
  };
}