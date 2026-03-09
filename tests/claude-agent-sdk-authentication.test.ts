/**
 * Claude Agent SDK Authentication Tests
 *
 * Focused tests for authentication and credential management components
 * of the Claude Agent SDK integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CredentialManager, type Credentials } from '../packages/orchestrator/src/auth/credential-manager.js';
import { AnthropicDriver } from '../packages/orchestrator/src/drivers/anthropic-driver.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Claude Agent SDK Authentication', () => {
  let credentialManager: CredentialManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-auth-test-'));
    credentialManager = new CredentialManager(tempDir);
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    vi.clearAllMocks();
  });

  describe('CredentialManager Security', () => {
    it('should create config directory if it does not exist', () => {
      const newTempDir = path.join(tempDir, 'new-config');
      const manager = new CredentialManager(newTempDir);

      expect(fs.existsSync(newTempDir)).toBe(true);
    });

    it('should set secure file permissions on credential files', async () => {
      const testCreds: Credentials = {
        accessToken: 'sk-ant-test-token',
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('anthropic', testCreds);

      const credentialsPath = path.join(tempDir, 'credentials.json');
      const stats = fs.statSync(credentialsPath);
      const mode = stats.mode & parseInt('777', 8);

      // Should be readable/writable only by owner (0o600)
      expect(mode).toBe(parseInt('600', 8));
    });

    it('should store multiple provider credentials', async () => {
      const anthropicCreds: Credentials = {
        accessToken: 'sk-ant-test',
        provider: 'anthropic',
      };

      const openaiCreds: Credentials = {
        accessToken: 'sk-openai-test',
        provider: 'openai',
      };

      await credentialManager.saveCredentials('anthropic', anthropicCreds);
      await credentialManager.saveCredentials('openai', openaiCreds);

      const retrievedAnthropic = await credentialManager.getCredentials('anthropic');
      const retrievedOpenai = await credentialManager.getCredentials('openai');

      expect(retrievedAnthropic).toEqual(anthropicCreds);
      expect(retrievedOpenai).toEqual(openaiCreds);
    });

    it('should handle credential expiration timestamps', async () => {
      const now = Date.now();
      const testCreds: Credentials = {
        accessToken: 'sk-ant-test',
        refreshToken: 'refresh-token',
        expiresAt: now + 3600000, // 1 hour from now
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('anthropic', testCreds);
      const retrieved = await credentialManager.getCredentials('anthropic');

      expect(retrieved?.expiresAt).toBe(now + 3600000);
    });

    it('should preserve existing credentials when adding new ones', async () => {
      const anthropicCreds: Credentials = {
        accessToken: 'sk-ant-test',
        provider: 'anthropic',
      };

      const openaiCreds: Credentials = {
        accessToken: 'sk-openai-test',
        provider: 'openai',
      };

      await credentialManager.saveCredentials('anthropic', anthropicCreds);
      await credentialManager.saveCredentials('openai', openaiCreds);

      // Verify both still exist
      const retrievedAnthropic = await credentialManager.getCredentials('anthropic');
      const retrievedOpenai = await credentialManager.getCredentials('openai');

      expect(retrievedAnthropic).toEqual(anthropicCreds);
      expect(retrievedOpenai).toEqual(openaiCreds);
    });

    it('should update existing credentials when saving same provider', async () => {
      const originalCreds: Credentials = {
        accessToken: 'sk-ant-old',
        provider: 'anthropic',
      };

      const updatedCreds: Credentials = {
        accessToken: 'sk-ant-new',
        refreshToken: 'refresh-new',
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('anthropic', originalCreds);
      await credentialManager.saveCredentials('anthropic', updatedCreds);

      const retrieved = await credentialManager.getCredentials('anthropic');
      expect(retrieved).toEqual(updatedCreds);
    });

    it('should handle deletion of non-existent credentials', async () => {
      await expect(
        credentialManager.deleteCredentials('nonexistent')
      ).resolves.not.toThrow();
    });

    it('should handle corrupted credentials file gracefully', async () => {
      const credentialsPath = path.join(tempDir, 'credentials.json');

      // Create corrupted file
      fs.writeFileSync(credentialsPath, '{ invalid json }');

      const retrieved = await credentialManager.getCredentials('anthropic');
      expect(retrieved).toBeNull();
    });

    it('should handle empty credentials file', async () => {
      const credentialsPath = path.join(tempDir, 'credentials.json');

      // Create empty file
      fs.writeFileSync(credentialsPath, '');

      const retrieved = await credentialManager.getCredentials('anthropic');
      expect(retrieved).toBeNull();
    });
  });

  describe('AnthropicDriver Authentication Integration', () => {
    it('should set environment variable when credentials exist', async () => {
      const testCreds: Credentials = {
        accessToken: 'sk-ant-api-key-test',
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('anthropic', testCreds);

      const driver = new AnthropicDriver();
      await driver.initialize();

      expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-api-key-test');

      await driver.dispose();
    });

    it('should not set environment variable when no credentials exist', async () => {
      const driver = new AnthropicDriver();
      await driver.initialize();

      expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();

      await driver.dispose();
    });

    it('should not set environment variable when credentials have no access token', async () => {
      const testCreds: Credentials = {
        accessToken: '',
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('anthropic', testCreds);

      const driver = new AnthropicDriver();
      await driver.initialize();

      expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();

      await driver.dispose();
    });

    it('should provide authentication guidance', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const driver = new AnthropicDriver();
      await driver.authenticate();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Please run "apex auth login anthropic" to authenticate.'
      );

      consoleSpy.mockRestore();
      await driver.dispose();
    });

    it('should handle initialize call multiple times safely', async () => {
      const testCreds: Credentials = {
        accessToken: 'sk-ant-test',
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('anthropic', testCreds);

      const driver = new AnthropicDriver();

      await driver.initialize();
      expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-test');

      await driver.initialize();
      expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-test');

      await driver.dispose();
    });
  });

  describe('Credential Validation', () => {
    it('should validate credential format', async () => {
      // Test various valid token formats
      const validTokens = [
        'sk-ant-api03-1234567890abcdef',
        'sk-ant-test-token',
        'sk-ant-prod-very-long-token-with-many-characters',
      ];

      for (const token of validTokens) {
        const creds: Credentials = {
          accessToken: token,
          provider: 'anthropic',
        };

        await credentialManager.saveCredentials('test', creds);
        const retrieved = await credentialManager.getCredentials('test');

        expect(retrieved?.accessToken).toBe(token);
      }
    });

    it('should handle edge cases in credential data', async () => {
      const edgeCaseCreds: Credentials = {
        accessToken: 'token-with-special-chars!@#$%^&*()',
        refreshToken: '',
        expiresAt: 0,
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('edge-case', edgeCaseCreds);
      const retrieved = await credentialManager.getCredentials('edge-case');

      expect(retrieved).toEqual(edgeCaseCreds);
    });
  });

  describe('Error Handling in Authentication', () => {
    it('should handle permission errors when creating config directory', () => {
      // Mock fs.mkdirSync to throw permission error
      const originalMkdirSync = fs.mkdirSync;
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      expect(() => {
        new CredentialManager('/root/.apex'); // Likely to cause permission error
      }).toThrow('EACCES: permission denied');

      // Restore original function
      fs.mkdirSync = originalMkdirSync;
    });

    it('should handle file system errors when saving credentials', async () => {
      // Mock writeFileSync to throw error
      const originalWriteFileSync = fs.writeFileSync;
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      const testCreds: Credentials = {
        accessToken: 'sk-ant-test',
        provider: 'anthropic',
      };

      await expect(
        credentialManager.saveCredentials('anthropic', testCreds)
      ).rejects.toThrow('ENOSPC: no space left on device');

      // Restore original function
      fs.writeFileSync = originalWriteFileSync;
    });

    it('should handle file system errors when reading credentials', async () => {
      // Create valid credentials first
      const testCreds: Credentials = {
        accessToken: 'sk-ant-test',
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('anthropic', testCreds);

      // Mock readFileSync to throw error
      const originalReadFileSync = fs.readFileSync;
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const retrieved = await credentialManager.getCredentials('anthropic');
      expect(retrieved).toBeNull();

      // Restore original function
      fs.readFileSync = originalReadFileSync;
    });
  });

  describe('Integration with Multiple Drivers', () => {
    it('should support different providers without interference', async () => {
      const anthropicCreds: Credentials = {
        accessToken: 'sk-ant-anthropic',
        provider: 'anthropic',
      };

      const openaiCreds: Credentials = {
        accessToken: 'sk-openai-test',
        provider: 'openai',
      };

      const googleCreds: Credentials = {
        accessToken: 'google-api-key',
        provider: 'google',
      };

      await credentialManager.saveCredentials('anthropic', anthropicCreds);
      await credentialManager.saveCredentials('openai', openaiCreds);
      await credentialManager.saveCredentials('google', googleCreds);

      const anthropicDriver = new AnthropicDriver();
      await anthropicDriver.initialize();

      expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-anthropic');
      // Other provider keys should not be set by AnthropicDriver
      expect(process.env.OPENAI_API_KEY).toBeUndefined();
      expect(process.env.GOOGLE_API_KEY).toBeUndefined();

      await anthropicDriver.dispose();
    });
  });
});