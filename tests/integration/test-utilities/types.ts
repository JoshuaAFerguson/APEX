/**
 * @fileoverview Integration Test Utility Types
 *
 * This file defines common types and interfaces used across all integration
 * test utilities in the APEX project.
 */

import type { AgentTool, PermissionLevel, Permission } from '@apex/core/types';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { MockedFunction } from 'vitest';

// ============================================================================
// Test Context Types
// ============================================================================

/**
 * Integration test context with cleanup tracking and resource management
 */
export interface IntegrationTestContext {
  /** Unique identifier for this test context */
  id: string;
  /** Temporary directories created during tests */
  tempDirs: Set<string>;
  /** Active orchestrator instances for cleanup */
  orchestrators: Set<{ shutdown: () => Promise<void> }>;
  /** Active API servers for cleanup */
  servers: Set<{ close: () => Promise<void> }>;
  /** Active database stores for cleanup */
  stores: Set<{ close: () => void }>;
  /** Active browser contexts for cleanup */
  browsers: Set<BrowserTestContext>;
  /** Mock functions created during tests */
  mocks: Set<MockedFunction<any>>;
  /** Test artifacts (screenshots, logs, etc.) */
  artifacts: Map<string, string>;
}

// ============================================================================
// Tool Mock Types
// ============================================================================

/**
 * Configuration for creating tool mocks
 */
export interface ToolMockConfig {
  /** Tool name to mock */
  tool: AgentTool;
  /** Whether the tool should succeed or fail */
  shouldSucceed?: boolean;
  /** Custom response to return */
  response?: any;
  /** Delay before responding (ms) */
  delay?: number;
  /** Number of times the tool should be called before failing */
  failAfterCalls?: number;
  /** Custom error to throw on failure */
  error?: Error;
  /** Whether to track all calls made to the tool */
  trackCalls?: boolean;
}

/**
 * Tool mock instance with tracking capabilities
 */
export interface ToolMock {
  /** The mocked function */
  mock: MockedFunction<any>;
  /** Configuration used to create this mock */
  config: ToolMockConfig;
  /** Calls made to this mock */
  calls: Array<{ args: any[]; timestamp: Date; result?: any; error?: Error }>;
  /** Reset the mock state */
  reset: () => void;
  /** Get call history */
  getCallHistory: () => Array<{ args: any[]; timestamp: Date; result?: any; error?: Error }>;
}

// ============================================================================
// Permission Test Types
// ============================================================================

/**
 * Permission test fixture configuration
 */
export interface PermissionFixtureConfig {
  /** Tool to create permission for */
  tool: string;
  /** Permission scope (optional) */
  scope?: string;
  /** Permission level */
  level: PermissionLevel;
  /** Whether permission should be expired */
  expired?: boolean;
  /** Custom expiry date */
  expiresAt?: Date;
  /** Custom created date */
  createdAt?: Date;
}

/**
 * Permission test scenario
 */
export interface PermissionTestScenario {
  /** Name of the scenario */
  name: string;
  /** Description of what this scenario tests */
  description: string;
  /** Permissions to set up for this scenario */
  permissions: PermissionFixtureConfig[];
  /** Expected behavior */
  expectedBehavior: {
    /** Tools that should be allowed */
    allowedTools: string[];
    /** Tools that should be denied */
    deniedTools: string[];
    /** Tools that should prompt for permission */
    promptTools: string[];
  };
}

// ============================================================================
// Browser Test Types
// ============================================================================

/**
 * Browser test context for automation testing
 */
export interface BrowserTestContext {
  /** Browser instance */
  browser: Browser;
  /** Browser context */
  context: BrowserContext;
  /** Primary page */
  page: Page;
  /** Additional pages created during testing */
  additionalPages: Page[];
  /** Screenshots taken during testing */
  screenshots: Map<string, Buffer>;
  /** Console messages captured */
  consoleMessages: Array<{
    type: string;
    text: string;
    timestamp: Date;
  }>;
  /** Network requests made */
  networkRequests: Array<{
    url: string;
    method: string;
    timestamp: Date;
    status?: number;
  }>;
  /** Test-specific metadata */
  metadata: Map<string, any>;
  /** Cleanup function */
  cleanup: () => Promise<void>;
}

/**
 * Browser test configuration
 */
export interface BrowserTestConfig {
  /** Browser type to use */
  browserType: 'chromium' | 'firefox' | 'webkit';
  /** Whether to run headless */
  headless: boolean;
  /** Viewport size */
  viewport: { width: number; height: number };
  /** Whether to enable devtools */
  devtools?: boolean;
  /** Slow motion delay (ms) */
  slowMo?: number;
  /** Default timeout (ms) */
  timeout?: number;
  /** Whether to capture screenshots on failure */
  screenshotOnFailure?: boolean;
  /** Whether to capture console messages */
  captureConsole?: boolean;
  /** Whether to capture network requests */
  captureNetwork?: boolean;
  /** Permissions to grant */
  permissions?: string[];
  /** Geolocation to set */
  geolocation?: { latitude: number; longitude: number };
  /** User agent to use */
  userAgent?: string;
}

/**
 * Browser automation operation
 */
export interface BrowserOperation {
  /** Type of operation */
  type: 'navigate' | 'click' | 'type' | 'screenshot' | 'wait' | 'evaluate' | 'select';
  /** Target selector (for element operations) */
  selector?: string;
  /** Value to input (for type/select operations) */
  value?: string;
  /** URL to navigate to */
  url?: string;
  /** Wait condition */
  waitFor?: {
    selector?: string;
    timeout?: number;
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
  };
  /** JavaScript code to evaluate */
  code?: string;
  /** Expected result */
  expectedResult?: any;
  /** Description of the operation */
  description?: string;
}

/**
 * Browser test scenario
 */
export interface BrowserTestScenario {
  /** Name of the scenario */
  name: string;
  /** Description of what this scenario tests */
  description: string;
  /** Initial page setup */
  setup?: {
    /** URL to start with */
    url?: string;
    /** HTML content to load */
    content?: string;
    /** Initial JavaScript to execute */
    scripts?: string[];
  };
  /** Operations to perform */
  operations: BrowserOperation[];
  /** Assertions to make after operations */
  assertions?: Array<{
    type: 'element-exists' | 'element-text' | 'page-url' | 'console-message';
    selector?: string;
    expected: any;
    description?: string;
  }>;
  /** Cleanup steps */
  cleanup?: BrowserOperation[];
}

// ============================================================================
// Wait Condition Types
// ============================================================================

/**
 * Wait condition options
 */
export interface WaitOptions {
  /** Maximum time to wait in milliseconds */
  timeout?: number;
  /** Interval between checks in milliseconds */
  interval?: number;
  /** Error message if condition is not met */
  message?: string;
}

/**
 * Wait condition function
 */
export type WaitCondition<T> = () => T | Promise<T>;

// ============================================================================
// Test Artifact Types
// ============================================================================

/**
 * Test artifact metadata
 */
export interface TestArtifact {
  /** Artifact type */
  type: 'screenshot' | 'log' | 'html' | 'json' | 'video';
  /** File path or content */
  content: string | Buffer;
  /** When the artifact was created */
  createdAt: Date;
  /** Description of the artifact */
  description?: string;
  /** Associated test name */
  testName?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}