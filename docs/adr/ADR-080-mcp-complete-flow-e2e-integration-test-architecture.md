# ADR-080: MCP Complete Flow E2E Integration Test Architecture

## Status
Accepted

## Context

Following ADR-072 and ADR-076, we need to create a **comprehensive end-to-end integration test** that validates the complete MCP marketplace flow as a single unified test scenario. While existing tests cover individual aspects (browse, install, error handling) in separate test suites, there is a need for a **consolidated integration test** that:

1. Tests the **full happy path** in a single cohesive scenario
2. Tests **error recovery** scenarios in context
3. Validates **both CLI and API paths** work together
4. Ensures the complete **lifecycle management** works end-to-end

### Current Test Coverage Analysis

**Existing E2E Tests:**
| File | Coverage | Gap |
|------|----------|-----|
| `browse-marketplace.e2e.test.ts` | Browse/list functionality | No install verification |
| `mcp-marketplace-complete-flow.e2e.test.ts` | CLI happy path workflows | Separate from error scenarios |
| `mcp-marketplace-error-scenarios.e2e.test.ts` | Error handling | Separate from happy path |
| `mcp-marketplace-api-flow.e2e.test.ts` | API endpoints + WebSocket | CLI integration limited |
| `server-installation.e2e.test.ts` | Installation flow | No uninstallation |

**Identified Gaps:**
1. No single test covers the **complete lifecycle**: browse → select → install → auto-configure → verify → uninstall
2. Error scenarios are tested in isolation, not as **recovery from mid-flow failures**
3. No comprehensive test for **network failure and permission error** scenarios in context
4. No test validates **CLI and API consistency** in a unified flow

## Decision

### 1. Architecture Overview

Create a **unified MCP complete flow E2E integration test** (`mcp-complete-flow-integration.e2e.test.ts`) that consolidates and extends the existing test patterns into comprehensive scenarios.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│         MCP Complete Flow Integration Test Architecture                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    Test Suite Structure                                  │ │
│  │                                                                          │ │
│  │  1. Complete Happy Path Scenarios                                        │ │
│  │     ├── Single server: browse → select → install → verify → uninstall   │ │
│  │     ├── Multi-server: sequential install/uninstall                      │ │
│  │     └── Mixed CLI/API: install via API, verify via CLI                  │ │
│  │                                                                          │ │
│  │  2. Error Scenario Integration                                           │ │
│  │     ├── Network failure during install → recovery → retry               │ │
│  │     ├── Permission error → fix permissions → retry                      │ │
│  │     └── Invalid server → valid server → success                         │ │
│  │                                                                          │ │
│  │  3. Configuration Lifecycle                                              │ │
│  │     ├── Auto-configuration verification                                  │ │
│  │     ├── Config persistence across operations                            │ │
│  │     └── Clean uninstallation with config verification                   │ │
│  │                                                                          │ │
│  │  4. Cross-Path Verification                                              │ │
│  │     ├── Install via CLI → verify via API                                │ │
│  │     ├── Install via API → verify via CLI                                │ │
│  │     └── WebSocket event verification for all operations                 │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    Test Infrastructure                                   │ │
│  │                                                                          │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │ │
│  │  │  MCPTestContext │  │  APITestServer  │  │ WebSocketClient │         │ │
│  │  │                 │  │                 │  │                 │         │ │
│  │  │ • projectDir    │  │ • HTTP server   │  │ • Event capture │         │ │
│  │  │ • configPath    │  │ • Orchestrator  │  │ • Assertions    │         │ │
│  │  │ • serverManager │  │ • WebSocket     │  │ • Filtering     │         │ │
│  │  │ • cleanup()     │  │ • reset()       │  │ • waitFor()     │         │ │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │ │
│  │           │                    │                    │                   │ │
│  │           └────────────────────┴────────────────────┘                   │ │
│  │                               │                                         │ │
│  │  ┌────────────────────────────┴────────────────────────────────────┐   │ │
│  │  │                    Shared Test Helpers                           │   │ │
│  │  │  • mcpHelpers.runHappyPathWorkflow()                            │   │ │
│  │  │  • mcpHelpers.runFullFlowScenario()                             │   │ │
│  │  │  • createFailingServer() / createSlowServer()                   │   │ │
│  │  │  • assertServerInstalled() / verifyInstallation()               │   │ │
│  │  └──────────────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Test Scenarios Specification

