/**
 * Enhanced autonomy level test fixtures with intuitive naming
 *
 * This module extends the existing autonomy fixtures to provide more intuitive
 * factory functions and aliases that match common terminology used in acceptance
 * criteria and user-facing documentation.
 *
 * Usage:
 * ```typescript
 * import { AutonomyFixturesEnhanced } from './autonomy-fixtures-enhanced';
 *
 * // Use intuitive naming
 * const semiAutoConfig = AutonomyFixturesEnhanced.semiAuto();
 * const manualConfig = AutonomyFixturesEnhanced.manual();
 *
 * // Or use the factory functions
 * const customConfig = createSemiAutoConfig({ approvalTimeout: 30 });
 * ```
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

// Re-export existing fixtures for convenience
export * from './autonomy-fixtures';

/**
 * Enhanced autonomy configuration fixtures with intuitive naming
 * These provide aliases and extensions to the existing fixtures with
 * terminology that matches acceptance criteria and user expectations
 */
export const AutonomyFixturesEnhanced = {
  /**
   * Full automation - no human intervention required
   * Maps to 'full-auto' autonomy level
   */
  fullAuto: (): AutonomyConfig => ({
    level: 'full-auto' as AutonomyLevel,
    rejectionBehavior: 'abort' as RejectionBehavior,
    gates: [],
    limits: {
      maxTokensPerTask: 1000000,
      maxCostPerTask: 10.0,
      timeoutMinutes: 60,
    },
    stageOverrides: {},
    agentOverrides: {},
  }),

  /**
   * Semi-automatic - requires review before major commits
   * Maps to 'review-before-commit' autonomy level
   * Allows autonomous operation but pauses for review before commits
   */
  semiAuto: (): AutonomyConfig => ({
    level: 'review-before-commit' as AutonomyLevel,
    rejectionBehavior: 'abort' as RejectionBehavior,
    gates: [
      {
        type: 'commit' as const,
        description: 'Review code changes before committing',
        required: true,
        stage: 'implementation',
      },
    ],
    limits: {
      maxTokensPerTask: 500000,
      maxCostPerTask: 5.0,
      timeoutMinutes: 30,
    },
    stageOverrides: {},
    agentOverrides: {},
  }),

  /**
   * Manual - requires human review for all major actions
   * Maps to 'review-all' autonomy level
   * Human oversight required at every significant decision point
   */
  manual: (): AutonomyConfig => ({
    level: 'review-all' as AutonomyLevel,
    rejectionBehavior: 'skip' as RejectionBehavior,
    gates: [
      {
        type: 'planning' as const,
        description: 'Review implementation plan',
        required: true,
        stage: 'planning',
      },
      {
        type: 'code_change' as const,
        description: 'Review all code changes',
        required: true,
        stage: 'implementation',
      },
      {
        type: 'commit' as const,
        description: 'Review commits',
        required: true,
        stage: 'implementation',
      },
      {
        type: 'deployment' as const,
        description: 'Review deployments',
        required: true,
        stage: 'deployment',
      },
    ],
    limits: {
      maxTokensPerTask: 250000,
      maxCostPerTask: 2.5,
      timeoutMinutes: 15,
    },
    stageOverrides: {},
    agentOverrides: {},
  }),

  /**
   * Supervised - mix of autonomous and manual steps
   * Semi-auto with specific stage overrides for different levels of control
   */
  supervised: (): AutonomyConfig => ({
    level: 'review-before-commit' as AutonomyLevel,
    rejectionBehavior: 'abort' as RejectionBehavior,
    gates: [
      {
        type: 'commit' as const,
        description: 'Review before committing changes',
        required: true,
        stage: 'implementation',
      },
    ],
    limits: {
      maxTokensPerTask: 750000,
      maxCostPerTask: 7.5,
      timeoutMinutes: 45,
    },
    stageOverrides: {
      planning: 'full-auto' as AutonomyLevel,
      implementation: 'review-before-commit' as AutonomyLevel,
      testing: 'full-auto' as AutonomyLevel,
      deployment: 'review-all' as AutonomyLevel,
    },
    agentOverrides: {},
  }),

  /**
   * Restrictive - very limited autonomous operation
   * High oversight with tight resource constraints
   */
  restrictive: (): AutonomyConfig => ({
    level: 'review-all' as AutonomyLevel,
    rejectionBehavior: 'abort' as RejectionBehavior,
    gates: [
      {
        type: 'planning' as const,
        description: 'Review all plans',
        required: true,
        stage: 'planning',
      },
      {
        type: 'code_change' as const,
        description: 'Review every code change',
        required: true,
        stage: 'implementation',
      },
      {
        type: 'commit' as const,
        description: 'Review every commit',
        required: true,
        stage: 'implementation',
      },
      {
        type: 'deployment' as const,
        description: 'Review all deployments',
        required: true,
        stage: 'deployment',
      },
    ],
    limits: {
      maxTokensPerTask: 100000,
      maxCostPerTask: 1.0,
      timeoutMinutes: 10,
    },
    stageOverrides: {
      planning: 'review-all' as AutonomyLevel,
      implementation: 'review-all' as AutonomyLevel,
      testing: 'review-all' as AutonomyLevel,
      deployment: 'review-all' as AutonomyLevel,
    },
    agentOverrides: {},
  }),

  /**
   * Permissive - high autonomy with generous limits
   * Minimal oversight with high resource allowances
   */
  permissive: (): AutonomyConfig => ({
    level: 'full-auto' as AutonomyLevel,
    rejectionBehavior: 'skip' as RejectionBehavior,
    gates: [],
    limits: {
      maxTokensPerTask: 2000000,
      maxCostPerTask: 20.0,
      timeoutMinutes: 120,
    },
    stageOverrides: {
      planning: 'full-auto' as AutonomyLevel,
      implementation: 'full-auto' as AutonomyLevel,
      testing: 'full-auto' as AutonomyLevel,
      deployment: 'review-before-commit' as AutonomyLevel, // Only review deployments
    },
    agentOverrides: {},
  }),
};

