import test from "node:test";
import assert from "node:assert/strict";
import {
  CONSOLE_DRAFT_KEY,
  DRAFT_SCHEMA,
  LIMITS,
  TEMPLATES,
  PRIMARY_TEMPLATE_IDS,
  emptyDraft,
  templateFields,
  normalizeBudget,
  durationSeconds,
  publicInputURLs,
  parseDraft,
  validateDraft,
  toMetadata,
  toConsoleDraft,
  toReadableBrief,
  draftTitle,
} from "../../site/assets/employer-model.mjs";
function complete() {
  const draft = emptyDraft();
  draft.template = "performance";
  Object.assign(draft.fields, templateFields(draft.template), {
    inputs:
      "https://github.com/MontrealAI/AGIJobManager\nhttps://montrealai.github.io/AGIJobManager/",
  });
  return draft;
}
test("fourteen templates retain legacy IDs and offer six simple starting points", () => {
  assert.equal(TEMPLATES.length, 14);
  assert.equal(new Set(TEMPLATES.map(({ id }) => id)).size, 14);
  assert.deepEqual(PRIMARY_TEMPLATE_IDS, [
    "website",
    "intelligence",
    "presentation",
    "report",
    "dashboard",
    "custom",
  ]);
  for (const id of [
    "performance",
    "feature",
    "sdk",
    "tests",
    "evals",
    "dashboard",
    "demo",
    "intelligence",
    "docs",
    "reproduction",
  ])
    assert.ok(TEMPLATES.some((item) => item.id === id));
  for (const item of TEMPLATES)
    for (const lang of ["en", "fr"]) {
      const draft = complete();
      draft.template = item.id;
      Object.assign(draft.fields, templateFields(item.id, lang));
      if (item.id === "custom") {
        assert.deepEqual(
          validateDraft(draft).map(({ field }) => field),
          ["summary", "deliverables", "acceptance"],
        );
      } else {
        assert.deepEqual(validateDraft(draft), []);
        for (const key of ["title", "summary", "deliverables", "acceptance"])
          assert.ok(draft.fields[key].length > 10);
      }
    }
});
test("empty draft blocks selection and later stages while allowing incomplete saves", () => {
  const draft = emptyDraft();
  assert.deepEqual(validateDraft(draft, 0), [
    { field: "template", code: "template" },
  ]);
  assert.ok(validateDraft(draft, 1).some(({ field }) => field === "summary"));
  assert.ok(
    !validateDraft(draft, 1).some(({ field }) =>
      ["inputs", "title"].includes(field),
    ),
  );
  assert.deepEqual(parseDraft(JSON.stringify(draft)), draft);
});
test("decimal amounts remain exact beyond JavaScript's safe integer range", () => {
  const draft = complete();
  draft.fields.budget = "999999999999999999.123456";
  const metadata = toMetadata(draft, "en", "2026-10-10T00:00:00.000Z"),
    consoleDraft = toConsoleDraft(draft);
  assert.equal(metadata.properties.payoutUSDC, draft.fields.budget);
  assert.equal(
    metadata.attributes.find(({ trait_type }) => trait_type === "Payout (USDC)")
      .value,
    draft.fields.budget,
  );
  assert.equal(consoleDraft.jobPayout, draft.fields.budget);
  assert.equal(typeof metadata.properties.payoutUSDC, "string");
  assert.equal(normalizeBudget("0001000.120000"), "1000.12");
  assert.equal(normalizeBudget("0.000001"), "0.000001");
});
test("amounts reject zero, negatives, scientific notation, grouping and excess precision", () => {
  for (const amount of [
    "0",
    "0.000000",
    "-1",
    "1e3",
    "1,000",
    "1 000",
    "1000.0000001",
    ".1",
    "1.",
    "1000000000000000000",
    "Infinity",
    "NaN",
  ])
    assert.throws(() => normalizeBudget(amount), /amount/);
});
test("duration is bounded and maps days to exact seconds", () => {
  assert.equal(durationSeconds("7"), 604800);
  assert.equal(durationSeconds("365"), 31536000);
  for (const value of ["0", "366", "-1", "1.5", "01", "1e2", "", 7])
    assert.throws(() => durationSeconds(value), /days/);
});
test("input URLs allow public HTTPS domains without fetching them", () => {
  assert.deepEqual(
    publicInputURLs(
      " https://github.com/MontrealAI/AGIJobManager \n\nhttps://example.org/dataset?page=1#methods",
    ),
    [
      "https://github.com/MontrealAI/AGIJobManager",
      "https://example.org/dataset?page=1#methods",
    ],
  );
});
test("input URLs reject private-looking endpoints, credentials and active schemes", () => {
  for (const value of [
    "http://example.org",
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/test",
    "https://localhost/test",
    "https://foo.local/",
    "https://service.internal/",
    "https://machine.lan/",
    "https://127.0.0.1/",
    "https://0x7f000001/",
    "https://[::1]/",
    "https://username:password@example.org/",
    "https://example.org/?access_token=secret",
    "https://example.org/?X-Amz-Signature=secret",
    "https://example.org/#api_key=secret",
    "https://example.org/a b",
    "https://example.org./",
  ])
    assert.throws(() => publicInputURLs(value), /inputs/, value);
  assert.throws(
    () => publicInputURLs(Array(11).fill("https://example.org").join("\n")),
    /inputs/,
  );
  assert.throws(
    () => publicInputURLs("https://example.org/" + "a".repeat(2048)),
    /inputs/,
  );
});
test("saved schema rejects malformed, oversized, foreign and partial data", () => {
  const draft = complete();
  for (const raw of [
    "{",
    "null",
    "[]",
    JSON.stringify({ ...draft, schema: "other" }),
    JSON.stringify({ ...draft, stage: 4 }),
    JSON.stringify({ ...draft, template: "other" }),
    JSON.stringify({ ...draft, fields: {} }),
    " ".repeat(65537),
  ])
    assert.throws(() => parseDraft(raw), /draft/);
  for (const [field, max] of Object.entries(LIMITS))
    assert.throws(
      () =>
        parseDraft(
          JSON.stringify({
            ...draft,
            fields: { ...draft.fields, [field]: "a".repeat(max + 1) },
          }),
        ),
      /draft/,
    );
  assert.throws(
    () =>
      parseDraft(
        JSON.stringify({
          ...draft,
          fields: { ...draft.fields, title: "bad\u0000title" },
        }),
      ),
    /draft/,
  );
});
test("draft schema only retains allowed fields and does not mutate prototypes", () => {
  const draft = complete(),
    raw = JSON.stringify({
      ...draft,
      secret: "not-retained",
      fields: { ...draft.fields, ignored: "not-retained" },
    }).replace('"schema":', '"__proto__":{"polluted":true},"schema":');
  assert.deepEqual(parseDraft(raw), draft);
  assert.equal({}.polluted, undefined);
  assert.equal(parseDraft(raw).schema, DRAFT_SCHEMA);
});
test("stage validation allows budget work later but never exports invalid content", () => {
  const draft = complete();
  draft.fields.budget = "0";
  assert.deepEqual(validateDraft(draft, 1), []);
  assert.deepEqual(validateDraft(draft, 2), [
    { field: "budget", code: "budget" },
  ]);
  assert.throws(() => toMetadata(draft), /budget/);
  assert.throws(() => toConsoleDraft(draft), /budget/);
});
test("long checklists are rejected with a field-specific action", () => {
  const draft = complete();
  draft.fields.acceptance = Array(21).fill("Check one thing").join("\n");
  assert.deepEqual(validateDraft(draft), [
    { field: "acceptance", code: "lines" },
  ]);
});
test("metadata matches console schema and remains unbound to accounts or deployments", () => {
  const draft = complete(),
    metadata = toMetadata(draft, "fr", "2026-10-10T00:00:00.000Z");
  assert.equal(metadata.properties.schema, "agijobmanager/job-spec/v1");
  assert.equal(metadata.properties.kind, "job-spec");
  assert.equal(metadata.properties.locale, "fr-CA");
  assert.equal(metadata.properties.durationSeconds, 604800);
  assert.equal(metadata.properties.draftOnly, true);
  assert.equal(metadata.properties.employer, null);
  assert.equal(metadata.properties.chainId, null);
  assert.equal(metadata.properties.contract, null);
  assert.equal(metadata.properties.inputURLs.length, 2);
  assert.equal(metadata.external_url, metadata.properties.inputURLs[0]);
  assert.equal(metadata.properties.generatedAt, "2026-10-10T00:00:00.000Z");
});
test("console handoff uses only existing builder fields, clears stale URI and preserves all inputs", () => {
  const draft = complete(),
    mapped = toConsoleDraft(draft, "fr");
  assert.equal(
    CONSOLE_DRAFT_KEY,
    "agijobmanager_usdc_v096_builder_draft_v11_1",
  );
  assert.deepEqual(
    Object.keys(mapped).sort(),
    [
      "jobTitle",
      "jobCategory",
      "jobTags",
      "jobSummaryBuilder",
      "jobDeliverables",
      "jobAcceptance",
      "jobRequirements",
      "jobImageURI",
      "jobExternalURI",
      "jobSpecVersion",
      "jobLocale",
      "jobPayout",
      "jobDuration",
      "jobDetails",
      "jobSpecURI",
    ].sort(),
  );
  assert.equal(mapped.jobSpecURI, "");
  assert.equal(mapped.jobImageURI, "");
  assert.equal(mapped.jobPayout, "1000");
  assert.equal(mapped.jobDuration, "604800");
  assert.equal(mapped.jobLocale, "fr-CA");
  for (const url of publicInputURLs(draft.fields.inputs))
    assert.ok(mapped.jobSummaryBuilder.includes(url));
});
test("untrusted text is retained as data rather than interpreted or lost", () => {
  const draft = complete();
  draft.fields.title = '<img src=x onerror="window.compromised=true">';
  draft.fields.summary = "<script>alert('test')</script>";
  assert.equal(toMetadata(draft).properties.title, draft.fields.title);
  assert.equal(toConsoleDraft(draft).jobTitle, draft.fields.title);
  assert.deepEqual(parseDraft(JSON.stringify(draft)), draft);
});

