import { WebClient } from '@slack/web-api';
import { SocketModeClient } from '@slack/socket-mode';
import type { SlackIntegrationConfig, Task } from '@apexcli/core';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

export interface SlackCommandContext {
  channelId: string;
  channelName?: string;
  userId: string;
  teamId?: string;
  responseUrl?: string;
  text: string;
}

export interface SlackServiceOptions {
  orchestrator: ApexOrchestrator;
  config?: SlackIntegrationConfig;
  env?: NodeJS.ProcessEnv;
  logger?: { info: (message: string) => void; warn: (message: string) => void; error: (message: string) => void };
}

export interface SlackCommandParseResult {
  command: string;
  args: string;
  channelOverride?: string;
}

export function parseSlackCommandText(text: string): SlackCommandParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { command: 'help', args: '' };
  }

  const channelFlagMatch = trimmed.match(/(?:^|\s)--channel(?:=|\s+)(\S+)/i);
  const channelOverride = channelFlagMatch?.[1];
  const cleaned = channelFlagMatch
    ? trimmed.replace(channelFlagMatch[0], '').trim()
    : trimmed;

  const [command, ...rest] = cleaned.split(/\s+/);
  return {
    command: command.toLowerCase(),
    args: rest.join(' ').trim(),
    channelOverride,
  };
}

export class SlackService {
  private orchestrator: ApexOrchestrator;
  private config: SlackIntegrationConfig;
  private env: NodeJS.ProcessEnv;
  private logger;
  private webClient?: WebClient;
  private socketClient?: SocketModeClient;
  private taskThreads = new Map<string, { channel: string; threadTs: string }>();

  constructor(options: SlackServiceOptions) {
    this.orchestrator = options.orchestrator;
    this.env = options.env ?? process.env;
    this.logger = options.logger ?? console;
    this.config = this.resolveConfig(options.config);
  }

  isEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.appToken && this.config.botToken);
  }

  async start(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.info('Slack integration disabled or missing tokens.');
      return;
    }

    this.logger.info('Starting Slack Socket Mode integration...');
    this.webClient = new WebClient(this.config.botToken);
    this.socketClient = new SocketModeClient({ appToken: this.config.appToken! });
    this.patchSocketModeClient();

    this.socketClient.on('connecting', () => {
      this.logger.info('Slack Socket Mode: Connecting...');
    });

    this.socketClient.on('connected', () => {
      this.logger.info('Slack Socket Mode: Connected successfully!');
    });

    this.socketClient.on('disconnected', () => {
      this.logger.warn('Slack Socket Mode: Disconnected');
    });

    this.socketClient.on('error', (error: Error) => {
      this.logger.error(`Slack Socket Mode error: ${error.message}`);
    });

    this.socketClient.on('slash_commands', async (event: any) => {
      const { body, ack } = event || {};
      try {
        if (typeof ack === 'function') {
          await ack();
        }
      } catch (error) {
        this.logger.warn(`Slack ack failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (!body) {
        return;
      }

      await this.handleSlashCommand({
        channelId: body.channel_id,
        channelName: body.channel_name,
        userId: body.user_id,
        teamId: body.team_id,
        responseUrl: body.response_url,
        text: body.text || '',
      });
    });

    this.registerOrchestratorEvents();
    await this.socketClient.start();
    this.logger.info('Slack Socket Mode connected.');
  }

  async stop(): Promise<void> {
    if (this.socketClient) {
      await this.socketClient.disconnect();
    }
  }

  private patchSocketModeClient(): void {
    const socketClient = this.socketClient as any;
    const stateMachine = socketClient?.stateMachine;
    if (!stateMachine || typeof stateMachine.handle !== 'function') {
      return;
    }

    const originalHandle = stateMachine.handle.bind(stateMachine);
    const originalHandleUnhandledEvent = typeof stateMachine.handleUnhandledEvent === 'function'
      ? stateMachine.handleUnhandledEvent.bind(stateMachine)
      : undefined;

    const getCurrentState = () => {
      if (typeof stateMachine.getCurrentState === 'function') {
        return String(stateMachine.getCurrentState());
      }
      return typeof stateMachine.currentState === 'string' ? stateMachine.currentState : 'unknown';
    };

    const shouldIgnoreExplicitDisconnect = (event: string, message: string) => (
      event === 'server explicit disconnect'
      && getCurrentState().toLowerCase() === 'connecting'
      && message.includes('Unhandled event')
    );

    stateMachine.handle = (event: string, ...args: unknown[]) => {
      try {
        return originalHandle(event, ...args);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldIgnoreExplicitDisconnect(event, message)) {
          this.logger.warn('Slack Socket Mode: ignoring explicit disconnect while connecting.');
          return;
        }

        throw error;
      }
    };

    if (originalHandleUnhandledEvent) {
      stateMachine.handleUnhandledEvent = (event: string, eventPayload?: unknown) => {
        const message = `Unhandled event '${event}' in state '${getCurrentState()}'`;
        if (shouldIgnoreExplicitDisconnect(event, message)) {
          this.logger.warn('Slack Socket Mode: ignoring explicit disconnect while connecting.');
          return;
        }

        return originalHandleUnhandledEvent(event, eventPayload);
      };
    }
  }

  private resolveConfig(config?: SlackIntegrationConfig): SlackIntegrationConfig {
    const env = this.env;
    const enabled = config?.enabled ?? Boolean(env.SLACK_APP_TOKEN && env.SLACK_BOT_TOKEN);
    const notificationChannels = config?.notificationChannels
      ?? (env.SLACK_NOTIFICATION_CHANNELS ? env.SLACK_NOTIFICATION_CHANNELS.split(',') : []);

    return {
      enabled,
      mode: config?.mode ?? 'socket',
      appToken: config?.appToken ?? env.SLACK_APP_TOKEN,
      botToken: config?.botToken ?? env.SLACK_BOT_TOKEN,
      signingSecret: config?.signingSecret ?? env.SLACK_SIGNING_SECRET,
      defaultChannel: config?.defaultChannel ?? env.SLACK_DEFAULT_CHANNEL ?? '#apex',
      notificationChannels: notificationChannels.map(channel => channel.trim()).filter(Boolean),
      threadUpdates: config?.threadUpdates ?? (env.SLACK_THREAD_UPDATES !== 'false'),
      useBlocks: config?.useBlocks ?? (env.SLACK_USE_BLOCKS !== 'false'),
    };
  }

  private async handleSlashCommand(context: SlackCommandContext): Promise<void> {
    const parsed = parseSlackCommandText(context.text);
    const channel = parsed.channelOverride ?? context.channelId ?? this.config.defaultChannel;

    try {
      switch (parsed.command) {
        case 'run':
          await this.handleRunCommand(context, parsed.args, channel);
          return;
        case 'think':
          await this.handleThinkCommand(context, parsed.args, channel);
          return;
        case 'status':
          await this.handleStatusCommand(context, channel);
          return;
        case 'report':
          await this.handleReportCommand(context, parsed.args, channel);
          return;
        case 'cancel':
          await this.handleCancelCommand(context, parsed.args, channel);
          return;
        default:
          await this.postMessage(channel, {
            text: 'APEX Slack commands: run, think, status, report, cancel',
            blocks: this.buildHelpBlocks(),
          });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Slack command failed: ${message}`);
      await this.postMessage(channel, {
        text: 'Slack command failed. Check server logs for details.',
        blocks: this.buildErrorBlocks('Slack command failed. Check server logs for details.'),
      });
    }
  }

  private async handleRunCommand(
    context: SlackCommandContext,
    description: string,
    channel: string
  ): Promise<void> {
    if (!description) {
      await this.postMessage(channel, {
        text: 'Usage: /apex run "task description"',
        blocks: this.buildErrorBlocks('Usage: /apex run "task description"'),
      });
      return;
    }

    const task = await this.orchestrator.createTask({ description });
    const result = await this.postMessage(channel, {
      text: `Task created: ${task.id}`,
      blocks: this.buildTaskCreatedBlocks(task, context.userId),
    });

    if (result?.ts && this.config.threadUpdates) {
      this.taskThreads.set(task.id, { channel, threadTs: result.ts });
    }
  }

  private async handleThinkCommand(
    context: SlackCommandContext,
    content: string,
    channel: string
  ): Promise<void> {
    if (!content) {
      await this.postMessage(channel, {
        text: 'Usage: /apex think "idea"',
        blocks: this.buildErrorBlocks('Usage: /apex think "idea"'),
      });
      return;
    }

    const thought = await this.orchestrator.captureThought(content);
    await this.postMessage(channel, {
      text: `Thought captured: ${thought.id}`,
      blocks: this.buildThoughtBlocks(thought.id, thought.content, context.userId),
    });
  }

  private async handleStatusCommand(context: SlackCommandContext, channel: string): Promise<void> {
    const [active, pending, paused] = await Promise.all([
      this.orchestrator.listTasks({ status: 'in-progress', limit: 5 }),
      this.orchestrator.listTasks({ status: 'pending', limit: 5 }),
      this.orchestrator.listTasks({ status: 'paused', limit: 5 }),
    ]);

    await this.postMessage(channel, {
      text: 'APEX task status',
      blocks: this.buildStatusBlocks(active, pending, paused),
    });
  }

  private async handleReportCommand(
    context: SlackCommandContext,
    taskId: string,
    channel: string
  ): Promise<void> {
    const task = taskId ? await this.orchestrator.getTask(taskId) : await this.orchestrator.getCurrentTask();

    if (!task) {
      await this.postMessage(channel, {
        text: 'Task not found.',
        blocks: this.buildErrorBlocks('Task not found. Provide a task ID or ensure a task is active.'),
      });
      return;
    }

    await this.postMessage(channel, {
      text: `Task report for ${task.id}`,
      blocks: this.buildTaskReportBlocks(task),
    });
  }

  private async handleCancelCommand(
    context: SlackCommandContext,
    taskId: string,
    channel: string
  ): Promise<void> {
    if (!taskId) {
      await this.postMessage(channel, {
        text: 'Usage: /apex cancel <taskId>',
        blocks: this.buildErrorBlocks('Usage: /apex cancel <taskId>'),
      });
      return;
    }

    const cancelled = await this.orchestrator.cancelTask(taskId);
    if (!cancelled) {
      await this.postMessage(channel, {
        text: `Unable to cancel task ${taskId}`,
        blocks: this.buildErrorBlocks(`Unable to cancel task ${taskId}.`),
      });
      return;
    }

    await this.postMessage(channel, {
      text: `Task ${taskId} cancelled.`,
      blocks: this.buildSimpleBlocks('Task cancelled', `Task ${taskId} was cancelled by ${context.userId}.`),
    });
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
    const thread = this.taskThreads.get(task.id);
    if (thread && this.config.threadUpdates) {
      await this.postMessage(thread.channel, {
        text: message,
        blocks: this.buildTaskUpdateBlocks(task, message),
        threadTs: thread.threadTs,
      });
      return;
    }

    for (const channel of this.getNotificationChannels()) {
      await this.postMessage(channel, {
        text: message,
        blocks: this.buildTaskUpdateBlocks(task, message),
      });
    }
  }

  private getNotificationChannels(): string[] {
    const channels = [this.config.defaultChannel, ...(this.config.notificationChannels ?? [])];
    return Array.from(new Set(channels.filter(Boolean))) as string[];
  }

  private async postMessage(
    channel: string,
    options: { text: string; blocks?: any[]; threadTs?: string }
  ): Promise<{ ts?: string } | undefined> {
    if (!this.webClient) {
      return undefined;
    }

    const payload: any = {
      channel,
      text: options.text,
    };
    if (this.config.useBlocks && options.blocks) {
      payload.blocks = options.blocks;
    }
    if (options.threadTs) {
      payload.thread_ts = options.threadTs;
    }

    try {
      const result = await this.webClient.chat.postMessage(payload);
      return { ts: result.ts };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Slack postMessage failed for channel "${channel}": ${errMsg}`);
      return undefined;
    }
  }

  private buildHelpBlocks(): any[] {
    return [
      { type: 'section', text: { type: 'mrkdwn', text: '*APEX Slack Commands*' } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '`/apex run "task description"`',
            '`/apex think "idea"`',
            '`/apex status`',
            '`/apex report <taskId>`',
            '`/apex cancel <taskId>`',
            '`--channel #channel` to override channel',
          ].join('\n'),
        },
      },
    ];
  }

  private buildTaskCreatedBlocks(task: Task, requestedBy: string): any[] {
    return [
      { type: 'header', text: { type: 'plain_text', text: 'Task created' } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*ID:*\n${task.id}` },
          { type: 'mrkdwn', text: `*Status:*\n${task.status}` },
          { type: 'mrkdwn', text: `*Workflow:*\n${task.workflow}` },
          { type: 'mrkdwn', text: `*Priority:*\n${task.priority}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Description:*\n${task.description}` },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Requested by <@${requestedBy}>` }],
      },
    ];
  }

  private buildTaskUpdateBlocks(task: Task, message: string): any[] {
    return [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${task.id}* — ${message}` },
      },
    ];
  }

  private buildThoughtBlocks(thoughtId: string, content: string, requestedBy: string): any[] {
    return [
      { type: 'header', text: { type: 'plain_text', text: 'Thought captured' } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*ID:*\n${thoughtId}` },
          { type: 'mrkdwn', text: `*Requested by:*\n<@${requestedBy}>` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Idea:*\n${content}` },
      },
    ];
  }

  private buildStatusBlocks(active: Task[], pending: Task[], paused: Task[]): any[] {
    const formatTasks = (tasks: Task[]) =>
      tasks.length === 0
        ? '_None_'
        : tasks.map(task => `• *${task.id}* — ${task.description}`).join('\n');

    return [
      { type: 'header', text: { type: 'plain_text', text: 'APEX Task Status' } },
      { type: 'section', text: { type: 'mrkdwn', text: `*In Progress*\n${formatTasks(active)}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*Pending*\n${formatTasks(pending)}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*Paused*\n${formatTasks(paused)}` } },
    ];
  }

  private buildTaskReportBlocks(task: Task): any[] {
    return [
      { type: 'header', text: { type: 'plain_text', text: 'Task report' } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*ID:*\n${task.id}` },
          { type: 'mrkdwn', text: `*Status:*\n${task.status}` },
          { type: 'mrkdwn', text: `*Workflow:*\n${task.workflow}` },
          { type: 'mrkdwn', text: `*Priority:*\n${task.priority}` },
          { type: 'mrkdwn', text: `*Effort:*\n${task.effort}` },
          { type: 'mrkdwn', text: `*Updated:*\n${task.updatedAt?.toISOString()}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Description:*\n${task.description}` },
      },
    ];
  }

  private buildSimpleBlocks(title: string, body: string): any[] {
    return [
      { type: 'header', text: { type: 'plain_text', text: title } },
      { type: 'section', text: { type: 'mrkdwn', text: body } },
    ];
  }

  private buildErrorBlocks(message: string): any[] {
    return [
      { type: 'section', text: { type: 'mrkdwn', text: `:warning: ${message}` } },
    ];
  }
}
