/**
 * Type guards for bridge artifacts (e.g. parsed JSON).
 * Keeps validation next to the type definitions (SRP).
 * Nested shapes are validated to avoid false positives (G2, G3).
 */

import type { BridgeManifest, ManifestEntity, ManifestRelation, ManifestView } from './contracts'
import type {
  LeanixFactSheetSnapshotItem,
  LeanixInventorySnapshot,
  LeanixRelationSnapshotItem,
} from './leanix-inventory-snapshot'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Optional string field: if present must be string. */
function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string'
}

/** Optional array of strings: if present must be string[]. */
function isOptionalStringArray(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (!Array.isArray(value)) return false
  return value.every(v => typeof v === 'string')
}

/** True if value is a valid customFields entry (undefined, string, or string[]). */
function isCustomFieldValue(value: unknown): boolean {
  return (
    value === undefined ||
    typeof value === 'string' ||
    (Array.isArray(value) && value.every(x => typeof x === 'string'))
  )
}

/** Optional record for customFields: if present must be object with string/string[]/undefined values. */
function isOptionalCustomFields(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'object' || value === null) return false
  return Object.values(value as Record<string, unknown>).every(isCustomFieldValue)
}

function isManifestEntity(value: unknown): value is ManifestEntity {
  if (!isRecord(value)) return false
  return typeof value['canonicalId'] === 'string'
}

function isManifestView(value: unknown): value is ManifestView {
  if (!isRecord(value)) return false
  return typeof value['viewId'] === 'string'
}

function isManifestRelation(value: unknown): value is ManifestRelation {
  if (!isRecord(value)) return false
  return (
    typeof value['relationId'] === 'string' &&
    typeof value['sourceFqn'] === 'string' &&
    typeof value['targetFqn'] === 'string' &&
    typeof value['compositeKey'] === 'string'
  )
}

const OPTIONAL_STRING_KEYS = [
  'likec4Id',
  'lifecycle',
  'status',
  'owner',
  'team',
  'responsible',
  'criticality',
  'businessImportance',
  'technology',
  'platform',
] as const
const OPTIONAL_STRING_ARRAY_KEYS = ['capabilities', 'domains', 'interfaces', 'tags', 'categories'] as const

function isLeanixFactSheetSnapshotItem(value: unknown): value is LeanixFactSheetSnapshotItem {
  if (!isRecord(value)) return false
  if (
    typeof value['id'] !== 'string' ||
    typeof value['name'] !== 'string' ||
    typeof value['type'] !== 'string'
  ) {
    return false
  }
  for (const key of OPTIONAL_STRING_KEYS) {
    if (value[key] !== undefined && !isOptionalString(value[key])) return false
  }
  for (const key of OPTIONAL_STRING_ARRAY_KEYS) {
    if (value[key] !== undefined && !isOptionalStringArray(value[key])) return false
  }
  if (value['customFields'] !== undefined && !isOptionalCustomFields(value['customFields'])) return false
  return true
}

function isLeanixRelationSnapshotItem(value: unknown): value is LeanixRelationSnapshotItem {
  if (!isRecord(value)) return false
  if (
    typeof value['sourceFactSheetId'] !== 'string' ||
    typeof value['targetFactSheetId'] !== 'string' ||
    typeof value['type'] !== 'string'
  ) {
    return false
  }
  if (value['id'] !== undefined && typeof value['id'] !== 'string') return false
  return true
}

/**
 * Returns true if the value is a valid BridgeManifest shape (manifestVersion, generatedAt, bridgeVersion, mappingProfile, projectId, entities, relations, views)
 * and nested entities/views/relations match expected shapes.
 */
export function isBridgeManifest(obj: unknown): obj is BridgeManifest {
  if (!isRecord(obj)) return false
  if (
    typeof obj['manifestVersion'] !== 'string' ||
    typeof obj['generatedAt'] !== 'string' ||
    typeof obj['bridgeVersion'] !== 'string' ||
    typeof obj['mappingProfile'] !== 'string' ||
    typeof obj['projectId'] !== 'string'
  ) {
    return false
  }
  const entities = obj['entities']
  if (typeof entities !== 'object' || entities === null || Array.isArray(entities)) return false
  for (const v of Object.values(entities)) {
    if (!isManifestEntity(v)) return false
  }
  const views = obj['views']
  if (typeof views !== 'object' || views === null || Array.isArray(views)) return false
  for (const v of Object.values(views)) {
    if (!isManifestView(v)) return false
  }
  const relations = obj['relations']
  if (!Array.isArray(relations)) return false
  for (const r of relations) {
    if (!isManifestRelation(r)) return false
  }
  return true
}

/**
 * Returns true if the value is a valid LeanixInventorySnapshot shape (generatedAt, factSheets and relations arrays)
 * and each fact sheet/relation item has required fields.
 */
export function isLeanixInventorySnapshot(obj: unknown): obj is LeanixInventorySnapshot {
  if (!isRecord(obj)) return false
  if (typeof obj['generatedAt'] !== 'string') return false
  if (obj['workspaceId'] !== undefined && typeof obj['workspaceId'] !== 'string') return false
  if (!Array.isArray(obj['factSheets'])) return false
  for (const fs of obj['factSheets']) {
    if (!isLeanixFactSheetSnapshotItem(fs)) return false
  }
  if (!Array.isArray(obj['relations'])) return false
  for (const rel of obj['relations']) {
    if (!isLeanixRelationSnapshotItem(rel)) return false
  }
  return true
}
