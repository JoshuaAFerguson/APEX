# ADR-146: Server Verification and Full Flow E2E Test Architecture

## Status
Accepted

## Context

The MCP marketplace feature requires comprehensive E2E testing to verify:
1. **Server health check passes** - After installation, the server configuration is valid and responds correctly
2. **Server responds correctly after configuration** - Configured servers work as expected
3. **Full integration test** - Complete flow: `browse → select → install → configure → verify`

### Existing Infrastructure

The current E2E test infrastructure includes:
- **`tests/e2e/mcp-marketplace-complete-flow.e2e.test.ts`** - Complete CLI flow tests
- **`tests/e2e/server-configuration.e2e.test.ts`** - Configuration persistence tests
- **`tests/e2e/server-installation.e2e.test.ts`** - Installation workflow tests
- **`tests/e2e/helpers/mcp-e2e-helpers.ts`** - High-level workflow helpers
- **`tests/e2e/utils/mcp-test-utils.ts`** - Base CLI and config utilities
- **`tests/e2e/setup.ts`** - Global E2E test setup with resource management

### Gap Analysis

While existing tests cover:
- Browse marketplace (`mcp list`)
- Server search (`mcp search`)
- Server installation (`mcp install`)
- Configuration validation (`mcp validate`)
- Status checks (`mcp status`)

They are missing:
- **Server health check verification** after configuration
- **Single E2E scenario** that runs the complete flow as one atomic test
- **Post-configuration server response verification**

## Decision

### 1. New Test File

Create `tests/e2e/server-verification-full-flow.e2e.test.ts` containing:

#### 1.1 Server Health Check Tests

```typescript
describe('E2E: Server Health Check Verification', () => {
  it('should verify server health check passes after installation', async () => {
    // 1. Install server
    // 2. Run mcp validate
    // 3. Verify health check response structure
    // 4. Assert server is in "healthy" state
  });

  it('should verify server responds correctly after configuration', async () => {
    // 1. Install server with custom config
    // 2. Verify configuration was persisted
    // 3. Check server status shows proper state
    // 4. Validate response includes expected fields
  });
});
```

#### 1.2 Full Flow E2E Test

```typescript
describe('E2E: Complete Flow Integration Test', () => {
  it('should run complete flow: browse → select → install → configure → verify', async () => {
    // Single atomic test covering entire flow
  });
});
```

### 2. Test Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│          server-verification-full-flow.e2e.test.ts                       │
│  ├── Server Health Check Verification                                    │
│  │   ├── should verify server health check passes after installation    │
│  │   ├── should verify server responds correctly after configuration    │
│  │   └── should detect unhealthy servers and provide error details      │
│  ├── Complete Flow Integration Test                                      │
│  │   └── should run complete flow: browse → select → install →          │
│  │       configure → verify as single E2E scenario                       │
│  └── Happy Path Verification                                             │
│      └── all happy path tests pass                                       │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    mcp-e2e-helpers.ts (existing)                          │
│  - createMCPTestContext()                                                 │
│  - mcpHelpers.runHappyPathWorkflow()                                      │
│  - mcpHelpers.validate()                                                  │
│  - mcpHelpers.status()                                                    │
│  - mcpHelpers.verifyInstallation()                                        │
│  + mcpHelpers.verifyServerHealth() ← NEW                                  │
│  + mcpHelpers.runFullFlowScenario() ← NEW                                 │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    mcp-test-utils.ts (existing)                           │
│  - execCli() / execMCPCommand()                                           │
│  - readApexConfig() / writeApexConfig()                                   │
│  - assertServerInstalled()                                                │
│  + assertServerHealthy() ← NEW                                            │
│  + parseHealthCheckResponse() ← NEW                                       │
└───────────────────────────────────────────────────────────────────────────┘
```

### 3. Test Case Specifications

#### 3.1 Server Health Check Verification Tests

| Test Case | CLI Commands | Verification |
|-----------|--------------|--------------|
| Health check passes after installation | `mcp install filesystem` → `mcp validate` | Validate response contains `✅`, status is "valid" |
| Server responds correctly after configuration | `mcp install memory` → `mcp status` | Status shows server name, type, autoStart setting |
| Multiple servers health check | Install 3 servers → `mcp validate` | All servers appear valid |
| Health check with custom env vars | Install github server → validate | Env vars properly configured |

#### 3.2 Full Flow E2E Scenario

Single test covering the entire happy path:

```typescript
it('should run complete flow: browse → select → install → configure → verify', async () => {
  const serverName = 'filesystem';
  const ctx = await createMCPTestContext();

  // Step 1: Browse marketplace
  const browseResult = await mcpHelpers.listServers(ctx);
  expect(browseResult.success).toBe(true);
  expect(browseResult.stdout).toContain('MCP Marketplace');
  expect(browseResult.stdout).toContain('Filesystem Server');

  // Step 2: Select server (search for it)
  const searchResult = await mcpHelpers.searchServers(ctx, serverName);
  expect(searchResult.success).toBe(true);
  expect(searchResult.stdout).toContain('Filesystem Server');

  // Step 3: Install server
  const installResult = await mcpHelpers.installServer(ctx, serverName);
  expect(installResult.success).toBe(true);
  expect(installResult.stdout).toContain('✅');

  // Step 4: Configure (verify configuration was applied)
  const config = await mcpHelpers.getConfig(ctx);
  expect(config.servers?.[serverName]).toBeDefined();
  expect(config.servers![serverName].type).toBe('stdio');
  expect(config.servers![serverName].autoStart).toBe(true);

  // Step 5: Verify - Health check passes
  const validateResult = await mcpHelpers.validate(ctx);
  expect(validateResult.success).toBe(true);
  expect(validateResult.stdout).toContain('✅');
  expect(validateResult.stdout).toContain('valid');

  // Step 6: Verify - Server responds correctly
  const statusResult = await mcpHelpers.status(ctx);
  expect(statusResult.success).toBe(true);
  expect(statusResult.stdout).toContain(serverName);

  // Step 7: Verify - Server appears in installed list
  const installedResult = await mcpHelpers.listInstalled(ctx);
  expect(installedResult.success).toBe(true);
  expect(installedResult.stdout).toContain('Filesystem Server');

  await ctx.cleanup();
});
```

### 4. New Helper Functions

Add to `tests/e2e/helpers/mcp-e2e-helpers.ts`:

```typescript
/**
 * Verify server health status
 */
