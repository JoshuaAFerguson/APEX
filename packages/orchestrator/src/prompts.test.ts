import { describe, it, expect } from 'vitest';
import {
  buildOrchestratorPrompt,
  buildAgentDefinitions,
  buildCompletionSummary,
  buildStagePrompt,
  buildPlannerStagePrompt,
  parseDecompositionRequest,
  isPlanningStage,
  PromptContext,
  StagePromptContext,
} from './prompts';
import type { AgentDefinition, WorkflowDefinition, Task, WorkflowStage, StageResult } from '@apexcli/core';
import { getEffectiveConfig, ApexConfigSchema } from '@apexcli/core';

describe('Prompts', () => {
  const createMockConfig = () => {
    const config = ApexConfigSchema.parse({
      version: '1.0',
      project: {
        name: 'test-project',
        language: 'typescript',
        framework: 'nextjs',
      },
    });
    return getEffectiveConfig(config);
  };

  const createMockWorkflow = (): WorkflowDefinition => ({
    name: 'feature',
    description: 'Feature development workflow',
    stages: [
      { name: 'planning', agent: 'planner', parallel: false, maxRetries: 2 },
      { name: 'implementation', agent: 'developer', dependsOn: ['planning'], parallel: false, maxRetries: 2 },
      { name: 'testing', agent: 'tester', dependsOn: ['implementation'], parallel: true, maxRetries: 2 },
      { name: 'review', agent: 'reviewer', dependsOn: ['testing'], parallel: false, maxRetries: 2 },
    ],
  });

  const createMockAgents = (): Record<string, AgentDefinition> => ({
    planner: {
      name: 'planner',
      description: 'Plans implementation strategy',
      prompt: 'You are a planning agent.',
      model: 'opus',
    },
    developer: {
      name: 'developer',
      description: 'Implements features',
      prompt: 'You are a developer agent.',
      model: 'sonnet',
      tools: ['Read', 'Write', 'Edit', 'Bash'],
    },
    tester: {
      name: 'tester',
      description: 'Writes and runs tests',
      prompt: 'You are a testing agent.',
      model: 'sonnet',
    },
    reviewer: {
      name: 'reviewer',
      description: 'Reviews code changes',
      prompt: 'You are a code review agent.',
      model: 'haiku',
    },
  });

  const createMockTask = (autonomy: Task['autonomy'] = 'full'): Task => ({
    id: 'task_123_abc',
    description: 'Add user authentication',
    workflow: 'feature',
    autonomy,
    status: 'in-progress',
    projectPath: '/test/project',
    branchName: 'apex/123-add-user-authentication',
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:30:00Z'),
    usage: {
      inputTokens: 5000,
      outputTokens: 2000,
      totalTokens: 7000,
      estimatedCost: 0.045,
    },
    logs: [],
    artifacts: [],
  });

  describe('buildOrchestratorPrompt', () => {
    it('should include project information', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask(),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('test-project');
      expect(prompt).toContain('typescript');
      expect(prompt).toContain('nextjs');
    });

    it('should list all agents with descriptions', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask(),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('planner');
      expect(prompt).toContain('Plans implementation strategy');
      expect(prompt).toContain('developer');
      expect(prompt).toContain('Implements features');
      expect(prompt).toContain('tester');
      expect(prompt).toContain('reviewer');
    });

    it('should include workflow stages', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask(),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('planning (planner)');
      expect(prompt).toContain('implementation (developer)');
      expect(prompt).toContain('testing (tester)');
      expect(prompt).toContain('[parallel]');
    });

    it('should include task details', () => {
      const task = createMockTask();
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task,
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain(task.id);
      expect(prompt).toContain(task.branchName!);
      expect(prompt).toContain(task.status);
    });

    it('should include git workflow instructions', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask(),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('git checkout -b');
      expect(prompt).toContain('git commit -m');
      expect(prompt).toContain('git push');
      expect(prompt).toContain('gh pr create');
    });

    it('should include conventional commit format', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask(),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('feat:');
      expect(prompt).toContain('fix:');
      expect(prompt).toContain('docs:');
      expect(prompt).toContain('refactor:');
      expect(prompt).toContain('test:');
      expect(prompt).toContain('chore:');
    });

    it('should include available scripts', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask(),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('./scripts/lint.sh');
      expect(prompt).toContain('./scripts/test.sh');
      expect(prompt).toContain('./scripts/build.sh');
      expect(prompt).toContain('./scripts/typecheck.sh');
    });

    it('should include autonomy level instructions for "full"', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask('full'),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('full autonomy');
      expect(prompt).toContain('without waiting for approvals');
    });

    it('should include autonomy level instructions for "review-before-commit"', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask('review-before-commit'),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('Pause before each git commit');
      expect(prompt).toContain('Show the diff');
    });

    it('should include autonomy level instructions for "review-before-merge"', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask('review-before-merge'),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('create a PR for human review');
      expect(prompt).toContain('Do not auto-merge');
    });

    it('should include autonomy level instructions for "manual"', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask('manual'),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('Pause at each major stage');
      expect(prompt).toContain('Wait for explicit go-ahead');
    });

    it('should include token budget limit', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask(),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('500,000 tokens');
    });

    it('should include API coordination instructions', () => {
      const context: PromptContext = {
        config: createMockConfig(),
        workflow: createMockWorkflow(),
        task: createMockTask(),
        agents: createMockAgents(),
      };

      const prompt = buildOrchestratorPrompt(context);

      expect(prompt).toContain('$APEX_API/tasks/$APEX_TASK_ID/status');
      expect(prompt).toContain('$APEX_API/tasks/$APEX_TASK_ID/log');
    });
  });

  describe('buildAgentDefinitions', () => {
    it('should convert agents to SDK format', () => {
      const agents = createMockAgents();
      const config = createMockConfig();

      const result = buildAgentDefinitions(agents, config);

      expect(result).toHaveProperty('planner');
      expect(result).toHaveProperty('developer');
      expect(result).toHaveProperty('tester');
      expect(result).toHaveProperty('reviewer');
    });

    it('should preserve agent descriptions', () => {
      const agents = createMockAgents();
      const config = createMockConfig();

      const result = buildAgentDefinitions(agents, config);

      expect(result.planner.description).toBe('Plans implementation strategy');
      expect(result.developer.description).toBe('Implements features');
    });

    it('should enhance prompts with APEX integration', () => {
      const agents = createMockAgents();
      const config = createMockConfig();

      const result = buildAgentDefinitions(agents, config);

      expect(result.developer.prompt).toContain('You are a developer agent.');
      expect(result.developer.prompt).toContain('APEX Integration');
      expect(result.developer.prompt).toContain('$APEX_API/tasks/$APEX_TASK_ID/status');
      expect(result.developer.prompt).toContain('$APEX_API/tasks/$APEX_TASK_ID/log');
    });

    it('should preserve agent tools', () => {
      const agents = createMockAgents();
      const config = createMockConfig();

      const result = buildAgentDefinitions(agents, config);

      expect(result.developer.tools).toEqual(['Read', 'Write', 'Edit', 'Bash']);
    });

    it('should preserve agent model', () => {
      const agents = createMockAgents();
      const config = createMockConfig();

      const result = buildAgentDefinitions(agents, config);

      expect(result.planner.model).toBe('opus');
      expect(result.developer.model).toBe('sonnet');
      expect(result.reviewer.model).toBe('haiku');
    });

    it('should exclude disabled agents', () => {
      const agents = createMockAgents();
      const config = createMockConfig();
      config.agents.disabled = ['reviewer'];

      const result = buildAgentDefinitions(agents, config);

      expect(result).not.toHaveProperty('reviewer');
      expect(result).toHaveProperty('planner');
      expect(result).toHaveProperty('developer');
    });

    it('should only include enabled agents when specified', () => {
      const agents = createMockAgents();
      const config = createMockConfig();
      config.agents.enabled = ['planner', 'developer'];

      const result = buildAgentDefinitions(agents, config);

      expect(result).toHaveProperty('planner');
      expect(result).toHaveProperty('developer');
      expect(result).not.toHaveProperty('tester');
      expect(result).not.toHaveProperty('reviewer');
    });
  });

  describe('buildCompletionSummary', () => {
    it('should include task description', () => {
      const task = createMockTask();
      task.description = 'Implement user login';

      const summary = buildCompletionSummary(task);

      expect(summary).toContain('Implement user login');
    });

    it('should include task status', () => {
      const task = createMockTask();
      task.status = 'completed';

      const summary = buildCompletionSummary(task);

      expect(summary).toContain('completed');
    });

    it('should include token usage', () => {
      const task = createMockTask();
      task.usage = {
        inputTokens: 10000,
        outputTokens: 5000,
        totalTokens: 15000,
        estimatedCost: 0.075,
      };

      const summary = buildCompletionSummary(task);

      expect(summary).toContain('10,000');
      expect(summary).toContain('5,000');
      expect(summary).toContain('15,000');
      expect(summary).toContain('$0.0750');
    });

    it('should include artifacts', () => {
      const task = createMockTask();
      task.artifacts = [
        { name: 'auth.ts', type: 'file', path: '/src/auth.ts', createdAt: new Date() },
        { name: 'auth.test.ts', type: 'file', path: '/src/auth.test.ts', createdAt: new Date() },
      ];

      const summary = buildCompletionSummary(task);

      expect(summary).toContain('auth.ts (file)');
      expect(summary).toContain('auth.test.ts (file)');
    });

    it('should show "None" when no artifacts', () => {
      const task = createMockTask();
      task.artifacts = [];

      const summary = buildCompletionSummary(task);

      expect(summary).toContain('None');
    });

    it('should include error when present', () => {
      const task = createMockTask();
      task.status = 'failed';
      task.error = 'Build failed: TypeScript compilation error';

      const summary = buildCompletionSummary(task);

      expect(summary).toContain('Error');
      expect(summary).toContain('Build failed: TypeScript compilation error');
    });

    it('should not include error section when no error', () => {
      const task = createMockTask();
      task.error = undefined;

      const summary = buildCompletionSummary(task);

      expect(summary).not.toContain('### Error');
    });

    it('should format duration correctly', () => {
      const task = createMockTask();
      task.createdAt = new Date('2025-01-01T10:00:00Z');
      task.completedAt = new Date('2025-01-01T10:35:00Z');

      const summary = buildCompletionSummary(task);

      expect(summary).toContain('35m 0s');
    });

    it('should format duration in hours when applicable', () => {
      const task = createMockTask();
      task.createdAt = new Date('2025-01-01T10:00:00Z');
      task.completedAt = new Date('2025-01-01T11:30:00Z');

      const summary = buildCompletionSummary(task);

      expect(summary).toContain('1h 30m');
    });
  });

  describe('buildStagePrompt', () => {
    const createStagePromptContext = (
      stageName: string = 'implementation',
      previousResults: Map<string, StageResult> = new Map()
    ): StagePromptContext => {
      const workflow = createMockWorkflow();
      const stage = workflow.stages.find(s => s.name === stageName) || workflow.stages[1];
      const agents = createMockAgents();

      return {
        task: createMockTask(),
        stage,
        agent: agents[stage.agent],
        workflow,
        config: createMockConfig(),
        previousStageResults: previousResults,
      };
    };

    it('should include agent role and description', () => {
      const context = createStagePromptContext();
      const prompt = buildStagePrompt(context);

      expect(prompt).toContain('developer');
      expect(prompt).toContain('Implements features');
    });

    it('should include task description', () => {
      const context = createStagePromptContext();
      const prompt = buildStagePrompt(context);

      expect(prompt).toContain('Add user authentication');
    });

    it('should include stage information', () => {
      const context = createStagePromptContext();
      const prompt = buildStagePrompt(context);

      expect(prompt).toContain('implementation');
      expect(prompt).toContain('Your Stage: implementation');
    });

    it('should include project context', () => {
      const context = createStagePromptContext();
      const prompt = buildStagePrompt(context);

      expect(prompt).toContain('test-project');
      expect(prompt).toContain('typescript');
      expect(prompt).toContain('nextjs');
    });

    it('should include output format instructions', () => {
      const context = createStagePromptContext();
      const prompt = buildStagePrompt(context);

      expect(prompt).toContain('### Stage Summary:');
      expect(prompt).toContain('**Status**: completed | failed');
      expect(prompt).toContain('**Files Modified**:');
    });

    it('should include inputs from previous stages when dependencies exist', () => {
      const planningResult: StageResult = {
        stageName: 'planning',
        agent: 'planner',
        status: 'completed',
        outputs: { plan: 'Implementation plan here' },
        artifacts: ['docs/plan.md'],
        summary: 'Created implementation plan',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
        startedAt: new Date(),
        completedAt: new Date(),
      };
      const previousResults = new Map([['planning', planningResult]]);
      const context = createStagePromptContext('implementation', previousResults);
      const prompt = buildStagePrompt(context);

      expect(prompt).toContain('From planning stage');
      expect(prompt).toContain('Created implementation plan');
      expect(prompt).toContain('docs/plan.md');
    });

    it('should not include inputs section when no dependencies', () => {
      const context = createStagePromptContext('planning');
      const prompt = buildStagePrompt(context);

      expect(prompt).not.toContain('Inputs from Previous Stages');
    });
  });

  describe('buildPlannerStagePrompt', () => {
    const createPlannerContext = (): StagePromptContext => {
      const workflow = createMockWorkflow();
      const stage = workflow.stages.find(s => s.name === 'planning')!;
      const agents = createMockAgents();

      return {
        task: createMockTask(),
        stage,
        agent: agents.planner,
        workflow,
        config: createMockConfig(),
        previousStageResults: new Map(),
      };
    };

    it('should include decomposition instructions', () => {
      const context = createPlannerContext();
      const prompt = buildPlannerStagePrompt(context);

      // Updated to match the new prompt format - uses "Decomposition" not "DECOMPOSITION"
      expect(prompt).toContain('Decomposition');
      expect(prompt).toContain('```decompose');
      expect(prompt).toContain('subtasks');
    });

    it('should explain decomposition strategies', () => {
      const context = createPlannerContext();
      const prompt = buildPlannerStagePrompt(context);

      expect(prompt).toContain('sequential');
      expect(prompt).toContain('parallel');
      expect(prompt).toContain('dependency-based');
    });

    it('should include guidance on when to decompose', () => {
      const context = createPlannerContext();
      const prompt = buildPlannerStagePrompt(context);

      // Updated to match the new assertive decomposition guidance
      expect(prompt).toContain('You MUST DECOMPOSE if the task');
      expect(prompt).toContain('multiple features or components');
      expect(prompt).toContain('Independent subtasks can run simultaneously');
    });

    it('should include task details', () => {
      const context = createPlannerContext();
      const prompt = buildPlannerStagePrompt(context);

      expect(prompt).toContain('Add user authentication');
    });

    it('should include project context', () => {
      const context = createPlannerContext();
      const prompt = buildPlannerStagePrompt(context);

      expect(prompt).toContain('test-project');
      expect(prompt).toContain('typescript');
    });
  });

  describe('parseDecompositionRequest', () => {
    it('should return shouldDecompose: false when no decompose block', () => {
      const output = `
### Planning Summary
**Approach**: Implement user auth with JWT
**Steps**:
1. Create auth service
2. Add login endpoint
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(false);
      expect(result.subtasks).toHaveLength(0);
    });

    it('should parse valid decomposition request', () => {
      const output = `
This task should be decomposed into multiple subtasks.

\`\`\`decompose
{
  "reason": "Task spans backend and frontend",
  "strategy": "sequential",
  "subtasks": [
    {
      "description": "Implement backend auth service",
      "acceptanceCriteria": "JWT authentication working",
      "workflow": "feature"
    },
    {
      "description": "Add frontend login form",
      "dependsOn": ["Implement backend auth service"]
    }
  ]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(true);
      expect(result.subtasks).toHaveLength(2);
      expect(result.strategy).toBe('sequential');
      expect(result.reason).toBe('Task spans backend and frontend');
      expect(result.subtasks[0].description).toBe('Implement backend auth service');
      expect(result.subtasks[0].acceptanceCriteria).toBe('JWT authentication working');
      expect(result.subtasks[1].dependsOn).toContain('Implement backend auth service');
    });

    it('should parse parallel strategy', () => {
      const output = `
\`\`\`decompose
{
  "strategy": "parallel",
  "subtasks": [
    { "description": "Task A" },
    { "description": "Task B" }
  ]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(true);
      expect(result.strategy).toBe('parallel');
    });

    it('should parse dependency-based strategy', () => {
      const output = `
\`\`\`decompose
{
  "strategy": "dependency-based",
  "subtasks": [
    { "description": "Base task" },
    { "description": "Dependent task", "dependsOn": ["Base task"] }
  ]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(true);
      expect(result.strategy).toBe('dependency-based');
    });

    it('should default to sequential strategy when invalid', () => {
      const output = `
\`\`\`decompose
{
  "strategy": "invalid-strategy",
  "subtasks": [
    { "description": "Task A" }
  ]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(true);
      expect(result.strategy).toBe('sequential');
    });

    it('should return shouldDecompose: false for empty subtasks', () => {
      const output = `
\`\`\`decompose
{
  "strategy": "sequential",
  "subtasks": []
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(false);
    });

    it('should filter out subtasks with empty descriptions', () => {
      const output = `
\`\`\`decompose
{
  "strategy": "sequential",
  "subtasks": [
    { "description": "Valid task" },
    { "description": "" },
    { "description": "Another valid task" }
  ]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(true);
      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks[0].description).toBe('Valid task');
      expect(result.subtasks[1].description).toBe('Another valid task');
    });

    it('should handle invalid JSON gracefully', () => {
      const output = `
\`\`\`decompose
{
  "strategy": "sequential",
  "subtasks": [invalid json here]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(false);
      expect(result.subtasks).toHaveLength(0);
    });

    it('should handle missing subtasks array', () => {
      const output = `
\`\`\`decompose
{
  "strategy": "sequential"
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(false);
    });
  });

  describe('isPlanningStage', () => {
    it('should return true for stage named "planning"', () => {
      const stage: WorkflowStage = {
        name: 'planning',
        agent: 'developer',
        maxRetries: 2,
      };

      expect(isPlanningStage(stage)).toBe(true);
    });

    it('should return true for stage named "plan"', () => {
      const stage: WorkflowStage = {
        name: 'plan',
        agent: 'developer',
        maxRetries: 2,
      };

      expect(isPlanningStage(stage)).toBe(true);
    });

    it('should return true for stage using planner agent', () => {
      const stage: WorkflowStage = {
        name: 'analysis',
        agent: 'planner',
        maxRetries: 2,
      };

      expect(isPlanningStage(stage)).toBe(true);
    });

    it('should return false for non-planning stages', () => {
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        maxRetries: 2,
      };

      expect(isPlanningStage(stage)).toBe(false);
    });

    it('should return false for testing stage', () => {
      const stage: WorkflowStage = {
        name: 'testing',
        agent: 'tester',
        maxRetries: 2,
      };

      expect(isPlanningStage(stage)).toBe(false);
    });
  });
});
