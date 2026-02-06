/**
 * @fileoverview Tests for Mock Tool Types
 *
 * This test file validates that the mock tool types for Claude Agent SDK testing
 * are properly defined, exported, and can be used as intended.
 */

import { describe, it, expect } from 'vitest';

// Test the import from test-utils/index
import type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  MockToolExecutor,
  MockToolParametersSchema,
  MockToolContentBlock,
  ToolInvocationContext,
  MockToolCategory,
} from '../test-utils/index.js';

// Test the Zod schemas
import {
  MockToolResponseSchema,
  ToolInvocationSchema,
  MockToolSchema,
} from '../test-utils/mock-tool-types.js';

describe('Mock Tool Types', () => {
  describe('Type definitions exist and are importable', () => {
    it('should export MockTool interface', () => {
      const mockTool: MockTool = {
        name: 'TestTool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: 'Test input',
            },
          },
          required: ['input'],
        },
        execute: async (params) => ({
          success: true,
          content: [{ type: 'text', text: 'Test output' }],
        }),
      };

      expect(mockTool.name).toBe('TestTool');
      expect(mockTool.description).toBe('A test tool');
      expect(mockTool.parameters.type).toBe('object');
      expect(typeof mockTool.execute).toBe('function');
    });

    it('should export MockToolResponse interface', () => {
      const response: MockToolResponse = {
        success: true,
        content: [
          { type: 'text', text: 'Success message' },
          { type: 'error', message: 'Warning message', code: 'WARN' },
        ],
        duration: 150,
        metadata: { operation: 'test' },
      };

      expect(response.success).toBe(true);
      expect(response.content).toHaveLength(2);
      expect(response.content[0].type).toBe('text');
      expect(response.content[1].type).toBe('error');
    });

    it('should export ToolInvocation interface', () => {
      const invocation: ToolInvocation = {
        id: 'inv_123',
        toolName: 'TestTool',
        parameters: { input: 'test data' },
        invokedAt: new Date(),
        context: {
          taskId: 'task_456',
          agentName: 'developer',
          stageName: 'implementation',
        },
      };

      expect(invocation.id).toBe('inv_123');
      expect(invocation.toolName).toBe('TestTool');
      expect(invocation.parameters.input).toBe('test data');
      expect(invocation.context?.taskId).toBe('task_456');
    });

    it('should export MockToolExecutor interface', () => {
      class TestExecutor implements MockToolExecutor {
        async execute(parameters: Record<string, unknown>): Promise<MockToolResponse> {
          return {
            success: true,
            content: [{ type: 'text', text: `Executed with ${JSON.stringify(parameters)}` }],
          };
        }

        reset() {
          // Reset logic here
        }
      }

      const executor = new TestExecutor();
      expect(typeof executor.execute).toBe('function');
      expect(typeof executor.reset).toBe('function');
    });
  });

  describe('Tool categories', () => {
    it('should support all defined categories', () => {
      const categories: MockToolCategory[] = [
        'filesystem',
        'shell',
        'web',
        'browser',
        'search',
        'system',
        'custom',
        'mcp',
      ];

      categories.forEach((category) => {
        const tool: MockTool = {
          name: `${category}Tool`,
          description: `A ${category} tool`,
          category,
          parameters: {
            type: 'object',
            properties: {},
          },
          execute: async () => ({
            success: true,
            content: [{ type: 'text', text: 'test' }],
          }),
        };

        expect(tool.category).toBe(category);
      });
    });
  });

  describe('Parameter schema structure', () => {
    it('should support complex parameter schemas', () => {
      const schema: MockToolParametersSchema = {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to file',
            minLength: 1,
            pattern: '^/.*',
          },
          options: {
            type: 'object',
            properties: {
              recursive: { type: 'boolean', default: false },
              maxDepth: { type: 'integer', minimum: 1, maximum: 10 },
            },
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            minItems: 0,
            maxItems: 5,
          },
        },
        required: ['filePath'],
      };

      expect(schema.type).toBe('object');
      expect(schema.properties.filePath.type).toBe('string');
      expect(schema.properties.options.type).toBe('object');
      expect(schema.properties.tags.type).toBe('array');
      expect(schema.required).toContain('filePath');
    });
  });

  describe('Content block types', () => {
    it('should support all content block types', () => {
      const textContent: MockToolContentBlock = {
        type: 'text',
        text: 'Hello world',
      };

      const imageContent: MockToolContentBlock = {
        type: 'image',
        data: 'base64encodedimage',
        mimeType: 'image/png',
      };

      const resourceContent: MockToolContentBlock = {
        type: 'resource',
        uri: 'file:///path/to/resource',
        mimeType: 'application/json',
        text: '{"key": "value"}',
      };

      const errorContent: MockToolContentBlock = {
        type: 'error',
        message: 'Something went wrong',
        code: 'ERROR_CODE',
        details: { context: 'test' },
      };

      expect(textContent.type).toBe('text');
      expect(imageContent.type).toBe('image');
      expect(resourceContent.type).toBe('resource');
      expect(errorContent.type).toBe('error');
    });
  });
});

describe('Zod Schema Validation', () => {
  describe('MockToolResponseSchema', () => {
    it('should validate valid responses', () => {
      const validResponse = {
        success: true,
        content: [{ type: 'text', text: 'Hello' }],
        duration: 100,
        metadata: { test: true },
      };

      const result = MockToolResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject invalid responses', () => {
      const invalidResponse = {
        success: 'not a boolean',
        content: 'not an array',
      };

      const result = MockToolResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('ToolInvocationSchema', () => {
    it('should validate valid invocations', () => {
      const validInvocation = {
        id: 'test_id',
        toolName: 'TestTool',
        parameters: { key: 'value' },
        invokedAt: new Date(),
      };

      const result = ToolInvocationSchema.safeParse(validInvocation);
      expect(result.success).toBe(true);
    });

    it('should reject invalid invocations', () => {
      const invalidInvocation = {
        id: 123, // should be string
        toolName: 'TestTool',
        parameters: { key: 'value' },
        invokedAt: 'not a date',
      };

      const result = ToolInvocationSchema.safeParse(invalidInvocation);
      expect(result.success).toBe(false);
    });
  });

  describe('MockToolSchema', () => {
    it('should validate valid tool definitions', () => {
      const validTool = {
        name: 'TestTool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: () => ({ success: true, content: [] }),
      };

      const result = MockToolSchema.safeParse(validTool);
      expect(result.success).toBe(true);
    });

    it('should reject invalid tool definitions', () => {
      const invalidTool = {
        name: '', // should not be empty
        description: 'A test tool',
        parameters: {
          type: 'invalid', // should be 'object'
          properties: {},
        },
      };

      const result = MockToolSchema.safeParse(invalidTool);
      expect(result.success).toBe(false);
    });
  });
});