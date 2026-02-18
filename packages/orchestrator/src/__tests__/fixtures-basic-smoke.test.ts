/**
 * @fileoverview Basic smoke test for TaskStore test fixtures
 *
 * Simple validation that fixtures can be imported and basic functions work
 * This test should pass quickly and catch any major issues
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

describe('TaskStore Fixtures - Basic Smoke Test', () => {
  it('should import and create fixtures without errors', () => {
    // Basic creation should not throw
    expect(() => createTestTask()).not.toThrow();
    expect(() => createTestAgent()).not.toThrow();
    expect(() => createTestWorkflowStage()).not.toThrow();
    expect(() => createTestWorkflow()).not.toThrow();

    // Bulk creation should work
    expect(() => createTestTasks(3)).not.toThrow();
    expect(() => createTestAgents(2)).not.toThrow();
    expect(() => createTestWorkflows(2)).not.toThrow();
  });

  it('should create valid basic fixtures', () => {
    const task = createTestTask();
    const agent = createTestAgent();
    const workflow = createTestWorkflow();

    // Basic structure validation
    expect(task.id).toBeDefined();
    expect(task.description).toBeDefined();
    expect(task.status).toBeDefined();
    expect(agent.name).toBeDefined();
    expect(workflow.name).toBeDefined();
    expect(workflow.stages).toBeDefined();
  });
});