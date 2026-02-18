# ADR-120: MCP Server Uninstall Integration Tests Architecture

## Status
**Accepted**

## Date
2025-01-24

## Context

The APEX CLI includes an MCP server `uninstall` subcommand (within `/mcp uninstall <server-name>`) that removes server configurations from `.apex/config.yaml`. The acceptance criteria for this task require integration tests verifying:

1. Uninstall removes server files/config
2. Uninstalling non-existent server is handled gracefully
3. Confirmation prompts work correctly
4. Cleanup is complete

After thorough analysis of the existing codebase, **comprehensive test coverage already exists** across two test files:

- **`mcp-marketplace-uninstall.test.ts`** (243 lines, 11 test cases) - Unit-level tests covering the uninstall command handler
- **`mcp-install-uninstall-integration.test.ts`** (501 lines, ~12 test cases) - Integration tests covering install/uninstall workflows, config integrity, error recovery, and validation

## Decision

### Architecture Assessment: Existing Coverage Analysis

#### Acceptance Criteria Mapping

| Criteria | Covered By | Test Cases |
|----------|------------|------------|
| Uninstall removes server files/config | `mcp-marketplace-uninstall.test.ts` (L92-108), `mcp-install-uninstall-integration.test.ts` (L180-208) | `should uninstall a server after confirmation`, `should preserve existing config structure when removing MCP server` |
| Non-existent server handled gracefully | `mcp-marketplace-uninstall.test.ts` (L147-156, L158-172, L174-184) | `should handle non-existent server`, `should handle no MCP servers installed`, `should handle missing MCP config` |
| Confirmation prompts work correctly | `mcp-marketplace-uninstall.test.ts` (L92-108, L110-118) | `should uninstall a server after confirmation`, `should cancel uninstall when not confirmed` |
| Cleanup is complete | `mcp-marketplace-uninstall.test.ts` (L231-242, L186-194, L196-219) | `should show configuration removal notice`, `should show remaining servers count`, `should handle last server uninstall` |

#### Existing Test Architecture

```
packages/cli/src/__tests__/
├── mcp-marketplace-uninstall.test.ts        # Unit-level: Command handler behavior
│   ├── Uninstall with confirmation          ✅
│   ├── Cancel uninstall                     ✅
│   ├── Find server by name vs ID            ✅
│   ├── Require server name                  ✅
│   ├── Handle non-existent server           ✅
│   ├── Handle no MCP servers installed      ✅
│   ├── Handle missing MCP config            ✅
│   ├── Show remaining servers count         ✅
│   ├── Handle last server uninstall         ✅
│   ├── Handle uninstall errors              ✅
│   └── Show configuration removal notice    ✅
│
└── mcp-install-uninstall-integration.test.ts # Integration: Full workflows
    ├── Config File Integrity Tests
    │   ├── Preserve config on adding server      ✅
    │   ├── Preserve config on removing server    ✅
    │   ├── Handle malformed MCP config           ✅
    │   └── Handle missing MCP section            ✅
    ├── Install/Uninstall Workflow Tests
    │   ├── Full install-then-uninstall workflow   ✅
    │   └── Multiple servers sequential install   ✅
    ├── Error Recovery and Edge Cases
    │   ├── Config save failures                  ✅
    │   ├── Config load failures                  ✅
    │   ├── Case-insensitive name matching        ✅
    │   ├── Special characters in names           ✅
    │   └── Extremely long server names           ✅
    └── Validation and Data Integrity
        ├── Invalid server configuration          ✅
        ├── Duplicate server prevention           ✅
        ├── Empty server name                     ✅
        └── Whitespace-only server name           ✅
```

### Technical Design for Gaps (If Any)

While existing coverage is comprehensive, the following minor enhancements could strengthen the test suite if needed by subsequent stages:

#### 1. Concurrent Uninstall Operations

Test that concurrent uninstalls don't corrupt config:

```typescript
it('should handle concurrent uninstall requests safely', async () => {
  // Setup: Multiple servers installed
  // Action: Trigger two uninstalls concurrently
  // Assert: Both complete without config corruption
});
```

#### 2. Array-Format Server Configs

The `getMCPServers()` function supports both `Record<string, MCPServerConfig>` and `MCPServerConfig[]` formats. Testing uninstall with array-format configs:

```typescript
it('should uninstall from array-format server config', async () => {
  const configWithArrayServers = {
    ...baseConfig,
    mcp: {
      enabled: true,
      servers: [
        { name: 'array-server', type: 'stdio', command: 'test', args: [], autoStart: true }
      ],
    },
  };
  // Verify getMCPServers normalizes correctly for uninstall
});
```

