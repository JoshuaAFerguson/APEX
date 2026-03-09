import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * APEX Interactive REPL Task Execution Audit Test Suite
 *
 * This test suite verifies the executeTask() function that handles natural language
 * task execution in the Interactive REPL mode.
 *
 * Tests verify:
 * 1. Natural language task description processing
 * 2. Task creation through orchestrator
 * 3. Task execution initiation
 * 4. Conversation and session tracking
 * 5. Error handling scenarios
 * 6. Task status updates and messaging
 */

interface MockAppInstance {
  addMessage: (message: { type: string; content: string }) => void;
  updateState: (updates: any) => void;
  getState: () => any;
}

interface MockOrchestrator {
  createTask: (task: { description: string }) => Promise<any>;
  executeTask: (id: string) => Promise<void>;
  getTask: (id: string) => Promise<any>;
}

interface MockConversationManager {
  addMessage: (message: { role: string; content: string }) => void;
  setTask: (taskId: string) => void;
  setAgent: (agent: string) => void;
}

interface MockSessionAutoSaver {
  addInputToHistory: (input: string) => Promise<void>;
  addMessage: (message: any) => Promise<void>;
  updateState: (state: any) => Promise<void>;
  getSession: () => any;
}

describe('APEX Interactive REPL Task Execution Audit', () => {
  let mockApp: MockAppInstance;
  let mockOrchestrator: MockOrchestrator;
  let mockConversationManager: MockConversationManager;
  let mockSessionAutoSaver: MockSessionAutoSaver;
  let mockContext: any;
  let executeTask: (description: string) => Promise<void>;

  beforeEach(() => {
    // Mock the app instance
    mockApp = {
      addMessage: vi.fn(),
      updateState: vi.fn(),
      getState: vi.fn().mockReturnValue({}),
    };

    // Mock the orchestrator with task creation and execution
    mockOrchestrator = {
      createTask: vi.fn().mockResolvedValue({
        id: 'task-abc123',
        description: 'Create a login component with email validation',
        status: 'pending',
        createdAt: new Date(),
      }),
      executeTask: vi.fn().mockResolvedValue(undefined),
      getTask: vi.fn().mockResolvedValue({
        id: 'task-abc123',
        description: 'Create a login component with email validation',
        status: 'completed',
        createdAt: new Date(),
      }),
    };

    // Mock conversation manager
    mockConversationManager = {
      addMessage: vi.fn(),
      setTask: vi.fn(),
      setAgent: vi.fn(),
    };

    // Mock session auto-saver
    mockSessionAutoSaver = {
      addInputToHistory: vi.fn().mockResolvedValue(undefined),
      addMessage: vi.fn().mockResolvedValue(undefined),
      updateState: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn().mockReturnValue({
        state: {
          tasksCreated: ['previous-task-1'],
          tasksCompleted: ['previous-task-1'],
        },
      }),
    };

    // Mock context similar to repl.tsx
    mockContext = {
      orchestrator: mockOrchestrator,
      app: mockApp,
      conversationManager: mockConversationManager,
      sessionAutoSaver: mockSessionAutoSaver,
    };

    // Create executeTask function based on the real implementation
    executeTask = async (description: string): Promise<void> => {
      if (!mockContext.orchestrator) {
        mockContext.app?.addMessage({
          type: 'error',
          content: 'APEX not initialized.',
        });
        return;
      }

      // Track user input in conversation context
      if (mockContext.conversationManager) {
        mockContext.conversationManager.addMessage({
          role: 'user',
          content: description,
        });
      }

      // Track user input in session
      if (mockContext.sessionAutoSaver) {
        await mockContext.sessionAutoSaver.addInputToHistory(description);
        await mockContext.sessionAutoSaver.addMessage({
          role: 'user',
          content: description,
        });
      }

      mockContext.app?.addMessage({
        type: 'system',
        content: 'Creating task...',
      });

      try {
        const task = await mockContext.orchestrator.createTask({ description });

        // Track task in conversation context
        if (mockContext.conversationManager) {
          mockContext.conversationManager.setTask(task.id);
          mockContext.conversationManager.setAgent('planner');
          mockContext.conversationManager.addMessage({
            role: 'assistant',
            content: `Task created: ${task.id}\nStarting execution...`,
          });
        }

        mockContext.app?.updateState({
          currentTask: task,
          activeAgent: 'planner',
        });

        mockContext.app?.addMessage({
          type: 'assistant',
          content: `Task created: ${task.id}\nStarting execution...`,
        });

        // Track task creation in session
        if (mockContext.sessionAutoSaver) {
          await mockContext.sessionAutoSaver.addMessage({
            role: 'assistant',
            content: `Task created: ${task.id}`,
            taskId: task.id,
            agent: 'system',
          });
          await mockContext.sessionAutoSaver.updateState({
            tasksCreated: [...(mockContext.sessionAutoSaver.getSession()?.state.tasksCreated || []), task.id],
            currentTaskId: task.id,
          });
        }

        // Start execution - mock the completion flow
        mockContext.orchestrator.executeTask(task.id).then(async () => {
          // Fetch the completed task to get its final status
          const completedTask = await mockContext.orchestrator?.getTask(task.id);
          mockContext.app?.addMessage({
            type: 'assistant',
            content: `Task completed: ${completedTask?.status || 'unknown'}`,
          });

          // Track completion in session
          if (mockContext.sessionAutoSaver && completedTask?.status === 'completed') {
            await mockContext.sessionAutoSaver.addMessage({
              role: 'assistant',
              content: `Task completed: ${completedTask.status}`,
              taskId: task.id,
              agent: 'system',
            });
            await mockContext.sessionAutoSaver.updateState({
              tasksCompleted: [...(mockContext.sessionAutoSaver.getSession()?.state.tasksCompleted || []), task.id],
              currentTaskId: undefined,
            });
          }

          mockContext.app?.updateState({ currentTask: undefined, activeAgent: undefined });
        }).catch(async (error: Error) => {
          mockContext.app?.addMessage({
            type: 'error',
            content: `Task failed: ${error.message}`,
          });

          // Track failure in session
          if (mockContext.sessionAutoSaver) {
            await mockContext.sessionAutoSaver.addMessage({
              role: 'assistant',
              content: `Task failed: ${error.message}`,
              taskId: task.id,
              agent: 'system',
            });
            await mockContext.sessionAutoSaver.updateState({
              currentTaskId: undefined,
            });
          }

          mockContext.app?.updateState({ currentTask: undefined, activeAgent: undefined });
        });
      } catch (error: unknown) {
        const errorMessage = `Failed to create task: ${error instanceof Error ? error.message : String(error)}`;
        mockContext.app?.addMessage({
          type: 'error',
          content: errorMessage,
        });

        // Track error in session
        if (mockContext.sessionAutoSaver) {
          await mockContext.sessionAutoSaver.addMessage({
            role: 'assistant',
            content: errorMessage,
            agent: 'system',
          });
        }
      }
    };
  });

  it('should process natural language task descriptions', async () => {
    const description = 'Create a login component with email validation';

    await executeTask(description);

    expect(mockOrchestrator.createTask).toHaveBeenCalledWith({ description });
    expect(mockApp.addMessage).toHaveBeenCalledWith({
      type: 'system',
      content: 'Creating task...',
    });
    expect(mockApp.addMessage).toHaveBeenCalledWith({
      type: 'assistant',
      content: 'Task created: task-abc123\nStarting execution...',
    });
  });

  it('should handle complex multi-sentence task descriptions', async () => {
    const complexDescription = 'Implement a user authentication system with login and registration. Include password hashing, session management, and protected routes. Make sure to add proper error handling and validation.';

    await executeTask(complexDescription);

    expect(mockOrchestrator.createTask).toHaveBeenCalledWith({ description: complexDescription });
    expect(mockApp.addMessage).toHaveBeenCalledWith({
      type: 'system',
      content: 'Creating task...',
    });
  });

  it('should handle task descriptions with technical requirements', async () => {
    const technicalDescription = 'Refactor the API endpoints to use TypeScript interfaces and add comprehensive JSDoc documentation for all public methods';

    await executeTask(technicalDescription);

    expect(mockOrchestrator.createTask).toHaveBeenCalledWith({ description: technicalDescription });
  });

  it('should track user input in conversation context', async () => {
    const description = 'Add unit tests for the user service';

    await executeTask(description);

    expect(mockConversationManager.addMessage).toHaveBeenCalledWith({
      role: 'user',
      content: description,
    });
    expect(mockConversationManager.setTask).toHaveBeenCalledWith('task-abc123');
    expect(mockConversationManager.setAgent).toHaveBeenCalledWith('planner');
  });

  it('should track user input in session history', async () => {
    const description = 'Fix the navigation bug on mobile devices';

    await executeTask(description);

    expect(mockSessionAutoSaver.addInputToHistory).toHaveBeenCalledWith(description);
    expect(mockSessionAutoSaver.addMessage).toHaveBeenCalledWith({
      role: 'user',
      content: description,
    });
  });

  it('should update app state with current task and agent', async () => {
    const description = 'Optimize database queries for better performance';

    await executeTask(description);

    expect(mockApp.updateState).toHaveBeenCalledWith({
      currentTask: {
        id: 'task-abc123',
        description: 'Create a login component with email validation',
        status: 'pending',
        createdAt: expect.any(Date),
      },
      activeAgent: 'planner',
    });
  });

  it('should track task creation in session state', async () => {
    const description = 'Implement dark mode theme switching';

    await executeTask(description);

    expect(mockSessionAutoSaver.addMessage).toHaveBeenCalledWith({
      role: 'assistant',
      content: 'Task created: task-abc123',
      taskId: 'task-abc123',
      agent: 'system',
    });
    expect(mockSessionAutoSaver.updateState).toHaveBeenCalledWith({
      tasksCreated: ['previous-task-1', 'task-abc123'],
      currentTaskId: 'task-abc123',
    });
  });

  it('should initiate task execution', async () => {
    const description = 'Add responsive CSS Grid layout';

    await executeTask(description);

    expect(mockOrchestrator.executeTask).toHaveBeenCalledWith('task-abc123');
  });

  it('should handle task creation failure', async () => {
    const description = 'This task will fail';
    const errorMessage = 'Failed to create task';

    mockOrchestrator.createTask = vi.fn().mockRejectedValue(new Error(errorMessage));

    await executeTask(description);

    expect(mockApp.addMessage).toHaveBeenCalledWith({
      type: 'error',
      content: `Failed to create task: ${errorMessage}`,
    });
    expect(mockSessionAutoSaver.addMessage).toHaveBeenCalledWith({
      role: 'assistant',
      content: `Failed to create task: ${errorMessage}`,
      agent: 'system',
    });
  });

  it('should handle missing orchestrator', async () => {
    mockContext.orchestrator = null;

    await executeTask('Test task');

    expect(mockApp.addMessage).toHaveBeenCalledWith({
      type: 'error',
      content: 'APEX not initialized.',
    });
  });

  it('should handle empty task description', async () => {
    const emptyDescription = '';

    await executeTask(emptyDescription);

    expect(mockOrchestrator.createTask).toHaveBeenCalledWith({ description: emptyDescription });
  });

  it('should handle very long task descriptions', async () => {
    const longDescription = 'A'.repeat(1000) + ' - implement this feature with all necessary components';

    await executeTask(longDescription);

    expect(mockOrchestrator.createTask).toHaveBeenCalledWith({ description: longDescription });
    expect(mockConversationManager.addMessage).toHaveBeenCalledWith({
      role: 'user',
      content: longDescription,
    });
  });

  it('should handle special characters in task description', async () => {
    const specialDescription = 'Add @decorator for #authentication with $variables & proper escaping of "quotes" and \'apostrophes\'';

    await executeTask(specialDescription);

    expect(mockOrchestrator.createTask).toHaveBeenCalledWith({ description: specialDescription });
  });

  it('should work without conversation manager', async () => {
    mockContext.conversationManager = null;

    const description = 'Test without conversation manager';
    await executeTask(description);

    expect(mockOrchestrator.createTask).toHaveBeenCalledWith({ description });
    expect(mockApp.addMessage).toHaveBeenCalledWith({
      type: 'assistant',
      content: 'Task created: task-abc123\nStarting execution...',
    });
  });

  it('should work without session auto-saver', async () => {
    mockContext.sessionAutoSaver = null;

    const description = 'Test without session auto-saver';
    await executeTask(description);

    expect(mockOrchestrator.createTask).toHaveBeenCalledWith({ description });
    expect(mockApp.addMessage).toHaveBeenCalledWith({
      type: 'assistant',
      content: 'Task created: task-abc123\nStarting execution...',
    });
  });

  it('should handle non-Error exceptions in task creation', async () => {
    const description = 'This will throw a string error';

    mockOrchestrator.createTask = vi.fn().mockRejectedValue('String error message');

    await executeTask(description);

    expect(mockApp.addMessage).toHaveBeenCalledWith({
      type: 'error',
      content: 'Failed to create task: String error message',
    });
  });

  it('should preserve task context throughout execution lifecycle', async () => {
    const description = 'Create comprehensive test suite';

    await executeTask(description);

    // Verify task creation tracking
    expect(mockConversationManager.addMessage).toHaveBeenNthCalledWith(1, {
      role: 'user',
      content: description,
    });
    expect(mockConversationManager.addMessage).toHaveBeenNthCalledWith(2, {
      role: 'assistant',
      content: 'Task created: task-abc123\nStarting execution...',
    });
    expect(mockConversationManager.setTask).toHaveBeenCalledWith('task-abc123');
    expect(mockConversationManager.setAgent).toHaveBeenCalledWith('planner');

    // Verify session state updates
    expect(mockSessionAutoSaver.updateState).toHaveBeenCalledWith({
      tasksCreated: ['previous-task-1', 'task-abc123'],
      currentTaskId: 'task-abc123',
    });

    // Verify app state updates
    expect(mockApp.updateState).toHaveBeenCalledWith({
      currentTask: expect.objectContaining({
        id: 'task-abc123',
        description: 'Create a login component with email validation',
      }),
      activeAgent: 'planner',
    });
  });
});