/**
 * Teams Adaptive Cards Test Suite for @apexcli/api Package
 *
 * Comprehensive tests for Adaptive Card builders used in Teams integration
 * to ensure proper card structure, content, and interactive elements.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeamsService } from '../packages/api/src/services/teams-service.js';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock Bot Framework SDK
vi.mock('botbuilder', () => ({
  CloudAdapter: vi.fn(() => ({
    process: vi.fn(),
    onTurnError: null,
    continueConversationAsync: vi.fn(),
  })),
  ConfigurationBotFrameworkAuthentication: vi.fn(),
  ActivityHandler: vi.fn(),
  TurnContext: {
    getConversationReference: vi.fn(() => ({ conversation: { id: 'test-conv' } })),
  },
  MessageFactory: {
    text: vi.fn((text) => ({ type: 'message', text })),
    attachment: vi.fn((attachment) => ({ type: 'message', attachments: [attachment] })),
  },
  CardFactory: {
    adaptiveCard: vi.fn((card) => ({
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: card
    })),
  },
  ActivityTypes: { Message: 'message' },
  ActionTypes: { Submit: 'Action.Submit' },
}));

describe('Teams Adaptive Cards', () => {
  let teamsService: TeamsService;
  let mockOrchestrator: ApexOrchestrator;
  let mockLogger: any;

  // Sample task data for testing
  const mockTask = {
    id: 'task-123',
    description: 'Test task for card generation',
    status: 'in-progress',
    workflow: 'development',
    priority: 'high',
    effort: 'medium',
    createdAt: new Date('2026-03-15T10:00:00Z'),
    updatedAt: new Date('2026-03-15T11:00:00Z'),
  };

  const mockTasks = [
    { id: 'task-1', description: 'Active task 1', status: 'in-progress', priority: 'high', workflow: 'dev' },
    { id: 'task-2', description: 'Active task 2', status: 'in-progress', priority: 'normal', workflow: 'test' },
    { id: 'task-3', description: 'Pending task 1', status: 'pending', priority: 'low', workflow: 'docs' },
    { id: 'task-4', description: 'Paused task 1', status: 'paused', priority: 'high', workflow: 'review' },
  ];

  beforeEach(() => {
    mockOrchestrator = {
      createTask: vi.fn(),
      getTask: vi.fn(),
      getCurrentTask: vi.fn(),
      listTasks: vi.fn(),
      cancelTask: vi.fn(),
      captureThought: vi.fn(),
      on: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    teamsService = new TeamsService({
      orchestrator: mockOrchestrator,
      config: {
        enabled: true,
        appId: 'test-app-id',
        appPassword: 'test-password',
        useAdaptiveCards: true,
      },
      logger: mockLogger,
    });
  });

  describe('Task Created Card', () => {
    it('should build valid task created card structure', () => {
      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;
      const card = buildTaskCreatedCard.call(teamsService, mockTask, 'user-123');

      expect(card).toHaveProperty('contentType', 'application/vnd.microsoft.card.adaptive');
      expect(card.content).toHaveProperty('$schema');
      expect(card.content).toHaveProperty('type', 'AdaptiveCard');
      expect(card.content).toHaveProperty('version', '1.5');
      expect(card.content).toHaveProperty('body');
      expect(card.content).toHaveProperty('actions');
    });

    it('should include correct task information in created card', () => {
      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;
      const card = buildTaskCreatedCard.call(teamsService, mockTask, 'user-123');

      const body = card.content.body;
      const titleBlock = body.find((block: any) => block.text === 'Task Created');
      expect(titleBlock).toBeDefined();
      expect(titleBlock.color).toBe('Good');

      const factSet = body.find((block: any) => block.type === 'FactSet');
      expect(factSet).toBeDefined();
      expect(factSet.facts).toContainEqual({ title: 'ID', value: 'task-123' });
      expect(factSet.facts).toContainEqual({ title: 'Status', value: 'in-progress' });
      expect(factSet.facts).toContainEqual({ title: 'Workflow', value: 'development' });
      expect(factSet.facts).toContainEqual({ title: 'Priority', value: 'high' });

      const descriptionBlock = body.find((block: any) => block.text === mockTask.description);
      expect(descriptionBlock).toBeDefined();
      expect(descriptionBlock.wrap).toBe(true);
    });

    it('should include action buttons in created card', () => {
      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;
      const card = buildTaskCreatedCard.call(teamsService, mockTask, 'user-123');

      const actions = card.content.actions;
      expect(actions).toHaveLength(2);

      const statusAction = actions.find((action: any) => action.title === 'View Status');
      expect(statusAction).toBeDefined();
      expect(statusAction.type).toBe('Action.Submit');
      expect(statusAction.data).toEqual({ action: 'status', taskId: 'task-123' });

      const cancelAction = actions.find((action: any) => action.title === 'Cancel');
      expect(cancelAction).toBeDefined();
      expect(cancelAction.type).toBe('Action.Submit');
      expect(cancelAction.data).toEqual({ action: 'cancel', taskId: 'task-123' });
      expect(cancelAction.style).toBe('destructive');
    });

    it('should handle tasks with missing optional fields', () => {
      const minimalTask = {
        id: 'task-minimal',
        description: 'Minimal task',
        status: 'pending',
        workflow: 'default',
        priority: 'normal',
      };

      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;
      const card = buildTaskCreatedCard.call(teamsService, minimalTask, 'user-123');

      expect(card.content.body).toBeDefined();
      expect(card.content.actions).toHaveLength(2);
    });
  });

  describe('Task Update Card', () => {
    it('should build valid task update card structure', () => {
      const buildTaskUpdateCard = (teamsService as any).buildTaskUpdateCard;
      const card = buildTaskUpdateCard.call(teamsService, mockTask, 'Task completed successfully');

      expect(card).toHaveProperty('contentType', 'application/vnd.microsoft.card.adaptive');
      expect(card.content).toHaveProperty('$schema');
      expect(card.content).toHaveProperty('type', 'AdaptiveCard');
      expect(card.content).toHaveProperty('version', '1.5');
      expect(card.content).toHaveProperty('body');
    });

    it('should include task update message', () => {
      const buildTaskUpdateCard = (teamsService as any).buildTaskUpdateCard;
      const message = 'Task stage changed to implementation';
      const card = buildTaskUpdateCard.call(teamsService, mockTask, message);

      const body = card.content.body;
      expect(body).toHaveLength(1);
      expect(body[0].text).toBe(`**${mockTask.id}** — ${message}`);
      expect(body[0].wrap).toBe(true);
    });

    it('should handle long update messages', () => {
      const buildTaskUpdateCard = (teamsService as any).buildTaskUpdateCard;
      const longMessage = 'This is a very long update message that contains detailed information about the task progress and should wrap properly in the card display'.repeat(3);
      const card = buildTaskUpdateCard.call(teamsService, mockTask, longMessage);

      expect(card.content.body[0].text).toContain(longMessage);
      expect(card.content.body[0].wrap).toBe(true);
    });

    it('should handle special characters in update message', () => {
      const buildTaskUpdateCard = (teamsService as any).buildTaskUpdateCard;
      const messageWithSpecialChars = 'Task failed: Error "Connection timeout" at line #42';
      const card = buildTaskUpdateCard.call(teamsService, mockTask, messageWithSpecialChars);

      expect(card.content.body[0].text).toContain(messageWithSpecialChars);
    });
  });

  describe('Thought Card', () => {
    it('should build valid thought card structure', () => {
      const buildThoughtCard = (teamsService as any).buildThoughtCard;
      const card = buildThoughtCard.call(teamsService, 'thought-456', 'Great idea about feature X', 'user-123');

      expect(card).toHaveProperty('contentType', 'application/vnd.microsoft.card.adaptive');
      expect(card.content).toHaveProperty('$schema');
      expect(card.content).toHaveProperty('type', 'AdaptiveCard');
      expect(card.content).toHaveProperty('version', '1.5');
      expect(card.content).toHaveProperty('body');
    });

    it('should include thought information', () => {
      const buildThoughtCard = (teamsService as any).buildThoughtCard;
      const thoughtId = 'thought-789';
      const thoughtContent = 'We should implement feature Y next quarter';
      const requestedBy = 'user-456';
      const card = buildThoughtCard.call(teamsService, thoughtId, thoughtContent, requestedBy);

      const body = card.content.body;
      const titleBlock = body.find((block: any) => block.text === 'Thought Captured');
      expect(titleBlock).toBeDefined();
      expect(titleBlock.color).toBe('Good');

      const factSet = body.find((block: any) => block.type === 'FactSet');
      expect(factSet).toBeDefined();
      expect(factSet.facts).toContainEqual({ title: 'ID', value: thoughtId });
      expect(factSet.facts).toContainEqual({ title: 'Requested by', value: requestedBy });

      const contentBlock = body.find((block: any) => block.text === thoughtContent);
      expect(contentBlock).toBeDefined();
      expect(contentBlock.wrap).toBe(true);
    });

    it('should handle long thought content', () => {
      const buildThoughtCard = (teamsService as any).buildThoughtCard;
      const longThought = 'This is a very detailed thought about the architecture of our system and how we could improve performance by implementing caching strategies and optimizing database queries while maintaining code readability and maintainability for future developers who will work on this codebase';
      const card = buildThoughtCard.call(teamsService, 'thought-long', longThought, 'user-123');

      const contentBlock = card.content.body.find((block: any) => block.text === longThought);
      expect(contentBlock).toBeDefined();
      expect(contentBlock.wrap).toBe(true);
    });
  });

  describe('Status Card', () => {
    it('should build valid status card structure', () => {
      const activeTasks = mockTasks.filter(t => t.status === 'in-progress');
      const pendingTasks = mockTasks.filter(t => t.status === 'pending');
      const pausedTasks = mockTasks.filter(t => t.status === 'paused');

      const buildStatusCard = (teamsService as any).buildStatusCard;
      const card = buildStatusCard.call(teamsService, activeTasks, pendingTasks, pausedTasks);

      expect(card).toHaveProperty('contentType', 'application/vnd.microsoft.card.adaptive');
      expect(card.content).toHaveProperty('$schema');
      expect(card.content).toHaveProperty('type', 'AdaptiveCard');
      expect(card.content).toHaveProperty('version', '1.5');
      expect(card.content).toHaveProperty('body');
    });

    it('should include task counts and lists', () => {
      const activeTasks = mockTasks.filter(t => t.status === 'in-progress');
      const pendingTasks = mockTasks.filter(t => t.status === 'pending');
      const pausedTasks = mockTasks.filter(t => t.status === 'paused');

      const buildStatusCard = (teamsService as any).buildStatusCard;
      const card = buildStatusCard.call(teamsService, activeTasks, pendingTasks, pausedTasks);

      const body = card.content.body;

      // Check title
      const titleBlock = body.find((block: any) => block.text === 'APEX Task Status');
      expect(titleBlock).toBeDefined();

      // Check section headers
      const activeHeader = body.find((block: any) => block.text?.includes('In Progress (2)'));
      expect(activeHeader).toBeDefined();
      expect(activeHeader.color).toBe('Good');

      const pendingHeader = body.find((block: any) => block.text?.includes('Pending (1)'));
      expect(pendingHeader).toBeDefined();
      expect(pendingHeader.color).toBe('Warning');

      const pausedHeader = body.find((block: any) => block.text?.includes('Paused (1)'));
      expect(pausedHeader).toBeDefined();
      expect(pausedHeader.color).toBe('Attention');

      // Check task items
      const activeTask1 = body.find((block: any) => block.text?.includes('task-1'));
      expect(activeTask1).toBeDefined();
    });

    it('should handle empty task lists', () => {
      const buildStatusCard = (teamsService as any).buildStatusCard;
      const card = buildStatusCard.call(teamsService, [], [], []);

      const body = card.content.body;

      // Should still show headers with (0) counts
      const activeHeader = body.find((block: any) => block.text?.includes('In Progress (0)'));
      expect(activeHeader).toBeDefined();

      const pendingHeader = body.find((block: any) => block.text?.includes('Pending (0)'));
      expect(pendingHeader).toBeDefined();

      const pausedHeader = body.find((block: any) => block.text?.includes('Paused (0)'));
      expect(pausedHeader).toBeDefined();
    });

    it('should format task items correctly', () => {
      const activeTasks = [
        { id: 'task-long', description: 'This is a very long task description that should wrap properly', status: 'in-progress' }
      ];

      const buildStatusCard = (teamsService as any).buildStatusCard;
      const card = buildStatusCard.call(teamsService, activeTasks, [], []);

      const taskItem = card.content.body.find((block: any) =>
        block.text?.includes('task-long') && block.text?.includes('very long task description')
      );
      expect(taskItem).toBeDefined();
      expect(taskItem.wrap).toBe(true);
    });
  });

  describe('Task Report Card', () => {
    it('should build valid task report card structure', () => {
      const buildTaskReportCard = (teamsService as any).buildTaskReportCard;
      const card = buildTaskReportCard.call(teamsService, mockTask);

      expect(card).toHaveProperty('contentType', 'application/vnd.microsoft.card.adaptive');
      expect(card.content).toHaveProperty('$schema');
      expect(card.content).toHaveProperty('type', 'AdaptiveCard');
      expect(card.content).toHaveProperty('version', '1.5');
      expect(card.content).toHaveProperty('body');
    });

    it('should include comprehensive task details', () => {
      const buildTaskReportCard = (teamsService as any).buildTaskReportCard;
      const card = buildTaskReportCard.call(teamsService, mockTask);

      const body = card.content.body;

      // Check title
      const titleBlock = body.find((block: any) => block.text === 'Task Report');
      expect(titleBlock).toBeDefined();

      // Check fact set
      const factSet = body.find((block: any) => block.type === 'FactSet');
      expect(factSet).toBeDefined();
      expect(factSet.facts).toContainEqual({ title: 'ID', value: 'task-123' });
      expect(factSet.facts).toContainEqual({ title: 'Status', value: 'in-progress' });
      expect(factSet.facts).toContainEqual({ title: 'Workflow', value: 'development' });
      expect(factSet.facts).toContainEqual({ title: 'Priority', value: 'high' });
      expect(factSet.facts).toContainEqual({ title: 'Effort', value: 'medium' });

      // Check dates
      const updatedFact = factSet.facts.find((fact: any) => fact.title === 'Updated');
      expect(updatedFact).toBeDefined();
      expect(updatedFact.value).toBe('2026-03-15T11:00:00.000Z');

      // Check description
      const descriptionBlock = body.find((block: any) => block.text === mockTask.description);
      expect(descriptionBlock).toBeDefined();
    });

    it('should handle tasks with missing dates', () => {
      const taskWithoutDates = {
        ...mockTask,
        createdAt: undefined,
        updatedAt: undefined,
      };

      const buildTaskReportCard = (teamsService as any).buildTaskReportCard;
      const card = buildTaskReportCard.call(teamsService, taskWithoutDates);

      const factSet = card.content.body.find((block: any) => block.type === 'FactSet');
      const updatedFact = factSet.facts.find((fact: any) => fact.title === 'Updated');
      expect(updatedFact.value).toBe('N/A');
    });

    it('should handle tasks with missing optional fields', () => {
      const minimalTask = {
        id: 'task-minimal',
        description: 'Minimal task description',
        status: 'pending',
        workflow: 'default',
        priority: 'normal',
      };

      const buildTaskReportCard = (teamsService as any).buildTaskReportCard;
      const card = buildTaskReportCard.call(teamsService, minimalTask);

      expect(card.content.body).toBeDefined();

      const factSet = card.content.body.find((block: any) => block.type === 'FactSet');
      expect(factSet.facts).toContainEqual({ title: 'ID', value: 'task-minimal' });
    });
  });

  describe('Card Validation and Standards', () => {
    it('should use consistent Adaptive Card schema version', () => {
      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;
      const buildStatusCard = (teamsService as any).buildStatusCard;
      const buildThoughtCard = (teamsService as any).buildThoughtCard;
      const buildTaskReportCard = (teamsService as any).buildTaskReportCard;
      const buildTaskUpdateCard = (teamsService as any).buildTaskUpdateCard;

      const cards = [
        buildTaskCreatedCard.call(teamsService, mockTask, 'user-123'),
        buildStatusCard.call(teamsService, [], [], []),
        buildThoughtCard.call(teamsService, 'thought-1', 'content', 'user-123'),
        buildTaskReportCard.call(teamsService, mockTask),
        buildTaskUpdateCard.call(teamsService, mockTask, 'update'),
      ];

      cards.forEach(card => {
        expect(card.content.$schema).toBe('http://adaptivecards.io/schemas/adaptive-card.json');
        expect(card.content.type).toBe('AdaptiveCard');
        expect(card.content.version).toBe('1.5');
      });
    });

    it('should use appropriate color coding', () => {
      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;
      const buildThoughtCard = (teamsService as any).buildThoughtCard;
      const buildStatusCard = (teamsService as any).buildStatusCard;

      // Task created should use Good color
      const createdCard = buildTaskCreatedCard.call(teamsService, mockTask, 'user-123');
      const createdTitle = createdCard.content.body.find((block: any) => block.text === 'Task Created');
      expect(createdTitle.color).toBe('Good');

      // Thought captured should use Good color
      const thoughtCard = buildThoughtCard.call(teamsService, 'thought-1', 'content', 'user-123');
      const thoughtTitle = thoughtCard.content.body.find((block: any) => block.text === 'Thought Captured');
      expect(thoughtTitle.color).toBe('Good');

      // Status card should use appropriate colors
      const statusCard = buildStatusCard.call(teamsService, mockTasks, mockTasks, mockTasks);
      const body = statusCard.content.body;

      const activeHeader = body.find((block: any) => block.text?.includes('In Progress'));
      expect(activeHeader.color).toBe('Good');

      const pendingHeader = body.find((block: any) => block.text?.includes('Pending'));
      expect(pendingHeader.color).toBe('Warning');

      const pausedHeader = body.find((block: any) => block.text?.includes('Paused'));
      expect(pausedHeader.color).toBe('Attention');
    });

    it('should include wrap property for text blocks with content', () => {
      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;
      const card = buildTaskCreatedCard.call(teamsService, mockTask, 'user-123');

      const descriptionBlock = card.content.body.find((block: any) =>
        block.text === mockTask.description
      );
      expect(descriptionBlock.wrap).toBe(true);
    });

    it('should use consistent action button structure', () => {
      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;
      const card = buildTaskCreatedCard.call(teamsService, mockTask, 'user-123');

      const actions = card.content.actions;
      actions.forEach((action: any) => {
        expect(action.type).toBe('Action.Submit');
        expect(action).toHaveProperty('title');
        expect(action).toHaveProperty('data');
        expect(action.data).toHaveProperty('action');
      });
    });

    it('should handle special characters in card content', () => {
      const taskWithSpecialChars = {
        ...mockTask,
        description: 'Task with "quotes", <tags>, & special chars: émojis 🚀',
      };

      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;
      const card = buildTaskCreatedCard.call(teamsService, taskWithSpecialChars, 'user-123');

      const descriptionBlock = card.content.body.find((block: any) =>
        block.text === taskWithSpecialChars.description
      );
      expect(descriptionBlock).toBeDefined();
    });
  });
});