#### 2.1 Complete Happy Path - Full Lifecycle

**Scenario: Single Server Full Lifecycle**
```
Step 1: Browse marketplace (CLI)
   └── Assert: Marketplace header, server list, categories visible
   └── Assert: "filesystem" server in list with verified badge

Step 2: Search/filter servers (CLI)
   └── Assert: Search returns matching results
   └── Assert: Category filtering works

Step 3: Install server (CLI)
   └── Assert: Success message displayed
   └── Assert: Progress indicators shown
   └── Expected: ✅ installed successfully

Step 4: Auto-configuration verification
   └── Assert: config.yaml updated with server entry
   └── Assert: Correct command, args, env vars
   └── Assert: autoStart setting correct

Step 5: Verify working (CLI)
   └── mcp validate → ✅ valid configuration
   └── mcp status → server listed
   └── mcp installed → server in list

Step 6: Uninstall server (CLI)
   └── Assert: Success message
   └── Assert: Server removed from config
   └── Assert: Config still valid YAML
```

**Scenario: Multi-Server Installation**
```
Step 1: Install filesystem server
Step 2: Install memory server
Step 3: Install fetch server
Step 4: Verify all 3 servers in config
Step 5: Verify all 3 appear in status
Step 6: Uninstall memory server
Step 7: Verify 2 remaining servers work
Step 8: Uninstall remaining servers
Step 9: Verify clean state
```

#### 2.2 Error Scenario Integration

**Scenario: Network Failure Recovery**
```
Step 1: Attempt install with simulated network timeout
   └── Assert: Clear timeout error message
   └── Assert: No partial config written

Step 2: Fix network (mock server available)

Step 3: Retry installation
   └── Assert: Success after recovery
   └── Assert: Server properly configured
```

**Scenario: Permission Error Recovery**
```
Step 1: Make config file read-only (chmod 444)

Step 2: Attempt installation
   └── Assert: Permission denied error
   └── Assert: Helpful error message

Step 3: Fix permissions (chmod 644)

Step 4: Retry installation
   └── Assert: Success
   └── Assert: Config updated correctly
```

**Scenario: Invalid Server Graceful Failure**
```
Step 1: Attempt to install non-existent server
   └── Assert: "not found" error
   └── Assert: Available servers hint

Step 2: Install valid server
   └── Assert: Success
   └── Assert: Previous error did not corrupt state
```

#### 2.3 Cross-Path Verification

**Scenario: CLI/API Consistency**
```
Step 1: Install filesystem via API (POST /mcp/install/filesystem)
   └── Verify WebSocket events: mcp:install-start, mcp:install-complete
   └── Assert: 200 response with config

Step 2: Verify via CLI (mcp installed)
   └── Assert: CLI shows same server

Step 3: Install memory via CLI (mcp install memory)
   └── Assert: Success

Step 4: Verify via API (GET /mcp/installed)
   └── Assert: Both servers listed

Step 5: Uninstall via API (DELETE /mcp/uninstall/filesystem)
   └── Verify WebSocket events: mcp:uninstall-start, mcp:uninstall-complete

Step 6: Verify via CLI
   └── Assert: Only memory server remains
```

### 3. Test File Structure

```
tests/e2e/
├── mcp-complete-flow-integration.e2e.test.ts  # NEW: Unified integration test
│
├── helpers/
│   ├── mcp-e2e-helpers.ts                     # EXISTING: Workflow helpers
│   ├── api-e2e-test-server.ts                 # EXISTING: API server helper
│   └── integration-test-orchestrator.ts       # NEW: Multi-path test coordination
│
├── utils/
│   ├── mcp-test-utils.ts                      # EXISTING: Base utilities
│   ├── ws-test-client.ts                      # EXISTING: WebSocket client
│   └── error-injection-utils.ts               # NEW: Error scenario utilities
│
├── mocks/
│   └── mock-marketplace-server.ts             # EXISTING: Mock MCP server
│
└── fixtures/
    ├── marketplace-data.ts                    # EXISTING: Test fixtures
    └── error-scenario-fixtures.ts             # NEW: Error test fixtures
```

