# Investigação: alinhamento Agent Skills, Draw.io e LeanIX

## Contexto

O repositório publica **Agent Skills** em `skills/likec4-dsl/` focados em DSL e CLI genérico. O **LeanIX bridge** e o **perfil Draw.io `leanix`** vivem no pacote `@likec4/leanix-bridge` e no CLI (`likec4 gen leanix`, `likec4 sync leanix`, `likec4 export drawio --profile leanix`).

## Gaps identificados (estado)

| Gap                                         | Mitigação                                                       |
| ------------------------------------------- | --------------------------------------------------------------- |
| Agentes sem referência ao bridge            | `references/bridge-leanix-drawio.md` + linha no índice do skill |
| CLI skill sem tabela bridge/LeanIX          | Secção em `references/cli.md`                                   |
| Docs “AI tools” sem contraste MCP vs bridge | Secções em `apps/docs/.../ai-tools.mdx`                         |
| Playbook interno inexistente                | `docs/PLAYBOOK-bridge-drawio-ai.md`                             |
| Mapping editável sem validação rígida       | Validação em `mergeWithDefault` (`@likec4/leanix-bridge`)       |

## Conclusão

Skills e documentação de IA devem **citar explicitamente** os comandos bridge e o perfil Draw.io quando relevante, e deixar claro que **MCP não substitui** geração/sync LeanIX.

Ver backlog: [BACKLOG-skills-drawio-leanix-integrity.md](./BACKLOG-skills-drawio-leanix-integrity.md).
