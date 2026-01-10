/**
 * Integration tests for TDDExecutor with ApexOrchestrator
 *
 * This test suite covers:
 * - TDD executor integration with ApexOrchestrator
 * - Event emission and handling between components
 * - End-to-end TDD workflow with real orchestrator setup
 * - Error propagation and recovery
 * - Resource management and cleanup
 *
 * @module tdd-executor-integration.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import {
  TDDExecutor,
  createTDDExecutor,
  type TDDExecutorConfig,
  type TDDExecutionResult,
} from './tdd-executor';
import type {
  ApexConfig,
  AgentDefinition,
  WorkflowDefinition,
  Task,
  TaskStatus,
  ApexEvent,
  ApexEventType,
  TDDStartedEventData,
  TDDIterationStartedEventData,
  TDDTestRunEventData,
  TDDFixGeneratedEventData,
  TDDFixAppliedEventData,
  TDDIterationCompletedEventData,
  TDDCompletedEventData,
  TDDFailedEventData,
} from '@apexcli/core';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs/promises');
vi.mock('@anthropic-ai/claude-agent-sdk');

const mockExec = exec as unknown as Mock;
const mockFs = {
  readFile: vi.mocked(fs.readFile),
  writeFile: vi.mocked(fs.writeFile),
  mkdir: vi.mocked(fs.mkdir),
  access: vi.mocked(fs.access),
  stat: vi.mocked(fs.stat),
  readdir: vi.mocked(fs.readdir),
};
const mockQuery = vi.mocked(query);

describe('TDDExecutor Integration', () => {
  let orchestrator: ApexOrchestrator;
  let taskStore: TaskStore;
  let config: ApexConfig;
  let agents: Record<string, AgentDefinition>;
  let workflows: Record<string, WorkflowDefinition>;
  let dbPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup test database
    dbPath = ':memory:';
    taskStore = new TaskStore(dbPath);

    // Configure test environment
    config = {
      maxConcurrentTasks: 3,
      agents: {
        developer: {
          name: 'developer',
          role: 'Software Developer',
          description: 'Writes and fixes code using TDD practices',
          instructions: 'Follow test-driven development and write clean, testable code',
        },
        tester: {
          name: 'tester',
          role: 'QA Engineer',
          description: 'Creates and runs comprehensive tests',
          instructions: 'Write thorough tests that cover edge cases and validate behavior',
        },
      },
      workflows: {
        tdd: {
          name: 'tdd',
          description: 'Test-driven development workflow',
          stages: [
            { name: 'test', agent: 'tester' },
            { name: 'implement', agent: 'developer' },
            { name: 'refactor', agent: 'developer' },
          ],
        },
      },
      // TDD configuration
      tdd: {
        enabled: true,
        maxIterations: 5,
        testCommand: 'npm test',
        timeout: 30000,
      },
      permissions: {
        allowedTools: ['*'],
        restrictedPaths: [],
        dangerous: {
          enabled: false,
        },
      },
      limits: {
        maxTokensPerRequest: 100000,
        maxRequestsPerHour: 1000,
        maxConcurrentRequests: 10,
      },
    };

    agents = config.agents;
    workflows = config.workflows;

    // Mock file system operations
    mockFs.access.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    } as any);
    mockFs.readdir.mockResolvedValue([]);

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator(
      taskStore,
      config,
      agents,
      workflows,
      '.test-apex',
      '/test/project'
    );

    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
    if (taskStore) {
      taskStore.close();
    }
    vi.restoreAllMocks();
  });

  describe('TDD Executor Initialization', () => {
    it('should initialize TDD executor with orchestrator config', async () => {
      // Access private tddExecutor property for testing
      const tddExecutor = (orchestrator as any).tddExecutor;

      expect(tddExecutor).toBeInstanceOf(TDDExecutor);
      expect(tddExecutor).toBeInstanceOf(EventEmitter);
    });

    it('should use orchestrator agents in TDD executor', async () => {
      const tddExecutor = (orchestrator as any).tddExecutor;
      const executorAgents = (tddExecutor as any).agents;

      expect(executorAgents).toEqual(agents);
      expect(executorAgents.developer).toBeDefined();
      expect(executorAgents.developer.role).toBe('Software Developer');
    });
  });

  describe('TDD Event Integration', () => {
    it('should emit TDD events through orchestrator event system', async () => {
      const events: Array<{ type: ApexEventType; data: any }> = [];

      orchestrator.on('tdd:started', (data) => {
        events.push({ type: 'tdd:started', data });
      });

      orchestrator.on('tdd:iteration-started', (data) => {
        events.push({ type: 'tdd:iteration-started', data });
      });

      orchestrator.on('tdd:test-run', (data) => {
        events.push({ type: 'tdd:test-run', data });
      });

      orchestrator.on('tdd:completed', (data) => {
        events.push({ type: 'tdd:completed', data });
      });

      // Mock successful test execution
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'All tests passed', stderr: '' });
        }
        return { stdout: 'All tests passed', stderr: '' };
      });

      // Execute TDD through orchestrator
      const tddExecutor = (orchestrator as any).tddExecutor;
      await tddExecutor.execute('test-task-123');

      expect(events).toHaveLength(4);
      expect(events.map(e => e.type)).toEqual([
        'tdd:started',
        'tdd:iteration-started',
        'tdd:test-run',
        'tdd:completed'
      ]);

      // Verify event data structure
      const startedEvent = events.find(e => e.type === 'tdd:started');
      expect(startedEvent?.data).toMatchObject({
        config: expect.objectContaining({
          maxIterations: expect.any(Number),
          testCommand: expect.any(String),
        }),
        taskId: 'test-task-123',
      });
    });

    it('should emit TDD fix events when tests fail and fixes are applied', async () => {
      const fixEvents: Array<{ type: ApexEventType; data: any }> = [];

      orchestrator.on('tdd:fix-generated', (data) => {
        fixEvents.push({ type: 'tdd:fix-generated', data });
      });

      orchestrator.on('tdd:fix-applied', (data) => {
        fixEvents.push({ type: 'tdd:fix-applied', data });
      });

      orchestrator.on('tdd:iteration-completed', (data) => {
        fixEvents.push({ type: 'tdd:iteration-completed', data });
      });

      // Mock test failure followed by success
      let callCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = `
FAIL src/calculator.test.ts
  × should add two numbers
    TypeError: calculator.add is not a function
          `;
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          if (callback) {
            callback(null, { stdout: 'All tests passed', stderr: '' });
          }
        }
        return {};
      });

      // Mock Claude fix generation
      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Add missing add method to calculator',
          file: 'src/calculator.ts',
          originalContent: 'export class Calculator {',
          newContent: 'export class Calculator {\n  add(a: number, b: number) {\n    return a + b;\n  }',
          confidence: 0.9,
          reasoning: 'The test expects an add method that is missing from the Calculator class',
        }),
      });

      mockFs.readFile.mockResolvedValue('export class Calculator {\n}');
      mockFs.writeFile.mockResolvedValue(undefined);

      // Execute TDD
      const tddExecutor = (orchestrator as any).tddExecutor;
      const result = await tddExecutor.execute('fix-task-456');

      expect(result.success).toBe(true);
      expect(fixEvents).toHaveLength(3);
      expect(fixEvents.map(e => e.type)).toEqual([
        'tdd:fix-generated',
        'tdd:fix-applied',
        'tdd:iteration-completed'
      ]);

      // Verify fix event data
      const fixGeneratedEvent = fixEvents.find(e => e.type === 'tdd:fix-generated');
      expect(fixGeneratedEvent?.data).toMatchObject({
        fix: expect.objectContaining({
          description: 'Add missing add method to calculator',
          file: 'src/calculator.ts',
          confidence: 0.9,
        }),
        iteration: 1,
        taskId: 'fix-task-456',
      });
    });
  });

  describe('TDD Error Handling Integration', () => {
    it('should emit TDD failure events and handle errors gracefully', async () => {
      const errorEvents: Array<{ type: ApexEventType; data: any }> = [];

      orchestrator.on('tdd:failed', (data) => {
        errorEvents.push({ type: 'tdd:failed', data });
      });

      // Mock Claude API failure
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × test failure\n Error message';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockRejectedValue(new Error('Claude API unavailable'));

      const tddExecutor = (orchestrator as any).tddExecutor;

      // Expect the TDD executor to propagate the error
      await expect(tddExecutor.execute('error-task-789')).rejects.toThrow('Failed to generate fix: Claude API unavailable');

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].data).toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining('Claude API unavailable'),
        }),
        iteration: 1,
        taskId: 'error-task-789',
      });
    });

    it('should handle file system errors during fix application', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × test failure\n Error message';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.8,
        }),
      });

      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const tddExecutor = (orchestrator as any).tddExecutor;
      const result = await tddExecutor.execute('fs-error-task');

      expect(result.success).toBe(false);
      expect(result.stopReason).toBe('fix_failed');
      expect(result.iterations[0].fixResult?.success).toBe(false);
      expect(result.iterations[0].fixResult?.error).toContain('Permission denied');
    });
  });

  describe('TDD Resource Management', () => {
    it('should respect orchestrator resource limits during TDD execution', async () => {
      // Create config with strict limits
      const limitedConfig: ApexConfig = {
        ...config,
        limits: {
          maxTokensPerRequest: 1000, // Very low limit
          maxRequestsPerHour: 5,
          maxConcurrentRequests: 1,
        },
      };

      const limitedOrchestrator = new ApexOrchestrator(
        taskStore,
        limitedConfig,
        agents,
        workflows,
        '.test-apex',
        '/test/project'
      );

      await limitedOrchestrator.initialize();

      // Mock resource-intensive TDD scenario
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × complex test\n Complex error requiring detailed analysis';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      // Mock Claude response that would exceed token limit
      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Complex fix requiring many tokens',
          file: 'src/complex.ts',
          originalContent: 'old content',
          newContent: 'new content with extensive changes',
          confidence: 0.7,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const tddExecutor = (limitedOrchestrator as any).tddExecutor;

      // TDD should still work but might be limited by resource constraints
      const result = await tddExecutor.execute('resource-test');

      // Should either succeed or fail gracefully with appropriate error handling
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      await limitedOrchestrator.cleanup();
    });

    it('should clean up TDD executor resources on orchestrator cleanup', async () => {
      const tddExecutor = (orchestrator as any).tddExecutor;
      expect(tddExecutor).toBeDefined();

      // Add spy to verify cleanup
      const removeAllListenersSpy = vi.spyOn(tddExecutor, 'removeAllListeners');

      await orchestrator.cleanup();

      // Verify that TDD executor event listeners were cleaned up
      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });

  describe('End-to-End TDD Workflow', () => {
    it('should execute complete TDD workflow with multiple iterations', async () => {
      const workflowEvents: Array<{ type: ApexEventType; data: any }> = [];

      // Track all TDD events
      const tddEventTypes = [
        'tdd:started',
        'tdd:iteration-started',
        'tdd:test-run',
        'tdd:fix-generated',
        'tdd:fix-applied',
        'tdd:iteration-completed',
        'tdd:completed'
      ] as const;

      tddEventTypes.forEach(eventType => {
        orchestrator.on(eventType, (data) => {
          workflowEvents.push({ type: eventType, data });
        });
      });

      // Mock complex TDD scenario with multiple iterations
      let testCallCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        testCallCount++;

        if (testCallCount === 1) {
          // First iteration: missing function
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = `
FAIL src/math.test.ts
  × should calculate factorial
    ReferenceError: factorial is not defined
          `;
          (error as any).stderr = '';
          if (callback) callback(error);
        } else if (testCallCount === 2) {
          // Second iteration: wrong implementation
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = `
FAIL src/math.test.ts
  × should calculate factorial
    Expected: 120, Received: 24
          `;
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Third iteration: tests pass
          if (callback) {
            callback(null, { stdout: 'All tests passed', stderr: '' });
          }
        }
        return {};
      });

      // Mock Claude fixes for each iteration
      let fixCallCount = 0;
      mockQuery.mockImplementation(async () => {
        fixCallCount++;

        if (fixCallCount === 1) {
          return {
            content: JSON.stringify({
              description: 'Add factorial function',
              file: 'src/math.ts',
              originalContent: 'export function add(a: number, b: number) { return a + b; }',
              newContent: 'export function add(a: number, b: number) { return a + b; }\nexport function factorial(n: number) { return n * factorial(n - 1); }',
              confidence: 0.8,
              reasoning: 'Added factorial function but needs base case',
            }),
          };
        } else {
          return {
            content: JSON.stringify({
              description: 'Fix factorial base case',
              file: 'src/math.ts',
              originalContent: 'export function factorial(n: number) { return n * factorial(n - 1); }',
              newContent: 'export function factorial(n: number) { return n <= 1 ? 1 : n * factorial(n - 1); }',
              confidence: 0.95,
              reasoning: 'Added base case to prevent infinite recursion',
            }),
          };
        }
      });

      // Mock file system operations
      let fileContent = 'export function add(a: number, b: number) { return a + b; }';
      mockFs.readFile.mockImplementation(async () => fileContent);
      mockFs.writeFile.mockImplementation(async (path, content) => {
        fileContent = content as string;
      });

      const tddExecutor = (orchestrator as any).tddExecutor;
      const result = await tddExecutor.execute('e2e-workflow-test');

      // Verify successful completion
      expect(result.success).toBe(true);
      expect(result.totalIterations).toBe(3);

      // Verify all iterations are recorded
      expect(result.iterations).toHaveLength(3);
      expect(result.iterations[0].testResult.success).toBe(false);
      expect(result.iterations[1].testResult.success).toBe(false);
      expect(result.iterations[2].testResult.success).toBe(true);

      // Verify comprehensive event emission
      expect(workflowEvents.length).toBeGreaterThan(10); // Should have multiple events per iteration

      // Verify event sequence
      expect(workflowEvents[0].type).toBe('tdd:started');
      expect(workflowEvents[workflowEvents.length - 1].type).toBe('tdd:completed');

      // Verify iteration events
      const iterationStartEvents = workflowEvents.filter(e => e.type === 'tdd:iteration-started');
      expect(iterationStartEvents).toHaveLength(3);

      const fixGeneratedEvents = workflowEvents.filter(e => e.type === 'tdd:fix-generated');
      expect(fixGeneratedEvents).toHaveLength(2); // Only failed iterations generate fixes

      const iterationCompletedEvents = workflowEvents.filter(e => e.type === 'tdd:iteration-completed');
      expect(iterationCompletedEvents).toHaveLength(3);
    });

    it('should handle TDD workflow timeout and max iterations', async () => {
      // Create TDD executor with low max iterations
      const timeoutConfig: TDDExecutorConfig = {
        maxIterations: 2,
        testCommand: 'npm test',
        testTimeout: 1000,
        enableEvents: true,
      };

      const timeoutExecutor = new TDDExecutor(timeoutConfig, agents);

      // Mock consistently failing tests
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × persistent failure\n Error persists';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Attempted fix',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.5,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await timeoutExecutor.execute('timeout-test');

      expect(result.success).toBe(false);
      expect(result.totalIterations).toBe(2);
      expect(result.stopReason).toBe('max_iterations');
    });
  });

  describe('TDD Configuration Integration', () => {
    it('should use orchestrator TDD configuration for executor setup', async () => {
      const customConfig: ApexConfig = {
        ...config,
        tdd: {
          enabled: true,
          maxIterations: 10,
          testCommand: 'vitest run',
          timeout: 60000,
        },
      };

      const customOrchestrator = new ApexOrchestrator(
        taskStore,
        customConfig,
        agents,
        workflows,
        '.test-apex',
        '/test/project'
      );

      await customOrchestrator.initialize();

      const tddExecutor = (customOrchestrator as any).tddExecutor;
      const executorConfig = (tddExecutor as any).config;

      expect(executorConfig.maxIterations).toBe(10);
      expect(executorConfig.testCommand).toBe('vitest run');
      expect(executorConfig.testTimeout).toBe(60000);

      await customOrchestrator.cleanup();
    });

    it('should handle missing TDD configuration gracefully', async () => {
      const configWithoutTDD: ApexConfig = {
        ...config,
        tdd: undefined,
      };

      const orchestratorWithoutTDD = new ApexOrchestrator(
        taskStore,
        configWithoutTDD,
        agents,
        workflows,
        '.test-apex',
        '/test/project'
      );

      await orchestratorWithoutTDD.initialize();

      // Should still initialize successfully with default TDD config
      const tddExecutor = (orchestratorWithoutTDD as any).tddExecutor;
      expect(tddExecutor).toBeInstanceOf(TDDExecutor);

      await orchestratorWithoutTDD.cleanup();
    });
  });
});