import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  ActivityTypes,
  TeamsInfo,
  MessageFactory,
  CardFactory,
  Activity,
  ConversationReference,
  ActivityHandler,
  ActionTypes,
} from 'botbuilder';
import type { TeamsIntegrationConfig, Task } from '@apexcli/core';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

/**
 * Context information for a Teams command invocation.
 *
 * @interface TeamsCommandContext
 */
export interface TeamsCommandContext {
  /** Conversation ID where command was invoked */
  conversationId: string;
  /** User who invoked the command */
  userId: string;
  /** User's display name */
  userName?: string;
  /** Team ID (if in a team) */
  teamId?: string;
  /** Channel ID (if in a channel) */
  channelId?: string;
  /** The command text */
  text: string;
  /** Activity ID for threading */
  activityId?: string;
  /** Service URL for sending responses */
  serviceUrl: string;
}

/**
 * Result of parsing a Teams command text string.
 *
 * @interface TeamsCommandParseResult
 */
export interface TeamsCommandParseResult {
  /** The command name (e.g., 'run', 'status') */
  command: string;
  /** Arguments provided with the command */
  args: string;
  /** Mentioned users (for assignment) */
  mentions?: string[];
}

/**
 * Configuration options for initializing the TeamsService.
 *
 * @interface TeamsServiceOptions
 */
export interface TeamsServiceOptions {
  /** APEX orchestrator instance */
  orchestrator: ApexOrchestrator;
  /** Teams configuration (optional, resolved from env) */
  config?: TeamsIntegrationConfig;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Logger interface */
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/**
 * Reference to a Teams conversation for storing task threads.
 *
 * @interface TeamsConversationReference
 */
export interface TeamsConversationReference {
  /** Service URL */
  serviceUrl: string;
  /** Conversation reference */
  conversationReference: ConversationReference;
  /** Activity ID for threading */
  activityId?: string;
}

/**
 * Parses Teams command text to extract command, arguments, and mentions.
 *
 * @param text - The raw command text from Teams
 * @returns Parsed command information
 *
 * @example
 * ```typescript
 * const result = parseTeamsCommandText('<at>APEX</at> run "Create a new feature"');
 * // Returns: { command: 'run', args: 'Create a new feature' }
 * ```
 */
export function parseTeamsCommandText(text: string): TeamsCommandParseResult {
  // Remove @mention of the bot from the beginning
  const cleaned = text.replace(/^<at>.*?<\/at>\s*/i, '').trim();

  if (!cleaned) {
    return { command: 'help', args: '' };
  }

  // Extract mentions for task assignment
  const mentionMatches = cleaned.matchAll(/<at>([^<]+)<\/at>/g);
  const mentions = Array.from(mentionMatches, m => m[1]);

  // Remove remaining mentions and parse command
  const withoutMentions = cleaned.replace(/<at>.*?<\/at>/g, '').trim();
  const [command, ...rest] = withoutMentions.split(/\s+/);

  return {
    command: command.toLowerCase(),
    args: rest.join(' ').trim(),
    mentions: mentions.length > 0 ? mentions : undefined,
  };
}

/**
 * Service for integrating APEX with Microsoft Teams using Bot Framework.
 *
 * Handles bot commands, task notifications, and messaging extensions
 * through Teams' Bot Framework SDK. Supports threaded conversations,
 * Adaptive Cards, and OAuth/SSO authentication.
 *
 * @class TeamsService
 *
 * @example
 * ```typescript
 * const teamsService = new TeamsService({
 *   orchestrator,
 *   config: {
 *     enabled: true,
 *     appId: 'your-app-id',
 *     appPassword: 'your-app-password'
 *   }
 * });
 *
 * await teamsService.start();
 * ```
 */
export class TeamsService extends ActivityHandler {
  private orchestrator: ApexOrchestrator;
  private config: TeamsIntegrationConfig;
  private env: NodeJS.ProcessEnv;
  private logger;
  private adapter?: CloudAdapter;
  private taskConversations = new Map<string, TeamsConversationReference>();

  constructor(options: TeamsServiceOptions) {
    super();
    this.orchestrator = options.orchestrator;
    this.env = options.env ?? process.env;
    this.logger = options.logger ?? console;
    this.config = this.resolveConfig(options.config);

    this.setupActivityHandlers();
  }

