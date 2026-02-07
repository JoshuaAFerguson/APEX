# E2E Tests Documentation

This directory contains end-to-end tests for APEX CLI commands using real git repositories and orchestrator integration.

## Quick Start

To run E2E tests locally:

```bash
# Build the CLI first (required for E2E tests)
npm run build

# Run all E2E tests once
npm run test:e2e

# Run E2E tests in watch mode for development
npm run test:e2e:watch

# Run specific E2E test file
npm test -- tests/e2e/browse-marketplace.e2e.test.ts
```

**Requirements:**
- Node.js 18+ (check with `node --version`)
- Git available in PATH (check with `git --version`)
- CLI must be built first (`npm run build`)

## Environment Setup

### Prerequisites

1. **Git Installation**: E2E tests require git for repository operations
   ```bash
   # Verify git is available
   git --version
   ```

2. **CLI Build**: E2E tests execute the actual CLI binary
   ```bash
   # Build all packages including CLI
   npm run build

   # Verify CLI is built
   ls packages/cli/dist/index.js
   ```

3. **Dependencies**: Install all project dependencies
   ```bash
   npm install
   ```

### Environment Variables

E2E tests automatically set:
- `NODE_ENV=test`
- `APEX_TEST_MODE=e2e`

Optional debugging:
```bash
# Enable debug output during tests
DEBUG=1 npm run test:e2e
```

## Infrastructure

The E2E test infrastructure provides:

### Global Setup and Teardown
- **`setup.ts`**: Global setup hooks for temporary directory management, git repository scaffolding, and resource cleanup
- **`teardown.ts`**: Global teardown for final resource cleanup and orphaned process management
- **`infrastructure-verification.test.ts`**: Verification tests for the E2E testing infrastructure itself

### Test Configuration
- **Root vitest.e2e.config.ts**: Optimized for E2E tests with extended timeouts, global setup/teardown, and proper test isolation
- **Environment**: Node.js environment for backend/CLI testing
- **Timeouts**: 60s for tests, 30s for hooks to handle real-world operations
- **Process Pool**: Forked processes for test isolation
- **Retry Policy**: 2 retries in CI for flaky real-world operations

### Global Test Helpers
Available via `globalThis.apexE2EHelpers`:
- `createTempDir(prefix)`: Create isolated temporary directories
- `createTempGitRepo(prefix)`: Create initialized git repositories
- `createBareGitRepo(prefix)`: Create bare git repositories for remote simulation
- `createApexProject(path, options)`: Create complete APEX project structures
- `waitFor(condition, options)`: Extended timeout waiting utility
- `registerOrchestrator/Server/Store(resource)`: Resource cleanup registration
- `cleanupAll()`: Force cleanup of all registered resources

### Usage
```bash
npm run test:e2e              # Run E2E tests once
npm run test:e2e:watch        # Watch mode
```

All E2E tests automatically get:
- Temporary directory isolation
- Git repository management
- Resource cleanup (orchestrators, servers, databases)
- Extended timeouts for real-world operations
- Global helper utilities

## Temporary Directory Management

### `.apex-test` Directory Purpose

**Important**: The `.apex-test` directory is **NOT** used by E2E tests. It is created by cleanup utility tests in `tests/integration/cleanup-utilities*.test.ts` to verify that the cleanup scripts work correctly.

E2E tests use the system's temporary directory (via `os.tmpdir()`) for isolation:
- **E2E temp directories**: `os.tmpdir()/apex-e2e-*` (auto-cleaned by test framework)
- **`.apex-test` directory**: Used only for testing cleanup utilities themselves

### E2E Test Directory Structure

E2E tests create temporary directories like:
```
/tmp/apex-e2e-xyz123/          # Test isolation directory
├── .apex/                     # APEX project config
│   ├── config.yaml
│   ├── agents/
│   └── workflows/
├── .git/                      # Git repository
└── test files...
```

Each test gets its own isolated directory that is automatically cleaned up after the test completes.

## Cleanup Mechanisms

APEX provides three tiers of cleanup for different scenarios:

### 1. Automatic Test Cleanup (Primary)

