# ADR-0022: Discord Bot Integration Architecture

## Status
Proposed

## Date
2026-03-16

## Context

APEX requires a Discord integration for task management via Discord slash commands, following the established architectural patterns from Slack and Microsoft Teams integrations. This integration should enable:
- Task creation and management via Discord slash commands
- Real-time task status notifications to Discord channels
- Thread updates for task progress (using Discord threads)
- OAuth2 installation flow for server deployment

### Existing Infrastructure

The codebase has mature integration patterns from Slack and Teams implementations:

1. **`SlackService`** (`packages/api/src/services/slack-service.ts`)
   - Socket Mode for real-time events
   - Command parsing with `parseSlackCommandText()`
   - Block Kit for rich message formatting
   - Task thread management for updates

2. **`TeamsService`** (`packages/api/src/services/teams-service.ts`)
   - Bot Framework adapter pattern
   - Adaptive Cards for rich messaging
   - Conversation reference storage for thread continuity
   - OAuth/SSO support

3. **Configuration Schema Pattern** (`packages/core/src/types.ts`)
   - Zod schema for configuration validation
   - Environment variable resolution pattern
   - Integration with `ApexConfigSchema`

4. **API Server Integration** (`packages/api/src/index.ts`)
   - Service initialization pattern
   - Orchestrator event subscription
   - Lifecycle management (start/stop)

### Discord SDK Landscape (2026)

Discord provides several integration approaches:

- **discord.js v14** - Most popular Node.js library for Discord bots
- **Discord Gateway** - WebSocket-based real-time events (similar to Slack Socket Mode)
- **Discord Interactions** - HTTP-based webhook interactions for slash commands
- **Discord OAuth2** - Server installation and user authorization

**Decision**: Use **discord.js v14** for implementation due to:
1. Production-ready stability and maturity
2. Excellent TypeScript support
3. Built-in slash command handling
4. Gateway and REST API support
5. Large community and extensive documentation
6. Consistent with Slack's Socket Mode approach

## Decision

### Component Architecture

Create a **DiscordService** following the established service pattern:

```
packages/
├── api/
│   └── src/
│       └── services/
│           ├── discord-service.ts              # Main Discord integration service
│           └── __tests__/
│               ├── discord-service.test.ts     # Unit tests
│               └── discord-command-parsing.test.ts
├── core/
│   └── src/
│       └── types.ts                            # Add DiscordIntegrationConfigSchema
└── docs/
    ├── discord-integration.md                  # User documentation
    └── discord-bot-setup.md                    # Setup guide
```

### Type Definitions

```typescript
// packages/core/src/types.ts - Addition

/**
 * Discord integration configuration (v0.7.0)
 */
export const DiscordIntegrationConfigSchema = z.object({
  /** Enable Discord integration */
  enabled: z.boolean().optional().default(false),

  /** Discord Bot Token (from Developer Portal) */
  botToken: z.string().optional(),

  /** Discord Application ID */
  applicationId: z.string().optional(),

  /** Client Secret (for OAuth2 installation flow) */
  clientSecret: z.string().optional(),

  /** Public Key (for interaction verification) */
  publicKey: z.string().optional(),

  /** Default Guild ID for development (optional, enables guild commands for faster updates) */
  devGuildId: z.string().optional(),

  /** Default channel ID for notifications */
  defaultChannelId: z.string().optional(),

  /** Additional notification channel IDs */
  notificationChannelIds: z.array(z.string()).optional().default([]),

  /** Enable thread updates for task progress */
  threadUpdates: z.boolean().optional().default(true),

  /** Use Discord embeds for rich message formatting */
  useEmbeds: z.boolean().optional().default(true),

  /** Gateway connection mode */
  mode: z.enum(['gateway', 'interactions']).optional().default('gateway'),

  /** Interaction endpoint URL (for HTTP interactions mode) */
  interactionsEndpoint: z.string().optional(),
});
export type DiscordIntegrationConfig = z.infer<typeof DiscordIntegrationConfigSchema>;

// Add to ApexConfigSchema
{
  // ...existing config...
  /** Discord integration configuration (v0.7.0) */
  discord: DiscordIntegrationConfigSchema.optional(),
}
```

### Service Design

