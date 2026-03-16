import { TurnContext, CardFactory, ActivityTypes } from 'botbuilder';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import type { Task } from '@apexcli/core';

/**
 * Interface for handling Teams messaging extension operations.
 *
 * @interface MessagingExtensionHandler
 */
export interface MessagingExtensionHandler {
  /** Handle search/query operations */
  handleQuery(context: TurnContext, query: any): Promise<any>;
  /** Handle action-based operations */
  handleAction(context: TurnContext, action: any): Promise<any>;
  /** Handle card button actions */
  handleCardAction(context: TurnContext, cardData: any): Promise<any>;
}

/**
 * Teams Messaging Extension implementation for APEX task management.
 *
 * Provides search functionality for tasks and quick actions for task operations
 * through Teams' messaging extension interface.
 *
 * @class TeamsMessagingExtension
 *
 * @example
 * ```typescript
 * const messagingExtension = new TeamsMessagingExtension(orchestrator);
 * await messagingExtension.handleQuery(context, query);
 * ```
 */
export class TeamsMessagingExtension implements MessagingExtensionHandler {
  constructor(private orchestrator: ApexOrchestrator) {}

  /**
   * Handles search queries from Teams messaging extension.
   *
   * Searches for tasks matching the query text and returns them as
   * preview cards that can be inserted into conversations.
   *
   * @param context - Teams turn context
   * @param query - Search query parameters
   * @returns Search results formatted for Teams
   */
  async handleQuery(context: TurnContext, query: any): Promise<any> {
    const searchText = query.parameters?.[0]?.value || '';

    try {
      // Search for tasks matching the query
      const tasks = await this.searchTasks(searchText);

      // Convert tasks to preview cards
      const attachments = tasks.map(task => this.buildTaskPreviewCard(task));

      return {
        composeExtension: {
          type: 'result',
          attachmentLayout: 'list',
          attachments,
        },
      };
    } catch (error) {
      // Return empty results on error
      return {
        composeExtension: {
          type: 'result',
          attachmentLayout: 'list',
          attachments: [],
        },
      };
    }
  }

