/**
 * @apexcli/browser
 *
 * Browser automation capabilities for APEX using Playwright.
 * This package provides browser automation tools for AI agents.
 */

// Export core classes
export { BrowserManager } from './browser-manager.js';
export { BrowserSession } from './browser-session.js';

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
  NavigationOptions,
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

// Export Playwright browser launcher functions for convenience
export { chromium, firefox, webkit } from 'playwright';

/**
 * Utility function to create a new browser manager
 */
export function createBrowserManager(config?: Partial<BrowserManagerConfig>) {
  return new BrowserManager(config);
}

/**
 * Utility function to create a new browser session
 */
export function createBrowserSession(
  manager: BrowserManager,
  config?: Partial<BrowserSessionConfig>,
  captureConfig?: Partial<CaptureConfig>
) {
  return new BrowserSession(manager, config, captureConfig);
}

/**
 * Utility function to launch a browser session with default configuration
 */
export async function launchBrowser(
  config?: Partial<BrowserSessionConfig>,
  captureConfig?: Partial<CaptureConfig>
): Promise<BrowserActionResult<BrowserSession>> {
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
  BrowserManager,
  BrowserSession,
  createBrowserManager,
  createBrowserSession,
  launchBrowser,
  chromium,
  firefox,
  webkit,
};