/**
 * Factory function to create a full automation configuration
 * No human intervention required - agent operates completely autonomously
 */
export function createFullAutoConfig(overrides: Partial<AutonomyConfig> = {}): AutonomyConfig {
  const base = AutonomyFixturesEnhanced.fullAuto();
  return {
    ...base,
    ...overrides,
    limits: overrides.limits ? { ...base.limits, ...overrides.limits } : base.limits,
    stageOverrides: overrides.stageOverrides ? { ...base.stageOverrides, ...overrides.stageOverrides } : base.stageOverrides,
    agentOverrides: overrides.agentOverrides ? { ...base.agentOverrides, ...overrides.agentOverrides } : base.agentOverrides,
    gates: overrides.gates !== undefined ? overrides.gates : base.gates,
  };
}

/**
 * Factory function to create a semi-automatic configuration
 * Autonomous operation with review checkpoints at key stages (like commits)
 */
export function createSemiAutoConfig(overrides: Partial<AutonomyConfig> = {}): AutonomyConfig {
  const base = AutonomyFixturesEnhanced.semiAuto();
  return {
    ...base,
    ...overrides,
    limits: overrides.limits ? { ...base.limits, ...overrides.limits } : base.limits,
    stageOverrides: overrides.stageOverrides ? { ...base.stageOverrides, ...overrides.stageOverrides } : base.stageOverrides,
    agentOverrides: overrides.agentOverrides ? { ...base.agentOverrides, ...overrides.agentOverrides } : base.agentOverrides,
    gates: overrides.gates !== undefined ? overrides.gates : base.gates,
  };
}

/**
 * Factory function to create a manual configuration
 * Human oversight required for all major decisions and actions
 */
export function createManualConfig(overrides: Partial<AutonomyConfig> = {}): AutonomyConfig {
  const base = AutonomyFixturesEnhanced.manual();
  return {
    ...base,
    ...overrides,
    limits: overrides.limits ? { ...base.limits, ...overrides.limits } : base.limits,
    stageOverrides: overrides.stageOverrides ? { ...base.stageOverrides, ...overrides.stageOverrides } : base.stageOverrides,
    agentOverrides: overrides.agentOverrides ? { ...base.agentOverrides, ...overrides.agentOverrides } : base.agentOverrides,
    gates: overrides.gates !== undefined ? overrides.gates : base.gates,
  };
}

