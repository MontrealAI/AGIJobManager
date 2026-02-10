const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const MockERC721 = artifacts.require("MockERC721");
const MockNoSupportsInterface = artifacts.require("MockNoSupportsInterface");
const MockERC165Only = artifacts.require("MockERC165Only");

const { deployMainnetFixture } = require("./helpers/mainnetFixture");

contract("agiTypes safety", (accounts) => {
  const [owner] = accounts;

  it("rejects invalid AGI type addresses and emits disable event", async () => {
    const { manager } = await deployMainnetFixture(accounts);
    const erc165Only = await MockERC165Only.new({ from: owner });
    const noSupports = await MockNoSupportsInterface.new({ from: owner });

    await expectRevert.unspecified(manager.addAGIType("0x0000000000000000000000000000000000000000", 50, { from: owner }));
    await expectRevert.unspecified(manager.addAGIType(noSupports.address, 50, { from: owner }));
    await expectRevert.unspecified(manager.addAGIType(erc165Only.address, 50, { from: owner }));

    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 50, { from: owner });
    const tx = await manager.disableAGIType(nft.address, { from: owner });
    expectEvent(tx, "AGITypeUpdated", { nftAddress: nft.address });
  });
});
