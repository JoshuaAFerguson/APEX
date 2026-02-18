/**
 * Integration tests for TDD workflow functionality
 *
 * Tests the complete TDD workflow with agents, dependencies, and orchestrator integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { initializeApex, loadWorkflows, loadAgents } from '@apexcli/core';
import { ApexOrchestrator, TaskStore } from '@apexcli/orchestrator';

describe('TDD Workflow Integration Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tdd-integration-'));
    await initializeApex(testDir, { projectName: 'tdd-test-project' });

    // Create TDD workflow
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

    // Create TDD tester agent
    const testerContent = `---
name: tdd-tester
description: Test-Driven Development specialist focused on writing failing tests first
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

You are a TDD specialist focused on test-first development. Your approach follows the Red-Green-Refactor cycle.

## Red Phase (write-test, run-test stages)
When writing tests first:

1. **Understand requirements** - Parse the feature/function requirements thoroughly
2. **Design test cases** - Think about expected behavior, edge cases, and error conditions
3. **Write failing tests** - Create tests that describe the desired behavior
4. **Verify tests fail** - Ensure tests fail for the right reason (not syntax errors)
5. **Write minimal test code** - Start simple, add complexity incrementally

## Green Validation (verify stage)
When validating implementations:

1. **Run tests** - Execute the test suite to confirm they now pass
2. **Verify behavior** - Ensure tests pass for the right reasons
3. **Check coverage** - Confirm the implementation covers the test scenarios
4. **Document gaps** - Identify any missing test cases or edge cases

## Regression Safety (regression-check stage)
When checking for regressions:

1. **Full test suite** - Run complete test suite including existing tests
2. **Integration tests** - Verify new code works with existing functionality
3. **Performance checks** - Ensure no significant performance regressions
4. **Error handling** - Validate error paths and edge cases still work

## Test Quality Guidelines
- Use descriptive test names that explain the scenario being tested
- Follow AAA pattern: Arrange, Act, Assert
- Test behavior, not implementation details
- Include both happy path and error scenarios
- Write tests that are fast, isolated, and deterministic`;

    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
      testerContent
    );

    // Create TDD developer agent
    const developerContent = `---
name: tdd-developer
description: TDD-focused developer who writes minimal code to make tests pass
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
model: sonnet
---

You are a TDD-focused developer who follows the Green phase of Red-Green-Refactor. Your goal is to write the simplest code that makes failing tests pass.

## Green Phase Implementation Strategy
When implementing code to make tests pass:

1. **Analyze failing tests** - Understand exactly what behavior the tests expect
2. **Start with simplest solution** - Write the minimal code to make tests pass
3. **Avoid over-engineering** - Don't add functionality not required by tests
4. **Follow test-driven design** - Let test expectations guide your implementation
5. **Incremental progress** - Make one test pass at a time

## TDD Implementation Principles

### Minimal Implementation
- Write only the code needed to make the current test pass
- Avoid adding "might need later" functionality
- Resist the urge to implement beyond test requirements
- Use the simplest approach that works

### Test-Driven Design
- Let tests define your API and interface design
- Use test feedback to improve code structure
- Trust that tests will guide you to good design
- Refactor only when tests are green

## Common TDD Patterns

### Fake It Till You Make It
- Start with hardcoded return values
- Gradually replace with real logic as more tests are added

### Triangulation
- Use multiple test cases to drive toward the general solution
- Let the accumulation of tests reveal the true requirements

### Obvious Implementation
- When the solution is clear, implement it directly
- Still keep it minimal and focused on current test requirements

Remember: Your success is measured by making tests pass with minimal, clean code, not by predicting future requirements.`;

    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'tdd-developer.md'),
      developerContent
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('TDD Workflow Loading and Validation', () => {
    it('should load TDD workflow with all stages and dependencies', async () => {
      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow).toBeDefined();
      expect(tddWorkflow.name).toBe('tdd');
      expect(tddWorkflow.description).toContain('Test-Driven Development');
      expect(tddWorkflow.stages).toHaveLength(5);

      // Verify stage sequence
      const stageNames = tddWorkflow.stages.map(s => s.name);
      expect(stageNames).toEqual(['write-test', 'run-test', 'implement', 'verify', 'regression-check']);

      // Verify dependencies form a pipeline
      expect(tddWorkflow.stages[0].dependsOn).toBeUndefined(); // write-test
      expect(tddWorkflow.stages[1].dependsOn).toEqual(['write-test']); // run-test
      expect(tddWorkflow.stages[2].dependsOn).toEqual(['run-test']); // implement
      expect(tddWorkflow.stages[3].dependsOn).toEqual(['implement']); // verify
      expect(tddWorkflow.stages[4].dependsOn).toEqual(['verify']); // regression-check
    });

    it('should load TDD agents with appropriate tools and models', async () => {
      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];
      const tddDeveloper = agents['tdd-developer'];

      expect(tddTester).toBeDefined();
      expect(tddDeveloper).toBeDefined();

      // Verify agent configuration
      expect(tddTester.name).toBe('tdd-tester');
      expect(tddTester.model).toBe('sonnet');
      expect(tddTester.tools).toEqual(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']);

      expect(tddDeveloper.name).toBe('tdd-developer');
      expect(tddDeveloper.model).toBe('sonnet');
      expect(tddDeveloper.tools).toEqual(['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob']);
    });

    it('should validate agent assignments match workflow requirements', async () => {
      const workflows = await loadWorkflows(testDir);
      const agents = await loadAgents(testDir);
      const tddWorkflow = workflows.tdd;

      // Check each stage references an existing agent
      for (const stage of tddWorkflow.stages) {
        expect(agents[stage.agent]).toBeDefined();
      }

      // Verify specific agent assignments
      const writeTestStage = tddWorkflow.stages.find(s => s.name === 'write-test');
      expect(writeTestStage?.agent).toBe('tdd-tester');

      const implementStage = tddWorkflow.stages.find(s => s.name === 'implement');
      expect(implementStage?.agent).toBe('tdd-developer');

      const verifyStage = tddWorkflow.stages.find(s => s.name === 'verify');
      expect(verifyStage?.agent).toBe('tdd-tester');
    });

    it('should have TDD-specific triggers', async () => {
      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      expect(tddWorkflow.trigger).toContain('manual');
      expect(tddWorkflow.trigger).toContain('apex:tdd');
      expect(tddWorkflow.trigger).toContain('apex:test-driven');
    });
  });

  describe('TDD Workflow Task Creation', () => {
    it('should create TDD workflow task successfully', async () => {
      const task = await orchestrator.createTask({
        description: 'Implement user authentication using TDD',
        workflow: 'tdd',
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.workflow).toBe('tdd');
      expect(task.description).toBe('Implement user authentication using TDD');
      expect(task.status).toBe('pending');
    });

    it('should validate workflow exists before creating task', async () => {
      // Try to create task with non-existent workflow
      await expect(orchestrator.createTask({
        description: 'Test task',
        workflow: 'nonexistent-tdd',
      })).rejects.toThrow();
    });

    it('should persist TDD task in store', async () => {
      const task = await orchestrator.createTask({
        description: 'TDD task persistence test',
        workflow: 'tdd',
      });

      // Retrieve task from store
      const retrieved = await orchestrator.getTask(task.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.workflow).toBe('tdd');
      expect(retrieved?.description).toBe('TDD task persistence test');
    });
  });

  describe('TDD Workflow Stage Dependencies', () => {
    it('should enforce proper stage dependency order', async () => {
      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // Build dependency graph
      const stageMap = new Map(tddWorkflow.stages.map(s => [s.name, s]));
      const dependencies: Record<string, string[]> = {};

      tddWorkflow.stages.forEach(stage => {
        dependencies[stage.name] = stage.dependsOn || [];
      });

      // Verify no circular dependencies
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

      for (const stageName of Object.keys(dependencies)) {
        expect(hasCycle(stageName)).toBe(false);
      }
    });

    it('should validate Red-Green-Refactor cycle progression', async () => {
      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      // Extract stage progression
      const stages = tddWorkflow.stages;

      // Red Phase: write-test → run-test
      const writeTestIdx = stages.findIndex(s => s.name === 'write-test');
      const runTestIdx = stages.findIndex(s => s.name === 'run-test');
      expect(writeTestIdx).toBeLessThan(runTestIdx);
      expect(stages[runTestIdx].dependsOn).toContain('write-test');

      // Green Phase: run-test → implement → verify
      const implementIdx = stages.findIndex(s => s.name === 'implement');
      const verifyIdx = stages.findIndex(s => s.name === 'verify');
      expect(runTestIdx).toBeLessThan(implementIdx);
      expect(implementIdx).toBeLessThan(verifyIdx);
      expect(stages[implementIdx].dependsOn).toContain('run-test');
      expect(stages[verifyIdx].dependsOn).toContain('implement');

      // Refactor Phase: verify → regression-check
      const regressionIdx = stages.findIndex(s => s.name === 'regression-check');
      expect(verifyIdx).toBeLessThan(regressionIdx);
      expect(stages[regressionIdx].dependsOn).toContain('verify');
    });

    it('should have appropriate outputs for each TDD phase', async () => {
      const workflows = await loadWorkflows(testDir);
      const tddWorkflow = workflows.tdd;

      const stageOutputs = tddWorkflow.stages.reduce((acc, stage) => {
        acc[stage.name] = stage.outputs || [];
        return acc;
      }, {} as Record<string, string[]>);

      // Red phase outputs
      expect(stageOutputs['write-test']).toContain('test_files');
      expect(stageOutputs['write-test']).toContain('test_requirements');
      expect(stageOutputs['run-test']).toContain('test_results');
      expect(stageOutputs['run-test']).toContain('failure_confirmation');

      // Green phase outputs
      expect(stageOutputs['implement']).toContain('code_changes');
      expect(stageOutputs['implement']).toContain('implementation_notes');
      expect(stageOutputs['verify']).toContain('coverage_report');
      expect(stageOutputs['verify']).toContain('success_confirmation');

      // Refactor phase outputs
      expect(stageOutputs['regression-check']).toContain('regression_results');
      expect(stageOutputs['regression-check']).toContain('final_coverage_report');
    });
  });

  describe('TDD Agent Content and Behavior', () => {
    it('should have TDD-specific guidance in agent prompts', async () => {
      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];
      const tddDeveloper = agents['tdd-developer'];

      // Tester should have Red-Green-Refactor guidance
      expect(tddTester.prompt).toContain('Red-Green-Refactor cycle');
      expect(tddTester.prompt).toContain('Write failing tests');
      expect(tddTester.prompt).toContain('AAA pattern');

      // Developer should have minimal implementation guidance
      expect(tddDeveloper.prompt).toContain('Green phase');
      expect(tddDeveloper.prompt).toContain('simplest code');
      expect(tddDeveloper.prompt).toContain('Minimal Implementation');
    });

    it('should include stage-specific guidance for tester', async () => {
      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];

      expect(tddTester.prompt).toContain('write-test, run-test stages');
      expect(tddTester.prompt).toContain('verify stage');
      expect(tddTester.prompt).toContain('regression-check stage');
    });

    it('should include TDD patterns for developer', async () => {
      const agents = await loadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      expect(tddDeveloper.prompt).toContain('Fake It Till You Make It');
      expect(tddDeveloper.prompt).toContain('Triangulation');
      expect(tddDeveloper.prompt).toContain('Obvious Implementation');
    });

    it('should have complementary tool sets', async () => {
      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];
      const tddDeveloper = agents['tdd-developer'];

      // Both should have core tools
      const commonTools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];
      commonTools.forEach(tool => {
        expect(tddTester.tools).toContain(tool);
        expect(tddDeveloper.tools).toContain(tool);
      });

      // Developer should have additional tools for implementation
      expect(tddDeveloper.tools).toContain('MultiEdit');
    });
  });

  describe('Task Store Integration', () => {
    it('should track TDD task lifecycle through stages', async () => {
      const task = await orchestrator.createTask({
        description: 'TDD lifecycle test',
        workflow: 'tdd',
      });

      expect(task.status).toBe('pending');

      // Update to each status
      await orchestrator.updateTaskStatus(task.id, 'queued');
      let updated = await orchestrator.getTask(task.id);
      expect(updated?.status).toBe('queued');

      await orchestrator.updateTaskStatus(task.id, 'in-progress');
      updated = await orchestrator.getTask(task.id);
      expect(updated?.status).toBe('in-progress');

      await orchestrator.updateTaskStatus(task.id, 'completed');
      updated = await orchestrator.getTask(task.id);
      expect(updated?.status).toBe('completed');
    });

    it('should handle task metadata for TDD workflow', async () => {
      const task = await orchestrator.createTask({
        description: 'TDD metadata test',
        workflow: 'tdd',
      });

      // Update with TDD-specific metadata
      await orchestrator.updateTask(task.id, {
        artifacts: [
          { type: 'test_file', path: '/tests/user.test.ts', stage: 'write-test' },
          { type: 'implementation', path: '/src/user.ts', stage: 'implement' },
          { type: 'coverage_report', path: '/coverage/lcov.info', stage: 'verify' },
        ],
      });

      const updated = await orchestrator.getTask(task.id);
      expect(updated?.artifacts).toHaveLength(3);
      expect(updated?.artifacts?.find(a => a.type === 'test_file')).toBeDefined();
      expect(updated?.artifacts?.find(a => a.type === 'implementation')).toBeDefined();
      expect(updated?.artifacts?.find(a => a.type === 'coverage_report')).toBeDefined();
    });

    it('should emit events for TDD workflow operations', async () => {
      const events: string[] = [];

      orchestrator.on('task:created', () => events.push('created'));
      orchestrator.on('task:updated', () => events.push('updated'));

      const task = await orchestrator.createTask({
        description: 'TDD event test',
        workflow: 'tdd',
      });

      expect(events).toContain('created');

      await orchestrator.updateTaskStatus(task.id, 'in-progress');
      expect(events).toContain('updated');
    });
  });

  describe('TDD Workflow Edge Cases', () => {
    it('should handle empty stage outputs gracefully', async () => {
      // Create workflow with empty outputs
      const workflowContent = `name: tdd-minimal
description: Minimal TDD workflow
stages:
  - name: test
    agent: tdd-tester
    description: Test only
    outputs: []
  - name: code
    agent: tdd-developer
    description: Code only`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd-minimal.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const minimal = workflows['tdd-minimal'];

      expect(minimal.stages[0].outputs).toEqual([]);
      expect(minimal.stages[1].outputs).toBeUndefined();
    });

    it('should handle missing agent references gracefully', async () => {
      const workflowContent = `name: tdd-broken
description: TDD workflow with missing agent
stages:
  - name: test
    agent: missing-agent
    description: Test with missing agent`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd-broken.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const broken = workflows['tdd-broken'];

      expect(broken.stages[0].agent).toBe('missing-agent');
      // Agent validation would happen at task execution time
    });

    it('should validate against circular dependencies', async () => {
      const workflowContent = `name: tdd-circular
description: TDD workflow with circular dependency
stages:
  - name: stage-a
    agent: tdd-tester
    description: Stage A
    dependsOn: [stage-b]
  - name: stage-b
    agent: tdd-tester
    description: Stage B
    dependsOn: [stage-a]`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'tdd-circular.yaml'),
        workflowContent
      );

      const workflows = await loadWorkflows(testDir);
      const circular = workflows['tdd-circular'];

      // Workflow loads but circular dependency would be detected at runtime
      expect(circular.stages).toHaveLength(2);
      expect(circular.stages[0].dependsOn).toEqual(['stage-b']);
      expect(circular.stages[1].dependsOn).toEqual(['stage-a']);
    });
  });
});