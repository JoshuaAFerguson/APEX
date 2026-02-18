/**
 * @fileoverview Test coverage verification for tool infrastructure
 *
 * This test file verifies that all major tool infrastructure components
 * have adequate test coverage and can be imported and used correctly.
 */

import { describe, it, expect } from 'vitest';

// Import all tool-related types and classes to verify they exist
import {
  ToolCategorySchema,
  ToolPermissionSchema,
  JSONSchemaTypeSchema,
  ToolParameterSchema,
  ToolParametersSchemaSchema,
  ToolExampleSchema,
  ToolDefinitionSchema,
  ToolResultSchema,
  ToolInvocationSchema,
  ToolRegistryEntrySchema,
  type ToolCategory,
  type ToolPermission,
  type JSONSchemaType,
  type ToolParameter,
  type ToolParametersSchema,
  type ToolExample,
  type ToolDefinition,
  type ToolResult,
  type ToolInvocation,
  type ToolRegistryEntry,
} from '../../types.js';

import {
  BaseTool,
  type ToolInterface,
  type ToolExecutionContext,
  type ValidationResult,
  type BaseToolOptions,
  isToolInterface,
  isBaseTool,
} from '../base-tool.js';

import {
  ToolRegistry,
  DuplicateToolError,
  ToolNotFoundError,
  ToolValidationError,
  getToolRegistry,
  registerTool,
  unregisterTool,
} from '../tool-registry.js';

// Test implementation
class TestTool extends BaseTool<{ input: string }, string> {
  constructor() {
    super({
      name: 'TestTool',
      description: 'A test tool for coverage verification',
      category: 'custom',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Test input' },
        },
        required: ['input'],
        additionalProperties: false,
      },
    });
  }

  protected async executeImpl(params: { input: string }): Promise<string> {
    return `Test: ${params.input}`;
  }
}

