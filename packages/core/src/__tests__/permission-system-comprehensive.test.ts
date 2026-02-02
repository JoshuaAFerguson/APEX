/**
 * @fileoverview Comprehensive Permission System Tests
 *
 * This test suite provides comprehensive coverage of all permission-related
 * code paths identified in the permission audit report, focusing on areas
 * that may not be fully covered by existing tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ToolPermissionSchema,
  PermissionLevelSchema,
  PermissionSchema,
  PermissionQuerySchema,
  DirectoryAccessConfigSchema,
  BaseToolPermissionConfigSchema,
  FilesystemToolConfigSchema,
  ShellToolConfigSchema,
  WebToolConfigSchema,
  BrowserToolConfigSchema,
  AutonomyLevelSchema,
  AutonomyConfigSchema,
  AgentAutonomyOverrideSchema,
  migrateLegacyAutonomyLevel,
  PermissionPresetSchema,
  PERMISSION_PRESET_CONFIGS,
  getPresetConfig,
  isPermissionPreset,
  validateToolsForPreset,
  type ToolPermission,
  type PermissionLevel,
  type Permission,
  type PermissionQuery,
  type DirectoryAccessConfig,
  type BaseToolPermissionConfig,
  type FilesystemToolConfig,
  type ShellToolConfig,
  type WebToolConfig,
  type BrowserToolConfig,
  type AutonomyLevel,
  type AutonomyConfig,
  type AgentAutonomyOverride,
  type PermissionPreset,
} from '../types';

describe('Permission System Comprehensive Coverage', () => {
  describe('ToolPermissionSchema Coverage', () => {
    it('should validate all tool permission types', () => {
      const validPermissions: ToolPermission[] = ['read', 'write', 'execute', 'network', 'admin'];

      validPermissions.forEach(permission => {
        const result = ToolPermissionSchema.parse(permission);
        expect(result).toBe(permission);
      });

      expect(validPermissions).toHaveLength(5); // Ensure we test all enum values
    });

    it('should reject invalid tool permission types', () => {
      const invalidPermissions = [
        'invalid', 'readwrite', 'execute-admin', '', null, undefined,
        'READ', 'Write', 'ADMIN', 123, {}, [], true
      ];

      invalidPermissions.forEach(permission => {
        expect(() => ToolPermissionSchema.parse(permission)).toThrow();
      });
    });

    it('should handle permission hierarchy edge cases', () => {
      // Test that each permission level is distinct
      const permissions: ToolPermission[] = ['read', 'write', 'execute', 'network', 'admin'];
      const uniquePermissions = new Set(permissions);
      expect(uniquePermissions.size).toBe(permissions.length);
    });
  });

  describe('DirectoryAccessConfigSchema Coverage', () => {
    it('should validate complete directory access configuration', () => {
      const validConfig: DirectoryAccessConfig = {
        allowlist: ['src/**/*.ts', 'docs/**/*.md'],
        blocklist: ['node_modules/**', '.git/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 10,
      };

      const result = DirectoryAccessConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should validate minimal directory access configuration', () => {
      const minimalConfig: DirectoryAccessConfig = {
        defaultAllow: true,
      };

      const result = DirectoryAccessConfigSchema.parse(minimalConfig);
      expect(result.defaultAllow).toBe(true);
      expect(result.allowlist).toBeUndefined();
      expect(result.blocklist).toBeUndefined();
    });

    it('should handle complex glob patterns', () => {
      const complexGlobs = [
        'src/**/*.{ts,tsx,js,jsx}',
        '**/*.test.*',
        '**/!(node_modules)/**',
        'path/**/[abc]*.txt',
        'docs/**/README.{md,txt}',
        '!(*.log|*.tmp)',
      ];

      const config = DirectoryAccessConfigSchema.parse({
        allowlist: complexGlobs,
        defaultAllow: false,
      });

      expect(config.allowlist).toEqual(complexGlobs);
    });

    it('should validate maxDepth constraints', () => {
      // Test valid maxDepth values
      const validDepths = [1, 5, 10, 50, 100];
      validDepths.forEach(depth => {
        const config = DirectoryAccessConfigSchema.parse({
          defaultAllow: false,
          maxDepth: depth,
        });
        expect(config.maxDepth).toBe(depth);
      });

      // Test invalid maxDepth values
      const invalidDepths = [0, -1, -10, 1.5, NaN, Infinity, -Infinity];
      invalidDepths.forEach(depth => {
        expect(() => DirectoryAccessConfigSchema.parse({
          defaultAllow: false,
          maxDepth: depth,
        })).toThrow();
      });
    });

    it('should handle symlink resolution edge cases', () => {
      const symlinksConfigs = [
        { resolveSymlinks: true },
        { resolveSymlinks: false },
        { resolveSymlinks: undefined },
      ];

      symlinksConfigs.forEach(config => {
        const result = DirectoryAccessConfigSchema.parse({
          defaultAllow: true,
          ...config,
        });
        expect(result.resolveSymlinks).toBe(config.resolveSymlinks);
      });
    });
  });

  describe('Tool Configuration Schemas Coverage', () => {
    describe('BaseToolPermissionConfigSchema', () => {
      it('should validate complete base configuration', () => {
        const baseConfig: BaseToolPermissionConfig = {
          enabled: true,
          timeout: 30000,
          requireConfirmation: true,
          rateLimit: {
            maxRequests: 100,
            windowMs: 60000,
          },
        };

        const result = BaseToolPermissionConfigSchema.parse(baseConfig);
        expect(result).toEqual(baseConfig);
      });

      it('should handle minimal base configuration', () => {
        const minimalConfig = { enabled: false };
        const result = BaseToolPermissionConfigSchema.parse(minimalConfig);
        expect(result.enabled).toBe(false);
      });

      it('should validate rate limiting edge cases', () => {
        const rateLimitCases = [
          { maxRequests: 1, windowMs: 1000 },
          { maxRequests: 1000, windowMs: 86400000 }, // 24 hours
          { maxRequests: 0, windowMs: 1000 }, // Edge case: no requests allowed
        ];

        rateLimitCases.forEach(rateLimit => {
          const config = BaseToolPermissionConfigSchema.parse({
            enabled: true,
            rateLimit,
          });
          expect(config.rateLimit).toEqual(rateLimit);
        });
      });
    });

    describe('FilesystemToolConfigSchema', () => {
      it('should validate complete filesystem configuration', () => {
        const filesystemConfig: FilesystemToolConfig = {
          enabled: true,
          timeout: 10000,
          requireConfirmation: false,
          directoryAccess: {
            allowlist: ['src/**/*'],
            blocklist: ['node_modules/**/*'],
            defaultAllow: false,
          },
          maxFileSize: 1048576, // 1MB
          allowedExtensions: ['.ts', '.js', '.json'],
          blockedExtensions: ['.exe', '.dll'],
        };

        const result = FilesystemToolConfigSchema.parse(filesystemConfig);
        expect(result).toEqual(filesystemConfig);
      });

      it('should handle file size limits edge cases', () => {
        const sizeLimits = [
          1, // 1 byte minimum
          1024, // 1KB
          1048576, // 1MB
          1073741824, // 1GB
        ];

        sizeLimits.forEach(size => {
          const config = FilesystemToolConfigSchema.parse({
            enabled: true,
            maxFileSize: size,
          });
          expect(config.maxFileSize).toBe(size);
        });

        // Test invalid sizes
        const invalidSizes = [0, -1, NaN, Infinity];
        invalidSizes.forEach(size => {
          expect(() => FilesystemToolConfigSchema.parse({
            enabled: true,
            maxFileSize: size,
          })).toThrow();
        });
      });

      it('should validate file extension patterns', () => {
        const extensionCases = [
          { allowedExtensions: ['.ts', '.tsx', '.js', '.jsx'] },
          { blockedExtensions: ['.exe', '.bat', '.cmd', '.com'] },
          { allowedExtensions: ['.*'], blockedExtensions: ['.exe'] }, // Allow all except blocked
          { allowedExtensions: [], blockedExtensions: [] }, // Empty lists
        ];

        extensionCases.forEach(extensions => {
          const config = FilesystemToolConfigSchema.parse({
            enabled: true,
            ...extensions,
          });
          expect(config.allowedExtensions).toEqual(extensions.allowedExtensions);
          expect(config.blockedExtensions).toEqual(extensions.blockedExtensions);
        });
      });
    });

    describe('ShellToolConfigSchema', () => {
      it('should validate complete shell configuration', () => {
        const shellConfig: ShellToolConfig = {
          enabled: true,
          timeout: 60000,
          requireConfirmation: true,
          blockedCommands: ['rm -rf', 'sudo rm', 'format'],
          allowElevatedPrivileges: false,
          environmentVariables: {
            PATH: '/usr/bin:/bin',
            NODE_ENV: 'production',
          },
        };

        const result = ShellToolConfigSchema.parse(shellConfig);
        expect(result).toEqual(shellConfig);
      });

      it('should handle dangerous command blocking', () => {
        const dangerousCommands = [
          'rm -rf /',
          'sudo rm -rf /*',
          'format c:',
          'dd if=/dev/zero of=/dev/sda',
          'sudo chmod -R 777 /',
          'sudo chown -R root:root /',
        ];

        const config = ShellToolConfigSchema.parse({
          enabled: true,
          blockedCommands: dangerousCommands,
        });

        expect(config.blockedCommands).toEqual(dangerousCommands);
      });

      it('should validate environment variable injection', () => {
        const envCases = [
          { NODE_ENV: 'development' },
          { PATH: '/custom/bin:/usr/bin' },
          { CUSTOM_VAR: 'value with spaces' },
          { NUMERIC_VAR: '123' },
          { EMPTY_VAR: '' },
        ];

        envCases.forEach(env => {
          const config = ShellToolConfigSchema.parse({
            enabled: true,
            environmentVariables: env,
          });
          expect(config.environmentVariables).toEqual(env);
        });
      });
    });

    describe('WebToolConfigSchema', () => {
      it('should validate complete web configuration', () => {
        const webConfig: WebToolConfig = {
          enabled: true,
          timeout: 30000,
          requireConfirmation: false,
          allowedDomains: ['api.github.com', '*.example.com'],
          blockedDomains: ['malicious.com', '*.ads.com'],
          maxResponseSize: 10485760, // 10MB
          headers: {
            'User-Agent': 'APEX Bot 1.0',
            'Accept': 'application/json',
          },
        };

        const result = WebToolConfigSchema.parse(webConfig);
        expect(result).toEqual(webConfig);
      });

      it('should handle domain filtering edge cases', () => {
        const domainCases = [
          { allowedDomains: ['*.com', '*.org'], blockedDomains: ['bad.com'] },
          { allowedDomains: ['specific.domain.com'] },
          { blockedDomains: ['*.ads.com', '*.tracking.net'] },
          { allowedDomains: [], blockedDomains: [] },
        ];

        domainCases.forEach(domains => {
          const config = WebToolConfigSchema.parse({
            enabled: true,
            ...domains,
          });
          expect(config.allowedDomains).toEqual(domains.allowedDomains);
          expect(config.blockedDomains).toEqual(domains.blockedDomains);
        });
      });

      it('should validate response size limits', () => {
        const sizeLimits = [
          1024, // 1KB
          1048576, // 1MB
          10485760, // 10MB
          104857600, // 100MB
        ];

        sizeLimits.forEach(size => {
          const config = WebToolConfigSchema.parse({
            enabled: true,
            maxResponseSize: size,
          });
          expect(config.maxResponseSize).toBe(size);
        });
      });
    });

    describe('BrowserToolConfigSchema', () => {
      it('should validate complete browser configuration', () => {
        const browserConfig: BrowserToolConfig = {
          enabled: true,
          timeout: 45000,
          requireConfirmation: true,
          allowJavaScript: false,
          allowFormSubmission: false,
          allowDownloads: false,
          allowUploads: false,
          allowScreenshots: true,
          maxPageLoadTime: 30000,
          blockedUrls: ['*://ads.com/*', '*://tracking.net/*'],
          allowedUrls: ['*://trusted.com/*'],
        };

        const result = BrowserToolConfigSchema.parse(browserConfig);
        expect(result).toEqual(browserConfig);
      });

      it('should handle browser security restrictions', () => {
        const securityCases = [
          { allowJavaScript: false, allowFormSubmission: false },
          { allowJavaScript: true, allowFormSubmission: true },
          { allowDownloads: false, allowUploads: false },
          { allowScreenshots: true },
        ];

        securityCases.forEach(security => {
          const config = BrowserToolConfigSchema.parse({
            enabled: true,
            ...security,
          });
          Object.entries(security).forEach(([key, value]) => {
            expect(config[key as keyof typeof security]).toBe(value);
          });
        });
      });

      it('should validate URL filtering patterns', () => {
        const urlPatterns = [
          '*://example.com/*',
          'https://secure.api.com/v1/*',
          '*://*.trusted-domain.org/*',
          'http://localhost:*/*',
          'file:///*',
        ];

        const config = BrowserToolConfigSchema.parse({
          enabled: true,
          allowedUrls: urlPatterns,
          blockedUrls: urlPatterns,
        });

        expect(config.allowedUrls).toEqual(urlPatterns);
        expect(config.blockedUrls).toEqual(urlPatterns);
      });
    });
  });

  describe('Autonomy System Coverage', () => {
    describe('AutonomyLevelSchema', () => {
      it('should validate all autonomy levels', () => {
        const validLevels: AutonomyLevel[] = ['full-auto', 'review-before-commit', 'review-all'];

        validLevels.forEach(level => {
          const result = AutonomyLevelSchema.parse(level);
          expect(result).toBe(level);
        });
      });

      it('should reject invalid autonomy levels', () => {
        const invalidLevels = [
          'supervised', 'autonomous', 'manual', 'semi-auto', 'custom',
          '', null, undefined, 123, true, {}
        ];

        invalidLevels.forEach(level => {
          expect(() => AutonomyLevelSchema.parse(level)).toThrow();
        });
      });
    });

    describe('AgentAutonomyOverrideSchema', () => {
      it('should validate agent autonomy overrides', () => {
        const override: AgentAutonomyOverride = {
          agentName: 'developer',
          level: 'full-auto',
          reason: 'Developer agent is trusted for file operations',
        };

        const result = AgentAutonomyOverrideSchema.parse(override);
        expect(result).toEqual(override);
      });

      it('should handle multiple agent overrides', () => {
        const overrides = [
          { agentName: 'tester', level: 'review-before-commit' as AutonomyLevel },
          { agentName: 'reviewer', level: 'review-all' as AutonomyLevel },
          { agentName: 'developer', level: 'full-auto' as AutonomyLevel, reason: 'Trusted agent' },
        ];

        overrides.forEach(override => {
          const result = AgentAutonomyOverrideSchema.parse(override);
          expect(result.agentName).toBe(override.agentName);
          expect(result.level).toBe(override.level);
        });
      });
    });

    describe('Legacy Autonomy Migration', () => {
      it('should migrate legacy autonomy levels correctly', () => {
        const legacyMappings = [
          { legacy: 'supervised' as const, modern: 'review-all' as AutonomyLevel },
          { legacy: 'review-before-commit' as const, modern: 'review-before-commit' as AutonomyLevel },
          { legacy: 'autonomous' as const, modern: 'full-auto' as AutonomyLevel },
          { legacy: 'custom' as const, modern: 'review-all' as AutonomyLevel },
        ];

        legacyMappings.forEach(({ legacy, modern }) => {
          const result = migrateLegacyAutonomyLevel(legacy);
          expect(result).toBe(modern);
        });
      });

      it('should handle invalid legacy autonomy levels', () => {
        const invalidLevels = ['invalid', 'unknown', null, undefined, 123];

        invalidLevels.forEach(level => {
          // Should throw or return a default value
          expect(() => migrateLegacyAutonomyLevel(level as any)).toThrow();
        });
      });
    });

    describe('Complete AutonomyConfigSchema', () => {
      it('should validate complete autonomy configuration', () => {
        const autonomyConfig: AutonomyConfig = {
          level: 'review-before-commit',
          stageOverrides: {
            planning: 'full-auto',
            implementation: 'review-before-commit',
            testing: 'review-all',
          },
          agentOverrides: [
            { agentName: 'planner', level: 'full-auto' },
            { agentName: 'developer', level: 'review-before-commit' },
          ],
          approvalGates: [
            {
              type: 'before-stage',
              stage: 'implementation',
              message: 'Review implementation plan?',
            },
          ],
          resourceLimits: {
            maxTokensPerTask: 100000,
            maxExecutionTime: 3600000, // 1 hour
          },
          onRejection: 'abort',
        };

        const result = AutonomyConfigSchema.parse(autonomyConfig);
        expect(result).toEqual(autonomyConfig);
      });
    });
  });

  describe('Permission Preset System Coverage', () => {
    describe('PermissionPresetSchema', () => {
      it('should validate all permission presets', () => {
        const validPresets: PermissionPreset[] = ['locked-down', 'review-all', 'review-risky', 'autonomous'];

        validPresets.forEach(preset => {
          const result = PermissionPresetSchema.parse(preset);
          expect(result).toBe(preset);
        });
      });

      it('should reject invalid presets', () => {
        const invalidPresets = [
          'custom', 'moderate', 'secure', '', null, undefined, 123
        ];

        invalidPresets.forEach(preset => {
          expect(() => PermissionPresetSchema.parse(preset)).toThrow();
        });
      });
    });

    describe('Permission Preset Functions', () => {
      it('should return correct configurations for all presets', () => {
        const presets: PermissionPreset[] = ['locked-down', 'review-all', 'review-risky', 'autonomous'];

        presets.forEach(preset => {
          const config = getPresetConfig(preset);
          expect(config).toBeDefined();
          expect(config.name).toBe(preset);
          expect(config.description).toBeDefined();
          expect(config.tools).toBeDefined();
        });
      });

      it('should correctly identify valid presets', () => {
        const validPresets = ['locked-down', 'review-all', 'review-risky', 'autonomous'];
        const invalidPresets = ['custom', 'invalid', null, undefined, 123];

        validPresets.forEach(preset => {
          expect(isPermissionPreset(preset)).toBe(true);
        });

        invalidPresets.forEach(preset => {
          expect(isPermissionPreset(preset)).toBe(false);
        });
      });

      it('should validate tools for each preset', () => {
        const toolNames = ['Read', 'Write', 'Edit', 'Bash', 'WebFetch'];
        const presets: PermissionPreset[] = ['locked-down', 'review-all', 'review-risky', 'autonomous'];

        presets.forEach(preset => {
          const validationResult = validateToolsForPreset(preset, toolNames);
          expect(validationResult).toBeDefined();
          expect(typeof validationResult.valid).toBe('boolean');

          if (!validationResult.valid) {
            expect(validationResult.issues).toBeDefined();
            expect(Array.isArray(validationResult.issues)).toBe(true);
          }
        });
      });

      it('should handle tool validation edge cases', () => {
        const edgeCases = [
          { preset: 'locked-down' as PermissionPreset, tools: [] }, // No tools
          { preset: 'autonomous' as PermissionPreset, tools: ['UnknownTool'] }, // Unknown tool
          { preset: 'review-risky' as PermissionPreset, tools: ['Read', 'Write', 'Bash'] }, // Mixed tools
        ];

        edgeCases.forEach(({ preset, tools }) => {
          expect(() => {
            const result = validateToolsForPreset(preset, tools);
            expect(result).toBeDefined();
          }).not.toThrow();
        });
      });
    });

    describe('Preset Configuration Completeness', () => {
      it('should ensure all preset configurations are complete', () => {
        Object.entries(PERMISSION_PRESET_CONFIGS).forEach(([presetName, config]) => {
          expect(config.name).toBe(presetName);
          expect(config.description).toBeDefined();
          expect(config.description.length).toBeGreaterThan(0);
          expect(config.tools).toBeDefined();
          expect(typeof config.tools).toBe('object');

          // Validate tools configuration structure
          Object.entries(config.tools).forEach(([toolName, toolConfig]) => {
            expect(toolName).toBeDefined();
            expect(toolConfig).toBeDefined();
            expect(typeof toolConfig.enabled).toBe('boolean');
          });
        });
      });
    });
  });

  describe('Permission System Integration Edge Cases', () => {
    it('should handle complex permission combinations', () => {
      const complexScenarios = [
        {
          permission: {
            tool: 'Bash',
            scope: 'git commit -m "Complex message with \\"quotes\\" and $variables"',
            level: 'allow-once' as PermissionLevel,
            createdAt: new Date(),
          },
          query: {
            tool: 'Bash',
            scope: 'git commit -m "Complex message with \\"quotes\\" and $variables"',
          },
        },
        {
          permission: {
            tool: 'WebFetch',
            scope: 'https://api.example.com/v1/users?filter[name]=John&sort=created_at',
            level: 'allow-always' as PermissionLevel,
            createdAt: new Date(),
            expiry: new Date(Date.now() + 86400000),
          },
          query: {
            tool: 'WebFetch',
            scope: 'https://api.example.com/v1/users?filter[name]=John&sort=created_at',
          },
        },
      ];

      complexScenarios.forEach(({ permission, query }) => {
        const validatedPermission = PermissionSchema.parse(permission);
        const validatedQuery = PermissionQuerySchema.parse(query);

        expect(validatedPermission.tool).toBe(validatedQuery.tool);
        expect(validatedPermission.scope).toBe(validatedQuery.scope);
      });
    });

    it('should handle unicode and special characters in permissions', () => {
      const unicodeTestCases = [
        { tool: '文件读取工具', scope: '/用户/文档/**/*' },
        { tool: '🔧⚙️🛠️', scope: '📁📂📄' },
        { tool: 'Tool\n\r\tWith\0Whitespace', scope: 'Scope\u2028\u2029' },
        { tool: 'Tool±×÷∞∑∫∆', scope: 'αβγδε' },
      ];

      unicodeTestCases.forEach(({ tool, scope }) => {
        const permission = {
          tool,
          scope,
          level: 'allow-always' as PermissionLevel,
          createdAt: new Date(),
        };

        const result = PermissionSchema.parse(permission);
        expect(result.tool).toBe(tool);
        expect(result.scope).toBe(scope);
      });
    });

    it('should validate permission consistency across schemas', () => {
      // Ensure that if a permission can be created, it can be queried
      const testPermissions = [
        { tool: 'Read', scope: '/src/**/*.ts', level: 'allow-always' as PermissionLevel },
        { tool: 'Write', scope: undefined, level: 'deny' as PermissionLevel },
        { tool: 'CustomTool', scope: 'custom:scope:pattern', level: 'allow-once' as PermissionLevel },
      ];

      testPermissions.forEach(({ tool, scope, level }) => {
        // Create permission
        const permission = PermissionSchema.parse({
          tool,
          scope,
          level,
          createdAt: new Date(),
        });

        // Create corresponding query
        const query = PermissionQuerySchema.parse({
          tool,
          scope,
        });

        expect(permission.tool).toBe(query.tool);
        expect(permission.scope).toBe(query.scope);
      });
    });
  });
});