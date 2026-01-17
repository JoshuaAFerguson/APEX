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

// Import and export Playwright browser launcher functions for convenience
import { chromium as chromiumLauncher, firefox as firefoxLauncher, webkit as webkitLauncher } from 'playwright';
export { chromiumLauncher as chromium, firefoxLauncher as firefox, webkitLauncher as webkit };

/**
 * Utility function to create a new browser manager
 */
export function createBrowserManager(config?: Partial<BrowserManagerConfig>) {
  return new BrowserManagerClass(config);
}

/**
 * Utility function to create a new browser session
 */
export function createBrowserSession(
  manager: BrowserManagerClass,
  config?: Partial<BrowserSessionConfig>,
  captureConfig?: Partial<CaptureConfig>
) {
  return new BrowserSessionClass(manager, config, captureConfig);
}

/**
 * Utility function to launch a browser session with default configuration
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

// Default export for convenience
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
  chromium: chromiumLauncher,
  firefox: firefoxLauncher,
  webkit: webkitLauncher,
};