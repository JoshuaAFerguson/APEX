/**
 * @fileoverview Tests for withMockMCP() and withMockMCPFacade() wrapper functions
 *
 * Comprehensive test suite covering automatic server lifecycle management,
 * cleanup behavior, error handling, and various configuration options.
 */

import { describe, it, expect, vi } from 'vitest';
import { withMockMCP, withMockMCPFacade } from '../with-mock-mcp.js';
import { MockMCPServer } from '../mock-mcp-server.js';
import { MockMCPServerFacade } from '../mock-server-facade.js';
import type { MockMCPServerDefinition } from '@apexcli/core';

describe('withMockMCP', () => {
  describe('with builder configuration', () => {
    it('should provide a started server to the test callback', async () => {
      await withMockMCP(
        builder => builder
          .withName('test-server')
          .withTool('ping')
          .withStaticResponse([{ type: 'text', text: 'pong' }]),
        async (server) => {
          expect(server.isListening()).toBe(true);
          expect(server.getName()).toBe('test-server');
        }
      );
    });

    it('should stop the server after test completion', async () => {
      let capturedServer: MockMCPServer | null = null;

      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          capturedServer = server;
          expect(server.isListening()).toBe(true);
        }
      );

      expect(capturedServer?.isListening()).toBe(false);
    });

    it('should cleanup even when test fails', async () => {
      let capturedServer: MockMCPServer | null = null;

      await expect(
        withMockMCP(
          builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
          async (server) => {
            capturedServer = server;
            throw new Error('Test failure');
          }
        )
      ).rejects.toThrow('Test failure');

      expect(capturedServer?.isListening()).toBe(false);
    });

    it('should work with sync test callbacks', async () => {
      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        (server) => {
          expect(server.isListening()).toBe(true);
        }
      );
    });

    it('should support autoStart: false option', async () => {
      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          expect(server.isListening()).toBe(false);
          await server.start();
          expect(server.isListening()).toBe(true);
        },
        { autoStart: false }
      );
    });

    it('should call beforeCleanup callback', async () => {
      const beforeCleanup = vi.fn();

      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async () => {},
        { beforeCleanup }
      );

      expect(beforeCleanup).toHaveBeenCalledOnce();
    });

    it('should handle timeout on server start', async () => {
      await expect(
        withMockMCP(
          builder => {
            const mockServer = builder.withName('test-server').withTool('x').withStaticResponse([]).buildServer();
            // Mock start to hang indefinitely
            vi.spyOn(mockServer, 'start').mockImplementation(() => new Promise(() => {}));
            return builder;
          },
          async () => {},
          { timeout: 100 }
        )
      ).rejects.toThrow('Server start timed out');
    });

    it('should handle timeout on server stop during cleanup', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await withMockMCP(
        builder => {
          const mockBuilder = builder.withName('test-server').withTool('x').withStaticResponse([]);
          const mockServer = mockBuilder.buildServer();
          // Mock stop to hang indefinitely
          vi.spyOn(mockServer, 'stop').mockImplementation(() => new Promise(() => {}));
          return mockBuilder;
        },
        async () => {},
        { timeout: 100 }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error during MockMCPServer cleanup:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('with MockMCPServerDefinition', () => {
    const definition: MockMCPServerDefinition = {
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
          { toolName: 'test', response: { content: [], isError: false } },
        ],
        notificationTriggers: [],
      },
      scenarios: [],
    };

    it('should work with MockMCPServerDefinition', async () => {
      await withMockMCP(definition, async (server) => {
        expect(server.isListening()).toBe(true);
        expect(server.getName()).toBe('definition-server');
      });
    });

    it('should support custom options with definition', async () => {
      await withMockMCP(
        definition,
        async (server) => {
          expect(server.isListening()).toBe(false);
          await server.start();
          expect(server.isListening()).toBe(true);
        },
        { autoStart: false }
      );
    });
  });

  describe('error simulation reset', () => {
    it('should reset error mode on cleanup by default', async () => {
      let capturedServer: MockMCPServer | null = null;

      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          capturedServer = server;
          server.setErrorMode({ mode: 'always_fail', category: 'jsonrpc', affectedClients: 'all' });
          expect(server.getErrorMode()).toBeDefined();
        }
      );

      // Error mode should be cleared during cleanup
      expect(capturedServer?.getErrorMode()).toBeUndefined();
    });

    it('should preserve error mode when resetOnCleanup is false', async () => {
      let capturedServer: MockMCPServer | null = null;

      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          capturedServer = server;
          server.setErrorMode({ mode: 'always_fail', category: 'jsonrpc', affectedClients: 'all' });
        },
        { resetOnCleanup: false }
      );

      // Error mode should still be set (though server is stopped)
      expect(capturedServer?.getErrorMode()).toBeDefined();
    });

    it('should reset malformed response mode on cleanup', async () => {
      let capturedServer: MockMCPServer | null = null;

      await withMockMCP(
        builder => builder.withName('test-server').withTool('x').withStaticResponse([]),
        async (server) => {
          capturedServer = server;
          server.setMalformedResponseMode({
            enabled: true,
            malformationType: 'invalid_json',
            affectedMethods: ['tools/call'],
            triggerCondition: 'always',
          });
          expect(server.getMalformedResponseMode()?.enabled).toBe(true);
        }
      );

      // Malformed response mode should be cleared
      expect(capturedServer?.getMalformedResponseMode()?.enabled).toBe(false);
    });
  });

  describe('cleanup error handling', () => {
    it('should log cleanup errors without rethrowing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await withMockMCP(
        builder => {
          const mockBuilder = builder.withName('test-server').withTool('x').withStaticResponse([]);
          const mockServer = mockBuilder.buildServer();
          // Mock resetBehavior to throw
          vi.spyOn(mockServer, 'resetBehavior').mockImplementation(() => {
            throw new Error('Cleanup error');
          });
          return mockBuilder;
        },
        async () => {}
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error during MockMCPServer cleanup:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should preserve original test error when cleanup also fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        withMockMCP(
          builder => {
            const mockBuilder = builder.withName('test-server').withTool('x').withStaticResponse([]);
            const mockServer = mockBuilder.buildServer();
            // Mock stop to throw during cleanup
            vi.spyOn(mockServer, 'stop').mockImplementation(() => {
              throw new Error('Cleanup error');
            });
            return mockBuilder;
          },
          async () => {
            throw new Error('Original test error');
          }
        )
      ).rejects.toThrow('Original test error');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error during MockMCPServer cleanup:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('withMockMCPFacade', () => {
  it('should provide a started facade to the test callback', async () => {
    await withMockMCPFacade(
      builder => builder
        .withName('facade-server')
        .withTool('ping')
        .withStaticResponse([{ type: 'text', text: 'pong' }]),
      async (facade) => {
        expect(facade.isListening()).toBe(true);
        const transport = facade.getTransport();
        expect(transport).toBeDefined();
      }
    );
  });

  it('should cleanup facade on completion', async () => {
    let capturedFacade: MockMCPServerFacade | null = null;

    await withMockMCPFacade(
      builder => builder.withName('facade-server').withTool('x').withStaticResponse([]),
      async (facade) => {
        capturedFacade = facade;
        expect(facade.isListening()).toBe(true);
      }
    );

    expect(capturedFacade?.isListening()).toBe(false);
  });

  it('should cleanup facade even when test fails', async () => {
    let capturedFacade: MockMCPServerFacade | null = null;

    await expect(
      withMockMCPFacade(
        builder => builder.withName('facade-server').withTool('x').withStaticResponse([]),
        async (facade) => {
          capturedFacade = facade;
          throw new Error('Facade test failure');
        }
      )
    ).rejects.toThrow('Facade test failure');

    expect(capturedFacade?.isListening()).toBe(false);
  });

  it('should support autoStart: false option', async () => {
    await withMockMCPFacade(
      builder => builder.withName('facade-server').withTool('x').withStaticResponse([]),
      async (facade) => {
        expect(facade.isListening()).toBe(false);
        await facade.start();
        expect(facade.isListening()).toBe(true);
      },
      { autoStart: false }
    );
  });

  it('should reset facade behavior on cleanup', async () => {
    let capturedFacade: MockMCPServerFacade | null = null;

    await withMockMCPFacade(
      builder => builder.withName('facade-server').withTool('x').withStaticResponse([]),
      async (facade) => {
        capturedFacade = facade;
        facade.setErrorMode({ mode: 'always_fail', category: 'jsonrpc', affectedClients: 'all' });
        expect(facade.getErrorMode()).toBeDefined();
      }
    );

    // Error mode should be cleared
    expect(capturedFacade?.getErrorMode()).toBeUndefined();
  });

  it('should preserve facade state when resetOnCleanup is false', async () => {
    let capturedFacade: MockMCPServerFacade | null = null;

    await withMockMCPFacade(
      builder => builder.withName('facade-server').withTool('x').withStaticResponse([]),
      async (facade) => {
        capturedFacade = facade;
        facade.setErrorMode({ mode: 'always_fail', category: 'jsonrpc', affectedClients: 'all' });
      },
      { resetOnCleanup: false }
    );

    // Error mode should still be set (though facade is stopped)
    expect(capturedFacade?.getErrorMode()).toBeDefined();
  });

  it('should handle facade cleanup errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await withMockMCPFacade(
      builder => {
        const mockBuilder = builder.withName('facade-server').withTool('x').withStaticResponse([]);
        const mockFacade = mockBuilder.build();
        // Mock resetToDefault to throw
        vi.spyOn(mockFacade, 'resetToDefault').mockImplementation(() => {
          throw new Error('Facade cleanup error');
        });
        return mockBuilder;
      },
      async () => {}
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error during MockMCPServerFacade cleanup:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});

describe('integration scenarios', () => {
  it('should work with real mock server interaction', async () => {
    await withMockMCP(
      builder => builder
        .withName('integration-test')
        .withTool('echo')
        .withStaticResponse([{ type: 'text', text: 'Hello, World!' }]),
      async (server) => {
        // Simulate creating a client transport and interacting with the server
        const transport = server.createClientTransport();
        expect(transport).toBeDefined();

        // Verify server state
        expect(server.isListening()).toBe(true);
        expect(server.getName()).toBe('integration-test');
        expect(server.getConnectedClientCount()).toBe(0);
      }
    );
  });

  it('should handle complex builder chains', async () => {
    await withMockMCP(
      builder => builder
        .withName('complex-server')
        .withDescription('A complex test server')
        .withTransport('stdio')
        .withTool('read_file')
          .withStaticResponse([{ type: 'text', text: 'file content' }])
        .withTool('write_file')
          .withDynamicHandler(async (toolName, args) => ({
            content: [{ type: 'text', text: `Wrote to ${args.path}` }],
            isError: false,
          }))
        .withDelay(50, 100)
        .withErrorSimulation({
          mode: 'fail_first_n',
          failCount: 1,
          category: 'mcp',
          affectedClients: 'all',
        }),
      async (server) => {
        expect(server.getName()).toBe('complex-server');
        expect(server.isListening()).toBe(true);
      }
    );
  });

  it('should work with beforeCleanup for verification', async () => {
    const verificationResults: any[] = [];

    await withMockMCP(
      builder => builder.withName('verification-server').withTool('test').withStaticResponse([]),
      async (server) => {
        // Simulate some operations that would be verified in beforeCleanup
        verificationResults.push({ server: server.getName(), status: 'executed' });
      },
      {
        beforeCleanup: async (server) => {
          // Perform final verifications before server cleanup
          verificationResults.push({ server: server.getName(), status: 'verified' });
          expect(server.isListening()).toBe(true); // Should still be listening during beforeCleanup
        },
      }
    );

    expect(verificationResults).toEqual([
      { server: 'verification-server', status: 'executed' },
      { server: 'verification-server', status: 'verified' },
    ]);
  });
});