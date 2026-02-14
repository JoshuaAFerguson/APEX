import { ToolInvocationRecorder } from '../tool-invocation-recorder.js';
import {
  InvocationFactory,
  ExecutionFactory,
  WorkflowFactory,
  RecorderAssertions,
  PerformanceProfiler,
} from './tool-invocation-recorder.helpers.js';
import { ToolInvocation, ToolExecution } from '@apexcli/core';

/**
 * Advanced tests for ToolInvocationRecorder using test helpers
 *
 * These tests demonstrate complex scenarios using the helper utilities
 * and ensure the recorder works correctly in realistic workflows.
 */
describe('ToolInvocationRecorder - Advanced Tests with Helpers', () => {
  let recorder: ToolInvocationRecorder;
  let profiler: PerformanceProfiler;

  beforeEach(() => {
    recorder = new ToolInvocationRecorder();
    profiler = new PerformanceProfiler();
  });

  afterEach(() => {
    recorder.clear();
    profiler.clear();
  });

  describe('workflow simulation', () => {
    it('should track a complete development workflow', () => {
      const workflow = WorkflowFactory.developmentWorkflow('dev-workflow-001');
      const execution = workflow.execute(recorder);

      // Test workflow execution results
      expect(execution.invocations).toHaveLength(8);

      RecorderAssertions.for(recorder)
        .expectInvocationCount(8)
        .expectStageCompletion('planning', 3)
        .expectStageCompletion('implementation', 3)
        .expectStageCompletion('testing', 2)
        .expectToolUsage('Read', 2)
        .expectToolUsage('Write', 2)
        .expectChronologicalOrder();

      const stats = execution.getStats();
      expect(stats.stageBreakdown).toEqual({
        planning: 3,
        implementation: 3,
        testing: 2,
      });

      expect(stats.toolBreakdown).toEqual({
        Glob: 1,
        Read: 2,
        Grep: 1,
        Edit: 1,
        Write: 2,
        Bash: 1,
      });
    });

    it('should simulate multi-agent collaboration workflow', () => {
      // Developer workflow
      const devWorkflow = WorkflowFactory.developmentWorkflow('collaboration-task');
      const devExecution = devWorkflow.execute(recorder);

      // Reviewer workflow on the same task
      const reviewWorkflow = WorkflowFactory.reviewWorkflow('collaboration-task');
      const reviewExecution = reviewWorkflow.execute(recorder);

      // Verify collaboration
      const taskInvocations = recorder.queryInvocations({ taskId: 'collaboration-task' });
      expect(taskInvocations).toHaveLength(devExecution.invocations.length + reviewExecution.invocations.length);

      const developerWork = recorder.queryInvocations({
        taskId: 'collaboration-task',
        agentName: 'developer',
      });
      const reviewerWork = recorder.queryInvocations({
        taskId: 'collaboration-task',
        agentName: 'reviewer',
      });

      expect(developerWork).toHaveLength(devExecution.invocations.length);
      expect(reviewerWork).toHaveLength(reviewExecution.invocations.length);

      // Check for file access overlap (both read the same files)
      const sharedFileAccess = recorder.queryInvocations({
        toolName: 'Read',
        parameters: { file_path: 'src/changes.ts' },
      });
      expect(sharedFileAccess.length).toBeGreaterThan(0);
    });

    it('should handle error recovery workflow', () => {
      const taskId = 'error-recovery-task';
      const agentName = 'developer';

      // Initial failing attempt
      const failedReadInvocation = InvocationFactory.read('/non-existent-file.ts', {
        taskId,
        agentName,
        stageName: 'investigation',
      });
      recorder.recordInvocation(failedReadInvocation);

      const failedExecution = ExecutionFactory.failed(
        'Read',
        'ENOENT: no such file or directory'
      );
      recorder.recordExecutionByCallId(failedExecution.callId, failedExecution);

      // Investigation step
      const investigationInvocation = InvocationFactory.glob('**/*.ts', 'src/', {
        taskId,
        agentName,
        stageName: 'investigation',
      });
      recorder.recordInvocation(investigationInvocation);

      const investigationExecution = ExecutionFactory.completed(
        'Glob',
        { files: ['src/main.ts', 'src/utils.ts'] }
      );
      recorder.recordExecutionByCallId(investigationExecution.callId, investigationExecution);

      // Corrected attempt
      const correctedInvocation = InvocationFactory.read('src/main.ts', {
        taskId,
        agentName,
        stageName: 'recovery',
      });
      recorder.recordInvocation(correctedInvocation);

      const correctedExecution = ExecutionFactory.completed(
        'Read',
        { content: 'export default function main() { ... }' }
      );
      recorder.recordExecutionByCallId(correctedExecution.callId, correctedExecution);

      // Verify error recovery tracking
      RecorderAssertions.for(recorder)
        .expectInvocationCount(3)
        .expectExecutionStats({ completed: 2, failed: 1, running: 0 })
        .expectStageCompletion('investigation', 2)
        .expectStageCompletion('recovery', 1);

      const failedInvocations = recorder.queryInvocations({ status: 'failed' });
      expect(failedInvocations).toHaveLength(1);
      expect(failedInvocations[0].execution?.error).toContain('ENOENT');

      const recoveryInvocations = recorder.queryInvocations({
        stageName: 'recovery',
        status: 'completed',
      });
      expect(recoveryInvocations).toHaveLength(1);
    });
  });

  describe('factory patterns', () => {
    it('should create common tool invocations using factories', () => {
      const context = { taskId: 'factory-test', agentName: 'test-agent' };

      // Test common file operations
      const readInvocation = InvocationFactory.read('/test/file.ts', context);
      const writeInvocation = InvocationFactory.write('/test/output.ts', 'content', context);
      const editInvocation = InvocationFactory.edit('/test/file.ts', 'old', 'new', context);
      const globInvocation = InvocationFactory.glob('**/*.ts', 'src/', context);
      const grepInvocation = InvocationFactory.grep('function.*test', { type: 'ts' }, context);
      const bashInvocation = InvocationFactory.bash('npm test', context);

      const invocations = [
        readInvocation,
        writeInvocation,
        editInvocation,
        globInvocation,
        grepInvocation,
        bashInvocation,
      ];

      invocations.forEach(inv => recorder.recordInvocation(inv));

      RecorderAssertions.for(recorder)
        .expectInvocationCount(6)
        .expectToolUsage('Read', 1)
        .expectToolUsage('Write', 1)
        .expectToolUsage('Edit', 1)
        .expectToolUsage('Glob', 1)
        .expectToolUsage('Grep', 1)
        .expectToolUsage('Bash', 1);

      // Verify all invocations have correct context
      const allInvocations = recorder.getAllInvocations();
      allInvocations.forEach(record => {
        expect(record.invocation.context?.taskId).toBe('factory-test');
        expect(record.invocation.context?.agentName).toBe('test-agent');
      });
    });

    it('should create execution patterns using factories', () => {
      const invocations = [
        InvocationFactory.read('/success.ts'),
        InvocationFactory.read('/failure.ts'),
        InvocationFactory.bash('long-command'),
      ];

      invocations.forEach((inv, index) => {
        const record = recorder.recordInvocation({ ...inv, requestId: `req-${index}` });

        let execution: ToolExecution;
        switch (index) {
          case 0:
            execution = ExecutionFactory.completed(inv.toolName, { content: 'file content' }, 150);
            break;
          case 1:
            execution = ExecutionFactory.failed(inv.toolName, 'File not found', 75);
            break;
          case 2:
            execution = ExecutionFactory.running(inv.toolName);
            break;
          default:
            throw new Error('Unexpected index');
        }

        recorder.recordExecution(`req-${index}`, execution);
      });

      RecorderAssertions.for(recorder)
        .expectInvocationCount(3)
        .expectExecutionStats({ completed: 1, failed: 1, running: 1 });

      const stats = recorder.getStats();
      expect(stats.averageDuration).toBe(150); // Only completed executions count
    });
  });

  describe('performance profiling', () => {
    it('should measure recording performance across different scenarios', () => {
      const scenarios = [
        { name: 'small-params', count: 100, paramsSize: 'small' },
        { name: 'large-params', count: 50, paramsSize: 'large' },
        { name: 'complex-context', count: 75, paramsSize: 'medium' },
      ];

      scenarios.forEach(scenario => {
        profiler.measureOperation(`record-${scenario.name}`, () => {
          for (let i = 0; i < scenario.count; i++) {
            let parameters: Record<string, unknown>;
            let context: any = { taskId: `perf-task-${scenario.name}` };

            switch (scenario.paramsSize) {
              case 'small':
                parameters = { id: i, name: `item-${i}` };
                break;
              case 'large':
                parameters = {
                  id: i,
                  data: new Array(100).fill(0).map(j => ({ key: j, value: `val-${i}-${j}` })),
                  metadata: { created: new Date().toISOString() },
                };
                break;
              case 'medium':
                parameters = { id: i, config: { settings: { level: i % 3 } } };
                context = {
                  taskId: `perf-task-${scenario.name}`,
                  agentName: `agent-${i % 5}`,
                  stageName: ['plan', 'impl', 'test'][i % 3],
                };
                break;
            }

            recorder.recordInvocation(
              InvocationFactory.custom(`PerfTool${scenario.name}`, parameters, context)
            );
          }
        });
      });

      // Measure query performance
      profiler.measureOperation('query-performance', () => {
        recorder.queryInvocations({ toolName: 'PerfToolsmall-params' });
        recorder.queryInvocations({ taskId: 'perf-task-large-params' });
        recorder.queryInvocations({ agentName: 'agent-1' });
        recorder.getStats();
      });

      // Verify performance results
      const recordingStats = profiler.getStats('record-small-params');
      const queryStats = profiler.getStats('query-performance');

      expect(recordingStats).toBeTruthy();
      expect(queryStats).toBeTruthy();

      // Performance should be reasonable
      expect(recordingStats!.avg).toBeLessThan(100); // Average should be under 100ms
      expect(queryStats!.total).toBeLessThan(50); // Total query time under 50ms

      console.log(profiler.report());
    });

    it('should measure concurrent operation performance', async () => {
      const concurrentOperations = 10;
      const recordsPerOperation = 100;

      await profiler.measureAsyncOperation('concurrent-recording', async () => {
        const promises = Array.from({ length: concurrentOperations }, (_, i) =>
          Promise.resolve().then(() => {
            for (let j = 0; j < recordsPerOperation; j++) {
              recorder.recordInvocation(
                InvocationFactory.custom(
                  `ConcurrentTool${i}`,
                  { operationId: i, recordId: j },
                  { taskId: `concurrent-task-${i}` }
                )
              );
            }
          })
        );

        await Promise.all(promises);
      });

      await profiler.measureAsyncOperation('concurrent-querying', async () => {
        const promises = Array.from({ length: concurrentOperations }, (_, i) =>
          Promise.resolve().then(() => {
            recorder.queryInvocations({ taskId: `concurrent-task-${i}` });
            recorder.queryInvocations({ toolName: `ConcurrentTool${i}` });
            recorder.getStats();
          })
        );

        await Promise.all(promises);
      });

      const recordingPerf = profiler.getStats('concurrent-recording');
      const queryingPerf = profiler.getStats('concurrent-querying');

      expect(recordingPerf).toBeTruthy();
      expect(queryingPerf).toBeTruthy();
      expect(recorder.getInvocationCount()).toBe(concurrentOperations * recordsPerOperation);

      console.log(`Concurrent recording: ${recordingPerf!.total.toFixed(2)}ms`);
      console.log(`Concurrent querying: ${queryingPerf!.total.toFixed(2)}ms`);
    });
  });

  describe('complex query patterns', () => {
    beforeEach(() => {
      // Setup complex test data
      const agents = ['developer', 'tester', 'reviewer', 'architect'];
      const stages = ['planning', 'design', 'implementation', 'testing', 'review', 'deployment'];
      const tools = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'LSP'];

      for (let i = 0; i < 200; i++) {
        const agent = agents[i % agents.length];
        const stage = stages[i % stages.length];
        const tool = tools[i % tools.length];

        const invocation = InvocationFactory.custom(
          tool,
          {
            index: i,
            category: `cat-${i % 10}`,
            priority: i % 5,
            fileType: ['ts', 'js', 'json', 'md'][i % 4],
          },
          {
            taskId: `complex-task-${Math.floor(i / 20)}`,
            agentName: agent,
            stageName: stage,
          }
        );

        const record = recorder.recordInvocation({ ...invocation, requestId: `complex-${i}` });

        // Add execution for some records
        if (i % 3 === 0) {
          const execution = i % 9 === 0 ?
            ExecutionFactory.failed(tool, `Error ${i}`) :
            ExecutionFactory.completed(tool, { result: `Result ${i}` });

          recorder.recordExecution(`complex-${i}`, execution);
        }
      }
    });

    it('should handle complex multi-criteria queries', () => {
      const complexQueries = [
        {
          name: 'Developer implementation work',
          query: { agentName: 'developer', stageName: 'implementation' },
          expectedMinCount: 5,
        },
        {
          name: 'Failed Read operations',
          query: { toolName: 'Read', status: 'failed' },
          expectedMinCount: 0,
        },
        {
          name: 'High priority testing',
          query: {
            stageName: 'testing',
            parameters: { priority: 4 },
          },
          expectedMinCount: 1,
        },
        {
          name: 'TypeScript file operations',
          query: {
            toolName: 'Read',
            parameters: { fileType: 'ts' },
          },
          expectedMinCount: 10,
        },
        {
          name: 'Completed operations by reviewer',
          query: {
            agentName: 'reviewer',
            status: 'completed',
          },
          expectedMinCount: 3,
        },
      ];

      complexQueries.forEach(({ name, query, expectedMinCount }) => {
        profiler.measureOperation(`query-${name}`, () => {
          const results = recorder.queryInvocations(query);
          expect(results.length).toBeGreaterThanOrEqual(expectedMinCount);

          // Verify query results match criteria
          results.forEach(record => {
            if (query.agentName) {
              expect(record.invocation.context?.agentName).toBe(query.agentName);
            }
            if (query.stageName) {
              expect(record.invocation.context?.stageName).toBe(query.stageName);
            }
            if (query.toolName) {
              expect(record.invocation.toolName).toBe(query.toolName);
            }
            if (query.status && record.execution) {
              expect(record.execution.status).toBe(query.status);
            }
          });
        });

        console.log(`${name}: ${recorder.queryInvocations(query).length} results`);
      });
    });

    it('should efficiently handle pagination-style queries', () => {
      const pageSize = 25;
      const totalPages = Math.ceil(recorder.getInvocationCount() / pageSize);
      const allResults: any[] = [];

      for (let page = 0; page < totalPages; page++) {
        const pageResults = profiler.measureOperation(`page-${page}`, () => {
          return recorder.queryInvocations({
            limit: pageSize,
            // Simulate pagination by using different query criteria
            agentName: ['developer', 'tester', 'reviewer', 'architect'][page % 4],
          });
        });

        allResults.push(...pageResults);
      }

      // Verify pagination doesn't miss data
      expect(allResults.length).toBeGreaterThan(0);

      // Check performance stays consistent across pages
      const pageStats = Array.from({ length: Math.min(totalPages, 4) }, (_, i) =>
        profiler.getStats(`page-${i}`)
      );

      const avgTimes = pageStats.filter(Boolean).map(s => s!.avg);
      const maxTime = Math.max(...avgTimes);
      const minTime = Math.min(...avgTimes);

      // Page query times should be relatively consistent
      expect(maxTime / minTime).toBeLessThan(3); // Less than 3x difference
    });
  });

  describe('data integrity validation', () => {
    it('should maintain data integrity across complex operations', () => {
      const operations = [
        () => {
          const workflow = WorkflowFactory.bugfixWorkflow('integrity-test');
          return workflow.execute(recorder);
        },
        () => {
          // Add some random invocations
          for (let i = 0; i < 10; i++) {
            recorder.recordInvocation(
              InvocationFactory.read(`/test/file${i}.ts`, {
                taskId: 'integrity-test',
                agentName: 'validator',
              })
            );
          }
        },
        () => {
          // Query and verify data
          const results = recorder.queryInvocations({ taskId: 'integrity-test' });
          expect(results.length).toBeGreaterThan(0);
          return results;
        },
      ];

      const initialCount = recorder.getInvocationCount();

      operations.forEach((operation, index) => {
        profiler.measureOperation(`integrity-op-${index}`, operation);
      });

      // Verify recorder state is still consistent
      RecorderAssertions.for(recorder)
        .expectChronologicalOrder()
        .expectQueryResults({ taskId: 'integrity-test' }, recorder.getInvocationCount());

      const finalStats = recorder.getStats();
      expect(finalStats.totalInvocations).toBe(recorder.getInvocationCount());

      // Verify all records are accessible and valid
      const allRecords = recorder.getAllInvocations();
      allRecords.forEach(record => {
        expect(record.invocation.toolName).toBeTruthy();
        expect(record.recordedAt).toBeInstanceOf(Date);
        expect(record.invocation.parameters).toBeTruthy();
      });
    });
  });
});