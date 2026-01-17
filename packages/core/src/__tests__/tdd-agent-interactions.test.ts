import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { parseAgentMarkdown } from '../config';

describe('TDD Agent Interactions', () => {
  const templatePath = path.join(__dirname, '../../templates/workflows/tdd.yaml');
  const agentsPath = path.join(__dirname, '../../templates/agents');
  let tddWorkflow: any;
  let agents: Record<string, any>;

  beforeEach(async () => {
    // Load TDD workflow
    const workflowContent = await fs.readFile(templatePath, 'utf-8');
    tddWorkflow = yaml.parse(workflowContent);

    // Load all agent definitions
    agents = {};
    const agentFiles = ['planner.md', 'developer.md', 'tdd-tester.md', 'tdd-developer.md'];

    for (const file of agentFiles) {
      try {
        const content = await fs.readFile(path.join(agentsPath, file), 'utf-8');
        const agent = parseAgentMarkdown(content);
        if (agent) {
          agents[agent.name] = agent;
        }
      } catch (error) {
        // Skip missing files
      }
    }
  });

  describe('Stage Agent Capabilities', () => {
    it('should have all required agents for TDD workflow stages', () => {
      const requiredAgents = ['planner', 'tdd-tester', 'tdd-developer', 'developer'];
      const stageAgents = tddWorkflow.stages.map((s: any) => s.agent);

      requiredAgents.forEach(agent => {
        expect(stageAgents).toContain(agent);
      });
    });

    it('should have tdd-tester agent capable of test-first development', () => {
      const tddTester = agents['tdd-tester'];
      expect(tddTester).toBeDefined();

      // Should have tools for test creation and execution
      expect(tddTester.tools).toContain('Write'); // For creating test files
      expect(tddTester.tools).toContain('Bash'); // For running tests
      expect(tddTester.tools).toContain('Read'); // For reading code to test

      // Should have TDD-specific guidance in prompt
      expect(tddTester.prompt.toLowerCase()).toContain('test-first');
      expect(tddTester.prompt.toLowerCase()).toContain('failing test');
      expect(tddTester.prompt.toLowerCase()).toContain('red phase');
    });

    it('should have tdd-developer agent focused on minimal implementation', () => {
      const tddDeveloper = agents['tdd-developer'];
      expect(tddDeveloper).toBeDefined();

      // Should have tools for code implementation
      expect(tddDeveloper.tools).toContain('Edit'); // For modifying code
      expect(tddDeveloper.tools).toContain('MultiEdit'); // For efficient changes
      expect(tddDeveloper.tools).toContain('Read'); // For reading tests

      // Should emphasize minimal implementation
      expect(tddDeveloper.prompt.toLowerCase()).toContain('minimal');
      expect(tddDeveloper.prompt.toLowerCase()).toContain('green phase');
      expect(tddDeveloper.prompt.toLowerCase()).toContain('implement');
    });
  });

  describe('Agent Tool Compatibility', () => {
    it('should ensure agents have compatible tools for workflow handoffs', () => {
      const toolCompatibility = [
        {
          fromStage: 'planning',
          toStage: 'test-first',
          fromAgent: 'planner',
          toAgent: 'tdd-tester',
          sharedCapabilities: ['Read'] // Both need to read project files
        },
        {
          fromStage: 'test-first',
          toStage: 'implementation',
          fromAgent: 'tdd-tester',
          toAgent: 'tdd-developer',
          sharedCapabilities: ['Read', 'Bash'] // Both need to read tests and run them
        },
        {
          fromStage: 'implementation',
          toStage: 'refactor',
          fromAgent: 'tdd-developer',
          toAgent: 'developer',
          sharedCapabilities: ['Edit', 'Read'] // Both need to modify and read code
        },
        {
          fromStage: 'refactor',
          toStage: 'verification',
          fromAgent: 'developer',
          toAgent: 'tdd-tester',
          sharedCapabilities: ['Read', 'Bash'] // Both need to read code and run tests
        }
      ];

      toolCompatibility.forEach(({ fromAgent, toAgent, sharedCapabilities }) => {
        const from = agents[fromAgent];
        const to = agents[toAgent];

        if (from && to) {
          sharedCapabilities.forEach(capability => {
            expect(from.tools).toContain(capability);
            expect(to.tools).toContain(capability);
          });
        }
      });
    });

    it('should have test-running capabilities in test-focused agents', () => {
      const testAgents = ['tdd-tester'];

      testAgents.forEach(agentName => {
        const agent = agents[agentName];
        if (agent) {
          expect(agent.tools).toContain('Bash'); // Can run test commands
          expect(agent.tools).toContain('Write'); // Can create test files
          expect(agent.tools).toContain('Read'); // Can read existing code
        }
      });
    });

    it('should have code modification capabilities in development agents', () => {
      const devAgents = ['tdd-developer', 'developer'];

      devAgents.forEach(agentName => {
        const agent = agents[agentName];
        if (agent) {
          expect(agent.tools).toContain('Edit'); // Can modify code
          expect(agent.tools).toContain('Read'); // Can read existing code
        }
      });
    });
  });

  describe('Agent Prompt Alignment', () => {
    it('should have tdd-tester prompts aligned with test-first stage requirements', () => {
      const testFirstStage = tddWorkflow.stages.find((s: any) => s.name === 'test-first');
      const verificationStage = tddWorkflow.stages.find((s: any) => s.name === 'verification');
      const tddTester = agents['tdd-tester'];

      if (tddTester) {
        // Should handle Red phase (test-first)
        expect(tddTester.prompt).toContain('Red Phase');
        expect(tddTester.prompt).toContain('failing test');

        // Should handle verification
        expect(tddTester.prompt).toContain('Green Validation');
        expect(tddTester.prompt).toContain('verify');

        // Should understand test outputs expected by workflow
        const testFirstOutputs = testFirstStage.outputs;
        // Outputs include test_files, test_requirements, failure_confirmation
        expect(tddTester.prompt.toLowerCase()).toContain('test');
        expect(tddTester.prompt.toLowerCase()).toContain('fail');
      }
    });

    it('should have tdd-developer prompts aligned with implementation stage requirements', () => {
      const implementationStage = tddWorkflow.stages.find((s: any) => s.name === 'implementation');
      const tddDeveloper = agents['tdd-developer'];

      if (tddDeveloper) {
        // Should focus on minimal implementation (Green phase)
        expect(tddDeveloper.prompt).toContain('GREEN phase');
        expect(tddDeveloper.prompt).toContain('minimal');
        expect(tddDeveloper.prompt).toContain('IMPLEMENT');

        // Should understand input from test-first stage
        expect(tddDeveloper.prompt.toLowerCase()).toContain('test');
        expect(tddDeveloper.prompt.toLowerCase()).toContain('pass');

        // Should avoid over-engineering (anti-patterns)
        expect(tddDeveloper.prompt).toContain('OVER-ENGINEERING');
        expect(tddDeveloper.prompt).toContain('FUTURE-PROOFING');
      }
    });

    it('should have agent prompts that discourage TDD anti-patterns', () => {
      const tddAgents = [agents['tdd-tester'], agents['tdd-developer']];

      tddAgents.forEach(agent => {
        if (agent) {
          const prompt = agent.prompt.toLowerCase();

          // Should not encourage big design upfront
          expect(prompt).not.toContain('complete design');
          expect(prompt).not.toContain('full implementation');

          // TDD developer specifically should warn against over-engineering
          if (agent.name === 'tdd-developer') {
            expect(agent.prompt).toContain('minimal');
            expect(agent.prompt).toContain('ANTI-PATTERNS');
          }

          // TDD tester should emphasize test-first approach
          if (agent.name === 'tdd-tester') {
            expect(prompt).toContain('test-first');
            expect(prompt).not.toContain('implementation-first');
          }
        }
      });
    });
  });

  describe('Workflow Output Flow', () => {
    it('should validate output flow between TDD stages matches agent capabilities', () => {
      const stageFlow = [
        {
          stage: 'planning',
          agent: 'planner',
          outputs: ['implementation_plan', 'test_scenarios', 'acceptance_criteria'],
          nextStage: 'test-first',
          requiredCapabilities: ['planning', 'analysis']
        },
        {
          stage: 'test-first',
          agent: 'tdd-tester',
          outputs: ['test_files', 'test_requirements', 'failure_confirmation'],
          nextStage: 'implementation',
          requiredCapabilities: ['test creation', 'test execution']
        },
        {
          stage: 'implementation',
          agent: 'tdd-developer',
          outputs: ['code_changes', 'implementation_notes', 'branch_name'],
          nextStage: 'refactor',
          requiredCapabilities: ['minimal coding', 'test interpretation']
        },
        {
          stage: 'refactor',
          agent: 'developer',
          outputs: ['refactored_code', 'design_improvements', 'refactor_notes'],
          nextStage: 'verification',
          requiredCapabilities: ['code improvement', 'design patterns']
        },
        {
          stage: 'verification',
          agent: 'tdd-tester',
          outputs: ['final_test_results', 'coverage_report', 'quality_metrics'],
          nextStage: null,
          requiredCapabilities: ['comprehensive testing', 'quality assessment']
        }
      ];

      stageFlow.forEach(({ stage, agent, outputs }) => {
        const workflowStage = tddWorkflow.stages.find((s: any) => s.name === stage);
        expect(workflowStage.agent).toBe(agent);
        expect(workflowStage.outputs).toEqual(outputs);

        // Outputs should be meaningful for the next stage
        outputs.forEach(output => {
          expect(output).toMatch(/^[a-z_]+$/); // Snake case naming
          expect(output.length).toBeGreaterThan(4); // Descriptive names
        });
      });
    });

    it('should ensure test-focused outputs are produced by appropriate agents', () => {
      const testOutputs = {
        'test-first': ['test_files', 'test_requirements', 'failure_confirmation'],
        'verification': ['final_test_results', 'coverage_report', 'quality_metrics']
      };

      Object.entries(testOutputs).forEach(([stageName, outputs]) => {
        const stage = tddWorkflow.stages.find((s: any) => s.name === stageName);
        expect(stage.agent).toBe('tdd-tester');
        expect(stage.outputs).toEqual(outputs);
      });
    });

    it('should ensure code-focused outputs are produced by development agents', () => {
      const codeOutputs = {
        'implementation': ['code_changes', 'implementation_notes', 'branch_name'],
        'refactor': ['refactored_code', 'design_improvements', 'refactor_notes']
      };

      Object.entries(codeOutputs).forEach(([stageName, outputs]) => {
        const stage = tddWorkflow.stages.find((s: any) => s.name === stageName);
        const agent = stage.agent;

        // Should be either tdd-developer or developer
        expect(['tdd-developer', 'developer']).toContain(agent);
        expect(stage.outputs).toEqual(outputs);
      });
    });
  });

  describe('Agent Model Selection', () => {
    it('should use appropriate models for TDD complexity', () => {
      const expectedModels = {
        'planner': 'opus', // Complex planning tasks
        'tdd-tester': 'sonnet', // Complex test design
        'tdd-developer': 'sonnet', // Disciplined implementation
        'developer': 'sonnet' // Code refactoring
      };

      Object.entries(expectedModels).forEach(([agentName, expectedModel]) => {
        const agent = agents[agentName];
        if (agent) {
          // TDD requires careful thinking, so should use sonnet or opus
          expect(['opus', 'sonnet']).toContain(agent.model);
        }
      });
    });

    it('should not use haiku model for complex TDD decision-making', () => {
      const tddAgents = ['tdd-tester', 'tdd-developer'];

      tddAgents.forEach(agentName => {
        const agent = agents[agentName];
        if (agent) {
          // TDD requires careful consideration, not speed
          expect(agent.model).not.toBe('haiku');
        }
      });
    });
  });

  describe('Agent Interaction Patterns', () => {
    it('should support proper handoff between test-first and implementation stages', () => {
      const testFirstStage = tddWorkflow.stages.find((s: any) => s.name === 'test-first');
      const implementationStage = tddWorkflow.stages.find((s: any) => s.name === 'implementation');

      // Implementation should depend on test-first
      expect(implementationStage.dependsOn).toEqual(['test-first']);

      // Outputs from test-first should inform implementation
      const testOutputs = testFirstStage.outputs;
      expect(testOutputs).toContain('test_files'); // Files to make pass
      expect(testOutputs).toContain('failure_confirmation'); // Confirming RED state
    });

    it('should support verification feedback loop', () => {
      const verificationStage = tddWorkflow.stages.find((s: any) => s.name === 'verification');

      // Should produce comprehensive test results
      expect(verificationStage.outputs).toContain('final_test_results');
      expect(verificationStage.outputs).toContain('coverage_report');
      expect(verificationStage.outputs).toContain('quality_metrics');

      // Should use same agent as test-first for consistency
      const testFirstStage = tddWorkflow.stages.find((s: any) => s.name === 'test-first');
      expect(verificationStage.agent).toBe(testFirstStage.agent);
    });

    it('should maintain test safety through refactor stage', () => {
      const refactorStage = tddWorkflow.stages.find((s: any) => s.name === 'refactor');

      // Should come after implementation (GREEN state achieved)
      expect(refactorStage.dependsOn).toEqual(['implementation']);

      // Should be followed by verification (ensure tests still pass)
      const verificationStage = tddWorkflow.stages.find((s: any) => s.name === 'verification');
      expect(verificationStage.dependsOn).toEqual(['refactor']);

      // Outputs should preserve working code
      expect(refactorStage.outputs).toContain('refactored_code');
    });
  });

  describe('Error Handling in Agent Interactions', () => {
    it('should handle test failure scenarios gracefully', () => {
      const tddTester = agents['tdd-tester'];
      if (tddTester) {
        // Should have guidance for when tests fail
        expect(tddTester.prompt.toLowerCase()).toContain('fail');

        // Should know how to confirm RED state
        expect(tddTester.prompt.toLowerCase()).toContain('verify');
      }
    });

    it('should handle implementation challenges in minimal code approach', () => {
      const tddDeveloper = agents['tdd-developer'];
      if (tddDeveloper) {
        // Should have debugging guidance
        expect(tddDeveloper.prompt).toContain('When Tests Still Fail');
        expect(tddDeveloper.prompt).toContain('DEBUGGING');

        // Should provide patterns for different implementation approaches
        expect(tddDeveloper.prompt).toContain('Fake It Till You Make It');
        expect(tddDeveloper.prompt).toContain('Triangulation');
        expect(tddDeveloper.prompt).toContain('Obvious Implementation');
      }
    });

    it('should prevent regression during refactoring', () => {
      const tddTester = agents['tdd-tester'];
      if (tddTester) {
        // Should have regression checking capabilities
        expect(tddTester.prompt).toContain('Regression Safety');
        expect(tddTester.prompt).toContain('regression-check');

        // Should run full test suite
        expect(tddTester.prompt).toContain('Full test suite');
      }
    });
  });
});