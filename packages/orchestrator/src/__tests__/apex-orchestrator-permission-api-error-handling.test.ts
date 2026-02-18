/**
 * @fileoverview Unit tests for ApexOrchestrator permission API error handling
 *
 * This test suite focuses on edge cases and error scenarios for the permission API methods
 * in ApexOrchestrator that may not be covered in the comprehensive integration tests.
 * Specifically tests:
 * 1. Error handling in requestPermission() method
 * 2. Error handling in grantPermissionConfirmation() method
 * 3. Error handling in denyPermissionConfirmation() method
 * 4. Event emission failures and recovery
 * 5. Invalid parameter handling
 * 6. Uninitialized state handling
 */

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';
import type { PermissionLevel } from '@apexcli/core';

describe('ApexOrchestrator Permission API Error Handling', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-permission-api-error-test-'));

    // Create .apex directory
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Create minimal config
    const configContent = `
project:
  name: test-permission-api-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

    await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('requestPermission() Error Handling', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
      await orchestrator.initialize();
    });

    it('should handle empty tool name gracefully', async () => {
      const requestId = await orchestrator.requestPermission(
        'task-123',
        '', // Empty tool name
        'test-scope',
        'Test description',
        false,
        'test-agent'
      );

      expect(requestId).toMatch(/^perm-req-\d+-[a-z0-9]+$/);
    });

    it('should handle undefined scope parameter', async () => {
      const requestId = await orchestrator.requestPermission(
        'task-123',
        'TestTool',
        undefined, // Undefined scope
        'Test description',
        false,
        'test-agent'
      );

      expect(requestId).toMatch(/^perm-req-\d+-[a-z0-9]+$/);
    });

    it('should handle empty description parameter', async () => {
      const requestId = await orchestrator.requestPermission(
        'task-123',
        'TestTool',
        'test-scope',
        '', // Empty description
        false,
        'test-agent'
      );

      expect(requestId).toMatch(/^perm-req-\d+-[a-z0-9]+$/);
    });

    it('should handle very long parameter values', async () => {
      const longString = 'x'.repeat(10000);

      const requestId = await orchestrator.requestPermission(
        longString, // Very long task ID
        longString, // Very long tool name
        longString, // Very long scope
        longString, // Very long description
        false,
        longString  // Very long agent name
      );

      expect(requestId).toMatch(/^perm-req-\d+-[a-z0-9]+$/);
    });

    it('should emit permission:request event even with invalid parameters', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('permission:request', eventSpy);

      await orchestrator.requestPermission(
        'task-123',
        'TestTool',
        'test-scope',
        'Test description',
        false,
        'test-agent',
        { invalidKey: undefined } // Metadata with undefined values
      );

      expect(eventSpy).toHaveBeenCalledOnce();
    });

    it('should generate unique request IDs even when called rapidly', async () => {
      const requests = await Promise.all([
        orchestrator.requestPermission('task-1', 'Tool1', 'scope1', 'desc1', false, 'agent1'),
        orchestrator.requestPermission('task-2', 'Tool2', 'scope2', 'desc2', false, 'agent2'),
        orchestrator.requestPermission('task-3', 'Tool3', 'scope3', 'desc3', false, 'agent3'),
        orchestrator.requestPermission('task-4', 'Tool4', 'scope4', 'desc4', false, 'agent4'),
        orchestrator.requestPermission('task-5', 'Tool5', 'scope5', 'desc5', false, 'agent5'),
      ]);

      const uniqueIds = new Set(requests);
      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('grantPermissionConfirmation() Error Handling', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
      await orchestrator.initialize();
    });

    it('should handle invalid permission levels gracefully', async () => {
      // Should not throw even with invalid level - PermissionManager should handle validation
      await expect(
        orchestrator.grantPermissionConfirmation(
          'req-123',
          'task-123',
          'TestTool',
          'test-scope',
          'invalid-level' as PermissionLevel,
          'test-user',
          'Test reason'
        )
      ).resolves.not.toThrow();
    });

    it('should handle empty request ID', async () => {
      await expect(
        orchestrator.grantPermissionConfirmation(
          '', // Empty request ID
          'task-123',
          'TestTool',
          'test-scope',
          'allow-once',
          'test-user',
          'Test reason'
        )
      ).resolves.not.toThrow();
    });

    it('should handle undefined reason parameter', async () => {
      await expect(
        orchestrator.grantPermissionConfirmation(
          'req-123',
          'task-123',
          'TestTool',
          'test-scope',
          'allow-once',
          'test-user'
          // No reason parameter
        )
      ).resolves.not.toThrow();
    });

    it('should emit permission:granted event even with edge case parameters', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('permission:granted', eventSpy);

      await orchestrator.grantPermissionConfirmation(
        'req-123',
        'task-123',
        'TestTool',
        undefined, // undefined scope
        'allow-once',
        '', // empty grantedBy
        undefined // undefined reason
      );

      expect(eventSpy).toHaveBeenCalledOnce();
      const eventData = eventSpy.mock.calls[0][0];
      expect(eventData.requestId).toBe('req-123');
      expect(eventData.scope).toBeUndefined();
      expect(eventData.grantedBy).toBe('');
      expect(eventData.reason).toBeUndefined();
    });

    it('should handle permission manager failures gracefully', async () => {
      // Mock permission manager to throw an error
      const mockPermissionManager = {
        grantPermission: vi.fn().mockRejectedValue(new Error('Permission manager error'))
      };

      // Replace the permission manager (accessing private property for testing)
      (orchestrator as any).permissionManager = mockPermissionManager;

      // Should propagate the error from permission manager
      await expect(
        orchestrator.grantPermissionConfirmation(
          'req-123',
          'task-123',
          'TestTool',
          'test-scope',
          'allow-once',
          'test-user',
          'Test reason'
        )
      ).rejects.toThrow('Permission manager error');
    });
  });

  describe('denyPermissionConfirmation() Error Handling', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
      await orchestrator.initialize();
    });

    it('should handle empty reason parameter', async () => {
      await expect(
        orchestrator.denyPermissionConfirmation(
          'req-123',
          'task-123',
          'TestTool',
          'test-scope',
          'test-user',
          '' // Empty reason
        )
      ).resolves.not.toThrow();
    });

    it('should handle undefined scope parameter', async () => {
      await expect(
        orchestrator.denyPermissionConfirmation(
          'req-123',
          'task-123',
          'TestTool',
          undefined, // undefined scope
          'test-user',
          'Access denied'
        )
      ).resolves.not.toThrow();
    });

    it('should emit permission:denied event with correct deny level', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('permission:denied', eventSpy);

      await orchestrator.denyPermissionConfirmation(
        'req-123',
        'task-123',
        'TestTool',
        'test-scope',
        'test-user',
        'Security violation'
      );

      expect(eventSpy).toHaveBeenCalledOnce();
      const eventData = eventSpy.mock.calls[0][0];
      expect(eventData.requestId).toBe('req-123');
      expect(eventData.tool).toBe('TestTool');
      expect(eventData.scope).toBe('test-scope');
      expect(eventData.deniedBy).toBe('test-user');
      expect(eventData.reason).toBe('Security violation');
    });

    it('should handle permission manager failures during denial', async () => {
      // Mock permission manager to throw an error
      const mockPermissionManager = {
        grantPermission: vi.fn().mockRejectedValue(new Error('Permission store unavailable'))
      };

      // Replace the permission manager (accessing private property for testing)
      (orchestrator as any).permissionManager = mockPermissionManager;

      // Should propagate the error from permission manager
      await expect(
        orchestrator.denyPermissionConfirmation(
          'req-123',
          'task-123',
          'TestTool',
          'test-scope',
          'test-user',
          'Denied for testing'
        )
      ).rejects.toThrow('Permission store unavailable');
    });
  });

  describe('Uninitialized State Error Handling', () => {
    it('should handle permission requests before initialization', async () => {
      // Create orchestrator but don't initialize
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });

      // Should trigger initialization internally and work
      await expect(
        orchestrator.requestPermission(
          'task-123',
          'TestTool',
          'test-scope',
          'Test description',
          false,
          'test-agent'
        )
      ).resolves.toMatch(/^perm-req-\d+-[a-z0-9]+$/);
    });

    it('should handle grant confirmation before initialization', async () => {
      // Create orchestrator but don't initialize
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });

      // Should trigger initialization internally and work
      await expect(
        orchestrator.grantPermissionConfirmation(
          'req-123',
          'task-123',
          'TestTool',
          'test-scope',
          'allow-once',
          'test-user',
          'Test reason'
        )
      ).resolves.not.toThrow();
    });

    it('should handle deny confirmation before initialization', async () => {
      // Create orchestrator but don't initialize
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });

      // Should trigger initialization internally and work
      await expect(
        orchestrator.denyPermissionConfirmation(
          'req-123',
          'task-123',
          'TestTool',
          'test-scope',
          'test-user',
          'Denied for testing'
        )
      ).resolves.not.toThrow();
    });
  });

  describe('Concurrent Permission Operations', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
      await orchestrator.initialize();
    });

    it('should handle concurrent permission requests without conflicts', async () => {
      const requests = await Promise.all([
        orchestrator.requestPermission('task-1', 'Tool1', 'scope1', 'desc1', false, 'agent1'),
        orchestrator.requestPermission('task-2', 'Tool2', 'scope2', 'desc2', false, 'agent2'),
        orchestrator.requestPermission('task-3', 'Tool3', 'scope3', 'desc3', false, 'agent3'),
      ]);

      // All should succeed and have unique IDs
      expect(requests).toHaveLength(3);
      const uniqueIds = new Set(requests);
      expect(uniqueIds.size).toBe(3);
    });

    it('should handle concurrent grant/deny operations', async () => {
      await expect(Promise.all([
        orchestrator.grantPermissionConfirmation('req-1', 'task-1', 'Tool1', 'scope1', 'allow-once', 'user1', 'reason1'),
        orchestrator.denyPermissionConfirmation('req-2', 'task-2', 'Tool2', 'scope2', 'user2', 'reason2'),
        orchestrator.grantPermissionConfirmation('req-3', 'task-3', 'Tool3', 'scope3', 'allow-always', 'user3', 'reason3'),
      ])).resolves.not.toThrow();
    });
  });

  describe('Event System Integration', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
      await orchestrator.initialize();
    });

    it('should maintain event ordering under rapid operations', async () => {
      const events: Array<{ type: string; timestamp: number }> = [];

      orchestrator.on('permission:request', () => {
        events.push({ type: 'request', timestamp: Date.now() });
      });

      orchestrator.on('permission:granted', () => {
        events.push({ type: 'granted', timestamp: Date.now() });
      });

      orchestrator.on('permission:denied', () => {
        events.push({ type: 'denied', timestamp: Date.now() });
      });

      // Rapid sequence of operations
      await orchestrator.requestPermission('task-1', 'Tool1', 'scope1', 'desc1', false, 'agent1');
      await orchestrator.grantPermissionConfirmation('req-1', 'task-1', 'Tool1', 'scope1', 'allow-once', 'user1', 'reason1');
      await orchestrator.requestPermission('task-2', 'Tool2', 'scope2', 'desc2', false, 'agent2');
      await orchestrator.denyPermissionConfirmation('req-2', 'task-2', 'Tool2', 'scope2', 'user2', 'reason2');

      expect(events).toHaveLength(4);
      expect(events[0].type).toBe('request');
      expect(events[1].type).toBe('granted');
      expect(events[2].type).toBe('request');
      expect(events[3].type).toBe('denied');
    });

    it('should handle event listener exceptions gracefully', async () => {
      // Add a problematic event listener
      orchestrator.on('permission:request', () => {
        throw new Error('Event listener error');
      });

      // Should not prevent the operation from completing
      await expect(
        orchestrator.requestPermission(
          'task-123',
          'TestTool',
          'test-scope',
          'Test description',
          false,
          'test-agent'
        )
      ).resolves.toMatch(/^perm-req-\d+-[a-z0-9]+$/);
    });
  });
});