/**
 * @fileoverview Extended Permission Validation Tests
 *
 * Tests for ExtendedPermissionSchema validation, tool permission configurations,
 * and comprehensive permission validation logic that may not be fully covered
 * in existing tests.
 */

import { describe, it, expect } from 'vitest';
import {
  ExtendedPermissionSchema,
  ToolPermissionConfigSchema,
  FilesystemToolConfigSchema,
  ShellToolConfigSchema,
  WebToolConfigSchema,
  BrowserToolConfigSchema,
  BaseToolPermissionConfigSchema,
  DirectoryAccessConfigSchema,
  PermissionLevelSchema,
  PermissionSchema,
  type ExtendedPermission,
  type FilesystemToolConfig,
  type ShellToolConfig,
  type WebToolConfig,
  type BrowserToolConfig,
  type DirectoryAccessConfig,
} from '../types';

describe('ExtendedPermissionSchema Validation', () => {
  const basePermission = {
    tool: 'Read',
    level: 'allow-always' as const,
    createdAt: new Date(),
  };

  describe('Basic Extended Permission Validation', () => {
    it('should validate extended permission with minimal fields', () => {
      const extendedPermission = {
        ...basePermission,
      };

      const result = ExtendedPermissionSchema.parse(extendedPermission);
      expect(result.tool).toBe('Read');
      expect(result.level).toBe('allow-always');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.config).toBeUndefined();
      expect(result.grantReason).toBeUndefined();
      expect(result.grantedBy).toBeUndefined();
      expect(result.tags).toEqual([]);
    });

    it('should validate extended permission with all fields', () => {
      const extendedPermission = {
        ...basePermission,
        scope: '/src/**/*.ts',
        expiry: new Date(Date.now() + 3600000),
        config: {
          enabled: true,
          timeout: 5000,
          requireConfirmation: true,
          rateLimitPerMinute: 10,
          metadata: { source: 'user-granted' },
        },
        grantReason: 'Development work on TypeScript files',
        grantedBy: 'user@example.com',
        tags: ['development', 'typescript', 'filesystem'],
      };

      const result = ExtendedPermissionSchema.parse(extendedPermission);
      expect(result.scope).toBe('/src/**/*.ts');
      expect(result.config?.enabled).toBe(true);
      expect(result.config?.timeout).toBe(5000);
      expect(result.config?.requireConfirmation).toBe(true);
      expect(result.config?.rateLimitPerMinute).toBe(10);
      expect(result.config?.metadata?.source).toBe('user-granted');
      expect(result.grantReason).toBe('Development work on TypeScript files');
      expect(result.grantedBy).toBe('user@example.com');
      expect(result.tags).toEqual(['development', 'typescript', 'filesystem']);
    });

    it('should default tags to empty array', () => {
      const result = ExtendedPermissionSchema.parse(basePermission);
      expect(result.tags).toEqual([]);
    });

    it('should accept empty tags array', () => {
      const permissionWithEmptyTags = {
        ...basePermission,
        tags: [],
      };

      const result = ExtendedPermissionSchema.parse(permissionWithEmptyTags);
      expect(result.tags).toEqual([]);
    });
  });

  describe('Tool Permission Configuration Testing', () => {
    describe('FilesystemToolConfig', () => {
      it('should validate filesystem tool config with directory access', () => {
        const config: FilesystemToolConfig = {
          enabled: true,
          timeout: 10000,
          requireConfirmation: false,
          rateLimitPerMinute: 0,
          directoryAccess: {
            allowlist: ['/src/**', '/docs/**'],
            blocklist: ['/src/secrets/**'],
            defaultAllow: false,
            resolveSymlinks: true,
            maxDepth: 10,
          },
          maxFileSize: 1048576, // 1MB
          allowedExtensions: ['.ts', '.js', '.json'],
          blockedExtensions: ['.exe', '.bin'],
        };

        const result = FilesystemToolConfigSchema.parse(config);
        expect(result.directoryAccess?.allowlist).toEqual(['/src/**', '/docs/**']);
        expect(result.directoryAccess?.blocklist).toEqual(['/src/secrets/**']);
        expect(result.maxFileSize).toBe(1048576);
        expect(result.allowedExtensions).toEqual(['.ts', '.js', '.json']);
        expect(result.blockedExtensions).toEqual(['.exe', '.bin']);
      });

      it('should validate filesystem tool config with defaults', () => {
        const config = {};
        const result = FilesystemToolConfigSchema.parse(config);

        expect(result.enabled).toBe(true);
        expect(result.timeout).toBe(0);
        expect(result.requireConfirmation).toBe(false);
        expect(result.rateLimitPerMinute).toBe(0);
        expect(result.maxFileSize).toBe(0);
        expect(result.allowedExtensions).toEqual([]);
        expect(result.blockedExtensions).toEqual([]);
      });
    });

    describe('ShellToolConfig', () => {
      it('should validate shell tool config with security constraints', () => {
        const config: ShellToolConfig = {
          enabled: true,
          timeout: 30000,
          requireConfirmation: true,
          rateLimitPerMinute: 5,
          directoryAccess: {
            allowlist: ['/home/user/project/**'],
            blocklist: ['/etc/**', '/var/**'],
            defaultAllow: false,
          },
          blockedCommands: ['^rm -rf', '^sudo', '^su ', '\\|\\s*sh', '\\|\\s*bash'],
          allowElevatedPrivileges: false,
          environment: {
            NODE_ENV: 'development',
            DEBUG: '1',
          },
          workingDirectory: '/home/user/project',
        };

        const result = ShellToolConfigSchema.parse(config);
        expect(result.blockedCommands).toEqual(['^rm -rf', '^sudo', '^su ', '\\|\\s*sh', '\\|\\s*bash']);
        expect(result.allowElevatedPrivileges).toBe(false);
        expect(result.environment?.NODE_ENV).toBe('development');
        expect(result.workingDirectory).toBe('/home/user/project');
      });

      it('should validate shell tool config with defaults', () => {
        const config = {};
        const result = ShellToolConfigSchema.parse(config);

        expect(result.blockedCommands).toEqual([]);
        expect(result.allowElevatedPrivileges).toBe(false);
        expect(result.environment).toBeUndefined();
        expect(result.workingDirectory).toBeUndefined();
      });
    });

    describe('WebToolConfig', () => {
      it('should validate web tool config with domain restrictions', () => {
        const config: WebToolConfig = {
          enabled: true,
          timeout: 15000,
          requireConfirmation: false,
          rateLimitPerMinute: 20,
          allowedDomains: ['api.example.com', '*.github.com', 'docs.*.com'],
          blockedDomains: ['malware.com', 'suspicious.net'],
          maxResponseSize: 5242880, // 5MB
          followRedirects: true,
          headers: {
            'User-Agent': 'APEX-Agent/1.0',
            'Accept': 'application/json',
          },
        };

        const result = WebToolConfigSchema.parse(config);
        expect(result.allowedDomains).toEqual(['api.example.com', '*.github.com', 'docs.*.com']);
        expect(result.blockedDomains).toEqual(['malware.com', 'suspicious.net']);
        expect(result.maxResponseSize).toBe(5242880);
        expect(result.followRedirects).toBe(true);
        expect(result.headers?.['User-Agent']).toBe('APEX-Agent/1.0');
      });

      it('should validate web tool config with defaults', () => {
        const config = {};
        const result = WebToolConfigSchema.parse(config);

        expect(result.allowedDomains).toEqual([]);
        expect(result.blockedDomains).toEqual([]);
        expect(result.maxResponseSize).toBe(0);
        expect(result.followRedirects).toBe(true);
        expect(result.headers).toBeUndefined();
      });
    });

    describe('BrowserToolConfig', () => {
      it('should validate browser tool config with full restrictions', () => {
        const config: BrowserToolConfig = {
          enabled: true,
          timeout: 20000,
          requireConfirmation: true,
          rateLimitPerMinute: 3,
          allowedDomains: ['example.com', 'test.com'],
          blockedDomains: ['ads.com', 'tracking.net'],
          allowJavaScriptExecution: false,
          allowFormSubmission: false,
          pageLoadTimeout: 10000,
          allowDownloads: false,
          allowScreenshots: true,
          blockPopups: true,
          engine: 'chromium',
          backend: 'playwright',
          headless: true,
          userAgent: 'APEX Browser Automation',
          viewport: {
            width: 1920,
            height: 1080,
          },
        };

        const result = BrowserToolConfigSchema.parse(config);
        expect(result.allowJavaScriptExecution).toBe(false);
        expect(result.allowFormSubmission).toBe(false);
        expect(result.pageLoadTimeout).toBe(10000);
        expect(result.allowDownloads).toBe(false);
        expect(result.allowScreenshots).toBe(true);
        expect(result.blockPopups).toBe(true);
        expect(result.engine).toBe('chromium');
        expect(result.backend).toBe('playwright');
        expect(result.headless).toBe(true);
        expect(result.userAgent).toBe('APEX Browser Automation');
        expect(result.viewport?.width).toBe(1920);
        expect(result.viewport?.height).toBe(1080);
      });

      it('should validate browser tool config with defaults', () => {
        const config = {};
        const result = BrowserToolConfigSchema.parse(config);

        expect(result.allowedDomains).toEqual([]);
        expect(result.blockedDomains).toEqual([]);
        expect(result.allowJavaScriptExecution).toBeUndefined();
        expect(result.allowFormSubmission).toBeUndefined();
        expect(result.pageLoadTimeout).toBeUndefined();
      });

      it('should reject invalid viewport dimensions', () => {
        const invalidConfig = {
          viewport: {
            width: 0,
            height: 1080,
          },
        };

        expect(() => BrowserToolConfigSchema.parse(invalidConfig)).toThrow();
      });

      it('should reject invalid browser engines', () => {
        const invalidConfig = {
          engine: 'invalid-engine' as any,
        };

        expect(() => BrowserToolConfigSchema.parse(invalidConfig)).toThrow();
      });
    });
  });

  describe('Extended Permission with Tool Config Integration', () => {
    it('should validate extended permission with filesystem tool config', () => {
      const extendedPermission = {
        ...basePermission,
        tool: 'Read',
        scope: '/src/**/*.ts',
        config: {
          enabled: true,
          timeout: 5000,
          directoryAccess: {
            allowlist: ['/src/**'],
            blocklist: ['/src/node_modules/**'],
            defaultAllow: false,
          },
          maxFileSize: 1048576,
          allowedExtensions: ['.ts', '.tsx'],
        },
        grantReason: 'TypeScript file access for development',
        tags: ['filesystem', 'typescript'],
      };

      const result = ExtendedPermissionSchema.parse(extendedPermission);
      expect(result.tool).toBe('Read');
      expect(result.config).toBeDefined();
      expect(result.grantReason).toBe('TypeScript file access for development');
      expect(result.tags).toEqual(['filesystem', 'typescript']);
    });

    it('should validate extended permission with shell tool config', () => {
      const extendedPermission = {
        ...basePermission,
        tool: 'Bash',
        scope: 'npm run build',
        level: 'allow-once' as const,
        config: {
          enabled: true,
          timeout: 30000,
          requireConfirmation: true,
          blockedCommands: ['^sudo', '^rm -rf'],
          allowElevatedPrivileges: false,
          workingDirectory: '/home/user/project',
        },
        grantReason: 'Build script execution',
        grantedBy: 'developer@team.com',
        tags: ['build', 'npm', 'temporary'],
      };

      const result = ExtendedPermissionSchema.parse(extendedPermission);
      expect(result.tool).toBe('Bash');
      expect(result.scope).toBe('npm run build');
      expect(result.level).toBe('allow-once');
      expect(result.grantedBy).toBe('developer@team.com');
      expect(result.tags).toEqual(['build', 'npm', 'temporary']);
    });

    it('should validate extended permission with web tool config', () => {
      const extendedPermission = {
        ...basePermission,
        tool: 'WebFetch',
        scope: 'https://api.github.com/*',
        config: {
          enabled: true,
          allowedDomains: ['api.github.com'],
          maxResponseSize: 1048576,
          headers: {
            'Authorization': 'token ***',
            'Accept': 'application/vnd.github.v3+json',
          },
        },
        grantReason: 'GitHub API access for repository information',
        tags: ['api', 'github', 'web'],
      };

      const result = ExtendedPermissionSchema.parse(extendedPermission);
      expect(result.tool).toBe('WebFetch');
      expect(result.scope).toBe('https://api.github.com/*');
      expect(result.grantReason).toBe('GitHub API access for repository information');
      expect(result.tags).toEqual(['api', 'github', 'web']);
    });

    it('should validate extended permission with browser tool config', () => {
      const extendedPermission = {
        ...basePermission,
        tool: 'Browser',
        scope: 'https://example.com',
        level: 'deny' as const,
        config: {
          enabled: false,
          allowedDomains: [],
          blockedDomains: ['example.com'],
          allowJavaScriptExecution: false,
          allowFormSubmission: false,
          blockPopups: true,
        },
        grantReason: 'Blocked suspicious domain',
        grantedBy: 'security-admin@company.com',
        tags: ['security', 'blocked', 'browser'],
      };

      const result = ExtendedPermissionSchema.parse(extendedPermission);
      expect(result.tool).toBe('Browser');
      expect(result.scope).toBe('https://example.com');
      expect(result.level).toBe('deny');
      expect(result.grantReason).toBe('Blocked suspicious domain');
      expect(result.grantedBy).toBe('security-admin@company.com');
      expect(result.tags).toEqual(['security', 'blocked', 'browser']);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should reject extended permission with invalid base permission fields', () => {
      const invalidPermission = {
        tool: '', // Invalid: empty tool name
        level: 'allow-always' as const,
        createdAt: new Date(),
        config: { enabled: true },
        tags: ['test'],
      };

      expect(() => ExtendedPermissionSchema.parse(invalidPermission)).toThrow();
    });

    it('should reject extended permission with invalid tool config', () => {
      const invalidPermission = {
        ...basePermission,
        config: {
          enabled: true,
          timeout: -1, // Invalid: negative timeout
        },
      };

      expect(() => ExtendedPermissionSchema.parse(invalidPermission)).toThrow();
    });

    it('should handle complex tag arrays', () => {
      const permissionWithManyTags = {
        ...basePermission,
        tags: [
          'filesystem',
          'read-only',
          'development',
          'typescript',
          'source-code',
          'temporary',
          'user-granted',
          'project-specific',
          'build-system',
          'automation',
        ],
      };

      const result = ExtendedPermissionSchema.parse(permissionWithManyTags);
      expect(result.tags).toHaveLength(10);
      expect(result.tags).toContain('filesystem');
      expect(result.tags).toContain('automation');
    });

    it('should handle special characters in grant reason', () => {
      const permissionWithSpecialChars = {
        ...basePermission,
        grantReason: 'Permission for files matching pattern: /src/**/*.{ts,tsx,js,jsx} & dependencies',
        grantedBy: 'user+admin@company-name.co.uk',
        tags: ['special-chars', 'patterns', 'regex'],
      };

      const result = ExtendedPermissionSchema.parse(permissionWithSpecialChars);
      expect(result.grantReason).toContain('pattern: /src/**/*.{ts,tsx,js,jsx} & dependencies');
      expect(result.grantedBy).toBe('user+admin@company-name.co.uk');
    });

    it('should handle unicode characters in tags and reasons', () => {
      const permissionWithUnicode = {
        ...basePermission,
        grantReason: 'Доступ к файлам проекта 🔧 (development access)',
        grantedBy: 'developer@公司.com',
        tags: ['проект', 'разработка', '开发', 'développement'],
      };

      const result = ExtendedPermissionSchema.parse(permissionWithUnicode);
      expect(result.grantReason).toContain('🔧');
      expect(result.tags).toContain('проект');
      expect(result.tags).toContain('开发');
    });

    it('should preserve order of tags', () => {
      const orderedTags = ['first', 'second', 'third', 'fourth'];
      const permissionWithOrderedTags = {
        ...basePermission,
        tags: orderedTags,
      };

      const result = ExtendedPermissionSchema.parse(permissionWithOrderedTags);
      expect(result.tags).toEqual(orderedTags);
    });
  });

  describe('Tool Permission Config Union Type Testing', () => {
    it('should accept any valid tool config type in ToolPermissionConfigSchema', () => {
      const configs = [
        // Base config
        { enabled: true, timeout: 5000 },
        // Filesystem config
        { enabled: true, maxFileSize: 1048576, allowedExtensions: ['.ts'] },
        // Shell config
        { enabled: true, blockedCommands: ['^sudo'], allowElevatedPrivileges: false },
        // Web config
        { enabled: true, allowedDomains: ['example.com'], followRedirects: true },
        // Browser config
        { enabled: true, allowJavaScriptExecution: false, headless: true },
      ];

      configs.forEach((config, index) => {
        expect(() => ToolPermissionConfigSchema.parse(config))
          .not.toThrow(`Config ${index} should be valid`);
      });
    });

    it('should reject invalid configs for all tool types', () => {
      const invalidConfigs = [
        { enabled: 'yes' }, // Invalid: enabled should be boolean
        { timeout: 'forever' }, // Invalid: timeout should be number
        { maxFileSize: -1 }, // Invalid: negative file size
        { maxDepth: -5 }, // Invalid: negative depth
        { rateLimitPerMinute: -10 }, // Invalid: negative rate limit
      ];

      invalidConfigs.forEach((config, index) => {
        expect(() => ToolPermissionConfigSchema.parse(config))
          .toThrow(`Config ${index} should be invalid`);
      });
    });
  });
});

