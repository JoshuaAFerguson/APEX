/**
 * Integration tests for Permission Presets with Autonomy Controls
 *
 * Tests verify:
 * 1. Autonomy limits interact correctly with permission presets
 * 2. Budget/token/time limits pause regardless of preset
 * 3. Approval gates work with autonomous preset
 * 4. Change limits trigger review even in autonomous mode
 * 5. Warning thresholds emit events before limits exceeded
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';

import {
  createTestEnvironment,
  createTestTask,
  createTestFiles,
} from './test-utils';
import { PermissionPresetManager } from '../../permission-preset-manager';

import type {
  Task,
  TaskResourceLimits,
  AutonomyLimitType,
} from '@apexcli/core';

describe('Permission Preset + Autonomy Controls Integration', () => {
  let testEnv: Awaited<ReturnType<typeof createTestEnvironment>>;
  let testTask: Task;
  let presetManager: PermissionPresetManager;
  let testFiles: Awaited<ReturnType<typeof createTestFiles>>;
  let autonomyEvents: any[] = [];

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
    testTask = createTestTask(testEnv.testDir);
    await testEnv.taskStore.addTask(testTask);

    testFiles = await createTestFiles(testEnv.testDir);

    presetManager = new PermissionPresetManager(testEnv.permissionManager);

    // Track autonomy events
    autonomyEvents = [];
    testEnv.autonomyController.on('limit:warning', (event) => {
      autonomyEvents.push({ type: 'warning', ...event });
    });
    testEnv.autonomyController.on('limit:exceeded', (event) => {
      autonomyEvents.push({ type: 'exceeded', ...event });
    });
    testEnv.autonomyController.on('approval:required', (event) => {
      autonomyEvents.push({ type: 'approval', ...event });
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
    vi.restoreAllMocks();
  });

  describe('Limit Enforcement with Presets', () => {
    it('should pause on budget limit even with autonomous preset', async () => {
      // Apply autonomous preset (allows everything)
      presetManager.applyPreset('autonomous');

      // Set low budget limit
      testEnv.autonomyController.updateLimits({
        budgetLimit: 0.10, // Very low budget
        tokenLimit: 10000,
        timeLimit: 60000,
        changeLimit: { files: 5, lines: 100 },
      });

      // Simulate high-cost operation
      testEnv.autonomyController.recordUsage({
        inputTokens: 5000,
        outputTokens: 3000,
        totalTokens: 8000,
        estimatedCost: 0.15, // Exceeds budget limit
      });

      const status = testEnv.autonomyController.checkLimits();

      expect(status.withinLimits).toBe(false);
      expect(status.exceededLimits.some(l => l.type === 'budget')).toBe(true);
      expect(autonomyEvents.some(e => e.type === 'exceeded' && e.limit === 'budget')).toBe(true);
    });

    it('should pause on token limit even with autonomous preset', async () => {
      presetManager.applyPreset('autonomous');

      // Set low token limit
      testEnv.autonomyController.updateLimits({
        budgetLimit: 10.0,
        tokenLimit: 5000, // Low token limit
        timeLimit: 60000,
        changeLimit: { files: 5, lines: 100 },
      });

      // Exceed token limit
      testEnv.autonomyController.recordUsage({
        inputTokens: 4000,
        outputTokens: 2000,
        totalTokens: 6000, // Exceeds limit
        estimatedCost: 0.30,
      });

      const status = testEnv.autonomyController.checkLimits();

      expect(status.withinLimits).toBe(false);
      expect(status.exceededLimits.some(l => l.type === 'tokens')).toBe(true);
      expect(autonomyEvents.some(e => e.type === 'exceeded' && e.limit === 'tokens')).toBe(true);
    });

    it('should pause on time limit regardless of preset', async () => {
      presetManager.applyPreset('autonomous');

      // Set very short time limit
      testEnv.autonomyController.updateLimits({
        budgetLimit: 10.0,
        tokenLimit: 50000,
        timeLimit: 100, // Very short time limit (100ms)
        changeLimit: { files: 5, lines: 100 },
      });

      // Wait longer than time limit
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = testEnv.autonomyController.checkLimits();

      expect(status.withinLimits).toBe(false);
      expect(status.exceededLimits.some(l => l.type === 'time')).toBe(true);
    });

    it('should track resource usage across permission decisions', async () => {
      presetManager.applyPreset('autonomous');

      const initialUsage = testEnv.autonomyController.getCurrentUsage();

      // Perform operations that should be tracked
      await testEnv.permissionManager.checkToolPermission({
        tool: 'browser',
        scope: 'navigate',
      });

      testEnv.autonomyController.recordUsage({
        inputTokens: 500,
        outputTokens: 300,
        totalTokens: 800,
        estimatedCost: 0.04,
      });

      const updatedUsage = testEnv.autonomyController.getCurrentUsage();

      expect(updatedUsage.totalTokens).toBeGreaterThan(initialUsage.totalTokens);
      expect(updatedUsage.estimatedCost).toBeGreaterThan(initialUsage.estimatedCost);
    });
  });

  describe('Approval Gates', () => {
    it('should trigger approval gate for sensitive operations', async () => {
      presetManager.applyPreset('autonomous');

      // Configure approval gate for file operations
      const approvalCheck = testEnv.policyEnforcer.checkApprovalRequired({
        filePaths: [testFiles.configFile], // Config file triggers approval
        operation: 'write',
        estimatedCost: 0.05,
      });

      expect(approvalCheck.required).toBe(true);
      expect(approvalCheck.triggeredRules).toHaveLength(1);
      expect(approvalCheck.triggeredRules[0].id).toBe('file-modifications');
    });

    it('should respect approval rule urgency levels', async () => {
      presetManager.applyPreset('autonomous');

      // High urgency: dangerous operations
      const dangerousCheck = testEnv.policyEnforcer.checkApprovalRequired({
        filePaths: [],
        operation: 'execute',
        toolName: 'bash',
        estimatedCost: 0.02,
      });

      // Medium urgency: file modifications
      const fileCheck = testEnv.policyEnforcer.checkApprovalRequired({
        filePaths: [testFiles.configFile],
        operation: 'write',
        estimatedCost: 0.02,
      });

      if (dangerousCheck.required) {
        expect(dangerousCheck.urgency).toBe('high');
      }

      if (fileCheck.required) {
        expect(fileCheck.urgency).toBe('medium');
      }
    });

    it('should aggregate multiple approval requirements', async () => {
      presetManager.applyPreset('autonomous');

      // Operation that triggers multiple approval rules
      const multiCheck = testEnv.policyEnforcer.checkApprovalRequired({
        filePaths: [testFiles.configFile],
        operation: 'write',
        toolName: 'bash', // Dangerous tool + sensitive file
        estimatedCost: 2.0, // Also exceeds cost threshold
      });

      if (multiCheck.required) {
        expect(multiCheck.triggeredRules.length).toBeGreaterThan(1);
        expect(multiCheck.urgency).toBe('high'); // Should use highest urgency
      }
    });

    it('should timeout approvals based on urgency', async () => {
      presetManager.applyPreset('autonomous');

      const urgencyTimeouts = {
        high: 30000,   // 30 seconds for high urgency
        medium: 120000, // 2 minutes for medium urgency
        low: 300000,   // 5 minutes for low urgency
      };

      // Test timeout calculation for different urgencies
      ['high', 'medium', 'low'].forEach(urgency => {
        const approvalGate = testEnv.autonomyController.createApprovalGate(
          `test-${urgency}`,
          `Test ${urgency} urgency approval`,
          urgency as 'high' | 'medium' | 'low'
        );

        expect(approvalGate.timeout).toBe(urgencyTimeouts[urgency]);
      });
    });
  });

  describe('Change Limit Integration', () => {
    it('should count files modified across tools', async () => {
      presetManager.applyPreset('autonomous');

      // Set low file change limit
      testEnv.autonomyController.updateLimits({
        budgetLimit: 10.0,
        tokenLimit: 50000,
        timeLimit: 60000,
        changeLimit: { files: 2, lines: 100 }, // Only 2 files allowed
      });

      const files = [
        testFiles.sourceFile,
        testFiles.testFile,
        testFiles.configFile, // This would be the 3rd file
      ];

      // Modify files one by one
      for (const [index, file] of files.entries()) {
        const beforeSnapshot = await testEnv.toolActionStore.createFileSnapshot(file);

        const newContent = `// Modified file ${index + 1}\n${await fs.readFile(file, 'utf8')}`;
        await fs.writeFile(file, newContent, 'utf8');

        const afterSnapshot = await testEnv.toolActionStore.createFileSnapshot(file);

        // Record the modification
        await testEnv.toolActionStore.recordToolAction(
          testTask.id,
          {
            callId: `file-edit-${index + 1}`,
            toolName: 'Edit',
            input: { filePath: file, content: newContent },
            taskId: testTask.id,
            agentName: 'developer',
            stageName: 'implementation',
            startTime: new Date(),
            endTime: new Date(),
            duration: 50,
            result: { success: true },
            status: 'completed' as const,
          },
          [file],
          [beforeSnapshot],
          [afterSnapshot]
        );

        // Track file modification in autonomy controller
        testEnv.autonomyController.recordFileChange(file, 1); // 1 line added
      }

      const status = testEnv.autonomyController.checkLimits();

      expect(status.withinLimits).toBe(false);
      expect(status.exceededLimits.some(l => l.type === 'changes')).toBe(true);
    });

    it('should count lines changed in file edits', async () => {
      presetManager.applyPreset('autonomous');

      // Set low line change limit
      testEnv.autonomyController.updateLimits({
        budgetLimit: 10.0,
        tokenLimit: 50000,
        timeLimit: 60000,
        changeLimit: { files: 10, lines: 5 }, // Only 5 lines allowed
      });

      const originalContent = await fs.readFile(testFiles.sourceFile, 'utf8');
      const newLines = [
        '// Line 1',
        '// Line 2',
        '// Line 3',
        '// Line 4',
        '// Line 5',
        '// Line 6', // This exceeds the limit
      ];

      const newContent = originalContent + '\n' + newLines.join('\n');
      await fs.writeFile(testFiles.sourceFile, newContent, 'utf8');

      // Record line changes
      testEnv.autonomyController.recordFileChange(testFiles.sourceFile, newLines.length);

      const status = testEnv.autonomyController.checkLimits();

      expect(status.withinLimits).toBe(false);
      expect(status.exceededLimits.some(l => l.type === 'changes')).toBe(true);
    });

    it('should trigger review when change limit exceeded', async () => {
      presetManager.applyPreset('autonomous');

      // Set change limit
      testEnv.autonomyController.updateLimits({
        budgetLimit: 10.0,
        tokenLimit: 50000,
        timeLimit: 60000,
        changeLimit: { files: 1, lines: 10 },
      });

      // Exceed change limit
      testEnv.autonomyController.recordFileChange(testFiles.sourceFile, 15); // Exceeds line limit

      const status = testEnv.autonomyController.checkLimits();

      expect(status.withinLimits).toBe(false);
      expect(autonomyEvents.some(e => e.type === 'exceeded' && e.limit === 'changes')).toBe(true);

      // Should trigger approval requirement
      expect(autonomyEvents.some(e => e.type === 'approval')).toBe(true);
    });

    it('should emit limit:warning before threshold exceeded', async () => {
      presetManager.applyPreset('autonomous');

      // Set limits with warning threshold at 80%
      testEnv.autonomyController.updateLimits({
        budgetLimit: 1.0,
        tokenLimit: 10000,
        timeLimit: 60000,
        changeLimit: { files: 5, lines: 50 },
      });

      // Approach warning threshold (80% of budget = 0.8)
      testEnv.autonomyController.recordUsage({
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
        estimatedCost: 0.85, // Exceeds 80% warning threshold
      });

      // Should have warning but not exceeded
      expect(autonomyEvents.some(e => e.type === 'warning' && e.limit === 'budget')).toBe(true);
      expect(autonomyEvents.some(e => e.type === 'exceeded')).toBe(false);

      const status = testEnv.autonomyController.checkLimits();
      expect(status.withinLimits).toBe(true); // Still within limits, just warning
      expect(status.warnings.some(w => w.type === 'budget')).toBe(true);
    });
  });

  describe('Preset-Specific Behaviors', () => {
    it('should allow all operations with autonomous preset within limits', async () => {
      presetManager.applyPreset('autonomous');

      // Check multiple tool permissions
      const browserPermission = await testEnv.permissionManager.checkToolPermission({
        tool: 'browser',
        scope: 'navigate',
      });

      const filePermission = await testEnv.permissionManager.checkToolPermission({
        tool: 'file',
        scope: 'write',
      });

      const editPermission = await testEnv.permissionManager.checkToolPermission({
        tool: 'edit',
        scope: 'modify',
      });

      expect(browserPermission.granted).toBe(true);
      expect(filePermission.granted).toBe(true);
      expect(editPermission.granted).toBe(true);
    });

    it('should require approval for dangerous operations even in autonomous mode', async () => {
      presetManager.applyPreset('autonomous');

      // Check dangerous operation approval
      const dangerousApproval = testEnv.policyEnforcer.checkApprovalRequired({
        filePaths: [],
        operation: 'execute',
        toolName: 'bash',
        command: 'rm -rf /',
        estimatedCost: 0.01,
      });

      expect(dangerousApproval.required).toBe(true);
      expect(dangerousApproval.urgency).toBe('high');
    });

    it('should respect read-only preset even when within autonomy limits', async () => {
      presetManager.applyPreset('readOnly');

      const writePermission = await testEnv.permissionManager.checkToolPermission({
        tool: 'file',
        scope: 'write',
      });

      const readPermission = await testEnv.permissionManager.checkToolPermission({
        tool: 'file',
        scope: 'read',
      });

      expect(writePermission.granted).toBe(false);
      expect(readPermission.granted).toBe(true);
    });

    it('should coordinate preset permissions with autonomy warnings', async () => {
      presetManager.applyPreset('reviewAll');

      // Approach resource limits
      testEnv.autonomyController.recordUsage({
        inputTokens: 4000,
        outputTokens: 2000,
        totalTokens: 6000,
        estimatedCost: 0.85, // Approaching budget limit
      });

      // Should have both permission prompt and autonomy warning
      const permission = await testEnv.permissionManager.checkToolPermission({
        tool: 'browser',
        scope: 'navigate',
      });

      const status = testEnv.autonomyController.checkLimits();

      // Permission should be prompted (reviewAll preset)
      expect(permission.granted).toBe(false); // Would require user approval

      // Should have autonomy warning
      expect(status.warnings.length).toBeGreaterThan(0);
      expect(autonomyEvents.some(e => e.type === 'warning')).toBe(true);
    });
  });
});