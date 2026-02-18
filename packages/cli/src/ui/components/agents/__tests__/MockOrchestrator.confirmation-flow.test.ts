/**
 * Comprehensive tests for MockOrchestrator confirmation flow simulation methods
 * Tests the six new methods added for permission and dangerous operation handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockOrchestrator, createMockOrchestrator } from './test-utils/MockOrchestrator';
import type {
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData
} from '@apexcli/orchestrator';

describe('MockOrchestrator Confirmation Flow Methods', () => {
  let mockOrchestrator: MockOrchestrator;
  let eventSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    eventSpy = vi.fn();
  });

  afterEach(() => {
    mockOrchestrator.cleanup();
  });

  describe('simulatePermissionRequest', () => {
    it('should emit permission:request event with default data', () => {
      mockOrchestrator.on('permission:request', eventSpy);

      const result = mockOrchestrator.simulatePermissionRequest();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as PermissionRequestEventData;

      // Check default values
      expect(eventData.requestId).toMatch(/^mock-request-[a-z0-9]{9}$/);
      expect(eventData.tool).toBe('Write');
      expect(eventData.scope).toBe('/test/path');
      expect(eventData.description).toBe('Mock permission request for testing');
      expect(eventData.isDangerous).toBe(false);
      expect(eventData.agent).toBe('developer');
      expect(eventData.timestamp).toBeInstanceOf(Date);

      // Verify return value matches emitted data
      expect(result).toEqual(eventData);
    });

    it('should emit permission:request event with custom data overrides', () => {
      mockOrchestrator.on('permission:request', eventSpy);

      const customData = {
        tool: 'Bash' as const,
        scope: '/custom/path',
        description: 'Custom permission request',
        isDangerous: true,
        agent: 'devops'
      };

      const result = mockOrchestrator.simulatePermissionRequest(customData);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as PermissionRequestEventData;

      expect(eventData.tool).toBe('Bash');
      expect(eventData.scope).toBe('/custom/path');
      expect(eventData.description).toBe('Custom permission request');
      expect(eventData.isDangerous).toBe(true);
      expect(eventData.agent).toBe('devops');

      // Still has defaults for unspecified fields
      expect(eventData.requestId).toMatch(/^mock-request-[a-z0-9]{9}$/);
      expect(eventData.timestamp).toBeInstanceOf(Date);

      expect(result).toEqual(eventData);
    });

    it('should generate unique request IDs for multiple calls', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const result = mockOrchestrator.simulatePermissionRequest();
        ids.add(result.requestId);
      }

      expect(ids.size).toBe(10); // All IDs should be unique
    });

    it('should handle partial overrides correctly', () => {
      mockOrchestrator.on('permission:request', eventSpy);

      const result = mockOrchestrator.simulatePermissionRequest({
        description: 'Partial override test'
      });

      const eventData = eventSpy.mock.calls[0][0] as PermissionRequestEventData;

      expect(eventData.description).toBe('Partial override test');
      expect(eventData.tool).toBe('Write'); // Default value preserved
      expect(eventData.scope).toBe('/test/path'); // Default value preserved
    });
  });

  describe('simulatePermissionGranted', () => {
    it('should emit permission:granted event with default data', () => {
      mockOrchestrator.on('permission:granted', eventSpy);

      const result = mockOrchestrator.simulatePermissionGranted();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as PermissionGrantedEventData;

      expect(eventData.requestId).toMatch(/^mock-request-[a-z0-9]{9}$/);
      expect(eventData.tool).toBe('Write');
      expect(eventData.scope).toBe('/test/path');
      expect(eventData.level).toBe('allow-once');
      expect(eventData.grantedBy).toBe('user');
      expect(eventData.timestamp).toBeInstanceOf(Date);
      expect(eventData.reason).toBe('Test permission grant');

      expect(result).toEqual(eventData);
    });

    it('should emit permission:granted event with custom data', () => {
      mockOrchestrator.on('permission:granted', eventSpy);

      const customData = {
        tool: 'Edit' as const,
        level: 'allow-always' as const,
        grantedBy: 'admin',
        reason: 'Administrative override'
      };

      const result = mockOrchestrator.simulatePermissionGranted(customData);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as PermissionGrantedEventData;

      expect(eventData.tool).toBe('Edit');
      expect(eventData.level).toBe('allow-always');
      expect(eventData.grantedBy).toBe('admin');
      expect(eventData.reason).toBe('Administrative override');

      expect(result).toEqual(eventData);
    });

    it('should handle all permission levels correctly', () => {
      const levels = ['allow-once', 'allow-always'] as const;

      levels.forEach(level => {
        mockOrchestrator.removeAllListeners('permission:granted');
        mockOrchestrator.on('permission:granted', eventSpy);

        const result = mockOrchestrator.simulatePermissionGranted({ level });
        const eventData = eventSpy.mock.calls[0][0] as PermissionGrantedEventData;

        expect(eventData.level).toBe(level);
      });
    });
  });

  describe('simulatePermissionDenied', () => {
    it('should emit permission:denied event with default data', () => {
      mockOrchestrator.on('permission:denied', eventSpy);

      const result = mockOrchestrator.simulatePermissionDenied();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as PermissionDeniedEventData;

      expect(eventData.requestId).toMatch(/^mock-request-[a-z0-9]{9}$/);
      expect(eventData.tool).toBe('Write');
      expect(eventData.scope).toBe('/test/path');
      expect(eventData.deniedBy).toBe('user');
      expect(eventData.timestamp).toBeInstanceOf(Date);
      expect(eventData.reason).toBe('Test permission denial');

      expect(result).toEqual(eventData);
    });

    it('should emit permission:denied event with custom denial reasons', () => {
      mockOrchestrator.on('permission:denied', eventSpy);

      const customData = {
        tool: 'Bash' as const,
        deniedBy: 'security-policy',
        reason: 'Shell access not permitted in production'
      };

      const result = mockOrchestrator.simulatePermissionDenied(customData);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as PermissionDeniedEventData;

      expect(eventData.tool).toBe('Bash');
      expect(eventData.deniedBy).toBe('security-policy');
      expect(eventData.reason).toBe('Shell access not permitted in production');

      expect(result).toEqual(eventData);
    });
  });

  describe('simulateDangerousOperationDetected', () => {
    it('should emit dangerous:detected event with default data', () => {
      mockOrchestrator.on('dangerous:detected', eventSpy);

      const result = mockOrchestrator.simulateDangerousOperationDetected();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as DangerousOperationDetectedEventData;

      expect(eventData.operationId).toMatch(/^mock-op-[a-z0-9]{9}$/);
      expect(eventData.tool).toBe('Bash');
      expect(eventData.operation).toBe('rm -rf /');
      expect(eventData.riskLevel).toBe('critical');
      expect(eventData.riskDescription).toBe('This operation could delete system files');
      expect(eventData.agent).toBe('developer');
      expect(eventData.timestamp).toBeInstanceOf(Date);
      expect(eventData.context).toEqual({ command: 'rm -rf /', workingDir: '/' });

      expect(result).toEqual(eventData);
    });

    it('should emit dangerous:detected event with custom risk levels and operations', () => {
      mockOrchestrator.on('dangerous:detected', eventSpy);

      const customData = {
        tool: 'Write' as const,
        operation: 'overwrite system config',
        riskLevel: 'high' as const,
        riskDescription: 'Modifying critical configuration file',
        agent: 'architect',
        context: { file: '/etc/passwd', backup: false }
      };

      const result = mockOrchestrator.simulateDangerousOperationDetected(customData);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as DangerousOperationDetectedEventData;

      expect(eventData.tool).toBe('Write');
      expect(eventData.operation).toBe('overwrite system config');
      expect(eventData.riskLevel).toBe('high');
      expect(eventData.riskDescription).toBe('Modifying critical configuration file');
      expect(eventData.agent).toBe('architect');
      expect(eventData.context).toEqual({ file: '/etc/passwd', backup: false });

      expect(result).toEqual(eventData);
    });

    it('should generate unique operation IDs for multiple calls', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const result = mockOrchestrator.simulateDangerousOperationDetected();
        ids.add(result.operationId);
      }

      expect(ids.size).toBe(10); // All IDs should be unique
    });
  });

  describe('simulateDangerousOperationConfirmed', () => {
    it('should emit dangerous:confirmed event with default data', () => {
      mockOrchestrator.on('dangerous:confirmed', eventSpy);

      const result = mockOrchestrator.simulateDangerousOperationConfirmed();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as DangerousOperationConfirmedEventData;

      expect(eventData.operationId).toMatch(/^mock-op-[a-z0-9]{9}$/);
      expect(eventData.tool).toBe('Bash');
      expect(eventData.operation).toBe('rm -rf /');
      expect(eventData.confirmedBy).toBe('user');
      expect(eventData.timestamp).toBeInstanceOf(Date);
      expect(eventData.reason).toBe('User confirmed dangerous operation');

      expect(result).toEqual(eventData);
    });

    it('should emit dangerous:confirmed event with custom confirmation data', () => {
      mockOrchestrator.on('dangerous:confirmed', eventSpy);

      const customData = {
        tool: 'Write' as const,
        operation: 'delete user data',
        confirmedBy: 'admin',
        reason: 'Emergency cleanup approved by administrator'
      };

      const result = mockOrchestrator.simulateDangerousOperationConfirmed(customData);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as DangerousOperationConfirmedEventData;

      expect(eventData.tool).toBe('Write');
      expect(eventData.operation).toBe('delete user data');
      expect(eventData.confirmedBy).toBe('admin');
      expect(eventData.reason).toBe('Emergency cleanup approved by administrator');

      expect(result).toEqual(eventData);
    });
  });

  describe('simulateDangerousOperationBlocked', () => {
    it('should emit dangerous:blocked event with default data', () => {
      mockOrchestrator.on('dangerous:blocked', eventSpy);

      const result = mockOrchestrator.simulateDangerousOperationBlocked();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as DangerousOperationBlockedEventData;

      expect(eventData.operationId).toMatch(/^mock-op-[a-z0-9]{9}$/);
      expect(eventData.tool).toBe('Bash');
      expect(eventData.operation).toBe('rm -rf /');
      expect(eventData.blockedBy).toBe('security-policy');
      expect(eventData.timestamp).toBeInstanceOf(Date);
      expect(eventData.reason).toBe('Operation blocked due to security policy');

      expect(result).toEqual(eventData);
    });

    it('should emit dangerous:blocked event with custom blocking data', () => {
      mockOrchestrator.on('dangerous:blocked', eventSpy);

      const customData = {
        tool: 'Edit' as const,
        operation: 'modify system registry',
        blockedBy: 'safety-system',
        reason: 'Registry modification blocked for system stability'
      };

      const result = mockOrchestrator.simulateDangerousOperationBlocked(customData);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const eventData = eventSpy.mock.calls[0][0] as DangerousOperationBlockedEventData;

      expect(eventData.tool).toBe('Edit');
      expect(eventData.operation).toBe('modify system registry');
      expect(eventData.blockedBy).toBe('safety-system');
      expect(eventData.reason).toBe('Registry modification blocked for system stability');

      expect(result).toEqual(eventData);
    });
  });

  describe('Event Type Consistency', () => {
    it('should maintain proper type definitions for all events', () => {
      // Test that all methods return properly typed data
      const permissionRequest = mockOrchestrator.simulatePermissionRequest();
      const permissionGranted = mockOrchestrator.simulatePermissionGranted();
      const permissionDenied = mockOrchestrator.simulatePermissionDenied();
      const dangerousDetected = mockOrchestrator.simulateDangerousOperationDetected();
      const dangerousConfirmed = mockOrchestrator.simulateDangerousOperationConfirmed();
      const dangerousBlocked = mockOrchestrator.simulateDangerousOperationBlocked();

      // TypeScript compilation ensures proper typing
      expect(permissionRequest).toBeDefined();
      expect(permissionGranted).toBeDefined();
      expect(permissionDenied).toBeDefined();
      expect(dangerousDetected).toBeDefined();
      expect(dangerousConfirmed).toBeDefined();
      expect(dangerousBlocked).toBeDefined();

      // All should have timestamps
      expect(permissionRequest.timestamp).toBeInstanceOf(Date);
      expect(permissionGranted.timestamp).toBeInstanceOf(Date);
      expect(permissionDenied.timestamp).toBeInstanceOf(Date);
      expect(dangerousDetected.timestamp).toBeInstanceOf(Date);
      expect(dangerousConfirmed.timestamp).toBeInstanceOf(Date);
      expect(dangerousBlocked.timestamp).toBeInstanceOf(Date);
    });

    it('should support all tool types consistently', () => {
      const tools = ['Write', 'Edit', 'Read', 'Bash', 'Glob'] as const;

      tools.forEach(tool => {
        const request = mockOrchestrator.simulatePermissionRequest({ tool });
        const granted = mockOrchestrator.simulatePermissionGranted({ tool });
        const denied = mockOrchestrator.simulatePermissionDenied({ tool });
        const detected = mockOrchestrator.simulateDangerousOperationDetected({ tool });
        const confirmed = mockOrchestrator.simulateDangerousOperationConfirmed({ tool });
        const blocked = mockOrchestrator.simulateDangerousOperationBlocked({ tool });

        expect(request.tool).toBe(tool);
        expect(granted.tool).toBe(tool);
        expect(denied.tool).toBe(tool);
        expect(detected.tool).toBe(tool);
        expect(confirmed.tool).toBe(tool);
        expect(blocked.tool).toBe(tool);
      });
    });
  });

  describe('Event Emission Patterns', () => {
    it('should emit events synchronously and immediately', () => {
      let eventReceived = false;

      mockOrchestrator.on('permission:request', () => {
        eventReceived = true;
      });

      mockOrchestrator.simulatePermissionRequest();

      expect(eventReceived).toBe(true);
    });

    it('should handle multiple event listeners properly', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      mockOrchestrator.on('permission:request', listener1);
      mockOrchestrator.on('permission:request', listener2);
      mockOrchestrator.on('permission:request', listener3);

      mockOrchestrator.simulatePermissionRequest();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      // All should receive the same event data
      expect(listener1.mock.calls[0][0]).toEqual(listener2.mock.calls[0][0]);
      expect(listener2.mock.calls[0][0]).toEqual(listener3.mock.calls[0][0]);
    });

    it('should not interfere with other event types', () => {
      const permissionSpy = vi.fn();
      const dangerousSpy = vi.fn();
      const taskSpy = vi.fn();

      mockOrchestrator.on('permission:request', permissionSpy);
      mockOrchestrator.on('dangerous:detected', dangerousSpy);
      mockOrchestrator.on('task:started', taskSpy);

      // Fire permission event
      mockOrchestrator.simulatePermissionRequest();

      expect(permissionSpy).toHaveBeenCalledTimes(1);
      expect(dangerousSpy).toHaveBeenCalledTimes(0);
      expect(taskSpy).toHaveBeenCalledTimes(0);

      // Fire dangerous event
      mockOrchestrator.simulateDangerousOperationDetected();

      expect(permissionSpy).toHaveBeenCalledTimes(1);
      expect(dangerousSpy).toHaveBeenCalledTimes(1);
      expect(taskSpy).toHaveBeenCalledTimes(0);

      // Fire task event
      mockOrchestrator.simulateTaskStart({ id: 'test' });

      expect(permissionSpy).toHaveBeenCalledTimes(1);
      expect(dangerousSpy).toHaveBeenCalledTimes(1);
      expect(taskSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with Existing Methods', () => {
    it('should work alongside existing simulation methods', () => {
      const allEvents: string[] = [];

      // Listen to various event types
      mockOrchestrator.on('permission:request', () => allEvents.push('permission-request'));
      mockOrchestrator.on('dangerous:detected', () => allEvents.push('dangerous-detected'));
      mockOrchestrator.on('task:started', () => allEvents.push('task-started'));
      mockOrchestrator.on('agent:transition', () => allEvents.push('agent-transition'));

      // Mix new and existing methods
      mockOrchestrator.simulatePermissionRequest();
      mockOrchestrator.simulateTaskStart({ id: 'test-task' });
      mockOrchestrator.simulateDangerousOperationDetected();
      mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');

      expect(allEvents).toEqual([
        'permission-request',
        'task-started',
        'dangerous-detected',
        'agent-transition'
      ]);
    });

    it('should respect the same event emitter configuration', () => {
      // Verify max listeners is respected
      expect(mockOrchestrator.getMaxListeners()).toBe(20);

      // Verify cleanup works with new events
      const spy = vi.fn();
      mockOrchestrator.on('permission:request', spy);
      mockOrchestrator.on('dangerous:detected', spy);

      mockOrchestrator.cleanup();

      mockOrchestrator.simulatePermissionRequest();
      mockOrchestrator.simulateDangerousOperationDetected();

      expect(spy).toHaveBeenCalledTimes(0);
    });
  });
});