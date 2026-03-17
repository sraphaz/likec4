/**
 * Deterministic intelligence functions over BridgeContext.
 * Pure, testable, machine-usable; no LLM. Structured JSON first, optional text summary second.
 */

import { generateAdrFromDriftReport, generateAdrFromReconciliation } from './adr-generation'
import type { BridgeContext } from './bridge-context'
import { buildDriftReport } from './drift-report'
import type { DriftReport } from './drift-report'
import { runGovernanceChecks } from './governance-checks'
import type { GovernanceReport } from './governance-checks'
import { impactReportFromSyncPlan } from './impact-report'
import type { ImpactReport } from './impact-report'
import type {
  AmbiguousMatch,
  ReconciliationResult,
  UnmatchedInLeanix,
  UnmatchedInLikec4,
} from './reconcile'

/** Structured result for explainImpact. */
export interface ExplainImpactResult {
  available: boolean
  report?: ImpactReport
  /** Human-readable one-line summary when available. */
  summary?: string
}

/**
 * Explains impact (what would change if sync were applied). Uses context.impactReport or builds from context.syncPlan.
 */
export function explainImpact(context: BridgeContext): ExplainImpactResult {
  if (context.impactReport != null) {
    return {
      available: true,
      report: context.impactReport,
      summary: context.impactReport.impactSummary,
    }
  }
  if (context.syncPlan != null) {
    const report = impactReportFromSyncPlan(context.syncPlan)
    return { available: true, report, summary: report.impactSummary }
  }
  return { available: false }
}

/** Structured result for detectDrift. */
export interface DetectDriftResult {
  available: boolean
  report?: DriftReport
  /** Human-readable drift description when available. */
  summary?: string
}

/**
 * Detects drift between LikeC4 and LeanIX. Uses context.driftReport or builds from context.reconciliation.
 */
export function detectDrift(context: BridgeContext): DetectDriftResult {
  if (context.driftReport != null) {
    return {
      available: true,
      report: context.driftReport,
      summary: context.driftReport.description,
    }
  }
  if (context.reconciliation != null) {
    const report = buildDriftReport(context.reconciliation)
    return { available: true, report, summary: report.description }
  }
  return { available: false }
}

/** Structured result for listUnmatched. */
export interface ListUnmatchedResult {
  available: boolean
  unmatchedInLikec4?: UnmatchedInLikec4[]
  unmatchedInLeanix?: UnmatchedInLeanix[]
  ambiguous?: AmbiguousMatch[]
  summary?: ReconciliationResult['summary']
}

/**
 * Lists unmatched entities (in LikeC4 only, in LeanIX only, ambiguous). Requires context.reconciliation.
 */
export function listUnmatched(context: BridgeContext): ListUnmatchedResult {
  if (context.reconciliation == null) {
    return { available: false }
  }
  const { unmatchedInLikec4, unmatchedInLeanix, ambiguous, summary } = context.reconciliation
  return {
    available: true,
    unmatchedInLikec4,
    unmatchedInLeanix,
    ambiguous,
    summary,
  }
}

/** Structured result for explainReconciliation. */
export interface ExplainReconciliationResult {
  available: boolean
  /** Summary counts. */
  summary?: ReconciliationResult['summary']
  /** Short human-readable explanation. */
  description?: string
}

/**
 * Explains reconciliation result (matched/unmatched counts). Requires context.reconciliation.
 */
export function explainReconciliation(context: BridgeContext): ExplainReconciliationResult {
  if (context.reconciliation == null) {
    return { available: false }
  }
  const { summary } = context.reconciliation
  const description =
    `Matched: ${summary.matched}; unmatched in LikeC4: ${summary.unmatchedInLikec4}; unmatched in LeanIX: ${summary.unmatchedInLeanix}; ambiguous: ${summary.ambiguous}`
  return { available: true, summary, description }
}

