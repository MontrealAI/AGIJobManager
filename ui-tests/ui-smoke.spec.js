const path = require("path");
const { test, expect } = require("@playwright/test");

function resolveEthersUmd() {
  const entryPath = require.resolve("ethers");
  return path.join(path.dirname(entryPath), "..", "dist", "ethers.umd.min.js");
}

function buildProviderScript(rpcUrl) {
  return `
    (() => {
      const rpcUrl = ${JSON.stringify(rpcUrl)};
      const listeners = {};
      const sendRpc = async (method, params = []) => {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
        });
        const payload = await response.json();
        if (payload.error) {
          throw new Error(payload.error.message || "RPC error");
        }
        return payload.result;
      };
      window.ethereum = {
        isMetaMask: false,
        request: async ({ method, params }) => {
          if (method === "eth_requestAccounts") {
            return sendRpc("eth_accounts", []);
          }
          const nextParams = Array.isArray(params) ? [...params] : [];
          if ((method === "eth_call" || method === "eth_estimateGas") && nextParams[0] && !nextParams[0].from) {
            const [from] = await sendRpc("eth_accounts", []);
            if (from) {
              nextParams[0] = { ...nextParams[0], from };
            }
          }
          return sendRpc(method, nextParams);
        },
        on: (event, handler) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        },
        removeListener: (event, handler) => {
          if (!listeners[event]) return;
          listeners[event] = listeners[event].filter((fn) => fn !== handler);
        },
      };
      window.ethereum.send = (method, params) => window.ethereum.request({ method, params });
      window.ethereum.sendAsync = (payload, callback) => {
        window.ethereum
          .request({ method: payload.method, params: payload.params || [] })
          .then((result) => callback(null, { jsonrpc: "2.0", id: payload.id, result }))
          .catch((error) => callback(error, null));
      };
    })();
  `;
}

test.describe("AGIJobManager UI smoke", () => {
  test("connects, refreshes, approves, and creates a job", async ({ page }) => {
    test.setTimeout(120000);
    const baseUrl = process.env.UI_BASE_URL;
    const contractAddress = process.env.UI_CONTRACT;
    const rpcUrl = process.env.UI_RPC_URL;

    if (!baseUrl || !contractAddress || !rpcUrl) {
      throw new Error("Missing UI_BASE_URL, UI_CONTRACT, or UI_RPC_URL env vars.");
    }

    const errors = [];
    page.on("pageerror", (error) => errors.push(error));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(new Error(msg.text()));
      }
    });
    page.on("dialog", (dialog) => {
      errors.push(new Error(`Dialog: ${dialog.message()}`));
      dialog.dismiss().catch(() => {});
    });

    await page.route("https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.umd.min.js", async (route) => {
      await route.fulfill({
        path: resolveEthersUmd(),
        contentType: "application/javascript",
      });
    });

    await page.route("**/agijobmanager.html*", async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      body = body.replace(/integrity=\"[^\"]*\"/g, "");
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body,
      });
    });

    await page.route(rpcUrl, async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        });
        return;
      }
      const response = await route.fetch();
      const body = await response.body();
      await route.fulfill({
        status: response.status(),
        headers: {
          ...response.headers(),
          "access-control-allow-origin": "*",
        },
        body,
      });
    });

    await page.addInitScript(buildProviderScript(rpcUrl));

    await page.goto(`${baseUrl}/ui/agijobmanager.html?contract=${contractAddress}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("#activityLog")).toContainText("External ABI loaded.");

    const envProbe = await page.evaluate(() => ({
      hasEthers: Boolean(window.ethers),
      hasEthereum: Boolean(window.ethereum),
      hasRequest: Boolean(window.ethereum && window.ethereum.request),
    }));
    expect(envProbe.hasEthers).toBe(true);
    expect(envProbe.hasEthereum).toBe(true);
    expect(envProbe.hasRequest).toBe(true);

    const accountProbe = await page.evaluate(async () => {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        return { accounts };
      } catch (error) {
        return { error: error?.message || String(error) };
      }
    });
    if (accountProbe.error) {
      throw new Error(`EIP-1193 probe failed: ${accountProbe.error}`);
    }
    if (!Array.isArray(accountProbe.accounts) || accountProbe.accounts.length === 0) {
      throw new Error("EIP-1193 probe returned no accounts.");
    }

    await page.click("#connectButton");
    await expect(page.locator("#walletAddress")).not.toContainText("Not connected", { timeout: 10000 });
    await expect(page.locator("#networkPill")).toContainText("Connected", { timeout: 10000 });

    await page.click("#refreshSnapshot");
    await expect(page.locator("#contractOwner")).not.toHaveText("—");
    await expect(page.locator("#agiToken")).not.toHaveText("—");

    await expect(page.locator("#approveToken")).toBeEnabled();

    await page.fill("#approveAmount", "1");
    await page.click("#approveToken");
    await page.waitForTimeout(500);
    if (errors.length) {
      throw errors[0];
    }
    await expect(page.locator("#activityLog")).toContainText("approve confirmed", { timeout: 20000 });

    await page.fill("#jobIpfs", "QmUiSmokeJob");
    await page.fill("#jobPayout", "1");
    await page.fill("#jobDuration", "3600");
    await page.fill("#jobDetails", "UI smoke test job");
    await expect(page.locator("#jobDuration")).toHaveValue("3600");
    await page.click("#createJob");
    await page.waitForTimeout(500);
    if (errors.length) {
      throw errors[0];
    }
    await expect(page.locator("#activityLog")).toContainText("Create job confirmed", { timeout: 20000 });

    await page.click("#loadJobs");
    await expect(page.locator("#jobsTable tr")).toHaveCount(1);

    expect(errors).toEqual([]);
  });
});
