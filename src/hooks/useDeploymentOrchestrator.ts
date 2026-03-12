import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWalletClient } from "wagmi";
import { CALLBACK_ABI, CALLBACK_BYTECODE, REACTIVE_ABI, REACTIVE_BYTECODE, UNISWAP_V2_PAIR_ABI } from "@/config/abis";
import {
  DESTINATION_CHAINS,
  REACTIVE_CHAINS,
  DEFAULT_DESTINATION_CHAIN_ID,
  DEFAULT_REACTIVE_CHAIN_ID,
} from "@/config/chains.config";
import { useNetworkSwitcher } from "./useNetworkSwitcher";
import { walletClientToSigner } from "@/lib/walletClientToSigner";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────

export type StepStatus = "pending" | "active" | "done" | "error";

export interface DeployStep {
  id: string;
  label: string;
  sublabel: string;
  chain: "Sepolia" | "Lasna";
  status: StepStatus;
}

export interface DeployParams {
  pairAddress: string;
  lpAmount: string;       // human readable e.g. "1.5"
  thresholdBps: number;   // e.g. 2000 = 20%
  sentinelType: string;
  walletAddress: string;
}

export interface DeployResult {
  callbackAddress: string;
  reactiveAddress: string;
  positionId: number;
  registrationTxHash: string;
}

const INITIAL_STEPS: DeployStep[] = [
  {
    id: "deploy_callback",
    label: "Deploy Callback Contract",
    sublabel: "Deploying on Ethereum Sepolia",
    chain: "Sepolia",
    status: "pending",
  },
  {
    id: "switch_reactive",
    label: "Switch to Reactive Lasna",
    sublabel: "Changing network in wallet",
    chain: "Lasna",
    status: "pending",
  },
  {
    id: "deploy_reactive",
    label: "Deploy Reactive Contract",
    sublabel: "Deploying on Reactive Lasna",
    chain: "Lasna",
    status: "pending",
  },
  {
    id: "switch_sepolia",
    label: "Return to Sepolia",
    sublabel: "Switching back for registration",
    chain: "Sepolia",
    status: "pending",
  },
  {
    id: "register_position",
    label: "Register Position",
    sublabel: "Locking in your IL protection",
    chain: "Sepolia",
    status: "pending",
  },
];

// ── Hook ───────────────────────────────────────────────────────

