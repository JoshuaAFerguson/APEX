# ADR-051: E2E Tests CI Pipeline Architecture

## Status

Proposed

## Context

The APEX project has a mature E2E test infrastructure including:
- `vitest.e2e.config.ts` - Configuration with 60s test timeouts, forked process isolation, retry logic for CI
- `tests/e2e/setup.ts` - Global helpers for temp directory management, git repo scaffolding, resource tracking
- `tests/e2e/teardown.ts` - Global cleanup for orphaned directories, processes, and database files
- 14+ E2E test files covering CLI commands, git workflows, MCP marketplace, and service management

Currently, the CI workflow (`.github/workflows/ci.yml`) only runs unit tests (`npm test`). E2E tests are not executed in CI, creating a gap in automated verification of end-to-end functionality.

## Decision

We will add a dedicated E2E test job to the CI workflow with the following architecture:

### 1. Separate Job for E2E Tests

E2E tests will run in a separate job from unit tests because:
- E2E tests have longer timeouts (60s per test) and may take 5-10+ minutes total
- E2E tests require different resources (temp directories, git repos, SQLite databases)
- Failure isolation - E2E failures shouldn't block unit test results
- Parallel execution - Unit and E2E tests can run concurrently

### 2. Matrix Configuration

```yaml
e2e:
  runs-on: ${{ matrix.os }}
  strategy:
    fail-fast: false
    matrix:
      os: [ubuntu-latest]
      node-version: [20.x]
```

**Rationale:**
- **Ubuntu only**: E2E tests use Unix-specific commands (process killing, git operations). Windows E2E support requires separate investigation.
- **Node 20.x only**: E2E tests are slower; running on a single stable Node version reduces CI time while maintaining coverage.
- **fail-fast: false**: Ensures all E2E tests complete even if some fail, providing full diagnostic information.

### 3. Environment Variables

```yaml
env:
  CI: true
  APEX_TEST_MODE: e2e
  NO_COLOR: 1
  GIT_AUTHOR_NAME: GitHub Actions
  GIT_AUTHOR_EMAIL: actions@github.com
  GIT_COMMITTER_NAME: GitHub Actions
  GIT_COMMITTER_EMAIL: actions@github.com
```

**Purpose:**
- `CI=true` - Enables retry logic in vitest.e2e.config.ts (`retry: process.env.CI ? 2 : 0`)
- `APEX_TEST_MODE=e2e` - Explicitly marks E2E test context
- `NO_COLOR=1` - Disables color output for cleaner CI logs
- `GIT_*` - Provides git identity for tests that create commits (prevents "please tell me who you are" errors)

### 4. Job Dependencies

```yaml
e2e:
  needs: build
```

E2E tests depend on the build job completing successfully because:
- E2E tests execute the built CLI (`packages/cli/dist/index.js`)
- Tests require compiled TypeScript from all packages
- This ensures we're testing the actual build output

### 5. Cleanup Strategy (Always Runs)

```yaml
- name: Cleanup E2E test resources
  if: always()
  run: |
    # Kill any orphaned processes
    pkill -f "apex" || true
    pkill -f "node.*packages/cli" || true

    # Clean up temp directories
    rm -rf /tmp/apex-e2e-* || true
```

**Rationale:**
- `if: always()` ensures cleanup runs even on test failure or job cancellation
- Prevents resource leaks that could affect subsequent CI runs
- Matches the cleanup logic in `tests/e2e/teardown.ts` but provides an additional safety net

### 6. Workflow File Structure

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    # Existing build job - runs unit tests
    ...

  e2e:
    name: E2E Tests
    needs: build
    runs-on: ${{ matrix.os }}

    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest]
        node-version: [20.x]

    env:
      CI: true
      APEX_TEST_MODE: e2e
      NO_COLOR: 1
      GIT_AUTHOR_NAME: GitHub Actions
      GIT_AUTHOR_EMAIL: actions@github.com
      GIT_COMMITTER_NAME: GitHub Actions
      GIT_COMMITTER_EMAIL: actions@github.com

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e
        timeout-minutes: 15

      - name: Cleanup E2E test resources
        if: always()
        run: |
          # Kill any orphaned processes
          pkill -f "apex" || true
          pkill -f "node.*packages/cli" || true

          # Clean up temp directories
          rm -rf /tmp/apex-e2e-* || true
```

## Technical Design Details

### Test Isolation Mechanisms

The existing E2E infrastructure provides multiple layers of isolation:

1. **Forked Process Pool** (`vitest.e2e.config.ts`):
   ```typescript
   pool: 'forks',
   poolOptions: {
     forks: {
       maxForks: 4,
       minForks: 1,
     },
   },
   ```

2. **Unique Temp Directories** (`tests/e2e/setup.ts`):
   ```typescript
   async function createTempDir(prefix = 'apex-e2e-'): Promise<string> {
     const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
     e2eContext.tempDirs.add(tempDir);
     return tempDir;
   }
   ```

3. **Resource Tracking** (`tests/e2e/setup.ts`):
   - `tempDirs: Set<string>` - Tracks all temp directories
   - `orchestrators: Set` - Tracks orchestrator instances
   - `servers: Set` - Tracks API server instances
   - `stores: Set` - Tracks SQLite database stores
   - `gitRepos: Set` - Tracks git repositories

4. **Global Teardown** (`tests/e2e/teardown.ts`):
   - Cleans orphaned temp directories with `apex-e2e-*` prefix
   - Kills orphaned Node.js processes
   - Verifies SQLite database cleanup
   - Resets environment variables

### Retry Logic for Flaky Tests

The configuration already handles CI-specific retry:
```typescript
// vitest.e2e.config.ts
retry: process.env.CI ? 2 : 0,
bail: process.env.CI ? 1 : 0,
```

### Timeout Configuration

- Individual test timeout: 60 seconds
- Hook timeout: 30 seconds
- Job-level timeout: 15 minutes

## Consequences

### Positive

1. **Automated E2E verification** - Every PR and push to main will run E2E tests
2. **Early detection** - E2E regressions caught before merge
3. **Resource isolation** - Cleanup ensures CI runners remain clean
4. **Parallel execution** - E2E tests run alongside unit tests for faster feedback

### Negative

1. **Increased CI time** - E2E tests may add 5-10 minutes to total CI duration
2. **Resource usage** - E2E tests consume more compute resources than unit tests
3. **Flakiness potential** - Real-world operations (git, filesystem) can be non-deterministic

### Mitigations

- Retry logic (2 retries in CI) handles transient failures
- `fail-fast: false` ensures complete test results even with failures
- Cleanup step prevents resource accumulation across runs

## Implementation Notes

### Files to Create/Modify

1. **Modify**: `.github/workflows/ci.yml`
   - Add `e2e` job with configuration above
   - Ensure proper job dependency ordering

### Testing the Implementation

1. Create a feature branch
2. Update the workflow file
3. Push to trigger CI
4. Verify E2E job runs and completes
5. Verify cleanup step executes even on failure (can test by temporarily introducing a failing test)

## References

- `vitest.e2e.config.ts` - E2E test configuration
- `tests/e2e/setup.ts` - E2E test setup and helpers
- `tests/e2e/teardown.ts` - Global teardown logic
- `.github/workflows/ci.yml` - Existing CI workflow
