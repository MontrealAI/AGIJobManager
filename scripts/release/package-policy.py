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
DISCOVERY_PROFILE = 'discovery-lab-source-candidate-v1'
DISCOVERY_V2_PROFILE = 'discovery-lab-source-candidate-v2'
DISCOVERY_RELEASE_PROFILE = 'manager-discovery-release-v1'

def transformational():
    return runpy.run_path(str(BASE / 'transformational-profile.py'))

def maintenance():
    return runpy.run_path(str(BASE / 'maintenance-profile.py'))

def discovery():
    return runpy.run_path(str(BASE / 'discovery-lab-profile.py'))

def discovery_v2():
    return runpy.run_path(str(BASE / 'discovery-lab-profile-v2.py'))

def discovery_release():
    return runpy.run_path(str(BASE / 'discovery-release-profile.py'))

def correction():
    return runpy.run_path(str(BASE / 'correction-profile.py'))

def add_selection_arguments(parser):
    parser.add_argument('--profile', choices=(CANDIDATE['LEGACY'], CANDIDATE['PROFILE'], RELEASE['PROFILE'], CORRECTION_PROFILE, TRANSFORMATIONAL_PROFILE, MAINTENANCE_PROFILE, DISCOVERY_PROFILE, DISCOVERY_V2_PROFILE, DISCOVERY_RELEASE_PROFILE), default=CANDIDATE['LEGACY'])
    for name in ('manifest', 'manifest-sha256', 'verifier-sha256', 'schema-sha256'):
        parser.add_argument('--' + name)

def select(profile=CANDIDATE['LEGACY'], **kwargs):
    return (discovery_release() if profile == DISCOVERY_RELEASE_PROFILE else discovery_v2() if profile == DISCOVERY_V2_PROFILE else discovery() if profile == DISCOVERY_PROFILE else maintenance() if profile == MAINTENANCE_PROFILE else transformational() if profile == TRANSFORMATIONAL_PROFILE else correction() if profile == CORRECTION_PROFILE else RELEASE if profile == RELEASE['PROFILE'] else CANDIDATE)['select'](profile, **kwargs)

def policy(selection):
    return discovery_release() if selection is not None and selection.get('releaseProfile') == DISCOVERY_RELEASE_PROFILE else discovery_v2() if selection is not None and selection.get('profile') == DISCOVERY_V2_PROFILE else discovery() if selection is not None and selection.get('profile') == DISCOVERY_PROFILE else maintenance() if selection is not None and selection.get('releaseProfile') == MAINTENANCE_PROFILE else transformational() if selection is not None and selection.get('releaseProfile') == TRANSFORMATIONAL_PROFILE else correction() if selection is not None and selection.get('releaseProfile') == CORRECTION_PROFILE else RELEASE if selection is not None and selection.get('releaseProfile') == RELEASE['PROFILE'] else CANDIDATE

def metadata(selection):
    return policy(selection)['metadata'](selection)

def validate_metadata(manifest, selection):
    if policy(selection) is CANDIDATE:
        require('releaseProfile' not in manifest and 'releasePolicy' not in manifest, 'Release source package requires its explicit profile and pins')
    return policy(selection)['validate_metadata'](manifest, selection)

def validate_source(root, selection):
    return policy(selection)['validate_source'](root, selection)

def checkout(root, selection, object_store, dependency_root, source, tree, *, alpha_root=None):
    if selection is not None and selection.get('releaseProfile') == DISCOVERY_RELEASE_PROFILE:
        return policy(selection)['checkout'](root, selection, object_store, dependency_root, source, tree, alpha_root=alpha_root)
    if alpha_root is not None:
        require(False, 'Native source root is only admitted by the explicit Discovery release profile')
    return policy(selection)['checkout'](root, selection, object_store, dependency_root, source, tree)
