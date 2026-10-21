"""Explicit dispatch. The historical candidate policy remains nonpublishing."""
import pathlib
import runpy
from release_common import require
BASE = pathlib.Path(__file__).parent
CANDIDATE = runpy.run_path(str(BASE / 'candidate-profile.py'))
RELEASE = runpy.run_path(str(BASE / 'release-profile.py'))
CORRECTION_PROFILE = 'manager-boundary-corrections-v1'
TRANSFORMATIONAL_PROFILE = 'manager-transformational-v1'
MAINTENANCE_PROFILE = 'manager-dependency-maintenance-v1'

def transformational():
    return runpy.run_path(str(BASE / 'transformational-profile.py'))

def maintenance():
    return runpy.run_path(str(BASE / 'maintenance-profile.py'))

def correction():
    return runpy.run_path(str(BASE / 'correction-profile.py'))

def add_selection_arguments(parser):
    parser.add_argument('--profile', choices=(CANDIDATE['LEGACY'], CANDIDATE['PROFILE'], RELEASE['PROFILE'], CORRECTION_PROFILE, TRANSFORMATIONAL_PROFILE, MAINTENANCE_PROFILE), default=CANDIDATE['LEGACY'])
    for name in ('manifest', 'manifest-sha256', 'verifier-sha256', 'schema-sha256'):
        parser.add_argument('--' + name)

def select(profile=CANDIDATE['LEGACY'], **kwargs):
    return (maintenance() if profile == MAINTENANCE_PROFILE else transformational() if profile == TRANSFORMATIONAL_PROFILE else correction() if profile == CORRECTION_PROFILE else RELEASE if profile == RELEASE['PROFILE'] else CANDIDATE)['select'](profile, **kwargs)

def policy(selection):
    return maintenance() if selection is not None and selection.get('releaseProfile') == MAINTENANCE_PROFILE else transformational() if selection is not None and selection.get('releaseProfile') == TRANSFORMATIONAL_PROFILE else correction() if selection is not None and selection.get('releaseProfile') == CORRECTION_PROFILE else RELEASE if selection is not None and selection.get('releaseProfile') == RELEASE['PROFILE'] else CANDIDATE

def metadata(selection):
    return policy(selection)['metadata'](selection)

def validate_metadata(manifest, selection):
    if policy(selection) is CANDIDATE:
        require('releaseProfile' not in manifest and 'releasePolicy' not in manifest, 'Release source package requires its explicit profile and pins')
    return policy(selection)['validate_metadata'](manifest, selection)

def validate_source(root, selection):
    return policy(selection)['validate_source'](root, selection)

def checkout(root, selection, object_store, dependency_root, source, tree):
    return policy(selection)['checkout'](root, selection, object_store, dependency_root, source, tree)
