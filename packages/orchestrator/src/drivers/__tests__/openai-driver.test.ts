/**
 * Unit tests for OpenAiCodexDriver
 *
 * Tests the OpenAI driver implementation including:
 * - API key validation and authentication
 * - Model alias resolution
 * - Dynamic import handling
 * - Stream processing
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAiCodexDriver } from '../openai-driver.js';
import type { DriverRequest, DriverEvent } from '../types.js';

// Mock the openai dynamic import
const mockOpenAI = vi.fn();
const mockChatCompletions = {
  create: vi.fn()
};

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: mockChatCompletions
    };
    constructor(config: any) {
      mockOpenAI(config);
    }
  }
}));

describe('OpenAiCodexDriver', () => {
  let driver: OpenAiCodexDriver;

  beforeEach(() => {
    driver = new OpenAiCodexDriver();
    vi.clearAllMocks();
    // Clear environment variables
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization and authentication', () => {
    it('should have correct provider ID', () => {
      expect(driver.providerId).toBe('openai-codex');
    });

    it('should initialize with API key from environment', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      await driver.initialize();

      // Access the private apiKey field through type assertion
      expect((driver as any).apiKey).toBe('sk-test-key');
    });

    it('should handle missing API key during initialization', async () => {
      await driver.initialize();

      expect((driver as any).apiKey).toBeUndefined();
    });

    it('should authenticate with environment API key', async () => {
      process.env.OPENAI_API_KEY = 'sk-auth-test';

      await driver.authenticate();

      expect((driver as any).apiKey).toBe('sk-auth-test');
    });

    it('should throw error when authenticating without API key', async () => {
      await expect(driver.authenticate()).rejects.toThrow(
        'OPENAI_API_KEY environment variable is required'
      );
    });

    it('should set API key during authenticate even if not in env during init', async () => {
      // Initialize without key
      await driver.initialize();
      expect((driver as any).apiKey).toBeUndefined();

      // Set key and authenticate
      process.env.OPENAI_API_KEY = 'sk-delayed-key';
      await driver.authenticate();

      expect((driver as any).apiKey).toBe('sk-delayed-key');
    });
  });

  describe('model resolution', () => {
    it('should resolve opus to gpt-4o', () => {
      expect(driver.resolveModel('opus')).toBe('gpt-4o');
    });

    it('should resolve sonnet to gpt-4o', () => {
      expect(driver.resolveModel('sonnet')).toBe('gpt-4o');
    });

    it('should resolve haiku to gpt-4o-mini', () => {
      expect(driver.resolveModel('haiku')).toBe('gpt-4o-mini');
    });

    it('should resolve inherit to gpt-4o', () => {
      expect(driver.resolveModel('inherit')).toBe('gpt-4o');
    });

    it('should pass through unknown model aliases unchanged', () => {
      expect(driver.resolveModel('gpt-4-turbo')).toBe('gpt-4-turbo');
      expect(driver.resolveModel('custom-model')).toBe('custom-model');
    });

    it('should handle empty model alias', () => {
      expect(driver.resolveModel('')).toBe('');
    });
  });

  describe('stream method - error cases', () => {
    it('should yield error when API key not configured', async () => {
      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'gpt-4o'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'error', message: 'OpenAI API key not configured' }
      ]);
    });

    it('should handle OpenAI API errors', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      await driver.initialize();

      // Mock API error
      const apiError = new Error('API rate limit exceeded');
      mockChatCompletions.create.mockRejectedValue(apiError);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'gpt-4o'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'status',
        message: 'Connecting to OpenAI...'
      });
      expect(events).toContainEqual({
        type: 'error',
        message: 'API rate limit exceeded'
      });
    });

    it('should handle non-Error exceptions', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      await driver.initialize();

      mockChatCompletions.create.mockRejectedValue('String error');

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'gpt-4o'
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
  });

  describe('stream method - success cases', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      await driver.initialize();
    });

    it('should emit status message when starting', async () => {
      // Mock successful streaming response
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Hello' },
              finish_reason: null
            }]
          };
          yield {
            choices: [{
              delta: { content: ' world' },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15
            }
          };
        }
      };

      mockChatCompletions.create.mockResolvedValue(mockStream);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'gpt-4o'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events[0]).toEqual({
        type: 'status',
        message: 'Connecting to OpenAI...'
      });
    });

    it('should stream text content from delta', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Hello' },
              finish_reason: null
            }]
          };
          yield {
            choices: [{
              delta: { content: ' world!' },
              finish_reason: null
            }]
          };
          yield {
            choices: [{
              delta: {},
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5
            }
          };
        }
      };

      mockChatCompletions.create.mockResolvedValue(mockStream);

      const request: DriverRequest = {
        prompt: 'Say hello',
        model: 'gpt-4o'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      const textEvents = events.filter(e => e.type === 'text');
      expect(textEvents).toContainEqual({
        type: 'text',
        content: 'Hello'
      });
      expect(textEvents).toContainEqual({
        type: 'text',
        content: ' world!'
      });
    });

    it('should emit usage information', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Response' },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 25,
              completion_tokens: 10,
              total_tokens: 35
            }
          };
        }
      };

      mockChatCompletions.create.mockResolvedValue(mockStream);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'gpt-4o'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'usage',
        inputTokens: 25,
        outputTokens: 10
      });
    });

    it('should emit completion event when finished', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Complete response' },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5
            }
          };
        }
      };

      mockChatCompletions.create.mockResolvedValue(mockStream);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'gpt-4o'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'complete',
        summary: 'OpenAI response completed'
      });
    });

    it('should handle empty deltas gracefully', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: {}, // Empty delta
              finish_reason: null
            }]
          };
          yield {
            choices: [{
              delta: { content: 'Hello' },
              finish_reason: 'stop'
            }]
          };
        }
      };

      mockChatCompletions.create.mockResolvedValue(mockStream);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'gpt-4o'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      const textEvents = events.filter(e => e.type === 'text');
      expect(textEvents).toHaveLength(1);
      expect(textEvents[0]).toEqual({
        type: 'text',
        content: 'Hello'
      });
    });

    it('should handle missing choices gracefully', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            // No choices array
            usage: {
              prompt_tokens: 10,
              completion_tokens: 0
            }
          };
        }
      };

      mockChatCompletions.create.mockResolvedValue(mockStream);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'gpt-4o'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      // Should still emit status and usage, but no text events
      expect(events.filter(e => e.type === 'status')).toHaveLength(1);
      expect(events.filter(e => e.type === 'usage')).toHaveLength(1);
      expect(events.filter(e => e.type === 'text')).toHaveLength(0);
    });
  });

  describe('OpenAI API integration', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      await driver.initialize();
    });

    it('should call OpenAI API with correct parameters', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Response' },
              finish_reason: 'stop'
            }]
          };
        }
      };

      mockChatCompletions.create.mockResolvedValue(mockStream);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        systemPrompt: 'You are a helpful assistant',
        model: 'gpt-4o',
        abortController: new AbortController()
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(mockOpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test-key'
      });

      expect(mockChatCompletions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Test prompt' }
        ],
        stream: true
      }, {
        signal: request.abortController.signal
      });
    });

    it('should handle request without system prompt', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Response' },
              finish_reason: 'stop'
            }]
          };
        }
      };

      mockChatCompletions.create.mockResolvedValue(mockStream);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'gpt-4o'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(mockChatCompletions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: 'Test prompt' }
        ],
        stream: true
      }, {
        signal: undefined
      });
    });

    it('should pass abort controller signal when provided', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Response' },
              finish_reason: 'stop'
            }]
          };
        }
      };

      mockChatCompletions.create.mockResolvedValue(mockStream);

      const abortController = new AbortController();
      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'gpt-4o',
        abortController
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      const call = mockChatCompletions.create.mock.calls[0];
      expect(call[1].signal).toBe(abortController.signal);
    });
  });

  describe('edge cases and limitations', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      await driver.initialize();
    });

    it('should handle different finish reasons', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Partial' },
              finish_reason: 'length'
            }]
          };
        }
      };

      mockChatCompletions.create.mockResolvedValue(mockStream);

      const request: DriverRequest = {
        prompt: 'Long prompt',
        model: 'gpt-4o'
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'complete',
        summary: 'OpenAI response completed'
      });
    });

    it('should note OpenAI API limitations in comments', () => {
      // This test documents that the OpenAI driver has limitations:
      // 1. No tool calling support (unlike Anthropic driver)
      // 2. No thinking content support
      // 3. No MCP server integration
      // 4. No maxTurns or cwd support

      // These are architectural limitations that could be addressed in future versions
      expect(driver.providerId).toBe('openai-codex');
    });
  });
});