import { describe, it, expect } from 'vitest';
import {
  buildOrchestratorPrompt,
  buildAgentDefinitions,
  buildCompletionSummary,
  buildStagePrompt,
  buildPlannerStagePrompt,
  parseDecompositionRequest,
  isPlanningStage,
  buildResumePrompt,
  PromptContext,
  StagePromptContext,
} from './prompts';
import type { AgentDefinition, WorkflowDefinition, Task, WorkflowStage, StageResult, TaskCheckpoint } from '@apexcli/core';
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

  describe('buildResumePrompt', () => {
    const createMockCheckpoint = (
      stage: string = 'implementation',
      stageIndex: number = 1,
      createdAt: Date = new Date('2024-12-20T10:30:00Z')
    ): TaskCheckpoint => ({
      taskId: 'task_123_abc',
      checkpointId: 'checkpoint_xyz',
      stage,
      stageIndex,
      createdAt,
    });

    it('should include task description', () => {
      const task = createMockTask();
      task.description = 'Implement user authentication system';
      const checkpoint = createMockCheckpoint();
      const contextSummary = 'The planner completed the planning stage successfully.';

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(prompt).toContain('Implement user authentication system');
    });

    it('should include checkpoint information', () => {
      const task = createMockTask();
      const checkpoint = createMockCheckpoint('implementation', 2);
      const contextSummary = 'Previous work accomplished.';

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(prompt).toContain('Resume Point**: Stage "implementation" (index 2)');
      expect(prompt).toContain('Last Checkpoint**:');
    });

    it('should include context summary', () => {
      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const contextSummary = 'The developer agent completed the architecture design and identified key components.';

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(prompt).toContain('Prior Context Summary');
      expect(prompt).toContain('The developer agent completed the architecture design and identified key components.');
    });

    it('should extract accomplishments from context summary', () => {
      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const contextSummary = `
        The developer agent completed the authentication module implementation.
        Successfully created the login endpoint.
        Built the JWT token validation service.
      `;

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(prompt).toContain('What Was Accomplished');
      expect(prompt).toContain('the authentication module implementation');
      expect(prompt).toContain('the login endpoint');
    });

    it('should extract key decisions from context summary', () => {
      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const contextSummary = `
        Decided to use JWT tokens for authentication.
        Architecture: RESTful API with Express middleware.
        Using bcrypt for password hashing because of security requirements.
      `;

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(prompt).toContain('Key Decisions Made');
      expect(prompt).toContain('use JWT tokens for authentication');
      expect(prompt).toContain('RESTful API with Express middleware');
    });

    it('should handle empty context summary gracefully', () => {
      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const contextSummary = '';

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(prompt).toContain('No specific accomplishments identified');
      expect(prompt).toContain('No significant decisions identified');
    });

    it('should include resume instructions', () => {
      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const contextSummary = 'Previous work context.';

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(prompt).toContain('What Happens Next');
      expect(prompt).toContain('continuation of previous work');
      expect(prompt).toContain('avoid repeating completed work');
    });

    it('should format checkpoint age correctly', () => {
      const task = createMockTask();
      // Create a checkpoint that's 1 hour and 30 minutes old
      const oldCheckpoint = createMockCheckpoint('planning', 0, new Date(Date.now() - (90 * 60 * 1000)));
      const contextSummary = 'Previous context.';

      const prompt = buildResumePrompt(task, oldCheckpoint, contextSummary);

      expect(prompt).toContain('1h 30m ago');
    });

    it('should handle missing stage gracefully', () => {
      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      checkpoint.stage = undefined;
      const contextSummary = 'Previous work context.';

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(prompt).toContain('Stage "unknown"');
    });

    it('should include session resume header', () => {
      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const contextSummary = 'Context summary here.';

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(prompt).toContain('🔄 SESSION RESUME CONTEXT');
      expect(prompt).toContain('Resuming Task**:');
    });

    it('should limit extracted accomplishments and decisions', () => {
      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const contextSummary = `
        Completed task 1. Finished task 2. Implemented task 3.
        Built task 4. Created task 5. Developed task 6.
        Added task 7. Fixed task 8. Updated task 9.
      `;

      const prompt = buildResumePrompt(task, checkpoint, contextSummary);

      // Should only include first 5 accomplishments (see extractAccomplishments function)
      const accomplishmentLines = prompt.split('\n').filter(line =>
        line.includes('task') && (line.includes('Completed') || line.includes('Finished') || line.includes('Implemented'))
      );
      expect(accomplishmentLines.length).toBeLessThanOrEqual(5);
    });

    describe('extractAccomplishments (via buildResumePrompt)', () => {
      it('should extract accomplishments with action words', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          Completed the user authentication module.
          Finished implementing the password reset feature.
          Created the JWT token service successfully.
          Built the database schema for users.
          Added validation middleware to endpoints.
          Fixed security vulnerabilities in the login flow.
          Updated the API documentation.
          Wrote comprehensive unit tests.
          Generated API response types.
          Developed the logout functionality.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('What Was Accomplished');
        expect(prompt).toContain('the user authentication module');
        expect(prompt).toContain('implementing the password reset feature');
        expect(prompt).toContain('the JWT token service successfully');
        expect(prompt).toContain('the database schema for users');
        expect(prompt).toContain('validation middleware to endpoints');
      });

      it('should extract accomplishments with success indicators', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          ✓ Database connection established
          Successfully migrated all user data
          ✅ All tests are now passing
          Done: API rate limiting implementation
          Ready: Production deployment configuration
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('Database connection established');
        expect(prompt).toContain('migrated all user data');
        expect(prompt).toContain('All tests are now passing');
        expect(prompt).toContain('API rate limiting implementation');
        expect(prompt).toContain('Production deployment configuration');
      });

      it('should extract bulleted accomplishments', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          - Implemented OAuth2 authentication flow
          - Added error handling for network failures
          - Created user preference settings page
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('OAuth2 authentication flow');
        expect(prompt).toContain('error handling for network failures');
        expect(prompt).toContain('user preference settings page');
      });

      it('should filter accomplishments by length', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          Completed x.
          Added this extremely long accomplishment description that goes on and on and provides way too much detail about every single aspect of the implementation including technical details that are not really necessary for a high-level summary and should be filtered out because it exceeds the character limit.
          Built the authentication system with proper validation.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).not.toContain('Completed x');
        expect(prompt).not.toContain('extremely long accomplishment');
        expect(prompt).toContain('the authentication system with proper validation');
      });

      it('should remove duplicate accomplishments', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          Implemented user authentication.
          Successfully implemented user authentication.
          Built user authentication system.
          Completed user registration feature.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        const accomplishmentSection = prompt.split('### What Was Accomplished')[1];
        const userAuthMatches = (accomplishmentSection || '').match(/user authentication/gi) || [];
        expect(userAuthMatches.length).toBe(1); // Should deduplicate similar accomplishments
      });

      it('should handle accomplishments with various patterns', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          The system generated new API tokens automatically.
          Development of the caching layer is now complete.
          User interface updated to support dark mode.
          Password hashing written using bcrypt library.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('new API tokens automatically');
        expect(prompt).toContain('the caching layer is now complete');
        expect(prompt).toContain('to support dark mode');
        expect(prompt).toContain('using bcrypt library');
      });
    });

    describe('extractKeyDecisions (via buildResumePrompt)', () => {
      it('should extract decisions with decision verbs', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          Decided to use PostgreSQL for the main database.
          Chose React for the frontend framework.
          Selected JWT tokens for authentication.
          Opted for Docker for containerization.
          Determined that Redis would handle session storage.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('Key Decisions Made');
        expect(prompt).toContain('use PostgreSQL for the main database');
        expect(prompt).toContain('React for the frontend framework');
        expect(prompt).toContain('JWT tokens for authentication');
        expect(prompt).toContain('Docker for containerization');
        expect(prompt).toContain('Redis would handle session storage');
      });

      it('should extract decisions from structured decision statements', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          Decision: Use microservices architecture for scalability.
          Approach: Implement API-first design pattern.
          Strategy: Deploy using blue-green deployment.
          Method: Test using Jest and React Testing Library.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('Use microservices architecture for scalability');
        expect(prompt).toContain('Implement API-first design pattern');
        expect(prompt).toContain('Deploy using blue-green deployment');
        expect(prompt).toContain('Test using Jest and React Testing Library');
      });

      it('should extract technology and tool usage decisions', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          Using TypeScript for better type safety.
          Will use Prisma as the ORM for database access.
          Plan to use GitHub Actions for CI/CD pipeline.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('TypeScript for better type safety');
        expect(prompt).toContain('Prisma as the ORM for database access');
        expect(prompt).toContain('GitHub Actions for CI/CD pipeline');
      });

      it('should extract architectural and design decisions', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          Architecture: Layered architecture with separation of concerns.
          Design: Component-based UI with reusable elements.
          Pattern: Repository pattern for data access layer.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('Layered architecture with separation of concerns');
        expect(prompt).toContain('Component-based UI with reusable elements');
        expect(prompt).toContain('Repository pattern for data access layer');
      });

      it('should extract reason-based decisions', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          Because of performance requirements, we chose Redis for caching.
          Since security is critical, implemented OAuth2 authentication.
          Due to team expertise, selected Node.js for backend development.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('performance requirements, we chose Redis for caching');
        expect(prompt).toContain('security is critical, implemented OAuth2 authentication');
        expect(prompt).toContain('team expertise, selected Node.js for backend development');
      });

      it('should filter decisions by length', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          Decided to use X.
          Selected this extremely detailed technology stack that includes a comprehensive list of every possible library and framework that could potentially be used in this project including their versions and configuration options and reasoning for each choice which makes this decision statement way too long for practical use.
          Chose GraphQL for API design.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).not.toContain('Decided to use X');
        expect(prompt).not.toContain('extremely detailed technology stack');
        expect(prompt).toContain('GraphQL for API design');
      });

      it('should remove duplicate decisions', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          Decided to use React for frontend development.
          Chose React as the main UI framework.
          Selected React for user interface implementation.
          Opted for Vue.js for component management.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        const decisionsSection = prompt.split('### Key Decisions Made')[1];
        const reactMatches = (decisionsSection || '').match(/React/gi) || [];
        expect(reactMatches.length).toBe(1); // Should deduplicate similar decisions
      });
    });

    describe('buildResumePrompt edge cases', () => {
      it('should handle very long context summaries gracefully', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const longContext = 'A'.repeat(10000) + ' Completed the main feature. ' + 'B'.repeat(10000);

        const prompt = buildResumePrompt(task, checkpoint, longContext);

        expect(prompt).toContain('🔄 SESSION RESUME CONTEXT');
        expect(prompt).toContain('the main feature');
        expect(prompt.length).toBeLessThan(20000); // Reasonable prompt size
      });

      it('should handle context with only whitespace and newlines', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = '\n\n   \t   \n\n   \n';

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('No specific accomplishments identified');
        expect(prompt).toContain('No significant decisions identified');
      });

      it('should handle context with special characters and emojis', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          ✅ Successfully implemented OAuth2 🔐 authentication!
          🚀 Built the API endpoints with rate limiting @100 req/min.
          ⚡ Optimized database queries (50% faster).
          Decision: Use Redis for caching 📦 because of speed requirements.
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('OAuth2 🔐 authentication');
        expect(prompt).toContain('the API endpoints with rate limiting @100 req/min');
        expect(prompt).toContain('Redis for caching 📦 because of speed requirements');
      });

      it('should handle malformed context summary', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();
        const contextSummary = `
          incomplete sentence about authentication
          Completed
          built something but no details
          Very very very very very very very very very very long line that might cause issues with regex matching and pattern detection but should still be handled gracefully without causing any errors or exceptions
        `;

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('🔄 SESSION RESUME CONTEXT');
        // Should handle gracefully without throwing errors
        expect(() => buildResumePrompt(task, checkpoint, contextSummary)).not.toThrow();
      });

      it('should handle checkpoint with future timestamp', () => {
        const task = createMockTask();
        const futureCheckpoint = createMockCheckpoint('planning', 0, new Date(Date.now() + (60 * 60 * 1000))); // 1 hour in future
        const contextSummary = 'Previous work context.';

        expect(() => {
          const prompt = buildResumePrompt(task, futureCheckpoint, contextSummary);
          expect(prompt).toContain('🔄 SESSION RESUME CONTEXT');
        }).not.toThrow();
      });

      it('should handle task with missing optional fields', () => {
        const task = createMockTask();
        task.acceptanceCriteria = undefined;
        task.branchName = undefined;
        const checkpoint = createMockCheckpoint();
        const contextSummary = 'Work was completed on the main features.';

        const prompt = buildResumePrompt(task, checkpoint, contextSummary);

        expect(prompt).toContain('Resuming Task**:');
        expect(prompt).toContain('the main features');
        expect(prompt).not.toContain('Acceptance Criteria');
      });

      it('should format checkpoint age correctly for different durations', () => {
        const task = createMockTask();
        const contextSummary = 'Context summary.';

        // Test seconds only
        const recentCheckpoint = createMockCheckpoint('testing', 1, new Date(Date.now() - (30 * 1000)));
        const recentPrompt = buildResumePrompt(task, recentCheckpoint, contextSummary);
        expect(recentPrompt).toMatch(/30s ago/);

        // Test minutes and seconds
        const minuteCheckpoint = createMockCheckpoint('testing', 1, new Date(Date.now() - (150 * 1000)));
        const minutePrompt = buildResumePrompt(task, minuteCheckpoint, contextSummary);
        expect(minutePrompt).toMatch(/2m 30s ago/);

        // Test hours and minutes
        const hourCheckpoint = createMockCheckpoint('testing', 1, new Date(Date.now() - (7380 * 1000)));
        const hourPrompt = buildResumePrompt(task, hourCheckpoint, contextSummary);
        expect(hourPrompt).toMatch(/2h 3m ago/);
      });
    });

    describe('Resume Context Integration', () => {
      it('should integrate with createContextSummary for resume scenarios', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();

        // Mock conversation state with various content types
        const conversationMessages: AgentMessage[] = [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Please build a REST API for user management' }]
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will create a comprehensive REST API. I\'ve decided to use Express.js with TypeScript. The approach will be to implement CRUD operations with proper validation.'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Write',
              toolInput: { file_path: '/src/routes/users.ts', content: 'export const userRoutes = express.Router();' }
            }],
          },
          {
            type: 'user',
            content: [{
              type: 'tool_result',
              toolResult: 'File created successfully'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Completed the user routes implementation. Built the validation middleware. Currently working on implementing authentication.'
            }],
          },
        ];

        // Use actual createContextSummary function
        const contextSummary = require('./context').createContextSummary(conversationMessages);
        const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

        // Verify integration works correctly
        expect(resumePrompt).toContain('🔄 SESSION RESUME CONTEXT');
        expect(resumePrompt).toContain('Prior Context Summary');
        expect(resumePrompt).toContain('Messages exchanged: 5');
        expect(resumePrompt).toContain('Express.js with TypeScript');
        expect(resumePrompt).toContain('user routes implementation');
        expect(resumePrompt).toContain('Files written: /src/routes/users.ts');
      });

      it('should handle resume context from checkpoint with minimal content', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();

        // Minimal conversation state
        const conversationMessages: AgentMessage[] = [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Start working' }]
          },
        ];

        const contextSummary = require('./context').createContextSummary(conversationMessages);
        const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

        // Should still generate valid resume prompt
        expect(resumePrompt).toContain('🔄 SESSION RESUME CONTEXT');
        expect(resumePrompt).toContain('Messages exchanged: 1');
        expect(resumePrompt).toContain('No specific accomplishments identified');
        expect(resumePrompt).toContain('No significant decisions identified');
      });

      it('should extract enhanced context information for resume', () => {
        const task = createMockTask();
        task.description = 'Implement advanced search functionality';
        const checkpoint = createMockCheckpoint('implementation', 1);

        // Rich conversation with multiple decisions and progress
        const conversationMessages: AgentMessage[] = [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Implement advanced search with filters, sorting, and pagination' }]
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will implement a comprehensive search system. I\'ve decided to use Elasticsearch for full-text search because of performance requirements. Architecture: search service layer with caching. Using Redis for caching search results.'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Write',
              toolInput: { file_path: '/src/search/elasticsearch-client.ts', content: 'export class ElasticsearchClient {}' }
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Write',
              toolInput: { file_path: '/src/search/search-service.ts', content: 'export class SearchService {}' }
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Completed the Elasticsearch integration. Finished the search service implementation. Built the result aggregation system. Currently working on implementing the filtering logic.'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Edit',
              toolInput: { file_path: '/src/search/filters.ts', old_string: 'basic filters', new_string: 'advanced filters with validation' }
            }],
          },
        ];

        const contextSummary = require('./context').createContextSummary(conversationMessages);
        const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

        // Verify comprehensive resume context
        expect(resumePrompt).toContain('Implement advanced search functionality');
        expect(resumePrompt).toContain('Stage "implementation" (index 1)');

        // Key decisions should be extracted
        expect(resumePrompt).toContain('Key Decisions Made');
        expect(resumePrompt).toContain('Elasticsearch for full-text search');
        expect(resumePrompt).toContain('search service layer with caching');
        expect(resumePrompt).toContain('Redis for caching search results');

        // Accomplishments should be extracted
        expect(resumePrompt).toContain('What Was Accomplished');
        expect(resumePrompt).toContain('Elasticsearch integration');
        expect(resumePrompt).toContain('search service implementation');
        expect(resumePrompt).toContain('result aggregation system');

        // File modifications should be tracked
        expect(resumePrompt).toContain('Files written: /src/search/elasticsearch-client.ts, /src/search/search-service.ts');
        expect(resumePrompt).toContain('Files edited: /src/search/filters.ts');

        // Progress tracking
        expect(resumePrompt).toContain('implementing the filtering logic');
      });

      it('should format resume prompt consistently with buildResumePrompt patterns', () => {
        const task = createMockTask();
        task.description = 'Test consistent formatting';
        const checkpoint = createMockCheckpoint('testing', 2, new Date(Date.now() - (45 * 60 * 1000))); // 45 min ago

        const conversationMessages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Built comprehensive test suite. ✅ All unit tests passing. Decided to use Jest for testing framework.'
            }],
          },
        ];

        const contextSummary = require('./context').createContextSummary(conversationMessages);
        const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

        // Verify consistent formatting
        expect(resumePrompt).toContain('🔄 SESSION RESUME CONTEXT');
        expect(resumePrompt).toMatch(/\*\*Resuming Task\*\*: Test consistent formatting/);
        expect(resumePrompt).toMatch(/\*\*Resume Point\*\*: Stage "testing" \(index 2\)/);
        expect(resumePrompt).toMatch(/\*\*Last Checkpoint\*\*: 45m 0s ago/);
        expect(resumePrompt).toContain('### Prior Context Summary');
        expect(resumePrompt).toContain('### What Was Accomplished');
        expect(resumePrompt).toContain('### Key Decisions Made');
        expect(resumePrompt).toContain('### What Happens Next');
        expect(resumePrompt).toContain('comprehensive test suite');
        expect(resumePrompt).toContain('Jest for testing framework');
      });

      it('should handle edge case with null/undefined values in context', () => {
        const task = createMockTask();
        const checkpoint = createMockCheckpoint();

        // Context summary with potential null/undefined handling
        const contextSummary = ''; // Empty context

        const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

        // Should still generate valid prompt without errors
        expect(resumePrompt).toContain('🔄 SESSION RESUME CONTEXT');
        expect(resumePrompt).toContain('No specific accomplishments identified');
        expect(resumePrompt).toContain('No significant decisions identified');
        expect(resumePrompt).toContain('What Happens Next');

        // Should not throw error
        expect(() => buildResumePrompt(task, checkpoint, contextSummary)).not.toThrow();
      });
    });
  });
});
