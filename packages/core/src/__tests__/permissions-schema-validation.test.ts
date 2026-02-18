import { describe, it, expect } from 'vitest';
import {
  PermissionSchema,
  PermissionLevelSchema,
  PermissionQuerySchema,
  DirectoryAccessConfigSchema,
  BaseToolPermissionConfigSchema,
  FilesystemToolConfigSchema,
  ShellToolConfigSchema,
  WebToolConfigSchema,
  BrowserToolConfigSchema,
  PermissionPresetSchema,
  PermissionPresetConfigSchema,
} from '../types';

describe('Permission Schema Validation', () => {
  describe('PermissionSchema', () => {
    it('should validate a basic permission', () => {
      const permission = {
        tool: 'Read',
        level: 'allow-always' as const,
        createdAt: new Date(),
      };

      const result = PermissionSchema.safeParse(permission);
      expect(result.success).toBe(true);
    });

    it('should validate permission with optional scope', () => {
      const permission = {
        tool: 'Write',
        scope: '/tmp/test-file.txt',
        level: 'allow-once' as const,
        createdAt: new Date(),
      };

      const result = PermissionSchema.safeParse(permission);
      expect(result.success).toBe(true);
    });

    it('should validate permission with expiry', () => {
      const permission = {
        tool: 'Bash',
        scope: 'npm install',
        level: 'allow-always' as const,
        expiry: new Date(Date.now() + 86400000), // 24 hours from now
        createdAt: new Date(),
      };

      const result = PermissionSchema.safeParse(permission);
      expect(result.success).toBe(true);
    });

    it('should reject permission with empty tool name', () => {
      const permission = {
        tool: '',
        level: 'allow-always' as const,
        createdAt: new Date(),
      };

      const result = PermissionSchema.safeParse(permission);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Tool name is required');
    });

    it('should reject permission with invalid level', () => {
      const permission = {
        tool: 'Read',
        level: 'invalid-level',
        createdAt: new Date(),
      };

      const result = PermissionSchema.safeParse(permission);
      expect(result.success).toBe(false);
    });

    it('should reject permission without createdAt', () => {
      const permission = {
        tool: 'Read',
        level: 'allow-always' as const,
      };

      const result = PermissionSchema.safeParse(permission);
      expect(result.success).toBe(false);
    });
  });

  describe('PermissionLevelSchema', () => {
    it('should validate all permission levels', () => {
      const validLevels = ['allow-always', 'allow-once', 'deny'];

      validLevels.forEach(level => {
        const result = PermissionLevelSchema.safeParse(level);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid permission levels', () => {
      const invalidLevels = ['allow', 'never', 'always', 'once', ''];

      invalidLevels.forEach(level => {
        const result = PermissionLevelSchema.safeParse(level);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('DirectoryAccessConfigSchema', () => {
    it('should validate empty directory access config', () => {
      const config = {};

      const result = DirectoryAccessConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        allowlist: [],
        blocklist: [],
        resolveSymlinks: true,
        maxDepth: 0,
      });
    });

    it('should validate directory access config with patterns', () => {
      const config = {
        allowlist: ['/home/user/*', '/var/log/*.log'],
        blocklist: ['/tmp/*', '/etc/passwd'],
        defaultAllow: false,
        resolveSymlinks: false,
        maxDepth: 5,
      };

      const result = DirectoryAccessConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(config);
    });

    it('should reject negative maxDepth', () => {
      const config = {
        maxDepth: -1,
      };

      const result = DirectoryAccessConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('FilesystemToolConfigSchema', () => {
    it('should validate filesystem tool config', () => {
      const config = {
        enabled: true,
        timeout: 5000,
        requireConfirmation: false,
        rateLimitPerMinute: 100,
        directoryAccess: {
          allowlist: ['/home/user/*'],
          blocklist: ['/tmp/*'],
        },
        maxFileSize: 1048576, // 1MB
        allowedExtensions: ['.txt', '.md', '.json'],
        blockedExtensions: ['.exe', '.bat'],
      };

      const result = FilesystemToolConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should use defaults for missing properties', () => {
      const config = {};

      const result = FilesystemToolConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        enabled: true,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0,
        maxFileSize: 0,
        allowedExtensions: [],
        blockedExtensions: [],
      });
    });
  });

  describe('ShellToolConfigSchema', () => {
    it('should validate shell tool config', () => {
      const config = {
        enabled: true,
        timeout: 10000,
        requireConfirmation: true,
        directoryAccess: {
          allowlist: ['/home/user/*'],
        },
        blockedCommands: ['rm -rf /*', 'sudo.*', 'curl.*evil-site'],
        allowElevatedPrivileges: false,
        environment: {
          NODE_ENV: 'test',
          DEBUG: '1',
        },
        workingDirectory: '/home/user/project',
      };

      const result = ShellToolConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should use defaults for shell config', () => {
      const config = {};

      const result = ShellToolConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        enabled: true,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0,
        blockedCommands: [],
        allowElevatedPrivileges: false,
      });
    });
  });

  describe('WebToolConfigSchema', () => {
    it('should validate web tool config', () => {
      const config = {
        enabled: true,
        timeout: 30000,
        allowedDomains: ['example.com', 'api.github.com'],
        blockedDomains: ['evil-site.com'],
        maxResponseSize: 10485760, // 10MB
        followRedirects: false,
        headers: {
          'User-Agent': 'APEX/1.0',
          'Accept': 'application/json',
        },
      };

      const result = WebToolConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should use defaults for web config', () => {
      const config = {};

      const result = WebToolConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        enabled: true,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0,
        allowedDomains: [],
        blockedDomains: [],
        maxResponseSize: 0,
        followRedirects: true,
      });
    });
  });

  describe('BrowserToolConfigSchema', () => {
    it('should validate browser tool config', () => {
      const config = {
        enabled: true,
        allowedDomains: ['trusted-site.com'],
        blockedDomains: ['malicious-site.com'],
        allowJavaScriptExecution: false,
        allowFormSubmission: true,
        pageLoadTimeout: 30000,
        allowDownloads: false,
        allowScreenshots: true,
        blockPopups: true,
        engine: 'chromium' as const,
        backend: 'playwright' as const,
        headless: true,
        userAgent: 'Custom Agent',
        viewport: {
          width: 1920,
          height: 1080,
        },
      };

      const result = BrowserToolConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid engine type', () => {
      const config = {
        engine: 'invalid-engine',
      };

      const result = BrowserToolConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid viewport dimensions', () => {
      const config = {
        viewport: {
          width: 0,
          height: -100,
        },
      };

      const result = BrowserToolConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('PermissionPresetSchema', () => {
    it('should validate all permission presets', () => {
      const validPresets = ['autonomous', 'review-all', 'read-only'];

      validPresets.forEach(preset => {
        const result = PermissionPresetSchema.safeParse(preset);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid presets', () => {
      const invalidPresets = ['full-access', 'locked-down', 'custom'];

      invalidPresets.forEach(preset => {
        const result = PermissionPresetSchema.safeParse(preset);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('PermissionPresetConfigSchema', () => {
    it('should validate preset config', () => {
      const config = {
        name: 'autonomous' as const,
        description: 'Full autonomy mode',
        defaultBehavior: 'allow' as const,
        tools: {
          Read: 'allow' as const,
          Write: 'allow' as const,
          Bash: 'allow' as const,
        },
        allowDangerousOperations: true,
        allowNetworkAccess: true,
      };

      const result = PermissionPresetConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should use defaults for preset config', () => {
      const config = {
        name: 'read-only' as const,
        description: 'Read-only mode',
        defaultBehavior: 'deny' as const,
        tools: {},
      };

      const result = PermissionPresetConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      expect(result.data.allowDangerousOperations).toBe(false);
      expect(result.data.allowNetworkAccess).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values gracefully', () => {
      const result = PermissionSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('should handle undefined values gracefully', () => {
      const result = PermissionSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it('should handle empty objects gracefully', () => {
      const result = PermissionSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should handle arrays gracefully', () => {
      const result = PermissionSchema.safeParse([]);
      expect(result.success).toBe(false);
    });

    it('should validate nested object structure', () => {
      const permission = {
        tool: 'Read',
        level: 'allow-always' as const,
        createdAt: new Date(),
        nested: {
          invalidProperty: 'should be ignored or cause failure',
        },
      };

      const result = PermissionSchema.safeParse(permission);
      // Should still succeed as extra properties are typically ignored
      expect(result.success).toBe(true);
    });

    it('should validate complex directory access patterns', () => {
      const config = {
        allowlist: [
          '/home/user/**/*.txt',
          '/var/log/*.log',
          '/tmp/safe-*',
          '**/.git/hooks/*',
        ],
        blocklist: [
          '/etc/**/*',
          '/root/**/*',
          '**/*.exe',
          '**/node_modules/**/*',
        ],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 10,
      };

      const result = DirectoryAccessConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});