/**
 * Factory function to create a supervised configuration
 * Mix of autonomous and manual oversight with stage-specific controls
 */
export function createSupervisedConfig(overrides: Partial<AutonomyConfig> = {}): AutonomyConfig {
  const base = AutonomyFixturesEnhanced.supervised();
  return {
    ...base,
    ...overrides,
    limits: overrides.limits ? { ...base.limits, ...overrides.limits } : base.limits,
    stageOverrides: overrides.stageOverrides ? { ...base.stageOverrides, ...overrides.stageOverrides } : base.stageOverrides,
    agentOverrides: overrides.agentOverrides ? { ...base.agentOverrides, ...overrides.agentOverrides } : base.agentOverrides,
    gates: overrides.gates !== undefined ? overrides.gates : base.gates,
  };
}

/**
 * Factory function to create a restrictive configuration
 * High oversight with tight resource constraints and multiple approval gates
 */
export function createRestrictiveConfig(overrides: Partial<AutonomyConfig> = {}): AutonomyConfig {
  const base = AutonomyFixturesEnhanced.restrictive();
  return {
    ...base,
    ...overrides,
    limits: overrides.limits ? { ...base.limits, ...overrides.limits } : base.limits,
    stageOverrides: overrides.stageOverrides ? { ...base.stageOverrides, ...overrides.stageOverrides } : base.stageOverrides,
    agentOverrides: overrides.agentOverrides ? { ...base.agentOverrides, ...overrides.agentOverrides } : base.agentOverrides,
    gates: overrides.gates !== undefined ? overrides.gates : base.gates,
  };
}

/**
 * Factory function to create a permissive configuration
 * High autonomy with generous resource limits and minimal oversight
 */
export function createPermissiveConfig(overrides: Partial<AutonomyConfig> = {}): AutonomyConfig {
  const base = AutonomyFixturesEnhanced.permissive();
  return {
    ...base,
    ...overrides,
    limits: overrides.limits ? { ...base.limits, ...overrides.limits } : base.limits,
    stageOverrides: overrides.stageOverrides ? { ...base.stageOverrides, ...overrides.stageOverrides } : base.stageOverrides,
    agentOverrides: overrides.agentOverrides ? { ...base.agentOverrides, ...overrides.agentOverrides } : base.agentOverrides,
    gates: overrides.gates !== undefined ? overrides.gates : base.gates,
  };
}

/**
 * Factory function to create autonomy configurations for specific testing scenarios
 */
export function createTestingAutonomyConfig(
  scenario: 'fast' | 'comprehensive' | 'minimal' | 'isolated',
  overrides: Partial<AutonomyConfig> = {}
): AutonomyConfig {
  const baseConfigs = {
    fast: {
      level: 'full-auto' as AutonomyLevel,
      rejectionBehavior: 'abort' as RejectionBehavior,
      gates: [],
      limits: {
        maxTokensPerTask: 10000,
        maxCostPerTask: 0.50,
        timeoutMinutes: 5,
      },
      stageOverrides: {},
      agentOverrides: {},
    },
    comprehensive: {
      level: 'review-all' as AutonomyLevel,
      rejectionBehavior: 'skip' as RejectionBehavior,
      gates: [
        { type: 'planning' as const, description: 'Test planning review', required: true, stage: 'planning' },
        { type: 'code_change' as const, description: 'Test code review', required: true, stage: 'implementation' },
        { type: 'commit' as const, description: 'Test commit review', required: true, stage: 'implementation' },
        { type: 'deployment' as const, description: 'Test deployment review', required: true, stage: 'deployment' },
      ],
      limits: {
        maxTokensPerTask: 100000,
        maxCostPerTask: 2.0,
        timeoutMinutes: 30,
      },
      stageOverrides: {
        planning: 'review-all' as AutonomyLevel,
        implementation: 'review-all' as AutonomyLevel,
        testing: 'full-auto' as AutonomyLevel,
        deployment: 'review-all' as AutonomyLevel,
      },
      agentOverrides: {},
    },
    minimal: {
      level: 'full-auto' as AutonomyLevel,
      rejectionBehavior: 'abort' as RejectionBehavior,
      gates: [],
      limits: {
        maxTokensPerTask: 1000,
        maxCostPerTask: 0.10,
        timeoutMinutes: 2,
      },
      stageOverrides: {},
      agentOverrides: {},
    },
    isolated: {
      level: 'review-before-commit' as AutonomyLevel,
      rejectionBehavior: 'abort' as RejectionBehavior,
      gates: [
        { type: 'commit' as const, description: 'Isolated test commit review', required: true, stage: 'implementation' },
      ],
      limits: {
        maxTokensPerTask: 50000,
        maxCostPerTask: 1.0,
        timeoutMinutes: 15,
      },
      stageOverrides: {},
      agentOverrides: {},
    },
  };

  const base = baseConfigs[scenario];
  return {
    ...base,
    ...overrides,
    limits: overrides.limits ? { ...base.limits, ...overrides.limits } : base.limits,
    stageOverrides: overrides.stageOverrides ? { ...base.stageOverrides, ...overrides.stageOverrides } : base.stageOverrides,
    agentOverrides: overrides.agentOverrides ? { ...base.agentOverrides, ...overrides.agentOverrides } : base.agentOverrides,
    gates: overrides.gates !== undefined ? overrides.gates : base.gates,
  };
}

