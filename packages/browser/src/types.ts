/**
 * @apexcli/browser - Type Definitions
 *
 * Browser automation types and interfaces for APEX agents
 */

import type {
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
  BrowserContextOptions
} from 'playwright';

// Re-export Playwright types for convenience
export type {
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
} from 'playwright';

/**
 * Browser types supported by the automation system.
 *
 * @example
 * ```typescript
 * import type { SupportedBrowserType } from '@apexcli/browser';
 *
 * const browserType: SupportedBrowserType = 'chromium';
 * ```
 */
export type SupportedBrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Configuration options for browser automation sessions.
 *
 * Defines the browser settings, viewport dimensions, timeouts,
 * and other options for creating a browser automation session.
 *
 * @example
 * ```typescript
 * import type { BrowserSessionConfig } from '@apexcli/browser';
 *
 * const config: BrowserSessionConfig = {
 *   browserType: 'chromium',
 *   headless: false,
 *   viewport: { width: 1920, height: 1080 },
 *   timeout: 60000,
 *   userAgent: 'custom-agent-string',
 *   ignoreHTTPSErrors: true
 * };
 * ```
 */
export interface BrowserSessionConfig {
  /** Browser type to use */
  browserType: SupportedBrowserType;
  /** Whether to run in headless mode */
  headless: boolean;
  /** Viewport dimensions */
  viewport?: {
    width: number;
    height: number;
  };
  /** Default timeout in milliseconds */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
  /** Whether to ignore HTTPS errors */
  ignoreHTTPSErrors?: boolean;
  /** Additional launch options for Playwright */
  launchOptions?: Partial<LaunchOptions>;
  /** Additional context options for Playwright */
  contextOptions?: Partial<BrowserContextOptions>;
}

/**
 * Browser Manager configuration options.
 *
 * Controls browser instance management, resource limits,
 * pooling behavior, and cleanup timeouts.
 *
 * @example
 * ```typescript
 * import type { BrowserManagerConfig } from '@apexcli/browser';
 *
 * const config: BrowserManagerConfig = {
 *   maxInstances: 10,
 *   instanceIdleTimeout: 300000, // 5 minutes
 *   reuseInstances: true,
 *   resourceLimits: {
 *     maxMemoryMB: 2048,
 *     maxCpuPercent: 90
 *   }
 * };
 * ```
 */
export interface BrowserManagerConfig {
  /** Maximum number of concurrent browser instances */
  maxInstances?: number;
  /** Default session configuration */
  defaultSessionConfig?: Partial<BrowserSessionConfig>;
  /** Browser instance idle timeout in milliseconds */
  instanceIdleTimeout?: number;
  /** Whether to reuse browser instances */
  reuseInstances?: boolean;
  /** Global resource limits */
  resourceLimits?: {
    /** Maximum memory usage in MB */
    maxMemoryMB?: number;
    /** Maximum CPU usage percentage */
    maxCpuPercent?: number;
  };
}

/**
 * Screenshot options for browser automation.
 *
 * Defines format, quality, and capture settings for taking
 * screenshots of web pages or elements.
 *
 * @example
 * ```typescript
 * import type { ScreenshotOptions } from '@apexcli/browser';
 *
 * const options: ScreenshotOptions = {
 *   fullPage: true,
 *   type: 'jpeg',
 *   quality: 90,
 *   omitBackground: true,
 *   path: './screenshot.jpg'
 * };
 * ```
 */
export interface ScreenshotOptions {
  /** Full page screenshot */
  fullPage?: boolean;
  /** Output path for the screenshot */
  path?: string;
  /** Image format */
  type?: 'png' | 'jpeg';
  /** JPEG quality (0-100) */
  quality?: number;
  /** Whether to omit background */
  omitBackground?: boolean;
}