async verifyServerHealth(
  ctx: MCPTestContext,
  serverName: string
): Promise<{ healthy: boolean; details: string }> {
  const validateResult = await this.validate(ctx);
  const statusResult = await this.status(ctx);

  const healthy = validateResult.success &&
    statusResult.stdout.includes(serverName);

  return {
    healthy,
    details: healthy
      ? `Server ${serverName} is healthy`
      : `Server ${serverName} health check failed: ${validateResult.stderr || statusResult.stderr}`,
  };
}

/**
 * Run the complete E2E flow as a single scenario
 */
async runFullFlowScenario(
  ctx: MCPTestContext,
  serverName: string
): Promise<FullFlowResult> {
  const steps: FlowStep[] = [];
  let success = true;

  // Browse
  steps.push(await this.runStep('browse', () => this.listServers(ctx)));

  // Select (search)
  steps.push(await this.runStep('select', () => this.searchServers(ctx, serverName)));

  // Install
  steps.push(await this.runStep('install', () => this.installServer(ctx, serverName)));

  // Configure (verify)
  const config = await this.getConfig(ctx);
  steps.push({
    name: 'configure',
    success: !!config.servers?.[serverName],
    duration: 0,
  });

  // Verify - health check
  steps.push(await this.runStep('verify-health', () => this.validate(ctx)));

  // Verify - response
  steps.push(await this.runStep('verify-response', () => this.status(ctx)));

  return {
    success: steps.every(s => s.success),
    steps,
    totalDuration: steps.reduce((sum, s) => sum + s.duration, 0),
  };
}
```

### 5. Test File Structure

```
tests/e2e/
├── setup.ts                                    # Existing global setup
├── teardown.ts                                 # Existing global teardown
├── server-verification-full-flow.e2e.test.ts   # NEW: This ADR
│   ├── Server Health Check Verification
│   │   ├── health check passes after installation
│   │   ├── server responds correctly after configuration
│   │   └── multiple servers health check
│   ├── Complete Flow Integration Test
│   │   └── browse → select → install → configure → verify
│   └── Happy Path Verification
│       └── all happy path tests pass
├── helpers/
│   └── mcp-e2e-helpers.ts                      # Add new helper methods
└── utils/
    └── mcp-test-utils.ts                       # Add new assertion utilities
```

### 6. Acceptance Criteria Mapping

| Acceptance Criterion | Test Location | Verification |
|---------------------|---------------|--------------|
| Server health check passes | `Server Health Check Verification` suite | `mcp validate` returns success |
| Server responds correctly after configuration | `Server Health Check Verification` suite | `mcp status` shows configured server |
| Full flow integration test | `Complete Flow Integration Test` suite | Single test runs browse→select→install→configure→verify |
| All happy path tests pass | `Happy Path Verification` suite | All tests in suite pass |

### 7. Integration with Existing Tests

The new test file integrates with existing infrastructure:

1. **Uses existing helpers** - `createMCPTestContext()`, `mcpHelpers.*`
2. **Follows existing patterns** - Same setup/teardown, same assertion styles
3. **Shares fixtures** - Uses `FILESYSTEM_SERVER`, `MEMORY_SERVER` from fixtures
4. **Leverages setup.ts** - Global helpers available via `globalThis.apexE2EHelpers`

### 8. Implementation Plan

1. **Phase 1: Add helper functions** to `mcp-e2e-helpers.ts`
   - `verifyServerHealth()`
   - `runFullFlowScenario()`

2. **Phase 2: Create test file** `server-verification-full-flow.e2e.test.ts`
   - Health check verification tests
   - Full flow integration test
   - Happy path verification

3. **Phase 3: Verification**
   - Run `npm run build` - must pass
   - Run `npm run test` - all tests must pass
   - Run `npm run test:e2e` - E2E tests must pass

## Consequences

### Positive
- Complete E2E coverage for server verification flow
- Single atomic test for full browse→verify workflow
- Reusable helper functions for future tests
- Clear acceptance criteria mapping

### Negative
- Additional test file increases suite size
- Full flow test may be slower (~30-60 seconds)
- Depends on CLI being built

### Risks
- Server response format may change, requiring test updates
- Health check behavior may differ across platforms

## References

- ADR-072: MCP Marketplace E2E Flow Tests Architecture
- `tests/e2e/mcp-marketplace-complete-flow.e2e.test.ts`
- `tests/e2e/helpers/mcp-e2e-helpers.ts`
- `tests/e2e/server-configuration.e2e.test.ts`
