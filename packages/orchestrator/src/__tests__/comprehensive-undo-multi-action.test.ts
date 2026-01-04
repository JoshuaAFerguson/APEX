/**
 * @fileoverview Comprehensive Multi-Action Undo Tests
 *
 * This test suite provides comprehensive coverage for multi-action undo scenarios,
 * focusing on complex workflows and batch undo operations including:
 * - Multiple file modifications in sequence
 * - Batch undo operations
 * - Cross-tool action sequences
 * - Undo order validation
 * - State consistency across multiple operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ApexOrchestrator } from '../index.js';

describe('Comprehensive Multi-Action Undo Tests', () => {
  let tempDir: string;
  let originalCwd: string;
  let orchestrator: ApexOrchestrator;
  let testFiles: { [key: string]: string };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-multi-undo-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Initialize APEX
    await fs.mkdir('.apex', { recursive: true });
    await fs.writeFile('.apex/config.yaml', `
project:
  name: "multi-undo-test"
  version: "1.0.0"
agents: []
workflows: []
`);

    orchestrator = new ApexOrchestrator();
    await orchestrator.init(tempDir);

    // Create test files
    testFiles = {
      file1: path.join(tempDir, 'file1.txt'),
      file2: path.join(tempDir, 'file2.ts'),
      file3: path.join(tempDir, 'file3.json'),
      newFile: path.join(tempDir, 'new-file.md')
    };

    await fs.writeFile(testFiles.file1, 'file1 original content', 'utf8');
    await fs.writeFile(testFiles.file2, 'file2 original content', 'utf8');
    await fs.writeFile(testFiles.file3, '{"original": "data"}', 'utf8');
    // newFile doesn't exist initially
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

  describe('Sequential Multi-File Operations', () => {
    it('should undo multiple Write operations in reverse order', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test multi-file write undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const originalContents = {
        file1: await fs.readFile(testFiles.file1, 'utf8'),
        file2: await fs.readFile(testFiles.file2, 'utf8'),
        file3: await fs.readFile(testFiles.file3, 'utf8')
      };

      // Action 1: Modify file1
      const beforeSnapshot1 = await toolActionStore.createFileSnapshot(testFiles.file1);
      await fs.writeFile(testFiles.file1, 'file1 modified step 1', 'utf8');
      const afterSnapshot1 = await toolActionStore.createFileSnapshot(testFiles.file1);

      const action1 = await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file1, content: 'file1 modified step 1' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot1],
        afterSnapshots: [afterSnapshot1]
      });

      // Action 2: Modify file2
      const beforeSnapshot2 = await toolActionStore.createFileSnapshot(testFiles.file2);
      await fs.writeFile(testFiles.file2, 'file2 modified step 2', 'utf8');
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(testFiles.file2);

      const action2 = await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file2, content: 'file2 modified step 2' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot2],
        afterSnapshots: [afterSnapshot2]
      });

      // Action 3: Modify file3
      const beforeSnapshot3 = await toolActionStore.createFileSnapshot(testFiles.file3);
      await fs.writeFile(testFiles.file3, '{"modified": "in step 3"}', 'utf8');
      const afterSnapshot3 = await toolActionStore.createFileSnapshot(testFiles.file3);

      const action3 = await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file3, content: '{"modified": "in step 3"}' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot3],
        afterSnapshots: [afterSnapshot3]
      });

      // Verify all files are modified
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe('file1 modified step 1');
      expect(await fs.readFile(testFiles.file2, 'utf8')).toBe('file2 modified step 2');
      expect(await fs.readFile(testFiles.file3, 'utf8')).toBe('{"modified": "in step 3"}');

      // Undo operations in reverse order

      // Undo last action (file3)
      await toolActionStore.undoLastAction(task.id);
      expect(await fs.readFile(testFiles.file3, 'utf8')).toBe(originalContents.file3);
      expect(await fs.readFile(testFiles.file2, 'utf8')).toBe('file2 modified step 2'); // Still modified
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe('file1 modified step 1'); // Still modified

      // Undo second-to-last action (file2)
      await toolActionStore.undoLastAction(task.id);
      expect(await fs.readFile(testFiles.file3, 'utf8')).toBe(originalContents.file3);
      expect(await fs.readFile(testFiles.file2, 'utf8')).toBe(originalContents.file2);
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe('file1 modified step 1'); // Still modified

      // Undo first action (file1)
      await toolActionStore.undoLastAction(task.id);
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe(originalContents.file1);
      expect(await fs.readFile(testFiles.file2, 'utf8')).toBe(originalContents.file2);
      expect(await fs.readFile(testFiles.file3, 'utf8')).toBe(originalContents.file3);
    });

    it('should handle mixed tool operations (Write, Edit, Create)', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test mixed tool undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const originalFile1Content = await fs.readFile(testFiles.file1, 'utf8');

      // Action 1: Write to existing file
      const beforeSnapshot1 = await toolActionStore.createFileSnapshot(testFiles.file1);
      await fs.writeFile(testFiles.file1, 'modified by write', 'utf8');
      const afterSnapshot1 = await toolActionStore.createFileSnapshot(testFiles.file1);

      await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file1, content: 'modified by write' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot1],
        afterSnapshots: [afterSnapshot1]
      });

      // Action 2: Create new file
      const beforeSnapshot2 = await toolActionStore.createFileSnapshot(testFiles.newFile);
      await fs.writeFile(testFiles.newFile, 'new file content', 'utf8');
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(testFiles.newFile);

      await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.newFile, content: 'new file content' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot2],
        afterSnapshots: [afterSnapshot2]
      });

      // Action 3: Edit the written file
      const beforeSnapshot3 = await toolActionStore.createFileSnapshot(testFiles.file1);
      await fs.writeFile(testFiles.file1, 'modified by write and edit', 'utf8');
      const afterSnapshot3 = await toolActionStore.createFileSnapshot(testFiles.file1);

      await toolActionStore.recordToolAction(task.id, {
        toolName: 'Edit',
        input: {
          file_path: testFiles.file1,
          old_string: 'modified by write',
          new_string: 'modified by write and edit'
        },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot3],
        afterSnapshots: [afterSnapshot3]
      });

      // Verify current state
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe('modified by write and edit');
      expect(await fs.access(testFiles.newFile).then(() => true).catch(() => false)).toBe(true);

      // Undo in reverse order

      // Undo Edit (should restore to Write state)
      await toolActionStore.undoLastAction(task.id);
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe('modified by write');
      expect(await fs.access(testFiles.newFile).then(() => true).catch(() => false)).toBe(true);

      // Undo new file creation (should delete file)
      await toolActionStore.undoLastAction(task.id);
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe('modified by write');
      expect(await fs.access(testFiles.newFile).then(() => true).catch(() => false)).toBe(false);

      // Undo Write (should restore original content)
      await toolActionStore.undoLastAction(task.id);
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe(originalFile1Content);
      expect(await fs.access(testFiles.newFile).then(() => true).catch(() => false)).toBe(false);
    });
  });

  describe('Single Action Multiple Files', () => {
    it('should undo single action affecting multiple files', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test single action multi-file undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Store original contents
      const originalContents = {
        file1: await fs.readFile(testFiles.file1, 'utf8'),
        file2: await fs.readFile(testFiles.file2, 'utf8'),
        file3: await fs.readFile(testFiles.file3, 'utf8')
      };

      // Create before snapshots for all files
      const beforeSnapshots = [
        await toolActionStore.createFileSnapshot(testFiles.file1),
        await toolActionStore.createFileSnapshot(testFiles.file2),
        await toolActionStore.createFileSnapshot(testFiles.file3)
      ];

      // Simulate batch file modification
      await fs.writeFile(testFiles.file1, 'batch modified file1', 'utf8');
      await fs.writeFile(testFiles.file2, 'batch modified file2', 'utf8');
      await fs.writeFile(testFiles.file3, '{"batch": "modified"}', 'utf8');

      // Create after snapshots
      const afterSnapshots = [
        await toolActionStore.createFileSnapshot(testFiles.file1),
        await toolActionStore.createFileSnapshot(testFiles.file2),
        await toolActionStore.createFileSnapshot(testFiles.file3)
      ];

      // Record as single multi-file action
      const action = await toolActionStore.recordToolAction(task.id, {
        toolName: 'MultiEdit',
        input: {
          files: [testFiles.file1, testFiles.file2, testFiles.file3],
          operation: 'batch_modify'
        },
        output: { success: true, filesModified: 3 },
        beforeSnapshots,
        afterSnapshots
      });

      // Verify all files are modified
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe('batch modified file1');
      expect(await fs.readFile(testFiles.file2, 'utf8')).toBe('batch modified file2');
      expect(await fs.readFile(testFiles.file3, 'utf8')).toBe('{"batch": "modified"}');

      // Single undo should restore all files
      await toolActionStore.undoAction(task.id, action.id);

      // Verify all files are restored
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe(originalContents.file1);
      expect(await fs.readFile(testFiles.file2, 'utf8')).toBe(originalContents.file2);
      expect(await fs.readFile(testFiles.file3, 'utf8')).toBe(originalContents.file3);
    });

    it('should handle partial failures in multi-file undo', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test partial failure multi-file undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const readOnlyFile = path.join(tempDir, 'readonly.txt');

      // Create read-only file
      await fs.writeFile(readOnlyFile, 'readonly content', 'utf8');
      await fs.chmod(readOnlyFile, 0o444);

      const normalFile = testFiles.file1;
      const originalNormalContent = await fs.readFile(normalFile, 'utf8');

      // Create snapshots
      const beforeSnapshots = [
        await toolActionStore.createFileSnapshot(normalFile),
        await toolActionStore.createFileSnapshot(readOnlyFile)
      ];

      // Modify both files
      await fs.writeFile(normalFile, 'modified normal file', 'utf8');
      await fs.chmod(readOnlyFile, 0o644); // Temporarily make writable
      await fs.writeFile(readOnlyFile, 'modified readonly file', 'utf8');
      await fs.chmod(readOnlyFile, 0o444); // Make read-only again

      const afterSnapshots = [
        await toolActionStore.createFileSnapshot(normalFile),
        await toolActionStore.createFileSnapshot(readOnlyFile)
      ];

      const action = await toolActionStore.recordToolAction(task.id, {
        toolName: 'MultiEdit',
        input: { files: [normalFile, readOnlyFile] },
        output: { success: true },
        beforeSnapshots,
        afterSnapshots
      });

      // Undo should fail due to read-only file but we should handle it gracefully
      await expect(toolActionStore.undoAction(task.id, action.id)).rejects.toThrow();

      // Clean up
      await fs.chmod(readOnlyFile, 0o644);
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle create-modify-delete sequence', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test create-modify-delete workflow undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const workflowFile = path.join(tempDir, 'workflow.txt');

      // Action 1: Create file
      const beforeSnapshot1 = await toolActionStore.createFileSnapshot(workflowFile);
      await fs.writeFile(workflowFile, 'initial content', 'utf8');
      const afterSnapshot1 = await toolActionStore.createFileSnapshot(workflowFile);

      await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: workflowFile, content: 'initial content' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot1],
        afterSnapshots: [afterSnapshot1]
      });

      // Action 2: Modify file
      const beforeSnapshot2 = await toolActionStore.createFileSnapshot(workflowFile);
      await fs.writeFile(workflowFile, 'modified content', 'utf8');
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(workflowFile);

      await toolActionStore.recordToolAction(task.id, {
        toolName: 'Edit',
        input: {
          file_path: workflowFile,
          old_string: 'initial content',
          new_string: 'modified content'
        },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot2],
        afterSnapshots: [afterSnapshot2]
      });

      // Action 3: Delete file
      const beforeSnapshot3 = await toolActionStore.createFileSnapshot(workflowFile);
      await fs.unlink(workflowFile);

      await toolActionStore.recordToolAction(task.id, {
        toolName: 'Bash',
        input: { command: `rm ${workflowFile}` },
        output: { stdout: '', stderr: '', exitCode: 0 },
        beforeSnapshots: [beforeSnapshot3],
        afterSnapshots: []
      });

      // Verify file is deleted
      expect(await fs.access(workflowFile).then(() => true).catch(() => false)).toBe(false);

      // Undo sequence

      // Undo deletion - should restore with modified content
      await toolActionStore.undoLastAction(task.id);
      expect(await fs.access(workflowFile).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.readFile(workflowFile, 'utf8')).toBe('modified content');

      // Undo modification - should restore initial content
      await toolActionStore.undoLastAction(task.id);
      expect(await fs.readFile(workflowFile, 'utf8')).toBe('initial content');

      // Undo creation - should delete file
      await toolActionStore.undoLastAction(task.id);
      expect(await fs.access(workflowFile).then(() => true).catch(() => false)).toBe(false);
    });

    it('should handle interdependent file operations', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test interdependent operations undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const configFile = path.join(tempDir, 'config.json');
      const dataFile = path.join(tempDir, 'data.json');

      // Initial state
      await fs.writeFile(configFile, '{"version": "1.0"}', 'utf8');
      await fs.writeFile(dataFile, '{"items": []}', 'utf8');

      // Action 1: Update config
      const beforeSnapshot1 = await toolActionStore.createFileSnapshot(configFile);
      await fs.writeFile(configFile, '{"version": "2.0", "features": ["new"]}', 'utf8');
      const afterSnapshot1 = await toolActionStore.createFileSnapshot(configFile);

      await toolActionStore.recordToolAction(task.id, {
        toolName: 'Edit',
        input: {
          file_path: configFile,
          old_string: '{"version": "1.0"}',
          new_string: '{"version": "2.0", "features": ["new"]}'
        },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot1],
        afterSnapshots: [afterSnapshot1]
      });

      // Action 2: Update data to match new config
      const beforeSnapshot2 = await toolActionStore.createFileSnapshot(dataFile);
      await fs.writeFile(dataFile, '{"items": [], "version": "2.0"}', 'utf8');
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(dataFile);

      await toolActionStore.recordToolAction(task.id, {
        toolName: 'Edit',
        input: {
          file_path: dataFile,
          old_string: '{"items": []}',
          new_string: '{"items": [], "version": "2.0"}'
        },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot2],
        afterSnapshots: [afterSnapshot2]
      });

      // Verify current state
      expect(JSON.parse(await fs.readFile(configFile, 'utf8'))).toEqual({
        version: "2.0",
        features: ["new"]
      });
      expect(JSON.parse(await fs.readFile(dataFile, 'utf8'))).toEqual({
        items: [],
        version: "2.0"
      });

      // Undo data change first
      await toolActionStore.undoLastAction(task.id);
      expect(JSON.parse(await fs.readFile(configFile, 'utf8'))).toEqual({
        version: "2.0",
        features: ["new"]
      });
      expect(JSON.parse(await fs.readFile(dataFile, 'utf8'))).toEqual({
        items: []
      });

      // Undo config change
      await toolActionStore.undoLastAction(task.id);
      expect(JSON.parse(await fs.readFile(configFile, 'utf8'))).toEqual({
        version: "1.0"
      });
      expect(JSON.parse(await fs.readFile(dataFile, 'utf8'))).toEqual({
        items: []
      });
    });
  });

  describe('Batch Undo Operations', () => {
    it('should support undoing multiple actions at once', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test batch undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const originalContents = {
        file1: await fs.readFile(testFiles.file1, 'utf8'),
        file2: await fs.readFile(testFiles.file2, 'utf8'),
        file3: await fs.readFile(testFiles.file3, 'utf8')
      };

      // Create 3 actions
      const actions = [];

      // Action 1
      const beforeSnapshot1 = await toolActionStore.createFileSnapshot(testFiles.file1);
      await fs.writeFile(testFiles.file1, 'batch action 1', 'utf8');
      const afterSnapshot1 = await toolActionStore.createFileSnapshot(testFiles.file1);
      actions.push(await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file1, content: 'batch action 1' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot1],
        afterSnapshots: [afterSnapshot1]
      }));

      // Action 2
      const beforeSnapshot2 = await toolActionStore.createFileSnapshot(testFiles.file2);
      await fs.writeFile(testFiles.file2, 'batch action 2', 'utf8');
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(testFiles.file2);
      actions.push(await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file2, content: 'batch action 2' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot2],
        afterSnapshots: [afterSnapshot2]
      }));

      // Action 3
      const beforeSnapshot3 = await toolActionStore.createFileSnapshot(testFiles.file3);
      await fs.writeFile(testFiles.file3, 'batch action 3', 'utf8');
      const afterSnapshot3 = await toolActionStore.createFileSnapshot(testFiles.file3);
      actions.push(await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file3, content: 'batch action 3' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot3],
        afterSnapshots: [afterSnapshot3]
      }));

      // Verify all files are modified
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe('batch action 1');
      expect(await fs.readFile(testFiles.file2, 'utf8')).toBe('batch action 2');
      expect(await fs.readFile(testFiles.file3, 'utf8')).toBe('batch action 3');

      // Undo all actions by calling undoLastAction multiple times
      for (let i = 0; i < actions.length; i++) {
        await toolActionStore.undoLastAction(task.id);
      }

      // Verify all files are restored
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe(originalContents.file1);
      expect(await fs.readFile(testFiles.file2, 'utf8')).toBe(originalContents.file2);
      expect(await fs.readFile(testFiles.file3, 'utf8')).toBe(originalContents.file3);
    });

    it('should handle selective undo of specific actions', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test selective undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const originalContents = {
        file1: await fs.readFile(testFiles.file1, 'utf8'),
        file2: await fs.readFile(testFiles.file2, 'utf8'),
        file3: await fs.readFile(testFiles.file3, 'utf8')
      };

      // Create 3 actions with identifiable content
      const actions = [];

      // Action 1
      const beforeSnapshot1 = await toolActionStore.createFileSnapshot(testFiles.file1);
      await fs.writeFile(testFiles.file1, 'selective action 1', 'utf8');
      const afterSnapshot1 = await toolActionStore.createFileSnapshot(testFiles.file1);
      actions.push(await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file1, content: 'selective action 1' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot1],
        afterSnapshots: [afterSnapshot1]
      }));

      // Action 2
      const beforeSnapshot2 = await toolActionStore.createFileSnapshot(testFiles.file2);
      await fs.writeFile(testFiles.file2, 'selective action 2', 'utf8');
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(testFiles.file2);
      actions.push(await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file2, content: 'selective action 2' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot2],
        afterSnapshots: [afterSnapshot2]
      }));

      // Action 3
      const beforeSnapshot3 = await toolActionStore.createFileSnapshot(testFiles.file3);
      await fs.writeFile(testFiles.file3, 'selective action 3', 'utf8');
      const afterSnapshot3 = await toolActionStore.createFileSnapshot(testFiles.file3);
      actions.push(await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file3, content: 'selective action 3' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot3],
        afterSnapshots: [afterSnapshot3]
      }));

      // Undo only the middle action (action 2)
      await toolActionStore.undoAction(task.id, actions[1].id);

      // Verify selective undo
      expect(await fs.readFile(testFiles.file1, 'utf8')).toBe('selective action 1'); // Still modified
      expect(await fs.readFile(testFiles.file2, 'utf8')).toBe(originalContents.file2); // Restored
      expect(await fs.readFile(testFiles.file3, 'utf8')).toBe('selective action 3'); // Still modified

      // Try to undo action 2 again (should fail - already undone)
      await expect(toolActionStore.undoAction(task.id, actions[1].id))
        .rejects.toThrow('Action is already undone');
    });
  });

  describe('State Consistency Validation', () => {
    it('should maintain consistent state across multiple operations', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test state consistency',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Track state through multiple operations
      const stateLog: Array<{action: string; file1: string; file2: string}> = [];

      // Helper to log current state
      const logCurrentState = async (action: string) => {
        const file1Content = await fs.readFile(testFiles.file1, 'utf8').catch(() => '<deleted>');
        const file2Content = await fs.readFile(testFiles.file2, 'utf8').catch(() => '<deleted>');
        stateLog.push({ action, file1: file1Content, file2: file2Content });
      };

      // Initial state
      await logCurrentState('initial');

      // Operation 1: Modify file1
      const beforeSnapshot1 = await toolActionStore.createFileSnapshot(testFiles.file1);
      await fs.writeFile(testFiles.file1, 'state test 1', 'utf8');
      const afterSnapshot1 = await toolActionStore.createFileSnapshot(testFiles.file1);

      await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file1, content: 'state test 1' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot1],
        afterSnapshots: [afterSnapshot1]
      });

      await logCurrentState('after_op1');

      // Operation 2: Modify file2
      const beforeSnapshot2 = await toolActionStore.createFileSnapshot(testFiles.file2);
      await fs.writeFile(testFiles.file2, 'state test 2', 'utf8');
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(testFiles.file2);

      await toolActionStore.recordToolAction(task.id, {
        toolName: 'Write',
        input: { file_path: testFiles.file2, content: 'state test 2' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot2],
        afterSnapshots: [afterSnapshot2]
      });

      await logCurrentState('after_op2');

      // Operation 3: Modify file1 again
      const beforeSnapshot3 = await toolActionStore.createFileSnapshot(testFiles.file1);
      await fs.writeFile(testFiles.file1, 'state test 1 modified', 'utf8');
      const afterSnapshot3 = await toolActionStore.createFileSnapshot(testFiles.file1);

      await toolActionStore.recordToolAction(task.id, {
        toolName: 'Edit',
        input: {
          file_path: testFiles.file1,
          old_string: 'state test 1',
          new_string: 'state test 1 modified'
        },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot3],
        afterSnapshots: [afterSnapshot3]
      });

      await logCurrentState('after_op3');

      // Undo operations and verify state consistency

      // Undo op3
      await toolActionStore.undoLastAction(task.id);
      await logCurrentState('after_undo_op3');

      // Undo op2
      await toolActionStore.undoLastAction(task.id);
      await logCurrentState('after_undo_op2');

      // Undo op1
      await toolActionStore.undoLastAction(task.id);
      await logCurrentState('after_undo_op1');

      // Verify state progression
      expect(stateLog).toEqual([
        { action: 'initial', file1: 'file1 original content', file2: 'file2 original content' },
        { action: 'after_op1', file1: 'state test 1', file2: 'file2 original content' },
        { action: 'after_op2', file1: 'state test 1', file2: 'state test 2' },
        { action: 'after_op3', file1: 'state test 1 modified', file2: 'state test 2' },
        { action: 'after_undo_op3', file1: 'state test 1', file2: 'state test 2' },
        { action: 'after_undo_op2', file1: 'state test 1', file2: 'file2 original content' },
        { action: 'after_undo_op1', file1: 'file1 original content', file2: 'file2 original content' }
      ]);
    });

    it('should handle undo order validation', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test undo order validation',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const actions = [];

      // Create a sequence of actions
      for (let i = 1; i <= 3; i++) {
        const filePath = i === 1 ? testFiles.file1 : i === 2 ? testFiles.file2 : testFiles.file3;
        const beforeSnapshot = await toolActionStore.createFileSnapshot(filePath);
        await fs.writeFile(filePath, `action ${i} content`, 'utf8');
        const afterSnapshot = await toolActionStore.createFileSnapshot(filePath);

        actions.push(await toolActionStore.recordToolAction(task.id, {
          toolName: 'Write',
          input: { file_path: filePath, content: `action ${i} content` },
          output: { success: true },
          beforeSnapshots: [beforeSnapshot],
          afterSnapshots: [afterSnapshot]
        }));
      }

      // Get undoable actions to verify order
      const undoableActions = await toolActionStore.getUndoableActions(task.id);

      // Should be in reverse chronological order (newest first)
      expect(undoableActions).toHaveLength(3);
      expect(undoableActions[0].id).toBe(actions[2].id); // Latest action first
      expect(undoableActions[1].id).toBe(actions[1].id);
      expect(undoableActions[2].id).toBe(actions[0].id); // Oldest action last

      // Verify undoLastAction always gets the most recent undoable action
      await toolActionStore.undoLastAction(task.id); // Should undo action 3

      const remainingUndoable = await toolActionStore.getUndoableActions(task.id);
      expect(remainingUndoable).toHaveLength(2);
      expect(remainingUndoable[0].id).toBe(actions[1].id); // Action 2 is now most recent
    });
  });
});