/**
 * Options for screenshot capture methods (captureViewport, captureFullPage).
 *
 * Specialized screenshot options for utility methods that provide
 * simplified interfaces for common screenshot operations.
 *
 * @example
 * ```typescript
 * import type { ScreenshotCaptureOptions } from '@apexcli/browser';
 *
 * const options: ScreenshotCaptureOptions = {
 *   type: 'png',
 *   omitBackground: false,
 *   path: './capture.png'
 * };
 * ```
 */
export interface ScreenshotCaptureOptions {
  /** Image format - PNG or JPEG */
  type?: 'png' | 'jpeg';
  /** JPEG quality (0-100). Only applies when type is 'jpeg' */
  quality?: number;
  /** Optional file path to save the screenshot */
  path?: string;
  /** Whether to omit the background (transparent for PNG) */
  omitBackground?: boolean;
}

/**
 * Options for element screenshot capture
 */
export interface ElementScreenshotOptions extends ScreenshotCaptureOptions {
  /** Timeout in milliseconds for finding the element */
  timeout?: number;
}

/**
 * Navigation options for page navigation.
 *
 * Controls timing, wait conditions, and referrer for page navigation.
 * Used with navigate, goto, and other navigation methods.
 *
 * @example
 * ```typescript
 * import type { NavigationOptions } from '@apexcli/browser';
 *
 * const options: NavigationOptions = {
 *   timeout: 60000,
 *   waitUntil: 'networkidle',
 *   referer: 'https://example.com'
 * };
 * ```
 */
export interface NavigationOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** When to consider navigation succeeded */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  /** Referer header value */
  referer?: string;
}

/**
 * Options for waitForNavigation method
 */
export interface WaitForNavigationOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** When to consider navigation succeeded */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  /** URL pattern to wait for (optional - string or RegExp) */
  url?: string | RegExp;
}

/**
 * Result of a browser action.
 *
 * Standard result interface for all browser operations providing
 * success status, optional data, error information, and timing.
 *
 * @template T The type of data returned on success
 *
 * @example
 * ```typescript
 * import type { BrowserActionResult } from '@apexcli/browser';
 *
 * const result: BrowserActionResult<string> = await session.navigate('https://example.com');
 * if (result.success) {
 *   console.log(`Navigated to: ${result.data}`);
 * } else {
 *   console.error(`Navigation failed: ${result.error}`);
 * }
 * ```
 */
export interface BrowserActionResult<T = unknown> {
  /** Whether the action succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Time taken in milliseconds */
  duration: number;
}

/**
 * Element selector types supported by the browser automation system.
 *
 * @example
 * ```typescript
 * import type { SelectorType } from '@apexcli/browser';
 *
 * const selectorType: SelectorType = 'xpath';
 * ```
 */
export type SelectorType = 'css' | 'xpath' | 'text' | 'role' | 'testId';

/**
 * Element selector with type specification.
 *
 * Structured selector object that specifies both the selector type
 * and value for targeting elements in the DOM.
 *
 * @example
 * ```typescript
 * import type { ElementSelector } from '@apexcli/browser';
 *
 * const selector: ElementSelector = {
 *   type: 'xpath',
 *   value: '//button[contains(text(), "Submit")]'
 * };
 *
 * const cssSelector: ElementSelector = {
 *   type: 'css',
 *   value: '.submit-button'
 * };
 * ```
 */
export interface ElementSelector {
  /** Selector type */
  type: SelectorType;
  /** Selector value */
  value: string;
}

/**
 * Browser instance metadata.
 *
 * Information about a managed browser instance including
 * identification, resource usage, and lifecycle state.
 *
 * @example
 * ```typescript
 * import type { BrowserInstanceInfo } from '@apexcli/browser';
 *
 * const instances: BrowserInstanceInfo[] = manager.getInstances();
 * instances.forEach(instance => {
 *   console.log(`Browser ${instance.id} (${instance.type}): ${instance.contextCount} contexts`);
 * });
 * ```
 */
