/**
 * Built-in generator: LeanIX bridge dry-run.
 * likec4 gen leanix dry-run [path]
 * Writes manifest.json, leanix-dry-run.json, report.json to out/bridge (or -o/--outdir).
 */

import { fromWorkspace } from '@likec4/language-services/node/without-mcp'
import type { LeanixMappingConfig } from '@likec4/leanix-bridge'
import { readFile } from 'node:fs/promises'
import k from 'tinyrainbow'
import { createLikeC4Logger, startTimer } from '../../logger'
import { LikeC4Model } from '../../model'
import {
  asBridgeModel,
  buildBridgeArtifacts,
  ERR_EMPTY_MODEL,
  writeBridgeArtifacts,
} from '../bridge/shared'
import { ensureProject } from '../utils'

export type LeanixDryRunHandlerParams = {
  path: string
  outdir: string
  project: string | undefined
  useDotBin: boolean
  mappingProfile?: 'default' | 'enterprise'
  mappingOverridePath?: string
}

/**
 * Loads mapping overrides from a JSON file. Throws if file is invalid or not LeanixMappingConfig-shaped.
 */
async function loadMappingOverrides(path: string): Promise<LeanixMappingConfig> {
  const raw = await readFile(path, 'utf8')
  const data = JSON.parse(raw) as unknown
  if (data === null || typeof data !== 'object') {
    throw new Error(`Invalid mapping override file: expected object, got ${typeof data}`)
  }
  const obj = data as Record<string, unknown>
  const out: LeanixMappingConfig = {}
  if (obj['factSheetTypes'] != null && typeof obj['factSheetTypes'] === 'object') {
    out.factSheetTypes = obj['factSheetTypes'] as Record<string, string>
  }
  if (obj['relationTypes'] != null && typeof obj['relationTypes'] === 'object') {
    out.relationTypes = obj['relationTypes'] as Record<string, string>
  }
  if (obj['metadataToFields'] != null && typeof obj['metadataToFields'] === 'object') {
    out.metadataToFields = obj['metadataToFields'] as Record<string, string>
  }
  return out
}

/**
 * Builds bridge artifacts (manifest, leanix-dry-run, report) from the workspace model and writes them to outdir.
 *
 * @param params - workspace path, outdir, project, useDotBin, optional mappingProfile and mappingOverridePath
 * @returns Promise<void>
 * @throws Error when workspace has no project or empty model
 */
export async function leanixDryRunHandler(params: LeanixDryRunHandlerParams): Promise<void> {
  const logger = createLikeC4Logger('c4:gen:leanix:dry-run')
  const timer = startTimer(logger)
  const {
    path: workspacePath,
    outdir,
    project,
    useDotBin,
    mappingProfile,
    mappingOverridePath,
  } = params

  try {
    await using likec4 = await fromWorkspace(workspacePath, {
      graphviz: useDotBin ? 'binary' : 'wasm',
      watch: false,
    })
    const { projectId } = ensureProject(likec4, project)
    if (project) {
      logger.info(`${k.dim('project')} ${k.green(projectId)}`)
    }

    const model = await likec4.layoutedModel(projectId)
    if (model === LikeC4Model.EMPTY) {
      logger.error(ERR_EMPTY_MODEL)
      throw new Error(ERR_EMPTY_MODEL)
    }

    const bridgeModel = asBridgeModel(model)
    const mappingOverrides = mappingOverridePath
      ? await loadMappingOverrides(mappingOverridePath)
      : undefined
    const buildOptions: Parameters<typeof buildBridgeArtifacts>[1] = {}
    if (mappingProfile != null) {
      buildOptions.mappingProfile = mappingProfile
    }
    if (mappingOverrides != null) {
      buildOptions.mappingOverrides = mappingOverrides
    }
    const artifacts = buildBridgeArtifacts(bridgeModel, buildOptions)
    await writeBridgeArtifacts(outdir, artifacts, logger)
  } finally {
    timer.stopAndLog()
  }
}
