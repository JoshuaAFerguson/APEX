/**
 * @fileoverview Integration tests for autonomy factory functions
 *
 * Tests that demonstrate how autonomy factories integrate with task factories
 * and other parts of the test fixtures system.
 */

import { describe, it, expect } from 'vitest';
import {
  createAutonomyConfig,
  createFullAutoConfig,
  createReviewBeforeCommitConfig,
  createReviewAllConfig,
  AutonomyPresets,
  createAutonomyLevelCollection,
} from '../autonomy-factory.js';
import { createTask, TaskPresets } from '../task-factory.js';
import type { AutonomyLevel } from '../../../types.js';

describe('autonomy-factory integration', () => {
  describe('Integration with task factory', () => {
    it('should work with task factory to create tasks with specific autonomy levels', () => {
      const autonomyConfigs = createAutonomyLevelCollection();

      const fullAutoTask = createTask({
        autonomy: 'full-auto' as AutonomyLevel,
        description: 'Fully automated task',
      });

      const reviewTask = createTask({
        autonomy: 'review-before-commit' as AutonomyLevel,
        description: 'Task requiring review before commit',
      });

      expect(fullAutoTask.autonomy).toBe('full-auto');
      expect(reviewTask.autonomy).toBe('review-before-commit');

      // Verify the autonomy config would support the task's autonomy level
      expect(autonomyConfigs['full-auto'].level).toBe(fullAutoTask.autonomy);
      expect(autonomyConfigs['review-before-commit'].level).toBe(reviewTask.autonomy);
    });

    it('should create tasks that work with different autonomy configurations', () => {
      const restrictiveConfig = AutonomyPresets.resources.restrictive();
      const permissiveConfig = AutonomyPresets.resources.permissive();

      // Create tasks with autonomy levels matching the configs
      const restrictiveTask = createTask({
        autonomy: restrictiveConfig.level,
        priority: 'high',
      });

      const permissiveTask = createTask({
        autonomy: permissiveConfig.level,
        priority: 'normal',
      });

      expect(restrictiveTask.autonomy).toBe('review-all');
      expect(permissiveTask.autonomy).toBe('full-auto');
    });
  });

  describe('Workflow scenario testing', () => {
    it('should support feature development workflow testing', () => {
      const featureConfig = createReviewBeforeCommitConfig({
        stageOverrides: {
          'planning': 'full-auto',
          'implementation': 'review-before-commit',
          'testing': 'full-auto',
          'deployment': 'review-all',
        },
      });

      // Create tasks for different stages
      const planningTask = createTask({
        autonomy: featureConfig.stageOverrides!.planning as AutonomyLevel,
        workflow: 'feature',
        description: 'Plan new feature',
      });

      const implementationTask = createTask({
        autonomy: featureConfig.stageOverrides!.implementation as AutonomyLevel,
        workflow: 'feature',
        description: 'Implement new feature',
      });

      const deploymentTask = createTask({
        autonomy: featureConfig.stageOverrides!.deployment as AutonomyLevel,
        workflow: 'feature',
        description: 'Deploy new feature',
      });

      expect(planningTask.autonomy).toBe('full-auto');
      expect(implementationTask.autonomy).toBe('review-before-commit');
      expect(deploymentTask.autonomy).toBe('review-all');

      // Verify tasks have appropriate effort levels for their autonomy
      expect(planningTask.effort).toBeDefined();
      expect(implementationTask.effort).toBeDefined();
      expect(deploymentTask.effort).toBeDefined();
    });

    it('should support hotfix workflow testing', () => {
      const hotfixConfig = createFullAutoConfig({
        limits: {
          maxDuration: 30, // Quick turnaround for hotfixes
          maxTokens: 50000,
          maxCost: 5.00,
          maxRetries: 1, // Limited retries for urgency
          maxFileSize: 5242880, // 5MB
          maxFiles: 20,
        },
      });

      const hotfixTask = createTask({
        autonomy: hotfixConfig.level,
        workflow: 'hotfix',
        priority: 'urgent',
        effort: 'small',
        description: 'Critical security patch',
      });

      expect(hotfixTask.autonomy).toBe('full-auto');
      expect(hotfixTask.priority).toBe('urgent');
      expect(hotfixTask.workflow).toBe('hotfix');
    });
  });

  describe('Agent-specific autonomy testing', () => {
    it('should create configurations for different agent roles', () => {
      const agentConfigs = {
        developer: AutonomyPresets.agents.developer(),
        tester: AutonomyPresets.agents.tester(),
        reviewer: AutonomyPresets.agents.reviewer(),
      };

      // Create tasks that would be handled by different agents
      const devTask = createTask({
        autonomy: agentConfigs.developer.level,
        description: 'Implement user authentication',
        workflow: 'feature',
      });

      const testTask = createTask({
        autonomy: agentConfigs.tester.level,
        description: 'Run test suite',
        workflow: 'feature',
      });

      const reviewTask = createTask({
        autonomy: agentConfigs.reviewer.level,
        description: 'Review security implementation',
        workflow: 'feature',
      });

      expect(devTask.autonomy).toBe('review-before-commit');
      expect(testTask.autonomy).toBe('full-auto');
      expect(reviewTask.autonomy).toBe('review-all');
    });
  });

  describe('Cost and resource testing scenarios', () => {
    it('should create scenarios for budget testing', () => {
      const lowBudgetConfig = createAutonomyConfig({
        level: 'review-all',
        limits: {
          maxCost: 1.00,
          maxTokens: 10000,
          maxDuration: 15,
          maxRetries: 1,
          maxFileSize: 1048576, // 1MB
          maxFiles: 5,
        },
      });

      const highBudgetConfig = createAutonomyConfig({
        level: 'full-auto',
        limits: {
          maxCost: 100.00,
          maxTokens: 1000000,
          maxDuration: 480, // 8 hours
          maxRetries: 10,
          maxFileSize: 104857600, // 100MB
          maxFiles: 1000,
        },
      });

      // Create tasks with corresponding budgets
      const lowBudgetTask = createTask({
        autonomy: lowBudgetConfig.level,
        effort: 'minimal',
        priority: 'low',
      });

      const highBudgetTask = createTask({
        autonomy: highBudgetConfig.level,
        effort: 'xlarge',
        priority: 'urgent',
      });

      expect(lowBudgetTask.autonomy).toBe('review-all');
      expect(lowBudgetTask.effort).toBe('minimal');
      expect(highBudgetTask.autonomy).toBe('full-auto');
      expect(highBudgetTask.effort).toBe('xlarge');
    });
  });

  describe('Error and edge case scenarios', () => {
    it('should handle autonomy mismatches gracefully', () => {
      // Create a task with high autonomy but restrictive config
      const restrictiveConfig = AutonomyPresets.resources.restrictive();

      // This might happen in error scenarios
      const mismatchedTask = createTask({
        autonomy: 'full-auto', // High autonomy
        effort: 'xlarge', // But large effort
      });

      // The config is restrictive but task wants full automation
      expect(mismatchedTask.autonomy).toBe('full-auto');
      expect(restrictiveConfig.level).toBe('review-all');

      // In practice, the restrictive config would override the task's autonomy preference
      // This scenario helps test configuration validation
    });

    it('should support timeout testing scenarios', () => {
      const quickTimeoutConfig = AutonomyPresets.resources.test();
      const longTimeoutConfig = createAutonomyConfig({
        approvalTimeout: 120, // 2 hours
        gates: [{
          id: 'extended-review',
          name: 'Extended Review',
          description: 'Thorough review with extended timeout',
          stage: 'review',
          type: 'manual',
          timeout: 120,
          required: true,
          conditions: ['complex-changes'],
        }],
      });

      const quickTask = createTask({
        autonomy: quickTimeoutConfig.level,
        effort: 'minimal',
      });

      const complexTask = createTask({
        autonomy: longTimeoutConfig.level,
        effort: 'xlarge',
      });

      expect(quickTask.effort).toBe('minimal');
      expect(complexTask.effort).toBe('xlarge');
    });
  });

  describe('Preset collection testing', () => {
    it('should provide comprehensive testing scenarios', () => {
      const basicScenarios = Object.keys(AutonomyPresets.basic);
      const resourceScenarios = Object.keys(AutonomyPresets.resources);
      const testingScenarios = Object.keys(AutonomyPresets.testing);
      const stageScenarios = Object.keys(AutonomyPresets.stages);
      const agentScenarios = Object.keys(AutonomyPresets.agents);

      // Should have scenarios for all major test categories
      expect(basicScenarios).toEqual(['fullAuto', 'reviewBeforeCommit', 'reviewAll']);
      expect(resourceScenarios).toEqual(['restrictive', 'permissive', 'test']);
      expect(testingScenarios).toEqual(['minimal', 'withGates', 'withOverrides', 'complete']);
      expect(stageScenarios).toEqual(['planning', 'implementation', 'deployment']);
      expect(agentScenarios).toEqual(['developer', 'tester', 'reviewer']);

      // Each scenario should produce a valid configuration
      basicScenarios.forEach(scenario => {
        const config = (AutonomyPresets.basic as any)[scenario]();
        expect(config.level).toBeDefined();
        expect(['full-auto', 'review-before-commit', 'review-all']).toContain(config.level);
      });
    });
  });

  describe('Real-world usage patterns', () => {
    it('should support A/B testing scenarios', () => {
      const variants = {
        controlGroup: AutonomyPresets.basic.reviewBeforeCommit(),
        experimentGroup: AutonomyPresets.basic.fullAuto(),
      };

      // Create identical tasks with different autonomy configurations
      const controlTask = createTask({
        autonomy: variants.controlGroup.level,
        description: 'Feature implementation (control)',
        workflow: 'feature',
      });

      const experimentTask = createTask({
        autonomy: variants.experimentGroup.level,
        description: 'Feature implementation (experiment)',
        workflow: 'feature',
      });

      expect(controlTask.autonomy).toBe('review-before-commit');
      expect(experimentTask.autonomy).toBe('full-auto');

      // Both should have same base properties except autonomy
      expect(controlTask.workflow).toBe(experimentTask.workflow);
      expect(controlTask.priority).toBe(experimentTask.priority);
      expect(controlTask.effort).toBe(experimentTask.effort);
    });

    it('should support progressive autonomy testing', () => {
      // Simulate a team gradually increasing autonomy levels
      const progressiveStages = [
        { phase: 'trial', config: AutonomyPresets.basic.reviewAll() },
        { phase: 'adoption', config: AutonomyPresets.basic.reviewBeforeCommit() },
        { phase: 'full-deployment', config: AutonomyPresets.basic.fullAuto() },
      ];

      const stageTasks = progressiveStages.map(stage => createTask({
        autonomy: stage.config.level,
        description: `${stage.phase} phase task`,
      }));

      expect(stageTasks[0].autonomy).toBe('review-all'); // Most restrictive
      expect(stageTasks[1].autonomy).toBe('review-before-commit'); // Medium
      expect(stageTasks[2].autonomy).toBe('full-auto'); // Least restrictive
    });
  });
});