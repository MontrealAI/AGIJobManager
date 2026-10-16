#!/usr/bin/env python3
"""Verify retained c2 compatibility provenance offline; never execute a fork.

The execution claim is the externally retained GitHub run/job/artifact evidence.
This command checks its exact reviewed receipt and the identical immutable report
against an independently bound c2 checkout. It does not turn that compatibility
fixture into native signing, independent-governor, or operational acceptance.
"""
import argparse
import hashlib
import json
import pathlib
import runpy
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PROFILE = 'manager-explicit-governor-v1'
RECEIPT = 'config/c2-fork-provenance.json'
RECEIPT_SHA256 = '309cfe866cb55a476cac7cb40143203c51c0b40f4bbe2f3b1485adc3455a2d0a'
SELECTOR_SHA256 = '16e1635469419480e5993bc36afac33d0f0b7e9e036ec67d2eae36bb13335ac3'
REPORT = 'docs/qualification/history/mainnet-cutover-3c974ad3-compatibility.json'
REPORT_SHA256 = '34d8d737fd540f83317551bdf3e190c0c8d72d7e7aaef60303d0234f4bbfb0b1'
COMMIT = 'c2f72180d2f0d6ecd5b92d8e5197c5344be2c699'
TREE = '8b0d8816ce3cdaa1103d37eaa34f4d40bf72972f'
PARENTS = ['3c974ad3cb1d828e5c89464fd8424d8ae853d9dd',
           'eb6f725e0b40ac81e50a374304e54a5ff6859fcf']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def validate_record(receipt, report, source_root, helpers):
    """Semantic checks supplement, rather than replace, the immutable receipt pin."""
    require(receipt['schema'] == 'agijobmanager/executed-c2-compatibility-provenance/v1'
            and receipt['status'] == 'RETAINED_EXECUTION_PROVENANCE_ONLY', 'Receipt scope differs')
    require(receipt['sourceCommit'] == COMMIT and receipt['sourceTree'] == TREE
            and receipt['parents'] == PARENTS, 'Receipt source differs')
    require(receipt['workflowRun'] == 38938835872 and receipt['workflowJob'] == 117101084362
            and receipt['artifactId'] == 12062186789, 'Execution identity differs')
    require(receipt['workflowConclusion'] == 'failure' and receipt['failedStage'] ==
            'comparison against preserved old next-deployment report', 'Overall workflow outcome differs')
    require(receipt['executedCases'] == {'actualUsdcFork': 11, 'cutoverCompatibility': 23},
            'Executed case scope differs')
    require(receipt['immutableIdenticalHistoricalReport'] == REPORT and
            receipt['reportSha256'] == REPORT_SHA256 and sha(report) == REPORT_SHA256,
            'Immutable compatibility report differs')
    for field in ('productionActivationApproved', 'independentGovernorOrNativeSignerAcceptanceEstablished',
                  'nativeCLIQualified', 'acceptanceComplete'):
        require(receipt[field] is False, 'Operational claim elevation: ' + field)
    require(receipt['publicTransactionsBroadcast'] == 0 and
            receipt['fixtureWallets'] is True and
            receipt['newSourceRunDoesNotRewriteOldReport'] is True and
            receipt['identicalReportDoesNotRelabelHistoricalRun'] is True,
            'Fixture/history scope differs')
    parsed = helpers['strict_json'](report)
    sources = parsed['sourceSha256']
    require(isinstance(sources, dict) and len(sources) == 76 and
            receipt['reportSourceEntries'] == 76 and receipt['sourceSha256'] == sources,
            'Exact 76-source inventory differs')
    for name, digest in sources.items():
        require(sha(helpers['source_file'](source_root, name)) == digest,
                'Observed compatibility source differs: ' + name)
    return {'schema': 'agijobmanager/retained-compatibility-check/v1',
            'status': 'RETAINED_C2_COMPATIBILITY_PROVENANCE_VERIFIED',
            'sourceCommit': COMMIT, 'sourceTree': TREE, 'sourceEntriesVerified': len(sources),
            'receiptSha256': RECEIPT_SHA256, 'reportSha256': REPORT_SHA256,
            'workflowRun': 38938835872, 'workflowConclusion': 'failure',
            'newForkExecutedByThisCommand': False, 'acceptanceComplete': False,
            'nativeCLIQualified': False, 'activationAuthorized': False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument('--profile', required=True, choices=(PROFILE,))
    parser.add_argument('--source-root', required=True)
    args = parser.parse_args(argv)
    try:
        selector = ROOT / 'scripts/qualification/select-source-profile.py'
        require(sha(selector.read_bytes()) == SELECTOR_SHA256, 'Reviewed selector bytes differ')
        h = runpy.run_path(str(selector))
        source = h['exact_path'](args.source_root, directory=True)
        receipt_path = h['exact_path'](str(ROOT / RECEIPT))
        data = receipt_path.read_bytes()
        require(sha(data) == RECEIPT_SHA256, 'Reviewed receipt bytes differ')
        selection = h['parse_args'](['--profile', PROFILE, '--mode', 'bound',
            '--source-root', str(source), '--target-manifest', str(ROOT / 'config/reviewed-c2-target.json'),
            '--target-manifest-sha256', h['REVIEWED_TARGET_MANIFEST_SHA256'],
            '--review-binding', str(ROOT / 'config/c2-source-review-binding.json'),
            '--review-binding-sha256', 'dd3c4500be119cd8802d24486ad4ea3073fb1fe7e7e1977bcd6762a6ab76fa2a'])
        require(h['run'](selection) == 0, 'Actual c2 source binding failed')
        result = validate_record(h['strict_json'](data), h['source_file'](source, REPORT), source, h)
        require(receipt_path.read_bytes() == data and sha(selector.read_bytes()) == SELECTOR_SHA256,
                'Provenance inputs changed during validation')
        require(h['run'](selection) == 0, 'Final actual c2 source binding failed')
        print(json.dumps(result, indent=2))
        return 0
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print('RETAINED PROVENANCE CHECK FAILED: ' + str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
