# Computer-use integration — verified 22 September 2026

AGI Jobs covers work a person or team performs through a keyboard, mouse and screen. Job eligibility is broader than the capabilities commissioned on any particular machine. Admit work only when its actual tools, permissions, time and independent verification are available.

| Primary source | Current integration fact | Release decision |
| --- | --- | --- |
| [OpenAI computer use](https://developers.openai.com/api/docs/guides/tools-computer-use) | GPT-6 Astra supports code-driven interface work; structured computer actions remain available. | Preserve code, browser and desktop tools; bind the actual per-role model and reject silent fallbacks. |
| [Anthropic computer use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool) | The computer_toolset_20260801 client toolset offers batched desktop calls. | Keep the public specification provider independent. This release does not claim a commissioned Claude adapter. |
| [OpenClaw Codex computer use](https://docs.openclaw.ai/plugins/codex-computer-use) | Native Codex-harness computer use is a separate plugin path, with app-server permission and readiness checks. | The private native runner uses the separately paired OpenClaw node provider; it does not install the Codex-harness plugin or infer its readiness from Docker health. |
| [OpenClaw node computer use](https://docs.openclaw.ai/nodes/computer-use) | Node-backed computer tools provide a separate remote execution path. | The private runner implements the pinned protocol-4 authenticated node transport and contract-2 frame/generation checks. Its local transport tests use a mock server; physical-node commissioning is still required. |
| [OpenClaw macOS permissions](https://docs.openclaw.ai/platforms/mac/permissions) | Screen capture, Accessibility and Event Posting have separate permission checks; connected does not mean unlocked. | Require a real keyboard, mouse and capture rehearsal for native host desktop deployments. The existing public workflow retains its Docker desktop; the separate native workflow requires actual host permissions. |

The private bundle keeps OpenClaw 2026.9.5 as its tested baseline, not a claim to the latest vendor build. It preserves separate signing and compute accounts, and checks each configured creator/reviewer model. A product announcement, model name or changed version number does not qualify a new runtime. Re-run the local tool rehearsal and held-out task evaluation after changing the model, tools, sandbox image or policy. No host-account access is inferred from the general job definition.

Independent Node review must reopen or recompute the result from original inputs, exercise the relevant application, and cover every acceptance criterion. A screenshot supplied by the Agent is supporting evidence, not sufficient approval. Native/private work requires the new dedicated-account adapter and its exact commissioned source/configuration; unavailable capabilities remain unadmitted.

Record successful and failed tool calls, timeouts, unavailable permissions, model identity, actual costs and exception minutes. Group related tasks across disjoint calibration and evaluation sets; correlated errors are not independent successes. Existing simulation results are unchanged, and no recent-model improvement is inserted as a synthetic performance assumption.

## Pinned implementation and review scope

The native integration was checked against OpenClaw [v2026.9.5 source](https://github.com/openclaw/openclaw/tree/v2026.9.5): the gateway client/device-auth modules, protocol version, node describe/invoke handlers, computer-use contract and computer-tool execution close path. It uses normal device approval, loopback token authentication, no-tool role-specific planning, frame-bound actions, stable execution IDs and explicit closure. It does not use the generic `nodes` model tool to bypass its computer-action restrictions.

Software fixtures exercise the actual WebSocket/HTTP transport with a mock gateway and desktop. This is implementation evidence, not a live OpenClaw/Mac/provider qualification. The [workforce gate](WORKFORCE_QUALIFICATION.md) preserves that distinction.

## Current native contract and refresh behavior

The OpenClaw node documentation requires a UUID `executionId` for direct
`computer.act` calls. CUA coordinate actions use a `screen.snapshot` from that
same execution, with its `displayFrameId` and returned width as `refWidth`.
The companion keeps these bindings and clears cached screen/window observations
before refreshing them: a failed or malformed refresh cannot authorize later
input using an older observation. Clock rollback also requires fresh observation.
These are local adapter tests; they do not establish live provider compatibility.

OpenAI’s current guide recommends code-driven computer work for GPT-6 Astra and
still supports structured computer actions. The native companion uses its bounded
OpenClaw planner/action interface. It does not silently install a new execution
path or give model-generated code access to the signing account. Qualify any
candidate model and tool path against the exact held-out job scope first.
