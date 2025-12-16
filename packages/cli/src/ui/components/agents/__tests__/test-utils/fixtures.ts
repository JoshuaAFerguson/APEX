import type { AgentInfo } from '../../AgentPanel';
import type { ParallelAgent } from '../../ParallelExecutionView';

// Standard workflow agents
export const standardWorkflowAgents: AgentInfo[] = [
  { name: 'planner', status: 'completed', stage: 'planning' },
  { name: 'architect', status: 'completed', stage: 'architecture' },
  { name: 'developer', status: 'active', stage: 'implementation', progress: 50 },
  { name: 'tester', status: 'waiting' },
  { name: 'reviewer', status: 'idle' },
  { name: 'devops', status: 'idle' },
];

// Parallel execution scenarios
export const parallelScenarios = {
  twoAgents: [
    { name: 'reviewer', status: 'parallel' as const, stage: 'code-review', progress: 30 },
    { name: 'tester', status: 'parallel' as const, stage: 'unit-testing', progress: 45 },
  ],

  threeAgents: [
    { name: 'reviewer', status: 'parallel' as const, stage: 'code-review', progress: 30 },
    { name: 'tester', status: 'parallel' as const, stage: 'unit-testing', progress: 45 },
    { name: 'security', status: 'parallel' as const, stage: 'security-scan', progress: 70 },
  ],

  microservices: [
    { name: 'auth-dev', status: 'parallel' as const, stage: 'auth-impl', progress: 90 },
    { name: 'user-dev', status: 'parallel' as const, stage: 'user-api', progress: 75 },
    { name: 'payment-dev', status: 'parallel' as const, stage: 'payment', progress: 55 },
    { name: 'notify-dev', status: 'parallel' as const, stage: 'messaging', progress: 35 },
    { name: 'gateway-dev', status: 'parallel' as const, stage: 'routing', progress: 25 },
  ],

  cicd: [
    { name: 'staging-deploy', status: 'parallel' as const, stage: 'staging', progress: 80 },
    { name: 'test-deploy', status: 'parallel' as const, stage: 'test-env', progress: 60 },
    { name: 'integration', status: 'parallel' as const, stage: 'integration', progress: 40 },
    { name: 'perf-test', status: 'parallel' as const, stage: 'performance', progress: 20 },
  ],
};

// Animation state scenarios
export const animationStates = {
  idle: {
    isAnimating: false,
    previousAgent: null,
    currentAgent: null,
    progress: 0,
    isFading: false,
    transitionPhase: 'idle' as const,
    pulseIntensity: 0,
    arrowFrame: 0,
    handoffStartTime: null,
    arrowAnimationFrame: 0,
    iconFrame: 0,
    colorIntensity: 0,
    colorPhase: 'source-bright' as const,
  },

  entering: {
    isAnimating: true,
    previousAgent: 'planner',
    currentAgent: 'architect',
    progress: 0.15,
    isFading: false,
    transitionPhase: 'entering' as const,
    pulseIntensity: 0.7,
    arrowFrame: 0,
    handoffStartTime: new Date(),
    arrowAnimationFrame: 1,
    iconFrame: 0,
    colorIntensity: 0.15,
    colorPhase: 'source-bright' as const,
  },

  active: {
    isAnimating: true,
    previousAgent: 'planner',
    currentAgent: 'architect',
    progress: 0.5,
    isFading: false,
    transitionPhase: 'active' as const,
    pulseIntensity: 0.5,
    arrowFrame: 1,
    handoffStartTime: new Date(),
    arrowAnimationFrame: 4,
    iconFrame: 4,
    colorIntensity: 0.5,
    colorPhase: 'transitioning' as const,
  },

  fading: {
    isAnimating: true,
    previousAgent: 'planner',
    currentAgent: 'architect',
    progress: 0.85,
    isFading: true,
    transitionPhase: 'exiting' as const,
    pulseIntensity: 0.3,
    arrowFrame: 2,
    handoffStartTime: new Date(),
    arrowAnimationFrame: 7,
    iconFrame: 7,
    colorIntensity: 0.85,
    colorPhase: 'target-bright' as const,
  },
};

// Edge case agent names
export const edgeCaseAgentNames = {
  empty: '',
  veryLong: 'this-is-a-very-long-agent-name-that-might-cause-layout-issues-in-the-ui',
  withDashes: 'agent-with-dashes',
  withUnderscores: 'agent_with_underscores',
  withNumbers: 'agent123',
  numbersOnly: '12345',
  withSpecial: 'agent@test#1',
  unicode: 'agent-日本語',
  withSpaces: 'agent with spaces',
};

// Helper to create agents with timestamps
export function createTimedParallelAgents(
  count: number,
  baseTime: Date = new Date()
): AgentInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `parallel-agent-${i + 1}`,
    status: 'parallel' as const,
    stage: `stage-${i + 1}`,
    progress: Math.min((i + 1) * 15, 99),
    startedAt: new Date(baseTime.getTime() - (count - i) * 5000),
  }));
}

// Helper to create agents with various statuses
export function createMixedStatusAgents(): AgentInfo[] {
  return [
    { name: 'agent1', status: 'active' },
    { name: 'agent2', status: 'waiting' },
    { name: 'agent3', status: 'completed' },
    { name: 'agent4', status: 'idle' },
    { name: 'agent5', status: 'parallel' },
  ];
}

// Helper to create agents with progress variations
export function createProgressVariationAgents(): AgentInfo[] {
  return [
    { name: 'no-progress', status: 'active' },
    { name: 'zero-progress', status: 'active', progress: 0 },
    { name: 'low-progress', status: 'active', progress: 25 },
    { name: 'mid-progress', status: 'active', progress: 50 },
    { name: 'high-progress', status: 'active', progress: 90 },
    { name: 'complete-progress', status: 'active', progress: 100 },
  ];
}

// Helper to create agents with edge case names
export function createEdgeCaseNameAgents(): AgentInfo[] {
  return Object.entries(edgeCaseAgentNames).map(([key, name]) => ({
    name,
    status: 'active' as const,
    stage: `stage-${key}`,
  }));
}

// Standard agent colors for testing
export const testAgentColors = {
  planner: 'magenta',
  architect: 'blue',
  developer: 'green',
  reviewer: 'yellow',
  tester: 'cyan',
  devops: 'red',
};

// Test tasks for orchestrator events
export const testTasks = {
  basic: {
    id: 'test-task-1',
    workflow: 'feature',
    status: 'running' as const,
    description: 'Test feature implementation',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  completed: {
    id: 'test-task-2',
    workflow: 'feature',
    status: 'completed' as const,
    description: 'Completed test task',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  failed: {
    id: 'test-task-3',
    workflow: 'feature',
    status: 'failed' as const,
    description: 'Failed test task',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

// Helper to create workflow stages for testing
export function createWorkflowStages(stageNames: string[]): Array<{ name: string; agent: string }> {
  const agentMap: Record<string, string> = {
    'planning': 'planner',
    'architecture': 'architect',
    'implementation': 'developer',
    'testing': 'tester',
    'review': 'reviewer',
    'deployment': 'devops',
  };

  return stageNames.map(name => ({
    name,
    agent: agentMap[name] || `${name}-agent`,
  }));
}