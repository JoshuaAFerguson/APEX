/**
 * Session Branching Documentation Test
 *
 * Tests that verify session branching functionality matches the CLI Guide
 * documentation examples and workflow patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import { SessionStore, Session } from '../services/SessionStore.js';

vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

const createMainDevelopmentSession = (): Session => ({
  id: 'sess_main_1703123456789',
  name: 'Main Development',
  projectPath: '/test/project',
  createdAt: new Date('2024-12-15T10:30:00.000Z'),
  updatedAt: new Date('2024-12-15T12:45:00.000Z'),
  lastAccessedAt: new Date('2024-12-15T12:45:00.000Z'),
  messages: [
    {
      id: 'msg_001',
      index: 0,
      timestamp: new Date('2024-12-15T10:30:00.000Z'),
      role: 'user',
      content: 'Implement user authentication',
    },
    {
      id: 'msg_002',
      index: 1,
      timestamp: new Date('2024-12-15T10:31:00.000Z'),
      role: 'assistant',
      content: 'I\'ll create a JWT-based auth system...',
    },
    {
      id: 'msg_003',
      index: 2,
      timestamp: new Date('2024-12-15T10:32:00.000Z'),
      role: 'user',
      content: 'Actually, let\'s also consider OAuth',
    },
    {
      id: 'msg_004',
      index: 3,
      timestamp: new Date('2024-12-15T10:33:00.000Z'),
      role: 'assistant',
      content: 'Here\'s a comparison of JWT vs OAuth...',
    },
    {
      id: 'msg_005',
      index: 4,
      timestamp: new Date('2024-12-15T10:34:00.000Z'),
      role: 'user',
      content: 'Let\'s stick with JWT for now',
    },
    {
      id: 'msg_006',
      index: 5,
      timestamp: new Date('2024-12-15T10:35:00.000Z'),
      role: 'assistant',
      content: 'I\'ll implement the JWT solution...',
    },
    {
      id: 'msg_007',
      index: 6,
      timestamp: new Date('2024-12-15T10:36:00.000Z'),
      role: 'user',
      content: 'Add password reset functionality',
    },
  ],
  inputHistory: [],
  state: {
    totalTokens: { input: 5000, output: 3500 },
    totalCost: 0.85,
    tasksCreated: ['task-auth-123'],
    tasksCompleted: [],
  },
  childSessionIds: [],
  tags: ['auth', 'main'],
});

describe('Session Branching Documentation Validation', () => {
  let sessionStore: SessionStore;
  let mainSession: Session;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStore = new SessionStore('/test/project');
    mainSession = createMainDevelopmentSession();

    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockImplementation((filePath) => {
      if (filePath.toString().includes(`${mainSession.id}.json`)) {
        return Promise.resolve(JSON.stringify(mainSession));
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

  describe('Branch from Specific Message Index', () => {
    it('should create branch from message 4 matching documentation example', async () => {
      // Branch from the OAuth comparison point (message 3, 0-based index)
      const branchSession = await sessionStore.branchSession(
        mainSession.id,
        3, // "Here's a comparison of JWT vs OAuth..."
        'OAuth Implementation'
      );

      // Verify branch properties
      expect(branchSession.id).not.toBe(mainSession.id);
      expect(branchSession.id).toMatch(/^sess_\d+_\w+$/);
      expect(branchSession.name).toBe('OAuth Implementation');
      expect(branchSession.parentSessionId).toBe(mainSession.id);
      expect(branchSession.branchPoint).toBe(3);

      // Verify branch contains messages up to branch point (0-3)
      expect(branchSession.messages).toHaveLength(4);
      expect(branchSession.messages[0].content).toBe('Implement user authentication');
      expect(branchSession.messages[1].content).toBe('I\'ll create a JWT-based auth system...');
      expect(branchSession.messages[2].content).toBe('Actually, let\'s also consider OAuth');
      expect(branchSession.messages[3].content).toBe('Here\'s a comparison of JWT vs OAuth...');

      // Verify state is recalculated for branch
      expect(branchSession.state.totalTokens).toBeDefined();
      expect(branchSession.createdAt).toBeInstanceOf(Date);
      expect(branchSession.updatedAt).toBeInstanceOf(Date);

      // Verify parent session is updated with child reference
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${mainSession.id}.json`),
        expect.stringContaining(branchSession.id)
      );
    });

    it('should support creating multiple branches from the same session', async () => {
      // Create OAuth branch
      const oauthBranch = await sessionStore.branchSession(
        mainSession.id,
        3,
        'OAuth Approach'
      );

      // Create Redis caching branch from a different point
      const redisBranch = await sessionStore.branchSession(
        mainSession.id,
        5,
        'Redis Caching'
      );

      expect(oauthBranch.id).not.toBe(redisBranch.id);
      expect(oauthBranch.parentSessionId).toBe(mainSession.id);
      expect(redisBranch.parentSessionId).toBe(mainSession.id);
      expect(oauthBranch.branchPoint).toBe(3);
      expect(redisBranch.branchPoint).toBe(5);

      // OAuth branch should have 4 messages (0-3)
      expect(oauthBranch.messages).toHaveLength(4);
      // Redis branch should have 6 messages (0-5)
      expect(redisBranch.messages).toHaveLength(6);
    });
  });

  describe('Branch from Current Conversation Point', () => {
    it('should create branch from current point when index not specified', async () => {
      const currentPointBranch = await sessionStore.branchSession(
        mainSession.id,
        mainSession.messages.length - 1, // Current point
        'Alternative Approach'
      );

      expect(currentPointBranch.name).toBe('Alternative Approach');
      expect(currentPointBranch.branchPoint).toBe(mainSession.messages.length - 1);
      expect(currentPointBranch.messages).toHaveLength(mainSession.messages.length);
    });
  });

  describe('Auto-Generated Branch Names', () => {
    it('should generate meaningful names when branch name is not provided', async () => {
      const autoBranch = await sessionStore.branchSession(
        mainSession.id,
        2, // Branch from "Actually, let's also consider OAuth"
        undefined // No name provided
      );

      // Should generate a meaningful name including parent session name
      expect(autoBranch.name).toMatch(/^Branch from /);
      expect(autoBranch.name).toContain('Main Development');
      expect(autoBranch.name).toContain('message 2'); // 0-based index reference
    });

    it('should generate unique names for multiple auto-named branches', async () => {
      const autoBranch1 = await sessionStore.branchSession(mainSession.id, 1);
      const autoBranch2 = await sessionStore.branchSession(mainSession.id, 3);

      expect(autoBranch1.name).not.toBe(autoBranch2.name);
      expect(autoBranch1.name).toContain('message 1');
      expect(autoBranch2.name).toContain('message 3');
    });
  });

  describe('Branch Workflow Visualization', () => {
    it('should maintain proper branch relationships as documented', async () => {
      // Create the OAuth branch as shown in documentation
      const oauthBranch = await sessionStore.branchSession(
        mainSession.id,
        3, // After "Here's a comparison of JWT vs OAuth..."
        'OAuth Implementation'
      );

      // Add messages to the OAuth branch
      const oauthWithMessages = {
        ...oauthBranch,
        messages: [
          ...oauthBranch.messages,
          {
            id: 'msg_oauth_001',
            index: 4,
            timestamp: new Date('2024-12-15T10:37:00.000Z'),
            role: 'user' as const,
            content: 'Let\'s go with OAuth',
          },
          {
            id: 'msg_oauth_002',
            index: 5,
            timestamp: new Date('2024-12-15T10:38:00.000Z'),
            role: 'assistant' as const,
            content: 'I\'ll implement OAuth with Google...',
          },
          {
            id: 'msg_oauth_003',
            index: 6,
            timestamp: new Date('2024-12-15T10:39:00.000Z'),
            role: 'user' as const,
            content: 'Add GitHub provider too',
          },
        ],
      };

      // Update main session with child reference
      const updatedMainSession = {
        ...mainSession,
        childSessionIds: [oauthBranch.id],
      };

      // Mock the updated sessions
      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${mainSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(updatedMainSession));
        }
        if (filePath.toString().includes(`${oauthBranch.id}.json`)) {
          return Promise.resolve(JSON.stringify(oauthWithMessages));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Verify parent-child relationship
      const retrievedMain = await sessionStore.getSession(mainSession.id);
      const retrievedOAuth = await sessionStore.getSession(oauthBranch.id);

      expect(retrievedMain!.childSessionIds).toContain(oauthBranch.id);
      expect(retrievedOAuth!.parentSessionId).toBe(mainSession.id);

      // Verify branch divergence
      expect(retrievedMain!.messages).toHaveLength(7); // Original 7 messages
      expect(retrievedOAuth!.messages).toHaveLength(7); // 4 shared + 3 branch-specific
      expect(retrievedMain!.messages[4].content).toBe('Let\'s stick with JWT for now'); // Main path
      expect(retrievedOAuth!.messages[4].content).toBe('Let\'s go with OAuth'); // Branch path
    });
  });

  describe('Session Info with Branches', () => {
    it('should provide complete session info including branch relationships', async () => {
      // Create multiple branches to match documentation example
      const oauthBranch = await sessionStore.branchSession(
        mainSession.id,
        3,
        'OAuth Approach'
      );

      const redisBranch = await sessionStore.branchSession(
        mainSession.id,
        5,
        'Redis Caching'
      );

      // Add some messages to branches to test message count
      const oauthWithMessages = {
        ...oauthBranch,
        messages: [
          ...oauthBranch.messages,
          { id: 'oauth_1', index: 4, role: 'user' as const, content: 'OAuth msg 1', timestamp: new Date() },
          { id: 'oauth_2', index: 5, role: 'assistant' as const, content: 'OAuth msg 2', timestamp: new Date() },
          { id: 'oauth_3', index: 6, role: 'user' as const, content: 'OAuth msg 3', timestamp: new Date() },
      ],
      };

      const redisWithMessages = {
        ...redisBranch,
        messages: [
          ...redisBranch.messages,
          { id: 'redis_1', index: 6, role: 'user' as const, content: 'Redis msg 1', timestamp: new Date() },
          { id: 'redis_2', index: 7, role: 'assistant' as const, content: 'Redis msg 2', timestamp: new Date() },
          { id: 'redis_3', index: 8, role: 'user' as const, content: 'Redis msg 3', timestamp: new Date() },
          { id: 'redis_4', index: 9, role: 'assistant' as const, content: 'Redis msg 4', timestamp: new Date() },
          { id: 'redis_5', index: 10, role: 'user' as const, content: 'Redis msg 5', timestamp: new Date() },
        ],
      };

      // Update main session with child references
      const mainWithChildren = {
        ...mainSession,
        childSessionIds: [oauthBranch.id, redisBranch.id],
      };

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${mainSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(mainWithChildren));
        }
        if (filePath.toString().includes(`${oauthBranch.id}.json`)) {
          return Promise.resolve(JSON.stringify(oauthWithMessages));
        }
        if (filePath.toString().includes(`${redisBranch.id}.json`)) {
          return Promise.resolve(JSON.stringify(redisWithMessages));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Verify session info structure matches documentation
      const sessionInfo = await sessionStore.getSession(mainSession.id);
      expect(sessionInfo).toMatchObject({
        id: mainSession.id,
        name: 'Main Development',
        messages: expect.any(Array),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        parentSessionId: undefined, // No parent
        childSessionIds: expect.arrayContaining([oauthBranch.id, redisBranch.id]),
        state: expect.objectContaining({
          totalCost: expect.any(Number),
          totalTokens: expect.any(Object),
        }),
      });

      // Verify branch sessions have correct parent reference
      const oauthSession = await sessionStore.getSession(oauthBranch.id);
      const redisSession = await sessionStore.getSession(redisBranch.id);

      expect(oauthSession!.parentSessionId).toBe(mainSession.id);
      expect(redisSession!.parentSessionId).toBe(mainSession.id);

      // Verify message counts for documentation example
      expect(sessionInfo!.messages).toHaveLength(7); // Main session: 7 messages
      expect(oauthSession!.messages).toHaveLength(7); // OAuth: 4 shared + 3 branch = 7
      expect(redisSession!.messages).toHaveLength(11); // Redis: 6 shared + 5 branch = 11
    });
  });

  describe('Branch Navigation Commands', () => {
    it('should support switching between parent and child sessions', async () => {
      const branchSession = await sessionStore.branchSession(
        mainSession.id,
        3,
        'OAuth Approach'
      );

      // Mock both sessions for retrieval
      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${mainSession.id}.json`)) {
          return Promise.resolve(JSON.stringify({
            ...mainSession,
            childSessionIds: [branchSession.id],
          }));
        }
        if (filePath.toString().includes(`${branchSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(branchSession));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Test loading parent session from branch
      const parentSession = await sessionStore.getSession(mainSession.id);
      expect(parentSession!.id).toBe(mainSession.id);
      expect(parentSession!.childSessionIds).toContain(branchSession.id);

      // Test loading branch session
      const childSession = await sessionStore.getSession(branchSession.id);
      expect(childSession!.id).toBe(branchSession.id);
      expect(childSession!.parentSessionId).toBe(mainSession.id);
    });
  });

  describe('Branch Tips and Best Practices', () => {
    it('should support exploring "what if" scenarios without losing main conversation', async () => {
      // Original conversation continues on main path
      const mainContinuation = {
        ...mainSession,
        messages: [
          ...mainSession.messages,
          {
            id: 'msg_008',
            index: 7,
            timestamp: new Date('2024-12-15T10:37:00.000Z'),
            role: 'assistant' as const,
            content: 'I\'ve implemented the JWT authentication with password reset...',
          },
        ],
      };

      // Create branch to explore OAuth alternative
      const oauthExploration = await sessionStore.branchSession(
        mainSession.id,
        3, // Branch from OAuth consideration point
        'OAuth Exploration'
      );

      // Verify main session remains intact
      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${mainSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(mainContinuation));
        }
        if (filePath.toString().includes(`${oauthExploration.id}.json`)) {
          return Promise.resolve(JSON.stringify(oauthExploration));
        }
        return Promise.reject(new Error('File not found'));
      });

      const mainPath = await sessionStore.getSession(mainSession.id);
      const branchPath = await sessionStore.getSession(oauthExploration.id);

      // Main conversation continues with JWT
      expect(mainPath!.messages[mainPath!.messages.length - 1].content)
        .toContain('JWT authentication');

      // Branch explores OAuth without affecting main
      expect(branchPath!.messages).toHaveLength(4); // Only messages up to branch point
      expect(branchPath!.messages[3].content).toContain('JWT vs OAuth');
    });
  });
});