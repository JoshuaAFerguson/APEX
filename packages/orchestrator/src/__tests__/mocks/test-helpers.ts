/**
 * Test Helper Utilities for Claude Agent SDK Integration
 *
 * Provides high-level helper functions and common testing patterns
 * for mocking Claude Agent SDK tool calls and responses.
 */

import { vi, expect } from 'vitest';
import { z } from 'zod';
import {
  MockClaudeAgentSDK,
  MockResponseBuilder,
  StreamingResponseBuilder,
  MockToolRegistry,
  createMockTool
} from './index';
import type {
  MockQueryResponse,
  StreamingEvent,
  MockToolDefinition,
  MockToolResult,
  ToolInvocationRecord
} from './index';
import type { AgentDefinition as SDKAgentDefinition } from '@anthropic-ai/claude-agent-sdk';

/**
 * Configuration for test scenario setup
 */
export interface TestScenarioConfig {
  /** Default agent to use for tests */
  agent?: SDKAgentDefinition;
  /** Mock SDK instance to use */
  mockSDK?: MockClaudeAgentSDK;
  /** Whether to auto-reset between tests */
  autoReset?: boolean;
}

/**
 * Common test patterns and scenarios
 */
export interface TestPattern {
  name: string;
  setup: (mockSDK: MockClaudeAgentSDK) => void | Promise<void>;
  description?: string;
}

/**
 * Tool execution expectation
 */
export interface ToolExecutionExpectation {
  toolName: string;
  expectedCalls: number;
  expectedInputs?: Array<Record<string, unknown> | ((input: Record<string, unknown>) => boolean)>;
  shouldSucceed?: boolean;
  expectedOutputPattern?: string | RegExp;
}

/**
 * TestHelper - High-level helper class for common testing scenarios
 */
export class TestHelper {
  private mockSDK: MockClaudeAgentSDK;
  private toolRegistry: MockToolRegistry;
  private defaultAgent: SDKAgentDefinition;

  constructor(config: TestScenarioConfig = {}) {
    this.mockSDK = config.mockSDK || new MockClaudeAgentSDK();
    this.toolRegistry = this.mockSDK.getToolRegistry();
    this.defaultAgent = config.agent || {
      name: 'test-agent',
      models: ['claude-3-sonnet-20240229'],
      systemPrompt: 'You are a test agent',
      tools: []
    };
  }

  /**
   * Get the mock SDK instance
   */
  getSDK(): MockClaudeAgentSDK {
    return this.mockSDK;
  }

  /**
   * Get the tool registry
   */
  getToolRegistry(): MockToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get the default agent
   */
  getAgent(): SDKAgentDefinition {
    return this.defaultAgent;
  }

  /**
   * Set a custom agent for testing
   */
  setAgent(agent: SDKAgentDefinition): void {
    this.defaultAgent = agent;
  }

  /**
   * Reset all mock state
   */
  reset(): void {
    this.mockSDK.reset();
  }

  // ========================================
  // Common Tool Setup Patterns
  // ========================================

  /**
   * Setup common file system tools (Read, Write, Glob, Grep)
   */
  setupFileSystemTools(): void {
    this.setupReadTool();
    this.setupWriteTool();
    this.setupGlobTool();
    this.setupGrepTool();
  }

  /**
   * Setup Read tool with configurable responses
   */
  setupReadTool(responses: Array<{ path: string; content: string }> = []): void {
    const readTool = createMockTool('Read')
      .withDescription('Read file contents')
      .withSchemaShape({ file_path: z.string() })
      .withDynamicHandler((args) => {
        const filePath = args.file_path as string;
        const response = responses.find(r => r.path === filePath);

        if (response) {
          return {
            content: [{ type: 'text', text: response.content }],
            isError: false
          };
        }

        return {
          content: [{ type: 'text', text: `File not found: ${filePath}` }],
          isError: true
        };
      })
      .build();

    this.toolRegistry.registerTool(
      readTool.name,
      readTool.description,
      readTool.schema,
      readTool.config
    );
  }

  /**
   * Setup Write tool
   */
  setupWriteTool(): void {
    const writeTool = createMockTool('Write')
      .withDescription('Write file contents')
      .withSchemaShape({
        file_path: z.string(),
        content: z.string()
      })
      .withDynamicHandler((args) => ({
        content: [{ type: 'text', text: `Successfully wrote to ${args.file_path}` }],
        isError: false
      }))
      .build();

    this.toolRegistry.registerTool(
      writeTool.name,
      writeTool.description,
      writeTool.schema,
      writeTool.config
    );
  }

