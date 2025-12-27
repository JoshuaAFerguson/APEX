# E2E Tests Documentation

This directory contains end-to-end tests for APEX CLI commands using real git repositories and orchestrator integration.

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