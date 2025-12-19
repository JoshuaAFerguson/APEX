import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionAutoSaver, AutoSaveOptions } from '../SessionAutoSaver.js';
import { SessionStore, Session, SessionMessage } from '../SessionStore.js';

// NO MOCKING - Real file system operations

/**
 * Dynamic Auto-save Enable/Disable Integration Tests
 *
 * These tests verify the specific behavior of dynamic enable/disable functionality
 * and cover the following acceptance criteria:
 *
 * AC1: Test enabling auto-save starts timer and triggers saves
 * AC2: Test disabling auto-save stops timer but doesn't lose unsaved changes
 * AC3: Test toggling enable/disable multiple times preserves session state
 * AC4: Test updateOptions() runtime reconfiguration
 */
describe('SessionAutoSaver Dynamic Enable/Disable Integration Tests', () => {
  let tempDir: string;
  let store: SessionStore;
  let autoSaver: SessionAutoSaver;

  beforeEach(async () => {
    vi.useFakeTimers();
    // Create unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-dynamic-test-'));
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
   * Helper function to verify file system persistence with fresh store instance
   */
  async function verifySessionPersisted(sessionId: string): Promise<Session> {
    const freshStore = new SessionStore(tempDir);
    await freshStore.initialize();
    const session = await freshStore.getSession(sessionId);
    expect(session).not.toBeNull();
    return session!;
  }

  /**
   * Helper to add a test message
   */
  async function addTestMessage(
    autoSaver: SessionAutoSaver,
    content: string,
    role: 'user' | 'assistant' = 'user'
  ): Promise<void> {
    await autoSaver.addMessage({ role, content });
  }

  describe('AC1: Enabling auto-save starts timer and triggers saves', () => {
    it('should start timer immediately when enabled on session start', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 5000 });
      await autoSaver.start();

      // Add changes
      await addTestMessage(autoSaver, 'Test message');
      expect(autoSaver.hasUnsavedChanges()).toBe(true);
      expect(autoSaver.getUnsavedChangesCount()).toBe(1);

      // Timer should trigger save at interval
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Verify persistence
      const persistedSession = await verifySessionPersisted(autoSaver.getSession()!.id);
      expect(persistedSession.messages).toHaveLength(1);
      expect(persistedSession.messages[0].content).toBe('Test message');
    });

    it('should start timer when enabling auto-save via updateOptions', async () => {
      // Start disabled
      autoSaver = new SessionAutoSaver(store, { enabled: false, intervalMs: 3000 });
      await autoSaver.start();

      await addTestMessage(autoSaver, 'Before enable');
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Enable via updateOptions
      autoSaver.updateOptions({ enabled: true });

      // Timer should now be active
      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Verify save occurred
      const persistedSession = await verifySessionPersisted(autoSaver.getSession()!.id);
      expect(persistedSession.messages).toHaveLength(1);
      expect(persistedSession.messages[0].content).toBe('Before enable');
    });

    it('should trigger save for accumulated changes after enabling', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: false, intervalMs: 2000 });
      await autoSaver.start();

      // Accumulate changes while disabled
      await addTestMessage(autoSaver, 'Message 1');
      await autoSaver.updateState({ totalCost: 0.5 });
      expect(autoSaver.getUnsavedChangesCount()).toBe(2);

      // Enable auto-save
      autoSaver.updateOptions({ enabled: true });

      // Timer should save accumulated changes
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Verify all changes persisted
      const persistedSession = await verifySessionPersisted(autoSaver.getSession()!.id);
      expect(persistedSession.messages).toHaveLength(1);
      expect(persistedSession.state.totalCost).toBe(0.5);
    });
  });

  describe('AC2: Disabling auto-save stops timer but preserves unsaved changes', () => {
    it('should preserve unsaved changes count when disabling auto-save', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 10000 });
      await autoSaver.start();

      await addTestMessage(autoSaver, 'Test message');
      await autoSaver.updateState({ totalCost: 1.0 });

      const unsavedBefore = autoSaver.getUnsavedChangesCount();
      expect(unsavedBefore).toBe(2);

      // Disable auto-save
      autoSaver.updateOptions({ enabled: false });

      // Unsaved changes should be preserved
      expect(autoSaver.getUnsavedChangesCount()).toBe(2);
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Session state should still be available in memory
      expect(autoSaver.getSession()!.messages).toHaveLength(1);
      expect(autoSaver.getSession()!.state.totalCost).toBe(1.0);
    });

    it('should stop timer when disabling auto-save', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 3000 });
      await autoSaver.start();

      await addTestMessage(autoSaver, 'Test message');
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Disable before timer triggers
      autoSaver.updateOptions({ enabled: false });

      // Advance past interval - should NOT save
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      expect(autoSaver.hasUnsavedChanges()).toBe(true);
      expect(autoSaver.getUnsavedChangesCount()).toBe(1);

      // Verify no save occurred to file system
      const sessionId = autoSaver.getSession()!.id;
      const freshStore = new SessionStore(tempDir);
      await freshStore.initialize();
      const persistedSession = await freshStore.getSession(sessionId);

      // Session exists but message should not be persisted
      expect(persistedSession).not.toBeNull();
      expect(persistedSession!.messages).toHaveLength(0);
    });

    it('should allow manual save when auto-save is disabled', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: false });
      await autoSaver.start();

      await addTestMessage(autoSaver, 'Manual save test');
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Manual save should work
      await autoSaver.save();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Verify persistence with fresh store
      const persistedSession = await verifySessionPersisted(autoSaver.getSession()!.id);
      expect(persistedSession.messages).toHaveLength(1);
      expect(persistedSession.messages[0].content).toBe('Manual save test');
    });
  });

  describe('AC3: Multiple toggle cycles preserve session state', () => {
    it('should preserve session state through enable-disable-enable cycle', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 2000 });
      const session = await autoSaver.start();

      // Add state during enabled phase
      await addTestMessage(autoSaver, 'Phase 1');
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // Disable
      autoSaver.updateOptions({ enabled: false });
      await addTestMessage(autoSaver, 'Phase 2');
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Re-enable
      autoSaver.updateOptions({ enabled: true });
      await addTestMessage(autoSaver, 'Phase 3');

      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // All messages should be preserved
      const persistedSession = await verifySessionPersisted(session.id);
      expect(persistedSession.messages).toHaveLength(3);
      expect(persistedSession.messages.map(m => m.content)).toEqual([
        'Phase 1', 'Phase 2', 'Phase 3'
      ]);
    });

    it('should handle multiple toggle cycles with cumulative state', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 1000 });
      const session = await autoSaver.start();

      const phases = [
        { enabled: true, message: 'Enabled 1' },
        { enabled: false, message: 'Disabled 1' },
        { enabled: true, message: 'Enabled 2' },
        { enabled: false, message: 'Disabled 2' },
        { enabled: true, message: 'Enabled 3' },
      ];

      for (const phase of phases) {
        autoSaver.updateOptions({ enabled: phase.enabled });
        await addTestMessage(autoSaver, phase.message);

        if (phase.enabled) {
          vi.advanceTimersByTime(1000);
          await vi.runAllTimersAsync();
        }
      }

      // Final save to capture disabled phase messages
      await autoSaver.save();

      // Verify all state preserved
      const persistedSession = await verifySessionPersisted(session.id);
      expect(persistedSession.messages).toHaveLength(5);
      expect(persistedSession.messages.map(m => m.content)).toEqual([
        'Enabled 1', 'Disabled 1', 'Enabled 2', 'Disabled 2', 'Enabled 3'
      ]);
    });

    it('should remain stable during rapid toggle sequences', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 500 });
      const session = await autoSaver.start();

      await addTestMessage(autoSaver, 'Initial message');

      // Rapid toggles
      for (let i = 0; i < 10; i++) {
        autoSaver.updateOptions({ enabled: i % 2 === 0 });
      }

      // Final state should be disabled (10 % 2 === 0 is true, so enabled: false at i=9)
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Message should still exist in session (not lost)
      expect(autoSaver.getSession()?.messages).toHaveLength(1);
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Manual save should still work
      await autoSaver.save();
      const persistedSession = await verifySessionPersisted(session.id);
      expect(persistedSession.messages).toHaveLength(1);
      expect(persistedSession.messages[0].content).toBe('Initial message');
    });

    it('should preserve unsaved changes count through multiple toggles', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 10000 });
      await autoSaver.start();

      // Add some changes
      await addTestMessage(autoSaver, 'Message 1');
      await autoSaver.updateState({ totalCost: 0.1 });
      expect(autoSaver.getUnsavedChangesCount()).toBe(2);

      // Toggle multiple times
      autoSaver.updateOptions({ enabled: false });
      expect(autoSaver.getUnsavedChangesCount()).toBe(2);

      autoSaver.updateOptions({ enabled: true });
      expect(autoSaver.getUnsavedChangesCount()).toBe(2);

      autoSaver.updateOptions({ enabled: false });
      expect(autoSaver.getUnsavedChangesCount()).toBe(2);

      // Add more changes while disabled
      await addTestMessage(autoSaver, 'Message 2');
      expect(autoSaver.getUnsavedChangesCount()).toBe(3);

      // Manual save should clear all
      await autoSaver.save();
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);
    });
  });

  describe('AC4: updateOptions() runtime reconfiguration', () => {
    it('should apply new interval immediately when changed via updateOptions', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 10000 });
      await autoSaver.start();

      await addTestMessage(autoSaver, 'Test interval change');
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Change interval to shorter
      autoSaver.updateOptions({ intervalMs: 2000 });

      // Should save at new interval timing
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // Verify save occurred
      const persistedSession = await verifySessionPersisted(autoSaver.getSession()!.id);
      expect(persistedSession.messages).toHaveLength(1);
    });

    it('should apply new threshold immediately when changed via updateOptions', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, maxUnsavedMessages: 10 });
      await autoSaver.start();

      await addTestMessage(autoSaver, 'Msg 1');
      await addTestMessage(autoSaver, 'Msg 2');
      expect(autoSaver.getUnsavedChangesCount()).toBe(2);

      // Lower threshold to current unsaved count
      autoSaver.updateOptions({ maxUnsavedMessages: 2 });

      // Should NOT immediately trigger (threshold checked on add)
      expect(autoSaver.hasUnsavedChanges()).toBe(true);
      expect(autoSaver.getUnsavedChangesCount()).toBe(2);

      // Next message should trigger with new threshold
      await addTestMessage(autoSaver, 'Trigger message');
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);

      // Verify save occurred
      const persistedSession = await verifySessionPersisted(autoSaver.getSession()!.id);
      expect(persistedSession.messages).toHaveLength(3);
    });

    it('should handle combined interval, threshold, and enabled changes', async () => {
      autoSaver = new SessionAutoSaver(store, {
        enabled: false,
        intervalMs: 30000,
        maxUnsavedMessages: 10
      });
      const session = await autoSaver.start();

      // Accumulate changes
      await addTestMessage(autoSaver, 'Accumulated message');
      expect(autoSaver.getUnsavedChangesCount()).toBe(1);

      // Apply multiple changes at once
      autoSaver.updateOptions({
        enabled: true,
        intervalMs: 1000,
        maxUnsavedMessages: 2
      });

      // Timer should now be active with new interval
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // Verify persistence
      const persistedSession = await verifySessionPersisted(session.id);
      expect(persistedSession.messages).toHaveLength(1);
      expect(persistedSession.messages[0].content).toBe('Accumulated message');
    });

    it('should handle enable state changes with other options', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 5000 });
      await autoSaver.start();

      await addTestMessage(autoSaver, 'Before disable');

      // Disable with new interval - timer should stop
      autoSaver.updateOptions({ enabled: false, intervalMs: 1000 });

      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Re-enable - should use new interval
      autoSaver.updateOptions({ enabled: true });

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // Verify save occurred
      const persistedSession = await verifySessionPersisted(autoSaver.getSession()!.id);
      expect(persistedSession.messages).toHaveLength(1);
    });

    it('should handle interval changes while enabled without losing timer', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 5000 });
      await autoSaver.start();

      await addTestMessage(autoSaver, 'Before interval change');

      // Change interval while enabled - should restart timer
      autoSaver.updateOptions({ intervalMs: 2000 });

      // Should save at new interval
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // Add another message to test timer is still running
      await addTestMessage(autoSaver, 'After interval change');

      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // Verify both saves occurred
      const persistedSession = await verifySessionPersisted(autoSaver.getSession()!.id);
      expect(persistedSession.messages).toHaveLength(2);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle updateOptions with no changes gracefully', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 2000 });
      await autoSaver.start();

      await addTestMessage(autoSaver, 'Test message');

      // Update with same options
      autoSaver.updateOptions({ enabled: true, intervalMs: 2000 });

      // Should still work normally
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });

    it('should handle updateOptions with partial options', async () => {
      autoSaver = new SessionAutoSaver(store, {
        enabled: true,
        intervalMs: 5000,
        maxUnsavedMessages: 10
      });
      await autoSaver.start();

      await addTestMessage(autoSaver, 'Test partial update');

      // Update only one option
      autoSaver.updateOptions({ intervalMs: 1000 });

      // Should still be enabled and use new interval
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // Verify other options unchanged by testing threshold
      for (let i = 0; i < 9; i++) {
        await addTestMessage(autoSaver, `Message ${i + 2}`);
      }
      expect(autoSaver.getUnsavedChangesCount()).toBe(9);

      // 10th message should trigger threshold save
      await addTestMessage(autoSaver, 'Threshold trigger');
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);
    });

    it('should handle rapid updateOptions calls', async () => {
      autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 10000 });
      await autoSaver.start();

      await addTestMessage(autoSaver, 'Rapid updates test');

      // Rapid option updates
      for (let i = 0; i < 5; i++) {
        autoSaver.updateOptions({ intervalMs: 1000 + i * 100 });
      }

      // Should work with final interval (1400ms)
      vi.advanceTimersByTime(1400);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });
  });
});