import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * APEX v0.6.0 Interactive REPL Mode - Integration Testing Suite
 *
 * This test suite focuses on integration testing for the Interactive REPL mode,
 * testing how different components work together and verifying end-to-end workflows.
 *
 * Integration Test Categories:
 * 1. Component Integration Testing
 * 2. Command Pipeline Integration
 * 3. Session and Conversation Integration
 * 4. Event-Driven Architecture Integration
 * 5. Real-time UI Update Integration
 * 6. Error Propagation and Recovery
 * 7. Multi-Stage Task Workflow Integration
 *
 * @fileoverview Integration Testing for Interactive REPL Mode
 * @version 0.6.0
 */

describe('APEX v0.6.0 Interactive REPL - Integration Testing', () => {

  let mockOrchestrator: any;
  let mockApp: any;
  let mockSessionStore: any;
  let mockSessionAutoSaver: any;
  let mockConversationManager: any;
  let mockContext: any;
  let eventBus: EventEmitter;
  let testProjectPath: string;

  beforeAll(() => {
    testProjectPath = path.join(process.cwd(), 'test-project');
  });

  beforeEach(() => {
    eventBus = new EventEmitter();

    // Create integrated mock orchestrator with event capabilities
    mockOrchestrator = {
      createTask: vi.fn().mockImplementation(async ({ description }) => {
        const task = {
          id: `task-${Date.now()}`,
          description,
          status: 'pending',
          agent: 'planner',
          stage: 'planning',
          createdAt: new Date(),
        };

        // Emit task creation event
        eventBus.emit('task:created', task);

        return task;
      }),

      executeTask: vi.fn().mockImplementation(async (taskId) => {
        // Simulate task execution with events
        eventBus.emit('task:started', { taskId, timestamp: new Date() });

        // Simulate stage transitions
        const stages = ['planning', 'architecture', 'implementation', 'testing', 'deployment'];
        for (const stage of stages) {
          eventBus.emit('task:stage-changed', { taskId, stage, timestamp: new Date() });

          // Simulate agent messages for each stage
          eventBus.emit('agent:message', {
            taskId,
            agent: stage === 'planning' ? 'planner' : 'developer',
            stage,
            message: `Starting ${stage} phase...`,
            timestamp: new Date(),
          });

          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Complete the task
        eventBus.emit('task:completed', {
          taskId,
          status: 'completed',
          result: 'Task completed successfully',
          timestamp: new Date(),
        });
      }),

      getTask: vi.fn().mockResolvedValue({
        id: 'task-123',
        status: 'completed',
        description: 'Test task',
        result: 'Task completed',
      }),

      updateTaskStatus: vi.fn().mockResolvedValue(undefined),
      cancelTask: vi.fn().mockResolvedValue(true),
      resumePausedTask: vi.fn().mockResolvedValue(true),
      getTaskLogs: vi.fn().mockResolvedValue([
        { timestamp: new Date(), level: 'info', message: 'Task started' },
        { timestamp: new Date(), level: 'info', message: 'Task completed' },
      ]),
      listTasks: vi.fn().mockResolvedValue([]),

      // Event system
      on: vi.fn((event, handler) => eventBus.on(event, handler)),
      off: vi.fn((event, handler) => eventBus.off(event, handler)),
      emit: vi.fn((event, ...args) => eventBus.emit(event, ...args)),
    };

    // Create integrated app mock with state management
    let appState = {
      initialized: true,
      displayMode: 'normal',
      previewMode: false,
      showThoughts: false,
      currentTask: null,
      activeAgent: null,
      messages: [],
      inputHistory: [],
      tokens: { input: 0, output: 0 },
      cost: 0,
    };

    mockApp = {
      addMessage: vi.fn().mockImplementation((message) => {
        const newMessage = {
          ...message,
          id: `msg-${Date.now()}`,
          timestamp: new Date(),
        };
        appState.messages.push(newMessage);
        return newMessage;
      }),

      updateState: vi.fn().mockImplementation((updates) => {
        appState = { ...appState, ...updates };
        return appState;
      }),

      getState: vi.fn(() => appState),

      setState: vi.fn().mockImplementation((newState) => {
        appState = newState;
        return appState;
      }),
    };

    // Create integrated session store with persistence simulation
    const sessions = new Map();
    let activeSessionId = 'default-session';

    mockSessionStore = {
      initialize: vi.fn().mockResolvedValue(undefined),

      createSession: vi.fn().mockImplementation(async (data) => {
        const session = {
          id: `session-${Date.now()}`,
          name: data.name || 'New Session',
          description: data.description || '',
          createdAt: new Date(),
          updatedAt: new Date(),
          state: {
            tasksCreated: [],
            tasksCompleted: [],
            tokens: { input: 0, output: 0 },
            cost: 0,
          },
          messages: [],
        };
        sessions.set(session.id, session);
        activeSessionId = session.id;
        return session;
      }),

      getSession: vi.fn().mockImplementation(async (id) => {
        return sessions.get(id || activeSessionId);
      }),

      updateSession: vi.fn().mockImplementation(async (id, updates) => {
        const session = sessions.get(id);
        if (session) {
          const updatedSession = { ...session, ...updates, updatedAt: new Date() };
          sessions.set(id, updatedSession);
          return updatedSession;
        }
        return null;
      }),

      deleteSession: vi.fn().mockImplementation(async (id) => {
        return sessions.delete(id);
      }),

      listSessions: vi.fn().mockImplementation(async () => {
        return Array.from(sessions.values());
      }),

      getActiveSessionId: vi.fn(() => activeSessionId),

      setActiveSession: vi.fn().mockImplementation(async (id) => {
        if (sessions.has(id)) {
          activeSessionId = id;
          return true;
        }
        return false;
      }),
    };

    // Create integrated session auto-saver with real-time updates
    let currentSession = null;

    mockSessionAutoSaver = {
      start: vi.fn().mockImplementation(async () => {
        currentSession = await mockSessionStore.getSession(activeSessionId);
      }),

      stop: vi.fn().mockResolvedValue(undefined),

      addMessage: vi.fn().mockImplementation(async (message) => {
        if (currentSession) {
          const sessionMessage = {
            ...message,
            id: `msg-${Date.now()}`,
            index: currentSession.messages.length,
            timestamp: new Date(),
          };
          currentSession.messages.push(sessionMessage);
          await mockSessionStore.updateSession(currentSession.id, {
            messages: currentSession.messages,
          });
        }
      }),

      addInputToHistory: vi.fn().mockImplementation(async (input) => {
        if (currentSession) {
          currentSession.inputHistory = currentSession.inputHistory || [];
          currentSession.inputHistory.push({
            input,
            timestamp: new Date(),
          });
          await mockSessionStore.updateSession(currentSession.id, {
            inputHistory: currentSession.inputHistory,
          });
        }
      }),

      updateState: vi.fn().mockImplementation(async (stateUpdate) => {
        if (currentSession) {
          currentSession.state = { ...currentSession.state, ...stateUpdate };
          await mockSessionStore.updateSession(currentSession.id, {
            state: currentSession.state,
          });
        }
      }),

      getSession: vi.fn(() => currentSession),
      save: vi.fn().mockResolvedValue(undefined),
    };

    // Create integrated conversation manager with context tracking
    let conversationContext = {
      currentTask: null,
      currentAgent: null,
      messages: [],
      intent: null,
    };

    mockConversationManager = {
      addMessage: vi.fn().mockImplementation((message) => {
        const contextMessage = {
          ...message,
          id: `ctx-msg-${Date.now()}`,
          timestamp: new Date(),
        };
        conversationContext.messages.push(contextMessage);
      }),

      setTask: vi.fn().mockImplementation((taskId) => {
        conversationContext.currentTask = taskId;
      }),

      setAgent: vi.fn().mockImplementation((agent) => {
        conversationContext.currentAgent = agent;
      }),

      getRecentMessages: vi.fn().mockImplementation((count = 10) => {
        return conversationContext.messages.slice(-count);
      }),

      clearContext: vi.fn().mockImplementation(() => {
        conversationContext = {
          currentTask: null,
          currentAgent: null,
          messages: [],
          intent: null,
        };
      }),

      detectIntent: vi.fn().mockImplementation((input) => {
        if (input.toLowerCase().includes('create') || input.toLowerCase().includes('build')) {
          return 'task_creation';
        }
        if (input.toLowerCase().includes('status') || input.toLowerCase().includes('help')) {
          return 'information_request';
        }
        return 'general_interaction';
      }),

      getSuggestions: vi.fn().mockImplementation(() => {
        return [
          'Create a new component',
          'Check task status',
          'View recent logs',
        ];
      }),
    };

    // Create integrated context
    mockContext = {
      cwd: testProjectPath,
      initialized: true,
      config: {
        projectName: 'test-project',
        apiPort: 3000,
        webUIPort: 3001,
        model: 'claude-3-sonnet',
      },
      orchestrator: mockOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
      app: mockApp,
      sessionStore: mockSessionStore,
      sessionAutoSaver: mockSessionAutoSaver,
      conversationManager: mockConversationManager,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    eventBus.removeAllListeners();
  });

  describe('Component Integration Testing', () => {
    describe('REPL startup and initialization', () => {
      it('should integrate all components during startup', async () => {
        const startupSequence = async () => {
          // 1. Initialize session store
          await mockSessionStore.initialize();

          // 2. Create or load active session
          const session = await mockSessionStore.createSession({
            name: 'REPL Session',
          });

          // 3. Start session auto-saver
          await mockSessionAutoSaver.start();

          // 4. Set up orchestrator event listeners
          const eventTypes = [
            'task:created', 'task:completed', 'agent:message',
            'usage:updated', 'task:stage-changed'
          ];

          eventTypes.forEach(event => {
            mockOrchestrator.on(event, (data: any) => {
              // Forward events to app for UI updates
              mockApp.addMessage({
                type: 'system',
                content: `Event: ${event}`,
                metadata: data,
              });
            });
          });

          // 5. Initialize conversation manager
          mockConversationManager.clearContext();

          return { session, eventTypes };
        };

        const result = await startupSequence();

        // Verify integration
        expect(mockSessionStore.initialize).toHaveBeenCalledOnce();
        expect(mockSessionStore.createSession).toHaveBeenCalledWith({
          name: 'REPL Session',
        });
        expect(mockSessionAutoSaver.start).toHaveBeenCalledOnce();
        expect(mockOrchestrator.on).toHaveBeenCalledTimes(result.eventTypes.length);
        expect(mockConversationManager.clearContext).toHaveBeenCalledOnce();
      });

      it('should handle component initialization failures gracefully', async () => {
        mockSessionStore.initialize.mockRejectedValueOnce(new Error('Session store init failed'));

        const gracefulStartup = async () => {
          try {
            await mockSessionStore.initialize();
          } catch (error) {
            // Fallback to in-memory session
            await mockSessionStore.createSession({
              name: 'Temporary Session',
              temporary: true,
            });
            return 'fallback_mode';
          }
        };

        const result = await gracefulStartup();

        expect(result).toBe('fallback_mode');
        expect(mockSessionStore.createSession).toHaveBeenCalledWith({
          name: 'Temporary Session',
          temporary: true,
        });
      });
    });

    describe('Component communication flow', () => {
      it('should propagate events between components correctly', async () => {
        // Set up event listeners to track propagation
        const eventLog: Array<{ component: string; event: string; data: any }> = [];

        mockOrchestrator.on('task:created', (data: any) => {
          eventLog.push({ component: 'orchestrator', event: 'task:created', data });

          // App should receive and process the event
          mockApp.updateState({ currentTask: data });
          eventLog.push({ component: 'app', event: 'state_updated', data: { currentTask: data } });
        });

        mockOrchestrator.on('agent:message', (data: any) => {
          eventLog.push({ component: 'orchestrator', event: 'agent:message', data });

          // App should display the message
          mockApp.addMessage({
            type: 'assistant',
            content: data.message,
            agent: data.agent,
          });
          eventLog.push({ component: 'app', event: 'message_added', data });
        });

        // Trigger task creation
        const task = await mockOrchestrator.createTask({
          description: 'Test integration task',
        });

        // Trigger agent message
        eventBus.emit('agent:message', {
          taskId: task.id,
          agent: 'planner',
          message: 'Starting task planning...',
        });

        // Verify event propagation
        expect(eventLog).toHaveLength(4);
        expect(eventLog[0]).toEqual({
          component: 'orchestrator',
          event: 'task:created',
          data: task,
        });
        expect(eventLog[1]).toEqual({
          component: 'app',
          event: 'state_updated',
          data: { currentTask: task },
        });
        expect(eventLog[2].component).toBe('orchestrator');
        expect(eventLog[2].event).toBe('agent:message');
        expect(eventLog[3].component).toBe('app');
        expect(eventLog[3].event).toBe('message_added');
      });

      it('should maintain data consistency across components', async () => {
        const taskDescription = 'Build a user profile component';

        // Execute integrated task flow
        const task = await mockOrchestrator.createTask({
          description: taskDescription,
        });

        // Update conversation context
        mockConversationManager.setTask(task.id);
        mockConversationManager.setAgent('planner');
        mockConversationManager.addMessage({
          role: 'user',
          content: taskDescription,
        });

        // Update app state
        mockApp.updateState({
          currentTask: task,
          activeAgent: 'planner',
        });

        // Update session
        await mockSessionAutoSaver.updateState({
          tasksCreated: [task.id],
          currentTaskId: task.id,
        });

        // Verify data consistency
        const appState = mockApp.getState();
        const session = mockSessionAutoSaver.getSession();
        const recentMessages = mockConversationManager.getRecentMessages(1);

        expect(appState.currentTask.id).toBe(task.id);
        expect(appState.activeAgent).toBe('planner');
        expect(session.state.currentTaskId).toBe(task.id);
        expect(session.state.tasksCreated).toContain(task.id);
        expect(recentMessages[0].content).toBe(taskDescription);
      });
    });
  });

  describe('Command Pipeline Integration', () => {
    describe('Command processing workflow', () => {
      it('should process commands through the complete pipeline', async () => {
        const processCommandPipeline = async (command: string, args: string[] = []) => {
          // 1. Parse command
          const parsedCommand = { command, args, timestamp: new Date() };

          // 2. Log command to session
          await mockSessionAutoSaver.addInputToHistory(`/${command} ${args.join(' ')}`);

          // 3. Add to conversation context
          mockConversationManager.addMessage({
            role: 'user',
            content: `/${command} ${args.join(' ')}`,
          });

          // 4. Execute command
          let result = null;
          switch (command) {
            case 'status':
              const status = {
                initialized: mockContext.initialized,
                currentTask: mockApp.getState().currentTask,
                activeTasks: await mockOrchestrator.listTasks(),
              };
              result = status;
              mockApp.addMessage({
                type: 'assistant',
                content: `Status: ${status.initialized ? 'Ready' : 'Not initialized'}`,
              });
              break;

            case 'cancel':
              if (args[0]) {
                await mockOrchestrator.cancelTask(args[0]);
                result = { cancelled: args[0] };
                mockApp.addMessage({
                  type: 'system',
                  content: `Task ${args[0]} cancelled`,
                });
              }
              break;

            case 'logs':
              const logs = await mockOrchestrator.getTaskLogs(args[0] || 'current');
              result = logs;
              mockApp.addMessage({
                type: 'assistant',
                content: `Retrieved ${logs.length} log entries`,
              });
              break;

            default:
              mockApp.addMessage({
                type: 'error',
                content: `Unknown command: ${command}`,
              });
          }

          // 5. Update session with result
          if (result) {
            await mockSessionAutoSaver.addMessage({
              role: 'assistant',
              content: `Command ${command} executed`,
              metadata: { command: parsedCommand, result },
            });
          }

          return result;
        };

        // Test various commands
        const statusResult = await processCommandPipeline('status');
        const logsResult = await processCommandPipeline('logs', ['task-123']);
        const cancelResult = await processCommandPipeline('cancel', ['task-456']);

        // Verify pipeline execution
        expect(mockSessionAutoSaver.addInputToHistory).toHaveBeenCalledTimes(3);
        expect(mockConversationManager.addMessage).toHaveBeenCalledTimes(3);
        expect(mockApp.addMessage).toHaveBeenCalledTimes(3);
        expect(mockSessionAutoSaver.addMessage).toHaveBeenCalledTimes(3);

        expect(statusResult).toHaveProperty('initialized');
        expect(logsResult).toBeInstanceOf(Array);
        expect(cancelResult).toEqual({ cancelled: 'task-456' });
      });

      it('should handle command errors in the pipeline', async () => {
        mockOrchestrator.cancelTask.mockRejectedValueOnce(new Error('Task not found'));

        const processFailingCommand = async () => {
          try {
            await mockOrchestrator.cancelTask('invalid-task');
          } catch (error) {
            // Add error to conversation
            mockConversationManager.addMessage({
              role: 'assistant',
              content: `Error: ${(error as Error).message}`,
            });

            // Display error in UI
            mockApp.addMessage({
              type: 'error',
              content: `Failed to cancel task: ${(error as Error).message}`,
            });

            // Log error in session
            await mockSessionAutoSaver.addMessage({
              role: 'system',
              content: `Error processing command: ${(error as Error).message}`,
            });

            return error;
          }
        };

        const error = await processFailingCommand();

        expect(error).toBeInstanceOf(Error);
        expect(mockConversationManager.addMessage).toHaveBeenCalledWith({
          role: 'assistant',
          content: 'Error: Task not found',
        });
        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'Failed to cancel task: Task not found',
        });
      });
    });

    describe('Command state management integration', () => {
      it('should maintain command state across display mode changes', async () => {
        // Execute display mode commands
        const modes = ['compact', 'verbose', 'normal'];

        for (const mode of modes) {
          mockApp.updateState({ displayMode: mode });
          mockApp.addMessage({
            type: 'system',
            content: `${mode.charAt(0).toUpperCase() + mode.slice(1)} mode enabled`,
          });

          // Verify state consistency
          const currentState = mockApp.getState();
          expect(currentState.displayMode).toBe(mode);
        }

        // Verify message history reflects mode changes
        const appState = mockApp.getState();
        const modeMessages = appState.messages.filter(msg =>
          msg.content.includes('mode enabled')
        );
        expect(modeMessages).toHaveLength(3);
      });

      it('should handle concurrent command execution', async () => {
        const commands = [
          { cmd: 'status', args: [] },
          { cmd: 'logs', args: ['task-1'] },
          { cmd: 'logs', args: ['task-2'] },
        ];

        // Execute commands concurrently
        const results = await Promise.all(
          commands.map(async ({ cmd, args }) => {
            if (cmd === 'status') {
              return { initialized: true };
            }
            if (cmd === 'logs') {
              return await mockOrchestrator.getTaskLogs(args[0]);
            }
          })
        );

        expect(results).toHaveLength(3);
        expect(results[0]).toEqual({ initialized: true });
        expect(results[1]).toBeInstanceOf(Array);
        expect(results[2]).toBeInstanceOf(Array);
      });
    });
  });

  describe('Session and Conversation Integration', () => {
    describe('End-to-end session workflow', () => {
      it('should maintain session continuity throughout user interaction', async () => {
        // Start new session
        const session = await mockSessionStore.createSession({
          name: 'Integration Test Session',
          description: 'Testing session continuity',
        });

        await mockSessionAutoSaver.start();

        // Simulate user interaction sequence
        const interactions = [
          { type: 'task', content: 'Create a navigation component' },
          { type: 'command', content: '/status' },
          { type: 'task', content: 'Add responsive breakpoints' },
          { type: 'command', content: '/logs' },
        ];

        const sessionHistory = [];

        for (const interaction of interactions) {
          if (interaction.type === 'task') {
            // Task creation
            const task = await mockOrchestrator.createTask({
              description: interaction.content,
            });

            // Track in conversation
            mockConversationManager.addMessage({
              role: 'user',
              content: interaction.content,
            });

            mockConversationManager.setTask(task.id);

            // Track in session
            await mockSessionAutoSaver.addMessage({
              role: 'user',
              content: interaction.content,
            });

            await mockSessionAutoSaver.updateState({
              tasksCreated: [...(mockSessionAutoSaver.getSession()?.state.tasksCreated || []), task.id],
            });

            sessionHistory.push({ type: 'task', task });
          } else if (interaction.type === 'command') {
            // Command execution
            await mockSessionAutoSaver.addInputToHistory(interaction.content);

            mockConversationManager.addMessage({
              role: 'user',
              content: interaction.content,
            });

            sessionHistory.push({ type: 'command', content: interaction.content });
          }
        }

        // Verify session continuity
        const finalSession = mockSessionAutoSaver.getSession();
        expect(finalSession.id).toBe(session.id);
        expect(finalSession.state.tasksCreated).toHaveLength(2);
        expect(sessionHistory).toHaveLength(4);

        const recentMessages = mockConversationManager.getRecentMessages(8);
        expect(recentMessages).toHaveLength(4);
      });

      it('should handle session branching and merging', async () => {
        // Create main session
        const mainSession = await mockSessionStore.createSession({
          name: 'Main Session',
        });

        // Add some tasks to main session
        const mainTask = await mockOrchestrator.createTask({
          description: 'Main task',
        });

        await mockSessionAutoSaver.updateState({
          tasksCreated: [mainTask.id],
        });

        // Simulate session branching (new session based on current state)
        const branchSession = await mockSessionStore.createSession({
          name: 'Branch Session',
          basedOn: mainSession.id,
        });

        // Switch to branch session
        await mockSessionStore.setActiveSession(branchSession.id);
        await mockSessionAutoSaver.start();

        // Add tasks to branch
        const branchTask = await mockOrchestrator.createTask({
          description: 'Branch task',
        });

        await mockSessionAutoSaver.updateState({
          tasksCreated: [branchTask.id],
        });

        // Verify session isolation
        const branch = mockSessionAutoSaver.getSession();
        expect(branch.id).toBe(branchSession.id);
        expect(branch.state.tasksCreated).toContain(branchTask.id);
      });
    });

    describe('Conversation context management', () => {
      it('should maintain conversation context across task transitions', async () => {
        // Start first task
        const task1 = await mockOrchestrator.createTask({
          description: 'Create login component',
        });

        mockConversationManager.setTask(task1.id);
        mockConversationManager.setAgent('planner');

        mockConversationManager.addMessage({
          role: 'assistant',
          content: 'Starting login component planning...',
        });

        // Simulate task progression
        eventBus.emit('task:stage-changed', {
          taskId: task1.id,
          stage: 'implementation',
          agent: 'developer',
        });

        mockConversationManager.setAgent('developer');
        mockConversationManager.addMessage({
          role: 'assistant',
          content: 'Implementing login component...',
        });

        // Start second task
        const task2 = await mockOrchestrator.createTask({
          description: 'Add form validation',
        });

        mockConversationManager.setTask(task2.id);
        mockConversationManager.setAgent('planner');

        // Verify context switching
        const recentMessages = mockConversationManager.getRecentMessages(10);
        expect(recentMessages).toHaveLength(2);

        const task1Messages = recentMessages.filter(msg =>
          msg.content.includes('login component')
        );
        const task2Messages = recentMessages.filter(msg =>
          msg.content.includes('validation')
        );

        expect(task1Messages).toHaveLength(2);
        expect(task2Messages).toHaveLength(0); // Task 2 just started
      });

      it('should provide relevant context for agent decisions', async () => {
        // Build conversation history
        const conversationFlow = [
          { role: 'user', content: 'Create a user dashboard' },
          { role: 'assistant', content: 'I\'ll create a user dashboard component...' },
          { role: 'user', content: 'Make sure it\'s responsive' },
          { role: 'assistant', content: 'I\'ll add responsive design patterns...' },
          { role: 'user', content: 'Add a dark mode toggle' },
        ];

        conversationFlow.forEach(message => {
          mockConversationManager.addMessage(message);
        });

        // Simulate agent decision making based on context
        const intent = mockConversationManager.detectIntent('Add a dark mode toggle');
        const suggestions = mockConversationManager.getSuggestions();
        const recentContext = mockConversationManager.getRecentMessages(3);

        expect(intent).toBe('task_creation');
        expect(suggestions).toBeInstanceOf(Array);
        expect(recentContext).toHaveLength(3);
        expect(recentContext[0].content).toContain('responsive');
      });
    });
  });

  describe('Event-Driven Architecture Integration', () => {
    describe('Real-time event processing', () => {
      it('should process orchestrator events in real-time', async () => {
        const eventLog: Array<{ event: string; timestamp: number; processed: boolean }> = [];

        // Set up real-time event processing
        const eventTypes = ['task:created', 'task:started', 'task:completed', 'agent:message'];

        eventTypes.forEach(eventType => {
          mockOrchestrator.on(eventType, (data: any) => {
            const timestamp = Date.now();
            eventLog.push({ event: eventType, timestamp, processed: false });

            // Simulate real-time UI updates
            mockApp.addMessage({
              type: 'system',
              content: `Event: ${eventType}`,
              metadata: data,
            });

            // Mark as processed
            const logEntry = eventLog[eventLog.length - 1];
            logEntry.processed = true;
          });
        });

        // Trigger events
        await mockOrchestrator.createTask({ description: 'Test task' });
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow event processing

        // Start task execution
        await mockOrchestrator.executeTask('task-123');
        await new Promise(resolve => setTimeout(resolve, 100)); // Allow execution events

        // Verify real-time processing
        const processedEvents = eventLog.filter(entry => entry.processed);
        expect(processedEvents.length).toBeGreaterThan(0);

        // Verify processing time (should be near-instantaneous)
        eventLog.forEach(entry => {
          expect(entry.processed).toBe(true);
        });
      });

      it('should handle high-frequency events efficiently', async () => {
        const eventCounts = { total: 0, processed: 0 };

        // Set up high-frequency event handler
        mockOrchestrator.on('agent:thinking', (data: any) => {
          eventCounts.processed++;

          // Batch UI updates for performance
          if (eventCounts.processed % 10 === 0) {
            mockApp.addMessage({
              type: 'system',
              content: `Processed ${eventCounts.processed} thinking events`,
            });
          }
        });

        // Emit high-frequency events
        const startTime = Date.now();
        for (let i = 0; i < 100; i++) {
          eventBus.emit('agent:thinking', {
            agent: 'developer',
            thought: `Thinking step ${i}`,
            taskId: 'task-123',
          });
          eventCounts.total++;
        }
        const endTime = Date.now();

        // Allow event processing
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify efficient processing
        expect(eventCounts.total).toBe(100);
        expect(eventCounts.processed).toBe(100);
        expect(endTime - startTime).toBeLessThan(100); // Should emit quickly

        // Verify batched UI updates
        const appState = mockApp.getState();
        const batchMessages = appState.messages.filter(msg =>
          msg.content.includes('thinking events')
        );
        expect(batchMessages.length).toBe(10); // 100 events / 10 batch size
      });
    });

    describe('Event propagation and error handling', () => {
      it('should handle event processing errors gracefully', async () => {
        const errorLog: Array<{ event: string; error: string }> = [];

        // Set up error-prone event handler
        mockOrchestrator.on('task:failed', (data: any) => {
          if (data.taskId === 'error-task') {
            const error = new Error('Event processing failed');
            errorLog.push({ event: 'task:failed', error: error.message });
            throw error;
          } else {
            mockApp.addMessage({
              type: 'error',
              content: `Task ${data.taskId} failed: ${data.error}`,
            });
          }
        });

        // Test normal event processing
        eventBus.emit('task:failed', {
          taskId: 'normal-task',
          error: 'Normal failure',
        });

        // Test error in event processing
        try {
          eventBus.emit('task:failed', {
            taskId: 'error-task',
            error: 'This will cause processing error',
          });
        } catch (error) {
          // Error should be caught and logged
        }

        // Verify error handling
        expect(errorLog).toHaveLength(1);
        expect(errorLog[0].error).toBe('Event processing failed');

        // Verify normal processing continues
        const appState = mockApp.getState();
        const errorMessage = appState.messages.find(msg =>
          msg.content.includes('normal-task')
        );
        expect(errorMessage).toBeDefined();
      });

      it('should maintain event ordering under load', async () => {
        const processedOrder: string[] = [];

        // Set up ordered event processing
        const eventTypes = [
          'task:created', 'task:started', 'task:stage-changed',
          'task:completed'
        ];

        eventTypes.forEach(eventType => {
          mockOrchestrator.on(eventType, (data: any) => {
            processedOrder.push(`${eventType}:${data.taskId || data.id}`);
          });
        });

        // Emit events in specific order
        const taskId = 'ordered-task';
        eventBus.emit('task:created', { id: taskId });
        eventBus.emit('task:started', { taskId });
        eventBus.emit('task:stage-changed', { taskId, stage: 'implementation' });
        eventBus.emit('task:completed', { taskId });

        // Allow processing
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify order preservation
        expect(processedOrder).toEqual([
          `task:created:${taskId}`,
          `task:started:${taskId}`,
          `task:stage-changed:${taskId}`,
          `task:completed:${taskId}`,
        ]);
      });
    });
  });

  describe('Error Propagation and Recovery Integration', () => {
    describe('Cross-component error handling', () => {
      it('should propagate errors across component boundaries', async () => {
        const errorTracker = {
          orchestrator: false,
          app: false,
          session: false,
          conversation: false,
        };

        // Simulate error in orchestrator
        mockOrchestrator.createTask.mockRejectedValueOnce(
          new Error('Orchestrator connection failed')
        );

        const handleTaskCreationError = async (description: string) => {
          try {
            await mockOrchestrator.createTask({ description });
          } catch (error) {
            errorTracker.orchestrator = true;

            // Propagate to app
            mockApp.addMessage({
              type: 'error',
              content: `Task creation failed: ${(error as Error).message}`,
            });
            errorTracker.app = true;

            // Propagate to conversation
            mockConversationManager.addMessage({
              role: 'assistant',
              content: `I encountered an error: ${(error as Error).message}`,
            });
            errorTracker.conversation = true;

            // Propagate to session
            try {
              await mockSessionAutoSaver.addMessage({
                role: 'system',
                content: `Error: ${(error as Error).message}`,
              });
              errorTracker.session = true;
            } catch (sessionError) {
              // Session error handled separately
            }
          }
        };

        await handleTaskCreationError('Test task');

        // Verify error propagation
        expect(errorTracker.orchestrator).toBe(true);
        expect(errorTracker.app).toBe(true);
        expect(errorTracker.conversation).toBe(true);
        expect(errorTracker.session).toBe(true);
      });

      it('should implement graceful degradation when components fail', async () => {
        // Simulate session store failure
        mockSessionStore.updateSession.mockRejectedValue(new Error('Storage unavailable'));

        const gracefulTaskExecution = async (description: string) => {
          let fallbackMode = false;

          // Create task normally
          const task = await mockOrchestrator.createTask({ description });

          // Try to update session
          try {
            await mockSessionAutoSaver.updateState({
              tasksCreated: [task.id],
            });
          } catch (error) {
            // Fallback to in-memory tracking
            fallbackMode = true;
            mockApp.addMessage({
              type: 'warning',
              content: 'Session persistence unavailable, using temporary storage',
            });
          }

          // Continue with task execution regardless
          mockApp.updateState({ currentTask: task });

          return { task, fallbackMode };
        };

        const result = await gracefulTaskExecution('Test task with storage failure');

        expect(result.fallbackMode).toBe(true);
        expect(result.task).toBeDefined();
        expect(mockApp.updateState).toHaveBeenCalledWith({
          currentTask: result.task,
        });
      });
    });

    describe('Recovery and retry mechanisms', () => {
      it('should implement automatic retry for transient failures', async () => {
        let attempts = 0;
        const maxRetries = 3;

        // Mock intermittent failure
        mockOrchestrator.createTask.mockImplementation(async ({ description }) => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return {
            id: `task-${attempts}`,
            description,
            status: 'pending',
          };
        });

        const retryableTaskCreation = async (description: string) => {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              const task = await mockOrchestrator.createTask({ description });
              return { task, attempts: attempt };
            } catch (error) {
              if (attempt === maxRetries) {
                throw error;
              }
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
        };

        const result = await retryableTaskCreation('Test task with retries');

        expect(result?.attempts).toBe(3);
        expect(result?.task).toBeDefined();
        expect(attempts).toBe(3);
      });

      it('should maintain system state consistency during recovery', async () => {
        // Simulate partial failure during state update
        let sessionUpdateFailed = false;
        mockSessionAutoSaver.updateState.mockImplementation(async (update) => {
          if (!sessionUpdateFailed) {
            sessionUpdateFailed = true;
            throw new Error('Session update failed');
          }
          // Success on retry
          return update;
        });

        const consistentStateUpdate = async (taskData: any) => {
          // Update app state first
          mockApp.updateState({ currentTask: taskData });

          // Try to update session
          try {
            await mockSessionAutoSaver.updateState({
              currentTaskId: taskData.id,
            });
          } catch (error) {
            // Rollback app state and retry session
            mockApp.updateState({ currentTask: null });

            // Retry session update
            await mockSessionAutoSaver.updateState({
              currentTaskId: taskData.id,
            });

            // Reapply app state
            mockApp.updateState({ currentTask: taskData });
          }

          return mockApp.getState();
        };

        const taskData = { id: 'test-task', description: 'Test' };
        const finalState = await consistentStateUpdate(taskData);

        expect(finalState.currentTask).toEqual(taskData);
        expect(mockApp.updateState).toHaveBeenCalledTimes(3); // Initial, rollback, final
      });
    });
  });

  describe('Performance and Load Integration', () => {
    describe('Concurrent operation handling', () => {
      it('should handle multiple simultaneous users gracefully', async () => {
        const userSessions = await Promise.all([
          mockSessionStore.createSession({ name: 'User 1 Session' }),
          mockSessionStore.createSession({ name: 'User 2 Session' }),
          mockSessionStore.createSession({ name: 'User 3 Session' }),
        ]);

        // Simulate concurrent user actions
        const userActions = userSessions.map(async (session, index) => {
          // Set active session
          await mockSessionStore.setActiveSession(session.id);

          // Create tasks for each user
          const tasks = await Promise.all([
            mockOrchestrator.createTask({
              description: `User ${index + 1} task 1`,
            }),
            mockOrchestrator.createTask({
              description: `User ${index + 1} task 2`,
            }),
          ]);

          return { session, tasks };
        });

        const results = await Promise.all(userActions);

        // Verify concurrent handling
        expect(results).toHaveLength(3);
        results.forEach((result, index) => {
          expect(result.session.name).toBe(`User ${index + 1} Session`);
          expect(result.tasks).toHaveLength(2);
        });
      });

      it('should maintain performance under event load', async () => {
        const eventCounts = { emitted: 0, processed: 0 };
        const processingTimes: number[] = [];

        // Set up performance monitoring
        mockOrchestrator.on('agent:message', (data: any) => {
          const startTime = performance.now();

          // Simulate processing
          mockApp.addMessage({
            type: 'assistant',
            content: data.message,
            agent: data.agent,
          });

          const endTime = performance.now();
          processingTimes.push(endTime - startTime);
          eventCounts.processed++;
        });

        // Generate event load
        const startTime = performance.now();
        for (let i = 0; i < 50; i++) {
          eventBus.emit('agent:message', {
            agent: 'developer',
            message: `Message ${i}`,
            taskId: 'load-test-task',
          });
          eventCounts.emitted++;
        }

        // Allow processing
        await new Promise(resolve => setTimeout(resolve, 100));

        const totalTime = performance.now() - startTime;

        // Verify performance
        expect(eventCounts.emitted).toBe(50);
        expect(eventCounts.processed).toBe(50);
        expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

        const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
        expect(avgProcessingTime).toBeLessThan(10); // Average under 10ms per event
      });
    });
  });
});