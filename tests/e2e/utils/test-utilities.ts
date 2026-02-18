/**
 * @fileoverview E2E Test Utilities - Core testing infrastructure
 *
 * Provides the specific utility functions required by the acceptance criteria:
 * - createTestEnvironment() for isolated temp directories
 * - cleanupTestEnvironment() for cleanup
 * - runCLI() helper to execute CLI commands
 * - seed utilities for test data
 *
 * This module acts as a facade to the existing infrastructure in setup.ts
 * and cli-test-helpers.ts, providing the exact function names specified
 * in the acceptance criteria.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { runApexCLI, CLIResult, CLIOptions } from '../helpers/cli-test-helpers';
import {
  createTempDir,
  createApexProject,
  cleanupAll,
  ApexProjectOptions
} from '../setup';

// ============================================================================
// Test Environment Management
// ============================================================================

/**
 * Test environment configuration
 */
export interface TestEnvironment {
  /** Path to the test directory */
  path: string;
  /** Cleanup function for this environment */
  cleanup: () => Promise<void>;
  /** Whether the environment has git initialized */
  hasGit: boolean;
  /** Whether APEX project is initialized */
  hasApexProject: boolean;
}

/**
 * Options for creating test environments
 */
export interface CreateTestEnvironmentOptions {
  /** Prefix for temp directory name */
  prefix?: string;
  /** Whether to initialize git repository */
  initGit?: boolean;
  /** Whether to create APEX project structure */
  initApexProject?: boolean;
  /** APEX project options */
  apexOptions?: ApexProjectOptions;
}

/**
 * Create an isolated test environment with temporary directory
 *
 * This creates a temporary directory that can optionally include:
 * - Git repository initialization
 * - APEX project structure (.apex/, config.yaml, agents/, workflows/)
 * - Proper cleanup registration
 *
 * @param options Configuration for the test environment
 * @returns Promise resolving to test environment info
 *
 * @example
 * ```typescript
 * // Basic temp directory
 * const env = await createTestEnvironment();
 *
 * // Full APEX project with git
 * const env = await createTestEnvironment({
 *   initGit: true,
 *   initApexProject: true,
 *   apexOptions: { projectName: 'my-test' }
 * });
 *
 * // Clean up when done
 * await env.cleanup();
 * ```
 */
export async function createTestEnvironment(
  options: CreateTestEnvironmentOptions = {}
): Promise<TestEnvironment> {
  const {
    prefix = 'apex-e2e-test-',
    initGit = false,
    initApexProject = false,
    apexOptions = {}
  } = options;

  // Create temporary directory
  const tempDir = await createTempDir(prefix);

  // Initialize APEX project if requested
  if (initApexProject) {
    await createApexProject(tempDir, {
      initGit,
      ...apexOptions
    });
  }

  return {
    path: tempDir,
    cleanup: async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors - global cleanup will handle it
      }
    },
    hasGit: initGit,
    hasApexProject: initApexProject
  };
}

/**
 * Clean up test environment and all registered resources
 *
 * This is a convenience function that cleans up all registered
 * test resources including temporary directories, databases,
 * orchestrators, and servers.
 *
 * @example
 * ```typescript
 * // Clean up everything after tests
 * await cleanupTestEnvironment();
 * ```
 */
export async function cleanupTestEnvironment(): Promise<void> {
  await cleanupAll();
}

// ============================================================================
// CLI Execution Helper
// ============================================================================

/**
 * Execute APEX CLI command in test environment
 *
 * This is a simplified wrapper around runApexCLI that provides
 * the exact function name specified in acceptance criteria.
 *
 * @param command CLI command to run (without 'apex' prefix)
 * @param workingDir Directory to run command in
 * @param options Additional CLI options
 * @returns Promise resolving to command result
 *
 * @example
 * ```typescript
 * // Run CLI command in test environment
 * const result = await runCLI('init --yes', env.path);
 * expect(result.success).toBe(true);
 *
 * // Run with additional options
 * const result = await runCLI('mcp list --json', env.path, {
 *   timeout: 60000,
 *   env: { DEBUG: '1' }
 * });
 * ```
 */
