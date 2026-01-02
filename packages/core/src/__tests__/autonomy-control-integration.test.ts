import { describe, it, expect } from 'vitest';
import {
  AutonomyLevelSchema,
  ApprovalGateSchema,
  TaskResourceLimitsSchema,
  AutonomyConfigSchema,
  migrateLegacyAutonomyLevel,
  type AutonomyLevel,
  type ApprovalGate,
  type TaskResourceLimits,
  type AutonomyConfig
} from '../types';

describe('Autonomy Control Integration', () => {
  it('should integrate all autonomy control schemas in real-world scenario', () => {
    // Create a realistic production configuration
    const productionConfig: AutonomyConfig = {
      level: 'review-before-commit',
      gates: [
        {
          type: 'before-commit',
          name: 'Code Review Gate',
          description: 'All code changes require peer review',
          required: true,
          approvers: ['team-lead@company.com'],
          minApprovals: 1,
          timeout: 60,
          tags: ['code-quality', 'review']
        },
        {
          type: 'before-deploy',
          name: 'Production Deploy Gate',
          description: 'Production deploys require ops team approval',
          required: true,
          approvers: ['ops-team@company.com'],
          minApprovals: 1,
          timeout: 30,
          tags: ['production', 'deployment']
        }
      ],
      limits: {
        maxCost: 20.0,
        maxTokens: 100000,
        maxTimeMs: 1800000, // 30 minutes
        maxFilesModified: 50,
        maxTurns: 25,
        dailyBudget: 100.0
      },
      stageOverrides: {
        planning: 'full-auto',
        testing: 'full-auto'
      },
      agentOverrides: {
        tester: 'full-auto',
        reviewer: 'review-all'
      }
    };

    // Validate the configuration
    const parsed = AutonomyConfigSchema.parse(productionConfig);

    // Verify all parts are correctly parsed
    expect(parsed.level).toBe('review-before-commit');
    expect(parsed.gates).toHaveLength(2);
    expect(parsed.limits?.maxCost).toBe(20.0);
    expect(parsed.stageOverrides?.planning).toBe('full-auto');
    expect(parsed.agentOverrides?.tester).toBe('full-auto');
  });

  it('should handle legacy migration in configuration', () => {
    // Simulate migrating from legacy configuration
    const legacyLevel = 'manual';
    const migratedLevel = migrateLegacyAutonomyLevel(legacyLevel);

    const migratedConfig: AutonomyConfig = {
      level: migratedLevel,
      gates: [{
        type: 'before-commit',
        name: 'Migrated Review Gate'
      }]
    };

    const parsed = AutonomyConfigSchema.parse(migratedConfig);
    expect(parsed.level).toBe('review-all');
  });

  it('should validate complex approval gate configurations', () => {
    const complexGate: ApprovalGate = {
      type: 'custom',
      name: 'High Risk Change Gate',
      description: 'Special approval for high-risk operations',
      required: true,
      trigger: 'risk_assessment.score > 0.8 && affected_systems.includes("production")',
      approvers: ['security@company.com', 'cto@company.com', 'lead-architect@company.com'],
      timeout: 240, // 4 hours
      autoApproveOnTimeout: false,
      minApprovals: 2,
      tags: ['high-risk', 'security', 'production', 'manual-review']
    };

    const parsed = ApprovalGateSchema.parse(complexGate);
    expect(parsed.type).toBe('custom');
    expect(parsed.minApprovals).toBe(2);
    expect(parsed.approvers).toHaveLength(3);
    expect(parsed.tags).toContain('high-risk');
  });

  it('should validate comprehensive resource limits', () => {
    const enterpriseLimits: TaskResourceLimits = {
      maxCost: 50.0,
      maxTokens: 1000000,
      maxTimeMs: 7200000, // 2 hours
      maxFilesCreated: 100,
      maxFilesModified: 500,
      maxFilesDeleted: 50,
      maxLinesChanged: 10000,
      maxTurns: 100,
      dailyBudget: 500.0,
      maxConcurrentTasks: 10
    };

    const parsed = TaskResourceLimitsSchema.parse(enterpriseLimits);
    expect(parsed.maxCost).toBe(50.0);
    expect(parsed.maxConcurrentTasks).toBe(10);
    expect(parsed.dailyBudget).toBe(500.0);
  });
});