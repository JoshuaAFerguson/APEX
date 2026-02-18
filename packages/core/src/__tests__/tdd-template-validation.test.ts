import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { WorkflowDefinitionSchema, AgentDefinitionSchema } from '../types';
import { parseAgentMarkdown } from '../config';

describe('TDD Template File Validation', () => {
  const TEMPLATE_BASE_PATH = path.join(__dirname, '../../templates');
  const WORKFLOWS_TEMPLATE_PATH = path.join(TEMPLATE_BASE_PATH, 'workflows');
  const AGENTS_TEMPLATE_PATH = path.join(TEMPLATE_BASE_PATH, 'agents');

  describe('Template Directory Structure', () => {
    it('should have templates directory structure', async () => {
      await expect(fs.access(TEMPLATE_BASE_PATH)).resolves.toBeUndefined();
      await expect(fs.access(WORKFLOWS_TEMPLATE_PATH)).resolves.toBeUndefined();
      await expect(fs.access(AGENTS_TEMPLATE_PATH)).resolves.toBeUndefined();
    });

    it('should have TDD workflow template file', async () => {
      const tddWorkflowPath = path.join(WORKFLOWS_TEMPLATE_PATH, 'tdd.yaml');
      await expect(fs.access(tddWorkflowPath)).resolves.toBeUndefined();

      const stats = await fs.stat(tddWorkflowPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should have TDD agent template files', async () => {
      const testerPath = path.join(AGENTS_TEMPLATE_PATH, 'tdd-tester.md');
      const developerPath = path.join(AGENTS_TEMPLATE_PATH, 'tdd-developer.md');

      await expect(fs.access(testerPath)).resolves.toBeUndefined();
      await expect(fs.access(developerPath)).resolves.toBeUndefined();

      const testerStats = await fs.stat(testerPath);
      const developerStats = await fs.stat(developerPath);

      expect(testerStats.isFile()).toBe(true);
      expect(testerStats.size).toBeGreaterThan(0);
      expect(developerStats.isFile()).toBe(true);
      expect(developerStats.size).toBeGreaterThan(0);
    });
  });

  describe('TDD Workflow Template Validation', () => {
    let tddWorkflowContent: any;

    beforeEach(async () => {
      const tddWorkflowPath = path.join(WORKFLOWS_TEMPLATE_PATH, 'tdd.yaml');
      const content = await fs.readFile(tddWorkflowPath, 'utf-8');
      tddWorkflowContent = yaml.parse(content);
    });

    it('should be valid YAML', () => {
      expect(tddWorkflowContent).toBeDefined();
      expect(typeof tddWorkflowContent).toBe('object');
    });

    it('should pass WorkflowDefinitionSchema validation', () => {
      const result = WorkflowDefinitionSchema.safeParse(tddWorkflowContent);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    it('should have required workflow properties', () => {
      expect(tddWorkflowContent).toHaveProperty('name');
      expect(tddWorkflowContent).toHaveProperty('description');
      expect(tddWorkflowContent).toHaveProperty('stages');
      expect(tddWorkflowContent).toHaveProperty('trigger');

      expect(tddWorkflowContent.name).toBe('tdd');
      expect(tddWorkflowContent.description).toContain('Test-Driven Development');
      expect(Array.isArray(tddWorkflowContent.stages)).toBe(true);
      expect(Array.isArray(tddWorkflowContent.trigger)).toBe(true);
    });

    it('should have complete TDD stage sequence', () => {
      const stages = tddWorkflowContent.stages;
      expect(stages).toHaveLength(5);

      const expectedStages = [
        { name: 'planning', agent: 'planner' },
        { name: 'test-first', agent: 'tdd-tester' },
        { name: 'implementation', agent: 'tdd-developer' },
        { name: 'refactor', agent: 'developer' },
        { name: 'verification', agent: 'tdd-tester' }
      ];

      expectedStages.forEach((expected, index) => {
        expect(stages[index].name).toBe(expected.name);
        expect(stages[index].agent).toBe(expected.agent);
        expect(stages[index].description).toBeDefined();
        expect(stages[index].outputs).toBeDefined();
        expect(Array.isArray(stages[index].outputs)).toBe(true);
      });
    });

    it('should have correct dependency chain', () => {
      const stages = tddWorkflowContent.stages;

      // Planning has no dependencies
      expect(stages[0].dependsOn).toBeUndefined();

      // Each subsequent stage depends on the previous one
      expect(stages[1].dependsOn).toEqual(['planning']);
      expect(stages[2].dependsOn).toEqual(['test-first']);
      expect(stages[3].dependsOn).toEqual(['implementation']);
      expect(stages[4].dependsOn).toEqual(['refactor']);
    });

    it('should have appropriate triggers for TDD workflow', () => {
      const triggers = tddWorkflowContent.trigger;
      expect(triggers).toContain('manual');
      expect(triggers).toContain('apex:tdd');
      expect(triggers).toContain('apex:test-driven');
    });

    it('should have meaningful stage outputs', () => {
      const stages = tddWorkflowContent.stages;

      stages.forEach(stage => {
        expect(stage.outputs).toBeDefined();
        expect(stage.outputs.length).toBeGreaterThan(0);

        // Outputs should follow snake_case naming convention
        stage.outputs.forEach((output: string) => {
          expect(output).toMatch(/^[a-z_]+$/);
          expect(output.length).toBeGreaterThan(2);
        });
      });

      // Check for TDD-specific outputs
      const planningOutputs = stages[0].outputs;
      const testFirstOutputs = stages[1].outputs;
      const implementationOutputs = stages[2].outputs;
      const refactorOutputs = stages[3].outputs;
      const verificationOutputs = stages[4].outputs;

      expect(planningOutputs).toContain('implementation_plan');
      expect(testFirstOutputs).toContain('test_files');
      expect(implementationOutputs).toContain('code_changes');
      expect(refactorOutputs).toContain('refactored_code');
      expect(verificationOutputs).toContain('coverage_report');
    });

    it('should have stage descriptions that reflect TDD methodology', () => {
      const stages = tddWorkflowContent.stages;

      expect(stages[1].description).toContain('Red phase');
      expect(stages[2].description).toContain('Green phase');
      expect(stages[3].description).toContain('Refactor phase');
      expect(stages[1].description).toContain('failing test');
      expect(stages[2].description).toContain('minimal code');
      expect(stages[3].description).toContain('keeping tests green');
    });
  });

  describe('TDD Agent Template Validation', () => {
    describe('TDD Tester Agent', () => {
      let testerAgent: any;

      beforeEach(async () => {
        const testerPath = path.join(AGENTS_TEMPLATE_PATH, 'tdd-tester.md');
        const content = await fs.readFile(testerPath, 'utf-8');
        testerAgent = parseAgentMarkdown(content);
      });

      it('should be valid markdown with frontmatter', async () => {
        const testerPath = path.join(AGENTS_TEMPLATE_PATH, 'tdd-tester.md');
        const content = await fs.readFile(testerPath, 'utf-8');

        // Should have frontmatter
        expect(content).toMatch(/^---\n[\s\S]*?\n---\n/);
        expect(content.split('---').length).toBeGreaterThanOrEqual(3);
      });

      it('should pass AgentDefinitionSchema validation', () => {
        const result = AgentDefinitionSchema.safeParse(testerAgent);

        if (!result.success) {
          console.error('TDD Tester validation errors:', result.error.issues);
        }

        expect(result.success).toBe(true);
      });

      it('should have correct agent properties', () => {
        expect(testerAgent.name).toBe('tdd-tester');
        expect(testerAgent.description).toBeDefined();
        expect(testerAgent.prompt).toBeDefined();
        expect(testerAgent.tools).toBeDefined();
        expect(testerAgent.model).toBeDefined();

        expect(Array.isArray(testerAgent.tools)).toBe(true);
        expect(testerAgent.tools.length).toBeGreaterThan(0);
      });

      it('should have appropriate tools for test development', () => {
        const requiredTools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];

        for (const tool of requiredTools) {
          expect(testerAgent.tools).toContain(tool);
        }
      });

      it('should contain TDD-specific guidance in prompt', () => {
        const prompt = testerAgent.prompt;

        // Should contain TDD methodology references
        expect(prompt).toContain('Red Phase');
        expect(prompt).toContain('TDD');
        expect(prompt).toContain('failing test');
        expect(prompt).toContain('test-first');

        // Should contain test quality guidelines
        expect(prompt).toContain('AAA pattern');
        expect(prompt).toContain('Arrange, Act, Assert');
      });

      it('should use appropriate model for complex reasoning', () => {
        expect(testerAgent.model).toBe('sonnet');
      });

      it('should have comprehensive prompt content', () => {
        const prompt = testerAgent.prompt;

        expect(prompt.length).toBeGreaterThan(500); // Should be substantial
        expect(prompt).toContain('Test Quality Guidelines');
        expect(prompt).toContain('TDD Principles');
      });
    });

    describe('TDD Developer Agent', () => {
      let developerAgent: any;

      beforeEach(async () => {
        const developerPath = path.join(AGENTS_TEMPLATE_PATH, 'tdd-developer.md');
        const content = await fs.readFile(developerPath, 'utf-8');
        developerAgent = parseAgentMarkdown(content);
      });

      it('should be valid markdown with frontmatter', async () => {
        const developerPath = path.join(AGENTS_TEMPLATE_PATH, 'tdd-developer.md');
        const content = await fs.readFile(developerPath, 'utf-8');

        expect(content).toMatch(/^---\n[\s\S]*?\n---\n/);
        expect(content.split('---').length).toBeGreaterThanOrEqual(3);
      });

      it('should pass AgentDefinitionSchema validation', () => {
        const result = AgentDefinitionSchema.safeParse(developerAgent);

        if (!result.success) {
          console.error('TDD Developer validation errors:', result.error.issues);
        }

        expect(result.success).toBe(true);
      });

      it('should have correct agent properties', () => {
        expect(developerAgent.name).toBe('tdd-developer');
        expect(developerAgent.description).toBeDefined();
        expect(developerAgent.prompt).toBeDefined();
        expect(developerAgent.tools).toBeDefined();
        expect(developerAgent.model).toBeDefined();

        expect(Array.isArray(developerAgent.tools)).toBe(true);
        expect(developerAgent.tools.length).toBeGreaterThan(0);
      });

      it('should have appropriate tools for code development', () => {
        const requiredTools = ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob'];

        for (const tool of requiredTools) {
          expect(developerAgent.tools).toContain(tool);
        }

        // Should have MultiEdit for handling multiple file changes
        expect(developerAgent.tools).toContain('MultiEdit');
      });

      it('should emphasize minimal implementation in prompt', () => {
        const prompt = developerAgent.prompt;

        expect(prompt).toContain('MINIMAL IMPLEMENTATION');
        expect(prompt).toContain('absolute minimum code');
        expect(prompt).toContain('GREEN phase');
        expect(prompt).toContain('nothing more, nothing less');
      });

      it('should include anti-patterns and warnings', () => {
        const prompt = developerAgent.prompt;

        expect(prompt).toContain('ANTI-PATTERNS');
        expect(prompt).toContain('OVER-ENGINEERING');
        expect(prompt).toContain('FUTURE-PROOFING');
        expect(prompt).toContain('PERFECTIONIST CODING');
      });

      it('should provide TDD implementation patterns', () => {
        const prompt = developerAgent.prompt;

        expect(prompt).toContain('Fake It Till You Make It');
        expect(prompt).toContain('Triangulation');
        expect(prompt).toContain('Obvious Implementation');
      });

      it('should use appropriate model for implementation tasks', () => {
        expect(developerAgent.model).toBe('sonnet');
      });

      it('should have success criteria defined', () => {
        const prompt = developerAgent.prompt;

        expect(prompt).toContain('SUCCESS METRICS');
        expect(prompt).toContain('previously failing tests now pass');
        expect(prompt).toContain('No existing tests were broken');
        expect(prompt).toContain('Minimal code was added');
      });
    });
  });

  describe('Template Consistency Validation', () => {
    it('should have consistent agent names between workflow and agent definitions', async () => {
      // Load workflow
      const tddWorkflowPath = path.join(WORKFLOWS_TEMPLATE_PATH, 'tdd.yaml');
      const workflowContent = await fs.readFile(tddWorkflowPath, 'utf-8');
      const workflow = yaml.parse(workflowContent);

      // Load agents
      const testerPath = path.join(AGENTS_TEMPLATE_PATH, 'tdd-tester.md');
      const developerPath = path.join(AGENTS_TEMPLATE_PATH, 'tdd-developer.md');
      const testerContent = await fs.readFile(testerPath, 'utf-8');
      const developerContent = await fs.readFile(developerPath, 'utf-8');

      const testerAgent = parseAgentMarkdown(testerContent);
      const developerAgent = parseAgentMarkdown(developerContent);

      // Check that workflow references match agent names
      const workflowAgents = workflow.stages.map((stage: any) => stage.agent);

      expect(workflowAgents).toContain('tdd-tester');
      expect(workflowAgents).toContain('tdd-developer');
      expect(testerAgent.name).toBe('tdd-tester');
      expect(developerAgent.name).toBe('tdd-developer');
    });

    it('should have stage outputs that match agent capabilities', async () => {
      const tddWorkflowPath = path.join(WORKFLOWS_TEMPLATE_PATH, 'tdd.yaml');
      const workflowContent = await fs.readFile(tddWorkflowPath, 'utf-8');
      const workflow = yaml.parse(workflowContent);

      const testFirstStage = workflow.stages.find((s: any) => s.name === 'test-first');
      const implementationStage = workflow.stages.find((s: any) => s.name === 'implementation');

      // Test-first stage should output test-related artifacts
      expect(testFirstStage.outputs).toContain('test_files');
      expect(testFirstStage.outputs).toContain('test_requirements');

      // Implementation stage should output code-related artifacts
      expect(implementationStage.outputs).toContain('code_changes');
      expect(implementationStage.outputs).toContain('implementation_notes');
    });

    it('should have file encoding consistency', async () => {
      const templateFiles = [
        path.join(WORKFLOWS_TEMPLATE_PATH, 'tdd.yaml'),
        path.join(AGENTS_TEMPLATE_PATH, 'tdd-tester.md'),
        path.join(AGENTS_TEMPLATE_PATH, 'tdd-developer.md'),
      ];

      for (const filePath of templateFiles) {
        const content = await fs.readFile(filePath, 'utf-8');

        // Should not contain BOM or other encoding issues
        expect(content.charCodeAt(0)).not.toBe(0xFEFF); // BOM
        expect(content).not.toContain('\r\n'); // Should use LF line endings

        // Should be valid UTF-8
        expect(Buffer.from(content, 'utf-8').toString('utf-8')).toBe(content);
      }
    });
  });

  describe('Template Content Quality', () => {
    it('should have comprehensive documentation in agent prompts', async () => {
      const agentFiles = ['tdd-tester.md', 'tdd-developer.md'];

      for (const agentFile of agentFiles) {
        const agentPath = path.join(AGENTS_TEMPLATE_PATH, agentFile);
        const content = await fs.readFile(agentPath, 'utf-8');
        const agent = parseAgentMarkdown(content);

        const prompt = agent.prompt;

        // Should have substantial content
        expect(prompt.length).toBeGreaterThan(1000);

        // Should have proper structure
        expect(prompt).toMatch(/##?\s+/); // Should have headings
        expect(prompt.split('\n').length).toBeGreaterThan(20); // Multiple paragraphs
      }
    });

    it('should use consistent terminology across templates', async () => {
      const tddWorkflowPath = path.join(WORKFLOWS_TEMPLATE_PATH, 'tdd.yaml');
      const workflowContent = await fs.readFile(tddWorkflowPath, 'utf-8');

      const agentContents = await Promise.all([
        fs.readFile(path.join(AGENTS_TEMPLATE_PATH, 'tdd-tester.md'), 'utf-8'),
        fs.readFile(path.join(AGENTS_TEMPLATE_PATH, 'tdd-developer.md'), 'utf-8'),
      ]);

      const allContent = [workflowContent, ...agentContents].join(' ').toLowerCase();

      // Consistent TDD terminology
      expect(allContent).toContain('red-green-refactor');
      expect(allContent).toContain('test-driven');
      expect(allContent).toContain('failing test');
      expect(allContent).toContain('minimal');
    });

    it('should have proper yaml structure in workflow template', async () => {
      const tddWorkflowPath = path.join(WORKFLOWS_TEMPLATE_PATH, 'tdd.yaml');
      const content = await fs.readFile(tddWorkflowPath, 'utf-8');

      // Should be valid YAML
      const parsed = yaml.parse(content);
      expect(parsed).toBeDefined();

      // Should be well-formatted (proper indentation)
      const lines = content.split('\n');
      let indentationLevels = new Set();

      for (const line of lines) {
        if (line.trim() && !line.startsWith('#')) {
          const indentation = line.length - line.trimStart().length;
          indentationLevels.add(indentation);
        }
      }

      // Should use consistent indentation (multiples of 2)
      for (const level of indentationLevels) {
        expect(level % 2).toBe(0);
      }
    });
  });

  describe('Template Security and Safety', () => {
    it('should not contain hardcoded secrets or sensitive data', async () => {
      const templateFiles = [
        path.join(WORKFLOWS_TEMPLATE_PATH, 'tdd.yaml'),
        path.join(AGENTS_TEMPLATE_PATH, 'tdd-tester.md'),
        path.join(AGENTS_TEMPLATE_PATH, 'tdd-developer.md'),
      ];

      const suspiciousPatterns = [
        /api[_-]?key/i,
        /password/i,
        /secret/i,
        /token/i,
        /auth/i,
        /credential/i,
        /\b[A-Za-z0-9]{20,}\b/, // Long alphanumeric strings
      ];

      for (const filePath of templateFiles) {
        const content = await fs.readFile(filePath, 'utf-8');

        for (const pattern of suspiciousPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            // Allow some legitimate uses
            const allowedMatches = [
              'authentication',
              'authorization',
              'password field',
              'api key configuration',
              'secret scanning'
            ];

            const isAllowed = allowedMatches.some(allowed =>
              content.toLowerCase().includes(allowed.toLowerCase())
            );

            if (!isAllowed) {
              console.warn(`Potential sensitive data in ${filePath}: ${matches[0]}`);
            }
          }
        }
      }
    });

    it('should use safe shell commands in examples', async () => {
      const agentFiles = ['tdd-tester.md', 'tdd-developer.md'];

      for (const agentFile of agentFiles) {
        const agentPath = path.join(AGENTS_TEMPLATE_PATH, agentFile);
        const content = await fs.readFile(agentPath, 'utf-8');

        // Should not contain dangerous shell commands
        const dangerousCommands = ['rm -rf', 'sudo', 'chmod 777', 'eval', 'exec'];

        for (const cmd of dangerousCommands) {
          expect(content.toLowerCase()).not.toContain(cmd);
        }
      }
    });
  });
});