export function useDeploymentOrchestrator() {
  const [steps, setSteps]         = useState<DeployStep[]>(INITIAL_STEPS);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<DeployResult | null>(null);
  const [progressMsg, setProgressMsg] = useState("");

  const { data: walletClient } = useWalletClient();
  const { switchToSepolia, switchToLasna, waitForChain } = useNetworkSwitcher();

  const setStepStatus = (id: string, status: StepStatus) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));

  const progress = (msg: string) => setProgressMsg(msg);

  const sepolia = DESTINATION_CHAINS[DEFAULT_DESTINATION_CHAIN_ID];

  const deploy = useCallback(
    async (params: DeployParams): Promise<DeployResult | null> => {
      if (!walletClient) { setError("Wallet not connected"); return null; }

      setIsDeploying(true);
      setError(null);
      setResult(null);
      setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending" })));

      try {
        // ── Step 1: Deploy Callback on Sepolia ─────────────────
        setStepStatus("deploy_callback", "active");
        progress("Switching to Sepolia...");

        const onSepolia = await switchToSepolia();
        if (!onSepolia) throw new Error("Failed to switch to Sepolia");
        await waitForChain(DEFAULT_DESTINATION_CHAIN_ID);

        progress("Deploying Callback contract on Sepolia...");

        if (!CALLBACK_BYTECODE) throw new Error("Callback bytecode missing — check NEXT_PUBLIC_CALLBACK_BYTECODE in .env");

        const signer1 = walletClientToSigner(walletClient);
        const CallbackFactory = new ethers.ContractFactory(
          CALLBACK_ABI as ethers.InterfaceAbi,
          CALLBACK_BYTECODE,
          signer1
        );

        const callbackContract = await CallbackFactory.deploy(
          params.walletAddress,
          sepolia.callbackProxyAddress,
          sepolia.uniswapV2Router,
          { value: ethers.parseEther("0.02") }
        );
        await callbackContract.waitForDeployment();
        const callbackAddress = await callbackContract.getAddress();
        const callbackReceipt = await signer1.provider.getTransactionReceipt(
          callbackContract.deploymentTransaction()!.hash
        );
        const callbackDeployBlock = callbackReceipt?.blockNumber ?? 0;

        setStepStatus("deploy_callback", "done");
        progress(`Callback deployed: ${callbackAddress.slice(0, 10)}...`);

        // ── Step 2: Switch to Reactive Lasna ──────────────────
        setStepStatus("switch_reactive", "active");
        progress("Switching to Reactive Lasna...");

        const onLasna = await switchToLasna();
        if (!onLasna) throw new Error("Failed to switch to Reactive Lasna");
        await waitForChain(DEFAULT_REACTIVE_CHAIN_ID, 25000);

        setStepStatus("switch_reactive", "done");

        // ── Step 3: Deploy Reactive on Lasna ──────────────────
        setStepStatus("deploy_reactive", "active");
        progress("Deploying Reactive contract on Lasna...");

        if (!REACTIVE_BYTECODE) throw new Error("Reactive bytecode missing — check NEXT_PUBLIC_REACTIVE_BYTECODE in .env");

        const signer2 = walletClientToSigner(walletClient);
        const ReactiveFactory = new ethers.ContractFactory(
          REACTIVE_ABI as ethers.InterfaceAbi,
          REACTIVE_BYTECODE,
          signer2
        );

        const reactiveContract = await ReactiveFactory.deploy(
          params.walletAddress,
          callbackAddress,
          { value: ethers.parseEther("0.1") }
        );
        await reactiveContract.waitForDeployment();
        const reactiveAddress = await reactiveContract.getAddress();

        setStepStatus("deploy_reactive", "done");
        progress(`Reactive deployed: ${reactiveAddress.slice(0, 10)}...`);

        // ── Step 4: Switch back to Sepolia ────────────────────
        setStepStatus("switch_sepolia", "active");
        progress("Returning to Ethereum Sepolia...");

        const backOnSepolia = await switchToSepolia();
        if (!backOnSepolia) throw new Error("Failed to switch back to Sepolia");
        await waitForChain(DEFAULT_DESTINATION_CHAIN_ID, 25000);

        setStepStatus("switch_sepolia", "done");

        // ── Step 5: Register Position ─────────────────────────
        setStepStatus("register_position", "active");
        progress("Registering your sentinel position...");

        const signer3 = walletClientToSigner(walletClient);

        // Fetch pair data (token0, token1, reserves) before registering
        const pairContract = new ethers.Contract(
          params.pairAddress,
          UNISWAP_V2_PAIR_ABI as ethers.InterfaceAbi,
          signer3
        );
        const [token0, token1, reserves] = await Promise.all([
          pairContract.token0() as Promise<string>,
          pairContract.token1() as Promise<string>,
          pairContract.getReserves() as Promise<[bigint, bigint, number]>,
        ]);

        const callbackInstance = new ethers.Contract(
          callbackAddress,
          CALLBACK_ABI as ethers.InterfaceAbi,
          signer3
        );

        const lpWei = ethers.parseEther(params.lpAmount);
        const tx = await callbackInstance.registerPosition(
          params.pairAddress,
          lpWei,
          params.thresholdBps
        );
        const receipt = await tx.wait();

        // Parse positionId from PositionRegistered event
        const iface = new ethers.Interface(CALLBACK_ABI as ethers.InterfaceAbi);
        let positionId = 0;
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed?.name === "PositionRegistered") {
              positionId = Number(parsed.args.positionId);
              break;
            }
          } catch { /* skip non-matching logs */ }
        }

        setStepStatus("register_position", "done");
        progress("Sentinel active. Your LP position is now protected.");

        // ── Save to Supabase: contracts table ──────────────────
        await supabase.from("contracts").insert({
          wallet_address:        params.walletAddress.toLowerCase(),
          chain_id:              DEFAULT_DESTINATION_CHAIN_ID,
          callback_address:      callbackAddress.toLowerCase(),
          reactive_address:      reactiveAddress.toLowerCase(),
          callback_deploy_block: callbackDeployBlock,
          created_at:            new Date().toISOString(),
          updated_at:            new Date().toISOString(),
        });

        // ── Save to Supabase: positions table ──────────────────
        await supabase.from("positions").insert({
          position_id:              positionId,
          callback_address:         callbackAddress.toLowerCase(),
          wallet_address:           params.walletAddress.toLowerCase(),
          chain_id:                 DEFAULT_DESTINATION_CHAIN_ID,
          pair:                     params.pairAddress.toLowerCase(),
          token0:                   token0.toLowerCase(),
          token1:                   token1.toLowerCase(),
          pair_symbol:              null,  // can be enriched later
          lp_amount:                params.lpAmount,
          entry_reserve0:           reserves[0].toString(),
          entry_reserve1:           reserves[1].toString(),
          divergence_threshold_bps: params.thresholdBps,
          status:                   "Active",
          registered_tx_hash:       receipt.hash,
          registered_block:         receipt.blockNumber,
          registered_at:            new Date().toISOString(),
          created_at:               new Date().toISOString(),
          updated_at:               new Date().toISOString(),
        });

        const deployResult: DeployResult = {
          callbackAddress,
          reactiveAddress,
          positionId,
          registrationTxHash: receipt.hash,
        };

        setResult(deployResult);
        return deployResult;

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setSteps((prev) =>
          prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s))
        );
        progress(`Error: ${msg}`);
        return null;
      } finally {
        setIsDeploying(false);
      }
    },
    [walletClient, switchToSepolia, switchToLasna, waitForChain, sepolia]
  );

  const reset = () => {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending" })));
    setError(null);
    setResult(null);
    setProgressMsg("");
    setIsDeploying(false);
  };

  const doneCount   = steps.filter((s) => s.status === "done").length;
  const progressPct = Math.round((doneCount / steps.length) * 100);

  return { steps, isDeploying, error, result, progressMsg, progressPct, deploy, reset };
}