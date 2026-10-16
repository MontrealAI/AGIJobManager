const articles = [
  {
    "id": "market",
    "title": "The Market Before the Miracle",
    "url": "https://www.linkedin.com/pulse/market-before-miracle-vincent-boucher-9edxe/",
    "guide": "docs/OPERATIONS/PROJECT_ECONOMICS.md",
    "topic": {
      "en": "Choosing a worker",
      "fr": "Choisir un prestataire"
    },
    "summary": {
      "en": "Consider why finding the right solver deserves its own budget, evidence and fallback plan before the main assignment.",
      "fr": "Découvrez pourquoi le choix du bon prestataire mérite un budget, des preuves et une solution de repli avant la mission principale."
    }
  },
  {
    "id": "memory",
    "title": "Public Memory for Machine Labor: ENS Job Pages as Civilization-Scale Knowledge Substrates",
    "url": "https://www.linkedin.com/pulse/public-memory-machine-labor-ens-job-pages-knowledge-vincent-boucher-seifc/",
    "guide": "docs/ens-job-pages.md",
    "topic": {
      "en": "Evidence & memory",
      "fr": "Preuves et mémoire"
    },
    "summary": {
      "en": "Explore how a work history can keep the original request, delivered result and review discoverable together.",
      "fr": "Voyez comment un historique peut réunir la demande initiale, le résultat livré et sa revue pour les retrouver ensemble."
    }
  },
  {
    "id": "judge",
    "title": "No Judge but Code",
    "url": "https://www.linkedin.com/pulse/judge-code-vincent-boucher-ailze/",
    "guide": "docs/BUYER_PROTECTION.md",
    "topic": {
      "en": "A delivery case study",
      "fr": "Un cas de livraison"
    },
    "summary": {
      "en": "Follow a historical delivery dispute to see why the specification, completion reference and settlement record must agree.",
      "fr": "Suivez un litige de livraison historique pour comprendre pourquoi le cahier des charges, la référence du résultat et le règlement doivent concorder."
    }
  },
  {
    "id": "trust",
    "title": "DiscoveryPrime: A High-Trust Operating Model for Scalable Workforce Coordination in the AI Era",
    "url": "https://www.linkedin.com/pulse/discoveryprime-high-trust-operating-model-scalable-ai-vincent-boucher-xqzpe/",
    "guide": "docs/START_HERE.md",
    "topic": {
      "en": "Commissioning work",
      "fr": "Commander du travail"
    },
    "summary": {
      "en": "Explore structured provider selection and evaluator-backed review as design ideas for consequential work.",
      "fr": "Explorez la sélection structurée des prestataires et la revue par des évaluateurs pour les travaux importants."
    }
  }
];

const copy = {
  "en": {
    "eyebrow": "SELECTED READING",
    "title": "The ideas behind the work.",
    "intro": "Commission useful work with clear acceptance criteria and an inspectable record.",
    "note": "Essays by Vincent Boucher · English originals on LinkedIn. Some describe earlier versions; current guides explain setup, payments and availability. LinkedIn may ask you to sign in.",
    "current": "Explore the current guide",
    "all": "Reading notes and version context",
    "source": "English essay · LinkedIn",
    "boundary": "AGIJobManager uses USDC. Historical $AGIALPHA examples describe their own dated deployments; the current operating guides govern this route."
  },
  "fr": {
    "eyebrow": "LECTURES CHOISIES",
    "title": "Les idées derrière le travail.",
    "intro": "Commandez du travail utile avec des critères d’acceptation clairs et un historique consultable.",
    "note": "Articles de Vincent Boucher · Originaux anglais sur LinkedIn. Certains décrivent d’anciennes versions; les guides actuels précisent l’installation, les paiements et la disponibilité. LinkedIn peut demander une connexion.",
    "current": "Explorer le guide actuel",
    "all": "Notes de lecture et contexte des versions",
    "source": "Article anglais · LinkedIn",
    "boundary": "AGIJobManager utilise l’USDC. Les exemples historiques en $AGIALPHA concernent leurs déploiements datés; les guides actuels encadrent ce parcours."
  }
};

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

export function renderReading(lang, guide) {
  const c = copy[lang];
  if (!c) throw new Error("Unsupported reading language");
  const current = (path) => {
    const href = guide(path);
    if (typeof href !== "string" || !href) throw new Error("Missing current reading guide: " + path);
    return escape(href);
  };
  const cards = articles.map((article) => `
    <article class="reading-card" aria-labelledby="reading-${article.id}-title">
      <p class="reading-topic">${escape(article.topic[lang])}</p>
      <h3 id="reading-${article.id}-title"><a href="${escape(article.url)}" lang="en" rel="external noreferrer">${escape(article.title)}</a></h3>
      <p>${escape(article.summary[lang])}</p><p class="reading-source">${escape(c.source)}</p>
      <a class="reading-guide" href="${current(article.guide)}">${escape(c.current)}<span class="sr-only">: ${escape(article.topic[lang])}</span> <span aria-hidden="true">↗</span></a>
    </article>`).join("");
  return `<section id="reading" class="reading-section section container" aria-labelledby="reading-title">
    <div class="reading-heading"><p class="reading-eyebrow">${escape(c.eyebrow)}</p><h2 id="reading-title">${escape(c.title)}</h2><p>${escape(c.intro)}</p></div>
    <div class="reading-grid">${cards}</div>
    <p class="reading-note">${escape(c.note)}</p><p class="reading-context">${escape(c.boundary)}</p>
    <a class="reading-guide" href="${current("docs/READING.md")}">${escape(c.all)} <span aria-hidden="true">↗</span></a>
  </section>`;
}
