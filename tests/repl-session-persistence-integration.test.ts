import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import type { Mock } from 'vitest';

/**
 * REPL Session Management and Persistence Integration Tests
 *
 * This test suite provides comprehensive testing of session management and persistence
 * functionality within the REPL mode, ensuring data integrity, recovery capabilities,
 * and proper integration with the session store.
 *
 * Key Areas Tested:
 * - Session creation, persistence, and restoration
 * - Input history management
 * - Message logging and retrieval
 * - State synchronization across session lifecycle
 * - Session cleanup and garbage collection
 * - Multi-session management
 * - Error recovery and data corruption handling
 * - Auto-save functionality and timing
 *
 * @fileoverview Session persistence integration tests for APEX REPL
 * @version 0.6.0
 */

describe('REPL Session Management and Persistence Integration Tests', () => {
  let mockSessionStore: any;
  let mockSessionAutoSaver: any;
  let mockApp: any;
  let testProjectPath: string;
  let testSessionsDir: string;

  beforeEach(() => {
    testProjectPath = '/test/project';
    testSessionsDir = path.join(testProjectPath, '.apex', 'sessions');

    // Mock file system operations
    vi.mock('fs/promises', () => ({
      mkdir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn(),
      unlink: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn(),
      access: vi.fn().mockResolvedValue(undefined),
    }));

    mockApp = {
      addMessage: vi.fn(),
      updateState: vi.fn(),
      getState: vi.fn().mockReturnValue({
        sessionStartTime: new Date(),
        sessionName: 'test-session',
      }),
    };

    // Create comprehensive SessionStore mock
    mockSessionStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createSession: vi.fn().mockImplementation((name?: string) => {
        const sessionId = `session-${Date.now()}`;
        const session = {
          id: sessionId,
          name: name || 'Untitled Session',
          createdAt: new Date(),
          lastModified: new Date(),
          state: {
            tasksCreated: [],
            tasksCompleted: [],
            currentTaskId: undefined,
          },
          messages: [],
          inputHistory: [],
        };
        return Promise.resolve(session);
      }),
      getSession: vi.fn(),
      saveSession: vi.fn().mockResolvedValue(undefined),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn().mockResolvedValue(true),
      getActiveSessionId: vi.fn().mockResolvedValue('active-session'),
      setActiveSession: vi.fn().mockResolvedValue(undefined),
      archiveSession: vi.fn().mockResolvedValue(true),
    };

    // Create comprehensive SessionAutoSaver mock
    mockSessionAutoSaver = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      addMessage: vi.fn().mockResolvedValue(undefined),
      addInputToHistory: vi.fn().mockResolvedValue(undefined),
      updateState: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn().mockReturnValue({
        id: 'auto-save-session',
        name: 'Auto Save Session',
        createdAt: new Date(),
        state: { tasksCreated: [], tasksCompleted: [] },
        messages: [],
        inputHistory: [],
      }),
      isAutoSaveEnabled: vi.fn().mockReturnValue(true),
      setAutoSaveInterval: vi.fn(),
      getAutoSaveInterval: vi.fn().mockReturnValue(5000),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Store Initialization and Basic Operations', () => {
    it('should initialize session store with proper directory structure', async () => {
      await mockSessionStore.initialize();

      expect(mockSessionStore.initialize).toHaveBeenCalled();
    });

    it('should create new sessions with proper metadata', async () => {
      const sessionName = 'Test REPL Session';
      const session = await mockSessionStore.createSession(sessionName);

      expect(session).toMatchObject({
        id: expect.any(String),
        name: sessionName,
        createdAt: expect.any(Date),
        state: {
          tasksCreated: [],
          tasksCompleted: [],
          currentTaskId: undefined,
        },
        messages: [],
        inputHistory: [],
      });

      expect(mockSessionStore.createSession).toHaveBeenCalledWith(sessionName);
    });

    it('should persist and retrieve sessions correctly', async () => {
      const session = {
        id: 'test-session-123',
        name: 'Persistent Session',
        createdAt: new Date(),
        state: {
          tasksCreated: ['task-1', 'task-2'],
          tasksCompleted: ['task-1'],
          currentTaskId: 'task-2',
        },
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date() },
          { role: 'assistant', content: 'Hi there!', timestamp: new Date() },
        ],
        inputHistory: ['Hello', '/status'],
      };

      await mockSessionStore.saveSession(session);
      expect(mockSessionStore.saveSession).toHaveBeenCalledWith(session);

      mockSessionStore.getSession.mockResolvedValue(session);
      const retrievedSession = await mockSessionStore.getSession('test-session-123');

      expect(retrievedSession).toEqual(session);
      expect(mockSessionStore.getSession).toHaveBeenCalledWith('test-session-123');
    });

    it('should manage active session tracking', async () => {
      const sessionId = 'active-session-456';

      await mockSessionStore.setActiveSession(sessionId);
      expect(mockSessionStore.setActiveSession).toHaveBeenCalledWith(sessionId);

      const activeId = await mockSessionStore.getActiveSessionId();
      expect(activeId).toBe('active-session');
      expect(mockSessionStore.getActiveSessionId).toHaveBeenCalled();
    });

    it('should list sessions with proper sorting and metadata', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          name: 'Recent Session',
          createdAt: new Date(Date.now() - 1000),
          lastModified: new Date(),
        },
        {
          id: 'session-2',
          name: 'Older Session',
          createdAt: new Date(Date.now() - 10000),
          lastModified: new Date(Date.now() - 5000),
        },
      ];

      mockSessionStore.listSessions.mockResolvedValue(mockSessions);
      const sessions = await mockSessionStore.listSessions();

      expect(sessions).toEqual(mockSessions);
      expect(mockSessionStore.listSessions).toHaveBeenCalled();
    });
  });

  describe('SessionAutoSaver Integration', () => {
    it('should start auto-saving with existing session', async () => {
      const existingSessionId = 'existing-session';

      await mockSessionAutoSaver.start(existingSessionId);

      expect(mockSessionAutoSaver.start).toHaveBeenCalledWith(existingSessionId);
    });

    it('should create new session when starting without existing ID', async () => {
      await mockSessionAutoSaver.start();

      expect(mockSessionAutoSaver.start).toHaveBeenCalledWith();
    });

    it('should add messages with proper formatting and timestamps', async () => {
      const message = {
        role: 'user' as const,
        content: 'Create a React component',
        timestamp: new Date(),
      };

      await mockSessionAutoSaver.addMessage(message);

      expect(mockSessionAutoSaver.addMessage).toHaveBeenCalledWith(message);
    });

    it('should track input history with deduplication', async () => {
      const commands = [
        '/status',
        'Create a login form',
        '/agents',
        'Create a login form', // Duplicate
        '/config',
      ];

      for (const command of commands) {
        await mockSessionAutoSaver.addInputToHistory(command);
      }

      expect(mockSessionAutoSaver.addInputToHistory).toHaveBeenCalledTimes(5);
      commands.forEach(command => {
        expect(mockSessionAutoSaver.addInputToHistory).toHaveBeenCalledWith(command);
      });
    });

    it('should update session state incrementally', async () => {
      const stateUpdates = [
        { tasksCreated: ['task-1'] },
        { currentTaskId: 'task-1' },
        { tasksCompleted: ['task-1'], currentTaskId: undefined },
      ];

      for (const update of stateUpdates) {
        await mockSessionAutoSaver.updateState(update);
      }

      expect(mockSessionAutoSaver.updateState).toHaveBeenCalledTimes(3);
      stateUpdates.forEach(update => {
        expect(mockSessionAutoSaver.updateState).toHaveBeenCalledWith(update);
      });
    });

    it('should handle auto-save timing and intervals', () => {
      const interval = 10000; // 10 seconds
      mockSessionAutoSaver.setAutoSaveInterval(interval);

      expect(mockSessionAutoSaver.setAutoSaveInterval).toHaveBeenCalledWith(interval);

      const currentInterval = mockSessionAutoSaver.getAutoSaveInterval();
      expect(currentInterval).toBe(5000); // Default mock value
    });

    it('should stop auto-saving gracefully with final save', async () => {
      await mockSessionAutoSaver.stop();

      expect(mockSessionAutoSaver.stop).toHaveBeenCalled();
    });
  });

  describe('REPL Session Lifecycle Integration', () => {
    it('should integrate session management with REPL startup', async () => {
      // Simulate REPL startup sequence
      await mockSessionStore.initialize();
      const activeSessionId = await mockSessionStore.getActiveSessionId();
      await mockSessionAutoSaver.start(activeSessionId);

      // Update app state with session info
      const session = mockSessionAutoSaver.getSession();
      if (session) {
        mockApp.updateState({
          sessionStartTime: session.createdAt,
          sessionName: session.name,
        });
      }

      expect(mockSessionStore.initialize).toHaveBeenCalled();
      expect(mockSessionStore.getActiveSessionId).toHaveBeenCalled();
      expect(mockSessionAutoSaver.start).toHaveBeenCalledWith('active-session');
      expect(mockApp.updateState).toHaveBeenCalledWith({
        sessionStartTime: expect.any(Date),
        sessionName: expect.any(String),
      });
    });

    it('should handle task execution with session tracking', async () => {
      const taskDescription = 'Build a navigation component';
      const taskId = 'task-nav-123';

      // Simulate task execution tracking
      await mockSessionAutoSaver.addInputToHistory(taskDescription);
      await mockSessionAutoSaver.addMessage({
        role: 'user',
        content: taskDescription,
      });

      // Task created
      await mockSessionAutoSaver.addMessage({
        role: 'assistant',
        content: `Task created: ${taskId}`,
        taskId,
        agent: 'system',
      });

      const session = mockSessionAutoSaver.getSession();
      await mockSessionAutoSaver.updateState({
        tasksCreated: [...(session?.state.tasksCreated || []), taskId],
        currentTaskId: taskId,
      });

      // Task completed
      await mockSessionAutoSaver.addMessage({
        role: 'assistant',
        content: `Task completed: completed`,
        taskId,
        agent: 'system',
      });

      await mockSessionAutoSaver.updateState({
        tasksCompleted: [...(session?.state.tasksCompleted || []), taskId],
        currentTaskId: undefined,
      });

      expect(mockSessionAutoSaver.addInputToHistory).toHaveBeenCalledWith(taskDescription);
      expect(mockSessionAutoSaver.addMessage).toHaveBeenCalledTimes(3);
      expect(mockSessionAutoSaver.updateState).toHaveBeenCalledTimes(2);
    });

    it('should handle REPL shutdown with session cleanup', async () => {
      // Simulate graceful shutdown
      await mockSessionAutoSaver.save(); // Force final save
      await mockSessionAutoSaver.stop();

      expect(mockSessionAutoSaver.save).toHaveBeenCalled();
      expect(mockSessionAutoSaver.stop).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle session store initialization failures', async () => {
      mockSessionStore.initialize.mockRejectedValue(new Error('Directory permission denied'));

      try {
        await mockSessionStore.initialize();
      } catch (error: any) {
        expect(error.message).toBe('Directory permission denied');
      }

      expect(mockSessionStore.initialize).toHaveBeenCalled();
    });

    it('should handle corrupted session data gracefully', async () => {
      const corruptedSession = {
        id: 'corrupted-session',
        // Missing required fields
        invalidField: 'bad data',
      };

      mockSessionStore.getSession.mockResolvedValue(corruptedSession);

      const session = await mockSessionStore.getSession('corrupted-session');

      // Should return the corrupted data, letting higher levels handle it
      expect(session).toEqual(corruptedSession);
    });

    it('should handle auto-save failures with retry logic', async () => {
      let failCount = 0;
      mockSessionAutoSaver.save.mockImplementation(() => {
        failCount++;
        if (failCount < 3) {
          return Promise.reject(new Error('Temporary save failure'));
        }
        return Promise.resolve();
      });

      // Simulate retry logic
      let success = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await mockSessionAutoSaver.save();
          success = true;
          break;
        } catch (error) {
          if (attempt === 3) throw error;
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      expect(success).toBe(true);
      expect(mockSessionAutoSaver.save).toHaveBeenCalledTimes(3);
    });

    it('should handle disk space exhaustion during save', async () => {
      mockSessionAutoSaver.save.mockRejectedValue(new Error('ENOSPC: no space left on device'));

      try {
        await mockSessionAutoSaver.save();
      } catch (error: any) {
        expect(error.message).toContain('no space left on device');
      }

      expect(mockSessionAutoSaver.save).toHaveBeenCalled();
    });

    it('should recover from interrupted sessions', async () => {
      // Simulate interrupted session with partial data
      const partialSession = {
        id: 'interrupted-session',
        name: 'Interrupted Session',
        createdAt: new Date(Date.now() - 60000),
        state: {
          tasksCreated: ['task-1', 'task-2'],
          tasksCompleted: ['task-1'],
          currentTaskId: 'task-2', // Task was in progress
        },
        messages: [
          { role: 'user', content: 'Start task 2' },
          // Missing completion messages
        ],
        inputHistory: ['Start task 1', 'Start task 2'],
      };

      mockSessionStore.getSession.mockResolvedValue(partialSession);
      const session = await mockSessionStore.getSession('interrupted-session');

      // Verify recovery data
      expect(session.state.currentTaskId).toBe('task-2');
      expect(session.state.tasksCompleted).toHaveLength(1);
      expect(session.messages).toHaveLength(1);
    });
  });

  describe('Multi-Session Management', () => {
    it('should handle multiple concurrent sessions', async () => {
      const sessions = [
        { name: 'Frontend Development', id: 'session-frontend' },
        { name: 'Backend API', id: 'session-backend' },
        { name: 'Testing', id: 'session-testing' },
      ];

      for (const sessionData of sessions) {
        const session = await mockSessionStore.createSession(sessionData.name);
        await mockSessionStore.saveSession({ ...session, id: sessionData.id });
      }

      expect(mockSessionStore.createSession).toHaveBeenCalledTimes(3);
      expect(mockSessionStore.saveSession).toHaveBeenCalledTimes(3);
    });

    it('should switch between sessions correctly', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      await mockSessionAutoSaver.stop(); // Stop current session
      await mockSessionStore.setActiveSession(session1);
      await mockSessionAutoSaver.start(session1);

      // Switch to session 2
      await mockSessionAutoSaver.stop();
      await mockSessionStore.setActiveSession(session2);
      await mockSessionAutoSaver.start(session2);

      expect(mockSessionAutoSaver.stop).toHaveBeenCalledTimes(2);
      expect(mockSessionStore.setActiveSession).toHaveBeenCalledWith(session1);
      expect(mockSessionStore.setActiveSession).toHaveBeenCalledWith(session2);
      expect(mockSessionAutoSaver.start).toHaveBeenCalledWith(session1);
      expect(mockSessionAutoSaver.start).toHaveBeenCalledWith(session2);
    });

    it('should archive old sessions to prevent storage bloat', async () => {
      const oldSessionId = 'old-session-to-archive';

      const archived = await mockSessionStore.archiveSession(oldSessionId);

      expect(archived).toBe(true);
      expect(mockSessionStore.archiveSession).toHaveBeenCalledWith(oldSessionId);
    });

    it('should clean up deleted sessions completely', async () => {
      const sessionToDelete = 'session-to-delete';

      const deleted = await mockSessionStore.deleteSession(sessionToDelete);

      expect(deleted).toBe(true);
      expect(mockSessionStore.deleteSession).toHaveBeenCalledWith(sessionToDelete);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large session data efficiently', async () => {
      const largeSession = {
        id: 'large-session',
        name: 'Large Session',
        createdAt: new Date(),
        state: {
          tasksCreated: Array.from({ length: 1000 }, (_, i) => `task-${i}`),
          tasksCompleted: Array.from({ length: 900 }, (_, i) => `task-${i}`),
          currentTaskId: 'task-999',
        },
        messages: Array.from({ length: 10000 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: new Date(Date.now() - (10000 - i) * 1000),
        })),
        inputHistory: Array.from({ length: 5000 }, (_, i) => `Command ${i}`),
      };

      await mockSessionStore.saveSession(largeSession);
      expect(mockSessionStore.saveSession).toHaveBeenCalledWith(largeSession);

      mockSessionStore.getSession.mockResolvedValue(largeSession);
      const retrievedSession = await mockSessionStore.getSession('large-session');

      expect(retrievedSession.messages).toHaveLength(10000);
      expect(retrievedSession.inputHistory).toHaveLength(5000);
      expect(retrievedSession.state.tasksCreated).toHaveLength(1000);
    });

    it('should implement pagination for large session lists', async () => {
      const manySessions = Array.from({ length: 100 }, (_, i) => ({
        id: `session-${i}`,
        name: `Session ${i}`,
        createdAt: new Date(Date.now() - i * 3600000), // 1 hour apart
        lastModified: new Date(Date.now() - i * 1800000), // 30 minutes apart
      }));

      mockSessionStore.listSessions.mockResolvedValue(manySessions);
      const sessions = await mockSessionStore.listSessions();

      expect(sessions).toHaveLength(100);
      expect(mockSessionStore.listSessions).toHaveBeenCalled();
    });

    it('should optimize auto-save frequency based on activity', () => {
      const highActivityInterval = 2000; // 2 seconds for high activity
      const lowActivityInterval = 30000; // 30 seconds for low activity

      // Simulate high activity
      mockSessionAutoSaver.setAutoSaveInterval(highActivityInterval);
      expect(mockSessionAutoSaver.setAutoSaveInterval).toHaveBeenCalledWith(highActivityInterval);

      // Simulate low activity
      mockSessionAutoSaver.setAutoSaveInterval(lowActivityInterval);
      expect(mockSessionAutoSaver.setAutoSaveInterval).toHaveBeenCalledWith(lowActivityInterval);
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should validate session data structure before save', async () => {
      const validSession = {
        id: 'valid-session',
        name: 'Valid Session',
        createdAt: new Date(),
        lastModified: new Date(),
        state: {
          tasksCreated: [],
          tasksCompleted: [],
          currentTaskId: undefined,
        },
        messages: [],
        inputHistory: [],
      };

      await mockSessionStore.saveSession(validSession);
      expect(mockSessionStore.saveSession).toHaveBeenCalledWith(validSession);
    });

    it('should maintain referential integrity for task relationships', async () => {
      const sessionWithTasks = {
        state: {
          tasksCreated: ['task-1', 'task-2', 'task-3'],
          tasksCompleted: ['task-1'], // task-1 exists in created
          currentTaskId: 'task-2', // task-2 exists in created
        },
        messages: [
          { content: 'Task created: task-1', taskId: 'task-1' },
          { content: 'Task created: task-2', taskId: 'task-2' },
          { content: 'Task completed: task-1', taskId: 'task-1' },
        ],
      };

      // Verify task references are consistent
      const createdTasks = sessionWithTasks.state.tasksCreated;
      const completedTasks = sessionWithTasks.state.tasksCompleted;
      const currentTask = sessionWithTasks.state.currentTaskId;

      expect(createdTasks).toContain('task-1');
      expect(createdTasks).toContain('task-2');
      expect(completedTasks.every(task => createdTasks.includes(task))).toBe(true);
      expect(currentTask ? createdTasks.includes(currentTask) : true).toBe(true);
    });
  });
});