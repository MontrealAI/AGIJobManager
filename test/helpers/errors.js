const { keccak256 } = web3.utils;

function selectorFor(errorName) {
  return keccak256(`${errorName}()`).slice(0, 10);
}

function extractRevertData(error) {
  if (!error) return null;
  if (typeof error.data === "string") return error.data;

  if (error.data && typeof error.data === "object") {
    if (typeof error.data.data === "string") return error.data.data;
    const keys = Object.keys(error.data);
    if (keys.length > 0) {
      const entry = error.data[keys[0]];
      if (typeof entry === "string") return entry;
      return entry?.data || entry?.return || entry?.result || null;
    }
  }

  return null;
}

async function expectCustomError(promise, errorName) {
  try {
    await promise;
  } catch (error) {
    const data = extractRevertData(error);
    const selector = selectorFor(errorName).toLowerCase();
    if (data && data.toLowerCase().startsWith(selector)) {
      return;
    }
    throw new Error(`Expected custom error ${errorName}, got ${data || error.message}`);
  }
  throw new Error(`Expected custom error ${errorName}, but no revert was received.`);
}

module.exports = {
  expectCustomError,
  selectorFor,
  extractRevertData,
};
