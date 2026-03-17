import {
  getFactSheetType,
  getRelationType,
  mergeWithDefault,
  resolveMappingConfig,
} from './mapping'
import type { LeanixMappingConfig, MappingProfileId, ResolvedLeanixMapping } from './mapping'
import type { BridgeModelInput } from './model-input'

/** Single LeanIX fact sheet in dry-run shape (no IDs from live API) */
export interface LeanixFactSheetDryRun {
  type: string
  likec4Id: string
  name: string
  description?: string
  technology?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

/** Single LeanIX relation in dry-run shape */
export interface LeanixRelationDryRun {
  type: string
  likec4RelationId: string
  sourceLikec4Id: string
  targetLikec4Id: string
  title?: string
}

/** Dry-run inventory: fact sheets and relations as would be sent to LeanIX, without live IDs */
export interface LeanixInventoryDryRun {
  generatedAt: string
  projectId: string
  mappingProfile: string
  factSheets: LeanixFactSheetDryRun[]
  relations: LeanixRelationDryRun[]
}

export interface ToLeanixInventoryDryRunOptions {
  /** Partial mapping merged with profile base, or full custom mapping when no built-in profile. */
  mapping?: LeanixMappingConfig | null
  /** Built-in profile id (default | enterprise) or custom string for manifest label. */
  mappingProfile?: MappingProfileId | string
  generatedAt?: string
}

/** Builds LeanIX fact sheet dry-run list from model elements and mapping. */
function buildFactSheetsFromModel(
  model: BridgeModelInput,
  mapping: ReturnType<typeof mergeWithDefault>,
): LeanixFactSheetDryRun[] {
  const factSheets: LeanixFactSheetDryRun[] = []
  for (const el of model.elements()) {
    const fsType = getFactSheetType(el.kind, mapping)
    const meta = el.getMetadata()
    const desc = typeof meta['description'] === 'string' ? meta['description'] : undefined
    const tech = el.technology ?? (typeof meta['technology'] === 'string' ? meta['technology'] : undefined)
    factSheets.push({
      type: fsType,
      likec4Id: el.id,
      name: el.title,
      ...(desc !== undefined && { description: desc }),
      ...(tech !== undefined && { technology: tech }),
      ...(el.tags.length > 0 && { tags: [...el.tags] }),
      ...(Object.keys(meta).length > 0 && { metadata: { ...meta } }),
    })
  }
  factSheets.sort((a, b) => a.likec4Id.localeCompare(b.likec4Id))
  return factSheets
}

/** Builds LeanIX relation dry-run list from model relationships and mapping. */
function buildRelationsFromModel(
  model: BridgeModelInput,
  mapping: ReturnType<typeof mergeWithDefault>,
): LeanixRelationDryRun[] {
  const relations: LeanixRelationDryRun[] = []
  for (const rel of model.relationships()) {
    const titleVal = rel.title ?? rel.kind
    relations.push({
      type: getRelationType(rel.kind, mapping),
      likec4RelationId: rel.id,
      sourceLikec4Id: rel.source.id,
      targetLikec4Id: rel.target.id,
      ...(titleVal != null && titleVal !== '' && { title: String(titleVal) }),
    })
  }
  relations.sort((a, b) => a.likec4RelationId.localeCompare(b.likec4RelationId))
  return relations
}

function resolveMappingAndProfile(options: ToLeanixInventoryDryRunOptions): {
  mapping: ResolvedLeanixMapping
  mappingProfile: string
} {
  const profileOpt = options.mappingProfile
  const useBuiltIn = profileOpt === 'default' || profileOpt === 'enterprise'

  if (useBuiltIn) {
    const mapping = resolveMappingConfig(profileOpt, options.mapping)
    return { mapping, mappingProfile: profileOpt }
  }
  if (options.mapping != null) {
    const mapping = mergeWithDefault(options.mapping)
    return { mapping, mappingProfile: profileOpt ?? 'custom' }
  }
  const mapping = resolveMappingConfig('default')
  return { mapping, mappingProfile: profileOpt ?? 'default' }
}

/**
 * Produces LeanIX-shaped inventory artifacts (fact sheets + relations) from a LikeC4 model.
 * Pure function; no live API. Use for dry-run and planning.
 */
export function toLeanixInventoryDryRun(
  model: BridgeModelInput,
  options: ToLeanixInventoryDryRunOptions = {},
): LeanixInventoryDryRun {
  const { mapping, mappingProfile } = resolveMappingAndProfile(options)
  const generatedAt = options.generatedAt ?? new Date().toISOString()

  return {
    generatedAt,
    projectId: model.projectId,
    mappingProfile,
    factSheets: buildFactSheetsFromModel(model, mapping),
    relations: buildRelationsFromModel(model, mapping),
  }
}
