/**
 * Configurable LeanIX mapping: LikeC4 kinds/relations/tags → LeanIX fact sheet types and fields.
 * No universal taxonomy; safe defaults. Actor kind maps to 'Provider' unless overridden.
 */

export interface LeanixMappingConfig {
  /** LikeC4 element kind → LeanIX fact sheet type */
  factSheetTypes?: Record<string, string>
  /** LikeC4 relationship kind → LeanIX relation type name */
  relationTypes?: Record<string, string>
  /** LikeC4 tags / metadata keys → LeanIX field names (optional) */
  metadataToFields?: Record<string, string>
  /** Optional placeholder for future custom identity field mapping. Not consumed by the bridge today. */
  customIdentityFields?: Record<string, string>
  /** Optional placeholder for future governance field mapping. Not consumed by the bridge today. */
  governanceFields?: Record<string, string>
}

/** Built-in mapping profile identifiers. */
export type MappingProfileId = 'default' | 'enterprise'

/** Fallback when element kind is unknown (G25: named constant). */
export const FALLBACK_FACT_SHEET_TYPE = 'Application'

/** Fallback when relation kind is unknown (G25: named constant). */
export const FALLBACK_RELATION_TYPE = 'depends on'

/** Core mapping fields required for resolution. Placeholders (customIdentityFields, governanceFields) stay optional. */
export type LeanixMappingCore = Required<
  Pick<LeanixMappingConfig, 'factSheetTypes' | 'relationTypes' | 'metadataToFields'>
>

/** Default mapping: actor → Provider; override factSheetTypes/relationTypes as needed. Placeholders not set. */
export const DEFAULT_LEANIX_MAPPING: LeanixMappingCore = {
  factSheetTypes: {
    system: 'Application',
    container: 'ITComponent',
    component: 'ITComponent',
    actor: 'Provider',
  },
  relationTypes: {
    default: FALLBACK_RELATION_TYPE,
  },
  metadataToFields: {
    title: 'name',
    description: 'description',
    technology: 'technology',
  },
}

/**
 * Merges partial mapping config with DEFAULT_LEANIX_MAPPING; returns a full resolved mapping (core + optional placeholders).
 */
export function mergeWithDefault(partial?: LeanixMappingConfig | null): ResolvedLeanixMapping {
  const base: ResolvedLeanixMapping = {
    factSheetTypes: { ...DEFAULT_LEANIX_MAPPING.factSheetTypes },
    relationTypes: { ...DEFAULT_LEANIX_MAPPING.relationTypes },
    metadataToFields: { ...DEFAULT_LEANIX_MAPPING.metadataToFields },
  }
  if (!partial) {
    return base
  }
  const out: ResolvedLeanixMapping = {
    factSheetTypes: { ...base.factSheetTypes, ...partial.factSheetTypes },
    relationTypes: { ...base.relationTypes, ...partial.relationTypes },
    metadataToFields: { ...base.metadataToFields, ...partial.metadataToFields },
  }
  if (partial.customIdentityFields != null) {
    out.customIdentityFields = { ...partial.customIdentityFields }
  }
  if (partial.governanceFields != null) {
    out.governanceFields = { ...partial.governanceFields }
  }
  return out
}

/** Enterprise profile: extends default with DataEntity and extra relation types. Placeholders not set. */
const ENTERPRISE_LEANIX_MAPPING: LeanixMappingCore = {
  factSheetTypes: {
    ...DEFAULT_LEANIX_MAPPING.factSheetTypes,
    system: 'Application',
    container: 'DataEntity',
    component: 'ITComponent',
    actor: 'Provider',
  },
  relationTypes: {
    ...DEFAULT_LEANIX_MAPPING.relationTypes,
    default: 'depends on',
    calls: 'calls',
    contains: 'contains',
  },
  metadataToFields: {
    ...DEFAULT_LEANIX_MAPPING.metadataToFields,
  },
}

/** Resolved profile: core required + optional placeholders. Used by getMappingProfile / mergeMappingProfile. */
export type ResolvedLeanixMapping =
  & LeanixMappingCore
  & Pick<LeanixMappingConfig, 'customIdentityFields' | 'governanceFields'>