/**
 * Factory function to create a complete APEX config with enhanced autonomy settings
 */
export function createApexConfigWithEnhancedAutonomy(
  autonomyType: 'full-auto' | 'semi-auto' | 'manual' | 'supervised' | 'restrictive' | 'permissive',
  configOverrides: Partial<ApexConfig> = {}
): ApexConfig {
  const autonomyConfigs = {
    'full-auto': AutonomyFixturesEnhanced.fullAuto(),
    'semi-auto': AutonomyFixturesEnhanced.semiAuto(),
    'manual': AutonomyFixturesEnhanced.manual(),
    'supervised': AutonomyFixturesEnhanced.supervised(),
    'restrictive': AutonomyFixturesEnhanced.restrictive(),
    'permissive': AutonomyFixturesEnhanced.permissive(),
  };

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
    autonomy: autonomyConfigs[autonomyType],
    agents: {
      enabled: ['planner', 'architect', 'developer', 'tester', 'reviewer'],
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
      host: 'localhost',
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
 * Utility function to get all autonomy configuration variations for comprehensive testing
 */
export function getAllAutonomyConfigVariations(): Record<string, AutonomyConfig> {
  return {
    fullAuto: AutonomyFixturesEnhanced.fullAuto(),
    semiAuto: AutonomyFixturesEnhanced.semiAuto(),
    manual: AutonomyFixturesEnhanced.manual(),
    supervised: AutonomyFixturesEnhanced.supervised(),
    restrictive: AutonomyFixturesEnhanced.restrictive(),
    permissive: AutonomyFixturesEnhanced.permissive(),
    // Additional test scenarios
    testFast: createTestingAutonomyConfig('fast'),
    testComprehensive: createTestingAutonomyConfig('comprehensive'),
    testMinimal: createTestingAutonomyConfig('minimal'),
    testIsolated: createTestingAutonomyConfig('isolated'),
  };
}

/**
 * Utility function to validate autonomy config meets expected structure
 */
export function validateEnhancedAutonomyConfig(config: AutonomyConfig): boolean {
  try {
    return (
      typeof config.level === 'string' &&
      ['full-auto', 'review-before-commit', 'review-all'].includes(config.level) &&
      (config.rejectionBehavior === undefined || ['skip', 'abort'].includes(config.rejectionBehavior)) &&
      (config.gates === undefined || Array.isArray(config.gates)) &&
      (config.limits === undefined || typeof config.limits === 'object') &&
      (config.stageOverrides === undefined || typeof config.stageOverrides === 'object') &&
      (config.agentOverrides === undefined || typeof config.agentOverrides === 'object')
    );
  } catch {
    return false;
  }
}

/**
 * Create autonomy configs for A/B testing different levels of automation
 */
export function createAutonomyABTestConfigs(): {
  controlGroup: AutonomyConfig;
  testGroupA: AutonomyConfig;
  testGroupB: AutonomyConfig;
} {
  return {
    controlGroup: AutonomyFixturesEnhanced.semiAuto(),
    testGroupA: AutonomyFixturesEnhanced.fullAuto(),
    testGroupB: AutonomyFixturesEnhanced.manual(),
  };
}