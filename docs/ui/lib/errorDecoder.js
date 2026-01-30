(() => {
  const customErrorCatalog = {
    NotModerator: {
      message: "Only a moderator can perform this action.",
      hint: "Ask the contract owner to add your address via addModerator(), then retry.",
    },
    NotAuthorized: {
      message: "You don’t have the required role / identity proof for this action.",
      hint: "For agents/validators: ensure your wallet controls the ENS subdomain label you entered (NameWrapper/Resolver), OR provide a valid Merkle proof, OR be explicitly whitelisted via additionalAgents/additionalValidators.",
    },
    Blacklisted: {
      message: "Your address is blacklisted for this role.",
      hint: "Contact the owner/moderators to remove the blacklist entry, then retry.",
    },
    InvalidParameters: {
      message: "Invalid parameters.",
      hint: "Check payout/duration bounds (payout>0, duration>0, payout<=maxJobPayout, duration<=jobDurationLimit).",
    },
    InvalidState: {
      message: "Action not valid in the current job state.",
      hint: "Check job is assigned/not completed; completion requests must be within duration; disputes only when not completed; validations only when assigned and not completed; etc.",
    },
    JobNotFound: {
      message: "Job not found (may be deleted/cancelled).",
      hint: "Confirm the Job ID exists and hasn’t been delisted/cancelled.",
    },
    TransferFailed: {
      message: "Token transfer failed.",
      hint: "Check token balance/allowance; approve the JobManager for the required amount; ensure token is not paused/blocked.",
    },
  };

  const panicCodes = {
    0x01: "Assertion violated.",
    0x11: "Arithmetic overflow/underflow.",
    0x12: "Division or modulo by zero.",
    0x21: "Enum conversion out of bounds.",
    0x22: "Incorrectly encoded storage byte array.",
    0x31: "Pop on empty array.",
    0x32: "Array index out of bounds.",
    0x41: "Memory allocation overflow.",
    0x51: "Zero-initialized function pointer.",
  };

  const hasEthers = () => typeof ethers !== "undefined" && ethers && typeof ethers.id === "function";

  function computeSelector(signature) {
    if (hasEthers()) {
      return ethers.id(signature).slice(0, 10);
    }
    if (typeof module !== "undefined" && module.exports && typeof require === "function") {
      try {
        const keccak256 = require("keccak256");
        return `0x${keccak256(signature).toString("hex").slice(0, 8)}`;
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  const selectorLookup = Object.keys(customErrorCatalog).reduce((acc, name) => {
    const selector = computeSelector(`${name}()`);
    if (selector) {
      acc[selector] = name;
    }
    return acc;
  }, {});

  function extractRevertData(err) {
    if (!err) return null;
    const candidates = [
      err.data,
      err.error?.data,
      err.info?.error?.data,
      err.info?.error?.error?.data,
      err.cause?.data,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (typeof candidate === "string") return candidate;
      if (typeof candidate?.data === "string") return candidate.data;
    }
    return null;
  }

  function decodeErrorString(data) {
    if (!hasEthers()) return null;
    try {
      const coder = ethers.AbiCoder.defaultAbiCoder();
      const decoded = coder.decode(["string"], `0x${data.slice(10)}`);
      return decoded?.[0] || null;
    } catch (error) {
      return null;
    }
  }

  function decodePanic(data) {
    if (!hasEthers()) return null;
    try {
      const coder = ethers.AbiCoder.defaultAbiCoder();
      const decoded = coder.decode(["uint256"], `0x${data.slice(10)}`);
      return decoded?.[0];
    } catch (error) {
      return null;
    }
  }

  function formatCustomError(name, args) {
    const entry = customErrorCatalog[name];
    const message = entry?.message || `Contract error: ${name}.`;
    const hint = entry?.hint || "Review inputs and permissions, then retry.";
    return {
      kind: "custom",
      name,
      message,
      hint,
      args,
    };
  }

  function decodeRevertData({ data, jmInterface, tokenInterface }) {
    if (!data || typeof data !== "string") {
      return { kind: "unknown", name: null, message: "Transaction failed.", hint: null, rawData: data || null };
    }
    const rawData = data;
    if (jmInterface?.parseError) {
      try {
        const parsed = jmInterface.parseError(data);
        if (parsed?.name) {
          return { ...formatCustomError(parsed.name, parsed.args), rawData };
        }
      } catch (error) {
        // ignore and try other paths
      }
    }
    if (tokenInterface?.parseError) {
      try {
        const parsed = tokenInterface.parseError(data);
        if (parsed?.name) {
          return {
            kind: "custom",
            name: parsed.name,
            message: `Token error: ${parsed.name}.`,
            hint: "Check token configuration and retry.",
            rawData,
          };
        }
      } catch (error) {
        // ignore and try other paths
      }
    }

    const selector = data.slice(0, 10);
    if (selectorLookup[selector]) {
      return { ...formatCustomError(selectorLookup[selector]), rawData };
    }

    if (selector === "0x08c379a0") {
      const decoded = decodeErrorString(data);
      if (decoded) {
        return {
          kind: "revertString",
          name: "Error",
          message: decoded,
          hint: "Review the inputs and try again.",
          rawData,
        };
      }
    }

    if (selector === "0x4e487b71") {
      const decoded = decodePanic(data);
      if (decoded !== null && decoded !== undefined) {
        const code = Number(decoded);
        return {
          kind: "panic",
          name: "Panic",
          message: panicCodes[code] || `EVM panic code ${code}.`,
          hint: "Check for arithmetic or bounds issues in inputs.",
          rawData,
        };
      }
    }

    return { kind: "unknown", name: null, message: "Transaction failed.", hint: null, rawData };
  }

  function isActionRejected(err) {
    const code = err?.code || err?.info?.error?.code;
    return code === "ACTION_REJECTED" || code === 4001;
  }

  function isNetworkError(err) {
    const code = err?.code;
    if (["NETWORK_ERROR", "SERVER_ERROR", "TIMEOUT", "UNKNOWN_ERROR"].includes(code)) {
      return true;
    }
    const message = (err?.message || "").toLowerCase();
    return message.includes("network") || message.includes("rpc") || message.includes("failed to fetch");
  }

  function friendlyError(err, ctx = {}) {
    if (isActionRejected(err)) {
      return "Transaction rejected in wallet.";
    }

    const data = extractRevertData(err);
    const decoded = decodeRevertData({
      data,
      jmInterface: ctx.jm?.interface || ctx.jmInterface,
      tokenInterface: ctx.token?.interface || ctx.tokenInterface,
    });

    if (decoded.kind !== "unknown") {
      const header = decoded.name ? `${decoded.name}: ${decoded.message}` : decoded.message;
      return decoded.hint ? `${header}\nFix: ${decoded.hint}` : header;
    }

    if (isNetworkError(err)) {
      const message = err?.shortMessage || err?.message || "Network/RPC error.";
      return `${message}\nFix: Check your wallet connection and RPC endpoint, then retry.`;
    }

    return err?.shortMessage || err?.message || "Transaction failed.";
  }

  const exported = {
    extractRevertData,
    decodeRevertData,
    friendlyError,
    customErrorCatalog,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  } else {
    window.AGIJMErrorDecoder = exported;
  }
})();
