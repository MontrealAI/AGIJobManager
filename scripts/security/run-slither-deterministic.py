#!/usr/bin/env python3
"""Run pinned Slither with deterministic detector order and unchanged CLI output.

Usage: python3 scripts/security/run-slither-deterministic.py <Slither arguments>
Only detector execution order changes; upstream selection and all findings remain.
"""

import importlib
from importlib import metadata
import re
import sys

SLITHER_VERSION = "0.11.6"


def ordered_selection(selected, available):
    if not isinstance(selected, (list, tuple, set)):
        raise ValueError("Slither returned an unsupported detector selection")
    detectors = list(selected)
    names = set()
    identities = set()
    for detector in detectors:
        if not isinstance(detector, type) or detector not in available:
            raise ValueError("Slither selected an unrecognized detector class")
        name = getattr(detector, "ARGUMENT", None)
        impact = getattr(detector, "IMPACT", None)
        rank = getattr(impact, "value", impact)
        if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9-]+", name):
            raise ValueError("Slither selected a detector with an invalid argument")
        if type(rank) is not int or rank not in range(5):
            raise ValueError("Slither selected a detector with an invalid impact")
        if detector in identities or name in names:
            raise ValueError("Slither selected a duplicate detector")
        identities.add(detector)
        names.add(name)
    return sorted(detectors, key=lambda detector: (detector.IMPACT, detector.ARGUMENT))


def install(cli, version):
    if version != SLITHER_VERSION:
        raise ValueError(f"Deterministic detector ordering requires Slither {SLITHER_VERSION}; found {version}")
    original_choose = cli.choose_detectors

    def choose_detectors(args, all_detector_classes):
        selected = original_choose(args, all_detector_classes)
        return ordered_selection(selected, all_detector_classes)

    cli.choose_detectors = choose_detectors


def main():
    version = metadata.version("slither-analyzer")
    if version != SLITHER_VERSION:
        raise ValueError(f"Deterministic detector ordering requires Slither {SLITHER_VERSION}; found {version}")
    cli = importlib.import_module("slither.__main__")
    install(cli, version)
    return cli.main()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, metadata.PackageNotFoundError) as exc:
        sys.exit(str(exc))