export interface BrowserInstanceInfo {
  /** Unique identifier for the browser instance */
  id: string;
  /** Browser type */
  type: SupportedBrowserType;
  /** Process ID */
  pid?: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActiveAt: Date;
  /** Number of active contexts */
  contextCount: number;
  /** Whether the instance is currently in use */
  inUse: boolean;
  /** Resource usage information */
  resourceUsage?: {
    memoryMB: number;
    cpuPercent: number;
  };
}

/**
 * Browser context metadata.
 *
 * Information about a browser context including its parent browser,
 * configuration, and activity state.
 *
 * @example
 * ```typescript
 * import type { BrowserContextInfo } from '@apexcli/browser';
 *
 * const contexts: BrowserContextInfo[] = manager.getContexts();
 * contexts.forEach(context => {
 *   console.log(`Context ${context.id} in browser ${context.browserId}`);
 * });
 * ```
 */
export interface BrowserContextInfo {
  /** Unique identifier for the context */
  id: string;
  /** Parent browser instance ID */
  browserId: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActiveAt: Date;
  /** Number of active pages */
  pageCount: number;
  /** Configuration used for this context */
  config: BrowserSessionConfig;
}

/**
 * Console message types from browser.
 *
 * All supported console message levels that can be captured
 * during browser automation sessions.
 *
 * @example
 * ```typescript
 * import type { ConsoleLogLevel } from '@apexcli/browser';
 *
 * const level: ConsoleLogLevel = 'error';
 * const levels: ConsoleLogLevel[] = ['log', 'warn', 'error'];
 * ```
 */
export type ConsoleLogLevel =
  | 'log'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'assert'
  | 'dir'
  | 'dirxml'
  | 'table'
  | 'trace'
  | 'clear'
  | 'startGroup'
  | 'startGroupCollapsed'
  | 'endGroup'
  | 'profile'
  | 'profileEnd'
  | 'timeEnd'
  | 'count'
  | 'timeStamp';

/**
 * Console message captured from the browser.
 *
 * Represents a captured console log, warning, error, or other
 * console output with metadata about its origin and timing.
 *
 * @example
 * ```typescript
 * import type { CapturedConsoleMessage } from '@apexcli/browser';
 *
 * session.on('consoleMessage', (message: CapturedConsoleMessage) => {
 *   console.log(`[${message.type}] ${message.text} at ${new Date(message.timestamp)}`);
 *   if (message.location) {
 *     console.log(`  from ${message.location.url}:${message.location.lineNumber}`);
 *   }
 * });
 * ```
 */
