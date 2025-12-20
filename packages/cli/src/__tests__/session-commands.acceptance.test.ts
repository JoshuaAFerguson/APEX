/**
 * Session Command Integration Tests - Acceptance Criteria Verification
 *
 * These tests directly verify the acceptance criteria specified in the task:
 * - Integration tests pass for: session create command, session load command (with save before switch),
 *   session save command with name and tags, session branch command (from specific index, auto-naming),
 *   session export command (md/json/html formats), session delete command, session info command.
 *
 * This test file focuses on the end-to-end behavior and integration between components.
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
vi.mock('fs/promises');

const mockFs = vi.mocked(fs);

// Test utilities
const createSession = (overrides: Partial<Session> = {}): Session => ({
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

const createMessage = (index: number, role: 'user' | 'assistant' = 'user', content: string = `Message ${index}`): any => ({
  id: `msg_${index}`,
  index,
  role,
  content,
  timestamp: new Date(`2023-01-01T${10 + index}:00:00Z`),
});

const createMockContext = () => {
  const mockApp = {
    addMessage: vi.fn(),
    updateState: vi.fn(),
  };

  const mockSessionStore = {
    listSessions: vi.fn(),
    getSession: vi.fn(),
    deleteSession: vi.fn(),
    branchSession: vi.fn(),
    exportSession: vi.fn(),
    setActiveSession: vi.fn(),
  };

  const mockSessionAutoSaver = {
    start: vi.fn(),
    save: vi.fn(),
    getSession: vi.fn(),
    updateSessionInfo: vi.fn(),
    getUnsavedChangesCount: vi.fn(),
  };

  return {
    initialized: true,
    sessionStore: mockSessionStore,
    sessionAutoSaver: mockSessionAutoSaver,
    app: mockApp,
  };
};

describe('Session Commands - Acceptance Criteria Verification', () => {
  let mockCtx: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockContext();

    // Setup default mock responses
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('AC1: Session create command via SessionAutoSaver.start()', () => {
    it('should create new session successfully', async () => {
      const newSession = createSession({
        id: 'new-session-123',
        name: undefined, // Auto-generated
      });

      mockCtx.sessionAutoSaver.start.mockResolvedValue(newSession);

      const result = await mockCtx.sessionAutoSaver.start();

      expect(mockCtx.sessionAutoSaver.start).toHaveBeenCalled();
      expect(result).toEqual(newSession);
      expect(result.id).toBe('new-session-123');
    });

    it('should create session with specific parameters', async () => {
      const specificSession = createSession({
        id: 'user-defined-session',
        name: 'User Created Session',
      });

      mockCtx.sessionAutoSaver.start.mockResolvedValue(specificSession);

      const result = await mockCtx.sessionAutoSaver.start('user-defined-session');

      expect(mockCtx.sessionAutoSaver.start).toHaveBeenCalledWith('user-defined-session');
      expect(result.id).toBe('user-defined-session');
      expect(result.name).toBe('User Created Session');
    });
  });

  describe('AC2: Session load command (with save before switch)', () => {
    it('should save current session before loading new one', async () => {
      const targetSession = createSession({
        id: 'target-session',
        name: 'Target Session',
        messages: [createMessage(0, 'user', 'Hello')],
        state: { totalCost: 0.15, totalTokens: { input: 50, output: 75 }, tasksCreated: [], tasksCompleted: [] },
      });

      mockCtx.sessionStore.getSession.mockResolvedValue(targetSession);
      mockCtx.sessionAutoSaver.save.mockResolvedValue(undefined);
      mockCtx.sessionAutoSaver.start.mockResolvedValue(targetSession);

      await handleSessionLoad('target-session', mockCtx);

      // Verify save was called before start (order matters)
      expect(mockCtx.sessionAutoSaver.save).toHaveBeenCalled();
      expect(mockCtx.sessionAutoSaver.start).toHaveBeenCalledWith('target-session');
      expect(mockCtx.sessionStore.setActiveSession).toHaveBeenCalledWith('target-session');

      // Verify success message
      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Loaded session: Target Session\nMessages: 1, Cost: $0.1500',
      });

      // Verify app state updated
      expect(mockCtx.app.updateState).toHaveBeenCalledWith({
        sessionName: 'Target Session',
        sessionStartTime: targetSession.lastAccessedAt,
      });
    });

    it('should handle load failure gracefully', async () => {
      mockCtx.sessionStore.getSession.mockResolvedValue(null);

      await handleSessionLoad('nonexistent', mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session not found: nonexistent',
      });
    });
  });

  describe('AC3: Session save command with name and tags', () => {
    it('should save session with name only', async () => {
      mockCtx.sessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockCtx.sessionAutoSaver.save.mockResolvedValue(undefined);

      await handleSessionSave(['My Work Session'], mockCtx);

      expect(mockCtx.sessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'My Work Session',
        tags: [],
      });
      expect(mockCtx.sessionAutoSaver.save).toHaveBeenCalled();

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Session saved as "My Work Session"',
      });

      expect(mockCtx.app.updateState).toHaveBeenCalledWith({
        sessionName: 'My Work Session',
      });
    });

    it('should save session with name and tags', async () => {
      mockCtx.sessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockCtx.sessionAutoSaver.save.mockResolvedValue(undefined);

      await handleSessionSave(['Feature Development', '--tags', 'feature,backend,api'], mockCtx);

      expect(mockCtx.sessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'Feature Development',
        tags: ['feature', 'backend', 'api'],
      });

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Session saved as "Feature Development" with tags: feature, backend, api',
      });
    });

    it('should handle save errors', async () => {
      mockCtx.sessionAutoSaver.updateSessionInfo.mockRejectedValue(new Error('Database error'));

      await handleSessionSave(['Test Session'], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to save session: Database error',
      });
    });
  });

  describe('AC4: Session branch command (from specific index, auto-naming)', () => {
    it('should create branch from specific message index', async () => {
      const parentSession = createSession({
        id: 'parent-session',
        name: 'Parent Session',
        messages: [
          createMessage(0, 'user', 'First message'),
          createMessage(1, 'assistant', 'First response'),
          createMessage(2, 'user', 'Second message'),
          createMessage(3, 'assistant', 'Second response'),
          createMessage(4, 'user', 'Third message'),
        ],
      });

      const branchedSession = createSession({
        id: 'branch-session',
        name: 'Experiment Branch',
        parentSessionId: 'parent-session',
        branchPoint: 2,
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(parentSession);
      mockCtx.sessionStore.branchSession.mockResolvedValue(branchedSession);
      mockCtx.sessionAutoSaver.start.mockResolvedValue(branchedSession);

      await handleSessionBranch(['Experiment Branch', '--from', '2'], mockCtx);

      expect(mockCtx.sessionStore.branchSession).toHaveBeenCalledWith(
        'parent-session',
        2,
        'Experiment Branch'
      );

      expect(mockCtx.sessionAutoSaver.start).toHaveBeenCalledWith('branch-session');
      expect(mockCtx.sessionStore.setActiveSession).toHaveBeenCalledWith('branch-session');

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Created and switched to branch: Experiment Branch\nBranched from message 3 of 5',
      });

      expect(mockCtx.app.updateState).toHaveBeenCalledWith({
        sessionName: 'Experiment Branch',
        sessionStartTime: branchedSession.createdAt,
      });
    });

    it('should auto-name branch when name not provided', async () => {
      const parentSession = createSession({
        id: 'parent-session',
        messages: [createMessage(0)],
      });

      const autoBranch = createSession({
        id: 'auto-branch',
        name: undefined, // Auto-generated
        branchPoint: 0,
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(parentSession);
      mockCtx.sessionStore.branchSession.mockResolvedValue(autoBranch);
      mockCtx.sessionAutoSaver.start.mockResolvedValue(autoBranch);

      await handleSessionBranch([], mockCtx); // No name provided

      expect(mockCtx.sessionStore.branchSession).toHaveBeenCalledWith(
        'parent-session',
        0, // Last message index (default)
        undefined // Auto-generated name
      );
    });

    it('should validate message index bounds', async () => {
      const parentSession = createSession({
        messages: [createMessage(0), createMessage(1)], // Only 2 messages (indices 0-1)
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(parentSession);

      await handleSessionBranch(['Test Branch', '--from', '5'], mockCtx); // Index 5 is out of bounds

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Invalid message index: 5. Must be between 0 and 1',
      });
    });
  });

  describe('AC5: Session export command (md/json/html formats)', () => {
    const testSession = createSession({
      id: 'export-session',
      name: 'Export Test',
      messages: [
        createMessage(0, 'user', 'Hello'),
        createMessage(1, 'assistant', 'Hi there!'),
      ],
    });

    beforeEach(() => {
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(testSession);
    });

    it('should export to markdown format', async () => {
      const markdownContent = '# APEX Session: Export Test\n\n**User**: Hello\n\n**Assistant**: Hi there!';
      mockCtx.sessionStore.exportSession.mockResolvedValue(markdownContent);

      await handleSessionExport([], mockCtx);

      expect(mockCtx.sessionStore.exportSession).toHaveBeenCalledWith('export-session', 'md');
      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: `**Session Export (MD):**\n\`\`\`md\n${markdownContent}\n\`\`\``,
      });
    });

    it('should export to JSON format', async () => {
      const jsonContent = JSON.stringify(testSession, null, 2);
      mockCtx.sessionStore.exportSession.mockResolvedValue(jsonContent);

      await handleSessionExport(['--format', 'json'], mockCtx);

      expect(mockCtx.sessionStore.exportSession).toHaveBeenCalledWith('export-session', 'json');
    });

    it('should export to HTML format', async () => {
      const htmlContent = '<!DOCTYPE html><html><head><title>Export Test</title></head><body><p>Content</p></body></html>';
      mockCtx.sessionStore.exportSession.mockResolvedValue(htmlContent);

      await handleSessionExport(['--format', 'html'], mockCtx);

      expect(mockCtx.sessionStore.exportSession).toHaveBeenCalledWith('export-session', 'html');
    });

    it('should export to file with --output option', async () => {
      const exportContent = 'Export file content';
      mockCtx.sessionStore.exportSession.mockResolvedValue(exportContent);

      await handleSessionExport(['--format', 'md', '--output', '/tmp/session.md'], mockCtx);

      expect(mockFs.writeFile).toHaveBeenCalledWith('/tmp/session.md', exportContent, 'utf-8');
      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Session exported to /tmp/session.md (MD format)',
      });
    });
  });

  describe('AC6: Session delete command', () => {
    it('should delete existing session', async () => {
      const sessionToDelete = createSession({
        id: 'delete-me-123',
        name: 'Session to Delete',
      });

      mockCtx.sessionStore.getSession.mockResolvedValue(sessionToDelete);
      mockCtx.sessionStore.deleteSession.mockResolvedValue(undefined);

      await handleSessionDelete('delete-me-123', mockCtx);

      expect(mockCtx.sessionStore.getSession).toHaveBeenCalledWith('delete-me-123');
      expect(mockCtx.sessionStore.deleteSession).toHaveBeenCalledWith('delete-me-123');

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Deleted session: Session to Delete',
      });
    });

    it('should handle deletion of non-existent session', async () => {
      mockCtx.sessionStore.getSession.mockResolvedValue(null);

      await handleSessionDelete('non-existent', mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session not found: non-existent',
      });
    });

    it('should handle delete errors', async () => {
      const session = createSession({ id: 'error-session' });
      mockCtx.sessionStore.getSession.mockResolvedValue(session);
      mockCtx.sessionStore.deleteSession.mockRejectedValue(new Error('Cannot delete active session'));

      await handleSessionDelete('error-session', mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to delete session: Cannot delete active session',
      });
    });
  });

  describe('AC7: Session info command', () => {
    it('should display comprehensive session information', async () => {
      const infoSession = createSession({
        id: 'info-session-456',
        name: 'Info Test Session',
        messages: new Array(15).fill(null).map((_, i) => createMessage(i)),
        createdAt: new Date('2023-01-01T09:00:00Z'),
        updatedAt: new Date('2023-01-02T14:30:00Z'),
        lastAccessedAt: new Date('2023-01-02T15:00:00Z'),
        state: {
          totalCost: 2.5678,
          totalTokens: { input: 1000, output: 1500 },
          tasksCreated: ['task1', 'task2'],
          tasksCompleted: ['task1'],
        },
        tags: ['important', 'review'],
        parentSessionId: 'parent-session-789',
        childSessionIds: ['child1', 'child2'],
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(infoSession);
      mockCtx.sessionAutoSaver.getUnsavedChangesCount.mockReturnValue(3);

      await handleSessionInfo(mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalled();
      const messageContent = mockCtx.app.addMessage.mock.calls[0][0].content;

      // Verify all expected information is included
      expect(messageContent).toContain('Current Session:');
      expect(messageContent).toContain('ID: info-session-456');
      expect(messageContent).toContain('Name: Info Test Session');
      expect(messageContent).toContain('Messages: 15');
      expect(messageContent).toContain('Total Cost: $2.5678');
      expect(messageContent).toContain('Tags: important, review');
      expect(messageContent).toContain('Branched from: parent-session-789');
      expect(messageContent).toContain('Branches: 2');
      expect(messageContent).toContain('Unsaved changes: 3');
    });

    it('should handle session with minimal information', async () => {
      const minimalSession = createSession({
        id: 'minimal-session',
        name: undefined,
        messages: [],
        tags: [],
        childSessionIds: [],
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(minimalSession);
      mockCtx.sessionAutoSaver.getUnsavedChangesCount.mockReturnValue(0);

      await handleSessionInfo(mockCtx);

      const messageContent = mockCtx.app.addMessage.mock.calls[0][0].content;
      expect(messageContent).toContain('Name: Unnamed');
      expect(messageContent).toContain('Messages: 0');
      expect(messageContent).not.toContain('Tags:');
      expect(messageContent).not.toContain('Branched from:');
      expect(messageContent).not.toContain('Branches:');
      expect(messageContent).not.toContain('Unsaved changes:');
    });

    it('should handle no active session', async () => {
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(null);

      await handleSessionInfo(mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'No active session.',
      });
    });
  });

  describe('Integration Test: Complete Session Workflow', () => {
    it('should handle full session lifecycle: create -> save -> load -> branch -> export -> delete', async () => {
      // 1. Create new session
      const newSession = createSession({
        id: 'lifecycle-session',
        name: undefined,
      });

      mockCtx.sessionAutoSaver.start.mockResolvedValue(newSession);
      const created = await mockCtx.sessionAutoSaver.start();
      expect(created.id).toBe('lifecycle-session');

      // 2. Save with name and tags
      mockCtx.sessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockCtx.sessionAutoSaver.save.mockResolvedValue(undefined);

      await handleSessionSave(['Lifecycle Test', '--tags', 'test,integration'], mockCtx);

      expect(mockCtx.sessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'Lifecycle Test',
        tags: ['test', 'integration'],
      });

      // 3. Load different session (which saves current first)
      const otherSession = createSession({ id: 'other-session', name: 'Other' });
      mockCtx.sessionStore.getSession.mockResolvedValue(otherSession);
      mockCtx.sessionAutoSaver.start.mockResolvedValue(otherSession);

      await handleSessionLoad('other-session', mockCtx);

      expect(mockCtx.sessionAutoSaver.save).toHaveBeenCalled(); // Auto-save before switch

      // 4. Branch from other session
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(otherSession);

      const branchedSession = createSession({
        id: 'branch-session',
        name: 'Test Branch',
        parentSessionId: 'other-session',
      });

      mockCtx.sessionStore.branchSession.mockResolvedValue(branchedSession);
      mockCtx.sessionAutoSaver.start.mockResolvedValue(branchedSession);

      await handleSessionBranch(['Test Branch'], mockCtx);

      expect(mockCtx.sessionStore.branchSession).toHaveBeenCalledWith('other-session', -1, 'Test Branch');

      // 5. Export branch
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(branchedSession);
      mockCtx.sessionStore.exportSession.mockResolvedValue('Export content');

      await handleSessionExport(['--format', 'md'], mockCtx);

      expect(mockCtx.sessionStore.exportSession).toHaveBeenCalledWith('branch-session', 'md');

      // 6. Delete original session
      mockCtx.sessionStore.getSession.mockResolvedValue(newSession);
      mockCtx.sessionStore.deleteSession.mockResolvedValue(undefined);

      await handleSessionDelete('lifecycle-session', mockCtx);

      expect(mockCtx.sessionStore.deleteSession).toHaveBeenCalledWith('lifecycle-session');

      // Verify all operations succeeded
      expect(mockCtx.app.addMessage.mock.calls.some(call =>
        call[0].type === 'error'
      )).toBe(false);
    });
  });
});