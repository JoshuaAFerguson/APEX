# ADR-0023: Slack App Foundation with OAuth Installation Flow

## Status
Proposed

## Date
2026-03-16

## Context

APEX requires a production-ready Slack App Foundation with OAuth installation flow to enable multi-workspace distribution. The current implementation uses Socket Mode which is excellent for single-workspace development but lacks:

1. **OAuth Installation Flow** - The ability for users to install the app to their workspaces
2. **Workspace Installation Storage** - Persisting workspace credentials and tokens
3. **Multi-Workspace Support** - Managing multiple workspace installations
4. **Token Rotation** - Automatic token refresh for security
5. **Production Event Subscription** - HTTP-based event handling for production deployments

### Current State Analysis

#### Existing Infrastructure

1. **`SlackService`** (`packages/api/src/services/slack-service.ts`)
   - Uses Socket Mode for real-time events (single workspace)
   - Command parsing with `parseSlackCommandText()`
   - Block Kit for rich message formatting
   - Task thread management for updates
   - Orchestrator event subscription

2. **`SlackIntegrationConfigSchema`** (`packages/core/src/types.ts`)
   - Zod schema for configuration validation
   - Environment variable resolution
   - Socket Mode tokens (`appToken`, `botToken`)

3. **Slack App Manifest** (`docs/slack-app-manifest.yaml`)
   - Bot user configuration
   - Slash command definition
   - OAuth scopes for bot
   - Socket Mode enabled

4. **API Server** (`packages/api/src/index.ts`)
   - Service initialization pattern
   - Graceful failure handling
   - WebSocket event broadcasting

### Requirements for OAuth Flow

The Slack OAuth 2.0 V2 flow requires:
1. **Authorization URL** - Redirect users to Slack's OAuth authorization page
2. **Callback Handler** - Receive the authorization code and exchange for tokens
3. **Token Storage** - Securely store access tokens per workspace
4. **Token Refresh** - Handle token rotation if enabled
5. **Installation Webhook** - Receive installation events

### Slack SDK Landscape (2025)

- **@slack/web-api** - REST API client (already in use)
- **@slack/socket-mode** - Socket Mode client (already in use)
- **@slack/bolt** - Comprehensive framework with built-in OAuth support
- **@slack/oauth** - Standalone OAuth utilities

**Decision**: Use **@slack/bolt** for OAuth flow because:
1. Built-in OAuth installation support
2. Request verification (signing secret)
3. Compatible with existing Socket Mode code
4. Handles token storage interface
5. Event subscription middleware

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           APEX API Server                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     SlackAppService                               │   │
│  │  ┌─────────────────┐  ┌───────────────────┐  ┌────────────────┐  │   │
│  │  │   Bolt App      │  │  OAuth Installer  │  │  Event Handler │  │   │
│  │  │  (HTTP + WS)    │  │                   │  │                │  │   │
│  │  └────────┬────────┘  └────────┬──────────┘  └───────┬────────┘  │   │
│  │           │                    │                      │           │   │
│  │           ▼                    ▼                      ▼           │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │                   SlackInstallationStore                     │ │   │
│  │  │               (SQLite - apex.db)                             │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌────────────────────┐                                                  │
│  │   SlackService     │ ← Existing Socket Mode service (preserved)      │
│  │   (backward compat) │                                                 │
│  └────────────────────┘                                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Slack Platform                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  OAuth Service  │  │  Events API     │  │  Socket Mode Gateway   │  │
│  │  /oauth/v2/...  │  │  (HTTP events)  │  │  (WebSocket events)    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
packages/
├── api/
│   └── src/
│       └── services/
│           ├── slack-service.ts              # Existing Socket Mode (preserved)
│           ├── slack-app-service.ts          # NEW: Bolt-based OAuth service
│           ├── slack-installation-store.ts   # NEW: SQLite installation store
│           └── __tests__/
│               ├── slack-app-service.test.ts
│               ├── slack-installation-store.test.ts
│               └── slack-oauth-flow.integration.test.ts
├── core/
│   └── src/
│       └── types.ts                          # Add SlackInstallation, SlackOAuthConfigSchema
├── orchestrator/
│   └── src/
│       └── store.ts                          # Add slack_installations table
└── docs/
    ├── slack-app-manifest.yaml               # Update with OAuth redirect URLs
    ├── slack-integration.md                  # Update with OAuth setup guide
    └── adr/
        └── ADR-0023-slack-app-foundation-oauth-architecture.md  # This document
