import {
  CONSOLE_DRAFT_KEY,
  DRAFT_KEY,
  LANGUAGE_KEY,
  LIMITS,
  TEMPLATES,
  emptyDraft,
  parseDraft,
  templateFields,
  validateDraft,
  durationSeconds,
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
    title: say("Job title", "Titre de la mission"),
    summary: say("Summary", "Résumé"),
    inputs: say("Public input URLs", "Liens vers les sources publiques"),
    deliverables: say("Deliverables", "Livrables"),
    acceptance: say("Acceptance criteria", "Critères d’acceptation"),
    requirements: say("Requirements", "Exigences"),
    budget: say("Budget", "Budget"),
    days: say("Duration", "Durée"),
    template: say("Work template", "Modèle de mission"),
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
        "Choose a work template to start.",
        "Choisissez un modèle de mission pour commencer.",
      );
    if (error.code === "required")
      return say(
        `Add ${label.toLowerCase()} before continuing.`,
        `Ajoutez le champ « ${label} » avant de continuer.`,
      );
    if (error.code === "inputs")
      return say(
        "Public input URLs: add 1–10 HTTPS links, one per line, without login credentials, tokens or signed access keys. Local addresses and IP literals are not accepted. Use public, licensed or synthetic material; link accessibility is not checked here.",
        "Sources publiques : ajoutez de 1 à 10 liens HTTPS, un par ligne, sans identifiants, jetons ni clés d’accès signées. Les adresses locales et les adresses IP sont refusées. Utilisez du contenu public, sous licence ou synthétique; l’accessibilité n’est pas vérifiée ici.",
      );
    if (error.code === "budget")
      return say(
        "Budget: enter a positive USDC amount with up to 18 whole-number digits and 6 decimal places. Use a decimal point and no thousands separators.",
        "Budget : saisissez un montant USDC positif avec au plus 18 chiffres entiers et 6 décimales. Utilisez une virgule ou un point décimal, sans séparateur de milliers.",
      );
    if (error.code === "days")
      return say(
        "Duration: enter a whole number from 1 to 365 days. The live contract may impose a lower limit.",
        "Durée : saisissez un nombre entier de 1 à 365 jours. Le contrat actif peut imposer une limite inférieure.",
      );
    if (error.code === "lines")
      return say(
        `${label}: use at most 20 lines and 500 characters per line.`,
        `${label} : utilisez au plus 20 lignes et 500 caractères par ligne.`,
      );
    if (error.code === "public")
      return say(
        "Confirm that the brief and links contain only public, appropriately licensed or synthetic material, with no personal information, secrets or private access links.",
        "Confirmez que la description et les liens contiennent uniquement du contenu public, sous licence appropriée ou synthétique, sans renseignements personnels, secrets ni liens d’accès privés.",
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
  function renderTemplates() {
    const container = $("templates");
    container.replaceChildren();
    for (const item of TEMPLATES) {
      const button = document.createElement("button"),
        name = document.createElement("strong"),
        detail = document.createElement("span");
      button.type = "button";
      button.className = "employer-template";
      button.dataset.template = item.id;
      button.id = `employer-template-${item.id}`;
      button.setAttribute("aria-pressed", String(draft.template === item.id));
      name.textContent = item[lang].title;
      detail.textContent = item[lang].summary;
      button.append(name, detail);
      button.addEventListener("click", () => {
        if (draft.template === item.id) return;
        const next = read();
        if (
          [
            "title",
            "summary",
            "deliverables",
            "acceptance",
            "requirements",
          ].some((key) => next.fields[key].trim()) &&
          !window.confirm(
            say(
              "Replace the current title, summary, deliverables, acceptance criteria and requirements with this template? Your source links and budget will stay.",
              "Remplacer le titre, le résumé, les livrables, les critères d’acceptation et les exigences par ce modèle? Vos liens sources et votre budget seront conservés.",
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
            "Template selected. Continue to tailor the brief to your actual project.",
            "Modèle sélectionné. Continuez pour adapter la mission à votre projet.",
          ),
        );
        $("templates").querySelector(`[data-template="${item.id}"]`)?.focus();
      });
      container.append(button);
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
      if (!fields[key].trim()) continue;
      const term = document.createElement("dt"),
        description = document.createElement("dd");
      term.textContent = labels[key];
      description.textContent = fields[key].trim();
      list.append(term, description);
    }
    const money = document.createElement("p"),
      duration = document.createElement("p"),
      amounts = splitPayment(fields.budget);
    money.className = "employer-budget-summary";
    money.textContent = `${say("Total job budget", "Budget total de la mission")} : ${formatUSDC(parseUSDC(fields.budget), lang)}`;
    duration.textContent = `${labels.days} : ${fields.days} ${say("days after assignment", "jours après l’attribution")} (${durationSeconds(fields.days)} ${say("seconds", "secondes")})`;
    const estimate = document.createElement("p");
    estimate.className = "fine-print";
    estimate.textContent = say(
      `Illustration at an 8% validator share: agent ${formatUSDC(amounts.agent, lang)}, validators ${formatUSDC(amounts.validators, lang)}, protocol allocations ${formatUSDC(amounts.wallet30 + amounts.wallet10, lang)}. Gas is additional. Verify the live rate and limits in the console.`,
      `Exemple avec une part de validation de 8 % : agent ${formatUSDC(amounts.agent, lang)}, validateurs ${formatUSDC(amounts.validators, lang)}, allocations du protocole ${formatUSDC(amounts.wallet30 + amounts.wallet10, lang)}. Les frais de réseau sont en sus. Vérifiez le taux et les limites actifs dans la console.`,
    );
    $("review").append(money, duration, estimate, list);
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
    $("next").hidden = stage === 3;
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
        "Browser storage is unavailable. Your current brief remains on this page; download its JSON after completing the review. Nothing was saved or sent to the console.",
        "Le stockage du navigateur est indisponible. Votre mission reste sur cette page; téléchargez son JSON après la vérification. Rien n’a été enregistré ni envoyé à la console.",
      ),
    );
  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("input", (event) => {
    hasChanges = true;
    if (Object.keys(LIMITS).some((key) => event.target === $(key)))
      $("public").checked = false;
  });
  for (const [key, max] of Object.entries(LIMITS)) $(key).maxLength = max;
  $("next").addEventListener("click", () => navigate(Math.min(stage + 1, 3)));
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
          "Draft saved on this browser. It is unencrypted and has not been posted or funded.",
          "Brouillon enregistré dans ce navigateur. Il n’est pas chiffré et n’a été ni publié ni financé.",
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
            "No saved onboarding draft was found in this browser.",
            "Aucun brouillon de démarrage enregistré dans ce navigateur.",
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
        "Saved draft restored. Review it before sharing or funding.",
        "Brouillon enregistré restauré. Relisez-le avant de le partager ou de le financer.",
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
  $("export").addEventListener("click", () => {
    if (!ready()) return;
    const blob = new Blob(
        [JSON.stringify(toMetadata(read(), lang), null, 2) + "\n"],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "agi-job-brief.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status(
      say(
        "JSON downloaded. This is an unposted draft. In the console, verify live parameters and generate the final metadata before publishing.",
        "JSON téléchargé. Ce brouillon n’est pas publié. Dans la console, vérifiez les paramètres actifs et générez les métadonnées finales avant publication.",
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
