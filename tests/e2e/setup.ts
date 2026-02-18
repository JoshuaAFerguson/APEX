/**
 * @fileoverview E2E test setup for APEX
 *
 * This setup file provides:
 * 1. Global setup/teardown hooks for temporary directory and git repo management
 * 2. Database cleanup utilities for SQLite test databases
 * 3. Git repository scaffolding helpers
 * 4. Service lifecycle management (start/stop orchestrators, API servers)
 * 5. Extended resource cleanup for long-running E2E operations
 *
 * Usage:
 * - Automatically loaded by vitest.e2e.config.ts via setupFiles
 * - Provides global utilities via `globalThis.apexE2EHelpers`
 * - Manages cleanup of orphaned test resources after each test suite
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * E2E test context with resource tracking
 */
export interface E2ETestContext {
  /** Temporary directories created during tests */
  tempDirs: Set<string>;
  /** Active orchestrator instances for cleanup */
  orchestrators: Set<{ shutdown: () => Promise<void> }>;
  /** Active API servers for cleanup */
  servers: Set<{ close: () => Promise<void> }>;
  /** Active database stores for cleanup */
  stores: Set<{ close: () => void }>;
  /** Git repositories created during tests */
  gitRepos: Set<string>;
}

/**
 * E2E test helpers available globally
 */
export interface E2ETestHelpers {
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
  /** Create a temporary git repository for testing */
  createTempGitRepo: (prefix?: string) => Promise<string>;
  /** Create a bare git repository (for remote simulation) */
  createBareGitRepo: (prefix?: string) => Promise<string>;
  /** Clean up all registered resources */
  cleanupAll: () => Promise<void>;
  /** Wait for a condition with timeout (extended for E2E) */
  waitFor: <T>(condition: () => T | Promise<T>, options?: E2EWaitForOptions) => Promise<T>;
  /** Create a unique test ID */
  createTestId: (prefix?: string) => string;
  /** Create a minimal APEX project structure in a directory */
  createApexProject: (projectPath: string, options?: ApexProjectOptions) => Promise<void>;
}

export interface E2EWaitForOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

export interface ApexProjectOptions {
  projectName?: string;
  includeAgents?: boolean;
  includeWorkflows?: boolean;
  initGit?: boolean;
}

// ============================================================================
// Global Test Context
// ============================================================================

const e2eContext: E2ETestContext = {
  tempDirs: new Set(),
  orchestrators: new Set(),
  servers: new Set(),
  stores: new Set(),
  gitRepos: new Set(),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a temporary directory for test isolation
 */
async function createTempDir(prefix = 'apex-e2e-'): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  e2eContext.tempDirs.add(tempDir);
  return tempDir;
}

/**
 * Register a temp directory for automatic cleanup
 */
function registerTempDir(dir: string): void {
  e2eContext.tempDirs.add(dir);
}

/**
 * Register an orchestrator for automatic cleanup
 */
function registerOrchestrator(orchestrator: { shutdown: () => Promise<void> }): void {
  e2eContext.orchestrators.add(orchestrator);
}

/**
 * Register a server for automatic cleanup
 */
function registerServer(server: { close: () => Promise<void> }): void {
  e2eContext.servers.add(server);
}

/**
 * Register a store for automatic cleanup
 */
function registerStore(store: { close: () => void }): void {
  e2eContext.stores.add(store);
}

/**
 * Create a temporary git repository initialized with a commit
 */
async function createTempGitRepo(prefix = 'apex-e2e-repo-'): Promise<string> {
  const repoDir = await createTempDir(prefix);
  execSync('git init', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.email "test@apex.dev"', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.name "APEX E2E Test"', { cwd: repoDir, stdio: 'pipe' });

  // Create initial commit so we have a valid HEAD
  await fs.writeFile(path.join(repoDir, 'README.md'), '# Test Project\n');
  execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
  execSync('git commit -m "Initial commit"', { cwd: repoDir, stdio: 'pipe' });

  e2eContext.gitRepos.add(repoDir);
  return repoDir;
}

/**
 * Create a bare git repository (useful for simulating remote repos)
 */
async function createBareGitRepo(prefix = 'apex-e2e-bare-'): Promise<string> {
  const repoDir = await createTempDir(prefix);
  execSync('git init --bare', { cwd: repoDir, stdio: 'pipe' });
  e2eContext.gitRepos.add(repoDir);
  return repoDir;
}

/**
 * Clean up all registered resources
 */
