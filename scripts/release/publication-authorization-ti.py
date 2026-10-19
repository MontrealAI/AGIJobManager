"""Authorize publication only after explicit confirmation on exact main source."""
from release_common import REPOSITORY, TAG, require, valid_sha

TRIGGER_PATH = '.github/workflows/current-state-release.yml'


def authorize(environment, source, api, event=None):
    require(valid_sha(source) and environment.get('GITHUB_REPOSITORY') == REPOSITORY and environment.get('GITHUB_REF') == 'refs/heads/main', 'Publication requires the exact main repository and source')
    require(environment.get('RELEASE_PUBLISH_CONFIRMATION') == 'PUBLISH_' + TAG, 'Current-version publication authorization is required')
    require(environment.get('GITHUB_EVENT_NAME') == 'workflow_dispatch', 'Publication requires explicit workflow_dispatch confirmation')
    return 'manual-confirmed-main'
