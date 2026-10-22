# Start here — v1.20.0 Discovery Lab candidate

Review the [release scope](RELEASE_NOTES.md) and [qualification boundary](VALIDATION.md). This local preparation is not a published or qualified release. The previously published v1.19.6 maintenance release remains the recovery checkpoint; preserve its exact source, assets and qualification.

The Discovery Lab USDC receiver inspects a typed synthetic campaign with the pinned Alpha inspector saved in the release and expected source/mission bindings. It retains a zero currency allowance, draft commission state and `authority:none`. Inspecting or importing the result does not provision execution or settlement. Use the [developer contract](../../successor/DISCOVERY_LAB.md); the existing browser Builder remains available separately.

Install the committed root, Hardhat and UI lockfiles with Node 22.23.2. Run the source and compiler closure, transport-policy and actual pinned native checks described in [validation](VALIDATION.md). The native receiver lane also runs on Node 24.21.0. A source/profile checksum is not qualification: exact-source hosted workflows, independently reviewed bindings, authenticated candidate assets, managed attestations and explicit publication authorization remain mandatory.

No wallet or public-chain write is needed for inspection. Existing deployed managers, jobs, payouts, recovery journals and authority remain unchanged by this software candidate. Use the [recovery guide](RECOVERY_GUIDE.md) if a source, receipt, qualification or runtime boundary fails.

The complete Manager archive includes `source/`, `discovery-alpha/` and `discovery-browser/`. These own the pinned Alpha catalog and sources, inspector and original license, plus the authenticated original browser inputs retained by the candidate producer. Authenticate the downloaded release assets, provenance, source profile and saved capsules before executing their code. Installed inspection then uses these saved bytes without another Alpha checkout; an external source checkout is needed only when building and authenticating a new candidate.

Keep the original exported workspace and typed USDC request unchanged. Select an accepted current-source `campaignDigest` from that mission's Evidence Docket (`06_proof_bundles/capability.json`, `campaigns[].campaignDigest`). From the extracted complete archive, run the pinned Node runtime with these absolute input paths and an absent absolute output directory:

```sh
node source/scripts/integrations/discovery-installed-operator.mjs \
  "$PWD/discovery-alpha" /absolute/workspace.json /absolute/original-request.json \
  CAMPAIGN_DIGEST "$PWD/RELEASE_MANIFEST.json" /absolute/new-inspection-output
```

The operation independently reconstructs the draft from the retained mission, inspects the original request, appends the raw receiver receipt to that mission and writes the updated workspace plus the verified 13-section docket and its byte-identical reopened export. It also preserves the original request, raw receipt and source wrapper. Duplicate receipt admission is refused. The final shipping Alpha pin and final-source hosted qualification remain pending; local fixture results do not authorize publication.

Qualification runs this original-mission operation and the nine construction, refusal and succession regressions in each pinned runtime. Those regressions retain a separate mission, docket and cost ledger: eight valid native observations and one raw invalid-payload observation. They are never imported into, or added to the costs of, the original browser mission.
