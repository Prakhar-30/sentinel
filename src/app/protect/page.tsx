"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { useContractStore } from "@/hooks/useContractStore";
import { useDeploy, RegistrationParams } from "@/hooks/useDeploy";
import { usePairInfo } from "@/hooks/usePairInfo";
import { ERC20_ABI, CALLBACK_ABI } from "@/config/abis";
import { getDestinationChain } from "@/config/chains.config";
import { shortAddr, isAddr, formatUnits, explorerAddr, explorerTx } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] tracking-[0.35em] text-[#39FF14] uppercase mb-1">{children}</div>
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

function TerminalLog({ lines }: { lines: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);
  return (
    <div className="bg-[#050505] border border-[#1a1a1a] p-4 h-52 overflow-y-auto font-mono text-xs space-y-1">
      {lines.length === 0 && <span className="text-[#333]">Awaiting deployment sequence...</span>}
      {lines.map((l, i) => (
        <div key={i} className={
          l.startsWith("NEXT:") ? "text-[#00F5FF] opacity-60 italic" :
          l.includes("✓")       ? "text-[#39FF14]" :
          l.includes("✗") || l.toLowerCase().includes("error") ? "text-[#FF2D2D]" :
          l.includes("⚠")       ? "text-[#FFB800]" : "text-[#666]"
        }>{l}</div>
      ))}
      <div ref={bottomRef} className="text-[#39FF14] animate-pulse">█</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step bar
// ─────────────────────────────────────────────────────────────────────────────

const STEP_META: Record<string, { n: number; label: string; next?: string }> = {
  idle:                 { n: 0, label: "" },
  "deploying-callback": { n: 1, label: "Deploying Callback",   next: "Switch to Reactive Lasna" },
  "switch-to-reactive": { n: 1, label: "Switching Network",    next: "Deploy Reactive Contract" },
  "deploying-reactive": { n: 2, label: "Deploying Reactive",   next: "Return to Sepolia" },
  "switching-back":     { n: 3, label: "Returning to Sepolia", next: "Approve LP Tokens" },
  approving:            { n: 4, label: "Approving LP Tokens",  next: "Register Position" },
  registering:          { n: 5, label: "Registering Position", next: "Done — going to dashboard" },
  complete:             { n: 5, label: "Complete" },
  error:                { n: 0, label: "Error" },
};

function StepBar({ currentStep }: { currentStep: string }) {
  const steps = [
    { n: 1, label: "CALLBACK" },
    { n: 2, label: "REACTIVE" },
    { n: 3, label: "RETURN" },
    { n: 4, label: "APPROVE" },
    { n: 5, label: "REGISTER" },
  ];
  const current = STEP_META[currentStep]?.n ?? 0;
  const done    = currentStep === "complete";
  const nextLabel = STEP_META[currentStep]?.next;

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1 last:flex-none">
            <div className={`w-7 h-7 border-2 flex items-center justify-center text-[10px] font-bold shrink-0 transition-all
              ${done || current > s.n ? "border-[#39FF14] bg-[#39FF14] text-black" :
                current === s.n       ? "border-[#39FF14] text-[#39FF14] animate-pulse" :
                                        "border-[#333] text-[#444]"}`}>
              {done || current > s.n ? "✓" : s.n}
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-1 transition-all ${current > s.n || done ? "bg-[#39FF14]" : "bg-[#222]"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] tracking-widest">
        {steps.map(s => (
          <span key={s.n} className={current === s.n && !done ? "text-[#39FF14]" : "text-[#444]"}>{s.label}</span>
        ))}
      </div>
      {nextLabel && !done && (
        <div className="text-[10px] text-[#00F5FF] tracking-widest">NEXT → {nextLabel}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Faucet banner
// ─────────────────────────────────────────────────────────────────────────────

function FaucetBanner() {
  const chunk = (
    <>
      <span className="text-[#FFB800]">⚠ REACTIVE LASNA TESTNET REQUIRED</span>
      <span className="text-[#555]"> — You need native REACT tokens to deploy your Reactive contract. </span>
      <a href="https://reacdefi.app/markets#testnet-faucet" target="_blank" rel="noopener noreferrer" className="text-[#39FF14] hover:underline">
        Get REACT tokens from the faucet →
      </a>
      <span className="text-[#0a0a0a]">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
    </>
  );
  return (
    <div className="overflow-hidden border-b border-t border-[#1a1a1a] bg-[#050a05] py-2 whitespace-nowrap">
      <span className="inline-block text-[11px] font-mono tracking-wide" style={{ animation: "marquee 28s linear infinite" }}>
        {chunk}{chunk}{chunk}
      </span>
      <style>{`@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-33.333%)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sentinel types
// ─────────────────────────────────────────────────────────────────────────────

const SENTINEL_TYPES = [
  { id: "conservative", label: "Conservative", bps: 1000, desc: "10% — exits early" },
  { id: "standard",     label: "Standard",     bps: 2000, desc: "20% — balanced" },
  { id: "aggressive",   label: "Aggressive",   bps: 3500, desc: "35% — rides volatility" },
  { id: "custom",       label: "Custom",       bps: null, desc: "Set your own bps" },
];

// ─────────────────────────────────────────────────────────────────────────────
// InputForm  — collects all deploy params, calls onSubmit, does NOT run deploy
// ─────────────────────────────────────────────────────────────────────────────

function InputForm({ onSubmit }: { onSubmit: (reg: RegistrationParams) => void }) {
  const { address } = useAccount();
  const chainId     = useChainId();

  const [pairAddress,  setPairAddress]  = useState("");
  const [lpAmount,     setLpAmount]     = useState("");
  const [sentinelType, setSentinelType] = useState("standard");
  const [customBps,    setCustomBps]    = useState("2000");
  const [useMax,       setUseMax]       = useState(false);

  const selectedType = SENTINEL_TYPES.find(t => t.id === sentinelType)!;
  const thresholdBps = sentinelType === "custom" ? Number(customBps) : (selectedType.bps ?? 2000);
  const fillColor    = thresholdBps >= 5000 ? "#FF2D2D" : thresholdBps >= 2000 ? "#FFB800" : "#39FF14";

  const { info: pairInfo, loading: pairLoading, error: pairError } = usePairInfo(
    isAddr(pairAddress) ? pairAddress : undefined,
    address ?? "",
    chainId,
  );

  useEffect(() => {
    if (useMax && pairInfo) setLpAmount(ethers.formatUnits(pairInfo.userLpBalance, 18));
  }, [useMax, pairInfo]);

  const isValid = !!address && isAddr(pairAddress) && Number(lpAmount) > 0 && thresholdBps >= 1 && thresholdBps <= 9999;

  return (
    <div className="space-y-5">
      {/* Pair address */}
      <div>
        <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">UNISWAP V2 PAIR ADDRESS</label>
        <input className="input-sentinel" placeholder="0x..." value={pairAddress} onChange={e => { setPairAddress(e.target.value); setUseMax(false); }} />
        {pairLoading && <div className="text-[10px] text-[#555] mt-1">Resolving pair...</div>}
        {pairError   && <div className="text-[10px] text-[#FF2D2D] mt-1">{pairError}</div>}
      </div>

      {pairInfo && (
        <div className="panel panel-active p-4 space-y-0 animate-fade-in">
          <DataRow label="PAIR"             value={`${pairInfo.symbol0} / ${pairInfo.symbol1}`} accent />
          <DataRow label="RESERVE 0"        value={`${formatUnits(pairInfo.reserve0, pairInfo.decimals0, 4)} ${pairInfo.symbol0}`} />
          <DataRow label="RESERVE 1"        value={`${formatUnits(pairInfo.reserve1, pairInfo.decimals1, 4)} ${pairInfo.symbol1}`} />
          <DataRow label="YOUR LP BALANCE"  value={
            <span>
              {formatUnits(pairInfo.userLpBalance, 18, 6)} LP
              <button className="ml-2 text-[#39FF14] text-[10px] hover:underline" onClick={() => setUseMax(v => !v)}>
                {useMax ? "CUSTOM" : "MAX"}
              </button>
            </span>
          } />
        </div>
      )}

      {/* LP amount */}
      <div>
        <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">LP TOKEN AMOUNT TO PROTECT</label>
        <input className="input-sentinel" placeholder="e.g. 1.0" value={lpAmount} onChange={e => { setLpAmount(e.target.value); setUseMax(false); }} disabled={useMax} />
      </div>

      {/* Sentinel type */}
      <div>
        <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">SENTINEL TYPE</label>
        <div className="grid grid-cols-2 gap-2">
          {SENTINEL_TYPES.map(type => (
            <button key={type.id} onClick={() => setSentinelType(type.id)}
              className={`text-left p-3 border transition-colors ${sentinelType === type.id ? "border-[#39FF14] bg-[#39FF1408]" : "border-[#1a1a1a] hover:border-[#333]"}`}>
              <p className={`text-[11px] font-mono font-semibold ${sentinelType === type.id ? "text-[#39FF14]" : "text-white"}`}>{type.label}</p>
              <p className="text-[10px] text-[#444] mt-0.5">{type.desc}</p>
            </button>
          ))}
        </div>
        {sentinelType === "custom" && (
          <div className="mt-3 space-y-1">
            <input className="input-sentinel text-xs" placeholder="Custom bps e.g. 2000" value={customBps} onChange={e => setCustomBps(e.target.value)} />
            <p className="text-[10px] font-mono" style={{ color: fillColor }}>{thresholdBps} bps = {(thresholdBps / 100).toFixed(2)}%</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-3 text-[10px] text-[#444] space-y-1">
        <p className="text-[#555] uppercase tracking-widest mb-1">One click does everything</p>
        <p>→ Deploy Callback on Sepolia (~0.02 ETH)</p>
        <p>→ Switch to Lasna, deploy Reactive contract (~0.1 REACT)</p>
        <p>→ Return to Sepolia, approve & register position</p>
        <p>→ Auto-redirect to Dashboard on completion</p>
        <p className="text-[#333] mt-2 pt-2 border-t border-[#111]">You will confirm 3–4 wallet transactions in sequence.</p>
      </div>

      <button className="btn-sentinel w-full text-xs py-3" disabled={!isValid}
        onClick={() => isValid && onSubmit({ pairAddress, lpAmount, thresholdBps })}>
        DEPLOY SENTINEL →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActiveDeployFlow
//
// Rendered UNCONDITIONALLY (full-width) once the user clicks DEPLOY SENTINEL.
// Receives params as props so it can auto-start.
// Calls onSaved only INSIDE the redirect timer — never before —
// so the parent's `addresses` state never changes while this component
// is still visible, preventing any layout switch that would unmount it.
// ─────────────────────────────────────────────────────────────────────────────

function ActiveDeployFlow({
  params,
  onSaved,
}: {
  params: RegistrationParams & { walletAddress: string };
  onSaved: (cb: string, rx: string, block: number) => void;
}) {
  const chainId = useChainId();
  const chain   = getDestinationChain(chainId);
  const router  = useRouter();
  const { state, deployAll, reset } = useDeploy(chainId);

  const started = useRef(false);

  // Auto-start deploy as soon as this component mounts
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const reg: RegistrationParams = {
      pairAddress:  params.pairAddress,
      lpAmount:     params.lpAmount,
      thresholdBps: params.thresholdBps,
    };
    deployAll(params.walletAddress, reg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On complete: hold the success screen for 2.5s, THEN save + navigate.
  // onSaved() is called INSIDE this timer so that the parent's setAddresses
  // fires at exactly the same moment as router.push — by which point React
  // has already started navigating away and will NOT re-render this page.
  useEffect(() => {
    if (state.step !== "complete") return;
    const t = setTimeout(() => {
      onSaved(state.callbackAddress, state.reactiveAddress, state.callbackDeployBlock);
      router.push("/dashboard");
    }, 2500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  const isActive = !["idle", "complete", "error"].includes(state.step);

  return (
    <div className="space-y-6">
      {/* Always show step bar once mounted */}
      <StepBar currentStep={state.step === "idle" ? "deploying-callback" : state.step} />

      {/* Active label */}
      {isActive && (
        <div className="flex items-center gap-2 text-[11px] text-[#FFB800] tracking-widest">
          <span className="inline-block animate-spin">⟳</span>
          <span>{STEP_META[state.step]?.label ?? "Processing"}...</span>
        </div>
      )}

      {/* Terminal log — always visible */}
      <div>
        <SectionLabel>DEPLOYMENT LOG</SectionLabel>
        <TerminalLog lines={state.log} />
      </div>

      {/* Success card */}
      {state.step === "complete" && (
        <div className="border border-[#39FF14] p-4 text-[11px] text-[#39FF14] space-y-2 animate-fade-in">
          <div className="font-bold tracking-widest">✓ SENTINEL DEPLOYED & ACTIVE</div>
          <div className="text-[#555] space-y-1 break-all">
            <div>Callback: <span className="text-[#e8e8e8] font-mono">{state.callbackAddress}</span></div>
            <div>Reactive: <span className="text-[#00F5FF] font-mono">{state.reactiveAddress}</span></div>
            <div>Position: <span className="text-[#e8e8e8]">#{state.positionId}</span></div>
          </div>
          {state.registrationTx && (
            <a href={`${chain.explorerUrl}/tx/${state.registrationTx}`} target="_blank" rel="noopener noreferrer" className="block hover:underline text-[10px] mt-1">
              View registration tx →
            </a>
          )}
          <div className="text-[#FFB800] text-[10px] tracking-widest animate-pulse mt-2">
            Redirecting to Dashboard...
          </div>
        </div>
      )}

      {/* Error */}
      {state.step === "error" && (
        <div className="space-y-3">
          <div className="border border-[#FF2D2D] p-3 text-[11px] text-[#FF2D2D] break-words">
            {state.error}
          </div>
          <button className="btn-sentinel btn-sentinel-ghost text-xs py-2 px-4" onClick={reset}>
            RESET — START OVER
          </button>
        </div>
      )}

      {/* In-progress lock */}
      {isActive && (
        <div className="border border-[#1a1a1a] py-3 text-center text-[10px] text-[#444] tracking-widest">
          DEPLOYMENT IN PROGRESS — CHECK WALLET
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ManualConnectPanel
// ─────────────────────────────────────────────────────────────────────────────

function ManualConnectPanel({ onConnect, chainId }: { onConnect: (cb: string, rx: string, block: number) => void; chainId: number }) {
  const [cb,  setCb]  = useState("");
  const [rx,  setRx]  = useState("");
  const [blk, setBlk] = useState("");
  const [err, setErr] = useState("");

  return (
    <div className="space-y-4">
      <div className="border border-[#1a1a1a] p-3 text-[11px] text-[#555] leading-relaxed">
        Already deployed your contracts? Enter the addresses below to connect them.
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">CALLBACK CONTRACT (SEPOLIA)</label>
          <input className="input-sentinel" placeholder="0x..." value={cb} onChange={e => setCb(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">REACTIVE CONTRACT (LASNA)</label>
          <input className="input-sentinel" placeholder="0x..." value={rx} onChange={e => setRx(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">DEPLOY BLOCK (OPTIONAL)</label>
          <input className="input-sentinel" placeholder="e.g. 7482910" value={blk} onChange={e => setBlk(e.target.value)} />
        </div>
      </div>
      {err && <div className="text-[#FF2D2D] text-xs">{err}</div>}
      <button className="btn-sentinel w-full text-xs py-3" onClick={() => {
        setErr("");
        if (!isAddr(cb)) { setErr("Invalid callback address"); return; }
        if (!isAddr(rx)) { setErr("Invalid reactive address");  return; }
        onConnect(cb, rx, parseInt(blk) || 0);
      }}>CONNECT CONTRACTS →</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RegisterPanel
// ─────────────────────────────────────────────────────────────────────────────

function RegisterPanel({ callbackAddress, chainId, ownerAddress }: { callbackAddress: string; chainId: number; ownerAddress: string }) {
  const chain = getDestinationChain(chainId);
  const [pair,     setPair]     = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [bps,      setBps]      = useState("2000");
  const [status,   setStatus]   = useState<"idle"|"approving"|"registering"|"done"|"error">("idle");
  const [txHash,   setTxHash]   = useState("");
  const [err,      setErr]      = useState("");
  const [useMax,   setUseMax]   = useState(false);

  const { info: pairInfo, loading: pairLoading, error: pairError } = usePairInfo(isAddr(pair) ? pair : undefined, ownerAddress, chainId);

  useEffect(() => {
    if (useMax && pairInfo) setLpAmount(ethers.formatUnits(pairInfo.userLpBalance, 18));
  }, [useMax, pairInfo]);

  const bpsNum     = parseInt(bps) || 0;
  const pctDisplay = (bpsNum / 100).toFixed(2);
  const fillColor  = bpsNum >= 5000 ? "#FF2D2D" : bpsNum >= 2000 ? "#FFB800" : "#39FF14";
  const barWidth   = Math.min((bpsNum / 9999) * 100, 100);
  const busy       = status === "approving" || status === "registering";

  const handleRegister = async () => {
    setErr(""); setTxHash("");
    if (!isAddr(pair))                          { setErr("Invalid pair address"); return; }
    if (!lpAmount || parseFloat(lpAmount) <= 0) { setErr("Enter LP amount"); return; }
    if (bpsNum <= 0 || bpsNum >= 10000)         { setErr("Threshold must be 1–9999 bps"); return; }
    try {
      const ethereum = (window as Window & { ethereum?: ethers.Eip1193Provider }).ethereum;
      if (!ethereum) { setErr("No wallet detected."); return; }
      const provider = new ethers.BrowserProvider(ethereum, "any");
      const network  = await provider.getNetwork();
      if (Number(network.chainId) !== chainId) { setErr(`Switch wallet to ${chain.name} (Chain ID: ${chainId})`); return; }
      const signer = await provider.getSigner();
      const lpWei  = ethers.parseUnits(lpAmount, 18);
      setStatus("approving");
      const lp = new ethers.Contract(pair, ERC20_ABI, signer);
      const allowance: bigint = await lp.allowance(ownerAddress, callbackAddress);
      if (allowance < lpWei) { await (await lp.approve(callbackAddress, lpWei)).wait(1); }
      setStatus("registering");
      const cb = new ethers.Contract(callbackAddress, CALLBACK_ABI, signer);
      const receipt = await (await cb.registerPosition(pair, lpWei, bpsNum)).wait(1);
      setTxHash(receipt.hash);
      setStatus("done");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message.slice(0, 120) : "Transaction failed");
      setStatus("error");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">UNISWAP V2 PAIR ADDRESS</label>
        <input className="input-sentinel" placeholder="0x..." value={pair} onChange={e => { setPair(e.target.value); setUseMax(false); }} />
        {pairLoading && <div className="text-[10px] text-[#555] mt-1">Resolving pair...</div>}
        {pairError   && <div className="text-[10px] text-[#FF2D2D] mt-1">{pairError}</div>}
      </div>
      {pairInfo && (
        <div className="panel panel-active p-4 space-y-0 animate-fade-in">
          <DataRow label="PAIR"            value={`${pairInfo.symbol0} / ${pairInfo.symbol1}`} accent />
          <DataRow label="RESERVE 0"       value={`${formatUnits(pairInfo.reserve0, pairInfo.decimals0, 4)} ${pairInfo.symbol0}`} />
          <DataRow label="RESERVE 1"       value={`${formatUnits(pairInfo.reserve1, pairInfo.decimals1, 4)} ${pairInfo.symbol1}`} />
          <DataRow label="YOUR LP BALANCE" value={
            <span>{formatUnits(pairInfo.userLpBalance, 18, 6)} LP
              <button className="ml-2 text-[#39FF14] text-[10px] hover:underline" onClick={() => setUseMax(v => !v)} disabled={busy}>{useMax ? "CUSTOM" : "MAX"}</button>
            </span>
          } />
        </div>
      )}
      <div>
        <label className="text-[10px] text-[#444] tracking-widest block mb-1.5">LP TOKEN AMOUNT TO PROTECT</label>
        <input className="input-sentinel" placeholder="e.g. 1.0" value={lpAmount} onChange={e => { setLpAmount(e.target.value); setUseMax(false); }} disabled={useMax || busy} />
      </div>
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-[10px] text-[#444] tracking-widest">DIVERGENCE THRESHOLD</label>
          <span className="text-xs font-bold" style={{ color: fillColor }}>{bps} bps ({pctDisplay}%)</span>
        </div>
        <input type="range" min={100} max={9900} step={100} value={bpsNum} onChange={e => setBps(e.target.value)} className="w-full accent-[#39FF14] mb-2" disabled={busy} />
        <div className="divergence-bar mb-2"><div className="divergence-fill" style={{ width: `${barWidth}%`, background: fillColor }} /></div>
        <input className="input-sentinel text-xs" placeholder="Custom bps" value={bps} onChange={e => setBps(e.target.value)} disabled={busy} />
        <div className="flex justify-between text-[10px] text-[#444] mt-1">
          <span>100 bps (1%)</span><span>5000 bps (50%)</span><span>9900 bps (99%)</span>
        </div>
        <div className="mt-2 text-[11px] leading-relaxed" style={{ color: fillColor }}>
          {bpsNum < 500                    && "⚠ Very tight — may trigger on normal volatility"}
          {bpsNum >= 500  && bpsNum < 2000 && "◈ Conservative — good for stable pairs"}
          {bpsNum >= 2000 && bpsNum < 5000 && "◈ Moderate — standard IL protection range"}
          {bpsNum >= 5000 && bpsNum < 8000 && "⚠ Wide — only catches large price moves"}
          {bpsNum >= 8000                  && "⚠ Very wide — minimal protection"}
        </div>
      </div>
      {pairInfo && lpAmount && bpsNum > 0 && (
        <div className="panel p-4 space-y-0 animate-fade-in">
          <SectionLabel>POSITION SUMMARY</SectionLabel>
          <DataRow label="PAIR"      value={`${pairInfo.symbol0}/${pairInfo.symbol1}`} />
          <DataRow label="LP AMOUNT" value={`${parseFloat(lpAmount).toFixed(6)} LP`} />
          <DataRow label="THRESHOLD" value={`${bpsNum} bps (${pctDisplay}%)`} />
          <DataRow label="ENTRY R0"  value={formatUnits(pairInfo.reserve0, pairInfo.decimals0, 4)} />
          <DataRow label="ENTRY R1"  value={formatUnits(pairInfo.reserve1, pairInfo.decimals1, 4)} />
        </div>
      )}
      {err && <div className="border border-[#FF2D2D] p-3 text-[11px] text-[#FF2D2D] break-words">{err}</div>}
      {status === "done" && txHash && (
        <div className="border border-[#39FF14] p-3 text-[11px] text-[#39FF14] space-y-1">
          <div className="font-bold tracking-widest">POSITION REGISTERED</div>
          <a href={explorerTx(chain.explorerUrl, txHash)} target="_blank" rel="noopener noreferrer" className="hover:underline">View on {chain.label}scan →</a>
        </div>
      )}
      {busy && (
        <div className="text-[11px] text-[#FFB800] tracking-widest animate-pulse">
          {status === "approving"   && "⟳ APPROVING LP TOKEN SPEND..."}
          {status === "registering" && "⟳ REGISTERING POSITION ON-CHAIN..."}
        </div>
      )}
      <button className="btn-sentinel w-full text-xs py-3" onClick={handleRegister} disabled={busy || status === "done"}>
        {busy ? "PROCESSING..." : status === "done" ? "REGISTERED ✓" : "APPROVE & REGISTER POSITION →"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "deploy" | "connect";

// Params that get lifted from InputForm → page → ActiveDeployFlow
interface PendingDeploy extends RegistrationParams {
  walletAddress: string;
}

export default function ProtectPage() {
  const { address, isConnected } = useAccount();
  const chainId                  = useChainId();
  const { addresses, loaded, save, clear } = useContractStore(address, chainId);
  const [tab, setTab]           = useState<Tab>("deploy");
  // pendingDeploy: once set, the page switches to full-width flow mode
  const [pendingDeploy, setPendingDeploy] = useState<PendingDeploy | null>(null);
  const chain = getDestinationChain(chainId);

  // Called by ActiveDeployFlow INSIDE its redirect timer
  const handleSaved = (cb: string, rx: string, block: number) => {
    if (!address) return;
    save({ callbackAddress: cb, reactiveAddress: rx, callbackDeployBlock: block });
  };

  const handleFormSubmit = (reg: RegistrationParams) => {
    if (!address) return;
    setPendingDeploy({ ...reg, walletAddress: address });
  };

  if (!isConnected) {
    return (
      <>
        <FaucetBanner />
        <div className="min-h-screen pt-14 flex items-center justify-center px-4">
          <div className="panel p-8 sm:p-10 text-center max-w-sm w-full corner-accent">
            <div className="text-[#39FF14] text-3xl mb-4">◈</div>
            <div className="text-sm font-bold tracking-widest mb-2">WALLET REQUIRED</div>
            <div className="text-xs text-[#555] mb-6 leading-relaxed">Connect your wallet to deploy contracts and register IL protection positions.</div>
            <ConnectButton />
          </div>
        </div>
      </>
    );
  }

  if (!loaded) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center">
        <div className="text-[#444] text-xs tracking-widest animate-pulse">LOADING CONTRACT DATA...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-14 pb-20">
      <FaucetBanner />

      {/* Header */}
      <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="text-[10px] tracking-[0.35em] text-[#39FF14] mb-2">PROTECTION INTERFACE</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#e8e8e8] mb-1">DEPLOY & PROTECT</h1>
          <p className="text-[#555] text-sm">Deploy your personal SENTINEL contracts and register LP positions for automated IL protection.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* ── FULL-WIDTH FLOW MODE (locked until navigation) ── */}
        {pendingDeploy ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-[10px] tracking-widest text-[#39FF14] mb-6">DEPLOYMENT SEQUENCE</div>
            <ActiveDeployFlow params={pendingDeploy} onSaved={handleSaved} />
          </div>
        ) : (
          <>
            {/* Active contracts banner */}
            {addresses && (
              <div className="panel panel-active p-4 mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="text-[10px] tracking-widest text-[#39FF14]">CONTRACTS ACTIVE</div>
                  <div className="text-xs text-[#666] flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-4">
                    <span className="truncate">CALLBACK: <a href={explorerAddr(chain.explorerUrl, addresses.callbackAddress)} target="_blank" rel="noopener noreferrer" className="text-[#e8e8e8] hover:text-[#39FF14] font-mono">{shortAddr(addresses.callbackAddress)}</a></span>
                    <span className="truncate">REACTIVE: <span className="text-[#00F5FF] font-mono">{shortAddr(addresses.reactiveAddress)}</span></span>
                  </div>
                </div>
                <button className="btn-sentinel btn-sentinel-ghost text-xs px-4 py-2 shrink-0" onClick={clear}>DISCONNECT</button>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
              {/* LEFT */}
              <div>
                {!addresses ? (
                  <>
                    <div className="flex border-b border-[#1a1a1a] mb-6">
                      {(["deploy", "connect"] as Tab[]).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                          className={`px-5 py-3 text-xs font-bold tracking-widest transition-colors ${tab === t ? "text-[#39FF14] border-b-2 border-[#39FF14]" : "text-[#444] hover:text-[#888]"}`}>
                          {t === "deploy" ? "DEPLOY NEW" : "CONNECT EXISTING"}
                        </button>
                      ))}
                    </div>
                    {tab === "deploy"
                      ? <InputForm onSubmit={handleFormSubmit} />
                      : <ManualConnectPanel onConnect={(cb, rx, blk) => save({ callbackAddress: cb, reactiveAddress: rx, callbackDeployBlock: blk })} chainId={chainId} />
                    }
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="text-[10px] tracking-widest text-[#39FF14] mb-4">CONTRACT STATUS</div>
                    <div className="panel p-4 sm:p-5 space-y-0">
                      <SectionLabel>CALLBACK CONTRACT — {chain.label}</SectionLabel>
                      <DataRow label="ADDRESS"      value={<a href={explorerAddr(chain.explorerUrl, addresses.callbackAddress)} target="_blank" rel="noopener noreferrer" className="text-[#39FF14] hover:underline font-mono text-[10px] break-all">{addresses.callbackAddress}</a>} />
                      <DataRow label="DEPLOY BLOCK" value={addresses.callbackDeployBlock || "unknown"} />
                      <DataRow label="CHAIN"        value={chain.name} />
                    </div>
                    <div className="panel p-4 sm:p-5 space-y-0">
                      <SectionLabel>REACTIVE CONTRACT — LASNA</SectionLabel>
                      <DataRow label="ADDRESS"  value={<span className="text-[#00F5FF] font-mono text-[10px] break-all">{addresses.reactiveAddress}</span>} />
                      <DataRow label="MONITORS" value="Uniswap V2 Sync events" />
                    </div>
                    <div className="border border-[#1a1a1a] p-3 text-[11px] text-[#555] leading-relaxed">
                      Your contracts are live. Register a new position on the right to begin IL protection.
                      Head to the <a href="/dashboard" className="text-[#39FF14] hover:underline">Dashboard</a> to monitor existing positions.
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT */}
              <div>
                <div className="text-[10px] tracking-widest text-[#39FF14] mb-6">REGISTER POSITION</div>
                {!addresses ? (
                  <div className="panel p-6 sm:p-8 text-center text-[#444] text-xs leading-relaxed">
                    Deploy or connect your contracts first to register an IL protection position.
                  </div>
                ) : (
                  <RegisterPanel callbackAddress={addresses.callbackAddress} chainId={chainId} ownerAddress={address ?? ""} />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}