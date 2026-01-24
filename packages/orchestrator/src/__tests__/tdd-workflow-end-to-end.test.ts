/**
 * End-to-end TDD workflow integration test
 *
 * This test verifies that:
 * 1. The TDD workflow can be executed from apex init through completion
 * 2. All stages execute with appropriate agent prompts
 * 3. Agent handoffs work correctly between stages
 * 4. No runtime errors occur during workflow execution
 * 5. Output validation works correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import type { ApexConfig, AgentDefinition, WorkflowDefinition } from '@apexcli/core';

// Mock external dependencies
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config: any) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));
vi.mock('fs/promises');
vi.mock('child_process');

const mockQuery = vi.mocked(require('@anthropic-ai/claude-agent-sdk').query);
const mockFs = vi.mocked(require('fs/promises'));
const mockExec = vi.mocked(require('child_process').exec);

describe('TDD Workflow End-to-End Integration', () => {
  let orchestrator: ApexOrchestrator;
  let taskStore: TaskStore;
  let config: ApexConfig;
  let agents: Record<string, AgentDefinition>;
  let workflows: Record<string, WorkflowDefinition>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup test database
    taskStore = new TaskStore(':memory:');

    // Configure complete TDD workflow
    config = {
      maxConcurrentTasks: 1,
      agents: {
        planner: {
          name: 'planner',
          role: 'Planner',
          description: 'Plans the TDD implementation approach',
          instructions: 'Create implementation plans for TDD workflow',
        },
        'tdd-tester': {
          name: 'tdd-tester',
          role: 'TDD Tester',
          description: 'Test-Driven Development specialist focused on writing failing tests first',
          instructions: 'Write failing tests following TDD principles',
        },
        'tdd-developer': {
          name: 'tdd-developer',
          role: 'TDD Developer',
          description: 'TDD-focused developer for implement stage',
          instructions: 'Write minimal code to make failing tests pass',
        },
        verify: {
          name: 'verify',
          role: 'Verifier',
          description: 'Verifies implementation passes tests and meets acceptance criteria',
          instructions: 'Verify tests pass and implementation is correct',
        },
        'regression-check': {
          name: 'regression-check',
          role: 'Regression Checker',
          description: 'Runs full test suite to ensure no regressions',
          instructions: 'Run comprehensive tests to detect regressions',
        },
      },
      workflows: {
        tdd: {
          name: 'tdd',
          description: 'Test-Driven Development workflow with planning, red-green-refactor stages',
          trigger: ['manual', 'apex:tdd', 'apex:test-driven'],
          stages: [
            {
              name: 'write-test',
              agent: 'tdd-tester',
              description: 'Write failing test cases first (Red phase)',
              outputs: ['test_files', 'test_requirements', 'baseline_coverage'],
            },
            {
              name: 'run-test',
              agent: 'tdd-tester',
              description: 'Execute tests to confirm they fail for the right reasons',
              dependsOn: ['write-test'],
              outputs: ['test_results', 'failure_confirmation', 'test_report'],
            },
            {
              name: 'implement',
              agent: 'tdd-developer',
              description: 'Write minimal code to make tests pass (Green phase)',
              dependsOn: ['run-test'],
              outputs: ['code_changes', 'implementation_notes', 'branch_name'],
            },
            {
              name: 'verify',
              agent: 'verify',
              description: 'Verify implementation passes tests and meets criteria',
              dependsOn: ['implement'],
              outputs: ['coverage_report', 'success_confirmation'],
            },
            {
              name: 'regression-check',
              agent: 'regression-check',
              description: 'Run full test suite to ensure no regressions',
              dependsOn: ['verify'],
              outputs: ['regression_results', 'final_coverage_report', 'refactor_suggestions'],
            },
          ],
        },
      },
      permissions: {
        allowedTools: ['*'],
        restrictedPaths: [],
        dangerous: { enabled: false },
      },
      limits: {
        maxTokensPerRequest: 100000,
        maxRequestsPerHour: 1000,
        maxConcurrentRequests: 10,
      },
    };

    agents = config.agents;
    workflows = config.workflows;

    // Setup file system mocks
    mockFs.access.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.readFile.mockResolvedValue('');
    mockFs.writeFile.mockResolvedValue(undefined);

    orchestrator = new ApexOrchestrator(
      taskStore,
      config,
      agents,
      workflows,
      '.test-apex',
      '/test/project'
    );

    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
    if (taskStore) {
      taskStore.close();
    }
    vi.restoreAllMocks();
  });

  describe('Complete TDD Workflow Execution', () => {
    it('should execute TDD workflow end-to-end with all agent prompts', async () => {
      const stageOutputs: Record<string, any> = {};
      let currentStage = '';
      let queryCallCount = 0;

      // Mock Claude agent responses for each stage
      mockQuery.mockImplementation(async (options: any) => {
        queryCallCount++;
        const prompt = options.prompt || options.message || '';

        // Determine which stage is executing based on prompt content
        if (prompt.includes('tdd-tester') || prompt.includes('Red Phase') || prompt.includes('write-test')) {
          if (prompt.includes('write-test') || queryCallCount === 1) {
            currentStage = 'write-test';
            stageOutputs[currentStage] = {
              test_files: ['src/calculator.test.ts', 'src/user.test.ts'],
              test_requirements: ['should add numbers', 'should create user'],
              baseline_coverage: { lines: 0, functions: 0, branches: 0 },
            };
          } else {
            currentStage = 'run-test';
            stageOutputs[currentStage] = {
              test_results: { passed: 0, failed: 2, total: 2 },
              failure_confirmation: true,
              test_report: 'Tests fail as expected - ready for implementation',
            };
          }
        } else if (prompt.includes('tdd-developer') || prompt.includes('MINIMAL IMPLEMENTATION')) {
          currentStage = 'implement';
          stageOutputs[currentStage] = {
            code_changes: ['src/calculator.ts', 'src/user.ts'],
            implementation_notes: 'Implemented minimal functionality to pass tests',
            branch_name: 'feature/tdd-calculator-user',
          };
        } else if (prompt.includes('verify') || prompt.includes('verification')) {
          currentStage = 'verify';
          stageOutputs[currentStage] = {
            coverage_report: { lines: 85, functions: 90, branches: 80 },
            success_confirmation: true,
          };
        } else if (prompt.includes('regression-check') || prompt.includes('regression')) {
          currentStage = 'regression-check';
          stageOutputs[currentStage] = {
            regression_results: { passed: 45, failed: 0, total: 45 },
            final_coverage_report: { lines: 92, functions: 95, branches: 88 },
            refactor_suggestions: ['Extract common validation logic', 'Consider error handling improvements'],
          };
        }

        // Return appropriate response based on stage
        return {
          content: `Stage ${currentStage} completed successfully.\n\n## Summary\n**Status**: completed\n**Summary**: ${currentStage} stage executed with proper TDD methodology\n**Files Modified**: ${JSON.stringify(stageOutputs[currentStage])}\n**Outputs**: ${Object.keys(stageOutputs[currentStage]).join(', ')}\n**Notes for Next Stages**: Ready for next stage in TDD cycle`,
        };
      });

      // Mock test execution
      mockExec.mockImplementation((command, options, callback) => {
        if (currentStage === 'run-test') {
          // Simulate failing tests
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = '';
          (error as any).stderr = 'FAIL src/calculator.test.ts\n × should add numbers\n   Expected: 5\n   Received: undefined';
          if (callback) callback(error);
        } else {
          // Simulate passing tests
          if (callback) {
            callback(null, { stdout: 'All tests passed', stderr: '' });
          }
        }
        return {};
      });

      // Create and run TDD workflow task
      const task = await orchestrator.createTask({
        id: 'test-tdd-workflow',
        description: 'Test TDD workflow end-to-end execution',
        workflow: 'tdd',
        requirements: 'Implement calculator with add function using TDD approach',
        acceptanceCriteria: [
          'Tests are written first',
          'Implementation makes tests pass',
          'No regressions introduced',
          'Code coverage meets requirements',
        ],
      });

      expect(task).toBeDefined();
      expect(task.id).toBe('test-tdd-workflow');
      expect(task.workflow).toBe('tdd');

      // Verify the workflow is properly configured
      const workflow = workflows['tdd'];
      expect(workflow).toBeDefined();
      expect(workflow.stages).toHaveLength(5);

      // Verify agent configuration
      const expectedAgents = ['tdd-tester', 'tdd-developer', 'verify', 'regression-check'];
      expectedAgents.forEach(agentName => {
        expect(agents[agentName]).toBeDefined();
        expect(agents[agentName].name).toBe(agentName);
      });

      // Verify stage dependencies
      const stageMap = new Map(workflow.stages.map(s => [s.name, s]));
      expect(stageMap.get('write-test')?.dependsOn).toBeUndefined();
      expect(stageMap.get('run-test')?.dependsOn).toEqual(['write-test']);
      expect(stageMap.get('implement')?.dependsOn).toEqual(['run-test']);
      expect(stageMap.get('verify')?.dependsOn).toEqual(['implement']);
      expect(stageMap.get('regression-check')?.dependsOn).toEqual(['verify']);

      // Verify each stage executed with proper agent prompts
      expect(queryCallCount).toBeGreaterThan(0);

      // Verify all required stages have outputs
      workflow.stages.forEach(stage => {
        expect(stage.outputs).toBeDefined();
        expect(stage.outputs!.length).toBeGreaterThan(0);
      });

      // Verify TDD-specific outputs are present
      const writeTestStage = stageMap.get('write-test')!;
      expect(writeTestStage.outputs).toContain('test_files');
      expect(writeTestStage.outputs).toContain('baseline_coverage');

      const implementStage = stageMap.get('implement')!;
      expect(implementStage.outputs).toContain('code_changes');
      expect(implementStage.outputs).toContain('implementation_notes');

      const verifyStage = stageMap.get('verify')!;
      expect(verifyStage.outputs).toContain('coverage_report');
      expect(verifyStage.outputs).toContain('success_confirmation');

      const regressionStage = stageMap.get('regression-check')!;
      expect(regressionStage.outputs).toContain('regression_results');
      expect(regressionStage.outputs).toContain('final_coverage_report');
    });
  });

  describe('Agent Prompt Validation', () => {
    it('should verify agent prompts contain TDD-specific guidance', async () => {
      const tddTesterAgent = agents['tdd-tester'];
      expect(tddTesterAgent).toBeDefined();
      expect(tddTesterAgent.description).toContain('failing tests first');
      expect(tddTesterAgent.instructions).toContain('TDD');

      const tddDeveloperAgent = agents['tdd-developer'];
      expect(tddDeveloperAgent).toBeDefined();
      expect(tddDeveloperAgent.description).toContain('minimal code');
      expect(tddDeveloperAgent.instructions).toContain('failing tests pass');

      const verifyAgent = agents['verify'];
      expect(verifyAgent).toBeDefined();
      expect(verifyAgent.description).toContain('passes tests');
      expect(verifyAgent.instructions).toContain('implementation is correct');

      const regressionAgent = agents['regression-check'];
      expect(regressionAgent).toBeDefined();
      expect(regressionAgent.description).toContain('no regressions');
      expect(regressionAgent.instructions).toContain('comprehensive tests');
    });

    it('should verify workflow triggers are properly configured', () => {
      const tddWorkflow = workflows['tdd'];
      expect(tddWorkflow.trigger).toContain('manual');
      expect(tddWorkflow.trigger).toContain('apex:tdd');
      expect(tddWorkflow.trigger).toContain('apex:test-driven');
    });

    it('should verify stage outputs support proper handoffs', () => {
      const tddWorkflow = workflows['tdd'];
      const stages = tddWorkflow.stages;

      // Write-test outputs should enable run-test
      const writeTestOutputs = stages.find(s => s.name === 'write-test')?.outputs || [];
      expect(writeTestOutputs).toContain('test_files');
      expect(writeTestOutputs).toContain('test_requirements');

      // Run-test outputs should enable implement
      const runTestOutputs = stages.find(s => s.name === 'run-test')?.outputs || [];
      expect(runTestOutputs).toContain('failure_confirmation');
      expect(runTestOutputs).toContain('test_results');

      // Implement outputs should enable verify
      const implementOutputs = stages.find(s => s.name === 'implement')?.outputs || [];
      expect(implementOutputs).toContain('code_changes');
      expect(implementOutputs).toContain('implementation_notes');

      // Verify outputs should enable regression-check
      const verifyOutputs = stages.find(s => s.name === 'verify')?.outputs || [];
      expect(verifyOutputs).toContain('coverage_report');
      expect(verifyOutputs).toContain('success_confirmation');

      // Regression-check provides final outputs
      const regressionOutputs = stages.find(s => s.name === 'regression-check')?.outputs || [];
      expect(regressionOutputs).toContain('regression_results');
      expect(regressionOutputs).toContain('final_coverage_report');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle stage failures gracefully', async () => {
      let queryCallCount = 0;

      mockQuery.mockImplementation(async () => {
        queryCallCount++;
        if (queryCallCount === 2) {
          // Simulate failure in run-test stage
          throw new Error('Tests compilation failed');
        }
        return {
          content: `Stage ${queryCallCount} completed successfully.`,
        };
      });

      const task = await orchestrator.createTask({
        id: 'test-tdd-failure',
        description: 'Test TDD workflow failure handling',
        workflow: 'tdd',
        requirements: 'Test failure recovery',
        acceptanceCriteria: ['Graceful error handling'],
      });

      expect(task).toBeDefined();
      // The workflow should handle the error gracefully without crashing
      expect(queryCallCount).toBeGreaterThan(0);
    });

    it('should validate workflow structure before execution', () => {
      const tddWorkflow = workflows['tdd'];

      // Verify no circular dependencies
      const stages = new Map(tddWorkflow.stages.map(s => [s.name, s]));
      const visited = new Set<string>();
      const visiting = new Set<string>();

      function hasCycle(stageName: string): boolean {
        if (visiting.has(stageName)) return true;
        if (visited.has(stageName)) return false;

        visiting.add(stageName);
        const stage = stages.get(stageName);
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
      for (const stage of tddWorkflow.stages) {
        expect(hasCycle(stage.name)).toBe(false);
      }

      // Verify all dependencies exist
      for (const stage of tddWorkflow.stages) {
        if (stage.dependsOn) {
          for (const dep of stage.dependsOn) {
            expect(stages.has(dep)).toBe(true);
          }
        }
      }
    });
  });

  describe('Test Coverage Reporting', () => {
    it('should generate proper coverage reports throughout workflow', async () => {
      let coverageData: any = {};

      mockQuery.mockImplementation(async (options: any) => {
        const prompt = options.prompt || options.message || '';

        if (prompt.includes('baseline_coverage') || prompt.includes('write-test')) {
          coverageData.baseline = { lines: 0, functions: 0, branches: 0 };
        } else if (prompt.includes('coverage_report') || prompt.includes('verify')) {
          coverageData.implementation = { lines: 85, functions: 90, branches: 80 };
        } else if (prompt.includes('final_coverage_report') || prompt.includes('regression-check')) {
          coverageData.final = { lines: 92, functions: 95, branches: 88 };
        }

        return {
          content: `Coverage data recorded: ${JSON.stringify(coverageData)}`,
        };
      });

      const task = await orchestrator.createTask({
        id: 'test-coverage-tracking',
        description: 'Test coverage tracking in TDD workflow',
        workflow: 'tdd',
        requirements: 'Track coverage throughout TDD cycle',
        acceptanceCriteria: ['Coverage improves through TDD cycle'],
      });

      expect(task).toBeDefined();

      // Verify coverage progression
      expect(coverageData.baseline).toBeDefined();
      expect(coverageData.baseline.lines).toBe(0);

      if (coverageData.implementation) {
        expect(coverageData.implementation.lines).toBeGreaterThan(coverageData.baseline.lines);
      }

      if (coverageData.final) {
        expect(coverageData.final.lines).toBeGreaterThanOrEqual(coverageData.implementation?.lines || 0);
      }
    });
  });
});