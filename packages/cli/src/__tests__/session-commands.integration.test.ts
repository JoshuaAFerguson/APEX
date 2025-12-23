/**
 * Session Command Integration Tests
 *
 * Comprehensive integration tests for all session commands to verify end-to-end functionality
 * Tests the session command handlers in isolation from the full REPL, following established patterns.
 *
 * Acceptance Criteria Covered:
 * 1. Session create command via SessionAutoSaver.start()
 * 2. Session load command (with save before switch)
 * 3. Session save command with name and tags
 * 4. Session branch command (from specific index, auto-naming)
 * 5. Session export command (md/json/html formats)
 * 6. Session delete command
 * 7. Session info command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { Session, SessionSummary } from '../services/SessionStore.js';
import {
  handleSession,
  handleSessionList,
  handleSessionLoad,
  handleSessionSave,
  handleSessionBranch,
  handleSessionExport,
  handleSessionDelete,
  handleSessionInfo,
  type SessionContext,
} from '../handlers/session-handlers.js';

// Mock dependencies
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
}));

const mockFs = vi.mocked(fs);

// Test data factories - reusing patterns from session-management.integration.test.ts
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

const createTestSessionSummary = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Session',
  messageCount: 0,
  totalCost: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [],
  isArchived: false,
  ...overrides,
});

// Mock context and dependencies
const createMockContext = () => {
  const mockApp = {
    addMessage: vi.fn(),
    updateState: vi.fn(),
    getState: vi.fn(),
    waitUntilExit: vi.fn(),
    unmount: vi.fn(),
  };

  const mockSessionStore = {
    initialize: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    listSessions: vi.fn(),
    branchSession: vi.fn(),
    exportSession: vi.fn(),
    setActiveSession: vi.fn(),
    getActiveSessionId: vi.fn(),
    archiveSession: vi.fn(),
  };

  const mockSessionAutoSaver = {
    start: vi.fn(),
    stop: vi.fn(),
    save: vi.fn(),
    getSession: vi.fn(),
    updateSessionInfo: vi.fn(),
    addMessage: vi.fn(),
    updateState: vi.fn(),
    getUnsavedChangesCount: vi.fn(),
    hasUnsavedChanges: vi.fn(),
    addInputToHistory: vi.fn(),
    updateOptions: vi.fn(),
  };

  return {
    cwd: '/test/project',
    initialized: true,
    config: { api: { url: 'http://localhost:3000' } },
    orchestrator: null,
    apiProcess: null,
    webUIProcess: null,
    apiPort: 3000,
    webUIPort: 3001,
    app: mockApp,
    sessionStore: mockSessionStore,
    sessionAutoSaver: mockSessionAutoSaver,
    conversationManager: null,
  };
};

// Import the handlers we need to test - we'll extract these as named exports
// For now, we'll test by importing the full functions and mocking the context

describe('Session Command Integration Tests', () => {
  let mockCtx: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockContext();

    // Setup default mock implementations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('{}');
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Session List Command', () => {
    it('should list sessions with default options', async () => {
      const testSessions = [
        createTestSessionSummary({ id: 'sess_1', name: 'Session 1', messageCount: 5 }),
        createTestSessionSummary({ id: 'sess_2', name: 'Session 2', messageCount: 10 }),
      ];

      mockCtx.sessionStore.listSessions.mockResolvedValue(testSessions);

      // Import and call the handler function
      const { handleSessionList } = await import('../handlers/session-handlers.js');
      await handleSessionList([], mockCtx);

      // Verify correct service call
      expect(mockCtx.sessionStore.listSessions).toHaveBeenCalledWith({
        all: false,
        search: undefined,
        limit: 20
      });

      // Verify UI was updated
      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('**Sessions:**')
      });

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('sess_1')
      });
    });

    it('should include archived sessions with --all flag', async () => {
      const testSessions = [
        createTestSessionSummary({ id: 'sess_1', isArchived: false }),
        createTestSessionSummary({ id: 'sess_2', isArchived: true }),
      ];

      mockCtx.sessionStore.listSessions.mockResolvedValue(testSessions);

      const { handleSessionList } = await import('../handlers/session-handlers.js');
      await handleSessionList(['--all'], mockCtx);

      expect(mockCtx.sessionStore.listSessions).toHaveBeenCalledWith({
        all: true,
        search: undefined,
        limit: 20
      });
    });

    it('should filter sessions with --search query', async () => {
      const testSessions = [
        createTestSessionSummary({ id: 'sess_1', name: 'Authentication Work' }),
      ];

      mockCtx.sessionStore.listSessions.mockResolvedValue(testSessions);

      const { handleSessionList } = await import('../handlers/session-handlers.js');
      await handleSessionList(['--search', 'auth'], mockCtx);

      expect(mockCtx.sessionStore.listSessions).toHaveBeenCalledWith({
        all: false,
        search: 'auth',
        limit: 20
      });
    });

    it('should handle empty session list gracefully', async () => {
      mockCtx.sessionStore.listSessions.mockResolvedValue([]);

      const { handleSessionList } = await import('../handlers/session-handlers.js');
      await handleSessionList([], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'No sessions found.'
      });
    });
  });

  describe('Session Load Command', () => {
    it('should load existing session by ID', async () => {
      const testSession = createTestSession({
        id: 'test-session-123',
        name: 'My Session',
        messages: [
          { id: 'msg1', index: 0, role: 'user', content: 'Hello', timestamp: new Date() }
        ],
        state: { totalCost: 0.25, totalTokens: { input: 100, output: 150 }, tasksCreated: [], tasksCompleted: [] }
      });

      mockCtx.sessionStore.getSession.mockResolvedValue(testSession);
      mockCtx.sessionAutoSaver.save.mockResolvedValue(undefined);
      mockCtx.sessionAutoSaver.start.mockResolvedValue(testSession);

      const { handleSessionLoad } = await import('../handlers/session-handlers.js');
      await handleSessionLoad('test-session-123', mockCtx);

      // Verify session loaded
      expect(mockCtx.sessionStore.getSession).toHaveBeenCalledWith('test-session-123');

      // Verify current session saved before switch
      expect(mockCtx.sessionAutoSaver.save).toHaveBeenCalled();

      // Verify new session started
      expect(mockCtx.sessionAutoSaver.start).toHaveBeenCalledWith('test-session-123');

      // Verify active session updated
      expect(mockCtx.sessionStore.setActiveSession).toHaveBeenCalledWith('test-session-123');

      // Verify UI updated
      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: expect.stringContaining('Loaded session: My Session')
      });

      expect(mockCtx.app.updateState).toHaveBeenCalledWith({
        sessionName: 'My Session',
        sessionStartTime: testSession.lastAccessedAt,
      });
    });

    it('should save current session before switching', async () => {
      const testSession = createTestSession({ id: 'new-session' });

      mockCtx.sessionStore.getSession.mockResolvedValue(testSession);
      mockCtx.sessionAutoSaver.save.mockResolvedValue(undefined);
      mockCtx.sessionAutoSaver.start.mockResolvedValue(testSession);

      const { handleSessionLoad } = await import('../handlers/session-handlers.js');
      await handleSessionLoad('new-session', mockCtx);

      expect(mockCtx.sessionAutoSaver.save).toHaveBeenCalledBefore(mockCtx.sessionAutoSaver.start);
    });

    it('should display error for non-existent session', async () => {
      mockCtx.sessionStore.getSession.mockResolvedValue(null);

      const { handleSessionLoad } = await import('../handlers/session-handlers.js');
      await handleSessionLoad('non-existent', mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session not found: non-existent'
      });
    });

    it('should show usage error when session ID missing', async () => {
      const { handleSessionLoad } = await import('../handlers/session-handlers.js');
      await handleSessionLoad('', mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session load <session_id>'
      });
    });

    it('should handle service errors gracefully', async () => {
      mockCtx.sessionStore.getSession.mockRejectedValue(new Error('Database error'));

      const { handleSessionLoad } = await import('../handlers/session-handlers.js');
      await handleSessionLoad('test-session', mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to load session: Database error'
      });
    });
  });

  describe('Session Save Command', () => {
    it('should save session with provided name', async () => {
      mockCtx.sessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockCtx.sessionAutoSaver.save.mockResolvedValue(undefined);

      const { handleSessionSave } = await import('../handlers/session-handlers.js');
      await handleSessionSave(['My New Session'], mockCtx);

      expect(mockCtx.sessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'My New Session',
        tags: []
      });
      expect(mockCtx.sessionAutoSaver.save).toHaveBeenCalled();

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Session saved as "My New Session"'
      });

      expect(mockCtx.app.updateState).toHaveBeenCalledWith({
        sessionName: 'My New Session'
      });
    });

    it('should save session with name and tags', async () => {
      mockCtx.sessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockCtx.sessionAutoSaver.save.mockResolvedValue(undefined);

      const { handleSessionSave } = await import('../handlers/session-handlers.js');
      await handleSessionSave(['Work Session', '--tags', 'work,auth,backend'], mockCtx);

      expect(mockCtx.sessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'Work Session',
        tags: ['work', 'auth', 'backend']
      });

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Session saved as "Work Session" with tags: work, auth, backend'
      });
    });

    it('should show usage error when name missing', async () => {
      const { handleSessionSave } = await import('../handlers/session-handlers.js');
      await handleSessionSave([], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session save <name> [--tags tag1,tag2]'
      });
    });

    it('should handle save errors gracefully', async () => {
      mockCtx.sessionAutoSaver.updateSessionInfo.mockRejectedValue(new Error('Save failed'));

      const { handleSessionSave } = await import('../handlers/session-handlers.js');
      await handleSessionSave(['Test Session'], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to save session: Save failed'
      });
    });
  });

  describe('Session Branch Command', () => {
    it('should create branch from last message by default', async () => {
      const currentSession = createTestSession({
        id: 'parent-session',
        messages: [
          { id: 'msg1', index: 0, role: 'user', content: 'Message 1', timestamp: new Date() },
          { id: 'msg2', index: 1, role: 'assistant', content: 'Response 1', timestamp: new Date() },
          { id: 'msg3', index: 2, role: 'user', content: 'Message 2', timestamp: new Date() }
        ]
      });

      const branchedSession = createTestSession({
        id: 'branch-session',
        name: 'Test Branch',
        parentSessionId: 'parent-session',
        branchPoint: 2
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(currentSession);
      mockCtx.sessionStore.branchSession.mockResolvedValue(branchedSession);
      mockCtx.sessionAutoSaver.start.mockResolvedValue(branchedSession);

      const { handleSessionBranch } = await import('../handlers/session-handlers.js');
      await handleSessionBranch(['Test Branch'], mockCtx);

      expect(mockCtx.sessionStore.branchSession).toHaveBeenCalledWith(
        'parent-session',
        2, // Last message index
        'Test Branch'
      );

      expect(mockCtx.sessionAutoSaver.start).toHaveBeenCalledWith('branch-session');
      expect(mockCtx.sessionStore.setActiveSession).toHaveBeenCalledWith('branch-session');

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: expect.stringContaining('Created and switched to branch: Test Branch')
      });

      expect(mockCtx.app.updateState).toHaveBeenCalledWith({
        sessionName: 'Test Branch',
        sessionStartTime: branchedSession.createdAt
      });
    });

    it('should create branch from specific message index with --from', async () => {
      const currentSession = createTestSession({
        id: 'parent-session',
        messages: new Array(5).fill(null).map((_, i) => ({
          id: `msg${i}`, index: i, role: 'user', content: `Message ${i}`, timestamp: new Date()
        }))
      });

      const branchedSession = createTestSession({
        id: 'branch-session',
        name: 'Mid Branch',
        branchPoint: 2
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(currentSession);
      mockCtx.sessionStore.branchSession.mockResolvedValue(branchedSession);

      const { handleSessionBranch } = await import('../handlers/session-handlers.js');
      await handleSessionBranch(['Mid Branch', '--from', '2'], mockCtx);

      expect(mockCtx.sessionStore.branchSession).toHaveBeenCalledWith(
        'parent-session',
        2,
        'Mid Branch'
      );
    });

    it('should auto-name branch when name not provided', async () => {
      const currentSession = createTestSession({
        id: 'parent-session',
        messages: [
          { id: 'msg1', index: 0, role: 'user', content: 'Hello', timestamp: new Date() }
        ]
      });

      const branchedSession = createTestSession({
        id: 'branch-session',
        name: undefined // Auto-named
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(currentSession);
      mockCtx.sessionStore.branchSession.mockResolvedValue(branchedSession);

      const { handleSessionBranch } = await import('../handlers/session-handlers.js');
      await handleSessionBranch([], mockCtx); // No name provided

      expect(mockCtx.sessionStore.branchSession).toHaveBeenCalledWith(
        'parent-session',
        0,
        undefined
      );
    });

    it('should validate message index bounds', async () => {
      const currentSession = createTestSession({
        id: 'parent-session',
        messages: [
          { id: 'msg1', index: 0, role: 'user', content: 'Hello', timestamp: new Date() }
        ]
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(currentSession);

      const { handleSessionBranch } = await import('../handlers/session-handlers.js');
      await handleSessionBranch(['Test Branch', '--from', '5'], mockCtx); // Index out of bounds

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Invalid message index: 5. Must be between 0 and 0'
      });
    });

    it('should handle missing active session', async () => {
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(null);

      const { handleSessionBranch } = await import('../handlers/session-handlers.js');
      await handleSessionBranch(['Test Branch'], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'No active session to branch from.'
      });
    });
  });

  describe('Session Export Command', () => {
    const testSession = createTestSession({
      id: 'export-session',
      name: 'Export Test Session',
      messages: [
        { id: 'msg1', index: 0, role: 'user', content: 'Hello', timestamp: new Date() },
        { id: 'msg2', index: 1, role: 'assistant', content: 'Hi there!', timestamp: new Date() }
      ]
    });

    beforeEach(() => {
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(testSession);
    });

    it('should export to markdown by default', async () => {
      const markdownContent = '# APEX Session: Export Test Session\n\n**User**: Hello\n\n**Assistant**: Hi there!';
      mockCtx.sessionStore.exportSession.mockResolvedValue(markdownContent);

      const { handleSessionExport } = await import('../handlers/session-handlers.js');
      await handleSessionExport([], mockCtx);

      expect(mockCtx.sessionStore.exportSession).toHaveBeenCalledWith('export-session', 'md');

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('**Session Export (MD):**')
      });
    });

    it('should export to JSON with --format json', async () => {
      const jsonContent = JSON.stringify(testSession, null, 2);
      mockCtx.sessionStore.exportSession.mockResolvedValue(jsonContent);

      const { handleSessionExport } = await import('../handlers/session-handlers.js');
      await handleSessionExport(['--format', 'json'], mockCtx);

      expect(mockCtx.sessionStore.exportSession).toHaveBeenCalledWith('export-session', 'json');
    });

    it('should export to HTML with --format html', async () => {
      const htmlContent = '<!DOCTYPE html><html><head><title>Export Test Session</title></head><body>...</body></html>';
      mockCtx.sessionStore.exportSession.mockResolvedValue(htmlContent);

      const { handleSessionExport } = await import('../handlers/session-handlers.js');
      await handleSessionExport(['--format', 'html'], mockCtx);

      expect(mockCtx.sessionStore.exportSession).toHaveBeenCalledWith('export-session', 'html');
    });

    it('should write to file with --output option', async () => {
      const exportContent = 'Export content';
      mockCtx.sessionStore.exportSession.mockResolvedValue(exportContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const { handleSessionExport } = await import('../handlers/session-handlers.js');
      await handleSessionExport(['--output', '/tmp/session.md'], mockCtx);

      expect(mockFs.writeFile).toHaveBeenCalledWith('/tmp/session.md', exportContent, 'utf-8');

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Session exported to /tmp/session.md (MD format)'
      });
    });

    it('should preview content when no output file specified', async () => {
      const shortContent = 'Short export content';
      mockCtx.sessionStore.exportSession.mockResolvedValue(shortContent);

      const { handleSessionExport } = await import('../handlers/session-handlers.js');
      await handleSessionExport([], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining(shortContent)
      });
    });

    it('should handle missing active session', async () => {
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(null);

      const { handleSessionExport } = await import('../handlers/session-handlers.js');
      await handleSessionExport([], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'No active session to export.'
      });
    });

    it('should handle export errors gracefully', async () => {
      mockCtx.sessionStore.exportSession.mockRejectedValue(new Error('Export failed'));

      const { handleSessionExport } = await import('../handlers/session-handlers.js');
      await handleSessionExport([], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to export session: Export failed'
      });
    });
  });

  describe('Session Delete Command', () => {
    it('should delete existing session', async () => {
      const testSession = createTestSession({
        id: 'delete-session-123',
        name: 'Session to Delete'
      });

      mockCtx.sessionStore.getSession.mockResolvedValue(testSession);
      mockCtx.sessionStore.deleteSession.mockResolvedValue(undefined);

      const { handleSessionDelete } = await import('../handlers/session-handlers.js');
      await handleSessionDelete('delete-session-123', mockCtx);

      expect(mockCtx.sessionStore.getSession).toHaveBeenCalledWith('delete-session-123');
      expect(mockCtx.sessionStore.deleteSession).toHaveBeenCalledWith('delete-session-123');

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Deleted session: Session to Delete'
      });
    });

    it('should display error for non-existent session', async () => {
      mockCtx.sessionStore.getSession.mockResolvedValue(null);

      const { handleSessionDelete } = await import('../handlers/session-handlers.js');
      await handleSessionDelete('non-existent', mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session not found: non-existent'
      });
    });

    it('should show usage error when session ID missing', async () => {
      const { handleSessionDelete } = await import('../handlers/session-handlers.js');
      await handleSessionDelete('', mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session delete <session_id>'
      });
    });

    it('should handle delete errors gracefully', async () => {
      const testSession = createTestSession({ id: 'test-session' });
      mockCtx.sessionStore.getSession.mockResolvedValue(testSession);
      mockCtx.sessionStore.deleteSession.mockRejectedValue(new Error('Delete failed'));

      const { handleSessionDelete } = await import('../handlers/session-handlers.js');
      await handleSessionDelete('test-session', mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to delete session: Delete failed'
      });
    });
  });

  describe('Session Info Command', () => {
    it('should display current session details', async () => {
      const testSession = createTestSession({
        id: 'info-session-123',
        name: 'My Current Session',
        messages: new Array(10).fill(null).map((_, i) => ({
          id: `msg${i}`, index: i, role: 'user', content: `Message ${i}`, timestamp: new Date()
        })),
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-02T15:30:00Z'),
        state: {
          totalCost: 1.25,
          totalTokens: { input: 500, output: 750 },
          tasksCreated: ['task1', 'task2'],
          tasksCompleted: ['task1']
        },
        tags: [],
        parentSessionId: undefined,
        childSessionIds: []
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(testSession);
      mockCtx.sessionAutoSaver.getUnsavedChangesCount.mockReturnValue(0);

      const { handleSessionInfo } = await import('../handlers/session-handlers.js');
      await handleSessionInfo(mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('**Current Session:**')
      });

      const messageContent = mockCtx.app.addMessage.mock.calls[0][0].content;
      expect(messageContent).toContain('ID: info-session-123');
      expect(messageContent).toContain('Name: My Current Session');
      expect(messageContent).toContain('Messages: 10');
      expect(messageContent).toContain('Total Cost: $1.2500');
    });

    it('should show tags when present', async () => {
      const testSession = createTestSession({
        tags: ['work', 'important', 'auth']
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(testSession);
      mockCtx.sessionAutoSaver.getUnsavedChangesCount.mockReturnValue(0);

      const { handleSessionInfo } = await import('../handlers/session-handlers.js');
      await handleSessionInfo(mockCtx);

      const messageContent = mockCtx.app.addMessage.mock.calls[0][0].content;
      expect(messageContent).toContain('Tags: work, important, auth');
    });

    it('should show parent session info for branches', async () => {
      const testSession = createTestSession({
        parentSessionId: 'parent-session-456',
        branchPoint: 5
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(testSession);
      mockCtx.sessionAutoSaver.getUnsavedChangesCount.mockReturnValue(0);

      const { handleSessionInfo } = await import('../handlers/session-handlers.js');
      await handleSessionInfo(mockCtx);

      const messageContent = mockCtx.app.addMessage.mock.calls[0][0].content;
      expect(messageContent).toContain('Branched from: parent-session-456');
    });

    it('should show child branch count', async () => {
      const testSession = createTestSession({
        childSessionIds: ['branch1', 'branch2', 'branch3']
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(testSession);
      mockCtx.sessionAutoSaver.getUnsavedChangesCount.mockReturnValue(0);

      const { handleSessionInfo } = await import('../handlers/session-handlers.js');
      await handleSessionInfo(mockCtx);

      const messageContent = mockCtx.app.addMessage.mock.calls[0][0].content;
      expect(messageContent).toContain('Branches: 3');
    });

    it('should show unsaved changes count', async () => {
      const testSession = createTestSession({});

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(testSession);
      mockCtx.sessionAutoSaver.getUnsavedChangesCount.mockReturnValue(5);

      const { handleSessionInfo } = await import('../handlers/session-handlers.js');
      await handleSessionInfo(mockCtx);

      const messageContent = mockCtx.app.addMessage.mock.calls[0][0].content;
      expect(messageContent).toContain('Unsaved changes: 5');
    });

    it('should handle missing active session', async () => {
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(null);

      const { handleSessionInfo } = await import('../handlers/session-handlers.js');
      await handleSessionInfo(mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'No active session.'
      });
    });
  });

  describe('Session Main Dispatcher', () => {
    it('should route to correct subcommand handler', async () => {
      // We'll test the dispatcher by importing and calling the main handleSession function
      const { handleSession } = await import('../handlers/session-handlers.js');

      // Mock listSessions for this test
      mockCtx.sessionStore.listSessions.mockResolvedValue([]);

      await handleSession(['list'], mockCtx);

      expect(mockCtx.sessionStore.listSessions).toHaveBeenCalled();
    });

    it('should show usage for unknown subcommand', async () => {
      const { handleSession } = await import('../handlers/session-handlers.js');

      await handleSession(['unknown'], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Unknown session command: unknown')
      });
    });

    it('should require APEX initialization', async () => {
      const uninitializedCtx = {
        ...mockCtx,
        initialized: false,
        sessionStore: null
      };

      const { handleSession } = await import('../handlers/session-handlers.js');

      await handleSession(['list'], uninitializedCtx);

      expect(uninitializedCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.'
      });
    });

    it('should show usage when no subcommand provided', async () => {
      const { handleSession } = await import('../handlers/session-handlers.js');

      await handleSession([], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Unknown session command: none')
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle service unavailability gracefully', async () => {
      const failingCtx = {
        ...mockCtx,
        sessionStore: null,
        sessionAutoSaver: null
      };

      const { handleSession } = await import('../handlers/session-handlers.js');

      await handleSession(['info'], failingCtx);

      expect(failingCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.'
      });
    });

    it('should handle async operation failures', async () => {
      mockCtx.sessionStore.listSessions.mockRejectedValue(new Error('Database connection failed'));

      const { handleSessionList } = await import('../handlers/session-handlers.js');

      // The function should handle the error gracefully
      await expect(handleSessionList([], mockCtx)).rejects.toThrow('Database connection failed');
    });
  });
});
