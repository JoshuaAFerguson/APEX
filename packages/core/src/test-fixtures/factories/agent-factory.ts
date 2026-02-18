/**
 * @fileoverview Agent definition fixture factories
 *
 * Provides factory functions for creating AgentDefinition fixtures with sensible defaults.
 * Follows the established pattern from existing test helpers.
 */

import type {
  AgentDefinition,
  AgentModel,
} from '../../types.js';
import type { FixtureFactory } from '../types.js';

// ============================================================================
// Configuration Options Types
// ============================================================================

/**
 * Configuration options for agent factory
 */
export interface AgentFactoryOptions {
  /** Include tools array */
  includeTools?: boolean;
  /** Include skills array */
  includeSkills?: boolean;
  /** Specific model to use */
  model?: AgentModel;
  /** Number of tools to generate */
  toolCount?: number;
  /** Number of skills to generate */
  skillCount?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates default tools array for agents
 */
function createDefaultTools(count: number = 5): string[] {
  const availableTools = [
    'Read', 'Write', 'Edit', 'Glob', 'Grep',
    'Bash', 'WebFetch', 'WebSearch', 'EnterPlanMode',
    'ExitPlanMode', 'AskUserQuestion', 'TodoWrite'
  ];

  return availableTools.slice(0, count);
}

/**
 * Creates default skills array for agents
 */
function createDefaultSkills(count: number = 3): string[] {
  const availableSkills = [
    'code-analysis', 'debugging', 'testing', 'documentation',
    'architecture-design', 'performance-optimization', 'security-review',
    'api-integration', 'database-design', 'ui-ux-design'
  ];

  return availableSkills.slice(0, count);
}

// ============================================================================
// Core Factory Functions
// ============================================================================

/**
 * Creates an AgentDefinition fixture with sensible defaults
 *
 * @param overrides - Partial AgentDefinition properties to override defaults
 * @param options - Additional factory options
 * @returns A fully-typed AgentDefinition object
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   name: 'custom-agent',
 *   description: 'Custom agent description'
 * });
 * expect(agent.name).toBe('custom-agent');
 * expect(agent.model).toBe('sonnet');
 * ```
 */
export const createAgent: FixtureFactory<AgentDefinition, AgentFactoryOptions> = (
  overrides = {},
  options = {}
): AgentDefinition => {
  const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const agent: AgentDefinition = {
    name: `test-agent-${agentId}`,
    description: 'Test agent for automated testing and development tasks',
    prompt: 'You are a test agent designed to help with software development tasks. Follow the user\'s instructions carefully and provide clear, actionable responses.',
    model: options.model || 'sonnet',
    ...overrides,
  };

  // Add optional components based on options
  if (options.includeTools !== false) {
    agent.tools = createDefaultTools(options.toolCount || 5);
  }

  if (options.includeSkills !== false) {
    agent.skills = createDefaultSkills(options.skillCount || 3);
  }

  return agent;
};

// ============================================================================
// Agent Role Specific Factory Functions
// ============================================================================

/**
 * Creates a planner agent definition
 */
export const createPlannerAgent: FixtureFactory<AgentDefinition> = (overrides = {}) =>
  createAgent({
    name: 'planner',
    description: 'Planning agent responsible for breaking down tasks and creating implementation strategies',
    prompt: 'You are the **planner** agent responsible for the **planning** stage of task execution. Your role is to analyze requirements, break down complex tasks, and create detailed implementation plans.',
    tools: ['Read', 'Glob', 'Grep', 'EnterPlanMode', 'ExitPlanMode', 'AskUserQuestion', 'TodoWrite'],
    skills: ['task-decomposition', 'requirement-analysis', 'project-planning'],
    ...overrides,
  });

/**
 * Creates an architect agent definition
 */
export const createArchitectAgent: FixtureFactory<AgentDefinition> = (overrides = {}) =>
  createAgent({
    name: 'architect',
    description: 'Architecture agent responsible for system design and technical architecture decisions',
    prompt: 'You are the **architect** agent responsible for the **architecture** stage of task execution. Your role is to design system architecture, define technical approaches, and ensure scalability and maintainability.',
    tools: ['Read', 'Glob', 'Grep', 'Write', 'EnterPlanMode', 'ExitPlanMode', 'AskUserQuestion'],
    skills: ['system-architecture', 'design-patterns', 'scalability-design', 'api-design'],
    ...overrides,
  });

/**
 * Creates a developer agent definition
 */
export const createDeveloperAgent: FixtureFactory<AgentDefinition> = (overrides = {}) =>
  createAgent({
    name: 'developer',
    description: 'Development agent responsible for implementing features and writing production code',
    prompt: 'You are the **developer** agent responsible for the **implementation** stage of task execution. Your role is to write clean, efficient code and implement the planned features.',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'AskUserQuestion'],
    skills: ['coding', 'debugging', 'performance-optimization', 'testing'],
    model: 'sonnet',
    ...overrides,
  });

/**
 * Creates a tester agent definition
 */
export const createTesterAgent: FixtureFactory<AgentDefinition> = (overrides = {}) =>
  createAgent({
    name: 'tester',
    description: 'Testing agent responsible for writing and executing tests to ensure code quality',
    prompt: 'You are the **tester** agent responsible for the **testing** stage of task execution. Your role is to create comprehensive tests, validate functionality, and ensure code quality.',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    skills: ['test-automation', 'quality-assurance', 'debugging', 'performance-testing'],
    ...overrides,
  });

/**
 * Creates a reviewer agent definition
 */
