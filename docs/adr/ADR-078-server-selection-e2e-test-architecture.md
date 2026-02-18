# ADR-078: Server Selection E2E Test Architecture

## Status
Proposed

## Context

The APEX MCP marketplace feature allows users to browse, search, select, and install MCP servers. While existing E2E tests cover the browse and search functionality (`tests/e2e/browse-marketplace.e2e.test.ts`), there is a gap in testing the **server selection happy path** - specifically verifying that:

1. User can select a server from browse results
2. Selection is validated
3. Selected server details are displayed correctly
4. Test properly mocks user input selection

### Existing Test Infrastructure

The codebase has a robust E2E test infrastructure (per ADR-071):

| File | Purpose |
|------|---------|
| `tests/e2e/helpers/mcp-e2e-helpers.ts` | High-level workflow helpers |
| `tests/e2e/utils/mcp-test-utils.ts` | Base utilities (CLI exec, config manipulation) |
| `tests/e2e/fixtures/marketplace-data.ts` | Static fixture data for marketplace entries |
| `tests/e2e/mocks/mock-marketplace-server.ts` | Configurable mock MCP servers |
| `tests/e2e/mcp-marketplace.e2e.test.ts` | Existing CLI happy path tests |

### Current Gap Analysis

The existing "Search & Select Server" tests in `mcp-marketplace.e2e.test.ts` cover:
- Search by server name
- Search by tag
- JSON output for search results
- No-match search handling

However, they do **not** cover:
- Interactive server selection flow
- Selection validation against browse results
- Display of selected server details
- Mocking of user input for selection

### Inquirer Mocking Pattern

The codebase uses `inquirer` for interactive prompts. Existing tests mock this via:

```typescript
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// In tests:
mockInquirerPrompt.mockResolvedValue({ selectedServers: ['filesystem'] });
```

## Decision

### Technical Design for Server Selection E2E Test

#### 1. Test File Location
```
tests/e2e/server-selection.e2e.test.ts
```

#### 2. Test Structure

```typescript
describe('E2E: Server Selection Happy Path', () => {
  describe('Select from Browse Results', () => {
    it('should retrieve server list and allow selection by ID');
    it('should validate selection exists in browse results');
    it('should reject selection of non-existent server ID');
  });

  describe('Selected Server Details Display', () => {
    it('should display server name and description after selection');
    it('should display server capabilities');
    it('should display verification status');
    it('should display configuration requirements (env vars)');
  });

  describe('User Input Mocking', () => {
    it('should mock single server selection');
    it('should mock multiple server selection');
    it('should handle selection cancellation');
  });

  describe('Selection to Installation Flow', () => {
    it('should proceed to install after valid selection');
    it('should prevent install of invalid selection');
  });
});
```

#### 3. Key Interfaces

```typescript
/**
 * Server selection test context extending MCPTestContext
 */
interface ServerSelectionTestContext extends MCPTestContext {
  /** Servers available from browse/list command */
  availableServers: MarketplaceEntry[];
  /** Currently selected server ID(s) */
  selectedServerIds: string[];
}

/**
 * Server selection result for assertions
 */
interface SelectionResult {
  valid: boolean;
  selectedServer?: MarketplaceEntry;
  error?: string;
  displayedDetails?: {
    name: string;
    description: string;
    capabilities: string[];
    verified: boolean;
    envVars?: string[];
  };
}

/**
 * Mock user selection input
 */
interface MockSelectionInput {
  type: 'single' | 'multiple' | 'cancel';
  serverIds?: string[];
  cancelAfterMs?: number;
}
```

#### 4. Helper Functions

```typescript
// In tests/e2e/helpers/selection-helpers.ts

/**
 * Get available servers from browse command (JSON output)
 */
async function getAvailableServers(ctx: MCPTestContext): Promise<MarketplaceEntry[]>;

/**
 * Simulate user selection from available servers
 */
async function simulateServerSelection(
  ctx: MCPTestContext,
  mockInput: MockSelectionInput
): Promise<SelectionResult>;

/**
 * Validate selection against available servers
 */
function validateSelection(
  availableServers: MarketplaceEntry[],
  selectedIds: string[]
): { valid: boolean; invalidIds: string[] };

/**
 * Extract and verify displayed server details
 */
function assertServerDetails(
  output: string,
  expectedServer: MarketplaceEntry
): void;
```

#### 5. Test Implementation Strategy

**Approach 1: CLI-based Selection (Recommended for E2E)**

Since `mcp list --json` provides server data programmatically, the E2E test can:
1. Call `mcp list --json` to get available servers
2. Select a server ID from the results
3. Call `mcp install <selected-id>` to install
4. Verify installation via `mcp installed --json`

