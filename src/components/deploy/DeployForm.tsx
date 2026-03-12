"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Shield, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { useDeploymentOrchestrator } from "@/hooks/useDeploymentOrchestrator";
import { DeploymentVisualizer } from "./DeploymentVisualizer";
import { DESTINATION_CHAINS, DEFAULT_DESTINATION_CHAIN_ID } from "@/config/chains.config";

// Use your real config instead of the non-existent @/config/chains
const sepoliaConfig = DESTINATION_CHAINS[DEFAULT_DESTINATION_CHAIN_ID];

const SENTINEL_TYPES = [
  {
    id: "conservative",
    label: "Conservative",
    description: "10% threshold — exits early, maximum protection",
    bps: 1000,
  },
  {
    id: "standard",
    label: "Standard",
    description: "20% threshold — balanced protection",
    bps: 2000,
  },
  {
    id: "aggressive",
    label: "Aggressive",
    description: "35% threshold — rides volatility, exits late",
    bps: 3500,
  },
  {
    id: "custom",
    label: "Custom",
    description: "Set your own basis points (1 – 9999)",
    bps: null,
  },
];

export function DeployForm() {
  const { address, isConnected } = useAccount();
  const { steps, isDeploying, error, result, progressMsg, progressPct, deploy, reset } =
    useDeploymentOrchestrator();

  const [pairAddress, setPairAddress] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [sentinelType, setSentinelType] = useState("standard");
  const [customBps, setCustomBps] = useState("2000");

  const selectedType = SENTINEL_TYPES.find((t) => t.id === sentinelType)!;
  const thresholdBps =
    sentinelType === "custom" ? Number(customBps) : selectedType.bps ?? 2000;

  const isValid =
    isConnected &&
    pairAddress.startsWith("0x") &&
    pairAddress.length === 42 &&
    Number(lpAmount) > 0 &&
    thresholdBps >= 1 &&
    thresholdBps <= 9999;

  const handleDeploy = async () => {
    if (!address || !isValid) return;
    await deploy({
      pairAddress,
      lpAmount,
      thresholdBps,
      sentinelType: selectedType.label,
      walletAddress: address,
    });
  };

  // ── Success state ──────────────────────────────────────────
  if (result) {
    return (
      <div className="border border-[#00ff88]/30 bg-[#00ff8806] p-6 font-mono space-y-4">
        <div className="flex items-center gap-2 text-[#00ff88]">
          <CheckCircle2 size={18} />
          <span className="text-sm font-semibold">Sentinel Deployed</span>
        </div>

        <div className="space-y-2 text-xs text-[#888]">
          {[
            { label: "Callback Contract", value: result.callbackAddress },
            { label: "Reactive Contract", value: result.reactiveAddress },
            { label: "Position ID",       value: `#${result.positionId}` },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between border-b border-[#111] pb-2">
              <span className="text-[#444]">{label}</span>
              <span className="text-white font-mono text-[10px] break-all">{value}</span>
            </div>
          ))}
        </div>

        <a
          href={`${sepoliaConfig.explorerUrl}/tx/${result.registrationTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-[#627eea] hover:text-white transition-colors"
        >
          <ExternalLink size={12} />
          View registration transaction
        </a>

        <button
          onClick={reset}
          className="block w-full mt-4 border border-[#1a1a1a] py-2 text-[11px] text-[#444] hover:text-white hover:border-[#333] transition-colors"
        >
          Deploy another sentinel
        </button>
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <DeploymentVisualizer
        steps={steps}
        progressMsg={progressMsg}
        progressPct={progressPct}
        isDeploying={isDeploying}
      />

      {/* Pair address */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono text-[#444] uppercase tracking-widest">
          Uniswap V2 Pair Address
        </label>
        <input
          type="text"
          placeholder="0x..."
          value={pairAddress}
          onChange={(e) => setPairAddress(e.target.value)}
          disabled={isDeploying}
          className="w-full bg-[#050505] border border-[#1a1a1a] focus:border-[#00ff88] outline-none px-3 py-2.5 text-sm font-mono text-white placeholder:text-[#333] transition-colors disabled:opacity-40"
        />
      </div>

      {/* LP Token Amount */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono text-[#444] uppercase tracking-widest">
          LP Token Amount to Protect
        </label>
        <input
          type="number"
          placeholder="e.g. 1.0"
          min="0"
          step="0.000001"
          value={lpAmount}
          onChange={(e) => setLpAmount(e.target.value)}
          disabled={isDeploying}
          className="w-full bg-[#050505] border border-[#1a1a1a] focus:border-[#00ff88] outline-none px-3 py-2.5 text-sm font-mono text-white placeholder:text-[#333] transition-colors disabled:opacity-40"
        />
        <p className="text-[10px] text-[#333] font-mono">
          LP tokens are pulled from your wallet when exit is triggered.
        </p>
      </div>

      {/* Sentinel Type */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono text-[#444] uppercase tracking-widest">
          Sentinel Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {SENTINEL_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSentinelType(type.id)}
              disabled={isDeploying}
              className={`text-left p-3 border transition-colors disabled:opacity-40 ${
                sentinelType === type.id
                  ? "border-[#00ff88] bg-[#00ff8808]"
                  : "border-[#1a1a1a] hover:border-[#333]"
              }`}
            >
              <p className={`text-[11px] font-mono font-semibold ${sentinelType === type.id ? "text-[#00ff88]" : "text-white"}`}>
                {type.label}
              </p>
              <p className="text-[10px] text-[#444] mt-0.5 leading-tight">
                {type.description}
              </p>
            </button>
          ))}
        </div>

        {sentinelType === "custom" && (
          <div className="mt-2 space-y-1">
            <label className="text-[10px] font-mono text-[#444] uppercase tracking-widest">
              Custom Threshold (basis points)
            </label>
            <input
              type="number"
              min="1"
              max="9999"
              value={customBps}
              onChange={(e) => setCustomBps(e.target.value)}
              disabled={isDeploying}
              className="w-full bg-[#050505] border border-[#1a1a1a] focus:border-[#00ff88] outline-none px-3 py-2.5 text-sm font-mono text-white placeholder:text-[#333] transition-colors disabled:opacity-40"
            />
            <p className="text-[10px] text-[#444] font-mono">
              {thresholdBps} bps = {(thresholdBps / 100).toFixed(2)}% divergence
            </p>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-3 text-[10px] font-mono text-[#444] space-y-1">
        <p className="text-[#555] uppercase tracking-widest mb-2">What will happen</p>
        <p>→ Deploy Callback contract on Sepolia (~0.02 ETH gas reserve)</p>
        <p>→ Switch to Reactive Lasna, deploy Reactive contract (~0.1 REACT)</p>
        <p>→ Return to Sepolia, register your position automatically</p>
        <p className="text-[#333] mt-2 border-t border-[#111] pt-2">
          Ensure you have ETH on Sepolia and REACT on Lasna before proceeding.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 border border-red-900/50 bg-red-950/20 p-3">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-[11px] font-mono text-red-400 break-all">{error}</p>
        </div>
      )}

      {/* Deploy button */}
      {!isConnected ? (
        <div className="border border-[#1a1a1a] p-4 text-center text-[11px] font-mono text-[#444]">
          Connect your wallet to deploy a sentinel
        </div>
      ) : (
        <button
          onClick={handleDeploy}
          disabled={!isValid || isDeploying}
          className="w-full flex items-center justify-center gap-2 bg-[#39FF14] text-black font-mono font-semibold text-sm py-3 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2de010] transition-colors"
        >
          <Shield size={16} />
          {isDeploying ? "Deploying Sentinel..." : "Deploy Sentinel"}
        </button>
      )}
    </div>
  );
}