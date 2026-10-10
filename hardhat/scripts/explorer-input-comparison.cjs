'use strict';
// Compare Etherscan's recorded input with the exact reviewed compiler input.
// Some records group library addresses under the verified target's source.
// Reconcile only that representation against unambiguous compiler link identities.
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
    : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const addressRE = /^0x[0-9a-fA-F]{40}$/;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function validOutputSelection(value) {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([source, contracts]) => source && contracts && typeof contracts === 'object' &&
    !Array.isArray(contracts) && Object.values(contracts).every(outputs => Array.isArray(outputs) &&
      outputs.every(output => typeof output === 'string' && output.length > 0)));
}

function effectiveSettingsInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !input.settings || typeof input.settings !== 'object' || Array.isArray(input.settings) ||
      !validOutputSelection(input.settings.outputSelection)) return null;
  const value = structuredClone(input);
  delete value.settings.outputSelection;
  delete value.settings.libraries;
  return value;
}

function linkedMap(libraries) {
  const map = new Map();
  if (libraries === undefined) return map;
  if (!libraries || typeof libraries !== 'object' || Array.isArray(libraries)) return null;
  for (const [source, entries] of Object.entries(libraries)) {
    if (!source || !entries || typeof entries !== 'object' || Array.isArray(entries)) return null;
    for (const [name, address] of Object.entries(entries)) {
      if (!name || typeof address !== 'string' || !addressRE.test(address)) return null;
      const fqn = `${source}:${name}`;
      if (map.has(fqn)) return null;
      map.set(fqn, address.toLowerCase());
    }
  }
  return map;
}

function requiredLinkedReferences(artifact) {
  const inputs = [artifact?.linkReferences, artifact?.deployedLinkReferences];
  if (inputs.some(x => x === undefined)) return null;
  const required = new Set();
  for (const references of inputs) {
    if (references === undefined) continue;
    if (!references || typeof references !== 'object' || Array.isArray(references)) return false;
    for (const [source, names] of Object.entries(references)) {
      if (!source || !names || typeof names !== 'object' || Array.isArray(names)) return false;
      for (const [name, positions] of Object.entries(names)) {
        if (!name || !Array.isArray(positions) || !positions.length ||
            positions.some(p => !p || !Number.isSafeInteger(p.start) || p.start < 0 ||
              p.length !== 20 || !Number.isSafeInteger(p.start + p.length))) return false;
        required.add(`${source}:${name}`);
      }
    }
  }
  return required;
}

function byLibraryName(fqns) {
  const result = new Map();
  for (const fqn of fqns) {
    const name = fqn.slice(fqn.lastIndexOf(':') + 1);
    if (!result.has(name)) result.set(name, []);
    result.get(name).push(fqn);
  }
  return result;
}

function publishedInputMatchesBuild(published, expected, artifact) {
  const publishedCore = effectiveSettingsInput(published);
  const expectedCore = effectiveSettingsInput(expected);
  if (!publishedCore || !expectedCore || !same(publishedCore, expectedCore)) return false;

  const actual = linkedMap(published.settings.libraries);
  const configured = linkedMap(expected.settings.libraries);
  if (!actual || !configured) return false;
  const requiredFromArtifact = requiredLinkedReferences(artifact);
  if (requiredFromArtifact === false) return false;
  const required = requiredFromArtifact === null ? new Set(configured.keys()) : requiredFromArtifact;
  if (actual.size !== required.size) return false;

  const targetSource = artifact?.inputSourceName || artifact?.sourceName;
  const groupingAllowed = requiredFromArtifact !== null && typeof targetSource === 'string' &&
    expected.sources && typeof expected.sources === 'object' && !Array.isArray(expected.sources) &&
    own(expected.sources, targetSource);
  const requiredNames = byLibraryName(required);
  const configuredNames = byLibraryName(configured.keys());
  const resolved = new Set();

  for (const [publishedFqn, address] of actual) {
    let requiredFqn = publishedFqn;
    if (!required.has(requiredFqn)) {
      const separator = publishedFqn.lastIndexOf(':');
      const source = publishedFqn.slice(0, separator), name = publishedFqn.slice(separator + 1);
      if (!groupingAllowed || source !== targetSource) return false;
      const requirements = requiredNames.get(name), configurations = configuredNames.get(name);
      if (requirements?.length !== 1 || configurations?.length !== 1 || requirements[0] !== configurations[0]) return false;
      requiredFqn = requirements[0];
    }
    if (resolved.has(requiredFqn) || !configured.has(requiredFqn) || configured.get(requiredFqn) !== address) return false;
    resolved.add(requiredFqn);
  }
  return resolved.size === required.size;
}

module.exports = { publishedInputMatchesBuild };
