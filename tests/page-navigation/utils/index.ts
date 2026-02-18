/**
 * @fileoverview Navigation testing utilities module
 *
 * This module exports all navigation testing utilities including:
 * - Navigation helpers (safe navigation, validation, performance measurement)
 * - Assertion helpers (URL, content, history assertions)
 * - Browser fixtures (page/context setup and teardown)
 *
 * @example
 * ```typescript
 * import {
 *   // Navigation helpers
 *   safeNavigate,
 *   waitForNavigationComplete,
 *   validateNavigation,
 *
 *   // Assertions
 *   assertURL,
 *   assertPageContent,
 *   assertHistoryLength,
 *
 *   // Fixtures
 *   createPageFixture,
 *   withNavigationPage,
 * } from '../utils';
 * ```
 */

// Navigation helpers
export {
  safeNavigate,
  safeNavigationClick,
  validateNavigation,
  measureNavigationPerformance,
  getNavigationHistory,
  waitForNavigationComplete,
  navigateBack,
  navigateForward,
  reloadPage,
  captureNavigationSnapshot,
  benchmarkNavigation,
  testCrossContextNavigation,
  NavigationEventMonitor,
  // Types
  type NavigationValidation,
  type NavigationPerformance,
  type NavigationHistory,
} from './navigation-helpers';

// Assertion helpers
export {
  assertURL,
  assertURLContains,
  assertURLMatches,
  assertPageTitle,
  assertElementExists,
  assertElementText,
  assertElementVisible,
  assertElementHidden,
  assertPageContent,
  assertHistoryLength,
  assertCanGoBack,
  assertCanGoForward,
  assertNavigationPerformance,
  assertLoadState,
  NavigationAssertionError,
  // Types
  type ContentAssertionOptions,
} from './assertions';

// Browser fixtures
export {
  createBrowserFixture,
  createPageFixture,
  withNavigationPage,
  withBrowserContext,
  createMultiPageFixture,
  createSharedContextPages,
  // Types
  type BrowserType,
  type BrowserFixtureOptions,
  type PageFixtureOptions,
  type BrowserFixture,
  type PageFixture,
} from './browser-fixtures';
