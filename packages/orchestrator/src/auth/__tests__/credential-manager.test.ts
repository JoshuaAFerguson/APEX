/**
 * Unit tests for CredentialManager
 *
 * Tests OAuth credential storage, retrieval, and security features including:
 * - Secure file permissions
 * - JSON parsing error handling
 * - Multi-provider credential management
 * - File system edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CredentialManager, type Credentials } from '../credential-manager.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('CredentialManager', () => {
  let tempDir: string;
  let credentialManager: CredentialManager;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = path.join(os.tmpdir(), `apex-creds-test-${Date.now()}-${Math.random()}`);
    credentialManager = new CredentialManager(tempDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor and initialization', () => {
    it('should create config directory if it does not exist', () => {
      expect(fs.existsSync(tempDir)).toBe(true);
      expect(fs.statSync(tempDir).isDirectory()).toBe(true);
    });

    it('should use default config directory when no custom path provided', () => {
      const defaultManager = new CredentialManager();
      // Should not throw and should work with default path
      expect(defaultManager).toBeInstanceOf(CredentialManager);
    });

    it('should create nested directories recursively', () => {
      const nestedPath = path.join(os.tmpdir(), `nested/deep/path-${Date.now()}`);
      const nestedManager = new CredentialManager(nestedPath);

      expect(fs.existsSync(nestedPath)).toBe(true);
      expect(fs.statSync(nestedPath).isDirectory()).toBe(true);

      // Cleanup
      fs.rmSync(path.join(os.tmpdir(), 'nested'), { recursive: true, force: true });
    });
  });

  describe('credential storage and retrieval', () => {
    it('should save and retrieve credentials for a provider', async () => {
      const testCreds: Credentials = {
        accessToken: 'sk-test-token-123',
        refreshToken: 'refresh-token-456',
        expiresAt: Date.now() + 3600000,
        provider: 'anthropic'
      };

      await credentialManager.saveCredentials('anthropic', testCreds);
      const retrieved = await credentialManager.getCredentials('anthropic');

      expect(retrieved).toEqual(testCreds);
    });

    it('should handle multiple providers independently', async () => {
      const anthropicCreds: Credentials = {
        accessToken: 'sk-ant-token',
        provider: 'anthropic',
        expiresAt: Date.now() + 3600000
      };

      const openaiCreds: Credentials = {
        accessToken: 'sk-openai-token',
        provider: 'openai',
        refreshToken: 'refresh-123'
      };

      await credentialManager.saveCredentials('anthropic', anthropicCreds);
      await credentialManager.saveCredentials('openai', openaiCreds);

      const retrievedAnthropic = await credentialManager.getCredentials('anthropic');
      const retrievedOpenai = await credentialManager.getCredentials('openai');

      expect(retrievedAnthropic).toEqual(anthropicCreds);
      expect(retrievedOpenai).toEqual(openaiCreds);
    });

    it('should return null for non-existent provider', async () => {
      const result = await credentialManager.getCredentials('nonexistent');
      expect(result).toBeNull();
    });

    it('should overwrite existing credentials for the same provider', async () => {
      const initialCreds: Credentials = {
        accessToken: 'initial-token',
        provider: 'test-provider'
      };

      const updatedCreds: Credentials = {
        accessToken: 'updated-token',
        refreshToken: 'new-refresh',
        provider: 'test-provider',
        expiresAt: Date.now() + 7200000
      };

      await credentialManager.saveCredentials('test-provider', initialCreds);
      await credentialManager.saveCredentials('test-provider', updatedCreds);

      const retrieved = await credentialManager.getCredentials('test-provider');
      expect(retrieved).toEqual(updatedCreds);
    });
  });

  describe('credential deletion', () => {
    it('should delete credentials for a specific provider', async () => {
      const testCreds: Credentials = {
        accessToken: 'delete-me',
        provider: 'delete-test'
      };

      await credentialManager.saveCredentials('delete-test', testCreds);

      // Verify it exists
      let retrieved = await credentialManager.getCredentials('delete-test');
      expect(retrieved).toEqual(testCreds);

      // Delete it
      await credentialManager.deleteCredentials('delete-test');

      // Verify it's gone
      retrieved = await credentialManager.getCredentials('delete-test');
      expect(retrieved).toBeNull();
    });

    it('should not affect other providers when deleting one', async () => {
      const creds1: Credentials = { accessToken: 'token1', provider: 'provider1' };
      const creds2: Credentials = { accessToken: 'token2', provider: 'provider2' };

      await credentialManager.saveCredentials('provider1', creds1);
      await credentialManager.saveCredentials('provider2', creds2);

      await credentialManager.deleteCredentials('provider1');

      const retrieved1 = await credentialManager.getCredentials('provider1');
      const retrieved2 = await credentialManager.getCredentials('provider2');

      expect(retrieved1).toBeNull();
      expect(retrieved2).toEqual(creds2);
    });

    it('should handle deleting non-existent provider gracefully', async () => {
      // Should not throw
      await credentialManager.deleteCredentials('nonexistent');

      // File should still not exist or be empty
      const result = await credentialManager.getCredentials('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('file system security and permissions', () => {
    it('should create credentials file with secure permissions (mode 0o600)', async () => {
      const testCreds: Credentials = {
        accessToken: 'permission-test',
        provider: 'security-test'
      };

      await credentialManager.saveCredentials('security-test', testCreds);

      const credentialsPath = path.join(tempDir, 'credentials.json');
      expect(fs.existsSync(credentialsPath)).toBe(true);

      // Check permissions (on Unix-like systems)
      if (process.platform !== 'win32') {
        const stats = fs.statSync(credentialsPath);
        const mode = stats.mode & parseInt('777', 8);
        expect(mode).toBe(parseInt('600', 8));
      }
    });

    it('should properly serialize credentials to JSON with formatting', async () => {
      const testCreds: Credentials = {
        accessToken: 'json-test',
        refreshToken: 'refresh-json',
        provider: 'json-provider',
        expiresAt: 1234567890
      };

      await credentialManager.saveCredentials('json-provider', testCreds);

      const credentialsPath = path.join(tempDir, 'credentials.json');
      const fileContent = fs.readFileSync(credentialsPath, 'utf8');

      // Should be pretty-printed JSON
      expect(fileContent).toContain('{\n  ');

      const parsed = JSON.parse(fileContent);
      expect(parsed['json-provider']).toEqual(testCreds);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle corrupted JSON file gracefully', async () => {
      // Create corrupted JSON file
      const credentialsPath = path.join(tempDir, 'credentials.json');
      fs.writeFileSync(credentialsPath, 'invalid json {[}');

      // Should not throw and should return null
      const result = await credentialManager.getCredentials('test');
      expect(result).toBeNull();
    });

    it('should handle empty JSON file gracefully', async () => {
      // Create empty file
      const credentialsPath = path.join(tempDir, 'credentials.json');
      fs.writeFileSync(credentialsPath, '');

      // Should not throw and should return null
      const result = await credentialManager.getCredentials('test');
      expect(result).toBeNull();
    });

    it('should handle file with invalid JSON structure', async () => {
      // Create file with valid JSON but unexpected structure
      const credentialsPath = path.join(tempDir, 'credentials.json');
      fs.writeFileSync(credentialsPath, '"string instead of object"');

      // Should not throw and should return null
      const result = await credentialManager.getCredentials('test');
      expect(result).toBeNull();
    });

    it('should recover from corrupted file by recreating valid structure', async () => {
      // Create corrupted file
      const credentialsPath = path.join(tempDir, 'credentials.json');
      fs.writeFileSync(credentialsPath, 'corrupted');

      // Try to save new credentials
      const testCreds: Credentials = {
        accessToken: 'recovery-test',
        provider: 'recovery'
      };

      await credentialManager.saveCredentials('recovery', testCreds);

      // Should successfully retrieve the new credentials
      const retrieved = await credentialManager.getCredentials('recovery');
      expect(retrieved).toEqual(testCreds);

      // File should now be valid JSON
      const fileContent = fs.readFileSync(credentialsPath, 'utf8');
      expect(() => JSON.parse(fileContent)).not.toThrow();
    });

    it('should handle file system permission errors', async () => {
      // This test may not work on all systems, but we can simulate
      if (process.platform !== 'win32') {
        // Make directory read-only
        fs.chmodSync(tempDir, 0o444);

        const testCreds: Credentials = {
          accessToken: 'permission-error-test',
          provider: 'error-test'
        };

        // Should throw due to permission error
        await expect(credentialManager.saveCredentials('error-test', testCreds))
          .rejects
          .toThrow();

        // Restore permissions for cleanup
        fs.chmodSync(tempDir, 0o755);
      }
    });
  });

  describe('credential validation and types', () => {
    it('should handle credentials with minimal required fields', async () => {
      const minimalCreds: Credentials = {
        accessToken: 'minimal-token',
        provider: 'minimal'
      };

      await credentialManager.saveCredentials('minimal', minimalCreds);
      const retrieved = await credentialManager.getCredentials('minimal');

      expect(retrieved).toEqual(minimalCreds);
      expect(retrieved?.refreshToken).toBeUndefined();
      expect(retrieved?.expiresAt).toBeUndefined();
    });

    it('should preserve all optional fields', async () => {
      const fullCreds: Credentials = {
        accessToken: 'full-token',
        refreshToken: 'full-refresh',
        expiresAt: 9999999999,
        provider: 'full-test'
      };

      await credentialManager.saveCredentials('full-test', fullCreds);
      const retrieved = await credentialManager.getCredentials('full-test');

      expect(retrieved).toEqual(fullCreds);
      expect(retrieved?.refreshToken).toBe('full-refresh');
      expect(retrieved?.expiresAt).toBe(9999999999);
    });

    it('should handle special characters in provider names', async () => {
      const specialProvider = 'provider-with-special_chars.123';
      const testCreds: Credentials = {
        accessToken: 'special-test',
        provider: specialProvider
      };

      await credentialManager.saveCredentials(specialProvider, testCreds);
      const retrieved = await credentialManager.getCredentials(specialProvider);

      expect(retrieved).toEqual(testCreds);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent read operations', async () => {
      const testCreds: Credentials = {
        accessToken: 'concurrent-test',
        provider: 'concurrent'
      };

      await credentialManager.saveCredentials('concurrent', testCreds);

      // Perform multiple concurrent reads
      const promises = Array.from({ length: 5 }, () =>
        credentialManager.getCredentials('concurrent')
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toEqual(testCreds);
      });
    });

    it('should handle concurrent write operations to different providers', async () => {
      const promises = Array.from({ length: 3 }, (_, i) => {
        const creds: Credentials = {
          accessToken: `token-${i}`,
          provider: `provider-${i}`
        };
        return credentialManager.saveCredentials(`provider-${i}`, creds);
      });

      await Promise.all(promises);

      // Verify all were saved correctly
      for (let i = 0; i < 3; i++) {
        const retrieved = await credentialManager.getCredentials(`provider-${i}`);
        expect(retrieved?.accessToken).toBe(`token-${i}`);
      }
    });
  });
});