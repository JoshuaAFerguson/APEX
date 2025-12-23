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
import { SessionStore, Session, SessionMessage, ToolCallRecord, SessionState } from '../services/SessionStore';
import { SessionAutoSaver, AutoSaveOptions } from '../services/SessionAutoSaver';

// Mock dependencies
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
  readFile: vi.fn(),
}));
vi.mock('zlib', () => ({
  promises: {
    gzip: vi.fn(),
    gunzip: vi.fn(),
  },
}));

const mockFs = vi.mocked(fs);
const mockGzip = vi.mocked(zlib.promises.gzip);
const mockGunzip = vi.mocked(zlib.promises.gunzip);

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
        expect.stringContaining('"name": "Integration Test Session"')
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
        expect.stringContaining('"name": "Updated Lifecycle Test"')
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
        if (path.includes(`${testSession.id}.json.gz`)) {
          return Promise.resolve(Buffer.from('compressed'));
        }
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
      expect(mockFs.writeFile).toHaveBeenCalledTimes(3); // Initial session save + active session + index

      // Advance timer
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();

      // Should have saved
      expect(mockFs.writeFile).toHaveBeenCalledTimes(5); // Initial + active + index + auto-save + index
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
      expect(mockFs.writeFile).toHaveBeenCalledTimes(3); // Initial setup + index

      // Add second message - should trigger auto-save
      await testAutoSaver.addMessage({ role: 'user', content: 'Message 2' });

      expect(testAutoSaver.getUnsavedChangesCount()).toBe(0); // Reset after auto-save
      expect(mockFs.writeFile).toHaveBeenCalledTimes(5); // Initial + active + index + auto-save + index
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
      await vi.runOnlyPendingTimersAsync();

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

      expect(mockFs.writeFile).toHaveBeenCalledTimes(5); // Initial + active + index + stop save + index
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
        expect.stringContaining(`${parentSession.id}.json`),
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

    it('should list sessions with comprehensive filtering and sorting', async () => {
      const mockIndex = {
        version: 1,
        sessions: [
          {
            id: 'sess_auth_feature_123',
            name: 'Authentication Feature Implementation',
            messageCount: 10,
            totalCost: 0.5,
            createdAt: new Date('2023-01-01T10:00:00Z'),
            updatedAt: new Date('2023-01-02T10:00:00Z'),
            tags: ['work', 'auth', 'backend'],
            isArchived: false
          },
          {
            id: 'sess_ui_design_456',
            name: 'UI Design Session',
            messageCount: 20,
            totalCost: 1.0,
            createdAt: new Date('2023-01-03T10:00:00Z'),
            updatedAt: new Date('2023-01-04T10:00:00Z'),
            tags: ['personal', 'frontend', 'design'],
            isArchived: true
          },
          {
            id: 'sess_recent_789',
            name: 'Recent Session Work',
            messageCount: 5,
            totalCost: 0.1,
            createdAt: new Date('2023-01-05T10:00:00Z'),
            updatedAt: new Date('2023-01-06T10:00:00Z'),
            tags: ['work', 'testing'],
            isArchived: false
          },
          {
            id: 'sess_archived_old_999',
            name: 'Old Archived Session',
            messageCount: 30,
            totalCost: 2.5,
            createdAt: new Date('2023-01-01T08:00:00Z'),
            updatedAt: new Date('2023-01-01T12:00:00Z'),
            tags: ['legacy', 'cleanup'],
            isArchived: true
          },
          {
            id: 'sess_multi_tag_111',
            name: 'Multi-Tag Session',
            messageCount: 15,
            totalCost: 0.75,
            createdAt: new Date('2023-01-07T10:00:00Z'),
            updatedAt: new Date('2023-01-08T10:00:00Z'),
            tags: ['work', 'frontend', 'backend', 'testing'],
            isArchived: false
          },
          {
            id: 'sess_no_name_222',
            name: undefined,
            messageCount: 3,
            totalCost: 0.05,
            createdAt: new Date('2023-01-09T10:00:00Z'),
            updatedAt: new Date('2023-01-10T10:00:00Z'),
            tags: [],
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

      // Test 1: Default listing (active only, sorted by updatedAt desc)
      const activeSessions = await sessionStore.listSessions();
      expect(activeSessions).toHaveLength(4); // Only non-archived
      expect(activeSessions[0].id).toBe('sess_no_name_222'); // Most recent updatedAt
      expect(activeSessions[1].id).toBe('sess_multi_tag_111');
      expect(activeSessions[2].id).toBe('sess_recent_789');
      expect(activeSessions[3].id).toBe('sess_auth_feature_123');

      // Test 2: Include archived sessions with all=true flag
      const allSessions = await sessionStore.listSessions({ all: true });
      expect(allSessions).toHaveLength(6); // All sessions including archived
      expect(allSessions.some(s => s.isArchived)).toBe(true);
      expect(allSessions[0].id).toBe('sess_no_name_222'); // Still sorted by updatedAt desc

      // Test 3: Search by name (case insensitive)
      const nameSearchResults = await sessionStore.listSessions({ search: 'authentication' });
      expect(nameSearchResults).toHaveLength(1);
      expect(nameSearchResults[0].id).toBe('sess_auth_feature_123');
      expect(nameSearchResults[0].name).toBe('Authentication Feature Implementation');

      // Test 4: Search by name with partial match
      const partialNameSearch = await sessionStore.listSessions({ search: 'session' });
      expect(partialNameSearch).toHaveLength(2); // Recent Session Work, Multi-Tag Session
      expect(partialNameSearch.map(s => s.id).sort()).toEqual([
        'sess_multi_tag_111',
        'sess_recent_789'
      ].sort());

      // Test 5: Search by ID substring
      const idSubstringSearch = await sessionStore.listSessions({ search: 'auth' });
      expect(idSubstringSearch).toHaveLength(1);
      expect(idSubstringSearch[0].id).toBe('sess_auth_feature_123');

      // Test 6: Search by ID with partial match
      const partialIdSearch = await sessionStore.listSessions({ search: 'sess_' });
      expect(partialIdSearch).toHaveLength(4); // All active sessions start with 'sess_'

      // Test 7: Filter by single tag
      const singleTagFilter = await sessionStore.listSessions({ tags: ['work'] });
      expect(singleTagFilter).toHaveLength(3); // auth, recent, multi-tag sessions
      expect(singleTagFilter.every(s => s.tags.includes('work'))).toBe(true);
      expect(singleTagFilter.map(s => s.id).sort()).toEqual([
        'sess_auth_feature_123',
        'sess_multi_tag_111',
        'sess_recent_789'
      ].sort());

      // Test 8: Filter by multiple tags (any match - OR logic)
      const multipleTagFilter = await sessionStore.listSessions({ tags: ['frontend', 'testing'] });
      expect(multipleTagFilter).toHaveLength(2); // multi-tag (has both) and recent (has testing)
      expect(multipleTagFilter.map(s => s.id).sort()).toEqual([
        'sess_multi_tag_111',
        'sess_recent_789'
      ].sort());

      // Test 9: Filter by tags that don't exist
      const nonExistentTagFilter = await sessionStore.listSessions({ tags: ['nonexistent'] });
      expect(nonExistentTagFilter).toHaveLength(0);

      // Test 10: Filter by specific tag combination
      const specificTagFilter = await sessionStore.listSessions({ tags: ['backend'] });
      expect(specificTagFilter).toHaveLength(2); // auth and multi-tag sessions
      expect(specificTagFilter.map(s => s.id).sort()).toEqual([
        'sess_auth_feature_123',
        'sess_multi_tag_111'
      ].sort());

      // Test 11: Pagination with limit
      const limitedSessions = await sessionStore.listSessions({ limit: 2 });
      expect(limitedSessions).toHaveLength(2);
      expect(limitedSessions[0].id).toBe('sess_no_name_222'); // Most recent
      expect(limitedSessions[1].id).toBe('sess_multi_tag_111'); // Second most recent

      // Test 12: Pagination with limit of 1
      const singleSession = await sessionStore.listSessions({ limit: 1 });
      expect(singleSession).toHaveLength(1);
      expect(singleSession[0].id).toBe('sess_no_name_222');

      // Test 13: Limit larger than available sessions
      const largeLimitSessions = await sessionStore.listSessions({ limit: 100 });
      expect(largeLimitSessions).toHaveLength(4); // All active sessions

      // Test 14: Sorting verification - check updatedAt order
      const sortedSessions = await sessionStore.listSessions();
      for (let i = 0; i < sortedSessions.length - 1; i++) {
        const current = new Date(sortedSessions[i].updatedAt).getTime();
        const next = new Date(sortedSessions[i + 1].updatedAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }

      // Test 15: Active vs archived filtering - archived only
      const archivedOnly = allSessions.filter(s => s.isArchived);
      expect(archivedOnly).toHaveLength(2);
      expect(archivedOnly.map(s => s.id).sort()).toEqual([
        'sess_archived_old_999',
        'sess_ui_design_456'
      ].sort());

      // Test 16: Combined search and tag filtering
      const combinedFilter = await sessionStore.listSessions({
        search: 'session',
        tags: ['work']
      });
      expect(combinedFilter).toHaveLength(2); // Recent Session Work and Multi-Tag Session
      expect(combinedFilter.map(s => s.id).sort()).toEqual([
        'sess_multi_tag_111',
        'sess_recent_789'
      ].sort());

      // Test 17: Combined search, tags, and limit
      const complexFilter = await sessionStore.listSessions({
        search: 'session',
        tags: ['work'],
        limit: 1
      });
      expect(complexFilter).toHaveLength(1);
      expect(complexFilter[0].id).toBe('sess_multi_tag_111'); // Most recent matching session

      // Test 18: Search with archived sessions included
      const searchWithArchived = await sessionStore.listSessions({
        search: 'session',
        all: true
      });
      expect(searchWithArchived).toHaveLength(4); // Includes archived UI Design Session
      expect(searchWithArchived.some(s => s.isArchived)).toBe(true);

      // Test 19: Tag filtering with archived sessions included
      const tagFilterWithArchived = await sessionStore.listSessions({
        tags: ['personal'],
        all: true
      });
      expect(tagFilterWithArchived).toHaveLength(1);
      expect(tagFilterWithArchived[0].id).toBe('sess_ui_design_456');
      expect(tagFilterWithArchived[0].isArchived).toBe(true);

      // Test 20: Empty results scenarios
      const emptySearch = await sessionStore.listSessions({ search: 'nonexistentname' });
      expect(emptySearch).toHaveLength(0);

      const emptyTagFilter = await sessionStore.listSessions({ tags: ['nonexistenttag'] });
      expect(emptyTagFilter).toHaveLength(0);

      // Test 21: Case insensitive search verification
      const upperCaseSearch = await sessionStore.listSessions({ search: 'AUTHENTICATION' });
      expect(upperCaseSearch).toHaveLength(1);
      expect(upperCaseSearch[0].id).toBe('sess_auth_feature_123');

      const mixedCaseSearch = await sessionStore.listSessions({ search: 'DeSiGn' });
      expect(mixedCaseSearch).toHaveLength(0);

      // Test 22: Handle sessions with undefined names in search
      const searchWithUndefinedName = await sessionStore.listSessions({ search: 'no_name' });
      expect(searchWithUndefinedName).toHaveLength(1);
      expect(searchWithUndefinedName[0].id).toBe('sess_no_name_222');
    });
  });

  describe('Session Search/Filter/Listing Integration Tests', () => {
    /**
     * Dedicated comprehensive test suite for session search, filtering, and listing functionality.
     * Covers all acceptance criteria with edge cases and boundary conditions.
     */

    beforeEach(() => {
      // Reset mocks for each test
      vi.clearAllMocks();
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{}');
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);
    });

    it('should handle comprehensive search by name scenarios', async () => {
      const mockIndex = {
        version: 1,
        sessions: [
          {
            id: 'sess_exact_match_1',
            name: 'Exact Match Test',
            messageCount: 5,
            totalCost: 0.1,
            createdAt: new Date('2023-01-01T10:00:00Z'),
            updatedAt: new Date('2023-01-01T11:00:00Z'),
            tags: ['test'],
            isArchived: false
          },
          {
            id: 'sess_partial_match_2',
            name: 'Partial Match Example',
            messageCount: 10,
            totalCost: 0.2,
            createdAt: new Date('2023-01-02T10:00:00Z'),
            updatedAt: new Date('2023-01-02T11:00:00Z'),
            tags: ['example'],
            isArchived: false
          },
          {
            id: 'sess_case_insensitive_3',
            name: 'CASE INSENSITIVE TEST',
            messageCount: 8,
            totalCost: 0.15,
            createdAt: new Date('2023-01-03T10:00:00Z'),
            updatedAt: new Date('2023-01-03T11:00:00Z'),
            tags: ['case'],
            isArchived: false
          },
          {
            id: 'sess_special_chars_4',
            name: 'Special-Characters_Test@2023',
            messageCount: 12,
            totalCost: 0.25,
            createdAt: new Date('2023-01-04T10:00:00Z'),
            updatedAt: new Date('2023-01-04T11:00:00Z'),
            tags: ['special'],
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

      // Exact name search
      const exactMatch = await sessionStore.listSessions({ search: 'Exact Match Test' });
      expect(exactMatch).toHaveLength(1);
      expect(exactMatch[0].id).toBe('sess_exact_match_1');

      // Partial name search
      const partialMatch = await sessionStore.listSessions({ search: 'Match' });
      expect(partialMatch).toHaveLength(2);
      expect(partialMatch.map(s => s.id).sort()).toEqual(['sess_exact_match_1', 'sess_partial_match_2']);

      // Case insensitive search
      const caseInsensitive = await sessionStore.listSessions({ search: 'case insensitive' });
      expect(caseInsensitive).toHaveLength(1);
      expect(caseInsensitive[0].id).toBe('sess_case_insensitive_3');

      // Search with special characters
      const specialChars = await sessionStore.listSessions({ search: 'special-characters' });
      expect(specialChars).toHaveLength(1);
      expect(specialChars[0].id).toBe('sess_special_chars_4');

      // Search with numbers
      const numberSearch = await sessionStore.listSessions({ search: '2023' });
      expect(numberSearch).toHaveLength(1);
      expect(numberSearch[0].id).toBe('sess_special_chars_4');

      // Empty search should return all active sessions
      const allSessions = await sessionStore.listSessions({ search: '' });
      expect(allSessions).toHaveLength(4);
    });

    it('should handle comprehensive search by ID substring scenarios', async () => {
      const mockIndex = {
        version: 1,
        sessions: [
          {
            id: 'sess_auth_feature_v1_123',
            name: 'Authentication Feature V1',
            messageCount: 15,
            totalCost: 0.3,
            createdAt: new Date('2023-01-01T10:00:00Z'),
            updatedAt: new Date('2023-01-01T11:00:00Z'),
            tags: ['auth'],
            isArchived: false
          },
          {
            id: 'sess_auth_feature_v2_456',
            name: 'Authentication Feature V2',
            messageCount: 20,
            totalCost: 0.4,
            createdAt: new Date('2023-01-02T10:00:00Z'),
            updatedAt: new Date('2023-01-02T11:00:00Z'),
            tags: ['auth'],
            isArchived: false
          },
          {
            id: 'sess_ui_component_789',
            name: 'UI Component Development',
            messageCount: 10,
            totalCost: 0.2,
            createdAt: new Date('2023-01-03T10:00:00Z'),
            updatedAt: new Date('2023-01-03T11:00:00Z'),
            tags: ['ui'],
            isArchived: false
          },
          {
            id: 'test_different_prefix_999',
            name: 'Different Prefix Session',
            messageCount: 5,
            totalCost: 0.1,
            createdAt: new Date('2023-01-04T10:00:00Z'),
            updatedAt: new Date('2023-01-04T11:00:00Z'),
            tags: ['test'],
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

      // Search by common ID prefix
      const prefixSearch = await sessionStore.listSessions({ search: 'sess_' });
      expect(prefixSearch).toHaveLength(3);
      expect(prefixSearch.map(s => s.id)).toEqual(expect.arrayContaining([
        'sess_auth_feature_v1_123',
        'sess_auth_feature_v2_456',
        'sess_ui_component_789'
      ]));

      // Search by specific ID substring
      const authSearch = await sessionStore.listSessions({ search: 'auth_feature' });
      expect(authSearch).toHaveLength(2);
      expect(authSearch.map(s => s.id)).toEqual(expect.arrayContaining([
        'sess_auth_feature_v1_123',
        'sess_auth_feature_v2_456'
      ]));

      // Search by version number in ID
      const versionSearch = await sessionStore.listSessions({ search: 'v1' });
      expect(versionSearch).toHaveLength(1);
      expect(versionSearch[0].id).toBe('sess_auth_feature_v1_123');

      // Search by numeric suffix
      const numericSearch = await sessionStore.listSessions({ search: '789' });
      expect(numericSearch).toHaveLength(1);
      expect(numericSearch[0].id).toBe('sess_ui_component_789');

      // Search for different prefix pattern
      const differentPrefix = await sessionStore.listSessions({ search: 'test_' });
      expect(differentPrefix).toHaveLength(1);
      expect(differentPrefix[0].id).toBe('test_different_prefix_999');

      // Case insensitive ID search
      const caseInsensitiveId = await sessionStore.listSessions({ search: 'AUTH_FEATURE' });
      expect(caseInsensitiveId).toHaveLength(2);
    });

    it('should handle comprehensive tag filtering scenarios', async () => {
      const mockIndex = {
        version: 1,
        sessions: [
          {
            id: 'sess_single_tag_1',
            name: 'Single Tag Session',
            messageCount: 5,
            totalCost: 0.1,
            createdAt: new Date('2023-01-01T10:00:00Z'),
            updatedAt: new Date('2023-01-01T11:00:00Z'),
            tags: ['frontend'],
            isArchived: false
          },
          {
            id: 'sess_multiple_tags_2',
            name: 'Multiple Tags Session',
            messageCount: 10,
            totalCost: 0.2,
            createdAt: new Date('2023-01-02T10:00:00Z'),
            updatedAt: new Date('2023-01-02T11:00:00Z'),
            tags: ['frontend', 'backend', 'testing'],
            isArchived: false
          },
          {
            id: 'sess_overlapping_tags_3',
            name: 'Overlapping Tags Session',
            messageCount: 8,
            totalCost: 0.15,
            createdAt: new Date('2023-01-03T10:00:00Z'),
            updatedAt: new Date('2023-01-03T11:00:00Z'),
            tags: ['backend', 'database'],
            isArchived: false
          },
          {
            id: 'sess_no_tags_4',
            name: 'No Tags Session',
            messageCount: 3,
            totalCost: 0.05,
            createdAt: new Date('2023-01-04T10:00:00Z'),
            updatedAt: new Date('2023-01-04T11:00:00Z'),
            tags: [],
            isArchived: false
          },
          {
            id: 'sess_special_tag_5',
            name: 'Special Tag Session',
            messageCount: 12,
            totalCost: 0.25,
            createdAt: new Date('2023-01-05T10:00:00Z'),
            updatedAt: new Date('2023-01-05T11:00:00Z'),
            tags: ['special-tag', 'tag_with_underscore', 'TagWithCase'],
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

      // Single tag filter
      const frontendFilter = await sessionStore.listSessions({ tags: ['frontend'] });
      expect(frontendFilter).toHaveLength(2);
      expect(frontendFilter.map(s => s.id)).toEqual(expect.arrayContaining([
        'sess_single_tag_1',
        'sess_multiple_tags_2'
      ]));

      // Multiple tag filter (OR logic - any match)
      const multipleTagFilter = await sessionStore.listSessions({ tags: ['frontend', 'database'] });
      expect(multipleTagFilter).toHaveLength(3);
      expect(multipleTagFilter.map(s => s.id)).toEqual(expect.arrayContaining([
        'sess_single_tag_1',
        'sess_multiple_tags_2',
        'sess_overlapping_tags_3'
      ]));

      // Tag that matches multiple sessions
      const backendFilter = await sessionStore.listSessions({ tags: ['backend'] });
      expect(backendFilter).toHaveLength(2);
      expect(backendFilter.map(s => s.id)).toEqual(expect.arrayContaining([
        'sess_multiple_tags_2',
        'sess_overlapping_tags_3'
      ]));

      // Tag that doesn't exist
      const nonExistentFilter = await sessionStore.listSessions({ tags: ['nonexistent'] });
      expect(nonExistentFilter).toHaveLength(0);

      // Special character tags
      const specialTagFilter = await sessionStore.listSessions({ tags: ['special-tag'] });
      expect(specialTagFilter).toHaveLength(1);
      expect(specialTagFilter[0].id).toBe('sess_special_tag_5');

      // Underscore tag
      const underscoreTagFilter = await sessionStore.listSessions({ tags: ['tag_with_underscore'] });
      expect(underscoreTagFilter).toHaveLength(1);
      expect(underscoreTagFilter[0].id).toBe('sess_special_tag_5');

      // Case sensitive tag matching
      const caseTagFilter = await sessionStore.listSessions({ tags: ['TagWithCase'] });
      expect(caseTagFilter).toHaveLength(1);
      expect(caseTagFilter[0].id).toBe('sess_special_tag_5');

      // Empty tags array should return all sessions
      const emptyTagsFilter = await sessionStore.listSessions({ tags: [] });
      expect(emptyTagsFilter).toHaveLength(5);

      // Multiple specific tags
      const specificMultipleFilter = await sessionStore.listSessions({ tags: ['testing', 'database'] });
      expect(specificMultipleFilter).toHaveLength(2);
      expect(specificMultipleFilter.map(s => s.id)).toEqual(expect.arrayContaining([
        'sess_multiple_tags_2',
        'sess_overlapping_tags_3'
      ]));
    });

    it('should handle comprehensive pagination scenarios', async () => {
      const mockIndex = {
        version: 1,
        sessions: Array.from({ length: 15 }, (_, i) => ({
          id: `sess_pagination_${String(i).padStart(2, '0')}`,
          name: `Pagination Test Session ${i}`,
          messageCount: i + 1,
          totalCost: (i + 1) * 0.1,
          createdAt: new Date(`2023-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
          updatedAt: new Date(`2023-01-${String(i + 1).padStart(2, '0')}T11:00:00Z`),
          tags: [`tag${i % 3}`, `group${Math.floor(i / 5)}`],
          isArchived: i >= 10 // Last 5 are archived
        })),
        lastUpdated: new Date()
      };

      mockFs.readFile.mockImplementation((path) => {
        if (path.includes('index.json')) {
          return Promise.resolve(JSON.stringify(mockIndex));
        }
        return Promise.reject(new Error('File not found'));
      });

      // No limit - should return all active sessions (0-9, since 10-14 are archived)
      const allActive = await sessionStore.listSessions();
      expect(allActive).toHaveLength(10);
      expect(allActive[0].id).toBe('sess_pagination_09'); // Most recent active

      // Limit 1 - should return most recent
      const limit1 = await sessionStore.listSessions({ limit: 1 });
      expect(limit1).toHaveLength(1);
      expect(limit1[0].id).toBe('sess_pagination_09');

      // Limit 5 - should return first 5 most recent
      const limit5 = await sessionStore.listSessions({ limit: 5 });
      expect(limit5).toHaveLength(5);
      expect(limit5.map(s => s.id)).toEqual([
        'sess_pagination_09',
        'sess_pagination_08',
        'sess_pagination_07',
        'sess_pagination_06',
        'sess_pagination_05'
      ]);

      // Limit larger than available - should return all available
      const limit100 = await sessionStore.listSessions({ limit: 100 });
      expect(limit100).toHaveLength(10); // Only 10 active sessions

      // Limit 0 - should return empty array
      const limit0 = await sessionStore.listSessions({ limit: 0 });
      expect(limit0).toHaveLength(0);

      // Limit with archived included
      const limitWithArchived = await sessionStore.listSessions({ limit: 3, all: true });
      expect(limitWithArchived).toHaveLength(3);
      expect(limitWithArchived.map(s => s.id)).toEqual([
        'sess_pagination_14', // Most recent overall
        'sess_pagination_13',
        'sess_pagination_12'
      ]);

      // Limit with search filter
      const limitWithSearch = await sessionStore.listSessions({
        search: 'pagination',
        limit: 2
      });
      expect(limitWithSearch).toHaveLength(2);
      expect(limitWithSearch[0].id).toBe('sess_pagination_09');
      expect(limitWithSearch[1].id).toBe('sess_pagination_08');

      // Limit with tag filter
      const limitWithTags = await sessionStore.listSessions({
        tags: ['tag0'],
        limit: 2
      });
      expect(limitWithTags).toHaveLength(2);
      // Should be the most recent sessions with tag0 (09, 06, 03, 00)
      expect(limitWithTags.map(s => s.id)).toEqual([
        'sess_pagination_09',
        'sess_pagination_06'
      ]);

      // Combined filters with limit
      const combinedWithLimit = await sessionStore.listSessions({
        search: 'test',
        tags: ['group0'],
        limit: 1
      });
      expect(combinedWithLimit).toHaveLength(1);
      expect(combinedWithLimit[0].id).toBe('sess_pagination_04'); // Most recent in group0
    });

    it('should handle comprehensive sorting by updatedAt scenarios', async () => {
      const mockIndex = {
        version: 1,
        sessions: [
          {
            id: 'sess_oldest',
            name: 'Oldest Session',
            messageCount: 5,
            totalCost: 0.1,
            createdAt: new Date('2023-01-01T10:00:00Z'),
            updatedAt: new Date('2023-01-01T10:00:00Z'),
            tags: ['old'],
            isArchived: false
          },
          {
            id: 'sess_newest',
            name: 'Newest Session',
            messageCount: 10,
            totalCost: 0.2,
            createdAt: new Date('2023-01-10T10:00:00Z'),
            updatedAt: new Date('2023-01-10T15:00:00Z'),
            tags: ['new'],
            isArchived: false
          },
          {
            id: 'sess_middle',
            name: 'Middle Session',
            messageCount: 8,
            totalCost: 0.15,
            createdAt: new Date('2023-01-05T10:00:00Z'),
            updatedAt: new Date('2023-01-05T12:00:00Z'),
            tags: ['middle'],
            isArchived: false
          },
          {
            id: 'sess_same_date_1',
            name: 'Same Date Session 1',
            messageCount: 3,
            totalCost: 0.05,
            createdAt: new Date('2023-01-03T10:00:00Z'),
            updatedAt: new Date('2023-01-03T11:00:00Z'),
            tags: ['same'],
            isArchived: false
          },
          {
            id: 'sess_same_date_2',
            name: 'Same Date Session 2',
            messageCount: 4,
            totalCost: 0.06,
            createdAt: new Date('2023-01-03T10:00:00Z'),
            updatedAt: new Date('2023-01-03T11:00:00Z'),
            tags: ['same'],
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

      const sessions = await sessionStore.listSessions();
      expect(sessions).toHaveLength(5);

      // Verify descending order by updatedAt
      expect(sessions[0].id).toBe('sess_newest'); // 2023-01-10T15:00:00Z
      expect(sessions[1].id).toBe('sess_middle'); // 2023-01-05T12:00:00Z
      // Sessions 2 and 3 have same updatedAt, order may vary but both should be present
      expect([sessions[2].id, sessions[3].id]).toEqual(expect.arrayContaining([
        'sess_same_date_1',
        'sess_same_date_2'
      ]));
      expect(sessions[4].id).toBe('sess_oldest'); // 2023-01-01T10:00:00Z

      // Verify sorting is maintained with filters
      const filteredSessions = await sessionStore.listSessions({ tags: ['same'] });
      expect(filteredSessions).toHaveLength(2);
      // Both have same updatedAt, but should be in consistent order
      expect(filteredSessions.map(s => s.id).sort()).toEqual([
        'sess_same_date_1',
        'sess_same_date_2'
      ]);

      // Verify sorting with limit
      const limitedSessions = await sessionStore.listSessions({ limit: 2 });
      expect(limitedSessions).toHaveLength(2);
      expect(limitedSessions[0].id).toBe('sess_newest');
      expect(limitedSessions[1].id).toBe('sess_middle');

      // Manual verification of date ordering
      for (let i = 0; i < sessions.length - 1; i++) {
        const current = new Date(sessions[i].updatedAt).getTime();
        const next = new Date(sessions[i + 1].updatedAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('should handle comprehensive active vs archived filtering scenarios', async () => {
      const mockIndex = {
        version: 1,
        sessions: [
          {
            id: 'sess_active_1',
            name: 'Active Session 1',
            messageCount: 5,
            totalCost: 0.1,
            createdAt: new Date('2023-01-01T10:00:00Z'),
            updatedAt: new Date('2023-01-06T10:00:00Z'),
            tags: ['active'],
            isArchived: false
          },
          {
            id: 'sess_active_2',
            name: 'Active Session 2',
            messageCount: 10,
            totalCost: 0.2,
            createdAt: new Date('2023-01-02T10:00:00Z'),
            updatedAt: new Date('2023-01-05T10:00:00Z'),
            tags: ['active', 'work'],
            isArchived: false
          },
          {
            id: 'sess_archived_1',
            name: 'Archived Session 1',
            messageCount: 15,
            totalCost: 0.3,
            createdAt: new Date('2023-01-03T10:00:00Z'),
            updatedAt: new Date('2023-01-04T10:00:00Z'),
            tags: ['archived'],
            isArchived: true
          },
          {
            id: 'sess_archived_2',
            name: 'Archived Session 2',
            messageCount: 20,
            totalCost: 0.4,
            createdAt: new Date('2023-01-04T10:00:00Z'),
            updatedAt: new Date('2023-01-03T10:00:00Z'),
            tags: ['archived', 'old'],
            isArchived: true
          },
          {
            id: 'sess_active_recent',
            name: 'Active Recent Session',
            messageCount: 8,
            totalCost: 0.15,
            createdAt: new Date('2023-01-07T10:00:00Z'),
            updatedAt: new Date('2023-01-07T12:00:00Z'),
            tags: ['active', 'recent'],
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

      // Default behavior - active only
      const defaultSessions = await sessionStore.listSessions();
      expect(defaultSessions).toHaveLength(3);
      expect(defaultSessions.every(s => !s.isArchived)).toBe(true);
      expect(defaultSessions.map(s => s.id)).toEqual(expect.arrayContaining([
        'sess_active_recent',
        'sess_active_1',
        'sess_active_2'
      ]));

      // Explicit active only
      const activeSessions = await sessionStore.listSessions({ all: false });
      expect(activeSessions).toHaveLength(3);
      expect(activeSessions.every(s => !s.isArchived)).toBe(true);

      // All sessions including archived
      const allSessions = await sessionStore.listSessions({ all: true });
      expect(allSessions).toHaveLength(5);
      expect(allSessions.some(s => s.isArchived)).toBe(true);
      expect(allSessions.filter(s => s.isArchived)).toHaveLength(2);
      expect(allSessions.filter(s => !s.isArchived)).toHaveLength(3);

      // Search with archived included
      const searchWithArchived = await sessionStore.listSessions({
        search: 'archived',
        all: true
      });
      expect(searchWithArchived).toHaveLength(2);
      expect(searchWithArchived.every(s => s.isArchived)).toBe(true);

      // Search without archived (default)
      const searchWithoutArchived = await sessionStore.listSessions({
        search: 'session'
      });
      expect(searchWithoutArchived).toHaveLength(3); // Only active sessions
      expect(searchWithoutArchived.every(s => !s.isArchived)).toBe(true);

      // Tag filter with archived included
      const tagWithArchived = await sessionStore.listSessions({
        tags: ['archived'],
        all: true
      });
      expect(tagWithArchived).toHaveLength(2);
      expect(tagWithArchived.every(s => s.isArchived)).toBe(true);

      // Tag filter without archived
      const tagWithoutArchived = await sessionStore.listSessions({
        tags: ['work']
      });
      expect(tagWithoutArchived).toHaveLength(1);
      expect(tagWithoutArchived[0].id).toBe('sess_active_2');
      expect(tagWithoutArchived[0].isArchived).toBe(false);

      // Combined filters with archived
      const combinedWithArchived = await sessionStore.listSessions({
        search: 'session',
        tags: ['old'],
        all: true
      });
      expect(combinedWithArchived).toHaveLength(1);
      expect(combinedWithArchived[0].id).toBe('sess_archived_2');
      expect(combinedWithArchived[0].isArchived).toBe(true);

      // Limit with archived
      const limitWithArchived = await sessionStore.listSessions({
        limit: 2,
        all: true
      });
      expect(limitWithArchived).toHaveLength(2);
      expect(limitWithArchived[0].id).toBe('sess_active_recent'); // Most recent overall
    });

    it('should handle edge cases and boundary conditions', async () => {
      const mockIndex = {
        version: 1,
        sessions: [],
        lastUpdated: new Date()
      };

      mockFs.readFile.mockImplementation((path) => {
        if (path.includes('index.json')) {
          return Promise.resolve(JSON.stringify(mockIndex));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Empty session list
      const emptySessions = await sessionStore.listSessions();
      expect(emptySessions).toHaveLength(0);

      // Empty list with filters
      const emptyWithFilters = await sessionStore.listSessions({
        search: 'test',
        tags: ['work'],
        limit: 10,
        all: true
      });
      expect(emptyWithFilters).toHaveLength(0);

      // Test with null/undefined index
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const nullIndexSessions = await sessionStore.listSessions();
      expect(nullIndexSessions).toHaveLength(0);
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
      await vi.runOnlyPendingTimersAsync();

      expect(mockFs.writeFile).toHaveBeenCalled(); // Auto-save occurred
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      await autoSaver.stop();
    });
  });
});
