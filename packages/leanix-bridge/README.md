# @likec4/leanix-bridge

Bridge from the LikeC4 semantic model to LeanIX-shaped inventory artifacts. LikeC4 remains the canonical source of truth.

- **Dry-run**: identity manifest, LeanIX-shaped artifacts (fact sheets + relations), configurable mapping.
- **Sync plan** (optional): `planSyncToLeanix(dryRun, client)` queries LeanIX (read-only) and returns a plan artifact describing what would be created vs updated; use before live sync to review changes.
- **Live sync** (optional): `syncToLeanix(manifest, dryRun, client)` to create/update fact sheets and relations in the LeanIX API (auth, rate limiting, idempotency).
- **Draw.io ↔ LeanIX**: `manifestToDrawioLeanixMapping(manifest)` for round-trip mapping (likec4Id ↔ LeanIX fact sheet id) after sync.

## Scope

- **In scope**: identity manifest, dry-run, configurable mapping, **LeanIX API sync**, **Draw.io–LeanIX mapping**, **Phase 2 inbound** (inventory snapshot, reconciliation), **Phase 3** (impact analysis, drift detection, ADR generation, governance checks), tests.
- **Out of scope**: AI features, new top-level CLI namespaces.

## Usage

### First-class CLI (recommended)

From the project root:

```bash
# Generate bridge artifacts (manifest, leanix-dry-run.json, report) to out/bridge
likec4 gen leanix dry-run -o out/bridge

# Use enterprise mapping profile (container → DataEntity, extra relation types)
likec4 gen leanix dry-run -o out/bridge --mapping-profile enterprise

# Merge overrides from a JSON file onto the default profile
likec4 gen leanix dry-run -o out/bridge --mapping-override ./mapping-overrides.json

# Sync workflow: write artifacts and optional sync-plan (read-only when LEANIX_API_TOKEN is set)
likec4 sync leanix --dry-run -o out/bridge

# Live sync to LeanIX (requires LEANIX_API_TOKEN)
likec4 sync leanix --apply -o out/bridge

# Phase 2 inbound: fetch LeanIX inventory (read-only), then reconcile with manifest
# Fetch LeanIX inventory snapshot (read-only) to out/bridge (default profile: minimal, safest for all tenants)
likec4 gen leanix inventory -o out/bridge
# Optional: enterprise profile = best-effort enrichment from factSheetAttributes; if the tenant does not support them, falls back to valid minimal snapshot
likec4 gen leanix inventory -o out/bridge --profile enterprise
# Run reconciliation between manifest and LeanIX inventory, output to out/bridge
likec4 gen leanix reconcile -o out/bridge

# Build bridge-context.json (and derived reports when inputs exist)
# Reads manifest + dry-run from outdir, or builds from workspace; writes bridge-context.json, optionally drift/impact/governance reports and adr.md
likec4 gen leanix context -o out/bridge
```

Export Draw.io with LeanIX profile (includes bridge-managed metadata for round-trip sync):

```bash
likec4 export drawio --profile leanix -o ./diagrams
```

The `--profile leanix` flag selects the LeanIX export profile so vertices and edges carry likec4Id, likec4ViewId, likec4RelationId, and bridgeManaged attributes for sync and round-trip.

### Custom generator (alternative)

You can still wire the bridge in your LikeC4 config:

```ts
// likec4.config.ts
import { defineConfig } from '@likec4/config'
import {
  buildBridgeReport,
  toBridgeManifest,
  toLeanixInventoryDryRun,
} from '@likec4/leanix-bridge'

export default defineConfig({
  name: 'my-project',
  generators: {
    'my-leanix': async ({ likec4model, ctx }) => {
      const manifest = toBridgeManifest(likec4model, { mappingProfile: 'default' })
      const dryRun = toLeanixInventoryDryRun(likec4model, { mappingProfile: 'default' })
      const report = buildBridgeReport(manifest, dryRun)

      await ctx.write({ path: ['out', 'bridge', 'manifest.json'], content: JSON.stringify(manifest, null, 2) })
      await ctx.write({ path: ['out', 'bridge', 'leanix-dry-run.json'], content: JSON.stringify(dryRun, null, 2) })
      await ctx.write({ path: ['out', 'bridge', 'report.json'], content: JSON.stringify(report, null, 2) })

      // Phase 2 (programmatic): e.g. import { reconcileInventoryWithManifest } from '@likec4/leanix-bridge', then
      // reconciliation = reconcileInventoryWithManifest(snapshot, manifest) and ctx.write(..., JSON.stringify(reconciliation, null, 2))
    },
  },
})
```

