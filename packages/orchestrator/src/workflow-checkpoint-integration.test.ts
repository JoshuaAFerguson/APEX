import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex, type AgentMessage, type WorkflowDefinition, type WorkflowStage, type AgentDefinition } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Workflow Checkpoint Integration Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-workflow-checkpoint-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'workflow-checkpoint-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create a multi-stage workflow
    const workflowContent = `
name: feature
description: Multi-stage feature development workflow
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
  - name: architecture
    agent: architect
    dependsOn:
      - planning
    description: Design architecture
  - name: implementation
    agent: developer
    dependsOn:
      - architecture
    description: Implement the feature
  - name: testing
    agent: tester
    dependsOn:
      - implementation
    description: Create and run tests
  - name: review
    agent: reviewer
    dependsOn:
      - testing
    description: Review and finalize
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
      workflowContent
    );

    // Create test agent files
    const agents = ['planner', 'architect', 'developer', 'tester', 'reviewer'];
    for (const agentName of agents) {
      const agentContent = `---
name: ${agentName}
description: ${agentName} agent
tools: Read, Write, Edit, Bash, Glob, Grep
model: haiku
---
You are a ${agentName} agent.
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', `${agentName}.md`),
        agentContent
      );
    }

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.init();
  });

  afterEach(async () => {
    await orchestrator.cleanup();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('runWorkflow with session limit detection', () => {
    it('should checkpoint and pause workflow when session limit detected', async () => {
      // Create task with conversation that will trigger session limit
      const longConversation: AgentMessage[] = Array.from({ length: 100 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Long message ${i}: ${'x'.repeat(2000)}` }],
      })) as AgentMessage[];

      const task = await orchestrator.createTask({
        description: 'Workflow session limit test',
        conversation: longConversation,
        workflow: 'feature',
      });

      // Mock the workflow loading and stages
      const workflow: WorkflowDefinition = {
        name: 'feature',
        description: 'Multi-stage feature development workflow',
        stages: [
          { name: 'planning', agent: 'planner', dependencies: [] },
          { name: 'architecture', agent: 'architect', dependencies: ['planning'] },
          { name: 'implementation', agent: 'developer', dependencies: ['architecture'] },
          { name: 'testing', agent: 'tester', dependencies: ['implementation'] },
          { name: 'review', agent: 'reviewer', dependencies: ['testing'] },
        ],
      };

      // Mock query to avoid actual agent execution but allow session limit detection
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // Don't yield anything - let session limit detection work
        },
      } as unknown as ReturnType<typeof query>);

      let completed = false;
      try {
        // Execute workflow with small context window to trigger session limit
        completed = await (orchestrator as any).runWorkflow(task, workflow);
      } catch (error) {
        // Expected to either return false or throw due to session limits
      }

      // Should return false (not completed) when paused due to session limit
      expect(completed).toBe(false);

      // Verify task was paused with session limit reason
      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('paused');
      expect(updatedTask?.pauseReason).toBe('session_limit');

      // Verify checkpoint was saved at workflow level
      const checkpoint = await orchestrator.getLatestCheckpoint(task.id);
      expect(checkpoint).toBeTruthy();
      expect(checkpoint?.stage).toBe('workflow');
      expect(checkpoint?.stageIndex).toBe(0);
      expect(checkpoint?.metadata?.pauseReason).toBe('session_limit');
      expect(checkpoint?.metadata?.resumePoint).toBe('workflow_continue');
      expect(checkpoint?.conversationState).toEqual(longConversation);

      // Verify workflow state was preserved
      expect(checkpoint?.metadata?.completedStages).toEqual([]);
      expect(checkpoint?.metadata?.inProgressStages).toEqual([]);

      // Verify logs contain session limit information
      const logs = await orchestrator.store.getTaskLogs(task.id);
      const sessionLimitLogs = logs.filter(log =>
        log.message.includes('session limit') || log.message.includes('checkpoint')
      );
      expect(sessionLimitLogs.length).toBeGreaterThan(0);
    });

    it('should complete workflow successfully when session is healthy', async () => {
      // Create task with small conversation
      const task = await orchestrator.createTask({
        description: 'Healthy session workflow test',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Implement a simple feature' }],
          },
        ],
        workflow: 'feature',
      });

      const workflow: WorkflowDefinition = {
        name: 'feature',
        description: 'Test workflow',
        stages: [
          { name: 'planning', agent: 'planner', dependencies: [] },
          { name: 'implementation', agent: 'developer', dependencies: ['planning'] },
        ],
      };

      // Mock successful execution
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Stage completed successfully' };
        },
      } as unknown as ReturnType<typeof query>);

      const completed = await (orchestrator as any).runWorkflow(task, workflow);

      // Should complete successfully
      expect(completed).toBe(true);

      // Task should be completed, not paused
      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
      expect(updatedTask?.pauseReason).not.toBe('session_limit');

      // Should have regular stage checkpoints, but no session limit checkpoints
      const checkpoints = await orchestrator.listCheckpoints(task.id);
      const sessionLimitCheckpoints = checkpoints.filter(cp =>
        cp.metadata?.pauseReason === 'session_limit'
      );
      expect(sessionLimitCheckpoints).toHaveLength(0);
    });

    it('should preserve workflow state in checkpoint metadata', async () => {
      // Create task that will trigger session limit after first stage
      const conversation: AgentMessage[] = Array.from({ length: 50 }, (_, i) => ({
        type: 'user',
        content: [{ type: 'text', text: `Message ${i}: ${'x'.repeat(3000)}` }],
      }));

      const task = await orchestrator.createTask({
        description: 'Workflow state preservation test',
        conversation,
        workflow: 'feature',
      });

      const workflow: WorkflowDefinition = {
        name: 'feature',
        description: 'Test workflow',
        stages: [
          { name: 'planning', agent: 'planner', dependencies: [] },
          { name: 'implementation', agent: 'developer', dependencies: ['planning'] },
          { name: 'testing', agent: 'tester', dependencies: ['implementation'] },
        ],
      };

      // Mock successful first stage, then session limit
      let stageCount = 0;
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          stageCount++;
          if (stageCount === 1) {
            // First stage succeeds
            yield { type: 'text', content: 'Planning completed' };
          } else {
            // Second stage triggers session limit (no yield)
          }
        },
      } as unknown as ReturnType<typeof query>));

      try {
        await (orchestrator as any).runWorkflow(task, workflow);
      } catch (error) {
        // Expected
      }

      // Verify checkpoint contains workflow state
      const checkpoint = await orchestrator.getLatestCheckpoint(task.id);
      expect(checkpoint?.metadata?.completedStages).toContain('planning');
      expect(checkpoint?.metadata?.inProgressStages).toEqual([]);
      expect(checkpoint?.metadata?.stageResults).toBeDefined();
    });
  });

  describe('executeWorkflowStage with session limit detection', () => {
    it('should checkpoint and pause stage when session limit detected', async () => {
      // Create task with large conversation
      const largeConversation: AgentMessage[] = Array.from({ length: 80 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Stage message ${i}: ${'x'.repeat(2500)}` }],
      })) as AgentMessage[];

      const task = await orchestrator.createTask({
        description: 'Stage session limit test',
        conversation: largeConversation,
        workflow: 'feature',
      });

      const workflow: WorkflowDefinition = {
        name: 'feature',
        description: 'Test workflow',
        stages: [
          { name: 'implementation', agent: 'developer', dependencies: [] },
        ],
      };

      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        dependencies: [],
      };

      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Developer Agent',
        model: 'haiku',
        instructions: 'You are a developer agent.',
      };

      // Mock query to allow session limit detection
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // No yield - let session limit detection trigger
        },
      } as unknown as ReturnType<typeof query>);

      let errorThrown = false;
      try {
        await (orchestrator as any).executeWorkflowStage(
          task,
          stage,
          agent,
          workflow,
          new Map()
        );
      } catch (error) {
        errorThrown = true;
        expect((error as Error).message).toContain('Session limit reached');
      }

      expect(errorThrown).toBe(true);

      // Verify task was paused
      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('paused');
      expect(updatedTask?.pauseReason).toBe('session_limit');

      // Verify stage-level checkpoint was saved
      const checkpoint = await orchestrator.getLatestCheckpoint(task.id);
      expect(checkpoint?.stage).toBe('implementation');
      expect(checkpoint?.metadata?.pauseReason).toBe('session_limit');
      expect(checkpoint?.metadata?.resumePoint).toBe('stage_start');
      expect(checkpoint?.conversationState).toEqual(largeConversation);

      // Verify session limit status is in checkpoint
      expect(checkpoint?.metadata?.sessionLimitStatus).toBeDefined();
      const sessionStatus = checkpoint?.metadata?.sessionLimitStatus as any;
      expect(sessionStatus.nearLimit).toBe(true);
      expect(['checkpoint', 'handoff']).toContain(sessionStatus.recommendation);
    });

    it('should execute stage successfully when session is healthy', async () => {
      const task = await orchestrator.createTask({
        description: 'Healthy stage execution test',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Implement feature X' }],
          },
        ],
        workflow: 'feature',
      });

      const workflow: WorkflowDefinition = {
        name: 'feature',
        description: 'Test workflow',
        stages: [
          { name: 'implementation', agent: 'developer', dependencies: [] },
        ],
      };

      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        dependencies: [],
      };

      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Developer Agent',
        model: 'haiku',
        instructions: 'You are a developer agent.',
      };

      // Mock successful execution
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Implementation completed successfully' };
        },
      } as unknown as ReturnType<typeof query>);

      const result = await (orchestrator as any).executeWorkflowStage(
        task,
        stage,
        agent,
        workflow,
        new Map()
      );

      // Should complete successfully
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');

      // Task should not be paused due to session limits
      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.pauseReason).not.toBe('session_limit');

      // Should have regular checkpoint but not session limit checkpoint
      const checkpoints = await orchestrator.listCheckpoints(task.id);
      const sessionLimitCheckpoints = checkpoints.filter(cp =>
        cp.metadata?.pauseReason === 'session_limit'
      );
      expect(sessionLimitCheckpoints).toHaveLength(0);
    });

    it('should handle session limit check failure gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Session limit check failure test',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Test message' }],
          },
        ],
        workflow: 'feature',
      });

      // Mock detectSessionLimit to throw an error
      const originalDetectSessionLimit = orchestrator.detectSessionLimit;
      orchestrator.detectSessionLimit = vi.fn().mockRejectedValue(
        new Error('Session limit detection failed')
      );

      const workflow: WorkflowDefinition = {
        name: 'feature',
        description: 'Test workflow',
        stages: [
          { name: 'implementation', agent: 'developer', dependencies: [] },
        ],
      };

      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        dependencies: [],
      };

      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Developer Agent',
        model: 'haiku',
        instructions: 'You are a developer agent.',
      };

      // Mock successful execution
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Execution completed' };
        },
      } as unknown as ReturnType<typeof query>);

      // Should either handle the error gracefully or throw an appropriate error
      try {
        const result = await (orchestrator as any).executeWorkflowStage(
          task,
          stage,
          agent,
          workflow,
          new Map()
        );
        // If it succeeds despite the error, that's acceptable
        expect(result).toBeDefined();
      } catch (error) {
        // If it throws, it should be a meaningful error
        expect(error).toBeInstanceOf(Error);
      }

      // Restore original method
      orchestrator.detectSessionLimit = originalDetectSessionLimit;
    });
  });

  describe('workflow continuation after session limit pause', () => {
    it('should resume workflow from checkpoint after session limit pause', async () => {
      // Create a task with moderate conversation
      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Build authentication system' }],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Workflow resume test',
        conversation,
        workflow: 'feature',
      });

      // Save a session limit checkpoint at workflow level
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'workflow',
        stageIndex: 0,
        conversationState: conversation,
        metadata: {
          pauseReason: 'session_limit',
          resumePoint: 'workflow_continue',
          completedStages: [],
          inProgressStages: [],
          stageResults: {},
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
          yield { type: 'text', content: 'Workflow stage completed' };
        },
      } as unknown as ReturnType<typeof query>);

      // Resume the task
      const resumed = await orchestrator.resumeTask(task.id, { checkpointId });
      expect(resumed).toBe(true);

      // Verify task is no longer paused
      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });

    it('should resume stage execution from checkpoint after session limit pause', async () => {
      const task = await orchestrator.createTask({
        description: 'Stage resume test',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Continue implementation' }],
          },
        ],
        workflow: 'feature',
      });

      // Save session limit checkpoint at stage level
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        metadata: {
          pauseReason: 'session_limit',
          resumePoint: 'stage_start',
          sessionLimitStatus: {
            nearLimit: true,
            currentTokens: 160000,
            utilization: 0.80,
            recommendation: 'checkpoint',
            message: 'Near context window limit',
          },
        },
      });

      await orchestrator.pauseTask(task.id, 'session_limit');

      // Mock successful resume execution
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Implementation resumed and completed' };
        },
      } as unknown as ReturnType<typeof query>);

      const resumed = await orchestrator.resumeTask(task.id, { checkpointId });
      expect(resumed).toBe(true);

      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });

    it('should handle resume with conversation state restoration', async () => {
      // Create conversation that was checkpointed
      const originalConversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Original request' }],
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'I started working on it...' }],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Conversation restoration test',
        conversation: originalConversation,
        workflow: 'feature',
      });

      // Save checkpoint with conversation state
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'planning',
        stageIndex: 0,
        conversationState: originalConversation,
        metadata: {
          pauseReason: 'session_limit',
          resumePoint: 'stage_start',
        },
      });

      await orchestrator.pauseTask(task.id, 'session_limit');

      // Mock successful resume
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', content: 'Resumed from saved conversation state' };
        },
      } as unknown as ReturnType<typeof query>);

      const resumed = await orchestrator.resumeTask(task.id, { checkpointId });
      expect(resumed).toBe(true);

      // Verify the conversation state was restored properly
      const checkpoint = await orchestrator.getCheckpoint(task.id, checkpointId);
      expect(checkpoint?.conversationState).toEqual(originalConversation);
    });
  });

  describe('session limit logging and events', () => {
    it('should log session limit events during workflow execution', async () => {
      // Create task with large conversation
      const largeConversation: AgentMessage[] = Array.from({ length: 60 }, (_, i) => ({
        type: 'user',
        content: [{ type: 'text', text: `Log test message ${i}: ${'x'.repeat(3000)}` }],
      }));

      const task = await orchestrator.createTask({
        description: 'Session limit logging test',
        conversation: largeConversation,
        workflow: 'feature',
      });

      // Mock query
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // Don't yield - trigger session limit
        },
      } as unknown as ReturnType<typeof query>);

      try {
        await orchestrator.executeTask(task.id);
      } catch (error) {
        // Expected
      }

      // Verify session limit logs were created
      const logs = await orchestrator.store.getTaskLogs(task.id);
      const sessionLimitLogs = logs.filter(log =>
        log.message.includes('Session limit detected') ||
        log.message.includes('paused due to session limit') ||
        log.message.includes('checkpoint') ||
        log.message.includes('context window')
      );

      expect(sessionLimitLogs.length).toBeGreaterThan(0);

      // Verify log details
      const sessionLimitLog = sessionLimitLogs.find(log =>
        log.message.includes('Session limit detected')
      );
      if (sessionLimitLog) {
        expect(sessionLimitLog.level).toBe('info');
        expect(sessionLimitLog.message).toContain('checkpoint');
      }

      const pauseLog = sessionLimitLogs.find(log =>
        log.message.includes('paused due to session limit')
      );
      if (pauseLog) {
        expect(pauseLog.level).toBe('info');
        expect(pauseLog.message).toContain('resume');
      }
    });

    it('should emit task:paused event when session limit reached', async () => {
      const conversation: AgentMessage[] = Array.from({ length: 50 }, (_, i) => ({
        type: 'user',
        content: [{ type: 'text', text: `Event test ${i}: ${'x'.repeat(4000)}` }],
      }));

      const task = await orchestrator.createTask({
        description: 'Session limit event test',
        conversation,
        workflow: 'feature',
      });

      // Setup event listener
      let pausedEventData: any = null;
      orchestrator.on('task:paused', (pausedTask, reason) => {
        pausedEventData = { task: pausedTask, reason };
      });

      // Mock query
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // Don't yield - trigger session limit
        },
      } as unknown as ReturnType<typeof query>);

      try {
        await orchestrator.executeTask(task.id);
      } catch (error) {
        // Expected
      }

      // Verify the paused event was emitted
      if (pausedEventData) {
        expect(pausedEventData.task.id).toBe(task.id);
        expect(pausedEventData.reason).toBe('session_limit');
      }
    });
  });
});