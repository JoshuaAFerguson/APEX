import { describe, it, expect, beforeEach, vi } from 'vitest';
import { query, type AgentDefinition as SDKAgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import { createContextSummary, estimateConversationTokens } from './context';
import { buildResumePrompt } from './prompts';
import type {
  Task,
  TaskCheckpoint,
  AgentMessage,
  WorkflowDefinition,
  AgentDefinition,
  ApexConfig,
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

describe('Resume Context Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let mockWorkflow: WorkflowDefinition;
  let mockAgents: Record<string, AgentDefinition>;
  let mockConfig: ApexConfig;

  beforeEach(async () => {
    const { loadConfig, loadAgents, loadWorkflow, getEffectiveConfig } = await import('@apexcli/core');

    // Setup mock data
    mockWorkflow = {
      name: 'feature',
      description: 'Feature development',
      stages: [
        { name: 'planning', agent: 'planner', maxRetries: 2 },
        { name: 'implementation', agent: 'developer', dependsOn: ['planning'], maxRetries: 2 },
        { name: 'testing', agent: 'tester', dependsOn: ['implementation'], maxRetries: 2 },
      ],
    };

    mockAgents = {
      planner: { name: 'planner', description: 'Plans features', prompt: 'You are a planner', model: 'opus' },
      developer: { name: 'developer', description: 'Develops features', prompt: 'You are a developer', model: 'sonnet' },
      tester: { name: 'tester', description: 'Tests features', prompt: 'You are a tester', model: 'sonnet' },
    };

    mockConfig = {
      version: '1.0',
      project: { name: 'test-project', language: 'typescript' },
      agents: { timeout: 300000 },
      workflows: { sessionLimit: 10000 },
    } as ApexConfig;

    // Setup mocks
    vi.mocked(loadConfig).mockResolvedValue(mockConfig);
    vi.mocked(loadAgents).mockResolvedValue(mockAgents);
    vi.mocked(loadWorkflow).mockResolvedValue(mockWorkflow);
    vi.mocked(getEffectiveConfig).mockReturnValue({
      ...mockConfig,
      agents: { ...mockConfig.agents!, disabled: [], enabled: undefined },
      workflows: { ...mockConfig.workflows!, sessionLimit: 10000 },
    });

    // Initialize orchestrator with in-memory store
    orchestrator = new ApexOrchestrator({ projectPath: '/test' });
    await orchestrator.initialize();
    store = (orchestrator as any).store;
  });

  describe('resumeTask with context integration', () => {
    it('should call createContextSummary on checkpoint conversation state', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test resume context integration',
        workflow: 'feature',
      });

      // Create mock conversation state
      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Please implement user authentication' }],
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'I will implement JWT-based authentication. Let me start by creating the auth service.' }],
        },
        {
          type: 'assistant',
          content: [{ type: 'tool_use', toolName: 'Write', toolInput: { file_path: '/src/auth.ts', content: 'export class AuthService {}' } }],
        },
        {
          type: 'user',
          content: [{ type: 'tool_result', toolResult: 'File created successfully' }],
        },
      ];

      // Save checkpoint with conversation state
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState,
        metadata: { completedStages: ['planning'] },
      });

      // Mock the query function to return successful completion
      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', text: 'Implementation completed successfully.' };
        },
      } as unknown as ReturnType<typeof query>);

      // Spy on createContextSummary function
      const createContextSummarySpy = vi.spyOn(require('./context'), 'createContextSummary');

      // Resume the task
      const resumed = await orchestrator.resumeTask(task.id, { checkpointId });
      expect(resumed).toBe(true);

      // Verify createContextSummary was called with the conversation state
      expect(createContextSummarySpy).toHaveBeenCalledWith(conversationState);
    });

    it('should use buildResumePrompt to create resume context', async () => {
      const task = await orchestrator.createTask({
        description: 'Test buildResumePrompt integration',
        workflow: 'feature',
      });

      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Implement file upload feature' }],
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Completed the file validation middleware. I decided to use multer for handling uploads.' }],
        },
      ];

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 2,
        conversationState,
        metadata: { completedStages: ['planning', 'implementation'] },
      });

      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', text: 'Testing completed successfully.' };
        },
      } as unknown as ReturnType<typeof query>);

      // Spy on buildResumePrompt
      const buildResumePromptSpy = vi.spyOn(require('./prompts'), 'buildResumePrompt');

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Verify buildResumePrompt was called with task, checkpoint, and context summary
      expect(buildResumePromptSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: task.id }),
        expect.objectContaining({ checkpointId }),
        expect.any(String) // context summary
      );
    });

    it('should inject resume context into workflow stage prompts', async () => {
      const task = await orchestrator.createTask({
        description: 'Test resume context injection',
        workflow: 'feature',
      });

      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Create a user management system' }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement a comprehensive user management system. I\'ve decided to use PostgreSQL for the database. Completed the user model and service layer.'
          }],
        },
      ];

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 2,
        conversationState,
        metadata: { completedStages: ['planning', 'implementation'] },
      });

      // Capture the prompt sent to the agent
      let capturedPrompt: string = '';
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation((agentDef: SDKAgentDefinition, prompt: string) => {
        capturedPrompt = prompt;
        return {
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'text', text: 'Testing completed successfully.' };
          },
        } as unknown as ReturnType<typeof query>;
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Verify resume context was injected into the prompt
      expect(capturedPrompt).toContain('🔄 SESSION RESUME CONTEXT');
      expect(capturedPrompt).toContain('Resuming Task**: Test resume context injection');
      expect(capturedPrompt).toContain('Stage "testing"');
      expect(capturedPrompt).toContain('What Was Accomplished');
      expect(capturedPrompt).toContain('Key Decisions Made');
      expect(capturedPrompt).toContain('PostgreSQL for the database');
      expect(capturedPrompt).toContain('user model and service layer');
    });

    it('should log resume context for debugging', async () => {
      const task = await orchestrator.createTask({
        description: 'Test resume context logging',
        workflow: 'feature',
      });

      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Build an API gateway' }],
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Completed the rate limiting middleware. Built the authentication layer.' }],
        },
      ];

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState,
        metadata: { completedStages: ['planning'] },
      });

      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', text: 'Implementation completed successfully.' };
        },
      } as unknown as ReturnType<typeof query>);

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Check that debug logs were created
      const logs = await store.getLogs(task.id);

      const resumeContextLog = logs.find(log =>
        log.message.includes('Generated resume context for checkpoint')
      );
      expect(resumeContextLog).toBeDefined();
      expect(resumeContextLog?.level).toBe('debug');
      expect(resumeContextLog?.metadata?.checkpointId).toBe(checkpointId);
      expect(resumeContextLog?.metadata?.contextSummaryLength).toBeGreaterThan(0);
      expect(resumeContextLog?.metadata?.resumeContextLength).toBeGreaterThan(0);
      expect(resumeContextLog?.metadata?.conversationMessageCount).toBe(2);

      const resumeLog = logs.find(log =>
        log.message.includes('Resuming task from checkpoint')
      );
      expect(resumeLog).toBeDefined();
      expect(resumeLog?.metadata?.hasResumeContext).toBe(true);
    });

    it('should handle cases with empty conversation history', async () => {
      const task = await orchestrator.createTask({
        description: 'Test empty conversation history',
        workflow: 'feature',
      });

      // Create checkpoint with empty conversation state
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'planning',
        stageIndex: 0,
        conversationState: [], // Empty conversation
        metadata: { completedStages: [] },
      });

      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', text: 'Planning completed successfully.' };
        },
      } as unknown as ReturnType<typeof query>);

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Check that no resume context log was created, but info log exists
      const logs = await store.getLogs(task.id);

      const noConversationLog = logs.find(log =>
        log.message.includes('No conversation state available in checkpoint')
      );
      expect(noConversationLog).toBeDefined();
      expect(noConversationLog?.level).toBe('info');

      const resumeLog = logs.find(log =>
        log.message.includes('Resuming task from checkpoint')
      );
      expect(resumeLog?.metadata?.hasResumeContext).toBe(false);
    });

    it('should handle cases with minimal conversation history', async () => {
      const task = await orchestrator.createTask({
        description: 'Test minimal conversation history',
        workflow: 'feature',
      });

      // Create checkpoint with minimal conversation (just system prompt)
      const conversationState: AgentMessage[] = [
        {
          type: 'system',
          content: [{ type: 'text', text: 'You are a helpful assistant.' }],
        },
      ];

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        conversationState,
        metadata: { completedStages: ['planning'] },
      });

      let capturedPrompt: string = '';
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation((agentDef: SDKAgentDefinition, prompt: string) => {
        capturedPrompt = prompt;
        return {
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'text', text: 'Implementation completed successfully.' };
          },
        } as unknown as ReturnType<typeof query>;
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Should still generate resume context but with limited content
      expect(capturedPrompt).toContain('🔄 SESSION RESUME CONTEXT');
      expect(capturedPrompt).toContain('No specific accomplishments identified');
      expect(capturedPrompt).toContain('No significant decisions identified');
    });

    it('should only inject resume context to first stage being resumed', async () => {
      const task = await orchestrator.createTask({
        description: 'Test resume context only on first stage',
        workflow: 'feature',
      });

      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Build a monitoring system' }],
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Completed the metrics collection service.' }],
        },
      ];

      // Create checkpoint at planning stage (index 0)
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'planning',
        stageIndex: 0,
        conversationState,
        metadata: { completedStages: [] },
      });

      const capturedPrompts: string[] = [];
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation((agentDef: SDKAgentDefinition, prompt: string) => {
        capturedPrompts.push(prompt);
        return {
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'text', text: `${agentDef.description} completed successfully.` };
          },
        } as unknown as ReturnType<typeof query>;
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Should have executed all 3 stages (planning, implementation, testing)
      expect(capturedPrompts).toHaveLength(3);

      // Only first stage (planning) should have resume context
      expect(capturedPrompts[0]).toContain('🔄 SESSION RESUME CONTEXT');
      expect(capturedPrompts[1]).not.toContain('🔄 SESSION RESUME CONTEXT');
      expect(capturedPrompts[2]).not.toContain('🔄 SESSION RESUME CONTEXT');
    });

    it('should generate appropriate resume context with complex conversation history', async () => {
      const task = await orchestrator.createTask({
        description: 'Test complex conversation resume context',
        workflow: 'feature',
      });

      // Complex conversation with multiple file operations and decisions
      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Implement a real-time chat application with WebSocket support' }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement a real-time chat system. I\'ve decided to use Socket.IO for WebSocket management because of its reliability and fallback support. The architecture will be event-driven with message queuing.'
          }],
        },
        {
          type: 'assistant',
          content: [{ type: 'tool_use', toolName: 'Write', toolInput: { file_path: '/src/chat/socket-manager.ts', content: 'export class SocketManager {}' } }],
        },
        {
          type: 'user',
          content: [{ type: 'tool_result', toolResult: 'File created successfully' }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed the socket manager implementation. Built the message broadcasting system. Currently working on implementing user presence tracking.'
          }],
        },
        {
          type: 'assistant',
          content: [{ type: 'tool_use', toolName: 'Edit', toolInput: { file_path: '/src/chat/message-handler.ts', old_string: 'old code', new_string: 'new code' } }],
        },
      ];

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 2,
        conversationState,
        metadata: { completedStages: ['planning', 'implementation'] },
      });

      let capturedPrompt: string = '';
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation((agentDef: SDKAgentDefinition, prompt: string) => {
        capturedPrompt = prompt;
        return {
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'text', text: 'Testing completed successfully.' };
          },
        } as unknown as ReturnType<typeof query>;
      });

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Verify comprehensive resume context was generated
      expect(capturedPrompt).toContain('🔄 SESSION RESUME CONTEXT');
      expect(capturedPrompt).toContain('real-time chat application with WebSocket support');

      // Check key decisions extraction
      expect(capturedPrompt).toContain('Key Decisions Made');
      expect(capturedPrompt).toContain('Socket.IO for WebSocket management');
      expect(capturedPrompt).toContain('event-driven with message queuing');

      // Check accomplishments extraction
      expect(capturedPrompt).toContain('What Was Accomplished');
      expect(capturedPrompt).toContain('socket manager implementation');
      expect(capturedPrompt).toContain('message broadcasting system');

      // Check file modifications tracking
      expect(capturedPrompt).toContain('Files written: /src/chat/socket-manager.ts');
      expect(capturedPrompt).toContain('Files edited: /src/chat/message-handler.ts');

      // Check progress tracking
      expect(capturedPrompt).toContain('user presence tracking');
    });

    it('should handle resume context with conversation state that has errors', async () => {
      const task = await orchestrator.createTask({
        description: 'Test resume context with errors',
        workflow: 'feature',
      });

      // Conversation with malformed content
      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Implement error handling' }],
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: null as unknown as string }], // Malformed
        },
        {
          type: 'assistant',
          content: [], // Empty content
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Successfully implemented error boundary component. Built robust error logging system.'
          }],
        },
      ];

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 2,
        conversationState,
        metadata: { completedStages: ['planning', 'implementation'] },
      });

      let capturedPrompt: string = '';
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation((agentDef: SDKAgentDefinition, prompt: string) => {
        capturedPrompt = prompt;
        return {
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'text', text: 'Testing completed successfully.' };
          },
        } as unknown as ReturnType<typeof query>;
      });

      // Should not throw error despite malformed conversation state
      await expect(orchestrator.resumeTask(task.id, { checkpointId })).resolves.toBe(true);

      // Should still generate resume context from valid parts
      expect(capturedPrompt).toContain('🔄 SESSION RESUME CONTEXT');
      expect(capturedPrompt).toContain('error boundary component');
      expect(capturedPrompt).toContain('error logging system');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle checkpoint without conversation state', async () => {
      const task = await orchestrator.createTask({
        description: 'Test no conversation state',
        workflow: 'feature',
      });

      // Create checkpoint without conversation state
      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'implementation',
        stageIndex: 1,
        // conversationState not provided
        metadata: { completedStages: ['planning'] },
      });

      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', text: 'Implementation completed successfully.' };
        },
      } as unknown as ReturnType<typeof query>);

      await orchestrator.resumeTask(task.id, { checkpointId });

      // Check that appropriate log was created
      const logs = await store.getLogs(task.id);
      const noConversationLog = logs.find(log =>
        log.message.includes('No conversation state available in checkpoint')
      );
      expect(noConversationLog).toBeDefined();
    });

    it('should handle large conversation state efficiently', async () => {
      const task = await orchestrator.createTask({
        description: 'Test large conversation state',
        workflow: 'feature',
      });

      // Create large conversation state with 100 messages
      const conversationState: AgentMessage[] = Array.from({ length: 100 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: [{
          type: 'text',
          text: `Message ${i}: This is a detailed message about implementing feature ${i} with comprehensive details and explanations.`
        }],
      }));

      const checkpointId = await orchestrator.saveCheckpoint(task.id, {
        stage: 'testing',
        stageIndex: 2,
        conversationState,
        metadata: { completedStages: ['planning', 'implementation'] },
      });

      const startTime = Date.now();

      const mockQuery = vi.mocked(query);
      mockQuery.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'text', text: 'Testing completed successfully.' };
        },
      } as unknown as ReturnType<typeof query>);

      await orchestrator.resumeTask(task.id, { checkpointId });

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (less than 2 seconds)
      expect(duration).toBeLessThan(2000);
    });
  });
});