export async function runCLI(
  command: string,
  workingDir: string,
  options: Omit<CLIOptions, 'cwd'> = {}
): Promise<CLIResult> {
  return runApexCLI(command, {
    ...options,
    cwd: workingDir
  });
}

// ============================================================================
// Seed Utilities
// ============================================================================

/**
 * Common test data for seeding test environments
 */
export interface SeedData {
  /** Project configuration */
  project?: {
    name: string;
    language: string;
    description?: string;
  };
  /** Agent definitions */
  agents?: Array<{
    name: string;
    description: string;
    tools: string[];
    model?: string;
    prompt?: string;
  }>;
  /** Workflow definitions */
  workflows?: Array<{
    name: string;
    description: string;
    stages: Array<{
      name: string;
      agent: string;
      description: string;
    }>;
  }>;
  /** MCP server configurations */
  mcpServers?: Record<string, {
    name: string;
    type?: string;
    command?: string;
    args?: string[];
    url?: string;
    autoStart?: boolean;
  }>;
  /** Initial files to create */
  files?: Record<string, string>;
}

/**
 * Default seed data for testing
 */
export const DEFAULT_SEED_DATA: SeedData = {
  project: {
    name: 'test-project',
    language: 'typescript',
    description: 'Test project for E2E testing'
  },
  agents: [
    {
      name: 'developer',
      description: 'Implements features and writes production code',
      tools: ['Read', 'Write', 'Edit', 'Bash'],
      model: 'sonnet'
    },
    {
      name: 'planner',
      description: 'Plans implementation approach and breaks down tasks',
      tools: ['Read', 'Glob', 'Grep'],
      model: 'sonnet'
    },
    {
      name: 'tester',
      description: 'Writes and runs tests to verify functionality',
      tools: ['Read', 'Write', 'Edit', 'Bash'],
      model: 'sonnet'
    }
  ],
  workflows: [
    {
      name: 'feature',
      description: 'Standard feature development workflow',
      stages: [
        { name: 'planning', agent: 'planner', description: 'Plan the feature implementation' },
        { name: 'implementation', agent: 'developer', description: 'Implement the feature' },
        { name: 'testing', agent: 'tester', description: 'Test the implementation' }
      ]
    }
  ],
  mcpServers: {
    'file-manager': {
      name: 'file-manager',
      type: 'local',
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
      autoStart: true
    }
  },
  files: {
    'README.md': '# Test Project\n\nThis is a test project for E2E testing.\n',
    'package.json': JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      description: 'Test project',
      scripts: {
        test: 'echo "No tests specified"'
      }
    }, null, 2)
  }
};

/**
 * Seed a test environment with predefined test data
 *
 * This utility populates a test environment with realistic
 * APEX project structure and content for testing various
 * scenarios.
 *
 * @param environment Test environment to seed
 * @param seedData Data to seed the environment with (defaults to DEFAULT_SEED_DATA)
 * @returns Promise that resolves when seeding is complete
 *
 * @example
 * ```typescript
 * const env = await createTestEnvironment({ initApexProject: true });
 * await seedTestData(env);
 *
 * // Now environment has realistic agents, workflows, and files
 * const result = await runCLI('agent list', env.path);
 * expect(result.stdout).toContain('developer');
 * ```
 */
