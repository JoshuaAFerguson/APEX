# ADR-043: Session Command Integration Tests Architecture

## Status
Proposed

## Context
APEX CLI provides session management capabilities through the `/session` command with multiple subcommands (create, load, save, branch, export, delete, info). These commands interact with `SessionStore` and `SessionAutoSaver` services to manage persistent conversation sessions. Integration tests are needed to verify that these commands function correctly end-to-end.

## Decision

### Test Architecture Overview

We will create a dedicated integration test file `session-commands.integration.test.ts` that tests the session command handlers in isolation from the full REPL, following the established patterns in the codebase.

```
packages/cli/src/__tests__/
├── session-management.integration.test.ts  # Existing: SessionStore + SessionAutoSaver integration
├── repl.integration.test.tsx              # Existing: REPL initialization tests
└── session-commands.integration.test.ts   # NEW: Session command handler integration tests
```

### Test Scope

The integration tests will cover the following acceptance criteria:

| Command | Handler | Test Coverage |
|---------|---------|---------------|
| `/session create` | `handleSession()` → auto-creates on start | Session creation via SessionAutoSaver.start() |
| `/session load` | `handleSessionLoad(sessionId)` | Load existing, save before switch, error cases |
| `/session save` | `handleSessionSave(args)` | Name assignment, tags, persistence |
| `/session branch` | `handleSessionBranch(args)` | Branch from index, auto-naming, validation |
| `/session export` | `handleSessionExport(args)` | MD/JSON/HTML formats, file output |
| `/session delete` | `handleSessionDelete(sessionId)` | Delete existing, error cases |
| `/session info` | `handleSessionInfo()` | Display current session metadata |

### Test Strategy

#### 1. Context Mocking Pattern

The session handlers access shared context (`ctx`) which contains:
- `ctx.sessionStore: SessionStore`
- `ctx.sessionAutoSaver: SessionAutoSaver`
- `ctx.app: InkAppInstance`

We will extract the handler functions and test them with mocked dependencies:

```typescript
// Mock structure
const mockApp = {
  addMessage: vi.fn(),
  updateState: vi.fn(),
  getState: vi.fn(),
  waitUntilExit: vi.fn(),
  unmount: vi.fn(),
};

const mockSessionStore = {
  initialize: vi.fn(),
  createSession: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  listSessions: vi.fn(),
  branchSession: vi.fn(),
  exportSession: vi.fn(),
  setActiveSession: vi.fn(),
  getActiveSessionId: vi.fn(),
};

const mockSessionAutoSaver = {
  start: vi.fn(),
  stop: vi.fn(),
  save: vi.fn(),
  getSession: vi.fn(),
  updateSessionInfo: vi.fn(),
  addMessage: vi.fn(),
  updateState: vi.fn(),
  getUnsavedChangesCount: vi.fn(),
};
```

#### 2. Test Data Factories

Reuse and extend existing test data factories from `session-management.integration.test.ts`:

```typescript
const createTestSession = (overrides: Partial<Session> = {}): Session => ({
  id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Session',
  projectPath: '/test/project',
  createdAt: new Date('2023-01-01T10:00:00Z'),
  updatedAt: new Date('2023-01-01T10:00:00Z'),
  lastAccessedAt: new Date('2023-01-01T10:00:00Z'),
  messages: [],
  inputHistory: [],
  state: {
    totalTokens: { input: 0, output: 0 },
    totalCost: 0,
    tasksCreated: [],
    tasksCompleted: [],
  },
  childSessionIds: [],
  tags: [],
  ...overrides,
});

const createTestSessionSummary = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Session',
  messageCount: 0,
  totalCost: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [],
  isArchived: false,
  ...overrides,
});
```

#### 3. Handler Extraction Strategy

Since handlers are currently defined as inner functions in `repl.tsx`, we have two options:

**Option A (Recommended): Test via command dispatch**
Export the `handleSession` dispatcher function and test subcommands through it:

```typescript
// In tests
await handleSession(['load', 'session-id']);
expect(mockSessionStore.getSession).toHaveBeenCalledWith('session-id');
```

**Option B: Extract handlers to separate module**
Move handlers to `src/commands/session.ts` for direct testing. This requires refactoring but improves testability.

We recommend **Option A** initially, with Option B as a future refactoring task if test complexity grows.

### Test Suite Structure

