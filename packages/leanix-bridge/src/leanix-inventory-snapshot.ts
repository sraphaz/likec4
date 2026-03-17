/**
 * Inbound LeanIX: read-only snapshot of LeanIX inventory (fact sheets + relations).
 * Used for reconciliation with the LikeC4 manifest; no DSL generation.
 * Enriched optional fields are populated when using profile 'enterprise' and the tenant exposes them via factSheetAttributes.
 */

import type { LeanixApiClient } from './leanix-api-client'

/**
 * Fetch profile for inbound inventory snapshot.
 * - default: minimal fields (id, name, type, optional likec4Id); safe for all tenants.
 * - enterprise: requests factSheetAttributes and maps known keys to optional fields; missing keys are omitted (graceful fallback).
 */
export type LeanixInventoryFetchProfile = 'default' | 'enterprise'

/** Single fact sheet as returned from LeanIX API (read-only snapshot). */
export interface LeanixFactSheetSnapshotItem {
  id: string
  name: string
  type: string
  /** Set when fetched with likec4IdAttribute and the fact sheet has that custom attribute. */
  likec4Id?: string
  /** Optional enriched fields; present when profile is 'enterprise' and tenant exposes them. */
  lifecycle?: string
  status?: string
  owner?: string
  team?: string
  responsible?: string
  criticality?: string
  businessImportance?: string
  capabilities?: string[]
  domains?: string[]
  technology?: string
  platform?: string
  interfaces?: string[]
  tags?: string[]
  categories?: string[]
  /** Any other custom attribute key-value pairs not mapped to named fields. */
  customFields?: Record<string, string | string[] | undefined>
}

/** Single relation as returned from LeanIX API (read-only snapshot). */
export interface LeanixRelationSnapshotItem {
  id?: string
  sourceFactSheetId: string
  targetFactSheetId: string
  type: string
  /** Optional; present when profile is 'enterprise' and API returns it. */
  description?: string | null
  /** Optional metadata; tenant-specific shape. */
  metadata?: Record<string, unknown>
  /** Optional custom attribute key-value pairs. */
  customFields?: Record<string, string | string[] | undefined>
}

/** Read-only snapshot of LeanIX inventory for reconciliation. */
export interface LeanixInventorySnapshot {
  generatedAt: string
  /** Workspace or project identifier if available from API. */
  workspaceId?: string
  factSheets: LeanixFactSheetSnapshotItem[]
  relations: LeanixRelationSnapshotItem[]
}

export interface FetchLeanixInventorySnapshotOptions {
  /** Custom attribute key to read likec4Id from fact sheets (e.g. "likec4Id"). When set, snapshot items get likec4Id when present. */
  likec4IdAttribute?: string
  /** Max fact sheets to fetch (pagination). Default 1000. */
  maxFactSheets?: number
  /** ISO timestamp for snapshot. Default: new Date().toISOString() */
  generatedAt?: string
  /**
   * Fetch profile: 'default' (minimal fields, safe for all tenants) or 'enterprise' (requests factSheetAttributes and maps known keys to optional fields).
   * When a field is not present in the tenant, it is omitted; no crash.
   */
  profile?: LeanixInventoryFetchProfile
}

const DEFAULT_PAGE_SIZE = 100
const DEFAULT_MAX_FACT_SHEETS = 1000
const MAX_GRAPHQL_RETRIES = 3

/** Known factSheetAttribute keys mapped to LeanixFactSheetSnapshotItem optional fields (enterprise profile). Missing keys are omitted. */
const ENTERPRISE_ATTR_KEY_TO_FIELD: Record<string, keyof LeanixFactSheetSnapshotItem> = {
  lifecycle: 'lifecycle',
  status: 'status',
  owner: 'owner',
  team: 'team',
  responsible: 'responsible',
  criticality: 'criticality',
  businessImportance: 'businessImportance',
  technology: 'technology',
  platform: 'platform',
}
/** Attribute keys that are stored as string arrays (comma-separated or JSON). */
const ARRAY_ATTR_KEYS = new Set(['capabilities', 'domains', 'interfaces', 'tags', 'categories'])

async function withGraphQLRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_GRAPHQL_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < MAX_GRAPHQL_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
  }
  throw lastErr
}

