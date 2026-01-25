/**
 * @fileoverview Edge Case Tests for withMockMCP() Test Wrapper Functions
 *
 * Advanced test scenarios covering edge cases, stress testing, and complex
 * error scenarios not covered in the main test suite. These tests ensure
 * the wrapper functions handle unusual conditions gracefully.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withMockMCP, withMockMCPFacade } from '../with-mock-mcp.js';
import { MockMCPServer } from '../mock-mcp-server.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';
import type { MockMCPServerDefinition } from '@apexcli/core';

describe('withMockMCP - Edge Cases and Stress Tests', () => {
  let originalConsoleError: typeof console.error;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalConsoleError = console.error;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('memory and resource management', () => {
    it('should handle multiple sequential server creations without memory leaks', async () => {
      const servers: MockMCPServer[] = [];

      // Create and cleanup multiple servers sequentially
      for (let i = 0; i < 10; i++) {
        await withMockMCP(
          builder => builder.withName(`server-${i}`).withTool('test').withStaticResponse([]),
          async (server) => {
            servers.push(server);
            expect(server.isListening()).toBe(true);
            expect(server.getName()).toBe(`server-${i}`);
          }
        );
      }

      // Verify all servers were properly cleaned up
      for (const server of servers) {
        expect(server.isListening()).toBe(false);
      }
    });

    it('should handle rapid server creation and destruction', async () => {
      const promises = [];

      // Create multiple servers concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          withMockMCP(
            builder => builder.withName(`concurrent-${i}`).withTool('test').withStaticResponse([]),
            async (server) => {
              expect(server.isListening()).toBe(true);
              // Simulate some work
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          )
        );
      }

      await Promise.all(promises);
    });

    it('should handle large server definitions without performance issues', async () => {
      await withMockMCP(
        builder => {
          let config = builder.withName('large-server');

          // Add many tools to test performance
          for (let i = 0; i < 50; i++) {
            config = config
              .withTool(`tool_${i}`)
              .withStaticResponse([{ type: 'text', text: `Response ${i}` }]);
          }

          return config;
        },
        async (server) => {
          expect(server.isListening()).toBe(true);
          expect(server.getName()).toBe('large-server');
        }
      );
    });
  });

  describe('extreme timeout scenarios', () => {
    it('should handle extremely short timeout values gracefully', async () => {
      await expect(
        withMockMCP(
          builder => {
            const mockBuilder = builder.withName('test-server').withTool('x').withStaticResponse([]);
            const mockServer = mockBuilder.buildServer();
            // Mock start to take longer than timeout
            vi.spyOn(mockServer, 'start').mockImplementation(
              () => new Promise(resolve => setTimeout(resolve, 10))
            );
            return mockBuilder;
          },
          async () => {},
          { timeout: 1 } // Extremely short timeout
        )
      ).rejects.toThrow('Server start timed out');
    });

    it('should handle zero timeout by rejecting immediately', async () => {
      await expect(
        withMockMCP(
          builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
          async () => {},
          { timeout: 0 }
        )
      ).rejects.toThrow('Server start timed out');
    });

    it('should handle negative timeout values', async () => {
      await expect(
        withMockMCP(
          builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
          async () => {},
          { timeout: -100 }
        )
      ).rejects.toThrow('Server start timed out');
    });
  });

  describe('complex error scenarios', () => {
    it('should handle server start failing after cleanup begins', async () => {
      let serverRef: MockMCPServer | null = null;

      await withMockMCP(
        builder => {
          const mockBuilder = builder.withName('test-server').withTool('x').withStaticResponse([]);
          const mockServer = mockBuilder.buildServer();
          serverRef = mockServer;

          // Mock start to fail after a delay
          vi.spyOn(mockServer, 'start').mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            throw new Error('Server start failed');
          });

          return mockBuilder;
        },
        async () => {
          // This won't execute because start fails
        },
        { autoStart: true }
      ).catch(() => {
        // Expected to fail
      });

      // Server should not be listening since start failed
      expect(serverRef?.isListening()).toBe(false);
    });

    it('should handle multiple cleanup errors gracefully', async () => {
      await withMockMCP(
        builder => {
          const mockBuilder = builder.withName('test-server').withTool('x').withStaticResponse([]);
          const mockServer = mockBuilder.buildServer();

          // Mock multiple cleanup methods to throw
          vi.spyOn(mockServer, 'resetBehavior').mockImplementation(() => {
            throw new Error('Reset behavior error');
          });
          vi.spyOn(mockServer, 'resetToDefault').mockImplementation(() => {
            throw new Error('Reset to default error');
          });
          vi.spyOn(mockServer, 'clearErrorMode').mockImplementation(() => {
            throw new Error('Clear error mode error');
          });
          vi.spyOn(mockServer, 'stop').mockImplementation(() => {
            throw new Error('Stop error');
          });

          return mockBuilder;
        },
        async () => {}
      );

      // Should have logged cleanup error without crashing
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during MockMCPServer cleanup:',
        expect.any(Error)
      );
    });

    it('should handle beforeCleanup callback throwing errors', async () => {
      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async () => {},
        {
          beforeCleanup: async () => {
            throw new Error('beforeCleanup error');
          }
        }
      );

      // Should have logged cleanup error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during MockMCPServer cleanup:',
        expect.any(Error)
      );
    });
  });

  describe('configuration edge cases', () => {
    it('should handle undefined options gracefully', async () => {
      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          expect(server.isListening()).toBe(true);
        },
        undefined as any // Test undefined options
      );
    });

    it('should handle partial options correctly', async () => {
      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          expect(server.isListening()).toBe(false); // autoStart: false
        },
        { autoStart: false } // Only one option provided
      );
    });

    it('should handle options with invalid types gracefully', async () => {
      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          expect(server.isListening()).toBe(true);
        },
        {
          autoStart: 'yes' as any, // Invalid type, should default to true
          timeout: 'fast' as any,  // Invalid type, should default to 5000
          resetOnCleanup: 1 as any // Invalid type, should default to true
        }
      );
    });
  });

  describe('test callback edge cases', () => {
    it('should handle test callback that returns undefined', async () => {
      const result = await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        () => undefined
      );

      expect(result).toBeUndefined();
    });

    it('should handle test callback that returns null', async () => {
      const result = await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        () => null
      );

      expect(result).toBeNull();
    });

    it('should handle test callback that returns complex objects', async () => {
      const complexObject = {
        data: [1, 2, 3],
        metadata: { test: true },
        nested: { deep: { value: 'test' } }
      };

      const result = await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        () => complexObject
      );

      expect(result).toEqual(complexObject);
    });

    it('should handle async test callback that rejects', async () => {
      await expect(
        withMockMCP(
          builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
          async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            throw new Error('Async test error');
          }
        )
      ).rejects.toThrow('Async test error');
    });
  });

  describe('builder configuration edge cases', () => {
    it('should handle builder that returns invalid configuration', async () => {
      // This tests the type safety - in a real scenario, TypeScript would catch this
      // but we test runtime behavior
      await expect(
        withMockMCP(
          () => null as any, // Invalid builder function
          async () => {}
        )
      ).rejects.toThrow();
    });

    it('should handle builder that throws during configuration', async () => {
      await expect(
        withMockMCP(
          () => {
            throw new Error('Builder configuration error');
          },
          async () => {}
        )
      ).rejects.toThrow('Builder configuration error');
    });
  });

  describe('concurrent usage patterns', () => {
    it('should handle nested withMockMCP calls', async () => {
      await withMockMCP(
        builder => builder.withName('outer-server').withTool('x').withStaticResponse([]),
        async (outerServer) => {
          expect(outerServer.isListening()).toBe(true);

          await withMockMCP(
            builder => builder.withName('inner-server').withTool('y').withStaticResponse([]),
            async (innerServer) => {
              expect(innerServer.isListening()).toBe(true);
              expect(outerServer.isListening()).toBe(true);

              // Both servers should be independent
              expect(innerServer.getName()).toBe('inner-server');
              expect(outerServer.getName()).toBe('outer-server');
            }
          );

          // Outer server should still be running after inner cleanup
          expect(outerServer.isListening()).toBe(true);
        }
      );
    });

    it('should handle multiple withMockMCP calls with same server name', async () => {
      const results: string[] = [];

      await Promise.all([
        withMockMCP(
          builder => builder.withName('shared-name').withTool('x').withStaticResponse([]),
          async (server) => {
            results.push(`Server 1: ${server.getName()}`);
          }
        ),
        withMockMCP(
          builder => builder.withName('shared-name').withTool('y').withStaticResponse([]),
          async (server) => {
            results.push(`Server 2: ${server.getName()}`);
          }
        )
      ]);

      expect(results).toHaveLength(2);
      expect(results).toContain('Server 1: shared-name');
      expect(results).toContain('Server 2: shared-name');
    });
  });
});

describe('withMockMCPFacade - Edge Cases', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('facade-specific error scenarios', () => {
    it('should handle facade timeout errors during start', async () => {
      await expect(
        withMockMCPFacade(
          builder => {
            const mockBuilder = builder.withName('facade-server').withTool('x').withStaticResponse([]);
            const mockFacade = mockBuilder.build();
            // Mock start to hang
            vi.spyOn(mockFacade, 'start').mockImplementation(() => new Promise(() => {}));
            return mockBuilder;
          },
          async () => {},
          { timeout: 100 }
        )
      ).rejects.toThrow('Server start timed out');
    });

    it('should handle facade cleanup with multiple error modes', async () => {
      await withMockMCPFacade(
        builder => {
          const mockBuilder = builder.withName('facade-server').withTool('x').withStaticResponse([]);
          const mockFacade = mockBuilder.build();

          // Mock multiple cleanup operations to fail
          vi.spyOn(mockFacade, 'resetToDefault').mockImplementation(() => {
            throw new Error('Reset default error');
          });
          vi.spyOn(mockFacade, 'clearErrorMode').mockImplementation(() => {
            throw new Error('Clear error mode error');
          });
          vi.spyOn(mockFacade, 'stop').mockImplementation(() => {
            throw new Error('Stop error');
          });

          return mockBuilder;
        },
        async () => {}
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during MockMCPServerFacade cleanup:',
        expect.any(Error)
      );
    });
  });

  describe('facade resource management', () => {
    it('should handle multiple facade instances concurrently', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          withMockMCPFacade(
            builder => builder.withName(`facade-${i}`).withTool('test').withStaticResponse([]),
            async (facade) => {
              expect(facade.isListening()).toBe(true);
              const transport = facade.getTransport();
              expect(transport).toBeDefined();
            }
          )
        );
      }

      await Promise.all(promises);
    });

    it('should handle facade with complex configuration', async () => {
      await withMockMCPFacade(
        builder => {
          let config = builder.withName('complex-facade');

          // Add multiple tools and behaviors
          for (let i = 0; i < 10; i++) {
            config = config
              .withTool(`facade_tool_${i}`)
              .withStaticResponse([{ type: 'text', text: `Facade response ${i}` }]);
          }

          return config.withDelay(10, 50);
        },
        async (facade) => {
          expect(facade.isListening()).toBe(true);
          const transport = facade.getTransport();
          expect(transport).toBeDefined();
        }
      );
    });
  });
});

describe('Mixed Usage Patterns', () => {
  it('should handle alternating withMockMCP and withMockMCPFacade calls', async () => {
    await withMockMCP(
      builder => builder.withName('server-1').withTool('x').withStaticResponse([]),
      async (server) => {
        expect(server.isListening()).toBe(true);

        await withMockMCPFacade(
          builder => builder.withName('facade-1').withTool('y').withStaticResponse([]),
          async (facade) => {
            expect(facade.isListening()).toBe(true);
            expect(server.isListening()).toBe(true);

            await withMockMCP(
              builder => builder.withName('server-2').withTool('z').withStaticResponse([]),
              async (innerServer) => {
                expect(innerServer.isListening()).toBe(true);
                expect(facade.isListening()).toBe(true);
                expect(server.isListening()).toBe(true);
              }
            );

            expect(facade.isListening()).toBe(true);
            expect(server.isListening()).toBe(true);
          }
        );

        expect(server.isListening()).toBe(true);
      }
    );
  });

  it('should handle server definition vs builder configuration mixed usage', async () => {
    const serverDefinition: MockMCPServerDefinition = {
      serverConfig: {
        name: 'definition-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: { name: 'definition-server', version: '1.0.0' },
        maxConnections: 10,
        shutdownTimeoutMs: 5000,
      },
      defaultBehavior: {
        toolHandlers: [
          { toolName: 'def-tool', response: { content: [], isError: false } },
        ],
        notificationTriggers: [],
      },
      scenarios: [],
    };

    await withMockMCP(serverDefinition, async (defServer) => {
      expect(defServer.getName()).toBe('definition-server');

      await withMockMCPFacade(
        builder => builder.withName('builder-facade').withTool('builder-tool').withStaticResponse([]),
        async (facade) => {
          expect(facade.isListening()).toBe(true);
          expect(defServer.isListening()).toBe(true);
        }
      );
    });
  });
});

describe('Performance and Stability', () => {
  it('should handle rapid sequential start/stop cycles', async () => {
    for (let i = 0; i < 20; i++) {
      await withMockMCP(
        builder => builder.withName(`cycle-${i}`).withTool('test').withStaticResponse([]),
        async (server) => {
          expect(server.isListening()).toBe(true);

          // Stop and restart within the test
          await server.stop();
          expect(server.isListening()).toBe(false);

          await server.start();
          expect(server.isListening()).toBe(true);
        },
        { resetOnCleanup: true }
      );
    }
  });

  it('should maintain isolation between test runs', async () => {
    let firstServerRef: MockMCPServer | null = null;
    let secondServerRef: MockMCPServer | null = null;

    await withMockMCP(
      builder => builder.withName('isolation-test-1').withTool('test').withStaticResponse([]),
      async (server) => {
        firstServerRef = server;
        server.setErrorMode({ mode: 'always_fail', category: 'jsonrpc', affectedClients: 'all' });
      }
    );

    await withMockMCP(
      builder => builder.withName('isolation-test-2').withTool('test').withStaticResponse([]),
      async (server) => {
        secondServerRef = server;
        // This server should not have error mode set
        expect(server.getErrorMode()).toBeUndefined();
      }
    );

    // First server should have been cleaned up
    expect(firstServerRef?.isListening()).toBe(false);
    expect(firstServerRef?.getErrorMode()).toBeUndefined(); // Should be cleared

    expect(secondServerRef?.isListening()).toBe(false);
    expect(secondServerRef?.getErrorMode()).toBeUndefined();
  });
});