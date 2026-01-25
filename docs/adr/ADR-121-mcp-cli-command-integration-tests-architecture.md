# ADR-121: MCP CLI Command Integration Tests Architecture

## Status
**Accepted**

## Date
2025-01-24

## Context

The task requires implementing MCP CLI command integration tests covering:
1. Listing marketplace servers
2. Installing servers
3. Configuring servers
4. Checking server status
5. Uninstalling servers

After thorough architectural analysis, the existing codebase **already contains comprehensive integration test coverage** for all acceptance criteria. This ADR documents the existing architecture, validates coverage alignment, and provides recommendations.

## Decision

### Existing Test Architecture Analysis

The MCP CLI integration tests follow a **3-tier test organization** pattern:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Acceptance Tests                                    │
│  mcp-commands-acceptance.test.ts - Direct acceptance criteria tests   │
├──────────────────────────────────────────────────────────────────────┤
│                   Integration Tests                                   │
│  mcp-commands-integration.test.ts     - Cross-command workflows       │
│  mcp-install-uninstall-integration.test.ts - Install/uninstall flow   │
│  mcp-status-integration.test.ts       - Status command integration    │
│  mcp-marketplace-integration.test.ts  - Full marketplace workflow     │
│  mcp-workflow-integration.test.ts     - End-to-end command workflow    │
├──────────────────────────────────────────────────────────────────────┤
│                    Unit & Edge Case Tests                              │
│  mcp-command.test.ts, mcp-add-command.test.ts, etc.                  │
│  mcp-edge-cases.test.ts, mcp-edge-cases-comprehensive.test.ts       │
└──────────────────────────────────────────────────────────────────────┘
```

### Acceptance Criteria Coverage Map

| Acceptance Criterion | Primary Test File(s) | Coverage Status |
|---------------------|---------------------|-----------------|
| Listing marketplace servers | `mcp-commands-acceptance.test.ts`, `mcp-commands-integration.test.ts`, `mcp-marketplace-list.integration.test.ts` | ✅ Complete |
| Installing servers | `mcp-install-uninstall-integration.test.ts`, `mcp-install-command-integration.test.ts`, `mcp-marketplace-install.test.ts` | ✅ Complete |
| Configuring servers | `mcp-init-command.test.ts`, `mcp-workflow-integration.test.ts`, `mcp-validate-command.test.ts` | ✅ Complete |
| Checking server status | `mcp-status-integration.test.ts` | ✅ Complete |
| Uninstalling servers | `mcp-install-uninstall-integration.test.ts`, `mcp-marketplace-uninstall.test.ts` | ✅ Complete |
| Command output verification | All above + `mcp-list-json.test.ts`, `mcp-search-json.test.ts` | ✅ Complete |
| Side effects verification | `mcp-install-uninstall-integration.test.ts` (config file mutations) | ✅ Complete |

### Technical Design Patterns

#### 1. Mock Strategy (Consistent Across All Tests)

```typescript
// Chalk mocking for deterministic output testing
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => `CYAN:${str}`,
    red: (str: string) => `RED:${str}`,
    green: (str: string) => `GREEN:${str}`,
    yellow: (str: string) => `YELLOW:${str}`,
    gray: (str: string) => `GRAY:${str}`,
    blue: (str: string) => `BLUE:${str}`,
  },
}));

// Core module mocking for controlled behavior
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadMCPTemplates: vi.fn(),
    getMCPTemplate: vi.fn(),
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    getMCPServers: vi.fn(),
    validateMCPConfig: vi.fn(),
  };
});

// Interactive prompt mocking
vi.mock('inquirer', () => ({
  default: { prompt: vi.fn() },
}));
```

#### 2. Context Setup Pattern

```typescript
interface CliContext {
  cwd: string;
  initialized: boolean;
  config?: ApexConfig;
}

const mockContext: CliContext = {
  cwd: '/test/project',
  initialized: true,
  config: {
    project: { name: 'Test', description: 'Test' },
    agents: {},
    workflows: {},
    limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
    autonomy: { level: 'medium', autoApprove: false },
    mcp: { enabled: true, servers: {} },
  },
};
```

#### 3. Command Invocation Pattern

```typescript
const { commands } = await import('../index.js');
const mcpCommand = commands.find(cmd => cmd.name === 'mcp');
await mcpCommand?.handler(mockContext, ['subcommand', ...args]);
```

#### 4. Output Assertion Patterns

```typescript
// Console output capture
const mockConsoleLog = vi.spyOn(console, 'log');

// Pattern 1: Exact match with color prefix
expect(mockConsoleLog).toHaveBeenCalledWith(
  expect.stringContaining('GREEN:✅ Successfully added MCP server')
);

// Pattern 2: Aggregate output analysis
const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
expect(allOutput).toContain('Filesystem Server');

// Pattern 3: JSON output verification
const jsonOutput = JSON.parse(mockConsoleLog.mock.calls[0][0]);
expect(Array.isArray(jsonOutput)).toBe(true);
```

#### 5. Side Effect Verification Pattern

```typescript
// Verify config was saved with correct structure
expect(mockSaveConfig).toHaveBeenCalled();
const savedConfig = mockSaveConfig.mock.calls[0][1];
expect(savedConfig.mcp.servers['filesystem']).toEqual(template.config);
expect(savedConfig.mcp.enabled).toBe(true);

