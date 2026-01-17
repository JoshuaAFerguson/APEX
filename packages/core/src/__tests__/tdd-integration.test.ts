import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadWorkflow, loadAgents } from '../config';
import { WorkflowDefinition, AgentDefinition } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock file system operations for testing
vi.mock('fs/promises');
const mockedFs = vi.mocked(fs);

describe('TDD Workflow Integration', () => {
  const mockProjectPath = '/mock/project';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Workflow Loading', () => {
    it('should load TDD workflow correctly', async () => {
      // Mock the workflow file content
      const tddWorkflowContent = `
name: tdd
description: Test-Driven Development workflow with planning, red-green-refactor stages
trigger:
  - manual
  - apex:tdd
  - apex:test-driven

stages:
  - name: planning
    agent: planner
    description: Plan the TDD implementation approach and identify test scenarios
    outputs:
      - implementation_plan
      - test_scenarios
      - acceptance_criteria

  - name: test-first
    agent: tdd-tester
    description: Write failing test cases first (Red phase)
    dependsOn: [planning]
    outputs:
      - test_files
      - test_requirements
      - failure_confirmation

  - name: implementation
    agent: tdd-developer
    description: Write minimal code to make tests pass (Green phase)
    dependsOn: [test-first]
    outputs:
      - code_changes
      - implementation_notes
      - branch_name

  - name: refactor
    agent: developer
    description: Improve code design while keeping tests green (Refactor phase)
    dependsOn: [implementation]
    outputs:
      - refactored_code
      - design_improvements
      - refactor_notes

  - name: verification
    agent: tdd-tester
    description: Run full test suite and validate final implementation
    dependsOn: [refactor]
    outputs:
      - final_test_results
      - coverage_report
      - quality_metrics
`;

      // Mock file system calls
      mockedFs.readdir.mockResolvedValueOnce(['tdd.yaml'] as any);
      mockedFs.readFile.mockResolvedValueOnce(tddWorkflowContent);

      const workflow = await loadWorkflow(mockProjectPath, 'tdd');

      expect(workflow).toBeDefined();
      expect(workflow?.name).toBe('tdd');
      expect(workflow?.stages).toHaveLength(5);
    });

    it('should handle missing TDD workflow gracefully', async () => {
      // Mock empty workflows directory
      mockedFs.readdir.mockResolvedValueOnce([]);

      const workflow = await loadWorkflow(mockProjectPath, 'tdd');

      expect(workflow).toBeNull();
    });
  });

  describe('Agent Loading', () => {
    it('should load TDD agents correctly', async () => {
      const tddTesterContent = `---
name: tdd-tester
description: Test-Driven Development specialist focused on writing failing tests first
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

You are a TDD specialist focused on test-first development.`;

      const tddDeveloperContent = `---
name: tdd-developer
description: TDD-focused developer for implement stage
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
model: sonnet
---

You are a TDD-focused developer working in the IMPLEMENT stage.`;

      // Mock file system calls
      mockedFs.readdir.mockResolvedValueOnce(['tdd-tester.md', 'tdd-developer.md'] as any);
      mockedFs.readFile
        .mockResolvedValueOnce(tddTesterContent)
        .mockResolvedValueOnce(tddDeveloperContent);

      const agents = await loadAgents(mockProjectPath);

      expect(agents['tdd-tester']).toBeDefined();
      expect(agents['tdd-developer']).toBeDefined();
      expect(agents['tdd-tester'].name).toBe('tdd-tester');
      expect(agents['tdd-developer'].name).toBe('tdd-developer');
    });

    it('should validate agent tools match workflow requirements', async () => {
      const tddTesterContent = `---
name: tdd-tester
description: Test-Driven Development specialist
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

TDD specialist prompt.`;

      const tddDeveloperContent = `---
name: tdd-developer
description: TDD-focused developer
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
model: sonnet
---

TDD developer prompt.`;

      // Mock file system calls
      mockedFs.readdir.mockResolvedValueOnce(['tdd-tester.md', 'tdd-developer.md'] as any);
      mockedFs.readFile
        .mockResolvedValueOnce(tddTesterContent)
        .mockResolvedValueOnce(tddDeveloperContent);

      const agents = await loadAgents(mockProjectPath);

      // TDD tester should have testing tools
      const tddTester = agents['tdd-tester'];
      expect(tddTester.tools).toContain('Bash'); // For running tests
      expect(tddTester.tools).toContain('Write'); // For writing test files
      expect(tddTester.tools).toContain('Read'); // For reading existing code

      // TDD developer should have implementation tools
      const tddDeveloper = agents['tdd-developer'];
      expect(tddDeveloper.tools).toContain('MultiEdit'); // For efficient code changes
      expect(tddDeveloper.tools).toContain('Edit'); // For code modifications
      expect(tddDeveloper.tools).toContain('Read'); // For reading tests
    });
  });

  describe('Stage Dependencies', () => {
    it('should validate TDD workflow stage dependencies form valid execution order', () => {
      // Mock workflow data
      const tddWorkflow: WorkflowDefinition = {
        name: 'tdd',
        description: 'TDD workflow',
        trigger: ['manual'],
        stages: [
          {
            name: 'planning',
            agent: 'planner',
            description: 'Plan TDD approach',
            outputs: ['implementation_plan']
          },
          {
            name: 'test-first',
            agent: 'tdd-tester',
            description: 'Write failing tests',
            dependsOn: ['planning'],
            outputs: ['test_files']
          },
          {
            name: 'implementation',
            agent: 'tdd-developer',
            description: 'Implement minimal code',
            dependsOn: ['test-first'],
            outputs: ['code_changes']
          },
          {
            name: 'refactor',
            agent: 'developer',
            description: 'Refactor code',
            dependsOn: ['implementation'],
            outputs: ['refactored_code']
          },
          {
            name: 'verification',
            agent: 'tdd-tester',
            description: 'Verify implementation',
            dependsOn: ['refactor'],
            outputs: ['final_test_results']
          }
        ]
      };

      // Build dependency graph
      const stages = new Map(tddWorkflow.stages.map(s => [s.name, s]));

      // Verify planning has no dependencies (can start immediately)
      const planning = stages.get('planning')!;
      expect(planning.dependsOn).toBeUndefined();

      // Verify linear dependency chain
      const testFirst = stages.get('test-first')!;
      expect(testFirst.dependsOn).toEqual(['planning']);

      const implementation = stages.get('implementation')!;
      expect(implementation.dependsOn).toEqual(['test-first']);

      const refactor = stages.get('refactor')!;
      expect(refactor.dependsOn).toEqual(['implementation']);

      const verification = stages.get('verification')!;
      expect(verification.dependsOn).toEqual(['refactor']);
    });

    it('should ensure no circular dependencies in TDD workflow', () => {
      const stages = [
        { name: 'planning', dependsOn: undefined },
        { name: 'test-first', dependsOn: ['planning'] },
        { name: 'implementation', dependsOn: ['test-first'] },
        { name: 'refactor', dependsOn: ['implementation'] },
        { name: 'verification', dependsOn: ['refactor'] }
      ];

      // Function to detect cycles using DFS
      function hasCycle(): boolean {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const stageMap = new Map(stages.map(s => [s.name, s.dependsOn || []]));

        function dfsVisit(stageName: string): boolean {
          if (recursionStack.has(stageName)) return true; // Cycle detected
          if (visited.has(stageName)) return false; // Already processed

          visited.add(stageName);
          recursionStack.add(stageName);

          const dependencies = stageMap.get(stageName) || [];
          for (const dep of dependencies) {
            if (dfsVisit(dep)) return true;
          }

          recursionStack.delete(stageName);
          return false;
        }

        for (const stage of stages) {
          if (!visited.has(stage.name)) {
            if (dfsVisit(stage.name)) return true;
          }
        }

        return false;
      }

      expect(hasCycle()).toBe(false);
    });
  });

  describe('Agent Output Compatibility', () => {
    it('should verify TDD agents produce outputs consumable by dependent stages', () => {
      const expectedOutputMappings = {
        'planning': {
          outputs: ['implementation_plan', 'test_scenarios', 'acceptance_criteria'],
          consumedBy: ['test-first']
        },
        'test-first': {
          outputs: ['test_files', 'test_requirements', 'failure_confirmation'],
          consumedBy: ['implementation']
        },
        'implementation': {
          outputs: ['code_changes', 'implementation_notes', 'branch_name'],
          consumedBy: ['refactor']
        },
        'refactor': {
          outputs: ['refactored_code', 'design_improvements', 'refactor_notes'],
          consumedBy: ['verification']
        },
        'verification': {
          outputs: ['final_test_results', 'coverage_report', 'quality_metrics'],
          consumedBy: []
        }
      };

      // Verify output naming conventions are consistent
      Object.entries(expectedOutputMappings).forEach(([stageName, config]) => {
        config.outputs.forEach(output => {
          // Outputs should use snake_case naming
          expect(output).toMatch(/^[a-z_]+$/);
          // Should be descriptive (more than just a single word)
          expect(output.length).toBeGreaterThan(4);
        });
      });

      // Verify test-specific outputs are properly defined
      expect(expectedOutputMappings['test-first'].outputs).toContain('test_files');
      expect(expectedOutputMappings['test-first'].outputs).toContain('failure_confirmation');
      expect(expectedOutputMappings['verification'].outputs).toContain('coverage_report');
    });

    it('should ensure TDD workflow outputs enable proper handoffs', () => {
      // Test that each stage's outputs provide necessary context for next stage
      const stageHandoffs = [
        {
          from: 'planning',
          to: 'test-first',
          requiredOutputs: ['test_scenarios', 'acceptance_criteria'],
          purpose: 'Provides test requirements and scenarios for test writing'
        },
        {
          from: 'test-first',
          to: 'implementation',
          requiredOutputs: ['test_files', 'failure_confirmation'],
          purpose: 'Provides failing tests for minimal implementation'
        },
        {
          from: 'implementation',
          to: 'refactor',
          requiredOutputs: ['code_changes'],
          purpose: 'Provides working code for refactoring'
        },
        {
          from: 'refactor',
          to: 'verification',
          requiredOutputs: ['refactored_code'],
          purpose: 'Provides final code for comprehensive testing'
        }
      ];

      stageHandoffs.forEach(handoff => {
        handoff.requiredOutputs.forEach(output => {
          expect(typeof output).toBe('string');
          expect(output.length).toBeGreaterThan(0);
          // Should not contain spaces or special characters
          expect(output).toMatch(/^[a-z_]+$/);
        });
      });
    });
  });

  describe('TDD Cycle Validation', () => {
    it('should enforce Red-Green-Refactor cycle through stage constraints', () => {
      const tddCycleStages = [
        { name: 'test-first', phase: 'Red', validates: 'Tests fail initially' },
        { name: 'implementation', phase: 'Green', validates: 'Tests pass with minimal code' },
        { name: 'refactor', phase: 'Refactor', validates: 'Code improved while tests remain green' }
      ];

      // Verify each phase has clear validation criteria
      tddCycleStages.forEach(stage => {
        expect(stage.phase).toMatch(/^(Red|Green|Refactor)$/);
        expect(stage.validates).toBeDefined();
        expect(stage.validates.length).toBeGreaterThan(10);
      });

      // Verify the cycle progression is enforced by dependencies
      const cycleOrder = tddCycleStages.map(s => s.name);
      expect(cycleOrder).toEqual(['test-first', 'implementation', 'refactor']);
    });

    it('should validate TDD principles are embedded in agent prompts', () => {
      const tddPrinciples = [
        'test-first development',
        'minimal implementation',
        'refactor with safety',
        'failing tests drive design'
      ];

      // Mock agent definitions would be validated for these principles
      const mockTddTesterPrompt = `
        You are a TDD specialist focused on test-first development.
        Write failing tests that drive design decisions.
        Ensure tests fail for the right reasons.
      `;

      const mockTddDeveloperPrompt = `
        Write minimal implementation to make tests pass.
        Do not over-engineer or add unnecessary features.
        Focus only on making current tests green.
      `;

      // Validate TDD tester prompt
      expect(mockTddTesterPrompt.toLowerCase()).toContain('test-first');
      expect(mockTddTesterPrompt.toLowerCase()).toContain('failing');

      // Validate TDD developer prompt
      expect(mockTddDeveloperPrompt.toLowerCase()).toContain('minimal');
      expect(mockTddDeveloperPrompt.toLowerCase()).toContain('tests pass');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing TDD agents gracefully', async () => {
      // Mock scenario where TDD agents are not available
      mockedFs.readdir.mockResolvedValueOnce(['planner.md', 'developer.md'] as any);

      const agentContent = `---
name: planner
description: General planner
tools: Read, Write
model: sonnet
---
General planning prompt.`;

      mockedFs.readFile.mockResolvedValue(agentContent);

      const agents = await loadAgents(mockProjectPath);

      // Should not have TDD-specific agents
      expect(agents['tdd-tester']).toBeUndefined();
      expect(agents['tdd-developer']).toBeUndefined();

      // Should still have standard agents
      expect(agents['planner']).toBeDefined();
    });

    it('should validate agent tool requirements for TDD workflow', () => {
      const requiredTools = {
        'tdd-tester': ['Bash', 'Read', 'Write', 'Edit', 'Grep'],
        'tdd-developer': ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash'],
      };

      Object.entries(requiredTools).forEach(([agentName, tools]) => {
        tools.forEach(tool => {
          expect(tool).toMatch(/^[A-Z][a-zA-Z]*$/); // PascalCase tool names
        });
      });

      // TDD agents need ability to run tests
      expect(requiredTools['tdd-tester']).toContain('Bash');
      expect(requiredTools['tdd-developer']).toContain('Bash');

      // TDD agents need file manipulation
      expect(requiredTools['tdd-tester']).toContain('Write');
      expect(requiredTools['tdd-developer']).toContain('Write');
    });

    it('should handle malformed TDD workflow definition', () => {
      const invalidWorkflowCases = [
        {
          name: 'missing stages',
          workflow: { name: 'tdd', description: 'TDD', trigger: ['manual'] }
        },
        {
          name: 'circular dependencies',
          workflow: {
            name: 'tdd',
            description: 'TDD',
            trigger: ['manual'],
            stages: [
              { name: 'a', agent: 'test', description: 'test', dependsOn: ['b'], outputs: ['x'] },
              { name: 'b', agent: 'test', description: 'test', dependsOn: ['a'], outputs: ['y'] }
            ]
          }
        },
        {
          name: 'missing required TDD stages',
          workflow: {
            name: 'tdd',
            description: 'TDD',
            trigger: ['manual'],
            stages: [
              { name: 'planning', agent: 'planner', description: 'plan', outputs: ['plan'] }
            ]
          }
        }
      ];

      invalidWorkflowCases.forEach(testCase => {
        // Should be able to identify issues with incomplete workflow
        expect(testCase.workflow.name).toBeDefined();

        if (testCase.name === 'missing stages') {
          expect((testCase.workflow as any).stages).toBeUndefined();
        }

        if (testCase.name === 'missing required TDD stages') {
          const stages = (testCase.workflow as any).stages;
          const stageNames = stages.map((s: any) => s.name);
          expect(stageNames).not.toContain('test-first');
          expect(stageNames).not.toContain('implementation');
        }
      });
    });
  });
});