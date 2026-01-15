import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { WorkflowDefinitionSchema } from '../types';

describe('TDD Workflow Validation', () => {
  it('should validate the TDD workflow template against WorkflowDefinitionSchema', () => {
    // Read the TDD workflow template
    const tddWorkflowPath = path.join(__dirname, '../../templates/workflows/tdd.yaml');
    const content = fs.readFileSync(tddWorkflowPath, 'utf8');

    // Parse YAML content
    const workflow = yaml.parse(content);

    // Validate against schema
    const result = WorkflowDefinitionSchema.safeParse(workflow);

    expect(result.success).toBe(true);

    if (result.success) {
      // Verify TDD workflow structure
      expect(result.data.name).toBe('tdd');
      expect(result.data.description).toBe('Test-Driven Development workflow following Red-Green-Refactor cycle');
      expect(result.data.stages).toHaveLength(5);

      // Verify required stages exist in correct order
      const stageNames = result.data.stages.map(stage => stage.name);
      expect(stageNames).toEqual([
        'write-test',
        'run-test',
        'implement',
        'verify',
        'regression-check'
      ]);

      // Verify each stage has required properties
      result.data.stages.forEach(stage => {
        expect(stage.name).toBeDefined();
        expect(stage.agent).toBeDefined();
        expect(stage.description).toBeDefined();
        expect(stage.outputs).toBeDefined();
        expect(Array.isArray(stage.outputs)).toBe(true);
      });

      // Verify stage dependencies
      expect(result.data.stages[1].dependsOn).toEqual(['write-test']);
      expect(result.data.stages[2].dependsOn).toEqual(['run-test']);
      expect(result.data.stages[3].dependsOn).toEqual(['implement']);
      expect(result.data.stages[4].dependsOn).toEqual(['verify']);

      // Verify agent assignments
      expect(result.data.stages[0].agent).toBe('tdd-tester'); // write-test
      expect(result.data.stages[1].agent).toBe('tdd-tester'); // run-test
      expect(result.data.stages[2].agent).toBe('tdd-developer'); // implement
      expect(result.data.stages[3].agent).toBe('tdd-tester'); // verify
      expect(result.data.stages[4].agent).toBe('tdd-tester'); // regression-check

      // Verify outputs for each stage
      expect(result.data.stages[0].outputs).toEqual([
        'test_files',
        'test_requirements',
        'baseline_coverage'
      ]);
      expect(result.data.stages[2].outputs).toEqual([
        'code_changes',
        'implementation_notes',
        'branch_name'
      ]);
    }
  });

  it('should have proper trigger configuration', () => {
    const tddWorkflowPath = path.join(__dirname, '../../templates/workflows/tdd.yaml');
    const content = fs.readFileSync(tddWorkflowPath, 'utf8');
    const workflow = yaml.parse(content);

    const result = WorkflowDefinitionSchema.safeParse(workflow);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.trigger).toEqual([
        'manual',
        'apex:tdd',
        'apex:test-driven'
      ]);
    }
  });

  it('should follow Red-Green-Refactor TDD cycle', () => {
    const tddWorkflowPath = path.join(__dirname, '../../templates/workflows/tdd.yaml');
    const content = fs.readFileSync(tddWorkflowPath, 'utf8');
    const workflow = yaml.parse(content);

    const result = WorkflowDefinitionSchema.safeParse(workflow);

    expect(result.success).toBe(true);
    if (result.success) {
      const stages = result.data.stages;

      // Red phase - write failing tests
      expect(stages[0].description).toContain('Write failing test cases (Red phase)');
      expect(stages[1].description).toContain('Run tests to confirm they fail (Red validation)');

      // Green phase - make tests pass
      expect(stages[2].description).toContain('Write minimal code to make tests pass (Green phase)');
      expect(stages[3].description).toContain('Run all tests to confirm implementation works (Green validation)');

      // Refactor phase - improve code quality
      expect(stages[4].description).toContain('Run full test suite and perform refactoring if needed (Refactor phase)');
    }
  });
});