# Technical Design: Enhanced Session Management Integration Tests

## Overview

This document outlines the technical architecture for enhancing session management integration tests in `v030-features.integration.test.tsx` to provide comprehensive coverage of the full session lifecycle, search capabilities, and auto-save mechanisms.

## Current State Analysis

### Existing Tests
The current `v030-features.integration.test.tsx` has basic session management tests covering:
- Basic session creation and persistence (1 test)
- Auto-save at intervals (1 test - limited)
- Session export (1 test)
- Session branching through ConversationManager (1 test)

### Gap Analysis
The following scenarios are **not covered** in the integration tests:

1. **Full Session Lifecycle**
   - Session update operations
   - Session archiving
   - Session deletion
   - Session restoration from archive

2. **Session Search & Filtering**
   - Search by name
   - Filter by tags
   - Filter by date range
   - Include/exclude archived sessions

3. **Session Listing**
   - Pagination/limit
   - Sort order
   - Active vs archived filtering

4. **Auto-save Configuration**
   - Custom intervals
   - Threshold-based saving (maxUnsavedMessages)
   - Enable/disable toggle
   - Options update during runtime

5. **Edge Cases**
   - Concurrent session operations
   - Error recovery during auto-save
   - Large session handling

## Architecture Design

### Test Structure

```
describe('Session Management Integration', () => {
  describe('Full Session Lifecycle', () => {
    describe('Session Creation', () => { ... })
    describe('Session Update', () => { ... })
    describe('Session Archive/Restore', () => { ... })
    describe('Session Deletion', () => { ... })
  })

  describe('Session Search & Filtering', () => {
    describe('Search by Name', () => { ... })
    describe('Filter by Tags', () => { ... })
    describe('Combined Filters', () => { ... })
  })

  describe('Session Listing', () => {
    describe('Pagination', () => { ... })
    describe('Sorting', () => { ... })
    describe('Active vs Archived', () => { ... })
  })

  describe('Auto-save Behavior', () => {
    describe('Interval-based Auto-save', () => { ... })
    describe('Threshold-based Auto-save', () => { ... })
    describe('Options Configuration', () => { ... })
    describe('Error Recovery', () => { ... })
  })
})
```

### Key Interfaces

Based on existing code analysis:

```typescript
// SessionStore interfaces (from packages/cli/src/services/SessionStore.ts)
interface Session {
  id: string;
  name?: string;
  projectPath: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  messages: SessionMessage[];
  inputHistory: string[];
  state: SessionState;
  parentSessionId?: string;
  branchPoint?: number;
  childSessionIds: string[];
  tags: string[];
}

interface SessionSummary {
  id: string;
  name?: string;
  messageCount: number;
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  isArchived: boolean;
}

// SessionAutoSaver options (from packages/cli/src/services/SessionAutoSaver.ts)
interface AutoSaveOptions {
  enabled: boolean;
  intervalMs: number;
  maxUnsavedMessages: number;
}
```

### Test Data Factory

```typescript
// Test data factory for consistent test fixtures
const createTestSession = (overrides?: Partial<Session>): Session => ({
  id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  projectPath: '/test/project',
  createdAt: new Date(),
  updatedAt: new Date(),
  lastAccessedAt: new Date(),
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

const createTestMessage = (overrides?: Partial<SessionMessage>): SessionMessage => ({
  id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  index: 0,
  role: 'user',
  content: 'Test message',
  timestamp: new Date(),
  ...overrides,
});
```

## Detailed Test Specifications

### 1. Full Session Lifecycle Tests

#### 1.1 Session Creation with Various Options
```typescript
it('should create session with name and tags', async () => {
  const session = await sessionStore.createSession('My Session');
  expect(session.name).toBe('My Session');
  expect(session.id).toMatch(/^sess_\d+_\w+$/);
});

it('should create session and set as active', async () => {
  const session = await sessionStore.createSession();
  const activeId = await sessionStore.getActiveSessionId();
  expect(activeId).toBe(session.id);
});
```

