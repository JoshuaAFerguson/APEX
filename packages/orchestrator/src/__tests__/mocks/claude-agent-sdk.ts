/**
 * MockClaudeAgentSDK - Comprehensive mock for @anthropic-ai/claude-agent-sdk
 *
 * Provides configurable mocking for:
 * - query() function calls
 * - Streaming responses via async generators
 * - Error simulation
 * - Usage tracking
 */

import { vi } from 'vitest';
import { z } from 'zod';
import { MockToolRegistry } from './tool-mock-registry';
import type {
  MockQueryResponse,
  MockUsage,
  StreamingEvent,
  QueryCallRecord,
  MockQueryFunction,
  ContentBlock,
  ResponseOptions,
  DynamicResponseHandler
} from './claude-agent-sdk.types';
import type {
  MockToolDefinition,
  MockToolResult
} from './tool-mock.types';
import type {
  AgentDefinition as SDKAgentDefinition,
  QueryOptions
} from '@anthropic-ai/claude-agent-sdk';

export class MockClaudeAgentSDK {
  private queryResponses: (MockQueryResponse | StreamingEvent[] | Error)[] = [];
  private queryCallHistory: QueryCallRecord[] = [];
  private defaultResponse: MockQueryResponse | null = null;
  private queryMock: MockQueryFunction;
  private dynamicHandler: DynamicResponseHandler | null = null;
  private responseDelays: Map<number, number> = new Map(); // index -> delay
  private consumedCount = 0;
  private currentlyStreaming = false;
  private terminations: Array<{ method: string; reason: string; timestamp: Date }> = [];
  private streamingEvents: StreamingEvent[] = [];

  // Tool mocking capabilities
  private toolRegistry: MockToolRegistry = new MockToolRegistry();
  private toolMock = vi.fn();

  constructor() {
    this.queryMock = vi.fn() as MockQueryFunction;
    this.setupQueryMock();
    this.setupToolMock();
  }

  /**
   * Configure a mock response for the next query() call
   */
  addResponse(response: MockQueryResponse): this {
    this.queryResponses.push(response);
    return this;
  }

  /**
   * Configure multiple responses in sequence
   */
  addResponses(responses: MockQueryResponse[]): this {
    this.queryResponses.push(...responses);
    return this;
  }

  /**
   * Set a default response used when queue is empty
   */
  setDefaultResponse(response: MockQueryResponse): this {
    this.defaultResponse = response;
    return this;
  }

  /**
   * Configure an error to be thrown on next call
   */
  addError(error: Error | string): this {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    this.queryResponses.push(errorObj);
    return this;
  }

  /**
   * Configure streaming events
   */
  addStreamingResponse(events: StreamingEvent[]): this {
    this.queryResponses.push(events);
    return this;
  }

  /**
   * Configure streaming events (alias for compatibility)
   */
  addStreamingEvents(events: StreamingEvent[]): this {
    this.streamingEvents = events;
    this.queryResponses.push(events);
    return this;
  }

  /**
   * Configure a mock response with delay
   */
  addResponseWithDelay(response: MockQueryResponse, delay: number): this {
    const index = this.queryResponses.length;
    this.queryResponses.push(response);
    this.responseDelays.set(index, delay);
    return this;
  }

  /**
   * Set a dynamic response handler that can conditionally respond based on input
   */
  setDynamicHandler(handler: DynamicResponseHandler): this {
    this.dynamicHandler = handler;
    return this;
  }

  /**
   * Clear the dynamic handler
   */
  clearDynamicHandler(): this {
    this.dynamicHandler = null;
    return this;
  }

  /**
   * Get the mock query function to use with vi.mock()
   */
  getQueryMock(): MockQueryFunction {
    return this.queryMock;
  }

  /**
   * Get call history for assertions
   */
  getCallHistory(): QueryCallRecord[] {
    return [...this.queryCallHistory];
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.queryResponses = [];
    this.queryCallHistory = [];
    this.defaultResponse = null;
    this.dynamicHandler = null;
    this.responseDelays.clear();
    this.consumedCount = 0;
    this.currentlyStreaming = false;
    this.terminations = [];
    this.streamingEvents = [];

    // Reset tool mocking state
    this.toolRegistry.reset();

    vi.clearAllMocks();
    this.setupQueryMock();
    this.setupToolMock();
  }

  /**
   * Check if currently streaming
   */
  isCurrentlyStreaming(): boolean {
    return this.currentlyStreaming;
  }

  /**
   * Get termination records
   */
  getTerminations(): Array<{ method: string; reason: string; timestamp: Date }> {
    return [...this.terminations];
  }

  /**
   * Add a termination record
   */
  addTermination(method: string, reason: string): void {
    this.terminations.push({
      method,
      reason,
      timestamp: new Date()
    });
  }

  // ========================================
  // Tool Mocking Methods
  // ========================================

