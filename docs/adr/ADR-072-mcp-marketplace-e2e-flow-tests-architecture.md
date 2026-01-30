# ADR-072: MCP Marketplace End-to-End Flow Tests Architecture

## Status
Accepted

## Context

The MCP (Model Context Protocol) marketplace feature in APEX allows users to browse, select, install, and configure MCP servers. End-to-end tests are needed to verify the complete flow works correctly through both CLI and API paths. The existing test infrastructure includes:

- **`tests/e2e/mcp-marketplace.e2e.test.ts`**: CLI happy path tests (browse → search → install → validate → status)
- **`tests/e2e/browse-marketplace.e2e.test.ts`**: Browse-specific tests for `mcp list` command
- **`tests/e2e/helpers/mcp-e2e-helpers.ts`**: High-level workflow helpers composing utilities
- **`tests/e2e/utils/mcp-test-utils.ts`**: Low-level CLI execution and config manipulation utilities
- **`tests/e2e/mocks/mock-marketplace-server.ts`**: Mock MCP server implementation
- **`tests/e2e/fixtures/marketplace-data.ts`**: Test fixture data for marketplace entries
- **`packages/api/src/__tests__/mcp-marketplace-endpoints.test.ts`**: API endpoint unit tests

## Decision

### 1. Test Architecture Overview

We will implement a **three-tier test architecture** for MCP marketplace E2E tests:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    E2E Test Suites (Test Files)                     │
│  - mcp-marketplace-complete-flow.e2e.test.ts (CLI complete flow)   │
│  - mcp-marketplace-api-flow.e2e.test.ts (API complete flow)        │
│  - mcp-marketplace-error-scenarios.e2e.test.ts (Error handling)    │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────┐
│                    Workflow Helpers (mcp-e2e-helpers.ts)            │
│  - createMCPTestContext()  - mcpHelpers.runHappyPathWorkflow()     │
│  - mcpHelpers.installServer() - mcpHelpers.verifyInstallation()    │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────┐
│                    Base Utilities (mcp-test-utils.ts)               │
│  - execCli() / execMCPCommand() - readApexConfig() / writeApexConfig() │
│  - assertServerInstalled()      - parseSimpleYaml()                │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Complete Flow Test Coverage

#### 2.1 CLI Path Tests (`tests/e2e/mcp-marketplace-complete-flow.e2e.test.ts`)

**Flow 1: Happy Path - Single Server Installation**
```
browse marketplace → search "filesystem" → select server → install → configure → verify working
```

| Step | CLI Command | Verification |
|------|-------------|--------------|
| Browse | `mcp list` | Output contains server list, categories, verification badges |
| Search | `mcp search filesystem` | Returns matching servers |
| Install | `mcp install filesystem` | Success message, server in config |
| Configure | N/A (auto-configured) | Config has proper env vars, autoStart |
| Verify | `mcp validate` | Configuration is valid |
| Status | `mcp status` | Server appears in status |
| Working | `mcp installed --json` | Server properly serialized |

**Flow 2: Multi-Server Installation**
```
install server A → install server B → install server C → verify all working
```

**Flow 3: Uninstallation Flow**
```
install server → verify installed → uninstall → verify removed
```

#### 2.2 API Path Tests (`tests/e2e/mcp-marketplace-api-flow.e2e.test.ts`)

**API Endpoints to Test:**
| Endpoint | Method | Flow Step |
|----------|--------|-----------|
| `/mcp/marketplace` | GET | Browse marketplace |
| `/mcp/marketplace/search?q=term` | GET | Search servers |
| `/mcp/servers/:id` | GET | Get server details |
| `/mcp/install/:id` | POST | Install server |
| `/mcp/uninstall/:id` | DELETE | Uninstall server |
| `/mcp/installed` | GET | List installed servers |
| `/mcp/status` | GET | Get MCP status |

**WebSocket Events to Verify:**
- `mcp:install-start` - Installation begins
- `mcp:install-progress` - Installation progress updates
- `mcp:install-complete` - Installation success
- `mcp:install-error` - Installation failure
- `mcp:uninstall-start` / `mcp:uninstall-complete` - Uninstall lifecycle

### 3. Error Scenario Tests (`tests/e2e/mcp-marketplace-error-scenarios.e2e.test.ts`)

