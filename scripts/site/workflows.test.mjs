import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { workflows, renderWorkflows } from "../../site/workflows.mjs";
const sources = JSON.parse(fs.readFileSync("site/workflow-sources.json"));
const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .trim()
  .split("\n");
function verifyCoverage(mapping) {
  const named = tracked.filter(
    (p) =>
      /(^|\/)(examples|samples|demo|demos)(\/|\.)/.test(p) ||
      /(^|\/)demo\.(mjs|tsx|ts|md)$/i.test(p) ||
      p.startsWith("experiments/")
  );
  const listed = Object.values(mapping).flat();
  assert.equal(new Set(listed).size, listed.length);
  for (const p of named) assert.ok(listed.includes(p), p);
  for (const p of listed) assert.ok(fs.existsSync(p), p);
  assert.deepEqual(
    Object.keys(mapping).sort(),
    workflows.map((w) => w.id).sort()
  );
  for (const w of workflows) assert.ok(fs.existsSync(w.guide));
}
test("all tracked original demo/example/experiment paths are assigned exactly once", () => {
  verifyCoverage(sources);
});
test("all eight original families stay exact while native receiver copies have their own workflow", async () => {
  const original = (file) => execFileSync("git", ["show", "d0c2cbaf58b594e20d888c3fc744bada06172306:" + file], { encoding: "utf8" });
  const originalSourcesRaw = original("site/workflow-sources.json");
  const originalSources = JSON.parse(originalSourcesRaw);
  const originalWorkflows = await import("data:text/javascript;base64," + Buffer.from(original("site/workflows.mjs")).toString("base64"));
  assert.deepEqual(workflows.slice(0, 8), originalWorkflows.workflows);
  assert.deepEqual(Object.fromEntries(Object.entries(sources).filter(([id]) => id !== "computer-receipt")), originalSources);
  assert.ok(fs.readFileSync("site/workflow-sources.json", "utf8").startsWith(originalSourcesRaw.trimEnd().slice(0, -1).trimEnd() + ",\n"), "Original source mapping entries retain their bytes");
  const native = tracked.filter(p => p.startsWith("site/assets/computer-receipt/"));
  assert.equal(native.length, 37);
  assert.deepEqual(sources["computer-receipt"], ["site/computer-receipt.mjs", "scripts/integrations/README.md", "scripts/integrations/four-repo-computer-receipt.mjs", ...native]);
  assert.ok(sources.successor.includes("examples/successor/analyst.json"));
  assert.ok(sources["computer-receipt"].includes("site/assets/computer-receipt/vendor/alpha-computer/examples/build-successor/model.mjs"));
});
test("missing or duplicated original examples and native dependency copies fail coverage", () => {
  for (const [family, name] of [
    ["successor", "examples/successor/analyst.json"],
    ["computer-receipt", "site/assets/computer-receipt/vendor/alpha-computer/examples/build-successor/model.mjs"],
  ]) {
    const missing = structuredClone(sources);
    missing[family] = missing[family].filter(p => p !== name);
    assert.throws(() => verifyCoverage(missing), { message: name });
    const duplicate = structuredClone(sources);
    duplicate[family].push(name);
    assert.throws(() => verifyCoverage(duplicate), /strictly equal/);
  }
});
test("static bilingual directory preserves all families and safely escapes supplied metadata", () => {
  for (const lang of ["en", "fr"]) {
    const html = renderWorkflows(lang, {
      commit: "a".repeat(40),
      version: "<script>",
      sources,
    });
    assert.equal((html.match(/<article /g) || []).length, 9);
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("ui/src/app/demo/page.tsx"));
    assert.ok(html.includes("workforce-10000/simulate.py"));
    assert.ok(html.includes('id="computer-receipt"'));
    assert.ok(html.includes('href="../computer-receipt/"'));
    assert.ok(html.includes(lang === "fr" ? "déclarations historiques non vérifiées" : "historical, unverified claims"));
    assert.ok(
      html.includes(lang === "fr" ? "../../workflows/" : "../fr/workflows/")
    );
  }
  assert.throws(() =>
    renderWorkflows("en", { commit: '"', version: "1", sources })
  );
});