#### 1. DiscordService Class

```typescript
// packages/api/src/services/discord-service.ts

import {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  EmbedBuilder,
  REST,
  Routes,
  ChannelType,
  ThreadAutoArchiveDuration,
  type ChatInputCommandInteraction,
  type TextChannel,
  type ThreadChannel,
  type Guild,
} from 'discord.js';
import type { DiscordIntegrationConfig, Task } from '@apexcli/core';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

/**
 * Context information for a Discord slash command invocation.
 */
export interface DiscordCommandContext {
  /** Guild (server) ID where command was invoked */
  guildId: string | null;
  /** Channel ID where command was invoked */
  channelId: string;
  /** User who invoked the command */
  userId: string;
  /** User's display name */
  userName: string;
  /** The interaction object for response handling */
  interaction: ChatInputCommandInteraction;
}

/**
 * Configuration options for initializing the DiscordService.
 */
export interface DiscordServiceOptions {
  /** APEX orchestrator instance */
  orchestrator: ApexOrchestrator;
  /** Discord configuration (optional, resolved from env) */
  config?: DiscordIntegrationConfig;
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
 * Reference to a Discord thread for task updates.
 */
export interface DiscordThreadReference {
  /** Guild ID */
  guildId: string;
  /** Channel ID (parent channel) */
  channelId: string;
  /** Thread ID for updates */
  threadId: string;
}

/**
 * Service for integrating APEX with Discord using discord.js.
 *
 * Handles slash commands, task notifications, and real-time updates
 * through Discord's Gateway API. Supports threaded conversations
 * and configurable notification channels.
 */
export class DiscordService {
  private orchestrator: ApexOrchestrator;
  private config: DiscordIntegrationConfig;
  private env: NodeJS.ProcessEnv;
  private logger;
  private client?: Client;
  private rest?: REST;
  private taskThreads = new Map<string, DiscordThreadReference>();

  constructor(options: DiscordServiceOptions) {
    this.orchestrator = options.orchestrator;
    this.env = options.env ?? process.env;
    this.logger = options.logger ?? console;
    this.config = this.resolveConfig(options.config);
  }

  /**
   * Checks if the Discord integration is properly configured and enabled.
   */
  isEnabled(): boolean {
    return Boolean(
      this.config.enabled &&
      this.config.botToken &&
      this.config.applicationId
    );
  }

  /**
   * Starts the Discord bot connection and registers slash commands.
   */
  async start(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.info('Discord integration disabled or missing tokens.');
      return;
    }

    this.logger.info('Starting Discord bot integration...');

    // Initialize REST API for command registration
    this.rest = new REST({ version: '10' }).setToken(this.config.botToken!);

    // Register slash commands
    await this.registerSlashCommands();

    // Initialize Discord.js client with Gateway
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupEventHandlers();
    this.registerOrchestratorEvents();

    await this.client.login(this.config.botToken);
    this.logger.info('Discord bot connected successfully.');
  }

  /**
   * Stops the Discord bot and cleans up resources.
   */
  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = undefined;
    }
    this.logger.info('Discord integration stopped.');
  }

  // ... implementation continues below
}
```

#### 2. Slash Command Registration

```typescript
private async registerSlashCommands(): Promise<void> {
  const commands = [
    new SlashCommandBuilder()
      .setName('apex')
      .setDescription('APEX task management')
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
          .addChannelOption(option =>
            option
              .setName('channel')
              .setDescription('Override notification channel')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('think')
          .setDescription('Capture an idea or thought')
          .addStringOption(option =>
            option
              .setName('content')
              .setDescription('Your idea or thought')
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
          .setDescription('Show available commands')
      )
      .toJSON(),
  ];

  try {
    if (this.config.devGuildId) {
      // Register guild commands (instant update for development)
      await this.rest!.put(
        Routes.applicationGuildCommands(
          this.config.applicationId!,
          this.config.devGuildId
        ),
        { body: commands }
      );
      this.logger.info(`Registered slash commands for guild ${this.config.devGuildId}`);
    } else {
      // Register global commands (can take up to 1 hour to propagate)
      await this.rest!.put(
        Routes.applicationCommands(this.config.applicationId!),
        { body: commands }
      );
      this.logger.info('Registered global slash commands');
    }
  } catch (error) {
    this.logger.error(`Failed to register slash commands: ${error}`);
    throw error;
  }
}
```

