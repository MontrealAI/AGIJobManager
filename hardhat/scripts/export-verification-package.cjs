'use strict';
// Pure offline export. There is deliberately no RPC, HTTP, explorer submission,
// credential, signer, or wallet interface in this module.
const fs = require('node:fs');
const path = require('node:path');
const E = require('ethers');
const operatorPaths = require('./operator-paths.cjs');
const { requireQualifiedBuild, CORE_NAMES, CONSTRUCTOR_SCHEMAS, sha256, stable } = require('./qualified-build-catalog.cjs');

const EXPORT_SCHEMA = 'manager-offline-verification-package-v1';
const WARNING = 'PREDICTED ADDRESSES ONLY. No deployment, canonical receipt, explorer acceptance, governor setup, or activation is established by this package.';
function neededLibraries(operation, record, operations) {
  const selected = {};
  for (const [source, refs] of Object.entries(record.artifact.linkReferences || {})) {
    for (const name of Object.keys(refs)) {
      const qualified = `${source}:${name}`;
      const matching = Object.entries(operation.libraries).filter(([key]) => key === qualified || key === `${source.replace(/^project\//, '')}:${name}`);
      if (matching.length !== 1 || !E.isAddress(matching[0][1])) throw Error(`Missing or ambiguous exact linked library ${qualified}.`);
      const address = E.getAddress(matching[0][1]);
      const dependency = operations.find(candidate => candidate.name === name);
      if (!dependency || dependency.id >= operation.id || dependency.predictedAddress !== address) throw Error(`Library ${qualified} is not a preceding CREATE in the new graph.`);
      selected[qualified] = address;
    }
  }
  return selected;
}
function exportVerificationPackage({ build, plan, observedRevision, outputDirectory, receipts = [] }) {
  if (typeof outputDirectory === 'string') operatorPaths.requireExternalPath(outputDirectory, { label: 'Verification export' });
  requireQualifiedBuild(build);
  if (!Array.isArray(receipts) || receipts.length) throw Error('Offline export cannot authenticate receipt-proven addresses; nonempty receipt inputs are unsupported. Use the separate session verifier.');
  if (typeof outputDirectory !== 'string' || !outputDirectory || outputDirectory.includes('\0')) throw Error('A fresh output directory is required.');
  if (build.records.AGIJobManager.constructorSchema !== CONSTRUCTOR_SCHEMAS.explicit) throw Error('New core export requires the seven-argument explicit-governor build; historical six-argument builds remain separately pinned and cannot be relabeled.');
  // Import only this pure validator, never runtime.cjs / getRuntime(). Rebuilding
  // the graph verifies the full source identity and every unsigned envelope.
  require('./core-creation-plan.cjs').checkPlan(plan, build, observedRevision);
  if (plan.operations.length !== 9 || plan.operations.some((operation, index) => operation.id !== index || operation.name !== CORE_NAMES[index])) throw Error('Exactly nine ordered core CREATEs are required.');
  const files = [];
  function add(filename, value) {
    const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
    files.push({ filename, content, sha256: sha256(content) });
    return { filename, sha256: sha256(content) };
  }
  const originalInput = add('compiler-input.original.json', build.input);
  const contracts = plan.operations.map(operation => {
    const record = build.records[operation.name], artifact = record.artifact;
    if (operation.qualifiedName !== record.fqn) throw Error('Operation artifact identity differs from pinned build.');
    const links = neededLibraries(operation, record, plan.operations);
    const standardJson = structuredClone(build.input);
    const originalLinks = standardJson.settings.libraries || {};
    // Prelinked inputs need a separate reviewed model; never overwrite a compiler
    // input's existing linked addresses with the newly predicted graph.
    if (Object.values(originalLinks).some(value => Object.keys(value).length)) throw Error('Prelinked compiler inputs are not supported for a fresh CREATE graph.');
    standardJson.settings.libraries = {};
    for (const [qualified, address] of Object.entries(links)) {
      const separator = qualified.lastIndexOf(':'), source = qualified.slice(0, separator), name = qualified.slice(separator + 1);
      standardJson.settings.libraries[source] ||= {};
      standardJson.settings.libraries[source][name] = address;
    }
    const encoded = new E.Interface(artifact.abi).encodeDeploy(operation.constructorArguments);
    if (!operation.envelope.data.toLowerCase().endsWith(encoded.slice(2).toLowerCase())) throw Error('Envelope constructor bytes differ.');
    const prefix = `${String(operation.id).padStart(2, '0')}-${operation.name}`;
    const inputFile = add(`${prefix}.standard-json.json`, standardJson);
    const abiFile = add(`${prefix}.abi.json`, artifact.abi);
    const constructorFile = add(`${prefix}.constructor-arguments.txt`, `${encoded.slice(2)}\n`);
    const creationLength = (artifact.bytecode.length - 2) / 2;
    const linkedCreation = operation.envelope.data.slice(0, 2 + creationLength * 2);
    return { id: operation.id, name: operation.name, qualifiedName: record.compilerQualifiedName, artifactQualifiedName: record.fqn,
      predictedAddress: operation.predictedAddress, addressStatus: 'predicted-not-deployed', receiptProvenAddress: null, receiptBinding: null,
      compilerVersion: `v${build.compiler.longVersion}`, compilerInput: inputFile, abi: abiFile,
      constructor: { schema: record.constructorSchema, arguments: operation.constructorArguments, encoded, etherscanHexWithoutPrefix: encoded.slice(2), file: constructorFile },
      libraries: links, artifactSha256: record.artifactSha256, abiSha256: record.abiSha256,
      bytecode: { templateSha256: record.bytecodeSha256, linkedCreationKeccak256: E.keccak256(linkedCreation), initcodeKeccak256: E.keccak256(operation.envelope.data),
        runtimeTemplateSha256: record.deployedBytecodeSha256, deployedRuntimeKeccak256: null, runtimeStatus: 'uninstantiated-template', immutableReferences: record.immutableReferences },
      linkReferencesSha256: record.linkReferencesSha256 };
  });
  const manifest = { schema: EXPORT_SCHEMA, warning: WARNING, receiptProven: false, explorerAcceptanceObserved: false, activationAuthorized: false,
    scope: 'Only the selected new nine-CREATE graph. No historical target, optional helper/router, governor call, or activation.',
    build: { id: build.id, source: build.source, buildDigest: build.buildDigest, catalogSha256: build.catalogSha256,
      archivedInputSha256: build.inputSha256, archivedOutputSha256: build.outputSha256, compiler: build.compiler,
      originalStandardJson: originalInput, sourceChecksums: build.sourceChecksums },
    plan: { schema: plan.schema, payloadSha256: plan.payloadSha256, source: plan.source, creator: plan.creator, startNonce: plan.startNonce, chainId: plan.chainId, governor: plan.governor },
    contracts };
  add('README.txt', `${WARNING}\n\nThis is an OFFLINE review/export package, not a submission tool.\nEach *.standard-json.json preserves the pinned compiler input with the exact\nrequired library addresses for that predicted new contract. The original input\nis included separately; archive and exported-file hashes are labeled separately.\nConstructor hex files omit 0x, as expected by Etherscan. All addresses must be\nindependently matched to canonical mined creation receipts and exact runtime\nbefore an authorized operator uses them for explorer verification. No receipt\nor explorer acceptance is inferred here. Existing directories are never reused.\n\nSource/compiler hashes bind bytes, not independent review approval. Actual\nreview, signer/provider qualification and comprehensive closeout remain gates.\n`);
  add('manifest.json', manifest);
  add('SHA256SUMS', `${files.map(file => `${file.sha256}  ${file.filename}`).join('\n')}\n`);
  build.assertUnchanged();
  const directory = path.resolve(outputDirectory);
  // mkdir (without recursive) fails if the destination exists, including a symlink.
  fs.mkdirSync(directory, { mode: 0o700 });
  const marker = path.join(directory, 'INCOMPLETE');
  fs.writeFileSync(marker, 'Incomplete until all files and pinned sources have been checked.\n', { flag: 'wx', mode: 0o600 });
  for (const file of files) {
    const descriptor = fs.openSync(path.join(directory, file.filename), 'wx', 0o600);
    try { fs.writeFileSync(descriptor, file.content); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  }
  build.assertUnchanged();
  // The marker is only removed after source and output rechecks. A failed export
  // is retained as incomplete, never reused or silently overwritten.
  for (const file of files) if (sha256(fs.readFileSync(path.join(directory, file.filename))) !== file.sha256) throw Error('Export file changed during creation.');
  fs.unlinkSync(marker);
  const directoryHandle = fs.openSync(directory, 'r');
  try { fs.fsyncSync(directoryHandle); } finally { fs.closeSync(directoryHandle); }
  return { outputDirectory: directory, manifest, manifestSha256: sha256(fs.readFileSync(path.join(directory, 'manifest.json'))) };
}

function main(argv = process.argv.slice(2)) {
  const allowed = ['catalog', 'catalog-sha256', 'build-id', 'plan', 'output', 'source-root'], args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]?.replace(/^--/, '');
    if (!argv[index]?.startsWith('--') || !allowed.includes(flag) || Object.hasOwn(args, flag) || !argv[index + 1] || argv[index + 1].startsWith('--')) throw Error('Use only --catalog --catalog-sha256 --build-id --plan --output --source-root, each with a value.');
    args[flag] = argv[index + 1];
  }
  if (allowed.some(flag => !args[flag])) throw Error('All six explicit offline export arguments are required.');
  operatorPaths.requireExternalPath(args.output, { label: 'Verification export' });
  operatorPaths.requireExternalPath(args.output, { sourceRoot: path.resolve(args['source-root']), label: 'Verification export' });
  const { observedRevision } = require('./core-creation-plan.cjs');
  const revision = observedRevision(path.resolve(args['source-root']));
  const { loadQualifiedBuild } = require('./qualified-build-catalog.cjs');
  const build = loadQualifiedBuild({ catalogPath: args.catalog, catalogSha256: args['catalog-sha256'], buildId: args['build-id'], expectedRevision: revision });
  const planStat = fs.statSync(args.plan);
  if (!planStat.isFile() || planStat.size > 4 * 1024 * 1024) throw Error('Plan must be a bounded regular file.');
  const planBytes = fs.readFileSync(args.plan);
  if (planBytes.length > 4 * 1024 * 1024) throw Error('Plan exceeds offline size limit.');
  const plan = JSON.parse(planBytes.toString('utf8'));
  const result = exportVerificationPackage({ build, plan, observedRevision: revision, outputDirectory: args.output });
  process.stdout.write(`${stable({ outputDirectory: result.outputDirectory, manifestSha256: result.manifestSha256, warning: WARNING })}\n`);
}
if (require.main === module) { try { main(); } catch { process.stderr.write('MANAGER_VERIFICATION_EXPORT_FAILED: Stop and preserve private inputs and any incomplete export. No explorer acceptance or activation was established.\n'); process.exitCode = 1; } }
module.exports = { EXPORT_SCHEMA, WARNING, exportVerificationPackage, exportPackage: exportVerificationPackage, neededLibraries, main };
