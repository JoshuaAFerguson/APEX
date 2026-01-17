import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { WorkflowDefinitionSchema, AgentDefinitionSchema } from '../types';
import { parseAgentMarkdown } from '../config';

describe('TDD Workflow Template', () => {
  const templatePath = path.join(__dirname, '../../templates/workflows/tdd.yaml');
  const agentsPath = path.join(__dirname, '../../templates/agents');
  let tddWorkflow: any;
  let tddTesterAgent: any;
  let tddDeveloperAgent: any;

  beforeEach(async () => {
    // Load TDD workflow template
    const workflowContent = await fs.readFile(templatePath, 'utf-8');
    tddWorkflow = yaml.parse(workflowContent);

    // Load TDD agents
    const tddTesterContent = await fs.readFile(path.join(agentsPath, 'tdd-tester.md'), 'utf-8');
    tddTesterAgent = parseAgentMarkdown(tddTesterContent);

    const tddDeveloperContent = await fs.readFile(path.join(agentsPath, 'tdd-developer.md'), 'utf-8');
    tddDeveloperAgent = parseAgentMarkdown(tddDeveloperContent);
  });

  describe('Workflow Structure', () => {
    it('should have valid YAML structure', () => {
      expect(tddWorkflow).toBeDefined();
      expect(typeof tddWorkflow).toBe('object');
    });

    it('should pass WorkflowDefinitionSchema validation', () => {
      const result = WorkflowDefinitionSchema.safeParse(tddWorkflow);
      if (!result.success) {
        console.log('Validation errors:', result.error.issues);
      }
      expect(result.success).toBe(true);
    });

    it('should have correct basic properties', () => {
      expect(tddWorkflow.name).toBe('tdd');
      expect(tddWorkflow.description).toContain('Test-Driven Development');
      expect(tddWorkflow.description).toContain('red-green-refactor');
    });

    it('should have correct trigger configuration', () => {
      expect(tddWorkflow.trigger).toEqual([
        'manual',
        'apex:tdd',
        'apex:test-driven'
      ]);
    });
  });

  describe('Stages Configuration', () => {
    it('should have exactly 5 stages matching TDD workflow', () => {
      expect(tddWorkflow.stages).toHaveLength(5);

      const stageNames = tddWorkflow.stages.map((stage: any) => stage.name);
      expect(stageNames).toEqual([
        'planning',
        'test-first',
        'implementation',
        'refactor',
        'verification'
      ]);
    });

    it('should have correct stage dependencies for TDD cycle', () => {
      const stages = tddWorkflow.stages;

      // Planning stage should have no dependencies
      const planningStage = stages.find((s: any) => s.name === 'planning');
      expect(planningStage.dependsOn).toBeUndefined();

      // Test-first stage should depend on planning
      const testFirstStage = stages.find((s: any) => s.name === 'test-first');
      expect(testFirstStage.dependsOn).toEqual(['planning']);

      // Implementation stage should depend on test-first
      const implementationStage = stages.find((s: any) => s.name === 'implementation');
      expect(implementationStage.dependsOn).toEqual(['test-first']);

      // Refactor stage should depend on implementation
      const refactorStage = stages.find((s: any) => s.name === 'refactor');
      expect(refactorStage.dependsOn).toEqual(['implementation']);

      // Verification stage should depend on refactor
      const verificationStage = stages.find((s: any) => s.name === 'verification');
      expect(verificationStage.dependsOn).toEqual(['refactor']);
    });

    it('should use correct agents for each stage', () => {
      const stages = tddWorkflow.stages;

      expect(stages.find((s: any) => s.name === 'planning').agent).toBe('planner');
      expect(stages.find((s: any) => s.name === 'test-first').agent).toBe('tdd-tester');
      expect(stages.find((s: any) => s.name === 'implementation').agent).toBe('tdd-developer');
      expect(stages.find((s: any) => s.name === 'refactor').agent).toBe('developer');
      expect(stages.find((s: any) => s.name === 'verification').agent).toBe('tdd-tester');
    });

    it('should have appropriate descriptions for each stage', () => {
      const stages = tddWorkflow.stages;

      expect(stages.find((s: any) => s.name === 'planning').description)
        .toContain('Plan the TDD implementation approach');

      expect(stages.find((s: any) => s.name === 'test-first').description)
        .toContain('Write failing test cases first');

      expect(stages.find((s: any) => s.name === 'implementation').description)
        .toContain('Write minimal code to make tests pass');

      expect(stages.find((s: any) => s.name === 'refactor').description)
        .toContain('Improve code design while keeping tests green');

      expect(stages.find((s: any) => s.name === 'verification').description)
        .toContain('Run full test suite and validate final implementation');
    });
  });

  describe('Stage Outputs', () => {
    it('should define correct outputs for planning stage', () => {
      const planningStage = tddWorkflow.stages.find((s: any) => s.name === 'planning');
      expect(planningStage.outputs).toEqual([
        'implementation_plan',
        'test_scenarios',
        'acceptance_criteria'
      ]);
    });

    it('should define correct outputs for test-first stage', () => {
      const testFirstStage = tddWorkflow.stages.find((s: any) => s.name === 'test-first');
      expect(testFirstStage.outputs).toEqual([
        'test_files',
        'test_requirements',
        'failure_confirmation'
      ]);
    });

    it('should define correct outputs for implementation stage', () => {
      const implementationStage = tddWorkflow.stages.find((s: any) => s.name === 'implementation');
      expect(implementationStage.outputs).toEqual([
        'code_changes',
        'implementation_notes',
        'branch_name'
      ]);
    });

    it('should define correct outputs for refactor stage', () => {
      const refactorStage = tddWorkflow.stages.find((s: any) => s.name === 'refactor');
      expect(refactorStage.outputs).toEqual([
        'refactored_code',
        'design_improvements',
        'refactor_notes'
      ]);
    });

    it('should define correct outputs for verification stage', () => {
      const verificationStage = tddWorkflow.stages.find((s: any) => s.name === 'verification');
      expect(verificationStage.outputs).toEqual([
        'final_test_results',
        'coverage_report',
        'quality_metrics'
      ]);
    });
  });

  describe('Agent Integration', () => {
    it('should have valid TDD tester agent definition', () => {
      expect(tddTesterAgent).toBeDefined();
      const result = AgentDefinitionSchema.safeParse(tddTesterAgent);
      if (!result.success) {
        console.log('TDD Tester validation errors:', result.error.issues);
      }
      expect(result.success).toBe(true);
    });

    it('should have valid TDD developer agent definition', () => {
      expect(tddDeveloperAgent).toBeDefined();
      const result = AgentDefinitionSchema.safeParse(tddDeveloperAgent);
      if (!result.success) {
        console.log('TDD Developer validation errors:', result.error.issues);
      }
      expect(result.success).toBe(true);
    });

    it('should have TDD tester agent configured with appropriate tools', () => {
      expect(tddTesterAgent.name).toBe('tdd-tester');
      expect(tddTesterAgent.tools).toContain('Read');
      expect(tddTesterAgent.tools).toContain('Write');
      expect(tddTesterAgent.tools).toContain('Edit');
      expect(tddTesterAgent.tools).toContain('Bash');
      expect(tddTesterAgent.tools).toContain('Grep');
      expect(tddTesterAgent.tools).toContain('Glob');
    });

    it('should have TDD developer agent configured with appropriate tools', () => {
      expect(tddDeveloperAgent.name).toBe('tdd-developer');
      expect(tddDeveloperAgent.tools).toContain('Read');
      expect(tddDeveloperAgent.tools).toContain('Write');
      expect(tddDeveloperAgent.tools).toContain('Edit');
      expect(tddDeveloperAgent.tools).toContain('MultiEdit');
      expect(tddDeveloperAgent.tools).toContain('Bash');
      expect(tddDeveloperAgent.tools).toContain('Grep');
      expect(tddDeveloperAgent.tools).toContain('Glob');
    });

    it('should have TDD agents using sonnet model for complex tasks', () => {
      expect(tddTesterAgent.model).toBe('sonnet');
      expect(tddDeveloperAgent.model).toBe('sonnet');
    });
  });

  describe('TDD Methodology Compliance', () => {
    it('should enforce Red-Green-Refactor cycle through stage ordering', () => {
      const stages = tddWorkflow.stages;
      const stageOrder = stages.map((s: any) => s.name);

      // Test-first (RED) comes before implementation (GREEN)
      const testFirstIndex = stageOrder.indexOf('test-first');
      const implementationIndex = stageOrder.indexOf('implementation');
      expect(testFirstIndex).toBeLessThan(implementationIndex);

      // Implementation (GREEN) comes before refactor (REFACTOR)
      const refactorIndex = stageOrder.indexOf('refactor');
      expect(implementationIndex).toBeLessThan(refactorIndex);

      // Verification comes after refactor to ensure cycle completion
      const verificationIndex = stageOrder.indexOf('verification');
      expect(refactorIndex).toBeLessThan(verificationIndex);
    });

    it('should have test-first stage focus on failing tests', () => {
      const testFirstStage = tddWorkflow.stages.find((s: any) => s.name === 'test-first');
      expect(testFirstStage.description).toContain('failing test cases');
      expect(testFirstStage.description).toContain('Red phase');
    });

    it('should have implementation stage focus on minimal code', () => {
      const implementationStage = tddWorkflow.stages.find((s: any) => s.name === 'implementation');
      expect(implementationStage.description).toContain('minimal code');
      expect(implementationStage.description).toContain('make tests pass');
      expect(implementationStage.description).toContain('Green phase');
    });

    it('should have refactor stage maintain test safety', () => {
      const refactorStage = tddWorkflow.stages.find((s: any) => s.name === 'refactor');
      expect(refactorStage.description).toContain('keeping tests green');
      expect(refactorStage.description).toContain('Refactor phase');
    });
  });

  describe('Agent Behavior Verification', () => {
    it('should have TDD tester agent describe Red phase behavior', () => {
      expect(tddTesterAgent.prompt).toContain('Red Phase');
      expect(tddTesterAgent.prompt).toContain('failing tests');
      expect(tddTesterAgent.prompt).toContain('test-first');
    });

    it('should have TDD tester agent describe test quality guidelines', () => {
      expect(tddTesterAgent.prompt).toContain('Test Quality Guidelines');
      expect(tddTesterAgent.prompt).toContain('AAA pattern');
      expect(tddTesterAgent.prompt).toContain('Arrange, Act, Assert');
    });

    it('should have TDD developer agent emphasize minimal implementation', () => {
      expect(tddDeveloperAgent.prompt).toContain('MINIMAL IMPLEMENTATION MANDATE');
      expect(tddDeveloperAgent.prompt).toContain('absolute minimum code');
      expect(tddDeveloperAgent.prompt).toContain('GREEN phase');
    });

    it('should have TDD developer agent warn against over-engineering', () => {
      expect(tddDeveloperAgent.prompt).toContain('OVER-ENGINEERING');
      expect(tddDeveloperAgent.prompt).toContain('FUTURE-PROOFING');
      expect(tddDeveloperAgent.prompt).toContain('PERFECTIONIST CODING');
    });

    it('should have TDD developer agent describe fake-it-till-you-make-it pattern', () => {
      expect(tddDeveloperAgent.prompt).toContain('Fake It Till You Make It');
      expect(tddDeveloperAgent.prompt).toContain('return 5');
      expect(tddDeveloperAgent.prompt).toContain('calculator.add(2, 3)');
    });
  });

  describe('Integration with APEX System', () => {
    it('should be compatible with standard APEX workflow triggers', () => {
      expect(tddWorkflow.trigger).toContain('manual');
      expect(tddWorkflow.trigger).toContain('apex:tdd');
      expect(tddWorkflow.trigger).toContain('apex:test-driven');
    });

    it('should use standard APEX stage patterns', () => {
      const stages = tddWorkflow.stages;

      // Each stage should have required properties
      stages.forEach((stage: any) => {
        expect(stage.name).toBeDefined();
        expect(stage.agent).toBeDefined();
        expect(stage.description).toBeDefined();
        expect(stage.outputs).toBeDefined();
        expect(Array.isArray(stage.outputs)).toBe(true);
      });
    });

    it('should reference existing APEX agents where appropriate', () => {
      const stages = tddWorkflow.stages;

      // Should use standard planner and developer agents
      expect(stages.find((s: any) => s.name === 'planning').agent).toBe('planner');
      expect(stages.find((s: any) => s.name === 'refactor').agent).toBe('developer');

      // Should use specialized TDD agents
      expect(stages.find((s: any) => s.name === 'test-first').agent).toBe('tdd-tester');
      expect(stages.find((s: any) => s.name === 'implementation').agent).toBe('tdd-developer');
      expect(stages.find((s: any) => s.name === 'verification').agent).toBe('tdd-tester');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing agent definitions gracefully', async () => {
      const invalidWorkflow = { ...tddWorkflow };
      invalidWorkflow.stages[0].agent = 'non-existent-agent';

      // Workflow should still validate structurally
      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(true);
    });

    it('should validate stage dependency chains have no cycles', () => {
      const stages = tddWorkflow.stages;
      const visited = new Set();
      const visiting = new Set();

      function hasCycle(stageName: string): boolean {
        if (visiting.has(stageName)) return true;
        if (visited.has(stageName)) return false;

        visiting.add(stageName);

        const stage = stages.find((s: any) => s.name === stageName);
        if (stage?.dependsOn) {
          for (const dep of stage.dependsOn) {
            if (hasCycle(dep)) return true;
          }
        }

        visiting.delete(stageName);
        visited.add(stageName);
        return false;
      }

      // Check each stage for cycles
      for (const stage of stages) {
        expect(hasCycle(stage.name)).toBe(false);
      }
    });

    it('should ensure all stage dependencies exist', () => {
      const stages = tddWorkflow.stages;
      const stageNames = new Set(stages.map((s: any) => s.name));

      for (const stage of stages) {
        if (stage.dependsOn) {
          for (const dependency of stage.dependsOn) {
            expect(stageNames.has(dependency)).toBe(true);
          }
        }
      }
    });
  });

  describe('Template Completeness', () => {
    it('should include all required stages for complete TDD cycle', () => {
      const requiredStages = [
        'planning',
        'test-first',
        'implementation',
        'refactor',
        'verification'
      ];

      const actualStages = tddWorkflow.stages.map((s: any) => s.name);

      for (const required of requiredStages) {
        expect(actualStages).toContain(required);
      }
    });

    it('should have comprehensive output definitions for workflow orchestration', () => {
      const stages = tddWorkflow.stages;

      // Each stage should define outputs that next stages can use
      stages.forEach((stage: any) => {
        expect(stage.outputs).toBeDefined();
        expect(stage.outputs.length).toBeGreaterThan(0);

        // Outputs should be meaningful identifiers
        stage.outputs.forEach((output: string) => {
          expect(output).toMatch(/^[a-z_]+$/);
          expect(output.length).toBeGreaterThan(3);
        });
      });
    });

    it('should provide clear stage descriptions for workflow understanding', () => {
      const stages = tddWorkflow.stages;

      stages.forEach((stage: any) => {
        expect(stage.description).toBeDefined();
        expect(stage.description.length).toBeGreaterThan(10);
        expect(stage.description).toMatch(/[A-Z]/); // Should start with capital letter
      });
    });
  });
});

