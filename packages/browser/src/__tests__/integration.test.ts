/**
 * @apexcli/browser - Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  launchBrowser,
  BrowserManager,
  BrowserSession,
} from '../index.js';

describe('Browser Integration Tests', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = createBrowserManager();
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Factory Functions', () => {
    it('should create browser manager with factory function', () => {
      const testManager = createBrowserManager({
        maxInstances: 2,
        reuseInstances: false,
      });

      expect(testManager).toBeInstanceOf(BrowserManager);
    });

    it('should create browser session with factory function', () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });

      expect(session).toBeInstanceOf(BrowserSession);
    });

    it('should launch browser with utility function', async () => {
      const result = await launchBrowser({
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(BrowserSession);

      if (result.data) {
        await result.data.close();
      }
    }, 10000); // Increase timeout for browser launch
  });

  describe('End-to-End Workflow', () => {
    it('should complete a full browser automation workflow', async () => {
      // Create and launch session
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });

      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);

      // Navigate to a test page
      const navResult = await session.navigate('data:text/html,<h1 id="title">Test Page</h1><button id="btn">Click Me</button>');
      expect(navResult.success).toBe(true);

      // Get page title
      const titleResult = await session.getTitle();
      expect(titleResult.success).toBe(true);

      // Get text content
      const textResult = await session.getText('#title');
      expect(textResult.success).toBe(true);
      expect(textResult.data).toBe('Test Page');

      // Take a screenshot
      const screenshotResult = await session.screenshot();
      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.data).toBeInstanceOf(Buffer);

      // Click the button
      const clickResult = await session.click('#btn');
      expect(clickResult.success).toBe(true);

      // Evaluate JavaScript
      const evalResult = await session.evaluate(() => {
        return document.querySelectorAll('*').length;
      });
      expect(evalResult.success).toBe(true);
      expect(typeof evalResult.data).toBe('number');

      // Clean up
      await session.close();
    }, 15000);
  });

  describe('Multiple Session Management', () => {
    it('should handle multiple concurrent sessions', async () => {
      const sessions: BrowserSession[] = [];

      try {
        // Create multiple sessions
        for (let i = 0; i < 3; i++) {
          const session = createBrowserSession(manager, {
            browserType: 'chromium',
            headless: true,
          });

          const result = await session.launch();
          expect(result.success).toBe(true);
          sessions.push(session);
        }

        // Use all sessions
        const promises = sessions.map((session, index) =>
          session.navigate(`data:text/html,<h1>Session ${index}</h1>`)
        );

        const results = await Promise.all(promises);
        results.forEach(result => expect(result.success).toBe(true));

        // Check resource usage
        const usage = await manager.getResourceUsage();
        expect(usage.totalInstances).toBeGreaterThan(0);
        expect(usage.totalContexts).toBe(3);

      } finally {
        // Clean up all sessions
        await Promise.all(sessions.map(session => session.close()));
      }
    }, 20000);
  });

  describe('Error Recovery', () => {
    it('should handle session failures gracefully', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });

      // Try to use session before launch - should fail
      const navResult = await session.navigate('https://example.com');
      expect(navResult.success).toBe(false);

      // Launch and use properly
      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);

      const navResult2 = await session.navigate('data:text/html,<h1>Success</h1>');
      expect(navResult2.success).toBe(true);

      await session.close();
    });
  });

  describe('Resource Management', () => {
    it('should track and cleanup resources properly', async () => {
      // Check initial state
      let usage = await manager.getResourceUsage();
      expect(usage.totalInstances).toBe(0);
      expect(usage.totalContexts).toBe(0);

      // Create session and check resource usage
      const session = createBrowserSession(manager);
      await session.launch();

      usage = await manager.getResourceUsage();
      expect(usage.totalInstances).toBe(1);
      expect(usage.totalContexts).toBe(1);

      // Close session and check cleanup
      await session.close();

      usage = await manager.getResourceUsage();
      expect(usage.totalContexts).toBe(0);
      // Instance might still exist if reuse is enabled
    });

    it('should handle resource monitoring across session lifecycle', async () => {
      const sessions: BrowserSession[] = [];

      try {
        // Create sessions with different browser types
        for (const browserType of ['chromium', 'firefox'] as const) {
          const session = createBrowserSession(manager, {
            browserType,
            headless: true
          });
          await session.launch();
          sessions.push(session);
        }

        // Check resource usage
        const usage = await manager.getResourceUsage();
        expect(usage.totalInstances).toBeGreaterThanOrEqual(2);
        expect(usage.totalContexts).toBe(2);
        expect(usage.memoryUsageMB).toBeGreaterThan(0);

        // Verify active tracking
        expect(usage.activeBrowsers).toBe(2);

      } finally {
        // Cleanup
        await Promise.all(sessions.map(session => session.close()));
      }
    });
  });

  describe('Advanced Browser Lifecycle Scenarios', () => {
    it('should handle cross-browser automation workflow', async () => {
      const browsers = ['chromium', 'firefox', 'webkit'] as const;
      const sessions: BrowserSession[] = [];

      try {
        // Launch different browser types
        for (const browserType of browsers) {
          const session = createBrowserSession(manager, {
            browserType,
            headless: true
          });
          const result = await session.launch();
          expect(result.success).toBe(true);
          sessions.push(session);
        }

        // Perform operations on all browsers
        const results = await Promise.all(
          sessions.map(session =>
            session.navigate('data:text/html,<h1>Test Page</h1>')
          )
        );

        results.forEach(result => {
          expect(result.success).toBe(true);
        });

        // Take screenshots from all browsers
        const screenshots = await Promise.all(
          sessions.map(session => session.screenshot())
        );

        screenshots.forEach(screenshot => {
          expect(screenshot.success).toBe(true);
          expect(screenshot.data).toBeInstanceOf(Buffer);
        });

      } finally {
        await Promise.all(sessions.map(session => session.close()));
      }
    }, 30000);

    it('should handle browser recovery and retry scenarios', async () => {
      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true
      });

      // Launch session
      let result = await session.launch();
      expect(result.success).toBe(true);

      // Navigate to test page
      result = await session.navigate('data:text/html,<h1>Initial Page</h1>');
      expect(result.success).toBe(true);

      // Simulate browser disconnect by closing the underlying browser
      const browser = session.getBrowser();
      if (browser) {
        await browser.close();
      }

      // Subsequent operations should fail gracefully
      result = await session.navigate('data:text/html,<h1>After Crash</h1>');
      expect(result.success).toBe(false);

      // Close should still work
      result = await session.close();
      expect(result.success).toBe(true);
    });

    it('should handle session reuse and instance pooling', async () => {
      const poolManager = createBrowserManager({ reuseInstances: true });

      try {
        const sessions: BrowserSession[] = [];

        // Create multiple sessions sequentially
        for (let i = 0; i < 3; i++) {
          const session = createBrowserSession(poolManager, {
            browserType: 'chromium',
            headless: true
          });
          await session.launch();
          sessions.push(session);
        }

        // Should have multiple contexts but potentially reuse browser instances
        const usage = await poolManager.getResourceUsage();
        expect(usage.totalContexts).toBe(3);
        expect(usage.totalInstances).toBeGreaterThanOrEqual(1); // Could reuse instances

        // Close first session
        await sessions[0].close();

        // Launch new session - might reuse instance
        const newSession = createBrowserSession(poolManager, {
          browserType: 'chromium',
          headless: true
        });
        await newSession.launch();
        sessions.push(newSession);

        // Clean up
        await Promise.all(sessions.slice(1).map(session => session.close()));

      } finally {
        await poolManager.shutdown();
      }
    });

    it('should handle high-frequency session creation and destruction', async () => {
      const iterations = 10;
      const results: boolean[] = [];

      for (let i = 0; i < iterations; i++) {
        const session = createBrowserSession(manager, {
          browserType: 'chromium',
          headless: true
        });

        const launchResult = await session.launch();
        results.push(launchResult.success);

        if (launchResult.success) {
          const navResult = await session.navigate(`data:text/html,<h1>Iteration ${i}</h1>`);
          results.push(navResult.success);

          const closeResult = await session.close();
          results.push(closeResult.success);
        }
      }

      // All operations should succeed
      expect(results.every(r => r)).toBe(true);

      // Resources should be cleaned up
      const usage = await manager.getResourceUsage();
      expect(usage.totalContexts).toBe(0);
    }, 60000);

    it('should handle session isolation and context separation', async () => {
      const session1 = createBrowserSession(manager, { browserType: 'chromium' });
      const session2 = createBrowserSession(manager, { browserType: 'chromium' });

      try {
        await session1.launch();
        await session2.launch();

        // Navigate to different pages
        await session1.navigate('data:text/html,<script>window.testValue = "session1";</script>');
        await session2.navigate('data:text/html,<script>window.testValue = "session2";</script>');

        // Verify isolation - each session should have its own value
        const result1 = await session1.evaluate(() => (window as any).testValue);
        const result2 = await session2.evaluate(() => (window as any).testValue);

        expect(result1.data).toBe('session1');
        expect(result2.data).toBe('session2');

      } finally {
        await Promise.all([session1.close(), session2.close()]);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle cascading failures gracefully', async () => {
      const sessions: BrowserSession[] = [];

      try {
        // Create multiple sessions
        for (let i = 0; i < 3; i++) {
          const session = createBrowserSession(manager);
          const result = await session.launch();
          expect(result.success).toBe(true);
          sessions.push(session);
        }

        // Force failure in one session by closing browser directly
        const browser = sessions[0].getBrowser();
        if (browser) {
          await browser.close();
        }

        // Other sessions should continue to work
        const results = await Promise.all(
          sessions.slice(1).map(session =>
            session.navigate('data:text/html,<h1>Still Working</h1>')
          )
        );

        results.forEach(result => {
          expect(result.success).toBe(true);
        });

      } finally {
        // Cleanup should handle both working and failed sessions
        await Promise.allSettled(sessions.map(session => session.close()));
      }
    });

    it('should handle manager shutdown during active sessions', async () => {
      const testManager = createBrowserManager();
      const session = createBrowserSession(testManager);

      try {
        await session.launch();
        await session.navigate('data:text/html,<h1>Active Session</h1>');

        // Shutdown manager while session is active
        await testManager.shutdown();

        // Session operations should fail gracefully after manager shutdown
        const result = await session.navigate('data:text/html,<h1>After Shutdown</h1>');
        expect(result.success).toBe(false);

      } finally {
        // Cleanup should be safe even after manager shutdown
        await session.close();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should maintain performance under moderate load', async () => {
      const concurrentSessions = 5;
      const sessionsPerBatch = 3;
      const batches: Promise<any>[] = [];

      for (let batch = 0; batch < concurrentSessions / sessionsPerBatch; batch++) {
        const batchPromise = Promise.all(
          Array.from({ length: sessionsPerBatch }, async (_, index) => {
            const session = createBrowserSession(manager, {
              browserType: 'chromium',
              headless: true
            });

            try {
              const startTime = Date.now();

              await session.launch();
              await session.navigate(`data:text/html,<h1>Batch ${batch} Session ${index}</h1>`);
              await session.screenshot();

              const duration = Date.now() - startTime;

              // Operations should complete within reasonable time
              expect(duration).toBeLessThan(10000); // 10 seconds

              return { success: true, duration };

            } finally {
              await session.close();
            }
          })
        );

        batches.push(batchPromise);
      }

      const results = await Promise.all(batches);

      // All batches should succeed
      results.forEach(batchResults => {
        batchResults.forEach((result: any) => {
          expect(result.success).toBe(true);
        });
      });

    }, 60000);

    it('should handle memory cleanup efficiently', async () => {
      // Create and destroy sessions to test memory cleanup
      for (let i = 0; i < 5; i++) {
        const session = createBrowserSession(manager);
        await session.launch();
        await session.navigate('data:text/html,<div style="height:2000px">Long content</div>');
        await session.screenshot({ fullPage: true });
        await session.close();
      }

      // Check that resources are properly cleaned up
      const usage = await manager.getResourceUsage();
      expect(usage.totalContexts).toBe(0);

      // Memory usage should be reasonable (not accumulated)
      expect(usage.memoryUsageMB).toBeLessThan(1000); // Reasonable limit
    });
  });
});