/**
 * SENTINEL — Chain Configuration
 *
 * To add a new chain in the future:
 * 1. Add a new entry to SUPPORTED_CHAINS
 * 2. Add the corresponding ABI references in abis.ts if contracts differ
 * 3. Update DEFAULT_CHAIN_ID if needed
 * That's it — all hooks and UI read from this file.
 */

export interface ChainConfig {
  /** Chain ID used by wagmi / ethers */
  chainId: number;
  /** Human-readable name */
  name: string;
  /** Short label shown in UI badges */
  label: string;
  /** Public JSON-RPC endpoint */
  rpcUrl: string;
  /** Block explorer base URL (no trailing slash) */
  explorerUrl: string;
  /** Native currency symbol */
  nativeCurrency: string;
  /** Address of the Reactive Network callback proxy on this chain */
  callbackProxyAddress: string;
  /** Uniswap V2 Router address on this chain */
  uniswapV2Router: string;
  /** Uniswap V2 Factory address on this chain */
  uniswapV2Factory: string;
  /** Block from which to start scanning events (set to contract deploy block for efficiency) */
  startBlock: number;
  /** How many blocks to scan per batch when fetching history */
  eventScanBatchSize: number;
  /** Is this a testnet? Controls UI warnings */
  isTestnet: boolean;
}

export interface ReactiveChainConfig {
  chainId: number;
  name: string;
  label: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: string;
  isTestnet: boolean;
}

// ---------------------------------------------------------------------------
// Destination chains (where the Callback contract lives)
// ---------------------------------------------------------------------------

export const DESTINATION_CHAINS: Record<number, ChainConfig> = {
  // ── Ethereum Sepolia (current launch target) ─────────────────────────────
  11155111: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    label: "Sepolia",
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC ?? "https://eth-sepolia.g.alchemy.com/v2/QnTJicdL-OSJilaE2y4wVXLy_XuFKmJB",
    explorerUrl: "https://sepolia.etherscan.io",
    nativeCurrency: "ETH",
    callbackProxyAddress: "0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA",
    uniswapV2Router: "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008",
    uniswapV2Factory: "0x7E0987E5b3a30e3f2828572Bb659A548460a3003",
    startBlock: 7000000, // update to actual callback deploy block
    eventScanBatchSize: 2000,
    isTestnet: true,
  },

  // ── [FUTURE] Ethereum Mainnet ─────────────────────────────────────────────
  // 1: {
  //   chainId: 1,
  //   name: "Ethereum Mainnet",
  //   label: "Mainnet",
  //   rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
  //   explorerUrl: "https://etherscan.io",
  //   nativeCurrency: "ETH",
  //   callbackProxyAddress: "0x...",
  //   uniswapV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  //   uniswapV2Factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  //   startBlock: 0,
  //   eventScanBatchSize: 2000,
  //   isTestnet: false,
  // },

  // ── [FUTURE] Base ─────────────────────────────────────────────────────────
  // 8453: {
  //   chainId: 8453,
  //   name: "Base",
  //   label: "Base",
  //   rpcUrl: "https://mainnet.base.org",
  //   explorerUrl: "https://basescan.org",
  //   nativeCurrency: "ETH",
  //   callbackProxyAddress: "0x...",
  //   uniswapV2Router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
  //   uniswapV2Factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
  //   startBlock: 0,
  //   eventScanBatchSize: 2000,
  //   isTestnet: false,
  // },
};

// ---------------------------------------------------------------------------
// Reactive chains (where the Reactive contract lives)
// ---------------------------------------------------------------------------

export const REACTIVE_CHAINS: Record<number, ReactiveChainConfig> = {
  // ── Reactive Lasna Testnet ────────────────────────────────────────────────
  5318007: {
    chainId: 5318007,
    name: "Reactive Lasna",
    label: "Lasna",
    rpcUrl: "https://lasna-rpc.rnk.dev/",
    explorerUrl: "https://lasna.reactscan.net",
    nativeCurrency: "lREACT",
    isTestnet: true,
  },

  // ── [FUTURE] Reactive Mainnet ─────────────────────────────────────────────
  // Add when Reactive Network launches mainnet
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_DESTINATION_CHAIN_ID = 11155111;
export const DEFAULT_REACTIVE_CHAIN_ID = 5318007;

export const getDestinationChain = (chainId?: number): ChainConfig =>
  DESTINATION_CHAINS[chainId ?? DEFAULT_DESTINATION_CHAIN_ID] ??
  DESTINATION_CHAINS[DEFAULT_DESTINATION_CHAIN_ID];

export const getReactiveChain = (chainId?: number): ReactiveChainConfig =>
  REACTIVE_CHAINS[chainId ?? DEFAULT_REACTIVE_CHAIN_ID] ??
  REACTIVE_CHAINS[DEFAULT_REACTIVE_CHAIN_ID];

/** All destination chain IDs currently enabled */
export const enabledDestinationChainIds = Object.keys(DESTINATION_CHAINS).map(Number);