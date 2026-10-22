"""NEW unapproved Manager B/M/V data-only preparer implementation.

This owned source does not import or execute captured repository code. It has no
Git, subprocess, network, source-apply, approval or publication capability.
Final generation requires separately selected final inputs and root review.
"""
import contextlib
import hashlib
import json
import math
import os
import pathlib
import re
import stat
import time

REPOSITORY = "MontrealAI/AGIJobManager"
BASE_COMMIT = "900bb4b46cb7de7f6f69f553a5687866f978a413"
BASE_TREE = "bc42f0b295a649900667dcb1c487122726df7a02"
FEATURE_COMMIT = "68d1d3cae2e6f2d46c21e8e73311d309b2b307fd"
FEATURE_TREE = "c96140e3e0db9e47a68cab5883bb900ce9670912"
RECONCILIATION_COMMIT = "3b7e7e8a7592ff1140ec2a6d161b13156926365f"
RECONCILIATION_TREE = "bbd10c991be3d2d3936789e991e4f21550659580"
CURRENT_COMMIT = "fc25d03f689dd2ed6a9afcd92e6f380ece11a23c"
CURRENT_TREE = "4466eb1766169b212a7e860b9371bad41d626873"
TEMPLATE_SHA256 = "91dff54f2dbd7f6644c6a3b93540c584a964af03eadfa8170e1491d2ececa213"
TEMPLATE_BYTES = 40085
B_PATH = "config/discovery-release-baseline-v1.json"
M_PATH = "config/manager-discovery-release-v1.json"
V_PATH = "scripts/release/discovery-release-profile.py"
SHIPPING_PATH = "config/discovery-release-alpha-source-v1.json"
BROWSER_PATH = "config/discovery-release-browser-artifact-v1.json"
CONTROLS = frozenset((B_PATH, M_PATH, V_PATH))
FROZEN_BLOCK = (
    "# BEGIN FROZEN DISCOVERY DELTA\n"
    "BASELINE_SHA256 = ''\nMODIFIED = {}\nADDITIONS = {}\n"
    "PROJECTIONS = {}\nPROTECTED = {}\n"
    "# END FROZEN DISCOVERY DELTA\n"
)
CEILINGS = {
    "sourceEntries": 2048, "treeEntries": 4096,
    "publicTreeEntries": 8192, "publicTreeLeaves": 8192,
    "individualSourceBytes": 32000000, "totalSourceBytes": 128000000,
    "individualMetadataBytes": 8000000,
    "totalOriginalAndBasisMetadataBytes": 32000000,
    "jsonDepth": 32, "jsonNodesPerDocument": 200000,
    "pathUtf8Bytes": 512, "pathDepth": 16,
    "modifiedPaths": 128, "addedPaths": 128, "protectedPaths": 2048,
    "totalBeforeImagesBytes": 16000000,
    "totalProjectionEncodedBytes": 32000000, "projectionEditsPerPath": 256,
    "packetBytes": 64000000,
}
FALSE_FLAGS = {
    "sourceReviewed": False, "releaseQualified": False,
    "publicationApproved": False, "executionApproved": False,
    "nativeExecutionQualified": False,
}
HISTORICAL_CASE_GROUPS = frozenset(frozenset(group) for group in (
    ("docs/AGIJOBMANAGER.md", "docs/AGIJobManager.md"),
    ("docs/ARCHITECTURE.md", "docs/architecture.md"),
    ("docs/CONTRACTS/AGIJobManager.md", "docs/contracts/AGIJobManager.md"),
    ("docs/TESTING.md", "docs/Testing.md"),
    ("docs/CONTRACTS", "docs/contracts"),
    ("docs/DEPLOYMENT", "docs/deployment"),
))
READ_CHUNK = 1048576


class Refusal(ValueError):
    """Bounded preparation refusal; it conveys no qualification decision."""


class CommitUncertain(RuntimeError):
    """An exclusive final link may exist; never retry or report clean refusal."""


def need(condition, message):
    if not condition:
        raise Refusal(message)


def integer(value, maximum=(1 << 63) - 1, minimum=0):
    need(type(value) is int and minimum <= value <= maximum, "Invalid bounded integer")
    return value


def text(value, maximum=8000000, nonempty=True):
    need(type(value) is str and (value != "" or not nonempty), "Invalid string")
    try:
        raw = value.encode("utf-8", "strict")
    except UnicodeError as error:
        raise Refusal("Invalid Unicode") from error
    need(len(raw) <= maximum, "String exceeds bound")
    return value


def exact(value, keys):
    need(type(value) is dict and set(value) == set(keys), "Unexpected object fields")
    return value


def hex_string(value, digits):
    need(type(value) is str and re.fullmatch("[0-9a-f]{" + str(digits) + "}", value),
         "Invalid hexadecimal identity")
    return value


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def git_blob(raw):
    need(type(raw) is bytes, "Blob input is not bytes")
    return hashlib.sha1(b"blob " + str(len(raw)).encode("ascii") + b"\0" + raw).hexdigest()


def _parse_integer(literal):
    need(len(literal) <= 20, "JSON integer exceeds encoded bound")
    value = int(literal)
    need(-(1 << 63) <= value <= (1 << 63) - 1, "JSON integer exceeds bound")
    return value


def _parse_float(literal):
    need(len(literal) <= 64, "JSON float exceeds encoded bound")
    value = float(literal)
    need(math.isfinite(value), "Nonfinite JSON number")
    return value


def _constant(_literal):
    raise Refusal("Nonfinite JSON constant")


def _pairs(rows):
    result = {}
    for key, value in rows:
        need(key not in result, "Duplicate JSON field")
        result[key] = value
    return result


def strict_json(raw, maximum=8000000, depth=32, nodes=200000):
    need(type(raw) is bytes and len(raw) <= maximum, "JSON bytes exceed bound")
    try:
        value = raw.decode("utf-8", "strict")
    except UnicodeError as error:
        raise Refusal("JSON is not UTF-8") from error
    level = 0
    quoted = escaped = False
    for character in value:
        if quoted:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quoted = False
        elif character == '"':
            quoted = True
        elif character in "[{":
            level += 1
            need(level <= depth, "JSON nesting exceeds bound")
        elif character in "]}":
            level -= 1
            need(level >= 0, "JSON nesting is invalid")
    need(level == 0 and not quoted, "JSON structure is incomplete")
    try:
        result = json.loads(value, object_pairs_hook=_pairs, parse_int=_parse_integer,
                            parse_float=_parse_float, parse_constant=_constant)
    except (ValueError, TypeError, RecursionError) as error:
        raise Refusal("Invalid strict JSON") from error
    pending = [result]
    observed = 0
    while pending:
        item = pending.pop()
        observed += 1
        need(observed <= nodes, "JSON node count exceeds bound")
        if type(item) is dict:
            for key, child in item.items():
                text(key, maximum, nonempty=False)
                pending.append(child)
        elif type(item) is list:
            pending.extend(item)
        elif type(item) is str:
            text(item, maximum, nonempty=False)
        else:
            need(item is None or type(item) in (bool, int, float), "Invalid JSON type")
            need(type(item) is not float or math.isfinite(item), "Nonfinite JSON number")
    return result


def json_bytes(value, maximum=64000000, pretty=False):
    """Bound emitted JSON while encoding, including escaping expansion."""
    encoder = json.JSONEncoder(ensure_ascii=False, allow_nan=False, sort_keys=True,
                               indent=2 if pretty else None,
                               separators=None if pretty else (",", ":"))
    parts, total = [], 0
    try:
        for piece in encoder.iterencode(value):
            raw = piece.encode("utf-8", "strict")
            total += len(raw)
            need(total + 1 <= maximum, "Encoded JSON exceeds bound")
            parts.append(raw)
    except (ValueError, TypeError, UnicodeError, RecursionError) as error:
        raise Refusal("Cannot encode strict JSON") from error
    return b"".join(parts) + b"\n"


def same_json(left, right):
    """Canonical JSON retains int/float/bool type distinctions."""
    return json_bytes(left) == json_bytes(right)


def virtual_path(value):
    value = text(value, CEILINGS["pathUtf8Bytes"])
    parts = value.split("/")
    need(not value.startswith("/") and len(parts) <= CEILINGS["pathDepth"],
         "Invalid virtual path depth")
    need(all(part not in ("", ".", "..") and part.casefold() != ".git" for part in parts),
         "Unsafe virtual path component")
    need(not any(ord(character) < 32 or ord(character) == 127 for character in value)
         and "\\" not in value and ":" not in value, "Unsafe virtual path character")
    return value


def raw_record(value, maximum=32000000):
    exact(value, ("mode", "blob", "bytes", "sha256"))
    need(value["mode"] in ("100644", "100755", "120000"), "Unsupported virtual mode")
    hex_string(value["blob"], 40)
    integer(value["bytes"], maximum)
    hex_string(value["sha256"], 64)
    return value


def identify(raw, mode="100644"):
    need(mode in ("100644", "100755", "120000"), "Unsupported virtual mode")
    return {"mode": mode, "blob": git_blob(raw), "bytes": len(raw), "sha256": sha256(raw)}


def matches(raw, identity):
    raw_record(identity)
    need(identify(raw, identity["mode"]) == identity, "Raw payload identity differs")


def virtual_nodes(entries):
    nodes, leaves = set(), set(entries)
    for name in entries:
        virtual_path(name)
        parts = name.split("/")
        for end in range(1, len(parts) + 1):
            node = "/".join(parts[:end])
            need(end == len(parts) or node not in leaves,
                 "Virtual file is a directory ancestor")
            nodes.add(node)
    return nodes


def alias_groups(entries):
    groups = {}
    for name in virtual_nodes(entries):
        groups.setdefault(name.casefold(), set()).add(name)
    return frozenset(frozenset(group) for group in groups.values() if len(group) > 1)


def historical_aliases(base, current, proposed):
    """Only exact inherited groups; all participating leaves retain fixed identities."""
    need(alias_groups(base) == HISTORICAL_CASE_GROUPS
         and alias_groups(current) == HISTORICAL_CASE_GROUPS
         and alias_groups(proposed) == HISTORICAL_CASE_GROUPS,
         "Historical virtual case groups differ")
    for group in HISTORICAL_CASE_GROUPS:
        for node in group:
            for path, identity in base.items():
                if path == node or path.startswith(node + "/"):
                    need(path in current and path in proposed
                         and current[path] == identity and proposed[path] == identity,
                         "Historical virtual alias identity changed")


def git_tree(entries, maximum=4096):
    """Return root and every directory object; names are exact case-sensitive Git names."""
    need(type(entries) is dict and 0 < len(entries) <= maximum, "Invalid tree inventory")
    virtual_nodes(entries)
    root = {}
    for path, record in entries.items():
        exact(record, ("mode", "blob"))
        need(record["mode"] in ("100644", "100755", "120000"), "Unsupported Git leaf mode")
        hex_string(record["blob"], 40)
        branch = root
        pieces = path.split("/")
        for part in pieces[:-1]:
            branch = branch.setdefault(part, {})
            need(type(branch) is dict, "Git path collision")
        need(pieces[-1] not in branch, "Duplicate Git path")
        branch[pieces[-1]] = (record["mode"], record["blob"])
    trees = {}

    def visit(branch, prefix):
        payload = []
        for name, child in sorted(branch.items(),
                                  key=lambda item: item[0].encode("utf8")
                                  + (b"/" if type(item[1]) is dict else b"")):
            if type(child) is dict:
                mode, oid = "40000", visit(child, prefix + name + "/")
            else:
                mode, oid = child
            payload.append(mode.encode("ascii") + b" " + name.encode("utf8")
                           + b"\0" + bytes.fromhex(oid))
        raw = b"".join(payload)
        oid = hashlib.sha1(b"tree " + str(len(raw)).encode("ascii") + b"\0" + raw).hexdigest()
        trees[prefix.rstrip("/")] = oid
        return oid
    return visit(root, ""), trees


