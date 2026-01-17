# MCP CLI Commands - Test Architecture Design

## Overview

This document defines the technical architecture for testing the MCP CLI commands in the APEX CLI package. Based on analysis of the existing codebase, there are **3 MCP subcommands** (not 4 as initially mentioned):

1. **`/mcp list`** - Lists available MCP server templates
2. **`/mcp add <server-name>`** - Adds an MCP server to configuration
3. **`/mcp validate`** - Validates MCP configuration

## Current State Analysis

### Existing Test Coverage

| Command | Test File(s) | Status |
|---------|-------------|--------|
| `/mcp list` | `mcp-command.test.ts`, `mcp-command.integration.test.ts`, `mcp-templates-cli-integration.test.ts` | ✅ Comprehensive |
| `/mcp add` | `mcp-add-command.test.ts`, `mcp-add-integration.test.ts` | ✅ Comprehensive |
| `/mcp validate` | `mcp-validate-command.test.ts`, `mcp-validate-command.edge-cases.test.ts`, `mcp-validate-e2e.test.ts` | ✅ Comprehensive |

### Test File Inventory

1. **Unit Tests:**
   - `mcp-command.test.ts` - 30+ tests for list command
   - `mcp-add-command.test.ts` - 25+ tests for add command
   - `mcp-validate-command.test.ts` - 20+ tests for validate command

2. **Integration Tests:**
   - `mcp-command.integration.test.ts` - 10+ tests with real filesystem
   - `mcp-add-integration.test.ts` - 8+ tests with real config operations
   - `mcp-validate-e2e.test.ts` - 5+ end-to-end tests

3. **Edge Case Tests:**
   - `mcp-validate-command.edge-cases.test.ts` - 20+ edge case scenarios
   - `mcp-templates-cli-integration.test.ts` - 13+ integration tests

## Technical Architecture

### 1. Test Structure Pattern

```
packages/cli/src/__tests__/
├── mcp-command.test.ts              # Unit tests for /mcp list
├── mcp-command.integration.test.ts  # Integration tests with filesystem
├── mcp-add-command.test.ts          # Unit tests for /mcp add
├── mcp-add-integration.test.ts      # Integration tests for add
├── mcp-validate-command.test.ts     # Unit tests for /mcp validate
├── mcp-validate-command.edge-cases.test.ts  # Edge cases for validate
├── mcp-validate-e2e.test.ts         # E2E validation tests
├── mcp-templates-cli-integration.test.ts    # Core function integration
└── mcp-command-test-coverage-report.md      # Coverage documentation
```

### 2. Test Categories and Coverage Requirements

#### A. Command Registration Tests
- Verify command exists in `commands` array
- Check command properties: `name`, `aliases`, `description`, `usage`
- Validate handler function signature `(ctx, args)`

#### B. Subcommand Parsing Tests
- Default behavior (no args → list)
- Explicit subcommand (`list`, `add`, `validate`)
- Unknown subcommand handling
- Case-insensitivity (`LIST`, `List`, `list`)
- Empty/null/undefined arguments

#### C. Functional Tests per Command

**`/mcp list`:**
- Template loading from core module
- Display formatting (alignment, colors, emojis)
- Empty templates handling
- Error handling (loading failures)
- Large dataset performance

**`/mcp add <server-name>`:**
- Template retrieval via `getMCPTemplate()`
- Config loading via `loadConfig()`
- Server config creation from template
- Config saving via `saveConfig()`
- Duplicate server detection
- Environment variable handling
- Missing server name error
- Template not found error

**`/mcp validate`:**
- Config loading
- Validation via `validateMCPConfig()`
- Result display (valid/invalid)
- Error/warning/info grouping
- Path and suggestion display
- Disabled MCP handling

#### D. Integration Tests
- Real filesystem operations
- YAML round-trip consistency
- Template file parsing
- Config file persistence
- Error recovery

#### E. Edge Case Tests
- Permission errors (EACCES)
- Missing files (ENOENT)
- Invalid YAML syntax
- Large configurations
- Unicode characters
- Concurrent operations
- Network timeouts

