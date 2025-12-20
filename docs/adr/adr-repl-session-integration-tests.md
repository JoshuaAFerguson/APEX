# ADR: REPL + Session Integration Tests

## Status
Proposed

## Context

The APEX CLI includes a REPL (Read-Eval-Print Loop) that integrates with session management components (`SessionStore` and `SessionAutoSaver`) to provide persistent session tracking, automatic saving, and state management across REPL operations.

### Existing Test Coverage Analysis

| Test File | Coverage Area | Gap |
|-----------|---------------|-----|
| `SessionStore.test.ts` | Unit tests with mocks | No REPL integration |
| `SessionAutoSaver.test.ts` | Unit tests with mocks | No REPL integration |
| `SessionAutoSaver.integration.test.ts` | Real FS auto-save intervals | No REPL context |
| `session-management.integration.test.ts` | Store + AutoSaver integration | No REPL task execution |
| `session-commands.integration.test.ts` | Command handlers | Isolated from REPL |
| `cli-workflow.integration.test.tsx` | Session lifecycle with mocks | No real FS persistence |
| `repl.integration.test.tsx` | REPL init and auto-start | Missing session integration |

### Gap Identified

There are **no integration tests** specifically covering:
1. **REPL initialization with real SessionStore and SessionAutoSaver** - verifying persistence
2. **Active session tracking during REPL task execution** - the `executeTask` flow
3. **Session state updates (tasksCreated, tasksCompleted, currentTaskId)** - during actual task lifecycle
4. **Cleanup on REPL exit (onExit, SIGINT, SIGTERM handlers)** - with persistence verification

## Decision

Create a new integration test file `repl-session.integration.test.ts` that tests the complete integration between the REPL and session management components.

### Test Architecture

```
packages/cli/src/__tests__/repl-session.integration.test.ts
```

The test file will follow established patterns from:
- `SessionAutoSaver.integration.test.ts` - Real filesystem with fake timers
- `session-commands.integration.test.ts` - Mock context pattern
- `repl.integration.test.tsx` - REPL testing patterns

### Test Strategy

**Testing Approach**: Hybrid approach using:
1. **Real filesystem** for session persistence verification (following `SessionAutoSaver.integration.test.ts` pattern)
2. **Mocked components** for orchestrator and UI interactions
3. **Fake timers** for controlling auto-save timing

### Key Integration Points to Test

Based on code analysis of `repl.tsx`:

| Integration Point | Location (lines) | Test Coverage |
|------------------|------------------|---------------|
| Session initialization in handleInit | 138-145 | REPL initialization with SessionStore |
| Session initialization in startInkREPL | 1704-1714 | REPL initialization with SessionAutoSaver |
| User input tracking | 755-761 | Active session tracking (input history + messages) |
| Task creation tracking | 791-803 | Session state updates (tasksCreated) |
| Task completion tracking | 814-826 | Session state updates (tasksCompleted) |
| Task failure tracking | 835-846 | Session state updates on failure |
| Task error tracking | 857-864 | Session error message tracking |
| onExit cleanup | 1733-1739 | Cleanup on REPL exit |
| Signal handlers (SIGINT) | 1753-1760 | Cleanup on REPL exit |
| Signal handlers (SIGTERM) | 1761-1768 | Cleanup on REPL exit |
| Final cleanup | 1774-1776 | Cleanup on REPL exit |
| Session state sync with app | 1741-1750 | Active session tracking |

### Test Structure

