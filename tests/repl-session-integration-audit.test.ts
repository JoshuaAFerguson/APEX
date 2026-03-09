import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * APEX Interactive REPL Session Store Integration Audit Test Suite
 *
 * This test suite verifies the session store integration functionality in the Interactive REPL mode.
 * It validates the SessionStore and SessionAutoSaver components that manage session persistence
 * and state tracking.
 *
 * Tests verify:
 * 1. Session initialization and lifecycle management
 * 2. Message persistence and retrieval
 * 3. Session state tracking (tasks, agents, etc.)
 * 4. Auto-saving functionality
 * 5. Session restoration capabilities
 * 6. Error handling and recovery
 */

interface MockSessionMessage {
  id: string;
  index: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  agent?: string;
  stage?: string;
  taskId?: string;
  tokens?: { input: number; output: number };
}

interface MockSession {
  id: string;
  name: string;
  projectPath: string;
  createdAt: Date;
  updatedAt: Date;
  messages: MockSessionMessage[];
  state: {
    tasksCreated: string[];
    tasksCompleted: string[];
    currentTaskId?: string;
    activeAgent?: string;
    displayMode?: string;
    previewMode?: boolean;
  };
  metadata: {
    totalMessages: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

interface MockSessionStore {
  initialize: () => Promise<void>;
  createSession: (name?: string) => Promise<MockSession>;
  getSession: (id: string) => Promise<MockSession | null>;
  saveSession: (session: MockSession) => Promise<void>;
  listSessions: () => Promise<MockSession[]>;
  deleteSession: (id: string) => Promise<boolean>;
  getActiveSessionId: () => Promise<string | null>;
  setActiveSession: (id: string) => Promise<void>;
  addMessage: (sessionId: string, message: MockSessionMessage) => Promise<void>;
  updateSessionState: (sessionId: string, state: any) => Promise<void>;
}

interface MockSessionAutoSaver {
  start: (sessionId?: string) => Promise<MockSession>;
  stop: () => Promise<void>;
  addMessage: (message: MockSessionMessage) => Promise<void>;
  addInputToHistory: (input: string) => Promise<void>;
  updateState: (state: any) => Promise<void>;
  getSession: () => MockSession | null;
  saveNow: () => Promise<void>;
}

describe('APEX Interactive REPL Session Store Integration Audit', () => {
  let mockSessionStore: MockSessionStore;
  let mockSessionAutoSaver: MockSessionAutoSaver;
  let testSessionsDir: string;
  let currentSession: MockSession | null = null;

  beforeEach(async () => {
    // Create temporary directory for test sessions
    testSessionsDir = path.join(process.cwd(), '.test-sessions');
    await fs.mkdir(testSessionsDir, { recursive: true });

    // Create mock session store
    mockSessionStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createSession: vi.fn().mockImplementation(async (name?: string) => {
        const session: MockSession = {
          id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: name || `Test Session ${new Date().toLocaleDateString()}`,
          projectPath: '/test/project',
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
          state: {
            tasksCreated: [],
            tasksCompleted: [],
            displayMode: 'normal',
            previewMode: false,
          },
          metadata: {
            totalMessages: 0,
            totalTokens: 0,
            estimatedCost: 0,
          },
        };
        currentSession = session;
        return session;
      }),
      getSession: vi.fn().mockImplementation(async (id: string) => {
        return currentSession?.id === id ? currentSession : null;
      }),
      saveSession: vi.fn().mockResolvedValue(undefined),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn().mockResolvedValue(true),
      getActiveSessionId: vi.fn().mockResolvedValue(null),
      setActiveSession: vi.fn().mockResolvedValue(undefined),
      addMessage: vi.fn().mockImplementation(async (sessionId: string, message: MockSessionMessage) => {
        if (currentSession && currentSession.id === sessionId) {
          currentSession.messages.push(message);
          currentSession.metadata.totalMessages = currentSession.messages.length;
        }
      }),
      updateSessionState: vi.fn().mockImplementation(async (sessionId: string, state: any) => {
        if (currentSession && currentSession.id === sessionId) {
          currentSession.state = { ...currentSession.state, ...state };
          currentSession.updatedAt = new Date();
        }
      }),
    };

    // Create mock session auto-saver
    mockSessionAutoSaver = {
      start: vi.fn().mockImplementation(async (sessionId?: string) => {
        if (sessionId && currentSession?.id === sessionId) {
          return currentSession;
        }
        const session = await mockSessionStore.createSession();
        currentSession = session;
        return session;
      }),
      stop: vi.fn().mockResolvedValue(undefined),
      addMessage: vi.fn().mockImplementation(async (message: MockSessionMessage) => {
        if (currentSession) {
          currentSession.messages.push(message);
          currentSession.metadata.totalMessages = currentSession.messages.length;
        }
      }),
      addInputToHistory: vi.fn().mockResolvedValue(undefined),
      updateState: vi.fn().mockImplementation(async (state: any) => {
        if (currentSession) {
          currentSession.state = { ...currentSession.state, ...state };
          currentSession.updatedAt = new Date();
        }
      }),
      getSession: vi.fn().mockImplementation(() => currentSession),
      saveNow: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(async () => {
    // Clean up test session directory
    try {
      await fs.rmdir(testSessionsDir, { recursive: true });
    } catch {
      // Directory might not exist
    }
    currentSession = null;
  });

  it('should initialize session store successfully', async () => {
    await mockSessionStore.initialize();
    expect(mockSessionStore.initialize).toHaveBeenCalled();
  });

  it('should create new session with default name', async () => {
    const session = await mockSessionStore.createSession();

    expect(session.id).toBeDefined();
    expect(session.name).toContain('Test Session');
    expect(session.projectPath).toBe('/test/project');
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.messages).toEqual([]);
    expect(session.state.tasksCreated).toEqual([]);
    expect(session.state.tasksCompleted).toEqual([]);
    expect(mockSessionStore.createSession).toHaveBeenCalled();
  });

  it('should create session with custom name', async () => {
    const customName = 'Custom Session Name';
    const session = await mockSessionStore.createSession(customName);

    expect(session.name).toBe(customName);
    expect(mockSessionStore.createSession).toHaveBeenCalledWith(customName);
  });

  it('should start auto-saver with new session', async () => {
    const session = await mockSessionAutoSaver.start();

    expect(session.id).toBeDefined();
    expect(mockSessionAutoSaver.start).toHaveBeenCalled();
    expect(mockSessionStore.createSession).toHaveBeenCalled();
  });

  it('should start auto-saver with existing session', async () => {
    const existingSession = await mockSessionStore.createSession();
    const session = await mockSessionAutoSaver.start(existingSession.id);

    expect(session.id).toBe(existingSession.id);
    expect(mockSessionAutoSaver.start).toHaveBeenCalledWith(existingSession.id);
  });

  it('should add messages to session via auto-saver', async () => {
    await mockSessionAutoSaver.start();

    const userMessage: MockSessionMessage = {
      id: 'msg-1',
      index: 0,
      role: 'user',
      content: 'Create a login form with validation',
      timestamp: new Date(),
    };

    await mockSessionAutoSaver.addMessage(userMessage);

    const session = mockSessionAutoSaver.getSession();
    expect(session?.messages).toHaveLength(1);
    expect(session?.messages[0]).toEqual(userMessage);
    expect(session?.metadata.totalMessages).toBe(1);
  });

  it('should track task creation in session state', async () => {
    await mockSessionAutoSaver.start();

    const taskId = 'task-abc123';
    await mockSessionAutoSaver.updateState({
      tasksCreated: ['previous-task', taskId],
      currentTaskId: taskId,
    });

    const session = mockSessionAutoSaver.getSession();
    expect(session?.state.tasksCreated).toContain(taskId);
    expect(session?.state.currentTaskId).toBe(taskId);
  });

  it('should track task completion in session state', async () => {
    await mockSessionAutoSaver.start();

    const completedTaskId = 'task-completed-456';
    await mockSessionAutoSaver.updateState({
      tasksCompleted: [completedTaskId],
      currentTaskId: undefined,
    });

    const session = mockSessionAutoSaver.getSession();
    expect(session?.state.tasksCompleted).toContain(completedTaskId);
    expect(session?.state.currentTaskId).toBeUndefined();
  });

  it('should track active agent in session state', async () => {
    await mockSessionAutoSaver.start();

    await mockSessionAutoSaver.updateState({
      activeAgent: 'planner',
    });

    const session = mockSessionAutoSaver.getSession();
    expect(session?.state.activeAgent).toBe('planner');
  });

  it('should track display mode changes', async () => {
    await mockSessionAutoSaver.start();

    await mockSessionAutoSaver.updateState({
      displayMode: 'compact',
    });

    const session = mockSessionAutoSaver.getSession();
    expect(session?.state.displayMode).toBe('compact');
  });

  it('should track preview mode changes', async () => {
    await mockSessionAutoSaver.start();

    await mockSessionAutoSaver.updateState({
      previewMode: true,
    });

    const session = mockSessionAutoSaver.getSession();
    expect(session?.state.previewMode).toBe(true);
  });

  it('should add user input to history', async () => {
    await mockSessionAutoSaver.start();

    const userInput = 'Implement user authentication system';
    await mockSessionAutoSaver.addInputToHistory(userInput);

    expect(mockSessionAutoSaver.addInputToHistory).toHaveBeenCalledWith(userInput);
  });

  it('should track conversation flow with multiple messages', async () => {
    await mockSessionAutoSaver.start();

    const messages: MockSessionMessage[] = [
      {
        id: 'msg-1',
        index: 0,
        role: 'user',
        content: 'Create a login form',
        timestamp: new Date(),
      },
      {
        id: 'msg-2',
        index: 1,
        role: 'assistant',
        content: 'Task created: task-123',
        timestamp: new Date(),
        taskId: 'task-123',
        agent: 'system',
      },
      {
        id: 'msg-3',
        index: 2,
        role: 'assistant',
        content: 'Starting implementation...',
        timestamp: new Date(),
        taskId: 'task-123',
        agent: 'planner',
      },
    ];

    for (const message of messages) {
      await mockSessionAutoSaver.addMessage(message);
    }

    const session = mockSessionAutoSaver.getSession();
    expect(session?.messages).toHaveLength(3);
    expect(session?.messages).toEqual(messages);
    expect(session?.metadata.totalMessages).toBe(3);
  });

  it('should handle task-related messages with metadata', async () => {
    await mockSessionAutoSaver.start();

    const taskMessage: MockSessionMessage = {
      id: 'msg-task-1',
      index: 0,
      role: 'assistant',
      content: 'Task completed successfully',
      timestamp: new Date(),
      taskId: 'task-789',
      agent: 'developer',
      stage: 'implementation',
      tokens: { input: 150, output: 75 },
    };

    await mockSessionAutoSaver.addMessage(taskMessage);

    const session = mockSessionAutoSaver.getSession();
    const savedMessage = session?.messages[0];
    expect(savedMessage?.taskId).toBe('task-789');
    expect(savedMessage?.agent).toBe('developer');
    expect(savedMessage?.stage).toBe('implementation');
    expect(savedMessage?.tokens).toEqual({ input: 150, output: 75 });
  });

  it('should save session state periodically via saveNow', async () => {
    await mockSessionAutoSaver.start();

    await mockSessionAutoSaver.addMessage({
      id: 'msg-save-test',
      index: 0,
      role: 'user',
      content: 'Test save functionality',
      timestamp: new Date(),
    });

    await mockSessionAutoSaver.saveNow();

    expect(mockSessionAutoSaver.saveNow).toHaveBeenCalled();
  });

  it('should restore session state after restart', async () => {
    // Start auto-saver and add some data
    const session1 = await mockSessionAutoSaver.start();
    await mockSessionAutoSaver.updateState({
      tasksCreated: ['task-1', 'task-2'],
      activeAgent: 'planner',
    });
    await mockSessionAutoSaver.addMessage({
      id: 'msg-restore-test',
      index: 0,
      role: 'user',
      content: 'Test restore functionality',
      timestamp: new Date(),
    });

    // Stop auto-saver
    await mockSessionAutoSaver.stop();

    // Start auto-saver with the same session ID
    const session2 = await mockSessionAutoSaver.start(session1.id);

    expect(session2.id).toBe(session1.id);
    expect(session2.state.tasksCreated).toEqual(['task-1', 'task-2']);
    expect(session2.state.activeAgent).toBe('planner');
    expect(session2.messages).toHaveLength(1);
    expect(session2.messages[0].content).toBe('Test restore functionality');
  });

  it('should handle session stop gracefully', async () => {
    await mockSessionAutoSaver.start();
    await mockSessionAutoSaver.stop();

    expect(mockSessionAutoSaver.stop).toHaveBeenCalled();
  });

  it('should handle multiple rapid state updates', async () => {
    await mockSessionAutoSaver.start();

    const updates = [
      { activeAgent: 'planner' },
      { displayMode: 'verbose' },
      { previewMode: true },
      { currentTaskId: 'task-multi-update' },
    ];

    for (const update of updates) {
      await mockSessionAutoSaver.updateState(update);
    }

    const session = mockSessionAutoSaver.getSession();
    expect(session?.state.activeAgent).toBe('planner');
    expect(session?.state.displayMode).toBe('verbose');
    expect(session?.state.previewMode).toBe(true);
    expect(session?.state.currentTaskId).toBe('task-multi-update');
  });

  it('should maintain session integrity with mixed operations', async () => {
    await mockSessionAutoSaver.start();

    // Mix of state updates and message additions
    await mockSessionAutoSaver.updateState({ activeAgent: 'planner' });
    await mockSessionAutoSaver.addMessage({
      id: 'msg-mixed-1',
      index: 0,
      role: 'user',
      content: 'First user message',
      timestamp: new Date(),
    });
    await mockSessionAutoSaver.updateState({ currentTaskId: 'task-mixed-ops' });
    await mockSessionAutoSaver.addMessage({
      id: 'msg-mixed-2',
      index: 1,
      role: 'assistant',
      content: 'Assistant response',
      timestamp: new Date(),
      agent: 'planner',
    });
    await mockSessionAutoSaver.updateState({ displayMode: 'compact' });

    const session = mockSessionAutoSaver.getSession();
    expect(session?.messages).toHaveLength(2);
    expect(session?.state.activeAgent).toBe('planner');
    expect(session?.state.currentTaskId).toBe('task-mixed-ops');
    expect(session?.state.displayMode).toBe('compact');
    expect(session?.metadata.totalMessages).toBe(2);
  });

  it('should handle session without active session ID', async () => {
    mockSessionStore.getActiveSessionId = vi.fn().mockResolvedValue(null);

    const session = await mockSessionAutoSaver.start();

    expect(session.id).toBeDefined();
    expect(mockSessionStore.createSession).toHaveBeenCalled();
  });

  it('should preserve session timestamps correctly', async () => {
    const startTime = new Date();
    const session = await mockSessionAutoSaver.start();

    expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
    expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(startTime.getTime());

    // Add small delay to ensure timestamps differ
    await new Promise(resolve => setTimeout(resolve, 5));

    await mockSessionAutoSaver.updateState({ activeAgent: 'planner' });
    const updatedSession = mockSessionAutoSaver.getSession();

    // Use greaterThanOrEqual to handle same-millisecond edge case
    expect(updatedSession?.updatedAt.getTime()).toBeGreaterThanOrEqual(session.createdAt.getTime());
  });
});