/**
 * Fetches a read-only snapshot of the LeanIX inventory (fact sheets, then relations).
 * Uses cursor-based pagination. Does not modify LeanIX.
 */
const VALID_PROFILES: LeanixInventoryFetchProfile[] = ['default', 'enterprise']

export async function fetchLeanixInventorySnapshot(
  client: LeanixApiClient,
  options: FetchLeanixInventorySnapshotOptions = {},
): Promise<LeanixInventorySnapshot> {
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const maxFactSheets = options.maxFactSheets ?? DEFAULT_MAX_FACT_SHEETS
  if (!Number.isInteger(maxFactSheets) || maxFactSheets < 0) {
    throw new Error('maxFactSheets must be a non-negative integer')
  }
  const profile = options.profile ?? 'default'
  if (!VALID_PROFILES.includes(profile)) {
    throw new Error(`profile must be one of: ${VALID_PROFILES.join(', ')}`)
  }
  const likec4IdAttribute = options.likec4IdAttribute

  const factSheets = await fetchAllFactSheets(client, {
    ...(likec4IdAttribute != null ? { likec4IdAttribute } : {}),
    maxFactSheets,
    profile,
  })
  const relations = await fetchAllRelations(client, factSheets.map(f => f.id))

  return {
    generatedAt,
    factSheets,
    relations,
  }
}

type FactSheetNode = {
  id?: string
  name?: string
  type?: string
  factSheetAttributes?: Array<{ key?: string; value?: string }>
}

type AttrPair = { key?: string; value?: string }

/** Parses a single attribute value into string or string[] (comma-separated or JSON array). Safe fallback to string. */
function parseAttrValue(key: string, value: string | undefined): string | string[] | undefined {
  if (value === undefined || value === '') return undefined
  if (!ARRAY_ATTR_KEYS.has(key)) return value
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as unknown
      return Array.isArray(arr) ? arr.map(String) : [trimmed]
    } catch {
      return trimmed.includes(',') ? trimmed.split(',').map(s => s.trim()).filter(Boolean) : [trimmed]
    }
  }
  return trimmed.includes(',') ? trimmed.split(',').map(s => s.trim()).filter(Boolean) : [trimmed]
}

/** Builds optional enriched fields + customFields from factSheetAttributes (enterprise profile). No throw; missing keys omitted. */
function buildOptionalFieldsFromAttributes(
  attributes: AttrPair[] | undefined,
  likec4IdAttribute: string | undefined,
): Partial<
  Pick<
    LeanixFactSheetSnapshotItem,
    | 'lifecycle'
    | 'status'
    | 'owner'
    | 'team'
    | 'responsible'
    | 'criticality'
    | 'businessImportance'
    | 'technology'
    | 'platform'
    | 'capabilities'
    | 'domains'
    | 'interfaces'
    | 'tags'
    | 'categories'
    | 'customFields'
  >
> {
  if (!Array.isArray(attributes) || attributes.length === 0) return {}
  const customFields: Record<string, string | string[] | undefined> = {}
  const result: Record<string, string | string[] | undefined> = {}
  for (const a of attributes) {
    const key = typeof a.key === 'string' ? a.key.trim() : ''
    if (!key) continue
    const parsed = parseAttrValue(key, a.value)
    if (parsed === undefined) continue
    const fieldName = ENTERPRISE_ATTR_KEY_TO_FIELD[key] ?? (ARRAY_ATTR_KEYS.has(key) ? key : null)
    if (fieldName && !(key === likec4IdAttribute)) {
      result[fieldName] = parsed
    } else if (key !== likec4IdAttribute) {
      customFields[key] = parsed
    }
  }
  const out: Partial<LeanixFactSheetSnapshotItem> = { ...result }
  if (Object.keys(customFields).length > 0) out.customFields = customFields
  return out
}

/** Maps a GraphQL node to LeanixFactSheetSnapshotItem; returns null when node has no id. */
function mapNodeToFactSheetItem(
  node: FactSheetNode | undefined,
  likec4IdAttribute: string | undefined,
  profile: LeanixInventoryFetchProfile,
): LeanixFactSheetSnapshotItem | null {
  if (!node?.id) return null
  const attrs = node.factSheetAttributes
  const likec4Id = likec4IdAttribute != null && Array.isArray(attrs)
    ? attrs.find((a: AttrPair) => a.key === likec4IdAttribute)?.value
    : undefined
  const base: LeanixFactSheetSnapshotItem = {
    id: node.id,
    name: node.name ?? '',
    type: node.type ?? '',
    ...(likec4Id ? { likec4Id } : {}),
  }
  if (profile === 'enterprise' && Array.isArray(attrs) && attrs.length > 0) {
    Object.assign(base, buildOptionalFieldsFromAttributes(attrs, likec4IdAttribute))
  }
  return base
}

