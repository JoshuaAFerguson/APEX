/**
 * @fileoverview Integration tests for the centralized fixtures module
 *
 * Tests demonstrate how the fixtures module integrates across packages
 * and provides realistic usage scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Fixtures from '../index.js';
import { ToolResponseBuilder, ResponseBuilders, ExecutionBuilders } from '../builders/response-builder.js';
import { createTask, TaskPresets } from '../factories/task-factory.js';
import { MCPProtocolErrors, createMCPError } from '../errors/mcp-errors.js';
import type { Task, ToolResult, ToolExecution } from '../../types.js';

describe('Fixtures Module Integration', () => {
  describe('Cross-package usage scenarios', () => {
    it('should support orchestrator package testing patterns', () => {
      // Simulate orchestrator testing that needs tasks with various states
      const pendingTask = TaskPresets.basic.pending();
      const runningTask = TaskPresets.basic.running();
      const completedTask = TaskPresets.basic.completed();

      // Orchestrator would test task state transitions
      expect(pendingTask.status).toBe('pending');
      expect(pendingTask.startedAt).toBeUndefined();

      expect(runningTask.status).toBe('running');
      expect(runningTask.startedAt).toBeDefined();
      expect(runningTask.completedAt).toBeUndefined();

      expect(completedTask.status).toBe('completed');
      expect(completedTask.startedAt).toBeDefined();
      expect(completedTask.completedAt).toBeDefined();

      // Verify orchestrator could use these for workflow testing
      const simulateTaskExecution = (task: Task) => {
        if (task.status === 'pending') return { canStart: true, error: null };
        if (task.status === 'running') return { canStart: false, error: 'Already running' };
        if (task.status === 'completed') return { canStart: false, error: 'Already completed' };
        return { canStart: false, error: 'Invalid status' };
      };

      expect(simulateTaskExecution(pendingTask)).toEqual({ canStart: true, error: null });
      expect(simulateTaskExecution(runningTask)).toEqual({ canStart: false, error: 'Already running' });
      expect(simulateTaskExecution(completedTask)).toEqual({ canStart: false, error: 'Already completed' });
    });

    it('should support CLI package tool execution mocking', () => {
      // CLI package needs to test tool executions and responses
      const fileReadResponse = ResponseBuilders.fileRead('Hello World', '/test/file.txt').build();
      const bashResponse = ResponseBuilders.bash('npm test', 'Tests passed\n', 0).build();
      const failedResponse = ResponseBuilders.failure('Write', 'Permission denied').build();

      // CLI could use these to mock tool responses
      const simulateToolChain = (responses: ToolResult[]) => {
        return responses.map(response => ({
          success: response.success,
          tool: response.toolName,
          duration: response.duration,
          error: response.error
        }));
      };

      const results = simulateToolChain([fileReadResponse, bashResponse, failedResponse]);

      expect(results).toEqual([
        { success: true, tool: 'Read', duration: expect.any(Number), error: undefined },
        { success: true, tool: 'Bash', duration: expect.any(Number), error: undefined },
        { success: false, tool: 'Write', duration: expect.any(Number), error: 'Permission denied' }
      ]);
    });

    it('should support API package error simulation', async () => {
      // API package needs to test error handling scenarios
      const protocolError = await Fixtures.ErrorPresets.mcp.protocolMismatch();
      const networkError = await Fixtures.ErrorPresets.system.networkTimeout();
      const validationError = await Fixtures.ErrorPresets.validation.invalidTask();

      // API would use these for error handling tests
      const simulateErrorHandler = (error: any) => {
        if (error.code) {
          // JSON-RPC error
          return { type: 'protocol', code: error.code, retryable: error.code !== -32600 };
        }
        if (error instanceof Error) {
          // JavaScript error
          return { type: 'system', name: error.name, retryable: error.name.includes('Timeout') };
        }
        // Validation error
        return { type: 'validation', retryable: false };
      };

      expect(simulateErrorHandler(protocolError)).toEqual({
        type: 'protocol',
        code: expect.any(Number),
        retryable: expect.any(Boolean)
      });

      expect(simulateErrorHandler(networkError)).toEqual({
        type: 'system',
        name: expect.stringContaining('Error'),
        retryable: expect.any(Boolean)
      });

      expect(simulateErrorHandler(validationError)).toEqual({
        type: 'validation',
        retryable: false
      });
    });
  });

  describe('Realistic workflow simulation', () => {
    it('should simulate complete task lifecycle with tool executions', () => {
      // Create a task that progresses through stages
      let task = createTask({
        description: 'Implement user authentication feature',
        workflow: 'feature',
        priority: 'high'
      });

      // Simulate planning stage tool executions
      const planningExecutions = [
        ExecutionBuilders.fileRead('/src/auth/index.ts', false).build(), // File doesn't exist yet
        ExecutionBuilders.bash('find src -name "*.test.*" | grep auth').build(),
        ExecutionBuilders.completed('Grep', { pattern: 'authentication' }, { matches: [] }).build()
      ];

      // Simulate architecture stage tool executions
      const architectureExecutions = [
        ExecutionBuilders.fileRead('/docs/architecture.md').build(),
        ResponseBuilders.fileWrite('/docs/auth-design.md', 2048).build(),
        ExecutionBuilders.bash('npm run lint -- --fix').build()
      ];

      // Simulate implementation stage tool executions
      const implementationExecutions = [
        ResponseBuilders.fileWrite('/src/auth/login.ts', 4096).build(),
        ResponseBuilders.fileWrite('/src/auth/register.ts', 3072).build(),
        ExecutionBuilders.bash('npm test -- auth').build()
      ];

      // Verify realistic execution patterns
      expect(planningExecutions[0].result.success).toBe(false); // File doesn't exist
      expect(planningExecutions[1].toolName).toBe('Bash');
      expect(planningExecutions[2].result.output.matches).toEqual([]);

      expect(architectureExecutions[0].result.success).toBe(true);
      expect(architectureExecutions[1].toolName).toBe('Write');
      expect(architectureExecutions[2].toolName).toBe('Bash');

      expect(implementationExecutions[0].output.path).toBe('/src/auth/login.ts');
      expect(implementationExecutions[1].output.path).toBe('/src/auth/register.ts');
      expect(implementationExecutions[2].result.success).toBe(true);

      // Update task with execution results
      task = createTask({
        ...task,
        status: 'completed',
        artifacts: [
          {
            type: 'file',
            name: 'auth-design.md',
            path: '/docs/auth-design.md',
            size: 2048,
            mimeType: 'text/markdown',
            createdAt: new Date(),
            description: 'Authentication system design document'
          },
          {
            type: 'file',
            name: 'login.ts',
            path: '/src/auth/login.ts',
            size: 4096,
            mimeType: 'text/typescript',
            createdAt: new Date(),
            description: 'Login functionality implementation'
          }
        ]
      });

      expect(task.status).toBe('completed');
      expect(task.artifacts.length).toBe(2);
      expect(task.artifacts[0].name).toBe('auth-design.md');
      expect(task.artifacts[1].name).toBe('login.ts');
    });

    it('should simulate error recovery scenarios', () => {
      // Start with a failed task
      let task = createTask({
        status: 'failed',
        error: 'Network timeout during dependency installation',
        retryCount: 1
      });

      // Simulate retry with error handling
      const retryExecutions = [
        // First attempt - network error
        ToolResponseBuilder.create()
          .withToolName('Bash')
          .withError('npm ERR! network timeout')
          .build(),

        // Second attempt - success after retry
        ResponseBuilders.bash('npm install', 'added 42 packages in 15s').build()
      ];

      expect(retryExecutions[0].success).toBe(false);
      expect(retryExecutions[0].error).toContain('network timeout');

      expect(retryExecutions[1].success).toBe(true);
      expect(retryExecutions[1].output.stdout).toContain('added 42 packages');

      // Update task after successful retry
      task = createTask({
        ...task,
        status: 'completed',
        error: undefined,
        retryCount: 2
      });

      expect(task.status).toBe('completed');
      expect(task.error).toBeUndefined();
      expect(task.retryCount).toBe(2);
    });

    it('should simulate multi-agent collaboration scenario', () => {
      // Create a complex task that requires multiple agents
      const task = TaskPresets.enriched.complete();

      // Simulate agent-specific tool executions
      const plannerExecutions = [
        ExecutionBuilders.completed('Grep', { pattern: 'TODO' }, { matches: [
          { file: '/src/app.ts', line: 45, content: '// TODO: Implement feature X' }
        ]}).withAgentName('planner').withStageName('planning').build(),

        ExecutionBuilders.fileRead('/project-requirements.md')
          .withAgentName('planner')
          .withStageName('planning')
          .build()
      ];

      const architectExecutions = [
        ResponseBuilders.fileWrite('/docs/technical-spec.md', 5120)
          .withMetadata({ agent: 'architect', stage: 'architecture' })
          .build(),

        ExecutionBuilders.bash('npm run analyze -- --complexity')
          .withAgentName('architect')
          .withStageName('architecture')
          .build()
      ];

      const developerExecutions = [
        ResponseBuilders.fileWrite('/src/feature-x.ts', 8192)
          .withMetadata({ agent: 'developer', stage: 'implementation' })
          .build(),

        ResponseBuilders.bash('npm test -- feature-x', 'All tests passing')
          .withMetadata({ agent: 'developer', stage: 'implementation' })
          .build()
      ];

      // Verify agent-specific patterns
      expect(plannerExecutions[0].agentName).toBe('planner');
      expect(plannerExecutions[0].stageName).toBe('planning');
      expect(plannerExecutions[0].result.output.matches[0].content).toContain('TODO');

      expect(architectExecutions[0].metadata.agent).toBe('architect');
      expect(architectExecutions[1].agentName).toBe('architect');

      expect(developerExecutions[0].metadata.agent).toBe('developer');
      expect(developerExecutions[1].output.stdout).toBe('All tests passing');

      // Verify task has comprehensive data
      expect(task.usage).toBeDefined();
      expect(task.usage!.agentCosts).toHaveProperty('planner');
      expect(task.usage!.agentCosts).toHaveProperty('architect');
      expect(task.usage!.agentCosts).toHaveProperty('developer');

      expect(task.logs.length).toBeGreaterThan(5);
      expect(task.artifacts.length).toBeGreaterThan(2);
    });
  });

  describe('Performance and load testing support', () => {
    it('should support bulk fixture generation', () => {
      // Generate many tasks for load testing
      const taskCount = 100;
      const tasks = Array.from({ length: taskCount }, (_, i) =>
        createTask({
          description: `Load test task ${i + 1}`,
          priority: i % 4 === 0 ? 'high' : 'normal'
        })
      );

      expect(tasks.length).toBe(taskCount);
      expect(tasks.every(task => task.id.startsWith('task-'))).toBe(true);

      // Verify distribution of priorities
      const highPriorityCount = tasks.filter(task => task.priority === 'high').length;
      expect(highPriorityCount).toBe(Math.floor(taskCount / 4));
    });

    it('should support bulk response generation', () => {
      // Generate many tool responses for performance testing
      const responseCount = 50;
      const responses = Array.from({ length: responseCount }, (_, i) => {
        const tools = ['Read', 'Write', 'Bash', 'Grep', 'Glob'];
        const toolName = tools[i % tools.length];

        return ResponseBuilders.success(toolName, {
          iteration: i + 1,
          data: `Response ${i + 1}`
        }).build();
      });

      expect(responses.length).toBe(responseCount);
      expect(responses.every(response => response.success)).toBe(true);

      // Verify tool name distribution
      const toolCounts = responses.reduce((acc, response) => {
        acc[response.toolName!] = (acc[response.toolName!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(Object.keys(toolCounts)).toHaveLength(5);
      expect(Math.max(...Object.values(toolCounts))).toBe(10); // 50/5 = 10
    });
  });

  describe('Error scenario stress testing', () => {
    it('should simulate cascading failure scenarios', async () => {
      // Create a scenario where multiple systems fail
      const mcpError = createMCPError(MCPProtocolErrors.timeout, {
        category: 'timeout',
        severity: 'high',
        retryable: true
      });

      const systemError = await Fixtures.ErrorPresets.system.networkTimeout();
      const agentError = await Fixtures.ErrorPresets.agent.budgetExceeded();

      // Simulate how the orchestrator might handle cascading failures
      const errors = [mcpError, systemError, agentError];
      const errorSummary = errors.map(error => {
        if (error.code) {
          return { type: 'mcp', severity: error.data?.severity, retryable: error.data?.retryable };
        }
        if (error.name?.includes('Network')) {
          return { type: 'system', severity: 'high', retryable: true };
        }
        return { type: 'agent', severity: 'critical', retryable: false };
      });

      expect(errorSummary).toEqual([
        { type: 'mcp', severity: 'high', retryable: true },
        { type: 'system', severity: 'high', retryable: true },
        { type: 'agent', severity: 'critical', retryable: false }
      ]);

      // Verify that critical errors stop retries
      const shouldRetry = errorSummary.some(summary =>
        summary.retryable && summary.severity !== 'critical'
      );
      expect(shouldRetry).toBe(true);
    });

    it('should support error pattern simulation', () => {
      // Test different error patterns that might occur in production
      const errorPatterns = [
        // Intermittent network issues
        [true, true, false, true, true], // 80% success rate

        // Degraded service
        [true, false, false, true, false], // 40% success rate

        // Service recovery
        [false, false, true, true, true] // Recovery pattern
      ];

      errorPatterns.forEach((pattern, patternIndex) => {
        const responses = pattern.map((success, i) => {
          return success
            ? ResponseBuilders.success('TestTool', { iteration: i })
            : ResponseBuilders.failure('TestTool', `Error ${i}`);
        });

        const successCount = responses.filter(r => r.build().success).length;
        const expectedSuccessCount = pattern.filter(Boolean).length;

        expect(successCount).toBe(expectedSuccessCount);
      });
    });
  });

  describe('Fixtures module backward compatibility', () => {
    it('should maintain compatibility with existing test patterns', () => {
      // Test that legacy fixture functions still work alongside new ones
      expect(Fixtures.loadValidToolFixtures).toBeDefined();
      expect(Fixtures.createTestToolConfig).toBeDefined();
      expect(Fixtures.fixtureExists).toBeDefined();

      // These should not throw errors
      expect(() => Fixtures.loadValidToolFixtures()).not.toThrow();
      expect(() => Fixtures.getFixturesDirectory()).not.toThrow();
      expect(() => Fixtures.clearFixtureCache()).not.toThrow();
    });

    it('should allow gradual migration from legacy to new fixtures', () => {
      // Show how existing tests can gradually adopt new fixtures
      const legacyToolConfig = Fixtures.createTestToolConfig();
      const newTask = createTask();
      const newResponse = ResponseBuilders.success('LegacyTool', legacyToolConfig).build();

      // Both patterns should work together
      expect(legacyToolConfig).toBeDefined();
      expect(newTask.id).toBeDefined();
      expect(newResponse.success).toBe(true);
    });
  });
});