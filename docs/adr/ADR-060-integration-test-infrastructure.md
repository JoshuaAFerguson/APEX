# ADR-060: Integration Test Infrastructure and Utilities

## Status

Proposed

## Context

APEX v0.5.0 requires comprehensive integration testing infrastructure for tools, permissions, and browser automation. The acceptance criteria mandate:

- Test utilities, fixtures, and mock factories for tools, permissions, and browser automation
- Test setup/teardown helpers available across the codebase

### Existing Infrastructure Analysis

The codebase already has extensive test utilities across several locations:

1. **Central Test Utils** (`tests/test-utils/`):
   - `index.ts` - Core utilities, environment setup, fixture exports
   - `context.ts` - TestContext, MockManager, EventTracker, DatabaseTestContext
   - `async.ts` - Async helpers (wait, waitFor, retry, parallel)
   - `assertions.ts` - Enhanced assertions (expectToThrow, expectObjectShape, etc.)
   - `cleanup.ts` - CleanupManager with FileSystem, Process, Environment, Mock, Timer cleanup

2. **Confirmation Flow Testing** (`tests/fixtures/` and `tests/utils/`):
   - `confirmation-flows.ts` - Permission, dangerous operation, and approval gate factories
   - `confirmation-simulator.ts` - ConfirmationSimulator class for simulating user responses

3. **Event Capture** (`packages/orchestrator/tests/utils/`):
   - `event-capture.ts` - EventCapture class for capturing and asserting on orchestrator events

4. **Browser Integration** (`tests/browser-integration/`):
   - `setup.ts` - Browser instance management, Playwright integration
   - `utils/test-helpers.ts` - Screenshot, element interaction, performance utilities
   - `fixtures/common-scenarios.ts` - Navigation, interaction, console scenarios

5. **Core Test Fixtures** (`packages/core/src/test-fixtures/`):
   - `index.ts` - Barrel exports with ErrorPresets
   - `types.ts` - ToolResponseOptions, TaskFactoryOptions, BrowserState, MockConfig
   - `factories/tool-factory.ts` - createToolResult, createToolExecution, ToolResponsePresets
   - `browser-fixtures.ts` - browserFixtures with state scenarios

6. **Integration Setup** (`tests/integration/setup.ts`):
   - IntegrationTestContext with temp directory management
   - ConfirmationTestHelpers with resource registration
   - Minimal APEX project creation utilities

## Decision

### Architecture Overview

We will **consolidate and enhance** the existing infrastructure rather than creating new parallel systems. The architecture follows a layered approach:

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEST FILE (e.g., *.test.ts)                   │
├─────────────────────────────────────────────────────────────────┤
│                    Test Fixtures Layer                           │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │ Tool Mocks   │  │ Permission     │  │ Browser State       │  │
│  │ & Factories  │  │ Fixtures       │  │ Fixtures            │  │
│  └──────────────┘  └────────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Test Utilities Layer                          │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │ Confirmation │  │ Event          │  │ Browser             │  │
│  │ Simulator    │  │ Capture        │  │ Test Helpers        │  │
│  └──────────────┘  └────────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Test Context Layer                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ TestContext + MockManager + CleanupManager + EventTracker │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                    Setup/Teardown Layer                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Global Hooks + Resource Registration + Auto-Cleanup       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Design Decisions

#### 1. Unified Test Context Factory

Create a unified `createIntegrationTestContext()` that combines all test context capabilities:

```typescript
interface IntegrationTestContextOptions {
  withDatabase?: boolean;
  withBrowser?: boolean;
  withMocks?: boolean;
  withEventCapture?: boolean;
  withConfirmationSimulator?: boolean;
  projectPath?: string;
}

interface IntegrationTestContext {
  // Core context
  id: string;
  tempDir: string;
  cleanup: CleanupManager;

  // Optional components (based on options)
  db?: { path: string; store: TaskStore };
  browser?: { context: BrowserContext; page: Page };
  mocks?: MockManager;
  events?: EventCapture;
  confirmations?: ConfirmationSimulator;
  orchestrator?: ApexOrchestrator;
}
```

#### 2. Mock Factory Registry

Centralize all mock factories in a registry pattern:

