/**
 * likec4 gen leanix context [path]
 * Builds bridge-context.json from manifest + dry-run (and optional reconciliation, snapshot, sync-plan).
 * Writes derived reports when inputs exist.
 */

import { fromWorkspace } from '@likec4/language-services/node/without-mcp'
import type {
  BridgeManifest,
  LeanixInventoryDryRun,
  LeanixInventorySnapshot,
  ReconciliationResult,
  SyncPlan,
} from '@likec4/leanix-bridge'
import {
  buildBridgeContext,
  generateAdrFromReconciliation,
  isBridgeManifest,
  isLeanixInventorySnapshot,
} from '@likec4/leanix-bridge'
import { readFile, writeFile } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import k from 'tinyrainbow'
import { createLikeC4Logger, startTimer } from '../../logger'
import { LikeC4Model } from '../../model'
import {
  asBridgeModel,
  BRIDGE_ARTIFACT_NAMES,
  buildBridgeArtifacts,
  ERR_EMPTY_MODEL,
  writeBridgeArtifacts,
} from '../bridge/shared'
import { ensureProject } from '../utils'

export type LeanixContextHandlerParams = {
  path: string
  outdir: string
  project: string | undefined
  useDotBin: boolean
}

async function readJsonIfExists<T>(filePath: string, guard: (v: unknown) => v is T): Promise<T | undefined> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    return guard(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * Builds bridge-context.json from outdir artifacts (or workspace). Writes derived reports when inputs exist.
 */
export async function leanixContextHandler(params: LeanixContextHandlerParams): Promise<void> {
  const logger = createLikeC4Logger('c4:gen:leanix:context')
  const timer = startTimer(logger)
  const workspacePath = params.path ?? process.cwd()
  const { outdir, project, useDotBin } = params

  try {
    await mkdir(outdir, { recursive: true })

    const manifestPath = resolve(outdir, BRIDGE_ARTIFACT_NAMES.manifest)
    const dryRunPath = resolve(outdir, BRIDGE_ARTIFACT_NAMES.dryRun)

    let manifest: BridgeManifest
    let dryRun: LeanixInventoryDryRun

    const existingManifest = await readJsonIfExists(manifestPath, isBridgeManifest)
    const existingDryRun = await readJsonIfExists(dryRunPath, (v): v is LeanixInventoryDryRun => {
      return (
        v != null &&
        typeof v === 'object' &&
        'projectId' in v &&
        'factSheets' in v &&
        Array.isArray((v as LeanixInventoryDryRun).factSheets) &&
        'relations' in v &&
        Array.isArray((v as LeanixInventoryDryRun).relations)
      )
    })

    if (existingManifest != null && existingDryRun != null) {
      manifest = existingManifest
      dryRun = existingDryRun
      logger.info(`${k.dim('read')} ${relative(process.cwd(), manifestPath)} + ${BRIDGE_ARTIFACT_NAMES.dryRun}`)
    } else {
      await using likec4 = await fromWorkspace(workspacePath, {
        graphviz: useDotBin ? 'binary' : 'wasm',
        watch: false,
      })
      const { projectId } = ensureProject(likec4, project)
      const model = await likec4.layoutedModel(projectId)
      if (model === LikeC4Model.EMPTY) {
        logger.error(ERR_EMPTY_MODEL)
        throw new Error(ERR_EMPTY_MODEL)
      }
      const artifacts = buildBridgeArtifacts(asBridgeModel(model))
      manifest = artifacts.manifest
      dryRun = artifacts.dryRun
      await writeBridgeArtifacts(outdir, artifacts, logger)
    }

    const reconciliationPath = resolve(outdir, BRIDGE_ARTIFACT_NAMES.reconciliationReport)
    const snapshotPath = resolve(outdir, BRIDGE_ARTIFACT_NAMES.inventorySnapshot)
    const syncPlanPath = resolve(outdir, BRIDGE_ARTIFACT_NAMES.syncPlan)

    const reconciliation = await readJsonIfExists(reconciliationPath, (v): v is ReconciliationResult => {
      return (
        v != null &&
        typeof v === 'object' &&
        'generatedAt' in v &&
        'matched' in v &&
        Array.isArray((v as ReconciliationResult).matched) &&
        'summary' in v
      )
    })
    const inventorySnapshot = await readJsonIfExists(snapshotPath, isLeanixInventorySnapshot)
    const syncPlan = await readJsonIfExists(syncPlanPath, (v): v is SyncPlan => {
      return (
        v != null &&
        typeof v === 'object' &&
        'generatedAt' in v &&
        'projectId' in v &&
        'summary' in v &&
        Array.isArray((v as SyncPlan).factSheetPlans)
      )
    })

    const ctx = buildBridgeContext({
      manifest,
      dryRun,
      inventorySnapshot,
      reconciliation,
      syncPlan,
      artifacts: { ...BRIDGE_ARTIFACT_NAMES },
    })

    const contextPath = resolve(outdir, BRIDGE_ARTIFACT_NAMES.bridgeContext)
    await writeFile(contextPath, JSON.stringify(ctx, null, 2))
    logger.info(`${k.dim('generated')} ${relative(process.cwd(), contextPath)}`)

    if (ctx.driftReport != null) {
      const driftPath = resolve(outdir, BRIDGE_ARTIFACT_NAMES.driftReport)
      await writeFile(driftPath, JSON.stringify(ctx.driftReport, null, 2))
      logger.info(`${k.dim('generated')} ${relative(process.cwd(), driftPath)}`)
    }
    if (ctx.impactReport != null) {
      const impactPath = resolve(outdir, BRIDGE_ARTIFACT_NAMES.impactReport)
      await writeFile(impactPath, JSON.stringify(ctx.impactReport, null, 2))
      logger.info(`${k.dim('generated')} ${relative(process.cwd(), impactPath)}`)
    }
    if (ctx.governanceReport != null) {
      const govPath = resolve(outdir, BRIDGE_ARTIFACT_NAMES.governanceReport)
      await writeFile(govPath, JSON.stringify(ctx.governanceReport, null, 2))
      logger.info(`${k.dim('generated')} ${relative(process.cwd(), govPath)}`)
    }
    if (ctx.reconciliation != null) {
      const adrPath = resolve(outdir, BRIDGE_ARTIFACT_NAMES.adr)
      const adr = generateAdrFromReconciliation(ctx.reconciliation, {
        impact: ctx.impactReport ?? undefined,
      })
      await writeFile(adrPath, adr)
      logger.info(`${k.dim('generated')} ${relative(process.cwd(), adrPath)}`)
    }
  } finally {
    timer.stopAndLog()
  }
}
