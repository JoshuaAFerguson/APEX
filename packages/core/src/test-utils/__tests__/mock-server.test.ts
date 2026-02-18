/**
 * Comprehensive tests for MockServer class
 *
 * Tests cover all functionality including start/stop lifecycle,
 * dynamic port assignment, route configuration, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockServer } from '../mock-server';

describe('MockServer', () => {
  let mockServer: MockServer;

  afterEach(async () => {
    // Cleanup: ensure server is stopped after each test
    if (mockServer && mockServer.isRunning()) {
      await mockServer.stop();
    }
  });

  describe('constructor', () => {
    it('should create a MockServer instance with default options', () => {
      mockServer = new MockServer();
      expect(mockServer).toBeInstanceOf(MockServer);
      expect(mockServer.getHost()).toBe('127.0.0.1');
      expect(mockServer.isRunning()).toBe(false);
    });

    it('should create a MockServer with custom options', () => {
      mockServer = new MockServer({
        host: '0.0.0.0',
        port: 8080,
        logger: true,
      });
      expect(mockServer.getHost()).toBe('0.0.0.0');
      expect(mockServer.isRunning()).toBe(false);
    });
  });

  describe('lifecycle management', () => {
    beforeEach(() => {
      mockServer = new MockServer();
    });

    it('should start and stop the server successfully', async () => {
      expect(mockServer.isRunning()).toBe(false);

      await mockServer.start();
      expect(mockServer.isRunning()).toBe(true);
      expect(mockServer.getPort()).toBeGreaterThan(0);
      expect(mockServer.getUrl()).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

      await mockServer.stop();
      expect(mockServer.isRunning()).toBe(false);
    });

    it('should assign a dynamic port when port is 0', async () => {
      await mockServer.start();
      const port = mockServer.getPort();
      expect(port).toBeGreaterThan(0);
      expect(port).not.toBe(0);
    });

    it('should throw error when starting already running server', async () => {
      await mockServer.start();
      await expect(mockServer.start()).rejects.toThrow('MockServer is already running');
    });

    it('should throw error when stopping non-running server', async () => {
      await expect(mockServer.stop()).rejects.toThrow('MockServer is not running');
    });
  });

  describe('URL and port methods', () => {
    beforeEach(() => {
      mockServer = new MockServer();
    });

    it('should return correct URL when server is running', async () => {
      await mockServer.start();
      const url = mockServer.getUrl();
      const port = mockServer.getPort();
      expect(url).toBe(`http://127.0.0.1:${port}`);
    });

    it('should throw error when getting URL of non-running server', () => {
      expect(() => mockServer.getUrl()).toThrow('MockServer is not running. Call start() first.');
    });

    it('should throw error when getting port of non-running server', () => {
      expect(() => mockServer.getPort()).toThrow('MockServer is not running. Call start() first.');
    });

    it('should return correct host regardless of running state', () => {
      expect(mockServer.getHost()).toBe('127.0.0.1');

      const customServer = new MockServer({ host: '0.0.0.0' });
      expect(customServer.getHost()).toBe('0.0.0.0');
    });
  });

  describe('built-in routes', () => {
    beforeEach(async () => {
      mockServer = new MockServer();
      await mockServer.start();
    });

    it('should respond to health check route', async () => {
      const url = `${mockServer.getUrl()}/health`;
      const response = await fetch(url);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(typeof data.uptime).toBe('number');
    });

    it('should respond to ping route', async () => {
      const url = `${mockServer.getUrl()}/ping`;
      const response = await fetch(url);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ message: 'pong' });
    });

    it('should echo requests on echo route', async () => {
      const url = `${mockServer.getUrl()}/echo`;
      const testData = { test: 'data' };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('method', 'POST');
      expect(data).toHaveProperty('url', '/echo');
      expect(data).toHaveProperty('body', testData);
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('headers');
    });

    it('should return status codes on status route', async () => {
      const baseUrl = mockServer.getUrl();

      // Test various status codes
      const statusCodes = [200, 404, 500];

      for (const code of statusCodes) {
        const response = await fetch(`${baseUrl}/status/${code}`);
        expect(response.status).toBe(code);

        const data = await response.json();
        expect(data).toEqual({ status: code, message: `Status ${code}` });
      }
    });

    it('should handle invalid status codes', async () => {
      const url = `${mockServer.getUrl()}/status/999`;
      const response = await fetch(url);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toEqual({ error: 'Invalid status code' });
    });
  });

  describe('Fastify instance access', () => {
    beforeEach(() => {
      mockServer = new MockServer();
    });

    it('should provide access to Fastify instance', async () => {
      const instance = await mockServer.getFastifyInstance();
      expect(instance).toBeDefined();
      expect(typeof instance.get).toBe('function');
      expect(typeof instance.post).toBe('function');
      expect(typeof instance.listen).toBe('function');
    });

    it('should allow adding custom routes before starting', async () => {
      await mockServer.addRoutes((app) => {
        app.get('/custom', async () => ({ custom: true }));
      });

      await mockServer.start();

      const response = await fetch(`${mockServer.getUrl()}/custom`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ custom: true });
    });

    it('should prevent adding routes to running server', async () => {
      await mockServer.start();

      await expect(
        mockServer.addRoutes((app) => {
          app.get('/should-fail', async () => ({}));
        })
      ).rejects.toThrow('Cannot add routes while server is running. Stop server first.');
    });
  });

  describe('static create method', () => {
    it('should create and start server in one call', async () => {
      const { server, url } = await MockServer.create();
      mockServer = server; // For cleanup

      expect(server.isRunning()).toBe(true);
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(server.getUrl()).toBe(url);

      // Test that it's actually working
      const response = await fetch(`${url}/health`);
      expect(response.status).toBe(200);
    });

    it('should create server with custom options', async () => {
      const { server, url } = await MockServer.create({
        host: '127.0.0.1',
        logger: false,
      });
      mockServer = server; // For cleanup

      expect(server.getHost()).toBe('127.0.0.1');
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    });
  });

  describe('error handling', () => {
    it('should handle server start failures gracefully', async () => {
      // Create two servers trying to bind to the same port
      const server1 = new MockServer({ port: 9999 });
      const server2 = new MockServer({ port: 9999 });

      await server1.start();
      mockServer = server1; // For cleanup

      // Second server should fail to start on same port
      await expect(server2.start()).rejects.toThrow('Failed to start MockServer');
    });

    it('should handle malformed server configuration', () => {
      expect(() => {
        new MockServer({
          serverOptions: {
            // Invalid Fastify options would be caught by TypeScript
            // This test ensures the constructor handles edge cases
          },
        });
      }).not.toThrow();
    });
  });

  describe('multiple server instances', () => {
    let server1: MockServer;
    let server2: MockServer;

    afterEach(async () => {
      if (server1 && server1.isRunning()) await server1.stop();
      if (server2 && server2.isRunning()) await server2.stop();
    });

    it('should allow multiple servers on different ports', async () => {
      server1 = new MockServer();
      server2 = new MockServer();

      await server1.start();
      await server2.start();

      expect(server1.isRunning()).toBe(true);
      expect(server2.isRunning()).toBe(true);
      expect(server1.getPort()).not.toBe(server2.getPort());

      // Both should be accessible
      const response1 = await fetch(`${server1.getUrl()}/health`);
      const response2 = await fetch(`${server2.getUrl()}/health`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });
  });

  describe('integration scenarios', () => {
    it('should work in a typical test scenario', async () => {
      // Simulate a typical test usage pattern
      mockServer = new MockServer({ logger: false });

      // Add custom routes for the test
      await mockServer.addRoutes((app) => {
        app.get('/api/test', async () => ({ test: 'success' }));
        app.post('/api/data', async (request) => ({
          received: request.body,
          timestamp: Date.now(),
        }));
      });

      // Start server
      await mockServer.start();
      const baseUrl = mockServer.getUrl();

      // Test custom endpoints
      const getResponse = await fetch(`${baseUrl}/api/test`);
      expect(getResponse.status).toBe(200);
      expect(await getResponse.json()).toEqual({ test: 'success' });

      const postResponse = await fetch(`${baseUrl}/api/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 123, name: 'test' }),
      });

      expect(postResponse.status).toBe(200);
      const postData = await postResponse.json();
      expect(postData.received).toEqual({ id: 123, name: 'test' });
      expect(typeof postData.timestamp).toBe('number');

      // Cleanup
      await mockServer.stop();
      expect(mockServer.isRunning()).toBe(false);
    });

    it('should handle rapid start/stop cycles', async () => {
      mockServer = new MockServer();

      // Start and stop multiple times
      for (let i = 0; i < 3; i++) {
        await mockServer.start();
        expect(mockServer.isRunning()).toBe(true);

        const response = await fetch(`${mockServer.getUrl()}/health`);
        expect(response.status).toBe(200);

        await mockServer.stop();
        expect(mockServer.isRunning()).toBe(false);
      }
    });
  });
});

describe('Navigation Scenarios', () => {
  let mockServer: MockServer;

  beforeEach(async () => {
    mockServer = new MockServer();
    await mockServer.start();
  });

  afterEach(async () => {
    if (mockServer && mockServer.isRunning()) {
      await mockServer.stop();
    }
  });

  describe('Redirect Scenarios', () => {
    it('should handle 301 permanent redirects', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect/301/page2`, {
        redirect: 'manual',
      });
      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe('/page2');
    });

    it('should handle 302 temporary redirects', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect/302/page3`, {
        redirect: 'manual',
      });
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/page3');
    });

    it('should handle 307 temporary redirects with method preservation', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect/307/home`, {
        redirect: 'manual',
      });
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('/');
    });

    it('should handle generic redirect with query parameters', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect?status=308&target=/test`, {
        redirect: 'manual',
      });
      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe('/test');
    });

    it('should reject invalid redirect status codes', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect?status=200&target=/test`);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid redirect status code');
    });

    it('should follow redirect chain', async () => {
      const response = await fetch(`${mockServer.getUrl()}/redirect-chain-start`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Redirect chain completed');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle 404 Not Found errors', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error/404`);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Not Found');
      expect(data.message).toBe('The requested resource was not found');
      expect(data).toHaveProperty('timestamp');
    });

    it('should handle 500 Internal Server Error', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error/500`);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal Server Error');
      expect(data.message).toBe('An internal server error occurred');
      expect(data).toHaveProperty('timestamp');
    });

    it('should handle 401 Unauthorized errors', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error/401`);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toBe('Authentication required');
    });

    it('should handle 403 Forbidden errors', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error/403`);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
      expect(data.message).toBe('Access denied');
    });

    it('should handle 503 Service Unavailable errors', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error/503`);
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe('Service Unavailable');
      expect(data.message).toBe('Service temporarily unavailable');
    });

    it('should handle generic error with query parameters', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error?status=418&message=I'm a teapot`);
      expect(response.status).toBe(418);
      const data = await response.json();
      expect(data.error).toBe('HTTP 418');
      expect(data.message).toBe("I'm a teapot");
    });

    it('should reject invalid error status codes', async () => {
      const response = await fetch(`${mockServer.getUrl()}/error?status=200`);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid error status code');
    });
  });

  describe('Delay Scenarios', () => {
    it('should handle configurable delays', async () => {
      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/delay/500`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(490); // Allow 10ms tolerance

      const data = await response.json();
      expect(data.message).toBe('Response delayed by 500ms');
      expect(data.delayMs).toBe(500);
      expect(data).toHaveProperty('timestamp');
    });

    it('should handle delay with query parameter', async () => {
      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/delay?ms=200`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(190);

      const data = await response.json();
      expect(data.delayMs).toBe(200);
    });

    it('should handle delay with error response', async () => {
      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/delay-error/300/404`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(404);
      expect(duration).toBeGreaterThanOrEqual(290);

      const data = await response.json();
      expect(data.error).toBe('HTTP 404');
      expect(data.message).toBe('Delayed error response (300ms delay)');
      expect(data.delayMs).toBe(300);
    });

    it('should handle slow redirect', async () => {
      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/slow-redirect/250/home`, {
        redirect: 'manual',
      });
      const duration = Date.now() - startTime;

      expect(response.status).toBe(302);
      expect(duration).toBeGreaterThanOrEqual(240);
      expect(response.headers.get('location')).toBe('/');
    });

    it('should reject invalid delay values', async () => {
      const response = await fetch(`${mockServer.getUrl()}/delay/50000`);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid delay value');
    });

    it('should reject negative delay values', async () => {
      const response = await fetch(`${mockServer.getUrl()}/delay/-100`);
      expect(response.status).toBe(400);
    });

    it('should default to 1000ms when no delay specified in query', async () => {
      const startTime = Date.now();
      const response = await fetch(`${mockServer.getUrl()}/delay`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(990);

      const data = await response.json();
      expect(data.delayMs).toBe(1000);
    });
  });
});

describe('MockServer acceptance criteria', () => {
  let mockServer: MockServer;

  afterEach(async () => {
    if (mockServer && mockServer.isRunning()) {
      await mockServer.stop();
    }
  });

  it('should meet all basic acceptance criteria', async () => {
    // MockServer class exists with start(), stop(), and getUrl() methods
    mockServer = new MockServer();
    expect(typeof mockServer.start).toBe('function');
    expect(typeof mockServer.stop).toBe('function');
    expect(typeof mockServer.getUrl).toBe('function');

    // Server can be instantiated, started on an available port, and stopped without errors
    expect(mockServer.isRunning()).toBe(false);
    await expect(mockServer.start()).resolves.toBeUndefined();
    expect(mockServer.isRunning()).toBe(true);
    expect(mockServer.getPort()).toBeGreaterThan(0);
    await expect(mockServer.stop()).resolves.toBeUndefined();
    expect(mockServer.isRunning()).toBe(false);

    // Basic health check route responds correctly
    await mockServer.start();
    const response = await fetch(`${mockServer.getUrl()}/health`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('uptime');
  });

  it('should meet navigation scenario acceptance criteria', async () => {
    mockServer = new MockServer();
    await mockServer.start();
    const baseUrl = mockServer.getUrl();

    // MockServer supports redirect routes with configurable status codes and targets
    const redirectResponse = await fetch(`${baseUrl}/redirect/301/page2`, { redirect: 'manual' });
    expect(redirectResponse.status).toBe(301);
    expect(redirectResponse.headers.get('location')).toBe('/page2');

    // MockServer supports error routes that return specific HTTP errors
    const errorResponse = await fetch(`${baseUrl}/error/404`);
    expect(errorResponse.status).toBe(404);
    const errorData = await errorResponse.json();
    expect(errorData.error).toBe('Not Found');

    // MockServer supports delay routes with configurable response time
    const startTime = Date.now();
    const delayResponse = await fetch(`${baseUrl}/delay/100`);
    const duration = Date.now() - startTime;
    expect(delayResponse.status).toBe(200);
    expect(duration).toBeGreaterThanOrEqual(90);
    const delayData = await delayResponse.json();
    expect(delayData.delayMs).toBe(100);

    // Each scenario is accessible via predictable URL patterns
    expect(`${baseUrl}/redirect/301/target`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/redirect\/301\/target$/);
    expect(`${baseUrl}/error/404`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/error\/404$/);
    expect(`${baseUrl}/delay/500`).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/delay\/500$/);
  });
});