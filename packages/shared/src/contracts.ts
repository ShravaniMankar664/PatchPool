// Auto-generated only by the explicit finalize step after MSTScan verification.
// Do not edit by hand.

export const deployments = {
  "testnet": {
    "Hello": {
      "address": "0x2E53e8a70478060B5d21Dc66D80F873FB54A2a96",
      "abi": [
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_message",
              "type": "string"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "owner",
              "type": "address"
            }
          ],
          "name": "OwnableInvalidOwner",
          "type": "error"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "account",
              "type": "address"
            }
          ],
          "name": "OwnableUnauthorizedAccount",
          "type": "error"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "internalType": "string",
              "name": "previousMessage",
              "type": "string"
            },
            {
              "indexed": false,
              "internalType": "string",
              "name": "newMessage",
              "type": "string"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "changedBy",
              "type": "address"
            }
          ],
          "name": "MessageChanged",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "getMessage",
          "outputs": [
            {
              "internalType": "string",
              "name": "",
              "type": "string"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "string",
              "name": "_message",
              "type": "string"
            }
          ],
          "name": "setMessage",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ],
      "constructorArguments": [
        "Hello, MST!"
      ]
    },
    "PatchPool": {
      "address": "0x707004013b56e36ee458966d928539ede6166338",
      "abi": [
        {
          "inputs": [],
          "name": "ReentrancyGuardReentrantCall",
          "type": "error"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "sponsor",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "reviewer",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "reward",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "taskHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "uint64",
              "name": "submissionDeadline",
              "type": "uint64"
            },
            {
              "indexed": false,
              "internalType": "uint64",
              "name": "settlementDeadline",
              "type": "uint64"
            }
          ],
          "name": "BountyCreated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "contributor",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "totalReward",
              "type": "uint256"
            }
          ],
          "name": "BountyFunded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "taskHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "string",
              "name": "taskMetadataJson",
              "type": "string"
            }
          ],
          "name": "BountyMetadata",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "sponsor",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "BountyRefunded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "contributor",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "remainingRefundable",
              "type": "uint256"
            }
          ],
          "name": "ContributionRefunded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "payee",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "commitHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "bool",
              "name": "commitIsSha256",
              "type": "bool"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "evidenceHash",
              "type": "bytes32"
            }
          ],
          "name": "RewardReleased",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "reviewer",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "bool",
              "name": "approved",
              "type": "bool"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "commitHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "bool",
              "name": "commitIsSha256",
              "type": "bool"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "evidenceHash",
              "type": "bytes32"
            }
          ],
          "name": "SubmissionReviewed",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "submitter",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "payee",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "commitHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "bool",
              "name": "commitIsSha256",
              "type": "bool"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "evidenceHash",
              "type": "bytes32"
            }
          ],
          "name": "WorkSubmitted",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "MAX_TASK_METADATA_BYTES",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "REFUND_GRACE_PERIOD",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "bountyCount",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "name": "commitAlreadySubmitted",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "name": "contributions",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "taskHash",
              "type": "bytes32"
            },
            {
              "internalType": "string",
              "name": "taskMetadataJson",
              "type": "string"
            },
            {
              "internalType": "address",
              "name": "reviewer",
              "type": "address"
            },
            {
              "internalType": "uint64",
              "name": "submissionDeadline",
              "type": "uint64"
            },
            {
              "internalType": "uint64",
              "name": "settlementDeadline",
              "type": "uint64"
            }
          ],
          "name": "createBounty",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            }
          ],
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            }
          ],
          "name": "fundBounty",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            }
          ],
          "name": "getBounty",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "sponsor",
                  "type": "address"
                },
                {
                  "internalType": "address",
                  "name": "reviewer",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "reward",
                  "type": "uint256"
                },
                {
                  "internalType": "uint64",
                  "name": "submissionDeadline",
                  "type": "uint64"
                },
                {
                  "internalType": "uint64",
                  "name": "settlementDeadline",
                  "type": "uint64"
                },
                {
                  "internalType": "bytes32",
                  "name": "taskHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "enum PatchPool.BountyStatus",
                  "name": "status",
                  "type": "uint8"
                },
                {
                  "internalType": "uint256",
                  "name": "approvedSubmissionId",
                  "type": "uint256"
                }
              ],
              "internalType": "struct PatchPool.Bounty",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            }
          ],
          "name": "getSubmission",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "submitter",
                  "type": "address"
                },
                {
                  "internalType": "address payable",
                  "name": "payee",
                  "type": "address"
                },
                {
                  "internalType": "bytes32",
                  "name": "commitHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "bool",
                  "name": "commitIsSha256",
                  "type": "bool"
                },
                {
                  "internalType": "bytes32",
                  "name": "evidenceHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint64",
                  "name": "submittedAt",
                  "type": "uint64"
                },
                {
                  "internalType": "bool",
                  "name": "rejected",
                  "type": "bool"
                }
              ],
              "internalType": "struct PatchPool.Submission",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            }
          ],
          "name": "refundExpired",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "refundableBalance",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            }
          ],
          "name": "releaseReward",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            },
            {
              "internalType": "bool",
              "name": "approve",
              "type": "bool"
            }
          ],
          "name": "reviewSubmission",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "submissionCounts",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "commitHash",
              "type": "bytes32"
            },
            {
              "internalType": "bool",
              "name": "commitIsSha256",
              "type": "bool"
            },
            {
              "internalType": "bytes32",
              "name": "evidenceHash",
              "type": "bytes32"
            },
            {
              "internalType": "address payable",
              "name": "payee",
              "type": "address"
            }
          ],
          "name": "submitWork",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ],
      "constructorArguments": [],
      "deploymentTransactionHash": "0x132a1fd81bcc31febcd1830441706dd545075ae764636e9ddb7281ac938677c0",
      "deploymentBlock": 6679982,
      "deploymentBytecodeHash": "0xe15aa5ea6f96ad3acc89580469f3106086979ba2ea1cdbc9632d524f966c0c98"
    }
  },
  "mainnet": {
    "PatchPool": {
      "address": "0x707004013b56e36eE458966d928539ede6166338",
      "abi": [
        {
          "inputs": [],
          "name": "ReentrancyGuardReentrantCall",
          "type": "error"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "sponsor",
              "type": "address"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "reviewer",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "reward",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "taskHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "uint64",
              "name": "submissionDeadline",
              "type": "uint64"
            },
            {
              "indexed": false,
              "internalType": "uint64",
              "name": "settlementDeadline",
              "type": "uint64"
            }
          ],
          "name": "BountyCreated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "contributor",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "totalReward",
              "type": "uint256"
            }
          ],
          "name": "BountyFunded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "bytes32",
              "name": "taskHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "string",
              "name": "taskMetadataJson",
              "type": "string"
            }
          ],
          "name": "BountyMetadata",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "sponsor",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "BountyRefunded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "contributor",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "remainingRefundable",
              "type": "uint256"
            }
          ],
          "name": "ContributionRefunded",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "payee",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "commitHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "bool",
              "name": "commitIsSha256",
              "type": "bool"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "evidenceHash",
              "type": "bytes32"
            }
          ],
          "name": "RewardReleased",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "reviewer",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "bool",
              "name": "approved",
              "type": "bool"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "commitHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "bool",
              "name": "commitIsSha256",
              "type": "bool"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "evidenceHash",
              "type": "bytes32"
            }
          ],
          "name": "SubmissionReviewed",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            },
            {
              "indexed": true,
              "internalType": "address",
              "name": "submitter",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "address",
              "name": "payee",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "commitHash",
              "type": "bytes32"
            },
            {
              "indexed": false,
              "internalType": "bool",
              "name": "commitIsSha256",
              "type": "bool"
            },
            {
              "indexed": false,
              "internalType": "bytes32",
              "name": "evidenceHash",
              "type": "bytes32"
            }
          ],
          "name": "WorkSubmitted",
          "type": "event"
        },
        {
          "inputs": [],
          "name": "MAX_TASK_METADATA_BYTES",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "REFUND_GRACE_PERIOD",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "bountyCount",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "",
              "type": "bytes32"
            }
          ],
          "name": "commitAlreadySubmitted",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "name": "contributions",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "bytes32",
              "name": "taskHash",
              "type": "bytes32"
            },
            {
              "internalType": "string",
              "name": "taskMetadataJson",
              "type": "string"
            },
            {
              "internalType": "address",
              "name": "reviewer",
              "type": "address"
            },
            {
              "internalType": "uint64",
              "name": "submissionDeadline",
              "type": "uint64"
            },
            {
              "internalType": "uint64",
              "name": "settlementDeadline",
              "type": "uint64"
            }
          ],
          "name": "createBounty",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            }
          ],
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            }
          ],
          "name": "fundBounty",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            }
          ],
          "name": "getBounty",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "sponsor",
                  "type": "address"
                },
                {
                  "internalType": "address",
                  "name": "reviewer",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "reward",
                  "type": "uint256"
                },
                {
                  "internalType": "uint64",
                  "name": "submissionDeadline",
                  "type": "uint64"
                },
                {
                  "internalType": "uint64",
                  "name": "settlementDeadline",
                  "type": "uint64"
                },
                {
                  "internalType": "bytes32",
                  "name": "taskHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "enum PatchPool.BountyStatus",
                  "name": "status",
                  "type": "uint8"
                },
                {
                  "internalType": "uint256",
                  "name": "approvedSubmissionId",
                  "type": "uint256"
                }
              ],
              "internalType": "struct PatchPool.Bounty",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            }
          ],
          "name": "getSubmission",
          "outputs": [
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "submitter",
                  "type": "address"
                },
                {
                  "internalType": "address payable",
                  "name": "payee",
                  "type": "address"
                },
                {
                  "internalType": "bytes32",
                  "name": "commitHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "bool",
                  "name": "commitIsSha256",
                  "type": "bool"
                },
                {
                  "internalType": "bytes32",
                  "name": "evidenceHash",
                  "type": "bytes32"
                },
                {
                  "internalType": "uint64",
                  "name": "submittedAt",
                  "type": "uint64"
                },
                {
                  "internalType": "bool",
                  "name": "rejected",
                  "type": "bool"
                }
              ],
              "internalType": "struct PatchPool.Submission",
              "name": "",
              "type": "tuple"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            }
          ],
          "name": "refundExpired",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "refundableBalance",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            }
          ],
          "name": "releaseReward",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            },
            {
              "internalType": "bool",
              "name": "approve",
              "type": "bool"
            }
          ],
          "name": "reviewSubmission",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "name": "submissionCounts",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "bountyId",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "commitHash",
              "type": "bytes32"
            },
            {
              "internalType": "bool",
              "name": "commitIsSha256",
              "type": "bool"
            },
            {
              "internalType": "bytes32",
              "name": "evidenceHash",
              "type": "bytes32"
            },
            {
              "internalType": "address payable",
              "name": "payee",
              "type": "address"
            }
          ],
          "name": "submitWork",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "submissionId",
              "type": "uint256"
            }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ],
      "constructorArguments": [],
      "deploymentTransactionHash": "0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec",
      "deploymentBlock": 21783933,
      "deploymentBytecodeHash": "0x3fd747f5a8d30110c3c75bf33d039dca659b07cd6b064b52cb861f25b5419aaf"
    }
  }
} as const;

export type NetworkName = keyof typeof deployments;
