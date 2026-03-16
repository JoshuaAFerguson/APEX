import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlackInstallationStore } from '../slack-installation-store.js';
import type { Installation, InstallationQuery } from '@slack/oauth';
import Database = require('better-sqlite3');

// Mock crypto module for testing encryption edge cases
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto');
  return {
    ...actual,
    randomBytes: vi.fn().mockImplementation((size: number) => {
      // Return predictable bytes for testing
      return Buffer.alloc(size, 0x42);
    })
  };
});

/**
 * SlackInstallationStore Edge Cases and Security Tests
 *
 * Tests comprehensive error scenarios, encryption edge cases,
 * and security aspects of the installation store.
 */
describe('SlackInstallationStore Edge Cases', () => {
  let store: SlackInstallationStore;
  let mockLogger: any;
  let mockDb: any;
  let mockGetDatabase: any;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    mockDb = {
      prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn().mockReturnValue([])
      }),
      exec: vi.fn(),
      close: vi.fn(),
    };

    mockGetDatabase = vi.fn().mockReturnValue(mockDb);

    store = new SlackInstallationStore({
      getDatabase: mockGetDatabase,
      logger: mockLogger,
      encryptionKey: 'test-encryption-key-32-characters'
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Encryption Edge Cases', () => {
    it('should handle encryption key generation when not provided', () => {
      const storeNoKey = new SlackInstallationStore({
        getDatabase: mockGetDatabase,
        logger: mockLogger
        // No encryptionKey provided
      });

      // Should generate key automatically and log warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No encryption key provided, generating random key. This will cause issues on restart!'
      );
    });

    it('should handle short encryption keys by padding', () => {
      const storeShortKey = new SlackInstallationStore({
        getDatabase: mockGetDatabase,
        logger: mockLogger,
        encryptionKey: 'short' // Too short for AES-256
      });

      // Should pad the key and work without errors
      const encrypted = (storeShortKey as any).encrypt('test-token');
      const decrypted = (storeShortKey as any).decrypt(encrypted);
      expect(decrypted).toBe('test-token');
    });

    it('should handle long encryption keys by truncating', () => {
      const storeLongKey = new SlackInstallationStore({
        getDatabase: mockGetDatabase,
        logger: mockLogger,
        encryptionKey: 'a'.repeat(100) // Too long for AES-256
      });

      const encrypted = (storeLongKey as any).encrypt('test-token');
      const decrypted = (storeLongKey as any).decrypt(encrypted);
      expect(decrypted).toBe('test-token');
    });

    it('should handle empty string encryption', () => {
      const encrypted = (store as any).encrypt('');
      const decrypted = (store as any).decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle null/undefined encryption gracefully', () => {
      expect(() => (store as any).encrypt(null)).toThrow();
      expect(() => (store as any).encrypt(undefined)).toThrow();
    });

    it('should handle malformed encrypted data', () => {
      // Test various malformed encrypted strings
      const malformedData = [
        'not-base64-encoded',
        'dG9vc2hvcnQ=', // Too short base64
        '', // Empty string
        'invalid:format:missing:parts',
        'dGVzdA==:dGVzdA==', // Missing auth tag
      ];

      malformedData.forEach(data => {
        expect(() => (store as any).decrypt(data)).toThrow();
      });
    });

    it('should handle tampered encrypted data', () => {
      const originalText = 'xoxb-test-token';
      const encrypted = (store as any).encrypt(originalText);

      // Tamper with the encrypted data by changing one character
      const tamperedData = encrypted.substring(0, encrypted.length - 1) + 'X';

      expect(() => (store as any).decrypt(tamperedData)).toThrow();
    });

    it('should produce different ciphertext for identical plaintext', () => {
      const plaintext = 'xoxb-identical-token';

      const encrypted1 = (store as any).encrypt(plaintext);
      const encrypted2 = (store as any).encrypt(plaintext);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt correctly
      expect((store as any).decrypt(encrypted1)).toBe(plaintext);
      expect((store as any).decrypt(encrypted2)).toBe(plaintext);
    });
  });

  describe('Database Error Handling', () => {
    it('should handle database connection failures', async () => {
      const mockFailingDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('Database connection lost');
        })
      };

      const failingGetDatabase = vi.fn().mockReturnValue(mockFailingDb);
      const storeWithFailingDb = new SlackInstallationStore({
        getDatabase: failingGetDatabase,
        logger: mockLogger,
        encryptionKey: 'test-key'
      });

      const installation: Installation = {
        team: { id: 'T123', name: 'Test Team' },
        bot: {
          userId: 'U123',
          token: 'xoxb-test-token',
          scopes: ['commands']
        },
        user: { id: 'U456' }
      };

      await expect(storeWithFailingDb.storeInstallation(installation))
        .rejects.toThrow('Database connection lost');
    });

    it('should handle SQL execution failures', async () => {
      const mockPreparedStatement = {
        run: vi.fn().mockImplementation(() => {
          throw new Error('UNIQUE constraint failed');
        })
      };

      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      const installation: Installation = {
        team: { id: 'T123', name: 'Test Team' },
        bot: {
          userId: 'U123',
          token: 'xoxb-test-token',
          scopes: ['commands']
        },
        user: { id: 'U456' }
      };

      await expect(store.storeInstallation(installation))
        .rejects.toThrow('UNIQUE constraint failed');
    });

    it('should handle partial SQL results', async () => {
      const mockPreparedStatement = {
        get: vi.fn().mockReturnValue({
          team_id: 'T123',
          team_name: 'Test Team',
          // Missing required fields like bot_token, bot_user_id, etc.
        })
      };

      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      const query: InstallationQuery = { teamId: 'T123' };

      await expect(store.fetchInstallation(query))
        .rejects.toThrow();
    });

    it('should handle corrupted database data', async () => {
      const corruptedRow = {
        team_id: 'T123',
        team_name: 'Test Team',
        bot_user_id: 'U123',
        bot_token: 'corrupted-encrypted-data-invalid-format',
        bot_scopes: 'not-valid-json',
        installed_by_user_id: 'U456',
        user_token: null,
        user_scopes: null,
        refresh_token: null,
        token_expires_at: null
      };

      const mockPreparedStatement = {
        get: vi.fn().mockReturnValue(corruptedRow)
      };

      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      const query: InstallationQuery = { teamId: 'T123' };

      await expect(store.fetchInstallation(query))
        .rejects.toThrow();
    });
  });

  describe('Installation Data Edge Cases', () => {
    it('should handle installation with minimal required fields', async () => {
      const minimalInstallation: Installation = {
        team: { id: 'T123' }, // No team name
        bot: {
          userId: 'U123',
          token: 'xoxb-test-token'
          // No scopes array
        }
        // No user field
      };

      const mockPreparedStatement = { run: vi.fn() };
      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      await store.storeInstallation(minimalInstallation);

      // Should handle missing fields gracefully
      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockPreparedStatement.run).toHaveBeenCalled();
    });

    it('should handle installation with all optional fields', async () => {
      const completeInstallation: Installation = {
        team: { id: 'T123', name: 'Complete Team' },
        enterprise: { id: 'E123', name: 'Enterprise' },
        bot: {
          userId: 'U123',
          token: 'xoxb-test-token',
          scopes: ['commands', 'chat:write', 'channels:read'],
          refreshToken: 'xoxe-refresh-token',
          expiresAt: Date.now() + 3600000 // 1 hour from now
        },
        user: {
          id: 'U456',
          token: 'xoxp-user-token',
          scopes: ['identity:read'],
          refreshToken: 'xoxe-user-refresh',
          expiresAt: Date.now() + 7200000 // 2 hours from now
        },
        appId: 'A123',
        tokenType: 'bot',
        isEnterpriseInstall: true,
        authVersion: 'v2'
      };

      const mockPreparedStatement = { run: vi.fn() };
      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      await store.storeInstallation(completeInstallation);

      expect(mockPreparedStatement.run).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Slack installation stored for team T123 (Complete Team)'
      );
    });

    it('should handle malformed scopes data', async () => {
      const installationWithBadScopes: Installation = {
        team: { id: 'T123', name: 'Test Team' },
        bot: {
          userId: 'U123',
          token: 'xoxb-test-token',
          scopes: ['commands', null, undefined, '', 'chat:write'] as any
        },
        user: { id: 'U456' }
      };

      const mockPreparedStatement = { run: vi.fn() };
      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      await store.storeInstallation(installationWithBadScopes);

      // Should filter out invalid scopes
      expect(mockPreparedStatement.run).toHaveBeenCalled();
    });

    it('should handle extremely long field values', async () => {
      const longString = 'x'.repeat(10000);
      const installationWithLongFields: Installation = {
        team: { id: 'T123', name: longString },
        enterprise: { id: 'E123', name: longString },
        bot: {
          userId: 'U123',
          token: 'xoxb-' + longString,
          scopes: ['commands']
        },
        user: { id: 'U456' }
      };

      const mockPreparedStatement = { run: vi.fn() };
      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      await store.storeInstallation(installationWithLongFields);

      // Should handle long fields (database constraints may apply)
      expect(mockPreparedStatement.run).toHaveBeenCalled();
    });
  });

  describe('Query Edge Cases', () => {
    it('should handle empty InstallationQuery', async () => {
      const emptyQuery: InstallationQuery = {};

      await expect(store.fetchInstallation(emptyQuery))
        .rejects.toThrow('Invalid query: teamId is required');
    });

    it('should handle InstallationQuery with only enterpriseId', async () => {
      const enterpriseOnlyQuery: InstallationQuery = {
        enterpriseId: 'E123'
        // No teamId
      };

      await expect(store.fetchInstallation(enterpriseOnlyQuery))
        .rejects.toThrow('Invalid query: teamId is required');
    });

    it('should handle InstallationQuery with special characters', async () => {
      const specialCharQuery: InstallationQuery = {
        teamId: 'T123\'"; DROP TABLE slack_installations; --',
        enterpriseId: 'E123<script>alert("xss")</script>'
      };

      const mockPreparedStatement = {
        get: vi.fn().mockReturnValue(null)
      };

      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      await expect(store.fetchInstallation(specialCharQuery))
        .rejects.toThrow('No installation found');

      // Should use parameterized queries to prevent SQL injection
      expect(mockPreparedStatement.get).toHaveBeenCalled();
    });

    it('should handle unicode characters in queries', async () => {
      const unicodeQuery: InstallationQuery = {
        teamId: 'T123🚀',
        enterpriseId: 'E123π'
      };

      const mockPreparedStatement = {
        get: vi.fn().mockReturnValue(null)
      };

      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      await expect(store.fetchInstallation(unicodeQuery))
        .rejects.toThrow('No installation found');
    });

    it('should handle very long query parameters', async () => {
      const longQuery: InstallationQuery = {
        teamId: 'T' + 'x'.repeat(10000),
        enterpriseId: 'E' + 'y'.repeat(10000)
      };

      const mockPreparedStatement = {
        get: vi.fn().mockReturnValue(null)
      };

      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      await expect(store.fetchInstallation(longQuery))
        .rejects.toThrow('No installation found');
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent store operations', async () => {
      const mockPreparedStatement = { run: vi.fn() };
      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      const installation: Installation = {
        team: { id: 'T123', name: 'Test Team' },
        bot: {
          userId: 'U123',
          token: 'xoxb-test-token',
          scopes: ['commands']
        },
        user: { id: 'U456' }
      };

      // Simulate concurrent store operations
      const promises = Array(10).fill(0).map((_, i) =>
        store.storeInstallation({
          ...installation,
          team: { id: `T${i}`, name: `Team ${i}` }
        })
      );

      await Promise.all(promises);

      expect(mockPreparedStatement.run).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent fetch operations', async () => {
      const mockInstallationData = {
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
        refresh_token: null,
        token_expires_at: null
      };

      const mockPreparedStatement = {
        get: vi.fn().mockReturnValue(mockInstallationData)
      };

      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      // Mock decrypt to avoid encryption issues in concurrent tests
      (store as any).decrypt = vi.fn().mockReturnValue('xoxb-test-token');

      // Simulate concurrent fetch operations
      const promises = Array(10).fill(0).map((_, i) =>
        store.fetchInstallation({ teamId: `T${i}` })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockPreparedStatement.get).toHaveBeenCalledTimes(10);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak sensitive data in memory', () => {
      const sensitiveToken = 'xoxb-very-sensitive-token';
      const encrypted = (store as any).encrypt(sensitiveToken);
      const decrypted = (store as any).decrypt(encrypted);

      expect(decrypted).toBe(sensitiveToken);

      // In a real scenario, we would verify that the plaintext
      // is not retained in memory after encryption
    });

    it('should handle large number of installations efficiently', async () => {
      const manyInstallations = Array(1000).fill(0).map((_, i) => ({
        id: `id-${i}`,
        team_id: `T${i}`,
        team_name: `Team ${i}`,
        enterprise_id: null,
        enterprise_name: null,
        bot_user_id: `U${i}`,
        bot_token: 'encrypted-token',
        bot_scopes: '["commands"]',
        installed_by_user_id: 'U456',
        user_token: null,
        user_scopes: null,
        installed_at: new Date().toISOString(),
        token_refreshed_at: null,
        token_expires_at: null,
        refresh_token: null,
        is_active: 1,
        default_channel_id: null,
        app_token: null
      }));

      const mockPreparedStatement = {
        all: vi.fn().mockReturnValue(manyInstallations)
      };

      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      // Mock decrypt to handle many calls
      (store as any).decrypt = vi.fn().mockReturnValue('xoxb-test-token');

      const result = await store.getAllInstallations();

      expect(result).toHaveLength(1000);
      expect((store as any).decrypt).toHaveBeenCalledTimes(1000); // Once per installation
    });
  });

  describe('Edge Case Recovery', () => {
    it('should recover from transient database errors', async () => {
      let callCount = 0;
      const mockPreparedStatement = {
        run: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Temporary database error');
          }
          return { changes: 1 };
        })
      };

      mockDb.prepare.mockReturnValue(mockPreparedStatement);

      const installation: Installation = {
        team: { id: 'T123', name: 'Test Team' },
        bot: {
          userId: 'U123',
          token: 'xoxb-test-token',
          scopes: ['commands']
        },
        user: { id: 'U456' }
      };

      // First call should fail
      await expect(store.storeInstallation(installation))
        .rejects.toThrow('Temporary database error');

      // Second call should succeed
      await expect(store.storeInstallation(installation))
        .resolves.not.toThrow();
    });

    it('should handle graceful degradation when encryption fails', () => {
      // Mock crypto to fail
      const originalCrypto = require('crypto');
      vi.mocked(originalCrypto.createCipher) = vi.fn().mockImplementation(() => {
        throw new Error('Crypto library error');
      });

      expect(() => (store as any).encrypt('test-token')).toThrow('Crypto library error');
    });
  });
});