Then run: `likec4 gen my-leanix`

### Optional: sync plan (review before sync)

Before pushing to LeanIX, you can produce a **sync plan** that queries LeanIX (read-only) to see what would be created vs updated:

```ts
import { LeanixApiClient, planSyncToLeanix } from '@likec4/leanix-bridge'

const client = new LeanixApiClient({
  apiToken: process.env.LEANIX_API_TOKEN!,
  baseUrl: 'https://app.leanix.net',
  requestDelayMs: 200,
})
const plan = await planSyncToLeanix(dryRun, client, { idempotent: true })
// plan.summary: { factSheetsToCreate, factSheetsToUpdate, relationsToCreate }
// plan.factSheetPlans: [{ likec4Id, name, type, action: 'create'|'update', existingFactSheetId? }]
// Write plan to out/bridge/sync-plan.json for review, then run sync
```

### Optional: sync to LeanIX API

After generating the dry-run artifacts (and optionally the sync plan), you can push them to LeanIX (requires an API token):

```ts
import { LeanixApiClient, syncToLeanix, manifestToDrawioLeanixMapping } from '@likec4/leanix-bridge'

const client = new LeanixApiClient({
  apiToken: process.env.LEANIX_API_TOKEN!,
  baseUrl: 'https://app.leanix.net',
  requestDelayMs: 200,
})
const result = await syncToLeanix(manifest, dryRun, client, { idempotent: true })
// result.manifest has external.leanix.factSheetId per entity
const mapping = manifestToDrawioLeanixMapping(result.manifest)
// Use mapping.likec4IdToLeanixId for Draw.io round-trip
```

## API

