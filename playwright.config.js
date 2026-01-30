const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "ui-tests",
  testMatch: "**/*.spec.js",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: {
    headless: true,
    baseURL: process.env.UI_BASE_URL || "http://127.0.0.1:4173",
  },
  reporter: [["list"]],
});
