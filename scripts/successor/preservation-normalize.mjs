// Only the documented software-label and embedded-document changes are allowed.
// All executable console bytes, ABI data, policies and other embedded sources stay bound.
export function normalizeConsole(source) {
  const label = s => s.replaceAll('v1.17.2', 'vRELEASE').replaceAll('"version":"1.17.2"', '"version":"RELEASE"').replaceAll('v1.17.1', 'vRELEASE').replaceAll('v1.17.0', 'vRELEASE').replaceAll('"version":"1.17.1"', '"version":"RELEASE"').replaceAll('"version":"1.17.0"', '"version":"RELEASE"').replaceAll('v1.15.0', 'vRELEASE').replaceAll('v1.16.0', 'vRELEASE').replaceAll('v1.16.1', 'vRELEASE').replaceAll('"version":"1.15.0"', '"version":"RELEASE"').replaceAll('"version":"1.16.0"', '"version":"RELEASE"').replaceAll('"version":"1.16.1"', '"version":"RELEASE"');
  return label(source).replace(/(window\.__AGI_RUNTIME_BUNDLE__=)(\{.*?\})(;window\.__AGI_CONTRACT_ABI_REGISTRY__)/, (_, prefix, raw, suffix) => {
    const manifest = JSON.parse(raw);
    manifest.sourcesSha256 = 'DERIVED_FROM_VERIFIED_SOURCES';
    manifest.sources['README.md'] = 'ADDITIVE_BUILDER_DOCUMENTATION';
    // Exact reviewed documentation correction: the ENS library requires new bytecode.
    manifest.sources['docs/ui/DEPLOYMENT_MAINNET.md'] = manifest.sources['docs/ui/DEPLOYMENT_MAINNET.md'].replace(
      'vRELEASE retains the manager ABI and eight fixed library links; the ENS membership correction introduced in vRELEASE changes linked ENS library bytecode and requires a new deployment to take effect;',
      'vRELEASE retains the v0.9.6 ABI and deployed runtime bytecode, including eight fixed linked libraries;'
    );
    const registry = JSON.parse(manifest.sources['config/usdc-deployment.json']);
    if (!['1.15.0', '1.16.0', '1.16.1', '1.17.0', '1.17.1', '1.17.2'].includes(registry.version)) throw Error('Unreviewed software version');
    registry.version = 'RELEASE';
    manifest.sources['config/usdc-deployment.json'] = JSON.stringify(registry);
    manifest.sources['src/generated/deployments.ts'] = manifest.sources['src/generated/deployments.ts'].replace(/"version": "1\.(?:15\.0|16\.[01]|17\.[012])"/, '"version": "RELEASE"');
    return prefix + JSON.stringify(manifest) + suffix;
  });
}