- **`toBridgeManifest(model, options?)`** – builds the identity manifest (canonical IDs + placeholder external IDs).
- **`toLeanixInventoryDryRun(model, options?)`** – builds LeanIX-shaped fact sheets and relations (no live IDs). Options: `mappingProfile?` (`'default'` | `'enterprise'` or custom string for manifest label), `mapping?` (partial overrides merged onto profile), `generatedAt?`.
- **`buildBridgeReport(manifest, leanixDryRun)`** – builds a summary report with counts and artifact names.
- **`LeanixApiClient(config)`** – GraphQL client with Bearer auth and rate limiting (`apiToken`, `baseUrl?`, `requestDelayMs?`).
- **`planSyncToLeanix(leanixDryRun, client, options?)`** – queries LeanIX (read-only) and returns a **sync plan** (`SyncPlan`): per–fact sheet and per-relation actions (`create` / `update`), summary counts, and any query errors. Use before `syncToLeanix` to review what would change. Options: `idempotent?`, `generatedAt?`.
- **`syncToLeanix(manifest, leanixDryRun, client, options?)`** – syncs dry-run to LeanIX API; returns updated manifest with `external.leanix.factSheetId` and relation IDs. Options: `idempotent?`, `likec4IdAttribute?`.
- **`manifestToDrawioLeanixMapping(manifest)`** – returns `{ likec4IdToLeanixId, relationKeyToLeanixRelationId }` for Draw.io bridge-managed export or re-import from LeanIX.
- **`fetchLeanixInventorySnapshot(client, options?)`** – fetches a read-only snapshot of LeanIX fact sheets and relations (paginated); returns `LeanixInventorySnapshot`. Options: `likec4IdAttribute?`, `maxFactSheets?`, `generatedAt?`, `profile?` (`'default'` | `'enterprise'`). **Default profile** is minimal and safest for all tenants. **Enterprise profile** is best-effort: requests factSheetAttributes and maps them to optional fact-sheet fields (lifecycle, status, owner, technology, tags, etc.); if the tenant schema does not support these fields, the call degrades to a valid minimal snapshot instead of failing. Relations in the snapshot contain only `id`, `sourceFactSheetId`, `targetFactSheetId`, `type` (no relation enrichment in this API).
- **`reconcileInventoryWithManifest(snapshot, manifest, options?)`** – compares manifest to LeanIX snapshot; returns `ReconciliationResult` (matched, unmatchedInLikec4, unmatchedInLeanix, ambiguous). Optional `dryRun` improves matching.
- **`buildDriftReport(reconciliation)`** – builds a `DriftReport` from a `ReconciliationResult` (status, summary, description); accepts a single `ReconciliationResult` and returns `DriftReport`.
- **`impactReportFromSyncPlan(plan)`** – computes impact analysis from a sync plan; returns `ImpactReport` with affected entities and severity.
- **`generateAdrFromReconciliation(reconciliation, options?)`** – generates ADR-style markdown from a reconciliation result. **`generateAdrFromDriftReport(drift, options?)`** – generates ADR-style markdown from a drift report.
- **`runGovernanceChecks(reconciliation, options?)`** – runs configurable governance rules on a `ReconciliationResult`; accepts optional `GovernanceCheckOptions` and returns `GovernanceReport` with pass/fail and violation messages.
- **`isBridgeManifest(obj)`** / **`isLeanixInventorySnapshot(obj)`** – type guards for parsed JSON (e.g. from CLI artifact files).
- **`buildBridgeContext(input)`** – builds the **BridgeContext** artifact: a compact, machine-usable projection for AI/governance consumers. Input: `manifest`, `dryRun`, and optionally `workspaceId`, `inventorySnapshot`, `reconciliation`, `syncPlan`; when reconciliation/syncPlan are provided, drift report, impact report, and governance report are derived. Returns `BridgeContext` (no Draw.io XML or layout blobs). Use `likec4 gen leanix context` to write `bridge-context.json` and derived reports to disk.
- **`BRIDGE_CONTEXT_ARTIFACT_NAMES`** – centralized artifact file names: `manifest.json`, `leanix-dry-run.json`, `report.json`, `leanix-inventory-snapshot.json`, `reconciliation-report.json`, `drift-report.json`, `impact-report.json`, `governance-report.json`, `adr.md`, `sync-plan.json`, `bridge-context.json`.

### Mapping profiles and overrides

- **Mapping profile**: named base config for LikeC4 → LeanIX mapping. Built-in profiles:
  - **`default`** – current baseline: system→Application, container/component→ITComponent, actor→Provider; relation default "depends on". Same as `DEFAULT_LEANIX_MAPPING`.
  - **`enterprise`** – extends default: container→DataEntity; relation kinds `calls` and `contains` mapped.
- **Overrides**: partial `LeanixMappingConfig` merged on top of the chosen profile (e.g. override a single fact sheet type). Supported at API level via `options.mapping` and at CLI via `--mapping-override <path>` to a JSON file.
- **API**: `getMappingProfile(id)`, `registerMappingProfile(id, config)`, `mergeMappingProfile(base, overrides)`, `resolveMappingConfig(profileId, overrides?)`. Use `resolveMappingConfig('default' | 'enterprise', overrides)` to get the final config. Custom profile ids can be registered for tests or programmatic use; built-in ids are `'default'` and `'enterprise'`.
- **Future-facing**: `LeanixMappingConfig` includes optional placeholders `customIdentityFields` and `governanceFields` (both `Record<string, string>`). They are merged when provided via overrides or custom profiles but are not consumed by the bridge today; the profile shape can be extended later without breaking callers.

### Inbound snapshot and fetch profiles

