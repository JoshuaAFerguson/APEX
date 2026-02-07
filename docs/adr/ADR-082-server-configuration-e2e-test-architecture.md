# ADR-082: Server Configuration E2E Test - Technical Architecture

## Status
Proposed

## Context

This ADR provides the technical architecture for implementing an E2E test for the server configuration happy path. The test must verify the complete configuration workflow from prompts to persistence.

### Acceptance Criteria
1. Test verifies: configure command prompts for required settings
2. Configuration is saved to correct location (.apex/config.yaml)
3. Default values work correctly
4. Custom values are persisted

### Relationship to Existing Tests

This test complements:
- ADR-078: Server Selection E2E Test Architecture
- ADR-079: Server Installation E2E Test Architecture
- Existing CLI tests in `tests/e2e/cli.e2e.test.ts`

## Technical Design

### 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐
│              Server Configuration E2E Test Architecture                         │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────┐    ┌──────────────────────┐    ┌───────────────────┐  │
│  │   Test Context      │    │   CLI Execution      │    │   Verification    │  │
│  │                     │    │                        │    │   Layer           │  │
│  │  - createTempDir()  │    │  - runCli('init')     │    │                   │  │
│  │  - apexE2EHelpers   │───▶│  - runCli('config')   │───▶│  - assertConfig   │  │
│  │  - beforeEach/      │    │  - runCli('config     │    │  - assertDefaults │  │
│  │    afterEach        │    │     --set/--get')     │    │  - assertPersist  │  │
│  └─────────────────────┘    └──────────────────────┘    └───────────────────┘  │
│           │                          │                          │               │
│           ▼                          ▼                          ▼               │
│  ┌────────────────────────────────────────────────────────────────────────────┐│
│  │                          CLI Layer Commands                                  ││
│  │  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐  ││
│  │  │ apex init    │  │ apex config      │  │ apex config --set/--get      │  ││
│  │  │ --yes        │──│ (display)        │──│ (modify/retrieve values)     │  ││
│  │  │ --name       │  │ --json           │  │                              │  ││
│  │  └──────────────┘  └──────────────────┘  └──────────────────────────────┘  ││
│  └────────────────────────────────────────────────────────────────────────────┘│
│           │                          │                          │               │
│           ▼                          ▼                          ▼               │
│  ┌────────────────────────────────────────────────────────────────────────────┐│
│  │                         File System Output                                   ││
│  │  ┌──────────────────────────────────────────────────────────────────────┐  ││
│  │  │  .apex/config.yaml                                                    │  ││
│  │  │  ├── version: "0.1.0"                                                 │  ││
│  │  │  ├── project:                                                         │  ││
│  │  │  │   ├── name: <project-name>                                         │  ││
│  │  │  │   ├── language: <language>                                         │  ││
│  │  │  │   └── framework: <framework>                                       │  ││
│  │  │  ├── autonomy:                                                        │  ││
│  │  │  │   └── level: <autonomy-level>                                      │  ││
│  │  │  ├── models:                                                          │  ││
│  │  │  │   ├── planning: sonnet                                             │  ││
│  │  │  │   ├── implementation: sonnet                                       │  ││
│  │  │  │   └── review: sonnet                                               │  ││
│  │  │  ├── limits:                                                          │  ││
│  │  │  │   ├── maxTokensPerTask: 100000                                     │  ││
│  │  │  │   ├── maxCostPerTask: 2.0                                          │  ││
│  │  │  │   └── dailyBudget: 50                                              │  ││
│  │  │  └── api:                                                             │  ││
│  │  │      ├── port: 3000                                                   │  ││
│  │  │      └── autoStart: false                                             │  ││
│  │  └──────────────────────────────────────────────────────────────────────┘  ││
│  └────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 2. Test File Location

The E2E test will be located at:
```
tests/e2e/server-configuration.e2e.test.ts
```

This follows the existing E2E test patterns established in:
- `tests/e2e/cli.e2e.test.ts`
- `tests/e2e/server-selection.e2e.test.ts`
- `tests/e2e/server-installation.e2e.test.ts`

### 3. Core Test Scenarios

#### 3.1 Configuration Prompt Testing

Tests that configuration prompts work correctly during initialization:

```typescript
describe('Configuration Prompts', () => {
  it('should prompt for required settings during init', async () => {
    // Use apex init with defaults
    const { stdout } = await runCli('init --yes', testDir);

    // Verify config was created
    expect(await fileExists(configPath)).toBe(true);
  });

  it('should accept command-line options for project settings', async () => {
    await runCli('init --yes --name my-project --language typescript', testDir);

    const config = await readConfig(testDir);
    expect(config.project.name).toBe('my-project');
    expect(config.project.language).toBe('typescript');
  });
});
```

#### 3.2 Configuration Location Verification

Tests that configuration is saved to the correct location:

```typescript
describe('Configuration Location', () => {
  it('should save configuration to .apex/config.yaml', async () => {
    await runCli('init --yes', testDir);

    const configPath = path.join(testDir, '.apex', 'config.yaml');
    expect(await fs.stat(configPath).then(() => true).catch(() => false)).toBe(true);
  });

  it('should create complete .apex directory structure', async () => {
    await runCli('init --yes', testDir);

    const apexDir = path.join(testDir, '.apex');
    const agentsDir = path.join(apexDir, 'agents');
    const workflowsDir = path.join(apexDir, 'workflows');

    expect(await fs.stat(apexDir).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.stat(agentsDir).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.stat(workflowsDir).then(() => true).catch(() => false)).toBe(true);
  });
});
```

#### 3.3 Default Values Testing

Tests that default values are applied correctly:

```typescript
describe('Default Values', () => {
  it('should apply default project name from directory', async () => {
    await runCli('init --yes', testDir);

    const config = await readConfig(testDir);
    expect(config.project.name).toBeTruthy();
  });

  it('should apply default autonomy level', async () => {
    await runCli('init --yes', testDir);

    const config = await readConfig(testDir);
    expect(config.autonomy?.level).toBe('review-before-commit');
  });

  it('should apply default model configurations', async () => {
    await runCli('init --yes', testDir);

    const config = await readConfig(testDir);
    expect(config.models?.planning).toBe('sonnet');
    expect(config.models?.implementation).toBe('sonnet');
    expect(config.models?.review).toBe('sonnet');
  });

  it('should apply default resource limits', async () => {
    await runCli('init --yes', testDir);

    const config = await readConfig(testDir);
    expect(config.limits?.maxTokensPerTask).toBeGreaterThan(0);
    expect(config.limits?.maxCostPerTask).toBeGreaterThan(0);
    expect(config.limits?.dailyBudget).toBeGreaterThan(0);
  });
});
```

#### 3.4 Custom Value Persistence

Tests that custom values are properly persisted:

```typescript
describe('Custom Value Persistence', () => {
  it('should persist custom project name', async () => {
    await runCli('init --yes --name custom-project', testDir);

    const config = await readConfig(testDir);
    expect(config.project.name).toBe('custom-project');

    // Verify persisted in file
    const configContent = await fs.readFile(configPath, 'utf-8');
    expect(configContent).toContain('custom-project');
  });

  it('should persist configuration changes via config --set', async () => {
    await runCli('init --yes', testDir);

    // Modify configuration
    await runCli('config --set limits.maxCostPerTask=5.0', testDir);

    // Verify change was persisted
    const { stdout } = await runCli('config --get limits.maxCostPerTask', testDir);
    expect(stdout.trim()).toBe('5');
  });

  it('should persist multiple configuration values', async () => {
    await runCli('init --yes --name test-proj --language typescript', testDir);

    // Modify via config command
    await runCli('config --set limits.dailyBudget=100', testDir);
    await runCli('config --set autonomy.level=full-auto', testDir);

    // Verify all values persisted correctly
    const config = await readConfig(testDir);
    expect(config.project.name).toBe('test-proj');
    expect(config.project.language).toBe('typescript');
    expect(config.limits?.dailyBudget).toBe(100);
  });

  it('should preserve existing config when modifying values', async () => {
    await runCli('init --yes --name original-project', testDir);

    // Set a new value
    await runCli('config --set limits.maxCostPerTask=10', testDir);

    // Verify original value is preserved
    const config = await readConfig(testDir);
    expect(config.project.name).toBe('original-project');
    expect(config.limits?.maxCostPerTask).toBe(10);
  });
});
```

### 4. Helper Functions

```typescript
/**
 * Read and parse APEX config file
 */
async function readConfig(projectDir: string): Promise<ApexConfig> {
  const configPath = path.join(projectDir, '.apex', 'config.yaml');
  const configContent = await fs.readFile(configPath, 'utf-8');
  return yaml.parse(configContent) as ApexConfig;
}

/**
 * Run CLI command with proper environment
 */
async function runCli(args: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  const CLI_PATH = path.join(__dirname, '../../packages/cli/dist/index.js');

  return execAsync(`node "${CLI_PATH}" ${args}`, {
    cwd,
    env: {
      ...process.env,
      NO_COLOR: '1',
      APEX_TEST_MODE: 'e2e',
      NODE_ENV: 'test'
    },
    timeout: 30000,
  });
}

/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  return fs.stat(filePath).then(() => true).catch(() => false);
}
```

### 5. Test Setup and Teardown

```typescript
describe('E2E: Server Configuration Happy Path', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create isolated temp directory
    testDir = await globalThis.apexE2EHelpers.createTempDir('server-config-e2e-');
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  // Test suites...
});
```

### 6. Integration Points

The test integrates with:
1. **CLI Package** (`packages/cli`): Tests CLI commands via child process execution
2. **Core Package** (`packages/core`): Validates config schemas and file formats
3. **E2E Test Infrastructure** (`tests/e2e/setup.ts`): Uses global test helpers

### 7. Expected Test Output

```
✓ E2E: Server Configuration Happy Path
  ✓ Configuration Prompts
    ✓ should prompt for required settings during init
    ✓ should accept command-line options for project settings
  ✓ Configuration Location
    ✓ should save configuration to .apex/config.yaml
    ✓ should create complete .apex directory structure
  ✓ Default Values
    ✓ should apply default project name from directory
    ✓ should apply default autonomy level
    ✓ should apply default model configurations
    ✓ should apply default resource limits
  ✓ Custom Value Persistence
    ✓ should persist custom project name
    ✓ should persist configuration changes via config --set
    ✓ should persist multiple configuration values
    ✓ should preserve existing config when modifying values
```

## Consequences

### Positive
- Comprehensive E2E test coverage for server configuration
- Validates complete configuration workflow from init to persistence
- Tests both default and custom value scenarios
- Uses established E2E testing patterns from the codebase

### Negative
- E2E tests are slower than unit tests
- Relies on file system operations which can be flaky
- Requires CLI to be built before running tests

### Risks
- File system race conditions in parallel test execution (mitigated by isolated temp directories)
- CLI output format changes could break assertions (mitigated by flexible pattern matching)

## Implementation Plan

1. Create test file at `tests/e2e/server-configuration.e2e.test.ts`
2. Implement helper functions for config reading and CLI execution
3. Implement test suites for each acceptance criterion
4. Add to E2E test configuration
5. Verify all tests pass locally
6. Document any edge cases discovered

## References

- Existing CLI E2E tests: `tests/e2e/cli.e2e.test.ts`
- E2E test setup: `tests/e2e/setup.ts`
- CLI implementation: `packages/cli/src/index.ts`
- Config handling: `packages/core/src/config.ts`
