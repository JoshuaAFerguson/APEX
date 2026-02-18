import { describe, it, expect } from 'vitest';
import {
  DirectoryAccessConfigSchema,
  DirectoryAccessConfig,
  FilesystemToolConfigSchema,
  ShellToolConfigSchema,
  SearchToolConfigSchema,
  BaseToolPermissionConfigSchema,
  ToolPermissionConfigSchema,
  ExtendedPermissionSchema,
  PermissionSchema,
  PermissionLevelSchema,
  ToolPermissionSchema,
} from '../types';

describe('Permissions Directory Access Configuration', () => {
  describe('DirectoryAccessConfigSchema validation', () => {
    it('should validate default directory access config', () => {
      const config = {};
      const result = DirectoryAccessConfigSchema.parse(config);

      expect(result.allowlist).toEqual([]);
      expect(result.blocklist).toEqual([]);
      expect(result.defaultAllow).toBeUndefined(); // Should be computed based on allowlist
      expect(result.resolveSymlinks).toBe(true);
      expect(result.maxDepth).toBe(0);
    });

    it('should validate directory access with allowlist', () => {
      const config: Partial<DirectoryAccessConfig> = {
        allowlist: ['/src/**', '/docs/**'],
        blocklist: ['/src/secret/**'],
        defaultAllow: false,
        resolveSymlinks: false,
        maxDepth: 5,
      };

      const result = DirectoryAccessConfigSchema.parse(config);
      expect(result.allowlist).toEqual(['/src/**', '/docs/**']);
      expect(result.blocklist).toEqual(['/src/secret/**']);
      expect(result.defaultAllow).toBe(false);
      expect(result.resolveSymlinks).toBe(false);
      expect(result.maxDepth).toBe(5);
    });

    it('should reject invalid maxDepth values', () => {
      expect(() => {
        DirectoryAccessConfigSchema.parse({ maxDepth: -1 });
      }).toThrow();
    });

    it('should handle empty allowlist and blocklist', () => {
      const config = {
        allowlist: [],
        blocklist: [],
      };

      const result = DirectoryAccessConfigSchema.parse(config);
      expect(result.allowlist).toEqual([]);
      expect(result.blocklist).toEqual([]);
    });
  });

  describe('FilesystemToolConfigSchema validation', () => {
    it('should validate filesystem tool config with directory access', () => {
      const config = {
        enabled: true,
        timeout: 30000,
        requireConfirmation: false,
        rateLimitPerMinute: 10,
        directoryAccess: {
          allowlist: ['/src/**'],
          blocklist: ['/src/node_modules/**'],
          defaultAllow: false,
          maxDepth: 10,
        },
        maxFileSize: 1024 * 1024, // 1MB
        allowedExtensions: ['.js', '.ts', '.md'],
        blockedExtensions: ['.exe', '.bin'],
      };

      const result = FilesystemToolConfigSchema.parse(config);
      expect(result.directoryAccess?.allowlist).toEqual(['/src/**']);
      expect(result.directoryAccess?.blocklist).toEqual(['/src/node_modules/**']);
      expect(result.maxFileSize).toBe(1024 * 1024);
      expect(result.allowedExtensions).toEqual(['.js', '.ts', '.md']);
      expect(result.blockedExtensions).toEqual(['.exe', '.bin']);
    });

    it('should apply defaults for filesystem tool config', () => {
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

    it('should reject invalid file size', () => {
      expect(() => {
        FilesystemToolConfigSchema.parse({ maxFileSize: -1 });
      }).toThrow();
    });
  });

  describe('ShellToolConfigSchema validation', () => {
    it('should validate shell tool config with security options', () => {
      const config = {
        enabled: false,
        requireConfirmation: true,
        directoryAccess: {
          allowlist: ['/home/user/projects/**'],
          defaultAllow: false,
        },
        blockedCommands: ['rm -rf', 'sudo.*', 'curl.*\\|\\s*bash'],
        allowElevatedPrivileges: false,
        environment: {
          PATH: '/usr/local/bin:/usr/bin:/bin',
          HOME: '/home/user',
        },
        workingDirectory: '/home/user/projects',
      };

      const result = ShellToolConfigSchema.parse(config);
      expect(result.enabled).toBe(false);
      expect(result.requireConfirmation).toBe(true);
      expect(result.blockedCommands).toEqual(['rm -rf', 'sudo.*', 'curl.*\\|\\s*bash']);
      expect(result.allowElevatedPrivileges).toBe(false);
      expect(result.environment?.PATH).toBe('/usr/local/bin:/usr/bin:/bin');
      expect(result.workingDirectory).toBe('/home/user/projects');
    });

    it('should apply defaults for shell tool config', () => {
      const config = {};
      const result = ShellToolConfigSchema.parse(config);

      expect(result.enabled).toBe(true);
      expect(result.blockedCommands).toEqual([]);
      expect(result.allowElevatedPrivileges).toBe(false);
    });
  });

  describe('SearchToolConfigSchema validation', () => {
    it('should validate search tool config with patterns', () => {
      const config = {
        enabled: true,
        directoryAccess: {
          allowlist: ['/src/**', '/docs/**'],
          blocklist: ['/src/node_modules/**'],
        },
        maxResults: 500,
        includePatterns: ['*.js', '*.ts', '*.md'],
        excludePatterns: ['*.min.js', '*.map'],
      };

      const result = SearchToolConfigSchema.parse(config);
      expect(result.maxResults).toBe(500);
      expect(result.includePatterns).toEqual(['*.js', '*.ts', '*.md']);
      expect(result.excludePatterns).toEqual(['*.min.js', '*.map']);
    });

    it('should apply defaults for search tool config', () => {
      const config = {};
      const result = SearchToolConfigSchema.parse(config);

      expect(result.maxResults).toBe(1000);
      expect(result.includePatterns).toEqual([]);
      expect(result.excludePatterns).toEqual([]);
    });

    it('should reject invalid maxResults', () => {
      expect(() => {
        SearchToolConfigSchema.parse({ maxResults: 0 });
      }).toThrow();
    });
  });

  describe('ToolPermissionConfigSchema union validation', () => {
    it('should accept all tool config types', () => {
      const configs = [
        { enabled: true }, // Base config
        { enabled: true, maxFileSize: 1024 }, // Filesystem config
        { enabled: true, blockedCommands: ['rm'] }, // Shell config
        { enabled: true, allowedDomains: ['example.com'] }, // Web config
        { enabled: true, maxResults: 100 }, // Search config
      ];

      for (const config of configs) {
        expect(() => ToolPermissionConfigSchema.parse(config)).not.toThrow();
      }
    });

    it('should preserve tool-specific properties', () => {
      const filesystemConfig = {
        enabled: true,
        maxFileSize: 2048,
        allowedExtensions: ['.ts'],
        directoryAccess: {
          allowlist: ['/src/**'],
        },
      };

      const result = ToolPermissionConfigSchema.parse(filesystemConfig);
      expect((result as any).maxFileSize).toBe(2048);
      expect((result as any).allowedExtensions).toEqual(['.ts']);
      expect((result as any).directoryAccess?.allowlist).toEqual(['/src/**']);
    });
  });

  describe('ExtendedPermissionSchema validation', () => {
    it('should extend basic permission with configuration', () => {
      const permission = {
        tool: 'Read',
        scope: '/src/**',
        level: 'allow-always' as const,
        createdAt: new Date(),
        config: {
          enabled: true,
          maxFileSize: 1024,
          allowedExtensions: ['.js', '.ts'],
        },
        grantReason: 'Safe read access to source files',
        grantedBy: 'user',
        tags: ['filesystem', 'read-only'],
      };

      const result = ExtendedPermissionSchema.parse(permission);
      expect(result.tool).toBe('Read');
      expect(result.config?.enabled).toBe(true);
      expect((result.config as any).maxFileSize).toBe(1024);
      expect(result.grantReason).toBe('Safe read access to source files');
      expect(result.grantedBy).toBe('user');
      expect(result.tags).toEqual(['filesystem', 'read-only']);
    });

    it('should apply defaults for extended permission', () => {
      const permission = {
        tool: 'Write',
        level: 'allow-once' as const,
        createdAt: new Date(),
      };

      const result = ExtendedPermissionSchema.parse(permission);
      expect(result.tags).toEqual([]);
    });
  });

  describe('Permission validation schemas', () => {
    it('should validate permission levels', () => {
      const validLevels = ['allow-always', 'allow-once', 'deny'];
      for (const level of validLevels) {
        expect(() => PermissionLevelSchema.parse(level)).not.toThrow();
      }

      expect(() => PermissionLevelSchema.parse('invalid')).toThrow();
    });

    it('should validate tool permissions', () => {
      const validPermissions = ['read', 'write', 'execute', 'network', 'admin'];
      for (const permission of validPermissions) {
        expect(() => ToolPermissionSchema.parse(permission)).not.toThrow();
      }

      expect(() => ToolPermissionSchema.parse('invalid')).toThrow();
    });

    it('should validate basic permission schema', () => {
      const permission = {
        tool: 'Bash',
        scope: '/usr/bin/**',
        level: 'deny' as const,
        expiry: new Date(Date.now() + 86400000), // 24 hours
        createdAt: new Date(),
      };

      const result = PermissionSchema.parse(permission);
      expect(result.tool).toBe('Bash');
      expect(result.scope).toBe('/usr/bin/**');
      expect(result.level).toBe('deny');
      expect(result.expiry).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should reject invalid tool names', () => {
      expect(() => {
        PermissionSchema.parse({
          tool: '', // Empty tool name
          level: 'allow-always',
          createdAt: new Date(),
        });
      }).toThrow();
    });
  });

  describe('Real-world permission scenarios', () => {
    it('should handle development environment permissions', () => {
      const devPermissions = {
        tool: 'Write',
        scope: '/home/dev/project/**',
        level: 'allow-always' as const,
        config: {
          enabled: true,
          directoryAccess: {
            allowlist: ['/home/dev/project/src/**', '/home/dev/project/docs/**'],
            blocklist: ['/home/dev/project/node_modules/**', '/home/dev/project/.git/**'],
            defaultAllow: false,
            resolveSymlinks: true,
            maxDepth: 10,
          },
          maxFileSize: 10 * 1024 * 1024, // 10MB
          allowedExtensions: ['.js', '.ts', '.jsx', '.tsx', '.md', '.json', '.yaml'],
          blockedExtensions: ['.exe', '.dll', '.so', '.dylib'],
        },
        grantReason: 'Development workspace with restricted access',
        grantedBy: 'project-admin',
        tags: ['development', 'filesystem', 'restricted'],
        createdAt: new Date(),
      };

      const result = ExtendedPermissionSchema.parse(devPermissions);
      expect(result.config?.enabled).toBe(true);
      expect((result.config as any).directoryAccess?.allowlist).toContain('/home/dev/project/src/**');
      expect((result.config as any).maxFileSize).toBe(10 * 1024 * 1024);
      expect(result.tags).toContain('development');
    });

    it('should handle production security permissions', () => {
      const prodPermissions = {
        tool: 'Bash',
        level: 'deny' as const,
        config: {
          enabled: false,
          requireConfirmation: true,
          blockedCommands: [
            'rm\\s+-rf.*',
            'sudo.*',
            'curl.*\\|.*sh',
            'wget.*\\|.*sh',
            '\\$\\(.*\\)',
            '`.*`',
          ],
          allowElevatedPrivileges: false,
          environment: {
            PATH: '/usr/local/bin:/usr/bin:/bin',
          },
        },
        grantReason: 'Production security - shell access denied',
        grantedBy: 'security-team',
        tags: ['production', 'security', 'shell', 'deny'],
        createdAt: new Date(),
      };

      const result = ExtendedPermissionSchema.parse(prodPermissions);
      expect(result.level).toBe('deny');
      expect((result.config as any).blockedCommands).toContain('sudo.*');
      expect((result.config as any).allowElevatedPrivileges).toBe(false);
      expect(result.tags).toContain('security');
    });

    it('should handle read-only documentation access', () => {
      const docsPermissions = {
        tool: 'Read',
        scope: '/docs/**',
        level: 'allow-always' as const,
        config: {
          enabled: true,
          directoryAccess: {
            allowlist: ['/docs/**', '/README.md'],
            defaultAllow: false,
            resolveSymlinks: true,
          },
          maxFileSize: 5 * 1024 * 1024, // 5MB
          allowedExtensions: ['.md', '.txt', '.rst', '.pdf'],
        },
        grantReason: 'Read-only access to documentation',
        grantedBy: 'documentation-team',
        tags: ['documentation', 'read-only'],
        createdAt: new Date(),
      };

      const result = ExtendedPermissionSchema.parse(docsPermissions);
      expect(result.scope).toBe('/docs/**');
      expect((result.config as any).allowedExtensions).toContain('.md');
      expect((result.config as any).directoryAccess?.allowlist).toContain('/docs/**');
    });
  });
});