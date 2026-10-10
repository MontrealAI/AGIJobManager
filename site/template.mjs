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
  const consoleUrl = base + "agijobmanager-usdc.html";
  const canonical = `https://montrealai.github.io/AGIJobManager/${fr ? "fr/" : ""}`;
  const roles = t.roles
    .map(
      (
        r,
        i,
      ) => `<article class="role-panel" id="role-${r.id}" aria-labelledby="role-title-${r.id}">
    <div><p class="small-label">${e(r.name)}</p><h3 id="role-title-${r.id}">${e(r.title)}</h3><p>${e(r.text)}</p>
    <ol class="role-steps">${r.steps.map((s) => `<li>${e(s)}</li>`).join("")}</ol>${link(doc(r.path), r.link)}</div>
    <aside class="role-aside"><span class="role-number" aria-hidden="true">0${i + 1}</span><h4>${e(r.asideTitle)}</h4><p>${e(r.aside)}</p>${link(doc("docs/START_HERE.md"), t.nav[1])}</aside>
  </article>`,
    )
    .join("");
  return `<!doctype html>
<html lang="${t.lang}">
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
  <script type="module" src="${base}assets/app.mjs"></script>
</head>
<body>
  <a class="skip" href="#main">${e(t.skip)}</a>
  <header class="header"><div class="nav-wrap">
    <a class="brand" href="${fr ? "./" : "./"}" aria-label="AGI Jobs"><img src="${base}assets/mark.svg" alt="" width="36" height="36"><span>AGI Jobs<small>AGIJobManager</small></span></a>
    <nav aria-label="${fr ? "Navigation principale" : "Main navigation"}">${["how-it-works", "get-started", "payments", "resources"].map((id, i) => `<a href="#${id}">${e(t.nav[i])}</a>`).join("")}</nav>
    <div class="nav-actions"><a class="language" href="${fr ? "../" : "./fr/"}" lang="${fr ? "en" : "fr"}" hreflang="${fr ? "en" : "fr"}">${e(t.language)}</a><a class="button button-small" href="${consoleUrl}">${e(t.console)} <span aria-hidden="true">↗</span></a></div>
  </div></header>
  <main id="main">
    <section class="hero container" aria-labelledby="hero-title">
      <div class="hero-copy"><p class="eyebrow"><span class="spark" aria-hidden="true">✦</span> ${e(t.eyebrow)}</p>
        <h1 id="hero-title">${e(t.hero[0])}<br><span>${e(t.hero[1])}</span><br>${e(t.hero[2])}</h1>
        <p class="hero-intro">${e(t.intro)}</p>
        <div class="actions"><a class="button" href="#get-started">${e(t.start)} <span aria-hidden="true">→</span></a><a class="button button-quiet" href="${repo}">${e(t.source)} <span aria-hidden="true">↗</span></a></div>
        <p class="hero-note">${e(t.heroNote)}</p>
      </div>
      <figure class="orbit-figure"><div class="orbit-scene" aria-hidden="true"><div class="orbit-ring ring-one"></div><div class="orbit-ring ring-two"></div><div class="orbit-ring ring-three"></div><div class="orbit-cross"></div><div class="orbit-core"><img src="${base}assets/mark.svg" alt="" width="74" height="74"><strong>AGI JOBS</strong><span>USDC</span></div>${t.orbit.map((s, i) => `<div class="orbit-label orbit-label-${i}"><span>0${i + 1}</span>${e(s)}</div>`).join("")}<span class="star star-one">✧</span><span class="star star-two">✦</span><span class="star star-three">✧</span></div><figcaption>${e(t.orbitCaption)}</figcaption></figure>
    </section>
    <div class="container fact-strip">${t.facts.map((s) => `<span><i aria-hidden="true"></i>${e(s)}</span>`).join("")}<span class="version">${e(t.releaseLabel)} <strong>v${e(data.version)}</strong></span></div>
    <div class="release-strip container"><p>${e(t.releaseNote)}</p>${link(repo + "/releases/latest", t.releaseLink)}</div>
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
      <div class="evidence-grid"><article class="chain-record"><p class="small-label">${e(t.evidenceLabel)}</p><code id="manager-address">${e(data.evidence.manager)}</code><button type="button" class="copy-button" id="copy-address" disabled>${e(t.copy)}</button><span id="copy-status" class="small" role="status"></span>
        <dl class="record-meta"><div><dt>${e(t.evidenceDate)}</dt><dd>${e(data.evidence.observedDate)}</dd></div><div><dt>${e(t.evidenceBlock)}</dt><dd>${e(String(data.evidence.blockNumber))}</dd></div></dl>
        <p>${e(t.evidenceState)}</p><div class="record-links">${link("https://etherscan.io/address/" + data.evidence.manager + "#code", t.explorer)}${link(doc(data.evidencePath), t.evidenceLink)}</div>
      </article><div class="evidence-secondary"><article><h3>${e(t.registryTitle)}</h3><p>${e(data.registry.managerAddress ? (fr ? "Un gestionnaire est consigné dans le registre. Vérifiez sa configuration et son état actuel avant toute transaction." : "A manager is recorded in the registry. Verify its configuration and current state before transacting.") : t.registryText)}</p>${link(doc("config/usdc-deployment.json"), t.registryLink)}<br>${link(doc("docs/MAINNET_READINESS.md"), t.readiness)}</article><article><h3>${e(t.ensTitle)}</h3><p>${e(t.ensText)}</p>${link(doc("docs/ens-job-pages.md"), t.ensLink)}</article></div></div>
    </div></section>
    <section id="resources" class="section container"><p class="eyebrow">${e(t.docsEyebrow)}</p><h2>${e(t.docsTitle)}</h2><p class="section-intro">${e(t.docsIntro)}</p>
      <div class="search-wrap" hidden><label for="guide-search">${e(t.searchLabel)}</label><input id="guide-search" type="search" placeholder="${e(t.searchPlaceholder)}" autocomplete="off" aria-controls="resource-grid"><span id="search-count" class="small" role="status"></span></div>
      <div id="resource-grid" class="resources">${t.resources.map(([title, desc, p, keywords]) => `<a class="resource" href="${doc(p)}" data-search="${e(title + " " + desc + " " + keywords)}"><div><h3>${e(title)}</h3><p>${e(desc)}</p></div><span aria-hidden="true">↗</span></a>`).join("")}</div>
      <p id="no-results" hidden>${e(t.noResults)}</p>${link(doc("docs/README.md"), t.docsAll)}
    </section>
    <section class="section container faq-section"><h2>${e(t.faqTitle)}</h2><div class="faq-list">${t.faqs.map(([q, a]) => `<details><summary>${e(q)}</summary><p>${e(a)}</p></details>`).join("")}</div></section>
    <section class="end-section container"><div><p class="eyebrow">AGI JOBS</p><h2>${e(t.endTitle)}</h2><p>${e(t.endText)}</p></div><a class="button" href="${consoleUrl}">${e(t.console)} <span aria-hidden="true">↗</span></a></section>
  </main>
  <footer class="footer container"><div><a class="brand" href="${base}"><img src="${base}assets/mark.svg" alt="" width="32" height="32"><span>AGI Jobs</span></a><p>${e(t.footer)}</p></div><div class="footer-right"><nav aria-label="${fr ? "Liens de pied de page" : "Footer links"}">${[repo, repo + "/releases", doc("SECURITY.md"), doc("docs/LEGAL/README.md")].map((href, i) => `<a href="${href}">${e(t.footerLinks[i])}</a>`).join("")}</nav><p>${e(t.built)} <a href="${repo}/commit/${data.commit}"><code>${data.commit.slice(0, 8)}</code></a> · v${e(data.version)}</p></div></footer>
</body></html>`;
}