### 4. New Helper: Integration Test Orchestrator

```typescript
// tests/e2e/helpers/integration-test-orchestrator.ts

export interface IntegrationTestContext {
  /** MCP test context for CLI operations */
  mcp: MCPTestContext;

  /** API test server for HTTP/WebSocket operations */
  api: APITestServer;

  /** WebSocket client for event verification */
  ws: WebSocketTestClient;

  /** Collected events across the test */
  events: WSEvent[];

  /** Test lifecycle management */
  setup(): Promise<void>;
  teardown(): Promise<void>;
  reset(): Promise<void>;
}

export interface FlowStepResult {
  step: string;
  method: 'cli' | 'api';
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
  events?: WSEvent[];
}

export interface CompleteFlowResult {
  success: boolean;
  steps: FlowStepResult[];
  totalDuration: number;
  serverState: {
    installed: string[];
    configValid: boolean;
  };
}

export class IntegrationTestOrchestrator {
  /** Run complete lifecycle flow */
  async runCompleteLifecycle(
    serverIds: string[],
    options?: { verifyCrossPath?: boolean }
  ): Promise<CompleteFlowResult>;

  /** Run error recovery scenario */
  async runErrorRecoveryScenario(
    errorType: 'network' | 'permission' | 'invalid',
    serverIds: string[]
  ): Promise<CompleteFlowResult>;

  /** Run cross-path verification */
  async runCrossPathVerification(
    installPath: 'cli' | 'api',
    verifyPath: 'cli' | 'api',
    serverId: string
  ): Promise<CompleteFlowResult>;

  /** Verify final state */
  async verifyFinalState(
    expectedServers: string[],
    expectCleanConfig: boolean
  ): Promise<boolean>;
}
```

### 5. New Utility: Error Injection

```typescript
// tests/e2e/utils/error-injection-utils.ts

export interface ErrorInjectionOptions {
  /** When to inject the error (before/during/after operation) */
  timing: 'before' | 'during' | 'after';

  /** Type of error to simulate */
  errorType: 'network_timeout' | 'network_refused' |
             'permission_denied' | 'config_corrupt' |
             'server_not_found' | 'server_crash';

  /** Duration before error triggers (for timeout scenarios) */
  delayMs?: number;

  /** Whether error should be recoverable */
  recoverable: boolean;
}

export class ErrorInjector {
  /** Inject network failure */
  async injectNetworkFailure(
    ctx: MCPTestContext,
    mode: 'timeout' | 'refused' | 'reset'
  ): Promise<void>;

  /** Inject permission error */
  async injectPermissionError(
    ctx: MCPTestContext,
    target: 'config' | 'directory'
  ): Promise<void>;

  /** Inject config corruption */
  async injectConfigCorruption(
    ctx: MCPTestContext,
    mode: 'invalid_yaml' | 'missing_fields' | 'wrong_types'
  ): Promise<void>;

  /** Clear all injected errors (recover) */
  async clearAllErrors(ctx: MCPTestContext): Promise<void>;

  /** Restore original state */
  async restore(): Promise<void>;
}
```

### 6. Test Implementation Structure

