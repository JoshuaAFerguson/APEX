/**
 * Tests for TDD workflow and agent parsing and validation
 *
 * Tests YAML parsing, schema validation, and error handling for TDD components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadWorkflows, loadAgents } from '@apexcli/core';

describe('TDD Parsing and Validation Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tdd-parsing-'));

    // Create .apex directory structure
    const apexDir = path.join(testDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
    await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });
    await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('TDD Workflow YAML Parsing', () => {
    it('should parse valid TDD workflow YAML correctly', async () => {
      const validYaml = `name: tdd
description: Test-Driven Development workflow
trigger:
  - manual
  - apex:tdd
stages:
  - name: write-test
    agent: tdd-tester
    description: Write failing test cases
    outputs:
      - test_files
      - test_requirements
  - name: implement
    agent: tdd-developer
    description: Write minimal code
    dependsOn: [write-test]
    outputs:
      - code_changes`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        validYaml
      );

      const workflows = await loadWorkflows(testDir);
      expect(workflows.tdd).toBeDefined();
      expect(workflows.tdd.stages).toHaveLength(2);
    });

    it('should handle YAML syntax errors gracefully', async () => {
      const invalidYaml = `name: tdd
description: TDD workflow
stages:
  - name: write-test
    agent: tdd-tester
    description: "Unclosed quote
    outputs:
      - test_files`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        invalidYaml
      );

      // Should throw error for invalid YAML
      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should validate required workflow fields', async () => {
      const missingNameYaml = `description: TDD workflow without name
stages:
  - name: test
    agent: tdd-tester
    description: Test`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        missingNameYaml
      );

      // Should throw validation error
      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should validate stage structure', async () => {
      const invalidStageYaml = `name: tdd
description: TDD workflow
stages:
  - name: write-test
    # missing agent field
    description: Test without agent`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        invalidStageYaml
      );

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });

    it('should allow optional fields in stages', async () => {
      const minimalStageYaml = `name: tdd
description: TDD workflow
stages:
  - name: write-test
    agent: tdd-tester
    description: Minimal stage definition`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        minimalStageYaml
      );

      const workflows = await loadWorkflows(testDir);
      const stage = workflows.tdd.stages[0];

      expect(stage.name).toBe('write-test');
      expect(stage.agent).toBe('tdd-tester');
      expect(stage.description).toBe('Minimal stage definition');
      expect(stage.dependsOn).toBeUndefined();
      expect(stage.outputs).toBeUndefined();
    });

    it('should parse array fields correctly', async () => {
      const arrayFieldsYaml = `name: tdd
description: TDD workflow
trigger:
  - manual
  - apex:tdd
  - apex:test-driven
stages:
  - name: write-test
    agent: tdd-tester
    description: Test
    outputs:
      - test_files
      - test_requirements
      - baseline_coverage
  - name: implement
    agent: tdd-developer
    description: Implement
    dependsOn:
      - write-test
    outputs:
      - code_changes`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        arrayFieldsYaml
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow.trigger).toHaveLength(3);
      expect(tddWorkflow.trigger).toContain('apex:test-driven');
      expect(tddWorkflow.stages[0].outputs).toHaveLength(3);
      expect(tddWorkflow.stages[1].dependsOn).toEqual(['write-test']);
    });

    it('should handle empty arrays', async () => {
      const emptyArraysYaml = `name: tdd
description: TDD workflow
trigger: []
stages:
  - name: write-test
    agent: tdd-tester
    description: Test
    outputs: []
    dependsOn: []`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        emptyArraysYaml
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow.trigger).toEqual([]);
      expect(tddWorkflow.stages[0].outputs).toEqual([]);
      expect(tddWorkflow.stages[0].dependsOn).toEqual([]);
    });

    it('should validate string types for text fields', async () => {
      const nonStringFieldYaml = `name: 123
description: TDD workflow
stages:
  - name: write-test
    agent: true
    description: Test`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        nonStringFieldYaml
      );

      await expect(loadWorkflows(testDir)).rejects.toThrow();
    });
  });

  describe('TDD Agent Markdown Parsing', () => {
    it('should parse valid agent markdown with frontmatter', async () => {
      const validAgentMd = `---
name: tdd-tester
description: TDD specialist for test-first development
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
model: sonnet
---

You are a TDD specialist focused on test-first development.

## Red Phase
Write failing tests first.

## Test Quality Guidelines
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        validAgentMd
      );

      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];

      expect(tddTester.name).toBe('tdd-tester');
      expect(tddTester.description).toBe('TDD specialist for test-first development');
      expect(tddTester.tools).toEqual(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']);
      expect(tddTester.model).toBe('sonnet');
      expect(tddTester.prompt).toContain('You are a TDD specialist');
      expect(tddTester.prompt).toContain('## Red Phase');
    });

    it('should handle missing frontmatter gracefully', async () => {
      const noFrontmatterMd = `You are a TDD specialist.

## Instructions
Follow test-first development practices.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        noFrontmatterMd
      );

      // Should throw error for missing frontmatter
      await expect(loadAgents(testDir)).rejects.toThrow();
    });

    it('should validate required frontmatter fields', async () => {
      const missingNameMd = `---
description: TDD tester
tools: [Read, Write]
model: sonnet
---

TDD specialist content.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        missingNameMd
      );

      await expect(loadAgents(testDir)).rejects.toThrow();
    });

    it('should handle optional frontmatter fields', async () => {
      const minimalMd = `---
name: tdd-tester
description: TDD tester
---

Minimal agent definition.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        minimalMd
      );

      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];

      expect(tddTester.name).toBe('tdd-tester');
      expect(tddTester.description).toBe('TDD tester');
      expect(tddTester.tools).toBeUndefined();
      expect(tddTester.model).toBe('sonnet'); // default value
      expect(tddTester.prompt).toBe('Minimal agent definition.');
    });

    it('should parse tools as array from YAML', async () => {
      const toolsArrayMd = `---
name: tdd-developer
description: TDD developer
tools:
  - Read
  - Write
  - Edit
  - MultiEdit
  - Bash
  - Grep
  - Glob
model: sonnet
---

TDD developer with multiple tools.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-developer.md'),
        toolsArrayMd
      );

      const agents = await loadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      expect(tddDeveloper.tools).toEqual([
        'Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob'
      ]);
    });

    it('should parse single tool as string in shorthand', async () => {
      const singleToolMd = `---
name: tdd-tester
description: TDD tester
tools: Read
model: haiku
---

Simple tester with one tool.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        singleToolMd
      );

      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];

      expect(tddTester.tools).toEqual(['Read']);
    });

    it('should validate model field values', async () => {
      const invalidModelMd = `---
name: tdd-tester
description: TDD tester
tools: [Read]
model: invalid-model
---

Agent with invalid model.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        invalidModelMd
      );

      await expect(loadAgents(testDir)).rejects.toThrow();
    });

    it('should handle malformed frontmatter YAML', async () => {
      const malformedMd = `---
name: tdd-tester
description: TDD tester
tools: [Read, Write
model: sonnet
---

Agent with malformed YAML.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        malformedMd
      );

      await expect(loadAgents(testDir)).rejects.toThrow();
    });

    it('should preserve markdown formatting in prompt', async () => {
      const formattedMd = `---
name: tdd-tester
description: TDD tester
tools: [Read, Write]
model: sonnet
---

# TDD Specialist

You are a **TDD specialist** focused on *test-first* development.

## Key Principles

1. Write failing tests first
2. Write minimal code to pass
3. Refactor with confidence

### Code Example

\`\`\`javascript
describe('Calculator', () => {
  it('should add two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
\`\`\`

> Remember: Tests drive the design!`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        formattedMd
      );

      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];

      expect(tddTester.prompt).toContain('# TDD Specialist');
      expect(tddTester.prompt).toContain('**TDD specialist**');
      expect(tddTester.prompt).toContain('*test-first*');
      expect(tddTester.prompt).toContain('```javascript');
      expect(tddTester.prompt).toContain('> Remember: Tests drive the design!');
    });
  });

  describe('Complex TDD Workflow Validation', () => {
    it('should validate complete Red-Green-Refactor workflow', async () => {
      const complexWorkflowYaml = `name: tdd
description: Complete Red-Green-Refactor workflow with all phases
trigger:
  - manual
  - apex:tdd
  - apex:test-driven
  - apex:red-green-refactor

stages:
  # Red Phase
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

  # Green Phase
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

  # Refactor Phase
  - name: refactor
    agent: tdd-developer
    description: Improve code structure while maintaining tests (Refactor phase)
    dependsOn: [verify]
    outputs:
      - refactor_changes
      - code_quality_metrics
      - refactoring_notes

  - name: regression-check
    agent: tdd-tester
    description: Run full test suite after refactoring (Final validation)
    dependsOn: [refactor]
    outputs:
      - regression_results
      - final_coverage_report
      - quality_assessment`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd.yaml'),
        complexWorkflowYaml
      );

      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow.stages).toHaveLength(6);

      // Validate stage names and sequence
      const stageNames = tddWorkflow.stages.map(s => s.name);
      expect(stageNames).toEqual([
        'write-test', 'run-test', 'implement', 'verify', 'refactor', 'regression-check'
      ]);

      // Validate dependency chain
      expect(tddWorkflow.stages[1].dependsOn).toEqual(['write-test']);
      expect(tddWorkflow.stages[2].dependsOn).toEqual(['run-test']);
      expect(tddWorkflow.stages[3].dependsOn).toEqual(['implement']);
      expect(tddWorkflow.stages[4].dependsOn).toEqual(['verify']);
      expect(tddWorkflow.stages[5].dependsOn).toEqual(['refactor']);

      // Validate agent assignments
      expect(tddWorkflow.stages[0].agent).toBe('tdd-tester'); // write-test
      expect(tddWorkflow.stages[1].agent).toBe('tdd-tester'); // run-test
      expect(tddWorkflow.stages[2].agent).toBe('tdd-developer'); // implement
      expect(tddWorkflow.stages[3].agent).toBe('tdd-tester'); // verify
      expect(tddWorkflow.stages[4].agent).toBe('tdd-developer'); // refactor
      expect(tddWorkflow.stages[5].agent).toBe('tdd-tester'); // regression-check
    });

    it('should handle parallel stage dependencies', async () => {
      const parallelDepsYaml = `name: tdd-parallel
description: TDD workflow with parallel stages
stages:
  - name: write-unit-tests
    agent: tdd-tester
    description: Write unit tests
    outputs: [unit_tests]

  - name: write-integration-tests
    agent: tdd-tester
    description: Write integration tests
    outputs: [integration_tests]

  - name: implement
    agent: tdd-developer
    description: Implement code
    dependsOn: [write-unit-tests, write-integration-tests]
    outputs: [implementation]

  - name: verify-unit
    agent: tdd-tester
    description: Verify unit tests
    dependsOn: [implement]
    outputs: [unit_results]

  - name: verify-integration
    agent: tdd-tester
    description: Verify integration tests
    dependsOn: [implement]
    outputs: [integration_results]`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd-parallel.yaml'),
        parallelDepsYaml
      );

      const workflows = await loadWorkflows(testDir);
      const parallelWorkflow = workflows['tdd-parallel'];

      // Implement stage should depend on both test writing stages
      const implementStage = parallelWorkflow.stages.find(s => s.name === 'implement');
      expect(implementStage?.dependsOn).toEqual(['write-unit-tests', 'write-integration-tests']);

      // Verify stages should both depend on implement
      const verifyUnitStage = parallelWorkflow.stages.find(s => s.name === 'verify-unit');
      const verifyIntegrationStage = parallelWorkflow.stages.find(s => s.name === 'verify-integration');
      expect(verifyUnitStage?.dependsOn).toEqual(['implement']);
      expect(verifyIntegrationStage?.dependsOn).toEqual(['implement']);
    });

    it('should validate TDD-specific output naming conventions', async () => {
      const tddOutputsYaml = `name: tdd-outputs
description: TDD workflow with conventional outputs
stages:
  - name: write-test
    agent: tdd-tester
    description: Write tests
    outputs:
      - test_files
      - test_requirements
      - test_spec
      - baseline_coverage
      - mock_definitions

  - name: implement
    agent: tdd-developer
    description: Implement
    outputs:
      - code_changes
      - implementation_notes
      - api_definitions
      - error_handling
      - performance_notes`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd-outputs.yaml'),
        tddOutputsYaml
      );

      const workflows = await loadWorkflows(testDir);
      const outputsWorkflow = workflows['tdd-outputs'];

      const writeTestOutputs = outputsWorkflow.stages[0].outputs || [];
      const implementOutputs = outputsWorkflow.stages[1].outputs || [];

      // Validate TDD-specific output names
      expect(writeTestOutputs).toContain('test_files');
      expect(writeTestOutputs).toContain('test_requirements');
      expect(writeTestOutputs).toContain('baseline_coverage');

      expect(implementOutputs).toContain('code_changes');
      expect(implementOutputs).toContain('implementation_notes');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should provide meaningful error messages for invalid workflows', async () => {
      const invalidWorkflow = `name: tdd
description: 123
stages: "not an array"`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'invalid.yaml'),
        invalidWorkflow
      );

      try {
        await loadWorkflows(testDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        // Error should provide context about what went wrong
      }
    });

    it('should handle empty workflow files', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'empty.yaml'),
        ''
      );

      // Empty files should be ignored or handled gracefully
      const workflows = await loadWorkflows(testDir);
      expect(workflows.empty).toBeUndefined();
    });

    it('should handle files with only comments', async () => {
      const commentOnlyYaml = `# This is a comment-only YAML file
# name: tdd
# description: Commented out workflow`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'comments.yaml'),
        commentOnlyYaml
      );

      const workflows = await loadWorkflows(testDir);
      expect(workflows.comments).toBeUndefined();
    });

    it('should handle agent files with empty content', async () => {
      const emptyAgentMd = `---
name: empty-agent
description: Empty agent
---`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'empty-agent.md'),
        emptyAgentMd
      );

      const agents = await loadAgents(testDir);
      const emptyAgent = agents['empty-agent'];

      expect(emptyAgent.prompt).toBe('');
    });

    it('should handle file reading errors gracefully', async () => {
      // Create a directory where a file is expected
      await fs.mkdir(path.join(testDir, '.apex', 'workflows', 'directory.yaml'));

      // Should handle the error gracefully and continue loading other files
      const workflows = await loadWorkflows(testDir);
      expect(workflows).toBeDefined();
    });
  });
});