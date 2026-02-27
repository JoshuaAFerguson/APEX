/**
 * @fileoverview Configuration fixture factories
 *
 * Provides factory functions for creating configuration-related fixtures including
 * complete project configurations with autonomy, permissions, and workflow settings.
 */

import type {
  ProjectConfig,
  AutonomyConfig,
  AutonomyLevel,
  PermissionLevel,
  RejectionBehavior,
  TaskResourceLimits,
  AgentDefinition,
  WorkflowDefinition,
  ApprovalGate,
} from '../../types.js';
import type { FixtureFactory } from '../types.js';

/**
 * Extended project config for test fixtures that includes additional fields
 * beyond what the base ProjectConfig schema requires.
 */
interface ExtendedProjectConfig extends ProjectConfig {
  description?: string;
  autonomy?: AutonomyConfig;
  agents?: Record<string, AgentDefinition>;
  workflows?: Record<string, WorkflowDefinition>;
}
import {
  createAutonomyConfig,
  createFullAutoConfig,
  createReviewBeforeCommitConfig,
  createReviewAllConfig,
} from './autonomy-factory.js';

// ============================================================================
// Configuration Factory Options
// ============================================================================

/**
 * Configuration options for project config factory
 */
export interface ProjectConfigFactoryOptions {
  /** Include autonomy configuration */
  includeAutonomy?: boolean;
  /** Include workflow definitions */
  includeWorkflows?: boolean;
  /** Include agent definitions */
  includeAgents?: boolean;
  /** Include permission presets */
  includePermissions?: boolean;
  /** Default autonomy level for the project */
  defaultAutonomyLevel?: AutonomyLevel;
  /** Number of agents to include */
  agentCount?: number;
  /** Number of workflows to include */
  workflowCount?: number;
}

/**
 * Options for permission configuration factory
 */
export interface PermissionConfigFactoryOptions {
  /** Default permission level */
  defaultLevel?: PermissionLevel;
  /** Include tool-specific permissions */
  includeToolPermissions?: boolean;
  /** Include scope-specific permissions */
  includeScopePermissions?: boolean;
  /** Number of tool permissions to create */
  toolPermissionCount?: number;
  /** Number of scope permissions to create */
  scopePermissionCount?: number;
}

// ============================================================================
// Core Configuration Factory Functions
// ============================================================================

/**
 * Creates a complete ProjectConfig fixture with sensible defaults
 *
 * @param overrides - Partial ProjectConfig properties to override defaults
 * @param options - Additional factory options
 * @returns A fully-typed ProjectConfig object
 *
 * @example
 * ```typescript
 * const config = createProjectConfig({
 *   name: 'test-project'
 * }, {
 *   includeAutonomy: true,
 *   defaultAutonomyLevel: 'review-before-commit'
 * });
 * ```
 */
export const createProjectConfig: FixtureFactory<ExtendedProjectConfig, ProjectConfigFactoryOptions> = (
  overrides = {},
  options = {}
): ExtendedProjectConfig => {
  const {
    includeAutonomy = true,
    includeWorkflows = true,
    includeAgents = true,
    includePermissions = false,
    defaultAutonomyLevel = 'review-before-commit',
    agentCount = 3,
    workflowCount = 2,
  } = options;

  const config: ExtendedProjectConfig = {
    name: 'test-project',
    description: 'Test project configuration',
    ...overrides,
  };

  // Add autonomy configuration if requested
  if (includeAutonomy) {
    config.autonomy = createAutonomyConfig({}, {
      level: defaultAutonomyLevel,
      includeGates: defaultAutonomyLevel !== 'full-auto',
      includeLimits: true,
      includeStageOverrides: defaultAutonomyLevel === 'review-all',
      includeAgentOverrides: defaultAutonomyLevel !== 'full-auto',
    });
  }

  // Add agent definitions if requested
  if (includeAgents) {
    config.agents = createDefaultAgents(agentCount);
  }

  // Add workflow definitions if requested
  if (includeWorkflows) {
    config.workflows = createDefaultWorkflows(workflowCount);
  }

  return config;
};

