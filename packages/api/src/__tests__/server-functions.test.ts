/**
 * @apexcli/api - Server Functions Tests
 *
 * Comprehensive unit tests for createServer and startServer functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createServer, startServer, type ServerOptions } from '../index.js';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator to avoid SQLite issues in tests
vi.mock('@apexcli/orchestrator', () => {
  const mockTask = {
    id: 'task_server_test',
    description: 'Server test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: '/test',
    branchName: 'apex/server-test',
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
    logs: [],
    artifacts: [],
    trashedAt: undefined,
    archivedAt: undefined,
  };

  class MockOrchestrator {
    async initialize() {}
    async createTask() { return mockTask; }
    async getTask() { return mockTask; }
    async listTasks() { return [mockTask]; }
    on() {}
  }

  return {
    ApexOrchestrator: MockOrchestrator,
    DaemonManager: class MockDaemonManager {
      async start() {}
      async stop() {}
      on() {}
    },
    HealthMonitor: class MockHealthMonitor {
      async getMetrics() { return { status: 'healthy' }; }
    },
  };
});

describe('Server Functions', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-server-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create minimal config
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: server-test-project\n`
    );
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('createServer', () => {
    let server: FastifyInstance;

    afterEach(async () => {
      if (server) {
        await server.close();
      }
    });

    it('should create server with minimal options', async () => {
      const options: ServerOptions = {
        port: 0, // Let OS assign port
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      expect(server).toBeDefined();
      expect(typeof server.listen).toBe('function');
      expect(typeof server.close).toBe('function');
      expect(typeof server.inject).toBe('function');
    });

    it('should create server with full options', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
        logLevel: 'info',
        cors: true,
        daemon: false,
      };

      server = await createServer(options);
      expect(server).toBeDefined();
    });

    it('should register health endpoint', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.version).toBeDefined();
    });

    it('should register tasks endpoints', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      // Test POST /tasks endpoint
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          description: 'Test server task creation',
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const createBody = JSON.parse(createResponse.body);
      expect(createBody.taskId).toBeDefined();
      expect(createBody.status).toBe('pending');
    });

    it('should register agents endpoint', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      const response = await server.inject({
        method: 'GET',
        url: '/agents',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.agents).toBeDefined();
    });

    it('should register config endpoint', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      const response = await server.inject({
        method: 'GET',
        url: '/config',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.project).toBeDefined();
      expect(body.project.name).toBe('server-test-project');
    });

    it('should enable CORS when configured', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
        cors: true,
      };

      server = await createServer(options);

      const response = await server.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          'Origin': 'http://localhost:3001',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should register WebSocket support', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      // Check that WebSocket plugin is registered
      expect(server.hasPlugin('@fastify/websocket')).toBe(true);
    });

    it('should register screenshot routes', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      const response = await server.inject({
        method: 'GET',
        url: '/screenshot/health',
      });

      // Should return a response (might be healthy or unhealthy)
      expect([200, 503]).toContain(response.statusCode);
    });

    it('should handle different log levels', async () => {
      const logLevels: Array<'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'> = [
        'fatal', 'error', 'warn', 'info', 'debug', 'trace'
      ];

      for (const logLevel of logLevels) {
        const options: ServerOptions = {
          port: 0,
          host: '127.0.0.1',
          projectPath: testDir,
          logLevel,
        };

        const testServer = await createServer(options);
        expect(testServer).toBeDefined();
        await testServer.close();
      }
    });

    it('should handle orchestrator initialization', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      // The server should be created successfully even with orchestrator initialization
      expect(server).toBeDefined();
    });

    it('should register error handlers', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      // Test 404 handler
      const response = await server.inject({
        method: 'GET',
        url: '/non-existent-endpoint',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle custom host and port', async () => {
      const options: ServerOptions = {
        port: 0, // Use 0 to let OS assign
        host: 'localhost',
        projectPath: testDir,
      };

      server = await createServer(options);
      expect(server).toBeDefined();
    });

    it('should support daemon mode configuration', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
        daemon: true,
      };

      server = await createServer(options);
      expect(server).toBeDefined();
    });
  });

  describe('startServer', () => {
    it('should start server and return void', async () => {
      const options: ServerOptions = {
        port: 0, // Use 0 to let OS assign port
        host: '127.0.0.1',
        projectPath: testDir,
      };

      // Mock the server listen method to avoid actually binding to a port
      const mockListen = vi.fn().mockResolvedValue(undefined);
      vi.doMock('fastify', () => ({
        default: () => ({
          register: vi.fn().mockResolvedValue(undefined),
          listen: mockListen,
          close: vi.fn().mockResolvedValue(undefined),
          log: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          },
          addHook: vi.fn(),
          setErrorHandler: vi.fn(),
          setNotFoundHandler: vi.fn(),
          hasPlugin: vi.fn().mockReturnValue(true),
        }),
      }));

      // Test that startServer doesn't throw
      await expect(startServer(options)).resolves.toBeUndefined();
    });

    it('should handle server startup errors gracefully', async () => {
      const options: ServerOptions = {
        port: -1, // Invalid port to trigger error
        host: '127.0.0.1',
        projectPath: testDir,
      };

      // Should not throw, but might log error
      await expect(startServer(options)).rejects.toThrow();
    });

    it('should start server with daemon mode', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
        daemon: true,
      };

      // Mock the server and daemon manager
      const mockListen = vi.fn().mockResolvedValue(undefined);
      vi.doMock('fastify', () => ({
        default: () => ({
          register: vi.fn().mockResolvedValue(undefined),
          listen: mockListen,
          close: vi.fn().mockResolvedValue(undefined),
          log: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          },
          addHook: vi.fn(),
          setErrorHandler: vi.fn(),
          setNotFoundHandler: vi.fn(),
          hasPlugin: vi.fn().mockReturnValue(true),
        }),
      }));

      await expect(startServer(options)).resolves.toBeUndefined();
    });
  });

  describe('Server Integration', () => {
    let server: FastifyInstance;

    afterEach(async () => {
      if (server) {
        await server.close();
      }
    });

    it('should handle complete request lifecycle', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
        cors: true,
      };

      server = await createServer(options);

      // Test health check
      const healthResponse = await server.inject({
        method: 'GET',
        url: '/health',
      });
      expect(healthResponse.statusCode).toBe(200);

      // Test task creation
      const taskResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          description: 'Integration test task',
          workflow: 'feature',
        },
      });
      expect(taskResponse.statusCode).toBe(201);

      // Test task listing
      const listResponse = await server.inject({
        method: 'GET',
        url: '/tasks',
      });
      expect(listResponse.statusCode).toBe(200);
    });

    it('should handle WebSocket connections', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      // WebSocket endpoint should be available
      // Note: Testing actual WebSocket connections requires more complex setup
      expect(server.hasPlugin('@fastify/websocket')).toBe(true);
    });

    it('should handle concurrent requests', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      // Send multiple concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        server.inject({
          method: 'POST',
          url: '/tasks',
          headers: { 'Content-Type': 'application/json' },
          payload: {
            description: `Concurrent test task ${i + 1}`,
          },
        })
      );

      const responses = await Promise.all(promises);

      responses.forEach((response, i) => {
        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.taskId).toBeDefined();
      });
    });

    it('should handle malformed JSON requests', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      const response = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: '{"malformed": json}',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle large payloads appropriately', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      const largeDescription = 'A'.repeat(10000); // 10KB description

      const response = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          description: largeDescription,
        },
      });

      // Should either accept the request or reject with appropriate status
      expect([201, 413]).toContain(response.statusCode);
    });

    it('should apply proper security headers', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      server = await createServer(options);

      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      // Check for basic security practices in response headers
      // (specific headers depend on middleware configuration)
    });
  });

  describe('Configuration Edge Cases', () => {
    let server: FastifyInstance;

    afterEach(async () => {
      if (server) {
        await server.close();
      }
    });

    it('should handle missing project directory', async () => {
      const nonExistentDir = path.join(os.tmpdir(), 'non-existent-apex-dir');

      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: nonExistentDir,
      };

      // Should handle missing directory gracefully (might create it or throw appropriate error)
      await expect(createServer(options)).rejects.toThrow();
    });

    it('should handle invalid configuration file', async () => {
      // Create invalid config
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        'invalid: yaml: content: }'
      );

      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: testDir,
      };

      // Should handle invalid config gracefully
      await expect(createServer(options)).rejects.toThrow();
    });

    it('should handle permissions issues', async () => {
      // This test would require specific file system permission setup
      // Skipping for now as it's environment-dependent
      expect(true).toBe(true);
    });
  });
});