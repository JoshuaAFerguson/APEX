/**
 * @fileoverview Type definitions for test fixtures
 *
 * This module defines types specific to the test fixtures infrastructure.
 * It extends the core types with additional interfaces needed for test data generation.
 */

import type { ToolResult, ToolExecution, ToolInvocation, Task, TaskStatus, AgentDefinition } from '../types.js';

// ============================================================================
// Fixture Configuration Types
// ============================================================================

/**
 * Configuration options for tool response builders
 */
export interface ToolResponseOptions {
  /** Override the default success state */
  success?: boolean;
  /** Custom execution duration in milliseconds */
  duration?: number;
  /** Additional metadata to include */
  metadata?: Record<string, unknown>;
  /** Timestamp overrides */
  timestamps?: {
    invokedAt?: Date;
    completedAt?: Date;
  };
}

/**
 * Configuration options for tool request builders
 */
export interface ToolRequestOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Request ID for tracking */
  requestId?: string;
  /** Context information */
  context?: {
    taskId?: string;
    agentName?: string;
    stageName?: string;
  };
}

/**
 * Configuration options for task factory
 */
export interface TaskFactoryOptions {
  /** Task status override */
  status?: TaskStatus;
  /** Workflow type override */
  workflow?: string;
  /** Agent assignments */
  agents?: string[];
  /** Include usage data */
  includeUsage?: boolean;
  /** Include logs */
  includeLogs?: boolean;
  /** Include artifacts */
  includeArtifacts?: boolean;
}

/**
 * Configuration options for error simulation
 */
export interface ErrorSimulationOptions {
  /** Error category */
  category?: 'protocol' | 'transport' | 'validation' | 'runtime' | 'timeout' | 'network';
  /** Severity level */
  severity?: 'low' | 'medium' | 'high' | 'critical';
  /** Whether error should be retryable */
  retryable?: boolean;
  /** Custom error data */
  data?: Record<string, unknown>;
}

// ============================================================================
// Preset Collection Types
// ============================================================================

/**
 * Collection of error scenarios organized by type
 */
export interface ErrorPresetCollection {
  /** MCP protocol errors */
  mcp: Record<string, unknown>;
  /** Claude Agent SDK errors */
  agent: Record<string, Error>;
  /** Validation errors */
  validation: Record<string, unknown>;
  /** System-level errors */
  system: Record<string, Error>;
}

/**
 * Collection of tool response fixtures organized by tool type
 */
export interface ToolResponseCollection {
  /** File system tool responses */
  filesystem: {
    read: ToolResult[];
    write: ToolResult[];
    edit: ToolResult[];
    glob: ToolResult[];
    grep: ToolResult[];
  };
  /** Command execution responses */
  shell: {
    bash: ToolResult[];
  };
  /** Web operation responses */
  web: {
    webFetch: ToolResult[];
    webSearch: ToolResult[];
  };
}

/**
 * Collection of request template fixtures
 */
export interface RequestTemplateCollection {
  /** Tool invocation requests */
  tools: Record<string, ToolInvocation>;
  /** Task management requests */
  tasks: Record<string, Partial<Task>>;
  /** MCP requests */
  mcp: Record<string, unknown>;
  /** API requests */
  api: Record<string, unknown>;
}

// ============================================================================
// Builder Interface Types
// ============================================================================

/**
 * Base interface for all fixture builders
 */
export interface FixtureBuilder<T> {
  /** Build the fixture object */
  build(): T;
  /** Reset the builder to default state */
  reset(): this;
}

/**
 * Interface for builders that support chaining methods
 */
export interface FluentBuilder<T> extends FixtureBuilder<T> {
  /** Clone the current builder state */
  clone(): this;
}

// ============================================================================
// Factory Function Types
// ============================================================================

/**
 * Generic factory function type
 */
export type FixtureFactory<T, TOptions = Record<string, unknown>> = (
  overrides?: Partial<T>,
  options?: TOptions
) => T;

/**
 * Async factory function type
 */
export type AsyncFixtureFactory<T, TOptions = Record<string, unknown>> = (
  overrides?: Partial<T>,
  options?: TOptions
) => Promise<T>;