```

### Type Definitions

```typescript
// packages/core/src/types.ts - Additions

/**
 * Slack workspace installation record
 */
export interface SlackInstallation {
  /** Unique installation ID */
  id: string;

  /** Slack team/workspace ID */
  teamId: string;

  /** Team/workspace name */
  teamName: string;

  /** Enterprise ID (for Enterprise Grid) */
  enterpriseId?: string;

  /** Enterprise name */
  enterpriseName?: string;

  /** Bot user ID */
  botUserId: string;

  /** Bot access token (encrypted at rest) */
  botToken: string;

  /** Bot token scopes */
  botScopes: string[];

  /** User who installed the app */
  installedByUserId: string;

  /** User access token (if user-token flow) */
  userToken?: string;

  /** User token scopes */
  userScopes?: string[];

  /** Installation timestamp */
  installedAt: Date;

  /** Last token refresh timestamp */
  tokenRefreshedAt?: Date;

  /** Token expiration timestamp (if rotation enabled) */
  tokenExpiresAt?: Date;

  /** Refresh token (if rotation enabled) */
  refreshToken?: string;

  /** Whether the installation is active */
  isActive: boolean;

  /** Default channel for notifications */
  defaultChannelId?: string;

  /** App-level token for Socket Mode (optional) */
  appToken?: string;
}

export const SlackInstallationSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  teamName: z.string(),
  enterpriseId: z.string().optional(),
  enterpriseName: z.string().optional(),
  botUserId: z.string(),
  botToken: z.string(),
  botScopes: z.array(z.string()),
  installedByUserId: z.string(),
  userToken: z.string().optional(),
  userScopes: z.array(z.string()).optional(),
  installedAt: z.date(),
  tokenRefreshedAt: z.date().optional(),
  tokenExpiresAt: z.date().optional(),
  refreshToken: z.string().optional(),
  isActive: z.boolean(),
  defaultChannelId: z.string().optional(),
  appToken: z.string().optional(),
});

/**
 * Extended Slack configuration for OAuth flow
 */
export const SlackOAuthConfigSchema = z.object({
  /** Client ID from Slack App settings */
  clientId: z.string().optional(),

  /** Client Secret from Slack App settings */
  clientSecret: z.string().optional(),

  /** Signing secret for request verification */
  signingSecret: z.string().optional(),

  /** State secret for OAuth CSRF protection */
  stateSecret: z.string().optional(),

  /** OAuth scopes to request */
  scopes: z.array(z.string()).optional().default([
    'commands',
    'chat:write',
    'channels:read',
    'users:read',
    'team:read',
  ]),

  /** User scopes (for user token flow) */
  userScopes: z.array(z.string()).optional().default([]),

  /** Redirect URI for OAuth callback */
  redirectUri: z.string().optional(),

  /** Enable token rotation */
  tokenRotation: z.boolean().optional().default(false),

  /** Installation success redirect URL */
  installSuccessUrl: z.string().optional(),

  /** Installation failure redirect URL */
  installFailureUrl: z.string().optional(),
});

export type SlackOAuthConfig = z.infer<typeof SlackOAuthConfigSchema>;

/**
 * Updated Slack integration config with OAuth support
 */
export const SlackIntegrationConfigSchemaV2 = SlackIntegrationConfigSchema.extend({
  /** OAuth configuration for multi-workspace support */
  oauth: SlackOAuthConfigSchema.optional(),

  /** Connection mode */
  mode: z.enum(['socket', 'http', 'hybrid']).optional().default('socket'),
});

export type SlackIntegrationConfigV2 = z.infer<typeof SlackIntegrationConfigSchemaV2>;
```

### Database Schema

```sql
-- Add to packages/orchestrator/src/store.ts

