import { parseUSDC } from "./payments.mjs";

export const DRAFT_KEY = "agijobmanager_employer_onboarding_v1";
export const LANGUAGE_KEY = "agijobmanager_employer_language_v1";
export const CONSOLE_DRAFT_KEY = "agijobmanager_usdc_v096_builder_draft_v11_1";
export const DRAFT_SCHEMA = "agijobmanager/employer-draft/v1";
export const LIMITS = Object.freeze({
  title: 120,
  summary: 3000,
  inputs: 8000,
  deliverables: 4000,
  acceptance: 4000,
  requirements: 2000,
  budget: 25,
  days: 3,
});
const template = (id, category, en, fr) => ({ id, category, en, fr });
const content = (
  title,
  summary,
  deliverables,
  acceptance,
  requirements = "",
) => ({ title, summary, deliverables, acceptance, requirements });
export const TEMPLATES = [
  template(
    "performance",
    "Performance optimization",
    content(
      "Make public software faster",
      "Improve a measured performance bottleneck in a public software project while preserving its documented behavior.",
      "Reviewable patch\nRepeatable before-and-after benchmark\nShort explanation of the trade-offs",
      "Run the same benchmark on the baseline and proposed change.\nDocument the environment and report measurements.\nExisting relevant tests pass; document any known failures.",
    ),
    content(
      "Accélérer un logiciel public",
      "Améliorer un goulot d’étranglement mesuré dans un projet logiciel public en préservant son comportement documenté.",
      "Correctif révisable\nMesure comparative reproductible\nCourte explication des compromis",
      "Exécuter la même mesure sur la version initiale et la version proposée.\nDocumenter l’environnement et présenter les résultats.\nLes tests pertinents existants réussissent; documenter les échecs connus.",
    ),
  ),
  template(
    "feature",
    "Open-source feature",
    content(
      "Add an open-source feature",
      "Implement one clearly scoped feature in a public repository, with tests and instructions for maintainers.",
      "Reviewable implementation\nTests for the agreed behavior\nUpdated usage documentation",
      "Describe the expected behavior and demonstrate it.\nInclude relevant success and error cases in the tests.\nProvide reproducible setup and verification commands.",
    ),
    content(
      "Ajouter une fonction libre",
      "Implémenter une fonction bien délimitée dans un dépôt public, avec des tests et des instructions pour la maintenance.",
      "Implémentation révisable\nTests du comportement convenu\nDocumentation d’utilisation mise à jour",
      "Décrire et démontrer le comportement attendu.\nTester les principaux cas de réussite et d’erreur.\nFournir les commandes reproductibles d’installation et de vérification.",
    ),
  ),
  template(
    "sdk",
    "API and SDK tooling",
    content(
      "Build API or SDK tooling",
      "Create a small client library, command-line tool or integration example for a documented public API, using fixtures or a public sandbox.",
      "Source code and example usage\nFixture-based tests\nInstallation and error-handling guide",
      "Examples run without private credentials.\nTests cover valid responses, errors and timeouts.\nDocument supported API versions and dependencies.",
    ),
    content(
      "Créer un outil API ou SDK",
      "Créer une bibliothèque cliente, un outil en ligne de commande ou un exemple pour une API publique documentée, avec des données simulées ou un environnement de test public.",
      "Code source et exemples\nTests avec données simulées\nGuide d’installation et de gestion des erreurs",
      "Les exemples fonctionnent sans identifiants privés.\nLes tests couvrent les réponses valides, les erreurs et les délais dépassés.\nDocumenter les versions d’API et les dépendances prises en charge.",
    ),
  ),
  template(
    "tests",
    "Automated tests",
    content(
      "Strengthen an automated test suite",
      "Add focused regression tests to a public project for specified behaviors and known edge cases.",
      "Automated tests\nInstructions to run the test suite\nSummary of coverage and remaining gaps",
      "Tests reproduce each agreed behavior and regression.\nDemonstrate that a relevant broken fixture is detected.\nThe suite runs reproducibly without private data.",
    ),
    content(
      "Renforcer les tests automatisés",
      "Ajouter des tests de non-régression ciblés à un projet public pour les comportements définis et les cas limites connus.",
      "Tests automatisés\nInstructions d’exécution\nRésumé de la couverture et des lacunes",
      "Les tests reproduisent chaque comportement et régression convenus.\nDémontrer qu’un cas défectueux pertinent est détecté.\nLa suite s’exécute de façon reproductible sans données privées.",
    ),
  ),
  template(
    "evals",
    "AI evaluation package",
    content(
      "Build an AI evaluation package",
      "Create a reproducible evaluation harness using public, licensed or synthetic examples, with explicit scoring and limitations.",
      "Evaluation dataset with provenance\nScoring code and baseline results\nReproduction and limitations report",
      "Document the source or generation method for every dataset.\nMake scoring rules and baseline configuration explicit.\nA reviewer can reproduce the reported results.",
    ),
    content(
      "Créer un ensemble d’évaluation IA",
      "Créer un banc d’évaluation reproductible à partir d’exemples publics, sous licence ou synthétiques, avec des règles de notation et des limites explicites.",
      "Jeu d’évaluation avec provenance\nCode de notation et résultats de référence\nRapport de reproduction et de limites",
      "Documenter la source ou la méthode de génération de chaque jeu de données.\nExpliciter les règles de notation et la configuration de référence.\nUn évaluateur peut reproduire les résultats présentés.",
    ),
  ),
  template(
    "dashboard",
    "Public-data dashboard",
    content(
      "Create a public-data dashboard",
      "Build an accessible dashboard from a specified public non-personal dataset, with transparent calculations and source attribution.",
      "Dashboard source and preview\nData preparation code\nSource, update and calculation notes",
      "Every displayed metric can be traced to its source.\nThe layout works on desktop and mobile.\nDocument missing values, update dates and limitations.",
    ),
    content(
      "Créer un tableau de données publiques",
      "Construire un tableau de bord accessible à partir de données publiques non personnelles, avec des calculs transparents et des sources citées.",
      "Code et aperçu du tableau de bord\nCode de préparation des données\nNotes sur les sources, les mises à jour et les calculs",
      "Chaque indicateur affiché peut être relié à sa source.\nLa présentation fonctionne sur ordinateur et mobile.\nDocumenter les valeurs manquantes, les dates et les limites.",
    ),
  ),
  template(
    "demo",
    "Interactive demonstration",
    content(
      "Build an interactive demonstration",
      "Create a self-contained interactive demo that explains a defined concept using public or synthetic inputs.",
      "Working demo and source code\nInstructions and sample scenarios\nAccessibility and browser verification notes",
      "Every primary control has a useful, documented result.\nThe demo works with keyboard navigation and on mobile.\nClearly label assumptions, simulations and limitations.",
    ),
    content(
      "Construire une démonstration interactive",
      "Créer une démonstration interactive autonome expliquant un concept défini à l’aide de données publiques ou synthétiques.",
      "Démonstration fonctionnelle et code source\nInstructions et exemples de scénarios\nNotes de vérification d’accessibilité et de navigateurs",
      "Chaque commande principale produit un résultat utile et documenté.\nLa démonstration fonctionne au clavier et sur mobile.\nIndiquer clairement les hypothèses, les simulations et les limites.",
    ),
  ),
  template(
    "intelligence",
    "Public product research",
    content(
      "Compare public products or tools",
      "Prepare a decision-ready comparison of specified products using public first-party documentation and reproducible criteria.",
      "Comparison table with source links\nEvidence-backed findings\nAssumptions and research date",
      "Cite a public source for each material factual claim.\nSeparate observed facts from estimates and judgments.\nIdentify gaps and use the agreed comparison criteria.",
    ),
    content(
      "Comparer des produits ou outils publics",
      "Préparer une comparaison exploitable des produits définis à partir de leur documentation publique officielle et de critères reproductibles.",
      "Tableau comparatif avec liens sources\nConclusions fondées sur des preuves\nHypothèses et date de recherche",
      "Citer une source publique pour chaque affirmation factuelle importante.\nDistinguer les faits observés, les estimations et les jugements.\nIdentifier les lacunes et utiliser les critères convenus.",
    ),
  ),
  template(
    "docs",
    "Executable documentation",
    content(
      "Make documentation executable",
      "Improve a public project's onboarding documentation and provide commands or examples that can be verified in a clean environment.",
      "Updated quick-start guide\nExecutable examples or verification script\nTroubleshooting notes",
      "Follow the guide successfully in a clean environment.\nCommands match the documented dependency versions.\nDescribe expected outputs and common recoverable errors.",
    ),
    content(
      "Rendre la documentation exécutable",
      "Améliorer le guide de démarrage d’un projet public avec des commandes ou exemples vérifiables dans un environnement neuf.",
      "Guide de démarrage mis à jour\nExemples exécutables ou script de vérification\nNotes de dépannage",
      "Suivre le guide avec succès dans un environnement neuf.\nLes commandes correspondent aux versions documentées.\nDécrire les résultats attendus et les erreurs courantes corrigibles.",
    ),
  ),
  template(
    "reproduction",
    "Scientific reproduction",
    content(
      "Reproduce a scientific result",
      "Reproduce a defined numerical result from a public paper or dataset, with a documented method and honest comparison to the reference.",
      "Reproducible code or notebook\nResults and comparison figures\nEnvironment, provenance and limitations",
      "Record exact inputs, versions and random seeds where relevant.\nCompare results with a stated tolerance or explain deviations.\nProvide one clear command or procedure to reproduce the work.",
    ),
    content(
      "Reproduire un résultat scientifique",
      "Reproduire un résultat numérique défini à partir d’un article ou jeu de données public, avec une méthode documentée et une comparaison honnête.",
      "Code ou carnet reproductible\nRésultats et graphiques comparatifs\nEnvironnement, provenance et limites",
      "Consigner les données, versions et graines aléatoires pertinentes.\nComparer les résultats avec une tolérance définie ou expliquer les écarts.\nFournir une commande ou procédure claire de reproduction.",
    ),
  ),
];

