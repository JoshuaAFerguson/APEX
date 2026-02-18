/**
 * @fileoverview E2E Test Infrastructure - Main Entry Point
 *
 * This module provides a clean interface to all E2E testing utilities
 * required by the acceptance criteria:
 *
 * - createTestEnvironment() for isolated temp directories
 * - cleanupTestEnvironment() for cleanup
 * - runCLI() helper to execute CLI commands
 * - seed utilities for test data
 *
 * Import this module to get access to all E2E testing infrastructure.
 *
 * @example
 * ```typescript
 * import {
 *   createTestEnvironment,
 *   cleanupTestEnvironment,
 *   runCLI,
 *   seedTestData,
 *   SEED_SCENARIOS
 * } from './tests/e2e';
 *
 * // Create isolated test environment
 * const env = await createTestEnvironment({
 *   initGit: true,
 *   initApexProject: true
 * });
 *
 * // Seed with test data
 * await seedTestData(env, SEED_SCENARIOS.full);
 *
 * // Execute CLI commands
 * const result = await runCLI('agent list', env.path);
 * expect(result.success).toBe(true);
 *
 * // Clean up when done
 * await env.cleanup();
 * ```
 */

// ============================================================================
// Core Test Utilities (Required by Acceptance Criteria)
// ============================================================================

export {
  createTestEnvironment,
  cleanupTestEnvironment,
  runCLI,
  seedTestData,
  DEFAULT_SEED_DATA,
  SEED_SCENARIOS,
  type TestEnvironment,
  type CreateTestEnvironmentOptions,
  type SeedData
} from './utils/test-utilities';

// ============================================================================
// Additional Utilities and Helpers
// ============================================================================

// CLI execution utilities
export {
  runApexCLI,
  runApexCLISequence,
  initApexProject,
  checkCLIAvailable,
  parseJSONOutput,
  assertCLISuccess,
  assertCLIFailure,
  type CLIResult,
  type CLIOptions
} from './helpers/cli-test-helpers';

// MCP-specific utilities
export {
  execCli,
  execMCPCommand,
  execMCPCommandJson,
  readApexConfig,
  writeApexConfig,
  readMCPConfig,
  isServerInConfig,
  getServerFromConfig,
  createTestProject,
  createTestProjectWithServers,
  cleanupTestProject,
  assertFileExists,
  assertDirectoryExists,
  assertOutputContains,
  assertOutputNotContains,
  assertServerInstalled,
  assertMarketplaceOutput,
  isE2EMode,
  isCI,
  getTestTimeout,
  isCliBinaryAvailable,
  retry,
  waitForCondition,
  type MCPConfigSection,
  type MCPServerEntry,
  type ApexConfig,
  type MarketplaceOutputExpectations
} from './utils/mcp-test-utils';

// Global setup utilities
export {
  createTempDir,
  registerTempDir,
  registerOrchestrator,
  registerServer,
  registerStore,
  createTempGitRepo,
  createBareGitRepo,
  cleanupAll,
  waitFor,
  createTestId,
  createApexProject,
  e2eHelpers,
  type E2EWaitForOptions,
  type ApexProjectOptions
} from './setup';

// ============================================================================
// Test Framework Integration
// ============================================================================

/**
 * Quick start function for E2E tests
 *
 * Creates a fully initialized test environment with APEX project,
 * git repository, and seeded test data.
 *
 * @param scenarioName Seed scenario to use (default: 'full')
 * @returns Initialized test environment ready for testing
 *
 * @example
 * ```typescript
 * import { quickStart } from './tests/e2e';
 *
 * describe('My E2E Test', () => {
 *   it('should work with full setup', async () => {
 *     const env = await quickStart('full');
 *
 *     const result = await runCLI('agent list', env.path);
 *     expect(result.success).toBe(true);
 *     expect(result.stdout).toContain('developer');
 *
 *     await env.cleanup();
 *   });
 * });
 * ```
 */
export async function quickStart(
  scenarioName: keyof typeof SEED_SCENARIOS = 'full'
): Promise<TestEnvironment> {
  const { createTestEnvironment, seedTestData, SEED_SCENARIOS } =
    await import('./utils/test-utilities');

  const env = await createTestEnvironment({
    initGit: true,
    initApexProject: true
  });

  await seedTestData(env, SEED_SCENARIOS[scenarioName]);

  return env;
}

/**
 * Helper for creating MCP-focused test environments
 */
export async function createMCPTestEnvironment(): Promise<TestEnvironment> {
  return quickStart('mcp');
}

/**
 * Helper for creating git-focused test environments
 */
export async function createGitTestEnvironment(): Promise<TestEnvironment> {
  return quickStart('git');
}

/**
 * Helper for creating minimal test environments
 */
export async function createMinimalTestEnvironment(): Promise<TestEnvironment> {
  return quickStart('minimal');
}