  /**
   * Get the tool registry for registering and managing mock tools
   */
  getToolRegistry(): MockToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get the mock tool() function for vi.mock()
   */
  getToolMock(): typeof this.toolMock {
    return this.toolMock;
  }

  /**
   * Register a mock tool (convenience method)
   */
  registerTool(definition: MockToolDefinition): this {
    this.toolRegistry.registerTool(
      definition.name,
      definition.description,
      definition.schema,
      definition.config
    );

    // Update the tool mock to handle this tool
    this.setupToolMock();

    return this;
  }

  /**
   * Register multiple tools at once
   */
  registerTools(definitions: MockToolDefinition[]): this {
    definitions.forEach(def => this.registerTool(def));
    return this;
  }

  /**
   * Setup tool mock to return registered tools or call through to original
   */
  private setupToolMock(): void {
    this.toolMock.mockImplementation(
      (name: string, description: string, schema: Record<string, z.ZodTypeAny>, handler?: Function) => {
        // If tool is registered in our mock registry, wrap handler with our mock
        if (this.toolRegistry.hasTool(name)) {
          return {
            name,
            description,
            inputSchema: schema,
            handler: async (args: Record<string, unknown>) => {
              const result = await this.toolRegistry.simulateExecution(name, args);

              // Convert MockToolResult to expected SDK format
              if (result.isError) {
                throw new Error(result.content?.[0]?.type === 'text' ? result.content[0].text : 'Tool execution failed');
              }

              return {
                content: result.content,
                ...result.structuredContent
              };
            },
          };
        }

        // Otherwise, use original handler if provided
        if (handler) {
          return { name, description, inputSchema: schema, handler };
        }

        // Default mock behavior
        return {
          name,
          description,
          inputSchema: schema,
          handler: async (args: Record<string, unknown>) => ({
            content: [{ type: 'text', text: `Mock result for ${name}` }]
          })
        };
      }
    );
  }

  /**
   * Mock query method that supports graceful termination
   */
  async mockQuery(options: { tools?: string[] } = {}): Promise<AsyncIterable<unknown>> {
    this.currentlyStreaming = true;

    // Get the next response or use default
    let response: MockQueryResponse | StreamingEvent[] | Error | undefined = this.queryResponses.shift();

    if (!response && this.defaultResponse) {
      response = this.defaultResponse;
    }

    if (response instanceof Error) {
      this.currentlyStreaming = false;
      throw response;
    }

    if (!response) {
      response = { content: 'Mock response' };
    }

    return this.createAsyncIterator(response);
  }

  /**
   * Set up the mock query function implementation
   */
  private setupQueryMock(): void {
    this.queryMock.mockImplementation(async (agent: SDKAgentDefinition, message: string, options?: QueryOptions) => {
      // Record the call
      this.queryCallHistory.push({
        timestamp: new Date(),
        agent,
        message,
        options
      });

      // 1. Try dynamic handler first
      if (this.dynamicHandler) {
        const dynamicResponse = await this.dynamicHandler(agent, message, options);
        if (dynamicResponse !== null) {
          return this.createAsyncIterator(dynamicResponse);
        }
      }

      // 2. Try queued response
      const responseIndex = this.consumedCount++;
      let response: MockQueryResponse | StreamingEvent[] | Error | undefined = this.queryResponses.shift();

      if (!response && this.defaultResponse) {
        response = this.defaultResponse;
      }

      // 3. Apply delay if configured
      const delay = this.responseDelays.get(responseIndex);
      if (delay) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // 4. Handle errors
      if (response instanceof Error) {
        throw response;
      }

      // 5. If no response configured, use a basic default
      if (!response) {
        response = { content: 'Mock response' };
      }

      // Return async generator
      return this.createAsyncIterator(response);
    });
  }

  /**
   * Create async iterator for the response
   */
  private createAsyncIterator(response: MockQueryResponse | StreamingEvent[]): AsyncIterable<unknown> {
    if (Array.isArray(response)) {
      // Streaming mode
      return this.createStreamingIterator(response);
    }

    // Single response mode
    return {
      [Symbol.asyncIterator]: async function* () {
        // Yield assistant message
        yield {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: response.output?.messages?.[0]?.content ?? [
              { type: 'text', text: response.content ?? 'Mock response' }
            ]
          }
        };

        // Yield usage information if provided
        if (response.usage) {
          yield {
            type: 'usage',
            usage: response.usage
          };
        }
      }
    };
  }

  /**
   * Create streaming async iterator
   */
  private createStreamingIterator(events: StreamingEvent[]): AsyncIterable<unknown> {
    const self = this;
    return {
      [Symbol.asyncIterator]: async function* () {
        try {
          for (const event of events) {
            if (event.delay) {
              await new Promise(resolve => setTimeout(resolve, event.delay));
            }

            if (event.type === 'error') {
              self.currentlyStreaming = false;
              const error = event.data instanceof Error ? event.data : new Error(String(event.data));

              // If it's a permission revoked error, add termination record
              if (error.message.includes('PermissionRevokedError')) {
                self.addTermination('graceful', 'Permission revoked for Write');
              }

              throw error;
            }

            yield event.data;
          }
          self.currentlyStreaming = false;
        } catch (error) {
          self.currentlyStreaming = false;
          throw error;
        }
      }
    };
  }
}

