/**
 * Test fixtures and mock factories for autonomy level configurations
 *
 * This module provides pre-built test configurations with different autonomy levels,
 * as well as factory functions to easily create autonomy configurations for testing.
 *
 * Usage:
 * - Import pre-built fixtures like `AutonomyFixtures.fullAuto` for common configs
 * - Use factory functions like `createAutonomyConfig()` for custom test configs
 * - Use `createApexConfigWithAutonomy()` to create full APEX configs with autonomy
 */

import {
  AutonomyLevel,
  AutonomyConfig,
  ApexConfig,
  ApprovalGate,
  TaskResourceLimits,
  AgentAutonomyOverride,
  RejectionBehavior,
} from '../types';

/**
 * Pre-built autonomy configuration fixtures for common test scenarios
 */
export const AutonomyFixtures = {
  /**
   * Full automation - no approvals required
   */
  fullAuto: {
    level: 'full-auto' as AutonomyLevel,
    rejectionBehavior: 'abort' as RejectionBehavior,
    gates: [],
    limits: {
      maxTokens: 1000000,
      maxCost: 10.0,
      maxTimeMs: 3600000, // 60 minutes
    },
    stageOverrides: {},
    agentOverrides: {},
  } satisfies AutonomyConfig,

  /**
   * Review before commit - requires approval for commits
   */
  reviewBeforeCommit: {
    level: 'review-before-commit' as AutonomyLevel,
    rejectionBehavior: 'abort' as RejectionBehavior,
    gates: [
      {
        type: 'before-commit' as const,
        description: 'Review code changes before committing',
        required: true,
      },
    ],
    limits: {
      maxTokens: 500000,
      maxCost: 5.0,
      maxTimeMs: 1800000, // 30 minutes
    },
    stageOverrides: {},
    agentOverrides: {},
  } satisfies AutonomyConfig,

  /**
   * Review all actions - requires approval for every action
   */
  reviewAll: {
    level: 'review-all' as AutonomyLevel,
    rejectionBehavior: 'skip' as RejectionBehavior,
    gates: [
      {
        type: 'before-destructive' as const,
        description: 'Review all code changes',
        required: true,
      },
      {
        type: 'before-commit' as const,
        description: 'Review commits',
        required: true,
      },
      {
        type: 'deployment' as const,
        description: 'Review deployments',
        required: true,
      },
    ],
    limits: {
      maxTokens: 250000,
      maxCost: 2.5,
      maxTimeMs: 900000, // 15 minutes
    },
    stageOverrides: {},
    agentOverrides: {},
  } satisfies AutonomyConfig,

  /**
   * Semi-auto with stage overrides
   */
  semiAutoWithStageOverrides: {
    level: 'review-before-commit' as AutonomyLevel,
    rejectionBehavior: 'abort' as RejectionBehavior,
    gates: [],
    limits: {
      maxTokens: 750000,
      maxCost: 7.5,
      maxTimeMs: 2700000, // 45 minutes
    },
    stageOverrides: {
      planning: 'full-auto' as AutonomyLevel,
      implementation: 'review-before-commit' as AutonomyLevel,
      testing: 'review-all' as AutonomyLevel,
    },
    agentOverrides: {},
  } satisfies AutonomyConfig,

  /**
   * Configuration with agent-specific overrides
   */
  withAgentOverrides: {
    level: 'review-before-commit' as AutonomyLevel,
    rejectionBehavior: 'abort' as RejectionBehavior,
    gates: [],
    limits: {
      maxTokens: 500000,
      maxCost: 5.0,
      maxTimeMs: 1800000, // 30 minutes
    },
    stageOverrides: {},
    agentOverrides: {
      developer: 'full-auto' as AutonomyLevel,
      tester: {
        level: 'review-all' as AutonomyLevel,
        approvalTimeout: 10,
        rejectionBehavior: 'skip' as RejectionBehavior,
      } satisfies AgentAutonomyOverride,
      reviewer: 'review-before-commit' as AutonomyLevel,
    },
  } satisfies AutonomyConfig,

  /**
   * Minimal configuration (uses most defaults)
   */
  minimal: {
    level: 'review-before-commit' as AutonomyLevel,
  } satisfies Partial<AutonomyConfig>,

  /**
   * Configuration with comprehensive approval gates
   */
  comprehensiveGates: {
    level: 'review-before-commit' as AutonomyLevel,
    rejectionBehavior: 'abort' as RejectionBehavior,
    gates: [
      {
        type: 'custom' as const,
        description: 'Review implementation plan',
        required: true,
      },
      {
        type: 'before-destructive' as const,
        description: 'Review significant code changes',
        required: false,
      },
      {
        type: 'before-commit' as const,
        description: 'Review before committing',
        required: true,
      },
      {
        type: 'deployment' as const,
        description: 'Review before deployment',
        required: true,
      },
    ],
    limits: {
      maxTokens: 500000,
      maxCost: 5.0,
      maxTimeMs: 1800000, // 30 minutes
    },
    stageOverrides: {},
    agentOverrides: {},
  } satisfies AutonomyConfig,
};

/**
 * Factory function to create custom autonomy configurations
 */
