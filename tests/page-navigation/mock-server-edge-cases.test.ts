/**
 * @fileoverview Edge Cases and Integration Tests for Enhanced Mock Server
 *
 * This test suite covers edge cases, error conditions, and integration scenarios
 * that might occur in real-world usage of the enhanced mock server.
 *
 * Test categories:
 * - Error handling and recovery
 * - Concurrent usage scenarios
 * - Resource cleanup and memory leaks
 * - Performance under load
 * - Browser automation integration
 * - Timeout and connection handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockNavigationServer, MockServerLifecycle, createMockNavigationServer } from './mock-server';
import type { MockServerOptions, NavigationScenario } from './mock-server';

describe('Enhanced Mock Server - Edge Cases and Integration', () => {

  describe('Error Handling and Recovery', () => {
    let mockServer: MockNavigationServer;

    afterEach(async () => {
      if (mockServer && mockServer.isRunning) {
        await mockServer.stop();
      }
    });

    it('should handle port conflicts gracefully', async () => {
      const fixedPort = 9876;

      // Start first server on fixed port
      const server1 = new MockNavigationServer({ port: fixedPort });
      await server1.start();

      // Second server should fail with meaningful error
      const server2 = new MockNavigationServer({ port: fixedPort });
      await expect(server2.start()).rejects.toThrow();

      await server1.stop();
    });

    it('should recover from server startup failures', async () => {
      // Create server with invalid configuration
      mockServer = new MockNavigationServer({
        host: 'invalid-host-name-that-does-not-exist'
      });

      // Should fail to start
      await expect(mockServer.start()).rejects.toThrow();

      // Server should remain in stopped state
      expect(mockServer.isRunning).toBe(false);

      // Should be able to reconfigure and start again
      mockServer = new MockNavigationServer({ host: 'localhost' });
      await mockServer.start();
      expect(mockServer.isRunning).toBe(true);
    });

    it('should handle scenario configuration errors gracefully', async () => {
      mockServer = new MockNavigationServer();
      await mockServer.start();

      // Add scenario with invalid status code
      mockServer.addScenario({
        name: 'invalid-status',
        path: '/invalid-status',
        statusCode: 999, // Invalid status code
        body: 'Test content'
      });

      // Server should still respond (browser may interpret as generic error)
      const response = await fetch(`${mockServer.baseUrl}/invalid-status`);
      expect(response.status).toBe(999); // Should pass through as-is
    });

    it('should handle malformed request paths', async () => {
      mockServer = new MockNavigationServer();
      await mockServer.start();

      // Test various malformed paths
      const malformedPaths = [
        '//',
        '/../',
        '/./.',
        '/path with spaces',
        '/path%20with%20encoded%20spaces',
        '/path?query=value&another=test'
      ];

      for (const path of malformedPaths) {
        const response = await fetch(`${mockServer.baseUrl}${path}`);
        // Should get some valid HTTP response (likely 404 or 200)
        expect(response.status).toBeGreaterThan(0);
        expect(response.status).toBeLessThan(600);
      }
    });

    it('should handle concurrent request bursts', async () => {
      mockServer = new MockNavigationServer({
        baseDelay: 10 // Small delay to test concurrent handling
      });
      await mockServer.start();

      // Create multiple concurrent requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        fetch(`${mockServer.baseUrl}/page${(i % 3) + 1}`)
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Concurrent Server Management', () => {
    afterEach(async () => {
      await MockServerLifecycle.stopAll();
    });

    it('should handle multiple servers with different configurations', async () => {
      const servers = await Promise.all([
        MockServerLifecycle.startForTest('fast-server', { baseDelay: 10 }),
        MockServerLifecycle.startForTest('slow-server', { baseDelay: 200 }),
        MockServerLifecycle.startForTest('verbose-server', { verbose: true }),
      ]);

      // All servers should be running on different ports
      const ports = servers.map(s => s.port);
      expect(new Set(ports).size).toBe(3); // All unique ports

      // Each server should respond according to its configuration
      const fastResponse = await fetch(`${servers[0].baseUrl}/slow`);
      const slowResponse = fetch(`${servers[1].baseUrl}/slow`);

      expect(fastResponse.status).toBe(200);

      // Verify slow server actually takes longer
      const slowStartTime = Date.now();
      const slowResult = await slowResponse;
      const slowDuration = Date.now() - slowStartTime;

      expect(slowResult.status).toBe(200);
      expect(slowDuration).toBeGreaterThan(150);
    }, 10000);

    it('should handle rapid server creation and destruction', async () => {
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const serverName = `rapid-test-${i}`;

        // Start server
        const server = await MockServerLifecycle.startForTest(serverName);
        expect(server.isRunning).toBe(true);

        // Quick test
        const response = await fetch(`${server.baseUrl}/`);
        expect(response.status).toBe(200);

        // Stop server
        await MockServerLifecycle.stopForTest(serverName);
        expect(server.isRunning).toBe(false);
      }

      // Should have no running instances
      expect(MockServerLifecycle.getInstanceNames()).toHaveLength(0);
    });

    it('should isolate scenarios between different server instances', async () => {
      const server1 = await MockServerLifecycle.startForTest('server-1');
      const server2 = await MockServerLifecycle.startForTest('server-2');

      // Add different scenarios to each server
      server1.addScenario({
        name: 'server-1-only',
        path: '/unique-1',
        body: 'Server 1 content'
      });

      server2.addScenario({
        name: 'server-2-only',
        path: '/unique-2',
        body: 'Server 2 content'
      });

      // Scenarios should be isolated
      const server1Response1 = await fetch(`${server1.baseUrl}/unique-1`);
      expect(server1Response1.status).toBe(200);
      expect(await server1Response1.text()).toBe('Server 1 content');

      const server1Response2 = await fetch(`${server1.baseUrl}/unique-2`);
      expect(server1Response2.status).toBe(404);

      const server2Response1 = await fetch(`${server2.baseUrl}/unique-1`);
      expect(server2Response1.status).toBe(404);

      const server2Response2 = await fetch(`${server2.baseUrl}/unique-2`);
      expect(server2Response2.status).toBe(200);
      expect(await server2Response2.text()).toBe('Server 2 content');
    });
  });

  describe('Performance and Resource Management', () => {
    let mockServer: MockNavigationServer;

    afterEach(async () => {
      if (mockServer && mockServer.isRunning) {
        await mockServer.stop();
      }
    });

    it('should handle high-frequency requests without memory leaks', async () => {
      mockServer = new MockNavigationServer();
      await mockServer.start();

      const initialMemory = process.memoryUsage().heapUsed;

      // Make many requests quickly
      const requestBatches = Array.from({ length: 5 }, () =>
        Promise.all(
          Array.from({ length: 20 }, () => fetch(`${mockServer.baseUrl}/`))
        )
      );

      const results = await Promise.all(requestBatches);

      // All requests should succeed
      for (const batch of results) {
        for (const response of batch) {
          expect(response.status).toBe(200);
        }
      }

      // Memory should not have grown excessively
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Allow for reasonable memory growth (10MB threshold)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle scenarios with large response bodies efficiently', async () => {
      mockServer = new MockNavigationServer();
      await mockServer.start();

      // Create scenario with large response body
      const largeContent = 'x'.repeat(1024 * 100); // 100KB
      mockServer.addScenario({
        name: 'large-response',
        path: '/large',
        body: largeContent
      });

      const startTime = Date.now();
      const response = await fetch(`${mockServer.baseUrl}/large`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);

      const content = await response.text();
      expect(content.length).toBe(largeContent.length);
      expect(content).toBe(largeContent);

      // Should respond reasonably quickly despite large size
      expect(responseTime).toBeLessThan(1000);
    });

    it('should support dynamic scenario generation under load', async () => {
      mockServer = new MockNavigationServer();
      await mockServer.start();

      // Add scenarios with dynamic content generation
      let generationCount = 0;
      mockServer.addScenario({
        name: 'dynamic-load-test',
        path: '/dynamic-load',
        body: () => {
          generationCount++;
          return `Generated ${generationCount} at ${Date.now()}`;
        }
      });

      // Make multiple concurrent requests
      const requests = Array.from({ length: 50 }, () =>
        fetch(`${mockServer.baseUrl}/dynamic-load`)
      );

      const responses = await Promise.all(requests);

      // All should succeed with unique content
      const contents = await Promise.all(responses.map(r => r.text()));
      const uniqueContents = new Set(contents);

      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(uniqueContents.size).toBe(50); // All responses should be unique
      expect(generationCount).toBe(50);
    });
  });

  describe('Browser Automation Integration', () => {
    let mockServer: MockNavigationServer;

    beforeEach(async () => {
      mockServer = new MockNavigationServer({
        verbose: false,
        baseDelay: 50
      });
      await mockServer.start();
    });

    afterEach(async () => {
      if (mockServer && mockServer.isRunning) {
        await mockServer.stop();
      }
    });

    it('should serve pages with browser-compatible HTML structure', async () => {
      const response = await fetch(`${mockServer.baseUrl}/page1`);
      const html = await response.text();

      // Check for essential HTML structure
      expect(html).toMatch(/<!DOCTYPE html>/i);
      expect(html).toContain('<html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');

      // Check for navigation-specific elements
      expect(html).toContain('<title>');
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain('id="current-url"');
      expect(html).toContain('onclick="history.back()"');
    });

    it('should include JavaScript for browser navigation testing', async () => {
      const response = await fetch(`${mockServer.baseUrl}/page1`);
      const html = await response.text();

      // Should contain JavaScript for navigation testing
      expect(html).toContain('<script>');
      expect(html).toContain('window.navigationTestHistory');
      expect(html).toContain('console.log(');
      expect(html).toContain('document.getElementById(');
    });

    it('should provide pages with testable elements and IDs', async () => {
      const response = await fetch(`${mockServer.baseUrl}/page2`);
      const html = await response.text();

      // Should contain elements with predictable IDs for testing
      const expectedIds = [
        'current-url',
        'page-title',
        'history-length',
        'timestamp',
        'test-data'
      ];

      for (const id of expectedIds) {
        expect(html).toContain(`id="${id}"`);
      }

      // Should contain data attributes for test automation
      expect(html).toContain('data-page="Page 2"');
      expect(html).toContain('data-next="/page3"');
    });

    it('should support cross-origin requests for automation testing', async () => {
      // Test CORS headers are properly set
      const response = await fetch(`${mockServer.baseUrl}/api/data`);

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
      expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');

      // Should handle preflight OPTIONS request
      const optionsResponse = await fetch(`${mockServer.baseUrl}/api/data`, {
        method: 'OPTIONS'
      });
      expect(optionsResponse.status).toBe(200);
    });
  });

  describe('Timeout and Connection Handling', () => {
    let mockServer: MockNavigationServer;

    afterEach(async () => {
      if (mockServer && mockServer.isRunning) {
        await mockServer.stop();
      }
    });

    it('should handle requests during server shutdown gracefully', async () => {
      mockServer = new MockNavigationServer();
      await mockServer.start();

      // Start a request
      const requestPromise = fetch(`${mockServer.baseUrl}/`);

      // Stop server immediately (before request completes)
      await mockServer.stop();

      // Request may succeed or fail, but should not hang
      try {
        const response = await requestPromise;
        // If it succeeds, it should be valid
        expect(response.status).toBeGreaterThan(0);
      } catch (error) {
        // If it fails, that's also acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle timeout scenarios appropriately', async () => {
      mockServer = new MockNavigationServer({
        baseDelay: 100
      });
      await mockServer.start();

      // Add scenario with very long delay
      mockServer.addScenario({
        name: 'timeout-test',
        path: '/timeout-test',
        delay: 3000, // 3 second delay
        body: 'Eventually loaded content'
      });

      // Create request with shorter timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 500);

      try {
        await fetch(`${mockServer.baseUrl}/timeout-test`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        // Should not reach here due to timeout
        expect(true).toBe(false);
      } catch (error) {
        clearTimeout(timeoutId);
        expect(error.name).toBe('AbortError');
      }
    }, 5000);

    it('should continue serving other requests during slow responses', async () => {
      mockServer = new MockNavigationServer();
      await mockServer.start();

      // Start slow request
      const slowRequest = fetch(`${mockServer.baseUrl}/very-slow`);

      // Make fast request while slow one is processing
      const fastResponse = await fetch(`${mockServer.baseUrl}/`);

      expect(fastResponse.status).toBe(200);

      // Slow request should still complete
      const slowResponse = await slowRequest;
      expect(slowResponse.status).toBe(200);
    }, 10000);
  });

  describe('Configuration and Customization', () => {
    let mockServer: MockNavigationServer;

    afterEach(async () => {
      if (mockServer && mockServer.isRunning) {
        await mockServer.stop();
      }
    });

    it('should support custom host configuration', async () => {
      mockServer = new MockNavigationServer({
        host: '127.0.0.1' // Different from default localhost
      });
      await mockServer.start();

      expect(mockServer.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

      const response = await fetch(`${mockServer.baseUrl}/`);
      expect(response.status).toBe(200);
    });

    it('should support verbose logging configuration', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      mockServer = new MockNavigationServer({
        verbose: true
      });
      await mockServer.start();

      // Should have logged server start
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mock navigation server started')
      );

      // Make request to trigger logging
      await fetch(`${mockServer.baseUrl}/`);

      // Should have logged request
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GET /')
      );

      consoleSpy.mockRestore();
    });

    it('should support custom base delay configuration', async () => {
      const customDelay = 250;
      mockServer = new MockNavigationServer({
        baseDelay: customDelay
      });
      await mockServer.start();

      const startTime = Date.now();
      const response = await fetch(`${mockServer.baseUrl}/slow`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeGreaterThan(customDelay - 50); // Allow tolerance
    }, 5000);

    it('should support factory function for quick setup', async () => {
      mockServer = await createMockNavigationServer({
        verbose: false,
        baseDelay: 50
      });

      // Should be running and accessible
      expect(mockServer.isRunning).toBe(true);
      expect(mockServer.port).toBeGreaterThan(0);

      const response = await fetch(`${mockServer.baseUrl}/`);
      expect(response.status).toBe(200);
    });
  });
});