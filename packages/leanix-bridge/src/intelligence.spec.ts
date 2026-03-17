import { describe, expect, it } from 'vitest'
import {
  contextWithReconciliation,
  contextWithSyncPlan,
  minimalContext,
} from './bridge-context-fixtures'
import {
  checkGovernance,
  detectDrift,
  explainImpact,
  explainReconciliation,
  generateAdrFromContext,
  listUnmatched,
  summarizeEnterpriseContext,
} from './intelligence'

describe('explainImpact', () => {
  it('returns available: false when context has no syncPlan or impactReport', () => {
    const ctx = minimalContext()
    const result = explainImpact(ctx)
    expect(result.available).toBe(false)
    expect(result.report).toBeUndefined()
    expect(result.summary).toBeUndefined()
  })

  it('returns available: false when context has reconciliation but no impactReport or syncPlan', () => {
    const ctx = contextWithReconciliation()
    expect(ctx.impactReport).toBeUndefined()
    const result = explainImpact(ctx)
    expect(result.available).toBe(false)
  })

  it('returns available: true with report and summary when context has syncPlan', () => {
    const ctx = contextWithSyncPlan()
    const result = explainImpact(ctx)
    expect(result.available).toBe(true)
    expect(result.report).toBeDefined()
    expect(result.report?.summary.factSheetsToCreate).toBe(2)
    expect(result.summary).toBeDefined()
    expect(result.summary).toContain('2 fact sheet(s) to create')
  })
})

describe('detectDrift', () => {
  it('returns available: false when context has no reconciliation', () => {
    const ctx = minimalContext()
    const result = detectDrift(ctx)
    expect(result.available).toBe(false)
  })

  it('returns drift report when context has reconciliation', () => {
    const ctx = contextWithReconciliation()
    const result = detectDrift(ctx)
    expect(result.available).toBe(true)
    expect(result.report).toBeDefined()
    expect(result.report?.status).toBeDefined()
    expect(result.summary).toBe(result.report?.description)
  })
})

describe('listUnmatched', () => {
  it('returns available: false when context has no reconciliation', () => {
    const ctx = minimalContext()
    const result = listUnmatched(ctx)
    expect(result.available).toBe(false)
  })

  it('returns unmatched arrays and summary when context has reconciliation', () => {
    const ctx = contextWithReconciliation()
    const result = listUnmatched(ctx)
    expect(result.available).toBe(true)
    expect(Array.isArray(result.unmatchedInLikec4)).toBe(true)
    expect(Array.isArray(result.unmatchedInLeanix)).toBe(true)
    expect(Array.isArray(result.ambiguous)).toBe(true)
    expect(result.summary).toEqual(ctx.reconciliation!.summary)
  })
})

describe('explainReconciliation', () => {
  it('returns available: false when context has no reconciliation', () => {
    const ctx = minimalContext()
    const result = explainReconciliation(ctx)
    expect(result.available).toBe(false)
  })

  it('returns summary and description when context has reconciliation', () => {
    const ctx = contextWithReconciliation()
    const result = explainReconciliation(ctx)
    expect(result.available).toBe(true)
    expect(result.summary).toEqual(ctx.reconciliation!.summary)
    expect(result.description).toContain('Matched:')
  })
})

describe('generateAdrFromContext', () => {
  it('returns available: false when context has no reconciliation or driftReport', () => {
    const ctx = minimalContext()
    const result = generateAdrFromContext(ctx)
    expect(result.available).toBe(false)
  })

  it('returns markdown when context has reconciliation', () => {
    const ctx = contextWithReconciliation()
    const result = generateAdrFromContext(ctx)
    expect(result.available).toBe(true)
    expect(result.markdown).toBeDefined()
    expect(result.markdown).toContain('# ')
    expect(result.markdown).toContain('Reconciliation')
  })
})

describe('checkGovernance', () => {
  it('returns available: false when context has no reconciliation', () => {
    const ctx = minimalContext()
    const result = checkGovernance(ctx)
    expect(result.available).toBe(false)
  })

  it('returns report and summary when context has reconciliation', () => {
    const ctx = contextWithReconciliation()
    const result = checkGovernance(ctx)
    expect(result.available).toBe(true)
    expect(result.report).toBeDefined()
    expect(result.report?.checks.length).toBeGreaterThan(0)
    expect(result.summary).toBeDefined()
  })
})

describe('summarizeEnterpriseContext', () => {
  it('returns structured summary for minimal context', () => {
    const ctx = minimalContext()
    const result = summarizeEnterpriseContext(ctx)
    expect(result.projectId).toBe('test-project')
    expect(result.mappingProfile).toBe('default')
    expect(result.entityCount).toBe(3)
    expect(result.relationCount).toBe(2)
    expect(result.viewCount).toBe(2)
    expect(result.hasReconciliation).toBe(false)
    expect(result.hasSnapshot).toBe(false)
    expect(result.summaryText).toContain('Project test-project')
  })

  it('includes drift and governance when reconciliation present', () => {
    const ctx = contextWithReconciliation()
    const result = summarizeEnterpriseContext(ctx)
    expect(result.hasReconciliation).toBe(true)
    expect(result.driftStatus).toBeDefined()
    expect(result.governancePassed).toBeDefined()
    expect(result.summaryText).toContain('Drift status')
  })
})
