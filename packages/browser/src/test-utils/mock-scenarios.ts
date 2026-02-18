/**
 * @apexcli/browser - Mock Error Scenarios
 *
 * Migrated from __tests__/test-utils.ts
 */

// Import Page type for type annotations (type-only import)
import type { Page } from 'playwright';

/**
 * Mock error scenarios for testing
 */
export const MockScenarios = {
  /**
   * Create a page that will timeout
   */
  slowLoadingPage: async (page: Page, delay: number = 5000): Promise<void> => {
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), delay);
    });
  },

  /**
   * Create a page with network errors
   */
  networkError: async (page: Page): Promise<void> => {
    await page.route('**/*', route => {
      route.abort('failed');
    });
  },

  /**
   * Create a page that throws JavaScript errors
   */
  jsError: () => `
    <html>
      <body>
        <h1>JavaScript Error Test</h1>
        <script>
          // This will throw an error
          setTimeout(() => {
            throw new Error('Test JavaScript error');
          }, 100);
        </script>
      </body>
    </html>
  `
};