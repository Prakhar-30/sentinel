"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  CALLBACK_ABI, CALLBACK_BYTECODE,
  REACTIVE_ABI, REACTIVE_BYTECODE,
  ERC20_ABI, UNISWAP_V2_PAIR_ABI,
} from "@/config/abis";
import {
  getDestinationChain, getReactiveChain,
  DEFAULT_REACTIVE_CHAIN_ID,
} from "@/config/chains.config";
import { supabase } from "@/lib/supabase";

export type DeployStep =
  | "idle"
  | "deploying-callback"
  | "callback-deployed"
  | "switch-to-reactive"
  | "deploying-reactive"
  | "switching-back"
  | "approving"
  | "registering"
  | "complete"
  | "error";

export interface DeployState {
  step:               DeployStep;
  callbackAddress:    string;
  reactiveAddress:    string;
  callbackDeployBlock: number;
  txHash:             string;
  positionId:         number | null;
  registrationTx:     string;
  error:              string;
  log:                string[];
}

const INITIAL: DeployState = {
  step: "idle", callbackAddress: "", reactiveAddress: "",
  callbackDeployBlock: 0, txHash: "", positionId: null,
  registrationTx: "", error: "", log: [],
};

// ── Registration params (collected upfront) ───────────────────────────────
export interface RegistrationParams {
  pairAddress:  string;
  lpAmount:     string;   // human-readable e.g. "1.0"
  thresholdBps: number;
}