- **`LeanixInventoryFetchProfile`**: `'default'` (minimal fields: id, name, type, optional likec4Id) or `'enterprise'` (requests factSheetAttributes and maps known keys to optional fields). The bridge does not assume every tenant exposes the same schema; with `enterprise`, missing attributes are omitted and the snapshot remains valid.
- **Enriched optional fields** (when profile is `enterprise` and the tenant exposes them via factSheetAttributes): lifecycle, status, owner, team, responsible, criticality, businessImportance, technology, platform, capabilities, domains, interfaces, tags, categories, customFields. Relations support optional description, metadata, customFields for future use.

### Bridge context (PR C)

The **bridge-context** is a single JSON artifact that projects the current bridge state for downstream consumers (e.g. tooling or future AI/MCP layers). It is **not** a raw dump: it contains manifest, dry-run, optional snapshot/reconciliation/sync-plan and derived reports (drift, impact, governance), plus a minimal **semantic** projection (entities, relations, views). It does **not** include Draw.io XML or layout. Generate it with `likec4 gen leanix context -o out/bridge`; the CLI writes `bridge-context.json` and, when inputs exist, drift-report.json, impact-report.json, governance-report.json, and adr.md.

### Deterministic intelligence functions (PR D)

Pure, testable functions over `BridgeContext`. No LLM; structured JSON first, optional text summary second. All take `context: BridgeContext` and return a typed result with `available: boolean` when the operation can be performed.

| Function | Description | Result when available |
|----------|-------------|------------------------|
| **`explainImpact(context)`** | Impact of applying sync (what would change). Uses `context.impactReport` or builds from `context.syncPlan`. | `ExplainImpactResult`: `report?: ImpactReport`, `summary?: string` |
| **`detectDrift(context)`** | Drift between LikeC4 and LeanIX. Uses `context.driftReport` or builds from `context.reconciliation`. | `DetectDriftResult`: `report?: DriftReport`, `summary?: string` |
| **`listUnmatched(context)`** | Unmatched entities (in LikeC4 only, in LeanIX only, ambiguous). Requires `context.reconciliation`. | `ListUnmatchedResult`: `unmatchedInLikec4`, `unmatchedInLeanix`, `ambiguous`, `summary` |
| **`explainReconciliation(context)`** | Matched/unmatched counts and short description. Requires `context.reconciliation`. | `ExplainReconciliationResult`: `summary`, `description` |
| **`generateAdrFromContext(context)`** | ADR-style markdown from reconciliation and/or drift (optional impact). | `GenerateAdrFromContextResult`: `markdown?: string` |
| **`checkGovernance(context)`** | Governance checks on reconciliation. Uses `context.governanceReport` or runs from `context.reconciliation`. | `CheckGovernanceResult`: `report?: GovernanceReport`, `summary?: string` |
| **`summarizeEnterpriseContext(context)`** | Structured summary: counts, drift status, governance pass/fail, one-paragraph text. Always available. | `SummarizeEnterpriseContextResult`: `projectId`, `mappingProfile`, `entityCount`, `relationCount`, `viewCount`, `hasReconciliation`, `hasSnapshot`, `driftStatus?`, `governancePassed?`, `summaryText` |

Import from `@likec4/leanix-bridge`:

```ts
import {
  buildBridgeContext,
  checkGovernance,
  detectDrift,
  explainImpact,
  explainReconciliation,
  generateAdrFromContext,
  listUnmatched,
  summarizeEnterpriseContext,
} from '@likec4/leanix-bridge'
```

## Contracts

- **canonicalId**: LikeC4 FQN (e.g. `cloud.backend.api`).
- **viewId**: LikeC4 view id (e.g. `index`, `landscape.overview`).
- **relationId** + **compositeKey**: `sourceFqn|targetFqn|relationId` for stable relation identity.
- **manifestVersion**, **generatedAt**, **bridgeVersion**, **mappingProfile**: manifest metadata.

## References

- [ADR-001: LeanIX bridge dry-run slice](../../docs/architecture-intelligence/adr-001-leanix-bridge-dry-run.md)
- [Implementation brief](../../docs/architecture-intelligence/implementation-brief.md)
