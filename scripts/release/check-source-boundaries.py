#!/usr/bin/env python3
"""Finite offline source-policy dispatch; explicit selection and external pins only."""
import argparse
import hashlib
import json
import pathlib
import re
import runpy
import sys

PROFILES = ('legacy-v114', 'manager-explicit-governor-v1')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', required=True, choices=PROFILES)
    parser.add_argument('--mode', choices=('staged', 'bound'), default='bound')
    parser.add_argument('--source-root', required=True)
    parser.add_argument('--object-store', action='append')
    parser.add_argument('--verifier-sha256', required=True)
    parser.add_argument('--manifest')
    parser.add_argument('--manifest-sha256')
    parser.add_argument('--schema-sha256')
    parser.add_argument('--dependency-root')
    parser.add_argument('--review-binding')
    parser.add_argument('--review-binding-sha256')
    parser.add_argument('--source-commit')
    parser.add_argument('--source-tree')
    args = parser.parse_args(argv)
    # Selection conflicts fail before a verifier is loaded. No manifest may name
    # a module, executable, provider, fallback profile or dynamic command.
    if args.profile == 'manager-explicit-governor-v1':
        if (not all((args.manifest, args.manifest_sha256, args.schema_sha256))
                or args.source_commit or args.source_tree):
            parser.error('explicit profile requires manifest/schema pins and no legacy revision options')
    else:
        if (args.mode != 'bound' or not args.source_commit or not args.source_tree
                or any((args.manifest, args.manifest_sha256, args.schema_sha256,
                        args.review_binding, args.review_binding_sha256, args.dependency_root))):
            parser.error('legacy profile requires only its exact clean original commit/tree')
    for name in ('verifier_sha256', 'manifest_sha256', 'schema_sha256', 'review_binding_sha256'):
        value = getattr(args, name)
        if value is not None and not re.fullmatch('[0-9a-f]{64}', value):
            parser.error(name.replace('_', '-') + ' must be a complete lowercase SHA256')
    verifier = pathlib.Path(__file__).resolve().with_name('check-explicit-governor-boundaries.py')
    if verifier.is_symlink() or hashlib.sha256(verifier.read_bytes()).hexdigest() != args.verifier_sha256:
        parser.error('unreviewed verifier bytes')
    module = runpy.run_path(str(verifier))
    try:
        result = module['verify_explicit' if args.profile == 'manager-explicit-governor-v1' else 'verify_legacy'](args)
    except (ValueError, KeyError, TypeError, OSError) as exc:
        print('SOURCE BOUNDARIES FAILED: ' + str(exc), file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
