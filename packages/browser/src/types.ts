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
 * Browser types supported by the automation system
 */
export type SupportedBrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Configuration options for browser automation sessions
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
 * Browser Manager configuration
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
 * Screenshot options for browser automation
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
 * Navigation options for page navigation
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
 * Result of a browser action
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
 * Element selector types supported
 */
export type SelectorType = 'css' | 'xpath' | 'text' | 'role' | 'testId';

/**
 * Element selector with type specification
 */
export interface ElementSelector {
  /** Selector type */
  type: SelectorType;
  /** Selector value */
  value: string;
}

/**
 * Browser instance metadata
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
 * Browser context metadata
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
 * Console message types from browser
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
 * Console message captured from the browser
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
 * JavaScript error captured from browser
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
 * Page error event from browser (for runtime errors)
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
 * Console and error capture configuration
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
 * Event emitter for real-time console and error streaming
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
 * Browser Manager events
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