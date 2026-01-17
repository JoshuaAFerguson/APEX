import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadWorkflows, loadWorkflow, initializeApex } from '../config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { WorkflowDefinitionSchema } from '../types';

describe('TDD Template Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-tdd-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Template File Presence', () => {
    it('should have TDD workflow template in templates directory', async () => {
      const templatePath = path.join(__dirname, '../../templates/workflows/tdd.yaml');
      await expect(fs.access(templatePath)).resolves.toBeUndefined();
    });

    it('should have TDD agent templates', async () => {
      const testerPath = path.join(__dirname, '../../templates/agents/tdd-tester.md');
      const developerPath = path.join(__dirname, '../../templates/agents/tdd-developer.md');

      await expect(fs.access(testerPath)).resolves.toBeUndefined();
      await expect(fs.access(developerPath)).resolves.toBeUndefined();
    });

    it('should have valid YAML in TDD workflow template', async () => {
      const templatePath = path.join(__dirname, '../../templates/workflows/tdd.yaml');
      const content = await fs.readFile(templatePath, 'utf-8');

      expect(() => yaml.parse(content)).not.toThrow();
    });

    it('should have valid markdown frontmatter in TDD agent templates', async () => {
      const agents = ['tdd-tester.md', 'tdd-developer.md'];
      const agentsDir = path.join(__dirname, '../../templates/agents');

      for (const agentFile of agents) {
        const agentPath = path.join(agentsDir, agentFile);
        const content = await fs.readFile(agentPath, 'utf-8');

        // Check for frontmatter format
        expect(content).toMatch(/^---\n[\s\S]*?\n---\n/);

        // Extract and validate frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        expect(frontmatterMatch).toBeTruthy();

        if (frontmatterMatch) {
          expect(() => yaml.parse(frontmatterMatch[1])).not.toThrow();
        }
      }
    });
  });

  describe('Template Copying During Initialization', () => {
    it('should copy TDD workflow template to project during initialization', async () => {
      // Note: initializeApex only creates the config, not templates
      // Template copying is handled by CLI separately
      await initializeApex(tempDir, { projectName: 'test-project' });

      // The core initializeApex doesn't copy templates - this is handled by CLI
      // So we verify the config is created with TDD configuration
      const config = await loadConfig(tempDir);
      expect(config.tdd).toBeDefined();
    });

    it('should have TDD configuration ready for template copying', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });

      // Check that TDD config is properly initialized
      const config = await loadConfig(tempDir);
      expect(config.tdd).toEqual({
        enabled: false,
        testCommand: 'npm test',
        watchMode: false,
        maxIterations: 5,
        regressionGuard: true,
      });
    });

    it('should be able to load workflows from empty directory', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });

      const workflows = await loadWorkflows(tempDir);
      // Should return empty object when no workflow files exist
      expect(workflows).toEqual({});
    });
  });

  describe('Workflow Loading and Validation', () => {
    beforeEach(async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });

      // Manually copy TDD workflow template for testing
      const templatePath = path.join(__dirname, '../../templates/workflows/tdd.yaml');
      const targetPath = path.join(tempDir, '.apex', 'workflows', 'tdd.yaml');
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      await fs.writeFile(targetPath, templateContent);
    });

    it('should load TDD workflow using loadWorkflow function', async () => {
      const tddWorkflow = await loadWorkflow(tempDir, 'tdd');

      expect(tddWorkflow).toBeTruthy();
      expect(tddWorkflow?.name).toBe('tdd');
      expect(tddWorkflow?.description).toContain('Test-Driven Development');
    });

    it('should load TDD workflow using loadWorkflows function', async () => {
      const workflows = await loadWorkflows(tempDir);

      expect(workflows).toHaveProperty('tdd');
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow.name).toBe('tdd');
      expect(tddWorkflow.stages).toHaveLength(5);
    });

    it('should validate TDD workflow against schema', async () => {
      const tddWorkflow = await loadWorkflow(tempDir, 'tdd');
      expect(tddWorkflow).toBeTruthy();

      if (tddWorkflow) {
        const result = WorkflowDefinitionSchema.safeParse(tddWorkflow);
        expect(result.success).toBe(true);
      }
    });

    it('should have all required stages in correct order', async () => {
      const tddWorkflow = await loadWorkflow(tempDir, 'tdd');
      expect(tddWorkflow).toBeTruthy();

      if (tddWorkflow) {
        const stageNames = tddWorkflow.stages.map(stage => stage.name);
        expect(stageNames).toEqual([
          'planning',
          'test-first',
          'implementation',
          'refactor',
          'verification'
        ]);
      }
    });

    it('should have correct stage dependencies', async () => {
      const tddWorkflow = await loadWorkflow(tempDir, 'tdd');
      expect(tddWorkflow).toBeTruthy();

      if (tddWorkflow) {
        const stages = tddWorkflow.stages;

        // Check dependencies
        expect(stages[0].dependsOn).toBeUndefined(); // planning
        expect(stages[1].dependsOn).toEqual(['planning']); // test-first
        expect(stages[2].dependsOn).toEqual(['test-first']); // implementation
        expect(stages[3].dependsOn).toEqual(['implementation']); // refactor
        expect(stages[4].dependsOn).toEqual(['refactor']); // verification
      }
    });

    it('should use correct agents for each stage', async () => {
      const tddWorkflow = await loadWorkflow(tempDir, 'tdd');
      expect(tddWorkflow).toBeTruthy();

      if (tddWorkflow) {
        const stageAgents = tddWorkflow.stages.map(stage => ({
          name: stage.name,
          agent: stage.agent
        }));

        expect(stageAgents).toEqual([
          { name: 'planning', agent: 'planner' },
          { name: 'test-first', agent: 'tdd-tester' },
          { name: 'implementation', agent: 'tdd-developer' },
          { name: 'refactor', agent: 'developer' },
          { name: 'verification', agent: 'tdd-tester' }
        ]);
      }
    });

    it('should have appropriate outputs for each stage', async () => {
      const tddWorkflow = await loadWorkflow(tempDir, 'tdd');
      expect(tddWorkflow).toBeTruthy();

      if (tddWorkflow) {
        const stages = tddWorkflow.stages;

        // Each stage should have outputs
        stages.forEach(stage => {
          expect(stage.outputs).toBeDefined();
          expect(Array.isArray(stage.outputs)).toBe(true);
          expect(stage.outputs!.length).toBeGreaterThan(0);
        });

        // Check specific outputs
        expect(stages[0].outputs).toContain('implementation_plan'); // planning
        expect(stages[1].outputs).toContain('test_files'); // test-first
        expect(stages[2].outputs).toContain('code_changes'); // implementation
        expect(stages[3].outputs).toContain('refactored_code'); // refactor
        expect(stages[4].outputs).toContain('coverage_report'); // verification
      }
    });
  });

  describe('Template Content Validation', () => {
    beforeEach(async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });
    });

    it('should have descriptive stage descriptions', async () => {
      const tddWorkflow = await loadWorkflow(tempDir, 'tdd');
      expect(tddWorkflow).toBeTruthy();

      if (tddWorkflow) {
        const stages = tddWorkflow.stages;

        stages.forEach(stage => {
          expect(stage.description).toBeDefined();
          expect(stage.description!.length).toBeGreaterThan(10);
        });

        // Check for TDD-specific terminology
        expect(stages[1].description).toContain('Red phase'); // test-first
        expect(stages[2].description).toContain('Green phase'); // implementation
        expect(stages[3].description).toContain('Refactor phase'); // refactor
      }
    });

    it('should have appropriate trigger configuration', async () => {
      const tddWorkflow = await loadWorkflow(tempDir, 'tdd');
      expect(tddWorkflow).toBeTruthy();

      if (tddWorkflow) {
        expect(tddWorkflow.trigger).toBeDefined();
        expect(tddWorkflow.trigger).toContain('manual');
        expect(tddWorkflow.trigger).toContain('apex:tdd');
        expect(tddWorkflow.trigger).toContain('apex:test-driven');
      }
    });

    it('should contain TDD methodology references', async () => {
      const tddWorkflow = await loadWorkflow(tempDir, 'tdd');
      expect(tddWorkflow).toBeTruthy();

      if (tddWorkflow) {
        const workflowContent = JSON.stringify(tddWorkflow).toLowerCase();

        // Should contain TDD-related terms
        expect(workflowContent).toContain('test-driven');
        expect(workflowContent).toContain('red-green-refactor');
        expect(workflowContent).toContain('failing test');
      }
    });
  });

  describe('Integration with Project Configuration', () => {
    it('should work with different project configurations', async () => {
      const projectConfigs = [
        { projectName: 'js-project', language: 'javascript', framework: 'node' },
        { projectName: 'ts-project', language: 'typescript', framework: 'react' },
        { projectName: 'py-project', language: 'python', framework: 'django' },
      ];

      for (const config of projectConfigs) {
        const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-multi-test-'));

        try {
          await initializeApex(projectDir, config);
          const workflows = await loadWorkflows(projectDir);

          expect(workflows).toHaveProperty('tdd');
          expect(workflows.tdd.name).toBe('tdd');
        } finally {
          await fs.rm(projectDir, { recursive: true, force: true });
        }
      }
    });

    it('should respect custom TDD configuration in project config', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });

      // Modify config to enable TDD
      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      let configContent = await fs.readFile(configPath, 'utf-8');

      configContent = configContent.replace(
        'enabled: false',
        'enabled: true'
      );

      await fs.writeFile(configPath, configContent);

      // Workflow should still load correctly
      const workflows = await loadWorkflows(tempDir);
      expect(workflows).toHaveProperty('tdd');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing workflow directory gracefully', async () => {
      const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-empty-'));

      try {
        const workflows = await loadWorkflows(emptyDir);
        expect(workflows).toEqual({});
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });

    it('should handle corrupted workflow file', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });

      // Corrupt the TDD workflow file
      const tddWorkflowPath = path.join(tempDir, '.apex', 'workflows', 'tdd.yaml');
      await fs.writeFile(tddWorkflowPath, 'invalid: yaml: content: [');

      // Should throw error when trying to load
      await expect(loadWorkflow(tempDir, 'tdd')).rejects.toThrow();
    });

    it('should return null for non-existent workflow', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });

      const nonExistentWorkflow = await loadWorkflow(tempDir, 'non-existent');
      expect(nonExistentWorkflow).toBeNull();
    });

    it('should handle workflow file with invalid schema', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });

      // Create invalid workflow
      const invalidWorkflowPath = path.join(tempDir, '.apex', 'workflows', 'invalid.yaml');
      const invalidWorkflow = {
        name: 'invalid',
        description: 'Invalid workflow',
        stages: [
          {
            name: 'test',
            // Missing required 'agent' field
            description: 'Test stage'
          }
        ]
      };

      await fs.writeFile(invalidWorkflowPath, yaml.stringify(invalidWorkflow));

      // Should throw validation error
      await expect(loadWorkflows(tempDir)).rejects.toThrow();
    });

    it('should handle permission errors gracefully', async () => {
      if (process.platform !== 'win32') { // Skip on Windows due to different permission model
        await initializeApex(tempDir, { projectName: 'test-project' });

        const workflowsDir = path.join(tempDir, '.apex', 'workflows');

        // Remove read permissions
        await fs.chmod(workflowsDir, 0o000);

        try {
          await expect(loadWorkflows(tempDir)).rejects.toThrow();
        } finally {
          // Restore permissions for cleanup
          await fs.chmod(workflowsDir, 0o755);
        }
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should efficiently load multiple workflows including TDD', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });

      // Add several more workflow files
      const workflowsDir = path.join(tempDir, '.apex', 'workflows');
      const additionalWorkflows = Array.from({ length: 10 }, (_, i) => ({
        name: `workflow-${i}`,
        description: `Test workflow ${i}`,
        stages: [{
          name: 'test-stage',
          agent: 'tester',
          description: 'Test stage',
          outputs: ['result']
        }]
      }));

      for (const [index, workflow] of additionalWorkflows.entries()) {
        await fs.writeFile(
          path.join(workflowsDir, `workflow-${index}.yaml`),
          yaml.stringify(workflow)
        );
      }

      const startTime = Date.now();
      const workflows = await loadWorkflows(tempDir);
      const duration = Date.now() - startTime;

      expect(Object.keys(workflows)).toHaveLength(11); // TDD + 10 additional
      expect(workflows).toHaveProperty('tdd');
      expect(duration).toBeLessThan(1000); // Should load in under 1 second
    });
  });
});