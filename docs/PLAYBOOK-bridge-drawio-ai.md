# Playbook: bridge, Draw.io (LeanIX profile), and AI assistants

Operational guide for humans and agents working on the **LeanIX bridge**, **Draw.io export**, and **AI-oriented docs/skills**. It does not replace the `@likec4/leanix-bridge` README or `likec4 --help`.

## 1. Which tool for which job

| Need                                                    | Tool                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| Validate / export generic DSL                           | `likec4 validate`, `likec4 export …` (see skill `references/cli.md`) |
| Bridge artifacts (manifest, dry-run, report)            | `likec4 gen leanix dry-run -o out/bridge`                            |
| LeanIX sync plan or apply                               | `likec4 sync leanix --dry-run` / `--apply`                           |
| Draw.io with bridge metadata                            | `likec4 export drawio --profile leanix -o ./diagrams`                |
| Query model in the IDE (elements, views, relationships) | MCP `likec4 mcp` / `@likec4/mcp`                                     |

## 2. Review and drift (vocabulary)

- **Manifest**: canonical LikeC4 identity ↔ bridge artifacts (`mappingProfile`, `projectId`, entities, relations, views).
- **LeanIX dry-run**: typed list of fact sheets / relations derived from the model and mapping.
- **Drift**: gap between what the manifest states and LeanIX inventory (reconciliation / impact reports, depending on bridge phase).
- **Draw.io leanix profile**: cells with `bridgeManaged=true` and stable ids (`likec4Id`, `likec4RelationId`, …); do not confuse with the `default` export profile.

Quick checklist before a PR or sync:

1. Run `likec4 validate` on the project.
2. Regenerate `out/bridge` if the model or mapping changed.
3. If you used Draw.io round-trip, confirm the XML still has the expected profile attributes or `likec4.layout.drawio` comments where applicable.

## 3. Alignment with Agent Skills

- The `likec4-dsl` skill should point to `references/bridge-leanix-drawio.md` when the task involves bridge, LeanIX, or Draw.io leanix profile.
- Do not tell users to hand-author manifest JSON; use the CLI or the public `@likec4/leanix-bridge` APIs.

## 4. Links

- Integrity backlog: [BACKLOG-skills-drawio-leanix-integrity.md](./BACKLOG-skills-drawio-leanix-integrity.md)
- Gap analysis: [INVESTIGATION-skills-drawio-leanix-alignment.md](./INVESTIGATION-skills-drawio-leanix-alignment.md)
- Plan (section 18, local copy if present): [PLAN-ai-ready-bridge-phases.md](./PLAN-ai-ready-bridge-phases.md)
