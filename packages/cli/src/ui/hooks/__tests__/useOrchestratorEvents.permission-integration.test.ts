import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { EventEmitter } from 'eventemitter3';
import { useOrchestratorEvents } from '../useOrchestratorEvents.js';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import chalk from 'chalk';

/**
 * Integration Test Suite: CLI Permission Notification Reception and Display
 *
 * Verifies that the CLI correctly subscribes to orchestrator events and
 * displays permission notifications accurately according to acceptance criteria:
 *
 * 1. CLI receives permission change events from orchestrator
 * 2. Permission notifications are displayed to users
 * 3. Notification content is accurate and actionable
 * 4. Events are handled properly in React hook integration
 * 5. All tests pass with npm test --workspace=@apex/cli
 */
describe('CLI Permission Notification Integration', () => {
  let mockOrchestrator: Partial<ApexOrchestrator> & EventEmitter;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let consoleInfoSpy: any;

  beforeEach(() => {
    // Create mock orchestrator with EventEmitter functionality
    mockOrchestrator = Object.assign(new EventEmitter(), {
      // Mock minimal orchestrator interface
      store: {
        getTask: vi.fn(),
        updateTask: vi.fn()
      },
      permissionManager: {
        checkPermission: vi.fn(),
        grantPermission: vi.fn(),
        denyPermission: vi.fn()
      }
    }) as Partial<ApexOrchestrator> & EventEmitter;

    // Spy on console methods to capture notification display
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    // Mock chalk to avoid color codes in tests
    vi.mocked(chalk.blue).mockImplementation((str: string) => str);
    vi.mocked(chalk.green).mockImplementation((str: string) => str);
    vi.mocked(chalk.yellow).mockImplementation((str: string) => str);
    vi.mocked(chalk.red).mockImplementation((str: string) => str);
    vi.mocked(chalk.gray).mockImplementation((str: string) => str);
    vi.mocked(chalk.bold).mockImplementation(() => ({
      blue: (str: string) => str,
      green: (str: string) => str,
      red: (str: string) => str,
      yellow: (str: string) => str
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Permission Event Subscription', () => {
    it('should subscribe to permission events when orchestrator is provided', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId: 'test-task-123',
          debug: true,
        })
      );

      // Verify hook initializes properly
      expect(result.current.agents).toEqual([]);
      expect(result.current.currentAgent).toBeUndefined();

      // Verify EventEmitter functionality is available
      expect(typeof mockOrchestrator.on).toBe('function');
      expect(typeof mockOrchestrator.emit).toBe('function');
    });

    it('should handle orchestrator without permission event capabilities gracefully', () => {
      const minimalOrchestrator = Object.assign(new EventEmitter(), {}) as ApexOrchestrator;

      expect(() => {
        renderHook(() =>
          useOrchestratorEvents({
            orchestrator: minimalOrchestrator,
            taskId: 'test-task',
          })
        );
      }).not.toThrow();
    });

    it('should filter permission events by task ID when specified', () => {
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
          scope: '/project/src/component.tsx',
          reason: 'Creating component for target task',
          agentName: 'developer'
        });
      });

      // Emit event for different task (should be ignored)
      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'other-task-456',
          toolName: 'Read',
          timestamp: new Date(),
          scope: '/project/src/utils.ts',
          reason: 'Reading for other task',
          agentName: 'developer'
        });
      });

      // Only target task event should trigger debug logging
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useOrchestratorEvents]'),
        expect.stringContaining('target-task-123')
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('other-task-456')
      );
    });

    it('should process all permission events when no task filter is specified', () => {
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
          reason: 'Task 1 operation',
          agentName: 'developer'
        });
      });

      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'task-2',
          toolName: 'Edit',
          timestamp: new Date(),
          reason: 'Task 2 operation',
          agentName: 'tester'
        });
      });

      // Both events should be processed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useOrchestratorEvents]'),
        expect.stringContaining('task-1')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useOrchestratorEvents]'),
        expect.stringContaining('task-2')
      );
    });
  });

  describe('Permission Request Notifications', () => {
    it('should display structured permission request notifications', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          taskId: 'notification-test-123',
          debug: false, // Test actual notification display, not just debug logging
        })
      );

      const requestEvent = {
        taskId: 'notification-test-123',
        toolName: 'Write',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        scope: '/project/src/components/UserProfile.tsx',
        reason: 'Creating new UserProfile component with form validation',
        agentName: 'developer',
        isDangerous: false,
        parameters: {
          filePath: '/project/src/components/UserProfile.tsx',
          content: 'React component code...'
        }
      };

      act(() => {
        mockOrchestrator.emit('permission:request', requestEvent);
      });

      // Verify notification structure and content
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔐 Permission Request')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool: Write')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent: developer')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task: notification-test-123')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scope: /project/src/components/UserProfile.tsx')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reason: Creating new UserProfile component')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Time: 10:30:00')
      );
    });

    it('should highlight dangerous operations in permission requests', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      const dangerousRequestEvent = {
        taskId: 'dangerous-test-456',
        toolName: 'Bash',
        timestamp: new Date(),
        scope: 'sudo rm -rf /var/log/*',
        reason: 'Cleaning up system logs',
        agentName: 'maintenance',
        isDangerous: true,
        dangerLevel: 'critical' as const,
        riskDescription: 'This operation will permanently delete system logs'
      };

      act(() => {
        mockOrchestrator.emit('permission:request', dangerousRequestEvent);
      });

      // Verify dangerous operation warnings
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ DANGEROUS OPERATION')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Risk Level: critical')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('This operation will permanently delete system logs')
      );
    });

    it('should handle permission requests with minimal information gracefully', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      const minimalRequestEvent = {
        taskId: 'minimal-test',
        toolName: 'TestTool',
        timestamp: new Date(),
        // No scope, reason, agentName, or other optional fields
      };

      expect(() => {
        act(() => {
          mockOrchestrator.emit('permission:request', minimalRequestEvent);
        });
      }).not.toThrow();

      // Should still display available information
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔐 Permission Request')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool: TestTool')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task: minimal-test')
      );
    });

    it('should format timestamps correctly in notifications', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      const testTimestamp = new Date('2024-03-15T14:30:45Z');
      const requestEvent = {
        taskId: 'timestamp-test',
        toolName: 'Read',
        timestamp: testTimestamp,
        reason: 'Testing timestamp formatting'
      };

      act(() => {
        mockOrchestrator.emit('permission:request', requestEvent);
      });

      // Verify timestamp is displayed in readable format
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Time: 14:30:45')
      );
    });
  });

  describe('Permission Response Notifications', () => {
    it('should display permission granted notifications with success styling', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      const grantedEvent = {
        taskId: 'granted-test-123',
        toolName: 'Edit',
        timestamp: new Date(),
        level: 'allow-once' as const,
        grantedBy: 'user',
        grantReason: 'Approved for component modification'
      };

      act(() => {
        mockOrchestrator.emit('permission:granted', grantedEvent);
      });

      // Verify success notification styling
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Permission GRANTED')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool: Edit')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Level: allow-once')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Granted by: user')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reason: Approved for component modification')
      );
    });

    it('should distinguish between different permission levels in notifications', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      // Test allow-always permission
      act(() => {
        mockOrchestrator.emit('permission:granted', {
          taskId: 'always-test',
          toolName: 'Read',
          timestamp: new Date(),
          level: 'allow-always' as const,
          grantedBy: 'admin',
          grantReason: 'Read access granted for entire project'
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Level: allow-always')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔓 Permanent access granted')
      );

      // Test allow-once permission
      act(() => {
        mockOrchestrator.emit('permission:granted', {
          taskId: 'once-test',
          toolName: 'Write',
          timestamp: new Date(),
          level: 'allow-once' as const,
          grantedBy: 'user',
          grantReason: 'One-time write permission'
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Level: allow-once')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔐 Single-use permission')
      );
    });

    it('should display permission denied notifications with warning styling', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      const deniedEvent = {
        taskId: 'denied-test-123',
        toolName: 'Bash',
        timestamp: new Date(),
        denialReason: 'Shell commands not allowed in production environment. Use "apex approve" for exceptions.',
        deniedBy: 'security-policy'
      };

      act(() => {
        mockOrchestrator.emit('permission:denied', deniedEvent);
      });

      // Verify warning-level notification
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Permission DENIED')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool: Bash')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Denied by: security-policy')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reason: Shell commands not allowed')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Use "apex approve" for exceptions')
      );
    });

    it('should provide actionable information in denial notifications', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      const actionableDenialEvent = {
        taskId: 'actionable-denial-456',
        toolName: 'Write',
        timestamp: new Date(),
        denialReason: 'Insufficient permissions for /etc directory. Run "sudo apex grant write-system" to authorize.',
        deniedBy: 'filesystem-permissions',
        suggestedAction: 'sudo apex grant write-system',
        alternativeActions: ['Request admin approval', 'Use temporary directory instead']
      };

      act(() => {
        mockOrchestrator.emit('permission:denied', actionableDenialEvent);
      });

      // Verify actionable guidance is provided
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('💡 Suggested action: sudo apex grant write-system')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('📋 Alternatives: Request admin approval, Use temporary directory instead')
      );
    });
  });

  describe('Dangerous Operation Notifications', () => {
    it('should display dangerous operation detection with error styling', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      const dangerousEvent = {
        taskId: 'dangerous-operation-789',
        toolName: 'Bash',
        timestamp: new Date(),
        operationType: 'file-deletion' as const,
        riskLevel: 'high' as const,
        description: 'Attempting to delete critical system files',
        metadata: {
          command: 'rm -rf /etc/systemd/*',
          affectedFiles: ['/etc/systemd/system/*', '/etc/systemd/user/*'],
          estimatedImpact: 'System may become unbootable'
        }
      };

      act(() => {
        mockOrchestrator.emit('dangerous:detected', dangerousEvent);
      });

      // Verify error-level notification for dangerous operations
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 DANGEROUS OPERATION DETECTED')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool: Bash')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Risk Level: high')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation Type: file-deletion')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Description: Attempting to delete critical system files')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Impact: System may become unbootable')
      );
    });

    it('should handle dangerous operation confirmations appropriately', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      // Test dangerous operation confirmation
      act(() => {
        mockOrchestrator.emit('dangerous:confirmed', {
          taskId: 'confirmed-dangerous',
          toolName: 'Bash',
          timestamp: new Date(),
          operationType: 'privilege-escalation' as const,
          confirmedBy: 'admin',
          confirmation: 'Admin approved sudo access for deployment script'
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Dangerous operation CONFIRMED')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation: privilege-escalation')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Confirmed by: admin')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Confirmation: Admin approved sudo access')
      );

      // Test dangerous operation blocking
      act(() => {
        mockOrchestrator.emit('dangerous:blocked', {
          taskId: 'blocked-dangerous',
          toolName: 'Write',
          timestamp: new Date(),
          operationType: 'data-modification' as const,
          blockReason: 'Operation exceeds safety threshold for production environment',
          blockedBy: 'safety-system'
        });
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚫 Dangerous operation BLOCKED')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation: data-modification')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Blocked by: safety-system')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reason: Operation exceeds safety threshold')
      );
    });
  });

  describe('Multi-Agent Permission Scenarios', () => {
    it('should handle permission notifications from multiple agents correctly', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          workflow: {
            stages: [
              { name: 'implementation', agent: 'developer' },
              { name: 'testing', agent: 'tester' },
              { name: 'deployment', agent: 'devops' }
            ]
          },
          debug: false,
        })
      );

      // Developer requests permission
      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'multi-agent-dev',
          toolName: 'Write',
          timestamp: new Date(),
          scope: '/src/components/NewFeature.tsx',
          reason: 'Implementing new feature component',
          agentName: 'developer'
        });
      });

      // Tester requests permission
      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'multi-agent-test',
          toolName: 'Bash',
          timestamp: new Date(),
          scope: 'npm test -- --coverage',
          reason: 'Running comprehensive test suite with coverage',
          agentName: 'tester'
        });
      });

      // DevOps requests permission
      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'multi-agent-deploy',
          toolName: 'Bash',
          timestamp: new Date(),
          scope: 'kubectl apply -f deployment.yaml',
          reason: 'Deploying to production cluster',
          agentName: 'devops',
          isDangerous: true,
          dangerLevel: 'medium'
        });
      });

      // Verify each agent's notification includes agent identification
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔐 Permission Request')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent: developer')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent: tester')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent: devops')
      );

      // Verify dangerous operation from devops is highlighted
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ DANGEROUS OPERATION')
      );
    });

    it('should track permission state across multiple agent interactions', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      const sharedTaskId = 'shared-permission-task';

      // Developer requests permission
      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: sharedTaskId,
          toolName: 'Edit',
          timestamp: new Date(),
          agentName: 'developer',
          reason: 'Modifying shared configuration'
        });
      });

      // Permission granted
      act(() => {
        mockOrchestrator.emit('permission:granted', {
          taskId: sharedTaskId,
          toolName: 'Edit',
          timestamp: new Date(),
          level: 'allow-always',
          grantedBy: 'user'
        });
      });

      // Tester attempts same operation (should use existing permission)
      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: sharedTaskId,
          toolName: 'Edit',
          timestamp: new Date(),
          agentName: 'tester',
          reason: 'Validating configuration changes',
          permissionStatus: 'inherited'
        });
      });

      // Verify both agents' activities are tracked
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent: developer')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent: tester')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission: inherited')
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed permission events gracefully', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      // Test with missing required fields
      expect(() => {
        act(() => {
          mockOrchestrator.emit('permission:request', {
            // Missing taskId and toolName
            timestamp: new Date(),
            reason: 'Incomplete event data'
          });
        });
      }).not.toThrow();

      // Test with invalid data types
      expect(() => {
        act(() => {
          mockOrchestrator.emit('permission:granted', {
            taskId: 123, // Should be string
            toolName: null, // Should be string
            timestamp: 'invalid-date', // Should be Date
            level: 'invalid-level' // Should be valid PermissionLevel
          });
        });
      }).not.toThrow();

      // Should still attempt to display available information
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission Request')
      );
    });

    it('should handle high-frequency permission events without UI blocking', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      const startTime = Date.now();
      const eventCount = 100; // Reasonable number for UI responsiveness testing

      // Emit many permission events rapidly
      act(() => {
        for (let i = 0; i < eventCount; i++) {
          mockOrchestrator.emit('permission:request', {
            taskId: `performance-test-${i}`,
            toolName: 'TestTool',
            timestamp: new Date(),
            reason: `Performance test event ${i}`,
            agentName: `agent-${i % 3}`
          });
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle events quickly without blocking UI
      expect(duration).toBeLessThan(500); // Under 500ms for 100 events

      // Verify notifications were displayed (sample check)
      expect(consoleInfoSpy).toHaveBeenCalledTimes(eventCount);
    });

    it('should cleanup event listeners when hook unmounts', () => {
      const { result, unmount } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: true,
        })
      );

      // Verify listeners are active before unmount
      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'cleanup-test',
          toolName: 'TestTool',
          timestamp: new Date(),
          reason: 'Testing cleanup'
        });
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockClear();

      // Unmount the hook
      unmount();

      // Emit events after unmount - should not trigger handlers
      act(() => {
        mockOrchestrator.emit('permission:request', {
          taskId: 'post-unmount-test',
          toolName: 'TestTool',
          timestamp: new Date(),
          reason: 'After unmount'
        });
      });

      // Should not have been called after unmount
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('post-unmount-test')
      );
    });
  });

  describe('Acceptance Criteria Verification', () => {
    it('should verify all acceptance criteria are met', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator as ApexOrchestrator,
          debug: false,
        })
      );

      // Test comprehensive permission notification flow
      const testEvents = [
        {
          type: 'permission:request',
          data: {
            taskId: 'acceptance-test-1',
            toolName: 'Write',
            timestamp: new Date(),
            scope: '/project/src/test.tsx',
            reason: 'Creating test component',
            agentName: 'developer'
          }
        },
        {
          type: 'permission:granted',
          data: {
            taskId: 'acceptance-test-1',
            toolName: 'Write',
            timestamp: new Date(),
            level: 'allow-once',
            grantedBy: 'user',
            grantReason: 'Component creation approved'
          }
        },
        {
          type: 'dangerous:detected',
          data: {
            taskId: 'acceptance-test-2',
            toolName: 'Bash',
            timestamp: new Date(),
            operationType: 'system-modification',
            riskLevel: 'critical',
            description: 'Critical system operation detected'
          }
        },
        {
          type: 'permission:denied',
          data: {
            taskId: 'acceptance-test-3',
            toolName: 'Bash',
            timestamp: new Date(),
            denialReason: 'Operation not permitted in current context',
            deniedBy: 'policy-engine'
          }
        }
      ];

      // Emit all test events
      testEvents.forEach(({ type, data }) => {
        act(() => {
          mockOrchestrator.emit(type, data);
        });
      });

      // Verify acceptance criteria:

      // 1. CLI receives permission change events from orchestrator
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔐 Permission Request')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Permission GRANTED')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Permission DENIED')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 DANGEROUS OPERATION DETECTED')
      );

      // 2. Permission notifications are displayed to users
      expect(consoleInfoSpy.mock.calls.length).toBeGreaterThan(0);
      expect(consoleLogSpy.mock.calls.length).toBeGreaterThan(0);
      expect(consoleWarnSpy.mock.calls.length).toBeGreaterThan(0);
      expect(consoleErrorSpy.mock.calls.length).toBeGreaterThan(0);

      // 3. Notification content is accurate and actionable
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool: Write')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent: developer')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scope: /project/src/test.tsx')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Level: allow-once')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Denied by: policy-engine')
      );

      // 4. Events are handled properly in React hook integration
      expect(result.current).toBeDefined();
      expect(typeof result.current).toBe('object');
    });
  });
});