async function fetchAllFactSheets(
  client: LeanixApiClient,
  opts: { likec4IdAttribute?: string; maxFactSheets: number; profile: LeanixInventoryFetchProfile },
): Promise<LeanixInventorySnapshot['factSheets']> {
  const { likec4IdAttribute, profile } = opts
  const pageSize = Math.min(DEFAULT_PAGE_SIZE, opts.maxFactSheets)
  const result: LeanixInventorySnapshot['factSheets'] = []
  let after: string | null = null
  let hasNextPage = true

  const requestAttributes = profile === 'enterprise' || likec4IdAttribute != null
  const attributeSelection = requestAttributes ? `factSheetAttributes { key value }` : ''

  const query = `
    query AllFactSheets($first: Int!, $after: String, $filter: FilterInput) {
      allFactSheets(first: $first, after: $after, filter: $filter) {
        edges {
          node {
            id
            name
            type
            ${attributeSelection}
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `

  type PageRes = {
    allFactSheets?: {
      edges?: Array<{ node?: FactSheetNode; cursor?: string }>
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }
    }
  }

  const fetchPage = async (cursor: string | null): Promise<PageRes> =>
    withGraphQLRetry(() =>
      client.graphql<PageRes>(query, {
        first: pageSize,
        after: cursor,
        filter: {},
      })
    )

  while (hasNextPage && result.length < opts.maxFactSheets) {
    const data: PageRes = await fetchPage(after)
    const edges = data.allFactSheets?.edges ?? []
    const pageInfo = data.allFactSheets?.pageInfo

    for (const edge of edges) {
      if (result.length >= opts.maxFactSheets) break
      const item = mapNodeToFactSheetItem(edge.node, likec4IdAttribute, profile)
      if (item) result.push(item)
    }

    hasNextPage = pageInfo?.hasNextPage === true && result.length < opts.maxFactSheets
    after = pageInfo?.endCursor ?? null
  }

  return result
}

const RELATIONS_FETCH_CONCURRENCY = 10

async function fetchAllRelations(
  client: LeanixApiClient,
  factSheetIds: string[],
): Promise<LeanixInventorySnapshot['relations']> {
  if (factSheetIds.length === 0) return []

  const relations: LeanixRelationSnapshotItem[] = []
  const idSet = new Set(factSheetIds)

  type RelationsResult = {
    factSheet?: {
      id?: string
      relations?: {
        edges?: Array<{
          node?: {
            id?: string
            type?: string
            targetFactSheet?: { id?: string }
          }
        }>
      }
    }
  }

  const query = `
    query FactSheetRelations($id: ID!) {
      factSheet(id: $id) {
        id
        relations {
          edges {
            node {
              id
              type
              targetFactSheet { id }
            }
          }
        }
      }
    }
  `

  for (let i = 0; i < factSheetIds.length; i += RELATIONS_FETCH_CONCURRENCY) {
    const batch = factSheetIds.slice(i, i + RELATIONS_FETCH_CONCURRENCY)
    const results = await Promise.all(
      batch.map(sourceId => withGraphQLRetry(() => client.graphql<RelationsResult>(query, { id: sourceId }))),
    )
    for (let j = 0; j < results.length; j++) {
      const data = results[j]
      const sourceId = batch[j]
      if (sourceId === undefined) continue
      const edges = data?.factSheet?.relations?.edges ?? []
      for (const edge of edges) {
        const node = edge.node
        const targetId = node?.targetFactSheet?.id
        if (!targetId || !idSet.has(targetId)) continue
        relations.push({
          ...(node?.id ? { id: node.id } : {}),
          sourceFactSheetId: sourceId,
          targetFactSheetId: targetId,
          type: node?.type ?? 'RELATES_TO',
        })
      }
    }
  }

  return relations
}