async function cleanupAll(): Promise<void> {
  // Close stores first (databases)
  for (const store of e2eContext.stores) {
    try {
      store.close();
    } catch {
      // Ignore cleanup errors
    }
  }
  e2eContext.stores.clear();

  // Shutdown orchestrators
  for (const orchestrator of e2eContext.orchestrators) {
    try {
      await orchestrator.shutdown();
    } catch {
      // Ignore cleanup errors
    }
  }
  e2eContext.orchestrators.clear();

  // Close servers
  for (const server of e2eContext.servers) {
    try {
      await server.close();
    } catch {
      // Ignore cleanup errors
    }
  }
  e2eContext.servers.clear();

  // Remove temp directories (includes git repos)
  for (const dir of e2eContext.tempDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors - directory may already be deleted
    }
  }
  e2eContext.tempDirs.clear();
  e2eContext.gitRepos.clear();
}

/**
 * Wait for a condition to be truthy with extended timeout for E2E
 */
async function waitFor<T>(
  condition: () => T | Promise<T>,
  options: E2EWaitForOptions = {}
): Promise<T> {
  const { timeout = 30000, interval = 250, message = 'E2E condition not met' } = options;
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
 * Create a unique test ID
 */
function createTestId(prefix = 'e2e'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a minimal APEX project structure for E2E testing
 */
async function createApexProject(
  projectPath: string,
  options: ApexProjectOptions = {}
): Promise<void> {
  const {
    projectName = 'e2e-test-project',
    includeAgents = true,
    includeWorkflows = true,
    initGit = true,
  } = options;

  // Initialize git if requested
  if (initGit) {
    try {
      execSync('git init', { cwd: projectPath, stdio: 'pipe' });
      execSync('git config user.email "test@apex.dev"', { cwd: projectPath, stdio: 'pipe' });
      execSync('git config user.name "APEX E2E Test"', { cwd: projectPath, stdio: 'pipe' });
    } catch {
      // Git may already be initialized
    }
  }

  const apexDir = path.join(projectPath, '.apex');
  await fs.mkdir(apexDir, { recursive: true });

  // Create config
  const config = `project:
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

    await fs.writeFile(
      path.join(agentsDir, 'developer.md'),
      `---\nname: developer\ndescription: Implements features\ntools: Read, Write, Edit\nmodel: sonnet\n---\n\nYou are a developer agent.`
    );

    await fs.writeFile(
      path.join(agentsDir, 'planner.md'),
      `---\nname: planner\ndescription: Plans features\ntools: Read\nmodel: sonnet\n---\n\nYou are a planner agent.`
    );
  }

  if (includeWorkflows) {
    const workflowsDir = path.join(apexDir, 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });

    await fs.writeFile(
      path.join(workflowsDir, 'feature.yaml'),
      `name: feature\ndescription: Feature workflow\nstages:\n  - name: planning\n    agent: planner\n    description: Plan the feature\n  - name: implementation\n    agent: developer\n    description: Implement the feature\n`
    );
  }

  // Initial commit if git was initialized
  if (initGit) {
    try {
      execSync('git add .', { cwd: projectPath, stdio: 'pipe' });
      execSync('git commit -m "Initialize APEX project"', { cwd: projectPath, stdio: 'pipe' });
    } catch {
      // May fail if nothing to commit
    }
  }
}

// ============================================================================
// Global Test Helpers
// ============================================================================

const e2eHelpers: E2ETestHelpers = {
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
};

// Make helpers available globally
declare global {
  // eslint-disable-next-line no-var
  var apexE2EHelpers: E2ETestHelpers;
}

globalThis.apexE2EHelpers = e2eHelpers;

// ============================================================================
// Global Hooks
// ============================================================================

/**
 * Global setup before all E2E tests
 */
beforeAll(async () => {
  // Ensure we're in a test environment
  process.env.NODE_ENV = 'test';
  process.env.APEX_TEST_MODE = 'e2e';

  // Suppress console output during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  }

  // Verify git is available (required for E2E tests)
  try {
    execSync('git --version', { stdio: 'pipe' });
  } catch {
    throw new Error('Git is required for E2E tests but was not found in PATH');
  }
});

/**
 * Cleanup after each E2E test
 */
afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Global teardown after all E2E tests
 */
afterAll(async () => {
  // Clean up all registered resources
  await cleanupAll();

  // Restore console methods
  vi.restoreAllMocks();
});

// ============================================================================
// Exports
// ============================================================================

export {
  e2eContext,
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
};

export type { E2EWaitForOptions, ApexProjectOptions };
