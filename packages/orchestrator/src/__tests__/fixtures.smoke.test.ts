/**
 * @fileoverview Smoke tests for TaskStore test fixtures module
 *
 * Basic tests to verify that the fixtures module loads and exports work correctly.
 * These tests verify the module can be imported and basic functionality works.
 */

import * as fixtures from '../fixtures.js';

describe('TaskStore Test Fixtures Smoke Tests', () => {
  // ============================================================================
  // Module Exports
  // ============================================================================

  describe('Module Exports', () => {
    it('should export all required factory functions', () => {
      expect(typeof fixtures.createTestTask).toBe('function');
      expect(typeof fixtures.createTestAgent).toBe('function');
      expect(typeof fixtures.createTestWorkflowStage).toBe('function');
      expect(typeof fixtures.createTestWorkflow).toBe('function');
      expect(typeof fixtures.createTestTasks).toBe('function');
      expect(typeof fixtures.createTestAgents).toBe('function');
      expect(typeof fixtures.createTestWorkflows).toBe('function');
    });

    it('should export backward compatibility functions', () => {
      expect(typeof fixtures.createMockTask).toBe('function');
      expect(typeof fixtures.DatabaseSeeder).toBe('function');
      expect(typeof fixtures.seedPendingTask).toBe('function');
      expect(typeof fixtures.seedRunningTask).toBe('function');
      expect(typeof fixtures.seedCompletedTask).toBe('function');
      expect(typeof fixtures.seedFailedTask).toBe('function');
      expect(typeof fixtures.seedPausedTask).toBe('function');
      expect(typeof fixtures.seedCancelledTask).toBe('function');
      expect(typeof fixtures.seedTaskScenario).toBe('function');
      expect(typeof fixtures.createTestTaskStore).toBe('function');
    });
  });

  // ============================================================================
  // Basic Functionality
  // ============================================================================

  describe('Basic Functionality', () => {
    it('should create a basic task without throwing', () => {
      expect(() => {
        const task = fixtures.createTestTask();
        expect(task.id).toBeDefined();
        expect(task.description).toBeDefined();
        expect(task.status).toBeDefined();
      }).not.toThrow();
    });

    it('should create a basic agent without throwing', () => {
      expect(() => {
        const agent = fixtures.createTestAgent();
        expect(agent.name).toBeDefined();
        expect(agent.description).toBeDefined();
        expect(agent.tools).toBeDefined();
      }).not.toThrow();
    });

    it('should create a basic workflow stage without throwing', () => {
      expect(() => {
        const stage = fixtures.createTestWorkflowStage();
        expect(stage.name).toBeDefined();
        expect(stage.agent).toBeDefined();
        expect(stage.description).toBeDefined();
      }).not.toThrow();
    });

    it('should create a basic workflow without throwing', () => {
      expect(() => {
        const workflow = fixtures.createTestWorkflow();
        expect(workflow.name).toBeDefined();
        expect(workflow.description).toBeDefined();
        expect(workflow.stages).toBeDefined();
        expect(Array.isArray(workflow.stages)).toBe(true);
      }).not.toThrow();
    });

    it('should create bulk tasks without throwing', () => {
      expect(() => {
        const tasks = fixtures.createTestTasks(3);
        expect(Array.isArray(tasks)).toBe(true);
        expect(tasks.length).toBe(3);
      }).not.toThrow();
    });

    it('should create bulk agents without throwing', () => {
      expect(() => {
        const agents = fixtures.createTestAgents(2);
        expect(Array.isArray(agents)).toBe(true);
        expect(agents.length).toBe(2);
      }).not.toThrow();
    });

    it('should create bulk workflows without throwing', () => {
      expect(() => {
        const workflows = fixtures.createTestWorkflows(2);
        expect(Array.isArray(workflows)).toBe(true);
        expect(workflows.length).toBe(2);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Type Verification
  // ============================================================================

  describe('Type Verification', () => {
    it('should return objects with expected properties', () => {
      const task = fixtures.createTestTask();

      // Check for required Task properties
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('description');
      expect(task).toHaveProperty('workflow');
      expect(task).toHaveProperty('autonomy');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('priority');
      expect(task).toHaveProperty('effort');
      expect(task).toHaveProperty('projectPath');
      expect(task).toHaveProperty('branchName');
      expect(task).toHaveProperty('retryCount');
      expect(task).toHaveProperty('maxRetries');
      expect(task).toHaveProperty('resumeAttempts');
      expect(task).toHaveProperty('createdAt');
      expect(task).toHaveProperty('updatedAt');
      expect(task).toHaveProperty('usage');
      expect(task).toHaveProperty('logs');
      expect(task).toHaveProperty('artifacts');
      expect(task).toHaveProperty('dependsOn');
      expect(task).toHaveProperty('blockedBy');
    });

    it('should return agent objects with expected properties', () => {
      const agent = fixtures.createTestAgent();

      // Check for required AgentDefinition properties
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('description');
      expect(agent).toHaveProperty('prompt');
      expect(agent).toHaveProperty('tools');
      expect(agent).toHaveProperty('model');
      expect(agent).toHaveProperty('skills');
    });

    it('should return workflow stage objects with expected properties', () => {
      const stage = fixtures.createTestWorkflowStage();

      // Check for required WorkflowStage properties
      expect(stage).toHaveProperty('name');
      expect(stage).toHaveProperty('agent');
      expect(stage).toHaveProperty('description');
      expect(stage).toHaveProperty('parallel');
      expect(stage).toHaveProperty('maxRetries');
    });

    it('should return workflow objects with expected properties', () => {
      const workflow = fixtures.createTestWorkflow();

      // Check for required WorkflowDefinition properties
      expect(workflow).toHaveProperty('name');
      expect(workflow).toHaveProperty('description');
      expect(workflow).toHaveProperty('stages');

      // Check stages structure
      expect(Array.isArray(workflow.stages)).toBe(true);
      expect(workflow.stages.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle invalid bulk creation counts gracefully', () => {
      expect(() => fixtures.createTestTasks(0)).toThrow();
      expect(() => fixtures.createTestAgents(-1)).toThrow();
      expect(() => fixtures.createTestWorkflows(-5)).toThrow();
    });

    it('should handle null/undefined overrides gracefully', () => {
      expect(() => fixtures.createTestTask(null as any)).not.toThrow();
      expect(() => fixtures.createTestAgent(undefined)).not.toThrow();
      expect(() => fixtures.createTestWorkflowStage({})).not.toThrow();
      expect(() => fixtures.createTestWorkflow()).not.toThrow();
    });
  });
});