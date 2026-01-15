/**
 * Coverage tests for TDD workflow and agent templates
 *
 * Tests that the TDD templates are properly included in APEX's default templates
 * and can be used for project initialization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { initializeApex, loadWorkflows, loadAgents } from '@apexcli/core';

describe('TDD Template Coverage Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tdd-coverage-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Default Template Installation', () => {
    it('should include TDD workflow in default templates', async () => {
      // Initialize a new project
      await initializeApex(testDir, {
        projectName: 'tdd-coverage-test',
        language: 'typescript'
      });

      // Check that TDD workflow template exists
      const tddWorkflowPath = path.join(testDir, '.apex', 'workflows', 'tdd.yaml');
      const tddWorkflowExists = await fs.stat(tddWorkflowPath).then(() => true).catch(() => false);
      expect(tddWorkflowExists).toBe(true);

      // Load and verify TDD workflow
      const workflows = await loadWorkflows(testDir);
      expect(workflows.tdd).toBeDefined();
      expect(workflows.tdd.name).toBe('tdd');
      expect(workflows.tdd.description).toContain('Test-Driven Development');
    });

    it('should include TDD agents in default templates', async () => {
      await initializeApex(testDir, {
        projectName: 'tdd-agents-test'
      });

      // Check that TDD agent templates exist
      const tddTesterPath = path.join(testDir, '.apex', 'agents', 'tdd-tester.md');
      const tddDeveloperPath = path.join(testDir, '.apex', 'agents', 'tdd-developer.md');

      const testerExists = await fs.stat(tddTesterPath).then(() => true).catch(() => false);
      const developerExists = await fs.stat(tddDeveloperPath).then(() => true).catch(() => false);

      expect(testerExists).toBe(true);
      expect(developerExists).toBe(true);

      // Load and verify TDD agents
      const agents = await loadAgents(testDir);
      expect(agents['tdd-tester']).toBeDefined();
      expect(agents['tdd-developer']).toBeDefined();
    });

    it('should have functional TDD workflow after initialization', async () => {
      await initializeApex(testDir, {
        projectName: 'functional-tdd-test'
      });

      const workflows = await loadWorkflows(testDir);
      const agents = await loadAgents(testDir);
      const tddWorkflow = workflows.tdd;

      // Verify all stages reference existing agents
      for (const stage of tddWorkflow.stages) {
        expect(agents[stage.agent]).toBeDefined();
      }

      // Verify Red-Green-Refactor cycle is complete
      const stageNames = tddWorkflow.stages.map(s => s.name);
      expect(stageNames).toContain('write-test');   // Red phase
      expect(stageNames).toContain('run-test');     // Red validation
      expect(stageNames).toContain('implement');    // Green phase
      expect(stageNames).toContain('verify');       // Green validation
      expect(stageNames).toContain('regression-check'); // Refactor phase
    });

    it('should have proper trigger configuration', async () => {
      await initializeApex(testDir, {
        projectName: 'trigger-test'
      });

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // Verify TDD-specific triggers
      expect(tddWorkflow.trigger).toContain('manual');
      expect(tddWorkflow.trigger).toContain('apex:tdd');
      expect(tddWorkflow.trigger).toContain('apex:test-driven');
    });
  });

  describe('TDD Template Integrity', () => {
    it('should have consistent agent references across workflow stages', async () => {
      await initializeApex(testDir, {
        projectName: 'integrity-test'
      });

      const workflows = await loadWorkflows(testDir);
      const agents = await loadAgents(testDir);
      const tddWorkflow = workflows.tdd;

      // Build map of agent usage
      const agentUsage = tddWorkflow.stages.reduce((acc, stage) => {
        acc[stage.agent] = (acc[stage.agent] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Verify expected agent usage
      expect(agentUsage['tdd-tester']).toBeGreaterThan(0);
      expect(agentUsage['tdd-developer']).toBeGreaterThan(0);

      // Verify all referenced agents exist
      Object.keys(agentUsage).forEach(agentName => {
        expect(agents[agentName]).toBeDefined();
      });
    });

    it('should have stage outputs that align with TDD methodology', async () => {
      await initializeApex(testDir, {
        projectName: 'outputs-test'
      });

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // Collect all outputs
      const allOutputs = tddWorkflow.stages.flatMap(stage => stage.outputs || []);

      // Verify TDD-specific outputs exist
      expect(allOutputs).toContain('test_files');
      expect(allOutputs).toContain('test_results');
      expect(allOutputs).toContain('coverage_report');
      expect(allOutputs).toContain('code_changes');
      expect(allOutputs).toContain('implementation_notes');
      expect(allOutputs).toContain('regression_results');
    });

    it('should have proper dependency chain for Red-Green-Refactor', async () => {
      await initializeApex(testDir, {
        projectName: 'dependency-test'
      });

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // Build dependency graph
      const dependencies: Record<string, string[]> = {};
      tddWorkflow.stages.forEach(stage => {
        dependencies[stage.name] = stage.dependsOn || [];
      });

      // Verify Red phase progression
      const writeTestStage = tddWorkflow.stages.find(s => s.name === 'write-test');
      const runTestStage = tddWorkflow.stages.find(s => s.name === 'run-test');
      expect(writeTestStage?.dependsOn).toBeUndefined(); // No dependencies
      expect(runTestStage?.dependsOn).toContain('write-test');

      // Verify Green phase progression
      const implementStage = tddWorkflow.stages.find(s => s.name === 'implement');
      const verifyStage = tddWorkflow.stages.find(s => s.name === 'verify');
      expect(implementStage?.dependsOn).toContain('run-test');
      expect(verifyStage?.dependsOn).toContain('implement');

      // Verify Refactor phase
      const regressionStage = tddWorkflow.stages.find(s => s.name === 'regression-check');
      expect(regressionStage?.dependsOn).toContain('verify');
    });
  });

  describe('Agent Template Quality', () => {
    it('should have comprehensive TDD guidance in tester agent', async () => {
      await initializeApex(testDir, {
        projectName: 'tester-quality-test'
      });

      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];

      // Verify TDD methodology coverage
      expect(tddTester.prompt).toContain('Red-Green-Refactor');
      expect(tddTester.prompt).toContain('Red Phase');
      expect(tddTester.prompt).toContain('Green Validation');
      expect(tddTester.prompt).toContain('Regression Safety');

      // Verify test quality guidance
      expect(tddTester.prompt).toContain('AAA pattern');
      expect(tddTester.prompt).toContain('fast, isolated, and deterministic');
      expect(tddTester.prompt).toContain('descriptive test names');

      // Verify stage-specific guidance exists
      expect(tddTester.prompt).toContain('write-test, run-test');
      expect(tddTester.prompt).toContain('verify stage');
      expect(tddTester.prompt).toContain('regression-check');
    });

    it('should have comprehensive TDD guidance in developer agent', async () => {
      await initializeApex(testDir, {
        projectName: 'developer-quality-test'
      });

      const agents = await loadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      // Verify Green phase focus
      expect(tddDeveloper.prompt).toContain('Green phase');
      expect(tddDeveloper.prompt).toContain('Red-Green-Refactor');

      // Verify minimal implementation principles
      expect(tddDeveloper.prompt).toContain('Minimal Implementation');
      expect(tddDeveloper.prompt).toContain('simplest code');
      expect(tddDeveloper.prompt).toContain('only the code needed');

      // Verify TDD patterns
      expect(tddDeveloper.prompt).toContain('Fake It Till You Make It');
      expect(tddDeveloper.prompt).toContain('Triangulation');
      expect(tddDeveloper.prompt).toContain('Obvious Implementation');

      // Verify test-driven design guidance
      expect(tddDeveloper.prompt).toContain('Test-Driven Design');
      expect(tddDeveloper.prompt).toContain('Let tests define');
    });

    it('should have appropriate tool assignments for each agent', async () => {
      await initializeApex(testDir, {
        projectName: 'tools-test'
      });

      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];
      const tddDeveloper = agents['tdd-developer'];

      // Verify core tools for both agents
      const coreTools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];
      coreTools.forEach(tool => {
        expect(tddTester.tools).toContain(tool);
        expect(tddDeveloper.tools).toContain(tool);
      });

      // Verify developer has additional tools for implementation
      expect(tddDeveloper.tools).toContain('MultiEdit');

      // Verify model assignments
      expect(tddTester.model).toBe('sonnet');
      expect(tddDeveloper.model).toBe('sonnet');
    });

    it('should have proper agent names and descriptions', async () => {
      await initializeApex(testDir, {
        projectName: 'naming-test'
      });

      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];
      const tddDeveloper = agents['tdd-developer'];

      // Verify naming conventions
      expect(tddTester.name).toBe('tdd-tester');
      expect(tddDeveloper.name).toBe('tdd-developer');

      // Verify descriptions are TDD-specific
      expect(tddTester.description).toContain('TDD');
      expect(tddTester.description).toContain('test');
      expect(tddDeveloper.description).toContain('TDD');
      expect(tddDeveloper.description).toContain('minimal');
    });
  });

  describe('Template Completeness', () => {
    it('should provide a complete TDD workflow solution', async () => {
      await initializeApex(testDir, {
        projectName: 'completeness-test'
      });

      const workflows = await loadWorkflows(testDir);
      const agents = await loadAgents(testDir);

      // Verify we have everything needed for TDD
      expect(workflows.tdd).toBeDefined();
      expect(agents['tdd-tester']).toBeDefined();
      expect(agents['tdd-developer']).toBeDefined();

      // Verify the workflow is self-contained
      const tddWorkflow = workflows.tdd;
      const usedAgents = [...new Set(tddWorkflow.stages.map(s => s.agent))];
      usedAgents.forEach(agentName => {
        expect(agents[agentName]).toBeDefined();
      });

      // Verify complete Red-Green-Refactor cycle
      const stageNames = tddWorkflow.stages.map(s => s.name);
      const requiredStages = ['write-test', 'run-test', 'implement', 'verify', 'regression-check'];
      requiredStages.forEach(stageName => {
        expect(stageNames).toContain(stageName);
      });
    });

    it('should be usable out of the box after initialization', async () => {
      await initializeApex(testDir, {
        projectName: 'usability-test'
      });

      // Verify files are created and loadable
      const workflows = await loadWorkflows(testDir);
      const agents = await loadAgents(testDir);

      expect(workflows.tdd).toBeDefined();
      expect(agents['tdd-tester']).toBeDefined();
      expect(agents['tdd-developer']).toBeDefined();

      // No additional setup should be required
      expect(workflows.tdd.stages.length).toBeGreaterThan(0);
      expect(agents['tdd-tester'].prompt.length).toBeGreaterThan(0);
      expect(agents['tdd-developer'].prompt.length).toBeGreaterThan(0);
    });
  });
});