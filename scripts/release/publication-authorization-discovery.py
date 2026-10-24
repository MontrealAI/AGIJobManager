"""Authorize only explicit current-version Discovery publisher dispatch on main."""
from release_common import REPOSITORY, TAG, require, valid_sha
TRIGGER_PATH = '.github/workflows/publish-discovery-v1.yml'


def authorize(environment, source, api, event=None):
    require(TAG == 'v1.20.1' and valid_sha(source), 'Discovery publication version/source differs')
    require(environment.get('GITHUB_REPOSITORY') == REPOSITORY
            and environment.get('GITHUB_REF') == 'refs/heads/main'
            and environment.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
            and environment.get('RELEASE_PUBLISH_CONFIRMATION') == 'PUBLISH_' + TAG,
            'Discovery publication requires explicit confirmation on exact main')
    require(environment.get('GITHUB_WORKFLOW_REF') == REPOSITORY + '/' + TRIGGER_PATH + '@refs/heads/main'
            and environment.get('GITHUB_SHA') == source, 'Discovery publisher workflow/checkout identity differs')
    require(api('git/ref/heads/main')['object']['sha'] == source, 'Discovery source was superseded')
    return 'manual-confirmed-discovery-main'
