import {
  CONSOLE_DRAFT_KEY,
  DRAFT_KEY,
  LANGUAGE_KEY,
  LIMITS,
  TEMPLATES,
  PRIMARY_TEMPLATE_IDS,
  emptyDraft,
  parseDraft,
  templateFields,
  validateDraft,
  draftTitle,
  toReadableBrief,
  toMetadata,
  toConsoleDraft,
} from "./employer-model.mjs";
import { parseUSDC, splitPayment, formatUSDC } from "./payments.mjs";

const form = document.getElementById("employer-form");
if (form) initialize();
function initialize() {
  const $ = (id) => document.getElementById(`employer-${id}`),
    lang = document.documentElement.lang === "fr" ? "fr" : "en",
    fr = lang === "fr",
    say = (en, french) => (fr ? french : en);
  const labels = {
    title: say("Request name", "Nom de la demande"),
    summary: say("What you would like", "Ce que vous souhaitez"),
    inputs: say("Public links", "Liens publics"),
    deliverables: say("What you will receive", "Ce que vous recevrez"),
    acceptance: say("How to check the result", "Comment vérifier le résultat"),
    requirements: say("Other details", "Autres précisions"),
    budget: say("Budget", "Budget"),
    days: say("Time allowed", "Délai"),
    template: say("Starting example", "Exemple de départ"),
    public: say(
      "Public-content confirmation",
      "Confirmation du contenu public",
    ),
  };
  let draft = emptyDraft(),
    stage = 0,
    conflictValue,
    hasChanges = false;
  const status = (message) => {
    $("status").textContent = message;
  };
  const read = () => {
    const next = { ...draft, stage, fields: {} };
    for (const key of Object.keys(LIMITS)) next.fields[key] = $(key).value;
    if (fr) next.fields.budget = next.fields.budget.replace(",", ".");
    return next;
  };
  const fill = (value) => {
    draft = value;
    for (const key of Object.keys(LIMITS))
      $(key).value =
        key === "budget" && fr
          ? value.fields[key].replace(".", ",")
          : value.fields[key];
    renderTemplates();
  };
  function errorMessage(error) {
    const label = labels[error.field] || labels.title;
    if (error.code === "template")
      return say(
        "Choose an example, or choose “Something else” to start with your own idea.",
        "Choisissez un exemple, ou « Autre chose » pour décrire votre idée.",
      );
    if (error.code === "required") {
      const messages = {
        summary: say(
          "Tell us what you would like someone to do.",
          "Dites-nous ce que vous souhaitez faire réaliser.",
        ),
        deliverables: say(
          "Describe what you would like to receive, such as a website, document or report.",
          "Décrivez ce que vous souhaitez recevoir, comme un site, un document ou un rapport.",
        ),
        acceptance: say(
          "Tell us how you will know the work is done well.",
          "Dites-nous comment vous saurez que le travail est bien fait.",
        ),
      };
      return (
        messages[error.field] ||
        say(
          `Add ${label.toLowerCase()} before continuing.`,
          `Remplissez le champ « ${label} » avant de continuer.`,
        )
      );
    }
    if (error.code === "inputs")
      return say(
        "Check your links. Each one must start with https:// and be a public website address, with no passwords or private access codes. Put one link on each line, up to 10. You can also leave this optional box empty. Links are not opened or checked here.",
        "Vérifiez vos liens. Chacun doit commencer par https:// et être une adresse publique, sans mot de passe ni code d’accès privé. Mettez un lien par ligne, jusqu’à 10. Vous pouvez aussi laisser ce champ facultatif vide. Les liens ne sont pas ouverts ni vérifiés ici.",
      );
    if (error.code === "budget")
      return say(
        "Enter a budget above zero, such as 100 or 1000.50. Use a decimal point and no commas or spaces. Very large amounts and more than six decimal places are not accepted.",
        "Entrez un budget supérieur à zéro, par exemple 100 ou 1000,50. Utilisez une virgule ou un point pour les décimales, sans espace. Les montants très élevés et plus de six décimales ne sont pas acceptés.",
      );
    if (error.code === "days")
      return say(
        "Choose a number of days from 1 to 365, such as 7. The available limit will be checked again before payment.",
        "Choisissez un nombre de jours de 1 à 365, par exemple 7. La limite disponible sera vérifiée avant le paiement.",
      );
    if (error.code === "lines")
      return say(
        `${label}: use at most 20 lines and 500 characters per line.`,
        `${label} : utilisez au plus 20 lignes et 500 caractères par ligne.`,
      );
    if (error.code === "public")
      return say(
        "Tick the box confirming that your request is safe to share publicly and uses only material you are allowed to share. Leave out personal information, passwords and private links.",
        "Cochez la case confirmant que votre demande peut être partagée publiquement et utilise seulement du contenu que vous avez le droit de partager. N’incluez aucun renseignement personnel, mot de passe ni lien privé.",
      );
    return say(
      "This draft is too large or malformed. Shorten the fields or clear the draft and start again.",
      "Ce brouillon est trop volumineux ou invalide. Raccourcissez les champs ou effacez le brouillon et recommencez.",
    );
  }
  function clearErrors() {
    $("errors").replaceChildren();
    for (const key of [...Object.keys(LIMITS), "public"])
      $(key).removeAttribute("aria-invalid");
  }
  function showErrors(errors) {
    clearErrors();
    const intro = document.createElement("p");
    intro.textContent = say(
      "A few details need your attention:",
      "Quelques éléments sont à corriger :",
    );
    const list = document.createElement("ul");
    for (const error of errors) {
      const item = document.createElement("li"),
        link = document.createElement("a"),
        field =
          error.field === "template"
            ? $("templates").querySelector("button")
            : $(error.field);
      link.textContent = errorMessage(error);
      link.href = field?.id ? `#${field.id}` : "#employer-templates";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const errorStage =
          error.field === "template"
            ? 0
            : error.field === "budget" || error.field === "days"
              ? 2
              : error.field === "public"
                ? 3
                : 1;
        showStage(errorStage, false);
        for (
          let parent = field?.parentElement;
          parent;
          parent = parent.parentElement
        )
          if (parent.tagName === "DETAILS") parent.open = true;
        field?.focus();
      });
      if (error.field !== "template")
        field?.setAttribute("aria-invalid", "true");
      item.append(link);
      list.append(item);
    }
    $("errors").append(intro, list);
    $("errors").focus();
  }
  const previews = {
    website: [
      "↗",
      say("A simple website", "Un site simple"),
      say(
        "A welcoming page for your project, idea or organization.",
        "Une page accueillante pour votre projet, idée ou organisation.",
      ),
    ],
    intelligence: [
      "⇄",
      say("Compare my options", "Comparer mes options"),
      say(
        "A clear comparison to help you choose a product or service.",
        "Un comparatif clair pour choisir un produit ou un service.",
      ),
    ],
    presentation: [
      "▤",
      say("A presentation", "Une présentation"),
      say(
        "Attractive slides that make your message easy to understand.",
        "Des diapositives attrayantes pour bien faire passer votre message.",
      ),
    ],
    report: [
      "≡",
      say("Research a topic", "Étudier un sujet"),
      say(
        "Useful answers, clearly explained, with sources you can check.",
        "Des réponses utiles, simples et accompagnées de sources.",
      ),
    ],
    dashboard: [
      "▥",
      say("Make data easy to read", "Mieux lire mes données"),
      say(
        "Clear charts and a dashboard built from public information.",
        "Des graphiques clairs à partir d’informations publiques.",
      ),
    ],
    custom: [
      "+",
      say("Something else", "Autre chose"),
      say(
        "Tell us what you have in mind, in your own words.",
        "Décrivez votre idée avec vos propres mots.",
      ),
    ],
  };
  function renderTemplates() {
    const container = $("templates"),
      more = $("more-templates");
    container.replaceChildren();
    more?.replaceChildren();
    const ordered = [
      ...PRIMARY_TEMPLATE_IDS.map((id) =>
        TEMPLATES.find((item) => item.id === id),
      ),
      ...TEMPLATES.filter((item) => !PRIMARY_TEMPLATE_IDS.includes(item.id)),
    ];
    for (const item of ordered) {
      const button = document.createElement("button"),
        icon = document.createElement("span"),
        name = document.createElement("strong"),
        detail = document.createElement("span"),
        preview = previews[item.id] || [
          "◇",
          item[lang].title,
          item[lang].summary,
        ];
      button.type = "button";
      button.className = "employer-template";
      button.dataset.template = item.id;
      button.id = `employer-template-${item.id}`;
      button.setAttribute("aria-pressed", String(draft.template === item.id));
      icon.className = "employer-template-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = preview[0];
      name.textContent = preview[1];
      detail.textContent = preview[2];
      button.append(icon, name, detail);
      button.addEventListener("click", () => {
        if (draft.template === item.id) return;
        const next = read(),
          previous = draft.template ? templateFields(draft.template, lang) : {},
          edited = [
            "title",
            "summary",
            "deliverables",
            "acceptance",
            "requirements",
          ].some(
            (key) =>
              next.fields[key].trim() &&
              next.fields[key] !== (previous[key] || ""),
          );
        if (
          edited &&
          !window.confirm(
            say(
              "Use this example instead? It will replace your written request. Your links, budget and time allowed will stay.",
              "Utiliser cet exemple à la place? Il remplacera le texte de votre demande. Vos liens, votre budget et votre délai seront conservés.",
            ),
          )
        )
          return;
        next.template = item.id;
        Object.assign(next.fields, templateFields(item.id, lang));
        fill(next);
        $("public").checked = false;
        hasChanges = true;
        clearErrors();
        status(
          say(
            "Example selected. Choose Next to make it your own.",
            "Exemple sélectionné. Choisissez Suivant pour l’adapter à votre projet.",
          ),
        );
        document.getElementById(`employer-template-${item.id}`)?.focus();
      });
      (PRIMARY_TEMPLATE_IDS.includes(item.id) || !more
        ? container
        : more
      ).append(button);
    }
    if ($("selection")) {
      const selected = TEMPLATES.find((item) => item.id === draft.template),
        title = selected
          ? previews[selected.id]?.[1] || selected[lang].title
          : "";
      $("selection").textContent = title
        ? say(
            `Selected: ${title}. Choose Next to tell us more.`,
            `Votre choix : ${title}. Choisissez Suivant pour en dire plus.`,
          )
        : say(
            "Choose an example to get started. You can change it later.",
            "Choisissez un exemple pour commencer. Vous pourrez le changer ensuite.",
          );
    }
    if (
      more &&
      draft.template &&
      !PRIMARY_TEMPLATE_IDS.includes(draft.template)
    ) {
      const details = more.closest("details");
      if (details) details.open = true;
    }
  }
  function checkConflict() {
    try {
      const current = localStorage.getItem(CONSOLE_DRAFT_KEY);
      if (current !== conflictValue) $("replace").checked = false;
      conflictValue = current;
      $("conflict").hidden = current === null;
      return { available: true, current };
    } catch {
      $("conflict").hidden = true;
      $("replace").checked = false;
      conflictValue = undefined;
      return { available: false };
    }
  }
  function renderReview() {
    const value = read(),
      errors = validateDraft(value);
    $("review").replaceChildren();
    if (errors.length) {
      const note = document.createElement("p");
      note.textContent = say(
        "Complete the earlier steps to review your job brief.",
        "Complétez les étapes précédentes pour relire votre mission.",
      );
      $("review").append(note);
      return;
    }
    const fields = value.fields,
      list = document.createElement("dl");
    for (const key of [
      "title",
      "summary",
      "inputs",
      "deliverables",
      "acceptance",
      "requirements",
    ]) {
      if (key !== "title" && !fields[key].trim()) continue;
      const term = document.createElement("dt"),
        description = document.createElement("dd");
      term.textContent = labels[key];
      description.textContent =
        key === "title" ? draftTitle(fields) : fields[key].trim();
      list.append(term, description);
    }
    const money = document.createElement("p"),
      duration = document.createElement("p"),
      amounts = splitPayment(fields.budget);
    money.className = "employer-budget-summary";
    money.textContent = `${say("Total job budget", "Budget total de la mission")} : ${formatUSDC(parseUSDC(fields.budget), lang)}`;
    duration.textContent = `${labels.days} : ${fields.days} ${say("days after work is assigned", "jours après l’attribution du travail")}`;
    const estimate = document.createElement("p");
    estimate.className = "fine-print";
    estimate.textContent = say(
      `Illustration at an 8% validator share: agent ${formatUSDC(amounts.agent, lang)}, validators ${formatUSDC(amounts.validators, lang)}, protocol allocations ${formatUSDC(amounts.wallet30 + amounts.wallet10, lang)}. Gas is additional. Verify the live rate and limits in the console.`,
      `Exemple avec une part de validation de 8 % : agent ${formatUSDC(amounts.agent, lang)}, validateurs ${formatUSDC(amounts.validators, lang)}, allocations du protocole ${formatUSDC(amounts.wallet30 + amounts.wallet10, lang)}. Les frais de réseau sont en sus. Vérifiez le taux et les limites actifs dans la console.`,
    );
    const breakdown = document.createElement("details"),
      explanation = document.createElement("summary");
    breakdown.className = "employer-budget-breakdown";
    explanation.textContent = say(
      "How the budget is shared (example)",
      "Comment le budget est réparti (exemple)",
    );
    breakdown.append(explanation, estimate);
    $("review").append(money, duration, list, breakdown);
    checkConflict();
  }
  function showStage(next, focus = true) {
    stage = next;
    draft.stage = stage;
    document.querySelectorAll("[data-employer-panel]").forEach((panel) => {
      panel.hidden = Number(panel.dataset.employerPanel) !== stage;
    });
    document.querySelectorAll("[data-employer-step]").forEach((button) => {
      const current = Number(button.dataset.employerStep) === stage;
      if (current) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    $("back").hidden = stage === 0;
    const nextLabels = [
      say("Next: tell us more", "Suivant : votre demande"),
      say("Next: choose your budget", "Suivant : votre budget"),
      say("Review my request", "Relire ma demande"),
    ];
    for (const button of [$("next"), $("next-top")].filter(Boolean)) {
      button.hidden = stage === 3;
      button.textContent = nextLabels[stage] || "";
    }
    if ($("step-status"))
      $("step-status").textContent = say(
        `Step ${stage + 1} of 4`,
        `Étape ${stage + 1} sur 4`,
      );
    if (stage === 3) renderReview();
    if (focus)
      document
        .querySelector(
          `[data-employer-panel="${stage}"] h2, [data-employer-panel="${stage}"] h3`,
        )
        ?.focus();
  }
  function navigate(next) {
    const errors =
      next > stage ? validateDraft(read(), Math.min(next - 1, 2)) : [];
    if (errors.length) {
      showErrors(errors);
      return;
    }
    clearErrors();
    showStage(next);
  }
  function ready() {
    const errors = validateDraft(read());
    if (!$("public").checked) errors.push({ field: "public", code: "public" });
    if (errors.length) {
      showErrors(errors);
      return false;
    }
    clearErrors();
    return true;
  }
  const storageError = () =>
    status(
      say(
        "This browser could not save your request. Keep this page open, then download a copy at the review step. Nothing was sent or paid.",
        "Ce navigateur n’a pas pu enregistrer votre demande. Gardez cette page ouverte, puis téléchargez une copie à l’étape de relecture. Rien n’a été envoyé ni payé.",
      ),
    );
  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("input", (event) => {
    hasChanges = true;
    if (Object.keys(LIMITS).some((key) => event.target === $(key)))
      $("public").checked = false;
  });
  for (const [key, max] of Object.entries(LIMITS)) $(key).maxLength = max;
  for (const button of [$("next"), $("next-top")].filter(Boolean))
    button.addEventListener("click", () => navigate(Math.min(stage + 1, 3)));
  $("larger-text")?.addEventListener("click", () => {
    const large = document.body.classList.toggle("large-text");
    $("larger-text").setAttribute("aria-pressed", String(large));
  });
  document.querySelectorAll("[data-employer-budget]").forEach((button) =>
    button.addEventListener("click", () => {
      const value = button.dataset.employerBudget;
      if (!/^[1-9]\d*$/.test(value)) return;
      $("budget").value = value;
      $("public").checked = false;
      hasChanges = true;
      $("budget").focus();
    }),
  );
  $("back").addEventListener("click", () => navigate(Math.max(stage - 1, 0)));
  document
    .querySelectorAll("[data-employer-step]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        navigate(Number(button.dataset.employerStep)),
      ),
    );
  $("save").addEventListener("click", () => {
    let serialized;
    try {
      serialized = JSON.stringify(parseDraft(JSON.stringify(read())));
    } catch {
      showErrors([{ field: "title", code: "draft" }]);
      return;
    }
    try {
      localStorage.setItem(DRAFT_KEY, serialized);
      hasChanges = false;
      status(
        say(
          "Saved on this browser. Use Open my saved request when you come back. Anyone using this browser may be able to read it. Nothing has been published or paid.",
          "Enregistré dans ce navigateur. À votre retour, choisissez Ouvrir ma demande enregistrée. Une personne utilisant ce navigateur pourrait la lire. Rien n’a été publié ni payé.",
        ),
      );
    } catch {
      storageError();
    }
  });
  $("restore").addEventListener("click", () => {
    let restored;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw === null) {
        status(
          say(
            "There is no saved request in this browser yet. Choose Save on this device to keep the request you are working on.",
            "Il n’y a pas encore de demande enregistrée dans ce navigateur. Choisissez Enregistrer sur cet appareil pour conserver votre travail.",
          ),
        );
        return;
      }
      try {
        restored = parseDraft(raw);
      } catch {
        status(
          say(
            "The saved draft is invalid or from an unsupported version. It was not loaded; clear it to start again.",
            "Le brouillon enregistré est invalide ou d’une version non prise en charge. Il n’a pas été chargé; effacez-le pour recommencer.",
          ),
        );
        return;
      }
    } catch {
      storageError();
      return;
    }
    if (
      hasChanges &&
      !window.confirm(
        say(
          "Replace the current unsaved brief with your saved draft?",
          "Remplacer la mission actuelle non enregistrée par votre brouillon enregistré?",
        ),
      )
    )
      return;
    fill(restored);
    $("public").checked = false;
    hasChanges = false;
    clearErrors();
    showStage(restored.stage);
    status(
      say(
        "Your saved request is open. You can keep editing it, then review it before sharing or payment.",
        "Votre demande enregistrée est ouverte. Vous pouvez la modifier, puis la relire avant de la partager ou de payer.",
      ),
    );
  });
  $("clear").addEventListener("click", () => {
    if (
      !window.confirm(
        say(
          "Clear this onboarding brief and its saved copy in this browser? Console drafts, downloads and public copies are unaffected.",
          "Effacer cette mission et son brouillon enregistré dans ce navigateur? Les brouillons de la console, les téléchargements et les copies publiques sont conservés.",
        ),
      )
    )
      return;
    let cleared = true;
    try {
      localStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(LANGUAGE_KEY);
    } catch {
      cleared = false;
    }
    fill(emptyDraft());
    $("public").checked = false;
    $("replace").checked = false;
    hasChanges = false;
    clearErrors();
    showStage(0);
    status(
      cleared
        ? say(
            "Onboarding brief and its saved copy cleared.",
            "Mission et brouillon de démarrage effacés.",
          )
        : say(
            "The form is cleared, but browser storage could not be cleared. Use your browser’s site-data controls to remove saved copies.",
            "Le formulaire est effacé, mais le stockage du navigateur n’a pas pu être vidé. Utilisez les paramètres de données de site du navigateur pour supprimer les copies enregistrées.",
          ),
    );
  });
  function download(contents, type, filename) {
    const blob = new Blob([contents], { type }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $("download-text")?.addEventListener("click", () => {
    if (!ready()) return;
    download(
      toReadableBrief(read(), lang),
      "text/plain;charset=utf-8",
      fr ? "ma-demande-agi-jobs.txt" : "my-agi-jobs-request.txt",
    );
    status(
      say(
        "Your readable copy has been downloaded. You can open it, keep it or share it with someone you trust. Your request has not been published or paid.",
        "Votre copie lisible a été téléchargée. Vous pouvez l’ouvrir, la conserver ou la partager avec une personne de confiance. Votre demande n’a été ni publiée ni payée.",
      ),
    );
  });
  $("print")?.addEventListener("click", () => {
    if (!ready()) return;
    showStage(3, false);
    window.print();
  });
  $("export").addEventListener("click", () => {
    if (!ready()) return;
    download(
      JSON.stringify(toMetadata(read(), lang), null, 2) + "\n",
      "application/json",
      "agi-job-brief.json",
    );
    status(
      say(
        "Technical JSON copy downloaded. This is a draft. Before publishing, check the current terms and create the final job file in the console.",
        "Copie technique JSON téléchargée. Ceci est un brouillon. Avant la publication, vérifiez les conditions actuelles et créez le fichier final dans la console.",
      ),
    );
  });
  $("handoff").addEventListener("click", () => {
    if (!ready()) return;
    const before = checkConflict();
    if (!before.available) {
      storageError();
      return;
    }
    if (before.current !== null && !$("replace").checked) {
      status(
        say(
          "A saved console draft already exists. Confirm replacement below, or download your new brief to preserve the existing console draft.",
          "Un brouillon de console existe déjà. Confirmez son remplacement ci-dessous ou téléchargez votre nouvelle mission pour conserver ce brouillon.",
        ),
      );
      $("replace").focus();
      return;
    }
    let destination;
    try {
      destination = new URL(form.dataset.consoleUrl, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        !destination.pathname.endsWith("/agijobmanager-usdc.html")
      )
        throw Error("destination");
      destination.hash = "createJobSection";
    } catch {
      status(
        say(
          "The console link is unavailable. Download your JSON and use the console link in the navigation.",
          "Le lien vers la console est indisponible. Téléchargez votre JSON et utilisez le lien de la navigation.",
        ),
      );
      return;
    }
    try {
      const serialized = JSON.stringify(toConsoleDraft(read(), lang));
      localStorage.setItem(CONSOLE_DRAFT_KEY, serialized);
      if (localStorage.getItem(CONSOLE_DRAFT_KEY) !== serialized)
        throw Error("storage");
    } catch {
      storageError();
      return;
    }
    window.location.assign(destination.href);
  });
  document.querySelectorAll("[data-employer-language]").forEach((link) =>
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return;
      const target = link.dataset.employerLanguage;
      if (!["en", "fr"].includes(target)) return;
      try {
        const transfer = {
          target,
          savedAt: Date.now(),
          draft: parseDraft(JSON.stringify(read())),
          publicConsent: $("public").checked,
        };
        sessionStorage.setItem(LANGUAGE_KEY, JSON.stringify(transfer));
      } catch {
        event.preventDefault();
        status(
          say(
            "The language switch could not preserve your brief because browser storage is unavailable. Keep this page open and open the language link in a new tab, or download your completed brief first.",
            "Le changement de langue ne peut pas conserver votre mission, car le stockage est indisponible. Gardez cette page ouverte et ouvrez le lien de langue dans un nouvel onglet, ou téléchargez d’abord votre mission terminée.",
          ),
        );
      }
    }),
  );
  let carried = false;
  try {
    const raw = sessionStorage.getItem(LANGUAGE_KEY);
    if (raw && raw.length <= 70000) {
      const transfer = JSON.parse(raw);
      if (
        transfer.target === lang &&
        Number.isFinite(transfer.savedAt) &&
        Date.now() - transfer.savedAt >= 0 &&
        Date.now() - transfer.savedAt < 120000
      ) {
        draft = parseDraft(JSON.stringify(transfer.draft));
        $("public").checked = transfer.publicConsent === true;
        carried = true;
      }
      sessionStorage.removeItem(LANGUAGE_KEY);
    }
  } catch {
    /* Storage is optional; the form and export remain available. */
  }
  fill(draft);
  showStage(draft.stage, false);
  form.querySelectorAll("[data-employer-control]").forEach((control) => {
    control.disabled = false;
  });
  if ($("larger-text")) $("larger-text").disabled = false;
  form.hidden = false;
  if (carried) hasChanges = true;
  if (carried)
    status(
      say(
        "Your brief was kept while changing language. Its content has not been translated.",
        "Votre mission a été conservée lors du changement de langue. Son contenu n’a pas été traduit.",
      ),
    );
}