// ============================================================================
// Test Setup and Teardown Types
// ============================================================================

import { vi } from 'vitest';

// ============================================================================
// Mock Function Types
// ============================================================================

/**
 * Mock function type from Vitest
 */
export type MockFunction<T extends (...args: any[]) => any = (...args: any[]) => any> = ReturnType<typeof vi.fn<T>>;

/**
 * Configuration options for test suite setup
 */
export interface TestSuiteConfig {
  /** Whether to automatically setup mocks in beforeEach */
  setupMocks?: boolean;
  /** Whether to cleanup state after each test */
  cleanupAfterEach?: boolean;
  /** Custom mock configuration */
  mockConfig?: MockConfig;
  /** Timeout settings for async operations */
  timeout?: number;
  /** Whether to use fake timers */
  useFakeTimers?: boolean;
  /** Custom setup function to run before each test */
  customSetup?: () => void | Promise<void>;
  /** Custom teardown function to run after each test */
  customTeardown?: () => void | Promise<void>;
}

/**
 * Browser state representation for testing
 */
export interface BrowserState {
  /** Current page URL */
  url: string;
  /** Page title */
  title: string;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  hasError: boolean;
  /** Authentication status */
  isAuthenticated: boolean;
  /** Local storage data */
  localStorage: Record<string, string>;
  /** Session storage data */
  sessionStorage: Record<string, string>;
  /** Cookies */
  cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>;
  /** Console messages */
  consoleMessages: Array<{
    type: 'log' | 'warn' | 'error' | 'info';
    message: string;
    timestamp: Date;
  }>;
  /** Network requests */
  networkRequests: Array<{
    url: string;
    method: string;
    status?: number;
    headers?: Record<string, string>;
  }>;
}

/**
 * Mock configuration options
 */
export interface MockConfig {
  /** Whether to mock file system operations */
  mockFs?: boolean;
  /** Whether to mock network requests */
  mockNetwork?: boolean;
  /** Whether to mock timers */
  mockTimers?: boolean;
  /** Custom mock implementations */
  customMocks?: Record<string, ReturnType<typeof vi.fn>>;
  /** Mock data for specific scenarios */
  mockData?: {
    /** API response data */
    apiResponses?: Record<string, any>;
    /** File system data */
    fileSystemData?: Record<string, string>;
    /** Environment variables */
    envVars?: Record<string, string>;
  };
}

/**
 * Setup and teardown hooks for test suites
 */
export interface SetupTeardownHooks {
  /** Function to run before each test */
  beforeEach: () => void | Promise<void>;
  /** Function to run after each test */
  afterEach: () => void | Promise<void>;
  /** Function to run before all tests in suite */
  beforeAll?: () => void | Promise<void>;
  /** Function to run after all tests in suite */
  afterAll?: () => void | Promise<void>;
}

/**
 * Test environment state
 */
export interface TestEnvironment {
  /** Project path for the test */
  projectPath: string;
  /** Temporary directory for test files */
  tempDir?: string;
  /** Mock implementations that were set up */
  activeMocks: Map<string, ReturnType<typeof vi.fn>>;
  /** Cleanup functions to run */
  cleanupTasks: Array<() => void | Promise<void>>;
  /** Test-specific data */
  testData: Map<string, any>;
}

/**
 * Common test scenarios
 */
export type TestScenario =
  | 'clean-state'
  | 'logged-in-user'
  | 'error-state'
  | 'loading-state'
  | 'network-offline'
  | 'permission-denied'
  | 'file-not-found'
  | 'invalid-config';

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of fixture validation
 */
export interface FixtureValidationResult {
  /** Whether the fixture is valid */
  valid: boolean;
  /** Validation errors if any */
  errors?: string[];
  /** Validation warnings if any */
  warnings?: string[];
}

/**
 * Options for fixture validation
 */
export interface FixtureValidationOptions {
  /** Whether to perform strict validation */
  strict?: boolean;
  /** Schema to validate against */
  schema?: unknown;
  /** Custom validation rules */
  customRules?: Array<(fixture: unknown) => string | null>;
}