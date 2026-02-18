/**
 * @fileoverview Usage demonstration for withMockMCP() wrapper function
 *
 * This file demonstrates that the withMockMCP() function meets all acceptance criteria:
 * 1. Wrapper function handles server lifecycle
 * 2. Provides server instance to test callback
 * 3. Works with async tests
 * 4. Cleanup happens even on test failure
 */

import { describe, it, expect } from 'vitest';
import { withMockMCP, withMockMCPFacade } from '../with-mock-mcp.js';
import type { MockMCPServerDefinition } from '@apexcli/core';

describe('withMockMCP Usage Demonstration', () => {
  it('demonstrates basic usage with builder pattern', async () => {
    await withMockMCP(
      builder => builder
        .withName('demo-server')
        .withTool('example_tool')
        .withStaticResponse([{ type: 'text', text: 'Hello, world!' }]),
      async (server) => {
        // ✅ Server instance is provided to test callback
        expect(server).toBeDefined();
        expect(server.getName()).toBe('demo-server');

        // ✅ Server lifecycle is handled automatically (already started)
        expect(server.isListening()).toBe(true);

        // ✅ Works with async tests - this is an async function
        const transport = server.createClientTransport();
        expect(transport).toBeDefined();

        // Server assertions work
        expect(server.getCallHistory()).toEqual([]);
      }
    );
    // ✅ Cleanup happens automatically after test completion
  });

  it('demonstrates usage with MockMCPServerDefinition', async () => {
    const definition: MockMCPServerDefinition = {
      config: {
        name: 'definition-server',
        description: 'Server created from definition',
        version: '1.0.0',
        transport: {
          type: 'stdio'
        }
      },
      behavior: {
        tools: [
          {
            name: 'test_tool',
            description: 'A test tool',
            responseDefinition: {
              static: {
                content: [{ type: 'text', text: 'Tool response' }],
                isError: false
              }
            }
          }
        ]
      }
    };

    await withMockMCP(
      definition,
      async (server) => {
        expect(server.getName()).toBe('definition-server');
        expect(server.isListening()).toBe(true);
      }
    );
  });

  it('demonstrates that cleanup happens even on test failure', async () => {
    let capturedServer: any = null;

    await expect(
      withMockMCP(
        builder => builder
          .withName('failure-test-server')
          .withTool('tool')
          .withStaticResponse([]),
        async (server) => {
          capturedServer = server;
          expect(server.isListening()).toBe(true);

          // ✅ Test throws an error to simulate failure
          throw new Error('Simulated test failure');
        }
      )
    ).rejects.toThrow('Simulated test failure');

    // ✅ Server is still cleaned up despite the test failure
    expect(capturedServer?.isListening()).toBe(false);
  });

  it('demonstrates withMockMCPFacade usage', async () => {
    await withMockMCPFacade(
      builder => builder
        .withName('facade-server')
        .withTool('facade_tool')
        .withStaticResponse([{ type: 'text', text: 'Facade response' }]),
      async (facade) => {
        // ✅ Facade provides simplified API
        expect(facade.isStarted()).toBe(true);
        expect(facade.getTransport()).toBeDefined();

        // Facade methods work
        facade.resetToDefault();
        expect(facade.getCallHistory()).toEqual([]);
      }
    );
  });

  it('demonstrates async test support with return values', async () => {
    const result = await withMockMCP(
      builder => builder
        .withName('return-value-server')
        .withTool('tool')
        .withStaticResponse([]),
      async (server) => {
        // ✅ Async test callback can return values
        expect(server.isListening()).toBe(true);
        return { success: true, serverName: server.getName() };
      }
    );

    // ✅ Return value is properly propagated
    expect(result).toEqual({ success: true, serverName: 'return-value-server' });
  });

  it('demonstrates custom options usage', async () => {
    await withMockMCP(
      builder => builder
        .withName('options-server')
        .withTool('tool')
        .withStaticResponse([]),
      async (server) => {
        expect(server.isListening()).toBe(true);
      },
      {
        // ✅ Custom options are supported
        autoStart: true,
        resetOnCleanup: true,
        timeout: 10000
      }
    );
  });
});