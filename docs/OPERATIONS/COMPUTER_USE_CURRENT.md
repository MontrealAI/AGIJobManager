# Computer-use integration — verified 22 September 2026

AGI Jobs covers work a person or team performs through a keyboard, mouse and screen. Job eligibility is broader than the capabilities commissioned on any particular machine. Admit work only when its actual tools, permissions, time and independent verification are available.

| Primary source | Current integration fact | Release decision |
| --- | --- | --- |
| [OpenAI computer use](https://developers.openai.com/api/docs/guides/tools-computer-use) | GPT-6 Astra supports code-driven interface work; structured computer actions remain available. | Preserve code, browser and desktop tools; bind the actual per-role model and reject silent fallbacks. |
| [Anthropic computer use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool) | The computer_toolset_20260801 client toolset offers batched desktop calls. | Keep the public specification provider independent. This release does not claim a commissioned Claude adapter. |
| [OpenClaw Codex computer use](https://docs.openclaw.ai/plugins/codex-computer-use) | Native Codex-harness computer use is a separate plugin path, with app-server permission and readiness checks. | This package does not install that native adapter, grant macOS permissions or infer its readiness from Docker health. Commission it separately before admitting host-native work. |
| [OpenClaw node computer use](https://docs.openclaw.ai/nodes/computer-use) | Node-backed computer tools provide a separate remote execution path. | Record the actual transport, host, permissions and driver; a connected node alone is not proof of a working desktop. |
| [OpenClaw macOS permissions](https://docs.openclaw.ai/platforms/mac/permissions) | Screen capture, Accessibility and Event Posting have separate permission checks; connected does not mean unlocked. | Require a real keyboard, mouse and capture rehearsal for native host desktop deployments. The bundled execution environment remains the isolated Docker desktop on the Mac. |

The private bundle keeps OpenClaw 2026.9.5 as its tested baseline, not a claim to the latest vendor build. It preserves separate signing and compute accounts, and checks each configured creator/reviewer model. A product announcement, model name or changed version number does not qualify a new runtime. Re-run the local tool rehearsal and held-out task evaluation after changing the model, tools, sandbox image or policy. No host-account access is inferred from the general job definition.

Independent Node review must reopen or recompute the result from original inputs, exercise the relevant application, and cover every acceptance criterion. A screenshot supplied by the Agent is supporting evidence, not sufficient approval. Work needing unavailable private-account actions must remain unadmitted until that adapter is implemented and commissioned.

Record successful and failed tool calls, timeouts, unavailable permissions, model identity, actual costs and exception minutes. Group related tasks across disjoint calibration and evaluation sets; correlated errors are not independent successes. Existing simulation results are unchanged, and no recent-model improvement is inserted as a synthetic performance assumption.
