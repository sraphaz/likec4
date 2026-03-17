// SPDX-License-Identifier: MIT
//
// LeanIX bridge MCP tools – minimal tests (read-only tools, no sync/LLM).

import { URI } from 'langium'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { summarizeEnterpriseContextTool } from './leanix-bridge'

const minimalBridgeContext = {
  generatedAt: '2025-01-01T00:00:00.000Z',
  bridgeVersion: '1',
  projectId: 'test-project',
  mappingProfile: 'default',
  semantic: { entities: [], relations: [], views: [] },
  manifest: {},
  dryRun: {},
}

describe('leanix-bridge MCP tools', () => {
  it('summarize-enterprise-context returns error when bridge-context.json is missing', async () => {
    const mockServices = {
      workspaceUri: URI.file(join(process.cwd(), 'packages', 'language-server', 'src', 'mcp', 'tools')),
    } as any
    const [_name, _config, handler] = summarizeEnterpriseContextTool(mockServices)
    const result = await handler({ bridgeOutDir: 'out/bridge' }, {} as any)
    expect(result.content).toHaveLength(1)
    expect(result.content![0]!.type).toBe('text')
    const text = (result.content![0] as { text: string }).text
    const data = JSON.parse(text) as { error?: string }
    expect(data.error).toBeDefined()
    expect(data.error).toContain('Bridge context not found')
  })

  it('summarize-enterprise-context returns JSON without error when bridge-context.json is valid', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'leanix-bridge-mcp-'))
    try {
      const outDir = 'out/bridge'
      const contextDir = join(tmp, outDir)
      mkdirSync(contextDir, { recursive: true })
      writeFileSync(
        join(contextDir, 'bridge-context.json'),
        JSON.stringify(minimalBridgeContext),
        'utf-8',
      )
      const mockServices = { workspaceUri: URI.file(tmp) } as any
      const [_name, _config, handler] = summarizeEnterpriseContextTool(mockServices)
      const result = await handler({ bridgeOutDir: outDir }, {} as any)
      expect(result.content).toHaveLength(1)
      const text = (result.content![0] as { text: string }).text
      const data = JSON.parse(text) as { error?: string; projectId?: string; summaryText?: string }
      expect(data.error).toBeUndefined()
      expect(data.projectId).toBe('test-project')
      expect(data.summaryText).toBeDefined()
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
