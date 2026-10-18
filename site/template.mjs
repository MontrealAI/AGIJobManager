import { renderReading } from "./reading.mjs";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function render(t, data) {
  const e = escape,
    fr = t.lang === "fr",
    base = fr ? "../" : "./";
  const repo = "https://github.com/MontrealAI/AGIJobManager";
  const doc = (p) => `${repo}/blob/${data.commit}/${p}`;
  const link = (href, text, cls = "text-link") =>
    `<a class="${cls}" href="${e(href)}">${e(text)} <span aria-hidden="true">↗</span></a>`;
  const ecosystemUrls = {
    alpha: "https://montrealai.github.io/AGI-Alpha-Agent-v0/",
    jobs: "https://montrealai.github.io/AGIJobsv0/",
    manager: "https://montrealai.github.io/AGIJobManager/",
    fleet: "https://montrealai.github.io/AGI-Fleet-Linux/",
  };
  const ecosystemSymbols = { alpha: "✦", jobs: "◇", manager: "◎", fleet: "⌘" };
  const consoleUrl = base + "agijobmanager-usdc.html";
  const latest = data.latestDeployment, snapshot = latest.reportedAuthoritySnapshot;
  const historical = data.historicalEvidence;
  const canonical = `https://montrealai.github.io/AGIJobManager/${fr ? "fr/" : ""}`;
  const roles = t.roles
    .map(
      (
        r,
        i,
      ) => `<article class="role-panel" id="role-${r.id}" aria-labelledby="role-title-${r.id}">
    <div><p class="small-label">${e(r.name)}</p><h3 id="role-title-${r.id}">${e(r.title)}</h3><p>${e(r.text)}</p>
    <ol class="role-steps">${r.steps.map((s) => `<li>${e(s)}</li>`).join("")}</ol>${r.id === "employer" ? link("./employers/", t.easyStart.cta, "button") + " " : ""}${link(doc(r.path), r.link)}</div>
    <aside class="role-aside"><span class="role-number" aria-hidden="true">0${i + 1}</span><h4>${e(r.asideTitle)}</h4><p>${e(r.aside)}</p>${link(doc("docs/START_HERE.md"), t.nav[1])}</aside>
  </article>`,
    )
    .join("");
  return `<!doctype html>
<html class="home-html" lang="${t.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#100b20">
  <meta name="description" content="${e(t.description)}">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${e(t.title)}</title>
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="en" href="https://montrealai.github.io/AGIJobManager/">
  <link rel="alternate" hreflang="fr" href="https://montrealai.github.io/AGIJobManager/fr/">
  <link rel="alternate" hreflang="x-default" href="https://montrealai.github.io/AGIJobManager/">
  <meta property="og:title" content="${e(t.title)}">
  <meta property="og:description" content="${e(t.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:locale" content="${fr ? "fr_CA" : "en_CA"}">
  <link rel="icon" href="${base}assets/mark.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${base}assets/style.css">
  <link rel="stylesheet" href="${base}assets/home.css">
  <script type="module" src="${base}assets/app.mjs"></script>
</head>
<body class="home-page">
  <a class="skip" href="#main">${e(t.skip)}</a>
  <header class="header"><div class="nav-wrap">
    <a class="brand" href="${fr ? "./" : "./"}" aria-label="AGI Jobs"><img src="${base}assets/mark.svg" alt="" width="36" height="36"><span>AGI Jobs<small>${fr ? "Faisons avancer vos idées" : "Let’s make it happen"}</small></span></a>
    <nav aria-label="${fr ? "Navigation principale" : "Main navigation"}">${[["employer-welcome", t.easyStart.navLabel], ["ecosystem", t.ecosystem.nav], ["how-it-works", t.nav[0]], ["resources", t.nav[3]]].map(([id, label]) => `<a href="#${id}">${e(label)}</a>`).join("")}<a href="./successor/">${e(t.successor.nav)}</a></nav>
    <div class="nav-actions"><button id="home-larger-text" type="button" disabled hidden aria-pressed="false"><span aria-hidden="true">Aa</span> ${e(t.easyStart.largerText)}</button><a class="language" href="${fr ? "../" : "./fr/"}" lang="${fr ? "en" : "fr"}" hreflang="${fr ? "en" : "fr"}">${e(t.language)}</a><a class="button button-small" data-employer-entry="header" href="./employers/">${e(t.easyStart.cta)} <span aria-hidden="true">→</span></a></div>
  </div></header>
  <main id="main">
    <section class="home-hero-shell" aria-labelledby="hero-title"><div class="hero container">
      <div class="hero-copy"><p class="eyebrow"><span class="spark" aria-hidden="true">✦</span> ${e(t.eyebrow)}</p>
        <h1 id="hero-title">${e(t.hero[0])}<br><span>${e(t.hero[1])}</span>${t.hero[2] ? `<br>${e(t.hero[2])}` : ""}</h1>
        <p class="hero-intro">${e(t.intro)}</p>
        <div class="actions"><a class="button" data-employer-entry="hero" href="./employers/">${e(t.easyStart.cta)} <span aria-hidden="true">→</span></a><a class="button button-quiet" href="#employer-welcome">${e(t.start)} <span aria-hidden="true">↓</span></a></div>
        <p class="hero-note">${e(t.heroNote)}</p>
      </div>
      <aside class="home-preview" aria-label="${e(t.heroPreview.label)}"><p class="preview-label"><span aria-hidden="true">✦</span> ${e(t.heroPreview.label)}</p><blockquote>${e(t.heroPreview.quote)}</blockquote><ol class="preview-points">${t.heroPreview.points.map(([title, text], i) => `<li><span class="number" aria-hidden="true">${i + 1}</span><div><h3>${e(title)}</h3><p>${e(text)}</p></div></li>`).join("")}</ol><p class="preview-note">${e(t.heroPreview.note)}</p></aside>
    </div>
    </section>
    <section id="ecosystem" class="section ecosystem-section" aria-labelledby="ecosystem-title"><div class="container">
      <div class="ecosystem-heading"><p class="eyebrow">${e(t.ecosystem.eyebrow)}</p><h2 id="ecosystem-title">${e(t.ecosystem.title)}</h2><p class="section-intro">${e(t.ecosystem.intro)}</p></div>
      <div class="ecosystem-grid">${t.ecosystem.cards.map((card) => `<article class="ecosystem-card${card.id === "manager" ? " ecosystem-current" : ""}" aria-labelledby="ecosystem-${card.id}-title">
        <div class="ecosystem-card-top"><span class="ecosystem-symbol" aria-hidden="true">${ecosystemSymbols[card.id]}</span>${card.id === "manager" ? `<span class="ecosystem-current-label">${e(t.ecosystem.current)}</span>` : ""}</div>
        <p class="ecosystem-project">${e(card.name)}</p><h3 id="ecosystem-${card.id}-title">${e(card.role)}</h3><p class="ecosystem-description">${e(card.description)}</p><p class="ecosystem-detail">${e(card.detail)}</p>
        <a class="ecosystem-link" data-ecosystem-project="${card.id}" href="${ecosystemUrls[card.id]}"><span>${e(t.ecosystem.open)}<span class="sr-only">: ${e(card.name)}</span></span><span aria-hidden="true">↗&#xfe0e;</span></a>
      </article>`).join("")}</div>
      <aside class="ecosystem-boundary" aria-labelledby="ecosystem-boundary-title"><span aria-hidden="true">⊕</span><div><h3 id="ecosystem-boundary-title">${e(t.ecosystem.boundaryTitle)}</h3><p>${e(t.ecosystem.boundary)}</p></div></aside>
    </div></section>
    <section id="successor-welcome" class="section container" aria-labelledby="successor-title"><p class="eyebrow">SUCCESSOR Ω</p><h2 id="successor-title">${e(t.successor.title)}</h2><p class="section-intro">${e(t.successor.description)}</p><div class="actions"><a class="button" data-successor-entry="home" href="./successor/">${e(t.successor.cta)} <span aria-hidden="true">→</span></a><span class="reassurance">${e(t.successor.note)}</span></div></section>
    <section id="employer-welcome" class="section container" aria-labelledby="welcome-title">
      <div class="welcome-heading"><p class="eyebrow">${e(t.easyStart.eyebrow)}</p><h2 id="welcome-title">${e(t.easyStart.title)}</h2><p class="section-intro">${e(t.easyStart.intro)}</p></div>
      <div class="welcome-examples">${t.easyStart.examples.map(([title, text], i) => `<article><span class="welcome-icon" aria-hidden="true">${["↗", "⇄", "▤", "≡", "▥", "+"][i]}</span><h3>${e(title)}</h3><p>${e(text)}</p></article>`).join("")}</div>
      <ol class="welcome-steps">${t.easyStart.steps.map(([title, text], i) => `<li><span aria-hidden="true">${i + 1}</span><h3>${e(title)}</h3><p>${e(text)}</p></li>`).join("")}</ol>
      <div class="welcome-actions"><a class="button" data-employer-entry="welcome" href="./employers/">${e(t.easyStart.cta)} <span aria-hidden="true">→</span></a><p class="reassurance">${e(t.easyStart.reassurance)}</p></div><p class="welcome-payment">${e(t.easyStart.paymentNote)}</p>
    </section>
    <noscript><p class="container notice">${e(t.noscript)}</p></noscript>
    <section id="get-started" class="section container">
      <p class="eyebrow">${e(t.roleEyebrow)}</p><h2>${e(t.roleTitle)}</h2><p class="section-intro">${e(t.roleIntro)}</p>
      <div class="role-controls" role="group" aria-label="${e(t.roleTitle)}" hidden>${t.roles.map((r) => `<button type="button" data-role="${r.id}" aria-controls="role-${r.id}" aria-pressed="false">${e(r.label)} <span aria-hidden="true">↗</span></button>`).join("")}</div>
      <div class="role-panels">${roles}</div>
    </section>
    <section id="how-it-works" class="section flow-section"><div class="container">
      <p class="eyebrow">${e(t.flowEyebrow)}</p><h2>${e(t.flowTitle)}</h2><p class="section-intro">${e(t.flowIntro)}</p>
      <ol class="flow">${t.flow.map(([title, text], i) => `<li><span class="step-number">0${i + 1}</span><h3>${e(title)}</h3><p>${e(text)}</p></li>`).join("")}</ol>
      <div class="outcomes">${t.outcomes.map(([title, text]) => `<div><h4>${e(title)}</h4><p>${e(text)}</p></div>`).join("")}</div>
      <div class="flow-visual"><figure class="orbit-figure"><div class="orbit-scene" aria-hidden="true"><div class="orbit-ring ring-one"></div><div class="orbit-ring ring-two"></div><div class="orbit-ring ring-three"></div><div class="orbit-cross"></div><div class="orbit-core"><img src="${base}assets/mark.svg" alt="" width="74" height="74"><strong>AGI JOBS</strong><span>USDC</span></div>${t.orbit.map((s, i) => `<div class="orbit-label orbit-label-${i}"><span>0${i + 1}</span>${e(s)}</div>`).join("")}<span class="star star-one">✧</span><span class="star star-two">✦</span><span class="star star-three">✧</span></div><figcaption>${e(t.orbitCaption)}</figcaption></figure></div>
      ${link(doc("docs/PROTOCOL_FLOW.md"), t.flowLink)}
    </div></section>
    <section class="section container work-section"><div class="section-heading"><h2>${e(t.workTitle)}</h2><p>${e(t.workIntro)}</p></div>
      <div class="examples">${t.examples.map(([n, title, text]) => `<article><span>${n}</span><div><h3>${e(title)}</h3><p>${e(text)}</p></div></article>`).join("")}</div>
      ${link(doc("docs/OPERATIONS/GENERAL_COMPUTER_WORK.md"), t.workLink)}
    </section>
    <section id="payments" class="section container"><p class="eyebrow">${e(t.payEyebrow)}</p><h2>${e(t.payTitle)}</h2><p class="section-intro">${e(t.payIntro)}</p>
      <div class="calculator"><div class="calc-inputs"><label for="job-cost">${e(t.costLabel)}</label><div class="amount-input"><input id="job-cost" disabled type="text" inputmode="decimal" value="1000" maxlength="32" aria-describedby="calc-note calc-error" autocomplete="off"><span>USDC</span></div>
        <div class="presets" role="group" aria-label="${e(t.presets)}">${[100, 1000, 10000].map((n) => `<button type="button" disabled data-cost="${n}">${n.toLocaleString(fr ? "fr-CA" : "en-CA")}</button>`).join("")}</div>
        <label for="validator-rate">${e(t.rateLabel)}</label><input id="validator-rate" disabled type="number" min="1" max="60" step="1" value="8" aria-describedby="rate-help calc-error"><p id="rate-help" class="small">${e(t.rateHelp)}</p>
        <button type="button" id="calculate" disabled class="button">${e(t.calculate)} <span aria-hidden="true">→</span></button><p id="calc-error" class="error" role="alert"></p>
      </div><div class="calc-results" aria-live="polite" aria-atomic="true"><div class="split-bar" aria-hidden="true"><span class="segment-agent"></span><span class="segment-validators"></span><span class="segment-wallet30"></span><span class="segment-wallet10"></span></div>
        <dl class="allocation">${["agent", "validators", "wallet30", "wallet10"].map((key, i) => `<div class="allocation-${key}"><dt><i aria-hidden="true"></i>${e(t.allocations[i])}</dt><dd id="amount-${key}">${[520, 80, 300, 100][i]} USDC</dd></div>`).join("")}</dl>
        <p id="calc-note" class="small">${e(t.calcNote)}</p>
      </div></div>
      <p class="small">${e(t.payExample)}</p><p class="payment-boundary">${e(t.payOther)}</p>${link(doc("docs/USDC_PAYOUT_SPLIT.md"), t.payLink)}
    </section>
    <section class="section evidence-section" id="deployment"><div class="container"><p class="eyebrow">${e(t.evidenceEyebrow)}</p><h2>${e(t.evidenceTitle)}</h2><p class="section-intro">${e(t.evidenceIntro)}</p>
      <div class="evidence-grid"><article class="chain-record" id="latest-deployment" aria-labelledby="latest-deployment-title"><h3 class="small-label" id="latest-deployment-title">${e(t.evidenceLabel)}</h3><code id="manager-address">${e(latest.manager)}</code><button type="button" class="copy-button" id="copy-address" disabled>${e(t.copy)}</button><span id="copy-status" class="small" role="status"></span>
        <dl class="record-meta"><div><dt>${e(t.evidenceDate)}</dt><dd data-deployment-date>${e(latest.recordDate)}</dd></div><div><dt>${e(t.evidenceBlock)}</dt><dd data-deployment-block>${e(String(snapshot.blockNumber))}</dd></div></dl>
        <p data-deployment-state>${e(t.evidenceState)}</p>
        <p data-deployment-matches><strong>${e(String(latest.explorerVerification.exactMatches))} ${e(t.exactMatch)} · ${e(String(latest.explorerVerification.retainedSimilarMatches))} ${e(t.similarMatch)}</strong></p><p>${e(t.explorerBoundary)}</p>
        <dl class="record-meta"><div><dt>${e(t.governorLabel)}</dt><dd><code data-deployment-governor>${e(snapshot.owner)}</code></dd></div><div><dt>${e(t.sourceLabel)}</dt><dd><a href="${repo}/commit/${e(latest.source.commit)}"><code data-deployment-source>${e(latest.source.commit)}</code></a></dd></div></dl>
        <p>${e(t.governorNote)}</p><div class="record-links">${link(latest.verificationLinks.managerCode, t.explorer)}${link(doc(data.latestDeploymentPath), t.evidenceLink)}${link(doc(data.latestDeploymentGuide), t.deploymentGuide)}</div>
        <details id="deployment-contracts"><summary>${e(String(latest.contracts.length))} ${e(t.contractInventory)}</summary><ol>${latest.contracts.map(contract => `<li data-deployment-contract="${e(contract.name)}" data-explorer-match="${e(contract.explorerMatchStatus)}"><strong>${e(contract.name)}</strong> — ${e(contract.explorerMatchStatus === "EXACT_MATCH" ? t.exactMatch : t.similarMatch)}<code>${e(contract.address)}</code>${link(contract.explorerCodeUrl, t.contractCode)} · ${link(contract.deploymentTransactionUrl, t.creationTransaction)}</li>`).join("")}</ol></details>
      </article><div class="evidence-secondary"><article><h3>${e(t.registryTitle)}</h3><p>${e(data.registry.managerAddress ? (fr ? "Un gestionnaire est consigné dans le registre. Vérifiez sa configuration et son état actuel avant toute transaction." : "A manager is recorded in the registry. Verify its configuration and current state before transacting.") : t.registryText)}</p>${link(doc("config/usdc-deployment.json"), t.registryLink)}<br>${link(doc("docs/MAINNET_READINESS.md"), t.readiness)}</article>
      <article id="historical-deployment" aria-labelledby="historical-deployment-title"><h3 id="historical-deployment-title">${e(t.historicalTitle)}</h3><p>${e(t.historicalDate)} <strong>${e(historical.recordDate)}</strong> · ${e(t.evidenceBlock)} <strong>${e(String(historical.connection.snapshot.number))}</strong>.</p><p>${e(t.historicalManager)}<br><code data-historical-manager>${e(historical.manager)}</code></p><p>${e(t.historicalHelper)}<br><code data-historical-helper>${e(historical.helper)}</code></p><p>${e(t.historicalBoundary)}</p>${link(doc(data.historicalEvidencePath), t.historicalRecord)}<br>${link(doc("docs/deployments/MAINNET_USDC_2026-10-10.md"), t.historicalGuide)}</article>
      <article id="latest-ens-boundary"><h3>${e(t.ensTitle)}</h3><p>${e(t.ensText)}</p><p>${e(t.noTransactionTarget)}</p>${link(doc("docs/ens-job-pages.md"), t.ensLink)}</article></div></div>
    </div></section>
    <section id="technical-access" class="section container"><div class="technical-heading"><h2>${e(t.easyStart.toolsTitle)}</h2><p>${e(t.easyStart.toolsText)}</p></div><div class="technical-links"><a id="advanced-console-link" class="button button-quiet" href="${consoleUrl}">${e(t.easyStart.consoleLink)} <span aria-hidden="true">↗</span></a>${link(repo, t.source)}</div>
    <div class="fact-strip">${t.facts.map((s) => `<span><i aria-hidden="true"></i>${e(s)}</span>`).join("")}<span class="version">${e(t.releaseLabel)} <strong>v${e(data.version)}</strong></span></div>
    <div class="release-strip"><p>${e(t.releaseNote)}</p>${link(repo + "/releases/latest", t.releaseLink)}</div>
    </section>
    <section id="resources" class="section container"><p class="eyebrow">${e(t.docsEyebrow)}</p><h2>${e(t.docsTitle)}</h2><p class="section-intro">${e(t.docsIntro)}</p>
      <div class="search-wrap" hidden><label for="guide-search">${e(t.searchLabel)}</label><input id="guide-search" type="search" placeholder="${e(t.searchPlaceholder)}" autocomplete="off" aria-controls="resource-grid"><span id="search-count" class="small" role="status"></span></div>
      <p><a class="button button-secondary" href="./workflows/">${fr ? "Explorer toutes les démos et parcours" : "Explore all demos and workflows"}</a></p>
      <div id="resource-grid" class="resources">${t.resources.map(([title, desc, p, keywords]) => `<a class="resource" href="${doc(p)}" data-search="${e(title + " " + desc + " " + keywords)}"><div><h3>${e(title)}</h3><p>${e(desc)}</p></div><span aria-hidden="true">↗</span></a>`).join("")}</div>
      <p><a class="text-link" href="#reading">${fr ? "Lire les articles choisis" : "Read selected articles"} <span aria-hidden="true">↓</span></a></p>
      <p id="no-results" hidden>${e(t.noResults)}</p>${link(doc("docs/README.md"), t.docsAll)}
    </section>
    ${renderReading(t.lang, doc)}
    <section class="section container faq-section"><h2>${e(t.faqTitle)}</h2><div class="faq-list">${t.faqs.map(([q, a]) => `<details><summary>${e(q)}</summary><p>${e(a)}</p></details>`).join("")}</div></section>
    <section class="end-section container"><div><p class="eyebrow">AGI JOBS</p><h2>${e(t.endTitle)}</h2><p>${e(t.endText)}</p></div><a class="button" data-employer-entry="footer" href="./employers/">${e(t.easyStart.cta)} <span aria-hidden="true">→</span></a></section>
  </main>
  <footer class="footer container"><div><a class="brand" href="${base}"><img src="${base}assets/mark.svg" alt="" width="32" height="32"><span>AGI Jobs</span></a><p>${e(t.footer)}</p></div><div class="footer-right"><nav aria-label="${fr ? "Liens de pied de page" : "Footer links"}">${[repo, repo + "/releases", doc("SECURITY.md"), doc("docs/LEGAL/README.md")].map((href, i) => `<a href="${href}">${e(t.footerLinks[i])}</a>`).join("")}</nav><p>${e(t.built)} <a href="${repo}/commit/${data.commit}"><code>${data.commit.slice(0, 8)}</code></a> · v${e(data.version)}</p></div></footer>
</body></html>`;
}
