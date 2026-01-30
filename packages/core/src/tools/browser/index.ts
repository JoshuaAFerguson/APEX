/**
 * @fileoverview Browser tools module exports
 *
 * This module exports browser automation tools for page interaction,
 * testing, and visual regression testing within the APEX platform.
 *
 * @module @apex/core/tools/browser
 */

// Browser tool exports
export {
  BrowserTool,
  type BrowserToolInput,
  type BrowserToolOutput,
  type BrowserOperation,
  type BrowserToolOptions,
} from './browser-tool.js';

// Mock browser exports
export {
  MockBrowserImpl,
  MockPageImpl,
  MockElementImpl,
  createSuccessMockBrowser,
  createFailureMockBrowser,
  createIntermittentMockBrowser,
  createRealisticMockBrowser,
  createSequenceMockBrowser,
  createMockScreenshotComparison,
  createMockConsoleMessages,
  createMockBrowserErrors,
  MockBrowserConfigSchema,
  MockBrowserModeSchema,
  MockBrowserErrorTypeSchema,
  MockNetworkConditionSchema,
  MockOperationOutcomeSchema,
  type MockBrowserConfig,
  type MockBrowserMode,
  type MockBrowserErrorType,
  type MockNetworkCondition,
  type MockOperationOutcome,
  type MockElement,
  type MockPage,
  type MockBrowser,
} from './mock-browser.js';

// Tool registry convenience functions (re-exported from register module)
export {
  registerBrowserTools,
  registerBrowserToolsGlobal,
  registerBrowserTool,
  createBrowserTool,
  browserToolClasses,
  browserTools,
} from './register.js';

// Browser error classes
export {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  toBrowserPermissionDeniedError,
  type BrowserPermissionDeniedContext,
} from './browser-permission-denied-error.js';
