# ADR-070: MCP Marketplace Test Architecture

## Status
Accepted

## Date
2026-01-30

## Context

The MCP marketplace feature requires comprehensive test coverage across multiple packages:
- **MCPRegistry** (`@apex/core`) - Server catalog management, filtering, category inference
- **MCPInstaller** (`@apex/orchestrator`) - Installation lifecycle with rollback, npm execution, SQLite tracking
- **MCPConfigurator** (`@apex/orchestrator`) - Config generation (Claude Desktop, APEX, JSON formats), env var detection, template management, server add/remove
- **CLI commands** (`@apex/cli`) - `/mcp list`, `/mcp search`, `/mcp install`, `/mcp installed`, etc.
- **API endpoints** (`@apex/api`) - REST endpoints for marketplace, installation, server management

Existing tests cover many of these areas but the task requires ensuring marketplace listing and installation flow coverage is complete and all tests pass.

## Decision

### Test Architecture Overview

```
packages/
├── core/src/__tests__/
│   ├── mcp-registry.test.ts                    ← EXISTS: Comprehensive unit tests
│   ├── mcp-registry.edge-cases.test.ts         ← EXISTS: Edge case coverage
│   ├── mcp-registry.listServers-filtering.test.ts ← EXISTS: Filtering tests
│   ├── mcp-registry.caching.test.ts            ← EXISTS: Caching behavior
│   ├── mcp-registry.integration.test.ts        ← EXISTS: Integration tests
│   └── mcp-marketplace-acceptance.test.ts      ← EXISTS: Acceptance criteria
│
├── orchestrator/src/__tests__/
│   ├── mcp-installer.test.ts                   ← EXISTS: Core installer tests
│   ├── mcp-installer.coverage.test.ts          ← EXISTS: Coverage gaps
│   ├── mcp-installer-rollback.test.ts          ← EXISTS: Rollback behavior
│   ├── mcp-installer-version-management.test.ts ← EXISTS: Version management
│   ├── mcp-installer-database.test.ts          ← EXISTS: SQLite integration
│   ├── mcp-installer-performance.test.ts       ← EXISTS: Performance tests
│   ├── mcp-marketplace-integration.test.ts     ← EXISTS: Marketplace integration
│   └── mcp-installer-dependency-resolution.test.ts ← EXISTS: Dependencies
│
├── orchestrator/src/mcp/
│   ├── configurator.test.ts                    ← EXISTS: Core configurator tests
│   ├── configurator.comprehensive.test.ts      ← EXISTS: Comprehensive coverage
│   ├── configurator.edge-cases.test.ts         ← EXISTS: Edge cases
│   ├── configurator.enhanced.test.ts           ← EXISTS: Enhanced tests
│   ├── configurator.integration.test.ts        ← EXISTS: Integration tests
│   └── configurator.performance.test.ts        ← EXISTS: Performance tests
│
├── cli/src/__tests__/
│   ├── mcp-command.test.ts                     ← EXISTS: Command structure
│   ├── mcp-marketplace-search.test.ts          ← EXISTS: Search tests
│   ├── mcp-marketplace-install.test.ts         ← EXISTS: Install tests
│   ├── mcp-marketplace-installed.test.ts       ← EXISTS: Installed listing
│   ├── mcp-marketplace-integration.test.ts     ← EXISTS: Integration
│   ├── mcp-commands-comprehensive.test.ts      ← EXISTS: Comprehensive
│   └── mcp-commands-acceptance.test.ts         ← EXISTS: Acceptance
│
└── api/src/__tests__/
    ├── mcp-endpoints.test.ts                   ← EXISTS: Endpoint tests
    ├── mcp-marketplace-endpoints.test.ts       ← EXISTS: Marketplace endpoints
    ├── mcp-marketplace-integration.test.ts     ← EXISTS: Integration
    ├── mcp-installed-endpoint-comprehensive.test.ts ← EXISTS: Install endpoints
    ├── mcp-websocket-events.test.ts            ← EXISTS: WebSocket events
    └── mcp-acceptance-validation.test.ts       ← EXISTS: Acceptance criteria
```

### Test Strategy for Each Component

#### 1. MCPRegistry Unit Tests (`@apex/core`)

**Test File**: `packages/core/src/__tests__/mcp-registry.test.ts` (existing, comprehensive)

