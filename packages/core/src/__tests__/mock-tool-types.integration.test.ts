/**
 * @fileoverview Integration tests for Mock Tool Types
 *
 * This test file validates integration scenarios for mock tool types including:
 * - Complex tool execution flows
 * - Tool chaining and composition
 * - Dynamic behavior configuration
 * - Real-world usage patterns
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  MockToolExecutor,
  ToolInvocationContext,
  MockToolRegistryEntry,
  MockToolInvocationEvent,
} from '../test-utils/mock-tool-types.js';

import {
  MockToolResponseSchema,
  ToolInvocationSchema,
  MockToolSchema,
} from '../test-utils/mock-tool-types.js';

describe('Mock Tool Types Integration', () => {
  describe('Real-world tool scenarios', () => {
    it('should support file system tool chains', async () => {
      const readTool: MockTool = {
        name: 'Read',
        description: 'Read file contents',
        category: 'filesystem',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to file' },
            encoding: { type: 'string', default: 'utf-8' },
          },
          required: ['file_path'],
        },
        execute: async (params) => {
          const path = params.file_path as string;
          if (path.includes('nonexistent')) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: `File not found: ${path}`,
                  code: 'ENOENT',
                },
              ],
            };
          }
          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Contents of ${path}:\n\nfunction hello() {\n  console.log('Hello, World!');\n}`,
              },
            ],
            duration: 45,
            metadata: { fileSize: 52 },
          };
        },
      };

      const writeTool: MockTool = {
        name: 'Write',
        description: 'Write file contents',
        category: 'filesystem',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to file' },
            content: { type: 'string', description: 'Content to write' },
          },
          required: ['file_path', 'content'],
        },
        execute: async (params) => {
          const path = params.file_path as string;
          const content = params.content as string;

          if (path.includes('readonly')) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Permission denied: file is read-only',
                  code: 'EACCES',
                },
              ],
            };
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Successfully wrote ${content.length} bytes to ${path}`,
              },
            ],
            duration: 32,
            metadata: { bytesWritten: content.length },
          };
        },
      };

      // Test successful file read
      const readResponse = await (readTool.execute as Function)({
        file_path: '/src/utils.ts',
      });
      expect(readResponse.success).toBe(true);
      expect(readResponse.content[0].text).toContain('function hello()');

      // Test file not found
      const readErrorResponse = await (readTool.execute as Function)({
        file_path: '/nonexistent/file.ts',
      });
      expect(readErrorResponse.success).toBe(false);
      expect(readErrorResponse.isError).toBe(true);

      // Test successful file write
      const writeResponse = await (writeTool.execute as Function)({
        file_path: '/src/new-file.ts',
        content: 'export const message = "Hello";',
      });
      expect(writeResponse.success).toBe(true);
      expect(writeResponse.metadata?.bytesWritten).toBe(32);

      // Test permission denied write
      const writeErrorResponse = await (writeTool.execute as Function)({
        file_path: '/readonly/config.ts',
        content: 'const config = {};',
      });
      expect(writeErrorResponse.success).toBe(false);
      expect(writeErrorResponse.content[0].code).toBe('EACCES');
    });

    it('should support web request tools with different response types', async () => {
      const webFetchTool: MockTool = {
        name: 'WebFetch',
        description: 'Fetch content from URLs',
        category: 'web',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to fetch' },
            method: { type: 'string', default: 'GET' },
            headers: { type: 'object', default: {} },
          },
          required: ['url'],
        },
        execute: async (params) => {
          const url = params.url as string;
          const method = (params.method as string) || 'GET';

          if (url.includes('api.github.com')) {
            return {
              success: true,
              content: [
                {
                  type: 'resource',
                  uri: url,
                  mimeType: 'application/json',
                  text: JSON.stringify({
                    name: 'test-repo',
                    description: 'A test repository',
                    stars: 42,
                  }),
                },
              ],
              duration: 125,
              metadata: { statusCode: 200, responseSize: 98 },
            };
          }

          if (url.includes('httpbin.org/image')) {
            return {
              success: true,
              content: [
                {
                  type: 'image',
                  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                  mimeType: 'image/png',
                },
              ],
              duration: 200,
              metadata: { statusCode: 200, responseSize: 95 },
            };
          }

          if (url.includes('timeout.example.com')) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Request timeout after 5000ms',
                  code: 'TIMEOUT',
                  details: { timeout: 5000, url },
                },
              ],
              duration: 5000,
            };
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `<html><body><h1>Hello from ${url}</h1></body></html>`,
              },
            ],
            duration: 89,
            metadata: { statusCode: 200, responseSize: 52 },
          };
        },
      };

      // Test JSON API response
      const apiResponse = await (webFetchTool.execute as Function)({
        url: 'https://api.github.com/repos/test/repo',
      });
      expect(apiResponse.success).toBe(true);
      expect(apiResponse.content[0].type).toBe('resource');
      expect(apiResponse.content[0].mimeType).toBe('application/json');

      // Test image response
      const imageResponse = await (webFetchTool.execute as Function)({
        url: 'https://httpbin.org/image/png',
      });
      expect(imageResponse.success).toBe(true);
      expect(imageResponse.content[0].type).toBe('image');
      expect(imageResponse.content[0].mimeType).toBe('image/png');

      // Test timeout error
      const timeoutResponse = await (webFetchTool.execute as Function)({
        url: 'https://timeout.example.com/slow',
      });
      expect(timeoutResponse.success).toBe(false);
      expect(timeoutResponse.content[0].code).toBe('TIMEOUT');

      // Test regular HTML response
      const htmlResponse = await (webFetchTool.execute as Function)({
        url: 'https://example.com',
      });
      expect(htmlResponse.success).toBe(true);
      expect(htmlResponse.content[0].text).toContain('<html>');
    });
  });

  describe('Tool executor classes', () => {
    it('should support stateful executors with complex logic', async () => {
      class DatabaseMockExecutor implements MockToolExecutor {
        private data = new Map<string, Record<string, unknown>>();
        private queryCount = 0;

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          this.queryCount++;
          const operation = params.operation as string;
          const table = params.table as string;

          switch (operation) {
            case 'SELECT':
              const selectData = this.data.get(table) || {};
              return {
                success: true,
                content: [
                  {
                    type: 'resource',
                    uri: `db://${table}`,
                    mimeType: 'application/json',
                    text: JSON.stringify(selectData),
                  },
                ],
                duration: 15 + Math.random() * 10,
                metadata: {
                  queryCount: this.queryCount,
                  recordCount: Object.keys(selectData).length,
                },
              };

            case 'INSERT':
              const insertData = params.data as Record<string, unknown>;
              const id = `id_${Date.now()}`;
              this.data.set(`${table}:${id}`, insertData);
              return {
                success: true,
                content: [
                  {
                    type: 'text',
                    text: `Inserted record with ID: ${id}`,
                  },
                ],
                duration: 20 + Math.random() * 15,
                metadata: { queryCount: this.queryCount, insertedId: id },
              };

            case 'DELETE':
              const deleteId = params.id as string;
              const deleted = this.data.delete(`${table}:${deleteId}`);
              if (!deleted) {
                return {
                  success: false,
                  isError: true,
                  content: [
                    {
                      type: 'error',
                      message: `Record not found: ${deleteId}`,
                      code: 'RECORD_NOT_FOUND',
                    },
                  ],
                };
              }
              return {
                success: true,
                content: [
                  {
                    type: 'text',
                    text: `Deleted record: ${deleteId}`,
                  },
                ],
                duration: 12 + Math.random() * 8,
                metadata: { queryCount: this.queryCount },
              };

            default:
              return {
                success: false,
                isError: true,
                content: [
                  {
                    type: 'error',
                    message: `Unsupported operation: ${operation}`,
                    code: 'UNSUPPORTED_OPERATION',
                  },
                ],
              };
          }
        }

        reset() {
          this.data.clear();
          this.queryCount = 0;
        }

        validate(params: Record<string, unknown>) {
          const errors: string[] = [];

          if (!params.operation) {
            errors.push('operation is required');
          } else if (!['SELECT', 'INSERT', 'DELETE'].includes(params.operation as string)) {
            errors.push('operation must be SELECT, INSERT, or DELETE');
          }

          if (!params.table) {
            errors.push('table is required');
          }

          if (params.operation === 'INSERT' && !params.data) {
            errors.push('data is required for INSERT operations');
          }

          if (params.operation === 'DELETE' && !params.id) {
            errors.push('id is required for DELETE operations');
          }

          return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
          };
        }

        getStats() {
          return {
            queryCount: this.queryCount,
            recordCount: this.data.size,
          };
        }
      }

      const executor = new DatabaseMockExecutor();
      const dbTool: MockTool = {
        name: 'Database',
        description: 'Mock database operations',
        category: 'system',
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: ['SELECT', 'INSERT', 'DELETE'] },
            table: { type: 'string' },
            data: { type: 'object' },
            id: { type: 'string' },
          },
          required: ['operation', 'table'],
        },
        execute: executor,
      };

      // Test INSERT
      const insertResponse = await executor.execute({
        operation: 'INSERT',
        table: 'users',
        data: { name: 'John Doe', email: 'john@example.com' },
      });
      expect(insertResponse.success).toBe(true);
      expect(insertResponse.metadata?.insertedId).toBeDefined();

      // Test SELECT
      const selectResponse = await executor.execute({
        operation: 'SELECT',
        table: 'users',
      });
      expect(selectResponse.success).toBe(true);
      expect(selectResponse.content[0].type).toBe('resource');

      // Test validation
      const validation = executor.validate({
        operation: 'INVALID',
        table: '',
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('operation must be SELECT, INSERT, or DELETE');
      expect(validation.errors).toContain('table is required');

      // Test stats
      const stats = executor.getStats();
      expect(stats.queryCount).toBe(2);

      // Test reset
      executor.reset();
      const resetStats = executor.getStats();
      expect(resetStats.queryCount).toBe(0);
    });

    it('should support async executors with delayed responses', async () => {
      class DelayedExecutor implements MockToolExecutor {
        private delays = new Map<string, number>();

        setDelay(operation: string, delay: number) {
          this.delays.set(operation, delay);
        }

        async execute(params: Record<string, unknown>, context?: ToolInvocationContext): Promise<MockToolResponse> {
          const operation = params.operation as string;
          const delay = this.delays.get(operation) || 0;

          const startTime = Date.now();

          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const duration = Date.now() - startTime;

          // Simulate cancellation support
          if (context?.signal?.aborted) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Operation was cancelled',
                  code: 'CANCELLED',
                },
              ],
              duration,
            };
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Operation ${operation} completed after ${duration}ms`,
              },
            ],
            duration,
            metadata: {
              operation,
              plannedDelay: delay,
              actualDuration: duration,
            },
          };
        }

        reset() {
          this.delays.clear();
        }
      }

      const executor = new DelayedExecutor();
      executor.setDelay('slow', 100);
      executor.setDelay('fast', 10);

      // Test fast operation
      const startFast = Date.now();
      const fastResponse = await executor.execute({ operation: 'fast' });
      const fastDuration = Date.now() - startFast;

      expect(fastResponse.success).toBe(true);
      expect(fastResponse.metadata?.plannedDelay).toBe(10);
      expect(fastDuration).toBeGreaterThanOrEqual(10);

      // Test slow operation
      const startSlow = Date.now();
      const slowResponse = await executor.execute({ operation: 'slow' });
      const slowDuration = Date.now() - startSlow;

      expect(slowResponse.success).toBe(true);
      expect(slowResponse.metadata?.plannedDelay).toBe(100);
      expect(slowDuration).toBeGreaterThanOrEqual(100);

      // Test cancellation
      const abortController = new AbortController();
      setTimeout(() => abortController.abort(), 50);

      const cancelledResponse = await executor.execute(
        { operation: 'slow' },
        { signal: abortController.signal }
      );
      expect(cancelledResponse.success).toBe(false);
      expect(cancelledResponse.content[0].code).toBe('CANCELLED');
    });
  });

  describe('Tool registry simulation', () => {
    it('should support tool registry behavior', () => {
      const registry = new Map<string, MockToolRegistryEntry>();

      const createTool = (name: string): MockTool => ({
        name,
        description: `Mock ${name} tool`,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
        execute: async (params) => ({
          success: true,
          content: [{ type: 'text', text: `${name} executed with: ${params.input}` }],
        }),
        recordInvocations: true,
        maxInvocations: 5,
      });

      const registerTool = (tool: MockTool) => {
        const entry: MockToolRegistryEntry = {
          tool,
          invocations: [],
          sequenceIndex: 0,
          invocationCount: 0,
          enabled: true,
          registeredAt: new Date(),
        };
        registry.set(tool.name, entry);
      };

      const invokeTool = async (toolName: string, params: Record<string, unknown>) => {
        const entry = registry.get(toolName);
        if (!entry || !entry.enabled) {
          throw new Error(`Tool ${toolName} not found or disabled`);
        }

        if (entry.tool.maxInvocations && entry.invocationCount >= entry.tool.maxInvocations) {
          throw new Error(`Tool ${toolName} has exceeded maximum invocations (${entry.tool.maxInvocations})`);
        }

        const invocation: ToolInvocation = {
          id: `inv_${toolName}_${Date.now()}`,
          toolName,
          parameters: params,
          invokedAt: new Date(),
        };

        const response = await (entry.tool.execute as Function)(params);

        invocation.response = response;
        invocation.completedAt = new Date();
        invocation.duration = response.duration || 0;

        if (entry.tool.recordInvocations) {
          entry.invocations.push(invocation);
        }

        entry.invocationCount++;
        entry.lastInvokedAt = new Date();

        return { invocation, response };
      };

      // Register tools
      registerTool(createTool('Read'));
      registerTool(createTool('Write'));
      registerTool(createTool('Execute'));

      expect(registry.size).toBe(3);
      expect(registry.get('Read')?.enabled).toBe(true);

      // Test invocations
      const result1 = await invokeTool('Read', { input: 'file.txt' });
      expect(result1.response.success).toBe(true);
      expect(result1.invocation.toolName).toBe('Read');

      const readEntry = registry.get('Read')!;
      expect(readEntry.invocationCount).toBe(1);
      expect(readEntry.invocations).toHaveLength(1);

      // Test max invocations
      for (let i = 0; i < 4; i++) {
        await invokeTool('Read', { input: `file_${i}.txt` });
      }

      expect(readEntry.invocationCount).toBe(5);
      await expect(invokeTool('Read', { input: 'final.txt' })).rejects.toThrow(
        'exceeded maximum invocations'
      );

      // Test disabling tools
      readEntry.enabled = false;
      await expect(invokeTool('Read', { input: 'disabled.txt' })).rejects.toThrow(
        'not found or disabled'
      );
    });
  });

  describe('Tool invocation events', () => {
    it('should support event emission patterns', async () => {
      const events: MockToolInvocationEvent[] = [];

      const emitEvent = (event: MockToolInvocationEvent) => {
        events.push(event);
      };

      const createEventEmittingTool = (name: string): MockTool => ({
        name,
        description: `Event-emitting ${name} tool`,
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string' },
          },
        },
        execute: async (params) => {
          const action = params.action as string;

          if (action === 'error') {
            const errorResponse: MockToolResponse = {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Simulated error',
                  code: 'SIMULATION_ERROR',
                },
              ],
            };
            return errorResponse;
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `${name} performed action: ${action}`,
              },
            ],
          };
        },
      });

      const executeWithEvents = async (tool: MockTool, params: Record<string, unknown>) => {
        const invocation: ToolInvocation = {
          id: `evt_${tool.name}_${Date.now()}`,
          toolName: tool.name,
          parameters: params,
          invokedAt: new Date(),
        };

        emitEvent({
          type: 'tool:invoked',
          toolName: tool.name,
          invocation,
          timestamp: new Date(),
        });

        try {
          const response = await (tool.execute as Function)(params);

          invocation.response = response;
          invocation.completedAt = new Date();
          invocation.duration = response.duration || 0;

          if (response.success) {
            emitEvent({
              type: 'tool:completed',
              toolName: tool.name,
              invocation,
              response,
              timestamp: new Date(),
            });
          } else {
            emitEvent({
              type: 'tool:error',
              toolName: tool.name,
              invocation,
              response,
              timestamp: new Date(),
            });
          }

          return { invocation, response };
        } catch (error) {
          const err = error as Error;
          invocation.error = err;
          invocation.completedAt = new Date();

          emitEvent({
            type: 'tool:error',
            toolName: tool.name,
            invocation,
            error: err,
            timestamp: new Date(),
          });

          throw error;
        }
      };

      const testTool = createEventEmittingTool('TestTool');

      // Test successful execution
      await executeWithEvents(testTool, { action: 'process' });
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('tool:invoked');
      expect(events[1].type).toBe('tool:completed');

      // Test error execution
      events.length = 0; // Clear events
      await executeWithEvents(testTool, { action: 'error' });
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('tool:invoked');
      expect(events[1].type).toBe('tool:error');
      expect(events[1].response?.success).toBe(false);

      // Verify event structure
      const event = events[0];
      expect(event.toolName).toBe('TestTool');
      expect(event.invocation.id).toContain('evt_TestTool_');
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Schema validation integration', () => {
    it('should validate complex tool responses', () => {
      const complexResponse: MockToolResponse = {
        success: true,
        content: [
          { type: 'text', text: 'Initial output' },
          {
            type: 'resource',
            uri: 'file:///tmp/output.json',
            mimeType: 'application/json',
            text: JSON.stringify({ processed: true, count: 42 }),
          },
          {
            type: 'image',
            data: 'base64encodedimagedata',
            mimeType: 'image/svg+xml',
          },
        ],
        duration: 234,
        metadata: {
          processedFiles: 5,
          warnings: ['File size exceeded recommended limit'],
          performance: {
            cpu: 45.2,
            memory: 128.5,
            io: 2.1,
          },
        },
        invokedAt: new Date('2024-01-01T10:00:00Z'),
        completedAt: new Date('2024-01-01T10:00:00.234Z'),
      };

      const validation = MockToolResponseSchema.safeParse(complexResponse);
      expect(validation.success).toBe(true);

      if (validation.success) {
        expect(validation.data.content).toHaveLength(3);
        expect(validation.data.content[0].type).toBe('text');
        expect(validation.data.content[1].type).toBe('resource');
        expect(validation.data.content[2].type).toBe('image');
        expect(validation.data.metadata?.processedFiles).toBe(5);
      }
    });

    it('should validate tool invocations with context', () => {
      const invocation: ToolInvocation = {
        id: 'complex_invocation_123',
        toolName: 'ComplexTool',
        parameters: {
          config: {
            retries: 3,
            timeout: 5000,
            endpoints: ['api.example.com', 'backup.example.com'],
          },
          filters: ['active', 'verified'],
          metadata: {
            source: 'user_input',
            priority: 'high',
          },
        },
        invokedAt: new Date('2024-01-01T10:00:00Z'),
        completedAt: new Date('2024-01-01T10:05:00Z'),
        duration: 300000,
        context: {
          taskId: 'task_workflow_456',
          agentName: 'integration_agent',
          stageName: 'data_processing',
          workingDirectory: '/tmp/workspace',
          requestId: 'req_789',
        },
        response: {
          success: true,
          content: [
            {
              type: 'text',
              text: 'Processing completed successfully',
            },
          ],
          duration: 300000,
        },
      };

      const validation = ToolInvocationSchema.safeParse(invocation);
      expect(validation.success).toBe(true);

      if (validation.success) {
        expect(validation.data.context?.taskId).toBe('task_workflow_456');
        expect(validation.data.context?.agentName).toBe('integration_agent');
        expect(validation.data.duration).toBe(300000);
      }
    });
  });
});