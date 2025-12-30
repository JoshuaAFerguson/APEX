import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VerboseDebugData } from '@apexcli/core';
import { startInkREPL } from '../repl';

// Mock dependencies but keep them more realistic for session testing
vi.mock('@apexcli/core', () => ({
  isApexInitialized: vi.fn(),
  initializeApex: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  loadAgents: vi.fn(),
  loadWorkflows: vi.fn(),
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  formatTokens: vi.fn((tokens: number) => `${tokens} tokens`),
  formatDuration: vi.fn((duration: number) => `${duration}ms`),
  getEffectiveConfig: vi.fn(),
}));

vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    createTask: vi.fn(),
    executeTask: vi.fn(),
    getTask: vi.fn(),
    listTasks: vi.fn(),
    getTaskLogs: vi.fn(),
    cancelTask: vi.fn(),
    updateTaskStatus: vi.fn(),
    on: vi.fn(), // For event handling
    removeAllListeners: vi.fn(),
  })),
  TaskStore: vi.fn(),
}));

// Mock SessionStore and SessionAutoSaver
vi.mock('../services/SessionStore', () => ({
  SessionStore: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    getActiveSessionId: vi.fn(),
    setActiveSession: vi.fn(),
    listSessions: vi.fn(),
  })),
}));

vi.mock('../services/SessionAutoSaver', () => ({
  SessionAutoSaver: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    addMessage: vi.fn(),
    addInputToHistory: vi.fn(),
    updateState: vi.fn(),
    updateSessionInfo: vi.fn(),
    save: vi.fn(),
    getSession: vi.fn(),
    hasUnsavedChanges: vi.fn(),
    getUnsavedChangesCount: vi.fn(),
  })),
}));

// Mock ConversationManager
vi.mock('../services/ConversationManager', () => ({
  ConversationManager: vi.fn().mockImplementation(function () { return ({
    addMessage: vi.fn(),
    setTask: vi.fn(),
    setAgent: vi.fn(),
  }); }),
}));

vi.mock('../ui/index.js', () => ({
  startInkApp: vi.fn().mockResolvedValue({
    waitUntilExit: vi.fn(),
    addMessage: vi.fn(),
    updateState: vi.fn(),
    getState: vi.fn(() => ({})),
  }),
}));

// Mock handlers
vi.mock('../handlers/session-handlers.js', () => ({
  handleSession: vi.fn(),
}));

// Mock child_process and fs/promises
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  access: vi.fn(),
}));

