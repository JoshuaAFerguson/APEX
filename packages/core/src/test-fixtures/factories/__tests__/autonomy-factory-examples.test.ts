/**
 * @fileoverview Practical examples for autonomy factory usage
 *
 * This file contains practical examples demonstrating how to use autonomy factories
 * in real test scenarios. These examples serve as both tests and documentation.
 */

import { describe, it, expect } from 'vitest';
import {
  createAutonomyConfig,
  createFullAutoConfig,
  createReviewBeforeCommitConfig,
  createReviewAllConfig,
  AutonomyPresets,
  createAutonomyLevelCollection,
  createAutonomyVariants,
} from '../autonomy-factory.js';
import { createTask } from '../task-factory.js';

describe('autonomy-factory examples', () => {
  describe('Basic usage examples', () => {
    it('Example: Create a basic autonomy config for testing', () => {
      // Simple configuration for most test cases
      const config = createAutonomyConfig();

      expect(config.level).toBe('review-before-commit');
      expect(config.gates).toHaveLength(2);
      expect(config.limits).toBeDefined();

      // Use in test:
      const task = createTask({ autonomy: config.level });
      expect(task.autonomy).toBe('review-before-commit');
    });

    it('Example: Create configs for all autonomy levels', () => {
      // When you need to test all autonomy levels
      const allConfigs = createAutonomyLevelCollection();

      // Test each autonomy level
      Object.entries(allConfigs).forEach(([level, config]) => {
        const task = createTask({ autonomy: config.level });
        expect(task.autonomy).toBe(level);
      });
    });
  });

  describe('Workflow testing examples', () => {
    it('Example: Testing a feature development workflow', () => {
      // Create autonomy config for feature development
      const featureConfig = createReviewBeforeCommitConfig({
        stageOverrides: {
          'planning': 'full-auto',        // Planning can be automated
          'implementation': 'review-before-commit', // Code needs review
          'testing': 'full-auto',         // Testing can be automated
          'deployment': 'review-all',     // Deployment needs approval
        },
        limits: {
          maxDuration: 120,               // 2 hours max
          maxCost: 25.00,                 // $25 budget
          maxTokens: 200000,
          maxRetries: 3,
          maxFileSize: 10485760,
          maxFiles: 50,
        },
      });

      // Create tasks for each stage
      const tasks = {
        planning: createTask({
          autonomy: featureConfig.stageOverrides!.planning as any,
          description: 'Analyze requirements and create implementation plan',
          workflow: 'feature',
          effort: 'small',
        }),
        implementation: createTask({
          autonomy: featureConfig.stageOverrides!.implementation as any,
          description: 'Implement user authentication feature',
          workflow: 'feature',
          effort: 'medium',
        }),
        deployment: createTask({
          autonomy: featureConfig.stageOverrides!.deployment as any,
          description: 'Deploy authentication feature to production',
          workflow: 'feature',
          effort: 'small',
        }),
      };

      // Verify correct autonomy levels
      expect(tasks.planning.autonomy).toBe('full-auto');
      expect(tasks.implementation.autonomy).toBe('review-before-commit');
      expect(tasks.deployment.autonomy).toBe('review-all');
    });

    it('Example: Testing hotfix workflow with urgency', () => {
      // Hotfixes need quick turnaround with minimal oversight
      const hotfixConfig = createFullAutoConfig({
        limits: {
          maxDuration: 30,     // 30 minutes max for urgency
          maxCost: 5.00,       // Low cost for quick fixes
          maxTokens: 25000,
          maxRetries: 1,       // No time for multiple retries
          maxFileSize: 2097152, // 2MB limit
          maxFiles: 10,        // Minimal file changes
        },
      });

      const hotfixTask = createTask({
        autonomy: hotfixConfig.level,
        workflow: 'hotfix',
        priority: 'urgent',
        effort: 'minimal',
        description: 'Fix critical security vulnerability',
      });

      expect(hotfixTask.autonomy).toBe('full-auto');
      expect(hotfixTask.priority).toBe('urgent');
      expect(hotfixConfig.limits?.maxDuration).toBe(30);
    });
  });

  describe('Team role examples', () => {
    it('Example: Configure autonomy for different team roles', () => {
      // Different roles have different autonomy needs
      const teamConfigs = {
        juniorDeveloper: createReviewAllConfig({
          agentOverrides: {
            'developer': {
              level: 'review-all',
              approvalTimeout: 60,      // More time for review
              rejectionBehavior: 'skip',
            },
          },
          limits: {
            maxCost: 5.00,              // Lower budget
            maxDuration: 60,            // 1 hour limit
            maxTokens: 50000,
            maxRetries: 2,
            maxFileSize: 5242880,       // 5MB
            maxFiles: 20,
          },
        }),

        seniorDeveloper: createReviewBeforeCommitConfig({
          agentOverrides: {
            'developer': {
              level: 'review-before-commit',
              approvalTimeout: 30,
              rejectionBehavior: 'skip',
            },
          },
          limits: {
            maxCost: 25.00,             // Higher budget
            maxDuration: 180,           // 3 hours
            maxTokens: 200000,
            maxRetries: 5,
            maxFileSize: 20971520,      // 20MB
            maxFiles: 100,
          },
        }),

        techLead: createFullAutoConfig({
          agentOverrides: {
            'developer': 'full-auto',
            'reviewer': 'full-auto',
            'tester': 'full-auto',
          },
          limits: {
            maxCost: 100.00,            // Full budget
            maxDuration: 480,           // 8 hours
            maxTokens: 1000000,
            maxRetries: 10,
            maxFileSize: 104857600,     // 100MB
            maxFiles: 500,
          },
        }),
      };

      // Create tasks for each role
      const juniorTask = createTask({
        autonomy: teamConfigs.juniorDeveloper.level,
        description: 'Implement simple validation function',
        effort: 'small',
      });

      const seniorTask = createTask({
        autonomy: teamConfigs.seniorDeveloper.level,
        description: 'Design and implement complex API integration',
        effort: 'large',
      });

      const leadTask = createTask({
        autonomy: teamConfigs.techLead.level,
        description: 'Architect microservices communication pattern',
        effort: 'xlarge',
      });

      expect(juniorTask.autonomy).toBe('review-all');
      expect(seniorTask.autonomy).toBe('review-before-commit');
      expect(leadTask.autonomy).toBe('full-auto');
    });
  });

  describe('Environment-specific examples', () => {
    it('Example: Different autonomy for different environments', () => {
      const environmentConfigs = {
        development: createFullAutoConfig({
          limits: {
            maxCost: 10.00,
            maxDuration: 120,
            maxTokens: 100000,
            maxRetries: 5,
            maxFileSize: 20971520,
            maxFiles: 100,
          },
        }),

        staging: createReviewBeforeCommitConfig({
          gates: [{
            id: 'staging-approval',
            name: 'Staging Deployment Approval',
            description: 'Approve deployment to staging environment',
            stage: 'deployment',
            type: 'manual',
            timeout: 30,
            required: true,
            conditions: ['staging-ready'],
          }],
          limits: {
            maxCost: 5.00,
            maxDuration: 60,
            maxTokens: 50000,
            maxRetries: 3,
            maxFileSize: 10485760,
            maxFiles: 50,
          },
        }),

        production: createReviewAllConfig({
          gates: [
            {
              id: 'security-review',
              name: 'Security Review',
              description: 'Security team approval for production deployment',
              stage: 'review',
              type: 'manual',
              timeout: 120,
              required: true,
              conditions: ['security-cleared'],
            },
            {
              id: 'production-deployment',
              name: 'Production Deployment',
              description: 'Final approval for production deployment',
              stage: 'deployment',
              type: 'manual',
              timeout: 60,
              required: true,
              conditions: ['production-ready'],
            },
          ],
          limits: {
            maxCost: 2.00,
            maxDuration: 30,
            maxTokens: 20000,
            maxRetries: 1,
            maxFileSize: 5242880,
            maxFiles: 20,
          },
        }),
      };

      // Test that configs have appropriate restrictions
      expect(environmentConfigs.development.level).toBe('full-auto');
      expect(environmentConfigs.staging.gates).toHaveLength(1);
      expect(environmentConfigs.production.gates).toHaveLength(2);

      // Production should be most restrictive
      expect(environmentConfigs.production.limits?.maxCost)
        .toBeLessThan(environmentConfigs.staging.limits!.maxCost);
    });
  });

  describe('A/B testing examples', () => {
    it('Example: A/B test autonomous vs manual workflows', () => {
      const experimentVariants = createAutonomyVariants();

      // Create identical tasks with different autonomy
      const baseTaskProps = {
        description: 'Implement user profile feature',
        workflow: 'feature',
        effort: 'medium' as const,
        priority: 'normal' as const,
      };

      const controlGroupTask = createTask({
        ...baseTaskProps,
        autonomy: experimentVariants.control.level,
      });

      const experimentGroupTask = createTask({
        ...baseTaskProps,
        autonomy: experimentVariants.experimental.level,
      });

      // Control group: manual review
      expect(controlGroupTask.autonomy).toBe('review-before-commit');

      // Experiment group: fully autonomous
      expect(experimentGroupTask.autonomy).toBe('full-auto');

      // Both should have identical properties except autonomy
      expect(controlGroupTask.description).toBe(experimentGroupTask.description);
      expect(controlGroupTask.workflow).toBe(experimentGroupTask.workflow);
      expect(controlGroupTask.effort).toBe(experimentGroupTask.effort);
    });
  });

  describe('Testing utility examples', () => {
    it('Example: Use presets for quick test setup', () => {
      // Quick setups for common scenarios
      const scenarios = {
        basicTest: AutonomyPresets.testing.minimal(),
        integrationTest: AutonomyPresets.testing.withGates(),
        endToEndTest: AutonomyPresets.testing.complete(),
        performanceTest: AutonomyPresets.resources.test(),
      };

      // Verify each preset has appropriate settings
      expect(scenarios.basicTest.gates).toBeUndefined();
      expect(scenarios.integrationTest.gates).toHaveLength(2);
      expect(scenarios.endToEndTest.stageOverrides).toBeDefined();
      expect(scenarios.performanceTest.limits?.maxDuration).toBe(5);
    });

    it('Example: Create test configurations with custom overrides', () => {
      // Custom configuration for specific test needs
      const customTestConfig = createAutonomyConfig(
        {
          level: 'review-before-commit',
          rejectionBehavior: 'skip',
        },
        {
          includeGates: true,
          includeLimits: true,
          includeAgentOverrides: true,
          gateCount: 1,
        }
      );

      // Verify configuration
      expect(customTestConfig.level).toBe('review-before-commit');
      expect(customTestConfig.gates).toHaveLength(1);
      expect(customTestConfig.agentOverrides).toBeDefined();

      // Use in test
      const testTask = createTask({
        autonomy: customTestConfig.level,
        description: 'Test task with custom autonomy configuration',
      });

      expect(testTask.autonomy).toBe('review-before-commit');
    });
  });

  describe('Error scenario examples', () => {
    it('Example: Test resource limit exceeded scenarios', () => {
      // Configuration with very low limits to trigger errors
      const restrictiveConfig = createAutonomyConfig({
        level: 'review-all',
        limits: {
          maxDuration: 1,        // 1 minute - very short
          maxCost: 0.10,         // 10 cents - very low
          maxTokens: 1000,       // Very few tokens
          maxRetries: 0,         // No retries
          maxFileSize: 1024,     // 1KB - very small
          maxFiles: 1,           // Single file only
        },
      });

      const highDemandTask = createTask({
        autonomy: restrictiveConfig.level,
        description: 'Complex refactoring task',
        effort: 'xlarge',
        priority: 'urgent',
      });

      // This scenario would help test limit enforcement
      expect(restrictiveConfig.limits?.maxCost).toBe(0.10);
      expect(highDemandTask.effort).toBe('xlarge');
      // In real usage, this mismatch would trigger error handling
    });

    it('Example: Test approval timeout scenarios', () => {
      // Configuration with short timeouts for testing
      const quickTimeoutConfig = createReviewAllConfig({
        approvalTimeout: 1, // 1 minute timeout
        gates: [{
          id: 'quick-review',
          name: 'Quick Review Gate',
          description: 'Fast approval gate for timeout testing',
          stage: 'implementation',
          type: 'manual',
          timeout: 1,
          required: true,
          conditions: ['timeout-test'],
        }],
      });

      expect(quickTimeoutConfig.approvalTimeout).toBe(1);
      expect(quickTimeoutConfig.gates?.[0].timeout).toBe(1);
    });
  });
});