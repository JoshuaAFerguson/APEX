/**
 * @fileoverview Integration Test Setup and Teardown Helpers
 *
 * This file provides comprehensive setup and teardown utilities for integration tests.
 * It manages test contexts, resource cleanup, and provides hooks for common test scenarios.
 */

import { beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'eventemitter3';
import type { IntegrationTestContext } from './types.js';

// ============================================================================
// Global Test Context Management
// ============================================================================

const globalTestContexts = new Map<string, IntegrationTestContext>();
let testCounter = 0;

/**
 * Create a new integration test context with automatic cleanup tracking
 */
export async function createTestContext(testName?: string): Promise<IntegrationTestContext> {
  const id = `test-${++testCounter}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const context: IntegrationTestContext = {
    id,
    tempDirs: new Set(),
    orchestrators: new Set(),
    servers: new Set(),
    stores: new Set(),
    browsers: new Set(),
    mocks: new Set(),
    artifacts: new Map(),
  };

  globalTestContexts.set(id, context);

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.APEX_TEST_MODE = 'integration';
  if (testName) {
    process.env.APEX_CURRENT_TEST = testName;
  }

  return context;
}

/**
 * Get an existing test context by ID
 */
export function getTestContext(id: string): IntegrationTestContext | undefined {
  return globalTestContexts.get(id);
}

/**
 * Clean up a specific test context
 */
export async function cleanupTestContext(context: IntegrationTestContext): Promise<void> {
  // Clean up mocks
  for (const mock of context.mocks) {
    try {
      mock.mockRestore?.();
    } catch {
      // Ignore cleanup errors
    }
  }
  context.mocks.clear();

  // Clean up browsers
  for (const browser of context.browsers) {
    try {
      await browser.cleanup();
    } catch {
      // Ignore cleanup errors
    }
  }
  context.browsers.clear();

  // Clean up stores
  for (const store of context.stores) {
    try {
      store.close();
    } catch {
      // Ignore cleanup errors
    }
  }
  context.stores.clear();

  // Clean up servers
  for (const server of context.servers) {
    try {
      await server.close();
    } catch {
      // Ignore cleanup errors
    }
  }
  context.servers.clear();

  // Clean up orchestrators
  for (const orchestrator of context.orchestrators) {
    try {
      await orchestrator.shutdown();
    } catch {
      // Ignore cleanup errors
    }
  }
  context.orchestrators.clear();

  // Clean up temp directories
  for (const dir of context.tempDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
  context.tempDirs.clear();

  // Save artifacts if needed
  await saveTestArtifacts(context);

  // Remove from global contexts
  globalTestContexts.delete(context.id);
}

/**
 * Clean up all test contexts
 */
export async function cleanupAllTestContexts(): Promise<void> {
  const contexts = Array.from(globalTestContexts.values());
  await Promise.all(contexts.map(cleanupTestContext));
}

// ============================================================================
// Test Artifact Management
// ============================================================================

/**
 * Save test artifacts to a designated directory
 */
async function saveTestArtifacts(context: IntegrationTestContext): Promise<void> {
  if (context.artifacts.size === 0) {
    return;
  }

  const artifactsDir = path.join(process.cwd(), 'test-artifacts', context.id);

  try {
    await fs.mkdir(artifactsDir, { recursive: true });

    for (const [name, artifactPath] of context.artifacts) {
      try {
        const targetPath = path.join(artifactsDir, name);
        await fs.copyFile(artifactPath, targetPath);
      } catch {
        // Ignore individual artifact errors
      }
    }
  } catch {
    // Ignore artifacts directory creation errors
  }
}

/**
 * Add an artifact to the test context
 */
export async function addTestArtifact(
  context: IntegrationTestContext,
  name: string,
  content: string | Buffer,
  type: 'screenshot' | 'log' | 'html' | 'json' | 'video' = 'log'
): Promise<void> {
  const tempDir = await createTempDir('apex-test-artifact-');
  const artifactPath = path.join(tempDir, name);

  await fs.writeFile(artifactPath, content);
  context.artifacts.set(name, artifactPath);
  context.tempDirs.add(tempDir);
}

// ============================================================================
// Common Setup Utilities
// ============================================================================

/**
 * Create a temporary directory for test isolation
 */
export async function createTempDir(prefix = 'apex-integration-test-'): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * Create a temporary APEX project structure for testing
 */
export async function createTempApexProject(
  context: IntegrationTestContext,
  options: {
    projectName?: string;
    includeAgents?: boolean;
    includeWorkflows?: boolean;
    config?: Record<string, any>;
  } = {}
): Promise<string> {
  const {
    projectName = 'test-project',
    includeAgents = true,
    includeWorkflows = true,
    config = {},
  } = options;

  const projectDir = await createTempDir('apex-test-project-');
  context.tempDirs.add(projectDir);

  const apexDir = path.join(projectDir, '.apex');
  await fs.mkdir(apexDir, { recursive: true });

  // Create config
  const defaultConfig = {
    project: { name: projectName, language: 'typescript' },
    autonomy: { default: 'supervised' },
    models: { planning: 'sonnet', implementation: 'sonnet' },
    limits: { maxTokensPerTask: 100000, maxCostPerTask: 10 },
    ...config,
  };

  const yamlConfig = Object.entries(defaultConfig)
    .map(([key, value]) => {
      if (typeof value === 'object') {
        const subEntries = Object.entries(value)
          .map(([subKey, subValue]) => `  ${subKey}: ${subValue}`)
          .join('\n');
        return `${key}:\n${subEntries}`;
      }
      return `${key}: ${value}`;
    })
    .join('\n\n');

  await fs.writeFile(path.join(apexDir, 'config.yaml'), yamlConfig);

  if (includeAgents) {
    const agentsDir = path.join(apexDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });

    const developerAgent = `---
name: developer
description: Implements features
tools: Read, Write, Edit
model: sonnet
---

You are a developer agent.`;
    await fs.writeFile(path.join(agentsDir, 'developer.md'), developerAgent);

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

    const featureWorkflow = `name: feature
description: Feature workflow
stages:
  - name: planning
    agent: planner
    description: Plan the feature
  - name: implementation
    agent: developer
    description: Implement the feature`;
    await fs.writeFile(path.join(workflowsDir, 'feature.yaml'), featureWorkflow);
  }

  return projectDir;
}

// ============================================================================
// Wait Utilities
// ============================================================================

/**
 * Wait for a condition to be truthy with timeout
 */
export async function waitFor<T>(
  condition: () => T | Promise<T>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
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
 * Wait for a specific event to be emitted
 */
export async function waitForEvent<T = any>(
  emitter: EventEmitter,
  eventName: string,
  options: { timeout?: number; filter?: (data: T) => boolean } = {}
): Promise<T> {
  const { timeout = 10000, filter } = options;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(eventName, handler);
      reject(new Error(`Event '${eventName}' not emitted within ${timeout}ms`));
    }, timeout);

    const handler = (data: T) => {
      if (!filter || filter(data)) {
        clearTimeout(timer);
        emitter.off(eventName, handler);
        resolve(data);
      }
    };

    emitter.on(eventName, handler);
  });
}

// ============================================================================
// Global Test Hooks
// ============================================================================

/**
 * Set up integration test environment (call in beforeAll)
 */
export function setupIntegrationTestEnvironment(): void {
  // Set environment variables
  process.env.NODE_ENV = 'test';
  process.env.APEX_TEST_MODE = 'integration';

  // Suppress console output unless DEBUG is set
  if (!process.env.DEBUG && !process.env.VERBOSE_TESTS) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  }

  // Increase timeout for integration tests
  vi.setConfig({ testTimeout: 30000 });
}

/**
 * Tear down integration test environment (call in afterAll)
 */
export async function teardownIntegrationTestEnvironment(): Promise<void> {
  // Clean up all test contexts
  await cleanupAllTestContexts();

  // Restore console methods
  vi.restoreAllMocks();

  // Clear environment variables
  delete process.env.APEX_TEST_MODE;
  delete process.env.APEX_CURRENT_TEST;
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Create a test context for each test (call in beforeEach)
 */
export async function setupTestContext(testName?: string): Promise<IntegrationTestContext> {
  return createTestContext(testName);
}

/**
 * Clean up test context after each test (call in afterEach)
 */
export async function teardownTestContext(context: IntegrationTestContext): Promise<void> {
  await cleanupTestContext(context);
}

/**
 * Set up global integration test hooks
 * Call this once per test file to automatically manage test lifecycle
 */
export function useIntegrationTestHooks(): {
  getContext: () => IntegrationTestContext | undefined;
} {
  let currentContext: IntegrationTestContext | undefined;

  beforeAll(() => {
    setupIntegrationTestEnvironment();
  });

  beforeEach(async () => {
    currentContext = await setupTestContext();
  });

  afterEach(async () => {
    if (currentContext) {
      await teardownTestContext(currentContext);
      currentContext = undefined;
    }
  });

  afterAll(async () => {
    await teardownIntegrationTestEnvironment();
  });

  return {
    getContext: () => currentContext,
  };
}