#### 3. Post-Uninstall Verification

Verify the saved config after uninstall has the exact expected shape:

```typescript
it('should produce valid ApexConfig after uninstall', async () => {
  // Verify the config written by saveConfig() passes Zod validation
  const savedConfig = mockSaveConfig.mock.calls[0][1];
  expect(() => ApexConfigSchema.parse(savedConfig)).not.toThrow();
});
```

### Testing Patterns (Established)

The tests follow these established patterns from the codebase:

1. **Mock Strategy**: `vi.mock()` for chalk, inquirer, and `@apexcli/core` functions
2. **Context Pattern**: `CliContext` with `{ cwd, initialized }` minimum
3. **Command Discovery**: `commands.find(cmd => cmd.name === 'mcp')`
4. **Handler Invocation**: `mcpCommand.handler(mockContext, ['uninstall', 'server-name'])`
5. **Output Verification**: `expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(...))`
6. **Config Verification**: Inspect `mockSaveConfig.mock.calls[0][1]` for saved config state

### Interface Contracts

```typescript
// Input: CLI handler interface
interface UninstallInput {
  context: CliContext;         // { cwd: string, initialized: boolean }
  args: ['uninstall', string]; // subcommand + server name
}

// External Dependencies (mocked in tests)
interface UninstallDependencies {
  loadConfig(cwd: string): Promise<ApexConfig>;
  saveConfig(cwd: string, config: ApexConfig): Promise<void>;
  getMCPServers(config: ApexConfig): Record<string, MCPServerConfig>;
  inquirer.prompt(questions: Question[]): Promise<{ confirm: boolean }>;
}

// Observable Outputs
interface UninstallOutputs {
  consoleLog: string[];        // Colored output messages
  configSaved: ApexConfig;     // Updated config (via saveConfig mock)
  promptShown: Question[];     // Confirmation prompt (via inquirer mock)
}
```

### Implementation Flow (As Tested)

```
┌─────────────────────┐
│ CLI Handler Entry    │  args: ['uninstall', serverName]
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Validate serverName  │  → Error if missing
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ loadConfig(ctx.cwd)  │  → Error if load fails
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ getMCPServers(config)│  → Warning if no servers
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Find server by       │  1. Exact key match
│ key or name          │  2. Name property match
│                      │  → Error if not found
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Confirm with user    │  inquirer.prompt (confirm: boolean)
│                      │  → Cancel if not confirmed
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Delete from config   │  delete normalizedServers[serverKey]
│ + saveConfig()       │  config.mcp.servers = normalizedServers
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Display success +    │  Server name, remaining count
│ remaining info       │  or "no servers installed"
└─────────────────────┘
```

## Consequences

### Positive
- Existing test suite already covers all acceptance criteria
- Tests are well-structured following established project patterns
- Both unit and integration levels are covered
- Error paths and edge cases are thoroughly tested
- No new test infrastructure needed

### Negative
- None significant; existing tests are comprehensive

### Risks Mitigated
- Configuration corruption during uninstall (tested via config integrity tests)
- Race conditions with config operations (partially addressed)
- User experience issues with missing/wrong servers (edge case tests)

## Verification

All acceptance criteria are satisfied by existing tests:

- [x] Tests verify: uninstall removes server files/config (`mcp-marketplace-uninstall.test.ts` L92-108, L231-242)
- [x] Uninstalling non-existent server handled gracefully (`mcp-marketplace-uninstall.test.ts` L147-184)
- [x] Confirmation prompts work correctly (`mcp-marketplace-uninstall.test.ts` L92-118)
- [x] Cleanup is complete (`mcp-marketplace-uninstall.test.ts` L186-242, integration test L180-208)

## Recommendation for Developer Stage

The developer stage should:
1. **Verify** that all existing tests pass (`npm run test` in `packages/cli`)
2. **Optionally enhance** with the gap tests identified above (concurrent operations, array-format configs, schema validation)
3. **Not duplicate** existing test coverage

## References

- `packages/cli/src/__tests__/mcp-marketplace-uninstall.test.ts` - Unit tests
- `packages/cli/src/__tests__/mcp-install-uninstall-integration.test.ts` - Integration tests
- `packages/cli/src/index.ts` (L3080-3164) - Uninstall command implementation
- `packages/core/src/config.ts` (L430-443) - `getMCPServers()` function
- ADR-004: MCP Testing Architecture
- ADR-0007: MCP Integration Test Architecture