/**
 * Creates autonomy-permission integration configurations
 */
export const createIntegratedConfig: FixtureFactory<ExtendedProjectConfig> = (overrides = {}) => {
  return createProjectConfig({
    name: 'integrated-test-project',
    description: 'Test project with integrated autonomy and permissions',
    ...overrides,
  }, {
    includeAutonomy: true,
    includePermissions: true,
    includeAgents: true,
    includeWorkflows: true,
    defaultAutonomyLevel: 'review-before-commit',
  });
};

// ============================================================================
// Autonomy-Level Specific Configurations
// ============================================================================

/**
 * Creates a project config optimized for full automation
 */
export const createFullAutoProjectConfig: FixtureFactory<ExtendedProjectConfig> = (overrides = {}) =>
  createProjectConfig({
    name: 'full-auto-project',
    description: 'Fully autonomous project configuration',
    autonomy: createFullAutoConfig(),
    ...overrides,
  }, {
    defaultAutonomyLevel: 'full-auto',
    includePermissions: false, // Full auto typically has broad permissions
  });

/**
 * Creates a project config with review-before-commit autonomy
 */
export const createReviewBeforeCommitProjectConfig: FixtureFactory<ExtendedProjectConfig> = (overrides = {}) =>
  createProjectConfig({
    name: 'review-before-commit-project',
    description: 'Project with review-before-commit autonomy',
    autonomy: createReviewBeforeCommitConfig(),
    ...overrides,
  }, {
    defaultAutonomyLevel: 'review-before-commit',
    includePermissions: true,
  });

/**
 * Creates a project config with maximum review requirements
 */
export const createReviewAllProjectConfig: FixtureFactory<ExtendedProjectConfig> = (overrides = {}) =>
  createProjectConfig({
    name: 'review-all-project',
    description: 'Project with review-all autonomy level',
    autonomy: createReviewAllConfig(),
    ...overrides,
  }, {
    defaultAutonomyLevel: 'review-all',
    includePermissions: true,
    includeAgents: true,
    includeWorkflows: true,
  });

// ============================================================================
// Development Stage Specific Configurations
// ============================================================================

/**
 * Creates configurations for different development stages
 */
export const createStageSpecificConfigs = () => ({
  development: createProjectConfig({
    name: 'dev-environment',
    autonomy: createAutonomyConfig({
      level: 'full-auto',
      stageOverrides: {
        'planning': 'full-auto',
        'implementation': 'review-before-commit',
        'testing': 'full-auto',
        'deployment': 'review-all',
      },
    }),
  }),

  staging: createProjectConfig({
    name: 'staging-environment',
    autonomy: createAutonomyConfig({
      level: 'review-before-commit',
      stageOverrides: {
        'planning': 'full-auto',
        'implementation': 'review-before-commit',
        'testing': 'review-before-commit',
        'deployment': 'review-all',
      },
    }),
  }),

  production: createProjectConfig({
    name: 'production-environment',
    autonomy: createAutonomyConfig({
      level: 'review-all',
      stageOverrides: {
        'planning': 'review-before-commit',
        'implementation': 'review-all',
        'testing': 'review-all',
        'deployment': 'review-all',
      },
    }),
  }),
});

// ============================================================================
// Resource-Constrained Configurations
// ============================================================================

/**
 * Creates configurations with different resource constraints
 */
export const createResourceConstrainedConfigs = () => ({
  lowResource: createProjectConfig({
    name: 'low-resource-project',
    autonomy: createAutonomyConfig({
      level: 'review-before-commit',
      limits: {
        maxTimeMs: 900000, // 15 minutes
        maxTokens: 10000,
        maxCost: 1.00,
        maxFilesCreated: 10,
      },
    }),
  }),

  mediumResource: createProjectConfig({
    name: 'medium-resource-project',
    autonomy: createAutonomyConfig({
      level: 'review-before-commit',
      limits: {
        maxTimeMs: 3600000, // 1 hour
        maxTokens: 100000,
        maxCost: 10.00,
        maxFilesCreated: 100,
      },
    }),
  }),

  highResource: createProjectConfig({
    name: 'high-resource-project',
    autonomy: createAutonomyConfig({
      level: 'full-auto',
      limits: {
        maxTimeMs: 14400000, // 4 hours
        maxTokens: 1000000,
        maxCost: 100.00,
        maxFilesCreated: 1000,
      },
    }),
  }),
});