test("console transaction details stay below the contract UTF-8 limit", () => {
  const draft = complete();
  draft.fields.title = "界".repeat(LIMITS.title);
  draft.fields.summary = "界".repeat(LIMITS.summary);
  const mapped = toConsoleDraft(draft),
    metadata = toMetadata(draft);
  assert.equal(mapped.jobDetails, draft.fields.title);
  assert.ok(Buffer.byteLength(mapped.jobDetails, "utf8") <= 2048);
  assert.equal(metadata.properties.details, draft.fields.title);
  assert.ok(mapped.jobSummaryBuilder.includes(draft.fields.summary));
  draft.fields.title = "🌌".repeat(LIMITS.title / 2);
  assert.ok(
    Buffer.byteLength(toConsoleDraft(draft).jobDetails, "utf8") <= 2048,
  );
});

test("self-contained requests need no links or separate title", () => {
  const draft = complete();
  draft.fields.inputs = " \n ";
  draft.fields.title = "";
  assert.deepEqual(publicInputURLs(draft.fields.inputs), []);
  assert.deepEqual(validateDraft(draft), []);
  const metadata = toMetadata(draft),
    mapped = toConsoleDraft(draft);
  assert.ok(!Object.hasOwn(metadata, "external_url"));
  assert.deepEqual(metadata.properties.inputURLs, []);
  assert.equal(mapped.jobExternalURI, "");
  assert.equal(mapped.jobSummaryBuilder, draft.fields.summary);
  assert.equal(mapped.jobTitle, draftTitle(draft.fields));
  assert.ok(
    mapped.jobTitle.length > 0 && mapped.jobTitle.length <= LIMITS.title,
  );
  assert.equal(metadata.properties.title, mapped.jobTitle);
  draft.fields.summary = "🌌".repeat(100);
  assert.equal(draftTitle(draft.fields), "🌌".repeat(60));
  assert.ok(
    Buffer.byteLength(toConsoleDraft(draft).jobDetails, "utf8") <= 2048,
  );
});
test("readable copies include the complete request and state the payment boundary in both languages", () => {
  const draft = complete();
  draft.fields.requirements = "Use a readable typeface.";
  for (const lang of ["en", "fr"]) {
    const brief = toReadableBrief(draft, lang);
    for (const field of [
      "title",
      "summary",
      "inputs",
      "deliverables",
      "acceptance",
      "requirements",
    ])
      assert.ok(brief.includes(draft.fields[field]), field);
    assert.ok(brief.includes("1000 USDC"));
    assert.ok(
      brief.includes(
        lang === "fr"
          ? "7 jours après l’attribution"
          : "7 days after assignment",
      ),
    );
    assert.ok(
      brief.includes(
        lang === "fr"
          ? "aucun paiement n’a été effectué"
          : "no payment has been made",
      ),
    );
  }
  draft.fields.inputs = "";
  assert.ok(!toReadableBrief(draft).includes("Public links"));
  draft.fields.summary = "";
  assert.throws(() => toReadableBrief(draft), /required/);
});