**Coverage Areas**:
- Singleton pattern: `getInstance()`, `resetInstance()`
- Catalog loading: file read, JSON parsing, custom paths
- Catalog validation: required fields, server structure validation
- `listServers()`: no filter, category filter, verified filter, capabilities filter, search filter, combined filters
- `getServer()`: found/not-found, case sensitivity
- `getServerConfig()`: config retrieval, null for missing
- `hasServer()`: existence check
- `getCategories()`: category listing with metadata
- `getServersByCategory()`: category-based lookup, inferred categories
- `getServersByCapability()`: capability-based lookup
- `getAllCapabilities()`: unique capability aggregation
- Utility methods: `size`, `getCatalogInfo()`, `getServerNames()`
- Category inference: filesystem, web, development, database, system, search
- Error classes: `MCPCatalogLoadError`, `MCPCatalogValidationError`
- Convenience functions: `getMCPRegistry()`, `listMCPServers()`, `getMCPServer()`, `getMCPServerConfig()`

**Mocking Strategy**:
- Mock `fs.readFileSync` to control catalog data
- Use `MCPRegistry.resetInstance()` between tests for isolation
- Provide rich mock catalog with diverse servers for filter testing

#### 2. MCPInstaller Unit Tests (`@apex/orchestrator`)

**Test File**: `packages/orchestrator/src/__tests__/mcp-installer.test.ts` (existing, comprehensive)

**Coverage Areas**:
- Constructor: project path and store initialization
- `install()`: string name lookup (marketplace vs npx), MCPServer object, force reinstall, already installed error
- `installFromNpm()`: package name extraction, config creation, SQLite tracking
- `extractServerName()`: scope removal, prefix removal patterns
- `getInstalledServer()`: found/not-found, config from JSON, config from file
- `executeInstallation()`: command building, env passing
- `createConfigFile()`: directory creation, JSON writing
- `uninstall()`: record removal, config file cleanup
- `listInstalled()`: listing with config parsing
- `getInstallation()`: store lookup delegation
- `isInstalled()`: boolean check
- `verifyInstallation()`: file access + JSON validation
- `updateMarketplaceCache()`: upsert entries
- `getMarketplaceEntries()`: listing from store
- `parseVersion()`: semver parsing with prerelease, ranges, special values
- `compareVersions()`: major/minor/patch/prerelease comparison
- `satisfiesRange()`: caret, tilde, gt/gte/lt/lte, exact match, wildcard
- `resolveLatestVersion()`: npm registry lookup
- `getAvailableVersions()`: npm versions query
- Rollback: partial install cleanup (db record, config file, npm package)
- Error handling: failed installations, rollback errors

**Mocking Strategy**:
- Mock `child_process.exec` for npm commands
- Mock `fs.promises` for file operations
- Mock `TaskStore` for database operations
- Use `vi.fn()` for all dependencies

#### 3. MCPConfigurator Unit Tests (`@apex/orchestrator`)

**Test File**: `packages/orchestrator/src/mcp/configurator.test.ts` (existing, comprehensive)

**Coverage Areas**:
- Constructor: initialization with config, template loading, custom templates
- `generateConfig()`: APEX format, Claude Desktop format, JSON format, filtered servers
- `generateClaudeDesktopConfig()`: stdio-only servers, args/env mapping, envVars conversion
- `exportConfig()`: file writing, directory creation, format-specific paths
- `detectEnvironmentVariables()`: server lookup, template lookup, env detection
- `detectAllEnvironmentVariables()`: batch detection, error handling
- `resolveEnvVariable()`: env/config/user sources
- `getServerTemplates()`: all templates, category filter
- `getServerTemplate()`: by ID lookup
- `registerTemplate()`: custom template registration
- `generateFromTemplate()`: placeholder substitution, overrides
- `validateConfig()`: MCPConfig validation
- `validateServerConfig()`: individual server validation
- `validateEnvironmentVariables()`: env var validation with errors/warnings
- `applyConfig()`: merge, validate, backup options
- `importConfig()`: Claude Desktop format import
- `getConfig()`: immutable config return
- `addServer()`: new server, duplicate check, overwrite, validation
- `removeServer()`: existing server, not-found error
- Event emission: config:generated, config:validated, config:applied, env:detected, env:missing, server:added, server:removed
- Error handling: `MCPConfiguratorError` with codes

**Mocking Strategy**:
- Mock `fs/promises` for file operations
- Mock `EnvVarDetector` for environment detection
- Mock `ConfigValidator` for validation
- Provide rich `ApexConfig` with multiple servers

#### 4. CLI Command Integration Tests (`@apex/cli`)

**Test Files**: `packages/cli/src/__tests__/mcp-marketplace-*.test.ts` (existing)

**Coverage Areas**:
- `/mcp list`: server listing, JSON output format, empty state
- `/mcp search <query>`: text search, no results, JSON output
- `/mcp install <server>`: success flow, already installed, not found
- `/mcp uninstall <server>`: success flow, not installed
- `/mcp installed`: listing with details, empty state
- `/mcp validate`: config validation output
- `/mcp status`: server status display
- `/mcp init`: interactive setup flow
- Error handling: invalid subcommands, missing arguments

