/**
 * @fileoverview Configuration Parsing Benchmarks
 *
 * Measures config parsing performance for various configuration sizes
 * and complexity levels.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  BenchmarkRunner,
  CORE_THRESHOLDS,
  BenchmarkReporter,
} from '../../../benchmarks/shared/index';
import {
  loadConfig,
  initializeApex,
  parseAgentMarkdown,
  getEffectiveConfig,
  ApexConfigSchema,
} from '../src/index';

describe('Config Parsing Benchmarks', () => {
  const reporter = new BenchmarkReporter();
  let tempDir: string;

  beforeAll(async () => {
    reporter.start();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-bench-'));
  });

  afterAll(async () => {
    reporter.printReport();
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('YAML Config Parsing', () => {
    it('should benchmark simple config parsing', async () => {
      const simpleConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
        },
      };

      const configYaml = yaml.stringify(simpleConfig);
      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'config-parse-yaml-simple',
          iterations: 100,
          warmupIterations: 10,
          threshold: CORE_THRESHOLDS.configParsing.simple,
        },
        () => {
          const parsed = yaml.parse(configYaml);
          expect(parsed.version).toBe('1.0');
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark complex config parsing', async () => {
      const complexConfig = {
        version: '1.0',
        project: {
          name: 'complex-project',
          language: 'typescript',
          framework: 'react',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'review-before-commit',
          gates: [
            { type: 'before-commit', name: 'Review Gate', required: true },
            { type: 'before-push', name: 'Push Gate', required: false },
          ],
          limits: {
            maxCost: 10.0,
            maxTokens: 500000,
            maxTurns: 100,
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
        mcp: {
          enabled: true,
          servers: {
            filesystem: {
              name: 'filesystem',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
            },
          },
        },
        linter: {
          global: { enabled: true, runOnCommit: true },
          eslint: { enabled: true, autoFix: false },
          prettier: { enabled: true, autoFix: false },
        },
        secretScanning: {
          enabled: true,
          enforcementMode: 'warn',
        },
      };

      const configYaml = yaml.stringify(complexConfig);
      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'config-parse-yaml-complex',
          iterations: 50,
          warmupIterations: 5,
          threshold: CORE_THRESHOLDS.configParsing.complex,
        },
        () => {
          const parsed = yaml.parse(configYaml);
          expect(parsed.version).toBe('1.0');
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Zod Schema Validation', () => {
    it('should benchmark ApexConfig schema parsing', async () => {
      const validConfig = {
        version: '1.0',
        project: {
          name: 'schema-test',
          language: 'typescript',
        },
        autonomy: {
          level: 'review-before-commit',
        },
        agents: {
          enabled: ['developer'],
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
        },
        git: {
          branchPrefix: 'apex/',
          commitFormat: 'conventional',
          defaultBranch: 'main',
        },
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'config-schema-validation',
          iterations: 50,
          warmupIterations: 5,
          threshold: CORE_THRESHOLDS.configParsing.withValidation,
        },
        () => {
          const parsed = ApexConfigSchema.parse(validConfig);
          expect(parsed.version).toBe('1.0');
          return parsed;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark safeParse (non-throwing validation)', async () => {
      const validConfig = {
        version: '1.0',
        project: {
          name: 'safeParse-test',
        },
      };

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'config-safeParse-validation',
          iterations: 100,
          warmupIterations: 10,
          threshold: CORE_THRESHOLDS.configParsing.simple,
        },
        () => {
          const parseResult = ApexConfigSchema.safeParse(validConfig);
          expect(parseResult.success).toBe(true);
          return parseResult;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Agent Markdown Parsing', () => {
    it('should benchmark agent markdown parsing', async () => {
      const agentMarkdown = `---
name: developer
description: Senior software developer agent
tools: Read,Write,Edit,Bash
model: sonnet
skills: typescript,react,testing
---

You are a senior software developer with extensive experience in TypeScript and React.
Your primary responsibilities include:
- Writing clean, maintainable code
- Following best practices and design patterns
- Ensuring proper error handling
- Writing comprehensive tests

When implementing features:
1. Analyze the requirements thoroughly
2. Plan your implementation approach
3. Write modular, testable code
4. Document your code appropriately
`;

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'agent-markdown-parsing',
          iterations: 100,
          warmupIterations: 10,
          threshold: {
            maxMean: 2,
            maxP95: 5,
          },
        },
        () => {
          const agent = parseAgentMarkdown(agentMarkdown);
          expect(agent).not.toBeNull();
          expect(agent?.name).toBe('developer');
          return agent;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark invalid markdown handling', async () => {
      const invalidMarkdown = `
This is not valid agent markdown
without proper frontmatter
`;

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'agent-markdown-invalid-handling',
          iterations: 100,
          warmupIterations: 10,
          threshold: {
            maxMean: 1,
            maxP95: 3,
          },
        },
        () => {
          const agent = parseAgentMarkdown(invalidMarkdown);
          expect(agent).toBeNull();
          return agent;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Effective Config Generation', () => {
    it('should benchmark getEffectiveConfig', async () => {
      const minimalConfig = ApexConfigSchema.parse({
        version: '1.0',
        project: { name: 'minimal-test' },
      });

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'config-effective-generation',
          iterations: 100,
          warmupIterations: 10,
          threshold: {
            maxMean: 5,
            maxP95: 15,
          },
        },
        () => {
          const effective = getEffectiveConfig(minimalConfig);
          expect(effective.version).toBe('1.0');
          expect(effective.limits.maxTokensPerTask).toBeDefined();
          return effective;
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });
});
