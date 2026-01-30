(function (global) {
  "use strict";

  function sortLogs(logs) {
    return logs.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      if (a.transactionIndex !== b.transactionIndex) return a.transactionIndex - b.transactionIndex;
      return a.logIndex - b.logIndex;
    });
  }

  function ensureJobEntry(index, jobId) {
    if (!index.jobs[jobId]) {
      index.jobs[jobId] = {
        jobId,
        created: false,
        applied: false,
        completionRequested: false,
        disputed: false,
        disputeResolved: false,
        completed: false,
        cancelled: false,
        createdBlock: null,
        lastActivityBlock: null,
      };
    }
    return index.jobs[jobId];
  }

  function ensureNftEntry(index, tokenId) {
    if (!index.nfts[tokenId]) {
      index.nfts[tokenId] = {
        tokenId,
        issued: false,
        listed: false,
        purchased: false,
        delisted: false,
        activeListing: false,
        lastListPrice: null,
        lastListedBy: null,
        issuedBlock: null,
        lastActivityBlock: null,
      };
    }
    return index.nfts[tokenId];
  }

  function toIdString(value) {
    if (typeof value === "bigint") return value.toString();
    if (value == null) return "0";
    return value.toString();
  }

  function applyEventToIndex(index, event) {
    const { eventName, blockNumber } = event;
    if (!eventName) return;
    if (eventName.startsWith("Job")) {
      const jobId = toIdString(event.args?.jobId ?? event.args?.[0]);
      const entry = ensureJobEntry(index, jobId);
      if (eventName === "JobCreated") {
        entry.created = true;
        entry.createdBlock = entry.createdBlock ?? blockNumber;
      } else if (eventName === "JobApplied") {
        entry.applied = true;
      } else if (eventName === "JobCompletionRequested") {
        entry.completionRequested = true;
      } else if (eventName === "JobDisputed") {
        entry.disputed = true;
      } else if (eventName === "JobCompleted") {
        entry.completed = true;
      } else if (eventName === "JobCancelled") {
        entry.cancelled = true;
      }
      entry.lastActivityBlock = blockNumber;
    } else if (eventName === "DisputeResolved") {
      const jobId = toIdString(event.args?.jobId ?? event.args?.[0]);
      const entry = ensureJobEntry(index, jobId);
      entry.disputed = false;
      entry.disputeResolved = true;
      entry.lastActivityBlock = blockNumber;
    } else if (eventName.startsWith("NFT")) {
      const tokenId = toIdString(event.args?.tokenId ?? event.args?.[0]);
      const entry = ensureNftEntry(index, tokenId);
      if (eventName === "NFTIssued") {
        entry.issued = true;
        entry.issuedBlock = entry.issuedBlock ?? blockNumber;
      } else if (eventName === "NFTListed") {
        entry.listed = true;
        entry.activeListing = true;
        entry.lastListedBy = event.args?.seller ?? event.args?.[1] ?? null;
        entry.lastListPrice = event.args?.price ?? event.args?.[2] ?? null;
      } else if (eventName === "NFTPurchased") {
        entry.purchased = true;
        entry.activeListing = false;
      } else if (eventName === "NFTDelisted") {
        entry.delisted = true;
        entry.activeListing = false;
      }
      entry.lastActivityBlock = blockNumber;
    }
  }

  const api = {
    sortLogs,
    applyEventToIndex,
    ensureJobEntry,
    ensureNftEntry,
    toIdString,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.AGIJobManagerIndexer = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
