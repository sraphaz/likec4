import { describe, expect, it } from 'vitest'
import {
  BRIDGE_CONTEXT_ARTIFACT_NAMES,
  buildBridgeContext,
} from './bridge-context'
import {
  contextWithReconciliation,
  createMinimalSyncPlan,
  FIXED_DATE,
  minimalContext,
} from './bridge-context-fixtures'

describe('buildBridgeContext', () => {
  it('builds context with minimal inputs (manifest + dryRun)', () => {
    const ctx = minimalContext()
    expect(ctx.generatedAt).toBe(FIXED_DATE)
    expect(ctx.projectId).toBe('test-project')
    expect(ctx.mappingProfile).toBe('default')
    expect(ctx.semantic.entities).toHaveLength(3)
    expect(ctx.semantic.relations).toHaveLength(2)
    expect(ctx.semantic.views).toHaveLength(2)
    expect(ctx.inventorySnapshot).toBeUndefined()
    expect(ctx.reconciliation).toBeUndefined()
    expect(ctx.driftReport).toBeUndefined()
    expect(ctx.impactReport).toBeUndefined()
    expect(ctx.governanceReport).toBeUndefined()
  })

  it('builds context with reconciliation and derives drift and governance', () => {
    const ctx = contextWithReconciliation()
    expect(ctx.reconciliation).toBeDefined()
    expect(ctx.driftReport).toBeDefined()
    expect(ctx.driftReport?.status).toBeDefined()
    expect(ctx.governanceReport).toBeDefined()
    expect(ctx.governanceReport?.checks.length).toBeGreaterThan(0)
  })

  it('attaches optional artifacts when provided', () => {
    const ctx = minimalContext()
    const artifacts = { manifest: 'manifest.json', bridgeContext: 'bridge-context.json' }
    const ctxWithArtifacts = buildBridgeContext({
      manifest: ctx.manifest,
      dryRun: ctx.dryRun,
      artifacts,
    })
    expect(ctxWithArtifacts.artifacts).toEqual(artifacts)
  })

  it('can skip building drift/governance from reconciliation when options set', () => {
    const ctx = contextWithReconciliation()
    const reduced = buildBridgeContext({
      manifest: ctx.manifest,
      dryRun: ctx.dryRun,
      reconciliation: ctx.reconciliation,
      buildDriftFromReconciliation: false,
      buildGovernanceFromReconciliation: false,
    })
    expect(reduced.reconciliation).toBe(ctx.reconciliation)
    expect(reduced.driftReport).toBeUndefined()
    expect(reduced.governanceReport).toBeUndefined()
  })

  it('builds context with syncPlan and derives impactReport', () => {
    const ctx = minimalContext()
    const syncPlan = createMinimalSyncPlan()
    const ctxWithPlan = buildBridgeContext({
      manifest: ctx.manifest,
      dryRun: ctx.dryRun,
      syncPlan,
    })
    expect(ctxWithPlan.syncPlan).toBe(syncPlan)
    expect(ctxWithPlan.impactReport).toBeDefined()
    expect(ctxWithPlan.impactReport?.generatedAt).toBe(FIXED_DATE)
    expect(ctxWithPlan.impactReport?.summary.factSheetsToCreate).toBe(2)
    expect(ctxWithPlan.impactReport?.impactSummary).toContain('2 fact sheet(s) to create')
  })
})

describe('BRIDGE_CONTEXT_ARTIFACT_NAMES', () => {
  it('defines all centralized artifact file names', () => {
    expect(BRIDGE_CONTEXT_ARTIFACT_NAMES.manifest).toBe('manifest.json')
    expect(BRIDGE_CONTEXT_ARTIFACT_NAMES.dryRun).toBe('leanix-dry-run.json')
    expect(BRIDGE_CONTEXT_ARTIFACT_NAMES.report).toBe('report.json')
    expect(BRIDGE_CONTEXT_ARTIFACT_NAMES.inventorySnapshot).toBe('leanix-inventory-snapshot.json')
    expect(BRIDGE_CONTEXT_ARTIFACT_NAMES.reconciliationReport).toBe('reconciliation-report.json')
    expect(BRIDGE_CONTEXT_ARTIFACT_NAMES.driftReport).toBe('drift-report.json')
    expect(BRIDGE_CONTEXT_ARTIFACT_NAMES.impactReport).toBe('impact-report.json')
    expect(BRIDGE_CONTEXT_ARTIFACT_NAMES.governanceReport).toBe('governance-report.json')
    expect(BRIDGE_CONTEXT_ARTIFACT_NAMES.adr).toBe('adr.md')
    expect(BRIDGE_CONTEXT_ARTIFACT_NAMES.syncPlan).toBe('sync-plan.json')
    expect(BRIDGE_CONTEXT_ARTIFACT_NAMES.bridgeContext).toBe('bridge-context.json')
  })
})