```typescript
const MockFactories = {
  tools: {
    read: createToolMock('Read'),
    write: createToolMock('Write'),
    edit: createToolMock('Edit'),
    bash: createToolMock('Bash'),
    glob: createToolMock('Glob'),
    grep: createToolMock('Grep'),
    webFetch: createToolMock('WebFetch'),
    webSearch: createToolMock('WebSearch'),
    // Browser tools
    browserNavigate: createBrowserToolMock('BrowserNavigate'),
    browserClick: createBrowserToolMock('BrowserClick'),
    browserType: createBrowserToolMock('BrowserType'),
    browserScreenshot: createBrowserToolMock('BrowserScreenshot'),
  },

  permissions: {
    request: createMockPermissionRequest,
    granted: createMockPermissionGranted,
    denied: createMockPermissionDenied,
  },

  dangerousOperations: {
    detected: createMockDangerousOperationDetected,
    confirmed: createMockDangerousOperationConfirmed,
    blocked: createMockDangerousOperationBlocked,
  },

  approvals: {
    required: createMockApprovalRequired,
    granted: createMockApprovalGranted,
    denied: createMockApprovalDenied,
    resolved: createMockApprovalResolved,
  },

  browser: {
    cleanState: browserFixtures.cleanState,
    loggedInPage: browserFixtures.loggedInPage,
    errorPage: browserFixtures.errorPage,
    loadingPage: browserFixtures.loadingPage,
    offlinePage: browserFixtures.offlinePage,
    permissionDeniedPage: browserFixtures.permissionDeniedPage,
  },
};
```

#### 3. Enhanced Setup/Teardown Helpers

Provide composable setup/teardown helpers that work with vitest:

```typescript
// Setup helper that returns cleanup function
export async function setupIntegrationTest(
  options: IntegrationTestContextOptions = {}
): Promise<{
  context: IntegrationTestContext;
  teardown: () => Promise<void>;
}>;

// Declarative test wrapper
export async function withIntegrationTest<T>(
  options: IntegrationTestContextOptions,
  testFn: (context: IntegrationTestContext) => Promise<T>
): Promise<T>;

// Vitest hooks helper
export function useIntegrationTestHooks(
  options: IntegrationTestContextOptions
): {
  getContext: () => IntegrationTestContext;
};
```

#### 4. Tool Mock Builders

Create fluent builders for complex tool mocking scenarios:

```typescript
const toolMock = ToolMockBuilder.create('Read')
  .withSuccessResponse({ content: 'file content', encoding: 'utf-8' })
  .withErrorOnSecondCall('ENOENT')
  .withLatency(100)
  .requiresPermission('allow-always')
  .build();
```

#### 5. Permission Testing Utilities

Extend the existing confirmation-flows with permission-specific helpers:

```typescript
// Pre-configured permission scenarios
const PermissionScenarios = {
  fileReadApproved: () => ({ /* ... */ }),
  fileWriteDenied: () => ({ /* ... */ }),
  bashExecutionRequiresConfirmation: () => ({ /* ... */ }),
  browserNavigationBlocked: () => ({ /* ... */ }),
};

// Permission flow assertions
const PermissionAssertions = {
  expectPermissionRequested: (capture: EventCapture, tool: string) => void,
  expectPermissionGranted: (capture: EventCapture, tool: string, level: PermissionLevel) => void,
  expectPermissionDenied: (capture: EventCapture, tool: string) => void,
  expectNoPermissionRequired: (capture: EventCapture, tool: string) => void,
};
```

#### 6. Browser Automation Testing

Enhance browser testing with APEX-specific utilities:

```typescript
// Browser automation test context
interface BrowserTestContext {
  page: Page;
  mockOrchestrator: MockOrchestrator;

  // APEX-specific helpers
  simulateAgentInteraction: (action: AgentAction) => Promise<void>;
  captureToolExecution: (tool: string) => Promise<ToolExecution>;
  verifyUIState: (expected: UIState) => Promise<void>;
}

// Browser scenario runner
async function runBrowserScenario(
  scenario: BrowserScenario,
  context: BrowserTestContext
): Promise<ScenarioResult>;
```

### File Structure