export function emptyDraft() {
  return {
    schema: DRAFT_SCHEMA,
    template: "",
    stage: 0,
    fields: {
      title: "",
      summary: "",
      inputs: "",
      deliverables: "",
      acceptance: "",
      requirements: "",
      budget: "1000",
      days: "7",
    },
  };
}
export function templateFields(id, lang = "en") {
  const selected = TEMPLATES.find((item) => item.id === id);
  if (!selected) throw Error("template");
  return { ...selected[lang === "fr" ? "fr" : "en"] };
}
export function normalizeBudget(value) {
  const amount = parseUSDC(value);
  const fraction = (amount % 1_000_000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return (amount / 1_000_000n).toString() + (fraction ? "." + fraction : "");
}
export function durationSeconds(value) {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{0,2}$/.test(value) ||
    Number(value) > 365
  )
    throw Error("days");
  return Number(value) * 86400;
}
export function lines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
export function publicInputURLs(value) {
  const urls = lines(value);
  if (!urls.length || urls.length > 10) throw Error("inputs");
  for (const raw of urls) {
    if (raw.length > 2048 || /\s/.test(raw)) throw Error("inputs");
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw Error("inputs");
    }
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !host.includes(".") ||
      /[:\[\]]/.test(host) ||
      /^[\d.]+$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|example)$/.test(
        host,
      ) ||
      host.endsWith(".")
    )
      throw Error("inputs");
    const sensitive =
      /^(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|apikey|key|secret|password|passwd|authorization|credential|signature|sig|x-amz-.+|x-goog-.+)$/i;
    if (
      [
        ...url.searchParams.keys(),
        ...new URLSearchParams(url.hash.slice(1)).keys(),
      ].some((key) => sensitive.test(key))
    )
      throw Error("inputs");
  }
  return urls;
}
export function parseDraft(raw) {
  if (typeof raw !== "string" || raw.length > 65536) throw Error("draft");
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Error("draft");
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.schema !== DRAFT_SCHEMA ||
    typeof value.template !== "string" ||
    (value.template && !TEMPLATES.some((item) => item.id === value.template)) ||
    !Number.isInteger(value.stage) ||
    value.stage < 0 ||
    value.stage > 3 ||
    !value.fields ||
    typeof value.fields !== "object" ||
    Array.isArray(value.fields)
  )
    throw Error("draft");
  const draft = emptyDraft();
  draft.template = value.template;
  draft.stage = value.stage;
  for (const [key, max] of Object.entries(LIMITS)) {
    if (
      typeof value.fields[key] !== "string" ||
      value.fields[key].length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.fields[key])
    )
      throw Error("draft");
    draft.fields[key] = value.fields[key];
  }
  return draft;
}
export function validateDraft(draft, throughStage = 2) {
  const errors = [];
  try {
    parseDraft(JSON.stringify(draft));
  } catch {
    return [{ field: "title", code: "draft" }];
  }
  if (!TEMPLATES.some((item) => item.id === draft.template))
    errors.push({ field: "template", code: "template" });
  if (throughStage >= 1) {
    for (const key of ["title", "summary", "deliverables", "acceptance"])
      if (!draft.fields[key].trim())
        errors.push({ field: key, code: "required" });
    for (const key of ["deliverables", "acceptance", "requirements"])
      if (
        lines(draft.fields[key]).length > 20 ||
        lines(draft.fields[key]).some((line) => line.length > 500)
      )
        errors.push({ field: key, code: "lines" });
    try {
      publicInputURLs(draft.fields.inputs);
    } catch {
      errors.push({ field: "inputs", code: "inputs" });
    }
  }
  if (throughStage >= 2) {
    try {
      normalizeBudget(draft.fields.budget);
    } catch {
      errors.push({ field: "budget", code: "budget" });
    }
    try {
      durationSeconds(draft.fields.days);
    } catch {
      errors.push({ field: "days", code: "days" });
    }
  }
  return errors;
}
function validated(draft) {
  const errors = validateDraft(draft);
  if (errors.length) throw Error(errors[0].code);
  return draft.fields;
}
export function toMetadata(
  draft,
  lang = "en",
  generatedAt = new Date().toISOString(),
) {
  const fields = validated(draft),
    selected = TEMPLATES.find((item) => item.id === draft.template),
    inputURLs = publicInputURLs(fields.inputs),
    payout = normalizeBudget(fields.budget),
    duration = durationSeconds(fields.days),
    locale = lang === "fr" ? "fr-CA" : "en-CA";
  return {
    name: `AGI Job · ${fields.title.trim()}`,
    description: fields.summary.trim(),
    external_url: inputURLs[0],
    attributes: [
      { trait_type: "Category", value: selected.category },
      { trait_type: "Payout (USDC)", value: payout },
      {
        display_type: "number",
        trait_type: "Duration (seconds)",
        value: duration,
      },
      { trait_type: "Locale", value: locale },
    ],
    properties: {
      schema: "agijobmanager/job-spec/v1",
      kind: "job-spec",
      version: "1.0.1",
      locale,
      title: fields.title.trim(),
      category: selected.category,
      summary: fields.summary.trim(),
      details: fields.title.trim(),
      tags: [draft.template],
      inputURLs,
      deliverables: lines(fields.deliverables),
      acceptanceCriteria: lines(fields.acceptance),
      requirements: lines(fields.requirements),
      payoutUSDC: payout,
      durationSeconds: duration,
      employer: null,
      chainId: null,
      contract: null,
      ensPreview: null,
      ensURI: null,
      generatedAt,
      createdVia: "AGIJobManager employer onboarding",
      draftOnly: true,
    },
  };
}
export function toConsoleDraft(draft, lang = "en") {
  const fields = validated(draft),
    selected = TEMPLATES.find((item) => item.id === draft.template),
    urls = publicInputURLs(fields.inputs),
    summary = `${fields.summary.trim()}\n\n${lang === "fr" ? "Sources publiques" : "Public inputs"}:\n${urls.join("\n")}`;
  return {
    jobTitle: fields.title.trim(),
    jobCategory: selected.category,
    jobTags: draft.template,
    jobSummaryBuilder: summary,
    jobDeliverables: lines(fields.deliverables).join("\n"),
    jobAcceptance: lines(fields.acceptance).join("\n"),
    jobRequirements: lines(fields.requirements).join("\n"),
    jobImageURI: "",
    jobExternalURI: urls[0],
    jobSpecVersion: "agijobmanager/job-spec/v1",
    jobLocale: lang === "fr" ? "fr-CA" : "en-CA",
    jobPayout: normalizeBudget(fields.budget),
    jobDuration: String(durationSeconds(fields.days)),
    jobDetails: fields.title.trim(),
    jobSpecURI: "",
  };
}
