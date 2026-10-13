import { fail, canonical, LIMITS } from './safe.mjs';
import { defaultMission } from './missions.mjs';
import { recordPlan, createSystem, chooseCandidate, compareCandidates, exportCapsule, readableSummary, STORAGE_KEY } from './model.mjs';
import { planAlternatives } from './jobs.mjs';
import { CONSOLE_DRAFT_KEY } from '../employer-model.mjs';
import { formatUSDC } from '../payments.mjs';
import { sourceZip } from './archive.mjs';

export function initialize() {
  let lang = document.documentElement.lang, state = null, candidate = null, plan = null, inspected = null, previewURL = null, currentWorker = null, rejectWork = null, runNumber = 0, backupRaw = null, actionBusy = false;
  const pristine = '<!doctype html>\n' + document.documentElement.outerHTML;
  const source = JSON.parse(document.querySelector('#successor-source').textContent);
  const sources = JSON.parse(document.querySelector('#successor-sources').textContent);
  const workerSource = JSON.parse(document.querySelector('#successor-worker').textContent);
  const layouts = JSON.parse(document.querySelector('#successor-layouts').textContent);
  const $ = id => document.getElementById(id), t = (en, fr) => lang === 'fr' ? fr : en;
  const say = message => { $('status').textContent = message; };
  function report(error) {
    if (error.failureState) { state = error.failureState; candidate = state.candidates.find(c => c.id === state.active) || null; redraw(); }
    const messages = {
      FIELD_REQUIRED: ['Complete this field before running your mission.', 'Remplissez ce champ avant de lancer la mission.'],
      PUBLIC_CONSENT: ['Confirm that these inputs are public and safe to use.', 'Confirmez que ces données sont publiques et utilisables.'], PRIVATE_INPUT: ['Remove personal information, secrets or private links, then try again.', 'Retirez les renseignements personnels, secrets ou liens privés, puis réessayez.'], CSV_HEADER: ['Use the CSV header id,category,value, or choose the supplied example.', 'Utilisez l’en-tête CSV id,category,value, ou choisissez l’exemple.'], DATA_DECIMAL: ['Each value must be text with up to six decimal places, such as 12.50. JSON numbers must be quoted.', 'Chaque valeur doit être un texte avec au plus six décimales, par exemple 12.50. Mettez les nombres JSON entre guillemets.'], DUPLICATE_CONFLICT: ['The same ID has different content. Correct the source or choose a new ID; no row has been silently discarded.', 'Un identifiant correspond à des contenus différents. Corrigez la source ou choisissez un nouvel identifiant; aucune ligne n’a été éliminée silencieusement.'], NEW_MISSION: ['Your inputs changed. Download your current work, then confirm the new-mission checkbox before running.', 'Vos données ont changé. Téléchargez votre travail actuel, puis cochez la confirmation de nouvelle mission.'], SELECT_VERSION: ['Choose “Keep this version” before preparing an improvement.', 'Choisissez « Conserver cette version » avant de préparer une amélioration.'], RESTORE_CONFIRMATION: ['Review the restore preview and tick its confirmation box.', 'Examinez l’aperçu de restauration et cochez sa confirmation.'], RUNTIME_UNAVAILABLE: ['This custom mission can be planned, but its runtime is not connected. Keep the draft or choose a supported example.', 'Cette mission peut être préparée, mais son environnement d’exécution n’est pas connecté. Conservez le brouillon ou choisissez un exemple disponible.'], USDC_PRICE_REQUIRED: ['Enter a new proposed USDC cost. This is not a payment.', 'Saisissez un nouveau coût proposé en USDC. Ce n’est pas un paiement.'], STOPPED: ['Stopped. Your previous work is preserved.', 'Arrêté. Votre travail précédent est conservé.'], TIME_LIMIT: ['The local time limit was reached. Reduce the input and try again.', 'La limite de temps est atteinte. Réduisez les données et réessayez.'], STORAGE: ['This browser could not save or read the file. Download a copy to continue safely.', 'Ce navigateur ne peut pas enregistrer ou lire le fichier. Téléchargez une copie pour continuer.'], CONSOLE_CONFLICT: ['Another console draft exists. Download it and confirm replacement below, or keep the new request as a file.', 'Un brouillon existe déjà dans la console. Téléchargez-le et confirmez son remplacement ci-dessous, ou conservez la nouvelle demande dans un fichier.'], HANDOFF_CONSENT: ['Review the exact public request and confirm before copying it.', 'Vérifiez la demande publique exacte et confirmez avant de la copier.'], OFFLINE_HANDOFF: ['Open the hosted Builder to copy to the console, or download this request. Offline files cannot share its browser storage.', 'Ouvrez le Builder hébergé pour copier dans la console, ou téléchargez la demande. Les fichiers hors ligne ne partagent pas son stockage.'], WORKER_UNAVAILABLE: ['This browser blocks local workers. Open the file in a supported desktop browser; you can still download and inspect your files.', 'Ce navigateur bloque les traitements locaux. Ouvrez le fichier dans un navigateur de bureau pris en charge; vos téléchargements restent disponibles.'], RETAIN_INCUMBENT: ['This candidate did not improve the measured gap. Keep the current version.', 'Ce candidat n’améliore pas la limite mesurée. Conservez la version actuelle.'], SOURCE_FILES: ['The editable source bundle is unavailable. Use the source link in the guide.', 'Le code source intégré est indisponible. Utilisez le lien du guide.'], CAPSULE_CHANGED: ['The file checksum does not match. Restore your original exported copy.', 'L’empreinte ne correspond pas. Restaurez votre copie originale.']
    };
    const code = error.code || error.message;
    $('error').textContent = (messages[code]?.[lang === 'fr' ? 1 : 0] || t('The input could not be accepted. Check the format and limits, or try the supplied example.', 'Les données ne peuvent pas être acceptées. Vérifiez le format et les limites, ou essayez l’exemple fourni.')) + ' [' + String(code).slice(0, 80) + ']';
    $('error').hidden = false; $('error').focus();
    const fieldId = error.field || ({ USDC_PRICE_REQUIRED: 'budget', CSV_HEADER: 'data', DATA_DECIMAL: 'data', DUPLICATE_CONFLICT: 'data' })[code];
    if (fieldId && $(fieldId)) { const field = $(fieldId), hint = document.createElement('p'); hint.id = fieldId + '-error'; hint.className = 'field-error'; hint.textContent = $('error').textContent; field.after(hint); field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', hint.id); }
    if (code === 'PUBLIC_CONSENT') $('public-consent').setAttribute('aria-invalid', 'true');
    if (code === 'NEW_MISSION') $('new-mission-wrap').hidden = false;
  }
  function bind(id, action, event = 'click') { $(id).addEventListener(event, async e => {
    e.preventDefault();
    if ((actionBusy || currentWorker) && id !== 'stop') { say(t('Please wait for this action to finish, or choose Stop.', 'Attendez la fin de cette action, ou choisissez Arrêter.')); return; }
    const ownsAction = !actionBusy; if (ownsAction) actionBusy = true;
    $('error').hidden = true; document.querySelectorAll('.field-error').forEach(el => el.remove()); document.querySelectorAll('[aria-invalid]').forEach(el => { el.removeAttribute('aria-invalid'); if (el.getAttribute('aria-describedby')?.endsWith('-error')) el.removeAttribute('aria-describedby'); });
    try { await action(e); } catch (error) { report(error); } finally { if (ownsAction) actionBusy = false; }
  }); }
  function download(name, content, mediaType = 'application/json') {
    const blob = new Blob([content], { type: mediaType }), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    say(t('Download requested. Check your Downloads folder. If your browser blocks it, allow this download or use Print for the summary.', 'Téléchargement demandé. Consultez votre dossier Téléchargements. S’il est bloqué, autorisez-le ou utilisez Imprimer pour le résumé.'));
  }
  async function work(operation, payload) {
    fail(!currentWorker, 'BUSY'); fail(typeof Worker !== 'undefined', 'WORKER_UNAVAILABLE');
    const blobURL = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    try { currentWorker = new Worker(blobURL); } catch { URL.revokeObjectURL(blobURL); fail(false, 'WORKER_UNAVAILABLE'); }
    const worker = currentWorker, controls = [...document.querySelectorAll('#interface button,#interface input,#interface textarea')].map(element => [element, element.disabled]);
    for (const [element] of controls) element.disabled = true;
    $('stop').disabled = false; $('results').setAttribute('aria-busy', 'true');
    return new Promise((resolve, reject) => {
      let timer, settled = false;
      const finish = (error, result) => {
        if (settled) return; settled = true;
        clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(blobURL);
        if (currentWorker === worker) { currentWorker = null; rejectWork = null; for (const [element, disabled] of controls) element.disabled = disabled; $('results').setAttribute('aria-busy', 'false'); }
        error ? reject(error) : resolve(result);
      };
      rejectWork = () => finish(Object.assign(new Error('STOPPED'), { code: 'STOPPED' }));
      timer = setTimeout(() => finish(Object.assign(new Error('TIME_LIMIT'), { code: 'TIME_LIMIT' })), 10000);
      worker.onmessage = ({ data }) => data.error ? finish(Object.assign(new Error(data.error), { code: data.code, failureState: data.failureState })) : finish(null, data.result);
      worker.onerror = () => finish(Object.assign(new Error('WORKER_UNAVAILABLE'), { code: 'WORKER_UNAVAILABLE' }));
      try { worker.postMessage({ operation, payload }); } catch { finish(Object.assign(new Error('WORKER_UNAVAILABLE'), { code: 'WORKER_UNAVAILABLE' })); }
    });
  }
  function addSection(section = { heading: '', body: '' }) {
    fail($('site-sections').children.length < 12, 'SITE_SECTIONS'); const n = $('site-sections').children.length, wrapper = document.createElement('div'); wrapper.className = 'site-section';
    for (const [key, label, isArea, max] of [['heading', t('Section heading', 'Titre de section'), false, 120], ['body', t('Section text', 'Texte de section'), true, 3000]]) {
      const input = document.createElement(isArea ? 'textarea' : 'input'), element = document.createElement('label'); input.id = `section-${n}-${key}`; input.dataset.sectionField = key; input.maxLength = max; input.value = section[key]; element.htmlFor = input.id; element.textContent = label + ' ' + (n + 1); wrapper.append(element, input);
    }
    $('site-sections').append(wrapper);
  }
  function showMission(mission) {
    document.querySelector(`[name="kind"][value="${mission.kind}"]`).checked = true;
    for (const key of ['name', 'purpose', 'rights']) $(key).value = mission[key];
    for (const kind of ['analyst', 'website', 'custom']) $(kind + '-fields').hidden = kind !== mission.kind;
    if (mission.kind === 'analyst') $('data').value = mission.input;
    if (mission.kind === 'website') { const content = JSON.parse(mission.input); $('site-title').value = content.title; $('site-intro').value = content.intro; $('site-sections').replaceChildren(); content.sections.forEach(addSection); }
    if (mission.kind === 'custom') { $('custom-input').value = mission.input; $('custom-tools').value = mission.tools; $('custom-outputs').value = mission.outputs; $('custom-success').value = mission.success; }
    $('run').textContent = mission.kind === 'custom' ? t('Keep my mission draft', 'Conserver mon brouillon') : t('Create & run my Ω', 'Créer et exécuter mon Ω');
  }
  function formMission() {
    const kind = document.querySelector('[name="kind"]:checked').value, mission = defaultMission(kind, state?.mission.language || lang);
    for (const key of ['name', 'purpose', 'rights']) mission[key] = $(key).value;
    mission.input = kind === 'analyst' ? $('data').value : kind === 'custom' ? $('custom-input').value : JSON.stringify({ title: $('site-title').value, intro: $('site-intro').value, sections: [...$('site-sections').children].map(section => Object.fromEntries([...section.querySelectorAll('[data-section-field]')].map(el => [el.dataset.sectionField, el.value]))) }, null, 2);
    if (kind === 'custom') { mission.outputs = $('custom-outputs').value; mission.success = $('custom-success').value; mission.tools = $('custom-tools').value; }
    return mission;
  }
  function previousSelection() { return state && [...state.chronicle].reverse().find(e => ['keep', 'replace', 'rollback'].includes(e.action) && e.subject !== state.active); }
  function redraw() {
    const active = state?.candidates.find(c => c.id === state.active);
    for (const id of ['download-html', 'download-capsule', 'download-brief', 'download-source', 'save', 'print', 'prepare-job']) $(id).disabled = !state;
    $('empty-results').hidden = Boolean(candidate); $('result-content').hidden = !candidate;
    $('improve-local').disabled = !active || state.mission.kind === 'custom' || Boolean(currentWorker); $('retain').disabled = !active;
    $('rollback').disabled = !previousSelection();
    if (candidate) {
      $('result-summary').textContent = (candidate.checker.passed ? t('Checks passed', 'Vérifications réussies') : t('Checks failed — keep the current version', 'Échec des vérifications — gardez la version actuelle')) + ' · ' + t('Local measurement', 'Mesure locale') + ' · ' + (candidate.manifest.variant === 'baseline' ? t('Original version', 'Version initiale') : t('Improved candidate', 'Candidat amélioré'));
      if (previewURL) URL.revokeObjectURL(previewURL); previewURL = URL.createObjectURL(new Blob([candidate.files.find(f => f.name.endsWith('.html')).content], { type: 'text/html' })); $('preview').src = previewURL;
      $('artifact-downloads').replaceChildren();
      for (const file of candidate.files) { const button = document.createElement('button'); button.type = 'button'; button.textContent = t('Download ', 'Télécharger ') + file.name; button.onclick = () => download(file.name, file.content, file.mediaType); $('artifact-downloads').append(button); }
      $('checks').replaceChildren(); for (const check of candidate.checker.checks) { const li = document.createElement('li'); li.textContent = (check.passed ? '✓ ' : '✕ ') + check.id; if (!check.passed) li.className = 'checks-fail'; $('checks').append(li); }
      $('file-manifest').textContent = JSON.stringify(candidate.files.map(({ content, ...file }) => file), null, 2);
      $('keep-version').disabled = !candidate.checker.passed || state.active === candidate.id || Boolean(active && compareCandidates(active, candidate).outcome !== 'improvement');
    }
    $('gap').textContent = active ? active.gaps.length ? (state.mission.kind === 'analyst' ? t('Some IDs repeat. The original report counts every row accurately. Try counting identical repeats once; conflicting duplicates will be rejected.', 'Certains identifiants se répètent. Le rapport initial compte exactement chaque ligne. Essayez de compter une seule fois les répétitions identiques; les doublons contradictoires seront refusés.') : t('The site is usable; visitors can scroll through it. Add direct links so they can jump to each section.', 'Le site est utilisable et se parcourt par défilement. Ajoutez des liens directs vers chaque section.')) : t('No supported gap remains in this input. You can rerun a comparison; a tie keeps the incumbent. Or prepare your own request.', 'Aucune limite prise en charge ne subsiste. Vous pouvez relancer la comparaison; une égalité conserve la version actuelle. Ou préparez votre propre demande.') : t('Run a mission and keep a version to see the next opportunity.', 'Exécutez une mission et conservez une version pour voir la prochaine possibilité.');
    $('chronicle').textContent = state ? readableSummary(state) : '';
    $('alternatives').replaceChildren(); if (state) for (const option of planAlternatives(state)) { const li = document.createElement('li'); const french = { retain: ['Conserver', 'Garder la version choisie et ses limites.'], repair: ['Améliorer', 'Appliquer l’amélioration locale vérifiée et comparer les fichiers.'], build: ['Construire', 'Créer un candidat borné à partir du modèle fourni.'], rent: ['Louer', 'Aucun devis de fournisseur ni environnement validé n’est connecté.'], partner: ['Collaborer', 'Aucune capacité partenaire ni revue indépendante n’est confirmée.'], reserve: ['Réserver', 'Un budget proposé ne réserve ni exécutants ni fonds.'], stop: ['Arrêter', 'Conserver les fichiers sans nouvelle exécution ni dépense.'] }; li.textContent = (lang === 'fr' ? french[option.id][0] : option.id) + ' — ' + (option.available ? t('available', 'disponible') : t('unavailable', 'indisponible')) + ': ' + (lang === 'fr' ? french[option.id][1] : option.reason); $('alternatives').append(li); }
  }
  function clearInspection() { inspected = null; $('restore-preview').hidden = true; $('restore-consent').checked = false; $('restore-summary').textContent = ''; }
  async function inspect(raw) {
    clearInspection();
    inspected = await work('inspect', { raw }); $('restore-summary').textContent = (inspected.summary.name || 'SUCCESSOR Ω') + ' · ' + inspected.summary.kind + ' · ' + inspected.summary.candidates + t(' saved candidates. Historical local checks only; no authority or payments.', ' candidats enregistrés. Vérifications locales historiques; aucune autorité ni transaction.'); $('restore-preview').hidden = false; $('restore-preview').closest('details').open = true; $('restore-consent').checked = false; $('restore-preview').scrollIntoView({ block: 'center' });
  }
  function clearPlan() { plan = null; $('job-results').hidden = true; $('replace-console').hidden = true; $('handoff-consent').checked = false; $('replace-consent').checked = false; $('console-link').replaceChildren(); backupRaw = null; $('comparison').textContent = ''; }
  function attach() {
    if (location.protocol === 'file:') for (const link of document.querySelectorAll('#interface a[href]')) { const href = link.getAttribute('href'); if (href.startsWith('./') || href.startsWith('../')) link.href = new URL(href, 'https://montrealai.github.io/AGIJobManager/' + (lang === 'fr' ? 'fr/' : '') + 'successor/').href; }
    document.querySelectorAll('button:disabled,input:disabled').forEach(el => { el.disabled = false; }); $('stop').disabled = true;
    $('larger').setAttribute('aria-pressed', String(document.documentElement.classList.contains('large-text')));
    bind('larger', () => { const enabled = document.documentElement.classList.toggle('large-text'); $('larger').setAttribute('aria-pressed', String(enabled)); });
    bind('language', () => { fail(!currentWorker, 'BUSY'); const mission = formMission(), consent = $('public-consent').checked; lang = lang === 'en' ? 'fr' : 'en'; document.documentElement.lang = lang; $('interface').innerHTML = layouts[lang]; attach(); showMission(mission); $('public-consent').checked = consent; clearPlan(); redraw(); say(t('Interface language changed. Your own text is unchanged.', 'La langue de l’interface a changé. Votre texte reste inchangé.')); });
    for (const input of document.querySelectorAll('[name="kind"]')) input.addEventListener('change', () => { if (actionBusy || currentWorker) return; showMission(defaultMission(input.value, lang)); $('public-consent').checked = false; $('new-mission-wrap').hidden = !state; });
    bind('example', () => { showMission(defaultMission(document.querySelector('[name="kind"]:checked').value, lang)); $('public-consent').checked = true; $('new-mission-wrap').hidden = !state; });
    bind('add-section', () => addSection());
    bind('data-file', async () => { const file = $('data-file').files[0]; fail(file && file.size <= LIMITS.input, 'INPUT_SIZE'); $('data').value = await file.text(); $('rights').value = ''; $('public-consent').checked = false; }, 'change');
    bind('mission-form', async () => {
      fail($('public-consent').checked, 'PUBLIC_CONSENT'); $('public-consent').removeAttribute('aria-invalid');
      const kind = document.querySelector('[name=kind]:checked').value;
      const required = ['purpose', 'rights', ...(kind === 'website' ? ['site-title', 'site-intro', ...[...$('site-sections').querySelectorAll('input,textarea')].map(el => el.id)] : kind === 'custom' ? ['custom-input', 'custom-tools', 'custom-outputs', 'custom-success'] : ['data'])];
      for (const id of required) if (!$(id).value.trim()) throw Object.assign(new Error('FIELD_REQUIRED'), { code: 'FIELD_REQUIRED', field: id });
      const mission = formMission(); if (state && canonical(mission) !== canonical(state.mission)) fail($('new-mission').checked, 'NEW_MISSION');
      const next = !state || canonical(mission) !== canonical(state.mission) ? await createSystem(mission) : state;
      const run = ++runNumber; say(t('Running your bounded local mission…', 'Exécution de votre mission locale…'));
      if (mission.kind === 'custom') { state = next; candidate = null; } else { const variant = next.candidates.find(c => c.id === next.active)?.manifest.variant || 'baseline'; const result = await work('run', { state: next, variant, sourceIdentity: source.engineSha256 }); if (run !== runNumber) return; state = result.state; candidate = result.candidate; }
      clearPlan(); redraw(); $('new-mission').checked = false; $('new-mission-wrap').hidden = false; say(mission.kind === 'custom' ? t('Mission draft kept. Execution is unavailable; you can prepare a request.', 'Brouillon conservé. L’exécution est indisponible; vous pouvez préparer une demande.') : t('Your files are ready. Inspect the preview, then choose whether to keep this version.', 'Vos fichiers sont prêts. Examinez l’aperçu, puis choisissez de conserver cette version.')); $('results').scrollIntoView({ block: 'start' });
    }, 'submit');
    bind('stop', () => { runNumber++; rejectWork?.(); say(t('Stopped. Previous files are preserved.', 'Arrêté. Les fichiers précédents sont conservés.')); });
    bind('keep-version', async () => { fail(state && candidate, 'CANDIDATE_REQUIRED'); const active = state.candidates.find(c => c.id === state.active); state = await chooseCandidate(state, candidate.id, active && candidate.id !== active.id ? 'replace' : 'keep'); clearPlan(); redraw(); say(t('Version kept locally. No operating permission was granted.', 'Version conservée localement. Aucune autorisation opérationnelle n’a été accordée.')); });
    bind('improve-local', async () => { fail(state?.active, 'SELECT_VERSION'); const active = state.candidates.find(c => c.id === state.active), result = await work('run', { state, variant: 'improved', sourceIdentity: source.engineSha256 }); state = result.state; candidate = result.candidate; const comparison = compareCandidates(active, candidate); redraw(); $('comparison').textContent = comparison.outcome === 'improvement' ? t('A measured gap was resolved and the separate checks passed. Compare the new files, then explicitly keep this version.', 'Une limite mesurée est résolue et les vérifications distinctes réussissent. Comparez les nouveaux fichiers, puis choisissez explicitement cette version.') : t('Tie or regression: the incumbent stays selected. There is no automatic promotion.', 'Égalité ou régression : la version actuelle reste sélectionnée. Aucune promotion automatique.'); if (comparison.outcome !== 'improvement') $('keep-version').disabled = true; });
    bind('retain', () => { candidate = state.candidates.find(c => c.id === state.active); redraw(); say(t('Your current version is retained.', 'Votre version actuelle est conservée.')); });
    bind('rollback', async () => { const previous = previousSelection(); fail(previous, 'NO_PREVIOUS_VERSION'); state = await chooseCandidate(state, previous.subject, 'rollback'); candidate = state.candidates.find(c => c.id === state.active); clearPlan(); redraw(); say(t('Previous local version restored. External effects, if any, are not undone.', 'Version locale précédente restaurée. Les éventuels effets externes ne sont pas annulés.')); });
    bind('prepare-job', async () => { clearPlan(); fail(state, 'SELECT_VERSION'); fail($('budget').value.trim(), 'USDC_PRICE_REQUIRED'); plan = await work('plan', { state, options: { budget: $('budget').value, repairReserve: $('reserve').value, days: $('days').value, inputURLs: $('public-urls').value, requested: $('request-goal').value } }); state = await recordPlan(state, plan); $('chronicle').textContent = readableSummary(state); $('job-preview').textContent = JSON.stringify(plan, null, 2); $('job-results').hidden = false; $('handoff-consent').checked = false; $('economics').textContent = t('Hypothetical employer allowance: ', 'Budget employeur hypothétique : ') + formatUSDC(BigInt(plan.pricing.totalPlanBaseUnits), lang) + '. ' + t('At the default shared 8% review allocation: Agent ', 'Avec la part de revue partagée de 8 % : Agent ') + formatUSDC(BigInt(plan.successfulIllustration.agent), lang) + '; ' + t('all reviewers ', 'ensemble des évaluateurs ') + formatUSDC(BigInt(plan.successfulIllustration.sharedReviewers), lang) + '; wallet30 ' + formatUSDC(BigInt(plan.successfulIllustration.wallet30), lang) + '; wallet10 ' + formatUSDC(BigInt(plan.successfulIllustration.wallet10), lang) + '. ' + t('With zero validators, the buyer-acceptance Agent share is ', 'Avec zéro validateur, l’acceptation par l’acheteur donne à l’Agent ') + formatUSDC(BigInt(plan.successfulIllustration.zeroValidatorAgent), lang) + '.'; });
    bind('download-job', () => { fail(plan, 'PLAN'); download('successor-improvement-draft.json', JSON.stringify(plan, null, 2)); });
    bind('backup-console', () => { let raw; try { raw = localStorage.getItem(CONSOLE_DRAFT_KEY); } catch { fail(false, 'STORAGE'); } fail(raw, 'CONSOLE_CONFLICT'); download('existing-console-draft.json', raw); backupRaw = raw; });
    bind('handoff', () => { fail(plan && $('handoff-consent').checked, 'HANDOFF_CONSENT'); fail(/^https?:$/.test(location.protocol), 'OFFLINE_HANDOFF'); let existing; try { existing = localStorage.getItem(CONSOLE_DRAFT_KEY); } catch { fail(false, 'STORAGE'); } if (existing && !(backupRaw === existing && $('replace-consent').checked)) { $('replace-console').hidden = false; fail(false, 'CONSOLE_CONFLICT'); } try { localStorage.setItem(CONSOLE_DRAFT_KEY, JSON.stringify(plan.consoleDraft)); } catch { fail(false, 'STORAGE'); } const link = document.createElement('a'); link.href = '/AGIJobManager/agijobmanager-usdc.html'; link.textContent = t('Open the advanced console, then use “Load saved draft”', 'Ouvrir la console avancée, puis utiliser « Load saved draft »'); $('console-link').replaceChildren(link); say(t('Draft copied. Nothing was published or paid.', 'Brouillon copié. Rien n’a été publié ni payé.')); });
    bind('download-capsule', async () => download('My-SUCCESSOR-Omega.json', await exportCapsule(state, source)));
    bind('download-brief', () => download('My-SUCCESSOR-Omega.txt', readableSummary(state), 'text/plain'));
    bind('download-source', () => { fail(sources?.length, 'SOURCE_FILES'); download('SUCCESSOR-Omega-editable-source.zip', sourceZip(sources), 'application/zip'); });
    bind('download-html', async () => { const capsule = await exportCapsule(state, source); const html = pristine.replace(/(<script id="successor-capsule" type="application\/json">)[\s\S]*?(<\/script>)/, (_, start, end) => start + capsule.replace(/</g, '\\u003c') + end); download('My-SUCCESSOR-Omega.html', html, 'text/html'); });
    bind('save', async () => { const capsule = await exportCapsule(state, source); try { localStorage.setItem(STORAGE_KEY, capsule); } catch { fail(false, 'STORAGE'); } say(t('Saved only in this browser. Download a durable copy too.', 'Enregistré uniquement dans ce navigateur. Téléchargez aussi une copie durable.')); });
    bind('load', async () => { clearInspection(); let raw; try { raw = localStorage.getItem(STORAGE_KEY); } catch { fail(false, 'STORAGE'); } fail(raw, 'STORAGE'); await inspect(raw); });
    bind('clear', () => { try { localStorage.removeItem(STORAGE_KEY); } catch { fail(false, 'STORAGE'); } say(t('Saved browser copy cleared. Your open workspace and downloaded copies remain.', 'Copie enregistrée effacée. L’espace ouvert et les téléchargements sont conservés.')); });
    bind('print', () => window.print());
    bind('import-file', async () => { clearInspection(); const file = $('import-file').files[0]; fail(file && file.size <= LIMITS.capsule, 'INPUT_SIZE'); await inspect(await file.text()); }, 'change');
    bind('restore', async () => { fail(inspected && $('restore-consent').checked, 'RESTORE_CONFIRMATION'); state = await work('restore', { inspected, confirmed: true }); candidate = state.candidates.find(c => c.id === state.active) || state.candidates.at(-1) || null; showMission(state.mission); $('public-consent').checked = false; clearInspection(); clearPlan(); redraw(); say(t('Restored as historical local work. Review the inputs and rerun for fresh measurements.', 'Restauré comme travail local historique. Vérifiez les données et relancez pour obtenir de nouvelles mesures.')); });
    bind('cancel-restore', clearInspection);
  }
  attach(); showMission(defaultMission('analyst', lang)); redraw();
  const saved = $('successor-capsule').textContent.trim();
  if (saved !== 'null') inspect(saved).catch(report);
}