// ============================================================================
// Agent-Specific Configurations
// ============================================================================

/**
 * Creates configurations with different agent autonomy overrides
 */
export const createAgentSpecificConfigs = () => ({
  developerFocused: createProjectConfig({
    name: 'developer-focused-project',
    autonomy: createAutonomyConfig({
      level: 'review-all',
      agentOverrides: {
        'developer': {
          level: 'review-before-commit',
          approvalTimeout: 60,
          rejectionBehavior: 'skip' as RejectionBehavior,
        },
        'tester': {
          level: 'full-auto',
          approvalTimeout: 0,
          rejectionBehavior: 'skip' as RejectionBehavior,
        },
        'reviewer': {
          level: 'review-all',
          approvalTimeout: 120,
          rejectionBehavior: 'abort' as RejectionBehavior,
        },
      },
    }),
  }),

  testerFocused: createProjectConfig({
    name: 'tester-focused-project',
    autonomy: createAutonomyConfig({
      level: 'review-before-commit',
      agentOverrides: {
        'tester': {
          level: 'full-auto',
          approvalTimeout: 0,
          rejectionBehavior: 'skip' as RejectionBehavior,
        },
        'developer': {
          level: 'review-before-commit',
          approvalTimeout: 30,
          rejectionBehavior: 'skip' as RejectionBehavior,
        },
      },
    }),
  }),

  reviewerFocused: createProjectConfig({
    name: 'reviewer-focused-project',
    autonomy: createAutonomyConfig({
      level: 'full-auto',
      agentOverrides: {
        'reviewer': {
          level: 'review-all',
          approvalTimeout: 180,
          rejectionBehavior: 'abort' as RejectionBehavior,
        },
        'developer': {
          level: 'full-auto',
          approvalTimeout: 0,
          rejectionBehavior: 'skip' as RejectionBehavior,
        },
        'tester': {
          level: 'full-auto',
          approvalTimeout: 0,
          rejectionBehavior: 'skip' as RejectionBehavior,
        },
      },
    }),
  }),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates default agent definitions for testing
 */
function createDefaultAgents(count: number = 3): Record<string, AgentDefinition> {
  const agents: Record<string, AgentDefinition> = {};

  if (count >= 1) {
    agents.developer = {
      name: 'developer',
      description: 'Writes and maintains code',
      prompt: 'You are a senior software developer. Write clean, efficient code.',
      model: 'sonnet',
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep'],
    };
  }

  if (count >= 2) {
    agents.tester = {
      name: 'tester',
      description: 'Tests code and ensures quality',
      prompt: 'You are a QA engineer. Write comprehensive tests.',
      model: 'haiku',
      tools: ['Read', 'Write', 'Bash'],
    };
  }

  if (count >= 3) {
    agents.reviewer = {
      name: 'reviewer',
      description: 'Reviews code for quality and security',
      prompt: 'You are a code reviewer. Ensure code quality and security.',
      model: 'sonnet',
      tools: ['Read', 'Grep'],
    };
  }

  return agents;
}

/**
 * Creates default workflow definitions for testing
 */
function createDefaultWorkflows(count: number = 2): Record<string, WorkflowDefinition> {
  const workflows: Record<string, WorkflowDefinition> = {};

  if (count >= 1) {
    workflows.feature = {
      name: 'feature',
      description: 'Standard feature development workflow',
      stages: [
        {
          name: 'planning',
          description: 'Plan the feature implementation',
          agent: 'developer',
        },
        {
          name: 'implementation',
          description: 'Implement the feature',
          agent: 'developer',
          dependsOn: ['planning'],
        },
        {
          name: 'testing',
          description: 'Test the implementation',
          agent: 'tester',
          dependsOn: ['implementation'],
        },
        {
          name: 'review',
          description: 'Review the implementation',
          agent: 'reviewer',
          dependsOn: ['testing'],
        },
      ],
    };
  }

  if (count >= 2) {
    workflows.bugfix = {
      name: 'bugfix',
      description: 'Bug fixing workflow',
      stages: [
        {
          name: 'investigation',
          description: 'Investigate the bug',
          agent: 'developer',
        },
        {
          name: 'fix',
          description: 'Implement the fix',
          agent: 'developer',
          dependsOn: ['investigation'],
        },
        {
          name: 'testing',
          description: 'Test the fix',
          agent: 'tester',
          dependsOn: ['fix'],
        },
      ],
    };
  }

  return workflows;
}

// ============================================================================
// Configuration Preset Collections
// ============================================================================

/**
 * Configuration preset collections for common testing scenarios
 */
export const ConfigPresets = {
  /** Basic project configurations */
  basic: {
    minimal: () => createProjectConfig({}, {
      includeAutonomy: false,
      includeAgents: false,
      includeWorkflows: false
    }),
    standard: () => createProjectConfig(),
    complete: () => createProjectConfig({}, {
      includeAutonomy: true,
      includeAgents: true,
      includeWorkflows: true,
      includePermissions: true,
    }),
  },

  /** Autonomy level specific configurations */
  autonomy: {
    fullAuto: () => createFullAutoProjectConfig(),
    reviewBeforeCommit: () => createReviewBeforeCommitProjectConfig(),
    reviewAll: () => createReviewAllProjectConfig(),
  },

  /** Development environment configurations */
  environments: createStageSpecificConfigs,

  /** Resource-constrained configurations */
  resources: createResourceConstrainedConfigs,

  /** Agent-focused configurations */
  agents: createAgentSpecificConfigs,

  /** Testing-specific configurations */
  testing: {
    unitTest: () => createProjectConfig({
      name: 'unit-test-project',
      autonomy: createAutonomyConfig({
        level: 'full-auto',
        limits: {
          maxTimeMs: 300000, // 5 minutes
          maxTokens: 1000,
          maxCost: 0.10,
          maxFilesCreated: 5,
        },
      }),
    }),

    integration: () => createProjectConfig({
      name: 'integration-test-project',
      autonomy: createAutonomyConfig({
        level: 'review-before-commit',
        limits: {
          maxTimeMs: 900000, // 15 minutes
          maxTokens: 10000,
          maxCost: 1.00,
          maxFilesCreated: 20,
        },
      }),
    }),

    e2e: () => createProjectConfig({
      name: 'e2e-test-project',
      autonomy: createAutonomyConfig({
        level: 'review-all',
        limits: {
          maxTimeMs: 1800000, // 30 minutes
          maxTokens: 50000,
          maxCost: 5.00,
          maxFilesCreated: 50,
        },
      }),
    }),
  },
} as const;

// ============================================================================
// Validation and Utility Functions
// ============================================================================

/**
 * Validates that a project config has the expected structure
 */
export function validateProjectConfig(config: ProjectConfig): boolean {
  return !!(
    config.name &&
    typeof config.name === 'string' &&
    config.name.length > 0
  );
}

/**
 * Creates a collection of project configs with all autonomy levels
 */
export function createAutonomyProjectCollection(): Record<AutonomyLevel, ExtendedProjectConfig> {
  return {
    'full-auto': createFullAutoProjectConfig(),
    'review-before-commit': createReviewBeforeCommitProjectConfig(),
    'review-all': createReviewAllProjectConfig(),
  };
}

/**
 * Creates project configs for A/B testing different autonomy approaches
 */
export function createAutonomyComparisonConfigs(): {
  conservative: ExtendedProjectConfig;
  moderate: ExtendedProjectConfig;
  aggressive: ExtendedProjectConfig;
} {
  return {
    conservative: createReviewAllProjectConfig({
      name: 'conservative-project',
    }),
    moderate: createReviewBeforeCommitProjectConfig({
      name: 'moderate-project',
    }),
    aggressive: createFullAutoProjectConfig({
      name: 'aggressive-project',
    }),
  };
}