#### 3.1 Network Failure Scenarios
| Scenario | Simulation | Expected Behavior |
|----------|------------|-------------------|
| Network timeout during install | Mock slow server (2000ms+) | Timeout error message |
| Connection refused | No server running | Clear error message |
| DNS resolution failure | Invalid hostname | User-friendly error |

#### 3.2 Invalid Server Scenarios
| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| Non-existent server | `mcp install nonexistent` | "Server not found" error |
| Malformed server ID | `mcp install !!invalid!!` | Validation error |
| Empty server ID | `mcp install ""` | Parameter required error |

#### 3.3 Permission Scenarios
| Scenario | Setup | Expected Behavior |
|----------|-------|-------------------|
| Read-only config file | `chmod 444 config.yaml` | Permission denied error |
| Missing .apex directory | Delete `.apex/` | "Not initialized" error |
| Locked database | Lock `apex.db` | Database lock error |

#### 3.4 Configuration Scenarios
| Scenario | Setup | Expected Behavior |
|----------|-------|-------------------|
| Duplicate installation | Install same server twice | "Already installed" warning |
| Invalid YAML config | Corrupt `config.yaml` | Parse error with guidance |
| Missing required env vars | Server needs `GITHUB_TOKEN` | Prompt or error |

### 4. Test Infrastructure Components

#### 4.1 Enhanced Mock Server (`mock-marketplace-server.ts`)

Existing `MockMarketplaceServer` class supports:
- Configurable startup delay (`startupDelayMs`)
- Random error injection (`errorProbability`)
- Connection drop simulation (`disconnectAfterRequests`)
- Health check simulation (`supportsHealthCheck`)

**New capabilities needed:**
```typescript
// Add to MockMarketplaceBehavior interface
interface MockMarketplaceBehavior {
  // Existing...

  // New capabilities for error scenarios
  networkErrorMode?: 'timeout' | 'refused' | 'dns_failure';
  networkErrorAfterMs?: number;
  simulatePermissionDenied?: boolean;
  corruptResponseMode?: 'malformed_json' | 'incomplete' | 'wrong_schema';
}
```

#### 4.2 API Test Server (`api-e2e-test-server.ts`)

New helper for API path tests:
```typescript
interface APITestServer {
  /** Start Fastify server with real orchestrator */
  start(): Promise<{ url: string; wsUrl: string }>;

  /** Stop server and cleanup */
  stop(): Promise<void>;

  /** Get WebSocket client for event verification */
  createWebSocketClient(): Promise<WebSocketTestClient>;

  /** Reset server state between tests */
  reset(): Promise<void>;
}
```

#### 4.3 WebSocket Test Client (`ws-test-client.ts`)

```typescript
interface WebSocketTestClient {
  /** Connect and wait for connection open */
  connect(): Promise<void>;

  /** Wait for specific event type with timeout */
  waitForEvent<T>(type: string, timeoutMs?: number): Promise<T>;

  /** Collect all events matching predicate */
  collectEvents(predicate: (e: any) => boolean): any[];

  /** Disconnect client */
  disconnect(): Promise<void>;
}
```

### 5. Test Data Strategy

#### 5.1 Fixture Servers (from `marketplace-data.ts`)

| Server | Characteristics | Test Use Case |
|--------|-----------------|---------------|
| `filesystem` | Verified, auto-start, no env vars | Happy path default |
| `memory` | Verified, no auto-start | Multi-server tests |
| `fetch` | Verified, web category | Category filtering |
| `github` | Requires `GITHUB_TOKEN` | Env var requirement tests |
| `postgres` | Requires connection string | Complex config tests |
| `community-tools` | Unverified | Verification badge tests |
| `http-server` | HTTP transport (not stdio) | Transport type tests |

#### 5.2 Dynamic Fixture Generation

```typescript
// Create custom test server with specific characteristics
function createTestServer(overrides: Partial<MarketplaceEntry>): MarketplaceEntry {
  return createMarketplaceEntry('test-server-' + Date.now(), overrides);
}
```

### 6. Test Execution Configuration

#### 6.1 Vitest E2E Config (`vitest.e2e.config.ts`)

