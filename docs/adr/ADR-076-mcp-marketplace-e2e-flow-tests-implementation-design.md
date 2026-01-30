# ADR-076: MCP Marketplace E2E Flow Tests — Implementation Technical Design

## Status
Accepted

## Context

ADR-071 established the E2E test infrastructure (helpers, fixtures, mocks, utilities) and ADR-072 established the three-tier test architecture for MCP marketplace E2E flow tests. This ADR provides the **concrete implementation technical design** — specifying exactly what files to create, their interfaces, and implementation guidance for the developer stage.

### Current State Analysis

**Already Implemented (✅):**
| File | Status | Lines |
|------|--------|-------|
| `tests/e2e/mcp-marketplace.e2e.test.ts` | Complete | 527 |
| `tests/e2e/browse-marketplace.e2e.test.ts` | Complete | 254 |
| `tests/e2e/mcp-marketplace-complete-flow.e2e.test.ts` | Complete | 411 |
| `tests/e2e/mcp-marketplace-api-flow.e2e.test.ts` | Complete | 493 |
| `tests/e2e/helpers/mcp-e2e-helpers.ts` | Complete | 733 |
| `tests/e2e/utils/mcp-test-utils.ts` | Complete | 728 |
| `tests/e2e/mocks/mock-marketplace-server.ts` | Complete | 774 |
| `tests/e2e/fixtures/marketplace-data.ts` | Complete | 631 |

**Not Yet Implemented (❌):**
| File | Purpose | Priority |
|------|---------|----------|
| `tests/e2e/helpers/api-e2e-test-server.ts` | API test server helper (needed by API flow tests) | HIGH |
| `tests/e2e/utils/ws-test-client.ts` | WebSocket test client (needed by API flow tests) | HIGH |
| `tests/e2e/mcp-marketplace-error-scenarios.e2e.test.ts` | Error scenario tests (acceptance criteria) | HIGH |

## Decision

### 1. File: `tests/e2e/helpers/api-e2e-test-server.ts`

**Purpose:** Wraps Fastify server creation for E2E API tests, providing a test-oriented API server with lifecycle management.

**Interface:**
```typescript
export interface APITestServerOptions {
  projectPath: string;
  port?: number;           // Default: 0 (random available port)
  host?: string;           // Default: '127.0.0.1'
  enableWebSocket?: boolean; // Default: true
}

export interface APITestServer {
  /** Start the Fastify server with real orchestrator */
  start(): Promise<void>;

  /** Stop server, cleanup orchestrator and resources */
  stop(): Promise<void>;

  /** Get the base HTTP URL (e.g., http://127.0.0.1:12345) */
  getBaseUrl(): string;

  /** Get the WebSocket URL (e.g., ws://127.0.0.1:12345/ws) */
  getWsUrl(): string;

  /** Create a WebSocket test client connected to this server */
  createWebSocketClient(): Promise<WebSocketTestClient>;

  /** Get the underlying Fastify instance for direct access */
  getServer(): FastifyInstance;

  /** Reset server state between tests (clear installed servers, etc.) */
  reset(): Promise<void>;
}

export function createAPITestServer(options: APITestServerOptions): APITestServer;
```

**Implementation Strategy:**
1. Import `createServer` from `@apexcli/api` (or directly construct Fastify with routes)
2. Create a real `ApexOrchestrator` instance pointed at the test project directory
3. Use port 0 for dynamic port allocation (avoid test conflicts)
4. Track resources for cleanup in `stop()` (close DB, shutdown orchestrator, close server)
5. `reset()` should re-initialize the orchestrator without restarting the HTTP server

**Dependencies:**
- `@apexcli/api` — Fastify server creation
- `@apexcli/orchestrator` — ApexOrchestrator for real MCP operations
- `ws` — WebSocket client creation
- `../utils/ws-test-client.js` — WebSocketTestClient

### 2. File: `tests/e2e/utils/ws-test-client.ts`

**Purpose:** WebSocket client wrapper for testing API event streams (install/uninstall lifecycle events).

**Interface:**
```typescript
export interface WSEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface WebSocketTestClient {
  /** Connect to WebSocket server */
  connect(): Promise<void>;

  /** Disconnect and cleanup */
  disconnect(): Promise<void>;

  /** Wait for a specific event type (throws on timeout) */
  waitForEvent(type: string, timeoutMs?: number): Promise<WSEvent>;

  /** Collect all events matching a predicate (non-blocking snapshot) */
  collectEvents(predicate?: (e: WSEvent) => boolean): WSEvent[];

  /** Get all received events */
  getAllEvents(): WSEvent[];

  /** Clear event buffer */
  clearEvents(): void;

  /** Check if connected */
  isConnected(): boolean;
}

export function createWebSocketTestClient(url: string): WebSocketTestClient;
```

**Implementation Strategy:**
1. Use `ws` library (already a devDependency in `packages/api`)
2. Buffer all received messages as parsed `WSEvent` objects
3. `waitForEvent()` uses a Promise + timeout pattern:
   - Check existing buffer first
   - If not found, register listener and resolve on match or reject on timeout
4. Thread-safe event collection with array snapshots
5. Auto-reconnect is NOT needed (tests should fail fast)

**Key Design Decisions:**
- Events are buffered in memory (no disk persistence needed for tests)
- Default timeout: 10000ms (10s) for `waitForEvent`
- JSON parse errors in messages should be captured as error events, not thrown

### 3. File: `tests/e2e/mcp-marketplace-error-scenarios.e2e.test.ts`

**Purpose:** E2E tests for error scenarios per acceptance criteria: network failure, invalid server, permission issues.

