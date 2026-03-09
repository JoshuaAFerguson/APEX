/**
 * @fileoverview Integration test setup for APEX
 *
 * This setup file provides:
 * 1. Global setup/teardown hooks for temporary directory management
 * 2. Database cleanup utilities for SQLite test databases
 * 3. Confirmation flow test globals and helpers
 * 4. Common test utilities for integration tests
 *
 * Usage:
 * - Automatically loaded by vitest.config.ts setupFiles
 * - Provides global utilities via `globalThis`
 * - Manages cleanup of orphaned test resources
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Integration test context with cleanup tracking
 */
export interface IntegrationTestContext {
  /** Temporary directories created during tests */
  tempDirs: Set<string>;
  /** Active orchestrator instances for cleanup */
  orchestrators: Set<{ shutdown: () => Promise<void> }>;
  /** Active API servers for cleanup */
  servers: Set<{ close: () => Promise<void> }>;
  /** Active database stores for cleanup */
  stores: Set<{ close: () => void }>;
}

/**
 * Confirmation flow test helpers available globally
 */
export interface ConfirmationTestHelpers {
  /** Create a unique temp directory for test isolation */
  createTempDir: (prefix?: string) => Promise<string>;
  /** Register a temp directory for automatic cleanup */
  registerTempDir: (dir: string) => void;
  /** Register an orchestrator for automatic cleanup */
  registerOrchestrator: (orchestrator: { shutdown: () => Promise<void> }) => void;
  /** Register a server for automatic cleanup */
  registerServer: (server: { close: () => Promise<void> }) => void;
  /** Register a store for automatic cleanup */
  registerStore: (store: { close: () => void }) => void;
  /** Clean up all registered resources */
  cleanupAll: () => Promise<void>;
  /** Wait for a condition with timeout */
  waitFor: <T>(condition: () => T | Promise<T>, options?: WaitForOptions) => Promise<T>;
  /** Create a unique test ID */
  createTestId: (prefix?: string) => string;
}

interface WaitForOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

// ============================================================================
// Global Test Context
// ============================================================================

const testContext: IntegrationTestContext = {
  tempDirs: new Set(),
  orchestrators: new Set(),
  servers: new Set(),
  stores: new Set(),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a temporary directory for test isolation
 * Automatically registered for cleanup after tests
 */
async function createTempDir(prefix = 'apex-integration-test-'): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  testContext.tempDirs.add(tempDir);
  return tempDir;
}

/**
 * Register a temp directory for automatic cleanup
 */
function registerTempDir(dir: string): void {
  testContext.tempDirs.add(dir);
}

/**
 * Register an orchestrator for automatic cleanup
 */
function registerOrchestrator(orchestrator: { shutdown: () => Promise<void> }): void {
  testContext.orchestrators.add(orchestrator);
}

/**
 * Register a server for automatic cleanup
 */
function registerServer(server: { close: () => Promise<void> }): void {
  testContext.servers.add(server);
}

/**
 * Register a store for automatic cleanup
 */
function registerStore(store: { close: () => void }): void {
  testContext.stores.add(store);
}

/**
 * Clean up all registered resources
 */
async function cleanupAll(): Promise<void> {
  // Close stores first (databases)
  for (const store of testContext.stores) {
    try {
      store.close();
    } catch {
      // Ignore cleanup errors
    }
  }
  testContext.stores.clear();

  // Shutdown orchestrators
  for (const orchestrator of testContext.orchestrators) {
    try {
      await orchestrator.shutdown();
    } catch {
      // Ignore cleanup errors
    }
  }
  testContext.orchestrators.clear();

  // Close servers
  for (const server of testContext.servers) {
    try {
      await server.close();
    } catch {
      // Ignore cleanup errors
    }
  }
  testContext.servers.clear();

  // Remove temp directories
  for (const dir of testContext.tempDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors - directory may already be deleted
    }
  }
  testContext.tempDirs.clear();
}

/**
 * Wait for a condition to be truthy with timeout
 */
async function waitFor<T>(
  condition: () => T | Promise<T>,
  options: WaitForOptions = {}
): Promise<T> {
  const { timeout = 10000, interval = 100, message = 'Condition not met' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition();
      if (result) {
        return result;
      }
    } catch {
      // Condition threw, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
}

/**
 * Create a unique test ID with optional prefix
 */
function createTestId(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Global Test Helpers
// ============================================================================

/**
 * Confirmation flow test helpers available globally
 */
const confirmationHelpers: ConfirmationTestHelpers = {
  createTempDir,
  registerTempDir,
  registerOrchestrator,
  registerServer,
  registerStore,
  cleanupAll,
  waitFor,
  createTestId,
};

// Make helpers available globally
declare global {
  // eslint-disable-next-line no-var
  var apexTestHelpers: ConfirmationTestHelpers;
}

globalThis.apexTestHelpers = confirmationHelpers;

// ============================================================================
// Global Hooks
// ============================================================================

/**
 * Global setup before all tests
 * - Verify environment is ready for integration tests
 * - Set up any global state
 */
beforeAll(async () => {
  // Ensure we're in a test environment
  process.env.NODE_ENV = 'test';
  process.env.APEX_TEST_MODE = 'integration';

  // Increase the max listeners limit for tests to prevent memory leak warnings
  process.setMaxListeners(50);

  // Suppress console output during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  }
});

/**
 * Cleanup after each test
 * - Clear mocks
 * - Note: Resource cleanup happens in afterAll to support test parallelism
 */
afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Global teardown after all tests
 * - Clean up all registered resources
 * - Remove orphaned temp directories
 */
afterAll(async () => {
  // Clean up all registered resources
  await cleanupAll();

  // Restore console methods
  vi.restoreAllMocks();
});

// ============================================================================
// Database Cleanup Utilities
// ============================================================================

/**
 * Remove SQLite database files from a directory
 * Useful for cleaning up after tests that create databases
 */
export async function cleanupDatabaseFiles(dir: string): Promise<void> {
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (file.endsWith('.db') || file.endsWith('.db-journal') || file.endsWith('.db-wal')) {
        await fs.unlink(path.join(dir, file)).catch(() => {});
      }
    }
  } catch {
    // Directory may not exist
  }
}

