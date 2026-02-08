# Known issues

This file tracks reproducible failures in local commands or tests.

## `npm install` emits warnings (treated as failures for audit readiness)

**Reproduction**
```bash
npm install
```

**Warnings (examples)**
- `npm warn Unknown env config "http-proxy"`.
- Deprecation warnings from transitive dependencies.
- `npm audit` reports 88 vulnerabilities (28 low, 12 moderate, 35 high, 13 critical).

**Root cause**
Dependency tree contains deprecated packages; the environment includes an
`http-proxy` config entry.

**Smallest fix**
- Remove the `http-proxy` npm config entry in the environment.
- Audit and update dependencies (or apply `npm audit fix` where appropriate).

## Solidity compiler warnings during `npm run build`

**Reproduction**
```bash
npm run build
```

**Warnings**
```
Warning: This declaration has the same name as another declaration.
--> project:/contracts/test/MockENSRegistry.sol:8:37

Warning: This declaration has the same name as another declaration.
--> project:/contracts/test/MockPublicResolver.sol:8:61
```

**Root cause**
Name shadowing in mock contracts used for tests.

**Smallest fix**
- Rename the shadowing function arguments in the mock contracts.
