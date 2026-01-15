/**
 * Unit tests for TDD workflow functionality
 *
 * Tests the TDD workflow definition, agent parsing, and stage dependencies
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadWorkflows, loadAgents } from '@apexcli/core';

describe('TDD Workflow Unit Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tdd-workflow-test-'));

    // Create .apex directory structure
    const apexDir = path.join(testDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
    await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });
    await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('TDD Workflow Definition', () => {
    it('should parse tdd.yaml workflow correctly', async () => {
      const workflowContent = `name: tdd
description: Test-Driven Development workflow following Red-Green-Refactor cycle
trigger:
  - manual
  - apex:tdd
  - apex:test-driven

stages:
  - name: write-test
    agent: tdd-tester
    description: Write failing test cases (Red phase)
    outputs:
      - test_files
      - test_requirements
      - baseline_coverage

  - name: run-test
    agent: tdd-tester
    description: Run tests to confirm they fail (Red validation)
    dependsOn: [write-test]
    outputs:
      - test_results
      - failure_confirmation
      - test_report

  - name: implement
    agent: tdd-developer
    description: Write minimal code to make tests pass (Green phase)
    dependsOn: [run-test]
    outputs:
      - code_changes
      - implementation_notes
      - branch_name

  - name: verify
    agent: tdd-tester
    description: Run all tests to confirm implementation works (Green validation)
    dependsOn: [implement]
    outputs:
      - test_results
      - coverage_report
      - success_confirmation

  - name: regression-check
    agent: tdd-tester
    description: Run full test suite and perform refactoring if needed (Refactor phase)
    dependsOn: [verify]
    outputs:
      - regression_results
      - refactor_suggestions
      - final_coverage_report`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow).toBeDefined();
      expect(tddWorkflow.name).toBe('tdd');
      expect(tddWorkflow.description).toBe('Test-Driven Development workflow following Red-Green-Refactor cycle');
      expect(tddWorkflow.stages).toHaveLength(5);
    });

    it('should have correct stage dependencies', async () => {
      const workflowContent = `name: tdd
description: Test-Driven Development workflow
stages:
  - name: write-test
    agent: tdd-tester
    description: Write failing test cases
    outputs: [test_files]
  - name: run-test
    agent: tdd-tester
    description: Run tests to confirm they fail
    dependsOn: [write-test]
    outputs: [test_results]
  - name: implement
    agent: tdd-developer
    description: Write minimal code to make tests pass
    dependsOn: [run-test]
    outputs: [code_changes]
  - name: verify
    agent: tdd-tester
    description: Run all tests to confirm implementation works
    dependsOn: [implement]
    outputs: [test_results]
  - name: regression-check
    agent: tdd-tester
    description: Run full test suite and refactor if needed
    dependsOn: [verify]
    outputs: [regression_results]`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // Check stage dependencies
      expect(tddWorkflow.stages[0].dependsOn).toBeUndefined(); // write-test has no dependencies
      expect(tddWorkflow.stages[1].dependsOn).toEqual(['write-test']);
      expect(tddWorkflow.stages[2].dependsOn).toEqual(['run-test']);
      expect(tddWorkflow.stages[3].dependsOn).toEqual(['implement']);
      expect(tddWorkflow.stages[4].dependsOn).toEqual(['verify']);
    });

    it('should have correct agent assignments per stage', async () => {
      const workflowContent = `name: tdd
description: TDD workflow
stages:
  - name: write-test
    agent: tdd-tester
    description: Write test
  - name: run-test
    agent: tdd-tester
    description: Run test
  - name: implement
    agent: tdd-developer
    description: Implement
  - name: verify
    agent: tdd-tester
    description: Verify
  - name: regression-check
    agent: tdd-tester
    description: Check regression`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow.stages[0].agent).toBe('tdd-tester');  // write-test
      expect(tddWorkflow.stages[1].agent).toBe('tdd-tester');  // run-test
      expect(tddWorkflow.stages[2].agent).toBe('tdd-developer'); // implement
      expect(tddWorkflow.stages[3].agent).toBe('tdd-tester');  // verify
      expect(tddWorkflow.stages[4].agent).toBe('tdd-tester');  // regression-check
    });

    it('should have correct outputs for each stage', async () => {
      const workflowContent = `name: tdd
description: TDD workflow
stages:
  - name: write-test
    agent: tdd-tester
    description: Write test
    outputs:
      - test_files
      - test_requirements
      - baseline_coverage
  - name: implement
    agent: tdd-developer
    description: Implement
    outputs:
      - code_changes
      - implementation_notes
      - branch_name`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow.stages[0].outputs).toEqual(['test_files', 'test_requirements', 'baseline_coverage']);
      expect(tddWorkflow.stages[1].outputs).toEqual(['code_changes', 'implementation_notes', 'branch_name']);
    });

    it('should support TDD trigger patterns', async () => {
      const workflowContent = `name: tdd
description: TDD workflow
trigger:
  - manual
  - apex:tdd
  - apex:test-driven
stages:
  - name: test
    agent: tdd-tester
    description: Test`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow.trigger).toContain('manual');
      expect(tddWorkflow.trigger).toContain('apex:tdd');
      expect(tddWorkflow.trigger).toContain('apex:test-driven');
    });
  });

  describe('TDD Workflow Stage Validation', () => {
    it('should validate Red-Green-Refactor cycle sequence', async () => {
      const workflowContent = `name: tdd
description: TDD workflow
stages:
  - name: write-test
    agent: tdd-tester
    description: Red phase - write failing tests
    outputs: [test_files]
  - name: run-test
    agent: tdd-tester
    description: Red validation - confirm tests fail
    dependsOn: [write-test]
    outputs: [failure_confirmation]
  - name: implement
    agent: tdd-developer
    description: Green phase - make tests pass
    dependsOn: [run-test]
    outputs: [code_changes]
  - name: verify
    agent: tdd-tester
    description: Green validation - confirm tests pass
    dependsOn: [implement]
    outputs: [success_confirmation]
  - name: regression-check
    agent: tdd-tester
    description: Refactor phase - clean up and check
    dependsOn: [verify]
    outputs: [final_results]`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // Validate the Red-Green-Refactor sequence
      const stageNames = tddWorkflow.stages.map(s => s.name);
      expect(stageNames).toEqual(['write-test', 'run-test', 'implement', 'verify', 'regression-check']);

      // Validate Red phase stages (test writing and failure confirmation)
      expect(tddWorkflow.stages[0].description).toContain('Red phase');
      expect(tddWorkflow.stages[1].description).toContain('Red validation');

      // Validate Green phase stages (implementation and verification)
      expect(tddWorkflow.stages[2].description).toContain('Green phase');
      expect(tddWorkflow.stages[3].description).toContain('Green validation');

      // Validate Refactor phase
      expect(tddWorkflow.stages[4].description).toContain('Refactor phase');
    });

    it('should require specific outputs for TDD stages', async () => {
      const workflowContent = `name: tdd
description: TDD workflow
stages:
  - name: write-test
    agent: tdd-tester
    description: Write tests
    outputs:
      - test_files
      - test_requirements
  - name: verify
    agent: tdd-tester
    description: Verify implementation
    outputs:
      - test_results
      - coverage_report`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // Verify test writing stage outputs
      const writeTestOutputs = tddWorkflow.stages.find(s => s.name === 'write-test')?.outputs || [];
      expect(writeTestOutputs).toContain('test_files');
      expect(writeTestOutputs).toContain('test_requirements');

      // Verify verification stage outputs
      const verifyOutputs = tddWorkflow.stages.find(s => s.name === 'verify')?.outputs || [];
      expect(verifyOutputs).toContain('test_results');
      expect(verifyOutputs).toContain('coverage_report');
    });
  });

  describe('TDD Workflow Error Cases', () => {
    it('should handle missing dependsOn gracefully', async () => {
      const workflowContent = `name: tdd
description: TDD workflow
stages:
  - name: write-test
    agent: tdd-tester
    description: Write test
  - name: implement
    agent: tdd-developer
    description: Implement
    dependsOn: [nonexistent-stage]`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        workflowContent
      );

      // Should load without throwing, but maintain the dependency reference
      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow.stages[1].dependsOn).toEqual(['nonexistent-stage']);
    });

    it('should handle empty outputs array', async () => {
      const workflowContent = `name: tdd
description: TDD workflow
stages:
  - name: write-test
    agent: tdd-tester
    description: Write test
    outputs: []`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow.stages[0].outputs).toEqual([]);
    });

    it('should handle missing outputs field', async () => {
      const workflowContent = `name: tdd
description: TDD workflow
stages:
  - name: write-test
    agent: tdd-tester
    description: Write test`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow.stages[0].outputs).toBeUndefined();
    });
  });
});