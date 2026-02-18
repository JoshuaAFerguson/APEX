# Contributing E2E Tests Guide

> Complete guide for adding new end-to-end tests to APEX with step-by-step instructions, examples, and quality standards.

## Table of Contents

- [Quick Start](#quick-start)
- [Development Environment Setup](#development-environment-setup)
- [Adding New E2E Tests](#adding-new-e2e-tests)
- [Test Categories & Patterns](#test-categories--patterns)
- [Quality Standards](#quality-standards)
- [Code Review Process](#code-review-process)
- [Common Scenarios](#common-scenarios)
- [Testing Examples](#testing-examples)
- [Troubleshooting](#troubleshooting)
- [Resources](#resources)

---

## Quick Start

### Prerequisites

Before contributing E2E tests, ensure you have:

1. **Node.js 18+** installed
2. **Git** available in PATH
3. **Project dependencies** installed: `npm install`
4. **Project built**: `npm run build`

### Verify Your Setup

```bash
# Check Node.js version
node --version  # Should be 18+ or 20+

# Check git availability
git --version

# Build the project (required for E2E tests)
npm run build

# Verify CLI is built
ls packages/cli/dist/index.js  # Should exist

# Run existing E2E tests to verify setup
npm run test:e2e -- --reporter=verbose
```

### Create Your First E2E Test

1. **Create test file** in `tests/e2e/`:

```bash
touch tests/e2e/my-feature.e2e.test.ts
```

2. **Use the template**:

```typescript
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

  it('should handle basic functionality', async () => {
    const result = await runCLI('my-command', env.path);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('expected output');
  });
});
```

3. **Run your test**:

```bash
npm test -- tests/e2e/my-feature.e2e.test.ts
```

---

## Development Environment Setup

### 1. Repository Setup

```bash
# Clone and setup
git clone <apex-repo-url>
cd apex
npm install
npm run build

# Verify E2E infrastructure
npm run validate:e2e-discovery
```

### 2. IDE Configuration

For VS Code, add these settings to `.vscode/settings.json`:

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "vitest.enable": true,
  "vitest.commandLine": "npm test",
  "vitest.rootConfig": "./vitest.e2e.config.ts"
}
```

### 3. Environment Variables

For development, you can set:

```bash
export DEBUG=1                    # Enable debug output
export APEX_TEST_MODE=e2e        # E2E test mode
export NODE_ENV=test             # Test environment
```

### 4. Git Configuration

Ensure git is configured (E2E tests create git repos):

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## Adding New E2E Tests

### Step 1: Identify Test Category

Determine which category your test belongs to:

| Category | File Pattern | Purpose | Typical Timeout |
|----------|--------------|---------|----------------|
| **CLI Commands** | `cli-*.e2e.test.ts` | Direct CLI interactions | 30s |
| **Git Operations** | `git-*.e2e.test.ts` | Repository operations | 60s |
| **Workflows** | `workflow-*.e2e.test.ts` | End-to-end workflows | 120s |
| **MCP Features** | `mcp-*.e2e.test.ts` | Marketplace operations | 45s |
| **API Integration** | `api-*.e2e.test.ts` | Server/API testing | 60s |
| **Infrastructure** | `infra-*.e2e.test.ts` | System testing | 90s |

### Step 2: Choose File Location

```bash
# Main E2E directory (preferred for new tests)
tests/e2e/your-feature.e2e.test.ts

# Package-specific (if testing specific package)
packages/cli/src/__tests__/your-cli-feature.e2e.test.ts
packages/orchestrator/src/__tests__/your-orchestrator-feature.e2e.test.ts
```

### Step 3: File Structure Template

Use this comprehensive template:

```typescript
/**
 * @fileoverview E2E tests for [feature description]
 *
 * Tests covered:
 * - [List main test scenarios]
 * - [Include happy path scenarios]
 * - [Include error handling scenarios]
 * - [Include edge cases]
 *
 * Requirements:
 * - [List any special prerequisites]
 * - [Mention timing considerations]
 * - [Note platform-specific behavior if any]
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  runCLI,
  seedTestData,
  SEED_SCENARIOS,
  type TestEnvironment
} from '../index';
// Add specific imports as needed
// import { runApexCLI } from '../helpers/cli-test-helpers';
// import { execMCPCommand } from '../utils/mcp-test-utils';

describe('E2E: [Feature Name]', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,           // Most tests need git
      initApexProject: true,   // Most tests need APEX project
      apexOptions: {
        projectName: `test-${Date.now()}`, // Unique project name
        includeAgents: true,               // Include if testing agents
        includeWorkflows: true             // Include if testing workflows
      }
    });

    // Seed with appropriate test data
    await seedTestData(env, SEED_SCENARIOS.full);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Happy Path Scenarios', () => {
    it('should handle normal operation successfully', async () => {
      // ARRANGE: Set up test conditions
      // (test data seeded in beforeEach)

      // ACT: Perform the operation being tested
      const result = await runCLI('your-command --flag', env.path);

      // ASSERT: Verify expected outcomes
      expect(result.success, `Command failed: ${result.stderr}`).toBe(true);
      expect(result.stdout).toContain('expected success message');
      expect(result.stderr).toBe(''); // No errors

      // Verify side effects if applicable
      // const files = await fs.readdir(env.path);
      // expect(files).toContain('expected-output-file');
    });

    it('should handle operation with options', async () => {
      const result = await runCLI('your-command --option=value', env.path);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('option-specific output');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing prerequisites gracefully', async () => {
      // Create environment without prerequisites
      const badEnv = await createTestEnvironment({ initGit: false });

      try {
        const result = await runCLI('your-command', badEnv.path);

        expect(result.success).toBe(false);
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toMatch(/prerequisite.*missing|not found/i);
      } finally {
        await badEnv.cleanup();
      }
    });

    it('should validate input parameters', async () => {
      const invalidInputs = ['', ' ', '..', '\x00invalid'];

      for (const input of invalidInputs) {
        const result = await runCLI(`your-command "${input}"`, env.path);
        expect(result.success, `Should reject invalid input: "${input}"`).toBe(false);
      }
    });

    it('should handle filesystem errors', async () => {
      // Create read-only directory to trigger permission error
      const readOnlyPath = path.join(env.path, 'readonly');
      await fs.mkdir(readOnlyPath);
      await fs.chmod(readOnlyPath, 0o444);

      try {
        const result = await runCLI('your-command --output=readonly/file', env.path);
        expect(result.success).toBe(false);
        expect(result.stderr).toMatch(/permission.*denied|access.*denied/i);
      } finally {
        await fs.chmod(readOnlyPath, 0o755);
        await fs.rmdir(readOnlyPath);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty project', async () => {
      const emptyEnv = await createTestEnvironment({
        initGit: true,
        initApexProject: false // No APEX project
      });

      try {
        const result = await runCLI('your-command', emptyEnv.path);

        // Define expected behavior for empty project
        if (commandRequiresApexProject) {
          expect(result.success).toBe(false);
          expect(result.stderr).toContain('not an APEX project');
        } else {
          expect(result.success).toBe(true);
          // Test actual behavior
        }
      } finally {
        await emptyEnv.cleanup();
      }
    });

    it('should handle large datasets', { timeout: 90000 }, async () => {
      // Create large test data
      const largeFile = createTestFile({ size: 'large' });
      await seedTestData(env, { files: [largeFile] });

      const result = await runCLI('your-command --all', env.path);
      expect(result.success).toBe(true);
      // Verify operation completed correctly with large data
    });

    it('should handle special characters in paths', async () => {
      const specialEnv = await createTestEnvironment({
        initGit: true,
        initApexProject: true,
        // Project with special characters in path
        pathPrefix: 'test with spaces & symbols'
      });

      try {
        const result = await runCLI('your-command', specialEnv.path);
        expect(result.success).toBe(true);
      } finally {
        await specialEnv.cleanup();
      }
    });
  });

  describe('Integration', () => {
    it('should integrate with other APEX features', async () => {
      // Test integration with orchestrator, agents, workflows, etc.
      const orchestrator = new ApexOrchestrator({ projectRoot: env.path });
      globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);

      // Perform integrated operation
      const result = await runCLI('your-command --with-integration', env.path);
      expect(result.success).toBe(true);

      // Verify integration effects
      const tasks = await orchestrator.listTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].type).toBe('expected-task-type');
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', { timeout: 30000 }, async () => {
      const startTime = Date.now();

      const result = await runCLI('your-command', env.path);

      const duration = Date.now() - startTime;
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
```

### Step 4: Test Implementation Guidelines

#### Use Descriptive Test Names

```typescript
// ✅ GOOD: Clear, specific test names
it('should create new branch when starting feature workflow')
it('should merge feature branch with squash strategy when requested')
it('should handle merge conflicts by aborting and preserving changes')

// ❌ BAD: Vague test names
it('should work')
it('should handle branches')
it('should merge')
```

#### Write Helpful Assertions

```typescript
// ✅ GOOD: Descriptive assertions with context
expect(result.success, `CLI command failed: ${result.stderr}`).toBe(true);
expect(result.stdout, 'Missing success confirmation').toContain('Operation completed');
expect(gitBranch, 'Should be on main after merge').toBe('main');

// ❌ BAD: Assertions without context
expect(result.success).toBe(true);
expect(result.stdout).toContain('completed');
expect(gitBranch).toBe('main');
```

#### Handle Resources Properly

```typescript
describe('E2E: Resource Management', () => {
  let env: TestEnvironment;
  let orchestrator: ApexOrchestrator | null = null;
  let server: FastifyInstance | null = null;

  beforeEach(async () => {
    env = await createTestEnvironment({ initGit: true, initApexProject: true });
  });

  afterEach(async () => {
    // Clean up in reverse order of creation
    try {
      if (server) {
        await server.close();
        server = null;
      }
      if (orchestrator) {
        await orchestrator.shutdown();
        orchestrator = null;
      }
      await env.cleanup();
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
      // Don't throw - let test result stand
    }
  });

  it('should manage resources correctly', async () => {
    // Create and register resources
    orchestrator = new ApexOrchestrator({ projectRoot: env.path });
    server = await createTestAPIServer();

    globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);
    globalThis.apexE2EHelpers.registerServer(server);

    // Test logic...
  });
});
```

---

## Test Categories & Patterns

### 1. CLI Command Tests

For testing CLI commands directly:

```typescript
// tests/e2e/cli-commands.e2e.test.ts
import { runApexCLI, assertCLISuccess } from './helpers/cli-test-helpers';

describe('E2E: CLI Commands', () => {
  it('should execute help command', async () => {
    const result = await runApexCLI('--help');
    assertCLISuccess(result);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('Commands:');
  });

  it('should display version information', async () => {
    const result = await runApexCLI('--version');
    assertCLISuccess(result);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/); // Semantic version
  });
});
```

### 2. Git Workflow Tests

For testing git operations and workflows:

```typescript
// tests/e2e/git-workflow.e2e.test.ts
import { createTempGitRepo, createBareGitRepo } from './index';

describe('E2E: Git Workflow', () => {
  let workingRepo: string;
  let remoteRepo: string;

  beforeEach(async () => {
    workingRepo = await createTempGitRepo('git-workflow-');
    remoteRepo = await createBareGitRepo('git-remote-');

    // Configure remote
    execSync(`git remote add origin ${remoteRepo}`, {
      cwd: workingRepo,
      stdio: 'pipe'
    });
  });

  it('should push and merge feature branches', async () => {
    // Create feature branch
    execSync('git checkout -b feature/test', { cwd: workingRepo });
    await fs.writeFile(
      path.join(workingRepo, 'feature.ts'),
      'export const feature = true;'
    );
    execSync('git add . && git commit -m "Add feature"', { cwd: workingRepo });

    // Push feature
    execSync('git push -u origin feature/test', { cwd: workingRepo });

    // Merge via CLI
    const result = await runCLI('merge feature/test', workingRepo);
    expect(result.success).toBe(true);

    // Verify merge
    const currentBranch = getCurrentBranch(workingRepo);
    expect(currentBranch).toBe('main');
  });
});
```

### 3. MCP Feature Tests

For testing MCP marketplace functionality:

```typescript
// tests/e2e/mcp-features.e2e.test.ts
import {
  createTestProjectWithServers,
  execMCPCommand,
  assertMarketplaceOutput
} from './utils/mcp-test-utils';

describe('E2E: MCP Features', () => {
  it('should browse marketplace successfully', async () => {
    const env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });

    const result = await execMCPCommand('list', env.path);
    assertMarketplaceOutput(result, { hasServers: true });
    expect(result.stdout).toContain('Available MCP Servers');

    await env.cleanup();
  });

  it('should install MCP servers', async () => {
    const env = await createTestProjectWithServers([]);

    const result = await execMCPCommand('install github', env.path);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('github server installed');

    // Verify configuration
    const config = await readApexConfig(env.path);
    expect(config.mcp?.servers).toHaveProperty('github');

    await env.cleanup();
  });
});
```

### 4. Workflow Integration Tests

For testing complete workflows:

```typescript
// tests/e2e/workflow-integration.e2e.test.ts
describe('E2E: Workflow Integration', () => {
  it('should execute complete feature workflow', { timeout: 120000 }, async () => {
    // Initialize with full workflow
    await seedTestData(env, SEED_SCENARIOS.full);

    // Start workflow
    const result = await runCLI('run feature --description="Add login"', env.path);
    expect(result.success).toBe(true);

    // Verify task created
    const orchestrator = new ApexOrchestrator({ projectRoot: env.path });
    const tasks = await orchestrator.listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe('Add login');
    expect(tasks[0].workflow).toBe('feature');

    await orchestrator.shutdown();
  });
});
```

---

## Quality Standards

### Code Quality Requirements

#### 1. Test Coverage Standards

Every new E2E test must cover:

- ✅ **Happy path scenarios** (minimum 2 test cases)
- ✅ **Error handling** (minimum 3 error scenarios)
- ✅ **Edge cases** (minimum 1 edge case)
- ✅ **Input validation** (test invalid inputs)
- ✅ **Resource cleanup** (proper setup/teardown)

#### 2. Documentation Standards

Every test file must include:

```typescript
/**
 * @fileoverview [Required: Clear description of what is being tested]
 *
 * Tests covered:
 * - [Required: List of main test scenarios]
 * - [Required: Include both positive and negative cases]
 *
 * Requirements:
 * - [Required: Any special setup requirements]
 * - [Optional: Platform-specific notes]
 * - [Optional: Performance considerations]
 */
```

#### 3. Naming Conventions

- **File names**: `feature-name.e2e.test.ts`
- **Test descriptions**: Start with action verb ("should...")
- **Environment variables**: Use UPPERCASE_WITH_UNDERSCORES
- **Temporary directories**: Use descriptive prefixes

### Performance Standards

#### 1. Timeout Guidelines

Set timeouts based on operation complexity:

```typescript
// Quick operations (CLI help, version, etc.)
{ timeout: 10000 }  // 10 seconds

// Standard operations (init, status, basic commands)
{ timeout: 30000 }  // 30 seconds

// Complex operations (full workflows, large file operations)
{ timeout: 60000 }  // 60 seconds

// Very long operations (comprehensive workflows)
{ timeout: 120000 } // 2 minutes
```

#### 2. Resource Usage

- **Memory**: Tests should not exceed 100MB additional memory
- **Disk**: Clean up all temporary files and directories
- **Processes**: Close all spawned processes and connections
- **Network**: Use mocks for external services when possible

### Reliability Standards

#### 1. Test Isolation

- Each test gets fresh environment
- No shared state between tests
- Proper cleanup even on failures
- No hardcoded paths or assumptions

#### 2. Error Handling

```typescript
// ✅ GOOD: Comprehensive error handling
it('should handle errors gracefully', async () => {
  try {
    const result = await runCLI('invalid-command', env.path);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('Unknown command');
  } catch (error) {
    // Handle unexpected execution errors
    throw new Error(`Unexpected error during CLI execution: ${error.message}`);
  }
});

// ❌ BAD: No error handling
it('should handle errors', async () => {
  const result = await runCLI('invalid-command', env.path);
  expect(result.success).toBe(false);
});
```

---

## Code Review Process

### Pre-Review Checklist

Before submitting your E2E test PR:

#### ✅ Functionality
- [ ] Tests pass locally: `npm run test:e2e -- --grep="Your Feature"`
- [ ] Tests are properly isolated (run individually)
- [ ] All edge cases and error scenarios covered
- [ ] Performance is acceptable for the operation type

#### ✅ Code Quality
- [ ] Follows established patterns in existing tests
- [ ] Uses appropriate test utilities and helpers
- [ ] Has proper documentation and comments
- [ ] No code duplication or overly complex logic

#### ✅ Integration
- [ ] Works with CI/CD pipeline
- [ ] Compatible with all supported platforms
- [ ] Doesn't conflict with existing tests
- [ ] Proper git workflow and conventional commits

### Review Criteria

Reviewers will evaluate:

#### 1. Test Design
- Is the test testing the right thing?
- Are test cases comprehensive but not redundant?
- Is the test structure clear and logical?
- Are timeouts and resource usage appropriate?

#### 2. Code Quality
- Does the code follow established patterns?
- Are error messages helpful for debugging?
- Is the test maintainable and readable?
- Are dependencies minimal and appropriate?

#### 3. Coverage & Value
- Does the test add meaningful coverage?
- Are both success and failure scenarios tested?
- Does the test catch real regressions?
- Is the test likely to remain stable?

### Common Review Feedback

#### "Please add error handling tests"

```typescript
// Add tests for various error conditions
it('should handle missing dependencies', async () => {
  // Test without required dependencies
});

it('should validate input parameters', async () => {
  // Test with invalid inputs
});
```

#### "Timeout seems too long/short"

```typescript
// Adjust timeout based on operation complexity
it('should complete quick operation', { timeout: 10000 }, async () => {
  // Quick operation test
});

it('should handle complex workflow', { timeout: 60000 }, async () => {
  // Complex operation test
});
```

#### "Please improve assertion messages"

```typescript
// ✅ GOOD: Helpful assertion messages
expect(result.success, `Command failed: ${result.stderr}`).toBe(true);

// ❌ BAD: Generic assertion
expect(result.success).toBe(true);
```

---

## Common Scenarios

### Scenario 1: Testing New CLI Command

```typescript
// 1. Create test file: tests/e2e/new-command.e2e.test.ts
describe('E2E: New Command', () => {
  it('should execute new command successfully', async () => {
    const result = await runCLI('new-command --flag', env.path);
    expect(result.success).toBe(true);
  });

  it('should show help for new command', async () => {
    const result = await runCLI('new-command --help', env.path);
    expect(result.stdout).toContain('Usage:');
  });
});
```

### Scenario 2: Testing Git Integration

```typescript
// 2. Test git operations
describe('E2E: Git Integration', () => {
  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });
  });

  it('should work with git repository', async () => {
    // Create branch
    execSync('git checkout -b feature', { cwd: env.path });

    // Test command
    const result = await runCLI('git-related-command', env.path);
    expect(result.success).toBe(true);

    // Verify git state
    const branch = getCurrentBranch(env.path);
    expect(branch).toBe('feature');
  });
});
```

### Scenario 3: Testing Orchestrator Integration

```typescript
// 3. Test orchestrator features
describe('E2E: Orchestrator Integration', () => {
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });
    orchestrator = new ApexOrchestrator({ projectRoot: env.path });
    globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);
  });

  it('should integrate with orchestrator', async () => {
    const result = await runCLI('orchestrator-command', env.path);
    expect(result.success).toBe(true);

    const tasks = await orchestrator.listTasks();
    expect(tasks).toHaveLength(1);
  });
});
```

### Scenario 4: Testing MCP Features

```typescript
// 4. Test MCP functionality
import { execMCPCommand } from './utils/mcp-test-utils';

