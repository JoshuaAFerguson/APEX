# ADR-071: MCP Marketplace E2E Test Infrastructure

## Status
Accepted

## Context

The APEX project needs comprehensive E2E test infrastructure for MCP marketplace integration tests. The existing test infrastructure includes:

1. **Vitest framework** (v4.0.15) with multi-tier configuration (unit, integration, E2E, browser)
2. **E2E test setup** (`tests/e2e/setup.ts`) providing temp dir management, git repo scaffolding, and resource cleanup
3. **Mock MCP server types** (`packages/core/src/mcp/mock-types.ts`) with comprehensive Zod schemas for configurable mock servers
4. **Mock MCP server implementation** (`packages/orchestrator/src/__tests__/utils/mock-mcp-server.ts`) with predefined server configurations
5. **MCP Registry** (`packages/core/src/mcp/mcp-registry.ts`) with catalog loading, filtering, and search
6. **Existing E2E patterns** (`tests/e2e/cli.e2e.test.ts`) using real CLI execution via child_process

The marketplace E2E tests require:
- Test helpers specific to MCP marketplace workflows (list, search, install, configure, verify)
- Mock MCP servers that simulate marketplace-discovered servers
- Fixture data representing marketplace entries with various configurations
- Base utilities that bridge existing E2E infrastructure with MCP-specific needs
- Configuration supporting both unit and E2E test execution modes

## Decision

### Architecture Overview

```
tests/e2e/
├── setup.ts                                    # Existing - Global E2E helpers
├── helpers/
│   └── mcp-e2e-helpers.ts                     # NEW - MCP marketplace E2E helpers
├── fixtures/
│   └── marketplace-data.ts                    # NEW - Marketplace test fixture data
├── mocks/
│   └── mock-marketplace-server.ts             # NEW - Mock MCP server for E2E tests
└── utils/
    └── mcp-test-utils.ts                      # NEW - Base test utilities
```

### Design Decisions

#### 1. Layered Helper Architecture

The infrastructure is organized in four layers:

1. **Base Test Utilities** (`utils/mcp-test-utils.ts`): Low-level utilities for config file manipulation, CLI execution with MCP-specific defaults, YAML parsing, and assertions
2. **Fixture Data** (`fixtures/marketplace-data.ts`): Static test data representing marketplace entries, server configurations, and catalog structures
3. **Mock Servers** (`mocks/mock-marketplace-server.ts`): Configurable mock MCP servers that simulate real marketplace-discovered server behavior
4. **E2E Helpers** (`helpers/mcp-e2e-helpers.ts`): High-level workflow helpers composing lower layers for common test patterns

#### 2. Composition over Inheritance

Rather than extending the existing `E2ETestHelpers`, the MCP E2E helpers compose with them:
- Use `globalThis.apexE2EHelpers` for temp dir management and resource cleanup
- Add MCP-specific capabilities (config manipulation, marketplace assertions)
- Maintain independent testability of each layer

#### 3. Fixture Strategy: Static + Dynamic

- **Static fixtures** for marketplace catalog entries (servers with known configurations)
- **Dynamic fixture factories** for generating test-specific scenarios (error cases, edge cases)
- Fixtures mirror the real `catalog.json` structure for compatibility

#### 4. Mock Server Design: Schema-Validated

Mock servers are defined using the existing `MockMCPServerDefinitionSchema` from `@apex/core/mcp/mock-types`, ensuring:
- Type safety via Zod validation
- Consistent mock behavior across tests
- Reuse of existing mock infrastructure

#### 5. Test Mode Configuration

The infrastructure supports dual execution modes:
- **Unit mode**: Fast, isolated tests using mocks for all I/O
- **E2E mode**: Full integration using real CLI, filesystem, and config files
- Detection via `process.env.APEX_TEST_MODE` (set by `vitest.e2e.config.ts`)

### Key Interfaces

```typescript
// MCP E2E Test Context
interface MCPTestContext {
  projectDir: string;           // Temp directory with .apex/ structure
  configPath: string;           // Path to .apex/config.yaml
  mockServers: Map<string, MockMCPServer>;  // Active mock servers
  installedServers: string[];   // Servers installed during test
}

// MCP E2E Helper Functions
interface MCPE2EHelpers {
  // Project setup
  createMCPProject(options?: MCPProjectOptions): Promise<MCPTestContext>;

  // CLI execution
  runMCPCommand(ctx: MCPTestContext, subcommand: string, args?: string[]): Promise<CLIResult>;

  // Config manipulation
  readMCPConfig(ctx: MCPTestContext): Promise<MCPConfig>;
  writeMCPConfig(ctx: MCPTestContext, config: MCPConfig): Promise<void>;

  // Assertions
  assertServerInstalled(ctx: MCPTestContext, serverName: string): Promise<void>;
  assertServerConfig(ctx: MCPTestContext, serverName: string, expected: Partial<MCPServerConfig>): Promise<void>;
  assertMarketplaceOutput(output: string, expectations: MarketplaceOutputExpectations): void;

  // Cleanup
  cleanup(ctx: MCPTestContext): Promise<void>;
}
```

### Integration Points

1. **With existing E2E setup**: Uses `createTempDir()`, `registerTempDir()`, `cleanupAll()` from `tests/e2e/setup.ts`
2. **With existing mock types**: Leverages `MockMCPServerConfigSchema`, `MockBehaviorConfigSchema` from `@apex/core/mcp/mock-types`
3. **With MCP Registry**: Uses `MCPMarketplaceEntry`, `MCPServerConfig` types from `@apex/core`
4. **With Vitest config**: Files in `tests/e2e/` are automatically included by `vitest.e2e.config.ts` pattern `tests/e2e/**/*.test.ts`

## Consequences

### Positive
- Reuses extensive existing mock infrastructure (mock-types.ts schemas, MockMCPServer class)
- Clean separation of concerns across four layers
- Fixture data mirrors real catalog.json structure for realistic testing
- Supports both isolated unit testing and full E2E integration testing
- Type-safe throughout via Zod schemas and TypeScript
- Composable with existing E2E helpers without modification

### Negative
- Additional test utility files to maintain
- Fixture data may drift from actual catalog if catalog.json changes
- Mock server behavior may not perfectly replicate real MCP server quirks

### Risks Mitigated
- E2E tests can run without network access (mock servers)
- Config file manipulation is tested without risking real project configs
- Marketplace workflow assertions catch regression in CLI command parsing
- Dual-mode support enables fast CI feedback (unit) + deep validation (E2E)
