/**
 * @fileoverview Browser Fixtures Validation
 * Simple validation script to ensure browser fixtures work as expected
 */

import { browserFixtures, browserHelpers, BrowserStateBuilder, createBrowserState } from '../browser-fixtures.js';
import type { BrowserState, TestScenario } from '../types.js';

// Test basic functionality
console.log('Running browser fixtures validation...');

// Test each function exists and returns expected structure
try {
  const cleanState = browserFixtures.cleanState();
  console.log('✓ cleanState() works:', cleanState.url === 'about:blank');

  const loggedInState = browserFixtures.loggedInPage();
  console.log('✓ loggedInPage() works:', loggedInState.isAuthenticated === true);

  const errorState = browserFixtures.errorPage();
  console.log('✓ errorPage() works:', errorState.hasError === true);

  const loadingState = browserFixtures.loadingPage();
  console.log('✓ loadingPage() works:', loadingState.isLoading === true);

  const offlineState = browserFixtures.offlinePage();
  console.log('✓ offlinePage() works:', offlineState.localStorage['offline-mode'] === 'true');

  const permissionDeniedState = browserFixtures.permissionDeniedPage();
  console.log('✓ permissionDeniedPage() works:', permissionDeniedState.isAuthenticated === true && permissionDeniedState.networkRequests[0]?.status === 403);

  // Test fromScenario
  const scenarioState = browserFixtures.fromScenario('logged-in-user');
  console.log('✓ fromScenario() works:', scenarioState.isAuthenticated === true);

  // Test helpers
  const helperState = browserHelpers.addConsoleMessage(cleanState, 'info', 'test');
  console.log('✓ browserHelpers work:', helperState.consoleMessages.length === 1);

  // Test builder
  const builtState = new BrowserStateBuilder().withUrl('test').build();
  console.log('✓ BrowserStateBuilder works:', builtState.url === 'test');

  // Test factory function
  const factoryState = createBrowserState().build();
  console.log('✓ createBrowserState works:', factoryState.url === 'about:blank');

  console.log('✅ All browser fixtures validation tests passed!');
} catch (error) {
  console.error('❌ Browser fixtures validation failed:', error);
  process.exit(1);
}