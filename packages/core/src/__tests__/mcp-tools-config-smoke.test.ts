import { describe, it, expect } from 'vitest';
import {
  MCPToolsConfigSchema,
  MCPToolsConfig,
  MCPConfigSchema,
} from '../types.js';

/**
 * Smoke test for MCPToolsConfig to ensure basic functionality works
 * This is a minimal test to verify that the schema and types are correctly implemented
 */
describe('MCPToolsConfig Smoke Test', () => {
  it('should import and parse a basic MCPToolsConfig', () => {
    // Test basic schema exists and can parse
    expect(MCPToolsConfigSchema).toBeDefined();
    expect(typeof MCPToolsConfigSchema.parse).toBe('function');

    // Test parsing with defaults
    const result = MCPToolsConfigSchema.parse({});
    expect(result.autoDiscovery).toBe(true);
    expect(result.enableCaching).toBe(true);
    expect(result.maxConcurrentTools).toBe(10);
    expect(result.timeoutMs).toBe(30000);
    expect(result.enableValidation).toBe(true);
    expect(result.allowedTools).toEqual([]);
    expect(result.deniedTools).toEqual([]);
    expect(result.enableLogging).toBe(false);
  });

  it('should parse a custom configuration', () => {
    const config = {
      autoDiscovery: false,
      enableCaching: true,
      maxConcurrentTools: 5,
      timeoutMs: 15000,
      enableValidation: false,
      allowedTools: ['test-tool'],
      deniedTools: ['banned-tool'],
      enableLogging: true,
    };

    const result = MCPToolsConfigSchema.parse(config);
    expect(result).toEqual(config);
  });

  it('should work as part of MCPConfig', () => {
    const mcpConfig = {
      enabled: true,
      servers: {},
      tools: {
        autoDiscovery: true,
        maxConcurrentTools: 8,
      },
    };

    const result = MCPConfigSchema.parse(mcpConfig);
    expect(result.tools?.autoDiscovery).toBe(true);
    expect(result.tools?.maxConcurrentTools).toBe(8);
    expect(result.tools?.enableCaching).toBe(true); // Default
  });

  it('should have correct TypeScript types', () => {
    const config: MCPToolsConfig = {
      autoDiscovery: true,
      enableCaching: true,
      maxConcurrentTools: 10,
      timeoutMs: 30000,
      enableValidation: true,
      allowedTools: [],
      deniedTools: [],
      enableLogging: false,
    };

    // Type assertions should compile successfully
    expect(typeof config.autoDiscovery).toBe('boolean');
    expect(typeof config.maxConcurrentTools).toBe('number');
    expect(Array.isArray(config.allowedTools)).toBe(true);
  });
});