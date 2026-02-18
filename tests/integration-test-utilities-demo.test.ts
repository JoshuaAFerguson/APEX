/**
 * Integration Test Utilities Demo
 *
 * This test demonstrates the usage of the new comprehensive integration test
 * utilities and serves as both documentation and validation of the implementation.
 */

import { describe, it, expect } from 'vitest';
import {
  createIntegrationTestEnvironment,
  integrationScenarios,
  integrationAssertions,
  beforeAllWithSetup,
  createAdvancedTaskMock,
  createAdvancedOrchestratorMock,
  createAgentExecutionMock,
  createWorkflowExecutionMock,
  mockRegistry,
} from '@apex/test-utils';

describe('Integration Test Utilities Demo', () => {
  describe('Basic Environment Setup', () => {
    it('should create a complete integration test environment', async () => {
      const env = await createIntegrationTestEnvironment({
        projectName: 'test-demo',
        language: 'typescript',
        enableBrowser: false,
        enablePermissions: true,
        mockClaudeAPI: true,
      });

      expect(env.testDir).toBeDefined();
      expect(env.orchestrator).toBeDefined();
      expect(env.taskStore).toBeDefined();
      expect(env.config).toBeDefined();
      expect(env.agents).toBeDefined();
      expect(env.workflows).toBeDefined();
      expect(env.tools).toBeDefined();
      expect(env.permissions).toBeDefined();
      expect(env.events).toBeDefined();

      // Test environment should have basic utilities
      const testTask = env.createTask({ description: 'Demo task' });
      expect(testTask.id).toBeDefined();
      expect(testTask.description).toBe('Demo task');

      // Cleanup
      await env.cleanup();
    }, 10000);

    it('should provide working event monitoring', async () => {
      const env = await createIntegrationTestEnvironment({
        projectName: 'event-demo',
      });

      // Create a task to generate events
      const task = await env.orchestrator.createTask({
        description: 'Event test task',
        workflow: 'feature',
      });

      // Wait for task creation event
      const eventData = await env.events.waitForEvent('task:created', 2000);
      expect(eventData.id).toBe(task.id);

      // Check event history
      const events = env.events.getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('task:created');

      await env.cleanup();
    }, 10000);
  });

  describe('Advanced Mock Factories', () => {
    it('should create advanced task mocks with enhanced features', () => {
      const taskMock = createAdvancedTaskMock(
        { description: 'Advanced mock task' },
        {
          withEvents: true,
          withHistory: true,
          withValidation: true,
          withMetrics: true,
        }
      );

      expect(taskMock.description).toBe('Advanced mock task');
      expect(typeof taskMock.updateStatus).toBe('function');
      expect(typeof taskMock.addLog).toBe('function');
      expect(typeof taskMock.simulateProgress).toBe('function');
      expect(typeof taskMock.getStatusHistory).toBe('function');
      expect(typeof taskMock.validate).toBe('function');

      // Test status updates
      taskMock.updateStatus('in-progress');
      expect(taskMock.status).toBe('in-progress');

      const history = taskMock.getStatusHistory!();
      expect(history.length).toBe(2); // initial + update

      // Test validation
      const validation = taskMock.validate!();
      expect(validation.valid).toBe(true);
    });

    it('should create orchestrator mocks with realistic behavior', async () => {
      const orchestratorMock = createAdvancedOrchestratorMock({
        eventTracking: true,
        performanceMetrics: true,
      });

      const task = await orchestratorMock.createTask({
        description: 'Mock orchestrator test',
      });

      expect(task.id).toBeDefined();
      expect(orchestratorMock.createTask).toHaveBeenCalledWith({
        description: 'Mock orchestrator test',
      });

      // Test task retrieval
      const retrieved = await orchestratorMock.getTask(task.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(task.id);

      // Test metrics
      const metrics = orchestratorMock.getMetrics();
      expect(metrics.tasksCreated).toBe(1);
    });

    it('should create agent execution mocks with custom behavior', async () => {
      const agentMock = createAgentExecutionMock('test-agent', {
        behavior: 'success',
        executionTime: 100,
        withThinking: true,
        withStepByStep: true,
      });

      const result = await agentMock.execute({
        description: 'Test agent execution',
      });

      expect(result.success).toBe(true);
      expect(result.thinking).toBeDefined();
      expect(result.steps).toBeDefined();
      expect(Array.isArray(result.steps)).toBe(true);

      // Check execution history
      const history = agentMock.getExecutionHistory();
      expect(history.length).toBe(1);
      expect(history[0].success).toBe(true);
    });

    it('should create workflow execution mocks', async () => {
      const workflowMock = createWorkflowExecutionMock('test-workflow', {
        stages: [
          { name: 'planning', agent: 'planner', duration: 50 },
          { name: 'implementation', agent: 'developer', duration: 100 },
          { name: 'testing', agent: 'tester', duration: 75 },
        ],
        withCheckpoints: true,
      });

      const result = await workflowMock.execute('test-task', {});

      expect(result.success).toBe(true);
      expect(result.stages.length).toBe(3);
      expect(result.checkpoints).toBeDefined();
      expect(result.checkpoints.length).toBe(3);

      // Check execution metrics
      const successRate = workflowMock.getSuccessRate();
      expect(successRate).toBe(1.0);
    });
  });

  describe('Mock Registry System', () => {
    it('should manage multiple mock types in a registry', () => {
      // Create various mocks
      const task = mockRegistry.createTask('test-task-1');
      const orchestrator = mockRegistry.createOrchestrator('test-orch-1');
      const agent = mockRegistry.createAgent('test-agent-1');
      const workflow = mockRegistry.createWorkflow('test-workflow-1', {
        stages: [
          { name: 'test-stage', agent: 'test-agent' },
        ],
      });

      // Verify retrieval
      expect(mockRegistry.getTask('test-task-1')).toBe(task);
      expect(mockRegistry.getOrchestrator('test-orch-1')).toBe(orchestrator);
      expect(mockRegistry.getAgent('test-agent-1')).toBe(agent);
      expect(mockRegistry.getWorkflow('test-workflow-1')).toBe(workflow);

      // Test cleanup
      mockRegistry.cleanup();
      expect(mockRegistry.getTask('test-task-1')).toBeUndefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should execute basic task creation scenario', async () => {
      const env = await createIntegrationTestEnvironment({
        projectName: 'scenario-test',
      });

      const result = await integrationScenarios.basicTaskExecution(env);

      expect(result.task).toBeDefined();
      expect(result.task.status).toBe('pending');

      // Use assertions
      integrationAssertions.taskCreated(result.task);

      await env.cleanup();
    });
  });

  describe('Setup/Teardown Hooks', () => {
    // This demonstrates the hook-based approach
    const { getEnvironment } = beforeAllWithSetup({
      createIntegrationEnv: true,
      integrationOptions: {
        projectName: 'hooks-test',
        mockClaudeAPI: true,
      },
      timeout: 15000,
    });

    it('should have environment available from hooks', async () => {
      const env = getEnvironment();
      expect(env).toBeDefined();
      expect(env!.testDir).toBeDefined();

      // Test that we can create tasks
      const task = await env!.orchestrator.createTask({
        description: 'Hooks test task',
        workflow: 'feature',
      });

      expect(task.id).toBeDefined();
    });

    it('should maintain environment state between tests', async () => {
      const env = getEnvironment();
      expect(env).toBeDefined();

      // Environment should persist between tests within the same suite
      const tasks = await env!.orchestrator.listTasks();
      expect(tasks.length).toBe(1); // From previous test
    });
  });
});

describe('Integration Assertions', () => {
  it('should provide comprehensive assertion helpers', async () => {
    const env = await createIntegrationTestEnvironment();

    const task = await env.orchestrator.createTask({
      description: 'Assertions test',
      workflow: 'feature',
    });

    // Test task assertions
    integrationAssertions.taskCreated(task);

    // Simulate task progress
    await env.orchestrator.updateTaskStatus(task.id, 'in-progress');
    await env.orchestrator.updateTaskStatus(task.id, 'completed');

    // Test event sequence
    const events = env.events.getEvents();
    integrationAssertions.eventSequence(events, [
      'task:created',
      'task:status:changed',
      'task:status:changed',
    ]);

    await env.cleanup();
  });
});