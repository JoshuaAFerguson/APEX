/**
 * Teams Messaging Extension Test Suite for @apexcli/api Package
 *
 * Comprehensive tests for Teams messaging extension functionality including
 * query handling, action processing, and card interactions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeamsMessagingExtension } from '../packages/api/src/services/teams-messaging-extension.js';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock Bot Framework SDK
vi.mock('botbuilder', () => ({
  TurnContext: vi.fn(),
  CardFactory: {
    adaptiveCard: vi.fn((card) => ({
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: card
    })),
  },
  ActivityTypes: { Message: 'message' },
}));

describe('TeamsMessagingExtension', () => {
  let messagingExtension: TeamsMessagingExtension;
  let mockOrchestrator: ApexOrchestrator;
  let mockContext: any;

  // Sample data for testing
  const mockTasks = [
    {
      id: 'task-123',
      description: 'Implement user authentication',
      status: 'in-progress',
      workflow: 'development',
      priority: 'high',
      effort: 'large',
      createdAt: new Date('2026-03-15T10:00:00Z'),
      updatedAt: new Date('2026-03-15T11:00:00Z'),
    },
    {
      id: 'task-456',
      description: 'Update documentation',
      status: 'pending',
      workflow: 'docs',
      priority: 'normal',
      effort: 'small',
      createdAt: new Date('2026-03-15T09:00:00Z'),
      updatedAt: new Date('2026-03-15T10:30:00Z'),
    },
    {
      id: 'task-789',
      description: 'Fix authentication bug',
      status: 'completed',
      workflow: 'bugfix',
      priority: 'high',
      effort: 'medium',
      createdAt: new Date('2026-03-14T14:00:00Z'),
      updatedAt: new Date('2026-03-15T08:00:00Z'),
    },
  ];

  const mockThought = {
    id: 'thought-123',
    content: 'Great idea for the next feature',
    createdAt: new Date('2026-03-15T12:00:00Z'),
  };

  beforeEach(() => {
    // Mock orchestrator
    mockOrchestrator = {
      createTask: vi.fn(() => Promise.resolve(mockTasks[0])),
      getTask: vi.fn((id) => {
        const task = mockTasks.find(t => t.id === id);
        return Promise.resolve(task || null);
      }),
      listTasks: vi.fn(() => Promise.resolve(mockTasks)),
      cancelTask: vi.fn(() => Promise.resolve(true)),
      captureThought: vi.fn(() => Promise.resolve(mockThought)),
    } as any;

    // Mock Turn Context
    mockContext = {
      activity: {
        name: 'composeExtension/query',
        value: {},
      },
      sendActivity: vi.fn(),
    };

    // Create messaging extension instance
    messagingExtension = new TeamsMessagingExtension(mockOrchestrator);
  });

  describe('Query Handling', () => {
    it('should handle empty query and return recent tasks', async () => {
      const query = {
        parameters: [{ value: '' }],
      };

      const result = await messagingExtension.handleQuery(mockContext, query);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 10 });
      expect(result.composeExtension.type).toBe('result');
      expect(result.composeExtension.attachmentLayout).toBe('list');
      expect(result.composeExtension.attachments).toHaveLength(mockTasks.length);
    });

    it('should handle search query and filter tasks', async () => {
      const query = {
        parameters: [{ value: 'authentication' }],
      };

      const result = await messagingExtension.handleQuery(mockContext, query);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 50 });
      expect(result.composeExtension.attachments).toHaveLength(2); // Should match 2 tasks with "authentication"
    });

    it('should handle case-insensitive search', async () => {
      const query = {
        parameters: [{ value: 'DOCUMENTATION' }],
      };

      const result = await messagingExtension.handleQuery(mockContext, query);

      expect(result.composeExtension.attachments).toHaveLength(1); // Should match documentation task
    });

    it('should search by task ID', async () => {
      const query = {
        parameters: [{ value: 'task-456' }],
      };

      const result = await messagingExtension.handleQuery(mockContext, query);

      expect(result.composeExtension.attachments).toHaveLength(1);
      const attachment = result.composeExtension.attachments[0];
      expect(attachment.content.body[0].text).toContain('task-456');
    });

    it('should handle query without parameters', async () => {
      const query = {};

      const result = await messagingExtension.handleQuery(mockContext, query);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 10 });
      expect(result.composeExtension.attachments).toHaveLength(mockTasks.length);
    });

    it('should handle query errors gracefully', async () => {
      mockOrchestrator.listTasks.mockRejectedValueOnce(new Error('Database error'));

      const query = {
        parameters: [{ value: 'test' }],
      };

      const result = await messagingExtension.handleQuery(mockContext, query);

      expect(result.composeExtension.type).toBe('result');
      expect(result.composeExtension.attachments).toHaveLength(0);
    });

    it('should build correct preview cards for search results', async () => {
      const query = {
        parameters: [{ value: 'task-123' }],
      };

      const result = await messagingExtension.handleQuery(mockContext, query);

      const attachment = result.composeExtension.attachments[0];
      expect(attachment.contentType).toBe('application/vnd.microsoft.card.adaptive');
      expect(attachment.content.version).toBe('1.2');
      expect(attachment.content.body[0].text).toBe('**task-123**');
      expect(attachment.content.body[1].text).toBe('Implement user authentication');

      const factSet = attachment.content.body[2];
      expect(factSet.type).toBe('FactSet');
      expect(factSet.facts).toContainEqual({ title: 'Status', value: 'in-progress' });
      expect(factSet.facts).toContainEqual({ title: 'Priority', value: 'high' });
      expect(factSet.facts).toContainEqual({ title: 'Workflow', value: 'development' });

      const action = attachment.content.actions[0];
      expect(action.type).toBe('Action.Submit');
      expect(action.title).toBe('View Details');
      expect(action.data).toEqual({ action: 'report', taskId: 'task-123' });
    });
  });

  describe('Action Handling', () => {
    describe('Create Task Action', () => {
      it('should handle create task action with description', async () => {
        const action = {
          commandId: 'createTask',
          data: {
            description: 'New task from messaging extension',
          },
        };

        const result = await messagingExtension.handleAction(mockContext, action);

        expect(mockOrchestrator.createTask).toHaveBeenCalledWith({
          description: 'New task from messaging extension',
        });
        expect(result.task.type).toBe('continue');
        expect(result.task.value.title).toBe('Task Created');
      });

      it('should return task form when description is missing', async () => {
        const action = {
          commandId: 'createTask',
          data: {},
        };

        const result = await messagingExtension.handleAction(mockContext, action);

        expect(mockOrchestrator.createTask).not.toHaveBeenCalled();
        expect(result.task.type).toBe('continue');
        expect(result.task.value.title).toBe('Create New Task');
        expect(result.task.value.card.content.body[1].type).toBe('Input.Text');
      });

      it('should handle empty description', async () => {
        const action = {
          commandId: 'createTask',
          data: {
            description: '   ', // Only whitespace
          },
        };

        const result = await messagingExtension.handleAction(mockContext, action);

        expect(mockOrchestrator.createTask).not.toHaveBeenCalled();
        expect(result.task.value.title).toBe('Create New Task');
      });
    });

    describe('View Task Action', () => {
      it('should handle view task action with valid task ID', async () => {
        const action = {
          commandId: 'viewTask',
          data: {
            taskId: 'task-123',
          },
        };

        const result = await messagingExtension.handleAction(mockContext, action);

        expect(mockOrchestrator.getTask).toHaveBeenCalledWith('task-123');
        expect(result.task.type).toBe('continue');
        expect(result.task.value.title).toBe('Task task-123');
      });

      it('should handle view task action with missing task ID', async () => {
        const action = {
          commandId: 'viewTask',
          data: {},
        };

        const result = await messagingExtension.handleAction(mockContext, action);

        expect(mockOrchestrator.getTask).not.toHaveBeenCalled();
        expect(result.task.type).toBe('message');
        expect(result.task.value).toBe('❌ Task ID required');
      });

      it('should handle view task action with nonexistent task', async () => {
        const action = {
          commandId: 'viewTask',
          data: {
            taskId: 'nonexistent-task',
          },
        };

        const result = await messagingExtension.handleAction(mockContext, action);

        expect(mockOrchestrator.getTask).toHaveBeenCalledWith('nonexistent-task');
        expect(result.task.type).toBe('message');
        expect(result.task.value).toBe('❌ Task not found');
      });
    });

    describe('Search Tasks Action', () => {
      it('should handle search tasks action', async () => {
        const action = {
          commandId: 'searchTasks',
          data: {
            searchText: 'authentication',
          },
        };

        const result = await messagingExtension.handleAction(mockContext, action);

        expect(result.composeExtension.type).toBe('result');
        expect(result.composeExtension.attachments.length).toBeGreaterThan(0);
      });

      it('should handle search tasks action without search text', async () => {
        const action = {
          commandId: 'searchTasks',
          data: {},
        };

        const result = await messagingExtension.handleAction(mockContext, action);

        expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 10 });
        expect(result.composeExtension.type).toBe('result');
      });
    });

    it('should handle unknown action', async () => {
      const action = {
        commandId: 'unknownAction',
        data: {},
      };

      const result = await messagingExtension.handleAction(mockContext, action);

      expect(result.task.type).toBe('message');
      expect(result.task.value).toBe('❌ Unknown action');
    });

    it('should handle action errors gracefully', async () => {
      mockOrchestrator.createTask.mockRejectedValueOnce(new Error('Creation failed'));

      const action = {
        commandId: 'createTask',
        data: {
          description: 'Task that will fail',
        },
      };

      const result = await messagingExtension.handleAction(mockContext, action);

      expect(result.task.type).toBe('message');
      expect(result.task.value).toBe('❌ Action failed: Creation failed');
    });

    it('should handle non-Error exceptions in actions', async () => {
      mockOrchestrator.createTask.mockRejectedValueOnce('String error');

      const action = {
        commandId: 'createTask',
        data: {
          description: 'Task that will fail',
        },
      };

      const result = await messagingExtension.handleAction(mockContext, action);

      expect(result.task.type).toBe('message');
      expect(result.task.value).toBe('❌ Action failed: Unknown error');
    });
  });

  describe('Card Action Handling', () => {
    describe('Status Actions', () => {
      it('should handle status action for specific task', async () => {
        const cardData = {
          action: 'status',
          taskId: 'task-123',
        };

        const result = await messagingExtension.handleCardAction(mockContext, cardData);

        expect(mockOrchestrator.getTask).toHaveBeenCalledWith('task-123');
        expect(result.task.type).toBe('message');
        expect(result.task.value).toBe('Task task-123 status: in-progress');
      });

      it('should handle status action without task ID (overall status)', async () => {
        // Mock listTasks to return different status types
        mockOrchestrator.listTasks.mockImplementation(({ status }) => {
          return Promise.resolve(mockTasks.filter(t => t.status === status));
        });

        const cardData = {
          action: 'status',
        };

        const result = await messagingExtension.handleCardAction(mockContext, cardData);

        expect(mockOrchestrator.listTasks).toHaveBeenCalledTimes(3);
        expect(result.task.type).toBe('continue');
        expect(result.task.value.title).toBe('APEX Status');
      });

      it('should handle status action for nonexistent task', async () => {
        const cardData = {
          action: 'status',
          taskId: 'nonexistent-task',
        };

        const result = await messagingExtension.handleCardAction(mockContext, cardData);

        expect(result.task.type).toBe('message');
        expect(result.task.value).toBe('❌ Task not found');
      });
    });

    describe('Cancel Actions', () => {
      it('should handle cancel action with valid task ID', async () => {
        const cardData = {
          action: 'cancel',
          taskId: 'task-123',
        };

        const result = await messagingExtension.handleCardAction(mockContext, cardData);

        expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('task-123');
        expect(result.task.type).toBe('message');
        expect(result.task.value).toBe('Task task-123 cancelled successfully');
      });

      it('should handle cancel action with missing task ID', async () => {
        const cardData = {
          action: 'cancel',
        };

        const result = await messagingExtension.handleCardAction(mockContext, cardData);

        expect(mockOrchestrator.cancelTask).not.toHaveBeenCalled();
        expect(result.task.type).toBe('message');
        expect(result.task.value).toBe('❌ Task ID required');
      });

      it('should handle cancel action failure', async () => {
        mockOrchestrator.cancelTask.mockResolvedValueOnce(false);

        const cardData = {
          action: 'cancel',
          taskId: 'task-123',
        };

        const result = await messagingExtension.handleCardAction(mockContext, cardData);

        expect(result.task.type).toBe('message');
        expect(result.task.value).toBe('❌ Unable to cancel task task-123');
      });
    });

    describe('Report Actions', () => {
      it('should handle report action with valid task ID', async () => {
        const cardData = {
          action: 'report',
          taskId: 'task-123',
        };

        const result = await messagingExtension.handleCardAction(mockContext, cardData);

        expect(mockOrchestrator.getTask).toHaveBeenCalledWith('task-123');
        expect(result.task.type).toBe('continue');
        expect(result.task.value.title).toBe('Task Report - task-123');
      });

      it('should handle report action with missing task ID', async () => {
        const cardData = {
          action: 'report',
        };

        const result = await messagingExtension.handleCardAction(mockContext, cardData);

        expect(result.task.type).toBe('message');
        expect(result.task.value).toBe('❌ Task ID required');
      });

      it('should handle report action for nonexistent task', async () => {
        const cardData = {
          action: 'report',
          taskId: 'nonexistent-task',
        };

        const result = await messagingExtension.handleCardAction(mockContext, cardData);

        expect(result.task.type).toBe('message');
        expect(result.task.value).toBe('❌ Task not found');
      });
    });

    it('should handle unknown card action', async () => {
      const cardData = {
        action: 'unknownAction',
        taskId: 'task-123',
      };

      const result = await messagingExtension.handleCardAction(mockContext, cardData);

      expect(result.task.type).toBe('message');
      expect(result.task.value).toBe('❌ Unknown card action');
    });

    it('should handle card action errors gracefully', async () => {
      mockOrchestrator.getTask.mockRejectedValueOnce(new Error('Database error'));

      const cardData = {
        action: 'status',
        taskId: 'task-123',
      };

      const result = await messagingExtension.handleCardAction(mockContext, cardData);

      expect(result.task.type).toBe('message');
      expect(result.task.value).toBe('❌ Card action failed: Database error');
    });

    it('should handle non-Error exceptions in card actions', async () => {
      mockOrchestrator.cancelTask.mockRejectedValueOnce('String error');

      const cardData = {
        action: 'cancel',
        taskId: 'task-123',
      };

      const result = await messagingExtension.handleCardAction(mockContext, cardData);

      expect(result.task.type).toBe('message');
      expect(result.task.value).toBe('❌ Card action failed: Unknown error');
    });
  });

  describe('Task Search Functionality', () => {
    it('should search by partial description match', async () => {
      const searchTasks = (messagingExtension as any).searchTasks;
      const results = await searchTasks.call(messagingExtension, 'auth');

      expect(results).toHaveLength(2); // Should match "authentication" tasks
      expect(results.map(t => t.id)).toContain('task-123');
      expect(results.map(t => t.id)).toContain('task-789');
    });

    it('should search by partial ID match', async () => {
      const searchTasks = (messagingExtension as any).searchTasks;
      const results = await searchTasks.call(messagingExtension, '456');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('task-456');
    });

    it('should return empty array for no matches', async () => {
      const searchTasks = (messagingExtension as any).searchTasks;
      const results = await searchTasks.call(messagingExtension, 'nonexistent');

      expect(results).toHaveLength(0);
    });

    it('should handle empty search text', async () => {
      const searchTasks = (messagingExtension as any).searchTasks;
      const results = await searchTasks.call(messagingExtension, '');

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 10 });
      expect(results).toHaveLength(mockTasks.length);
    });

    it('should handle whitespace-only search text', async () => {
      const searchTasks = (messagingExtension as any).searchTasks;
      const results = await searchTasks.call(messagingExtension, '   ');

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 10 });
    });
  });

  describe('Card Building Functions', () => {
    it('should build task form response correctly', async () => {
      const buildTaskFormResponse = (messagingExtension as any).buildTaskFormResponse;
      const result = buildTaskFormResponse.call(messagingExtension);

      expect(result.task.type).toBe('continue');
      expect(result.task.value.title).toBe('Create New Task');

      const card = result.task.value.card;
      expect(card.content.version).toBe('1.2');
      expect(card.content.body[1].type).toBe('Input.Text');
      expect(card.content.body[1].id).toBe('description');
      expect(card.content.body[1].maxLength).toBe(500);
      expect(card.content.actions[0].data).toEqual({ action: 'createTask' });
    });

    it('should build error response correctly', async () => {
      const buildErrorResponse = (messagingExtension as any).buildErrorResponse;
      const result = buildErrorResponse.call(messagingExtension, 'Test error message');

      expect(result.task.type).toBe('message');
      expect(result.task.value).toBe('❌ Test error message');
    });

    it('should build task detail card with all information', async () => {
      const buildTaskDetailCard = (messagingExtension as any).buildTaskDetailCard;
      const card = buildTaskDetailCard.call(messagingExtension, mockTasks[0]);

      expect(card.content.version).toBe('1.2');
      expect(card.content.body[0].text).toBe('Task Details - task-123');

      const factSet = card.content.body[1];
      expect(factSet.type).toBe('FactSet');
      expect(factSet.facts).toContainEqual({ title: 'Status', value: 'in-progress' });
      expect(factSet.facts).toContainEqual({ title: 'Priority', value: 'high' });
      expect(factSet.facts).toContainEqual({ title: 'Workflow', value: 'development' });
      expect(factSet.facts).toContainEqual({ title: 'Effort', value: 'large' });

      const actions = card.content.actions;
      expect(actions).toHaveLength(2);
      expect(actions[0].title).toBe('Refresh Status');
      expect(actions[1].title).toBe('Cancel Task');
      expect(actions[1].style).toBe('destructive');
    });

    it('should build status card with proper formatting', async () => {
      const activeTasks = [mockTasks[0]];
      const pendingTasks = [mockTasks[1]];
      const pausedTasks: any[] = [];

      const buildStatusCard = (messagingExtension as any).buildStatusCard;
      const card = buildStatusCard.call(messagingExtension, activeTasks, pendingTasks, pausedTasks);

      expect(card.content.body[0].text).toBe('APEX Task Status Overview');

      // Check for section headers
      const activeHeader = card.content.body.find((block: any) =>
        block.text === 'Active Tasks (1)'
      );
      expect(activeHeader).toBeDefined();
      expect(activeHeader.color).toBe('Good');

      const pendingHeader = card.content.body.find((block: any) =>
        block.text === 'Pending Tasks (1)'
      );
      expect(pendingHeader).toBeDefined();
      expect(pendingHeader.color).toBe('Warning');

      const pausedHeader = card.content.body.find((block: any) =>
        block.text === 'Paused Tasks (0)'
      );
      expect(pausedHeader).toBeDefined();
      expect(pausedHeader.color).toBe('Attention');
    });

    it('should handle tasks with missing dates in detail card', async () => {
      const taskWithoutDates = {
        ...mockTasks[0],
        createdAt: undefined,
        updatedAt: undefined,
      };

      const buildTaskDetailCard = (messagingExtension as any).buildTaskDetailCard;
      const card = buildTaskDetailCard.call(messagingExtension, taskWithoutDates);

      const factSet = card.content.body[1];
      const createdFact = factSet.facts.find((fact: any) => fact.title === 'Created');
      const updatedFact = factSet.facts.find((fact: any) => fact.title === 'Updated');

      expect(createdFact.value).toBe('N/A');
      expect(updatedFact.value).toBe('N/A');
    });
  });
});