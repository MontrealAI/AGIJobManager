const AGIJobManager = artifacts.require("AGIJobManager");

module.exports = function (deployer) {
  deployer.deploy(
    AGIJobManager,
    "0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA",
    "https://ipfs.io/ipfs/",
    "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
    "0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16", // clubRootNode
    "0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d", // agentRootNode
    "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b",
    "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b"
  );
};

