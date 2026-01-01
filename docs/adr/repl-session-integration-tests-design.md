# Technical Design: REPL + Session Integration Tests

## Overview

This document provides detailed technical specifications for implementing integration tests that verify the REPL's integration with SessionStore and SessionAutoSaver components.

## Test File Structure

```
packages/cli/src/__tests__/repl-session.integration.test.ts
```

## Complete Implementation Specification

### 1. Imports and Dependencies

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionStore, Session, SessionMessage, SessionState } from '../services/SessionStore.js';
import { SessionAutoSaver, AutoSaveOptions } from '../services/SessionAutoSaver.js';
```

### 2. Test Context Interface

```typescript
interface TestContext {
  // Real filesystem components
  tempDir: string;
  sessionStore: SessionStore;
  sessionAutoSaver: SessionAutoSaver;

  // Mocked REPL components
  mockOrchestrator: {
    initialize: ReturnType<typeof vi.fn>;
    createTask: ReturnType<typeof vi.fn>;
    executeTask: ReturnType<typeof vi.fn>;
    getTask: ReturnType<typeof vi.fn>;
    listTasks: ReturnType<typeof vi.fn>;
  };
  mockApp: {
    addMessage: ReturnType<typeof vi.fn>;
    updateState: ReturnType<typeof vi.fn>;
    waitUntilExit: ReturnType<typeof vi.fn>;
  };
  mockConversationManager: {
    addMessage: ReturnType<typeof vi.fn>;
    setTask: ReturnType<typeof vi.fn>;
    setAgent: ReturnType<typeof vi.fn>;
  };
}
```

### 3. Test Data Factories

```typescript
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  description: 'Test task description',
  status: 'pending' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  workflow: 'default',
  ...overrides,
});

