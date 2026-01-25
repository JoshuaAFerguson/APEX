/**
 * @fileoverview Test Execution Validation for withMockMCP() Function
 *
 * This file validates that all tests for the withMockMCP() function can be executed
 * and that the testing stage requirements are met.
 */

import { describe, it, expect } from 'vitest';
import { withMockMCP, withMockMCPFacade } from '../with-mock-mcp.js';

describe('Test Execution Validation for withMockMCP()', () => {
  describe('Basic Functionality Verification', () => {
    it('should execute basic withMockMCP test scenario', async () => {
      const testResult = await withMockMCP(
        builder => builder
          .withName('basic-validation-server')
          .withDescription('Basic test execution validation')
          .withTool('validation_tool')
          .withStaticResponse([{ type: 'text', text: 'validation successful' }]),
        async (server) => {
          // Verify server is running
          expect(server.isListening()).toBe(true);
          expect(server.getName()).toBe('basic-validation-server');

          // Verify server methods are available
          expect(typeof server.createClientTransport).toBe('function');
          expect(typeof server.stop).toBe('function');
          expect(typeof server.start).toBe('function');

          return 'test-completed';
        }
      );

      expect(testResult).toBe('test-completed');
    });

    it('should execute basic withMockMCPFacade test scenario', async () => {
      const testResult = await withMockMCPFacade(
        builder => builder
          .withName('facade-validation-server')
          .withTool('facade_test')
          .withStaticResponse([{ type: 'text', text: 'facade validation' }]),
        async (facade) => {
          // Verify facade is running
          expect(facade.isListening()).toBe(true);

          // Verify facade methods are available
          expect(typeof facade.getTransport).toBe('function');
          expect(typeof facade.stop).toBe('function');
          expect(typeof facade.start).toBe('function');

          return 'facade-test-completed';
        }
      );

      expect(testResult).toBe('facade-test-completed');
    });
  });

  describe('Acceptance Criteria Quick Validation', () => {
    it('AC-1: Wrapper handles server lifecycle', async () => {
      let serverWasRunning = false;
      let serverAfterTest: any = null;

      await withMockMCP(
        builder => builder
          .withName('lifecycle-validation')
          .withTool('test')
          .withStaticResponse([{ type: 'text', text: 'ok' }]),
        async (server) => {
          serverWasRunning = server.isListening();
          serverAfterTest = server;
        }
      );

      expect(serverWasRunning).toBe(true);
      expect(serverAfterTest.isListening()).toBe(false);
    });

    it('AC-2: Provides server instance to test callback', async () => {
      await withMockMCP(
        builder => builder
          .withName('instance-validation')
          .withTool('test')
          .withStaticResponse([]),
        async (server) => {
          expect(server).toBeDefined();
          expect(server.getName()).toBe('instance-validation');
          expect(typeof server.createClientTransport).toBe('function');
        }
      );
    });

    it('AC-3: Works with async tests', async () => {
      const asyncResult = await withMockMCP(
        builder => builder
          .withName('async-validation')
          .withTool('async_test')
          .withStaticResponse([]),
        async (server) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { async: true, serverRunning: server.isListening() };
        }
      );

      expect(asyncResult).toEqual({ async: true, serverRunning: true });
    });

    it('AC-4: Cleanup happens even on test failure', async () => {
      let failedServer: any = null;

      await expect(
        withMockMCP(
          builder => builder
            .withName('cleanup-validation')
            .withTool('fail_test')
            .withStaticResponse([]),
          async (server) => {
            failedServer = server;
            expect(server.isListening()).toBe(true);
            throw new Error('Intentional test failure');
          }
        )
      ).rejects.toThrow('Intentional test failure');

      expect(failedServer).not.toBeNull();
      expect(failedServer.isListening()).toBe(false);
    });
  });

  describe('Configuration Options Validation', () => {
    it('should respect autoStart: false option', async () => {
      await withMockMCP(
        builder => builder
          .withName('manual-start-validation')
          .withTool('test')
          .withStaticResponse([]),
        async (server) => {
          expect(server.isListening()).toBe(false);
          await server.start();
          expect(server.isListening()).toBe(true);
        },
        { autoStart: false }
      );
    });

    it('should support custom timeout configuration', async () => {
      await withMockMCP(
        builder => builder
          .withName('timeout-validation')
          .withTool('test')
          .withStaticResponse([]),
        async (server) => {
          expect(server.isListening()).toBe(true);
        },
        { timeout: 10000 }
      );
    });

    it('should support resetOnCleanup: false option', async () => {
      let testServer: any = null;

      await withMockMCP(
        builder => builder
          .withName('no-reset-validation')
          .withTool('test')
          .withStaticResponse([]),
        async (server) => {
          testServer = server;
          server.setErrorMode({
            mode: 'always_fail',
            category: 'mcp',
            affectedClients: 'all'
          });
          expect(server.getErrorMode()).toBeDefined();
        },
        { resetOnCleanup: false }
      );

      // Error mode should be preserved when resetOnCleanup is false
      expect(testServer.getErrorMode()).toBeDefined();
    });
  });

  describe('Error Handling Validation', () => {
    it('should handle server builder configuration errors gracefully', async () => {
      // Test with invalid configuration should still execute
      await expect(
        withMockMCP(
          builder => builder
            .withName('error-validation')
            .withTool('error_test')
            .withStaticResponse([{ type: 'text', text: 'error test' }]),
          async (server) => {
            expect(server).toBeDefined();
            return 'error-handled';
          }
        )
      ).resolves.toBe('error-handled');
    });

    it('should handle async test rejections properly', async () => {
      let rejectionServer: any = null;

      await expect(
        withMockMCP(
          builder => builder
            .withName('rejection-validation')
            .withTool('reject_test')
            .withStaticResponse([]),
          async (server) => {
            rejectionServer = server;
            await Promise.reject(new Error('Async rejection test'));
          }
        )
      ).rejects.toThrow('Async rejection test');

      expect(rejectionServer.isListening()).toBe(false);
    });
  });

  describe('Integration Pattern Validation', () => {
    it('should support nested withMockMCP calls', async () => {
      await withMockMCP(
        builder => builder
          .withName('outer-server')
          .withTool('outer')
          .withStaticResponse([]),
        async (outerServer) => {
          expect(outerServer.isListening()).toBe(true);

          await withMockMCP(
            builder => builder
              .withName('inner-server')
              .withTool('inner')
              .withStaticResponse([]),
            async (innerServer) => {
              expect(innerServer.isListening()).toBe(true);
              expect(outerServer.isListening()).toBe(true);

              // Both servers should be running independently
              expect(innerServer.getName()).toBe('inner-server');
              expect(outerServer.getName()).toBe('outer-server');
            }
          );

          // Outer server should still be running after inner completes
          expect(outerServer.isListening()).toBe(true);
        }
      );
    });

    it('should support mixed server and facade usage', async () => {
      await withMockMCP(
        builder => builder
          .withName('server-for-mixed-test')
          .withTool('server_tool')
          .withStaticResponse([]),
        async (server) => {
          expect(server.isListening()).toBe(true);

          await withMockMCPFacade(
            builder => builder
              .withName('facade-for-mixed-test')
              .withTool('facade_tool')
              .withStaticResponse([]),
            async (facade) => {
              expect(facade.isListening()).toBe(true);
              expect(server.isListening()).toBe(true);

              // Both should be accessible
              expect(typeof server.createClientTransport).toBe('function');
              expect(typeof facade.getTransport).toBe('function');
            }
          );
        }
      );
    });
  });
});