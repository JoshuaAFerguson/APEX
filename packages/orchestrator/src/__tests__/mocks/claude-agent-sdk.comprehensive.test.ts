/**
 * Comprehensive test coverage for MockClaudeAgentSDK configurable response system
 *
 * Tests all acceptance criteria:
 * 1. Static responses via builder
 * 2. Dynamic handlers (conditional responses based on input)
 * 3. Response sequences (first call returns X, second returns Y)
 * 4. Delays per method
 * 5. Mixed configurations
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockClaudeAgentSDK,
  MockResponseBuilder,
  StreamingResponseBuilder,
  MockErrors
} from './claude-agent-sdk';
import type {
  MockQueryResponse,
  DynamicResponseHandler
} from './claude-agent-sdk.types';
import { query, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

vi.mock('@anthropic-ai/claude-agent-sdk');

describe('Configurable Response System - Comprehensive Tests', () => {
  let mockSDK: MockClaudeAgentSDK;
  let testAgent: AgentDefinition;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSDK = new MockClaudeAgentSDK();
    vi.mocked(query).mockImplementation(mockSDK.getQueryMock());

    testAgent = {
      name: 'test-agent',
      models: ['claude-3-sonnet-20240229'],
      systemPrompt: 'You are a test agent',
      tools: []
    };
  });

  describe('1. Static Responses via Builder', () => {
    it('should build text-only responses', async () => {
      const response = MockResponseBuilder.create()
        .withText('Hello, world!')
        .build();

      mockSDK.addResponse(response);

      const result = query(testAgent, 'test message');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, world!' }]
        }
      });
    });

    it('should build responses with multiple content blocks', async () => {
      const response = MockResponseBuilder.create()
        .withText('Thinking...')
        .withThinking('Let me process this request')
        .withText('Here is my response')
        .build();

      mockSDK.addResponse(response);

      const result = query(testAgent, 'test message');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }

      expect(events[0].message.content).toHaveLength(3);
      expect(events[0].message.content[0]).toEqual({ type: 'text', text: 'Thinking...' });
      expect(events[0].message.content[1]).toEqual({ type: 'thinking', thinking: 'Let me process this request' });
      expect(events[0].message.content[2]).toEqual({ type: 'text', text: 'Here is my response' });
    });

    it('should build responses with tool use and results', async () => {
      const response = MockResponseBuilder.create()
        .withToolUse('tool-1', 'read_file', { path: '/test/file.txt' })
        .withToolResult('tool-1', 'File content here')
        .withText('Based on the file content...')
        .build();

      mockSDK.addResponse(response);

      const result = query(testAgent, 'read the file');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }

      expect(events[0].message.content).toHaveLength(3);
      expect(events[0].message.content[0]).toEqual({
        type: 'tool_use',
        id: 'tool-1',
        name: 'read_file',
        input: { path: '/test/file.txt' }
      });
      expect(events[0].message.content[1]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: 'File content here'
      });
      expect(events[0].message.content[2]).toEqual({
        type: 'text',
        text: 'Based on the file content...'
      });
    });

    it('should build responses with usage information', async () => {
      const response = MockResponseBuilder.create()
        .withText('Response with usage')
        .withUsage(100, 50)
        .build();

      mockSDK.addResponse(response);

      const result = query(testAgent, 'test message');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[1]).toMatchObject({
        type: 'usage',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          input_tokens: 100,
          output_tokens: 50
        }
      });
    });

    it('should build responses with request ID', async () => {
      const response = MockResponseBuilder.create()
        .withText('Response with ID')
        .withRequestId('req-123')
        .build();

      mockSDK.addResponse(response);

      const result = query(testAgent, 'test message');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }

      expect(response.requestId).toBe('req-123');
    });

    it('should support streaming responses via builder', async () => {
      const streamingEvents = new StreamingResponseBuilder()
        .addTextChunk('First chunk')
        .addTextChunk('Second chunk')
        .addUsage(50, 25)
        .build();

      mockSDK.addStreamingResponse(streamingEvents);

      const result = query(testAgent, 'streaming test');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0].message.content[0].text).toBe('First chunk');
      expect(events[1].message.content[0].text).toBe('Second chunk');
      expect(events[2].type).toBe('usage');
    });

    it('should handle simple content responses', async () => {
      const response: MockQueryResponse = { content: 'Simple text response' };
      mockSDK.addResponse(response);

      const result = query(testAgent, 'test message');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }

      expect(events[0].message.content[0].text).toBe('Simple text response');
    });

    it('should build streaming responses with delays', async () => {
      const streamingEvents = new StreamingResponseBuilder()
        .addTextChunk('Delayed chunk', 100)
        .build();

      mockSDK.addStreamingResponse(streamingEvents);

      const startTime = Date.now();
      const result = query(testAgent, 'delayed test');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some tolerance
      expect(events[0].message.content[0].text).toBe('Delayed chunk');
    });
  });

  describe('2. Dynamic Handlers', () => {
    it('should call dynamic handler with agent, message, and options', async () => {
      const handler = vi.fn().mockReturnValue({ content: 'Dynamic response' });
      mockSDK.setDynamicHandler(handler);

      const options = { temperature: 0.7 };
      await query(testAgent, 'test message', options).next();

      expect(handler).toHaveBeenCalledWith(testAgent, 'test message', options);
    });

    it('should support async dynamic handlers', async () => {
      const handler: DynamicResponseHandler = async (agent, message) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { content: `Async response to: ${message}` };
      };
      mockSDK.setDynamicHandler(handler);

      const result = query(testAgent, 'async test');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }

      expect(events[0].message.content[0].text).toBe('Async response to: async test');
    });

    it('should support conditional responses based on message content', async () => {
      const handler: DynamicResponseHandler = (agent, message) => {
        if (message.includes('file')) {
          return { content: 'Reading file...' };
        }
        if (message.includes('database')) {
          return { content: 'Querying database...' };
        }
        return null; // Fallback to queue/default
      };
      mockSDK.setDynamicHandler(handler);
      mockSDK.setDefaultResponse({ content: 'Default response' });

      // Test file message
      let result = query(testAgent, 'read this file');
      let events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Reading file...');

      // Test database message
      result = query(testAgent, 'query the database');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Querying database...');

      // Test fallback
      result = query(testAgent, 'something else');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Default response');
    });

    it('should support conditional responses based on agent name', async () => {
      const devAgent: AgentDefinition = { ...testAgent, name: 'developer' };
      const testingAgent: AgentDefinition = { ...testAgent, name: 'tester' };

      const handler: DynamicResponseHandler = (agent, message) => {
        if (agent.name === 'developer') {
          return { content: 'Writing code...' };
        }
        if (agent.name === 'tester') {
          return { content: 'Running tests...' };
        }
        return null;
      };
      mockSDK.setDynamicHandler(handler);

      // Test developer agent
      let result = query(devAgent, 'implement feature');
      let events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Writing code...');

      // Test tester agent
      result = query(testingAgent, 'verify feature');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Running tests...');
    });

    it('should fallback to queue when handler returns null', async () => {
      const handler: DynamicResponseHandler = () => null;
      mockSDK.setDynamicHandler(handler);
      mockSDK.addResponse({ content: 'Queued response' });

      const result = query(testAgent, 'test message');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }

      expect(events[0].message.content[0].text).toBe('Queued response');
    });

    it('should support error responses from dynamic handler', async () => {
      const handler: DynamicResponseHandler = () => {
        return new Error('Dynamic error');
      };
      mockSDK.setDynamicHandler(handler);

      await expect(async () => {
        const result = query(testAgent, 'error test');
        for await (const event of result) {
          // Should not reach here
        }
      }).rejects.toThrow('Dynamic error');
    });
  });

  describe('3. Response Sequences', () => {
    it('should verify first call returns X, second returns Y', async () => {
      mockSDK
        .addResponse({ content: 'First response' })
        .addResponse({ content: 'Second response' })
        .addResponse({ content: 'Third response' });

      // First call
      let result = query(testAgent, 'first');
      let events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('First response');

      // Second call
      result = query(testAgent, 'second');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Second response');

      // Third call
      result = query(testAgent, 'third');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Third response');
    });

    it('should handle N-call sequences with distinct responses', async () => {
      const responses = [
        { content: 'Response 1' },
        { content: 'Response 2' },
        { content: 'Response 3' },
        { content: 'Response 4' },
        { content: 'Response 5' }
      ];
      mockSDK.addResponses(responses);

      for (let i = 0; i < responses.length; i++) {
        const result = query(testAgent, `message ${i + 1}`);
        const events = [];
        for await (const event of result) {
          events.push(event);
        }
        expect(events[0].message.content[0].text).toBe(`Response ${i + 1}`);
      }
    });

    it('should verify call order via history', async () => {
      mockSDK
        .addResponse({ content: 'First' })
        .addResponse({ content: 'Second' })
        .addResponse({ content: 'Third' });

      await query(testAgent, 'first call').next();
      await query(testAgent, 'second call').next();
      await query(testAgent, 'third call').next();

      const history = mockSDK.getCallHistory();
      expect(history).toHaveLength(3);
      expect(history[0].message).toBe('first call');
      expect(history[1].message).toBe('second call');
      expect(history[2].message).toBe('third call');
      expect(history[0].timestamp).toBeLessThanOrEqual(history[1].timestamp);
      expect(history[1].timestamp).toBeLessThanOrEqual(history[2].timestamp);
    });

    it('should transition from sequence to default after queue exhaustion', async () => {
      mockSDK
        .addResponse({ content: 'Queued 1' })
        .addResponse({ content: 'Queued 2' })
        .setDefaultResponse({ content: 'Default response' });

      // Consume queued responses
      for (let i = 0; i < 2; i++) {
        const result = query(testAgent, `call ${i + 1}`);
        const events = [];
        for await (const event of result) {
          events.push(event);
        }
        expect(events[0].message.content[0].text).toBe(`Queued ${i + 1}`);
      }

      // Should now use default
      const result = query(testAgent, 'default call');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Default response');
    });

    it('should support interleaved success/error sequences', async () => {
      mockSDK
        .addResponse({ content: 'Success 1' })
        .addError('Error 1')
        .addResponse({ content: 'Success 2' })
        .addError('Error 2');

      // First call - success
      let result = query(testAgent, 'call 1');
      let events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Success 1');

      // Second call - error
      await expect(async () => {
        result = query(testAgent, 'call 2');
        for await (const event of result) {
          // Should not reach here
        }
      }).rejects.toThrow('Error 1');

      // Third call - success
      result = query(testAgent, 'call 3');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Success 2');

      // Fourth call - error
      await expect(async () => {
        result = query(testAgent, 'call 4');
        for await (const event of result) {
          // Should not reach here
        }
      }).rejects.toThrow('Error 2');
    });
  });

  describe('4. Delays Per Method', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should delay non-streaming responses', async () => {
      mockSDK.addResponseWithDelay({ content: 'Delayed response' }, 1000);

      const resultPromise = (async () => {
        const result = query(testAgent, 'delayed test');
        const events = [];
        for await (const event of result) {
          events.push(event);
        }
        return events;
      })();

      // Advance time
      await vi.advanceTimersByTimeAsync(1000);

      const events = await resultPromise;
      expect(events[0].message.content[0].text).toBe('Delayed response');
    });

    it('should support different delays for different methods', async () => {
      mockSDK
        .addResponseWithDelay({ content: 'Fast response' }, 100)
        .addResponseWithDelay({ content: 'Slow response' }, 1000);

      const startTime = Date.now();

      // Fast response
      const fastPromise = (async () => {
        const result = query(testAgent, 'fast');
        for await (const event of result) {
          return Date.now() - startTime;
        }
      })();

      await vi.advanceTimersByTimeAsync(100);
      const fastTime = await fastPromise;

      // Slow response
      const slowPromise = (async () => {
        const result = query(testAgent, 'slow');
        for await (const event of result) {
          return Date.now() - startTime;
        }
      })();

      await vi.advanceTimersByTimeAsync(1000);
      const slowTime = await slowPromise;

      expect(fastTime).toBeLessThan(slowTime);
    });

    it('should verify timing with tolerance', async () => {
      vi.useRealTimers(); // Use real timers for this test

      mockSDK.addResponseWithDelay({ content: 'Timed response' }, 50);

      const startTime = Date.now();
      const result = query(testAgent, 'timing test');
      const events = [];
      for await (const event of result) {
        events.push(event);
      }
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(40); // 20% tolerance below
      expect(elapsed).toBeLessThan(100); // Should not take too long
      expect(events[0].message.content[0].text).toBe('Timed response');
    });

    it('should not delay when no delay configured', async () => {
      mockSDK.addResponse({ content: 'Immediate response' });

      const startTime = Date.now();

      const resultPromise = (async () => {
        const result = query(testAgent, 'immediate test');
        const events = [];
        for await (const event of result) {
          events.push(event);
        }
        return events;
      })();

      // Don't advance timers - should complete immediately
      const events = await resultPromise;

      expect(events[0].message.content[0].text).toBe('Immediate response');
    });
  });

  describe('5. Mixed Configurations', () => {
    it('should combine static responses with dynamic handler fallback', async () => {
      const handler: DynamicResponseHandler = (agent, message) => {
        if (message.includes('special')) {
          return { content: 'Special dynamic response' };
        }
        return null; // Fallback to queue
      };

      mockSDK
        .setDynamicHandler(handler)
        .addResponse({ content: 'Queued response 1' })
        .addResponse({ content: 'Queued response 2' });

      // First call - should use dynamic handler
      let result = query(testAgent, 'special request');
      let events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Special dynamic response');

      // Second call - should use queue
      result = query(testAgent, 'normal request');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Queued response 1');

      // Third call - should use dynamic handler again
      result = query(testAgent, 'another special request');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Special dynamic response');
    });

    it('should combine sequences with delays', async () => {
      vi.useFakeTimers();

      mockSDK
        .addResponseWithDelay({ content: 'Delayed first' }, 100)
        .addResponseWithDelay({ content: 'Delayed second' }, 200)
        .addResponse({ content: 'Immediate third' });

      // First call with delay
      let resultPromise = (async () => {
        const result = query(testAgent, 'first');
        const events = [];
        for await (const event of result) {
          events.push(event);
        }
        return events;
      })();

      await vi.advanceTimersByTimeAsync(100);
      let events = await resultPromise;
      expect(events[0].message.content[0].text).toBe('Delayed first');

      // Second call with longer delay
      resultPromise = (async () => {
        const result = query(testAgent, 'second');
        const events = [];
        for await (const event of result) {
          events.push(event);
        }
        return events;
      })();

      await vi.advanceTimersByTimeAsync(200);
      events = await resultPromise;
      expect(events[0].message.content[0].text).toBe('Delayed second');

      // Third call immediate
      resultPromise = (async () => {
        const result = query(testAgent, 'third');
        const events = [];
        for await (const event of result) {
          events.push(event);
        }
        return events;
      })();

      events = await resultPromise;
      expect(events[0].message.content[0].text).toBe('Immediate third');

      vi.useRealTimers();
    });

    it('should combine streaming with non-streaming responses', async () => {
      const streamingEvents = new StreamingResponseBuilder()
        .addTextChunk('Streaming chunk 1')
        .addTextChunk('Streaming chunk 2')
        .build();

      mockSDK
        .addStreamingResponse(streamingEvents)
        .addResponse({ content: 'Non-streaming response' });

      // First call - streaming
      let result = query(testAgent, 'streaming');
      let events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events).toHaveLength(2);
      expect(events[0].message.content[0].text).toBe('Streaming chunk 1');
      expect(events[1].message.content[0].text).toBe('Streaming chunk 2');

      // Second call - non-streaming
      result = query(testAgent, 'non-streaming');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events).toHaveLength(1);
      expect(events[0].message.content[0].text).toBe('Non-streaming response');
    });

    it('should combine errors within sequences with recovery', async () => {
      mockSDK
        .addResponse({ content: 'Success before error' })
        .addError(MockErrors.networkTimeout())
        .addResponse({ content: 'Recovery after error' })
        .addError('Another error')
        .addResponse({ content: 'Final recovery' });

      // First call - success
      let result = query(testAgent, 'call 1');
      let events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Success before error');

      // Second call - error
      await expect(async () => {
        result = query(testAgent, 'call 2');
        for await (const event of result) {
          // Should not reach here
        }
      }).rejects.toThrow('Network timeout');

      // Third call - recovery
      result = query(testAgent, 'call 3');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Recovery after error');

      // Fourth call - another error
      await expect(async () => {
        result = query(testAgent, 'call 4');
        for await (const event of result) {
          // Should not reach here
        }
      }).rejects.toThrow('Another error');

      // Fifth call - final recovery
      result = query(testAgent, 'call 5');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Final recovery');
    });

    it('should handle complex multi-agent workflow with mixed config', async () => {
      const plannerAgent: AgentDefinition = { ...testAgent, name: 'planner' };
      const developerAgent: AgentDefinition = { ...testAgent, name: 'developer' };
      const testerAgent: AgentDefinition = { ...testAgent, name: 'tester' };

      // Complex dynamic handler with agent-specific logic
      const handler: DynamicResponseHandler = (agent, message) => {
        if (agent.name === 'planner' && message.includes('plan')) {
          return { content: 'Creating detailed plan...' };
        }
        if (agent.name === 'developer' && message.includes('implement')) {
          return { content: 'Writing implementation...' };
        }
        if (agent.name === 'tester' && message.includes('test')) {
          return { content: 'Running test suite...' };
        }
        return null;
      };

      mockSDK
        .setDynamicHandler(handler)
        .addResponseWithDelay({ content: 'Delayed fallback 1' }, 50)
        .addResponse({ content: 'Immediate fallback 2' })
        .setDefaultResponse({ content: 'Default for unexpected calls' });

      // Planner with dynamic handler
      let result = query(plannerAgent, 'create a plan');
      let events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Creating detailed plan...');

      // Developer with dynamic handler
      result = query(developerAgent, 'implement the feature');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Writing implementation...');

      // Tester with dynamic handler
      result = query(testerAgent, 'test the implementation');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Running test suite...');

      // Non-matching message - should use delayed fallback
      vi.useFakeTimers();
      const resultPromise = (async () => {
        const result = query(plannerAgent, 'something else');
        const events = [];
        for await (const event of result) {
          events.push(event);
        }
        return events;
      })();

      await vi.advanceTimersByTimeAsync(50);
      events = await resultPromise;
      expect(events[0].message.content[0].text).toBe('Delayed fallback 1');

      vi.useRealTimers();

      // Another non-matching - should use immediate fallback
      result = query(developerAgent, 'other task');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Immediate fallback 2');

      // Final call - should use default
      result = query(testerAgent, 'unexpected');
      events = [];
      for await (const event of result) {
        events.push(event);
      }
      expect(events[0].message.content[0].text).toBe('Default for unexpected calls');
    });
  });
});