**Mocking Strategy**:
- Mock `MCPRegistry` for server catalog
- Mock `inquirer` for interactive prompts
- Mock `chalk` output or capture console output
- Mock config loading/saving

#### 5. API Endpoint Tests (`@apex/api`)

**Test Files**: `packages/api/src/__tests__/mcp-*.test.ts` (existing)

**Coverage Areas**:
- `GET /mcp/marketplace`: listing with filters (category, search, featured, verified)
- `GET /mcp/marketplace/categories`: category listing
- `GET /mcp/marketplace/featured`: featured entries
- `GET /mcp/servers`: installed server listing
- `GET /mcp/servers/:id`: server details, not found (404), invalid ID (400)
- `POST /mcp/servers/:serverName/install`: success, failure, already installed
- `DELETE /mcp/servers/:serverName`: success, not found
- `GET /mcp/installed`: installation listing
- `GET /mcp/servers/:serverName/status`: status check
- `POST /mcp/servers/:serverName/start`: server start
- `POST /mcp/servers/:serverName/stop`: server stop
- `POST /mcp/install/:id`: legacy install with WebSocket events
- `DELETE /mcp/uninstall/:id`: legacy uninstall with WebSocket events
- `POST /mcp/auto-configure`: auto-configuration
- `GET /mcp/recommendations`: server recommendations
- WebSocket events: `mcp:install-start`, `mcp:install-complete`, `mcp:install-error`, `mcp:uninstall-*`

**Mocking Strategy**:
- Mock `ApexOrchestrator` methods
- Use Fastify's `inject()` for HTTP testing
- Mock WebSocket broadcast for event tests

### End-to-End Marketplace Flow Tests

The marketplace listing and installation flow should be tested end-to-end:

```
1. Browse marketplace (MCPRegistry.listServers) → shows available servers
2. Search marketplace (MCPRegistry.listServers with search) → filters results
3. Select server → get details (MCPRegistry.getServer)
4. Install server (MCPInstaller.install) → npm install + config + db record
5. Configure server (MCPConfigurator.addServer) → add to project config
6. List installed (MCPInstaller.listInstalled) → shows installed servers
7. Verify installation (MCPInstaller.verifyInstallation) → checks consistency
8. Uninstall server (MCPInstaller.uninstall) → cleanup
```

### Shared Test Utilities

Common test fixtures should include:
- `mockCatalog`: Standard test catalog with diverse servers
- `mockStore`: Pre-configured TaskStore mock with MCP methods
- `mockConfig`: Standard ApexConfig with MCP enabled
- `mockMarketplaceEntry`: Factory for MCPMarketplaceEntry objects
- `mockInstallation`: Factory for MCPInstallation objects

### Test Configuration

All tests use **Vitest** with:
- `globals: true` for describe/it/expect
- `environment: 'node'` for all MCP tests (core, orchestrator, api, cli)
- Standard `vi.mock()` and `vi.fn()` for mocking
- `beforeEach`/`afterEach` for setup/teardown
- Singleton reset for MCPRegistry between tests

## Consequences

### Positive
- Comprehensive test coverage across all 4 packages
- Existing test infrastructure well-established (extensive test files already exist)
- Mock patterns well-established and consistent
- Clear separation of unit, integration, and acceptance tests
- End-to-end flow coverage through integration tests

### Negative
- Large number of test files may increase CI run time
- Mock-heavy approach means some integration gaps possible
- Singleton pattern in MCPRegistry requires careful test isolation

### Risks
- Tests may pass individually but fail in aggregate due to shared state (mitigated by `resetInstance()`)
- File system and npm mocks may not catch real-world edge cases (mitigated by dedicated edge-case test files)

## Notes for Development Stage

1. **Existing test coverage is already extensive** - Most test files listed above already exist with comprehensive coverage. The development stage should:
   - Run existing tests to verify they all pass
   - Identify any specific gaps in marketplace listing/installation flow
   - Add targeted tests only where gaps are found

2. **Key test commands**:
   ```bash
   npm run test                                          # All tests
   npm test --workspace=@apex/core                       # Core package tests
   npm test --workspace=@apex/orchestrator               # Orchestrator tests
   ```

3. **Critical verification**: Ensure the end-to-end marketplace flow is covered:
   - Catalog loading → filtering → installation → config generation → verification → uninstallation

4. **Test isolation**: Always call `MCPRegistry.resetInstance()` in `beforeEach`/`afterEach` blocks
