# Solidity 0.8.37 dependency identifier compatibility

Solidity 0.8.37 warns that `error` will become a reserved keyword and deprecates the old NatSpec memory-safety annotation syntax. These precise compatibility patches rename those identifiers and modernize already-declared memory-safety annotations. They do not change types, interfaces, expressions, control flow, license notices or memory-safety promises. They are compatibility patches, not vulnerability fixes. Compiler diagnostics remain enabled.

## OpenZeppelin Contracts 4.9.6

Upstream: [ECDSA.sol at v4.9.6](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.6/contracts/utils/cryptography/ECDSA.sol), MIT license retained in the installed file and package.

`patch-openzeppelin-compiler.cjs` changes four `RecoverError error` declarations, four comparisons, and three references passed to `_throwError` to use `recoverError`. No ECDSA algorithm or return value changes. It also converts eight upstream `/// @solidity memory-safe-assembly` annotations into `assembly ("memory-safe")` in the five compiled dependency files listed in the [exact patch manifest](openzeppelin-compiler-patches.json): Address, Strings, ERC721, ECDSA and MerkleProof. This preserves the same compiler promise; it does not mark any previously unannotated block as memory-safe.

The script checks every installed root/Hardhat copy, is idempotent, and rejects unknown originals or modified patched files. All five source pairs have exact SHA-256 hashes in the manifest. ECDSA's hashes are:

| Source | SHA-256 |
| --- | --- |
| Original upstream ECDSA.sol | `445963619903cee339e49aa2d7a0b07cfad90959529fff136394429c4a92d554` |
| Compatible ECDSA.sol | `e9e7342678cbee8864cd8ce0a49ee9556af1351c40f74fd5cf458b3dc3bdd0ff` |

The npm lockfile retains the original published package integrity. Installation applies this explicit, reviewed transformation afterward; source verification must use the resulting local source. Remove the patch when a reviewed upstream version changes these identifiers, after requalifying compatibility and deployed bytecode. Never adjust the accepted hashes merely to make an unknown package pass.

## Vendored forge-std Vm.sol

The checked-in `lib/forge-std/src/Vm.sol` renames 58 assertion-message parameter identifiers from `error` to `assertionMessage`. The file declares the cheatcode interface; parameter names do not change its function selectors or EVM behavior. Documentation and all other bytes are preserved.

| Source | SHA-256 |
| --- | --- |
| Pre-patch vendored Vm.sol | `2fe66e3dbe8ddad956182f92b87036e741d0a927742bff5de15a9be87331458c` |
| Identifier-only compatible Vm.sol | `61cb7637268e4b9ab66b0893a3db9373c1ce30ea8d719d7d1c810ead6f61edb8` |

Retain the vendored forge-std licenses. A future upstream refresh must preserve this compatibility or provide its own corrected identifiers; repeat compiler and test qualification after that refresh.
