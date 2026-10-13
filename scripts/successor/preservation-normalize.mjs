// Only the documented software-label and embedded-document changes are allowed.
// All executable console bytes, ABI data, policies and other embedded sources stay bound.
export function normalizeConsole(source) {
  const label = s => s.replaceAll('v1.15.0', 'vRELEASE').replaceAll('v1.16.0', 'vRELEASE').replaceAll('v1.16.1', 'vRELEASE').replaceAll('"version":"1.15.0"', '"version":"RELEASE"').replaceAll('"version":"1.16.0"', '"version":"RELEASE"').replaceAll('"version":"1.16.1"', '"version":"RELEASE"');
  return label(source).replace(/(window\.__AGI_RUNTIME_BUNDLE__=)(\{.*?\})(;window\.__AGI_CONTRACT_ABI_REGISTRY__)/, (_, prefix, raw, suffix) => {
    const manifest = JSON.parse(raw);
    manifest.sourcesSha256 = 'DERIVED_FROM_VERIFIED_SOURCES';
    manifest.sources['README.md'] = 'ADDITIVE_BUILDER_DOCUMENTATION';
    const registry = JSON.parse(manifest.sources['config/usdc-deployment.json']);
    if (!['1.15.0', '1.16.0', '1.16.1'].includes(registry.version)) throw Error('Unreviewed software version');
    registry.version = 'RELEASE';
    manifest.sources['config/usdc-deployment.json'] = JSON.stringify(registry);
    manifest.sources['src/generated/deployments.ts'] = manifest.sources['src/generated/deployments.ts'].replace(/"version": "1\.(?:15\.0|16\.[01])"/, '"version": "RELEASE"');
    return prefix + JSON.stringify(manifest) + suffix;
  });
}
