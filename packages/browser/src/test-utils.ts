/**
 * @apexcli/browser - Test Utils Main Export
 *
 * Central barrel export for all test utilities
 */

export * from './test-utils/index.js';

// Also export navigation helpers directly for convenience
export {
  goto,
  waitForNavigation,
  assertURL,
  assertPageContent
} from './navigation-helpers.js';

export type {
  AssertURLOptions,
  AssertPageContentOptions,
  NavigationHelperResult
} from './navigation-helpers.js';