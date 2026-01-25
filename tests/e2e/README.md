# E2E Tests Documentation

This directory contains end-to-end tests for APEX CLI commands using real git repositories and orchestrator integration.

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