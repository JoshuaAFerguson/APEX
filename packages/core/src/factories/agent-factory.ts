/**
 * Agent Factory - Mock factories for Agent and related domain types
 */

import type {
  AgentDefinition,
  AgentModel,
  AgentTool,
  AgentMessage,
  AgentAutonomyOverride,
} from '../types.js';

// ============================================================================
// Agent Definition Factory
// ============================================================================

export interface AgentDefinitionOverrides {
  name?: string;
  description?: string;
  prompt?: string;
  tools?: string[];
  model?: AgentModel;
  skills?: string[];
}

/**
 * Creates a mock AgentDefinition with realistic default values
 *
 * @param overrides - Partial agent properties to override defaults
 * @returns Complete AgentDefinition object with valid type-safe properties
 *
 * @example
 * ```typescript
 * // Create agent with defaults
 * const agent = createAgent();
 *
 * // Create custom agent
 * const customAgent = createAgent({
 *   name: 'code-reviewer',
 *   description: 'Reviews code for quality and security',
 *   tools: ['Read', 'Write', 'Grep'],
 *   skills: ['security', 'performance']
 * });
 * ```
 */
export function createAgent(overrides: AgentDefinitionOverrides = {}): AgentDefinition {
  const defaults: AgentDefinition = {
    name: 'developer',
    description: 'A software developer agent that can write, read, and modify code files',
    prompt: `You are a senior software developer working on the APEX project.
Your role is to implement features according to specifications while following best practices.

Key responsibilities:
- Write clean, maintainable code
- Follow project conventions and patterns
- Write comprehensive tests
- Document your implementation decisions
- Handle errors gracefully

When implementing features:
1. Analyze the requirements thoroughly
2. Plan your approach before coding
3. Write tests first when possible
4. Implement the solution step by step
5. Verify your implementation works correctly`,
    tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash'],
    model: 'sonnet',
    skills: ['typescript', 'javascript', 'react', 'node.js', 'testing'],
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Agent Message Factory
// ============================================================================

export interface AgentMessageOverrides {
  role?: 'user' | 'assistant';
  content?: string;
  timestamp?: Date;
  agent?: string;
  stage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a mock AgentMessage for conversation tracking
 */
export function createAgentMessage(overrides: AgentMessageOverrides = {}): AgentMessage {
  const defaults: AgentMessage = {
    role: 'assistant',
    content: 'I understand the requirements and will begin implementation.',
    timestamp: new Date(),
    agent: 'developer',
    stage: 'implementation',
    metadata: {
      confidence: 0.9,
      thinking: 'The user wants me to create a login component with validation.',
      toolsUsed: ['Read', 'Write'],
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Agent Autonomy Override Factory
// ============================================================================

export interface AgentAutonomyOverrideOverrides {
  agent?: string;
  level?: 'full' | 'supervised' | 'ask-first';
  reason?: string;
  expiresAt?: Date;
  createdAt?: Date;
}

/**
 * Creates a mock AgentAutonomyOverride for testing autonomy settings
 */
export function createAgentAutonomyOverride(overrides: AgentAutonomyOverrideOverrides = {}): AgentAutonomyOverride {
  const defaults: AgentAutonomyOverride = {
    agent: 'developer',
    level: 'supervised',
    reason: 'Working in production environment - require approval for changes',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    createdAt: new Date(),
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Specialized Agent Factories
// ============================================================================

/**
 * Creates a developer agent optimized for code implementation
 */
export function createDeveloperAgent(overrides: AgentDefinitionOverrides = {}): AgentDefinition {
  return createAgent({
    name: 'developer',
    description: 'Implements features and writes production code',
    prompt: `You are the developer agent working on the implementation stage of a feature workflow.

## Your Role
Implements features and writes production code

## Task Overview
Write clean, testable, and maintainable code that meets the requirements.

## Your Stage: implementation
Write the code

## Instructions
1. Focus ONLY on your assigned stage: implementation
2. Do not attempt work belonging to other stages
3. Write clean, readable, documented code
4. Handle errors appropriately
5. Add inline comments for complex logic
6. Run linting and tests after changes

Use conventional commits: feat:, fix:, refactor:, etc.
Keep commits atomic and focused.
Always test your changes before completing.`,
    tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash', 'LSP'],
    model: 'sonnet',
    skills: ['typescript', 'javascript', 'react', 'node.js', 'testing', 'git'],
    ...overrides,
  });
}

/**
 * Creates a planner agent optimized for task planning
 */
export function createPlannerAgent(overrides: AgentDefinitionOverrides = {}): AgentDefinition {
  return createAgent({
    name: 'planner',
    description: 'Analyzes requirements and creates implementation plans',
    prompt: `You are the planner agent responsible for analyzing requirements and creating detailed implementation plans.

## Your Role
Analyzes requirements and creates implementation plans

## Your Stage: planning
Create a detailed plan for implementation

## Instructions
1. Break down complex tasks into manageable steps
2. Identify dependencies and potential blockers
3. Estimate effort and timeline
4. Consider edge cases and error handling
5. Plan testing strategy
6. Document assumptions and decisions

Focus on creating clear, actionable plans that other agents can follow.`,
    tools: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch'],
    model: 'opus',
    skills: ['system-design', 'architecture', 'planning', 'analysis'],
    ...overrides,
  });
}

/**
 * Creates a tester agent optimized for testing
 */
export function createTesterAgent(overrides: AgentDefinitionOverrides = {}): AgentDefinition {
  return createAgent({
    name: 'tester',
    description: 'Creates and runs comprehensive tests',
    prompt: `You are the tester agent responsible for ensuring code quality through comprehensive testing.

## Your Role
Creates and runs comprehensive tests

## Your Stage: testing
Write and execute tests to verify functionality

## Instructions
1. Write unit tests for all new functionality
2. Create integration tests for complex workflows
3. Test edge cases and error conditions
4. Verify performance requirements
5. Run all tests and ensure they pass
6. Generate test reports

Focus on thorough testing that gives confidence in the implementation.`,
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep'],
    model: 'sonnet',
    skills: ['testing', 'jest', 'vitest', 'playwright', 'test-automation'],
    ...overrides,
  });
}

/**
 * Creates a reviewer agent optimized for code review
 */
export function createReviewerAgent(overrides: AgentDefinitionOverrides = {}): AgentDefinition {
  return createAgent({
    name: 'reviewer',
    description: 'Reviews code for quality, security, and best practices',
    prompt: `You are the reviewer agent responsible for ensuring code quality and adherence to best practices.

## Your Role
Reviews code for quality, security, and best practices

## Your Stage: review
Review implementation for quality and compliance

## Instructions
1. Review code for correctness and clarity
2. Check adherence to coding standards
3. Identify security vulnerabilities
4. Verify performance considerations
5. Ensure proper error handling
6. Validate test coverage

Provide constructive feedback and suggestions for improvement.`,
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    model: 'opus',
    skills: ['code-review', 'security', 'performance', 'best-practices'],
    ...overrides,
  });
}

// ============================================================================
// Agent Collections
// ============================================================================

/**
 * Creates a complete set of agents for a typical workflow
 */
export function createAgentTeam(): {
  planner: AgentDefinition;
  architect: AgentDefinition;
  developer: AgentDefinition;
  tester: AgentDefinition;
  reviewer: AgentDefinition;
  devops: AgentDefinition;
} {
  return {
    planner: createPlannerAgent(),
    architect: createAgent({
      name: 'architect',
      description: 'Designs system architecture and technical approach',
      tools: ['Read', 'Grep', 'WebSearch'],
      model: 'opus',
      skills: ['architecture', 'system-design', 'patterns'],
    }),
    developer: createDeveloperAgent(),
    tester: createTesterAgent(),
    reviewer: createReviewerAgent(),
    devops: createAgent({
      name: 'devops',
      description: 'Handles deployment, infrastructure, and CI/CD',
      tools: ['Bash', 'Read', 'Write'],
      model: 'sonnet',
      skills: ['docker', 'ci-cd', 'deployment', 'monitoring'],
    }),
  };
}

/**
 * Creates multiple agents with different specializations
 */
export function createAgents(count: number, baseOverrides: AgentDefinitionOverrides = {}): AgentDefinition[] {
  const specializations = [
    { name: 'frontend-dev', skills: ['react', 'typescript', 'css'] },
    { name: 'backend-dev', skills: ['node.js', 'database', 'api'] },
    { name: 'full-stack-dev', skills: ['react', 'node.js', 'database'] },
    { name: 'qa-engineer', skills: ['testing', 'automation', 'quality'] },
  ];

  return Array.from({ length: count }, (_, index) => {
    const specialization = specializations[index % specializations.length];
    return createAgent({
      ...baseOverrides,
      name: `${specialization.name}-${index + 1}`,
      description: `Specialized ${specialization.name} agent`,
      skills: specialization.skills,
    });
  });
}

/**
 * Creates conversation history with multiple agent interactions
 */
export function createAgentConversation(length: number = 5): AgentMessage[] {
  const agents = ['planner', 'developer', 'tester', 'reviewer'];
  const messages: AgentMessage[] = [];

  // Start with user message
  messages.push(createAgentMessage({
    role: 'user',
    content: 'Please implement a login component with form validation.',
    agent: undefined,
    stage: undefined,
  }));

  for (let i = 0; i < length; i++) {
    const agent = agents[i % agents.length];
    const stage = ['planning', 'implementation', 'testing', 'review'][i % 4];

    messages.push(createAgentMessage({
      role: 'assistant',
      content: `As the ${agent} agent, I'll handle the ${stage} phase of this request.`,
      agent,
      stage,
      timestamp: new Date(Date.now() + i * 60000), // 1 minute apart
    }));
  }

  return messages;
}