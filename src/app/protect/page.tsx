"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ethers } from "ethers";
import { useContractStore } from "@/hooks/useContractStore";
import { useDeploy } from "@/hooks/useDeploy";
import { usePairInfo } from "@/hooks/usePairInfo";
import { ERC20_ABI, CALLBACK_ABI } from "@/config/abis";
import { getDestinationChain } from "@/config/chains.config";
import { shortAddr, isAddr, formatUnits, bpsToPercent, explorerAddr, explorerTx } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] tracking-[0.35em] text-[#39FF14] uppercase mb-1">
      {children}
    </div>
  );
}

function DataRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="data-row text-xs">
      <span className="data-label">{label}</span>
      <span className={accent ? "text-neon-green" : "text-[#e8e8e8]"}>{value}</span>
    </div>
  );
}

// Terminal log panel
function TerminalLog({ lines }: { lines: string[] }) {
  return (
    <div className="bg-[#050505] border border-[#1a1a1a] p-4 h-48 overflow-y-auto font-mono text-xs space-y-1">
      {lines.length === 0 && (
        <span className="text-[#333]">Awaiting deployment sequence...</span>
      )}
      {lines.map((l, i) => (
        <div key={i} className={l.includes("✓") ? "text-[#39FF14]" : l.includes("✗") || l.includes("Error") ? "text-[#FF2D2D]" : l.includes("⚠") ? "text-[#FFB800]" : "text-[#666]"}>
          {l}
        </div>
      ))}
      <div className="text-[#39FF14] animate-pulse">█</div>
    </div>
  );
}

