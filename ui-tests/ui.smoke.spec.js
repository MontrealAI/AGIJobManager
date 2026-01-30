const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = process.env.UI_BASE_URL || "http://127.0.0.1:4173";
const rpcUrl = process.env.UI_RPC_URL || "http://127.0.0.1:8545";
const contractAddress = process.env.UI_CONTRACT_ADDRESS;

test("connects, refreshes, and creates a job on local chain", async ({ page }) => {
  if (!contractAddress) {
    throw new Error("UI_CONTRACT_ADDRESS must be set for UI smoke tests.");
  }

  const uiHtml = fs.readFileSync(path.join(process.cwd(), "docs", "ui", "agijobmanager.html"), "utf8");
  const patchedHtml = uiHtml.replace(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/ethers@6\.13\.4\/dist\/ethers\.umd\.min\.js"[^>]*><\/script>/,
    '<script src="/ui/ethers.umd.min.js"></script>'
  );

  await page.route("**/ui/agijobmanager.html*", (route) =>
    route.fulfill({ status: 200, body: patchedHtml, contentType: "text/html" })
  );

  page.on("dialog", (dialog) => {
    dialog.dismiss();
  });

  await page.addInitScript(
    ({ rpcUrl }) => {
      const listeners = {};
      const request = async ({ method, params = [] }) => {
        if (method === "eth_requestAccounts") {
          const accounts = await request({ method: "eth_accounts" });
          return accounts;
        }
        if ((method === "eth_call" || method === "eth_estimateGas") && params[0] && !params[0].from) {
          const accounts = await request({ method: "eth_accounts" });
          if (accounts && accounts.length) {
            params[0] = { ...params[0], from: accounts[0] };
          }
        }
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
        });
        const payload = await response.json();
        if (payload.error) {
          console.error("RPC error", method, payload.error);
          throw new Error(payload.error.message || "RPC error");
        }
        return payload.result;
      };

      window.ethereum = {
        request,
        on: (event, handler) => {
          listeners[event] = handler;
        },
        removeListener: (event) => {
          delete listeners[event];
        },
      };
    },
    { rpcUrl }
  );

  await page.goto(`${baseUrl}/ui/agijobmanager.html?contract=${contractAddress}`, { waitUntil: "networkidle" });

  const activityLog = page.locator("#activityLog");
  await expect(activityLog).toContainText("External ABI loaded.");
  await expect(page.locator("#contractAddress")).toHaveValue(contractAddress);

  const accounts = await page.evaluate(() => window.ethereum.request({ method: "eth_accounts" }));
  await expect(accounts.length).toBeGreaterThan(0);

  await page.click("#connectButton");
  await expect(page.locator("#networkPill")).toContainText("Connected");
  await expect(page.locator("#walletAddress")).not.toHaveText("Not connected");

  await page.click("#refreshSnapshot");
  await expect(page.locator("#contractName")).toHaveText("AGIJobs");
  await expect(page.locator("#contractSymbol")).toHaveText("Job");
  await expect(page.locator("#contractOwner")).not.toHaveText("—");
  await expect(page.locator("#agiToken")).not.toHaveText("—");
  await expect(page.locator("#agiTokenSymbol")).not.toHaveText("—");

  await page.fill("#approveAmount", "10");
  await page.click("#approveToken");
  await expect(activityLog).toContainText("✅ Employer approve confirmed");

  await page.fill("#jobIpfs", "QmUiSmokeTest");
  await page.fill("#jobPayout", "1");
  await page.fill("#jobDuration", "60");
  await page.fill("#jobDetails", "UI smoke test job");
  await expect(page.locator("#jobIpfs")).toHaveValue("QmUiSmokeTest");
  await expect(page.locator("#jobPayout")).toHaveValue("1");
  await expect(page.locator("#jobDuration")).toHaveValue("60");
  await page.click("#createJob");
  await expect(activityLog).toContainText("✅ Create job confirmed");
  await expect(page.locator("#contractNextJob")).toHaveText("1");
});