def projection_metadata(edits, original_byte_bound):
    need(type(edits) is list and len(edits) <= CEILINGS["projectionEditsPerPath"],
         "Projection edit count exceeds bound")
    last, encoded = 0, 0
    for edit in edits:
        exact(edit, ("start", "before", "after"))
        start = integer(edit["start"], original_byte_bound)
        before, after = text(edit["before"], nonempty=False), text(edit["after"], nonempty=False)
        need(start >= last, "Projection edits overlap or are unordered")
        last = start + len(before)
        need(last <= original_byte_bound, "Projection offset exceeds original bound")
        encoded += len(before.encode("utf8")) + len(after.encode("utf8"))
    need(encoded <= CEILINGS["totalProjectionEncodedBytes"], "Projection strings exceed bound")


def apply_projection(original, edits):
    need(type(original) is str, "Projection original is not text")
    projection_metadata(edits, len(original.encode("utf8")))
    last = 0
    for edit in edits:
        start, before = edit["start"], edit["before"]
        need(start >= last and start <= len(original)
             and original[start:start + len(before)] == before, "Projection before text differs")
        last = start + len(before)
    result = original
    for edit in reversed(edits):
        start, before = edit["start"], edit["before"]
        result = result[:start] + edit["after"] + result[start + len(before):]
    inverse = result
    for edit in edits:
        start = edit["start"]
        need(inverse[start:start + len(edit["after"])] == edit["after"],
             "Projection inverse text differs")
        inverse = inverse[:start] + edit["before"] + inverse[start + len(edit["after"]):]
    need(inverse == original, "Projection inverse does not restore original")
    return result


def snapshot(details):
    return tuple(getattr(details, key) for key in
                 ("st_dev", "st_ino", "st_mode", "st_size", "st_mtime_ns", "st_ctime_ns"))


def absolute_path(value):
    value = text(value, 4096)
    need(value.startswith("/") and value != "/" and "\\" not in value
         and not any(ord(character) < 32 or ord(character) == 127 for character in value),
         "Invalid absolute physical path")
    parts = value.split("/")[1:]
    need(len(parts) <= 64 and all(part not in ("", ".", "..") for part in parts),
         "Unsafe absolute physical components")
    return value


