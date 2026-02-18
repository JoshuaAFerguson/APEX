/**
 * @fileoverview Autonomy configuration fixture factories
 *
 * Provides factory functions for creating autonomy-related fixtures with sensible defaults.
 * Follows the established pattern from existing test helpers like task-factory.ts.
 */

import type {
  AutonomyLevel,
  AutonomyConfig,
  AgentAutonomyOverride,
  ApprovalGate,
  TaskResourceLimits,
  RejectionBehavior,
} from '../../types.js';
import type { FixtureFactory } from '../types.js';

// ============================================================================
// Configuration Options Types
// ============================================================================

/**
 * Configuration options for autonomy config factory
 */
export interface AutonomyConfigFactoryOptions {
  /** Include approval gates */
  includeGates?: boolean;
  /** Include resource limits */
  includeLimits?: boolean;
  /** Include stage overrides */
  includeStageOverrides?: boolean;
  /** Include agent overrides */
  includeAgentOverrides?: boolean;
  /** Specific autonomy level to use */
  level?: AutonomyLevel;
  /** Number of approval gates to generate */
  gateCount?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates default approval gates
 */
function createDefaultApprovalGates(count: number = 2): ApprovalGate[] {
  const gates: ApprovalGate[] = [
    {
      id: 'pre-commit-review',
      name: 'Pre-commit Review',
      description: 'Review changes before committing to repository',
      stage: 'implementation',
      type: 'manual',
      timeout: 30,
      required: true,
      conditions: ['code-changes'],
    },
  ];

  if (count > 1) {
    gates.push({
      id: 'deployment-approval',
      name: 'Deployment Approval',
      description: 'Approve deployment of changes to production',
      stage: 'deployment',
      type: 'manual',
      timeout: 15,
      required: true,
      conditions: ['deploy-ready'],
    });
  }

  if (count > 2) {
    gates.push({
      id: 'security-review',
      name: 'Security Review',
      description: 'Security review for sensitive changes',
      stage: 'review',
      type: 'manual',
      timeout: 60,
      required: false,
      conditions: ['security-sensitive'],
    });
  }

  return gates.slice(0, count);
}

/**
 * Creates default resource limits
 */
function createDefaultResourceLimits(): TaskResourceLimits {
  return {
    maxDuration: 60, // 60 minutes
    maxTokens: 100000,
    maxCost: 10.00,
    maxRetries: 3,
    maxFileSize: 10485760, // 10MB
    maxFiles: 100,
  };
}

/**
 * Creates default stage overrides
 */
function createDefaultStageOverrides(): Record<string, AutonomyLevel> {
  return {
    'planning': 'full-auto',
    'implementation': 'review-before-commit',
    'testing': 'full-auto',
    'deployment': 'review-all',
  };
}

/**
 * Creates default agent overrides
 */
function createDefaultAgentOverrides(): Record<string, AutonomyLevel | AgentAutonomyOverride> {
  return {
    'planner': 'full-auto',
    'developer': {
      level: 'review-before-commit',
      approvalTimeout: 30,
      rejectionBehavior: 'skip',
    },
    'tester': 'full-auto',
    'reviewer': 'review-all',
  };
}

// ============================================================================
// Core Factory Functions
// ============================================================================

/**
 * Creates an AutonomyConfig fixture with sensible defaults
 *
 * @param overrides - Partial AutonomyConfig properties to override defaults
 * @param options - Additional factory options
 * @returns A fully-typed AutonomyConfig object
 *
 * @example
 * ```typescript
 * const config = createAutonomyConfig({
 *   level: 'full-auto'
 * });
 * expect(config.level).toBe('full-auto');
 * ```
 */
export const createAutonomyConfig: FixtureFactory<AutonomyConfig, AutonomyConfigFactoryOptions> = (
  overrides = {},
  options = {}
): AutonomyConfig => {
  const config: AutonomyConfig = {
    level: options.level || 'review-before-commit',
    rejectionBehavior: 'abort' as RejectionBehavior,
    ...overrides,
  };

  // Add optional components based on options
  if (options.includeGates !== false) {
    config.gates = createDefaultApprovalGates(options.gateCount || 2);
  }

  if (options.includeLimits !== false) {
    config.limits = createDefaultResourceLimits();
  }

  if (options.includeStageOverrides) {
    config.stageOverrides = createDefaultStageOverrides();
  }

  if (options.includeAgentOverrides) {
    config.agentOverrides = createDefaultAgentOverrides();
  }

  // Set approval timeout if not provided and gates are included
  if (config.gates && !config.approvalTimeout) {
    config.approvalTimeout = 45;
  }

  return config;
};

/**
 * Creates an AgentAutonomyOverride fixture
 */
export const createAgentAutonomyOverride: FixtureFactory<AgentAutonomyOverride> = (
  overrides = {}
) => ({
  level: 'review-before-commit',
  approvalTimeout: 30,
  rejectionBehavior: 'skip' as RejectionBehavior,
  ...overrides,
});

/**
 * Creates an ApprovalGate fixture
 */
export const createApprovalGate: FixtureFactory<ApprovalGate> = (
  overrides = {}
) => ({
  id: `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Approval Gate',
  description: 'Test approval gate for validation',
  stage: 'implementation',
  type: 'manual',
  timeout: 30,
  required: true,
  conditions: ['test-condition'],
  ...overrides,
});

/**
 * Creates TaskResourceLimits fixture
 */
export const createResourceLimits: FixtureFactory<TaskResourceLimits> = (
  overrides = {}
) => ({
  maxDuration: 60,
  maxTokens: 100000,
  maxCost: 10.00,
  maxRetries: 3,
  maxFileSize: 10485760, // 10MB
  maxFiles: 100,
  ...overrides,
});

// ============================================================================
// Autonomy Level Specific Factory Functions
// ============================================================================

/**
 * Creates a full-auto autonomy configuration
 */
export const createFullAutoConfig: FixtureFactory<AutonomyConfig> = (overrides = {}) =>
  createAutonomyConfig({
    level: 'full-auto',
    gates: [], // No approval gates for full automation
    rejectionBehavior: 'abort' as RejectionBehavior,
    ...overrides,
  }, {
    includeGates: false,
    includeLimits: true,
  });

/**
 * Creates a review-before-commit autonomy configuration
 */
export const createReviewBeforeCommitConfig: FixtureFactory<AutonomyConfig> = (overrides = {}) =>
  createAutonomyConfig({
    level: 'review-before-commit',
    ...overrides,
  }, {
    includeGates: true,
    includeLimits: true,
    gateCount: 1,
  });

/**
 * Creates a review-all autonomy configuration
 */
export const createReviewAllConfig: FixtureFactory<AutonomyConfig> = (overrides = {}) =>
  createAutonomyConfig({
    level: 'review-all',
    ...overrides,
  }, {
    includeGates: true,
    includeLimits: true,
    includeStageOverrides: true,
    includeAgentOverrides: true,
    gateCount: 3,
  });

// ============================================================================
// Specialized Configurations
// ============================================================================

/**
 * Creates autonomy config for testing scenarios
 */
export const createTestAutonomyConfig: FixtureFactory<AutonomyConfig> = (overrides = {}) =>
  createAutonomyConfig({
    level: 'full-auto',
    limits: {
      maxDuration: 5, // Short duration for tests
      maxTokens: 1000,
      maxCost: 0.50,
      maxRetries: 1,
      maxFileSize: 1048576, // 1MB
      maxFiles: 10,
    },
    approvalTimeout: 5, // Quick timeouts for tests
    ...overrides,
  }, {
    includeGates: false,
    includeLimits: true,
  });

/**
 * Creates autonomy config with restrictive limits
 */
export const createRestrictiveConfig: FixtureFactory<AutonomyConfig> = (overrides = {}) =>
  createAutonomyConfig({
    level: 'review-all',
    limits: {
      maxDuration: 10,
      maxTokens: 10000,
      maxCost: 1.00,
      maxRetries: 1,
      maxFileSize: 1048576, // 1MB
      maxFiles: 5,
    },
    ...overrides,
  }, {
    includeGates: true,
    includeLimits: true,
    includeStageOverrides: true,
    includeAgentOverrides: true,
    gateCount: 3,
  });

/**
 * Creates autonomy config with permissive limits
 */
export const createPermissiveConfig: FixtureFactory<AutonomyConfig> = (overrides = {}) =>
  createAutonomyConfig({
    level: 'full-auto',
    limits: {
      maxDuration: 240, // 4 hours
      maxTokens: 1000000,
      maxCost: 100.00,
      maxRetries: 10,
      maxFileSize: 104857600, // 100MB
      maxFiles: 1000,
    },
    ...overrides,
  }, {
    includeGates: false,
    includeLimits: true,
  });

// ============================================================================
// Preset Collections
// ============================================================================

/**
 * Autonomy configuration preset collections for common testing scenarios
 */
export const AutonomyPresets = {
  /** Basic autonomy level configurations */
  basic: {
    fullAuto: () => createFullAutoConfig(),
    reviewBeforeCommit: () => createReviewBeforeCommitConfig(),
    reviewAll: () => createReviewAllConfig(),
  },

  /** Configurations with different resource constraints */
  resources: {
    restrictive: () => createRestrictiveConfig(),
    permissive: () => createPermissiveConfig(),
    test: () => createTestAutonomyConfig(),
  },

  /** Configurations for specific testing scenarios */
  testing: {
    minimal: () => createAutonomyConfig({
      level: 'full-auto',
    }, { includeGates: false, includeLimits: false }),

    withGates: () => createAutonomyConfig({
      level: 'review-before-commit',
    }, { includeGates: true, gateCount: 2 }),

    withOverrides: () => createAutonomyConfig({
      level: 'review-all',
    }, {
      includeStageOverrides: true,
      includeAgentOverrides: true,
    }),

    complete: () => createAutonomyConfig({
      level: 'review-before-commit',
    }, {
      includeGates: true,
      includeLimits: true,
      includeStageOverrides: true,
      includeAgentOverrides: true,
      gateCount: 2,
    }),
  },

  /** Configurations for different workflow stages */
  stages: {
    planning: () => createAutonomyConfig({
      level: 'full-auto',
      stageOverrides: { 'planning': 'full-auto' },
    }),

    implementation: () => createAutonomyConfig({
      level: 'review-before-commit',
      stageOverrides: { 'implementation': 'review-before-commit' },
    }),

    deployment: () => createAutonomyConfig({
      level: 'review-all',
      stageOverrides: { 'deployment': 'review-all' },
    }),
  },

  /** Configurations for different agent types */
  agents: {
    developer: () => createAutonomyConfig({
      level: 'review-before-commit',
      agentOverrides: {
        'developer': {
          level: 'review-before-commit',
          approvalTimeout: 30,
          rejectionBehavior: 'skip' as RejectionBehavior,
        },
      },
    }),

    tester: () => createAutonomyConfig({
      level: 'full-auto',
      agentOverrides: {
        'tester': 'full-auto',
      },
    }),

    reviewer: () => createAutonomyConfig({
      level: 'review-all',
      agentOverrides: {
        'reviewer': 'review-all',
      },
    }),
  },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a collection of autonomy configs with all possible autonomy levels
 */
export function createAutonomyLevelCollection(): Record<AutonomyLevel, AutonomyConfig> {
  return {
    'full-auto': createFullAutoConfig(),
    'review-before-commit': createReviewBeforeCommitConfig(),
    'review-all': createReviewAllConfig(),
  };
}

/**
 * Creates autonomy configs for A/B testing scenarios
 */
export function createAutonomyVariants(): {
  control: AutonomyConfig;
  experimental: AutonomyConfig;
} {
  return {
    control: createReviewBeforeCommitConfig(),
    experimental: createFullAutoConfig({
      limits: createRestrictiveConfig().limits,
    }),
  };
}

/**
 * Validates that an autonomy config has the expected structure
 */
export function validateAutonomyConfig(config: AutonomyConfig): boolean {
  return !!(
    config.level &&
    config.rejectionBehavior &&
    (config.level === 'full-auto' || config.gates || config.approvalTimeout)
  );
}