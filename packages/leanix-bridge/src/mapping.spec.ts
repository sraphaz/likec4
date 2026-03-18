import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_LEANIX_MAPPING,
  getFactSheetType,
  getMappingProfile,
  getRelationType,
  mergeMappingProfile,
  mergeWithDefault,
  registerMappingProfile,
  resolveMappingConfig,
} from './mapping'

describe('mapping', () => {
  describe('getMappingProfile', () => {
    it('returns default profile equal to DEFAULT_LEANIX_MAPPING', () => {
      const profile = getMappingProfile('default')
      expect(profile).not.toBeNull()
      expect(profile).toEqual(DEFAULT_LEANIX_MAPPING)
    })

    it('returns enterprise profile with container -> DataEntity', () => {
      const profile = getMappingProfile('enterprise')
      expect(profile).not.toBeNull()
      expect(profile!.factSheetTypes['container']).toBe('DataEntity')
      expect(profile!.relationTypes['calls']).toBe('calls')
    })

    it('returns null for unknown profile id', () => {
      expect(getMappingProfile('unknown')).toBeNull()
    })
  })

  describe('registerMappingProfile', () => {
    afterEach(() => {
      registerMappingProfile('default', DEFAULT_LEANIX_MAPPING)
    })

    it('allows getMappingProfile to resolve custom id', () => {
      registerMappingProfile('custom', { factSheetTypes: { system: 'CustomApp' } })
      const profile = getMappingProfile('custom')
      expect(profile).not.toBeNull()
      expect(profile!.factSheetTypes['system']).toBe('CustomApp')
      expect(profile!.factSheetTypes['container']).toBe('ITComponent')
    })
  })

  describe('mergeMappingProfile', () => {
    it('returns copy of base when overrides null', () => {
      const base = getMappingProfile('default')!
      const result = mergeMappingProfile(base, null)
      expect(result).toEqual(base)
      expect(result).not.toBe(base)
    })

    it('merges overrides onto base', () => {
      const base = getMappingProfile('default')!
      const result = mergeMappingProfile(base, {
        factSheetTypes: { system: 'OverriddenApp' },
      })
      expect(result.factSheetTypes['system']).toBe('OverriddenApp')
      expect(result.factSheetTypes['container']).toBe('ITComponent')
    })

    it('merges optional placeholders (customIdentityFields, governanceFields) when provided', () => {
      const base = getMappingProfile('default')!
      const result = mergeMappingProfile(base, {
        customIdentityFields: { likec4Id: 'likec4Id' },
        governanceFields: { owner: 'responsible' },
      })
      expect(result.customIdentityFields).toEqual({ likec4Id: 'likec4Id' })
      expect(result.governanceFields).toEqual({ owner: 'responsible' })
    })
  })

  describe('resolveMappingConfig', () => {
    it('default profile with no overrides equals DEFAULT_LEANIX_MAPPING', () => {
      const resolved = resolveMappingConfig('default')
      expect(resolved).toEqual(DEFAULT_LEANIX_MAPPING)
    })

    it('enterprise profile differs from default for container', () => {
      const resolved = resolveMappingConfig('enterprise')
      expect(resolved.factSheetTypes['container']).toBe('DataEntity')
    })

    it('merges overrides onto profile base', () => {
      const resolved = resolveMappingConfig('default', {
        factSheetTypes: { actor: 'CustomProvider' },
      })
      expect(resolved.factSheetTypes['actor']).toBe('CustomProvider')
      expect(resolved.factSheetTypes['system']).toBe('Application')
    })
  })

  describe('mergeWithDefault', () => {
    it('returns copy of default when partial is null/undefined', () => {
      const a = mergeWithDefault(null)
      const b = mergeWithDefault(undefined)
      expect(a).toEqual(DEFAULT_LEANIX_MAPPING)
      expect(b).toEqual(DEFAULT_LEANIX_MAPPING)
      expect(a).not.toBe(DEFAULT_LEANIX_MAPPING)
    })

    it('merges partial over defaults without mutating default', () => {
      const result = mergeWithDefault({
        factSheetTypes: { system: 'CustomApp' },
      })
      expect(result.factSheetTypes['system']).toBe('CustomApp')
      expect(result.factSheetTypes['container']).toBe('ITComponent')
      expect(DEFAULT_LEANIX_MAPPING.factSheetTypes['system']).toBe('Application')
    })
  })

  describe('getFactSheetType', () => {
    const mapping = mergeWithDefault(null)

    it('returns mapped type for known kind', () => {
      expect(getFactSheetType('system', mapping)).toBe('Application')
      expect(getFactSheetType('actor', mapping)).toBe('Provider')
    })

    it('returns Application for unknown kind when default not in mapping', () => {
      expect(getFactSheetType('unknownKind', mapping)).toBe('Application')
    })
  })

  describe('getRelationType', () => {
    const mapping = mergeWithDefault(null)

    it('returns mapped type for known kind', () => {
      expect(getRelationType('default', mapping)).toBe('depends on')
    })

    it('returns depends on for null/unknown kind', () => {
      expect(getRelationType(null, mapping)).toBe('depends on')
      expect(getRelationType('unknown', mapping)).toBe('depends on')
    })
  })
})
