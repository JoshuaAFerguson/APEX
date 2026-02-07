/**
 * @fileoverview APEX Page Navigation Testing Infrastructure
 *
 * This module provides a comprehensive testing infrastructure for browser navigation tests.
 * It includes utilities, fixtures, and setup functions for validating navigation flows,
 * URL routing, history management, and page content.
 *
 * ## Features
 *
 * - **Navigation Helpers**: Safe navigation with retry logic, click handling, history navigation
 * - **Assertion Helpers**: URL, content, and navigation state assertions
 * - **Browser Fixtures**: Isolated browser contexts with automatic cleanup
 * - **Test Scenarios**: Pre-built scenarios for common navigation patterns
 * - **Performance Measurement**: Navigation timing and benchmarking utilities
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   createPageFixture,
 *   safeNavigate,
 *   assertURL,
 *   assertPageContent,
 * } from '@test/page-navigation';
 *
 * describe('My Navigation Tests', () => {
 *   let fixture;
 *
 *   beforeEach(async () => {
 *     fixture = await createPageFixture({ baseURL: 'http://localhost:3000' });
 *   });
 *
 *   afterEach(async () => {
 *     await fixture.cleanup();
 *   });
 *
 *   it('should navigate to dashboard', async () => {
 *     await safeNavigate(fixture.page, '/dashboard');
 *     await assertURL(fixture.page, /\/dashboard$/);
 *     await assertPageContent(fixture.page, {
 *       hasElement: 'h1',
 *       pageTitle: 'Dashboard',
 *     });
 *   });
 * });
 * ```
 *
 * ## Using Fixtures with Scoped Helpers
 *
 * ```typescript
 * import { withNavigationPage, assertURL } from '@test/page-navigation';
 *
 * it('should navigate', async () => {
 *   await withNavigationPage(async (page) => {
 *     await page.goto('/');
 *     await assertURL(page, /\/$/);
 *   }, { baseURL: 'http://localhost:3000' });
 * });
 * ```
 *
 * ## Running Pre-built Scenarios
 *
 * ```typescript
 * import {
 *   createPageFixture,
 *   NAVIGATION_SCENARIOS,
 *   runNavigationScenario,
 * } from '@test/page-navigation';
 *
 * it('should run basic navigation scenario', async () => {
 *   const fixture = await createPageFixture();
 *   const scenario = NAVIGATION_SCENARIOS.find(s => s.name === 'basic-page-navigation');
 *
 *   const result = await runNavigationScenario(fixture.page, scenario, 'http://localhost:3000');
 *   expect(result.success).toBe(true);
 *
 *   await fixture.cleanup();
 * });
 * ```
 *
 * @module @test/page-navigation
 */

// Re-export utilities
export * from './utils';

// Re-export fixtures
export * from './fixtures';

// Re-export setup utilities
export {
  createNavigationBrowser,
  createNavigationContext,
  createNavigationPage,
  captureNavigationScreenshot,
  waitForNavigationComplete,
  getNavigationMetrics,
  createMockServer,
  mockNavigationDependencies,
  // Config
  DEFAULT_NAVIGATION_CONFIG,
  // Types
  type NavigationTestConfig,
  type NavigationTestContext,
} from './setup';
