# E2E Test Utilities

This directory contains utility functions for E2E testing that meet the acceptance criteria requirements.

## Core Utilities (Acceptance Criteria)

### `createTestEnvironment()`
Creates isolated temporary directories for E2E tests with optional git and APEX project initialization.

```typescript
import { createTestEnvironment } from './test-utilities';

// Basic temp directory
const env = await createTestEnvironment();

// Full APEX project with git
const env = await createTestEnvironment({
  initGit: true,
  initApexProject: true,
  apexOptions: { projectName: 'my-test' }
});
```

### `cleanupTestEnvironment()`
Cleans up all registered test resources including temp directories, databases, orchestrators, and servers.

```typescript
import { cleanupTestEnvironment } from './test-utilities';

// Clean up after tests
await cleanupTestEnvironment();
```

### `runCLI()`
Helper to execute CLI commands in test environments with proper error handling and output capture.

```typescript
import { runCLI } from './test-utilities';

const result = await runCLI('init --yes', env.path);
expect(result.success).toBe(true);

const jsonResult = await runCLI('mcp list --json', env.path, {
  timeout: 60000
});
```

### Seed Utilities
Utilities for populating test environments with realistic test data.

```typescript
import { seedTestData, SEED_SCENARIOS } from './test-utilities';

// Seed with default data
await seedTestData(env);

// Use predefined scenarios
await seedTestData(env, SEED_SCENARIOS.mcp);
await seedTestData(env, SEED_SCENARIOS.git);
await seedTestData(env, SEED_SCENARIOS.minimal);
```

## Additional Utilities

### MCP Test Utils (`mcp-test-utils.ts`)
Specialized utilities for testing MCP marketplace features:
- CLI execution with JSON parsing
- Config file manipulation
- Server management
- Assertion helpers

### CLI Test Helpers (`../helpers/cli-test-helpers.ts`)
Low-level CLI execution utilities:
- `runApexCLI()` - Execute APEX CLI commands
- `initApexProject()` - Initialize APEX projects
- `parseJSONOutput()` - Parse CLI JSON output
- `assertCLISuccess()` / `assertCLIFailure()` - Test assertions

## Quick Start

```typescript
// Import main utilities
import {
  createTestEnvironment,
  runCLI,
  seedTestData,
  SEED_SCENARIOS,
  quickStart
} from '../tests/e2e';

describe('My E2E Test', () => {
  it('should work with full setup', async () => {
    // Quick start with full environment
    const env = await quickStart('full');

    // Test CLI commands
    const result = await runCLI('agent list', env.path);
    expect(result.success).toBe(true);

    // Cleanup
    await env.cleanup();
  });
});
```

## Test Environment Structure

Each test environment provides:

```typescript
interface TestEnvironment {
  path: string;              // Path to temp directory
  cleanup: () => Promise<void>; // Cleanup function
  hasGit: boolean;           // Git repository initialized
  hasApexProject: boolean;   // APEX project structure created
}
```

## Seed Data Scenarios

- `minimal`: Basic project structure only
- `full`: Complete project with agents, workflows, and files
- `mcp`: MCP-focused setup with server configurations
- `git`: Git-focused setup with source files and .gitignore