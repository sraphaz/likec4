// SPDX-License-Identifier: MIT
//
// LeanIX bridge MCP tools (read-only). Consume BridgeContext from disk and deterministic intelligence functions.

import {
  BRIDGE_CONTEXT_ARTIFACT_NAMES,
  checkGovernance,
  detectDrift,
  explainImpact,
  explainReconciliation,
  generateAdrFromContext,
  listUnmatched,
  summarizeEnterpriseContext,
} from '@likec4/leanix-bridge'
import type { BridgeContext } from '@likec4/leanix-bridge'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as z from 'zod/v3'
import { likec4Tool } from '../utils'

const BRIDGE_OUTDIR_DEFAULT = 'out/bridge'

const bridgeOutDirSchema = {
  bridgeOutDir: z.string().optional().describe(
    'Directory relative to workspace containing bridge-context.json. Default: out/bridge',
  ),
}

function loadBridgeContext(workspaceFsPath: string, bridgeOutDir: string): BridgeContext | { error: string } {
  const contextPath = join(workspaceFsPath, bridgeOutDir, BRIDGE_CONTEXT_ARTIFACT_NAMES.bridgeContext)
  try {
    const raw = readFileSync(contextPath, 'utf-8')
    const data = JSON.parse(raw) as BridgeContext
    if (data == null || typeof data !== 'object' || !('manifest' in data) || !('dryRun' in data)) {
      return { error: `Invalid bridge-context at ${contextPath}: missing manifest or dryRun` }
    }
    return data
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('ENOENT')) {
      return {
        error:
          `Bridge context not found at ${contextPath}. Run \`likec4 gen leanix context -o ${bridgeOutDir}\` first.`,
      }
    }
    return { error: `Failed to load bridge context: ${message}` }
  }
}

export const summarizeEnterpriseContextTool = likec4Tool({
  name: 'leanix-summarize-enterprise-context',
  description: `
Summarize the LikeC4–LeanIX bridge state (entity/relation/view counts, drift, governance). Read-only.
Input: bridgeOutDir (optional). Default: out/bridge.
Returns JSON: projectId, mappingProfile, entityCount, relationCount, viewCount, hasReconciliation, hasSnapshot, driftStatus?, governancePassed?, summaryText.
`,
  inputSchema: bridgeOutDirSchema,
  outputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, title: 'Summarize LeanIX bridge context' },
}, async (languageServices, args) => {
  const outDir = args.bridgeOutDir ?? BRIDGE_OUTDIR_DEFAULT
  const ctx = loadBridgeContext(languageServices.workspaceUri.fsPath, outDir)
  if ('error' in ctx) return { error: ctx.error }
  return summarizeEnterpriseContext(ctx)
})

export const detectDriftTool = likec4Tool({
  name: 'leanix-detect-drift',
  description: 'Detect drift between LikeC4 and LeanIX. Read-only. Input: bridgeOutDir (optional).',
  inputSchema: bridgeOutDirSchema,
  outputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, title: 'Detect LeanIX drift' },
}, async (languageServices, args) => {
  const outDir = args.bridgeOutDir ?? BRIDGE_OUTDIR_DEFAULT
  const ctx = loadBridgeContext(languageServices.workspaceUri.fsPath, outDir)
  if ('error' in ctx) return { error: ctx.error }
  return detectDrift(ctx)
})

export const explainImpactTool = likec4Tool({
  name: 'leanix-explain-impact',
  description: 'Explain impact of applying sync (what would change). Read-only. Input: bridgeOutDir (optional).',
  inputSchema: bridgeOutDirSchema,
  outputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, title: 'Explain LeanIX sync impact' },
}, async (languageServices, args) => {
  const outDir = args.bridgeOutDir ?? BRIDGE_OUTDIR_DEFAULT
  const ctx = loadBridgeContext(languageServices.workspaceUri.fsPath, outDir)
  if ('error' in ctx) return { error: ctx.error }
  return explainImpact(ctx)
})

export const listUnmatchedTool = likec4Tool({
  name: 'leanix-list-unmatched',
  description:
    'List unmatched entities (in LikeC4 only, in LeanIX only, ambiguous). Read-only. Input: bridgeOutDir (optional).',
  inputSchema: bridgeOutDirSchema,
  outputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, title: 'List LeanIX unmatched entities' },
}, async (languageServices, args) => {
  const outDir = args.bridgeOutDir ?? BRIDGE_OUTDIR_DEFAULT
  const ctx = loadBridgeContext(languageServices.workspaceUri.fsPath, outDir)
  if ('error' in ctx) return { error: ctx.error }
  return listUnmatched(ctx)
})

export const explainReconciliationTool = likec4Tool({
  name: 'leanix-explain-reconciliation',
  description: 'Explain reconciliation result (matched/unmatched counts). Read-only. Input: bridgeOutDir (optional).',
  inputSchema: bridgeOutDirSchema,
  outputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, title: 'Explain LeanIX reconciliation' },
}, async (languageServices, args) => {
  const outDir = args.bridgeOutDir ?? BRIDGE_OUTDIR_DEFAULT
  const ctx = loadBridgeContext(languageServices.workspaceUri.fsPath, outDir)
  if ('error' in ctx) return { error: ctx.error }
  return explainReconciliation(ctx)
})

export const checkGovernanceTool = likec4Tool({
  name: 'leanix-check-governance',
  description: 'Run governance checks on reconciliation. Read-only. Input: bridgeOutDir (optional).',
  inputSchema: bridgeOutDirSchema,
  outputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, title: 'Check LeanIX governance' },
}, async (languageServices, args) => {
  const outDir = args.bridgeOutDir ?? BRIDGE_OUTDIR_DEFAULT
  const ctx = loadBridgeContext(languageServices.workspaceUri.fsPath, outDir)
  if ('error' in ctx) return { error: ctx.error }
  return checkGovernance(ctx)
})

export const generateAdrTool = likec4Tool({
  name: 'leanix-generate-adr',
  description: 'Generate ADR-style markdown from reconciliation/drift. Read-only. Input: bridgeOutDir (optional).',
  inputSchema: bridgeOutDirSchema,
  outputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, title: 'Generate LeanIX ADR' },
}, async (languageServices, args) => {
  const outDir = args.bridgeOutDir ?? BRIDGE_OUTDIR_DEFAULT
  const ctx = loadBridgeContext(languageServices.workspaceUri.fsPath, outDir)
  if ('error' in ctx) return { error: ctx.error }
  return generateAdrFromContext(ctx)
})
