import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { WorkflowDefinitionSchema, WorkflowDefinition } from '../types';

describe('TDD Workflow Integration Tests', () => {
  let tddWorkflow: WorkflowDefinition;

  beforeEach(() => {
    // Load and parse the TDD workflow before each test
    const tddWorkflowPath = path.join(__dirname, '../../templates/workflows/tdd.yaml');
    const content = fs.readFileSync(tddWorkflowPath, 'utf8');
    const parsedWorkflow = yaml.parse(content);
    const result = WorkflowDefinitionSchema.safeParse(parsedWorkflow);

    if (!result.success) {
      throw new Error('TDD workflow failed schema validation');
    }

    tddWorkflow = result.data;
  });

  describe('Workflow Structure Tests', () => {
    it('should have all required stages in correct order', () => {
      const expectedStages = ['write-test', 'run-test', 'implement', 'verify', 'regression-check'];
      const actualStages = tddWorkflow.stages.map(stage => stage.name);

      expect(actualStages).toEqual(expectedStages);
    });

    it('should have proper stage dependencies forming a linear chain', () => {
      // Check that each stage depends on the previous one (except first)
      expect(tddWorkflow.stages[0].dependsOn).toBeUndefined(); // write-test has no dependencies
      expect(tddWorkflow.stages[1].dependsOn).toEqual(['write-test']);
      expect(tddWorkflow.stages[2].dependsOn).toEqual(['run-test']);
      expect(tddWorkflow.stages[3].dependsOn).toEqual(['implement']);
      expect(tddWorkflow.stages[4].dependsOn).toEqual(['verify']);
    });

    it('should assign correct agents to TDD phases', () => {
      const stageAgents = tddWorkflow.stages.map(stage => ({ name: stage.name, agent: stage.agent }));

      expect(stageAgents).toEqual([
        { name: 'write-test', agent: 'tdd-tester' },
        { name: 'run-test', agent: 'tdd-tester' },
        { name: 'implement', agent: 'tdd-developer' },
        { name: 'verify', agent: 'tdd-tester' },
        { name: 'regression-check', agent: 'tdd-tester' }
      ]);
    });

    it('should have meaningful stage descriptions that reference TDD phases', () => {
      expect(tddWorkflow.stages[0].description).toContain('Red phase');
      expect(tddWorkflow.stages[1].description).toContain('Red validation');
      expect(tddWorkflow.stages[2].description).toContain('Green phase');
      expect(tddWorkflow.stages[3].description).toContain('Green validation');
      expect(tddWorkflow.stages[4].description).toContain('Refactor phase');
    });
  });

  describe('Output Tracking Tests', () => {
    it('should define appropriate outputs for each stage', () => {
      const writeTestOutputs = tddWorkflow.stages[0].outputs;
      expect(writeTestOutputs).toContain('test_files');
      expect(writeTestOutputs).toContain('test_requirements');
      expect(writeTestOutputs).toContain('baseline_coverage');

      const runTestOutputs = tddWorkflow.stages[1].outputs;
      expect(runTestOutputs).toContain('test_results');
      expect(runTestOutputs).toContain('failure_confirmation');
      expect(runTestOutputs).toContain('test_report');

      const implementOutputs = tddWorkflow.stages[2].outputs;
      expect(implementOutputs).toContain('code_changes');
      expect(implementOutputs).toContain('implementation_notes');
      expect(implementOutputs).toContain('branch_name');

      const verifyOutputs = tddWorkflow.stages[3].outputs;
      expect(verifyOutputs).toContain('test_results');
      expect(verifyOutputs).toContain('coverage_report');
      expect(verifyOutputs).toContain('success_confirmation');

      const regressionOutputs = tddWorkflow.stages[4].outputs;
      expect(regressionOutputs).toContain('regression_results');
      expect(regressionOutputs).toContain('refactor_suggestions');
      expect(regressionOutputs).toContain('final_coverage_report');
    });

    it('should have unique outputs per stage to prevent conflicts', () => {
      const allOutputs = tddWorkflow.stages.flatMap(stage => stage.outputs || []);
      const uniqueOutputs = [...new Set(allOutputs)];

      // Allow some overlap for test_results but ensure most outputs are unique
      expect(uniqueOutputs.length).toBeGreaterThan(allOutputs.length * 0.8);
    });
  });

  describe('Trigger Configuration Tests', () => {
    it('should support multiple trigger types', () => {
      expect(tddWorkflow.trigger).toBeDefined();
      expect(tddWorkflow.trigger).toContain('manual');
      expect(tddWorkflow.trigger).toContain('apex:tdd');
      expect(tddWorkflow.trigger).toContain('apex:test-driven');
    });

    it('should have correct workflow metadata', () => {
      expect(tddWorkflow.name).toBe('tdd');
      expect(tddWorkflow.description).toContain('Test-Driven Development');
      expect(tddWorkflow.description).toContain('Red-Green-Refactor');
    });
  });

  describe('Red-Green-Refactor Cycle Validation', () => {
    it('should implement the complete Red phase (write failing tests)', () => {
      const redPhaseStages = tddWorkflow.stages.slice(0, 2); // write-test, run-test

      // Both should be handled by tester agent
      redPhaseStages.forEach(stage => {
        expect(stage.agent).toBe('tdd-tester');
      });

      // Should produce test artifacts
      expect(redPhaseStages[0].outputs).toContain('test_files');
      expect(redPhaseStages[1].outputs).toContain('failure_confirmation');
    });

    it('should implement the Green phase (make tests pass)', () => {
      const greenPhaseStages = tddWorkflow.stages.slice(2, 4); // implement, verify

      // Implementation by developer, verification by tester
      expect(greenPhaseStages[0].agent).toBe('tdd-developer');
      expect(greenPhaseStages[1].agent).toBe('tdd-tester');

      // Should produce implementation and success confirmation
      expect(greenPhaseStages[0].outputs).toContain('code_changes');
      expect(greenPhaseStages[1].outputs).toContain('success_confirmation');
    });

    it('should implement the Refactor phase (improve code quality)', () => {
      const refactorStage = tddWorkflow.stages[4]; // regression-check

      expect(refactorStage.agent).toBe('tdd-tester');
      expect(refactorStage.outputs).toContain('refactor_suggestions');
      expect(refactorStage.outputs).toContain('final_coverage_report');
    });
  });

  describe('Workflow Execution Simulation', () => {
    it('should simulate a complete TDD cycle execution order', () => {
      // Simulate workflow execution by checking dependency satisfaction
      const executionOrder: string[] = [];
      const completed = new Set<string>();

      while (executionOrder.length < tddWorkflow.stages.length) {
        const availableStages = tddWorkflow.stages.filter(stage =>
          !completed.has(stage.name) &&
          (stage.dependsOn || []).every(dep => completed.has(dep))
        );

        if (availableStages.length === 0) {
          throw new Error('Circular dependency detected');
        }

        const nextStage = availableStages[0];
        executionOrder.push(nextStage.name);
        completed.add(nextStage.name);
      }

      expect(executionOrder).toEqual([
        'write-test',
        'run-test',
        'implement',
        'verify',
        'regression-check'
      ]);
    });

    it('should prevent execution of later stages without completing earlier ones', () => {
      // Test that implement stage cannot run before run-test
      const implementStage = tddWorkflow.stages.find(s => s.name === 'implement')!;
      expect(implementStage.dependsOn).toContain('run-test');

      // Test that verify stage cannot run before implement
      const verifyStage = tddWorkflow.stages.find(s => s.name === 'verify')!;
      expect(verifyStage.dependsOn).toContain('implement');
    });
  });

  describe('Agent Role Consistency', () => {
    it('should consistently assign testing-related stages to tdd-tester', () => {
      const testingStages = ['write-test', 'run-test', 'verify', 'regression-check'];

      testingStages.forEach(stageName => {
        const stage = tddWorkflow.stages.find(s => s.name === stageName)!;
        expect(stage.agent).toBe('tdd-tester');
      });
    });

    it('should assign implementation stage to tdd-developer', () => {
      const implementStage = tddWorkflow.stages.find(s => s.name === 'implement')!;
      expect(implementStage.agent).toBe('tdd-developer');
    });
  });

  describe('Output Completeness', () => {
    it('should ensure all stages produce meaningful outputs', () => {
      tddWorkflow.stages.forEach(stage => {
        expect(stage.outputs).toBeDefined();
        expect(stage.outputs!.length).toBeGreaterThan(0);

        // Ensure no empty outputs
        stage.outputs!.forEach(output => {
          expect(output.trim()).not.toBe('');
        });
      });
    });

    it('should provide traceability outputs for debugging', () => {
      // Key stages should provide outputs that help with debugging
      const writeTestStage = tddWorkflow.stages[0];
      expect(writeTestStage.outputs).toContain('test_requirements');

      const implementStage = tddWorkflow.stages[2];
      expect(implementStage.outputs).toContain('implementation_notes');

      const finalStage = tddWorkflow.stages[4];
      expect(finalStage.outputs).toContain('final_coverage_report');
    });
  });
});