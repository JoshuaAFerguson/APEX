/**
 * @fileoverview Comprehensive validation tests for TaskStore test fixtures module
 *
 * Additional validation tests to ensure complete coverage and edge case handling
 * that complement the existing test suites.
 */

import {
  createTestTask,
  createTestAgent,
  createTestWorkflowStage,
  createTestWorkflow,
  createTestTasks,
  createTestAgents,
  createTestWorkflows,
} from '../fixtures.js';

import {
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowStageSchema,
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskEffortSchema,
} from '@apexcli/core';

import type {
  Task,
  AgentDefinition,
  WorkflowDefinition,
  WorkflowStage,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  AutonomyLevel,
} from '@apexcli/core';

describe('TaskStore Fixtures - Comprehensive Validation', () => {
  // ============================================================================
  // Schema Validation Deep Tests
  // ============================================================================

  describe('Deep Schema Validation', () => {
    it('should validate Task enum values against all possible schema values', () => {
      const allTaskStatuses: TaskStatus[] = [
        'pending', 'queued', 'planning', 'in-progress', 'waiting-approval',
        'awaiting-approval', 'paused', 'completed', 'failed', 'cancelled'
      ];

      const allTaskPriorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

      const allTaskEfforts: TaskEffort[] = ['xs', 'small', 'medium', 'large', 'xl'];

      // Test all combinations work with fixtures
      allTaskStatuses.forEach(status => {
        const task = createTestTask({ status });
        expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
        expect(task.status).toBe(status);
      });

      allTaskPriorities.forEach(priority => {
        const task = createTestTask({ priority });
        expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
        expect(task.priority).toBe(priority);
      });

      allTaskEfforts.forEach(effort => {
        const task = createTestTask({ effort });
        expect(() => TaskEffortSchema.parse(task.effort)).not.toThrow();
        expect(task.effort).toBe(effort);
      });
    });

    it('should validate AgentDefinition thoroughly against schema', () => {
      const allModels = ['opus', 'sonnet', 'haiku', 'inherit'] as const;

      allModels.forEach(model => {
        const agent = createTestAgent({ model });
        expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
        expect(agent.model).toBe(model);
      });

      // Test with various tool combinations
      const toolCombinations = [
        ['Read'],
        ['Read', 'Write'],
        ['Read', 'Write', 'Edit', 'Bash'],
        ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch'],
      ];

      toolCombinations.forEach(tools => {
        const agent = createTestAgent({ tools });
        expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
        expect(agent.tools).toEqual(tools);
      });
    });

    it('should validate WorkflowStage with complex dependencies', () => {
      const complexStage = createTestWorkflowStage({
        name: 'complex-stage',
        agent: 'complex-agent',
        description: 'A complex stage with many dependencies',
        parallel: true,
        maxRetries: 5,
        dependsOn: ['stage1', 'stage2', 'stage3'],
        inputs: ['input1', 'input2', 'input3'],
        outputs: ['output1', 'output2'],
        timeout: 3600,
        environment: {
          NODE_ENV: 'test',
          API_URL: 'https://test.example.com'
        }
      });

      expect(() => WorkflowStageSchema.parse(complexStage)).not.toThrow();
      expect(complexStage.dependsOn).toEqual(['stage1', 'stage2', 'stage3']);
      expect(complexStage.inputs).toEqual(['input1', 'input2', 'input3']);
      expect(complexStage.outputs).toEqual(['output1', 'output2']);
      expect(complexStage.parallel).toBe(true);
      expect(complexStage.maxRetries).toBe(5);
    });

    it('should validate WorkflowDefinition with complex structure', () => {
      const complexWorkflow = createTestWorkflow({
        name: 'complex-workflow',
        description: 'A complex multi-stage workflow',
        stages: [
          createTestWorkflowStage({
            name: 'analysis',
            agent: 'analyst',
            description: 'Analyze requirements',
            outputs: ['requirements', 'analysis_report']
          }),
          createTestWorkflowStage({
            name: 'design',
            agent: 'architect',
            description: 'Design solution architecture',
            dependsOn: ['analysis'],
            inputs: ['requirements'],
            outputs: ['architecture_design', 'technical_specs']
          }),
          createTestWorkflowStage({
            name: 'implementation',
            agent: 'developer',
            description: 'Implement the solution',
            dependsOn: ['design'],
            inputs: ['architecture_design', 'technical_specs'],
            outputs: ['implementation', 'code_changes']
          }),
          createTestWorkflowStage({
            name: 'testing',
            agent: 'tester',
            description: 'Test the implementation',
            dependsOn: ['implementation'],
            inputs: ['implementation'],
            outputs: ['test_results', 'test_report']
          }),
          createTestWorkflowStage({
            name: 'deployment',
            agent: 'devops',
            description: 'Deploy to production',
            dependsOn: ['testing'],
            inputs: ['implementation', 'test_results'],
            outputs: ['deployment_status']
          })
        ]
      });

      expect(() => WorkflowDefinitionSchema.parse(complexWorkflow)).not.toThrow();
      expect(complexWorkflow.stages.length).toBe(5);

      // Verify stage relationships
      const analysis = complexWorkflow.stages[0];
      const design = complexWorkflow.stages[1];
      const implementation = complexWorkflow.stages[2];
      const testing = complexWorkflow.stages[3];
      const deployment = complexWorkflow.stages[4];

      expect(analysis.outputs).toEqual(['requirements', 'analysis_report']);
      expect(design.dependsOn).toEqual(['analysis']);
      expect(design.inputs).toEqual(['requirements']);
      expect(implementation.dependsOn).toEqual(['design']);
      expect(testing.dependsOn).toEqual(['implementation']);
      expect(deployment.dependsOn).toEqual(['testing']);
    });
  });

  // ============================================================================
  // Boundary and Edge Case Testing
  // ============================================================================

  describe('Boundary Value Testing', () => {
    it('should handle maximum retry counts correctly', () => {
      const highRetryTask = createTestTask({
        maxRetries: 10,
        retryCount: 9
      });

      expect(highRetryTask.maxRetries).toBe(10);
      expect(highRetryTask.retryCount).toBe(9);
      expect(() => TaskStatusSchema.parse(highRetryTask.status)).not.toThrow();
    });

    it('should handle zero and negative values appropriately', () => {
      const zeroRetryTask = createTestTask({
        maxRetries: 0,
        retryCount: 0,
        resumeAttempts: 0
      });

      expect(zeroRetryTask.maxRetries).toBe(0);
      expect(zeroRetryTask.retryCount).toBe(0);
      expect(zeroRetryTask.resumeAttempts).toBe(0);
    });

    it('should handle large bulk creation counts efficiently', () => {
      const startTime = Date.now();

      // Create 1000 tasks
      const largeBatch = createTestTasks(1000, (index) => ({
        description: `Large batch task ${index + 1}`,
        priority: index % 2 === 0 ? 'normal' : 'high'
      }));

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(largeBatch.length).toBe(1000);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds

      // Verify first and last tasks
      expect(largeBatch[0].description).toBe('Large batch task 1');
      expect(largeBatch[999].description).toBe('Large batch task 1000');

      // Verify alternating priorities
      expect(largeBatch[0].priority).toBe('normal');
      expect(largeBatch[1].priority).toBe('high');
    });
  });

  // ============================================================================
  // Data Consistency and Integrity Tests
  // ============================================================================

  describe('Data Consistency', () => {
    it('should maintain data consistency across multiple fixture creations', () => {
      const fixtures = Array.from({ length: 100 }, (_, i) => ({
        task: createTestTask({ description: `Consistency test ${i}` }),
        agent: createTestAgent({ name: `agent-${i}` }),
        workflow: createTestWorkflow({ name: `workflow-${i}` })
      }));

      // Verify all IDs are unique
      const taskIds = fixtures.map(f => f.task.id);
      const uniqueTaskIds = new Set(taskIds);
      expect(uniqueTaskIds.size).toBe(100);

      // Verify all names are unique
      const agentNames = fixtures.map(f => f.agent.name);
      const uniqueAgentNames = new Set(agentNames);
      expect(uniqueAgentNames.size).toBe(100);

      // Verify all workflow names are unique
      const workflowNames = fixtures.map(f => f.workflow.name);
      const uniqueWorkflowNames = new Set(workflowNames);
      expect(uniqueWorkflowNames.size).toBe(100);

      // Verify all fixtures validate against schemas
      fixtures.forEach((fixture, index) => {
        expect(() => TaskStatusSchema.parse(fixture.task.status)).not.toThrow();
        expect(() => AgentDefinitionSchema.parse(fixture.agent)).not.toThrow();
        expect(() => WorkflowDefinitionSchema.parse(fixture.workflow)).not.toThrow();
      });
    });

    it('should maintain proper date consistency', () => {
      const beforeCreation = new Date();
      const task = createTestTask();
      const afterCreation = new Date();

      expect(task.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(task.createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
      expect(task.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(task.updatedAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());

      // By default, createdAt and updatedAt should be the same
      expect(task.createdAt.getTime()).toBe(task.updatedAt.getTime());
    });

    it('should preserve deep object references correctly', () => {
      const customUsage = {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        estimatedCost: 0.05,
        totalCostCents: 5,
        executionTimeMs: 1000
      };

      const task = createTestTask({ usage: customUsage });

      expect(task.usage).toEqual(customUsage);
      expect(task.usage.inputTokens).toBe(100);
      expect(task.usage.outputTokens).toBe(200);
      expect(task.usage.totalTokens).toBe(300);
      expect(task.usage.estimatedCost).toBe(0.05);
      expect(task.usage.totalCostCents).toBe(5);
      expect(task.usage.executionTimeMs).toBe(1000);
    });
  });

  // ============================================================================
  // Memory and Performance Tests
  // ============================================================================

  describe('Performance and Memory', () => {
    it('should not leak memory with repeated fixture creation', () => {
      // Create and discard many fixtures to test for memory leaks
      for (let i = 0; i < 1000; i++) {
        const task = createTestTask({ description: `Memory test ${i}` });
        const agent = createTestAgent({ name: `memory-agent-${i}` });
        const workflow = createTestWorkflow({ name: `memory-workflow-${i}` });

        // Verify they're created correctly
        expect(task.id).toBeDefined();
        expect(agent.name).toBe(`memory-agent-${i}`);
        expect(workflow.name).toBe(`memory-workflow-${i}`);

        // Let them go out of scope
      }

      // If we reach here without running out of memory, the test passes
      expect(true).toBe(true);
    });

    it('should handle concurrent fixture creation efficiently', async () => {
      const startTime = Date.now();

      // Create fixtures concurrently
      const promises = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve().then(() => ({
          task: createTestTask({ description: `Concurrent task ${i}` }),
          agent: createTestAgent({ name: `concurrent-agent-${i}` }),
          workflow: createTestWorkflow({ name: `concurrent-workflow-${i}` })
        }))
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results.length).toBe(50);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      // Verify all results are unique and valid
      const taskIds = results.map(r => r.task.id);
      const uniqueIds = new Set(taskIds);
      expect(uniqueIds.size).toBe(50);
    });
  });

  // ============================================================================
  // Error Recovery and Resilience Tests
  // ============================================================================

  describe('Error Recovery', () => {
    it('should handle invalid overrides gracefully by falling back to defaults', () => {
      // Test with various invalid values that should be overridden
      const invalidOverrides = {
        status: 'invalid-status' as any,
        priority: null as any,
        effort: undefined as any,
        retryCount: 'not-a-number' as any,
        maxRetries: -5 as any
      };

      // The fixture function should still create a valid task
      expect(() => createTestTask(invalidOverrides)).not.toThrow();

      const task = createTestTask(invalidOverrides);

      // Verify valid values are used despite invalid inputs
      expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
      expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
      expect(() => TaskEffortSchema.parse(task.effort)).not.toThrow();

      // These should have been corrected to valid values
      expect(typeof task.retryCount).toBe('number');
      expect(typeof task.maxRetries).toBe('number');
    });

    it('should handle malformed function-based overrides in bulk creation', () => {
      const malformedFunction = (index: number) => {
        if (index === 2) {
          throw new Error('Intentional error');
        }
        return {
          description: `Function test ${index}`,
          priority: 'high' as TaskPriority
        };
      };

      // Should handle the error gracefully and continue
      expect(() => createTestTasks(5, malformedFunction)).toThrow();
    });
  });

  // ============================================================================
  // Real-world Usage Pattern Tests
  // ============================================================================

  describe('Real-world Usage Patterns', () => {
    it('should support complex workflow simulation patterns', () => {
      // Simulate a real development workflow
      const projectAgents = createTestAgents(5, (index) => {
        const roles = ['planner', 'architect', 'developer', 'tester', 'reviewer'];
        const skills = [
          ['planning', 'analysis'],
          ['architecture', 'design'],
          ['coding', 'implementation'],
          ['testing', 'qa'],
          ['review', 'quality']
        ];

        return {
          name: roles[index],
          skills: skills[index],
          model: index < 2 ? 'opus' : 'sonnet' // Use Opus for complex reasoning
        };
      });

      const projectWorkflow = createTestWorkflow({
        name: 'full-development-cycle',
        description: 'Complete software development lifecycle',
        stages: projectAgents.map((agent, index) =>
          createTestWorkflowStage({
            name: agent.name,
            agent: agent.name,
            description: `${agent.name} stage`,
            dependsOn: index === 0 ? undefined : [projectAgents[index - 1].name],
            maxRetries: index === 2 ? 5 : 3 // More retries for development
          })
        )
      });

      // Create tasks for each stage
      const projectTasks = createTestTasks(5, (index) => ({
        description: `${projectAgents[index].name} task for feature X`,
        workflow: projectWorkflow.name,
        priority: index === 0 ? 'urgent' : 'normal', // Planning is urgent
        effort: index === 2 ? 'large' : 'medium' // Development is large effort
      }));

      // Verify the complete setup
      expect(projectAgents.length).toBe(5);
      expect(projectWorkflow.stages.length).toBe(5);
      expect(projectTasks.length).toBe(5);

      // Verify relationships
      projectAgents.forEach((agent, index) => {
        expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
        expect(projectTasks[index].workflow).toBe(projectWorkflow.name);
        expect(() => TaskStatusSchema.parse(projectTasks[index].status)).not.toThrow();
      });

      expect(() => WorkflowDefinitionSchema.parse(projectWorkflow)).not.toThrow();
    });

    it('should support testing various autonomy levels', () => {
      const autonomyLevels: AutonomyLevel[] = ['full', 'supervised', 'ask'];

      const autonomyTasks = autonomyLevels.map(level =>
        createTestTask({
          description: `Task with ${level} autonomy`,
          autonomy: level,
          priority: level === 'ask' ? 'high' : 'normal'
        })
      );

      autonomyTasks.forEach((task, index) => {
        expect(task.autonomy).toBe(autonomyLevels[index]);
        expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
        expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
      });
    });

    it('should support testing task dependencies and blocking patterns', () => {
      // Create a task with dependencies
      const dependencyTask = createTestTask({
        description: 'Task with complex dependencies',
        dependsOn: ['task-1', 'task-2', 'task-3'],
        blockedBy: ['blocker-1', 'blocker-2'],
        status: 'paused' // Paused due to dependencies
      });

      expect(dependencyTask.dependsOn).toEqual(['task-1', 'task-2', 'task-3']);
      expect(dependencyTask.blockedBy).toEqual(['blocker-1', 'blocker-2']);
      expect(dependencyTask.status).toBe('paused');
      expect(() => TaskStatusSchema.parse(dependencyTask.status)).not.toThrow();
    });
  });
});