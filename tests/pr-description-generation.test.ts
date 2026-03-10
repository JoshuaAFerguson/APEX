import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ApexOrchestrator } from '../packages/orchestrator/src/index.js';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import type { Task } from '../packages/core/src/types/task.js';

describe('PR Description Generation - Comprehensive Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeAll(() => {
    testDir = join(process.cwd(), 'test-temp-pr-description');
    mkdirSync(testDir, { recursive: true });

    // Create minimal package.json for testing
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2)
    );

    // Create minimal apex.yaml
    writeFileSync(
      join(testDir, 'apex.yaml'),
      `project:
  name: "Test Project"
  version: "1.0.0"
git:
  defaultBranch: "main"
workflows:
  feature:
    description: "Feature development workflow"
  bugfix:
    description: "Bug fixing workflow"
  refactor:
    description: "Code refactoring workflow"
  docs:
    description: "Documentation workflow"
  test:
    description: "Testing workflow"`
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  beforeEach(async () => {
    await orchestrator.initialize();
  });

  afterAll(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  describe('generatePRTitle functionality', () => {
    // Access private method for testing
    const getOrchestratorWithPrivateMethods = () =>
      orchestrator as unknown as {
        generatePRTitle: (task: Pick<Task, 'workflow' | 'description'>) => string;
        generatePRBody: (task: Pick<Task, 'description' | 'acceptanceCriteria' | 'id' | 'workflow' | 'branchName' | 'usage'>) => string;
      };

    it('should generate correct prefixes for all supported workflows', () => {
      const orch = getOrchestratorWithPrivateMethods();

      const testCases = [
        { workflow: 'feature', expected: 'feat:' },
        { workflow: 'bugfix', expected: 'fix:' },
        { workflow: 'refactor', expected: 'refactor:' },
        { workflow: 'docs', expected: 'docs:' },
        { workflow: 'test', expected: 'test:' },
      ];

      for (const testCase of testCases) {
        const title = orch.generatePRTitle({
          workflow: testCase.workflow,
          description: 'Test description'
        });
        expect(title).toMatch(new RegExp(`^${testCase.expected}`));
      }
    });

    it('should default to feat: prefix for unknown workflows', () => {
      const orch = getOrchestratorWithPrivateMethods();

      const unknownWorkflows = ['unknown', 'custom', 'deploy', 'hotfix'];

      for (const workflow of unknownWorkflows) {
        const title = orch.generatePRTitle({
          workflow,
          description: 'Test description'
        });
        expect(title).toMatch(/^feat:/);
      }
    });

    it('should properly clean up description text', () => {
      const orch = getOrchestratorWithPrivateMethods();

      const testCases = [
        {
          input: 'Add user authentication feature',
          expected: 'feat: user authentication feature'
        },
        {
          input: 'Fix memory leak in processing',
          expected: 'feat: memory leak in processing'
        },
        {
          input: 'Update documentation for API',
          expected: 'feat: documentation for api'
        },
        {
          input: 'Implement caching system',
          expected: 'feat: caching system'
        },
        {
          input: 'Create new component structure',
          expected: 'feat: new component structure'
        }
      ];

      for (const testCase of testCases) {
        const title = orch.generatePRTitle({
          workflow: 'feature',
          description: testCase.input
        });
        expect(title).toBe(testCase.expected);
      }
    });

    it('should truncate long descriptions appropriately', () => {
      const orch = getOrchestratorWithPrivateMethods();

      // Test with exactly 60 characters
      const sixtyChars = 'A'.repeat(60);
      const title60 = orch.generatePRTitle({
        workflow: 'feature',
        description: sixtyChars
      });
      expect(title60).toBe(`feat: ${sixtyChars.toLowerCase()}`);

      // Test with more than 60 characters
      const seventyChars = 'A'.repeat(70);
      const title70 = orch.generatePRTitle({
        workflow: 'feature',
        description: seventyChars
      });
      expect(title70).toBe(`feat: ${seventyChars.toLowerCase().substring(0, 60)}`);
      expect(title70.length).toBeLessThanOrEqual(66); // "feat: " + 60 chars
    });

    it('should handle empty or minimal descriptions', () => {
      const orch = getOrchestratorWithPrivateMethods();

      const testCases = [
        { input: '', expected: 'feat: ' },
        { input: 'A', expected: 'feat: a' },
        { input: 'Add', expected: 'feat: add' }, // Does not strip standalone "Add" without space
        { input: 'Fix bug', expected: 'feat: bug' },
      ];

      for (const testCase of testCases) {
        const title = orch.generatePRTitle({
          workflow: 'feature',
          description: testCase.input
        });
        expect(title).toBe(testCase.expected);
      }
    });

    it('should handle case sensitivity in prefix removal', () => {
      const orch = getOrchestratorWithPrivateMethods();

      const testCases = [
        { input: 'ADD new feature', expected: 'feat: new feature' },
        { input: 'Fix BUG in system', expected: 'feat: bug in system' },
        { input: 'UPDATE the documentation', expected: 'feat: the documentation' },
        { input: 'IMPLEMENT caching', expected: 'feat: caching' },
        { input: 'CREATE database schema', expected: 'feat: database schema' },
      ];

      for (const testCase of testCases) {
        const title = orch.generatePRTitle({
          workflow: 'feature',
          description: testCase.input
        });
        expect(title).toBe(testCase.expected);
      }
    });

    it('should handle special characters and unicode in descriptions', () => {
      const orch = getOrchestratorWithPrivateMethods();

      const testCases = [
        { input: 'Add émoji support 🎉', expected: 'feat: émoji support 🎉' },
        { input: 'Fix API & database connection', expected: 'feat: api & database connection' },
        { input: 'Update çonfiguration files', expected: 'feat: çonfiguration files' },
      ];

      for (const testCase of testCases) {
        const title = orch.generatePRTitle({
          workflow: 'feature',
          description: testCase.input
        });
        expect(title).toBe(testCase.expected);
      }
    });
  });

  describe('generatePRBody functionality', () => {
    const getOrchestratorWithPrivateMethods = () =>
      orchestrator as unknown as {
        generatePRTitle: (task: Pick<Task, 'workflow' | 'description'>) => string;
        generatePRBody: (task: Pick<Task, 'description' | 'acceptanceCriteria' | 'id' | 'workflow' | 'branchName' | 'usage'>) => string;
      };

    const createMockTask = (overrides = {}): Pick<Task, 'description' | 'acceptanceCriteria' | 'id' | 'workflow' | 'branchName' | 'usage'> => ({
      description: 'Test task description',
      id: 'task_123',
      workflow: 'feature',
      branchName: 'apex/test-branch',
      usage: { totalTokens: 1000, estimatedCost: 0.01 },
      ...overrides,
    });

    it('should include all required sections in PR body', () => {
      const orch = getOrchestratorWithPrivateMethods();
      const task = createMockTask();

      const body = orch.generatePRBody(task);

      // Check for required sections
      expect(body).toContain('## Summary');
      expect(body).toContain('## Task Details');
      expect(body).toContain('🤖 Generated by [APEX]');

      // Check for task details
      expect(body).toContain('task_123');
      expect(body).toContain('feature');
      expect(body).toContain('apex/test-branch');
      expect(body).toContain('1,000');
      expect(body).toContain('$0.0100');
    });

    it('should include acceptance criteria when present', () => {
      const orch = getOrchestratorWithPrivateMethods();
      const task = createMockTask({
        acceptanceCriteria: '- Feature must be responsive\n- Must include error handling\n- Should have unit tests'
      });

      const body = orch.generatePRBody(task);

      expect(body).toContain('## Acceptance Criteria');
      expect(body).toContain('Feature must be responsive');
      expect(body).toContain('Must include error handling');
      expect(body).toContain('Should have unit tests');
    });

    it('should omit acceptance criteria section when not present', () => {
      const orch = getOrchestratorWithPrivateMethods();
      const task = createMockTask({ acceptanceCriteria: undefined });

      const body = orch.generatePRBody(task);

      expect(body).not.toContain('## Acceptance Criteria');
      expect(body).toContain('## Summary');
      expect(body).toContain('## Task Details');
    });

    it('should format token counts correctly for various numbers', () => {
      const orch = getOrchestratorWithPrivateMethods();

      const testCases = [
        { tokens: 100, expected: '100' },
        { tokens: 1000, expected: '1,000' },
        { tokens: 12345, expected: '12,345' },
        { tokens: 1000000, expected: '1,000,000' },
      ];

      for (const testCase of testCases) {
        const task = createMockTask({
          usage: { totalTokens: testCase.tokens, estimatedCost: 0.01 }
        });
        const body = orch.generatePRBody(task);
        expect(body).toContain(`**Tokens Used:** ${testCase.expected}`);
      }
    });

    it('should format cost correctly with proper decimal places', () => {
      const orch = getOrchestratorWithPrivateMethods();

      const testCases = [
        { cost: 0.01, expected: '$0.0100' },
        { cost: 0.1234, expected: '$0.1234' },
        { cost: 1.0, expected: '$1.0000' },
        { cost: 0.00001, expected: '$0.0000' },
      ];

      for (const testCase of testCases) {
        const task = createMockTask({
          usage: { totalTokens: 1000, estimatedCost: testCase.cost }
        });
        const body = orch.generatePRBody(task);
        expect(body).toContain(`**Estimated Cost:** ${testCase.expected}`);
      }
    });

    it('should handle long descriptions in summary', () => {
      const orch = getOrchestratorWithPrivateMethods();
      const longDescription = 'This is a very long description that contains multiple sentences and should be preserved in its entirety within the PR body summary section. '.repeat(10);

      const task = createMockTask({ description: longDescription });
      const body = orch.generatePRBody(task);

      expect(body).toContain(longDescription);
    });

    it('should handle special characters in task details', () => {
      const orch = getOrchestratorWithPrivateMethods();
      const task = createMockTask({
        id: 'task_special-chars_123!@#',
        workflow: 'feature-with-hyphens',
        branchName: 'apex/feature_with_underscores-and-hyphens',
        description: 'Task with émojis 🚀 and special chars: & < > " \'',
      });

      const body = orch.generatePRBody(task);

      expect(body).toContain('task_special-chars_123!@#');
      expect(body).toContain('feature-with-hyphens');
      expect(body).toContain('apex/feature_with_underscores-and-hyphens');
      expect(body).toContain('Task with émojis 🚀 and special chars: & < > " \'');
    });

    it('should maintain consistent markdown formatting', () => {
      const orch = getOrchestratorWithPrivateMethods();
      const task = createMockTask({
        acceptanceCriteria: '- Criterion 1\n- Criterion 2'
      });

      const body = orch.generatePRBody(task);

      // Check markdown structure
      expect(body).toMatch(/## Summary\n\n/);
      expect(body).toMatch(/## Acceptance Criteria\n\n/);
      expect(body).toMatch(/## Task Details\n\n/);
      expect(body).toMatch(/---\n\n/);

      // Check that there are proper double newlines between sections
      const sections = body.split('##').slice(1); // Remove content before first ##
      for (const section of sections) {
        expect(section).toMatch(/\n\n/); // Each section should end with double newline
      }
    });

    it('should include correct APEX branding and link', () => {
      const orch = getOrchestratorWithPrivateMethods();
      const task = createMockTask();

      const body = orch.generatePRBody(task);

      expect(body).toContain('🤖 Generated by [APEX](https://github.com/JoshuaAFerguson/apex)');
      expect(body).toContain('Autonomous Product Engineering eXecutor');
    });
  });

  describe('Integration with workflow mapping', () => {
    it('should correctly map workflow types to commit prefixes', () => {
      const orch = orchestrator as unknown as {
        generatePRTitle: (task: Pick<Task, 'workflow' | 'description'>) => string;
      };

      // Test the workflow to commit type mapping
      const workflowMappings = [
        { workflow: 'feature', commitPrefix: 'feat' },
        { workflow: 'bugfix', commitPrefix: 'fix' },
        { workflow: 'refactor', commitPrefix: 'refactor' },
        { workflow: 'docs', commitPrefix: 'docs' },
        { workflow: 'test', commitPrefix: 'test' },
      ];

      for (const mapping of workflowMappings) {
        const title = orch.generatePRTitle({
          workflow: mapping.workflow,
          description: `${mapping.workflow} implementation`
        });

        expect(title).toBe(`${mapping.commitPrefix}: ${mapping.workflow} implementation`);
      }
    });
  });

  describe('Error handling and edge cases', () => {
    const getOrchestratorWithPrivateMethods = () =>
      orchestrator as unknown as {
        generatePRTitle: (task: Pick<Task, 'workflow' | 'description'>) => string;
        generatePRBody: (task: Pick<Task, 'description' | 'acceptanceCriteria' | 'id' | 'workflow' | 'branchName' | 'usage'>) => string;
      };

    it('should handle undefined values by throwing appropriate errors', () => {
      const orch = getOrchestratorWithPrivateMethods();

      // Test generatePRTitle with edge cases - undefined workflow should work (fallback to 'feat')
      expect(() => orch.generatePRTitle({
        workflow: undefined as any,
        description: 'test'
      })).not.toThrow();

      // Test generatePRTitle with undefined description - should throw
      expect(() => orch.generatePRTitle({
        workflow: 'feature',
        description: undefined as any
      })).toThrow();
    });

    it('should handle zero usage values', () => {
      const orch = getOrchestratorWithPrivateMethods();
      const task = {
        description: 'Test task',
        id: 'task_123',
        workflow: 'feature',
        branchName: 'apex/test',
        usage: { totalTokens: 0, estimatedCost: 0 },
      };

      const body = orch.generatePRBody(task);

      expect(body).toContain('**Tokens Used:** 0');
      expect(body).toContain('**Estimated Cost:** $0.0000');
    });

    it('should handle very large numbers', () => {
      const orch = getOrchestratorWithPrivateMethods();
      const task = {
        description: 'Test task',
        id: 'task_123',
        workflow: 'feature',
        branchName: 'apex/test',
        usage: { totalTokens: 9999999, estimatedCost: 999.9999 },
      };

      const body = orch.generatePRBody(task);

      expect(body).toContain('**Tokens Used:** 9,999,999');
      expect(body).toContain('**Estimated Cost:** $999.9999');
    });

    it('should handle empty acceptance criteria string', () => {
      const orch = getOrchestratorWithPrivateMethods();
      const task = {
        description: 'Test task',
        acceptanceCriteria: '',
        id: 'task_123',
        workflow: 'feature',
        branchName: 'apex/test',
        usage: { totalTokens: 1000, estimatedCost: 0.01 },
      };

      const body = orch.generatePRBody(task);

      // Empty acceptance criteria should NOT show the section (falsy value)
      expect(body).not.toContain('## Acceptance Criteria');
    });
  });
});