describe('TDD Agent Definitions', () => {
  const agentsPath = path.join(__dirname, '../templates/agents');

  describe('TDD Tester Agent', () => {
    let agent: any;

    beforeEach(async () => {
      const content = await fs.readFile(path.join(agentsPath, 'tdd-tester.md'), 'utf-8');
      agent = parseAgentMarkdown(content);
    });

    it('should have comprehensive test-writing guidance', () => {
      expect(agent.prompt).toContain('Red Phase');
      expect(agent.prompt).toContain('Green Validation');
      expect(agent.prompt).toContain('Regression Safety');
    });

    it('should define clear TDD principles', () => {
      expect(agent.prompt).toContain('TDD Principles');
      expect(agent.prompt).toContain('Tests define the interface');
      expect(agent.prompt).toContain('Minimal implementation');
      expect(agent.prompt).toContain('Incremental development');
      expect(agent.prompt).toContain('Refactor with confidence');
    });

    it('should include test quality guidelines', () => {
      expect(agent.prompt).toContain('Test Quality Guidelines');
      expect(agent.prompt).toContain('descriptive test names');
      expect(agent.prompt).toContain('AAA pattern');
      expect(agent.prompt).toContain('behavior, not implementation');
    });
  });

  describe('TDD Developer Agent', () => {
    let agent: any;

    beforeEach(async () => {
      const content = await fs.readFile(path.join(agentsPath, 'tdd-developer.md'), 'utf-8');
      agent = parseAgentMarkdown(content);
    });

    it('should emphasize minimal implementation principles', () => {
      expect(agent.prompt).toContain('MINIMAL IMPLEMENTATION MANDATE');
      expect(agent.prompt).toContain('absolute minimum code');
      expect(agent.prompt).toContain('nothing more, nothing less');
    });

    it('should provide clear workflow steps', () => {
      expect(agent.prompt).toContain('IMPLEMENT STAGE WORKFLOW');
      expect(agent.prompt).toContain('ANALYZE FAILING TESTS');
      expect(agent.prompt).toContain('FIND THE MINIMAL CODE CHANGE');
      expect(agent.prompt).toContain('VERIFY GREEN STATE');
    });

    it('should include anti-patterns to avoid', () => {
      expect(agent.prompt).toContain('ANTI-PATTERNS TO AVOID');
      expect(agent.prompt).toContain('OVER-ENGINEERING');
      expect(agent.prompt).toContain('FUTURE-PROOFING');
      expect(agent.prompt).toContain('PERFECTIONIST CODING');
    });

    it('should provide implementation patterns', () => {
      expect(agent.prompt).toContain('Fake It Till You Make It');
      expect(agent.prompt).toContain('Triangulation');
      expect(agent.prompt).toContain('Obvious Implementation');
    });

    it('should include success criteria', () => {
      expect(agent.prompt).toContain('PRIMARY SUCCESS METRICS');
      expect(agent.prompt).toContain('previously failing tests now pass');
      expect(agent.prompt).toContain('No existing tests were broken');
      expect(agent.prompt).toContain('Minimal code was added');
    });
  });
});