### 3. Mocking Strategy

#### Core Functions to Mock
```typescript
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadMCPTemplates: vi.fn(),
    getMCPTemplate: vi.fn(),
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    validateMCPConfig: vi.fn(),
  };
});
```

#### Console Output Capture
```typescript
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    blue: (str: string) => str,
  },
}));

const mockConsoleLog = vi.spyOn(console, 'log');
```

### 4. Test Data Fixtures

#### Sample MCP Template
```typescript
const sampleTemplate: MCPTemplate = {
  id: 'filesystem',
  name: 'Filesystem Server',
  description: 'MCP server providing secure filesystem access',
  package: '@modelcontextprotocol/server-filesystem',
  config: {
    name: 'filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    autoStart: true,
  },
  capabilities: ['filesystem', 'read', 'write'],
  verified: true,
  defaultEnabled: true,
  documentationUrl: 'https://modelcontextprotocol.io/servers/filesystem',
};
```

#### Sample CLI Context
```typescript
const mockContext: CliContext = {
  cwd: '/test/project',
  initialized: true,
  config: {
    project: { name: 'Test', description: 'Test' },
    agents: {},
    workflows: {},
    limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
    autonomy: { level: 'medium', autoApprove: false },
  },
};
```

### 5. Acceptance Criteria Validation

| Criterion | How Validated |
|-----------|---------------|
| Unit tests for all 3 MCP commands | Test files exist and cover each command |
| Tests verify command output | Console.log assertions on expected strings |
| Tests verify config file changes | saveConfig mock assertions |
| All tests pass with `npm test` | CI/CD verification |

### 6. Dependencies

**From `@apexcli/core`:**
- `loadMCPTemplates()` - Load all MCP templates
- `getMCPTemplate(id)` - Get single template by ID
- `loadConfig(path)` - Load APEX configuration
- `saveConfig(path, config)` - Save APEX configuration
- `validateMCPConfig(config, options)` - Validate MCP config

**Testing Libraries:**
- `vitest` - Test runner and assertions
- `chalk` - Console output formatting (mocked)
- `fs/promises` - Filesystem operations
- `os` - Temp directory creation

### 7. Quality Metrics

**Target Coverage:**
- Line Coverage: >95%
- Branch Coverage: >90%
- Function Coverage: 100%

**Performance Thresholds:**
- Single command execution: <100ms
- Large dataset (100 templates): <500ms
- Many files (20 templates): <2000ms

## Architecture Decision Records

### ADR-001: Test File Organization

**Decision:** Separate test files by command type and test category (unit, integration, edge cases).

**Rationale:**
- Maintainability: Easy to find and update tests for specific functionality
- Parallelization: Tests can run in parallel without conflicts
- Focus: Each file has a clear responsibility

**Consequences:**
- More files to manage
- Clear separation of concerns
- Easier to run subset of tests

### ADR-002: Mocking Strategy

**Decision:** Mock core module functions at the module level using `vi.mock()`.

**Rationale:**
- Isolation: Unit tests don't depend on actual implementations
- Speed: No filesystem or network operations
- Control: Full control over return values and error scenarios

**Consequences:**
- Tests may not catch integration issues
- Need separate integration tests with real implementations
- Mock data must be kept in sync with actual schema

### ADR-003: Console Output Verification

**Decision:** Capture console.log calls and verify specific strings appear.

**Rationale:**
- User Experience: Ensure users see correct messages
- Error Handling: Verify error messages are displayed
- Format Consistency: Ensure consistent formatting

**Consequences:**
- Brittle tests if message format changes
- Need to mock chalk for consistent output
- String matching can be fragile

## Implementation Notes

The existing test suite is **comprehensive and well-structured**. No additional implementation is needed as:

1. All 3 MCP commands have dedicated unit tests
2. Integration tests cover real filesystem operations
3. Edge case tests cover error scenarios
4. Performance tests validate efficiency

The tests follow the established patterns in the APEX CLI package and use the standard vitest testing framework.
