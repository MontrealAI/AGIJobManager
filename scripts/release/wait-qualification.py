"""Bounded read-only wait; final collector still validates every required job and artifact."""
import argparse
import json
import os
import pathlib
import subprocess
import time
from release_common import REPOSITORY, WORKFLOWS, DISCOVERY_PROFILE, qualification_workflows, require, valid_sha


def readiness(api, source, profile=None):
    require(valid_sha(source), 'A complete source commit is required')
    if api('git/ref/heads/main')['object']['sha'] != source: return 'superseded'
    pending = False
    workflows = qualification_workflows({'sourcePolicy': {'releaseProfile': profile}})
    for workflow in workflows:
        identity = api(f'actions/workflows/{workflow}')
        require(identity['path'] == '.github/workflows/' + workflow, 'Qualification workflow identity differs')
        runs = api(f'actions/workflows/{identity["id"]}/runs?head_sha={source}&event=push&per_page=100')['workflow_runs']
        matching = sorted((run for run in runs if run.get('head_sha') == source and run.get('head_branch') == 'main' and run.get('event') == 'push'), key=lambda run: run['id'], reverse=True)
        if not matching: pending = True; continue
        run = matching[0]
        require(run.get('workflow_id') == identity['id'] and run.get('repository', {}).get('full_name') == REPOSITORY and run.get('head_repository', {}).get('full_name') == REPOSITORY, 'Qualification run repository or workflow differs')
        if run.get('status') != 'completed': pending = True; continue
        require(run.get('conclusion') == 'success', 'A required exact-source workflow failed, was cancelled or was skipped')
    return 'pending' if pending else 'ready'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--profile', choices=[DISCOVERY_PROFILE])
    parser.add_argument('--timeout-seconds', type=int, default=2700)
    parser.add_argument('--poll-seconds', type=int, default=30)
    args = parser.parse_args()
    require(1 <= args.timeout_seconds <= 2700 and 5 <= args.poll_seconds <= 60, 'Qualification wait must remain bounded')
    require(os.environ.get('GITHUB_REPOSITORY') == REPOSITORY, 'Qualification wait repository differs')
    def api(endpoint):
        result = subprocess.run(['gh', 'api', f'repos/{REPOSITORY}/{endpoint}', '--method', 'GET'], capture_output=True, text=True, timeout=180)
        require(result.returncode == 0, 'Qualification metadata request failed (response withheld)')
        return json.loads(result.stdout)
    deadline = time.monotonic() + args.timeout_seconds
    while True:
        status = readiness(api, args.source, args.profile)
        if status != 'pending': break
        require(time.monotonic() + args.poll_seconds <= deadline, 'Exact-source qualification did not finish within the bounded wait')
        print('Waiting for all required exact-source workflows.', flush=True)
        time.sleep(args.poll_seconds)
    with pathlib.Path(os.environ['GITHUB_OUTPUT']).open('a') as output:
        output.write('ready=' + ('true' if status == 'ready' else 'false') + '\n')
    print('Qualification readiness: ' + status + '. Final job, step, source, artifact and attestation validation remain mandatory.')


if __name__ == '__main__': main()
