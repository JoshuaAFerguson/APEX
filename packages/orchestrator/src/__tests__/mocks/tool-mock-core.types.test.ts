/**
 * Unit tests for core tool mock types and utilities
 *
 * @fileoverview Tests for MockTool, MockToolResponse, ToolInvocation,
 * MockToolExecutor interfaces and their related utilities
 */

import { describe, test, expect, vi } from 'vitest';
import { z } from 'zod';
import type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  MockToolExecutor,
  ToolContentBlock,
  ToolExecutionContext,
  MockToolOptions,
  ToolSequenceVerificationResult,
  MockToolFactory,
  MockToolBuilder,
} from './tool-mock-core.types';

import {
  isMockToolResponse,
  isToolInvocation,
  isToolContentBlock,
  createTextResponse,
  createErrorResponse,
  createStructuredResponse,
} from './tool-mock-core.types';

describe('Tool Mock Core Types', () => {
  describe('ToolContentBlock type', () => {
    test('should accept text content blocks', () => {
      const textBlock: ToolContentBlock = { type: 'text', text: 'Hello world' };
      expect(textBlock.type).toBe('text');
      expect('text' in textBlock && textBlock.text).toBe('Hello world');
    });

    test('should accept image content blocks', () => {
      const imageBlock: ToolContentBlock = {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' },
      };
      expect(imageBlock.type).toBe('image');
      expect('source' in imageBlock).toBe(true);
    });

    test('should accept resource content blocks', () => {
      const resourceBlock: ToolContentBlock = {
        type: 'resource',
        resource: { uri: 'file:///path/to/file.txt', mimeType: 'text/plain' },
      };
      expect(resourceBlock.type).toBe('resource');
      expect('resource' in resourceBlock).toBe(true);
    });
  });

  describe('MockToolResponse interface', () => {
    test('should create valid response with required fields', () => {
      const response: MockToolResponse = {
        content: [{ type: 'text', text: 'Success' }],
      };

      expect(response.content).toHaveLength(1);
      expect(response.isError).toBeUndefined();
      expect(response.structuredContent).toBeUndefined();
    });

    test('should create response with all optional fields', () => {
      const response: MockToolResponse = {
        content: [{ type: 'text', text: 'Operation completed' }],
        structuredContent: { itemsProcessed: 5, status: 'success' },
        isError: false,
      };

      expect(response.content).toHaveLength(1);
      expect(response.structuredContent?.itemsProcessed).toBe(5);
      expect(response.isError).toBe(false);
    });

    test('should create error response', () => {
      const response: MockToolResponse = {
        content: [{ type: 'text', text: 'File not found' }],
        isError: true,
      };

      expect(response.isError).toBe(true);
    });
  });

  describe('ToolInvocation interface', () => {
    test('should create minimal invocation record', () => {
      const invocation: ToolInvocation = {
        toolName: 'Read',
        input: { file_path: '/test.txt' },
        callId: 'call-123',
        timestamp: new Date(),
      };

      expect(invocation.toolName).toBe('Read');
      expect(invocation.input.file_path).toBe('/test.txt');
      expect(invocation.callId).toBe('call-123');
      expect(invocation.timestamp).toBeInstanceOf(Date);
    });

    test('should create complete invocation record with response', () => {
      const response: MockToolResponse = {
        content: [{ type: 'text', text: 'File contents' }],
      };

      const invocation: ToolInvocation = {
        toolName: 'Read',
        input: { file_path: '/test.txt' },
        callId: 'call-123',
        timestamp: new Date(),
        duration: 15,
        response,
      };

      expect(invocation.duration).toBe(15);
      expect(invocation.response?.content[0]).toEqual({ type: 'text', text: 'File contents' });
    });

    test('should create invocation record with error', () => {
      const error = new Error('Permission denied');

      const invocation: ToolInvocation = {
        toolName: 'Write',
        input: { file_path: '/readonly.txt', content: 'data' },
        callId: 'call-456',
        timestamp: new Date(),
        error,
      };

      expect(invocation.error).toBe(error);
      expect(invocation.response).toBeUndefined();
    });
  });

  describe('ToolExecutionContext interface', () => {
    test('should provide execution context', () => {
      const context: ToolExecutionContext = {
        callId: 'call-789',
        toolName: 'Grep',
        invocationCount: 3,
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      expect(context.callId).toBe('call-789');
      expect(context.toolName).toBe('Grep');
      expect(context.invocationCount).toBe(3);
      expect(context.timestamp.toISOString()).toBe('2024-01-01T12:00:00.000Z');
    });
  });

  describe('MockTool interface', () => {
    test('should create basic mock tool', async () => {
      const schema = z.object({ file_path: z.string() });

      const tool: MockTool<{ file_path: string }> = {
        name: 'Read',
        description: 'Read file contents',
        inputSchema: schema,
        handler: async (input, context) => ({
          content: [{ type: 'text', text: `Contents of ${input.file_path}` }],
        }),
      };

      expect(tool.name).toBe('Read');
      expect(tool.description).toBe('Read file contents');
      expect(tool.inputSchema).toBe(schema);

      // Test handler execution
      const context: ToolExecutionContext = {
        callId: 'call-1',
        toolName: 'Read',
        invocationCount: 1,
        timestamp: new Date(),
      };

      const response = await tool.handler({ file_path: '/test.txt' }, context);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Contents of /test.txt' });
    });

    test('should support synchronous handler', () => {
      const tool: MockTool<{ message: string }> = {
        name: 'Echo',
        description: 'Echo input message',
        inputSchema: z.object({ message: z.string() }),
        handler: (input) => ({
          content: [{ type: 'text', text: input.message }],
        }),
      };

      const context: ToolExecutionContext = {
        callId: 'call-2',
        toolName: 'Echo',
        invocationCount: 1,
        timestamp: new Date(),
      };

      const response = tool.handler({ message: 'Hello' }, context);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Hello' });
    });
  });

  describe('MockToolOptions interface', () => {
    test('should configure static response', () => {
      const options: MockToolOptions = {
        response: { content: [{ type: 'text', text: 'Fixed response' }] },
        delay: 100,
      };

      expect(options.response?.content[0]).toEqual({ type: 'text', text: 'Fixed response' });
      expect(options.delay).toBe(100);
    });

    test('should configure response sequence', () => {
      const options: MockToolOptions = {
        responseSequence: [
          { content: [{ type: 'text', text: 'First' }] },
          { content: [{ type: 'text', text: 'Second' }] },
        ],
        maxInvocations: 2,
      };

      expect(options.responseSequence).toHaveLength(2);
      expect(options.maxInvocations).toBe(2);
    });

    test('should configure error scheduling', () => {
      const error = new Error('Rate limited');
      const options: MockToolOptions = {
        errorOnCall: [{ callNumber: 3, error }],
      };

      expect(options.errorOnCall?.[0].callNumber).toBe(3);
      expect(options.errorOnCall?.[0].error).toBe(error);
    });
  });

  describe('ToolSequenceVerificationResult interface', () => {
    test('should create passing verification result', () => {
      const result: ToolSequenceVerificationResult = {
        passed: true,
        expected: ['Read', 'Edit', 'Write'],
        actual: ['Read', 'Edit', 'Write'],
        mismatches: [],
      };

      expect(result.passed).toBe(true);
      expect(result.mismatches).toHaveLength(0);
    });

    test('should create failing verification result with mismatches', () => {
      const result: ToolSequenceVerificationResult = {
        passed: false,
        expected: ['Read', 'Edit', 'Write'],
        actual: ['Read', 'Write'],
        mismatches: [
          { index: 1, expected: 'Edit', actual: 'Write' },
          { index: 2, expected: 'Write', actual: undefined },
        ],
      };

      expect(result.passed).toBe(false);
      expect(result.mismatches).toHaveLength(2);
      expect(result.mismatches[0].index).toBe(1);
      expect(result.mismatches[1].actual).toBeUndefined();
    });
  });

  describe('Type guards', () => {
    describe('isMockToolResponse', () => {
      test('should identify valid MockToolResponse', () => {
        const response = { content: [{ type: 'text', text: 'test' }] };
        expect(isMockToolResponse(response)).toBe(true);
      });

      test('should reject invalid values', () => {
        expect(isMockToolResponse(null)).toBe(false);
        expect(isMockToolResponse(undefined)).toBe(false);
        expect(isMockToolResponse({})).toBe(false);
        expect(isMockToolResponse({ content: 'not array' })).toBe(false);
        expect(isMockToolResponse('string')).toBe(false);
      });
    });

    describe('isToolInvocation', () => {
      test('should identify valid ToolInvocation', () => {
        const invocation = {
          toolName: 'Test',
          input: {},
          callId: 'call-1',
          timestamp: new Date(),
        };
        expect(isToolInvocation(invocation)).toBe(true);
      });

      test('should reject invalid values', () => {
        expect(isToolInvocation(null)).toBe(false);
        expect(isToolInvocation({})).toBe(false);
        expect(isToolInvocation({ toolName: 123 })).toBe(false);
        expect(isToolInvocation({ toolName: 'Test' })).toBe(false); // missing required fields
      });
    });

    describe('isToolContentBlock', () => {
      test('should identify valid text blocks', () => {
        const block = { type: 'text', text: 'content' };
        expect(isToolContentBlock(block)).toBe(true);
      });

      test('should identify valid image blocks', () => {
        const block = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '' } };
        expect(isToolContentBlock(block)).toBe(true);
      });

      test('should identify valid resource blocks', () => {
        const block = { type: 'resource', resource: { uri: 'file://test' } };
        expect(isToolContentBlock(block)).toBe(true);
      });

      test('should reject invalid blocks', () => {
        expect(isToolContentBlock(null)).toBe(false);
        expect(isToolContentBlock({})).toBe(false);
        expect(isToolContentBlock({ type: 'text' })).toBe(false); // missing text
        expect(isToolContentBlock({ type: 'unknown' })).toBe(false);
      });
    });
  });

  describe('Helper functions', () => {
    describe('createTextResponse', () => {
      test('should create text response', () => {
        const response = createTextResponse('Hello world');
        expect(response.content).toHaveLength(1);
        expect(response.content[0]).toEqual({ type: 'text', text: 'Hello world' });
        expect(response.isError).toBe(false);
      });

      test('should create error text response', () => {
        const response = createTextResponse('Error message', true);
        expect(response.content[0]).toEqual({ type: 'text', text: 'Error message' });
        expect(response.isError).toBe(true);
      });
    });

    describe('createErrorResponse', () => {
      test('should create error response', () => {
        const response = createErrorResponse('Something went wrong');
        expect(response.content[0]).toEqual({ type: 'text', text: 'Something went wrong' });
        expect(response.isError).toBe(true);
      });
    });

    describe('createStructuredResponse', () => {
      test('should create response with structured content only', () => {
        const structured = { count: 5, items: ['a', 'b'] };
        const response = createStructuredResponse(structured);

        expect(response.content).toHaveLength(0);
        expect(response.structuredContent).toEqual(structured);
        expect(response.isError).toBeFalsy();
      });

      test('should create response with structured content and text', () => {
        const structured = { files: ['a.ts', 'b.ts'] };
        const response = createStructuredResponse(structured, 'Found 2 files');

        expect(response.content).toHaveLength(1);
        expect(response.content[0]).toEqual({ type: 'text', text: 'Found 2 files' });
        expect(response.structuredContent).toEqual(structured);
      });
    });
  });

  describe('MockToolExecutor interface compliance', () => {
    // Create a simple test implementation to verify interface compliance
    class TestMockToolExecutor implements MockToolExecutor {
      private invocations: ToolInvocation[] = [];
      private tools = new Map<string, MockTool>();

      addTool(tool: MockTool): void {
        this.tools.set(tool.name, tool);
      }

      async execute(toolName: string, input: Record<string, unknown>): Promise<MockToolResponse> {
        const tool = this.tools.get(toolName);
        if (!tool) {
          throw new Error(`Tool not found: ${toolName}`);
        }

        const callId = `call-${Date.now()}-${Math.random()}`;
        const timestamp = new Date();
        const invocationCount = this.invocations.filter(i => i.toolName === toolName).length + 1;

        const context: ToolExecutionContext = {
          callId,
          toolName,
          invocationCount,
          timestamp,
        };

        try {
          const response = await tool.handler(input, context);
          this.invocations.push({
            toolName,
            input,
            callId,
            timestamp,
            response,
          });
          return response;
        } catch (error) {
          this.invocations.push({
            toolName,
            input,
            callId,
            timestamp,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          throw error;
        }
      }

      hasToolAvailable(toolName: string): boolean {
        return this.tools.has(toolName);
      }

      getInvocations(toolName?: string): ToolInvocation[] {
        if (toolName) {
          return this.invocations.filter(i => i.toolName === toolName);
        }
        return [...this.invocations];
      }

      getLastInvocation(toolName: string): ToolInvocation | undefined {
        const toolInvocations = this.getInvocations(toolName);
        return toolInvocations[toolInvocations.length - 1];
      }

      clearInvocations(): void {
        this.invocations = [];
      }
    }

    test('should implement MockToolExecutor interface correctly', async () => {
      const executor = new TestMockToolExecutor();

      // Test tool availability before adding
      expect(executor.hasToolAvailable('Read')).toBe(false);

      // Add a tool
      const readTool: MockTool<{ file_path: string }> = {
        name: 'Read',
        description: 'Read files',
        inputSchema: z.object({ file_path: z.string() }),
        handler: async (input) => ({
          content: [{ type: 'text', text: `Contents of ${input.file_path}` }],
        }),
      };

      executor.addTool(readTool);
      expect(executor.hasToolAvailable('Read')).toBe(true);

      // Execute tool
      const response = await executor.execute('Read', { file_path: '/test.txt' });
      expect(response.content[0]).toEqual({ type: 'text', text: 'Contents of /test.txt' });

      // Check invocations
      const invocations = executor.getInvocations();
      expect(invocations).toHaveLength(1);
      expect(invocations[0].toolName).toBe('Read');
      expect(invocations[0].input.file_path).toBe('/test.txt');

      // Check last invocation
      const lastInvocation = executor.getLastInvocation('Read');
      expect(lastInvocation).toBeDefined();
      expect(lastInvocation?.response?.content[0]).toEqual({ type: 'text', text: 'Contents of /test.txt' });

      // Test error case
      await expect(executor.execute('NonExistent', {})).rejects.toThrow('Tool not found: NonExistent');

      // Clear invocations
      executor.clearInvocations();
      expect(executor.getInvocations()).toHaveLength(0);
    });
  });
});