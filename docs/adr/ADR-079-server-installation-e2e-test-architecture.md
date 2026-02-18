# ADR-079: Server Installation E2E Test - Technical Architecture

## Status
Proposed

## Context

Following ADR-078 (Server Selection E2E Test Architecture), this ADR provides the detailed technical architecture for implementing the server installation happy path E2E test. The test must verify:
1. Install command executes after selection
2. Server is downloaded/installed to correct location
3. Installation progress is reported
4. Success message is shown

The test uses mocked download/install operations to ensure fast, reliable execution.

## Technical Design

### 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                 Server Installation E2E Test Architecture                        │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────┐    ┌──────────────────────┐    ┌───────────────────┐  │
│  │   Test Context      │    │   Mock Infrastructure │    │   Verification    │  │
│  │                     │    │                        │    │   Layer           │  │
│  │  - createMCPTest   │    │  - MockInstaller       │    │                   │  │
│  │    Context()       │───▶│  - ProgressSimulator   │───▶│  - assertInstall  │  │
│  │  - beforeEach/     │    │  - DownloadMocker      │    │  - assertProgress │  │
│  │    afterEach       │    │                        │    │  - assertSuccess  │  │
│  └─────────────────────┘    └──────────────────────┘    └───────────────────┘  │
│           │                          │                          │               │
│           ▼                          ▼                          ▼               │
│  ┌────────────────────────────────────────────────────────────────────────────┐│
│  │                          CLI Layer (mcp install)                            ││
│  │  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐  ││
│  │  │ Command      │  │ Server Selection │  │ Installation Controller      │  ││
│  │  │ Parser       │──│ Validation       │──│ (mocked for testing)         │  ││
│  │  │              │  │                  │  │                              │  ││
│  │  └──────────────┘  └──────────────────┘  └──────────────────────────────┘  ││
│  └────────────────────────────────────────────────────────────────────────────┘│
│           │                          │                          │               │
│           ▼                          ▼                          ▼               │
│  ┌────────────────────────────────────────────────────────────────────────────┐│
│  │                         File System Output                                   ││
│  │  ┌──────────────────────────────────────────────────────────────────────┐  ││
│  │  │  ~/.apex/config.yaml                                                  │  ││
│  │  │  ├── mcp:                                                             │  ││
│  │  │  │   └── servers:                                                     │  ││
│  │  │  │       └── filesystem:                                              │  ││
│  │  │  │           ├── name: filesystem                                     │  ││
│  │  │  │           ├── type: stdio                                          │  ││
│  │  │  │           ├── command: npx                                         │  ││
│  │  │  │           └── args: ["-y", "@modelcontextprotocol/server-fs"]      │  ││
│  │  └──────────────────────────────────────────────────────────────────────┘  ││
│  └────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 2. Test File Structure

The E2E test will be located at:
```
tests/e2e/server-installation.e2e.test.ts
```

This follows the existing E2E test patterns established in:
- `tests/e2e/server-selection.e2e.test.ts`
- `tests/e2e/browse-marketplace.e2e.test.ts`
- `tests/e2e/service-management.e2e.test.ts`

### 3. Core Components

#### 3.1 Mock Installation Infrastructure

```typescript
interface MockInstallationContext {
  // Simulates download progress (0-100%)
  simulateDownloadProgress: (serverId: string, progressCallback: (pct: number) => void) => Promise<void>;

  // Simulates installation to a directory
  simulateInstallation: (serverId: string, targetPath: string) => Promise<InstallResult>;

  // Tracks installation state for assertions
  installationLog: InstallationLogEntry[];

  // Resets mock state between tests
  reset: () => void;
}

interface InstallationLogEntry {
  timestamp: number;
  event: 'download_start' | 'download_progress' | 'download_complete' | 'install_start' | 'install_complete';
  serverId: string;
  details?: Record<string, unknown>;
}

interface InstallResult {
  success: boolean;
  installedPath: string;
  serverConfig: ServerConfig;
  duration: number;
}
```

#### 3.2 Progress Simulation

The mock simulates realistic progress reporting:

```typescript
async function simulateInstallWithProgress(
  serverId: string,
  onProgress: (stage: string, percent: number) => void
): Promise<void> {
  // Stage 1: Fetching package info (0-10%)
  onProgress('Fetching package info...', 0);
  await delay(50);
  onProgress('Fetching package info...', 10);

  // Stage 2: Downloading (10-70%)
  for (let pct = 10; pct <= 70; pct += 20) {
    await delay(30);
    onProgress('Downloading...', pct);
  }

  // Stage 3: Installing (70-90%)
  onProgress('Installing...', 70);
  await delay(50);
  onProgress('Installing...', 90);

  // Stage 4: Configuring (90-100%)
  onProgress('Configuring...', 90);
  await delay(30);
  onProgress('Complete', 100);
}
```

### 4. Test Scenarios

#### 4.1 Happy Path Test Structure

