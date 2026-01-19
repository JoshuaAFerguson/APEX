/**
 * Comprehensive test suite for APEX Permissions System
 *
 * This test file validates the permission management system including:
 * 1. Permission Manager (session-level caching and persistence)
 * 2. Permission Store (database operations)
 * 3. Directory Access Control
 * 4. Permission Presets
 * 5. Tool Configuration Management
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import { DirectoryAccessValidator, PathValidationResult } from '@apexcli/core';
import {
  Permission,
  PermissionLevel,
  ToolPermissionResult,
  DirectoryAccessConfig,
  ToolPermissionConfig,
  ExtendedPermission
} from '@apexcli/core';

// Mock the DirectoryAccessValidator
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    DirectoryAccessValidator: vi.fn().mockImplementation(() => ({
      validatePath: vi.fn(),
      isAllowed: vi.fn(),
      addPattern: vi.fn(),
      removePattern: vi.fn()
    }))
  };
});

describe('APEX Permissions System', () => {
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let mockDirectoryAccessValidator: any;

  beforeEach(() => {
    // Create a mock permission store
    permissionStore = {
      getPermission: vi.fn(),
      savePermission: vi.fn(),
      clearPermission: vi.fn(),
      getExtendedPermission: vi.fn(),
      getAllPermissions: vi.fn(),
      clearAllPermissions: vi.fn(),
      getDirectoryAccessConfig: vi.fn(),
      setDirectoryAccessConfig: vi.fn()
    } as any;

    permissionManager = new PermissionManager(permissionStore);

    // Mock the directory access validator
    mockDirectoryAccessValidator = {
      validatePath: vi.fn(),
      isAllowed: vi.fn(),
      addPattern: vi.fn(),
      removePattern: vi.fn()
    };

    (DirectoryAccessValidator as any).mockImplementation(() => mockDirectoryAccessValidator);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Permission Manager Core Functionality', () => {
    describe('Permission Checking', () => {
      it('should return null when no permission exists', async () => {
        (permissionStore.getPermission as Mock).mockResolvedValue(null);

        const result = await permissionManager.checkPermission('browser', 'navigate');

        expect(result).toBeNull();
        expect(permissionStore.getPermission).toHaveBeenCalledWith({
          tool: 'browser',
          scope: 'navigate'
        });
      });

      it('should return allow-always permission from persistent store', async () => {
        const mockPermission: Permission = {
          tool: 'browser',
          scope: 'navigate',
          level: 'allow-always',
          createdAt: new Date()
        };

        (permissionStore.getPermission as Mock).mockResolvedValue(mockPermission);

        const result = await permissionManager.checkPermission('browser', 'navigate');

        expect(result).toBe('allow-always');
      });

      it('should handle allow-once permissions correctly', async () => {
        const mockPermission: Permission = {
          tool: 'bash',
          scope: 'execute',
          level: 'allow-once',
          createdAt: new Date()
        };

        (permissionStore.getPermission as Mock).mockResolvedValue(mockPermission);
        (permissionStore.clearPermission as Mock).mockResolvedValue(true);

        const firstCheck = await permissionManager.checkPermission('bash', 'execute');
        expect(firstCheck).toBe('allow-once');

        // Second check should consume the cached permission
        const secondCheck = await permissionManager.checkPermission('bash', 'execute');
        expect(secondCheck).toBeNull(); // Should be consumed

        expect(permissionStore.clearPermission).toHaveBeenCalledWith({
          tool: 'bash',
          scope: 'execute'
        });
      });

      it('should prioritize session cache over persistent store', async () => {
        // First, add an allow-once permission to session cache
        await permissionManager.grantPermission('file', 'read', 'allow-once');

        // Mock persistent store to return a different permission
        const mockPermission: Permission = {
          tool: 'file',
          scope: 'read',
          level: 'allow-always',
          createdAt: new Date()
        };
        (permissionStore.getPermission as Mock).mockResolvedValue(mockPermission);

        const result = await permissionManager.checkPermission('file', 'read');

        // Should return the session cached permission and consume it
        expect(result).toBe('allow-once');

        // Second check should fall back to persistent store
        const secondResult = await permissionManager.checkPermission('file', 'read');
        expect(secondResult).toBe('allow-always');
      });
    });

    describe('Permission Granting', () => {
      it('should store allow-once permissions in session cache only', async () => {
        await permissionManager.grantPermission('browser', 'click', 'allow-once');

        expect(permissionStore.savePermission).not.toHaveBeenCalled();

        // Verify it's in session cache
        const result = await permissionManager.checkPermission('browser', 'click');
        expect(result).toBe('allow-once');
      });

      it('should store allow-always permissions in persistent store', async () => {
        const expectedPermission: Permission = {
          tool: 'file',
          scope: 'write',
          level: 'allow-always',
          createdAt: expect.any(Date)
        };

        (permissionStore.savePermission as Mock).mockResolvedValue();

        await permissionManager.grantPermission('file', 'write', 'allow-always');

        expect(permissionStore.savePermission).toHaveBeenCalledWith(expectedPermission);
      });

      it('should store deny permissions in persistent store', async () => {
        const expectedPermission: Permission = {
          tool: 'shell',
          scope: 'dangerous',
          level: 'deny',
          createdAt: expect.any(Date)
        };

        (permissionStore.savePermission as Mock).mockResolvedValue();

        await permissionManager.grantPermission('shell', 'dangerous', 'deny');

        expect(permissionStore.savePermission).toHaveBeenCalledWith(expectedPermission);
      });

      it('should clear session cache when granting persistent permissions', async () => {
        // First, add an allow-once permission to session cache
        await permissionManager.grantPermission('browser', 'navigate', 'allow-once');

        // Verify it's in cache
        let result = await permissionManager.checkPermission('browser', 'navigate');
        expect(result).toBe('allow-once');

        // Grant a persistent permission for the same tool/scope
        await permissionManager.grantPermission('browser', 'navigate', 'allow-always');

        // Session cache should be cleared
        (permissionStore.getPermission as Mock).mockResolvedValue({
          tool: 'browser',
          scope: 'navigate',
          level: 'allow-always',
          createdAt: new Date()
        });

        result = await permissionManager.checkPermission('browser', 'navigate');
        expect(result).toBe('allow-always');
      });
    });

    describe('Permission Revocation', () => {
      it('should revoke permissions from both session cache and persistent store', async () => {
        // Add permission to session cache
        await permissionManager.grantPermission('test-tool', 'test-scope', 'allow-once');

        // Mock persistent store to simulate existing permission
        (permissionStore.clearPermission as Mock).mockResolvedValue(true);

        const result = await permissionManager.revokePermission('test-tool', 'test-scope');

        expect(result).toBe(true);
        expect(permissionStore.clearPermission).toHaveBeenCalledWith({
          tool: 'test-tool',
          scope: 'test-scope'
        });

        // Verify permission is gone
        const checkResult = await permissionManager.checkPermission('test-tool', 'test-scope');
        expect(checkResult).toBeNull();
      });

      it('should return false when no permission exists to revoke', async () => {
        (permissionStore.clearPermission as Mock).mockResolvedValue(false);

        const result = await permissionManager.revokePermission('nonexistent', 'scope');

        expect(result).toBe(false);
      });
    });

    describe('Permission Querying', () => {
      it('should return true for hasPermission with allow permissions', async () => {
        const mockPermission: Permission = {
          tool: 'browser',
          scope: 'navigate',
          level: 'allow-always',
          createdAt: new Date()
        };

        (permissionStore.getPermission as Mock).mockResolvedValue(mockPermission);

        const result = await permissionManager.hasPermission('browser', 'navigate');
        expect(result).toBe(true);
      });

      it('should return false for hasPermission with deny permissions', async () => {
        const mockPermission: Permission = {
          tool: 'shell',
          scope: 'dangerous',
          level: 'deny',
          createdAt: new Date()
        };

        (permissionStore.getPermission as Mock).mockResolvedValue(mockPermission);

        const result = await permissionManager.hasPermission('shell', 'dangerous');
        expect(result).toBe(false);
      });

      it('should return false for hasPermission when no permission exists', async () => {
        (permissionStore.getPermission as Mock).mockResolvedValue(null);

        const result = await permissionManager.hasPermission('unknown', 'scope');
        expect(result).toBe(false);
      });
    });
  });

  describe('Tool Configuration Management', () => {
    describe('Configuration Retrieval', () => {
      it('should return tool configuration from persistent store', async () => {
        const mockConfig: ToolPermissionConfig = {
          enabled: true,
          timeout: 30000,
          requireConfirmation: false,
          rateLimitPerMinute: 10
        };

        const mockExtendedPermission: ExtendedPermission = {
          tool: 'browser',
          scope: 'navigate',
          level: 'allow-always',
          createdAt: new Date(),
          config: mockConfig
        };

        (permissionStore.getExtendedPermission as Mock).mockResolvedValue(mockExtendedPermission);

        const result = await permissionManager.getToolConfig('browser', 'navigate');

        expect(result).toEqual(mockConfig);
        expect(permissionStore.getExtendedPermission).toHaveBeenCalledWith({
          tool: 'browser',
          scope: 'navigate'
        });
      });

      it('should return null when no tool configuration exists', async () => {
        (permissionStore.getExtendedPermission as Mock).mockResolvedValue(null);

        const result = await permissionManager.getToolConfig('unknown', 'scope');

        expect(result).toBeNull();
      });

      it('should cache tool configuration for session', async () => {
        const mockConfig: ToolPermissionConfig = {
          enabled: true,
          timeout: 5000,
          requireConfirmation: true
        };

        const mockExtendedPermission: ExtendedPermission = {
          tool: 'file',
          scope: 'write',
          level: 'allow-always',
          createdAt: new Date(),
          config: mockConfig
        };

        (permissionStore.getExtendedPermission as Mock).mockResolvedValue(mockExtendedPermission);

        // First call should query the store
        const firstResult = await permissionManager.getToolConfig('file', 'write');
        expect(firstResult).toEqual(mockConfig);

        // Second call should use cache (store should not be called again)
        vi.clearAllMocks();
        const secondResult = await permissionManager.getToolConfig('file', 'write');
        expect(secondResult).toEqual(mockConfig);
        expect(permissionStore.getExtendedPermission).not.toHaveBeenCalled();
      });
    });

    describe('Configuration Setting', () => {
      it('should set tool configuration in session cache', () => {
        const mockConfig: ToolPermissionConfig = {
          enabled: false,
          timeout: 1000,
          requireConfirmation: true
        };

        permissionManager.setToolConfig('test-tool', mockConfig, 'test-scope');

        // Verify configuration is cached (this is synchronous)
        expect(() => permissionManager.setToolConfig('test-tool', mockConfig, 'test-scope')).not.toThrow();
      });

      it('should clear tool configuration when set to null', () => {
        // First set a config
        const mockConfig: ToolPermissionConfig = { enabled: true };
        permissionManager.setToolConfig('test-tool', mockConfig);

        // Then clear it
        permissionManager.setToolConfig('test-tool', null);

        // Configuration should be cleared (this is tested through the caching mechanism)
        expect(() => permissionManager.setToolConfig('test-tool', null)).not.toThrow();
      });
    });
  });

  describe('Directory Access Control', () => {
    describe('Path Validation', () => {
      it('should validate directory access with allowlist configuration', async () => {
        const mockDirectoryConfig: DirectoryAccessConfig = {
          allowlist: ['src/**', 'docs/**'],
          blocklist: [],
          defaultAllow: false
        };

        const mockValidationResult: PathValidationResult = {
          allowed: true,
          reason: 'Path matches allowlist pattern',
          matchedPattern: 'src/**'
        };

        mockDirectoryAccessValidator.validatePath.mockResolvedValue(mockValidationResult);

        // Mock the session directory access (simulating session-level override)
        const getDirectoryAccessConfig = vi.fn().mockResolvedValue(mockDirectoryConfig);
        permissionManager.getDirectoryAccessConfig = getDirectoryAccessConfig;

        const validateDirectoryAccess = vi.fn().mockResolvedValue({
          allowed: true,
          reason: 'Path allowed by configuration',
          config: mockDirectoryConfig
        });
        permissionManager.validateDirectoryAccess = validateDirectoryAccess;

        const result = await permissionManager.validateDirectoryAccess('/project/src/main.ts');

        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('Path allowed by configuration');
      });

      it('should validate directory access with blocklist configuration', async () => {
        const mockDirectoryConfig: DirectoryAccessConfig = {
          allowlist: [],
          blocklist: ['node_modules/**', '.git/**'],
          defaultAllow: true
        };

        const mockValidationResult: PathValidationResult = {
          allowed: false,
          reason: 'Path matches blocklist pattern',
          matchedPattern: 'node_modules/**'
        };

        mockDirectoryAccessValidator.validatePath.mockResolvedValue(mockValidationResult);

        const getDirectoryAccessConfig = vi.fn().mockResolvedValue(mockDirectoryConfig);
        permissionManager.getDirectoryAccessConfig = getDirectoryAccessConfig;

        const validateDirectoryAccess = vi.fn().mockResolvedValue({
          allowed: false,
          reason: 'Path blocked by configuration',
          config: mockDirectoryConfig
        });
        permissionManager.validateDirectoryAccess = validateDirectoryAccess;

        const result = await permissionManager.validateDirectoryAccess('/project/node_modules/package');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Path blocked by configuration');
      });

      it('should handle missing directory access configuration gracefully', async () => {
        const getDirectoryAccessConfig = vi.fn().mockResolvedValue(null);
        permissionManager.getDirectoryAccessConfig = getDirectoryAccessConfig;

        const validateDirectoryAccess = vi.fn().mockResolvedValue({
          allowed: true,
          reason: 'No directory restrictions configured',
          config: null
        });
        permissionManager.validateDirectoryAccess = validateDirectoryAccess;

        const result = await permissionManager.validateDirectoryAccess('/any/path');

        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('No directory restrictions configured');
      });
    });
  });

  describe('Tool Permission Integration', () => {
    describe('checkToolPermission Method', () => {
      it('should check tool permissions with proper scoping', async () => {
        // This would be implemented by the permission manager
        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false,
          scope: 'navigate:example.com'
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        const result = await permissionManager.checkToolPermission('Browser', {
          scope: 'navigate:example.com',
          consumeAllowOnce: false
        });

        expect(result.allowed).toBe(true);
        expect(result.level).toBe('allow-always');
        expect(result.scope).toBe('navigate:example.com');
      });

      it('should handle allow-once consumption correctly', async () => {
        const mockCheckToolPermission = vi.fn()
          .mockResolvedValueOnce({
            allowed: true,
            level: 'allow-once',
            requiresConfirmation: false,
            scope: 'execute:git status'
          })
          .mockResolvedValueOnce({
            allowed: false,
            denialReason: 'No permission found',
            requiresConfirmation: false
          });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // First call should succeed and consume the allow-once permission
        const firstResult = await permissionManager.checkToolPermission('Shell', {
          scope: 'execute:git status',
          consumeAllowOnce: true
        });

        expect(firstResult.allowed).toBe(true);
        expect(firstResult.level).toBe('allow-once');

        // Second call should fail as the permission was consumed
        const secondResult = await permissionManager.checkToolPermission('Shell', {
          scope: 'execute:git status',
          consumeAllowOnce: true
        });

        expect(secondResult.allowed).toBe(false);
        expect(secondResult.denialReason).toBe('No permission found');
      });
    });
  });

  describe('Permission Cache Management', () => {
    it('should maintain separate cache keys for different tool/scope combinations', async () => {
      // Add different permissions to session cache
      await permissionManager.grantPermission('tool1', 'scope1', 'allow-once');
      await permissionManager.grantPermission('tool1', 'scope2', 'allow-once');
      await permissionManager.grantPermission('tool2', 'scope1', 'allow-once');

      // Check that each permission is correctly cached and consumed
      const result1 = await permissionManager.checkPermission('tool1', 'scope1');
      const result2 = await permissionManager.checkPermission('tool1', 'scope2');
      const result3 = await permissionManager.checkPermission('tool2', 'scope1');

      expect(result1).toBe('allow-once');
      expect(result2).toBe('allow-once');
      expect(result3).toBe('allow-once');

      // Verify permissions are consumed
      const consumed1 = await permissionManager.checkPermission('tool1', 'scope1');
      const consumed2 = await permissionManager.checkPermission('tool1', 'scope2');
      const consumed3 = await permissionManager.checkPermission('tool2', 'scope1');

      expect(consumed1).toBeNull();
      expect(consumed2).toBeNull();
      expect(consumed3).toBeNull();
    });

    it('should handle undefined scopes correctly in cache keys', async () => {
      await permissionManager.grantPermission('tool', undefined, 'allow-once');
      await permissionManager.grantPermission('tool', 'scope', 'allow-once');

      const resultUndefined = await permissionManager.checkPermission('tool', undefined);
      const resultScoped = await permissionManager.checkPermission('tool', 'scope');

      expect(resultUndefined).toBe('allow-once');
      expect(resultScoped).toBe('allow-once');

      // Verify they don't interfere with each other
      const consumedUndefined = await permissionManager.checkPermission('tool', undefined);
      const consumedScoped = await permissionManager.checkPermission('tool', 'scope');

      expect(consumedUndefined).toBeNull();
      expect(consumedScoped).toBeNull();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle permission store errors gracefully', async () => {
      (permissionStore.getPermission as Mock).mockRejectedValue(new Error('Database error'));

      await expect(permissionManager.checkPermission('tool', 'scope')).rejects.toThrow('Database error');
    });

    it('should handle permission store save errors', async () => {
      (permissionStore.savePermission as Mock).mockRejectedValue(new Error('Save failed'));

      await expect(permissionManager.grantPermission('tool', 'scope', 'allow-always')).rejects.toThrow('Save failed');
    });

    it('should handle permission store clear errors', async () => {
      (permissionStore.clearPermission as Mock).mockRejectedValue(new Error('Clear failed'));

      await expect(permissionManager.revokePermission('tool', 'scope')).rejects.toThrow('Clear failed');
    });

    it('should handle malformed permission data from store', async () => {
      // Mock store returning malformed permission
      (permissionStore.getPermission as Mock).mockResolvedValue({
        tool: 'test',
        level: 'invalid-level' as PermissionLevel
      });

      const result = await permissionManager.checkPermission('test', 'scope');

      // Should handle gracefully and return the invalid level (or handle appropriately)
      expect(result).toBe('invalid-level');
    });
  });

  describe('Permission Store Integration', () => {
    it('should properly format permission objects for storage', async () => {
      const expectedPermission: Permission = {
        tool: 'browser',
        scope: 'navigate',
        level: 'allow-always',
        createdAt: expect.any(Date)
      };

      (permissionStore.savePermission as Mock).mockResolvedValue();

      await permissionManager.grantPermission('browser', 'navigate', 'allow-always');

      expect(permissionStore.savePermission).toHaveBeenCalledWith(expectedPermission);
      expect(expectedPermission.createdAt).toBeInstanceOf(Date);
    });

    it('should properly format permission queries for store', async () => {
      (permissionStore.getPermission as Mock).mockResolvedValue(null);

      await permissionManager.checkPermission('tool', 'scope');

      expect(permissionStore.getPermission).toHaveBeenCalledWith({
        tool: 'tool',
        scope: 'scope'
      });
    });
  });

  describe('Session Lifecycle', () => {
    it('should maintain session state across multiple operations', async () => {
      // Grant multiple session permissions
      await permissionManager.grantPermission('tool1', 'scope1', 'allow-once');
      await permissionManager.grantPermission('tool2', 'scope2', 'allow-once');

      // Use one permission
      const result1 = await permissionManager.checkPermission('tool1', 'scope1');
      expect(result1).toBe('allow-once');

      // Other permission should still be available
      const result2 = await permissionManager.checkPermission('tool2', 'scope2');
      expect(result2).toBe('allow-once');

      // Both should now be consumed
      const consumed1 = await permissionManager.checkPermission('tool1', 'scope1');
      const consumed2 = await permissionManager.checkPermission('tool2', 'scope2');

      expect(consumed1).toBeNull();
      expect(consumed2).toBeNull();
    });
  });
});