#### 1.2 Session Update Operations
```typescript
it('should update session name and tags', async () => {
  const session = await sessionStore.createSession();
  await sessionStore.updateSession(session.id, {
    name: 'Updated Name',
    tags: ['important', 'work']
  });

  const updated = await sessionStore.getSession(session.id);
  expect(updated?.name).toBe('Updated Name');
  expect(updated?.tags).toEqual(['important', 'work']);
});

it('should preserve existing fields when updating', async () => {
  const session = await sessionStore.createSession('Original');
  const originalCreatedAt = session.createdAt;

  await sessionStore.updateSession(session.id, { tags: ['new-tag'] });

  const updated = await sessionStore.getSession(session.id);
  expect(updated?.name).toBe('Original');
  expect(updated?.createdAt).toEqual(originalCreatedAt);
});
```

#### 1.3 Session Archive/Restore
```typescript
it('should archive session and retrieve from archive', async () => {
  const session = await sessionStore.createSession('To Archive');
  await sessionStore.archiveSession(session.id);

  // Session should be marked as archived in listing
  const sessions = await sessionStore.listSessions({ all: true });
  const archived = sessions.find(s => s.id === session.id);
  expect(archived?.isArchived).toBe(true);

  // Should still be retrievable
  const retrieved = await sessionStore.getSession(session.id);
  expect(retrieved).toBeDefined();
  expect(retrieved?.name).toBe('To Archive');
});
```

#### 1.4 Session Deletion
```typescript
it('should delete session from main storage', async () => {
  const session = await sessionStore.createSession();
  await sessionStore.deleteSession(session.id);

  const retrieved = await sessionStore.getSession(session.id);
  expect(retrieved).toBeNull();
});

it('should delete archived session', async () => {
  const session = await sessionStore.createSession();
  await sessionStore.archiveSession(session.id);
  await sessionStore.deleteSession(session.id);

  const retrieved = await sessionStore.getSession(session.id);
  expect(retrieved).toBeNull();
});
```

### 2. Session Search & Filtering Tests

#### 2.1 Search by Name
```typescript
it('should find sessions by partial name match', async () => {
  await sessionStore.createSession('Feature: User Authentication');
  await sessionStore.createSession('Feature: Payment Integration');
  await sessionStore.createSession('Bugfix: Login Error');

  const results = await sessionStore.listSessions({ search: 'feature' });
  expect(results).toHaveLength(2);
  expect(results.every(s => s.name?.toLowerCase().includes('feature'))).toBe(true);
});

it('should find sessions by ID substring', async () => {
  const session = await sessionStore.createSession();
  const idPrefix = session.id.substring(0, 10);

  const results = await sessionStore.listSessions({ search: idPrefix });
  expect(results.some(s => s.id === session.id)).toBe(true);
});
```

#### 2.2 Filter by Tags
```typescript
it('should filter sessions by single tag', async () => {
  const session1 = await sessionStore.createSession('Session 1');
  await sessionStore.updateSession(session1.id, { tags: ['work'] });

  const session2 = await sessionStore.createSession('Session 2');
  await sessionStore.updateSession(session2.id, { tags: ['personal'] });

  const results = await sessionStore.listSessions({ tags: ['work'] });
  expect(results).toHaveLength(1);
  expect(results[0].tags).toContain('work');
});

it('should filter sessions by multiple tags (OR logic)', async () => {
  // Setup sessions with different tags
  const session1 = await sessionStore.createSession('Session 1');
  await sessionStore.updateSession(session1.id, { tags: ['work'] });

  const session2 = await sessionStore.createSession('Session 2');
  await sessionStore.updateSession(session2.id, { tags: ['urgent'] });

  const results = await sessionStore.listSessions({ tags: ['work', 'urgent'] });
  expect(results).toHaveLength(2);
});
```

### 3. Session Listing Tests

#### 3.1 Pagination
```typescript
it('should limit results to specified count', async () => {
  // Create 5 sessions
  for (let i = 0; i < 5; i++) {
    await sessionStore.createSession(`Session ${i}`);
  }

  const results = await sessionStore.listSessions({ limit: 3 });
  expect(results).toHaveLength(3);
});

it('should return most recent sessions when limited', async () => {
  await sessionStore.createSession('Oldest');
  vi.advanceTimersByTime(1000);
  await sessionStore.createSession('Middle');
  vi.advanceTimersByTime(1000);
  await sessionStore.createSession('Newest');

  const results = await sessionStore.listSessions({ limit: 2 });
  expect(results[0].name).toBe('Newest');
  expect(results[1].name).toBe('Middle');
});
```

