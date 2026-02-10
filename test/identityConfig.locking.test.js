const assert = require("assert");
const { deployMainnetFixture } = require("./helpers/mainnetFixture");

contract("identity config locking", (accounts) => {
  const [owner] = accounts;

  it("supports identity lock activation", async () => {
    const { manager } = await deployMainnetFixture(accounts);
    assert.equal(await manager.lockIdentityConfig(), false);
    await manager.lockIdentityConfiguration({ from: owner });
    assert.equal(await manager.lockIdentityConfig(), true);
  });
});