/**
 * Clean up the .apex directory in a project
 * Removes database, agents, workflows, and other generated files
 */
export async function cleanupApexDir(projectPath: string): Promise<void> {
  const apexDir = path.join(projectPath, '.apex');
  try {
    await fs.rm(apexDir, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
}

// ============================================================================
// Confirmation Flow Test Utilities
// ============================================================================

/**
 * Create a minimal APEX project structure for testing
 * Useful for tests that need a valid project but don't want full initialization
 */
export async function createMinimalApexProject(
  projectPath: string,
  options: {
    projectName?: string;
    includeAgents?: boolean;
    includeWorkflows?: boolean;
  } = {}
): Promise<void> {
  const {
    projectName = 'test-project',
    includeAgents = true,
    includeWorkflows = true,
  } = options;

  const apexDir = path.join(projectPath, '.apex');
  await fs.mkdir(apexDir, { recursive: true });

  // Create minimal config
  const config = `
project:
  name: ${projectName}
  language: typescript

autonomy:
  default: supervised

models:
  planning: sonnet
  implementation: sonnet

limits:
  maxTokensPerTask: 100000
  maxCostPerTask: 10
`;
  await fs.writeFile(path.join(apexDir, 'config.yaml'), config);

  if (includeAgents) {
    const agentsDir = path.join(apexDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });

    // Create minimal developer agent
    const developerAgent = `---
name: developer
description: Implements features
tools: Read, Write, Edit
model: sonnet
---

You are a developer agent.`;
    await fs.writeFile(path.join(agentsDir, 'developer.md'), developerAgent);

    // Create minimal planner agent
    const plannerAgent = `---
name: planner
description: Plans features
tools: Read
model: sonnet
---

You are a planner agent.`;
    await fs.writeFile(path.join(agentsDir, 'planner.md'), plannerAgent);
  }

  if (includeWorkflows) {
    const workflowsDir = path.join(apexDir, 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });

    // Create minimal feature workflow
    const featureWorkflow = `name: feature
description: Feature workflow
stages:
  - name: planning
    agent: planner
    description: Plan the feature
  - name: implementation
    agent: developer
    description: Implement the feature
`;
    await fs.writeFile(path.join(workflowsDir, 'feature.yaml'), featureWorkflow);

    // Create approval workflow for confirmation tests
    const approvalWorkflow = `name: approval-workflow
description: Workflow with approval gate
gates:
  - id: review-gate
    name: Review Gate
    description: Review before proceeding
    required: true
    minApprovals: 1
    timeout: 60
    approvers:
      - reviewer
stages:
  - name: planning
    agent: planner
    description: Plan the feature
  - name: implementation
    agent: developer
    description: Implement the feature
    gate: review-gate
`;
    await fs.writeFile(path.join(workflowsDir, 'approval-workflow.yaml'), approvalWorkflow);
  }

  // Create scripts directory
  const scriptsDir = path.join(apexDir, 'scripts');
  await fs.mkdir(scriptsDir, { recursive: true });
}

/**
 * Wait for a task to reach a specific status
 */
export async function waitForTaskStatus(
  getTask: () => Promise<{ status: string } | null | undefined>,
  targetStatus: string | string[],
  options: WaitForOptions = {}
): Promise<{ status: string }> {
  const statuses = Array.isArray(targetStatus) ? targetStatus : [targetStatus];
  return waitFor(
    async () => {
      const task = await getTask();
      if (task && statuses.includes(task.status)) {
        return task;
      }
      return null;
    },
    {
      timeout: options.timeout ?? 15000,
      interval: options.interval ?? 200,
      message: options.message ?? `Task did not reach status ${statuses.join(' or ')}`,
    }
  ) as Promise<{ status: string }>;
}

/**
 * Wait for an approval request to be pending
 */
export async function waitForApprovalPending(
  getApprovalState: () => Promise<{ status: string } | null | undefined>,
  options: WaitForOptions = {}
): Promise<{ status: string }> {
  return waitFor(
    async () => {
      const state = await getApprovalState();
      if (state && state.status === 'pending') {
        return state;
      }
      return null;
    },
    {
      timeout: options.timeout ?? 10000,
      interval: options.interval ?? 100,
      message: options.message ?? 'Approval did not reach pending status',
    }
  ) as Promise<{ status: string }>;
}

// ============================================================================
// Export for direct imports
// ============================================================================

export {
  testContext,
  createTempDir,
  registerTempDir,
  registerOrchestrator,
  registerServer,
  registerStore,
  cleanupAll,
  waitFor,
  createTestId,
  confirmationHelpers,
};

export type { WaitForOptions };
