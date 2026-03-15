/**
 * @fileoverview Schema Validation Benchmarks
 *
 * Measures Zod schema validation performance for various
 * schema types used in @apexcli/core.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  BenchmarkRunner,
  CORE_THRESHOLDS,
  BenchmarkReporter,
} from '../../../benchmarks/shared/index';
import {
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  ApexConfigSchema,
  ToolAliasSchema,
  MCPConfigSchema,
  MCPServerConfigSchema,
  PermissionRuleSchema,
  PolicyConfigSchema,
  GateSchema,
  HookConfigSchema,
} from '../src/types';

describe('Schema Validation Benchmarks', () => {
  const reporter = new BenchmarkReporter();

  beforeAll(() => {
    reporter.start();
  });

  afterAll(() => {
    reporter.printReport();
  });

  describe('Agent Definition Schema', () => {
    it('should benchmark AgentDefinition validation', async () => {
      const validAgent = {
        name: 'test-agent',
        description: 'A test agent for benchmarking',
        prompt: 'You are a test agent with specific capabilities.',
        tools: ['Read', 'Write', 'Edit'],
        model: 'sonnet',
        skills: ['typescript', 'testing'],
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'schema-validate-agent',
          iterations: 100,
          warmupIterations: 10,
          threshold: CORE_THRESHOLDS.schemaValidation.agentDefinition,
        },
        () => {
          const parsed = AgentDefinitionSchema.parse(validAgent);
          expect(parsed.name).toBe('test-agent');
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark AgentDefinition safeParse', async () => {
      const validAgent = {
        name: 'safe-parse-agent',
        description: 'Agent for safe parse benchmark',
        prompt: 'Test prompt content',
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'schema-safeParse-agent',
          iterations: 100,
          warmupIterations: 10,
          threshold: CORE_THRESHOLDS.schemaValidation.agentDefinition,
        },
        () => {
          const parseResult = AgentDefinitionSchema.safeParse(validAgent);
          expect(parseResult.success).toBe(true);
          return parseResult;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Workflow Definition Schema', () => {
    it('should benchmark WorkflowDefinition validation', async () => {
      const validWorkflow = {
        name: 'feature-development',
        description: 'Standard feature development workflow',
        version: '1.0',
        stages: [
          {
            name: 'planning',
            agent: 'planner',
            description: 'Plan the feature implementation',
          },
          {
            name: 'implementation',
            agent: 'developer',
            description: 'Implement the feature',
            dependsOn: ['planning'],
          },
          {
            name: 'review',
            agent: 'reviewer',
            description: 'Review the implementation',
            dependsOn: ['implementation'],
          },
          {
            name: 'testing',
            agent: 'tester',
            description: 'Test the feature',
            dependsOn: ['review'],
          },
        ],
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'schema-validate-workflow',
          iterations: 100,
          warmupIterations: 10,
          threshold: CORE_THRESHOLDS.schemaValidation.workflowDefinition,
        },
        () => {
          const parsed = WorkflowDefinitionSchema.parse(validWorkflow);
          expect(parsed.name).toBe('feature-development');
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark complex workflow with conditions', async () => {
      const complexWorkflow = {
        name: 'complex-workflow',
        description: 'Workflow with conditions and parallel stages',
        version: '2.0',
        stages: Array.from({ length: 10 }, (_, i) => ({
          name: `stage-${i}`,
          agent: i % 2 === 0 ? 'developer' : 'reviewer',
          description: `Stage ${i} description`,
          dependsOn: i > 0 ? [`stage-${i - 1}`] : undefined,
          condition: i > 5 ? 'always' : undefined,
        })),
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'schema-validate-workflow-complex',
          iterations: 50,
          warmupIterations: 5,
          threshold: {
            maxMean: 5,
            maxP95: 15,
          },
        },
        () => {
          const parsed = WorkflowDefinitionSchema.parse(complexWorkflow);
          expect(parsed.stages.length).toBe(10);
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Tool Alias Schema', () => {
    it('should benchmark ToolAlias validation', async () => {
      const validAlias = {
        name: 'test-alias',
        description: 'A test tool alias',
        command: 'echo "test"',
        args: ['--verbose'],
        env: {
          TEST_VAR: 'value',
        },
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'schema-validate-tool-alias',
          iterations: 100,
          warmupIterations: 10,
          threshold: CORE_THRESHOLDS.schemaValidation.toolAlias,
        },
        () => {
          const parsed = ToolAliasSchema.parse(validAlias);
          expect(parsed.name).toBe('test-alias');
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('MCP Config Schema', () => {
    it('should benchmark MCPConfig validation', async () => {
      const validMCPConfig = {
        enabled: true,
        servers: {
          filesystem: {
            name: 'filesystem',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
          github: {
            name: 'github',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {
              GITHUB_TOKEN: 'test-token',
            },
          },
        },
        connection: {
          maxRetries: 3,
          retryDelayMs: 1000,
          connectionTimeoutMs: 10000,
          requestTimeoutMs: 30000,
          autoReconnect: true,
        },
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'schema-validate-mcp-config',
          iterations: 100,
          warmupIterations: 10,
          threshold: CORE_THRESHOLDS.schemaValidation.mcpConfig,
        },
        () => {
          const parsed = MCPConfigSchema.parse(validMCPConfig);
          expect(parsed.enabled).toBe(true);
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark MCPServerConfig validation', async () => {
      const validServer = {
        name: 'test-server',
        command: '/usr/bin/server',
        args: ['--port', '8080', '--mode', 'production'],
        env: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'info',
        },
        cwd: '/app',
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'schema-validate-mcp-server',
          iterations: 100,
          warmupIterations: 10,
          threshold: {
            maxMean: 1,
            maxP95: 3,
          },
        },
        () => {
          const parsed = MCPServerConfigSchema.parse(validServer);
          expect(parsed.name).toBe('test-server');
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Full ApexConfig Schema', () => {
    it('should benchmark minimal ApexConfig validation', async () => {
      const minimalConfig = {
        version: '1.0',
        project: {
          name: 'minimal-project',
        },
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'schema-validate-config-minimal',
          iterations: 50,
          warmupIterations: 5,
          threshold: CORE_THRESHOLDS.schemaValidation.fullConfig,
        },
        () => {
          const parsed = ApexConfigSchema.parse(minimalConfig);
          expect(parsed.version).toBe('1.0');
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark full ApexConfig validation', async () => {
      const fullConfig = {
        version: '1.0',
        project: {
          name: 'full-project',
          language: 'typescript',
          framework: 'react',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'review-before-commit',
          rejectionBehavior: 'retry',
          gates: [
            { type: 'before-commit', name: 'Review', required: true },
          ],
          limits: {
            maxCost: 10.0,
            maxTokens: 500000,
            maxTurns: 100,
            dailyBudget: 100.0,
            maxConcurrentTasks: 3,
          },
        },
        agents: {
          enabled: ['planner', 'architect', 'developer', 'reviewer', 'tester'],
          disabled: [],
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
        },
        git: {
          branchPrefix: 'apex/',
          commitFormat: 'conventional',
          autoPush: true,
          defaultBranch: 'main',
        },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
        },
        workspace: {
          defaultStrategy: 'none',
          cleanupOnComplete: true,
        },
        permissions: {
          preset: 'review-all',
        },
        policy: {
          enforcement: 'warn',
          enabled: true,
        },
        linter: {
          global: { enabled: true },
          eslint: { enabled: true },
          prettier: { enabled: true },
        },
        secretScanning: {
          enabled: true,
          enforcementMode: 'warn',
        },
        mcp: {
          enabled: true,
          servers: {},
        },
        tdd: {
          enabled: false,
        },
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'schema-validate-config-full',
          iterations: 50,
          warmupIterations: 5,
          threshold: {
            maxMean: 20,
            maxP95: 50,
          },
        },
        () => {
          const parsed = ApexConfigSchema.parse(fullConfig);
          expect(parsed.version).toBe('1.0');
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Gate and Hook Schemas', () => {
    it('should benchmark Gate validation', async () => {
      const validGate = {
        type: 'before-commit',
        name: 'Test Gate',
        description: 'A test approval gate',
        required: true,
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'schema-validate-gate',
          iterations: 100,
          warmupIterations: 10,
          threshold: {
            maxMean: 0.5,
            maxP95: 2,
          },
        },
        () => {
          const parsed = GateSchema.parse(validGate);
          expect(parsed.type).toBe('before-commit');
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark HookConfig validation', async () => {
      const validHook = {
        event: 'before-edit',
        command: 'npm run lint-staged',
        async: false,
        timeout: 30000,
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'schema-validate-hook',
          iterations: 100,
          warmupIterations: 10,
          threshold: {
            maxMean: 0.5,
            maxP95: 2,
          },
        },
        () => {
          const parsed = HookConfigSchema.parse(validHook);
          expect(parsed.event).toBe('before-edit');
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });
});