describe('DirectoryAccessConfig Edge Cases', () => {
  it('should handle complex glob patterns in allowlist/blocklist', () => {
    const config: DirectoryAccessConfig = {
      allowlist: [
        '/home/user/**',
        '!/home/user/.ssh/**',
        '**/src/**/*.{ts,tsx,js,jsx}',
        '/var/log/application/*.log',
        '/tmp/apex-*/**',
      ],
      blocklist: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.*/**',
        '**/*.{exe,bin,so,dylib}',
        '/etc/**',
        '/root/**',
      ],
      defaultAllow: false,
      resolveSymlinks: true,
      maxDepth: 50,
    };

    const result = DirectoryAccessConfigSchema.parse(config);
    expect(result.allowlist).toContain('**/src/**/*.{ts,tsx,js,jsx}');
    expect(result.blocklist).toContain('**/node_modules/**');
    expect(result.blocklist).toContain('**/*.{exe,bin,so,dylib}');
    expect(result.maxDepth).toBe(50);
  });

  it('should handle edge values for maxDepth', () => {
    const configs = [
      { maxDepth: 0 }, // Unlimited depth
      { maxDepth: 1 }, // Single level
      { maxDepth: 1000 }, // Very deep
      { maxDepth: Number.MAX_SAFE_INTEGER }, // Maximum safe integer
    ];

    configs.forEach(config => {
      expect(() => DirectoryAccessConfigSchema.parse(config)).not.toThrow();
    });
  });

  it('should reject invalid maxDepth values', () => {
    const invalidConfigs = [
      { maxDepth: -1 },
      { maxDepth: 1.5 },
      { maxDepth: NaN },
      { maxDepth: Infinity },
      { maxDepth: 'unlimited' },
    ];

    invalidConfigs.forEach(config => {
      expect(() => DirectoryAccessConfigSchema.parse(config as any)).toThrow();
    });
  });
});