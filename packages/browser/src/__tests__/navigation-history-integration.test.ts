/**
 * @apexcli/browser - Navigation History Integration Tests
 *
 * Comprehensive integration tests for browser history navigation including:
 * - back(), forward(), and go() navigation methods
 * - History state management and verification
 * - Navigation after history manipulation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';

describe('Navigation History Integration', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = new BrowserManager();
    session = new BrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      timeout: 30000
    });
    await session.launch();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Browser History Navigation Methods', () => {
    describe('goBack() Method', () => {
      it('should successfully navigate back through multiple pages', async () => {
        // Create a history with multiple pages
        await session.navigate('data:text/html,<html><head><title>Page 1</title></head><body><h1>First Page</h1><div id="content">Content 1</div></body></html>');
        await session.navigate('data:text/html,<html><head><title>Page 2</title></head><body><h1>Second Page</h1><div id="content">Content 2</div></body></html>');
        await session.navigate('data:text/html,<html><head><title>Page 3</title></head><body><h1>Third Page</h1><div id="content">Content 3</div></body></html>');

        // Verify we're on page 3
        let title = await session.getTitle();
        expect(title.success).toBe(true);
        expect(title.data).toBe('Page 3');

        // Go back to page 2
        const backResult1 = await session.goBack();
        expect(backResult1.success).toBe(true);
        expect(backResult1.data).toBeTruthy();

        title = await session.getTitle();
        expect(title.success).toBe(true);
        expect(title.data).toBe('Page 2');

        // Go back to page 1
        const backResult2 = await session.goBack();
        expect(backResult2.success).toBe(true);
        expect(backResult2.data).toBeTruthy();

        title = await session.getTitle();
        expect(title.success).toBe(true);
        expect(title.data).toBe('Page 1');
      });

      it('should return null when attempting to go back with no previous history', async () => {
        // Navigate to initial page only
        await session.navigate('data:text/html,<html><head><title>Only Page</title></head><body><h1>Only Page</h1></body></html>');

        // Attempt to go back - should return null as there's no previous page
        const result = await session.goBack();
        expect(result.success).toBe(true);
        expect(result.data).toBe(null);
      });

      it('should handle navigation timeout correctly', async () => {
        await session.navigate('data:text/html,<html><head><title>Start Page</title></head><body><h1>Start Page</h1></body></html>');
        await session.navigate('data:text/html,<html><head><title>Target Page</title></head><body><h1>Target Page</h1></body></html>');

        const result = await session.goBack({ timeout: 5000 });
        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.duration).toBeLessThan(5000);
      });
    });

    describe('goForward() Method', () => {
      it('should successfully navigate forward through history', async () => {
        // Build history
        await session.navigate('data:text/html,<html><head><title>Page A</title></head><body><h1>Page A</h1></body></html>');
        await session.navigate('data:text/html,<html><head><title>Page B</title></head><body><h1>Page B</h1></body></html>');
        await session.navigate('data:text/html,<html><head><title>Page C</title></head><body><h1>Page C</h1></body></html>');

        // Go back twice to Page A
        await session.goBack();
        await session.goBack();

        let title = await session.getTitle();
        expect(title.data).toBe('Page A');

        // Go forward to Page B
        const forwardResult1 = await session.goForward();
        expect(forwardResult1.success).toBe(true);
        expect(forwardResult1.data).toBeTruthy();

        title = await session.getTitle();
        expect(title.data).toBe('Page B');

        // Go forward to Page C
        const forwardResult2 = await session.goForward();
        expect(forwardResult2.success).toBe(true);
        expect(forwardResult2.data).toBeTruthy();

        title = await session.getTitle();
        expect(title.data).toBe('Page C');
      });

      it('should return null when attempting to go forward with no forward history', async () => {
        // Navigate to page (we're at the end of history)
        await session.navigate('data:text/html,<html><head><title>Current Page</title></head><body><h1>Current Page</h1></body></html>');

        // Attempt to go forward - should return null as there's no forward history
        const result = await session.goForward();
        expect(result.success).toBe(true);
        expect(result.data).toBe(null);
      });

      it('should handle forward navigation with custom waitUntil option', async () => {
        await session.navigate('data:text/html,<html><head><title>First</title></head><body><h1>First</h1></body></html>');
        await session.navigate('data:text/html,<html><head><title>Second</title></head><body><h1>Second</h1></body></html>');

        await session.goBack();

        const result = await session.goForward({ waitUntil: 'domcontentloaded' });
        expect(result.success).toBe(true);

        const title = await session.getTitle();
        expect(title.data).toBe('Second');
      });
    });

    describe('go() Method', () => {
      it('should navigate backward by specified number of steps', async () => {
        // Create history with 5 pages
        const pages = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
        for (const page of pages) {
          await session.navigate(`data:text/html,<html><head><title>${page}</title></head><body><h1>${page}</h1></body></html>`);
        }

        // Verify we're on Epsilon (last page)
        let title = await session.getTitle();
        expect(title.data).toBe('Epsilon');

        // Go back 2 steps to Gamma
        const result = await session.go(-2);
        expect(result.success).toBe(true);
        expect(result.data).toBeTruthy();

        title = await session.getTitle();
        expect(title.data).toBe('Gamma');

        // Go back 1 more step to Beta
        const result2 = await session.go(-1);
        expect(result2.success).toBe(true);

        title = await session.getTitle();
        expect(title.data).toBe('Beta');
      });

      it('should navigate forward by specified number of steps', async () => {
        // Build history and navigate back
        await session.navigate('data:text/html,<html><head><title>Start</title></head><body><h1>Start</h1></body></html>');
        await session.navigate('data:text/html,<html><head><title>Middle</title></head><body><h1>Middle</h1></body></html>');
        await session.navigate('data:text/html,<html><head><title>End</title></head><body><h1>End</h1></body></html>');

        // Go back to start
        await session.go(-2);
        let title = await session.getTitle();
        expect(title.data).toBe('Start');

        // Go forward 2 steps to End
        const result = await session.go(2);
        expect(result.success).toBe(true);
        expect(result.data).toBeTruthy();

        title = await session.getTitle();
        expect(title.data).toBe('End');
      });

      it('should handle delta of 0 (no navigation)', async () => {
        await session.navigate('data:text/html,<html><head><title>Current</title></head><body><h1>Current</h1></body></html>');

        const initialUrl = session.getCurrentUrl();
        const result = await session.go(0);

        expect(result.success).toBe(true);
        expect(result.data).toBe(initialUrl);
        expect(session.getCurrentUrl()).toBe(initialUrl);
      });

      it('should validate delta parameter is an integer', async () => {
        await session.navigate('data:text/html,<html><head><title>Test</title></head><body><h1>Test</h1></body></html>');

        // Test with non-integer values
        const result1 = await session.go(1.5 as any);
        expect(result1.success).toBe(false);
        expect(result1.error).toContain('integer');

        const result2 = await session.go(NaN as any);
        expect(result2.success).toBe(false);
        expect(result2.error).toContain('integer');
      });

      it('should handle navigation beyond history limits gracefully', async () => {
        // Create small history
        await session.navigate('data:text/html,<html><head><title>Page 1</title></head><body><h1>Page 1</h1></body></html>');
        await session.navigate('data:text/html,<html><head><title>Page 2</title></head><body><h1>Page 2</h1></body></html>');

        // Try to go back more steps than available
        const result = await session.go(-5);
        expect(result.success).toBe(true);
        // Should stop at the beginning of history

        const title = await session.getTitle();
        expect(title.data).toBe('Page 1');
      });
    });
  });

  describe('History State Management', () => {
    it('should maintain proper history state after multiple navigations', async () => {
      // Build a complex navigation history
      const pages = [
        { title: 'Home', content: 'Welcome Home' },
        { title: 'About', content: 'About Us' },
        { title: 'Services', content: 'Our Services' },
        { title: 'Contact', content: 'Contact Information' }
      ];

      // Navigate through pages
      for (const page of pages) {
        await session.navigate(
          `data:text/html,<html><head><title>${page.title}</title></head><body><h1>${page.title}</h1><p>${page.content}</p></body></html>`
        );
      }

      // Verify final location
      let title = await session.getTitle();
      expect(title.data).toBe('Contact');

      // Navigate back and verify each step
      await session.goBack();
      title = await session.getTitle();
      expect(title.data).toBe('Services');

      await session.goBack();
      title = await session.getTitle();
      expect(title.data).toBe('About');

      await session.goBack();
      title = await session.getTitle();
      expect(title.data).toBe('Home');

      // Navigate forward and verify
      await session.goForward();
      title = await session.getTitle();
      expect(title.data).toBe('About');

      await session.goForward();
      title = await session.getTitle();
      expect(title.data).toBe('Services');
    });

    it('should handle history state with page reloads', async () => {
      // Create history
      await session.navigate('data:text/html,<html><head><title>Original</title></head><body><h1>Original Page</h1></body></html>');
      await session.navigate('data:text/html,<html><head><title>Second</title></head><body><h1>Second Page</h1></body></html>');

      // Reload current page
      const reloadResult = await session.reload();
      expect(reloadResult.success).toBe(true);

      // Verify we can still navigate back
      const backResult = await session.goBack();
      expect(backResult.success).toBe(true);

      const title = await session.getTitle();
      expect(title.data).toBe('Original');
    });

    it('should verify URL consistency during navigation', async () => {
      const page1Url = 'data:text/html,<html><head><title>Page One</title></head><body><h1>Page One</h1></body></html>';
      const page2Url = 'data:text/html,<html><head><title>Page Two</title></head><body><h1>Page Two</h1></body></html>';

      // Navigate to both pages
      await session.navigate(page1Url);
      const url1 = session.getCurrentUrl();

      await session.navigate(page2Url);
      const url2 = session.getCurrentUrl();

      // Verify URLs are different
      expect(url1).not.toBe(url2);

      // Navigate back and verify URL restoration
      await session.goBack();
      expect(session.getCurrentUrl()).toBe(url1);

      // Navigate forward and verify URL restoration
      await session.goForward();
      expect(session.getCurrentUrl()).toBe(url2);
    });
  });

  describe('Navigation After History Manipulation', () => {
    it('should handle navigation after programmatic history changes', async () => {
      // Navigate to a page that manipulates history via JavaScript
      await session.navigate(`data:text/html,<html>
        <head><title>History Manipulator</title></head>
        <body>
          <h1>History Test Page</h1>
          <button id="pushState" onclick="history.pushState({page: 2}, 'Page 2', '?page=2')">Push State</button>
          <button id="replaceState" onclick="history.replaceState({page: 3}, 'Page 3', '?page=3')">Replace State</button>
          <div id="state-info"></div>
          <script>
            window.addEventListener('popstate', function(event) {
              document.getElementById('state-info').textContent = 'State: ' + JSON.stringify(event.state);
            });
          </script>
        </body>
      </html>`);

      // Click button to manipulate history
      await session.click('#pushState');

      // Verify URL changed
      expect(session.getCurrentUrl()).toContain('?page=2');

      // Try navigation after history manipulation
      const backResult = await session.goBack();
      expect(backResult.success).toBe(true);

      // Verify we can navigate forward again
      const forwardResult = await session.goForward();
      expect(forwardResult.success).toBe(true);
      expect(session.getCurrentUrl()).toContain('?page=2');
    });

    it('should maintain navigation capability after replace state', async () => {
      // Create initial history
      await session.navigate('data:text/html,<html><head><title>Initial</title></head><body><h1>Initial</h1></body></html>');

      // Navigate to page that uses replaceState
      await session.navigate(`data:text/html,<html>
        <head><title>Before Replace</title></head>
        <body>
          <h1>Before Replace</h1>
          <script>
            setTimeout(() => {
              history.replaceState({modified: true}, 'After Replace', window.location.href + '#replaced');
              document.title = 'After Replace';
            }, 100);
          </script>
        </body>
      </html>`);

      // Wait for JavaScript to execute
      await session.waitFor(200);

      // Verify title changed
      const title = await session.getTitle();
      expect(title.data).toBe('After Replace');

      // Verify we can still navigate back to initial page
      const backResult = await session.goBack();
      expect(backResult.success).toBe(true);

      const backTitle = await session.getTitle();
      expect(backTitle.data).toBe('Initial');
    });

    it('should handle complex navigation patterns with mixed history operations', async () => {
      // Create base navigation history
      await session.navigate('data:text/html,<html><head><title>Base</title></head><body><h1>Base Page</h1></body></html>');
      await session.navigate('data:text/html,<html><head><title>Page A</title></head><body><h1>Page A</h1></body></html>');
      await session.navigate('data:text/html,<html><head><title>Page B</title></head><body><h1>Page B</h1></body></html>');

      // Go back to Page A
      await session.goBack();
      let title = await session.getTitle();
      expect(title.data).toBe('Page A');

      // Navigate to a new page (this should clear forward history)
      await session.navigate('data:text/html,<html><head><title>New Branch</title></head><body><h1>New Branch</h1></body></html>');

      // Verify we can't go forward to Page B anymore (history was cleared)
      const forwardResult = await session.goForward();
      expect(forwardResult.success).toBe(true);
      expect(forwardResult.data).toBe(null); // No forward history available

      // But we should be able to go back
      await session.goBack();
      title = await session.getTitle();
      expect(title.data).toBe('Page A');

      await session.goBack();
      title = await session.getTitle();
      expect(title.data).toBe('Base');
    });

    it('should handle navigation in single-page applications with hash routing', async () => {
      // Create SPA-like page with hash routing
      await session.navigate(`data:text/html,<html>
        <head><title>SPA Router</title></head>
        <body>
          <div id="app">
            <nav>
              <a href="#home" id="home-link">Home</a>
              <a href="#about" id="about-link">About</a>
              <a href="#contact" id="contact-link">Contact</a>
            </nav>
            <div id="content">Loading...</div>
          </div>
          <script>
            function navigate() {
              const hash = window.location.hash.substring(1) || 'home';
              document.getElementById('content').textContent = 'Page: ' + hash.toUpperCase();
              document.title = 'SPA - ' + hash.toUpperCase();
            }

            window.addEventListener('hashchange', navigate);
            window.addEventListener('load', navigate);

            // Prevent default link behavior and use hash navigation
            document.addEventListener('click', function(e) {
              if (e.target.tagName === 'A' && e.target.getAttribute('href').startsWith('#')) {
                window.location.hash = e.target.getAttribute('href');
              }
            });
          </script>
        </body>
      </html>`);

      // Wait for initial load
      await session.waitFor(100);

      // Navigate through the SPA
      await session.click('#about-link');
      await session.waitFor(100);
      let title = await session.getTitle();
      expect(title.data).toBe('SPA - ABOUT');

      await session.click('#contact-link');
      await session.waitFor(100);
      title = await session.getTitle();
      expect(title.data).toBe('SPA - CONTACT');

      // Use browser navigation to go back
      const backResult = await session.goBack();
      expect(backResult.success).toBe(true);
      await session.waitFor(100);

      title = await session.getTitle();
      expect(title.data).toBe('SPA - ABOUT');

      // Go back again
      await session.goBack();
      await session.waitFor(100);

      title = await session.getTitle();
      expect(title.data).toBe('SPA - HOME');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle navigation on pages with complex JavaScript', async () => {
      await session.navigate(`data:text/html,<html>
        <head><title>Complex JS</title></head>
        <body>
          <h1>Complex JavaScript Page</h1>
          <script>
            // Simulate complex JavaScript that might interfere with navigation
            let counter = 0;
            setInterval(() => {
              counter++;
              console.log('Background task:', counter);
            }, 10);

            // Override some history methods (should not break browser navigation)
            const originalPushState = history.pushState;
            history.pushState = function(...args) {
              console.log('Custom pushState called');
              return originalPushState.apply(this, args);
            };
          </script>
        </body>
      </html>`);

      await session.navigate('data:text/html,<html><head><title>Second Complex</title></head><body><h1>Second Page</h1></body></html>');

      // Navigation should still work despite complex JavaScript
      const backResult = await session.goBack();
      expect(backResult.success).toBe(true);

      const title = await session.getTitle();
      expect(title.data).toBe('Complex JS');
    });

    it('should maintain performance during rapid navigation', async () => {
      const pages = [];
      for (let i = 1; i <= 10; i++) {
        pages.push(`data:text/html,<html><head><title>Page ${i}</title></head><body><h1>Page ${i}</h1></body></html>`);
      }

      // Rapidly navigate through pages
      const startTime = Date.now();
      for (const page of pages) {
        await session.navigate(page);
      }

      // Rapidly navigate back
      for (let i = 0; i < 5; i++) {
        const result = await session.goBack();
        expect(result.success).toBe(true);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete reasonably quickly (less than 10 seconds)
      expect(duration).toBeLessThan(10000);

      // Verify we're at the correct position
      const title = await session.getTitle();
      expect(title.data).toBe('Page 5'); // Started at Page 10, went back 5 times
    });

    it('should handle navigation with custom timeout values', async () => {
      await session.navigate('data:text/html,<html><head><title>Timeout Test 1</title></head><body><h1>Page 1</h1></body></html>');
      await session.navigate('data:text/html,<html><head><title>Timeout Test 2</title></head><body><h1>Page 2</h1></body></html>');

      // Test with very short timeout (should still succeed for data URLs)
      const result = await session.goBack({ timeout: 1000 });
      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(1000);

      const title = await session.getTitle();
      expect(title.data).toBe('Timeout Test 1');
    });
  });
});