Current configuration is appropriate:
- `testTimeout: 60000` (60s for slow operations)
- `hookTimeout: 30000` (30s for setup/teardown)
- `pool: 'forks'` (process isolation)
- `maxForks: 4` (limit concurrency)
- `retry: 2` (CI retry for flaky tests)

#### 6.2 Test Ordering

Tests should run in dependency order:
1. Infrastructure tests (verify setup works)
2. Happy path tests (basic flows)
3. Multi-step workflow tests
4. Error scenario tests
5. Edge case tests

### 7. Acceptance Criteria Mapping

| Acceptance Criterion | Test File | Test Cases |
|---------------------|-----------|------------|
| E2E tests verify complete flows | `mcp-marketplace-complete-flow.e2e.test.ts` | `should complete: list → search → install → installed → validate → status` |
| Tests cover CLI path | `mcp-marketplace-complete-flow.e2e.test.ts` | All CLI command tests |
| Tests cover API path | `mcp-marketplace-api-flow.e2e.test.ts` | All API endpoint tests |
| Network failure tested | `mcp-marketplace-error-scenarios.e2e.test.ts` | Network error suite |
| Invalid server tested | `mcp-marketplace-error-scenarios.e2e.test.ts` | Invalid server suite |
| Permission issues tested | `mcp-marketplace-error-scenarios.e2e.test.ts` | Permission error suite |
| All tests pass | CI verification | `npm run test` must pass |

### 8. File Structure

```
tests/e2e/
├── setup.ts                          # Existing: Global E2E setup
├── teardown.ts                       # Existing: Global teardown
├── mcp-marketplace.e2e.test.ts       # Existing: CLI happy path
├── browse-marketplace.e2e.test.ts    # Existing: Browse tests
├── mcp-marketplace-complete-flow.e2e.test.ts  # NEW: Complete CLI flows
├── mcp-marketplace-api-flow.e2e.test.ts       # NEW: API path tests
├── mcp-marketplace-error-scenarios.e2e.test.ts # NEW: Error scenarios
├── helpers/
│   ├── mcp-e2e-helpers.ts            # Existing: Workflow helpers
│   ├── cli-test-helpers.ts           # Existing: CLI helpers
│   └── api-e2e-test-server.ts        # NEW: API test server helper
├── utils/
│   ├── mcp-test-utils.ts             # Existing: Base utilities
│   └── ws-test-client.ts             # NEW: WebSocket test client
├── mocks/
│   └── mock-marketplace-server.ts    # Existing: Mock MCP server
└── fixtures/
    └── marketplace-data.ts           # Existing: Test fixtures
```

### 9. Implementation Phases

**Phase 1: Enhance Error Scenario Infrastructure**
- Add network error simulation to mock server
- Add permission error simulation utilities
- Add config corruption utilities

**Phase 2: Implement CLI Complete Flow Tests**
- Expand `mcp-marketplace-complete-flow.e2e.test.ts`
- Add uninstallation flow tests
- Add multi-server workflow tests

**Phase 3: Implement API Path Tests**
- Create `api-e2e-test-server.ts` helper
- Create `ws-test-client.ts` helper
- Implement `mcp-marketplace-api-flow.e2e.test.ts`

**Phase 4: Implement Error Scenario Tests**
- Network failure scenarios
- Invalid server scenarios
- Permission scenarios
- Configuration scenarios

**Phase 5: Verification and Cleanup**
- Run all tests
- Ensure build passes
- Document any issues

## Consequences

### Positive
- Comprehensive E2E coverage for both CLI and API paths
- Reusable test infrastructure for future MCP features
- Clear error scenario coverage requirements
- Modular architecture enables easy extension

### Negative
- Additional test infrastructure complexity
- Longer test execution time (E2E tests are slow)
- Mock server maintenance overhead

### Risks
- Network-dependent tests may be flaky in CI
- Mock server behavior may diverge from real implementation
- Permission tests may behave differently across platforms

## References

- Existing tests: `tests/e2e/mcp-marketplace.e2e.test.ts`
- E2E setup: `tests/e2e/setup.ts`
- Mock server: `tests/e2e/mocks/mock-marketplace-server.ts`
- Test utilities: `tests/e2e/utils/mcp-test-utils.ts`
- Vitest E2E config: `vitest.e2e.config.ts`
