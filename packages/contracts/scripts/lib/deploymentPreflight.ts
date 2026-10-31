import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { assertDeploymentNetworkConfigured, MST_NETWORKS } from "../../../shared/src/networks";

const NETWORKS = {
  testnet: { chainId: BigInt(MST_NETWORKS.legacyTestnet.chainId), symbol: MST_NETWORKS.legacyTestnet.currencySymbol },
  mainnet: { chainId: BigInt(MST_NETWORKS.mainnet.chainId), symbol: MST_NETWORKS.mainnet.currencySymbol },
} as const;

export async function inspectDeployment(
  hre: HardhatRuntimeEnvironment,
  target: "testnet" | "mainnet"
) {
  if (hre.network.name !== target) {
    throw new Error(`Preflight is restricted to the explicit ${target} network; received ${hre.network.name}.`);
  }
  assertDeploymentNetworkConfigured(target);

  const expectedChainId = NETWORKS[target].chainId;
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== expectedChainId) {
    throw new Error(`Wrong MST ${target} chain ID: expected ${expectedChainId}, received ${network.chainId}.`);
  }

  const [signer] = await hre.ethers.getSigners();
  const deployerAddress = signer ? await signer.getAddress() : undefined;
  const balance = deployerAddress ? await hre.ethers.provider.getBalance(deployerAddress) : undefined;
  const feeData = await hre.ethers.provider.getFeeData();
  const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
  if (feePerGas === null) throw new Error("RPC did not provide a gas price; deployment budget cannot be estimated.");

  const poolFactory = await hre.ethers.getContractFactory("PatchPool");
  const poolRequest = await poolFactory.getDeployTransaction();
  if (!poolRequest.data) throw new Error("PatchPool deployment bytecode is missing from the local compiled artifacts.");

  const estimateSender = deployerAddress ?? "0x0000000000000000000000000000000000000001";
  const patchPoolGas = await hre.ethers.provider.estimateGas({ from: estimateSender, data: poolRequest.data });
  const estimatedBudget = (patchPoolGas * feePerGas * 120n) / 100n;

  if (!signer || !deployerAddress || balance === undefined) {
    return {
      configured: false as const,
      chainId: network.chainId,
      currencySymbol: NETWORKS[target].symbol,
      estimatedBudget,
      feePerGas,
      patchPoolGas,
    };
  }

  return {
    configured: true as const,
    chainId: network.chainId,
    currencySymbol: NETWORKS[target].symbol,
    deployerAddress,
    balance,
    estimatedBudget,
    feePerGas,
    patchPoolGas,
    sufficientBalance: balance >= estimatedBudget,
  };
}
