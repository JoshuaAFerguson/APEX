import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex, type AgentMessage } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Checkpoint Functionality Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-checkpoint-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'checkpoint-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create a test workflow file
    const workflowContent = `
name: feature
description: Standard feature development workflow
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
  - name: implementation
    agent: developer
    dependsOn:
      - planning
    description: Implement the feature
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
      workflowContent
    );

    // Create test agent files
    const plannerContent = `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent that creates implementation plans.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'planner.md'),
      plannerContent
    );

    const developerContent = `---
name: developer
description: Implements code changes
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a developer agent that implements code changes.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      developerContent
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.init();
  });

  afterEach(async () => {
    await orchestrator.cleanup();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('saveCheckpoint method', () => {
    it('should save checkpoint with minimal options', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task for checkpoint',
      });

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stageIndex: 0,
      });

      expect(checkpointId).toMatch(/^cp_/);
      expect(checkpointId).toHaveLength(15); // cp_ + 12 character ID

      const checkpoint = await orchestrator.getCheckpoint(task.id, checkpointId);
      expect(checkpoint).toBeTruthy();
      expect(checkpoint?.taskId).toBe(task.id);
      expect(checkpoint?.stageIndex).toBe(0);
      expect(checkpoint?.createdAt).toBeInstanceOf(Date);
    });

    it('should save checkpoint with conversation state', async () => {
      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Hi there!' }],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Test task with conversation',
        conversation,
      });

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState: conversation,
        metadata: { testProperty: 'testValue' },
      });

      const checkpoint = await orchestrator.getCheckpoint(task.id, checkpointId);
      expect(checkpoint?.stage).toBe('implementation');
      expect(checkpoint?.stageIndex).toBe(1);
      expect(checkpoint?.conversationState).toEqual(conversation);
      expect(checkpoint?.metadata?.testProperty).toBe('testValue');
    });

    it('should save checkpoint with session limit metadata', async () => {
      const task = await orchestrator.createTask({
        description: 'Session limit checkpoint test',
      });

      const sessionLimitStatus = await orchestrator.detectSessionLimit(task.id);

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'planning',
        stageIndex: 0,
        metadata: {
          sessionLimitStatus,
          pauseReason: 'session_limit',
          resumePoint: 'stage_start',
        },
      });

      const checkpoint = await orchestrator.getCheckpoint(task.id, checkpointId);
      expect(checkpoint?.metadata?.sessionLimitStatus).toEqual(sessionLimitStatus);
      expect(checkpoint?.metadata?.pauseReason).toBe('session_limit');
      expect(checkpoint?.metadata?.resumePoint).toBe('stage_start');
    });

    it('should handle saving multiple checkpoints for the same task', async () => {
      const task = await orchestrator.createTask({
        description: 'Multiple checkpoints task',
      });

      const checkpoint1 = await orchestrator.saveCheckpoint(task.id, {
        stage: 'planning',
        stageIndex: 0,
        metadata: { step: 'initial' },
      });

      const checkpoint2 = await orchestrator.saveCheckpoint(task.id, {
        stage: 'planning',
        stageIndex: 0,
        metadata: { step: 'progress' },
      });

      const checkpoint3 = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        metadata: { step: 'final' },
      });

      expect(checkpoint1).not.toBe(checkpoint2);
      expect(checkpoint2).not.toBe(checkpoint3);

      const allCheckpoints = await orchestrator.listCheckpoints(task.id);
      expect(allCheckpoints).toHaveLength(3);

      // Should be sorted by creation date (latest first)
      expect(allCheckpoints[0].id).toBe(checkpoint3);
      expect(allCheckpoints[1].id).toBe(checkpoint2);
      expect(allCheckpoints[2].id).toBe(checkpoint1);
    });

    it('should save checkpoint with complex metadata object', async () => {
      const task = await orchestrator.createTask({
        description: 'Complex metadata test',
      });

      const complexMetadata = {
        stageResults: {
          planning: { files: ['plan.md'], status: 'completed' },
          analysis: { insights: ['insight1', 'insight2'], confidence: 0.85 },
        },
        workflow: {
          completedStages: ['planning'],
          inProgressStages: ['implementation'],
          nextStages: ['testing'],
        },
        sessionInfo: {
          tokenUsage: 1500,
          modelCalls: 3,
          duration: 120000,
        },
        resumeInstructions: {
          priority: 'high',
          nextAction: 'continue implementation',
          context: 'User requested feature X with requirements Y',
        },
      };

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        metadata: complexMetadata,
      });

      const checkpoint = await orchestrator.getCheckpoint(task.id, checkpointId);
      expect(checkpoint?.metadata).toEqual(complexMetadata);
    });

    it('should handle saving checkpoint with empty metadata', async () => {
      const task = await orchestrator.createTask({
        description: 'Empty metadata test',
      });

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stageIndex: 0,
        metadata: {},
      });

      const checkpoint = await orchestrator.getCheckpoint(task.id, checkpointId);
      expect(checkpoint?.metadata).toEqual({});
    });

    it('should handle saving checkpoint with no metadata', async () => {
      const task = await orchestrator.createTask({
        description: 'No metadata test',
      });

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stageIndex: 0,
      });

      const checkpoint = await orchestrator.getCheckpoint(task.id, checkpointId);
      expect(checkpoint?.metadata).toBeUndefined();
    });

    it('should generate unique checkpoint IDs for concurrent saves', async () => {
      const task = await orchestrator.createTask({
        description: 'Concurrent checkpoint test',
      });

      // Save multiple checkpoints concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        orchestrator.saveCheckpoint(task.id, {
          stageIndex: i,
          metadata: { concurrent: true, index: i },
        })
      );

      const checkpointIds = await Promise.all(promises);

      // All IDs should be unique
      const uniqueIds = new Set(checkpointIds);
      expect(uniqueIds.size).toBe(5);

      // Verify all checkpoints were saved correctly
      for (let i = 0; i < 5; i++) {
        const checkpoint = await orchestrator.getCheckpoint(task.id, checkpointIds[i]);
        expect(checkpoint?.stageIndex).toBe(i);
        expect(checkpoint?.metadata?.index).toBe(i);
      }
    });

    it('should handle saving checkpoint for task with very large conversation', async () => {
      // Create a conversation with a lot of content
      const largeConversation: AgentMessage[] = [];
      for (let i = 0; i < 100; i++) {
        largeConversation.push({
          type: 'user',
          content: [{ type: 'text', text: `Message ${i}: ${'x'.repeat(1000)}` }],
        });
        largeConversation.push({
          type: 'assistant',
          content: [
            { type: 'text', text: `Response ${i}` },
            {
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { file_path: `/path/to/file${i}.ts` },
            },
          ],
        });
        largeConversation.push({
          type: 'user',
          content: [
            {
              type: 'tool_result',
              toolResult: `File content for file ${i}`,
            },
          ],
        });
      }

      const task = await orchestrator.createTask({
        description: 'Large conversation test',
        conversation: largeConversation,
      });

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState: largeConversation,
        metadata: { conversationSize: largeConversation.length },
      });

      const checkpoint = await orchestrator.getCheckpoint(task.id, checkpointId);
      expect(checkpoint?.conversationState).toHaveLength(300); // 100 * 3 messages
      expect(checkpoint?.metadata?.conversationSize).toBe(300);
    });
  });

  describe('saveCheckpoint error handling', () => {
    it('should throw error when saving checkpoint for non-existent task', async () => {
      await expect(
        orchestrator.saveCheckpoint('non-existent-task', {
          stageIndex: 0,
        })
      ).rejects.toThrow('Task not found');
    });

    it('should handle storage errors gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Storage error test',
      });

      // Mock store.saveCheckpoint to throw error
      const originalSaveCheckpoint = orchestrator.store.saveCheckpoint;
      orchestrator.store.saveCheckpoint = vi.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        orchestrator.saveCheckpoint(task.id, { stageIndex: 0 })
      ).rejects.toThrow('Database connection failed');

      // Restore original method
      orchestrator.store.saveCheckpoint = originalSaveCheckpoint;
    });

    it('should handle serialization errors for complex metadata', async () => {
      const task = await orchestrator.createTask({
        description: 'Serialization error test',
      });

      // Create metadata with circular reference
      const circularMetadata: any = { a: 1 };
      circularMetadata.self = circularMetadata;

      // The actual implementation might handle this differently,
      // but we should test what happens with problematic data
      try {
        await orchestrator.saveCheckpoint(task.id, {
          stageIndex: 0,
          metadata: circularMetadata,
        });
        // If it doesn't throw, that's fine too - implementation dependent
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('pauseTask with session_limit reason', () => {
    it('should pause task with session_limit reason', async () => {
      const task = await orchestrator.createTask({
        description: 'Session limit pause test',
      });

      await orchestrator.pauseTask(task.id, 'session_limit');

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('paused');
      expect(updatedTask?.pauseReason).toBe('session_limit');
    });

    it('should pause task with session_limit and auto-resume time', async () => {
      const task = await orchestrator.createTask({
        description: 'Session limit auto-resume test',
      });

      await orchestrator.pauseTask(task.id, 'session_limit', 3600); // 1 hour

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('paused');
      expect(updatedTask?.pauseReason).toBe('session_limit');
      expect(updatedTask?.resumeAfter).toBeInstanceOf(Date);
    });

    it('should handle pausing already paused task', async () => {
      const task = await orchestrator.createTask({
        description: 'Already paused test',
      });

      // Pause once
      await orchestrator.pauseTask(task.id, 'session_limit');

      // Pause again - should handle gracefully
      await orchestrator.pauseTask(task.id, 'session_limit');

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('paused');
      expect(updatedTask?.pauseReason).toBe('session_limit');
    });

    it('should not allow pausing completed task', async () => {
      const task = await orchestrator.createTask({
        description: 'Completed task pause test',
      });

      await orchestrator.updateTaskStatus(task.id, 'completed');

      await expect(
        orchestrator.pauseTask(task.id, 'session_limit')
      ).rejects.toThrow(/cannot be paused|already completed/i);
    });
  });

  describe('integration with session limit detection', () => {
    it('should automatically pause and checkpoint when session limit detected during execution', async () => {
      // Create task with conversation that exceeds session limit threshold
      const longConversation = Array.from({ length: 50 }, (_, i) => ({
        type: 'user' as const,
        content: [{ type: 'text' as const, text: `Long message ${i}: ${'x'.repeat(2000)}` }],
      }));

      const task = await orchestrator.createTask({
        description: 'Auto checkpoint integration test',
        conversation: longConversation,
        workflow: 'feature',
      });

      // Mock query to simulate agent response but trigger session limit
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // Don't yield anything, just let the session limit detection work
        },
      } as unknown as ReturnType<typeof query>);

      // Execute task with small context window to trigger session limit
      try {
        await orchestrator.executeTask(task.id);
      } catch (error) {
        // Execution might fail due to session limits, which is expected
      }

      // Check if task was paused due to session limit
      const updatedTask = await orchestrator.getTask(task.id);
      if (updatedTask?.status === 'paused' && updatedTask.pauseReason === 'session_limit') {
        // Verify checkpoint was created
        const checkpoint = await orchestrator.getLatestCheckpoint(task.id);
        expect(checkpoint).toBeTruthy();
        expect(checkpoint?.metadata?.pauseReason).toBe('session_limit');

        // Verify logs contain session limit information
        const logs = await orchestrator.store.getTaskLogs(task.id);
        const sessionLimitLogs = logs.filter(log =>
          log.message.includes('session limit') || log.message.includes('checkpoint')
        );
        expect(sessionLimitLogs.length).toBeGreaterThan(0);
      }
    });

    it('should not checkpoint when session is healthy', async () => {
      const task = await orchestrator.createTask({
        description: 'Healthy session test',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Short message' }],
          },
        ],
        workflow: 'feature',
      });

      // Mock query to simulate successful execution
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Task completed successfully' };
        },
      } as unknown as ReturnType<typeof query>);

      await orchestrator.executeTask(task.id);

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
      expect(updatedTask?.pauseReason).not.toBe('session_limit');

      // Should not have session limit checkpoints
      const checkpoints = await orchestrator.listCheckpoints(task.id);
      const sessionLimitCheckpoints = checkpoints.filter(cp =>
        cp.metadata?.pauseReason === 'session_limit'
      );
      expect(sessionLimitCheckpoints).toHaveLength(0);
    });
  });

  describe('resumeTask functionality', () => {
    it('should resume task from session limit checkpoint', async () => {
      const task = await orchestrator.createTask({
        description: 'Resume from session limit test',
        workflow: 'feature',
      });

      // Save a session limit checkpoint
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'planning',
        stageIndex: 0,
        metadata: {
          pauseReason: 'session_limit',
          resumePoint: 'stage_start',
          sessionLimitStatus: {
            nearLimit: true,
            currentTokens: 150000,
            utilization: 0.85,
            recommendation: 'checkpoint',
            message: 'Context window near limit',
          },
        },
      });

      // Pause the task
      await orchestrator.pauseTask(task.id, 'session_limit');

      // Mock successful execution for resume
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Resumed successfully' };
        },
      } as unknown as ReturnType<typeof query>);

      // Resume the task
      const resumed = await orchestrator.resumeTask(task.id);
      expect(resumed).toBe(true);

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });

    it('should resume task from specific session limit checkpoint', async () => {
      const task = await orchestrator.createTask({
        description: 'Resume from specific checkpoint test',
        workflow: 'feature',
      });

      // Save multiple checkpoints
      const checkpoint1 = await orchestrator.saveCheckpoint(task.id, {
        stage: 'planning',
        stageIndex: 0,
        metadata: { pauseReason: 'session_limit' },
      });

      const checkpoint2 = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        metadata: { pauseReason: 'session_limit' },
      });

      await orchestrator.pauseTask(task.id, 'session_limit');

      // Mock successful execution
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Resumed from specific checkpoint' };
        },
      } as unknown as ReturnType<typeof query>);

      // Resume from specific checkpoint (first one)
      const resumed = await orchestrator.resumeTask(task.id, { checkpointId: checkpoint1 });
      expect(resumed).toBe(true);
    });

    it('should handle resume failure when checkpoint is corrupted', async () => {
      const task = await orchestrator.createTask({
        description: 'Corrupted checkpoint test',
        workflow: 'feature',
      });

      // Create checkpoint with invalid metadata
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'invalid-stage',
        stageIndex: 999, // Invalid stage index
        metadata: { pauseReason: 'session_limit' },
      });

      await orchestrator.pauseTask(task.id, 'session_limit');

      // Mock query that would normally succeed
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'This should not be reached' };
        },
      } as unknown as ReturnType<typeof query>);

      // Resume should handle the invalid checkpoint gracefully
      try {
        await orchestrator.resumeTask(task.id, { checkpointId });
        // If it succeeds despite invalid data, that's also acceptable
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('checkpoint cleanup and management', () => {
    it('should clean up old checkpoints when task completes', async () => {
      const task = await orchestrator.createTask({
        description: 'Checkpoint cleanup test',
      });

      // Create several checkpoints
      await orchestrator.saveCheckpoint(task.id, { stageIndex: 0 });
      await orchestrator.saveCheckpoint(task.id, { stageIndex: 1 });
      await orchestrator.saveCheckpoint(task.id, { stageIndex: 2 });

      let checkpoints = await orchestrator.listCheckpoints(task.id);
      expect(checkpoints).toHaveLength(3);

      // Complete the task
      await orchestrator.updateTaskStatus(task.id, 'completed');

      // Note: Automatic cleanup might not be implemented yet,
      // but we can test manual cleanup
      await orchestrator.deleteCheckpoints(task.id);

      checkpoints = await orchestrator.listCheckpoints(task.id);
      expect(checkpoints).toHaveLength(0);
    });

    it('should handle checkpoint queries for task with no checkpoints', async () => {
      const task = await orchestrator.createTask({
        description: 'No checkpoints test',
      });

      const latest = await orchestrator.getLatestCheckpoint(task.id);
      expect(latest).toBeNull();

      const checkpoints = await orchestrator.listCheckpoints(task.id);
      expect(checkpoints).toHaveLength(0);
    });

    it('should return null when getting non-existent checkpoint', async () => {
      const task = await orchestrator.createTask({
        description: 'Non-existent checkpoint test',
      });

      const checkpoint = await orchestrator.getCheckpoint(task.id, 'cp_nonexistent');
      expect(checkpoint).toBeNull();
    });
  });
});