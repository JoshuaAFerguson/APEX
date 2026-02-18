/**
 * @fileoverview Tool Mock Factory
 *
 * This file provides a comprehensive factory for creating mock implementations
 * of all APEX tools. It supports various testing scenarios including success/failure,
 * permission checking, and performance testing.
 */

import { vi, type MockedFunction } from 'vitest';
import type { AgentTool } from '@apex/core/types';
import type { ToolMock, ToolMockConfig, IntegrationTestContext } from '../types.js';

// ============================================================================
// Core Mock Factory
// ============================================================================

/**
 * Create a mock for any APEX tool with configurable behavior
 */
export function createToolMock(config: ToolMockConfig): ToolMock {
  const calls: ToolMock['calls'] = [];
  let callCount = 0;

  const mockFn = vi.fn().mockImplementation(async (...args: any[]) => {
    const callInfo = {
      args,
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    callCount++;

    try {
      // Add delay if specified
      if (config.delay && config.delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, config.delay));
      }

      // Check if we should fail after a certain number of calls
      if (config.failAfterCalls && callCount > config.failAfterCalls) {
        const error = config.error || new Error(`Tool ${config.tool} failed after ${config.failAfterCalls} calls`);
        callInfo.error = error;
        throw error;
      }

      // Check if tool should fail
      if (config.shouldSucceed === false) {
        const error = config.error || new Error(`Tool ${config.tool} operation failed`);
        callInfo.error = error;
        throw error;
      }

      // Return configured response or default based on tool type
      const result = config.response !== undefined ? config.response : getDefaultResponse(config.tool, args);
      callInfo.result = result;

      return result;
    } finally {
      if (config.trackCalls !== false) {
        calls.push(callInfo);
      }
    }
  });

  return {
    mock: mockFn,
    config,
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
      callCount = 0;
    },
    getCallHistory: () => [...calls],
  };
}

/**
 * Create multiple tool mocks with a shared configuration base
 */
export function createToolMocks(
  tools: AgentTool[],
  baseConfig: Partial<ToolMockConfig> = {}
): Map<AgentTool, ToolMock> {
  const mocks = new Map<AgentTool, ToolMock>();

  for (const tool of tools) {
    const mock = createToolMock({
      tool,
      shouldSucceed: true,
      trackCalls: true,
      ...baseConfig,
    });
    mocks.set(tool, mock);
  }

  return mocks;
}

/**
 * Register tool mocks with a test context for automatic cleanup
 */
export function registerToolMocks(
  context: IntegrationTestContext,
  mocks: Map<AgentTool, ToolMock> | ToolMock[]
): void {
  const mockArray = mocks instanceof Map ? Array.from(mocks.values()) : mocks;

  for (const mock of mockArray) {
    context.mocks.add(mock.mock);
  }
}

// ============================================================================
// Default Response Generators
// ============================================================================

/**
 * Generate default responses for tools based on their type
 */
function getDefaultResponse(tool: AgentTool, args: any[]): any {
  switch (tool) {
    case 'Read':
      return {
        success: true,
        content: `Mock content for file: ${args[0]?.file_path || 'unknown'}`,
        lines: 10,
        encoding: 'utf-8',
      };

    case 'Write':
    case 'Edit':
      return {
        success: true,
        path: args[0]?.file_path || '/tmp/test-file.txt',
        bytesWritten: 1024,
      };

    case 'Bash':
      return {
        success: true,
        stdout: 'Mock command output',
        stderr: '',
        exitCode: 0,
        command: args[0]?.command || 'echo "test"',
      };

    case 'Glob':
      return {
        success: true,
        files: [
          '/src/components/App.tsx',
          '/src/components/Button.tsx',
          '/src/utils/helpers.ts',
        ],
        pattern: args[0]?.pattern || '**/*.{ts,tsx}',
      };

    case 'Grep':
      return {
        success: true,
        matches: [
          { file: '/src/App.tsx', line: 15, text: 'export default function App()' },
          { file: '/src/utils.ts', line: 8, text: 'export function helper()' },
        ],
        pattern: args[0]?.pattern || 'export',
      };

    case 'WebFetch':
      return {
        success: true,
        content: '<html><body><h1>Mock Web Content</h1></body></html>',
        url: args[0]?.url || 'https://example.com',
        status: 200,
        headers: { 'content-type': 'text/html' },
      };

    case 'WebSearch':
      return {
        success: true,
        results: [
          {
            title: 'Mock Search Result 1',
            url: 'https://example.com/1',
            snippet: 'This is a mock search result for testing purposes.',
          },
          {
            title: 'Mock Search Result 2',
            url: 'https://example.com/2',
            snippet: 'Another mock result with relevant information.',
          },
        ],
        query: args[0]?.query || 'test search',
      };

    case 'Browser':
      return {
        success: true,
        operation: args[0]?.operation || 'navigate',
        result: 'Mock browser operation completed',
        url: args[0]?.url || 'https://example.com',
        screenshot: null,
      };

    case 'TodoWrite':
      return {
        success: true,
        todos: args[0]?.todos || [],
        updated: true,
      };

    default:
      return {
        success: true,
        message: `Mock response for tool: ${tool}`,
        data: null,
      };
  }
}

