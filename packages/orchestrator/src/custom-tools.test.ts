import { describe, it, expect } from 'vitest';
import { buildCustomToolsServer } from './custom-tools';
import type { CustomToolConfig } from '@apexcli/core';
import {
  createTestToolConfig,
  loadValidToolFixtures,
} from '@apexcli/core/src/__tests__/fixtures/custom-tools/index.js';

describe('buildCustomToolsServer', () => {
  it('returns null when no tools are enabled', () => {
    const server = buildCustomToolsServer([], '/tmp');
    expect(server).toBeNull();
  });

  it('creates an SDK MCP server for enabled tools', () => {
    // Use fixture helper instead of inline configuration
    const toolConfig = createTestToolConfig({
      name: 'EchoTool',
      description: 'Echo input payload',
      timeoutMs: 1000,
    });

    const server = buildCustomToolsServer([toolConfig], '/tmp');
    expect(server).not.toBeNull();
    expect(server?.config.type).toBe('sdk');
    expect(server?.config.name).toBe('custom-tools');
  });

  it('can create server from fixture tools', async () => {
    // Demonstrate using actual fixture files
    const validTools = await loadValidToolFixtures();
    expect(validTools.length).toBeGreaterThan(0);

    // Use a subset of tools to create a server
    const enabledTools = validTools.slice(0, 3); // Use first 3 tools
    const server = buildCustomToolsServer(enabledTools, '/tmp');

    expect(server).not.toBeNull();
    expect(server?.config.type).toBe('sdk');
    expect(server?.config.name).toBe('custom-tools');
  });

  it('handles disabled tools from fixtures correctly', async () => {
    const validTools = await loadValidToolFixtures();

    // Find disabled tools
    const disabledTools = validTools.filter(tool => !tool.enabled);

    // Should return null when all tools are disabled
    const server = buildCustomToolsServer(disabledTools, '/tmp');
    expect(server).toBeNull();
  });
});