  /**
   * Setup Glob tool for file pattern matching
   */
  setupGlobTool(files: string[] = []): void {
    const globTool = createMockTool('Glob')
      .withDescription('Find files matching patterns')
      .withSchemaShape({ pattern: z.string() })
      .withDynamicHandler((args) => {
        const pattern = args.pattern as string;
        const matchedFiles = files.filter(file =>
          file.includes(pattern.replace('*', ''))
        );

        return {
          content: [{ type: 'text', text: matchedFiles.join('\n') }],
          structuredContent: { files: matchedFiles },
          isError: false
        };
      })
      .build();

    this.toolRegistry.registerTool(
      globTool.name,
      globTool.description,
      globTool.schema,
      globTool.config
    );
  }

  /**
   * Setup Grep tool for content search
   */
  setupGrepTool(searchResults: Array<{ pattern: string; files: Array<{ path: string; matches: string[] }> }> = []): void {
    const grepTool = createMockTool('Grep')
      .withDescription('Search content in files')
      .withSchemaShape({
        pattern: z.string(),
        path: z.string().optional()
      })
      .withDynamicHandler((args) => {
        const pattern = args.pattern as string;
        const result = searchResults.find(r => r.pattern === pattern);

        if (result) {
          const output = result.files.map(file =>
            `${file.path}:\n${file.matches.map(m => `  ${m}`).join('\n')}`
          ).join('\n\n');

          return {
            content: [{ type: 'text', text: output }],
            structuredContent: { searchResults: result.files },
            isError: false
          };
        }

        return {
          content: [{ type: 'text', text: `No matches found for pattern: ${pattern}` }],
          isError: false
        };
      })
      .build();

    this.toolRegistry.registerTool(
      grepTool.name,
      grepTool.description,
      grepTool.schema,
      grepTool.config
    );
  }

  // ========================================
  // Common Response Patterns
  // ========================================

  /**
   * Setup a simple success workflow
   */
  setupSuccessWorkflow(message: string = 'Task completed successfully'): void {
    const response = MockResponseBuilder.create()
      .withText(message)
      .withUsage(100, 50)
      .build();

    this.mockSDK.addResponse(response);
  }

  /**
   * Setup a thinking + tool usage workflow
   */
  setupToolWorkflow(steps: Array<{ thinking?: string; toolName: string; input: Record<string, unknown>; result?: string }>): void {
    const builder = MockResponseBuilder.create();

    steps.forEach((step, index) => {
      if (step.thinking) {
        builder.withThinking(step.thinking);
      }

      builder.withToolUse(`tool_${index}`, step.toolName, step.input);

      if (step.result) {
        builder.withToolResult(`tool_${index}`, step.result);
      }
    });

    builder.withUsage(200, 150);
    this.mockSDK.addResponse(builder.build());
  }

  /**
   * Setup a streaming workflow with delays
   */
  setupStreamingWorkflow(events: Array<{ type: 'thinking' | 'text' | 'tool'; content: string; delay?: number }>): void {
    const builder = new StreamingResponseBuilder();

    events.forEach(event => {
      switch (event.type) {
        case 'thinking':
          builder.addThinking(event.content, event.delay);
          break;
        case 'text':
          builder.addTextChunk(event.content, event.delay);
          break;
        case 'tool':
          builder.addToolUse(`tool_${Date.now()}`, 'GenericTool', { action: event.content }, event.delay);
          break;
      }
    });

    builder.addUsage(300, 200);
    this.mockSDK.addStreamingResponse(builder.build());
  }

  /**
   * Setup error scenario
   */
  setupErrorScenario(error: Error | string, afterCalls: number = 0): void {
    // Add success responses before the error
    for (let i = 0; i < afterCalls; i++) {
      this.mockSDK.addResponse({ content: `Success ${i + 1}` });
    }

    this.mockSDK.addError(error);
  }

  // ========================================
  // Assertion Helpers
  // ========================================