export function createAutonomyConfig(overrides: Partial<AutonomyConfig> = {}): AutonomyConfig {
  const defaultConfig: AutonomyConfig = {
    level: 'review-before-commit',
    rejectionBehavior: 'abort',
    gates: [],
    limits: {
      maxTokens: 500000,
      maxCost: 5.0,
      maxTimeMs: 1800000, // 30 minutes
    },
    stageOverrides: {},
    agentOverrides: {},
  };

  return {
    ...defaultConfig,
    ...overrides,
    // Deep merge for nested objects
    limits: overrides.limits ? { ...defaultConfig.limits, ...overrides.limits } : defaultConfig.limits,
    stageOverrides: overrides.stageOverrides ? { ...defaultConfig.stageOverrides, ...overrides.stageOverrides } : defaultConfig.stageOverrides,
    agentOverrides: overrides.agentOverrides ? { ...defaultConfig.agentOverrides, ...overrides.agentOverrides } : defaultConfig.agentOverrides,
    gates: overrides.gates || defaultConfig.gates,
  };
}

/**
 * Factory function to create approval gates for testing
 */
export function createApprovalGate(overrides: Partial<ApprovalGate> = {}): ApprovalGate {
  const defaultGate: ApprovalGate = {
    type: 'before-commit',
    description: 'Test approval gate',
    required: true,
  };

  return { ...defaultGate, ...overrides };
}

/**
 * Factory function to create task resource limits for testing
 */
export function createTaskResourceLimits(overrides: Partial<TaskResourceLimits> = {}): TaskResourceLimits {
  const defaultLimits: TaskResourceLimits = {
    maxTokens: 500000,
    maxCost: 5.0,
    maxTimeMs: 1800000, // 30 minutes
  };

  return { ...defaultLimits, ...overrides };
}

/**
 * Factory function to create agent autonomy overrides for testing
 */
export function createAgentAutonomyOverride(overrides: Partial<AgentAutonomyOverride> = {}): AgentAutonomyOverride {
  const defaultOverride: AgentAutonomyOverride = {
    level: 'review-before-commit',
    approvalTimeout: 15,
    rejectionBehavior: 'abort',
  };

  return { ...defaultOverride, ...overrides };
}

/**
 * Factory function to create a complete APEX config with autonomy settings
 */
export function createApexConfigWithAutonomy(
  autonomyConfig: Partial<AutonomyConfig> = {},
  configOverrides: Partial<ApexConfig> = {}
): ApexConfig {
  const defaultApexConfig: ApexConfig = {
    version: '1.0',
    project: {
      name: 'test-project',
      language: 'typescript',
      framework: 'nextjs',
      testCommand: 'npm test',
      lintCommand: 'npm run lint',
      buildCommand: 'npm run build',
    },
    autonomy: createAutonomyConfig(autonomyConfig),
    agents: {
      enabled: ['planner', 'developer', 'tester', 'reviewer'],
    },
    git: {
      branchPrefix: 'apex/',
      defaultBranch: 'main',
    },
    limits: {
      maxTokensPerTask: 500000,
      maxCostPerTask: 5.0,
      maxConcurrentTasks: 1,
      dailyBudget: 50.0,
    },
    api: {
      port: 3000,
    },
  };

  return {
    ...defaultApexConfig,
    ...configOverrides,
    // Deep merge for nested objects
    project: configOverrides.project ? { ...defaultApexConfig.project, ...configOverrides.project } : defaultApexConfig.project,
    agents: configOverrides.agents ? { ...defaultApexConfig.agents, ...configOverrides.agents } : defaultApexConfig.agents,
    git: configOverrides.git ? { ...defaultApexConfig.git, ...configOverrides.git } : defaultApexConfig.git,
    limits: configOverrides.limits ? { ...defaultApexConfig.limits, ...configOverrides.limits } : defaultApexConfig.limits,
    api: configOverrides.api ? { ...defaultApexConfig.api, ...configOverrides.api } : defaultApexConfig.api,
  };
}

/**
 * Utility function to get autonomy config variations for testing different levels
 */
export function getAutonomyConfigVariations(): Record<string, AutonomyConfig> {
  return {
    fullAuto: AutonomyFixtures.fullAuto,
    reviewBeforeCommit: AutonomyFixtures.reviewBeforeCommit,
    reviewAll: AutonomyFixtures.reviewAll,
    withStageOverrides: AutonomyFixtures.semiAutoWithStageOverrides,
    withAgentOverrides: AutonomyFixtures.withAgentOverrides,
    comprehensiveGates: AutonomyFixtures.comprehensiveGates,
    customMinimal: createAutonomyConfig({ level: 'full-auto', gates: [] }),
    customStrict: createAutonomyConfig({
      level: 'review-all',
      rejectionBehavior: 'abort',
      limits: { maxTokens: 100000, maxCost: 1.0, maxTimeMs: 600000 }
    }),
  };
}

/**
 * Utility function to validate autonomy config structure for tests
 */
export function isValidAutonomyConfig(config: unknown): config is AutonomyConfig {
  try {
    // Basic structure validation - in real tests you'd use the Zod schema
    if (!config || typeof config !== 'object') return false;
    const c = config as any;

    return (
      typeof c.level === 'string' &&
      ['full-auto', 'review-before-commit', 'review-all'].includes(c.level) &&
      (c.rejectionBehavior === undefined || ['skip', 'abort'].includes(c.rejectionBehavior)) &&
      (c.gates === undefined || Array.isArray(c.gates)) &&
      (c.limits === undefined || typeof c.limits === 'object') &&
      (c.stageOverrides === undefined || typeof c.stageOverrides === 'object') &&
      (c.agentOverrides === undefined || typeof c.agentOverrides === 'object')
    );
  } catch {
    return false;
  }
}
