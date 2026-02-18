/**
 * @fileoverview Acceptance Criteria Validation Tests for Enhanced Mock Server
 *
 * This test suite validates that the enhanced mock server implementation fully meets
 * the specified acceptance criteria:
 *
 * 1. Mock server can be started and stopped programmatically
 * 2. Test pages are served at predictable URLs
 * 3. Server integrates with test lifecycle (beforeAll/afterAll)
 * 4. Server supports multiple navigation scenarios (redirects, errors, slow responses)
 *
 * This comprehensive test ensures the implementation satisfies all requirements
 * and provides reliable foundation for controlled navigation scenarios.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { MockNavigationServer, MockServerLifecycle } from './mock-server';
import type { NavigationScenario } from './mock-server';

describe('Enhanced Mock Server - Acceptance Criteria Validation', () => {

  describe('REQUIREMENT 1: Programmatic Start/Stop Control', () => {
    let mockServer: MockNavigationServer;

    afterEach(async () => {
      if (mockServer && mockServer.isRunning) {
        await mockServer.stop();
      }
    });

    it('should start server programmatically without errors', async () => {
      mockServer = new MockNavigationServer({
        verbose: false,
        baseDelay: 50 // Fast for testing
      });

      expect(mockServer.isRunning).toBe(false);

      // Should start successfully
      await expect(mockServer.start()).resolves.toBeUndefined();

      // Should be running after start
      expect(mockServer.isRunning).toBe(true);
      expect(mockServer.port).toBeGreaterThan(0);
      expect(mockServer.baseUrl).toMatch(/^http:\/\/localhost:\d+$/);
    });

    it('should stop server programmatically without errors', async () => {
      mockServer = new MockNavigationServer();
      await mockServer.start();

      expect(mockServer.isRunning).toBe(true);

      // Should stop successfully
      await expect(mockServer.stop()).resolves.toBeUndefined();

      // Should not be running after stop
      expect(mockServer.isRunning).toBe(false);
    });

    it('should provide stable port assignment during lifecycle', async () => {
      mockServer = new MockNavigationServer();
      await mockServer.start();

      const initialPort = mockServer.port;
      const initialUrl = mockServer.baseUrl;

      // Port and URL should remain stable while running
      expect(mockServer.port).toBe(initialPort);
      expect(mockServer.baseUrl).toBe(initialUrl);

      await mockServer.stop();

      // After restart, should get new port assignment
      await mockServer.start();
      expect(mockServer.port).toBeGreaterThan(0);
      expect(mockServer.baseUrl).toMatch(/^http:\/\/localhost:\d+$/);
    });

    it('should handle rapid start/stop cycles gracefully', async () => {
      mockServer = new MockNavigationServer();

      // Perform multiple start/stop cycles
      for (let i = 0; i < 3; i++) {
        await mockServer.start();
        expect(mockServer.isRunning).toBe(true);

        await mockServer.stop();
        expect(mockServer.isRunning).toBe(false);
      }
    });

    it('should prevent duplicate start operations', async () => {
      mockServer = new MockNavigationServer();
      await mockServer.start();

      // Second start should fail
      await expect(mockServer.start()).rejects.toThrow('already running');

      // Should still be running after failed start attempt
      expect(mockServer.isRunning).toBe(true);
    });

    it('should handle stop when already stopped gracefully', async () => {
      mockServer = new MockNavigationServer();

      // Stop when not running should not throw
      await expect(mockServer.stop()).resolves.toBeUndefined();
      expect(mockServer.isRunning).toBe(false);
    });
  });

  describe('REQUIREMENT 2: Predictable URL Serving', () => {
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

    it('should serve home page at predictable URL "/"', async () => {
      const response = await fetch(`${mockServer.baseUrl}/`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');

      const html = await response.text();
      expect(html).toContain('Navigation Test Home');
      expect(html).toContain('<title>Navigation Test Home</title>');
    });

    it('should serve test pages at predictable URLs', async () => {
      const testPages = [
        { path: '/page1', expectedTitle: 'Navigation Test - Page 1' },
        { path: '/page2', expectedTitle: 'Navigation Test - Page 2' },
        { path: '/page3', expectedTitle: 'Navigation Test - Page 3' },
      ];

      for (const page of testPages) {
        const response = await fetch(`${mockServer.baseUrl}${page.path}`);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('text/html');

        const html = await response.text();
        expect(html).toContain(`<title>${page.expectedTitle}</title>`);
      }
    });

    it('should serve error pages at predictable URLs', async () => {
      const errorPages = [
        { path: '/error', expectedStatus: 500, expectedContent: '500 Server Error' },
        { path: '/404', expectedStatus: 404, expectedContent: '404 Not Found' },
        { path: '/forbidden', expectedStatus: 403, expectedContent: '403 Forbidden' },
      ];

      for (const page of errorPages) {
        const response = await fetch(`${mockServer.baseUrl}${page.path}`);

        expect(response.status).toBe(page.expectedStatus);

        const html = await response.text();
        expect(html).toContain(page.expectedContent);
      }
    });

    it('should provide consistent URL structure across all pages', async () => {
      const baseUrl = mockServer.baseUrl;
      const testUrls = ['/', '/page1', '/error', '/slow', '/api/data'];

      for (const path of testUrls) {
        const fullUrl = `${baseUrl}${path}`;

        // URL should be well-formed
        expect(() => new URL(fullUrl)).not.toThrow();

        // URL should be predictable and accessible
        const response = await fetch(fullUrl);
        expect(response.status).toBeGreaterThan(0); // Any valid HTTP status
      }
    });

    it('should maintain URL predictability after server restart', async () => {
      const initialBaseUrl = mockServer.baseUrl;

      // Stop and restart
      await mockServer.stop();
      await mockServer.start();

      const newBaseUrl = mockServer.baseUrl;

      // Port may change, but structure should remain consistent
      expect(newBaseUrl).toMatch(/^http:\/\/localhost:\d+$/);

      // Same paths should still work
      const response = await fetch(`${newBaseUrl}/`);
      expect(response.status).toBe(200);
    });
  });

  describe('REQUIREMENT 3: Test Lifecycle Integration', () => {
    describe('beforeAll/afterAll Integration', () => {
      let lifecycleServer: MockNavigationServer;

      beforeAll(async () => {
        // Server should start successfully in beforeAll
        lifecycleServer = await MockServerLifecycle.startForTest('lifecycle-test', {
          verbose: false,
          baseDelay: 50
        });
      });

      afterAll(async () => {
        // Server should stop successfully in afterAll
        await MockServerLifecycle.stopForTest('lifecycle-test');
      });

      it('should be accessible during test execution', async () => {
        expect(lifecycleServer.isRunning).toBe(true);
        expect(lifecycleServer.port).toBeGreaterThan(0);

        const response = await fetch(`${lifecycleServer.baseUrl}/health`);
        expect(response.status).toBe(200);
      });

      it('should maintain state across multiple test cases', async () => {
        // First test
        const response1 = await fetch(`${lifecycleServer.baseUrl}/`);
        expect(response1.status).toBe(200);

        // Server should still be running and accessible
        const response2 = await fetch(`${lifecycleServer.baseUrl}/page1`);
        expect(response2.status).toBe(200);
      });

      it('should support custom scenarios added during lifecycle', async () => {
        lifecycleServer.addScenario({
          name: 'lifecycle-test-scenario',
          path: '/lifecycle-test',
          statusCode: 200,
          body: 'Lifecycle test content'
        });

        const response = await fetch(`${lifecycleServer.baseUrl}/lifecycle-test`);
        expect(response.status).toBe(200);

        const text = await response.text();
        expect(text).toBe('Lifecycle test content');
      });
    });

    describe('MockServerLifecycle Management', () => {
      afterEach(async () => {
        // Clean up any test servers
        await MockServerLifecycle.stopAll();
      });

      it('should manage multiple named server instances', async () => {
        const server1 = await MockServerLifecycle.startForTest('test-1');
        const server2 = await MockServerLifecycle.startForTest('test-2');

        expect(server1.port).not.toBe(server2.port);

        const instances = MockServerLifecycle.getInstanceNames();
        expect(instances).toContain('test-1');
        expect(instances).toContain('test-2');

        await MockServerLifecycle.stopAll();
        expect(MockServerLifecycle.getInstanceNames()).toHaveLength(0);
      });

      it('should prevent duplicate named instances', async () => {
        await MockServerLifecycle.startForTest('duplicate-name');

        await expect(
          MockServerLifecycle.startForTest('duplicate-name')
        ).rejects.toThrow('already running');
      });

      it('should integrate with Vitest lifecycle hooks', async () => {
        let testServer: MockNavigationServer;

        // Simulate beforeAll hook
        testServer = await MockServerLifecycle.startForTest('vitest-integration');
        expect(testServer.isRunning).toBe(true);

        // Simulate test execution
        const response = await fetch(`${testServer.baseUrl}/`);
        expect(response.status).toBe(200);

        // Simulate afterAll hook
        await MockServerLifecycle.stopForTest('vitest-integration');
        expect(testServer.isRunning).toBe(false);
      });
    });
  });

  describe('REQUIREMENT 4: Multiple Navigation Scenarios Support', () => {
    let mockServer: MockNavigationServer;

    beforeEach(async () => {
      mockServer = new MockNavigationServer({
        verbose: false,
        baseDelay: 100 // Slightly longer for scenario testing
      });
      await mockServer.start();
    });

    afterEach(async () => {
      if (mockServer && mockServer.isRunning) {
        await mockServer.stop();
      }
    });

    describe('Redirect Scenarios', () => {
      it('should support permanent redirects (301)', async () => {
        const response = await fetch(`${mockServer.baseUrl}/redirect-permanent`, {
          redirect: 'manual'
        });

        expect(response.status).toBe(301);
        expect(response.headers.get('location')).toBe('/page1');
      });

      it('should support temporary redirects (302)', async () => {
        const response = await fetch(`${mockServer.baseUrl}/redirect-temp`, {
          redirect: 'manual'
        });

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe('/page1');
      });

      it('should support dynamic redirects with parameters', async () => {
        const targetPath = '/page2';
        const response = await fetch(`${mockServer.baseUrl}/redirect?to=${targetPath}`, {
          redirect: 'manual'
        });

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(targetPath);
      });

      it('should support redirect chains by following through', async () => {
        // Follow redirect automatically
        const response = await fetch(`${mockServer.baseUrl}/redirect-permanent`);

        expect(response.status).toBe(200); // Final page after redirect
        const html = await response.text();
        expect(html).toContain('Navigation Test - Page 1');
      });
    });

    describe('Error Scenarios', () => {
      it('should support 500 internal server errors', async () => {
        const response = await fetch(`${mockServer.baseUrl}/error`);

        expect(response.status).toBe(500);

        const html = await response.text();
        expect(html).toContain('500 Server Error');
        expect(html).toContain('Internal server error for testing');
      });

      it('should support 404 not found errors', async () => {
        const response = await fetch(`${mockServer.baseUrl}/404`);

        expect(response.status).toBe(404);

        const html = await response.text();
        expect(html).toContain('404 Not Found');
        expect(html).toContain('Page not found for testing');
      });

      it('should support 403 forbidden errors', async () => {
        const response = await fetch(`${mockServer.baseUrl}/forbidden`);

        expect(response.status).toBe(403);

        const html = await response.text();
        expect(html).toContain('403 Forbidden');
        expect(html).toContain('Access denied for testing');
      });

      it('should generate 404 for truly nonexistent paths', async () => {
        const response = await fetch(`${mockServer.baseUrl}/completely-nonexistent-path`);

        expect(response.status).toBe(404);

        const html = await response.text();
        expect(html).toContain('404 Page Not Found');
        expect(html).toContain('/completely-nonexistent-path');
      });
    });

    describe('Slow Response Scenarios', () => {
      it('should support configurable slow responses', async () => {
        const startTime = Date.now();

        const response = await fetch(`${mockServer.baseUrl}/slow`);
        const responseTime = Date.now() - startTime;

        expect(response.status).toBe(200);
        expect(responseTime).toBeGreaterThan(80); // Should take at least configured delay

        const html = await response.text();
        expect(html).toContain('Slow Page');
      }, 5000);

      it('should support very slow responses', async () => {
        const startTime = Date.now();

        const response = await fetch(`${mockServer.baseUrl}/very-slow`);
        const responseTime = Date.now() - startTime;

        expect(response.status).toBe(200);
        expect(responseTime).toBeGreaterThan(180); // Should take longer than basic slow

        const html = await response.text();
        expect(html).toContain('Very Slow Page');
      }, 10000);

      it('should support custom delay scenarios', async () => {
        const customDelay = 150;

        mockServer.addScenario({
          name: 'custom-delay',
          path: '/custom-delay',
          delay: customDelay,
          body: 'Custom delay content'
        });

        const startTime = Date.now();
        const response = await fetch(`${mockServer.baseUrl}/custom-delay`);
        const responseTime = Date.now() - startTime;

        expect(response.status).toBe(200);
        expect(responseTime).toBeGreaterThan(customDelay - 20); // Allow some tolerance

        const text = await response.text();
        expect(text).toBe('Custom delay content');
      }, 5000);
    });

    describe('Content Type Scenarios', () => {
      it('should support JSON responses', async () => {
        const response = await fetch(`${mockServer.baseUrl}/api/data`);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('application/json');

        const json = await response.json();
        expect(json.message).toBe('Test API response');
        expect(json.data.test).toBe(true);
        expect(json.timestamp).toBeDefined();
      });

      it('should support empty responses', async () => {
        const response = await fetch(`${mockServer.baseUrl}/empty`);

        expect(response.status).toBe(200);

        const text = await response.text();
        expect(text).toBe('');
      });

      it('should support custom content types', async () => {
        mockServer.addScenario({
          name: 'custom-xml',
          path: '/api/xml',
          contentType: 'application/xml',
          body: '<?xml version="1.0"?><test>data</test>'
        });

        const response = await fetch(`${mockServer.baseUrl}/api/xml`);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('application/xml');

        const xml = await response.text();
        expect(xml).toBe('<?xml version="1.0"?><test>data</test>');
      });
    });

    describe('Advanced Navigation Scenarios', () => {
      it('should support CORS for cross-origin testing', async () => {
        const response = await fetch(`${mockServer.baseUrl}/`);

        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('access-control-allow-methods')).toContain('GET');
        expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
      });

      it('should handle OPTIONS requests for CORS preflight', async () => {
        const response = await fetch(`${mockServer.baseUrl}/page1`, {
          method: 'OPTIONS'
        });

        expect(response.status).toBe(200);
      });

      it('should support dynamic scenario addition and removal', async () => {
        // Add scenario
        mockServer.addScenario({
          name: 'dynamic-scenario',
          path: '/dynamic-test',
          body: 'Dynamic content'
        });

        let response = await fetch(`${mockServer.baseUrl}/dynamic-test`);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('Dynamic content');

        // Remove scenario
        mockServer.removeScenario('/dynamic-test');

        response = await fetch(`${mockServer.baseUrl}/dynamic-test`);
        expect(response.status).toBe(404);
      });

      it('should provide scenario enumeration for testing', async () => {
        const scenarios = mockServer.getScenarios();

        expect(Array.isArray(scenarios)).toBe(true);
        expect(scenarios.length).toBeGreaterThan(10);

        const scenarioNames = scenarios.map(s => s.name);
        expect(scenarioNames).toContain('home');
        expect(scenarioNames).toContain('server-error');
        expect(scenarioNames).toContain('slow-response');
        expect(scenarioNames).toContain('redirect-302');
      });

      it('should support function-based dynamic content generation', async () => {
        let callCount = 0;

        mockServer.addScenario({
          name: 'dynamic-function',
          path: '/dynamic-function',
          body: () => {
            callCount++;
            return `Call number ${callCount} at ${Date.now()}`;
          }
        });

        // Make multiple requests
        const response1 = await fetch(`${mockServer.baseUrl}/dynamic-function`);
        const text1 = await response1.text();
        expect(text1).toContain('Call number 1');

        const response2 = await fetch(`${mockServer.baseUrl}/dynamic-function`);
        const text2 = await response2.text();
        expect(text2).toContain('Call number 2');

        // Content should be different each time
        expect(text1).not.toBe(text2);
      });
    });
  });

  describe('COMPREHENSIVE: All Acceptance Criteria Integration', () => {
    let integrationServer: MockNavigationServer;

    beforeAll(async () => {
      // Test lifecycle integration
      integrationServer = await MockServerLifecycle.startForTest('comprehensive-test', {
        verbose: false,
        baseDelay: 50
      });
    });

    afterAll(async () => {
      // Test lifecycle integration
      await MockServerLifecycle.stopForTest('comprehensive-test');
    });

    it('should satisfy all acceptance criteria simultaneously', async () => {
      // CRITERIA 1: Programmatic control
      expect(integrationServer.isRunning).toBe(true);
      expect(integrationServer.port).toBeGreaterThan(0);

      // CRITERIA 2: Predictable URLs
      const baseUrl = integrationServer.baseUrl;
      expect(baseUrl).toMatch(/^http:\/\/localhost:\d+$/);

      // Test multiple predictable URLs
      const urlTests = [
        { path: '/', expectedStatus: 200 },
        { path: '/page1', expectedStatus: 200 },
        { path: '/error', expectedStatus: 500 },
        { path: '/404', expectedStatus: 404 },
      ];

      for (const test of urlTests) {
        const response = await fetch(`${baseUrl}${test.path}`);
        expect(response.status).toBe(test.expectedStatus);
      }

      // CRITERIA 3: Lifecycle integration (verified by beforeAll/afterAll)
      expect(MockServerLifecycle.getInstance('comprehensive-test')).toBe(integrationServer);

      // CRITERIA 4: Multiple navigation scenarios

      // Redirect scenario
      const redirectResponse = await fetch(`${baseUrl}/redirect-temp`, {
        redirect: 'manual'
      });
      expect(redirectResponse.status).toBe(302);

      // Slow response scenario
      const slowStartTime = Date.now();
      const slowResponse = await fetch(`${baseUrl}/slow`);
      const slowResponseTime = Date.now() - slowStartTime;
      expect(slowResponse.status).toBe(200);
      expect(slowResponseTime).toBeGreaterThan(40);

      // JSON content scenario
      const jsonResponse = await fetch(`${baseUrl}/api/data`);
      expect(jsonResponse.status).toBe(200);
      expect(jsonResponse.headers.get('content-type')).toBe('application/json');

      const jsonData = await jsonResponse.json();
      expect(jsonData.message).toBe('Test API response');

      console.log('✅ All acceptance criteria validated successfully');
      console.log('🎯 Enhanced Mock Server Implementation Status:');
      console.log('  ✅ Programmatic start/stop control: PASSED');
      console.log('  ✅ Predictable URL serving: PASSED');
      console.log('  ✅ Test lifecycle integration: PASSED');
      console.log('  ✅ Multiple navigation scenarios: PASSED');
      console.log('🚀 Enhanced Mock Server ready for controlled navigation testing!');
    }, 10000);
  });
});