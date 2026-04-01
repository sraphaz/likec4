# Investigation: Agent Skills, Draw.io, and LeanIX alignment

## Context

The repository publishes **Agent Skills** under `skills/likec4-dsl/` focused on the DSL and generic CLI. The **LeanIX bridge** and the **Draw.io `leanix` profile** live in `@likec4/leanix-bridge` and the CLI (`likec4 gen leanix`, `likec4 sync leanix`, `likec4 export drawio --profile leanix`).

## Identified gaps (status)

| Gap                                        | Mitigation                                                 |
| ------------------------------------------ | ---------------------------------------------------------- |
| Agents without bridge reference            | `references/bridge-leanix-drawio.md` + skill index row     |
| Skill CLI missing bridge/LeanIX table      | Section in `references/cli.md`                             |
| “AI tools” docs missing MCP vs bridge      | Sections in `apps/docs/.../ai-tools.mdx`                   |
| No internal playbook                       | `docs/PLAYBOOK-bridge-drawio-ai.md`                        |
| Editable mapping without strict validation | Validation in `mergeWithDefault` (`@likec4/leanix-bridge`) |

## Conclusion

Skills and AI-facing documentation should **explicitly mention** bridge commands and the Draw.io profile when relevant, and state clearly that **MCP does not replace** LeanIX generation/sync.

See backlog: [BACKLOG-skills-drawio-leanix-integrity.md](./BACKLOG-skills-drawio-leanix-integrity.md).
