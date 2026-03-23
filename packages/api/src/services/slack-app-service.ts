import { App, ExpressReceiver, Installation, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import type { SlackIntegrationConfigV2, Task } from '@apexcli/core';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import { SlackInstallationStore } from './slack-installation-store.js';
import { parseSlackCommandText } from './slack-service.js';
import * as crypto from 'crypto';
import Database = require('better-sqlite3');

export interface SlackAppServiceOptions {
  /** APEX orchestrator instance */
  orchestrator: ApexOrchestrator;
  /** Slack configuration */
  config?: SlackIntegrationConfigV2;
  /** Database getter function */
  getDatabase: () => Database.Database;
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
 * Bolt-based Slack App Service with OAuth installation flow
 */
export class SlackAppService {
  private orchestrator: ApexOrchestrator;
  private config: SlackIntegrationConfigV2;
  private env: NodeJS.ProcessEnv;
  private logger;
  private app?: App;
  private receiver?: ExpressReceiver;
  private installationStore: SlackInstallationStore;
  private taskThreads = new Map<string, { teamId: string; channel: string; threadTs: string }>();

  constructor(options: SlackAppServiceOptions) {
    this.orchestrator = options.orchestrator;
    this.env = options.env ?? process.env;
    this.logger = options.logger ?? console;
    this.config = this.resolveConfig(options.config);
    this.installationStore = new SlackInstallationStore({
      getDatabase: options.getDatabase,
      logger: this.logger,
    });
  }

  /**
   * Check if OAuth mode is properly configured
   */
  isOAuthEnabled(): boolean {
    const oauth = this.config.oauth;
    return Boolean(
      this.config.enabled &&
      oauth?.clientId &&
      oauth?.clientSecret &&
      oauth?.signingSecret
    );
  }

  /**
   * Check if Socket Mode (legacy) is enabled
   */
  isSocketModeEnabled(): boolean {
    return Boolean(
      this.config.enabled &&
      this.config.mode === 'socket' &&
      this.config.appToken &&
      this.config.botToken
    );
  }

  /**
   * Start the Slack app with OAuth support
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Slack integration disabled.');
      return;
    }

    if (this.isOAuthEnabled()) {
      await this.startOAuthMode();
    } else if (this.isSocketModeEnabled()) {
      this.logger.info('Slack OAuth not configured, falling back to Socket Mode.');
      // Delegate to existing SlackService for backward compatibility
      return;
    } else {
      this.logger.warn('Slack integration enabled but not configured properly.');
      return;
    }
  }

  private async startOAuthMode(): Promise<void> {
    this.logger.info('Starting Slack App with OAuth support...');

    const oauth = this.config.oauth!;

    // Create Express receiver for OAuth endpoints
    this.receiver = new ExpressReceiver({
      signingSecret: oauth.signingSecret!,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
      stateSecret: oauth.stateSecret ?? crypto.randomBytes(32).toString('hex'),
      scopes: oauth.scopes ?? [],
      installationStore: this.installationStore,
      installerOptions: {
        redirectUriPath: '/slack/oauth_redirect',
        stateVerification: true,
        userScopes: oauth.userScopes,
      },
    });

    // Create Bolt app
    this.app = new App({
      receiver: this.receiver,
      logLevel: LogLevel.INFO,
    });

    // Register slash command handlers
    this.app.command('/apex', async ({ command, ack, respond, client }) => {
      await ack();

      const context = {
        channelId: command.channel_id,
        channelName: command.channel_name,
        userId: command.user_id,
        teamId: command.team_id,
        responseUrl: command.response_url,
        text: command.text || '',
      };

      await this.handleSlashCommand(context, client, respond);
    });

    // Register event handlers
    this.app.event('app_home_opened', async ({ event, client }) => {
      await this.handleAppHomeOpened(event, client);
    });

    this.app.event('app_uninstalled', async ({ event, context }) => {
      await this.installationStore.deleteInstallation({
        teamId: context.teamId,
        enterpriseId: context.enterpriseId,
        isEnterpriseInstall: Boolean(context.enterpriseId),
      });
      this.logger.info(`Slack app uninstalled from team ${context.teamId}`);
    });

    // Register orchestrator events
    this.registerOrchestratorEvents();

    this.logger.info('Slack OAuth App initialized.');
    this.logger.info(`Install URL: /slack/install`);
    this.logger.info(`OAuth Redirect: /slack/oauth_redirect`);
  }

  /**
   * Get Express router for mounting OAuth routes
   */
  getRouter(): any {
    return this.receiver?.router;
  }

  /**
   * Stop the Slack app
   */
  async stop(): Promise<void> {
    // Bolt app doesn't have explicit stop
    this.logger.info('Slack App stopped.');
  }

  /**
   * Get all active installations
   */
  async getInstallations() {
    return this.installationStore.getAllInstallations();
  }

  /**
   * Send message to specific workspace
   */
  async sendToWorkspace(
    teamId: string,
    channel: string,
    message: { text: string; blocks?: any[] }
  ): Promise<void> {
    const installation = await this.installationStore.getByTeamId(teamId);
    if (!installation) {
      this.logger.warn(`No installation found for team ${teamId}`);
      return;
    }

    const client = new WebClient(installation.botToken);
    await client.chat.postMessage({
      channel,
      text: message.text,
      blocks: message.blocks,
    });
  }

  /**
   * Broadcast to all installed workspaces
   */
  async broadcastToAll(
    message: { text: string; blocks?: any[] },
    channelOverride?: string
  ): Promise<void> {
    const installations = await this.installationStore.getAllInstallations();

    for (const installation of installations) {
      const channel = channelOverride ?? installation.defaultChannelId ?? '#general';
      await this.sendToWorkspace(installation.teamId, channel, message);
    }
  }

  // Command handlers (similar to SlackService)
  private async handleSlashCommand(
    context: any,
    client: WebClient,
    respond: any
  ): Promise<void> {
    const parsed = parseSlackCommandText(context.text);
    const channel = parsed.channelOverride ?? context.channelId ?? '#general';

    try {
      switch (parsed.command) {
        case 'run':
          await this.handleRunCommand(context, parsed.args, channel, client);
          break;
        case 'think':
          await this.handleThinkCommand(context, parsed.args, channel, client);
          break;
        case 'status':
          await this.handleStatusCommand(context, channel, client);
          break;
        case 'report':
          await this.handleReportCommand(context, parsed.args, channel, client);
          break;
        case 'cancel':
          await this.handleCancelCommand(context, parsed.args, channel, client);
          break;
        default:
          await client.chat.postMessage({
            channel,
            text: 'APEX Slack commands: run, think, status, report, cancel',
            blocks: this.buildHelpBlocks(),
          });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Slack command failed: ${message}`);
      await respond({
        text: 'Command failed. Check server logs for details.',
        response_type: 'ephemeral',
      });
    }
  }

  private async handleRunCommand(
    context: any,
    description: string,
    channel: string,
    client: WebClient
  ): Promise<void> {
    if (!description) {
      await client.chat.postMessage({
        channel,
        text: 'Usage: /apex run "task description"',
        blocks: this.buildErrorBlocks('Usage: /apex run "task description"'),
      });
      return;
    }

    const task = await this.orchestrator.createTask({ description });
    const result = await client.chat.postMessage({
      channel,
      text: `Task created: ${task.id}`,
      blocks: this.buildTaskCreatedBlocks(task, context.userId),
    });

    if (result.ts) {
      this.taskThreads.set(task.id, {
        teamId: context.teamId,
        channel,
        threadTs: result.ts,
      });
    }
  }

  private async handleThinkCommand(
    context: any,
    description: string,
    channel: string,
    client: WebClient
  ): Promise<void> {
    if (!description) {
      await client.chat.postMessage({
        channel,
        text: 'Usage: /apex think "idea description"',
        blocks: this.buildErrorBlocks('Usage: /apex think "idea description"'),
      });
      return;
    }

    const task = await this.orchestrator.createTask({
      description,
      workflow: 'thinking'
    });

    const result = await client.chat.postMessage({
      channel,
      text: `Thinking task created: ${task.id}`,
      blocks: this.buildTaskCreatedBlocks(task, context.userId),
    });

    if (result.ts) {
      this.taskThreads.set(task.id, {
        teamId: context.teamId,
        channel,
        threadTs: result.ts,
      });
    }
  }

  private async handleStatusCommand(
    context: any,
    channel: string,
    client: WebClient
  ): Promise<void> {
    const activeTasks = await this.orchestrator.listTasks({ status: 'in-progress' });

    const statusText = activeTasks.length > 0
      ? `${activeTasks.length} active task(s)`
      : 'No active tasks';

    await client.chat.postMessage({
      channel,
      text: statusText,
      blocks: this.buildStatusBlocks(activeTasks),
    });
  }

  private async handleReportCommand(
    context: any,
    taskId: string,
    channel: string,
    client: WebClient
  ): Promise<void> {
    if (!taskId) {
      await client.chat.postMessage({
        channel,
        text: 'Usage: /apex report <taskId>',
        blocks: this.buildErrorBlocks('Usage: /apex report <taskId>'),
      });
      return;
    }

    const task = await this.orchestrator.getTask(taskId);
    if (!task) {
      await client.chat.postMessage({
        channel,
        text: `Task ${taskId} not found`,
        blocks: this.buildErrorBlocks(`Task ${taskId} not found`),
      });
      return;
    }

    await client.chat.postMessage({
      channel,
      text: `Report for task ${taskId}`,
      blocks: this.buildTaskReportBlocks(task),
    });
  }

  private async handleCancelCommand(
    context: any,
    taskId: string,
    channel: string,
    client: WebClient
  ): Promise<void> {
    if (!taskId) {
      await client.chat.postMessage({
        channel,
        text: 'Usage: /apex cancel <taskId>',
        blocks: this.buildErrorBlocks('Usage: /apex cancel <taskId>'),
      });
      return;
    }

    try {
      await this.orchestrator.cancelTask(taskId);
      await client.chat.postMessage({
        channel,
        text: `Task ${taskId} cancelled`,
        blocks: this.buildSuccessBlocks(`Task ${taskId} cancelled`),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await client.chat.postMessage({
        channel,
        text: `Failed to cancel task ${taskId}: ${message}`,
        blocks: this.buildErrorBlocks(`Failed to cancel task ${taskId}: ${message}`),
      });
    }
  }

  private async handleAppHomeOpened(event: any, client: WebClient): Promise<void> {
    await client.views.publish({
      user_id: event.user,
      view: {
        type: 'home',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Welcome to APEX!* 🚀\n\nUse `/apex` commands to manage your tasks.'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Available Commands:*\n• `/apex run "description"` - Create a new task\n• `/apex think "idea"` - Create a thinking task\n• `/apex status` - View active tasks\n• `/apex report <taskId>` - Get task report\n• `/apex cancel <taskId>` - Cancel a task'
            }
          }
        ]
      }
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
    if (!thread) return;

    const installation = await this.installationStore.getByTeamId(thread.teamId);
    if (!installation) return;

    const client = new WebClient(installation.botToken);
    await client.chat.postMessage({
      channel: thread.channel,
      thread_ts: thread.threadTs,
      text: message,
      blocks: this.buildTaskUpdateBlocks(task, message),
    });
  }

  // Block Kit builders
  private buildHelpBlocks(): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*APEX Commands:*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• `/apex run "description"` - Create a new task\n• `/apex think "idea"` - Create a thinking task\n• `/apex status` - View active tasks\n• `/apex report <taskId>` - Get task report\n• `/apex cancel <taskId>` - Cancel a task'
        }
      }
    ];
  }

  private buildTaskCreatedBlocks(task: Task, userId: string): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Task Created* 🎯\n*ID:* ${task.id}\n*Description:* ${task.description}\n*Status:* ${task.status}\n*Created by:* <@${userId}>`
        }
      }
    ];
  }

  private buildTaskUpdateBlocks(task: Task, message: string): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${message}*\n*Task:* ${task.id}\n*Status:* ${task.status}`
        }
      }
    ];
  }

  private buildErrorBlocks(message: string): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ ${message}`
        }
      }
    ];
  }

  private buildSuccessBlocks(message: string): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ ${message}`
        }
      }
    ];
  }

  private buildStatusBlocks(activeTasks: Task[]): any[] {
    if (activeTasks.length === 0) {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*No active tasks* ✨'
          }
        }
      ];
    }

    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Active Tasks* (${activeTasks.length})`
        }
      }
    ];

    activeTasks.slice(0, 5).forEach(task => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• *${task.id}* - ${task.description.slice(0, 60)}${task.description.length > 60 ? '...' : ''}\n  Status: ${task.status}`
        }
      });
    });

    if (activeTasks.length > 5) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `_And ${activeTasks.length - 5} more..._`
        }
      });
    }

    return blocks;
  }

  private buildTaskReportBlocks(task: Task): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Task Report* 📊\n*ID:* ${task.id}\n*Description:* ${task.description}\n*Status:* ${task.status}\n*Workflow:* ${task.workflow}\n*Created:* ${new Date(task.createdAt).toLocaleString()}`
        }
      }
    ];
  }

  private resolveConfig(config?: SlackIntegrationConfigV2): SlackIntegrationConfigV2 {
    const env = this.env;
    return {
      enabled: config?.enabled ?? Boolean(env.SLACK_CLIENT_ID || env.SLACK_APP_TOKEN),
      mode: config?.mode ?? (env.SLACK_APP_TOKEN ? 'socket' : 'http'),
      appToken: config?.appToken ?? env.SLACK_APP_TOKEN,
      botToken: config?.botToken ?? env.SLACK_BOT_TOKEN,
      signingSecret: config?.signingSecret ?? env.SLACK_SIGNING_SECRET,
      defaultChannel: config?.defaultChannel ?? env.SLACK_DEFAULT_CHANNEL ?? '#apex',
      notificationChannels: config?.notificationChannels ?? [],
      threadUpdates: config?.threadUpdates ?? true,
      useBlocks: config?.useBlocks ?? true,
      oauth: {
        clientId: config?.oauth?.clientId ?? env.SLACK_CLIENT_ID,
        clientSecret: config?.oauth?.clientSecret ?? env.SLACK_CLIENT_SECRET,
        signingSecret: config?.oauth?.signingSecret ?? env.SLACK_SIGNING_SECRET,
        stateSecret: config?.oauth?.stateSecret ?? env.SLACK_STATE_SECRET,
        scopes: config?.oauth?.scopes ?? [
          'commands',
          'chat:write',
          'channels:read',
          'users:read',
          'team:read',
        ],
        userScopes: config?.oauth?.userScopes ?? [],
        redirectUri: config?.oauth?.redirectUri ?? env.SLACK_REDIRECT_URI,
        tokenRotation: config?.oauth?.tokenRotation ?? false,
        installSuccessUrl: config?.oauth?.installSuccessUrl ?? env.SLACK_INSTALL_SUCCESS_URL,
        installFailureUrl: config?.oauth?.installFailureUrl ?? env.SLACK_INSTALL_FAILURE_URL,
      },
    };
  }
}