describe('Tool Infrastructure Coverage Verification', () => {
  describe('Type System Exports', () => {
    it('should export all tool-related Zod schemas', () => {
      // Verify all schemas are functions (Zod schema objects)
      expect(typeof ToolCategorySchema).toBe('object');
      expect(typeof ToolPermissionSchema).toBe('object');
      expect(typeof JSONSchemaTypeSchema).toBe('object');
      expect(typeof ToolParameterSchema).toBe('object');
      expect(typeof ToolParametersSchemaSchema).toBe('object');
      expect(typeof ToolExampleSchema).toBe('object');
      expect(typeof ToolDefinitionSchema).toBe('object');
      expect(typeof ToolResultSchema).toBe('object');
      expect(typeof ToolInvocationSchema).toBe('object');
      expect(typeof ToolRegistryEntrySchema).toBe('object');
    });

    it('should validate tool categories correctly', () => {
      const validCategories: ToolCategory[] = [
        'filesystem', 'search', 'shell', 'web', 'system', 'custom'
      ];

      validCategories.forEach(category => {
        expect(() => ToolCategorySchema.parse(category)).not.toThrow();
      });
    });

    it('should validate tool permissions correctly', () => {
      const validPermissions: ToolPermission[] = [
        'read', 'write', 'execute', 'network', 'admin'
      ];

      validPermissions.forEach(permission => {
        expect(() => ToolPermissionSchema.parse(permission)).not.toThrow();
      });
    });

    it('should handle complex tool definitions', () => {
      const complexDefinition: ToolDefinition = {
        name: 'ComplexTool',
        description: 'A complex tool with many features',
        category: 'custom',
        parameters: {
          type: 'object',
          properties: {
            required_param: { type: 'string', description: 'Required parameter' },
            optional_param: { type: 'number', description: 'Optional parameter' },
            nested_object: {
              type: 'object',
              properties: {
                nested_string: { type: 'string' },
                nested_array: {
                  type: 'array',
                  items: { type: 'integer' }
                }
              }
            }
          },
          required: ['required_param'],
          additionalProperties: false,
        },
        dangerous: false,
        permissions: ['read', 'write'],
        examples: [{
          name: 'Example',
          description: 'An example usage',
          input: {
            required_param: 'test',
            optional_param: 42,
            nested_object: {
              nested_string: 'nested',
              nested_array: [1, 2, 3]
            }
          },
          output: { result: 'success' }
        }],
        version: '1.0.0',
        enabled: true,
        tags: ['test', 'example']
      };

      expect(() => ToolDefinitionSchema.parse(complexDefinition)).not.toThrow();
    });
  });

  describe('BaseTool Class', () => {
    it('should create tools correctly', () => {
      const tool = new TestTool();

      expect(tool.name).toBe('TestTool');
      expect(tool.enabled).toBe(true);
      expect(tool.category).toBe('custom');
    });

    it('should provide proper tool definition', () => {
      const tool = new TestTool();
      const definition = tool.getDefinition();

      expect(definition.name).toBe('TestTool');
      expect(definition.description).toBe('A test tool for coverage verification');
      expect(definition.category).toBe('custom');
      expect(definition.parameters.type).toBe('object');
    });

    it('should validate parameters correctly', () => {
      const tool = new TestTool();

      // Valid parameters
      const validResult = tool.validate({ input: 'test' });
      expect(validResult.valid).toBe(true);

      // Invalid parameters - missing required field
      const invalidResult = tool.validate({} as any);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Missing required parameter: input');
    });

    it('should execute successfully with valid parameters', async () => {
      const tool = new TestTool();
      const result = await tool.execute({ input: 'hello' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Test: hello');
      expect(result.toolName).toBe('TestTool');
      expect(typeof result.duration).toBe('number');
    });
  });

  describe('ToolRegistry Class', () => {
    it('should follow singleton pattern', () => {
      const registry1 = ToolRegistry.getInstance();
      const registry2 = ToolRegistry.getInstance();

      expect(registry1).toBe(registry2);
    });

    it('should register and retrieve tools', () => {
      const registry = ToolRegistry.getInstance();
      registry.clear(); // Start fresh

      const tool = new TestTool();
      registry.register(tool);

      expect(registry.has('TestTool')).toBe(true);
      expect(registry.size).toBe(1);

      const entry = registry.get('TestTool');
      expect(entry.definition.name).toBe('TestTool');
    });

    it('should handle tool categorization', () => {
      const registry = ToolRegistry.getInstance();
      registry.clear();

      const tool = new TestTool();
      registry.register(tool);

      const customTools = registry.getByCategory('custom');
      expect(customTools).toHaveLength(1);

      const systemTools = registry.getByCategory('system');
      expect(systemTools).toHaveLength(0);
    });

    it('should track tool statistics', () => {
      const registry = ToolRegistry.getInstance();
      registry.clear();

      const tool = new TestTool();
      registry.register(tool);

      // Record some invocations
      registry.recordInvocation('TestTool', true);
      registry.recordInvocation('TestTool', false);

      const entry = registry.get('TestTool');
      expect(entry.invocationCount).toBe(2);
      expect(entry.successCount).toBe(1);
      expect(entry.failureCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw appropriate errors', () => {
      const registry = ToolRegistry.getInstance();
      registry.clear();

      // Test duplicate registration
      const tool1 = new TestTool();
      const tool2 = new TestTool(); // Same name

      registry.register(tool1);
      expect(() => registry.register(tool2)).toThrow(DuplicateToolError);

      // Test tool not found
      expect(() => registry.get('NonexistentTool')).toThrow(ToolNotFoundError);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify tool interfaces', () => {
      const tool = new TestTool();
      const notATool = { someProperty: 'value' };

      expect(isToolInterface(tool)).toBe(true);
      expect(isToolInterface(notATool)).toBe(false);
    });

    it('should correctly identify BaseTool instances', () => {
      const tool = new TestTool();
      const mockTool = {
        getDefinition: () => ({} as ToolDefinition),
        validate: () => ({ valid: true }),
        execute: async () => ({ success: true }),
      };

      expect(isBaseTool(tool)).toBe(true);
      expect(isBaseTool(mockTool)).toBe(false);
    });
  });

  describe('Integration Points', () => {
    it('should work with convenience functions', () => {
      const registry = getToolRegistry();
      registry.clear();

      const tool = new TestTool();

      // Test convenience registration
      registerTool(tool);
      expect(registry.has('TestTool')).toBe(true);

      // Test convenience unregistration
      unregisterTool('TestTool');
      expect(registry.has('TestTool')).toBe(false);
    });
  });
});