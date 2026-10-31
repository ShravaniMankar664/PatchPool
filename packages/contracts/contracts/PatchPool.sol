// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PatchPool is ReentrancyGuard {
    uint256 public constant REFUND_GRACE_PERIOD = 7 days;
    uint256 public constant MAX_TASK_METADATA_BYTES = 16_384;

    enum BountyStatus {
        Open,
        Approved,
        Paid,
        Refunded,
        Refunding
    }

    struct Bounty {
        address sponsor;
        address reviewer;
        uint256 reward;
        uint64 submissionDeadline;
        uint64 settlementDeadline;
        bytes32 taskHash;
        BountyStatus status;
        uint256 approvedSubmissionId;
    }

    struct Submission {
        address submitter;
        address payable payee;
        bytes32 commitHash;
        bool commitIsSha256;
        bytes32 evidenceHash;
        uint64 submittedAt;
        bool rejected;
    }

    uint256 public bountyCount;

    mapping(uint256 => Bounty) private bounties;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    // Submission participants cannot later fund the same bounty, and contributors
    // cannot submit or be named as a payout recipient.
    mapping(uint256 => mapping(address => bool)) private submissionParticipants;
    mapping(uint256 => uint256) public refundableBalance;
    mapping(uint256 => uint256) public submissionCounts;
    mapping(uint256 => mapping(uint256 => Submission)) private submissions;
    mapping(uint256 => mapping(bytes32 => bool)) public commitAlreadySubmitted;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed sponsor,
        address indexed reviewer,
        uint256 reward,
        bytes32 taskHash,
        uint64 submissionDeadline,
        uint64 settlementDeadline
    );

    /// @notice Publishes the small human-readable task record so every client can discover it.
    /// @dev The taskHash commits to the exact UTF-8 JSON bytes; private data must never be included.
    event BountyMetadata(
        uint256 indexed bountyId,
        bytes32 indexed taskHash,
        string taskMetadataJson
    );

    event WorkSubmitted(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed submitter,
        address payee,
        bytes32 commitHash,
        bool commitIsSha256,
        bytes32 evidenceHash
    );

    event SubmissionReviewed(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed reviewer,
        bool approved,
        bytes32 commitHash,
        bool commitIsSha256,
        bytes32 evidenceHash
    );

    event RewardReleased(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed payee,
        uint256 amount,
        bytes32 commitHash,
        bool commitIsSha256,
        bytes32 evidenceHash
    );

    event BountyRefunded(
        uint256 indexed bountyId,
        address indexed sponsor,
        uint256 amount
    );

    event BountyFunded(
        uint256 indexed bountyId,
        address indexed contributor,
        uint256 amount,
        uint256 totalReward
    );

    event ContributionRefunded(
        uint256 indexed bountyId,
        address indexed contributor,
        uint256 amount,
        uint256 remainingRefundable
    );

    function createBounty(
        bytes32 taskHash,
        string calldata taskMetadataJson,
        address reviewer,
        uint64 submissionDeadline,
        uint64 settlementDeadline
    ) external payable returns (uint256 bountyId) {
        require(msg.value > 0, "Reward must be greater than zero");
        require(taskHash != bytes32(0), "Task hash is required");
        require(bytes(taskMetadataJson).length <= MAX_TASK_METADATA_BYTES, "Task metadata too large");
        require(keccak256(bytes(taskMetadataJson)) == taskHash, "Task metadata hash mismatch");
        require(reviewer != address(0), "Reviewer cannot be zero address");
        require(reviewer != msg.sender, "Sponsor cannot review own bounty");
        require(submissionDeadline > block.timestamp, "Submission deadline must be future");
        require(settlementDeadline > submissionDeadline, "Settlement deadline must follow submission");

        bountyId = ++bountyCount;

        bounties[bountyId] = Bounty({
            sponsor: msg.sender,
            reviewer: reviewer,
            reward: msg.value,
            submissionDeadline: submissionDeadline,
            settlementDeadline: settlementDeadline,
            taskHash: taskHash,
            status: BountyStatus.Open,
            approvedSubmissionId: 0
        });
        contributions[bountyId][msg.sender] = msg.value;
        refundableBalance[bountyId] = msg.value;

        emit BountyCreated(
            bountyId,
            msg.sender,
            reviewer,
            msg.value,
            taskHash,
            submissionDeadline,
            settlementDeadline
        );
        emit BountyMetadata(bountyId, taskHash, taskMetadataJson);
    }

    /// @notice Add funding to an open bounty before its submission deadline.
    function fundBounty(uint256 bountyId) external payable {
        require(bountyId != 0 && bountyId <= bountyCount, "Bounty does not exist");
        require(msg.value > 0, "Contribution must be greater than zero");

        Bounty storage bounty = bounties[bountyId];
        require(bounty.status == BountyStatus.Open, "Bounty is not open for funding");
        require(block.timestamp <= bounty.submissionDeadline, "Funding deadline passed");
        require(msg.sender != bounty.reviewer, "Reviewer cannot fund bounty");
        require(!submissionParticipants[bountyId][msg.sender], "Submission participant cannot fund");

        contributions[bountyId][msg.sender] += msg.value;
        bounty.reward += msg.value;
        refundableBalance[bountyId] += msg.value;

        emit BountyFunded(bountyId, msg.sender, msg.value, bounty.reward);
    }

    function submitWork(
        uint256 bountyId,
        bytes32 commitHash,
        bool commitIsSha256,
        bytes32 evidenceHash,
        address payable payee
    ) external returns (uint256 submissionId) {
        require(bountyId != 0 && bountyId <= bountyCount, "Bounty does not exist");

        Bounty storage bounty = bounties[bountyId];

        require(bounty.status == BountyStatus.Open, "Bounty is not open");
        require(msg.sender != bounty.reviewer, "Reviewer cannot submit work");
        require(contributions[bountyId][msg.sender] == 0, "Contributor cannot submit work");
        require(block.timestamp <= bounty.submissionDeadline, "Submission deadline passed");
        require(commitHash != bytes32(0), "Commit hash is required");
        require(evidenceHash != bytes32(0), "Evidence hash is required");
        require(payee != address(0), "Payee cannot be zero address");
        require(payee != bounty.reviewer, "Reviewer cannot be the payee");
        require(contributions[bountyId][payee] == 0, "Contributor cannot be the payee");
        if (!commitIsSha256) {
            require(uint256(commitHash) >> 160 == 0, "Invalid SHA-1 commit encoding");
        }
        bytes32 commitKey = keccak256(abi.encode(commitIsSha256, commitHash));
        require(!commitAlreadySubmitted[bountyId][commitKey], "Commit already submitted");

        commitAlreadySubmitted[bountyId][commitKey] = true;
        submissionId = ++submissionCounts[bountyId];

        submissions[bountyId][submissionId] = Submission({
            submitter: msg.sender,
            payee: payee,
            commitHash: commitHash,
            commitIsSha256: commitIsSha256,
            evidenceHash: evidenceHash,
            submittedAt: uint64(block.timestamp),
            rejected: false
        });
        submissionParticipants[bountyId][msg.sender] = true;
        submissionParticipants[bountyId][payee] = true;

        emit WorkSubmitted(
            bountyId,
            submissionId,
            msg.sender,
            payee,
            commitHash,
            commitIsSha256,
            evidenceHash
        );
    }

    function reviewSubmission(
        uint256 bountyId,
        uint256 submissionId,
        bool approve
    ) external {
        require(bountyId != 0 && bountyId <= bountyCount, "Bounty does not exist");

        Bounty storage bounty = bounties[bountyId];

        require(msg.sender == bounty.reviewer, "Only assigned reviewer");
        require(bounty.status == BountyStatus.Open, "Bounty is not open");
        require(block.timestamp <= bounty.settlementDeadline, "Review deadline passed");
        require(
            submissionId != 0 && submissionId <= submissionCounts[bountyId],
            "Submission does not exist"
        );

        Submission storage submission = submissions[bountyId][submissionId];
        require(!submission.rejected, "Submission already rejected");

        if (approve) {
            bounty.status = BountyStatus.Approved;
            bounty.approvedSubmissionId = submissionId;
            // An accepted submission is owed the full pool; none of it remains
            // refundable, even before the payee claims the reward.
            refundableBalance[bountyId] = 0;
        } else {
            submission.rejected = true;
        }

        emit SubmissionReviewed(
            bountyId,
            submissionId,
            msg.sender,
            approve,
            submission.commitHash,
            submission.commitIsSha256,
            submission.evidenceHash
        );
    }

    function releaseReward(uint256 bountyId) external nonReentrant {
        require(bountyId != 0 && bountyId <= bountyCount, "Bounty does not exist");

        Bounty storage bounty = bounties[bountyId];

        require(bounty.status == BountyStatus.Approved, "Bounty has no approved submission");
        uint256 submissionId = bounty.approvedSubmissionId;
        Submission storage submission = submissions[bountyId][submissionId];

        // Update state before sending funds.
        bounty.status = BountyStatus.Paid;

        uint256 amount = bounty.reward;
        (bool success, ) = submission.payee.call{value: amount}("");
        require(success, "Reward transfer failed");

        emit RewardReleased(
            bountyId,
            submissionId,
            submission.payee,
            amount,
            submission.commitHash,
            submission.commitIsSha256,
            submission.evidenceHash
        );
    }

    function refundExpired(uint256 bountyId) external nonReentrant {
        require(bountyId != 0 && bountyId <= bountyCount, "Bounty does not exist");

        Bounty storage bounty = bounties[bountyId];

        // An approved reward is owed to its payee and must never be reclaimable
        // by any contributor, even if the release grace period has elapsed.
        require(
            bounty.status == BountyStatus.Open || bounty.status == BountyStatus.Refunding,
            "Bounty cannot be refunded"
        );
        require(
            block.timestamp > uint256(bounty.settlementDeadline) + REFUND_GRACE_PERIOD,
            "Refund period has not started"
        );
        uint256 amount = contributions[bountyId][msg.sender];
        require(amount > 0, "No refundable contribution");

        // Pull-based claims avoid an unbounded loop over every contributor.
        contributions[bountyId][msg.sender] = 0;
        uint256 remaining = refundableBalance[bountyId] - amount;
        refundableBalance[bountyId] = remaining;
        bounty.status = remaining == 0 ? BountyStatus.Refunded : BountyStatus.Refunding;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Refund transfer failed");

        emit ContributionRefunded(bountyId, msg.sender, amount, remaining);
        if (remaining == 0) {
            emit BountyRefunded(bountyId, bounty.sponsor, bounty.reward);
        }
    }

    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        require(bountyId != 0 && bountyId <= bountyCount, "Bounty does not exist");
        return bounties[bountyId];
    }

    function getSubmission(
        uint256 bountyId,
        uint256 submissionId
    ) external view returns (Submission memory) {
        require(bountyId != 0 && bountyId <= bountyCount, "Bounty does not exist");
        require(
            submissionId != 0 && submissionId <= submissionCounts[bountyId],
            "Submission does not exist"
        );
        return submissions[bountyId][submissionId];
    }
}
