/**
 * @fileoverview Mock MCP Server Usage Examples
 *
 * Demonstrates how to use mock MCP servers for testing MCP client interactions.
 *
 * @module orchestrator/mcp/mock-server/usage-examples
 */

import type {
  MockMCPServerDefinition,
  MockToolHandler,
} from '@apexcli/core';
import {
  MockMCPServerFacade,
  createSimpleMockServer,
  createErrorMockServer,
  createSlowMockServer,
} from './mock-server-facade.js';

// ============================================================================
// Basic Examples
// ============================================================================

/**
 * Create a simple mock server with file system tools
 */
export function createFileSystemMockServer(): MockMCPServerFacade {
  const toolHandlers: MockToolHandler[] = [
    {
      toolName: 'read_file',
      response: {
        content: [
          {
            type: 'text',
            text: 'Mock file content',
          },
        ],
        isError: false,
      },
    },
    {
      toolName: 'write_file',
      response: {
        content: [
          {
            type: 'text',
            text: 'File written successfully',
          },
        ],
        isError: false,
      },
    },
  ];

  return createSimpleMockServer('filesystem-server', toolHandlers);
}

/**
 * Create a mock server with conditional responses
 */
export function createConditionalMockServer(): MockMCPServerFacade {
  const definition: MockMCPServerDefinition = {
    serverConfig: {
      name: 'conditional-server',
      transport: 'stdio',
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
      },
      serverInfo: {
        name: 'Conditional Mock Server',
        version: '1.0.0',
      },
      autoStart: true,
      maxConnections: 10,
      shutdownTimeoutMs: 5000,
    },
    defaultBehavior: {
      toolHandlers: [
        {
          toolName: 'read_file',
          matchArgs: { path: '/existing/file.txt' },
          response: {
            content: [{ type: 'text', text: 'File exists' }],
            isError: false,
          },
        },
        {
          toolName: 'read_file',
          response: {
            content: [{ type: 'text', text: 'File not found' }],
            isError: true,
          },
        },
      ],
      recordRequests: true,
      maxRecordedRequests: 1000,
      validateRequests: true,
      enableDebugLogging: false,
      notificationTriggers: [],
      expectations: [],
    },
    scenarios: [],
  };

  return new MockMCPServerFacade(definition);
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a quick test setup
 */
export async function createQuickTestSetup(
  toolHandlers: MockToolHandler[] = []
): Promise<{
  server: MockMCPServerFacade;
  cleanup: () => Promise<void>;
}> {
  const server = createSimpleMockServer('test-server', toolHandlers);
  await server.start();

  return {
    server,
    cleanup: async () => {
      await server.stop();
    },
  };
}