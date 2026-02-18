import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildOrchestratorPrompt,
  buildAgentDefinitions,
  buildStagePrompt,
  buildPlannerStagePrompt,
  parseDecompositionRequest,
  isPlanningStage,
  isCodeGenerationStage,
  type PromptContext,
  type StagePromptContext,
} from '../prompts';
import type {
  Task,
  WorkflowDefinition,
  AgentDefinition,
  StageResult,
} from '@apexcli/core';

describe('prompts.ts - Integration Tests', () => {
  let mockFullContext: {
    config: any;
    task: Task;
    workflow: WorkflowDefinition;
    agents: Record<string, AgentDefinition>;
  };

  beforeEach(() => {
    mockFullContext = {
      config: {
        project: {
          name: 'E-Commerce Platform',
          language: 'TypeScript',
          framework: 'Next.js',
        },
        git: {
          branchPrefix: 'feature/',
          commitFormat: 'conventional',
        },
        limits: {
          maxTokensPerTask: 50000,
        },
        agents: {
          enabled: ['planner', 'developer', 'tester', 'reviewer'],
          disabled: [],
        },
      },
      task: {
        id: 'ecom-auth-system',
        description: 'Implement complete user authentication system with JWT tokens, password reset, and email verification',
        acceptanceCriteria: `
- Users can register with email/password
- Email verification required for activation
- Login with JWT token generation
- Password reset via email link
- Protected routes middleware
- Unit and integration tests with >90% coverage
        `,
        autonomy: 'review-before-commit',
        status: 'running',
        branchName: 'feature/ecom-auth-system-jwt-implementation',
        createdAt: new Date('2024-01-01T09:00:00Z'),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        artifacts: [],
      } as Task,
      workflow: {
        name: 'feature-development',
        description: 'Complete feature development with planning, implementation, testing, and review',
        stages: [
          {
            name: 'planning',
            description: 'Analyze requirements and create implementation plan',
            agent: 'planner',
            parallel: false,
            outputs: ['implementation_plan', 'architecture_decisions', 'task_breakdown'],
          },
          {
            name: 'database-design',
            description: 'Design database schema and migrations',
            agent: 'developer',
            parallel: false,
            dependsOn: ['planning'],
            outputs: ['schema_files', 'migration_scripts'],
          },
          {
            name: 'api-implementation',
            description: 'Implement REST API endpoints',
            agent: 'developer',
            parallel: false,
            dependsOn: ['database-design'],
            outputs: ['api_endpoints', 'middleware', 'validation_schemas'],
          },
          {
            name: 'frontend-integration',
            description: 'Create UI components and integrate with API',
            agent: 'developer',
            parallel: true, // Can run alongside testing prep
            dependsOn: ['api-implementation'],
            outputs: ['ui_components', 'form_handlers', 'state_management'],
          },
          {
            name: 'testing',
            description: 'Create comprehensive test suite',
            agent: 'tester',
            parallel: false,
            dependsOn: ['api-implementation', 'frontend-integration'],
            outputs: ['unit_tests', 'integration_tests', 'coverage_report'],
          },
          {
            name: 'code-review',
            description: 'Review code quality and security',
            agent: 'reviewer',
            parallel: false,
            dependsOn: ['testing'],
            outputs: ['review_report', 'security_analysis'],
          },
        ],
      },
      agents: {
        planner: {
          name: 'planner',
          description: 'Senior architect who analyzes requirements and creates detailed implementation plans',
          prompt: 'You are a senior software architect with expertise in system design and project planning.',
          tools: ['Read', 'Grep', 'Glob', 'WebSearch'],
          model: 'sonnet',
        },
        developer: {
          name: 'developer',
          description: 'Full-stack developer specializing in TypeScript, Node.js, and React',
          prompt: 'You are an experienced full-stack developer with deep knowledge of modern web technologies.',
          tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
          model: 'sonnet',
        },
        tester: {
          name: 'tester',
          description: 'QA engineer focused on test automation and quality assurance',
          prompt: 'You are a QA engineer specializing in test-driven development and automated testing.',
          tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep'],
          model: 'haiku',
        },
        reviewer: {
          name: 'reviewer',
          description: 'Security-focused code reviewer ensuring best practices and security standards',
          prompt: 'You are a senior developer focused on code quality, security, and best practices.',
          tools: ['Read', 'Grep', 'Glob'],
          model: 'sonnet',
        },
      },
    };
  });

  describe('Complete Workflow Integration', () => {
    it('should create orchestrator prompt with all workflow context', () => {
      const prompt = buildOrchestratorPrompt(mockFullContext as PromptContext);

      // Verify all key elements are present
      expect(prompt).toContain('APEX Orchestrator');
      expect(prompt).toContain('E-Commerce Platform');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('Next.js');
      expect(prompt).toContain('ecom-auth-system');
      expect(prompt).toContain('feature/ecom-auth-system-jwt-implementation');
      expect(prompt).toContain('review-before-commit');
      expect(prompt).toContain('Pause before each git commit');

      // Verify all agents are included
      expect(prompt).toContain('planner: Senior architect');
      expect(prompt).toContain('developer: Full-stack developer');
      expect(prompt).toContain('tester: QA engineer');
      expect(prompt).toContain('reviewer: Security-focused code reviewer');

      // Verify workflow stages
      expect(prompt).toContain('planning (planner)');
      expect(prompt).toContain('database-design (developer)');
      expect(prompt).toContain('frontend-integration (developer) [parallel]');
      expect(prompt).toContain('50,000 tokens');
    });

    it('should build agent definitions for orchestrator use', () => {
      const agents = buildAgentDefinitions(mockFullContext.agents, mockFullContext.config);

      expect(Object.keys(agents)).toEqual(['planner', 'developer', 'tester', 'reviewer']);

      // Verify enhanced prompts
      expect(agents.planner.prompt).toContain('You are a senior software architect');
      expect(agents.planner.prompt).toContain('APEX Integration');
      expect(agents.planner.prompt).toContain('Update status:');
      expect(agents.planner.prompt).toContain('Log progress:');

      // Verify tools and models are preserved
      expect(agents.developer.tools).toContain('Read');
      expect(agents.developer.tools).toContain('Write');
      expect(agents.tester.model).toBe('haiku');
    });

    it('should handle full planning stage workflow', () => {
      const stageContext: StagePromptContext = {
        task: mockFullContext.task,
        stage: mockFullContext.workflow.stages[0], // planning
        agent: mockFullContext.agents.planner,
        workflow: mockFullContext.workflow,
        config: mockFullContext.config,
        previousStageResults: new Map(),
      };

      // Verify it's identified as a planning stage
      expect(isPlanningStage(stageContext.stage)).toBe(true);

      // Build specialized planner prompt
      const plannerPrompt = buildPlannerStagePrompt(stageContext);
      expect(plannerPrompt).toContain('Planner Agent - Planning Stage');
      expect(plannerPrompt).toContain('Implement complete user authentication system');
      expect(plannerPrompt).toContain('CRITICAL: Task Analysis and Decomposition');
      expect(plannerPrompt).toContain('MUST DECOMPOSE if the task:');
      expect(plannerPrompt).toContain('multiple features or components');

      // This complex task should likely trigger decomposition
      const mockPlannerOutput = `
This task requires implementing a complete authentication system with multiple components:
- User registration and email verification
- Login/logout with JWT tokens
- Password reset functionality
- Protected route middleware
- Comprehensive testing

This clearly needs decomposition into manageable subtasks.

\`\`\`decompose
{
  "reason": "Authentication system involves multiple independent components that can be developed and tested separately",
  "strategy": "dependency-based",
  "subtasks": [
    {
      "description": "Design and implement user database schema with migrations",
      "acceptanceCriteria": "User table with email, password hash, verification status, created/updated timestamps",
      "workflow": "feature"
    },
    {
      "description": "Implement user registration with email verification",
      "acceptanceCriteria": "Users can register, receive verification email, and activate account",
      "workflow": "feature",
      "dependsOn": ["Design and implement user database schema with migrations"]
    },
    {
      "description": "Implement JWT-based login/logout system",
      "acceptanceCriteria": "Users can login with email/password, receive JWT token, logout invalidates token",
      "workflow": "feature",
      "dependsOn": ["Design and implement user database schema with migrations"]
    },
    {
      "description": "Implement password reset via email",
      "acceptanceCriteria": "Users can request password reset, receive email with secure link, update password",
      "workflow": "feature",
      "dependsOn": ["Implement JWT-based login/logout system"]
    },
    {
      "description": "Create protected routes middleware",
      "acceptanceCriteria": "Middleware validates JWT tokens and protects authenticated routes",
      "workflow": "feature",
      "dependsOn": ["Implement JWT-based login/logout system"]
    },
    {
      "description": "Build comprehensive test suite for authentication system",
      "acceptanceCriteria": "Unit and integration tests covering all auth flows with >90% coverage",
      "workflow": "testing",
      "dependsOn": ["Implement password reset via email", "Create protected routes middleware"]
    }
  ]
}
\`\`\`
      `;

      const decomposition = parseDecompositionRequest(mockPlannerOutput);
      expect(decomposition.shouldDecompose).toBe(true);
      expect(decomposition.strategy).toBe('dependency-based');
      expect(decomposition.subtasks).toHaveLength(6);
      expect(decomposition.subtasks[0].description).toContain('database schema');
      expect(decomposition.subtasks[5].dependsOn).toContain('Implement password reset via email');
    });

    it('should handle development stage with planning inputs', () => {
      const planningResult: StageResult = {
        agent: 'planner',
        status: 'completed',
        summary: 'Created comprehensive implementation plan for authentication system with 6 subtasks and dependency mapping',
        outputs: {
          implementation_plan: `Authentication System Implementation Plan:
1. Database schema design with User table, indexes, and constraints
2. Email verification service with token generation and SMTP integration
3. JWT token management with secure signing and validation
4. Password hashing with bcrypt and salt rounds
5. Protected route middleware with role-based access
6. Comprehensive test coverage for all auth flows`,
          architecture_decisions: `Key decisions:
- Using JWT tokens for stateless authentication
- bcrypt for password hashing with 12 salt rounds
- PostgreSQL for user data with proper indexing
- Email verification required before account activation
- Refresh token rotation for enhanced security`,
          task_breakdown: 'Decomposed into 6 sequential subtasks with clear dependencies',
        },
        artifacts: ['auth-implementation-plan.md', 'auth-architecture-decisions.md'],
        startedAt: new Date('2024-01-01T09:00:00Z'),
        completedAt: new Date('2024-01-01T09:45:00Z'),
      };

      const stageContext: StagePromptContext = {
        task: mockFullContext.task,
        stage: mockFullContext.workflow.stages[1], // database-design
        agent: mockFullContext.agents.developer,
        workflow: mockFullContext.workflow,
        config: mockFullContext.config,
        previousStageResults: new Map([['planning', planningResult]]),
      };

      // Verify it's identified as a code generation stage
      expect(isCodeGenerationStage(stageContext.stage)).toBe(true);

      const stagePrompt = buildStagePrompt(stageContext);

      // Verify stage context
      expect(stagePrompt).toContain('Developer Agent - database-design Stage');
      expect(stagePrompt).toContain('Design database schema and migrations');
      expect(stagePrompt).toContain('Full-stack developer specializing');

      // Verify inputs from planning stage
      expect(stagePrompt).toContain('Inputs from Previous Stages');
      expect(stagePrompt).toContain('From planning stage (planner):');
      expect(stagePrompt).toContain('Created comprehensive implementation plan');
      expect(stagePrompt).toContain('implementation_plan: Authentication System Implementation Plan');
      expect(stagePrompt).toContain('architecture_decisions: Key decisions');
      expect(stagePrompt).toContain('auth-implementation-plan.md, auth-architecture-decisions.md');

      // Verify expected outputs
      expect(stagePrompt).toContain('Expected Outputs');
      expect(stagePrompt).toContain('schema_files: Provide this in your summary');
      expect(stagePrompt).toContain('migration_scripts: Provide this in your summary');

      // Verify critical validation requirements
      expect(stagePrompt).toContain('npm run build');
      expect(stagePrompt).toContain('npm run test');
      expect(stagePrompt).toContain('ALL tests must pass');
    });

    it('should handle testing stage with multiple dependencies', () => {
      const previousResults = new Map([
        [
          'planning',
          {
            agent: 'planner',
            status: 'completed',
            summary: 'Implementation plan created',
            outputs: { implementation_plan: 'Detailed plan...' },
            artifacts: [],
            startedAt: new Date(),
            completedAt: new Date(),
          },
        ],
        [
          'database-design',
          {
            agent: 'developer',
            status: 'completed',
            summary: 'Database schema and migrations created',
            outputs: {
              schema_files: 'users.sql, indexes.sql, constraints.sql',
              migration_scripts: '001_create_users.sql, 002_add_indexes.sql'
            },
            artifacts: ['migrations/001_create_users.sql', 'schema/users.sql'],
            startedAt: new Date(),
            completedAt: new Date(),
          },
        ],
        [
          'api-implementation',
          {
            agent: 'developer',
            status: 'completed',
            summary: 'REST API endpoints implemented with validation',
            outputs: {
              api_endpoints: '/auth/register, /auth/login, /auth/logout, /auth/reset-password',
              middleware: 'authMiddleware.ts, validationMiddleware.ts',
              validation_schemas: 'userValidation.ts, authValidation.ts'
            },
            artifacts: ['routes/auth.ts', 'middleware/auth.ts', 'validators/user.ts'],
            startedAt: new Date(),
            completedAt: new Date(),
          },
        ],
        [
          'frontend-integration',
          {
            agent: 'developer',
            status: 'completed',
            summary: 'UI components and form handlers implemented',
            outputs: {
              ui_components: 'LoginForm, RegisterForm, ResetPasswordForm',
              form_handlers: 'useAuth hook, form validation',
              state_management: 'auth context, user state'
            },
            artifacts: ['components/auth/', 'hooks/useAuth.ts', 'context/AuthContext.tsx'],
            startedAt: new Date(),
            completedAt: new Date(),
          },
        ],
      ]);

      const stageContext: StagePromptContext = {
        task: mockFullContext.task,
        stage: mockFullContext.workflow.stages[4], // testing
        agent: mockFullContext.agents.tester,
        workflow: mockFullContext.workflow,
        config: mockFullContext.config,
        previousStageResults,
      };

      const testingPrompt = buildStagePrompt(stageContext);

      // Verify inputs from all dependencies
      expect(testingPrompt).toContain('From api-implementation stage (developer):');
      expect(testingPrompt).toContain('From frontend-integration stage (developer):');
      expect(testingPrompt).toContain('/auth/register, /auth/login');
      expect(testingPrompt).toContain('LoginForm, RegisterForm');

      // Verify previous work summary
      expect(testingPrompt).toContain('Previous Work Completed');
      expect(testingPrompt).toContain('planning (planner): completed');
      expect(testingPrompt).toContain('database-design (developer): completed');
      expect(testingPrompt).toContain('api-implementation (developer): completed');
      expect(testingPrompt).toContain('frontend-integration (developer): completed');

      // Verify testing-specific outputs
      expect(testingPrompt).toContain('unit_tests: Provide this in your summary');
      expect(testingPrompt).toContain('integration_tests: Provide this in your summary');
      expect(testingPrompt).toContain('coverage_report: Provide this in your summary');
    });

    it('should demonstrate full workflow progression', () => {
      // This test shows how prompts would be used throughout a complete workflow

      // 1. Start with orchestrator prompt
      const orchestratorPrompt = buildOrchestratorPrompt(mockFullContext as PromptContext);
      expect(orchestratorPrompt).toContain('APEX Orchestrator');

      // 2. Get agent definitions for Claude SDK
      const agents = buildAgentDefinitions(mockFullContext.agents, mockFullContext.config);
      expect(Object.keys(agents)).toHaveLength(4);

      // 3. Planning stage should trigger decomposition
      const planningStage = mockFullContext.workflow.stages[0];
      expect(isPlanningStage(planningStage)).toBe(true);

      // 4. Development stages should be identified as code generation
      const devStages = mockFullContext.workflow.stages.slice(1, 4);
      devStages.forEach(stage => {
        expect(isCodeGenerationStage(stage)).toBe(true);
      });

      // 5. Testing stage should also be code generation (writes test files)
      const testingStage = mockFullContext.workflow.stages[4];
      expect(isCodeGenerationStage(testingStage)).toBe(true);

      // 6. Review stage should not be code generation
      const reviewStage = mockFullContext.workflow.stages[5];
      expect(isCodeGenerationStage(reviewStage)).toBe(false);

      // This demonstrates the complete workflow integration
      expect(mockFullContext.workflow.stages).toHaveLength(6);
      expect(mockFullContext.agents).toHaveProperty('planner');
      expect(mockFullContext.agents).toHaveProperty('developer');
      expect(mockFullContext.agents).toHaveProperty('tester');
      expect(mockFullContext.agents).toHaveProperty('reviewer');
    });
  });
});