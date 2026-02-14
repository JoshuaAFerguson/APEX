/**
 * @fileoverview Workflow definition fixture factories
 *
 * Provides factory functions for creating WorkflowDefinition, WorkflowStage, and WorkflowGate
 * fixtures with sensible defaults. Follows the established pattern from existing test helpers.
 */

import type {
  WorkflowDefinition,
  WorkflowStage,
  WorkflowGate,
  IsolationConfig,
} from '../../types.js';
import type { FixtureFactory } from '../types.js';

// ============================================================================
// Configuration Options Types
// ============================================================================

/**
 * Configuration options for workflow factory
 */
export interface WorkflowFactoryOptions {
  /** Include trigger events */
  includeTriggers?: boolean;
  /** Include workflow gates */
  includeGates?: boolean;
  /** Include isolation config */
  includeIsolation?: boolean;
  /** Number of stages to generate */
  stageCount?: number;
  /** Number of gates to generate */
  gateCount?: number;
  /** Workflow type for specialized workflows */
  workflowType?: 'feature' | 'hotfix' | 'bugfix' | 'enhancement' | 'refactor';
}

/**
 * Configuration options for workflow stage factory
 */
export interface StageFactoryOptions {
  /** Include dependency relationships */
  includeDependencies?: boolean;
  /** Include input/output definitions */
  includeInputsOutputs?: boolean;
  /** Include actions array */
  includeActions?: boolean;
  /** Include conditional expressions */
  includeConditions?: boolean;
  /** Include approval gates */
  includeGate?: boolean;
}

/**
 * Configuration options for workflow gate factory
 */