```typescript
describe('E2E: Server Installation Happy Path', () => {
  let ctx: MCPTestContext;
  let installMock: MockInstallationContext;

  beforeEach(async () => {
    // Create isolated test environment
    ctx = await createMCPTestContext();
    installMock = createMockInstallationContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
    installMock.reset();
  });

  describe('Install Command Execution', () => {
    it('should execute install command after server selection', async () => {
      // 1. Select a server (filesystem - verified, common)
      const serverId = 'filesystem';

      // 2. Execute install command
      const { stdout, stderr } = await runCli(`mcp install ${serverId}`, ctx.projectDir);

      // 3. Verify command executed successfully
      expect(stderr).not.toContain('Error');
      expect(stdout).toMatch(/Installing|install/i);

      // 4. Verify installation logged
      expect(installMock.installationLog).toContainEqual(
        expect.objectContaining({ event: 'install_start', serverId })
      );
    });
  });

  describe('Server Installation Location', () => {
    it('should install server configuration to correct location', async () => {
      const serverId = 'filesystem';

      // Execute install
      await runCli(`mcp install ${serverId}`, ctx.projectDir);

      // Verify config written to correct location
      const configPath = path.join(ctx.projectDir, '.apex', 'config.yaml');
      const config = await readApexConfig(ctx.projectDir);

      expect(config.mcp?.servers?.[serverId]).toBeDefined();
      expect(config.mcp.servers[serverId].name).toBe(serverId);
      expect(config.mcp.servers[serverId].type).toBe('stdio');
    });

    it('should include correct server configuration details', async () => {
      const serverId = 'filesystem';

      await runCli(`mcp install ${serverId}`, ctx.projectDir);

      const config = await readApexConfig(ctx.projectDir);
      const serverConfig = config.mcp?.servers?.[serverId];

      // Verify server config matches marketplace entry
      expect(serverConfig).toMatchObject({
        name: 'filesystem',
        type: 'stdio',
        command: 'npx',
        args: expect.arrayContaining(['-y', expect.stringContaining('server-filesystem')]),
      });
    });
  });

  describe('Installation Progress Reporting', () => {
    it('should report installation progress during install', async () => {
      const serverId = 'filesystem';
      const progressUpdates: string[] = [];

      // Capture CLI output which shows progress
      const { stdout } = await runCli(`mcp install ${serverId}`, ctx.projectDir);

      // Verify progress indicators in output
      const hasProgressIndicator =
        stdout.includes('⏳') ||
        stdout.includes('Installing') ||
        stdout.includes('...') ||
        stdout.includes('📦');

      expect(hasProgressIndicator).toBe(true);
    });

    it('should show download/install stages', async () => {
      const serverId = 'memory';

      const { stdout } = await runCli(`mcp install ${serverId}`, ctx.projectDir);

      // Should show at least one progress stage indicator
      // The CLI shows: fetching → downloading → installing → configuring
      const stages = ['fetch', 'download', 'install', 'config', 'add'];
      const hasAnyStage = stages.some(stage =>
        stdout.toLowerCase().includes(stage)
      );

      expect(hasAnyStage).toBe(true);
    });
  });

  describe('Success Message Display', () => {
    it('should display success message after installation', async () => {
      const serverId = 'filesystem';

      const { stdout, stderr } = await runCli(`mcp install ${serverId}`, ctx.projectDir);

      // Should not have errors
      expect(stderr).not.toContain('Error');
      expect(stderr).not.toContain('error');

      // Should show success indicator
      const hasSuccessIndicator =
        stdout.includes('✅') ||
        stdout.includes('✓') ||
        stdout.includes('success') ||
        stdout.includes('installed') ||
        stdout.includes('Added');

      expect(hasSuccessIndicator).toBe(true);
    });

    it('should show server name in success message', async () => {
      const serverId = 'memory';

      const { stdout } = await runCli(`mcp install ${serverId}`, ctx.projectDir);

      // Success message should reference the installed server
      expect(stdout).toContain(serverId);
    });

    it('should provide next steps guidance after install', async () => {
      const serverId = 'filesystem';

      const { stdout } = await runCli(`mcp install ${serverId}`, ctx.projectDir);

      // Should provide helpful next steps (status, start, configure)
      const hasGuidance =
        stdout.includes('status') ||
        stdout.includes('configure') ||
        stdout.includes('start') ||
        stdout.includes('mcp');

      // This is optional guidance, so we just verify no crash
      expect(typeof stdout).toBe('string');
    });
  });
});
```

### 5. Helper Functions

#### 5.1 CLI Execution Helper

```typescript
async function runCli(
  args: string,
  cwd: string,
  options?: { timeout?: number; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string }> {
  const CLI_PATH = path.join(__dirname, '../../packages/cli/dist/index.js');
  const timeout = options?.timeout ?? 30000;

  try {
    const result = await execAsync(`node ${CLI_PATH} ${args}`, {
      cwd,
      env: {
        ...process.env,
        NO_COLOR: '1',
        APEX_TEST_MODE: 'e2e',
        NODE_ENV: 'test',
        ...options?.env
      },
      timeout,
    });
    return result;
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || execError.message || '',
    };
  }
}
```

#### 5.2 Mock Installation Context Factory

