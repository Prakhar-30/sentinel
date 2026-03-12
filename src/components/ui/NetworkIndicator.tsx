"use client";

import { useChainId, useAccount } from "wagmi";
import { DESTINATION_CHAINS, REACTIVE_CHAINS } from "@/config/chains.config";

const CHAIN_COLORS: Record<number, string> = {
  11155111: "#627eea", // Sepolia
  5318007:  "#ff6b35", // Reactive Lasna
};

export function NetworkIndicator() {
  const chainId = useChainId();
  const { isConnected } = useAccount();

  if (!isConnected) return null;

  // Check both destination and reactive chain maps
  const destChain = DESTINATION_CHAINS[chainId];
  const reactChain = REACTIVE_CHAINS[chainId];
  const label = destChain?.label ?? reactChain?.label ?? "Unknown Network";
  const isKnown = !!(destChain || reactChain);
  const color = CHAIN_COLORS[chainId] ?? "#ff4444";

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 border font-mono text-[10px]"
      style={{
        borderColor: `${isKnown ? color : "#ff4444"}44`,
        backgroundColor: `${isKnown ? color : "#ff4444"}0d`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: isKnown ? color : "#ff4444",
          boxShadow: `0 0 4px ${isKnown ? color : "#ff4444"}`,
        }}
      />
      <span style={{ color: isKnown ? color : "#ff4444" }}>{label}</span>
    </div>
  );
}