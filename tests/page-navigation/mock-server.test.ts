/**
 * @fileoverview Tests for the enhanced mock navigation server
 *
 * These tests validate that the mock server correctly serves navigation scenarios
 * and can be programmatically controlled for test lifecycle management.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { MockNavigationServer, MockServerLifecycle } from './mock-server';

describe('MockNavigationServer', () => {
  let server: MockNavigationServer;

  beforeEach(async () => {
    server = new MockNavigationServer({
      verbose: false,
      baseDelay: 100 // Faster tests
    });
    await server.start();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Basic Functionality', () => {
    it('should start and stop programmatically', async () => {
      expect(server.isRunning).toBe(true);
      expect(server.port).toBeGreaterThan(0);
      expect(server.baseUrl).toMatch(/^http:\/\/localhost:\d+$/);

      await server.stop();
      expect(server.isRunning).toBe(false);
    });

    it('should serve home page', async () => {
      const response = await fetch(`${server.baseUrl}/`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');

      const html = await response.text();
      expect(html).toContain('Navigation Test Home');
      expect(html).toContain('<a href="/page1"');
    });

    it('should serve test pages', async () => {
      const response = await fetch(`${server.baseUrl}/page1`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain('Navigation Test - Page 1');
      expect(html).toContain('<a href="/page2"');
    });
  });

  describe('Error Scenarios', () => {
    it('should return 500 for error endpoint', async () => {
      const response = await fetch(`${server.baseUrl}/error`);
      expect(response.status).toBe(500);

      const html = await response.text();
      expect(html).toContain('500 Server Error');
    });

    it('should return 404 for not found endpoint', async () => {
      const response = await fetch(`${server.baseUrl}/404`);
      expect(response.status).toBe(404);

      const html = await response.text();
      expect(html).toContain('404 Not Found');
    });

    it('should return 404 for nonexistent paths', async () => {
      const response = await fetch(`${server.baseUrl}/nonexistent-path`);
      expect(response.status).toBe(404);

      const html = await response.text();
      expect(html).toContain('Page Not Found');
      expect(html).toContain('/nonexistent-path');
    });

    it('should return 403 for forbidden endpoint', async () => {
      const response = await fetch(`${server.baseUrl}/forbidden`);
      expect(response.status).toBe(403);

      const html = await response.text();
      expect(html).toContain('403 Forbidden');
    });
  });

  describe('Redirect Scenarios', () => {
    it('should handle dynamic redirects', async () => {
      const response = await fetch(`${server.baseUrl}/redirect?to=/page2`, {
        redirect: 'manual'
      });
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/page2');
    });

    it('should handle permanent redirects', async () => {
      const response = await fetch(`${server.baseUrl}/redirect-permanent`, {
        redirect: 'manual'
      });
      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe('/page1');
    });

    it('should handle temporary redirects', async () => {
      const response = await fetch(`${server.baseUrl}/redirect-temp`, {
        redirect: 'manual'
      });
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/page1');
    });
  });

  describe('Content Type Scenarios', () => {
    it('should serve JSON content', async () => {
      const response = await fetch(`${server.baseUrl}/api/data`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');

      const json = await response.json();
      expect(json.message).toBe('Test API response');
      expect(json.data.test).toBe(true);
    });

    it('should serve empty content', async () => {
      const response = await fetch(`${server.baseUrl}/empty`);
      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toBe('');
    });
  });

  describe('Performance Scenarios', () => {
    it('should handle slow responses', async () => {
      const startTime = Date.now();
      const response = await fetch(`${server.baseUrl}/slow`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeGreaterThan(80); // Should take at least 100ms

      const html = await response.text();
      expect(html).toContain('Slow Page');
    });

    it('should handle very slow responses', async () => {
      const startTime = Date.now();
      const response = await fetch(`${server.baseUrl}/very-slow`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeGreaterThan(180); // Should take at least 200ms

      const html = await response.text();
      expect(html).toContain('Very Slow Page');
    }, 5000); // Longer timeout for slow test
  });

  describe('Custom Scenarios', () => {
    it('should support adding custom scenarios', async () => {
      server.addScenario({
        name: 'custom-test',
        path: '/custom',
        statusCode: 200,
        body: '<h1>Custom Content</h1>'
      });

      const response = await fetch(`${server.baseUrl}/custom`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toBe('<h1>Custom Content</h1>');
    });

    it('should support removing scenarios', async () => {
      server.addScenario({
        name: 'temp-scenario',
        path: '/temp',
        body: 'Temporary content'
      });

      // Verify it exists
      let response = await fetch(`${server.baseUrl}/temp`);
      expect(response.status).toBe(200);

      // Remove and verify it's gone
      server.removeScenario('/temp');
      response = await fetch(`${server.baseUrl}/temp`);
      expect(response.status).toBe(404);
    });

    it('should support dynamic body generation', async () => {
      const startTime = Date.now();

      server.addScenario({
        name: 'dynamic-test',
        path: '/dynamic',
        body: () => `Generated at ${Date.now()}`
      });

      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

      const response = await fetch(`${server.baseUrl}/dynamic`);
      const body = await response.text();

      const timestamp = parseInt(body.replace('Generated at ', ''));
      expect(timestamp).toBeGreaterThan(startTime);
    });

    it('should list all scenarios', async () => {
      const scenarios = server.getScenarios();
      expect(scenarios.length).toBeGreaterThan(10); // Should have default scenarios

      const scenarioNames = scenarios.map(s => s.name);
      expect(scenarioNames).toContain('home');
      expect(scenarioNames).toContain('page1');
      expect(scenarioNames).toContain('server-error');
      expect(scenarioNames).toContain('slow-response');
    });
  });

  describe('CORS Support', () => {
    it('should include CORS headers', async () => {
      const response = await fetch(`${server.baseUrl}/`);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    });

    it('should handle OPTIONS requests', async () => {
      const response = await fetch(`${server.baseUrl}/`, {
        method: 'OPTIONS'
      });
      expect(response.status).toBe(200);
    });
  });
});

describe('MockServerLifecycle', () => {
  beforeAll(async () => {
    // Ensure clean state
    await MockServerLifecycle.stopAll();
  });

  afterAll(async () => {
    // Clean up after tests
    await MockServerLifecycle.stopAll();
  });

  it('should manage named server instances', async () => {
    // Start server
    const server1 = await MockServerLifecycle.startForTest('test-server-1');
    expect(server1.isRunning).toBe(true);

    // Get by name
    const retrieved = MockServerLifecycle.getInstance('test-server-1');
    expect(retrieved).toBe(server1);

    // List instances
    const names = MockServerLifecycle.getInstanceNames();
    expect(names).toContain('test-server-1');

    // Stop by name
    await MockServerLifecycle.stopForTest('test-server-1');
    expect(server1.isRunning).toBe(false);
  });

  it('should prevent duplicate named instances', async () => {
    await MockServerLifecycle.startForTest('duplicate-test');

    await expect(async () => {
      await MockServerLifecycle.startForTest('duplicate-test');
    }).rejects.toThrow('already running');

    await MockServerLifecycle.stopForTest('duplicate-test');
  });

  it('should handle multiple server instances', async () => {
    const server1 = await MockServerLifecycle.startForTest('multi-1');
    const server2 = await MockServerLifecycle.startForTest('multi-2');

    expect(server1.port).not.toBe(server2.port);

    const names = MockServerLifecycle.getInstanceNames();
    expect(names).toContain('multi-1');
    expect(names).toContain('multi-2');

    // Stop all
    await MockServerLifecycle.stopAll();

    expect(server1.isRunning).toBe(false);
    expect(server2.isRunning).toBe(false);
    expect(MockServerLifecycle.getInstanceNames()).toHaveLength(0);
  });

  it('should gracefully handle stopping nonexistent servers', async () => {
    // Should not throw
    await MockServerLifecycle.stopForTest('nonexistent');

    expect(MockServerLifecycle.getInstance('nonexistent')).toBeUndefined();
  });
});

describe('Integration with Page Navigation Tests', () => {
  let mockServer: MockNavigationServer;

  beforeAll(async () => {
    mockServer = await MockServerLifecycle.startForTest('integration-tests');
  });

  afterAll(async () => {
    await MockServerLifecycle.stopForTest('integration-tests');
  });

  it('should provide baseUrl for navigation testing', () => {
    expect(mockServer.baseUrl).toMatch(/^http:\/\/localhost:\d+$/);
    expect(mockServer.port).toBeGreaterThan(0);
  });

  it('should serve pages compatible with navigation testing', async () => {
    // Test home page structure
    const homeResponse = await fetch(`${mockServer.baseUrl}/`);
    const homeHtml = await homeResponse.text();

    expect(homeHtml).toContain('<title>Navigation Test Home</title>');
    expect(homeHtml).toContain('id="current-url"');
    expect(homeHtml).toContain('href="/page1"');

    // Test page structure
    const pageResponse = await fetch(`${mockServer.baseUrl}/page1`);
    const pageHtml = await pageResponse.text();

    expect(pageHtml).toContain('<title>Navigation Test - Page 1</title>');
    expect(pageHtml).toContain('onclick="history.back()"');
    expect(pageHtml).toContain('onclick="location.reload()"');
  });

  it('should be compatible with existing test patterns', async () => {
    const baseUrl = mockServer.baseUrl;

    // Simulate existing test pattern
    const response = await fetch(`${baseUrl}/page1`);
    expect(response.status).toBe(200);

    const title = response.headers.get('content-type');
    expect(title).toBe('text/html');
  });
});