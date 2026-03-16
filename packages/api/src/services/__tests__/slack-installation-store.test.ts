import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlackInstallationStore } from '../slack-installation-store.js';
import type { Installation, InstallationQuery } from '@slack/oauth';
import Database = require('better-sqlite3');

// Mock database
const mockDb = {
  prepare: vi.fn().mockReturnValue({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn().mockReturnValue([])
  }),
  exec: vi.fn(),
  close: vi.fn(),
};

const mockGetDatabase = vi.fn().mockReturnValue(mockDb);

describe('SlackInstallationStore', () => {
  let store: SlackInstallationStore;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    store = new SlackInstallationStore({
      getDatabase: mockGetDatabase,
      logger: mockLogger,
      encryptionKey: 'test-encryption-key-32-characters'
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('storeInstallation', () => {
    it('should store a new installation', async () => {
      const installation: Installation = {
        team: { id: 'T123', name: 'Test Team' },
        bot: {
          userId: 'U123',
          token: 'xoxb-test-token',
          scopes: ['commands', 'chat:write']
        },
        user: { id: 'U456' }
      };

      const mockPrepare = vi.fn().mockReturnValue({
        run: vi.fn()
      });
      mockDb.prepare.mockReturnValue(mockPrepare());

      await store.storeInstallation(installation);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO slack_installations')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Slack installation stored for team T123 (Test Team)'
      );
    });

    it('should handle installation with enterprise info', async () => {
      const installation: Installation = {
        team: { id: 'T123', name: 'Test Team' },
        enterprise: { id: 'E123', name: 'Test Enterprise' },
        bot: {
          userId: 'U123',
          token: 'xoxb-test-token',
          scopes: ['commands', 'chat:write']
        },
        user: { id: 'U456' }
      };

      const mockPrepare = vi.fn().mockReturnValue({
        run: vi.fn()
      });
      mockDb.prepare.mockReturnValue(mockPrepare());

      await store.storeInstallation(installation);

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Slack installation stored for team T123 (Test Team)'
      );
    });
  });

  describe('fetchInstallation', () => {
    it('should fetch installation by team ID', async () => {
      const mockRow = {
        team_id: 'T123',
        team_name: 'Test Team',
        enterprise_id: null,
        enterprise_name: null,
        bot_user_id: 'U123',
        bot_token: 'encrypted-token',
        bot_scopes: '["commands","chat:write"]',
        installed_by_user_id: 'U456',
        user_token: null,
        user_scopes: null,
        refresh_token: null,
        token_expires_at: null
      };

      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(mockRow)
      });
      mockDb.prepare.mockReturnValue(mockPrepare());

      // Mock the decrypt method to return plaintext
      const originalDecrypt = (store as any).decrypt;
      (store as any).decrypt = vi.fn().mockReturnValue('xoxb-test-token');

      const query: InstallationQuery = { teamId: 'T123' };
      const result = await store.fetchInstallation(query);

      expect(result).toEqual({
        team: { id: 'T123', name: 'Test Team' },
        bot: {
          userId: 'U123',
          token: 'xoxb-test-token',
          scopes: ['commands', 'chat:write']
        }
      });

      // Restore original method
      (store as any).decrypt = originalDecrypt;
    });

    it('should throw error when installation not found', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(null)
      });
      mockDb.prepare.mockReturnValue(mockPrepare());

      const query: InstallationQuery = { teamId: 'T123' };

      await expect(store.fetchInstallation(query)).rejects.toThrow(
        'No installation found for query: {"teamId":"T123"}'
      );
    });

    it('should handle enterprise installation queries', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({
          team_id: 'T123',
          team_name: 'Test Team',
          enterprise_id: 'E123',
          enterprise_name: 'Test Enterprise',
          bot_user_id: 'U123',
          bot_token: 'encrypted-token',
          bot_scopes: '["commands"]',
          installed_by_user_id: 'U456',
          user_token: null,
          user_scopes: null,
          refresh_token: null,
          token_expires_at: null
        })
      });
      mockDb.prepare.mockReturnValue(mockPrepare());

      // Mock decrypt
      (store as any).decrypt = vi.fn().mockReturnValue('xoxb-test-token');

      const query: InstallationQuery = {
        teamId: 'T123',
        enterpriseId: 'E123'
      };

      const result = await store.fetchInstallation(query);

      expect(result.enterprise).toEqual({
        id: 'E123',
        name: 'Test Enterprise'
      });
    });
  });

  describe('deleteInstallation', () => {
    it('should deactivate installation', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        run: vi.fn()
      });
      mockDb.prepare.mockReturnValue(mockPrepare());

      const query: InstallationQuery = { teamId: 'T123' };
      await store.deleteInstallation(query);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE slack_installations SET is_active = 0')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Slack installation deactivated for team T123'
      );
    });
  });

  describe('getAllInstallations', () => {
    it('should return all active installations', async () => {
      const mockRows = [
        {
          id: '1',
          team_id: 'T123',
          team_name: 'Team 1',
          enterprise_id: null,
          enterprise_name: null,
          bot_user_id: 'U123',
          bot_token: 'encrypted-token-1',
          bot_scopes: '["commands"]',
          installed_by_user_id: 'U456',
          user_token: null,
          user_scopes: null,
          installed_at: '2024-01-01T00:00:00.000Z',
          token_refreshed_at: null,
          token_expires_at: null,
          refresh_token: null,
          is_active: 1,
          default_channel_id: null,
          app_token: null
        }
      ];

      const mockPrepare = vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue(mockRows)
      });
      mockDb.prepare.mockReturnValue(mockPrepare());

      // Mock decrypt
      (store as any).decrypt = vi.fn().mockReturnValue('xoxb-test-token');

      const result = await store.getAllInstallations();

      expect(result).toHaveLength(1);
      expect(result[0].teamId).toBe('T123');
      expect(result[0].teamName).toBe('Team 1');
      expect(result[0].isActive).toBe(true);
    });

    it('should return empty array when no installations', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([])
      });
      mockDb.prepare.mockReturnValue(mockPrepare());

      const result = await store.getAllInstallations();

      expect(result).toEqual([]);
    });
  });

  describe('getByTeamId', () => {
    it('should return installation for team ID', async () => {
      const mockRow = {
        id: '1',
        team_id: 'T123',
        team_name: 'Test Team',
        enterprise_id: null,
        enterprise_name: null,
        bot_user_id: 'U123',
        bot_token: 'encrypted-token',
        bot_scopes: '["commands"]',
        installed_by_user_id: 'U456',
        user_token: null,
        user_scopes: null,
        installed_at: '2024-01-01T00:00:00.000Z',
        token_refreshed_at: null,
        token_expires_at: null,
        refresh_token: null,
        is_active: 1,
        default_channel_id: null,
        app_token: null
      };

      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(mockRow)
      });
      mockDb.prepare.mockReturnValue(mockPrepare());

      // Mock decrypt
      (store as any).decrypt = vi.fn().mockReturnValue('xoxb-test-token');

      const result = await store.getByTeamId('T123');

      expect(result).not.toBeNull();
      expect(result?.teamId).toBe('T123');
      expect(result?.teamName).toBe('Test Team');
    });

    it('should return null when team not found', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(null)
      });
      mockDb.prepare.mockReturnValue(mockPrepare());

      const result = await store.getByTeamId('T123');

      expect(result).toBeNull();
    });
  });

  describe('updateDefaultChannel', () => {
    it('should update default channel for team', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        run: vi.fn()
      });
      mockDb.prepare.mockReturnValue(mockPrepare());

      await store.updateDefaultChannel('T123', 'C456');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'UPDATE slack_installations SET default_channel_id = ?, updated_at = ? WHERE team_id = ?'
      );
    });
  });

  describe('encryption/decryption', () => {
    it('should encrypt and decrypt tokens correctly', () => {
      const plaintext = 'xoxb-test-token';

      const encrypted = (store as any).encrypt(plaintext);
      const decrypted = (store as any).decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should generate different encrypted values for same input', () => {
      const plaintext = 'xoxb-test-token';

      const encrypted1 = (store as any).encrypt(plaintext);
      const encrypted2 = (store as any).encrypt(plaintext);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same value
      expect((store as any).decrypt(encrypted1)).toBe(plaintext);
      expect((store as any).decrypt(encrypted2)).toBe(plaintext);
    });
  });
});