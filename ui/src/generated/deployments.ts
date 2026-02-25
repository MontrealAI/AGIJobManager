export const OFFICIAL_DEPLOYMENTS = {
  "release": {
    "agiJobManager": {
      "tag": "v0.1.0-mainnet-beta",
      "releaseUrl": "https://github.com/MontrealAI/AGIJobManager/releases/tag/v0.1.0-mainnet-beta"
    },
    "ensJobPages": {
      "tag": "v0.2.0-mainnet-identity-layer",
      "releaseUrl": "https://github.com/MontrealAI/AGIJobManager/releases/tag/v0.2.0-mainnet-identity-layer"
    }
  },
  "chain": {
    "chainId": 1,
    "explorerBaseUrl": "https://etherscan.io"
  },
  "agiJobManager": {
    "deployer": "0x6c8B8897Fb6b08B4070387233B89b3E9A94eD00E",
    "finalOwner": "0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201",
    "deploymentBlock": 24522684,
    "addresses": {
      "UriUtils": "0x2c6359D42173aaC73Ea053b37c411f7Da44d4706",
      "TransferUtils": "0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f",
      "BondMath": "0x0c2a50a9C1db998707662db2A13B93175c3E7394",
      "ReputationMath": "0x4F64e44a3693489289B1F20D55CF56130fE66C0b",
      "ENSOwnership": "0x6852a13650F5c90342663c9fF7555f97F62515c8",
      "AGIJobManager": "0xB3AAeb69b630f0299791679c063d68d6687481d1"
    },
    "constructorArgs": {
      "agiTokenAddress": "0xa61a3b3a130a9c20768eebf97e21515a6046a1fa",
      "baseIpfsUrl": "https://ipfs.io/ipfs/",
      "ensConfig": [
        "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
        "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401"
      ],
      "rootNodes": [
        "0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16",
        "0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d",
        "0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e",
        "0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e"
      ],
      "merkleRoots": [
        "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b",
        "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b"
      ]
    },
    "libraries": {
      "contracts/utils/UriUtils.sol:UriUtils": "0x2c6359D42173aaC73Ea053b37c411f7Da44d4706",
      "contracts/utils/TransferUtils.sol:TransferUtils": "0x1e26d8F8E2E4957a06d38Ab046CF64E5d308970f",
      "contracts/utils/BondMath.sol:BondMath": "0x0c2a50a9C1db998707662db2A13B93175c3E7394",
      "contracts/utils/ReputationMath.sol:ReputationMath": "0x4F64e44a3693489289B1F20D55CF56130fE66C0b",
      "contracts/utils/ENSOwnership.sol:ENSOwnership": "0x6852a13650F5c90342663c9fF7555f97F62515c8"
    },
    "compiler": {
      "version": "0.8.23",
      "optimizerRuns": 40,
      "evmVersion": "shanghai",
      "viaIR": false,
      "metadataBytecodeHash": "none",
      "revertStrings": "strip"
    }
  },
  "ensJobPages": {
    "deployer": {
      "address": "0x6c8B8897Fb6b08B4070387233B89b3E9A94eD00E",
      "ensName": "deployer.agi.eth"
    },
    "finalOwner": {
      "address": "0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201",
      "ensName": null,
      "note": "Configured via NEW_OWNER and transferOwnership()."
    },
    "deploymentBlock": 24531331,
    "addresses": {
      "ENSJobPages": "0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94"
    },
    "constructorArgs": {
      "ENSJobPages": {
        "ensAddress": "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
        "nameWrapperAddress": "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
        "publicResolverAddress": "0xF29100983E058B709F3D539b0c765937B804AC15",
        "rootNode": "0xc164c9558a3c429519a9b2eba9f650025731fccc46b3a5664283bcab84f7e690",
        "rootName": "alpha.jobs.agi.eth"
      }
    },
    "calls": [
      {
        "contract": "ENSJobPages",
        "address": "0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94",
        "function": "setJobManager(address)",
        "args": {
          "jobManager": "0xB3AAeb69b630f0299791679c063d68d6687481d1"
        },
        "txHash": "0xac2fd0dae7a1bc312eeb44b86734f73f61422d602b1194f862fb1d84a89f631b",
        "blockNumber": 24531335,
        "timestamp": "2026-02-25T03:47:59.000Z"
      },
      {
        "contract": "NameWrapper",
        "address": "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
        "function": "setApprovalForAll(address,bool)",
        "args": {
          "operator": "0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94",
          "approved": true
        },
        "txHash": "0x2079a282e0cba9505f5e51e1495f2113e4ca2bfa5cb52324a89247174ecf41b4",
        "blockNumber": 24531401,
        "timestamp": "2026-02-25T04:01:11.000Z",
        "note": "Required only when the jobs root is wrapped in the ENS NameWrapper; authorizes ENSJobPages to create subnames under the wrapped root."
      },
      {
        "contract": "AGIJobManager",
        "address": "0xB3AAeb69b630f0299791679c063d68d6687481d1",
        "function": "setEnsJobPages(address)",
        "args": {
          "ensJobPages": "0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94"
        },
        "txHash": "0x1df147a640999d4c4406f6d1007571ebf1cc1379a5ae53250394d86608d65e6b",
        "blockNumber": 24531440,
        "timestamp": "2026-02-25T04:08:59.000Z",
        "note": "Executed by the AGIJobManager owner to wire ENS job pages into the mainnet beta deployment."
      }
    ]
  }
} as const;