  /**
   * Checks if the Teams integration is properly configured and enabled.
   *
   * @returns True if Teams is enabled and has required configuration
   */
  isEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.appId && this.config.appPassword);
  }

  /**
   * Starts the Teams Bot Framework adapter and registers event handlers.
   *
   * Initializes CloudAdapter with Bot Framework authentication and
   * registers orchestrator event handlers for task status updates.
   *
   * @throws {Error} If Teams adapter fails to initialize
   */
  async start(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.info('Teams integration disabled or missing credentials.');
      return;
    }

    this.logger.info('Starting Teams Bot Framework integration...');

    // Initialize Bot Framework authentication
    const auth = new ConfigurationBotFrameworkAuthentication(
      process.env,
      {
        MicrosoftAppId: this.config.appId,
        MicrosoftAppPassword: this.config.appPassword,
        MicrosoftAppTenantId: this.config.tenantId,
      } as any,
    );

    // Create CloudAdapter with authentication
    this.adapter = new CloudAdapter(auth);

    // Set up error handling
    this.adapter.onTurnError = async (context, error) => {
      this.logger.error(`Teams bot error: ${error.message}`);

      // Send error message to user
      const errorText = 'Sorry, an error occurred. Please try again later.';
      await context.sendActivity(MessageFactory.text(errorText));
    };

    this.registerOrchestratorEvents();
    this.logger.info('Teams Bot Framework integration started.');
  }

  /**
   * Stops the Teams integration and cleans up resources.
   */
  async stop(): Promise<void> {
    this.adapter = undefined;
    this.logger.info('Teams integration stopped.');
  }

  /**
   * Gets the Bot Framework adapter for HTTP endpoint registration.
   *
   * @returns CloudAdapter instance if initialized, undefined otherwise
   */
  getAdapter(): CloudAdapter | undefined {
    return this.adapter;
  }

  /**
   * Processes incoming Bot Framework activities.
   *
   * This method is called by the HTTP endpoint to handle incoming messages,
   * commands, and other activities from Teams.
   *
   * @param req - HTTP request object
   * @param res - HTTP response object
   */
  async processActivity(req: any, res: any): Promise<void> {
    if (!this.adapter) {
      res.status(503).send({ error: 'Teams adapter not initialized' });
      return;
    }

    await this.adapter.process(req, res, (context) => this.run(context));
  }

  private setupActivityHandlers(): void {
    // Handle regular messages (commands)
    this.onMessage(async (context, next) => {
      await this.handleMessage(context);
      await next();
    });

    // Handle member additions (welcome message)
    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (let cnt = 0; cnt < membersAdded!.length; ++cnt) {
        if (membersAdded![cnt].id !== context.activity.recipient.id) {
          const welcomeText = 'Welcome to APEX! Type `help` to see available commands.';
          await context.sendActivity(MessageFactory.text(welcomeText));
        }
      }
      await next();
    });
  }

  /**
   * Override onInvokeActivity to handle messaging extension queries.
   * This is a method override, not a listener registration like onMessage().
   */
  protected async onInvokeActivity(context: TurnContext): Promise<any> {
    if (context.activity.name === 'composeExtension/query') {
      await this.handleMessagingExtensionQuery(context);
    } else if (context.activity.name === 'composeExtension/submitAction') {
      await this.handleMessagingExtensionAction(context);
    } else if (context.activity.name === 'task/submit') {
      await this.handleTaskSubmit(context);
    }
    return super.onInvokeActivity(context);
  }

  private resolveConfig(config?: TeamsIntegrationConfig): TeamsIntegrationConfig {
    const env = this.env;
    const enabled = config?.enabled ?? Boolean(env.TEAMS_APP_ID && env.TEAMS_APP_PASSWORD);

    return {
      enabled,
      appId: config?.appId ?? env.TEAMS_APP_ID,
      appPassword: config?.appPassword ?? env.TEAMS_APP_PASSWORD,
      tenantId: config?.tenantId ?? env.TEAMS_TENANT_ID ?? 'common',
      oauthConnectionName: config?.oauthConnectionName ?? env.TEAMS_OAUTH_CONNECTION_NAME,
      defaultTeamId: config?.defaultTeamId ?? env.TEAMS_DEFAULT_TEAM_ID,
      defaultChannelId: config?.defaultChannelId ?? env.TEAMS_DEFAULT_CHANNEL_ID,
      useAdaptiveCards: config?.useAdaptiveCards ?? true,
      threadUpdates: config?.threadUpdates ?? true,
      serviceUrl: config?.serviceUrl ?? env.TEAMS_SERVICE_URL,
    };
  }

  private async handleMessage(context: TurnContext): Promise<void> {
    const text = context.activity.text?.trim() || '';
    const parsed = parseTeamsCommandText(text);

    const commandContext: TeamsCommandContext = {
      conversationId: context.activity.conversation.id,
      userId: context.activity.from.id,
      userName: context.activity.from.name,
      teamId: context.activity.channelData?.team?.id,
      channelId: context.activity.channelData?.channel?.id,
      text: text,
      activityId: context.activity.id,
      serviceUrl: context.activity.serviceUrl,
    };

    try {
      switch (parsed.command) {
        case 'run':
          await this.handleRunCommand(context, commandContext, parsed.args);
          return;
        case 'think':
          await this.handleThinkCommand(context, commandContext, parsed.args);
          return;
        case 'status':
          await this.handleStatusCommand(context, commandContext);
          return;
        case 'report':
          await this.handleReportCommand(context, commandContext, parsed.args);
          return;
        case 'cancel':
          await this.handleCancelCommand(context, commandContext, parsed.args);
          return;
        default:
          await this.handleHelpCommand(context);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Teams command failed: ${message}`);
      await context.sendActivity(
        MessageFactory.text('Command failed. Check server logs for details.')
      );
    }
  }

  private async handleRunCommand(
    context: TurnContext,
    commandContext: TeamsCommandContext,
    description: string
  ): Promise<void> {
    if (!description) {
      await context.sendActivity(
        MessageFactory.text('Usage: @APEX run "task description"')
      );
      return;
    }

    const task = await this.orchestrator.createTask({ description });

    if (this.config.useAdaptiveCards) {
      const card = this.buildTaskCreatedCard(task, commandContext.userId);
      await context.sendActivity(MessageFactory.attachment(card));
    } else {
      await context.sendActivity(
        MessageFactory.text(`Task created: ${task.id} - ${task.description}`)
      );
    }

    // Store conversation reference for thread updates
    if (this.config.threadUpdates) {
      this.taskConversations.set(task.id, {
        serviceUrl: context.activity.serviceUrl,
        conversationReference: TurnContext.getConversationReference(context.activity) as ConversationReference,
        activityId: context.activity.id,
      });
    }
  }

  private async handleThinkCommand(
    context: TurnContext,
    commandContext: TeamsCommandContext,
    content: string
  ): Promise<void> {
    if (!content) {
      await context.sendActivity(
        MessageFactory.text('Usage: @APEX think "idea"')
      );
      return;
    }

    const thought = await this.orchestrator.captureThought(content);

    if (this.config.useAdaptiveCards) {
      const card = this.buildThoughtCard(thought.id, thought.content, commandContext.userId);
      await context.sendActivity(MessageFactory.attachment(card));
    } else {
      await context.sendActivity(
        MessageFactory.text(`Thought captured: ${thought.id}`)
      );
    }
  }

  private async handleStatusCommand(
    context: TurnContext,
    commandContext: TeamsCommandContext
  ): Promise<void> {
    const [active, pending, paused] = await Promise.all([
      this.orchestrator.listTasks({ status: 'in-progress', limit: 5 }),
      this.orchestrator.listTasks({ status: 'pending', limit: 5 }),
      this.orchestrator.listTasks({ status: 'paused', limit: 5 }),
    ]);

    if (this.config.useAdaptiveCards) {
      const card = this.buildStatusCard(active, pending, paused);
      await context.sendActivity(MessageFactory.attachment(card));
    } else {
      const statusText = [
        `**Active Tasks (${active.length}):**`,
        ...active.map(t => `• ${t.id}: ${t.description}`),
        `**Pending Tasks (${pending.length}):**`,
        ...pending.map(t => `• ${t.id}: ${t.description}`),
        `**Paused Tasks (${paused.length}):**`,
        ...paused.map(t => `• ${t.id}: ${t.description}`),
      ].join('\n');

      await context.sendActivity(MessageFactory.text(statusText));
    }
  }

  private async handleReportCommand(
    context: TurnContext,
    commandContext: TeamsCommandContext,
    taskId: string
  ): Promise<void> {
    const task = taskId
      ? await this.orchestrator.getTask(taskId)
      : await this.orchestrator.getCurrentTask();

    if (!task) {
      await context.sendActivity(
        MessageFactory.text('Task not found. Provide a task ID or ensure a task is active.')
      );
      return;
    }

    if (this.config.useAdaptiveCards) {
      const card = this.buildTaskReportCard(task);
      await context.sendActivity(MessageFactory.attachment(card));
    } else {
      const reportText = [
        `**Task Report: ${task.id}**`,
        `Status: ${task.status}`,
        `Workflow: ${task.workflow}`,
        `Priority: ${task.priority}`,
        `Description: ${task.description}`,
      ].join('\n');

      await context.sendActivity(MessageFactory.text(reportText));
    }
  }

  private async handleCancelCommand(
    context: TurnContext,
    commandContext: TeamsCommandContext,
    taskId: string
  ): Promise<void> {
    if (!taskId) {
      await context.sendActivity(
        MessageFactory.text('Usage: @APEX cancel <taskId>')
      );
      return;
    }

    const cancelled = await this.orchestrator.cancelTask(taskId);
    if (!cancelled) {
      await context.sendActivity(
        MessageFactory.text(`Unable to cancel task ${taskId}`)
      );
      return;
    }

    await context.sendActivity(
      MessageFactory.text(`Task ${taskId} cancelled successfully.`)
    );
  }

  private async handleHelpCommand(context: TurnContext): Promise<void> {
    const helpText = [
      '**APEX Teams Commands:**',
      '• `@APEX run "task description"` - Create and start a new task',
      '• `@APEX think "idea"` - Capture an idea or thought',
      '• `@APEX status` - View current task status',
      '• `@APEX report <taskId>` - Get detailed task report',
      '• `@APEX cancel <taskId>` - Cancel a running task',
      '• `@APEX help` - Show this help message',
    ].join('\n');

    await context.sendActivity(MessageFactory.text(helpText));
  }

  private async handleMessagingExtensionQuery(context: TurnContext): Promise<void> {
    // This will be implemented in the messaging extension component
    const response = {
      composeExtension: {
        type: 'result',
        attachmentLayout: 'list',
        attachments: [],
      },
    };

    await context.sendActivity({ type: 'invokeResponse', value: response });
  }

  private async handleMessagingExtensionAction(context: TurnContext): Promise<void> {
    // This will be implemented in the messaging extension component
    const response = {
      task: {
        type: 'message',
        value: 'Action completed',
      },
    };

    await context.sendActivity({ type: 'invokeResponse', value: response });
  }

  private async handleTaskSubmit(context: TurnContext): Promise<void> {
    const data = context.activity.value;

    if (data.action === 'status') {
      await this.handleStatusCommand(context, {
        conversationId: context.activity.conversation.id,
        userId: context.activity.from.id,
        userName: context.activity.from.name,
        text: 'status',
        serviceUrl: context.activity.serviceUrl,
      });
    } else if (data.action === 'cancel' && data.taskId) {
      await this.handleCancelCommand(context, {
        conversationId: context.activity.conversation.id,
        userId: context.activity.from.id,
        userName: context.activity.from.name,
        text: `cancel ${data.taskId}`,
        serviceUrl: context.activity.serviceUrl,
      }, data.taskId);
    }

    const response = {
      task: {
        type: 'message',
        value: 'Action completed',
      },
    };

    await context.sendActivity({ type: 'invokeResponse', value: response });
  }

  private registerOrchestratorEvents(): void {
    this.orchestrator.on('task:started', (task) => {
      void this.notifyTaskUpdate(task, 'Task started');
    });
    this.orchestrator.on('task:stage-changed', (task, stage) => {
      void this.notifyTaskUpdate(task, `Stage: ${stage}`);
    });
    this.orchestrator.on('task:paused', (task, reason) => {
      void this.notifyTaskUpdate(task, `Task paused: ${reason}`);
    });
    this.orchestrator.on('task:completed', (task) => {
      void this.notifyTaskUpdate(task, 'Task completed');
    });
    this.orchestrator.on('task:failed', (task, error) => {
      void this.notifyTaskUpdate(task, `Task failed: ${error.message}`);
    });
  }

  private async notifyTaskUpdate(task: Task, message: string): Promise<void> {
    const conversation = this.taskConversations.get(task.id);
    if (!conversation || !this.adapter) {
      return;
    }

    try {
      await this.adapter.continueConversationAsync(
        this.config.appId!,
        conversation.conversationReference,
        async (context) => {
          if (this.config.useAdaptiveCards) {
            const card = this.buildTaskUpdateCard(task, message);
            await context.sendActivity(MessageFactory.attachment(card));
          } else {
            await context.sendActivity(
              MessageFactory.text(`**${task.id}** — ${message}`)
            );
          }
        }
      );
    } catch (error) {
      this.logger.error(`Failed to send task update: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Adaptive Card builders will be implemented in the next section
  private buildTaskCreatedCard(task: Task, requestedBy: string): any {
    return CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.5',
      body: [
        {
          type: 'TextBlock',
          size: 'Large',
          weight: 'Bolder',
          text: 'Task Created',
          color: 'Good',
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'ID', value: task.id },
            { title: 'Status', value: task.status },
            { title: 'Workflow', value: task.workflow },
            { title: 'Priority', value: task.priority },
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
          title: 'Cancel',
          data: { action: 'cancel', taskId: task.id },
          style: 'destructive',
        },
      ],
    });
  }

  private buildTaskUpdateCard(task: Task, message: string): any {
    return CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.5',
      body: [
        {
          type: 'TextBlock',
          text: `**${task.id}** — ${message}`,
          wrap: true,
        },
      ],
    });
  }

  private buildThoughtCard(thoughtId: string, content: string, requestedBy: string): any {
    return CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.5',
      body: [
        {
          type: 'TextBlock',
          size: 'Large',
          weight: 'Bolder',
          text: 'Thought Captured',
          color: 'Good',
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'ID', value: thoughtId },
            { title: 'Requested by', value: requestedBy },
          ],
        },
        {
          type: 'TextBlock',
          text: content,
          wrap: true,
        },
      ],
    });
  }

  private buildStatusCard(active: Task[], pending: Task[], paused: Task[]): any {
    const formatTasks = (tasks: Task[]) =>
      tasks.length === 0
        ? []
        : tasks.map(task => ({
            type: 'TextBlock',
            text: `• **${task.id}** — ${task.description}`,
            wrap: true,
          }));

    return CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.5',
      body: [
        {
          type: 'TextBlock',
          size: 'Large',
          weight: 'Bolder',
          text: 'APEX Task Status',
        },
        {
          type: 'TextBlock',
          weight: 'Bolder',
          text: `In Progress (${active.length})`,
          color: 'Good',
        },
        ...formatTasks(active),
        {
          type: 'TextBlock',
          weight: 'Bolder',
          text: `Pending (${pending.length})`,
          color: 'Warning',
        },
        ...formatTasks(pending),
        {
          type: 'TextBlock',
          weight: 'Bolder',
          text: `Paused (${paused.length})`,
          color: 'Attention',
        },
        ...formatTasks(paused),
      ],
    });
  }

  private buildTaskReportCard(task: Task): any {
    return CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.5',
      body: [
        {
          type: 'TextBlock',
          size: 'Large',
          weight: 'Bolder',
          text: 'Task Report',
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'ID', value: task.id },
            { title: 'Status', value: task.status },
            { title: 'Workflow', value: task.workflow },
            { title: 'Priority', value: task.priority },
            { title: 'Effort', value: task.effort },
            { title: 'Updated', value: task.updatedAt?.toISOString() || 'N/A' },
          ],
        },
        {
          type: 'TextBlock',
          text: task.description,
          wrap: true,
        },
      ],
    });
  }
}