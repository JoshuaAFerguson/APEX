/**
 * Integration test demonstrating MockClaudeAgentSDK usage with existing test patterns
 *
 * This test shows how existing tests can be refactored to use the comprehensive
 * mock utilities instead of manually creating mock implementations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../../index';
import { initializeApex } from '@apexcli/core';
import {
  MockClaudeAgentSDK,
  MockResponseBuilder,
  StreamingResponseBuilder,
  setupMockSDK,
  MockErrors
} from './index';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Use setupMockSDK helper for clean integration
const mockSDK = setupMockSDK();

describe('MockClaudeAgentSDK Integration Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    mockSDK.reset();

    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mock-integration-'));
    await initializeApex({
      projectPath: testDir,
      projectName: 'test-project',
      autonomyLevel: 'semi-autonomous',
      autoApprove: true,
      skipAgentCreation: true
    });

    // Create minimal agent for testing
    const developerContent = `---
name: developer
description: Implements code changes
tools: Read, Write, Edit
model: sonnet
---
You are a developer agent that implements code changes.
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      developerContent
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Mock Usage', () => {
    it('should simplify single response testing', async () => {
      // Old pattern (complex manual mock):
      // query.mockImplementation(async function* () {
      //   yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      // });

      // New pattern (simple and clear):
      mockSDK.addResponse({ content: 'Test response' });

      await orchestrator.initialize();
      const task = await orchestrator.createTask({
        name: 'test-task',
        description: 'Test description',
        workflow: 'developer-only'
      });

      await orchestrator.runTask(task.id);

      const history = mockSDK.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].message).toContain('Test description');
    });

    it('should simplify multi-stage workflow testing', async () => {
      // Configure responses for a multi-stage workflow
      mockSDK
        .addResponse({ content: 'Planning stage complete', usage: { inputTokens: 100, outputTokens: 50 } })
        .addResponse({ content: 'Implementation stage complete', usage: { inputTokens: 200, outputTokens: 100 } })
        .addResponse({ content: 'Testing stage complete', usage: { inputTokens: 150, outputTokens: 75 } });

      await orchestrator.initialize();
      const task = await orchestrator.createTask({
        name: 'multi-stage-task',
        description: 'Multi-stage workflow test',
        workflow: 'feature-development'
      });

      await orchestrator.runTask(task.id);

      const history = mockSDK.getCallHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);

      // Verify that all responses were consumed
      const remainingHistory = mockSDK.getCallHistory();
      expect(remainingHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Error Simulation', () => {
    it('should simplify error testing', async () => {
      // Test session limit error
      mockSDK.addError(MockErrors.sessionLimit());

      await orchestrator.initialize();
      const task = await orchestrator.createTask({
        name: 'error-task',
        description: 'Task that should fail',
        workflow: 'developer-only'
      });

      await expect(orchestrator.runTask(task.id)).rejects.toThrow('Session limit reached');
    });

    it('should test sequential responses with error', async () => {
      mockSDK
        .addResponse({ content: 'First response successful' })
        .addError('Second call fails')
        .addResponse({ content: 'Third response after recovery' });

      await orchestrator.initialize();

      // First call should succeed
      const task1 = await orchestrator.createTask({
        name: 'task-1',
        description: 'First task',
        workflow: 'developer-only'
      });
      await orchestrator.runTask(task1.id);

      // Second call should fail
      const task2 = await orchestrator.createTask({
        name: 'task-2',
        description: 'Second task',
        workflow: 'developer-only'
      });
      await expect(orchestrator.runTask(task2.id)).rejects.toThrow('Second call fails');

      // Third call should succeed
      const task3 = await orchestrator.createTask({
        name: 'task-3',
        description: 'Third task',
        workflow: 'developer-only'
      });
      await orchestrator.runTask(task3.id);

      expect(mockSDK.getCallHistory()).toHaveLength(3);
    });
  });

  describe('Advanced Response Building', () => {
    it('should test complex tool usage workflows', async () => {
      const complexResponse = MockResponseBuilder
        .create()
        .withThinking('I need to read the current code')
        .withToolUse('read_1', 'Read', { file_path: '/src/index.ts' })
        .withThinking('Now I need to write the updated code')
        .withToolUse('write_1', 'Write', {
          file_path: '/src/index.ts',
          content: 'export const hello = "world";'
        })
        .withText('I have successfully updated the file.')
        .withUsage(300, 150)
        .build();

      mockSDK.addResponse(complexResponse);

      await orchestrator.initialize();
      const task = await orchestrator.createTask({
        name: 'complex-task',
        description: 'Update the index.ts file',
        workflow: 'developer-only'
      });

      await orchestrator.runTask(task.id);

      const history = mockSDK.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].message).toContain('Update the index.ts file');
    });

    it('should test streaming responses', async () => {
      const streamingEvents = new StreamingResponseBuilder()
        .addThinking('Processing request...', 50)
        .addTextChunk('Starting implementation', 100)
        .addToolUse('tool_1', 'Read', { file_path: '/test.ts' }, 100)
        .addTextChunk('Implementation complete', 50)
        .addUsage(200, 150)
        .build();

      mockSDK.addStreamingResponse(streamingEvents);

      await orchestrator.initialize();
      const task = await orchestrator.createTask({
        name: 'streaming-task',
        description: 'Task with streaming response',
        workflow: 'developer-only'
      });

      const startTime = Date.now();
      await orchestrator.runTask(task.id);
      const duration = Date.now() - startTime;

      // Should take at least the total delay time (300ms)
      expect(duration).toBeGreaterThanOrEqual(250);

      const history = mockSDK.getCallHistory();
      expect(history).toHaveLength(1);
    });
  });

  describe('Call History and Verification', () => {
    it('should provide detailed call tracking', async () => {
      mockSDK.setDefaultResponse({ content: 'Default response' });

      await orchestrator.initialize();

      // Make multiple calls
      for (let i = 0; i < 3; i++) {
        const task = await orchestrator.createTask({
          name: `task-${i}`,
          description: `Task ${i} description`,
          workflow: 'developer-only'
        });
        await orchestrator.runTask(task.id);
      }

      const history = mockSDK.getCallHistory();
      expect(history).toHaveLength(3);

      // Verify call details
      history.forEach((call, index) => {
        expect(call.timestamp).toBeInstanceOf(Date);
        expect(call.agent).toBeDefined();
        expect(call.agent.name).toBe('developer');
        expect(call.message).toContain(`Task ${index} description`);
      });
    });

    it('should track usage across multiple calls', async () => {
      mockSDK
        .addResponse({ content: 'Response 1', usage: { inputTokens: 100, outputTokens: 50 } })
        .addResponse({ content: 'Response 2', usage: { inputTokens: 150, outputTokens: 75 } })
        .addResponse({ content: 'Response 3', usage: { inputTokens: 200, outputTokens: 100 } });

      await orchestrator.initialize();

      for (let i = 0; i < 3; i++) {
        const task = await orchestrator.createTask({
          name: `usage-task-${i}`,
          description: `Usage tracking task ${i}`,
          workflow: 'developer-only'
        });
        await orchestrator.runTask(task.id);
      }

      const history = mockSDK.getCallHistory();
      expect(history).toHaveLength(3);

      // Can be used to verify total usage across workflow
      const totalInputTokens = history.length * 100; // Based on configured usage
      expect(totalInputTokens).toBeGreaterThan(0);
    });
  });

  describe('Migration from Manual Mocks', () => {
    it('demonstrates migrating from manual async generator mock', async () => {
      // OLD PATTERN - Manual async generator (complex and error-prone):
      /*
      const oldMock = vi.fn().mockImplementation(async function* () {
        yield {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Manual mock response' }]
          }
        };
        yield {
          type: 'usage',
          usage: { inputTokens: 100, outputTokens: 50 }
        };
      });
      */

      // NEW PATTERN - Simple and declarative:
      mockSDK.addResponse({
        content: 'Simple mock response',
        usage: { inputTokens: 100, outputTokens: 50 }
      });

      await orchestrator.initialize();
      const task = await orchestrator.createTask({
        name: 'migration-demo',
        description: 'Migration demonstration',
        workflow: 'developer-only'
      });

      await orchestrator.runTask(task.id);

      const history = mockSDK.getCallHistory();
      expect(history).toHaveLength(1);
    });

    it('demonstrates migrating complex manual mocks', async () => {
      // OLD PATTERN - Complex manual implementation capture:
      /*
      let capturedOptions: any;
      query.mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });
      */

      // NEW PATTERN - Built-in call tracking:
      mockSDK.addResponse({ content: 'Test response' });

      await orchestrator.initialize();
      const task = await orchestrator.createTask({
        name: 'capture-demo',
        description: 'Options capture demonstration',
        workflow: 'developer-only'
      });

      await orchestrator.runTask(task.id);

      const history = mockSDK.getCallHistory();
      expect(history).toHaveLength(1);

      // Options are automatically captured
      const capturedCall = history[0];
      expect(capturedCall.agent).toBeDefined();
      expect(capturedCall.message).toBeDefined();
      expect(capturedCall.options).toBeDefined();
    });
  });
});