**E2E Test Framework**: Built into `tests/e2e/setup.ts`
- Automatically cleans up after each test
- Handles temp directories, git repos, databases, orchestrators
- Uses `globalThis.apexE2EHelpers.cleanupAll()`
- **You don't need to manually clean these**

### 2. Manual Cleanup Scripts (Secondary)

**Cross-platform cleanup scripts** for manual use:

```bash
# Automatic cleanup (finds and removes all .apex-test directories)
npm run cleanup:test

# Platform-specific scripts
npm run cleanup:test:shell     # Unix/Linux/macOS
npm run cleanup:test:windows   # Windows
```

**What they clean:**
- `.apex-test` directories (created by cleanup utility tests)
- Handles permission issues gracefully
- Provides detailed logging

### 3. Manual File System Cleanup (Last Resort)

If automatic cleanup fails, manually remove directories:

```bash
# Unix/Linux/macOS
rm -rf .apex-test
find . -name ".apex-test" -type d -exec rm -rf {} +

# Windows
rmdir /s .apex-test
for /d /r . %d in (.apex-test) do @if exist "%d" rmdir /s /q "%d"
```

### Cleanup Best Practices

1. **Run tests normally** - automatic cleanup usually works
2. **Use cleanup scripts** if you see leftover `.apex-test` directories
3. **Check permissions** if cleanup fails (especially on Windows)
4. **Manual cleanup** only as last resort

## Troubleshooting

### Common Issues

**"CLI binary not found"**:
```bash
# Solution: Build the project first
npm run build
```

**"Git not found in PATH"**:
```bash
# Solution: Install git and ensure it's in PATH
git --version
```

**Tests hanging or timing out**:
- Check if ports are already in use
- Ensure no previous test processes are running
- Try running tests individually to isolate issues

**Permission errors during cleanup**:
```bash
# Run platform-specific cleanup
npm run cleanup:test
```

### Debug Mode

Enable detailed logging during tests:
```bash
DEBUG=1 npm run test:e2e
```

This preserves console output and shows detailed test execution information.

## Browse MCP Marketplace E2E Tests

### File: `browse-marketplace.e2e.test.ts`

Comprehensive end-to-end tests for the APEX MCP marketplace browse command functionality with real CLI execution.

#### Test Coverage

##### 1. Successful Browse Operations
- **Basic browse execution**: Verifies that `mcp list` command executes successfully and returns marketplace content
- **Formatted output validation**: Tests proper formatting with categories, icons, and server information
- **Statistics display**: Verifies server count and verified server statistics are shown correctly

##### 2. JSON Output Support
- **JSON flag handling**: Tests `--json` flag produces valid JSON output with proper structure
- **Flag position flexibility**: Verifies `--json` works in different argument positions
- **Data integrity**: Ensures JSON output contains all required server properties with correct types
- **Output consistency**: Validates that multiple runs produce identical results

##### 3. Empty Marketplace Handling
- **Graceful empty handling**: Tests behavior when no MCP servers are available in marketplace
- **No servers message**: Verifies appropriate messaging when marketplace is empty
- **Error resilience**: Ensures command doesn't crash on empty or unavailable marketplace

##### 4. User Guidance and Help
- **Marketplace commands help**: Tests display of helpful guidance commands (search, install, etc.)
- **Fresh directory behavior**: Tests command behavior in directories without APEX initialization
- **Error messaging**: Verifies informative error messages for various failure scenarios

##### 5. Network and Timeout Handling
- **Timeout handling**: Ensures command completes within reasonable timeouts
- **Network error handling**: Tests graceful handling of network/loading failures
- **Template loading failures**: Verifies helpful error messages when marketplace is unavailable

#### Key Features

##### Real CLI Execution
- Uses actual CLI binary (`packages/cli/dist/index.js`) via child_process
- Executes real `mcp list` commands with various flags and arguments
- Tests command parsing, argument handling, and output formatting
- Verifies timeout handling and error conditions

##### APEX Project Integration
- Tests within initialized APEX projects (via `apex init --yes`)
- Verifies command works correctly with project configuration
- Tests behavior in fresh directories without initialization
- Uses temporary project directories for test isolation

