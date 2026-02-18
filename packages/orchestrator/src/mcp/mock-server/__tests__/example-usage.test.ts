/**
 * @fileoverview Example usage patterns for withMockMCP() wrapper functions
 *
 * This file demonstrates various ways to use the withMockMCP() and
 * withMockMCPFacade() functions in real test scenarios.
 */

import { describe, it, expect } from 'vitest';
import { withMockMCP, withMockMCPFacade } from '../with-mock-mcp.js';

// Mock MCP Client class for demonstration
class SimpleMCPClient {
  private transport: any;
  private connected = false;

  constructor(transport: any) {
    this.transport = transport;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    // Simulate tool call
    return {
      content: [{ type: 'text', text: `Called ${name} with ${JSON.stringify(args)}` }],
      isError: false,
    };
  }

  async listTools(): Promise<any> {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    return {
      tools: [
        { name: 'read_file', description: 'Read file content' },
        { name: 'write_file', description: 'Write file content' },
      ]
    };
  }
}

describe('withMockMCP() Example Usage', () => {
  describe('Basic Usage Patterns', () => {
    it('should handle simple file operations testing', async () => {
      await withMockMCP(
        builder => builder
          .withName('file-server')
          .withTool('read_file')
            .withDynamicHandler(async (toolName, args: any) => ({
              content: [{
                type: 'text',
                text: `File content for: ${args.path}`
              }],
              isError: false,
            }))
          .withTool('write_file')
            .withDynamicHandler(async (toolName, args: any) => ({
              content: [{
                type: 'text',
                text: `Wrote ${args.content} to ${args.path}`
              }],
              isError: false,
            })),
        async (server) => {
          // Create client and connect
          const transport = server.createClientTransport();
          const client = new SimpleMCPClient(transport);
          await client.connect();

          // Test file operations
          const readResult = await client.callTool('read_file', { path: '/test/file.txt' });
          expect(readResult.content[0].text).toContain('File content for: /test/file.txt');

          const writeResult = await client.callTool('write_file', {
            path: '/test/output.txt',
            content: 'Hello, World!'
          });
          expect(writeResult.content[0].text).toContain('Wrote Hello, World! to /test/output.txt');

          await client.disconnect();

          // Verify server tracked the interactions
          server.assertToolCalled('read_file', 1);
          server.assertToolCalled('write_file', 1);
        }
      );
    });

    it('should handle error scenarios gracefully', async () => {
      await withMockMCP(
        builder => builder
          .withName('error-server')
          .withTool('error_prone_operation')
            .withDynamicHandler(async (toolName, args: any) => {
              if (args.simulate_error) {
                return {
                  content: [{ type: 'text', text: 'Operation failed' }],
                  isError: true,
                };
              }
              return {
                content: [{ type: 'text', text: 'Operation succeeded' }],
                isError: false,
              };
            }),
        async (server) => {
          const transport = server.createClientTransport();
          const client = new SimpleMCPClient(transport);
          await client.connect();

          // Test successful operation
          const successResult = await client.callTool('error_prone_operation', {
            simulate_error: false
          });
          expect(successResult.isError).toBe(false);

          // Test error scenario
          const errorResult = await client.callTool('error_prone_operation', {
            simulate_error: true
          });
          expect(errorResult.isError).toBe(true);

          await client.disconnect();
          server.assertToolCalled('error_prone_operation', 2);
        }
      );
    });
  });

  describe('Advanced Configuration Examples', () => {
    it('should support custom timeout and manual server control', async () => {
      await withMockMCP(
        builder => builder
          .withName('manual-server')
          .withTool('test_tool')
            .withStaticResponse([{ type: 'text', text: 'test response' }]),
        async (server) => {
          // Server should NOT be started automatically
          expect(server.isListening()).toBe(false);

          // Start manually for testing
          await server.start();
          expect(server.isListening()).toBe(true);

          // Use the server
          const transport = server.createClientTransport();
          const client = new SimpleMCPClient(transport);
          await client.connect();

          const result = await client.callTool('test_tool');
          expect(result.content[0].text).toBe('test response');

          await client.disconnect();
        },
        {
          autoStart: false,
          timeout: 5000,
        }
      );
    });

    it('should support custom cleanup logic', async () => {
      const cleanupLog: string[] = [];

      await withMockMCP(
        builder => builder
          .withName('cleanup-server')
          .withTool('business_operation')
            .withDynamicHandler(async () => ({
              content: [{ type: 'text', text: 'Business logic executed' }],
              isError: false,
            })),
        async (server) => {
          const transport = server.createClientTransport();
          const client = new SimpleMCPClient(transport);
          await client.connect();

          await client.callTool('business_operation');
          cleanupLog.push('test-completed');

          await client.disconnect();
        },
        {
          beforeCleanup: async (server) => {
            // Custom cleanup logic - verify final state
            const stats = server.getStats();
            cleanupLog.push(`cleanup-stats-${stats.totalRequests}-requests`);

            // Ensure server is still running during cleanup
            expect(server.isListening()).toBe(true);
          }
        }
      );

      // Verify cleanup callback was executed
      expect(cleanupLog).toEqual(['test-completed', 'cleanup-stats-1-requests']);
    });
  });

  describe('withMockMCPFacade() Examples', () => {
    it('should provide single-client convenience API', async () => {
      await withMockMCPFacade(
        builder => builder
          .withName('facade-server')
          .withTool('api_call')
            .withDynamicHandler(async (toolName, args: any) => ({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  endpoint: args.endpoint,
                  method: args.method || 'GET',
                  status: 200,
                  data: { result: 'success' }
                })
              }],
              isError: false,
            }))
          .withTool('list_endpoints')
            .withStaticResponse([{
              type: 'text',
              text: JSON.stringify(['/api/users', '/api/posts', '/api/comments'])
            }]),
        async (facade) => {
          // Facade provides direct transport access
          const transport = facade.getTransport();
          expect(transport).toBeDefined();

          const client = new SimpleMCPClient(transport);
          await client.connect();

          // Test API endpoints
          const listResult = await client.callTool('list_endpoints');
          const endpoints = JSON.parse(listResult.content[0].text);
          expect(endpoints).toContain('/api/users');

          const apiResult = await client.callTool('api_call', {
            endpoint: '/api/users',
            method: 'GET'
          });
          const response = JSON.parse(apiResult.content[0].text);
          expect(response.status).toBe(200);
          expect(response.data.result).toBe('success');

          await client.disconnect();

          // Facade provides assertion helpers
          facade.assertMethodCalled('tools/call', 2);
        }
      );
    });

    it('should handle complex workflows with state', async () => {
      let sessionState = { users: [] as any[], posts: [] as any[] };

      await withMockMCPFacade(
        builder => builder
          .withName('workflow-server')
          .withTool('create_user')
            .withDynamicHandler(async (toolName, args: any) => {
              const user = { id: Date.now(), name: args.name, email: args.email };
              sessionState.users.push(user);

              return {
                content: [{ type: 'text', text: JSON.stringify(user) }],
                isError: false,
              };
            })
          .withTool('create_post')
            .withDynamicHandler(async (toolName, args: any) => {
              const post = {
                id: Date.now(),
                userId: args.userId,
                title: args.title,
                content: args.content
              };
              sessionState.posts.push(post);

              return {
                content: [{ type: 'text', text: JSON.stringify(post) }],
                isError: false,
              };
            })
          .withTool('get_user_posts')
            .withDynamicHandler(async (toolName, args: any) => {
              const userPosts = sessionState.posts.filter(p => p.userId === args.userId);

              return {
                content: [{ type: 'text', text: JSON.stringify(userPosts) }],
                isError: false,
              };
            }),
        async (facade) => {
          const transport = facade.getTransport();
          const client = new SimpleMCPClient(transport);
          await client.connect();

          // Execute workflow: create user, create posts, retrieve posts
          const userResult = await client.callTool('create_user', {
            name: 'John Doe',
            email: 'john@example.com'
          });
          const user = JSON.parse(userResult.content[0].text);

          const post1Result = await client.callTool('create_post', {
            userId: user.id,
            title: 'First Post',
            content: 'Hello, World!'
          });

          const post2Result = await client.callTool('create_post', {
            userId: user.id,
            title: 'Second Post',
            content: 'Another post'
          });

          const userPostsResult = await client.callTool('get_user_posts', {
            userId: user.id
          });
          const userPosts = JSON.parse(userPostsResult.content[0].text);

          // Verify workflow results
          expect(userPosts).toHaveLength(2);
          expect(userPosts[0].title).toBe('First Post');
          expect(userPosts[1].title).toBe('Second Post');

          await client.disconnect();
        },
        {
          resetOnCleanup: false // Preserve state for verification
        }
      );

      // Verify final state after test
      expect(sessionState.users).toHaveLength(1);
      expect(sessionState.posts).toHaveLength(2);
    });
  });

  describe('Error Recovery Examples', () => {
    it('should cleanup properly even when test fails', async () => {
      let serverInstance: any = null;

      // This test intentionally fails to verify cleanup
      await expect(
        withMockMCP(
          builder => builder
            .withName('failure-test')
            .withTool('test_tool')
            .withStaticResponse([{ type: 'text', text: 'response' }]),
          async (server) => {
            serverInstance = server;
            expect(server.isListening()).toBe(true);

            // Simulate some test work
            const transport = server.createClientTransport();
            const client = new SimpleMCPClient(transport);
            await client.connect();
            await client.callTool('test_tool');

            // Intentional failure
            throw new Error('Simulated test failure');
          }
        )
      ).rejects.toThrow('Simulated test failure');

      // Server should be cleaned up despite test failure
      expect(serverInstance.isListening()).toBe(false);
    });

    it('should handle server startup failures gracefully', async () => {
      // Test timeout during server start
      await expect(
        withMockMCP(
          builder => {
            const mockBuilder = builder
              .withName('timeout-test')
              .withTool('test_tool')
              .withStaticResponse([]);

            const server = mockBuilder.buildServer();

            // Mock start to hang indefinitely to trigger timeout
            const originalStart = server.start.bind(server);
            server.start = () => new Promise(() => {}); // Never resolves

            return mockBuilder;
          },
          async (server) => {
            // This should never execute due to start timeout
            expect.fail('Should not reach this point');
          },
          { timeout: 100 } // Short timeout for quick test
        )
      ).rejects.toThrow('Server start timed out');
    });
  });
});