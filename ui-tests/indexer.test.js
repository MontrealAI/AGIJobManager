const assert = require("assert");
const path = require("path");
const { describe, it } = require("node:test");

const indexer = require(path.join(__dirname, "..", "docs", "ui", "lib", "indexer.js"));

const { sortLogs, applyEventToIndex } = indexer;

function buildIndex() {
  return { jobs: {}, nfts: {}, meta: {} };
}

describe("UI indexer helpers", () => {
  it("sorts logs by blockNumber, transactionIndex, logIndex", () => {
    const logs = [
      { blockNumber: 12, transactionIndex: 4, logIndex: 1 },
      { blockNumber: 10, transactionIndex: 1, logIndex: 5 },
      { blockNumber: 10, transactionIndex: 1, logIndex: 2 },
      { blockNumber: 10, transactionIndex: 0, logIndex: 9 },
      { blockNumber: 11, transactionIndex: 3, logIndex: 0 },
    ];

    const sorted = sortLogs(logs.slice());
    const tuple = (log) => [log.blockNumber, log.transactionIndex, log.logIndex];

    assert.deepStrictEqual(sorted.map(tuple), [
      [10, 0, 9],
      [10, 1, 2],
      [10, 1, 5],
      [11, 3, 0],
      [12, 4, 1],
    ]);
  });

  it("reconstructs job and NFT state from events", () => {
    const index = buildIndex();

    applyEventToIndex(index, { eventName: "JobCreated", blockNumber: 5, args: { jobId: 1n } });
    applyEventToIndex(index, { eventName: "JobDisputed", blockNumber: 6, args: { jobId: 1n } });
    applyEventToIndex(index, { eventName: "DisputeResolvedWithCode", blockNumber: 7, args: { jobId: 1n, resolutionCode: 0 } });
    let job = index.jobs["1"];
    assert.ok(job.disputed, "job should remain disputed after NO_ACTION");
    assert.ok(job.disputeResolved === false, "NO_ACTION should not mark dispute resolved");
    applyEventToIndex(index, { eventName: "DisputeResolvedWithCode", blockNumber: 8, args: { jobId: 1n, resolutionCode: 1 } });
    applyEventToIndex(index, { eventName: "JobCompleted", blockNumber: 9, args: { jobId: 1n } });

    job = index.jobs["1"];
    assert.ok(job.created);
    assert.ok(job.disputed === false);
    assert.ok(job.disputeResolved);
    assert.ok(job.completed);
    assert.strictEqual(job.createdBlock, 5);
    assert.strictEqual(job.lastActivityBlock, 9);

    applyEventToIndex(index, { eventName: "NFTIssued", blockNumber: 9, args: { tokenId: 3n } });

    const nft = index.nfts["3"];
    assert.ok(nft.issued);
    assert.strictEqual(nft.issuedBlock, 9);
    assert.strictEqual(nft.lastActivityBlock, 9);
  });
});