def open_directory(value):
    """Pin every absolute ancestor with no-follow directory descriptors."""
    value = absolute_path(value)
    need(hasattr(os, "O_NOFOLLOW") and hasattr(os, "O_DIRECTORY")
         and hasattr(os, "O_NONBLOCK"), "Required no-follow platform support unavailable")
    descriptor = os.open("/", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in value.split("/")[1:]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                            dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        return descriptor
    except BaseException:
        os.close(descriptor)
        raise


def private_directory(descriptor):
    value = os.fstat(descriptor)
    need(stat.S_ISDIR(value.st_mode) and value.st_uid == os.getuid()
         and stat.S_IMODE(value.st_mode) == 0o700, "Input/output root is not owned private0700")
    return snapshot(value)


def relative_locator(value):
    """Physical locators are selected metadata paths or flat lowercase Git-OID CAS names."""
    virtual_path(value)
    need(value.isascii() and value == value.lower(), "Physical locator is not lowercase ASCII")
    return value


class Capture:
    """Bounded no-follow physical data capture. No repository discovery or traversal."""

    def __init__(self, root):
        self.root = absolute_path(root)
        self.fd = open_directory(root)
        try:
            self.initial = private_directory(self.fd)
        except BaseException:
            os.close(self.fd)
            raise
        self.observed = {}
        self.expected_closure = None

    def close(self):
        if self.fd is not None:
            os.close(self.fd)
            self.fd = None

    def _parent(self, name):
        relative_locator(name)
        descriptor = os.dup(self.fd)
        try:
            pieces = name.split("/")
            for piece in pieces[:-1]:
                child = os.open(piece, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                                dir_fd=descriptor)
                os.close(descriptor)
                descriptor = child
            return descriptor, pieces[-1]
        except BaseException:
            os.close(descriptor)
            raise

    def preflight(self, name, length, maximum):
        integer(length, maximum)
        parent, leaf = self._parent(name)
        try:
            details = os.stat(leaf, dir_fd=parent, follow_symlinks=False)
            need(stat.S_ISREG(details.st_mode) and stat.S_IMODE(details.st_mode) == 0o600
                 and details.st_uid == os.getuid() and details.st_size == length,
                 "Physical payload metadata differs")
            value = snapshot(details)
            if name in self.observed:
                need(self.observed[name] == value, "Repeated locator identity changed")
            self.observed[name] = value
            return value
        finally:
            os.close(parent)

    def read(self, name, length, digest, maximum):
        hex_string(digest, 64)
        expected = self.preflight(name, length, maximum)
        parent, leaf = self._parent(name)
        descriptor = None
        try:
            descriptor = os.open(leaf, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                                 dir_fd=parent)
            need(snapshot(os.fstat(descriptor)) == expected, "Input changed before read")
            blocks, total = [], 0
            while True:
                block = os.read(descriptor, min(READ_CHUNK, length - total + 1))
                if not block:
                    break
                total += len(block)
                need(total <= length, "Input grew during read")
                blocks.append(block)
            raw = b"".join(blocks)
            need(total == length and sha256(raw) == digest, "Input raw identity differs")
            need(snapshot(os.fstat(descriptor)) == expected
                 and snapshot(os.stat(leaf, dir_fd=parent, follow_symlinks=False)) == expected,
                 "Input changed during read")
            return raw
        finally:
            if descriptor is not None:
                os.close(descriptor)
            os.close(parent)

    def closure(self, expected, max_nodes=8192, max_depth=20, seconds=15):
        """Stream enumeration with bounds during consumption, including empty directories."""
        need(type(expected) is set, "Closure requires an exact path set")
        allowed_dirs = set()
        for name in expected:
            relative_locator(name)
            parts = name.split("/")
            allowed_dirs.update("/".join(parts[:end]) for end in range(1, len(parts)))
        observed, node_count, deadline = set(), 0, time.monotonic() + seconds

        def walk(descriptor, prefix, depth):
            nonlocal node_count
            need(depth <= max_depth, "Capture directory depth exceeds bound")
            with os.scandir(descriptor) as rows:
                for row in rows:
                    node_count += 1
                    need(node_count <= max_nodes and time.monotonic() <= deadline,
                         "Capture traversal exceeds bound")
                    path = prefix + row.name
                    details = row.stat(follow_symlinks=False)
                    if stat.S_ISDIR(details.st_mode):
                        need(path in allowed_dirs, "Unexpected capture directory")
                        child = os.open(row.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                                        dir_fd=descriptor)
                        try:
                            need(snapshot(os.fstat(child)) == snapshot(details),
                                 "Capture directory changed")
                            walk(child, path + "/", depth + 1)
                        finally:
                            os.close(child)
                    else:
                        need(path in expected and stat.S_ISREG(details.st_mode),
                             "Unexpected capture node")
                        observed.add(path)
        walk(self.fd, "", 0)
        need(observed == expected, "Capture closure differs")
        self.expected_closure = (frozenset(expected), max_nodes, max_depth, seconds)

    def recheck(self):
        need(snapshot(os.fstat(self.fd)) == self.initial, "Capture root metadata changed")
        fresh = open_directory(self.root)
        try:
            need(snapshot(os.fstat(fresh)) == self.initial, "Capture root pathname changed")
        finally:
            os.close(fresh)
        for name, expected in self.observed.items():
            parent, leaf = self._parent(name)
            try:
                need(snapshot(os.stat(leaf, dir_fd=parent, follow_symlinks=False)) == expected,
                     "Captured input pathname changed")
            finally:
                os.close(parent)
        if self.expected_closure is not None:
            expected, max_nodes, max_depth, seconds = self.expected_closure
            self.closure(set(expected), max_nodes, max_depth, seconds)


# Concrete current-source anchors are fixed, independently captured public facts.
NATIVE_TEN = frozenset((
    "config/discovery-lab-alpha-source.json",
    "config/discovery-lab-source-baseline-v1.json",
    "config/discovery-lab-source-candidate-v1.json",
    "scripts/integrations/discovery-lab-contract.mjs",
    "scripts/integrations/discovery-lab-native-test.mjs",
    "scripts/integrations/discovery-lab-work-request.mjs",
    "scripts/integrations/discovery-lab-work-request.test.mjs",
    "scripts/integrations/fixtures/discovery-lab-request.json",
    "scripts/release/discovery-lab-profile.py",
    "scripts/release/test-discovery-lab-profile.py",
))
V2_FOUR = frozenset((
    "config/discovery-lab-source-baseline-v2.json",
    "config/discovery-lab-source-candidate-v2.json",
    "scripts/release/discovery-lab-profile-v2.py",
    "scripts/release/test-discovery-lab-profile-v2.py",
))
SIX_IO = frozenset("scripts/release/" + name for name in (
    "release_common.py", "package-release.py", "verify-package.py",
    "collect-qualification.py", "test-discovery-release-plumbing.py",
    "test-discovery-release-profile.py",
))
WORKFLOW_THREE = frozenset((
    ".github/workflows/current-state-release.yml",
    ".github/workflows/discovery-lab-receiver.yml",
    ".github/workflows/publish-discovery-v1.yml",
))
BOUNDARY_PATH = "test/buyerProtection.v095.test.js"
ENDPOINT_CORRECTION_PATHS = frozenset((
    "scripts/release/discovery-qualification.py", "scripts/release/test-discovery-qualification.py",
))
PAGES_CORRECTION_PATHS = frozenset((
    "scripts/release/pages-publication-discovery.py", "scripts/release/test-pages-publication-discovery.py",
))
PLUMBING_CORRECTION_PATH = "scripts/release/test-discovery-release-plumbing.py"
FIXED_REVIEWED_OVERLAYS = {
    "scripts/release/pages-publication-discovery.py": {"mode": "100644", "blob": "53cd6199077772d801b373cecae392a30bdf8eb6", "bytes": 10929, "sha256": "cb7dfc7cd8c4f59599bec1d3de0050994c45738ec111e3aefceed6677fa8f9bb"},
    "scripts/release/test-pages-publication-discovery.py": {"mode": "100644", "blob": "f3bad6931050742f60cbe255e855dff904b762ae", "bytes": 16782, "sha256": "280fd9e7976a001473f92a6b1f7b916126940cdab1d8e086bc061abc7928a0df"},
    "scripts/release/discovery-qualification.py": {"mode": "100644", "blob": "3608ce1e69dac5aa645071a1c0d4cabdace02f4b", "bytes": 73143, "sha256": "ecc0ba7529df30288bf370ce016f71fa5c00e25f897116fa09997b91fc19036b"},
    "scripts/release/test-discovery-qualification.py": {"mode": "100644", "blob": "bfe73cf64aaa79b8404b096adc1f46ed9c69ea13", "bytes": 84618, "sha256": "bfb41059130d8dc4fdad8d861733109f3068c8cb99aec1111e7a9c190712fb20"},
    "scripts/release/release_common.py": {"mode": "100644", "blob": "baddc9e4eb38f8efdfc2613e33513869513f6285", "bytes": 26690, "sha256": "3e605f02401825d01858a3e7241f8fd890c71804ebba1c1db42cfbc572c76f2a"},
    "scripts/release/package-release.py": {"mode": "100644", "blob": "f4131a0a905d63daa76e69040be93e0a963d9b37", "bytes": 10855, "sha256": "1a98938756b49453c308ce04236058a1c69896c45f90f299c1b0a0a5388724d4"},
    "scripts/release/verify-package.py": {"mode": "100644", "blob": "fd8685ed9bb0fc4a3e4b6729dc2c7cbecedefed5", "bytes": 14275, "sha256": "b1536ebef5679091ca3b41ad3a192dd56aa09763a0595ddb99a43ec1ed756eca"},
    "scripts/release/collect-qualification.py": {"mode": "100644", "blob": "8e393a049a2953a35955ada8c664054d8fb51012", "bytes": 11347, "sha256": "004c4b8fe7088f9f141300f02a05580a6f7621933ea36c213c67a93f4d126538"},
    "scripts/release/test-discovery-release-plumbing.py": {"mode": "100644", "blob": "16e0dec1840d4786cc1a2667f2f703370e7b134c", "bytes": 74777, "sha256": "c321cc9de4d0e223522b94a016a9d6725cb2821addc23fd6d7df2c7fcb2783b5"},
    "scripts/release/test-discovery-release-profile.py": {"mode": "100644", "blob": "b17138095b4680aa719b7b2b6198a5e50abb2c5d", "bytes": 38782, "sha256": "724a8ddebf6d948b2c73211993d91536d1fbeff11a12981f2623ef5596c7e2d7"},
    "ui/package.json": {"mode": "100644", "blob": "3019b3a9df311e2a2638aaa063e9367ed1fe5048", "bytes": 3414, "sha256": "b9fcc3da62e16dfe4e02d70190001f183d41586148f40b942ae8c2d5f05b7cad"},
    "ui/package-lock.json": {"mode": "100644", "blob": "39415b6c2f132fae7343a298b3ae348223216eec", "bytes": 530005, "sha256": "91c98066fa0d4f0c11c75a7a88fa3d3fab51632c4079e273ce59bde82156584b"},
    "docs/REFERENCE/VERSIONS.md": {"mode": "100644", "blob": "d736ba418c23e68c512c0a05c5ec6677f8005894", "bytes": 1072, "sha256": "d26f3303a4ab17eda1cfcffe179c8a97b5f5b4d888de2b7d95dd79ff962fa890"},
    "docs/ui/VERSIONS.md": {"mode": "100644", "blob": "dcf6cbe62ac2d512adbb79806254aa95bb215e67", "bytes": 457, "sha256": "d31e7fc06427643acc31615facb3f57187b64f21a18c56ba648037d10b80e2e9"},
    BOUNDARY_PATH: {"mode": "100644", "blob": "193d372831dcc88259bff04cb9ab03e2ef6b5051", "bytes": 19212, "sha256": "a775e9100d28f73bc7259d079f0d62a0e51ee08d9bc011146724610120417a6f"},
}
FIXED_CORRECTION_PROVENANCE = {
    path: "b8ff0a7df7195a0b1f132b43114422d3dfb64add"
    for path in FIXED_REVIEWED_OVERLAYS if path != BOUNDARY_PATH
}
FIXED_CORRECTION_PROVENANCE[BOUNDARY_PATH] = "1905fbe1dae8c98ed8e7e5ca55aa29e12f8c5710"
FIXED_CORRECTION_PROVENANCE["docs/ui/VERSIONS.md"] = "88b14a5b2b7c474e4c16bac8af79650adf709ab7"
FIXED_CORRECTION_PROVENANCE["scripts/release/verify-package.py"] = "0d790835a4b2346034533f4e63d70e18b2f1570f"
FIXED_CORRECTION_PROVENANCE[PLUMBING_CORRECTION_PATH] = "392db1da9c0a08c13b40009217727028f4d7ecf9"
for _endpoint_path in ENDPOINT_CORRECTION_PATHS:
    FIXED_CORRECTION_PROVENANCE[_endpoint_path] = "4d14d0a043074d8ca02828e247a2715ce3f50dc5"
for _pages_path in PAGES_CORRECTION_PATHS:
    FIXED_CORRECTION_PROVENANCE[_pages_path] = "b195d30ba766120f369d8587ec4d0daa68604ee4"
UI_BASE_RECORDS = {
    "ui/package.json": {"mode": "100644", "blob": "9af0360c06b4ffec9c474056901ab269c0f31d9a", "bytes": 3414, "sha256": "733f32d36e894adcdbf2d3da2ed12a1ef77d06622dfef3302c89dd23ea4cfd49"},
    "ui/package-lock.json": {"mode": "100644", "blob": "dc4e014f4572c6f5e555c7c16265391e1418ac53", "bytes": 530005, "sha256": "f12a33c0135afa6487cc6b7d247e885c154e7058de2230803f3e3cc314756b2c"},
}
CONTEXTUAL_OVERLAYS = WORKFLOW_THREE | frozenset((BROWSER_PATH, SHIPPING_PATH))
OVERLAY_PATHS = frozenset(FIXED_REVIEWED_OVERLAYS) | CONTEXTUAL_OVERLAYS
PACKAGES = (
    "package.json", "package-lock.json", "hardhat/package.json",
    "hardhat/package-lock.json", "ui/package.json", "ui/package-lock.json",
)
INTERMEDIATE_COMMIT = "c6552fcd16011284e8e811aebe3e969b2cd16365"
INTERMEDIATE_TREE = "192fe6d194356afef2e3ab8fede9118b78d34e2f"
API_ROLE_FACTS = {
    "base_commit": (3005, "fcb98aa31e890d2669730ee00a3b0bae45477c2dd77ccdbc293010ad7163e21f",
                    "commits", BASE_COMMIT),
    "base_tree": (466673, "3ff5f217123df61943324ac9b80b7de301bdd9c8396560d38c5c5842cdf65a54",
                  "trees", BASE_TREE),
    "feature_commit": (1173, "cfa4bab1f6921c698ebb8a8fc9eaa0af0614f0fd472e9649d42ad85b137417ea",
                       "commits", FEATURE_COMMIT),
    "feature_tree": (465109, "f03085fa76964fa6323454afaed1821aadcfa8942433a47b5c1359cb8d140ef2",
                     "trees", FEATURE_TREE),
    "reconciliation_commit": (1632, "65adadbf752f30b7ac96d2829788976c3061699b3db5a4210401bdf886bee440",
                              "commits", RECONCILIATION_COMMIT),
    "reconciliation_tree": (471363, "b33c8bfddd21928430cea86960cd0f5e6dad81c77e0f8ec87fbe4ae62e634dcb",
                            "trees", RECONCILIATION_TREE),
    "current_commit": (1788, "11a5346b3d89f2e3a33080db6eda8634d59f5cc92634864077236b53bd6209ae",
                       "commits", CURRENT_COMMIT),
    "current_tree": (479736, "0562b3b829453f6ccf8fcda273da425aea616f3cfa3e56c3db26438aa19b20a3",
                     "trees", CURRENT_TREE),
    "ancestry_commit": (1484, "ecf2edcefbaffeb426542755455c52269271b0c3da5a61789b9555eea13b8fbf",
                        "commits", INTERMEDIATE_COMMIT),
}


def git_entry(record):
    return {"mode": record["mode"], "blob": record["blob"]}


def record_map(value, maximum=2048):
    need(type(value) is dict and 0 < len(value) <= maximum, "Invalid raw record map")
    for path, record in value.items():
        virtual_path(path)
        raw_record(record)
    virtual_nodes(value)
    return value


def file_reference(value, *, locator=None, maximum=8000000, expected_url=None):
    exact(value, ("path", "bytes", "sha256", "url"))
    relative_locator(value["path"])
    if locator is not None:
        need(value["path"] == locator, "Metadata locator differs from selected role")
    integer(value["bytes"], maximum)
    hex_string(value["sha256"], 64)
    need(value["url"] is None or type(value["url"]) is str, "Invalid provenance URL")
    if expected_url is not None:
        need(value["url"] == expected_url, "Public original endpoint differs")
    return value


def read_metadata(capture, reference):
    file_reference(reference)
    raw = capture.read(reference["path"], reference["bytes"], reference["sha256"],
                       CEILINGS["individualMetadataBytes"])
    return raw, strict_json(raw)


def full_tree(value, selected_oid, *, maximum_leaves=2048, repository=REPOSITORY, public=False):
    exact(value, ("sha", "url", "tree", "truncated"))
    hex_string(selected_oid, 40)
    need(value["sha"] == selected_oid and value["truncated"] is False
         and value["url"] == "https://api.github.com/repos/" + repository + "/git/trees/" + selected_oid,
         "Full public tree identity differs")
    need(type(public) is bool, "Invalid public metadata limit selector")
    entry_limit = CEILINGS["publicTreeEntries"] if public else CEILINGS["treeEntries"]
    leaf_limit = CEILINGS["publicTreeLeaves"] if public else CEILINGS["sourceEntries"]
    need(type(maximum_leaves) is int and 0 < maximum_leaves <= leaf_limit,
         "Tree leaf limit exceeds its selected context")
    need(type(value["tree"]) is list and 0 < len(value["tree"]) <= entry_limit,
         "Public tree entry count exceeds bound")
    leaves, directories = {}, {}
    for row in value["tree"]:
        need(type(row) is dict, "Invalid public tree row")
        kind = row.get("type")
        exact(row, ("path", "mode", "type", "sha", "url", "size")
              if kind == "blob" else ("path", "mode", "type", "sha", "url"))
        path = virtual_path(row["path"])
        oid = hex_string(row["sha"], 40)
        need(path not in leaves and path not in directories, "Duplicate public tree row")
        if kind == "blob":
            need(row["mode"] in ("100644", "100755", "120000"), "Unsupported public blob mode")
            integer(row["size"])
            need(row["url"] == "https://api.github.com/repos/" + repository + "/git/blobs/" + oid,
                 "Public blob endpoint differs")
            leaves[path] = {"mode": row["mode"], "blob": oid, "bytes": row["size"]}
        else:
            need(kind == "tree" and row["mode"] == "040000"
                 and row["url"] == "https://api.github.com/repos/" + repository + "/git/trees/" + oid,
                 "Unsupported public tree object")
            directories[path] = oid
    need(0 < len(leaves) <= maximum_leaves, "Public leaf inventory exceeds bound")
    root, computed = git_tree({path: git_entry(row) for path, row in leaves.items()},
                              maximum=maximum_leaves)
    need(root == selected_oid and {p: oid for p, oid in computed.items() if p} == directories,
         "Public subtree or root serialization differs")
    return leaves


def commit_facts(value, repository, commit, tree, parents=None):
    exact(value, ("sha", "node_id", "url", "html_url", "author", "committer",
                  "tree", "message", "parents", "verification"))
    prefix = "https://api.github.com/repos/" + repository + "/git/"
    need(value["sha"] == commit and value["url"] == prefix + "commits/" + commit,
         "Public commit identity differs")
    exact(value["tree"], ("sha", "url"))
    need(value["tree"] == {"sha": tree, "url": prefix + "trees/" + tree},
         "Public commit tree differs")
    need(type(value["parents"]) is list and len(value["parents"]) <= 16,
         "Public ordered parent count differs")
    actual = []
    for parent in value["parents"]:
        exact(parent, ("sha", "url", "html_url"))
        oid = hex_string(parent["sha"], 40)
        need(parent["url"] == prefix + "commits/" + oid, "Parent endpoint differs")
        actual.append(oid)
    if parents is not None:
        need(actual == parents, "Public ordered parents differ")
    return actual


def fixed_originals(capture, references):
    need(type(references) is dict and set(references) == set(API_ROLE_FACTS),
         "Exactly nine original public roles required")
    for role, (length, digest, kind, oid) in API_ROLE_FACTS.items():
        reference = references[role]
        url = "https://api.github.com/repos/" + REPOSITORY + "/git/" + kind + "/" + oid
        if kind == "trees":
            url += "?recursive=1"
        file_reference(reference, locator="meta/" + role + ".json", expected_url=url)
        need(reference["bytes"] == length and reference["sha256"] == digest,
             "Captured original public raw identity differs")
    values = {role: read_metadata(capture, reference)[1]
              for role, reference in references.items()}
    commit_facts(values["base_commit"], REPOSITORY, BASE_COMMIT, BASE_TREE, [
        "4d4c32685eebf23b0aa35dbb45abe23ac8a261cb", "7db11b049d5b061c57c2b338994d0b7157e8cc6c"])
    commit_facts(values["feature_commit"], REPOSITORY, FEATURE_COMMIT, FEATURE_TREE,
                 ["c8e590b5bdd7a8c69a14ef159df96663ed232f01"])
    commit_facts(values["reconciliation_commit"], REPOSITORY, RECONCILIATION_COMMIT,
                 RECONCILIATION_TREE, [FEATURE_COMMIT, BASE_COMMIT])
    commit_facts(values["ancestry_commit"], REPOSITORY, INTERMEDIATE_COMMIT,
                 INTERMEDIATE_TREE, [RECONCILIATION_COMMIT])
    commit_facts(values["current_commit"], REPOSITORY, CURRENT_COMMIT,
                 CURRENT_TREE, [INTERMEDIATE_COMMIT])
    trees = {
        "base": full_tree(values["base_tree"], BASE_TREE, maximum_leaves=2048),
        "feature": full_tree(values["feature_tree"], FEATURE_TREE, maximum_leaves=2048),
        "reconciliation": full_tree(values["reconciliation_tree"], RECONCILIATION_TREE,
                                    maximum_leaves=2048),
        "current": full_tree(values["current_tree"], CURRENT_TREE, maximum_leaves=2048),
    }
    need(len(trees["base"]) == 1613 and len(trees["current"]) == 1660,
         "Fixed public source path inventory differs")
    return trees


def changed_sets(base, current):
    need(set(base) <= set(current), "Selected source deletes original paths")
    modified = {path for path in base if git_entry(base[path]) != git_entry(current[path])}
    added = set(current) - set(base)
    return modified, added


def finite_records(value, current, base):
    need(type(value) is dict and len(value) <= 256, "Invalid finite map")
    for path, item in value.items():
        virtual_path(path)
        exact(item, ("status", "before", "after", "reason"))
        need(path in current and path not in CONTROLS, "Finite path is missing or a control")
        raw_record(item["after"])
        need(item["after"] == current[path], "Finite after-image differs from full map")
        need(text(item["reason"], 32000).strip(), "Finite reason is empty")
        if path in base:
            need(item["status"] == "M" and item["before"] == git_entry(base[path]),
                 "Finite modified before-image differs")
        else:
            need(item["status"] == "A" and item["before"] is None,
                 "Finite addition before-image differs")


def reviewed_overlay_records(overlays):
    record_map(overlays)
    need(set(overlays) == OVERLAY_PATHS, "Exact reviewed contextual/final overlay set differs")
    for path, identity in FIXED_REVIEWED_OVERLAYS.items():
        need(overlays[path] == identity, "Fixed reviewed correction differs: " + path)


def source_basis_metadata(basis, current, before, overlays, trees):
    """Validate every authority-bearing record before opening source CAS payloads."""
    exact(basis, ("schema", "currentFinite", "finalFinite", "protected", "projections"))
    need(basis["schema"] == "manager/externally-selected-bmv-basis/v1", "Basis schema differs")
    record_map(current)
    record_map(before)
    reviewed_overlay_records(overlays)
    need(set(current) == set(trees["current"]), "Complete current map paths differ")
    for path, identity in current.items():
        need({key: identity[key] for key in ("mode", "blob", "bytes")}
             == trees["current"][path], "Current map differs from public tree")
    base = trees["base"]
    modified, added = changed_sets(base, current)
    need(len(modified) == 37 and len(added) == 47 and V_PATH in added
         and B_PATH not in current and M_PATH not in current and SHIPPING_PATH not in current,
         "Fixed current source delta differs")
    finite_records(basis["currentFinite"], current, base)
    need(set(basis["currentFinite"]) == modified | (added - {V_PATH}),
         "Current finite83 set differs")
    proposed = {**current, **overlays}
    final_modified, final_added = changed_sets(base, proposed)
    need(final_modified == modified | {BOUNDARY_PATH} and len(final_modified) == 38
         and final_added == added | {SHIPPING_PATH},
         "Proposed final source boundary differs")
    need(set(before) == final_modified, "Independent original38 inventory differs")
    for path, identity in before.items():
        need(git_entry(identity) == git_entry(base[path]) and identity["bytes"] == base[path]["bytes"],
             "Original38 record differs from original900")
    need(sum(item["bytes"] for item in before.values()) <= CEILINGS["totalBeforeImagesBytes"],
         "Original38 byte budget exceeded")
    finite_records(basis["finalFinite"], proposed, base)
    need(set(basis["finalFinite"]) == final_modified | (final_added - {V_PATH})
         and len(basis["finalFinite"]) == 85, "Externally selected final finite85 differs")
    unchanged = {path for path in base if path not in final_modified}
    protected = basis["protected"]
    need(type(protected) is dict and set(protected) == unchanged | NATIVE_TEN | V2_FOUR
         and len(protected) == 1589 and not set(protected) & final_modified,
         "New1589 protected selection differs")
    need(not set(overlays) & set(protected), "Overlay changes a protected path")
    for path, item in protected.items():
        exact(item, ("identity", "anchor"))
        raw_record(item["identity"])
        anchor = (BASE_COMMIT if path in unchanged else
                  FEATURE_COMMIT if path in NATIVE_TEN else RECONCILIATION_COMMIT)
        original = (base if anchor == BASE_COMMIT else trees["feature"]
                    if anchor == FEATURE_COMMIT else trees["reconciliation"])
        need(item["anchor"] == anchor and path in original
             and git_entry(item["identity"]) == git_entry(original[path])
             and item["identity"]["bytes"] == original[path]["bytes"]
             and item["identity"] == current[path] == proposed[path],
             "Protected fixed provenance or raw identity differs")
    need(type(basis["projections"]) is dict and set(basis["projections"]) == final_modified,
         "Every modified path requires an external projection")
    for path, edits in basis["projections"].items():
        projection_metadata(edits, before[path]["bytes"])
    historical_aliases({p: git_entry(r) for p, r in base.items()},
                       {p: git_entry(r) for p, r in current.items()},
                       {p: git_entry(r) for p, r in proposed.items()})
    return proposed, final_modified


def verify_corpus_bytes(current, before, overlays, basis, trees, payloads):
    for collection in (current, before, overlays):
        for identity in collection.values():
            need(identity["blob"] in payloads, "Selected raw source body missing")
            matches(payloads[identity["blob"]], identity)
    proposed, modified = source_basis_metadata(basis, current, before, overlays, trees)
    original_text = {}
    for path in modified:
        try:
            old = payloads[before[path]["blob"]].decode("utf8", "strict")
            after = payloads[proposed[path]["blob"]].decode("utf8", "strict")
        except UnicodeError as error:
            raise Refusal("Selected modified source is not exact UTF-8") from error
        need(apply_projection(old, basis["projections"][path]) == after,
             "Final reviewed projection differs from source bytes")
        original_text[path] = old
    for path, identity in proposed.items():
        if identity["mode"] == "120000":
            need(path == "hardhat/contracts" and payloads[identity["blob"]] == b"../contracts"
                 and identity["blob"] == "0989a2ba8bf5b5d438c628dbdde24034c59c711f",
                 "Unexpected virtual symlink data")
    validate_package_invariants(original_text, proposed, payloads)
    inverse = {path: git_entry(item) for path, item in proposed.items()
               if path not in (set(basis["finalFinite"]) - modified) | CONTROLS}
    inverse.update({path: git_entry(before[path]) for path in modified})
    need(inverse == {path: git_entry(row) for path, row in trees["base"].items()}
         and git_tree(inverse)[0] == BASE_TREE, "Inverse does not reproduce original900")
    return proposed, original_text


def validate_package_invariants(original_text, proposed, payloads):
    for path in (*PACKAGES, "config/usdc-deployment.json"):
        need(path in original_text, "Version-only original is missing")
        old_raw = original_text[path].encode("utf8")
        after_raw = payloads[proposed[path]["blob"]]
        if path in UI_BASE_RECORDS:
            matches(old_raw, UI_BASE_RECORDS[path])
            need(proposed[path] == FIXED_REVIEWED_OVERLAYS[path],
                 "UI dependency correction record differs")
            matches(after_raw, FIXED_REVIEWED_OVERLAYS[path])
        old = strict_json(old_raw)
        after = strict_json(after_raw)
        need(type(old) is dict and type(after) is dict and after.get("version") == "1.20.0",
             "Software version label differs")
        after["version"] = old.get("version")
        if path.endswith("package-lock.json"):
            need(type(after.get("packages")) is dict and type(after["packages"].get("")) is dict
                 and after["packages"][""].get("version") == "1.20.0",
                 "Lock root version differs")
            after["packages"][""]["version"] = old["packages"][""]["version"]
        if path not in UI_BASE_RECORDS:
            need(same_json(old, after), "Dependency/command/compiler/deployment authority changed")


ALPHA_REPOSITORY = "MontrealAI/AGI-Alpha-Agent-v0"
CATALOG_PATH = "docs/successor/capabilities/sources.json"
INSPECTOR_PATH = "examples/successor-capability/discovery-lab-inspector.mjs"
LICENSE_SHA256 = "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4"
ALPHA_REQUIRED = frozenset("examples/successor-capability/" + name + ".mjs" for name in (
    "discovery-lab", "discovery-lab-checker", "discovery-lab-contract",
    "discovery-lab-history", "discovery-lab-artifacts", "workspace",
))
BROWSER_PREFIX = "discovery-continuation/"
BROWSER_MEMBERS = frozenset(("source.json", "exact-checkout.json")) | frozenset(
    BROWSER_PREFIX + name for name in (
        "served/index.html", "served/sources.json", "fleet-browser-workspace.json",
        "fleet-browser-request.json", "jobs-browser-workspace.json",
        "jobs-browser-request.json", "browser-native-requests.json", "journey.json",
        "fleet-native/native-proof.json",
    ))
SIDECARS = frozenset(("run", "jobs", "artifacts", "checkout-commit", "public-commit"))
FRESH_SNAPSHOT_ROLES = SIDECARS | frozenset(("latest-run",))
COMMON_SEVENTEEN = BROWSER_MEMBERS | {"CUSTODY.json"} | {
    "metadata/" + name + ".json" for name in SIDECARS}
BROWSER_WORKFLOW = ".github/workflows/successor-capability.yml"
JOURNEY_CHECKS = [
    "saved-freeze", "separate-bank", "reload-before-execution", "actual-frozen-invocations",
    "all-seven-arms", "losses-and-ties", "saved-reservation", "real-task-NOT_RUN",
    "malformed-receiver-rejected-without-history-change", "docket-download",
    "reload-after-result", "39-recorded-contracts", "accessibility", "320px",
]


def canonical_json(value):
    return json_bytes(value)[:-1]


def require_values(value, expected, message):
    need(type(value) is dict, message)
    for key, wanted in expected.items():
        need(key in value and same_json(value[key], wanted), message)


def positive(value):
    return integer(value, minimum=1)


def shipping_metadata(pin, accepted):
    exact(pin, ("schema", "repository", "commit", "tree", "sourceHash", "catalogPath",
                "catalogSha256", "files", "qualification"))
    need(pin["schema"] == "successor/discovery-lab-alpha-source/v1"
         and pin["repository"] == ALPHA_REPOSITORY and pin["commit"] == accepted
         and pin["catalogPath"] == CATALOG_PATH
         and pin["qualification"] == "PENDING_FINAL_SOURCE_NATIVE_COMPATIBILITY",
         "Shipping source pin is unavailable or differs")
    hex_string(pin["tree"], 40)
    for key in ("sourceHash", "catalogSha256"):
        hex_string(pin[key], 64)
    need(type(pin["files"]) is dict and 0 < len(pin["files"]) <= 257
         and ALPHA_REQUIRED | {INSPECTOR_PATH} <= set(pin["files"]),
         "Shipping source closure is incomplete")
    for path, digest in pin["files"].items():
        virtual_path(path)
        hex_string(digest, 64)


def browser_metadata(pin, accepted, alpha_tree):
    exact(pin, ("schema", "state", "repository", "workflowPath", "producer", "artifact",
                "sourceHash", "pageSha256", "catalogSha256", "inventorySha256", "members",
                "campaignDigest", "missionId", "workspaceSha256", "requestSha256", "transport"))
    need(pin["schema"] == "manager/discovery-browser-input-artifact/v1"
         and pin["state"] == "REVIEWED_AUTHENTICATED_ALPHA_ARTIFACT"
         and pin["repository"] == ALPHA_REPOSITORY and pin["workflowPath"] == BROWSER_WORKFLOW,
         "Final browser pin is absent, UNSET or differs")
    producer = exact(pin["producer"], ("runId", "runAttempt", "workflowId", "event", "headBranch",
                                      "headCommit", "checkoutCommit", "checkoutTree", "checkoutParents"))
    for key in ("runId", "runAttempt", "workflowId"):
        positive(producer[key])
    need(producer["runAttempt"] == 1, "Original attempt1 browser producer is mandatory")
    need(producer["event"] == "push" and producer["headBranch"] == "main"
         and producer["headCommit"] == producer["checkoutCommit"] == accepted
         and producer["checkoutTree"] == alpha_tree, "Final browser producer is not selected main push")
    need(type(producer["checkoutParents"]) is list and 1 <= len(producer["checkoutParents"]) <= 2,
         "Final browser ordered parent count differs")
    for parent in producer["checkoutParents"]:
        hex_string(parent, 40)
    artifact = exact(pin["artifact"], ("id", "name", "digest", "sizeInBytes"))
    positive(artifact["id"])
    need(artifact["name"] == "successor-capability-" + accepted
         and type(artifact["digest"]) is str
         and re.fullmatch("sha256:[0-9a-f]{64}", artifact["digest"]), "Final artifact identity differs")
    integer(artifact["sizeInBytes"], 150000000, minimum=1)
    for key in ("sourceHash", "pageSha256", "catalogSha256", "inventorySha256",
                "campaignDigest", "workspaceSha256", "requestSha256"):
        hex_string(pin[key], 64)
    need(text(pin["missionId"], 512).startswith("capability-"), "Final mission identity differs")
    exact(pin["members"], BROWSER_MEMBERS)
    for item in pin["members"].values():
        exact(item, ("bytes", "sha256"))
        integer(item["bytes"], 2000000, minimum=1)
        hex_string(item["sha256"], 64)
    need(sum(item["bytes"] for item in pin["members"].values()) <= 16 * 1024 * 1024,
         "Selected eleven raw bodies exceed budget")
    transport = exact(pin["transport"], ("repository", "commit", "tree", "path", "custodySha256",
                                         "custodyBytes", "custodyGitBlob"))
    need(transport["repository"] == ALPHA_REPOSITORY
         and transport["path"] == "evidence/discovery-browser-inputs-v1/" + accepted,
         "Final immutable packet transport prefix differs")
    for key in ("commit", "tree", "custodyGitBlob"):
        hex_string(transport[key], 40)
    hex_string(transport["custodySha256"], 64)
    integer(transport["custodyBytes"], 2000000, minimum=1)
    for key, name in (("workspaceSha256", "fleet-browser-workspace.json"),
                      ("requestSha256", "fleet-browser-request.json"),
                      ("pageSha256", "served/index.html"), ("catalogSha256", "served/sources.json")):
        need(pin[key] == pin["members"][BROWSER_PREFIX + name]["sha256"],
             "Browser selected member digest differs")


WORKFLOW_OLD_ALPHA_REF = "b062fde0118ca74e1f36fc96816ca6985ab64bc8"


def workflow_ref_metadata(edits, byte_bound, accepted):
    need(type(edits) is list and len(edits) == 1, "Exactly one Alpha checkout ref edit per workflow required")
    projection_metadata(edits, byte_bound)
    edit = edits[0]
    need(edit["before"] == WORKFLOW_OLD_ALPHA_REF and edit["after"] == accepted
         and accepted != WORKFLOW_OLD_ALPHA_REF, "Only the fixed Alpha checkout ref may be replaced")


def workflow_ref_bytes(original, after, edits):
    line = "          ref: " + WORKFLOW_OLD_ALPHA_REF
    need(original.count(line) == 1 and edits[0]["start"] == original.index(line) + len("          ref: "),
         "Workflow edit is not the fixed Alpha checkout ref")
    need(apply_projection(original, edits) == after, "Workflow changed beyond selected Alpha ref")

def fresh_snapshot_urls(producer, accepted):
    positive(producer["runId"])
    need(type(producer["runAttempt"]) is int and producer["runAttempt"] == 1,
         "Original attempt1 browser producer is mandatory")
    hex_string(accepted, 40)
    need(producer["headCommit"] == producer["checkoutCommit"] == accepted,
         "Fresh snapshot source selection differs")
    prefix = "https://api.github.com/repos/" + ALPHA_REPOSITORY
    run = prefix + "/actions/runs/" + str(producer["runId"])
    return {
        "run": run + "/attempts/1",
        "latest-run": run,
        "jobs": run + "/attempts/1/jobs?per_page=100&page=1",
        "artifacts": run + "/artifacts?per_page=100&page=1",
        "checkout-commit": prefix + "/git/commits/" + accepted,
        "public-commit": prefix + "/git/commits/" + accepted,
    }


def validate_run_identity(value, producer, message):
    require_values(value, {"id": producer["runId"], "run_attempt": producer["runAttempt"],
                          "workflow_id": producer["workflowId"], "head_sha": producer["headCommit"],
                          "head_branch": "main", "event": "push", "path": BROWSER_WORKFLOW,
                          "status": "completed", "conclusion": "success"}, message)
    need(type(value.get("repository")) is dict and type(value.get("head_repository")) is dict
         and value["repository"].get("full_name") == ALPHA_REPOSITORY
         and value["head_repository"].get("full_name") == ALPHA_REPOSITORY, message)


def final_metadata(capture, final, current, *, metadata_budget_remaining=None):
    """All records, budgets and sidecar schemas precede the first CAS payload read."""
    exact(final, ("schema", "acceptedAlphaCommit", "alpha", "packet", "shipping", "browser",
                  "snapshots", "workflowEdits"))
    need(final["schema"] == "manager/externally-selected-final-inputs/v1", "Final input schema differs")
    accepted = hex_string(final["acceptedAlphaCommit"], 40)
    alpha = exact(final["alpha"], ("commit", "tree", "commitRef", "treeRef", "pagePath", "files"))
    need(alpha["commit"] == accepted, "Accepted Alpha source selection differs")
    hex_string(alpha["tree"], 40)
    virtual_path(alpha["pagePath"])
    record_map(alpha["files"], maximum=512)
    need(all(item["mode"] in ("100644", "100755") and item["bytes"] <= 2000000
             for item in alpha["files"].values())
         and sum(item["bytes"] for item in alpha["files"].values()) <= 10000000,
         "Selected Alpha raw closure exceeds bounds")
    shipping_metadata(final["shipping"], accepted)
    need(final["shipping"]["tree"] == alpha["tree"], "Shipping tree differs from selected source")
    need(set(alpha["files"]) == set(final["shipping"]["files"])
         | {CATALOG_PATH, "LICENSE", alpha["pagePath"]}, "Exact Alpha raw closure differs")
    need(sum(alpha["files"][path]["bytes"] for path in
             set(final["shipping"]["files"]) | {CATALOG_PATH}) <= 8000000
         and alpha["files"]["LICENSE"]["bytes"] <= 32000,
         "Production Alpha native/license capture budgets differ")
    browser_metadata(final["browser"], accepted, alpha["tree"])
    need(all(final["browser"][key] == final["shipping"][key]
             for key in ("sourceHash", "catalogSha256")), "Browser/shipping catalog identity differs")
    packet = exact(final["packet"], ("commit", "tree", "prefix", "commitRef", "treeRef", "files"))
    transport = final["browser"]["transport"]
    need(packet["commit"] == transport["commit"] and packet["tree"] == transport["tree"]
         and packet["prefix"] == transport["path"], "Packet transport selection differs")
    record_map(packet["files"])
    need(set(packet["files"]) == COMMON_SEVENTEEN
         and all(item["mode"] == "100644" and 0 < item["bytes"] <= 2000000
                 for item in packet["files"].values())
         and sum(item["bytes"] for item in packet["files"].values()) <= 32000000,
         "Exact common17 metadata or byte bound differs")
    exact(final["snapshots"], FRESH_SNAPSHOT_ROLES)
    for role, reference in final["snapshots"].items():
        file_reference(reference, locator="meta/fresh-" + role + ".json", maximum=2000000)
    exact(final["workflowEdits"], WORKFLOW_THREE)
    for path, edits in final["workflowEdits"].items():
        workflow_ref_metadata(edits, current[path]["bytes"], accepted)
    producer = final["browser"]["producer"]
    api_prefix = "https://api.github.com/repos/" + ALPHA_REPOSITORY
    expected_fresh_urls = fresh_snapshot_urls(producer, accepted)
    for role, reference in final["snapshots"].items():
        file_reference(reference, locator="meta/fresh-" + role + ".json", maximum=2000000,
                       expected_url=expected_fresh_urls[role])
    public_refs = (
        (alpha["commitRef"], "alpha-commit", "commits", alpha["commit"]),
        (alpha["treeRef"], "alpha-tree", "trees", alpha["tree"]),
        (packet["commitRef"], "packet-commit", "commits", packet["commit"]),
        (packet["treeRef"], "packet-tree", "trees", packet["tree"]),
    )
    for reference, role, kind, oid in public_refs:
        url = api_prefix + "/git/" + kind + "/" + oid + ("?recursive=1" if kind == "trees" else "")
        file_reference(reference, locator="meta/" + role + ".json", expected_url=url)
    remaining = (CEILINGS["totalOriginalAndBasisMetadataBytes"]
                 if metadata_budget_remaining is None else metadata_budget_remaining)
    integer(remaining, CEILINGS["totalOriginalAndBasisMetadataBytes"])
    final_refs = [row[0] for row in public_refs] + list(final["snapshots"].values())
    need(sum(ref["bytes"] for ref in final_refs) <= remaining,
         "Final metadata aggregate exceeds remaining budget")
    for reference in final_refs:
        capture.preflight(reference["path"], reference["bytes"], CEILINGS["individualMetadataBytes"])

    def original(ref, role, kind, oid):
        url = "https://api.github.com/repos/" + ALPHA_REPOSITORY + "/git/" + kind + "/" + oid
        if kind == "trees":
            url += "?recursive=1"
        file_reference(ref, locator="meta/" + role + ".json", expected_url=url)
        return read_metadata(capture, ref)[1]

    alpha_commit = original(alpha["commitRef"], "alpha-commit", "commits", alpha["commit"])
    alpha_tree = full_tree(original(alpha["treeRef"], "alpha-tree", "trees", alpha["tree"]),
                           alpha["tree"], maximum_leaves=CEILINGS["publicTreeLeaves"],
                           repository=ALPHA_REPOSITORY, public=True)
    commit_facts(alpha_commit, ALPHA_REPOSITORY, accepted, alpha["tree"],
                 final["browser"]["producer"]["checkoutParents"])
    packet_commit = original(packet["commitRef"], "packet-commit", "commits", packet["commit"])
    packet_tree = full_tree(original(packet["treeRef"], "packet-tree", "trees", packet["tree"]),
                            packet["tree"], maximum_leaves=CEILINGS["publicTreeLeaves"],
                            repository=ALPHA_REPOSITORY, public=True)
    commit_facts(packet_commit, ALPHA_REPOSITORY, packet["commit"], packet["tree"])
    for path, identity in alpha["files"].items():
        need(path in alpha_tree and git_entry(identity) == git_entry(alpha_tree[path])
             and identity["bytes"] == alpha_tree[path]["bytes"], "Alpha raw map differs from full public tree")
    prefix = packet["prefix"] + "/"
    selected = {path[len(prefix):]: item for path, item in packet_tree.items() if path.startswith(prefix)}
    need(set(selected) == COMMON_SEVENTEEN, "Public packet subtree is not exactly common17")
    for path, identity in packet["files"].items():
        need(git_entry(identity) == git_entry(selected[path]) and identity["bytes"] == selected[path]["bytes"],
             "Packet raw map differs from full public tree")
    snapshots = {role: read_metadata(capture, reference)[1]
                 for role, reference in final["snapshots"].items()}
    return snapshots


def complete_collection(record, field):
    need(type(record) is dict and type(record.get(field)) is list, "Complete API list is missing")
    integer(record.get("total_count"), 100, minimum=1)
    need(record["total_count"] == len(record[field]), "Full API list is incomplete")
    ids = []
    for item in record[field]:
        need(type(item) is dict, "API list item is not an object")
        ids.append(positive(item.get("id")))
    need(len(set(ids)) == len(ids), "API list IDs are duplicated")
    return record[field]


def verify_packet_metadata(final, files, snapshots):
    pin = final["browser"]
    producer = pin["producer"]
    exact(snapshots, FRESH_SNAPSHOT_ROLES)
    validate_run_identity(snapshots["latest-run"], producer, "Latest browser producer run differs")
    captured = {role: strict_json(files["metadata/" + role + ".json"]) for role in SIDECARS}
    for role in SIDECARS:
        need(same_json(captured[role], snapshots[role]), "Full type-strict fresh API snapshot differs")
    need(files["metadata/checkout-commit.json"] == files["metadata/public-commit.json"],
         "The two full source GitData originals are not byte-identical")
    run = captured["run"]
    validate_run_identity(run, producer, "Full producer run differs")
    for role in ("checkout-commit", "public-commit"):
        commit_facts(captured[role], ALPHA_REPOSITORY, producer["headCommit"],
                     producer["checkoutTree"], producer["checkoutParents"])
    jobs = complete_collection(captured["jobs"], "jobs")
    matches = [row for row in jobs if row.get("name") == "capability"]
    need(len(matches) == 1, "Exact capability job is missing")
    job = matches[0]
    require_values(job, {"run_id": producer["runId"], "head_sha": producer["headCommit"],
                        "status": "completed", "conclusion": "success"}, "Capability job differs")
    need(type(job.get("steps")) is list and len(job["steps"]) <= 1000, "Capability steps are missing")
    for name in ("Bind retained evidence to exact source",
                 "Saved future-task protocol, docket and real-task boundary acceptance",
                 "Retain exact-source screenshots and journey evidence"):
        matches = [row for row in job["steps"] if type(row) is dict and row.get("name") == name]
        need(len(matches) == 1 and matches[0].get("status") == "completed"
             and matches[0].get("conclusion") == "success", "Capability step differs")
    artifacts = complete_collection(captured["artifacts"], "artifacts")
    matches = [row for row in artifacts if row["id"] == pin["artifact"]["id"]]
    need(len(matches) == 1, "Selected original artifact is missing")
    artifact = matches[0]
    require_values(artifact, {"id": pin["artifact"]["id"], "name": pin["artifact"]["name"],
                             "digest": pin["artifact"]["digest"], "size_in_bytes": pin["artifact"]["sizeInBytes"],
                             "expired": False}, "Selected artifact API metadata differs")
    require_values(artifact.get("workflow_run"), {"id": producer["runId"], "head_sha": producer["headCommit"]},
                   "Artifact original run differs")
    custody_raw = files["CUSTODY.json"]
    transport = pin["transport"]
    need(len(custody_raw) == transport["custodyBytes"]
         and sha256(custody_raw) == transport["custodySha256"]
         and git_blob(custody_raw) == transport["custodyGitBlob"], "CUSTODY raw identity differs")
    custody = strict_json(custody_raw)
    wanted = {"schema": "successor/discovery-browser-artifact-custody/v1",
              **{key: pin[key] for key in ("repository", "workflowPath", "producer", "artifact",
                                          "sourceHash", "pageSha256", "catalogSha256", "members")}}
    exact(custody, set(wanted) | {"inventory"})
    for key, value in wanted.items():
        need(same_json(custody[key], value), "CUSTODY full source/artifact binding differs")
    inventory = custody["inventory"]
    need(type(inventory) is dict and 0 < len(inventory) <= 2048, "Complete artifact inventory is missing")
    for name, item in inventory.items():
        need(type(name) is str and name != "", "Invalid original archive path")
        path = name[:-1] if name.endswith("/") else name
        virtual_path(path)
        exact(item, ("bytes", "sha256"))
        integer(item["bytes"], 32000000)
        hex_string(item["sha256"], 64)
    need(sum(item["bytes"] for item in inventory.values()) <= 250000000
         and sha256(canonical_json(inventory)) == pin["inventorySha256"],
         "Complete original artifact inventory differs")
    for path in BROWSER_MEMBERS:
        need(inventory.get(path) == pin["members"][path]
             and pin["members"][path] == {"bytes": len(files[path]), "sha256": sha256(files[path])},
             "Selected original raw member differs")


def verify_browser_semantics(final, files, alpha_files):
    pin = final["browser"]
    catalog_raw = files[BROWSER_PREFIX + "served/sources.json"]
    catalog = strict_json(catalog_raw)
    exact(catalog, ("schema", "sourceHash", "sources"))
    need(catalog["schema"] == "successor-capability-source/v1"
         and catalog["sourceHash"] == pin["sourceHash"]
         and type(catalog["sources"]) is dict and 0 < len(catalog["sources"]) <= 256,
         "Served catalog differs")
    for path, digest in catalog["sources"].items():
        virtual_path(path)
        hex_string(digest, 64)
    need(sha256(canonical_json(catalog["sources"])) == pin["sourceHash"],
         "Catalog canonical source hash differs")
    source, checkout = strict_json(files["source.json"]), strict_json(files["exact-checkout.json"])
    require_values(source, {"commit": pin["producer"]["checkoutCommit"], "trackedDiff": "", "source": catalog},
                   "Original source metadata differs")
    require_values(checkout, {"commit": pin["producer"]["checkoutCommit"], "tree": pin["producer"]["checkoutTree"],
                             "source": catalog, "files": catalog["sources"]}, "Original checkout metadata differs")
    need(catalog_raw == alpha_files[CATALOG_PATH]
         and files[BROWSER_PREFIX + "served/index.html"] == alpha_files[final["alpha"]["pagePath"]],
         "Served page/catalog differ from selected public raw bodies")
    workspace_raw = files[BROWSER_PREFIX + "fleet-browser-workspace.json"]
    need(workspace_raw == files[BROWSER_PREFIX + "jobs-browser-workspace.json"],
         "Fleet/Jobs pre-mission workspace bytes differ")
    workspace = strict_json(workspace_raw)
    request = strict_json(files[BROWSER_PREFIX + "fleet-browser-request.json"])
    jobs = strict_json(files[BROWSER_PREFIX + "jobs-browser-request.json"])
    require_values(workspace, {"missionId": pin["missionId"], "authority": [], "paymentRoute": "none"},
                   "Original mission authority differs")
    events = workspace.get("events")
    need(type(events) is list and 0 < len(events) < 24
         and type(workspace.get("revision")) is int and workspace["revision"] == len(events) - 1,
         "Original mission history differs")
    event_digests = []
    for event in events:
        need(type(event) is dict, "Original history event differs")
        event_digests.append(hex_string(event.get("digest"), 64))
    for value, route, currency in ((request, "manager-usdc", "USDC6"), (jobs, "jobs-agialpha", "AGIALPHA18")):
        require_values(value, {"missionId": pin["missionId"]}, "Alternative request mission differs")
        require_values(value.get("commission"), {"route": route, "currency": currency, "capBaseUnits": "0"},
                       "Alternative zero-cap commission differs")
    need(request["commission"].get("id") == jobs["commission"].get("id")
         and request["commission"].get("branch") != jobs["commission"].get("branch")
         and same_json({k: v for k, v in request.items() if k != "commission"},
                       {k: v for k, v in jobs.items() if k != "commission"}),
         "Alternative unsubmitted draft fields differ")
    exports = strict_json(files[BROWSER_PREFIX + "browser-native-requests.json"])
    wanted = {"schema": "actual-browser-native-request-exports/v1", "missionId": pin["missionId"],
              "campaignDigest": pin["campaignDigest"], "sourceHash": pin["sourceHash"], "pageSha256": pin["pageSha256"],
              "workspace": {"file": "fleet-browser-workspace.json", "sha256": pin["workspaceSha256"],
                            "jobsFile": "jobs-browser-workspace.json", "jobsSha256": pin["workspaceSha256"],
                            "revision": workspace["revision"], "eventPrefix": event_digests, "head": event_digests[-1]},
              "requests": {"manager-usdc": {"file": "fleet-browser-request.json", "sha256": pin["requestSha256"],
                                           "currency": "USDC6"},
                           "jobs-agialpha": {"file": "jobs-browser-request.json",
                                           "sha256": pin["members"][BROWSER_PREFIX + "jobs-browser-request.json"]["sha256"],
                                           "currency": "AGIALPHA18"}},
              "scope": "Actual UI downloads from one unchanged pre-Fleet mission; alternative unsubmitted zero-cap drafts"}
    need(same_json(exports, wanted), "Actual UI draft export binding differs")
    proof = strict_json(files[BROWSER_PREFIX + "fleet-native/native-proof.json"])
    require_values(proof, {"schema": "actual-browser-fleet-native-return/v1",
                          "alphaCommit": pin["producer"]["checkoutCommit"], "alphaTree": pin["producer"]["checkoutTree"],
                          **{key: pin[key] for key in ("campaignDigest", "sourceHash", "workspaceSha256", "requestSha256")}},
                   "Original Fleet native proof binding differs")
    journey = strict_json(files[BROWSER_PREFIX + "journey.json"])
    require_values(journey, {"passed": True, "pageErrors": [], "checks": JOURNEY_CHECKS,
                            "pageSha256": pin["pageSha256"], "source": catalog}, "Original browser journey differs")
    require_values(journey.get("fleetLocalReview"), {"requestExports": exports}, "Journey request export differs")
    return catalog


def verify_final_bytes(final, proposed, current, payloads, snapshots):
    alpha_files = {path: payloads[item["blob"]] for path, item in final["alpha"]["files"].items()}
    files = {path: payloads[item["blob"]] for path, item in final["packet"]["files"].items()}
    for path, item in final["alpha"]["files"].items():
        matches(alpha_files[path], item)
    for path, item in final["packet"]["files"].items():
        matches(files[path], item)
    for path, value in ((SHIPPING_PATH, final["shipping"]), (BROWSER_PATH, final["browser"])):
        need(same_json(strict_json(payloads[proposed[path]["blob"]]), value),
             "Reviewed source binding after-image differs")
    for path, edits in final["workflowEdits"].items():
        original = payloads[current[path]["blob"]].decode("utf8", "strict")
        after = payloads[proposed[path]["blob"]].decode("utf8", "strict")
        workflow_ref_bytes(original, after, edits)
    verify_packet_metadata(final, files, snapshots)
    catalog = verify_browser_semantics(final, files, alpha_files)
    shipping = final["shipping"]
    need(set(shipping["files"]) == set(catalog["sources"]) | {INSPECTOR_PATH}
         and ALPHA_REQUIRED <= set(catalog["sources"])
         and sha256(alpha_files[CATALOG_PATH]) == shipping["catalogSha256"]
         and sha256(alpha_files["LICENSE"]) == LICENSE_SHA256, "Shipping catalog/license closure differs")
    for path, digest in shipping["files"].items():
        need(sha256(alpha_files[path]) == digest
             and (path == INSPECTOR_PATH or digest == catalog["sources"][path]),
             "Shipping native source raw digest differs")
    need(sha256(payloads[proposed["scripts/integrations/discovery-lab-contract.mjs"]["blob"]])
         == shipping["files"]["examples/successor-capability/discovery-lab-contract.mjs"],
         "Protected Manager/selected Alpha contracts differ")
    return {"acceptedAlphaCommit": final["acceptedAlphaCommit"], "alphaTree": final["alpha"]["tree"],
            "alphaRawBodies": len(alpha_files), "commonPacketMembers": len(files),
            "originalArtifactInventoryMetadataOnly": True,
            "fullAlphaRawTreeCaptured": False, "ordinaryAlphaSourceProofPerformed": False}


def _sorted_data(value):
    """Only bounded validated builtins reach Python literal rendering."""
    if type(value) is dict:
        return {key: _sorted_data(value[key]) for key in sorted(value)}
    if type(value) is list:
        return [_sorted_data(item) for item in value]
    if type(value) is tuple:
        return tuple(_sorted_data(item) for item in value)
    need(value is None or type(value) in (str, int, bool), "Unsupported generated literal")
    return value


def render_bmv(template, trees, basis, proposed, original_text):
    """Pure deterministic data rendering; the generated verifier is never evaluated."""
    need(len(template) == TEMPLATE_BYTES and sha256(template) == TEMPLATE_SHA256,
         "Independent empty verifier template pin differs")
    block = FROZEN_BLOCK.encode("utf8")
    need(template.count(block) == 1, "Expected exactly one exact empty frozen block")
    baseline = {
        "repository": REPOSITORY, "commit": BASE_COMMIT, "tree": BASE_TREE,
        "entries": {path: git_entry(item) for path, item in trees["base"].items()},
        "originals": original_text,
    }
    baseline_raw = json_bytes(baseline, maximum=32000000, pretty=True)
    changes = {
        path: {"before": item["before"], "after": {
            "mode": item["after"]["mode"], "sha256": item["after"]["sha256"]},
            "reason": item["reason"]}
        for path, item in basis["finalFinite"].items()
    }
    manifest = {
        "schema": "agijobmanager/discovery-release-profile/v1", "repository": REPOSITORY,
        "profile": "manager-discovery-release-v1", "version": "1.20.0",
        "baseCommit": BASE_COMMIT, "baseTree": BASE_TREE,
        "qualification": "PENDING_EXACT_FINAL_SOURCE_HOSTED_EXECUTION", "changes": changes,
    }
    manifest_raw = json_bytes(manifest, maximum=32000000, pretty=True)
    modified = {path: item["after"] for path, item in changes.items() if item["before"] is not None}
    additions = {path: item["after"] for path, item in changes.items() if item["before"] is None}
    projections = {
        path: [(edit["start"], edit["before"], edit["after"]) for edit in edits]
        for path, edits in basis["projections"].items()
    }
    literals = (
        ("BASELINE_SHA256", sha256(baseline_raw)),
        ("MODIFIED", modified), ("ADDITIONS", additions), ("PROJECTIONS", projections),
        ("PROTECTED", {path: item["identity"]["sha256"] for path, item in basis["protected"].items()}),
    )
    replacement = "# BEGIN FROZEN DISCOVERY DELTA\n" + "".join(
        key + " = " + repr(_sorted_data(value)) + "\n" for key, value in literals
    ) + "# END FROZEN DISCOVERY DELTA\n"
    verifier_raw = template.replace(block, replacement.encode("utf8"), 1)
    need(len(verifier_raw) <= 32000000, "Rendered verifier exceeds production read bound")
    prefix, suffix = template.split(block)
    need(verifier_raw.startswith(prefix) and verifier_raw.endswith(suffix)
         and verifier_raw == prefix + replacement.encode("utf8") + suffix,
         "Verifier changed outside exact frozen block")
    return {B_PATH: baseline_raw, M_PATH: manifest_raw, V_PATH: verifier_raw}


def make_packet(outputs, proposed, basis, selection_identity, references, final_summary):
    need(set(outputs) == CONTROLS, "Expected exactly B/M/V outputs")
    entries = dict(proposed)
    entries.update({path: identify(raw) for path, raw in outputs.items()})
    root, tree_objects = git_tree({path: git_entry(item) for path, item in entries.items()})
    need(len(entries) == 1663 and len(basis["finalFinite"]) == 85
         and len(basis["protected"]) == 1589, "Proposed packet count invariant differs")
    output_identities = {path: identify(raw) for path, raw in outputs.items()}
    receipt = {
        "schema": "manager/prepared-unapproved-receipt/v1",
        "state": "PREPARED_UNAPPROVED",
        "repository": REPOSITORY,
        "inputSelection": selection_identity,
        "inputRecords": references,
        "fixedCurrentCommit": CURRENT_COMMIT, "fixedCurrentTree": CURRENT_TREE,
        "baselineCommit": BASE_COMMIT, "baselineTree": BASE_TREE,
        "scopeIdentities": {
            "currentFiniteSha256": sha256(canonical_json(basis["currentFinite"])),
            "finalFiniteSha256": sha256(canonical_json(basis["finalFinite"])),
            "protectedSha256": sha256(canonical_json(basis["protected"])),
            "projectionsSha256": sha256(canonical_json(basis["projections"])),
        },
        "counts": {"currentLeaves": 1660, "proposedLeaves": len(entries),
                   "finiteModified": 38, "finiteAdded": 47, "finiteTotal": 85,
                   "separateControls": 3, "protected": 1589, "proposedTreeObjects": len(tree_objects)},
        "outputs": output_identities,
        "proposedTree": root,
        "proposedLogicalBytes": sum(item["bytes"] for item in entries.values()),
        "selectedFinalBindings": final_summary,
        "flags": dict(FALSE_FLAGS),
        "proofStatus": {
            "ordinaryManagerSourceProof": "NOT_RUN", "ordinaryAlphaSourceProof": "NOT_RUN",
            "dependencyCompilerNativeProof": "NOT_RUN", "hostedReleaseQualification": "NOT_RUN",
            "originalArtifactZipDigestRecomputed": False,
            "scope": "Prepared data only. Root selection and byte consistency do not confer approval.",
        },
    }
    packet = {
        "schema": "manager/prepared-bmv-packet/v1",
        "files": {path: {"mode": "100644", "utf8": raw.decode("utf8", "strict")}
                  for path, raw in outputs.items()},
        "receipt": receipt,
    }
    raw = json_bytes(packet, maximum=CEILINGS["packetBytes"], pretty=True)
    return raw


def overlap(left, right):
    left, right = absolute_path(left), absolute_path(right)
    return left == right or left.startswith(right + "/") or right.startswith(left + "/")


def output_preflight(value, input_roots, forbidden):
    exact(value, ("parent", "device", "inode", "name"))
    absolute_path(value["parent"])
    integer(value["device"])
    integer(value["inode"], minimum=1)
    need(value["name"] == "PREPARED_PACKET.json", "Output final name differs")
    need(type(forbidden) is list and 0 < len(forbidden) <= 32, "Explicit forbidden roots required")
    for root in [*input_roots, *forbidden]:
        absolute_path(root)
        need(not overlap(value["parent"], root), "Output root overlaps an input or forbidden repository root")
    descriptor = open_directory(value["parent"])
    try:
        details = os.fstat(descriptor)
        private_directory(descriptor)
        need(details.st_dev == value["device"] and details.st_ino == value["inode"],
             "Selected output parent identity differs")
        try:
            os.stat(value["name"], dir_fd=descriptor, follow_symlinks=False)
        except FileNotFoundError:
            pass
        else:
            raise Refusal("Final output already exists")
        return descriptor, (details.st_dev, details.st_ino, details.st_mode, details.st_uid)
    except BaseException:
        os.close(descriptor)
        raise


def recheck_output_parent(descriptor, value, expected):
    current = os.fstat(descriptor)
    need((current.st_dev, current.st_ino, current.st_mode, current.st_uid) == expected,
         "Output parent descriptor changed")
    fresh = open_directory(value["parent"])
    try:
        current = os.fstat(fresh)
        need((current.st_dev, current.st_ino, current.st_mode, current.st_uid) == expected,
             "Output parent pathname changed")
    finally:
        os.close(fresh)


def _owned_output_readback(parent, name, expected_identity, raw):
    descriptor = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
    try:
        before = os.fstat(descriptor)
        need(stat.S_ISREG(before.st_mode) and stat.S_IMODE(before.st_mode) == 0o600
             and before.st_uid == os.getuid() and before.st_size == len(raw)
             and (before.st_dev, before.st_ino) == expected_identity, "Owned output identity differs")
        result, total = hashlib.sha256(), 0
        while True:
            block = os.read(descriptor, min(READ_CHUNK, len(raw) - total + 1))
            if not block:
                break
            total += len(block)
            need(total <= len(raw), "Owned output grew")
            result.update(block)
        need(total == len(raw) and result.hexdigest() == sha256(raw)
             and snapshot(os.fstat(descriptor)) == snapshot(before)
             and snapshot(os.stat(name, dir_fd=parent, follow_symlinks=False)) == snapshot(before),
             "Owned output readback differs")
    finally:
        os.close(descriptor)


def _cleanup_owned_stage(parent, stage, identity):
    try:
        value = os.stat(stage, dir_fd=parent, follow_symlinks=False)
    except FileNotFoundError:
        return
    if (value.st_dev, value.st_ino) == identity:
        os.unlink(stage, dir_fd=parent)
        os.fsync(parent)


def stage_packet(raw, parent, output, parent_identity, recheck):
    """Only write path: a fresh exclusive private packet; never apply or overwrite."""
    import secrets
    need(type(raw) is bytes and len(raw) <= CEILINGS["packetBytes"], "Packet bytes exceed bound")
    recheck()
    recheck_output_parent(parent, output, parent_identity)
    try:
        os.stat(output["name"], dir_fd=parent, follow_symlinks=False)
    except FileNotFoundError:
        pass
    else:
        raise Refusal("Final output already exists")
    stage = ".prepared-packet-" + secrets.token_hex(16) + ".stage"
    descriptor, identity, commit_attempted = None, None, False
    try:
        descriptor = os.open(stage, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                             0o600, dir_fd=parent)
        details = os.fstat(descriptor)
        identity = (details.st_dev, details.st_ino)
        need(stat.S_ISREG(details.st_mode) and stat.S_IMODE(details.st_mode) == 0o600
             and details.st_uid == os.getuid(), "Stage type/mode differs")
        remaining = memoryview(raw)
        while remaining:
            written = os.write(descriptor, remaining[:READ_CHUNK])
            need(written > 0, "Packet write made no progress")
            remaining = remaining[written:]
        os.fsync(descriptor)
        os.close(descriptor)
        descriptor = None
        _owned_output_readback(parent, stage, identity, raw)
        recheck()
        recheck_output_parent(parent, output, parent_identity)
        # Set before link: any interruption after an attempted syscall is conservative.
        commit_attempted = True
        try:
            os.link(stage, output["name"], src_dir_fd=parent, dst_dir_fd=parent,
                    follow_symlinks=False)
        except FileExistsError:
            commit_attempted = False
            raise Refusal("Final output appeared before exclusive commit")
        _owned_output_readback(parent, output["name"], identity, raw)
        recheck_output_parent(parent, output, parent_identity)
        os.fsync(parent)
        _cleanup_owned_stage(parent, stage, identity)
        return {"state": "PREPARED_UNAPPROVED", "bytes": len(raw), "sha256": sha256(raw),
                "path": output["parent"] + "/" + output["name"], "flags": dict(FALSE_FLAGS)}
    except BaseException as error:
        if descriptor is not None:
            try:
                os.close(descriptor)
            except OSError:
                pass
        if commit_attempted:
            raise CommitUncertain("COMMIT_STATUS_UNCERTAIN; retain final owned packet and do not retry") from error
        if identity is not None:
            try:
                _cleanup_owned_stage(parent, stage, identity)
            except OSError as cleanup_error:
                raise Refusal("Precommit failed; owned stage cleanup could not be confirmed") from cleanup_error
        raise


def cas_metadata(value, collections):
    exact(value, ("schema", "objects"))
    need(value["schema"] == "manager/selected-raw-cas/v1" and type(value["objects"]) is dict,
         "CAS inventory schema differs")
    expected = {}
    for collection in collections:
        for identity in collection.values():
            raw_record(identity)
            oid = identity["blob"]
            wanted = {"bytes": identity["bytes"], "sha256": identity["sha256"]}
            need(oid not in expected or expected[oid] == wanted, "One Git OID has conflicting raw identities")
            expected[oid] = wanted
    need(set(value["objects"]) == set(expected) and len(expected) <= 4096, "Full CAS object inventory differs")
    for oid, item in value["objects"].items():
        hex_string(oid, 40)
        exact(item, ("bytes", "sha256"))
        integer(item["bytes"], CEILINGS["individualSourceBytes"])
        hex_string(item["sha256"], 64)
        need(item == expected[oid], "CAS object raw identity differs")
    need(sum(item["bytes"] for item in expected.values()) <= CEILINGS["totalSourceBytes"],
         "Complete selected raw corpus exceeds budget")
    return expected


def selection_metadata(value):
    exact(value, ("schema", "repository", "currentCommit", "currentTree", "captureRoot",
                  "inputs", "output", "forbiddenRoots", "limits"))
    need(value["schema"] == "manager/external-preparation-selection/v1"
         and value["repository"] == REPOSITORY and value["currentCommit"] == CURRENT_COMMIT
         and value["currentTree"] == CURRENT_TREE, "External source selection differs")
    absolute_path(value["captureRoot"])
    exact(value["limits"], CEILINGS)
    for key, maximum in CEILINGS.items():
        need(type(value["limits"][key]) is int and value["limits"][key] == maximum,
             "Selected limits differ from compiled reviewed ceilings")
    inputs = exact(value["inputs"], ("originals", "template", "current_map", "before", "basis",
                                     "overlays", "final", "cas"))
    need(type(inputs["originals"]) is dict and set(inputs["originals"]) == set(API_ROLE_FACTS),
         "Nine public originals are mandatory")
    refs = list(inputs["originals"].values())
    for role in ("template", "current_map", "before", "basis", "overlays", "final", "cas"):
        reference = inputs[role]
        locator = "meta/template.txt" if role == "template" else "meta/" + role + ".json"
        file_reference(reference, locator=locator)
        need(reference["url"] is None, "Owned metadata must not impersonate a public URL")
        refs.append(reference)
    for reference in refs:
        file_reference(reference)
    need(sum(reference["bytes"] for reference in refs)
         <= CEILINGS["totalOriginalAndBasisMetadataBytes"], "Primary metadata byte budget exceeded")
    template = inputs["template"]
    need(template["bytes"] == TEMPLATE_BYTES and template["sha256"] == TEMPLATE_SHA256,
         "Independent pinned empty-template selection differs")
    return inputs


def prepare(selection_path, expected_bytes, expected_sha256):
    """No side effects until every selected datum and final binding has passed."""
    selection_path = absolute_path(selection_path)
    integer(expected_bytes, CEILINGS["individualMetadataBytes"], minimum=1)
    hex_string(expected_sha256, 64)
    parent_path, leaf = selection_path.rsplit("/", 1)
    relative_locator(leaf)
    bootstrap = Capture(parent_path)
    capture = None
    output_descriptor = None
    try:
        raw_selection = bootstrap.read(leaf, expected_bytes, expected_sha256,
                                       CEILINGS["individualMetadataBytes"])
        selected = strict_json(raw_selection)
        inputs = selection_metadata(selected)
        need(not overlap(selected["captureRoot"], parent_path),
             "Selection and source capture roots must be disjoint")
        capture = Capture(selected["captureRoot"])
        output_descriptor, output_identity = output_preflight(
            selected["output"], [parent_path, selected["captureRoot"]], selected["forbiddenRoots"])
        primary_references = {
            **{"original:" + role: ref for role, ref in inputs["originals"].items()},
            **{role: inputs[role] for role in ("template", "current_map", "before", "basis", "overlays", "final", "cas")},
        }
        for reference in primary_references.values():
            capture.preflight(reference["path"], reference["bytes"], CEILINGS["individualMetadataBytes"])
        trees = fixed_originals(capture, inputs["originals"])
        template_ref = inputs["template"]
        template = capture.read(template_ref["path"], template_ref["bytes"], template_ref["sha256"],
                                CEILINGS["individualMetadataBytes"])
        need(len(template) == TEMPLATE_BYTES and sha256(template) == TEMPLATE_SHA256,
             "Independent verifier template prehash differs")
        values = {role: read_metadata(capture, inputs[role])[1]
                  for role in ("current_map", "before", "basis", "overlays", "final", "cas")}
        current, before, basis, overlays, final = (values[role]
            for role in ("current_map", "before", "basis", "overlays", "final"))
        proposed, _modified = source_basis_metadata(basis, current, before, overlays, trees)
        snapshots = final_metadata(capture, final, current, metadata_budget_remaining=
            CEILINGS["totalOriginalAndBasisMetadataBytes"]
            - sum(ref["bytes"] for ref in primary_references.values()))
        expected_cas = cas_metadata(values["cas"], (
            current, before, overlays, final["alpha"]["files"], final["packet"]["files"]))
        final_refs = {
            "alpha_commit": final["alpha"]["commitRef"], "alpha_tree": final["alpha"]["treeRef"],
            "packet_commit": final["packet"]["commitRef"], "packet_tree": final["packet"]["treeRef"],
            **{"fresh:" + role: ref for role, ref in final["snapshots"].items()},
        }
        all_refs = {**primary_references, **final_refs}
        need(sum(ref["bytes"] for ref in all_refs.values())
             <= CEILINGS["totalOriginalAndBasisMetadataBytes"], "All metadata byte budget exceeded")
        locators = [ref["path"] for ref in all_refs.values()]
        need(len(set(locators)) == len(locators), "Metadata roles reuse a physical locator")
        # Metadata/type/role/path/budget checks above all precede source CAS opens.
        for oid, identity in expected_cas.items():
            capture.preflight("cas/" + oid, identity["bytes"], CEILINGS["individualSourceBytes"])
        capture.closure(set(locators) | {"cas/" + oid for oid in expected_cas})
        capture.recheck()
        bootstrap.recheck()
        payloads = {oid: capture.read("cas/" + oid, item["bytes"], item["sha256"],
                                      CEILINGS["individualSourceBytes"])
                    for oid, item in expected_cas.items()}
        for oid, raw in payloads.items():
            need(git_blob(raw) == oid, "Captured CAS Git blob differs")
        proposed, original_text = verify_corpus_bytes(current, before, overlays, basis, trees, payloads)
        final_summary = verify_final_bytes(final, proposed, current, payloads, snapshots)
        outputs = render_bmv(template, trees, basis, proposed, original_text)
        selection_identity = {"bytes": expected_bytes, "sha256": expected_sha256}
        refs = {role: {key: ref[key] for key in ("bytes", "sha256", "url")}
                for role, ref in all_refs.items()}
        packet = make_packet(outputs, proposed, basis, selection_identity, refs, final_summary)

        def recheck():
            capture.recheck()
            bootstrap.recheck()
        return stage_packet(packet, output_descriptor, selected["output"], output_identity, recheck)
    finally:
        if output_descriptor is not None:
            os.close(output_descriptor)
        if capture is not None:
            capture.close()
        bootstrap.close()


def main():
    import argparse
    import sys
    parser = argparse.ArgumentParser(description="Prepare unapproved B/M/V data only; never apply or execute.")
    parser.add_argument("--selection", required=True)
    parser.add_argument("--selection-bytes", type=int, required=True)
    parser.add_argument("--selection-sha256", required=True)
    args = parser.parse_args()
    try:
        result = prepare(args.selection, args.selection_bytes, args.selection_sha256)
    except CommitUncertain:
        print('{"state":"COMMIT_STATUS_UNCERTAIN","retryAllowed":false}', file=sys.stderr)
        return 3
    except (Refusal, OSError, UnicodeError, ValueError, KeyError, TypeError):
        print('{"state":"REFUSED","generation":"NOT_RUN_OR_PRECOMMIT_FAILED","approval":false}', file=sys.stderr)
        return 2
    print(json_bytes(result).decode("utf8"), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
