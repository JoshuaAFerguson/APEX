import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { SessionStore, Session, SessionMessage, ToolCallRecord } from '../SessionStore';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

vi.mock('fs/promises');
vi.mock('zlib');

const mockFs = vi.mocked(fs);
const mockGzip = vi.mocked(gzip);
const mockGunzip = vi.mocked(gunzip);

describe('SessionStore', () => {
  let sessionStore: SessionStore;
  let mockProjectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectPath = '/test/project';
    sessionStore = new SessionStore(mockProjectPath);

    // Mock file system operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('{}');
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);

    // Mock compression
    mockGzip.mockResolvedValue(Buffer.from('compressed'));
    mockGunzip.mockResolvedValue(Buffer.from('{}'));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('should create sessions and archive directories', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await sessionStore.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions', 'archive'),
        { recursive: true }
      );
    });

    it('should load existing index on initialization', async () => {
      const mockIndex = {
        version: 1,
        sessions: [{ id: 'test-session', name: 'Test', messageCount: 5, totalCost: 0.1 }],
        lastUpdated: new Date().toISOString()
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockIndex));

      await sessionStore.initialize();

      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions', 'index.json'),
        'utf-8'
      );
    });

    it('should create empty index if none exists', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await sessionStore.initialize();

      // Should still succeed and create empty index
      expect(mockFs.mkdir).toHaveBeenCalled();
    });
  });

  describe('session creation', () => {
    it('should create a new session with all required fields', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found')); // No existing index

      const session = await sessionStore.createSession('Test Session');

      expect(session).toMatchObject({
        name: 'Test Session',
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

      expect(session.id).toMatch(/^sess_\d+_\w+$/);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
      expect(session.lastAccessedAt).toBeInstanceOf(Date);
    });

    it('should create session without name', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const session = await sessionStore.createSession();

      expect(session.name).toBeUndefined();
      expect(session.id).toMatch(/^sess_\d+_\w+$/);
    });

    it('should save session to filesystem', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const session = await sessionStore.createSession('Test Session');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions', `${session.id}.json`),
        expect.stringContaining('"name": "Test Session"')
      );
    });

    it('should set as active session', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const session = await sessionStore.createSession();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions', 'active.json'),
        JSON.stringify({ sessionId: session.id })
      );
    });
  });

  describe('session retrieval', () => {
    it('should retrieve existing session', async () => {
      const sessionData = {
        id: 'test-session',
        name: 'Test Session',
        projectPath: mockProjectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messages: [{
          id: 'msg-1',
          index: 0,
          role: 'user',
          content: 'Hello',
          timestamp: new Date().toISOString()
        }],
        inputHistory: ['Hello'],
        state: {
          totalTokens: { input: 10, output: 20 },
          totalCost: 0.05,
          tasksCreated: ['task-1'],
          tasksCompleted: []
        },
        childSessionIds: [],
        tags: []
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(sessionData));

      const session = await sessionStore.getSession('test-session');

      expect(session).toBeDefined();
      expect(session!.id).toBe('test-session');
      expect(session!.name).toBe('Test Session');
      expect(session!.createdAt).toBeInstanceOf(Date);
      expect(session!.messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('should handle tool calls with timestamps in messages', async () => {
      const toolCall: ToolCallRecord = {
        id: 'tool-1',
        name: 'Read',
        arguments: { file_path: '/test/file.txt' },
        result: 'file content',
        timestamp: new Date().toISOString()
      };

      const sessionData = {
        id: 'test-session',
        messages: [{
          id: 'msg-1',
          index: 0,
          role: 'assistant',
          content: 'I will read the file',
          timestamp: new Date().toISOString(),
          toolCalls: [toolCall]
        }],
        // ... other required fields
        projectPath: mockProjectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        inputHistory: [],
        state: { totalTokens: { input: 0, output: 0 }, totalCost: 0, tasksCreated: [], tasksCompleted: [] },
        childSessionIds: [],
        tags: []
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(sessionData));

      const session = await sessionStore.getSession('test-session');

      expect(session!.messages[0].toolCalls![0].timestamp).toBeInstanceOf(Date);
    });

    it('should return null for non-existent session', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const session = await sessionStore.getSession('non-existent');

      expect(session).toBeNull();
    });

    it('should check archived sessions if not found in main directory', async () => {
      const archivedData = {
        id: 'archived-session',
        name: 'Archived Session',
        projectPath: mockProjectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messages: [],
        inputHistory: [],
        state: { totalTokens: { input: 0, output: 0 }, totalCost: 0, tasksCreated: [], tasksCompleted: [] },
        childSessionIds: [],
        tags: []
      };

      // First call fails (not in main directory)
      mockFs.readFile.mockRejectedValueOnce(new Error('File not found'));
      // Second call succeeds (found in archive)
      mockGunzip.mockResolvedValueOnce(Buffer.from(JSON.stringify(archivedData)));

      const session = await sessionStore.getSession('archived-session');

      expect(session).toBeDefined();
      expect(session!.id).toBe('archived-session');
    });
  });

  describe('session updates', () => {
    it('should update existing session', async () => {
      const originalSession = {
        id: 'test-session',
        name: 'Original Name',
        projectPath: mockProjectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date('2023-01-01').toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messages: [],
        inputHistory: [],
        state: { totalTokens: { input: 0, output: 0 }, totalCost: 0, tasksCreated: [], tasksCompleted: [] },
        childSessionIds: [],
        tags: []
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(originalSession));
      mockFs.readFile.mockResolvedValue('{"version":1,"sessions":[],"lastUpdated":"' + new Date().toISOString() + '"}');

      await sessionStore.updateSession('test-session', { name: 'Updated Name' });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions', 'test-session.json'),
        expect.stringContaining('"name": "Updated Name"')
      );
    });

    it('should throw error for non-existent session', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(
        sessionStore.updateSession('non-existent', { name: 'New Name' })
      ).rejects.toThrow('Session not found: non-existent');
    });

    it('should update timestamp when updating session', async () => {
      const originalSession = {
        id: 'test-session',
        name: 'Original',
        updatedAt: new Date('2023-01-01').toISOString(),
        // ... other fields
        projectPath: mockProjectPath,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messages: [],
        inputHistory: [],
        state: { totalTokens: { input: 0, output: 0 }, totalCost: 0, tasksCreated: [], tasksCompleted: [] },
        childSessionIds: [],
        tags: []
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(originalSession));
      mockFs.readFile.mockResolvedValue('{"version":1,"sessions":[],"lastUpdated":"' + new Date().toISOString() + '"}');

      await sessionStore.updateSession('test-session', { name: 'Updated' });

      const writeCall = mockFs.writeFile.mock.calls.find(call =>
        call[0].includes('test-session.json')
      );
      const savedData = JSON.parse(writeCall![1] as string);

      expect(new Date(savedData.updatedAt).getTime()).toBeGreaterThan(
        new Date('2023-01-01').getTime()
      );
    });
  });

  describe('session deletion', () => {
    it('should delete session file', async () => {
      mockFs.readFile.mockResolvedValue('{"version":1,"sessions":[{"id":"test-session"}],"lastUpdated":"' + new Date().toISOString() + '"}');

      await sessionStore.deleteSession('test-session');

      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions', 'test-session.json')
      );
    });

    it('should try to delete from archive if not found in main directory', async () => {
      mockFs.unlink.mockRejectedValueOnce(new Error('File not found'));
      mockFs.unlink.mockResolvedValueOnce(undefined); // Archive deletion succeeds

      await sessionStore.deleteSession('archived-session');

      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions', 'archive', 'archived-session.json.gz')
      );
    });
  });

  describe('session listing', () => {
    beforeEach(() => {
      const mockIndex = {
        version: 1,
        sessions: [
          {
            id: 'session-1',
            name: 'Active Session',
            messageCount: 10,
            totalCost: 0.5,
            createdAt: new Date('2023-01-01').toISOString(),
            updatedAt: new Date('2023-01-02').toISOString(),
            tags: ['work'],
            isArchived: false
          },
          {
            id: 'session-2',
            name: 'Archived Session',
            messageCount: 20,
            totalCost: 1.0,
            createdAt: new Date('2023-01-03').toISOString(),
            updatedAt: new Date('2023-01-04').toISOString(),
            tags: ['personal'],
            isArchived: true
          },
          {
            id: 'session-3',
            name: 'Recent Session',
            messageCount: 5,
            totalCost: 0.1,
            createdAt: new Date('2023-01-05').toISOString(),
            updatedAt: new Date('2023-01-06').toISOString(),
            tags: [],
            isArchived: false
          }
        ],
        lastUpdated: new Date().toISOString()
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockIndex));
    });

    it('should list active sessions by default', async () => {
      const sessions = await sessionStore.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.id)).toEqual(['session-3', 'session-1']); // Sorted by updatedAt desc
      expect(sessions.every(s => !s.isArchived)).toBe(true);
    });

    it('should include archived sessions when all=true', async () => {
      const sessions = await sessionStore.listSessions({ all: true });

      expect(sessions).toHaveLength(3);
      expect(sessions.some(s => s.isArchived)).toBe(true);
    });

    it('should filter by search term', async () => {
      const sessions = await sessionStore.listSessions({ search: 'active' });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('Active Session');
    });

    it('should filter by tags', async () => {
      const sessions = await sessionStore.listSessions({ tags: ['work'] });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].tags).toContain('work');
    });

    it('should limit results', async () => {
      const sessions = await sessionStore.listSessions({ limit: 1 });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session-3'); // Most recent
    });

    it('should sort by updatedAt descending', async () => {
      const sessions = await sessionStore.listSessions();

      const dates = sessions.map(s => new Date(s.updatedAt).getTime());
      expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
    });
  });

  describe('session branching', () => {
    it('should create branch from specific message index', async () => {
      const parentSession = {
        id: 'parent-session',
        name: 'Parent Session',
        projectPath: mockProjectPath,
        createdAt: new Date('2023-01-01').toISOString(),
        updatedAt: new Date('2023-01-02').toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messages: [
          { id: 'msg-1', index: 0, role: 'user', content: 'First', timestamp: new Date().toISOString() },
          { id: 'msg-2', index: 1, role: 'assistant', content: 'Second', timestamp: new Date().toISOString() },
          { id: 'msg-3', index: 2, role: 'user', content: 'Third', timestamp: new Date().toISOString() }
        ] as SessionMessage[],
        inputHistory: ['First', 'Third'],
        state: {
          totalTokens: { input: 100, output: 200 },
          totalCost: 1.5,
          tasksCreated: ['task-1'],
          tasksCompleted: []
        },
        childSessionIds: [],
        tags: ['work']
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(parentSession));
      mockFs.readFile.mockResolvedValue('{"version":1,"sessions":[],"lastUpdated":"' + new Date().toISOString() + '"}');

      const branchedSession = await sessionStore.branchSession('parent-session', 1, 'Branch Session');

      expect(branchedSession.messages).toHaveLength(2); // Messages 0 and 1
      expect(branchedSession.parentSessionId).toBe('parent-session');
      expect(branchedSession.branchPoint).toBe(1);
      expect(branchedSession.name).toBe('Branch Session');
      expect(branchedSession.id).not.toBe('parent-session');
    });

    it('should auto-generate branch name if not provided', async () => {
      const parentSession = {
        id: 'parent-session',
        name: 'Parent Session',
        messages: [
          { id: 'msg-1', index: 0, role: 'user', content: 'First', timestamp: new Date().toISOString() }
        ] as SessionMessage[],
        // ... other required fields
        projectPath: mockProjectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        inputHistory: [],
        state: { totalTokens: { input: 0, output: 0 }, totalCost: 0, tasksCreated: [], tasksCompleted: [] },
        childSessionIds: [],
        tags: []
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(parentSession));
      mockFs.readFile.mockResolvedValue('{"version":1,"sessions":[],"lastUpdated":"' + new Date().toISOString() + '"}');

      const branchedSession = await sessionStore.branchSession('parent-session', 0);

      expect(branchedSession.name).toBe('Branch from Parent Session');
    });

    it('should update parent session with child reference', async () => {
      const parentSession = {
        id: 'parent-session',
        childSessionIds: [],
        messages: [{ id: 'msg-1', index: 0, role: 'user', content: 'First', timestamp: new Date().toISOString() }],
        // ... other fields
        projectPath: mockProjectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        inputHistory: [],
        state: { totalTokens: { input: 0, output: 0 }, totalCost: 0, tasksCreated: [], tasksCompleted: [] },
        tags: []
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(parentSession));
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(parentSession)); // For updateSession
      mockFs.readFile.mockResolvedValue('{"version":1,"sessions":[],"lastUpdated":"' + new Date().toISOString() + '"}');

      const branchedSession = await sessionStore.branchSession('parent-session', 0);

      // Should save branched session and update parent
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${branchedSession.id}.json`),
        expect.any(String)
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('parent-session.json'),
        expect.stringContaining(`"childSessionIds":["${branchedSession.id}"]`)
      );
    });
  });

  describe('session export', () => {
    const mockSession: Session = {
      id: 'export-session',
      name: 'Export Test',
      projectPath: mockProjectPath,
      createdAt: new Date('2023-01-01T10:00:00Z'),
      updatedAt: new Date('2023-01-02T10:00:00Z'),
      lastAccessedAt: new Date(),
      messages: [
        {
          id: 'msg-1',
          index: 0,
          role: 'user',
          content: 'Hello APEX',
          timestamp: new Date('2023-01-01T10:01:00Z')
        },
        {
          id: 'msg-2',
          index: 1,
          role: 'assistant',
          content: 'Hello! How can I help you?',
          timestamp: new Date('2023-01-01T10:01:30Z'),
          agent: 'planner'
        }
      ] as SessionMessage[],
      inputHistory: ['Hello APEX'],
      state: {
        totalTokens: { input: 50, output: 100 },
        totalCost: 0.75,
        tasksCreated: [],
        tasksCompleted: []
      },
      childSessionIds: [],
      tags: ['test']
    };

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSession));
    });

    it('should export to markdown format', async () => {
      const markdown = await sessionStore.exportSession('export-session', 'md');

      expect(markdown).toContain('# APEX Session: Export Test');
      expect(markdown).toContain('**Created:** 2023-01-01T10:00:00.000Z');
      expect(markdown).toContain('**Total Messages:** 2');
      expect(markdown).toContain('**Total Cost:** $0.7500');
      expect(markdown).toContain('### **User**');
      expect(markdown).toContain('Hello APEX');
      expect(markdown).toContain('### **Assistant (planner)**');
      expect(markdown).toContain('Hello! How can I help you?');
    });

    it('should export to JSON format', async () => {
      const jsonStr = await sessionStore.exportSession('export-session', 'json');
      const parsed = JSON.parse(jsonStr);

      expect(parsed.id).toBe('export-session');
      expect(parsed.name).toBe('Export Test');
      expect(parsed.messages).toHaveLength(2);
    });

    it('should export to HTML format', async () => {
      const html = await sessionStore.exportSession('export-session', 'html');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>APEX Session: Export Test</title>');
      expect(html).toContain('<h1>APEX Session: Export Test</h1>');
      expect(html).toContain('class="message user"');
      expect(html).toContain('class="message assistant"');
      expect(html).toContain('Hello APEX');
    });

    it('should default to markdown format', async () => {
      const markdown = await sessionStore.exportSession('export-session');

      expect(markdown).toContain('# APEX Session: Export Test');
    });
  });

  describe('session archiving', () => {
    it('should compress and move session to archive', async () => {
      const sessionData = {
        id: 'archive-session',
        name: 'To Be Archived',
        projectPath: mockProjectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messages: [],
        inputHistory: [],
        state: { totalTokens: { input: 0, output: 0 }, totalCost: 0, tasksCreated: [], tasksCompleted: [] },
        childSessionIds: [],
        tags: []
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(sessionData));
      mockFs.readFile.mockResolvedValue('{"version":1,"sessions":[],"lastUpdated":"' + new Date().toISOString() + '"}');
      mockGzip.mockResolvedValue(Buffer.from('compressed-data'));

      await sessionStore.archiveSession('archive-session');

      expect(mockGzip).toHaveBeenCalledWith(JSON.stringify(sessionData));
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions', 'archive', 'archive-session.json.gz'),
        Buffer.from('compressed-data')
      );
      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions', 'archive-session.json')
      );
    });
  });

  describe('active session management', () => {
    it('should get active session ID', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ sessionId: 'active-session' }));

      const activeId = await sessionStore.getActiveSessionId();

      expect(activeId).toBe('active-session');
      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions', 'active.json'),
        'utf-8'
      );
    });

    it('should return null if no active session file', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const activeId = await sessionStore.getActiveSessionId();

      expect(activeId).toBeNull();
    });

    it('should set active session', async () => {
      await sessionStore.setActiveSession('new-active-session');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.apex', 'sessions', 'active.json'),
        JSON.stringify({ sessionId: 'new-active-session' })
      );
    });
  });

  describe('cost and token calculation', () => {
    it('should calculate tokens correctly', async () => {
      const session = {
        id: 'calc-session',
        messages: [
          {
            id: 'msg-1',
            tokens: { input: 10, output: 20 }
          },
          {
            id: 'msg-2',
            tokens: { input: 15, output: 25 }
          }
        ] as Partial<SessionMessage>[],
        // ... other required fields
        projectPath: mockProjectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        inputHistory: [],
        state: { totalTokens: { input: 0, output: 0 }, totalCost: 0, tasksCreated: [], tasksCompleted: [] },
        childSessionIds: [],
        tags: []
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(session));
      mockFs.readFile.mockResolvedValue('{"version":1,"sessions":[],"lastUpdated":"' + new Date().toISOString() + '"}');

      const branchedSession = await sessionStore.branchSession('calc-session', 1);

      // Should recalculate tokens for branched messages
      expect(branchedSession.state.totalTokens.input).toBe(25); // 10 + 15
      expect(branchedSession.state.totalTokens.output).toBe(45); // 20 + 25
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const session = await sessionStore.getSession('error-session');

      expect(session).toBeNull();
    });

    it('should handle JSON parse errors', async () => {
      mockFs.readFile.mockResolvedValue('invalid-json{');

      const session = await sessionStore.getSession('invalid-session');

      expect(session).toBeNull();
    });

    it('should handle compression errors in archiving', async () => {
      const sessionData = {
        id: 'error-session',
        projectPath: mockProjectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messages: [],
        inputHistory: [],
        state: { totalTokens: { input: 0, output: 0 }, totalCost: 0, tasksCreated: [], tasksCompleted: [] },
        childSessionIds: [],
        tags: []
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(sessionData));
      mockGzip.mockRejectedValue(new Error('Compression failed'));

      await expect(sessionStore.archiveSession('error-session')).rejects.toThrow('Compression failed');
    });
  });
});