This approach avoids needing to mock `inquirer` at the E2E level (inquirer mocking is more appropriate for unit/integration tests).

```typescript
it('should select and install server from browse results', async () => {
  // Step 1: Browse available servers
  const { stdout } = await runCli('mcp list --json', testDir);
  const servers = JSON.parse(stdout);
  expect(servers.length).toBeGreaterThan(0);

  // Step 2: Select first verified server
  const selectedServer = servers.find((s: any) => s.verified === true);
  expect(selectedServer).toBeDefined();

  // Step 3: Validate selection exists
  const serverIds = servers.map((s: any) => s.id);
  expect(serverIds).toContain(selectedServer.id);

  // Step 4: Install selected server
  const { stdout: installOutput } = await runCli(
    `mcp install ${selectedServer.id}`,
    testDir
  );
  expect(installOutput).toContain('installed');

  // Step 5: Verify details are displayed correctly
  const { stdout: detailsOutput } = await runCli('mcp installed', testDir);
  expect(detailsOutput).toContain(selectedServer.name);
  expect(detailsOutput).toContain(selectedServer.id);
});
```

**Approach 2: Unit-level Selection Mocking (For Interactive Flow)**

For testing the `mcp init` interactive flow that uses `inquirer.prompt`:

```typescript
// This belongs in packages/cli/src/__tests__/ as a unit/integration test
vi.mock('inquirer', () => ({
  default: { prompt: vi.fn() }
}));

it('should handle interactive server selection', async () => {
  mockInquirerPrompt
    .mockResolvedValueOnce({ enableMCP: true })
    .mockResolvedValueOnce({ selectedServers: ['filesystem', 'memory'] });

  await mcpCommand.handler(mockContext, ['init']);

  expect(mockSaveConfig).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      mcp: expect.objectContaining({
        servers: expect.objectContaining({
          filesystem: expect.any(Object),
          memory: expect.any(Object)
        })
      })
    })
  );
});
```

#### 6. Test Data Requirements

Add to `tests/e2e/fixtures/marketplace-data.ts`:

```typescript
/**
 * Server selection test scenarios
 */
export const SELECTION_TEST_CASES = [
  {
    scenario: 'single verified server',
    selectServerIds: ['filesystem'],
    expectedValid: true,
    expectedDetails: {
      name: 'Filesystem Server',
      verified: true,
    },
  },
  {
    scenario: 'multiple servers',
    selectServerIds: ['filesystem', 'memory'],
    expectedValid: true,
  },
  {
    scenario: 'non-existent server',
    selectServerIds: ['nonexistent-server-xyz'],
    expectedValid: false,
    expectedError: 'not found',
  },
  {
    scenario: 'empty selection',
    selectServerIds: [],
    expectedValid: false,
    expectedError: 'No servers selected',
  },
];
```

#### 7. Validation Rules

The selection validation should check:

1. **Existence**: Selected server ID must exist in browse results
2. **Format**: Server ID must be a valid non-empty string
3. **Uniqueness**: No duplicate selections allowed
4. **Availability**: Server must not already be installed (warn only)

#### 8. Display Verification

After selection, the test should verify these details are displayed:

| Field | Source | Verification |
|-------|--------|--------------|
| Server Name | `MarketplaceEntry.name` | Exact match |
| Description | `MarketplaceEntry.description` | Contains substring |
| Capabilities | `MarketplaceEntry.capabilities` | All listed |
| Verified Status | `MarketplaceEntry.verified` | Checkbox/badge shown |
| Category | `MarketplaceEntry.category` | Category icon/label |
| Required Env Vars | `MarketplaceEntry.serverConfig.env` | All listed with required indicator |

### Integration Points

1. **With existing helpers**: Uses `mcpHelpers` from `mcp-e2e-helpers.ts`
2. **With fixtures**: Uses entries from `marketplace-data.ts`
3. **With CLI execution**: Uses `execMCPCommand` and `execMCPCommandJson`
4. **With assertions**: Uses `assertServerInstalled`, `assertOutputContains`

### Implementation Order

1. Create `tests/e2e/server-selection.e2e.test.ts`
2. Add selection test cases to `marketplace-data.ts`
3. Implement E2E tests using CLI commands
4. (Optional) Add helper functions to `selection-helpers.ts` if reuse is needed

## Consequences

### Positive
- Completes test coverage for server selection happy path
- Uses existing infrastructure (no new dependencies)
- E2E tests use real CLI commands for realistic coverage
- Clear separation: E2E for CLI flow, unit tests for inquirer mocking

### Negative
- Cannot test interactive prompts at E2E level (by design)
- Selection validation is implicit via install success/failure

### Risks Mitigated
- Selection validation errors caught before install
- Display format regressions detected
- Browse → Select → Install flow verified end-to-end
