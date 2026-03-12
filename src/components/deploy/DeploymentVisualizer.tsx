// ============================================================
// components/deploy/DeploymentVisualizer.tsx
//
// Shows the 5-step deployment pipeline above the form and a
// Uniswap-style progress bar pinned to the bottom of the page.
// ============================================================

"use client";

import React from "react";
import { Check, Loader2, AlertCircle, Circle } from "lucide-react";
import type { DeployStep } from "@/hooks/useDeploymentOrchestrator";

interface Props {
  steps: DeployStep[];
  progressMsg: string;
  progressPct: number;
  isDeploying: boolean;
}

const CHAIN_COLORS: Record<string, string> = {
  Sepolia: "#627eea",
  Lasna: "#ff6b35",
};

function StepIcon({ status }: { status: DeployStep["status"] }) {
  switch (status) {
    case "done":
      return (
        <span className="w-7 h-7 rounded-full bg-[#00ff88] flex items-center justify-center">
          <Check size={14} className="text-black font-bold" />
        </span>
      );
    case "active":
      return (
        <span className="w-7 h-7 rounded-full border-2 border-[#00ff88] flex items-center justify-center">
          <Loader2 size={14} className="text-[#00ff88] animate-spin" />
        </span>
      );
    case "error":
      return (
        <span className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
          <AlertCircle size={14} className="text-white" />
        </span>
      );
    default:
      return (
        <span className="w-7 h-7 rounded-full border-2 border-[#2a2a2a] flex items-center justify-center">
          <Circle size={10} className="text-[#444]" />
        </span>
      );
  }
}

export function DeploymentVisualizer({
  steps,
  progressMsg,
  progressPct,
  isDeploying,
}: Props) {
  if (!isDeploying && progressPct === 0) return null;

  return (
    <>
      {/* ── Step pipeline ───────────────────────────────────── */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] rounded-sm p-4 mb-6 font-mono">
        <p className="text-[10px] text-[#444] uppercase tracking-widest mb-4">
          Deployment Pipeline
        </p>

        <div className="flex items-start gap-0">
          {steps.map((step, i) => (
            <React.Fragment key={step.id}>
              {/* Step node */}
              <div className="flex flex-col items-center min-w-[100px] max-w-[120px]">
                <StepIcon status={step.status} />
                <p
                  className={`text-[10px] text-center mt-2 leading-tight ${
                    step.status === "active"
                      ? "text-[#00ff88]"
                      : step.status === "done"
                      ? "text-white"
                      : step.status === "error"
                      ? "text-red-400"
                      : "text-[#444]"
                  }`}
                >
                  {step.label}
                </p>
                <span
                  className="text-[8px] mt-1 px-1.5 py-0.5 rounded-sm"
                  style={{
                    backgroundColor:
                      (CHAIN_COLORS[step.chain] ?? "#333") + "22",
                    color: CHAIN_COLORS[step.chain] ?? "#555",
                    border: `1px solid ${CHAIN_COLORS[step.chain] ?? "#333"}44`,
                  }}
                >
                  {step.chain}
                </span>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  className="flex-1 h-[2px] mt-3.5 mx-1 transition-colors duration-500"
                  style={{
                    backgroundColor:
                      steps[i].status === "done" ? "#00ff88" : "#1a1a1a",
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Bottom progress bar (Uniswap-style) ─────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#050505] border-t border-[#1a1a1a]">
        {/* Fill bar */}
        <div
          className="h-[2px] bg-[#00ff88] transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
        {/* Message row */}
        <div className="flex items-center gap-3 px-5 py-3">
          {isDeploying && progressPct < 100 && (
            <Loader2 size={14} className="text-[#00ff88] animate-spin shrink-0" />
          )}
          {progressPct === 100 && (
            <Check size={14} className="text-[#00ff88] shrink-0" />
          )}
          <span className="text-[11px] font-mono text-[#888]">
            {progressMsg}
          </span>
          <span className="ml-auto text-[11px] font-mono text-[#444]">
            {progressPct}%
          </span>
        </div>
      </div>
    </>
  );
}