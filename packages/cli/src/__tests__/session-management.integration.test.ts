/**
 * Comprehensive integration tests for session management functionality
 *
 * Tests the complete integration of SessionStore and SessionAutoSaver components:
 * - Session lifecycle operations (create, read, update, delete)
 * - Message and state management
 * - Archive and restore operations
 * - Auto-save functionality with timer integration
 * - Error handling and edge cases
 * - Performance and memory management
 *
 * Acceptance Criteria:
 * 1. SessionStore + SessionAutoSaver integration for session creation
 * 2. Full lifecycle operations (create, read, update, archive, restore, delete)
 * 3. Message management with tool calls and timestamps
 * 4. State management and persistence
 * 5. Auto-save with timer integration
 * 6. Archive/compression functionality
 * 7. Error handling and recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { SessionStore, Session, SessionMessage, ToolCallRecord, SessionState } from '../services/SessionStore';
import { SessionAutoSaver, AutoSaveOptions } from '../services/SessionAutoSaver';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('zlib');

const mockFs = vi.mocked(fs);
const mockGzip = vi.mocked(promisify(zlib.gzip));
const mockGunzip = vi.mocked(promisify(zlib.gunzip));

// Test data factories
const createTestSession = (overrides: Partial<Session> = {}): Session => ({
  id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Session',
  projectPath: '/test/project',
  createdAt: new Date('2023-01-01T10:00:00Z'),
  updatedAt: new Date('2023-01-01T10:00:00Z'),
  lastAccessedAt: new Date('2023-01-01T10:00:00Z'),
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

const createTestMessage = (overrides: Partial<SessionMessage> = {}): SessionMessage => ({
  id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  index: 0,
  role: 'user',
  content: 'Test message',
  timestamp: new Date('2023-01-01T10:01:00Z'),
  ...overrides,
});

const createTestToolCall = (overrides: Partial<ToolCallRecord> = {}): ToolCallRecord => ({
  id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Read',
  arguments: { file_path: '/test/file.txt' },
  result: 'Test file content',
  timestamp: new Date('2023-01-01T10:01:30Z'),
  ...overrides,
});

const createTestState = (overrides: Partial<SessionState> = {}): SessionState => ({
  totalTokens: { input: 100, output: 200 },
  totalCost: 0.5,
  tasksCreated: ['task-1', 'task-2'],
  tasksCompleted: ['task-1'],
  currentTaskId: 'task-2',
  lastGitBranch: 'feature/test-branch',
  ...overrides,
});

describe('Session Management Integration Tests', () => {
  let sessionStore: SessionStore;
  let autoSaver: SessionAutoSaver;
  let mockProjectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockProjectPath = '/test/project';

    sessionStore = new SessionStore(mockProjectPath);

    // Setup default mock implementations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('{}');
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);

    // Setup compression mocks
    mockGzip.mockResolvedValue(Buffer.from('compressed'));
    mockGunzip.mockResolvedValue(Buffer.from('{}'));
  });

  afterEach(() => {
    vi.useRealTimers();
    autoSaver?.stop();
    vi.resetAllMocks();
  });

  describe('Session Creation Integration', () => {
    it('should create session through SessionStore and integrate with SessionAutoSaver', async () => {
      // Mock empty index file
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      // Create session through SessionStore
      const session = await sessionStore.createSession('Integration Test Session');

      expect(session).toMatchObject({
        name: 'Integration Test Session',
        projectPath: mockProjectPath,
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
      });

      // Verify session saved to filesystem
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${session.id}.json`),
        expect.stringContaining('"name":"Integration Test Session"')
      );

      // Verify active session set
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('active.json'),
        JSON.stringify({ sessionId: session.id })
      );

      // Test SessionAutoSaver integration
      autoSaver = new SessionAutoSaver(sessionStore);

      // Mock the store to return our created session
      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${session.id}.json`)) {
          return Promise.resolve(JSON.stringify(session));
        }
        if (path.includes('active.json')) {
          return Promise.resolve(JSON.stringify({ sessionId: session.id }));
        }
        return Promise.reject(new Error('File not found'));
      });

      const loadedSession = await autoSaver.start(session.id);

      expect(loadedSession.id).toBe(session.id);
      expect(loadedSession.name).toBe('Integration Test Session');
    });

    it('should handle SessionAutoSaver creating new session when none exists', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      autoSaver = new SessionAutoSaver(sessionStore);
      const session = await autoSaver.start();

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^sess_\d+_\w+$/);
      expect(mockFs.writeFile).toHaveBeenCalled(); // Session saved
    });
  });

  describe('Full Session Lifecycle', () => {
    let testSession: Session;

    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      testSession = await sessionStore.createSession('Lifecycle Test');

      // Setup mock to return our test session
      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${testSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(testSession));
        }
        if (path.includes('index.json')) {
          return Promise.resolve(JSON.stringify({
            version: 1,
            sessions: [{
              id: testSession.id,
              name: testSession.name,
              messageCount: testSession.messages.length,
              totalCost: testSession.state.totalCost,
              createdAt: testSession.createdAt,
              updatedAt: testSession.updatedAt,
              tags: testSession.tags,
              isArchived: false
            }],
            lastUpdated: new Date()
          }));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should complete full CRUD lifecycle', async () => {
      // CREATE - already done in beforeEach
      expect(testSession.id).toBeDefined();

      // READ
      const retrievedSession = await sessionStore.getSession(testSession.id);
      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession!.id).toBe(testSession.id);
      expect(retrievedSession!.name).toBe('Lifecycle Test');

      // UPDATE
      await sessionStore.updateSession(testSession.id, {
        name: 'Updated Lifecycle Test',
        tags: ['updated', 'integration']
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${testSession.id}.json`),
        expect.stringContaining('"name":"Updated Lifecycle Test"')
      );

      // DELETE
      await sessionStore.deleteSession(testSession.id);

      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining(`${testSession.id}.json`)
      );
    });

    it('should handle archive and restore cycle', async () => {
      // ARCHIVE
      await sessionStore.archiveSession(testSession.id);

      expect(mockGzip).toHaveBeenCalledWith(JSON.stringify(testSession));
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${testSession.id}.json.gz`),
        Buffer.from('compressed')
      );
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining(`${testSession.id}.json`)
      );

      // RESTORE (retrieve from archive)
      const archivedSession = {
        ...testSession,
        isArchived: true
      };

      // Mock archived session retrieval
      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${testSession.id}.json`)) {
          return Promise.reject(new Error('File not found')); // Not in main directory
        }
        return Promise.reject(new Error('File not found'));
      });

      mockGunzip.mockResolvedValue(Buffer.from(JSON.stringify(archivedSession)));

      const restoredSession = await sessionStore.getSession(testSession.id);
      expect(restoredSession).not.toBeNull();
      expect(restoredSession!.id).toBe(testSession.id);
    });
  });

  describe('Message and State Management Integration', () => {
    let testSession: Session;
    let testAutoSaver: SessionAutoSaver;

    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      testSession = await sessionStore.createSession('Message Test');
      testAutoSaver = new SessionAutoSaver(sessionStore, { enabled: false }); // Disable auto-timer for manual control

      // Mock session retrieval
      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${testSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(testSession));
        }
        return Promise.reject(new Error('File not found'));
      });

      await testAutoSaver.start(testSession.id);
    });

    it('should manage messages with tool calls and timestamps', async () => {
      const toolCall = createTestToolCall({
        name: 'Read',
        arguments: { file_path: '/important/file.txt' },
        result: 'Important file content'
      });

      // Add message with tool call
      await testAutoSaver.addMessage({
        role: 'assistant',
        content: 'I will read the important file',
        agent: 'developer',
        stage: 'implementation',
        taskId: 'task-123',
        tokens: { input: 20, output: 45 },
        toolCalls: [toolCall]
      });

      const session = testAutoSaver.getSession()!;
      expect(session.messages).toHaveLength(1);

      const message = session.messages[0];
      expect(message.role).toBe('assistant');
      expect(message.agent).toBe('developer');
      expect(message.stage).toBe('implementation');
      expect(message.taskId).toBe('task-123');
      expect(message.tokens).toEqual({ input: 20, output: 45 });
      expect(message.toolCalls).toHaveLength(1);
      expect(message.toolCalls![0]).toMatchObject({
        name: 'Read',
        arguments: { file_path: '/important/file.txt' },
        result: 'Important file content'
      });
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.id).toMatch(/^msg_\d+_\w+$/);
    });

    it('should manage session state updates', async () => {
      const stateUpdate = createTestState({
        totalTokens: { input: 150, output: 300 },
        totalCost: 0.75,
        tasksCreated: ['task-1', 'task-2', 'task-3'],
        tasksCompleted: ['task-1', 'task-2'],
        currentTaskId: 'task-3',
        lastGitBranch: 'feature/session-management'
      });

      await testAutoSaver.updateState(stateUpdate);

      const session = testAutoSaver.getSession()!;
      expect(session.state).toMatchObject(stateUpdate);
      expect(testAutoSaver.hasUnsavedChanges()).toBe(true);
    });

    it('should manage input history with deduplication', async () => {
      await testAutoSaver.addInputToHistory('/help');
      await testAutoSaver.addInputToHistory('/status');
      await testAutoSaver.addInputToHistory('/status'); // Duplicate
      await testAutoSaver.addInputToHistory('create session');

      const session = testAutoSaver.getSession()!;
      expect(session.inputHistory).toEqual(['/help', '/status', 'create session']);
    });

    it('should handle complex message sequences with mixed roles and agents', async () => {
      // User message
      await testAutoSaver.addMessage({
        role: 'user',
        content: 'Please create a new feature for user authentication'
      });

      // Planner response
      await testAutoSaver.addMessage({
        role: 'assistant',
        content: 'I will plan the authentication feature implementation',
        agent: 'planner',
        stage: 'planning',
        taskId: 'auth-task-1'
      });

      // Developer implementation
      await testAutoSaver.addMessage({
        role: 'assistant',
        content: 'Implementing authentication service',
        agent: 'developer',
        stage: 'implementation',
        taskId: 'auth-task-1',
        toolCalls: [createTestToolCall({
          name: 'Write',
          arguments: { file_path: '/src/auth/AuthService.ts', content: 'class AuthService...' }
        })]
      });

      // System status update
      await testAutoSaver.addMessage({
        role: 'system',
        content: 'Authentication feature implementation completed'
      });

      const session = testAutoSaver.getSession()!;
      expect(session.messages).toHaveLength(4);

      const [userMsg, plannerMsg, devMsg, systemMsg] = session.messages;
      expect(userMsg.role).toBe('user');
      expect(plannerMsg.agent).toBe('planner');
      expect(devMsg.agent).toBe('developer');
      expect(devMsg.toolCalls).toHaveLength(1);
      expect(systemMsg.role).toBe('system');

      // Verify sequential indexing
      expect(session.messages.map(m => m.index)).toEqual([0, 1, 2, 3]);
    });
  });

  describe('Auto-Save Integration with Timers', () => {
    let testSession: Session;
    let testAutoSaver: SessionAutoSaver;

    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      testSession = await sessionStore.createSession('Auto-Save Test');

      // Mock session retrieval
      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${testSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(testSession));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should auto-save on timer intervals', async () => {
      testAutoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 1000,
        maxUnsavedMessages: 10
      });

      await testAutoSaver.start(testSession.id);

      // Add changes
      await testAutoSaver.addMessage({
        role: 'user',
        content: 'Test message for auto-save'
      });

      expect(testAutoSaver.hasUnsavedChanges()).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2); // Initial session save + active session

      // Advance timer
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Should have saved
      expect(mockFs.writeFile).toHaveBeenCalledTimes(3); // Initial + active + auto-save
      expect(testAutoSaver.hasUnsavedChanges()).toBe(false);
    });

    it('should auto-save when max unsaved messages reached', async () => {
      testAutoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 10000, // Long interval
        maxUnsavedMessages: 2
      });

      await testAutoSaver.start(testSession.id);

      // Add first message
      await testAutoSaver.addMessage({ role: 'user', content: 'Message 1' });
      expect(testAutoSaver.getUnsavedChangesCount()).toBe(1);
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2); // Initial setup

      // Add second message - should trigger auto-save
      await testAutoSaver.addMessage({ role: 'user', content: 'Message 2' });

      expect(testAutoSaver.getUnsavedChangesCount()).toBe(0); // Reset after auto-save
      expect(mockFs.writeFile).toHaveBeenCalledTimes(3); // Initial + active + auto-save
    });

    it('should handle timer errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock update to fail
      const originalUpdate = mockFs.writeFile;
      let callCount = 0;
      mockFs.writeFile.mockImplementation((...args) => {
        callCount++;
        if (callCount > 2) { // Fail after initial setup
          return Promise.reject(new Error('Disk full'));
        }
        return originalUpdate.apply(null, args);
      });

      testAutoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 1000
      });

      await testAutoSaver.start(testSession.id);
      await testAutoSaver.addMessage({ role: 'user', content: 'Test message' });

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(testAutoSaver.hasUnsavedChanges()).toBe(true); // Changes still pending

      consoleSpy.mockRestore();
    });

    it('should save on stop even with timer disabled', async () => {
      testAutoSaver = new SessionAutoSaver(sessionStore, {
        enabled: false, // Timer disabled
        intervalMs: 1000
      });

      await testAutoSaver.start(testSession.id);

      await testAutoSaver.addMessage({ role: 'user', content: 'Message before stop' });
      expect(testAutoSaver.hasUnsavedChanges()).toBe(true);

      await testAutoSaver.stop();

      expect(mockFs.writeFile).toHaveBeenCalledTimes(3); // Initial + active + stop save
      expect(testAutoSaver.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('Advanced Session Operations', () => {
    let parentSession: Session;
    let testAutoSaver: SessionAutoSaver;

    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      // Create parent session with some history
      parentSession = createTestSession({
        name: 'Parent Session',
        messages: [
          createTestMessage({ index: 0, content: 'First message' }),
          createTestMessage({ index: 1, content: 'Second message' }),
          createTestMessage({ index: 2, content: 'Third message' }),
        ],
        state: createTestState({
          totalTokens: { input: 100, output: 150 },
          totalCost: 0.25
        })
      });

      // Mock session data
      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${parentSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(parentSession));
        }
        if (path.includes('index.json')) {
          return Promise.resolve(JSON.stringify({
            version: 1,
            sessions: [],
            lastUpdated: new Date()
          }));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should branch session and maintain relationship', async () => {
      const branchedSession = await sessionStore.branchSession(parentSession.id, 1, 'Branched Session');

      expect(branchedSession.id).not.toBe(parentSession.id);
      expect(branchedSession.name).toBe('Branched Session');
      expect(branchedSession.parentSessionId).toBe(parentSession.id);
      expect(branchedSession.branchPoint).toBe(1);
      expect(branchedSession.messages).toHaveLength(2); // Only first two messages

      // State should be recalculated for branch
      expect(branchedSession.state.totalTokens).toBeDefined();

      // Parent should be updated with child reference
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('parent-session.json'),
        expect.stringContaining(branchedSession.id)
      );
    });

    it('should export session in multiple formats', async () => {
      const sessionWithMessages = createTestSession({
        name: 'Export Test Session',
        messages: [
          createTestMessage({
            role: 'user',
            content: 'Hello APEX'
          }),
          createTestMessage({
            role: 'assistant',
            content: 'Hello! How can I help?',
            agent: 'planner'
          })
        ]
      });

      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${sessionWithMessages.id}.json`)) {
          return Promise.resolve(JSON.stringify(sessionWithMessages));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Test markdown export
      const markdown = await sessionStore.exportSession(sessionWithMessages.id, 'md');
      expect(markdown).toContain('# APEX Session: Export Test Session');
      expect(markdown).toContain('**User**');
      expect(markdown).toContain('Hello APEX');
      expect(markdown).toContain('**Assistant (planner)**');

      // Test JSON export
      const jsonStr = await sessionStore.exportSession(sessionWithMessages.id, 'json');
      const parsed = JSON.parse(jsonStr);
      expect(parsed.id).toBe(sessionWithMessages.id);
      expect(parsed.messages).toHaveLength(2);

      // Test HTML export
      const html = await sessionStore.exportSession(sessionWithMessages.id, 'html');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>APEX Session: Export Test Session</title>');
      expect(html).toContain('class="message user"');
    });

    it('should list sessions with filtering and sorting', async () => {
      const mockIndex = {
        version: 1,
        sessions: [
          {
            id: 'session-1',
            name: 'Active Session',
            messageCount: 10,
            totalCost: 0.5,
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-02'),
            tags: ['work'],
            isArchived: false
          },
          {
            id: 'session-2',
            name: 'Archived Session',
            messageCount: 20,
            totalCost: 1.0,
            createdAt: new Date('2023-01-03'),
            updatedAt: new Date('2023-01-04'),
            tags: ['personal'],
            isArchived: true
          },
          {
            id: 'session-3',
            name: 'Recent Session',
            messageCount: 5,
            totalCost: 0.1,
            createdAt: new Date('2023-01-05'),
            updatedAt: new Date('2023-01-06'),
            tags: ['work'],
            isArchived: false
          }
        ],
        lastUpdated: new Date()
      };

      mockFs.readFile.mockImplementation((path) => {
        if (path.includes('index.json')) {
          return Promise.resolve(JSON.stringify(mockIndex));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Test default listing (active only, sorted by updatedAt desc)
      const activeSessions = await sessionStore.listSessions();
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions[0].id).toBe('session-3'); // Most recent
      expect(activeSessions[1].id).toBe('session-1');

      // Test with archived sessions
      const allSessions = await sessionStore.listSessions({ all: true });
      expect(allSessions).toHaveLength(3);

      // Test search filtering
      const searchResults = await sessionStore.listSessions({ search: 'recent' });
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].id).toBe('session-3');

      // Test tag filtering
      const workSessions = await sessionStore.listSessions({ tags: ['work'] });
      expect(workSessions).toHaveLength(2);
      expect(workSessions.every(s => s.tags.includes('work'))).toBe(true);

      // Test limit
      const limitedSessions = await sessionStore.listSessions({ limit: 1 });
      expect(limitedSessions).toHaveLength(1);
      expect(limitedSessions[0].id).toBe('session-3');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let testSession: Session;
    let testAutoSaver: SessionAutoSaver;

    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      testSession = await sessionStore.createSession('Error Test Session');
      testAutoSaver = new SessionAutoSaver(sessionStore, { enabled: false });
    });

    it('should handle corrupted session files gracefully', async () => {
      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${testSession.id}.json`)) {
          return Promise.resolve('invalid json{');
        }
        return Promise.reject(new Error('File not found'));
      });

      const session = await sessionStore.getSession(testSession.id);
      expect(session).toBeNull(); // Should return null for corrupted data
    });

    it('should handle filesystem permission errors', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(
        sessionStore.createSession('Permission Test')
      ).rejects.toThrow('Permission denied');
    });

    it('should handle compression failures during archiving', async () => {
      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${testSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(testSession));
        }
        return Promise.reject(new Error('File not found'));
      });

      mockGzip.mockRejectedValue(new Error('Compression failed'));

      await expect(
        sessionStore.archiveSession(testSession.id)
      ).rejects.toThrow('Compression failed');
    });

    it('should handle operations on non-existent sessions', async () => {
      await expect(
        sessionStore.updateSession('non-existent-id', { name: 'Updated' })
      ).rejects.toThrow('Session not found: non-existent-id');

      await expect(
        sessionStore.branchSession('non-existent-id', 0)
      ).rejects.toThrow('Session not found: non-existent-id');

      const exportResult = await sessionStore.exportSession('non-existent-id').catch(e => e);
      expect(exportResult).toBeInstanceOf(Error);
    });

    it('should handle SessionAutoSaver operations without current session', async () => {
      const orphanedAutoSaver = new SessionAutoSaver(sessionStore);

      // Should not throw errors, just be no-ops
      await orphanedAutoSaver.addMessage({ role: 'user', content: 'test' });
      await orphanedAutoSaver.updateState({ totalCost: 0.1 });
      await orphanedAutoSaver.updateSessionInfo({ name: 'test' });
      await orphanedAutoSaver.addInputToHistory('test command');
      await orphanedAutoSaver.save();

      expect(orphanedAutoSaver.hasUnsavedChanges()).toBe(false);
      expect(orphanedAutoSaver.getSession()).toBeNull();
    });

    it('should handle date parsing errors in session data', async () => {
      const sessionWithBadDates = {
        ...testSession,
        createdAt: 'invalid-date',
        updatedAt: 'another-invalid-date',
        lastAccessedAt: 'yet-another-invalid-date',
        messages: [{
          ...createTestMessage(),
          timestamp: 'bad-timestamp',
          toolCalls: [{
            ...createTestToolCall(),
            timestamp: 'bad-tool-timestamp'
          }]
        }]
      };

      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${testSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(sessionWithBadDates));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Should handle gracefully and create valid Date objects
      const session = await sessionStore.getSession(testSession.id);
      expect(session).not.toBeNull();
      expect(session!.createdAt).toBeInstanceOf(Date);
      expect(session!.messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('should handle memory constraints with large sessions', async () => {
      // Simulate large session with many messages
      const largeSession = createTestSession({
        name: 'Large Session',
        messages: Array.from({ length: 1000 }, (_, i) =>
          createTestMessage({
            index: i,
            content: `Message ${i}`.repeat(100), // Large content
            toolCalls: [createTestToolCall({ name: `Tool${i}` })]
          })
        )
      });

      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${largeSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(largeSession));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Should handle large sessions without issues
      const retrievedSession = await sessionStore.getSession(largeSession.id);
      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession!.messages).toHaveLength(1000);

      // Test archiving large session
      await sessionStore.archiveSession(largeSession.id);
      expect(mockGzip).toHaveBeenCalled();
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle concurrent session operations', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      // Create multiple sessions concurrently
      const sessionPromises = Array.from({ length: 5 }, (_, i) =>
        sessionStore.createSession(`Concurrent Session ${i}`)
      );

      const sessions = await Promise.all(sessionPromises);

      expect(sessions).toHaveLength(5);
      expect(sessions.map(s => s.name)).toEqual([
        'Concurrent Session 0',
        'Concurrent Session 1',
        'Concurrent Session 2',
        'Concurrent Session 3',
        'Concurrent Session 4'
      ]);

      // All sessions should have unique IDs
      const ids = sessions.map(s => s.id);
      expect(new Set(ids).size).toBe(5);
    });

    it('should batch multiple state updates efficiently', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const session = await sessionStore.createSession('Batch Test');
      const autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: false,
        maxUnsavedMessages: 100
      });

      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${session.id}.json`)) {
          return Promise.resolve(JSON.stringify(session));
        }
        return Promise.reject(new Error('File not found'));
      });

      await autoSaver.start(session.id);

      // Perform multiple rapid updates
      const updatePromises = [
        autoSaver.updateState({ totalCost: 0.1 }),
        autoSaver.updateState({ totalCost: 0.2 }),
        autoSaver.addMessage({ role: 'user', content: 'Message 1' }),
        autoSaver.addMessage({ role: 'user', content: 'Message 2' }),
        autoSaver.updateSessionInfo({ name: 'Updated Name' }),
        autoSaver.addInputToHistory('command 1'),
        autoSaver.addInputToHistory('command 2')
      ];

      await Promise.all(updatePromises);

      expect(autoSaver.getUnsavedChangesCount()).toBe(7);
      expect(autoSaver.getSession()!.state.totalCost).toBe(0.2); // Latest value
      expect(autoSaver.getSession()!.messages).toHaveLength(2);

      // Single save should persist all changes
      await autoSaver.save();
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);
    });

    it('should optimize timer management with option changes', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const session = await sessionStore.createSession('Timer Test');
      const autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 1000
      });

      mockFs.readFile.mockImplementation((path) => {
        if (path.includes(`${session.id}.json`)) {
          return Promise.resolve(JSON.stringify(session));
        }
        return Promise.reject(new Error('File not found'));
      });

      await autoSaver.start(session.id);
      await autoSaver.addMessage({ role: 'user', content: 'test' });

      // Change interval
      autoSaver.updateOptions({ intervalMs: 500 });

      // Timer should restart with new interval
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(mockFs.writeFile).toHaveBeenCalled(); // Auto-save occurred
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      await autoSaver.stop();
    });
  });
});