#### 3. Event Handlers

```typescript
private setupEventHandlers(): void {
  if (!this.client) return;

  this.client.once(Events.ClientReady, (readyClient) => {
    this.logger.info(`Discord bot ready as ${readyClient.user.tag}`);
  });

  this.client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'apex') return;

    const context: DiscordCommandContext = {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id,
      userName: interaction.user.username,
      interaction,
    };

    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'run':
          await this.handleRunCommand(context);
          break;
        case 'think':
          await this.handleThinkCommand(context);
          break;
        case 'status':
          await this.handleStatusCommand(context);
          break;
        case 'report':
          await this.handleReportCommand(context);
          break;
        case 'cancel':
          await this.handleCancelCommand(context);
          break;
        case 'help':
        default:
          await this.handleHelpCommand(context);
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Discord command failed: ${message}`);

      const errorEmbed = this.buildErrorEmbed('Command failed. Check server logs for details.');

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  });

  this.client.on(Events.Error, (error) => {
    this.logger.error(`Discord client error: ${error.message}`);
  });
}
```

#### 4. Command Handlers

```typescript
private async handleRunCommand(context: DiscordCommandContext): Promise<void> {
  const { interaction } = context;
  const description = interaction.options.getString('description', true);
  const channelOverride = interaction.options.getChannel('channel');

  // Defer reply for potentially long operation
  await interaction.deferReply();

  const task = await this.orchestrator.createTask({ description });

  const embed = this.buildTaskCreatedEmbed(task, context.userId);
  const reply = await interaction.editReply({ embeds: [embed] });

  // Create thread for task updates if enabled
  if (this.config.threadUpdates && interaction.channel?.isTextBased()) {
    try {
      const thread = await (interaction.channel as TextChannel).threads.create({
        name: `Task: ${task.id}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
        startMessage: reply.id,
        reason: `APEX task ${task.id} progress tracking`,
      });

      this.taskThreads.set(task.id, {
        guildId: context.guildId!,
        channelId: context.channelId,
        threadId: thread.id,
      });
    } catch (error) {
      this.logger.warn(`Failed to create thread for task ${task.id}: ${error}`);
    }
  }
}

private async handleThinkCommand(context: DiscordCommandContext): Promise<void> {
  const { interaction } = context;
  const content = interaction.options.getString('content', true);

  const thought = await this.orchestrator.captureThought(content);

  const embed = this.buildThoughtEmbed(thought.id, thought.content, context.userId);
  await interaction.reply({ embeds: [embed] });
}

private async handleStatusCommand(context: DiscordCommandContext): Promise<void> {
  const { interaction } = context;

  await interaction.deferReply();

  const [active, pending, paused] = await Promise.all([
    this.orchestrator.listTasks({ status: 'in-progress', limit: 5 }),
    this.orchestrator.listTasks({ status: 'pending', limit: 5 }),
    this.orchestrator.listTasks({ status: 'paused', limit: 5 }),
  ]);

  const embed = this.buildStatusEmbed(active, pending, paused);
  await interaction.editReply({ embeds: [embed] });
}

private async handleReportCommand(context: DiscordCommandContext): Promise<void> {
  const { interaction } = context;
  const taskId = interaction.options.getString('task_id');

  await interaction.deferReply();

  const task = taskId
    ? await this.orchestrator.getTask(taskId)
    : await this.orchestrator.getCurrentTask();

  if (!task) {
    const errorEmbed = this.buildErrorEmbed(
      'Task not found. Provide a task ID or ensure a task is active.'
    );
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const embed = this.buildTaskReportEmbed(task);
  await interaction.editReply({ embeds: [embed] });
}

private async handleCancelCommand(context: DiscordCommandContext): Promise<void> {
  const { interaction } = context;
  const taskId = interaction.options.getString('task_id', true);

  await interaction.deferReply();

  const cancelled = await this.orchestrator.cancelTask(taskId);

  if (!cancelled) {
    const errorEmbed = this.buildErrorEmbed(`Unable to cancel task ${taskId}`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Task Cancelled')
    .setDescription(`Task **${taskId}** was cancelled by <@${context.userId}>.`)
    .setColor(0xFFA500) // Orange
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

private async handleHelpCommand(context: DiscordCommandContext): Promise<void> {
  const { interaction } = context;

  const embed = new EmbedBuilder()
    .setTitle('APEX Discord Commands')
    .setColor(0x5865F2) // Discord blurple
    .addFields(
      { name: '/apex run', value: 'Create and start a new task', inline: true },
      { name: '/apex think', value: 'Capture an idea or thought', inline: true },
      { name: '/apex status', value: 'View current task status', inline: true },
      { name: '/apex report', value: 'Get detailed task report', inline: true },
      { name: '/apex cancel', value: 'Cancel a running task', inline: true },
      { name: '/apex help', value: 'Show this help message', inline: true },
    )
    .setFooter({ text: 'APEX Task Orchestration' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
```

### Discord Embed Builders

```typescript
private buildTaskCreatedEmbed(task: Task, requestedBy: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Task Created')
    .setColor(0x00FF00) // Green
    .addFields(
      { name: 'ID', value: task.id, inline: true },
      { name: 'Status', value: task.status, inline: true },
      { name: 'Workflow', value: task.workflow, inline: true },
      { name: 'Priority', value: task.priority, inline: true },
      { name: 'Description', value: task.description },
    )
    .setFooter({ text: `Requested by ${requestedBy}` })
    .setTimestamp();
}

private buildTaskUpdateEmbed(task: Task, message: string): EmbedBuilder {
  const colorMap: Record<string, number> = {
    'Task started': 0x3498DB,    // Blue
    'Task completed': 0x00FF00,  // Green
    'Task failed': 0xFF0000,     // Red
    'Task paused': 0xFFA500,     // Orange
  };

  const color = Object.entries(colorMap).find(([key]) =>
    message.toLowerCase().includes(key.toLowerCase())
  )?.[1] ?? 0x808080; // Default gray

  return new EmbedBuilder()
    .setDescription(`**${task.id}** — ${message}`)
    .setColor(color)
    .setTimestamp();
}

private buildThoughtEmbed(thoughtId: string, content: string, requestedBy: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Thought Captured')
    .setColor(0x9B59B6) // Purple
    .addFields(
      { name: 'ID', value: thoughtId, inline: true },
      { name: 'Idea', value: content },
    )
    .setFooter({ text: `Captured by ${requestedBy}` })
    .setTimestamp();
}

private buildStatusEmbed(active: Task[], pending: Task[], paused: Task[]): EmbedBuilder {
  const formatTasks = (tasks: Task[]) =>
    tasks.length === 0
      ? '_None_'
      : tasks.map(task => `• **${task.id}** — ${task.description}`).join('\n');

  return new EmbedBuilder()
    .setTitle('APEX Task Status')
    .setColor(0x5865F2) // Discord blurple
    .addFields(
      { name: `In Progress (${active.length})`, value: formatTasks(active) },
      { name: `Pending (${pending.length})`, value: formatTasks(pending) },
      { name: `Paused (${paused.length})`, value: formatTasks(paused) },
    )
    .setTimestamp();
}

private buildTaskReportEmbed(task: Task): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Task Report')
    .setColor(0x3498DB) // Blue
    .addFields(
      { name: 'ID', value: task.id, inline: true },
      { name: 'Status', value: task.status, inline: true },
      { name: 'Workflow', value: task.workflow, inline: true },
      { name: 'Priority', value: task.priority, inline: true },
      { name: 'Effort', value: task.effort, inline: true },
      { name: 'Updated', value: task.updatedAt?.toISOString() ?? 'N/A', inline: true },
      { name: 'Description', value: task.description },
    )
    .setTimestamp();
}

private buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setDescription(`⚠️ ${message}`)
    .setColor(0xFF0000) // Red
    .setTimestamp();
}
```

### Orchestrator Event Integration

```typescript
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
  if (!this.client) return;

  const threadRef = this.taskThreads.get(task.id);

  // If we have a thread reference, post to the thread
  if (threadRef && this.config.threadUpdates) {
    try {
      const thread = await this.client.channels.fetch(threadRef.threadId) as ThreadChannel;
      if (thread) {
        const embed = this.buildTaskUpdateEmbed(task, message);
        await thread.send({ embeds: [embed] });
        return;
      }
    } catch (error) {
      this.logger.warn(`Failed to post to thread for task ${task.id}: ${error}`);
    }
  }

  // Fallback: post to notification channels
  for (const channelId of this.getNotificationChannelIds()) {
    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      if (channel?.isTextBased()) {
        const embed = this.buildTaskUpdateEmbed(task, message);
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      this.logger.warn(`Failed to post to channel ${channelId}: ${error}`);
    }
  }
}

private getNotificationChannelIds(): string[] {
  const channels = [
    this.config.defaultChannelId,
    ...(this.config.notificationChannelIds ?? []),
  ].filter(Boolean) as string[];

  return Array.from(new Set(channels));
}
```

### OAuth2 Installation Flow

Discord OAuth2 enables server administrators to install the bot via a web flow:

```typescript
// packages/api/src/routes/discord-oauth.ts

import type { FastifyInstance } from 'fastify';
import type { DiscordIntegrationConfig } from '@apexcli/core';

export async function registerDiscordOAuthRoutes(
  app: FastifyInstance,
  config: DiscordIntegrationConfig
): Promise<void> {
  // OAuth2 authorization URL redirect
  app.get('/api/discord/install', async (request, reply) => {
    if (!config.applicationId || !config.clientSecret) {
      return reply.status(503).send({ error: 'Discord OAuth not configured' });
    }

    const params = new URLSearchParams({
      client_id: config.applicationId,
      permissions: '2147485696', // Send Messages, Use Slash Commands, Create Threads
      scope: 'bot applications.commands',
      response_type: 'code',
      redirect_uri: `${request.protocol}://${request.hostname}/api/discord/callback`,
    });

    return reply.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  // OAuth2 callback handler
  app.get('/api/discord/callback', async (request, reply) => {
    const { code, guild_id } = request.query as { code?: string; guild_id?: string };

    if (!code) {
      return reply.status(400).send({ error: 'Missing authorization code' });
    }

    try {
      // Exchange code for access token (for future API calls if needed)
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.applicationId!,
          client_secret: config.clientSecret!,
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${request.protocol}://${request.hostname}/api/discord/callback`,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Token exchange failed');
      }

      // Success - redirect to success page or dashboard
      return reply.redirect('/discord-installed?success=true');
    } catch (error) {
      app.log.error(`Discord OAuth callback failed: ${error}`);
      return reply.redirect('/discord-installed?error=true');
    }
  });
}
```

### API Server Integration

```typescript
// packages/api/src/index.ts - Additions

import { DiscordService } from './services/discord-service.js';
import { registerDiscordOAuthRoutes } from './routes/discord-oauth.js';

// In createServer function:
const discordService = new DiscordService({
  orchestrator,
  config: config.discord,
  logger: app.log,
});

try {
  await discordService.start();
} catch (error) {
  app.log.error(`Discord integration failed to start: ${error instanceof Error ? error.message : error}`);
}

// Register Discord OAuth routes if configured
if (config.discord?.clientSecret) {
  await registerDiscordOAuthRoutes(app, config.discord);
}
```

### Environment Variables

```bash
# Discord Integration
DISCORD_BOT_TOKEN="your-bot-token"
DISCORD_APPLICATION_ID="your-application-id"
DISCORD_CLIENT_SECRET="your-client-secret"        # For OAuth2 flow
DISCORD_PUBLIC_KEY="your-public-key"              # For interaction verification
DISCORD_DEV_GUILD_ID=""                           # For development (instant command updates)
DISCORD_DEFAULT_CHANNEL_ID=""                     # Default notification channel
DISCORD_NOTIFICATION_CHANNEL_IDS="id1,id2,id3"    # Additional notification channels
DISCORD_THREAD_UPDATES="true"                     # Enable thread updates
DISCORD_USE_EMBEDS="true"                         # Use Discord embeds
```

### Configuration Example

```yaml
# .apex/config.yaml
discord:
  enabled: true
  mode: gateway
  defaultChannelId: "123456789012345678"
  notificationChannelIds:
    - "123456789012345678"
    - "987654321098765432"
  threadUpdates: true
  useEmbeds: true
```

## Implementation Plan

### Phase 1: Core Types and Configuration (0.5 days)
1. Add `DiscordIntegrationConfigSchema` to `packages/core/src/types.ts`
2. Add `discord` property to `ApexConfigSchema`
3. Update type exports

### Phase 2: Service Implementation (1.5 days)
1. Create `packages/api/src/services/discord-service.ts`
2. Implement slash command registration
3. Implement command handlers
4. Build Discord embed formatters
5. Wire up orchestrator event handlers

### Phase 3: Thread Management (0.5 days)
1. Implement thread creation on task creation
2. Implement thread-based task updates
3. Handle thread archive/cleanup

### Phase 4: OAuth2 Installation Flow (0.5 days)
1. Create `packages/api/src/routes/discord-oauth.ts`
2. Implement authorization redirect
3. Implement callback handler
4. Add installation success/error pages

### Phase 5: API Integration (0.5 days)
1. Initialize DiscordService in API server startup
2. Register OAuth routes
3. Add lifecycle management (start/stop)

### Phase 6: Documentation & Testing (1 day)
1. Create `docs/discord-integration.md`
2. Create `docs/discord-bot-setup.md`
3. Write unit tests for service
4. Write integration tests for embed builders
5. Document Discord Developer Portal setup

## Dependencies

New npm packages required in `packages/api/package.json`:

```json
{
  "dependencies": {
    "discord.js": "^14.15.0"
  }
}
```

## Consequences

### Positive
- Consistent architecture with Slack and Teams integrations
- Rich UI via Discord embeds
- Native slash command support with autocomplete
- Thread updates for task progress tracking
- OAuth2 installation flow for easy deployment
- Large Discord developer community
- Gateway connection similar to Slack Socket Mode

### Negative
- Requires Discord Developer Portal setup
- Bot needs to be added to each server individually (or verified for public bots)
- Rate limits apply to message sending
- Slash commands can take up to 1 hour to propagate globally

### Risks
- Discord API changes (mitigated by using stable discord.js library)
- Rate limiting during high-volume task updates
- Thread limitations (1000 active threads per server)

### Mitigations
- Use guild commands in development for instant updates
- Implement message batching for rate limit handling
- Clean up old threads proactively

## Alternatives Considered

### 1. Interactions-only (HTTP Webhooks)
**Rejected** because:
- Requires public HTTPS endpoint
- Less real-time than Gateway
- More complex for thread management
- Gateway provides similar benefits to Slack Socket Mode

### 2. discord-interactions (lightweight library)
**Rejected** because:
- Less feature-rich than discord.js
- Missing thread/channel management
- Smaller community support

### 3. Eris (alternative library)
**Rejected** because:
- Less TypeScript support
- Smaller community
- discord.js is industry standard

## Comparison with Existing Integrations

| Feature | Slack | Teams | Discord |
|---------|-------|-------|---------|
| Connection Mode | Socket Mode | Bot Framework | Gateway |
| Command Style | Slash Commands | @mention | Slash Commands |
| Rich Messaging | Block Kit | Adaptive Cards | Embeds |
| Thread Updates | ✅ | ✅ (replies) | ✅ (threads) |
| OAuth Flow | ✅ | Azure SSO | ✅ OAuth2 |
| Real-time Events | ✅ | ✅ | ✅ |

## References

### Discord Documentation
- [Discord Developer Portal](https://discord.com/developers/docs)
- [discord.js Guide](https://discordjs.guide/)
- [Slash Commands](https://discord.com/developers/docs/interactions/application-commands)
- [OAuth2](https://discord.com/developers/docs/topics/oauth2)
- [Embeds](https://discord.com/developers/docs/resources/message#embed-object)
- [Threads](https://discord.com/developers/docs/resources/channel#start-thread-with-message)

### Existing Codebase
- `packages/api/src/services/slack-service.ts` - Reference implementation
- `packages/api/src/services/teams-service.ts` - Teams reference
- `packages/core/src/types.ts` - Configuration schema patterns
- `packages/api/src/index.ts` - Service integration patterns
- `docs/slack-integration.md` - Documentation pattern
- `docs/adr/ADR-0020-microsoft-teams-integration-architecture.md` - ADR pattern