  /**
   * Handles action-based operations from messaging extension.
   *
   * Processes commands like creating new tasks or viewing task details
   * through the messaging extension interface.
   *
   * @param context - Teams turn context
   * @param action - Action data from messaging extension
   * @returns Action response
   */
  async handleAction(context: TurnContext, action: any): Promise<any> {
    try {
      switch (action.commandId) {
        case 'createTask':
          return await this.handleCreateTaskAction(context, action.data);
        case 'viewTask':
          return await this.handleViewTaskAction(context, action.data);
        case 'searchTasks':
          return await this.handleSearchTasksAction(context, action.data);
        default:
          return this.buildErrorResponse('Unknown action');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.buildErrorResponse(`Action failed: ${message}`);
    }
  }

  /**
   * Handles card button actions from adaptive cards.
   *
   * Processes actions like viewing status or canceling tasks from
   * interactive buttons on adaptive cards.
   *
   * @param context - Teams turn context
   * @param cardData - Data from card action
   * @returns Action response
   */
  async handleCardAction(context: TurnContext, cardData: any): Promise<any> {
    try {
      switch (cardData.action) {
        case 'status':
          return await this.handleStatusAction(context, cardData.taskId);
        case 'cancel':
          return await this.handleCancelAction(context, cardData.taskId);
        case 'report':
          return await this.handleReportAction(context, cardData.taskId);
        default:
          return this.buildErrorResponse('Unknown card action');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.buildErrorResponse(`Card action failed: ${message}`);
    }
  }

  /**
   * Searches for tasks matching the given query.
   *
   * @private
   * @param searchText - Text to search for
   * @returns Array of matching tasks
   */
  private async searchTasks(searchText: string): Promise<Task[]> {
    if (!searchText.trim()) {
      // Return recent tasks if no search text
      return await this.orchestrator.listTasks({ limit: 10 });
    }

    // Search tasks by description or ID
    const allTasks = await this.orchestrator.listTasks({ limit: 50 });
    return allTasks.filter(task =>
      task.id.toLowerCase().includes(searchText.toLowerCase()) ||
      task.description.toLowerCase().includes(searchText.toLowerCase())
    );
  }

  /**
   * Handles create task action from messaging extension.
   *
   * @private
   */
  private async handleCreateTaskAction(context: TurnContext, data: any): Promise<any> {
    const description = data?.description?.trim();
    if (!description) {
      return this.buildTaskFormResponse();
    }

    const task = await this.orchestrator.createTask({ description });

    return {
      task: {
        type: 'continue',
        value: {
          card: this.buildTaskCreatedCard(task),
          title: 'Task Created',
        },
      },
    };
  }

  /**
   * Handles view task action from messaging extension.
   *
   * @private
   */
  private async handleViewTaskAction(context: TurnContext, data: any): Promise<any> {
    const taskId = data?.taskId;
    if (!taskId) {
      return this.buildErrorResponse('Task ID required');
    }

    const task = await this.orchestrator.getTask(taskId);
    if (!task) {
      return this.buildErrorResponse('Task not found');
    }

    return {
      task: {
        type: 'continue',
        value: {
          card: this.buildTaskDetailCard(task),
          title: `Task ${task.id}`,
        },
      },
    };
  }

  /**
   * Handles search tasks action from messaging extension.
   *
   * @private
   */
  private async handleSearchTasksAction(context: TurnContext, data: any): Promise<any> {
    const searchText = data?.searchText || '';
    const tasks = await this.searchTasks(searchText);

    const attachments = tasks.map(task => this.buildTaskPreviewCard(task));

    return {
      composeExtension: {
        type: 'result',
        attachmentLayout: 'list',
        attachments,
      },
    };
  }

  /**
   * Handles status action from card buttons.
   *
   * @private
   */
  private async handleStatusAction(context: TurnContext, taskId?: string): Promise<any> {
    if (taskId) {
      const task = await this.orchestrator.getTask(taskId);
      if (!task) {
        return this.buildErrorResponse('Task not found');
      }

      return {
        task: {
          type: 'message',
          value: `Task ${task.id} status: ${task.status}`,
        },
      };
    }

    // Get overall status
    const [active, pending, paused] = await Promise.all([
      this.orchestrator.listTasks({ status: 'in-progress', limit: 5 }),
      this.orchestrator.listTasks({ status: 'pending', limit: 5 }),
      this.orchestrator.listTasks({ status: 'paused', limit: 5 }),
    ]);

    return {
      task: {
        type: 'continue',
        value: {
          card: this.buildStatusCard(active, pending, paused),
          title: 'APEX Status',
        },
      },
    };
  }

  /**
   * Handles cancel action from card buttons.
   *
   * @private
   */
  private async handleCancelAction(context: TurnContext, taskId: string): Promise<any> {
    if (!taskId) {
      return this.buildErrorResponse('Task ID required');
    }

    const cancelled = await this.orchestrator.cancelTask(taskId);
    if (!cancelled) {
      return this.buildErrorResponse(`Unable to cancel task ${taskId}`);
    }

    return {
      task: {
        type: 'message',
        value: `Task ${taskId} cancelled successfully`,
      },
    };
  }

  /**
   * Handles report action from card buttons.
   *
   * @private
   */
  private async handleReportAction(context: TurnContext, taskId: string): Promise<any> {
    if (!taskId) {
      return this.buildErrorResponse('Task ID required');
    }

    const task = await this.orchestrator.getTask(taskId);
    if (!task) {
      return this.buildErrorResponse('Task not found');
    }

    return {
      task: {
        type: 'continue',
        value: {
          card: this.buildTaskDetailCard(task),
          title: `Task Report - ${task.id}`,
        },
      },
    };
  }

  /**
   * Builds a task preview card for search results.
   *
   * @private
   */
  private buildTaskPreviewCard(task: Task): any {
    return CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.2',
      body: [
        {
          type: 'TextBlock',
          text: `**${task.id}**`,
          weight: 'Bolder',
          size: 'Medium',
        },
        {
          type: 'TextBlock',
          text: task.description,
          wrap: true,
          maxLines: 3,
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Status', value: task.status },
            { title: 'Priority', value: task.priority },
            { title: 'Workflow', value: task.workflow },
          ],
        },
      ],
      actions: [
        {
          type: 'Action.Submit',
          title: 'View Details',
          data: { action: 'report', taskId: task.id },
        },
      ],
    });
  }

  /**
   * Builds a task created confirmation card.
   *
   * @private
   */
  private buildTaskCreatedCard(task: Task): any {
    return CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.2',
      body: [
        {
          type: 'TextBlock',
          size: 'Large',
          weight: 'Bolder',
          text: 'Task Created Successfully',
          color: 'Good',
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'ID', value: task.id },
            { title: 'Status', value: task.status },
            { title: 'Priority', value: task.priority },
            { title: 'Workflow', value: task.workflow },
          ],
        },
        {
          type: 'TextBlock',
          text: task.description,
          wrap: true,
        },
      ],
      actions: [
        {
          type: 'Action.Submit',
          title: 'View Status',
          data: { action: 'status', taskId: task.id },
        },
        {
          type: 'Action.Submit',
          title: 'Cancel Task',
          data: { action: 'cancel', taskId: task.id },
          style: 'destructive',
        },
      ],
    });
  }

  /**
   * Builds a detailed task information card.
   *
   * @private
   */
  private buildTaskDetailCard(task: Task): any {
    return CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.2',
      body: [
        {
          type: 'TextBlock',
          size: 'Large',
          weight: 'Bolder',
          text: `Task Details - ${task.id}`,
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Status', value: task.status },
            { title: 'Priority', value: task.priority },
            { title: 'Workflow', value: task.workflow },
            { title: 'Effort', value: task.effort },
            { title: 'Created', value: task.createdAt?.toISOString() || 'N/A' },
            { title: 'Updated', value: task.updatedAt?.toISOString() || 'N/A' },
          ],
        },
        {
          type: 'TextBlock',
          text: '**Description:**',
          weight: 'Bolder',
        },
        {
          type: 'TextBlock',
          text: task.description,
          wrap: true,
        },
      ],
      actions: [
        {
          type: 'Action.Submit',
          title: 'Refresh Status',
          data: { action: 'status', taskId: task.id },
        },
        {
          type: 'Action.Submit',
          title: 'Cancel Task',
          data: { action: 'cancel', taskId: task.id },
          style: 'destructive',
        },
      ],
    });
  }

  /**
   * Builds a status overview card.
   *
   * @private
   */
  private buildStatusCard(active: Task[], pending: Task[], paused: Task[]): any {
    const formatTasks = (tasks: Task[]) =>
      tasks.length === 0
        ? [{ type: 'TextBlock', text: '_None_', isSubtle: true }]
        : tasks.map(task => ({
            type: 'TextBlock',
            text: `• **${task.id}** — ${task.description}`,
            wrap: true,
          }));

    return CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.2',
      body: [
        {
          type: 'TextBlock',
          size: 'Large',
          weight: 'Bolder',
          text: 'APEX Task Status Overview',
        },
        {
          type: 'TextBlock',
          weight: 'Bolder',
          text: `Active Tasks (${active.length})`,
          color: 'Good',
          spacing: 'Medium',
        },
        ...formatTasks(active),
        {
          type: 'TextBlock',
          weight: 'Bolder',
          text: `Pending Tasks (${pending.length})`,
          color: 'Warning',
          spacing: 'Medium',
        },
        ...formatTasks(pending),
        {
          type: 'TextBlock',
          weight: 'Bolder',
          text: `Paused Tasks (${paused.length})`,
          color: 'Attention',
          spacing: 'Medium',
        },
        ...formatTasks(paused),
      ],
    });
  }

  /**
   * Builds a task creation form response.
   *
   * @private
   */
  private buildTaskFormResponse(): any {
    return {
      task: {
        type: 'continue',
        value: {
          card: CardFactory.adaptiveCard({
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.2',
            body: [
              {
                type: 'TextBlock',
                size: 'Medium',
                weight: 'Bolder',
                text: 'Create New Task',
              },
              {
                type: 'Input.Text',
                id: 'description',
                label: 'Task Description',
                placeholder: 'Enter task description...',
                isMultiline: true,
                maxLength: 500,
              },
            ],
            actions: [
              {
                type: 'Action.Submit',
                title: 'Create Task',
                data: { action: 'createTask' },
              },
            ],
          }),
          title: 'Create New Task',
        },
      },
    };
  }

  /**
   * Builds an error response.
   *
   * @private
   */
  private buildErrorResponse(message: string): any {
    return {
      task: {
        type: 'message',
        value: `❌ ${message}`,
      },
    };
  }
}