const createTestMessage = (overrides: Partial<SessionMessage> = {}): Omit<SessionMessage, 'id' | 'index' | 'timestamp'> => ({
  role: 'user' as const,
  content: 'Test message',
  ...overrides,
});
```

### 4. Setup and Teardown

```typescript
describe('REPL + Session Integration Tests', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    vi.useFakeTimers();

    // Create real temp directory for session persistence
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-repl-session-test-'));

    // Initialize real session components
    const sessionStore = new SessionStore(tempDir);
    await sessionStore.initialize();

    const sessionAutoSaver = new SessionAutoSaver(sessionStore, {
      enabled: true,
      intervalMs: 30000, // 30 second default
      maxUnsavedMessages: 5,
    });

    // Create mock REPL components
    const mockOrchestrator = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createTask: vi.fn(),
      executeTask: vi.fn().mockResolvedValue(undefined),
      getTask: vi.fn(),
      listTasks: vi.fn().mockResolvedValue([]),
    };

    const mockApp = {
      addMessage: vi.fn(),
      updateState: vi.fn(),
      waitUntilExit: vi.fn().mockResolvedValue(undefined),
    };

    const mockConversationManager = {
      addMessage: vi.fn(),
      setTask: vi.fn(),
      setAgent: vi.fn(),
    };

    ctx = {
      tempDir,
      sessionStore,
      sessionAutoSaver,
      mockOrchestrator,
      mockApp,
      mockConversationManager,
    };
  });

  afterEach(async () => {
    vi.useRealTimers();
    await ctx.sessionAutoSaver?.stop();
    // Clean up temp directory
    await fs.rm(ctx.tempDir, { recursive: true, force: true });
    vi.resetAllMocks();
  });

  // ... test suites follow
});
```

### 5. Test Suites

#### 5.1 REPL Initialization with SessionStore and SessionAutoSaver

```typescript
describe('REPL Initialization with SessionStore and SessionAutoSaver', () => {
  it('should initialize SessionStore with project path', async () => {
    // Verify SessionStore was initialized with correct path
    expect(ctx.sessionStore).toBeDefined();

    // Verify sessions directory was created
    const sessionsDir = path.join(ctx.tempDir, '.apex', 'sessions');
    const stat = await fs.stat(sessionsDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('should initialize SessionAutoSaver with SessionStore instance', async () => {
    expect(ctx.sessionAutoSaver).toBeDefined();

    // Start should work without errors
    const session = await ctx.sessionAutoSaver.start();
    expect(session).toBeDefined();
    expect(session.id).toMatch(/^sess_/);
  });

  it('should restore last active session on startup', async () => {
    // Create and save a session first
    const initialSession = await ctx.sessionAutoSaver.start();
    await ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'Initial message' });
    await ctx.sessionAutoSaver.save();
    await ctx.sessionAutoSaver.stop();

    // Create new SessionAutoSaver and start with existing session
    const newAutoSaver = new SessionAutoSaver(ctx.sessionStore);
    const restoredSession = await newAutoSaver.start(initialSession.id);

    expect(restoredSession.id).toBe(initialSession.id);
    expect(restoredSession.messages).toHaveLength(1);
    expect(restoredSession.messages[0].content).toBe('Initial message');

    await newAutoSaver.stop();
  });

  it('should create new session when no active session exists', async () => {
    // Fresh start with no existing session
    const session = await ctx.sessionAutoSaver.start();

    expect(session.id).toMatch(/^sess_/);
    expect(session.messages).toHaveLength(0);
    expect(session.state.tasksCreated).toHaveLength(0);
    expect(session.state.tasksCompleted).toHaveLength(0);
  });

  it('should sync session info to app state after initialization', async () => {
    const session = await ctx.sessionAutoSaver.start();

    // Simulate what REPL does after startup (lines 1741-1750)
    const sessionInfo = ctx.sessionAutoSaver.getSession();
    if (sessionInfo) {
      ctx.mockApp.updateState({
        sessionStartTime: sessionInfo.createdAt,
        sessionName: sessionInfo.name,
      });
    }

    expect(ctx.mockApp.updateState).toHaveBeenCalledWith({
      sessionStartTime: expect.any(Date),
      sessionName: sessionInfo?.name,
    });
  });
});
```

#### 5.2 Active Session Tracking Across REPL Operations

```typescript
describe('Active Session Tracking Across REPL Operations', () => {
  beforeEach(async () => {
    await ctx.sessionAutoSaver.start();
  });

  it('should track user input in session input history', async () => {
    const userInput = 'Create a new API endpoint';

    // Simulate executeTask behavior (line 756)
    await ctx.sessionAutoSaver.addInputToHistory(userInput);

    const session = ctx.sessionAutoSaver.getSession()!;
    expect(session.inputHistory).toContain(userInput);
  });

  it('should add user messages to session on task input', async () => {
    const userInput = 'Implement user authentication';

    // Simulate executeTask behavior (lines 757-761)
    await ctx.sessionAutoSaver.addMessage({
      role: 'user',
      content: userInput,
    });

    const session = ctx.sessionAutoSaver.getSession()!;
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0].role).toBe('user');
    expect(session.messages[0].content).toBe(userInput);
  });

  it('should track session messages with correct role and content', async () => {
    await ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'User query' });
    await ctx.sessionAutoSaver.addMessage({
      role: 'assistant',
      content: 'Task created: task_123',
      taskId: 'task_123',
      agent: 'system',
    });
    await ctx.sessionAutoSaver.addMessage({ role: 'system', content: 'Processing...' });

    const session = ctx.sessionAutoSaver.getSession()!;
    expect(session.messages).toHaveLength(3);
    expect(session.messages[0].role).toBe('user');
    expect(session.messages[1].role).toBe('assistant');
    expect(session.messages[1].taskId).toBe('task_123');
    expect(session.messages[1].agent).toBe('system');
    expect(session.messages[2].role).toBe('system');
  });

  it('should maintain session state across multiple inputs', async () => {
    // Simulate multiple task interactions
    for (let i = 1; i <= 3; i++) {
      await ctx.sessionAutoSaver.addInputToHistory(`Command ${i}`);
      await ctx.sessionAutoSaver.addMessage({ role: 'user', content: `Query ${i}` });
    }

    const session = ctx.sessionAutoSaver.getSession()!;
    expect(session.inputHistory).toHaveLength(3);
    expect(session.messages).toHaveLength(3);
  });

  it('should preserve message order with sequential indexing', async () => {
    await ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'First' });
    await ctx.sessionAutoSaver.addMessage({ role: 'assistant', content: 'Second' });
    await ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'Third' });

    const session = ctx.sessionAutoSaver.getSession()!;
    expect(session.messages.map(m => m.index)).toEqual([0, 1, 2]);
    expect(session.messages.map(m => m.content)).toEqual(['First', 'Second', 'Third']);
  });
});
```

#### 5.3 Session State Updates During Task Execution

```typescript
describe('Session State Updates During Task Execution', () => {
  let testTask: Task;

  beforeEach(async () => {
    await ctx.sessionAutoSaver.start();
    testTask = createMockTask({ id: 'task_test_123', status: 'pending' });
    ctx.mockOrchestrator.createTask.mockResolvedValue(testTask);
  });

  it('should add task ID to tasksCreated on task creation', async () => {
    // Simulate executeTask behavior (lines 799-803)
    await ctx.sessionAutoSaver.updateState({
      tasksCreated: [...(ctx.sessionAutoSaver.getSession()?.state.tasksCreated || []), testTask.id],
      currentTaskId: testTask.id,
    });

    const session = ctx.sessionAutoSaver.getSession()!;
    expect(session.state.tasksCreated).toContain(testTask.id);
  });

  it('should set currentTaskId when task starts', async () => {
    await ctx.sessionAutoSaver.updateState({
      currentTaskId: testTask.id,
    });

    const session = ctx.sessionAutoSaver.getSession()!;
    expect(session.state.currentTaskId).toBe(testTask.id);
  });

  it('should track task creation message with taskId and agent', async () => {
    // Simulate executeTask behavior (lines 793-798)
    await ctx.sessionAutoSaver.addMessage({
      role: 'assistant',
      content: `Task created: ${testTask.id}`,
      taskId: testTask.id,
      agent: 'system',
    });

    const session = ctx.sessionAutoSaver.getSession()!;
    const lastMessage = session.messages[session.messages.length - 1];
    expect(lastMessage.taskId).toBe(testTask.id);
    expect(lastMessage.agent).toBe('system');
  });

  it('should add task ID to tasksCompleted on success', async () => {
    // First add to tasksCreated
    await ctx.sessionAutoSaver.updateState({
      tasksCreated: [testTask.id],
      currentTaskId: testTask.id,
    });

    // Then simulate completion (lines 822-825)
    await ctx.sessionAutoSaver.updateState({
      tasksCompleted: [...(ctx.sessionAutoSaver.getSession()?.state.tasksCompleted || []), testTask.id],
      currentTaskId: undefined,
    });

    const session = ctx.sessionAutoSaver.getSession()!;
    expect(session.state.tasksCompleted).toContain(testTask.id);
    expect(session.state.currentTaskId).toBeUndefined();
  });

  it('should clear currentTaskId on task completion', async () => {
    await ctx.sessionAutoSaver.updateState({ currentTaskId: testTask.id });
    expect(ctx.sessionAutoSaver.getSession()?.state.currentTaskId).toBe(testTask.id);

    // Simulate completion
    await ctx.sessionAutoSaver.updateState({ currentTaskId: undefined });
    expect(ctx.sessionAutoSaver.getSession()?.state.currentTaskId).toBeUndefined();
  });

  it('should track task completion message', async () => {
    // Simulate completion message (lines 816-821)
    await ctx.sessionAutoSaver.addMessage({
      role: 'assistant',
      content: `Task completed: completed`,
      taskId: testTask.id,
      agent: 'system',
    });

    const session = ctx.sessionAutoSaver.getSession()!;
    const lastMessage = session.messages[session.messages.length - 1];
    expect(lastMessage.content).toContain('completed');
    expect(lastMessage.taskId).toBe(testTask.id);
  });

  it('should track task failure message on error', async () => {
    const errorMessage = 'API connection failed';

    // Simulate failure tracking (lines 837-842)
    await ctx.sessionAutoSaver.addMessage({
      role: 'assistant',
      content: `Task failed: ${errorMessage}`,
      taskId: testTask.id,
      agent: 'system',
    });

    const session = ctx.sessionAutoSaver.getSession()!;
    const lastMessage = session.messages[session.messages.length - 1];
    expect(lastMessage.content).toContain('failed');
    expect(lastMessage.content).toContain(errorMessage);
  });

  it('should clear currentTaskId on task failure', async () => {
    await ctx.sessionAutoSaver.updateState({ currentTaskId: testTask.id });

    // Simulate failure (lines 843-845)
    await ctx.sessionAutoSaver.updateState({ currentTaskId: undefined });

    expect(ctx.sessionAutoSaver.getSession()?.state.currentTaskId).toBeUndefined();
  });

  it('should handle task creation errors', async () => {
    const errorMessage = 'Failed to create task: Invalid description';

    // Simulate error tracking (lines 859-863)
    await ctx.sessionAutoSaver.addMessage({
      role: 'assistant',
      content: errorMessage,
      agent: 'system',
    });

    const session = ctx.sessionAutoSaver.getSession()!;
    const lastMessage = session.messages[session.messages.length - 1];
    expect(lastMessage.content).toBe(errorMessage);
  });
});
```

#### 5.4 Cleanup on REPL Exit

```typescript
describe('Cleanup on REPL Exit', () => {
  beforeEach(async () => {
    await ctx.sessionAutoSaver.start();
  });

  it('should call sessionAutoSaver.stop() on normal exit', async () => {
    // Add some unsaved changes
    await ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'Test' });
    expect(ctx.sessionAutoSaver.hasUnsavedChanges()).toBe(true);

    // Simulate onExit callback (lines 1734-1736)
    await ctx.sessionAutoSaver.stop();

    expect(ctx.sessionAutoSaver.hasUnsavedChanges()).toBe(false);
  });

  it('should call sessionAutoSaver.stop() on SIGINT', async () => {
    await ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'Before SIGINT' });

    // Simulate SIGINT handler (lines 1754-1756)
    await ctx.sessionAutoSaver.stop();

    expect(ctx.sessionAutoSaver.hasUnsavedChanges()).toBe(false);
  });

  it('should call sessionAutoSaver.stop() on SIGTERM', async () => {
    await ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'Before SIGTERM' });

    // Simulate SIGTERM handler (lines 1762-1764)
    await ctx.sessionAutoSaver.stop();

    expect(ctx.sessionAutoSaver.hasUnsavedChanges()).toBe(false);
  });

  it('should save pending changes before stopping', async () => {
    const session = ctx.sessionAutoSaver.getSession()!;

    // Add changes that haven't been auto-saved
    await ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'Pending message 1' });
    await ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'Pending message 2' });
    await ctx.sessionAutoSaver.updateState({ totalCost: 0.5 });

    expect(ctx.sessionAutoSaver.hasUnsavedChanges()).toBe(true);

    // Stop should save
    await ctx.sessionAutoSaver.stop();

    // Verify persistence by reading from fresh store
    const freshStore = new SessionStore(ctx.tempDir);
    await freshStore.initialize();
    const persistedSession = await freshStore.getSession(session.id);

    expect(persistedSession).not.toBeNull();
    expect(persistedSession!.messages).toHaveLength(2);
    expect(persistedSession!.state.totalCost).toBe(0.5);
  });

  it('should handle cleanup errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Remove temp dir to simulate error
    await fs.rm(ctx.tempDir, { recursive: true, force: true });

    // Should not throw
    await expect(ctx.sessionAutoSaver.stop()).resolves.not.toThrow();

    consoleSpy.mockRestore();
  });
});
```

#### 5.5 End-to-End Session Lifecycle

```typescript
describe('End-to-End Session Lifecycle', () => {
  it('should persist complete task lifecycle to session', async () => {
    const session = await ctx.sessionAutoSaver.start();
    const taskId = 'task_e2e_001';

    // 1. User input
    await ctx.sessionAutoSaver.addInputToHistory('Create a REST API');
    await ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'Create a REST API' });

    // 2. Task creation
    await ctx.sessionAutoSaver.addMessage({
      role: 'assistant',
      content: `Task created: ${taskId}`,
      taskId,
      agent: 'system',
    });
    await ctx.sessionAutoSaver.updateState({
      tasksCreated: [taskId],
      currentTaskId: taskId,
    });

    // 3. Task completion
    await ctx.sessionAutoSaver.addMessage({
      role: 'assistant',
      content: 'Task completed: completed',
      taskId,
      agent: 'system',
    });
    await ctx.sessionAutoSaver.updateState({
      tasksCompleted: [taskId],
      currentTaskId: undefined,
    });

    // Save and verify persistence
    await ctx.sessionAutoSaver.stop();

    const freshStore = new SessionStore(ctx.tempDir);
    await freshStore.initialize();
    const persistedSession = await freshStore.getSession(session.id);

    expect(persistedSession!.messages).toHaveLength(3);
    expect(persistedSession!.inputHistory).toContain('Create a REST API');
    expect(persistedSession!.state.tasksCreated).toEqual([taskId]);
    expect(persistedSession!.state.tasksCompleted).toEqual([taskId]);
    expect(persistedSession!.state.currentTaskId).toBeUndefined();
  });

  it('should maintain data integrity across restart', async () => {
    // First session
    const session1 = await ctx.sessionAutoSaver.start();
    await ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'Before restart' });
    await ctx.sessionAutoSaver.updateState({ totalCost: 0.25 });
    await ctx.sessionAutoSaver.stop();

    // Simulate restart
    const newStore = new SessionStore(ctx.tempDir);
    await newStore.initialize();
    const newAutoSaver = new SessionAutoSaver(newStore);
    const session2 = await newAutoSaver.start(session1.id);

    // Verify state preserved
    expect(session2.id).toBe(session1.id);
    expect(session2.messages).toHaveLength(1);
    expect(session2.messages[0].content).toBe('Before restart');
    expect(session2.state.totalCost).toBe(0.25);

    // Continue adding
    await newAutoSaver.addMessage({ role: 'user', content: 'After restart' });
    await newAutoSaver.stop();

    // Verify combined state
    const finalSession = await newStore.getSession(session1.id);
    expect(finalSession!.messages).toHaveLength(2);
    expect(finalSession!.messages[1].content).toBe('After restart');

    await newAutoSaver.stop();
  });

  it('should handle concurrent operations correctly', async () => {
    await ctx.sessionAutoSaver.start();

    // Simulate concurrent operations like in executeTask
    const operations = [
      ctx.sessionAutoSaver.addInputToHistory('Concurrent input 1'),
      ctx.sessionAutoSaver.addMessage({ role: 'user', content: 'Message 1' }),
      ctx.sessionAutoSaver.updateState({ totalCost: 0.1 }),
      ctx.sessionAutoSaver.addInputToHistory('Concurrent input 2'),
      ctx.sessionAutoSaver.addMessage({ role: 'assistant', content: 'Response 1' }),
      ctx.sessionAutoSaver.updateState({
        tasksCreated: ['task_1'],
        currentTaskId: 'task_1',
      }),
    ];

    await Promise.all(operations);

    const session = ctx.sessionAutoSaver.getSession()!;
    expect(session.inputHistory).toHaveLength(2);
    expect(session.messages).toHaveLength(2);
    expect(session.state.totalCost).toBe(0.1);
    expect(session.state.tasksCreated).toContain('task_1');
    expect(session.state.currentTaskId).toBe('task_1');
  });
});
```

## Running the Tests

```bash
# Run all REPL session integration tests
npm test --workspace=@apexcli/cli -- --grep "REPL + Session Integration"

# Run with coverage
npm test --workspace=@apexcli/cli -- --coverage --grep "REPL + Session Integration"
```

## Success Criteria

All tests pass with:
- ✅ REPL initialization with SessionStore and SessionAutoSaver
- ✅ Active session tracking across REPL operations
- ✅ Session state updates during task execution
- ✅ Cleanup on REPL exit
- ✅ npm test passes for all session management integration tests
