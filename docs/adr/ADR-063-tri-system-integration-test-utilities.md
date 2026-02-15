# ADR-063: Tri-System Integration Test Utilities Architecture

## Status
Accepted

## Date
2024-01-15

## Context

APEX requires end-to-end test infrastructure for testing the integration between three core systems:

1. **Tool System** - Core tool infrastructure including Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch, and Browser tools
2. **Permission System** - Access control, authorization, and permission enforcement across all tool operations
3. **Browser Automation** - Web automation capabilities (navigate, click, type, screenshot, etc.)

The acceptance criteria specifies creating `tests/e2e/tri-system-integration/test-utils.ts` with:
- Helper functions for creating test environments with all three systems initialized
- Mock factories specific to combined system testing
- Assertion helpers for tri-system integration scenarios

## Decision

### 1. Architecture Overview

The `test-utils.ts` file will provide a unified testing API that orchestrates all three systems while following established patterns from:
- `tests/test-utils/index.ts` - Central test utilities pattern
- `tests/test-utils/permission-test-helpers.ts` - Permission mocking patterns
- `packages/core/src/test-fixtures/mock-factories.ts` - Mock factory patterns
- `tests/integration/combined-systems.integration.test.ts` - Tri-system integration patterns

### 2. Core Components

#### 2.1 TriSystemTestEnvironment Interface

```typescript
interface TriSystemTestEnvironment {
  // Core Components
  testDir: string;
  orchestrator: ApexOrchestrator;
  taskStore: TaskStore;
  eventEmitter: EventEmitter;

  // System Components
  toolSystem: ToolSystemContext;
  permissionSystem: PermissionSystemContext;
  browserSystem: BrowserSystemContext;

  // Cross-System Event Tracking
  systemEvents: TriSystemEventCapture;

  // Cleanup
  cleanup: () => Promise<void>;
}
```

#### 2.2 System Context Interfaces

```typescript
interface ToolSystemContext {
  registry: ToolRegistry;
  executor: ToolExecutor;
  mocks: ToolMockCollection;
}

interface PermissionSystemContext {
  manager: PermissionManager | MockPermissionManager;
  store: PermissionStore;
  config: PermissionConfig;
}

interface BrowserSystemContext {
  tool: BrowserTool;
  mockPage: MockPage;
  mockBrowser: MockBrowser;
  session: BrowserSession | null;
}
```

### 3. Factory Functions

#### 3.1 Primary Environment Factory

```typescript
async function createTriSystemTestEnvironment(
  options?: TriSystemTestOptions
): Promise<TriSystemTestEnvironment>
```

Options include:
- `toolConfig`: Configure which tools to enable/mock
- `permissionConfig`: Default permission levels, denial scenarios
- `browserConfig`: Browser backend, headless mode, mock level
- `eventConfig`: Event capture and filtering options
- `isolation`: Filesystem, network, environment isolation levels

#### 3.2 Mock Factories

Following the pattern from `mock-factories.ts`:

- `createMockToolSystem()` - Creates a complete mock tool system
- `createMockPermissionSystem()` - Creates a configurable permission system with denial scenarios
- `createMockBrowserSystem()` - Creates mock browser with configurable behaviors
- `createMockTriSystemTask()` - Creates tasks designed for tri-system testing

#### 3.3 Scenario Factories

Pre-configured scenarios for common test cases:

- `createPermissionDeniedScenario()` - Tests permission denial flows
- `createBrowserToolIntegrationScenario()` - Tests browser + tool integration
- `createFullAutonomyScenario()` - Tests full autonomy mode
- `createSupervisedModeScenario()` - Tests supervised mode with approvals

### 4. Assertion Helpers

#### 4.1 Cross-System Assertions

```typescript
// Verify event flow across all three systems
function assertTriSystemEventSequence(
  events: TriSystemEvent[],
  expectedSequence: EventSequence
): void

// Verify permission enforcement on tool operations
function assertPermissionEnforced(
  result: ToolExecutionResult,
  expectedPermission: PermissionLevel
): void

// Verify browser operation respected permissions
function assertBrowserPermissionRespected(
  result: BrowserOperationResult,
  operation: BrowserOperation
): void
```

#### 4.2 System State Assertions

```typescript
// Verify all systems are properly initialized
function assertTriSystemReady(env: TriSystemTestEnvironment): void

// Verify clean shutdown without resource leaks
function assertCleanShutdown(env: TriSystemTestEnvironment): void

// Verify event propagation between systems
function assertCrossSystemEventPropagation(
  source: SystemType,
  target: SystemType,
  eventType: string
): void
```

### 5. Event Capture Architecture

```typescript
interface TriSystemEventCapture {
  // Event storage by system
  toolEvents: SystemEvent[];
  permissionEvents: SystemEvent[];
  browserEvents: SystemEvent[];

  // Cross-system correlation
  correlatedEvents: CorrelatedEventGroup[];

  // Methods
  start(): void;
  stop(): void;
  getEventsBySystem(system: SystemType): SystemEvent[];
  getEventsByType(type: string): SystemEvent[];
  getCorrelatedEvents(correlationId: string): CorrelatedEventGroup;
  expectEventSequence(sequence: EventExpectation[]): void;
  expectCrossSystemEvent(source: SystemType, target: SystemType): void;
}
```

### 6. Directory Structure

```
tests/e2e/tri-system-integration/
├── test-utils.ts              # Main utilities file (this ADR)
├── test-utils.test.ts         # Tests for the utilities themselves
└── scenarios/                 # Pre-built test scenarios (future)
    ├── permission-denied.ts
    ├── browser-tool-flow.ts
    └── full-workflow.ts
```

### 7. Integration with Existing Infrastructure

The utilities will:
1. Re-export commonly used utilities from `tests/test-utils/index.ts`
2. Extend `IntegrationTestEnvironment` from `integration-test-utilities.ts`
3. Use `MockPermissionManager` from `permission-test-helpers.ts`
4. Use mock factories from `packages/core/src/test-fixtures/mock-factories.ts`
5. Follow event capture patterns from `packages/orchestrator/tests/utils/event-capture.ts`

### 8. Type Exports

The module will export:
- All interfaces and types for external consumption
- All factory functions
- All assertion helpers
- Event capture utilities
- Re-exports of commonly used dependencies

## Consequences

### Positive
- Unified API for tri-system integration testing
- Consistent patterns with existing test infrastructure
- Clear separation between system components
- Easy to extend with new scenarios
- Type-safe with full TypeScript support

### Negative
- Additional abstraction layer to maintain
- Need to keep in sync with underlying system changes

### Risks
- Mock fidelity may diverge from actual implementations
- Performance overhead from comprehensive event capture

## Implementation Notes

1. Start with core environment factory and cleanup
2. Add mock factories following existing patterns
3. Implement assertion helpers with clear error messages
4. Add event capture with correlation support
5. Create pre-built scenarios for common test cases
6. Write comprehensive tests for the utilities themselves

## References

- `tests/test-utils/index.ts` - Central test utilities
- `tests/test-utils/permission-test-helpers.ts` - Permission testing patterns
- `packages/core/src/test-fixtures/mock-factories.ts` - Mock factory patterns
- `tests/integration/combined-systems.integration.test.ts` - Tri-system patterns
- `packages/orchestrator/tests/utils/event-capture.ts` - Event capture patterns
