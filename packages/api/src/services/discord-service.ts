import { Client, GatewayIntentBits, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ThreadChannel, TextChannel, ChannelType, REST, Routes } from 'discord.js';
import type { DiscordIntegrationConfig, Task } from '@apexcli/core';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

/**
 * Context information for a Discord slash command invocation.
 *
 * @interface DiscordCommandContext
 */
export interface DiscordCommandContext {
  /** ID of the Discord channel where command was invoked */
  channelId: string;
  /** ID of the Discord guild (server) */
  guildId?: string;
  /** ID of the user who invoked the command */
  userId: string;
  /** Username of the user who invoked the command */
  username: string;
  /** The interaction object for responding */
  interaction: ChatInputCommandInteraction;
}

/**
 * Configuration options for initializing the DiscordService.
 *
 * @interface DiscordServiceOptions
 */
export interface DiscordServiceOptions {
  /** APEX orchestrator instance for task management */
  orchestrator: ApexOrchestrator;
  /** Discord integration configuration (optional, can be resolved from environment) */
  config?: DiscordIntegrationConfig;
  /** Environment variables to use for configuration (defaults to process.env) */
  env?: NodeJS.ProcessEnv;
  /** Custom logger interface (defaults to console) */
  logger?: { info: (message: string) => void; warn: (message: string) => void; error: (message: string) => void };
}

/**
 * Result of parsing a Discord command text string.
 *
 * @interface DiscordCommandParseResult
 */
export interface DiscordCommandParseResult {
  /** The command name (e.g., 'run', 'status') */
  command: string;
  /** Arguments provided with the command */
  args: string;
}

/**
 * Parses Discord command arguments to extract command information.
 *
 * @param command - The command name
 * @param args - The command arguments
 * @returns Parsed command information
 *
 * @example
 * ```typescript
 * const result = parseDiscordCommand('run', 'Create a new feature');
 * // Returns: { command: 'run', args: 'Create a new feature' }
 * ```
 */
export function parseDiscordCommand(command: string, args: string = ''): DiscordCommandParseResult {
  return {
    command: command ? command.toLowerCase().trim() : '',
    args: args ? args.trim() : '',
  };
}

/**
 * Service for integrating APEX with Discord using Discord.js.
 *
 * Handles slash commands, task notifications, and real-time updates
 * through Discord's Gateway API. Supports threaded conversations
 * and configurable notification channels.
 *
 * @class DiscordService
 *
 * @example
 * ```typescript
 * const discordService = new DiscordService({
 *   orchestrator,
 *   config: {
 *     enabled: true,
 *     botToken: 'your-bot-token',
 *     applicationId: 'your-app-id',
 *     defaultChannelId: '123456789'
 *   }
 * });
 *
 * await discordService.start();
 * ```
 */
export class DiscordService {
  private orchestrator: ApexOrchestrator;
  private config: DiscordIntegrationConfig;
  private env: NodeJS.ProcessEnv;
  private logger;
  private client?: Client;
  private taskThreads = new Map<string, { channelId: string; threadId: string }>();

  constructor(options: DiscordServiceOptions) {
    this.orchestrator = options.orchestrator;
    this.env = options.env ?? process.env;
    this.logger = options.logger ?? console;
    this.config = this.resolveConfig(options.config);
  }

