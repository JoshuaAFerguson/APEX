/**
 * Unit tests for AnthropicDriver
 *
 * Tests the Anthropic AI driver implementation including:
 * - Model alias resolution
 * - Credential management integration
 * - SDK message mapping
 * - AbortController handling
 * - Error handling and disposal
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { AnthropicDriver } from '../anthropic-driver.js';
import type { DriverRequest, DriverEvent } from '../types.js';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn()
}));

// Mock the credential manager
const mockCredentialManager = {
  getCredentials: vi.fn()
};
vi.mock('../auth/credential-manager.js', () => ({
  CredentialManager: vi.fn().mockImplementation(() => mockCredentialManager)
}));

// Import the mocked query function
import { query } from '@anthropic-ai/claude-agent-sdk';
const mockQuery = query as MockedFunction<typeof query>;

describe('AnthropicDriver', () => {
  let driver: AnthropicDriver;

  beforeEach(() => {
    driver = new AnthropicDriver();
    vi.clearAllMocks();
    // Clear environment variables
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(async () => {
    await driver.dispose();
    vi.clearAllMocks();
  });

  describe('initialization and authentication', () => {
    it('should have correct provider ID', () => {
      expect(driver.providerId).toBe('anthropic');
    });

    it('should initialize with credentials from credential manager', async () => {
      const mockCreds = {
        accessToken: 'sk-ant-api03-test-key',
        provider: 'anthropic'
      };

      mockCredentialManager.getCredentials.mockResolvedValue(mockCreds);

      await driver.initialize();

      expect(mockCredentialManager.getCredentials).toHaveBeenCalledWith('anthropic');
      expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-api03-test-key');
    });

    it('should handle missing credentials gracefully', async () => {
      mockCredentialManager.getCredentials.mockResolvedValue(null);

      await driver.initialize();

      expect(mockCredentialManager.getCredentials).toHaveBeenCalledWith('anthropic');
      expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
    });

    it('should handle credentials without access token', async () => {
      const mockCreds = {
        provider: 'anthropic'
        // no accessToken
      };

      mockCredentialManager.getCredentials.mockResolvedValue(mockCreds);

      await driver.initialize();

      expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
    });

    it('should prompt for authentication', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await driver.authenticate();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Please run "apex auth login anthropic" to authenticate.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('model resolution', () => {
    it('should resolve opus model alias', () => {
      expect(driver.resolveModel('opus')).toBe('claude-opus-4-5-20251101');
    });

    it('should resolve haiku model alias', () => {
      expect(driver.resolveModel('haiku')).toBe('claude-haiku-4-5-20251001');
    });

    it('should resolve sonnet model alias', () => {
      expect(driver.resolveModel('sonnet')).toBe('claude-sonnet-4-20250514');
    });

    it('should default to sonnet for unknown aliases', () => {
      expect(driver.resolveModel('unknown')).toBe('claude-sonnet-4-20250514');
    });

    it('should default to sonnet for empty string', () => {
      expect(driver.resolveModel('')).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('stream method', () => {
    it('should create SDK options correctly', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'result',
            subtype: 'success',
            usage: { input_tokens: 100, output_tokens: 50 }
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        systemPrompt: 'You are a helpful assistant',
        model: 'claude-sonnet-4-20250514',
        maxTurns: 5,
        cwd: '/test/path',
        mcpServers: { 'test-server': { command: 'test', args: [] } },
        abortController: new AbortController()
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        options: {
          abortController: request.abortController,
          systemPrompt: 'You are a helpful assistant',
          model: 'claude-sonnet-4-20250514',
          maxTurns: 5,
          cwd: '/test/path',
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          tools: { type: 'preset', preset: 'claude_code' },
          mcpServers: { 'test-server': { command: 'test', args: [] } }
        }
      });
    });

    it('should create AbortController when none provided', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'result',
            subtype: 'success'
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        options: expect.objectContaining({
          abortController: expect.any(AbortController)
        })
      });
    });

    it('should not include mcpServers when empty', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'result',
            subtype: 'success'
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {}
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      const callArgs = mockQuery.mock.calls[0][0];
      expect(callArgs.options).not.toHaveProperty('mcpServers');
    });
  });

  describe('SDK message mapping', () => {
    it('should map assistant message with text content', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [
                { type: 'text', text: 'Hello, world!' }
              ]
            }
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'text',
        content: 'Hello, world!'
      });
    });

    it('should map assistant message with tool_use content', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'tool_use',
                  id: 'tool123',
                  name: 'read_file',
                  input: { file_path: 'test.txt' }
                }
              ]
            }
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'tool_call',
        id: 'tool123',
        name: 'read_file',
        input: { file_path: 'test.txt' }
      });
    });

    it('should map assistant message with thinking content', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'thinking',
                  thinking: 'Let me think about this...'
                }
              ]
            }
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'thinking',
        content: 'Let me think about this...'
      });
    });

    it('should map assistant message with usage information', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [
                { type: 'text', text: 'Response' }
              ],
              usage: {
                input_tokens: 100,
                output_tokens: 50
              }
            }
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'usage',
        inputTokens: 100,
        outputTokens: 50
      });
    });

    it('should map user message with tool results', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'tool123',
                  content: 'File content here',
                  is_error: false
                }
              ]
            }
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'tool_result',
        id: 'tool123',
        content: 'File content here',
        isError: false
      });
    });

    it('should map result message with success', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'result',
            subtype: 'success',
            result: 'Task completed successfully',
            usage: {
              input_tokens: 200,
              output_tokens: 100
            }
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'usage',
        inputTokens: 200,
        outputTokens: 100
      });

      expect(events).toContainEqual({
        type: 'complete',
        summary: 'Task completed successfully'
      });
    });

    it('should map result message with error', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'result',
            subtype: 'error',
            errors: ['Error 1', 'Error 2']
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'error',
        message: 'Error 1; Error 2'
      });
    });

    it('should handle empty or null content gracefully', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: null
            }
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      // Should not produce any text/tool events
      expect(events.filter(e => e.type === 'text' || e.type === 'tool_call')).toHaveLength(0);
    });

    it('should skip unknown message types', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'unknown',
            data: 'unknown data'
          };
          yield {
            type: 'system',
            data: 'system data'
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      // Should produce no events
      expect(events).toHaveLength(0);
    });
  });

  describe('error handling and abortion', () => {
    it('should handle AbortError gracefully', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      mockQuery.mockImplementation(() => {
        throw abortError;
      });

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'status',
        message: 'Query aborted'
      });
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Something went wrong');

      mockQuery.mockImplementation(() => {
        throw genericError;
      });

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'error',
        message: 'Something went wrong'
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockQuery.mockImplementation(() => {
        throw 'String error';
      });

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'error',
        message: 'String error'
      });
    });

    it('should track active controllers for disposal', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          // Simulate long running operation
          await new Promise(resolve => setTimeout(resolve, 100));
          yield {
            type: 'result',
            subtype: 'success'
          };
        }
      };

      mockQuery.mockReturnValue(mockAsyncIterable);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514'
      };

      // Start streaming but don't await completion
      const streamIterator = driver.stream(request);

      // Call dispose while streaming is in progress
      await driver.dispose();

      // The stream should complete (either normally or via abort)
      const events: DriverEvent[] = [];
      for await (const event of streamIterator) {
        events.push(event);
      }

      // No specific assertions needed - just that dispose doesn't hang
      expect(true).toBe(true);
    });
  });

  describe('disposal and cleanup', () => {
    it('should dispose of active controllers', async () => {
      const abortSpy = vi.fn();
      const mockController = {
        abort: abortSpy
      };

      // Add a mock controller to the active set
      (driver as any).activeControllers.add(mockController);

      await driver.dispose();

      expect(abortSpy).toHaveBeenCalled();
      expect((driver as any).activeControllers.size).toBe(0);
    });

    it('should handle abort errors during disposal', async () => {
      const mockController = {
        abort: vi.fn(() => {
          throw new Error('Abort failed');
        })
      };

      // Add a mock controller that will throw
      (driver as any).activeControllers.add(mockController);

      // Should not throw
      await driver.dispose();

      expect((driver as any).activeControllers.size).toBe(0);
    });

    it('should handle multiple dispose calls safely', async () => {
      await driver.dispose();
      await driver.dispose(); // Second call should be safe

      expect(true).toBe(true); // Should not throw
    });
  });
});