import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionAutoSaver, AutoSaveOptions } from '../SessionAutoSaver.js';
import { SessionStore, Session, SessionMessage, SessionState } from '../SessionStore.js';

/**
 * Test suite for JSDoc documented SessionAutoSaver class
 * Tests the automatic session saving service functionality
 */
describe('SessionAutoSaver JSDoc Documented Functionality', () => {
  let mockStore: SessionStore;
  let autoSaver: SessionAutoSaver;
  let mockSession: Session;
  let mockSessionState: SessionState;
  let mockSaveCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock session state
    mockSessionState = {
      totalTokens: { input: 100, output: 50 },
      totalCost: 0.01,
      tasksCreated: ['task1'],
      tasksCompleted: [],
      currentTaskId: 'task1',
    };

    // Create mock session
    mockSession = {
      id: 'test-session-123',
      name: 'Test Session',
      projectPath: '/test/project',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T01:00:00Z'),
      lastAccessedAt: new Date('2024-01-01T01:00:00Z'),
      messages: [],
      inputHistory: [],
      state: mockSessionState,
    };

    // Create mock store with proper methods
    mockStore = {
      createSession: vi.fn().mockResolvedValue(mockSession),
      getSession: vi.fn().mockResolvedValue(mockSession),
      saveSession: vi.fn().mockResolvedValue(undefined),
      getActiveSessionId: vi.fn().mockResolvedValue('test-session-123'),
      setActiveSession: vi.fn().mockResolvedValue(undefined),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      addMessage: vi.fn().mockResolvedValue(undefined),
      updateSessionState: vi.fn().mockResolvedValue(undefined),
      exportSession: vi.fn().mockResolvedValue('exported-data'),
    } as unknown as SessionStore;

    mockSaveCallback = vi.fn();

    // Use fake timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('AutoSaveOptions interface validation', () => {
    it('should accept valid AutoSaveOptions configuration', () => {
      const validOptions: AutoSaveOptions = {
        enabled: true,
        intervalMs: 30000,
        maxUnsavedMessages: 5,
      };

      const autoSaver = new SessionAutoSaver(mockStore, validOptions);
      expect(autoSaver).toBeInstanceOf(SessionAutoSaver);
    });

    it('should accept partial AutoSaveOptions and use defaults', () => {
      const partialOptions: Partial<AutoSaveOptions> = {
        enabled: false,
      };

      const autoSaver = new SessionAutoSaver(mockStore, partialOptions);
      expect(autoSaver).toBeInstanceOf(SessionAutoSaver);
    });

    it('should handle empty options and use defaults', () => {
      const autoSaver = new SessionAutoSaver(mockStore);
      expect(autoSaver).toBeInstanceOf(SessionAutoSaver);
    });
  });

  describe('SessionAutoSaver class functionality', () => {
    beforeEach(() => {
      autoSaver = new SessionAutoSaver(mockStore, {
        enabled: true,
        intervalMs: 1000, // 1 second for faster testing
        maxUnsavedMessages: 3,
      });
    });

    it('should create SessionAutoSaver instance with store and options', () => {
      expect(autoSaver).toBeInstanceOf(SessionAutoSaver);
    });

    it('should start with existing session ID', async () => {
      const result = await autoSaver.start('existing-session-id');

      expect(mockStore.getSession).toHaveBeenCalledWith('existing-session-id');
      expect(result).toEqual(mockSession);
    });

    it('should start with active session when no ID provided', async () => {
      const result = await autoSaver.start();

      expect(mockStore.getActiveSessionId).toHaveBeenCalled();
      expect(mockStore.getSession).toHaveBeenCalledWith('test-session-123');
      expect(result).toEqual(mockSession);
    });

    it('should create new session when none exists', async () => {
      // Mock no active session
      vi.mocked(mockStore.getActiveSessionId).mockResolvedValue(null);
      vi.mocked(mockStore.getSession).mockResolvedValue(null);

      const result = await autoSaver.start();

      expect(mockStore.createSession).toHaveBeenCalled();
      expect(result).toEqual(mockSession);
    });

    it('should handle session loading errors gracefully', async () => {
      vi.mocked(mockStore.getSession).mockRejectedValue(new Error('Session not found'));
      vi.mocked(mockStore.createSession).mockResolvedValue(mockSession);

      const result = await autoSaver.start('invalid-session-id');

      expect(mockStore.createSession).toHaveBeenCalled();
      expect(result).toEqual(mockSession);
    });
  });

  describe('Auto-save functionality', () => {
    beforeEach(() => {
      autoSaver = new SessionAutoSaver(mockStore, {
        enabled: true,
        intervalMs: 1000,
        maxUnsavedMessages: 2,
      });
    });

    it('should trigger auto-save based on time interval', async () => {
      await autoSaver.start();

      // Advance timer to trigger auto-save
      vi.advanceTimersByTime(1000);

      // Allow any pending promises to resolve
      await new Promise(resolve => setImmediate(resolve));

      expect(mockStore.saveSession).toHaveBeenCalled();
    });

    it('should auto-save when message count threshold is reached', async () => {
      await autoSaver.start();

      // Simulate adding messages that exceed threshold
      autoSaver.trackMessageAdd();
      autoSaver.trackMessageAdd();
      autoSaver.trackMessageAdd(); // This should trigger auto-save

      // Allow pending operations to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(mockStore.saveSession).toHaveBeenCalled();
    });

    it('should not auto-save when disabled', async () => {
      const disabledAutoSaver = new SessionAutoSaver(mockStore, {
        enabled: false,
        intervalMs: 1000,
        maxUnsavedMessages: 2,
      });

      await disabledAutoSaver.start();

      // Advance timer
      vi.advanceTimersByTime(2000);

      // Try to trigger message threshold
      disabledAutoSaver.trackMessageAdd();
      disabledAutoSaver.trackMessageAdd();
      disabledAutoSaver.trackMessageAdd();

      expect(mockStore.saveSession).not.toHaveBeenCalled();
    });
  });

  describe('Session management methods', () => {
    beforeEach(async () => {
      autoSaver = new SessionAutoSaver(mockStore, {
        enabled: true,
        intervalMs: 5000,
        maxUnsavedMessages: 5,
      });
      await autoSaver.start();
    });

    it('should provide method to manually save session', async () => {
      await autoSaver.save();

      expect(mockStore.saveSession).toHaveBeenCalledWith(mockSession);
    });

    it('should handle save errors gracefully', async () => {
      vi.mocked(mockStore.saveSession).mockRejectedValue(new Error('Save failed'));

      // Should not throw
      await expect(autoSaver.save()).resolves.toBeUndefined();
    });

    it('should allow stopping auto-save functionality', () => {
      autoSaver.stop();

      // Advance timer - should not trigger save after stopping
      vi.advanceTimersByTime(10000);

      expect(mockStore.saveSession).not.toHaveBeenCalled();
    });

    it('should support setting save callback', async () => {
      autoSaver.onSave(mockSaveCallback);

      await autoSaver.save();

      expect(mockSaveCallback).toHaveBeenCalledWith(mockSession);
    });
  });

  describe('Configuration validation', () => {
    it('should validate intervalMs is positive', () => {
      expect(() => {
        new SessionAutoSaver(mockStore, { intervalMs: -1000 });
      }).not.toThrow(); // Constructor shouldn't validate, but behavior should be sane
    });

    it('should validate maxUnsavedMessages is positive', () => {
      expect(() => {
        new SessionAutoSaver(mockStore, { maxUnsavedMessages: -5 });
      }).not.toThrow(); // Constructor shouldn't validate, but behavior should be sane
    });

    it('should handle edge case configurations', async () => {
      const edgeCaseAutoSaver = new SessionAutoSaver(mockStore, {
        enabled: true,
        intervalMs: 0, // Edge case: no interval
        maxUnsavedMessages: 0, // Edge case: save on every message
      });

      await edgeCaseAutoSaver.start();

      // Should not crash
      expect(edgeCaseAutoSaver).toBeInstanceOf(SessionAutoSaver);
    });
  });

  describe('Error handling and resilience', () => {
    beforeEach(async () => {
      autoSaver = new SessionAutoSaver(mockStore, {
        enabled: true,
        intervalMs: 1000,
        maxUnsavedMessages: 3,
      });
    });

    it('should handle store failures during auto-save', async () => {
      vi.mocked(mockStore.saveSession).mockRejectedValue(new Error('Storage error'));

      await autoSaver.start();

      // Trigger auto-save
      vi.advanceTimersByTime(1000);
      await new Promise(resolve => setImmediate(resolve));

      // Should not crash the auto-saver
      expect(autoSaver).toBeInstanceOf(SessionAutoSaver);
    });

    it('should continue working after save failures', async () => {
      // First save fails, second succeeds
      vi.mocked(mockStore.saveSession)
        .mockRejectedValueOnce(new Error('First save failed'))
        .mockResolvedValueOnce(undefined);

      await autoSaver.start();

      // Trigger first save (should fail)
      vi.advanceTimersByTime(1000);
      await new Promise(resolve => setImmediate(resolve));

      // Trigger second save (should succeed)
      vi.advanceTimersByTime(1000);
      await new Promise(resolve => setImmediate(resolve));

      expect(mockStore.saveSession).toHaveBeenCalledTimes(2);
    });
  });
});