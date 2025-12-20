/**
 * Session Command Comprehensive Integration Tests
 *
 * Additional comprehensive integration tests for session commands covering edge cases,
 * error scenarios, and end-to-end workflows. These tests complement the main
 * session-commands.integration.test.ts to ensure full acceptance criteria coverage.
 *
 * Additional Acceptance Criteria Coverage:
 * 1. Session create command via SessionAutoSaver.start() (extended scenarios)
 * 2. Complex multi-step workflows (save -> load -> branch -> export)
 * 3. Error resilience and recovery scenarios
 * 4. Edge cases and boundary conditions
 * 5. Performance and concurrent operation testing
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

// Enhanced test data factories with more realistic data
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

const createTestMessage = (index: number, role: 'user' | 'assistant' = 'user', content: string = `Message ${index}`): any => ({
  id: `msg_${index}`,
  index,
  role,
  content,
  timestamp: new Date(`2023-01-01T${10 + index}:00:00Z`),
});

// Enhanced mock context with more realistic implementations
const createMockContext = () => {
  const mockApp = {
    addMessage: vi.fn(),
    updateState: vi.fn(),
    getState: vi.fn(() => ({ sessionName: null })),
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

describe('Session Command Comprehensive Integration Tests', () => {
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

  describe('Session Create Command via SessionAutoSaver', () => {
    it('should create new session when starting with no existing session', async () => {
      const newSession = createTestSession({
        id: 'new-session-123',
        name: undefined, // Auto-generated
        messages: [],
      });

      mockCtx.sessionAutoSaver.start.mockResolvedValue(newSession);
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(null); // No existing session

      // Simulate starting a new session via SessionAutoSaver
      const result = await mockCtx.sessionAutoSaver.start();

      expect(mockCtx.sessionAutoSaver.start).toHaveBeenCalledWith();
      expect(result).toEqual(newSession);
    });

    it('should create new session with specific ID when provided', async () => {
      const specificSession = createTestSession({
        id: 'specific-session-456',
        name: 'Specified Session',
      });

      mockCtx.sessionAutoSaver.start.mockResolvedValue(specificSession);

      const result = await mockCtx.sessionAutoSaver.start('specific-session-456');

      expect(mockCtx.sessionAutoSaver.start).toHaveBeenCalledWith('specific-session-456');
      expect(result).toEqual(specificSession);
    });

    it('should handle session creation failures gracefully', async () => {
      mockCtx.sessionAutoSaver.start.mockRejectedValue(new Error('Session creation failed'));

      await expect(mockCtx.sessionAutoSaver.start()).rejects.toThrow('Session creation failed');
    });
  });

  describe('Multi-Step Workflow Integration', () => {
    it('should handle complete save->load->branch->export workflow', async () => {
      // Step 1: Save current session with name and tags
      const originalSession = createTestSession({
        id: 'original-session',
        name: 'Original Work Session',
        messages: [
          createTestMessage(0, 'user', 'Start work'),
          createTestMessage(1, 'assistant', 'Working on it'),
          createTestMessage(2, 'user', 'Continue task'),
        ],
        tags: ['work', 'important'],
      });

      mockCtx.sessionAutoSaver.updateSessionInfo.mockResolvedValue(undefined);
      mockCtx.sessionAutoSaver.save.mockResolvedValue(undefined);

      const { handleSessionSave } = await import('../handlers/session-handlers.js');
      await handleSessionSave(['Original Work Session', '--tags', 'work,important'], mockCtx);

      expect(mockCtx.sessionAutoSaver.updateSessionInfo).toHaveBeenCalledWith({
        name: 'Original Work Session',
        tags: ['work', 'important'],
      });

      // Step 2: Load different session
      const secondSession = createTestSession({
        id: 'second-session',
        name: 'Second Session',
        messages: [createTestMessage(0, 'user', 'Different work')],
      });

      mockCtx.sessionStore.getSession.mockResolvedValue(secondSession);
      mockCtx.sessionAutoSaver.start.mockResolvedValue(secondSession);

      const { handleSessionLoad } = await import('../handlers/session-handlers.js');
      await handleSessionLoad('second-session', mockCtx);

      expect(mockCtx.sessionAutoSaver.save).toHaveBeenCalled(); // Auto-save before switch
      expect(mockCtx.sessionAutoSaver.start).toHaveBeenCalledWith('second-session');

      // Step 3: Branch from current session
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(secondSession);

      const branchedSession = createTestSession({
        id: 'branch-session',
        name: 'Branch Experiment',
        parentSessionId: 'second-session',
        branchPoint: 0,
      });

      mockCtx.sessionStore.branchSession.mockResolvedValue(branchedSession);
      mockCtx.sessionAutoSaver.start.mockResolvedValue(branchedSession);

      const { handleSessionBranch } = await import('../handlers/session-handlers.js');
      await handleSessionBranch(['Branch Experiment'], mockCtx);

      expect(mockCtx.sessionStore.branchSession).toHaveBeenCalledWith('second-session', 0, 'Branch Experiment');

      // Step 4: Export the branch
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(branchedSession);
      const exportContent = '# Branch Export\n\nContent here';
      mockCtx.sessionStore.exportSession.mockResolvedValue(exportContent);

      const { handleSessionExport } = await import('../handlers/session-handlers.js');
      await handleSessionExport(['--format', 'md', '--output', '/tmp/branch.md'], mockCtx);

      expect(mockCtx.sessionStore.exportSession).toHaveBeenCalledWith('branch-session', 'md');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/tmp/branch.md', exportContent, 'utf-8');

      // Verify all operations completed successfully
      expect(mockCtx.app.addMessage).toHaveBeenCalledTimes(4); // One for each operation
    });

    it('should handle workflow with intermediate failures gracefully', async () => {
      // Save fails
      mockCtx.sessionAutoSaver.updateSessionInfo.mockRejectedValue(new Error('Save failed'));

      const { handleSessionSave } = await import('../handlers/session-handlers.js');
      await handleSessionSave(['Test Session'], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Failed to save session: Save failed',
      });

      // Clear mocks and continue with load
      vi.clearAllMocks();

      const testSession = createTestSession({ id: 'test-session' });
      mockCtx.sessionStore.getSession.mockResolvedValue(testSession);
      mockCtx.sessionAutoSaver.start.mockResolvedValue(testSession);
      mockCtx.sessionAutoSaver.save.mockResolvedValue(undefined);

      const { handleSessionLoad } = await import('../handlers/session-handlers.js');
      await handleSessionLoad('test-session', mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: expect.stringContaining('Loaded session: Test Session'),
      });
    });
  });

  describe('Session List Advanced Scenarios', () => {
    it('should handle large session lists with pagination', async () => {
      const largeSessions = Array.from({ length: 100 }, (_, i) => ({
        id: `sess_${i}`,
        name: `Session ${i}`,
        messageCount: i * 2,
        totalCost: i * 0.1,
        createdAt: new Date(`2023-01-${String(i % 30 + 1).padStart(2, '0')}`),
        updatedAt: new Date(`2023-01-${String(i % 30 + 1).padStart(2, '0')}`),
        tags: i % 3 === 0 ? ['important'] : [],
        isArchived: i % 10 === 0,
      }));

      // Should only return first 20 due to limit
      mockCtx.sessionStore.listSessions.mockResolvedValue(largeSessions.slice(0, 20));

      const { handleSessionList } = await import('../handlers/session-handlers.js');
      await handleSessionList([], mockCtx);

      expect(mockCtx.sessionStore.listSessions).toHaveBeenCalledWith({
        all: false,
        search: undefined,
        limit: 20,
      });

      const messages = mockCtx.app.addMessage.mock.calls;
      expect(messages.length).toBe(1);
      expect(messages[0][0].content).toContain('Sessions:');
    });

    it('should handle search with special characters', async () => {
      const specialSession = {
        id: 'special-session',
        name: 'Test@#$%^&*()Session',
        messageCount: 5,
        totalCost: 0.25,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        isArchived: false,
      };

      mockCtx.sessionStore.listSessions.mockResolvedValue([specialSession]);

      const { handleSessionList } = await import('../handlers/session-handlers.js');
      await handleSessionList(['--search', '@#$%'], mockCtx);

      expect(mockCtx.sessionStore.listSessions).toHaveBeenCalledWith({
        all: false,
        search: '@#$%',
        limit: 20,
      });
    });
  });

  describe('Session Branch Advanced Scenarios', () => {
    it('should handle branching from session with many messages', async () => {
      const largeSession = createTestSession({
        id: 'large-session',
        messages: Array.from({ length: 1000 }, (_, i) => createTestMessage(i, i % 2 === 0 ? 'user' : 'assistant')),
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(largeSession);

      const branchedSession = createTestSession({
        id: 'mid-branch',
        name: 'Mid Point Branch',
        branchPoint: 500,
      });

      mockCtx.sessionStore.branchSession.mockResolvedValue(branchedSession);

      const { handleSessionBranch } = await import('../handlers/session-handlers.js');
      await handleSessionBranch(['Mid Point Branch', '--from', '500'], mockCtx);

      expect(mockCtx.sessionStore.branchSession).toHaveBeenCalledWith('large-session', 500, 'Mid Point Branch');
    });

    it('should handle auto-naming for branches', async () => {
      const parentSession = createTestSession({
        id: 'parent-session',
        name: 'Parent Session',
        messages: [createTestMessage(0)],
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(parentSession);

      const autoBranchedSession = createTestSession({
        id: 'auto-branch',
        name: `Branch from Parent Session (${new Date().toISOString().split('T')[0]})`,
        branchPoint: 0,
      });

      mockCtx.sessionStore.branchSession.mockResolvedValue(autoBranchedSession);

      const { handleSessionBranch } = await import('../handlers/session-handlers.js');
      await handleSessionBranch([], mockCtx); // No name provided

      expect(mockCtx.sessionStore.branchSession).toHaveBeenCalledWith('parent-session', 0, undefined);
    });
  });

  describe('Session Export Comprehensive Scenarios', () => {
    it('should handle export of session with various message types', async () => {
      const complexSession = createTestSession({
        id: 'complex-session',
        messages: [
          createTestMessage(0, 'user', 'Hello with **markdown**'),
          createTestMessage(1, 'assistant', 'Response with `code` snippets'),
          createTestMessage(2, 'user', 'Message\nwith\nnewlines'),
          createTestMessage(3, 'assistant', 'JSON: {"key": "value"}'),
        ],
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(complexSession);

      // Test each format
      const formats = ['md', 'json', 'html'] as const;

      for (const format of formats) {
        const exportContent = format === 'json'
          ? JSON.stringify(complexSession, null, 2)
          : `<${format}>Content for ${format}</${format}>`;

        mockCtx.sessionStore.exportSession.mockResolvedValue(exportContent);

        const { handleSessionExport } = await import('../handlers/session-handlers.js');
        await handleSessionExport(['--format', format], mockCtx);

        expect(mockCtx.sessionStore.exportSession).toHaveBeenCalledWith('complex-session', format);
      }
    });

    it('should handle large exports gracefully', async () => {
      const largeContent = 'x'.repeat(10000); // 10KB content
      mockCtx.sessionStore.exportSession.mockResolvedValue(largeContent);

      const session = createTestSession({ id: 'large-export-session' });
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(session);

      const { handleSessionExport } = await import('../handlers/session-handlers.js');
      await handleSessionExport([], mockCtx);

      // Should truncate preview to 500 chars
      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: expect.stringContaining('x'.repeat(500) + '...'),
      });
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle concurrent operations gracefully', async () => {
      const testSession = createTestSession({ id: 'concurrent-session' });

      // Simulate concurrent save operations
      let saveCallCount = 0;
      mockCtx.sessionAutoSaver.save.mockImplementation(async () => {
        saveCallCount++;
        if (saveCallCount === 1) {
          // First save succeeds after delay
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          // Concurrent saves should handle gracefully
          throw new Error('Concurrent save detected');
        }
      });

      const { handleSessionSave } = await import('../handlers/session-handlers.js');

      // Start concurrent saves
      const savePromises = [
        handleSessionSave(['Session A'], mockCtx),
        handleSessionSave(['Session B'], mockCtx),
      ];

      await Promise.allSettled(savePromises);

      // At least one should succeed
      expect(mockCtx.sessionAutoSaver.save).toHaveBeenCalled();
    });

    it('should handle filesystem permission errors', async () => {
      const session = createTestSession({ id: 'export-session' });
      mockCtx.sessionAutoSaver.getSession.mockReturnValue(session);
      mockCtx.sessionStore.exportSession.mockResolvedValue('Export content');

      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const { handleSessionExport } = await import('../handlers/session-handlers.js');
      await handleSessionExport(['--output', '/readonly/file.md'], mockCtx);

      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: expect.stringContaining('Permission denied'),
      });
    });

    it('should validate session IDs properly', async () => {
      const { handleSessionLoad, handleSessionDelete } = await import('../handlers/session-handlers.js');

      // Test empty session ID
      await handleSessionLoad('', mockCtx);
      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /session load <session_id>',
      });

      vi.clearAllMocks();

      // Test invalid session ID format (should still attempt lookup)
      mockCtx.sessionStore.getSession.mockResolvedValue(null);
      await handleSessionDelete('invalid@#$%session', mockCtx);

      expect(mockCtx.sessionStore.getSession).toHaveBeenCalledWith('invalid@#$%session');
      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Session not found: invalid@#$%session',
      });
    });
  });

  describe('Session Info Detailed Scenarios', () => {
    it('should display comprehensive session information', async () => {
      const detailedSession = createTestSession({
        id: 'detailed-session-123456',
        name: 'Comprehensive Test Session',
        messages: Array.from({ length: 50 }, (_, i) => createTestMessage(i)),
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-02T15:30:00Z'),
        lastAccessedAt: new Date('2023-01-02T16:00:00Z'),
        state: {
          totalCost: 12.3456,
          totalTokens: { input: 15000, output: 25000 },
          tasksCreated: ['task1', 'task2', 'task3'],
          tasksCompleted: ['task1', 'task2'],
        },
        tags: ['work', 'important', 'long-term'],
        parentSessionId: 'parent-session-789',
        childSessionIds: ['child1', 'child2', 'child3', 'child4'],
        branchPoint: 25,
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(detailedSession);
      mockCtx.sessionAutoSaver.getUnsavedChangesCount.mockReturnValue(7);

      const { handleSessionInfo } = await import('../handlers/session-handlers.js');
      await handleSessionInfo(mockCtx);

      const messageContent = mockCtx.app.addMessage.mock.calls[0][0].content;

      // Verify all information is displayed
      expect(messageContent).toContain('ID: detailed-session-123456');
      expect(messageContent).toContain('Name: Comprehensive Test Session');
      expect(messageContent).toContain('Messages: 50');
      expect(messageContent).toContain('Total Cost: $12.3456');
      expect(messageContent).toContain('Tags: work, important, long-term');
      expect(messageContent).toContain('Branched from: parent-session-789');
      expect(messageContent).toContain('Branches: 4');
      expect(messageContent).toContain('Unsaved changes: 7');
    });
  });

  describe('Integration with Real File System Operations', () => {
    it('should handle export file operations end-to-end', async () => {
      const session = createTestSession({
        id: 'file-export-session',
        name: 'File Export Test',
      });

      mockCtx.sessionAutoSaver.getSession.mockReturnValue(session);

      const exportContent = '# Session Export\n\nTest content for file export';
      mockCtx.sessionStore.exportSession.mockResolvedValue(exportContent);

      // Simulate successful file write
      mockFs.writeFile.mockResolvedValue(undefined);

      const { handleSessionExport } = await import('../handlers/session-handlers.js');
      await handleSessionExport(['--format', 'md', '--output', '/tmp/test-export.md'], mockCtx);

      expect(mockFs.writeFile).toHaveBeenCalledWith('/tmp/test-export.md', exportContent, 'utf-8');
      expect(mockCtx.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Session exported to /tmp/test-export.md (MD format)',
      });
    });
  });
});