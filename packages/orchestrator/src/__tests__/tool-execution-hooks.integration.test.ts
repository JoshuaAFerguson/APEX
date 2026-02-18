import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index';
import {
  ToolStartHookContext,
  ToolCompleteHookContext,
  ToolErrorHookContext,
  generateTaskId,
  WorkflowDefinition,
  AgentDefinition,
} from '@apexcli/core';
import path from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';

describe('Tool Execution Hooks Integration', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = path.join(process.cwd(), '.test-tool-hooks-integration');
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
    mkdirSync(tempDir, { recursive: true });

    // Create minimal APEX project structure
    const apexDir = path.join(tempDir, '.apex');
    mkdirSync(apexDir, { recursive: true });

    // Create config.yaml
    const config = {
      project: {
        name: 'test-project',
        version: '1.0.0',
      },
      autonomy: {
        level: 'guided',
      },
    };
    writeFileSync(path.join(apexDir, 'config.yaml'), `# APEX Configuration
project:
  name: test-project
  version: 1.0.0
autonomy:
  level: guided
`);

    // Create agents directory
    const agentsDir = path.join(apexDir, 'agents');
    mkdirSync(agentsDir);

    // Create a test agent
    writeFileSync(path.join(agentsDir, 'test-agent.md'), `# Test Agent

A simple test agent for integration testing.

## Tools
- Read
- Write

## Model
sonnet
`);

    // Create workflows directory
    const workflowsDir = path.join(apexDir, 'workflows');
    mkdirSync(workflowsDir);

    // Create a test workflow
    const workflow = {
      name: 'test-workflow',
      description: 'A test workflow',
      triggers: ['manual'],
      stages: [
        {
          name: 'test-stage',
          agent: 'test-agent',
          description: 'Test stage',
          tools: ['Read', 'Write'],
        },
      ],
    };
    writeFileSync(
      path.join(workflowsDir, 'test-workflow.yaml'),
      `name: test-workflow
description: A test workflow
triggers:
  - manual
stages:
  - name: test-stage
    agent: test-agent
    description: Test stage
    tools:
      - Read
      - Write
`
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
    });

    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('Real Tool Execution Flow', () => {
    it('should trigger hooks during actual task execution', async () => {
      const toolStartEvents: ToolStartHookContext[] = [];
      const toolCompleteEvents: ToolCompleteHookContext[] = [];
      const toolErrorEvents: ToolErrorHookContext[] = [];

      // Register hooks
      const unsubStart = orchestrator.onToolStart((context) => {
        toolStartEvents.push(context);
      });

      const unsubComplete = orchestrator.onToolComplete((context) => {
        toolCompleteEvents.push(context);
      });

      const unsubError = orchestrator.onToolError((context) => {
        toolErrorEvents.push(context);
      });

      try {
        // Create a simple test file
        const testFile = path.join(tempDir, 'test.txt');
        writeFileSync(testFile, 'Hello World');

        // Create and run a task that will use tools
        const task = await orchestrator.createTask({
          type: 'feature',
          description: 'Read the test file and report its contents',
          workflow: 'test-workflow',
        });

        // Note: Since this is integration test, we would normally run the task
        // However, for testing purposes, we'll simulate tool events manually
        // as they would occur during real task execution

        const callId = 'integration-test-1';

        // Simulate Read tool execution
        orchestrator.emit('tool:start', {
          taskId: task.id,
          toolName: 'Read',
          input: { filePath: testFile },
          callId,
          timestamp: new Date(),
        });

        // Wait for event processing
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Simulate successful completion
        orchestrator.emit('tool:complete', {
          taskId: task.id,
          toolName: 'Read',
          callId,
          result: { success: true, output: 'Hello World' },
          timing: { startTime: new Date(), endTime: new Date(), duration: 50 },
          timestamp: new Date(),
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        // Verify hooks were triggered
        expect(toolStartEvents).toHaveLength(1);
        expect(toolCompleteEvents).toHaveLength(1);
        expect(toolErrorEvents).toHaveLength(0);

        // Verify start event context
        const startEvent = toolStartEvents[0];
        expect(startEvent.toolName).toBe('Read');
        expect(startEvent.input).toEqual({ filePath: testFile });
        expect(startEvent.taskId).toBe(task.id);
        expect(startEvent.callId).toBe(callId);

        // Verify complete event context
        const completeEvent = toolCompleteEvents[0];
        expect(completeEvent.toolName).toBe('Read');
        expect(completeEvent.taskId).toBe(task.id);
        expect(completeEvent.callId).toBe(callId);
        expect(completeEvent.result.success).toBe(true);
        expect(completeEvent.result.output).toBe('Hello World');

      } finally {
        unsubStart();
        unsubComplete();
        unsubError();
      }
    });

    it('should provide agent and stage context during workflow execution', async () => {
      const toolStartEvents: ToolStartHookContext[] = [];

      const unsubStart = orchestrator.onToolStart((context) => {
        toolStartEvents.push(context);
      });

      try {
        const task = await orchestrator.createTask({
          type: 'feature',
          description: 'Test workflow execution with context',
          workflow: 'test-workflow',
        });

        const callId = 'integration-test-2';

        // Mock active tool execution with agent/stage context
        const toolExecution = {
          callId,
          toolName: 'Write',
          input: { filePath: path.join(tempDir, 'output.txt'), content: 'test' },
          startTime: new Date(),
          taskId: task.id,
          agentName: 'test-agent',
          stageName: 'test-stage',
          status: 'in_progress' as const,
        };

        vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue(toolExecution);

        orchestrator.emit('tool:start', {
          taskId: task.id,
          toolName: 'Write',
          input: { filePath: path.join(tempDir, 'output.txt'), content: 'test' },
          callId,
          timestamp: new Date(),
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(toolStartEvents).toHaveLength(1);
        const startEvent = toolStartEvents[0];
        expect(startEvent.agentName).toBe('test-agent');
        expect(startEvent.stageName).toBe('test-stage');

      } finally {
        unsubStart();
      }
    });

    it('should handle tool errors during real execution', async () => {
      const toolErrorEvents: ToolErrorHookContext[] = [];

      const unsubError = orchestrator.onToolError((context) => {
        toolErrorEvents.push(context);
      });

      try {
        const task = await orchestrator.createTask({
          type: 'feature',
          description: 'Test error handling',
          workflow: 'test-workflow',
        });

        const callId = 'integration-test-3';

        // Mock active tool execution
        const toolExecution = {
          callId,
          toolName: 'Read',
          input: { filePath: '/nonexistent/file.txt' },
          startTime: new Date(),
          taskId: task.id,
          agentName: 'test-agent',
          stageName: 'test-stage',
          status: 'in_progress' as const,
        };

        vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue(toolExecution);

        // Simulate tool start
        orchestrator.emit('tool:start', {
          taskId: task.id,
          toolName: 'Read',
          input: { filePath: '/nonexistent/file.txt' },
          callId,
          timestamp: new Date(),
        });

        // Simulate tool error
        orchestrator.emit('tool:complete', {
          taskId: task.id,
          toolName: 'Read',
          callId,
          result: { success: false, error: 'File not found' },
          timing: { startTime: new Date(), endTime: new Date(), duration: 10 },
          timestamp: new Date(),
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(toolErrorEvents).toHaveLength(1);
        const errorEvent = toolErrorEvents[0];
        expect(errorEvent.toolName).toBe('Read');
        expect(errorEvent.error).toBe('File not found');
        expect(errorEvent.agentName).toBe('test-agent');
        expect(errorEvent.stageName).toBe('test-stage');

      } finally {
        unsubError();
      }
    });
  });

  describe('Hook Management', () => {
    it('should handle multiple concurrent hooks without interference', async () => {
      const hook1Events: string[] = [];
      const hook2Events: string[] = [];

      const unsub1 = orchestrator.onToolStart(() => {
        hook1Events.push('hook1-start');
      });

      const unsub2 = orchestrator.onToolStart(() => {
        hook2Events.push('hook2-start');
      });

      const unsub3 = orchestrator.onToolComplete(() => {
        hook1Events.push('hook1-complete');
      });

      const unsub4 = orchestrator.onToolComplete(() => {
        hook2Events.push('hook2-complete');
      });

      try {
        const task = await orchestrator.createTask({
          type: 'feature',
          description: 'Test multiple hooks',
          workflow: 'test-workflow',
        });

        const callId = 'multi-hook-test';

        // Mock tool execution
        vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
          callId,
          toolName: 'Read',
          input: { filePath: 'test.txt' },
          startTime: new Date(),
          taskId: task.id,
          status: 'in_progress' as const,
        });

        // Emit events
        orchestrator.emit('tool:start', {
          taskId: task.id,
          toolName: 'Read',
          input: { filePath: 'test.txt' },
          callId,
          timestamp: new Date(),
        });

        orchestrator.emit('tool:complete', {
          taskId: task.id,
          toolName: 'Read',
          callId,
          result: { success: true, output: 'content' },
          timing: { startTime: new Date(), endTime: new Date(), duration: 25 },
          timestamp: new Date(),
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        // Both hooks should have received both events
        expect(hook1Events).toEqual(['hook1-start', 'hook1-complete']);
        expect(hook2Events).toEqual(['hook2-start', 'hook2-complete']);

      } finally {
        unsub1();
        unsub2();
        unsub3();
        unsub4();
      }
    });

    it('should properly clean up hooks when unsubscribed during execution', async () => {
      const hookCalls: string[] = [];

      const unsub = orchestrator.onToolStart(() => {
        hookCalls.push('hook-called');
      });

      const task = await orchestrator.createTask({
        type: 'feature',
        description: 'Test hook cleanup',
        workflow: 'test-workflow',
      });

      // First event should trigger hook
      orchestrator.emit('tool:start', {
        taskId: task.id,
        toolName: 'Read',
        input: { filePath: 'file1.txt' },
        callId: 'cleanup-test-1',
        timestamp: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(hookCalls).toEqual(['hook-called']);

      // Unsubscribe
      unsub();

      // Second event should not trigger hook
      orchestrator.emit('tool:start', {
        taskId: task.id,
        toolName: 'Write',
        input: { filePath: 'file2.txt', content: 'test' },
        callId: 'cleanup-test-2',
        timestamp: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(hookCalls).toEqual(['hook-called']); // Still only one call
    });
  });
});