#### 3.2 Active vs Archived Filtering
```typescript
it('should exclude archived sessions by default', async () => {
  await sessionStore.createSession('Active Session');
  const archived = await sessionStore.createSession('Archived Session');
  await sessionStore.archiveSession(archived.id);

  const defaultResults = await sessionStore.listSessions();
  expect(defaultResults).toHaveLength(1);
  expect(defaultResults[0].name).toBe('Active Session');
});

it('should include archived when all=true', async () => {
  await sessionStore.createSession('Active Session');
  const archived = await sessionStore.createSession('Archived Session');
  await sessionStore.archiveSession(archived.id);

  const allResults = await sessionStore.listSessions({ all: true });
  expect(allResults).toHaveLength(2);
});
```

### 4. Auto-save Behavior Tests

#### 4.1 Interval-based Auto-save
```typescript
it('should auto-save at configured interval', async () => {
  const autoSaver = new SessionAutoSaver(sessionStore, {
    enabled: true,
    intervalMs: 30000,
    maxUnsavedMessages: 100
  });

  await autoSaver.start();
  await autoSaver.addMessage({ role: 'user', content: 'Test message' });

  expect(autoSaver.hasUnsavedChanges()).toBe(true);

  // Advance to just before interval
  vi.advanceTimersByTime(29000);
  expect(autoSaver.hasUnsavedChanges()).toBe(true);

  // Advance past interval
  vi.advanceTimersByTime(2000);
  await vi.runAllTimersAsync();

  expect(autoSaver.hasUnsavedChanges()).toBe(false);

  autoSaver.stop();
});

it('should respect custom interval settings', async () => {
  const autoSaver = new SessionAutoSaver(sessionStore, {
    enabled: true,
    intervalMs: 10000 // 10 seconds
  });

  await autoSaver.start();
  await autoSaver.addMessage({ role: 'user', content: 'Test' });

  // Should not save before 10 seconds
  vi.advanceTimersByTime(9000);
  await vi.runAllTimersAsync();
  expect(autoSaver.hasUnsavedChanges()).toBe(true);

  // Should save after 10 seconds
  vi.advanceTimersByTime(2000);
  await vi.runAllTimersAsync();
  expect(autoSaver.hasUnsavedChanges()).toBe(false);

  autoSaver.stop();
});
```

#### 4.2 Threshold-based Auto-save
```typescript
it('should auto-save when message threshold reached', async () => {
  const autoSaver = new SessionAutoSaver(sessionStore, {
    enabled: true,
    intervalMs: 60000, // Long interval
    maxUnsavedMessages: 3
  });

  await autoSaver.start();

  // Add messages up to threshold
  await autoSaver.addMessage({ role: 'user', content: 'Message 1' });
  expect(autoSaver.getUnsavedChangesCount()).toBe(1);

  await autoSaver.addMessage({ role: 'assistant', content: 'Message 2' });
  expect(autoSaver.getUnsavedChangesCount()).toBe(2);

  // Third message should trigger auto-save
  await autoSaver.addMessage({ role: 'user', content: 'Message 3' });
  expect(autoSaver.getUnsavedChangesCount()).toBe(0);

  autoSaver.stop();
});

it('should handle combined threshold and interval saves', async () => {
  const autoSaver = new SessionAutoSaver(sessionStore, {
    enabled: true,
    intervalMs: 5000,
    maxUnsavedMessages: 5
  });

  await autoSaver.start();

  // Add 2 messages (below threshold)
  await autoSaver.addMessage({ role: 'user', content: 'Message 1' });
  await autoSaver.addMessage({ role: 'assistant', content: 'Message 2' });
  expect(autoSaver.getUnsavedChangesCount()).toBe(2);

  // Wait for interval save
  vi.advanceTimersByTime(5000);
  await vi.runAllTimersAsync();
  expect(autoSaver.getUnsavedChangesCount()).toBe(0);

  autoSaver.stop();
});
```

