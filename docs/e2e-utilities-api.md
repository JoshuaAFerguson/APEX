# E2E Test Utilities API Reference

> Complete API documentation for APEX E2E test utilities, helpers, and infrastructure components.

## Table of Contents

- [Core Utilities](#core-utilities)
- [Global Helpers](#global-helpers)
- [CLI Helpers](#cli-helpers)
- [Git Utilities](#git-utilities)
- [MCP Test Utils](#mcp-test-utils)
- [Seed Data Management](#seed-data-management)
- [Resource Management](#resource-management)
- [Type Definitions](#type-definitions)

---

## Core Utilities

### `createTestEnvironment(options)`

Creates an isolated test environment with configurable initialization options.

**Location**: `tests/e2e/utils/test-utilities.ts`

**Signature**:
```typescript
function createTestEnvironment(options?: TestEnvironmentOptions): Promise<TestEnvironment>
```

**Parameters**:
```typescript
interface TestEnvironmentOptions {
  initGit?: boolean;              // Initialize git repository (default: false)
  initApexProject?: boolean;      // Initialize APEX project (default: false)
  apexOptions?: {
    projectName?: string;         // Custom project name
    includeAgents?: boolean;      // Include default agents (default: false)
    includeWorkflows?: boolean;   // Include default workflows (default: false)
  };
  path?: string;                  // Custom path (default: auto-generated temp dir)
  pathPrefix?: string;            // Prefix for auto-generated paths
}
```

**Returns**:
```typescript
interface TestEnvironment {
  path: string;                   // Absolute path to test environment
  gitRepoPath?: string;           // Path to git repository (if initGit: true)
  cleanup(): Promise<void>;       // Cleanup function
}
```

**Examples**:
```typescript
// Minimal environment
const env = await createTestEnvironment();

// Git-enabled environment
const gitEnv = await createTestEnvironment({ initGit: true });

// Full APEX project
const apexEnv = await createTestEnvironment({
  initGit: true,
  initApexProject: true,
  apexOptions: {
    projectName: 'test-project',
    includeAgents: true,
    includeWorkflows: true
  }
});

// Always clean up
afterEach(async () => {
  await env.cleanup();
});
```

### `runCLI(command, workingDir, options)`

Executes CLI commands in the test environment with proper error handling.

**Location**: `tests/e2e/utils/test-utilities.ts`

**Signature**:
```typescript
function runCLI(command: string, workingDir: string, options?: CLIOptions): Promise<CLIResult>
```

**Parameters**:
```typescript
interface CLIOptions {
  timeout?: number;               // Command timeout in ms (default: 30000)
  env?: Record<string, string>;   // Environment variables
  input?: string;                 // Stdin input
  encoding?: BufferEncoding;      // Output encoding (default: 'utf8')
}
```

**Returns**:
```typescript
interface CLIResult {
  success: boolean;               // True if exit code is 0
  stdout: string;                 // Standard output
  stderr: string;                 // Standard error
  exitCode: number;               // Process exit code
  duration: number;               // Execution time in ms
}
```

**Examples**:
```typescript
// Basic command execution
const result = await runCLI('init --yes', env.path);
expect(result.success).toBe(true);
expect(result.stdout).toContain('Project initialized');

// Command with timeout
const longResult = await runCLI('long-command', env.path, { timeout: 60000 });

// Command with environment variables
const envResult = await runCLI('status', env.path, {
  env: { DEBUG: '1', APEX_TEST_MODE: 'e2e' }
});

// Error handling
const failResult = await runCLI('invalid-command', env.path);
expect(failResult.success).toBe(false);
expect(failResult.exitCode).not.toBe(0);
```

### `seedTestData(env, scenario)`

Seeds test environment with predefined or custom data.

**Location**: `tests/e2e/utils/test-utilities.ts`

**Signature**:
```typescript
function seedTestData(env: TestEnvironment, scenario: SeedScenario | SeedData): Promise<void>
```

**Parameters**:
```typescript
// Predefined scenarios
enum SEED_SCENARIOS {
  minimal = 'minimal',      // Basic project structure only
  full = 'full',           // Complete project with agents and workflows
  mcp = 'mcp',             // MCP-focused configuration
  git = 'git'              // Git workflow focused with source files
}

// Custom seed data
interface SeedData {
  agents?: AgentDefinition[];     // Agent definitions
  workflows?: WorkflowDefinition[]; // Workflow definitions
  files?: FileDefinition[];       // Source files
  config?: Partial<ApexConfig>;   // Custom configuration
}
```

**Examples**:
```typescript
// Use predefined scenarios
await seedTestData(env, SEED_SCENARIOS.minimal);
await seedTestData(env, SEED_SCENARIOS.full);
await seedTestData(env, SEED_SCENARIOS.mcp);
await seedTestData(env, SEED_SCENARIOS.git);

// Custom agent setup
await seedTestData(env, {
  agents: [
    {
      name: 'test-agent',
      description: 'Agent for testing',
      tools: ['Read', 'Write', 'Edit'],
      model: 'sonnet'
    }
  ]
});
```

---

## Global Helpers

Global helpers are available via `globalThis.apexE2EHelpers`.

**Location**: `tests/e2e/setup.ts`

### `createTempDir(prefix)`

Creates a temporary directory for test isolation.

**Signature**:
```typescript
function createTempDir(prefix?: string): Promise<string>
```

**Examples**:
```typescript
const tempDir = await globalThis.apexE2EHelpers.createTempDir();
const customDir = await globalThis.apexE2EHelpers.createTempDir('my-test-');
```

### `createTempGitRepo(prefix)`

Creates a temporary git repository with initial commit.

**Signature**:
```typescript
function createTempGitRepo(prefix?: string): Promise<string>
```

### `createBareGitRepo(prefix)`

Creates a bare git repository for simulating remotes.

**Signature**:
```typescript
function createBareGitRepo(prefix?: string): Promise<string>
```

### `waitFor(condition, options)`

Waits for an asynchronous condition with timeout and retry logic.

**Signature**:
```typescript
function waitFor<T>(
  condition: () => T | Promise<T>,
  options?: WaitOptions
): Promise<T>
```

**Parameters**:
```typescript
interface WaitOptions {
  timeout?: number;               // Maximum wait time in ms (default: 30000)
  interval?: number;              // Polling interval in ms (default: 1000)
  description?: string;           // Description for error messages
}
```

### Resource Registration

Functions for registering resources for automatic cleanup:

- `registerOrchestrator(orchestrator: ApexOrchestrator): void`
- `registerServer(server: FastifyInstance): void`
- `registerStore(store: TaskStore): void`
- `registerTempDir(path: string): void`

---

## CLI Helpers

**Location**: `tests/e2e/helpers/cli-test-helpers.ts`

### `runApexCLI(command, options)`

Executes APEX CLI commands with enhanced error handling.

**Signature**:
```typescript
function runApexCLI(command: string, options?: CLIExecutionOptions): Promise<CLIExecutionResult>
```

**Examples**:
```typescript
const result = await runApexCLI('--version');
expect(result.success).toBe(true);

const initResult = await runApexCLI('init --yes', { cwd: env.path });
expect(initResult.success).toBe(true);
```

### `assertCLISuccess(result)`

Assertion helper for CLI command success.

**Signature**:
```typescript
function assertCLISuccess(result: CLIExecutionResult): void
```

### `assertCLIFailure(result, expectedError?)`

Assertion helper for CLI command failure.

**Signature**:
```typescript
function assertCLIFailure(result: CLIExecutionResult, expectedError?: string | RegExp): void
```

---

## Git Utilities

**Location**: `tests/e2e/utils/git-utilities.ts`

### Git Status Functions

#### `getCurrentBranch(repoPath)`

**Signature**:
```typescript
function getCurrentBranch(repoPath: string): string
```

#### `getGitStatus(repoPath)`

**Signature**:
```typescript
function getGitStatus(repoPath: string): GitStatus
```

**Returns**:
```typescript
interface GitStatus {
  branch: string;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  ahead: number;
  behind: number;
  clean: boolean;
}
```

#### `getCommitHistory(repoPath, count?)`

**Signature**:
```typescript
function getCommitHistory(repoPath: string, count?: number): GitCommit[]
```

### Git Operations

#### `initializeGitRepo(path, options?)`

**Signature**:
```typescript
function initializeGitRepo(path: string, options?: GitInitOptions): Promise<void>
```

#### `createFeatureBranch(repoPath, branchName, baseRef?)`

**Signature**:
```typescript
function createFeatureBranch(repoPath: string, branchName: string, baseRef?: string): Promise<void>
```

#### `mergeBranch(repoPath, branchName, options?)`

**Signature**:
```typescript
function mergeBranch(repoPath: string, branchName: string, options?: MergeOptions): Promise<MergeResult>
```

---

## MCP Test Utils

**Location**: `tests/e2e/utils/mcp-test-utils.ts`

### `createTestProjectWithServers(servers)`

Creates a test project with pre-configured MCP servers.

**Signature**:
```typescript
function createTestProjectWithServers(servers: string[]): Promise<TestEnvironment>
```

### `execMCPCommand(command, workingDir, options?)`

Executes MCP-related CLI commands.

**Signature**:
```typescript
function execMCPCommand(command: string, workingDir: string, options?: MCPCommandOptions): Promise<CLIResult>
```

### `assertMarketplaceOutput(result, expectations)`

Assertion helper for MCP marketplace command output.

**Signature**:
```typescript
function assertMarketplaceOutput(result: CLIResult, expectations: MarketplaceExpectations): void
```

### `mockMarketplaceAPI(responses)`

Creates mock MCP marketplace API for testing.

**Signature**:
```typescript
function mockMarketplaceAPI(responses: MockAPIResponses): MockServer
```

---

## Seed Data Management

### Predefined Scenarios

- `SEED_SCENARIOS.minimal` - Basic project structure
- `SEED_SCENARIOS.full` - Complete project with agents and workflows
- `SEED_SCENARIOS.mcp` - MCP-focused configuration
- `SEED_SCENARIOS.git` - Git workflow focused setup

### Custom Seed Data

You can provide custom seed data with agents, workflows, files, and configuration:

```typescript
await seedTestData(env, {
  agents: [
    {
      name: 'custom-agent',
      description: 'Custom test agent',
      tools: ['Read', 'Write'],
      model: 'sonnet'
    }
  ],
  workflows: [
    {
      name: 'test-workflow',
      stages: ['planning', 'implementation']
    }
  ],
  files: [
    {
      path: 'src/test.ts',
      content: 'export const test = true;'
    }
  ]
});
```

---

## Resource Management

### Automatic Cleanup

The E2E test infrastructure automatically tracks and cleans up:

1. Temporary directories created by test utilities
2. Git repositories (both working and bare)
3. ApexOrchestrator instances with database connections
4. API servers (Fastify instances)
5. Database stores (SQLite connections)
6. Child processes spawned during tests

### Manual Resource Registration

```typescript
// Register resources for automatic cleanup
globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);
globalThis.apexE2EHelpers.registerServer(server);
globalThis.apexE2EHelpers.registerStore(store);
```

---

## Type Definitions

### Core Types

```typescript
interface TestEnvironment {
  path: string;
  gitRepoPath?: string;
  cleanup(): Promise<void>;
}

interface CLIResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

interface GitStatus {
  branch: string;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  ahead: number;
  behind: number;
  clean: boolean;
}

interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
}

interface E2ETestHelpers {
  createTempDir(prefix?: string): Promise<string>;
  createTempGitRepo(prefix?: string): Promise<string>;
  createBareGitRepo(prefix?: string): Promise<string>;
  createApexProject(path: string, options?: ApexProjectOptions): Promise<void>;
  registerOrchestrator(orchestrator: ApexOrchestrator): void;
  registerServer(server: FastifyInstance): void;
  registerStore(store: TaskStore): void;
  registerTempDir(path: string): void;
  cleanupAll(): Promise<void>;
  waitFor<T>(condition: () => T | Promise<T>, options?: WaitOptions): Promise<T>;
  createTestId(prefix?: string): string;
}
```

---

## Summary

The APEX E2E test utilities provide:

1. **Comprehensive test environment management** with automatic cleanup
2. **Rich CLI execution helpers** with proper error handling
3. **Git operations utilities** for repository testing
4. **MCP testing support** with marketplace simulation
5. **Flexible seed data management** for various test scenarios
6. **Global helpers** for common operations
7. **Resource tracking and cleanup** to prevent test interference

These utilities enable writing reliable, maintainable E2E tests that properly isolate test environments and clean up resources.

For additional information:
- [E2E Testing Guide](./e2e.md)
- [E2E Best Practices](./e2e-best-practices.md)
- [Contributing E2E Tests](./contributing-e2e-tests.md)
- [E2E Debugging Guide](./e2e-debugging.md)