describe('E2E: MCP Features', () => {
  it('should work with MCP marketplace', async () => {
    const result = await execMCPCommand('list', env.path);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Available servers');
  });
});
```

---

## Testing Examples

### Example 1: Complete CLI Command Test

```typescript
/**
 * @fileoverview E2E tests for the agent list command
 *
 * Tests covered:
 * - Listing agents in project with agents
 * - Listing agents in project without agents
 * - Error handling for invalid project
 * - JSON output format
 * - Help and version output
 *
 * Requirements:
 * - APEX project must be initialized for most tests
 * - Git repository recommended for full functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  runCLI,
  seedTestData,
  SEED_SCENARIOS,
  type TestEnvironment
} from './index';
import { runApexCLI } from './helpers/cli-test-helpers';

describe('E2E: Agent List Command', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true,
      apexOptions: { includeAgents: true }
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Happy Path', () => {
    it('should list available agents', async () => {
      await seedTestData(env, SEED_SCENARIOS.full);

      const result = await runApexCLI('agent list', { cwd: env.path });

      expect(result.success, `Command failed: ${result.stderr}`).toBe(true);
      expect(result.stdout).toContain('Available agents:');
      expect(result.stdout).toContain('developer');
      expect(result.stdout).toContain('planner');
    });

    it('should show JSON output when requested', async () => {
      await seedTestData(env, SEED_SCENARIOS.full);

      const result = await runApexCLI('agent list --json', { cwd: env.path });

      expect(result.success).toBe(true);

      // Parse and validate JSON
      const agents = JSON.parse(result.stdout);
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0]).toHaveProperty('name');
      expect(agents[0]).toHaveProperty('description');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty project gracefully', async () => {
      // Don't seed any agents
      const result = await runApexCLI('agent list', { cwd: env.path });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('No agents found');
    });

    it('should handle non-APEX project', async () => {
      const nonApexEnv = await createTestEnvironment({
        initGit: true,
        initApexProject: false
      });

      try {
        const result = await runApexCLI('agent list', { cwd: nonApexEnv.path });

        expect(result.success).toBe(false);
        expect(result.stderr).toContain('not an APEX project');
      } finally {
        await nonApexEnv.cleanup();
      }
    });

    it('should handle corrupted agent files', async () => {
      await seedTestData(env, SEED_SCENARIOS.full);

      // Corrupt an agent file
      const agentFile = path.join(env.path, '.apex/agents/developer.md');
      await fs.writeFile(agentFile, 'corrupted content');

      const result = await runApexCLI('agent list', { cwd: env.path });

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('error reading agent');
    });
  });

  describe('Format Options', () => {
    it('should support verbose output', async () => {
      await seedTestData(env, SEED_SCENARIOS.full);

      const result = await runApexCLI('agent list --verbose', { cwd: env.path });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Description:');
      expect(result.stdout).toContain('Tools:');
      expect(result.stdout).toContain('Model:');
    });

    it('should support filtering by name', async () => {
      await seedTestData(env, SEED_SCENARIOS.full);

      const result = await runApexCLI('agent list --filter=developer', { cwd: env.path });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('developer');
      expect(result.stdout).not.toContain('planner');
    });
  });
});
```

### Example 2: Git Workflow Test

```typescript
/**
 * @fileoverview E2E tests for git branch management in APEX workflows
 *
 * Tests covered:
 * - Creating feature branches automatically
 * - Switching between branches
 * - Merging branches with different strategies
 * - Handling merge conflicts
 * - Cleaning up completed branches
 *
 * Requirements:
 * - Git must be available in PATH
 * - Tests create temporary git repositories
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

describe('E2E: Git Branch Management', () => {
  let env: TestEnvironment;
  let workingRepo: string;
  let remoteRepo: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    // Create working and remote repositories
    workingRepo = await createTempGitRepo('branch-test-working-');
    remoteRepo = await createBareGitRepo('branch-test-remote-');

    // Set up APEX project in working repo
    env = await createTestEnvironment({
      path: workingRepo,
      initGit: false, // Already initialized
      initApexProject: true
    });

    // Configure remote
    execSync(`git remote add origin ${remoteRepo}`, {
      cwd: workingRepo,
      stdio: 'pipe'
    });

    // Initial push
    execSync('git push -u origin main', {
      cwd: workingRepo,
      stdio: 'pipe'
    });

    // Set up orchestrator
    orchestrator = new ApexOrchestrator({ projectRoot: workingRepo });
    globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Branch Creation', () => {
    it('should create feature branch automatically', async () => {
      const taskId = await orchestrator.createTask({
        type: 'feature',
        description: 'Add user authentication',
        workflow: 'feature'
      });

      const branch = await orchestrator.createTaskBranch(taskId);

      expect(branch).toMatch(/^apex\/[a-f0-9]+-feature-/);

      // Verify branch exists
      const branches = execSync('git branch', {
        cwd: workingRepo,
        encoding: 'utf8'
      });
      expect(branches).toContain(branch);

      // Verify we're on the new branch
      const currentBranch = execSync('git branch --show-current', {
        cwd: workingRepo,
        encoding: 'utf8'
      }).trim();
      expect(currentBranch).toBe(branch);
    });

    it('should handle branch name collisions', async () => {
      // Create first task
      const task1 = await orchestrator.createTask({
        type: 'feature',
        description: 'Add authentication',
        workflow: 'feature'
      });

      // Create second task with similar description
      const task2 = await orchestrator.createTask({
        type: 'feature',
        description: 'Add authentication',
        workflow: 'feature'
      });

      const branch1 = await orchestrator.createTaskBranch(task1);
      const branch2 = await orchestrator.createTaskBranch(task2);

      expect(branch1).not.toBe(branch2);

      // Verify both branches exist
      const branches = execSync('git branch', {
        cwd: workingRepo,
        encoding: 'utf8'
      });
      expect(branches).toContain(branch1);
      expect(branches).toContain(branch2);
    });
  });

  describe('Branch Merging', () => {
    it('should merge feature branch with merge commit', async () => {
      const taskId = await createTaskWithChanges('Add login feature');

      const result = await orchestrator.mergeTaskBranch(taskId, {
        strategy: 'merge'
      });

      expect(result.success).toBe(true);

      // Verify we're back on main
      const currentBranch = getCurrentBranch(workingRepo);
      expect(currentBranch).toBe('main');

      // Verify merge commit exists
      const log = execSync('git log --oneline -n 2', {
        cwd: workingRepo,
        encoding: 'utf8'
      });
      expect(log).toContain('Merge branch');

      // Verify changes are present
      const files = await fs.readdir(workingRepo);
      expect(files).toContain('login.ts');
    });

    it('should squash merge feature branch', async () => {
      const taskId = await createTaskWithChanges('Add login feature');

      const result = await orchestrator.mergeTaskBranch(taskId, {
        strategy: 'squash'
      });

      expect(result.success).toBe(true);

      // Verify we're back on main
      const currentBranch = getCurrentBranch(workingRepo);
      expect(currentBranch).toBe('main');

      // Verify NO merge commit (squashed)
      const log = execSync('git log --oneline -n 2', {
        cwd: workingRepo,
        encoding: 'utf8'
      });
      expect(log).not.toContain('Merge branch');

      // Verify changes are present
      const files = await fs.readdir(workingRepo);
      expect(files).toContain('login.ts');
    });
  });

  describe('Merge Conflicts', () => {
    it('should detect and handle merge conflicts', async () => {
      // Create conflicting changes
      const task1Id = await createTaskWithConflictingChanges('Feature A');
      const task2Id = await createTaskWithConflictingChanges('Feature B');

      // Merge first task
      const result1 = await orchestrator.mergeTaskBranch(task1Id, {
        strategy: 'merge'
      });
      expect(result1.success).toBe(true);

      // Second merge should conflict
      const result2 = await orchestrator.mergeTaskBranch(task2Id, {
        strategy: 'merge'
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('merge conflict');

      // Verify repository is in clean state after failed merge
      const status = execSync('git status --porcelain', {
        cwd: workingRepo,
        encoding: 'utf8'
      });
      expect(status.trim()).toBe(''); // Should be clean
    });
  });

  // Helper functions
  async function createTaskWithChanges(description: string): Promise<string> {
    const taskId = await orchestrator.createTask({
      type: 'feature',
      description,
      workflow: 'feature'
    });

    const branch = await orchestrator.createTaskBranch(taskId);

    // Make changes on the branch
    await fs.writeFile(
      path.join(workingRepo, 'login.ts'),
      'export const login = () => { console.log("logging in"); };'
    );

    execSync('git add . && git commit -m "Add login functionality"', {
      cwd: workingRepo,
      stdio: 'pipe'
    });

    // Switch back to main
    execSync('git checkout main', {
      cwd: workingRepo,
      stdio: 'pipe'
    });

    return taskId;
  }

  async function createTaskWithConflictingChanges(description: string): Promise<string> {
    const taskId = await orchestrator.createTask({
      type: 'feature',
      description,
      workflow: 'feature'
    });

    const branch = await orchestrator.createTaskBranch(taskId);

    // Create conflicting change to same file
    await fs.writeFile(
      path.join(workingRepo, 'config.ts'),
      `export const config = { feature: "${description}" };`
    );

    execSync('git add . && git commit -m "Update config"', {
      cwd: workingRepo,
      stdio: 'pipe'
    });

    execSync('git checkout main', {
      cwd: workingRepo,
      stdio: 'pipe'
    });

    return taskId;
  }

  function getCurrentBranch(repoPath: string): string {
    return execSync('git branch --show-current', {
      cwd: repoPath,
      encoding: 'utf8'
    }).trim();
  }
});
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "CLI binary not found"

**Problem**: Test can't find the built CLI binary.

**Solution**:
```bash
# Build the project first
npm run build

# Verify CLI binary exists
ls packages/cli/dist/index.js

# If missing, check build errors
npm run build 2>&1 | grep -i error
```

#### Issue: "Git not found in PATH"

**Problem**: Tests require git but it's not available.

**Solution**:
```bash
# Check git availability
git --version

# Install git if missing
# macOS: brew install git
# Ubuntu: sudo apt-get install git
# Windows: Download from git-scm.com

# Verify git configuration
git config --global user.name || git config --global user.name "Test User"
git config --global user.email || git config --global user.email "test@example.com"
```

#### Issue: Tests hanging or timing out

**Problem**: Tests don't complete within expected time.

**Solutions**:
```bash
# Check for orphaned processes
ps aux | grep apex
ps aux | grep node

# Kill orphaned processes
pkill -f apex
pkill -f "node.*packages/cli"

# Check port conflicts
lsof -i :3000
lsof -i :8080

# Run single test to isolate issue
npm test -- tests/e2e/specific.e2e.test.ts --reporter=verbose

# Enable debug output
DEBUG=1 npm test -- tests/e2e/specific.e2e.test.ts
```

#### Issue: Permission errors during cleanup

**Problem**: Can't clean up temporary directories.

**Solution**:
```bash
# Run platform-specific cleanup
npm run cleanup:test

# Manual cleanup (Unix/Linux/macOS)
find . -name ".apex-test" -type d -exec rm -rf {} +
sudo rm -rf /tmp/apex-e2e-*

# Manual cleanup (Windows)
for /d /r . %d in (.apex-test) do @if exist "%d" rmdir /s /q "%d"
rmdir /s C:\temp\apex-e2e-*
```

#### Issue: Database lock errors

**Problem**: SQLite database locks preventing cleanup.

**Solution**:
```bash
# Close all orchestrator connections first
# Then delete database files
rm -f .apex/apex.db
rm -f .apex/apex.db-wal
rm -f .apex/apex.db-shm

# Restart tests
npm run test:e2e
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Enable debug output for all tests
DEBUG=1 npm run test:e2e

# Enable specific debug categories
DEBUG=apex:* npm run test:e2e
DEBUG=test:* npm run test:e2e

# Combine with verbose reporter
DEBUG=1 npm run test:e2e -- --reporter=verbose
```

### Getting Help

1. **Check existing tests** for similar patterns
2. **Review documentation** in `docs/e2e.md`
3. **Look at test utilities** in `tests/e2e/utils/`
4. **Check ADRs** in `tests/e2e/docs/`
5. **Ask in discussions** with reproduction steps

---

## Resources

### Documentation Links

- [Main E2E Testing Guide](./e2e.md)
- [E2E Best Practices](./e2e-best-practices.md)
- [E2E Debugging Guide](./e2e-debugging.md)
- [Project README](../README.md)
- [Contributing Guide](../CONTRIBUTING.md)

### Code Examples

- [Browse Marketplace E2E Tests](../tests/e2e/browse-marketplace.e2e.test.ts)
- [Git Workflow Tests](../tests/e2e/git-workflow-lifecycle.e2e.test.ts)
- [CLI Command Tests](../tests/e2e/cli.e2e.test.ts)
- [MCP Features Tests](../tests/e2e/mcp-marketplace.e2e.test.ts)

### Test Utilities

- [Core Utilities](../tests/e2e/utils/test-utilities.ts)
- [CLI Helpers](../tests/e2e/helpers/cli-test-helpers.ts)
- [MCP Utilities](../tests/e2e/utils/mcp-test-utils.ts)
- [Setup & Teardown](../tests/e2e/setup.ts)

### Configuration Files

- [E2E Vitest Config](../vitest.e2e.config.ts)
- [Shared Config](../vitest.shared.config.ts)
- [Playwright Config](../playwright.config.ts)
- [CI Configuration](../.github/workflows/ci.yml)

---

## Summary

Contributing E2E tests to APEX involves:

1. **Understanding the existing architecture** and patterns
2. **Following established conventions** for file structure and naming
3. **Writing comprehensive tests** covering happy path, errors, and edge cases
4. **Using proper resource management** with setup/teardown
5. **Ensuring cross-platform compatibility** and proper error handling
6. **Providing good documentation** and helpful error messages

The key to successful E2E test contribution is following the established patterns, being thorough with test coverage, and ensuring tests are reliable and maintainable.

For questions or help, refer to the existing test examples, documentation, or ask in project discussions with specific reproduction steps.