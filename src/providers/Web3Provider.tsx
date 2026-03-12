"use client";

import { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { defineChain } from "viem";
import { sepolia } from "wagmi/chains";
import { http } from "wagmi";
import { DESTINATION_CHAINS, REACTIVE_CHAINS } from "@/config/chains.config";

// ── Query client ──────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 60_000,
      retry: 2,
    },
  },
});

// ── Define Reactive Lasna as a viem chain ─────────────────────
// This is the key fix — wagmi now natively knows about Lasna,
// so it never shows "wrong network" after switching to it.

const lasnaConfig = REACTIVE_CHAINS[5318007];

export const reactiveLasna = defineChain({
  id: lasnaConfig.chainId,
  name: lasnaConfig.name,
  nativeCurrency: {
    name: lasnaConfig.nativeCurrency,
    symbol: lasnaConfig.nativeCurrency,
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [lasnaConfig.rpcUrl] },
    public:  { http: [lasnaConfig.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "Lasna Explorer",
      url: lasnaConfig.explorerUrl,
    },
  },
  testnet: true,
});

// ── Wagmi / RainbowKit config ─────────────────────────────────

const sepoliaConfig = DESTINATION_CHAINS[11155111];

const wagmiConfig = getDefaultConfig({
  appName: "SENTINEL — IL Protection",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "sentinel_dev",
  chains: [sepolia, reactiveLasna],   // ← Lasna added here
  transports: {
    [sepolia.id]:        http(sepoliaConfig.rpcUrl),
    [reactiveLasna.id]:  http(lasnaConfig.rpcUrl),
  },
  ssr: true,
});

// ── Custom RainbowKit theme ───────────────────────────────────

const sentinelTheme = darkTheme({
  accentColor: "#39FF14",
  accentColorForeground: "#000000",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "none",
});

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

// ── Provider tree ─────────────────────────────────────────────

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