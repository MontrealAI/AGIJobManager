"""Additional exact-source native transformation gates; imports perform no I/O.

Live validation retains every inherited release gate.  Offline record checking
binds metadata only and does not claim that a workflow has run successfully.
"""
import copy
import pathlib
import re

from release_common import require, run_jobs, strict_json, valid_sha, validate_qualification

SOURCE_CONFIG = pathlib.Path(__file__).resolve().parents[2] / 'config/transformational-alpha-source.json'
SOURCE_SCHEMA = 'agijobmanager/transformational-alpha-source/v1'
RECORD_SCHEMA = 'agijobmanager/transformation-qualification/v1'
ALPHA_REPOSITORY = 'MontrealAI/AGI-Alpha-Agent-v0'
FIXTURE_PATH = 'examples/transformational-intelligence/campaign.json'
BOUNDARY = 'free-inspection-positive-payment-refused'
SOURCE_FILES = {
    'docs/assets/successor/engine.mjs', FIXTURE_PATH,
    'examples/transformational-intelligence/inspector.mjs',
}
NATIVE_STEPS = {
    'alpha-project-handoff.yml': ('receiver-validation', 'Validate native transformation campaign boundary'),
    'current-state-release.yml': ('qualify', 'Native transformation profile and inherited release tests'),
}


def source_metadata():
    """Read the installed finite-profile input; imports never read source files."""
    require(SOURCE_CONFIG.is_file() and not SOURCE_CONFIG.is_symlink()
            and SOURCE_CONFIG.stat().st_size <= 100_000, 'Native transformation source config is not a bounded regular file')
    source = strict_json(SOURCE_CONFIG.read_bytes())
    require(isinstance(source, dict) and set(source) == {
        'schema', 'repository', 'commit', 'tree', 'fixturePath', 'files',
    }, 'Native transformation source config fields differ')
    require(source['schema'] == SOURCE_SCHEMA and source['repository'] == ALPHA_REPOSITORY
            and valid_sha(source['commit']) and valid_sha(source['tree'])
            and source['fixturePath'] == FIXTURE_PATH, 'Native transformation source identity differs')
    files = source['files']
    require(isinstance(files, dict) and set(files) == SOURCE_FILES
            and all(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value)
                    for value in files.values()), 'Native transformation source file pins differ')
    return {
        'schema': RECORD_SCHEMA,
        'alphaRepository': source['repository'],
        'alphaCommit': source['commit'],
        'alphaTree': source['tree'],
        'fixturePath': source['fixturePath'],
        'fixtureSha256': files[FIXTURE_PATH],
        'boundary': BOUNDARY,
    }


def validate(config, api, logs):
    """Recheck inherited gates, then require native gates in those exact jobs.

    Cache detached API/log observations so the additional checks use the same
    snapshot that passed the inherited validator, including paginated jobs.
    """
    expected = source_metadata()
    responses, retained_logs = {}, {}

    def observed_api(endpoint):
        if endpoint not in responses:
            responses[endpoint] = copy.deepcopy(api(endpoint))
        return copy.deepcopy(responses[endpoint])

    def observed_logs(job_id):
        if job_id not in retained_logs:
            retained_logs[job_id] = logs(job_id)
        return retained_logs[job_id]

    validate_qualification(config, observed_api, observed_logs)
    native_jobs = {}
    for workflow, (job_name, step_name) in NATIVE_STEPS.items():
        item = config['requiredSourceRuns'][workflow]
        jobs = run_jobs(observed_api, item['id'], item['attempt'])
        matches = [job for job in jobs if job.get('name') == job_name]
        require(len(matches) == 1, 'Native transformation job is missing or duplicated: ' + job_name)
        job = matches[0]
        steps = [step for step in job.get('steps', []) if step.get('name') == step_name]
        require(len(steps) == 1 and steps[0].get('status') == 'completed'
                and steps[0].get('conclusion') == 'success',
                'Native transformation step did not execute exactly once successfully: ' + step_name)
        native_jobs[workflow] = job
    receiver = native_jobs['alpha-project-handoff.yml']
    receiver_logs = observed_logs(receiver['id'])
    for name, value in {
        'TI_NATIVE_ALPHA_COMMIT': expected['alphaCommit'],
        'TI_NATIVE_FIXTURE_SHA256': expected['fixtureSha256'],
        'TI_NATIVE_BOUNDARY': expected['boundary'],
    }.items():
        marker = re.findall(r'^(?:\d{4}-\d{2}-\d{2}T\S+[ \t]+)?' + re.escape(name)
                            + r'=([^\r\n]*?)[ \t]*\r?$', receiver_logs, re.MULTILINE)
        require(marker == [value], 'Native transformation marker is missing, duplicated or stale: ' + name)
    return expected


def verify_record(config):
    """Validate offline source metadata only; no live CI observation is implied."""
    expected = source_metadata()
    require(isinstance(config, dict) and config.get('transformationQualification') == expected,
            'Native transformation qualification record differs')
    return expected