##### Comprehensive Output Verification
- Validates formatted text output with proper icons and categories
- Verifies JSON output structure and data types
- Tests error message content and helpfulness
- Checks for consistent behavior across multiple runs

#### Test Structure

Each test follows this pattern:
1. **Setup**: Create temporary directory and initialize APEX project
2. **Execute**: Run `mcp list` command with various flags via CLI
3. **Verify**: Check command output, JSON structure, error handling, and formatting
4. **Cleanup**: Remove temporary directories automatically

#### Running the Tests

These tests are included in the main test suite and can be run with:

```bash
npm run test                                           # All tests
npm test -- tests/e2e/browse-marketplace.e2e.test.ts  # Just browse marketplace tests
```

#### Requirements

- Node.js must be available in PATH for CLI execution
- CLI package must be built (`packages/cli/dist/index.js` must exist)
- Tests create temporary directories in system temp location
- Each test runs in isolation with fresh APEX projects
- Tests clean up temporary files automatically

#### Timeout Considerations

These tests involve real CLI execution and marketplace network requests. The test framework is configured with appropriate timeouts for CLI operations (30 seconds per command).

## Merge Command E2E Tests

### File: `merge-command.test.ts`

Comprehensive end-to-end tests for the APEX merge command functionality with real git operations.

#### Test Coverage

##### 1. Standard Merge Operations
- **Standard merge with merge commit**: Verifies that a standard merge creates a proper merge commit and preserves branch history
- **Squash merge with single commit**: Verifies that squash merge combines all commits into a single commit without creating a merge commit
- **Main branch update verification**: Ensures that merges correctly update the main branch with all changes from feature branches

##### 2. Merge Conflict Detection and Handling
- **Conflict detection**: Tests that merge conflicts are properly detected when merging conflicting branches
- **Squash merge conflicts**: Verifies conflict handling works correctly for squash merges
- **Repository cleanup**: Ensures that failed merges properly abort and leave the repository in a clean state

##### 3. Merge After Push Sequence
- **Remote push workflow**: Tests merging feature branches that have been pushed to remote repositories
- **Complete push workflow**: Verifies the full workflow from feature creation through merge and remote push
- **Squash merge in push workflow**: Tests squash merging within remote repository workflows

##### 4. Error Cases and Edge Conditions
- **Missing branch handling**: Tests behavior when attempting to merge tasks without associated branches
- **Non-existent branch handling**: Verifies error handling for invalid branch names
- **Dirty working directory**: Tests merge behavior with uncommitted changes
- **Repository integrity**: Ensures git repository remains in valid state after failed operations

#### Key Features

##### Real Git Operations
- Uses actual git repositories created in temporary directories
- Performs real git commands (commit, branch, merge, push, etc.)
- Verifies git state using standard git commands
- Tests with both bare and working repositories

##### Orchestrator Integration
- Tests through the actual `ApexOrchestrator.mergeTaskBranch()` method
- Verifies task storage and retrieval
- Tests logging and event emission
- Uses real APEX configuration files

##### Comprehensive Verification
- Verifies file existence and content after merges
- Checks git commit history and branch states
- Validates merge commit creation vs squash behavior
- Tests error messages and conflict handling

#### Test Structure

Each test follows this pattern:
1. **Setup**: Create temporary git repository with APEX configuration
2. **Prepare**: Create test tasks and feature branches with realistic changes
3. **Execute**: Perform merge operations through the orchestrator
4. **Verify**: Check git state, files, commit history, and expected outcomes
5. **Cleanup**: Remove temporary directories and orchestrator instances

#### Running the Tests

These tests are included in the main test suite and can be run with:

```bash
npm run test                                   # All tests
npm test -- tests/e2e/merge-command.test.ts   # Just merge tests
```

#### Requirements

- Git must be installed and available in PATH
- Tests create temporary directories in system temp location
- Each test runs in isolation with fresh git repositories
- Tests clean up temporary files automatically

#### Timeout Considerations

These tests involve real git operations and may take longer than unit tests. The test framework is configured with appropriate timeouts for git operations (30 seconds per command).