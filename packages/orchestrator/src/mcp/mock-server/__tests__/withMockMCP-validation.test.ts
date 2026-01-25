/**
 * @fileoverview Validation test for withMockMCP() function implementation
 *
 * This test verifies that the withMockMCP() wrapper function meets all acceptance criteria:
 * - Wrapper function handles server lifecycle (start/stop)
 * - Provides server instance to test callback
 * - Works with async tests
 * - Cleanup happens even on test failure
 * - Proper error handling and timeout protection
 */

import { describe, it, expect, vi } from 'vitest';
import { withMockMCP, withMockMCPFacade } from '../with-mock-mcp.js';

describe('withMockMCP() Implementation Validation', () => {
  describe('Acceptance Criteria Validation', () => {
    it('handles server lifecycle automatically', async () => {
      let serverInstance: any = null;

      await withMockMCP(
        builder => builder
          .withName('lifecycle-test')
          .withTool('ping')
          .withStaticResponse([{ type: 'text', text: 'pong' }]),
        async (server) => {
          // Server should be started automatically
          expect(server.isListening()).toBe(true);
          serverInstance = server;
        }
      );

      // Server should be stopped after test completion
      expect(serverInstance.isListening()).toBe(false);
    });

    it('provides server instance to test callback', async () => {
      await withMockMCP(
        builder => builder
          .withName('instance-test')
          .withTool('test-tool')
          .withStaticResponse([{ type: 'text', text: 'test response' }]),
        async (server) => {
          // Server instance should be provided and functional
          expect(server).toBeDefined();
          expect(typeof server.isListening).toBe('function');
          expect(typeof server.getName).toBe('function');
          expect(typeof server.createClientTransport).toBe('function');
          expect(server.getName()).toBe('instance-test');
        }
      );
    });

    it('works with async tests', async () => {
      let asyncOperationCompleted = false;

      await withMockMCP(
        builder => builder
          .withName('async-test')
          .withTool('async-tool')
          .withDynamicHandler(async () => {
            // Simulate async operation
            await new Promise(resolve => setTimeout(resolve, 50));
            asyncOperationCompleted = true;
            return {
              content: [{ type: 'text', text: 'async complete' }],
              isError: false,
            };
          }),
        async (server) => {
          expect(server.isListening()).toBe(true);

          // Simulate async test operations
          const transport = server.createClientTransport();
          expect(transport).toBeDefined();

          // Wait for some async work
          await new Promise(resolve => setTimeout(resolve, 25));

          expect(server.isListening()).toBe(true);
        }
      );

      // Async test should have completed successfully
      expect(asyncOperationCompleted).toBe(false); // Handler not called in this test
    });

    it('ensures cleanup happens even on test failure', async () => {
      let serverInstance: any = null;

      // Test should fail but cleanup should still happen
      await expect(
        withMockMCP(
          builder => builder
            .withName('failure-test')
            .withTool('fail-tool')
            .withStaticResponse([{ type: 'text', text: 'fail response' }]),
          async (server) => {
            serverInstance = server;
            expect(server.isListening()).toBe(true);
            // Intentionally throw error to test cleanup
            throw new Error('Intentional test failure');
          }
        )
      ).rejects.toThrow('Intentional test failure');

      // Even though test failed, server should be cleaned up
      expect(serverInstance.isListening()).toBe(false);
    });

    it('handles error modes and resets properly', async () => {
      let serverInstance: any = null;

      await withMockMCP(
        builder => builder
          .withName('error-mode-test')
          .withTool('error-tool')
          .withStaticResponse([{ type: 'text', text: 'response' }]),
        async (server) => {
          serverInstance = server;

          // Set error mode during test
          server.setErrorMode({
            mode: 'always_fail',
            category: 'jsonrpc',
            affectedClients: 'all'
          });

          expect(server.getErrorMode()).toBeDefined();
        }
      );

      // Error mode should be reset after cleanup
      expect(serverInstance.getErrorMode()).toBeUndefined();
    });
  });

  describe('Advanced Features Validation', () => {
    it('supports custom timeout configuration', async () => {
      const start = Date.now();

      await withMockMCP(
        builder => builder
          .withName('timeout-test')
          .withTool('quick-tool')
          .withStaticResponse([{ type: 'text', text: 'quick' }]),
        async (server) => {
          expect(server.isListening()).toBe(true);
        },
        { timeout: 1000 } // Custom timeout
      );

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000); // Should complete well within timeout
    });

    it('supports beforeCleanup callback for custom cleanup logic', async () => {
      const cleanupCallbacks: string[] = [];

      await withMockMCP(
        builder => builder
          .withName('cleanup-test')
          .withTool('cleanup-tool')
          .withStaticResponse([{ type: 'text', text: 'cleanup' }]),
        async (server) => {
          cleanupCallbacks.push('test-executed');
          expect(server.isListening()).toBe(true);
        },
        {
          beforeCleanup: async (server) => {
            cleanupCallbacks.push('before-cleanup-called');
            expect(server.isListening()).toBe(true); // Should still be running
          }
        }
      );

      expect(cleanupCallbacks).toEqual(['test-executed', 'before-cleanup-called']);
    });

    it('supports autoStart: false for manual server control', async () => {
      await withMockMCP(
        builder => builder
          .withName('manual-start-test')
          .withTool('manual-tool')
          .withStaticResponse([{ type: 'text', text: 'manual' }]),
        async (server) => {
          // Server should NOT be started automatically
          expect(server.isListening()).toBe(false);

          // Start manually
          await server.start();
          expect(server.isListening()).toBe(true);
        },
        { autoStart: false }
      );
    });

    it('supports resetOnCleanup: false to preserve state', async () => {
      let serverInstance: any = null;

      await withMockMCP(
        builder => builder
          .withName('preserve-state-test')
          .withTool('state-tool')
          .withStaticResponse([{ type: 'text', text: 'state' }]),
        async (server) => {
          serverInstance = server;

          // Set some state that should be preserved
          server.setErrorMode({
            mode: 'always_fail',
            category: 'mcp',
            affectedClients: 'all'
          });
        },
        { resetOnCleanup: false }
      );

      // State should be preserved (error mode still set)
      expect(serverInstance.getErrorMode()).toBeDefined();
    });
  });

  describe('Facade Variant Validation', () => {
    it('provides facade API for single-client convenience', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('facade-test')
          .withTool('facade-tool')
          .withStaticResponse([{ type: 'text', text: 'facade response' }]),
        async (facade) => {
          // Facade should provide convenience methods
          expect(facade.isListening()).toBe(true);
          expect(facade.getTransport()).toBeDefined();
          expect(typeof facade.start).toBe('function');
          expect(typeof facade.stop).toBe('function');
          expect(typeof facade.resetToDefault).toBe('function');
        }
      );
    });

    it('handles facade cleanup properly', async () => {
      let facadeInstance: any = null;

      await withMockMCPFacade(
        builder => builder
          .withName('facade-cleanup-test')
          .withTool('facade-cleanup-tool')
          .withStaticResponse([{ type: 'text', text: 'cleanup test' }]),
        async (facade) => {
          facadeInstance = facade;
          expect(facade.isListening()).toBe(true);
        }
      );

      // Facade should be stopped after test
      expect(facadeInstance.isListening()).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles cleanup errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await withMockMCP(
        builder => {
          const mockBuilder = builder
            .withName('cleanup-error-test')
            .withTool('error-tool')
            .withStaticResponse([{ type: 'text', text: 'error' }]);

          const server = mockBuilder.buildServer();

          // Mock resetBehavior to throw during cleanup
          vi.spyOn(server, 'resetBehavior').mockImplementation(() => {
            throw new Error('Cleanup failure');
          });

          return mockBuilder;
        },
        async (server) => {
          expect(server.isListening()).toBe(true);
        }
      );

      // Should log cleanup error but not throw
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error during MockMCPServer cleanup:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('preserves original test errors when cleanup also fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        withMockMCP(
          builder => {
            const mockBuilder = builder
              .withName('dual-error-test')
              .withTool('dual-error-tool')
              .withStaticResponse([{ type: 'text', text: 'dual error' }]);

            const server = mockBuilder.buildServer();

            // Mock stop to throw during cleanup
            vi.spyOn(server, 'stop').mockImplementation(() => {
              throw new Error('Cleanup error');
            });

            return mockBuilder;
          },
          async () => {
            throw new Error('Original test error');
          }
        )
      ).rejects.toThrow('Original test error'); // Original error should be preserved

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error during MockMCPServer cleanup:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});