  /**
   * Assert that specific tools were called with expected patterns
   */
  assertToolsExecuted(expectations: ToolExecutionExpectation[]): void {
    for (const expectation of expectations) {
      const invocations = this.toolRegistry.getInvocations(expectation.toolName);

      // Check call count
      expect(invocations.length).toBe(expectation.expectedCalls);

      // Check inputs if specified
      if (expectation.expectedInputs) {
        expectation.expectedInputs.forEach((expectedInput, index) => {
          const invocation = invocations[index];
          expect(invocation).toBeDefined();

          if (typeof expectedInput === 'function') {
            expect(expectedInput(invocation.input)).toBe(true);
          } else {
            expect(invocation.input).toEqual(expectedInput);
          }
        });
      }

      // Check success/failure
      if (expectation.shouldSucceed !== undefined) {
        invocations.forEach(invocation => {
          if (expectation.shouldSucceed) {
            expect(invocation.error).toBeUndefined();
            expect(invocation.result?.isError).toBe(false);
          } else {
            expect(invocation.error || invocation.result?.isError).toBeTruthy();
          }
        });
      }

      // Check output pattern
      if (expectation.expectedOutputPattern) {
        invocations.forEach(invocation => {
          if (invocation.result) {
            const textContent = invocation.result.content
              .filter(block => block.type === 'text')
              .map(block => (block as any).text)
              .join(' ');

            if (typeof expectation.expectedOutputPattern === 'string') {
              expect(textContent).toContain(expectation.expectedOutputPattern);
            } else {
              expect(textContent).toMatch(expectation.expectedOutputPattern);
            }
          }
        });
      }
    }
  }

  /**
   * Assert call sequence
   */
  assertCallSequence(expectedSequence: string[]): void {
    const result = this.toolRegistry.verifyCallSequence(expectedSequence);
    expect(result.passed).toBe(true);

    if (!result.passed) {
      throw new Error(
        `Call sequence verification failed. Expected: [${result.expectedSequence.join(', ')}], ` +
        `Actual: [${result.actualSequence.join(', ')}]`
      );
    }
  }

