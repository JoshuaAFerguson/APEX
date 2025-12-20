import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionStore, Session, SessionMessage, SessionState, ToolCallRecord } from '../SessionStore';

describe('SessionStore State Persistence Integration Tests', () => {
  let testDir: string;
  let store1: SessionStore;
  let store2: SessionStore;

  const createTestSession = (name?: string): Session => {
    const id = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    return {
      id,
      name,
      projectPath: testDir,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
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
    };
  };

  const createTestMessage = (index: number, role: 'user' | 'assistant' = 'user'): SessionMessage => {
    const timestamp = new Date();
    timestamp.setSeconds(timestamp.getSeconds() + index); // Ensure different timestamps

    return {
      id: `msg_${index}`,
      index,
      role,
      content: `Test message ${index}`,
      timestamp,
      tokens: { input: 10 + index * 5, output: 15 + index * 3 },
    };
  };

  const createTestToolCall = (id: string): ToolCallRecord => ({
    id,
    name: 'Read',
    arguments: { file_path: `/test/file_${id}.ts` },
    result: `Content of file ${id}`,
    timestamp: new Date(),
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-session-persistence-test-'));
    await fs.mkdir(path.join(testDir, '.apex', 'sessions'), { recursive: true });

    store1 = new SessionStore(testDir);
    await store1.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Token and Cost Persistence', () => {
    it('should persist totalTokens accumulation across messages through store restarts', async () => {
      const session = await store1.createSession('Token Accumulation Test');

      // Add messages with varying token counts
      const messages: SessionMessage[] = [
        createTestMessage(0, 'user'),
        createTestMessage(1, 'assistant'),
        createTestMessage(2, 'user'),
        createTestMessage(3, 'assistant'),
      ];

      // Set specific token values for predictable testing
      messages[0].tokens = { input: 100, output: 0 };
      messages[1].tokens = { input: 0, output: 150 };
      messages[2].tokens = { input: 200, output: 0 };
      messages[3].tokens = { input: 0, output: 250 };

      // Calculate expected totals
      const expectedInputTokens = 100 + 0 + 200 + 0; // 300
      const expectedOutputTokens = 0 + 150 + 0 + 250; // 400
      const expectedTotalCost = (300 * 0.003 / 1000) + (400 * 0.015 / 1000); // Based on SessionStore rates

      // Add messages progressively and update state
      for (const message of messages) {
        session.messages.push(message);

        // Recalculate state based on all messages so far
        const currentMessages = session.messages;
        session.state.totalTokens = {
          input: currentMessages.reduce((sum, m) => sum + (m.tokens?.input || 0), 0),
          output: currentMessages.reduce((sum, m) => sum + (m.tokens?.output || 0), 0),
        };

        // Update cost calculation (simplified version of SessionStore's private method)
        const tokens = session.state.totalTokens;
        session.state.totalCost = (tokens.input * 0.003 / 1000) + (tokens.output * 0.015 / 1000);

        await store1.updateSession(session.id, {
          messages: session.messages,
          state: session.state,
        });
      }

      // Verify state before restart
      const beforeRestart = await store1.getSession(session.id);
      expect(beforeRestart?.state.totalTokens.input).toBe(expectedInputTokens);
      expect(beforeRestart?.state.totalTokens.output).toBe(expectedOutputTokens);
      expect(beforeRestart?.state.totalCost).toBeCloseTo(expectedTotalCost, 8);

      // Restart store (simulate process restart)
      store2 = new SessionStore(testDir);
      await store2.initialize();

      // Verify persistence after restart
      const afterRestart = await store2.getSession(session.id);
      expect(afterRestart).not.toBeNull();
      expect(afterRestart?.state.totalTokens.input).toBe(expectedInputTokens);
      expect(afterRestart?.state.totalTokens.output).toBe(expectedOutputTokens);
      expect(afterRestart?.state.totalCost).toBeCloseTo(expectedTotalCost, 8);
      expect(afterRestart?.messages.length).toBe(4);
    });

    it('should persist totalCost calculation and survive multiple restarts', async () => {
      const session = await store1.createSession('Cost Persistence Test');

      // Simulate multiple conversation rounds with cost accumulation
      const conversationRounds = [
        { inputTokens: 150, outputTokens: 100, description: 'Round 1' },
        { inputTokens: 300, outputTokens: 200, description: 'Round 2' },
        { inputTokens: 250, outputTokens: 180, description: 'Round 3' },
      ];

      let cumulativeInput = 0;
      let cumulativeOutput = 0;

      for (const [roundIndex, round] of conversationRounds.entries()) {
        // Add messages for this round
        const userMsg = createTestMessage(roundIndex * 2, 'user');
        userMsg.tokens = { input: round.inputTokens, output: 0 };
        const assistantMsg = createTestMessage(roundIndex * 2 + 1, 'assistant');
        assistantMsg.tokens = { input: 0, output: round.outputTokens };

        session.messages.push(userMsg, assistantMsg);

        cumulativeInput += round.inputTokens;
        cumulativeOutput += round.outputTokens;

        // Update session state
        session.state.totalTokens = {
          input: cumulativeInput,
          output: cumulativeOutput,
        };
        session.state.totalCost = (cumulativeInput * 0.003 / 1000) + (cumulativeOutput * 0.015 / 1000);

        await store1.updateSession(session.id, {
          messages: session.messages,
          state: session.state,
        });

        // Restart store after each round (simulate multiple process restarts)
        if (roundIndex < conversationRounds.length - 1) {
          store2 = new SessionStore(testDir);
          await store2.initialize();

          // Verify persistence survives restart
          const intermediate = await store2.getSession(session.id);
          expect(intermediate?.state.totalTokens.input).toBe(cumulativeInput);
          expect(intermediate?.state.totalTokens.output).toBe(cumulativeOutput);

          // Continue with new store instance
          store1 = store2;
        }
      }

      // Final verification after all rounds
      store2 = new SessionStore(testDir);
      await store2.initialize();

      const final = await store2.getSession(session.id);
      expect(final?.state.totalTokens.input).toBe(700); // 150 + 300 + 250
      expect(final?.state.totalTokens.output).toBe(480); // 100 + 200 + 180
      expect(final?.state.totalCost).toBeCloseTo((700 * 0.003 + 480 * 0.015) / 1000, 8);
      expect(final?.messages.length).toBe(6); // 2 messages per round * 3 rounds
    });
  });

  describe('Message History with ToolCalls Persistence', () => {
    it('should persist message history with toolCalls and correct timestamps', async () => {
      const session = await store1.createSession('ToolCalls Persistence Test');

      // Create messages with tool calls
      const baseTime = new Date('2024-01-15T10:00:00Z');

      const userMessage: SessionMessage = {
        id: 'msg_user_1',
        index: 0,
        role: 'user',
        content: 'Please read the config file',
        timestamp: new Date(baseTime.getTime()),
      };

      const assistantMessage: SessionMessage = {
        id: 'msg_assistant_1',
        index: 1,
        role: 'assistant',
        content: 'I will read the config file for you',
        timestamp: new Date(baseTime.getTime() + 1000), // 1 second later
        agent: 'developer',
        stage: 'implementation',
        taskId: 'task_123',
        tokens: { input: 25, output: 35 },
        toolCalls: [
          {
            id: 'tool_call_1',
            name: 'Read',
            arguments: { file_path: '/config/app.yaml' },
            result: 'database:\n  host: localhost\n  port: 5432',
            timestamp: new Date(baseTime.getTime() + 1500), // 1.5 seconds later
          },
          {
            id: 'tool_call_2',
            name: 'Glob',
            arguments: { pattern: '**/*.config.js' },
            result: ['/src/webpack.config.js', '/src/jest.config.js'],
            timestamp: new Date(baseTime.getTime() + 2000), // 2 seconds later
          },
        ],
      };

      const followUpMessage: SessionMessage = {
        id: 'msg_user_2',
        index: 2,
        role: 'user',
        content: 'Now check the database connection',
        timestamp: new Date(baseTime.getTime() + 3000), // 3 seconds later
      };

      // Add messages to session
      session.messages.push(userMessage, assistantMessage, followUpMessage);
      await store1.updateSession(session.id, { messages: session.messages });

      // Verify before restart
      const beforeRestart = await store1.getSession(session.id);
      expect(beforeRestart?.messages.length).toBe(3);
      expect(beforeRestart?.messages[1].toolCalls?.length).toBe(2);
      expect(beforeRestart?.messages[1].toolCalls?.[0].timestamp).toBeInstanceOf(Date);

      // Restart store
      store2 = new SessionStore(testDir);
      await store2.initialize();

      // Verify persistence with exact timestamp preservation
      const afterRestart = await store2.getSession(session.id);
      expect(afterRestart).not.toBeNull();

      // Check message timestamps
      expect(afterRestart?.messages[0].timestamp).toBeInstanceOf(Date);
      expect(afterRestart?.messages[0].timestamp.getTime()).toBe(baseTime.getTime());
      expect(afterRestart?.messages[1].timestamp.getTime()).toBe(baseTime.getTime() + 1000);
      expect(afterRestart?.messages[2].timestamp.getTime()).toBe(baseTime.getTime() + 3000);

      // Check tool call details and timestamps
      const persistedToolCalls = afterRestart?.messages[1].toolCalls;
      expect(persistedToolCalls).toHaveLength(2);

      expect(persistedToolCalls?.[0].id).toBe('tool_call_1');
      expect(persistedToolCalls?.[0].name).toBe('Read');
      expect(persistedToolCalls?.[0].timestamp).toBeInstanceOf(Date);
      expect(persistedToolCalls?.[0].timestamp.getTime()).toBe(baseTime.getTime() + 1500);
      expect(persistedToolCalls?.[0].result).toBe('database:\n  host: localhost\n  port: 5432');

      expect(persistedToolCalls?.[1].id).toBe('tool_call_2');
      expect(persistedToolCalls?.[1].name).toBe('Glob');
      expect(persistedToolCalls?.[1].timestamp).toBeInstanceOf(Date);
      expect(persistedToolCalls?.[1].timestamp.getTime()).toBe(baseTime.getTime() + 2000);
      expect(persistedToolCalls?.[1].result).toEqual(['/src/webpack.config.js', '/src/jest.config.js']);

      // Check message metadata
      expect(afterRestart?.messages[1].agent).toBe('developer');
      expect(afterRestart?.messages[1].stage).toBe('implementation');
      expect(afterRestart?.messages[1].taskId).toBe('task_123');
      expect(afterRestart?.messages[1].tokens).toEqual({ input: 25, output: 35 });
    });

    it('should handle tool calls with errors and complex arguments', async () => {
      const session = await store1.createSession('Complex ToolCalls Test');

      const messageWithErrorToolCall: SessionMessage = {
        id: 'msg_with_error',
        index: 0,
        role: 'assistant',
        content: 'Attempting to run commands',
        timestamp: new Date(),
        toolCalls: [
          {
            id: 'tool_success',
            name: 'Bash',
            arguments: {
              command: 'ls -la',
              timeout: 30000,
              description: 'List directory contents'
            },
            result: 'total 4\ndrwxr-xr-x 2 user user 4096 Jan 15 10:00 .',
            timestamp: new Date(),
          },
          {
            id: 'tool_error',
            name: 'Bash',
            arguments: {
              command: 'nonexistent-command',
              timeout: 30000,
              description: 'This command will fail'
            },
            error: 'Command not found: nonexistent-command',
            timestamp: new Date(),
          },
          {
            id: 'tool_complex_args',
            name: 'Edit',
            arguments: {
              file_path: '/src/complex.ts',
              old_string: 'const oldValue = "test";',
              new_string: 'const newValue = "updated";',
              replace_all: false,
            },
            result: 'File edited successfully',
            timestamp: new Date(),
          },
        ],
      };

      session.messages.push(messageWithErrorToolCall);
      await store1.updateSession(session.id, { messages: session.messages });

      // Restart store
      store2 = new SessionStore(testDir);
      await store2.initialize();

      // Verify complex tool call data persists correctly
      const afterRestart = await store2.getSession(session.id);
      const toolCalls = afterRestart?.messages[0].toolCalls;

      expect(toolCalls).toHaveLength(3);

      // Check successful tool call
      expect(toolCalls?.[0].error).toBeUndefined();
      expect(toolCalls?.[0].result).toContain('total 4');
      expect(toolCalls?.[0].arguments.timeout).toBe(30000);

      // Check errored tool call
      expect(toolCalls?.[1].result).toBeUndefined();
      expect(toolCalls?.[1].error).toBe('Command not found: nonexistent-command');

      // Check complex arguments
      expect(toolCalls?.[2].arguments.replace_all).toBe(false);
      expect(toolCalls?.[2].arguments.old_string).toBe('const oldValue = "test";');
    });
  });

  describe('Session State Fields Persistence', () => {
    it('should persist tasksCreated and tasksCompleted arrays', async () => {
      const session = await store1.createSession('Task Tracking Test');

      // Simulate task creation and completion over time
      const initialState: SessionState = {
        totalTokens: { input: 100, output: 150 },
        totalCost: 0.025,
        tasksCreated: ['task_1', 'task_2'],
        tasksCompleted: [],
      };

      await store1.updateSession(session.id, { state: initialState });

      // Simulate task completion
      const updatedState: SessionState = {
        ...initialState,
        tasksCreated: ['task_1', 'task_2', 'task_3'],
        tasksCompleted: ['task_1'],
      };

      await store1.updateSession(session.id, { state: updatedState });

      // Restart store
      store2 = new SessionStore(testDir);
      await store2.initialize();

      // Verify arrays persist correctly
      const afterRestart = await store2.getSession(session.id);
      expect(afterRestart?.state.tasksCreated).toEqual(['task_1', 'task_2', 'task_3']);
      expect(afterRestart?.state.tasksCompleted).toEqual(['task_1']);

      // Continue updating state
      const finalState: SessionState = {
        ...updatedState,
        tasksCreated: ['task_1', 'task_2', 'task_3', 'task_4'],
        tasksCompleted: ['task_1', 'task_2', 'task_3'],
      };

      await store2.updateSession(session.id, { state: finalState });

      // Another restart
      const store3 = new SessionStore(testDir);
      await store3.initialize();

      const final = await store3.getSession(session.id);
      expect(final?.state.tasksCreated).toEqual(['task_1', 'task_2', 'task_3', 'task_4']);
      expect(final?.state.tasksCompleted).toEqual(['task_1', 'task_2', 'task_3']);
    });

    it('should persist currentTaskId and lastGitBranch state fields', async () => {
      const session = await store1.createSession('Current State Test');

      // Set initial current task and git branch
      const stateWithCurrent: SessionState = {
        totalTokens: { input: 50, output: 75 },
        totalCost: 0.012,
        tasksCreated: ['task_current'],
        tasksCompleted: [],
        currentTaskId: 'task_current',
        lastGitBranch: 'feature/user-auth',
      };

      await store1.updateSession(session.id, { state: stateWithCurrent });

      // Restart store
      store2 = new SessionStore(testDir);
      await store2.initialize();

      // Verify current state fields persist
      const afterRestart = await store2.getSession(session.id);
      expect(afterRestart?.state.currentTaskId).toBe('task_current');
      expect(afterRestart?.state.lastGitBranch).toBe('feature/user-auth');

      // Update current state
      const updatedState: SessionState = {
        ...stateWithCurrent,
        currentTaskId: 'task_next',
        lastGitBranch: 'feature/database-migration',
        tasksCreated: ['task_current', 'task_next'],
        tasksCompleted: ['task_current'],
      };

      await store2.updateSession(session.id, { state: updatedState });

      // Another restart
      const store3 = new SessionStore(testDir);
      await store3.initialize();

      const final = await store3.getSession(session.id);
      expect(final?.state.currentTaskId).toBe('task_next');
      expect(final?.state.lastGitBranch).toBe('feature/database-migration');
    });

    it('should handle undefined/null state fields correctly', async () => {
      const session = await store1.createSession('Nullable State Test');

      // Set state with undefined optional fields
      const stateWithUndefined: SessionState = {
        totalTokens: { input: 25, output: 40 },
        totalCost: 0.007,
        tasksCreated: ['task_1'],
        tasksCompleted: [],
        currentTaskId: undefined,
        lastGitBranch: undefined,
      };

      await store1.updateSession(session.id, { state: stateWithUndefined });

      // Restart store
      store2 = new SessionStore(testDir);
      await store2.initialize();

      // Verify undefined fields are preserved
      const afterRestart = await store2.getSession(session.id);
      expect(afterRestart?.state.currentTaskId).toBeUndefined();
      expect(afterRestart?.state.lastGitBranch).toBeUndefined();

      // Set values then clear them
      await store2.updateSession(session.id, {
        state: {
          ...afterRestart!.state,
          currentTaskId: 'temp_task',
          lastGitBranch: 'temp_branch',
        },
      });

      // Clear them again
      await store2.updateSession(session.id, {
        state: {
          ...afterRestart!.state,
          currentTaskId: undefined,
          lastGitBranch: undefined,
        },
      });

      // Final restart
      const store3 = new SessionStore(testDir);
      await store3.initialize();

      const final = await store3.getSession(session.id);
      expect(final?.state.currentTaskId).toBeUndefined();
      expect(final?.state.lastGitBranch).toBeUndefined();
    });
  });

  describe('Date Object Serialization/Deserialization', () => {
    it('should correctly serialize and deserialize all Date objects', async () => {
      const session = await store1.createSession('Date Serialization Test');

      // Set specific test dates
      const createdAt = new Date('2024-01-10T08:00:00.000Z');
      const updatedAt = new Date('2024-01-10T12:30:15.500Z');
      const lastAccessedAt = new Date('2024-01-10T16:45:30.750Z');

      await store1.updateSession(session.id, {
        createdAt,
        updatedAt,
        lastAccessedAt,
      });

      // Add messages with precise timestamps
      const messagesWithTimestamps: SessionMessage[] = [
        {
          id: 'msg_precise_1',
          index: 0,
          role: 'user',
          content: 'Test message',
          timestamp: new Date('2024-01-10T10:15:25.123Z'),
        },
        {
          id: 'msg_precise_2',
          index: 1,
          role: 'assistant',
          content: 'Response message',
          timestamp: new Date('2024-01-10T10:15:30.987Z'),
          toolCalls: [
            {
              id: 'precise_tool_call',
              name: 'Read',
              arguments: { file_path: '/test.ts' },
              result: 'file content',
              timestamp: new Date('2024-01-10T10:15:32.456Z'),
            },
          ],
        },
      ];

      await store1.updateSession(session.id, { messages: messagesWithTimestamps });

      // Verify before restart
      const beforeRestart = await store1.getSession(session.id);
      expect(beforeRestart?.createdAt).toBeInstanceOf(Date);
      expect(beforeRestart?.createdAt.getTime()).toBe(createdAt.getTime());

      // Restart store
      store2 = new SessionStore(testDir);
      await store2.initialize();

      // Verify Date objects are properly reconstructed with exact precision
      const afterRestart = await store2.getSession(session.id);
      expect(afterRestart).not.toBeNull();

      // Session-level dates
      expect(afterRestart?.createdAt).toBeInstanceOf(Date);
      expect(afterRestart?.updatedAt).toBeInstanceOf(Date);
      expect(afterRestart?.lastAccessedAt).toBeInstanceOf(Date);

      expect(afterRestart?.createdAt.getTime()).toBe(createdAt.getTime());
      expect(afterRestart?.updatedAt.getTime()).toBe(updatedAt.getTime());
      expect(afterRestart?.lastAccessedAt.getTime()).toBe(lastAccessedAt.getTime());

      // Message-level dates
      expect(afterRestart?.messages[0].timestamp).toBeInstanceOf(Date);
      expect(afterRestart?.messages[1].timestamp).toBeInstanceOf(Date);
      expect(afterRestart?.messages[0].timestamp.getTime()).toBe(messagesWithTimestamps[0].timestamp.getTime());
      expect(afterRestart?.messages[1].timestamp.getTime()).toBe(messagesWithTimestamps[1].timestamp.getTime());

      // Tool call dates
      const persistedToolCall = afterRestart?.messages[1].toolCalls?.[0];
      expect(persistedToolCall?.timestamp).toBeInstanceOf(Date);
      expect(persistedToolCall?.timestamp.getTime()).toBe(messagesWithTimestamps[1].toolCalls![0].timestamp.getTime());

      // Verify millisecond precision is maintained
      expect(afterRestart?.updatedAt.getMilliseconds()).toBe(500);
      expect(afterRestart?.lastAccessedAt.getMilliseconds()).toBe(750);
      expect(afterRestart?.messages[0].timestamp.getMilliseconds()).toBe(123);
      expect(persistedToolCall?.timestamp.getMilliseconds()).toBe(456);
    });

    it('should handle Date edge cases and timezone preservation', async () => {
      const session = await store1.createSession('Date Edge Cases Test');

      // Test various date edge cases
      const edgeCaseDates = {
        unixEpoch: new Date(0), // January 1, 1970 00:00:00 UTC
        yearEnd: new Date('2023-12-31T23:59:59.999Z'),
        yearStart: new Date('2024-01-01T00:00:00.000Z'),
        leapYear: new Date('2024-02-29T12:00:00.000Z'),
        farFuture: new Date('2099-12-31T23:59:59.999Z'),
      };

      const edgeMessage: SessionMessage = {
        id: 'edge_msg',
        index: 0,
        role: 'system',
        content: 'Edge case test message',
        timestamp: edgeCaseDates.leapYear,
      };

      await store1.updateSession(session.id, {
        createdAt: edgeCaseDates.unixEpoch,
        updatedAt: edgeCaseDates.yearEnd,
        lastAccessedAt: edgeCaseDates.farFuture,
        messages: [edgeMessage],
      });

      // Restart store
      store2 = new SessionStore(testDir);
      await store2.initialize();

      // Verify edge case dates persist correctly
      const afterRestart = await store2.getSession(session.id);

      expect(afterRestart?.createdAt.getTime()).toBe(edgeCaseDates.unixEpoch.getTime());
      expect(afterRestart?.updatedAt.getTime()).toBe(edgeCaseDates.yearEnd.getTime());
      expect(afterRestart?.lastAccessedAt.getTime()).toBe(edgeCaseDates.farFuture.getTime());
      expect(afterRestart?.messages[0].timestamp.getTime()).toBe(edgeCaseDates.leapYear.getTime());

      // Verify specific edge case properties
      expect(afterRestart?.createdAt.getUTCFullYear()).toBe(1970);
      expect(afterRestart?.updatedAt.getUTCDate()).toBe(31);
      expect(afterRestart?.updatedAt.getUTCMonth()).toBe(11); // December
      expect(afterRestart?.messages[0].timestamp.getUTCDate()).toBe(29); // Leap day
      expect(afterRestart?.messages[0].timestamp.getUTCMonth()).toBe(1); // February
    });
  });

  describe('Complex Persistence Scenarios', () => {
    it('should persist complete session lifecycle across multiple store operations and restarts', async () => {
      const session = await store1.createSession('Lifecycle Test');

      // Phase 1: Initial conversation setup
      const phase1Messages: SessionMessage[] = [
        {
          id: 'lifecycle_1',
          index: 0,
          role: 'user',
          content: 'Start a new feature implementation',
          timestamp: new Date('2024-01-10T09:00:00Z'),
        },
        {
          id: 'lifecycle_2',
          index: 1,
          role: 'assistant',
          content: 'I will help you implement the feature',
          timestamp: new Date('2024-01-10T09:01:00Z'),
          agent: 'planner',
          tokens: { input: 15, output: 25 },
        },
      ];

      const phase1State: SessionState = {
        totalTokens: { input: 15, output: 25 },
        totalCost: 0.0006,
        tasksCreated: ['feature_task_1'],
        tasksCompleted: [],
        currentTaskId: 'feature_task_1',
        lastGitBranch: 'feature/new-implementation',
      };

      await store1.updateSession(session.id, {
        messages: phase1Messages,
        state: phase1State,
        tags: ['feature', 'planning'],
      });

      // Restart 1
      store2 = new SessionStore(testDir);
      await store2.initialize();

      let persisted = await store2.getSession(session.id);
      expect(persisted?.messages.length).toBe(2);
      expect(persisted?.state.currentTaskId).toBe('feature_task_1');
      expect(persisted?.tags).toEqual(['feature', 'planning']);

      // Phase 2: Add implementation with tool calls
      const implementationMessage: SessionMessage = {
        id: 'lifecycle_3',
        index: 2,
        role: 'assistant',
        content: 'Creating the feature files',
        timestamp: new Date('2024-01-10T10:00:00Z'),
        agent: 'developer',
        stage: 'implementation',
        tokens: { input: 30, output: 45 },
        toolCalls: [
          {
            id: 'create_file',
            name: 'Write',
            arguments: { file_path: '/src/feature.ts', content: 'export const feature = () => {}' },
            result: 'File created successfully',
            timestamp: new Date('2024-01-10T10:01:00Z'),
          },
        ],
      };

      const phase2State: SessionState = {
        totalTokens: { input: 45, output: 70 },
        totalCost: 0.00138,
        tasksCreated: ['feature_task_1', 'feature_task_2'],
        tasksCompleted: ['feature_task_1'],
        currentTaskId: 'feature_task_2',
        lastGitBranch: 'feature/new-implementation',
      };

      persisted!.messages.push(implementationMessage);
      await store2.updateSession(session.id, {
        messages: persisted!.messages,
        state: phase2State,
        tags: ['feature', 'implementation'],
      });

      // Restart 2
      const store3 = new SessionStore(testDir);
      await store3.initialize();

      persisted = await store3.getSession(session.id);
      expect(persisted?.messages.length).toBe(3);
      expect(persisted?.state.tasksCompleted).toEqual(['feature_task_1']);
      expect(persisted?.state.currentTaskId).toBe('feature_task_2');
      expect(persisted?.tags).toEqual(['feature', 'implementation']);
      expect(persisted?.messages[2].toolCalls?.[0].name).toBe('Write');

      // Phase 3: Final completion
      const completionMessage: SessionMessage = {
        id: 'lifecycle_4',
        index: 3,
        role: 'user',
        content: 'Great! The feature is complete.',
        timestamp: new Date('2024-01-10T11:00:00Z'),
      };

      const finalState: SessionState = {
        totalTokens: { input: 45, output: 70 },
        totalCost: 0.00138,
        tasksCreated: ['feature_task_1', 'feature_task_2'],
        tasksCompleted: ['feature_task_1', 'feature_task_2'],
        currentTaskId: undefined,
        lastGitBranch: 'feature/new-implementation',
      };

      persisted!.messages.push(completionMessage);
      await store3.updateSession(session.id, {
        messages: persisted!.messages,
        state: finalState,
        tags: ['feature', 'completed'],
      });

      // Final restart
      const store4 = new SessionStore(testDir);
      await store4.initialize();

      const final = await store4.getSession(session.id);
      expect(final?.messages.length).toBe(4);
      expect(final?.state.tasksCompleted).toEqual(['feature_task_1', 'feature_task_2']);
      expect(final?.state.currentTaskId).toBeUndefined();
      expect(final?.tags).toEqual(['feature', 'completed']);

      // Verify all timestamps are preserved correctly across all restarts
      expect(final?.messages[0].timestamp.getTime()).toBe(new Date('2024-01-10T09:00:00Z').getTime());
      expect(final?.messages[2].toolCalls?.[0].timestamp.getTime()).toBe(new Date('2024-01-10T10:01:00Z').getTime());
    });

    it('should handle session branching with state inheritance', async () => {
      const parentSession = await store1.createSession('Parent Session');

      // Setup parent session with rich state
      const parentMessages: SessionMessage[] = [
        createTestMessage(0, 'user'),
        createTestMessage(1, 'assistant'),
        createTestMessage(2, 'user'),
      ];

      const parentState: SessionState = {
        totalTokens: { input: 300, output: 200 },
        totalCost: 0.024,
        tasksCreated: ['parent_task_1', 'parent_task_2'],
        tasksCompleted: ['parent_task_1'],
        currentTaskId: 'parent_task_2',
        lastGitBranch: 'feature/parent',
      };

      await store1.updateSession(parentSession.id, {
        messages: parentMessages,
        state: parentState,
      });

      // Create a branch at message index 1
      const branchedSession = await store1.branchSession(
        parentSession.id,
        1,
        'Branched Session'
      );

      // Restart store
      store2 = new SessionStore(testDir);
      await store2.initialize();

      // Verify both sessions persist correctly
      const persistedParent = await store2.getSession(parentSession.id);
      const persistedBranch = await store2.getSession(branchedSession.id);

      expect(persistedParent?.messages.length).toBe(3);
      expect(persistedBranch?.messages.length).toBe(2); // Branched at index 1

      expect(persistedParent?.childSessionIds).toContain(branchedSession.id);
      expect(persistedBranch?.parentSessionId).toBe(parentSession.id);
      expect(persistedBranch?.branchPoint).toBe(1);

      // Verify state inheritance in branch (tokens should be recalculated for branch)
      expect(persistedBranch?.state.tasksCreated).toEqual(parentState.tasksCreated);
      expect(persistedBranch?.state.tasksCompleted).toEqual(parentState.tasksCompleted);
    });
  });

  describe('JSON File Integrity', () => {
    it('should maintain JSON file integrity across multiple operations and restarts', async () => {
      // Create multiple sessions with various states
      const sessions: Session[] = [];

      for (let i = 0; i < 5; i++) {
        const session = await store1.createSession(`Test Session ${i}`);

        // Add messages and state
        const messages: SessionMessage[] = [
          createTestMessage(0, 'user'),
          createTestMessage(1, 'assistant'),
        ];
        messages[1].toolCalls = [createTestToolCall(`tool_${i}`)];

        const state: SessionState = {
          totalTokens: { input: i * 100, output: i * 75 },
          totalCost: i * 0.01,
          tasksCreated: [`task_${i}_1`, `task_${i}_2`],
          tasksCompleted: i > 2 ? [`task_${i}_1`] : [],
          currentTaskId: `task_${i}_2`,
          lastGitBranch: `feature/test_${i}`,
        };

        await store1.updateSession(session.id, {
          messages,
          state,
          tags: [`test_${i}`, 'automation'],
        });

        sessions.push(session);
      }

      // Restart store
      store2 = new SessionStore(testDir);
      await store2.initialize();

      // Verify all sessions and their data persist correctly
      for (let i = 0; i < 5; i++) {
        const persisted = await store2.getSession(sessions[i].id);

        expect(persisted).not.toBeNull();
        expect(persisted?.name).toBe(`Test Session ${i}`);
        expect(persisted?.messages.length).toBe(2);
        expect(persisted?.messages[1].toolCalls?.length).toBe(1);
        expect(persisted?.state.totalTokens.input).toBe(i * 100);
        expect(persisted?.state.currentTaskId).toBe(`task_${i}_2`);
        expect(persisted?.tags).toContain(`test_${i}`);
      }

      // Verify session listing works correctly
      const allSessions = await store2.listSessions();
      expect(allSessions.length).toBe(5);

      // Verify session files exist and are valid JSON
      for (const session of sessions) {
        const sessionPath = path.join(testDir, '.apex', 'sessions', `${session.id}.json`);
        const fileExists = await fs.access(sessionPath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);

        const fileContent = await fs.readFile(sessionPath, 'utf-8');
        expect(() => JSON.parse(fileContent)).not.toThrow();
      }
    });
  });
});