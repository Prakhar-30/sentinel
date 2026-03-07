"use client";
/**
 * SENTINEL — Contract Deployment Hook
 * Uses ethers.js BrowserProvider with explicit network to avoid getNetwork() hang.
 */

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { CALLBACK_ABI, CALLBACK_BYTECODE, REACTIVE_ABI, REACTIVE_BYTECODE } from "@/config/abis";
import { getDestinationChain, getReactiveChain, DEFAULT_REACTIVE_CHAIN_ID } from "@/config/chains.config";

export type DeployStep =
  | "idle" | "deploying-callback" | "callback-deployed"
  | "switch-to-reactive" | "deploying-reactive" | "complete" | "error";

export interface DeployState {
  step: DeployStep;
  callbackAddress: string;
  reactiveAddress: string;
  callbackDeployBlock: number;
  txHash: string;
  error: string;
  log: string[];
}

const INITIAL: DeployState = {
  step: "idle", callbackAddress: "", reactiveAddress: "",
  callbackDeployBlock: 0, txHash: "", error: "", log: [],
};

export function useDeploy(chainId = 11155111) {
  const [state, setState] = useState<DeployState>(INITIAL);

  const addLog = useCallback((msg: string) =>
    setState(s => ({ ...s, log: [...s.log, `[${new Date().toLocaleTimeString()}] ${msg}`] })), []);

  const setErr = useCallback((msg: string) => {
    setState(s => ({ ...s, step: "error", error: msg }));
    addLog(`✗ Error: ${msg}`);
  }, [addLog]);

  const reset = useCallback(() => setState(INITIAL), []);

  // ── Core: get a signer without calling getNetwork() ───────────────────────
  // We pass the chainId explicitly to BrowserProvider so ethers never needs
  // to call eth_chainId / net_version internally before giving us a signer.

  const getSigner = useCallback(async (expectedChainId: number) => {
    const eth = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
    if (!eth) throw new Error("No wallet detected. Please install MetaMask.");

    // Explicitly request accounts — triggers unlock popup if needed
    const accounts = await eth.request({ method: "eth_accounts" }) as string[];
    if (!accounts || accounts.length === 0) {
      await eth.request({ method: "eth_requestAccounts" });
    }

    // Pass network explicitly — prevents internal eth_chainId hang
    const network = new ethers.Network("unknown", expectedChainId);
    const provider = new ethers.BrowserProvider(eth, network);
    const signer   = await provider.getSigner();
    return { signer, provider };
  }, []);

  // ── Switch chain via wallet ───────────────────────────────────────────────

  const switchChain = useCallback(async (
    chainId: number,
    chainName: string,
    rpcUrl: string,
    explorerUrl: string,
  ) => {
    const eth = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
    if (!eth) throw new Error("No wallet detected.");

    const hexId = "0x" + chainId.toString(16);

    // Try switch first
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
      return;
    } catch (e: unknown) {
      // 4902 = chain not added yet
      const code = (e as { code?: number }).code;
      if (code !== 4902) throw e;
    }

    // Add chain
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: hexId,
        chainName,
        rpcUrls: [rpcUrl],
        nativeCurrency: { name: "lREACT", symbol: "lREACT", decimals: 18 },
        blockExplorerUrls: [explorerUrl],
      }],
    });
  }, []);

  // ── Step A: Deploy Callback on Sepolia ────────────────────────────────────

  const deployCallback = useCallback(async (ownerAddress: string) => {
    if (!CALLBACK_BYTECODE) { setErr("Callback bytecode missing in abis.ts"); return; }

    setState(s => ({ ...s, step: "deploying-callback", error: "" }));
    addLog("Requesting wallet connection...");

    try {
      const chain = getDestinationChain(chainId);

      // Ensure wallet is on Sepolia
      addLog(`Switching to ${chain.name}...`);
      await switchChain(chainId, chain.name, chain.rpcUrl, chain.explorerUrl);
      addLog(`✓ On ${chain.name}`);

      const { signer } = await getSigner(chainId);
      const signerAddr  = await signer.getAddress();
      addLog(`✓ Signer: ${signerAddr}`);
      addLog(`Owner:          ${ownerAddress}`);
      addLog(`Callback proxy: ${chain.callbackProxyAddress}`);
      addLog(`Router:         ${chain.uniswapV2Router}`);
      addLog("Check your wallet — confirm the transaction...");

      const factory  = new ethers.ContractFactory(CALLBACK_ABI, CALLBACK_BYTECODE, signer);
      const contract = await factory.deploy(
        ownerAddress,
        chain.callbackProxyAddress,
        chain.uniswapV2Router,
        { value: ethers.parseEther("0.02") }
      );

      addLog(`Tx sent: ${contract.deploymentTransaction()?.hash}`);
      addLog("Waiting for 1 confirmation...");

      const receipt = await contract.deploymentTransaction()?.wait(1);
      const addr    = await contract.getAddress();

      addLog(`✓ Callback deployed: ${addr}`);
      addLog(`  Block: ${receipt?.blockNumber}`);

      setState(s => ({
        ...s,
        step: "callback-deployed",
        callbackAddress: addr,
        callbackDeployBlock: receipt?.blockNumber ?? 0,
        txHash: receipt?.hash ?? "",
      }));

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied")) {
        setErr("Transaction rejected in wallet.");
      } else {
        setErr(msg.slice(0, 200));
      }
    }
  }, [chainId, getSigner, switchChain, addLog, setErr]);

  // ── Step B: Deploy Reactive on Lasna ─────────────────────────────────────

  const deployReactive = useCallback(async (ownerAddress: string, callbackAddress: string) => {
    if (!REACTIVE_BYTECODE) { setErr("Reactive bytecode missing in abis.ts"); return; }

    setState(s => ({ ...s, step: "deploying-reactive", error: "" }));

    try {
      const rc = getReactiveChain(DEFAULT_REACTIVE_CHAIN_ID);
      addLog(`Switching to ${rc.name} (Chain ID: ${DEFAULT_REACTIVE_CHAIN_ID})...`);

      await switchChain(DEFAULT_REACTIVE_CHAIN_ID, rc.name, rc.rpcUrl, rc.explorerUrl);
      addLog(`✓ On ${rc.name}`);

      const { signer } = await getSigner(DEFAULT_REACTIVE_CHAIN_ID);
      addLog(`✓ Signer on Lasna`);
      addLog(`Owner:    ${ownerAddress}`);
      addLog(`Callback: ${callbackAddress}`);
      addLog("Check your wallet — confirm the transaction...");

      const factory  = new ethers.ContractFactory(REACTIVE_ABI, REACTIVE_BYTECODE, signer);
      const contract = await factory.deploy(
        ownerAddress,
        callbackAddress,
        { value: ethers.parseEther("0.1") }
      );

      addLog(`Tx sent: ${contract.deploymentTransaction()?.hash}`);
      addLog("Waiting for 1 confirmation...");

      const receipt = await contract.deploymentTransaction()?.wait(1);
      const addr    = await contract.getAddress();

      addLog(`✓ Reactive deployed: ${addr}`);
      addLog(`  Block: ${receipt?.blockNumber}`);

      setState(s => ({
        ...s,
        step: "complete",
        reactiveAddress: addr,
        txHash: receipt?.hash ?? "",
      }));

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied")) {
        setErr("Transaction rejected in wallet.");
      } else if (msg.toLowerCase().includes("switch") || msg.toLowerCase().includes("chain")) {
        addLog(`⚠ Chain switch failed: ${msg.slice(0, 100)}`);
        setState(s => ({ ...s, step: "switch-to-reactive" }));
      } else {
        setErr(msg.slice(0, 200));
      }
    }
  }, [getSigner, switchChain, addLog, setErr]);

  const retryReactive = useCallback(async (owner: string, cb: string) => {
    setState(s => ({ ...s, step: "deploying-reactive", error: "" }));
    await deployReactive(owner, cb);
  }, [deployReactive]);

  return { state, deployCallback, deployReactive, retryReactive, reset };
}