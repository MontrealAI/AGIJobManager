const test = require("node:test");
const assert = require("node:assert/strict");

const { sortLogs } = require("../docs/ui/lib/indexer");

test("sortLogs orders by blockNumber, transactionIndex, then logIndex", () => {
  const logs = [
    { blockNumber: 10, transactionIndex: 2, logIndex: 5, id: "late" },
    { blockNumber: 9, transactionIndex: 3, logIndex: 1, id: "block-9" },
    { blockNumber: 10, transactionIndex: 1, logIndex: 9, id: "tx-1" },
    { blockNumber: 10, transactionIndex: 1, logIndex: 2, id: "tx-1-log-2" },
  ];

  const ordered = sortLogs(logs);

  assert.deepStrictEqual(
    ordered.map((log) => log.id),
    ["block-9", "tx-1-log-2", "tx-1", "late"]
  );
});