export interface CapturedConsoleMessage {
  /** Message type/level */
  type: ConsoleLogLevel;
  /** Message text content */
  text: string;
  /** Arguments passed to console method */
  args: unknown[];
  /** URL where the message originated */
  location?: {
    url: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  /** Timestamp when the message occurred */
  timestamp: number;
}

/**
 * JavaScript error captured from browser.
 *
 * Represents a JavaScript runtime error with stack trace,
 * source location, and whether it was caught or uncaught.
 *
 * @example
 * ```typescript
 * import type { CapturedJavaScriptError } from '@apexcli/browser';
 *
 * session.on('javascriptError', (error: CapturedJavaScriptError) => {
 *   console.error(`${error.name}: ${error.message}`);
 *   if (error.source) {
 *     console.error(`  at ${error.source.url}:${error.source.line}`);
 *   }
 *   if (error.uncaught) {
 *     console.error('  (uncaught)');
 *   }
 * });
 * ```
 */
export interface CapturedJavaScriptError {
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Error name/type */
  name: string;
  /** Source location where error occurred */
  source?: {
    url: string;
    line?: number;
    column?: number;
  };
  /** Timestamp when error occurred */
  timestamp: number;
  /** Whether this error was caught or uncaught */
  uncaught: boolean;
}

/**
 * Page error event from browser (for runtime errors).
 *
 * Represents an error that occurred during page execution,
 * typically unhandled exceptions or critical runtime errors.
 *
 * @example
 * ```typescript
 * import type { PageErrorEvent } from '@apexcli/browser';
 *
 * session.on('pageError', (event: PageErrorEvent) => {
 *   console.error(`Page error: ${event.message}`);
 *   if (event.filename) {
 *     console.error(`  at ${event.filename}:${event.lineno}`);
 *   }
 * });
 * ```
 */
export interface PageErrorEvent {
  /** Error object */
  error: Error;
  /** Error message */
  message: string;
  /** Source filename */
  filename?: string;
  /** Line number */
  lineno?: number;
  /** Column number */
  colno?: number;
  /** Error stack trace */
  stack?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Console and error capture configuration.
 *
 * Controls what types of console messages and errors are captured,
 * buffer sizes, and capture behavior during browser automation.
 *
 * @example
 * ```typescript
 * import type { CaptureConfig } from '@apexcli/browser';
 *
 * const config: CaptureConfig = {
 *   captureConsole: true,
 *   consoleLevels: ['warn', 'error'],
 *   captureErrors: true,
 *   maxBufferSize: 500,
 *   includeStackTraces: false
 * };
 * ```
 */
export interface CaptureConfig {
  /** Whether to capture console messages */
  captureConsole: boolean;
  /** Which console levels to capture */
  consoleLevels?: ConsoleLogLevel[];
  /** Whether to capture JavaScript errors */
  captureErrors: boolean;
  /** Maximum number of messages to keep in buffer */
  maxBufferSize?: number;
  /** Whether to include stack traces for console messages */
  includeStackTraces?: boolean;
}

/**
 * Event emitter for real-time console and error streaming.
 *
 * Event listener interface for subscribing to console messages,
 * JavaScript errors, and page errors in real-time during automation.
 *
 * @example
 * ```typescript
 * import type { BrowserCaptureEvents } from '@apexcli/browser';
 * import { BrowserSession } from '@apexcli/browser';
 *
 * const session = new BrowserSession(manager);
 *
 * session.on('consoleMessage', (message) => {
 *   console.log(`Console: ${message.text}`);
 * });
 *
 * session.on('javascriptError', (error) => {
 *   console.error(`JS Error: ${error.message}`);
 * });
 * ```
 */
export interface BrowserCaptureEvents {
  /** Emitted when a console message is captured */
  consoleMessage: (message: CapturedConsoleMessage) => void;
  /** Emitted when a JavaScript error is captured */
  javascriptError: (error: CapturedJavaScriptError) => void;
  /** Emitted when a page error occurs */
  pageError: (error: PageErrorEvent) => void;
}

/**
 * Browser Manager events.
 *
 * Event listener interface for monitoring browser manager lifecycle
 * events, instance creation/closure, and resource limit violations.
 *
 * @example
 * ```typescript
 * import type { BrowserManagerEvents } from '@apexcli/browser';
 * import { BrowserManager } from '@apexcli/browser';
 *
 * const manager = new BrowserManager();
 *
 * manager.on('browserCreated', (info) => {
 *   console.log(`Browser created: ${info.id} (${info.type})`);
 * });
 *
 * manager.on('resourceLimitExceeded', (info) => {
 *   console.warn(`${info.type} limit exceeded: ${info.value}/${info.limit}`);
 * });
 * ```
 */
export interface BrowserManagerEvents {
  /** Emitted when a browser instance is created */
  browserCreated: (info: BrowserInstanceInfo) => void;
  /** Emitted when a browser instance is closed */
  browserClosed: (id: string) => void;
  /** Emitted when a browser context is created */
  contextCreated: (info: BrowserContextInfo) => void;
  /** Emitted when a browser context is closed */
  contextClosed: (id: string) => void;
  /** Emitted when resource usage exceeds limits */
  resourceLimitExceeded: (info: { type: 'memory' | 'cpu'; value: number; limit: number }) => void;
}