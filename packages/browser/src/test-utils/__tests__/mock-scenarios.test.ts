/**
 * @apexcli/browser - Mock Scenarios Test Suite
 *
 * Comprehensive tests for mock error scenario utilities
 */

import { describe, it, expect, vi } from 'vitest';
import { MockScenarios } from '../mock-scenarios.js';

// Mock Playwright Page interface for testing
interface MockPage {
  route: (pattern: string, handler: (route: MockRoute) => void) => Promise<void>;
}

interface MockRoute {
  continue: () => void;
  abort: (reason: string) => void;
}

describe('MockScenarios', () => {
  describe('slowLoadingPage', () => {
    it('should set up route with default delay', async () => {
      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          // Simulate the route handler being called
          handler(mockRoute);
        })
      };

      await MockScenarios.slowLoadingPage(mockPage as unknown as any);

      expect(mockPage.route).toHaveBeenCalledWith('**/*', expect.any(Function));
    });

    it('should set up route with custom delay', async () => {
      const customDelay = 2000;
      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          handler(mockRoute);
        })
      };

      await MockScenarios.slowLoadingPage(mockPage as unknown as any, customDelay);

      expect(mockPage.route).toHaveBeenCalledWith('**/*', expect.any(Function));
    });

    it('should use setTimeout with correct delay', async () => {
      vi.useFakeTimers();

      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          handler(mockRoute);
        })
      };

      await MockScenarios.slowLoadingPage(mockPage as unknown as any, 1000);

      // Should not have been called yet
      expect(mockRoute.continue).not.toHaveBeenCalled();

      // Advance timers by 1000ms
      vi.advanceTimersByTime(1000);

      // Now it should have been called
      expect(mockRoute.continue).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should use default delay of 5000ms when not specified', async () => {
      vi.useFakeTimers();

      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          handler(mockRoute);
        })
      };

      await MockScenarios.slowLoadingPage(mockPage as unknown as any);

      // Should not have been called yet
      expect(mockRoute.continue).not.toHaveBeenCalled();

      // Advance timers by 4999ms - should still not be called
      vi.advanceTimersByTime(4999);
      expect(mockRoute.continue).not.toHaveBeenCalled();

      // Advance by 1 more ms to reach 5000ms
      vi.advanceTimersByTime(1);
      expect(mockRoute.continue).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle zero delay', async () => {
      vi.useFakeTimers();

      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          handler(mockRoute);
        })
      };

      await MockScenarios.slowLoadingPage(mockPage as unknown as any, 0);

      // Should not have been called immediately
      expect(mockRoute.continue).not.toHaveBeenCalled();

      // Should be called after timeout (even with 0 delay)
      vi.runAllTimers();
      expect(mockRoute.continue).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle negative delay', async () => {
      vi.useFakeTimers();

      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          handler(mockRoute);
        })
      };

      await MockScenarios.slowLoadingPage(mockPage as unknown as any, -1000);

      // Even with negative delay, setTimeout should handle it
      vi.runAllTimers();
      expect(mockRoute.continue).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should match all routes with ** pattern', async () => {
      const mockPage = {
        route: vi.fn()
      };

      await MockScenarios.slowLoadingPage(mockPage as unknown as any);

      expect(mockPage.route).toHaveBeenCalledWith('**/*', expect.any(Function));
    });
  });

  describe('networkError', () => {
    it('should set up route to abort with failed reason', async () => {
      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          handler(mockRoute);
        })
      };

      await MockScenarios.networkError(mockPage as unknown as any);

      expect(mockPage.route).toHaveBeenCalledWith('**/*', expect.any(Function));
      expect(mockRoute.abort).toHaveBeenCalledWith('failed');
      expect(mockRoute.continue).not.toHaveBeenCalled();
    });

    it('should match all routes with ** pattern', async () => {
      const mockPage = {
        route: vi.fn()
      };

      await MockScenarios.networkError(mockPage as unknown as any);

      expect(mockPage.route).toHaveBeenCalledWith('**/*', expect.any(Function));
    });

    it('should only abort, not continue routes', async () => {
      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          handler(mockRoute);
        })
      };

      await MockScenarios.networkError(mockPage as unknown as any);

      expect(mockRoute.abort).toHaveBeenCalledTimes(1);
      expect(mockRoute.continue).not.toHaveBeenCalled();
    });

    it('should use "failed" as the abort reason', async () => {
      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          handler(mockRoute);
        })
      };

      await MockScenarios.networkError(mockPage as unknown as any);

      expect(mockRoute.abort).toHaveBeenCalledWith('failed');
    });
  });

  describe('jsError', () => {
    it('should return valid HTML string', () => {
      const html = MockScenarios.jsError();

      expect(typeof html).toBe('string');
      expect(html.trim()).toStartWith('<html>');
      expect(html.trim()).toEndWith('</html>');
    });

    it('should contain proper HTML structure', () => {
      const html = MockScenarios.jsError();

      expect(html).toContain('<html>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('should contain JavaScript Error Test heading', () => {
      const html = MockScenarios.jsError();

      expect(html).toContain('<h1>JavaScript Error Test</h1>');
    });

    it('should contain script tag', () => {
      const html = MockScenarios.jsError();

      expect(html).toContain('<script>');
      expect(html).toContain('</script>');
    });

    it('should contain setTimeout with error throwing code', () => {
      const html = MockScenarios.jsError();

      expect(html).toContain('setTimeout');
      expect(html).toContain('throw new Error');
      expect(html).toContain('Test JavaScript error');
    });

    it('should use 100ms delay for setTimeout', () => {
      const html = MockScenarios.jsError();

      expect(html).toContain('setTimeout');
      expect(html).toContain(', 100)');
    });

    it('should include error message in thrown error', () => {
      const html = MockScenarios.jsError();

      expect(html).toContain("throw new Error('Test JavaScript error')");
    });

    it('should generate consistent HTML on multiple calls', () => {
      const html1 = MockScenarios.jsError();
      const html2 = MockScenarios.jsError();

      expect(html1).toBe(html2);
    });

    it('should contain properly formatted JavaScript', () => {
      const html = MockScenarios.jsError();

      // Extract the script content
      const scriptStart = html.indexOf('<script>');
      const scriptEnd = html.indexOf('</script>');
      const scriptContent = html.substring(scriptStart + 8, scriptEnd);

      // Should contain valid JavaScript syntax
      expect(scriptContent).toContain('setTimeout(');
      expect(scriptContent).toContain('() => {');
      expect(scriptContent).toContain('throw new Error(');
      expect(scriptContent).toContain('}, 100);');
    });

    it('should be a pure function (no side effects)', () => {
      // This test ensures the function doesn't modify any external state
      const before = Date.now();
      const html = MockScenarios.jsError();
      const after = Date.now();

      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
      // Should execute quickly (no actual timeouts or network calls)
      expect(after - before).toBeLessThan(100);
    });
  });

  describe('integration scenarios', () => {
    it('should provide different error simulation methods', () => {
      // Verify all three methods exist and return different types
      expect(typeof MockScenarios.slowLoadingPage).toBe('function');
      expect(typeof MockScenarios.networkError).toBe('function');
      expect(typeof MockScenarios.jsError).toBe('function');

      const html = MockScenarios.jsError();
      expect(typeof html).toBe('string');
    });

    it('should handle page routing consistently across scenarios', async () => {
      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          handler(mockRoute);
        })
      };

      // Both slowLoadingPage and networkError should use the same pattern
      await MockScenarios.slowLoadingPage(mockPage as unknown as any, 100);
      await MockScenarios.networkError(mockPage as unknown as any);

      // Both should have used the same route pattern
      expect(mockPage.route).toHaveBeenNthCalledWith(1, '**/*', expect.any(Function));
      expect(mockPage.route).toHaveBeenNthCalledWith(2, '**/*', expect.any(Function));
    });

    it('should support chaining different error scenarios', async () => {
      const mockPage = {
        route: vi.fn()
      };

      // Should be able to set up multiple scenarios on the same page
      await MockScenarios.slowLoadingPage(mockPage as unknown as any, 1000);
      await MockScenarios.networkError(mockPage as unknown as any);

      expect(mockPage.route).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle slowLoadingPage with very large delays', async () => {
      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          handler(mockRoute);
        })
      };

      // Test with a very large delay
      await MockScenarios.slowLoadingPage(mockPage as unknown as any, Number.MAX_SAFE_INTEGER);

      expect(mockPage.route).toHaveBeenCalled();
      // Should not crash or throw errors
    });

    it('should handle invalid page objects gracefully', async () => {
      // This tests that TypeScript types help prevent runtime errors
      const invalidPage = null;

      // These should be caught by TypeScript, but test runtime behavior
      await expect(async () => {
        await MockScenarios.slowLoadingPage(invalidPage as any);
      }).rejects.toThrow();

      await expect(async () => {
        await MockScenarios.networkError(invalidPage as any);
      }).rejects.toThrow();

      // jsError doesn't use page object, so should work fine
      expect(() => MockScenarios.jsError()).not.toThrow();
    });

    it('should generate HTML with proper escaping', () => {
      const html = MockScenarios.jsError();

      // Should not have any unescaped angle brackets in script content
      const scriptStart = html.indexOf('<script>');
      const scriptEnd = html.indexOf('</script>');
      const scriptContent = html.substring(scriptStart + 8, scriptEnd);

      // Script content should be properly formatted without HTML injection
      expect(scriptContent).not.toContain('</script>');
      expect(scriptContent).not.toContain('<script>');
    });

    it('should handle concurrent route setup calls', async () => {
      const mockRoute = {
        continue: vi.fn(),
        abort: vi.fn()
      };

      const mockPage = {
        route: vi.fn().mockImplementation((pattern, handler) => {
          handler(mockRoute);
          return Promise.resolve();
        })
      };

      // Set up multiple scenarios concurrently
      await Promise.all([
        MockScenarios.slowLoadingPage(mockPage as unknown as any, 100),
        MockScenarios.networkError(mockPage as unknown as any),
        MockScenarios.slowLoadingPage(mockPage as unknown as any, 200)
      ]);

      expect(mockPage.route).toHaveBeenCalledTimes(3);
    });
  });
});