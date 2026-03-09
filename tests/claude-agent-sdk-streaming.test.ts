/**
 * Claude Agent SDK Streaming API Tests
 *
 * Focused tests for streaming API implementations, message processing,
 * and event handling in the Claude Agent SDK integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnthropicDriver } from '../packages/orchestrator/src/drivers/anthropic-driver.js';
import type {
  DriverRequest,
  DriverEvent,
} from '../packages/orchestrator/src/drivers/types.js';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Claude Agent SDK Streaming API', () => {
  let driver: AnthropicDriver;

  beforeEach(() => {
    driver = new AnthropicDriver();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await driver.dispose();
  });

  describe('Query Configuration', () => {
    it('should configure SDK with correct permission settings', async () => {
      const mockQuery = vi.fn().mockReturnValue([]);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const stream = driver.stream(request);
      await stream.next();

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        options: expect.objectContaining({
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        }),
      });
    });

    it('should configure SDK with Claude Code tool preset', async () => {
      const mockQuery = vi.fn().mockReturnValue([]);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const stream = driver.stream(request);
      await stream.next();

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        options: expect.objectContaining({
          tools: { type: 'preset', preset: 'claude_code' },
        }),
      });
    });

    it('should pass through all driver request options', async () => {
      const mockQuery = vi.fn().mockReturnValue([]);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Complex test prompt',
        systemPrompt: 'You are a specialized assistant',
        model: 'claude-opus-4-5-20251101',
        maxTurns: 10,
        cwd: '/custom/working/directory',
        mcpServers: {
          'custom-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      const stream = driver.stream(request);
      await stream.next();

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Complex test prompt',
        options: expect.objectContaining({
          systemPrompt: 'You are a specialized assistant',
          model: 'claude-opus-4-5-20251101',
          maxTurns: 10,
          cwd: '/custom/working/directory',
          mcpServers: {
            'custom-server': {
              command: 'node',
              args: ['server.js'],
            },
          },
        }),
      });
    });

    it('should omit MCP servers when empty', async () => {
      const mockQuery = vi.fn().mockReturnValue([]);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const stream = driver.stream(request);
      await stream.next();

      const callArgs = mockQuery.mock.calls[0][0];
      expect(callArgs.options.mcpServers).toBeUndefined();
    });
  });

  describe('Message Processing', () => {
    it('should process assistant text messages', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Hello, this is Claude!' },
              { type: 'text', text: 'How can I help you today?' },
            ],
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Hello',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'text', content: 'Hello, this is Claude!' },
        { type: 'text', content: 'How can I help you today?' },
      ]);
    });

    it('should process tool use messages', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tool_abc123',
                name: 'Read',
                input: { file_path: '/path/to/file.txt' },
              },
              {
                type: 'tool_use',
                id: 'tool_def456',
                name: 'Write',
                input: { file_path: '/output.txt', content: 'Hello World' },
              },
            ],
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Read file and write output',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toEqual([
        {
          type: 'tool_call',
          id: 'tool_abc123',
          name: 'Read',
          input: { file_path: '/path/to/file.txt' },
        },
        {
          type: 'tool_call',
          id: 'tool_def456',
          name: 'Write',
          input: { file_path: '/output.txt', content: 'Hello World' },
        },
      ]);
    });

    it('should process thinking blocks', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'thinking', thinking: 'Let me analyze this problem step by step...' },
              { type: 'text', text: 'Based on my analysis, here is the solution:' },
              { type: 'thinking', thinking: 'I should also consider edge cases...' },
            ],
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Solve this complex problem',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'thinking', content: 'Let me analyze this problem step by step...' },
        { type: 'text', content: 'Based on my analysis, here is the solution:' },
        { type: 'thinking', content: 'I should also consider edge cases...' },
      ]);
    });

    it('should process mixed content types in single message', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'thinking', thinking: 'I need to read a file first' },
              { type: 'tool_use', id: 'tool_123', name: 'Read', input: { file_path: '/test.txt' } },
              { type: 'text', text: 'I will read the file and analyze it.' },
            ],
            usage: { input_tokens: 50, output_tokens: 25 },
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Analyze file',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'thinking', content: 'I need to read a file first' },
        { type: 'tool_call', id: 'tool_123', name: 'Read', input: { file_path: '/test.txt' } },
        { type: 'text', content: 'I will read the file and analyze it.' },
        { type: 'usage', inputTokens: 50, outputTokens: 25 },
      ]);
    });

    it('should process user messages with tool results', async () => {
      const mockMessages = [
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool_123',
                content: 'File contents: Hello World',
                is_error: false,
              },
              {
                type: 'tool_result',
                tool_use_id: 'tool_456',
                content: 'Error: File not found',
                is_error: true,
              },
            ],
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Process tool results',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toEqual([
        {
          type: 'tool_result',
          id: 'tool_123',
          content: 'File contents: Hello World',
          isError: false,
        },
        {
          type: 'tool_result',
          id: 'tool_456',
          content: 'Error: File not found',
          isError: true,
        },
      ]);
    });

    it('should process result messages with success', async () => {
      const mockMessages = [
        {
          type: 'result',
          subtype: 'success',
          result: 'Task completed successfully',
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Complete task',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'usage', inputTokens: 100, outputTokens: 50 },
        { type: 'complete', summary: 'Task completed successfully' },
      ]);
    });

    it('should process result messages with errors', async () => {
      const mockMessages = [
        {
          type: 'result',
          subtype: 'error',
          errors: ['Connection timeout', 'Rate limit exceeded'],
          usage: { input_tokens: 25, output_tokens: 0 },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Process with errors',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'usage', inputTokens: 25, outputTokens: 0 },
        { type: 'error', message: 'Connection timeout; Rate limit exceeded' },
      ]);
    });

    it('should skip unknown message types', async () => {
      const mockMessages = [
        {
          type: 'system',
          content: 'System initialization',
        },
        {
          type: 'stream_event',
          event: 'start',
        },
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Valid message' }],
          },
        },
        {
          type: 'unknown_type',
          data: 'Unknown data',
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test unknown types',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      // Should only process the valid assistant message
      expect(events).toEqual([
        { type: 'text', content: 'Valid message' },
      ]);
    });
  });

  describe('Usage Tracking', () => {
    it('should track usage from assistant messages', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Response with usage' }],
            usage: { input_tokens: 15, output_tokens: 8 },
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test usage tracking',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'usage',
        inputTokens: 15,
        outputTokens: 8,
      });
    });

    it('should track cumulative usage from result messages', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'First response' }],
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        },
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Second response' }],
            usage: { input_tokens: 8, output_tokens: 7 },
          },
        },
        {
          type: 'result',
          subtype: 'success',
          result: 'Complete',
          usage: { input_tokens: 18, output_tokens: 12 }, // Cumulative
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test cumulative usage',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      // Should have individual message usage and final cumulative usage
      const usageEvents = events.filter(e => e.type === 'usage');
      expect(usageEvents).toHaveLength(3);

      expect(usageEvents[0]).toEqual({ type: 'usage', inputTokens: 10, outputTokens: 5 });
      expect(usageEvents[1]).toEqual({ type: 'usage', inputTokens: 8, outputTokens: 7 });
      expect(usageEvents[2]).toEqual({ type: 'usage', inputTokens: 18, outputTokens: 12 });
    });

    it('should handle missing usage information gracefully', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'No usage info' }],
            // No usage field
          },
        },
        {
          type: 'result',
          subtype: 'success',
          result: 'Complete',
          // No usage field
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test missing usage',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'text', content: 'No usage info' },
        { type: 'complete', summary: 'Complete' },
      ]);

      // No usage events should be emitted
      const usageEvents = events.filter(e => e.type === 'usage');
      expect(usageEvents).toHaveLength(0);
    });

    it('should handle partial usage information', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Partial usage' }],
            usage: { input_tokens: 20 }, // Missing output_tokens
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test partial usage',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'usage',
        inputTokens: 20,
        outputTokens: 0, // Should default to 0
      });
    });
  });

  describe('Content Block Edge Cases', () => {
    it('should handle empty text blocks', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: '' },
              { type: 'text', text: undefined },
              { type: 'text', text: null },
            ],
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test empty text',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'text', content: '' },
        { type: 'text', content: '' },
        { type: 'text', content: '' },
      ]);
    });

    it('should handle malformed content blocks', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text' }, // Missing text field
              { type: 'tool_use' }, // Missing required fields
              { type: 'unknown_block', data: 'test' },
              { type: 'text', text: 'Valid text' },
            ],
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test malformed content',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      // Should handle malformed blocks gracefully and process valid ones
      expect(events).toContainEqual({
        type: 'text',
        content: 'Valid text',
      });
    });

    it('should handle null or undefined content arrays', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: null,
          },
        },
        {
          type: 'assistant',
          message: {
            content: undefined,
          },
        },
        {
          type: 'assistant',
          message: {
            // No content field
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test null content',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      // Should not crash and should produce no events
      expect(events).toHaveLength(0);
    });
  });
});