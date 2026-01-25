/**
 * @fileoverview Acceptance Criteria Validation Tests for withMockMCP()
 *
 * This file explicitly validates the acceptance criteria for the withMockMCP()
 * test wrapper function to ensure all requirements are met:
 *
 * 1. ✅ Wrapper function handles server lifecycle
 * 2. ✅ Provides server instance to test callback
 * 3. ✅ Works with async tests
 * 4. ✅ Cleanup happens even on test failure
 */

import { describe, it, expect } from 'vitest';
import { withMockMCP, withMockMCPFacade } from '../with-mock-mcp.js';
import { MockMCPServer } from '../mock-mcp-server.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';

describe('withMockMCP - Acceptance Criteria Validation', () => {
  describe('Requirement 1: Wrapper function handles server lifecycle', () => {
    it('ACCEPTANCE-1.1: should automatically start server when autoStart is true (default)', async () => {
      await withMockMCP(
        builder => builder
          .withName('lifecycle-test-server')
          .withTool('ping')
          .withStaticResponse([{ type: 'text', text: 'pong' }]),
        async (server) => {
          // Server should be automatically started
          expect(server.isListening()).toBe(true);
          expect(server.getName()).toBe('lifecycle-test-server');
        }
        // Using default options (autoStart: true)
      );
    });

    it('ACCEPTANCE-1.2: should NOT automatically start server when autoStart is false', async () => {
      await withMockMCP(
        builder => builder
          .withName('manual-start-server')
          .withTool('ping')
          .withStaticResponse([{ type: 'text', text: 'pong' }]),
        async (server) => {
          // Server should NOT be started automatically
          expect(server.isListening()).toBe(false);

          // Manual start should work
          await server.start();
          expect(server.isListening()).toBe(true);
        },
        { autoStart: false }
      );
    });

    it('ACCEPTANCE-1.3: should automatically stop server after test completion', async () => {
      let capturedServer: MockMCPServer | null = null;

      await withMockMCP(
        builder => builder
          .withName('auto-stop-server')
          .withTool('ping')
          .withStaticResponse([{ type: 'text', text: 'pong' }]),
        async (server) => {
          capturedServer = server;
          expect(server.isListening()).toBe(true);
        }
      );

      // Server should be automatically stopped after test
      expect(capturedServer).not.toBeNull();
      expect(capturedServer!.isListening()).toBe(false);
    });
  });

  describe('Requirement 2: Provides server instance to test callback', () => {
    it('ACCEPTANCE-2.1: should provide MockMCPServer instance to test callback', async () => {
      await withMockMCP(
        builder => builder
          .withName('instance-test-server')
          .withTool('echo')
          .withStaticResponse([{ type: 'text', text: 'hello' }]),
        async (server) => {
          // Verify it's a proper MockMCPServer instance
          expect(server).toBeInstanceOf(MockMCPServer);
          expect(server.getName()).toBe('instance-test-server');
          expect(server.isListening()).toBe(true);

          // Verify server methods are accessible
          expect(typeof server.createClientTransport).toBe('function');
          expect(typeof server.getConnectedClientCount).toBe('function');
          expect(typeof server.setErrorMode).toBe('function');
        }
      );
    });

    it('ACCEPTANCE-2.2: should provide MockMCPServerFacade instance to withMockMCPFacade callback', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('facade-instance-test')
          .withTool('test')
          .withStaticResponse([{ type: 'text', text: 'test response' }]),
        async (facade) => {
          // Verify it's a proper MockMCPServerFacade instance
          expect(facade).toBeInstanceOf(MockMCPServerFacade);
          expect(facade.isListening()).toBe(true);

          // Verify facade methods are accessible
          expect(typeof facade.getTransport).toBe('function');
          expect(typeof facade.setErrorMode).toBe('function');
          expect(typeof facade.assertMethodCalled).toBe('function');
        }
      );
    });

    it('ACCEPTANCE-2.3: should provide usable server transport for client interaction', async () => {
      await withMockMCP(
        builder => builder
          .withName('transport-test-server')
          .withTool('test_tool')
          .withStaticResponse([{ type: 'text', text: 'transport works' }]),
        async (server) => {
          // Verify transport can be created from server
          const transport = server.createClientTransport();
          expect(transport).toBeDefined();
          expect(typeof transport.connect).toBe('function');
          expect(typeof transport.disconnect).toBe('function');
        }
      );
    });
  });

  describe('Requirement 3: Works with async tests', () => {
    it('ACCEPTANCE-3.1: should work with async test callbacks', async () => {
      let executionOrder: string[] = [];

      await withMockMCP(
        builder => builder
          .withName('async-test-server')
          .withTool('async_tool')
          .withStaticResponse([{ type: 'text', text: 'async response' }]),
        async (server) => {
          executionOrder.push('callback-start');

          // Simulate async operations
          await new Promise(resolve => setTimeout(resolve, 50));
          executionOrder.push('async-operation-1');

          await new Promise(resolve => setTimeout(resolve, 25));
          executionOrder.push('async-operation-2');

          expect(server.isListening()).toBe(true);
          executionOrder.push('callback-end');
        }
      );

      // Verify async operations completed in order before cleanup
      expect(executionOrder).toEqual([
        'callback-start',
        'async-operation-1',
        'async-operation-2',
        'callback-end'
      ]);
    });

    it('ACCEPTANCE-3.2: should work with sync test callbacks', async () => {
      let syncCallbackExecuted = false;

      await withMockMCP(
        builder => builder
          .withName('sync-test-server')
          .withTool('sync_tool')
          .withStaticResponse([{ type: 'text', text: 'sync response' }]),
        (server) => {
          // Synchronous callback (no async)
          syncCallbackExecuted = true;
          expect(server.isListening()).toBe(true);
          return 'sync-result';
        }
      );

      expect(syncCallbackExecuted).toBe(true);
    });

    it('ACCEPTANCE-3.3: should handle test callbacks that return values', async () => {
      const asyncResult = await withMockMCP(
        builder => builder
          .withName('return-value-server')
          .withTool('return_tool')
          .withStaticResponse([{ type: 'text', text: 'return test' }]),
        async (server) => {
          expect(server.isListening()).toBe(true);
          return { status: 'success', data: [1, 2, 3] };
        }
      );

      expect(asyncResult).toEqual({ status: 'success', data: [1, 2, 3] });

      const syncResult = await withMockMCP(
        builder => builder
          .withName('sync-return-server')
          .withTool('sync_return_tool')
          .withStaticResponse([{ type: 'text', text: 'sync return' }]),
        (server) => {
          return 'immediate-value';
        }
      );

      expect(syncResult).toBe('immediate-value');
    });
  });

  describe('Requirement 4: Cleanup happens even on test failure', () => {
    it('ACCEPTANCE-4.1: should cleanup server when test callback throws', async () => {
      let capturedServer: MockMCPServer | null = null;

      await expect(
        withMockMCP(
          builder => builder
            .withName('failure-cleanup-server')
            .withTool('fail_tool')
            .withStaticResponse([{ type: 'text', text: 'will fail' }]),
          async (server) => {
            capturedServer = server;
            expect(server.isListening()).toBe(true);

            // Simulate test failure
            throw new Error('Intentional test failure for cleanup validation');
          }
        )
      ).rejects.toThrow('Intentional test failure for cleanup validation');

      // Server should be cleaned up despite test failure
      expect(capturedServer).not.toBeNull();
      expect(capturedServer!.isListening()).toBe(false);
    });

    it('ACCEPTANCE-4.2: should cleanup server when test callback rejects', async () => {
      let capturedServer: MockMCPServer | null = null;

      await expect(
        withMockMCP(
          builder => builder
            .withName('rejection-cleanup-server')
            .withTool('reject_tool')
            .withStaticResponse([{ type: 'text', text: 'will reject' }]),
          async (server) => {
            capturedServer = server;
            expect(server.isListening()).toBe(true);

            // Simulate async rejection
            await new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Async rejection')), 10);
            });
          }
        )
      ).rejects.toThrow('Async rejection');

      // Server should be cleaned up despite async rejection
      expect(capturedServer).not.toBeNull();
      expect(capturedServer!.isListening()).toBe(false);
    });

    it('ACCEPTANCE-4.3: should cleanup facade when test fails', async () => {
      let capturedFacade: MockMCPServerFacade | null = null;

      await expect(
        withMockMCPFacade(
          builder => builder
            .withName('facade-failure-cleanup')
            .withTool('facade_fail_tool')
            .withStaticResponse([{ type: 'text', text: 'facade will fail' }]),
          async (facade) => {
            capturedFacade = facade;
            expect(facade.isListening()).toBe(true);

            throw new Error('Facade test failure for cleanup validation');
          }
        )
      ).rejects.toThrow('Facade test failure for cleanup validation');

      // Facade should be cleaned up despite test failure
      expect(capturedFacade).not.toBeNull();
      expect(capturedFacade!.isListening()).toBe(false);
    });

    it('ACCEPTANCE-4.4: should reset server state on cleanup by default', async () => {
      let capturedServer: MockMCPServer | null = null;

      await withMockMCP(
        builder => builder
          .withName('state-reset-server')
          .withTool('state_tool')
          .withStaticResponse([{ type: 'text', text: 'state test' }]),
        async (server) => {
          capturedServer = server;

          // Set error mode to verify it gets reset
          server.setErrorMode({
            mode: 'always_fail',
            category: 'jsonrpc',
            affectedClients: 'all'
          });

          // Set malformed response mode
          server.setMalformedResponseMode({
            enabled: true,
            malformationType: 'invalid_json',
            affectedMethods: ['tools/call'],
            triggerCondition: 'always'
          });

          expect(server.getErrorMode()).toBeDefined();
          expect(server.getMalformedResponseMode()?.enabled).toBe(true);
        }
      );

      // State should be reset during cleanup
      expect(capturedServer!.getErrorMode()).toBeUndefined();
      expect(capturedServer!.getMalformedResponseMode()?.enabled).toBe(false);
    });

    it('ACCEPTANCE-4.5: should preserve server state when resetOnCleanup is false', async () => {
      let capturedServer: MockMCPServer | null = null;

      await withMockMCP(
        builder => builder
          .withName('state-preserve-server')
          .withTool('preserve_tool')
          .withStaticResponse([{ type: 'text', text: 'preserve test' }]),
        async (server) => {
          capturedServer = server;

          // Set error mode to verify it gets preserved
          server.setErrorMode({
            mode: 'always_fail',
            category: 'jsonrpc',
            affectedClients: 'all'
          });

          expect(server.getErrorMode()).toBeDefined();
        },
        { resetOnCleanup: false }
      );

      // State should be preserved (though server is stopped)
      expect(capturedServer!.getErrorMode()).toBeDefined();
    });
  });

  describe('Integration Validation: All Requirements Together', () => {
    it('ACCEPTANCE-INTEGRATION: should demonstrate all requirements working together', async () => {
      const testResults: string[] = [];
      let serverInstance: MockMCPServer | null = null;

      // Test with intentional failure to validate cleanup
      await expect(
        withMockMCP(
          builder => builder
            .withName('integration-validation-server')
            .withDescription('Full acceptance criteria validation')
            .withTool('validation_tool')
              .withStaticResponse([{ type: 'text', text: 'validation response' }])
            .withTool('async_validation_tool')
              .withDynamicHandler(async (toolName, args) => {
                testResults.push('async-handler-executed');
                await new Promise(resolve => setTimeout(resolve, 25));
                return {
                  content: [{ type: 'text', text: `Async result for ${JSON.stringify(args)}` }],
                  isError: false
                };
              }),
          async (server) => {
            // Requirement 1: Server lifecycle - server should be running
            expect(server.isListening()).toBe(true);
            testResults.push('server-running');

            // Requirement 2: Server instance provided - verify instance methods
            serverInstance = server;
            expect(server.getName()).toBe('integration-validation-server');
            const transport = server.createClientTransport();
            expect(transport).toBeDefined();
            testResults.push('server-instance-verified');

            // Requirement 3: Async operations work
            await new Promise(resolve => setTimeout(resolve, 30));
            testResults.push('async-operation-completed');

            // Set some state to verify cleanup behavior
            server.setErrorMode({ mode: 'always_fail', category: 'mcp', affectedClients: 'all' });
            testResults.push('error-mode-set');

            // Requirement 4: Intentional failure to test cleanup
            throw new Error('Integration test failure for cleanup validation');
          }
        )
      ).rejects.toThrow('Integration test failure for cleanup validation');

      // Verify all requirements were met:
      expect(testResults).toContain('server-running');          // Requirement 1: Lifecycle
      expect(testResults).toContain('server-instance-verified'); // Requirement 2: Instance provided
      expect(testResults).toContain('async-operation-completed'); // Requirement 3: Async support
      expect(testResults).toContain('error-mode-set');          // State was set

      // Requirement 4: Cleanup happened despite failure
      expect(serverInstance).not.toBeNull();
      expect(serverInstance!.isListening()).toBe(false);       // Server stopped
      expect(serverInstance!.getErrorMode()).toBeUndefined();  // State reset
    });
  });
});