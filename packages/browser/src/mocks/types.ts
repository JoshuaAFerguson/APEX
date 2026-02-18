/**
 * @apexcli/browser/mocks - Mock Type Definitions
 *
 * Mock browser automation types and interfaces for testing and simulation
 */

import type {
  BrowserActionResult,
  ElementSelector,
  NavigationOptions,
  WaitForNavigationOptions,
  ScreenshotCaptureOptions,
  ElementScreenshotOptions,
  SupportedBrowserType,
  BrowserSessionConfig,
  CapturedConsoleMessage,
  CapturedJavaScriptError,
} from '../types.js';

/**
 * Configuration for controlling mock behavior
 */
export interface MockBehaviorConfig {
  /** Whether operations should succeed by default */
  defaultSuccess: boolean;
  /** Default delay in milliseconds for simulating operation time */
  defaultDelay: number;
  /** Simulated failure rate (0-1) */
  failureRate?: number;
  /** Whether to use realistic delays */
  useRealisticDelays: boolean;
}

/**
 * Configuration for mock scenario behavior
 */
export interface MockScenarioConfig {
  /** Specific operation overrides */
  operations?: {
    [operationName: string]: {
      success: boolean;
      delay?: number;
      error?: string;
      returnValue?: any;
    };
  };
  /** URL-specific behavior */
  urlBehaviors?: {
    [url: string]: {
      loadTime?: number;
      shouldFail?: boolean;
      error?: string;
    };
  };
  /** Element selector behaviors */
  elementBehaviors?: {
    [selector: string]: {
      exists?: boolean;
      visible?: boolean;
      enabled?: boolean;
      text?: string;
      value?: string;
    };
  };
}

/**
 * Mock navigation result with simulated data
 */
export interface MockNavigationResult {
  /** Final URL after navigation */
  url: string;
  /** Page title */
  title: string;
  /** Simulated load time in milliseconds */
  loadTime: number;
  /** Whether navigation was successful */
  success: boolean;
}

/**
 * Mock element data for simulating element interactions
 */
export interface MockElement {
  /** Selector used to find this element */
  selector: string;
  /** Whether element exists in the page */
  exists: boolean;
  /** Whether element is visible */
  visible: boolean;
  /** Whether element is enabled/clickable */
  enabled: boolean;
  /** Element text content */
  text?: string;
  /** Element value (for inputs) */
  value?: string;
  /** Element attributes */
  attributes?: Record<string, string>;
  /** Element bounding box */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Mock screenshot data
 */
export interface MockScreenshot {
  /** Simulated image data (base64) */
  data: string;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Image format */
  format: 'png' | 'jpeg';
  /** Capture time in milliseconds */
  captureTime: number;
}

/**
 * Mock page state for tracking page data
 */
export interface MockPageState {
  /** Current URL */
  url: string;
  /** Page title */
  title: string;
  /** Whether page is loaded */
  loaded: boolean;
  /** Elements on the page */
  elements: Map<string, MockElement>;
  /** Console messages */
  consoleMessages: CapturedConsoleMessage[];
  /** JavaScript errors */
  errors: CapturedJavaScriptError[];
  /** Page content (for text searches) */
  content?: string;
  /** Viewport dimensions */
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * Mock browser session configuration
 */
export interface MockBrowserSessionConfig extends Partial<BrowserSessionConfig> {
  /** Mock behavior configuration */
  mockConfig: MockBehaviorConfig;
  /** Scenario-specific configurations */
  scenarioConfig?: MockScenarioConfig;
  /** Whether to track all operations */
  trackOperations: boolean;
}

/**
 * Operation tracking for monitoring mock usage
 */
export interface MockOperation {
  /** Operation name */
  name: string;
  /** Operation arguments */
  args: any[];
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Whether operation succeeded */
  success?: boolean;
  /** Error message if failed */
  error?: string;
  /** Return value */
  result?: any;
}

/**
 * Events emitted by mock browser components
 */
export interface MockBrowserEvents {
  /** Emitted when an operation is performed */
  operation: (operation: MockOperation) => void;
  /** Emitted when navigation occurs */
  navigation: (result: MockNavigationResult) => void;
  /** Emitted when an element interaction occurs */
  elementInteraction: (selector: string, action: string, success: boolean) => void;
  /** Emitted when a screenshot is taken */
  screenshot: (options: ScreenshotCaptureOptions, result: MockScreenshot) => void;
  /** Emitted when page state changes */
  stateChange: (state: MockPageState) => void;
}

/**
 * Mock browser manager state
 */
export interface MockBrowserManagerState {
  /** Number of active sessions */
  activeSessions: number;
  /** Session configurations */
  sessions: Map<string, MockBrowserSessionConfig>;
  /** Whether manager is initialized */
  initialized: boolean;
}

/**
 * Interface for configurable mock responses
 */
export interface MockResponse<T = any> {
  /** Whether the operation should succeed */
  success: boolean;
  /** Response data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Simulated delay in milliseconds */
  delay?: number;
}

/**
 * Factory function type for creating mock responses
 */
export type MockResponseFactory<T = any> = (
  operationName: string,
  args: any[]
) => MockResponse<T> | Promise<MockResponse<T>>;

/**
 * Configuration for advanced mock scenarios
 */
export interface MockScenarioBuilder {
  /** Add URL-specific behavior */
  forUrl(url: string): MockUrlBehavior;
  /** Add element-specific behavior */
  forElement(selector: string): MockElementBehavior;
  /** Add operation-specific behavior */
  forOperation(operationName: string): MockOperationBehavior;
  /** Build the final scenario configuration */
  build(): MockScenarioConfig;
}

/**
 * URL-specific mock behavior builder
 */
export interface MockUrlBehavior {
  /** Set load time for this URL */
  loadTime(ms: number): MockUrlBehavior;
  /** Make this URL fail to load */
  fails(error?: string): MockUrlBehavior;
  /** Set page content */
  withContent(content: string): MockUrlBehavior;
  /** Set page title */
  withTitle(title: string): MockUrlBehavior;
  /** Return to scenario builder */
  and(): MockScenarioBuilder;
}

/**
 * Element-specific mock behavior builder
 */
export interface MockElementBehavior {
  /** Set element existence */
  exists(exists?: boolean): MockElementBehavior;
  /** Set element visibility */
  visible(visible?: boolean): MockElementBehavior;
  /** Set element enabled state */
  enabled(enabled?: boolean): MockElementBehavior;
  /** Set element text content */
  withText(text: string): MockElementBehavior;
  /** Set element value */
  withValue(value: string): MockElementBehavior;
  /** Return to scenario builder */
  and(): MockScenarioBuilder;
}

/**
 * Operation-specific mock behavior builder
 */
export interface MockOperationBehavior {
  /** Make operation succeed */
  succeeds(returnValue?: any): MockOperationBehavior;
  /** Make operation fail */
  fails(error: string): MockOperationBehavior;
  /** Set operation delay */
  withDelay(ms: number): MockOperationBehavior;
  /** Return to scenario builder */
  and(): MockScenarioBuilder;
}