```typescript
// tests/e2e/mcp-complete-flow-integration.e2e.test.ts

describe('MCP Complete Flow Integration E2E Tests', () => {
  let orchestrator: IntegrationTestOrchestrator;
  let errorInjector: ErrorInjector;

  beforeAll(async () => {
    orchestrator = await IntegrationTestOrchestrator.create();
  });

  afterAll(async () => {
    await orchestrator.cleanup();
  });

  beforeEach(async () => {
    await orchestrator.reset();
    errorInjector = new ErrorInjector();
  });

  afterEach(async () => {
    await errorInjector.restore();
  });

  describe('Complete Happy Path Scenarios', () => {
    describe('Single Server Full Lifecycle', () => {
      it('should complete: browse → select → install → auto-configure → verify → uninstall', async () => {
        const result = await orchestrator.runCompleteLifecycle(['filesystem']);

        expect(result.success).toBe(true);
        expect(result.steps).toHaveLength(6);
        expect(result.serverState.installed).toHaveLength(0); // After uninstall
        expect(result.serverState.configValid).toBe(true);

        // Verify each step succeeded
        const stepNames = result.steps.map(s => s.step);
        expect(stepNames).toEqual([
          'browse-marketplace',
          'select-server',
          'install-server',
          'verify-auto-config',
          'verify-working',
          'uninstall-server'
        ]);
      });
    });

    describe('Multi-Server Lifecycle', () => {
      it('should handle sequential install and uninstall of multiple servers', async () => {
        const result = await orchestrator.runCompleteLifecycle(
          ['filesystem', 'memory', 'fetch'],
          { verifyCrossPath: true }
        );

        expect(result.success).toBe(true);
        // Verify all servers were processed
        const installSteps = result.steps.filter(s => s.step.startsWith('install'));
        expect(installSteps).toHaveLength(3);
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    describe('Network Failure Recovery', () => {
      it('should recover from network timeout and complete installation', async () => {
        const result = await orchestrator.runErrorRecoveryScenario(
          'network',
          ['filesystem']
        );

        expect(result.success).toBe(true);
        // Should have: failed attempt, recovery, successful attempt
        const failedStep = result.steps.find(s => !s.success);
        expect(failedStep).toBeDefined();
        expect(failedStep!.error).toContain('timeout');

        // Final state should be successful
        expect(result.serverState.installed).toContain('filesystem');
      });
    });

    describe('Permission Error Recovery', () => {
      it('should recover from permission denied and complete installation', async () => {
        // Skip on Windows
        if (process.platform === 'win32') return;

        const result = await orchestrator.runErrorRecoveryScenario(
          'permission',
          ['filesystem']
        );

        expect(result.success).toBe(true);
        expect(result.serverState.installed).toContain('filesystem');
      });
    });
  });

  describe('Cross-Path Verification', () => {
    it('should maintain consistency between CLI and API operations', async () => {
      // Install via API, verify via CLI
      const apiToCli = await orchestrator.runCrossPathVerification(
        'api', 'cli', 'filesystem'
      );
      expect(apiToCli.success).toBe(true);

      // Install via CLI, verify via API
      const cliToApi = await orchestrator.runCrossPathVerification(
        'cli', 'api', 'memory'
      );
      expect(cliToApi.success).toBe(true);
    });

    it('should verify WebSocket events for all operations', async () => {
      const result = await orchestrator.runCompleteLifecycle(
        ['filesystem'],
        { verifyCrossPath: true }
      );

      // Verify install events were captured
      const installEvents = result.steps
        .flatMap(s => s.events || [])
        .filter(e => e.type.startsWith('mcp:install'));

      expect(installEvents.some(e => e.type === 'mcp:install-start')).toBe(true);
      expect(installEvents.some(e => e.type === 'mcp:install-complete')).toBe(true);
    });
  });

  describe('Configuration Lifecycle Verification', () => {
    it('should verify auto-configuration applies correct settings', async () => {
      const ctx = orchestrator.getMcpContext();

      // Install filesystem server
      await mcpHelpers.installServer(ctx, 'filesystem');

      // Verify config contents
      const config = await mcpHelpers.getConfig(ctx);
      const serverConfig = config.servers?.['filesystem'];

      expect(serverConfig).toBeDefined();
      expect(serverConfig.name).toBe('filesystem');
      expect(serverConfig.type).toBe('stdio');
      expect(serverConfig.command).toBe('npx');
      expect(serverConfig.args).toContain('@modelcontextprotocol/server-filesystem');
      expect(serverConfig.autoStart).toBe(true);
    });

    it('should maintain config integrity after error', async () => {
      const ctx = orchestrator.getMcpContext();

      // Install valid server
      await mcpHelpers.installServer(ctx, 'filesystem');

      // Attempt to install invalid server
      const result = await mcpHelpers.installServer(ctx, 'nonexistent');
      expect(result.success).toBe(false);

      // Verify original config is intact
      const config = await mcpHelpers.getConfig(ctx);
      expect(config.servers?.['filesystem']).toBeDefined();

      // Verify config is valid
      const validateResult = await mcpHelpers.validate(ctx);
      expect(validateResult.success).toBe(true);
    });
  });
});
```

