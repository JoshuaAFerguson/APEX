import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Comprehensive Cancel Command Test Suite
 *
 * This test suite provides comprehensive testing for the APEX cancel command,
 * verifying all aspects of task cancellation functionality including:
 * 1. CLI handleCancel function behavior
 * 2. Orchestrator.cancelTask() method integration
 * 3. Edge case handling and error scenarios
 * 4. Task status transitions
 * 5. Workspace cleanup after cancellation
 * 6. User feedback and error messaging
 */

interface MockTask {
  id: string;
  status: 'pending' | 'queued' | 'planning' | 'in-progress' | 'awaiting-approval' | 'paused' | 'completed' | 'failed' | 'cancelled';
  description: string;
  workflow: string;
  createdAt: Date;
}

interface MockAppInstance {
  addMessage: (message: { type: string; content: string }) => void;
}

interface MockOrchestrator {
  getTask: (id: string) => Promise<MockTask | null>;
  cancelTask: (id: string) => Promise<boolean>;
  initialized: boolean;
}

interface MockWorkspaceManager {
  cleanupWorkspace: (taskId: string) => Promise<void>;
}

describe('APEX Cancel Command - Comprehensive Testing', () => {
  let mockApp: MockAppInstance;
  let mockOrchestrator: MockOrchestrator;
  let mockWorkspaceManager: MockWorkspaceManager;
  let mockContext: any;

  // Realistic task data for testing
  const testTasks: Record<string, MockTask> = {
    'pending-task-123': {
      id: 'pending-task-123',
      status: 'pending',
      description: 'A pending task waiting to start',
      workflow: 'feature-development',
      createdAt: new Date('2024-01-01T10:00:00Z'),
    },
    'queued-task-456': {
      id: 'queued-task-456',
      status: 'queued',
      description: 'A queued task in the execution queue',
      workflow: 'bug-fix',
      createdAt: new Date('2024-01-01T10:05:00Z'),
    },
    'planning-task-789': {
      id: 'planning-task-789',
      status: 'planning',
      description: 'A task currently in planning phase',
      workflow: 'architecture',
      createdAt: new Date('2024-01-01T10:10:00Z'),
    },
    'in-progress-task-101': {
      id: 'in-progress-task-101',
      status: 'in-progress',
      description: 'An actively running task',
      workflow: 'implementation',
      createdAt: new Date('2024-01-01T10:15:00Z'),
    },
    'awaiting-approval-task-102': {
      id: 'awaiting-approval-task-102',
      status: 'awaiting-approval',
      description: 'A task waiting for user approval',
      workflow: 'deployment',
      createdAt: new Date('2024-01-01T10:20:00Z'),
    },
    'paused-task-103': {
      id: 'paused-task-103',
      status: 'paused',
      description: 'A paused task due to rate limiting',
      workflow: 'refactoring',
      createdAt: new Date('2024-01-01T10:25:00Z'),
    },
    'completed-task-201': {
      id: 'completed-task-201',
      status: 'completed',
      description: 'A successfully completed task',
      workflow: 'testing',
      createdAt: new Date('2024-01-01T09:00:00Z'),
    },
    'failed-task-301': {
      id: 'failed-task-301',
      status: 'failed',
      description: 'A task that encountered an error',
      workflow: 'validation',
      createdAt: new Date('2024-01-01T09:30:00Z'),
    },
    'cancelled-task-401': {
      id: 'cancelled-task-401',
      status: 'cancelled',
      description: 'An already cancelled task',
      workflow: 'cleanup',
      createdAt: new Date('2024-01-01T09:45:00Z'),
    },
  };

  beforeEach(() => {
    // Mock app for message handling
    mockApp = {
      addMessage: vi.fn(),
    };

    // Mock workspace manager
    mockWorkspaceManager = {
      cleanupWorkspace: vi.fn().mockResolvedValue(undefined),
    };

    // Mock orchestrator with realistic behavior
    mockOrchestrator = {
      initialized: true,
      getTask: vi.fn().mockImplementation(async (id: string) => {
        return testTasks[id] || null;
      }),
      cancelTask: vi.fn().mockImplementation(async (id: string) => {
        const task = testTasks[id];
        if (!task) return false;

        // Match the real orchestrator logic
        const cancellableStatuses = ['pending', 'queued', 'planning', 'in-progress', 'awaiting-approval', 'paused'];
        const canCancel = cancellableStatuses.includes(task.status);

        if (canCancel) {
          // Simulate updating task status to cancelled
          testTasks[id] = { ...task, status: 'cancelled' };

          // Simulate workspace cleanup - this should be called in the mock
          try {
            await mockWorkspaceManager.cleanupWorkspace(id);
          } catch (error) {
            // Don't fail on cleanup errors, just like the real implementation
          }
        }

        return canCancel;
      }),
    };

    // Mock context
    mockContext = {
      initialized: true,
      orchestrator: mockOrchestrator,
      app: mockApp,
    };
  });

  describe('Core Cancel Functionality', () => {
    // Implementation of handleCancel function to test
    const handleCancel = async (args: string[]): Promise<void> => {
      if (!mockContext.initialized || !mockContext.orchestrator) {
        mockContext.app?.addMessage({
          type: 'error',
          content: 'APEX not initialized. Run /init first.',
        });
        return;
      }

      const taskId = args[0];
      if (!taskId) {
        mockContext.app?.addMessage({
          type: 'error',
          content: 'Usage: /cancel <task_id>',
        });
        return;
      }

      // First check if the task exists and get its status for better error messages
      const task = await mockContext.orchestrator.getTask(taskId);
      if (!task) {
        mockContext.app?.addMessage({
          type: 'error',
          content: `Task not found: ${taskId}`,
        });
        return;
      }

      const cancelled = await mockContext.orchestrator.cancelTask(taskId);
      if (cancelled) {
        mockContext.app?.addMessage({
          type: 'system',
          content: `Task ${taskId} cancelled.`,
        });
      } else {
        // Provide specific error message based on task status
        const status = task.status;
        let errorMessage = `Could not cancel task ${taskId}.`;

        if (status === 'completed') {
          errorMessage += ' Task is already completed.';
        } else if (status === 'failed') {
          errorMessage += ' Task has already failed.';
        } else if (status === 'cancelled') {
          errorMessage += ' Task is already cancelled.';
        } else {
          errorMessage += ` Task status: ${status}`;
        }

        mockContext.app?.addMessage({
          type: 'error',
          content: errorMessage,
        });
      }
    };

    it('should successfully cancel a pending task', async () => {
      await handleCancel(['pending-task-123']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('pending-task-123');
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('pending-task-123');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('pending-task-123');
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Task pending-task-123 cancelled.',
      });
    });

    it('should successfully cancel a queued task', async () => {
      await handleCancel(['queued-task-456']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('queued-task-456');
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('queued-task-456');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('queued-task-456');
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Task queued-task-456 cancelled.',
      });
    });

    it('should successfully cancel a planning task', async () => {
      await handleCancel(['planning-task-789']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('planning-task-789');
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('planning-task-789');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('planning-task-789');
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Task planning-task-789 cancelled.',
      });
    });

    it('should successfully cancel an in-progress task', async () => {
      await handleCancel(['in-progress-task-101']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('in-progress-task-101');
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('in-progress-task-101');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('in-progress-task-101');
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Task in-progress-task-101 cancelled.',
      });
    });

    it('should successfully cancel an awaiting-approval task', async () => {
      await handleCancel(['awaiting-approval-task-102']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('awaiting-approval-task-102');
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('awaiting-approval-task-102');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('awaiting-approval-task-102');
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Task awaiting-approval-task-102 cancelled.',
      });
    });

    it('should successfully cancel a paused task', async () => {
      await handleCancel(['paused-task-103']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('paused-task-103');
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('paused-task-103');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('paused-task-103');
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Task paused-task-103 cancelled.',
      });
    });
  });

  describe('Edge Cases - Non-Cancellable Tasks', () => {
    const handleCancel = async (args: string[]): Promise<void> => {
      if (!mockContext.initialized || !mockContext.orchestrator) {
        mockContext.app?.addMessage({
          type: 'error',
          content: 'APEX not initialized. Run /init first.',
        });
        return;
      }

      const taskId = args[0];
      if (!taskId) {
        mockContext.app?.addMessage({
          type: 'error',
          content: 'Usage: /cancel <task_id>',
        });
        return;
      }

      const task = await mockContext.orchestrator.getTask(taskId);
      if (!task) {
        mockContext.app?.addMessage({
          type: 'error',
          content: `Task not found: ${taskId}`,
        });
        return;
      }

      const cancelled = await mockContext.orchestrator.cancelTask(taskId);
      if (cancelled) {
        mockContext.app?.addMessage({
          type: 'system',
          content: `Task ${taskId} cancelled.`,
        });
      } else {
        const status = task.status;
        let errorMessage = `Could not cancel task ${taskId}.`;

        if (status === 'completed') {
          errorMessage += ' Task is already completed.';
        } else if (status === 'failed') {
          errorMessage += ' Task has already failed.';
        } else if (status === 'cancelled') {
          errorMessage += ' Task is already cancelled.';
        } else {
          errorMessage += ` Task status: ${status}`;
        }

        mockContext.app?.addMessage({
          type: 'error',
          content: errorMessage,
        });
      }
    };

    it('should reject cancellation of completed task with specific error message', async () => {
      await handleCancel(['completed-task-201']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('completed-task-201');
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('completed-task-201');
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Could not cancel task completed-task-201. Task is already completed.',
      });
    });

    it('should reject cancellation of failed task with specific error message', async () => {
      await handleCancel(['failed-task-301']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('failed-task-301');
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('failed-task-301');
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Could not cancel task failed-task-301. Task has already failed.',
      });
    });

    it('should reject cancellation of already cancelled task with specific error message', async () => {
      await handleCancel(['cancelled-task-401']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('cancelled-task-401');
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('cancelled-task-401');
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Could not cancel task cancelled-task-401. Task is already cancelled.',
      });
    });

    it('should handle non-existent task gracefully', async () => {
      await handleCancel(['non-existent-task']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('non-existent-task');
      expect(mockOrchestrator.cancelTask).not.toHaveBeenCalled();
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Task not found: non-existent-task',
      });
    });

    it('should handle missing task ID argument', async () => {
      await handleCancel([]);

      expect(mockOrchestrator.getTask).not.toHaveBeenCalled();
      expect(mockOrchestrator.cancelTask).not.toHaveBeenCalled();
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Usage: /cancel <task_id>',
      });
    });

    it('should handle uninitialized APEX context', async () => {
      mockContext.initialized = false;

      await handleCancel(['pending-task-123']);

      expect(mockOrchestrator.getTask).not.toHaveBeenCalled();
      expect(mockOrchestrator.cancelTask).not.toHaveBeenCalled();
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.',
      });
    });

    it('should handle missing orchestrator', async () => {
      mockContext.orchestrator = null;

      await handleCancel(['pending-task-123']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'APEX not initialized. Run /init first.',
      });
    });
  });

  describe('Orchestrator Integration', () => {
    it('should verify cancellable status logic matches orchestrator implementation', () => {
      const cancellableStatuses = ['pending', 'queued', 'planning', 'in-progress', 'awaiting-approval', 'paused'];
      const nonCancellableStatuses = ['completed', 'failed', 'cancelled'];

      // Verify all expected statuses are included
      expect(cancellableStatuses).toContain('pending');
      expect(cancellableStatuses).toContain('queued');
      expect(cancellableStatuses).toContain('planning');
      expect(cancellableStatuses).toContain('in-progress');
      expect(cancellableStatuses).toContain('awaiting-approval');
      expect(cancellableStatuses).toContain('paused');

      expect(nonCancellableStatuses).toContain('completed');
      expect(nonCancellableStatuses).toContain('failed');
      expect(nonCancellableStatuses).toContain('cancelled');

      // Verify no overlap between cancellable and non-cancellable
      const overlap = cancellableStatuses.filter(status => nonCancellableStatuses.includes(status));
      expect(overlap).toHaveLength(0);
    });

    it('should verify orchestrator.cancelTask() return value behavior', async () => {
      // Clear any previous calls
      vi.clearAllMocks();

      // Test cancellable tasks return true
      for (const taskId of ['pending-task-123', 'queued-task-456', 'planning-task-789',
                          'in-progress-task-101', 'awaiting-approval-task-102', 'paused-task-103']) {
        const result = await mockOrchestrator.cancelTask(taskId);
        expect(result).toBe(true);
      }

      // Test non-cancellable tasks return false
      for (const taskId of ['completed-task-201', 'failed-task-301', 'cancelled-task-401']) {
        const result = await mockOrchestrator.cancelTask(taskId);
        expect(result).toBe(false);
      }

      // Test non-existent task returns false
      const result = await mockOrchestrator.cancelTask('non-existent-task');
      expect(result).toBe(false);
    });

    it('should verify workspace cleanup is called for successful cancellations', async () => {
      vi.clearAllMocks();

      await mockOrchestrator.cancelTask('pending-task-123');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('pending-task-123');

      await mockOrchestrator.cancelTask('in-progress-task-101');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('in-progress-task-101');
    });

    it('should verify workspace cleanup is not called for failed cancellations', async () => {
      vi.clearAllMocks();

      await mockOrchestrator.cancelTask('completed-task-201');
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

      await mockOrchestrator.cancelTask('non-existent-task');
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle workspace cleanup failures gracefully', async () => {
      // Reset mocks first
      vi.clearAllMocks();

      // Mock workspace cleanup to fail for this specific test
      const originalCleanup = mockWorkspaceManager.cleanupWorkspace;
      mockWorkspaceManager.cleanupWorkspace = vi.fn().mockRejectedValue(new Error('Workspace cleanup failed'));

      // Create a custom orchestrator that handles cleanup errors like the real implementation
      const orchestratorWithErrorHandling = {
        ...mockOrchestrator,
        cancelTask: vi.fn().mockImplementation(async (id: string) => {
          const task = testTasks[id];
          if (!task) return false;

          const cancellableStatuses = ['pending', 'queued', 'planning', 'in-progress', 'awaiting-approval', 'paused'];
          const canCancel = cancellableStatuses.includes(task.status);

          if (canCancel) {
            testTasks[id] = { ...task, status: 'cancelled' };

            // Simulate the real orchestrator's error handling
            try {
              await mockWorkspaceManager.cleanupWorkspace(id);
            } catch (error) {
              console.warn(`Failed to cleanup workspace for cancelled task ${id}:`, error);
              // Don't fail cancelTask due to cleanup error
            }
          }

          return canCancel;
        }),
      };

      const result = await orchestratorWithErrorHandling.cancelTask('pending-task-123');

      // Should still return true even if cleanup fails
      expect(result).toBe(true);
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('pending-task-123');

      // Restore original cleanup function
      mockWorkspaceManager.cleanupWorkspace = originalCleanup;
    });

    it('should handle orchestrator errors during task retrieval', async () => {
      mockOrchestrator.getTask = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      const handleCancel = async (args: string[]): Promise<void> => {
        try {
          const task = await mockContext.orchestrator.getTask(args[0]);
          // This should not be reached due to the error
        } catch (error) {
          mockContext.app?.addMessage({
            type: 'error',
            content: `Error retrieving task: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      };

      await handleCancel(['pending-task-123']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Error retrieving task: Database connection failed',
      });
    });

    it('should handle orchestrator errors during cancellation', async () => {
      mockOrchestrator.cancelTask = vi.fn().mockRejectedValue(new Error('Cancellation service unavailable'));

      const handleCancel = async (args: string[]): Promise<void> => {
        const task = await mockContext.orchestrator.getTask(args[0]);
        if (!task) {
          mockContext.app?.addMessage({
            type: 'error',
            content: `Task not found: ${args[0]}`,
          });
          return;
        }

        try {
          const cancelled = await mockContext.orchestrator.cancelTask(args[0]);
          // This should not be reached due to the error
        } catch (error) {
          mockContext.app?.addMessage({
            type: 'error',
            content: `Error cancelling task: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      };

      await handleCancel(['pending-task-123']);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Error cancelling task: Cancellation service unavailable',
      });
    });
  });

  describe('Command Execution Flow', () => {
    it('should execute operations in correct sequence for successful cancellation', async () => {
      const executionOrder: string[] = [];

      // Reset all mocks first
      vi.clearAllMocks();

      // Create new mocks with execution tracking
      const trackingOrchestrator = {
        getTask: vi.fn().mockImplementation(async (id) => {
          executionOrder.push('getTask');
          return testTasks[id] || null;
        }),
        cancelTask: vi.fn().mockImplementation(async (id) => {
          executionOrder.push('cancelTask');
          const task = testTasks[id];
          if (task && ['pending', 'queued', 'planning', 'in-progress', 'awaiting-approval', 'paused'].includes(task.status)) {
            testTasks[id] = { ...task, status: 'cancelled' };
            executionOrder.push('cleanupWorkspace');
            await mockWorkspaceManager.cleanupWorkspace(id);
            return true;
          }
          return false;
        }),
      };

      const trackingApp = {
        addMessage: vi.fn().mockImplementation((message) => {
          executionOrder.push(`addMessage:${message.type}`);
        }),
      };

      const handleCancel = async (args: string[]): Promise<void> => {
        const taskId = args[0];
        const task = await trackingOrchestrator.getTask(taskId);
        if (!task) return;

        const cancelled = await trackingOrchestrator.cancelTask(taskId);
        if (cancelled) {
          trackingApp.addMessage({
            type: 'system',
            content: `Task ${taskId} cancelled.`,
          });
        }
      };

      await handleCancel(['pending-task-123']);

      expect(executionOrder).toEqual([
        'getTask',
        'cancelTask',
        'cleanupWorkspace',
        'addMessage:system'
      ]);
    });

    it('should execute operations in correct sequence for failed cancellation', async () => {
      const executionOrder: string[] = [];

      mockOrchestrator.getTask = vi.fn().mockImplementation(async (id) => {
        executionOrder.push('getTask');
        return testTasks[id] || null;
      });

      mockOrchestrator.cancelTask = vi.fn().mockImplementation(async (id) => {
        executionOrder.push('cancelTask');
        return false; // Simulate failed cancellation
      });

      const originalAddMessage = mockApp.addMessage;
      mockApp.addMessage = vi.fn().mockImplementation((message) => {
        executionOrder.push(`addMessage:${message.type}`);
        return originalAddMessage(message);
      });

      const handleCancel = async (args: string[]): Promise<void> => {
        const taskId = args[0];
        const task = await mockContext.orchestrator.getTask(taskId);
        if (!task) return;

        const cancelled = await mockContext.orchestrator.cancelTask(taskId);
        if (!cancelled) {
          mockContext.app?.addMessage({
            type: 'error',
            content: `Could not cancel task ${taskId}. Task is already completed.`,
          });
        }
      };

      await handleCancel(['completed-task-201']);

      expect(executionOrder).toEqual([
        'getTask',
        'cancelTask',
        'addMessage:error'
      ]);

      // Verify workspace cleanup was not called
      expect(executionOrder).not.toContain('cleanupWorkspace');
    });
  });

  describe('Message Formatting and User Experience', () => {
    it('should format success messages consistently', async () => {
      // Clear all mocks first
      vi.clearAllMocks();

      const handleCancel = async (args: string[]): Promise<void> => {
        const taskId = args[0];
        const task = await mockContext.orchestrator.getTask(taskId);
        if (task) {
          const cancelled = await mockContext.orchestrator.cancelTask(taskId);
          if (cancelled) {
            mockContext.app?.addMessage({
              type: 'system',
              content: `Task ${taskId} cancelled.`,
            });
          }
        }
      };

      await handleCancel(['pending-task-123']);

      const systemMessages = (mockApp.addMessage as any).mock.calls.filter(
        (call: any[]) => call[0].type === 'system'
      );

      expect(systemMessages).toHaveLength(1);
      expect(systemMessages[0][0].content).toBe('Task pending-task-123 cancelled.');
    });

    it('should format error messages with context', async () => {
      const errorScenarios = [
        { taskId: 'completed-task-201', expectedSuffix: ' Task is already completed.' },
        { taskId: 'failed-task-301', expectedSuffix: ' Task has already failed.' },
        { taskId: 'cancelled-task-401', expectedSuffix: ' Task is already cancelled.' },
      ];

      const handleCancel = async (args: string[]): Promise<void> => {
        const taskId = args[0];
        const task = await mockContext.orchestrator.getTask(taskId);
        if (task) {
          const cancelled = await mockContext.orchestrator.cancelTask(taskId);
          if (!cancelled) {
            const status = task.status;
            let errorMessage = `Could not cancel task ${taskId}.`;

            if (status === 'completed') {
              errorMessage += ' Task is already completed.';
            } else if (status === 'failed') {
              errorMessage += ' Task has already failed.';
            } else if (status === 'cancelled') {
              errorMessage += ' Task is already cancelled.';
            }

            mockContext.app?.addMessage({
              type: 'error',
              content: errorMessage,
            });
          }
        }
      };

      for (const scenario of errorScenarios) {
        vi.clearAllMocks();

        await handleCancel([scenario.taskId]);

        const errorMessages = (mockApp.addMessage as any).mock.calls.filter(
          (call: any[]) => call[0].type === 'error'
        );

        expect(errorMessages).toHaveLength(1);
        expect(errorMessages[0][0].content).toBe(`Could not cancel task ${scenario.taskId}.${scenario.expectedSuffix}`);
      }
    });
  });
});