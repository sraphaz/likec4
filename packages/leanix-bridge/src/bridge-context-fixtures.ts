/**
 * Shared test fixtures for bridge-context and intelligence specs.
 * Single source of truth for minimalContext, contextWithReconciliation, and sync plan.
 */

import { buildBridgeContext } from './bridge-context'
import type { BridgeContext } from './bridge-context'
import { createFixtureModel } from './fixture-model'
import type { LeanixInventorySnapshot } from './leanix-inventory-snapshot'
import { reconcileInventoryWithManifest } from './reconcile'
import type { SyncPlan } from './sync-to-leanix'
import { toBridgeManifest } from './to-bridge-manifest'
import { toLeanixInventoryDryRun } from './to-leanix-inventory-dry-run'

export const FIXED_DATE = '2025-01-15T12:00:00.000Z'

export function minimalContext(): BridgeContext {
  const model = createFixtureModel()
  const manifest = toBridgeManifest(model, { generatedAt: FIXED_DATE, mappingProfile: 'default' })
  const dryRun = toLeanixInventoryDryRun(model, { generatedAt: FIXED_DATE, mappingProfile: 'default' })
  return buildBridgeContext({ manifest, dryRun })
}

export function contextWithReconciliation(): BridgeContext {
  const model = createFixtureModel()
  const manifest = toBridgeManifest(model, { generatedAt: FIXED_DATE, mappingProfile: 'default' })
  const dryRun = toLeanixInventoryDryRun(model, { generatedAt: FIXED_DATE, mappingProfile: 'default' })
  const snapshot: LeanixInventorySnapshot = {
    generatedAt: FIXED_DATE,
    factSheets: [
      { id: 'fs-1', name: 'Cloud', type: 'Application' },
      { id: 'fs-2', name: 'Backend', type: 'ITComponent' },
    ],
    relations: [],
  }
  const reconciliation = reconcileInventoryWithManifest(snapshot, manifest)
  return buildBridgeContext({ manifest, dryRun, reconciliation })
}

/** Minimal SyncPlan for tests (e.g. buildBridgeContext with syncPlan → impactReport). */
export function createMinimalSyncPlan(overrides: Partial<SyncPlan> = {}): SyncPlan {
  return {
    generatedAt: FIXED_DATE,
    projectId: 'test-project',
    mappingProfile: 'default',
    summary: {
      factSheetsToCreate: 2,
      factSheetsToUpdate: 1,
      relationsToCreate: 1,
    },
    factSheetPlans: [],
    relationPlans: [],
    errors: [],
    ...overrides,
  }
}
