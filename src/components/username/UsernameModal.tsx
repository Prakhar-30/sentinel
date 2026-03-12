// ============================================================
// components/username/UsernameModal.tsx
//
// Shown once after wallet connects if user has no username.
// Has suggestion chips and a manual input with live availability.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Check, Loader2, X } from "lucide-react";
import { useUsername } from "@/hooks/useUsername";

interface Props {
  walletAddress: string;
  onComplete: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  available: "#00ff88",
  taken: "#ff4444",
  invalid: "#ff8c00",
  checking: "#627eea",
  saved: "#00ff88",
  error: "#ff4444",
  saving: "#627eea",
  idle: "#333",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function UsernameModal({ walletAddress, onComplete }: Props) {
  const {
    inputValue,
    setInputValue,
    status,
    errorMsg,
    suggestions,
    checkAvailability,
    saveUsername,
    refreshSuggestions,
  } = useUsername(walletAddress);

  const debouncedInput = useDebounce(inputValue, 500);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-check availability as user types
  useEffect(() => {
    if (debouncedInput && debouncedInput.length >= 3) {
      checkAvailability(debouncedInput);
    }
  }, [debouncedInput, checkAvailability]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = async () => {
    if (status !== "available") return;
    const ok = await saveUsername(inputValue);
    if (ok) {
      setTimeout(onComplete, 600);
    }
  };

  const handleSuggestionClick = (name: string) => {
    setInputValue(name);
    checkAvailability(name);
  };

  const statusColor = STATUS_COLORS[status] ?? "#333";
  const canSave = status === "available";
  const isSaving = status === "saving" || status === "saved";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#080808] border border-[#1a1a1a] font-mono">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#111] px-5 py-4">
          <div>
            <p className="text-[10px] text-[#444] uppercase tracking-widest">
              Identity Protocol
            </p>
            <h2 className="text-sm text-white font-semibold mt-0.5">
              Claim Your Handle
            </h2>
          </div>
          <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
        </div>

        <div className="p-5 space-y-5">
          {/* Suggestions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-[#444] uppercase tracking-widest">
                Suggested Handles
              </p>
              <button
                onClick={refreshSuggestions}
                className="text-[10px] text-[#333] hover:text-[#00ff88] flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={10} />
                Refresh
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestionClick(s)}
                  className={`text-[10px] px-2.5 py-1 border transition-colors ${
                    inputValue === s
                      ? "border-[#00ff88] text-[#00ff88] bg-[#00ff8808]"
                      : "border-[#1a1a1a] text-[#555] hover:border-[#333] hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#111]" />
            <span className="text-[10px] text-[#333]">or enter custom</span>
            <div className="flex-1 h-px bg-[#111]" />
          </div>

          {/* Input */}
          <div className="space-y-1.5">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="your_handle"
                maxLength={20}
                className="w-full bg-[#050505] border px-3 py-2.5 text-sm text-white placeholder:text-[#222] outline-none pr-8 transition-colors"
                style={{ borderColor: inputValue ? statusColor : "#1a1a1a" }}
                onKeyDown={(e) => e.key === "Enter" && canSave && handleSave()}
              />
              {/* Status indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {status === "checking" && (
                  <Loader2 size={12} className="animate-spin text-[#627eea]" />
                )}
                {status === "available" && (
                  <Check size={12} className="text-[#00ff88]" />
                )}
                {(status === "taken" || status === "invalid" || status === "error") && (
                  <X size={12} className="text-red-400" />
                )}
              </div>
            </div>

            {/* Status message */}
            {errorMsg && (
              <p className="text-[10px]" style={{ color: statusColor }}>
                {errorMsg}
              </p>
            )}
            {status === "available" && (
              <p className="text-[10px] text-[#00ff88]">Handle available</p>
            )}

            {/* Rules */}
            <p className="text-[10px] text-[#2a2a2a]">
              3–20 chars · letters, numbers, underscores · no spaces · unique forever
            </p>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="w-full py-2.5 text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: canSave ? "#00ff88" : "#111",
              color: canSave ? "#000" : "#444",
            }}
          >
            {status === "saving" ? "Saving..." : status === "saved" ? "Saved ✓" : "Claim Handle"}
          </button>
        </div>
      </div>
    </div>
  );
}