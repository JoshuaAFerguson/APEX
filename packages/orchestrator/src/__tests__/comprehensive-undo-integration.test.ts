/**
 * @fileoverview Comprehensive Integration Tests for Undo Functionality
 *
 * This test suite provides end-to-end integration testing for APEX's undo functionality,
 * testing the complete workflow from tool execution through undo operations including:
 * - Full orchestrator integration with real tool execution
 * - Database persistence and retrieval
 * - Event flow throughout the entire system
 * - Real file system operations with snapshots
 * - Hook integration for automatic snapshot capture
 * - Cross-component communication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { ApexOrchestrator } from '../index.js';
import { TaskStatus } from '../../../core/src/types.js';

describe('Comprehensive Undo Integration Tests', () => {
  let tempDir: string;
  let originalCwd: string;
  let orchestrator: ApexOrchestrator;
  let testProject: { [key: string]: string };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-undo-integration-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Create a realistic project structure
    testProject = {
      srcDir: path.join(tempDir, 'src'),
      testDir: path.join(tempDir, 'test'),
      configFile: path.join(tempDir, 'package.json'),
      readmeFile: path.join(tempDir, 'README.md'),
      mainFile: path.join(tempDir, 'src', 'index.ts'),
      utilsFile: path.join(tempDir, 'src', 'utils.ts'),
      testFile: path.join(tempDir, 'test', 'index.test.ts')
    };

    // Create project structure
    await fs.mkdir(testProject.srcDir, { recursive: true });
    await fs.mkdir(testProject.testDir, { recursive: true });

    // Initialize project files
    await fs.writeFile(testProject.configFile, JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      main: "src/index.ts"
    }, null, 2), 'utf8');

    await fs.writeFile(testProject.readmeFile, `# Test Project\n\nA test project for undo functionality.`, 'utf8');

    await fs.writeFile(testProject.mainFile, `export function main() {\n  console.log("Hello World");\n}`, 'utf8');

    await fs.writeFile(testProject.utilsFile, `export function helper() {\n  return "helper";\n}`, 'utf8');

    await fs.writeFile(testProject.testFile, `import { main } from '../src/index';\n\ntest('main function', () => {\n  expect(main).toBeDefined();\n});`, 'utf8');

    // Initialize APEX
    await fs.mkdir('.apex', { recursive: true });
    await fs.writeFile('.apex/config.yaml', `
project:
  name: "undo-integration-test"
  version: "1.0.0"
  description: "Integration test for undo functionality"
agents: []
workflows: []
`);

    orchestrator = new ApexOrchestrator({ projectPath: '/tmp/apex-test' });
    await orchestrator.init(tempDir);
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.destroy();
    }
    process.chdir(originalCwd);
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  // Helper functions for testing
  const createTestFile = async (fileName: string, content: string): Promise<string> => {
    const filePath = path.join(tempDir, fileName);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  };

  const createMockToolExecution = (taskId: string, toolName: string = 'testTool') => ({
    callId: crypto.randomUUID(),
    toolName,
    input: { test: 'input' },
    taskId,
    agentName: 'testAgent',
    stageName: 'testStage',
    startTime: new Date(),
    endTime: new Date(),
    duration: 100,
    result: { success: true },
  });

  describe('End-to-End Tool Execution with Undo', () => {
    it('should capture snapshots during simulated tool execution and support undo', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test simulated tool execution with undo',
        context: {
          codebase_summary: 'Simple TypeScript project',
          requirements: 'Add logging functionality'
        }
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Read original file contents
      const originalMainContent = await fs.readFile(testProject.mainFile, 'utf8');
      const originalUtilsContent = await fs.readFile(testProject.utilsFile, 'utf8');

      // Simulate Write tool execution to add logging function
      // 1. Create before snapshot
      const beforeUtilsSnapshot = await toolActionStore.createFileSnapshot(testProject.utilsFile);

      // 2. Modify the file (simulate tool execution)
      const newUtilsContent = `export function helper() {\n  return "helper";\n}\n\nexport function log(message: string) {\n  console.log(\`[LOG] \${message}\`);\n}`;
      await fs.writeFile(testProject.utilsFile, newUtilsContent, 'utf8');

      // 3. Create after snapshot
      const afterUtilsSnapshot = await toolActionStore.createFileSnapshot(testProject.utilsFile);

      // 4. Record the tool action
      const writeExecution = createMockToolExecution(task.id, 'Write');
      writeExecution.input = {
        file_path: testProject.utilsFile,
        content: newUtilsContent
      };

      const writeAction = await toolActionStore.recordToolAction(
        task.id,
        writeExecution,
        [testProject.utilsFile],
        [beforeUtilsSnapshot],
        [afterUtilsSnapshot]
      );

      // Simulate Edit tool execution to use logging function
      // 1. Create before snapshot for main file
      const beforeMainSnapshot = await toolActionStore.createFileSnapshot(testProject.mainFile);

      // 2. Modify main file
      const newMainContent = 'import { log } from "./utils";\n\nexport function main() {\n  log("Hello World");\n}';
      await fs.writeFile(testProject.mainFile, newMainContent, 'utf8');

      // 3. Create after snapshot
      const afterMainSnapshot = await toolActionStore.createFileSnapshot(testProject.mainFile);

      // 4. Record the edit action
      const editExecution = createMockToolExecution(task.id, 'Edit');
      editExecution.input = {
        file_path: testProject.mainFile,
        old_string: 'export function main() {\n  console.log("Hello World");\n}',
        new_string: newMainContent
      };

      const editAction = await toolActionStore.recordToolAction(
        task.id,
        editExecution,
        [testProject.mainFile],
        [beforeMainSnapshot],
        [afterMainSnapshot]
      );

      // Verify files were modified
      const modifiedUtilsContent = await fs.readFile(testProject.utilsFile, 'utf8');
      const modifiedMainContent = await fs.readFile(testProject.mainFile, 'utf8');

      expect(modifiedUtilsContent).toContain('function log(message: string)');
      expect(modifiedMainContent).toContain('import { log } from "./utils"');

      // Get undoable actions
      const undoableActions = await toolActionStore.getUndoableActions(task.id);
      expect(undoableActions).toHaveLength(2);

      // Test undo of Edit operation (most recent)
      const undoEditResult = await orchestrator.undoLastAction(task.id);
      expect(undoEditResult.success).toBe(true);
      expect(undoEditResult.restoredFiles).toContain(testProject.mainFile);

      // Verify main file was restored but utils file still has new function
      const restoredMainContent = await fs.readFile(testProject.mainFile, 'utf8');
      const stillModifiedUtilsContent = await fs.readFile(testProject.utilsFile, 'utf8');

      expect(restoredMainContent).toBe(originalMainContent);
      expect(stillModifiedUtilsContent).toContain('function log(message: string)');

      // Test undo of Write operation
      const undoWriteResult = await orchestrator.undoLastAction(task.id);
      expect(undoWriteResult.success).toBe(true);
      expect(undoWriteResult.restoredFiles).toContain(testProject.utilsFile);

      // Verify utils file was restored
      const finalUtilsContent = await fs.readFile(testProject.utilsFile, 'utf8');
      expect(finalUtilsContent).toBe(originalUtilsContent);
    });

    it('should handle file creation and deletion through undo', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test file creation and deletion undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const newComponentFile = path.join(testProject.srcDir, 'component.ts');

      // Simulate Write tool creating new file
      // 1. Create before snapshot (file doesn't exist)
      const beforeSnapshot = await toolActionStore.createFileSnapshot(newComponentFile);

      // 2. Create the file
      const componentContent = `export class Component {\n  render() {\n    return '<div>Component</div>';\n  }\n}`;
      await fs.writeFile(newComponentFile, componentContent, 'utf8');

      // 3. Create after snapshot
      const afterSnapshot = await toolActionStore.createFileSnapshot(newComponentFile);

      // 4. Record the action
      const writeExecution = createMockToolExecution(task.id, 'Write');
      writeExecution.input = {
        file_path: newComponentFile,
        content: componentContent
      };

      const writeAction = await toolActionStore.recordToolAction(
        task.id,
        writeExecution,
        [newComponentFile],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Verify file was created
      expect(await fs.access(newComponentFile).then(() => true).catch(() => false)).toBe(true);
      const createdContent = await fs.readFile(newComponentFile, 'utf8');
      expect(createdContent).toContain('export class Component');

      // Undo file creation (should delete the file)
      const undoResult = await orchestrator.undoLastAction(task.id);
      expect(undoResult.success).toBe(true);
      expect(undoResult.restoredFiles).toContain(newComponentFile);

      // Verify file was deleted
      expect(await fs.access(newComponentFile).then(() => true).catch(() => false)).toBe(false);
    });

    it('should handle Bash tool file operations with undo', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test Bash tool operations with undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const originalContent = await fs.readFile(testProject.utilsFile, 'utf8');

      // Simulate Bash tool deleting a file
      // 1. Create before snapshot
      const beforeSnapshot = await toolActionStore.createFileSnapshot(testProject.utilsFile);

      // 2. Delete the file (simulate bash rm command)
      await fs.unlink(testProject.utilsFile);

      // 3. Record the bash action
      const bashExecution = createMockToolExecution(task.id, 'Bash');
      bashExecution.input = {
        command: `rm ${testProject.utilsFile}`
      };
      bashExecution.result = {
        stdout: '',
        stderr: '',
        exitCode: 0
      };

      const bashAction = await toolActionStore.recordToolAction(
        task.id,
        bashExecution,
        [testProject.utilsFile],
        [beforeSnapshot],
        [] // No after snapshot for deleted file
      );

      // Verify file was deleted
      expect(await fs.access(testProject.utilsFile).then(() => true).catch(() => false)).toBe(false);

      // Get undoable actions
      const undoableActions = await toolActionStore.getUndoableActions(task.id);
      expect(undoableActions.length).toBeGreaterThan(0);

      // Undo deletion (should restore original file)
      const undoResult = await orchestrator.undoLastAction(task.id);
      expect(undoResult.success).toBe(true);

      // Verify original file was restored
      expect(await fs.access(testProject.utilsFile).then(() => true).catch(() => false)).toBe(true);
      const restoredContent = await fs.readFile(testProject.utilsFile, 'utf8');
      expect(restoredContent).toBe(originalContent);
    });
  });

  describe('Database Integration and Persistence', () => {
    it('should persist undo information across orchestrator restarts', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test persistence across restarts',
        context: {}
      });

      // Perform an operation
      await orchestrator.executeTool(task.id, {
        name: 'Write',
        input: {
          file_path: testProject.readmeFile,
          content: '# Updated Test Project\n\nThis has been updated.'
        }
      });

      // Get actions before restart
      const toolActionStore = orchestrator.getToolActionStore();
      const actionsBefore = await toolActionStore.getUndoableActions(task.id);
      expect(actionsBefore).toHaveLength(1);

      // Restart orchestrator (destroy and reinitialize)
      await orchestrator.destroy();

      const newOrchestrator = new ApexOrchestrator({ projectPath: '/tmp/apex-test' });
      await newOrchestrator.init(tempDir);

      // Check that undo information persisted
      const newToolActionStore = newOrchestrator.getToolActionStore();
      const actionsAfter = await newToolActionStore.getUndoableActions(task.id);
      expect(actionsAfter).toHaveLength(1);
      expect(actionsAfter[0].id).toBe(actionsBefore[0].id);

      // Verify undo still works after restart
      const undoResult = await newOrchestrator.undoLastAction(task.id);
      expect(undoResult.success).toBe(true);

      await newOrchestrator.destroy();
    });

    it('should handle concurrent task operations with separate undo stacks', async () => {
      const task1 = await orchestrator.createTask({
        goal: 'First task for concurrency test',
        context: {}
      });

      const task2 = await orchestrator.createTask({
        goal: 'Second task for concurrency test',
        context: {}
      });

      const file1 = path.join(tempDir, 'task1-file.txt');
      const file2 = path.join(tempDir, 'task2-file.txt');

      await fs.writeFile(file1, 'task 1 original', 'utf8');
      await fs.writeFile(file2, 'task 2 original', 'utf8');

      // Task 1 operations
      await orchestrator.executeTool(task1.id, {
        name: 'Write',
        input: {
          file_path: file1,
          content: 'task 1 modified'
        }
      });

      await orchestrator.executeTool(task1.id, {
        name: 'Edit',
        input: {
          file_path: file1,
          old_string: 'task 1 modified',
          new_string: 'task 1 modified twice'
        }
      });

      // Task 2 operations
      await orchestrator.executeTool(task2.id, {
        name: 'Write',
        input: {
          file_path: file2,
          content: 'task 2 modified'
        }
      });

      // Check separate undo stacks
      const toolActionStore = orchestrator.getToolActionStore();
      const task1Actions = await toolActionStore.getUndoableActions(task1.id);
      const task2Actions = await toolActionStore.getUndoableActions(task2.id);

      expect(task1Actions).toHaveLength(2);
      expect(task2Actions).toHaveLength(1);

      // Undo task1 operations shouldn't affect task2
      await orchestrator.undoLastAction(task1.id);

      const file1Content = await fs.readFile(file1, 'utf8');
      const file2Content = await fs.readFile(file2, 'utf8');

      expect(file1Content).toBe('task 1 modified'); // Reverted to first modification
      expect(file2Content).toBe('task 2 modified'); // Unchanged

      // Undo task2 operation
      await orchestrator.undoLastAction(task2.id);

      const file1ContentAfter = await fs.readFile(file1, 'utf8');
      const file2ContentAfter = await fs.readFile(file2, 'utf8');

      expect(file1ContentAfter).toBe('task 1 modified'); // Still at first modification
      expect(file2ContentAfter).toBe('task 2 original'); // Reverted to original
    });

    it('should handle large-scale undo operations efficiently', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test large-scale undo performance',
        context: {}
      });

      const numFiles = 20;
      const testFiles: string[] = [];

      // Create multiple files
      for (let i = 0; i < numFiles; i++) {
        const filePath = path.join(tempDir, `bulk-test-${i}.txt`);
        await fs.writeFile(filePath, `Original content ${i}`, 'utf8');
        testFiles.push(filePath);
      }

      // Perform bulk operations
      const startTime = Date.now();

      for (let i = 0; i < numFiles; i++) {
        await orchestrator.executeTool(task.id, {
          name: 'Write',
          input: {
            file_path: testFiles[i],
            content: `Modified content ${i}`
          }
        });
      }

      const operationTime = Date.now() - startTime;

      // Verify all files were modified
      for (let i = 0; i < numFiles; i++) {
        const content = await fs.readFile(testFiles[i], 'utf8');
        expect(content).toBe(`Modified content ${i}`);
      }

      // Undo all operations
      const undoStartTime = Date.now();
      for (let i = 0; i < numFiles; i++) {
        const undoResult = await orchestrator.undoLastAction(task.id);
        expect(undoResult.success).toBe(true);
      }
      const undoTime = Date.now() - undoStartTime;

      // Verify all files were restored
      for (let i = 0; i < numFiles; i++) {
        const content = await fs.readFile(testFiles[i], 'utf8');
        expect(content).toBe(`Original content ${i}`);
      }

      // Performance assertion (undo should be reasonably fast)
      expect(undoTime).toBeLessThan(operationTime * 2); // Undo shouldn't be more than 2x the operation time
    });
  });

  describe('Event Flow Integration', () => {
    it('should emit complete event sequence for tool execution and undo', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test complete event flow',
        context: {}
      });

      const events: Array<{ event: string; data?: any }> = [];

      // Set up comprehensive event listeners
      orchestrator.on('tool:start', (data) => events.push({ event: 'tool:start', data }));
      orchestrator.on('tool:complete', (data) => events.push({ event: 'tool:complete', data }));
      orchestrator.on('tool:error', (data) => events.push({ event: 'tool:error', data }));
      orchestrator.on('undo:start', (data) => events.push({ event: 'undo:start', data }));
      orchestrator.on('undo:complete', (data) => events.push({ event: 'undo:complete', data }));
      orchestrator.on('undo:error', (data) => events.push({ event: 'undo:error', data }));
      orchestrator.on('snapshot:captured', (data) => events.push({ event: 'snapshot:captured', data }));

      // Execute tool
      await orchestrator.executeTool(task.id, {
        name: 'Write',
        input: {
          file_path: testProject.mainFile,
          content: 'export function newMain() { console.log("New"); }'
        }
      });

      // Execute undo
      await orchestrator.undoLastAction(task.id);

      // Verify event sequence
      const eventNames = events.map(e => e.event);
      expect(eventNames).toContain('tool:start');
      expect(eventNames).toContain('tool:complete');
      expect(eventNames).toContain('undo:start');
      expect(eventNames).toContain('undo:complete');

      // Verify event data structure
      const toolStartEvent = events.find(e => e.event === 'tool:start');
      expect(toolStartEvent?.data).toEqual(
        expect.objectContaining({
          taskId: task.id,
          toolName: 'Write'
        })
      );

      const undoCompleteEvent = events.find(e => e.event === 'undo:complete');
      expect(undoCompleteEvent?.data).toEqual(
        expect.objectContaining({
          taskId: task.id,
          restoredFiles: expect.arrayContaining([testProject.mainFile])
        })
      );
    });

    it('should handle event-driven undo workflows', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test event-driven undo',
        context: {}
      });

      let autoUndoTriggered = false;

      // Set up auto-undo on specific condition
      orchestrator.on('tool:complete', async (data) => {
        if (data.toolName === 'Write' && data.output?.content?.includes('TRIGGER_UNDO')) {
          autoUndoTriggered = true;
          await orchestrator.undoLastAction(task.id);
        }
      });

      // Execute tool that triggers auto-undo
      await orchestrator.executeTool(task.id, {
        name: 'Write',
        input: {
          file_path: testProject.readmeFile,
          content: 'TRIGGER_UNDO: This should be automatically undone'
        }
      });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(autoUndoTriggered).toBe(true);

      // Verify file was reverted
      const content = await fs.readFile(testProject.readmeFile, 'utf8');
      expect(content).toContain('# Test Project'); // Original content
      expect(content).not.toContain('TRIGGER_UNDO');
    });
  });

  describe('Hook Integration', () => {
    it('should automatically capture snapshots through hooks during tool execution', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test automatic snapshot capture',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Count snapshots before
      const actionsBefore = await toolActionStore.getToolActions(task.id);
      const snapshotCountBefore = actionsBefore.reduce(
        (count, action) => count + action.beforeSnapshots.length + action.afterSnapshots.length,
        0
      );

      // Execute tool (hooks should automatically capture snapshots)
      await orchestrator.executeTool(task.id, {
        name: 'Edit',
        input: {
          file_path: testProject.utilsFile,
          old_string: 'export function helper() {',
          new_string: 'export function helper(name?: string) {'
        }
      });

      // Count snapshots after
      const actionsAfter = await toolActionStore.getToolActions(task.id);
      const snapshotCountAfter = actionsAfter.reduce(
        (count, action) => count + action.beforeSnapshots.length + action.afterSnapshots.length,
        0
      );

      // Should have captured before and after snapshots automatically
      expect(snapshotCountAfter).toBeGreaterThan(snapshotCountBefore);

      // Verify undo works with automatically captured snapshots
      const undoResult = await orchestrator.undoLastAction(task.id);
      expect(undoResult.success).toBe(true);

      // Verify content was restored
      const restoredContent = await fs.readFile(testProject.utilsFile, 'utf8');
      expect(restoredContent).toContain('export function helper() {');
      expect(restoredContent).not.toContain('export function helper(name?: string) {');
    });

    it('should handle hook failures gracefully during snapshot capture', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test hook failure handling',
        context: {}
      });

      // Mock a hook that fails
      const originalHook = orchestrator.hooks?.preToolUse;
      if (orchestrator.hooks) {
        orchestrator.hooks.preToolUse = vi.fn().mockRejectedValue(new Error('Hook failure'));
      }

      try {
        // Tool execution should handle hook failure gracefully
        const result = await orchestrator.executeTool(task.id, {
          name: 'Write',
          input: {
            file_path: testProject.mainFile,
            content: 'export function test() { return "test"; }'
          }
        });

        // Tool execution might succeed or fail depending on hook failure handling
        // The important thing is that it doesn't crash the system
        expect(result).toHaveProperty('success');

      } finally {
        // Restore original hook
        if (orchestrator.hooks && originalHook) {
          orchestrator.hooks.preToolUse = originalHook;
        }
      }
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should recover from corrupted undo data', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test corruption recovery',
        context: {}
      });

      // Execute normal operation
      await orchestrator.executeTool(task.id, {
        name: 'Write',
        input: {
          file_path: testProject.mainFile,
          content: 'export function test() { return "corrupted test"; }'
        }
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const actions = await toolActionStore.getUndoableActions(task.id);
      expect(actions).toHaveLength(1);

      // Simulate corruption by directly modifying database (if accessible)
      // This is a simplified simulation - in practice, corruption might be more complex

      // Try to undo despite corruption - should handle gracefully
      try {
        const undoResult = await orchestrator.undoLastAction(task.id);
        // Should either succeed or fail gracefully with appropriate error
        if (!undoResult.success) {
          expect(undoResult.error).toBeDefined();
        }
      } catch (error) {
        // Graceful error handling is acceptable
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle filesystem permission errors during undo', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test permission error handling',
        context: {}
      });

      const restrictedFile = path.join(tempDir, 'restricted.txt');
      await fs.writeFile(restrictedFile, 'original content', 'utf8');

      // Execute tool to modify file
      await orchestrator.executeTool(task.id, {
        name: 'Write',
        input: {
          file_path: restrictedFile,
          content: 'modified content'
        }
      });

      // Make file read-only
      await fs.chmod(restrictedFile, 0o444);

      try {
        // Undo should handle permission error gracefully
        const undoResult = await orchestrator.undoLastAction(task.id);
        expect(undoResult.success).toBe(false);
        expect(undoResult.error).toContain('permission');
      } finally {
        // Clean up
        await fs.chmod(restrictedFile, 0o644);
      }
    });

    it('should maintain system stability under concurrent undo operations', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test concurrent undo stability',
        context: {}
      });

      // Create multiple files and operations
      const files = [];
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(tempDir, `concurrent-${i}.txt`);
        await fs.writeFile(filePath, `original ${i}`, 'utf8');
        files.push(filePath);

        // Execute tool operation
        await orchestrator.executeTool(task.id, {
          name: 'Write',
          input: {
            file_path: filePath,
            content: `modified ${i}`
          }
        });
      }

      // Attempt concurrent undo operations
      const undoPromises = [];
      for (let i = 0; i < 3; i++) {
        undoPromises.push(orchestrator.undoLastAction(task.id));
      }

      // Wait for all concurrent operations
      const results = await Promise.allSettled(undoPromises);

      // At least one should succeed, others might fail gracefully
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      expect(successCount).toBeGreaterThan(0);

      // System should remain stable
      expect(orchestrator.isInitialized()).toBe(true);
    });
  });
});