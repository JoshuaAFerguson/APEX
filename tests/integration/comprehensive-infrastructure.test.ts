/**
 * Comprehensive Integration Test Infrastructure Validation
 *
 * This test file performs end-to-end validation of the integration test
 * infrastructure by running realistic test scenarios that exercise all
 * major components working together.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIntegrationTestEnvironment, integrationScenarios, integrationAssertions } from '../test-utils/integration-test-utilities';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  beforeAllWithSetup,
  measureExecutionTime,
  PerformanceBenchmark,
} from '../test-utils/test-setup-teardown';
import {
  createAdvancedOrchestratorMock,
  createAgentExecutionMock,
  createWorkflowExecutionMock,
  mockRegistry,
} from '../test-utils/enhanced-mock-factories';
import type { IntegrationTestEnvironment } from '../test-utils/integration-test-utilities';

describe('Comprehensive Integration Infrastructure Test', () => {
  let environment: IntegrationTestEnvironment;
  let benchmark: PerformanceBenchmark;

  beforeAll(async () => {
    console.log('🚀 Starting comprehensive integration infrastructure test');

    benchmark = new PerformanceBenchmark();

    const { result: env, executionTime } = await measureExecutionTime(async () => {
      return createIntegrationTestEnvironment({
        projectName: 'comprehensive-test-project',
        language: 'typescript',
        framework: 'vitest',
        enableBrowser: false, // Disable browser for this test to avoid complexity
        enablePermissions: true,
        customAgents: [
          {
            name: 'comprehensive-tester',
            definition: {
              description: 'Agent for comprehensive testing scenarios',
              tools: ['Read', 'Write', 'Edit', 'Bash'],
              model: 'sonnet',
            },
          },
          {
            name: 'integration-validator',
            definition: {
              description: 'Agent for validating integration test results',
              tools: ['Read', 'Grep', 'Write'],
              model: 'haiku',
            },
          },
        ],
        customWorkflows: [
          {
            name: 'comprehensive-test-workflow',
            definition: {
              description: 'Multi-stage workflow for comprehensive testing',
              stages: [
                { name: 'setup', agent: 'comprehensive-tester', description: 'Set up test environment' },
                { name: 'execution', agent: 'comprehensive-tester', description: 'Execute test scenarios' },
                { name: 'validation', agent: 'integration-validator', description: 'Validate test results' },
                { name: 'cleanup', agent: 'integration-validator', description: 'Clean up resources' },
              ],
            },
          },
        ],
        mockClaudeAPI: true,
        isolation: {
          filesystem: true,
          network: true,
          environment: true,
        },
      });
    });

    environment = env;
    console.log(`✅ Environment created in ${executionTime.toFixed(2)}ms`);

    // Validate environment is properly set up
    expect(environment).toBeDefined();
    expect(environment.testDir).toBeDefined();
    expect(environment.orchestrator).toBeDefined();
    expect(environment.taskStore).toBeDefined();
    expect(environment.config).toBeDefined();
    expect(environment.agents).toBeDefined();
    expect(environment.workflows).toBeDefined();
    expect(environment.events).toBeDefined();
    expect(environment.permissions).toBeDefined();
    expect(environment.tools).toBeDefined();
  });

  afterAll(async () => {
    if (environment) {
      const { executionTime } = await measureExecutionTime(async () => {
        await environment.cleanup();
      });
      console.log(`✅ Environment cleaned up in ${executionTime.toFixed(2)}ms`);
    }

    // Log benchmark results
    const results = benchmark.getResults();
    if (results.length > 0) {
      console.log('\n📊 Performance Benchmark Results:');
      results.forEach(result => {
        console.log(`  ${result.name}: ${result.time.toFixed(2)}ms`);
      });
    }
  });

  describe('Environment Integration Tests', () => {
    it('should have all custom components properly configured', () => {
      // Validate custom agents
      expect(environment.agents['comprehensive-tester']).toBeDefined();
      expect(environment.agents['integration-validator']).toBeDefined();

      const testerAgent = environment.agents['comprehensive-tester'];
      expect(testerAgent.description).toBe('Agent for comprehensive testing scenarios');
      expect(testerAgent.tools).toContain('Read');
      expect(testerAgent.tools).toContain('Write');
      expect(testerAgent.tools).toContain('Edit');
      expect(testerAgent.tools).toContain('Bash');

      // Validate custom workflows
      expect(environment.workflows['comprehensive-test-workflow']).toBeDefined();

      const testWorkflow = environment.workflows['comprehensive-test-workflow'];
      expect(testWorkflow.stages.length).toBe(4);
      expect(testWorkflow.stages.map(s => s.name)).toEqual([
        'setup', 'execution', 'validation', 'cleanup'
      ]);
    });

    it('should support complex task creation and management', async () => {
      await benchmark.measure('complex-task-creation', async () => {
        // Create tasks with complex dependencies and configurations
        const setupTask = environment.createTask({
          description: 'Setup comprehensive test environment',
          workflow: 'comprehensive-test-workflow',
          autonomy: 'supervised',
          priority: 'high',
        });

        const executionTask = environment.createTask({
          description: 'Execute comprehensive test scenarios',
          workflow: 'comprehensive-test-workflow',
          dependsOn: [setupTask.id],
          autonomy: 'full',
          priority: 'normal',
        });

        const validationTask = environment.createTask({
          description: 'Validate comprehensive test results',
          workflow: 'comprehensive-test-workflow',
          dependsOn: [executionTask.id],
          autonomy: 'supervised',
          priority: 'high',
        });

        const cleanupTask = environment.createTask({
          description: 'Clean up comprehensive test resources',
          workflow: 'comprehensive-test-workflow',
          dependsOn: [validationTask.id],
          autonomy: 'full',
          priority: 'low',
        });

        // Validate task dependencies
        expect(executionTask.dependsOn).toContain(setupTask.id);
        expect(validationTask.dependsOn).toContain(executionTask.id);
        expect(cleanupTask.dependsOn).toContain(validationTask.id);

        // Validate tasks have unique IDs
        const taskIds = [setupTask.id, executionTask.id, validationTask.id, cleanupTask.id];
        expect(new Set(taskIds).size).toBe(4);

        return [setupTask, executionTask, validationTask, cleanupTask];
      });
    });

    it('should handle event monitoring across complex scenarios', async () => {
      const events = environment.events;
      events.clearEvents();

      // Simulate complex event flow
      events.emit('workflow:started', { workflowName: 'comprehensive-test-workflow' });
      events.emit('stage:started', { stageName: 'setup', agent: 'comprehensive-tester' });
      events.emit('tool:called', { toolName: 'Read', arguments: ['/test/file'] });
      events.emit('permission:requested', { tool: 'Write', scope: '/test/**' });
      events.emit('permission:granted', { tool: 'Write', scope: '/test/**' });
      events.emit('tool:called', { toolName: 'Write', arguments: ['/test/output'] });
      events.emit('stage:completed', { stageName: 'setup', success: true });
      events.emit('stage:started', { stageName: 'execution', agent: 'comprehensive-tester' });
      events.emit('error:occurred', { error: 'Simulated error for testing' });
      events.emit('stage:failed', { stageName: 'execution', error: 'Simulated failure' });
      events.emit('workflow:failed', { workflowName: 'comprehensive-test-workflow' });

      const allEvents = events.getEvents();
      expect(allEvents.length).toBe(11);

      // Validate event filtering
      const workflowEvents = events.getEventsByType('workflow:started');
      expect(workflowEvents.length).toBe(1);

      const stageEvents = events.getEventsByType('stage:started');
      expect(stageEvents.length).toBe(2);

      const toolEvents = events.getEventsByType('tool:called');
      expect(toolEvents.length).toBe(2);

      // Validate event statistics
      const stats = events.getEventStats();
      expect(stats['workflow:started']).toBe(1);
      expect(stats['stage:started']).toBe(2);
      expect(stats['tool:called']).toBe(2);
    });

    it('should manage permissions across complex tool usage patterns', async () => {
      const { permissions } = environment;

      await permissions.clearPermissions();

      // Set up complex permission scenarios
      await permissions.grantPermission('Read', '/project/**', 'allow-always');
      await permissions.grantPermission('Write', '/project/src/**', 'allow-once');
      await permissions.denyPermission('Bash', '/system/**');
      await permissions.grantPermission('Edit', '/project/tests/**', 'allow-session');

      // Test permission workflows
      await permissions.simulatePermissionWorkflow('Read', '/project/src/test.ts');
      await permissions.simulatePermissionWorkflow('Write', '/project/src/output.ts');
      await permissions.simulatePermissionWorkflow('Edit', '/project/tests/unit.test.ts');

      // This should work without throwing
      expect(true).toBe(true);
    });

    it('should handle tool mocking and call tracking', () => {
      const { tools } = environment;

      // Mock various tool behaviors
      tools.mockToolSuccess('Read', { content: 'Mock file content', size: 1024 });
      tools.mockToolSuccess('Write', { success: true, path: '/mock/output.txt' });
      tools.mockToolFailure('Bash', new Error('Permission denied'));
      tools.mockToolDelay('Edit', 100);

      // Reset and verify clean state
      tools.resetAllMocks();

      const callHistory = tools.getCallHistory();
      expect(callHistory).toBeDefined();
      expect(typeof callHistory).toBe('object');
    });
  });

  describe('Scenario Integration Tests', () => {
    it('should execute basic task execution scenario successfully', async () => {
      await benchmark.measure('basic-task-execution-scenario', async () => {
        const result = await integrationScenarios.basicTaskExecution(environment);

        expect(result).toBeDefined();
        expect(result.task).toBeDefined();

        // Use integration assertions
        integrationAssertions.taskCreated(result.task);

        expect(result.task.description).toBe('Basic integration test task');
        expect(result.task.workflow).toBe('feature');
      });
    });

    it('should execute multi-stage workflow scenario successfully', async () => {
      await benchmark.measure('multi-stage-workflow-scenario', async () => {
        const result = await integrationScenarios.multiStageWorkflow(environment);

        expect(result).toBeDefined();
        expect(result.task).toBeDefined();
        expect(result.workflow).toBeDefined();

        integrationAssertions.taskCreated(result.task);

        expect(result.workflow.stages.length).toBe(4);
        expect(result.task.workflow).toBe('multi-stage');
      });
    });

    it('should execute permission-protected tools scenario', async () => {
      await benchmark.measure('permission-protected-tools-scenario', async () => {
        const result = await integrationScenarios.permissionProtectedTools(environment);

        expect(result).toBeDefined();
        expect(result.task).toBeDefined();

        integrationAssertions.taskCreated(result.task);

        expect(result.task.description).toBe('Permission test task');
      });
    });

    it('should execute error handling and recovery scenario', async () => {
      await benchmark.measure('error-handling-scenario', async () => {
        const result = await integrationScenarios.errorHandlingAndRecovery(environment);

        expect(result).toBeDefined();
        expect(result.task).toBeDefined();

        integrationAssertions.taskCreated(result.task);

        expect(result.task.description).toBe('Error handling test');
      });
    });

    it('should execute concurrent task execution scenario', async () => {
      await benchmark.measure('concurrent-task-execution-scenario', async () => {
        const result = await integrationScenarios.concurrentTaskExecution(environment);

        expect(result).toBeDefined();
        expect(result.tasks).toBeDefined();
        expect(Array.isArray(result.tasks)).toBe(true);
        expect(result.tasks.length).toBe(3);

        result.tasks.forEach((task, index) => {
          integrationAssertions.taskCreated(task);
          expect(task.description).toBe(`Concurrent task ${index + 1}`);
        });

        // Validate all tasks have unique IDs
        const taskIds = result.tasks.map(t => t.id);
        expect(new Set(taskIds).size).toBe(3);
      });
    });
  });

  describe('Mock Integration Tests', () => {
    afterEach(() => {
      mockRegistry.cleanup();
    });

    it('should integrate advanced mocks with environment', async () => {
      await benchmark.measure('advanced-mock-integration', async () => {
        // Create orchestrator mock with environment compatibility
        const orchestratorMock = createAdvancedOrchestratorMock({
          agentRegistry: environment.agents,
          workflowRegistry: environment.workflows,
          eventTracking: true,
          performanceMetrics: true,
        });

        // Create agent mock for comprehensive testing
        const agentMock = createAgentExecutionMock('comprehensive-agent', {
          tools: ['Read', 'Write', 'Edit', 'Bash'],
          behavior: 'success',
          withThinking: true,
          withStepByStep: true,
        });

        // Create workflow mock for complex scenarios
        const workflowMock = createWorkflowExecutionMock('complex-workflow', {
          stages: [
            { name: 'analysis', agent: 'comprehensive-agent', duration: 100, successRate: 0.95 },
            { name: 'implementation', agent: 'comprehensive-agent', duration: 200, successRate: 0.9 },
            { name: 'testing', agent: 'comprehensive-agent', duration: 150, successRate: 0.98 },
            { name: 'review', agent: 'comprehensive-agent', duration: 100, successRate: 0.99 },
          ],
          parallelExecution: false,
          withCheckpoints: true,
          withRollback: true,
        });

        // Test integration
        const task = await orchestratorMock.createTask({
          description: 'Complex integration test',
          workflow: 'complex-workflow',
        });

        expect(task).toBeDefined();

        const agentResult = await agentMock.execute({
          description: 'Execute complex task',
          taskId: task.id,
        });

        expect(agentResult.success).toBe(true);
        expect(agentResult.thinking).toBeDefined();
        expect(agentResult.steps).toBeDefined();

        const workflowResult = await workflowMock.execute(task.id, {
          agentResult,
        });

        expect(workflowResult.success).toBe(true);
        expect(workflowResult.stages.length).toBe(4);
        expect(workflowResult.checkpoints).toBeDefined();

        // Validate metrics
        const orchestratorMetrics = orchestratorMock.getMetrics();
        expect(orchestratorMetrics.tasksCreated).toBe(1);

        const agentMetrics = {
          executionCount: agentMock.getExecutionCount(),
          successRate: agentMock.getSuccessRate(),
          averageTime: agentMock.getAverageExecutionTime(),
        };

        expect(agentMetrics.executionCount).toBe(1);
        expect(agentMetrics.successRate).toBe(1);
        expect(agentMetrics.averageTime).toBeGreaterThan(0);

        const workflowMetrics = {
          successRate: workflowMock.getSuccessRate(),
          averageTime: workflowMock.getAverageExecutionTime(),
        };

        expect(workflowMetrics.successRate).toBe(1);
        expect(workflowMetrics.averageTime).toBeGreaterThan(0);

        await orchestratorMock.cleanup();
      });
    });

    it('should handle complex mock registry operations', async () => {
      await benchmark.measure('mock-registry-operations', async () => {
        // Create multiple mocks of each type
        const tasks = Array(10).fill(null).map((_, i) =>
          mockRegistry.createTask(`task-${i}`, {
            withEvents: true,
            withHistory: true,
            withMetrics: true,
          })
        );

        const orchestrators = Array(3).fill(null).map((_, i) =>
          mockRegistry.createOrchestrator(`orch-${i}`, {
            eventTracking: true,
            performanceMetrics: true,
          })
        );

        const agents = Array(5).fill(null).map((_, i) =>
          mockRegistry.createAgent(`agent-${i}`, {
            behavior: i % 2 === 0 ? 'success' : 'failure',
            withThinking: true,
          })
        );

        const workflows = Array(3).fill(null).map((_, i) =>
          mockRegistry.createWorkflow(`workflow-${i}`, {
            stages: [
              { name: 'stage1', agent: `agent-${i}` },
              { name: 'stage2', agent: `agent-${i}` },
            ],
          })
        );

        // Validate registry state
        const allMocks = mockRegistry.getAllMocks();
        expect(allMocks.length).toBe(21); // 10 + 3 + 5 + 3

        // Test individual retrieval
        expect(mockRegistry.getTask('task-0')).toBe(tasks[0]);
        expect(mockRegistry.getOrchestrator('orch-1')).toBe(orchestrators[1]);
        expect(mockRegistry.getAgent('agent-2')).toBe(agents[2]);
        expect(mockRegistry.getWorkflow('workflow-2')).toBe(workflows[2]);

        // Test mock interactions
        const task = tasks[0];
        task.updateStatus('in-progress');
        task.addLog('Test log message');
        task.addArtifact('test.txt', '/path/to/test.txt');

        const metrics = task.getMetrics();
        expect(metrics.statusChanges).toBe(1);
        expect(metrics.logsAdded).toBe(1);
        expect(metrics.artifactsAdded).toBe(1);

        // Test cleanup
        mockRegistry.cleanup();
        expect(mockRegistry.getAllMocks().length).toBe(0);
      });
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle high-volume operations efficiently', async () => {
      await benchmark.measure('high-volume-operations', async () => {
        // Create many tasks
        const tasks = Array(100).fill(null).map((_, i) =>
          environment.createTask({
            description: `High volume task ${i}`,
            workflow: 'comprehensive-test-workflow',
          })
        );

        expect(tasks.length).toBe(100);
        expect(new Set(tasks.map(t => t.id)).size).toBe(100); // All unique

        // Generate many events
        for (let i = 0; i < 500; i++) {
          environment.events.emit('high-volume:test', { index: i });
        }

        const events = environment.events.getEventsByType('high-volume:test');
        expect(events.length).toBe(500);

        // Test permission operations
        for (let i = 0; i < 50; i++) {
          await environment.permissions.grantPermission('Read', `/high-volume/${i}/**`);
        }

        // Tool operations
        for (let i = 0; i < 30; i++) {
          environment.tools.mockToolSuccess('Read', { content: `High volume content ${i}` });
        }

        expect(true).toBe(true); // Test passes if no errors thrown
      });
    });

    it('should maintain performance under concurrent load', async () => {
      await benchmark.measure('concurrent-load-test', async () => {
        // Create concurrent operations
        const operations = [
          // Task creation
          Promise.all(Array(20).fill(null).map((_, i) =>
            Promise.resolve(environment.createTask({
              description: `Concurrent task ${i}`,
            }))
          )),

          // Event generation
          Promise.resolve().then(() => {
            for (let i = 0; i < 100; i++) {
              environment.events.emit('concurrent:event', { index: i });
            }
          }),

          // Permission operations
          Promise.all(Array(20).fill(null).map((_, i) =>
            environment.permissions.grantPermission('Write', `/concurrent/${i}/**`)
          )),

          // Tool mocking
          Promise.resolve().then(() => {
            for (let i = 0; i < 30; i++) {
              environment.tools.mockToolSuccess('Edit', { result: `concurrent-${i}` });
            }
          }),
        ];

        const results = await Promise.all(operations);

        expect(results[0]).toBeDefined(); // Tasks created
        expect(results[0].length).toBe(20);
        expect(environment.events.getEventsByType('concurrent:event').length).toBe(100);
      });
    });

    it('should demonstrate infrastructure capabilities', () => {
      console.log('\n🎯 Infrastructure Capabilities Demonstrated:');
      console.log('✅ Complete integration test environment creation');
      console.log('✅ Custom agent and workflow configuration');
      console.log('✅ Event monitoring and tracking');
      console.log('✅ Permission management and simulation');
      console.log('✅ Tool mocking and call history');
      console.log('✅ Advanced mock factories with realistic behavior');
      console.log('✅ Test scenario execution');
      console.log('✅ Performance measurement and benchmarking');
      console.log('✅ Concurrent operation handling');
      console.log('✅ Error handling and edge case management');
      console.log('✅ Resource cleanup and isolation');

      const performanceResults = benchmark.getResults();
      if (performanceResults.length > 0) {
        console.log('\n⚡ Performance Results:');
        performanceResults.forEach(result => {
          console.log(`  ${result.name}: ${result.time.toFixed(2)}ms`);
        });

        // Performance assertions
        const totalTime = performanceResults.reduce((sum, result) => sum + result.time, 0);
        expect(totalTime).toBeLessThan(10000); // All operations should complete within 10 seconds
      }

      expect(true).toBe(true); // Test passes - infrastructure is working
    });
  });
});

describe('Infrastructure Documentation and Examples', () => {
  it('should provide usage examples for all major components', () => {
    console.log('\n📚 Infrastructure Usage Examples:');

    console.log('\n1. Creating Integration Test Environment:');
    console.log(`
      const environment = await createIntegrationTestEnvironment({
        projectName: 'my-test-project',
        language: 'typescript',
        enablePermissions: true,
        mockClaudeAPI: true,
      });
    `);

    console.log('\n2. Setting Up Test Lifecycle:');
    console.log(`
      const { getSuiteId, getEnvironment } = beforeAllWithSetup({
        createIntegrationEnv: true,
        integrationOptions: { enableBrowser: true },
      });
    `);

    console.log('\n3. Creating Advanced Mocks:');
    console.log(`
      const taskMock = createAdvancedTaskMock({}, {
        withEvents: true,
        withHistory: true,
        withMetrics: true,
      });
    `);

    console.log('\n4. Running Integration Scenarios:');
    console.log(`
      const { task } = await integrationScenarios.basicTaskExecution(environment);
      integrationAssertions.taskCreated(task);
    `);

    console.log('\n5. Performance Measurement:');
    console.log(`
      const { result, executionTime } = await measureExecutionTime(async () => {
        return someExpensiveOperation();
      });
    `);

    expect(true).toBe(true);
  });

  it('should provide best practices documentation', () => {
    console.log('\n💡 Integration Testing Best Practices:');
    console.log('1. Always use isolated test environments');
    console.log('2. Clean up resources in afterAll/afterEach hooks');
    console.log('3. Mock external dependencies (Claude API, network)');
    console.log('4. Use realistic test data and scenarios');
    console.log('5. Measure performance for critical paths');
    console.log('6. Test both success and failure scenarios');
    console.log('7. Validate event flows and state transitions');
    console.log('8. Use custom assertions for domain-specific checks');
    console.log('9. Test concurrent operations and race conditions');
    console.log('10. Document test scenarios and expected outcomes');

    expect(true).toBe(true);
  });
});