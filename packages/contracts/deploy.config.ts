import type { HardhatRuntimeEnvironment } from "hardhat/types";

async function deploymentRecord(contract: any) {
  const transaction = contract.deploymentTransaction();
  if (!transaction) throw new Error("PatchPool deployment transaction is missing from the contract response.");
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`PatchPool deployment transaction ${transaction.hash} did not succeed.`);

  return {
    address: await contract.getAddress(),
    constructorArguments: [],
    deploymentTransactionHash: transaction.hash,
    deploymentBlock: receipt.blockNumber,
  };
}

export async function deployPatchPool(hre: HardhatRuntimeEnvironment) {
  const PatchPool = await hre.ethers.getContractFactory("PatchPool");
  const patchPool = await PatchPool.deploy();
  await patchPool.waitForDeployment();

  return { PatchPool: await deploymentRecord(patchPool) };
}
