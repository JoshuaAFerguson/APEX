import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionAutoSaver, AutoSaveOptions } from '../SessionAutoSaver.js';
import { SessionStore, Session, SessionMessage } from '../SessionStore.js';

// NO MOCKING - Real file system operations

/**
 * Integration tests for SessionAutoSaver auto-save interval and message threshold functionality.
 * These tests verify real file system persistence and cover the following acceptance criteria:
 *
 * AC1: Test auto-save triggers at configured interval (30s default) using fake timers
 * AC2: Test auto-save triggers when maxUnsavedMessages threshold reached (5 default)
 * AC3: Test with custom interval and threshold configurations
 * AC4: Verify saved data persists correctly to real file system
 */
describe('SessionAutoSaver Integration Tests (Real File System)', () => {
  let tempDir: string;
  let store: SessionStore;
  let autoSaver: SessionAutoSaver;

  beforeEach(async () => {
    vi.useFakeTimers();
    // Create unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-autosave-test-'));
    store = new SessionStore(tempDir);
    await store.initialize();
  });

  afterEach(async () => {
    vi.useRealTimers();
    autoSaver?.stop();
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper function to verify file system persistence
   */
  async function verifySessionPersisted(sessionId: string, expectedMessages: number): Promise<Session> {
    // Create new store instance to simulate restart
    const freshStore = new SessionStore(tempDir);
    await freshStore.initialize();

    const session = await freshStore.getSession(sessionId);
    expect(session).not.toBeNull();
    expect(session!.messages).toHaveLength(expectedMessages);

    return session!;
  }

  /**
   * Helper to add a test message
   */
  async function addTestMessage(autoSaver: SessionAutoSaver, content: string, role: 'user' | 'assistant' = 'user'): Promise<void> {
    await autoSaver.addMessage({
      role,
      content,
    });
  }

  describe('Auto-save interval functionality', () => {
    it('should auto-save at configured interval (30s default) using fake timers', async () => {
      // Test AC1: Auto-save triggers at configured interval (30s default)
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: 30000 // 30 seconds (default)
      });

      const session = await autoSaver.start();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // Add messages to create unsaved changes
      await addTestMessage(autoSaver, 'First message');
      await addTestMessage(autoSaver, 'Second message');
      expect(autoSaver.hasUnsavedChanges()).toBe(true);
      expect(autoSaver.getUnsavedChangesCount()).toBe(2);

      // Advance timer to just before 30 seconds - should not save yet
      vi.advanceTimersByTime(29000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Advance timer to 30 seconds - should trigger auto-save
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Verify auto-save occurred
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Verify data persisted to real file system
      const persistedSession = await verifySessionPersisted(session.id, 2);
      expect(persistedSession.messages[0].content).toBe('First message');
      expect(persistedSession.messages[1].content).toBe('Second message');
    });

    it('should use custom interval configuration', async () => {
      // Test AC3: Test with custom interval configuration
      const customInterval = 45000; // 45 seconds
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: customInterval
      });

      const session = await autoSaver.start();
      await addTestMessage(autoSaver, 'Custom interval test');
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Should not save at 30 seconds (default interval)
      vi.advanceTimersByTime(30000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Should save at 45 seconds (custom interval)
      vi.advanceTimersByTime(15000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // Verify persistence with custom interval
      await verifySessionPersisted(session.id, 1);
    });

    it('should handle multiple auto-save cycles', async () => {
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: 10000 // 10 seconds for faster testing
      });

      const session = await autoSaver.start();

      // First cycle
      await addTestMessage(autoSaver, 'Cycle 1 message');
      expect(autoSaver.getUnsavedChangesCount()).toBe(1);

      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Second cycle
      await addTestMessage(autoSaver, 'Cycle 2 message');
      expect(autoSaver.getUnsavedChangesCount()).toBe(1);

      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Verify both messages persisted
      const persistedSession = await verifySessionPersisted(session.id, 2);
      expect(persistedSession.messages[0].content).toBe('Cycle 1 message');
      expect(persistedSession.messages[1].content).toBe('Cycle 2 message');
    });
  });

  describe('Message threshold auto-save functionality', () => {
    it('should auto-save when maxUnsavedMessages threshold reached (5 default)', async () => {
      // Test AC2: Auto-save triggers when maxUnsavedMessages threshold reached (5 default)
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        maxUnsavedMessages: 5 // Default threshold
      });

      const session = await autoSaver.start();

      // Add messages up to threshold
      for (let i = 1; i <= 4; i++) {
        await addTestMessage(autoSaver, `Message ${i}`);
        expect(autoSaver.getUnsavedChangesCount()).toBe(i);
        expect(autoSaver.hasUnsavedChanges()).toBe(true);
      }

      // Adding the 5th message should trigger auto-save
      await addTestMessage(autoSaver, 'Threshold message');

      // Auto-save should have triggered immediately
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // Verify all messages persisted to real file system
      const persistedSession = await verifySessionPersisted(session.id, 5);
      expect(persistedSession.messages[4].content).toBe('Threshold message');
    });

    it('should use custom message threshold configuration', async () => {
      // Test AC3: Test with custom threshold configuration
      const customThreshold = 3;
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        maxUnsavedMessages: customThreshold
      });

      const session = await autoSaver.start();

      // Add messages up to custom threshold
      await addTestMessage(autoSaver, 'Message 1');
      await addTestMessage(autoSaver, 'Message 2');
      expect(autoSaver.getUnsavedChangesCount()).toBe(2);

      // Third message should trigger auto-save with custom threshold
      await addTestMessage(autoSaver, 'Custom threshold trigger');
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Verify persistence with custom threshold
      await verifySessionPersisted(session.id, 3);
    });

    it('should handle mixed operations triggering threshold', async () => {
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        maxUnsavedMessages: 3
      });

      const session = await autoSaver.start();

      // Mix different operations that create unsaved changes
      await addTestMessage(autoSaver, 'User message');
      await autoSaver.updateState({ totalCost: 0.1 });
      await autoSaver.addInputToHistory('test command');

      // Should have triggered auto-save
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Verify all changes persisted
      const persistedSession = await verifySessionPersisted(session.id, 1);
      expect(persistedSession.state.totalCost).toBe(0.1);
      expect(persistedSession.inputHistory).toContain('test command');
    });
  });

  describe('Combined interval and threshold scenarios', () => {
    it('should save on whichever trigger occurs first', async () => {
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: 60000, // 60 seconds
        maxUnsavedMessages: 2 // Lower threshold
      });

      const session = await autoSaver.start();

      // Add message that reaches threshold before timer
      await addTestMessage(autoSaver, 'Message 1');
      await addTestMessage(autoSaver, 'Threshold trigger');

      // Should save immediately due to threshold, not wait for timer
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Add one more message
      await addTestMessage(autoSaver, 'After threshold save');
      expect(autoSaver.getUnsavedChangesCount()).toBe(1);

      // Advance timer - should save the remaining message
      vi.advanceTimersByTime(60000);
      await vi.runAllTimersAsync();
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Verify all messages persisted
      await verifySessionPersisted(session.id, 3);
    });

    it('should handle rapid message additions with threshold', async () => {
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        maxUnsavedMessages: 4
      });

      const session = await autoSaver.start();

      // Rapidly add messages
      const messagePromises = [];
      for (let i = 1; i <= 10; i++) {
        messagePromises.push(addTestMessage(autoSaver, `Rapid message ${i}`));
      }
      await Promise.all(messagePromises);

      // Should have auto-saved multiple times
      expect(autoSaver.getUnsavedChangesCount()).toBe(2); // 10 messages, saved in batches of 4

      // Verify messages persisted
      const persistedSession = await verifySessionPersisted(session.id, 8); // 8 messages saved so far
      expect(persistedSession.messages[0].content).toBe('Rapid message 1');
    });
  });

  describe('Real file system persistence verification', () => {
    it('should persist complex session data correctly', async () => {
      // Test AC4: Verify saved data persists correctly to real file system
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: 1000 // 1 second for quick testing
      });

      const session = await autoSaver.start();

      // Add message with complex data
      await autoSaver.addMessage({
        role: 'assistant',
        content: 'Complex message with metadata',
        agent: 'developer',
        taskId: 'task-123',
        tokens: { input: 100, output: 200 },
        toolCalls: [{
          id: 'tool-1',
          name: 'Read',
          arguments: { file_path: '/test/file.ts' },
          result: 'File content',
          timestamp: new Date()
        }]
      });

      // Update state and session info
      await autoSaver.updateState({
        totalTokens: { input: 500, output: 800 },
        totalCost: 1.25,
        tasksCreated: ['task-123', 'task-456'],
        currentTaskId: 'task-123'
      });

      await autoSaver.updateSessionInfo({
        name: 'Integration Test Session',
        tags: ['integration', 'auto-save', 'test']
      });

      await autoSaver.addInputToHistory('complex command with args');

      // Trigger auto-save
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Verify complex data persisted correctly
      const persistedSession = await verifySessionPersisted(session.id, 1);

      // Check message data
      const message = persistedSession.messages[0];
      expect(message.content).toBe('Complex message with metadata');
      expect(message.agent).toBe('developer');
      expect(message.taskId).toBe('task-123');
      expect(message.tokens).toEqual({ input: 100, output: 200 });
      expect(message.toolCalls).toHaveLength(1);
      expect(message.toolCalls![0].name).toBe('Read');
      expect(message.toolCalls![0].result).toBe('File content');

      // Check state data
      expect(persistedSession.state.totalTokens).toEqual({ input: 500, output: 800 });
      expect(persistedSession.state.totalCost).toBe(1.25);
      expect(persistedSession.state.tasksCreated).toEqual(['task-123', 'task-456']);
      expect(persistedSession.state.currentTaskId).toBe('task-123');

      // Check session info
      expect(persistedSession.name).toBe('Integration Test Session');
      expect(persistedSession.tags).toEqual(['integration', 'auto-save', 'test']);
      expect(persistedSession.inputHistory).toContain('complex command with args');
    });

    it('should handle session restart and continue auto-saving', async () => {
      // Initial session with auto-save
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: 5000
      });

      const session = await autoSaver.start();
      await addTestMessage(autoSaver, 'Before restart');

      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      const sessionId = session.id;
      await autoSaver.stop();

      // Simulate restart - create new instances
      const newStore = new SessionStore(tempDir);
      await newStore.initialize();

      const newAutoSaver = new SessionAutoSaver(newStore, {
        enabled: true,
        intervalMs: 3000
      });

      // Continue with existing session
      await newAutoSaver.start(sessionId);
      await addTestMessage(newAutoSaver, 'After restart');

      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      // Verify session continued correctly
      const finalSession = await verifySessionPersisted(sessionId, 2);
      expect(finalSession.messages[0].content).toBe('Before restart');
      expect(finalSession.messages[1].content).toBe('After restart');

      newAutoSaver.stop();
    });

    it('should maintain data integrity during concurrent operations', async () => {
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: 2000,
        maxUnsavedMessages: 10 // High threshold to test timer-based saves
      });

      const session = await autoSaver.start();

      // Perform concurrent operations
      const operations = [
        addTestMessage(autoSaver, 'Concurrent message 1'),
        autoSaver.updateState({ totalCost: 0.5 }),
        addTestMessage(autoSaver, 'Concurrent message 2'),
        autoSaver.addInputToHistory('concurrent command 1'),
        addTestMessage(autoSaver, 'Concurrent message 3'),
        autoSaver.addInputToHistory('concurrent command 2'),
      ];

      await Promise.all(operations);

      // Trigger auto-save
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      // Verify all concurrent changes persisted correctly
      const persistedSession = await verifySessionPersisted(session.id, 3);
      expect(persistedSession.state.totalCost).toBe(0.5);
      expect(persistedSession.inputHistory).toEqual(['concurrent command 1', 'concurrent command 2']);

      // Check all messages are present and in correct order
      expect(persistedSession.messages[0].content).toBe('Concurrent message 1');
      expect(persistedSession.messages[1].content).toBe('Concurrent message 2');
      expect(persistedSession.messages[2].content).toBe('Concurrent message 3');
    });
  });

  describe('Auto-save option updates', () => {
    it('should dynamically update auto-save settings', async () => {
      // Start with one configuration
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: 10000,
        maxUnsavedMessages: 5
      });

      const session = await autoSaver.start();
      await addTestMessage(autoSaver, 'Initial message');

      // Update options
      autoSaver.updateOptions({
        intervalMs: 2000,
        maxUnsavedMessages: 2
      });

      // Add message that should trigger new threshold
      await addTestMessage(autoSaver, 'Second message');
      expect(autoSaver.getUnsavedChangesCount()).toBe(0); // Should have auto-saved

      // Verify save occurred
      await verifySessionPersisted(session.id, 2);
    });

    it('should disable and re-enable auto-save correctly', async () => {
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: 1000
      });

      const session = await autoSaver.start();
      await addTestMessage(autoSaver, 'Before disable');

      // Disable auto-save
      autoSaver.updateOptions({ enabled: false });

      // Should not auto-save even after timer
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Re-enable auto-save
      autoSaver.updateOptions({ enabled: true });

      // Should now auto-save
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // Verify data persisted
      await verifySessionPersisted(session.id, 1);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle file system errors gracefully', async () => {
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: 1000
      });

      const session = await autoSaver.start();
      await addTestMessage(autoSaver, 'Test message');

      // Simulate file system error by removing directory
      await fs.rm(tempDir, { recursive: true, force: true });

      // Auto-save should fail but not crash
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Should have logged error
      expect(consoleSpy).toHaveBeenCalled();

      // Unsaved changes should still be tracked
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle session without initial ID', async () => {
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: 1000
      });

      // Start without existing session ID
      const session = await autoSaver.start();
      expect(session.id).toMatch(/^sess_/);

      await addTestMessage(autoSaver, 'New session message');

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Should persist new session
      await verifySessionPersisted(session.id, 1);
    });
  });
});