// Verify Zod schema validation passes
expect(() => ApexConfigSchema.parse(savedConfig)).not.toThrow();
```

### File Architecture

```
packages/cli/src/__tests__/
├── mcp-commands-acceptance.test.ts         # Direct acceptance criteria validation
├── mcp-commands-integration.test.ts        # Cross-command consistency tests
├── mcp-commands-comprehensive.test.ts      # Comprehensive command coverage
├── mcp-commands-edge-cases.test.ts         # Edge case handling
│
├── mcp-marketplace-integration.test.ts     # Full workflow: search → install → list → uninstall
├── mcp-marketplace-list.integration.test.ts # List marketplace servers
├── mcp-marketplace-search.test.ts          # Search functionality
├── mcp-marketplace-install.test.ts         # Install from marketplace
├── mcp-marketplace-installed.test.ts       # Show installed servers
├── mcp-marketplace-uninstall.test.ts       # Uninstall servers
│
├── mcp-install-command-integration.test.ts # Install command integration
├── mcp-install-cli-integration.test.ts     # CLI-level install integration
├── mcp-install-simple.test.ts              # Simple install tests
├── mcp-install-uninstall-integration.test.ts # Install/uninstall lifecycle
│
├── mcp-status-integration.test.ts          # Status command integration
├── mcp-workflow-integration.test.ts        # Full workflow: init → add → validate → list
├── mcp-init-command.test.ts                # Interactive MCP setup
│
├── mcp-validate-command.test.ts            # Validation tests
├── mcp-validate-command-enhanced.test.ts   # Enhanced validation
├── mcp-validate-command.edge-cases.test.ts # Validation edge cases
├── mcp-validate-e2e.test.ts               # End-to-end validation
│
├── mcp-command.test.ts                     # Basic command structure
├── mcp-command.integration.test.ts         # Template loading integration
├── mcp-templates-cli-integration.test.ts   # Template management
├── mcp-add-command.test.ts                 # Add/install command
├── mcp-add-integration.test.ts             # Add integration
├── mcp-add-command-edge-cases.test.ts      # Add edge cases
│
├── mcp-list-command-enhanced.test.ts       # Enhanced list command
├── mcp-list-json.test.ts                   # JSON output for list
├── mcp-search-json.test.ts                 # JSON output for search
├── mcp-installed-cli-formatting.test.ts    # Output formatting
│
├── mcp-edge-cases.test.ts                  # General edge cases
└── mcp-edge-cases-comprehensive.test.ts    # Comprehensive edge cases
```

### Key Integration Test Scenarios

#### Listing Marketplace Servers (`mcp-commands-acceptance.test.ts`, `mcp-marketplace-list.integration.test.ts`)
- Display all available templates in formatted table
- Show template details (name, description, capabilities, verified status)
- Handle empty marketplace gracefully
- Support `--json` output format
- Handle template loading errors

#### Installing Servers (`mcp-install-uninstall-integration.test.ts`)
- Complete install workflow with config persistence
- Preserve existing config structure when adding servers
- Handle missing MCP section creation
- Handle malformed config gracefully
- Prevent duplicate server installation
- Handle empty/whitespace server names
- Handle config save failures
- Support sequential multi-server installation

#### Configuring Servers (`mcp-init-command.test.ts`, `mcp-workflow-integration.test.ts`)
- Interactive MCP setup wizard
- Template-based server configuration
- Environment variable setup and validation
- Capability configuration
- Config file generation and persistence

#### Checking Server Status (`mcp-status-integration.test.ts`)
- Display running/stopped/error states with color coding
- Show server configuration details (command, args, autoStart)
- Handle no servers installed
- Handle disabled MCP
- Handle uninitialized APEX project
- Consistent output formatting

#### Uninstalling Servers (`mcp-install-uninstall-integration.test.ts`, `mcp-marketplace-uninstall.test.ts`)
- Full uninstall workflow with confirmation prompt
- Preserve remaining servers and custom config sections
- Handle concurrent uninstall requests
- Handle filesystem errors during save
- Handle array-format server configs
- Verify config integrity post-uninstall

### Test Infrastructure

- **Framework**: Vitest (globals: true, environment: node for CLI tests)
- **Coverage**: V8 provider with 70% thresholds (branches, functions, lines, statements)
- **Configuration**: Root `vitest.config.ts` with environment-specific matching
- **Patterns**: Module-level mocking, console.log spying, async handler testing

## Consequences

### Positive
1. **Complete coverage** - All 5 acceptance criteria are fully covered by existing tests
2. **Comprehensive edge cases** - Error handling, concurrent operations, malformed data
3. **Consistent patterns** - Uniform mock strategy, assertion patterns, and test organization
4. **Side effect verification** - Config persistence mutations are thoroughly tested
5. **JSON output support** - Both human-readable and machine-readable outputs tested

### Neutral
1. Tests rely on internal command structure (`commands.find(cmd => cmd.name === 'mcp')`)
2. Mock-based testing (no real filesystem or process spawning for CLI integration)

### Risks Mitigated
1. Config corruption during install/uninstall operations
2. Missing error messages for edge cases
3. Output formatting inconsistencies across commands
4. Data loss when modifying config files

## Notes for Next Stages

1. **No new test files needed** - Existing coverage is comprehensive
2. **Build/test verification required** - Developer stage should run `npm run build` and `npm run test` to verify all existing tests pass
3. **If tests fail** - May indicate code-level issues in the MCP command handler that need fixing, not test gaps
4. **Configuration testing** - The `mcp init` interactive wizard tests rely on `inquirer` mocking; if the UI changes, tests need updating

## References
- ADR-004: MCP Testing Architecture (orchestrator-level)
- ADR-001: MCP Server Templates
- ADR-120: MCP Uninstall Integration Tests Architecture
- ADR-071: MCP Marketplace E2E Test Infrastructure
