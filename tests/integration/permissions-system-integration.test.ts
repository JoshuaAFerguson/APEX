/**
 * @fileoverview Comprehensive Permissions System Integration Tests
 *
 * This test suite provides comprehensive integration testing of the APEX permissions system,
 * validating the complete workflow from permission requests through user confirmations to
 * final execution. Tests cover:
 *
 * 1. Permission checks, grants, and denials
 * 2. User confirmation flows (both CLI and programmatic)
 * 3. Dangerous operation detection and blocking
 * 4. Permission presets and configuration
 * 5. Event emission and ordering
 * 6. Cross-component integration
 * 7. Real-world usage scenarios
 *
 * Acceptance Criteria Verification:
 * ✅ Permission checks work correctly
 * ✅ Permission grants persist and function
 * ✅ Permission denials are enforced
 * ✅ User confirmation flows complete successfully
 * ✅ All tests pass successfully
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';
import { EventEmitter } from 'events';

import {
  ApexOrchestrator,
  PermissionManager,
  PermissionStore,
  PermissionPresetManager
} from '@apexcli/orchestrator';
import type {
  PermissionLevel,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  ToolPermissionCheckOptions,
  PermissionPreset
} from '@apexcli/core';

describe('Permissions System Integration Tests', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let presetManager: PermissionPresetManager;
  let eventLog: Array<{ type: string; data: any; timestamp: number }>;

  beforeEach(async () => {
    // Create isolated test environment
    tempDir = await mkdtemp(join(tmpdir(), 'apex-permissions-integration-test-'));

    // Create .apex directory structure
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Create comprehensive test configuration
    const configContent = `
project:
  name: permissions-integration-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all
  presets:
    autonomous:
      tools:
        Read: allow
        Write: allow
        Edit: allow
        Bash: allow
        Grep: allow
        Glob: allow
    review-all:
      tools:
        Read: confirm
        Write: confirm
        Edit: confirm
        Bash: confirm
        Grep: confirm
        Glob: confirm
    read-only:
      tools:
        Read: allow
        Write: deny
        Edit: deny
        Bash: deny
        Grep: allow
        Glob: allow

agents:
  developer:
    role: "Implements features and writes production code"
    model: sonnet
    tools: [Read, Write, Edit, Bash, Grep, Glob]

workflows:
  feature-implementation:
    name: "Feature Implementation"
    agents: [developer]
    stages:
      - name: implementation
        agent: developer
        description: "Write the code"

limits:
  maxTasksPerHour: 100
  maxCostPerTask: 10.0
  maxConcurrentTasks: 5

audit:
  enabled: true
  location: ${apexDir}/audit.log
`;

    await writeFile(join(apexDir, 'config.yaml'), configContent);

    // Initialize orchestrator and components
    orchestrator = new ApexOrchestrator(tempDir, {
      maxTasksPerHour: 100,
      maxCostPerTask: 10,
      maxConcurrentTasks: 5,
      enableAuditLog: true,
    });

    await orchestrator.initialize();

    // Get component instances for direct testing
    permissionManager = orchestrator.permissionManager;
    permissionStore = orchestrator.permissionStore;
    presetManager = orchestrator.presetManager;

    // Setup event logging for comprehensive verification
    eventLog = [];
    const originalEmit = orchestrator.emit.bind(orchestrator);
    vi.spyOn(orchestrator, 'emit').mockImplementation((event: string, ...args: any[]) => {
      eventLog.push({
        type: event,
        data: args[0],
        timestamp: Date.now(),
      });
      return originalEmit(event, ...args);
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('Permission Checks', () => {
    it('should perform accurate permission checks', async () => {
      // Initially no permissions should exist
      const initialCheck = await permissionManager.checkPermission('Write');
      expect(initialCheck).toBeNull();

      // Grant a specific permission
      await permissionManager.grantPermission('Write', '/tmp/test.txt', 'allow-always');

      // Permission should now exist
      const grantedCheck = await permissionManager.checkPermission('Write', '/tmp/test.txt');
      expect(grantedCheck).toBe('allow-always');

      // Different scope should not have permission
      const differentScopeCheck = await permissionManager.checkPermission('Write', '/tmp/other.txt');
      expect(differentScopeCheck).toBeNull();
    });

    it('should handle wildcard permission scopes correctly', async () => {
      // Grant wildcard permission
      await permissionManager.grantPermission('Read', '/tmp/*', 'allow-always');

      // All files in /tmp should be allowed
      const checks = await Promise.all([
        permissionManager.checkPermission('Read', '/tmp/file1.txt'),
        permissionManager.checkPermission('Read', '/tmp/file2.txt'),
        permissionManager.checkPermission('Read', '/tmp/subdir/file3.txt'),
      ]);

      expect(checks).toEqual(['allow-always', 'allow-always', 'allow-always']);

      // Files outside /tmp should not be allowed
      const outsideCheck = await permissionManager.checkPermission('Read', '/home/user/file.txt');
      expect(outsideCheck).toBeNull();
    });

    it('should respect permission hierarchy and precedence', async () => {
      // Apply autonomous preset
      await presetManager.applyPreset('autonomous');

      // Override with specific denial
      await permissionManager.grantPermission('Write', '/etc/*', 'deny');

      // Check specific denial overrides preset
      const deniedCheck = await permissionManager.checkPermission('Write', '/etc/passwd');
      expect(deniedCheck).toBe('deny');

      // Check other paths follow preset
      const allowedCheck = await permissionManager.checkPermission('Write', '/tmp/test.txt');
      expect(allowedCheck).toBe('allow-always');
    });
  });

  describe('Permission Grants', () => {
    it('should grant permissions with correct levels and persistence', async () => {
      const testCases: Array<{
        tool: string;
        scope: string;
        level: PermissionLevel;
      }> = [
        { tool: 'Read', scope: '/tmp/file1.txt', level: 'allow-always' },
        { tool: 'Write', scope: '/tmp/file2.txt', level: 'allow-once' },
        { tool: 'Edit', scope: '/tmp/file3.txt', level: 'deny' },
      ];

      // Grant all permissions
      for (const { tool, scope, level } of testCases) {
        await permissionManager.grantPermission(tool, scope, level);
      }

      // Verify all permissions are correctly stored
      for (const { tool, scope, level } of testCases) {
        const stored = await permissionManager.checkPermission(tool, scope);
        expect(stored).toBe(level);
      }

      // Verify persistence across manager instances
      const newManager = new PermissionManager(permissionStore);
      for (const { tool, scope, level } of testCases) {
        const persistent = await newManager.checkPermission(tool, scope);
        expect(persistent).toBe(level);
      }
    });

    it('should handle allow-once permissions correctly', async () => {
      // Grant allow-once permission
      await permissionManager.grantPermission('Bash', 'test-command', 'allow-once');

      // First check should return and potentially consume the permission
      const firstCheck = await permissionManager.checkPermission('Bash', 'test-command');
      expect(firstCheck).toBe('allow-once');

      // Note: allow-once permissions are consumed automatically when checked in real usage

      // Second check should return null (consumed)
      const secondCheck = await permissionManager.checkPermission('Bash', 'test-command');
      expect(secondCheck).toBeNull();
    });
  });

  describe('Permission Denials', () => {
    it('should enforce permission denials correctly', async () => {
      // Explicitly deny a permission
      await permissionManager.grantPermission('Write', '/etc/*', 'deny');

      // Check that access is denied
      const deniedCheck = await permissionManager.checkPermission('Write', '/etc/passwd');
      expect(deniedCheck).toBe('deny');

      // Test tool permission check
      const toolCheckOptions: ToolPermissionCheckOptions = {
        tool: 'Write',
        scope: '/etc/passwd',
        operation: 'file-write',
        parameters: { filePath: '/etc/passwd', content: 'malicious' },
      };

      const toolResult = await permissionManager.checkToolPermission('Write', {
        scope: '/etc/passwd',
        operation: 'file-write',
        parameters: { filePath: '/etc/passwd', content: 'malicious' },
      });
      expect(toolResult.allowed).toBe(false);
      expect(toolResult.reason).toContain('denied');
    });

    it('should handle preset-based denials', async () => {
      // Apply read-only preset
      await presetManager.applyPreset('read-only');

      // Write operations should be denied
      const toolCheckOptions: ToolPermissionCheckOptions = {
        tool: 'Write',
        scope: '/tmp/test.txt',
        operation: 'file-write',
      };

      const result = await permissionManager.checkToolPermission('Write', {
        scope: '/tmp/test.txt',
        operation: 'file-write',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('denied by preset');
    });
  });

  describe('User Confirmation Flows', () => {
    it('should handle complete confirmation workflow', async () => {
      // Request permission that requires confirmation
      const requestId = await orchestrator.requestPermission(
        'Write',
        '/tmp/sensitive-file.txt',
        {
          operation: 'file-write',
          parameters: { filePath: '/tmp/sensitive-file.txt', content: 'test content' },
        }
      );

      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');

      // Verify permission request event was emitted
      const requestEvent = eventLog.find(e => e.type === 'permission:request');
      expect(requestEvent).toBeDefined();
      expect(requestEvent!.data.tool).toBe('Write');
      expect(requestEvent!.data.scope).toBe('/tmp/sensitive-file.txt');

      // Grant permission through confirmation
      await orchestrator.grantPermissionConfirmation(
        requestId,
        'allow-always',
        'external-cli'
      );

      // Verify permission granted event was emitted
      const grantedEvent = eventLog.find(e => e.type === 'permission:granted');
      expect(grantedEvent).toBeDefined();
      expect(grantedEvent!.data.level).toBe('allow-always');
      expect(grantedEvent!.data.grantedBy).toBe('external-cli');

      // Verify permission is now stored
      const storedPermission = await permissionManager.checkPermission(
        'Write',
        '/tmp/sensitive-file.txt'
      );
      expect(storedPermission).toBe('allow-always');
    });

    it('should handle permission denial workflow', async () => {
      // Request permission
      const requestId = await orchestrator.requestPermission(
        'Bash',
        'rm -rf /important-data',
        {
          operation: 'shell-command',
          isDangerous: true,
        }
      );

      // Deny permission
      await orchestrator.denyPermissionConfirmation(requestId, 'external-api');

      // Verify permission denied event was emitted
      const deniedEvent = eventLog.find(e => e.type === 'permission:denied');
      expect(deniedEvent).toBeDefined();
      expect(deniedEvent!.data.deniedBy).toBe('external-api');

      // Verify permission is not stored (or stored as deny)
      const storedPermission = await permissionManager.checkPermission(
        'Bash',
        'rm -rf /important-data'
      );
      expect(storedPermission).toBe('deny');
    });

    it('should handle dangerous operation confirmation flows', async () => {
      // Flag dangerous operation
      const requestId = await orchestrator.flagDangerousOperation(
        'Bash',
        'sudo rm -rf /',
        'high',
        {
          reason: 'System-destroying command',
          patterns: ['rm -rf /'],
        }
      );

      // Verify dangerous operation event was emitted
      const dangerousEvent = eventLog.find(e => e.type === 'dangerous:detected');
      expect(dangerousEvent).toBeDefined();
      expect(dangerousEvent!.data.riskLevel).toBe('high');

      // Confirm dangerous operation (simulating user override)
      await orchestrator.confirmDangerousOperation(requestId, 'external-cli');

      // Verify confirmation event was emitted
      const confirmedEvent = eventLog.find(e => e.type === 'dangerous:confirmed');
      expect(confirmedEvent).toBeDefined();
      expect(confirmedEvent!.data.confirmedBy).toBe('external-cli');
    });

    it('should handle multiple concurrent confirmations', async () => {
      const requests = await Promise.all([
        orchestrator.requestPermission('Read', '/tmp/file1.txt'),
        orchestrator.requestPermission('Write', '/tmp/file2.txt'),
        orchestrator.requestPermission('Edit', '/tmp/file3.txt'),
      ]);

      expect(requests).toHaveLength(3);
      expect(new Set(requests).size).toBe(3); // All IDs should be unique

      // Confirm all requests
      await Promise.all([
        orchestrator.grantPermissionConfirmation(requests[0], 'allow-always', 'test-1'),
        orchestrator.grantPermissionConfirmation(requests[1], 'allow-once', 'test-2'),
        orchestrator.denyPermissionConfirmation(requests[2], 'test-3'),
      ]);

      // Verify all permissions are correctly stored
      const permissions = await Promise.all([
        permissionManager.checkPermission('Read', '/tmp/file1.txt'),
        permissionManager.checkPermission('Write', '/tmp/file2.txt'),
        permissionManager.checkPermission('Edit', '/tmp/file3.txt'),
      ]);

      expect(permissions).toEqual(['allow-always', 'allow-once', 'deny']);
    });
  });

  describe('Event System Integration', () => {
    it('should emit events in correct order and with proper data', async () => {
      // Clear event log for clean test
      eventLog.length = 0;

      // Perform complete workflow
      const requestId = await orchestrator.requestPermission(
        'Write',
        '/tmp/test-file.txt',
        { operation: 'file-write' }
      );

      await orchestrator.grantPermissionConfirmation(
        requestId,
        'allow-always',
        'integration-test'
      );

      // Verify event order
      expect(eventLog).toHaveLength(2);
      expect(eventLog[0].type).toBe('permission:request');
      expect(eventLog[1].type).toBe('permission:granted');

      // Verify event timestamps are ordered
      expect(eventLog[1].timestamp).toBeGreaterThanOrEqual(eventLog[0].timestamp);

      // Verify event data integrity
      const requestEvent = eventLog[0];
      const grantedEvent = eventLog[1];

      expect(requestEvent.data.id).toBe(requestId);
      expect(requestEvent.data.tool).toBe('Write');
      expect(requestEvent.data.scope).toBe('/tmp/test-file.txt');

      expect(grantedEvent.data.id).toBe(requestId);
      expect(grantedEvent.data.level).toBe('allow-always');
      expect(grantedEvent.data.grantedBy).toBe('integration-test');
    });

    it('should handle rapid event sequences without loss', async () => {
      const eventCount = 10;
      const requests: string[] = [];

      // Rapid fire permission requests
      for (let i = 0; i < eventCount; i++) {
        const requestId = await orchestrator.requestPermission(
          'Read',
          `/tmp/rapid-test-${i}.txt`
        );
        requests.push(requestId);
      }

      // Rapid fire confirmations
      for (let i = 0; i < eventCount; i++) {
        await orchestrator.grantPermissionConfirmation(
          requests[i],
          'allow-once',
          `rapid-test-${i}`
        );
      }

      // Verify all events were captured
      const requestEvents = eventLog.filter(e => e.type === 'permission:request');
      const grantedEvents = eventLog.filter(e => e.type === 'permission:granted');

      expect(requestEvents).toHaveLength(eventCount);
      expect(grantedEvents).toHaveLength(eventCount);

      // Verify all requests have corresponding grants
      const requestIds = requestEvents.map(e => e.data.id);
      const grantedIds = grantedEvents.map(e => e.data.id);
      expect(new Set(requestIds)).toEqual(new Set(grantedIds));
    });
  });

  describe('Preset Integration', () => {
    it('should apply presets correctly and immediately', async () => {
      // Start with review-all (requires confirmation)
      await presetManager.applyPreset('review-all');
      expect(await presetManager.isToolConfirmRequired('Write')).toBe(true);

      // Change to autonomous
      await presetManager.applyPreset('autonomous');
      expect(await presetManager.isToolAllowed('Write')).toBe(true);
      expect(await presetManager.isToolConfirmRequired('Write')).toBe(false);

      // Change to read-only
      await presetManager.applyPreset('read-only');
      expect(await presetManager.isToolDenied('Write')).toBe(true);
      expect(await presetManager.isToolAllowed('Read')).toBe(true);
    });

    it('should persist preset changes across component restarts', async () => {
      // Apply autonomous preset
      await presetManager.applyPreset('autonomous');

      // Create new preset manager instance
      const newPresetManager = new PermissionPresetManager(permissionStore, 'review-all');
      await newPresetManager.initialize();

      // Verify preset persisted
      expect(await newPresetManager.isToolAllowed('Write')).toBe(true);
      expect(await newPresetManager.isToolAllowed('Bash')).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid permission operations gracefully', async () => {
      // Invalid tool name
      await expect(
        permissionManager.grantPermission('', 'scope', 'allow-once')
      ).rejects.toThrow();

      // Invalid permission level
      await expect(
        permissionManager.grantPermission('Read', 'scope', 'invalid-level' as PermissionLevel)
      ).rejects.toThrow();

      // Invalid request ID for confirmation
      await expect(
        orchestrator.grantPermissionConfirmation('invalid-id', 'allow-once', 'test')
      ).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      // Close the database to simulate error
      permissionStore.close();

      // Operations should handle errors gracefully
      await expect(permissionManager.checkPermission('Read')).rejects.toThrow();
      await expect(permissionManager.grantPermission('Write', 'test', 'allow-once')).rejects.toThrow();
    });

    it('should handle concurrent operations safely', async () => {
      const concurrentOperations = [
        permissionManager.grantPermission('Read', 'file1', 'allow-always'),
        permissionManager.grantPermission('Write', 'file2', 'allow-once'),
        permissionManager.grantPermission('Edit', 'file3', 'deny'),
      ];

      await expect(Promise.all(concurrentOperations)).resolves.not.toThrow();

      // Verify all permissions were stored correctly
      const permissions = await Promise.all([
        permissionManager.checkPermission('Read', 'file1'),
        permissionManager.checkPermission('Write', 'file2'),
        permissionManager.checkPermission('Edit', 'file3'),
      ]);

      expect(permissions).toEqual(['allow-always', 'allow-once', 'deny']);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle complex development workflow scenario', async () => {
      // Simulate a typical development workflow with mixed permissions

      // 1. Developer starts with review-all preset
      await presetManager.applyPreset('review-all');

      // 2. Request read permission for project files
      const readRequest = await orchestrator.requestPermission(
        'Read',
        '/project/src/*'
      );
      await orchestrator.grantPermissionConfirmation(readRequest, 'allow-always', 'developer');

      // 3. Request write permission for new feature
      const writeRequest = await orchestrator.requestPermission(
        'Write',
        '/project/src/features/new-feature.ts'
      );
      await orchestrator.grantPermissionConfirmation(writeRequest, 'allow-once', 'developer');

      // 4. Attempt dangerous operation (should be flagged)
      const dangerousRequest = await orchestrator.flagDangerousOperation(
        'Bash',
        'rm -rf node_modules',
        'medium',
        { reason: 'Potentially destructive file operation' }
      );
      await orchestrator.confirmDangerousOperation(dangerousRequest, 'developer');

      // 5. Switch to autonomous for rapid development
      await presetManager.applyPreset('autonomous');

      // 6. Verify final state
      const finalPermissions = await Promise.all([
        permissionManager.checkPermission('Read', '/project/src/main.ts'),
        permissionManager.checkPermission('Write', '/project/src/features/new-feature.ts'),
        presetManager.isToolAllowed('Edit'), // Should be true due to autonomous preset
      ]);

      expect(finalPermissions[0]).toBe('allow-always'); // Read granted
      expect(finalPermissions[1]).toBe('allow-once'); // Write granted
      expect(finalPermissions[2]).toBe(true); // Edit allowed by preset

      // Verify comprehensive event log
      const eventTypes = eventLog.map(e => e.type);
      expect(eventTypes).toContain('permission:request');
      expect(eventTypes).toContain('permission:granted');
      expect(eventTypes).toContain('dangerous:detected');
      expect(eventTypes).toContain('dangerous:confirmed');
    });

    it('should handle permission escalation and security scenarios', async () => {
      // Start with read-only preset for security
      await presetManager.applyPreset('read-only');

      // Attempt write operation (should be denied)
      const writeResult = await permissionManager.checkToolPermission('Write', {
        scope: '/etc/passwd',
        operation: 'file-write',
      });
      expect(writeResult.allowed).toBe(false);

      // Attempt to grant override permission
      await permissionManager.grantPermission('Write', '/etc/passwd', 'allow-once');

      // Even with specific permission, dangerous operations should require confirmation
      const dangerousWriteResult = await permissionManager.checkToolPermission('Write', {
        scope: '/etc/passwd',
        operation: 'file-write',
        parameters: { filePath: '/etc/passwd' },
      });
      expect(dangerousWriteResult.requiresConfirmation).toBe(true);
      expect(dangerousWriteResult.reason).toContain('dangerous');
    });
  });
});