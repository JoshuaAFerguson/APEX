/**
 * Comprehensive TDD functionality tests
 *
 * This test file verifies that all TDD components work together:
 * - TDD workflow definition is valid
 * - TDD agents are properly configured
 * - Templates are properly installed
 * - Complete Red-Green-Refactor cycle is functional
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { initializeApex, loadWorkflows, loadAgents } from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';

describe('TDD Comprehensive Integration Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tdd-comprehensive-'));
    await initializeApex(testDir, {
      projectName: 'tdd-comprehensive-test',
      language: 'typescript'
    });

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Complete TDD Setup Validation', () => {
    it('should have fully functional TDD workflow after initialization', async () => {
      const workflows = await loadWorkflows(testDir);
      const agents = await loadAgents(testDir);

      // Verify TDD workflow exists and is complete
      expect(workflows.tdd).toBeDefined();
      const tddWorkflow = workflows.tdd;

      // Verify workflow metadata
      expect(tddWorkflow.name).toBe('tdd');
      expect(tddWorkflow.description).toContain('Test-Driven Development');
      expect(tddWorkflow.trigger).toContain('apex:tdd');

      // Verify complete Red-Green-Refactor cycle
      const stageNames = tddWorkflow.stages.map(s => s.name);
      expect(stageNames).toEqual([
        'write-test',
        'run-test',
        'implement',
        'verify',
        'regression-check'
      ]);

      // Verify all agents exist and are properly configured
      expect(agents['tdd-tester']).toBeDefined();
      expect(agents['tdd-developer']).toBeDefined();

      // Verify agent assignments in workflow
      const writeTestStage = tddWorkflow.stages.find(s => s.name === 'write-test');
      const implementStage = tddWorkflow.stages.find(s => s.name === 'implement');
      const verifyStage = tddWorkflow.stages.find(s => s.name === 'verify');

      expect(writeTestStage?.agent).toBe('tdd-tester');
      expect(implementStage?.agent).toBe('tdd-developer');
      expect(verifyStage?.agent).toBe('tdd-tester');
    });

    it('should have proper TDD methodology guidance', async () => {
      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];
      const tddDeveloper = agents['tdd-developer'];

      // Verify TDD tester has comprehensive testing guidance
      expect(tddTester.prompt).toContain('Red-Green-Refactor cycle');
      expect(tddTester.prompt).toContain('Write failing tests');
      expect(tddTester.prompt).toContain('AAA pattern');
      expect(tddTester.prompt).toContain('fast, isolated, and deterministic');

      // Verify TDD developer has minimal implementation guidance
      expect(tddDeveloper.prompt).toContain('Green phase');
      expect(tddDeveloper.prompt).toContain('simplest code');
      expect(tddDeveloper.prompt).toContain('Minimal Implementation');
      expect(tddDeveloper.prompt).toContain('Fake It Till You Make It');
    });

    it('should support TDD task creation and management', async () => {
      // Create TDD task
      const task = await orchestrator.createTask({
        description: 'Implement user registration using TDD approach',
        workflow: 'tdd'
      });

      expect(task).toBeDefined();
      expect(task.workflow).toBe('tdd');
      expect(task.status).toBe('pending');

      // Verify task is retrievable
      const retrieved = await orchestrator.getTask(task.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.workflow).toBe('tdd');
    });

    it('should have appropriate outputs for each TDD phase', async () => {
      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // Red phase outputs
      const writeTestStage = tddWorkflow.stages.find(s => s.name === 'write-test');
      expect(writeTestStage?.outputs).toContain('test_files');
      expect(writeTestStage?.outputs).toContain('test_requirements');

      const runTestStage = tddWorkflow.stages.find(s => s.name === 'run-test');
      expect(runTestStage?.outputs).toContain('test_results');
      expect(runTestStage?.outputs).toContain('failure_confirmation');

      // Green phase outputs
      const implementStage = tddWorkflow.stages.find(s => s.name === 'implement');
      expect(implementStage?.outputs).toContain('code_changes');
      expect(implementStage?.outputs).toContain('implementation_notes');

      const verifyStage = tddWorkflow.stages.find(s => s.name === 'verify');
      expect(verifyStage?.outputs).toContain('coverage_report');
      expect(verifyStage?.outputs).toContain('success_confirmation');

      // Refactor phase outputs
      const regressionStage = tddWorkflow.stages.find(s => s.name === 'regression-check');
      expect(regressionStage?.outputs).toContain('regression_results');
      expect(regressionStage?.outputs).toContain('final_coverage_report');
    });
  });

  describe('TDD Agent Tool Configuration', () => {
    it('should have appropriate tools for testing and development', async () => {
      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];
      const tddDeveloper = agents['tdd-developer'];

      // Core tools for both agents
      const coreTools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];
      coreTools.forEach(tool => {
        expect(tddTester.tools).toContain(tool);
        expect(tddDeveloper.tools).toContain(tool);
      });

      // Developer should have additional tools
      expect(tddDeveloper.tools).toContain('MultiEdit');

      // Both should use powerful model for complex TDD tasks
      expect(tddTester.model).toBe('sonnet');
      expect(tddDeveloper.model).toBe('sonnet');
    });
  });

  describe('TDD Stage Dependencies and Flow', () => {
    it('should have correct dependency chain for Red-Green-Refactor', async () => {
      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // No dependencies for first stage
      expect(tddWorkflow.stages[0].dependsOn).toBeUndefined();

      // Sequential dependencies
      expect(tddWorkflow.stages[1].dependsOn).toEqual(['write-test']);
      expect(tddWorkflow.stages[2].dependsOn).toEqual(['run-test']);
      expect(tddWorkflow.stages[3].dependsOn).toEqual(['implement']);
      expect(tddWorkflow.stages[4].dependsOn).toEqual(['verify']);
    });

    it('should prevent circular dependencies', async () => {
      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // Build dependency graph
      const dependencies: Record<string, string[]> = {};
      tddWorkflow.stages.forEach(stage => {
        dependencies[stage.name] = stage.dependsOn || [];
      });

      // Check for cycles using DFS
      const visited = new Set<string>();
      const visiting = new Set<string>();

      const hasCycle = (stageName: string): boolean => {
        if (visiting.has(stageName)) return true;
        if (visited.has(stageName)) return false;

        visiting.add(stageName);
        for (const dep of dependencies[stageName] || []) {
          if (hasCycle(dep)) return true;
        }
        visiting.delete(stageName);
        visited.add(stageName);
        return false;
      };

      // Verify no cycles exist
      for (const stageName of Object.keys(dependencies)) {
        expect(hasCycle(stageName)).toBe(false);
      }
    });
  });

  describe('TDD Workflow Triggers', () => {
    it('should support multiple TDD trigger patterns', async () => {
      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // Should support standard triggers
      expect(tddWorkflow.trigger).toContain('manual');
      expect(tddWorkflow.trigger).toContain('apex:tdd');
      expect(tddWorkflow.trigger).toContain('apex:test-driven');

      // Should have at least these 3 triggers
      expect(tddWorkflow.trigger?.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Template File Integrity', () => {
    it('should have created TDD workflow and agent files', async () => {
      // Check workflow file exists
      const workflowPath = path.join(testDir, '.apex', 'workflows', 'tdd.yaml');
      const workflowExists = await fs.stat(workflowPath).then(() => true).catch(() => false);
      expect(workflowExists).toBe(true);

      // Check agent files exist
      const testerPath = path.join(testDir, '.apex', 'agents', 'tdd-tester.md');
      const developerPath = path.join(testDir, '.apex', 'agents', 'tdd-developer.md');

      const testerExists = await fs.stat(testerPath).then(() => true).catch(() => false);
      const developerExists = await fs.stat(developerPath).then(() => true).catch(() => false);

      expect(testerExists).toBe(true);
      expect(developerExists).toBe(true);
    });

    it('should have consistent content across template files', async () => {
      // Read workflow file directly
      const workflowPath = path.join(testDir, '.apex', 'workflows', 'tdd.yaml');
      const workflowContent = await fs.readFile(workflowPath, 'utf-8');

      // Should contain expected workflow name and stages
      expect(workflowContent).toContain('name: tdd');
      expect(workflowContent).toContain('write-test');
      expect(workflowContent).toContain('implement');
      expect(workflowContent).toContain('tdd-tester');
      expect(workflowContent).toContain('tdd-developer');

      // Read agent files directly
      const testerPath = path.join(testDir, '.apex', 'agents', 'tdd-tester.md');
      const developerPath = path.join(testDir, '.apex', 'agents', 'tdd-developer.md');

      const testerContent = await fs.readFile(testerPath, 'utf-8');
      const developerContent = await fs.readFile(developerPath, 'utf-8');

      // Should contain TDD-specific guidance
      expect(testerContent).toContain('TDD specialist');
      expect(testerContent).toContain('Red-Green-Refactor');
      expect(developerContent).toContain('minimal code');
      expect(developerContent).toContain('Green phase');
    });
  });

  describe('End-to-End TDD Workflow Readiness', () => {
    it('should be ready for immediate use after initialization', async () => {
      // All components should load without errors
      const workflows = await loadWorkflows(testDir);
      const agents = await loadAgents(testDir);

      expect(workflows.tdd).toBeDefined();
      expect(agents['tdd-tester']).toBeDefined();
      expect(agents['tdd-developer']).toBeDefined();

      // Should be able to create and manage TDD tasks
      const task = await orchestrator.createTask({
        description: 'End-to-end TDD workflow test',
        workflow: 'tdd'
      });

      expect(task.id).toBeDefined();
      expect(task.status).toBe('pending');

      // Should be able to update task status
      await orchestrator.updateTaskStatus(task.id, 'queued');
      const updated = await orchestrator.getTask(task.id);
      expect(updated?.status).toBe('queued');
    });

    it('should provide complete TDD methodology coverage', async () => {
      const workflows = await loadWorkflows(testDir);
      const agents = await loadAgents(testDir);
      const tddWorkflow = workflows.tdd;
      const tddTester = agents['tdd-tester'];
      const tddDeveloper = agents['tdd-developer'];

      // Red phase coverage
      const redStages = tddWorkflow.stages.filter(s =>
        s.description.includes('Red') || s.name.includes('test')
      );
      expect(redStages.length).toBeGreaterThanOrEqual(2);

      // Green phase coverage
      const greenStages = tddWorkflow.stages.filter(s =>
        s.description.includes('Green') || s.name.includes('implement') || s.name.includes('verify')
      );
      expect(greenStages.length).toBeGreaterThanOrEqual(2);

      // Refactor phase coverage
      const refactorStages = tddWorkflow.stages.filter(s =>
        s.description.includes('Refactor') || s.name.includes('regression')
      );
      expect(refactorStages.length).toBeGreaterThanOrEqual(1);

      // Comprehensive guidance
      expect(tddTester.prompt.length).toBeGreaterThan(500); // Substantial guidance
      expect(tddDeveloper.prompt.length).toBeGreaterThan(500); // Substantial guidance
    });
  });
});