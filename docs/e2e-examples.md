# E2E Test Examples & Patterns

> Practical examples and proven patterns for writing effective end-to-end tests in APEX.

## Table of Contents

- [Basic Test Structure](#basic-test-structure)
- [CLI Command Testing](#cli-command-testing)
- [Git Workflow Testing](#git-workflow-testing)
- [MCP Marketplace Testing](#mcp-marketplace-testing)
- [Error Handling Testing](#error-handling-testing)
- [Performance Testing](#performance-testing)
- [Integration Testing](#integration-testing)
- [Cross-Platform Testing](#cross-platform-testing)
- [Advanced Patterns](#advanced-patterns)
- [Test Templates](#test-templates)

---

## Basic Test Structure

### Minimal Test Template

```typescript
/**
 * @fileoverview E2E tests for basic functionality
 *
 * Tests covered:
 * - Basic operation success
 * - Error handling
 *
 * Requirements:
 * - None (minimal setup)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  runCLI,
  type TestEnvironment
} from './index';

describe('E2E: Basic Functionality', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should perform basic operation', async () => {
    const result = await runCLI('--version', env.path);

    expect(result.success).toBe(true);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    expect(result.stderr).toBe('');
  });
});
```

### Full Project Test Template

```typescript
/**
 * @fileoverview E2E tests for feature requiring full APEX project
 *
 * Tests covered:
 * - Project-dependent operations
 * - Agent and workflow integration
 *
 * Requirements:
 * - APEX project must be initialized
 * - Git repository recommended
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  runCLI,
  seedTestData,
  SEED_SCENARIOS,
  type TestEnvironment
} from './index';

describe('E2E: Full Project Features', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true,
      apexOptions: {
        projectName: 'test-project',
        includeAgents: true,
        includeWorkflows: true
      }
    });

    // Seed with comprehensive test data
    await seedTestData(env, SEED_SCENARIOS.full);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should work with full project setup', async () => {
    const result = await runCLI('agent list', env.path);

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Available agents:');
    expect(result.stdout).toContain('developer');
  });
});
```

---

## CLI Command Testing

### Version and Help Commands

```typescript
describe('E2E: CLI Basic Commands', () => {
  it('should display version information', async () => {
    const result = await runCLI('--version', '.');

    expect(result.success).toBe(true);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    expect(result.exitCode).toBe(0);
  });

  it('should display help information', async () => {
    const result = await runCLI('--help', '.');

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('Commands:');
    expect(result.stdout).toContain('Options:');
  });

  it('should show help for specific command', async () => {
    const result = await runCLI('init --help', '.');

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('Initialize');
  });
});
```

### Project Initialization

```typescript
describe('E2E: Project Initialization', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should initialize new project with default settings', async () => {
    const result = await runCLI('init --yes', env.path);

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Project initialized successfully');

    // Verify project structure was created
    const configPath = path.join(env.path, '.apex', 'config.yaml');
    expect(fs.existsSync(configPath)).toBe(true);

    const agentsDir = path.join(env.path, '.apex', 'agents');
    expect(fs.existsSync(agentsDir)).toBe(true);
  });

  it('should initialize project with custom name', async () => {
    const projectName = 'Custom Test Project';
    const result = await runCLI(`init --name="${projectName}" --yes`, env.path);

    expect(result.success).toBe(true);

    // Verify custom name in config
    const configPath = path.join(env.path, '.apex', 'config.yaml');
    const configContent = await fs.readFile(configPath, 'utf8');
    expect(configContent).toContain(projectName);
  });

  it('should handle existing project gracefully', async () => {
    // Initialize once
    await runCLI('init --yes', env.path);

    // Try to initialize again
    const result = await runCLI('init --yes', env.path);

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('already initialized');
  });
});
```

### Agent Management

```typescript
describe('E2E: Agent Management', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true,
      apexOptions: { includeAgents: true }
    });
    await seedTestData(env, SEED_SCENARIOS.full);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should list available agents', async () => {
    const result = await runCLI('agent list', env.path);

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Available agents:');
    expect(result.stdout).toContain('developer');
    expect(result.stdout).toContain('planner');
  });

  it('should show agent details', async () => {
    const result = await runCLI('agent list --verbose', env.path);

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Description:');
    expect(result.stdout).toContain('Tools:');
    expect(result.stdout).toContain('Model:');
  });

  it('should output agent list as JSON', async () => {
    const result = await runCLI('agent list --json', env.path);

    expect(result.success).toBe(true);

    // Parse and validate JSON structure
    const agents = JSON.parse(result.stdout);
    expect(Array.isArray(agents)).toBe(true);
    expect(agents.length).toBeGreaterThan(0);

    const firstAgent = agents[0];
    expect(firstAgent).toHaveProperty('name');
    expect(firstAgent).toHaveProperty('description');
    expect(firstAgent).toHaveProperty('tools');
  });
});
```

---

## Git Workflow Testing

### Branch Management

```typescript
describe('E2E: Git Branch Management', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });
    await seedTestData(env, SEED_SCENARIOS.git);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should create feature branch for new task', async () => {
    const result = await runCLI('run feature --description="Add login"', env.path);

    expect(result.success).toBe(true);

    // Verify branch was created
    const branches = execSync('git branch', { cwd: env.path, encoding: 'utf8' });
    expect(branches).toContain('apex/');

    // Verify we're on the feature branch
    const currentBranch = execSync('git branch --show-current', {
      cwd: env.path,
      encoding: 'utf8'
    }).trim();
    expect(currentBranch).toMatch(/^apex\/.*-feature-/);
  });

  it('should switch between branches', async () => {
    // Create feature branch
    await runCLI('run feature --description="Test feature"', env.path);
    const featureBranch = execSync('git branch --show-current', {
      cwd: env.path,
      encoding: 'utf8'
    }).trim();

    // Switch to main
    const checkoutResult = await runCLI('checkout main', env.path);
    expect(checkoutResult.success).toBe(true);

    const currentBranch = execSync('git branch --show-current', {
      cwd: env.path,
      encoding: 'utf8'
    }).trim();
    expect(currentBranch).toBe('main');

    // Switch back to feature
    const backResult = await runCLI(`checkout ${featureBranch}`, env.path);
    expect(backResult.success).toBe(true);

    const finalBranch = execSync('git branch --show-current', {
      cwd: env.path,
      encoding: 'utf8'
    }).trim();
    expect(finalBranch).toBe(featureBranch);
  });
});
```

### Merge Operations

```typescript
describe('E2E: Git Merge Operations', () => {
  let env: TestEnvironment;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });
    await seedTestData(env, SEED_SCENARIOS.git);

    orchestrator = new ApexOrchestrator({ projectRoot: env.path });
    globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  async function createTaskWithChanges(description: string): Promise<string> {
    // Create task and branch
    const taskId = await orchestrator.createTask({
      type: 'feature',
      description,
      workflow: 'feature'
    });

    const branch = await orchestrator.createTaskBranch(taskId);

    // Make changes on the branch
    await fs.writeFile(
      path.join(env.path, 'feature.ts'),
      `export const feature = "${description}";`
    );

    execSync('git add . && git commit -m "Implement feature"', {
      cwd: env.path,
      stdio: 'pipe'
    });

    // Switch back to main
    execSync('git checkout main', { cwd: env.path, stdio: 'pipe' });

    return taskId;
  }

  it('should merge feature branch with merge commit', async () => {
    const taskId = await createTaskWithChanges('Login feature');

    const result = await orchestrator.mergeTaskBranch(taskId, {
      strategy: 'merge'
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('successfully merged');

    // Verify merge commit was created
    const log = execSync('git log --oneline -n 2', {
      cwd: env.path,
      encoding: 'utf8'
    });
    expect(log).toContain('Merge branch');

    // Verify feature file exists
    const featureFile = path.join(env.path, 'feature.ts');
    expect(fs.existsSync(featureFile)).toBe(true);

    const content = await fs.readFile(featureFile, 'utf8');
    expect(content).toContain('Login feature');
  });

  it('should squash merge feature branch', async () => {
    const taskId = await createTaskWithChanges('Auth feature');

    const result = await orchestrator.mergeTaskBranch(taskId, {
      strategy: 'squash'
    });

    expect(result.success).toBe(true);

    // Verify NO merge commit (squashed)
    const log = execSync('git log --oneline -n 2', {
      cwd: env.path,
      encoding: 'utf8'
    });
    expect(log).not.toContain('Merge branch');

    // Verify feature was squashed into single commit
    const commits = log.split('\n').filter(line => line.trim());
    expect(commits).toHaveLength(2); // Squash commit + initial commit

    // Verify feature file exists
    const featureFile = path.join(env.path, 'feature.ts');
    expect(fs.existsSync(featureFile)).toBe(true);
  });
});
```

### Git Remote Operations

```typescript
describe('E2E: Git Remote Operations', () => {
  let workingRepo: string;
  let remoteRepo: string;

  beforeEach(async () => {
    workingRepo = await globalThis.apexE2EHelpers.createTempGitRepo('working-');
    remoteRepo = await globalThis.apexE2EHelpers.createBareGitRepo('remote-');

    // Configure remote
    execSync(`git remote add origin ${remoteRepo}`, {
      cwd: workingRepo,
      stdio: 'pipe'
    });

    // Push initial branch
    execSync('git push -u origin main', {
      cwd: workingRepo,
      stdio: 'pipe'
    });
  });

  it('should push and pull changes', async () => {
    // Make changes in working repo
    await fs.writeFile(
      path.join(workingRepo, 'new-file.txt'),
      'New content'
    );

    execSync('git add . && git commit -m "Add new file"', {
      cwd: workingRepo,
      stdio: 'pipe'
    });

    // Push changes
    execSync('git push origin main', {
      cwd: workingRepo,
      stdio: 'pipe'
    });

    // Create second working repo and pull
    const workingRepo2 = await globalThis.apexE2EHelpers.createTempDir('working2-');
    execSync(`git clone ${remoteRepo} .`, {
      cwd: workingRepo2,
      stdio: 'pipe'
    });

    // Verify file exists in second repo
    const newFile = path.join(workingRepo2, 'new-file.txt');
    expect(fs.existsSync(newFile)).toBe(true);

    const content = await fs.readFile(newFile, 'utf8');
    expect(content).toBe('New content');
  });
});
```

---

## MCP Marketplace Testing

### Marketplace Browsing

```typescript
describe('E2E: MCP Marketplace Browsing', () => {
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

  it('should browse marketplace successfully', async () => {
    const result = await runCLI('mcp list', env.path);

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Available MCP Servers');

    // Should show server categories
    expect(result.stdout).toContain('Development');
    expect(result.stdout).toContain('Productivity');

    // Should show server count
    expect(result.stdout).toMatch(/\d+\s+servers?\s+available/i);
  });

  it('should output marketplace data as JSON', async () => {
    const result = await runCLI('mcp list --json', env.path);

    expect(result.success).toBe(true);

    // Parse and validate JSON structure
    const servers = JSON.parse(result.stdout);
    expect(Array.isArray(servers)).toBe(true);

    if (servers.length > 0) {
      const firstServer = servers[0];
      expect(firstServer).toHaveProperty('id');
      expect(firstServer).toHaveProperty('name');
      expect(firstServer).toHaveProperty('category');
      expect(firstServer).toHaveProperty('verified');
    }
  });

  it('should handle empty marketplace gracefully', async () => {
    // Mock empty marketplace response
    process.env.MCP_MARKETPLACE_URL = 'http://localhost:0'; // Invalid URL

    const result = await runCLI('mcp list', env.path);

    // Should handle error gracefully
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('marketplace');

    delete process.env.MCP_MARKETPLACE_URL;
  });
});
```

### Server Installation

```typescript
describe('E2E: MCP Server Installation', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });
    await seedTestData(env, SEED_SCENARIOS.mcp);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should install MCP server', async () => {
    const result = await runCLI('mcp install filesystem', env.path);

    expect(result.success).toBe(true);
    expect(result.stdout).toContain('filesystem');
    expect(result.stdout).toContain('installed');

    // Verify server was added to configuration
    const configPath = path.join(env.path, '.apex', 'config.yaml');
    const configContent = await fs.readFile(configPath, 'utf8');
    expect(configContent).toContain('filesystem');
  });

  it('should handle invalid server installation', async () => {
    const result = await runCLI('mcp install nonexistent-server', env.path);

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('not found');
  });

  it('should prevent duplicate server installation', async () => {
    // Install server first time
    await runCLI('mcp install filesystem', env.path);

    // Try to install again
    const result = await runCLI('mcp install filesystem', env.path);

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('already installed');
  });
});
```

---

## Error Handling Testing

### Input Validation

```typescript
describe('E2E: Input Validation', () => {
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

  it('should handle invalid command gracefully', async () => {
    const result = await runCLI('invalid-command', env.path);

    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/unknown command|not recognized/i);
  });

  it('should validate required parameters', async () => {
    const result = await runCLI('run feature', env.path); // Missing description

    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/description.*required|missing.*description/i);
  });

  it('should handle malformed options', async () => {
    const invalidOptions = [
      'run feature --invalid-flag',
      'init --name=', // Empty name
      'checkout ""', // Empty branch name
      'agent list --json=invalid'
    ];

    for (const command of invalidOptions) {
      const result = await runCLI(command, env.path);
      expect(result.success, `Command should fail: ${command}`).toBe(false);
    }
  });
});
```

### Environment Error Handling

```typescript
describe('E2E: Environment Error Handling', () => {
  it('should handle missing git gracefully', async () => {
    const env = await createTestEnvironment(); // No git initialization

    // Try git-dependent operation
    const result = await runCLI('run feature --description="Test"', env.path);

    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/git.*not.*found|not.*git.*repository/i);

    await env.cleanup();
  });

  it('should handle non-APEX project', async () => {
    const env = await createTestEnvironment(); // No APEX initialization

    const result = await runCLI('agent list', env.path);

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('not an APEX project');

    await env.cleanup();
  });

  it('should handle permission errors', async () => {
    const env = await createTestEnvironment();

    // Create read-only directory
    const readOnlyDir = path.join(env.path, 'readonly');
    await fs.mkdir(readOnlyDir);
    await fs.chmod(readOnlyDir, 0o444);

    try {
      const result = await runCLI('init --yes', readOnlyDir);

      expect(result.success).toBe(false);
      expect(result.stderr).toMatch(/permission.*denied|access.*denied/i);
    } finally {
      // Clean up
      await fs.chmod(readOnlyDir, 0o755);
      await env.cleanup();
    }
  });
});
```

---

## Performance Testing

### Command Execution Time

```typescript
describe('E2E: Performance Testing', () => {
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

  it('should execute help command quickly', async () => {
    const startTime = Date.now();

    const result = await runCLI('--help', env.path);

    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should initialize project within reasonable time', { timeout: 30000 }, async () => {
    const startTime = Date.now();

    const result = await runCLI('init --yes', env.path);

    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(20000); // Should complete within 20 seconds

    console.log(`Project initialization took ${duration}ms`);
  });

  it('should handle large agent list efficiently', async () => {
    // Create many agents for performance testing
    const manyAgents = Array.from({ length: 50 }, (_, i) => ({
      name: `agent-${i}`,
      description: `Test agent number ${i}`,
      tools: ['Read', 'Write'],
      model: 'sonnet'
    }));

    await seedTestData(env, { agents: manyAgents });

    const startTime = Date.now();
    const result = await runCLI('agent list', env.path);
    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(10000); // Should handle 50 agents within 10 seconds

    // Verify all agents are listed
    const agentCount = (result.stdout.match(/agent-\d+/g) || []).length;
    expect(agentCount).toBe(50);
  });
});
```

### Memory Usage Testing

```typescript
describe('E2E: Memory Usage', () => {
  function getMemoryUsage() {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024); // MB
  }

  it('should not leak memory during repeated operations', async () => {
    const initialMemory = getMemoryUsage();
    let env: TestEnvironment;

    try {
      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        env = await createTestEnvironment({
          initGit: true,
          initApexProject: true
        });

        await runCLI('agent list', env.path);
        await runCLI('status', env.path);

        await env.cleanup();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50);

      console.log(`Memory usage: ${initialMemory}MB → ${finalMemory}MB (+${memoryIncrease}MB)`);
    } finally {
      if (env) await env.cleanup();
    }
  });
});
```

---

## Integration Testing

### Orchestrator Integration

```typescript
describe('E2E: Orchestrator Integration', () => {
  let env: TestEnvironment;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });
    await seedTestData(env, SEED_SCENARIOS.full);

    orchestrator = new ApexOrchestrator({ projectRoot: env.path });
    globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should integrate CLI with orchestrator', async () => {
    // Create task through CLI
    const cliResult = await runCLI('run feature --description="Test feature"', env.path);
    expect(cliResult.success).toBe(true);

    // Verify task exists in orchestrator
    const tasks = await orchestrator.listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe('Test feature');
    expect(tasks[0].type).toBe('feature');
  });

  it('should handle task lifecycle through CLI', async () => {
    // Start workflow
    const startResult = await runCLI('run feature --description="Integration test"', env.path);
    expect(startResult.success).toBe(true);

    // Check status
    const statusResult = await runCLI('status', env.path);
    expect(statusResult.success).toBe(true);
    expect(statusResult.stdout).toContain('Integration test');

    // List tasks
    const listResult = await runCLI('task list', env.path);
    expect(listResult.success).toBe(true);
    expect(listResult.stdout).toContain('Integration test');
  });
});
```

### API Server Integration

```typescript
describe('E2E: API Server Integration', () => {
  let env: TestEnvironment;
  let server: FastifyInstance;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });

    // Start API server
    server = await createTestAPIServer(env.path);
    globalThis.apexE2EHelpers.registerServer(server);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should serve API endpoints correctly', async () => {
    // Test health endpoint
    const healthResponse = await fetch('http://localhost:3000/health');
    expect(healthResponse.ok).toBe(true);

    const healthData = await healthResponse.json();
    expect(healthData.status).toBe('healthy');
  });

  it('should integrate CLI with API server', async () => {
    // Start server through CLI
    const serveResult = await runCLI('serve --port=3001', env.path, {
      timeout: 10000
    });

    // Server should start successfully
    expect(serveResult.success).toBe(true);
    expect(serveResult.stdout).toContain('Server running on port 3001');

    // Test API endpoint
    await globalThis.apexE2EHelpers.waitFor(
      async () => {
        try {
          const response = await fetch('http://localhost:3001/api/status');
          return response.ok;
        } catch {
          return false;
        }
      },
      { timeout: 15000, description: 'API server to be ready' }
    );
  });
});
```

---

## Cross-Platform Testing

### Platform-Specific Commands

```typescript
describe('E2E: Cross-Platform Compatibility', () => {
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

  it('should handle platform-specific paths', async () => {
    const isWindows = process.platform === 'win32';

    // Create file with platform-appropriate path
    const fileName = 'test-file.txt';
    const filePath = path.join(env.path, fileName);

    await fs.writeFile(filePath, 'test content');

    // Verify file exists using cross-platform path
    expect(fs.existsSync(filePath)).toBe(true);

    // Test CLI command with file path
    const result = await runCLI(`status`, env.path);
    expect(result.success).toBe(true);
  });

  it('should execute commands with proper shell', async () => {
    const result = await runCLI('--version', env.path);

    expect(result.success).toBe(true);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);

    // Command should work regardless of platform
    expect(result.exitCode).toBe(0);
  });

  it('should handle line endings correctly', async () => {
    // Create file with content
    const testFile = path.join(env.path, 'line-endings.txt');
    await fs.writeFile(testFile, 'Line 1\nLine 2\nLine 3\n');

    // Read file back
    const content = await fs.readFile(testFile, 'utf8');

    // Should maintain consistent line endings
    const lines = content.split('\n').filter(line => line.length > 0);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Line 1');
    expect(lines[1]).toBe('Line 2');
    expect(lines[2]).toBe('Line 3');
  });
});
```

---

## Advanced Patterns

### Test Fixtures and Data Factories

```typescript
// Test data factories
class TestDataFactory {
  static createAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
    return {
      name: 'test-agent',
      description: 'Test agent for E2E testing',
      tools: ['Read', 'Write'],
      model: 'sonnet',
      ...overrides
    };
  }

  static createWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
    return {
      name: 'test-workflow',
      stages: ['planning', 'implementation'],
      description: 'Test workflow',
      ...overrides
    };
  }

  static createComplexProject(): SeedData {
    return {
      agents: [
        this.createAgent({ name: 'developer', tools: ['Read', 'Write', 'Edit', 'Bash'] }),
        this.createAgent({ name: 'reviewer', tools: ['Read', 'Grep'] }),
        this.createAgent({ name: 'tester', tools: ['Read', 'Bash'] })
      ],
      workflows: [
        this.createWorkflow({ name: 'feature', stages: ['planning', 'implementation', 'testing', 'review'] }),
        this.createWorkflow({ name: 'bugfix', stages: ['investigation', 'fix', 'testing'] })
      ],
      files: [
        { path: 'src/app.ts', content: 'export const app = "test";' },
        { path: 'tests/app.test.ts', content: 'test("app", () => { expect(true).toBe(true); });' }
      ]
    };
  }
}

// Usage in tests
describe('E2E: Using Test Factories', () => {
  it('should work with factory-created data', async () => {
    await seedTestData(env, TestDataFactory.createComplexProject());

    const result = await runCLI('agent list', env.path);
    expect(result.stdout).toContain('developer');
    expect(result.stdout).toContain('reviewer');
    expect(result.stdout).toContain('tester');
  });
});
```

### Page Object Model for CLI

```typescript
// CLI command abstraction
class ApexCLI {
  constructor(private workingDir: string) {}

  async version(): Promise<string> {
    const result = await runCLI('--version', this.workingDir);
    if (!result.success) throw new Error(`Version command failed: ${result.stderr}`);
    return result.stdout.trim();
  }

  async init(options: { name?: string; yes?: boolean } = {}): Promise<void> {
    let command = 'init';
    if (options.name) command += ` --name="${options.name}"`;
    if (options.yes) command += ' --yes';

    const result = await runCLI(command, this.workingDir);
    if (!result.success) throw new Error(`Init command failed: ${result.stderr}`);
  }

  async listAgents(): Promise<AgentDefinition[]> {
    const result = await runCLI('agent list --json', this.workingDir);
    if (!result.success) throw new Error(`List agents failed: ${result.stderr}`);
    return JSON.parse(result.stdout);
  }

  async runFeature(description: string): Promise<string> {
    const result = await runCLI(`run feature --description="${description}"`, this.workingDir);
    if (!result.success) throw new Error(`Run feature failed: ${result.stderr}`);
    return result.stdout;
  }
}

// Usage in tests
describe('E2E: CLI Page Object', () => {
  let env: TestEnvironment;
  let cli: ApexCLI;

  beforeEach(async () => {
    env = await createTestEnvironment();
    cli = new ApexCLI(env.path);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should use CLI abstraction', async () => {
    // Initialize project
    await cli.init({ name: 'Test Project', yes: true });

    // Seed data
    await seedTestData(env, SEED_SCENARIOS.full);

    // List agents
    const agents = await cli.listAgents();
    expect(agents).toHaveLength(2);

    // Run feature
    const output = await cli.runFeature('Add authentication');
    expect(output).toContain('feature');
  });
});
```

---

## Test Templates

### CLI Command Test Template

```typescript
/**
 * Template for testing CLI commands
 * Copy and modify for new command tests
 */
describe('E2E: [Command Name] Command', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,                    // Set based on command requirements
      initApexProject: true,           // Set based on command requirements
      apexOptions: {
        includeAgents: true,           // Set based on test needs
        includeWorkflows: true         // Set based on test needs
      }
    });

    // Seed appropriate test data
    await seedTestData(env, SEED_SCENARIOS.full);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Happy Path', () => {
    it('should execute command successfully', async () => {
      const result = await runCLI('[command] [args]', env.path);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('[expected output]');
      expect(result.stderr).toBe('');
    });

    it('should support command options', async () => {
      const result = await runCLI('[command] --option=value', env.path);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('[option-specific output]');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing arguments', async () => {
      const result = await runCLI('[command]', env.path);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('[error message]');
    });

    it('should handle invalid options', async () => {
      const result = await runCLI('[command] --invalid-option', env.path);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('[error message]');
    });
  });

  describe('Integration', () => {
    it('should integrate with other components', async () => {
      // Test integration with orchestrator, git, etc.
      const result = await runCLI('[command] [args]', env.path);
      expect(result.success).toBe(true);

      // Verify side effects
      // Check file changes, git state, database, etc.
    });
  });
});
```

### Git Workflow Test Template

```typescript
/**
 * Template for testing git workflows
 * Copy and modify for new workflow tests
 */
describe('E2E: [Workflow Name] Git Workflow', () => {
  let env: TestEnvironment;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });
    await seedTestData(env, SEED_SCENARIOS.git);

    orchestrator = new ApexOrchestrator({ projectRoot: env.path });
    globalThis.apexE2EHelpers.registerOrchestrator(orchestrator);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('Workflow Execution', () => {
    it('should execute workflow successfully', async () => {
      const result = await runCLI('[workflow command]', env.path);

      expect(result.success).toBe(true);

      // Verify git state
      const currentBranch = getCurrentBranch(env.path);
      expect(currentBranch).toBe('[expected branch]');

      // Verify workflow progress
      const tasks = await orchestrator.listTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('[expected status]');
    });
  });

  describe('Branch Management', () => {
    it('should manage branches correctly', async () => {
      // Test branch creation, switching, merging
    });
  });

  describe('Conflict Resolution', () => {
    it('should handle merge conflicts', async () => {
      // Test conflict detection and resolution
    });
  });
});
```

---

## Summary

These examples and patterns provide:

1. **Comprehensive test coverage** - Examples for all major APEX functionality
2. **Proven patterns** - Battle-tested approaches to common testing scenarios
3. **Error handling** - Robust error testing and validation
4. **Performance testing** - Guidelines for testing execution time and resource usage
5. **Cross-platform compatibility** - Patterns that work across different operating systems
6. **Advanced patterns** - Sophisticated testing techniques for complex scenarios
7. **Reusable templates** - Copy-paste templates for new test development

Use these examples as starting points for your own E2E tests, adapting them to your specific testing needs while following the established patterns and best practices.

For more information:
- [E2E Testing Guide](./e2e.md)
- [E2E Best Practices](./e2e-best-practices.md)
- [Contributing E2E Tests](./contributing-e2e-tests.md)
- [E2E Utilities API](./e2e-utilities-api.md)