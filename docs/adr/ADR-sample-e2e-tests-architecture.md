# ADR: Sample E2E Test Architecture for CLI Init and Run Commands

## Status
**Proposed** | Date: 2025-02-07

## Context

The task requires adding sample E2E tests that demonstrate the existing E2E test infrastructure with:
1. CLI `init` command tests
2. Task creation flow tests (via `run` command)
3. Tests using seeding utilities and environment isolation
4. Tests that pass in CI environments

The existing infrastructure is already comprehensive. This ADR documents the architectural approach for creating **sample/demonstration tests** that showcase the infrastructure's capabilities.

## Analysis of Existing Infrastructure

### Available Test Utilities (from `tests/e2e/`)

| Utility | Location | Purpose |
|---------|----------|---------|
| `createTestEnvironment()` | `tests/e2e/utils/test-utilities.ts` | Creates isolated temp directories with optional git/APEX init |
| `cleanupTestEnvironment()` | `tests/e2e/utils/test-utilities.ts` | Cleans up all registered test resources |
| `runCLI()` | `tests/e2e/utils/test-utilities.ts` | Executes CLI commands in test environment |
| `seedTestData()` | `tests/e2e/utils/test-utilities.ts` | Seeds environments with test data |
| `SEED_SCENARIOS` | `tests/e2e/utils/test-utilities.ts` | Pre-defined seed data (minimal, full, mcp, git) |
| `createTempDir()` | `tests/e2e/setup.ts` | Creates unique temporary directories |
| `createTempGitRepo()` | `tests/e2e/setup.ts` | Creates git repos for testing |
| `createApexProject()` | `tests/e2e/setup.ts` | Creates minimal APEX project structure |
| `waitFor()` | `tests/e2e/setup.ts` | Async polling with timeout |
| `runApexCLI()` | `tests/e2e/helpers/cli-test-helpers.ts` | Enhanced CLI execution with result typing |
| `assertCLISuccess()` | `tests/e2e/helpers/cli-test-helpers.ts` | Assertion helper for CLI results |
| `quickStart()` | `tests/e2e/index.ts` | Fast setup with seeded test environment |

### Existing E2E Tests Reference

- `tests/e2e/cli.e2e.test.ts` - Comprehensive CLI command tests (init, agents, workflows, config, status)
- `packages/cli/src/__tests__/run.e2e.test.ts` - Run command E2E tests with task creation
- `tests/e2e/infrastructure-verification.test.ts` - Infrastructure smoke tests

### Configuration

- Vitest E2E config: `vitest.e2e.config.ts`
- Setup file: `tests/e2e/setup.ts` (loaded via `setupFiles`)
- Teardown: `tests/e2e/teardown.ts`
- Environment variables: `APEX_TEST_MODE=e2e`, `NODE_ENV=test`

## Technical Design

### Sample Test File Structure

Create a new sample E2E test file that demonstrates best practices:

```
tests/e2e/sample-cli-e2e.test.ts
```

### Test Cases to Implement

#### 1. CLI Init Command Tests (Acceptance Criterion 1)

```typescript
describe('Sample E2E: CLI Init Command', () => {
  it('should initialize a project using test utilities', async () => {
    // Uses: createTestEnvironment(), runCLI(), seedTestData()
    // Verifies: .apex directory structure, config.yaml, agents, workflows
  });

  it('should handle re-initialization gracefully', async () => {
    // Uses: quickStart() for seeded environment
    // Verifies: Warning message, no data loss
  });
});
```

#### 2. Task Creation Flow Tests (Acceptance Criterion 2)

```typescript
describe('Sample E2E: Task Creation Flow', () => {
  it('should create a task via run command with dry-run mode', async () => {
    // Uses: createTestEnvironment() with initApexProject: true
    // Uses: runCLI() with --dry-run flag
    // Verifies: Task created in SQLite, correct status
  });

  it('should store task in database after run command', async () => {
    // Uses: SEED_SCENARIOS.full for complete setup
    // Verifies: Database record exists, fields populated correctly
  });
});
```

#### 3. Seeding and Isolation Demonstration (Acceptance Criterion 3)

```typescript
describe('Sample E2E: Seeding and Isolation', () => {
  it('should demonstrate seed scenarios', async () => {
    // Uses: SEED_SCENARIOS (minimal, full, mcp, git)
    // Shows: Different project configurations
  });

  it('should demonstrate environment isolation', async () => {
    // Uses: Multiple concurrent createTestEnvironment() calls
    // Verifies: Complete isolation between tests
  });
});
```

### Integration Patterns

#### Pattern 1: Quick Setup with Seeding
```typescript
import { quickStart, runCLI } from '../e2e';

const env = await quickStart('full');
const result = await runCLI('status', env.path);
expect(result.success).toBe(true);
await env.cleanup();
```

#### Pattern 2: Custom Configuration
```typescript
import { createTestEnvironment, seedTestData, SEED_SCENARIOS } from '../e2e';

const env = await createTestEnvironment({
  initGit: true,
  initApexProject: true,
  apexOptions: { projectName: 'custom-test' }
});
await seedTestData(env, SEED_SCENARIOS.mcp);
```

#### Pattern 3: Database Verification
```typescript
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(env.path, '.apex', 'apex.db');
const db = new Database(dbPath, { readonly: true });
const tasks = db.prepare('SELECT * FROM tasks').all();
expect(tasks.length).toBeGreaterThan(0);
db.close();
```

### CI Environment Considerations (Acceptance Criterion 4)

1. **Timeouts**: Extended timeouts (60s test, 30s hooks) via `vitest.e2e.config.ts`
2. **Retries**: Automatic retry (2x) in CI via `retry: process.env.CI ? 2 : 0`
3. **Isolation**: Forked process pool with `maxForks: 4`
4. **Cleanup**: Global teardown ensures no resource leaks
5. **Dry-run mode**: Avoids Claude API calls with `--dry-run` flag

### File Naming Conventions

- Files in `tests/e2e/` use pattern: `*.test.ts` or `*.e2e.test.ts`
- Sample file: `sample-cli-e2e.test.ts` follows this convention

## Decision

Create a single, well-documented sample E2E test file (`tests/e2e/sample-cli-e2e.test.ts`) that:

1. **Demonstrates all core utilities**: `createTestEnvironment`, `runCLI`, `seedTestData`, `SEED_SCENARIOS`
2. **Tests CLI init command**: Using proper isolation and verification
3. **Tests task creation flow**: Using run command with dry-run mode
4. **Showcases best practices**: Proper cleanup, assertions, CI compatibility
5. **Serves as documentation**: Extensive comments explaining each pattern

## Consequences

### Positive
- Clear reference implementation for future E2E tests
- Validates existing infrastructure works correctly
- Provides template for developers writing new E2E tests
- Acceptance criteria are explicitly verified

### Negative
- Additional test file to maintain (minimal overhead)
- Some duplication with existing tests (intentional for demonstration)

## Implementation Notes

The developer stage should:
1. Create `tests/e2e/sample-cli-e2e.test.ts` following this architecture
2. Use only existing infrastructure (no new utilities needed)
3. Include comprehensive JSDoc comments
4. Ensure all tests pass with `npm run test:e2e`
5. Verify build passes with `npm run build`

## References

- Existing CLI E2E tests: `tests/e2e/cli.e2e.test.ts`
- Run command E2E tests: `packages/cli/src/__tests__/run.e2e.test.ts`
- E2E test utilities: `tests/e2e/utils/test-utilities.ts`
- E2E setup: `tests/e2e/setup.ts`
- Vitest E2E config: `vitest.e2e.config.ts`
