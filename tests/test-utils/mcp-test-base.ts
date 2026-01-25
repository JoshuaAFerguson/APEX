/**
 * @fileoverview Base MCP Test Utilities for Unit and E2E Tests
 *
 * Provides a unified interface for MCP testing utilities that work in both
 * unit test and E2E test contexts. This module automatically detects the
 * test environment and provides appropriate implementations.
 *
 * ## Key Features
 *
 * - **Environment Detection**: Automatically detects unit vs E2E test mode
 * - **Unified API**: Same interface works for both unit and E2E tests
 * - **Mock Management**: Centralized mock creation and lifecycle management
 * - **Config Utilities**: Config file manipulation for both test types
 * - **Assertion Helpers**: Consistent assertions across test environments
 * - **Data Factories**: Test data generation with realistic scenarios
 *
 * ## Usage
 *
 * ```typescript
 * import { mcpTestBase } from '@test/mcp-test-base';
 *
 * describe('MCP Features', () => {
 *   let testContext: MCPTestContext;
 *
 *   beforeEach(async () => {
 *     testContext = await mcpTestBase.createTestContext();
 *   });
 *
 *   afterEach(async () => {
 *     await mcpTestBase.cleanupTestContext(testContext);
 *   });
 *
 *   it('should work in both unit and E2E tests', async () => {
 *     const result = await mcpTestBase.execMCPCommand('list', testContext);
 *     expect(result.success).toBe(true);
 *   });
 * });
 * ```
 *
 * @module tests/test-utils/mcp-test-base
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

// Type imports (avoid runtime dependency issues in unit tests)
export interface MCPTestContext {
  /** Test environment mode */
  mode: 'unit' | 'e2e';
  /** Project directory (real for E2E, mock for unit) */
  projectDir: string;
  /** Whether cleanup is required */
  needsCleanup: boolean;
  /** Mock registry for unit tests */
  mocks?: Map<string, any>;
  /** Additional test metadata */
  metadata: Record<string, unknown>;
}

export interface MCPTestConfig {
  /** Test mode override */
  mode?: 'unit' | 'e2e';
  /** Project setup options */
  projectOptions?: {
    name?: string;
    withServers?: boolean;
    customConfig?: Record<string, unknown>;
  };
  /** Mock options for unit tests */
  mockOptions?: {
    enableFilesystem?: boolean;
    enableCLI?: boolean;
    enableConfig?: boolean;
  };
}

export interface MCPCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  json?: unknown;
  duration: number;
}

export interface MCPServerConfig {
  name: string;
  type?: 'stdio' | 'http' | 'sse' | 'sdk';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  autoStart?: boolean;
  capabilities?: string[];
}

