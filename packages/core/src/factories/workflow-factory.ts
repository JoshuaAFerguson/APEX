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
  type?: 'approval' | 'checkpoint' | 'condition';
  condition?: string;
  timeout?: number;
  approvers?: string[];
  autoApprove?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a mock WorkflowGate for testing approval and checkpoint logic
 */
export function createWorkflowGate(overrides: WorkflowGateOverrides = {}): WorkflowGate {
  const defaults: WorkflowGate = {
    type: 'approval',
    condition: 'stage.success && coverage >= 80',
    timeout: 3600000, // 1 hour in milliseconds
    approvers: ['tech-lead@company.com', 'senior-dev@company.com'],
    autoApprove: false,
    metadata: {
      description: 'Code review required before production deployment',
      severity: 'high',
      category: 'quality-gate',
    },
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
  optional?: boolean;
  retryable?: boolean;
  maxRetries?: number;
  timeout?: number;
  onFailure?: 'stop' | 'continue' | 'retry';
  gates?: WorkflowGate[];
  tools?: string[];
  environment?: Record<string, string>;
  metadata?: Record<string, unknown>;
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
    optional: false,
    retryable: true,
    maxRetries: 3,
    timeout: 1800000, // 30 minutes
    onFailure: 'stop',
    gates: [],
    tools: ['Read', 'Write', 'Edit', 'Bash'],
    environment: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
    },
    metadata: {
      category: 'development',
      estimatedDuration: 900000, // 15 minutes
      requiredSkills: ['typescript', 'testing'],
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Isolation Config Factory
// ============================================================================

export interface IsolationConfigOverrides {
  enabled?: boolean;
  type?: 'process' | 'container' | 'vm';
  resources?: {
    cpu?: number;
    memory?: string;
    storage?: string;
  };
  network?: {
    isolated?: boolean;
    allowedHosts?: string[];
    ports?: number[];
  };
  filesystem?: {
    readOnly?: string[];
    writable?: string[];
    mount?: Record<string, string>;
  };
}

/**
 * Creates a mock IsolationConfig for testing sandboxed execution
 */
export function createIsolationConfig(overrides: IsolationConfigOverrides = {}): IsolationConfig {
  const defaults: IsolationConfig = {
    enabled: true,
    type: 'container',
    resources: {
      cpu: 2,
      memory: '4Gi',
      storage: '10Gi',
    },
    network: {
      isolated: true,
      allowedHosts: ['api.github.com', 'registry.npmjs.org'],
      ports: [3000, 8080],
    },
    filesystem: {
      readOnly: ['/usr', '/lib', '/bin'],
      writable: ['/tmp', '/workspace'],
      mount: {
        '/workspace': '/host/project',
        '/tmp': '/host/tmp',
      },
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Workflow Definition Factory
// ============================================================================

export interface WorkflowDefinitionOverrides {
  name?: string;
  description?: string;
  version?: string;
  stages?: WorkflowStage[];
  defaultAgent?: string;
  isolation?: IsolationConfig;
  timeout?: number;
  retryPolicy?: {
    maxAttempts?: number;
    backoffStrategy?: 'linear' | 'exponential' | 'fixed';
    baseDelay?: number;
  };
  triggers?: string[];
  outputs?: string[];
  metadata?: Record<string, unknown>;
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
    version: '1.0.0',
    stages: [
      createWorkflowStage({
        name: 'planning',
        agent: 'planner',
        description: 'Analyze requirements and create implementation plan',
        dependsOn: [],
        tools: ['Read', 'Grep', 'WebSearch'],
      }),
      createWorkflowStage({
        name: 'architecture',
        agent: 'architect',
        description: 'Design system architecture and technical approach',
        dependsOn: ['planning'],
        tools: ['Read', 'Write', 'Grep'],
      }),
      createWorkflowStage({
        name: 'implementation',
        agent: 'developer',
        description: 'Implement the feature according to specifications',
        dependsOn: ['architecture'],
        tools: ['Read', 'Write', 'Edit', 'Bash', 'LSP'],
      }),
      createWorkflowStage({
        name: 'testing',
        agent: 'tester',
        description: 'Create and run comprehensive tests',
        dependsOn: ['implementation'],
        tools: ['Read', 'Write', 'Edit', 'Bash'],
      }),
      createWorkflowStage({
        name: 'review',
        agent: 'reviewer',
        description: 'Review code for quality and security',
        dependsOn: ['testing'],
        tools: ['Read', 'Grep'],
        gates: [createWorkflowGate({ type: 'approval' })],
      }),
      createWorkflowStage({
        name: 'deployment',
        agent: 'devops',
        description: 'Deploy the feature to production',
        dependsOn: ['review'],
        tools: ['Bash', 'Read'],
        gates: [createWorkflowGate({ type: 'checkpoint' })],
      }),
    ],
    defaultAgent: 'developer',
    isolation: createIsolationConfig(),
    timeout: 3600000, // 1 hour
    retryPolicy: {
      maxAttempts: 3,
      backoffStrategy: 'exponential',
      baseDelay: 1000,
    },
    triggers: ['api-change', 'feature-request'],
    outputs: ['code-changes', 'test-results', 'deployment-artifacts'],
    metadata: {
      category: 'development',
      complexity: 'medium',
      estimatedDuration: 2700000, // 45 minutes
      requiredTools: ['Read', 'Write', 'Edit', 'Bash'],
    },
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
        tools: ['Read', 'Write', 'Edit'],
      }),
      createWorkflowStage({
        name: 'testing',
        agent: 'tester',
        dependsOn: ['implementation'],
        tools: ['Bash', 'Read'],
      }),
    ],
    timeout: 900000, // 15 minutes
    metadata: {
      category: 'development',
      complexity: 'low',
      estimatedDuration: 600000, // 10 minutes
    },
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
        tools: ['WebSearch', 'WebFetch', 'Read', 'Grep'],
      }),
      createWorkflowStage({
        name: 'analysis',
        agent: 'analyst',
        description: 'Analyze findings and create recommendations',
        dependsOn: ['investigation'],
        tools: ['Read', 'Write'],
      }),
      createWorkflowStage({
        name: 'documentation',
        agent: 'technical-writer',
        description: 'Document research findings and recommendations',
        dependsOn: ['analysis'],
        tools: ['Write', 'Edit'],
      }),
    ],
    timeout: 1800000, // 30 minutes
    metadata: {
      category: 'research',
      complexity: 'medium',
      estimatedDuration: 1200000, // 20 minutes
    },
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
        tools: ['Read', 'Grep', 'Bash'],
      }),
      createWorkflowStage({
        name: 'fix',
        agent: 'developer',
        description: 'Implement the bug fix',
        dependsOn: ['diagnosis'],
        tools: ['Read', 'Write', 'Edit'],
      }),
      createWorkflowStage({
        name: 'verification',
        agent: 'tester',
        description: 'Verify the fix works and doesn\'t break anything',
        dependsOn: ['fix'],
        tools: ['Bash', 'Read'],
      }),
    ],
    timeout: 1800000, // 30 minutes
    retryPolicy: {
      maxAttempts: 2, // Bugs might need multiple attempts
      backoffStrategy: 'linear',
      baseDelay: 2000,
    },
    metadata: {
      category: 'maintenance',
      complexity: 'variable',
      priority: 'high',
    },
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
      metadata: {
        template: template.name,
        complexity: template.stageCount <= 2 ? 'low' : template.stageCount <= 4 ? 'medium' : 'high',
      },
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