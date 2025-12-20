/**
 * Session Auto-Save Documentation Test
 *
 * Tests that verify auto-save functionality matches the CLI Guide
 * documentation for intelligent automatic session persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { SessionStore, Session } from '../services/SessionStore.js';
import { SessionAutoSaver, AutoSaveOptions } from '../services/SessionAutoSaver.js';

vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

const createTestSession = (): Session => ({
  id: 'sess_autosave_1703123456789',
  name: 'Auto-Save Test Session',
  projectPath: '/test/project',
  createdAt: new Date('2024-12-15T10:30:00.000Z'),
  updatedAt: new Date('2024-12-15T10:30:00.000Z'),
  lastAccessedAt: new Date('2024-12-15T10:30:00.000Z'),
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
});

describe('Session Auto-Save Documentation Validation', () => {
  let sessionStore: SessionStore;
  let autoSaver: SessionAutoSaver;
  let testSession: Session;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    sessionStore = new SessionStore('/test/project');
    testSession = createTestSession();

    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockImplementation((filePath) => {
      if (filePath.toString().includes(`${testSession.id}.json`)) {
        return Promise.resolve(JSON.stringify(testSession));
      }
      return Promise.reject(new Error('File not found'));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    autoSaver?.stop();
    vi.resetAllMocks();
  });

  describe('Auto-Save Timer Intervals', () => {
    it('should auto-save every 30 seconds by default as documented', async () => {
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 30000, // 30 seconds as mentioned in documentation
      });

      await autoSaver.start(testSession.id);

      // Add a message to trigger unsaved changes
      await autoSaver.addMessage({
        role: 'user',
        content: 'Test auto-save functionality'
      });

      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Initial save count (session creation)
      const initialSaveCount = mockFs.writeFile.mock.calls.length;

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);
      await vi.runAllTimersAsync();

      // Should have auto-saved
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${testSession.id}.json`),
        expect.any(String)
      );

      // Should have made additional save call
      expect(mockFs.writeFile.mock.calls.length).toBeGreaterThan(initialSaveCount);
    });

    it('should support configurable auto-save intervals', async () => {
      // Test with 60-second interval
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 60000, // 1 minute
      });

      await autoSaver.start(testSession.id);
      await autoSaver.addMessage({ role: 'user', content: 'Test message' });

      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Fast-forward 59 seconds (shouldn't save yet)
      vi.advanceTimersByTime(59000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Fast-forward 1 more second (should save)
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('Intelligent Auto-Save Thresholds', () => {
    it('should auto-save after maximum unsaved messages threshold', async () => {
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 300000, // 5 minutes (long interval)
        maxUnsavedMessages: 5, // Save after 5 unsaved messages
      });

      await autoSaver.start(testSession.id);

      // Add 4 messages (shouldn't trigger auto-save)
      for (let i = 0; i < 4; i++) {
        await autoSaver.addMessage({
          role: 'user',
          content: `Message ${i + 1}`
        });
      }

      expect(autoSaver.getUnsavedChangesCount()).toBe(4);
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Add 5th message (should trigger auto-save)
      await autoSaver.addMessage({
        role: 'user',
        content: 'Message 5 - triggers auto-save'
      });

      // Should have auto-saved immediately
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });

    it('should auto-save on important state changes', async () => {
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 300000, // Long interval
        maxUnsavedMessages: 10, // High threshold
      });

      await autoSaver.start(testSession.id);

      // Important state change: task completion
      await autoSaver.updateState({
        totalCost: 5.0,
        totalTokens: { input: 10000, output: 5000 },
        tasksCreated: ['task-1', 'task-2'],
        tasksCompleted: ['task-1'], // Task completion is important
        currentTaskId: 'task-2',
      });

      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Should auto-save on next opportunity due to important change
      vi.advanceTimersByTime(30000); // Some time passes
      await vi.runAllTimersAsync();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('Session State Preservation', () => {
    it('should preserve session state across unexpected shutdowns', async () => {
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 30000,
        maxUnsavedMessages: 10,
      });

      await autoSaver.start(testSession.id);

      // Simulate important work being done
      await autoSaver.addMessage({
        role: 'user',
        content: 'Important user request: implement authentication'
      });

      await autoSaver.addMessage({
        role: 'assistant',
        content: 'I\'ll implement a comprehensive authentication system...',
        agent: 'planner',
        stage: 'planning',
        tokens: { input: 1200, output: 800 },
        cost: 0.02
      });

      await autoSaver.updateState({
        totalCost: 2.5,
        totalTokens: { input: 15000, output: 8500 },
        tasksCreated: ['auth-task-123'],
        currentTaskId: 'auth-task-123',
        lastGitBranch: 'feature/auth-implementation'
      });

      await autoSaver.addInputToHistory('implement authentication');
      await autoSaver.addInputToHistory('/session save "Auth Feature Work"');

      // Trigger auto-save before "shutdown"
      vi.advanceTimersByTime(30000);
      await vi.runAllTimersAsync();

      // Verify all state was preserved
      const lastSaveCall = mockFs.writeFile.mock.calls
        .filter(call => call[0].toString().includes(`${testSession.id}.json`))
        .pop();

      expect(lastSaveCall).toBeDefined();
      const savedSession = JSON.parse(lastSaveCall![1] as string);

      expect(savedSession).toMatchObject({
        id: testSession.id,
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Important user request: implement authentication'
          }),
          expect.objectContaining({
            role: 'assistant',
            content: expect.stringContaining('authentication system'),
            agent: 'planner',
            stage: 'planning',
            tokens: { input: 1200, output: 800 },
            cost: 0.02
          })
        ]),
        state: expect.objectContaining({
          totalCost: 2.5,
          totalTokens: { input: 15000, output: 8500 },
          tasksCreated: ['auth-task-123'],
          currentTaskId: 'auth-task-123',
          lastGitBranch: 'feature/auth-implementation'
        }),
        inputHistory: expect.arrayContaining([
          'implement authentication',
          '/session save "Auth Feature Work"'
        ])
      });
    });
  });

  describe('Auto-Save Configuration Options', () => {
    it('should respect enabled/disabled setting', async () => {
      // Test with auto-save disabled
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: false,
        intervalMs: 1000, // Short interval
      });

      await autoSaver.start(testSession.id);
      await autoSaver.addMessage({ role: 'user', content: 'Test message' });

      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Fast-forward past interval
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      // Should still have unsaved changes (auto-save disabled)
      expect(autoSaver.hasUnsavedChanges()).toBe(true);
    });

    it('should support dynamic option updates', async () => {
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 60000, // 1 minute
      });

      await autoSaver.start(testSession.id);
      await autoSaver.addMessage({ role: 'user', content: 'Test message' });

      // Update options to shorter interval
      autoSaver.updateOptions({ intervalMs: 10000 }); // 10 seconds

      // Should auto-save with new interval
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('Auto-Save Error Handling', () => {
    it('should handle auto-save failures gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 1000,
      });

      await autoSaver.start(testSession.id);
      await autoSaver.addMessage({ role: 'user', content: 'Test message' });

      // Mock save failure
      mockFs.writeFile.mockRejectedValueOnce(new Error('Disk full'));

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Should log error but not crash
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(autoSaver.hasUnsavedChanges()).toBe(true); // Changes still pending

      consoleSpy.mockRestore();
    });

    it('should retry auto-save after failures', async () => {
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 1000,
      });

      await autoSaver.start(testSession.id);
      await autoSaver.addMessage({ role: 'user', content: 'Test message' });

      // Mock one failure, then success
      mockFs.writeFile
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue(undefined);

      // First interval - should fail
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Second interval - should succeed
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('Manual Save Integration', () => {
    it('should save on manual save even with timer disabled', async () => {
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: false, // Timer disabled
        intervalMs: 60000,
      });

      await autoSaver.start(testSession.id);
      await autoSaver.addMessage({ role: 'user', content: 'Manual save test' });

      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Manual save
      await autoSaver.save();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${testSession.id}.json`),
        expect.any(String)
      );
    });

    it('should save on stop even with pending changes', async () => {
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: false, // No timer
      });

      await autoSaver.start(testSession.id);
      await autoSaver.addMessage({ role: 'user', content: 'Final message' });

      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Stop should trigger save
      await autoSaver.stop();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle high-frequency updates efficiently', async () => {
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 5000, // 5 seconds
        maxUnsavedMessages: 50, // High threshold
      });

      await autoSaver.start(testSession.id);

      // Rapidly add many updates
      const updatePromises = [];
      for (let i = 0; i < 20; i++) {
        updatePromises.push(
          autoSaver.addMessage({ role: 'user', content: `Rapid message ${i}` })
        );
        updatePromises.push(
          autoSaver.updateState({ totalCost: i * 0.1 })
        );
      }

      await Promise.all(updatePromises);

      expect(autoSaver.getUnsavedChangesCount()).toBeGreaterThan(0);
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Should handle auto-save efficiently
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });

    it('should optimize timer management with multiple option changes', async () => {
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 10000,
      });

      await autoSaver.start(testSession.id);

      // Multiple rapid option updates
      autoSaver.updateOptions({ intervalMs: 5000 });
      autoSaver.updateOptions({ intervalMs: 15000 });
      autoSaver.updateOptions({ intervalMs: 8000 });

      await autoSaver.addMessage({ role: 'user', content: 'Test' });

      // Should use final interval setting
      vi.advanceTimersByTime(8000);
      await vi.runAllTimersAsync();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('Configuration Best Practices', () => {
    it('should support recommended configuration from documentation', async () => {
      // Recommended configuration for development
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 30000, // 30 seconds
        maxUnsavedMessages: 10, // Save after 10 messages
      });

      await autoSaver.start(testSession.id);

      // Test the configuration works as expected
      expect(autoSaver).toBeDefined();

      // Add messages up to threshold
      for (let i = 0; i < 10; i++) {
        await autoSaver.addMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Development message ${i + 1}`
        });
      }

      // Should auto-save after 10 messages
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });

    it('should support production configuration with longer intervals', async () => {
      // Production configuration with less frequent saves
      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 120000, // 2 minutes
        maxUnsavedMessages: 25, // Higher threshold
      });

      await autoSaver.start(testSession.id);
      await autoSaver.addMessage({ role: 'user', content: 'Production test' });

      // Should not save immediately
      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Should save after interval
      vi.advanceTimersByTime(120000);
      await vi.runAllTimersAsync();

      expect(autoSaver.hasUnsavedChanges()).toBe(false);
    });
  });
});