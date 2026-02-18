/**
 * @fileoverview Simplified Comprehensive Integration Tests for Undo Functionality
 *
 * This test suite provides simplified but comprehensive end-to-end integration testing
 * for APEX's undo functionality using only existing public APIs, focusing on:
 * - Database persistence and retrieval
 * - Event flow throughout the system
 * - Real file system operations with snapshots
 * - Cross-component communication
 * - Error recovery and robustness
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { ApexOrchestrator } from '../index.js';

describe('Comprehensive Undo Integration Tests (Simplified)', () => {
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
      configFile: path.join(tempDir, 'package.json'),
      mainFile: path.join(tempDir, 'src', 'index.ts'),
      utilsFile: path.join(tempDir, 'src', 'utils.ts')
    };

    // Create project structure
    await fs.mkdir(testProject.srcDir, { recursive: true });

    // Initialize project files
    await fs.writeFile(testProject.configFile, JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      main: "src/index.ts"
    }, null, 2), 'utf8');

    await fs.writeFile(testProject.mainFile, `export function main() {\n  console.log("Hello World");\n}`, 'utf8');
    await fs.writeFile(testProject.utilsFile, `export function helper() {\n  return "helper";\n}`, 'utf8');

    // Initialize APEX
    await fs.mkdir('.apex', { recursive: true });
    await fs.writeFile('.apex/config.yaml', `
project:
  name: "undo-integration-test"
  version: "1.0.0"
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

  // Helper functions
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

  describe('Database Integration and Persistence', () => {
    it('should persist undo information across orchestrator restarts', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test persistence across restarts',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Perform an operation
      const beforeSnapshot = await toolActionStore.createFileSnapshot(testProject.mainFile);
      await fs.writeFile(testProject.mainFile, '// Updated file', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(testProject.mainFile);

      const writeExecution = createMockToolExecution(task.id, 'Write');
      writeExecution.input = {
        file_path: testProject.mainFile,
        content: '// Updated file'
      };

      await toolActionStore.recordToolAction(
        task.id,
        writeExecution,
        [testProject.mainFile],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Get actions before restart
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

      const toolActionStore = orchestrator.getToolActionStore();
      const file1 = path.join(tempDir, 'task1-file.txt');
      const file2 = path.join(tempDir, 'task2-file.txt');

      await fs.writeFile(file1, 'task 1 original', 'utf8');
      await fs.writeFile(file2, 'task 2 original', 'utf8');

      // Task 1 operations
      const beforeSnapshot1a = await toolActionStore.createFileSnapshot(file1);
      await fs.writeFile(file1, 'task 1 modified', 'utf8');
      const afterSnapshot1a = await toolActionStore.createFileSnapshot(file1);

      const execution1a = createMockToolExecution(task1.id, 'Write');
      execution1a.input = { file_path: file1, content: 'task 1 modified' };

      await toolActionStore.recordToolAction(
        task1.id,
        execution1a,
        [file1],
        [beforeSnapshot1a],
        [afterSnapshot1a]
      );

      const beforeSnapshot1b = await toolActionStore.createFileSnapshot(file1);
      await fs.writeFile(file1, 'task 1 modified twice', 'utf8');
      const afterSnapshot1b = await toolActionStore.createFileSnapshot(file1);

      const execution1b = createMockToolExecution(task1.id, 'Edit');
      execution1b.input = {
        file_path: file1,
        old_string: 'task 1 modified',
        new_string: 'task 1 modified twice'
      };

      await toolActionStore.recordToolAction(
        task1.id,
        execution1b,
        [file1],
        [beforeSnapshot1b],
        [afterSnapshot1b]
      );

      // Task 2 operations
      const beforeSnapshot2 = await toolActionStore.createFileSnapshot(file2);
      await fs.writeFile(file2, 'task 2 modified', 'utf8');
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(file2);

      const execution2 = createMockToolExecution(task2.id, 'Write');
      execution2.input = { file_path: file2, content: 'task 2 modified' };

      await toolActionStore.recordToolAction(
        task2.id,
        execution2,
        [file2],
        [beforeSnapshot2],
        [afterSnapshot2]
      );

      // Check separate undo stacks
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

      const file2ContentAfter = await fs.readFile(file2, 'utf8');
      expect(file2ContentAfter).toBe('task 2 original'); // Reverted to original
    });
  });

  describe('Event Flow Integration', () => {
    it('should emit complete event sequence for undo operations', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test complete event flow',
        context: {}
      });

      const events: Array<{ event: string; data?: any }> = [];

      // Set up comprehensive event listeners
      orchestrator.on('undo:start', (data) => events.push({ event: 'undo:start', data }));
      orchestrator.on('undo:complete', (data) => events.push({ event: 'undo:complete', data }));
      orchestrator.on('undo:error', (data) => events.push({ event: 'undo:error', data }));

      const toolActionStore = orchestrator.getToolActionStore();

      // Set up an undoable action
      const beforeSnapshot = await toolActionStore.createFileSnapshot(testProject.mainFile);
      await fs.writeFile(testProject.mainFile, 'export function newMain() { console.log("New"); }', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(testProject.mainFile);

      const writeExecution = createMockToolExecution(task.id, 'Write');
      writeExecution.input = {
        file_path: testProject.mainFile,
        content: 'export function newMain() { console.log("New"); }'
      };

      await toolActionStore.recordToolAction(
        task.id,
        writeExecution,
        [testProject.mainFile],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Execute undo
      await orchestrator.undoLastAction(task.id);

      // Verify event sequence
      const eventNames = events.map(e => e.event);
      expect(eventNames).toContain('undo:start');
      expect(eventNames).toContain('undo:complete');

      // Verify event data structure
      const undoCompleteEvent = events.find(e => e.event === 'undo:complete');
      expect(undoCompleteEvent?.data).toEqual(
        expect.objectContaining({
          taskId: task.id,
          restoredFiles: expect.arrayContaining([testProject.mainFile])
        })
      );
    });

    it('should emit error events for failed undo operations', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test undo error events',
        context: {}
      });

      const events: string[] = [];

      orchestrator.on('undo:start', () => events.push('undo:start'));
      orchestrator.on('undo:complete', () => events.push('undo:complete'));
      orchestrator.on('undo:error', () => events.push('undo:error'));

      // Try to undo when no actions exist
      await orchestrator.undoLastAction(task.id);

      expect(events).toEqual(['undo:start', 'undo:error']);
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should handle filesystem permission errors during undo', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test permission error handling',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const restrictedFile = path.join(tempDir, 'restricted.txt');
      await fs.writeFile(restrictedFile, 'original content', 'utf8');

      // Set up an undoable action
      const beforeSnapshot = await toolActionStore.createFileSnapshot(restrictedFile);
      await fs.writeFile(restrictedFile, 'modified content', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(restrictedFile);

      const writeExecution = createMockToolExecution(task.id, 'Write');
      writeExecution.input = {
        file_path: restrictedFile,
        content: 'modified content'
      };

      await toolActionStore.recordToolAction(
        task.id,
        writeExecution,
        [restrictedFile],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Make file read-only
      await fs.chmod(restrictedFile, 0o444);

      try {
        // Undo should handle permission error gracefully
        const undoResult = await orchestrator.undoLastAction(task.id);
        expect(undoResult.success).toBe(false);
        expect(undoResult.error).toBeDefined();
      } finally {
        // Clean up
        await fs.chmod(restrictedFile, 0o644);
      }
    });

    it('should maintain system stability under undo operations', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test system stability',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Create multiple operations
      const files = [];
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(tempDir, `stability-${i}.txt`);
        await fs.writeFile(filePath, `original ${i}`, 'utf8');
        files.push(filePath);

        const beforeSnapshot = await toolActionStore.createFileSnapshot(filePath);
        await fs.writeFile(filePath, `modified ${i}`, 'utf8');
        const afterSnapshot = await toolActionStore.createFileSnapshot(filePath);

        const execution = createMockToolExecution(task.id, `Write${i}`);
        execution.input = {
          file_path: filePath,
          content: `modified ${i}`
        };

        await toolActionStore.recordToolAction(
          task.id,
          execution,
          [filePath],
          [beforeSnapshot],
          [afterSnapshot]
        );
      }

      // Perform multiple undo operations
      const undoResults = [];
      for (let i = 0; i < 3; i++) {
        const result = await orchestrator.undoLastAction(task.id);
        undoResults.push(result);
      }

      // All undo operations should succeed
      undoResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // System should remain stable
      expect(orchestrator.isInitialized()).toBe(true);

      // Verify remaining actions are still available
      const remainingActions = await toolActionStore.getUndoableActions(task.id);
      expect(remainingActions).toHaveLength(2); // 5 - 3 = 2
    });

    it('should handle large file operations efficiently', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test large file handling',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const largeFilePath = path.join(tempDir, 'large-file.txt');

      // Create a moderately large file (10KB)
      const largeContent = 'x'.repeat(10000);
      await fs.writeFile(largeFilePath, largeContent, 'utf8');

      // Perform operation on large file
      const beforeSnapshot = await toolActionStore.createFileSnapshot(largeFilePath);
      const modifiedContent = 'y'.repeat(10000);
      await fs.writeFile(largeFilePath, modifiedContent, 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(largeFilePath);

      const writeExecution = createMockToolExecution(task.id, 'Write');
      writeExecution.input = {
        file_path: largeFilePath,
        content: modifiedContent
      };

      const action = await toolActionStore.recordToolAction(
        task.id,
        writeExecution,
        [largeFilePath],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Verify large file was handled
      expect(action.beforeSnapshots[0].content).toBe(largeContent);
      expect(action.afterSnapshots[0].content).toBe(modifiedContent);

      // Undo should work efficiently
      const startTime = Date.now();
      const undoResult = await orchestrator.undoLastAction(task.id);
      const undoTime = Date.now() - startTime;

      expect(undoResult.success).toBe(true);
      expect(undoTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify content was restored
      const restoredContent = await fs.readFile(largeFilePath, 'utf8');
      expect(restoredContent).toBe(largeContent);
    });
  });

  describe('Complex Workflow Integration', () => {
    it('should handle multi-file operations with rollback', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test multi-file rollback',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const files = [testProject.mainFile, testProject.utilsFile, testProject.configFile];
      const originalContents = [];

      // Store original contents
      for (const file of files) {
        originalContents.push(await fs.readFile(file, 'utf8'));
      }

      // Create before snapshots
      const beforeSnapshots = [];
      for (const file of files) {
        beforeSnapshots.push(await toolActionStore.createFileSnapshot(file));
      }

      // Modify all files
      await fs.writeFile(files[0], '// Modified main', 'utf8');
      await fs.writeFile(files[1], '// Modified utils', 'utf8');
      await fs.writeFile(files[2], '{"modified": true}', 'utf8');

      // Create after snapshots
      const afterSnapshots = [];
      for (const file of files) {
        afterSnapshots.push(await toolActionStore.createFileSnapshot(file));
      }

      // Record as single multi-file action
      const multiExecution = createMockToolExecution(task.id, 'MultiEdit');
      multiExecution.input = {
        files: files,
        operation: 'batch_modify'
      };

      const action = await toolActionStore.recordToolAction(
        task.id,
        multiExecution,
        files,
        beforeSnapshots,
        afterSnapshots
      );

      // Verify all files are modified
      for (let i = 0; i < files.length; i++) {
        const content = await fs.readFile(files[i], 'utf8');
        expect(content).not.toBe(originalContents[i]);
      }

      // Single undo should restore all files
      const undoResult = await orchestrator.undoLastAction(task.id);
      expect(undoResult.success).toBe(true);
      expect(undoResult.restoredFiles).toEqual(expect.arrayContaining(files));

      // Verify all files are restored
      for (let i = 0; i < files.length; i++) {
        const content = await fs.readFile(files[i], 'utf8');
        expect(content).toBe(originalContents[i]);
      }
    });
  });
});