/**
 * Browser Context and Session Management Integration Tests
 *
 * Comprehensive tests for browser context isolation and session management including:
 * - Cookie manipulation across different contexts
 * - localStorage and sessionStorage handling and isolation
 * - Multiple browser contexts isolation
 * - Session persistence across browser restarts
 * - Incognito/private browsing contexts
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type {
  BrowserManagerConfig,
  BrowserSessionConfig,
  SupportedBrowserType,
  BrowserActionResult,
} from '../types.js';
import { defaultBrowserConfig, defaultManagerConfig } from '../constants.js';
import type { Page, BrowserContext } from 'playwright';

describe('Browser Context and Session Management Integration Tests', () => {
  let manager: BrowserManager;
  let sessions: BrowserSession[] = [];

  beforeAll(async () => {
    // Initialize browser manager for all tests
    manager = new BrowserManager({
      maxInstances: 5,
      reuseInstances: false, // Force fresh instances for isolation testing
      instanceIdleTimeout: 60000,
    });
  });

  beforeEach(() => {
    sessions = [];
  });

  afterEach(async () => {
    // Clean up all sessions
    await Promise.all(sessions.map(session => session.close().catch(() => {})));
    sessions = [];
  });

  afterAll(async () => {
    // Shutdown manager
    await manager.shutdown().catch(() => {});
  });

  describe('Cookie Management', () => {
    it('should handle cookie manipulation within a single context', async () => {
      const session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      sessions.push(session);

      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);

      // Navigate to a test page
      const navResult = await session.navigate('data:text/html,<html><body><h1>Test Page</h1></body></html>');
      expect(navResult.success).toBe(true);

      const page = session.getPage();
      const context = page?.context();
      expect(context).toBeDefined();

      if (context) {
        // Add cookies
        await context.addCookies([
          {
            name: 'testCookie',
            value: 'testValue',
            domain: 'localhost',
            path: '/',
          },
          {
            name: 'sessionCookie',
            value: 'sessionValue',
            domain: 'localhost',
            path: '/',
          },
        ]);

        // Retrieve and verify cookies
        const cookies = await context.cookies();
        expect(cookies).toHaveLength(2);
        expect(cookies.find(c => c.name === 'testCookie')?.value).toBe('testValue');
        expect(cookies.find(c => c.name === 'sessionCookie')?.value).toBe('sessionValue');

        // Clear specific cookie
        await context.clearCookies({ name: 'testCookie' });
        const remainingCookies = await context.cookies();
        expect(remainingCookies).toHaveLength(1);
        expect(remainingCookies.find(c => c.name === 'testCookie')).toBeUndefined();
        expect(remainingCookies.find(c => c.name === 'sessionCookie')).toBeDefined();

        // Clear all cookies
        await context.clearCookies();
        const finalCookies = await context.cookies();
        expect(finalCookies).toHaveLength(0);
      }
    });

    it('should isolate cookies between different browser contexts', async () => {
      const session1 = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      const session2 = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      sessions.push(session1, session2);

      // Launch both sessions
      const launch1 = await session1.launch();
      const launch2 = await session2.launch();
      expect(launch1.success).toBe(true);
      expect(launch2.success).toBe(true);

      // Navigate both to test pages
      await session1.navigate('data:text/html,<html><body><h1>Context 1</h1></body></html>');
      await session2.navigate('data:text/html,<html><body><h1>Context 2</h1></body></html>');

      const page1 = session1.getPage();
      const page2 = session2.getPage();
      const context1 = page1?.context();
      const context2 = page2?.context();

      expect(context1).toBeDefined();
      expect(context2).toBeDefined();
      expect(context1).not.toBe(context2);

      if (context1 && context2) {
        // Add different cookies to each context
        await context1.addCookies([
          {
            name: 'context1Cookie',
            value: 'context1Value',
            domain: 'localhost',
            path: '/',
          },
        ]);

        await context2.addCookies([
          {
            name: 'context2Cookie',
            value: 'context2Value',
            domain: 'localhost',
            path: '/',
          },
        ]);

        // Verify cookie isolation
        const cookies1 = await context1.cookies();
        const cookies2 = await context2.cookies();

        expect(cookies1).toHaveLength(1);
        expect(cookies2).toHaveLength(1);
        expect(cookies1[0].name).toBe('context1Cookie');
        expect(cookies2[0].name).toBe('context2Cookie');
        expect(cookies1.find(c => c.name === 'context2Cookie')).toBeUndefined();
        expect(cookies2.find(c => c.name === 'context1Cookie')).toBeUndefined();
      }
    });
  });

  describe('Local Storage Management', () => {
    it('should handle localStorage and sessionStorage within a single context', async () => {
      const session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      sessions.push(session);

      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);

      const navResult = await session.navigate('data:text/html,<html><body><h1>Storage Test</h1></body></html>');
      expect(navResult.success).toBe(true);

      const page = session.getPage();
      expect(page).toBeDefined();

      if (page) {
        // Set localStorage items
        await page.evaluate(() => {
          localStorage.setItem('testKey', 'testValue');
          localStorage.setItem('anotherKey', 'anotherValue');
        });

        // Set sessionStorage items
        await page.evaluate(() => {
          sessionStorage.setItem('sessionKey', 'sessionValue');
          sessionStorage.setItem('tempKey', 'tempValue');
        });

        // Verify localStorage
        const localStorageItems = await page.evaluate(() => {
          const items: { [key: string]: string } = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              items[key] = localStorage.getItem(key) || '';
            }
          }
          return items;
        });

        expect(Object.keys(localStorageItems)).toHaveLength(2);
        expect(localStorageItems.testKey).toBe('testValue');
        expect(localStorageItems.anotherKey).toBe('anotherValue');

        // Verify sessionStorage
        const sessionStorageItems = await page.evaluate(() => {
          const items: { [key: string]: string } = {};
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
              items[key] = sessionStorage.getItem(key) || '';
            }
          }
          return items;
        });

        expect(Object.keys(sessionStorageItems)).toHaveLength(2);
        expect(sessionStorageItems.sessionKey).toBe('sessionValue');
        expect(sessionStorageItems.tempKey).toBe('tempValue');

        // Clear specific localStorage item
        await page.evaluate(() => {
          localStorage.removeItem('testKey');
        });

        const remainingLocalStorage = await page.evaluate(() => {
          return localStorage.getItem('testKey');
        });
        expect(remainingLocalStorage).toBeNull();

        // Clear all storage
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });

        const finalLocalStorageLength = await page.evaluate(() => localStorage.length);
        const finalSessionStorageLength = await page.evaluate(() => sessionStorage.length);
        expect(finalLocalStorageLength).toBe(0);
        expect(finalSessionStorageLength).toBe(0);
      }
    });

    it('should isolate storage between different browser contexts', async () => {
      const session1 = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      const session2 = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      sessions.push(session1, session2);

      // Launch both sessions
      await session1.launch();
      await session2.launch();

      // Navigate both to test pages
      await session1.navigate('data:text/html,<html><body><h1>Context 1 Storage</h1></body></html>');
      await session2.navigate('data:text/html,<html><body><h1>Context 2 Storage</h1></body></html>');

      const page1 = session1.getPage();
      const page2 = session2.getPage();

      if (page1 && page2) {
        // Set different storage values in each context
        await page1.evaluate(() => {
          localStorage.setItem('context', 'context1');
          sessionStorage.setItem('contextSession', 'session1');
        });

        await page2.evaluate(() => {
          localStorage.setItem('context', 'context2');
          sessionStorage.setItem('contextSession', 'session2');
        });

        // Verify storage isolation
        const context1LocalValue = await page1.evaluate(() => localStorage.getItem('context'));
        const context1SessionValue = await page1.evaluate(() => sessionStorage.getItem('contextSession'));
        const context2LocalValue = await page2.evaluate(() => localStorage.getItem('context'));
        const context2SessionValue = await page2.evaluate(() => sessionStorage.getItem('contextSession'));

        expect(context1LocalValue).toBe('context1');
        expect(context1SessionValue).toBe('session1');
        expect(context2LocalValue).toBe('context2');
        expect(context2SessionValue).toBe('session2');
      }
    });
  });

  describe('Multiple Browser Contexts Isolation', () => {
    it('should maintain complete isolation between multiple contexts', async () => {
      const contexts = await Promise.all([
        createIsolatedSession('context1'),
        createIsolatedSession('context2'),
        createIsolatedSession('context3'),
      ]);

      // Set unique identifiers in each context
      await Promise.all(contexts.map(async (session, index) => {
        const page = session.getPage();
        const contextId = `context${index + 1}`;

        if (page) {
          // Set cookies
          await page.context().addCookies([
            {
              name: `${contextId}Cookie`,
              value: `${contextId}Value`,
              domain: 'localhost',
              path: '/',
            },
          ]);

          // Set storage
          await page.evaluate((contextId) => {
            localStorage.setItem('contextId', contextId);
            sessionStorage.setItem('contextSessionId', `${contextId}Session`);
            // Set a global variable for verification
            (window as any).contextId = contextId;
          }, contextId);
        }
      }));

      // Verify complete isolation
      for (let i = 0; i < contexts.length; i++) {
        const session = contexts[i];
        const page = session.getPage();
        const contextId = `context${i + 1}`;

        if (page) {
          // Verify cookies
          const cookies = await page.context().cookies();
          expect(cookies).toHaveLength(1);
          expect(cookies[0].name).toBe(`${contextId}Cookie`);

          // Verify storage
          const localStorageValue = await page.evaluate(() => localStorage.getItem('contextId'));
          const sessionStorageValue = await page.evaluate(() => sessionStorage.getItem('contextSessionId'));
          const globalVar = await page.evaluate(() => (window as any).contextId);

          expect(localStorageValue).toBe(contextId);
          expect(sessionStorageValue).toBe(`${contextId}Session`);
          expect(globalVar).toBe(contextId);

          // Verify no cross-contamination
          for (let j = 0; j < contexts.length; j++) {
            if (i !== j) {
              const otherContextId = `context${j + 1}`;
              const otherCookie = cookies.find(c => c.name === `${otherContextId}Cookie`);
              expect(otherCookie).toBeUndefined();
            }
          }
        }
      }
    });

    async function createIsolatedSession(name: string): Promise<BrowserSession> {
      const session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      sessions.push(session);

      await session.launch();
      await session.navigate(`data:text/html,<html><body><h1>${name}</h1></body></html>`);
      return session;
    }
  });

  describe('Session Persistence', () => {
    it('should persist session data across page navigation within same context', async () => {
      const session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      sessions.push(session);

      await session.launch();

      // Navigate to first page and set data
      await session.navigate('data:text/html,<html><body><h1>Page 1</h1></body></html>');

      const page = session.getPage();
      if (page) {
        await page.context().addCookies([
          {
            name: 'persistentCookie',
            value: 'persistentValue',
            domain: 'localhost',
            path: '/',
          },
        ]);

        await page.evaluate(() => {
          localStorage.setItem('persistentData', 'persistentValue');
          sessionStorage.setItem('sessionData', 'sessionValue');
        });

        // Navigate to second page
        await session.navigate('data:text/html,<html><body><h1>Page 2</h1></body></html>');

        // Verify data persistence
        const cookies = await page.context().cookies();
        const localStorageValue = await page.evaluate(() => localStorage.getItem('persistentData'));
        const sessionStorageValue = await page.evaluate(() => sessionStorage.getItem('sessionData'));

        expect(cookies.find(c => c.name === 'persistentCookie')?.value).toBe('persistentValue');
        expect(localStorageValue).toBe('persistentValue');
        expect(sessionStorageValue).toBe('sessionValue');
      }
    });

    it('should handle session data across browser restart simulation', async () => {
      let persistentCookies: any[] = [];

      // First browser session
      {
        const session = new BrowserSession(manager, {
          browserType: 'chromium',
          headless: true,
        });
        sessions.push(session);

        await session.launch();
        await session.navigate('data:text/html,<html><body><h1>First Session</h1></body></html>');

        const page = session.getPage();
        if (page) {
          await page.context().addCookies([
            {
              name: 'persistentCookie',
              value: 'shouldPersist',
              domain: 'localhost',
              path: '/',
            },
          ]);

          await page.evaluate(() => {
            localStorage.setItem('localData', 'localValue');
          });

          // Save cookies for next session
          persistentCookies = await page.context().cookies();
        }

        await session.close();
      }

      // Second browser session (simulating restart)
      {
        const session = new BrowserSession(manager, {
          browserType: 'chromium',
          headless: true,
        });
        sessions.push(session);

        await session.launch();
        await session.navigate('data:text/html,<html><body><h1>Second Session</h1></body></html>');

        const page = session.getPage();
        if (page) {
          // Restore persistent cookies
          await page.context().addCookies(persistentCookies);

          // Verify cookies were restored
          const restoredCookies = await page.context().cookies();
          expect(restoredCookies.find(c => c.name === 'persistentCookie')?.value).toBe('shouldPersist');

          // Note: localStorage would not persist across browser restarts in real scenarios
          // This simulates how applications would handle persistence
          const localStorageValue = await page.evaluate(() => localStorage.getItem('localData'));
          expect(localStorageValue).toBeNull(); // Expected behavior for new session
        }
      }
    });
  });

  describe('Incognito/Private Browsing Contexts', () => {
    it('should create isolated private browsing context', async () => {
      const session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        contextOptions: {
          // This simulates incognito mode - no persistent storage
          storageState: undefined,
        },
      });
      sessions.push(session);

      await session.launch();
      await session.navigate('data:text/html,<html><body><h1>Private Context</h1></body></html>');

      const page = session.getPage();
      if (page) {
        // Set data in private context
        await page.evaluate(() => {
          localStorage.setItem('privateData', 'privateValue');
          sessionStorage.setItem('privateSession', 'sessionValue');
        });

        // Verify data exists in current session
        const localValue = await page.evaluate(() => localStorage.getItem('privateData'));
        const sessionValue = await page.evaluate(() => sessionStorage.getItem('privateSession'));

        expect(localValue).toBe('privateValue');
        expect(sessionValue).toBe('sessionValue');
      }

      await session.close();

      // Create new private session to verify no data persistence
      const newSession = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        contextOptions: {
          storageState: undefined,
        },
      });
      sessions.push(newSession);

      await newSession.launch();
      await newSession.navigate('data:text/html,<html><body><h1>New Private Context</h1></body></html>');

      const newPage = newSession.getPage();
      if (newPage) {
        // Verify no data from previous private session
        const localValue = await newPage.evaluate(() => localStorage.getItem('privateData'));
        const sessionValue = await newPage.evaluate(() => sessionStorage.getItem('privateSession'));

        expect(localValue).toBeNull();
        expect(sessionValue).toBeNull();
      }
    });

    it('should maintain isolation between normal and private contexts', async () => {
      const normalSession = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });

      const privateSession = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        contextOptions: {
          storageState: undefined,
        },
      });

      sessions.push(normalSession, privateSession);

      await Promise.all([
        normalSession.launch(),
        privateSession.launch(),
      ]);

      await Promise.all([
        normalSession.navigate('data:text/html,<html><body><h1>Normal Context</h1></body></html>'),
        privateSession.navigate('data:text/html,<html><body><h1>Private Context</h1></body></html>'),
      ]);

      const normalPage = normalSession.getPage();
      const privatePage = privateSession.getPage();

      if (normalPage && privatePage) {
        // Set data in both contexts
        await normalPage.evaluate(() => {
          localStorage.setItem('contextType', 'normal');
          sessionStorage.setItem('contextType', 'normal');
        });

        await privatePage.evaluate(() => {
          localStorage.setItem('contextType', 'private');
          sessionStorage.setItem('contextType', 'private');
        });

        // Add cookies to both
        await normalPage.context().addCookies([
          {
            name: 'contextCookie',
            value: 'normal',
            domain: 'localhost',
            path: '/',
          },
        ]);

        await privatePage.context().addCookies([
          {
            name: 'contextCookie',
            value: 'private',
            domain: 'localhost',
            path: '/',
          },
        ]);

        // Verify isolation
        const normalLocalValue = await normalPage.evaluate(() => localStorage.getItem('contextType'));
        const privateLocalValue = await privatePage.evaluate(() => localStorage.getItem('contextType'));
        const normalSessionValue = await normalPage.evaluate(() => sessionStorage.getItem('contextType'));
        const privateSessionValue = await privatePage.evaluate(() => sessionStorage.getItem('contextType'));

        expect(normalLocalValue).toBe('normal');
        expect(privateLocalValue).toBe('private');
        expect(normalSessionValue).toBe('normal');
        expect(privateSessionValue).toBe('private');

        // Verify cookie isolation
        const normalCookies = await normalPage.context().cookies();
        const privateCookies = await privatePage.context().cookies();

        expect(normalCookies.find(c => c.name === 'contextCookie')?.value).toBe('normal');
        expect(privateCookies.find(c => c.name === 'contextCookie')?.value).toBe('private');
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle storage quota exceeded gracefully', async () => {
      const session = new BrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      sessions.push(session);

      await session.launch();
      await session.navigate('data:text/html,<html><body><h1>Storage Quota Test</h1></body></html>');

      const page = session.getPage();
      if (page) {
        // Test localStorage quota handling
        const result = await page.evaluate(() => {
          try {
            // Attempt to fill localStorage (this won't actually hit quota in test env)
            for (let i = 0; i < 100; i++) {
              localStorage.setItem(`key${i}`, `value${i}`.repeat(100));
            }
            return { success: true, error: null };
          } catch (error) {
            return { success: false, error: (error as Error).message };
          }
        });

        // In test environment, this should succeed
        // In real scenarios with actual quota limits, this would test error handling
        expect(result.success).toBe(true);

        // Clean up
        await page.evaluate(() => localStorage.clear());
      }
    });

    it('should handle context creation failure gracefully', async () => {
      // Create a manager with very restrictive limits to force failure
      const restrictiveManager = new BrowserManager({
        maxInstances: 1,
        resourceLimits: {
          maxMemoryMB: 1, // Very low limit
        },
      });

      const sessions: BrowserSession[] = [];

      try {
        // Try to create multiple sessions that should exhaust resources
        const sessionPromises = Array.from({ length: 3 }, (_, i) => {
          const session = new BrowserSession(restrictiveManager, {
            browserType: 'chromium',
            headless: true,
          });
          sessions.push(session);
          return session.launch();
        });

        const results = await Promise.allSettled(sessionPromises);

        // At least some should fail due to resource limits
        const failures = results.filter(r => r.status === 'rejected' ||
          (r.status === 'fulfilled' && !r.value.success));

        // We expect some failures due to resource constraints
        expect(failures.length).toBeGreaterThan(0);
      } finally {
        // Cleanup
        await Promise.all(sessions.map(s => s.close().catch(() => {})));
        await restrictiveManager.shutdown().catch(() => {});
      }
    });
  });
});