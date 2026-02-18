import { describe, it, expect } from 'vitest';
import { TDDModeConfigSchema, ApexConfigSchema } from '../types';
import { getEffectiveConfig, initializeApex, loadConfig } from '../config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';

describe('TDD Feature Coverage Tests', () => {
  describe('Schema Coverage', () => {
    it('should validate all TDD configuration properties', () => {
      const fullConfig = {
        enabled: true,
        testCommand: 'jest --watch',
        watchMode: true,
        maxIterations: 10,
        regressionGuard: false,
      };

      const result = TDDModeConfigSchema.safeParse(fullConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.testCommand).toBe('jest --watch');
        expect(result.data.watchMode).toBe(true);
        expect(result.data.maxIterations).toBe(10);
        expect(result.data.regressionGuard).toBe(false);
      }
    });

    it('should validate TDD config as part of ApexConfig', () => {
      const fullApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        autonomy: {
          level: 'review-before-commit',
          limits: {
            maxCost: 10.0,
            maxTokens: 500000,
            maxTurns: 100,
            dailyBudget: 100.0,
            maxConcurrentTasks: 3,
          },
        },
        agents: { enabled: ['planner', 'tester'] },
        models: { planning: 'opus', implementation: 'sonnet', review: 'haiku' },
        git: { branchPrefix: 'apex/', commitFormat: 'conventional', autoPush: true, defaultBranch: 'main' },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
        },
        tdd: {
          enabled: true,
          testCommand: 'npm run test:tdd',
          watchMode: true,
          maxIterations: 8,
          regressionGuard: true,
        },
      };

      const result = ApexConfigSchema.safeParse(fullApexConfig);
      expect(result.success).toBe(true);
    });

    it('should handle all boundary values for maxIterations', () => {
      const boundaryValues = [1, 100, 1000, Number.MAX_SAFE_INTEGER];

      for (const value of boundaryValues) {
        const config = { maxIterations: value };
        const result = TDDModeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxIterations).toBe(value);
        }
      }
    });

    it('should reject invalid boundary values', () => {
      const invalidValues = [0, -1, -100, 0.5, 'five', null, undefined];

      for (const value of invalidValues) {
        const config = { maxIterations: value };
        const result = TDDModeConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Configuration Integration Coverage', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-coverage-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should cover getEffectiveConfig with various TDD configurations', async () => {
      const testCases = [
        // No TDD config
        {},
        // Minimal TDD config
        { tdd: { enabled: true } },
        // Partial TDD config
        { tdd: { enabled: true, testCommand: 'yarn test' } },
        // Full TDD config
        {
          tdd: {
            enabled: true,
            testCommand: 'npm run test:ci',
            watchMode: false,
            maxIterations: 3,
            regressionGuard: false,
          }
        }
      ];

      for (const testCase of testCases) {
        const baseConfig = {
          version: '1.0',
          project: { name: 'coverage-test' },
          autonomy: {
            level: 'review-before-commit' as const,
            limits: {
              maxCost: 10.0,
              maxTokens: 500000,
              maxTurns: 100,
              dailyBudget: 100.0,
              maxConcurrentTasks: 3,
            },
          },
          agents: { enabled: ['planner'] },
          models: { planning: 'opus' as const, implementation: 'sonnet' as const, review: 'haiku' as const },
          git: { branchPrefix: 'apex/', commitFormat: 'conventional' as const, autoPush: true, defaultBranch: 'main' },
          limits: {
            maxTokensPerTask: 500000,
            maxCostPerTask: 10.0,
            dailyBudget: 100.0,
            maxTurns: 100,
            maxConcurrentTasks: 3,
          },
          ...testCase
        };

        const effectiveConfig = getEffectiveConfig(baseConfig);
        expect(effectiveConfig.tdd).toBeDefined();
        expect(effectiveConfig.tdd.enabled).toBeDefined();
        expect(effectiveConfig.tdd.testCommand).toBeDefined();
        expect(effectiveConfig.tdd.watchMode).toBeDefined();
        expect(effectiveConfig.tdd.maxIterations).toBeDefined();
        expect(effectiveConfig.tdd.regressionGuard).toBeDefined();
      }
    });

    it('should cover project testCommand fallback logic', () => {
      const baseConfig = {
        version: '1.0',
        project: { name: 'fallback-test', testCommand: 'custom-test-command' },
        autonomy: {
          level: 'review-before-commit' as const,
          limits: {
            maxCost: 10.0,
            maxTokens: 500000,
            maxTurns: 100,
            dailyBudget: 100.0,
            maxConcurrentTasks: 3,
          },
        },
        agents: { enabled: ['planner'] },
        models: { planning: 'opus' as const, implementation: 'sonnet' as const, review: 'haiku' as const },
        git: { branchPrefix: 'apex/', commitFormat: 'conventional' as const, autoPush: true, defaultBranch: 'main' },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
        },
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);
      expect(effectiveConfig.tdd.testCommand).toBe('custom-test-command');
    });

    it('should cover config validation error paths', async () => {
      await initializeApex(tempDir, { projectName: 'error-test' });

      const configPath = path.join(tempDir, '.apex', 'config.yaml');

      // Test various invalid configurations
      const invalidConfigs = [
        'tdd:\n  enabled: "not-a-boolean"',
        'tdd:\n  maxIterations: 0',
        'tdd:\n  testCommand: 123',
        'tdd:\n  watchMode: "maybe"',
        'tdd:\n  regressionGuard: null',
      ];

      for (const invalidTddConfig of invalidConfigs) {
        let configContent = await fs.readFile(configPath, 'utf-8');
        configContent += '\n' + invalidTddConfig;
        await fs.writeFile(configPath, configContent);

        await expect(loadConfig(tempDir)).rejects.toThrow();

        // Restore valid config for next iteration
        await initializeApex(tempDir, { projectName: 'error-test' });
      }
    });

    it('should cover config file edge cases', async () => {
      await initializeApex(tempDir, { projectName: 'edge-test' });

      const configPath = path.join(tempDir, '.apex', 'config.yaml');

      // Test with empty TDD section
      let configContent = await fs.readFile(configPath, 'utf-8');
      configContent = configContent.replace(/tdd:\s*\n(?:  [^\n]*\n)*/, 'tdd: {}\n');
      await fs.writeFile(configPath, configContent);

      const config = await loadConfig(tempDir);
      expect(config.tdd).toEqual({
        enabled: false,
        testCommand: 'npm test',
        watchMode: false,
        maxIterations: 5,
        regressionGuard: true,
      });
    });

    it('should cover YAML parsing edge cases', async () => {
      await initializeApex(tempDir, { projectName: 'yaml-test' });

      const configPath = path.join(tempDir, '.apex', 'config.yaml');

      // Test with comments and formatting
      const tddConfigWithComments = `
# TDD Configuration
tdd:
  # Enable TDD mode
  enabled: true
  # Custom test command
  testCommand: "npm run test:unit"
  # Watch mode setting
  watchMode: false
  # Maximum iterations allowed
  maxIterations: 7
  # Enable regression guard
  regressionGuard: true
`;

      let configContent = await fs.readFile(configPath, 'utf-8');
      configContent += tddConfigWithComments;
      await fs.writeFile(configPath, configContent);

      const config = await loadConfig(tempDir);
      expect(config.tdd.enabled).toBe(true);
      expect(config.tdd.testCommand).toBe('npm run test:unit');
      expect(config.tdd.maxIterations).toBe(7);
    });
  });

  describe('Template File Coverage', () => {
    it('should validate TDD workflow template completeness', async () => {
      const templatePath = path.join(__dirname, '../../templates/workflows/tdd.yaml');
      const content = await fs.readFile(templatePath, 'utf-8');
      const workflow = yaml.parse(content);

      // Comprehensive workflow structure validation
      expect(workflow).toHaveProperty('name', 'tdd');
      expect(workflow).toHaveProperty('description');
      expect(workflow.description).toContain('Test-Driven Development');
      expect(workflow).toHaveProperty('trigger');
      expect(workflow).toHaveProperty('stages');

      // Trigger validation
      expect(Array.isArray(workflow.trigger)).toBe(true);
      expect(workflow.trigger).toContain('manual');
      expect(workflow.trigger).toContain('apex:tdd');

      // Stages validation
      expect(Array.isArray(workflow.stages)).toBe(true);
      expect(workflow.stages.length).toBeGreaterThanOrEqual(3); // At least planning, test-first, implementation

      // Each stage validation
      workflow.stages.forEach((stage: any, index: number) => {
        expect(stage).toHaveProperty('name');
        expect(stage).toHaveProperty('agent');
        expect(stage).toHaveProperty('description');
        expect(stage).toHaveProperty('outputs');

        expect(typeof stage.name).toBe('string');
        expect(stage.name.length).toBeGreaterThan(0);
        expect(typeof stage.agent).toBe('string');
        expect(stage.agent.length).toBeGreaterThan(0);
        expect(typeof stage.description).toBe('string');
        expect(stage.description.length).toBeGreaterThan(0);
        expect(Array.isArray(stage.outputs)).toBe(true);
        expect(stage.outputs.length).toBeGreaterThan(0);
      });
    });

    it('should validate TDD agent templates completeness', async () => {
      const agentFiles = ['tdd-tester.md', 'tdd-developer.md'];

      for (const agentFile of agentFiles) {
        const templatePath = path.join(__dirname, '../../templates/agents', agentFile);
        const content = await fs.readFile(templatePath, 'utf-8');

        // Frontmatter validation
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        expect(frontmatterMatch).toBeTruthy();

        if (frontmatterMatch) {
          const [, frontmatterYaml, body] = frontmatterMatch;
          const frontmatter = yaml.parse(frontmatterYaml);

          // Required frontmatter fields
          expect(frontmatter).toHaveProperty('name');
          expect(frontmatter).toHaveProperty('description');
          expect(frontmatter).toHaveProperty('tools');
          expect(frontmatter).toHaveProperty('model');

          expect(typeof frontmatter.name).toBe('string');
          expect(frontmatter.name.includes('tdd')).toBe(true);
          expect(typeof frontmatter.description).toBe('string');
          expect(frontmatter.description.length).toBeGreaterThan(10);
          expect(typeof frontmatter.model).toBe('string');

          // Tools validation
          if (typeof frontmatter.tools === 'string') {
            const tools = frontmatter.tools.split(',').map((t: string) => t.trim());
            expect(tools.length).toBeGreaterThan(0);
            expect(tools).toContain('Read');
            expect(tools).toContain('Write');
          } else if (Array.isArray(frontmatter.tools)) {
            expect(frontmatter.tools.length).toBeGreaterThan(0);
            expect(frontmatter.tools).toContain('Read');
            expect(frontmatter.tools).toContain('Write');
          }

          // Body validation
          expect(body).toBeDefined();
          expect(body.trim().length).toBeGreaterThan(100);
          expect(body.toLowerCase()).toContain('tdd');
        }
      }
    });

    it('should validate template consistency across files', async () => {
      // Load workflow template
      const workflowPath = path.join(__dirname, '../../templates/workflows/tdd.yaml');
      const workflowContent = await fs.readFile(workflowPath, 'utf-8');
      const workflow = yaml.parse(workflowContent);

      // Load agent templates
      const testerPath = path.join(__dirname, '../../templates/agents/tdd-tester.md');
      const developerPath = path.join(__dirname, '../../templates/agents/tdd-developer.md');

      const testerContent = await fs.readFile(testerPath, 'utf-8');
      const developerContent = await fs.readFile(developerPath, 'utf-8');

      // Extract agent names from frontmatter
      const testerMatch = testerContent.match(/^---\n([\s\S]*?)\n---\n/);
      const developerMatch = developerContent.match(/^---\n([\s\S]*?)\n---\n/);

      expect(testerMatch).toBeTruthy();
      expect(developerMatch).toBeTruthy();

      if (testerMatch && developerMatch) {
        const testerFrontmatter = yaml.parse(testerMatch[1]);
        const developerFrontmatter = yaml.parse(developerMatch[1]);

        // Check that workflow references the correct agents
        const workflowAgents = workflow.stages.map((stage: any) => stage.agent);

        if (workflowAgents.includes('tdd-tester')) {
          expect(testerFrontmatter.name).toBe('tdd-tester');
        }

        if (workflowAgents.includes('tdd-developer')) {
          expect(developerFrontmatter.name).toBe('tdd-developer');
        }
      }
    });
  });

  describe('Cross-Platform and Environment Coverage', () => {
    it('should handle different test commands across environments', () => {
      const testCommands = [
        'npm test',
        'yarn test',
        'pnpm test',
        'npx jest',
        'npx vitest',
        'python -m pytest',
        'go test ./...',
        'cargo test',
        'dotnet test'
      ];

      for (const testCommand of testCommands) {
        const config = { testCommand };
        const result = TDDModeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.testCommand).toBe(testCommand);
        }
      }
    });

    it('should handle various project configurations', () => {
      const projectTypes = [
        { language: 'javascript', framework: 'react' },
        { language: 'typescript', framework: 'angular' },
        { language: 'python', framework: 'django' },
        { language: 'java', framework: 'spring' },
        { language: 'go' },
        { language: 'rust' },
        { language: 'csharp', framework: 'dotnet' },
      ];

      for (const project of projectTypes) {
        const effectiveConfig = getEffectiveConfig({
          version: '1.0',
          project: { name: 'test', ...project },
          autonomy: {
            level: 'review-before-commit' as const,
            limits: {
              maxCost: 10.0,
              maxTokens: 500000,
              maxTurns: 100,
              dailyBudget: 100.0,
              maxConcurrentTasks: 3,
            },
          },
          agents: { enabled: ['planner'] },
          models: { planning: 'opus' as const, implementation: 'sonnet' as const, review: 'haiku' as const },
          git: { branchPrefix: 'apex/', commitFormat: 'conventional' as const, autoPush: true, defaultBranch: 'main' },
          limits: {
            maxTokensPerTask: 500000,
            maxCostPerTask: 10.0,
            dailyBudget: 100.0,
            maxTurns: 100,
            maxConcurrentTasks: 3,
          },
        });

        expect(effectiveConfig.tdd).toBeDefined();
        expect(effectiveConfig.project.language).toBe(project.language);
        if (project.framework) {
          expect(effectiveConfig.project.framework).toBe(project.framework);
        }
      }
    });
  });
});