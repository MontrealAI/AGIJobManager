(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.AGIJMErrorDecoder = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const customErrorHints = {
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

  const panicCodeMap = {
    0x01: "Assertion violated.",
    0x11: "Arithmetic overflow/underflow.",
    0x12: "Division by zero.",
    0x21: "Invalid enum value.",
    0x22: "Invalid storage byte array access.",
    0x31: "Pop from empty array.",
    0x32: "Array index out of bounds.",
    0x41: "Memory allocation overflow.",
    0x51: "Zero-initialized function pointer.",
  };

  function getSelector(name) {
    const signature = `${name}()`;
    if (typeof globalThis !== "undefined") {
      const maybeEthers = globalThis.ethers;
      if (maybeEthers && typeof maybeEthers.id === "function") {
        return maybeEthers.id(signature).slice(0, 10);
      }
      const maybeWeb3 = globalThis.web3;
      if (maybeWeb3 && maybeWeb3.utils && typeof maybeWeb3.utils.sha3 === "function") {
        return maybeWeb3.utils.sha3(signature).slice(0, 10);
      }
    }
    return null;
  }

  function buildSelectorMap() {
    const map = {};
    Object.keys(customErrorHints).forEach((name) => {
      const selector = getSelector(name);
      if (selector) {
        map[selector.toLowerCase()] = name;
      }
    });
    return map;
  }

  function extractRevertData(err) {
    if (!err) return null;
    return (
      err.data ||
      err.error?.data ||
      err.info?.error?.data ||
      err.info?.error?.error?.data ||
      err.cause?.data ||
      null
    );
  }

  function decodeErrorString(data) {
    const payload = data.slice(10);
    if (!payload) return null;
    if (typeof globalThis !== "undefined" && globalThis.ethers && globalThis.ethers.AbiCoder) {
      const coder = typeof globalThis.ethers.AbiCoder.defaultAbiCoder === "function"
        ? globalThis.ethers.AbiCoder.defaultAbiCoder()
        : new globalThis.ethers.AbiCoder();
      const decoded = coder.decode(["string"], `0x${payload}`);
      return decoded?.[0] || null;
    }
    if (typeof Buffer !== "undefined") {
      try {
        const offset = parseInt(payload.slice(0, 64), 16) * 2;
        const length = parseInt(payload.slice(64 + offset, 128 + offset), 16) * 2;
        const start = 128 + offset;
        const hex = payload.slice(start, start + length);
        return Buffer.from(hex, "hex").toString("utf8");
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  function decodePanic(data) {
    const payload = data.slice(10);
    if (typeof globalThis !== "undefined" && globalThis.ethers && globalThis.ethers.AbiCoder) {
      const coder = typeof globalThis.ethers.AbiCoder.defaultAbiCoder === "function"
        ? globalThis.ethers.AbiCoder.defaultAbiCoder()
        : new globalThis.ethers.AbiCoder();
      const decoded = coder.decode(["uint256"], `0x${payload}`);
      return Number(decoded?.[0]);
    }
    if (payload.length >= 64) {
      try {
        return Number(BigInt(`0x${payload.slice(0, 64)}`));
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  function decodeRevertData({ data, jmInterface, tokenInterface }) {
    if (!data) {
      return { kind: "unknown", name: null, message: null, hint: null, rawData: null };
    }
    const selector = data.slice(0, 10).toLowerCase();

    if (jmInterface && typeof jmInterface.parseError === "function") {
      try {
        const parsed = jmInterface.parseError(data);
        if (parsed) {
          const meta = customErrorHints[parsed.name] || {};
          return {
            kind: "custom",
            name: parsed.name,
            message: meta.message || null,
            hint: meta.hint || null,
            rawData: data,
          };
        }
      } catch (error) {
        // ignore
      }
    }

    if (tokenInterface && typeof tokenInterface.parseError === "function") {
      try {
        const parsed = tokenInterface.parseError(data);
        if (parsed) {
          return {
            kind: "custom",
            name: parsed.name,
            message: "Token contract error.",
            hint: "Check token balance/allowance and token status, then retry.",
            rawData: data,
          };
        }
      } catch (error) {
        // ignore
      }
    }

    const selectorMap = buildSelectorMap();
    if (selectorMap[selector]) {
      const name = selectorMap[selector];
      const meta = customErrorHints[name] || {};
      return {
        kind: "custom",
        name,
        message: meta.message || null,
        hint: meta.hint || null,
        rawData: data,
      };
    }

    if (selector === "0x08c379a0") {
      const revertString = decodeErrorString(data);
      return {
        kind: "revertString",
        name: "Error",
        message: revertString || "Execution reverted.",
        hint: null,
        rawData: data,
      };
    }

    if (selector === "0x4e487b71") {
      const code = decodePanic(data);
      const mapped = code !== null ? panicCodeMap[code] : null;
      return {
        kind: "panic",
        name: "Panic",
        message: mapped || "Unexpected panic.",
        hint: code !== null ? `Panic code 0x${code.toString(16)}.` : null,
        rawData: data,
      };
    }

    return { kind: "unknown", name: null, message: null, hint: null, rawData: data };
  }

  function isUserRejected(err) {
    const code = err?.code;
    const message = err?.message || "";
    return code === "ACTION_REJECTED" || code === 4001 || /user rejected/i.test(message);
  }

  function friendlyError(err, ctx = {}) {
    if (isUserRejected(err)) {
      return "Transaction rejected in wallet.";
    }

    const data = extractRevertData(err);
    const jmInterface = ctx?.jm?.interface || ctx?.jmInterface || null;
    const tokenInterface = ctx?.token?.interface || ctx?.tokenInterface || null;
    const decoded = decodeRevertData({ data, jmInterface, tokenInterface });

    if (decoded.kind === "custom") {
      const message = decoded.message || "Execution reverted.";
      const hint = decoded.hint ? `Fix: ${decoded.hint}` : "";
      return `${decoded.name}: ${message}${hint ? `\n${hint}` : ""}`;
    }

    if (decoded.kind === "revertString") {
      return `Reverted: ${decoded.message}`;
    }

    if (decoded.kind === "panic") {
      const hint = decoded.hint ? ` ${decoded.hint}` : "";
      return `Panic: ${decoded.message}${hint}`;
    }

    return err?.shortMessage || err?.message || "Transaction failed.";
  }

  return {
    customErrorHints,
    extractRevertData,
    decodeRevertData,
    friendlyError,
  };
});
