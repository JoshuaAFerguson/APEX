/**
 * Test file demonstrating MockClaudeAgentSDK usage
 *
 * This file serves both as tests for the mock utilities and
 * as documentation for how to use them in other test files.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockClaudeAgentSDK,
  MockResponseBuilder,
  StreamingResponseBuilder,
  setupMockSDK,
  createMockModule,
  createMockHookInput,
  MockErrors
} from './claude-agent-sdk';
import type {
  MockQueryResponse,
  StreamingEvent,
  QueryCallRecord
} from './claude-agent-sdk.types';
import { query, type AgentDefinition as SDKAgentDefinition } from '@anthropic-ai/claude-agent-sdk';

// Mock the SDK module
vi.mock('@anthropic-ai/claude-agent-sdk');

describe('MockClaudeAgentSDK', () => {
  let mockSDK: MockClaudeAgentSDK;
  let mockAgent: SDKAgentDefinition;

  beforeEach(() => {
    mockSDK = new MockClaudeAgentSDK();
    vi.mocked(query).mockImplementation(mockSDK.getQueryMock());

    mockAgent = {
      name: 'test-agent',
      models: ['claude-3-sonnet-20240229'],
      systemPrompt: 'You are a test agent',
      tools: []
    };
  });

  describe('Basic Functionality', () => {
    it('should create a mock SDK instance', () => {
      expect(mockSDK).toBeInstanceOf(MockClaudeAgentSDK);
      expect(mockSDK.getQueryMock()).toBeDefined();
      expect(typeof mockSDK.getQueryMock()).toBe('function');
    });

    it('should track call history', async () => {
      mockSDK.addResponse({ content: 'Hello, world!' });

      const result = query(mockAgent, 'Hello');

      // Consume the async iterator
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      const history = mockSDK.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].agent).toEqual(mockAgent);
      expect(history[0].message).toBe('Hello');
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });

    it('should reset state properly', async () => {
      mockSDK.addResponse({ content: 'Test' });
      await query(mockAgent, 'Test message');

      expect(mockSDK.getCallHistory()).toHaveLength(1);

      mockSDK.reset();

      expect(mockSDK.getCallHistory()).toHaveLength(0);
    });
  });

  describe('Response Configuration', () => {
    it('should return configured text response', async () => {
      mockSDK.addResponse({ content: 'Hello, world!' });

      const result = query(mockAgent, 'Hello');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      expect(responses).toHaveLength(1);
      expect(responses[0]).toMatchObject({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, world!' }]
        }
      });
    });

    it('should return multiple responses in sequence', async () => {
      mockSDK
        .addResponse({ content: 'First response' })
        .addResponse({ content: 'Second response' })
        .addResponse({ content: 'Third response' });

      // First call
      const result1 = query(mockAgent, 'Message 1');
      const responses1 = [];
      for await (const response of result1) {
        responses1.push(response);
      }

      // Second call
      const result2 = query(mockAgent, 'Message 2');
      const responses2 = [];
      for await (const response of result2) {
        responses2.push(response);
      }

      // Third call
      const result3 = query(mockAgent, 'Message 3');
      const responses3 = [];
      for await (const response of result3) {
        responses3.push(response);
      }

      expect(responses1[0].message.content[0].text).toBe('First response');
      expect(responses2[0].message.content[0].text).toBe('Second response');
      expect(responses3[0].message.content[0].text).toBe('Third response');
    });

    it('should use default response when queue is empty', async () => {
      mockSDK.setDefaultResponse({ content: 'Default response' });

      const result = query(mockAgent, 'Hello');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      expect(responses[0].message.content[0].text).toBe('Default response');
    });

    it('should include usage information when provided', async () => {
      mockSDK.addResponse({
        content: 'Hello',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          input_tokens: 100,
          output_tokens: 50
        }
      });

      const result = query(mockAgent, 'Hello');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      expect(responses).toHaveLength(2);
      expect(responses[1]).toMatchObject({
        type: 'usage',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150
        }
      });
    });
  });

  describe('Error Simulation', () => {
    it('should throw configured errors', async () => {
      const testError = new Error('Test error');
      mockSDK.addError(testError);

      await expect(async () => {
        const result = query(mockAgent, 'Hello');
        for await (const response of result) {
          // Should not reach here
        }
      }).rejects.toThrow('Test error');
    });

    it('should throw string errors as Error objects', async () => {
      mockSDK.addError('String error message');

      await expect(async () => {
        const result = query(mockAgent, 'Hello');
        for await (const response of result) {
          // Should not reach here
        }
      }).rejects.toThrow('String error message');
    });

    it('should provide predefined error types', async () => {
      mockSDK.addError(MockErrors.sessionLimit());

      await expect(async () => {
        const result = query(mockAgent, 'Hello');
        for await (const response of result) {
          // Should not reach here
        }
      }).rejects.toThrow('Session limit reached');
    });
  });

  describe('Streaming Responses', () => {
    it('should simulate streaming events', async () => {
      const streamingEvents: StreamingEvent[] = [
        {
          type: 'text',
          data: {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'First chunk' }]
            }
          }
        },
        {
          type: 'text',
          data: {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'Second chunk' }]
            }
          }
        },
        {
          type: 'usage',
          data: {
            type: 'usage',
            usage: { inputTokens: 100, outputTokens: 50 }
          }
        }
      ];

      mockSDK.addStreamingResponse(streamingEvents);

      const result = query(mockAgent, 'Hello');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      expect(responses).toHaveLength(3);
      expect(responses[0].message.content[0].text).toBe('First chunk');
      expect(responses[1].message.content[0].text).toBe('Second chunk');
      expect(responses[2].usage.inputTokens).toBe(100);
    });

    it('should handle streaming errors', async () => {
      const streamingEvents: StreamingEvent[] = [
        {
          type: 'text',
          data: {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'Before error' }]
            }
          }
        },
        {
          type: 'error',
          data: new Error('Streaming error')
        }
      ];

      mockSDK.addStreamingResponse(streamingEvents);

      await expect(async () => {
        const result = query(mockAgent, 'Hello');
        const responses = [];
        for await (const response of result) {
          responses.push(response);
        }
      }).rejects.toThrow('Streaming error');
    });

    it('should respect delay timing in streaming', async () => {
      const startTime = Date.now();

      const streamingEvents: StreamingEvent[] = [
        {
          type: 'text',
          data: {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'First' }]
            }
          },
          delay: 100
        },
        {
          type: 'text',
          data: {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'Second' }]
            }
          }
        }
      ];

      mockSDK.addStreamingResponse(streamingEvents);

      const result = query(mockAgent, 'Hello');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(responses).toHaveLength(2);
    });
  });

  describe('MockResponseBuilder', () => {
    it('should build simple text response', () => {
      const response = MockResponseBuilder
        .create()
        .withText('Hello, world!')
        .build();

      expect(response.output?.messages?.[0].content).toContainEqual({
        type: 'text',
        text: 'Hello, world!'
      });
    });

    it('should build response with thinking content', () => {
      const response = MockResponseBuilder
        .create()
        .withThinking('Let me think about this...')
        .withText('Here is my answer.')
        .build();

      expect(response.output?.messages?.[0].content).toContainEqual({
        type: 'thinking',
        thinking: 'Let me think about this...'
      });
      expect(response.output?.messages?.[0].content).toContainEqual({
        type: 'text',
        text: 'Here is my answer.'
      });
    });

    it('should build response with tool usage', () => {
      const response = MockResponseBuilder
        .create()
        .withThinking('I need to read a file')
        .withToolUse('tool_123', 'Read', { file_path: '/src/index.ts' })
        .withUsage(200, 100)
        .build();

      expect(response.output?.messages?.[0].content).toContainEqual({
        type: 'tool_use',
        id: 'tool_123',
        name: 'Read',
        input: { file_path: '/src/index.ts' }
      });
      expect(response.usage?.inputTokens).toBe(200);
      expect(response.usage?.outputTokens).toBe(100);
    });

    it('should build streaming response', () => {
      const events = MockResponseBuilder
        .create()
        .withText('Hello')
        .asStreaming()
        .addTextChunk('Hello', 50)
        .addThinking('Processing...', 100)
        .addUsage(100, 50)
        .build();

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('text');
      expect(events[0].delay).toBe(50);
      expect(events[1].type).toBe('thinking');
      expect(events[1].delay).toBe(100);
      expect(events[2].type).toBe('usage');
    });
  });

  describe('StreamingResponseBuilder', () => {
    it('should build streaming events independently', () => {
      const events = new StreamingResponseBuilder()
        .addTextChunk('First chunk', 50)
        .addTextChunk('Second chunk', 100)
        .addUsage(200, 150)
        .build();

      expect(events).toHaveLength(3);
      expect(events[0].delay).toBe(50);
      expect(events[1].delay).toBe(100);
      expect(events[2].type).toBe('usage');
    });

    it('should build tool use streaming events', () => {
      const events = new StreamingResponseBuilder()
        .addThinking('I need to use a tool')
        .addToolUse('tool_456', 'Write', { file_path: '/test.ts', content: 'test' })
        .build();

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('thinking');
      expect(events[1].type).toBe('tool_use');
      expect(events[1].data.message.content[0]).toMatchObject({
        type: 'tool_use',
        id: 'tool_456',
        name: 'Write',
        input: { file_path: '/test.ts', content: 'test' }
      });
    });
  });

  describe('Utility Functions', () => {
    it('should setup mock SDK with helper function', () => {
      // This would be used in actual test files
      const testMockSDK = setupMockSDK();

      expect(testMockSDK).toBeInstanceOf(MockClaudeAgentSDK);
      expect(testMockSDK.getQueryMock()).toBeDefined();
    });

    it('should create mock module for vi.mock()', () => {
      const module = createMockModule(mockSDK);

      expect(module.query).toBe(mockSDK.getQueryMock());
      expect(module.createSdkMcpServer).toBeDefined();
      expect(module.tool).toBeDefined();
    });

    it('should create mock hook input', () => {
      const hookInput = createMockHookInput('Read', { file_path: '/test.ts' });

      expect(hookInput).toEqual({
        tool_name: 'Read',
        tool_input: { file_path: '/test.ts' }
      });
    });
  });

  describe('Real-world Usage Examples', () => {
    it('should simulate orchestrator task execution', async () => {
      // Simulate a multi-agent workflow
      mockSDK
        .addResponse({
          content: 'Planning complete',
          usage: { inputTokens: 100, outputTokens: 50 }
        })
        .addResponse({
          content: 'Implementation complete',
          usage: { inputTokens: 200, outputTokens: 100 }
        })
        .addResponse({
          content: 'Testing complete',
          usage: { inputTokens: 150, outputTokens: 75 }
        });

      // Simulate three agent calls
      for (let i = 0; i < 3; i++) {
        const result = query(mockAgent, `Stage ${i + 1} message`);
        const responses = [];
        for await (const response of result) {
          responses.push(response);
        }
        expect(responses).toHaveLength(2); // message + usage
      }

      const history = mockSDK.getCallHistory();
      expect(history).toHaveLength(3);
      expect(history[0].message).toBe('Stage 1 message');
      expect(history[1].message).toBe('Stage 2 message');
      expect(history[2].message).toBe('Stage 3 message');
    });

    it('should simulate complex tool usage workflow', async () => {
      const complexResponse = MockResponseBuilder
        .create()
        .withThinking('I need to read the current code')
        .withToolUse('read_1', 'Read', { file_path: '/src/index.ts' })
        .withThinking('Now I need to write the updated code')
        .withToolUse('write_1', 'Write', {
          file_path: '/src/index.ts',
          content: 'export const hello = "world";'
        })
        .withText('I have successfully updated the file.')
        .withUsage(300, 150)
        .build();

      mockSDK.addResponse(complexResponse);

      const result = query(mockAgent, 'Update the index.ts file');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      expect(responses).toHaveLength(2);
      const content = responses[0].message.content;

      // Check for thinking blocks
      const thinkingBlocks = content.filter(block => block.type === 'thinking');
      expect(thinkingBlocks).toHaveLength(2);

      // Check for tool use blocks
      const toolBlocks = content.filter(block => block.type === 'tool_use');
      expect(toolBlocks).toHaveLength(2);

      // Check for text response
      const textBlocks = content.filter(block => block.type === 'text');
      expect(textBlocks).toHaveLength(1);
      expect(textBlocks[0].text).toBe('I have successfully updated the file.');
    });
  });
});