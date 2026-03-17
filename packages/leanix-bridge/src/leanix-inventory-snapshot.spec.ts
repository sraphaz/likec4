import { describe, expect, it } from 'vitest'
import type { LeanixApiClient } from './leanix-api-client'
import { LeanixApiError } from './leanix-api-client'
import { fetchLeanixInventorySnapshot } from './leanix-inventory-snapshot'

const FIXED_DATE = '2025-01-15T12:00:00.000Z'

type MockFactSheet = {
  id: string
  name: string
  type: string
  likec4Id?: string
  attributes?: Array<{ key: string; value: string }>
}

/** Mock client: one page of fact sheets; factSheet(id) returns empty relations. */
function createMockClient(options: {
  factSheets: MockFactSheet[]
  likec4IdAttribute?: string
  includeAttributesInResponse?: boolean
}): LeanixApiClient {
  const { factSheets, likec4IdAttribute, includeAttributesInResponse } = options
  return {
    graphql: async (query: string, variables?: Record<string, unknown>) => {
      if (query.includes('allFactSheets')) {
        const requestAttributes = query.includes('factSheetAttributes')
        const nodes = factSheets.map(fs => {
          const attrs: Array<{ key: string; value: string }> = []
          if (likec4IdAttribute && fs.likec4Id) {
            attrs.push({ key: likec4IdAttribute, value: fs.likec4Id })
          }
          if ((requestAttributes && includeAttributesInResponse) || (requestAttributes && attrs.length > 0)) {
            for (const a of fs.attributes ?? []) {
              attrs.push(a)
            }
          }
          return {
            node: {
              id: fs.id,
              name: fs.name,
              type: fs.type,
              ...(attrs.length > 0 ? { factSheetAttributes: attrs } : {}),
            },
            cursor: fs.id,
          }
        })
        return {
          allFactSheets: {
            edges: nodes,
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        }
      }
      if (query.includes('factSheet(id:') || query.includes('factSheet(id:')) {
        const id = variables?.['id'] as string
        return {
          factSheet: {
            id,
            relations: { edges: [] },
          },
        }
      }
      throw new Error(`Unexpected query in mock: ${query.slice(0, 60)}`)
    },
  } as LeanixApiClient
}

describe('fetchLeanixInventorySnapshot', () => {
  it('returns snapshot with fact sheets and relations from mock', async () => {
    const factSheets = [
      { id: 'fs-1', name: 'Cloud', type: 'Application' },
      { id: 'fs-2', name: 'API', type: 'ITComponent' },
    ]
    const client = createMockClient({ factSheets })

    const snapshot = await fetchLeanixInventorySnapshot(client, {
      generatedAt: FIXED_DATE,
      maxFactSheets: 100,
    })

    expect(snapshot.generatedAt).toBe(FIXED_DATE)
    expect(snapshot.factSheets).toHaveLength(2)
    expect(snapshot.factSheets[0]).toEqual({ id: 'fs-1', name: 'Cloud', type: 'Application' })
    expect(snapshot.factSheets[1]).toEqual({ id: 'fs-2', name: 'API', type: 'ITComponent' })
    expect(Array.isArray(snapshot.relations)).toBe(true)
    expect(snapshot.relations).toHaveLength(0)
  })

  it('includes likec4Id on fact sheets when likec4IdAttribute is set and attribute present', async () => {
    const factSheets = [
      { id: 'fs-1', name: 'Cloud', type: 'Application', likec4Id: 'cloud' },
      { id: 'fs-2', name: 'API', type: 'ITComponent', likec4Id: 'cloud.api' },
    ]
    const client = createMockClient({ factSheets, likec4IdAttribute: 'likec4Id' })

    const snapshot = await fetchLeanixInventorySnapshot(client, {
      generatedAt: FIXED_DATE,
      likec4IdAttribute: 'likec4Id',
    })

    expect(snapshot.factSheets[0]?.likec4Id).toBe('cloud')
    expect(snapshot.factSheets[1]?.likec4Id).toBe('cloud.api')
  })

  it('throws when maxFactSheets is negative', async () => {
    const client = createMockClient({ factSheets: [] })

    await expect(
      fetchLeanixInventorySnapshot(client, { maxFactSheets: -1 }),
    ).rejects.toThrow('maxFactSheets must be a non-negative integer')
  })

  it('default profile returns minimal fields (backward compatible)', async () => {
    const factSheets = [
      { id: 'fs-1', name: 'App', type: 'Application' },
    ]
    const client = createMockClient({ factSheets })

    const snapshot = await fetchLeanixInventorySnapshot(client, {
      generatedAt: FIXED_DATE,
      profile: 'default',
    })

    expect(snapshot.factSheets[0]).toEqual({ id: 'fs-1', name: 'App', type: 'Application' })
  })

  it('enterprise profile maps factSheetAttributes to optional fields when present', async () => {
    const factSheets: MockFactSheet[] = [
      {
        id: 'fs-1',
        name: 'App',
        type: 'Application',
        attributes: [
          { key: 'lifecycle', value: 'active' },
          { key: 'status', value: 'operational' },
          { key: 'technology', value: 'Java' },
          { key: 'tags', value: 'core,legacy' },
        ],
      },
    ]
    const client = createMockClient({ factSheets, includeAttributesInResponse: true })

    const snapshot = await fetchLeanixInventorySnapshot(client, {
      generatedAt: FIXED_DATE,
      profile: 'enterprise',
    })

    expect(snapshot.factSheets).toHaveLength(1)
    expect(snapshot.factSheets[0]?.id).toBe('fs-1')
    expect(snapshot.factSheets[0]?.name).toBe('App')
    expect(snapshot.factSheets[0]?.type).toBe('Application')
    expect(snapshot.factSheets[0]?.lifecycle).toBe('active')
    expect(snapshot.factSheets[0]?.status).toBe('operational')
    expect(snapshot.factSheets[0]?.technology).toBe('Java')
    expect(snapshot.factSheets[0]?.tags).toEqual(['core', 'legacy'])
  })

  it('enterprise profile with no attributes returns valid snapshot (missing optional fields do not break)', async () => {
    const factSheets = [
      { id: 'fs-1', name: 'App', type: 'Application' },
    ]
    const client = createMockClient({ factSheets })

    const snapshot = await fetchLeanixInventorySnapshot(client, {
      generatedAt: FIXED_DATE,
      profile: 'enterprise',
    })

    expect(snapshot.factSheets).toHaveLength(1)
    expect(snapshot.factSheets[0]).toEqual({ id: 'fs-1', name: 'App', type: 'Application' })
  })

  it('throws when profile is invalid', async () => {
    const client = createMockClient({ factSheets: [] })

    await expect(
      fetchLeanixInventorySnapshot(client, { profile: 'invalid' as 'default' }),
    ).rejects.toThrow('profile must be one of: default, enterprise')
  })

  it('enterprise profile degrades to valid minimal snapshot when enriched query fails (unsupported field)', async () => {
    const factSheets = [
      { id: 'fs-1', name: 'App', type: 'Application' },
      { id: 'fs-2', name: 'DB', type: 'DataEntity' },
    ]
    const minimalClient = createMockClient({ factSheets })
    let allFactSheetsCallCount = 0
    const client: LeanixApiClient = {
      graphql: async (query: string, variables?: Record<string, unknown>) => {
        if (query.includes('allFactSheets')) {
          allFactSheetsCallCount++
          if (allFactSheetsCallCount === 1 && query.includes('factSheetAttributes')) {
            throw new LeanixApiError(
              'GraphQL request failed',
              undefined,
              [{ message: 'Field "factSheetAttributes" doesn\'t exist on type "FactSheet".' }],
            )
          }
          return (minimalClient as LeanixApiClient).graphql(query, variables)
        }
        return (minimalClient as LeanixApiClient).graphql(query, variables)
      },
    } as LeanixApiClient

    const snapshot = await fetchLeanixInventorySnapshot(client, {
      generatedAt: FIXED_DATE,
      profile: 'enterprise',
      maxFactSheets: 100,
    })

    expect(snapshot.factSheets).toHaveLength(2)
    expect(snapshot.factSheets[0]).toEqual({ id: 'fs-1', name: 'App', type: 'Application' })
    expect(snapshot.factSheets[1]).toEqual({ id: 'fs-2', name: 'DB', type: 'DataEntity' })
    expect(snapshot.relations).toHaveLength(0)
    expect(allFactSheetsCallCount).toBe(2)
  })

  it('default profile does not request factSheetAttributes when likec4IdAttribute is unset', async () => {
    const factSheets = [{ id: 'fs-1', name: 'App', type: 'Application' }]
    let requestedAttributes = false
    const client: LeanixApiClient = {
      graphql: async (query: string, variables?: Record<string, unknown>) => {
        if (query.includes('allFactSheets')) {
          requestedAttributes = requestedAttributes || query.includes('factSheetAttributes')
          return createMockClient({ factSheets }).graphql(query, variables)
        }
        return createMockClient({ factSheets }).graphql(query, variables)
      },
    } as LeanixApiClient

    await fetchLeanixInventorySnapshot(client, {
      generatedAt: FIXED_DATE,
      profile: 'default',
    })

    expect(requestedAttributes).toBe(false)
  })
})