// Step indicator
function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-8 h-8 border-2 flex items-center justify-center text-xs font-bold transition-all
        ${done   ? "border-[#39FF14] bg-[#39FF14] text-black" :
          active ? "border-[#39FF14] text-[#39FF14]" :
                   "border-[#333] text-[#444]"}`}>
        {done ? "✓" : n}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Deploy Panel
// ─────────────────────────────────────────────────────────────────────────────

function DeployPanel({
  onComplete,
}: {
  onComplete: (cb: string, rx: string, block: number) => void;
}) {
  const { address } = useAccount();
  const chainId     = useChainId();
  const chain       = getDestinationChain(chainId);
  const { state, deployCallback, deployReactive, retryReactive, reset } = useDeploy(chainId);

  const stepNum =
    state.step === "idle"               ? 0 :
    state.step === "deploying-callback" ? 1 :
    state.step === "callback-deployed" || state.step === "switch-to-reactive" ? 1 :
    state.step === "deploying-reactive" ? 2 : 2;

  const step1Done = ["callback-deployed","switch-to-reactive","deploying-reactive","reactive-deployed","complete"].includes(state.step);
  const step2Done = state.step === "complete";

  useEffect(() => {
    if (state.step === "complete") {
      onComplete(state.callbackAddress, state.reactiveAddress, state.callbackDeployBlock);
    }
  }, [state.step]);

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-3">
        <StepDot n={1} active={stepNum >= 1 && !step1Done} done={step1Done} />
        <div className={`flex-1 h-px ${step1Done ? "bg-[#39FF14]" : "bg-[#222]"}`} />
        <StepDot n={2} active={stepNum >= 2 && !step2Done} done={step2Done} />
        <div className={`flex-1 h-px ${step2Done ? "bg-[#39FF14]" : "bg-[#222]"}`} />
        <StepDot n={3} active={step2Done} done={step2Done} />
      </div>
      <div className="flex justify-between text-[10px] text-[#444] tracking-widest -mt-2">
        <span>CALLBACK</span>
        <span className="ml-2">REACTIVE</span>
        <span>COMPLETE</span>
      </div>

      {/* Info rows */}
      <div className="panel p-4 space-y-0">
        <DataRow label="DEPLOYING TO"         value={chain.name} />
        <DataRow label="CALLBACK PROXY"       value={shortAddr(chain.callbackProxyAddress)} />
        <DataRow label="UNISWAP V2 ROUTER"    value={shortAddr(chain.uniswapV2Router)} />
        <DataRow label="DEPLOY COST (ETH)"    value="~0.02 ETH" />
        <DataRow label="REACTIVE DEPLOY COST" value="~0.1 REACT" />
      </div>

      {/* Warning */}
      <div className="border border-[#FFB800] p-3 text-[11px] text-[#FFB800] space-y-1">
        <div className="font-bold tracking-widest">BEFORE YOU DEPLOY</div>
        <div className="text-[#666] leading-relaxed">
          You need ~0.02 ETH on Sepolia and ~0.1 REACT on Reactive Lasna.
          Step 1 deploys on Sepolia. Step 2 will ask you to switch to Reactive Lasna network.
        </div>
      </div>

      {/* Terminal */}
      <div>
        <SectionLabel>DEPLOYMENT LOG</SectionLabel>
        <TerminalLog lines={state.log} />
      </div>

      {/* Callback deployed info */}
      {state.callbackAddress && (
        <div className="panel panel-active p-4 space-y-0">
          <DataRow label="CALLBACK ADDRESS" value={
            <a href={explorerAddr(chain.explorerUrl, state.callbackAddress)} target="_blank" rel="noopener noreferrer" className="text-neon-green hover:underline">
              {shortAddr(state.callbackAddress)}
            </a>
          } accent />
          <DataRow label="DEPLOY BLOCK" value={state.callbackDeployBlock || "—"} />
        </div>
      )}

      {state.reactiveAddress && (
        <div className="panel panel-active p-4 space-y-0">
          <DataRow label="REACTIVE ADDRESS" value={
            <span className="text-[#00F5FF]">{shortAddr(state.reactiveAddress)}</span>
          } />
        </div>
      )}

      {/* Error */}
      {state.error && (
        <div className="border border-[#FF2D2D] p-3 text-[11px] text-[#FF2D2D]">
          {state.error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {state.step === "idle" && (
          <button
            className="btn-sentinel flex-1 text-xs py-3"
            onClick={() => address && deployCallback(address)}
            disabled={!address}
          >
            STEP 1 — DEPLOY CALLBACK →
          </button>
        )}

        {state.step === "callback-deployed" && (
          <button
            className="btn-sentinel flex-1 text-xs py-3"
            onClick={() => address && deployReactive(address, state.callbackAddress)}
          >
            STEP 2 — DEPLOY REACTIVE →
          </button>
        )}

        {state.step === "switch-to-reactive" && (
          <button
            className="btn-sentinel flex-1 text-xs py-3"
            onClick={() => address && retryReactive(address, state.callbackAddress)}
          >
            RETRY AFTER CHAIN SWITCH →
          </button>
        )}

        {(state.step === "error" || state.step === "complete") && (
          <button className="btn-sentinel btn-sentinel-ghost text-xs py-2 px-4" onClick={reset}>
            RESET
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual Connect Panel
// ─────────────────────────────────────────────────────────────────────────────

function ManualConnectPanel({
  onConnect,
  chainId,
}: {
  onConnect: (cb: string, rx: string, block: number) => void;
  chainId: number;
}) {
  const [cb, setCb]     = useState("");
  const [rx, setRx]     = useState("");
  const [blk, setBlk]   = useState("");
  const [err, setErr]   = useState("");

  const handleConnect = () => {
    setErr("");
    if (!isAddr(cb)) { setErr("Invalid callback address"); return; }
    if (!isAddr(rx)) { setErr("Invalid reactive address"); return; }
    onConnect(cb, rx, parseInt(blk) || 0);
  };

  return (
    <div className="space-y-4">
      <div className="border border-[#1a1a1a] p-3 text-[11px] text-[#555] leading-relaxed">
        Already deployed your contracts? Enter the addresses below to connect them to this interface.
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">
            CALLBACK CONTRACT (SEPOLIA)
          </label>
          <input
            className="input-sentinel"
            placeholder="0x..."
            value={cb}
            onChange={e => setCb(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">
            REACTIVE CONTRACT (LASNA)
          </label>
          <input
            className="input-sentinel"
            placeholder="0x..."
            value={rx}
            onChange={e => setRx(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">
            DEPLOY BLOCK (OPTIONAL — FOR EVENT HISTORY)
          </label>
          <input
            className="input-sentinel"
            placeholder="e.g. 7482910"
            value={blk}
            onChange={e => setBlk(e.target.value)}
          />
        </div>
      </div>

      {err && <div className="text-[#FF2D2D] text-xs">{err}</div>}

      <button className="btn-sentinel w-full text-xs py-3" onClick={handleConnect}>
        CONNECT CONTRACTS →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Register Position Panel
// ─────────────────────────────────────────────────────────────────────────────

function RegisterPanel({
  callbackAddress,
  chainId,
  ownerAddress,
}: {
  callbackAddress: string;
  chainId: number;
  ownerAddress: string;
}) {
  const chain = getDestinationChain(chainId);

  const [pair, setPair]           = useState("");
  const [lpAmount, setLpAmount]   = useState("");
  const [bps, setBps]             = useState("2000");
  const [status, setStatus]       = useState<"idle"|"approving"|"registering"|"done"|"error">("idle");
  const [txHash, setTxHash]       = useState("");
  const [err, setErr]             = useState("");
  const [useMax, setUseMax]       = useState(false);

  const { info: pairInfo, loading: pairLoading, error: pairError } = usePairInfo(
    isAddr(pair) ? pair : undefined,
    ownerAddress,
    chainId,
  );

  // When "use max" toggled, fill LP amount from balance
  useEffect(() => {
    if (useMax && pairInfo) {
      setLpAmount(ethers.formatUnits(pairInfo.userLpBalance, 18));
    }
  }, [useMax, pairInfo]);

  const bpsNum       = parseInt(bps) || 0;
  const pctDisplay   = (bpsNum / 100).toFixed(2);
  const fillColor    = bpsNum >= 5000 ? "#FF2D2D" : bpsNum >= 2000 ? "#FFB800" : "#39FF14";
  const barWidth     = Math.min((bpsNum / 9999) * 100, 100);

  const handleRegister = async () => {
    setErr(""); setTxHash("");
    if (!isAddr(pair))             { setErr("Invalid pair address"); return; }
    if (!lpAmount || parseFloat(lpAmount) <= 0) { setErr("Enter LP amount"); return; }
    if (bpsNum <= 0 || bpsNum >= 10000) { setErr("Threshold must be 1–9999 bps"); return; }

    try {
      const ethereum = (window as Window & { ethereum?: ethers.Eip1193Provider }).ethereum;
      if (!ethereum) { setErr("No wallet detected."); return; }
      const provider = new ethers.BrowserProvider(ethereum, "any");
      const network  = await provider.getNetwork();
      if (Number(network.chainId) !== chainId) {
        setErr(`Switch wallet to ${chain.name} (Chain ID: ${chainId})`); return;
      }
      const signer = await provider.getSigner();

      const lpWei = ethers.parseUnits(lpAmount, 18);

      // ── Approve LP tokens ────────────────────────────────────────────────
      setStatus("approving");
      const lp = new ethers.Contract(pair, ERC20_ABI, signer);
      const allowance: bigint = await lp.allowance(ownerAddress, callbackAddress);
      if (allowance < lpWei) {
        const approveTx = await lp.approve(callbackAddress, lpWei);
        await approveTx.wait(1);
      }

      // ── Register position ────────────────────────────────────────────────
      setStatus("registering");
      const cb = new ethers.Contract(callbackAddress, CALLBACK_ABI, signer);
      const tx = await cb.registerPosition(pair, lpWei, bpsNum);
      const receipt = await tx.wait(1);

      setTxHash(receipt.hash);
      setStatus("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.slice(0, 120) : "Transaction failed";
      setErr(msg);
      setStatus("error");
    }
  };

  const busy = status === "approving" || status === "registering";

  return (
    <div className="space-y-5">

      {/* Pair input */}
      <div>
        <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">
          UNISWAP V2 PAIR ADDRESS
        </label>
        <input
          className="input-sentinel"
          placeholder="0x..."
          value={pair}
          onChange={e => { setPair(e.target.value); setUseMax(false); }}
        />
        {pairLoading && <div className="text-[10px] text-[#555] mt-1">Resolving pair...</div>}
        {pairError   && <div className="text-[10px] text-[#FF2D2D] mt-1">{pairError}</div>}
      </div>

      {/* Pair info card */}
      {pairInfo && (
        <div className="panel panel-active p-4 space-y-0 animate-fade-in">
          <DataRow label="PAIR"      value={`${pairInfo.symbol0} / ${pairInfo.symbol1}`} accent />
          <DataRow label="RESERVE 0" value={`${formatUnits(pairInfo.reserve0, pairInfo.decimals0, 4)} ${pairInfo.symbol0}`} />
          <DataRow label="RESERVE 1" value={`${formatUnits(pairInfo.reserve1, pairInfo.decimals1, 4)} ${pairInfo.symbol1}`} />
          <DataRow label="RATIO (R0/R1)" value={pairInfo.ratio.toFixed(6)} />
          <DataRow label="YOUR LP BALANCE" value={
            <span>
              {formatUnits(pairInfo.userLpBalance, 18, 6)} LP
              <button
                className="ml-2 text-[#39FF14] text-[10px] hover:underline"
                onClick={() => setUseMax(v => !v)}
              >
                {useMax ? "CUSTOM" : "MAX"}
              </button>
            </span>
          } />
        </div>
      )}

      {/* LP Amount */}
      <div>
        <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">
          LP TOKEN AMOUNT TO PROTECT
        </label>
        <input
          className="input-sentinel"
          placeholder="e.g. 1.0"
          value={lpAmount}
          onChange={e => { setLpAmount(e.target.value); setUseMax(false); }}
          disabled={useMax}
        />
      </div>

      {/* Threshold */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-[10px] text-[#444] tracking-widest">
            DIVERGENCE THRESHOLD
          </label>
          <span className="text-xs font-bold" style={{ color: fillColor }}>
            {bps} bps ({pctDisplay}%)
          </span>
        </div>

        <input
          type="range"
          min={100} max={9900} step={100}
          value={bpsNum}
          onChange={e => setBps(e.target.value)}
          className="w-full accent-[#39FF14] mb-2"
        />

        <div className="divergence-bar mb-2">
          <div className="divergence-fill" style={{ width: `${barWidth}%`, background: fillColor }} />
        </div>

        <input
          className="input-sentinel text-xs"
          placeholder="Custom bps (e.g. 2000)"
          value={bps}
          onChange={e => setBps(e.target.value)}
        />

        <div className="flex justify-between text-[10px] text-[#444] mt-1">
          <span>100 bps (1%)</span>
          <span>5000 bps (50%)</span>
          <span>9900 bps (99%)</span>
        </div>

        {/* Threshold guidance */}
        <div className="mt-2 text-[11px] leading-relaxed" style={{ color: fillColor }}>
          {bpsNum < 500  && "⚠ Very tight — may trigger on normal volatility"}
          {bpsNum >= 500  && bpsNum < 2000 && "◈ Conservative — good for stable pairs"}
          {bpsNum >= 2000 && bpsNum < 5000 && "◈ Moderate — standard IL protection range"}
          {bpsNum >= 5000 && bpsNum < 8000 && "⚠ Wide — only catches large price moves"}
          {bpsNum >= 8000 && "⚠ Very wide — minimal protection"}
        </div>
      </div>

      {/* Summary */}
      {pairInfo && lpAmount && bpsNum > 0 && (
        <div className="panel p-4 space-y-0 animate-fade-in">
          <SectionLabel>POSITION SUMMARY</SectionLabel>
          <DataRow label="PAIR"       value={`${pairInfo.symbol0}/${pairInfo.symbol1}`} />
          <DataRow label="LP AMOUNT"  value={`${parseFloat(lpAmount).toFixed(6)} LP`} />
          <DataRow label="THRESHOLD"  value={`${bpsNum} bps (${pctDisplay}%)`} />
          <DataRow label="ENTRY R0"   value={formatUnits(pairInfo.reserve0, pairInfo.decimals0, 4)} />
          <DataRow label="ENTRY R1"   value={formatUnits(pairInfo.reserve1, pairInfo.decimals1, 4)} />
        </div>
      )}

      {/* Error */}
      {err && (
        <div className="border border-[#FF2D2D] p-3 text-[11px] text-[#FF2D2D]">{err}</div>
      )}

      {/* Success */}
      {status === "done" && txHash && (
        <div className="border border-[#39FF14] p-3 text-[11px] text-[#39FF14] space-y-1">
          <div className="font-bold tracking-widest">POSITION REGISTERED</div>
          <div>
            <a href={explorerTx(chain.explorerUrl, txHash)} target="_blank" rel="noopener noreferrer" className="hover:underline">
              View on {chain.label}scan →
            </a>
          </div>
          <div className="text-[#555]">SENTINEL is now monitoring your position.</div>
        </div>
      )}

      {/* Status indicator */}
      {busy && (
        <div className="text-[11px] text-[#FFB800] tracking-widest animate-pulse">
          {status === "approving"   && "⟳ APPROVING LP TOKEN SPEND..."}
          {status === "registering" && "⟳ REGISTERING POSITION ON-CHAIN..."}
        </div>
      )}

      <button
        className="btn-sentinel w-full text-xs py-3"
        onClick={handleRegister}
        disabled={busy || status === "done"}
      >
        {busy ? "PROCESSING..." : status === "done" ? "REGISTERED ✓" : "APPROVE & REGISTER POSITION →"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "deploy" | "connect";

export default function ProtectPage() {
  const { address, isConnected } = useAccount();
  const chainId                  = useChainId();
  const { addresses, loaded, save, clear, setManual } = useContractStore(address);

  const [tab, setTab] = useState<Tab>("deploy");

  const handleDeployComplete = (cb: string, rx: string, block: number) => {
    if (!address) return;
    save({ callbackAddress: cb, reactiveAddress: rx, deployedAt: Date.now(), deployedOnChainId: chainId, callbackDeployBlock: block });
  };

  const handleManualConnect = (cb: string, rx: string, block: number) => {
    setManual(cb, rx, chainId, block);
  };

  const chain = getDestinationChain(chainId);

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center px-4">
        <div className="panel p-10 text-center max-w-sm w-full corner-accent">
          <div className="text-[#39FF14] text-3xl mb-4">◈</div>
          <div className="text-sm font-bold tracking-widest mb-2">WALLET REQUIRED</div>
          <div className="text-xs text-[#555] mb-6 leading-relaxed">
            Connect your wallet to deploy contracts and register IL protection positions.
          </div>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-14 pb-20">

      {/* ── Page header ── */}
      <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-[10px] tracking-[0.35em] text-[#39FF14] mb-2">PROTECTION INTERFACE</div>
          <h1 className="text-3xl font-bold text-[#e8e8e8] mb-1">DEPLOY & PROTECT</h1>
          <p className="text-[#555] text-sm">
            Deploy your personal SENTINEL contracts, then register LP positions for automated IL protection.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">

        {/* ── Active contracts banner ── */}
        {loaded && addresses && (
          <div className="panel panel-active p-4 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] tracking-widest text-[#39FF14]">CONTRACTS ACTIVE</div>
              <div className="text-xs text-[#666] flex flex-wrap gap-4">
                <span>
                  CALLBACK:{" "}
                  <a href={explorerAddr(chain.explorerUrl, addresses.callbackAddress)} target="_blank" rel="noopener noreferrer" className="text-[#e8e8e8] hover:text-[#39FF14]">
                    {shortAddr(addresses.callbackAddress)}
                  </a>
                </span>
                <span>
                  REACTIVE:{" "}
                  <span className="text-[#00F5FF]">{shortAddr(addresses.reactiveAddress)}</span>
                </span>
              </div>
            </div>
            <button className="btn-sentinel btn-sentinel-ghost text-xs px-4 py-2" onClick={clear}>
              DISCONNECT
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">

          {/* ── LEFT: Deploy / Connect ── */}
          <div>
            {!addresses ? (
              <>
                {/* Tab switcher */}
                <div className="flex border-b border-[#1a1a1a] mb-6">
                  {(["deploy", "connect"] as Tab[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-5 py-3 text-xs font-bold tracking-widest transition-colors
                        ${tab === t ? "text-[#39FF14] border-b-2 border-[#39FF14]" : "text-[#444] hover:text-[#888]"}`}
                    >
                      {t === "deploy" ? "DEPLOY NEW" : "CONNECT EXISTING"}
                    </button>
                  ))}
                </div>

                {tab === "deploy" ? (
                  <DeployPanel onComplete={handleDeployComplete} />
                ) : (
                  <ManualConnectPanel onConnect={handleManualConnect} chainId={chainId} />
                )}
              </>
            ) : (
              /* Already deployed — show contract summary */
              <div className="space-y-4">
                <div className="text-[10px] tracking-widest text-[#39FF14] mb-4">CONTRACT STATUS</div>

                <div className="panel p-5 space-y-0">
                  <SectionLabel>CALLBACK CONTRACT — {chain.label}</SectionLabel>
                  <DataRow label="ADDRESS" value={
                    <a href={explorerAddr(chain.explorerUrl, addresses.callbackAddress)} target="_blank" rel="noopener noreferrer" className="text-[#39FF14] hover:underline font-mono">
                      {addresses.callbackAddress}
                    </a>
                  } />
                  <DataRow label="DEPLOY BLOCK" value={addresses.callbackDeployBlock || "unknown"} />
                  <DataRow label="CHAIN"        value={chain.name} />
                </div>

                <div className="panel p-5 space-y-0">
                  <SectionLabel>REACTIVE CONTRACT — LASNA</SectionLabel>
                  <DataRow label="ADDRESS" value={
                    <span className="text-[#00F5FF] font-mono text-[11px]">{addresses.reactiveAddress}</span>
                  } />
                  <DataRow label="MONITORS" value="Uniswap V2 Sync events" />
                </div>

                <div className="border border-[#1a1a1a] p-3 text-[11px] text-[#555] leading-relaxed">
                  Your contracts are live. Register a new position on the right to begin IL protection.
                  Head to the{" "}
                  <a href="/dashboard" className="text-[#39FF14] hover:underline">Dashboard</a>{" "}
                  to monitor existing positions.
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Register Position ── */}
          <div>
            <div className="text-[10px] tracking-widest text-[#39FF14] mb-6">REGISTER POSITION</div>

            {!addresses ? (
              <div className="panel p-8 text-center text-[#444] text-xs leading-relaxed">
                Deploy or connect your contracts first to register an IL protection position.
              </div>
            ) : (
              <RegisterPanel
                callbackAddress={addresses.callbackAddress}
                chainId={chainId}
                ownerAddress={address ?? ""}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}