```typescript
describe('Session Command Integration Tests', () => {
  describe('/session list', () => {
    it('should list sessions with default options');
    it('should include archived sessions with --all flag');
    it('should filter sessions with --search query');
    it('should handle empty session list gracefully');
  });

  describe('/session load', () => {
    it('should load existing session by ID');
    it('should save current session before switching');
    it('should update app state with loaded session info');
    it('should display error for non-existent session');
    it('should show usage error when session ID missing');
  });

  describe('/session save', () => {
    it('should save session with provided name');
    it('should save session with name and tags');
    it('should update app state with session name');
    it('should show usage error when name missing');
    it('should handle save errors gracefully');
  });

  describe('/session branch', () => {
    it('should create branch from last message by default');
    it('should create branch from specific message index with --from');
    it('should auto-name branch when name not provided');
    it('should switch to new branch after creation');
    it('should validate message index bounds');
    it('should handle missing active session');
  });

  describe('/session export', () => {
    it('should export to markdown by default');
    it('should export to JSON with --format json');
    it('should export to HTML with --format html');
    it('should write to file with --output option');
    it('should preview content when no output file specified');
    it('should handle missing active session');
  });

  describe('/session delete', () => {
    it('should delete existing session');
    it('should display error for non-existent session');
    it('should show usage error when session ID missing');
    it('should handle delete errors gracefully');
  });

  describe('/session info', () => {
    it('should display current session details');
    it('should show tags when present');
    it('should show parent session info for branches');
    it('should show child branch count');
    it('should show unsaved changes count');
    it('should handle missing active session');
  });

  describe('/session (main dispatcher)', () => {
    it('should route to correct subcommand handler');
    it('should show usage for unknown subcommand');
    it('should require APEX initialization');
  });
});
```

### Dependencies and Mocking

#### File System Mocking
```typescript
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
  readdir: vi.fn(),
}));
```

#### Module Mocking
```typescript
// Mock SessionStore and SessionAutoSaver at module level
vi.mock('../services/SessionStore.js');
vi.mock('../services/SessionAutoSaver.js');
```

### Assertions Pattern

Each test should verify:
1. **Correct service method calls** - verify the right methods are called with correct arguments
2. **UI updates** - verify `app.addMessage()` and `app.updateState()` are called appropriately
3. **Error handling** - verify errors are caught and displayed to user
4. **State consistency** - verify session state is consistent after operations

```typescript
// Example test assertion pattern
it('should load existing session by ID', async () => {
  const testSession = createTestSession({ id: 'test-session-123', name: 'My Session' });
  mockSessionStore.getSession.mockResolvedValue(testSession);
  mockSessionAutoSaver.save.mockResolvedValue(undefined);
  mockSessionAutoSaver.start.mockResolvedValue(testSession);

  await handleSession(['load', 'test-session-123']);

  // Verify session loaded
  expect(mockSessionStore.getSession).toHaveBeenCalledWith('test-session-123');

  // Verify current session saved before switch
  expect(mockSessionAutoSaver.save).toHaveBeenCalled();

  // Verify new session started
  expect(mockSessionAutoSaver.start).toHaveBeenCalledWith('test-session-123');

  // Verify active session updated
  expect(mockSessionStore.setActiveSession).toHaveBeenCalledWith('test-session-123');

  // Verify UI updated
  expect(mockApp.addMessage).toHaveBeenCalledWith({
    type: 'system',
    content: expect.stringContaining('Loaded session: My Session'),
  });
  expect(mockApp.updateState).toHaveBeenCalledWith({
    sessionName: 'My Session',
    sessionStartTime: expect.any(Date),
  });
});
```

### Error Scenarios

Each command should test error scenarios:

| Scenario | Expected Behavior |
|----------|-------------------|
| APEX not initialized | Show "Run /init first" error |
| Missing required arguments | Show usage message |
| Session not found | Show "Session not found" error |
| Service operation fails | Show error with message |
| Invalid index for branch | Show bounds error |
| No active session | Show "No active session" error |

### Integration with CI

Tests should:
- Run as part of `npm test --workspace=@apex/cli`
- Use fake timers for auto-save timer tests
- Not require actual file system access
- Complete in under 30 seconds total

## Consequences

### Positive
- Comprehensive test coverage for all session commands
- Early detection of regressions in session management
- Clear documentation of expected behavior through tests
- Follows established testing patterns in codebase

### Negative
- Tests rely on mocking, which may not catch all integration issues
- Handler functions remain coupled to REPL context
- Some test setup boilerplate required

### Future Considerations
- Consider extracting handlers to dedicated module for improved testability
- Add E2E tests using actual file system in separate test suite
- Consider snapshot testing for export format validation

## Implementation Notes

### File to Create
```
packages/cli/src/__tests__/session-commands.integration.test.ts
```

### Estimated Test Count
- ~35-40 individual test cases
- ~1000-1200 lines of test code

### Dependencies
- vitest (existing)
- @vitest/coverage-v8 (existing)
- No additional dependencies required

## Related ADRs
- ADR-001: Monorepo Structure (existing package structure)
- ADR-003: Session Management (session service design)
