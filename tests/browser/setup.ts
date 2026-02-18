/**
 * @fileoverview Setup file for browser tests using Vitest + Playwright
 *
 * This setup file provides:
 * - Global browser test utilities
 * - Common test setup and teardown
 * - Browser-specific configurations
 * - Integration with APEX test infrastructure
 */

import { beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// Global browser test context
declare global {
  interface Window {
    __APEX_TEST_MODE__: boolean;
    __APEX_TEST_UTILS__: any;
  }
}

// Global setup for all browser tests
beforeAll(async () => {
  console.log('🚀 Setting up browser test environment...');

  // Set global test mode flag
  if (typeof window !== 'undefined') {
    window.__APEX_TEST_MODE__ = true;
  }

  // Initialize test utilities
  await setupTestUtils();

  console.log('✅ Browser test environment ready');
});

// Global cleanup
afterAll(async () => {
  console.log('🧹 Cleaning up browser test environment...');

  // Clean up any global resources
  if (typeof window !== 'undefined') {
    window.__APEX_TEST_MODE__ = false;
    window.__APEX_TEST_UTILS__ = undefined;
  }

  console.log('✅ Browser test cleanup completed');
});

// Per-test setup
beforeEach(async () => {
  // Reset browser state for each test
  if (typeof window !== 'undefined') {
    // Clear local storage
    window.localStorage.clear();
    window.sessionStorage.clear();

    // Reset any global state
    if (window.__APEX_TEST_UTILS__) {
      window.__APEX_TEST_UTILS__.reset?.();
    }
  }
});

// Per-test cleanup
afterEach(async () => {
  // Capture screenshot on failure if needed
  // This will be handled by Vitest's screenshot configuration
});

/**
 * Initialize test utilities in the browser environment
 */
async function setupTestUtils() {
  if (typeof window === 'undefined') {
    return; // Not in browser environment
  }

  // Create test utilities object
  window.__APEX_TEST_UTILS__ = {
    // Utility to wait for element
    waitForElement: async (selector: string, timeout = 5000): Promise<Element> => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const element = document.querySelector(selector);
        if (element) {
          return element;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Element ${selector} not found within ${timeout}ms`);
    },

    // Utility to wait for condition
    waitFor: async (condition: () => boolean, timeout = 5000): Promise<void> => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (condition()) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Condition not met within ${timeout}ms`);
    },

    // Utility to simulate user interaction
    simulateClick: async (selector: string): Promise<void> => {
      const element = await window.__APEX_TEST_UTILS__.waitForElement(selector);
      if (element instanceof HTMLElement) {
        element.click();
      }
    },

    // Utility to simulate typing
    simulateType: async (selector: string, text: string): Promise<void> => {
      const element = await window.__APEX_TEST_UTILS__.waitForElement(selector);
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.focus();
        element.value = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },

    // Reset function for per-test cleanup
    reset: (): void => {
      // Reset any test-specific state
    },
  };
}

// Export utilities for use in test files
export const browserUtils = {
  /**
   * Create a test page with basic HTML structure
   */
  createTestPage: (content: string): void => {
    if (typeof document !== 'undefined') {
      document.body.innerHTML = content;
    }
  },

  /**
   * Wait for network requests to complete
   */
  waitForNetworkIdle: async (timeout = 5000): Promise<void> => {
    // Implementation depends on browser capabilities
    await new Promise(resolve => setTimeout(resolve, 100));
  },

  /**
   * Get browser information
   */
  getBrowserInfo: (): object => {
    if (typeof navigator === 'undefined') {
      return { userAgent: 'test-environment' };
    }

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
    };
  },
};