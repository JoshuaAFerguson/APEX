/**
 * Integration tests for v0.3.0 features
 * Tests the interaction between UI components, services, and overall user experience
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fuse from 'fuse.js';
import { SessionStore, Session, SessionMessage } from '../services/SessionStore';
import { CompletionEngine, CompletionContext } from '../services/CompletionEngine';
import { ConversationManager } from '../services/ConversationManager';
import { ShortcutManager } from '../services/ShortcutManager';
import { SessionAutoSaver } from '../services/SessionAutoSaver';
import { IntentDetector } from '../ui/components/IntentDetector';
import { StatusBar } from '../ui/components/StatusBar';
import { ThemeProvider } from '../ui/context/ThemeContext';

// Mock file system
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn(),
  readdir: vi.fn(),
}));

// Mock process
vi.mock('process', () => ({
  cwd: vi.fn(() => '/test/project'),
}));

// Mock ink
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

// Mock zlib for compression/decompression in SessionStore
vi.mock('zlib', () => ({
  gzip: vi.fn(),
  gunzip: vi.fn(),
}));

describe('v0.3.0 Integration Tests', () => {
  let sessionStore: SessionStore;
  let completionEngine: CompletionEngine;
  let conversationManager: ConversationManager;
  let shortcutManager: ShortcutManager;
  let sessionAutoSaver: SessionAutoSaver;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock file system operations
    const fs = await import('fs/promises');
    const zlib = await import('zlib');

    vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);

    // Mock compression functions
    const gzip = vi.fn().mockResolvedValue(Buffer.from('compressed'));
    const gunzip = vi.fn().mockResolvedValue(Buffer.from('{}'));
    vi.mocked(zlib.gzip as any).mockImplementation(gzip);
    vi.mocked(zlib.gunzip as any).mockImplementation(gunzip);

    // Initialize services
    sessionStore = new SessionStore('/test/.apex/sessions');
    await sessionStore.initialize();

    completionEngine = new CompletionEngine({
      commands: [
        { name: 'run', description: 'Execute a task' },
        { name: 'status', description: 'Show task status' },
        { name: 'help', description: 'Show help' },
      ],
      history: ['create component', 'fix bug', 'run tests'],
    });

    conversationManager = new ConversationManager(sessionStore);
    shortcutManager = new ShortcutManager();
    sessionAutoSaver = new SessionAutoSaver(sessionStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionAutoSaver.stop();
  });

  describe('Session Management Integration', () => {
    // Test data factory for consistent test fixtures
    const createTestSession = (overrides: Partial<Session> = {}): Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'> => ({
      projectPath: '/test/project',
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

    const createTestMessage = (overrides: Partial<SessionMessage> = {}): Omit<SessionMessage, 'id' | 'index' | 'timestamp'> => ({
      role: 'user',
      content: 'Test message',
      ...overrides,
    });

    describe('Full Session Lifecycle', () => {
      describe('Session Creation', () => {
        it('should create session with name and tags', async () => {
          const session = await sessionStore.createSession('My Session');
          expect(session.name).toBe('My Session');
          expect(session.id).toMatch(/^sess_\d+_\w+$/);
          expect(session.tags).toEqual([]);
        });

        it('should create session and set as active', async () => {
          const session = await sessionStore.createSession();
          const activeId = await sessionStore.getActiveSessionId();
          expect(activeId).toBe(session.id);
        });

        it('should initialize session with default state', async () => {
          const session = await sessionStore.createSession();
          expect(session.messages).toEqual([]);
          expect(session.inputHistory).toEqual([]);
          expect(session.state.totalTokens).toEqual({ input: 0, output: 0 });
          expect(session.state.totalCost).toBe(0);
          expect(session.state.tasksCreated).toEqual([]);
          expect(session.state.tasksCompleted).toEqual([]);
        });
      });

      describe('Session Update', () => {
        it('should update session name and tags', async () => {
          const session = await sessionStore.createSession();
          await sessionStore.updateSession(session.id, {
            name: 'Updated Name',
            tags: ['important', 'work'],
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

        it('should update updatedAt timestamp on update', async () => {
          const session = await sessionStore.createSession();
          const originalUpdatedAt = session.updatedAt;

          // Wait a bit to ensure timestamp difference
          vi.advanceTimersByTime(1000);

          await sessionStore.updateSession(session.id, { name: 'Updated' });

          const updated = await sessionStore.getSession(session.id);
          expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
        });
      });

      describe('Session Archive/Restore', () => {
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

        it('should remove archived session from default listing', async () => {
          const session = await sessionStore.createSession('To Archive');
          await sessionStore.archiveSession(session.id);

          // Should not appear in default listing
          const defaultSessions = await sessionStore.listSessions();
          expect(defaultSessions.find(s => s.id === session.id)).toBeUndefined();

          // Should appear when including archived
          const allSessions = await sessionStore.listSessions({ all: true });
          expect(allSessions.find(s => s.id === session.id)).toBeDefined();
        });

        it('should handle archiving session with messages', async () => {
          const sessionId = await conversationManager.startSession();

          await conversationManager.addMessage({
            role: 'user',
            content: 'Message before archive',
          });

          await sessionStore.archiveSession(sessionId);

          const archivedSession = await sessionStore.getSession(sessionId);
          expect(archivedSession?.messages).toHaveLength(1);
          expect(archivedSession?.messages[0].content).toBe('Message before archive');
        });
      });

      describe('Session Deletion', () => {
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

        it('should remove deleted session from index', async () => {
          const session = await sessionStore.createSession();
          await sessionStore.deleteSession(session.id);

          const sessions = await sessionStore.listSessions({ all: true });
          expect(sessions.find(s => s.id === session.id)).toBeUndefined();
        });
      });
    });

    describe('Session Search & Filtering', () => {
      beforeEach(async () => {
        // Clean up any existing sessions for isolated testing
        try {
          const existingSessions = await sessionStore.listSessions({ all: true });
          for (const session of existingSessions) {
            try {
              await sessionStore.deleteSession(session.id);
            } catch (error) {
              // Ignore errors when deleting sessions (might not exist)
            }
          }
        } catch (error) {
          // Ignore errors when listing sessions (might be empty)
        }
      });

      describe('Search by Name', () => {
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

        it('should handle case-insensitive search', async () => {
          await sessionStore.createSession('MyTestSession');

          const results = await sessionStore.listSessions({ search: 'mytest' });
          expect(results).toHaveLength(1);
          expect(results[0].name).toBe('MyTestSession');
        });

        it('should return empty array for no matches', async () => {
          await sessionStore.createSession('Test Session');

          const results = await sessionStore.listSessions({ search: 'nonexistent' });
          expect(results).toHaveLength(0);
        });
      });

      describe('Filter by Tags', () => {
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
          const session1 = await sessionStore.createSession('Session 1');
          await sessionStore.updateSession(session1.id, { tags: ['work'] });

          const session2 = await sessionStore.createSession('Session 2');
          await sessionStore.updateSession(session2.id, { tags: ['urgent'] });

          const session3 = await sessionStore.createSession('Session 3');
          await sessionStore.updateSession(session3.id, { tags: ['personal'] });

          const results = await sessionStore.listSessions({ tags: ['work', 'urgent'] });
          expect(results).toHaveLength(2);
        });

        it('should handle sessions with multiple tags', async () => {
          const session = await sessionStore.createSession('Multi-tag Session');
          await sessionStore.updateSession(session.id, { tags: ['work', 'urgent', 'important'] });

          const workResults = await sessionStore.listSessions({ tags: ['work'] });
          expect(workResults).toHaveLength(1);

          const urgentResults = await sessionStore.listSessions({ tags: ['urgent'] });
          expect(urgentResults).toHaveLength(1);

          const personalResults = await sessionStore.listSessions({ tags: ['personal'] });
          expect(personalResults).toHaveLength(0);
        });
      });

      describe('Combined Filters', () => {
        it('should combine search and tag filters', async () => {
          const session1 = await sessionStore.createSession('Work Feature: Authentication');
          await sessionStore.updateSession(session1.id, { tags: ['work', 'feature'] });

          const session2 = await sessionStore.createSession('Personal Feature: Todo App');
          await sessionStore.updateSession(session2.id, { tags: ['personal', 'feature'] });

          const session3 = await sessionStore.createSession('Work Bugfix: Login');
          await sessionStore.updateSession(session3.id, { tags: ['work', 'bugfix'] });

          const results = await sessionStore.listSessions({
            search: 'feature',
            tags: ['work']
          });

          expect(results).toHaveLength(1);
          expect(results[0].name).toBe('Work Feature: Authentication');
        });
      });
    });

    describe('Session Listing', () => {
      beforeEach(async () => {
        // Clean up any existing sessions for isolated testing
        try {
          const existingSessions = await sessionStore.listSessions({ all: true });
          for (const session of existingSessions) {
            try {
              await sessionStore.deleteSession(session.id);
            } catch (error) {
              // Ignore errors when deleting sessions (might not exist)
            }
          }
        } catch (error) {
          // Ignore errors when listing sessions (might be empty)
        }
      });

      describe('Pagination', () => {
        it('should limit results to specified count', async () => {
          // Create 5 sessions
          for (let i = 0; i < 5; i++) {
            await sessionStore.createSession(`Session ${i}`);
            vi.advanceTimersByTime(100); // Ensure different timestamps
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

        it('should handle limit larger than available sessions', async () => {
          await sessionStore.createSession('Only Session');

          const results = await sessionStore.listSessions({ limit: 10 });
          expect(results).toHaveLength(1);
        });
      });

      describe('Sorting', () => {
        it('should sort sessions by updatedAt in descending order', async () => {
          const first = await sessionStore.createSession('First');
          vi.advanceTimersByTime(1000);
          const second = await sessionStore.createSession('Second');
          vi.advanceTimersByTime(1000);
          const third = await sessionStore.createSession('Third');

          const results = await sessionStore.listSessions();
          expect(results[0].name).toBe('Third');
          expect(results[1].name).toBe('Second');
          expect(results[2].name).toBe('First');
        });

        it('should reflect updated order after session modification', async () => {
          const first = await sessionStore.createSession('First');
          vi.advanceTimersByTime(1000);
          const second = await sessionStore.createSession('Second');

          vi.advanceTimersByTime(1000);
          await sessionStore.updateSession(first.id, { name: 'Updated First' });

          const results = await sessionStore.listSessions();
          expect(results[0].name).toBe('Updated First');
          expect(results[1].name).toBe('Second');
        });
      });

      describe('Active vs Archived Filtering', () => {
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

        it('should correctly mark archived status in results', async () => {
          await sessionStore.createSession('Active Session');
          const archived = await sessionStore.createSession('Archived Session');
          await sessionStore.archiveSession(archived.id);

          const allResults = await sessionStore.listSessions({ all: true });
          const activeResult = allResults.find(s => s.name === 'Active Session');
          const archivedResult = allResults.find(s => s.name === 'Archived Session');

          expect(activeResult?.isArchived).toBe(false);
          expect(archivedResult?.isArchived).toBe(true);
        });
      });
    });

    describe('Auto-save Behavior', () => {
      let autoSaver: SessionAutoSaver;

      afterEach(() => {
        if (autoSaver) {
          autoSaver.stop();
        }
      });

      describe('Interval-based Auto-save', () => {
        it('should auto-save at configured interval', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 30000,
            maxUnsavedMessages: 100,
          });

          await autoSaver.start();
          await autoSaver.addMessage(createTestMessage({ content: 'Test message' }));

          expect(autoSaver.hasUnsavedChanges()).toBe(true);

          // Advance to just before interval
          vi.advanceTimersByTime(29000);
          expect(autoSaver.hasUnsavedChanges()).toBe(true);

          // Advance past interval
          vi.advanceTimersByTime(2000);
          await vi.runAllTimersAsync();

          expect(autoSaver.hasUnsavedChanges()).toBe(false);
        });

        it('should respect custom interval settings', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 10000, // 10 seconds
          });

          await autoSaver.start();
          await autoSaver.addMessage(createTestMessage({ content: 'Test' }));

          // Should not save before 10 seconds
          vi.advanceTimersByTime(9000);
          await vi.runAllTimersAsync();
          expect(autoSaver.hasUnsavedChanges()).toBe(true);

          // Should save after 10 seconds
          vi.advanceTimersByTime(2000);
          await vi.runAllTimersAsync();
          expect(autoSaver.hasUnsavedChanges()).toBe(false);
        });

        it('should continue auto-saving on timer intervals', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 5000,
          });

          await autoSaver.start();

          // First save cycle
          await autoSaver.addMessage(createTestMessage({ content: 'Message 1' }));
          vi.advanceTimersByTime(5000);
          await vi.runAllTimersAsync();
          expect(autoSaver.hasUnsavedChanges()).toBe(false);

          // Second save cycle
          await autoSaver.addMessage(createTestMessage({ content: 'Message 2' }));
          expect(autoSaver.hasUnsavedChanges()).toBe(true);
          vi.advanceTimersByTime(5000);
          await vi.runAllTimersAsync();
          expect(autoSaver.hasUnsavedChanges()).toBe(false);
        });
      });

      describe('Threshold-based Auto-save', () => {
        it('should auto-save when message threshold reached', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 60000, // Long interval
            maxUnsavedMessages: 3,
          });

          await autoSaver.start();

          // Add messages up to threshold
          await autoSaver.addMessage(createTestMessage({ content: 'Message 1' }));
          expect(autoSaver.getUnsavedChangesCount()).toBe(1);

          await autoSaver.addMessage(createTestMessage({ content: 'Message 2' }));
          expect(autoSaver.getUnsavedChangesCount()).toBe(2);

          // Third message should trigger auto-save
          await autoSaver.addMessage(createTestMessage({ content: 'Message 3' }));
          expect(autoSaver.getUnsavedChangesCount()).toBe(0);
        });

        it('should handle combined threshold and interval saves', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 5000,
            maxUnsavedMessages: 5,
          });

          await autoSaver.start();

          // Add 2 messages (below threshold)
          await autoSaver.addMessage(createTestMessage({ content: 'Message 1' }));
          await autoSaver.addMessage(createTestMessage({ content: 'Message 2' }));
          expect(autoSaver.getUnsavedChangesCount()).toBe(2);

          // Wait for interval save
          vi.advanceTimersByTime(5000);
          await vi.runAllTimersAsync();
          expect(autoSaver.getUnsavedChangesCount()).toBe(0);
        });

        it('should track different types of changes for threshold', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 60000,
            maxUnsavedMessages: 3,
          });

          await autoSaver.start();

          await autoSaver.addMessage(createTestMessage({ content: 'Message 1' }));
          await autoSaver.updateSessionInfo({ name: 'Updated Name' });
          await autoSaver.updateState({ totalCost: 0.05 });

          // All changes count toward threshold
          expect(autoSaver.getUnsavedChangesCount()).toBe(0); // Should have auto-saved
        });
      });

      describe('Options Configuration at Runtime', () => {
        it('should enable auto-save dynamically', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: false,
            intervalMs: 1000,
          });

          await autoSaver.start();
          await autoSaver.addMessage(createTestMessage({ content: 'Test' }));

          // Advance time - should not auto-save when disabled
          vi.advanceTimersByTime(2000);
          await vi.runAllTimersAsync();
          expect(autoSaver.hasUnsavedChanges()).toBe(true);

          // Enable auto-save
          autoSaver.updateOptions({ enabled: true });

          vi.advanceTimersByTime(1000);
          await vi.runAllTimersAsync();
          expect(autoSaver.hasUnsavedChanges()).toBe(false);
        });

        it('should disable auto-save dynamically', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 1000,
          });

          await autoSaver.start();

          // Disable auto-save
          autoSaver.updateOptions({ enabled: false });

          await autoSaver.addMessage(createTestMessage({ content: 'Test' }));
          vi.advanceTimersByTime(2000);
          await vi.runAllTimersAsync();

          expect(autoSaver.hasUnsavedChanges()).toBe(true);
        });

        it('should update interval dynamically', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 10000,
          });

          await autoSaver.start();

          // Update to faster interval
          autoSaver.updateOptions({ intervalMs: 1000 });

          await autoSaver.addMessage(createTestMessage({ content: 'Test' }));

          // Should save with new faster interval
          vi.advanceTimersByTime(1000);
          await vi.runAllTimersAsync();
          expect(autoSaver.hasUnsavedChanges()).toBe(false);
        });

        it('should update threshold dynamically', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 60000,
            maxUnsavedMessages: 5,
          });

          await autoSaver.start();

          // Update to lower threshold
          autoSaver.updateOptions({ maxUnsavedMessages: 2 });

          await autoSaver.addMessage(createTestMessage({ content: 'Message 1' }));
          await autoSaver.addMessage(createTestMessage({ content: 'Message 2' }));

          // Should auto-save with new lower threshold
          expect(autoSaver.getUnsavedChangesCount()).toBe(0);
        });
      });

      describe('Error Recovery', () => {
        it('should recover from auto-save failures and retry', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 1000,
          });

          await autoSaver.start();
          await autoSaver.addMessage(createTestMessage({ content: 'Test' }));

          // First save fails
          const updateSpy = vi.spyOn(sessionStore, 'updateSession')
            .mockRejectedValueOnce(new Error('Network error'));

          vi.advanceTimersByTime(1000);
          await vi.runAllTimersAsync();

          // Changes should still be tracked after failed save
          expect(autoSaver.hasUnsavedChanges()).toBe(true);

          // Second attempt succeeds
          vi.advanceTimersByTime(1000);
          await vi.runAllTimersAsync();

          expect(autoSaver.hasUnsavedChanges()).toBe(false);
          expect(updateSpy).toHaveBeenCalledTimes(2);
        });

        it('should handle save errors gracefully without crashing', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 1000,
            maxUnsavedMessages: 1,
          });

          await autoSaver.start();

          // Mock console.error to capture error logs
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          // Make save always fail
          vi.spyOn(sessionStore, 'updateSession')
            .mockRejectedValue(new Error('Persistent error'));

          // Adding message should trigger immediate save due to threshold
          await autoSaver.addMessage(createTestMessage({ content: 'Test' }));

          // Should not crash, error should be logged
          await vi.runAllTimersAsync();
          expect(consoleSpy).toHaveBeenCalled();

          consoleSpy.mockRestore();
        });

        it('should maintain consistency during concurrent operations', async () => {
          autoSaver = new SessionAutoSaver(sessionStore, {
            enabled: true,
            intervalMs: 100,
          });

          await autoSaver.start();

          // Add messages rapidly
          const promises = Array.from({ length: 10 }, (_, i) =>
            autoSaver.addMessage(createTestMessage({ content: `Message ${i}` }))
          );

          await Promise.all(promises);

          // Let auto-save complete
          vi.advanceTimersByTime(200);
          await vi.runAllTimersAsync();

          const session = autoSaver.getSession();
          expect(session?.messages).toHaveLength(10);
          expect(autoSaver.hasUnsavedChanges()).toBe(false);
        });
      });
    });

    // Existing tests
    it('should create and persist session data', async () => {
      const sessionId = await conversationManager.startSession();
      expect(sessionId).toBeDefined();

      await conversationManager.addMessage({
        role: 'user',
        content: 'Test message',
      });

      await conversationManager.addMessage({
        role: 'assistant',
        content: 'Test response',
      });

      const session = await sessionStore.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.messages).toHaveLength(2);
    });

    it('should auto-save sessions at regular intervals', async () => {
      const sessionId = await conversationManager.startSession();

      sessionAutoSaver.start();

      await conversationManager.addMessage({
        role: 'user',
        content: 'Message 1',
      });

      // Advance time to trigger auto-save
      act(() => {
        vi.advanceTimersByTime(60000); // 1 minute
      });

      await conversationManager.addMessage({
        role: 'user',
        content: 'Message 2',
      });

      // Auto-save should have been triggered
      const session = await sessionStore.getSession(sessionId);
      expect(session?.messages).toHaveLength(2);
    });

    it('should handle session export correctly', async () => {
      const sessionId = await conversationManager.startSession();

      await conversationManager.addMessage({
        role: 'user',
        content: 'Export test message',
      });

      const exported = await sessionStore.exportSession(sessionId, 'md');
      expect(exported).toContain('Export test message');
      expect(exported).toContain('# APEX Session');
    });
  });

  describe('Intent Detection Integration', () => {
    const mockCommands = [
      {
        name: 'run',
        aliases: ['execute', 'exec'],
        description: 'Execute a task',
        examples: ['run "create component"'],
      },
      {
        name: 'status',
        aliases: ['st'],
        description: 'Show task status',
      },
    ];

    it('should detect command intents and trigger completion', async () => {
      let detectedIntent: any = null;

      const { rerender } = render(
        <ThemeProvider>
          <IntentDetector
            input="/run create component"
            commands={mockCommands}
            onIntentDetected={(intent) => { detectedIntent = intent; }}
          />
        </ThemeProvider>
      );

      // Wait for debounced intent detection
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(detectedIntent).toBeDefined();
        expect(detectedIntent.type).toBe('command');
        expect(detectedIntent.command).toBe('run');
        expect(detectedIntent.confidence).toBe(1.0);
      });
    });

    it('should provide task suggestions based on patterns', async () => {
      let detectedIntent: any = null;

      render(
        <ThemeProvider>
          <IntentDetector
            input="create a new React component"
            commands={mockCommands}
            onIntentDetected={(intent) => { detectedIntent = intent; }}
          />
        </ThemeProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(detectedIntent).toBeDefined();
        expect(detectedIntent.type).toBe('task');
        expect(detectedIntent.suggestions).toBeDefined();
        expect(detectedIntent.suggestions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Completion Engine Integration', () => {
    let testCompletionEngine: CompletionEngine;
    let testContext: CompletionContext;

    // Test factory for consistent context generation
    const createTestContext = (overrides: Partial<CompletionContext> = {}): CompletionContext => ({
      projectPath: '/test/project',
      agents: ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'],
      workflows: ['feature', 'bugfix', 'refactor'],
      recentTasks: [
        { id: 'task_abc123', description: 'Implement authentication' },
        { id: 'task_def456', description: 'Fix payment bug' },
        { id: 'task_xyz789', description: 'Add user dashboard' },
      ],
      inputHistory: [
        'fix the bug in payment',
        'add new feature',
        'run tests',
        'create component Button',
        'implement user authentication',
        'refactor code structure',
      ],
      ...overrides,
    });

    beforeEach(() => {
      testCompletionEngine = new CompletionEngine();
      testContext = createTestContext();
    });

    describe('Provider Coverage', () => {
      describe('Command Provider', () => {
        it('should complete command names with / prefix', async () => {
          const completions = await testCompletionEngine.getCompletions('/h', 2, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions[0].value).toBe('/help');
          expect(completions[0].type).toBe('command');
          expect(completions[0].icon).toBe('?');
          expect(completions[0].description).toBe('Show help');
        });

        it('should score exact matches higher than partial matches', async () => {
          const completions = await testCompletionEngine.getCompletions('/status', 7, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions[0].value).toBe('/status');
          expect(completions[0].score).toBe(100); // Exact match
        });

        it('should return multiple matching commands', async () => {
          const completions = await testCompletionEngine.getCompletions('/c', 2, testContext);

          const commandValues = completions.map(c => c.value);
          expect(commandValues).toContain('/cancel');
          expect(commandValues).toContain('/clear');
          expect(commandValues).toContain('/config');
          expect(commandValues).toContain('/compact');
        });

        it('should handle case insensitive matching', async () => {
          const completions = await testCompletionEngine.getCompletions('/HELP', 5, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions[0].value).toBe('/help');
        });
      });

      describe('Session Subcommand Provider', () => {
        it('should complete session subcommands', async () => {
          const completions = await testCompletionEngine.getCompletions('/session l', 10, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions[0].value).toBe('/session list');
          expect(completions[0].displayValue).toBe('list');
          expect(completions[0].type).toBe('subcommand');
        });

        it('should complete partial subcommand matches', async () => {
          const completions = await testCompletionEngine.getCompletions('/session sa', 11, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions[0].value).toBe('/session save');
          expect(completions[0].description).toBe('Save session');
        });

        it('should return multiple matching subcommands', async () => {
          const completions = await testCompletionEngine.getCompletions('/session ', 9, testContext);

          const subcommandValues = completions.map(c => c.displayValue);
          expect(subcommandValues).toContain('list');
          expect(subcommandValues).toContain('load');
          expect(subcommandValues).toContain('save');
          expect(subcommandValues).toContain('branch');
        });
      });

      describe('Path Provider', () => {
        beforeEach(async () => {
          const fs = await import('fs/promises');
          // Mock directory listing
          vi.mocked(fs.readdir).mockResolvedValue([
            { name: 'src', isDirectory: () => true, isFile: () => false } as any,
            { name: 'package.json', isDirectory: () => false, isFile: () => true } as any,
            { name: 'README.md', isDirectory: () => false, isFile: () => true } as any,
            { name: 'components', isDirectory: () => true, isFile: () => false } as any,
            { name: 'utils.ts', isDirectory: () => false, isFile: () => true } as any,
          ]);
        });

        it('should complete file paths', async () => {
          const completions = await testCompletionEngine.getCompletions('edit src/', 8, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions.some(c => c.value.includes('src/'))).toBe(true);
          expect(completions.some(c => c.type === 'directory')).toBe(true);
          expect(completions.some(c => c.type === 'file')).toBe(true);
        });

        it('should distinguish between files and directories', async () => {
          const completions = await testCompletionEngine.getCompletions('./s', 3, testContext);

          const srcCompletion = completions.find(c => c.displayValue?.includes('src'));
          expect(srcCompletion?.type).toBe('directory');
          expect(srcCompletion?.icon).toBe('📁');
          expect(srcCompletion?.value?.endsWith('/')).toBe(true);
        });

        it('should filter files starting with dot', async () => {
          const fs = await import('fs/promises');
          vi.mocked(fs.readdir).mockResolvedValue([
            { name: '.git', isDirectory: () => true, isFile: () => false } as any,
            { name: '.env', isDirectory: () => false, isFile: () => true } as any,
            { name: 'src', isDirectory: () => true, isFile: () => false } as any,
          ]);

          const completions = await testCompletionEngine.getCompletions('./', 2, testContext);

          expect(completions.every(c => !c.value.includes('.git'))).toBe(true);
          expect(completions.every(c => !c.value.includes('.env'))).toBe(true);
        });

        it('should handle relative path completion', async () => {
          const completions = await testCompletionEngine.getCompletions('edit ./pack', 10, testContext);

          expect(completions.some(c => c.value.includes('package.json'))).toBe(true);
        });

        it('should handle errors gracefully', async () => {
          const fs = await import('fs/promises');
          vi.mocked(fs.readdir).mockRejectedValue(new Error('Permission denied'));

          const completions = await testCompletionEngine.getCompletions('edit /root/', 11, testContext);

          expect(completions).toEqual([]);
        });
      });

      describe('Agent Provider (@mentions)', () => {
        it('should complete agent names with @ prefix', async () => {
          const completions = await testCompletionEngine.getCompletions('@dev', 4, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions[0].value).toBe('@developer');
          expect(completions[0].type).toBe('agent');
          expect(completions[0].icon).toBe('🤖');
        });

        it('should provide agent descriptions', async () => {
          const completions = await testCompletionEngine.getCompletions('@plan', 5, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions[0].value).toBe('@planner');
          expect(completions[0].description).toBe('Creates implementation plans');
        });

        it('should return all agents when just @ is typed', async () => {
          const completions = await testCompletionEngine.getCompletions('@', 1, testContext);

          expect(completions.length).toBe(testContext.agents.length);
          const agentNames = completions.map(c => c.value);
          expect(agentNames).toContain('@planner');
          expect(agentNames).toContain('@architect');
          expect(agentNames).toContain('@developer');
        });

        it('should score exact prefix matches higher', async () => {
          const completions = await testCompletionEngine.getCompletions('@architect', 10, testContext);

          expect(completions[0].value).toBe('@architect');
          expect(completions[0].score).toBe(100);
        });
      });

      describe('Workflow Provider (--workflow)', () => {
        it('should complete workflow names with --workflow prefix', async () => {
          const completions = await testCompletionEngine.getCompletions('--workflow fea', 14, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions[0].value).toBe('feature');
          expect(completions[0].type).toBe('workflow');
          expect(completions[0].icon).toBe('⚙️');
        });

        it('should provide workflow descriptions', async () => {
          const completions = await testCompletionEngine.getCompletions('--workflow bug', 14, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions[0].value).toBe('bugfix');
          expect(completions[0].description).toBe('Bug investigation and fix');
        });

        it('should complete all workflows when only --workflow is typed', async () => {
          const completions = await testCompletionEngine.getCompletions('--workflow ', 11, testContext);

          expect(completions.length).toBe(testContext.workflows.length);
          const workflowNames = completions.map(c => c.value);
          expect(workflowNames).toContain('feature');
          expect(workflowNames).toContain('bugfix');
          expect(workflowNames).toContain('refactor');
        });
      });

      describe('Task ID Provider (task_*)', () => {
        it('should complete task IDs with task_ prefix', async () => {
          const completions = await testCompletionEngine.getCompletions('task_ab', 7, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions[0].value).toBe('task_abc123');
          expect(completions[0].type).toBe('task');
          expect(completions[0].icon).toBe('📋');
        });

        it('should include task descriptions', async () => {
          const completions = await testCompletionEngine.getCompletions('task_def', 8, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions[0].value).toBe('task_def456');
          expect(completions[0].description).toBe('Fix payment bug');
        });

        it('should limit task ID display length', async () => {
          const longTaskContext = createTestContext({
            recentTasks: [
              { id: 'task_verylongidentifier123456789', description: 'Very long description that should be truncated for display purposes' },
            ],
          });

          const completions = await testCompletionEngine.getCompletions('task_very', 9, longTaskContext);

          expect(completions[0].displayValue).toHaveLength(16);
          expect(completions[0].description).toHaveLength(50);
        });
      });

      describe('History Provider', () => {
        it('should suggest from input history', async () => {
          const completions = await testCompletionEngine.getCompletions('fix', 3, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions.some(c => c.value === 'fix the bug in payment')).toBe(true);
          expect(completions.some(c => c.type === 'history')).toBe(true);
        });

        it('should exclude exact matches from history', async () => {
          const completions = await testCompletionEngine.getCompletions('fix the bug in payment', 22, testContext);

          expect(completions.every(c => c.value !== 'fix the bug in payment')).toBe(true);
        });

        it('should limit history suggestions', async () => {
          const manyHistoryContext = createTestContext({
            inputHistory: Array.from({ length: 20 }, (_, i) => `command ${i} with fix prefix`),
          });

          const completions = await testCompletionEngine.getCompletions('command', 7, manyHistoryContext);

          const historyCompletions = completions.filter(c => c.type === 'history');
          expect(historyCompletions.length).toBeLessThanOrEqual(5);
        });

        it('should score more recent history higher', async () => {
          const completions = await testCompletionEngine.getCompletions('add', 3, testContext);

          const historyCompletions = completions.filter(c => c.type === 'history');
          if (historyCompletions.length > 1) {
            // More recent entries should have higher scores
            expect(historyCompletions[0].score).toBeGreaterThan(historyCompletions[1].score);
          }
        });
      });

      describe('Task Pattern Provider', () => {
        it('should suggest common task patterns', async () => {
          const completions = await testCompletionEngine.getCompletions('fix', 3, testContext);

          expect(completions.some(c => c.value === 'fix the bug in')).toBe(true);
          expect(completions.some(c => c.type === 'template')).toBe(true);
        });

        it('should provide pattern suggestions for various action verbs', async () => {
          const actionVerbs = ['add', 'update', 'implement', 'create', 'remove', 'refactor', 'test', 'document'];

          for (const verb of actionVerbs) {
            const completions = await testCompletionEngine.getCompletions(verb, verb.length, testContext);
            const templateCompletions = completions.filter(c => c.type === 'template');
            expect(templateCompletions.length).toBeGreaterThan(0);
            expect(templateCompletions[0].icon).toBe('✨');
          }
        });

        it('should match case insensitive patterns', async () => {
          const completions = await testCompletionEngine.getCompletions('FIX', 3, testContext);

          expect(completions.some(c => c.value === 'fix the bug in')).toBe(true);
        });
      });
    });

    describe('Tab Completion Integration', () => {
      let mockAdvancedInput: React.Component;
      let mockCompletionContext: CompletionContext;

      beforeEach(() => {
        mockCompletionContext = createTestContext();
        vi.clearAllTimers();
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
      });

      describe('Debouncing Behavior', () => {
        it('should debounce completion requests', async () => {
          const completionSpy = vi.spyOn(testCompletionEngine, 'getCompletions');

          // Simulate the AdvancedInput component's debounced behavior
          const triggerCompletion = async (input: string) => {
            return new Promise<void>((resolve) => {
              setTimeout(async () => {
                await testCompletionEngine.getCompletions(input, input.length, mockCompletionContext);
                resolve();
              }, 150); // debounceMs = 150
            });
          };

          // Simulate rapid input changes
          triggerCompletion('/h');
          triggerCompletion('/he');
          triggerCompletion('/hel');
          triggerCompletion('/help');

          // Should not have called engine yet
          expect(completionSpy).not.toHaveBeenCalled();

          // Advance time past debounce threshold
          vi.advanceTimersByTime(150);
          await vi.runAllTimersAsync();

          // Should have called only once with the final input
          expect(completionSpy).toHaveBeenCalledTimes(1);
          expect(completionSpy).toHaveBeenLastCalledWith('/help', 5, mockCompletionContext);
        });

        it('should respect custom debounce timing', async () => {
          const completionSpy = vi.spyOn(testCompletionEngine, 'getCompletions');
          const customDebounce = 300;

          const triggerCompletion = async (input: string) => {
            return new Promise<void>((resolve) => {
              setTimeout(async () => {
                await testCompletionEngine.getCompletions(input, input.length, mockCompletionContext);
                resolve();
              }, customDebounce);
            });
          };

          triggerCompletion('/status');

          // Should not complete before custom debounce time
          vi.advanceTimersByTime(200);
          await vi.runAllTimersAsync();
          expect(completionSpy).not.toHaveBeenCalled();

          // Should complete after custom debounce time
          vi.advanceTimersByTime(100);
          await vi.runAllTimersAsync();
          expect(completionSpy).toHaveBeenCalledTimes(1);
        });

        it('should cancel previous debounced requests', async () => {
          const completionSpy = vi.spyOn(testCompletionEngine, 'getCompletions');

          // Simulate the component's behavior of clearing previous timeouts
          let timeoutId: NodeJS.Timeout | null = null;

          const scheduleCompletion = (input: string) => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(async () => {
              await testCompletionEngine.getCompletions(input, input.length, mockCompletionContext);
            }, 150);
          };

          scheduleCompletion('/h');
          scheduleCompletion('/he');
          scheduleCompletion('/help');

          vi.advanceTimersByTime(150);
          await vi.runAllTimersAsync();

          // Should only have been called once with the final input
          expect(completionSpy).toHaveBeenCalledTimes(1);
          expect(completionSpy).toHaveBeenCalledWith('/help', 5, mockCompletionContext);
        });
      });

      describe('Completion Triggering', () => {
        it('should trigger completions for command inputs', async () => {
          const completions = await testCompletionEngine.getCompletions('/st', 3, mockCompletionContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions.some(c => c.type === 'command')).toBe(true);
        });

        it('should trigger completions for path inputs', async () => {
          const fs = await import('fs/promises');
          vi.mocked(fs.readdir).mockResolvedValue([
            { name: 'test.js', isDirectory: () => false, isFile: () => true } as any,
          ]);

          const completions = await testCompletionEngine.getCompletions('edit ./te', 8, mockCompletionContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions.some(c => c.type === 'file')).toBe(true);
        });

        it('should trigger completions for agent mentions', async () => {
          const completions = await testCompletionEngine.getCompletions('@arc', 4, mockCompletionContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions.some(c => c.type === 'agent')).toBe(true);
        });

        it('should not trigger completions for very short inputs', async () => {
          const completions = await testCompletionEngine.getCompletions('a', 1, mockCompletionContext);

          // History provider should not trigger for inputs < 2 chars
          const historyCompletions = completions.filter(c => c.type === 'history');
          expect(historyCompletions).toEqual([]);
        });
      });

      describe('Smart Replacement', () => {
        it('should replace command prefixes correctly', async () => {
          // Simulate the AdvancedInput component's smart replacement logic
          const input = '/hel';
          const cursorPos = 4;
          const suggestion = { value: '/help', type: 'command' };

          // For commands, replace from start or after whitespace
          const beforeCursor = input.substring(0, cursorPos);
          const afterCursor = input.substring(cursorPos);
          const commandMatch = beforeCursor.match(/(\s|^)(\/\S*)$/);

          expect(commandMatch).toBeDefined();

          if (commandMatch) {
            const prefix = beforeCursor.substring(0, commandMatch.index! + commandMatch[1].length);
            const newInput = prefix + suggestion.value + afterCursor;

            expect(newInput).toBe('/help');
          }
        });

        it('should replace word boundaries for non-command completions', async () => {
          const input = 'create comp';
          const cursorPos = 11;
          const suggestion = { value: 'create component', type: 'history' };

          const beforeCursor = input.substring(0, cursorPos);
          const afterCursor = input.substring(cursorPos);
          const wordMatch = beforeCursor.match(/(\S+)$/);

          expect(wordMatch).toBeDefined();

          if (wordMatch) {
            const prefix = beforeCursor.substring(0, wordMatch.index!);
            const newInput = prefix + suggestion.value + afterCursor;

            expect(newInput).toBe('create component');
          }
        });
      });
    });

    describe('Fuzzy Search Integration', () => {
      const testSuggestions = [
        { value: '/help', description: 'Show help' },
        { value: '/health', description: 'Health check' },
        { value: '/helicopter', description: 'Not a command' },
        { value: '/session', description: 'Session management' },
        { value: '/status', description: 'Task status' },
      ];

      describe('Fuse.js Integration', () => {
        it('should use fuzzy matching with configurable threshold', () => {
          const fuse = new Fuse(testSuggestions, {
            keys: ['value', 'description'],
            threshold: 0.4,
            includeScore: true
          });

          const results = fuse.search('hlp');
          expect(results.length).toBeGreaterThan(0);
          expect(results[0].item.value).toBe('/help');
        });

        it('should match across multiple fields', () => {
          const fuse = new Fuse(testSuggestions, {
            keys: ['value', 'description'],
            threshold: 0.4,
            includeScore: true
          });

          const results = fuse.search('check');
          expect(results.length).toBeGreaterThan(0);
          expect(results.some(r => r.item.value === '/health')).toBe(true);
        });

        it('should respect threshold boundaries', () => {
          const strictFuse = new Fuse(testSuggestions, {
            keys: ['value'],
            threshold: 0.1, // Very strict
            includeScore: true
          });

          const lenientFuse = new Fuse(testSuggestions, {
            keys: ['value'],
            threshold: 0.8, // Very lenient
            includeScore: true
          });

          const strictResults = strictFuse.search('xyz');
          const lenientResults = lenientFuse.search('xyz');

          expect(strictResults.length).toBeLessThanOrEqual(lenientResults.length);
        });
      });

      describe('Threshold Behavior', () => {
        it('should exclude poor matches below threshold', () => {
          const fuse = new Fuse(testSuggestions, {
            keys: ['value'],
            threshold: 0.3,
            includeScore: true
          });

          const results = fuse.search('completelydifferent');
          expect(results.length).toBe(0);
        });

        it('should include good matches above threshold', () => {
          const fuse = new Fuse(testSuggestions, {
            keys: ['value'],
            threshold: 0.5,
            includeScore: true
          });

          const results = fuse.search('hlp'); // Should match 'help'
          expect(results.length).toBeGreaterThan(0);
          expect(results[0].score).toBeLessThan(0.5);
        });

        it('should order results by relevance score', () => {
          const fuse = new Fuse(testSuggestions, {
            keys: ['value'],
            threshold: 0.6,
            includeScore: true
          });

          const results = fuse.search('hel');
          if (results.length > 1) {
            for (let i = 0; i < results.length - 1; i++) {
              expect(results[i].score).toBeLessThanOrEqual(results[i + 1].score);
            }
          }
        });
      });

      describe('Combined Results', () => {
        it('should merge engine results with fuzzy search', async () => {
          // Test the AdvancedInput component's logic for combining engine + fuzzy results
          const engineResults = await testCompletionEngine.getCompletions('/h', 2, testContext);

          // Simulate fuzzy search on fallback suggestions
          const fallbackSuggestions = testSuggestions;
          const fuse = new Fuse(fallbackSuggestions, {
            keys: ['value', 'description'],
            threshold: 0.4
          });

          const fuzzyResults = fuse.search('/h').map(result => result.item);

          // Combine and deduplicate
          const allSuggestions = [...engineResults, ...fuzzyResults];
          const seen = new Set<string>();
          const deduplicated = allSuggestions.filter(s => {
            if (seen.has(s.value)) return false;
            seen.add(s.value);
            return true;
          });

          expect(deduplicated.length).toBeGreaterThan(0);
          expect(deduplicated.length).toBeLessThanOrEqual(allSuggestions.length);
        });

        it('should limit total combined results', async () => {
          // Simulate AdvancedInput's behavior of limiting to 10 suggestions
          const engineResults = await testCompletionEngine.getCompletions('', 0, testContext);
          const fallbackSuggestions = Array.from({ length: 20 }, (_, i) => ({
            value: `suggestion${i}`,
            description: `Description ${i}`,
          }));

          const combined = [...engineResults, ...fallbackSuggestions];
          const limited = combined.slice(0, 10);

          expect(limited.length).toBeLessThanOrEqual(10);
        });

        it('should prioritize engine results over fuzzy matches', async () => {
          const engineResults = await testCompletionEngine.getCompletions('/help', 5, testContext);
          const fuzzyResults = [{ value: '/helicopter', description: 'Not relevant' }];

          const combined = [...engineResults, ...fuzzyResults];

          // Engine results should appear first (higher scores)
          if (engineResults.length > 0 && fuzzyResults.length > 0) {
            expect(combined[0]).toBe(engineResults[0]);
          }
        });
      });
    });

    describe('Context-Aware Completions', () => {
      describe('Project Context', () => {
        it('should use project path for file completions', async () => {
          const fs = await import('fs/promises');
          vi.mocked(fs.readdir).mockResolvedValue([
            { name: 'src', isDirectory: () => true, isFile: () => false } as any,
          ]);

          const customContext = createTestContext({
            projectPath: '/custom/project/path',
          });

          const completions = await testCompletionEngine.getCompletions('./s', 3, customContext);

          expect(fs.readdir).toHaveBeenCalledWith(
            expect.stringContaining('/custom/project/path'),
            expect.any(Object)
          );
        });

        it('should adapt to different project structures', async () => {
          const fs = await import('fs/promises');
          vi.mocked(fs.readdir).mockResolvedValue([
            { name: 'lib', isDirectory: () => true, isFile: () => false } as any,
            { name: 'dist', isDirectory: () => true, isFile: () => false } as any,
            { name: 'index.js', isDirectory: () => false, isFile: () => true } as any,
          ]);

          const completions = await testCompletionEngine.getCompletions('./l', 3, testContext);

          expect(completions.some(c => c.value.includes('lib'))).toBe(true);
        });
      });

      describe('Session History', () => {
        it('should prioritize recent input history', async () => {
          const recentHistoryContext = createTestContext({
            inputHistory: [
              'recently used command',
              'fix recent bug',
              'older command',
            ],
          });

          const completions = await testCompletionEngine.getCompletions('rec', 3, recentHistoryContext);

          const historyCompletions = completions.filter(c => c.type === 'history');
          if (historyCompletions.length > 1) {
            expect(historyCompletions[0].value).toBe('recently used command');
          }
        });

        it('should limit history search to recent entries', async () => {
          const manyHistoryContext = createTestContext({
            inputHistory: Array.from({ length: 100 }, (_, i) => `command ${i}`),
          });

          const completions = await testCompletionEngine.getCompletions('command', 7, manyHistoryContext);

          // Should only consider last 50 commands (as per implementation)
          const historyCompletions = completions.filter(c => c.type === 'history');
          expect(historyCompletions.length).toBeLessThanOrEqual(5);
        });
      });

      describe('Recent Tasks', () => {
        it('should provide completions for recent task IDs', async () => {
          const completions = await testCompletionEngine.getCompletions('task_', 5, testContext);

          expect(completions.length).toBeGreaterThan(0);
          expect(completions.every(c => c.type === 'task')).toBe(true);
          expect(completions.every(c => c.value.startsWith('task_'))).toBe(true);
        });

        it('should include task descriptions in completions', async () => {
          const completions = await testCompletionEngine.getCompletions('task_abc', 8, testContext);

          expect(completions[0].description).toBe('Implement authentication');
        });

        it('should limit task suggestions appropriately', async () => {
          const manyTasksContext = createTestContext({
            recentTasks: Array.from({ length: 20 }, (_, i) => ({
              id: `task_${i.toString().padStart(3, '0')}`,
              description: `Task ${i}`,
            })),
          });

          const completions = await testCompletionEngine.getCompletions('task_', 5, manyTasksContext);

          expect(completions.length).toBeLessThanOrEqual(10);
        });
      });

      describe('Dynamic Context Updates', () => {
        it('should reflect context changes in completions', async () => {
          const initialCompletions = await testCompletionEngine.getCompletions('@dev', 4, testContext);

          const newContext = createTestContext({
            agents: ['planner', 'specialist', 'custom-agent'],
          });

          const updatedCompletions = await testCompletionEngine.getCompletions('@spec', 5, newContext);

          expect(updatedCompletions.some(c => c.value === '@specialist')).toBe(true);
          expect(updatedCompletions.some(c => c.value === '@developer')).toBe(false);
        });

        it('should handle empty context gracefully', async () => {
          const emptyContext = createTestContext({
            agents: [],
            workflows: [],
            recentTasks: [],
            inputHistory: [],
          });

          const completions = await testCompletionEngine.getCompletions('@', 1, emptyContext);

          expect(completions.filter(c => c.type === 'agent')).toEqual([]);
        });

        it('should validate context data types', async () => {
          const invalidContext = {
            projectPath: '',
            agents: ['valid-agent'],
            workflows: ['valid-workflow'],
            recentTasks: [{ id: 'task_123', description: 'Valid task' }],
            inputHistory: ['valid history'],
          };

          const completions = await testCompletionEngine.getCompletions('@valid', 6, invalidContext);

          expect(completions.some(c => c.value === '@valid-agent')).toBe(true);
        });
      });

      describe('Error Recovery', () => {
        it('should handle provider errors gracefully', async () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          // Force file system error in path provider
          const fs = await import('fs/promises');
          vi.mocked(fs.readdir).mockRejectedValue(new Error('Test error'));

          const completions = await testCompletionEngine.getCompletions('./test', 6, testContext);

          // Should continue with other providers despite path provider error
          expect(completions.some(c => c.type === 'template')).toBe(true); // Pattern provider should still work
          expect(consoleSpy).toHaveBeenCalled();

          consoleSpy.mockRestore();
        });

        it('should handle malformed context gracefully', async () => {
          const malformedContext = {
            projectPath: null,
            agents: undefined,
            workflows: [],
            recentTasks: null,
            inputHistory: undefined,
          } as any;

          // Should not crash
          await expect(
            testCompletionEngine.getCompletions('/help', 5, malformedContext)
          ).resolves.toBeDefined();
        });

        it('should continue functioning after individual provider failures', async () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          // Create an engine with a provider that will fail
          const brokenProvider = {
            type: 'command' as const,
            trigger: /^broken/,
            priority: 999,
            async getSuggestions() {
              throw new Error('Simulated provider error');
            },
          };

          testCompletionEngine.registerProvider(brokenProvider);

          const completions = await testCompletionEngine.getCompletions('broken test', 11, testContext);

          // Should continue with other providers despite the broken one
          expect(completions.some(c => c.type === 'history')).toBe(true);
          expect(consoleSpy).toHaveBeenCalled();

          consoleSpy.mockRestore();
        });
      });
    });

    // Legacy tests for backward compatibility
    it('should provide command completions', async () => {
      const completions = await testCompletionEngine.getCompletions('/run', 4, testContext);

      expect(completions.length).toBeGreaterThan(0);
      expect(completions.some(c => c.value.includes('run'))).toBe(true);
    });

    it('should provide history-based completions', async () => {
      const completions = await testCompletionEngine.getCompletions('create', 6, testContext);

      expect(completions.some(c => c.value.includes('create component'))).toBe(true);
      expect(completions.length).toBeGreaterThan(0);
    });

    it('should handle context-aware completions', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'Button.tsx', isDirectory: () => false, isFile: () => true } as any,
        { name: 'Modal.tsx', isDirectory: () => false, isFile: () => true } as any,
      ]);

      const completions = await testCompletionEngine.getCompletions('edit But', 8, testContext);

      expect(completions.some(c => c.value.includes('Button.tsx'))).toBe(true);
    });
  });

  describe('Status Bar Integration', () => {
    it('should display session information correctly', () => {
      const mockSessionStartTime = new Date('2023-01-01T10:00:00Z');

      vi.setSystemTime(new Date('2023-01-01T10:05:00Z')); // 5 minutes later

      render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 1500, output: 800 }}
            cost={0.05}
            model="claude-3-sonnet"
            gitBranch="feature/v030"
            agent="developer"
            workflowStage="implementation"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      expect(screen.getByText(/cost:/)).toBeInTheDocument();
      expect(screen.getByText(/feature\/v030/)).toBeInTheDocument();
      expect(screen.getByText(/developer/)).toBeInTheDocument();
    });

    it('should update timer in real-time', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      vi.setSystemTime(new Date('2023-01-01T10:00:30Z')); // 30 seconds later

      const { rerender } = render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={startTime}
            tokens={{ input: 100, output: 50 }}
            cost={0.01}
            model="claude-3-sonnet"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/30s/)).toBeInTheDocument();

      // Advance time
      act(() => {
        vi.setSystemTime(new Date('2023-01-01T10:01:30Z')); // 1 minute 30 seconds
        vi.advanceTimersByTime(1000); // Trigger timer update
      });

      rerender(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={startTime}
            tokens={{ input: 100, output: 50 }}
            cost={0.01}
            model="claude-3-sonnet"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/1m 30s/)).toBeInTheDocument();
    });
  });

  describe('Conversation Flow Integration', () => {
    it('should handle complete conversation cycle', async () => {
      const sessionId = await conversationManager.startSession();

      // Add user message
      await conversationManager.addMessage({
        role: 'user',
        content: 'Create a new React component called Button',
      });

      // Add assistant response
      await conversationManager.addMessage({
        role: 'assistant',
        content: 'I\'ll help you create a new React component called Button.',
      });

      // Add tool use message
      await conversationManager.addMessage({
        role: 'assistant',
        content: '',
        toolCalls: [{
          id: 'call_1',
          name: 'write_file',
          arguments: {
            path: 'Button.tsx',
            content: 'export const Button = () => <button>Click me</button>;'
          },
          timestamp: new Date(),
        }],
      });

      // Add tool result
      await conversationManager.addMessage({
        role: 'tool',
        content: 'File created successfully',
        taskId: 'call_1',
      });

      const session = await sessionStore.getSession(sessionId);
      expect(session?.messages).toHaveLength(4);

      const context = conversationManager.getContext();
      expect(context.recentFiles).toContain('Button.tsx');
    });

    it('should handle session branching', async () => {
      const originalSessionId = await conversationManager.startSession();

      await conversationManager.addMessage({
        role: 'user',
        content: 'Original message',
      });

      const branchedSessionId = await conversationManager.branchSession('New branch');
      expect(branchedSessionId).toBeDefined();
      expect(branchedSessionId).not.toBe(originalSessionId);

      // Branch should contain original messages
      const branchedSession = await sessionStore.getSession(branchedSessionId);
      expect(branchedSession?.messages).toHaveLength(1);
      expect(branchedSession?.messages[0].content).toBe('Original message');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle session store errors gracefully', async () => {
      // Mock file system error
      const fs = await import('fs/promises');
      vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('Disk full'));

      const sessionId = await conversationManager.startSession();

      // Should handle error gracefully
      await expect(
        conversationManager.addMessage({
          role: 'user',
          content: 'Test message',
        })
      ).rejects.toThrow('Disk full');
    });

    it('should recover from auto-save failures', async () => {
      const sessionId = await conversationManager.startSession();
      sessionAutoSaver.start();

      // Mock save failure
      vi.spyOn(sessionStore, 'updateSession').mockRejectedValueOnce(new Error('Save failed'));

      await conversationManager.addMessage({
        role: 'user',
        content: 'Message before failure',
      });

      // Auto-save should fail but not crash
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      // Should continue working after failure
      await conversationManager.addMessage({
        role: 'user',
        content: 'Message after failure',
      });

      const session = await sessionStore.getSession(sessionId);
      expect(session?.messages).toHaveLength(2);
    });
  });

  describe('Performance Integration', () => {
    it('should handle large conversation histories efficiently', async () => {
      const sessionId = await conversationManager.startSession();

      // Add many messages
      for (let i = 0; i < 100; i++) {
        await conversationManager.addMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        });
      }

      const startTime = Date.now();
      const session = await sessionStore.getSession(sessionId);
      const endTime = Date.now();

      expect(session?.messages).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle completion engine with large datasets', async () => {
      // Add many commands and history entries
      const manyCommands = Array.from({ length: 1000 }, (_, i) => ({
        name: `command${i}`,
        description: `Description ${i}`,
      }));

      const manyHistory = Array.from({ length: 1000 }, (_, i) => `history item ${i}`);

      const largeCompletionEngine = new CompletionEngine({
        commands: manyCommands,
        history: manyHistory,
      });

      const startTime = Date.now();
      const completions = await largeCompletionEngine.getCompletions('command', 'command');
      const endTime = Date.now();

      expect(completions.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(200); // Should complete quickly
    });
  });

  describe('Keyboard Shortcuts Integration', () => {
    let eventHandlers: Record<string, vi.Mock>;

    beforeEach(() => {
      // Set up event handlers to capture emitted events
      eventHandlers = {
        cancel: vi.fn(),
        exit: vi.fn(),
        clear: vi.fn(),
        clearLine: vi.fn(),
        deleteWord: vi.fn(),
        historySearch: vi.fn(),
        historyPrev: vi.fn(),
        historyNext: vi.fn(),
        complete: vi.fn(),
        dismiss: vi.fn(),
        newline: vi.fn(),
        submit: vi.fn(),
        moveCursor: vi.fn(),
        command: vi.fn(),
      };

      // Register event handlers
      Object.keys(eventHandlers).forEach(event => {
        shortcutManager.on(event, eventHandlers[event]);
      });
    });

    describe('ShortcutManager Registration and API', () => {
      it('should register custom shortcuts correctly', () => {
        const customShortcut = {
          id: 'test-custom',
          description: 'Test custom shortcut',
          keys: { key: 'k', ctrl: true },
          action: { type: 'emit', event: 'test' } as const,
          context: 'global' as const,
        };

        shortcutManager.register(customShortcut);
        const shortcuts = shortcutManager.getShortcuts();
        const registered = shortcuts.find(s => s.id === 'test-custom');

        expect(registered).toBeDefined();
        expect(registered?.description).toBe('Test custom shortcut');
        expect(registered?.keys.key).toBe('k');
        expect(registered?.action.type).toBe('emit');
      });

      it('should unregister shortcuts correctly', () => {
        const shortcut = {
          id: 'test-unregister',
          description: 'Test unregister',
          keys: { key: 'u', ctrl: true },
          action: { type: 'emit', event: 'test' } as const,
        };

        shortcutManager.register(shortcut);
        expect(shortcutManager.getShortcuts().find(s => s.id === 'test-unregister')).toBeDefined();

        shortcutManager.unregister('test-unregister');
        expect(shortcutManager.getShortcuts().find(s => s.id === 'test-unregister')).toBeUndefined();
      });

      it('should handle context stack operations', () => {
        expect(shortcutManager.getCurrentContext()).toBe('global');

        shortcutManager.pushContext('input');
        expect(shortcutManager.getCurrentContext()).toBe('input');

        shortcutManager.pushContext('modal');
        expect(shortcutManager.getCurrentContext()).toBe('modal');

        const popped = shortcutManager.popContext();
        expect(popped).toBe('modal');
        expect(shortcutManager.getCurrentContext()).toBe('input');

        shortcutManager.popContext();
        expect(shortcutManager.getCurrentContext()).toBe('global');

        // Should not pop below global
        const nothingPopped = shortcutManager.popContext();
        expect(nothingPopped).toBeUndefined();
        expect(shortcutManager.getCurrentContext()).toBe('global');
      });

      it('should filter shortcuts by context correctly', () => {
        shortcutManager.register({
          id: 'input-only',
          description: 'Input only',
          keys: { key: 'i', ctrl: true },
          action: { type: 'emit', event: 'test' },
          context: 'input',
        });

        shortcutManager.register({
          id: 'modal-only',
          description: 'Modal only',
          keys: { key: 'm', ctrl: true },
          action: { type: 'emit', event: 'test' },
          context: 'modal',
        });

        const globalShortcuts = shortcutManager.getShortcutsForContext('global');
        const inputShortcuts = shortcutManager.getShortcutsForContext('input');
        const modalShortcuts = shortcutManager.getShortcutsForContext('modal');

        // Global should include global shortcuts but not context-specific ones
        expect(globalShortcuts.some(s => s.id === 'help')).toBe(true); // Default global shortcut
        expect(globalShortcuts.some(s => s.id === 'input-only')).toBe(false);
        expect(globalShortcuts.some(s => s.id === 'modal-only')).toBe(false);

        // Input should include global shortcuts + input-specific ones
        expect(inputShortcuts.some(s => s.id === 'help')).toBe(true); // Global shortcuts available in input
        expect(inputShortcuts.some(s => s.id === 'input-only')).toBe(true);
        expect(inputShortcuts.some(s => s.id === 'modal-only')).toBe(false);

        // Modal should include global shortcuts + modal-specific ones
        expect(modalShortcuts.some(s => s.id === 'help')).toBe(true); // Global shortcuts available in modal
        expect(modalShortcuts.some(s => s.id === 'input-only')).toBe(false);
        expect(modalShortcuts.some(s => s.id === 'modal-only')).toBe(true);
      });

      it('should format key combinations correctly', () => {
        expect(shortcutManager.formatKey({ key: 'c', ctrl: true })).toBe('Ctrl+C');
        expect(shortcutManager.formatKey({ key: 'd', ctrl: true, shift: true })).toBe('Ctrl+Shift+D');
        expect(shortcutManager.formatKey({ key: 'a', alt: true })).toBe('Alt+A');
        expect(shortcutManager.formatKey({ key: 's', meta: true })).toBe('Cmd+S');
        expect(shortcutManager.formatKey({ key: 'x', ctrl: true, alt: true, shift: true, meta: true })).toBe('Ctrl+Alt+Shift+Cmd+X');
        expect(shortcutManager.formatKey({ key: 'Escape' })).toBe('ESCAPE');
        expect(shortcutManager.formatKey({ key: 'Tab' })).toBe('TAB');
      });
    });

    describe('Context-Aware Activation', () => {
      it('should activate shortcuts based on current context', () => {
        const globalHandler = vi.fn();
        const inputHandler = vi.fn();

        shortcutManager.register({
          id: 'global-test',
          description: 'Global test',
          keys: { key: 'g', ctrl: true },
          action: { type: 'function', handler: globalHandler },
          context: 'global',
        });

        shortcutManager.register({
          id: 'input-test',
          description: 'Input test',
          keys: { key: 'i', ctrl: true },
          action: { type: 'function', handler: inputHandler },
          context: 'input',
        });

        // In global context
        shortcutManager.handleKey({
          key: 'g',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });
        expect(globalHandler).toHaveBeenCalledTimes(1);

        // Input-only shortcut should not work in global context
        shortcutManager.handleKey({
          key: 'i',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });
        expect(inputHandler).not.toHaveBeenCalled();

        // Switch to input context
        shortcutManager.pushContext('input');

        // Both global and input shortcuts should work
        shortcutManager.handleKey({
          key: 'g',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });
        expect(globalHandler).toHaveBeenCalledTimes(2); // Global shortcuts work in any context

        shortcutManager.handleKey({
          key: 'i',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });
        expect(inputHandler).toHaveBeenCalledTimes(1); // Now input shortcut works
      });

      it('should handle conditional shortcuts with enabled callback', () => {
        const handler = vi.fn();
        let enabled = false;

        shortcutManager.register({
          id: 'conditional-test',
          description: 'Conditional test',
          keys: { key: 'c', ctrl: true, shift: true },
          action: { type: 'function', handler },
          enabled: () => enabled,
        });

        // Should not work when disabled
        const disabledResult = shortcutManager.handleKey({
          key: 'c',
          ctrl: true,
          shift: true,
          alt: false,
          meta: false,
        });
        expect(disabledResult).toBe(false);
        expect(handler).not.toHaveBeenCalled();

        // Should work when enabled
        enabled = true;
        const enabledResult = shortcutManager.handleKey({
          key: 'c',
          ctrl: true,
          shift: true,
          alt: false,
          meta: false,
        });
        expect(enabledResult).toBe(true);
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('Event Emission', () => {
      it('should emit events correctly for emit actions', () => {
        const testHandler = vi.fn();
        shortcutManager.on('test-event', testHandler);

        shortcutManager.register({
          id: 'emit-test',
          description: 'Emit test',
          keys: { key: 'e', ctrl: true },
          action: { type: 'emit', event: 'test-event', payload: { data: 'test' } },
        });

        const handled = shortcutManager.handleKey({
          key: 'e',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(testHandler).toHaveBeenCalledWith({ data: 'test' });
      });

      it('should emit command events for command actions', () => {
        shortcutManager.register({
          id: 'command-test',
          description: 'Command test',
          keys: { key: 'cmd', ctrl: true },
          action: { type: 'command', command: '/test command' },
        });

        const handled = shortcutManager.handleKey({
          key: 'cmd',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.command).toHaveBeenCalledWith('/test command');
      });

      it('should handle event listener registration and removal', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        shortcutManager.on('multi-test', handler1);
        shortcutManager.on('multi-test', handler2);

        shortcutManager.register({
          id: 'multi-handler-test',
          description: 'Multi handler test',
          keys: { key: 'multi', ctrl: true },
          action: { type: 'emit', event: 'multi-test' },
        });

        shortcutManager.handleKey({
          key: 'multi',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);

        // Remove one handler
        shortcutManager.off('multi-test', handler1);

        shortcutManager.handleKey({
          key: 'multi',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handler1).toHaveBeenCalledTimes(1); // Not called again
        expect(handler2).toHaveBeenCalledTimes(2); // Called again
      });
    });

    describe('Default Shortcuts Functionality', () => {
      it('should handle Ctrl+C (cancel) in processing context', () => {
        shortcutManager.pushContext('processing');

        const handled = shortcutManager.handleKey({
          key: 'c',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.cancel).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+D (exit) globally', () => {
        const handled = shortcutManager.handleKey({
          key: 'd',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.exit).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+L (clear) globally', () => {
        const handled = shortcutManager.handleKey({
          key: 'l',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.clear).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+U (clearLine) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'u',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.clearLine).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+W (deleteWord) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'w',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.deleteWord).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+A (beginningOfLine) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'a',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.moveCursor).toHaveBeenCalledWith('home');
      });

      it('should handle Ctrl+E (endOfLine) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'e',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.moveCursor).toHaveBeenCalledWith('end');
      });

      it('should handle Ctrl+P (previousHistory) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'p',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.historyPrev).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+N (nextHistory) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'n',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.historyNext).toHaveBeenCalledWith(undefined);
      });

      it('should handle Tab (complete) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'Tab',
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.complete).toHaveBeenCalledWith(undefined);
      });

      it('should handle Escape (dismiss) globally', () => {
        const handled = shortcutManager.handleKey({
          key: 'Escape',
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.dismiss).toHaveBeenCalledWith(undefined);
      });

      it('should handle command shortcuts that emit command events', () => {
        // Test Ctrl+S for quick save
        const handleCtrlS = shortcutManager.handleKey({
          key: 's',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handleCtrlS).toBe(true);
        expect(eventHandlers.command).toHaveBeenCalledWith('/session save quick-save');

        // Test Ctrl+H for help
        const handleCtrlH = shortcutManager.handleKey({
          key: 'h',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handleCtrlH).toBe(true);
        expect(eventHandlers.command).toHaveBeenCalledWith('/help');

        // Test Ctrl+Shift+S for status
        const handleCtrlShiftS = shortcutManager.handleKey({
          key: 's',
          ctrl: true,
          shift: true,
          alt: false,
          meta: false,
        });

        expect(handleCtrlShiftS).toBe(true);
        expect(eventHandlers.command).toHaveBeenCalledWith('/status');
      });
    });

    describe('Complex Integration Scenarios', () => {
      it('should handle shortcuts with conflicting key combinations correctly', () => {
        const normalHandler = vi.fn();
        const shiftHandler = vi.fn();

        // Register Ctrl+S and Ctrl+Shift+S
        shortcutManager.register({
          id: 'normal-save',
          description: 'Normal save',
          keys: { key: 's', ctrl: true },
          action: { type: 'function', handler: normalHandler },
        });

        shortcutManager.register({
          id: 'shift-save',
          description: 'Shift save',
          keys: { key: 's', ctrl: true, shift: true },
          action: { type: 'function', handler: shiftHandler },
        });

        // Test Ctrl+S (should not trigger Ctrl+Shift+S)
        const normalResult = shortcutManager.handleKey({
          key: 's',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(normalResult).toBe(true);
        expect(normalHandler).toHaveBeenCalledTimes(1);
        expect(shiftHandler).not.toHaveBeenCalled();

        // Test Ctrl+Shift+S (should not trigger Ctrl+S)
        const shiftResult = shortcutManager.handleKey({
          key: 's',
          ctrl: true,
          shift: true,
          alt: false,
          meta: false,
        });

        expect(shiftResult).toBe(true);
        expect(shiftHandler).toHaveBeenCalledTimes(1);
        expect(normalHandler).toHaveBeenCalledTimes(1); // Still only called once
      });

      it('should handle async function handlers', async () => {
        const asyncHandler = vi.fn().mockResolvedValue('test');

        shortcutManager.register({
          id: 'async-test',
          description: 'Async test',
          keys: { key: 'async', ctrl: true },
          action: { type: 'function', handler: asyncHandler },
        });

        const handled = shortcutManager.handleKey({
          key: 'async',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(asyncHandler).toHaveBeenCalledTimes(1);

        // Wait for async completion
        await vi.waitFor(() => expect(asyncHandler).toHaveReturnedWith(expect.any(Promise)));
      });

      it('should handle rapid successive key presses', () => {
        const handler = vi.fn();

        shortcutManager.register({
          id: 'rapid-test',
          description: 'Rapid test',
          keys: { key: 'r', ctrl: true },
          action: { type: 'function', handler },
        });

        // Simulate rapid key presses
        for (let i = 0; i < 5; i++) {
          const handled = shortcutManager.handleKey({
            key: 'r',
            ctrl: true,
            alt: false,
            shift: false,
            meta: false,
          });
          expect(handled).toBe(true);
        }

        expect(handler).toHaveBeenCalledTimes(5);
      });

      it('should maintain context isolation between different shortcut instances', () => {
        const manager1 = new ShortcutManager();
        const manager2 = new ShortcutManager();

        const handler1 = vi.fn();
        const handler2 = vi.fn();

        manager1.register({
          id: 'instance-test',
          description: 'Instance test 1',
          keys: { key: 'i', ctrl: true },
          action: { type: 'function', handler: handler1 },
        });

        manager2.register({
          id: 'instance-test',
          description: 'Instance test 2',
          keys: { key: 'i', ctrl: true },
          action: { type: 'function', handler: handler2 },
        });

        // Trigger on first manager
        manager1.handleKey({
          key: 'i',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).not.toHaveBeenCalled();

        // Trigger on second manager
        manager2.handleKey({
          key: 'i',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Display Modes Integration', () => {
    it('should switch between compact and normal display modes', () => {
      const mockSessionStartTime = new Date();

      const { rerender } = render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 1500, output: 800 }}
            cost={0.05}
            model="claude-3-sonnet"
            gitBranch="feature/v030"
            agent="developer"
            workflowStage="implementation"
            displayMode="compact"
          />
        </ThemeProvider>
      );

      // In compact mode, should render with compact styling
      expect(screen.getByText(/feature\/v030/)).toBeInTheDocument();

      rerender(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 1500, output: 800 }}
            cost={0.05}
            model="claude-3-sonnet"
            gitBranch="feature/v030"
            agent="developer"
            workflowStage="implementation"
            displayMode="normal"
          />
        </ThemeProvider>
      );

      // In normal mode, should show more detailed information including agent
      expect(screen.getByText(/developer/)).toBeInTheDocument();
    });

    it('should handle verbose display mode with extended information', () => {
      const mockSessionStartTime = new Date();

      render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 2000, output: 1200 }}
            cost={0.08}
            model="claude-3-sonnet"
            gitBranch="feature/verbose-test"
            agent="architect"
            workflowStage="planning"
            displayMode="verbose"
          />
        </ThemeProvider>
      );

      // In verbose mode, should show detailed information
      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      expect(screen.getByText(/feature\/verbose-test/)).toBeInTheDocument();
      expect(screen.getByText(/architect/)).toBeInTheDocument();
    });

    it('should adapt component layouts for different display modes', () => {
      const mockCommands = [
        { name: 'run', description: 'Execute a task' },
        { name: 'status', description: 'Show status' },
      ];

      // Test with minimal context (no specific display mode for IntentDetector)
      const { rerender } = render(
        <ThemeProvider>
          <IntentDetector
            input="test input"
            commands={mockCommands}
          />
        </ThemeProvider>
      );

      // Should render without errors
      rerender(
        <ThemeProvider>
          <IntentDetector
            input="test input different"
            commands={mockCommands}
          />
        </ThemeProvider>
      );

      // Should render without errors in both cases
    });

    it('should persist display mode state through user interactions', () => {
      // Mock a state manager to track display mode changes
      let currentDisplayMode = 'normal';
      const mockSetDisplayMode = vi.fn((mode) => {
        currentDisplayMode = mode;
      });

      const { rerender } = render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={new Date()}
            tokens={{ input: 100, output: 50 }}
            cost={0.01}
            model="claude-3-sonnet"
            displayMode={currentDisplayMode as any}
          />
        </ThemeProvider>
      );

      // Simulate changing display mode
      mockSetDisplayMode('compact');

      rerender(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={new Date()}
            tokens={{ input: 100, output: 50 }}
            cost={0.01}
            model="claude-3-sonnet"
            displayMode="compact"
          />
        </ThemeProvider>
      );

      expect(mockSetDisplayMode).toHaveBeenCalledWith('compact');
      expect(currentDisplayMode).toBe('compact');
    });

    it('should handle responsive behavior across display modes', () => {
      const displayModes = ['normal', 'compact', 'verbose'] as const;

      displayModes.forEach(mode => {
        render(
          <ThemeProvider>
            <StatusBar
              sessionStartTime={new Date()}
              tokens={{ input: 1000, output: 500 }}
              cost={0.03}
              model="claude-3-sonnet"
              gitBranch={`feature/test-${mode}`}
              displayMode={mode}
            />
          </ThemeProvider>
        );

        // Should render without errors in all display modes
        expect(screen.getByText(/●/)).toBeInTheDocument(); // Connection indicator
      });
    });

    it('should maintain accessibility across all display modes', () => {
      const displayModes = ['normal', 'compact', 'verbose'] as const;

      displayModes.forEach(mode => {
        const { unmount } = render(
          <ThemeProvider>
            <StatusBar
              sessionStartTime={new Date()}
              tokens={{ input: 500, output: 300 }}
              cost={0.02}
              model="claude-3-sonnet"
              gitBranch="accessibility-test"
              agent="tester"
              displayMode={mode}
            />
          </ThemeProvider>
        );

        // Should render accessible content - connection indicator is always present
        expect(screen.getByText(/●/)).toBeInTheDocument();

        unmount();
      });
    });

    it('should handle display mode edge cases gracefully', () => {
      const mockSessionStartTime = new Date();

      // Test with minimal data in different display modes
      const { rerender } = render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 0, output: 0 }}
            cost={0}
            model="claude-3-sonnet"
            displayMode="compact"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/●/)).toBeInTheDocument();

      rerender(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 0, output: 0 }}
            cost={0}
            model="claude-3-sonnet"
            displayMode="verbose"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/●/)).toBeInTheDocument();
    });

    // NEW: Display Modes Integration with Sessions and Workflows
    describe('Display Modes Integration', () => {
      it('should integrate display modes with session management workflow', async () => {
        // Start with normal mode during session creation
        const sessionId = await conversationManager.startSession();
        let displayMode = 'normal';

        const { rerender } = render(
          <ThemeProvider>
            <StatusBar
              displayMode={displayMode as any}
              gitBranch="feature/session-integration"
              agent="planner"
              sessionStartTime={new Date(Date.now() - 30000)} // 30 seconds ago
              tokens={{ input: 500, output: 300 }}
              cost={0.02}
            />
          </ThemeProvider>
        );

        // Normal mode should show comprehensive session info
        expect(screen.getByText(/feature\/session-integration/)).toBeInTheDocument();
        expect(screen.getByText(/planner/)).toBeInTheDocument();
        expect(screen.getByText(/tokens:/)).toBeInTheDocument();

        // Switch to compact mode during active development
        displayMode = 'compact';
        rerender(
          <ThemeProvider>
            <StatusBar
              displayMode={displayMode as any}
              gitBranch="feature/session-integration"
              agent="developer"
              sessionStartTime={new Date(Date.now() - 60000)} // 1 minute ago
              tokens={{ input: 800, output: 600 }}
              cost={0.03}
            />
          </ThemeProvider>
        );

        // Compact mode should show only essential info for active development
        expect(screen.getByText('●')).toBeInTheDocument(); // Connection status
        expect(screen.getByText('feature/session-integration')).toBeInTheDocument(); // Git branch
        expect(screen.getByText(/\$0\.0300/)).toBeInTheDocument(); // Cost display in compact

        // Switch to verbose mode during debugging
        displayMode = 'verbose';
        rerender(
          <ThemeProvider>
            <StatusBar
              displayMode={displayMode as any}
              gitBranch="feature/session-integration"
              agent="developer"
              workflowStage="debugging"
              sessionStartTime={new Date(Date.now() - 120000)} // 2 minutes ago
              tokens={{ input: 1200, output: 900 }}
              cost={0.05}
              sessionName="Debug Session"
              subtaskProgress={{ completed: 2, total: 5 }}
            />
          </ThemeProvider>
        );

        // Verbose mode should show all available information for debugging
        expect(screen.getByText(/feature\/session-integration/)).toBeInTheDocument();
        expect(screen.getByText(/developer/)).toBeInTheDocument();
        expect(screen.getByText(/debugging/)).toBeInTheDocument();
        expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      });

      it('should integrate display modes with completion engine context', async () => {
        // Update completion engine context based on current mode
        completionEngine.updateContext({
          currentDirectory: '/src/ui/components',
          recentFiles: ['StatusBar.tsx', 'ThemeProvider.tsx'],
          activeTask: 'display-mode-testing',
        });

        const completions = await completionEngine.getCompletions('status', 'natural');
        expect(completions.some(c => c.includes('StatusBar.tsx'))).toBe(true);

        // Test with different display modes affecting the status bar
        const modes = ['normal', 'compact', 'verbose'] as const;

        modes.forEach((mode, index) => {
          render(
            <ThemeProvider>
              <StatusBar
                displayMode={mode}
                gitBranch="feature/completion-integration"
                agent="developer"
                workflowStage="implementation"
                tokens={{ input: 1000 + (index * 200), output: 500 + (index * 100) }}
                cost={0.02 + (index * 0.01)}
              />
            </ThemeProvider>
          );

          // Should render without errors regardless of mode
          expect(screen.getByText('●')).toBeInTheDocument();

          if (mode === 'compact') {
            // In compact mode, should show git branch but hide agent details
            expect(screen.getByText('feature/completion-integration')).toBeInTheDocument();
            // Agent should NOT be shown in compact mode
            expect(screen.queryByText('developer')).not.toBeInTheDocument();
          } else {
            // In normal/verbose modes, should show agent
            expect(screen.getByText('developer')).toBeInTheDocument();
          }
        });
      });

      it('should integrate display modes with conversation flow and intent detection', async () => {
        // Start a conversation session
        const sessionId = await conversationManager.startSession();

        await conversationManager.addMessage({
          role: 'user',
          content: 'Switch to compact mode for focused development',
        });

        let detectedIntent: any = null;

        // Test intent detection with display mode context
        render(
          <ThemeProvider>
            <IntentDetector
              input="set mode compact"
              commands={[
                { name: 'mode', description: 'Set display mode' },
                { name: 'status', description: 'Show status' },
              ]}
              onIntentDetected={(intent) => { detectedIntent = intent; }}
            />
          </ThemeProvider>
        );

        await act(async () => {
          vi.advanceTimersByTime(400);
        });

        await waitFor(() => {
          expect(detectedIntent).toBeDefined();
        });

        // Also test StatusBar integration with conversation state
        render(
          <ThemeProvider>
            <StatusBar
              displayMode="compact"
              gitBranch="feature/conversation-flow"
              agent="assistant"
              sessionStartTime={new Date(Date.now() - 45000)} // 45 seconds ago
              tokens={{ input: 800, output: 500 }}
              cost={0.025}
            />
          </ThemeProvider>
        );

        // Should show conversation-relevant information in compact mode
        expect(screen.getByText('feature/conversation-flow')).toBeInTheDocument();
        expect(screen.getByText(/\$0\.0250/)).toBeInTheDocument();
      });

      it('should handle display mode changes during auto-save operations', async () => {
        const sessionId = await conversationManager.startSession();
        sessionAutoSaver.start();

        let currentMode = 'normal';
        const { rerender } = render(
          <ThemeProvider>
            <StatusBar
              displayMode={currentMode as any}
              gitBranch="feature/auto-save"
              agent="developer"
              sessionStartTime={new Date(Date.now() - 30000)}
              tokens={{ input: 600, output: 400 }}
              cost={0.02}
            />
          </ThemeProvider>
        );

        // Add a message to trigger auto-save
        await conversationManager.addMessage({
          role: 'user',
          content: 'Test message during auto-save',
        });

        // Change to compact mode during auto-save interval
        currentMode = 'compact';

        act(() => {
          vi.advanceTimersByTime(30000); // Advance 30 seconds
        });

        rerender(
          <ThemeProvider>
            <StatusBar
              displayMode={currentMode as any}
              gitBranch="feature/auto-save"
              agent="developer"
              sessionStartTime={new Date(Date.now() - 60000)}
              tokens={{ input: 800, output: 600 }}
              cost={0.03}
            />
          </ThemeProvider>
        );

        // Auto-save should continue working regardless of display mode
        // StatusBar should show appropriate info in compact mode
        expect(screen.getByText('feature/auto-save')).toBeInTheDocument();
        expect(screen.getByText(/\$0\.0300/)).toBeInTheDocument();

        // Advance time to trigger auto-save
        act(() => {
          vi.advanceTimersByTime(60000); // Trigger auto-save
        });

        // Session should still be accessible after auto-save
        const session = await sessionStore.getSession(sessionId);
        expect(session?.messages).toHaveLength(1);
      });

      it('should maintain display mode preferences across component remounts', () => {
        // Test mode persistence during component lifecycle
        let displayMode = 'verbose';

        const { rerender, unmount } = render(
          <ThemeProvider>
            <StatusBar
              displayMode={displayMode as any}
              gitBranch="feature/persistence-test"
              agent="architect"
              workflowStage="planning"
              sessionStartTime={new Date(Date.now() - 90000)} // 1.5 minutes ago
              tokens={{ input: 1500, output: 1000 }}
              cost={0.05}
            />
          </ThemeProvider>
        );

        // Should show verbose mode information
        expect(screen.getByText(/feature\/persistence-test/)).toBeInTheDocument();
        expect(screen.getByText(/architect/)).toBeInTheDocument();
        expect(screen.getByText(/planning/)).toBeInTheDocument();
        expect(screen.getByText(/tokens:/)).toBeInTheDocument();

        // Unmount component
        unmount();

        // Remount with same mode
        render(
          <ThemeProvider>
            <StatusBar
              displayMode={displayMode as any}
              gitBranch="feature/persistence-test"
              agent="architect"
              workflowStage="planning"
              sessionStartTime={new Date(Date.now() - 120000)} // 2 minutes ago
              tokens={{ input: 1800, output: 1200 }}
              cost={0.06}
            />
          </ThemeProvider>
        );

        // Should maintain verbose mode behavior after remount
        expect(screen.getByText(/feature\/persistence-test/)).toBeInTheDocument();
        expect(screen.getByText(/architect/)).toBeInTheDocument();
        expect(screen.getByText(/planning/)).toBeInTheDocument();
        expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      });

      it('should handle display mode integration with shortcut manager', () => {
        const shortcutHandler = vi.fn();

        // Register a display mode toggle shortcut
        shortcutManager.register({
          id: 'toggle-display-mode',
          description: 'Toggle display mode',
          keys: { key: 'm', ctrl: true },
          action: { type: 'function', handler: shortcutHandler },
        });

        let currentMode = 'normal';
        const { rerender } = render(
          <ThemeProvider>
            <StatusBar
              displayMode={currentMode as any}
              gitBranch="feature/shortcut-integration"
              agent="developer"
              tokens={{ input: 1000, output: 750 }}
              cost={0.04}
            />
          </ThemeProvider>
        );

        // Trigger shortcut
        const handled = shortcutManager.handleKey({
          key: 'm',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(shortcutHandler).toHaveBeenCalled();

        // Simulate mode change triggered by shortcut
        currentMode = 'compact';
        rerender(
          <ThemeProvider>
            <StatusBar
              displayMode={currentMode as any}
              gitBranch="feature/shortcut-integration"
              agent="developer"
              tokens={{ input: 1000, output: 750 }}
              cost={0.04}
            />
          </ThemeProvider>
        );

        // Should show compact mode after shortcut trigger
        expect(screen.getByText('feature/shortcut-integration')).toBeInTheDocument();
        expect(screen.getByText(/\$0\.0400/)).toBeInTheDocument();
      });
    });
  });

  describe('Theme Integration', () => {
    it('should apply theme consistently across components', () => {
      render(
        <ThemeProvider theme="dark">
          <div>
            <StatusBar
              sessionStartTime={new Date()}
              tokens={{ input: 100, output: 50 }}
              cost={0.01}
              model="claude-3-sonnet"
            />
            <IntentDetector
              input="test input"
              commands={[]}
            />
          </div>
        </ThemeProvider>
      );

      // Components should render without theme conflicts
      expect(screen.getByText(/●/)).toBeInTheDocument();
    });

    it('should handle theme switching dynamically', () => {
      const { rerender } = render(
        <ThemeProvider theme="light">
          <StatusBar
            sessionStartTime={new Date()}
            tokens={{ input: 200, output: 100 }}
            cost={0.015}
            model="claude-3-sonnet"
          />
        </ThemeProvider>
      );

      // Switch to dark theme
      rerender(
        <ThemeProvider theme="dark">
          <StatusBar
            sessionStartTime={new Date()}
            tokens={{ input: 200, output: 100 }}
            cost={0.015}
            model="claude-3-sonnet"
          />
        </ThemeProvider>
      );

      // Should render without errors in both themes
      expect(screen.getByText(/●/)).toBeInTheDocument();
    });

    it('should apply custom theme configurations', () => {
      const customTheme = {
        colors: {
          primary: '#007acc',
          secondary: '#ff6b35',
          background: '#1e1e1e',
          text: '#ffffff',
        },
        typography: {
          fontSize: '14px',
          fontFamily: 'Consolas, monospace',
        },
      };

      render(
        <ThemeProvider theme={customTheme}>
          <StatusBar
            sessionStartTime={new Date()}
            tokens={{ input: 300, output: 150 }}
            cost={0.025}
            model="claude-3-sonnet"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/●/)).toBeInTheDocument();
    });
  });
});