/**
 * Builder pattern for creating complex mock responses
 */
export class MockResponseBuilder {
  private response: MockQueryResponse = {};

  static create(): MockResponseBuilder {
    return new MockResponseBuilder();
  }

  withText(text: string): this {
    this.ensureOutput();
    this.ensureMessage();
    this.response.output!.messages![0].content.push({ type: 'text', text });
    return this;
  }

  withThinking(thinking: string): this {
    this.ensureOutput();
    this.ensureMessage();
    this.response.output!.messages![0].content.push({ type: 'thinking', thinking });
    return this;
  }

  withToolUse(id: string, name: string, input: Record<string, unknown>): this {
    this.ensureOutput();
    this.ensureMessage();
    this.response.output!.messages![0].content.push({ type: 'tool_use', id, name, input });
    return this;
  }

  withToolResult(toolUseId: string, content: string): this {
    this.ensureOutput();
    this.ensureMessage();
    this.response.output!.messages![0].content.push({ type: 'tool_result', tool_use_id: toolUseId, content });
    return this;
  }

  withUsage(inputTokens: number, outputTokens: number): this {
    this.response.usage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      input_tokens: inputTokens,   // SDK compatibility
      output_tokens: outputTokens, // SDK compatibility
    };
    return this;
  }

  withRequestId(id: string): this {
    this.response.requestId = id;
    return this;
  }

  asStreaming(): StreamingResponseBuilder {
    return new StreamingResponseBuilder(this.response);
  }

  build(): MockQueryResponse {
    // If only simple content was set, use it
    if (this.response.content && !this.response.output) {
      return { ...this.response };
    }

    return { ...this.response };
  }

  private ensureOutput(): void {
    if (!this.response.output) {
      this.response.output = { success: true, messages: [] };
    }
  }

  private ensureMessage(): void {
    if (!this.response.output!.messages?.length) {
      this.response.output!.messages = [{ role: 'assistant', content: [] }];
    }
  }
}

/**
 * Builder for creating streaming responses
 */
export class StreamingResponseBuilder {
  private events: StreamingEvent[] = [];

  constructor(private baseResponse?: MockQueryResponse) {}

  addTextChunk(text: string, delay?: number): this {
    this.events.push({
      type: 'text',
      data: {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text }]
        }
      },
      delay
    });
    return this;
  }

  addThinking(thinking: string, delay?: number): this {
    this.events.push({
      type: 'thinking',
      data: {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'thinking', thinking }]
        }
      },
      delay
    });
    return this;
  }

  addToolUse(id: string, name: string, input: Record<string, unknown>, delay?: number): this {
    this.events.push({
      type: 'tool_use',
      data: {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id, name, input }]
        }
      },
      delay
    });
    return this;
  }

  addUsage(inputTokens: number, outputTokens: number): this {
    this.events.push({
      type: 'usage',
      data: {
        type: 'usage',
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        }
      }
    });
    return this;
  }

  addError(error: Error | string): this {
    this.events.push({
      type: 'error',
      data: typeof error === 'string' ? new Error(error) : error
    });
    return this;
  }

  build(): StreamingEvent[] {
    return [...this.events];
  }
}

/**
 * Create a mock module for vi.mock()
 */
export function createMockModule(mockSDK: MockClaudeAgentSDK) {
  return {
    query: mockSDK.getQueryMock(),
    createSdkMcpServer: vi.fn(),
    tool: mockSDK.getToolMock(),
  };
}

/**
 * Helper to setup mock in test file
 */
export function setupMockSDK(): MockClaudeAgentSDK {
  const mockSDK = new MockClaudeAgentSDK();

  vi.mock('@anthropic-ai/claude-agent-sdk', () => createMockModule(mockSDK));

  return mockSDK;
}

/**
 * Helper to create mock hook input for testing hooks
 */
export function createMockHookInput(toolName: string, toolInput: Record<string, unknown>) {
  return { tool_name: toolName, tool_input: toolInput };
}

// Re-export types for convenience
export type {
  MockQueryResponse,
  MockUsage,
  StreamingEvent,
  QueryCallRecord,
  ContentBlock,
  ResponseOptions,
  DynamicResponseHandler
} from './claude-agent-sdk.types';

// Re-export common errors
export { MockErrors } from './claude-agent-sdk.types';