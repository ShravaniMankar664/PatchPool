# Deployment Status

Updated 30 October 2026. MST Mainnet PatchPool source verification succeeded and the deployment was finalized in the active registry. No bounty flow has been created or funded through the app.

## Production target: MST Mainnet

- Chain ID: `4646` (`0x1226`)
- RPC: `https://mariorpc.mstblockchain.com`
- Explorer: `https://mstscan.com`
- Source verification: Hardhat's native `verify:blockscout` task, configured for chain `4646` at `https://mstscan.com/api`; no API key required.
- Currency: MSTC
- PatchPool contract: [`0x707004013b56e36eE458966d928539ede6166338`](https://mstscan.com/address/0x707004013b56eE458966d928539ede6166338)
- Deployment transaction: [`0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec`](https://mstscan.com/tx/0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec)
- Deployment block: `21783933`
- Verification: MSTScan source verification recorded; pending deployment status is `finalized` on chain `4646`.
- Read-only RPC confirmation on 30 October 2026: `eth_chainId` returned `0x1226`; transaction receipt status was `0x1` at block `21783933`; deployed runtime code was 8,393 bytes and Keccak-256 was `0x3fd747f5a8d30110c3c75bf33d039dca659b07cd6b064b52cb861f25b5419aaf`, matching the finalized record. The endpoint's latest block at that check was `21785007`.
- A read-only `eth_call` to `bountyCount()` returned zero at the latest block checked on 30 October 2026. No Mainnet bounty activity is being claimed.
- Production app: Mainnet is the only offered production network. Frontend Mainnet writes are enabled; BridgeKey signing still needs a live check.

The latest deployment preflight was read-only. The deployment transaction is recorded above; bounty creation, funding, submission, review, payout, and refunds have not been demonstrated as a live product flow. Any such activity requires separate wallet approval.

## Preserved historical deployment: MST Legacy Testnet

This deployment remains historical evidence only. It is not the production target or a selectable production network.

| Field | Preserved record |
| --- | --- |
| Chain ID | `91562037` |
| Contract | `0x707004013b56e36ee458966d928539ede6166338` |
| Deployment transaction | `0x132a1fd81bcc31febcd1830441706dd545075ae764636e9ddb7281ac938677c0` |
| Block | `6679982` |
| Runtime bytecode hash recorded | `0xe15aa5ea6f96ad3acc89580469f3106086979ba2ea1cdbc9632d524f966c0c98` |
| MSTScan source status | Project owner reported that this exact deployment was verified as a match. |

The address, transaction, block, and bytecode hash remain unchanged. The Mainnet deployment is stored under its separate `mainnet` registry entry, even though its address text is the same.

## Mainnet deployment gate

Any future deployment requires review of the compiled Solidity 0.8.20 artifact (optimizer enabled, 200 runs), source hash, expected chain ID, signer public address, current balance, and fresh cost estimate, plus explicit approval. The existing deployment used the guarded sequence: deploy, verify on MSTScan, then finalize. Never edit deployment registries manually. Frontend writes are an independent code gate; Mainnet is enabled and Legacy Testnet remains disabled.

Do not deploy to Ethereum or another chain. Local Hardhat is only an engineering test environment. Do not claim a live Mainnet bounty flow or activity until it is supported by actual on-chain transactions.