```typescript
describe('REPL + Session Integration Tests', () => {
  describe('REPL Initialization with SessionStore and SessionAutoSaver', () => {
    // AC: REPL initialization with SessionStore and SessionAutoSaver
    it('should initialize SessionStore with project path')
    it('should initialize SessionAutoSaver with SessionStore instance')
    it('should restore last active session on startup')
    it('should create new session when no active session exists')
    it('should sync session info to app state after initialization')
  })

  describe('Active Session Tracking Across REPL Operations', () => {
    // AC: Active session tracking across REPL operations
    it('should track user input in session input history')
    it('should add user messages to session on task input')
    it('should track session messages with correct role and content')
    it('should maintain session state across multiple inputs')
    it('should preserve message order with sequential indexing')
  })

  describe('Session State Updates During Task Execution', () => {
    // AC: Session state updates during task execution
    it('should add task ID to tasksCreated on task creation')
    it('should set currentTaskId when task starts')
    it('should track task creation message with taskId and agent')
    it('should add task ID to tasksCompleted on success')
    it('should clear currentTaskId on task completion')
    it('should track task completion message')
    it('should track task failure message on error')
    it('should clear currentTaskId on task failure')
    it('should handle task creation errors')
  })

  describe('Cleanup on REPL Exit', () => {
    // AC: Cleanup on REPL exit
    it('should call sessionAutoSaver.stop() on normal exit')
    it('should call sessionAutoSaver.stop() on SIGINT')
    it('should call sessionAutoSaver.stop() on SIGTERM')
    it('should save pending changes before stopping')
    it('should handle cleanup errors gracefully')
  })

  describe('End-to-End Session Lifecycle', () => {
    // Combined integration scenarios
    it('should persist complete task lifecycle to session')
    it('should maintain data integrity across restart')
    it('should handle concurrent operations correctly')
  })
})
```

### Mock Strategy

```typescript
// Minimal mocking - prefer real implementations where possible
interface TestContext {
  tempDir: string;                    // Real temp directory
  sessionStore: SessionStore;          // Real SessionStore
  sessionAutoSaver: SessionAutoSaver;  // Real SessionAutoSaver
  mockOrchestrator: MockOrchestrator;  // Mocked - no actual AI calls
  mockApp: MockAppInstance;            // Mocked - no actual UI rendering
  mockConversationManager: MockConversationManager; // Mocked
}
```

### Test Data Factories

```typescript
const createMockTask = (overrides = {}): Task => ({
  id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  description: 'Test task description',
  status: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockApexContext = (overrides = {}): Partial<ApexContext> => ({
  cwd: '/test/project',
  initialized: false,
  config: null,
  orchestrator: null,
  apiProcess: null,
  webUIProcess: null,
  apiPort: undefined,
  webUIPort: undefined,
  app: null,
  sessionStore: null,
  sessionAutoSaver: null,
  conversationManager: null,
  ...overrides,
});
```

### File Dependencies

The test file will depend on:
- `SessionStore` (real implementation)
- `SessionAutoSaver` (real implementation)
- `vitest` test framework
- `fs/promises` for real filesystem operations
- `os` and `path` for temp directory management

### Acceptance Criteria Mapping

| Acceptance Criteria | Test Description |
|---------------------|------------------|
| REPL initialization with SessionStore and SessionAutoSaver | `describe('REPL Initialization...')` |
| Active session tracking across REPL operations | `describe('Active Session Tracking...')` |
| Session state updates during task execution | `describe('Session State Updates...')` |
| Cleanup on REPL exit | `describe('Cleanup on REPL Exit')` |
| All session management integration tests pass with npm test | All tests pass |
| Test coverage meets acceptance criteria from task | Coverage targets met |

## Consequences

### Positive
- Comprehensive test coverage for REPL + session integration
- Real filesystem verification ensures persistence correctness
- Tests document expected behavior for future maintainers
- Catches integration issues between components early
- Follows established patterns from existing test files

### Negative
- Additional test maintenance overhead
- Tests with real filesystem are slower than pure unit tests
- Complex mock setup for orchestrator and UI components

### Risks
- Flaky tests due to timing issues (mitigated with fake timers)
- Temp directory cleanup issues (mitigated with afterEach hooks)

## Implementation Notes

1. **Test File Location**: `packages/cli/src/__tests__/repl-session.integration.test.ts`
2. **Pattern Reference**: Follow `SessionAutoSaver.integration.test.ts` for real filesystem patterns
3. **Timer Management**: Use `vi.useFakeTimers()` for auto-save timing control
4. **Cleanup**: Always clean temp directories in `afterEach` hooks
5. **Mock Scope**: Mock only what's necessary (orchestrator, UI) - use real session components

## References

- Existing tests: `packages/cli/src/__tests__/session-management.integration.test.ts`
- Existing tests: `packages/cli/src/services/__tests__/SessionAutoSaver.integration.test.ts`
- Source: `packages/cli/src/repl.tsx` (lines 138-145, 735-866, 1704-1776)
- Source: `packages/cli/src/services/SessionStore.ts`
- Source: `packages/cli/src/services/SessionAutoSaver.ts`