export async function seedTestData(
  environment: TestEnvironment,
  seedData: SeedData = DEFAULT_SEED_DATA
): Promise<void> {
  const { path: envPath } = environment;

  // Ensure .apex directory exists
  const apexDir = path.join(envPath, '.apex');
  await fs.mkdir(apexDir, { recursive: true });

  // Seed agents
  if (seedData.agents) {
    const agentsDir = path.join(apexDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });

    for (const agent of seedData.agents) {
      const agentContent = `---
name: ${agent.name}
description: ${agent.description}
tools: ${agent.tools.join(', ')}
model: ${agent.model || 'sonnet'}
---

${agent.prompt || `You are the ${agent.name} agent. ${agent.description}.`}
`;
      await fs.writeFile(path.join(agentsDir, `${agent.name}.md`), agentContent);
    }
  }

  // Seed workflows
  if (seedData.workflows) {
    const workflowsDir = path.join(apexDir, 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });

    for (const workflow of seedData.workflows) {
      const workflowContent = `name: ${workflow.name}
description: ${workflow.description}
stages:
${workflow.stages.map(stage =>
  `  - name: ${stage.name}
    agent: ${stage.agent}
    description: ${stage.description}`
).join('\n')}
`;
      await fs.writeFile(path.join(workflowsDir, `${workflow.name}.yaml`), workflowContent);
    }
  }

  // Update config with project info and MCP servers
  const configPath = path.join(apexDir, 'config.yaml');
  let configContent = '';

  if (seedData.project) {
    configContent += `project:
  name: ${seedData.project.name}
  language: ${seedData.project.language}
${seedData.project.description ? `  description: ${seedData.project.description}` : ''}

`;
  }

  configContent += `autonomy:
  default: supervised

models:
  planning: sonnet
  implementation: sonnet

limits:
  maxTokensPerTask: 100000
  maxCostPerTask: 10

`;

  if (seedData.mcpServers) {
    configContent += `mcp:
  servers:
${Object.entries(seedData.mcpServers).map(([key, server]) => {
  const serverYaml = `    ${key}:
      name: ${server.name}
${server.type ? `      type: ${server.type}` : ''}
${server.command ? `      command: ${server.command}` : ''}
${server.args ? `      args: [${server.args.map(arg => `"${arg}"`).join(', ')}]` : ''}
${server.url ? `      url: ${server.url}` : ''}
${server.autoStart !== undefined ? `      autoStart: ${server.autoStart}` : ''}`;
  return serverYaml;
}).join('\n')}
`;
  }

  await fs.writeFile(configPath, configContent);

  // Seed additional files
  if (seedData.files) {
    for (const [filePath, content] of Object.entries(seedData.files)) {
      const fullPath = path.join(envPath, filePath);
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content);
    }
  }
}

/**
 * Create seed data for specific testing scenarios
 */
export const SEED_SCENARIOS = {
  /**
   * Minimal project setup with just basic structure
   */
  minimal: {
    project: {
      name: 'minimal-test',
      language: 'typescript'
    }
  } as SeedData,

  /**
   * Full project setup with all components
   */
  full: DEFAULT_SEED_DATA,

  /**
   * MCP-focused setup for testing MCP marketplace features
   */
  mcp: {
    project: {
      name: 'mcp-test',
      language: 'typescript'
    },
    mcpServers: {
      'test-server': {
        name: 'test-server',
        type: 'local',
        command: 'echo',
        args: ['test'],
        autoStart: false
      },
      'filesystem': {
        name: 'filesystem',
        type: 'local',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
        autoStart: true
      }
    }
  } as SeedData,

  /**
   * Git-focused setup for testing git workflows
   */
  git: {
    project: {
      name: 'git-test',
      language: 'typescript'
    },
    files: {
      'src/index.ts': 'console.log("Hello World");',
      'test/index.test.ts': 'describe("test", () => { it("works", () => expect(true).toBe(true)); });',
      '.gitignore': 'node_modules/\n*.log\n.env\n'
    }
  } as SeedData
};

// ============================================================================
// Convenience Exports
// ============================================================================

// Re-export types and utilities for easy access
export type { CLIResult, CLIOptions } from '../helpers/cli-test-helpers';
export type { ApexProjectOptions } from '../setup';

// Re-export commonly used functions
export {
  assertCLISuccess,
  assertCLIFailure,
  parseJSONOutput
} from '../helpers/cli-test-helpers';

// Global helpers access
export const e2eHelpers = globalThis.apexE2EHelpers;