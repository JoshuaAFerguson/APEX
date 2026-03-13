import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { ApexConfig } from '@apexcli/core';
import { TaskInspector } from '../packages/cli/src/services/task-inspector';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

/**
 * Comprehensive test suite for TaskInspector component
 *
 * This test suite provides deep coverage of:
 * - All inspection options and modes
 * - Output formatting and display logic
 * - Error handling and edge cases
 * - Performance with large datasets
 * - Integration with orchestrator services
 */

describe('TaskInspector - Comprehensive Testing', () => {
  let orchestrator: ApexOrchestrator;
  let taskInspector: TaskInspector;
  let tempDir: string;
  let consoleSpy: any;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), 'apex-inspector-test-'));

    // Create basic APEX config for testing
    const config: ApexConfig = {
      version: '0.6.0',
      features: {
        multimodal: true,
        streaming: true,
        templates: true,
        worktrees: false
      },
      workspace: {
        isolation: 'none'
      },
      agents: {
        'inspector-agent': {
          name: 'Inspector Test Agent',
          description: 'Agent for testing task inspection',
          system: 'You are a task inspector test agent.',
          tools: []
        }
      },
      workflows: {
        'feature': {
          name: 'Feature Development',
          description: 'Standard feature development workflow',
          stages: ['planning', 'implementation', 'testing', 'review'],
          agents: {
            planning: 'inspector-agent',
            implementation: 'inspector-agent',
            testing: 'inspector-agent',
            review: 'inspector-agent'
          }
        }
      },
      limits: {
        maxConcurrentTasks: 3,
        dailyTaskLimit: 50,
        sessionTokenLimit: 100000
      }
    };

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir
    });

    await orchestrator.initialize(config);

    // Initialize task inspector
    taskInspector = new TaskInspector(orchestrator);

    // Setup console spy
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Clean up console spy
    consoleSpy.mockRestore();

    // Clean up orchestrator and temp directory
    await orchestrator.shutdown();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Comprehensive View Inspection', () => {
    test('should display complete task information in comprehensive view', async () => {
      const task = await orchestrator.createTask({
        description: 'Comprehensive inspection test task',
        workflow: 'feature',
        priority: 'high',
        effort: 'large',
        autonomy: 'medium',
        acceptanceCriteria: 'Must include unit tests, integration tests, and documentation'
      });

      // Add usage data to test formatting
      await orchestrator.store.updateTask(task.id, {
        status: 'in-progress',
        currentStage: 'implementation',
        usage: {
          totalTokens: 15420,
          inputTokens: 8350,
          outputTokens: 7070,
          estimatedCost: 0.0234
        }
      });

      // Add artifacts and logs
      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'main.js',
        path: 'src/main.js',
        content: 'const app = () => { return "Hello World"; };'
      });

      await orchestrator.store.addTaskLog(task.id, {
        level: 'info',
        message: 'Implementation started',
        stage: 'implementation',
        agent: 'inspector-agent'
      });

      // Test comprehensive view (no options = comprehensive)
      await taskInspector.inspectTask(task.id);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      // Verify all sections are present
      expect(output).toContain('📋 Task Inspection');
      expect(output).toContain(task.id);
      expect(output).toContain('🔄 IN-PROGRESS'); // Status with emoji
      expect(output).toContain('📝 Details');
      expect(output).toContain('Comprehensive inspection test task');
      expect(output).toContain('feature');
      expect(output).toContain('high');
      expect(output).toContain('large');
      expect(output).toContain('medium');
      expect(output).toContain('Must include unit tests, integration tests, and documentation');
      expect(output).toContain('implementation');

      // Verify usage section
      expect(output).toContain('💰 Usage & Cost');
      expect(output).toContain('15,420'); // Token formatting
      expect(output).toContain('8,350');
      expect(output).toContain('7,070');
      expect(output).toContain('$0.02'); // Cost formatting

      // Verify timeline section
      expect(output).toContain('⏱️  Timeline');
      expect(output).toContain('Created:');
      expect(output).toContain('Updated:');

      // Verify quick summary
      expect(output).toContain('📎 Quick Summary');
      expect(output).toContain('Artifacts: 1 items');
      expect(output).toContain('Log Entries: 1 entries');

      // Verify help text
      expect(output).toContain('💡 Use specific options for detailed views');
    });

    test('should handle tasks with complex relationships and metadata', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent task with complex relationships'
      });

      // Create dependent task
      const dependentTask = await orchestrator.createTask({
        description: 'Dependent task',
        dependsOn: [parentTask.id],
        parentTaskId: parentTask.id
      });

      // Update parent to reference subtask
      await orchestrator.store.updateTask(parentTask.id, {
        subtaskIds: [dependentTask.id],
        branchName: 'feature/complex-relationships',
        prUrl: 'https://github.com/repo/pull/123'
      });

      await taskInspector.inspectTask(parentTask.id);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      // Verify dependency section
      expect(output).toContain('🔗 Dependencies & Subtasks');
      expect(output).toContain('Subtasks:');
      expect(output).toContain(dependentTask.id);

      // Verify git info section
      expect(output).toContain('🌿 Git Info');
      expect(output).toContain('Branch: feature/complex-relationships');
      expect(output).toContain('Pull Request: https://github.com/repo/pull/123');
    });

    test('should display error information when task has errors', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with error for testing'
      });

      await orchestrator.store.updateTask(task.id, {
        status: 'failed',
        error: 'Compilation failed: syntax error in main.js at line 42'
      });

      await taskInspector.inspectTask(task.id);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('❌ Error');
      expect(output).toContain('Compilation failed: syntax error in main.js at line 42');
    });

    test('should show paused task information correctly', async () => {
      const task = await orchestrator.createTask({
        description: 'Paused task test'
      });

      const pauseTime = new Date();
      await orchestrator.store.updateTask(task.id, {
        status: 'paused',
        pausedAt: pauseTime,
        pauseReason: 'Waiting for external dependency'
      });

      await taskInspector.inspectTask(task.id);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('⏸️ PAUSED');
      expect(output).toContain('Paused:');
      expect(output).toContain('Pause Reason: Waiting for external dependency');
    });

    test('should calculate and display duration for completed tasks', async () => {
      const task = await orchestrator.createTask({
        description: 'Completed task duration test'
      });

      const completedTime = new Date(task.createdAt.getTime() + 3600000); // 1 hour later
      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        completedAt: completedTime
      });

      await taskInspector.inspectTask(task.id);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('Completed:');
      expect(output).toContain('Duration:');
      expect(output).toContain('1h'); // Should format duration nicely
    });
  });

  describe('Specific Option Inspections', () => {
    test('should display modified files with proper formatting', async () => {
      const task = await orchestrator.createTask({
        description: 'Files inspection test'
      });

      // Add multiple file artifacts
      const files = [
        { name: 'component.jsx', path: 'src/components/component.jsx' },
        { name: 'styles.css', path: 'src/styles/styles.css' },
        { name: 'test.spec.js', path: 'tests/component.test.spec.js' }
      ];

      for (const file of files) {
        await orchestrator.store.addTaskArtifact(task.id, {
          type: 'file',
          name: file.name,
          path: file.path,
          content: `// Content for ${file.name}`
        });
      }

      await taskInspector.inspectTask(task.id, { files: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📁 Modified Files for Task');
      expect(output).toContain('📄 src/components/component.jsx');
      expect(output).toContain('📄 src/styles/styles.css');
      expect(output).toContain('📄 tests/component.test.spec.js');
      expect(output).toContain('Modified:');
      expect(output).toContain('📊 Total: 3 files modified');
    });

    test('should handle empty file list gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Empty files test'
      });

      await taskInspector.inspectTask(task.id, { files: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📁 Modified Files for Task');
      expect(output).toContain('No file modifications found');
    });

    test('should display specific file content with proper formatting', async () => {
      const task = await orchestrator.createTask({
        description: 'File content inspection test'
      });

      const fileContent = `function hello() {
  console.log("Hello, World!");
  return "success";
}

module.exports = hello;`;

      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'hello.js',
        path: 'src/hello.js',
        content: fileContent
      });

      await taskInspector.inspectTask(task.id, { file: 'src/hello.js' });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📄 File Content: src/hello.js');
      expect(output).toContain('─'.repeat(60)); // Separator lines
      expect(output).toContain('function hello()');
      expect(output).toContain('console.log("Hello, World!");');
      expect(output).toContain('module.exports = hello;');
    });

    test('should handle missing file requests gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Missing file test'
      });

      await taskInspector.inspectTask(task.id, { file: 'non-existent.js' });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('File not found in task artifacts: non-existent.js');
    });

    test('should create comprehensive execution timeline', async () => {
      const task = await orchestrator.createTask({
        description: 'Timeline inspection test'
      });

      // Add logs at different times
      const baseTime = Date.now();
      const logs = [
        { message: 'Task started', level: 'info', stage: 'planning', timestamp: new Date(baseTime) },
        { message: 'Planning completed', level: 'info', stage: 'planning', timestamp: new Date(baseTime + 1000) },
        { message: 'Implementation began', level: 'info', stage: 'implementation', timestamp: new Date(baseTime + 2000) },
        { message: 'Minor issue encountered', level: 'warn', stage: 'implementation', timestamp: new Date(baseTime + 3000) },
        { message: 'Issue resolved', level: 'info', stage: 'implementation', timestamp: new Date(baseTime + 4000) }
      ];

      for (const log of logs) {
        await orchestrator.store.addTaskLog(task.id, log);
      }

      // Add a checkpoint
      await orchestrator.store.createCheckpoint(task.id, {
        checkpointId: 'checkpoint-1',
        stage: 'implementation',
        stageIndex: 1,
        conversationState: [],
        metadata: { description: 'Mid-implementation checkpoint' }
      });

      // Update task with completion
      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date(baseTime + 5000)
      });

      await taskInspector.inspectTask(task.id, { timeline: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('⏱️  Execution Timeline for Task');
      expect(output).toContain('Task created');
      expect(output).toContain('[planning] Task started');
      expect(output).toContain('[planning] Planning completed');
      expect(output).toContain('[implementation] Implementation began');
      expect(output).toContain('⚠️'); // Warning emoji for warn level
      expect(output).toContain('Minor issue encountered');
      expect(output).toContain('🏁'); // Checkpoint emoji
      expect(output).toContain('Checkpoint created');
      expect(output).toContain('Task completed');
      expect(output).toContain('📊 Total events:');
    });

    test('should display generated documentation artifacts', async () => {
      const task = await orchestrator.createTask({
        description: 'Documentation inspection test'
      });

      // Add various documentation artifacts
      const docArtifacts = [
        {
          type: 'report',
          name: 'Implementation Report',
          path: 'docs/implementation.md',
          content: '# Implementation Report\n\nThis document describes the implementation approach.'
        },
        {
          type: 'file',
          name: 'README.md',
          path: 'README.md',
          content: '# Project README\n\nThis is the main project documentation.'
        },
        {
          type: 'file',
          name: 'api-docs.md',
          path: 'docs/api.md',
          content: '# API Documentation\n\nAPI endpoint documentation.'
        }
      ];

      for (const artifact of docArtifacts) {
        await orchestrator.store.addTaskArtifact(task.id, artifact);
      }

      await taskInspector.inspectTask(task.id, { docs: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📚 Generated Documentation for Task');
      expect(output).toContain('📖 Implementation Report');
      expect(output).toContain('Path: docs/implementation.md');
      expect(output).toContain('📖 README.md');
      expect(output).toContain('📖 api-docs.md');
      expect(output).toContain('Content:');
      expect(output).toContain('lines');
      expect(output).toContain('📊 Total documentation artifacts: 3');
    });

    test('should display task logs with proper formatting and metadata', async () => {
      const task = await orchestrator.createTask({
        description: 'Logs inspection test'
      });

      // Add logs with various levels and metadata
      const logs = [
        {
          level: 'info',
          message: 'Task initialization completed',
          stage: 'planning',
          agent: 'inspector-agent',
          metadata: { duration: 120, files_processed: 5 }
        },
        {
          level: 'warn',
          message: 'Deprecated API usage detected',
          stage: 'implementation',
          agent: 'inspector-agent',
          metadata: { api: 'old-function', replacement: 'new-function' }
        },
        {
          level: 'error',
          message: 'Test failure in unit tests',
          stage: 'testing',
          agent: 'inspector-agent'
        },
        {
          level: 'debug',
          message: 'Debug: Variable state at checkpoint',
          stage: 'implementation'
        }
      ];

      for (const log of logs) {
        await orchestrator.store.addTaskLog(task.id, log);
      }

      await taskInspector.inspectTask(task.id, { logs: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📝 Task Logs for:');
      expect(output).toContain('ℹ️'); // Info emoji
      expect(output).toContain('⚠️'); // Warning emoji
      expect(output).toContain('❌'); // Error emoji
      expect(output).toContain('🔍'); // Debug emoji
      expect(output).toContain('[planning]');
      expect(output).toContain('[implementation]');
      expect(output).toContain('[testing]');
      expect(output).toContain('{inspector-agent}');
      expect(output).toContain('Task initialization completed');
      expect(output).toContain('Deprecated API usage detected');
      expect(output).toContain('Test failure in unit tests');
      expect(output).toContain('Metadata:');
      expect(output).toContain('duration');
      expect(output).toContain('files_processed');
      expect(output).toContain('📊 Total log entries: 4');
    });

    test('should display task artifacts grouped by type', async () => {
      const task = await orchestrator.createTask({
        description: 'Artifacts inspection test'
      });

      // Add artifacts of different types
      const artifacts = [
        { type: 'file', name: 'main.js', content: 'console.log("main");' },
        { type: 'file', name: 'helper.js', content: 'export const helper = () => {};' },
        { type: 'diff', name: 'changes.diff', content: '--- a/file.js\n+++ b/file.js\n@@ -1 +1,2 @@' },
        { type: 'report', name: 'analysis.md', content: '# Analysis Report\nDetailed analysis...' },
        { type: 'log', name: 'execution.log', content: 'INFO: Starting process\nINFO: Completed' }
      ];

      for (const artifact of artifacts) {
        await orchestrator.store.addTaskArtifact(task.id, artifact);
      }

      await taskInspector.inspectTask(task.id, { artifacts: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📎 Task Artifacts for:');
      expect(output).toContain('📄 FILE (2):'); // File type with count
      expect(output).toContain('📊 DIFF (1):');
      expect(output).toContain('📋 REPORT (1):');
      expect(output).toContain('📝 LOG (1):');
      expect(output).toContain('main.js');
      expect(output).toContain('helper.js');
      expect(output).toContain('changes.diff');
      expect(output).toContain('analysis.md');
      expect(output).toContain('execution.log');
      expect(output).toContain('Size:');
      expect(output).toContain('characters');
      expect(output).toContain('📊 Total artifacts: 5');
    });

    test('should display task checkpoints with detailed information', async () => {
      const task = await orchestrator.createTask({
        description: 'Checkpoints inspection test'
      });

      // Create multiple checkpoints
      const checkpoints = [
        {
          checkpointId: 'checkpoint-planning-complete',
          stage: 'planning',
          stageIndex: 0,
          conversationState: [
            { role: 'user', content: 'Please implement feature X' },
            { role: 'assistant', content: 'I will implement feature X step by step' }
          ],
          metadata: { phase: 'planning-complete', files_analyzed: 12 }
        },
        {
          checkpointId: 'checkpoint-implementation-mid',
          stage: 'implementation',
          stageIndex: 1,
          conversationState: [
            { role: 'user', content: 'Add error handling' },
            { role: 'assistant', content: 'Adding comprehensive error handling' }
          ],
          metadata: { phase: 'implementation-mid', lines_added: 250 }
        }
      ];

      for (const checkpoint of checkpoints) {
        await orchestrator.store.createCheckpoint(task.id, checkpoint);
      }

      await taskInspector.inspectTask(task.id, { checkpoints: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('🏁 Task Checkpoints for:');
      expect(output).toContain('checkpoint-planning-complete');
      expect(output).toContain('checkpoint-implementation-mid');
      expect(output).toContain('Stage: planning (Index: 0)');
      expect(output).toContain('Stage: implementation (Index: 1)');
      expect(output).toContain('Conversation Messages: 2');
      expect(output).toContain('Metadata:');
      expect(output).toContain('files_analyzed');
      expect(output).toContain('lines_added');
      expect(output).toContain('📊 Total checkpoints: 2');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle non-existent task gracefully', async () => {
      await taskInspector.inspectTask('non-existent-task-id');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('Task not found: non-existent-task-id');
    });

    test('should handle tasks with minimal data', async () => {
      const task = await orchestrator.createTask({
        description: 'Minimal task'
      });

      await taskInspector.inspectTask(task.id);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📋 Task Inspection');
      expect(output).toContain('Minimal task');
      expect(output).toContain('Artifacts: 0 items');
      expect(output).toContain('Log Entries: 0 entries');
    });

    test('should handle empty timeline requests', async () => {
      const task = await orchestrator.createTask({
        description: 'Empty timeline task'
      });

      await taskInspector.inspectTask(task.id, { timeline: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('⏱️  Execution Timeline for Task');
      expect(output).toContain('Task created'); // Should at least show task creation
    });

    test('should handle empty logs gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'No logs task'
      });

      await taskInspector.inspectTask(task.id, { logs: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📝 Task Logs for:');
      expect(output).toContain('No logs found');
    });

    test('should handle empty artifacts list', async () => {
      const task = await orchestrator.createTask({
        description: 'No artifacts task'
      });

      await taskInspector.inspectTask(task.id, { artifacts: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📎 Task Artifacts for:');
      expect(output).toContain('No artifacts found');
    });

    test('should handle empty checkpoints list', async () => {
      const task = await orchestrator.createTask({
        description: 'No checkpoints task'
      });

      await taskInspector.inspectTask(task.id, { checkpoints: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('🏁 Task Checkpoints for:');
      expect(output).toContain('No checkpoints found');
    });

    test('should handle empty documentation artifacts', async () => {
      const task = await orchestrator.createTask({
        description: 'No docs task'
      });

      // Add non-documentation artifacts
      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'code.js',
        content: 'console.log("code");'
      });

      await taskInspector.inspectTask(task.id, { docs: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📚 Generated Documentation for Task');
      expect(output).toContain('No documentation artifacts found');
    });
  });

  describe('Performance and Large Data Handling', () => {
    test('should handle tasks with large numbers of artifacts efficiently', async () => {
      const task = await orchestrator.createTask({
        description: 'Large artifacts performance test'
      });

      // Add many artifacts
      const startTime = Date.now();

      const artifacts = Array.from({ length: 100 }, (_, i) => ({
        type: 'file',
        name: `file${i}.js`,
        path: `src/file${i}.js`,
        content: `// File ${i}\n` + 'x'.repeat(1000) // Simulate larger content
      }));

      for (const artifact of artifacts) {
        await orchestrator.store.addTaskArtifact(task.id, artifact);
      }

      const setupTime = Date.now() - startTime;

      // Test inspection performance
      const inspectStart = Date.now();
      await taskInspector.inspectTask(task.id, { artifacts: true });
      const inspectTime = Date.now() - inspectStart;

      // Performance should be reasonable
      expect(setupTime).toBeLessThan(10000); // 10 seconds for setup
      expect(inspectTime).toBeLessThan(2000); // 2 seconds for inspection

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('FILE (100):');
      expect(output).toContain('Total artifacts: 100');
    });

    test('should handle tasks with many log entries efficiently', async () => {
      const task = await orchestrator.createTask({
        description: 'Large logs performance test'
      });

      // Add many log entries
      const logs = Array.from({ length: 500 }, (_, i) => ({
        level: ['info', 'warn', 'error', 'debug'][i % 4] as any,
        message: `Log entry ${i} with detailed message about operation ${i}`,
        stage: ['planning', 'implementation', 'testing', 'review'][i % 4],
        agent: 'inspector-agent',
        timestamp: new Date(Date.now() + i * 100)
      }));

      for (const log of logs) {
        await orchestrator.store.addTaskLog(task.id, log);
      }

      const inspectStart = Date.now();
      await taskInspector.inspectTask(task.id, { logs: true });
      const inspectTime = Date.now() - inspectStart;

      // Should complete within reasonable time
      expect(inspectTime).toBeLessThan(3000); // 3 seconds

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Total log entries: 500');
    });

    test('should handle complex timeline with many events efficiently', async () => {
      const task = await orchestrator.createTask({
        description: 'Complex timeline performance test'
      });

      // Add many logs and checkpoints
      const baseTime = Date.now();

      // Add logs
      for (let i = 0; i < 200; i++) {
        await orchestrator.store.addTaskLog(task.id, {
          level: 'info',
          message: `Event ${i}`,
          stage: 'implementation',
          timestamp: new Date(baseTime + i * 100)
        });
      }

      // Add checkpoints
      for (let i = 0; i < 10; i++) {
        await orchestrator.store.createCheckpoint(task.id, {
          checkpointId: `checkpoint-${i}`,
          stage: 'implementation',
          stageIndex: i,
          conversationState: [],
          metadata: { checkpoint: i }
        });
      }

      const inspectStart = Date.now();
      await taskInspector.inspectTask(task.id, { timeline: true });
      const inspectTime = Date.now() - inspectStart;

      expect(inspectTime).toBeLessThan(5000); // 5 seconds

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Total events:');
    });
  });

  describe('Output Formatting and Display Logic', () => {
    test('should format status emojis correctly for all task statuses', async () => {
      const statuses = [
        { status: 'pending', emoji: '⏳' },
        { status: 'in-progress', emoji: '🔄' },
        { status: 'completed', emoji: '✅' },
        { status: 'failed', emoji: '❌' },
        { status: 'paused', emoji: '⏸️' },
        { status: 'cancelled', emoji: '🚫' }
      ];

      for (const { status, emoji } of statuses) {
        const task = await orchestrator.createTask({
          description: `${status} status test`
        });

        await orchestrator.store.updateTask(task.id, { status: status as any });

        consoleSpy.mockClear();
        await taskInspector.inspectTask(task.id);

        const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
        expect(output).toContain(`${emoji} ${status.toUpperCase()}`);
      }
    });

    test('should format usage numbers with proper thousands separators', async () => {
      const task = await orchestrator.createTask({
        description: 'Number formatting test'
      });

      await orchestrator.store.updateTask(task.id, {
        usage: {
          totalTokens: 1234567,
          inputTokens: 654321,
          outputTokens: 580246,
          estimatedCost: 12.3456
        }
      });

      await taskInspector.inspectTask(task.id);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('1,234,567'); // Total tokens with commas
      expect(output).toContain('654,321'); // Input tokens
      expect(output).toContain('580,246'); // Output tokens
      expect(output).toContain('$12.35'); // Cost rounded to 2 decimal places
    });

    test('should handle very large content sizes gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Large content test'
      });

      const largeContent = 'x'.repeat(50000); // 50KB content

      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'large-file.txt',
        path: 'data/large-file.txt',
        content: largeContent
      });

      await taskInspector.inspectTask(task.id, { file: 'data/large-file.txt' });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('📄 File Content: data/large-file.txt');
      expect(output).toContain('─'.repeat(60));
      // Content should be displayed even if large
      expect(output).toContain('x'.repeat(100)); // At least some of the content
    });
  });
});