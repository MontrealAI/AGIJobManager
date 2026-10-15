import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { workflows, renderWorkflows } from "../../site/workflows.mjs";
const sources = JSON.parse(fs.readFileSync("site/workflow-sources.json"));
test("all tracked original demo/example/experiment paths are assigned exactly once", () => {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .trim()
    .split("\n");
  const named = tracked.filter(
    (p) =>
      /(^|\/)(examples|samples|demo|demos)(\/|\.)/.test(p) ||
      /(^|\/)demo\.(mjs|tsx|ts|md)$/i.test(p) ||
      p.startsWith("experiments/")
  );
  const listed = Object.values(sources).flat();
  assert.equal(new Set(listed).size, listed.length);
  for (const p of named) assert.ok(listed.includes(p), p);
  for (const p of listed) assert.ok(fs.existsSync(p), p);
  assert.deepEqual(
    Object.keys(sources).sort(),
    workflows.map((w) => w.id).sort()
  );
  for (const w of workflows) assert.ok(fs.existsSync(w.guide));
});
test("static bilingual directory preserves all families and safely escapes supplied metadata", () => {
  for (const lang of ["en", "fr"]) {
    const html = renderWorkflows(lang, {
      commit: "a".repeat(40),
      version: "<script>",
      sources,
    });
    assert.equal((html.match(/<article /g) || []).length, 8);
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("ui/src/app/demo/page.tsx"));
    assert.ok(html.includes("workforce-10000/simulate.py"));
    assert.ok(
      html.includes(lang === "fr" ? "../../workflows/" : "../fr/workflows/")
    );
  }
  assert.throws(() =>
    renderWorkflows("en", { commit: '"', version: "1", sources })
  );
});
