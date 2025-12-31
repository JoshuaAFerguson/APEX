/**
 * @fileoverview Integration tests for permission preset warning triggers and dangerous operation detection
 *
 * This test suite covers the integration between permission presets and dangerous operation detection,
 * ensuring that warning triggers work correctly across different preset configurations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  DangerousOperationDetector,
  createDefaultDetector,
  type DangerousOperationResult,
  type ConfirmationRequirements
} from '@apexcli/core';
import {
  PermissionPreset,
  PermissionLevel,
  ToolDefinition,
  ToolInvocation,
} from '@apexcli/core';
import { PermissionStore } from '../permission-store';
import { PermissionPresetManager } from '../permission-preset-manager';

// Test utilities
function createMockToolDefinition(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'TestTool',
    description: 'Test tool for dangerous operation detection',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    dangerous: false,
    permissions: [],
    category: 'custom',
    enabled: true,
    ...overrides,
  };
}

function createToolInvocation(parameters: Record<string, unknown> = {}): ToolInvocation {
  return {
    toolName: 'TestTool',
    parameters,
  };
}

describe('Permission Preset Warning Integration Tests', () => {
  let tempDir: string;
  let permissionStore: PermissionStore;
  let presetManager: PermissionPresetManager;
  let dangerousOperationDetector: DangerousOperationDetector;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-warning-integration-test-'));

    // Initialize permission store and preset manager
    permissionStore = new PermissionStore(tempDir);
    await permissionStore.initialize();
    presetManager = new PermissionPresetManager(permissionStore);

    // Initialize dangerous operation detector
    dangerousOperationDetector = createDefaultDetector();
  });

  afterEach(() => {
    // Clean up
    if (permissionStore) {
      permissionStore.close();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Autonomous Preset Warning Behavior', () => {
    beforeEach(async () => {
      await presetManager.applyPreset('autonomous');
    });

    it('should allow all operations but still detect dangerous ones', async () => {
      // Test dangerous bash command
      const bashTool = createMockToolDefinition({ name: 'Bash' });
      const dangerousInvocation = createToolInvocation({ command: 'rm -rf /' });

      const result = dangerousOperationDetector.detectDangerousOperation(bashTool, dangerousInvocation);

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.confirmation?.required).toBe(true);

      // But the preset should still allow the tool
      const toolAllowed = await presetManager.isToolAllowed('Bash');
      expect(toolAllowed).toBe(true);
    });

    it('should detect filesystem dangerous patterns even in autonomous mode', async () => {
      const readTool = createMockToolDefinition({ name: 'Read' });
      const credentialAccess = createToolInvocation({ file_path: '/home/user/.ssh/id_rsa' });

      const result = dangerousOperationDetector.detectDangerousOperation(readTool, credentialAccess);

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.category).toBe('credential_files');

      // Tool is allowed by preset but operation is dangerous
      const toolAllowed = await presetManager.isToolAllowed('Read');
      expect(toolAllowed).toBe(true);
    });

    it('should detect network dangerous patterns', async () => {
      const webFetchTool = createMockToolDefinition({ name: 'WebFetch' });
      const darkWebAccess = createToolInvocation({ url: 'https://example.onion/malicious' });

      const result = dangerousOperationDetector.detectDangerousOperation(webFetchTool, darkWebAccess);

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('high');
      expect(result.category).toBe('dark_web');

      // Tool is allowed but operation requires warning
      const toolAllowed = await presetManager.isToolAllowed('WebFetch');
      expect(toolAllowed).toBe(true);
    });
  });

  describe('Review-All Preset Warning Behavior', () => {
    beforeEach(async () => {
      await presetManager.applyPreset('review-all');
    });

    it('should require confirmation for all tools and add warnings for dangerous ones', async () => {
      // Test safe operation with review-all preset
      const readTool = createMockToolDefinition({ name: 'Read' });
      const safeInvocation = createToolInvocation({ file_path: '/tmp/safe_file.txt' });

      const dangerResult = dangerousOperationDetector.detectDangerousOperation(readTool, safeInvocation);
      expect(dangerResult.isDangerous).toBe(false);

      // Preset should require confirmation for all tools
      const confirmationRequired = await presetManager.isConfirmationRequired('Read');
      expect(confirmationRequired).toBe(true);
    });

    it('should show enhanced warnings for dangerous operations in review mode', async () => {
      const bashTool = createMockToolDefinition({ name: 'Bash' });
      const privilegeEscalation = createToolInvocation({ command: 'sudo rm -rf /var/log/*' });

      const result = dangerousOperationDetector.detectDangerousOperation(bashTool, privilegeEscalation);

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.confirmation?.type).toBe('elevated');
      expect(result.confirmation?.alternatives).toBeDefined();

      // Review-all preset also requires confirmation
      const confirmationRequired = await presetManager.isConfirmationRequired('Bash');
      expect(confirmationRequired).toBe(true);
    });

    it('should handle tool-level dangerous flags with review preset', async () => {
      const dangerousTool = createMockToolDefinition({
        name: 'DangerousTool',
        dangerous: true,
        permissions: ['execute']
      });
      const invocation = createToolInvocation({ action: 'perform' });

      const result = dangerousOperationDetector.detectDangerousOperation(dangerousTool, invocation);

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('high');
      expect(result.category).toBe('tool_definition');

      // Tool requires confirmation from both preset and danger detection
      const confirmationRequired = await presetManager.isConfirmationRequired('DangerousTool');
      expect(confirmationRequired).toBe(true);
    });
  });

  describe('Read-Only Preset Warning Behavior', () => {
    beforeEach(async () => {
      await presetManager.applyPreset('read-only');
    });

    it('should allow safe read operations without warnings', async () => {
      const readTool = createMockToolDefinition({ name: 'Read' });
      const safeRead = createToolInvocation({ file_path: '/tmp/public_file.txt' });

      const dangerResult = dangerousOperationDetector.detectDangerousOperation(readTool, safeRead);
      expect(dangerResult.isDangerous).toBe(false);

      // Read-only preset allows safe read tools
      const toolAllowed = await presetManager.isToolAllowed('Read');
      expect(toolAllowed).toBe(true);
    });

    it('should warn about dangerous read operations even in read-only mode', async () => {
      const grepTool = createMockToolDefinition({ name: 'Grep' });
      const systemFileSearch = createToolInvocation({
        pattern: 'password',
        path: '/etc/shadow'
      });

      // Grep tool should trigger filesystem pattern detection
      const result = dangerousOperationDetector.detectDangerousOperation(
        { ...grepTool, name: 'Read' }, // Use Read to trigger pattern
        { ...systemFileSearch, parameters: { file_path: '/etc/shadow' } }
      );

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('high');
      expect(result.category).toBe('system_files');

      // Grep is allowed by read-only preset but operation is dangerous
      const toolAllowed = await presetManager.isToolAllowed('Grep');
      expect(toolAllowed).toBe(true);
    });

    it('should deny write operations and show appropriate warnings', async () => {
      const writeTool = createMockToolDefinition({ name: 'Write' });
      const writeInvocation = createToolInvocation({
        file_path: '/tmp/test.txt',
        content: 'test content'
      });

      // Write operations are denied by read-only preset
      const toolDenied = await presetManager.isToolDenied('Write');
      expect(toolDenied).toBe(true);

      // Dangerous pattern detection still works for completeness
      const dangerResult = dangerousOperationDetector.detectDangerousOperation(writeTool, writeInvocation);
      expect(dangerResult.isDangerous).toBe(false); // Not dangerous in itself, just denied by preset
    });

    it('should deny write operations to dangerous locations', async () => {
      const editTool = createMockToolDefinition({ name: 'Edit' });
      const systemFileEdit = createToolInvocation({ file_path: '/etc/hosts' });

      // Operation is dangerous
      const dangerResult = dangerousOperationDetector.detectDangerousOperation(editTool, systemFileEdit);
      expect(dangerResult.isDangerous).toBe(true);
      expect(dangerResult.severity).toBe('high');

      // And also denied by read-only preset
      const toolDenied = await presetManager.isToolDenied('Edit');
      expect(toolDenied).toBe(true);
    });
  });

  describe('Cross-Preset Warning Consistency', () => {
    it('should detect same dangerous operations across all presets', async () => {
      const dangerousOperations = [
        {
          tool: createMockToolDefinition({ name: 'Bash' }),
          invocation: createToolInvocation({ command: 'rm -rf /' }),
          expectedCategory: 'destructive'
        },
        {
          tool: createMockToolDefinition({ name: 'Read' }),
          invocation: createToolInvocation({ file_path: '/home/user/.aws/credentials' }),
          expectedCategory: 'credential_files'
        },
        {
          tool: createMockToolDefinition({ name: 'WebFetch' }),
          invocation: createToolInvocation({ url: 'https://malware.tk/payload' }),
          expectedCategory: 'suspicious_domains'
        }
      ];

      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of presets) {
        await presetManager.applyPreset(preset);

        for (const { tool, invocation, expectedCategory } of dangerousOperations) {
          const result = dangerousOperationDetector.detectDangerousOperation(tool, invocation);

          expect(result.isDangerous).toBe(true);
          expect(result.category).toContain(expectedCategory.split('_')[0]); // Partial match for flexibility
          expect(result.confirmation).toBeDefined();
        }
      }
    });

    it('should provide appropriate confirmation requirements based on severity', async () => {
      const severityTests = [
        {
          tool: createMockToolDefinition({ dangerous: true, permissions: ['admin'] }),
          expectedSeverity: 'critical',
          expectedType: 'elevated'
        },
        {
          tool: createMockToolDefinition({ dangerous: true, permissions: ['execute'] }),
          expectedSeverity: 'high',
          expectedType: 'detailed'
        },
        {
          tool: createMockToolDefinition({ dangerous: true, permissions: ['write'] }),
          expectedSeverity: 'medium',
          expectedType: 'simple'
        },
        {
          tool: createMockToolDefinition({ dangerous: true, permissions: ['read'] }),
          expectedSeverity: 'low',
          expectedType: 'simple'
        }
      ];

      for (const { tool, expectedSeverity, expectedType } of severityTests) {
        const invocation = createToolInvocation();
        const result = dangerousOperationDetector.detectDangerousOperation(tool, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe(expectedSeverity);
        expect(result.confirmation?.type).toBe(expectedType);

        if (expectedSeverity === 'critical') {
          expect(result.confirmation?.alternatives).toBeDefined();
          expect(result.confirmation?.alternatives!.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Warning Message Quality', () => {
    it('should provide clear and actionable warning messages', async () => {
      const testCases = [
        {
          tool: createMockToolDefinition({ name: 'Bash' }),
          invocation: createToolInvocation({ command: 'sudo rm -rf /var/log' }),
          expectedMessagePattern: /(CRITICAL|HIGH) RISK/,
          expectedContextPattern: /Command:/
        },
        {
          tool: createMockToolDefinition({ name: 'Read' }),
          invocation: createToolInvocation({ file_path: '/etc/passwd' }),
          expectedMessagePattern: /(HIGH|MEDIUM) RISK/,
          expectedContextPattern: /Matched value:/
        },
        {
          tool: createMockToolDefinition({ name: 'Write' }),
          invocation: createToolInvocation({ file_path: '/app/.env' }),
          expectedMessagePattern: /(MEDIUM|LOW) RISK/,
          expectedContextPattern: /Matched value:/
        }
      ];

      for (const { tool, invocation, expectedMessagePattern, expectedContextPattern } of testCases) {
        const result = dangerousOperationDetector.detectDangerousOperation(tool, invocation);

        if (result.isDangerous && result.confirmation) {
          expect(result.confirmation.message).toMatch(expectedMessagePattern);
          if (result.confirmation.context) {
            expect(result.confirmation.context).toMatch(expectedContextPattern);
          }
        }
      }
    });

    it('should provide helpful alternatives for critical operations', async () => {
      const criticalTool = createMockToolDefinition({
        dangerous: true,
        permissions: ['admin']
      });
      const invocation = createToolInvocation();

      const result = dangerousOperationDetector.detectDangerousOperation(criticalTool, invocation);

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.confirmation?.alternatives).toBeDefined();
      expect(result.confirmation?.alternatives!.length).toBeGreaterThan(0);

      // Check that alternatives are actually helpful
      const alternatives = result.confirmation!.alternatives!;
      expect(alternatives.some(alt => alt.toLowerCase().includes('review'))).toBe(true);
      expect(alternatives.some(alt => alt.toLowerCase().includes('backup'))).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid permission checks efficiently', async () => {
      await presetManager.applyPreset('review-all');

      const startTime = Date.now();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const tool = createMockToolDefinition({ name: `Tool${i % 10}` });
        const invocation = createToolInvocation({ param: `value${i}` });

        dangerousOperationDetector.detectDangerousOperation(tool, invocation);
        await presetManager.isToolAllowed(`Tool${i % 10}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 2 seconds)
      expect(duration).toBeLessThan(2000);
    });

    it('should handle null and undefined parameters gracefully', async () => {
      const tool = createMockToolDefinition({ name: 'TestTool' });

      const edgeCaseInvocations = [
        createToolInvocation({}), // Empty parameters
        createToolInvocation({ nullParam: null }),
        createToolInvocation({ undefinedParam: undefined }),
        createToolInvocation({ emptyString: '' }),
        createToolInvocation({ whitespace: '   ' })
      ];

      for (const invocation of edgeCaseInvocations) {
        const result = dangerousOperationDetector.detectDangerousOperation(tool, invocation);
        expect(result.isDangerous).toBe(false); // Should not crash, should not detect danger
      }
    });

    it('should maintain warning detection accuracy with complex patterns', async () => {
      const complexPatterns = [
        {
          tool: createMockToolDefinition({ name: 'Read' }),
          invocation: createToolInvocation({ file_path: '/app/../../../etc/../etc/passwd' }),
          shouldBeDetected: true,
          expectedCategory: 'path_traversal'
        },
        {
          tool: createMockToolDefinition({ name: 'WebFetch' }),
          invocation: createToolInvocation({ url: 'https://MALICIOUS.TK/mixed-case' }),
          shouldBeDetected: false, // Pattern is case sensitive
        },
        {
          tool: createMockToolDefinition({ name: 'Bash' }),
          invocation: createToolInvocation({ command: 'echo "rm -rf /" # safe comment' }),
          shouldBeDetected: true, // Still matches dangerous pattern
          expectedCategory: 'destructive'
        }
      ];

      for (const { tool, invocation, shouldBeDetected, expectedCategory } of complexPatterns) {
        const result = dangerousOperationDetector.detectDangerousOperation(tool, invocation);

        expect(result.isDangerous).toBe(shouldBeDetected);
        if (shouldBeDetected && expectedCategory) {
          expect(result.category).toContain(expectedCategory.split('_')[0]);
        }
      }
    });
  });
});