  /**
   * Assert SDK call history patterns
   */
  assertSDKCallHistory(expectations: {
    totalCalls: number;
    agents?: string[];
    messages?: (string | RegExp)[];
    hasUsage?: boolean;
  }): void {
    const history = this.mockSDK.getCallHistory();

    expect(history.length).toBe(expectations.totalCalls);

    if (expectations.agents) {
      const agentNames = history.map(call => call.agent.name);
      expect(agentNames).toEqual(expectations.agents);
    }

    if (expectations.messages) {
      expectations.messages.forEach((expectedMessage, index) => {
        const actualMessage = history[index]?.message;
        expect(actualMessage).toBeDefined();

        if (typeof expectedMessage === 'string') {
          expect(actualMessage).toContain(expectedMessage);
        } else {
          expect(actualMessage).toMatch(expectedMessage);
        }
      });
    }

    if (expectations.hasUsage) {
      history.forEach(call => {
        // Usage should be present in responses, check via mock SDK responses
        // This is a placeholder - actual implementation would verify usage data
      });
    }
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Create a common test agent with tools
   */
  createTestAgent(name: string, tools: string[] = []): SDKAgentDefinition {
    return {
      name,
      models: ['claude-3-sonnet-20240229'],
      systemPrompt: `You are ${name}, a test agent`,
      tools
    };
  }

  /**
   * Simulate a multi-step workflow execution
   */
  async simulateWorkflow(steps: Array<{
    agent?: SDKAgentDefinition;
    message: string;
    expectedResponse?: (response: any) => void;
  }>): Promise<void> {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    for (const step of steps) {
      const agent = step.agent || this.defaultAgent;
      const result = query(agent, step.message);
      const responses = [];

      for await (const response of result) {
        responses.push(response);
      }

      if (step.expectedResponse) {
        step.expectedResponse(responses);
      }
    }
  }

  /**
   * Get tool execution summary
   */
  getExecutionSummary(): {
    totalToolCalls: number;
    toolUsage: Record<string, number>;
    errors: number;
    averageDuration: number;
  } {
    const allInvocations = this.toolRegistry.getInvocations();
    const toolUsage: Record<string, number> = {};
    let totalDuration = 0;
    let errorCount = 0;
    let durationsCount = 0;

    allInvocations.forEach(invocation => {
      toolUsage[invocation.toolName] = (toolUsage[invocation.toolName] || 0) + 1;

      if (invocation.error) {
        errorCount++;
      }

      if (invocation.duration !== undefined) {
        totalDuration += invocation.duration;
        durationsCount++;
      }
    });

    return {
      totalToolCalls: allInvocations.length,
      toolUsage,
      errors: errorCount,
      averageDuration: durationsCount > 0 ? totalDuration / durationsCount : 0
    };
  }
}

/**
 * Common test patterns for reuse across tests
 */
export const TestPatterns: Record<string, TestPattern> = {
  simpleSuccess: {
    name: 'Simple Success',
    description: 'Basic successful response',
    setup: (mockSDK) => {
      mockSDK.addResponse({ content: 'Task completed successfully', usage: { inputTokens: 50, outputTokens: 25 } });
    }
  },

  fileOperations: {
    name: 'File Operations',
    description: 'Read and write file operations',
    setup: (mockSDK) => {
      const helper = new TestHelper({ mockSDK });
      helper.setupFileSystemTools();

      const workflow = MockResponseBuilder.create()
        .withThinking('I need to read the file first')
        .withToolUse('read_1', 'Read', { file_path: '/test.txt' })
        .withThinking('Now I\'ll write the updated content')
        .withToolUse('write_1', 'Write', { file_path: '/test.txt', content: 'Updated content' })
        .withText('File operations completed successfully')
        .withUsage(200, 100)
        .build();

      mockSDK.addResponse(workflow);
    }
  },

  errorRecovery: {
    name: 'Error Recovery',
    description: 'Handle errors and recover',
    setup: (mockSDK) => {
      mockSDK
        .addError('Initial failure')
        .addResponse({ content: 'Recovered successfully' });
    }
  },

  streamingProgress: {
    name: 'Streaming Progress',
    description: 'Show progress through streaming',
    setup: (mockSDK) => {
      const streaming = new StreamingResponseBuilder()
        .addThinking('Starting analysis...', 100)
        .addTextChunk('Progress: 25%', 200)
        .addTextChunk('Progress: 50%', 200)
        .addTextChunk('Progress: 75%', 200)
        .addTextChunk('Progress: 100% - Complete!', 100)
        .addUsage(150, 75)
        .build();

      mockSDK.addStreamingResponse(streaming);
    }
  }
};

/**
 * Factory function to create a TestHelper with common patterns
 */
export function createTestHelper(config: TestScenarioConfig = {}): TestHelper {
  return new TestHelper(config);
}

/**
 * Setup function for common test environment
 */
export function setupTestEnvironment(config: TestScenarioConfig = {}): {
  helper: TestHelper;
  mockSDK: MockClaudeAgentSDK;
  toolRegistry: MockToolRegistry;
} {
  const helper = new TestHelper(config);
  const mockSDK = helper.getSDK();
  const toolRegistry = helper.getToolRegistry();

  // Mock the SDK module
  vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
    query: mockSDK.getQueryMock()
  }));

  return { helper, mockSDK, toolRegistry };
}

/**
 * Utility to verify complex tool interaction patterns
 */
export function verifyToolInteractionPattern(
  registry: MockToolRegistry,
  pattern: {
    description: string;
    expectations: Array<{
      tool: string;
      input?: Record<string, unknown> | ((input: Record<string, unknown>) => boolean);
      output?: string | RegExp;
      shouldSucceed?: boolean;
    }>;
    sequence?: string[];
  }
): void {
  // Verify call sequence if specified
  if (pattern.sequence) {
    const sequenceResult = registry.verifyCallSequence(pattern.sequence);
    expect(sequenceResult.passed).toBe(true);
  }

  // Verify individual tool expectations
  pattern.expectations.forEach((expectation, index) => {
    const invocations = registry.getInvocations(expectation.tool);
    expect(invocations.length).toBeGreaterThan(0);

    const invocation = invocations[invocations.length - 1]; // Get last invocation

    if (expectation.input) {
      if (typeof expectation.input === 'function') {
        expect(expectation.input(invocation.input)).toBe(true);
      } else {
        expect(invocation.input).toEqual(expectation.input);
      }
    }

    if (expectation.shouldSucceed !== undefined) {
      if (expectation.shouldSucceed) {
        expect(invocation.error).toBeUndefined();
        expect(invocation.result?.isError).toBe(false);
      } else {
        expect(invocation.error || invocation.result?.isError).toBeTruthy();
      }
    }

    if (expectation.output && invocation.result) {
      const textContent = invocation.result.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join(' ');

      if (typeof expectation.output === 'string') {
        expect(textContent).toContain(expectation.output);
      } else {
        expect(textContent).toMatch(expectation.output);
      }
    }
  });
}

// Export all test utilities
export * from './index';