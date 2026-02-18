import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildOrchestratorPrompt,
  buildAgentDefinitions,
  buildCompletionSummary,
  buildStagePrompt,
  buildPlannerStagePrompt,
  parseDecompositionRequest,
  isPlanningStage,
  isCodeGenerationStage,
  buildResumePrompt,
  buildCoordinatorPrompt,
  type DecompositionRequest,
  type PromptContext,
  type StagePromptContext,
} from '../prompts';
import type {
  Task,
  WorkflowDefinition,
  WorkflowStage,
  AgentDefinition,
  StageResult,
  TaskCheckpoint,
  SubtaskStrategy,
} from '@apexcli/core';

describe('prompts.ts', () => {
  // Mock data for tests
  let mockConfig: any;
  let mockTask: Task;
  let mockWorkflow: WorkflowDefinition;
  let mockAgents: Record<string, AgentDefinition>;
  let mockContext: PromptContext;

  beforeEach(() => {
    mockConfig = {
      project: {
        name: 'Test Project',
        language: 'TypeScript',
        framework: 'Node.js',
      },
      git: {
        branchPrefix: 'feature/',
        commitFormat: 'conventional',
      },
      limits: {
        maxTokensPerTask: 10000,
      },
      agents: {
        enabled: [],
        disabled: [],
      },
    };

    mockTask = {
      id: 'test-123',
      description: 'Test task description',
      acceptanceCriteria: 'Task should be completed successfully',
      autonomy: 'full-auto',
      status: 'running',
      branchName: 'feature/test-123',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      completedAt: new Date('2024-01-01T01:00:00Z'),
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.025,
      },
      artifacts: [
        { name: 'test.ts', type: 'file' },
        { name: 'test.spec.ts', type: 'test' },
      ],
    } as Task;

    mockWorkflow = {
      name: 'feature',
      description: 'Feature development workflow',
      stages: [
        {
          name: 'planning',
          description: 'Plan the implementation',
          agent: 'planner',
          parallel: false,
          outputs: ['implementation_plan'],
        },
        {
          name: 'implementation',
          description: 'Implement the feature',
          agent: 'developer',
          parallel: false,
          dependsOn: ['planning'],
          outputs: ['code_changes', 'files_modified'],
        },
        {
          name: 'testing',
          description: 'Create and run tests',
          agent: 'tester',
          parallel: false,
          dependsOn: ['implementation'],
          outputs: ['test_files', 'coverage_report'],
        },
      ],
    };

    mockAgents = {
      planner: {
        name: 'planner',
        description: 'Plans implementation strategy',
        prompt: 'You are a planning agent.',
        tools: ['Read', 'Grep'],
        model: 'sonnet',
      },
      developer: {
        name: 'developer',
        description: 'Implements code changes',
        prompt: 'You are a development agent.',
        tools: ['Read', 'Write', 'Edit'],
        model: 'sonnet',
      },
      tester: {
        name: 'tester',
        description: 'Creates and runs tests',
        prompt: 'You are a testing agent.',
        tools: ['Read', 'Write', 'Bash'],
        model: 'haiku',
      },
    };

    mockContext = {
      config: mockConfig,
      workflow: mockWorkflow,
      task: mockTask,
      agents: mockAgents,
    };
  });

  describe('buildOrchestratorPrompt', () => {
    it('should build a complete orchestrator prompt with all context', () => {
      const prompt = buildOrchestratorPrompt(mockContext);

      expect(prompt).toContain('APEX Orchestrator');
      expect(prompt).toContain('Test Project');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('Node.js');
      expect(prompt).toContain('test-123');
      expect(prompt).toContain('feature/test-123');
      expect(prompt).toContain('full-auto');
      expect(prompt).toContain('feature');
      expect(prompt).toContain('Feature development workflow');
      expect(prompt).toContain('planner: Plans implementation strategy');
      expect(prompt).toContain('developer: Implements code changes');
      expect(prompt).toContain('tester: Creates and runs tests');
      expect(prompt).toContain('planning (planner)');
      expect(prompt).toContain('implementation (developer)');
      expect(prompt).toContain('testing (tester)');
      expect(prompt).toContain('10,000 tokens');
    });

    it('should handle different autonomy levels', () => {
      mockTask.autonomy = 'review-before-commit';
      const prompt = buildOrchestratorPrompt(mockContext);
      expect(prompt).toContain('Pause before each git commit');

      mockTask.autonomy = 'review-all';
      const prompt2 = buildOrchestratorPrompt(mockContext);
      expect(prompt2).toContain('Pause at each major stage');
    });

    it('should handle optional project properties', () => {
      delete mockConfig.project.language;
      delete mockConfig.project.framework;
      const prompt = buildOrchestratorPrompt(mockContext);

      expect(prompt).toContain('Test Project');
      expect(prompt).not.toContain('Language:');
      expect(prompt).not.toContain('Framework:');
    });

    it('should handle parallel stages', () => {
      mockWorkflow.stages[1].parallel = true;
      const prompt = buildOrchestratorPrompt(mockContext);
      expect(prompt).toContain('implementation (developer) [parallel]');
    });

    it('should handle missing branch name', () => {
      delete mockTask.branchName;
      const prompt = buildOrchestratorPrompt(mockContext);
      expect(prompt).toContain('Branch: TBD');
    });
  });

  describe('buildAgentDefinitions', () => {
    it('should convert agents to SDK format', () => {
      const sdkAgents = buildAgentDefinitions(mockAgents, mockConfig);

      expect(sdkAgents).toHaveProperty('planner');
      expect(sdkAgents).toHaveProperty('developer');
      expect(sdkAgents).toHaveProperty('tester');

      expect(sdkAgents.planner).toEqual({
        description: 'Plans implementation strategy',
        prompt: expect.stringContaining('You are a planning agent.'),
        tools: ['Read', 'Grep'],
        model: 'sonnet',
      });

      expect(sdkAgents.planner.prompt).toContain('APEX Integration');
      expect(sdkAgents.planner.prompt).toContain('Update status:');
      expect(sdkAgents.planner.prompt).toContain('Log progress:');
    });

    it('should filter disabled agents', () => {
      mockConfig.agents.disabled = ['tester'];
      const sdkAgents = buildAgentDefinitions(mockAgents, mockConfig);

      expect(sdkAgents).toHaveProperty('planner');
      expect(sdkAgents).toHaveProperty('developer');
      expect(sdkAgents).not.toHaveProperty('tester');
    });

    it('should only include enabled agents when specified', () => {
      mockConfig.agents.enabled = ['planner', 'developer'];
      const sdkAgents = buildAgentDefinitions(mockAgents, mockConfig);

      expect(sdkAgents).toHaveProperty('planner');
      expect(sdkAgents).toHaveProperty('developer');
      expect(sdkAgents).not.toHaveProperty('tester');
    });

    it('should handle empty enabled list by including all non-disabled agents', () => {
      mockConfig.agents.enabled = [];
      mockConfig.agents.disabled = ['tester'];
      const sdkAgents = buildAgentDefinitions(mockAgents, mockConfig);

      expect(sdkAgents).toHaveProperty('planner');
      expect(sdkAgents).toHaveProperty('developer');
      expect(sdkAgents).not.toHaveProperty('tester');
    });
  });

  describe('buildCompletionSummary', () => {
    it('should build a formatted completion summary', () => {
      const summary = buildCompletionSummary(mockTask);

      expect(summary).toContain('Task Completion Summary');
      expect(summary).toContain('Test task description');
      expect(summary).toContain('running');
      expect(summary).toContain('1h 0m');
      expect(summary).toContain('Input: 1,000');
      expect(summary).toContain('Output: 500');
      expect(summary).toContain('Total: 1,500');
      expect(summary).toContain('$0.0250');
      expect(summary).toContain('test.ts (file)');
      expect(summary).toContain('test.spec.ts (test)');
    });

    it('should handle tasks without completion time', () => {
      delete mockTask.completedAt;
      const summary = buildCompletionSummary(mockTask);
      expect(summary).toContain('Task Completion Summary');
    });

    it('should handle tasks with errors', () => {
      mockTask.error = 'Something went wrong';
      const summary = buildCompletionSummary(mockTask);
      expect(summary).toContain('Error');
      expect(summary).toContain('Something went wrong');
    });

    it('should handle tasks without artifacts', () => {
      mockTask.artifacts = [];
      const summary = buildCompletionSummary(mockTask);
      expect(summary).toContain('None');
    });
  });

  describe('buildStagePrompt', () => {
    let mockStageContext: StagePromptContext;
    let mockPreviousResults: Map<string, StageResult>;

    beforeEach(() => {
      mockPreviousResults = new Map([
        [
          'planning',
          {
            agent: 'planner',
            status: 'completed',
            summary: 'Created implementation plan with database schema and API endpoints',
            outputs: {
              implementation_plan: 'Detailed plan with 3 phases',
              database_schema: 'User, Task, Project tables',
            },
            artifacts: ['plan.md', 'schema.sql'],
            startedAt: new Date('2024-01-01T00:00:00Z'),
            completedAt: new Date('2024-01-01T00:30:00Z'),
          },
        ],
      ]);

      mockStageContext = {
        task: mockTask,
        stage: mockWorkflow.stages[1], // implementation stage
        agent: mockAgents.developer,
        workflow: mockWorkflow,
        config: mockConfig,
        previousStageResults: mockPreviousResults,
      };
    });

    it('should build a stage-specific prompt with context', () => {
      const prompt = buildStagePrompt(mockStageContext);

      expect(prompt).toContain('# Developer Agent - implementation Stage');
      expect(prompt).toContain('developer agent working on the implementation stage');
      expect(prompt).toContain('Implements code changes');
      expect(prompt).toContain('Test task description');
      expect(prompt).toContain('Task should be completed successfully');
      expect(prompt).toContain('Implement the feature');
      expect(prompt).toContain('Test Project');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('feature/test-123');
      expect(prompt).toContain('implementation');
      expect(prompt).toContain('npm run build');
      expect(prompt).toContain('npm run test');
    });

    it('should include inputs from previous stages', () => {
      const prompt = buildStagePrompt(mockStageContext);

      expect(prompt).toContain('Inputs from Previous Stages');
      expect(prompt).toContain('From planning stage (planner):');
      expect(prompt).toContain('Created implementation plan');
      expect(prompt).toContain('implementation_plan: Detailed plan with 3 phases');
      expect(prompt).toContain('database_schema: User, Task, Project tables');
      expect(prompt).toContain('plan.md, schema.sql');
    });

    it('should include previous work completed', () => {
      const prompt = buildStagePrompt(mockStageContext);

      expect(prompt).toContain('Previous Work Completed');
      expect(prompt).toContain('planning (planner): completed - Created implementation plan');
    });

    it('should format expected outputs', () => {
      const prompt = buildStagePrompt(mockStageContext);

      expect(prompt).toContain('Expected Outputs');
      expect(prompt).toContain('code_changes: Provide this in your summary');
      expect(prompt).toContain('files_modified: Provide this in your summary');
    });

    it('should handle stage without dependencies', () => {
      mockStageContext.stage = mockWorkflow.stages[0]; // planning stage
      mockStageContext.agent = mockAgents.planner;
      mockStageContext.previousStageResults = new Map();

      const prompt = buildStagePrompt(mockStageContext);
      expect(prompt).not.toContain('Inputs from Previous Stages');
    });

    it('should handle stage without outputs', () => {
      mockStageContext.stage.outputs = [];
      const prompt = buildStagePrompt(mockStageContext);
      expect(prompt).toContain('Complete your assigned work for this stage');
    });

    it('should handle missing acceptance criteria', () => {
      delete mockTask.acceptanceCriteria;
      const prompt = buildStagePrompt(mockStageContext);
      expect(prompt).not.toContain('Acceptance Criteria');
    });
  });

  describe('buildPlannerStagePrompt', () => {
    let mockPlannerContext: StagePromptContext;

    beforeEach(() => {
      mockPlannerContext = {
        task: mockTask,
        stage: mockWorkflow.stages[0], // planning stage
        agent: mockAgents.planner,
        workflow: mockWorkflow,
        config: mockConfig,
        previousStageResults: new Map(),
      };
    });

    it('should build a specialized planner prompt', () => {
      const prompt = buildPlannerStagePrompt(mockPlannerContext);

      expect(prompt).toContain('# Planner Agent - Planning Stage');
      expect(prompt).toContain('responsible for planning the implementation');
      expect(prompt).toContain('Plans implementation strategy');
      expect(prompt).toContain('Test task description');
      expect(prompt).toContain('Task should be completed successfully');
      expect(prompt).toContain('CRITICAL: Task Analysis and Decomposition');
      expect(prompt).toContain('MUST DECOMPOSE if the task:');
      expect(prompt).toContain('Decomposition Format');
      expect(prompt).toContain('```decompose');
      expect(prompt).toContain('strategy": "sequential|parallel|dependency-based');
    });

    it('should include project context', () => {
      const prompt = buildPlannerStagePrompt(mockPlannerContext);

      expect(prompt).toContain('Test Project');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('feature');
    });

    it('should include decomposition strategies', () => {
      const prompt = buildPlannerStagePrompt(mockPlannerContext);

      expect(prompt).toContain('sequential: Subtasks must run in order');
      expect(prompt).toContain('parallel: Independent subtasks');
      expect(prompt).toContain('dependency-based: Subtasks run when their explicit dependencies complete');
    });
  });

  describe('parseDecompositionRequest', () => {
    it('should parse valid decomposition request', () => {
      const output = `
Analysis shows this task needs decomposition.

\`\`\`decompose
{
  "reason": "Complex feature needs breakdown",
  "strategy": "sequential",
  "subtasks": [
    {
      "description": "Create user model",
      "acceptanceCriteria": "Model validates email format",
      "workflow": "feature"
    },
    {
      "description": "Build API endpoints",
      "acceptanceCriteria": "CRUD operations work",
      "dependsOn": ["Create user model"]
    }
  ]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(true);
      expect(result.strategy).toBe('sequential');
      expect(result.reason).toBe('Complex feature needs breakdown');
      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks[0].description).toBe('Create user model');
      expect(result.subtasks[0].acceptanceCriteria).toBe('Model validates email format');
      expect(result.subtasks[1].dependsOn).toEqual(['Create user model']);
    });

    it('should return no decomposition when no block found', () => {
      const output = 'Simple analysis with no decomposition block.';
      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(false);
      expect(result.subtasks).toHaveLength(0);
      expect(result.strategy).toBe('sequential');
    });

    it('should handle invalid JSON gracefully', () => {
      const output = `
\`\`\`decompose
{invalid json here}
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
  "reason": "Complex task",
  "strategy": "parallel"
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(false);
      expect(result.subtasks).toHaveLength(0);
    });

    it('should handle empty subtasks array', () => {
      const output = `
\`\`\`decompose
{
  "subtasks": []
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(false);
      expect(result.subtasks).toHaveLength(0);
    });

    it('should validate and normalize subtasks', () => {
      const output = `
\`\`\`decompose
{
  "strategy": "parallel",
  "subtasks": [
    {
      "description": "Valid task"
    },
    {
      "description": "",
      "acceptanceCriteria": "Should be filtered out"
    },
    {
      "description": "Another valid task",
      "acceptanceCriteria": "With criteria",
      "workflow": "feature",
      "dependsOn": ["Valid task"]
    }
  ]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.shouldDecompose).toBe(true);
      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks[0].description).toBe('Valid task');
      expect(result.subtasks[1].description).toBe('Another valid task');
      expect(result.subtasks[1].dependsOn).toEqual(['Valid task']);
    });

    it('should default invalid strategy to sequential', () => {
      const output = `
\`\`\`decompose
{
  "strategy": "invalid-strategy",
  "subtasks": [
    {"description": "Test task"}
  ]
}
\`\`\`
      `;

      const result = parseDecompositionRequest(output);

      expect(result.strategy).toBe('sequential');
    });
  });

  describe('isPlanningStage', () => {
    it('should identify planning stages by name', () => {
      const planningStage1 = { name: 'planning', agent: 'developer' } as WorkflowStage;
      const planningStage2 = { name: 'plan', agent: 'developer' } as WorkflowStage;

      expect(isPlanningStage(planningStage1)).toBe(true);
      expect(isPlanningStage(planningStage2)).toBe(true);
    });

    it('should identify planning stages by agent', () => {
      const planningStage = { name: 'analysis', agent: 'planner' } as WorkflowStage;

      expect(isPlanningStage(planningStage)).toBe(true);
    });

    it('should return false for non-planning stages', () => {
      const devStage = { name: 'implementation', agent: 'developer' } as WorkflowStage;
      const testStage = { name: 'testing', agent: 'tester' } as WorkflowStage;

      expect(isPlanningStage(devStage)).toBe(false);
      expect(isPlanningStage(testStage)).toBe(false);
    });
  });

  describe('isCodeGenerationStage', () => {
    it('should identify code generation stages by agent', () => {
      const devStage = { name: 'implementation', agent: 'developer' } as WorkflowStage;
      const testStage = { name: 'testing', agent: 'tester' } as WorkflowStage;

      expect(isCodeGenerationStage(devStage)).toBe(true);
      expect(isCodeGenerationStage(testStage)).toBe(true);
    });

    it('should identify code generation stages by outputs', () => {
      const stage1 = {
        name: 'build',
        agent: 'builder',
        outputs: ['code_changes', 'documentation']
      } as WorkflowStage;

      const stage2 = {
        name: 'generate',
        agent: 'generator',
        outputs: ['test_files']
      } as WorkflowStage;

      expect(isCodeGenerationStage(stage1)).toBe(true);
      expect(isCodeGenerationStage(stage2)).toBe(true);
    });

    it('should identify code generation stages by name', () => {
      const stages: WorkflowStage[] = [
        { name: 'implementation', agent: 'other' },
        { name: 'testing', agent: 'other' },
        { name: 'development', agent: 'other' },
        { name: 'coding', agent: 'other' },
        { name: 'build', agent: 'other' },
      ].map(s => s as WorkflowStage);

      stages.forEach(stage => {
        expect(isCodeGenerationStage(stage)).toBe(true);
      });
    });

    it('should return false for non-code generation stages', () => {
      const planStage = { name: 'planning', agent: 'planner' } as WorkflowStage;
      const reviewStage = { name: 'review', agent: 'reviewer' } as WorkflowStage;

      expect(isCodeGenerationStage(planStage)).toBe(false);
      expect(isCodeGenerationStage(reviewStage)).toBe(false);
    });
  });

  describe('buildResumePrompt', () => {
    let mockCheckpoint: TaskCheckpoint;

    beforeEach(() => {
      mockCheckpoint = {
        taskId: 'test-123',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        stage: 'implementation',
        stageIndex: 1,
        conversationContext: 'Previous conversation context',
      };
    });

    it('should build resume prompt with context summary', () => {
      const contextSummary = 'Created user authentication system with JWT tokens. Implemented login and registration endpoints. Added password hashing with bcrypt.';

      const prompt = buildResumePrompt(mockTask, mockCheckpoint, contextSummary);

      expect(prompt).toContain('SESSION RESUME CONTEXT');
      expect(prompt).toContain('Test task description');
      expect(prompt).toContain('Stage "implementation"');
      expect(prompt).toContain('index 1');
      expect(prompt).toContain('Prior Context Summary');
      expect(prompt).toContain(contextSummary);
      expect(prompt).toContain('What Was Accomplished');
      expect(prompt).toContain('Key Decisions Made');
      expect(prompt).toContain('What Happens Next');
      expect(prompt).toContain('This is a continuation of previous work');
    });

    it('should extract accomplishments from context', () => {
      const contextSummary = `
Task completed successfully.
- Created user model with validation
- Implemented authentication endpoints
- Generated JWT tokens for session management
- Built registration form with email validation
✓ Added password hashing with bcrypt
Finished setting up database migrations
      `;

      const prompt = buildResumePrompt(mockTask, mockCheckpoint, contextSummary);

      expect(prompt).toContain('user model with validation');
      expect(prompt).toContain('authentication endpoints');
      expect(prompt).toContain('Added password hashing with bcrypt');
    });

    it('should extract key decisions from context', () => {
      const contextSummary = `
Decided to use JWT tokens for authentication.
Database approach: Using PostgreSQL for user data.
Architecture decision: MVC pattern with Express controllers.
Selected bcrypt for password hashing because of security requirements.
Using Redis for session storage due to performance needs.
      `;

      const prompt = buildResumePrompt(mockTask, mockCheckpoint, contextSummary);

      expect(prompt).toContain('use JWT tokens for authentication');
      expect(prompt).toContain('Using PostgreSQL for user data');
      expect(prompt).toContain('MVC pattern with Express controllers');
      expect(prompt).toContain('bcrypt for password hashing because of security requirements');
    });

    it('should handle empty context gracefully', () => {
      const contextSummary = '';

      const prompt = buildResumePrompt(mockTask, mockCheckpoint, contextSummary);

      expect(prompt).toContain('No specific accomplishments identified');
      expect(prompt).toContain('No significant decisions identified');
    });

    it('should format checkpoint age', () => {
      // Mock current time to be 2 hours after checkpoint
      const originalDate = Date;
      global.Date = class extends originalDate {
        constructor() {
          super();
          return new originalDate('2024-01-01T12:00:00Z');
        }
        static now() {
          return new originalDate('2024-01-01T12:00:00Z').getTime();
        }
      } as any;

      const prompt = buildResumePrompt(mockTask, mockCheckpoint, 'test context');

      expect(prompt).toContain('2h 0m ago');

      // Restore original Date
      global.Date = originalDate;
    });
  });

  describe('buildCoordinatorPrompt', () => {
    let mockCompletedStages: Map<string, StageResult>;

    beforeEach(() => {
      mockCompletedStages = new Map([
        [
          'planning',
          {
            agent: 'planner',
            status: 'completed',
            summary: 'Plan created successfully',
            outputs: {},
            artifacts: [],
            startedAt: new Date(),
            completedAt: new Date(),
          },
        ],
      ]);
    });

    it('should build coordinator prompt with workflow status', () => {
      const currentStage = mockWorkflow.stages[1]; // implementation

      const prompt = buildCoordinatorPrompt(
        mockTask,
        mockWorkflow,
        mockCompletedStages,
        currentStage
      );

      expect(prompt).toContain('Workflow Coordination');
      expect(prompt).toContain('Test task description');
      expect(prompt).toContain('feature');
      expect(prompt).toContain('Feature development workflow');
      expect(prompt).toContain('Stage Status');
      expect(prompt).toContain('planning: completed');
      expect(prompt).toContain('implementation: IN PROGRESS');
      expect(prompt).toContain('testing: pending');
      expect(prompt).toContain('Decision Required');
      expect(prompt).toContain('Continue to next stage');
      expect(prompt).toContain('Retry failed stage');
    });

    it('should include error information when provided', () => {
      const error = 'Build failed with TypeScript errors';

      const prompt = buildCoordinatorPrompt(
        mockTask,
        mockWorkflow,
        mockCompletedStages,
        undefined,
        error
      );

      expect(prompt).toContain('Error in Current Stage');
      expect(prompt).toContain(error);
    });

    it('should handle workflow without current stage', () => {
      const prompt = buildCoordinatorPrompt(
        mockTask,
        mockWorkflow,
        mockCompletedStages
      );

      expect(prompt).toContain('planning: completed');
      expect(prompt).toContain('implementation: pending');
      expect(prompt).toContain('testing: pending');
    });
  });
});