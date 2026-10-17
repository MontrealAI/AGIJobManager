'use strict';
// SOL-2026-7 interim candidate. Keep solc 0.8.37; remove ONLY the two affected passes.
// Upstream default: argotorg/solidity v0.8.37 libsolidity/interface/OptimiserSettings.h.
const DEFAULT_STEPS="dfDvulfnTUtnIfxa[r]EscLMVcul[j]Trpeulxa[r]cLvifMCTUca[r]LSsTFOtfDnca[r]IulcscCTUtvifMx[scCTUt]TOntnfDIulvifMjmul[jul]VcTOculjmul";
const CLEANUP_STEPS='fDnTOcmuO';
const OPTIMIZER_STEPS=DEFAULT_STEPS.replace(/[LE]/g,'')+':'+CLEANUP_STEPS;
module.exports={DEFAULT_STEPS,CLEANUP_STEPS,OPTIMIZER_STEPS,optimizer:{enabled:true,runs:40,details:{yulDetails:{optimizerSteps:OPTIMIZER_STEPS}}}};