// ============================================================================
// Specialized Mock Creators
// ============================================================================

/**
 * Create a failing tool mock that throws specific errors
 */
export function createFailingToolMock(
  tool: AgentTool,
  error: Error | string = `Tool ${tool} failed`,
  failAfterCalls = 0
): ToolMock {
  const errorInstance = typeof error === 'string' ? new Error(error) : error;

  return createToolMock({
    tool,
    shouldSucceed: failAfterCalls === 0 ? false : true,
    error: errorInstance,
    failAfterCalls: failAfterCalls > 0 ? failAfterCalls : undefined,
    trackCalls: true,
  });
}

/**
 * Create a slow tool mock that simulates network delays or heavy operations
 */
export function createSlowToolMock(
  tool: AgentTool,
  delay: number = 1000,
  response?: any
): ToolMock {
  return createToolMock({
    tool,
    shouldSucceed: true,
    delay,
    response,
    trackCalls: true,
  });
}

/**
 * Create a mock that succeeds only after several attempts (flaky behavior)
 */
export function createFlakyToolMock(
  tool: AgentTool,
  successAfterAttempts: number = 3,
  error: Error | string = 'Temporary failure'
): ToolMock {
  let attempts = 0;
  const errorInstance = typeof error === 'string' ? new Error(error) : error;

  const mockFn = vi.fn().mockImplementation(async (...args: any[]) => {
    attempts++;

    if (attempts < successAfterAttempts) {
      throw errorInstance;
    }

    return getDefaultResponse(tool, args);
  });

  return {
    mock: mockFn,
    config: { tool, shouldSucceed: true, trackCalls: true },
    calls: [],
    reset: () => {
      mockFn.mockClear();
      attempts = 0;
    },
    getCallHistory: () => [],
  };
}

// ============================================================================
// Permission-Aware Mock Factory
// ============================================================================

/**
 * Create a tool mock that respects permission settings
 */
export function createPermissionAwareToolMock(
  tool: AgentTool,
  permissions: {
    hasPermission: (tool: string, scope?: string) => boolean;
    requestPermission: (tool: string, scope?: string) => Promise<boolean>;
  }
): ToolMock {
  const calls: ToolMock['calls'] = [];

  const mockFn = vi.fn().mockImplementation(async (...args: any[]) => {
    const callInfo = {
      args,
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    try {
      // Check if we have permission for this tool
      const scope = extractScopeFromArgs(tool, args);
      const hasPermission = permissions.hasPermission(tool, scope);

      if (!hasPermission) {
        // Try to request permission
        const granted = await permissions.requestPermission(tool, scope);
        if (!granted) {
          const error = new Error(`Permission denied for tool: ${tool}`);
          error.name = 'PermissionDeniedError';
          callInfo.error = error;
          throw error;
        }
      }

      // Execute the tool
      const result = getDefaultResponse(tool, args);
      callInfo.result = result;
      return result;
    } finally {
      calls.push(callInfo);
    }
  });

  return {
    mock: mockFn,
    config: { tool, shouldSucceed: true, trackCalls: true },
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
    },
    getCallHistory: () => [...calls],
  };
}

/**
 * Extract scope information from tool arguments
 */
function extractScopeFromArgs(tool: AgentTool, args: any[]): string | undefined {
  const firstArg = args[0];
  if (!firstArg || typeof firstArg !== 'object') {
    return undefined;
  }

  switch (tool) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return firstArg.file_path;

    case 'Bash':
      return firstArg.command;

    case 'Glob':
      return firstArg.pattern;

    case 'Grep':
      return firstArg.path;

    case 'WebFetch':
    case 'WebSearch':
      return firstArg.url || firstArg.query;

    case 'Browser':
      return firstArg.url;

    default:
      return undefined;
  }
}