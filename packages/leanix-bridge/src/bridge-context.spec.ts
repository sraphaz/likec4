import { describe, expect, it } from 'vitest'
import {
  BRIDGE_CONTEXT_ARTIFACT_NAMES,
  buildBridgeContext,
} from './bridge-context'
import { createFixtureModel } from './fixture-model'
import type { LeanixInventorySnapshot } from './leanix-inventory-snapshot'
import { reconcileInventoryWithManifest } from './reconcile'
import { toBridgeManifest } from './to-bridge-manifest'
import { toLeanixInventoryDryRun } from './to-leanix-inventory-dry-run'

const FIXED_DATE = '2025-01-15T12:00:00.000Z'

describe('buildBridgeContext', () => {
  const model = createFixtureModel()
  const manifest = toBridgeManifest(model, { generatedAt: FIXED_DATE, mappingProfile: 'default' })
  const dryRun = toLeanixInventoryDryRun(model, { generatedAt: FIXED_DATE, mappingProfile: 'default' })

  it('builds context with minimal inputs (manifest + dryRun)', () => {
    const ctx = buildBridgeContext({ manifest, dryRun })
    expect(ctx.generatedAt).toBe(FIXED_DATE)
    expect(ctx.projectId).toBe('test-project')
    expect(ctx.mappingProfile).toBe('default')
    expect(ctx.manifest).toBe(manifest)
    expect(ctx.dryRun).toBe(dryRun)
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
    const snapshot: LeanixInventorySnapshot = {
      generatedAt: FIXED_DATE,
      factSheets: [
        { id: 'fs-1', name: 'Cloud', type: 'Application' },
        { id: 'fs-2', name: 'Backend', type: 'ITComponent' },
      ],
      relations: [],
    }
    const reconciliation = reconcileInventoryWithManifest(snapshot, manifest)
    const ctx = buildBridgeContext({
      manifest,
      dryRun,
      reconciliation,
    })
    expect(ctx.reconciliation).toBe(reconciliation)
    expect(ctx.driftReport).toBeDefined()
    expect(ctx.driftReport?.status).toBeDefined()
    expect(ctx.governanceReport).toBeDefined()
    expect(ctx.governanceReport?.checks.length).toBeGreaterThan(0)
  })

  it('attaches optional artifacts when provided', () => {
    const artifacts = { manifest: 'manifest.json', bridgeContext: 'bridge-context.json' }
    const ctx = buildBridgeContext({ manifest, dryRun, artifacts })
    expect(ctx.artifacts).toEqual(artifacts)
  })

  it('can skip building drift/governance from reconciliation when options set', () => {
    const snapshot: LeanixInventorySnapshot = {
      generatedAt: FIXED_DATE,
      factSheets: [{ id: 'fs-1', name: 'Cloud', type: 'Application' }],
      relations: [],
    }
    const reconciliation = reconcileInventoryWithManifest(snapshot, manifest)
    const ctx = buildBridgeContext({
      manifest,
      dryRun,
      reconciliation,
      buildDriftFromReconciliation: false,
      buildGovernanceFromReconciliation: false,
    })
    expect(ctx.reconciliation).toBe(reconciliation)
    expect(ctx.driftReport).toBeUndefined()
    expect(ctx.governanceReport).toBeUndefined()
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
