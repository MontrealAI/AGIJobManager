# v1.15.0 — Mainnet Commissioning & Operator Readiness

Software release qualification is separate from production intake authorization.

Adds maintained historical evidence, coherent current inspection, ENS inspection,
isolated connected-helper rehearsal, read-only journal recovery and A1–A5 evidence
collection commands. Operators can inspect the already commissioned mainnet instance
without being routed to a fresh deployment. Reports distinguish missing inputs,
observed failures, historical evidence, simulated qualification and owner decisions.

Adds bounded NameWrapper approval discovery and active-state reconciliation,
strict read-only RPC transport, exclusive private reports, supported runtime selection,
explicit operator inputs and a recorded-instance interface. Deployed Solidity,
compiler settings, payout semantics, dependencies and blank transaction defaults
are unchanged. No contract migration is needed.

Maximum-length URI regressions retain the fixed ENS gas boundary and demonstrate
partial resolver failure despite a successful outer hook. Operators must review
actual record state and the URI profile; maximum contract input length does not
promise successful ENS mirroring.

Use [the operator guide](https://github.com/MontrealAI/AGIJobManager/blob/v1.15.0/docs/OPERATIONS/COMMISSIONING.md). The historical ENS
milestone remains completed; production intake remains on HOLD. Live archive access,
original operator build artifacts, actual participants and private approvals are
separate qualification inputs. Missing gates must remain explicit in the exact-source
qualification report. v1.14.0 and its tag/assets are not overwritten.
