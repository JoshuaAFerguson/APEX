import { describe, it, expect } from 'vitest';
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
} from '../types.js';

describe('Tool Types and Schemas', () => {
  describe('ToolCategorySchema', () => {
    it('should accept valid categories', () => {
      const validCategories: ToolCategory[] = [
        'filesystem',
        'search',
        'shell',
        'web',
        'system',
        'custom',
      ];

      validCategories.forEach(category => {
        expect(ToolCategorySchema.parse(category)).toBe(category);
      });
    });

    it('should reject invalid categories', () => {
      const invalidCategories = ['invalid', 'unknown', 123, null, undefined];

      invalidCategories.forEach(category => {
        expect(() => ToolCategorySchema.parse(category)).toThrow();
      });
    });
  });

  describe('ToolPermissionSchema', () => {
    it('should accept valid permissions', () => {
      const validPermissions: ToolPermission[] = [
        'read',
        'write',
        'execute',
        'network',
        'admin',
      ];

      validPermissions.forEach(permission => {
        expect(ToolPermissionSchema.parse(permission)).toBe(permission);
      });
    });

    it('should reject invalid permissions', () => {
      const invalidPermissions = ['invalid', 'super', 123, null, undefined];

      invalidPermissions.forEach(permission => {
        expect(() => ToolPermissionSchema.parse(permission)).toThrow();
      });
    });
  });

  describe('JSONSchemaTypeSchema', () => {
    it('should accept valid JSON Schema types', () => {
      const validTypes: JSONSchemaType[] = [
        'string',
        'number',
        'integer',
        'boolean',
        'object',
        'array',
        'null',
      ];

      validTypes.forEach(type => {
        expect(JSONSchemaTypeSchema.parse(type)).toBe(type);
      });
    });

    it('should reject invalid types', () => {
      const invalidTypes = ['float', 'double', 'any', 123, null, undefined];

      invalidTypes.forEach(type => {
        expect(() => JSONSchemaTypeSchema.parse(type)).toThrow();
      });
    });
  });

  describe('ToolParameterSchema', () => {
    it('should accept minimal valid parameter', () => {
      const minimalParam: ToolParameter = {
        name: 'testParam',
        type: 'string',
      };

      const result = ToolParameterSchema.parse(minimalParam);
      expect(result.name).toBe('testParam');
      expect(result.type).toBe('string');
      expect(result.required).toBe(false); // default value
    });

    it('should accept complete parameter with all fields', () => {
      const completeParam: ToolParameter = {
        name: 'complexParam',
        type: 'object',
        description: 'A complex parameter for testing',
        required: true,
        default: { example: 'value' },
        enum: ['option1', 'option2'],
        properties: {
          nested: {
            name: 'nested',
            type: 'string',
            description: 'Nested property',
          },
        },
        minimum: 0,
        maximum: 100,
        minLength: 1,
        maxLength: 255,
        pattern: '^[a-zA-Z]+$',
      };

      const result = ToolParameterSchema.parse(completeParam);
      expect(result.name).toBe('complexParam');
      expect(result.type).toBe('object');
      expect(result.required).toBe(true);
      expect(result.properties).toBeDefined();
      expect(result.properties!.nested.type).toBe('string');
    });

    it('should handle array parameter with items', () => {
      const arrayParam: ToolParameter = {
        name: 'arrayParam',
        type: 'array',
        items: {
          name: 'item',
          type: 'string',
          description: 'Array item',
        },
      };

      const result = ToolParameterSchema.parse(arrayParam);
      expect(result.type).toBe('array');
      expect(result.items).toBeDefined();
      expect(result.items!.type).toBe('string');
    });

    it('should reject parameter with empty name', () => {
      const invalidParam = {
        name: '',
        type: 'string',
      };

      expect(() => ToolParameterSchema.parse(invalidParam)).toThrow();
    });

    it('should reject parameter without name', () => {
      const invalidParam = {
        type: 'string',
      };

      expect(() => ToolParameterSchema.parse(invalidParam)).toThrow();
    });
  });

  describe('ToolParametersSchemaSchema', () => {
    it('should accept minimal schema with defaults', () => {
      const minimalSchema = {};

      const result = ToolParametersSchemaSchema.parse(minimalSchema);
      expect(result.type).toBe('object');
      expect(result.properties).toEqual({});
      expect(result.required).toEqual([]);
      expect(result.additionalProperties).toBe(false);
    });

    it('should accept complete parameters schema', () => {
      const completeSchema: ToolParametersSchema = {
        type: 'object',
        properties: {
          stringParam: {
            type: 'string',
            description: 'A string parameter',
            default: 'defaultValue',
          },
          numberParam: {
            type: 'number',
            minimum: 0,
            maximum: 100,
          },
        },
        required: ['stringParam'],
        additionalProperties: true,
      };

      const result = ToolParametersSchemaSchema.parse(completeSchema);
      expect(result.type).toBe('object');
      expect(result.properties!.stringParam.type).toBe('string');
      expect(result.required).toContain('stringParam');
      expect(result.additionalProperties).toBe(true);
    });

    it('should handle nested object properties', () => {
      const nestedSchema = {
        type: 'object' as const,
        properties: {
          config: {
            type: 'object' as const,
            properties: {
              enabled: { type: 'boolean' as const },
              timeout: { type: 'number' as const, minimum: 0 },
            },
          },
        },
      };

      const result = ToolParametersSchemaSchema.parse(nestedSchema);
      expect(result.properties!.config.type).toBe('object');
      expect(result.properties!.config.properties).toBeDefined();
    });
  });

  describe('ToolExampleSchema', () => {
    it('should accept minimal example', () => {
      const minimalExample: ToolExample = {
        name: 'Basic Usage',
        input: { param: 'value' },
      };

      const result = ToolExampleSchema.parse(minimalExample);
      expect(result.name).toBe('Basic Usage');
      expect(result.input).toEqual({ param: 'value' });
    });

    it('should accept complete example', () => {
      const completeExample: ToolExample = {
        name: 'Complete Example',
        description: 'Shows all features',
        input: {
          param1: 'value1',
          param2: 42,
          nested: { prop: true }
        },
        output: { success: true, result: 'data' },
      };

      const result = ToolExampleSchema.parse(completeExample);
      expect(result.description).toBe('Shows all features');
      expect(result.output).toEqual({ success: true, result: 'data' });
    });

    it('should reject example with empty name', () => {
      const invalidExample = {
        name: '',
        input: { param: 'value' },
      };

      expect(() => ToolExampleSchema.parse(invalidExample)).toThrow();
    });
  });

  describe('ToolDefinitionSchema', () => {
    const validToolDefinition: ToolDefinition = {
      name: 'TestTool',
      description: 'A test tool for validation',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input parameter' },
        },
        required: ['input'],
      },
      category: 'custom',
    };

    it('should accept minimal valid tool definition', () => {
      const result = ToolDefinitionSchema.parse(validToolDefinition);
      expect(result.name).toBe('TestTool');
      expect(result.dangerous).toBe(false); // default
      expect(result.permissions).toEqual([]); // default
      expect(result.enabled).toBe(true); // default
    });

    it('should accept complete tool definition', () => {
      const completeDefinition: ToolDefinition = {
        ...validToolDefinition,
        dangerous: true,
        permissions: ['read', 'write'],
        examples: [
          {
            name: 'Example 1',
            input: { input: 'test' },
            output: { success: true },
          },
        ],
        deprecated: 'Use NewTool instead',
        version: '1.2.3',
        enabled: false,
        tags: ['testing', 'utility'],
      };

      const result = ToolDefinitionSchema.parse(completeDefinition);
      expect(result.dangerous).toBe(true);
      expect(result.permissions).toContain('read');
      expect(result.permissions).toContain('write');
      expect(result.examples).toHaveLength(1);
      expect(result.deprecated).toBe('Use NewTool instead');
      expect(result.version).toBe('1.2.3');
      expect(result.enabled).toBe(false);
      expect(result.tags).toContain('testing');
    });

    it('should reject tool with empty name', () => {
      const invalidDefinition = {
        ...validToolDefinition,
        name: '',
      };

      expect(() => ToolDefinitionSchema.parse(invalidDefinition)).toThrow();
    });

    it('should reject tool with name too long', () => {
      const invalidDefinition = {
        ...validToolDefinition,
        name: 'A'.repeat(65), // 65 characters, exceeds 64 limit
      };

      expect(() => ToolDefinitionSchema.parse(invalidDefinition)).toThrow();
    });

    it('should reject tool with empty description', () => {
      const invalidDefinition = {
        ...validToolDefinition,
        description: '',
      };

      expect(() => ToolDefinitionSchema.parse(invalidDefinition)).toThrow();
    });

    it('should reject tool with invalid version format', () => {
      const invalidDefinition = {
        ...validToolDefinition,
        version: 'invalid-version',
      };

      expect(() => ToolDefinitionSchema.parse(invalidDefinition)).toThrow();
    });

    it('should accept valid semver versions', () => {
      const validVersions = ['1.0.0', '2.1.3', '0.0.1', '10.20.30'];

      validVersions.forEach(version => {
        const definition = { ...validToolDefinition, version };
        const result = ToolDefinitionSchema.parse(definition);
        expect(result.version).toBe(version);
      });
    });

    it('should handle multiple permissions', () => {
      const definition = {
        ...validToolDefinition,
        permissions: ['read', 'write', 'execute'] as ToolPermission[],
      };

      const result = ToolDefinitionSchema.parse(definition);
      expect(result.permissions).toHaveLength(3);
      expect(result.permissions).toContain('read');
      expect(result.permissions).toContain('write');
      expect(result.permissions).toContain('execute');
    });
  });

  describe('ToolResultSchema', () => {
    it('should accept minimal result', () => {
      const minimalResult: ToolResult = {
        success: true,
      };

      const result = ToolResultSchema.parse(minimalResult);
      expect(result.success).toBe(true);
    });

    it('should accept complete result with success', () => {
      const successResult: ToolResult = {
        success: true,
        output: { data: 'result data', count: 5 },
        duration: 1500,
        metadata: { version: '1.0', cached: false },
        toolName: 'TestTool',
        invokedAt: new Date('2023-01-01T10:00:00Z'),
        completedAt: new Date('2023-01-01T10:00:01Z'),
      };

      const result = ToolResultSchema.parse(successResult);
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ data: 'result data', count: 5 });
      expect(result.duration).toBe(1500);
      expect(result.metadata).toBeDefined();
      expect(result.toolName).toBe('TestTool');
    });

    it('should accept result with failure and error', () => {
      const failureResult: ToolResult = {
        success: false,
        error: 'Tool execution failed',
        duration: 500,
      };

      const result = ToolResultSchema.parse(failureResult);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool execution failed');
    });

    it('should reject result with negative duration', () => {
      const invalidResult = {
        success: true,
        duration: -100,
      };

      expect(() => ToolResultSchema.parse(invalidResult)).toThrow();
    });
  });

  describe('ToolInvocationSchema', () => {
    it('should accept minimal invocation', () => {
      const minimalInvocation: ToolInvocation = {
        toolName: 'TestTool',
        parameters: { input: 'test value' },
      };

      const result = ToolInvocationSchema.parse(minimalInvocation);
      expect(result.toolName).toBe('TestTool');
      expect(result.parameters).toEqual({ input: 'test value' });
    });

    it('should accept complete invocation', () => {
      const completeInvocation: ToolInvocation = {
        toolName: 'TestTool',
        parameters: {
          input: 'test value',
          options: { verbose: true, timeout: 30 }
        },
        timeout: 5000,
        requestId: 'req-123',
        context: {
          taskId: 'task-456',
          agentName: 'testAgent',
          stageName: 'processing',
        },
      };

      const result = ToolInvocationSchema.parse(completeInvocation);
      expect(result.timeout).toBe(5000);
      expect(result.requestId).toBe('req-123');
      expect(result.context).toBeDefined();
      expect(result.context!.taskId).toBe('task-456');
    });

    it('should reject invocation with empty tool name', () => {
      const invalidInvocation = {
        toolName: '',
        parameters: {},
      };

      expect(() => ToolInvocationSchema.parse(invalidInvocation)).toThrow();
    });

    it('should reject invocation with negative timeout', () => {
      const invalidInvocation = {
        toolName: 'TestTool',
        parameters: {},
        timeout: -1000,
      };

      expect(() => ToolInvocationSchema.parse(invalidInvocation)).toThrow();
    });
  });

  describe('ToolRegistryEntrySchema', () => {
    const baseDefinition: ToolDefinition = {
      name: 'TestTool',
      description: 'A test tool',
      parameters: {
        type: 'object',
        properties: {},
      },
      category: 'custom',
    };

    it('should accept minimal registry entry', () => {
      const minimalEntry: ToolRegistryEntry = {
        definition: baseDefinition,
      };

      const result = ToolRegistryEntrySchema.parse(minimalEntry);
      expect(result.definition).toEqual(baseDefinition);
      expect(result.available).toBe(true); // default
      expect(result.invocationCount).toBe(0); // default
      expect(result.successCount).toBe(0); // default
      expect(result.failureCount).toBe(0); // default
    });

    it('should accept complete registry entry', () => {
      const completeEntry: ToolRegistryEntry = {
        definition: baseDefinition,
        available: false,
        unavailableReason: 'Service temporarily down',
        lastInvoked: new Date('2023-01-01T12:00:00Z'),
        invocationCount: 150,
        successCount: 145,
        failureCount: 5,
      };

      const result = ToolRegistryEntrySchema.parse(completeEntry);
      expect(result.available).toBe(false);
      expect(result.unavailableReason).toBe('Service temporarily down');
      expect(result.invocationCount).toBe(150);
      expect(result.successCount).toBe(145);
      expect(result.failureCount).toBe(5);
    });

    it('should reject entry with negative counts', () => {
      const invalidEntry = {
        definition: baseDefinition,
        invocationCount: -5,
      };

      expect(() => ToolRegistryEntrySchema.parse(invalidEntry)).toThrow();
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle recursive parameter structures', () => {
      const recursiveParam: ToolParameter = {
        name: 'config',
        type: 'object',
        properties: {
          nested: {
            name: 'nested',
            type: 'object',
            properties: {
              deepNested: {
                name: 'deepNested',
                type: 'string',
              },
            },
          },
        },
      };

      const result = ToolParameterSchema.parse(recursiveParam);
      expect(result.properties!.nested.properties!.deepNested.type).toBe('string');
    });

    it('should handle complex array parameter with object items', () => {
      const arrayParam: ToolParameter = {
        name: 'items',
        type: 'array',
        items: {
          name: 'item',
          type: 'object',
          properties: {
            id: { name: 'id', type: 'integer' },
            name: { name: 'name', type: 'string' },
          },
        },
      };

      const result = ToolParameterSchema.parse(arrayParam);
      expect(result.items!.type).toBe('object');
      expect(result.items!.properties!.id.type).toBe('integer');
    });

    it('should validate tool definition with complex parameters and examples', () => {
      const complexTool: ToolDefinition = {
        name: 'ComplexTool',
        description: 'A complex tool for comprehensive testing',
        parameters: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                mode: { type: 'string', enum: ['fast', 'slow'] },
                options: { type: 'array', items: { type: 'string' } },
              },
            },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer', minimum: 1 },
                  value: { type: 'string', pattern: '^[A-Z]+$' },
                },
              },
            },
          },
          required: ['config'],
        },
        category: 'custom',
        dangerous: true,
        permissions: ['read', 'write'],
        examples: [
          {
            name: 'Fast Mode',
            description: 'Process data in fast mode',
            input: {
              config: { mode: 'fast', options: ['verbose'] },
              data: [{ id: 1, value: 'ABC' }],
            },
            output: { processed: 1, time: 150 },
          },
        ],
        version: '2.1.0',
        tags: ['processing', 'data'],
      };

      const result = ToolDefinitionSchema.parse(complexTool);
      expect(result.name).toBe('ComplexTool');
      expect(result.examples).toHaveLength(1);
      expect(result.examples![0].name).toBe('Fast Mode');
    });

    it('should handle tool invocation with complex nested parameters', () => {
      const complexInvocation: ToolInvocation = {
        toolName: 'ComplexTool',
        parameters: {
          config: {
            mode: 'fast',
            options: ['verbose', 'debug'],
            settings: {
              timeout: 5000,
              retries: 3,
              cache: true,
            },
          },
          data: [
            { id: 1, value: 'ABC', metadata: { source: 'user' } },
            { id: 2, value: 'DEF', metadata: { source: 'auto' } },
          ],
        },
        timeout: 30000,
        context: {
          taskId: 'complex-task-123',
          agentName: 'dataProcessor',
          stageName: 'processing',
        },
      };

      const result = ToolInvocationSchema.parse(complexInvocation);
      expect(result.parameters.config.settings.timeout).toBe(5000);
      expect(result.parameters.data).toHaveLength(2);
    });
  });
});