/** Structured result for generateAdrFromContext. */
export interface GenerateAdrFromContextResult {
  available: boolean
  /** ADR markdown when available. */
  markdown?: string
}

/**
 * Generates ADR-style markdown from context (reconciliation and/or drift, optional impact). Deterministic.
 */
export function generateAdrFromContext(context: BridgeContext): GenerateAdrFromContextResult {
  if (context.reconciliation != null) {
    const options = context.impactReport != null ? { impact: context.impactReport } : {}
    const markdown = generateAdrFromReconciliation(context.reconciliation, options)
    return { available: true, markdown }
  }
  if (context.driftReport != null) {
    const markdown = generateAdrFromDriftReport(context.driftReport)
    return { available: true, markdown }
  }
  return { available: false }
}

/** Structured result for checkGovernance. */
export interface CheckGovernanceResult {
  available: boolean
  report?: GovernanceReport
  /** One-line pass/fail summary when available. */
  summary?: string
}

/**
 * Runs governance checks on reconciliation. Uses context.governanceReport or runs from context.reconciliation.
 */
export function checkGovernance(context: BridgeContext): CheckGovernanceResult {
  if (context.governanceReport != null) {
    return {
      available: true,
      report: context.governanceReport,
      summary: context.governanceReport.passed ? 'All checks passed' : 'One or more checks failed',
    }
  }
  if (context.reconciliation != null) {
    const report = runGovernanceChecks(context.reconciliation)
    return {
      available: true,
      report,
      summary: report.passed ? 'All checks passed' : 'One or more checks failed',
    }
  }
  return { available: false }
}

/** Structured result for summarizeEnterpriseContext. */
export interface SummarizeEnterpriseContextResult {
  projectId: string
  mappingProfile: string
  entityCount: number
  relationCount: number
  viewCount: number
  hasReconciliation: boolean
  hasSnapshot: boolean
  /** Present when reconciliation/drift is available. */
  driftStatus?: string
  /** Present when governance was run. */
  governancePassed?: boolean
  /** Human-readable one-paragraph summary. */
  summaryText: string
}

/**
 * Summarizes the enterprise context (counts, presence of reconciliation/snapshot, drift and governance when available). Always returns structured data; summaryText is deterministic.
 */
export function summarizeEnterpriseContext(context: BridgeContext): SummarizeEnterpriseContextResult {
  const entityCount = context.semantic.entities.length
  const relationCount = context.semantic.relations.length
  const viewCount = context.semantic.views?.length ?? 0
  const hasReconciliation = context.reconciliation != null
  const hasSnapshot = context.inventorySnapshot != null

  let driftStatus: string | undefined
  const driftResult = detectDrift(context)
  if (driftResult.available && driftResult.report != null) {
    driftStatus = driftResult.report.status
  }

  let governancePassed: boolean | undefined
  const govResult = checkGovernance(context)
  if (govResult.available && govResult.report != null) {
    governancePassed = govResult.report.passed
  }

  const parts: string[] = [
    `Project ${context.projectId} (profile: ${context.mappingProfile}): ${entityCount} entities, ${relationCount} relations, ${viewCount} views.`,
  ]
  if (hasSnapshot) parts.push('LeanIX snapshot loaded.')
  if (hasReconciliation) parts.push('Reconciliation available.')
  if (driftStatus != null) parts.push(`Drift status: ${driftStatus}.`)
  if (governancePassed !== undefined) {
    parts.push(governancePassed ? 'Governance: passed.' : 'Governance: one or more checks failed.')
  }

  const summaryText = parts.join(' ')

  return {
    projectId: context.projectId,
    mappingProfile: context.mappingProfile,
    entityCount,
    relationCount,
    viewCount,
    hasReconciliation,
    hasSnapshot,
    ...(driftStatus !== undefined && { driftStatus }),
    ...(governancePassed !== undefined && { governancePassed }),
    summaryText,
  }
}
