# Reviewed braces compatibility repair

This is a transparently versioned local fork of upstream `braces@3.0.3`, named
`3.0.3-agijobmanager.1`. `UPSTREAM.json` identifies the registry tarball integrity
and SHA-256 of the original files; the MIT license is retained. It addresses
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), for which
no patched registry version was available on 2026-10-10.

Changes: hard combined brace/parenthesis nesting of 128; non-bypassable 10,000
character cap; iterative AST validation before all directly importable recursive
walkers; non-string value rejection before implicit coercion; child
cycle/shared-child rejection; bounded, cycle-checked parent
chains; bounded expansion-queue recursion (including external parent queues);
iterative, depth-bounded array flattening with active-path cycle checks.
The limits cannot be disabled by caller options. Excess nesting is rejected with
a controlled `SyntaxError` carrying `ERR_BRACES_COMPLEXITY`.

The original API, normal glob semantics and explicit range-limit behavior remain.
This repair covers nested traversal exhaustion. It does not establish general
protection against Cartesian expansion, excessive output or every resource
exhaustion input. Glob expressions must still come from trusted configuration.

`ui/security-tests/braces.test.cjs` exercises the advisory class, bypass paths,
compatibility and actual transitive dependency resolution. The normal UI test
command runs these tests before its application suite. A clean registry audit
does not audit local fork code; its source, provenance, tests and independent
review are separate release evidence. Replace this fork with an upstream repair
only after equivalent adversarial and compatibility tests pass.
