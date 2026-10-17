#!/usr/bin/env python3
"""Run the pinned Slither detector selection in a reproducible order."""

from importlib.metadata import version


def require_version():
    if version("slither-analyzer") != "0.11.6":
        raise SystemExit("Deterministic review requires unmodified Slither 0.11.6")


def ordered_detectors(selected):
    # Slither's explicit detector selection is an unordered set. Reentrancy
    # detectors share a cache, so balance analysis must precede its consumers.
    # Retain every selected detector and use a stable severity/name order.
    return sorted(selected, key=lambda detector: (detector.IMPACT, detector.ARGUMENT))


def install_order(cli):
    select = cli.choose_detectors

    def choose(args, all_detector_classes):
        return ordered_detectors(select(args, all_detector_classes))

    cli.choose_detectors = choose


def main():
    require_version()
    import slither.__main__ as cli

    install_order(cli)
    cli.main()


if __name__ == "__main__":
    main()
