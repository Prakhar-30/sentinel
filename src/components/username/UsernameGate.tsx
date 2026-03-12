// ============================================================
// components/username/UsernameGate.tsx
//
// Wraps child components. When a wallet connects and the user
// has no username yet, shows the UsernameModal.
// Once they set one (or skip), proceeds normally.
// ============================================================

"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { UsernameModal } from "./UsernameModal";
import { useUsername } from "@/hooks/useUsername";

interface Props {
  children: React.ReactNode;
}

export function UsernameGate({ children }: Props) {
  const { address, isConnected } = useAccount();
  const { hasUsername, isLoading } = useUsername(address);
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show modal only when: connected + not loading + no username + not dismissed
    if (isConnected && !isLoading && !hasUsername && !dismissed) {
      // Small delay so wallet animation can settle
      const t = setTimeout(() => setShowModal(true), 800);
      return () => clearTimeout(t);
    } else {
      setShowModal(false);
    }
  }, [isConnected, isLoading, hasUsername, dismissed]);

  // Reset dismissed flag if wallet disconnects
  useEffect(() => {
    if (!isConnected) setDismissed(false);
  }, [isConnected]);

  return (
    <>
      {children}
      {showModal && address && (
        <UsernameModal
          walletAddress={address}
          onComplete={() => {
            setShowModal(false);
            setDismissed(true);
          }}
        />
      )}
    </>
  );
}