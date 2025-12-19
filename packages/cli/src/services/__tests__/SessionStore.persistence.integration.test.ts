import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionStore, Session, SessionMessage, SessionState, ToolCallRecord } from '../SessionStore';

// NO MOCKING - Real file system operations

/**
 * Test data factories
 */
interface TestSessionData {
  name: string;
  messages: TestMessageData[];
  state: Partial<SessionState>;
  tags: string[];
  inputHistory: string[];
}

interface TestMessageData {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agent?: string;
  stage?: string;
  taskId?: string;
  tokens?: { input: number; output: number };
  toolCalls?: TestToolCallData[];
}

interface TestToolCallData {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

/**
 * Helper to create a fully populated session for testing
 */
async function createPopulatedSession(
  store: SessionStore,
  data: TestSessionData
): Promise<Session> {
  const session = await store.createSession(data.name);

  // Add messages via SessionStore update
  for (const msgData of data.messages) {
    const message: SessionMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      index: session.messages.length,
      role: msgData.role,
      content: msgData.content,
      timestamp: new Date(),
      agent: msgData.agent,
      stage: msgData.stage,
      taskId: msgData.taskId,
      tokens: msgData.tokens,
      toolCalls: msgData.toolCalls?.map(tc => ({
        id: `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: tc.name,
        arguments: tc.arguments,
        result: tc.result,
        error: tc.error,
        timestamp: new Date(),
      })),
    };
    session.messages.push(message);
  }

  // Update state
  session.state = { ...session.state, ...data.state };
  session.tags = data.tags;
  session.inputHistory = data.inputHistory;

  await store.updateSession(session.id, session);
  return session;
}

/**
 * Helper to verify session data integrity
 */
function verifySessionIntegrity(
  original: Session,
  restored: Session
): void {
  // Core identity
  expect(restored.id).toBe(original.id);
  expect(restored.name).toBe(original.name);
  expect(restored.projectPath).toBe(original.projectPath);

  // Timestamps (as ISO strings for comparison)
  expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString());

  // Messages
  expect(restored.messages).toHaveLength(original.messages.length);
  for (let i = 0; i < original.messages.length; i++) {
    const origMsg = original.messages[i];
    const restMsg = restored.messages[i];

    expect(restMsg.id).toBe(origMsg.id);
    expect(restMsg.index).toBe(origMsg.index);
    expect(restMsg.role).toBe(origMsg.role);
    expect(restMsg.content).toBe(origMsg.content);
    expect(restMsg.timestamp.toISOString()).toBe(origMsg.timestamp.toISOString());
    expect(restMsg.agent).toBe(origMsg.agent);
    expect(restMsg.stage).toBe(origMsg.stage);
    expect(restMsg.taskId).toBe(origMsg.taskId);
    expect(restMsg.tokens).toEqual(origMsg.tokens);

    // Tool calls
    if (origMsg.toolCalls) {
      expect(restMsg.toolCalls).toHaveLength(origMsg.toolCalls.length);
      for (let j = 0; j < origMsg.toolCalls.length; j++) {
        expect(restMsg.toolCalls![j].id).toBe(origMsg.toolCalls[j].id);
        expect(restMsg.toolCalls![j].name).toBe(origMsg.toolCalls[j].name);
        expect(restMsg.toolCalls![j].arguments).toEqual(origMsg.toolCalls[j].arguments);
        expect(restMsg.toolCalls![j].result).toEqual(origMsg.toolCalls[j].result);
        expect(restMsg.toolCalls![j].timestamp.toISOString())
          .toBe(origMsg.toolCalls[j].timestamp.toISOString());
      }
    }
  }

  // State
  expect(restored.state.totalTokens).toEqual(original.state.totalTokens);
  expect(restored.state.totalCost).toBe(original.state.totalCost);
  expect(restored.state.tasksCreated).toEqual(original.state.tasksCreated);
  expect(restored.state.tasksCompleted).toEqual(original.state.tasksCompleted);
  expect(restored.state.currentTaskId).toBe(original.state.currentTaskId);
  expect(restored.state.lastGitBranch).toBe(original.state.lastGitBranch);

  // Arrays
  expect(restored.inputHistory).toEqual(original.inputHistory);
  expect(restored.tags).toEqual(original.tags);
  expect(restored.childSessionIds).toEqual(original.childSessionIds);
}

describe('SessionStore Persistence Integration Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-session-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic Session Persistence with Restart', () => {
    it('should persist session and load after simulated restart', async () => {
      // STEP 1: Create initial SessionStore and session
      const store1 = new SessionStore(tempDir);
      await store1.initialize();

      const originalSession = await createPopulatedSession(store1, {
        name: 'Persistence Test Session',
        messages: [
          { role: 'user', content: 'Hello APEX' },
          { role: 'assistant', content: 'Hello! How can I help?', agent: 'planner' },
        ],
        state: {
          totalTokens: { input: 50, output: 100 },
          totalCost: 0.25,
          tasksCreated: ['task-1'],
          tasksCompleted: [],
        },
        tags: ['test', 'persistence'],
        inputHistory: ['hello', 'help'],
      });

      // STEP 2: "Restart" - Create new SessionStore instance
      const store2 = new SessionStore(tempDir);
      await store2.initialize();

      // STEP 3: Verify session can be loaded with all data intact
      const loadedSession = await store2.getSession(originalSession.id);
      expect(loadedSession).not.toBeNull();

      verifySessionIntegrity(originalSession, loadedSession!);
    }, 10000);

    it('should preserve session across multiple restart cycles', async () => {
      let sessionId: string;

      // CYCLE 1: Create session
      const store1 = new SessionStore(tempDir);
      await store1.initialize();
      const session1 = await store1.createSession('Multi-Restart Test');
      sessionId = session1.id;

      // Add initial messages
      session1.messages.push({
        id: 'msg_1',
        index: 0,
        role: 'user',
        content: 'First message in cycle 1',
        timestamp: new Date(),
      });
      await store1.updateSession(sessionId, session1);

      // CYCLE 2: First restart - add more data
      const store2 = new SessionStore(tempDir);
      await store2.initialize();
      const session2 = await store2.getSession(sessionId);
      expect(session2).not.toBeNull();
      expect(session2!.messages).toHaveLength(1);

      session2!.messages.push({
        id: 'msg_2',
        index: 1,
        role: 'assistant',
        content: 'Response in cycle 2',
        timestamp: new Date(),
      });
      session2!.state.totalCost = 0.5;
      await store2.updateSession(sessionId, session2!);

      // CYCLE 3: Second restart - verify accumulated data
      const store3 = new SessionStore(tempDir);
      await store3.initialize();
      const session3 = await store3.getSession(sessionId);
      expect(session3).not.toBeNull();
      expect(session3!.messages).toHaveLength(2);
      expect(session3!.state.totalCost).toBe(0.5);

      // Add more data in cycle 3
      session3!.messages.push({
        id: 'msg_3',
        index: 2,
        role: 'user',
        content: 'Third message in cycle 3',
        timestamp: new Date(),
      });
      session3!.tags = ['multi-cycle', 'persistence'];
      await store3.updateSession(sessionId, session3!);

      // CYCLE 4: Final restart - verify all accumulated changes
      const store4 = new SessionStore(tempDir);
      await store4.initialize();
      const finalSession = await store4.getSession(sessionId);

      expect(finalSession).not.toBeNull();
      expect(finalSession!.name).toBe('Multi-Restart Test');
      expect(finalSession!.messages).toHaveLength(3);
      expect(finalSession!.messages[0].content).toBe('First message in cycle 1');
      expect(finalSession!.messages[1].content).toBe('Response in cycle 2');
      expect(finalSession!.messages[2].content).toBe('Third message in cycle 3');
      expect(finalSession!.state.totalCost).toBe(0.5);
      expect(finalSession!.tags).toEqual(['multi-cycle', 'persistence']);
    }, 10000);
  });

  describe('Complex Session Data Persistence', () => {
    it('should preserve messages with tool calls across restart', async () => {
      const store1 = new SessionStore(tempDir);
      await store1.initialize();

      const session = await store1.createSession('Tool Calls Test');

      // Add message with complex tool calls
      const toolCalls: ToolCallRecord[] = [
        {
          id: 'tc_1',
          name: 'Read',
          arguments: { file_path: '/src/index.ts' },
          result: 'export function main() {...}',
          timestamp: new Date(),
        },
        {
          id: 'tc_2',
          name: 'Write',
          arguments: { file_path: '/src/utils.ts', content: 'helper code' },
          result: 'File written successfully',
          timestamp: new Date(),
        },
      ];

      session.messages.push({
        id: 'msg_with_tools',
        index: 0,
        role: 'assistant',
        content: 'Executing file operations',
        timestamp: new Date(),
        agent: 'developer',
        stage: 'implementation',
        taskId: 'impl-task-1',
        tokens: { input: 100, output: 250 },
        toolCalls,
      });

      await store1.updateSession(session.id, session);

      // Restart
      const store2 = new SessionStore(tempDir);
      await store2.initialize();
      const loaded = await store2.getSession(session.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.messages[0].toolCalls).toHaveLength(2);
      expect(loaded!.messages[0].toolCalls![0].name).toBe('Read');
      expect(loaded!.messages[0].toolCalls![0].result).toBe('export function main() {...}');
      expect(loaded!.messages[0].toolCalls![1].name).toBe('Write');
      expect(loaded!.messages[0].toolCalls![1].timestamp).toBeInstanceOf(Date);
    }, 10000);

    it('should preserve session state fields across restart', async () => {
      const store1 = new SessionStore(tempDir);
      await store1.initialize();

      const session = await store1.createSession('State Preservation Test');

      // Set comprehensive state
      session.state = {
        totalTokens: { input: 5000, output: 12000 },
        totalCost: 3.75,
        tasksCreated: ['task-1', 'task-2', 'task-3'],
        tasksCompleted: ['task-1', 'task-2'],
        currentTaskId: 'task-3',
        lastGitBranch: 'feature/apex-session-management',
      };

      await store1.updateSession(session.id, session);

      // Restart
      const store2 = new SessionStore(tempDir);
      await store2.initialize();
      const loaded = await store2.getSession(session.id);

      expect(loaded!.state.totalTokens).toEqual({ input: 5000, output: 12000 });
      expect(loaded!.state.totalCost).toBe(3.75);
      expect(loaded!.state.tasksCreated).toEqual(['task-1', 'task-2', 'task-3']);
      expect(loaded!.state.tasksCompleted).toEqual(['task-1', 'task-2']);
      expect(loaded!.state.currentTaskId).toBe('task-3');
      expect(loaded!.state.lastGitBranch).toBe('feature/apex-session-management');
    }, 10000);

    it('should preserve all timestamp types correctly', async () => {
      const store1 = new SessionStore(tempDir);
      await store1.initialize();

      const now = new Date();
      const session = await store1.createSession('Timestamp Test');

      // Add message with specific timestamp
      const messageTimestamp = new Date(now.getTime() - 60000); // 1 minute ago
      const toolCallTimestamp = new Date(now.getTime() - 30000); // 30 seconds ago

      session.messages.push({
        id: 'ts_msg',
        index: 0,
        role: 'assistant',
        content: 'Testing timestamps',
        timestamp: messageTimestamp,
        toolCalls: [{
          id: 'ts_tool',
          name: 'Test',
          arguments: {},
          timestamp: toolCallTimestamp,
        }],
      });

      await store1.updateSession(session.id, session);

      // Restart
      const store2 = new SessionStore(tempDir);
      await store2.initialize();
      const loaded = await store2.getSession(session.id);

      // All timestamps should be Date objects, not strings
      expect(loaded!.createdAt).toBeInstanceOf(Date);
      expect(loaded!.updatedAt).toBeInstanceOf(Date);
      expect(loaded!.lastAccessedAt).toBeInstanceOf(Date);
      expect(loaded!.messages[0].timestamp).toBeInstanceOf(Date);
      expect(loaded!.messages[0].toolCalls![0].timestamp).toBeInstanceOf(Date);

      // Verify timestamp values match
      expect(loaded!.messages[0].timestamp.toISOString())
        .toBe(messageTimestamp.toISOString());
      expect(loaded!.messages[0].toolCalls![0].timestamp.toISOString())
        .toBe(toolCallTimestamp.toISOString());
    }, 10000);
  });

  describe('Session Index Persistence', () => {
    it('should persist session index across restart', async () => {
      const store1 = new SessionStore(tempDir);
      await store1.initialize();

      // Create multiple sessions
      await store1.createSession('Session A');
      await store1.createSession('Session B');
      await store1.createSession('Session C');

      // Restart
      const store2 = new SessionStore(tempDir);
      await store2.initialize();

      const sessions = await store2.listSessions();
      expect(sessions).toHaveLength(3);
      expect(sessions.map(s => s.name).sort()).toEqual(['Session A', 'Session B', 'Session C']);
    }, 10000);

    it('should persist active session reference across restart', async () => {
      const store1 = new SessionStore(tempDir);
      await store1.initialize();

      const session = await store1.createSession('Active Session Test');
      await store1.setActiveSession(session.id);

      // Restart
      const store2 = new SessionStore(tempDir);
      await store2.initialize();

      const activeId = await store2.getActiveSessionId();
      expect(activeId).toBe(session.id);
    }, 10000);

    it('should persist archived sessions and restore them', async () => {
      const store1 = new SessionStore(tempDir);
      await store1.initialize();

      const session = await store1.createSession('Archive Test');
      session.messages.push({
        id: 'msg_archive',
        index: 0,
        role: 'user',
        content: 'Message to archive',
        timestamp: new Date(),
      });
      await store1.updateSession(session.id, session);
      await store1.archiveSession(session.id);

      // Restart
      const store2 = new SessionStore(tempDir);
      await store2.initialize();

      // Should be able to retrieve archived session
      const archived = await store2.getSession(session.id);
      expect(archived).not.toBeNull();
      expect(archived!.name).toBe('Archive Test');
      expect(archived!.messages[0].content).toBe('Message to archive');
    }, 10000);
  });

  describe('Persistence Edge Cases', () => {
    it('should handle empty session persistence', async () => {
      const store1 = new SessionStore(tempDir);
      await store1.initialize();

      const session = await store1.createSession();
      // Don't add any messages or update state

      // Restart
      const store2 = new SessionStore(tempDir);
      await store2.initialize();

      const loaded = await store2.getSession(session.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.messages).toHaveLength(0);
      expect(loaded!.inputHistory).toHaveLength(0);
    }, 10000);

    it('should handle large session with many messages', async () => {
      const store1 = new SessionStore(tempDir);
      await store1.initialize();

      const session = await store1.createSession('Large Session');

      // Add 100 messages
      for (let i = 0; i < 100; i++) {
        session.messages.push({
          id: `msg_${i}`,
          index: i,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(1000)}`, // ~1KB per message
          timestamp: new Date(),
        });
      }

      await store1.updateSession(session.id, session);

      // Restart
      const store2 = new SessionStore(tempDir);
      await store2.initialize();

      const loaded = await store2.getSession(session.id);
      expect(loaded!.messages).toHaveLength(100);
      expect(loaded!.messages[50].content).toContain('Message 50');
    }, 15000);

    it('should handle concurrent session operations before restart', async () => {
      const store1 = new SessionStore(tempDir);
      await store1.initialize();

      // Create multiple sessions concurrently
      const sessionPromises = Array.from({ length: 5 }, (_, i) =>
        store1.createSession(`Concurrent ${i}`)
      );
      const sessions = await Promise.all(sessionPromises);

      // Update all concurrently
      const updatePromises = sessions.map((s, i) => {
        s.tags = [`tag-${i}`];
        return store1.updateSession(s.id, s);
      });
      await Promise.all(updatePromises);

      // Restart
      const store2 = new SessionStore(tempDir);
      await store2.initialize();

      // Verify all sessions persisted correctly
      for (let i = 0; i < 5; i++) {
        const loaded = await store2.getSession(sessions[i].id);
        expect(loaded).not.toBeNull();
        expect(loaded!.name).toBe(`Concurrent ${i}`);
        expect(loaded!.tags).toContain(`tag-${i}`);
      }
    }, 15000);
  });
});