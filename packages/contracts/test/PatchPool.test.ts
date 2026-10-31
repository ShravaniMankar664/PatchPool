import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const TASK_METADATA = JSON.stringify({ title: "Fix the login bug", description: "Fix the login bug" });

describe("PatchPool", function () {
  async function deployFixture() {
    const [sponsor, reviewer, developer, other] =
      await ethers.getSigners();

    const PatchPool = await ethers.getContractFactory("PatchPool");
    const patchPool = await PatchPool.deploy();
    await patchPool.waitForDeployment();

    const now = await time.latest();
    const submissionDeadline = now + 3600;
    const settlementDeadline = now + 7200;

    const taskHash = ethers.keccak256(ethers.toUtf8Bytes(TASK_METADATA));

    const reward = ethers.parseEther("1");

    async function createBounty() {
      return patchPool.connect(sponsor).createBounty(
        taskHash,
        TASK_METADATA,
        reviewer.address,
        submissionDeadline,
        settlementDeadline,
        { value: reward }
      );
    }

    async function submitWork(
      commitText = "commit-001",
      evidenceText = "evidence-001"
    ) {
      const commitDigest = ethers.keccak256(ethers.toUtf8Bytes(commitText));
      const commitHash = ethers.zeroPadValue(`0x${commitDigest.slice(-40)}`, 32);

      const evidenceHash = ethers.keccak256(
        ethers.toUtf8Bytes(evidenceText)
      );

      await patchPool.connect(developer).submitWork(
        1,
        commitHash,
        false,
        evidenceHash,
        developer.address
      );

      return { commitHash, evidenceHash };
    }

    return {
      patchPool,
      sponsor,
      reviewer,
      developer,
      other,
      taskHash,
      reward,
      submissionDeadline,
      settlementDeadline,
      createBounty,
      submitWork,
    };
  }

  describe("Bounty creation", function () {
    it("creates a funded bounty", async function () {
      const {
        patchPool,
        sponsor,
        reviewer,
        taskHash,
        reward,
        createBounty,
      } = await deployFixture();

      await createBounty();

      const bounty = await patchPool.getBounty(1);

      expect(bounty.sponsor).to.equal(sponsor.address);
      expect(bounty.reviewer).to.equal(reviewer.address);
      expect(bounty.reward).to.equal(reward);
      expect(bounty.taskHash).to.equal(taskHash);
      expect(bounty.status).to.equal(0);

      expect(
        await ethers.provider.getBalance(await patchPool.getAddress())
      ).to.equal(reward);
      expect(await patchPool.contributions(1, sponsor.address)).to.equal(reward);
      expect(await patchPool.refundableBalance(1)).to.equal(reward);
    });

    it("publishes hash-bound task metadata for every client", async function () {
      const { patchPool, taskHash, createBounty } = await deployFixture();
      await expect(createBounty())
        .to.emit(patchPool, "BountyMetadata")
        .withArgs(1, taskHash, TASK_METADATA);

      expect(await patchPool.MAX_TASK_METADATA_BYTES()).to.equal(BigInt(16_384));
      expect(await patchPool.bountyCount()).to.equal(1);
    });

    it("rejects a bounty with no funding", async function () {
      const {
        patchPool,
        sponsor,
        reviewer,
        taskHash,
        submissionDeadline,
        settlementDeadline,
      } = await deployFixture();

      await expect(
        patchPool.connect(sponsor).createBounty(
          taskHash,
          TASK_METADATA,
          reviewer.address,
          submissionDeadline,
          settlementDeadline,
          { value: 0 }
        )
      ).to.be.revertedWith("Reward must be greater than zero");
    });

    it("rejects the sponsor as the reviewer", async function () {
      const {
        patchPool,
        sponsor,
        taskHash,
        submissionDeadline,
        settlementDeadline,
      } = await deployFixture();

      await expect(
        patchPool.connect(sponsor).createBounty(
          taskHash,
          TASK_METADATA,
          sponsor.address,
          submissionDeadline,
          settlementDeadline,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("Sponsor cannot review own bounty");
    });

    it("rejects task metadata that does not match its commitment", async function () {
      const { patchPool, sponsor, reviewer, taskHash, submissionDeadline, settlementDeadline } = await deployFixture();
      await expect(patchPool.connect(sponsor).createBounty(
        taskHash,
        JSON.stringify({ title: "Changed after hashing", description: "Different task" }),
        reviewer.address,
        submissionDeadline,
        settlementDeadline,
        { value: ethers.parseEther("1") },
      )).to.be.revertedWith("Task metadata hash mismatch");
    });

    it("rejects task metadata that exceeds the event-size limit", async function () {
      const { patchPool, sponsor, reviewer, submissionDeadline, settlementDeadline } = await deployFixture();
      const oversizedMetadata = "x".repeat(16_385);
      const oversizedHash = ethers.keccak256(ethers.toUtf8Bytes(oversizedMetadata));
      await expect(patchPool.connect(sponsor).createBounty(
        oversizedHash,
        oversizedMetadata,
        reviewer.address,
        submissionDeadline,
        settlementDeadline,
        { value: ethers.parseEther("1") },
      )).to.be.revertedWith("Task metadata too large");
    });
  });

  describe("Shared funding", function () {
    it("adds multiple sponsors to one escrow and pays the aggregate reward", async function () {
      const { patchPool, sponsor, other, reviewer, developer, reward, createBounty, submitWork } =
        await deployFixture();
      const additional = ethers.parseEther("0.25");
      await createBounty();

      await expect(patchPool.connect(other).fundBounty(1, { value: additional }))
        .to.emit(patchPool, "BountyFunded")
        .withArgs(1, other.address, additional, reward + additional);

      expect(await patchPool.contributions(1, sponsor.address)).to.equal(reward);
      expect(await patchPool.contributions(1, other.address)).to.equal(additional);
      expect((await patchPool.getBounty(1)).reward).to.equal(reward + additional);
      expect(await ethers.provider.getBalance(await patchPool.getAddress())).to.equal(reward + additional);

      await submitWork();
      await patchPool.connect(reviewer).reviewSubmission(1, 1, true);
      const before = await ethers.provider.getBalance(developer.address);
      await patchPool.releaseReward(1);
      expect((await ethers.provider.getBalance(developer.address)) - before).to.equal(reward + additional);
      expect((await patchPool.getBounty(1)).status).to.equal(2);
    });

    it("rejects zero contributions", async function () {
      const { patchPool, other, createBounty } = await deployFixture();
      await createBounty();
      await expect(patchPool.connect(other).fundBounty(1, { value: 0 }))
        .to.be.revertedWith("Contribution must be greater than zero");
    });

    it("prevents the assigned reviewer from funding a bounty", async function () {
      const { patchPool, reviewer, createBounty } = await deployFixture();
      await createBounty();
      await expect(patchPool.connect(reviewer).fundBounty(1, { value: 1 }))
        .to.be.revertedWith("Reviewer cannot fund bounty");
    });

    it("prevents a submission participant from funding after submitting", async function () {
      const { patchPool, developer, createBounty, submitWork } = await deployFixture();
      await createBounty();
      await submitWork();
      await expect(patchPool.connect(developer).fundBounty(1, { value: 1 }))
        .to.be.revertedWith("Submission participant cannot fund");
    });

    it("rejects contributions after the submission deadline", async function () {
      const { patchPool, other, submissionDeadline, createBounty } = await deployFixture();
      await createBounty();
      await time.increaseTo(submissionDeadline + 1);
      await expect(patchPool.connect(other).fundBounty(1, { value: 1 }))
        .to.be.revertedWith("Funding deadline passed");
    });

    it("rejects contributions after approval", async function () {
      const { patchPool, other, reviewer, createBounty, submitWork } = await deployFixture();
      await createBounty();
      await submitWork();
      await patchPool.connect(reviewer).reviewSubmission(1, 1, true);
      await expect(patchPool.connect(other).fundBounty(1, { value: 1 }))
        .to.be.revertedWith("Bounty is not open for funding");
    });

    it("rejects contributions after payout", async function () {
      const { patchPool, other, reviewer, createBounty, submitWork } = await deployFixture();
      await createBounty();
      await submitWork();
      await patchPool.connect(reviewer).reviewSubmission(1, 1, true);
      await patchPool.releaseReward(1);
      await expect(patchPool.connect(other).fundBounty(1, { value: 1 }))
        .to.be.revertedWith("Bounty is not open for funding");
    });
  });

  describe("Work submission", function () {
    it("prevents the assigned reviewer from submitting work", async function () {
      const { patchPool, reviewer, createBounty } = await deployFixture();
      await createBounty();
      const commitHash = ethers.zeroPadValue("0x01", 32);
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("reviewer-evidence"));
      await expect(patchPool.connect(reviewer).submitWork(
        1, commitHash, false, evidenceHash, reviewer.address
      )).to.be.revertedWith("Reviewer cannot submit work");
    });

    it("prevents the reviewer from receiving a submission payout", async function () {
      const { patchPool, reviewer, developer, createBounty } = await deployFixture();
      await createBounty();
      const commitHash = ethers.zeroPadValue("0x02", 32);
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("reviewer-payee-evidence"));
      await expect(patchPool.connect(developer).submitWork(
        1, commitHash, false, evidenceHash, reviewer.address
      )).to.be.revertedWith("Reviewer cannot be the payee");
    });

    it("prevents the creator from submitting or being a payout recipient", async function () {
      const { patchPool, sponsor, developer, createBounty } = await deployFixture();
      await createBounty();
      const commitHash = ethers.zeroPadValue("0x03", 32);
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("creator-evidence"));
      await expect(patchPool.connect(sponsor).submitWork(
        1, commitHash, false, evidenceHash, developer.address
      )).to.be.revertedWith("Contributor cannot submit work");

      await expect(patchPool.connect(developer).submitWork(
        1, ethers.zeroPadValue("0x04", 32), false, evidenceHash, sponsor.address
      )).to.be.revertedWith("Contributor cannot be the payee");
    });

    it("prevents a co-sponsor from submitting or receiving payout", async function () {
      const { patchPool, other, developer, createBounty } = await deployFixture();
      await createBounty();
      await patchPool.connect(other).fundBounty(1, { value: 10 });
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("cosponsor-evidence"));
      await expect(patchPool.connect(other).submitWork(
        1, ethers.zeroPadValue("0x05", 32), false, evidenceHash, developer.address
      )).to.be.revertedWith("Contributor cannot submit work");

      await expect(patchPool.connect(developer).submitWork(
        1, ethers.zeroPadValue("0x06", 32), false, evidenceHash, other.address
      )).to.be.revertedWith("Contributor cannot be the payee");
    });

    it("prevents a named submitter or payee from later funding", async function () {
      const { patchPool, developer, other, createBounty } = await deployFixture();
      await createBounty();
      const commitHash = ethers.zeroPadValue("0x07", 32);
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("participant-funding"));
      await patchPool.connect(developer).submitWork(
        1, commitHash, false, evidenceHash, other.address
      );
      await expect(patchPool.connect(developer).fundBounty(1, { value: 1 }))
        .to.be.revertedWith("Submission participant cannot fund");
      await expect(patchPool.connect(other).fundBounty(1, { value: 1 }))
        .to.be.revertedWith("Submission participant cannot fund");
    });

    it("records the commit and evidence hashes", async function () {
      const { patchPool, createBounty, submitWork, developer } =
        await deployFixture();

      await createBounty();

      const { commitHash, evidenceHash } = await submitWork();
      const submission = await patchPool.getSubmission(1, 1);

      expect(submission.submitter).to.equal(developer.address);
      expect(submission.payee).to.equal(developer.address);
      expect(submission.commitHash).to.equal(commitHash);
      expect(submission.commitIsSha256).to.equal(false);
      expect(submission.evidenceHash).to.equal(evidenceHash);
    });

    it("preserves both Git hash formats and separates their duplicate keys", async function () {
      const { patchPool, developer, createBounty } = await deployFixture();
      await createBounty();
      const sha1 = ethers.zeroPadValue("0x1234567890123456789012345678901234567890", 32);
      const sha256 = `0x000000000000000000000000${"1234567890123456789012345678901234567890"}`;
      const evidence1 = ethers.keccak256(ethers.toUtf8Bytes("evidence-sha1"));
      const evidence2 = ethers.keccak256(ethers.toUtf8Bytes("evidence-sha256"));

      await patchPool.connect(developer).submitWork(1, sha1, false, evidence1, developer.address);
      await patchPool.connect(developer).submitWork(1, sha256, true, evidence2, developer.address);

      const first = await patchPool.getSubmission(1, 1);
      const second = await patchPool.getSubmission(1, 2);
      expect(first.commitHash).to.equal(sha1);
      expect(first.commitIsSha256).to.equal(false);
      expect(second.commitHash).to.equal(sha256);
      expect(second.commitIsSha256).to.equal(true);
    });

    it("rejects a duplicate commit for the same bounty", async function () {
      const { patchPool, createBounty, submitWork } =
        await deployFixture();

      await createBounty();
      await submitWork();

      await expect(
        submitWork()
      ).to.be.revertedWith("Commit already submitted");
    });

    it("rejects submissions for nonexistent bounties", async function () {
      const { patchPool, developer } = await deployFixture();

      const commitHash = ethers.keccak256(
        ethers.toUtf8Bytes("commit")
      );

      const evidenceHash = ethers.keccak256(
        ethers.toUtf8Bytes("evidence")
      );

      await expect(
        patchPool.connect(developer).submitWork(
          99,
          commitHash,
          false,
          evidenceHash,
          developer.address
        )
      ).to.be.revertedWith("Bounty does not exist");
    });

    it("rejects zero hashes and a zero payout address", async function () {
      const { patchPool, developer, createBounty } = await deployFixture();
      await createBounty();
      const digest = ethers.keccak256(ethers.toUtf8Bytes("valid"));
      const hash = ethers.zeroPadValue(`0x${digest.slice(-40)}`, 32);

      await expect(
        patchPool.connect(developer).submitWork(1, ethers.ZeroHash, false, hash, developer.address)
      ).to.be.revertedWith("Commit hash is required");
      await expect(
        patchPool.connect(developer).submitWork(1, hash, false, ethers.ZeroHash, developer.address)
      ).to.be.revertedWith("Evidence hash is required");
      await expect(
        patchPool.connect(developer).submitWork(1, hash, false, hash, ethers.ZeroAddress)
      ).to.be.revertedWith("Payee cannot be zero address");
      await expect(
        patchPool.connect(developer).submitWork(1, digest, false, hash, developer.address)
      ).to.be.revertedWith("Invalid SHA-1 commit encoding");
    });
    it("rejects submissions after the submission deadline", async function () {
      const {
        patchPool,
        developer,
        submissionDeadline,
        createBounty,
      } = await deployFixture();

      await createBounty();

      await time.increaseTo(submissionDeadline + 1);

      const commitHash = ethers.keccak256(
        ethers.toUtf8Bytes("late-commit")
      );

      const evidenceHash = ethers.keccak256(
        ethers.toUtf8Bytes("late-evidence")
      );

      await expect(
        patchPool.connect(developer).submitWork(
          1,
          commitHash,
          false,
          evidenceHash,
          developer.address
        )
      ).to.be.revertedWith("Submission deadline passed");
    });

    it("accepts a submission at the exact submission deadline", async function () {
      const { patchPool, developer, submissionDeadline, createBounty } = await deployFixture();
      await createBounty();
      await time.setNextBlockTimestamp(submissionDeadline);
      const commitDigest = ethers.keccak256(ethers.toUtf8Bytes("on-time-commit"));
      const commitHash = ethers.zeroPadValue(`0x${commitDigest.slice(-40)}`, 32);
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("on-time-evidence"));

      await expect(
        patchPool.connect(developer).submitWork(1, commitHash, false, evidenceHash, developer.address)
      ).to.not.be.reverted;
    });

  });

  describe("Review permissions", function () {
    it("prevents an unauthorised reviewer from approving", async function () {
      const { patchPool, other, createBounty, submitWork } =
        await deployFixture();

      await createBounty();
      await submitWork();

      await expect(
        patchPool.connect(other).reviewSubmission(1, 1, true)
      ).to.be.revertedWith("Only assigned reviewer");
    });

    it("binds approval to the selected submission", async function () {
      const { patchPool, reviewer, createBounty, submitWork } =
        await deployFixture();

      await createBounty();

      await submitWork("commit-001", "evidence-001");
      await submitWork("commit-002", "evidence-002");

      await patchPool.connect(reviewer).reviewSubmission(1, 2, true);

      const bounty = await patchPool.getBounty(1);

      expect(bounty.status).to.equal(1);
      expect(bounty.approvedSubmissionId).to.equal(2);
    });

    it("allows the reviewer to reject a submission", async function () {
      const { patchPool, reviewer, createBounty, submitWork } =
        await deployFixture();

      await createBounty();
      await submitWork();

      await patchPool.connect(reviewer).reviewSubmission(1, 1, false);

      const submission = await patchPool.getSubmission(1, 1);
      const bounty = await patchPool.getBounty(1);

      expect(submission.rejected).to.equal(true);
      expect(bounty.status).to.equal(0);
    });

    it("prevents an unauthorized wallet from rejecting", async function () {
      const { patchPool, other, createBounty, submitWork } = await deployFixture();
      await createBounty();
      await submitWork();

      await expect(patchPool.connect(other).reviewSubmission(1, 1, false)).to.be.revertedWith(
        "Only assigned reviewer"
      );
    });

    it("accepts a reviewer decision at the exact settlement deadline", async function () {
      const { patchPool, reviewer, settlementDeadline, createBounty, submitWork } = await deployFixture();
      await createBounty();
      await submitWork();
      await time.setNextBlockTimestamp(settlementDeadline);

      await expect(patchPool.connect(reviewer).reviewSubmission(1, 1, true)).to.not.be.reverted;
      expect((await patchPool.getBounty(1)).approvedSubmissionId).to.equal(1);
    });
  });

    it("rejects reviews after the settlement deadline", async function () {
      const {
        patchPool,
        reviewer,
        settlementDeadline,
        createBounty,
        submitWork,
      } = await deployFixture();

      await createBounty();
      await submitWork();

      await time.increaseTo(settlementDeadline + 1);

      await expect(
        patchPool.connect(reviewer).reviewSubmission(1, 1, true)
      ).to.be.revertedWith("Review deadline passed");
    });

  describe("Reward settlement", function () {
    it("pays the approved developer exactly once", async function () {
      const {
        patchPool,
        reviewer,
        developer,
        reward,
        createBounty,
        submitWork,
      } = await deployFixture();

      await createBounty();
      await submitWork();

      await patchPool.connect(reviewer).reviewSubmission(1, 1, true);

      const balanceBefore = await ethers.provider.getBalance(
        developer.address
      );

      await patchPool.releaseReward(1);

      const balanceAfter = await ethers.provider.getBalance(
        developer.address
      );

      expect(balanceAfter - balanceBefore).to.equal(reward);

      const bounty = await patchPool.getBounty(1);
      expect(bounty.status).to.equal(2);
      expect(await patchPool.refundableBalance(1)).to.equal(0);

      await expect(
        patchPool.releaseReward(1)
      ).to.be.revertedWith("Bounty has no approved submission");
    });

    it("does not pay a bounty before approval", async function () {
      const { patchPool, createBounty, submitWork } =
        await deployFixture();

      await createBounty();
      await submitWork();

      await expect(
        patchPool.releaseReward(1)
      ).to.be.revertedWith("Bounty has no approved submission");
    });

    it("pays the submission payee rather than the submitter", async function () {
      const { patchPool, reviewer, developer, other: payee, taskHash, reward, submissionDeadline, settlementDeadline, sponsor } =
        await deployFixture();
      await patchPool.connect(sponsor).createBounty(
        taskHash,
        TASK_METADATA,
        reviewer.address,
        submissionDeadline,
        settlementDeadline,
        { value: reward }
      );
      const commitDigest = ethers.keccak256(ethers.toUtf8Bytes("separate-payee-commit"));
      const commitHash = ethers.zeroPadValue(`0x${commitDigest.slice(-40)}`, 32);
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("separate-payee-evidence"));
      await patchPool.connect(developer).submitWork(1, commitHash, false, evidenceHash, payee.address);
      await patchPool.connect(reviewer).reviewSubmission(1, 1, true);
      const developerBefore = await ethers.provider.getBalance(developer.address);
      const payeeBefore = await ethers.provider.getBalance(payee.address);

      await patchPool.releaseReward(1);

      expect((await ethers.provider.getBalance(payee.address)) - payeeBefore).to.equal(reward);
      expect(await ethers.provider.getBalance(developer.address)).to.equal(developerBefore);
    });

    it("allows reward release at the exact refund grace boundary", async function () {
      const { patchPool, reviewer, createBounty, submitWork, settlementDeadline } =
        await deployFixture();

      await createBounty();
      await submitWork();
      await patchPool.connect(reviewer).reviewSubmission(1, 1, true);
      await time.setNextBlockTimestamp(settlementDeadline + 7 * 24 * 60 * 60);

      await expect(patchPool.releaseReward(1)).to.not.be.reverted;
    });

    it("keeps an approved reward releasable after the refund grace period", async function () {
      const { patchPool, reviewer, createBounty, submitWork, settlementDeadline } =
        await deployFixture();

      await createBounty();
      await submitWork();
      await patchPool.connect(reviewer).reviewSubmission(1, 1, true);
      await time.increaseTo(settlementDeadline + 7 * 24 * 60 * 60 + 1);

      await expect(patchPool.releaseReward(1)).to.not.be.reverted;
      expect((await patchPool.getBounty(1)).status).to.equal(2);
    });

    it("keeps approval intact when the payee rejects the native transfer", async function () {
      const { patchPool, reviewer, sponsor, developer, taskHash, reward, submissionDeadline, settlementDeadline } =
        await deployFixture();
      const Hello = await ethers.getContractFactory("Hello");
      const rejectingPayee = await Hello.deploy("I do not accept native currency");
      await rejectingPayee.waitForDeployment();
      await patchPool.connect(sponsor).createBounty(
        taskHash,
        TASK_METADATA,
        reviewer.address,
        submissionDeadline,
        settlementDeadline,
        { value: reward }
      );
      const commitDigest = ethers.keccak256(ethers.toUtf8Bytes("rejecting-payee-commit"));
      const commitHash = ethers.zeroPadValue(`0x${commitDigest.slice(-40)}`, 32);
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("rejecting-payee-evidence"));
      await patchPool.connect(developer).submitWork(1, commitHash, false, evidenceHash, await rejectingPayee.getAddress());
      await patchPool.connect(reviewer).reviewSubmission(1, 1, true);
      expect(await patchPool.refundableBalance(1)).to.equal(0);

      await expect(patchPool.releaseReward(1)).to.be.revertedWith("Reward transfer failed");
      expect((await patchPool.getBounty(1)).status).to.equal(1);
      expect(await patchPool.refundableBalance(1)).to.equal(0);
      expect(await ethers.provider.getBalance(await patchPool.getAddress())).to.equal(reward);
    });
  });

  describe("Expiry and refunds", function () {
    it("prevents refunds before the refund period begins", async function () {
      const {
        patchPool,
        sponsor,
        createBounty,
      } = await deployFixture();

      await createBounty();

      await expect(
        patchPool.connect(sponsor).refundExpired(1)
      ).to.be.revertedWith("Refund period has not started");
    });

    it("does not refund at the exact grace boundary", async function () {
      const { patchPool, sponsor, settlementDeadline, createBounty } = await deployFixture();
      await createBounty();
      await time.setNextBlockTimestamp(settlementDeadline + 7 * 24 * 60 * 60);

      await expect(patchPool.connect(sponsor).refundExpired(1)).to.be.revertedWith(
        "Refund period has not started"
      );
    });


    it("refunds an expired, unapproved bounty to its sponsor", async function () {
      const {
        patchPool,
        sponsor,
        settlementDeadline,
        createBounty,
      } = await deployFixture();

      await createBounty();

      await time.increaseTo(
        settlementDeadline + 7 * 24 * 60 * 60 + 1
      );

      await patchPool.connect(sponsor).refundExpired(1);

      const bounty = await patchPool.getBounty(1);

      expect(bounty.status).to.equal(3);

      expect(
        await ethers.provider.getBalance(await patchPool.getAddress())
      ).to.equal(0n);
    });

    it("prevents a non-contributor from claiming a refund", async function () {
      const {
        patchPool,
        other,
        settlementDeadline,
        createBounty,
      } = await deployFixture();

      await createBounty();

      await time.increaseTo(
        settlementDeadline + 7 * 24 * 60 * 60 + 1
      );

      await expect(
        patchPool.connect(other).refundExpired(1)
      ).to.be.revertedWith("No refundable contribution");
    });

    it("lets each contributor claim after a pending submission expires and closes after the last claim", async function () {
      const { patchPool, sponsor, reviewer, other, settlementDeadline, reward, createBounty, submitWork } =
        await deployFixture();
      const additional = ethers.parseEther("0.25");
      await createBounty();
      await submitWork();
      await patchPool.connect(other).fundBounty(1, { value: additional });
      await time.increaseTo(settlementDeadline + 7 * 24 * 60 * 60 + 1);

      await expect(patchPool.connect(sponsor).refundExpired(1))
        .to.emit(patchPool, "ContributionRefunded")
        .withArgs(1, sponsor.address, reward, additional);
      expect(await patchPool.contributions(1, sponsor.address)).to.equal(0);
      expect(await patchPool.contributions(1, other.address)).to.equal(additional);
      expect(await patchPool.refundableBalance(1)).to.equal(additional);
      expect(await ethers.provider.getBalance(await patchPool.getAddress())).to.equal(additional);
      expect((await patchPool.getBounty(1)).status).to.equal(4);
      await expect(patchPool.connect(reviewer).reviewSubmission(1, 1, true))
        .to.be.revertedWith("Bounty is not open");
      await expect(patchPool.releaseReward(1)).to.be.revertedWith("Bounty has no approved submission");
      await expect(patchPool.connect(other).fundBounty(1, { value: 1 }))
        .to.be.revertedWith("Bounty is not open for funding");

      await expect(patchPool.connect(sponsor).refundExpired(1))
        .to.be.revertedWith("No refundable contribution");
      await expect(patchPool.connect(other).refundExpired(1))
        .to.emit(patchPool, "BountyRefunded")
        .withArgs(1, sponsor.address, reward + additional);
      expect(await patchPool.refundableBalance(1)).to.equal(0);
      expect((await patchPool.getBounty(1)).status).to.equal(3);
      expect(await ethers.provider.getBalance(await patchPool.getAddress())).to.equal(0);
    });

    it("blocks reentrant contributor refund claims", async function () {
      const { patchPool, sponsor, other, settlementDeadline, reward, createBounty } =
        await deployFixture();
      const ReentrantActor = await ethers.getContractFactory("ReentrantActor");
      const actor = await ReentrantActor.deploy(await patchPool.getAddress());
      await actor.waitForDeployment();
      const contribution = ethers.parseEther("0.2");
      await createBounty();
      await actor.connect(other).contribute(1, { value: contribution });
      await time.increaseTo(settlementDeadline + 7 * 24 * 60 * 60 + 1);

      await actor.connect(other).claimRefund(1);

      expect(await actor.reentryAttempted()).to.equal(true);
      expect(await actor.reentrySucceeded()).to.equal(false);
      expect(await patchPool.contributions(1, await actor.getAddress())).to.equal(0);
      expect(await patchPool.refundableBalance(1)).to.equal(reward);
      expect((await patchPool.getBounty(1)).status).to.equal(4);
      await patchPool.connect(sponsor).refundExpired(1);
      expect(await ethers.provider.getBalance(await patchPool.getAddress())).to.equal(0);
    });

    it("blocks reentrant reward release from the approved payee", async function () {
      const { patchPool, sponsor, reviewer, developer, taskHash, reward, submissionDeadline, settlementDeadline } =
        await deployFixture();
      const ReentrantActor = await ethers.getContractFactory("ReentrantActor");
      const actor = await ReentrantActor.deploy(await patchPool.getAddress());
      await actor.waitForDeployment();
      await patchPool.connect(sponsor).createBounty(
        taskHash,
        TASK_METADATA,
        reviewer.address,
        submissionDeadline,
        settlementDeadline,
        { value: reward }
      );
      const commitDigest = ethers.keccak256(ethers.toUtf8Bytes("reentrant-payee-commit"));
      const commitHash = ethers.zeroPadValue(`0x${commitDigest.slice(-40)}`, 32);
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("reentrant-payee-evidence"));
      await patchPool.connect(developer).submitWork(
        1,
        commitHash,
        false,
        evidenceHash,
        await actor.getAddress()
      );
      await patchPool.connect(reviewer).reviewSubmission(1, 1, true);

      await actor.claimReward(1);

      expect(await actor.reentryAttempted()).to.equal(true);
      expect(await actor.reentrySucceeded()).to.equal(false);
      expect((await patchPool.getBounty(1)).status).to.equal(2);
      expect(await ethers.provider.getBalance(await patchPool.getAddress())).to.equal(0);
      expect(await ethers.provider.getBalance(await actor.getAddress())).to.equal(reward);
    });

    it("never refunds an approved bounty after the grace period", async function () {
      const { patchPool, sponsor, reviewer, settlementDeadline, createBounty, submitWork } =
        await deployFixture();

      await createBounty();
      await submitWork();
      await patchPool.connect(reviewer).reviewSubmission(1, 1, true);
      await time.increaseTo(settlementDeadline + 7 * 24 * 60 * 60 + 1);

      await expect(patchPool.connect(sponsor).refundExpired(1)).to.be.revertedWith(
        "Bounty cannot be refunded"
      );
      expect((await patchPool.getBounty(1)).status).to.equal(1);
    });

    it("prevents a second refund after an open bounty has been refunded", async function () {
      const { patchPool, sponsor, settlementDeadline, createBounty } = await deployFixture();
      await createBounty();
      await time.increaseTo(settlementDeadline + 7 * 24 * 60 * 60 + 1);
      await patchPool.connect(sponsor).refundExpired(1);

      await expect(patchPool.connect(sponsor).refundExpired(1)).to.be.revertedWith(
        "Bounty cannot be refunded"
      );
    });

    it("does not allow a paid bounty to be refunded", async function () {
      const { patchPool, sponsor, reviewer, createBounty, submitWork } = await deployFixture();
      await createBounty();
      await submitWork();
      await patchPool.connect(reviewer).reviewSubmission(1, 1, true);
      await patchPool.releaseReward(1);

      await expect(patchPool.connect(sponsor).refundExpired(1)).to.be.revertedWith(
        "Bounty cannot be refunded"
      );
    });
  });
});
