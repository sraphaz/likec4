# Playbook: bridge, Draw.io (LeanIX profile) e assistentes de IA

Documento operacional para humanos e agentes que mexem em **LeanIX bridge**, **export Draw.io** e **skills/docs de IA**. Não substitui o README de `@likec4/leanix-bridge` nem `likec4 --help`.

## 1. Quando usar o quê

| Necessidade                                           | Ferramenta                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| Validar / exportar DSL genérico                       | `likec4 validate`, `likec4 export …` (ver skill `references/cli.md`) |
| Artefactos bridge (manifest, dry-run, report)         | `likec4 gen leanix dry-run -o out/bridge`                            |
| Plano ou sync LeanIX                                  | `likec4 sync leanix --dry-run` / `--apply`                           |
| Draw.io com metadados bridge                          | `likec4 export drawio --profile leanix -o ./diagrams`                |
| Consultar modelo no IDE (elementos, vistas, relações) | MCP `likec4 mcp` / `@likec4/mcp`                                     |

## 2. Revisão e drift (vocabulário)

- **Manifest**: identidade canónica LikeC4 ↔ artefactos bridge (`mappingProfile`, `projectId`, entidades, relações, vistas).
- **Dry-run LeanIX**: lista tipada de fact sheets / relações derivada do modelo + mapping.
- **Drift**: diferença entre o que o manifest declara e o inventário LeanIX (reconciliação / relatórios de impacto, conforme fase do bridge).
- **Draw.io leanix profile**: células com `bridgeManaged=true` e ids estáveis (`likec4Id`, `likec4RelationId`, …); não confundir com export `default`.

Checklist rápido antes de PR ou sync:

1. `likec4 validate` no projeto.
2. Regenerar `out/bridge` se alterou modelo ou mapping.
3. Se usou Draw.io round-trip, confirmar que o XML ainda contém os atributos esperados do perfil ou comentários `likec4.layout.drawio` quando aplicável.

## 3. Alinhamento com Agent Skills

- O skill `likec4-dsl` deve apontar para `references/bridge-leanix-drawio.md` quando a tarefa for bridge/LeanIX/Draw.io leanix.
- Não orientar o utilizador a “inventar” JSON de manifest; usar CLI ou API pública do pacote bridge.

## 4. Ligações

- Backlog de integridade: [BACKLOG-skills-drawio-leanix-integrity.md](./BACKLOG-skills-drawio-leanix-integrity.md)
- Gaps (investigação): [INVESTIGATION-skills-drawio-leanix-alignment.md](./INVESTIGATION-skills-drawio-leanix-alignment.md)
- Plano (secção 18): [PLAN-ai-ready-bridge-phases.md](./PLAN-ai-ready-bridge-phases.md)
