import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionAutoSaver, AutoSaveOptions } from '../SessionAutoSaver';
import { SessionStore, Session, SessionMessage } from '../SessionStore';

// Mock the SessionStore
vi.mock('../SessionStore');

const MockSessionStore = vi.mocked(SessionStore);

describe('SessionAutoSaver', () => {
  let mockStore: SessionStore;
  let autoSaver: SessionAutoSaver;
  let mockSession: Session;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockStore = new MockSessionStore('/test/project');

    mockSession = {
      id: 'test-session',
      name: 'Test Session',
      projectPath: '/test/project',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      lastAccessedAt: new Date('2023-01-01'),
      messages: [],
      inputHistory: [],
      state: {
        totalTokens: { input: 0, output: 0 },
        totalCost: 0,
        tasksCreated: [],
        tasksCompleted: []
      },
      childSessionIds: [],
      tags: []
    };

    // Setup mock store methods
    vi.mocked(mockStore.getSession).mockResolvedValue(mockSession);
    vi.mocked(mockStore.createSession).mockResolvedValue(mockSession);
    vi.mocked(mockStore.updateSession).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    autoSaver?.stop();
  });

  describe('initialization', () => {
    it('should create with default options', () => {
      autoSaver = new SessionAutoSaver(mockStore);

      expect(autoSaver).toBeDefined();
      expect(autoSaver.getSession()).toBeNull();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });

    it('should accept custom options', () => {
      const options: Partial<AutoSaveOptions> = {
        enabled: false,
        intervalMs: 60000,
        maxUnsavedMessages: 10
      };

      autoSaver = new SessionAutoSaver(mockStore, options);

      expect(autoSaver).toBeDefined();
    });
  });

  describe('session lifecycle', () => {
    beforeEach(() => {
      autoSaver = new SessionAutoSaver(mockStore);
    });

    it('should start with existing session ID', async () => {
      const session = await autoSaver.start('existing-session');

      expect(mockStore.getSession).toHaveBeenCalledWith('existing-session');
      expect(session).toBe(mockSession);
      expect(autoSaver.getSession()).toBe(mockSession);
    });

    it('should create new session if ID not provided', async () => {
      const session = await autoSaver.start();

      expect(mockStore.createSession).toHaveBeenCalled();
      expect(session).toBe(mockSession);
    });

    it('should create new session if existing session not found', async () => {
      vi.mocked(mockStore.getSession).mockResolvedValue(null);

      const session = await autoSaver.start('non-existent-session');

      expect(mockStore.getSession).toHaveBeenCalledWith('non-existent-session');
      expect(mockStore.createSession).toHaveBeenCalled();
      expect(session).toBe(mockSession);
    });

    it('should stop and save when stopping', async () => {
      await autoSaver.start();
      await autoSaver.addMessage({ role: 'user', content: 'test message' });

      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      await autoSaver.stop();

      expect(mockStore.updateSession).toHaveBeenCalled();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      autoSaver = new SessionAutoSaver(mockStore);
      await autoSaver.start();
    });

    it('should add message with generated ID and index', async () => {
      await autoSaver.addMessage({
        role: 'user',
        content: 'Hello, APEX!'
      });

      const session = autoSaver.getSession()!;
      expect(session.messages).toHaveLength(1);

      const message = session.messages[0];
      expect(message.id).toMatch(/^msg_\d+_\w+$/);
      expect(message.index).toBe(0);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, APEX!');
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    it('should increment index for subsequent messages', async () => {
      await autoSaver.addMessage({ role: 'user', content: 'First' });
      await autoSaver.addMessage({ role: 'assistant', content: 'Second' });

      const session = autoSaver.getSession()!;
      expect(session.messages).toHaveLength(2);
      expect(session.messages[0].index).toBe(0);
      expect(session.messages[1].index).toBe(1);
    });

    it('should handle message with agent and task ID', async () => {
      await autoSaver.addMessage({
        role: 'assistant',
        content: 'I will help you',
        agent: 'planner',
        taskId: 'task-123'
      });

      const session = autoSaver.getSession()!;
      const message = session.messages[0];
      expect(message.agent).toBe('planner');
      expect(message.taskId).toBe('task-123');
    });

    it('should handle message with tokens and tool calls', async () => {
      const toolCalls = [{
        id: 'tool-1',
        name: 'Read',
        arguments: { file_path: 'test.txt' },
        result: 'file content',
        timestamp: new Date()
      }];

      await autoSaver.addMessage({
        role: 'assistant',
        content: 'Reading file...',
        tokens: { input: 10, output: 20 },
        toolCalls
      });

      const session = autoSaver.getSession()!;
      const message = session.messages[0];
      expect(message.tokens).toEqual({ input: 10, output: 20 });
      expect(message.toolCalls).toBe(toolCalls);
    });

    it('should track unsaved changes when adding messages', async () => {
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      await autoSaver.addMessage({ role: 'user', content: 'Test' });

      expect(autoSaver.hasUnsavedChanges()).toBe(true);
      expect(autoSaver.getUnsavedChangesCount()).toBe(1);
    });

    it('should auto-save when max unsaved messages reached', async () => {
      autoSaver = new SessionAutoSaver(mockStore, { maxUnsavedMessages: 2 });
      await autoSaver.start();

      await autoSaver.addMessage({ role: 'user', content: 'Message 1' });
      expect(autoSaver.getUnsavedChangesCount()).toBe(1);

      await autoSaver.addMessage({ role: 'user', content: 'Message 2' });

      expect(mockStore.updateSession).toHaveBeenCalled();
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);
    });
  });

  describe('state updates', () => {
    beforeEach(async () => {
      autoSaver = new SessionAutoSaver(mockStore);
      await autoSaver.start();
    });

    it('should update session state', async () => {
      await autoSaver.updateState({
        totalTokens: { input: 100, output: 200 },
        totalCost: 0.5
      });

      const session = autoSaver.getSession()!;
      expect(session.state.totalTokens).toEqual({ input: 100, output: 200 });
      expect(session.state.totalCost).toBe(0.5);
      expect(autoSaver.hasUnsavedChanges()).toBe(true);
    });

    it('should merge state updates with existing state', async () => {
      // First update
      await autoSaver.updateState({
        totalCost: 0.5,
        tasksCreated: ['task-1']
      });

      // Second update
      await autoSaver.updateState({
        totalCost: 0.8
      });

      const session = autoSaver.getSession()!;
      expect(session.state.totalCost).toBe(0.8);
      expect(session.state.tasksCreated).toEqual(['task-1']); // Preserved
    });

    it('should update session info', async () => {
      await autoSaver.updateSessionInfo({
        name: 'Updated Session Name',
        tags: ['work', 'important']
      });

      const session = autoSaver.getSession()!;
      expect(session.name).toBe('Updated Session Name');
      expect(session.tags).toEqual(['work', 'important']);
      expect(autoSaver.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('input history', () => {
    beforeEach(async () => {
      autoSaver = new SessionAutoSaver(mockStore);
      await autoSaver.start();
    });

    it('should add input to history', async () => {
      await autoSaver.addInputToHistory('first command');
      await autoSaver.addInputToHistory('second command');

      const session = autoSaver.getSession()!;
      expect(session.inputHistory).toEqual(['first command', 'second command']);
      expect(autoSaver.hasUnsavedChanges()).toBe(true);
    });

    it('should not add duplicate consecutive inputs', async () => {
      await autoSaver.addInputToHistory('same command');
      await autoSaver.addInputToHistory('same command');
      await autoSaver.addInputToHistory('different command');

      const session = autoSaver.getSession()!;
      expect(session.inputHistory).toEqual(['same command', 'different command']);
    });

    it('should limit history to 1000 entries', async () => {
      const session = autoSaver.getSession()!;

      // Pre-populate with 1000 entries
      for (let i = 0; i < 1000; i++) {
        session.inputHistory.push(`command ${i}`);
      }

      await autoSaver.addInputToHistory('new command');

      expect(session.inputHistory).toHaveLength(1000);
      expect(session.inputHistory[0]).toBe('command 1'); // First entry removed
      expect(session.inputHistory[999]).toBe('new command'); // New entry at end
    });
  });

  describe('auto-save timer', () => {
    it('should start timer when enabled', async () => {
      autoSaver = new SessionAutoSaver(mockStore, {
        enabled: true,
        intervalMs: 1000
      });

      await autoSaver.start();
      await autoSaver.addMessage({ role: 'user', content: 'test' });

      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Fast-forward timer
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(mockStore.updateSession).toHaveBeenCalled();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });

    it('should not start timer when disabled', async () => {
      autoSaver = new SessionAutoSaver(mockStore, {
        enabled: false,
        intervalMs: 1000
      });

      await autoSaver.start();
      await autoSaver.addMessage({ role: 'user', content: 'test' });

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(mockStore.updateSession).not.toHaveBeenCalled();
      expect(autoSaver.hasUnsavedChanges()).toBe(true);
    });

    it('should handle timer errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(mockStore.updateSession).mockRejectedValue(new Error('Save failed'));

      autoSaver = new SessionAutoSaver(mockStore, { intervalMs: 1000 });
      await autoSaver.start();
      await autoSaver.addMessage({ role: 'user', content: 'test' });

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('save operations', () => {
    beforeEach(async () => {
      autoSaver = new SessionAutoSaver(mockStore, { enabled: false });
      await autoSaver.start();
    });

    it('should save with updated timestamps', async () => {
      const originalUpdate = mockSession.updatedAt;
      const originalAccess = mockSession.lastAccessedAt;

      await autoSaver.addMessage({ role: 'user', content: 'test' });
      await autoSaver.save();

      const session = autoSaver.getSession()!;
      expect(session.updatedAt.getTime()).toBeGreaterThan(originalUpdate.getTime());
      expect(session.lastAccessedAt.getTime()).toBeGreaterThan(originalAccess.getTime());
    });

    it('should not save if no changes', async () => {
      await autoSaver.save();

      expect(mockStore.updateSession).not.toHaveBeenCalled();
    });

    it('should reset unsaved changes count after save', async () => {
      await autoSaver.addMessage({ role: 'user', content: 'test' });
      expect(autoSaver.getUnsavedChangesCount()).toBe(1);

      await autoSaver.save();
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);
    });

    it('should call onSave callback after saving', async () => {
      const onSaveMock = vi.fn();
      autoSaver.onAutoSave(onSaveMock);

      await autoSaver.addMessage({ role: 'user', content: 'test' });
      await autoSaver.save();

      expect(onSaveMock).toHaveBeenCalledWith(mockSession);
    });

    it('should not save if no current session', async () => {
      autoSaver = new SessionAutoSaver(mockStore);
      // Don't start, so no current session

      await autoSaver.save();

      expect(mockStore.updateSession).not.toHaveBeenCalled();
    });
  });

  describe('options management', () => {
    beforeEach(async () => {
      autoSaver = new SessionAutoSaver(mockStore, { enabled: true, intervalMs: 1000 });
      await autoSaver.start();
    });

    it('should update options', () => {
      autoSaver.updateOptions({ intervalMs: 2000, maxUnsavedMessages: 10 });

      // Options should be updated (verified by timer behavior)
      expect(autoSaver).toBeDefined(); // Basic check
    });

    it('should start timer when enabling auto-save', async () => {
      autoSaver.updateOptions({ enabled: false });

      await autoSaver.addMessage({ role: 'user', content: 'test' });
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(mockStore.updateSession).not.toHaveBeenCalled();

      // Enable and test timer starts
      autoSaver.updateOptions({ enabled: true });
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(mockStore.updateSession).toHaveBeenCalled();
    });

    it('should stop timer when disabling auto-save', async () => {
      autoSaver.updateOptions({ enabled: false });

      await autoSaver.addMessage({ role: 'user', content: 'test' });
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(mockStore.updateSession).not.toHaveBeenCalled();
    });
  });

  describe('getters', () => {
    beforeEach(async () => {
      autoSaver = new SessionAutoSaver(mockStore);
      await autoSaver.start();
    });

    it('should return current session', () => {
      expect(autoSaver.getSession()).toBe(mockSession);
    });

    it('should return null when no session', () => {
      autoSaver = new SessionAutoSaver(mockStore);
      expect(autoSaver.getSession()).toBeNull();
    });

    it('should track unsaved changes correctly', async () => {
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      await autoSaver.addMessage({ role: 'user', content: 'test' });
      expect(autoSaver.hasUnsavedChanges()).toBe(true);
      expect(autoSaver.getUnsavedChangesCount()).toBe(1);

      await autoSaver.updateState({ totalCost: 0.1 });
      expect(autoSaver.getUnsavedChangesCount()).toBe(2);

      await autoSaver.save();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      autoSaver = new SessionAutoSaver(mockStore);
      await autoSaver.start();
    });

    it('should handle save errors gracefully', async () => {
      vi.mocked(mockStore.updateSession).mockRejectedValue(new Error('Database error'));

      await autoSaver.addMessage({ role: 'user', content: 'test' });

      await expect(autoSaver.save()).rejects.toThrow('Database error');

      // Should still track unsaved changes
      expect(autoSaver.hasUnsavedChanges()).toBe(true);
    });

    it('should handle operations without current session', async () => {
      autoSaver = new SessionAutoSaver(mockStore);
      // Don't start, so no current session

      await autoSaver.addMessage({ role: 'user', content: 'test' });
      await autoSaver.updateState({ totalCost: 0.1 });
      await autoSaver.updateSessionInfo({ name: 'test' });
      await autoSaver.addInputToHistory('test command');

      // Should not throw, just be no-ops
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });
  });
});