export interface GateFactoryOptions {
  /** Include approvers list */
  includeApprovers?: boolean;
  /** Include timeout settings */
  includeTimeout?: boolean;
  /** Include tags */
  includeTags?: boolean;
  /** Gate type for specialized gates */
  gateType?: 'approval' | 'quality' | 'security' | 'deployment';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates default trigger events
 */
function createDefaultTriggers(): string[] {
  return [
    'task:created',
    'workflow:manual',
    'git:push',
    'schedule:daily',
  ];
}

/**
 * Creates default isolation configuration
 */
function createDefaultIsolation(): IsolationConfig {
  return {
    mode: 'sandbox',
    preserveOnFailure: false,
    allowNetworkAccess: false,
    allowFileSystemAccess: true,
    resourceLimits: {
      maxMemoryMb: 512,
      maxCpuPercent: 50,
      maxExecutionTimeMs: 300000, // 5 minutes
    },
  };
}

// ============================================================================
// Workflow Gate Factory Functions
// ============================================================================

/**
 * Creates a WorkflowGate fixture with sensible defaults
 */
export const createWorkflowGate: FixtureFactory<WorkflowGate, GateFactoryOptions> = (
  overrides = {},
  options = {}
): WorkflowGate => {
  const gateId = `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const gate: WorkflowGate = {
    id: gateId,
    name: 'Test Workflow Gate',
    description: 'Test approval gate for workflow validation',
    trigger: 'stage:implementation:completed',
    required: true,
    autoApprove: false,
    ...overrides,
  };

  // Add optional components based on options
  if (options.includeApprovers !== false) {
    gate.approvers = ['team-lead', 'senior-developer', 'architect'];
  }

  if (options.includeTimeout !== false) {
    gate.timeout = 60; // 1 hour default
  }

  if (options.includeTags !== false) {
    gate.tags = ['quality-gate', 'manual-review'];
  }

  return gate;
};

/**
 * Creates an approval gate
 */
export const createApprovalGate: FixtureFactory<WorkflowGate> = (overrides = {}) =>
  createWorkflowGate({
    name: 'Approval Gate',
    description: 'Manual approval required before proceeding',
    trigger: 'stage:review:completed',
    required: true,
    autoApprove: false,
    ...overrides,
  }, {
    includeApprovers: true,
    includeTimeout: true,
    includeTags: true,
  });

/**
 * Creates a quality gate
 */
export const createQualityGate: FixtureFactory<WorkflowGate> = (overrides = {}) =>
  createWorkflowGate({
    name: 'Quality Gate',
    description: 'Automated quality checks and validation',
    trigger: 'stage:testing:completed',
    required: true,
    autoApprove: true,
    tags: ['quality-gate', 'automated'],
    ...overrides,
  });

/**
 * Creates a security gate
 */
export const createSecurityGate: FixtureFactory<WorkflowGate> = (overrides = {}) =>
  createWorkflowGate({
    name: 'Security Gate',
    description: 'Security review and vulnerability assessment',
    trigger: 'stage:implementation:completed',
    required: true,
    autoApprove: false,
    approvers: ['security-team', 'devops-lead'],
    timeout: 120, // 2 hours
    tags: ['security', 'compliance'],
    ...overrides,
  });

/**
 * Creates a deployment gate
 */
export const createDeploymentGate: FixtureFactory<WorkflowGate> = (overrides = {}) =>
  createWorkflowGate({
    name: 'Deployment Gate',
    description: 'Deployment approval and readiness check',
    trigger: 'stage:review:completed',
    required: true,
    autoApprove: false,
    approvers: ['devops-team', 'release-manager'],
    timeout: 30, // 30 minutes
    tags: ['deployment', 'production-ready'],
    ...overrides,
  });

// ============================================================================
// Workflow Stage Factory Functions
// ============================================================================

/**
 * Creates a WorkflowStage fixture with sensible defaults
 */
export const createWorkflowStage: FixtureFactory<WorkflowStage, StageFactoryOptions> = (
  overrides = {},
  options = {}
): WorkflowStage => {
  const stageId = `stage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const stage: WorkflowStage = {
    name: `test-stage-${stageId}`,
    agent: 'developer',
    description: 'Test workflow stage for automated execution',
    parallel: false,
    maxRetries: 2,
    ...overrides,
  };

  // Add optional components based on options
  if (options.includeDependencies) {
    stage.dependsOn = ['planning'];
  }

  if (options.includeInputsOutputs) {
    stage.inputs = ['requirements', 'design-doc'];
    stage.outputs = ['implementation', 'test-results'];
  }

  if (options.includeActions) {
    stage.actions = [
      'analyze-requirements',
      'create-implementation-plan',
      'write-code',
      'run-tests',
    ];
  }

  if (options.includeConditions) {
    stage.condition = 'requirements.approved && design.ready';
  }

  if (options.includeGate) {
    stage.gate = `${stage.name}-approval-gate`;
  }

  return stage;
};

/**
 * Creates a planning stage
 */
export const createPlanningStage: FixtureFactory<WorkflowStage> = (overrides = {}) =>
  createWorkflowStage({
    name: 'planning',
    agent: 'planner',
    description: 'Analyze requirements and create implementation plan',
    inputs: ['requirements', 'acceptance-criteria'],
    outputs: ['implementation-plan', 'task-breakdown'],
    actions: [
      'analyze-requirements',
      'identify-dependencies',
      'create-task-breakdown',
      'estimate-effort',
    ],
    ...overrides,
  });

/**
 * Creates an architecture stage
 */
export const createArchitectureStage: FixtureFactory<WorkflowStage> = (overrides = {}) =>
  createWorkflowStage({
    name: 'architecture',
    agent: 'architect',
    description: 'Design system architecture and technical approach',
    dependsOn: ['planning'],
    inputs: ['implementation-plan', 'requirements'],
    outputs: ['architecture-design', 'technical-specs'],
    actions: [
      'design-system-architecture',
      'define-api-contracts',
      'identify-patterns',
      'create-technical-specs',
    ],
    ...overrides,
  });

/**
 * Creates an implementation stage
 */
export const createImplementationStage: FixtureFactory<WorkflowStage> = (overrides = {}) =>
  createWorkflowStage({
    name: 'implementation',
    agent: 'developer',
    description: 'Implement features and write production code',
    dependsOn: ['architecture'],
    inputs: ['architecture-design', 'technical-specs'],
    outputs: ['code-changes', 'implementation-notes'],
    actions: [
      'implement-features',
      'write-unit-tests',
      'document-changes',
      'commit-changes',
    ],
    gate: 'pre-commit-review',
    ...overrides,
  });

/**
 * Creates a testing stage
 */
export const createTestingStage: FixtureFactory<WorkflowStage> = (overrides = {}) =>
  createWorkflowStage({
    name: 'testing',
    agent: 'tester',
    description: 'Run comprehensive tests and quality assurance',
    dependsOn: ['implementation'],
    inputs: ['code-changes', 'test-requirements'],
    outputs: ['test-results', 'quality-report'],
    actions: [
      'run-unit-tests',
      'run-integration-tests',
      'perform-quality-checks',
      'generate-coverage-report',
    ],
    ...overrides,
  });

/**
 * Creates a review stage
 */
export const createReviewStage: FixtureFactory<WorkflowStage> = (overrides = {}) =>
  createWorkflowStage({
    name: 'review',
    agent: 'reviewer',
    description: 'Code review and quality validation',
    dependsOn: ['testing'],
    inputs: ['code-changes', 'test-results'],
    outputs: ['review-feedback', 'approval-status'],
    actions: [
      'review-code-changes',
      'check-best-practices',
      'validate-security',
      'approve-changes',
    ],
    gate: 'final-approval',
    ...overrides,
  });

/**
 * Creates a deployment stage
 */
export const createDeploymentStage: FixtureFactory<WorkflowStage> = (overrides = {}) =>
  createWorkflowStage({
    name: 'deployment',
    agent: 'devops',
    description: 'Deploy changes to target environment',
    dependsOn: ['review'],
    inputs: ['approved-changes', 'deployment-config'],
    outputs: ['deployment-status', 'environment-urls'],
    actions: [
      'prepare-deployment',
      'run-deployment-tests',
      'deploy-to-staging',
      'validate-deployment',
    ],
    gate: 'deployment-approval',
    ...overrides,
  });

// ============================================================================
// Workflow Definition Factory Functions
// ============================================================================

/**
 * Creates a WorkflowDefinition fixture with sensible defaults
 */
export const createWorkflowDefinition: FixtureFactory<WorkflowDefinition, WorkflowFactoryOptions> = (
  overrides = {},
  options = {}
): WorkflowDefinition => {
  const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create default stages
  const defaultStages: WorkflowStage[] = [
    createPlanningStage(),
    createArchitectureStage(),
    createImplementationStage(),
    createTestingStage(),
    createReviewStage(),
  ];

  const workflow: WorkflowDefinition = {
    name: `test-workflow-${workflowId}`,
    description: 'Test workflow for automated software development',
    stages: defaultStages.slice(0, options.stageCount || 5),
    ...overrides,
  };

  // Add optional components based on options
  if (options.includeTriggers !== false) {
    workflow.trigger = createDefaultTriggers();
  }

  if (options.includeGates) {
    const gates: WorkflowGate[] = [
      createApprovalGate({ id: 'pre-commit-review' }),
      createQualityGate({ id: 'quality-check' }),
    ];
    workflow.gates = gates.slice(0, options.gateCount || 2);
  }

  if (options.includeIsolation) {
    workflow.isolation = createDefaultIsolation();
  }

  return workflow;
};

/**
 * Creates a feature development workflow
 */
export const createFeatureWorkflow: FixtureFactory<WorkflowDefinition> = (overrides = {}) =>
  createWorkflowDefinition({
    name: 'feature-development',
    description: 'Complete workflow for developing new features',
    stages: [
      createPlanningStage(),
      createArchitectureStage(),
      createImplementationStage(),
      createTestingStage(),
      createReviewStage(),
      createDeploymentStage(),
    ],
    ...overrides,
  }, {
    includeTriggers: true,
    includeGates: true,
    includeIsolation: true,
  });

/**
 * Creates a hotfix workflow
 */
export const createHotfixWorkflow: FixtureFactory<WorkflowDefinition> = (overrides = {}) =>
  createWorkflowDefinition({
    name: 'hotfix',
    description: 'Rapid workflow for critical bug fixes',
    trigger: ['incident:critical', 'bug:severity-high'],
    stages: [
      createImplementationStage({ name: 'hotfix-implementation' }),
      createTestingStage({ name: 'hotfix-testing' }),
      createDeploymentStage({ name: 'hotfix-deployment' }),
    ],
    gates: [
      createSecurityGate({ id: 'hotfix-security-check' }),
      createDeploymentGate({ id: 'hotfix-deployment-approval' }),
    ],
    ...overrides,
  });

/**
 * Creates a bugfix workflow
 */
export const createBugfixWorkflow: FixtureFactory<WorkflowDefinition> = (overrides = {}) =>
  createWorkflowDefinition({
    name: 'bugfix',
    description: 'Workflow for addressing bugs and issues',
    stages: [
      createPlanningStage({ name: 'bug-analysis' }),
      createImplementationStage({ name: 'bug-fix' }),
      createTestingStage({ name: 'bug-verification' }),
      createReviewStage(),
    ],
    ...overrides,
  }, {
    includeTriggers: true,
    includeGates: true,
  });

/**
 * Creates an enhancement workflow
 */
export const createEnhancementWorkflow: FixtureFactory<WorkflowDefinition> = (overrides = {}) =>
  createWorkflowDefinition({
    name: 'enhancement',
    description: 'Workflow for improving existing functionality',
    stages: [
      createPlanningStage({ name: 'enhancement-planning' }),
      createImplementationStage({ name: 'enhancement-implementation' }),
      createTestingStage({ name: 'enhancement-testing' }),
      createReviewStage(),
    ],
    ...overrides,
  });

/**
 * Creates a refactoring workflow
 */
export const createRefactorWorkflow: FixtureFactory<WorkflowDefinition> = (overrides = {}) =>
  createWorkflowDefinition({
    name: 'refactor',
    description: 'Workflow for code refactoring and improvements',
    stages: [
      createPlanningStage({ name: 'refactor-planning' }),
      createArchitectureStage({ name: 'refactor-design' }),
      createImplementationStage({ name: 'refactor-implementation' }),
      createTestingStage({ name: 'refactor-testing' }),
      createReviewStage(),
    ],
    ...overrides,
  });

// ============================================================================
// Specialized Workflow Factory Functions
// ============================================================================

/**
 * Creates a minimal workflow for testing
 */
export const createMinimalWorkflow: FixtureFactory<WorkflowDefinition> = (overrides = {}) =>
  createWorkflowDefinition({
    name: 'minimal-workflow',
    description: 'Minimal workflow for basic testing',
    stages: [createImplementationStage()],
    ...overrides,
  }, {
    includeTriggers: false,
    includeGates: false,
    includeIsolation: false,
  });

/**
 * Creates a parallel execution workflow
 */
export const createParallelWorkflow: FixtureFactory<WorkflowDefinition> = (overrides = {}) =>
  createWorkflowDefinition({
    name: 'parallel-workflow',
    description: 'Workflow with parallel stage execution',
    stages: [
      createPlanningStage(),
      createImplementationStage({ parallel: true }),
      createTestingStage({ parallel: true }),
      createReviewStage(),
    ],
    ...overrides,
  });

// ============================================================================
// Workflow Preset Collections
// ============================================================================

/**
 * Workflow preset collections for common testing scenarios
 */
export const WorkflowPresets = {
  /** Standard workflow types */
  types: {
    feature: () => createFeatureWorkflow(),
    hotfix: () => createHotfixWorkflow(),
    bugfix: () => createBugfixWorkflow(),
    enhancement: () => createEnhancementWorkflow(),
    refactor: () => createRefactorWorkflow(),
  },

  /** Workflows with different complexity levels */
  complexity: {
    minimal: () => createMinimalWorkflow(),
    simple: () => createWorkflowDefinition({}, { stageCount: 3 }),
    standard: () => createWorkflowDefinition(),
    comprehensive: () => createFeatureWorkflow(),
  },

  /** Workflows with different execution patterns */
  execution: {
    sequential: () => createWorkflowDefinition(),
    parallel: () => createParallelWorkflow(),
    gated: () => createWorkflowDefinition({}, { includeGates: true, gateCount: 3 }),
  },

  /** Stage collections */
  stages: {
    planning: () => createPlanningStage(),
    architecture: () => createArchitectureStage(),
    implementation: () => createImplementationStage(),
    testing: () => createTestingStage(),
    review: () => createReviewStage(),
    deployment: () => createDeploymentStage(),
  },

  /** Gate collections */
  gates: {
    approval: () => createApprovalGate(),
    quality: () => createQualityGate(),
    security: () => createSecurityGate(),
    deployment: () => createDeploymentGate(),
  },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a collection of all standard workflow types
 */
export function createWorkflowTypeCollection(): Record<string, WorkflowDefinition> {
  return {
    feature: createFeatureWorkflow(),
    hotfix: createHotfixWorkflow(),
    bugfix: createBugfixWorkflow(),
    enhancement: createEnhancementWorkflow(),
    refactor: createRefactorWorkflow(),
  };
}

/**
 * Creates a collection of standard workflow stages
 */
export function createWorkflowStageCollection(): WorkflowStage[] {
  return [
    createPlanningStage(),
    createArchitectureStage(),
    createImplementationStage(),
    createTestingStage(),
    createReviewStage(),
    createDeploymentStage(),
  ];
}

/**
 * Creates workflow variants for A/B testing
 */
export function createWorkflowVariants(): {
  control: WorkflowDefinition;
  experimental: WorkflowDefinition;
} {
  return {
    control: createFeatureWorkflow(),
    experimental: createFeatureWorkflow({
      stages: [
        createPlanningStage(),
        createImplementationStage({ parallel: true }),
        createTestingStage({ parallel: true }),
        createReviewStage(),
      ],
    }),
  };
}

/**
 * Validates that a workflow definition has the expected structure
 */
export function validateWorkflowDefinition(workflow: WorkflowDefinition): boolean {
  return !!(
    workflow.name &&
    workflow.description &&
    workflow.stages &&
    workflow.stages.length > 0 &&
    workflow.stages.every(stage => stage.name && stage.agent)
  );
}

/**
 * Validates that a workflow stage has the expected structure
 */
export function validateWorkflowStage(stage: WorkflowStage): boolean {
  return !!(
    stage.name &&
    stage.agent
  );
}

/**
 * Validates that a workflow gate has the expected structure
 */
export function validateWorkflowGate(gate: WorkflowGate): boolean {
  return !!(
    gate.id &&
    gate.trigger &&
    typeof gate.required === 'boolean' &&
    typeof gate.autoApprove === 'boolean'
  );
}