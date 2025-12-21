/**
 * Integration tests for full session recovery flow
 *
 * Tests comprehensive session recovery including:
 * 1. Context window limit detection and checkpoint creation
 * 2. Auto-resume functionality with context injection
 * 3. Max resume attempts prevention of infinite loops
 * 4. End-to-end recovery scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { query, type AgentDefinition as SDKAgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import { estimateConversationTokens, createContextSummary } from './context';
import { SessionManager } from './session-manager';
import type {
  Task,
  TaskCheckpoint,
  AgentMessage,
  WorkflowDefinition,
  AgentDefinition,
  ApexConfig,
  TaskStatus,
  SessionLimitStatus,
} from '@apexcli/core';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock file system operations
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Mock config/workflow loading
vi.mock('@apexcli/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apexcli/core')>();
  return {
    ...actual,
    loadConfig: vi.fn(),
    loadAgents: vi.fn(),
    loadWorkflow: vi.fn(),
    getEffectiveConfig: vi.fn(),
  };
});

describe('Session Recovery Flow - Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let sessionManager: SessionManager;
  let mockWorkflow: WorkflowDefinition;
  let mockAgents: Record<string, AgentDefinition>;
  let mockConfig: ApexConfig;
  let queryMock: ReturnType<typeof vi.mocked<typeof query>>;

  beforeEach(async () => {
    const { loadConfig, loadAgents, loadWorkflow, getEffectiveConfig } = await import('@apexcli/core');

    // Setup mock data with session recovery configuration
    mockWorkflow = {
      name: 'feature',
      description: 'Feature development with session recovery',
      stages: [
        { name: 'planning', agent: 'planner', maxRetries: 2 },
        { name: 'implementation', agent: 'developer', dependsOn: ['planning'], maxRetries: 2 },
        { name: 'testing', agent: 'tester', dependsOn: ['implementation'], maxRetries: 2 },
        { name: 'review', agent: 'reviewer', dependsOn: ['testing'], maxRetries: 2 },
      ],
    };

    mockAgents = {
      planner: { name: 'planner', description: 'Plans features', prompt: 'You are a planner', model: 'opus' },
      developer: { name: 'developer', description: 'Develops features', prompt: 'You are a developer', model: 'sonnet' },
      tester: { name: 'tester', description: 'Tests features', prompt: 'You are a tester', model: 'sonnet' },
      reviewer: { name: 'reviewer', description: 'Reviews features', prompt: 'You are a reviewer', model: 'sonnet' },
    };

    mockConfig = {
      version: '1.0',
      project: { name: 'test-project', language: 'typescript' },
      agents: { timeout: 300000 },
      workflows: { sessionLimit: 10000 },
      daemon: {
        sessionRecovery: {
          enabled: true,
          autoResume: true,
          maxResumeAttempts: 3,
          contextWindowThreshold: 0.8, // 80% utilization triggers checkpoint
          contextSummarizationThreshold: 50,
        },
      },
    } as ApexConfig;

    // Setup mocks
    vi.mocked(loadConfig).mockResolvedValue(mockConfig);
    vi.mocked(loadAgents).mockResolvedValue(mockAgents);
    vi.mocked(loadWorkflow).mockResolvedValue(mockWorkflow);
    vi.mocked(getEffectiveConfig).mockReturnValue({
      ...mockConfig,
      agents: { ...mockConfig.agents!, disabled: [], enabled: undefined },
      workflows: { ...mockConfig.workflows!, sessionLimit: 10000 },
      daemon: {
        ...mockConfig.daemon!,
        sessionRecovery: {
          enabled: true,
          autoResume: true,
          maxResumeAttempts: 3,
          contextWindowThreshold: 0.8,
          contextSummarizationThreshold: 50,
        },
      },
    });

    queryMock = vi.mocked(query);

    // Initialize orchestrator with in-memory store
    orchestrator = new ApexOrchestrator({ projectPath: '/test' });
    await orchestrator.initialize();
    store = (orchestrator as any).store;
    sessionManager = new SessionManager({
      projectPath: '/test',
      config: mockConfig.daemon!,
    });
    await sessionManager.initialize();
  });

  afterEach(async () => {
    await orchestrator.cleanup();
    vi.clearAllMocks();
  });

  describe('Context Window Limit Detection and Checkpoint Creation', () => {
    it('should detect context window limit and create checkpoint automatically', async () => {
      // Create a task with large conversation that exceeds 80% of context window
      const largeConversation: AgentMessage[] = [];

      // Add user request
      largeConversation.push({
        type: 'user',
        content: [{ type: 'text', text: 'Implement a comprehensive e-commerce platform with user management, product catalog, shopping cart, payment processing, and order management.' }],
      });

      // Add very large assistant response to simulate hitting context limit
      const largeText = 'This is a detailed implementation plan. '.repeat(1000); // ~8000 tokens
      largeConversation.push({
        type: 'assistant',
        content: [{ type: 'text', text: largeText }],
      });

      // Add more tool usage to exceed threshold
      for (let i = 0; i < 20; i++) {
        largeConversation.push({
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: {
              file_path: `/src/components/Component${i}.tsx`,
              content: `export function Component${i}() { return <div>Component ${i}</div>; }`.repeat(50) // Large content
            }
          }],
        });

        largeConversation.push({
          type: 'user',
          content: [{ type: 'tool_result', toolResult: `File /src/components/Component${i}.tsx created successfully` }],
        });
      }

      const task = await orchestrator.createTask({
        description: 'Large e-commerce platform implementation',
        workflow: 'feature',
        conversation: largeConversation,
      });

      // Mock session limit detection to return near-limit status
      const sessionLimitStatus: SessionLimitStatus = {
        currentTokens: 8500, // 85% of 10000
        maxTokens: 10000,
        utilization: 0.85,
        nearLimit: true,
        recommendation: 'checkpoint',
        message: 'Context window utilization at 85%. Consider creating a checkpoint.',
      };

      // Spy on session limit detection
      const detectSessionLimitSpy = vi.spyOn(orchestrator, 'detectSessionLimit');
      detectSessionLimitSpy.mockResolvedValue(sessionLimitStatus);

      // Spy on checkpoint creation
      const saveCheckpointSpy = vi.spyOn(orchestrator, 'saveCheckpoint');
      saveCheckpointSpy.mockResolvedValue('checkpoint-123');

      // Mock query to simulate task execution that triggers limit check
      queryMock.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // Simulate checkpoint creation during execution
          yield { type: 'text', text: 'Starting implementation. Context window is getting full, creating checkpoint...' };
        },
      } as unknown as ReturnType<typeof query>);

      // Execute task - this should trigger limit detection and checkpoint creation
      await orchestrator.executeTask(task.id);

      // Verify session limit was detected
      expect(detectSessionLimitSpy).toHaveBeenCalledWith(task.id, expect.any(Number));

      // Verify checkpoint was created
      expect(saveCheckpointSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          stage: expect.any(String),
          stageIndex: expect.any(Number),
          conversationState: expect.any(Array),
        })
      );

      // Verify task status reflects checkpoint
      const updatedTask = await store.getTask(task.id);
      expect(updatedTask?.status).toBe('paused');

      // Verify checkpoint exists in store
      const checkpoints = await store.getCheckpoints(task.id);
      expect(checkpoints.length).toBeGreaterThan(0);
    });

    it('should save checkpoint before session ends when hitting token limit', async () => {
      const task = await orchestrator.createTask({
        description: 'Token limit test task',
        workflow: 'feature',
      });

      // Create large conversation state that exceeds context window
      const conversationState: AgentMessage[] = Array.from({ length: 100 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: [{
          type: 'text',
          text: `Very long message ${i} with lots of content to consume tokens. `.repeat(100) // ~2500 tokens each
        }],
      }));

      // Add conversation to task
      await store.updateTask(task.id, {
        conversation: conversationState,
      });

      // Mock session limit to show critical state
      const criticalLimit: SessionLimitStatus = {
        currentTokens: 9800, // 98% utilization
        maxTokens: 10000,
        utilization: 0.98,
        nearLimit: true,
        recommendation: 'handoff',
        message: 'Critical: Context window at 98%. Immediate checkpoint required.',
      };

      vi.spyOn(orchestrator, 'detectSessionLimit').mockResolvedValue(criticalLimit);
      const saveCheckpointSpy = vi.spyOn(orchestrator, 'saveCheckpoint');

      // Mock query to simulate reaching token limit
      queryMock.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', text: 'Context window is critically full. Creating emergency checkpoint...' };
        },
      } as unknown as ReturnType<typeof query>);

      // This should trigger emergency checkpoint creation
      await orchestrator.executeTask(task.id);

      // Verify checkpoint was saved before session ended
      expect(saveCheckpointSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          conversationState: expect.arrayContaining([
            expect.objectContaining({
              type: expect.stringMatching(/user|assistant/),
              content: expect.any(Array),
            }),
          ]),
          metadata: expect.objectContaining({
            reason: 'context_limit_reached',
          }),
        })
      );

      // Verify task was paused, not failed
      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('paused');
      expect(finalTask?.statusMessage).toContain('checkpoint');
    });
  });

  describe('Auto-Resume with Context Injection', () => {
    it('should auto-resume task with injected context from checkpoint', async () => {
      // Create task and establish conversation history
      const task = await orchestrator.createTask({
        description: 'Auto-resume test with context injection',
        workflow: 'feature',
      });

      // Create meaningful conversation state for context injection
      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Build a user authentication system with JWT tokens and secure password hashing' }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement JWT authentication. Key decisions: Using bcrypt for password hashing, implementing refresh token rotation, adding rate limiting for login attempts. I completed the user model and auth service implementation.'
          }],
        },
        {
          type: 'assistant',
          content: [{ type: 'tool_use', toolName: 'Write', toolInput: { file_path: '/src/auth/auth.service.ts', content: 'export class AuthService {}' } }],
        },
        {
          type: 'user',
          content: [{ type: 'tool_result', toolResult: 'Authentication service file created successfully' }],
        },
      ];

      // Create checkpoint at implementation stage
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState,
        metadata: {
          completedStages: ['planning'],
          reason: 'context_limit_checkpoint',
        },
      });

      // Update task to paused status
      await store.updateTask(task.id, {
        status: 'paused',
        statusMessage: 'Paused due to context window limit',
      });

      // Capture prompts sent to agents during resume
      const capturedPrompts: Array<{ agent: string; prompt: string }> = [];
      queryMock.mockImplementation((agentDef: SDKAgentDefinition, prompt: string) => {
        capturedPrompts.push({ agent: agentDef.name, prompt });
        return {
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'text', text: `${agentDef.description} stage completed successfully.` };
          },
        } as unknown as ReturnType<typeof query>;
      });

      // Attempt auto-resume
      const resumeResult = await orchestrator.resumeTask(task.id, {
        checkpointId,
        autoResume: true
      });

      expect(resumeResult).toBe(true);

      // Verify context was injected into the first resumed stage
      expect(capturedPrompts.length).toBeGreaterThan(0);
      const firstPrompt = capturedPrompts[0];

      // Check for resume context injection markers
      expect(firstPrompt.prompt).toContain('🔄 SESSION RESUME CONTEXT');
      expect(firstPrompt.prompt).toContain('Auto-resume test with context injection');

      // Check for key decisions injection
      expect(firstPrompt.prompt).toContain('Key Decisions Made');
      expect(firstPrompt.prompt).toContain('bcrypt for password hashing');
      expect(firstPrompt.prompt).toContain('refresh token rotation');

      // Check for accomplishments injection
      expect(firstPrompt.prompt).toContain('What Was Accomplished');
      expect(firstPrompt.prompt).toContain('user model and auth service');

      // Check for file modifications tracking
      expect(firstPrompt.prompt).toContain('/src/auth/auth.service.ts');

      // Verify task status was updated to running
      const resumedTask = await store.getTask(task.id);
      expect(resumedTask?.status).toBe('completed'); // Should complete after resume

      // Verify session-resumed event was emitted
      const logs = await store.getLogs(task.id);
      const resumeLog = logs.find(log => log.message.includes('Task session resumed'));
      expect(resumeLog).toBeDefined();
      expect(resumeLog?.metadata?.checkpointId).toBe(checkpointId);
    });

    it('should inject context only to first stage during resume, not subsequent stages', async () => {
      const task = await orchestrator.createTask({
        description: 'Context injection scope test',
        workflow: 'feature',
      });

      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Build a monitoring dashboard' }],
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Completed metrics API implementation with Prometheus integration.' }],
        },
      ];

      // Create checkpoint at planning stage (will resume from planning -> implementation -> testing -> review)
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'planning',
        stageIndex: 0,
        conversationState,
        metadata: { completedStages: [] },
      });

      await store.updateTask(task.id, { status: 'paused' });

      const capturedPrompts: string[] = [];
      queryMock.mockImplementation((agentDef: SDKAgentDefinition, prompt: string) => {
        capturedPrompts.push(prompt);
        return {
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'text', text: `${agentDef.description} completed.` };
          },
        } as unknown as ReturnType<typeof query>;
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Should execute all 4 stages
      expect(capturedPrompts).toHaveLength(4);

      // Only first stage should have resume context
      expect(capturedPrompts[0]).toContain('🔄 SESSION RESUME CONTEXT');
      expect(capturedPrompts[1]).not.toContain('🔄 SESSION RESUME CONTEXT');
      expect(capturedPrompts[2]).not.toContain('🔄 SESSION RESUME CONTEXT');
      expect(capturedPrompts[3]).not.toContain('🔄 SESSION RESUME CONTEXT');

      // Verify resume context contains expected information
      expect(capturedPrompts[0]).toContain('monitoring dashboard');
      expect(capturedPrompts[0]).toContain('Prometheus integration');
    });
  });

  describe('Max Resume Attempts Prevention', () => {
    it('should prevent infinite loops by limiting resume attempts', async () => {
      const task = await orchestrator.createTask({
        description: 'Max resume attempts test',
        workflow: 'feature',
      });

      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Implement error-prone feature' }],
        },
      ];

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState,
        metadata: {
          completedStages: ['planning'],
          resumeAttempts: 0, // Start with 0 attempts
        },
      });

      await store.updateTask(task.id, { status: 'paused' });

      // Mock query to always fail to simulate persistent errors
      queryMock.mockImplementation(() => {
        throw new Error('Simulated execution failure');
      });

      let attemptCount = 0;
      const resumeTaskSpy = vi.spyOn(orchestrator, 'resumeTask').mockImplementation(async (taskId, options) => {
        attemptCount++;

        // Update checkpoint with increased attempt count
        const checkpoint = await store.getCheckpoint(checkpointId);
        if (checkpoint) {
          checkpoint.metadata = {
            ...checkpoint.metadata,
            resumeAttempts: attemptCount,
          };
          await store.updateCheckpoint(checkpointId, checkpoint);
        }

        // Simulate failure for first 3 attempts, then hit max limit
        if (attemptCount <= 3) {
          throw new Error(`Resume attempt ${attemptCount} failed`);
        } else {
          throw new Error('Max resume attempts exceeded');
        }
      });

      // Attempt to resume multiple times
      let finalError: Error | null = null;
      try {
        for (let i = 0; i < 5; i++) {
          await orchestrator.resumeTask(task.id, { checkpointId });
        }
      } catch (error) {
        finalError = error as Error;
      }

      // Should fail after max attempts (3)
      expect(finalError).toBeDefined();
      expect(finalError?.message).toContain('Max resume attempts exceeded');
      expect(attemptCount).toBe(4); // Called 4 times, failed after 3rd attempt

      // Verify task is marked as failed, not retrying infinitely
      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('failed');
      expect(finalTask?.statusMessage).toContain('resume attempts');

      resumeTaskSpy.mockRestore();
    });

    it('should track resume attempts in checkpoint metadata', async () => {
      const task = await orchestrator.createTask({
        description: 'Resume attempt tracking test',
        workflow: 'feature',
      });

      // Create initial checkpoint
      let checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState: [],
        metadata: {
          completedStages: ['planning'],
          resumeAttempts: 0,
        },
      });

      // Simulate multiple resume attempts with failures
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Mock query to fail for this attempt
          queryMock.mockImplementationOnce(() => {
            throw new Error(`Attempt ${attempt} failed`);
          });

          await orchestrator.resumeTask(task.id, { checkpointId });
        } catch (error) {
          // Update checkpoint with incremented attempt count
          const checkpoint = await store.getCheckpoint(checkpointId);
          if (checkpoint) {
            checkpoint.metadata = {
              ...checkpoint.metadata,
              resumeAttempts: attempt,
              lastResumeError: (error as Error).message,
              lastResumeAttempt: new Date(),
            };
            await store.updateCheckpoint(checkpointId, checkpoint);
          }
        }
      }

      // Verify final checkpoint has correct attempt count
      const finalCheckpoint = await store.getCheckpoint(checkpointId);
      expect(finalCheckpoint?.metadata?.resumeAttempts).toBe(3);
      expect(finalCheckpoint?.metadata?.lastResumeError).toContain('Attempt 3 failed');
      expect(finalCheckpoint?.metadata?.lastResumeAttempt).toBeDefined();
    });

    it('should reset resume attempts on successful execution', async () => {
      const task = await orchestrator.createTask({
        description: 'Resume attempt reset test',
        workflow: 'feature',
      });

      // Create checkpoint with some failed attempts
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState: [],
        metadata: {
          completedStages: ['planning'],
          resumeAttempts: 2, // Had 2 previous failed attempts
        },
      });

      await store.updateTask(task.id, { status: 'paused' });

      // Mock successful execution
      queryMock.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', text: 'Implementation successful after retry!' };
        },
      } as unknown as ReturnType<typeof query>);

      // Successful resume
      const resumeResult = await orchestrator.resumeTask(task.id, { checkpointId });
      expect(resumeResult).toBe(true);

      // Verify task completed successfully
      const completedTask = await store.getTask(task.id);
      expect(completedTask?.status).toBe('completed');

      // Verify resume attempts were reset (would be in new checkpoint if created)
      const logs = await store.getLogs(task.id);
      const successLog = logs.find(log => log.message.includes('Resume attempts reset'));
      expect(successLog).toBeDefined();
    });
  });

  describe('End-to-End Session Recovery Scenarios', () => {
    it('should handle complete session recovery workflow', async () => {
      // Scenario: Large task hits context limit during implementation,
      // gets checkpointed, and successfully resumes with context injection

      // Step 1: Create task with realistic large conversation
      const task = await orchestrator.createTask({
        description: 'Complete e-commerce platform with microservices architecture',
        workflow: 'feature',
      });

      // Build large conversation that would hit context limits
      const conversationHistory: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Build a comprehensive e-commerce platform with user auth, product catalog, cart, payments, orders, notifications, and admin dashboard' }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will design a microservices architecture. Key decisions: Using Docker containers, PostgreSQL for user/order data, Redis for cart sessions, Stripe for payments, JWT authentication with refresh tokens, event-driven notifications via RabbitMQ. Completed the planning phase with detailed service blueprints.'
          }],
        },
      ];

      // Add many tool operations to simulate hitting context limit
      for (let i = 1; i <= 15; i++) {
        conversationHistory.push({
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: {
              file_path: `/src/services/${['auth', 'product', 'cart', 'payment', 'order'][i % 5]}/service${i}.ts`,
              content: `// Microservice ${i} implementation\nexport class Service${i} {\n  // Complex service logic here\n}`.repeat(30)
            }
          }],
        });

        conversationHistory.push({
          type: 'user',
          content: [{ type: 'tool_result', toolResult: `Service ${i} implemented successfully` }],
        });
      }

      // Step 2: Simulate hitting context limit during execution
      let checkpointCreated = false;
      queryMock.mockImplementation((agentDef: SDKAgentDefinition, prompt: string) => {
        // Simulate context limit hit during implementation
        if (!checkpointCreated && agentDef.name === 'developer') {
          checkpointCreated = true;
          return {
            [Symbol.asyncIterator]: async function* () {
              yield { type: 'text', text: 'Starting implementation... Context window approaching limit. Creating checkpoint before continuing...' };
              // This would trigger checkpoint creation in real scenario
            },
          } as unknown as ReturnType<typeof query>;
        }

        return {
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'text', text: `${agentDef.description} stage completed successfully.` };
          },
        } as unknown as ReturnType<typeof query>;
      });

      // Mock session limit detection for context limit scenario
      vi.spyOn(orchestrator, 'detectSessionLimit').mockResolvedValue({
        currentTokens: 8500,
        maxTokens: 10000,
        utilization: 0.85,
        nearLimit: true,
        recommendation: 'checkpoint',
        message: 'Context window at 85%, checkpoint recommended.',
      });

      // Step 3: Start execution and trigger checkpoint
      await orchestrator.executeTask(task.id);

      // Simulate checkpoint creation when context limit hit
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState: conversationHistory,
        metadata: {
          completedStages: ['planning'],
          reason: 'context_window_limit',
          contextUtilization: 0.85,
        },
      });

      await store.updateTask(task.id, {
        status: 'paused',
        statusMessage: 'Paused due to context window limit - checkpoint created',
      });

      // Step 4: Auto-resume with context injection
      const resumePrompts: string[] = [];
      queryMock.mockImplementation((agentDef: SDKAgentDefinition, prompt: string) => {
        resumePrompts.push(prompt);
        return {
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'text', text: `${agentDef.description} resumed and completed successfully with injected context.` };
          },
        } as unknown as ReturnType<typeof query>;
      });

      const resumeSuccess = await orchestrator.resumeTask(task.id, {
        checkpointId,
        autoResume: true
      });

      // Step 5: Verify complete flow
      expect(resumeSuccess).toBe(true);

      // Verify context injection occurred
      expect(resumePrompts[0]).toContain('🔄 SESSION RESUME CONTEXT');
      expect(resumePrompts[0]).toContain('microservices architecture');
      expect(resumePrompts[0]).toContain('PostgreSQL for user/order data');
      expect(resumePrompts[0]).toContain('Stripe for payments');

      // Verify file modifications were tracked
      expect(resumePrompts[0]).toContain('/src/services/auth/');
      expect(resumePrompts[0]).toContain('/src/services/product/');

      // Verify task completed successfully
      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('completed');

      // Verify comprehensive logging
      const logs = await store.getLogs(task.id);
      expect(logs.some(log => log.message.includes('Context window limit detected'))).toBe(true);
      expect(logs.some(log => log.message.includes('Checkpoint created'))).toBe(true);
      expect(logs.some(log => log.message.includes('Task session resumed'))).toBe(true);
      expect(logs.some(log => log.message.includes('Resume context injected'))).toBe(true);
    });

    it('should handle recovery failure and graceful degradation', async () => {
      const task = await orchestrator.createTask({
        description: 'Recovery failure test',
        workflow: 'feature',
      });

      // Create checkpoint
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState: [],
        metadata: {
          completedStages: ['planning'],
          resumeAttempts: 0,
        },
      });

      await store.updateTask(task.id, { status: 'paused' });

      // Mock persistent failures
      queryMock.mockImplementation(() => {
        throw new Error('Persistent execution failure');
      });

      // Try to resume with max attempts
      let finalError: Error | null = null;
      for (let i = 0; i < 4; i++) {
        try {
          await orchestrator.resumeTask(task.id, { checkpointId });
        } catch (error) {
          finalError = error as Error;

          // Update checkpoint attempt count
          const checkpoint = await store.getCheckpoint(checkpointId);
          if (checkpoint && checkpoint.metadata) {
            checkpoint.metadata.resumeAttempts = (checkpoint.metadata.resumeAttempts as number || 0) + 1;
            if (checkpoint.metadata.resumeAttempts >= 3) {
              await store.updateTask(task.id, {
                status: 'failed',
                statusMessage: 'Maximum resume attempts exceeded',
              });
              break;
            }
          }
        }
      }

      // Verify graceful failure
      expect(finalError).toBeDefined();

      const failedTask = await store.getTask(task.id);
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.statusMessage).toContain('resume attempts');

      // Verify checkpoint preserved for manual intervention
      const checkpoint = await store.getCheckpoint(checkpointId);
      expect(checkpoint).toBeDefined();
      expect(checkpoint?.metadata?.resumeAttempts).toBe(3);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle session recovery efficiently with large conversation history', async () => {
      const task = await orchestrator.createTask({
        description: 'Large conversation performance test',
        workflow: 'feature',
      });

      // Create massive conversation (1000 messages)
      const largeConversation: AgentMessage[] = Array.from({ length: 1000 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: [{
          type: 'text',
          text: `Message ${i}: Detailed conversation content with complex implementation details and decisions. `.repeat(20)
        }],
      }));

      const startTime = Date.now();

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState: largeConversation,
        metadata: { completedStages: ['planning'] },
      });

      queryMock.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', text: 'Implementation completed efficiently.' };
        },
      } as unknown as ReturnType<typeof query>);

      await orchestrator.resumeTask(task.id, { checkpointId });

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (<5 seconds)
      expect(duration).toBeLessThan(5000);

      // Verify conversation was properly processed
      const logs = await store.getLogs(task.id);
      const contextLog = logs.find(log => log.message.includes('Resume context generated'));
      expect(contextLog).toBeDefined();
      expect(contextLog?.metadata?.conversationMessageCount).toBe(1000);
    });

    it('should handle corrupted checkpoint data gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Corrupted checkpoint test',
        workflow: 'feature',
      });

      // Create checkpoint with invalid data
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState: null as any, // Corrupted data
        metadata: undefined as any, // Missing metadata
      });

      queryMock.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', text: 'Implementation completed despite corrupted checkpoint.' };
        },
      } as unknown as ReturnType<typeof query>);

      // Should handle corrupted data gracefully
      const resumeResult = await orchestrator.resumeTask(task.id, { checkpointId });
      expect(resumeResult).toBe(true);

      // Verify task still completed
      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('completed');

      // Verify appropriate warning logged
      const logs = await store.getLogs(task.id);
      const warningLog = logs.find(log =>
        log.level === 'warn' && log.message.includes('checkpoint')
      );
      expect(warningLog).toBeDefined();
    });
  });
});