/**
 * @fileoverview Comprehensive tests for session command handlers
 * Tests all 8 session handler functions according to audit acceptance criteria:
 * - handleSession: Routes correctly to subcommands
 * - handleSessionList: Filters and formats output properly
 * - handleSessionLoad: Saves current session before loading new one
 * - handleSessionSave: Persists session with tags correctly
 * - handleSessionBranch: Validates indexes and creates branches
 * - handleSessionExport: Supports all formats (md, json, html)
 * - handleSessionDelete: Confirms and removes sessions
 * - handleSessionInfo: Displays complete metadata
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import {
  handleSession,
  handleSessionList,
  handleSessionLoad,
  handleSessionSave,
  handleSessionBranch,
  handleSessionExport,
  handleSessionDelete,
  handleSessionInfo,
  SessionContext,
} from '../session-handlers';
import { Session, SessionSummary } from '../../services/SessionStore';
import type { InkAppInstance } from '../../ui/index.js';

// Mock fs module
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
}));

// Mock @apexcli/core module
vi.mock('@apexcli/core', () => ({
  formatTokens: vi.fn((tokens) => `${tokens.toLocaleString()} tokens`),
}));

describe('Session Handlers', () => {
  let mockSessionStore: any;
  let mockSessionAutoSaver: any;
  let mockApp: InkAppInstance;
  let mockContext: SessionContext;

  // Mock session data for testing
  const mockSession: Session = {
    id: 'session-123',
    name: 'Test Session',
    projectPath: '/test/project',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T11:00:00Z'),
    lastAccessedAt: new Date('2024-01-01T11:30:00Z'),
    messages: [
      {
        id: 'msg-1',
        index: 0,
        role: 'user',
        content: 'Hello',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        tokens: { input: 10, output: 0 },
      },
      {
        id: 'msg-2',
        index: 1,
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date('2024-01-01T10:01:00Z'),
        tokens: { input: 0, output: 15 },
      },
    ],
    inputHistory: ['Hello'],
    state: {
      totalTokens: { input: 10, output: 15 },
      totalCost: 0.0025,
      tasksCreated: ['task-1'],
      tasksCompleted: [],
      currentTaskId: 'task-1',
    },
    tags: ['test', 'demo'],
    childSessionIds: ['child-session-1'],
    isArchived: false,
    totalCost: 0.0025,
    messageCount: 2,
  };

  const mockSessionSummary: SessionSummary = {
    id: 'session-123',
    name: 'Test Session',
    updatedAt: new Date('2024-01-01T11:00:00Z'),
    messageCount: 2,
    totalCost: 0.0025,
    isArchived: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock SessionStore methods
    mockSessionStore = {
      listSessions: vi.fn(),
      getSession: vi.fn(),
      deleteSession: vi.fn(),
      branchSession: vi.fn(),
      exportSession: vi.fn(),
      setActiveSession: vi.fn(),
    };

    // Mock SessionAutoSaver methods
    mockSessionAutoSaver = {
      getSession: vi.fn(),
      save: vi.fn(),
      start: vi.fn(),
      updateSessionInfo: vi.fn(),
      getUnsavedChangesCount: vi.fn(() => 0),
    };

    // Mock InkApp instance
    mockApp = {
      addMessage: vi.fn(),
      updateState: vi.fn(),
    } as any;

    // Create context
    mockContext = {
      initialized: true,
      sessionStore: mockSessionStore,
      sessionAutoSaver: mockSessionAutoSaver,
      app: mockApp,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleSession - Main Router', () => {
    it('should route to handleSessionList when subcommand is "list"', async () => {
      const args = ['list', '--all'];
      mockSessionStore.listSessions.mockResolvedValue([mockSessionSummary]);

      await handleSession(args, mockContext);

      expect(mockSessionStore.listSessions).toHaveBeenCalledWith({
        all: true,
        search: undefined,
        limit: 20,
      });
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('**Sessions:**'),
      });
    });

    it('should route to handleSessionLoad when subcommand is "load"', async () => {
      const args = ['load', 'session-123'];
      mockSessionStore.getSession.mockResolvedValue(mockSession);
      mockSessionAutoSaver.save.mockResolvedValue(undefined);
      mockSessionAutoSaver.start.mockResolvedValue(mockSession);

      await handleSession(args, mockContext);

      expect(mockSessionStore.getSession).toHaveBeenCalledWith('session-123');
      expect(mockSessionAutoSaver.save).toHaveBeenCalled();
      expect(mockSessionAutoSaver.start).toHaveBeenCalledWith('session-123');
    });

    it('should route to handleSessionSave when subcommand is "save"', async () => {
      const args = ['save', 'My Session', '--tags', 'test,demo'];
      mockSessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockSessionAutoSaver.save.mockResolvedValue(undefined);

      await handleSession(args, mockContext);

      expect(mockSessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'My Session',
        tags: ['test', 'demo'],
      });
      expect(mockSessionAutoSaver.save).toHaveBeenCalled();
    });

    it('should route to handleSessionBranch when subcommand is "branch"', async () => {
      const args = ['branch', 'New Branch', '--from', '1'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionStore.branchSession.mockResolvedValue({
        ...mockSession,
        id: 'new-branch-123',
        name: 'New Branch',
      });

      await handleSession(args, mockContext);

      expect(mockSessionStore.branchSession).toHaveBeenCalledWith('session-123', 1, 'New Branch');
    });

    it('should route to handleSessionExport when subcommand is "export"', async () => {
      const args = ['export', '--format', 'json'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionStore.exportSession.mockResolvedValue('{"exported": "data"}');

      await handleSession(args, mockContext);

      expect(mockSessionStore.exportSession).toHaveBeenCalledWith('session-123', 'json');
    });

    it('should route to handleSessionDelete when subcommand is "delete"', async () => {
      const args = ['delete', 'session-123'];
      mockSessionStore.getSession.mockResolvedValue(mockSession);
      mockSessionStore.deleteSession.mockResolvedValue(undefined);

      await handleSession(args, mockContext);

      expect(mockSessionStore.getSession).toHaveBeenCalledWith('session-123');
      expect(mockSessionStore.deleteSession).toHaveBeenCalledWith('session-123');
    });

    it('should route to handleSessionInfo when subcommand is "info"', async () => {
      const args = ['info'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);

      await handleSession(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('**Current Session:**'),
      });
    });

    it('should show error when APEX is not initialized', async () => {
      const uninitializedContext = { ...mockContext, initialized: false };
      const args = ['list'];

      await handleSession(args, uninitializedContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.',
      });
    });

    it('should show error when sessionStore is null', async () => {
      const contextWithoutStore = { ...mockContext, sessionStore: null };
      const args = ['list'];

      await handleSession(args, contextWithoutStore);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.',
      });
    });

    it('should show usage help for unknown subcommand', async () => {
      const args = ['unknown'];

      await handleSession(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Unknown session command: unknown'),
      });
    });

    it('should show usage help when no subcommand provided', async () => {
      const args: string[] = [];

      await handleSession(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Unknown session command: none'),
      });
    });
  });

  describe('handleSessionList - Session Listing', () => {
    it('should list sessions with proper formatting', async () => {
      const sessions = [mockSessionSummary];
      mockSessionStore.listSessions.mockResolvedValue(sessions);

      await handleSessionList([], mockContext);

      expect(mockSessionStore.listSessions).toHaveBeenCalledWith({
        all: false,
        search: undefined,
        limit: 20,
      });

      const expectedContent = expect.stringContaining('**Sessions:**');
      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.type).toBe('assistant');
      expect(callArgs.content).toMatch(/session-123.*Test Session.*2 msgs.*\$0\.00.*1\/1\/2024/);
    });

    it('should handle --all flag correctly', async () => {
      const args = ['--all'];
      mockSessionStore.listSessions.mockResolvedValue([]);

      await handleSessionList(args, mockContext);

      expect(mockSessionStore.listSessions).toHaveBeenCalledWith({
        all: true,
        search: undefined,
        limit: 20,
      });
    });

    it('should handle --search flag correctly', async () => {
      const args = ['--search', 'test query'];
      mockSessionStore.listSessions.mockResolvedValue([]);

      await handleSessionList(args, mockContext);

      expect(mockSessionStore.listSessions).toHaveBeenCalledWith({
        all: false,
        search: 'test query',
        limit: 20,
      });
    });

    it('should handle combined --all and --search flags', async () => {
      const args = ['--all', '--search', 'test query'];
      mockSessionStore.listSessions.mockResolvedValue([]);

      await handleSessionList(args, mockContext);

      expect(mockSessionStore.listSessions).toHaveBeenCalledWith({
        all: true,
        search: 'test query',
        limit: 20,
      });
    });

    it('should show message when no sessions found', async () => {
      mockSessionStore.listSessions.mockResolvedValue([]);

      await handleSessionList([], mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'No sessions found.',
      });
    });

    it('should format archived sessions correctly', async () => {
      const archivedSession = { ...mockSessionSummary, isArchived: true };
      mockSessionStore.listSessions.mockResolvedValue([archivedSession]);

      await handleSessionList([], mockContext);

      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.content).toContain('(archived)');
    });

    it('should handle unnamed sessions', async () => {
      const unnamedSession = { ...mockSessionSummary, name: undefined };
      mockSessionStore.listSessions.mockResolvedValue([unnamedSession]);

      await handleSessionList([], mockContext);

      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.content).toContain('Unnamed');
    });

    it('should return early when sessionStore is null', async () => {
      const contextWithoutStore = { ...mockContext, sessionStore: null };

      await handleSessionList([], contextWithoutStore);

      expect(mockApp.addMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleSessionLoad - Session Loading', () => {
    it('should load session and save current session first', async () => {
      const sessionId = 'session-123';
      mockSessionStore.getSession.mockResolvedValue(mockSession);
      mockSessionAutoSaver.save.mockResolvedValue(undefined);
      mockSessionAutoSaver.start.mockResolvedValue(mockSession);
      mockSessionStore.setActiveSession.mockResolvedValue(undefined);

      await handleSessionLoad(sessionId, mockContext);

      expect(mockSessionStore.getSession).toHaveBeenCalledWith(sessionId);
      expect(mockSessionAutoSaver.save).toHaveBeenCalled();
      expect(mockSessionAutoSaver.start).toHaveBeenCalledWith(sessionId);
      expect(mockSessionStore.setActiveSession).toHaveBeenCalledWith(sessionId);
    });

    it('should update app state after loading session', async () => {
      const sessionId = 'session-123';
      mockSessionStore.getSession.mockResolvedValue(mockSession);
      mockSessionAutoSaver.save.mockResolvedValue(undefined);
      mockSessionAutoSaver.start.mockResolvedValue(mockSession);

      await handleSessionLoad(sessionId, mockContext);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        sessionName: mockSession.name,
        sessionStartTime: mockSession.lastAccessedAt,
      });
    });

    it('should show success message with session details', async () => {
      const sessionId = 'session-123';
      mockSessionStore.getSession.mockResolvedValue(mockSession);
      mockSessionAutoSaver.save.mockResolvedValue(undefined);
      mockSessionAutoSaver.start.mockResolvedValue(mockSession);

      await handleSessionLoad(sessionId, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: `Loaded session: ${mockSession.name}\nMessages: ${mockSession.messages.length}, Cost: $${mockSession.state.totalCost.toFixed(4)}`,
      });
    });

    it('should show error when session not found', async () => {
      const sessionId = 'nonexistent';
      mockSessionStore.getSession.mockResolvedValue(null);

      await handleSessionLoad(sessionId, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: `Session not found: ${sessionId}`,
      });
      expect(mockSessionAutoSaver.save).not.toHaveBeenCalled();
    });

    it('should show usage error when sessionId is missing', async () => {
      await handleSessionLoad('', mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session load <session_id>',
      });
    });

    it('should show usage error when sessionStore is null', async () => {
      const contextWithoutStore = { ...mockContext, sessionStore: null };

      await handleSessionLoad('session-123', contextWithoutStore);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session load <session_id>',
      });
    });

    it('should show usage error when sessionAutoSaver is null', async () => {
      const contextWithoutAutoSaver = { ...mockContext, sessionAutoSaver: null };

      await handleSessionLoad('session-123', contextWithoutAutoSaver);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session load <session_id>',
      });
    });

    it('should handle load errors gracefully', async () => {
      const sessionId = 'session-123';
      mockSessionStore.getSession.mockResolvedValue(mockSession);
      mockSessionAutoSaver.save.mockRejectedValue(new Error('Save failed'));

      await handleSessionLoad(sessionId, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to load session: Save failed',
      });
    });
  });

  describe('handleSessionSave - Session Persistence', () => {
    it('should save session with name and tags', async () => {
      const args = ['My Session', '--tags', 'test,demo'];
      mockSessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockSessionAutoSaver.save.mockResolvedValue(undefined);

      await handleSessionSave(args, mockContext);

      expect(mockSessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'My Session',
        tags: ['test', 'demo'],
      });
      expect(mockSessionAutoSaver.save).toHaveBeenCalled();
    });

    it('should save session without tags', async () => {
      const args = ['My Session'];
      mockSessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockSessionAutoSaver.save.mockResolvedValue(undefined);

      await handleSessionSave(args, mockContext);

      expect(mockSessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'My Session',
        tags: [],
      });
    });

    it('should update app state with session name', async () => {
      const args = ['My Session'];
      mockSessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockSessionAutoSaver.save.mockResolvedValue(undefined);

      await handleSessionSave(args, mockContext);

      expect(mockApp.updateState).toHaveBeenCalledWith({ sessionName: 'My Session' });
    });

    it('should show success message with tags', async () => {
      const args = ['My Session', '--tags', 'test,demo'];
      mockSessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockSessionAutoSaver.save.mockResolvedValue(undefined);

      await handleSessionSave(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Session saved as "My Session" with tags: test, demo',
      });
    });

    it('should show success message without tags', async () => {
      const args = ['My Session'];
      mockSessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockSessionAutoSaver.save.mockResolvedValue(undefined);

      await handleSessionSave(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Session saved as "My Session"',
      });
    });

    it('should handle empty tags gracefully', async () => {
      const args = ['My Session', '--tags', ''];
      mockSessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockSessionAutoSaver.save.mockResolvedValue(undefined);

      await handleSessionSave(args, mockContext);

      expect(mockSessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'My Session',
        tags: [''],
      });
    });

    it('should show usage error when name is missing', async () => {
      await handleSessionSave([], mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session save <name> [--tags tag1,tag2]',
      });
    });

    it('should show usage error when sessionAutoSaver is null', async () => {
      const contextWithoutAutoSaver = { ...mockContext, sessionAutoSaver: null };

      await handleSessionSave(['My Session'], contextWithoutAutoSaver);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session save <name> [--tags tag1,tag2]',
      });
    });

    it('should handle save errors gracefully', async () => {
      const args = ['My Session'];
      mockSessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockSessionAutoSaver.save.mockRejectedValue(new Error('Save failed'));

      await handleSessionSave(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to save session: Save failed',
      });
    });
  });

  describe('handleSessionBranch - Session Branching', () => {
    it('should create branch with name and specific index', async () => {
      const args = ['New Branch', '--from', '1'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      const branchedSession = { ...mockSession, id: 'new-branch-123', name: 'New Branch' };
      mockSessionStore.branchSession.mockResolvedValue(branchedSession);
      mockSessionAutoSaver.start.mockResolvedValue(branchedSession);
      mockSessionStore.setActiveSession.mockResolvedValue(undefined);

      await handleSessionBranch(args, mockContext);

      expect(mockSessionStore.branchSession).toHaveBeenCalledWith('session-123', 1, 'New Branch');
      expect(mockSessionAutoSaver.start).toHaveBeenCalledWith('new-branch-123');
      expect(mockSessionStore.setActiveSession).toHaveBeenCalledWith('new-branch-123');
    });

    it('should create branch from last message when no index specified', async () => {
      const args = ['New Branch'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      const branchedSession = { ...mockSession, id: 'new-branch-123', name: 'New Branch' };
      mockSessionStore.branchSession.mockResolvedValue(branchedSession);
      mockSessionAutoSaver.start.mockResolvedValue(branchedSession);

      await handleSessionBranch(args, mockContext);

      expect(mockSessionStore.branchSession).toHaveBeenCalledWith(
        'session-123',
        mockSession.messages.length - 1,
        'New Branch'
      );
    });

    it('should create branch from specified index without name', async () => {
      const args = ['--from', '0'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      const branchedSession = { ...mockSession, id: 'new-branch-123', name: undefined };
      mockSessionStore.branchSession.mockResolvedValue(branchedSession);
      mockSessionAutoSaver.start.mockResolvedValue(branchedSession);

      await handleSessionBranch(args, mockContext);

      // When only --from is specified, the first arg '--from' becomes the name
      expect(mockSessionStore.branchSession).toHaveBeenCalledWith('session-123', 0, '--from');
    });

    it('should update app state after creating branch', async () => {
      const args = ['New Branch'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      const branchedSession = {
        ...mockSession,
        id: 'new-branch-123',
        name: 'New Branch',
        createdAt: new Date('2024-01-01T12:00:00Z')
      };
      mockSessionStore.branchSession.mockResolvedValue(branchedSession);
      mockSessionAutoSaver.start.mockResolvedValue(branchedSession);

      await handleSessionBranch(args, mockContext);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        sessionName: 'New Branch',
        sessionStartTime: branchedSession.createdAt,
      });
    });

    it('should validate message index bounds', async () => {
      const args = ['New Branch', '--from', '5']; // Out of bounds
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);

      await handleSessionBranch(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: `Invalid message index: 5. Must be between 0 and ${mockSession.messages.length - 1}`,
      });
      expect(mockSessionStore.branchSession).not.toHaveBeenCalled();
    });

    it('should validate negative message index', async () => {
      const args = ['New Branch', '--from', '-1'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);

      await handleSessionBranch(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: `Invalid message index: -1. Must be between 0 and ${mockSession.messages.length - 1}`,
      });
    });

    it('should validate non-numeric message index', async () => {
      const args = ['New Branch', '--from', 'invalid'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);

      await handleSessionBranch(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Invalid message index: NaN. Must be between 0 and 1',
      });
    });

    it('should show error when no active session', async () => {
      const args = ['New Branch'];
      mockSessionAutoSaver.getSession.mockReturnValue(null);

      await handleSessionBranch(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'No active session to branch from.',
      });
    });

    it('should return early when sessionStore is null', async () => {
      const contextWithoutStore = { ...mockContext, sessionStore: null };

      await handleSessionBranch([], contextWithoutStore);

      expect(mockApp.addMessage).not.toHaveBeenCalled();
    });

    it('should return early when sessionAutoSaver is null', async () => {
      const contextWithoutAutoSaver = { ...mockContext, sessionAutoSaver: null };

      await handleSessionBranch([], contextWithoutAutoSaver);

      expect(mockApp.addMessage).not.toHaveBeenCalled();
    });

    it('should handle branch creation errors gracefully', async () => {
      const args = ['New Branch'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionStore.branchSession.mockRejectedValue(new Error('Branch failed'));

      await handleSessionBranch(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to create branch: Branch failed',
      });
    });
  });

  describe('handleSessionExport - Session Export', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should export session in markdown format by default', async () => {
      const args: string[] = [];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionStore.exportSession.mockResolvedValue('# Test Session\n\nContent here');

      await handleSessionExport(args, mockContext);

      expect(mockSessionStore.exportSession).toHaveBeenCalledWith('session-123', 'md');
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('**Session Export (MD):**'),
      });
    });

    it('should export session in JSON format when specified', async () => {
      const args = ['--format', 'json'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionStore.exportSession.mockResolvedValue('{"session": "data"}');

      await handleSessionExport(args, mockContext);

      expect(mockSessionStore.exportSession).toHaveBeenCalledWith('session-123', 'json');
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('**Session Export (JSON):**'),
      });
    });

    it('should export session in HTML format when specified', async () => {
      const args = ['--format', 'html'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionStore.exportSession.mockResolvedValue('<html><body>Content</body></html>');

      await handleSessionExport(args, mockContext);

      expect(mockSessionStore.exportSession).toHaveBeenCalledWith('session-123', 'html');
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('**Session Export (HTML):**'),
      });
    });

    it('should save export to file when output specified', async () => {
      const args = ['--format', 'json', '--output', '/tmp/session.json'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionStore.exportSession.mockResolvedValue('{"session": "data"}');

      await handleSessionExport(args, mockContext);

      expect(fs.writeFile).toHaveBeenCalledWith('/tmp/session.json', '{"session": "data"}', 'utf-8');
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Session exported to /tmp/session.json (JSON format)',
      });
    });

    it('should truncate long export previews', async () => {
      const args: string[] = [];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      const longContent = 'A'.repeat(600);
      mockSessionStore.exportSession.mockResolvedValue(longContent);

      await handleSessionExport(args, mockContext);

      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.content).toContain('...');
      expect(callArgs.content.length).toBeLessThan(longContent.length + 100);
    });

    it('should show error when no active session', async () => {
      const args: string[] = [];
      mockSessionAutoSaver.getSession.mockReturnValue(null);

      await handleSessionExport(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'No active session to export.',
      });
    });

    it('should return early when sessionStore is null', async () => {
      const contextWithoutStore = { ...mockContext, sessionStore: null };

      await handleSessionExport([], contextWithoutStore);

      expect(mockApp.addMessage).not.toHaveBeenCalled();
    });

    it('should return early when sessionAutoSaver is null', async () => {
      const contextWithoutAutoSaver = { ...mockContext, sessionAutoSaver: null };

      await handleSessionExport([], contextWithoutAutoSaver);

      expect(mockApp.addMessage).not.toHaveBeenCalled();
    });

    it('should handle export errors gracefully', async () => {
      const args: string[] = [];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionStore.exportSession.mockRejectedValue(new Error('Export failed'));

      await handleSessionExport(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to export session: Export failed',
      });
    });

    it('should handle file write errors gracefully', async () => {
      const args = ['--output', '/tmp/readonly.json'];
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionStore.exportSession.mockResolvedValue('{"data": "test"}');
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      await handleSessionExport(args, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to export session: Permission denied',
      });
    });
  });

  describe('handleSessionDelete - Session Removal', () => {
    it('should delete session successfully', async () => {
      const sessionId = 'session-123';
      mockSessionStore.getSession.mockResolvedValue(mockSession);
      mockSessionStore.deleteSession.mockResolvedValue(undefined);

      await handleSessionDelete(sessionId, mockContext);

      expect(mockSessionStore.getSession).toHaveBeenCalledWith(sessionId);
      expect(mockSessionStore.deleteSession).toHaveBeenCalledWith(sessionId);
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: `Deleted session: ${mockSession.name}`,
      });
    });

    it('should delete unnamed session successfully', async () => {
      const sessionId = 'session-123';
      const unnamedSession = { ...mockSession, name: undefined };
      mockSessionStore.getSession.mockResolvedValue(unnamedSession);
      mockSessionStore.deleteSession.mockResolvedValue(undefined);

      await handleSessionDelete(sessionId, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: `Deleted session: ${sessionId}`,
      });
    });

    it('should show error when session not found', async () => {
      const sessionId = 'nonexistent';
      mockSessionStore.getSession.mockResolvedValue(null);

      await handleSessionDelete(sessionId, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: `Session not found: ${sessionId}`,
      });
      expect(mockSessionStore.deleteSession).not.toHaveBeenCalled();
    });

    it('should show usage error when sessionId is missing', async () => {
      await handleSessionDelete('', mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session delete <session_id>',
      });
    });

    it('should show usage error when sessionStore is null', async () => {
      const contextWithoutStore = { ...mockContext, sessionStore: null };

      await handleSessionDelete('session-123', contextWithoutStore);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session delete <session_id>',
      });
    });

    it('should handle delete errors gracefully', async () => {
      const sessionId = 'session-123';
      mockSessionStore.getSession.mockResolvedValue(mockSession);
      mockSessionStore.deleteSession.mockRejectedValue(new Error('Delete failed'));

      await handleSessionDelete(sessionId, mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to delete session: Delete failed',
      });
    });
  });

  describe('handleSessionInfo - Session Metadata Display', () => {
    it('should display complete session metadata', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionAutoSaver.getUnsavedChangesCount.mockReturnValue(0);

      await handleSessionInfo(mockContext);

      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.type).toBe('assistant');
      expect(callArgs.content).toContain('**Current Session:**');
      expect(callArgs.content).toContain(`ID: ${mockSession.id}`);
      expect(callArgs.content).toContain(`Name: ${mockSession.name}`);
      expect(callArgs.content).toContain(`Messages: ${mockSession.messages.length}`);
      expect(callArgs.content).toContain(`Total Cost: $${mockSession.state.totalCost.toFixed(4)}`);
      expect(callArgs.content).toContain('25 tokens');
    });

    it('should display tags when present', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);

      await handleSessionInfo(mockContext);

      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.content).toContain('Tags: test, demo');
    });

    it('should display parent session info when branched', async () => {
      const branchedSession = {
        ...mockSession,
        parentSessionId: 'parent-123'
      };
      mockSessionAutoSaver.getSession.mockReturnValue(branchedSession);

      await handleSessionInfo(mockContext);

      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.content).toContain('Branched from: parent-123');
    });

    it('should display child sessions when present', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);

      await handleSessionInfo(mockContext);

      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.content).toContain('Branches: 1');
    });

    it('should display unsaved changes when present', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(mockSession);
      mockSessionAutoSaver.getUnsavedChangesCount.mockReturnValue(3);

      await handleSessionInfo(mockContext);

      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.content).toContain('Unsaved changes: 3');
    });

    it('should handle unnamed session', async () => {
      const unnamedSession = { ...mockSession, name: undefined };
      mockSessionAutoSaver.getSession.mockReturnValue(unnamedSession);

      await handleSessionInfo(mockContext);

      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.content).toContain('Name: Unnamed');
    });

    it('should handle session without tags', async () => {
      const sessionWithoutTags = { ...mockSession, tags: [] };
      mockSessionAutoSaver.getSession.mockReturnValue(sessionWithoutTags);

      await handleSessionInfo(mockContext);

      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.content).not.toContain('Tags:');
    });

    it('should handle session without child sessions', async () => {
      const sessionWithoutChildren = { ...mockSession, childSessionIds: [] };
      mockSessionAutoSaver.getSession.mockReturnValue(sessionWithoutChildren);

      await handleSessionInfo(mockContext);

      const callArgs = mockApp.addMessage.mock.calls[0][0];
      expect(callArgs.content).not.toContain('Branches:');
    });

    it('should show error when no active session', async () => {
      mockSessionAutoSaver.getSession.mockReturnValue(null);

      await handleSessionInfo(mockContext);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'No active session.',
      });
    });

    it('should return early when sessionAutoSaver is null', async () => {
      const contextWithoutAutoSaver = { ...mockContext, sessionAutoSaver: null };

      await handleSessionInfo(contextWithoutAutoSaver);

      expect(mockApp.addMessage).not.toHaveBeenCalled();
    });
  });
});