export const createReviewerAgent: FixtureFactory<AgentDefinition> = (overrides = {}) =>
  createAgent({
    name: 'reviewer',
    description: 'Review agent responsible for code review, quality assurance, and best practices enforcement',
    prompt: 'You are the **reviewer** agent responsible for the **review** stage of task execution. Your role is to review code changes, ensure quality standards, and provide constructive feedback.',
    tools: ['Read', 'Glob', 'Grep', 'AskUserQuestion', 'WebSearch'],
    skills: ['code-review', 'security-review', 'best-practices', 'documentation-review'],
    ...overrides,
  });

/**
 * Creates a devops agent definition
 */
export const createDevOpsAgent: FixtureFactory<AgentDefinition> = (overrides = {}) =>
  createAgent({
    name: 'devops',
    description: 'DevOps agent responsible for deployment, infrastructure, and CI/CD pipeline management',
    prompt: 'You are the **devops** agent responsible for the **deployment** stage of task execution. Your role is to handle deployments, manage infrastructure, and ensure smooth CI/CD operations.',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'WebFetch', 'Glob'],
    skills: ['ci-cd', 'deployment-automation', 'infrastructure-management', 'monitoring'],
    ...overrides,
  });

// ============================================================================
// Specialized Agent Factory Functions
// ============================================================================

/**
 * Creates an agent with minimal configuration for testing
 */
export const createMinimalAgent: FixtureFactory<AgentDefinition> = (overrides = {}) =>
  createAgent({
    name: 'minimal-agent',
    description: 'Minimal agent configuration for basic testing',
    prompt: 'You are a minimal test agent.',
    ...overrides,
  }, {
    includeTools: false,
    includeSkills: false,
  });

/**
 * Creates an agent with full capabilities
 */
export const createFullFeaturedAgent: FixtureFactory<AgentDefinition> = (overrides = {}) =>
  createAgent({
    name: 'full-featured-agent',
    description: 'Agent with comprehensive toolset and capabilities for advanced tasks',
    prompt: 'You are a full-featured agent with access to all available tools and capabilities. Handle complex tasks with precision and efficiency.',
    ...overrides,
  }, {
    includeTools: true,
    includeSkills: true,
    toolCount: 12,
    skillCount: 8,
  });

/**
 * Creates an agent with specific model configuration
 */
export const createModelSpecificAgent = (model: AgentModel, overrides: Partial<AgentDefinition> = {}): AgentDefinition =>
  createAgent({
    name: `${model}-agent`,
    description: `Agent configured to use the ${model} model`,
    model,
    ...overrides,
  });

// ============================================================================
// Agent Preset Collections
// ============================================================================

/**
 * Agent preset collections for common testing scenarios
 */
export const AgentPresets = {
  /** Standard workflow agents */
  workflow: {
    planner: () => createPlannerAgent(),
    architect: () => createArchitectAgent(),
    developer: () => createDeveloperAgent(),
    tester: () => createTesterAgent(),
    reviewer: () => createReviewerAgent(),
    devops: () => createDevOpsAgent(),
  },

  /** Agents with different model configurations */
  models: {
    opus: () => createModelSpecificAgent('opus'),
    sonnet: () => createModelSpecificAgent('sonnet'),
    haiku: () => createModelSpecificAgent('haiku'),
    inherit: () => createModelSpecificAgent('inherit'),
  },

  /** Agents with different capability levels */
  capabilities: {
    minimal: () => createMinimalAgent(),
    basic: () => createAgent({}, { includeTools: true, includeSkills: false }),
    standard: () => createAgent(),
    advanced: () => createFullFeaturedAgent(),
  },

  /** Specialized agents for specific scenarios */
  specialized: {
    frontend: () => createAgent({
      name: 'frontend-specialist',
      description: 'Frontend development specialist',
      skills: ['ui-ux-design', 'javascript', 'css', 'react'],
      tools: ['Read', 'Write', 'Edit', 'WebFetch'],
    }),

    backend: () => createAgent({
      name: 'backend-specialist',
      description: 'Backend development specialist',
      skills: ['api-development', 'database-design', 'server-architecture'],
      tools: ['Read', 'Write', 'Edit', 'Bash', 'WebFetch'],
    }),

    security: () => createAgent({
      name: 'security-specialist',
      description: 'Security and vulnerability assessment specialist',
      skills: ['security-review', 'vulnerability-assessment', 'penetration-testing'],
      tools: ['Read', 'Grep', 'Bash', 'WebSearch'],
    }),

    performance: () => createAgent({
      name: 'performance-specialist',
      description: 'Performance optimization and monitoring specialist',
      skills: ['performance-optimization', 'profiling', 'monitoring', 'scalability'],
      tools: ['Read', 'Bash', 'Grep', 'WebSearch'],
    }),
  },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a collection of all standard workflow agents
 */
export function createWorkflowAgentCollection(): Record<string, AgentDefinition> {
  return {
    planner: createPlannerAgent(),
    architect: createArchitectAgent(),
    developer: createDeveloperAgent(),
    tester: createTesterAgent(),
    reviewer: createReviewerAgent(),
    devops: createDevOpsAgent(),
  };
}

/**
 * Creates agents for A/B testing scenarios
 */
export function createAgentVariants(): {
  control: AgentDefinition;
  experimental: AgentDefinition;
} {
  return {
    control: createDeveloperAgent(),
    experimental: createDeveloperAgent({
      model: 'opus',
      skills: ['coding', 'debugging', 'performance-optimization', 'testing', 'ai-assisted-development'],
    }),
  };
}

/**
 * Validates that an agent definition has the expected structure
 */
export function validateAgentDefinition(agent: AgentDefinition): boolean {
  return !!(
    agent.name &&
    agent.description &&
    agent.prompt &&
    agent.model
  );
}