function cloneResolvedMapping(mapping: ResolvedLeanixMapping): ResolvedLeanixMapping {
  const out: ResolvedLeanixMapping = {
    factSheetTypes: { ...mapping.factSheetTypes },
    relationTypes: { ...mapping.relationTypes },
    metadataToFields: { ...mapping.metadataToFields },
  }
  if (mapping.customIdentityFields != null) {
    out.customIdentityFields = { ...mapping.customIdentityFields }
  }
  if (mapping.governanceFields != null) {
    out.governanceFields = { ...mapping.governanceFields }
  }
  return out
}

const profileRegistry = new Map<string, ResolvedLeanixMapping>([
  ['default', DEFAULT_LEANIX_MAPPING],
  ['enterprise', ENTERPRISE_LEANIX_MAPPING],
])

/**
 * Returns the full mapping config for a registered profile id.
 * Built-in: 'default' | 'enterprise'. Custom ids only if registered via registerMappingProfile.
 * Returns a clone so mutating the result does not affect the registry.
 */
export function getMappingProfile(id: string): ResolvedLeanixMapping | null {
  const profile = profileRegistry.get(id)
  return profile ? cloneResolvedMapping(profile) : null
}

/**
 * Registers a custom mapping profile. Use for tests or programmatic overrides.
 * Overwrites if id already exists (including built-in 'default' | 'enterprise').
 */
export function registerMappingProfile(id: string, config: LeanixMappingConfig): void {
  const full = mergeWithDefault(config)
  profileRegistry.set(id, full)
}

/**
 * Merges a partial config onto a base; returns full resolved mapping (core + optional placeholders).
 */
export function mergeMappingProfile(
  base: ResolvedLeanixMapping,
  overrides?: LeanixMappingConfig | null,
): ResolvedLeanixMapping {
  if (!overrides) {
    return cloneResolvedMapping(base)
  }
  const out: ResolvedLeanixMapping = {
    factSheetTypes: { ...base.factSheetTypes, ...overrides.factSheetTypes },
    relationTypes: { ...base.relationTypes, ...overrides.relationTypes },
    metadataToFields: { ...base.metadataToFields, ...overrides.metadataToFields },
  }
  if (overrides.customIdentityFields != null) {
    out.customIdentityFields = { ...(base.customIdentityFields ?? {}), ...overrides.customIdentityFields }
  } else if (base.customIdentityFields != null) {
    out.customIdentityFields = { ...base.customIdentityFields }
  }
  if (overrides.governanceFields != null) {
    out.governanceFields = { ...(base.governanceFields ?? {}), ...overrides.governanceFields }
  } else if (base.governanceFields != null) {
    out.governanceFields = { ...base.governanceFields }
  }
  return out
}

/**
 * Resolves final mapping: profile base + optional overrides.
 * Use getMappingProfile(profileId) for base; if profile is unknown, returns default and merges overrides.
 */
export function resolveMappingConfig(
  profileId: MappingProfileId,
  overrides?: LeanixMappingConfig | null,
): ResolvedLeanixMapping {
  const base = getMappingProfile(profileId) ?? DEFAULT_LEANIX_MAPPING
  return mergeMappingProfile(base, overrides)
}

/**
 * Returns LeanIX fact sheet type for a LikeC4 element kind.
 * Uses mapping.factSheetTypes[kind], then 'default', then FALLBACK_FACT_SHEET_TYPE.
 */
export function getFactSheetType(likec4Kind: string, mapping: LeanixMappingCore): string {
  return (
    mapping.factSheetTypes[likec4Kind] ??
      mapping.factSheetTypes['default'] ??
      FALLBACK_FACT_SHEET_TYPE
  )
}

/**
 * Returns LeanIX relation type for a LikeC4 relationship kind.
 * Uses mapping.relationTypes[kind], then 'default', then FALLBACK_RELATION_TYPE.
 */
export function getRelationType(likec4Kind: string | null, mapping: LeanixMappingCore): string {
  const kind = likec4Kind ?? 'default'
  return (
    mapping.relationTypes[kind] ??
      mapping.relationTypes['default'] ??
      FALLBACK_RELATION_TYPE
  )
}
