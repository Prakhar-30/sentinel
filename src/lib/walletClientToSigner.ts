import { ethers, type JsonRpcSigner } from "ethers";
import type { WalletClient } from "viem";

/**
 * Converts a wagmi/viem WalletClient into an ethers.js JsonRpcSigner.
 * Used by the deployment orchestrator for ContractFactory calls.
 */
export function walletClientToSigner(walletClient: WalletClient): JsonRpcSigner {
  const { account, chain, transport } = walletClient;

  if (!chain)   throw new Error("WalletClient has no chain attached");
  if (!account) throw new Error("WalletClient has no account attached");

  const network = { chainId: chain.id, name: chain.name };
  const provider = new ethers.BrowserProvider(
    transport as ethers.Eip1193Provider,
    network
  );

  return new ethers.JsonRpcSigner(provider, account.address);
}