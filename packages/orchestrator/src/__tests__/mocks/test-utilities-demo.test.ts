/**
 * Demonstration of simplified test utilities using MockClaudeAgentSDK
 *
 * This file shows practical examples of how the mock utilities
 * can simplify common testing scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockClaudeAgentSDK,
  MockResponseBuilder,
  StreamingResponseBuilder,
  setupMockSDK,
  MockErrors
} from './index';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Use the setup helper for clean test initialization
const mockSDK = setupMockSDK();

const mockAgent = {
  name: 'test-agent',
  models: ['claude-3-sonnet-20240229'],
  systemPrompt: 'You are a test agent',
  tools: []
};

describe('Test Utilities Demonstrations', () => {
  beforeEach(() => {
    mockSDK.reset();
  });

  describe('Simple Test Scenarios', () => {
    it('should simplify basic text response testing', async () => {
      // Setup: One line configuration
      mockSDK.addResponse({ content: 'Hello, world!' });

      // Execute
      const result = query(mockAgent, 'Say hello');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      // Verify
      expect(responses[0].message.content[0].text).toBe('Hello, world!');
      expect(mockSDK.getCallHistory()).toHaveLength(1);
    });

    it('should simplify error testing', async () => {
      // Setup: One line error configuration
      mockSDK.addError(MockErrors.budgetExceeded());

      // Verify error handling
      await expect(async () => {
        const result = query(mockAgent, 'This will fail');
        for await (const response of result) {
          // Should not reach here
        }
      }).rejects.toThrow('Task exceeded budget limit');
    });

    it('should test sequential responses easily', async () => {
      // Setup: Fluent chain configuration
      mockSDK
        .addResponse({ content: 'First response' })
        .addResponse({ content: 'Second response' })
        .addResponse({ content: 'Third response' });

      // Execute multiple calls
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = query(mockAgent, `Message ${i + 1}`);
        const responses = [];
        for await (const response of result) {
          responses.push(response);
        }
        results.push(responses[0].message.content[0].text);
      }

      // Verify
      expect(results).toEqual(['First response', 'Second response', 'Third response']);
    });
  });

  describe('Advanced Testing Scenarios', () => {
    it('should test complex tool workflows', async () => {
      const toolWorkflow = MockResponseBuilder
        .create()
        .withThinking('I need to analyze the file structure')
        .withToolUse('read_1', 'Read', { file_path: '/src/components/App.tsx' })
        .withThinking('The component needs refactoring')
        .withToolUse('write_1', 'Write', {
          file_path: '/src/components/App.tsx',
          content: 'export const App = () => { return <div>Refactored</div>; };'
        })
        .withText('Successfully refactored the App component')
        .withUsage(450, 200)
        .build();

      mockSDK.addResponse(toolWorkflow);

      const result = query(mockAgent, 'Refactor the App component');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      // Verify complex content structure
      const content = responses[0].message.content;

      const thinkingBlocks = content.filter(block => block.type === 'thinking');
      expect(thinkingBlocks).toHaveLength(2);

      const toolBlocks = content.filter(block => block.type === 'tool_use');
      expect(toolBlocks).toHaveLength(2);
      expect(toolBlocks[0].name).toBe('Read');
      expect(toolBlocks[1].name).toBe('Write');

      const textBlocks = content.filter(block => block.type === 'text');
      expect(textBlocks[0].text).toContain('Successfully refactored');

      // Verify usage tracking
      expect(responses[1].usage.inputTokens).toBe(450);
      expect(responses[1].usage.outputTokens).toBe(200);
    });

    it('should test streaming behavior with timing', async () => {
      const streamingResponse = new StreamingResponseBuilder()
        .addThinking('Processing the request...', 100)
        .addTextChunk('Starting analysis', 200)
        .addToolUse('tool_1', 'Analyze', { target: 'codebase' }, 150)
        .addTextChunk('Analysis complete', 100)
        .addUsage(300, 150)
        .build();

      mockSDK.addStreamingResponse(streamingResponse);

      const startTime = Date.now();
      const result = query(mockAgent, 'Analyze the codebase');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }
      const duration = Date.now() - startTime;

      // Verify timing (should take at least 550ms total delay)
      expect(duration).toBeGreaterThanOrEqual(500);

      // Verify streaming structure
      expect(responses).toHaveLength(5);
      expect(responses[0].message.content[0].thinking).toBe('Processing the request...');
      expect(responses[4].usage.inputTokens).toBe(300);
    });
  });

  describe('Testing Edge Cases', () => {
    it('should test mixed success and failure scenarios', async () => {
      mockSDK
        .addResponse({ content: 'Success 1' })
        .addError('Temporary failure')
        .addResponse({ content: 'Success 2' })
        .addError(MockErrors.rateLimit())
        .addResponse({ content: 'Success 3' });

      // Test successful call
      let result = query(mockAgent, 'First call');
      let responses = [];
      for await (const response of result) {
        responses.push(response);
      }
      expect(responses[0].message.content[0].text).toBe('Success 1');

      // Test first failure
      await expect(async () => {
        result = query(mockAgent, 'Second call');
        for await (const response of result) {
          // Should not reach here
        }
      }).rejects.toThrow('Temporary failure');

      // Test recovery
      result = query(mockAgent, 'Third call');
      responses = [];
      for await (const response of result) {
        responses.push(response);
      }
      expect(responses[0].message.content[0].text).toBe('Success 2');

      // Test second failure
      await expect(async () => {
        result = query(mockAgent, 'Fourth call');
        for await (const response of result) {
          // Should not reach here
        }
      }).rejects.toThrow('Rate limit exceeded');

      // Test final recovery
      result = query(mockAgent, 'Fifth call');
      responses = [];
      for await (const response of result) {
        responses.push(response);
      }
      expect(responses[0].message.content[0].text).toBe('Success 3');

      expect(mockSDK.getCallHistory()).toHaveLength(5);
    });

    it('should test default fallback behavior', async () => {
      // Set a default response for when queue is empty
      mockSDK.setDefaultResponse({
        content: 'Default fallback response',
        usage: { inputTokens: 50, outputTokens: 25 }
      });

      // First call uses default
      let result = query(mockAgent, 'First message');
      let responses = [];
      for await (const response of result) {
        responses.push(response);
      }
      expect(responses[0].message.content[0].text).toBe('Default fallback response');

      // Second call also uses default (queue still empty)
      result = query(mockAgent, 'Second message');
      responses = [];
      for await (const response of result) {
        responses.push(response);
      }
      expect(responses[0].message.content[0].text).toBe('Default fallback response');

      expect(mockSDK.getCallHistory()).toHaveLength(2);
    });

    it('should test streaming error scenarios', async () => {
      const streamingWithError = new StreamingResponseBuilder()
        .addTextChunk('Processing started', 50)
        .addThinking('Working on it...', 100)
        .addError('Something went wrong during processing')
        .build();

      mockSDK.addStreamingResponse(streamingWithError);

      await expect(async () => {
        const result = query(mockAgent, 'Process this');
        const responses = [];
        for await (const response of result) {
          responses.push(response);
          // Error should be thrown during iteration
        }
      }).rejects.toThrow('Something went wrong during processing');
    });
  });

  describe('Call History Analysis', () => {
    it('should provide detailed call analytics', async () => {
      mockSDK
        .addResponse({ content: 'Planning', usage: { inputTokens: 100, outputTokens: 50 } })
        .addResponse({ content: 'Implementation', usage: { inputTokens: 200, outputTokens: 150 } })
        .addResponse({ content: 'Testing', usage: { inputTokens: 150, outputTokens: 100 } });

      const startTime = Date.now();

      // Simulate a workflow with different agents
      const agents = [
        { ...mockAgent, name: 'planner' },
        { ...mockAgent, name: 'developer' },
        { ...mockAgent, name: 'tester' }
      ];

      for (let i = 0; i < 3; i++) {
        const result = query(agents[i], `Stage ${i + 1} work`);
        const responses = [];
        for await (const response of result) {
          responses.push(response);
        }
      }

      const history = mockSDK.getCallHistory();

      // Verify call details
      expect(history).toHaveLength(3);
      expect(history[0].agent.name).toBe('planner');
      expect(history[1].agent.name).toBe('developer');
      expect(history[2].agent.name).toBe('tester');

      // Verify timing
      history.forEach(call => {
        expect(call.timestamp.getTime()).toBeGreaterThanOrEqual(startTime);
        expect(call.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
      });

      // Verify messages
      expect(history[0].message).toBe('Stage 1 work');
      expect(history[1].message).toBe('Stage 2 work');
      expect(history[2].message).toBe('Stage 3 work');
    });

    it('should support workflow analysis patterns', async () => {
      // Configure a complex multi-agent workflow
      mockSDK
        .addResponse({ content: 'Analysis complete', usage: { inputTokens: 150, outputTokens: 75 } })
        .addResponse({ content: 'Design finalized', usage: { inputTokens: 200, outputTokens: 100 } })
        .addResponse({ content: 'Code implemented', usage: { inputTokens: 350, outputTokens: 200 } })
        .addResponse({ content: 'Tests written', usage: { inputTokens: 250, outputTokens: 150 } })
        .addResponse({ content: 'Documentation updated', usage: { inputTokens: 100, outputTokens: 50 } });

      const workflowSteps = [
        'Analyze requirements',
        'Design architecture',
        'Implement features',
        'Write tests',
        'Update docs'
      ];

      // Execute workflow
      for (const step of workflowSteps) {
        const result = query(mockAgent, step);
        const responses = [];
        for await (const response of result) {
          responses.push(response);
        }
      }

      const history = mockSDK.getCallHistory();

      // Workflow analysis
      const totalCalls = history.length;
      const averageResponseTime = history.reduce((acc, call, index) => {
        if (index === 0) return 0;
        return acc + (history[index].timestamp.getTime() - history[index - 1].timestamp.getTime());
      }, 0) / (totalCalls - 1);

      expect(totalCalls).toBe(5);
      expect(averageResponseTime).toBeGreaterThanOrEqual(0);

      // Message flow analysis
      const messageFlow = history.map(call => call.message);
      expect(messageFlow).toEqual(workflowSteps);
    });
  });
});