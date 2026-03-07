"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { enabledDestinationChainIds, DESTINATION_CHAINS } from "@/config/chains.config";

// ── Query client ─────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,   // 15 s — balance / reserve data
      gcTime: 60_000,
      retry: 2,
    },
  },
});

// ── Wagmi / RainbowKit config ─────────────────────────────────────────────────
// We map our chain config to wagmi chain objects.
// For now only Sepolia is active; add more chains in chains.config.ts.

const wagmiConfig = getDefaultConfig({
  appName: "SENTINEL — IL Protection",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "sentinel_dev",
  chains: [sepolia],          // extend this array when adding mainnet/base
  transports: {
    [sepolia.id]: http(DESTINATION_CHAINS[11155111].rpcUrl),
  },
  ssr: true,
});

// ── Custom RainbowKit theme (terminal / retro-futurist palette) ───────────────

const sentinelTheme = darkTheme({
  accentColor: "#39FF14",          // neon green
  accentColorForeground: "#000000",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "none",
});

// Override specific tokens to match SENTINEL branding
const customTheme = {
  ...sentinelTheme,
  colors: {
    ...sentinelTheme.colors,
    modalBackground: "#0a0a0a",
    profileForeground: "#0a0a0a",
    connectButtonBackground: "#0a0a0a",
    connectButtonText: "#39FF14",
    connectButtonInnerBackground: "#111111",
  },
  fonts: {
    body: "'IBM Plex Mono', 'Courier New', monospace",
  },
};

// ── Provider tree ─────────────────────────────────────────────────────────────

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme} coolMode={false}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}