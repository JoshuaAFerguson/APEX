# ADR: MCP Marketplace CLI E2E Happy Path Tests

## Status
Accepted

## Context
We need to implement E2E happy path tests for the MCP marketplace CLI that cover the complete flow:
1. Browse marketplace (list command)
2. Search/select a server
3. Install a server
4. Configure server (validate configuration)
5. Verify working (status/installed commands)

The tests must use the existing E2E test infrastructure from `tests/e2e/setup.ts` and follow the patterns established in `cli.e2e.test.ts`.

## Decision

### Architecture Overview

```
tests/e2e/
├── setup.ts                              # Existing - Global E2E helpers
├── cli.e2e.test.ts                       # Existing - CLI E2E pattern reference
└── mcp-marketplace.e2e.test.ts           # NEW - MCP marketplace E2E tests
```

### Testing Approach: Real CLI Execution via Child Process

We will follow the same pattern as `cli.e2e.test.ts`:
- Execute the actual CLI binary (`node packages/cli/dist/index.js`) via `child_process`
- Use real filesystem operations (temp directories with `.apex/` project structure)
- Verify actual config file changes on disk (YAML read/write)
- Use `NO_COLOR=1` to strip ANSI codes for assertion matching

This approach tests the **real integration** between:
- CLI argument parsing
- Template loading from `packages/core/templates/mcp/*.yaml`
- Config read/write to `.apex/config.yaml`
- MCP server config normalization

### Key Design Decisions

#### 1. No Mocking - True E2E
Unlike unit tests in `packages/cli/src/__tests__/` which mock `chalk`, `inquirer`, `@apexcli/core` etc., these E2E tests execute the real CLI binary. This validates the complete integration stack.

#### 2. Non-Interactive Mode Only
Since E2E tests run via `child_process.exec()`, they cannot interact with `inquirer` prompts. We test only non-interactive subcommands:
- `mcp list` / `mcp list --json`
- `mcp search <query>` / `mcp search <query> --json`
- `mcp install <server>`
- `mcp installed`
- `mcp validate`
- `mcp status`

Note: `mcp uninstall` requires confirmation prompt, so we test it by pre-configuring the config file and using the validate/status commands to verify state.

#### 3. Real Template Loading
Tests rely on the actual MCP templates in `packages/core/templates/mcp/`:
- `filesystem.yaml` - Filesystem Server (verified, auto-start: true)
- `memory.yaml` - Memory Server (verified, auto-start: false)
- `fetch.yaml` - Fetch Server
- `github.yaml` - GitHub Server (has sensitive env vars)
- `postgres.yaml` - PostgreSQL Server (has required env vars)
- `brave-search.yaml` - Brave Search Server

This ensures templates are valid and loadable.

#### 4. Config File Verification
After install operations, we read `.apex/config.yaml` directly to verify:
- Server entry was added to `mcp.servers`
- Server config matches template (name, type, command, args)
- Environment variables are properly initialized
- Auto-start settings are correctly applied

#### 5. JSON Output for Assertions
Where possible, use `--json` flag for machine-readable output assertions. This avoids brittle string matching against formatted/colored terminal output.

### Test Structure

```typescript
describe('E2E: MCP Marketplace Happy Path', () => {
  // Setup: Create temp dir, init APEX project, build CLI

  describe('Browse Marketplace', () => {
    it('should list all available MCP servers')
    it('should list servers in JSON format')
    it('should show server details (categories, tags)')
  })

  describe('Search & Select Server', () => {
    it('should search by name')
    it('should search by tag')
    it('should search by category')
    it('should return JSON search results')
    it('should handle no-match searches gracefully')
  })

  describe('Install Server', () => {
    it('should install server from marketplace template')
    it('should create proper config entry')
    it('should handle env vars from template')
    it('should detect duplicate installation')
    it('should handle non-existent template gracefully')
  })

  describe('Verify Configuration', () => {
    it('should validate installed server config')
    it('should show server in installed list')
    it('should show server in status output')
  })

  describe('Complete Happy Path Flow', () => {
    it('should complete: list → search → install → installed → validate → status')
    it('should support installing multiple servers')
  })
})
```

### Data Flow in E2E Tests

```
1. createTempDir() → /tmp/apex-e2e-mcp-xxx/
2. runCli('init --yes') → Creates .apex/ project structure
3. runCli('mcp list --json') → Reads templates from packages/core/templates/mcp/
4. runCli('mcp search filesystem --json') → Filters templates
5. runCli('mcp install filesystem') → Writes to .apex/config.yaml
6. fs.readFile('.apex/config.yaml') → Verify config on disk
7. runCli('mcp installed') → Shows installed server from config
8. runCli('mcp validate') → Validates the config structure
9. runCli('mcp status') → Shows server status info
```

### Helper Utilities Needed

```typescript
// Run CLI with proper paths and env
async function runCli(args: string, cwd: string): Promise<{stdout: string, stderr: string}>

// Read and parse YAML config file
async function readApexConfig(projectDir: string): Promise<any>

// Verify a server is in the config
function assertServerInConfig(config: any, serverId: string, expectedFields?: Partial<MCPServerConfig>): void
```

### Error Handling Strategy

- Tests use try/catch in `runCli` to capture both stdout and stderr on failure
- Assertions verify error messages contain expected guidance text
- `NO_COLOR=1` env var ensures no ANSI escape codes in output
- 30-second timeout per CLI command (consistent with existing E2E tests)

### Prerequisites

- `npm run build` must be run before E2E tests (CLI binary must exist at `packages/cli/dist/index.js`)
- Templates must exist at `packages/core/templates/mcp/`
- Tests use the E2E vitest config (`vitest.e2e.config.ts`) with 60s test timeout

## Consequences

### Positive
- Tests validate the complete integration stack without mocks
- Real template loading catches template schema issues early
- Config file verification ensures YAML serialization works correctly
- JSON output testing is robust against formatting changes
- Follows established patterns from existing E2E tests

### Negative
- Tests depend on build output (must run `npm run build` first)
- Slower than unit tests (spawns real processes, does file I/O)
- Cannot test interactive flows (inquirer prompts)
- Template changes could break tests (acceptable - tests should catch breaking changes)

### Risks Mitigated
- Integration bugs between CLI, core config, and template loading
- YAML parsing/serialization issues
- Template schema validation failures
- MCP config normalization edge cases
- CLI argument parsing for MCP subcommands

## Implementation Notes for Developer Stage

1. Create `tests/e2e/mcp-marketplace.e2e.test.ts`
2. Follow the `runCli()` helper pattern from `cli.e2e.test.ts`
3. Use `beforeEach` to create temp project dirs with `apex init --yes`
4. Leverage `--json` flag for structured assertion matching
5. For config verification, parse YAML with the `yaml` package
6. Ensure cleanup in `afterEach` to remove temp dirs
7. The `vitest.e2e.config.ts` already includes `tests/e2e/**/*.test.ts` pattern
