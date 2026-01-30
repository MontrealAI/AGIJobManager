const { test, expect } = require("@playwright/test");

const defaultRpcUrl = "http://127.0.0.1:8545";

function buildRpcProviderScript(rpcUrl) {
  return ({ rpcUrl: injectedRpcUrl }) => {
    const url = injectedRpcUrl || rpcUrl;
    let requestId = 1;
    let cachedAccounts = [];
    const withDefaultFrom = (params) => {
      if (!Array.isArray(params) || params.length === 0) return params;
      const [tx, blockTag] = params;
      if (tx && !tx.from && cachedAccounts.length > 0) {
        return [{ ...tx, from: cachedAccounts[0] }, blockTag];
      }
      return params;
    };
    const rpc = async (method, params = []) => {
      const requestPayload = JSON.stringify(
        { jsonrpc: "2.0", id: requestId++, method, params },
        (key, value) => (typeof value === "bigint" ? `0x${value.toString(16)}` : value)
      );
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: requestPayload,
      });
      const responsePayload = await response.json();
      if (responsePayload.error) {
        throw new Error(responsePayload.error.message || "RPC error");
      }
      return responsePayload.result;
    };

    window.ethereum = {
      isMetaMask: true,
      request: async ({ method, params }) => {
        const normalizedParams = Array.isArray(params) ? params : (params == null ? [] : [params]);
        if (method === "eth_requestAccounts") {
          cachedAccounts = await rpc("eth_accounts");
          window.ethereum.selectedAddress = cachedAccounts[0] || null;
          return cachedAccounts;
        }
        if (method === "eth_accounts") {
          cachedAccounts = await rpc("eth_accounts");
          window.ethereum.selectedAddress = cachedAccounts[0] || null;
          return cachedAccounts;
        }
        if (method === "eth_call" || method === "eth_estimateGas" || method === "eth_sendTransaction") {
          return rpc(method, withDefaultFrom(normalizedParams));
        }
        return rpc(method, normalizedParams);
      },
      on: () => {},
      removeListener: () => {},
    };
  };
}

test.describe("AGIJobManager UI smoke", () => {
  test("connects, refreshes, and creates a job", async ({ page }) => {
    const baseUrl = process.env.AGIJOBMANAGER_UI_URL;
    const contractAddress = process.env.AGIJOBMANAGER_ADDRESS;
    const rpcUrl = process.env.AGIJOBMANAGER_RPC_URL || defaultRpcUrl;

    if (!baseUrl) throw new Error("Missing AGIJOBMANAGER_UI_URL env var.");
    if (!contractAddress) throw new Error("Missing AGIJOBMANAGER_ADDRESS env var.");

    const errors = [];
    page.on("pageerror", (error) => errors.push(error));
    page.on("dialog", async (dialog) => {
      errors.push(new Error(`Dialog: ${dialog.message()}`));
      await dialog.dismiss();
    });

    await page.addInitScript(buildRpcProviderScript(rpcUrl), { rpcUrl });
    await page.goto(`${baseUrl}?contract=${contractAddress}`, { waitUntil: "networkidle" });

    await expect(page.locator("#activityLog")).toContainText("External ABI loaded.");
    await page.waitForFunction(() => window.ethers && window.ethers.BrowserProvider, { timeout: 10000 });
    await page.waitForFunction(() => window.ethereum && typeof window.ethereum.request === "function", { timeout: 10000 });

    const rpcCheck = await page.evaluate(async () => {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        return { accounts };
      } catch (error) {
        return { error: error.message || String(error) };
      }
    });
    if (rpcCheck.error) {
      throw new Error(`RPC stub failed: ${rpcCheck.error}`);
    }
    if (!rpcCheck.accounts || rpcCheck.accounts.length === 0) {
      throw new Error("RPC stub returned no accounts.");
    }

    const contractInput = page.locator("#contractAddress");
    if ((await contractInput.inputValue()) === "") {
      await contractInput.fill(contractAddress);
      await page.click("#saveContract");
    }

    await page.click("#connectButton");
    await page.waitForTimeout(500);
    if (errors.length) {
      const messages = errors.map((error) => error.message || String(error)).join("\n");
      throw new Error(`UI errors detected after connect:\n${messages}`);
    }
    await expect(page.locator("#networkPill")).toContainText("Connected");
    await expect(page.locator("#walletAddress")).not.toHaveText("Not connected");

    await page.click("#refreshSnapshot");
    await expect(page.locator("#contractOwner")).not.toHaveText("—");
    await expect(page.locator("#agiToken")).not.toHaveText("—");

    await page.click("#refreshRoles");
    await expect(page.locator("#approveToken")).toBeEnabled();
    await page.fill("#approveAmount", "10");
    await page.click("#approveToken");
    await page.waitForTimeout(500);
    if (errors.length) {
      const messages = errors.map((error) => error.message || String(error)).join("\n");
      throw new Error(`UI errors detected after approve:\n${messages}`);
    }
    await expect(page.locator("#activityLog")).toContainText("Employer approve confirmed", { timeout: 20000 });

    await page.fill("#jobIpfs", "QmTestJobHash");
    await page.fill("#jobPayout", "1");
    await page.fill("#jobDuration", "3600");
    await page.fill("#jobDetails", "UI smoke test");
    await page.evaluate(() => {
      const input = document.getElementById("jobDuration");
      input.value = "3600";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.locator("#jobDuration")).toHaveValue("3600");
    const durationDetails = await page.evaluate(() => {
      const value = document.getElementById("jobDuration").value;
      return { value, codes: Array.from(value).map((char) => char.charCodeAt(0)) };
    });
    if (!/^\d+$/.test(durationDetails.value.trim())) {
      throw new Error(`Job duration input is not an integer before submit: "${durationDetails.value}" (${durationDetails.codes.join(",")})`);
    }
    await page.click("#createJob");
    await page.waitForTimeout(500);
    if (errors.length) {
      const messages = errors.map((error) => error.message || String(error)).join("\n");
      throw new Error(`UI errors detected after create job:\n${messages}`);
    }
    await expect(page.locator("#activityLog")).toContainText("Create job confirmed", { timeout: 20000 });

    await page.click("#loadJobs");
    await expect(page.locator("#jobsTable tr")).toHaveCount(1, { timeout: 20000 });

    if (errors.length) {
      const messages = errors.map((error) => error.message || String(error)).join("\n");
      throw new Error(`UI errors detected:\n${messages}`);
    }
  });
});