describe('REPL + Session Integration Tests', () => {
  let mockSessionStore: any;
  let mockSessionAutoSaver: any;
  let mockOrchestrator: any;
  let mockApp: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock console methods to suppress output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock process methods
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'on').mockImplementation(() => process as any);

    // Set up mock implementations
    const { SessionStore } = require('../services/SessionStore');
    const { SessionAutoSaver } = require('../services/SessionAutoSaver');
    const { ApexOrchestrator } = require('@apexcli/orchestrator');
    const { startInkApp } = require('../ui/index.js');

    mockSessionStore = new SessionStore();
    mockSessionAutoSaver = new SessionAutoSaver();
    mockOrchestrator = new ApexOrchestrator();

    mockApp = {
      waitUntilExit: vi.fn().mockResolvedValue(undefined),
      addMessage: vi.fn(),
      updateState: vi.fn(),
      getState: vi.fn(() => ({})),
    };

    // Configure mocks
    SessionStore.mockReturnValue(mockSessionStore);
    SessionAutoSaver.mockReturnValue(mockSessionAutoSaver);
    ApexOrchestrator.mockReturnValue(mockOrchestrator);
    startInkApp.mockResolvedValue(mockApp);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('REPL Initialization with Session Management', () => {
    it('should initialize SessionStore and SessionAutoSaver when APEX is initialized', async () => {
      const { isApexInitialized, loadConfig } = await import('@apexcli/core');

      (isApexInitialized as any).mockResolvedValue(true);
      (loadConfig as any).mockResolvedValue({ api: { autoStart: false } });

      const mockSession = {
        id: 'test-session-1',
        name: 'Test Session',
        createdAt: new Date(),
        messages: [],
        state: { totalTokens: { input: 0, output: 0 }, totalCost: 0, tasksCreated: [], tasksCompleted: [] },
      };

      mockSessionStore.getActiveSessionId.mockResolvedValue('existing-session-id');
      mockSessionStore.initialize.mockResolvedValue(undefined);
      mockSessionAutoSaver.start.mockResolvedValue(mockSession);
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      // Verify SessionStore initialization
      expect(mockSessionStore.initialize).toHaveBeenCalled();
      expect(mockSessionStore.getActiveSessionId).toHaveBeenCalled();

      // Verify SessionAutoSaver initialization
      expect(mockSessionAutoSaver.start).toHaveBeenCalledWith('existing-session-id');

      // Verify app state updates with session info
      expect(mockApp.updateState).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionStartTime: expect.any(Date),
          sessionName: 'Test Session',
        })
      );

      mockExit.mockRestore();
    });

    it('should create new session when no active session exists', async () => {
      const { isApexInitialized, loadConfig } = await import('@apexcli/core');

      (isApexInitialized as any).mockResolvedValue(true);
      (loadConfig as any).mockResolvedValue({ api: { autoStart: false } });

      const mockSession = {
        id: 'new-session-1',
        name: 'New Session',
        createdAt: new Date(),
        messages: [],
        state: { totalTokens: { input: 0, output: 0 }, totalCost: 0, tasksCreated: [], tasksCompleted: [] },
      };

      mockSessionStore.getActiveSessionId.mockResolvedValue(null);
      mockSessionStore.initialize.mockResolvedValue(undefined);
      mockSessionAutoSaver.start.mockResolvedValue(mockSession);
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      // Verify new session creation
      expect(mockSessionAutoSaver.start).toHaveBeenCalledWith(undefined);

      mockExit.mockRestore();
    });

    it('should handle session initialization errors gracefully', async () => {
      const { isApexInitialized, loadConfig } = await import('@apexcli/core');

      (isApexInitialized as any).mockResolvedValue(true);
      (loadConfig as any).mockResolvedValue({ api: { autoStart: false } });

      mockSessionStore.initialize.mockRejectedValue(new Error('Session store failed'));
      mockSessionStore.getActiveSessionId.mockResolvedValue(null);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      // REPL should still start even if session initialization fails
      expect(mockApp.waitUntilExit).toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('should not initialize session management when APEX is not initialized', async () => {
      const { isApexInitialized } = await import('@apexcli/core');

      (isApexInitialized as any).mockResolvedValue(false);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await expect(startInkREPL()).rejects.toThrow('Process exit called');
      } catch (error) {
        // Expected
      }

      // Session management should not be initialized
      expect(mockSessionStore.initialize).not.toHaveBeenCalled();
      expect(mockSessionAutoSaver.start).not.toHaveBeenCalled();

      mockExit.mockRestore();
    });
  });

  describe('Active Session Tracking Across REPL Operations', () => {
    beforeEach(async () => {
      const { isApexInitialized, loadConfig } = await import('@apexcli/core');

      (isApexInitialized as any).mockResolvedValue(true);
      (loadConfig as any).mockResolvedValue({ api: { autoStart: false } });

      mockSessionStore.initialize.mockResolvedValue(undefined);
      mockSessionStore.getActiveSessionId.mockResolvedValue('active-session');

      const mockSession = {
        id: 'active-session',
        name: 'Active Test Session',
        createdAt: new Date(),
        messages: [],
        inputHistory: [],
        state: {
          totalTokens: { input: 0, output: 0 },
          totalCost: 0,
          tasksCreated: [],
          tasksCompleted: [],
          currentTaskId: undefined,
        },
      };

      mockSessionAutoSaver.start.mockResolvedValue(mockSession);
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
    });

    it('should track user input in session history during task execution', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Start REPL
      const replPromise = startInkREPL().catch(() => {}); // Ignore exit error

      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate task execution through the exposed onTask handler
      const startInkAppCall = (await import('../ui/index.js')).startInkApp.mock.calls[0];
      const { onTask } = startInkAppCall[0];

      // Mock task creation
      mockOrchestrator.createTask.mockResolvedValue({
        id: 'task-123',
        description: 'Test task',
        status: 'pending',
      });

      // Execute task
      await onTask('Test user input for task');

      // Verify session tracking
      expect(mockSessionAutoSaver.addInputToHistory).toHaveBeenCalledWith('Test user input for task');
      expect(mockSessionAutoSaver.addMessage).toHaveBeenCalledWith({
        role: 'user',
        content: 'Test user input for task',
      });

      mockExit.mockRestore();
    });

    it('should maintain session state across multiple REPL commands', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Start REPL
      const replPromise = startInkREPL().catch(() => {});

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      // Get command handler
      const startInkAppCall = (await import('../ui/index.js')).startInkApp.mock.calls[0];
      const { onCommand } = startInkAppCall[0];

      // Mock command responses
      mockOrchestrator.listTasks.mockResolvedValue([]);

      // Execute multiple commands
      await onCommand('status', []);
      await onCommand('agents', []);

      // Verify session remains active (no stop calls)
      expect(mockSessionAutoSaver.stop).not.toHaveBeenCalled();

      // Verify session context is maintained
      expect(mockSessionAutoSaver.getSession).toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('should update session with task creation and completion', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      const mockSession = {
        id: 'session-with-tasks',
        state: {
          tasksCreated: [],
          tasksCompleted: [],
          currentTaskId: undefined,
        },
      };

      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);

      // Start REPL
      const replPromise = startInkREPL().catch(() => {});

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      // Get task handler
      const startInkAppCall = (await import('../ui/index.js')).startInkApp.mock.calls[0];
      const { onTask } = startInkAppCall[0];

      const mockTask = {
        id: 'task-456',
        description: 'Integration test task',
        status: 'pending',
      };

      mockOrchestrator.createTask.mockResolvedValue(mockTask);

      // Create a promise to resolve when task completes
      let taskCompleteResolve: () => void;
      const taskCompletePromise = new Promise<void>((resolve) => {
        taskCompleteResolve = resolve;
      });

      // Mock task completion
      mockOrchestrator.executeTask.mockImplementation(async () => {
        // Simulate task completion
        setTimeout(() => {
          taskCompleteResolve();
        }, 10);
        return mockTask;
      });

      mockOrchestrator.getTask.mockResolvedValue({
        ...mockTask,
        status: 'completed',
      });

      // Execute task
      await onTask('Create integration test');

      // Wait for task completion simulation
      await taskCompletePromise;
      await new Promise(resolve => setTimeout(resolve, 20)); // Extra wait for completion handling

      // Verify task tracking in session
      expect(mockSessionAutoSaver.updateState).toHaveBeenCalledWith(
        expect.objectContaining({
          tasksCreated: expect.arrayContaining(['task-456']),
          currentTaskId: 'task-456',
        })
      );

      mockExit.mockRestore();
    });
  });

  describe('Session State Updates During Task Execution', () => {
    beforeEach(async () => {
      const { isApexInitialized, loadConfig } = await import('@apexcli/core');

      (isApexInitialized as any).mockResolvedValue(true);
      (loadConfig as any).mockResolvedValue({ api: { autoStart: false } });

      const mockSession = {
        id: 'task-execution-session',
        name: 'Task Execution Session',
        state: {
          totalTokens: { input: 100, output: 200 },
          totalCost: 0.15,
          tasksCreated: [],
          tasksCompleted: [],
        },
      };

      mockSessionStore.initialize.mockResolvedValue(undefined);
      mockSessionStore.getActiveSessionId.mockResolvedValue(mockSession.id);
      mockSessionAutoSaver.start.mockResolvedValue(mockSession);
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
    });

    it('should track message exchanges during task execution', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Start REPL
      const replPromise = startInkREPL().catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 10));

      // Get task handler
      const startInkAppCall = (await import('../ui/index.js')).startInkApp.mock.calls[0];
      const { onTask } = startInkAppCall[0];

      const mockTask = {
        id: 'message-task-789',
        description: 'Test message tracking',
        status: 'pending',
      };

      mockOrchestrator.createTask.mockResolvedValue(mockTask);

      // Execute task to trigger message tracking
      await onTask('Test message tracking in session');

      // Verify user message tracking
      expect(mockSessionAutoSaver.addMessage).toHaveBeenCalledWith({
        role: 'user',
        content: 'Test message tracking in session',
      });

      // Verify system messages for task creation
      expect(mockSessionAutoSaver.addMessage).toHaveBeenCalledWith({
        role: 'assistant',
        content: 'Task created: message-task-789',
        taskId: 'message-task-789',
        agent: 'system',
      });

      mockExit.mockRestore();
    });

    it('should handle task failure messages in session', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Start REPL
      const replPromise = startInkREPL().catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 10));

      // Get task handler
      const startInkAppCall = (await import('../ui/index.js')).startInkApp.mock.calls[0];
      const { onTask } = startInkAppCall[0];

      mockOrchestrator.createTask.mockRejectedValue(new Error('Task creation failed'));

      // Execute task that will fail
      await onTask('This will fail');

      // Verify error message tracking in session
      expect(mockSessionAutoSaver.addMessage).toHaveBeenCalledWith({
        role: 'assistant',
        content: 'Failed to create task: Task creation failed',
        agent: 'system',
      });

      mockExit.mockRestore();
    });

    it('should update session state with orchestrator events', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Start REPL
      const replPromise = startInkREPL().catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify orchestrator event listeners are set up
      expect(mockOrchestrator.on).toHaveBeenCalledWith('usage:updated', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:completed', expect.any(Function));

      // Simulate usage update event
      const usageUpdateHandler = mockOrchestrator.on.mock.calls.find(
        call => call[0] === 'usage:updated'
      )?.[1];

      if (usageUpdateHandler) {
        usageUpdateHandler('test-task', {
          inputTokens: 150,
          outputTokens: 300,
          estimatedCost: 0.25,
        });
      }

      // Verify app state updates (which should reflect in session)
      expect(mockApp.updateState).toHaveBeenCalledWith({
        tokens: { input: 150, output: 300 },
        cost: 0.25,
      });

      mockExit.mockRestore();
    });
  });

  describe('Cleanup on REPL Exit', () => {
    beforeEach(async () => {
      const { isApexInitialized, loadConfig } = await import('@apexcli/core');

      (isApexInitialized as any).mockResolvedValue(true);
      (loadConfig as any).mockResolvedValue({ api: { autoStart: false } });

      const mockSession = {
        id: 'cleanup-session',
        name: 'Cleanup Test Session',
        hasUnsavedChanges: true,
      };

      mockSessionStore.initialize.mockResolvedValue(undefined);
      mockSessionStore.getActiveSessionId.mockResolvedValue(mockSession.id);
      mockSessionAutoSaver.start.mockResolvedValue(mockSession);
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionAutoSaver.hasUnsavedChanges.mockReturnValue(true);
    });

    it('should save session when REPL exits normally', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Start REPL
      const replPromise = startInkREPL().catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 10));

      // Get exit handler
      const startInkAppCall = (await import('../ui/index.js')).startInkApp.mock.calls[0];
      const { onExit } = startInkAppCall[0];

      // Trigger exit
      if (onExit) {
        await onExit();
      }

      // Verify session is saved on exit
      expect(mockSessionAutoSaver.stop).toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('should save session on SIGINT signal', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Start REPL
      const replPromise = startInkREPL().catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 10));

      // Get SIGINT handler
      const signalHandlers = (process.on as any).mock.calls;
      const sigintHandler = signalHandlers.find(([signal]: any) => signal === 'SIGINT')?.[1];

      // Simulate SIGINT
      if (sigintHandler) {
        try {
          await sigintHandler();
        } catch (error) {
          // Expected process.exit() call
        }
      }

      // Verify session cleanup
      expect(mockSessionAutoSaver.stop).toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('should save session on SIGTERM signal', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Start REPL
      const replPromise = startInkREPL().catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 10));

      // Get SIGTERM handler
      const signalHandlers = (process.on as any).mock.calls;
      const sigtermHandler = signalHandlers.find(([signal]: any) => signal === 'SIGTERM')?.[1];

      // Simulate SIGTERM
      if (sigtermHandler) {
        try {
          await sigtermHandler();
        } catch (error) {
          // Expected process.exit() call
        }
      }

      // Verify session cleanup
      expect(mockSessionAutoSaver.stop).toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Make session cleanup fail
      mockSessionAutoSaver.stop.mockRejectedValue(new Error('Cleanup failed'));

      // Start REPL
      const replPromise = startInkREPL().catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 10));

      // Get exit handler
      const startInkAppCall = (await import('../ui/index.js')).startInkApp.mock.calls[0];
      const { onExit } = startInkAppCall[0];

      // Trigger exit - should not throw even if cleanup fails
      if (onExit) {
        await expect(onExit()).resolves.not.toThrow();
      }

      // Verify cleanup was attempted
      expect(mockSessionAutoSaver.stop).toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('should cleanup without session when session management not initialized', async () => {
      // Test when APEX is not initialized (no session management)
      const { isApexInitialized } = await import('@apexcli/core');

      (isApexInitialized as any).mockResolvedValue(false);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      // Start REPL
      const replPromise = startInkREPL().catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 10));

      // Get exit handler
      const startInkAppCall = (await import('../ui/index.js')).startInkApp.mock.calls[0];
      const { onExit } = startInkAppCall[0];

      // Trigger exit
      if (onExit) {
        await onExit();
      }

      // Verify no session cleanup attempted (since none was initialized)
      expect(mockSessionAutoSaver.stop).not.toHaveBeenCalled();

      mockExit.mockRestore();
    });
  });
});
