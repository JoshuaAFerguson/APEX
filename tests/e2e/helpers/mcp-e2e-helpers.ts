/**
 * @fileoverview MCP Marketplace E2E Test Helpers
 *
 * High-level workflow helpers that compose the lower-level utilities, fixtures,
 * and mocks into reusable patterns for MCP marketplace E2E tests.
 *
 * ## Architecture (ADR-071)
 *
 * This is the top layer of the MCP E2E test infrastructure:
 * - Composes base utilities from `utils/mcp-test-utils.ts`
 * - Uses fixtures from `fixtures/marketplace-data.ts`
 * - Manages mocks from `mocks/mock-marketplace-server.ts`
 * - Integrates with existing E2E setup from `tests/e2e/setup.ts`
 *
 * ## Usage
 *
 * ```typescript
 * import { createMCPTestContext, mcpHelpers } from '../helpers/mcp-e2e-helpers';
 *
 * describe('MCP Marketplace', () => {
 *   let ctx: MCPTestContext;
 *
 *   beforeEach(async () => {
 *     ctx = await createMCPTestContext();
 *   });
 *
 *   afterEach(async () => {
 *     await ctx.cleanup();
 *   });
 *
 *   it('should list marketplace servers', async () => {
 *     const result = await mcpHelpers.listServers(ctx);
 *     expect(result.success).toBe(true);
 *   });
 * });
 * ```
 *
 * @module tests/e2e/helpers/mcp-e2e-helpers
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import {
  createTestProject,
  createTestProjectWithServers,
  cleanupTestProject,
  execCli,
  execMCPCommand,
  execMCPCommandJson,
  readApexConfig,
  writeApexConfig,
  readMCPConfig,
  getServerFromConfig,
  isServerInConfig,
  assertServerInstalled,
  assertOutputContains,
  assertOutputNotContains,
  assertMarketplaceOutput,
  isCliBinaryAvailable,
  retry,
  waitForCondition,
  type CLIResult,
  type CLIExecOptions,
  type MCPServerEntry,
  type ApexConfig,
  type MCPConfigSection,
  type MarketplaceOutputExpectations,
} from '../utils/mcp-test-utils.js';
import {
  type MarketplaceEntry,
  type ServerConfig,
  type TestCatalog,
  FILESYSTEM_SERVER,
  MEMORY_SERVER,
  ALL_MARKETPLACE_ENTRIES,
  createTestCatalog,
  createBaseApexConfig,
} from '../fixtures/marketplace-data.js';
import {
  MockMarketplaceServer,
  MockServerManager,
  createMockMarketplaceServer,
  createFailingServer,
  createSlowServer,
  type MockMarketplaceBehavior,
  type MockServerStats,
} from '../mocks/mock-marketplace-server.js';

// ============================================================================
// Types
// ============================================================================

/**
 * MCP test context containing all state for a test scenario
 */
export interface MCPTestContext {
  /** Path to the temporary test project directory */
  projectDir: string;
  /** Path to .apex/config.yaml */
  configPath: string;
  /** Mock server manager for this test */
  serverManager: MockServerManager;
  /** List of servers installed during the test */
  installedServers: string[];
  /** Whether the CLI binary is available */
  cliBinaryAvailable: boolean;
  /** Cleanup function to tear down all resources */
  cleanup: () => Promise<void>;
}

/**
 * Options for creating an MCP test context
 */
export interface MCPTestContextOptions {
  /** Pre-installed servers in the config */
  preInstalledServers?: Record<string, MCPServerEntry>;
  /** Mock servers to start automatically */
  autoStartMocks?: MarketplaceEntry[];
  /** Custom APEX config overrides */
  configOverrides?: Partial<ApexConfig>;
  /** Test directory prefix */
  prefix?: string;
}

/**
 * Result of a marketplace workflow step
 */
