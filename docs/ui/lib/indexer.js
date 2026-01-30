(() => {
  const sortLogs = (logs) => logs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    if (a.transactionIndex !== b.transactionIndex) return a.transactionIndex - b.transactionIndex;
    return a.logIndex - b.logIndex;
  });

  const api = { sortLogs };

  if (typeof window !== "undefined") {
    window.AGIJMIndexer = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
