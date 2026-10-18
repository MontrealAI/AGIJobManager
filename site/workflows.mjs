// A discovery guide: source coverage is distinct from behavioral qualification.
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
export const workflows = [
  {
    id: "successor",
    title: [
      "Build and check a bounded result",
      "Produire et vérifier un résultat borné",
    ],
    mode: ["Runs in this browser", "Fonctionne dans ce navigateur"],
    goal: [
      "Aggregate supplied rows or build a small static website, then inspect the independent result checks.",
      "Agrégez des lignes fournies ou créez un petit site statique, puis examinez les vérifications du résultat.",
    ],
    route: "successor/",
    command:
      "npm run successor -- run examples/successor/analyst.json build/my-run.json",
    result: [
      "A computed artifact and explicit checks. Custom missions can remain blocked; negative fixtures intentionally fail.",
      "Un livrable calculé et des vérifications explicites. Les missions personnalisées peuvent rester bloquées ; les cas négatifs échouent volontairement.",
    ],
    scope: [
      "Bounded local algorithms; no provider access, general computer operation or settlement authority.",
      "Algorithmes locaux bornés ; aucun accès fournisseur, pilotage général d’ordinateur ou pouvoir de règlement.",
    ],
    guide: "examples/successor/README.md",
  },
  {
    id: "employer",
    title: [
      "Turn an idea into a reviewable brief",
      "Transformer une idée en demande vérifiable",
    ],
    mode: ["Runs in this browser", "Fonctionne dans ce navigateur"],
    goal: [
      "Choose an everyday or technical example, define acceptance and export a reviewed brief.",
      "Choisissez un exemple courant ou technique, définissez l’acceptation et exportez une demande relue.",
    ],
    route: "employers/",
    result: [
      "Editable requirements, local draft recovery and text, print or JSON export after consent.",
      "Exigences modifiables, récupération du brouillon local et export texte, impression ou JSON après accord.",
    ],
    scope: [
      "A prepared brief does not post a job, take payment or commission execution.",
      "Une demande préparée ne publie pas de mission, ne paie rien et ne déclenche aucune exécution.",
    ],
    guide: "docs/START_HERE.md",
  },
  {
    id: "roles",
    title: [
      "Explore role and failure states",
      "Explorer les rôles et les défaillances",
    ],
    mode: ["Local application setup", "Application locale à installer"],
    goal: [
      "Inspect deterministic job lifecycle fixtures as visitor, employer, agent, validator, moderator or owner.",
      "Examinez les scénarios déterministes comme visiteur, employeur, agent, validateur, modérateur ou propriétaire.",
    ],
    command:
      "npm --prefix ui ci\nNEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm --prefix ui run dev",
    result: [
      "Open the local address printed by Next.js and its /demo route. Baseline and degraded-paused fixtures show action timelines and resilience states.",
      "Ouvrez l’adresse locale affichée par Next.js et sa route /demo. Les cas baseline et degraded-paused montrent les actions et états dégradés.",
    ],
    scope: [
      "Node and locked UI dependencies required. This local /demo route is not deployed on GitHub Pages; fixture states are synthetic.",
      "Node et les dépendances UI verrouillées sont requis. Cette route locale /demo n’est pas publiée sur GitHub Pages ; les états sont synthétiques.",
    ],
    guide: "docs/ui/DEMO.md",
  },
  {
    id: "workforce",
    title: [
      "Inspect workforce assumptions",
      "Examiner les hypothèses de capacité",
    ],
    mode: [
      "Python simulation + retained reference outputs",
      "Simulation Python et résultats de référence",
    ],
    goal: [
      "Reproduce a 10,000-offer synthetic planning experiment and compare policy sensitivity.",
      "Reproduisez une expérience de planification synthétique sur 10 000 offres et comparez la sensibilité des politiques.",
    ],
    command: "npm run test:simulation\nnpm run simulate:workforce",
    result: [
      "Generated results under build/workforce-10000. Twenty seeds and sensitivity runs evaluate a fixed offer cohort; committed JSON is a prior reference run.",
      "Résultats générés dans build/workforce-10000. Vingt graines et des analyses de sensibilité évaluent un ensemble fixe ; les JSON conservés sont une exécution de référence antérieure.",
    ],
    scope: [
      "Python 3.11+; potentially substantial local compute. Simulated cost, human effort and value are assumptions, not measured savings or qualified machines.",
      "Python 3.11+ ; calcul local potentiellement important. Coût, effort humain et valeur sont des hypothèses, pas des économies mesurées ou des machines qualifiées.",
    ],
    guide: "experiments/workforce-10000/README.md",
  },
  {
    id: "economics",
    title: [
      "Check capacity and economics inputs",
      "Vérifier les entrées de capacité et de coût",
    ],
    mode: ["Local diagnostic examples", "Exemples de diagnostic local"],
    goal: [
      "Inspect supplied capacity, computer capability, review reservation and project economics inputs before using the matching diagnostic command.",
      "Examinez les entrées de capacité, d’aptitude informatique, de réservation de revue et de coûts avant la commande de diagnostic correspondante.",
    ],
    result: [
      "JSON input examples and declared root-package commands. Read each command’s argument and qualification requirements before running.",
      "Exemples JSON et commandes déclarées dans le paquet racine. Lisez les arguments et exigences de qualification avant l’exécution.",
    ],
    scope: [
      "These inputs and models do not authorize paid work or establish actual provider performance.",
      "Ces entrées et modèles n’autorisent pas de travail rémunéré et ne prouvent pas les performances d’un fournisseur.",
    ],
    guide: "package.json",
  },
  {
    id: "genesis",
    title: [
      "Inspect the historical Genesis example",
      "Examiner l’exemple historique Genesis",
    ],
    mode: [
      "Historical evidence + local contract simulation",
      "Preuves historiques et simulation locale du contrat",
    ],
    goal: [
      "Follow the preserved job, receipt and deliverable evidence, keeping its historical deployment distinct from the current release.",
      "Parcourez la mission, le reçu et les preuves conservés en distinguant leur déploiement historique de la version actuelle.",
    ],
    command: "npm run simulate:genesis",
    result: [
      "Local contract simulation after compilation; retained historical receipts and manifests remain reference evidence.",
      "Simulation locale du contrat après compilation ; les reçus et manifestes historiques restent des preuves de référence.",
    ],
    scope: [
      "Requires the repository’s locked contract toolchain. A local simulation does not send a mainnet transaction or refresh historical qualification.",
      "Nécessite les outils de contrat verrouillés du dépôt. La simulation ne transmet pas de transaction mainnet et n’actualise pas la qualification historique.",
    ],
    guide: "docs/examples/genesis/README.md",
  },
  {
    id: "erc8004",
    title: [
      "Read registration and feedback examples",
      "Lire les exemples d’inscription et de retour",
    ],
    mode: ["Integration reference", "Référence d’intégration"],
    goal: [
      "Inspect sample agent-registration and feedback payloads alongside the integration documentation.",
      "Examinez les exemples d’inscription d’agent et de retour avec la documentation d’intégration.",
    ],
    result: [
      "Reference JSON for implementers; no registration is submitted from this guide.",
      "JSON de référence pour les développeurs ; aucune inscription n’est envoyée par ce guide.",
    ],
    scope: [
      "Example payloads are not evidence of a live agent registration or execution.",
      "Les exemples ne prouvent ni inscription réelle d’un agent ni exécution.",
    ],
    guide: "integrations/erc8004/README.md",
  },
  {
    id: "specifications",
    title: [
      "Inspect job and completion formats",
      "Examiner les formats de mission et de livraison",
    ],
    mode: [
      "Schema and artifact reference",
      "Référence de schémas et de livrables",
    ],
    goal: [
      "Read public job, completion, artifact-manifest and NFT metadata examples.",
      "Lisez les exemples publics de mission, livraison, manifeste et métadonnées NFT.",
    ],
    result: [
      "Reusable reference structures for compatible producers and reviewers.",
      "Structures de référence pour les producteurs et vérificateurs compatibles.",
    ],
    scope: [
      "An example document is not an approved delivery, live receipt or settlement instruction.",
      "Un exemple n’est ni une livraison approuvée, ni un reçu réel, ni une instruction de règlement.",
    ],
    guide: "docs/examples/GENESIS_JOB_TODAY.md",
  },
];
export function renderWorkflows(lang, { commit, version, sources }) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw Error("Invalid source commit");
  const fr = lang === "fr",
    i = fr ? 1 : 0,
    e = escape,
    base = fr ? "../../" : "../",
    home = "../",
    publicRoot = "https://montrealai.github.io/AGIJobManager/",
    canonical = `${publicRoot}${fr ? "fr/" : ""}workflows/`,
    repo = `https://github.com/MontrealAI/AGIJobManager/blob/${commit}/`,
    doc = (p) => repo + p.split("/").map(encodeURIComponent).join("/");
  const text = (en, frText) => (fr ? frText : en);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'"><title>${text(
    "Demos & workflows",
    "Démos et parcours"
  )} · AGI Jobs</title><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="en" href="${publicRoot}workflows/"><link rel="alternate" hreflang="fr" href="${publicRoot}fr/workflows/"><link rel="alternate" hreflang="x-default" href="${publicRoot}workflows/"><link rel="stylesheet" href="${base}assets/workflows.css"></head><body><a class="skip" href="#main">${text(
    "Skip to workflows",
    "Aller aux parcours"
  )}</a><nav><a href="${home}">AGI JOBS</a><a href="${
    fr ? "../../workflows/" : "../fr/workflows/"
  }" lang="${fr ? "en" : "fr"}" hreflang="${fr ? "en" : "fr"}">${
    fr ? "English" : "Français"
  }</a></nav><header><p class="eyebrow">${text(
    "EXPLORE / UNDERSTAND / VERIFY",
    "EXPLORER / COMPRENDRE / VÉRIFIER"
  )}</p><h1>${text(
    "Choose a useful next step.",
    "Choisissez une prochaine étape utile."
  )}</h1><p>${text(
    "Every original demo family, with a clear way to start and a clear boundary on what its results mean.",
    "Chaque famille de démos originales, avec un démarrage clair et une limite explicite sur la portée des résultats."
  )}</p><p class="notice">${text(
    "Browser tools, local simulations and reference material have different prerequisites. Directory coverage is not execution or production qualification.",
    "Les outils navigateur, simulations locales et références ont des prérequis différents. La couverture du répertoire ne vaut pas qualification d’exécution ou de production."
  )}</p></header><main id="main"><nav class="jump" aria-label="${text(
    "Demo families",
    "Familles de démos"
  )}">${workflows
    .map((w) => `<a href="#${w.id}">${e(w.title[i])}</a>`)
    .join("")}</nav><div class="grid">${workflows
    .map(
      (w) =>
        `<article id="${w.id}"><p class="eyebrow">${e(w.mode[i])}</p><h2>${e(
          w.title[i]
        )}</h2><p>${e(w.goal[i])}</p><h3>${text(
          "What you can inspect",
          "Ce que vous pouvez examiner"
        )}</h3><p>${e(w.result[i])}</p><p class="scope">${e(w.scope[i])}</p>${
          w.route
            ? `<a class="button" href="${home + w.route}">${text(
                "Open the original tool",
                "Ouvrir l’outil original"
              )}</a>`
            : ""
        }<p><a href="${doc(w.guide)}">${text(
          "Read the exact-source guide",
          "Lire le guide de cette source"
        )}</a></p>${
          w.command
            ? `<details><summary>${text(
                "Supported launch command",
                "Commande de lancement"
              )}</summary><p>${text(
                "From a checkout of this source revision, with the prerequisites above installed. Keep prior outputs before rerunning. Shell examples use POSIX syntax.",
                "Depuis une copie de cette révision, avec les prérequis ci-dessus installés. Conservez les résultats précédents avant une nouvelle exécution. Syntaxe shell POSIX."
              )}</p><pre>${e(w.command)}</pre></details>`
            : ""
        }<details><summary>${text(
          "All named examples and source files",
          "Tous les exemples nommés et fichiers sources"
        )} (${sources[w.id].length})</summary><ul>${sources[w.id]
          .map((p) => `<li><a href="${doc(p)}">${e(p)}</a></li>`)
          .join("")}</ul></details></article>`
    )
    .join("")}</div></main><footer>${text(
    "Source",
    "Source"
  )} <a href="https://github.com/MontrealAI/AGIJobManager/commit/${commit}">${commit.slice(
    0,
    8
  )}</a> · v${e(version)} · ${text(
    "Public and synthetic inputs only. No payment or authority is granted here.",
    "Entrées publiques et synthétiques uniquement. Aucun paiement ou pouvoir n’est accordé ici."
  )}</footer></body></html>`;
}
