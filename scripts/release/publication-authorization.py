"""Authorize manual publication or the bounded v1.19.4 qualification completion."""
import json
import pathlib
from release_common import REPOSITORY, TAG, require, valid_sha

TRIGGER_PATH = '.github/workflows/current-state-release.yml'


def authorize(environment, source, api, event=None):
    require(valid_sha(source) and environment.get('GITHUB_REPOSITORY') == REPOSITORY and environment.get('GITHUB_REF') == 'refs/heads/main', 'Publication requires the exact main repository and source')
    require(environment.get('RELEASE_PUBLISH_CONFIRMATION') == 'PUBLISH_' + TAG, 'Current-version publication authorization is required')
    if environment.get('GITHUB_EVENT_NAME') == 'workflow_dispatch': return 'manual-confirmed-main'
    require(environment.get('GITHUB_EVENT_NAME') == 'workflow_run' and TAG == 'v1.19.4', 'Unsupported automatic publication trigger or version')
    if event is None:
        path = pathlib.Path(environment['GITHUB_EVENT_PATH'])
        require(path.is_file() and not path.is_symlink() and path.stat().st_size <= 2_000_000, 'Invalid publication event file')
        event = json.loads(path.read_text())
    trigger = event.get('workflow_run', {})
    run_id = trigger.get('id')
    require(type(run_id) is int and run_id > 0, 'Missing publication trigger run')
    require(type(trigger.get('workflow_id')) is int and trigger['workflow_id'] > 0 and type(trigger.get('run_attempt')) is int and trigger['run_attempt'] > 0, 'Missing publication workflow identity or attempt')
    observed = api(f'actions/runs/{run_id}')
    for run in (trigger, observed):
        require(run.get('id') == run_id and run.get('path') == TRIGGER_PATH and run.get('event') == 'push' and run.get('head_branch') == 'main' and run.get('head_sha') == source, 'Publication trigger source or workflow differs')
        require(run.get('status') == 'completed' and run.get('conclusion') == 'success', 'Publication trigger must have completed successfully')
        require(run.get('repository', {}).get('full_name') == REPOSITORY and run.get('head_repository', {}).get('full_name') == REPOSITORY, 'Publication trigger repository differs')
    require(observed.get('workflow_id') == trigger.get('workflow_id') and observed.get('run_attempt') == trigger.get('run_attempt'), 'Publication trigger identity/attempt differs')
    require(api('git/ref/heads/main')['object']['sha'] == source, 'Automatic publication source was superseded')
    return 'authorized-v1.19.4-exact-main-qualification-completion'
