import {
  ToolInvocationRecorder,
  globalRecorder,
} from '../tool-invocation-recorder.js';
import { ToolInvocation, ToolExecution } from '@apexcli/core';

/**
 * Integration tests for ToolInvocationRecorder
 *
 * These tests verify the recorder works correctly in realistic scenarios
 * that mimic how it would be used with the Claude Agent SDK.
 */
describe('ToolInvocationRecorder - Integration Tests', () => {
  let recorder: ToolInvocationRecorder;

  beforeEach(() => {
    recorder = new ToolInvocationRecorder();
    globalRecorder.clear();
  });

  afterEach(() => {
    recorder.clear();
    globalRecorder.clear();
  });

  describe('claude agent sdk integration patterns', () => {
    it('should track a complete agent workflow', () => {
      const taskId = 'feature-implementation-task';
      const agentName = 'developer';

      // Simulate a planning stage
      const planningInvocations: ToolInvocation[] = [
        {
          toolName: 'Glob',
          parameters: { pattern: '**/*.ts', path: 'src/' },
          context: { taskId, agentName, stageName: 'planning' },
          requestId: 'req-plan-1',
        },
        {
          toolName: 'Read',
          parameters: { file_path: 'src/config.ts' },
          context: { taskId, agentName, stageName: 'planning' },
          requestId: 'req-plan-2',
        },
        {
          toolName: 'Grep',
          parameters: { pattern: 'interface.*Config', type: 'ts' },
          context: { taskId, agentName, stageName: 'planning' },
          requestId: 'req-plan-3',
        },
      ];

      // Record planning invocations
      planningInvocations.forEach(inv => recorder.recordInvocation(inv));

      // Simulate implementation stage
      const implementationInvocations: ToolInvocation[] = [
        {
          toolName: 'Read',
          parameters: { file_path: 'src/existing-module.ts' },
          context: { taskId, agentName, stageName: 'implementation' },
          requestId: 'req-impl-1',
        },
        {
          toolName: 'Write',
          parameters: {
            file_path: 'src/new-feature.ts',
            content: 'export class NewFeature { ... }',
          },
          context: { taskId, agentName, stageName: 'implementation' },
          requestId: 'req-impl-2',
        },
        {
          toolName: 'Edit',
          parameters: {
            file_path: 'src/existing-module.ts',
            old_string: 'export default',
            new_string: 'export { NewFeature } from "./new-feature";\nexport default',
          },
          context: { taskId, agentName, stageName: 'implementation' },
          requestId: 'req-impl-3',
        },
      ];

      implementationInvocations.forEach(inv => recorder.recordInvocation(inv));

      // Add execution results
      const executions: ToolExecution[] = [
        {
          callId: 'call-plan-1',
          toolName: 'Glob',
          input: planningInvocations[0].parameters,
          startTime: new Date(),
          status: 'completed',
          result: { files: ['src/config.ts', 'src/main.ts', 'src/utils.ts'] },
          duration: 150,
        },
        {
          callId: 'call-impl-2',
          toolName: 'Write',
          input: implementationInvocations[1].parameters,
          startTime: new Date(),
          status: 'completed',
          result: { success: true },
          duration: 300,
        },
      ];

      executions.forEach((exec, index) => {
        const requestId = index === 0 ? 'req-plan-1' : 'req-impl-2';
        recorder.recordExecution(requestId, exec);
      });

      // Verify workflow tracking
      const allInvocations = recorder.getAllInvocations();
      expect(allInvocations).toHaveLength(6);

      const planningStage = recorder.queryInvocations({ stageName: 'planning' });
      expect(planningStage).toHaveLength(3);

      const implementationStage = recorder.queryInvocations({ stageName: 'implementation' });
      expect(implementationStage).toHaveLength(3);

      const completedExecutions = recorder.queryInvocations({ status: 'completed' });
      expect(completedExecutions).toHaveLength(2);

      const stats = recorder.getStats();
      expect(stats.totalInvocations).toBe(6);
      expect(stats.successfulExecutions).toBe(2);
      expect(stats.topTools.map(t => t.toolName)).toContain('Read');
      expect(stats.topTools.map(t => t.toolName)).toContain('Glob');
      expect(stats.topTools.map(t => t.toolName)).toContain('Write');
    });

    it('should track multi-agent collaboration', () => {
      const taskId = 'collaborative-task';

      // Developer agent activities
      const developerInvocations = [
        {
          toolName: 'Read',
          parameters: { file_path: 'src/feature.ts' },
          context: { taskId, agentName: 'developer', stageName: 'implementation' },
          requestId: 'dev-1',
        },
        {
          toolName: 'Write',
          parameters: { file_path: 'src/feature-impl.ts', content: '...' },
          context: { taskId, agentName: 'developer', stageName: 'implementation' },
          requestId: 'dev-2',
        },
      ];

      // Tester agent activities
      const testerInvocations = [
        {
          toolName: 'Read',
          parameters: { file_path: 'src/feature-impl.ts' },
          context: { taskId, agentName: 'tester', stageName: 'testing' },
          requestId: 'test-1',
        },
        {
          toolName: 'Write',
          parameters: { file_path: 'src/feature.test.ts', content: 'describe(...)' },
          context: { taskId, agentName: 'tester', stageName: 'testing' },
          requestId: 'test-2',
        },
        {
          toolName: 'Bash',
          parameters: { command: 'npm test' },
          context: { taskId, agentName: 'tester', stageName: 'testing' },
          requestId: 'test-3',
        },
      ];

      // Reviewer agent activities
      const reviewerInvocations = [
        {
          toolName: 'Read',
          parameters: { file_path: 'src/feature-impl.ts' },
          context: { taskId, agentName: 'reviewer', stageName: 'review' },
          requestId: 'review-1',
        },
        {
          toolName: 'Read',
          parameters: { file_path: 'src/feature.test.ts' },
          context: { taskId, agentName: 'reviewer', stageName: 'review' },
          requestId: 'review-2',
        },
      ];

      // Record all invocations
      [...developerInvocations, ...testerInvocations, ...reviewerInvocations]
        .forEach(inv => recorder.recordInvocation(inv));

      // Verify multi-agent tracking
      const developerWork = recorder.queryInvocations({ agentName: 'developer' });
      expect(developerWork).toHaveLength(2);

      const testerWork = recorder.queryInvocations({ agentName: 'tester' });
      expect(testerWork).toHaveLength(3);

      const reviewerWork = recorder.queryInvocations({ agentName: 'reviewer' });
      expect(reviewerWork).toHaveLength(2);

      // Verify stage-specific queries
      const testingStage = recorder.queryInvocations({ stageName: 'testing' });
      expect(testingStage).toHaveLength(3);

      // Verify file-based tracking
      const featureImplReads = recorder.queryInvocations({
        toolName: 'Read',
        parameters: { file_path: 'src/feature-impl.ts' },
      });
      expect(featureImplReads).toHaveLength(2); // Read by tester and reviewer

      const stats = recorder.getStats();
      expect(stats.totalInvocations).toBe(7);
      expect(stats.topTools.find(t => t.toolName === 'Read')?.count).toBe(4);
      expect(stats.topTools.find(t => t.toolName === 'Write')?.count).toBe(2);
      expect(stats.topTools.find(t => t.toolName === 'Bash')?.count).toBe(1);
    });

    it('should handle error scenarios and retries', () => {
      const taskId = 'error-handling-task';
      const agentName = 'developer';

      // Initial failed attempt
      const failedAttempt: ToolInvocation = {
        toolName: 'Read',
        parameters: { file_path: '/non-existent-file.txt' },
        context: { taskId, agentName, stageName: 'implementation' },
        requestId: 'attempt-1',
      };

      recorder.recordInvocation(failedAttempt);
      recorder.recordExecution('attempt-1', {
        callId: 'call-fail-1',
        toolName: 'Read',
        input: failedAttempt.parameters,
        startTime: new Date(),
        status: 'failed',
        error: 'File not found: /non-existent-file.txt',
        duration: 50,
      });

      // Retry with corrected path
      const retryAttempt: ToolInvocation = {
        toolName: 'Read',
        parameters: { file_path: '/existing-file.txt' },
        context: { taskId, agentName, stageName: 'implementation' },
        requestId: 'attempt-2',
      };

      recorder.recordInvocation(retryAttempt);
      recorder.recordExecution('attempt-2', {
        callId: 'call-success-1',
        toolName: 'Read',
        input: retryAttempt.parameters,
        startTime: new Date(),
        status: 'completed',
        result: { content: 'file contents...' },
        duration: 100,
      });

      // Third attempt that's still running
      const runningAttempt: ToolInvocation = {
        toolName: 'Bash',
        parameters: { command: 'long-running-command' },
        context: { taskId, agentName, stageName: 'implementation' },
        requestId: 'attempt-3',
      };

      recorder.recordInvocation(runningAttempt);
      recorder.recordExecution('attempt-3', {
        callId: 'call-running-1',
        toolName: 'Bash',
        input: runningAttempt.parameters,
        startTime: new Date(),
        status: 'running',
      });

      // Verify error tracking
      const failedInvocations = recorder.queryInvocations({ status: 'failed' });
      expect(failedInvocations).toHaveLength(1);
      expect(failedInvocations[0].execution?.error).toContain('File not found');

      const successfulInvocations = recorder.queryInvocations({ status: 'completed' });
      expect(successfulInvocations).toHaveLength(1);

      const runningInvocations = recorder.queryInvocations({ status: 'running' });
      expect(runningInvocations).toHaveLength(1);

      const stats = recorder.getStats();
      expect(stats.failedExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.runningExecutions).toBe(1);
      expect(stats.averageDuration).toBe(100); // Only completed executions count
    });
  });

  describe('real-world usage patterns', () => {
    it('should handle file system operations workflow', () => {
      const taskId = 'filesystem-workflow';
      const agentName = 'developer';

      // Typical file operations workflow
      const workflow = [
        // 1. Explore directory structure
        {
          tool: 'Glob',
          params: { pattern: 'src/**/*.ts' },
          expectedFiles: ['src/index.ts', 'src/utils.ts', 'src/config.ts'],
        },
        // 2. Read existing files
        {
          tool: 'Read',
          params: { file_path: 'src/index.ts' },
          expectedContent: 'export * from "./utils";',
        },
        // 3. Search for patterns
        {
          tool: 'Grep',
          params: { pattern: 'export.*function', glob: '**/*.ts' },
          expectedMatches: ['src/utils.ts:5:export function helper()', 'src/config.ts:2:export function getConfig()'],
        },
        // 4. Edit existing file
        {
          tool: 'Edit',
          params: {
            file_path: 'src/index.ts',
            old_string: 'export * from "./utils";',
            new_string: 'export * from "./utils";\nexport * from "./config";',
          },
        },
        // 5. Create new file
        {
          tool: 'Write',
          params: {
            file_path: 'src/new-feature.ts',
            content: 'export class NewFeature {\n  // Implementation\n}',
          },
        },
      ];

      // Execute and record workflow
      workflow.forEach((step, index) => {
        const invocation: ToolInvocation = {
          toolName: step.tool,
          parameters: step.params,
          context: { taskId, agentName, stageName: 'implementation' },
          requestId: `workflow-${index + 1}`,
        };

        recorder.recordInvocation(invocation);

        // Simulate successful execution
        recorder.recordExecution(`workflow-${index + 1}`, {
          callId: `call-${index + 1}`,
          toolName: step.tool,
          input: step.params,
          startTime: new Date(Date.now() - (workflow.length - index) * 1000),
          status: 'completed',
          result: step.tool === 'Glob' ? { files: (step as any).expectedFiles } :
                  step.tool === 'Read' ? { content: (step as any).expectedContent } :
                  step.tool === 'Grep' ? { matches: (step as any).expectedMatches } :
                  { success: true },
          duration: Math.random() * 200 + 50,
        });
      });

      // Analyze the workflow
      const allInvocations = recorder.getAllInvocations();
      expect(allInvocations).toHaveLength(workflow.length);

      // Verify chronological order
      for (let i = 1; i < allInvocations.length; i++) {
        expect(allInvocations[i].recordedAt.getTime())
          .toBeGreaterThanOrEqual(allInvocations[i - 1].recordedAt.getTime());
      }

      // Verify tool usage distribution
      const stats = recorder.getStats();
      expect(stats.topTools.length).toBe(workflow.length);
      expect(stats.successfulExecutions).toBe(workflow.length);
      expect(stats.failedExecutions).toBe(0);

      // Test workflow analysis queries
      const readOperations = recorder.getInvocationsForTool('Read');
      expect(readOperations).toHaveLength(1);

      const writeOperations = recorder.queryInvocations({
        toolName: 'Write',
        stageName: 'implementation',
      });
      expect(writeOperations).toHaveLength(1);

      const fileOperations = recorder.queryInvocations({
        parameters: { file_path: 'src/index.ts' },
      });
      expect(fileOperations).toHaveLength(2); // Read and Edit
    });

    it('should support debugging and analysis workflows', () => {
      const taskId = 'debugging-session';
      const agentName = 'developer';
      const startTime = new Date();

      // Simulate debugging session with investigation steps
      const debuggingSteps = [
        // Initial problem investigation
        { tool: 'Read', params: { file_path: 'src/buggy-module.ts' } },
        { tool: 'Grep', params: { pattern: 'console\\.log', glob: 'src/**/*.ts' } },

        // Check test results
        { tool: 'Bash', params: { command: 'npm test' } },
        { tool: 'Read', params: { file_path: 'test-output.log' } },

        // Analyze dependencies
        { tool: 'Read', params: { file_path: 'package.json' } },
        { tool: 'Grep', params: { pattern: 'import.*from', glob: 'src/buggy-module.ts' } },

        // Apply fixes
        { tool: 'Edit', params: {
          file_path: 'src/buggy-module.ts',
          old_string: 'if (condition) return',
          new_string: 'if (condition) return result',
        }},

        // Verify fix
        { tool: 'Bash', params: { command: 'npm test src/buggy-module.test.ts' } },
      ];

      debuggingSteps.forEach((step, index) => {
        const invocation: ToolInvocation = {
          toolName: step.tool,
          parameters: step.params,
          context: { taskId, agentName, stageName: 'debugging' },
          requestId: `debug-${index + 1}`,
        };

        recorder.recordInvocation(invocation);

        // Simulate execution results
        const status = index === 2 ? 'failed' : 'completed'; // Test fails initially
        const execution: ToolExecution = {
          callId: `debug-call-${index + 1}`,
          toolName: step.tool,
          input: step.params,
          startTime: new Date(startTime.getTime() + index * 30000), // 30s intervals
          status,
          duration: Math.random() * 1000 + 100,
        };

        if (status === 'failed') {
          execution.error = 'Test failed: expected result to be defined';
        } else {
          execution.result = { success: true };
        }

        recorder.recordExecution(`debug-${index + 1}`, execution);
      });

      // Analyze debugging session
      const debuggingSession = recorder.queryInvocations({
        taskId,
        stageName: 'debugging',
      });
      expect(debuggingSession).toHaveLength(debuggingSteps.length);

      // Check failure analysis
      const failedOperations = recorder.queryInvocations({ status: 'failed' });
      expect(failedOperations).toHaveLength(1);
      expect(failedOperations[0].invocation.toolName).toBe('Bash');

      // Analyze time progression
      const timeRange = recorder.getInvocationsInTimeRange(
        startTime,
        new Date(startTime.getTime() + 10 * 60 * 1000) // 10 minutes
      );
      expect(timeRange).toHaveLength(debuggingSteps.length);

      // Check tool usage patterns
      const bashUsage = recorder.getInvocationsForTool('Bash');
      expect(bashUsage).toHaveLength(2); // npm test commands

      const fileReads = recorder.getInvocationsForTool('Read');
      expect(fileReads).toHaveLength(3); // Three different files

      const stats = recorder.getStats();
      expect(stats.failedExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(debuggingSteps.length - 1);
    });
  });

  describe('global recorder integration', () => {
    it('should work seamlessly with global recorder instance', () => {
      const taskId = 'global-recorder-test';

      // Use global recorder for some operations
      globalRecorder.recordInvocation({
        toolName: 'Read',
        parameters: { file_path: 'global-file.ts' },
        context: { taskId, agentName: 'global-agent' },
      });

      // Use local recorder for others
      recorder.recordInvocation({
        toolName: 'Write',
        parameters: { file_path: 'local-file.ts', content: 'local content' },
        context: { taskId, agentName: 'local-agent' },
      });

      // Verify isolation
      expect(globalRecorder.getInvocationCount()).toBe(1);
      expect(recorder.getInvocationCount()).toBe(1);

      const globalInvocations = globalRecorder.queryInvocations({ agentName: 'global-agent' });
      expect(globalInvocations).toHaveLength(1);

      const localInvocations = recorder.queryInvocations({ agentName: 'local-agent' });
      expect(localInvocations).toHaveLength(1);

      // Verify they don't interfere with each other
      globalRecorder.clear();
      expect(globalRecorder.getInvocationCount()).toBe(0);
      expect(recorder.getInvocationCount()).toBe(1); // Local recorder unaffected
    });
  });
});