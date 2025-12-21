/**
 * Session Management Documentation Feature Tests
 *
 * Tests verify that all 7 documented session management features work correctly
 * according to the CLI Guide documentation specifications.
 *
 * This test suite validates:
 * 1. Session Persistence - Automatic session resumption
 * 2. Session Export Formats - Markdown, JSON, HTML exports
 * 3. Session Branching - Alternative conversation branches
 * 4. Named Sessions - Organization with meaningful names/tags
 * 5. Session Search - Find sessions by name, content, metadata
 * 6. Auto-Save - Intelligent automatic session persistence
 * 7. Session Commands Reference - All documented commands work
 *
 * Each test includes examples from the documentation to ensure accuracy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SessionStore, Session, SessionMessage, SessionState, SessionSummary } from '../services/SessionStore.js';
import { SessionAutoSaver, AutoSaveOptions } from '../services/SessionAutoSaver.js';

// Mock file system
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
  readFile: vi.fn(),
}));
const mockFs = vi.mocked(fs);

// Test utilities
const createTestSession = (overrides: Partial<Session> = {}): Session => ({
  id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Session',
  projectPath: '/test/project',
  createdAt: new Date('2024-12-15T10:30:00.000Z'),
  updatedAt: new Date('2024-12-15T12:45:00.000Z'),
  lastAccessedAt: new Date('2024-12-15T12:45:00.000Z'),
  messages: [],
  inputHistory: [],
  state: {
    totalTokens: { input: 89123, output: 36333 },
    totalCost: 1.2345,
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
  content: 'Add a health check endpoint to the API',
  timestamp: new Date('2024-12-15T10:30:15.000Z'),
  ...overrides,
});

const createAssistantMessage = (overrides: Partial<SessionMessage> = {}): SessionMessage => ({
  id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  index: 1,
  role: 'assistant',
  content: 'I\'ll analyze your codebase and create a plan for implementing a health check endpoint...',
  timestamp: new Date('2024-12-15T10:30:45.000Z'),
  agent: 'planner',
  stage: 'planning',
  tokens: { input: 850, output: 384 },
  cost: 0.0012,
  ...overrides,
});

describe('Session Management Documentation Features', () => {
  let sessionStore: SessionStore;
  let projectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    projectPath = '/test/project';
    sessionStore = new SessionStore(projectPath);

    // Setup default mock responses
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.unlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Feature 1: Session Persistence', () => {
    it('should automatically persist session state during normal usage', async () => {
      const session = createTestSession({
        name: 'Feature Development',
        messages: [
          createTestMessage(),
          createAssistantMessage(),
        ],
        state: {
          totalTokens: { input: 89123, output: 36333 },
          totalCost: 1.2345,
          tasksCreated: ['task_abc123_def456'],
          tasksCompleted: [],
        }
      });

      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const createdSession = await sessionStore.createSession(session.name!);

      // Verify session was persisted to filesystem
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${createdSession.id}.json`),
        expect.any(String)
      );

      // Verify active session was set
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('active.json'),
        JSON.stringify({ sessionId: createdSession.id })
      );
    });

    it('should support automatic session resumption on APEX startup', async () => {
      const existingSession = createTestSession({
        id: 'sess_1703123456789_abc123def',
        name: 'Feature Development',
        messages: [createTestMessage(), createAssistantMessage()],
      });

      // Mock active session file
      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes('active.json')) {
          return Promise.resolve(JSON.stringify({ sessionId: existingSession.id }));
        }
        if (filePath.toString().includes(`${existingSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(existingSession));
        }
        return Promise.reject(new Error('File not found'));
      });

      const autoSaver = new SessionAutoSaver(sessionStore);
      const resumedSession = await autoSaver.start();

      expect(resumedSession.id).toBe(existingSession.id);
      expect(resumedSession.name).toBe('Feature Development');
      expect(resumedSession.messages).toHaveLength(2);
    });

    it('should support crash recovery from last auto-save', async () => {
      const sessionWithUnsavedChanges = createTestSession({
        name: 'Feature Development',
        messages: [
          createTestMessage(),
          createAssistantMessage(),
          createTestMessage({
            index: 2,
            content: 'Make sure it includes database connectivity status',
            timestamp: new Date('2024-12-15T10:35:22.000Z')
          }),
        ]
      });

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${sessionWithUnsavedChanges.id}.json`)) {
          return Promise.resolve(JSON.stringify(sessionWithUnsavedChanges));
        }
        return Promise.reject(new Error('File not found'));
      });

      const recoveredSession = await sessionStore.getSession(sessionWithUnsavedChanges.id);

      expect(recoveredSession).not.toBeNull();
      expect(recoveredSession!.messages).toHaveLength(3);
      expect(recoveredSession!.messages[2].content).toBe('Make sure it includes database connectivity status');
    });
  });

  describe('Feature 2: Session Export Formats', () => {
    let sampleSession: Session;

    beforeEach(() => {
      sampleSession = createTestSession({
        id: 'sess_1703123456789_abc123def',
        name: 'Feature Development',
        createdAt: new Date('2024-12-15T10:30:00.000Z'),
        updatedAt: new Date('2024-12-15T12:45:00.000Z'),
        messages: [
          createTestMessage(),
          createAssistantMessage(),
          createTestMessage({
            index: 2,
            content: 'Make sure it includes database connectivity status',
            timestamp: new Date('2024-12-15T10:35:22.000Z'),
          }),
        ],
        state: {
          totalTokens: { input: 89123, output: 36333 },
          totalCost: 1.2345,
          tasksCreated: [],
          tasksCompleted: [],
        }
      });

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${sampleSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(sampleSession));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should export session as markdown format matching documentation', async () => {
      const markdownExport = await sessionStore.exportSession(sampleSession.id, 'md');

      // Verify markdown header format
      expect(markdownExport).toContain('# APEX Session: Feature Development');
      expect(markdownExport).toContain('**Created:** 2024-12-15T10:30:00.000Z');
      expect(markdownExport).toContain('**Last Updated:** 2024-12-15T12:45:00.000Z');
      expect(markdownExport).toContain('**Total Messages:** 3');
      expect(markdownExport).toContain('**Total Cost:** $1.2345');
      expect(markdownExport).toContain('**Tokens:** 125,456 (input: 89,123 | output: 36,333)');

      // Verify message format
      expect(markdownExport).toContain('### **User** *(2024-12-15 10:30:15)*');
      expect(markdownExport).toContain('Add a health check endpoint to the API');
      expect(markdownExport).toContain('### **Assistant (planner)** *(2024-12-15 10:30:45)*');
      expect(markdownExport).toContain('[Agent: planner | Stage: planning | Tokens: 1,234 | Cost: $0.0012]');
    });

    it('should export session as JSON format matching documentation', async () => {
      const jsonExport = await sessionStore.exportSession(sampleSession.id, 'json');
      const parsed = JSON.parse(jsonExport);

      // Verify JSON structure matches documentation example
      expect(parsed).toMatchObject({
        id: sampleSession.id,
        name: 'Feature Development',
        created: '2024-12-15T10:30:00.000Z',
        lastUpdated: '2024-12-15T12:45:00.000Z',
        metadata: {
          tags: [],
          parentSessionId: null,
          branchCount: 0,
        },
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            index: 0,
            timestamp: '2024-12-15T10:30:15.000Z',
            role: 'user',
            content: 'Add a health check endpoint to the API',
          }),
          expect.objectContaining({
            id: expect.any(String),
            index: 1,
            role: 'assistant',
            content: expect.stringContaining('analyze your codebase'),
            metadata: {
              agent: 'planner',
              stage: 'planning',
              tokens: { input: 850, output: 384 },
              cost: 0.0012,
            },
          }),
        ]),
        state: {
          totalTokens: { input: 89123, output: 36333 },
          totalCost: 1.2345,
          currentAgent: undefined,
          currentStage: undefined,
        },
      });
    });

    it('should export session as HTML format matching documentation', async () => {
      const htmlExport = await sessionStore.exportSession(sampleSession.id, 'html');

      // Verify HTML structure matches documentation example
      expect(htmlExport).toContain('<!DOCTYPE html>');
      expect(htmlExport).toContain('<title>APEX Session: Feature Development</title>');
      expect(htmlExport).toContain('<h1>APEX Session: Feature Development</h1>');

      // Verify CSS classes from documentation
      expect(htmlExport).toContain('class="message user"');
      expect(htmlExport).toContain('class="message assistant"');
      expect(htmlExport).toContain('class="metadata"');

      // Verify session info section
      expect(htmlExport).toContain('<strong>Created:</strong> December 15, 2024');
      expect(htmlExport).toContain('<strong>Messages:</strong> 3');
      expect(htmlExport).toContain('<strong>Cost:</strong> $1.2345');

      // Verify message content
      expect(htmlExport).toContain('Add a health check endpoint to the API');
      expect(htmlExport).toContain('Assistant (planner)');
      expect(htmlExport).toContain('Tokens: 1,234 | Cost: $0.0012');
    });

    it('should support export commands with file output', async () => {
      // Test export to JSON file
      await sessionStore.exportSession(sampleSession.id, 'json', '/test/session-data.json');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/session-data.json',
        expect.stringContaining('"name": "Feature Development"')
      );

      // Test export to HTML file
      await sessionStore.exportSession(sampleSession.id, 'html', '/test/project-session.html');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/project-session.html',
        expect.stringContaining('<!DOCTYPE html>')
      );
    });
  });

  describe('Feature 3: Session Branching', () => {
    let parentSession: Session;

    beforeEach(() => {
      parentSession = createTestSession({
        id: 'sess_main_1703123456789',
        name: 'Main Development',
        messages: [
          createTestMessage({
            index: 0,
            content: 'Implement user authentication',
            timestamp: new Date('2024-12-15T10:30:00.000Z'),
          }),
          createAssistantMessage({
            index: 1,
            content: 'I\'ll create a JWT-based auth system...',
            timestamp: new Date('2024-12-15T10:31:00.000Z'),
          }),
          createTestMessage({
            index: 2,
            content: 'Actually, let\'s also consider OAuth',
            timestamp: new Date('2024-12-15T10:32:00.000Z'),
          }),
          createAssistantMessage({
            index: 3,
            content: 'Here\'s a comparison of JWT vs OAuth...',
            timestamp: new Date('2024-12-15T10:33:00.000Z'),
          }),
          createTestMessage({
            index: 4,
            content: 'Let\'s stick with JWT for now',
            timestamp: new Date('2024-12-15T10:34:00.000Z'),
          }),
        ],
        childSessionIds: [],
      });

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${parentSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(parentSession));
        }
        if (filePath.toString().includes('index.json')) {
          return Promise.resolve(JSON.stringify({
            version: 1,
            sessions: [],
            lastUpdated: new Date(),
          }));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should create branch from specific message index as documented', async () => {
      const branchSession = await sessionStore.branchSession(
        parentSession.id,
        3, // Branch from message 3 (OAuth comparison point)
        'OAuth Implementation'
      );

      // Verify branch creation matches documentation example
      expect(branchSession.id).not.toBe(parentSession.id);
      expect(branchSession.name).toBe('OAuth Implementation');
      expect(branchSession.parentSessionId).toBe(parentSession.id);
      expect(branchSession.branchPoint).toBe(3);

      // Verify branch contains messages up to branch point
      expect(branchSession.messages).toHaveLength(4); // Messages 0-3
      expect(branchSession.messages[3].content).toBe('Here\'s a comparison of JWT vs OAuth...');

      // Verify parent session is updated with child reference
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${parentSession.id}.json`),
        expect.stringContaining(branchSession.id)
      );
    });

    it('should create branch from current conversation point', async () => {
      const branchSession = await sessionStore.branchSession(
        parentSession.id,
        parentSession.messages.length - 1, // Current point
        'Alternative Approach'
      );

      expect(branchSession.name).toBe('Alternative Approach');
      expect(branchSession.messages).toHaveLength(parentSession.messages.length);
    });

    it('should auto-generate branch names when not provided', async () => {
      const branchSession = await sessionStore.branchSession(
        parentSession.id,
        2,
        undefined // No name provided
      );

      // Should generate a meaningful name
      expect(branchSession.name).toMatch(/^Branch from /);
      expect(branchSession.name).toContain('Main Development');
    });

    it('should maintain branch relationships for session info', async () => {
      // Create two child branches
      const oauthBranch = await sessionStore.branchSession(
        parentSession.id,
        3,
        'OAuth Approach'
      );

      const redisBranch = await sessionStore.branchSession(
        parentSession.id,
        4,
        'Redis Caching'
      );

      // Update parent session with child references
      parentSession.childSessionIds = [oauthBranch.id, redisBranch.id];

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${parentSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(parentSession));
        }
        if (filePath.toString().includes(`${oauthBranch.id}.json`)) {
          return Promise.resolve(JSON.stringify(oauthBranch));
        }
        if (filePath.toString().includes(`${redisBranch.id}.json`)) {
          return Promise.resolve(JSON.stringify(redisBranch));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Verify session info structure
      const retrievedSession = await sessionStore.getSession(parentSession.id);
      expect(retrievedSession!.childSessionIds).toContain(oauthBranch.id);
      expect(retrievedSession!.childSessionIds).toContain(redisBranch.id);
    });
  });

  describe('Feature 4: Named Sessions', () => {
    it('should save sessions with meaningful names and tags as documented', async () => {
      const session = createTestSession({
        name: 'Auth Implementation',
        tags: ['auth', 'feature', 'backend'],
      });

      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const savedSession = await sessionStore.createSession(
        session.name!,
        { tags: session.tags }
      );

      expect(savedSession.name).toBe('Auth Implementation');
      expect(savedSession.tags).toEqual(['auth', 'feature', 'backend']);

      // Verify session was persisted with metadata
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${savedSession.id}.json`),
        expect.stringContaining('"tags":["auth","feature","backend"]')
      );
    });

    it('should support various naming patterns from documentation', async () => {
      const namingExamples = [
        // Feature-based naming
        { name: 'User Profile Management', tags: ['feature', 'user'] },
        { name: 'Payment Integration', tags: ['feature', 'payment'] },

        // Sprint/iteration-based naming
        { name: 'Sprint 3 - Authentication', tags: ['sprint3', 'auth'] },
        { name: 'v2.0 API Updates', tags: ['v2', 'api'] },

        // Component-based naming
        { name: 'Frontend: React Components', tags: ['frontend', 'react'] },
        { name: 'Backend: Database Layer', tags: ['backend', 'database'] },
      ];

      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      for (const example of namingExamples) {
        const session = await sessionStore.createSession(example.name, { tags: example.tags });

        expect(session.name).toBe(example.name);
        expect(session.tags).toEqual(example.tags);
      }
    });

    it('should support loading sessions by name', async () => {
      const authSession = createTestSession({
        id: 'sess_auth_123',
        name: 'Auth Implementation',
        tags: ['auth', 'backend'],
      });

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes('index.json')) {
          return Promise.resolve(JSON.stringify({
            version: 1,
            sessions: [{
              id: authSession.id,
              name: authSession.name,
              messageCount: 0,
              totalCost: 0,
              createdAt: authSession.createdAt,
              updatedAt: authSession.updatedAt,
              tags: authSession.tags,
              isArchived: false,
            }],
            lastUpdated: new Date(),
          }));
        }
        if (filePath.toString().includes(`${authSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(authSession));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Test loading by exact name
      const sessions = await sessionStore.listSessions({ search: 'Auth Implementation' });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('Auth Implementation');

      // Test loading by partial name
      const partialSessions = await sessionStore.listSessions({ search: 'Auth' });
      expect(partialSessions).toHaveLength(1);
      expect(partialSessions[0].name).toBe('Auth Implementation');
    });
  });

  describe('Feature 5: Session Search', () => {
    let searchTestSessions: SessionSummary[];

    beforeEach(() => {
      searchTestSessions = [
        {
          id: 'sess_auth_feature_123',
          name: 'Authentication Feature Implementation',
          messageCount: 25,
          totalCost: 1.50,
          createdAt: new Date('2024-12-15T10:00:00Z'),
          updatedAt: new Date('2024-12-15T12:00:00Z'),
          tags: ['auth', 'feature', 'backend', 'security'],
          isArchived: false,
        },
        {
          id: 'sess_ui_design_456',
          name: 'UI Design System',
          messageCount: 15,
          totalCost: 0.75,
          createdAt: new Date('2024-12-14T10:00:00Z'),
          updatedAt: new Date('2024-12-14T15:00:00Z'),
          tags: ['ui', 'design', 'frontend', 'components'],
          isArchived: false,
        },
        {
          id: 'sess_database_opt_789',
          name: 'Database Optimization',
          messageCount: 30,
          totalCost: 2.10,
          createdAt: new Date('2024-12-13T10:00:00Z'),
          updatedAt: new Date('2024-12-13T16:00:00Z'),
          tags: ['database', 'performance', 'backend', 'optimization'],
          isArchived: false,
        },
        {
          id: 'sess_payment_archived_999',
          name: 'Payment Gateway Integration',
          messageCount: 40,
          totalCost: 3.25,
          createdAt: new Date('2024-12-10T10:00:00Z'),
          updatedAt: new Date('2024-12-10T18:00:00Z'),
          tags: ['payment', 'integration', 'backend', 'archived'],
          isArchived: true,
        },
      ];

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes('index.json')) {
          return Promise.resolve(JSON.stringify({
            version: 1,
            sessions: searchTestSessions,
            lastUpdated: new Date(),
          }));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should find sessions by name with case-insensitive search', async () => {
      // Test exact name match
      const exactMatch = await sessionStore.listSessions({ search: 'Authentication Feature Implementation' });
      expect(exactMatch).toHaveLength(1);
      expect(exactMatch[0].name).toBe('Authentication Feature Implementation');

      // Test case-insensitive search
      const caseInsensitive = await sessionStore.listSessions({ search: 'AUTHENTICATION' });
      expect(caseInsensitive).toHaveLength(1);
      expect(caseInsensitive[0].id).toBe('sess_auth_feature_123');

      // Test partial name search
      const partialMatch = await sessionStore.listSessions({ search: 'Design' });
      expect(partialMatch).toHaveLength(1);
      expect(partialMatch[0].id).toBe('sess_ui_design_456');
    });

    it('should find sessions by ID substring', async () => {
      // Test ID prefix search
      const idPrefixSearch = await sessionStore.listSessions({ search: 'sess_auth' });
      expect(idPrefixSearch).toHaveLength(1);
      expect(idPrefixSearch[0].id).toBe('sess_auth_feature_123');

      // Test ID suffix search
      const idSuffixSearch = await sessionStore.listSessions({ search: '456' });
      expect(idSuffixSearch).toHaveLength(1);
      expect(idSuffixSearch[0].id).toBe('sess_ui_design_456');
    });

    it('should filter sessions by tags', async () => {
      // Test single tag filter
      const backendSessions = await sessionStore.listSessions({ tags: ['backend'] });
      expect(backendSessions).toHaveLength(2); // auth and database sessions
      expect(backendSessions.map(s => s.id)).toEqual(
        expect.arrayContaining(['sess_auth_feature_123', 'sess_database_opt_789'])
      );

      // Test multiple tag filter (OR logic)
      const frontendOrDesignSessions = await sessionStore.listSessions({ tags: ['frontend', 'design'] });
      expect(frontendOrDesignSessions).toHaveLength(1);
      expect(frontendOrDesignSessions[0].id).toBe('sess_ui_design_456');

      // Test specific tag combination
      const performanceSessions = await sessionStore.listSessions({ tags: ['performance'] });
      expect(performanceSessions).toHaveLength(1);
      expect(performanceSessions[0].id).toBe('sess_database_opt_789');
    });

    it('should combine search and tag filters', async () => {
      // Search for "feature" with backend tag
      const backendFeatures = await sessionStore.listSessions({
        search: 'feature',
        tags: ['backend']
      });
      expect(backendFeatures).toHaveLength(1);
      expect(backendFeatures[0].id).toBe('sess_auth_feature_123');

      // Search with multiple criteria
      const complexSearch = await sessionStore.listSessions({
        search: 'optimization',
        tags: ['performance', 'database']
      });
      expect(complexSearch).toHaveLength(1);
      expect(complexSearch[0].id).toBe('sess_database_opt_789');
    });

    it('should respect archived session filtering', async () => {
      // Default search (active only)
      const activeSessions = await sessionStore.listSessions();
      expect(activeSessions).toHaveLength(3);
      expect(activeSessions.every(s => !s.isArchived)).toBe(true);

      // Include archived sessions
      const allSessions = await sessionStore.listSessions({ all: true });
      expect(allSessions).toHaveLength(4);
      expect(allSessions.some(s => s.isArchived)).toBe(true);

      // Search in archived sessions
      const archivedPayment = await sessionStore.listSessions({
        search: 'Payment',
        all: true
      });
      expect(archivedPayment).toHaveLength(1);
      expect(archivedPayment[0].isArchived).toBe(true);
    });

    it('should support pagination and sorting', async () => {
      // Test sorting by updatedAt (most recent first)
      const allSessions = await sessionStore.listSessions();
      expect(allSessions[0].id).toBe('sess_auth_feature_123'); // Most recent
      expect(allSessions[1].id).toBe('sess_ui_design_456');
      expect(allSessions[2].id).toBe('sess_database_opt_789'); // Oldest

      // Test pagination with limit
      const limitedSessions = await sessionStore.listSessions({ limit: 2 });
      expect(limitedSessions).toHaveLength(2);
      expect(limitedSessions[0].id).toBe('sess_auth_feature_123');
      expect(limitedSessions[1].id).toBe('sess_ui_design_456');

      // Test limit with search
      const limitedBackend = await sessionStore.listSessions({
        tags: ['backend'],
        limit: 1
      });
      expect(limitedBackend).toHaveLength(1);
      expect(limitedBackend[0].id).toBe('sess_auth_feature_123'); // Most recent backend session
    });
  });

  describe('Feature 6: Auto-Save', () => {
    let testSession: Session;
    let autoSaver: SessionAutoSaver;

    beforeEach(async () => {
      vi.useFakeTimers();

      testSession = createTestSession({
        name: 'Auto-Save Test Session',
        messages: [],
      });

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${testSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(testSession));
        }
        return Promise.reject(new Error('File not found'));
      });

      autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 30000, // 30 seconds as documented
        maxUnsavedMessages: 5, // Auto-save after 5 messages
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      autoSaver?.stop();
    });

    it('should auto-save on timer intervals as documented', async () => {
      await autoSaver.start(testSession.id);

      // Add a message to trigger unsaved changes
      await autoSaver.addMessage({
        role: 'user',
        content: 'Test auto-save functionality'
      });

      expect(autoSaver.hasUnsavedChanges()).toBe(true);

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);
      await vi.runOnlyPendingTimersAsync();

      // Should have auto-saved
      expect(autoSaver.hasUnsavedChanges()).toBe(false);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${testSession.id}.json`),
        expect.any(String)
      );
    });

    it('should auto-save after maximum unsaved messages threshold', async () => {
      await autoSaver.start(testSession.id);

      // Add messages up to the threshold
      for (let i = 0; i < 5; i++) {
        await autoSaver.addMessage({
          role: 'user',
          content: `Test message ${i + 1}`
        });
      }

      // Should have auto-saved after 5 messages
      expect(autoSaver.getUnsavedChangesCount()).toBe(0);
    });

    it('should support intelligent auto-save configuration', async () => {
      // Test different auto-save options
      const intelligentAutoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 60000, // 1 minute
        maxUnsavedMessages: 10,
        saveOnImportantEvents: true, // Custom option
      });

      await intelligentAutoSaver.start(testSession.id);

      // Add state updates
      await intelligentAutoSaver.updateState({
        totalCost: 5.0,
        totalTokens: { input: 10000, output: 5000 },
        tasksCreated: ['task-1'],
        tasksCompleted: ['task-1'],
      });

      expect(intelligentAutoSaver.hasUnsavedChanges()).toBe(true);

      // Manual save
      await intelligentAutoSaver.save();
      expect(intelligentAutoSaver.hasUnsavedChanges()).toBe(false);

      intelligentAutoSaver.stop();
    });

    it('should preserve session state across unexpected shutdowns', async () => {
      await autoSaver.start(testSession.id);

      // Simulate work being done
      await autoSaver.addMessage({
        role: 'user',
        content: 'Important work message'
      });

      await autoSaver.updateState({
        totalCost: 2.5,
        currentTaskId: 'important-task-123'
      });

      // Trigger auto-save
      vi.advanceTimersByTime(30000);
      await vi.runOnlyPendingTimersAsync();

      // Verify session state was persisted
      const savedData = mockFs.writeFile.mock.calls.find(
        call => call[0].toString().includes(`${testSession.id}.json`)
      );

      expect(savedData).toBeDefined();
      const savedSession = JSON.parse(savedData![1] as string);
      expect(savedSession.messages).toHaveLength(1);
      expect(savedSession.state.totalCost).toBe(2.5);
      expect(savedSession.state.currentTaskId).toBe('important-task-123');
    });
  });

  describe('Feature 7: Session Commands Reference', () => {
    let commandTestSession: Session;

    beforeEach(() => {
      commandTestSession = createTestSession({
        id: 'sess_command_test_123',
        name: 'Command Test Session',
        messages: [
          createTestMessage(),
          createAssistantMessage(),
        ],
        tags: ['test', 'commands'],
      });

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${commandTestSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(commandTestSession));
        }
        if (filePath.toString().includes('index.json')) {
          return Promise.resolve(JSON.stringify({
            version: 1,
            sessions: [{
              id: commandTestSession.id,
              name: commandTestSession.name,
              messageCount: commandTestSession.messages.length,
              totalCost: commandTestSession.state.totalCost,
              createdAt: commandTestSession.createdAt,
              updatedAt: commandTestSession.updatedAt,
              tags: commandTestSession.tags,
              isArchived: false,
            }],
            lastUpdated: new Date(),
          }));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should support all documented session commands', async () => {
      // Test /session export (default markdown)
      const markdownExport = await sessionStore.exportSession(commandTestSession.id);
      expect(markdownExport).toContain('# APEX Session: Command Test Session');

      // Test /session export --format json
      const jsonExport = await sessionStore.exportSession(commandTestSession.id, 'json');
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      // Test /session export --format html
      const htmlExport = await sessionStore.exportSession(commandTestSession.id, 'html');
      expect(htmlExport).toContain('<!DOCTYPE html>');

      // Test session listing
      const sessionList = await sessionStore.listSessions();
      expect(sessionList).toHaveLength(1);
      expect(sessionList[0].id).toBe(commandTestSession.id);

      // Test session retrieval
      const retrievedSession = await sessionStore.getSession(commandTestSession.id);
      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession!.name).toBe('Command Test Session');
    });

    it('should support command options and flags as documented', async () => {
      // Test export with output file
      await sessionStore.exportSession(
        commandTestSession.id,
        'json',
        '/test/output/session-backup.json'
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/output/session-backup.json',
        expect.stringContaining('"name": "Command Test Session"')
      );

      // Test list with tag filter
      const taggedSessions = await sessionStore.listSessions({ tags: ['test'] });
      expect(taggedSessions).toHaveLength(1);
      expect(taggedSessions[0].tags).toContain('test');

      // Test list with limit
      const limitedList = await sessionStore.listSessions({ limit: 1 });
      expect(limitedList).toHaveLength(1);

      // Test list with archived flag
      const allSessions = await sessionStore.listSessions({ all: true });
      expect(allSessions).toHaveLength(1);
    });

    it('should provide comprehensive session information', async () => {
      const session = await sessionStore.getSession(commandTestSession.id);

      // Verify all session properties are available for /session info command
      expect(session).toMatchObject({
        id: commandTestSession.id,
        name: 'Command Test Session',
        projectPath: '/test/project',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastAccessedAt: expect.any(Date),
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.any(String),
            timestamp: expect.any(Date),
          }),
        ]),
        inputHistory: expect.any(Array),
        state: expect.objectContaining({
          totalTokens: expect.objectContaining({
            input: expect.any(Number),
            output: expect.any(Number),
          }),
          totalCost: expect.any(Number),
          tasksCreated: expect.any(Array),
          tasksCompleted: expect.any(Array),
        }),
        childSessionIds: expect.any(Array),
        tags: expect.arrayContaining(['test', 'commands']),
      });
    });
  });

  describe('Integration: Complete Session Workflow', () => {
    it('should support the complete documented workflow', async () => {
      vi.useFakeTimers();

      // 1. Create a new session (Feature 1: Persistence)
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const autoSaver = new SessionAutoSaver(sessionStore, {
        enabled: true,
        intervalMs: 30000,
        maxUnsavedMessages: 5,
      });

      const session = await autoSaver.start();
      expect(session).toBeDefined();

      // 2. Add meaningful content
      await autoSaver.addMessage({
        role: 'user',
        content: 'Implement user authentication system'
      });

      await autoSaver.addMessage({
        role: 'assistant',
        content: 'I\'ll help you implement a comprehensive authentication system...',
        agent: 'planner',
        stage: 'planning'
      });

      // 3. Save with name and tags (Feature 4: Named Sessions)
      await autoSaver.updateSessionInfo({
        name: 'Auth Feature Development',
        tags: ['auth', 'feature', 'backend', 'security']
      });

      // 4. Auto-save verification (Feature 6: Auto-Save)
      vi.advanceTimersByTime(30000);
      await vi.runOnlyPendingTimersAsync();
      expect(autoSaver.hasUnsavedChanges()).toBe(false);

      // 5. Create a branch (Feature 3: Session Branching)
      const currentSession = autoSaver.getSession()!;

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${currentSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(currentSession));
        }
        return Promise.reject(new Error('File not found'));
      });

      const branchSession = await sessionStore.branchSession(
        currentSession.id,
        1,
        'OAuth Alternative'
      );

      expect(branchSession.parentSessionId).toBe(currentSession.id);
      expect(branchSession.name).toBe('OAuth Alternative');

      // 6. Export session in multiple formats (Feature 2: Export Formats)
      const markdownExport = await sessionStore.exportSession(currentSession.id, 'md');
      const jsonExport = await sessionStore.exportSession(currentSession.id, 'json');
      const htmlExport = await sessionStore.exportSession(currentSession.id, 'html');

      expect(markdownExport).toContain('Auth Feature Development');
      expect(jsonExport).toContain('"name": "Auth Feature Development"');
      expect(htmlExport).toContain('<title>APEX Session: Auth Feature Development</title>');

      // 7. Search and filter sessions (Feature 5: Session Search)
      const mockIndex = {
        version: 1,
        sessions: [
          {
            id: currentSession.id,
            name: 'Auth Feature Development',
            messageCount: 2,
            totalCost: 0,
            createdAt: currentSession.createdAt,
            updatedAt: currentSession.updatedAt,
            tags: ['auth', 'feature', 'backend', 'security'],
            isArchived: false,
          },
          {
            id: branchSession.id,
            name: 'OAuth Alternative',
            messageCount: 2,
            totalCost: 0,
            createdAt: branchSession.createdAt,
            updatedAt: branchSession.updatedAt,
            tags: [],
            isArchived: false,
          }
        ],
        lastUpdated: new Date(),
      };

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes('index.json')) {
          return Promise.resolve(JSON.stringify(mockIndex));
        }
        if (filePath.toString().includes(`${currentSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(currentSession));
        }
        if (filePath.toString().includes(`${branchSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(branchSession));
        }
        return Promise.reject(new Error('File not found'));
      });

      const authSessions = await sessionStore.listSessions({ tags: ['auth'] });
      expect(authSessions).toHaveLength(1);
      expect(authSessions[0].name).toBe('Auth Feature Development');

      const allSessions = await sessionStore.listSessions();
      expect(allSessions).toHaveLength(2);

      // 8. Verify all documented commands work (Feature 7: Commands Reference)
      const sessionInfo = await sessionStore.getSession(currentSession.id);
      expect(sessionInfo).not.toBeNull();
      expect(sessionInfo!.name).toBe('Auth Feature Development');
      expect(sessionInfo!.tags).toEqual(['auth', 'feature', 'backend', 'security']);

      autoSaver.stop();
      vi.useRealTimers();
    });
  });
});