### 7. Acceptance Criteria Mapping

| Acceptance Criterion | Test Location | Validation |
|---------------------|---------------|------------|
| Listing marketplace entries | `Complete Happy Path > Single Server Full Lifecycle` | Step: browse-marketplace |
| Searching/filtering | `Complete Happy Path > Single Server Full Lifecycle` | Step: select-server |
| Installing a server | `Complete Happy Path > Single Server Full Lifecycle` | Step: install-server |
| Auto-configuration | `Configuration Lifecycle Verification` | verifyAutoConfiguration test |
| Verifying installation | `Complete Happy Path > Single Server Full Lifecycle` | Step: verify-working |
| Uninstallation | `Complete Happy Path > Single Server Full Lifecycle` | Step: uninstall-server |
| Network failure scenarios | `Error Recovery Scenarios > Network Failure Recovery` | runErrorRecoveryScenario('network') |
| Permission error scenarios | `Error Recovery Scenarios > Permission Error Recovery` | runErrorRecoveryScenario('permission') |

### 8. Implementation Order

**Phase 1: Core Infrastructure**
1. Create `integration-test-orchestrator.ts` with basic flow coordination
2. Create `error-injection-utils.ts` with network/permission injection

**Phase 2: Test Implementation**
3. Implement `mcp-complete-flow-integration.e2e.test.ts` with happy path scenarios
4. Add error recovery scenarios
5. Add cross-path verification scenarios

**Phase 3: Verification**
6. Run full test suite
7. Verify build passes
8. Document any platform-specific behaviors

### 9. Platform Considerations

| Feature | Linux/macOS | Windows |
|---------|-------------|---------|
| Permission tests | `chmod` supported | Skip or use `icacls` |
| Network simulation | Full support | Full support |
| Config corruption | Full support | Full support |
| Path handling | Forward slashes | Use `path.join()` |

### 10. Performance Requirements

| Operation | Maximum Duration |
|-----------|-----------------|
| Single server lifecycle | 30 seconds |
| Multi-server lifecycle (3) | 60 seconds |
| Error recovery scenario | 45 seconds |
| Cross-path verification | 20 seconds |
| Complete test suite | 5 minutes |

## Consequences

### Positive
- **Comprehensive coverage**: Single test validates entire MCP flow
- **Error recovery validation**: Tests prove system handles failures gracefully
- **Cross-path consistency**: CLI and API paths verified together
- **Maintainable**: Orchestrator pattern enables easy scenario addition
- **Acceptance criteria met**: All required scenarios covered

### Negative
- **Test complexity**: Orchestrator adds abstraction layer
- **Execution time**: Complete integration tests are slower
- **Infrastructure overhead**: Multiple components to coordinate

### Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| Flaky tests | Use generous timeouts, retry mechanisms |
| Platform differences | Platform guards, skip unsupported scenarios |
| Resource leaks | Comprehensive cleanup in teardown |
| Mock divergence | Regular sync with real implementation |

## References

- ADR-071: MCP Marketplace E2E Test Infrastructure
- ADR-072: MCP Marketplace E2E Flow Tests Architecture
- ADR-076: MCP Marketplace E2E Flow Tests Implementation Design
- ADR-078: Server Selection E2E Test Architecture
- ADR-079: Server Installation E2E Test Architecture
- Existing: `tests/e2e/mcp-marketplace-complete-flow.e2e.test.ts`
- Existing: `tests/e2e/helpers/mcp-e2e-helpers.ts`
