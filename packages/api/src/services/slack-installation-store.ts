import { InstallationStore, Installation, InstallationQuery } from '@slack/oauth';
import type { SlackInstallation } from '@apexcli/core';
import * as crypto from 'crypto';
import Database = require('better-sqlite3');

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
      record.botToken ? this.encrypt(record.botToken) : '',
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
  async fetchInstallation(query: InstallationQuery<boolean>): Promise<Installation> {
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
  async deleteInstallation(query: InstallationQuery<boolean>): Promise<void> {
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
      installedAt: new Date(),
      refreshToken: installation.bot?.refreshToken,
      tokenExpiresAt: installation.bot?.expiresAt
        ? new Date(installation.bot.expiresAt * 1000)
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