/**
 * Tests for session handlers - handles session management commands
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
} from '../session-handlers.js';
import type { Session, SessionSummary } from '../../services/SessionStore.js';

describe('session-handlers', () => {
  let mockApp: any;
  let mockSessionStore: any;
  let mockSessionAutoSaver: any;
  let mockCtx: SessionContext;
  let addMessageSpy: ReturnType<typeof vi.fn>;

  const mockSessionSummary: SessionSummary = {
    id: 'session_12345',
    name: 'Test Session',
    messageCount: 15,
    totalCost: 2.50,
    updatedAt: '2024-01-01T12:00:00Z',
    isArchived: false,
  };

  const mockSession: Session = {
    id: 'session_12345',
    name: 'Test Session',
    messages: [
      {
        id: 'msg_1',
        type: 'user',
        content: 'Hello',
        timestamp: new Date('2024-01-01T12:00:00Z'),
      },
      {
        id: 'msg_2',
        type: 'assistant',
        content: 'Hi there!',
        timestamp: new Date('2024-01-01T12:01:00Z'),
      },
    ],
    totalCost: 2.50,
    totalTokens: 1000,
    settings: {},
    tags: ['test'],
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T12:00:00Z'),
    isArchived: false,
  };

  beforeEach(() => {
    addMessageSpy = vi.fn();

    mockApp = {
      addMessage: addMessageSpy,
      setState: vi.fn(),
      getState: vi.fn().mockReturnValue({}),
    };

    mockSessionStore = {
      listSessions: vi.fn(),
      getSession: vi.fn(),
      deleteSession: vi.fn(),
      branchSession: vi.fn(),
      exportSession: vi.fn(),
      setActiveSession: vi.fn(),
    };

    mockSessionAutoSaver = {
      getSession: vi.fn(),
      save: vi.fn(),
      start: vi.fn(),
      updateSessionInfo: vi.fn(),
      getUnsavedChangesCount: vi.fn().mockReturnValue(0),
    };

    mockCtx = {
      initialized: true,
      sessionStore: mockSessionStore,
      sessionAutoSaver: mockSessionAutoSaver,
      app: mockApp,
    };

    vi.clearAllMocks();
  });

  describe('handleSession', () => {
    it('should handle uninitialized context', async () => {
      const uninitializedCtx = { ...mockCtx, initialized: false };

      await handleSession(['list'], uninitializedCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.',
      });
    });

    it('should handle missing session store', async () => {
      const ctxWithoutStore = { ...mockCtx, sessionStore: null };

      await handleSession(['list'], ctxWithoutStore);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.',
      });
    });

    it('should route to session list command', async () => {
      mockSessionStore.listSessions.mockResolvedValue([mockSessionSummary]);

      await handleSession(['list'], mockCtx);

      expect(mockSessionStore.listSessions).toHaveBeenCalled();
    });

    it('should route to session load command', async () => {
      mockSessionStore.getSession.mockResolvedValue(mockSession);
      mockSessionAutoSaver.getSession.mockReturnValue(null);

      await handleSession(['load', 'session_12345'], mockCtx);

      expect(mockSessionStore.getSession).toHaveBeenCalledWith('session_12345');
    });

    it('should show usage for unknown commands', async () => {
      await handleSession(['unknown'], mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Unknown session command: unknown'),
      });
      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Usage:'),
      });
    });

    it('should show usage for empty command', async () => {
      await handleSession([], mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Unknown session command: none'),
      });
    });
  });

  describe('handleSessionList', () => {
    it('should list sessions without flags', async () => {
      mockSessionStore.listSessions.mockResolvedValue([mockSessionSummary]);

      await handleSessionList([], mockCtx);

      expect(mockSessionStore.listSessions).toHaveBeenCalledWith({
        all: false,
        search: undefined,
        limit: 20,
      });
      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('**Sessions:**'),
      });
    });

    it('should handle --all flag', async () => {
      mockSessionStore.listSessions.mockResolvedValue([mockSessionSummary]);

      await handleSessionList(['--all'], mockCtx);

      expect(mockSessionStore.listSessions).toHaveBeenCalledWith({
        all: true,
        search: undefined,
        limit: 20,
      });
    });

    it('should handle --search flag', async () => {
      mockSessionStore.listSessions.mockResolvedValue([mockSessionSummary]);

      await handleSessionList(['--search', 'test query'], mockCtx);

      expect(mockSessionStore.listSessions).toHaveBeenCalledWith({
        all: false,
        search: 'test query',
        limit: 20,
      });
    });

    it('should handle no sessions found', async () => {
      mockSessionStore.listSessions.mockResolvedValue([]);

      await handleSessionList([], mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'system',
        content: 'No sessions found.',
      });
    });

    it('should format session information correctly', async () => {
      const archivedSession: SessionSummary = {
        ...mockSessionSummary,
        name: 'Archived Session',
        isArchived: true,
      };
      mockSessionStore.listSessions.mockResolvedValue([mockSessionSummary, archivedSession]);

      await handleSessionList([], mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringMatching(/session_123.*Test Session.*15 msgs.*\$2\.50/),
      });
      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('(archived)'),
      });
    });

    it('should handle missing session store', async () => {
      const ctxWithoutStore = { ...mockCtx, sessionStore: null };

      await handleSessionList([], ctxWithoutStore);

      // Should return early without error
      expect(addMessageSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleSessionLoad', () => {
    it('should load a session successfully', async () => {
      mockSessionStore.getSession.mockResolvedValue(mockSession);
      mockSessionAutoSaver.getSession.mockReturnValue(null);

      await handleSessionLoad('session_12345', mockCtx);

      expect(mockSessionAutoSaver.save).toHaveBeenCalled();
      expect(mockSessionStore.setActiveSession).toHaveBeenCalledWith('session_12345');
      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'system',
        content: expect.stringContaining('Session loaded: Test Session'),
      });
    });

    it('should handle session not found', async () => {
      mockSessionStore.getSession.mockResolvedValue(null);

      await handleSessionLoad('nonexistent', mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session not found: nonexistent',
      });
    });

    it('should handle missing session ID', async () => {
      await handleSessionLoad('', mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session load <session_id>',
      });
    });

    it('should handle missing dependencies', async () => {
      const ctxWithoutAutoSaver = { ...mockCtx, sessionAutoSaver: null };

      await handleSessionLoad('session_12345', ctxWithoutAutoSaver);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session load <session_id>',
      });
    });

    it('should handle errors during load', async () => {
      mockSessionStore.getSession.mockRejectedValue(new Error('Database error'));

      await handleSessionLoad('session_12345', mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Failed to load session: Database error'),
      });
    });
  });

  describe('handleSessionSave', () => {
    it('should save session with custom name', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);

      await handleSessionSave(['Custom Name'], mockCtx);

      expect(mockSessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'Custom Name',
      });
      expect(mockSessionAutoSaver.save).toHaveBeenCalled();
      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'system',
        content: expect.stringContaining('Session saved: Custom Name'),
      });
    });

    it('should save session with tags', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);

      await handleSessionSave(['Session Name', '--tags', 'tag1,tag2'], mockCtx);

      expect(mockSessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'Session Name',
        tags: ['tag1', 'tag2'],
      });
    });

    it('should handle no active session', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(null);

      await handleSessionSave(['Name'], mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'No active session to save. Start a conversation first.',
      });
    });

    it('should handle missing dependencies', async () => {
      const ctxWithoutAutoSaver = { ...mockCtx, sessionAutoSaver: null };

      await handleSessionSave(['Name'], ctxWithoutAutoSaver);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session functionality not available.',
      });
    });

    it('should handle save errors', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionAutoSaver.save.mockRejectedValue(new Error('Save failed'));

      await handleSessionSave(['Name'], mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Failed to save session: Save failed'),
      });
    });
  });

  describe('handleSessionBranch', () => {
    it('should branch session from index', async () => {
      const branchedSession = { ...mockSession, id: 'session_67890', name: 'Branched Session' };
      mockSessionStore.branchSession.mockResolvedValue(branchedSession);

      await handleSessionBranch(['Branched Session', '--from', '5'], mockCtx);

      expect(mockSessionStore.branchSession).toHaveBeenCalledWith(
        undefined, // sessionId
        5, // fromIndex
        'Branched Session' // name
      );
      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'system',
        content: expect.stringContaining('Session branched: Branched Session'),
      });
    });

    it('should handle missing dependencies', async () => {
      const ctxWithoutStore = { ...mockCtx, sessionStore: null };

      await handleSessionBranch(['Name'], ctxWithoutStore);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session functionality not available.',
      });
    });

    it('should handle branch errors', async () => {
      mockSessionStore.branchSession.mockRejectedValue(new Error('Branch failed'));

      await handleSessionBranch(['Name'], mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Failed to branch session: Branch failed'),
      });
    });
  });

  describe('handleSessionExport', () => {
    it('should export session in markdown format', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionStore.exportSession.mockResolvedValue('# Session Export\n\nContent here');

      await handleSessionExport(['--format', 'md'], mockCtx);

      expect(mockSessionStore.exportSession).toHaveBeenCalledWith('session_12345', 'md');
      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('# Session Export'),
      });
    });

    it('should handle no active session', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(null);

      await handleSessionExport([], mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'No active session to export.',
      });
    });

    it('should handle missing dependencies', async () => {
      const ctxWithoutAutoSaver = { ...mockCtx, sessionAutoSaver: null };

      await handleSessionExport([], ctxWithoutAutoSaver);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session functionality not available.',
      });
    });
  });

  describe('handleSessionDelete', () => {
    it('should delete a session', async () => {
      mockSessionStore.getSession.mockResolvedValue(mockSession);

      await handleSessionDelete('session_12345', mockCtx);

      expect(mockSessionStore.deleteSession).toHaveBeenCalledWith('session_12345');
      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'system',
        content: expect.stringContaining('Session deleted: Test Session'),
      });
    });

    it('should handle session not found', async () => {
      mockSessionStore.getSession.mockResolvedValue(null);

      await handleSessionDelete('nonexistent', mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session not found: nonexistent',
      });
    });

    it('should handle missing session ID', async () => {
      await handleSessionDelete('', mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session delete <session_id>',
      });
    });

    it('should handle missing dependencies', async () => {
      const ctxWithoutStore = { ...mockCtx, sessionStore: null };

      await handleSessionDelete('session_12345', ctxWithoutStore);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session functionality not available.',
      });
    });
  });

  describe('handleSessionInfo', () => {
    it('should display current session info', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionAutoSaver.getUnsavedChangesCount.mockReturnValue(3);

      await handleSessionInfo(mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringMatching(/Current Session.*Test Session.*2 messages.*\$2\.50/s),
      });
      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('3 unsaved changes'),
      });
    });

    it('should handle no active session', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(null);

      await handleSessionInfo(mockCtx);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'system',
        content: 'No active session.',
      });
    });

    it('should handle missing dependencies', async () => {
      const ctxWithoutAutoSaver = { ...mockCtx, sessionAutoSaver: null };

      await handleSessionInfo(ctxWithoutAutoSaver);

      expect(addMessageSpy).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session functionality not available.',
      });
    });
  });
});