CREATE TABLE IF NOT EXISTS slack_installations (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL UNIQUE,
  team_name TEXT NOT NULL,
  enterprise_id TEXT,
  enterprise_name TEXT,
  bot_user_id TEXT NOT NULL,
  bot_token TEXT NOT NULL,            -- Encrypted
  bot_scopes TEXT NOT NULL,           -- JSON array
  installed_by_user_id TEXT NOT NULL,
  user_token TEXT,                    -- Encrypted
  user_scopes TEXT,                   -- JSON array
  installed_at TEXT NOT NULL,
  token_refreshed_at TEXT,
  token_expires_at TEXT,
  refresh_token TEXT,                 -- Encrypted
  is_active INTEGER NOT NULL DEFAULT 1,
  default_channel_id TEXT,
  app_token TEXT,                     -- Encrypted
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_slack_installations_team_id ON slack_installations(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_installations_is_active ON slack_installations(is_active);
CREATE INDEX IF NOT EXISTS idx_slack_installations_enterprise_id ON slack_installations(enterprise_id);
```

### SlackInstallationStore

```typescript
// packages/api/src/services/slack-installation-store.ts

import { InstallationStore, Installation, InstallationQuery } from '@slack/oauth';
import type { SlackInstallation } from '@apexcli/core';

export interface SlackInstallationStoreOptions {
  /** Database getter function */
  getDatabase: () => Database.Database;
  /** Logger interface */
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  /** Encryption key for tokens (optional, uses env var if not provided) */
  encryptionKey?: string;
}

/**
 * SQLite-backed installation store for Slack OAuth
 * Implements @slack/oauth InstallationStore interface
 */
export class SlackInstallationStore implements InstallationStore {
  private db: () => Database.Database;
  private logger;
  private encryptionKey: string;

  constructor(options: SlackInstallationStoreOptions) {
    this.db = options.getDatabase;
    this.logger = options.logger ?? console;
    this.encryptionKey = options.encryptionKey ??
      process.env.SLACK_TOKEN_ENCRYPTION_KEY ??
      this.generateDefaultKey();
  }

  /**
   * Store a new installation or update existing
   */
  async storeInstallation(installation: Installation): Promise<void> {
    const db = this.db();
    const now = new Date().toISOString();

    const record = this.installationToRecord(installation);

    db.prepare(`
      INSERT INTO slack_installations (
        id, team_id, team_name, enterprise_id, enterprise_name,
        bot_user_id, bot_token, bot_scopes, installed_by_user_id,
        user_token, user_scopes, installed_at, refresh_token,
        token_expires_at, is_active, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(team_id) DO UPDATE SET
        team_name = excluded.team_name,
        bot_user_id = excluded.bot_user_id,
        bot_token = excluded.bot_token,
        bot_scopes = excluded.bot_scopes,
        installed_by_user_id = excluded.installed_by_user_id,
        user_token = excluded.user_token,
        user_scopes = excluded.user_scopes,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        token_refreshed_at = ?,
        is_active = 1,
        updated_at = ?
    `).run(
      record.id,
      record.teamId,
      record.teamName,
      record.enterpriseId,
      record.enterpriseName,
      record.botUserId,
      this.encrypt(record.botToken),
      JSON.stringify(record.botScopes),
      record.installedByUserId,
      record.userToken ? this.encrypt(record.userToken) : null,
      record.userScopes ? JSON.stringify(record.userScopes) : null,
      record.installedAt,
      record.refreshToken ? this.encrypt(record.refreshToken) : null,
      record.tokenExpiresAt,
      1, // is_active
      now,
      now,
      now,
      now
    );

    this.logger.info(`Slack installation stored for team ${record.teamId} (${record.teamName})`);
  }

  /**
   * Fetch installation by query
   */
  async fetchInstallation(query: InstallationQuery): Promise<Installation> {
    const db = this.db();

    let sql = 'SELECT * FROM slack_installations WHERE is_active = 1';
    const params: any[] = [];

    if (query.enterpriseId) {
      sql += ' AND enterprise_id = ?';
      params.push(query.enterpriseId);
    }

    if (query.teamId) {
      sql += ' AND team_id = ?';
      params.push(query.teamId);
    }

    if (query.isEnterpriseInstall) {
      sql += ' AND enterprise_id IS NOT NULL';
    }

    const row = db.prepare(sql).get(...params) as any;

    if (!row) {
      throw new Error(`No installation found for query: ${JSON.stringify(query)}`);
    }

    return this.recordToInstallation(row);
  }

  /**
   * Delete an installation (mark as inactive)
   */
  async deleteInstallation(query: InstallationQuery): Promise<void> {
    const db = this.db();

    let sql = 'UPDATE slack_installations SET is_active = 0, updated_at = ? WHERE 1=1';
    const params: any[] = [new Date().toISOString()];

    if (query.enterpriseId) {
      sql += ' AND enterprise_id = ?';
      params.push(query.enterpriseId);
    }

    if (query.teamId) {
      sql += ' AND team_id = ?';
      params.push(query.teamId);
    }

    db.prepare(sql).run(...params);

    this.logger.info(`Slack installation deactivated for team ${query.teamId}`);
  }

  /**
   * Get all active installations
   */
  async getAllInstallations(): Promise<SlackInstallation[]> {
    const db = this.db();
    const rows = db.prepare(
      'SELECT * FROM slack_installations WHERE is_active = 1'
    ).all() as any[];

    return rows.map(row => this.recordToSlackInstallation(row));
  }

  /**
   * Get installation by team ID
   */
  async getByTeamId(teamId: string): Promise<SlackInstallation | null> {
    const db = this.db();
    const row = db.prepare(
      'SELECT * FROM slack_installations WHERE team_id = ? AND is_active = 1'
    ).get(teamId) as any;

    return row ? this.recordToSlackInstallation(row) : null;
  }

  /**
   * Update default channel for a workspace
   */
  async updateDefaultChannel(teamId: string, channelId: string): Promise<void> {
    const db = this.db();
    db.prepare(
      'UPDATE slack_installations SET default_channel_id = ?, updated_at = ? WHERE team_id = ?'
    ).run(channelId, new Date().toISOString(), teamId);
  }

  // Encryption helpers using AES-256-GCM
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      this.getKeyBuffer(),
      iv
    );
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(encrypted: string): string {
    const buffer = Buffer.from(encrypted, 'base64');
    const iv = buffer.subarray(0, 16);
    const tag = buffer.subarray(16, 32);
    const data = buffer.subarray(32);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.getKeyBuffer(),
      iv
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString();
  }

  private getKeyBuffer(): Buffer {
    return crypto.createHash('sha256').update(this.encryptionKey).digest();
  }

  private generateDefaultKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Conversion helpers
  private installationToRecord(installation: Installation): Partial<SlackInstallation> {
    return {
      id: crypto.randomUUID(),
      teamId: installation.team?.id ?? '',
      teamName: installation.team?.name ?? 'Unknown',
      enterpriseId: installation.enterprise?.id,
      enterpriseName: installation.enterprise?.name,
      botUserId: installation.bot?.userId ?? '',
      botToken: installation.bot?.token ?? '',
      botScopes: installation.bot?.scopes ?? [],
      installedByUserId: installation.user?.id ?? '',
      userToken: installation.user?.token,
      userScopes: installation.user?.scopes,
      installedAt: new Date().toISOString(),
      refreshToken: installation.bot?.refreshToken,
      tokenExpiresAt: installation.bot?.expiresAt
        ? new Date(installation.bot.expiresAt * 1000).toISOString()
        : undefined,
    };
  }

  private recordToInstallation(row: any): Installation {
    return {
      team: {
        id: row.team_id,
        name: row.team_name,
      },
      enterprise: row.enterprise_id ? {
        id: row.enterprise_id,
        name: row.enterprise_name,
      } : undefined,
      bot: {
        userId: row.bot_user_id,
        token: this.decrypt(row.bot_token),
        scopes: JSON.parse(row.bot_scopes),
        refreshToken: row.refresh_token ? this.decrypt(row.refresh_token) : undefined,
        expiresAt: row.token_expires_at
          ? Math.floor(new Date(row.token_expires_at).getTime() / 1000)
          : undefined,
      },
      user: row.user_token ? {
        id: row.installed_by_user_id,
        token: this.decrypt(row.user_token),
        scopes: row.user_scopes ? JSON.parse(row.user_scopes) : undefined,
      } : undefined,
    };
  }

  private recordToSlackInstallation(row: any): SlackInstallation {
    return {
      id: row.id,
      teamId: row.team_id,
      teamName: row.team_name,
      enterpriseId: row.enterprise_id,
      enterpriseName: row.enterprise_name,
      botUserId: row.bot_user_id,
      botToken: this.decrypt(row.bot_token),
      botScopes: JSON.parse(row.bot_scopes),
      installedByUserId: row.installed_by_user_id,
      userToken: row.user_token ? this.decrypt(row.user_token) : undefined,
      userScopes: row.user_scopes ? JSON.parse(row.user_scopes) : undefined,
      installedAt: new Date(row.installed_at),
      tokenRefreshedAt: row.token_refreshed_at ? new Date(row.token_refreshed_at) : undefined,
      tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : undefined,
      refreshToken: row.refresh_token ? this.decrypt(row.refresh_token) : undefined,
      isActive: Boolean(row.is_active),
      defaultChannelId: row.default_channel_id,
      appToken: row.app_token ? this.decrypt(row.app_token) : undefined,
    };
  }
}
```

### SlackAppService (Bolt-based)

```typescript
// packages/api/src/services/slack-app-service.ts

import { App, ExpressReceiver, Installation, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import type { SlackIntegrationConfigV2, Task } from '@apexcli/core';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import { SlackInstallationStore } from './slack-installation-store.js';
import { parseSlackCommandText } from './slack-service.js';

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
  async getInstallations(): Promise<SlackInstallation[]> {
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

  // ... Additional command handlers (similar to existing SlackService)

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

  // Block Kit builders (same as SlackService)
  private buildHelpBlocks(): any[] { /* ... */ }
  private buildTaskCreatedBlocks(task: Task, userId: string): any[] { /* ... */ }
  private buildTaskUpdateBlocks(task: Task, message: string): any[] { /* ... */ }
  private buildErrorBlocks(message: string): any[] { /* ... */ }

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
```

### Updated App Manifest

```yaml
# docs/slack-app-manifest.yaml (updated)

display_information:
  name: APEX
  description: APEX task orchestration via Slack commands
  background_color: "#0D0F12"
  long_description: |
    APEX enables AI-powered task management and automation directly from Slack.
    Create tasks, track progress, and receive real-time notifications.

features:
  bot_user:
    display_name: APEX
    always_online: true
  app_home:
    home_tab_enabled: true
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
  slash_commands:
    - command: /apex
      url: https://your-domain.com/slack/events
      description: Manage APEX tasks and status
      usage_hint: 'run "task", think "idea", status, report <taskId>, cancel <taskId>'
      should_escape: false

oauth_config:
  redirect_urls:
    - https://your-domain.com/slack/oauth_redirect
    - http://localhost:3000/slack/oauth_redirect  # Development
  scopes:
    bot:
      - commands
      - chat:write
      - chat:write.public
      - channels:read
      - users:read
      - team:read
      - app_mentions:read
      - im:history
      - im:write

settings:
  event_subscriptions:
    request_url: https://your-domain.com/slack/events
    bot_events:
      - app_home_opened
      - app_uninstalled
      - message.im
  interactivity:
    is_enabled: true
    request_url: https://your-domain.com/slack/events
  org_deploy_enabled: true
  socket_mode_enabled: false  # Changed for production OAuth
  token_rotation_enabled: true
```

### API Server Integration

```typescript
// packages/api/src/index.ts - Additions

import { SlackAppService } from './services/slack-app-service.js';

// In createServer function, after orchestrator initialization:

// Initialize Slack App Service with OAuth support
const slackAppService = new SlackAppService({
  orchestrator,
  config: config.slack,
  getDatabase: () => orchestrator.getStore().getDatabase(),
  logger: app.log,
});

try {
  await slackAppService.start();

  // Mount OAuth routes if enabled
  if (slackAppService.isOAuthEnabled()) {
    const slackRouter = slackAppService.getRouter();
    if (slackRouter) {
      app.register(async (fastify) => {
        fastify.all('/slack/*', async (request, reply) => {
          // Forward to Express receiver
          slackRouter(request.raw, reply.raw);
        });
      });

      app.log.info('Slack OAuth routes registered: /slack/install, /slack/oauth_redirect');
    }
  }
} catch (error) {
  app.log.error(`Slack App integration failed to start: ${error instanceof Error ? error.message : error}`);
}

// Legacy Socket Mode service (for backward compatibility)
const slackService = new SlackService({ orchestrator, config: config.slack, logger: app.log });
try {
  if (!slackAppService.isOAuthEnabled() && slackService.isEnabled()) {
    await slackService.start();
  }
} catch (error) {
  app.log.error(`Slack Socket Mode failed to start: ${error instanceof Error ? error.message : error}`);
}
```

### Environment Variables

```bash
# Slack OAuth Configuration (Production)
SLACK_CLIENT_ID="your-client-id"
SLACK_CLIENT_SECRET="your-client-secret"
SLACK_SIGNING_SECRET="your-signing-secret"
SLACK_STATE_SECRET="random-state-secret-for-csrf"
SLACK_REDIRECT_URI="https://your-domain.com/slack/oauth_redirect"
SLACK_INSTALL_SUCCESS_URL="https://your-domain.com/slack/success"
SLACK_INSTALL_FAILURE_URL="https://your-domain.com/slack/error"
SLACK_TOKEN_ENCRYPTION_KEY="32-byte-encryption-key-for-tokens"

# Slack Socket Mode (Development/Single Workspace)
SLACK_APP_TOKEN="xapp-..."
SLACK_BOT_TOKEN="xoxb-..."

# Common Configuration
SLACK_DEFAULT_CHANNEL="#apex"
SLACK_NOTIFICATION_CHANNELS="#apex,#ops"
```

## Implementation Plan

### Phase 1: Core Types and Database Schema (0.5 days)
1. Add `SlackInstallation` and `SlackOAuthConfigSchema` to `packages/core/src/types.ts`
2. Add `slack_installations` table migration to `packages/orchestrator/src/store.ts`
3. Update type exports

### Phase 2: Installation Store (0.5 days)
1. Create `packages/api/src/services/slack-installation-store.ts`
2. Implement InstallationStore interface
3. Add token encryption/decryption
4. Write unit tests

### Phase 3: Bolt App Service (1 day)
1. Create `packages/api/src/services/slack-app-service.ts`
2. Configure ExpressReceiver with OAuth
3. Register slash command handlers
4. Implement event handlers
5. Wire up orchestrator events

### Phase 4: API Integration (0.5 days)
1. Mount OAuth routes in API server
2. Add backward compatibility with Socket Mode
3. Test OAuth flow end-to-end

### Phase 5: Documentation & Testing (0.5 days)
1. Update `docs/slack-app-manifest.yaml`
2. Update `docs/slack-integration.md` with OAuth setup
3. Write integration tests for OAuth flow
4. Test multi-workspace scenarios

## Dependencies

New npm packages required in `packages/api/package.json`:

```json
{
  "dependencies": {
    "@slack/bolt": "^4.0.1",
    "@slack/oauth": "^3.0.1"
  }
}
```

Note: `@slack/web-api` and `@slack/socket-mode` are already installed.

## Consequences

### Positive
- Enables multi-workspace distribution
- Professional OAuth installation experience
- Token security with encryption at rest
- Backward compatible with existing Socket Mode
- Follows Slack's recommended patterns
- Token rotation support for enhanced security

### Negative
- Increased complexity over Socket Mode
- Requires public URL for OAuth callbacks
- Additional database table for installations
- Token encryption key management

### Risks
- OAuth redirect URL must be publicly accessible
- State secret must be securely managed
- Token encryption key rotation requires migration
- Slack API rate limits across multiple workspaces

### Migration Path

For existing Socket Mode users:
1. Continue using Socket Mode (no changes required)
2. Add OAuth credentials to enable multi-workspace
3. Installations will be stored in new table
4. Both modes can coexist during transition

## Alternatives Considered

### 1. Pure Socket Mode (Current)
**Retained for backward compatibility** because:
- Simple setup for single workspace
- No public URL required
- Good for development

### 2. Custom OAuth Implementation
**Rejected** because:
- Bolt SDK handles complexity
- Less maintenance burden
- Better Slack integration

### 3. Third-party OAuth Service (e.g., Auth0)
**Rejected** because:
- Adds external dependency
- Slack-specific OAuth is well-documented
- No benefit for this use case

## References

### Slack Documentation
- [OAuth 2.0 V2](https://api.slack.com/authentication/oauth-v2)
- [Bolt JS OAuth](https://slack.dev/bolt-js/concepts#authenticating-oauth)
- [Installation Store](https://slack.dev/bolt-js/concepts#installation-stores)
- [Token Rotation](https://api.slack.com/authentication/rotation)

### Existing Codebase
- `packages/api/src/services/slack-service.ts` - Socket Mode reference
- `packages/core/src/types.ts` - Configuration schemas
- `packages/orchestrator/src/store.ts` - SQLite patterns
- `docs/slack-integration.md` - Current documentation
