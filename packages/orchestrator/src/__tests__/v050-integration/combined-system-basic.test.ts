/**
 * Basic Combined System Integration Tests
 *
 * Simplified tests to verify the three systems work together:
 * - Tool System + Permission System
 * - Permission System + Policy Enforcement
 * - Browser Tool + Permission System
 *
 * This is a simplified version to verify core functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  createTestTask,
  createTestFiles,
  expectPermissionGranted,
  expectPermissionDenied,
  expectPolicyViolation,
} from './test-utils';
import { PermissionPresetManager } from '../../permission-preset-manager';

describe('Basic Combined System Integration', () => {
  let testEnv: Awaited<ReturnType<typeof createTestEnvironment>>;

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Permission System + Policy Integration', () => {
    it('should integrate permission checks with policy validation', async () => {
      // Create a test file in allowed area
      const testFiles = await createTestFiles(testEnv.testDir);

      // Check if file operation would be allowed
      const permResult = await testEnv.permissionManager.checkPermission({
        tool: 'file-writer',
        operation: 'write',
        scope: testFiles.sourceFile,
      });

      // Should initially be denied (no permission granted)
      expectPermissionDenied(permResult);

      // Grant permission
      await testEnv.permissionManager.grantPermission('file-writer', 'allow-once');

      // Check permission again
      const permResult2 = await testEnv.permissionManager.checkPermission({
        tool: 'file-writer',
        operation: 'write',
        scope: testFiles.sourceFile,
      });
      expectPermissionGranted(permResult2);

      // Check policy validation
      const policyViolations = await testEnv.policyEnforcer.validateFilePath(testFiles.sourceFile);
      expect(policyViolations).toHaveLength(0); // Should be allowed by policy
    });

    it('should block operations when policy violations exist', async () => {
      // Try to access blocked path (node_modules)
      const blockedPath = `${testEnv.testDir}/node_modules/some-package.js`;

      // Grant permission first
      await testEnv.permissionManager.grantPermission('file-reader', 'allow-always');

      // Check permission (should be granted)
      const permResult = await testEnv.permissionManager.checkPermission({
        tool: 'file-reader',
        operation: 'read',
        scope: blockedPath,
      });
      expectPermissionGranted(permResult);

      // But policy should block it
      const policyViolations = await testEnv.policyEnforcer.validateFilePath(blockedPath);
      expect(policyViolations.length).toBeGreaterThan(0);
      expectPolicyViolation(policyViolations, 'node_modules');
    });
  });

  describe('Permission Presets Integration', () => {
    it('should apply permission presets consistently across all tools', async () => {
      const presetManager = new PermissionPresetManager(testEnv.permissionManager);

      // Apply supervised preset
      await presetManager.applyPreset('supervised');

      // All operations should initially require approval
      const browserResult = await testEnv.permissionManager.checkPermission({
        tool: 'browser',
        operation: 'navigate',
      });
      expectPermissionDenied(browserResult);

      const fileResult = await testEnv.permissionManager.checkPermission({
        tool: 'file-writer',
        operation: 'write',
      });
      expectPermissionDenied(fileResult);

      // Apply autonomous preset
      await presetManager.applyPreset('autonomous');

      // Operations should now be allowed
      const browserResult2 = await testEnv.permissionManager.checkPermission({
        tool: 'browser',
        operation: 'navigate',
      });
      expectPermissionGranted(browserResult2);

      const fileResult2 = await testEnv.permissionManager.checkPermission({
        tool: 'file-writer',
        operation: 'write',
      });
      expectPermissionGranted(fileResult2);
    });
  });

  describe('Autonomy Controller Integration', () => {
    it('should respect resource limits across all systems', async () => {
      // Set very low limits
      testEnv.autonomyController.updateLimits({
        budgetLimit: 0.001, // Very low
        tokenLimit: 10,     // Very low
      });

      // Simulate usage that exceeds limits
      testEnv.autonomyController.recordUsage({
        inputTokens: 15,    // Exceeds token limit
        outputTokens: 5,
        estimatedCost: 0.002, // Exceeds budget limit
      });

      // Check if limits are exceeded
      const limitStatus = testEnv.autonomyController.checkLimits();
      expect(limitStatus.exceeded).toBe(true);
      expect(limitStatus.budgetExceeded).toBe(true);
      expect(limitStatus.tokenExceeded).toBe(true);
    });

    it('should track file changes and respect change limits', async () => {
      // Set low change limits
      testEnv.autonomyController.updateLimits({
        changeLimit: { files: 2, lines: 50 },
      });

      // Record some file changes
      testEnv.autonomyController.recordFileChange('file1.ts', 30);
      testEnv.autonomyController.recordFileChange('file2.ts', 25); // Total: 55 lines, 2 files

      const limitStatus = testEnv.autonomyController.checkLimits();
      expect(limitStatus.changeExceeded).toBe(true); // Lines exceeded
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle permission errors gracefully', async () => {
      // Try to use browser without permission
      const result = await testEnv.permissionManager.checkPermission({
        tool: 'browser',
        operation: 'navigate',
        scope: 'https://blocked.example.com',
      });

      expectPermissionDenied(result);
      expect(result.reason).toBeDefined();
    });

    it('should handle policy violations gracefully', async () => {
      const violations = await testEnv.policyEnforcer.validateFilePath('/blocked/path');
      expect(violations).toBeDefined();
      expect(Array.isArray(violations)).toBe(true);
    });
  });
});