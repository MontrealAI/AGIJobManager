"""Reversible release plumbing, immutable gates and no-publication-mode regressions."""
import argparse
import pathlib
import runpy
import unittest
from release_common import sha
ROOT=pathlib.Path(__file__).resolve().parents[2]
P=runpy.run_path(str(ROOT/'scripts/release/maintenance-profile.py'))
D=runpy.run_path(str(ROOT/'scripts/release/package-policy.py'))
class MaintenancePlumbing(unittest.TestCase):
    def test_every_exact_selector_workflow_projection_reconstructs_predecessor(self):
        P['validate_projections'](ROOT,P['baseline'](ROOT))
    def test_selected_profile_and_unknown_modes_fail_closed(self):
        args=dict(manifest=P['MANIFEST'],manifest_sha256=sha((ROOT/P['MANIFEST']).read_bytes()),verifier_sha256=sha((ROOT/P['VERIFIER']).read_bytes()))
        selection=D['select'](P['PROFILE'],**args);self.assertEqual(D['policy'](selection)['PROFILE'],P['PROFILE'])
        for profile in ['unknown','manager-dependency-maintenance-v2','1.19.6',None]:
            with self.subTest(profile=profile),self.assertRaises(ValueError):D['select'](profile,**args)
        parser=argparse.ArgumentParser();D['add_selection_arguments'](parser)
        with self.assertRaises(SystemExit):parser.parse_args(['--profile','unknown'])
    def test_all_manual_source_and_attestation_gates_remain_in_publisher(self):
        text=(ROOT/'.github/workflows/publish-v114.yml').read_text()
        for exact in ["github.event_name == 'workflow_dispatch'", "inputs.confirmation == 'PUBLISH_v1.19.6'", "if: steps.readiness.outputs.ready != 'true'\n        run: exit 1", 'wait-qualification.py --source "$SOURCE_COMMIT"','--deny-self-hosted-runners','--source-ref refs/heads/main','--signer-digest "$SOURCE_COMMIT"','--source-digest "$SOURCE_COMMIT"']:
            self.assertIn(exact,text)
        self.assertNotIn('workflow_run:',text)
        self.assertEqual(text.count('--profile manager-dependency-maintenance-v1'),3)
    def test_expected_inputs_do_not_become_qualification_records(self):
        text=(ROOT/'scripts/release/maintenance-qualification.py').read_text()
        self.assertNotIn('release-v1.19.6-provenance.json',text)
        self.assertNotIn('mainnet-cutover-v1.19.6-expected.json',text)
        self.assertNotIn('slither-reviewed-findings-v1.19.6.json',text)
        self.assertIn("native['validate']",text);self.assertIn("run_jobs(",text)
    def test_native_ti_and_extra_maintenance_checks_exist_at_every_publication_boundary(self):
        for name in ['collect-qualification.py','verify-package.py','publish-release.py','pages-publication-maintenance.py']:
            text=(ROOT/'scripts/release'/name).read_text()
            self.assertIn('transformational-qualification.py',text);self.assertIn('maintenance-qualification.py',text)
        publisher=(ROOT/'scripts/release/publish-release.py').read_text()
        self.assertEqual(publisher.count("maintenance['validate']"),2)
    def test_new_pages_guard_has_only_explicit_profile_version_and_additive_maintenance_delta(self):
        current=(ROOT/'scripts/release/pages-publication-maintenance.py').read_text()
        addition="        maintenance = runpy.run_path(str(ROOT / 'scripts/release/maintenance-qualification.py'))\n        require(config.get('maintenanceQualification') == maintenance['validate'](config, api, lambda job_id: gh('api', f'repos/{REPOSITORY}/actions/jobs/{job_id}/logs', '--method', 'GET', '--allow-escape-sequences').decode()), 'Pages maintenance qualification binding differs')\n"
        self.assertEqual(current.count(addition),1)
        restored=current.replace(addition,'').replace('v1.19.6','v1.19.5').replace('manager-dependency-maintenance-v1','manager-transformational-v1').replace('maintenance-profile.py','transformational-profile.py')
        self.assertEqual(restored,(ROOT/'scripts/release/pages-publication-ti.py').read_text())
if __name__=='__main__':unittest.main()