export interface MCPMarketplaceEntry {
  name: string;
  description: string;
  version: string;
  author?: string;
  verified?: boolean;
  category?: string;
  capabilities?: string[];
  serverConfig: MCPServerConfig;
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Detect if we're running in unit test mode
 */
export function isUnitTestMode(): boolean {
  // Check environment variables
  if (process.env.APEX_TEST_MODE === 'unit') return true;
  if (process.env.APEX_TEST_MODE === 'e2e') return false;

  // Check for vitest context
  if (typeof globalThis !== 'undefined') {
    // Check for E2E helpers (indicates E2E mode)
    if ((globalThis as any).apexE2EHelpers) return false;

    // Check vitest mode
    if (process.env.VITEST && process.env.VITEST_MODE) {
      return process.env.VITEST_MODE === 'unit';
    }
  }

  // Check stack trace for config file hints
  const stack = new Error().stack || '';
  if (stack.includes('vitest.unit.config')) return true;
  if (stack.includes('vitest.e2e.config')) return false;

  // Default to unit test mode for safety
  return true;
}

/**
 * Get test timeout appropriate for the environment
 */
export function getTestTimeout(): number {
  return isUnitTestMode() ? 5000 : 30000;
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!(process.env.CI || process.env.CONTINUOUS_INTEGRATION);
}

// ============================================================================
// Test Context Management
// ============================================================================

/**
 * Create a test context appropriate for the current test environment
 */
export async function createTestContext(config: MCPTestConfig = {}): Promise<MCPTestContext> {
  const mode = config.mode ?? (isUnitTestMode() ? 'unit' : 'e2e');

  if (mode === 'e2e') {
    return createE2ETestContext(config);
  } else {
    return createUnitTestContext(config);
  }
}

/**
 * Create test context for E2E tests
 */
async function createE2ETestContext(config: MCPTestConfig): Promise<MCPTestContext> {
  // Import E2E helpers dynamically to avoid issues in unit tests
  const { createMCPTestContext } = await import('../e2e/helpers/mcp-e2e-helpers.js');

  const e2eContext = await createMCPTestContext({
    prefix: 'mcp-test-',
    configOverrides: config.projectOptions?.customConfig,
  });

  return {
    mode: 'e2e',
    projectDir: e2eContext.projectDir,
    needsCleanup: true,
    metadata: {
      e2eContext,
      cliBinaryAvailable: e2eContext.cliBinaryAvailable,
    },
  };
}

/**
 * Create test context for unit tests
 */
async function createUnitTestContext(config: MCPTestConfig): Promise<MCPTestContext> {
  // For unit tests, use in-memory mocks
  const projectDir = '/tmp/mock-apex-project';
  const mocks = new Map<string, any>();

  // Set up filesystem mocks if requested
  if (config.mockOptions?.enableFilesystem) {
    // Create mock filesystem
    const mockFs = createMockFilesystem(projectDir);
    mocks.set('filesystem', mockFs);
  }

  // Set up CLI mocks if requested
  if (config.mockOptions?.enableCLI) {
    const mockCLI = createMockCLI();
    mocks.set('cli', mockCLI);
  }

  // Set up config mocks if requested
  if (config.mockOptions?.enableConfig) {
    const mockConfig = createMockConfig(config.projectOptions?.customConfig);
    mocks.set('config', mockConfig);
  }

  return {
    mode: 'unit',
    projectDir,
    needsCleanup: false,
    mocks,
    metadata: {
      mockOptions: config.mockOptions,
    },
  };
}

/**
 * Clean up test context resources
 */
export async function cleanupTestContext(context: MCPTestContext): Promise<void> {
  if (context.mode === 'e2e' && context.needsCleanup) {
    const e2eContext = context.metadata.e2eContext as any;
    if (e2eContext?.cleanup) {
      await e2eContext.cleanup();
    }
  } else if (context.mode === 'unit' && context.mocks) {
    // Clean up unit test mocks
    for (const [name, mock] of context.mocks) {
      if (mock?.cleanup && typeof mock.cleanup === 'function') {
        await mock.cleanup();
      }
    }
    context.mocks.clear();
  }
}

// ============================================================================
// Command Execution
// ============================================================================

/**
 * Execute an MCP command in the test context
 */
export async function execMCPCommand(
  command: string,
  context: MCPTestContext,
  options: { json?: boolean; timeout?: number } = {}
): Promise<MCPCommandResult> {
  if (context.mode === 'e2e') {
    return execMCPCommandE2E(command, context, options);
  } else {
    return execMCPCommandUnit(command, context, options);
  }
}

/**
 * Execute MCP command in E2E mode
 */
async function execMCPCommandE2E(
  command: string,
  context: MCPTestContext,
  options: { json?: boolean; timeout?: number }
): Promise<MCPCommandResult> {
  const { execMCPCommand: e2eExecMCP, execMCPCommandJson } =
    await import('../e2e/utils/mcp-test-utils.js');

  const execOptions = {
    cwd: context.projectDir,
    timeout: options.timeout || getTestTimeout(),
  };

  if (options.json) {
    const result = await e2eExecMCP(command, execOptions);
    return {
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      json: result.json,
      duration: result.duration,
    };
  } else {
    const result = await e2eExecMCP(command, execOptions);
    return {
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      duration: result.duration,
    };
  }
}

/**
 * Execute MCP command in unit test mode (mocked)
 */
async function execMCPCommandUnit(
  command: string,
  context: MCPTestContext,
  options: { json?: boolean; timeout?: number }
): Promise<MCPCommandResult> {
  const startTime = Date.now();
  const mockCLI = context.mocks?.get('cli');

  if (!mockCLI) {
    throw new Error('CLI mock not available in unit test context');
  }

  const result = await mockCLI.exec(`mcp ${command}`, {
    json: options.json,
    timeout: options.timeout || getTestTimeout(),
  });

  return {
    success: result.exitCode === 0,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    json: options.json ? result.json : undefined,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Configuration Utilities
// ============================================================================

/**
 * Read APEX config from test context
 */
export async function readApexConfig(context: MCPTestContext): Promise<Record<string, unknown>> {
  if (context.mode === 'e2e') {
    const { readApexConfig: e2eReadConfig } = await import('../e2e/utils/mcp-test-utils.js');
    return e2eReadConfig(context.projectDir);
  } else {
    const mockConfig = context.mocks?.get('config');
    if (!mockConfig) {
      throw new Error('Config mock not available in unit test context');
    }
    return mockConfig.read();
  }
}

/**
 * Write APEX config in test context
 */
export async function writeApexConfig(
  context: MCPTestContext,
  config: Record<string, unknown>
): Promise<void> {
  if (context.mode === 'e2e') {
    const { writeApexConfig: e2eWriteConfig } = await import('../e2e/utils/mcp-test-utils.js');
    await e2eWriteConfig(context.projectDir, config);
  } else {
    const mockConfig = context.mocks?.get('config');
    if (!mockConfig) {
      throw new Error('Config mock not available in unit test context');
    }
    await mockConfig.write(config);
  }
}

/**
 * Check if a server is installed in the test context
 */
export async function isServerInstalled(
  context: MCPTestContext,
  serverName: string
): Promise<boolean> {
  if (context.mode === 'e2e') {
    const { isServerInConfig } = await import('../e2e/utils/mcp-test-utils.js');
    return isServerInConfig(context.projectDir, serverName);
  } else {
    const config = await readApexConfig(context);
    const mcpConfig = config.mcp as any;
    return !!(mcpConfig?.servers?.[serverName]);
  }
}

// ============================================================================
// Data Factories
// ============================================================================

/**
 * Create a test marketplace entry
 */
export function createTestMarketplaceEntry(
  name: string,
  overrides: Partial<MCPMarketplaceEntry> = {}
): MCPMarketplaceEntry {
  return {
    name,
    description: `Test MCP server: ${name}`,
    version: '1.0.0',
    author: 'test-author',
    verified: true,
    category: 'testing',
    capabilities: ['test:execute'],
    serverConfig: {
      name,
      type: 'stdio',
      command: 'npx',
      args: ['-y', `@test/${name}-server`],
      env: {},
      autoStart: false,
    },
    ...overrides,
  };
}

/**
 * Create test server config
 */
export function createTestServerConfig(
  name: string,
  overrides: Partial<MCPServerConfig> = {}
): MCPServerConfig {
  return {
    name,
    type: 'stdio',
    command: 'npx',
    args: ['-y', `@test/${name}-server`],
    env: {},
    autoStart: false,
    capabilities: [],
    ...overrides,
  };
}

/**
 * Create a realistic test APEX config
 */
export function createTestApexConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    project: {
      name: 'test-project',
      language: 'typescript',
    },
    autonomy: {
      default: 'supervised',
    },
    models: {
      planning: 'sonnet',
      implementation: 'sonnet',
    },
    limits: {
      maxTokensPerTask: 100000,
      maxCostPerTask: 10,
    },
    ...overrides,
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a command result was successful
 */
export function assertCommandSuccess(result: MCPCommandResult, message?: string): void {
  if (!result.success) {
    throw new Error(
      message ||
      `Expected command to succeed.\nStderr: ${result.stderr}\nStdout: ${result.stdout}`
    );
  }
}

/**
 * Assert that a command result failed
 */
export function assertCommandFailure(result: MCPCommandResult, message?: string): void {
  if (result.success) {
    throw new Error(
      message ||
      `Expected command to fail.\nStdout: ${result.stdout}`
    );
  }
}

/**
 * Assert that output contains expected strings
 */
export function assertOutputContains(result: MCPCommandResult, expected: string | string[]): void {
  const expectations = Array.isArray(expected) ? expected : [expected];
  const combined = result.stdout + result.stderr;

  for (const exp of expectations) {
    if (!combined.includes(exp)) {
      throw new Error(
        `Expected output to contain "${exp}".\nStdout: ${result.stdout}\nStderr: ${result.stderr}`
      );
    }
  }
}

/**
 * Assert that a server is properly configured
 */
export async function assertServerInstalled(
  context: MCPTestContext,
  serverName: string,
  expectedConfig?: Partial<MCPServerConfig>
): Promise<void> {
  const isInstalled = await isServerInstalled(context, serverName);
  if (!isInstalled) {
    throw new Error(`Expected server "${serverName}" to be installed`);
  }

  if (expectedConfig) {
    const config = await readApexConfig(context);
    const mcpConfig = config.mcp as any;
    const serverConfig = mcpConfig?.servers?.[serverName];

    for (const [key, value] of Object.entries(expectedConfig)) {
      if (JSON.stringify(serverConfig[key]) !== JSON.stringify(value)) {
        throw new Error(
          `Server "${serverName}" config mismatch for "${key}":\n` +
          `  Expected: ${JSON.stringify(value)}\n` +
          `  Actual: ${JSON.stringify(serverConfig[key])}`
        );
      }
    }
  }
}

// ============================================================================
// Mock Implementations (for unit tests)
// ============================================================================

/**
 * Create a mock filesystem for unit tests
 */
function createMockFilesystem(projectDir: string) {
  const files = new Map<string, string>();

  return {
    files,
    readFile: async (path: string) => {
      const content = files.get(path);
      if (content === undefined) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    },
    writeFile: async (path: string, content: string) => {
      files.set(path, content);
    },
    exists: (path: string) => files.has(path),
    cleanup: async () => files.clear(),
  };
}

/**
 * Create a mock CLI for unit tests
 */
function createMockCLI() {
  const execHistory: Array<{ command: string; options: any; result: any }> = [];

  return {
    execHistory,
    exec: async (command: string, options: any = {}) => {
      const result = generateMockCLIResponse(command, options);
      execHistory.push({ command, options, result });
      return result;
    },
    getLastExecution: () => execHistory[execHistory.length - 1],
    getAllExecutions: () => [...execHistory],
    cleanup: async () => execHistory.length = 0,
  };
}

/**
 * Create a mock config for unit tests
 */
function createMockConfig(initialConfig?: Record<string, unknown>) {
  let config = initialConfig || createTestApexConfig();

  return {
    config,
    read: () => ({ ...config }),
    write: async (newConfig: Record<string, unknown>) => {
      config = { ...newConfig };
    },
    update: async (updates: Record<string, unknown>) => {
      config = { ...config, ...updates };
    },
    cleanup: async () => {
      config = createTestApexConfig();
    },
  };
}

/**
 * Generate realistic mock CLI responses
 */
function generateMockCLIResponse(command: string, options: any) {
  const cmd = command.toLowerCase();

  if (cmd.includes('mcp list')) {
    if (options.json) {
      return {
        exitCode: 0,
        stdout: JSON.stringify([
          createTestMarketplaceEntry('filesystem'),
          createTestMarketplaceEntry('memory'),
        ]),
        stderr: '',
        json: [
          createTestMarketplaceEntry('filesystem'),
          createTestMarketplaceEntry('memory'),
        ],
      };
    } else {
      return {
        exitCode: 0,
        stdout: '📦 MCP Marketplace\n\nFilesystem Server\nMemory Server\n',
        stderr: '',
      };
    }
  }

  if (cmd.includes('mcp install')) {
    const serverName = cmd.split(' ').pop() || 'unknown';
    return {
      exitCode: 0,
      stdout: `✅ Server "${serverName}" installed successfully\n`,
      stderr: '',
    };
  }

  if (cmd.includes('mcp validate')) {
    return {
      exitCode: 0,
      stdout: '✅ MCP configuration is valid\n',
      stderr: '',
    };
  }

  // Default response
  return {
    exitCode: 0,
    stdout: 'Mock CLI response',
    stderr: '',
  };
}

// ============================================================================
// Main Interface
// ============================================================================

/**
 * Main test utilities interface
 */
export const mcpTestBase = {
  // Context management
  createTestContext,
  cleanupTestContext,

  // Environment detection
  isUnitTestMode,
  getTestTimeout,
  isCI,

  // Command execution
  execMCPCommand,

  // Configuration utilities
  readApexConfig,
  writeApexConfig,
  isServerInstalled,

  // Data factories
  createTestMarketplaceEntry,
  createTestServerConfig,
  createTestApexConfig,

  // Assertion helpers
  assertCommandSuccess,
  assertCommandFailure,
  assertOutputContains,
  assertServerInstalled,
};

// Export types for TypeScript support
export type {
  MCPTestContext,
  MCPTestConfig,
  MCPCommandResult,
  MCPServerConfig,
  MCPMarketplaceEntry,
};