```
tests/
├── test-utils/
│   ├── index.ts                    # Central barrel export (enhanced)
│   ├── context.ts                  # Test context management
│   ├── async.ts                    # Async utilities
│   ├── assertions.ts               # Enhanced assertions
│   ├── cleanup.ts                  # Cleanup management
│   └── integration/                # NEW: Integration-specific utilities
│       ├── index.ts                # Integration test helpers barrel
│       ├── unified-context.ts      # Unified test context factory
│       ├── mock-registry.ts        # Centralized mock factory registry
│       └── vitest-helpers.ts       # Vitest-specific helpers
├── fixtures/
│   ├── confirmation-flows.ts       # Permission/approval fixtures
│   └── integration/                # NEW: Integration test fixtures
│       ├── tool-scenarios.ts       # Complex tool interaction scenarios
│       └── permission-scenarios.ts # Permission flow scenarios
├── utils/
│   ├── confirmation-simulator.ts   # User response simulation
│   └── tool-mock-builder.ts        # NEW: Fluent tool mock builder
├── browser-integration/
│   ├── setup.ts                    # Browser setup
│   ├── utils/test-helpers.ts       # Browser helpers
│   └── apex-helpers/               # NEW: APEX-specific browser helpers
│       ├── index.ts                # APEX browser helpers barrel
│       ├── orchestrator-mock.ts    # Browser orchestrator mock
│       └── ui-assertions.ts        # UI state assertions
└── integration/
    ├── setup.ts                    # Integration setup (enhanced)
    └── vitest.config.ts            # Integration test config

packages/core/src/test-fixtures/
├── index.ts                        # Barrel exports (enhanced)
├── types.ts                        # Type definitions
├── factories/                      # Factory functions
│   ├── index.ts
│   ├── tool-factory.ts             # Tool factories
│   ├── permission-factory.ts       # NEW: Permission factories
│   └── browser-factory.ts          # NEW: Browser state factories
├── builders/                       # Builder classes
│   ├── index.ts
│   └── tool-mock-builder.ts        # NEW: Tool mock builder
└── scenarios/                      # NEW: Pre-built test scenarios
    ├── index.ts
    ├── tool-scenarios.ts
    ├── permission-scenarios.ts
    └── browser-scenarios.ts
```

### Integration Points

1. **With Orchestrator**: The test utilities integrate with ApexOrchestrator via EventEmitter events
2. **With Permission System**: Mock factories produce correctly-typed permission events
3. **With Browser Automation**: Browser test context integrates with Playwright/Puppeteer
4. **With Database**: DatabaseTestContext creates isolated SQLite databases

### Usage Examples

```typescript
// Example 1: Basic permission testing
import { setupIntegrationTest, MockFactories, PermissionAssertions } from 'tests/test-utils';

describe('Permission flow', () => {
  const { context, teardown } = await setupIntegrationTest({
    withDatabase: true,
    withEventCapture: true,
    withConfirmationSimulator: true,
  });

  afterAll(teardown);

  it('should request permission for file write', async () => {
    // Arrange
    context.confirmations.simulateUserApproval(/.*/, { level: 'allow-once' });

    // Act
    await context.orchestrator.executeTask(taskWithFileWrite);

    // Assert
    PermissionAssertions.expectPermissionRequested(context.events, 'Write');
    PermissionAssertions.expectPermissionGranted(context.events, 'Write', 'allow-once');
  });
});

// Example 2: Browser automation with APEX
import { withBrowserTest } from 'tests/browser-integration';

describe('Browser tool integration', () => {
  it('should capture screenshot on command', async () => {
    await withBrowserTest(async (ctx) => {
      // Navigate to test page
      await ctx.page.goto('about:blank');

      // Simulate agent screenshot command
      const execution = await ctx.captureToolExecution('BrowserScreenshot');

      // Verify
      expect(execution.result.success).toBe(true);
      expect(execution.result.output).toMatch(/screenshot captured/i);
    });
  });
});

// Example 3: Tool mock with builder
import { ToolMockBuilder } from 'tests/utils/tool-mock-builder';

const readMock = ToolMockBuilder.create('Read')
  .withSuccessResponse({ content: 'config data' })
  .withErrorAfterCalls(2, 'ENOENT')
  .build();
```

## Consequences

### Positive

1. **Unified API**: Single entry point for test setup reduces cognitive load
2. **Composable**: Components can be used independently or together
3. **Type-safe**: Full TypeScript support with proper generics
4. **Backward compatible**: Existing tests continue to work
5. **Maintainable**: Clear separation of concerns in file structure

### Negative

1. **Learning curve**: Developers need to learn the unified API
2. **Migration effort**: Some existing tests may benefit from migration
3. **Complexity**: More abstraction layers to understand

### Neutral

1. **File organization**: New directories require understanding
2. **Documentation**: Comprehensive docs needed for adoption

## Implementation Plan

1. **Phase 1**: Create unified context factory and mock registry
2. **Phase 2**: Add tool mock builder and permission scenarios
3. **Phase 3**: Enhance browser automation helpers
4. **Phase 4**: Update barrel exports and documentation
5. **Phase 5**: Create example tests demonstrating usage

## References

- Existing test utils: `tests/test-utils/`
- Confirmation flows: `tests/fixtures/confirmation-flows.ts`
- Event capture: `packages/orchestrator/tests/utils/event-capture.ts`
- Browser integration: `tests/browser-integration/`
- Core fixtures: `packages/core/src/test-fixtures/`
