# Genesis job evidence

Read the [worked example](../GENESIS_JOB_TODAY.md) first. These text fixtures record the **historical AGIALPHA job**, not a current USDC deployment or ready-to-post metadata. They were retrieved on 18 September 2026.

| File | Purpose |
| --- | --- |
| [Manifest](evidence/manifest.json) | Source URLs, block numbers, scope and SHA-256 for every fixture |
| [Transaction, receipt and block](evidence/historical-transaction.json) | Public JSON-RPC evidence for the successful settlement and its 26 logs |
| [Raw state](evidence/historical-state-raw.json) | Contract reads at blocks 24,609,814 and 24,609,815; includes token balances |
| [Decoded state](evidence/historical-state-decoded.json) | Readable values; simulator re-decodes and compares against the raw responses |
| [Legacy ABI](evidence/legacy-abi.json) | ABI from the verified old contract for decoding these fixtures only |
| [Decoded receipt](evidence/decoded-receipt.json) | Transfers, reputation, NFT and ENS events, each retaining its raw log |
| [Job specification](evidence/job-spec.json) | Exact downloaded metadata bytes, retaining old payment/contract fields |
| [Job completion](evidence/job-completion.json) | Exact downloaded metadata bytes, including the final image URI |
| [Artwork inspection](evidence/artwork-inspection.json) | PNG dimensions, file size, retrieved file hash, source and verification limits |
| [Deliverable checks](evidence/deliverable-checks.json) | Technical and visual observations from the historical artifact inspection |

The simulator checks fixture hashes, legacy state/manager-event decodes and metadata raw-CID digests offline. These checks establish internal consistency of the archived evidence, not an Ethereum state/receipt proof. The two helper `SET_AUTH` failures were separately decoded from the recorded receipt; the local mock-hook scenario tests the payment boundary without reproducing their precise cause.

The 9.2 MB artwork is not copied into this text-only repository. Its [public IPFS gateway link](https://gateway.pinata.cloud/ipfs/bafybeihuy6n7qifpcvzg267c2tsfr2d3xcei7l4hzikm5glzfncz4yfanq), hash and dimensions are recorded for comparison. Running the simulator does not refetch the image, assess copyright, or reperform human visual review.

Run `npm run simulate:genesis` from the repository root. Generated results go to ignored `build/qualification/genesis-job.json`; CI also uploads `genesis-job-simulation` for the run. The recorded commit and source hashes bind each report to its actual checkout. Never treat local fixture minting, impersonation, unlimited allowances or synthetic names as live participant instructions.
