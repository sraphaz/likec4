/**
 * Bridge-context: compact, machine-usable artifact contract for AI/MCP consumption.
 * Projection only; no raw Draw.io or layout blobs.
 */

import { BRIDGE_VERSION } from './contracts'
import type { BridgeManifest } from './contracts'
import { buildDriftReport } from './drift-report'
import type { DriftReport } from './drift-report'
import { runGovernanceChecks } from './governance-checks'
import type { GovernanceReport } from './governance-checks'
import { impactReportFromSyncPlan } from './impact-report'
import type { ImpactReport } from './impact-report'
import type { LeanixInventorySnapshot } from './leanix-inventory-snapshot'
import type { ReconciliationResult } from './reconcile'
import type { SyncPlan } from './sync-to-leanix'
import type { LeanixInventoryDryRun } from './to-leanix-inventory-dry-run'

/** Minimal semantic entity (from manifest). */
export interface SemanticEntity {
  id: string
}

/** Minimal semantic relation (from manifest). */
export interface SemanticRelation {
  relationId: string
  sourceFqn: string
  targetFqn: string
}

/** Minimal semantic view (from manifest). */
export interface SemanticView {
  viewId: string
}

/** Centralized artifact file names (single source of truth). */
export const BRIDGE_CONTEXT_ARTIFACT_NAMES = {
  manifest: 'manifest.json',
  dryRun: 'leanix-dry-run.json',
  report: 'report.json',
  inventorySnapshot: 'leanix-inventory-snapshot.json',
  reconciliationReport: 'reconciliation-report.json',
  driftReport: 'drift-report.json',
  impactReport: 'impact-report.json',
  governanceReport: 'governance-report.json',
  adr: 'adr.md',
  syncPlan: 'sync-plan.json',
  bridgeContext: 'bridge-context.json',
} as const

/**
 * Bridge context: projection contract for AI/governance consumers.
 * Compact; no Draw.io XML or layout blobs.
 */
export interface BridgeContext {
  generatedAt: string
  bridgeVersion: string
  projectId: string
  workspaceId?: string
  mappingProfile: string
  semantic: {
    entities: SemanticEntity[]
    relations: SemanticRelation[]
    views?: SemanticView[]
  }
  manifest: BridgeManifest
  dryRun: LeanixInventoryDryRun
  inventorySnapshot?: LeanixInventorySnapshot
  reconciliation?: ReconciliationResult
  syncPlan?: SyncPlan
  driftReport?: DriftReport
  impactReport?: ImpactReport
  governanceReport?: GovernanceReport
  /** Optional list of artifact file names produced in this run. */
  artifacts?: Record<string, string>
}

export interface BuildBridgeContextInput {
  manifest: BridgeManifest
  dryRun: LeanixInventoryDryRun
  workspaceId?: string
  inventorySnapshot?: LeanixInventorySnapshot
  reconciliation?: ReconciliationResult
  syncPlan?: SyncPlan
  /** If true, build driftReport from reconciliation (when present). Default: true. */
  buildDriftFromReconciliation?: boolean
  /** If true, build impactReport from syncPlan (when present). Default: true. */
  buildImpactFromSyncPlan?: boolean
  /** If true, run governance checks on reconciliation (when present). Default: true. */
  buildGovernanceFromReconciliation?: boolean
  /** Optional artifact names to attach. */
  artifacts?: Record<string, string>
}

function projectSemantic(manifest: BridgeManifest): BridgeContext['semantic'] {
  const entities: SemanticEntity[] = Object.keys(manifest.entities).map(id => ({ id }))
  const relations: SemanticRelation[] = manifest.relations.map(r => ({
    relationId: r.relationId,
    sourceFqn: r.sourceFqn,
    targetFqn: r.targetFqn,
  }))
  const views: SemanticView[] = Object.keys(manifest.views).map(viewId => ({ viewId }))
  return { entities, relations, views }
}

/**
 * Builds the bridge context from available artifacts. Pure function.
 * Derives drift from reconciliation, impact from sync plan, governance from reconciliation when options allow.
 */
export function buildBridgeContext(input: BuildBridgeContextInput): BridgeContext {
  const {
    manifest,
    dryRun,
    workspaceId,
    inventorySnapshot,
    reconciliation,
    syncPlan,
    buildDriftFromReconciliation = true,
    buildImpactFromSyncPlan = true,
    buildGovernanceFromReconciliation = true,
    artifacts,
  } = input

  const generatedAt = manifest.generatedAt
  const bridgeVersion = BRIDGE_VERSION

  let driftReport: DriftReport | undefined
  if (reconciliation != null && buildDriftFromReconciliation) {
    driftReport = buildDriftReport(reconciliation)
  }

  let impactReport: ImpactReport | undefined
  if (syncPlan != null && buildImpactFromSyncPlan) {
    impactReport = impactReportFromSyncPlan(syncPlan)
  }

  let governanceReport: GovernanceReport | undefined
  if (reconciliation != null && buildGovernanceFromReconciliation) {
    governanceReport = runGovernanceChecks(reconciliation)
  }

  const ctx: BridgeContext = {
    generatedAt,
    bridgeVersion,
    projectId: manifest.projectId,
    ...(workspaceId != null ? { workspaceId } : {}),
    mappingProfile: manifest.mappingProfile,
    semantic: projectSemantic(manifest),
    manifest,
    dryRun,
    ...(inventorySnapshot != null ? { inventorySnapshot } : {}),
    ...(reconciliation != null ? { reconciliation } : {}),
    ...(syncPlan != null ? { syncPlan } : {}),
    ...(driftReport != null ? { driftReport } : {}),
    ...(impactReport != null ? { impactReport } : {}),
    ...(governanceReport != null ? { governanceReport } : {}),
    ...(artifacts != null ? { artifacts } : {}),
  }

  return ctx
}