#### 4.3 Options Configuration at Runtime
```typescript
it('should enable auto-save dynamically', async () => {
  const autoSaver = new SessionAutoSaver(sessionStore, {
    enabled: false,
    intervalMs: 1000
  });

  await autoSaver.start();
  await autoSaver.addMessage({ role: 'user', content: 'Test' });

  // Advance time - should not auto-save when disabled
  vi.advanceTimersByTime(2000);
  await vi.runAllTimersAsync();
  expect(autoSaver.hasUnsavedChanges()).toBe(true);

  // Enable auto-save
  autoSaver.updateOptions({ enabled: true });

  vi.advanceTimersByTime(1000);
  await vi.runAllTimersAsync();
  expect(autoSaver.hasUnsavedChanges()).toBe(false);

  autoSaver.stop();
});

it('should disable auto-save dynamically', async () => {
  const autoSaver = new SessionAutoSaver(sessionStore, {
    enabled: true,
    intervalMs: 1000
  });

  await autoSaver.start();

  // Disable auto-save
  autoSaver.updateOptions({ enabled: false });

  await autoSaver.addMessage({ role: 'user', content: 'Test' });
  vi.advanceTimersByTime(2000);
  await vi.runAllTimersAsync();

  expect(autoSaver.hasUnsavedChanges()).toBe(true);

  autoSaver.stop();
});
```

#### 4.4 Error Recovery
```typescript
it('should recover from auto-save failures and retry', async () => {
  const autoSaver = new SessionAutoSaver(sessionStore, {
    enabled: true,
    intervalMs: 1000
  });

  await autoSaver.start();
  await autoSaver.addMessage({ role: 'user', content: 'Test' });

  // First save fails
  vi.spyOn(sessionStore, 'updateSession')
    .mockRejectedValueOnce(new Error('Network error'));

  vi.advanceTimersByTime(1000);
  await vi.runAllTimersAsync();

  // Changes should still be tracked
  expect(autoSaver.hasUnsavedChanges()).toBe(true);

  // Second attempt succeeds
  vi.advanceTimersByTime(1000);
  await vi.runAllTimersAsync();

  expect(autoSaver.hasUnsavedChanges()).toBe(false);

  autoSaver.stop();
});
```

## Integration Test Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Suite Initialization                      │
│  - Mock fs/promises                                               │
│  - Initialize SessionStore                                        │
│  - Initialize SessionAutoSaver                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Full Lifecycle Tests                          │
│  create → read → update → archive → restore → delete            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Search & Filter Tests                         │
│  - Name search                                                    │
│  - Tag filtering                                                  │
│  - Combined filters                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Listing Tests                                  │
│  - Pagination                                                     │
│  - Sorting                                                        │
│  - Archive inclusion/exclusion                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Auto-save Tests                                │
│  - Interval-based                                                 │
│  - Threshold-based                                                │
│  - Dynamic configuration                                          │
│  - Error recovery                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cleanup                                        │
│  - Stop timers                                                    │
│  - Clear mocks                                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Mock Strategy

### File System Mocking
```typescript
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn(),
}));
```

### Timer Mocking
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});
```

### Session Store Spying
For integration tests that need to verify store interactions:
```typescript
const updateSpy = vi.spyOn(sessionStore, 'updateSession');
const getSpy = vi.spyOn(sessionStore, 'getSession');
```

## Success Criteria

1. **Test Coverage**: All specified test cases pass
2. **Edge Cases**: Error scenarios are properly handled
3. **Integration**: Tests verify component interactions (SessionStore ↔ SessionAutoSaver ↔ ConversationManager)
4. **Performance**: Tests complete within reasonable time (< 30s for full suite)
5. **Isolation**: Each test is independent and doesn't affect others

## Implementation Notes for Developer Stage

1. **Existing Test Location**: Tests should be added to `packages/cli/src/__tests__/v030-features.integration.test.tsx`

2. **Existing describe block**: Add new tests within the existing `describe('Session Management Integration', ...)` block

3. **Mock preservation**: Maintain existing mock setup for `fs/promises` and `process`

4. **Fake timers**: Use `vi.useFakeTimers()` pattern already established in the file

5. **Test utilities**: Consider extracting common test fixtures into helper functions at the top of the describe block

## Files to Modify

- `packages/cli/src/__tests__/v030-features.integration.test.tsx` - Add new test cases

## Dependencies

- vitest (already configured)
- @testing-library/react (already configured)
- SessionStore (packages/cli/src/services/SessionStore.ts)
- SessionAutoSaver (packages/cli/src/services/SessionAutoSaver.ts)
- ConversationManager (packages/cli/src/services/ConversationManager.ts)
