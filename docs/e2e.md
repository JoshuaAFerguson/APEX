# End-to-End (E2E) Testing Guide

> **Comprehensive documentation for running, writing, and contributing E2E tests in APEX**
>
> This guide covers everything you need to know about APEX's E2E testing infrastructure, from basic setup to writing advanced tests and contributing to the test suite.

## Table of Contents

- [Overview](#overview)
- [Quick Setup for New Contributors](#quick-setup-for-new-contributors)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [Running E2E Tests](#running-e2e-tests)
- [Writing New E2E Tests](#writing-new-e2e-tests)
- [Test Infrastructure](#test-infrastructure)
- [Contribution Guidelines](#contribution-guidelines)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Examples & Templates](#examples--templates)
- [Related Documentation](#related-documentation)

---

## Quick Setup for New Contributors

**🚀 Want to start contributing E2E tests immediately?**

### 5-Minute Setup

```bash
# 1. Install dependencies
npm install

# 2. Build the project (required for E2E tests)
npm run build

# 3. Verify setup
npm run validate:e2e-discovery

# 4. Run E2E tests to ensure everything works
npm run test:unified:e2e

# 5. Create your first test (see Writing New E2E Tests section)
cp tests/e2e/browse-marketplace.e2e.test.ts tests/e2e/my-feature.e2e.test.ts
```

### Prerequisites Checklist

- [ ] **Node.js 18+**: `node --version`
- [ ] **Git**: `git --version`
- [ ] **Dependencies installed**: `npm install`
- [ ] **Project built**: `npm run build`
- [ ] **CLI available**: `ls packages/cli/dist/index.js`

✅ **Ready to go!** Jump to [Writing New E2E Tests](#writing-new-e2e-tests) or see [Examples & Templates](#examples--templates).

---

## Overview

APEX uses a multi-layered testing strategy with E2E tests at the top of the testing pyramid. E2E tests validate complete user workflows by executing real CLI commands, creating actual git repositories, and interacting with real system resources.

### E2E Test Characteristics

| Aspect | Description |
|--------|-------------|
| **Scope** | Full system workflows from user input to final output |
| **Environment** | Real filesystems, git repos, databases, and CLI execution |
| **Speed** | Slower than unit/integration tests (seconds to minutes) |
| **Isolation** | Each test runs in its own temporary directory |
| **Reliability** | Includes retry logic for flaky real-world operations |

### Testing Pyramid in APEX

```
                    /\
                   /  \
                  / E2E \        <- You are here
                 /______\
                /        \
               /Integration\
              /______________\
             /                \
            /     Unit Tests   \
           /____________________\
```

---

## Architecture

### Test Framework Stack

```
+----------------------------------+
|           Vitest                 |  Test Runner
+----------------------------------+
|     vitest.e2e.config.ts         |  E2E Configuration
+----------------------------------+
|   tests/e2e/setup.ts             |  Global Setup/Teardown
|   tests/e2e/teardown.ts          |
+----------------------------------+
|   Test Utilities                 |  Helper Functions
|   - test-utilities.ts            |
|   - mcp-test-utils.ts            |
|   - cli-test-helpers.ts          |
+----------------------------------+
|   Real System Resources          |  Execution Environment
|   - Git repositories             |
|   - SQLite databases             |
|   - CLI binary                   |
|   - Temporary filesystems        |
+----------------------------------+
```

### Directory Structure

```
tests/e2e/
├── README.md                      # E2E-specific documentation
├── setup.ts                       # Global setup hooks
├── teardown.ts                    # Global teardown hooks
├── index.ts                       # Main export module
│
├── utils/
│   ├── test-utilities.ts          # Core test utilities
│   ├── mcp-test-utils.ts          # MCP-specific helpers
│   └── README.md                  # Utilities documentation
│
├── helpers/
│   ├── cli-test-helpers.ts        # CLI execution helpers
│   ├── api-e2e-test-server.ts     # API server helpers
│   └── mcp-e2e-helpers.ts         # MCP E2E helpers
│
├── fixtures/
│   └── marketplace-data.ts        # Test fixture data
│
├── mocks/
│   └── mock-marketplace-server.ts # Mock servers
│
├── docs/
│   └── ADR-*.md                   # Architecture Decision Records
│
└── *.e2e.test.ts                  # E2E test files
    ├── cli.e2e.test.ts
    ├── browse-marketplace.e2e.test.ts
    ├── merge-command.test.ts
    ├── git-workflow-lifecycle.e2e.test.ts
    └── ...
```

### Key Components

#### 1. Global Setup (`setup.ts`)

Provides global test hooks and helper utilities:

```typescript
// Available via globalThis.apexE2EHelpers
interface E2ETestHelpers {
  createTempDir(prefix?: string): Promise<string>;
  createTempGitRepo(prefix?: string): Promise<string>;
  createBareGitRepo(prefix?: string): Promise<string>;
  createApexProject(path: string, options?: ApexProjectOptions): Promise<void>;
  registerOrchestrator(orchestrator): void;
  registerServer(server): void;
  registerStore(store): void;
  cleanupAll(): Promise<void>;
  waitFor<T>(condition: () => T, options?: WaitOptions): Promise<T>;
  createTestId(prefix?: string): string;
}
```

#### 2. Test Utilities (`utils/test-utilities.ts`)

Core utilities for test environment management:

```typescript
// Environment creation
const env = await createTestEnvironment({
  initGit: true,
  initApexProject: true,
  apexOptions: { projectName: 'test' }
});

// CLI execution
const result = await runCLI('init --yes', env.path);

// Seed data
await seedTestData(env, SEED_SCENARIOS.full);

// Cleanup
await env.cleanup();
```

#### 3. CLI Helpers (`helpers/cli-test-helpers.ts`)

Specialized CLI execution utilities:

```typescript
import { runApexCLI, assertCLISuccess } from './cli-test-helpers';

const result = await runApexCLI('agent list', { cwd: projectPath });
assertCLISuccess(result);
```

---

## Quick Start

### Prerequisites

1. **Node.js 18+**
   ```bash
   node --version  # Should be >= 18.0.0
   ```

2. **Git**
   ```bash
   git --version  # Required for repository operations
   ```

3. **Built CLI**
   ```bash
   npm run build  # Builds all packages including CLI
   ```

### Run E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Watch mode for development
npm run test:e2e:watch

# Run specific test file
npm test -- tests/e2e/cli.e2e.test.ts

# Run with debug output
DEBUG=1 npm run test:e2e
```

---

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Project

E2E tests execute the actual CLI binary, so you must build first:

```bash
npm run build
```

Verify the build:
```bash
ls packages/cli/dist/index.js  # Should exist
```

### 3. Verify Prerequisites

```bash
# Check Node.js version
node --version

# Check git availability
git --version

# Verify CLI is built
node packages/cli/dist/index.js --version
```

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NODE_ENV` | Test environment indicator | `test` |
| `APEX_TEST_MODE` | E2E mode flag | `e2e` |
| `DEBUG` | Enable verbose output | `undefined` |
| `CI` | CI environment detection | `undefined` |
| `NO_COLOR` | Disable ANSI colors | `undefined` |

---

## Running E2E Tests

### Available Commands

```bash
# All E2E tests
npm run test:e2e

# Watch mode (re-runs on file changes)
npm run test:e2e:watch

# Specific test file
npm test -- tests/e2e/browse-marketplace.e2e.test.ts

# Tests matching pattern
npm test -- tests/e2e --grep "CLI Commands"

# With coverage
npm run test:e2e -- --coverage

# Verbose output for debugging
DEBUG=1 npm run test:e2e
```

### Unified Test Runner (Recommended)

APEX provides a unified test runner for more advanced E2E test execution:

```bash
# Run all E2E tests via unified runner
npm run test:unified:e2e

# Run E2E tests with pattern matching
npm run test:unified:e2e -- --pattern=marketplace

# Run E2E tests for specific package
npm run test:unified -- --type=e2e --package=cli

# List all available E2E tests
npm run test:unified:list:e2e

# Validate E2E test discovery
npm run test:unified -- --type=e2e --validate

# Watch mode with unified runner
npm run test:unified -- --type=e2e --watch

# Coverage with unified runner
npm run test:unified -- --type=e2e --coverage
```

#### Unified Runner Benefits

- **Consistent test discovery** across all test types
- **Better filtering options** with package and pattern support
- **Comprehensive validation** of test configuration
- **Unified reporting** across different test categories
- **Advanced watch mode** with better performance

### Playwright Tests (Browser E2E)

For browser-based E2E tests:

```bash
# Install browsers
npm run playwright:install

# Run Playwright tests
npm run playwright:test

# Interactive UI mode
npm run playwright:test:ui

# Debug mode
npm run playwright:test:debug
```

### Test Output

E2E tests use verbose reporters by default:

```
✓ tests/e2e/cli.e2e.test.ts (8 tests) 12534ms
  ✓ E2E: CLI Commands > apex --version > should display version 156ms
  ✓ E2E: CLI Commands > apex --help > should display help 189ms
  ✓ E2E: CLI Commands > apex init > should initialize project 2341ms
  ...
```

---

## Writing New E2E Tests

### Step 1: Create Test File

Create a new file in `tests/e2e/` with the `.e2e.test.ts` suffix:

```typescript
// tests/e2e/my-feature.e2e.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  runCLI,
  seedTestData,
  SEED_SCENARIOS,
  type TestEnvironment
} from './index';

describe('E2E: My Feature', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should perform expected action', async () => {
    // Arrange: Seed test data if needed
    await seedTestData(env, SEED_SCENARIOS.full);

    // Act: Execute CLI command
    const result = await runCLI('my-command --flag', env.path);

    // Assert: Verify outcomes
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('expected output');
  });
});
```

### Step 2: Choose Test Utilities

#### For CLI Testing

```typescript
import { runApexCLI, assertCLISuccess } from './helpers/cli-test-helpers';

const result = await runApexCLI('init --yes', { cwd: testDir });
assertCLISuccess(result);
expect(result.stdout).toContain('APEX');
```

#### For Git Operations

```typescript
import { createTempGitRepo, createBareGitRepo } from './setup';

const workingRepo = await createTempGitRepo('my-test-');
const remoteRepo = await createBareGitRepo('my-remote-');

// Configure remote
execSync(`git remote add origin ${remoteRepo}`, { cwd: workingRepo });
```

#### For MCP Features

```typescript
import {
  execMCPCommand,
  assertMarketplaceOutput,
  createTestProjectWithServers
} from './utils/mcp-test-utils';

const env = await createTestProjectWithServers(['github', 'slack']);
const result = await execMCPCommand('list', env.path);
assertMarketplaceOutput(result, { serverCount: 2 });
```

### Step 3: Use Appropriate Timeouts

E2E tests need extended timeouts for real-world operations:

```typescript
// Test-level timeout (default: 60s)
it('should complete long operation', { timeout: 120000 }, async () => {
  // Test code...
});

// Hook-level timeout (default: 30s)
beforeEach(async () => {
  // Setup code...
}, 45000);
```

### Step 4: Handle Cleanup

Always ensure proper cleanup:

```typescript
describe('E2E: Feature', () => {
  let env: TestEnvironment;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    env = await createTestEnvironment({ initGit: true });
    orchestrator = new ApexOrchestrator({ projectRoot: env.path });

    // Register for automatic cleanup
    globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);
  });

  afterEach(async () => {
    // Explicit cleanup (or rely on global teardown)
    await orchestrator?.shutdown();
    await env?.cleanup();
  });

  // Tests...
});
```

### Step 5: Use Test Fixtures

For complex test data, use fixtures:

```typescript
// tests/e2e/fixtures/my-fixture.ts
export const testAgentDefinition = {
  name: 'test-agent',
  description: 'Test agent for E2E',
  tools: ['Read', 'Write'],
  model: 'sonnet'
};

// In test file
import { testAgentDefinition } from './fixtures/my-fixture';

await seedTestData(env, {
  agents: [testAgentDefinition]
});
```

### Example: Complete E2E Test

This example demonstrates all the key patterns for writing comprehensive E2E tests:

```typescript
/**
 * @fileoverview E2E tests for the branch checkout workflow
 *
 * Tests covered:
 * - Successful branch checkout operations
 * - Error handling for non-existent branches
 * - Validation of uncommitted changes
 * - Git state verification and file system checks
 *
 * Requirements:
 * - Git must be available in PATH
 * - Test creates temporary git repositories
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createTestEnvironment,
  runCLI,
  seedTestData,
  SEED_SCENARIOS,
  type TestEnvironment
} from './index';

describe('E2E: Branch Checkout Workflow', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true,
      apexOptions: {
        projectName: 'checkout-test',
        includeAgents: true,
        includeWorkflows: true
      }
    });

    // Seed with git-focused test data
    await seedTestData(env, SEED_SCENARIOS.git);

    // Create a feature branch with changes
    execSync('git checkout -b feature/test', { cwd: env.path, stdio: 'pipe' });
    await fs.writeFile(
      path.join(env.path, 'feature.ts'),
      'export const testFeature = "implemented";'
    );
    execSync('git add . && git commit -m "Add feature implementation"', {
      cwd: env.path,
      stdio: 'pipe'
    });
    execSync('git checkout main', { cwd: env.path, stdio: 'pipe' });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Successful Operations', () => {
    it('should checkout existing branch', async () => {
      const result = await runCLI('checkout feature/test', env.path);

      expect(result.success, `Checkout failed: ${result.stderr}`).toBe(true);
      expect(result.stdout).toContain('Switched to branch');

      // Verify branch switched
      const branch = execSync('git branch --show-current', {
        cwd: env.path,
        encoding: 'utf8'
      }).trim();
      expect(branch).toBe('feature/test');

      // Verify file exists and has correct content
      const featureFile = path.join(env.path, 'feature.ts');
      const content = await fs.readFile(featureFile, 'utf8');
      expect(content).toContain('testFeature');
    });

    it('should checkout with clean working directory', async () => {
      // Verify working directory is clean before checkout
      const status = execSync('git status --porcelain', {
        cwd: env.path,
        encoding: 'utf8'
      });
      expect(status.trim()).toBe('');

      const result = await runCLI('checkout feature/test', env.path);
      expect(result.success).toBe(true);

      // Working directory should still be clean after checkout
      const statusAfter = execSync('git status --porcelain', {
        cwd: env.path,
        encoding: 'utf8'
      });
      expect(statusAfter.trim()).toBe('');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent branch gracefully', async () => {
      const result = await runCLI('checkout nonexistent-branch', env.path);

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toLowerCase()).toMatch(/not found|does not exist/);

      // Verify we're still on the original branch
      const branch = execSync('git branch --show-current', {
        cwd: env.path,
        encoding: 'utf8'
      }).trim();
      expect(branch).toBe('main');
    });

    it('should prevent checkout with uncommitted changes', async () => {
      // Create uncommitted changes
      const dirtyFile = path.join(env.path, 'dirty.ts');
      await fs.writeFile(dirtyFile, 'uncommitted changes');

      const result = await runCLI('checkout feature/test', env.path);

      expect(result.success).toBe(false);
      expect(result.stderr.toLowerCase()).toMatch(
        /uncommitted|changes|dirty|would be overwritten/
      );

      // Verify we're still on main branch
      const branch = execSync('git branch --show-current', {
        cwd: env.path,
        encoding: 'utf8'
      }).trim();
      expect(branch).toBe('main');

      // Verify uncommitted file still exists
      const exists = await fs.stat(dirtyFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle invalid branch names', async () => {
      const invalidNames = ['', ' ', '..', '~invalid', 'feature/..', '@{invalid}'];

      for (const invalidName of invalidNames) {
        const result = await runCLI(`checkout ${invalidName}`, env.path);
        expect(result.success, `Should fail for invalid branch name: "${invalidName}"`).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle checkout in empty repository', async () => {
      // Create a new empty environment
      const emptyEnv = await createTestEnvironment({
        initGit: true,
        initApexProject: false
      });

      try {
        const result = await runCLI('checkout main', emptyEnv.path);
        // Should fail gracefully for empty repo
        expect(result.success).toBe(false);
        expect(result.stderr).toContain('no branch');
      } finally {
        await emptyEnv.cleanup();
      }
    });

    it('should handle checkout with special characters in branch names', async () => {
      const specialBranch = 'feature/issue-#123_fix-bug';

      // Create branch with special characters
      execSync(`git checkout -b "${specialBranch}"`, {
        cwd: env.path,
        stdio: 'pipe'
      });
      execSync('git checkout main', { cwd: env.path, stdio: 'pipe' });

      const result = await runCLI(`checkout "${specialBranch}"`, env.path);
      expect(result.success).toBe(true);

      const currentBranch = execSync('git branch --show-current', {
        cwd: env.path,
        encoding: 'utf8'
      }).trim();
      expect(currentBranch).toBe(specialBranch);
    });
  });

  describe('Performance', () => {
    it('should complete checkout within reasonable time', { timeout: 30000 }, async () => {
      const startTime = Date.now();

      const result = await runCLI('checkout feature/test', env.path);

      const duration = Date.now() - startTime;
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
```

### Key Patterns Demonstrated

The above example showcases all the important E2E test patterns:

1. **Comprehensive file documentation** with test coverage and requirements
2. **Proper test categorization** with describe blocks for different scenarios
3. **Thorough setup and cleanup** with proper resource management
4. **Descriptive assertions** with helpful failure messages
5. **Both positive and negative test cases** covering happy path and error scenarios
6. **Edge case testing** for unusual but possible conditions
7. **Performance considerations** with appropriate timeouts
8. **Cross-platform compatibility** using proper path handling and command execution

---

## Test Infrastructure

### Configuration (`vitest.e2e.config.ts`)

The E2E configuration extends the shared config with:

- **Extended Timeouts**: 60s for tests, 30s for hooks
- **Forked Process Pool**: Test isolation via separate processes
- **Retry Policy**: 2 retries in CI for flaky operations
- **Sequential Execution**: Prevents resource conflicts
- **Verbose Reporting**: Detailed output for debugging

### Global Helpers

Available via `globalThis.apexE2EHelpers`:

| Helper | Description |
|--------|-------------|
| `createTempDir(prefix)` | Create isolated temp directory |
| `createTempGitRepo(prefix)` | Create initialized git repo |
| `createBareGitRepo(prefix)` | Create bare git repo (for remotes) |
| `createApexProject(path, opts)` | Create full APEX project structure |
| `registerOrchestrator(o)` | Register for automatic cleanup |
| `registerServer(s)` | Register server for cleanup |
| `registerStore(s)` | Register database store for cleanup |
| `cleanupAll()` | Force cleanup of all resources |
| `waitFor(condition, opts)` | Wait for async condition |
| `createTestId(prefix)` | Generate unique test ID |

### Seed Scenarios

Pre-defined test data configurations:

```typescript
import { SEED_SCENARIOS } from './index';

// Minimal: Just project structure
await seedTestData(env, SEED_SCENARIOS.minimal);

// Full: Complete project with agents, workflows, files
await seedTestData(env, SEED_SCENARIOS.full);

// MCP: MCP-focused with server configurations
await seedTestData(env, SEED_SCENARIOS.mcp);

// Git: Git-focused with source files
await seedTestData(env, SEED_SCENARIOS.git);
```

---

## Contribution Guidelines

### Adding New E2E Tests

#### 1. Choose Test Category

Determine which category your test belongs to:

| **Category** | **File Pattern** | **Purpose** | **Typical Timeout** | **Examples** |
|-------------|-----------------|-------------|-------------------|-------------|
| **CLI Commands** | `cli-*.e2e.test.ts` | Direct CLI interactions | 30s | `apex --version`, `apex init` |
| **Git Operations** | `git-*.e2e.test.ts` | Repository operations | 60s | Branch creation, merging |
| **Workflows** | `workflow-*.e2e.test.ts` | End-to-end workflows | 120s | Feature workflow, bug fixes |
| **MCP Features** | `mcp-*.e2e.test.ts` | Marketplace operations | 45s | Server browsing, installation |
| **API Integration** | `api-*.e2e.test.ts` | Server/API testing | 60s | REST API, WebSocket |
| **Infrastructure** | `infra-*.e2e.test.ts` | System testing | 90s | Setup verification |

#### 2. Follow File Structure Standard

```typescript
/**
 * @fileoverview E2E tests for [feature description]
 *
 * Tests covered:
 * - [List main test scenarios]
 * - [Include happy path and error cases]
 * - [Include edge cases]
 *
 * Requirements:
 * - [List any special prerequisites]
 * - [Note timing considerations]
 * - [Platform-specific behavior if any]
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  runCLI,
  seedTestData,
  SEED_SCENARIOS,
  type TestEnvironment
} from './index';

describe('E2E: [Feature Name]', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Happy Path', () => {
    it('should handle normal operation', async () => {
      // ARRANGE: Set up test conditions
      await seedTestData(env, SEED_SCENARIOS.full);

      // ACT: Perform the operation
      const result = await runCLI('your-command', env.path);

      // ASSERT: Verify outcomes
      expect(result.success, `Command failed: ${result.stderr}`).toBe(true);
      expect(result.stdout).toContain('expected output');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      const result = await runCLI('your-command invalid-input', env.path);
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('expected error message');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data', async () => {
      // Test with no seed data
      const result = await runCLI('your-command', env.path);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('no data message');
    });
  });
});
```

#### 3. Quality Checklist

Before submitting your E2E test:

##### ✅ Functionality
- [ ] Tests pass locally: `npm test -- your-test-file.e2e.test.ts`
- [ ] Tests are properly isolated (run individually)
- [ ] All edge cases and error scenarios covered
- [ ] Performance is acceptable for operation type

##### ✅ Code Quality
- [ ] Follows established patterns in existing tests
- [ ] Uses appropriate test utilities and helpers
- [ ] Has proper documentation and comments
- [ ] No code duplication or overly complex logic

##### ✅ Integration
- [ ] Works with CI/CD pipeline
- [ ] Compatible with all supported platforms
- [ ] Doesn't conflict with existing tests
- [ ] Proper git workflow and conventional commits

#### 4. Test Coverage Requirements

Every new E2E test must include:

- **Happy Path Scenarios** (minimum 2 test cases)
- **Error Handling** (minimum 3 error scenarios)
- **Edge Cases** (minimum 1 edge case)
- **Input Validation** (test invalid inputs)
- **Resource Cleanup** (proper setup/teardown)

#### 5. Naming Conventions

- **File names**: `feature-name.e2e.test.ts`
- **Test descriptions**: Start with action verb ("should...")
- **Environment variables**: Use `UPPERCASE_WITH_UNDERSCORES`
- **Temporary directories**: Use descriptive prefixes

#### 6. Performance Standards

Set timeouts based on operation complexity:

```typescript
// Quick operations (CLI help, version)
it('should show help', { timeout: 10000 }, async () => { /* ... */ });

// Standard operations (init, status, basic commands)
it('should initialize project', { timeout: 30000 }, async () => { /* ... */ });

// Complex operations (workflows, large files)
it('should handle complex workflow', { timeout: 60000 }, async () => { /* ... */ });

// Very long operations (comprehensive workflows)
it('should complete full workflow', { timeout: 120000 }, async () => { /* ... */ });
```

### Submitting Your Contribution

#### Pre-submission Checklist

Before opening a pull request:

1. **Run tests locally**:
   ```bash
   npm test -- your-test-file.e2e.test.ts
   ```

2. **Check for conflicts**:
   ```bash
   npm run test:e2e
   ```

3. **Validate setup**:
   ```bash
   npm run validate:e2e-discovery
   ```

4. **Follow commit conventions**:
   ```bash
   git commit -m "test: add E2E tests for feature X"
   ```

#### Pull Request Guidelines

**Title**: `test: add E2E tests for [feature name]`

**Description Template**:
```markdown
## Description
Brief description of what E2E tests were added.

## Test Coverage
- [ ] Happy path scenarios
- [ ] Error handling
- [ ] Edge cases
- [ ] Input validation

## Test Categories
- [ ] CLI Commands
- [ ] Git Operations
- [ ] Workflows
- [ ] MCP Features
- [ ] API Integration
- [ ] Infrastructure

## Checklist
- [ ] Tests pass locally
- [ ] Follows existing patterns
- [ ] Proper documentation
- [ ] No conflicts with existing tests
```

---

## CI/CD Integration

### GitHub Actions Configuration

E2E tests run in the CI pipeline via `.github/workflows/ci.yml`:

```yaml
e2e:
  name: E2E Tests
  needs: build
  runs-on: ubuntu-latest

  env:
    CI: true
    APEX_TEST_MODE: e2e
    NO_COLOR: 1
    GIT_AUTHOR_NAME: GitHub Actions
    GIT_AUTHOR_EMAIL: actions@github.com
    GIT_COMMITTER_NAME: GitHub Actions
    GIT_COMMITTER_EMAIL: actions@github.com

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'

    - run: npm ci
    - run: npm run build
    - run: npm run test:e2e
      timeout-minutes: 15

    - name: Cleanup
      if: always()
      run: |
        pkill -f "apex" || true
        rm -rf /tmp/apex-e2e-* || true
```

### CI-Specific Behavior

| Behavior | CI | Local |
|----------|-----|-------|
| Retries | 2 | 0 |
| Bail on first failure | Yes | No |
| Color output | Disabled | Enabled |
| Cleanup | Always runs | Always runs |
| Git identity | Actions bot | Local user |

### Running in CI Locally

Simulate CI environment:

```bash
CI=true npm run test:e2e
```

### Cross-Platform Testing

Test on different platforms to ensure compatibility:

```bash
# Test with different Node.js versions
nvm use 18 && npm run test:e2e
nvm use 20 && npm run test:e2e

# Test with different environments
NODE_ENV=production npm run test:e2e
NODE_ENV=development npm run test:e2e

# Test with resource constraints (useful for CI simulation)
NODE_OPTIONS="--max-old-space-size=2048" npm run test:e2e
```

### Environment-Specific Configuration

E2E tests automatically adapt to different environments:

| Environment | Retries | Timeout | Concurrency | Cleanup |
|-------------|---------|---------|-------------|---------|
| **Local Dev** | 0 | 60s | 4 forks | Always |
| **CI** | 2 | 60s | 2 forks | Always + force kill |
| **Debug** | 0 | 120s | 1 fork | Verbose |

### Docker Testing

For containerized testing environments:

```bash
# Build and test in Docker
docker build -t apex-e2e .
docker run --rm -v $(pwd):/workspace apex-e2e npm run test:e2e

# Use Docker Compose for complex scenarios
docker-compose -f docker-compose.test.yml up --build
```

---

## Contribution Guidelines

### Adding New E2E Test Scenarios

When contributing new E2E tests, follow this comprehensive checklist:

#### 1. Test Categorization

Identify which category your test belongs to:

| Category | Purpose | File Pattern | Timeout |
|----------|---------|--------------|---------|
| **CLI Commands** | Direct CLI interaction | `cli-*.e2e.test.ts` | 30s |
| **Workflow Integration** | Full agent workflows | `workflow-*.e2e.test.ts` | 120s |
| **Git Operations** | Repository management | `git-*.e2e.test.ts` | 60s |
| **MCP Features** | Marketplace functionality | `mcp-*.e2e.test.ts` | 45s |
| **API Integration** | Server/client interaction | `api-*.e2e.test.ts` | 60s |

#### 2. Test File Structure

Follow this standardized structure:

```typescript
/**
 * @fileoverview E2E tests for [feature description]
 *
 * Tests covered:
 * - [List key test scenarios]
 * - [Include both happy path and error cases]
 *
 * Requirements:
 * - [List any special setup requirements]
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  runCLI,
  seedTestData,
  SEED_SCENARIOS,
  type TestEnvironment
} from './index';

describe('E2E: [Feature Name]', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true,
      apexOptions: { projectName: 'test-project' }
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Happy Path Scenarios', () => {
    it('should handle normal operation', async () => {
      // Test implementation
    });

    it('should handle variation with options', async () => {
      // Test implementation
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle missing input', async () => {
      // Test implementation
    });

    it('should validate invalid parameters', async () => {
      // Test implementation
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data sets', async () => {
      // Test implementation
    });

    it('should handle large data sets', async () => {
      // Test implementation
    }, 120000); // Extended timeout for large data
  });
});
```

#### 3. Test Data Management

Use appropriate seed scenarios based on your test needs:

```typescript
// For basic functionality testing
await seedTestData(env, SEED_SCENARIOS.minimal);

// For comprehensive feature testing
await seedTestData(env, SEED_SCENARIOS.full);

// For MCP-specific testing
await seedTestData(env, SEED_SCENARIOS.mcp);

// For git workflow testing
await seedTestData(env, SEED_SCENARIOS.git);

// Custom seed data
await seedTestData(env, {
  agents: [{ name: 'test-agent', description: 'Test agent' }],
  workflows: [{ name: 'test-workflow', stages: [...] }],
  files: [{ path: 'test.ts', content: 'export const x = 1;' }]
});
```

#### 4. Assertion Patterns

Use descriptive assertions that clearly indicate what went wrong:

```typescript
// Good: Descriptive assertions
expect(result.success).toBe(true);
expect(result.stdout).toContain('Project initialized successfully');
expect(result.stderr).toBe('');

// Better: Include context in failure messages
expect(result.success, `CLI command failed: ${result.stderr}`).toBe(true);
expect(result.stdout, 'Missing success message').toContain('Project initialized');

// Best: Test both positive and negative cases
if (result.success) {
  expect(result.stdout).toContain('expected success output');
  expect(result.stderr).toBe('');
} else {
  expect(result.stderr).toContain('expected error message');
  expect(result.exitCode).not.toBe(0);
}
```

#### 5. Test Isolation Best Practices

Ensure your tests are fully isolated:

```typescript
describe('E2E: My Feature', () => {
  let env: TestEnvironment;
  let orchestrator: ApexOrchestrator | null = null;

  beforeEach(async () => {
    // Create fresh environment for each test
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });
  });

  afterEach(async () => {
    // Always clean up, even if test fails
    try {
      if (orchestrator) {
        await orchestrator.shutdown();
        orchestrator = null;
      }
      await env.cleanup();
    } catch (error) {
      console.warn('Cleanup error:', error);
      // Don't throw - let test result stand
    }
  });

  it('should create orchestrator safely', async () => {
    // Register orchestrator for cleanup
    orchestrator = new ApexOrchestrator({ projectRoot: env.path });
    globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);

    // Test logic here...
  });
});
```

#### 6. Documentation Requirements

Every new E2E test file should include:

1. **File-level JSDoc** explaining the test purpose
2. **Test coverage summary** in the file header
3. **Setup requirements** if any special prerequisites exist
4. **Performance notes** for tests that might be slow
5. **Cross-platform considerations** if the test has platform-specific behavior

#### 7. Review Checklist

Before submitting E2E tests, ensure:

- [ ] Tests are properly categorized and named
- [ ] All test scenarios include both success and failure cases
- [ ] Proper cleanup is implemented and verified
- [ ] Tests run successfully in isolation
- [ ] Tests are documented with clear descriptions
- [ ] Appropriate timeouts are set for long-running operations
- [ ] Test data is seeded appropriately for the scenario
- [ ] Assertions are descriptive and provide helpful error messages
- [ ] Tests follow the established patterns in existing E2E tests

#### 8. Common Pitfalls to Avoid

❌ **Don't do:**
- Share state between tests
- Use hardcoded paths or assume specific directory structures
- Skip error case testing
- Use `setTimeout()` instead of proper waiting utilities
- Leave resources uncleaned in failure scenarios

✅ **Do:**
- Use the provided test utilities for environment management
- Test both success and failure scenarios
- Use `waitFor()` for async conditions
- Register all resources for automatic cleanup
- Follow existing naming and organization patterns

---

## Best Practices

### Test Design

1. **Single Responsibility**: Each test should verify one workflow
2. **Isolation**: Tests should not depend on each other
3. **Cleanup**: Always clean up resources, even on failure
4. **Assertions**: Use specific, descriptive assertions
5. **Timeouts**: Set appropriate timeouts for operations

### Performance

1. **Parallel-Safe**: Write tests that can run concurrently
2. **Resource Limits**: Don't create excessive temp files/dirs
3. **Early Exit**: Fail fast on precondition failures
4. **Minimal Setup**: Only set up what the test needs

### Reliability

1. **Retries**: Use built-in retry for flaky operations
2. **Polling**: Use `waitFor()` instead of `setTimeout()`
3. **Error Messages**: Include helpful context in assertions
4. **Cross-Platform**: Test on multiple OS when possible

### Code Organization

```typescript
// Good: Organized test structure
describe('E2E: Feature Name', () => {
  describe('Happy Path', () => {
    it('should handle normal case', async () => { /* ... */ });
    it('should handle variation', async () => { /* ... */ });
  });

  describe('Error Handling', () => {
    it('should handle missing input', async () => { /* ... */ });
    it('should handle invalid state', async () => { /* ... */ });
  });

  describe('Edge Cases', () => {
    it('should handle empty data', async () => { /* ... */ });
    it('should handle large data', async () => { /* ... */ });
  });
});
```

---

## Troubleshooting

### Common Issues

#### "CLI binary not found"

```bash
# Solution: Build the project
npm run build

# Verify
ls packages/cli/dist/index.js
```

#### "Git not found in PATH"

```bash
# Solution: Install git
# macOS
brew install git

# Ubuntu/Debian
sudo apt-get install git

# Verify
git --version
```

#### Tests Hanging or Timing Out

1. Check for orphaned processes:
   ```bash
   ps aux | grep apex
   pkill -f apex
   ```

2. Check port conflicts:
   ```bash
   lsof -i :3000  # API default port
   ```

3. Run single test to isolate:
   ```bash
   npm test -- tests/e2e/specific.test.ts
   ```

#### Permission Errors During Cleanup

```bash
# Run cleanup scripts
npm run cleanup:test

# Manual cleanup
rm -rf /tmp/apex-e2e-*
rm -rf .apex-test
```

#### Database Lock Errors

```bash
# Close any SQLite connections
# Then delete the database
rm -f .apex/apex.db
```

### Debug Mode

Enable detailed logging:

```bash
DEBUG=1 npm run test:e2e
```

This preserves console output and shows:
- Detailed test execution
- CLI command output
- File operations
- Resource cleanup

### Getting Help

1. Check existing tests for patterns
2. Review ADRs in `tests/e2e/docs/`
3. Check test coverage analysis in `tests/e2e/test-coverage-analysis.md`
4. Open an issue with reproduction steps

---

## Examples & Templates

### Template: Basic CLI Command Test

```typescript
/**
 * @fileoverview E2E tests for the [command name] command
 *
 * Tests covered:
 * - Basic command execution with various flags
 * - Help and version output validation
 * - Error handling for invalid inputs
 * - JSON output format validation
 *
 * Requirements:
 * - APEX project initialization (optional/required)
 * - Git repository (if testing git-related features)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  runCLI,
  seedTestData,
  SEED_SCENARIOS,
  type TestEnvironment
} from './index';
import { runApexCLI, assertCLISuccess } from './helpers/cli-test-helpers';

describe('E2E: [Command Name] Command', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true,
      apexOptions: {
        projectName: `test-${Date.now()}`,
        includeAgents: true,
        includeWorkflows: true
      }
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Basic Functionality', () => {
    it('should execute command successfully', async () => {
      await seedTestData(env, SEED_SCENARIOS.full);

      const result = await runApexCLI('your-command', { cwd: env.path });

      assertCLISuccess(result);
      expect(result.stdout).toContain('expected success message');
    });

    it('should display help when requested', async () => {
      const result = await runApexCLI('your-command --help', { cwd: env.path });

      assertCLISuccess(result);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Options:');
    });
  });

  describe('Output Formats', () => {
    it('should support JSON output', async () => {
      const result = await runApexCLI('your-command --json', { cwd: env.path });

      assertCLISuccess(result);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('status');
      expect(output).toHaveProperty('data');
    });
  });

  describe('Error Handling', () => {
    it('should validate input parameters', async () => {
      const result = await runApexCLI('your-command --invalid-flag', { cwd: env.path });

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Unknown option');
    });

    it('should handle missing prerequisites', async () => {
      const emptyEnv = await createTestEnvironment({
        initGit: false,
        initApexProject: false
      });

      try {
        const result = await runApexCLI('your-command', { cwd: emptyEnv.path });

        if (commandRequiresApexProject) {
          expect(result.success).toBe(false);
          expect(result.stderr).toContain('not an APEX project');
        } else {
          expect(result.success).toBe(true);
        }
      } finally {
        await emptyEnv.cleanup();
      }
    });
  });
});
```

### Template: Git Integration Test

```typescript
/**
 * @fileoverview E2E tests for git integration features
 *
 * Tests covered:
 * - Git repository operations (branch, merge, etc.)
 * - Remote repository interactions
 * - Conflict detection and resolution
 * - Branch lifecycle management
 *
 * Requirements:
 * - Git must be available in PATH
 * - Tests create temporary git repositories
 * - May involve remote repository simulation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createTestEnvironment,
  createTempGitRepo,
  createBareGitRepo,
  type TestEnvironment
} from './index';

describe('E2E: Git Integration', () => {
  let env: TestEnvironment;
  let remoteRepo: string;

  beforeEach(async () => {
    // Create working repository
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });

    // Create remote repository for push/pull operations
    remoteRepo = await createBareGitRepo('git-test-remote-');

    // Configure remote
    execSync(`git remote add origin ${remoteRepo}`, {
      cwd: env.path,
      stdio: 'pipe'
    });

    // Initial push
    execSync('git push -u origin main', {
      cwd: env.path,
      stdio: 'pipe'
    });
  });

  afterEach(async () => {
    await env.cleanup();
    // Remote repo cleanup handled by global teardown
  });

  describe('Branch Operations', () => {
    it('should create and switch to new branch', async () => {
      const result = await runCLI('checkout -b feature/new-feature', env.path);

      expect(result.success).toBe(true);

      // Verify branch created and active
      const currentBranch = execSync('git branch --show-current', {
        cwd: env.path,
        encoding: 'utf8'
      }).trim();
      expect(currentBranch).toBe('feature/new-feature');
    });

    it('should merge feature branch successfully', async () => {
      // Create feature branch with changes
      execSync('git checkout -b feature/test', { cwd: env.path, stdio: 'pipe' });

      await fs.writeFile(
        path.join(env.path, 'feature.ts'),
        'export const feature = "implemented";'
      );

      execSync('git add . && git commit -m "Add feature"', {
        cwd: env.path,
        stdio: 'pipe'
      });

      // Switch back to main
      execSync('git checkout main', { cwd: env.path, stdio: 'pipe' });

      // Merge feature branch
      const result = await runCLI('merge feature/test', env.path);

      expect(result.success).toBe(true);

      // Verify file exists on main
      const featureFile = path.join(env.path, 'feature.ts');
      const content = await fs.readFile(featureFile, 'utf8');
      expect(content).toContain('implemented');
    });
  });

  describe('Remote Operations', () => {
    it('should push and pull from remote', async () => {
      // Make changes
      await fs.writeFile(
        path.join(env.path, 'remote-test.ts'),
        'export const remoteTest = true;'
      );

      execSync('git add . && git commit -m "Add remote test"', {
        cwd: env.path,
        stdio: 'pipe'
      });

      // Push to remote
      const pushResult = await runCLI('push origin main', env.path);
      expect(pushResult.success).toBe(true);

      // Verify push successful by checking remote
      const logOutput = execSync('git log --oneline -1', {
        cwd: env.path,
        encoding: 'utf8'
      });
      expect(logOutput).toContain('Add remote test');
    });
  });

  describe('Conflict Handling', () => {
    it('should detect merge conflicts', async () => {
      // Create two conflicting branches
      const createConflictingBranch = async (branchName: string, content: string) => {
        execSync(`git checkout -b ${branchName}`, { cwd: env.path, stdio: 'pipe' });

        await fs.writeFile(
          path.join(env.path, 'conflict.ts'),
          `export const value = "${content}";`
        );

        execSync('git add . && git commit -m "Add conflicting content"', {
          cwd: env.path,
          stdio: 'pipe'
        });

        execSync('git checkout main', { cwd: env.path, stdio: 'pipe' });
      };

      await createConflictingBranch('branch1', 'value1');
      await createConflictingBranch('branch2', 'value2');

      // Merge first branch
      const merge1 = await runCLI('merge branch1', env.path);
      expect(merge1.success).toBe(true);

      // Second merge should conflict
      const merge2 = await runCLI('merge branch2', env.path);
      expect(merge2.success).toBe(false);
      expect(merge2.stderr.toLowerCase()).toMatch(/conflict|merge/);

      // Verify repo is in clean state after failed merge
      const status = execSync('git status --porcelain', {
        cwd: env.path,
        encoding: 'utf8'
      });
      expect(status.trim()).toBe(''); // Should be clean
    });
  });
});
```

### Template: MCP Feature Test

```typescript
/**
 * @fileoverview E2E tests for MCP marketplace features
 *
 * Tests covered:
 * - Marketplace browsing and server listing
 * - Server installation and configuration
 * - Error handling for network issues
 * - JSON output format validation
 *
 * Requirements:
 * - Network access for marketplace operations
 * - APEX project initialization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  seedTestData,
  SEED_SCENARIOS,
  type TestEnvironment
} from './index';
import {
  execMCPCommand,
  assertMarketplaceOutput,
  createTestProjectWithServers
} from './utils/mcp-test-utils';

describe('E2E: MCP Features', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Marketplace Browsing', () => {
    it('should list available MCP servers', async () => {
      const result = await execMCPCommand('list', env.path);

      assertMarketplaceOutput(result, { hasServers: true });
      expect(result.stdout).toContain('Available MCP Servers');
      expect(result.stdout).toMatch(/\d+ servers available/);
    });

    it('should support JSON output format', async () => {
      const result = await execMCPCommand('list --json', env.path);

      expect(result.success).toBe(true);

      const servers = JSON.parse(result.stdout);
      expect(Array.isArray(servers)).toBe(true);
      if (servers.length > 0) {
        expect(servers[0]).toHaveProperty('name');
        expect(servers[0]).toHaveProperty('description');
        expect(servers[0]).toHaveProperty('verified');
      }
    });

    it('should handle empty marketplace gracefully', async () => {
      // Mock empty marketplace response
      const result = await execMCPCommand('list', env.path, {
        mockEmpty: true
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('No MCP servers found');
    });
  });

  describe('Server Installation', () => {
    it('should install MCP server successfully', async () => {
      const result = await execMCPCommand('install github', env.path);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('github server installed');

      // Verify configuration updated
      const config = await readApexConfig(env.path);
      expect(config.mcp?.servers).toHaveProperty('github');
    });

    it('should handle invalid server names', async () => {
      const result = await execMCPCommand('install nonexistent-server', env.path);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Server not found');
    });

    it('should prevent duplicate installations', async () => {
      // Install server first time
      const install1 = await execMCPCommand('install github', env.path);
      expect(install1.success).toBe(true);

      // Try to install again
      const install2 = await execMCPCommand('install github', env.path);
      expect(install2.success).toBe(false);
      expect(install2.stderr).toContain('already installed');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', { timeout: 45000 }, async () => {
      const result = await execMCPCommand('list', env.path, {
        mockNetworkError: true
      });

      expect(result.success).toBe(false);
      expect(result.stderr).toMatch(/network|connection|timeout/i);
    });

    it('should validate project requirements', async () => {
      const nonApexEnv = await createTestEnvironment({
        initGit: true,
        initApexProject: false
      });

      try {
        const result = await execMCPCommand('list', nonApexEnv.path);

        expect(result.success).toBe(false);
        expect(result.stderr).toContain('not an APEX project');
      } finally {
        await nonApexEnv.cleanup();
      }
    });
  });
});

// Helper function for reading APEX config
async function readApexConfig(projectPath: string) {
  const configPath = path.join(projectPath, '.apex', 'config.yaml');
  const configContent = await fs.readFile(configPath, 'utf8');
  return yaml.parse(configContent);
}
```

### Template: Workflow Integration Test

```typescript
/**
 * @fileoverview E2E tests for complete workflow integration
 *
 * Tests covered:
 * - Full workflow execution from start to finish
 * - Agent handoffs and task progression
 * - Workflow state persistence and recovery
 * - Resource cleanup after workflow completion
 *
 * Requirements:
 * - Extended timeout for complete workflows
 * - APEX project with agents and workflows
 * - May require mock external services
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  seedTestData,
  SEED_SCENARIOS,
  type TestEnvironment
} from './index';
import { ApexOrchestrator } from '@apex/orchestrator';

describe('E2E: Workflow Integration', () => {
  let env: TestEnvironment;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true,
      apexOptions: {
        includeAgents: true,
        includeWorkflows: true
      }
    });

    await seedTestData(env, SEED_SCENARIOS.full);

    orchestrator = new ApexOrchestrator({ projectRoot: env.path });
    globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Complete Workflows', () => {
    it('should execute feature workflow end-to-end', { timeout: 120000 }, async () => {
      // Start feature workflow
      const taskId = await orchestrator.createTask({
        type: 'feature',
        description: 'Add user authentication system',
        workflow: 'feature'
      });

      expect(taskId).toBeDefined();

      // Execute workflow stages
      const result = await orchestrator.executeWorkflow(taskId);

      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);

      // Verify task progression
      const task = await orchestrator.getTask(taskId);
      expect(task.status).toBe('completed');
      expect(task.stages).toHaveLength(5); // planning, architecture, implementation, testing, review

      // Verify all stages completed
      for (const stage of task.stages) {
        expect(stage.status).toBe('completed');
        expect(stage.outputs).toBeDefined();
      }
    });

    it('should handle workflow errors gracefully', { timeout: 90000 }, async () => {
      // Create task with invalid configuration
      const taskId = await orchestrator.createTask({
        type: 'invalid-type',
        description: 'This should fail',
        workflow: 'nonexistent-workflow'
      });

      const result = await orchestrator.executeWorkflow(taskId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Verify task marked as failed
      const task = await orchestrator.getTask(taskId);
      expect(task.status).toBe('failed');
    });

    it('should persist workflow state during execution', { timeout: 90000 }, async () => {
      const taskId = await orchestrator.createTask({
        type: 'feature',
        description: 'Add API endpoint',
        workflow: 'feature'
      });

      // Start workflow execution (non-blocking)
      const executionPromise = orchestrator.executeWorkflow(taskId);

      // Check intermediate state
      await new Promise(resolve => setTimeout(resolve, 5000));

      const intermediateTask = await orchestrator.getTask(taskId);
      expect(['running', 'completed']).toContain(intermediateTask.status);

      // Wait for completion
      const result = await executionPromise;
      expect(result.success).toBe(true);

      // Verify final state
      const finalTask = await orchestrator.getTask(taskId);
      expect(finalTask.status).toBe('completed');
    });
  });

  describe('Agent Handoffs', () => {
    it('should handle agent handoffs correctly', { timeout: 90000 }, async () => {
      const taskId = await orchestrator.createTask({
        type: 'feature',
        description: 'Implement payment processing',
        workflow: 'feature'
      });

      // Track agent handoffs
      const agentHandoffs: string[] = [];
      orchestrator.on('agentHandoff', (event) => {
        agentHandoffs.push(event.agent);
      });

      const result = await orchestrator.executeWorkflow(taskId);

      expect(result.success).toBe(true);

      // Verify expected agent sequence
      expect(agentHandoffs).toEqual([
        'planner',
        'architect',
        'developer',
        'tester',
        'reviewer'
      ]);
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources after workflow completion', { timeout: 60000 }, async () => {
      const taskId = await orchestrator.createTask({
        type: 'feature',
        description: 'Add logging system',
        workflow: 'feature'
      });

      const result = await orchestrator.executeWorkflow(taskId);
      expect(result.success).toBe(true);

      // Verify no orphaned processes
      const processes = await getOrchestatorProcesses();
      expect(processes).toHaveLength(1); // Only main orchestrator

      // Verify temporary files cleaned up
      const tempFiles = await findTemporaryFiles(env.path);
      expect(tempFiles).toHaveLength(0);
    });
  });
});

// Helper functions
async function getOrchestatorProcesses() {
  // Implementation depends on process tracking
  return [];
}

async function findTemporaryFiles(projectPath: string) {
  // Implementation to find temporary files
  return [];
}
```

### Common Patterns & Utilities

#### Using Test Utilities Effectively

```typescript
// Environment creation with options
const env = await createTestEnvironment({
  initGit: true,                    // Create git repository
  initApexProject: true,            // Initialize APEX project
  apexOptions: {
    projectName: 'test-project',    // Unique project name
    includeAgents: true,            // Include agent definitions
    includeWorkflows: true          // Include workflow definitions
  }
});

// Seed data for different scenarios
await seedTestData(env, SEED_SCENARIOS.minimal);   // Basic project structure
await seedTestData(env, SEED_SCENARIOS.full);      // Complete project
await seedTestData(env, SEED_SCENARIOS.mcp);       // MCP-focused
await seedTestData(env, SEED_SCENARIOS.git);       // Git-focused

// CLI execution patterns
const result = await runCLI('command --flag', env.path);
const apexResult = await runApexCLI('agent list', { cwd: env.path });

// Resource registration for cleanup
globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);
globalThis.apexE2EHelpers.registerServer(server);
globalThis.apexE2EHelpers.registerStore(store);
```

#### Assertion Patterns

```typescript
// CLI success assertions
expect(result.success, `Command failed: ${result.stderr}`).toBe(true);
expect(result.exitCode).toBe(0);
expect(result.stdout).toContain('expected message');
expect(result.stderr).toBe('');

// CLI failure assertions
expect(result.success).toBe(false);
expect(result.exitCode).not.toBe(0);
expect(result.stderr).toMatch(/error|failed|invalid/i);

// JSON output validation
const output = JSON.parse(result.stdout);
expect(output).toHaveProperty('status', 'success');
expect(Array.isArray(output.data)).toBe(true);

// File system verification
const files = await fs.readdir(env.path);
expect(files).toContain('expected-file.ts');

const content = await fs.readFile(filePath, 'utf8');
expect(content).toContain('expected content');
```

---

## Related Documentation

- [Project README](../README.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [E2E Test README](../tests/e2e/README.md)
- [Architecture Decision Records](./adr/)
- [Workflow Documentation](./workflows.md)
