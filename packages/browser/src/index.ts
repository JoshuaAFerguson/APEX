/**
 * @apexcli/browser
 *
 * Browser automation capabilities for APEX using Playwright.
 * This package provides browser automation tools for AI agents.
 */

// Import core classes for re-export and use in utility functions
import { BrowserManager as BrowserManagerClass } from './browser-manager.js';
import { BrowserSession as BrowserSessionClass } from './browser-session.js';
import type {
  BrowserManagerConfig,
  BrowserSessionConfig,
  CaptureConfig,
  BrowserActionResult,
} from './types.js';

// Export core classes
export { BrowserManagerClass as BrowserManager };
export { BrowserSessionClass as BrowserSession };

// Export types and interfaces
export type {
  // Playwright re-exports
  Browser,
  BrowserContext,
  Page,
  ElementHandle,
  Locator,
  Frame,
  JSHandle,
  Request,
  Response,
  Route,
  WebSocket,
  ConsoleMessage,
  Dialog,
  Download,
  FileChooser,
  Keyboard,
  Mouse,
  Touchscreen,
  BrowserType,
  LaunchOptions,
  BrowserContextOptions,

  // Browser automation types
  SupportedBrowserType,
  BrowserSessionConfig,
  BrowserManagerConfig,
  BrowserInstanceInfo,
  BrowserContextInfo,
  BrowserManagerEvents,
  ScreenshotOptions,
  ScreenshotCaptureOptions,
  ElementScreenshotOptions,
  NavigationOptions,
  WaitForNavigationOptions,
  BrowserActionResult,
  ElementSelector,
  SelectorType,

  // Console and error capture types
  ConsoleLogLevel,
  CapturedConsoleMessage,
  CapturedJavaScriptError,
  PageErrorEvent,
  CaptureConfig,
  BrowserCaptureEvents,
} from './types.js';

// Export constants and defaults
export {
  defaultBrowserConfig,
  defaultManagerConfig,
  defaultCaptureConfig,
  BROWSER_LIMITS,
  MONITORING_INTERVALS,
  ERROR_MESSAGES,
  USER_AGENTS,
} from './constants.js';

// Import and export screenshot utilities
import {
  captureScreenshot as captureScreenshotFn,
  capturePNG as capturePNGFn,
  captureJPEG as captureJPEGFn,
  captureFullPageScreenshot as captureFullPageScreenshotFn,
  captureViewportScreenshot as captureViewportScreenshotFn,
} from './screenshot-utility.js';

export {
  captureScreenshotFn as captureScreenshot,
  capturePNGFn as capturePNG,
  captureJPEGFn as captureJPEG,
  captureFullPageScreenshotFn as captureFullPageScreenshot,
  captureViewportScreenshotFn as captureViewportScreenshot,
};

export type {
  ScreenshotFormat,
  ScreenshotCaptureOptions as ScreenshotUtilityOptions, // Renamed to avoid conflict with types.ts
  ScreenshotResult,
} from './screenshot-utility.js';

// Import and export navigation helpers
import {
  goto as gotoFn,
  waitForNavigation as waitForNavigationFn,
  assertURL as assertURLFn,
  assertPageContent as assertPageContentFn,
} from './navigation-helpers.js';

// Import and export permission mocking utilities
import {
  mockPermissions as mockPermissionsFn,
  isPermissionsMocked as isPermissionsMockedFn,
  getCurrentMockHandle as getCurrentMockHandleFn,
  withMockedPermissions as withMockedPermissionsFn,
  MockPermissionStatus as MockPermissionStatusClass,
} from './permission-mocking/index.js';

export {
  mockPermissionsFn as mockPermissions,
  isPermissionsMockedFn as isPermissionsMocked,
  getCurrentMockHandleFn as getCurrentMockHandle,
  withMockedPermissionsFn as withMockedPermissions,
  MockPermissionStatusClass as MockPermissionStatus,
};

export type {
  PermissionState,
  PermissionName,
  PermissionDescriptor,
  PermissionStateChangeHandler,
  MockPermissionDescriptor,
  MockPermissionStatus as MockPermissionStatusType,
  MockPermissionConfig,
  MockPermissionHandle,
  NavigatorWithMockedPermissions,
} from './permission-mocking/index.js';

// Import and export Playwright browser launcher functions for convenience
import { chromium as chromiumLauncher, firefox as firefoxLauncher, webkit as webkitLauncher } from 'playwright';

/**
 * Playwright Chromium browser type for direct launching
 * @see https://playwright.dev/docs/api/class-browsertype
 */
export { chromiumLauncher as chromium };

/**
 * Playwright Firefox browser type for direct launching
 * @see https://playwright.dev/docs/api/class-browsertype
 */
export { firefoxLauncher as firefox };

/**
 * Playwright WebKit browser type for direct launching
 * @see https://playwright.dev/docs/api/class-browsertype
 */
export { webkitLauncher as webkit };

/**
 * Creates a new browser manager instance with optional configuration
 *
 * @param config - Partial configuration to override default settings
 * @returns A new BrowserManager instance
 *
 * @example
 * ```typescript
 * const manager = createBrowserManager({
 *   maxInstances: 10,
 *   reuseInstances: true
 * });
 * ```
 */
export function createBrowserManager(config?: Partial<BrowserManagerConfig>) {
  return new BrowserManagerClass(config);
}

/**
 * Creates a new browser session instance with the given manager and configuration
 *
 * @param manager - Browser manager instance to use for creating the session
 * @param config - Partial session configuration to override defaults
 * @param captureConfig - Partial capture configuration for console/error monitoring
 * @returns A new BrowserSession instance
 *
 * @example
 * ```typescript
 * const manager = createBrowserManager();
 * const session = createBrowserSession(manager, {
 *   browserType: 'firefox',
 *   headless: false
 * }, {
 *   captureConsole: true,
 *   captureErrors: true
 * });
 * ```
 */
