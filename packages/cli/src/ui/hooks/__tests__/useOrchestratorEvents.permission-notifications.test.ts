import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { EventEmitter } from 'eventemitter3';
import { useOrchestratorEvents } from '../useOrchestratorEvents.js';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

/**
 * Test suite for permission notification handling in CLI
 *
 * This verifies that:
 * 1. CLI receives permission change events from orchestrator
 * 2. Permission notifications are displayed to users
 * 3. Notification content is accurate and actionable
 * 4. Events are handled properly in the React hook
 */
describe('useOrchestratorEvents - Permission Notifications', () => {
  let mockOrchestrator: Partial<ApexOrchestrator> & EventEmitter;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Create mock orchestrator with EventEmitter functionality
    mockOrchestrator = Object.assign(new EventEmitter(), {
      // Add any required orchestrator methods
    }) as Partial<ApexOrchestrator> & EventEmitter;

    // Spy on console methods to verify notification display
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Permission Request Notifications', () => {
    it('should display permission request notification when event is emitted', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId: 'test-task-123',
          debug: true,
        })
      );

      const requestEvent = {
        taskId: 'test-task-123',
        toolName: 'Write',
        timestamp: new Date(),
        scope: '/project/src/component.tsx',
        reason: 'Need to create new React component',
        agentName: 'developer'
      };

      act(() => {
        mockOrchestrator.emit('permission:request', requestEvent);
      });

      // Verify console notification was displayed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission requested for Write tool')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scope: /project/src/component.tsx')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reason: Need to create new React component')
      );
    });

    it('should display accurate task and agent information in notification', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId: 'feature-task-456',
          debug: true,
        })
      );

      const requestEvent = {
        taskId: 'feature-task-456',
        toolName: 'Bash',
        timestamp: new Date(),
        scope: 'npm install new-package',
        reason: 'Installing required dependency',
        agentName: 'architect'
      };

      act(() => {
        mockOrchestrator.emit('permission:request', requestEvent);
      });

      // Verify specific task and agent information is displayed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task: feature-task-456')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent: architect')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool: Bash')
      );
    });
  });

  describe('Permission Granted Notifications', () => {
    it('should display permission granted notification with level information', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId: 'test-task-789',
          debug: true,
        })
      );

      const grantedEvent = {
        taskId: 'test-task-789',
        toolName: 'Edit',
        timestamp: new Date(),
        level: 'allow-once' as const,
        grantedBy: 'user',
        grantReason: 'Approved for component update'
      };

      act(() => {
        mockOrchestrator.emit('permission:granted', grantedEvent);
      });

      // Verify permission granted notification
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission GRANTED for Edit tool')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Level: allow-once')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Granted by: user')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reason: Approved for component update')
      );
    });

    it('should distinguish between different permission levels in notifications', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: true,
        })
      );

      // Test allow-always permission
      act(() => {
        mockOrchestrator.emit('permission:granted', {
          taskId: 'task-1',
          toolName: 'Read',
          timestamp: new Date(),
          level: 'allow-always' as const,
          grantedBy: 'admin'
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Level: allow-always')
      );

      // Test allow-once permission
      act(() => {
        mockOrchestrator.emit('permission:granted', {
          taskId: 'task-2',
          toolName: 'Write',
          timestamp: new Date(),
          level: 'allow-once' as const,
          grantedBy: 'user'
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Level: allow-once')
      );
    });
  });

  describe('Permission Denied Notifications', () => {
    it('should display permission denied notification with warning styling', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId: 'blocked-task-123',
          debug: true,
        })
      );

      const deniedEvent = {
        taskId: 'blocked-task-123',
        toolName: 'Bash',
        timestamp: new Date(),
        denialReason: 'Tool not allowed in read-only mode',
        deniedBy: 'system'
      };

      act(() => {
        mockOrchestrator.emit('permission:denied', deniedEvent);
      });

      // Verify warning-level notification for denial
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission DENIED for Bash tool')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reason: Tool not allowed in read-only mode')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Denied by: system')
      );
    });

    it('should provide actionable information in denial notifications', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: true,
        })
      );

      const deniedEvent = {
        taskId: 'security-task-456',
        toolName: 'Write',
        timestamp: new Date(),
        denialReason: 'Insufficient permissions for system directory',
        deniedBy: 'security-policy'
      };

      act(() => {
        mockOrchestrator.emit('permission:denied', deniedEvent);
      });

      // Verify actionable information is provided
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission DENIED')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('security-policy')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Insufficient permissions for system directory')
      );
    });
  });

  describe('Dangerous Operation Notifications', () => {
    it('should display dangerous operation detection with error styling', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: true,
        })
      );

      const dangerousEvent = {
        taskId: 'risky-task-789',
        toolName: 'Bash',
        timestamp: new Date(),
        operationType: 'file-deletion',
        riskLevel: 'high' as const,
        description: 'Attempting to delete critical system files',
        metadata: { command: 'rm -rf /etc/*' }
      };

      act(() => {
        mockOrchestrator.emit('dangerous:detected', dangerousEvent);
      });

      // Verify error-level notification for dangerous operations
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DANGEROUS OPERATION DETECTED')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Risk Level: high')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation: file-deletion')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempting to delete critical system files')
      );
    });

    it('should display confirmation and blocking notifications appropriately', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: true,
        })
      );

      // Test dangerous operation confirmation
      act(() => {
        mockOrchestrator.emit('dangerous:confirmed', {
          taskId: 'confirmed-task',
          toolName: 'Bash',
          timestamp: new Date(),
          operationType: 'privilege-escalation',
          confirmedBy: 'admin',
          confirmation: 'Admin approved sudo access for deployment'
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dangerous operation CONFIRMED')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Confirmed by: admin')
      );

      // Test dangerous operation blocking
      act(() => {
        mockOrchestrator.emit('dangerous:blocked', {
          taskId: 'blocked-task',
          toolName: 'Write',
          timestamp: new Date(),
          operationType: 'data-modification',
          blockReason: 'Operation exceeds safety threshold',
          blockedBy: 'safety-system'
        });
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dangerous operation BLOCKED')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Blocked by: safety-system')
      );
    });
  });

  describe('Notification Content Accuracy', () => {
    it('should format timestamps correctly in notifications', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: true,
        })
      );

      const testTimestamp = new Date('2024-01-15T10:30:00Z');
      const requestEvent = {
        taskId: 'timestamp-test',
        toolName: 'Read',
        timestamp: testTimestamp,
        reason: 'Test timestamp formatting'
      };

      act(() => {
        mockOrchestrator.emit('permission:request', requestEvent);
      });

      // Verify timestamp is displayed in notifications
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('10:30:00')
      );
    });

    it('should handle missing optional fields gracefully', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: true,
        })
      );

      // Test with minimal event data
      const minimalEvent = {
        taskId: 'minimal-test',
        toolName: 'Test',
        timestamp: new Date()
      };

      act(() => {
        mockOrchestrator.emit('permission:request', minimalEvent);
      });

      // Should not crash and should display available information
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission requested for Test tool')
      );
    });
  });

  describe('Event Filtering and Task-specific Notifications', () => {
    it('should only display notifications for the specified task ID', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId: 'target-task-123',
          debug: true,
        })
      );

      // Emit event for target task
      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'target-task-123',
          toolName: 'Write',
          timestamp: new Date(),
          reason: 'Target task operation'
        });
      });

      // Emit event for different task
      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'other-task-456',
          toolName: 'Read',
          timestamp: new Date(),
          reason: 'Other task operation'
        });
      });

      // Should only show notification for target task
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Target task operation')
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Other task operation')
      );
    });

    it('should display all notifications when no task filter is specified', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: true,
        })
      );

      // Emit events for multiple tasks
      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'task-1',
          toolName: 'Write',
          timestamp: new Date(),
          reason: 'First task operation'
        });
      });

      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'task-2',
          toolName: 'Read',
          timestamp: new Date(),
          reason: 'Second task operation'
        });
      });

      // Should show notifications for both tasks
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('First task operation')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Second task operation')
      );
    });
  });
});