export interface WorkflowStepResult {
  /** Step name */
  step: string;
  /** Whether the step succeeded */
  success: boolean;
  /** CLI output if applicable */
  output?: CLIResult;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Complete marketplace workflow result
 */
export interface MarketplaceWorkflowResult {
  /** Whether all steps completed successfully */
  success: boolean;
  /** Individual step results */
  steps: WorkflowStepResult[];
  /** Total duration */
  totalDuration: number;
  /** First error encountered */
  firstError?: string;
}

// ============================================================================
// Context Management
// ============================================================================

/**
 * Create a new MCP test context with isolated project directory
 *
 * @example
 * ```typescript
 * const ctx = await createMCPTestContext();
 * // ... run tests ...
 * await ctx.cleanup();
 * ```
 */
export async function createMCPTestContext(
  options: MCPTestContextOptions = {}
): Promise<MCPTestContext> {
  const prefix = options.prefix ?? 'apex-e2e-mcp-';

  // Create project directory
  let projectDir: string;
  if (options.preInstalledServers) {
    projectDir = await createTestProjectWithServers(
      options.preInstalledServers,
      prefix
    );
  } else {
    projectDir = await createTestProject(prefix);
  }

  // Apply config overrides if any
  if (options.configOverrides) {
    const config = await readApexConfig(projectDir);
    const merged = { ...config, ...options.configOverrides };
    await writeApexConfig(projectDir, merged);
  }

  // Set up mock server manager
  const serverManager = new MockServerManager();

  // Auto-start mock servers if specified
  if (options.autoStartMocks) {
    for (const entry of options.autoStartMocks) {
      serverManager.addServer(entry);
    }
    await serverManager.startAll();
  }

  const configPath = path.join(projectDir, '.apex', 'config.yaml');
  const cliBinaryAvailable = await isCliBinaryAvailable();

  const cleanup = async () => {
    await serverManager.stopAll();
    serverManager.clear();
    await cleanupTestProject(projectDir);
  };

  // Register cleanup with global E2E helpers if available
  if (typeof globalThis !== 'undefined' && globalThis.apexE2EHelpers) {
    globalThis.apexE2EHelpers.registerTempDir(projectDir);
  }

  return {
    projectDir,
    configPath,
    serverManager,
    installedServers: [],
    cliBinaryAvailable,
    cleanup,
  };
}

// ============================================================================
// CLI Workflow Helpers
// ============================================================================

/**
 * High-level MCP E2E helper functions
 */
export const mcpHelpers = {
  // ==========================================================================
  // Marketplace Browsing
  // ==========================================================================

  /**
   * List all available MCP servers from the marketplace
   */
  async listServers(ctx: MCPTestContext, jsonOutput = false): Promise<CLIResult> {
    const options: CLIExecOptions = { cwd: ctx.projectDir };
    if (jsonOutput) {
      return execMCPCommandJson('list', options);
    }
    return execMCPCommand('list', options);
  },

  /**
   * Search for MCP servers by query string
   */
  async searchServers(
    ctx: MCPTestContext,
    query: string,
    jsonOutput = false
  ): Promise<CLIResult> {
    const options: CLIExecOptions = { cwd: ctx.projectDir };
    if (jsonOutput) {
      return execMCPCommandJson(`search ${query}`, options);
    }
    return execMCPCommand(`search ${query}`, options);
  },

  /**
   * Search servers by category
   */
  async searchByCategory(
    ctx: MCPTestContext,
    category: string,
    jsonOutput = false
  ): Promise<CLIResult> {
    const options: CLIExecOptions = { cwd: ctx.projectDir };
    const cmd = `list --category ${category}`;
    if (jsonOutput) {
      return execMCPCommandJson(cmd, options);
    }
    return execMCPCommand(cmd, options);
  },

  // ==========================================================================
  // Server Installation
  // ==========================================================================

  /**
   * Install an MCP server from the marketplace
   */
  async installServer(ctx: MCPTestContext, serverName: string): Promise<CLIResult> {
    const result = await execMCPCommand(`install ${serverName}`, {
      cwd: ctx.projectDir,
    });

    if (result.success) {
      ctx.installedServers.push(serverName);
    }

    return result;
  },

  /**
   * Install multiple servers sequentially
   */
  async installServers(
    ctx: MCPTestContext,
    serverNames: string[]
  ): Promise<Map<string, CLIResult>> {
    const results = new Map<string, CLIResult>();

    for (const name of serverNames) {
      const result = await mcpHelpers.installServer(ctx, name);
      results.set(name, result);
    }

    return results;
  },

  // ==========================================================================
  // Server Verification
  // ==========================================================================

  /**
   * List installed servers
   */
  async listInstalled(ctx: MCPTestContext, jsonOutput = false): Promise<CLIResult> {
    const options: CLIExecOptions = { cwd: ctx.projectDir };
    if (jsonOutput) {
      return execMCPCommandJson('installed', options);
    }
    return execMCPCommand('installed', options);
  },

  /**
   * Validate MCP server configuration
   */
  async validate(ctx: MCPTestContext): Promise<CLIResult> {
    return execMCPCommand('validate', { cwd: ctx.projectDir });
  },

  /**
   * Get MCP server status
   */
  async status(ctx: MCPTestContext): Promise<CLIResult> {
    return execMCPCommand('status', { cwd: ctx.projectDir });
  },

  /**
   * Verify a server was properly installed
   */
  async verifyInstallation(
    ctx: MCPTestContext,
    serverName: string,
    expectedConfig?: Partial<MCPServerEntry>
  ): Promise<void> {
    await assertServerInstalled(ctx.projectDir, serverName, expectedConfig);
  },

  // ==========================================================================
  // Config Manipulation
  // ==========================================================================

  /**
   * Read the current MCP config
   */
  async getConfig(ctx: MCPTestContext): Promise<MCPConfigSection> {
    return readMCPConfig(ctx.projectDir);
  },

  /**
   * Update the MCP config section
   */
  async setConfig(ctx: MCPTestContext, mcpConfig: MCPConfigSection): Promise<void> {
    const config = await readApexConfig(ctx.projectDir);
    config.mcp = mcpConfig;
    await writeApexConfig(ctx.projectDir, config);
  },

  /**
   * Add a server directly to the config (bypassing CLI)
   */
  async addServerToConfig(
    ctx: MCPTestContext,
    name: string,
    serverConfig: MCPServerEntry
  ): Promise<void> {
    const config = await readApexConfig(ctx.projectDir);
    if (!config.mcp) {
      config.mcp = {};
    }
    if (!config.mcp.servers) {
      config.mcp.servers = {};
    }
    config.mcp.servers[name] = serverConfig;
    await writeApexConfig(ctx.projectDir, config);
  },

  /**
   * Remove a server from the config (bypassing CLI)
   */
  async removeServerFromConfig(
    ctx: MCPTestContext,
    name: string
  ): Promise<void> {
    const config = await readApexConfig(ctx.projectDir);
    if (config.mcp?.servers && name in config.mcp.servers) {
      delete config.mcp.servers[name];
      await writeApexConfig(ctx.projectDir, config);
    }
  },

  // ==========================================================================
  // Assertion Helpers
  // ==========================================================================

  /**
   * Assert that the list command output contains expected servers
   */
  assertListContains(result: CLIResult, expectedServers: string[]): void {
    assertOutputContains(result, expectedServers);
  },

  /**
   * Assert that the list command output does NOT contain specific servers
   */
  assertListNotContains(result: CLIResult, unexpectedServers: string[]): void {
    assertOutputNotContains(result, unexpectedServers);
  },

  /**
   * Assert marketplace output matches expectations
   */
  assertMarketplace(
    result: CLIResult,
    expectations: MarketplaceOutputExpectations
  ): void {
    assertMarketplaceOutput(result.stdout, expectations);
  },

  /**
   * Assert a command succeeded
   */
  assertSuccess(result: CLIResult, errorMessage?: string): void {
    if (!result.success) {
      throw new Error(
        errorMessage ||
          `Expected command to succeed.\nStderr: ${result.stderr}\nStdout: ${result.stdout}`
      );
    }
  },

  /**
   * Assert a command failed
   */
  assertFailure(result: CLIResult, errorMessage?: string): void {
    if (result.success) {
      throw new Error(
        errorMessage ||
          `Expected command to fail.\nStdout: ${result.stdout}`
      );
    }
  },

  // ==========================================================================
  // Complete Workflow Helpers
  // ==========================================================================

  /**
   * Run the complete happy path workflow:
   * list → search → install → installed → validate → status
   */
  async runHappyPathWorkflow(
    ctx: MCPTestContext,
    serverName: string
  ): Promise<MarketplaceWorkflowResult> {
    const steps: WorkflowStepResult[] = [];
    const workflowStart = Date.now();
    let success = true;
    let firstError: string | undefined;

    const runStep = async (
      stepName: string,
      action: () => Promise<CLIResult>
    ): Promise<CLIResult | null> => {
      const stepStart = Date.now();
      try {
        const result = await action();
        steps.push({
          step: stepName,
          success: result.success,
          output: result,
          duration: Date.now() - stepStart,
        });
        if (!result.success && !firstError) {
          firstError = `Step "${stepName}" failed: ${result.stderr}`;
          success = false;
        }
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        steps.push({
          step: stepName,
          success: false,
          error: errorMsg,
          duration: Date.now() - stepStart,
        });
        if (!firstError) {
          firstError = `Step "${stepName}" threw: ${errorMsg}`;
          success = false;
        }
        return null;
      }
    };

    // Step 1: List available servers
    await runStep('list', () => mcpHelpers.listServers(ctx));

    // Step 2: Search for the target server
    await runStep('search', () => mcpHelpers.searchServers(ctx, serverName));

    // Step 3: Install the server
    await runStep('install', () => mcpHelpers.installServer(ctx, serverName));

    // Step 4: List installed servers
    await runStep('installed', () => mcpHelpers.listInstalled(ctx));

    // Step 5: Validate configuration
    await runStep('validate', () => mcpHelpers.validate(ctx));

    // Step 6: Check status
    await runStep('status', () => mcpHelpers.status(ctx));

    return {
      success,
      steps,
      totalDuration: Date.now() - workflowStart,
      firstError,
    };
  },

  /**
   * Run a multi-server installation workflow
   */
  async runMultiInstallWorkflow(
    ctx: MCPTestContext,
    serverNames: string[]
  ): Promise<MarketplaceWorkflowResult> {
    const steps: WorkflowStepResult[] = [];
    const workflowStart = Date.now();
    let success = true;
    let firstError: string | undefined;

    // Install each server
    for (const name of serverNames) {
      const stepStart = Date.now();
      try {
        const result = await mcpHelpers.installServer(ctx, name);
        steps.push({
          step: `install-${name}`,
          success: result.success,
          output: result,
          duration: Date.now() - stepStart,
        });
        if (!result.success && !firstError) {
          firstError = `Install "${name}" failed: ${result.stderr}`;
          success = false;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        steps.push({
          step: `install-${name}`,
          success: false,
          error: errorMsg,
          duration: Date.now() - stepStart,
        });
        if (!firstError) {
          firstError = errorMsg;
          success = false;
        }
      }
    }

    // Verify all installed
    const verifyStart = Date.now();
    try {
      const result = await mcpHelpers.listInstalled(ctx);
      steps.push({
        step: 'verify-installed',
        success: result.success,
        output: result,
        duration: Date.now() - verifyStart,
      });
    } catch (err) {
      steps.push({
        step: 'verify-installed',
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - verifyStart,
      });
    }

    return {
      success,
      steps,
      totalDuration: Date.now() - workflowStart,
      firstError,
    };
  },
};

// ============================================================================
// Mock Server Integration Helpers
// ============================================================================

/**
 * Create and start a mock marketplace server for a specific entry
 */
export async function startMockServer(
  ctx: MCPTestContext,
  entry: MarketplaceEntry,
  behavior?: MockMarketplaceBehavior
): Promise<MockMarketplaceServer> {
  const server = ctx.serverManager.addServer(entry, behavior);
  await server.start();
  return server;
}

/**
 * Create multiple mock servers for testing
 */
export async function startMockServers(
  ctx: MCPTestContext,
  entries: MarketplaceEntry[],
  behavior?: MockMarketplaceBehavior
): Promise<Map<string, MockMarketplaceServer>> {
  const servers = new Map<string, MockMarketplaceServer>();

  for (const entry of entries) {
    const server = ctx.serverManager.addServer(entry, behavior);
    servers.set(entry.name, server);
  }

  await ctx.serverManager.startAll();
  return servers;
}

/**
 * Get aggregate stats from all mock servers in context
 */
export function getAggregateStats(ctx: MCPTestContext): {
  totalRequests: number;
  runningServers: number;
  totalServers: number;
} {
  const stats = ctx.serverManager.getAllStats();
  let totalRequests = 0;
  let runningServers = 0;

  for (const serverStats of stats.values()) {
    totalRequests += serverStats.totalRequests;
    if (serverStats.isRunning) runningServers++;
  }

  return {
    totalRequests,
    runningServers,
    totalServers: stats.size,
  };
}

// ============================================================================
// Test Catalog Helpers
// ============================================================================

/**
 * Write a custom test catalog to the project's .apex directory
 */
export async function writeTestCatalog(
  ctx: MCPTestContext,
  catalog: TestCatalog
): Promise<string> {
  const catalogPath = path.join(ctx.projectDir, '.apex', 'catalog.json');
  await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
  return catalogPath;
}

/**
 * Write the default test catalog with all entries
 */
export async function writeDefaultTestCatalog(
  ctx: MCPTestContext
): Promise<string> {
  return writeTestCatalog(ctx, createTestCatalog());
}

// ============================================================================
// Convenience Re-exports
// ============================================================================

export {
  // Types
  type CLIResult,
  type MCPServerEntry,
  type ApexConfig,
  type MCPConfigSection,
  type MarketplaceOutputExpectations,
  // Fixtures
  type MarketplaceEntry,
  type ServerConfig,
  FILESYSTEM_SERVER,
  MEMORY_SERVER,
  ALL_MARKETPLACE_ENTRIES,
  // Mocks
  MockMarketplaceServer,
  MockServerManager,
  createMockMarketplaceServer,
  createFailingServer,
  createSlowServer,
  type MockMarketplaceBehavior,
  type MockServerStats,
  // Utilities
  execCli,
  execMCPCommand,
  execMCPCommandJson,
  readApexConfig,
  writeApexConfig,
  readMCPConfig,
  isServerInConfig,
  assertServerInstalled,
  assertOutputContains,
  assertOutputNotContains,
  isCliBinaryAvailable,
  retry,
  waitForCondition,
};