**Test Structure:**
```typescript
describe('MCP Marketplace Error Scenarios E2E (ADR-072)', () => {

  describe('Network Failure Scenarios', () => {
    it('should handle server startup timeout gracefully');
    it('should report clear error when connection is refused');
    it('should handle server crash during operation');
  });

  describe('Invalid Server Scenarios', () => {
    it('should report "not found" for non-existent server ID');
    it('should reject malformed server IDs');
    it('should handle empty server ID parameter');
    it('should handle server with missing required config fields');
  });

  describe('Permission & Filesystem Scenarios', () => {
    it('should report error when config file is read-only');
    it('should report error when .apex directory is missing');
    it('should handle corrupted YAML config gracefully');
  });

  describe('Duplicate & Conflict Scenarios', () => {
    it('should warn when installing an already-installed server');
    it('should handle uninstalling a server that is not installed');
    it('should handle concurrent install attempts for same server');
  });

  describe('API Error Scenarios', () => {
    it('should return 404 for non-existent server via API');
    it('should return 400 for invalid request body');
    it('should return 409 for duplicate installation via API');
    it('should emit error events via WebSocket on install failure');
  });
});
```

**Implementation Strategy:**
1. Reuse `createMCPTestContext` and `mcpHelpers` from existing helpers
2. For **network failures**: Use `createFailingServer()` and `createSlowServer()` from mock-marketplace-server.ts
3. For **invalid server**: Pass bad IDs to `mcpHelpers.installServer(ctx, 'nonexistent')`
4. For **permission issues**: Use `fs.chmod()` to make config read-only, then attempt operations
5. For **API errors**: Use `createAPITestServer()` and make HTTP requests directly with `fetch()`
6. For **WebSocket errors**: Use `WebSocketTestClient.waitForEvent('mcp:install-error')`

**Platform Considerations:**
- Permission tests (`chmod`) may behave differently on Windows — wrap in platform check
- Use `process.platform !== 'win32'` guard for permission-based tests

### 4. Mock Server Enhancements

The existing `MockMarketplaceBehavior` interface should be extended (in `mock-marketplace-server.ts`):

```typescript
// Add to existing interface:
interface MockMarketplaceBehavior {
  // ... existing fields ...

  /** Simulate specific network error modes */
  networkErrorMode?: 'timeout' | 'refused' | 'reset';
  /** Delay before network error triggers */
  networkErrorAfterMs?: number;
  /** Simulate corrupted response data */
  corruptResponseMode?: 'malformed_json' | 'incomplete' | 'wrong_schema';
}
```

### 5. Test Data Requirements

Error scenario tests need additional fixture entries in `marketplace-data.ts`:

```typescript
// Add to existing fixtures:
export const INVALID_CONFIG_SERVER: MarketplaceEntry = {
  name: 'invalid-config',
  description: 'Server with intentionally invalid config',
  version: '0.0.1',
  serverConfig: { name: '', type: 'stdio' as const }, // Empty name = invalid
};

export const MISSING_DEPS_SERVER: MarketplaceEntry = {
  name: 'missing-deps',
  description: 'Server requiring unavailable dependencies',
  version: '1.0.0',
  serverConfig: {
    name: 'missing-deps',
    type: 'stdio' as const,
    command: '/nonexistent/binary',
  },
};
```

### 6. Integration Points

#### CLI Path
```
User → CLI Command (execMCPCommand) → Orchestrator → MarketplaceService → Config
                                                                        ↓
                                                              MockMarketplaceServer
```

#### API Path
```
User → HTTP Request → Fastify Route → Orchestrator → MarketplaceService → Config
         ↑                                    ↓
    WebSocket ← ← ← ← Events ← ← ← ← ← ← ←
```

### 7. Implementation Order

The developer stage should implement files in this order:

1. **`ws-test-client.ts`** — No dependencies on other new files
2. **`api-e2e-test-server.ts`** — Depends on ws-test-client
3. **Error fixture additions** — Add to existing marketplace-data.ts
4. **Mock behavior enhancements** — Add to existing mock-marketplace-server.ts
5. **`mcp-marketplace-error-scenarios.e2e.test.ts`** — Depends on all above

### 8. Verification Criteria

All tests must satisfy:
- `npm run build` passes with no errors
- `npm run test` passes with all tests green
- Error scenario tests cover: network failure, invalid server, permission issues (per acceptance criteria)
- Both CLI and API paths are tested end-to-end
- Tests are isolated (no shared state between test cases)
- Cleanup is reliable (temp dirs removed, servers stopped, connections closed)

## Consequences

### Positive
- Complete acceptance criteria coverage (browse → select → install → configure → verify)
- Both CLI and API paths fully tested
- Error scenarios comprehensively covered
- Clear implementation order reduces developer stage risk

### Negative
- Three new files to create and maintain
- API test server adds complexity to test infrastructure
- WebSocket testing adds potential for flaky tests

### Mitigations
- Use port 0 for dynamic allocation (avoids port conflicts)
- Use generous timeouts with clear error messages
- Platform-guard permission tests for cross-OS compatibility
- All new infrastructure composes with existing patterns (no new frameworks)

## References

- ADR-071: MCP Marketplace E2E Test Infrastructure
- ADR-072: MCP Marketplace E2E Flow Tests Architecture
- Existing tests: `tests/e2e/mcp-marketplace-complete-flow.e2e.test.ts`
- Existing helpers: `tests/e2e/helpers/mcp-e2e-helpers.ts`
- Acceptance criteria: E2E tests verify complete flows, CLI and API paths, error scenarios
