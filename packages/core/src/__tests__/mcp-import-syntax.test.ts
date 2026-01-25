import { describe, it, expect } from 'vitest';

/**
 * Syntax verification test for MCP imports
 *
 * This test ensures that the MCP module exports work correctly at the
 * import/syntax level without requiring complex validation.
 */
describe('MCP Import Syntax Verification', () => {
  it('should import core MCP schemas without syntax errors', async () => {
    // This should not throw any import or syntax errors
    const mcpModule = await import('../mcp');

    // Basic existence checks
    expect(mcpModule).toBeDefined();
    expect(typeof mcpModule).toBe('object');
  });

  it('should have expected export structure', async () => {
    const mcpModule = await import('../mcp');

    // Check that key schemas exist
    const expectedSchemas = [
      'MCPServerConfigSchema',
      'MCPConnectionInfoSchema',
      'MCPToolSchemaSchema',
      'MCPToolDefinitionSchema',
      'MCPInstallationSchema'
    ];

    for (const schemaName of expectedSchemas) {
      expect(mcpModule[schemaName as keyof typeof mcpModule]).toBeDefined();
    }
  });

  it('should not have naming conflicts in exports', async () => {
    const mcpModule = await import('../mcp');

    // Verify that we have both JSON schema and tool definition schemas
    expect(mcpModule.MCPToolSchemaSchema).toBeDefined();
    expect(mcpModule.MCPToolDefinitionSchema).toBeDefined();

    // They should be different objects
    expect(mcpModule.MCPToolSchemaSchema).not.toBe(mcpModule.MCPToolDefinitionSchema);
  });

  it('should provide backward compatibility exports', async () => {
    const mcpModule = await import('../mcp');

    // Check backward compatibility aliases
    expect(mcpModule.MCPConnectionSchema).toBe(mcpModule.MCPConnectionInfoSchema);
    expect(mcpModule.MCPServerTemplateSchema).toBe(mcpModule.MCPTemplateSchema);
  });

  it('should work with direct destructuring import', async () => {
    // Test that destructuring imports work without conflicts
    try {
      const {
        MCPServerConfigSchema,
        MCPConnectionInfoSchema,
        MCPToolSchemaSchema,
        MCPToolDefinitionSchema
      } = await import('../mcp');

      expect(MCPServerConfigSchema).toBeDefined();
      expect(MCPConnectionInfoSchema).toBeDefined();
      expect(MCPToolSchemaSchema).toBeDefined();
      expect(MCPToolDefinitionSchema).toBeDefined();
    } catch (error) {
      throw new Error(`Destructuring import failed: ${error}`);
    }
  });

  it('should be compatible with index.ts exports', async () => {
    const indexModule = await import('../index');
    const mcpModule = await import('../mcp');

    // Verify that the main export still works
    expect(indexModule.MCPServerConfigSchema).toBeDefined();
    expect(mcpModule.MCPServerConfigSchema).toBeDefined();

    // They should be the same object
    expect(indexModule.MCPServerConfigSchema).toBe(mcpModule.MCPServerConfigSchema);
  });
});