  /**
   * Checks if the Discord integration is properly configured and enabled.
   *
   * @returns True if Discord is enabled and has required tokens
   */
  isEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.botToken && this.config.applicationId);
  }

  /**
   * Starts the Discord Gateway connection and registers slash commands.
   *
   * Initializes Discord client, sets up event listeners for slash commands,
   * registers slash commands with Discord, and registers orchestrator event
   * handlers for task status updates.
   *
   * @throws {Error} If Discord connection fails
   */
  async start(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.info('Discord integration disabled or missing tokens.');
      return;
    }

    this.logger.info('Starting Discord integration...');

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Setup event handlers
    this.client.once('ready', async () => {
      this.logger.info(`Discord bot logged in as ${this.client?.user?.tag}!`);
      await this.registerSlashCommands();
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleSlashCommand(interaction);
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Discord client error: ${error.message}`);
    });

    this.client.on('warn', (info: string) => {
      this.logger.warn(`Discord client warning: ${info}`);
    });

    this.registerOrchestratorEvents();
    await this.client.login(this.config.botToken);
    this.logger.info('Discord integration started successfully.');
  }

  /**
   * Stops the Discord connection and cleans up resources.
   *
   * @throws {Error} If disconnect fails
   */
  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.logger.info('Discord client destroyed.');
    }
  }

  private resolveConfig(config?: DiscordIntegrationConfig): DiscordIntegrationConfig {
    const env = this.env;
    const enabled = config?.enabled ?? Boolean(env.DISCORD_BOT_TOKEN && env.DISCORD_APPLICATION_ID);
    const notificationChannelIds = config?.notificationChannelIds
      ?? (env.DISCORD_NOTIFICATION_CHANNELS ? env.DISCORD_NOTIFICATION_CHANNELS.split(',') : []);

    return {
      enabled,
      mode: config?.mode ?? 'gateway',
      botToken: config?.botToken ?? env.DISCORD_BOT_TOKEN,
      applicationId: config?.applicationId ?? env.DISCORD_APPLICATION_ID,
      clientSecret: config?.clientSecret ?? env.DISCORD_CLIENT_SECRET,
      publicKey: config?.publicKey ?? env.DISCORD_PUBLIC_KEY,
      devGuildId: config?.devGuildId ?? env.DISCORD_DEV_GUILD_ID,
      defaultChannelId: config?.defaultChannelId ?? env.DISCORD_DEFAULT_CHANNEL_ID,
      notificationChannelIds: notificationChannelIds.map(channel => channel.trim()).filter(Boolean),
      threadUpdates: config?.threadUpdates ?? (env.DISCORD_THREAD_UPDATES !== 'false'),
      useEmbeds: config?.useEmbeds ?? (env.DISCORD_USE_EMBEDS !== 'false'),
      interactionsEndpoint: config?.interactionsEndpoint ?? env.DISCORD_INTERACTIONS_ENDPOINT,
    };
  }

  private async registerSlashCommands(): Promise<void> {
    if (!this.config.applicationId || !this.config.botToken) {
      this.logger.error('Missing Discord application ID or bot token for slash command registration.');
      return;
    }

    const commands = [
      new SlashCommandBuilder()
        .setName('apex')
        .setDescription('APEX AI Assistant commands')
        .addSubcommand(subcommand =>
          subcommand
            .setName('run')
            .setDescription('Create and start a new task')
            .addStringOption(option =>
              option
                .setName('description')
                .setDescription('Task description')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('think')
            .setDescription('Capture an idea or thought')
            .addStringOption(option =>
              option
                .setName('content')
                .setDescription('The idea or thought to capture')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('status')
            .setDescription('View current task status')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('report')
            .setDescription('Get detailed task report')
            .addStringOption(option =>
              option
                .setName('task_id')
                .setDescription('Task ID (optional, defaults to current task)')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('cancel')
            .setDescription('Cancel a running task')
            .addStringOption(option =>
              option
                .setName('task_id')
                .setDescription('Task ID to cancel')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('help')
            .setDescription('Show available commands and usage')
        ),
    ];

    const rest = new REST({ version: '10' }).setToken(this.config.botToken);

    try {
      this.logger.info('Started refreshing Discord slash commands...');

      if (this.config.devGuildId) {
        // Register commands to a specific guild for development (faster updates)
        await rest.put(
          Routes.applicationGuildCommands(this.config.applicationId, this.config.devGuildId),
          { body: commands.map(command => command.toJSON()) },
        );
        this.logger.info(`Successfully registered ${commands.length} Discord slash commands to guild ${this.config.devGuildId}.`);
      } else {
        // Register commands globally (takes up to 1 hour to propagate)
        await rest.put(
          Routes.applicationCommands(this.config.applicationId),
          { body: commands.map(command => command.toJSON()) },
        );
        this.logger.info(`Successfully registered ${commands.length} Discord slash commands globally.`);
      }
    } catch (error) {
      this.logger.error(`Failed to register Discord slash commands: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.commandName !== 'apex') {
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const context: DiscordCommandContext = {
      channelId: interaction.channelId,
      guildId: interaction.guildId ?? undefined,
      userId: interaction.user.id,
      username: interaction.user.username,
      interaction,
    };

    try {
      switch (subcommand) {
        case 'run':
          const description = interaction.options.getString('description', true);
          await this.handleRunCommand(context, description);
          return;
        case 'think':
          const content = interaction.options.getString('content', true);
          await this.handleThinkCommand(context, content);
          return;
        case 'status':
          await this.handleStatusCommand(context);
          return;
        case 'report':
          const taskId = interaction.options.getString('task_id');
          await this.handleReportCommand(context, taskId);
          return;
        case 'cancel':
          const cancelTaskId = interaction.options.getString('task_id', true);
          await this.handleCancelCommand(context, cancelTaskId);
          return;
        case 'help':
        default:
          await this.handleHelpCommand(context);
          return;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Discord command error: ${errMsg}`);

      const errorEmbed = this.buildErrorEmbed(`An error occurred: ${errMsg}`);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  private async handleRunCommand(context: DiscordCommandContext, description: string): Promise<void> {
    if (!description.trim()) {
      const errorEmbed = this.buildErrorEmbed('Usage: /apex run description: <task description>');
      await context.interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    await context.interaction.deferReply();

    const task = await this.orchestrator.createTask({ description: description.trim() });
    const embed = this.buildTaskCreatedEmbed(task, context.username);
    const response = await context.interaction.editReply({ embeds: [embed] });

    // Create thread for task updates if enabled
    if (this.config.threadUpdates && context.interaction.channel?.type === ChannelType.GuildText) {
      try {
        const channel = context.interaction.channel as TextChannel;
        const thread = await channel.threads.create({
          name: `Task: ${task.id.substring(0, 8)} - ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`,
          startMessage: response.id,
          autoArchiveDuration: 1440, // 24 hours
        });
        this.taskThreads.set(task.id, { channelId: context.channelId, threadId: thread.id });
        this.logger.info(`Created thread ${thread.id} for task ${task.id}`);
      } catch (error) {
        this.logger.warn(`Failed to create thread for task ${task.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async handleThinkCommand(context: DiscordCommandContext, content: string): Promise<void> {
    if (!content.trim()) {
      const errorEmbed = this.buildErrorEmbed('Usage: /apex think content: <your idea>');
      await context.interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    await context.interaction.deferReply();

    await this.orchestrator.captureThought(content.trim());
    const embed = this.buildSimpleEmbed('Thought Captured', `Your idea has been saved: "${content.trim()}"`, 0x00ff00);
    await context.interaction.editReply({ embeds: [embed] });
  }

  private async handleStatusCommand(context: DiscordCommandContext): Promise<void> {
    await context.interaction.deferReply();

    const currentTask = await this.orchestrator.getCurrentTask();
    if (!currentTask) {
      const embed = this.buildSimpleEmbed('No Active Task', 'There is no currently running task.', 0xffa500);
      await context.interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = this.buildTaskStatusEmbed(currentTask);
    await context.interaction.editReply({ embeds: [embed] });
  }

  private async handleReportCommand(context: DiscordCommandContext, taskId?: string | null): Promise<void> {
    await context.interaction.deferReply();

    let task: Task | null = null;
    if (taskId) {
      task = await this.orchestrator.getTask(taskId);
      if (!task) {
        const errorEmbed = this.buildErrorEmbed(`Task ${taskId} not found.`);
        await context.interaction.editReply({ embeds: [errorEmbed] });
        return;
      }
    } else {
      task = await this.orchestrator.getCurrentTask();
      if (!task) {
        const embed = this.buildSimpleEmbed('No Active Task', 'There is no currently running task to report on.', 0xffa500);
        await context.interaction.editReply({ embeds: [embed] });
        return;
      }
    }

    const embed = this.buildTaskReportEmbed(task);
    await context.interaction.editReply({ embeds: [embed] });
  }

  private async handleCancelCommand(context: DiscordCommandContext, taskId: string): Promise<void> {
    if (!taskId.trim()) {
      const errorEmbed = this.buildErrorEmbed('Usage: /apex cancel task_id: <taskId>');
      await context.interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    await context.interaction.deferReply();

    const cancelled = await this.orchestrator.cancelTask(taskId.trim());
    if (!cancelled) {
      const errorEmbed = this.buildErrorEmbed(`Unable to cancel task ${taskId}.`);
      await context.interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const embed = this.buildSimpleEmbed('Task Cancelled', `Task ${taskId} was cancelled by ${context.username}.`, 0xffa500);
    await context.interaction.editReply({ embeds: [embed] });
  }

  private async handleHelpCommand(context: DiscordCommandContext): Promise<void> {
    const embed = this.buildHelpEmbed();
    await context.interaction.reply({ embeds: [embed], ephemeral: true });
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
      const embed = this.buildTaskUpdateEmbed(task, message);
      try {
        const channel = await this.client?.channels.fetch(thread.threadId);
        if (channel?.isThread()) {
          await (channel as ThreadChannel).send({ embeds: [embed] });
        }
      } catch (error) {
        this.logger.warn(`Failed to send thread update for task ${task.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }

    // Send to notification channels
    const embed = this.buildTaskUpdateEmbed(task, message);
    for (const channelId of this.getNotificationChannels()) {
      try {
        const channel = await this.client?.channels.fetch(channelId);
        if (channel?.isTextBased() && 'send' in channel) {
          await channel.send({ embeds: [embed] });
        }
      } catch (error) {
        this.logger.warn(`Failed to send notification to channel ${channelId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private getNotificationChannels(): string[] {
    const channels = [
      ...(this.config.defaultChannelId ? [this.config.defaultChannelId] : []),
      ...(this.config.notificationChannelIds ?? [])
    ];
    return Array.from(new Set(channels.filter(Boolean))) as string[];
  }

  private buildHelpEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('🤖 APEX Discord Bot')
      .setDescription('Available commands for the APEX AI Assistant')
      .setColor(0x0099ff)
      .addFields(
        { name: '/apex run', value: 'Create and start a new task\n`/apex run description: "Create a new feature"`', inline: false },
        { name: '/apex think', value: 'Capture an idea or thought\n`/apex think content: "Add dark mode"`', inline: false },
        { name: '/apex status', value: 'View the status of the current running task', inline: false },
        { name: '/apex report', value: 'Get detailed report on a task\n`/apex report task_id: abc123` (optional)', inline: false },
        { name: '/apex cancel', value: 'Cancel a running task\n`/apex cancel task_id: abc123`', inline: false },
        { name: '/apex help', value: 'Show this help message', inline: false }
      )
      .setFooter({ text: 'APEX AI Assistant' })
      .setTimestamp();
  }

  private buildTaskCreatedEmbed(task: Task, requestedBy: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('✅ Task Created')
      .setDescription(`A new task has been created and started.`)
      .setColor(0x00ff00)
      .addFields(
        { name: 'Task ID', value: task.id, inline: true },
        { name: 'Status', value: task.status, inline: true },
        { name: 'Created by', value: requestedBy, inline: true },
        { name: 'Description', value: task.description || 'No description provided', inline: false }
      )
      .setFooter({ text: 'APEX AI Assistant' })
      .setTimestamp();
  }

  private buildTaskStatusEmbed(task: Task): EmbedBuilder {
    const statusColor = this.getStatusColor(task.status);

    return new EmbedBuilder()
      .setTitle('📊 Task Status')
      .setColor(statusColor)
      .addFields(
        { name: 'Task ID', value: task.id, inline: true },
        { name: 'Status', value: task.status, inline: true },
        { name: 'Created', value: new Date(task.createdAt).toLocaleString(), inline: true },
        { name: 'Description', value: task.description || 'No description provided', inline: false }
      )
      .setFooter({ text: 'APEX AI Assistant' })
      .setTimestamp();
  }

  private buildTaskReportEmbed(task: Task): EmbedBuilder {
    const statusColor = this.getStatusColor(task.status);

    return new EmbedBuilder()
      .setTitle('📋 Task Report')
      .setColor(statusColor)
      .addFields(
        { name: 'Task ID', value: task.id, inline: true },
        { name: 'Status', value: task.status, inline: true },
        { name: 'Created', value: new Date(task.createdAt).toLocaleString(), inline: true },
        { name: 'Description', value: task.description || 'No description provided', inline: false }
      )
      .setFooter({ text: 'APEX AI Assistant' })
      .setTimestamp();
  }

  private buildTaskUpdateEmbed(task: Task, message: string): EmbedBuilder {
    const statusColor = this.getStatusColor(task.status);

    return new EmbedBuilder()
      .setTitle('🔄 Task Update')
      .setDescription(message)
      .setColor(statusColor)
      .addFields(
        { name: 'Task ID', value: task.id, inline: true },
        { name: 'Status', value: task.status, inline: true },
        { name: 'Updated', value: new Date().toLocaleString(), inline: true }
      )
      .setFooter({ text: 'APEX AI Assistant' })
      .setTimestamp();
  }

  private buildSimpleEmbed(title: string, description: string, color: number = 0x0099ff): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setFooter({ text: 'APEX AI Assistant' })
      .setTimestamp();
  }

  private buildErrorEmbed(message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription(message)
      .setColor(0xff0000)
      .setFooter({ text: 'APEX AI Assistant' })
      .setTimestamp();
  }

  private getStatusColor(status: string): number {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return 0x00ff00; // Green
      case 'failed':
      case 'error':
        return 0xff0000; // Red
      case 'running':
      case 'in_progress':
        return 0x0099ff; // Blue
      case 'paused':
      case 'pending':
        return 0xffa500; // Orange
      default:
        return 0x808080; // Gray
    }
  }
}