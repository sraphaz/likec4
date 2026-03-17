// SPDX-License-Identifier: MIT
//
// LeanIX bridge MCP tools – minimal tests (read-only tools, no sync/LLM).

import { URI } from 'langium'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { summarizeEnterpriseContextTool } from './leanix-bridge'

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
})
