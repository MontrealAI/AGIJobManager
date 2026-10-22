"""Capture the one reviewed Alpha browser artifact for a saved candidate producer."""
import argparse
import pathlib
import runpy

ROOT = pathlib.Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    options = parser.parse_args()
    output = options.output
    if not output.is_absolute() or output.exists() or output.parent.resolve() != output.parent:
        raise ValueError('An absent absolute browser capture output under a real parent is required')
    policy = runpy.run_path(str(ROOT / 'scripts/release/discovery-release-profile.py'))
    captured = policy['capture_browser_capsule'](ROOT)
    output.mkdir(mode=0o700)
    for name, (mode, raw) in captured.items():
        if not policy['safe_path'](name) or mode != '100644':
            raise ValueError('Browser capture path or mode differs')
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as stream:
            stream.write(raw)
        target.chmod(0o644)
    policy['validate_browser_capsule'](ROOT, output)
    print('Retained the reviewed original Alpha browser bytes for this saved candidate; no authority granted.')


if __name__ == '__main__':
    main()
