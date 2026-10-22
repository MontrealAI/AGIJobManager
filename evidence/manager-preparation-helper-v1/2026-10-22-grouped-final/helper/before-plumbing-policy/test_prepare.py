"""Owned-data policy tests for the new external preparation implementation.

These tests import only the newly authored sibling prepare.py. They never import
a captured repository module, execute a generated verifier, invoke Git/processes,
fetch data, apply source changes or qualify an actual release. Actual final-input
end-to-end generation remains NOT_RUN.
"""
import ast
import hashlib
import importlib.util
import json
import os
import pathlib
import stat
import tempfile
import unittest
from unittest.mock import patch

MODULE_PATH = pathlib.Path(__file__).with_name("prepare.py")
SPEC = importlib.util.spec_from_file_location("manager_new_preparer_owned", MODULE_PATH)
P = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(P)


class OwnedDataTests(unittest.TestCase):
    def private(self):
        temporary = tempfile.TemporaryDirectory(prefix="manager-owned-data-", dir=MODULE_PATH.parent)
        self.addCleanup(temporary.cleanup)
        root = pathlib.Path(temporary.name)
        root.chmod(0o700)
        return root

    def put(self, root, name, raw):
        path = root / name
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        path.write_bytes(raw)
        path.chmod(0o600)
        return path

    def capture(self, root):
        value = P.Capture(str(root))
        self.addCleanup(value.close)
        return value

    def output(self):
        root = self.private()
        details = root.stat()
        descriptor = P.open_directory(str(root))
        self.addCleanup(os.close, descriptor)
        value = {"parent": str(root), "device": details.st_dev, "inode": details.st_ino,
                 "name": "PREPARED_PACKET.json"}
        identity = (details.st_dev, details.st_ino, details.st_mode, details.st_uid)
        return root, descriptor, value, identity

    def test_01_blob_and_tree_wire_vectors(self):
        self.assertEqual(P.git_blob(b""), "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391")
        self.assertEqual(P.git_blob(b"hello\n"), "ce013625030ba8dba906f756967f9e9ca394464a")
        oid = P.git_blob(b"")
        nested = b"100755 z\0" + bytes.fromhex(oid)
        nested_oid = hashlib.sha1(b"tree " + str(len(nested)).encode() + b"\0" + nested).hexdigest()
        wire = (b"100644 a.c\0" + bytes.fromhex(oid) + b"40000 a\0" + bytes.fromhex(nested_oid)
                + b"120000 link\0" + bytes.fromhex(oid))
        expected = hashlib.sha1(b"tree " + str(len(wire)).encode() + b"\0" + wire).hexdigest()
        actual, trees = P.git_tree({"a/z": {"mode": "100755", "blob": oid},
                                    "a.c": {"mode": "100644", "blob": oid},
                                    "link": {"mode": "120000", "blob": oid}})
        self.assertEqual(actual, expected)
        self.assertEqual(trees["a"], nested_oid)

    def test_02_strict_json_duplicates_and_nonfinite(self):
        for raw in (b'{"x":1,"x":2}', b'{"x":{"y":1,"y":2}}',
                    b'{"x":NaN}', b'{"x":Infinity}', b'{"x":-Infinity}', b'{"x":1e999}'):
            with self.subTest(raw=raw), self.assertRaises(P.Refusal):
                P.strict_json(raw)
        self.assertEqual(P.strict_json(b'{"x":1.25}'), {"x": 1.25})
        self.assertFalse(P.same_json({"x": 1}, {"x": 1.0}))
        self.assertFalse(P.same_json({"x": 1}, {"x": True}))

    def test_03_json_budgets_types_unicode(self):
        for raw, limits in ((b"[[[0]]]", {"depth": 2}), (b"[1,2,3]", {"nodes": 3}),
                            (b'{"long":1}', {"maximum": 2}), (b"9" * 30, {}),
                            (b'"\\ud800"', {})):
            with self.subTest(raw=raw), self.assertRaises(P.Refusal):
                P.strict_json(raw, **limits)
        for value in (True, 1.0, "1", None):
            with self.assertRaises(P.Refusal):
                P.integer(value)
        with self.assertRaises(P.Refusal):
            P.json_bytes({"x": "é" * 10}, maximum=10)

    def test_04_unsafe_paths_and_file_ancestor(self):
        for name in ("/a", "a//b", "a/../b", "./a", "a\\b", "a:b", "a/\x00b", ".git/a", "a/"):
            with self.subTest(name=name), self.assertRaises(P.Refusal):
                P.virtual_path(name)
        oid = P.git_blob(b"")
        with self.assertRaises(P.Refusal):
            P.git_tree({"a": {"mode": "100644", "blob": oid},
                        "a/b": {"mode": "100644", "blob": oid}})

    def test_05_historical_groups_and_fixed_identities(self):
        leaves = ["docs/AGIJOBMANAGER.md", "docs/AGIJobManager.md", "docs/ARCHITECTURE.md",
                  "docs/architecture.md", "docs/CONTRACTS/AGIJobManager.md",
                  "docs/contracts/AGIJobManager.md", "docs/TESTING.md", "docs/Testing.md",
                  "docs/DEPLOYMENT/a.md", "docs/deployment/b.md"]
        base = {name: {"mode": "100644", "blob": P.git_blob(name.encode())} for name in leaves}
        P.historical_aliases(base, dict(base), dict(base))
        changed = dict(base)
        changed["docs/Testing.md"] = {"mode": "100644", "blob": P.git_blob(b"changed")}
        with self.assertRaises(P.Refusal):
            P.historical_aliases(base, changed, changed)
        new = dict(base, **{"docs/testing.MD": {"mode": "100644", "blob": P.git_blob(b"new")}})
        with self.assertRaises(P.Refusal):
            P.historical_aliases(base, base, new)

    def test_06_codepoint_projections_unicode_crlf_repetition(self):
        original = "é\r\nsame same\r\n"
        edits = [{"start": 3, "before": "same", "after": "X"},
                 {"start": 8, "before": "same", "after": ""},
                 {"start": 12, "before": "", "after": "!"}]
        self.assertEqual(P.apply_projection(original, edits), "é\r\nX !\r\n")
        self.assertEqual(P.apply_projection("ab", [
            {"start": 1, "before": "", "after": "X"},
            {"start": 1, "before": "", "after": "Y"}]), "aXYb")

    def test_07_projection_type_order_offset_failures(self):
        cases = [
            [{"start": True, "before": "", "after": "a"}],
            [{"start": 8, "before": "", "after": "a"}],
            [{"start": 1, "before": "bc", "after": "x"}, {"start": 2, "before": "c", "after": "y"}],
            [{"start": 0, "before": "wrong", "after": "x"}],
        ]
        for edits in cases:
            with self.subTest(edits=edits), self.assertRaises(P.Refusal):
                P.apply_projection("abc", edits)
        accepted = "a" * 40
        original = "owned\n          ref: " + P.WORKFLOW_OLD_ALPHA_REF + "\n"
        start = original.index(P.WORKFLOW_OLD_ALPHA_REF)
        edits = [{"start": start, "before": P.WORKFLOW_OLD_ALPHA_REF, "after": accepted}]
        P.workflow_ref_metadata(edits, len(original), accepted)
        P.workflow_ref_bytes(original, original.replace(P.WORKFLOW_OLD_ALPHA_REF, accepted), edits)
        with self.assertRaises(P.Refusal):
            P.workflow_ref_metadata(edits + edits, len(original), accepted)
        with self.assertRaises(P.Refusal):
            P.workflow_ref_bytes("other " + original, original, edits)

    def render_fixture(self, template):
        before = "old é\r\n"
        after = "new é\r\n"
        basis = {"finalFinite": {"a.txt": {"before": {"mode": "100644", "blob": P.git_blob(before.encode())},
                  "after": P.identify(after.encode()), "reason": "Owned versioned fixture"}},
                 "projections": {"a.txt": [{"start": 0, "before": "old", "after": "new"}]},
                 "protected": {"fixed.txt": {"identity": P.identify(b"fixed")}}}
        trees = {"base": {"a.txt": P.identify(before.encode()), "fixed.txt": P.identify(b"fixed")}}
        with patch.multiple(P, TEMPLATE_BYTES=len(template), TEMPLATE_SHA256=P.sha256(template)):
            return P.render_bmv(template, trees, basis, {}, {"a.txt": before})

    def test_08_one_frozen_block_and_outside_bytes(self):
        template = b"owned-prefix\n" + P.FROZEN_BLOCK.encode() + b"owned-suffix\n"
        output = self.render_fixture(template)
        self.assertEqual(set(output), P.CONTROLS)
        verifier = output[P.V_PATH]
        self.assertTrue(verifier.startswith(b"owned-prefix\n"))
        self.assertTrue(verifier.endswith(b"owned-suffix\n"))
        self.assertEqual(verifier.count(b"# BEGIN FROZEN DISCOVERY DELTA\n"), 1)
        self.assertIn(P.sha256(output[P.B_PATH]).encode(), verifier)
        self.assertEqual(P.strict_json(output[P.B_PATH])["originals"], {"a.txt": "old é\r\n"})

    def test_09_full_template_hash_and_duplicate_block(self):
        template = P.FROZEN_BLOCK.encode()
        with patch.multiple(P, TEMPLATE_BYTES=len(template), TEMPLATE_SHA256="0" * 64):
            with self.assertRaises(P.Refusal):
                P.render_bmv(template, {}, {}, {}, {})
        with self.assertRaises(P.Refusal):
            self.render_fixture(template + template)

    def test_10_last_bad_original_refuses_before_any_read(self):
        references = {}
        for role, (length, digest, kind, oid) in P.API_ROLE_FACTS.items():
            url = "https://api.github.com/repos/" + P.REPOSITORY + "/git/" + kind + "/" + oid
            if kind == "trees":
                url += "?recursive=1"
            references[role] = {"path": "meta/" + role + ".json", "bytes": length,
                                "sha256": digest, "url": url}
        references["ancestry_commit"]["sha256"] = "0" * 64
        class NoRead:
            def read(self, *args):
                raise AssertionError("No data read permitted for bad metadata")
        with self.assertRaises(P.Refusal):
            P.fixed_originals(NoRead(), references)

    def test_11_missing_final_inputs_refuse_before_reads(self):
        class NoRead:
            def read(self, *args):
                raise AssertionError("No input read permitted")
        final = {"schema": "manager/externally-selected-final-inputs/v1", "acceptedAlphaCommit": None,
                 "alpha": {}, "packet": {}, "shipping": {}, "browser": {},
                 "snapshots": {}, "workflowEdits": {}}
        with self.assertRaises(P.Refusal):
            P.final_metadata(NoRead(), final, {})
        # Root-selected originals are attempt1 only. A coherent attempt2 must
        # refuse in metadata validation before any API/CAS read.
        accepted, tree = "a" * 40, "b" * 40
        pin_files = {path: "0" * 64 for path in P.ALPHA_REQUIRED | {P.INSPECTOR_PATH}}
        alpha_paths = set(pin_files) | {P.CATALOG_PATH, "LICENSE", "owned-page.html"}
        alpha = {"commit": accepted, "tree": tree, "commitRef": None, "treeRef": None,
                 "pagePath": "owned-page.html",
                 "files": {path: P.identify(b"x") for path in alpha_paths}}
        shipping = {"schema": "successor/discovery-lab-alpha-source/v1", "repository": P.ALPHA_REPOSITORY,
                    "commit": accepted, "tree": tree, "sourceHash": "0" * 64,
                    "catalogPath": P.CATALOG_PATH, "catalogSha256": "0" * 64, "files": pin_files,
                    "qualification": "PENDING_FINAL_SOURCE_NATIVE_COMPATIBILITY"}
        keys = ("schema", "state", "repository", "workflowPath", "producer", "artifact",
                "sourceHash", "pageSha256", "catalogSha256", "inventorySha256", "members",
                "campaignDigest", "missionId", "workspaceSha256", "requestSha256", "transport")
        browser = dict.fromkeys(keys)
        browser.update(schema="manager/discovery-browser-input-artifact/v1",
                       state="REVIEWED_AUTHENTICATED_ALPHA_ARTIFACT",
                       repository=P.ALPHA_REPOSITORY, workflowPath=P.BROWSER_WORKFLOW,
                       producer={"runId": 1, "runAttempt": 2, "workflowId": 1, "event": "push",
                                 "headBranch": "main", "headCommit": accepted, "checkoutCommit": accepted,
                                 "checkoutTree": tree, "checkoutParents": ["c" * 40]})
        final.update(acceptedAlphaCommit=accepted, alpha=alpha, shipping=shipping, browser=browser)
        with self.assertRaisesRegex(P.Refusal, "Original attempt1"):
            P.final_metadata(NoRead(), final, {})

    def test_12_raw_cas_exact_types_and_complete_last_record(self):
        raw = b"\x00owned\xff"
        identity = P.identify(raw, "100755")
        good = {"schema": "manager/selected-raw-cas/v1",
                "objects": {identity["blob"]: {"bytes": len(raw), "sha256": identity["sha256"]}}}
        self.assertEqual(P.cas_metadata(good, [{"a": identity}]), good["objects"])
        for count in (True, float(len(raw)), -1):
            broken = json.loads(json.dumps(good))
            broken["objects"][identity["blob"]]["bytes"] = count
            with self.assertRaises(P.Refusal):
                P.cas_metadata(broken, [{"a": identity}])
        broken = json.loads(json.dumps(good))
        broken["objects"]["0" * 40] = {"bytes": 0, "sha256": P.sha256(b"")}
        with self.assertRaises(P.Refusal):
            P.cas_metadata(broken, [{"a": identity}])

    def test_13_full_public_tree_subtree_root_and_mode(self):
        oid = P.git_blob(b"x")
        entries = {"nested/a": {"mode": "100644", "blob": oid}}
        root, subtrees = P.git_tree(entries)
        prefix = "https://api.github.com/repos/" + P.REPOSITORY + "/git/"
        document = {"sha": root, "url": prefix + "trees/" + root, "truncated": False, "tree": [
            {"path": "nested", "mode": "040000", "type": "tree", "sha": subtrees["nested"],
             "url": prefix + "trees/" + subtrees["nested"]},
            {"path": "nested/a", "mode": "100644", "type": "blob", "sha": oid,
             "url": prefix + "blobs/" + oid, "size": 1}]}
        self.assertEqual(P.full_tree(document, root)["nested/a"]["blob"], oid)
        public_entries = {"public/" + str(index) + ".txt": {"mode": "100644", "blob": oid}
                          for index in range(4420)}
        public_root, public_trees = P.git_tree(public_entries, maximum=8192)
        public_prefix = "https://api.github.com/repos/" + P.ALPHA_REPOSITORY + "/git/"
        public_rows = [{"path": "public", "mode": "040000", "type": "tree",
                        "sha": public_trees["public"],
                        "url": public_prefix + "trees/" + public_trees["public"]}]
        public_rows.extend({"path": path, "mode": "100644", "type": "blob", "sha": oid,
                            "url": public_prefix + "blobs/" + oid, "size": 1}
                           for path in public_entries)
        self.assertEqual(len(public_rows), 4421)
        public_doc = {"sha": public_root, "url": public_prefix + "trees/" + public_root,
                      "truncated": False, "tree": public_rows}
        self.assertEqual(len(P.full_tree(public_doc, public_root, maximum_leaves=8192,
                                        repository=P.ALPHA_REPOSITORY, public=True)), 4420)
        with self.assertRaisesRegex(P.Refusal, "entry count"):
            P.full_tree(public_doc, public_root, repository=P.ALPHA_REPOSITORY)
        oversized = dict(public_doc, tree=[public_rows[-1]] * 8193)
        with self.assertRaisesRegex(P.Refusal, "entry count"):
            P.full_tree(oversized, public_root, maximum_leaves=8192,
                        repository=P.ALPHA_REPOSITORY, public=True)
        for mutate in ("subtree", "duplicate", "mode"):
            broken = json.loads(json.dumps(document))
            if mutate == "subtree":
                broken["tree"][0]["sha"] = "0" * 40
            elif mutate == "duplicate":
                broken["tree"].append(dict(broken["tree"][-1]))
            else:
                broken["tree"][-1]["mode"] = "160000"
            with self.assertRaises(P.Refusal):
                P.full_tree(broken, root)

    def test_14_owned_binary_capture_and_digest_size(self):
        root = self.private()
        raw = b"\x00owned\xff"
        self.put(root, "data.bin", raw)
        capture = self.capture(root)
        self.assertEqual(capture.read("data.bin", len(raw), P.sha256(raw), 100), raw)
        for size, digest in ((len(raw) - 1, P.sha256(raw)), (len(raw), "0" * 64)):
            with self.assertRaises(P.Refusal):
                capture.read("data.bin", size, digest, 100)

    def test_15_nofollow_owned_leaf_and_ancestor(self):
        root = self.private()
        self.put(root, "real/data.bin", b"owned")
        (root / "leaf.bin").symlink_to("real/data.bin")
        (root / "alias").symlink_to("real", target_is_directory=True)
        capture = self.capture(root)
        for name in ("leaf.bin", "alias/data.bin"):
            with self.subTest(name=name), self.assertRaises((P.Refusal, OSError)):
                capture.read(name, 5, P.sha256(b"owned"), 100)

    def test_16_closure_rejects_empty_directory_extra_and_fifo(self):
        for kind in ("emptydir", "extra", "fifo"):
            root = self.private()
            self.put(root, "data.bin", b"x")
            if kind == "emptydir":
                (root / "unexpected").mkdir(mode=0o700)
            elif kind == "extra":
                self.put(root, "extra.bin", b"x")
            else:
                os.mkfifo(root / "pipe", 0o600)
            capture = self.capture(root)
            with self.subTest(kind=kind), self.assertRaises(P.Refusal):
                capture.closure({"data.bin"})
        root = self.private()
        self.put(root, "data.bin", b"x")
        with self.assertRaises(P.Refusal):
            self.capture(root).closure({"data.bin"}, max_nodes=0)

    def test_17_bounded_growth_and_late_snapshot(self):
        root = self.private()
        path = self.put(root, "data.bin", b"x")
        capture = self.capture(root)
        sizes = []
        def grow(_fd, size):
            sizes.append(size)
            return b"xx"
        with patch.object(P.os, "read", side_effect=grow), self.assertRaises(P.Refusal):
            capture.read("data.bin", 1, P.sha256(b"x"), 10)
        self.assertEqual(sizes, [2])
        capture.read("data.bin", 1, P.sha256(b"x"), 10)
        path.write_bytes(b"y")
        with self.assertRaises(P.Refusal):
            capture.recheck()

    def package_fixture(self):
        originals, proposed, payloads = {}, {}, {}
        for path in (*P.PACKAGES, "config/usdc-deployment.json"):
            if path in P.UI_BASE_RECORDS:
                old_raw = (MODULE_PATH.parent / "fixtures/base" / path).read_bytes()
                raw = (MODULE_PATH.parent / "fixtures/after" / path).read_bytes()
                P.matches(old_raw, P.UI_BASE_RECORDS[path])
                P.matches(raw, P.FIXED_REVIEWED_OVERLAYS[path])
                originals[path] = old_raw.decode("utf8")
                proposed[path] = P.identify(raw)
                payloads[proposed[path]["blob"]] = raw
                continue
            before = {"version": "1.19.6", "settings": {"unchanged": "yes"}}
            after = {"version": "1.20.0", "settings": {"unchanged": "yes"}}
            if path.endswith("package-lock.json"):
                before["packages"] = {"": {"version": "1.19.6"}}
                after["packages"] = {"": {"version": "1.20.0"}}
            originals[path] = json.dumps(before)
            raw = json.dumps(after).encode()
            proposed[path] = P.identify(raw)
            payloads[proposed[path]["blob"]] = raw
        return originals, proposed, payloads

    def test_18_version_only_package_and_deployment_invariants(self):
        originals, proposed, payloads = self.package_fixture()
        P.validate_package_invariants(originals, proposed, payloads)
        path = "config/usdc-deployment.json"
        raw = b'{"version":"1.20.0","settings":{"unchanged":"changed"}}'
        proposed[path] = P.identify(raw)
        payloads[proposed[path]["blob"]] = raw
        with self.assertRaises(P.Refusal):
            P.validate_package_invariants(originals, proposed, payloads)

    def test_19_output_boundary_existing_objects_and_overlap(self):
        for kind in ("file", "directory", "link"):
            root, descriptor, output, identity = self.output()
            target = root / output["name"]
            if kind == "file":
                self.put(root, output["name"], b"existing")
            elif kind == "directory":
                target.mkdir(mode=0o700)
            else:
                target.symlink_to("absent-owned-data")
            with self.assertRaises(P.Refusal):
                P.output_preflight(output, ["/separate-input"], ["/separate-repository"])
        root, descriptor, output, identity = self.output()
        with self.assertRaises(P.Refusal):
            P.output_preflight(output, [str(root.parent)], ["/separate-repository"])

    def test_20_fresh_atomic_commit_exact_bytes(self):
        root, descriptor, output, identity = self.output()
        calls = []
        result = P.stage_packet(b'{"owned":true}\n', descriptor, output, identity,
                                lambda: calls.append("recheck"))
        self.assertEqual(result["state"], "PREPARED_UNAPPROVED")
        self.assertEqual((root / output["name"]).read_bytes(), b'{"owned":true}\n')
        self.assertEqual(len(calls), 2)
        self.assertEqual([p.name for p in root.iterdir()], [output["name"]])
        self.assertEqual(stat.S_IMODE((root / output["name"]).stat().st_mode), 0o600)

    def test_21_late_final_collision_is_not_overwritten(self):
        root, descriptor, output, identity = self.output()
        calls = []
        def recheck():
            calls.append(None)
            if len(calls) == 2:
                self.put(root, output["name"], b"existing-owned-data")
        with self.assertRaises(P.Refusal):
            P.stage_packet(b"new", descriptor, output, identity, recheck)
        self.assertEqual((root / output["name"]).read_bytes(), b"existing-owned-data")
        self.assertEqual([p.name for p in root.iterdir()], [output["name"]])

    def test_22_precommit_write_and_stage_fsync_cleanup(self):
        for fault in ("write", "fsync", "recheck"):
            root, descriptor, output, identity = self.output()
            calls = []
            def recheck():
                calls.append(None)
                if fault == "recheck" and len(calls) == 2:
                    raise P.Refusal("Owned late input drift")
            original_fsync = P.os.fsync
            def fsync(fd):
                if fd != descriptor:
                    raise OSError("Owned stage-fsync fault")
                return original_fsync(fd)
            if fault == "write":
                with patch.object(P.os, "write", side_effect=OSError("Owned write fault")), self.assertRaises(OSError):
                    P.stage_packet(b"x", descriptor, output, identity, recheck)
            elif fault == "fsync":
                with patch.object(P.os, "fsync", side_effect=fsync), self.assertRaises(OSError):
                    P.stage_packet(b"x", descriptor, output, identity, recheck)
            else:
                with self.assertRaises(P.Refusal):
                    P.stage_packet(b"x", descriptor, output, identity, recheck)
            self.assertEqual(list(root.iterdir()), [])

    def test_23_postlink_failure_uncertain_retains_final(self):
        root, descriptor, output, identity = self.output()
        original_fsync = P.os.fsync
        def fsync(fd):
            if fd == descriptor:
                raise OSError("Owned postlink parent-fsync fault")
            return original_fsync(fd)
        with patch.object(P.os, "fsync", side_effect=fsync), self.assertRaises(P.CommitUncertain):
            P.stage_packet(b"owned-retained", descriptor, output, identity, lambda: None)
        self.assertEqual((root / output["name"]).read_bytes(), b"owned-retained")

    def test_24_replaced_cleanup_name_preserves_other_inode(self):
        root, descriptor, output, identity = self.output()
        stage = self.put(root, "owned.stage", b"original")
        details = stage.stat()
        stage.rename(root / "held-original")
        self.put(root, "owned.stage", b"replacement")
        P._cleanup_owned_stage(descriptor, "owned.stage", (details.st_dev, details.st_ino))
        self.assertEqual((root / "owned.stage").read_bytes(), b"replacement")
        self.assertEqual((root / "held-original").read_bytes(), b"original")

    def test_25_acyclic_packet_flags_determinism_and_virtual_link_data(self):
        outputs = {P.B_PATH: b'{"owned":"baseline"}\n', P.M_PATH: b'{"owned":"manifest"}\n',
                   P.V_PATH: b"# owned inert generated text\n"}
        proposed = {"data/" + str(i) + ".txt": P.identify(b"x") for i in range(1659)}
        proposed[P.V_PATH] = P.identify(b"empty-template")
        proposed["hardhat/contracts"] = P.identify(b"../contracts", "120000")
        basis = {"currentFinite": {}, "finalFinite": {str(i): {} for i in range(85)},
                 "protected": {str(i): {} for i in range(1589)}, "projections": {}}
        args = (outputs, proposed, basis, {"bytes": 1, "sha256": "0" * 64}, {}, {})
        raw = P.make_packet(*args)
        self.assertEqual(raw, P.make_packet(*args))
        packet = P.strict_json(raw)
        self.assertEqual(set(packet), {"schema", "files", "receipt"})
        self.assertEqual(packet["receipt"]["flags"], P.FALSE_FLAGS)
        self.assertTrue(all(value is False for value in packet["receipt"]["flags"].values()))
        self.assertEqual(packet["receipt"]["counts"]["proposedLeaves"], 1663)
        self.assertEqual({name: packet["receipt"]["counts"][name]
                          for name in ("finiteModified", "finiteAdded", "finiteTotal", "protected")},
                         {"finiteModified": 38, "finiteAdded": 47, "finiteTotal": 85, "protected": 1589})
        self.assertNotIn("packetSha256", packet["receipt"])
        self.assertEqual(set(packet["files"]), P.CONTROLS)
        self.assertEqual(proposed["hardhat/contracts"]["mode"], "120000")
        tree = ast.parse(MODULE_PATH.read_text(encoding="utf8"))
        forbidden = {"subprocess", "socket", "http", "urllib", "runpy", "importlib"}
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.extend(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                imports.append((node.module or "").split(".")[0])
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                self.assertNotIn(node.func.id, {"eval", "exec", "compile", "__import__"})
        self.assertFalse(forbidden & set(imports))

    def test_26_late_nested_closure_refuses_before_stage_or_link(self):
        for phase in (1, 2):
            for directory in ("cas", "meta"):
                for kind in ("file", "emptydir", "fifo"):
                    with self.subTest(phase=phase, directory=directory, kind=kind):
                        source = self.private()
                        self.put(source, "cas/original.bin", b"owned-source")
                        self.put(source, "meta/original.json", b"{}")
                        capture = self.capture(source)
                        expected = {"cas/original.bin", "meta/original.json"}
                        capture.closure(expected)
                        capture.read("cas/original.bin", 12, P.sha256(b"owned-source"), 100)
                        capture.read("meta/original.json", 2, P.sha256(b"{}"), 100)
                        capture.recheck()
                        expected.add(directory + "/extra.bin")
                        root, descriptor, output, identity = self.output()
                        calls = []
                        def recheck():
                            calls.append(None)
                            if len(calls) == phase:
                                if kind == "file":
                                    self.put(source, directory + "/extra.bin", b"unexpected")
                                elif kind == "emptydir":
                                    (source / directory / "unexpected").mkdir(mode=0o700)
                                else:
                                    os.mkfifo(source / directory / "unexpected", 0o600)
                                self.assertEqual(P.snapshot(source.stat()), capture.initial)
                            capture.recheck()
                        with self.assertRaises(P.Refusal):
                            P.stage_packet(b"owned-packet", descriptor, output, identity, recheck)
                        self.assertEqual(len(calls), phase)
                        self.assertEqual(list(root.iterdir()), [])


    def test_27_fixed_reviewed_overlay_identities_and_exact_paths(self):
        self.assertEqual(set(P.FIXED_REVIEWED_OVERLAYS), P.SIX_IO | set(P.UI_BASE_RECORDS)
                         | {"docs/REFERENCE/VERSIONS.md", "docs/ui/VERSIONS.md", P.BOUNDARY_PATH}
                         | P.ENDPOINT_CORRECTION_PATHS | P.PAGES_CORRECTION_PATHS)
        self.assertEqual(len(P.FIXED_REVIEWED_OVERLAYS), 15)
        self.assertEqual(len(P.CONTEXTUAL_OVERLAYS), 5)
        self.assertEqual(len(P.OVERLAY_PATHS), 20)
        overlays = {**P.FIXED_REVIEWED_OVERLAYS,
                    **{path: P.identify(b"owned contextual data") for path in P.CONTEXTUAL_OVERLAYS}}
        P.reviewed_overlay_records(overlays)
        for path in P.FIXED_REVIEWED_OVERLAYS:
            self.assertEqual(P.FIXED_CORRECTION_PROVENANCE[path],
                "b195d30ba766120f369d8587ec4d0daa68604ee4" if path in P.PAGES_CORRECTION_PATHS
                else "4d14d0a043074d8ca02828e247a2715ce3f50dc5" if path in P.ENDPOINT_CORRECTION_PATHS
                else "1905fbe1dae8c98ed8e7e5ca55aa29e12f8c5710" if path == P.BOUNDARY_PATH
                else "0d790835a4b2346034533f4e63d70e18b2f1570f" if path in {"scripts/release/verify-package.py",
                    "scripts/release/test-discovery-release-plumbing.py"}
                else "88b14a5b2b7c474e4c16bac8af79650adf709ab7" if path == "docs/ui/VERSIONS.md"
                else "b8ff0a7df7195a0b1f132b43114422d3dfb64add")
            for key, value in (("mode", "100755"), ("blob", "0" * 40),
                               ("bytes", overlays[path]["bytes"] + 1), ("sha256", "0" * 64)):
                broken = {name: dict(record) for name, record in overlays.items()}
                broken[path][key] = value
                with self.subTest(path=path, field=key), self.assertRaises(P.Refusal):
                    P.reviewed_overlay_records(broken)
        for changed in ({path: row for path, row in overlays.items() if path != P.BOUNDARY_PATH},
                        {**overlays, P.V_PATH: P.identify(b"arbitrary verifier")},
                        {**overlays, "unreviewed/runtime.py": P.identify(b"arbitrary source")}):
            with self.assertRaises(P.Refusal):
                P.reviewed_overlay_records(changed)

    def scope_fixture(self):
        old_io = P.SIX_IO - {"scripts/release/test-discovery-release-plumbing.py",
                             "scripts/release/test-discovery-release-profile.py"}
        modified = set(P.PACKAGES) | {"config/usdc-deployment.json", "docs/REFERENCE/VERSIONS.md", "docs/ui/VERSIONS.md",
                                     ".github/workflows/current-state-release.yml"} | old_io
        modified.update("data/modified-" + str(index) + ".txt" for index in range(37 - len(modified)))
        aliases = {"docs/AGIJOBMANAGER.md", "docs/AGIJobManager.md", "docs/ARCHITECTURE.md",
                   "docs/architecture.md", "docs/CONTRACTS/AGIJobManager.md",
                   "docs/contracts/AGIJobManager.md", "docs/TESTING.md", "docs/Testing.md",
                   "docs/DEPLOYMENT/a.md", "docs/deployment/b.md"}
        base_paths = modified | aliases | {P.BOUNDARY_PATH}
        base_paths.update("data/protected-" + str(index) + ".txt" for index in range(1613 - len(base_paths)))
        base = {path: P.identify(("owned base " + path).encode()) for path in base_paths}
        current = dict(base)
        current.update({path: P.identify(("owned current " + path).encode()) for path in modified})
        added = P.NATIVE_TEN | P.V2_FOUR | {P.V_PATH, P.BROWSER_PATH,
            ".github/workflows/discovery-lab-receiver.yml", ".github/workflows/publish-discovery-v1.yml",
            "scripts/release/test-discovery-release-plumbing.py", "scripts/release/test-discovery-release-profile.py"} | P.ENDPOINT_CORRECTION_PATHS | P.PAGES_CORRECTION_PATHS
        added = set(added) | {"owned-added/path-" + str(index) + ".txt" for index in range(47 - len(added))}
        current.update({path: P.identify(("owned addition " + path).encode()) for path in added})
        overlays = {**P.FIXED_REVIEWED_OVERLAYS,
                    **{path: P.identify(("owned contextual " + path).encode()) for path in P.CONTEXTUAL_OVERLAYS}}
        proposed = {**current, **overlays}
        final_modified = modified | {P.BOUNDARY_PATH}
        before = {path: base[path] for path in final_modified}
        def finite(paths, records):
            return {path: {"status": "M" if path in base else "A",
                           "before": P.git_entry(base[path]) if path in base else None,
                           "after": records[path], "reason": "Owned metadata policy fixture"} for path in paths}
        protected_paths = (set(base) - final_modified) | P.NATIVE_TEN | P.V2_FOUR
        basis = {"schema": "manager/externally-selected-bmv-basis/v1",
                 "currentFinite": finite(modified | (added - {P.V_PATH}), current),
                 "finalFinite": finite(final_modified | ((added | {P.SHIPPING_PATH}) - {P.V_PATH}), proposed),
                 "protected": {path: {"identity": current[path], "anchor":
                    P.BASE_COMMIT if path in base else P.FEATURE_COMMIT if path in P.NATIVE_TEN
                    else P.RECONCILIATION_COMMIT} for path in protected_paths},
                 "projections": {path: [] for path in final_modified}}
        def tree(records):
            return {path: {key: record[key] for key in ("mode", "blob", "bytes")}
                    for path, record in records.items()}
        trees = {"base": tree(base), "current": tree(current),
                 "feature": tree({path: current[path] for path in P.NATIVE_TEN}),
                 "reconciliation": tree({path: current[path] for path in P.V2_FOUR})}
        return basis, current, before, overlays, trees

    def test_28_only_boundary_moves_to_final_scope_with_original38(self):
        basis, current, before, overlays, trees = self.scope_fixture()
        proposed, modified = P.source_basis_metadata(basis, current, before, overlays, trees)
        self.assertEqual(len(P.changed_sets(trees["base"], current)[0]), 37)
        self.assertEqual(len(basis["currentFinite"]), 83)
        self.assertEqual(len(modified), 38)
        self.assertEqual(len(before), 38)
        self.assertEqual(len(basis["finalFinite"]), 85)
        self.assertEqual(len(basis["protected"]), 1589)
        self.assertNotIn(P.BOUNDARY_PATH, basis["currentFinite"])
        self.assertIn(P.BOUNDARY_PATH, basis["finalFinite"])
        self.assertNotIn(P.BOUNDARY_PATH, basis["protected"])
        self.assertEqual(modified - P.changed_sets(trees["base"], current)[0], {P.BOUNDARY_PATH})
        self.assertEqual(set(proposed), set(current) | {P.SHIPPING_PATH})
        with self.assertRaisesRegex(P.Refusal, "original38"):
            P.source_basis_metadata(basis, current,
                {path: row for path, row in before.items() if path != P.BOUNDARY_PATH}, overlays, trees)
        broken = {path: dict(row) for path, row in before.items()}
        broken[P.BOUNDARY_PATH]["bytes"] += 1
        with self.assertRaises(P.Refusal):
            P.source_basis_metadata(basis, current, broken, overlays, trees)
        broken_basis = {**basis, "projections": {path: row for path, row in basis["projections"].items()
                                               if path != P.BOUNDARY_PATH}}
        with self.assertRaisesRegex(P.Refusal, "projection"):
            P.source_basis_metadata(broken_basis, current, before, overlays, trees)

    def test_29_all_other_protected_bytes_and_anchors_are_retained(self):
        basis, current, before, overlays, trees = self.scope_fixture()
        protected = basis["protected"]
        self.assertEqual(sum(row["anchor"] == P.BASE_COMMIT for row in protected.values()), 1575)
        self.assertEqual(sum(row["anchor"] == P.FEATURE_COMMIT for row in protected.values()), 10)
        self.assertEqual(sum(row["anchor"] == P.RECONCILIATION_COMMIT for row in protected.values()), 4)
        sample = [next(path for path, row in protected.items() if row["anchor"] == anchor)
                  for anchor in (P.BASE_COMMIT, P.FEATURE_COMMIT, P.RECONCILIATION_COMMIT)]
        for path in sample:
            for change in ("identity", "anchor", "drop"):
                broken = {name: {"identity": dict(row["identity"]), "anchor": row["anchor"]}
                          for name, row in protected.items()}
                if change == "identity":
                    broken[path]["identity"]["sha256"] = "0" * 64
                elif change == "anchor":
                    broken[path]["anchor"] = "0" * 40
                else:
                    broken.pop(path)
                with self.subTest(path=path, change=change), self.assertRaises(P.Refusal):
                    P.source_basis_metadata({**basis, "protected": broken}, current, before, overlays, trees)
        broader = {**overlays, sample[0]: P.identify(b"unreviewed protected replacement")}
        with self.assertRaises(P.Refusal):
            P.source_basis_metadata(basis, current, before, broader, trees)

    def test_30_only_exact_UI_bytes_and_other_package_authority_remain(self):
        for path in P.UI_BASE_RECORDS:
            for change in ("old-padding", "new-padding", "dependency", "command", "mode"):
                originals, proposed, payloads = self.package_fixture()
                if change == "old-padding":
                    originals[path] += " "
                elif change == "mode":
                    proposed[path] = {**proposed[path], "mode": "100755"}
                else:
                    raw = payloads[proposed[path]["blob"]]
                    if change == "new-padding":
                        raw += b" "
                    else:
                        value = json.loads(raw)
                        root = value["packages"][""] if path.endswith("package-lock.json") else value
                        if change == "dependency":
                            root["dependencies"]["react"] = "19.0.0"
                        else:
                            root.setdefault("scripts", {})["build"] = "echo unreviewed"
                        raw = json.dumps(value).encode()
                    proposed[path] = P.identify(raw)
                    payloads[proposed[path]["blob"]] = raw
                with self.subTest(path=path, change=change), self.assertRaises(P.Refusal):
                    P.validate_package_invariants(originals, proposed, payloads)
        for path in set(P.PACKAGES) - set(P.UI_BASE_RECORDS):
            originals, proposed, payloads = self.package_fixture()
            value = json.loads(payloads[proposed[path]["blob"]])
            value["devDependencies"] = {"solc": "0.9.0"}
            raw = json.dumps(value).encode()
            proposed[path] = P.identify(raw)
            payloads[proposed[path]["blob"]] = raw
            with self.subTest(path=path), self.assertRaises(P.Refusal):
                P.validate_package_invariants(originals, proposed, payloads)

    def test_31_new_template_pin_and_original_fixed_facts_remain(self):
        raw = (MODULE_PATH.parent / "fixtures/reviewed-template.py.txt").read_bytes()
        self.assertEqual(len(raw), 40085)
        self.assertEqual(P.sha256(raw), "91dff54f2dbd7f6644c6a3b93540c584a964af03eadfa8170e1491d2ececa213")
        self.assertEqual(P.git_blob(raw), "ae0fd95636225d39133bd85da103e388b9debeb6")
        self.assertEqual(raw.count(P.FROZEN_BLOCK.encode()), 1)
        self.assertEqual((P.TEMPLATE_BYTES, P.TEMPLATE_SHA256), (len(raw), P.sha256(raw)))
        for invalid in (raw + b"\n", b" " * len(raw), b" " * 36032):
            with self.assertRaisesRegex(P.Refusal, "template pin"):
                P.render_bmv(invalid, {}, {}, {}, {})
        old_tree = ast.parse((MODULE_PATH.parent / "before/prepare.py").read_text())
        new_tree = ast.parse(MODULE_PATH.read_text())
        names = {"BASE_COMMIT", "BASE_TREE", "FEATURE_COMMIT", "FEATURE_TREE", "RECONCILIATION_COMMIT",
                 "RECONCILIATION_TREE", "CURRENT_COMMIT", "CURRENT_TREE", "API_ROLE_FACTS"}
        def facts(tree):
            return {node.targets[0].id: ast.dump(node.value, include_attributes=False)
                    for node in tree.body if isinstance(node, ast.Assign) and len(node.targets) == 1
                    and isinstance(node.targets[0], ast.Name) and node.targets[0].id in names}
        self.assertEqual(facts(old_tree), facts(new_tree))
        self.assertEqual(len(P.API_ROLE_FACTS), 9)
        self.assertEqual(P.CURRENT_COMMIT, "fc25d03f689dd2ed6a9afcd92e6f380ece11a23c")


    def test_32_exact_UI_guide_overlay_already_within_modified_scope(self):
        path = "docs/ui/VERSIONS.md"
        old = (MODULE_PATH.parent / "fixtures/ui-guide-before.md").read_bytes()
        new = (MODULE_PATH.parent / "fixtures/ui-guide-after.md").read_bytes()
        self.assertEqual(P.git_blob(old), "bc50c1364201e77bb7cd1ddd971040da8f3a5646")
        self.assertEqual(P.identify(new), P.FIXED_REVIEWED_OVERLAYS[path])
        self.assertEqual(new.replace(b"| next | 15.5.28 |", b"| next | 15.5.27 |"), old)
        basis, current, before, overlays, trees = self.scope_fixture()
        proposed, modified = P.source_basis_metadata(basis, current, before, overlays, trees)
        self.assertIn(path, P.changed_sets(trees["base"], current)[0])
        self.assertIn(path, basis["currentFinite"])
        self.assertIn(path, basis["finalFinite"])
        self.assertNotIn(path, basis["protected"])
        self.assertEqual(len(modified), 38)
        self.assertEqual(len(basis["finalFinite"]), 85)
        self.assertEqual(len(basis["protected"]), 1589)
        previous = ast.parse((MODULE_PATH.parent / "before-policy/prepare.py").read_text())
        def assignment(name, tree):
            return next(n.value for n in tree.body if isinstance(n, ast.Assign)
                and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and n.targets[0].id == name)
        # BOUNDARY_PATH is a named key, so compare every other literal assignment and
        # the previous overlay dictionary syntax rather than importing historical code.
        previous_dict = next(n.value for n in previous.body if isinstance(n, ast.Assign)
            and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name)
            and n.targets[0].id == "FIXED_REVIEWED_OVERLAYS")
        expected = {key.id if isinstance(key, ast.Name) else ast.literal_eval(key): ast.literal_eval(value)
                    for key, value in zip(previous_dict.keys, previous_dict.values)}
        expected[P.BOUNDARY_PATH] = expected.pop("BOUNDARY_PATH")
        # Later reviewed browser-capture corrections remain exact frozen records.
        expected["scripts/release/verify-package.py"] = {"mode": "100644", "blob": "fd8685ed9bb0fc4a3e4b6729dc2c7cbecedefed5", "bytes": 14275, "sha256": "b1536ebef5679091ca3b41ad3a192dd56aa09763a0595ddb99a43ec1ed756eca"}
        expected["scripts/release/test-discovery-release-plumbing.py"] = {"mode": "100644", "blob": "f5123723938915e2152cc944a3acd7cf7a043fe1", "bytes": 74322, "sha256": "5a460bf0f9cb76b99552847bca33da5bf7b40d8886487d1cd8fa349bffa6a2d9"}
        self.assertEqual({name: value for name, value in P.FIXED_REVIEWED_OVERLAYS.items()
                          if name != path and name not in P.ENDPOINT_CORRECTION_PATHS | P.PAGES_CORRECTION_PATHS}, expected)
        current_ast = ast.parse(MODULE_PATH.read_text())
        for name in ("TEMPLATE_SHA256", "TEMPLATE_BYTES", "BASE_COMMIT", "CURRENT_COMMIT", "API_ROLE_FACTS"):
            self.assertEqual(ast.dump(assignment(name, previous), include_attributes=False),
                             ast.dump(assignment(name, current_ast), include_attributes=False))


    def test_33_only_two_reviewed_capture_records_change_with_policy_gates_preserved(self):
        previous = ast.parse((MODULE_PATH.parent / "before-browser-capture-policy/prepare.py").read_text())
        current_ast = ast.parse(MODULE_PATH.read_text())
        def assignment(name, tree):
            return next(n.value for n in tree.body if isinstance(n, ast.Assign)
                and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and n.targets[0].id == name)
        node = assignment("FIXED_REVIEWED_OVERLAYS", previous)
        prior = {(P.BOUNDARY_PATH if isinstance(key, ast.Name) else ast.literal_eval(key)): ast.literal_eval(value)
                 for key, value in zip(node.keys, node.values)}
        changed = {path for path in prior if prior[path] != P.FIXED_REVIEWED_OVERLAYS[path]}
        self.assertEqual(changed, {"scripts/release/verify-package.py",
                                  "scripts/release/test-discovery-release-plumbing.py"})
        self.assertEqual(set(prior), set(P.FIXED_REVIEWED_OVERLAYS) - P.ENDPOINT_CORRECTION_PATHS - P.PAGES_CORRECTION_PATHS)
        for path in changed:
            self.assertEqual(P.FIXED_CORRECTION_PROVENANCE[path], "0d790835a4b2346034533f4e63d70e18b2f1570f")
        for name in ("TEMPLATE_SHA256", "TEMPLATE_BYTES", "BASE_COMMIT", "CURRENT_COMMIT",
                     "API_ROLE_FACTS", "FALSE_FLAGS"):
            self.assertEqual(ast.dump(assignment(name, previous), include_attributes=False),
                             ast.dump(assignment(name, current_ast), include_attributes=False))
        for name in ("source_basis_metadata", "verify_corpus_bytes", "validate_package_invariants", "make_packet"):
            old = next(n for n in previous.body if isinstance(n, ast.FunctionDef) and n.name == name)
            new = next(n for n in current_ast.body if isinstance(n, ast.FunctionDef) and n.name == name)
            self.assertEqual(ast.dump(old, include_attributes=False), ast.dump(new, include_attributes=False))
        basis, current, before, overlays, trees = self.scope_fixture()
        P.source_basis_metadata(basis, current, before, overlays, trees)
        self.assertEqual((len(before), len(basis["finalFinite"]), len(basis["protected"])), (38, 85, 1589))


    def test_34_latest_rerun_refuses_even_when_original_attempt_matches(self):
        producer = {"runId": 17, "runAttempt": 1, "workflowId": 23, "headCommit": "a" * 40,
                    "checkoutCommit": "a" * 40}
        attempt = {"id": 17, "run_attempt": 1, "workflow_id": 23, "head_sha": "a" * 40,
                   "head_branch": "main", "event": "push", "path": P.BROWSER_WORKFLOW,
                   "status": "completed", "conclusion": "success",
                   "repository": {"full_name": P.ALPHA_REPOSITORY},
                   "head_repository": {"full_name": P.ALPHA_REPOSITORY},
                   "jobs_url": "owned/attempts/1/jobs", "logs_url": "owned/attempts/1/logs"}
        latest = json.loads(json.dumps(attempt))
        latest.update(jobs_url="owned/jobs", logs_url="owned/logs")
        P.validate_run_identity(latest, producer, "latest")
        P.validate_run_identity(attempt, producer, "attempt")
        self.assertNotEqual(latest, attempt)
        for key, bad in (("run_attempt", 2), ("run_attempt", True), ("run_attempt", 1.0),
                         ("head_sha", "b" * 40), ("head_branch", "other"), ("event", "pull_request"),
                         ("status", "in_progress"), ("conclusion", "failure"),
                         ("repository", []), ("head_repository", {"full_name": "other/repository"})):
            broken = {**latest, key: bad}
            with self.subTest(field=key, value=bad), self.assertRaises(P.Refusal):
                P.validate_run_identity(broken, producer, "latest")
        class NoPacketRead(dict):
            def __getitem__(self, key):
                raise AssertionError("A newer attempt must refuse before reading packet bodies")
        snapshots = {role: {} for role in P.FRESH_SNAPSHOT_ROLES}
        snapshots.update(run=attempt, **{"latest-run": {**latest, "run_attempt": 2}})
        with self.assertRaisesRegex(P.Refusal, "Latest browser producer"):
            P.verify_packet_metadata({"browser": {"producer": producer}}, NoPacketRead(), snapshots)
        self.assertEqual(attempt["run_attempt"], 1)
        with self.assertRaises(P.Refusal):
            P.verify_packet_metadata({"browser": {"producer": producer}}, NoPacketRead(),
                                     {name: value for name, value in snapshots.items() if name != "latest-run"})

    def test_35_exact_attempt_endpoints_and_only_reviewed_function_changes(self):
        producer = {"runId": 17, "runAttempt": 1, "headCommit": "a" * 40, "checkoutCommit": "a" * 40}
        prefix = "https://api.github.com/repos/" + P.ALPHA_REPOSITORY
        run = prefix + "/actions/runs/17"
        expected = {"run": run + "/attempts/1", "latest-run": run,
                    "jobs": run + "/attempts/1/jobs?per_page=100&page=1",
                    "artifacts": run + "/artifacts?per_page=100&page=1",
                    "checkout-commit": prefix + "/git/commits/" + "a" * 40,
                    "public-commit": prefix + "/git/commits/" + "a" * 40}
        self.assertEqual(P.fresh_snapshot_urls(producer, "a" * 40), expected)
        self.assertEqual(set(expected), P.FRESH_SNAPSHOT_ROLES)
        self.assertEqual(len(P.SIDECARS), 5)
        self.assertEqual(len(P.COMMON_SEVENTEEN), 17)
        self.assertEqual(len(P.FRESH_SNAPSHOT_ROLES), 6)
        for wrong in (2, True, 1.0):
            with self.assertRaises(P.Refusal):
                P.fresh_snapshot_urls({**producer, "runAttempt": wrong}, "a" * 40)
        for bad_url in (run, run + "/attempts/2", run + "/attempts/1?extra=1", "https://other.invalid/run"):
            reference = {"path": "meta/fresh-run.json", "bytes": 2,
                         "sha256": P.sha256(b"{}"), "url": bad_url}
            with self.assertRaises(P.Refusal):
                P.file_reference(reference, locator="meta/fresh-run.json", expected_url=expected["run"])
        previous = ast.parse((MODULE_PATH.parent / "before-attempt-snapshot-policy/prepare.py").read_text())
        current = ast.parse(MODULE_PATH.read_text())
        def functions(tree):
            return {node.name: ast.dump(node, include_attributes=False) for node in tree.body
                    if isinstance(node, ast.FunctionDef)}
        old, new = functions(previous), functions(current)
        self.assertEqual({name for name in old if old[name] != new.get(name)},
                         {"final_metadata", "verify_packet_metadata"})
        self.assertEqual(set(new) - set(old), {"fresh_snapshot_urls", "validate_run_identity"})
        basis, source, before, overlays, trees = self.scope_fixture()
        P.source_basis_metadata(basis, source, before, overlays, trees)
        self.assertEqual((len(before), len(basis["finalFinite"]), len(basis["protected"])), (38, 85, 1589))
        self.assertTrue(all(value is False for value in P.FALSE_FLAGS.values()))


    def test_36_only_two_pages_records_extend_existing_finite_scope(self):
        old = ast.parse((MODULE_PATH.parent / "before-pages-policy/prepare.py").read_bytes())
        new = ast.parse(MODULE_PATH.read_bytes())
        node = next(n.value for n in old.body if isinstance(n, ast.Assign)
                    and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name)
                    and n.targets[0].id == "FIXED_REVIEWED_OVERLAYS")
        previous = {(P.BOUNDARY_PATH if isinstance(k, ast.Name) else ast.literal_eval(k)): ast.literal_eval(v)
                    for k, v in zip(node.keys, node.values)}
        self.assertEqual(set(P.FIXED_REVIEWED_OVERLAYS) - set(previous), P.PAGES_CORRECTION_PATHS)
        self.assertEqual({p: P.FIXED_REVIEWED_OVERLAYS[p] for p in previous}, previous)
        for p in P.PAGES_CORRECTION_PATHS:
            self.assertEqual(P.FIXED_CORRECTION_PROVENANCE[p], "b195d30ba766120f369d8587ec4d0daa68604ee4")
        def functions(tree):
            return {n.name: ast.dump(n, include_attributes=False) for n in tree.body
                    if isinstance(n, ast.FunctionDef)}
        self.assertEqual(functions(old), functions(new))
        for name in ("API_ROLE_FACTS", "TEMPLATE_BYTES", "TEMPLATE_SHA256", "CEILINGS", "FALSE_FLAGS",
                     "SIDECARS", "FRESH_SNAPSHOT_ROLES", "COMMON_SEVENTEEN"):
            def value(tree):
                return next(n.value for n in tree.body if isinstance(n, ast.Assign)
                    and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and n.targets[0].id == name)
            self.assertEqual(ast.dump(value(old), include_attributes=False),
                             ast.dump(value(new), include_attributes=False))
        basis, current, before, overlays, trees = self.scope_fixture()
        P.source_basis_metadata(basis, current, before, overlays, trees)
        for p in P.PAGES_CORRECTION_PATHS:
            self.assertEqual(basis["currentFinite"][p]["status"], "A")
            self.assertEqual(basis["finalFinite"][p]["status"], "A")
            self.assertNotIn(p, basis["protected"])
        self.assertEqual((len(before), len(basis["finalFinite"]), len(basis["protected"])), (38, 85, 1589))


if __name__ == "__main__":
    unittest.main(verbosity=2)
