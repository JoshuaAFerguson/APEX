# E2E Testing Best Practices & Patterns

> Comprehensive guide to writing effective end-to-end tests in APEX with proven patterns and best practices.

## Table of Contents

- [Overview](#overview)
- [Test Design Principles](#test-design-principles)
- [Common Patterns](#common-patterns)
- [Testing Utilities Guide](#testing-utilities-guide)
- [Performance & Reliability](#performance--reliability)
- [Cross-Platform Considerations](#cross-platform-considerations)
- [Error Handling Patterns](#error-handling-patterns)
- [Test Data Management](#test-data-management)
- [Debugging Strategies](#debugging-strategies)
- [Code Review Checklist](#code-review-checklist)

---

## Overview

This guide provides battle-tested patterns and best practices for writing reliable, maintainable E2E tests in APEX. It complements the main [E2E Testing Guide](./e2e.md) with specific patterns, examples, and troubleshooting strategies.

### Key Principles

1. **Tests should be deterministic** - Same input always produces same output
2. **Tests should be isolated** - No dependencies between tests
3. **Tests should be readable** - Clear intent and comprehensive error messages
4. **Tests should be maintainable** - Easy to update when features change
5. **Tests should be fast enough** - Balance thorough testing with execution time

---

## Test Design Principles

### 1. Single Responsibility Principle

Each test should verify exactly one workflow or behavior:

```typescript
// ❌ BAD: Testing multiple unrelated behaviors
it('should handle project initialization and git operations and MCP setup', async () => {
  // Too much responsibility in one test
});

// ✅ GOOD: Single focused test
it('should initialize APEX project with default configuration', async () => {
  const result = await runCLI('init --yes', env.path);
  expect(result.success).toBe(true);
  expect(result.stdout).toContain('Project initialized successfully');
});
```

### 2. Arrange-Act-Assert Pattern

Structure tests with clear phases:

```typescript
it('should merge feature branch successfully', async () => {
  // ARRANGE: Set up test data
  await seedTestData(env, SEED_SCENARIOS.git);
  const taskId = await createTestTask(env, 'feature/login-improvement');
  await createBranchWithChanges(env, 'feature/login-improvement');

  // ACT: Perform the action being tested
  const result = await orchestrator.mergeTaskBranch(taskId, { strategy: 'merge' });

  // ASSERT: Verify the expected outcomes
  expect(result.success).toBe(true);
  expect(result.message).toContain('successfully merged');

  // Verify git state
  const currentBranch = getCurrentBranch(env.path);
  expect(currentBranch).toBe('main');
});
```

### 3. Test Isolation

Ensure tests don't affect each other:

```typescript
describe('E2E: Feature Tests', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    // Fresh environment for each test
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true,
      apexOptions: { projectName: `test-${Date.now()}` }
    });
  });

  afterEach(async () => {
    // Always clean up, even if test fails
    try {
      await env.cleanup();
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
      // Don't throw - let test result stand
    }
  });
});
```

---

## Common Patterns

### 1. CLI Command Testing Pattern

Standard pattern for testing CLI commands:

```typescript
import { runApexCLI, assertCLISuccess } from './helpers/cli-test-helpers';

async function testCLICommand(command: string, expectedOutput: string, workingDir: string) {
  const result = await runApexCLI(command, { cwd: workingDir });

  // Always check success first with helpful error message
  expect(result.success, `CLI command failed: ${result.stderr}`).toBe(true);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain(expectedOutput);
  expect(result.stderr).toBe(''); // No errors should be written to stderr

  return result;
}

// Usage example
it('should list available agents', async () => {
  await seedTestData(env, SEED_SCENARIOS.full);
  const result = await testCLICommand(
    'agent list',
    'Available agents:',
    env.path
  );
  expect(result.stdout).toContain('developer');
  expect(result.stdout).toContain('planner');
});
```

### 2. Git Operations Testing Pattern

Pattern for testing git-related functionality:

```typescript
import { createTempGitRepo, createBareGitRepo } from './index';

async function setupGitWorkflow(testName: string) {
  // Create working repository
  const workingRepo = await createTempGitRepo(`${testName}-working-`);

  // Create bare repository to simulate remote
  const remoteRepo = await createBareGitRepo(`${testName}-remote-`);

  // Configure remote
  execSync(`git remote add origin ${remoteRepo}`, {
    cwd: workingRepo,
    stdio: 'pipe'
  });

  // Initial push to establish connection
  execSync('git push -u origin main', {
    cwd: workingRepo,
    stdio: 'pipe'
  });

  return { workingRepo, remoteRepo };
}

// Usage example
it('should handle merge conflicts gracefully', async () => {
  const { workingRepo } = await setupGitWorkflow('conflict-test');

  // Create conflicting changes on different branches
  await createConflictingBranches(workingRepo);

  // Attempt merge through APEX orchestrator
  const result = await orchestrator.mergeTaskBranch(taskId, { strategy: 'merge' });

  expect(result.success).toBe(false);
  expect(result.error).toContain('merge conflict');

  // Verify repository is in clean state after failed merge
  const status = getGitStatus(workingRepo);
  expect(status.conflicted).toHaveLength(1);
  expect(status.staged).toHaveLength(0);
});
```

### 3. MCP Testing Pattern

Pattern for testing MCP marketplace functionality:

```typescript
import {
  createTestProjectWithServers,
  assertMarketplaceOutput,
  execMCPCommand
} from './utils/mcp-test-utils';

async function testMCPWorkflow(command: string, expectedServers: string[]) {
  const env = await createTestProjectWithServers(expectedServers);

  const result = await execMCPCommand(command, env.path);
  assertMarketplaceOutput(result, {
    serverCount: expectedServers.length,
    verifiedCount: expectedServers.length
  });

  return { env, result };
}

// Usage example
it('should install and configure MCP servers', async () => {
  const { env, result } = await testMCPWorkflow('install github', ['github']);

  // Verify server was added to configuration
  const config = await readApexConfig(env.path);
  expect(config.mcp?.servers).toHaveProperty('github');
  expect(config.mcp.servers.github.command).toBe('npx');
});
```

### 4. Error Testing Pattern

Pattern for testing error conditions:

```typescript
async function testErrorScenario(
  action: () => Promise<any>,
  expectedError: string | RegExp,
  shouldCleanup: boolean = true
) {
  let thrownError: Error | null = null;

  try {
    await action();
    // If we reach here, the action didn't throw as expected
    expect.fail('Expected action to throw an error, but it succeeded');
  } catch (error) {
    thrownError = error as Error;
  }

  expect(thrownError).toBeDefined();
  if (typeof expectedError === 'string') {
    expect(thrownError!.message).toContain(expectedError);
  } else {
    expect(thrownError!.message).toMatch(expectedError);
  }

  // Verify system is in expected state after error
  if (shouldCleanup) {
    // Add verification that error didn't leave system in bad state
  }
}

// Usage example
it('should handle invalid branch names gracefully', async () => {
  await testErrorScenario(
    () => runApexCLI('checkout "invalid..branch"', env.path),
    /invalid branch name/i
  );

  // Verify we're still on original branch
  const currentBranch = getCurrentBranch(env.path);
  expect(currentBranch).toBe('main');
});
```

### 5. Async Condition Waiting Pattern

Pattern for waiting for asynchronous conditions:

```typescript
import { waitFor } from './index';

async function waitForConditionWithRetry<T>(
  condition: () => T | Promise<T>,
  options: {
    timeout?: number;
    interval?: number;
    description?: string;
  } = {}
): Promise<T> {
  const {
    timeout = 30000,
    interval = 1000,
    description = 'condition to be met'
  } = options;

  try {
    return await waitFor(condition, { timeout, interval });
  } catch (error) {
    throw new Error(
      `Timeout waiting for ${description} after ${timeout}ms: ${error.message}`
    );
  }
}

// Usage example
it('should complete long-running task within timeout', async () => {
  const taskId = await createLongRunningTask(env);

  const completedTask = await waitForConditionWithRetry(
    async () => {
      const task = await orchestrator.getTask(taskId);
      if (task.status === 'completed') return task;
      if (task.status === 'failed') throw new Error(`Task failed: ${task.error}`);
      return null; // Still running, continue waiting
    },
    {
      timeout: 120000,
      description: 'long-running task to complete'
    }
  );

  expect(completedTask.status).toBe('completed');
  expect(completedTask.result).toBeDefined();
});
```

---

## Testing Utilities Guide

### Core Utilities

#### `createTestEnvironment(options)`

Creates an isolated test environment with optional git and APEX initialization:

```typescript
interface TestEnvironmentOptions {
  initGit?: boolean;           // Initialize git repository
  initApexProject?: boolean;   // Initialize APEX project
  apexOptions?: {
    projectName?: string;
    includeAgents?: boolean;
    includeWorkflows?: boolean;
  };
}

// Examples
const minimalEnv = await createTestEnvironment();
const gitEnv = await createTestEnvironment({ initGit: true });
const fullEnv = await createTestEnvironment({
  initGit: true,
  initApexProject: true,
  apexOptions: {
    projectName: 'test-project',
    includeAgents: true,
    includeWorkflows: true
  }
});
```

#### `runCLI(command, workingDir)`

Executes CLI commands in the test environment:

```typescript
interface CLIResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

// Basic usage
const result = await runCLI('init --yes', env.path);

// With error handling
try {
  const result = await runCLI('invalid-command', env.path);
  expect(result.success).toBe(false);
  expect(result.exitCode).not.toBe(0);
} catch (error) {
  // Command execution itself failed (not command result)
  console.error('CLI execution failed:', error);
}
```

#### `seedTestData(env, scenario)`

Seeds test environment with predefined data:

```typescript
// Available scenarios
await seedTestData(env, SEED_SCENARIOS.minimal);  // Basic project structure
await seedTestData(env, SEED_SCENARIOS.full);     // Complete project setup
await seedTestData(env, SEED_SCENARIOS.mcp);      // MCP-focused setup
await seedTestData(env, SEED_SCENARIOS.git);      // Git workflow focused

// Custom seed data
await seedTestData(env, {
  agents: [
    { name: 'custom-agent', description: 'Custom test agent' }
  ],
  workflows: [
    { name: 'custom-workflow', stages: ['planning', 'implementation'] }
  ],
  files: [
    { path: 'src/test.ts', content: 'export const test = true;' }
  ]
});
```

### Git Utilities

#### Repository Creation

```typescript
// Working repository with initial commit
const workingRepo = await createTempGitRepo('test-');

// Bare repository for simulating remotes
const remoteRepo = await createBareGitRepo('remote-');

// Configure repository relationship
execSync(`git remote add origin ${remoteRepo}`, { cwd: workingRepo });
execSync('git push -u origin main', { cwd: workingRepo });
```

#### Git State Verification

```typescript
function verifyGitState(repoPath: string, expected: {
  branch?: string;
  hasUncommitted?: boolean;
  hasUntracked?: boolean;
  commitCount?: number;
}) {
  if (expected.branch) {
    const currentBranch = getCurrentBranch(repoPath);
    expect(currentBranch).toBe(expected.branch);
  }

  if (expected.hasUncommitted !== undefined) {
    const hasUncommitted = getUncommittedChanges(repoPath).length > 0;
    expect(hasUncommitted).toBe(expected.hasUncommitted);
  }

  if (expected.commitCount !== undefined) {
    const commitCount = getCommitCount(repoPath);
    expect(commitCount).toBe(expected.commitCount);
  }
}

// Usage
verifyGitState(env.path, {
  branch: 'main',
  hasUncommitted: false,
  commitCount: 3
});
```

### Resource Management

#### Automatic Cleanup Registration

```typescript
describe('E2E: Resource Management', () => {
  let orchestrator: ApexOrchestrator;
  let server: FastifyInstance;
  let store: TaskStore;

  beforeEach(async () => {
    // Create resources and register for cleanup
    orchestrator = new ApexOrchestrator({ projectRoot: env.path });
    server = await createTestAPIServer();
    store = new TaskStore(path.join(env.path, '.apex/apex.db'));

    // Register for automatic cleanup
    globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);
    globalThis.apexE2EHelpers.registerServer(server);
    globalThis.apexE2EHelpers.registerStore(store);
  });

  // Tests automatically benefit from resource cleanup
});
```

---

## Performance & Reliability

### 1. Timeout Management

Set appropriate timeouts based on operation type:

```typescript
// Test-level timeouts for different operation types
describe('E2E: Performance Tests', () => {
  // Quick CLI operations
  it('should execute help command quickly', { timeout: 10000 }, async () => {
    const result = await runCLI('--help', env.path);
    expect(result.success).toBe(true);
  });

  // Standard operations
  it('should initialize project', { timeout: 30000 }, async () => {
    const result = await runCLI('init --yes', env.path);
    expect(result.success).toBe(true);
  });

  // Long operations
  it('should complete full workflow', { timeout: 120000 }, async () => {
    const result = await runCLI('run feature --auto-merge', env.path);
    expect(result.success).toBe(true);
  });
});
```

### 2. Retry Strategies

Use built-in retry for flaky operations:

```typescript
// Automatic retries (configured in vitest.e2e.config.ts)
// CI: 2 retries, Local: 0 retries

// Custom retry for specific operations
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw new Error(
          `Operation failed after ${maxAttempts} attempts: ${lastError.message}`
        );
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Usage for network operations
it('should handle flaky network operations', async () => {
  const result = await withRetry(
    () => runCLI('mcp browse', env.path),
    3,
    2000
  );
  expect(result.success).toBe(true);
});
```

### 3. Resource Constraints

Test within reasonable resource limits:

```typescript
// Monitor resource usage
function trackResourceUsage<T>(
  operation: () => Promise<T>,
  limits: { memory?: number; time?: number }
): Promise<{ result: T; stats: { memory: number; time: number } }> {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  return operation().then(result => {
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;

    const stats = {
      time: endTime - startTime,
      memory: endMemory - startMemory
    };

    if (limits.time && stats.time > limits.time) {
      throw new Error(`Operation took ${stats.time}ms, exceeds limit ${limits.time}ms`);
    }

    if (limits.memory && stats.memory > limits.memory) {
      throw new Error(`Operation used ${stats.memory} bytes, exceeds limit ${limits.memory} bytes`);
    }

    return { result, stats };
  });
}

// Usage
it('should complete initialization within resource limits', async () => {
  const { result, stats } = await trackResourceUsage(
    () => runCLI('init --yes', env.path),
    { time: 30000, memory: 50 * 1024 * 1024 } // 30s, 50MB
  );

  expect(result.success).toBe(true);
  console.log(`Initialization took ${stats.time}ms and used ${stats.memory} bytes`);
});
```

---

## Cross-Platform Considerations

### 1. Path Handling

Always use cross-platform path operations:

```typescript
import * as path from 'path';

// ✅ GOOD: Cross-platform path handling
const configPath = path.join(env.path, '.apex', 'config.yaml');
const agentPath = path.join(env.path, '.apex', 'agents', 'developer.md');

// ❌ BAD: Platform-specific path separators
const configPath = `${env.path}/.apex/config.yaml`; // Fails on Windows
```

### 2. Command Execution

Handle command execution differences:

```typescript
import { execSync } from 'child_process';

function execCrossPlatform(command: string, options: any = {}) {
  const isWindows = process.platform === 'win32';

  // Adjust command for Windows
  const adjustedCommand = isWindows
    ? command.replace(/'/g, '"')  // Single quotes to double quotes
    : command;

  return execSync(adjustedCommand, {
    encoding: 'utf8',
    stdio: 'pipe',
    ...options
  });
}

// Usage
it('should work on all platforms', async () => {
  const output = execCrossPlatform("git log --oneline -n 1", { cwd: env.path });
  expect(output).toContain('Initial commit');
});
```

### 3. File System Operations

Handle file system differences:

```typescript
import * as fs from 'fs/promises';

async function writeFileWithPermissions(filePath: string, content: string) {
  await fs.writeFile(filePath, content, 'utf8');

  // Set executable permissions on Unix-like systems
  if (process.platform !== 'win32') {
    await fs.chmod(filePath, 0o755);
  }
}

// Test file permissions appropriately
it('should create executable scripts', async () => {
  const scriptPath = path.join(env.path, 'test-script.sh');
  await writeFileWithPermissions(scriptPath, '#!/bin/bash\necho "test"');

  const stats = await fs.stat(scriptPath);
  if (process.platform !== 'win32') {
    // Check executable bit on Unix-like systems
    expect(stats.mode & 0o111).toBeGreaterThan(0);
  }
});
```

---

## Error Handling Patterns

### 1. Comprehensive Error Testing

Test all possible error scenarios:

```typescript
describe('Error Handling', () => {
  it('should handle missing prerequisites', async () => {
    // Test without git
    const envWithoutGit = await createTestEnvironment({ initGit: false });
    const result = await runCLI('checkout feature-branch', envWithoutGit.path);

    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/git.*not.*found|not.*git.*repository/i);
  });

  it('should handle invalid input gracefully', async () => {
    const invalidInputs = ['', '..', null, undefined, '\x00invalid'];

    for (const input of invalidInputs) {
      const result = await runCLI(`checkout "${input}"`, env.path);
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Invalid');
    }
  });

  it('should handle filesystem errors', async () => {
    // Create read-only directory to trigger permission error
    const readOnlyDir = path.join(env.path, 'readonly');
    await fs.mkdir(readOnlyDir);
    await fs.chmod(readOnlyDir, 0o444); // Read-only

    try {
      const result = await runCLI('init --yes', readOnlyDir);
      expect(result.success).toBe(false);
      expect(result.stderr).toMatch(/permission.*denied|access.*denied/i);
    } finally {
      // Clean up
      await fs.chmod(readOnlyDir, 0o755);
      await fs.rmdir(readOnlyDir);
    }
  });
});
```

### 2. Error Recovery Testing

Verify system recovers from errors:

```typescript
it('should recover from partial failures', async () => {
  // Create a scenario that will partially fail
  await createPartiallyCorruptedProject(env.path);

  // Attempt operation that should fail
  const failedResult = await runCLI('run feature', env.path);
  expect(failedResult.success).toBe(false);

  // Verify system can recover
  const cleanupResult = await runCLI('cleanup --force', env.path);
  expect(cleanupResult.success).toBe(true);

  // Verify normal operations work again
  const retryResult = await runCLI('init --yes', env.path);
  expect(retryResult.success).toBe(true);
});
```

---

## Test Data Management

### 1. Fixture Management

Organize test fixtures effectively:

```typescript
// tests/e2e/fixtures/common.ts
export const TEST_AGENTS = {
  simple: {
    name: 'test-agent',
    description: 'Simple test agent',
    tools: ['Read', 'Write'],
    model: 'sonnet'
  },
  complex: {
    name: 'complex-agent',
    description: 'Complex test agent with all features',
    tools: ['Read', 'Write', 'Bash', 'Edit'],
    model: 'opus',
    temperature: 0.1,
    systemPrompt: 'You are a test agent.'
  }
};

export const TEST_WORKFLOWS = {
  minimal: {
    name: 'test-workflow',
    stages: ['planning', 'implementation']
  },
  complete: {
    name: 'feature-workflow',
    stages: ['planning', 'architecture', 'implementation', 'testing', 'review']
  }
};

// In test files
import { TEST_AGENTS, TEST_WORKFLOWS } from './fixtures/common';

it('should work with complex agent setup', async () => {
  await seedTestData(env, {
    agents: [TEST_AGENTS.complex],
    workflows: [TEST_WORKFLOWS.complete]
  });

  // Test logic here...
});
```

### 2. Dynamic Test Data

Generate appropriate test data:

```typescript
function createTestFile(options: {
  size?: 'small' | 'medium' | 'large';
  type?: 'javascript' | 'typescript' | 'markdown';
  withSyntaxErrors?: boolean;
}) {
  const { size = 'small', type = 'typescript', withSyntaxErrors = false } = options;

  const sizeMap = {
    small: 50,
    medium: 500,
    large: 5000
  };

  const lineCount = sizeMap[size];
  const extension = type === 'javascript' ? '.js' :
                   type === 'typescript' ? '.ts' : '.md';

  let content = '';
  for (let i = 0; i < lineCount; i++) {
    if (type === 'markdown') {
      content += `## Section ${i + 1}\n\nThis is content for section ${i + 1}.\n\n`;
    } else {
      content += `// Line ${i + 1}\nexport const value${i + 1} = ${i + 1};\n`;
    }
  }

  if (withSyntaxErrors && type !== 'markdown') {
    content += 'export const syntaxError = ;\n'; // Missing value
  }

  return {
    path: `test-file${extension}`,
    content
  };
}

// Usage
it('should handle large files', async () => {
  const largeFile = createTestFile({ size: 'large', type: 'typescript' });
  await seedTestData(env, { files: [largeFile] });

  const result = await runCLI('analyze', env.path);
  expect(result.success).toBe(true);
});
```

---

## Debugging Strategies

### 1. Enhanced Debug Output

Enable comprehensive debugging:

```typescript
// Enable debug output
process.env.DEBUG = '1';

// Custom debug helper
function debugTest(testName: string, data: any) {
  if (process.env.DEBUG) {
    console.log(`[DEBUG ${testName}]`, JSON.stringify(data, null, 2));
  }
}

it('should provide debug information', async () => {
  debugTest('test-setup', { envPath: env.path, projectName: 'test' });

  const result = await runCLI('status', env.path);
  debugTest('cli-result', result);

  expect(result.success).toBe(true);
});
```

### 2. State Inspection

Add helpers to inspect system state:

```typescript
function captureSystemState(envPath: string) {
  return {
    git: {
      branch: getCurrentBranch(envPath),
      status: getGitStatus(envPath),
      commits: getRecentCommits(envPath, 5)
    },
    apex: {
      config: readApexConfigSync(envPath),
      tasks: listTasks(envPath)
    },
    files: {
      structure: getDirectoryStructure(envPath),
      permissions: getFilePermissions(envPath)
    }
  };
}

it('should maintain correct state throughout workflow', async () => {
  const initialState = captureSystemState(env.path);
  debugTest('initial-state', initialState);

  // Perform operations
  await runCLI('init --yes', env.path);
  const afterInitState = captureSystemState(env.path);
  debugTest('after-init-state', afterInitState);

  // Verify state changes
  expect(afterInitState.apex.config).toBeDefined();
  expect(afterInitState.git.branch).toBe('main');
});
```

### 3. Failure Analysis

Capture diagnostic information on test failures:

```typescript
async function runTestWithDiagnostics<T>(
  testFn: () => Promise<T>,
  testName: string,
  envPath: string
): Promise<T> {
  try {
    return await testFn();
  } catch (error) {
    // Capture diagnostic information on failure
    const diagnostics = {
      error: error.message,
      stack: error.stack,
      systemState: captureSystemState(envPath),
      processInfo: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        platform: process.platform
      }
    };

    console.error(`[FAILURE DIAGNOSTICS ${testName}]`,
                  JSON.stringify(diagnostics, null, 2));

    throw error;
  }
}

// Usage
it('should handle complex scenario with diagnostics', async () => {
  await runTestWithDiagnostics(
    async () => {
      // Test logic that might fail
      const result = await runCLI('complex-operation', env.path);
      expect(result.success).toBe(true);
    },
    'complex-scenario',
    env.path
  );
});
```

---

## Code Review Checklist

Use this checklist when reviewing E2E test PRs:

### ✅ Test Structure
- [ ] Test file follows naming convention (`*.e2e.test.ts`)
- [ ] Tests are properly categorized with describe blocks
- [ ] Each test has single responsibility
- [ ] Tests follow Arrange-Act-Assert pattern
- [ ] File has comprehensive JSDoc header

### ✅ Test Coverage
- [ ] Happy path scenarios covered
- [ ] Error cases tested comprehensively
- [ ] Edge cases identified and tested
- [ ] Cross-platform considerations addressed
- [ ] Performance implications considered

### ✅ Resource Management
- [ ] Proper setup and teardown implemented
- [ ] All resources registered for cleanup
- [ ] Tests are fully isolated
- [ ] No hardcoded paths or assumptions
- [ ] Cleanup works even when tests fail

### ✅ Assertions & Error Messages
- [ ] Assertions are specific and descriptive
- [ ] Error messages provide helpful context
- [ ] Both positive and negative cases tested
- [ ] Timeouts are appropriate for operations
- [ ] Retry logic used where appropriate

### ✅ Code Quality
- [ ] Follows existing patterns and conventions
- [ ] Uses appropriate test utilities
- [ ] No code duplication
- [ ] Tests are readable and maintainable
- [ ] Dependencies are minimal

### ✅ Documentation
- [ ] Test purpose is clear from description
- [ ] Complex logic is commented
- [ ] Requirements are documented
- [ ] Examples follow best practices
- [ ] Contributes to overall test coverage

---

## Summary

This best practices guide provides the foundation for writing robust, maintainable E2E tests in APEX. The key takeaways are:

1. **Design for reliability** - Use proper isolation, cleanup, and error handling
2. **Follow established patterns** - Leverage existing utilities and conventions
3. **Test comprehensively** - Cover happy path, errors, and edge cases
4. **Make tests maintainable** - Clear structure, good documentation, minimal dependencies
5. **Consider performance** - Appropriate timeouts, resource management, parallel execution
6. **Debug effectively** - Enable diagnostics, capture state, analyze failures

For additional resources, see:
- [Main E2E Testing Guide](./e2e.md)
- [Contributing to E2E Tests](./contributing-e2e-tests.md)
- [E2E Test Debugging Guide](./e2e-debugging.md)
- [Test Architecture Decision Records](./adr/)