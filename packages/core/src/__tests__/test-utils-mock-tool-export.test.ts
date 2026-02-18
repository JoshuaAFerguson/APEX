/**
 * @fileoverview Test to verify mock tool types are properly exported from main test-utils
 *
 * This test ensures that the mock tool types can be imported from the main
 * test-utils module, confirming the export chain is working correctly.
 */

import { describe, it, expect } from 'vitest';

// Test importing from the main test-utils module
import type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  MockToolExecutor,
} from '../test-utils';

describe('Test Utils Mock Tool Export', () => {
  it('should export MockTool from main test-utils', () => {
    const mockTool: MockTool = {
      name: 'ExportTestTool',
      description: 'Testing export from main test-utils',
      parameters: {
        type: 'object',
        properties: {
          test: { type: 'string' },
        },
        required: ['test'],
      },
      execute: async () => ({
        success: true,
        content: [{ type: 'text', text: 'Export test passed' }],
      }),
    };

    expect(mockTool.name).toBe('ExportTestTool');
  });

  it('should export MockToolResponse from main test-utils', () => {
    const response: MockToolResponse = {
      success: true,
      content: [{ type: 'text', text: 'Export test response' }],
    };

    expect(response.success).toBe(true);
    expect(response.content[0].type).toBe('text');
  });

  it('should export ToolInvocation from main test-utils', () => {
    const invocation: ToolInvocation = {
      id: 'export_test_inv',
      toolName: 'ExportTestTool',
      parameters: { test: 'export' },
      invokedAt: new Date(),
    };

    expect(invocation.toolName).toBe('ExportTestTool');
  });

  it('should export MockToolExecutor from main test-utils', () => {
    class ExportTestExecutor implements MockToolExecutor {
      async execute(): Promise<MockToolResponse> {
        return {
          success: true,
          content: [{ type: 'text', text: 'Executor export test' }],
        };
      }
    }

    const executor = new ExportTestExecutor();
    expect(typeof executor.execute).toBe('function');
  });
});