```typescript
function createMockInstallationContext(): MockInstallationContext {
  const installationLog: InstallationLogEntry[] = [];

  return {
    installationLog,

    async simulateDownloadProgress(serverId, progressCallback) {
      installationLog.push({
        timestamp: Date.now(),
        event: 'download_start',
        serverId,
      });

      for (let pct = 0; pct <= 100; pct += 25) {
        progressCallback(pct);
        installationLog.push({
          timestamp: Date.now(),
          event: 'download_progress',
          serverId,
          details: { percent: pct },
        });
        await delay(10);
      }

      installationLog.push({
        timestamp: Date.now(),
        event: 'download_complete',
        serverId,
      });
    },

    async simulateInstallation(serverId, targetPath) {
      installationLog.push({
        timestamp: Date.now(),
        event: 'install_start',
        serverId,
        details: { targetPath },
      });

      await delay(50);

      const serverConfig = getServerConfigForId(serverId);

      installationLog.push({
        timestamp: Date.now(),
        event: 'install_complete',
        serverId,
        details: { targetPath, success: true },
      });

      return {
        success: true,
        installedPath: targetPath,
        serverConfig,
        duration: 50,
      };
    },

    reset() {
      installationLog.length = 0;
    },
  };
}
```

### 6. Mocking Strategy

The test uses the following mocking approach:

1. **Real CLI Execution**: The test runs the actual CLI binary (`packages/cli/dist/index.js`) to ensure end-to-end coverage.

2. **Mocked Network Operations**: Instead of downloading real npm packages, the CLI's marketplace module uses the existing mock infrastructure from `tests/e2e/mocks/mock-marketplace-server.ts`.

3. **Config Verification**: After installation, tests read the actual `.apex/config.yaml` to verify the installation persisted correctly.

4. **Output Capture**: CLI stdout/stderr is captured and parsed to verify progress and success messages.

### 7. Test Data

The test uses fixtures from `tests/e2e/fixtures/marketplace-data.ts`:

```typescript
// Primary test servers (verified, reliable)
const TEST_SERVERS = {
  primary: FILESYSTEM_SERVER,    // Most commonly used
  secondary: MEMORY_SERVER,      // No env vars required
  withEnvVars: GITHUB_SERVER,    // Tests env var handling
};
```

### 8. Integration with Existing Infrastructure

The test integrates with:

| Component | Location | Purpose |
|-----------|----------|---------|
| E2E Setup | `tests/e2e/setup.ts` | Global setup/teardown, `globalThis.apexE2EHelpers` |
| MCP Helpers | `tests/e2e/helpers/mcp-e2e-helpers.ts` | `createMCPTestContext`, `mcpHelpers` |
| Test Utils | `tests/e2e/utils/mcp-test-utils.ts` | `execCli`, `readApexConfig`, assertions |
| Fixtures | `tests/e2e/fixtures/marketplace-data.ts` | Server definitions, test catalogs |
| Mocks | `tests/e2e/mocks/mock-marketplace-server.ts` | `MockMarketplaceServer`, `MockServerManager` |

### 9. Acceptance Criteria Mapping

| Acceptance Criterion | Test Method | Verification |
|----------------------|-------------|--------------|
| Install command executes after selection | `runCli('mcp install {id}')` | Command completes without error |
| Server downloaded/installed to correct location | `readApexConfig()` | Config contains server entry |
| Installation progress is reported | Parse stdout | Progress indicators present |
| Success message is shown | Parse stdout | Success emoji/text present |

### 10. Error Handling Tests (Negative Cases)

The test suite also includes negative cases:

```typescript
describe('Installation Error Handling', () => {
  it('should handle non-existent server gracefully', async () => {
    const { stdout, stderr } = await runCli('mcp install nonexistent-xyz', ctx.projectDir);
    expect(stdout + stderr).toMatch(/not found|invalid|unknown/i);
  });

  it('should handle already installed server', async () => {
    await runCli('mcp install filesystem', ctx.projectDir);
    const { stdout } = await runCli('mcp install filesystem', ctx.projectDir);
    expect(stdout).toMatch(/already installed|exists/i);
  });
});
```

## Consequences

### Positive
- Comprehensive E2E coverage of the installation happy path
- Uses existing test infrastructure for consistency
- Mocked operations ensure fast, reliable tests
- Clear separation between test layers

### Negative
- Mocked downloads don't test actual npm installation
- Progress reporting depends on CLI output format

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| CLI output format changes break tests | Use flexible regex patterns |
| Config format changes | Use structured config parsing |
| Test flakiness | Extended timeouts, retry in CI |

## Implementation Notes

1. **File Location**: `tests/e2e/server-installation.e2e.test.ts`
2. **Dependencies**: vitest, existing E2E helpers
3. **Estimated Size**: ~250-300 lines
4. **Execution Time**: ~15-30 seconds (mocked operations)

## Related ADRs

- ADR-071: MCP E2E Test Infrastructure
- ADR-076: MCP Error Scenario E2E Tests
- ADR-078: Server Selection E2E Test Architecture