export function useDeploy(chainId = 11155111) {
  const [state, setState] = useState<DeployState>(INITIAL);

  const addLog = useCallback((msg: string) =>
    setState(s => ({ ...s, log: [...s.log, `[${new Date().toLocaleTimeString()}] ${msg}`] })), []);

  const addNextHint = useCallback((hint: string) =>
    setState(s => ({ ...s, log: [...s.log, `NEXT: ${hint}`] })), []);

  const setErr = useCallback((msg: string) => {
    setState(s => ({ ...s, step: "error", error: msg }));
    addLog(`✗ Error: ${msg}`);
  }, [addLog]);

  const reset = useCallback(() => setState(INITIAL), []);

  // ── Get signer without calling getNetwork() ───────────────────────────
  const getSigner = useCallback(async (expectedChainId: number) => {
    const eth = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
    if (!eth) throw new Error("No wallet detected. Please install MetaMask.");
    const accounts = await eth.request({ method: "eth_accounts" }) as string[];
    if (!accounts || accounts.length === 0) {
      await eth.request({ method: "eth_requestAccounts" });
    }
    const network  = new ethers.Network("unknown", expectedChainId);
    const provider = new ethers.BrowserProvider(eth, network);
    const signer   = await provider.getSigner();
    return { signer, provider };
  }, []);

  // ── Switch chain ──────────────────────────────────────────────────────
  const switchChain = useCallback(async (
    targetChainId: number,
    chainName: string,
    rpcUrl: string,
    explorerUrl: string,
    nativeCurrency = "ETH",
  ) => {
    const eth = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
    if (!eth) throw new Error("No wallet detected.");
    const hexId = "0x" + targetChainId.toString(16);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
      return;
    } catch (e: unknown) {
      if ((e as { code?: number }).code !== 4902) throw e;
    }
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: hexId, chainName, rpcUrls: [rpcUrl],
        nativeCurrency: { name: nativeCurrency, symbol: nativeCurrency, decimals: 18 },
        blockExplorerUrls: [explorerUrl],
      }],
    });
  }, []);

  // ── Wait until wallet reports target chain ────────────────────────────
  const waitForChain = useCallback((targetChainId: number, timeoutMs = 20000): Promise<boolean> => {
    return new Promise(resolve => {
      const eth = (window as unknown as { ethereum?: { request: (a: unknown) => Promise<unknown> } }).ethereum;
      const start = Date.now();
      const iv = setInterval(async () => {
        try {
          const hex = await eth?.request({ method: "eth_chainId" }) as string;
          if (parseInt(hex, 16) === targetChainId) { clearInterval(iv); resolve(true); }
        } catch { /* keep polling */ }
        if (Date.now() - start > timeoutMs) { clearInterval(iv); resolve(false); }
      }, 400);
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // FULL ORCHESTRATED DEPLOY
  // Runs all steps automatically including approve + register.
  // Adds "NEXT:" hints after each step so the UI can show what comes next.
  // ─────────────────────────────────────────────────────────────────────

  const deployAll = useCallback(async (
    ownerAddress: string,
    reg: RegistrationParams,
  ) => {
    if (!CALLBACK_BYTECODE) { setErr("Callback bytecode missing in abis.ts"); return; }
    if (!REACTIVE_BYTECODE) { setErr("Reactive bytecode missing in abis.ts"); return; }

    setState(s => ({ ...s, step: "deploying-callback", error: "", log: [] }));

    try {
      const destChain = getDestinationChain(chainId);
      const rc        = getReactiveChain(DEFAULT_REACTIVE_CHAIN_ID);

      // ── Step 1: Deploy Callback on Sepolia ─────────────────────────
      addLog(`Switching to ${destChain.name}...`);
      await switchChain(chainId, destChain.name, destChain.rpcUrl, destChain.explorerUrl);
      await waitForChain(chainId);
      addLog(`✓ On ${destChain.name}`);
      addLog("Deploying Callback contract — confirm in wallet...");

      const { signer: s1 } = await getSigner(chainId);

      const cbFactory  = new ethers.ContractFactory(CALLBACK_ABI, CALLBACK_BYTECODE, s1);
      const cbContract = await cbFactory.deploy(
        ownerAddress,
        destChain.callbackProxyAddress,
        destChain.uniswapV2Router,
        { value: ethers.parseEther("0.02") }
      );
      addLog(`Tx sent: ${cbContract.deploymentTransaction()?.hash}`);
      addLog("Waiting for confirmation...");

      const cbReceipt = await cbContract.deploymentTransaction()?.wait(1);
      const callbackAddress = await cbContract.getAddress();
      const callbackDeployBlock = cbReceipt?.blockNumber ?? 0;

      addLog(`✓ Callback deployed: ${callbackAddress}`);
      addNextHint("Switch to Reactive Lasna testnet");
      setState(s => ({
        ...s,
        step: "switch-to-reactive",
        callbackAddress,
        callbackDeployBlock,
        txHash: cbReceipt?.hash ?? "",
      }));

      // ── Step 2: Switch to Reactive Lasna ──────────────────────────
      setState(s => ({ ...s, step: "deploying-reactive" }));
      addLog(`Switching to ${rc.name}...`);
      await switchChain(DEFAULT_REACTIVE_CHAIN_ID, rc.name, rc.rpcUrl, rc.explorerUrl, rc.nativeCurrency);
      await waitForChain(DEFAULT_REACTIVE_CHAIN_ID, 25000);
      addLog(`✓ On ${rc.name}`);
      addLog("Deploying Reactive contract — confirm in wallet...");
      addNextHint("Return to Sepolia after reactive contract deploys");

      // ── Step 3: Deploy Reactive on Lasna ──────────────────────────
      const { signer: s2 } = await getSigner(DEFAULT_REACTIVE_CHAIN_ID);

      const rxFactory  = new ethers.ContractFactory(REACTIVE_ABI, REACTIVE_BYTECODE, s2);
      const rxContract = await rxFactory.deploy(
        ownerAddress,
        callbackAddress,
        { value: ethers.parseEther("0.1") }
      );
      addLog(`Tx sent: ${rxContract.deploymentTransaction()?.hash}`);
      addLog("Waiting for confirmation...");

      const rxReceipt = await rxContract.deploymentTransaction()?.wait(1);
      const reactiveAddress = await rxContract.getAddress();

      addLog(`✓ Reactive deployed: ${reactiveAddress}`);
      addNextHint("Approve LP token spend on Sepolia");
      setState(s => ({ ...s, reactiveAddress }));

      // ── Step 4: Switch back to Sepolia ─────────────────────────────
      setState(s => ({ ...s, step: "switching-back" }));
      addLog(`Returning to ${destChain.name}...`);
      await switchChain(chainId, destChain.name, destChain.rpcUrl, destChain.explorerUrl);
      await waitForChain(chainId, 25000);
      addLog(`✓ Back on ${destChain.name}`);

      // ── Step 5: Approve LP tokens ──────────────────────────────────
      setState(s => ({ ...s, step: "approving" }));
      const { signer: s3 } = await getSigner(chainId);

      addLog("Fetching pair info...");
      const pairContract = new ethers.Contract(reg.pairAddress, UNISWAP_V2_PAIR_ABI, s3);
      const [token0, token1, reserves] = await Promise.all([
        pairContract.token0() as Promise<string>,
        pairContract.token1() as Promise<string>,
        pairContract.getReserves() as Promise<[bigint, bigint, number]>,
      ]);

      const lpWei = ethers.parseEther(reg.lpAmount);
      addLog("Checking LP token allowance...");
      const lpToken   = new ethers.Contract(reg.pairAddress, ERC20_ABI, s3);
      const allowance = await lpToken.allowance(ownerAddress, callbackAddress) as bigint;

      if (allowance < lpWei) {
        addLog("Approving LP token spend — confirm in wallet...");
        addNextHint("Register your position on-chain");
        const approveTx = await lpToken.approve(callbackAddress, lpWei);
        await approveTx.wait(1);
        addLog("✓ LP tokens approved");
      } else {
        addLog("✓ LP allowance already sufficient");
      }

      // ── Step 6: Register position ──────────────────────────────────
      setState(s => ({ ...s, step: "registering" }));
      addLog("Registering position — confirm in wallet...");
      addNextHint("All done — redirecting to Dashboard");

      const cbInstance = new ethers.Contract(callbackAddress, CALLBACK_ABI, s3);
      const regTx      = await cbInstance.registerPosition(reg.pairAddress, lpWei, reg.thresholdBps);
      addLog(`Tx sent: ${regTx.hash}`);
      const regReceipt = await regTx.wait(1);
      addLog(`✓ Position registered — tx: ${regReceipt.hash}`);

      // Parse positionId from event
      const iface = new ethers.Interface(CALLBACK_ABI);
      let positionId = 0;
      for (const log of regReceipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === "PositionRegistered") {
            positionId = Number(parsed.args.positionId);
            break;
          }
        } catch { /* skip */ }
      }

      addLog(`✓ Position ID: #${positionId}`);

      // ── Save to Supabase ───────────────────────────────────────────
      await Promise.all([
        supabase.from("contracts").insert({
          wallet_address:        ownerAddress.toLowerCase(),
          chain_id:              chainId,
          callback_address:      callbackAddress.toLowerCase(),
          reactive_address:      reactiveAddress.toLowerCase(),
          callback_deploy_block: callbackDeployBlock,
          created_at:            new Date().toISOString(),
          updated_at:            new Date().toISOString(),
        }),
        supabase.from("positions").insert({
          position_id:              positionId,
          callback_address:         callbackAddress.toLowerCase(),
          wallet_address:           ownerAddress.toLowerCase(),
          chain_id:                 chainId,
          pair:                     reg.pairAddress.toLowerCase(),
          token0:                   token0.toLowerCase(),
          token1:                   token1.toLowerCase(),
          pair_symbol:              null,
          lp_amount:                reg.lpAmount,
          entry_reserve0:           reserves[0].toString(),
          entry_reserve1:           reserves[1].toString(),
          divergence_threshold_bps: reg.thresholdBps,
          status:                   "Active",
          registered_tx_hash:       regReceipt.hash,
          registered_block:         regReceipt.blockNumber,
          registered_at:            new Date().toISOString(),
          created_at:               new Date().toISOString(),
          updated_at:               new Date().toISOString(),
        }),
      ]);

      addLog("✓ Saved to database");
      addLog("✓ SENTINEL ACTIVE — Redirecting to dashboard...");

      setState(s => ({
        ...s,
        step:           "complete",
        positionId,
        registrationTx: regReceipt.hash,
      }));

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied")) {
        setErr("Transaction rejected in wallet.");
      } else if (msg.toLowerCase().includes("switch") || msg.toLowerCase().includes("chain")) {
        setState(s => ({ ...s, step: "switch-to-reactive" }));
        addLog(`⚠ Chain switch issue: ${msg.slice(0, 100)}`);
      } else {
        setErr(msg.slice(0, 200));
      }
    }
  }, [chainId, getSigner, switchChain, waitForChain, addLog, addNextHint, setErr]);

  // Keep legacy separate methods for backward compat with ManualConnectPanel
  const deployCallback = useCallback(async (ownerAddress: string) => {
    if (!CALLBACK_BYTECODE) { setErr("Callback bytecode missing"); return; }
    setState(s => ({ ...s, step: "deploying-callback", error: "" }));
    try {
      const chain = getDestinationChain(chainId);
      addLog(`Switching to ${chain.name}...`);
      await switchChain(chainId, chain.name, chain.rpcUrl, chain.explorerUrl);
      const { signer } = await getSigner(chainId);
      addLog("Deploying Callback — confirm in wallet...");
      const factory  = new ethers.ContractFactory(CALLBACK_ABI, CALLBACK_BYTECODE, signer);
      const contract = await factory.deploy(ownerAddress, chain.callbackProxyAddress, chain.uniswapV2Router, { value: ethers.parseEther("0.02") });
      addLog(`Tx: ${contract.deploymentTransaction()?.hash}`);
      const receipt = await contract.deploymentTransaction()?.wait(1);
      const addr    = await contract.getAddress();
      addLog(`✓ Callback: ${addr}`);
      setState(s => ({ ...s, step: "callback-deployed", callbackAddress: addr, callbackDeployBlock: receipt?.blockNumber ?? 0, txHash: receipt?.hash ?? "" }));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message.slice(0, 200) : String(e));
    }
  }, [chainId, getSigner, switchChain, addLog, setErr]);

  const deployReactive = useCallback(async (ownerAddress: string, callbackAddress: string) => {
    if (!REACTIVE_BYTECODE) { setErr("Reactive bytecode missing"); return; }
    setState(s => ({ ...s, step: "deploying-reactive", error: "" }));
    try {
      const rc = getReactiveChain(DEFAULT_REACTIVE_CHAIN_ID);
      addLog(`Switching to ${rc.name}...`);
      await switchChain(DEFAULT_REACTIVE_CHAIN_ID, rc.name, rc.rpcUrl, rc.explorerUrl, rc.nativeCurrency);
      const { signer } = await getSigner(DEFAULT_REACTIVE_CHAIN_ID);
      addLog("Deploying Reactive — confirm in wallet...");
      const factory  = new ethers.ContractFactory(REACTIVE_ABI, REACTIVE_BYTECODE, signer);
      const contract = await factory.deploy(ownerAddress, callbackAddress, { value: ethers.parseEther("0.1") });
      addLog(`Tx: ${contract.deploymentTransaction()?.hash}`);
      const receipt = await contract.deploymentTransaction()?.wait(1);
      const addr    = await contract.getAddress();
      addLog(`✓ Reactive: ${addr}`);
      setState(s => ({ ...s, step: "complete", reactiveAddress: addr, txHash: receipt?.hash ?? "" }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("switch") || msg.includes("chain")) {
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

  return { state, deployAll, deployCallback, deployReactive, retryReactive, reset };
}