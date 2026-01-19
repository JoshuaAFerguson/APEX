/**
 * MCP Imports Verification Test
 *
 * This test verifies that all MCP-related imports and exports work correctly.
 */

import { describe, it, expect } from 'vitest';

describe('MCP Imports Verification', () => {
  it('should import MCPConnectionManager successfully', async () => {
    const { MCPConnectionManager } = await import('../mcp/connection-manager.js');
    expect(MCPConnectionManager).toBeDefined();
    expect(typeof MCPConnectionManager).toBe('function');
  });

  it('should import MCPToolRegistry successfully', async () => {
    const { MCPToolRegistry } = await import('../mcp-tool-registry.js');
    expect(MCPToolRegistry).toBeDefined();
    expect(typeof MCPToolRegistry).toBe('function');
  });

  it('should import MCPClient successfully', async () => {
    const { MCPClient } = await import('../mcp/client.js');
    expect(MCPClient).toBeDefined();
    expect(typeof MCPClient).toBe('function');
  });

  it('should import SchemaTranslator successfully', async () => {
    const { SchemaTranslator } = await import('../schema-translator.js');
    expect(SchemaTranslator).toBeDefined();
    expect(typeof SchemaTranslator).toBe('function');
  });

  it('should import mock server utilities successfully', async () => {
    const mockServerModule = await import('./utils/mock-mcp-server.js');
    expect(mockServerModule.createMockServer).toBeDefined();
    expect(mockServerModule.createTestScenario).toBeDefined();
    expect(mockServerModule.PREDEFINED_SERVERS).toBeDefined();
  });

  it('should import core types successfully', async () => {
    const coreModule = await import('@apexcli/core');
    // Verify some key types are available
    expect(coreModule).toBeDefined();
  });
});