export function createBrowserSession(
  manager: BrowserManagerClass,
  config?: Partial<BrowserSessionConfig>,
  captureConfig?: Partial<CaptureConfig>
) {
  return new BrowserSessionClass(manager, config, captureConfig);
}

/**
 * Launches a new browser session with default configuration
 *
 * This is a convenience function that creates both a browser manager and session,
 * launches the browser, and returns the ready-to-use session.
 *
 * @param config - Partial session configuration to override defaults
 * @param captureConfig - Partial capture configuration for console/error monitoring
 * @returns Promise that resolves to a BrowserActionResult containing the launched session
 *
 * @throws Will return an error result if browser launch fails
 *
 * @example
 * ```typescript
 * const result = await launchBrowser({
 *   browserType: 'chrome',
 *   headless: true,
 *   viewport: { width: 1920, height: 1080 }
 * });
 *
 * if (result.success) {
 *   const session = result.data;
 *   await session.navigate('https://example.com');
 * }
 * ```
 */
export async function launchBrowser(
  config?: Partial<BrowserSessionConfig>,
  captureConfig?: Partial<CaptureConfig>
): Promise<BrowserActionResult<BrowserSessionClass>> {
  const startTime = Date.now();

  try {
    const manager = createBrowserManager();
    const session = createBrowserSession(manager, config, captureConfig);

    const launchResult = await session.launch();
    if (!launchResult.success) {
      return {
        success: false,
        error: launchResult.error,
        duration: Date.now() - startTime,
      };
    }

    return {
      success: true,
      data: session,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Default export containing all browser automation utilities
 *
 * Provides convenient access to all classes, functions, and utilities
 * in a single import for CommonJS compatibility.
 *
 * @example
 * ```typescript
 * import browser from '@apexcli/browser';
 *
 * const manager = browser.createBrowserManager();
 * const session = browser.createBrowserSession(manager);
 * ```
 */
// Import and export mock utilities
import {
  MockBrowserManager as MockBrowserManagerClass,
  MockBrowserSession as MockBrowserSessionClass,
  createMockBrowserManager as createMockBrowserManagerFn,
  createMockBrowserSession as createMockBrowserSessionFn,
  launchMockBrowser as launchMockBrowserFn,
  createMockSessionForTesting as createMockSessionForTestingFn,
  createUnreliableMockSession as createUnreliableMockSessionFn,
  createMockScenario as createMockScenarioFn,
  commonScenarios as commonMockScenarios,
  defaultMockConfig as defaultMockConfigValue,
} from './mocks/index.js';

export {
  MockBrowserManagerClass as MockBrowserManager,
  MockBrowserSessionClass as MockBrowserSession,
  createMockBrowserManagerFn as createMockBrowserManager,
  createMockBrowserSessionFn as createMockBrowserSession,
  launchMockBrowserFn as launchMockBrowser,
  createMockSessionForTestingFn as createMockSessionForTesting,
  createUnreliableMockSessionFn as createUnreliableMockSession,
  createMockScenarioFn as createMockScenario,
  commonMockScenarios as commonMockScenarios,
  defaultMockConfigValue as defaultMockConfig,
};

export type {
  MockBehaviorConfig,
  MockScenarioConfig,
  MockNavigationResult,
  MockElement,
  MockScreenshot,
  MockPageState,
  MockBrowserSessionConfig,
  MockOperation,
  MockBrowserEvents,
  MockBrowserManagerState,
  MockResponse,
  MockResponseFactory,
  MockScenarioBuilder,
  MockUrlBehavior,
  MockElementBehavior,
  MockOperationBehavior,
} from './mocks/index.js';

// Export navigation helpers
export {
  gotoFn as goto,
  waitForNavigationFn as waitForNavigation,
  assertURLFn as assertURL,
  assertPageContentFn as assertPageContent,
};

export type {
  AssertURLOptions,
  AssertPageContentOptions,
  NavigationHelperResult,
} from './navigation-helpers.js';

// Export test utilities
export * from './test-utils.js';

export default {
  BrowserManager: BrowserManagerClass,
  BrowserSession: BrowserSessionClass,
  createBrowserManager,
  createBrowserSession,
  launchBrowser,
  captureScreenshot: captureScreenshotFn,
  capturePNG: capturePNGFn,
  captureJPEG: captureJPEGFn,
  captureFullPageScreenshot: captureFullPageScreenshotFn,
  captureViewportScreenshot: captureViewportScreenshotFn,
  // Navigation helpers
  goto: gotoFn,
  waitForNavigation: waitForNavigationFn,
  assertURL: assertURLFn,
  assertPageContent: assertPageContentFn,
  chromium: chromiumLauncher,
  firefox: firefoxLauncher,
  webkit: webkitLauncher,
  // Permission mocking utilities
  mockPermissions: mockPermissionsFn,
  isPermissionsMocked: isPermissionsMockedFn,
  getCurrentMockHandle: getCurrentMockHandleFn,
  withMockedPermissions: withMockedPermissionsFn,
  MockPermissionStatus: MockPermissionStatusClass,
  // Browser mocking utilities
  MockBrowserManager: MockBrowserManagerClass,
  MockBrowserSession: MockBrowserSessionClass,
  createMockBrowserManager: createMockBrowserManagerFn,
  createMockBrowserSession: createMockBrowserSessionFn,
  launchMockBrowser: launchMockBrowserFn,
  createMockSessionForTesting: createMockSessionForTestingFn,
  createUnreliableMockSession: createUnreliableMockSessionFn,
  createMockScenario: createMockScenarioFn,
  commonMockScenarios,
  defaultMockConfig: defaultMockConfigValue,
};