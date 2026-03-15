/**
 * Workflow Factory - Mock factories for Workflow and related domain types
 */

import type {
  WorkflowDefinition,
  WorkflowStage,
  WorkflowGate,
  IsolationConfig,
} from '../types.js';

// ============================================================================
// Workflow Gate Factory
// ============================================================================

export interface WorkflowGateOverrides {
  id?: string;
  name?: string;
  description?: string;
  trigger?: string;
  required?: boolean;
  autoApprove?: boolean;
  approvers?: string[];
  timeout?: number;
  tags?: string[];
}

/**
 * Creates a mock WorkflowGate for testing approval and checkpoint logic
 */
export function createWorkflowGate(overrides: WorkflowGateOverrides = {}): WorkflowGate {
  const defaults: WorkflowGate = {
    id: `gate_${Date.now()}`,
    name: 'Code Review Gate',
    description: 'Code review required before production deployment',
    trigger: 'stage:implementation:completed',
    required: true,
    autoApprove: false,
    approvers: ['tech-lead@company.com', 'senior-dev@company.com'],
    timeout: 60, // 60 minutes
    tags: ['quality-gate'],
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Workflow Stage Factory
// ============================================================================

export interface WorkflowStageOverrides {
  name?: string;
  agent?: string;
  description?: string;
  dependsOn?: string[];
  parallel?: boolean;
  inputs?: string[];
  outputs?: string[];
  condition?: string;
  actions?: string[];
  gate?: string | null;
  maxRetries?: number;
}

/**
 * Creates a mock WorkflowStage with realistic default values
 */
export function createWorkflowStage(overrides: WorkflowStageOverrides = {}): WorkflowStage {
  const defaults: WorkflowStage = {
    name: 'implementation',
    agent: 'developer',
    description: 'Implement the requested feature according to specifications',
    dependsOn: ['planning'],
    parallel: false,
    maxRetries: 2,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Isolation Config Factory
// ============================================================================

export interface IsolationConfigOverrides {
  mode?: 'full' | 'worktree' | 'shared';
  cleanupOnComplete?: boolean;
  preserveOnFailure?: boolean;
}

/**
 * Creates a mock IsolationConfig for testing sandboxed execution
 */
export function createIsolationConfig(overrides: IsolationConfigOverrides = {}): IsolationConfig {
  const defaults: IsolationConfig = {
    mode: 'worktree',
    cleanupOnComplete: true,
    preserveOnFailure: false,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Workflow Definition Factory
// ============================================================================

export interface WorkflowDefinitionOverrides {
  name?: string;
  description?: string;
  trigger?: string[];
  stages?: WorkflowStage[];
  gates?: WorkflowGate[];
  isolation?: IsolationConfig;
}

/**
 * Creates a mock WorkflowDefinition with realistic default values
 *
 * @param overrides - Partial workflow properties to override defaults
 * @returns Complete WorkflowDefinition object with valid type-safe properties
 *
 * @example
 * ```typescript
 * // Create workflow with defaults
 * const workflow = createWorkflow();
 *
 * // Create custom workflow
 * const customWorkflow = createWorkflow({
 *   name: 'api-development',
 *   description: 'Develops REST API endpoints',
 *   stages: [
 *     createWorkflowStage({ name: 'planning', agent: 'planner' }),
 *     createWorkflowStage({ name: 'implementation', agent: 'developer' }),
 *   ]
 * });
 * ```
 */
export function createWorkflow(overrides: WorkflowDefinitionOverrides = {}): WorkflowDefinition {
  const defaults: WorkflowDefinition = {
    name: 'feature-development',
    description: 'Complete feature development workflow from planning to deployment',
    trigger: ['api-change', 'feature-request'],
    stages: [
      createWorkflowStage({
        name: 'planning',
        agent: 'planner',
        description: 'Analyze requirements and create implementation plan',
        dependsOn: [],
      }),
      createWorkflowStage({
        name: 'architecture',
        agent: 'architect',
        description: 'Design system architecture and technical approach',
        dependsOn: ['planning'],
      }),
      createWorkflowStage({
        name: 'implementation',
        agent: 'developer',
        description: 'Implement the feature according to specifications',
        dependsOn: ['architecture'],
      }),
      createWorkflowStage({
        name: 'testing',
        agent: 'tester',
        description: 'Create and run comprehensive tests',
        dependsOn: ['implementation'],
      }),
      createWorkflowStage({
        name: 'review',
        agent: 'reviewer',
        description: 'Review code for quality and security',
        dependsOn: ['testing'],
        gate: 'approval-gate',
      }),
      createWorkflowStage({
        name: 'deployment',
        agent: 'devops',
        description: 'Deploy the feature to production',
        dependsOn: ['review'],
        gate: 'deployment-gate',
      }),
    ],
    gates: [
      createWorkflowGate({ id: 'approval-gate', name: 'Approval Gate', trigger: 'stage:review:completed' }),
      createWorkflowGate({ id: 'deployment-gate', name: 'Deployment Gate', trigger: 'stage:deployment:started' }),
    ],
    isolation: createIsolationConfig(),
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Specialized Workflow Factories
// ============================================================================

/**
 * Creates a simple code-only workflow for quick changes
 */
export function createCodeOnlyWorkflow(overrides: WorkflowDefinitionOverrides = {}): WorkflowDefinition {
  return createWorkflow({
    name: 'code-only',
    description: 'Simple workflow for quick code changes without full review process',
    stages: [
      createWorkflowStage({
        name: 'implementation',
        agent: 'developer',
        dependsOn: [],
      }),
      createWorkflowStage({
        name: 'testing',
        agent: 'tester',
        dependsOn: ['implementation'],
      }),
    ],
    gates: [],
    ...overrides,
  });
}

/**
 * Creates a research-focused workflow for investigation tasks
 */
export function createResearchWorkflow(overrides: WorkflowDefinitionOverrides = {}): WorkflowDefinition {
  return createWorkflow({
    name: 'research',
    description: 'Research workflow for investigating technologies and solutions',
    stages: [
      createWorkflowStage({
        name: 'investigation',
        agent: 'researcher',
        description: 'Research the topic and gather information',
        dependsOn: [],
      }),
      createWorkflowStage({
        name: 'analysis',
        agent: 'analyst',
        description: 'Analyze findings and create recommendations',
        dependsOn: ['investigation'],
      }),
      createWorkflowStage({
        name: 'documentation',
        agent: 'technical-writer',
        description: 'Document research findings and recommendations',
        dependsOn: ['analysis'],
      }),
    ],
    gates: [],
    ...overrides,
  });
}

/**
 * Creates a bug-fix workflow optimized for addressing issues
 */
export function createBugFixWorkflow(overrides: WorkflowDefinitionOverrides = {}): WorkflowDefinition {
  return createWorkflow({
    name: 'bug-fix',
    description: 'Workflow for investigating and fixing bugs',
    stages: [
      createWorkflowStage({
        name: 'diagnosis',
        agent: 'debugger',
        description: 'Investigate and diagnose the bug',
        dependsOn: [],
      }),
      createWorkflowStage({
        name: 'fix',
        agent: 'developer',
        description: 'Implement the bug fix',
        dependsOn: ['diagnosis'],
      }),
      createWorkflowStage({
        name: 'verification',
        agent: 'tester',
        description: 'Verify the fix works and doesn\'t break anything',
        dependsOn: ['fix'],
      }),
    ],
    gates: [],
    ...overrides,
  });
}

// ============================================================================
// Workflow Collections
// ============================================================================

/**
 * Creates a standard set of workflows for common scenarios
 */
export function createStandardWorkflows(): {
  feature: WorkflowDefinition;
  bugfix: WorkflowDefinition;
  research: WorkflowDefinition;
  codeOnly: WorkflowDefinition;
} {
  return {
    feature: createWorkflow(),
    bugfix: createBugFixWorkflow(),
    research: createResearchWorkflow(),
    codeOnly: createCodeOnlyWorkflow(),
  };
}

/**
 * Creates multiple workflows with different complexities
 */
export function createWorkflows(count: number, baseOverrides: WorkflowDefinitionOverrides = {}): WorkflowDefinition[] {
  const templates = [
    { name: 'simple', stageCount: 2 },
    { name: 'standard', stageCount: 4 },
    { name: 'complex', stageCount: 6 },
    { name: 'enterprise', stageCount: 8 },
  ];

  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];

    // Generate stages based on template
    const stages = Array.from({ length: template.stageCount }, (_, stageIndex) => {
      const stageNames = ['planning', 'implementation', 'testing', 'review', 'security-scan', 'deployment', 'monitoring', 'cleanup'];
      return createWorkflowStage({
        name: stageNames[stageIndex] || `stage-${stageIndex + 1}`,
        agent: `agent-${stageIndex + 1}`,
        dependsOn: stageIndex > 0 ? [stageNames[stageIndex - 1] || `stage-${stageIndex}`] : [],
      });
    });

    return createWorkflow({
      ...baseOverrides,
      name: `${template.name}-workflow-${index + 1}`,
      description: `${template.name} workflow with ${template.stageCount} stages`,
      stages,
    });
  });
}

/**
 * Creates a workflow execution simulation with progress tracking
 */
export function createWorkflowExecution(workflow: WorkflowDefinition) {
  const startTime = new Date();
  let currentStageIndex = 0;
  const stageResults: Array<{
    stage: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    output?: any;
    error?: string;
  }> = workflow.stages.map(stage => ({
    stage: stage.name,
    status: 'pending',
  }));

  return {
    workflow,
    startTime,
    currentStage: workflow.stages[0]?.name,
    stageResults,

    // Simulation methods
    nextStage: () => {
      if (currentStageIndex < workflow.stages.length - 1) {
        stageResults[currentStageIndex].status = 'completed';
        stageResults[currentStageIndex].endTime = new Date();
        currentStageIndex++;
        stageResults[currentStageIndex].status = 'running';
        stageResults[currentStageIndex].startTime = new Date();
        return workflow.stages[currentStageIndex];
      }
      return null;
    },

    failCurrentStage: (error: string) => {
      stageResults[currentStageIndex].status = 'failed';
      stageResults[currentStageIndex].error = error;
      stageResults[currentStageIndex].endTime = new Date();
    },

    completeExecution: () => {
      stageResults[currentStageIndex].status = 'completed';
      stageResults[currentStageIndex].endTime = new Date();
      return {
        success: true,
        duration: new Date().getTime() - startTime.getTime(),
        results: stageResults,
      };
    },

    getProgress: () => {
      const completed = stageResults.filter(r => r.status === 'completed').length;
      return completed / workflow.stages.length;
    },
  };
}