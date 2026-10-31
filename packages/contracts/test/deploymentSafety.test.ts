import { expect } from "chai";
import {
  assertDeploymentCanBeActivated,
  assertDeploymentSender,
  assertPendingSlotAvailable,
} from "../scripts/lib/deploymentSafety";
import type { ContractDeployment, PendingDeployment } from "../scripts/lib/writeDeployment";
import { isDeploymentNetworkConfigured, MST_NETWORKS } from "../../shared/src/networks";

const patchPool: ContractDeployment = {
  address: "0x1111111111111111111111111111111111111111",
  abi: [],
  constructorArguments: [],
  deploymentTransactionHash: `0x${"aa".repeat(32)}`,
  deploymentBlock: 100,
  deploymentBytecodeHash: `0x${"bb".repeat(32)}`,
};

function deployment(overrides: Partial<PendingDeployment> = {}): PendingDeployment {
  return {
    network: "testnet",
    chainId: 91562037,
    status: "verified",
    recordedAt: "2026-10-27T00:00:00.000Z",
    verifiedAt: "2026-10-27T00:01:00.000Z",
    verifiedContracts: ["PatchPool"],
    patchPoolSourceSha256: "source-hash",
    contracts: { PatchPool: patchPool },
    ...overrides,
  };
}

describe("deployment registry safety", () => {
  it("binds a browser-originated deployment record to the receipt transaction sender", () => {
    assertDeploymentSender("0x000000000000000000000000000000000000000a", "0x000000000000000000000000000000000000000A");
    expect(() => assertDeploymentSender("0x000000000000000000000000000000000000000a", "0x000000000000000000000000000000000000000b"))
      .to.throw(/sender does not match/);
    expect(() => assertDeploymentSender("invalid", "0x000000000000000000000000000000000000000a"))
      .to.throw(/valid deployer address/);
  });

  it("keeps Mainnet as the production target and preserves Legacy Testnet as historical", () => {
    expect(MST_NETWORKS.legacyTestnet.status).to.equal("sunsetting");
    expect(MST_NETWORKS.legacyTestnet.chainId).to.equal(91562037);
    expect(isDeploymentNetworkConfigured("testnet")).to.equal(true);
    expect(MST_NETWORKS.coralTestnet.status).to.equal("awaiting_official_confirmation");
    expect(MST_NETWORKS.coralTestnet.chainId).to.equal(54635);
    expect(MST_NETWORKS.coralTestnet.rpcUrl).to.equal(undefined);
    expect(isDeploymentNetworkConfigured("mainnet")).to.equal(true);
    expect(MST_NETWORKS.mainnet.chainId).to.equal(4646);
  });

  it("refuses to overwrite an unresolved pending deployment", () => {
    expect(() => assertPendingSlotAvailable("testnet", deployment({ status: "verification_failed" })))
      .to.throw("Refusing to overwrite an unresolved testnet deployment");
  });

  it("allows a new pending record after the prior one was finalized", () => {
    expect(() => assertPendingSlotAvailable("testnet", deployment({ status: "finalized" }))).not.to.throw();
  });

  it("allows a verified deployment to activate only on the selected Testnet chain", () => {
    expect(() => assertDeploymentCanBeActivated(deployment(), "testnet", 91562037)).not.to.throw();
    expect(() => assertDeploymentCanBeActivated(deployment(), "testnet", 54635))
      .to.throw("chain ID does not match finalization target");
  });

  it("allows a verified Mainnet deployment only on the Mainnet chain", () => {
    expect(() => assertDeploymentCanBeActivated(
      deployment({ network: "mainnet", chainId: 4646 }), "mainnet", 4646
    )).not.to.throw();
  });

  it("rejects a Mainnet deployment from the Testnet finalization path", () => {
    expect(() => assertDeploymentCanBeActivated(
      deployment({ network: "mainnet", chainId: 4646 }), "testnet", 91562037
    )).to.throw("Pending deployment network does not match finalization target");
  });

  it("rejects a pending deployment without successful verification evidence", () => {
    expect(() => assertDeploymentCanBeActivated(
      deployment({ status: "pending_verification", verifiedAt: undefined }), "testnet", 91562037
    )).to.throw("Only an MSTScan-verified pending deployment");
  });

  it("requires the PatchPool source itself to be verified", () => {
    expect(() => assertDeploymentCanBeActivated(
      deployment({ verifiedContracts: ["Hello"] }), "testnet", 91562037
    )).to.throw("does not confirm MSTScan verification of PatchPool");
  });

  it("rejects a mismatched RPC or recorded chain ID", () => {
    expect(() => assertDeploymentCanBeActivated(
      deployment({ network: "mainnet", chainId: 4646 }), "mainnet", 91562037
    ))
      .to.throw("chain ID does not match");
  });

  it("allows idempotent registration of the same address and deployment evidence", () => {
    const mainnetDeployment = deployment({ network: "mainnet", chainId: 4646 });
    expect(() => assertDeploymentCanBeActivated(mainnetDeployment, "mainnet", 4646, patchPool)).not.to.throw();
  });

  it("rejects an active address tied to another deployment transaction", () => {
    expect(() => assertDeploymentCanBeActivated(
      deployment({ network: "mainnet", chainId: 4646 }),
      "mainnet",
      4646,
      { ...patchPool, deploymentTransactionHash: `0x${"cc".repeat(32)}` }
    )).to.throw("belongs to a different deployment record");
  });
});
