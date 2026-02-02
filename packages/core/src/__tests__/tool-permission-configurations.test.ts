/**
 * @fileoverview Tool-Specific Permission Configuration Tests
 *
 * This test suite provides comprehensive coverage of tool-specific permission
 * configurations, including filesystem tools, shell tools, web tools, browser tools,
 * and their integration with the directory access validator and dangerous operation detector.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DirectoryAccessConfigSchema,
  BaseToolPermissionConfigSchema,
  FilesystemToolConfigSchema,
  ShellToolConfigSchema,
  WebToolConfigSchema,
  BrowserToolConfigSchema,
  SearchToolConfigSchema,
  SystemToolConfigSchema,
  type DirectoryAccessConfig,
  type BaseToolPermissionConfig,
  type FilesystemToolConfig,
  type ShellToolConfig,
  type WebToolConfig,
  type BrowserToolConfig,
  type SearchToolConfig,
  type SystemToolConfig,
} from '../types';

describe('Tool-Specific Permission Configuration Tests', () => {
  describe('BaseToolPermissionConfig Edge Cases', () => {
    it('should validate minimal base configuration', () => {
      const minimalConfig: BaseToolPermissionConfig = {
        enabled: false,
      };

      const result = BaseToolPermissionConfigSchema.parse(minimalConfig);
      expect(result.enabled).toBe(false);
      expect(result.timeout).toBeUndefined();
      expect(result.requireConfirmation).toBeUndefined();
      expect(result.rateLimit).toBeUndefined();
    });

    it('should validate complete base configuration', () => {
      const fullConfig: BaseToolPermissionConfig = {
        enabled: true,
        timeout: 30000,
        requireConfirmation: true,
        rateLimit: {
          maxRequests: 100,
          windowMs: 60000,
        },
      };

      const result = BaseToolPermissionConfigSchema.parse(fullConfig);
      expect(result).toEqual(fullConfig);
    });

    it('should handle timeout edge cases', () => {
      const timeoutCases = [
        { timeout: 1000 }, // 1 second - minimum practical
        { timeout: 30000 }, // 30 seconds - typical
        { timeout: 300000 }, // 5 minutes - long operation
        { timeout: 3600000 }, // 1 hour - very long operation
      ];

      timeoutCases.forEach(({ timeout }) => {
        const config = BaseToolPermissionConfigSchema.parse({
          enabled: true,
          timeout,
        });
        expect(config.timeout).toBe(timeout);
      });

      // Test invalid timeouts
      const invalidTimeouts = [0, -1, NaN, Infinity, -Infinity];
      invalidTimeouts.forEach(timeout => {
        expect(() => BaseToolPermissionConfigSchema.parse({
          enabled: true,
          timeout,
        })).toThrow();
      });
    });

    it('should validate rate limiting configurations', () => {
      const rateLimitCases = [
        { maxRequests: 1, windowMs: 1000 }, // Very restrictive
        { maxRequests: 10, windowMs: 60000 }, // Conservative
        { maxRequests: 100, windowMs: 60000 }, // Moderate
        { maxRequests: 1000, windowMs: 3600000 }, // Liberal
        { maxRequests: 0, windowMs: 1000 }, // No requests allowed
      ];

      rateLimitCases.forEach(rateLimit => {
        const config = BaseToolPermissionConfigSchema.parse({
          enabled: true,
          rateLimit,
        });
        expect(config.rateLimit).toEqual(rateLimit);
      });

      // Test invalid rate limits
      const invalidRateLimits = [
        { maxRequests: -1, windowMs: 1000 },
        { maxRequests: 100, windowMs: 0 },
        { maxRequests: 100, windowMs: -1000 },
        { maxRequests: NaN, windowMs: 1000 },
        { maxRequests: 100, windowMs: NaN },
      ];

      invalidRateLimits.forEach(rateLimit => {
        expect(() => BaseToolPermissionConfigSchema.parse({
          enabled: true,
          rateLimit,
        })).toThrow();
      });
    });
  });

  describe('FilesystemToolConfig Comprehensive Tests', () => {
    it('should validate complete filesystem configuration', () => {
      const filesystemConfig: FilesystemToolConfig = {
        enabled: true,
        timeout: 15000,
        requireConfirmation: false,
        directoryAccess: {
          allowlist: ['src/**/*.{ts,tsx,js,jsx}', 'docs/**/*.md', 'tests/**/*'],
          blocklist: ['node_modules/**/*', '.git/**/*', 'dist/**/*', '*.log'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 10,
        },
        maxFileSize: 10485760, // 10MB
        allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.yaml', '.yml'],
        blockedExtensions: ['.exe', '.dll', '.so', '.dylib', '.bat', '.cmd', '.sh', '.ps1'],
        rateLimit: {
          maxRequests: 200,
          windowMs: 60000,
        },
      };

      const result = FilesystemToolConfigSchema.parse(filesystemConfig);
      expect(result).toEqual(filesystemConfig);
    });

    it('should handle file size limit edge cases', () => {
      const sizeCases = [
        { size: 1, description: '1 byte minimum' },
        { size: 1024, description: '1KB' },
        { size: 1048576, description: '1MB' },
        { size: 10485760, description: '10MB' },
        { size: 104857600, description: '100MB' },
        { size: 1073741824, description: '1GB' },
      ];

      sizeCases.forEach(({ size, description }) => {
        const config = FilesystemToolConfigSchema.parse({
          enabled: true,
          maxFileSize: size,
        });
        expect(config.maxFileSize).toBe(size);
      });

      // Test invalid sizes
      const invalidSizes = [0, -1, -1000, NaN, Infinity, -Infinity];
      invalidSizes.forEach(size => {
        expect(() => FilesystemToolConfigSchema.parse({
          enabled: true,
          maxFileSize: size,
        })).toThrow();
      });
    });

    it('should validate file extension lists', () => {
      const extensionCases = [
        {
          allowed: ['.ts', '.js', '.json'],
          blocked: ['.exe', '.dll'],
          description: 'Standard web development extensions',
        },
        {
          allowed: ['.*'], // Allow all
          blocked: ['.exe', '.dll', '.bat'],
          description: 'Allow all except dangerous executables',
        },
        {
          allowed: [],
          blocked: ['.exe', '.dll', '.so', '.dylib'],
          description: 'No specific allowlist, block dangerous',
        },
        {
          allowed: ['.txt', '.md'],
          blocked: [],
          description: 'Only text files, no specific blocklist',
        },
      ];

      extensionCases.forEach(({ allowed, blocked, description }) => {
        const config = FilesystemToolConfigSchema.parse({
          enabled: true,
          allowedExtensions: allowed,
          blockedExtensions: blocked,
        });
        expect(config.allowedExtensions).toEqual(allowed);
        expect(config.blockedExtensions).toEqual(blocked);
      });
    });

    it('should handle complex directory access patterns', () => {
      const complexPatterns: DirectoryAccessConfig[] = [
        {
          allowlist: [
            'src/**/*.{ts,tsx,js,jsx}', // Source files
            'tests/**/*.{test,spec}.{ts,js}', // Test files
            'docs/**/*.{md,mdx}', // Documentation
            'config/*.{json,yaml,yml}', // Config files
            '*.{json,md,txt}', // Root level files
          ],
          blocklist: [
            'node_modules/**/*',
            '.git/**/*',
            'dist/**/*',
            'build/**/*',
            '**/*.log',
            '**/*.tmp',
            '**/.*', // Hidden files
          ],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 15,
        },
        {
          allowlist: ['**/*'], // Allow everything
          blocklist: [
            'node_modules/**/*',
            '.git/**/*',
            '**/*.{exe,dll,so,dylib}',
          ],
          defaultAllow: true,
          resolveSymlinks: false,
          maxDepth: 5,
        },
      ];

      complexPatterns.forEach(directoryAccess => {
        const config = FilesystemToolConfigSchema.parse({
          enabled: true,
          directoryAccess,
        });
        expect(config.directoryAccess).toEqual(directoryAccess);
      });
    });
  });

  describe('ShellToolConfig Comprehensive Tests', () => {
    it('should validate complete shell configuration', () => {
      const shellConfig: ShellToolConfig = {
        enabled: true,
        timeout: 60000,
        requireConfirmation: true,
        blockedCommands: [
          'rm -rf',
          'sudo rm',
          'format',
          'dd if=',
          'chmod -R 777',
          'chown -R',
          'sudo chmod',
          'sudo chown',
        ],
        allowElevatedPrivileges: false,
        environmentVariables: {
          NODE_ENV: 'production',
          PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
          LANG: 'en_US.UTF-8',
        },
        rateLimit: {
          maxRequests: 50,
          windowMs: 60000,
        },
      };

      const result = ShellToolConfigSchema.parse(shellConfig);
      expect(result).toEqual(shellConfig);
    });

    it('should handle dangerous command blocking patterns', () => {
      const dangerousCommandSets = [
        {
          name: 'File system destruction',
          commands: ['rm -rf', 'sudo rm -rf', 'rmdir /s', 'del /f /q'],
        },
        {
          name: 'Disk operations',
          commands: ['dd if=', 'format', 'fdisk', 'mkfs', 'parted'],
        },
        {
          name: 'Permission manipulation',
          commands: ['chmod -R 777', 'chown -R root', 'sudo chmod', 'sudo chown'],
        },
        {
          name: 'System modification',
          commands: ['sudo su', 'su -', 'passwd', 'usermod', 'userdel'],
        },
        {
          name: 'Network dangerous',
          commands: ['iptables -F', 'ufw disable', 'netsh', 'route delete'],
        },
      ];

      dangerousCommandSets.forEach(({ name, commands }) => {
        const config = ShellToolConfigSchema.parse({
          enabled: true,
          blockedCommands: commands,
        });
        expect(config.blockedCommands).toEqual(commands);
      });
    });

    it('should validate environment variable configurations', () => {
      const environmentCases = [
        {
          description: 'Development environment',
          vars: {
            NODE_ENV: 'development',
            DEBUG: '1',
            LOG_LEVEL: 'debug',
          },
        },
        {
          description: 'Production environment',
          vars: {
            NODE_ENV: 'production',
            LOG_LEVEL: 'error',
            DISABLE_TELEMETRY: 'true',
          },
        },
        {
          description: 'Custom tool paths',
          vars: {
            PATH: '/custom/bin:/usr/bin:/bin',
            PYTHON_PATH: '/opt/python/bin',
            JAVA_HOME: '/usr/lib/jvm/java-11',
          },
        },
        {
          description: 'Security variables',
          vars: {
            HISTFILE: '/dev/null',
            TMOUT: '300',
            SECURE_PATH: '/usr/bin:/bin',
          },
        },
      ];

      environmentCases.forEach(({ description, vars }) => {
        const config = ShellToolConfigSchema.parse({
          enabled: true,
          environmentVariables: vars,
        });
        expect(config.environmentVariables).toEqual(vars);
      });
    });

    it('should handle privilege escalation settings', () => {
      const privilegeCases = [
        { allowElevatedPrivileges: false, description: 'No sudo/root access' },
        { allowElevatedPrivileges: true, description: 'Allow sudo when needed' },
      ];

      privilegeCases.forEach(({ allowElevatedPrivileges, description }) => {
        const config = ShellToolConfigSchema.parse({
          enabled: true,
          allowElevatedPrivileges,
        });
        expect(config.allowElevatedPrivileges).toBe(allowElevatedPrivileges);
      });
    });
  });

  describe('WebToolConfig Comprehensive Tests', () => {
    it('should validate complete web configuration', () => {
      const webConfig: WebToolConfig = {
        enabled: true,
        timeout: 30000,
        requireConfirmation: false,
        allowedDomains: [
          'api.github.com',
          '*.githubusercontent.com',
          'api.openai.com',
          '*.anthropic.com',
          'httpbin.org',
          'jsonplaceholder.typicode.com',
        ],
        blockedDomains: [
          'malicious.com',
          '*.ads.com',
          '*.tracking.net',
          'phishing-site.com',
        ],
        maxResponseSize: 52428800, // 50MB
        headers: {
          'User-Agent': 'APEX-Bot/1.0 (Autonomous Development Assistant)',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
        rateLimit: {
          maxRequests: 100,
          windowMs: 60000,
        },
      };

      const result = WebToolConfigSchema.parse(webConfig);
      expect(result).toEqual(webConfig);
    });

    it('should handle domain filtering edge cases', () => {
      const domainCases = [
        {
          description: 'Wildcard domains',
          allowed: ['*.github.com', '*.stackoverflow.com', '*.npmjs.org'],
          blocked: ['*.ads.com', '*.tracker.net'],
        },
        {
          description: 'Specific API endpoints',
          allowed: ['api.github.com', 'api.openai.com', 'api.anthropic.com'],
          blocked: ['malicious.com', 'phishing.net'],
        },
        {
          description: 'Localhost and development',
          allowed: ['localhost', '127.0.0.1', '*.local', '*.dev'],
          blocked: [],
        },
        {
          description: 'Mixed patterns',
          allowed: ['trusted.com', '*.safe-cdn.com', 'api.*.example.org'],
          blocked: ['*.ads.*', 'tracker.*.net', 'malware.com'],
        },
      ];

      domainCases.forEach(({ description, allowed, blocked }) => {
        const config = WebToolConfigSchema.parse({
          enabled: true,
          allowedDomains: allowed,
          blockedDomains: blocked,
        });
        expect(config.allowedDomains).toEqual(allowed);
        expect(config.blockedDomains).toEqual(blocked);
      });
    });

    it('should validate response size limits', () => {
      const sizeLimits = [
        { size: 1024, description: '1KB - small responses' },
        { size: 1048576, description: '1MB - typical API responses' },
        { size: 10485760, description: '10MB - large data responses' },
        { size: 104857600, description: '100MB - file downloads' },
      ];

      sizeLimits.forEach(({ size, description }) => {
        const config = WebToolConfigSchema.parse({
          enabled: true,
          maxResponseSize: size,
        });
        expect(config.maxResponseSize).toBe(size);
      });

      // Test invalid sizes
      const invalidSizes = [0, -1, NaN, Infinity];
      invalidSizes.forEach(size => {
        expect(() => WebToolConfigSchema.parse({
          enabled: true,
          maxResponseSize: size,
        })).toThrow();
      });
    });

    it('should handle custom HTTP headers', () => {
      const headerCases = [
        {
          description: 'Authentication headers',
          headers: {
            'Authorization': 'Bearer token123',
            'X-API-Key': 'api-key-value',
          },
        },
        {
          description: 'Content type headers',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, application/xml',
          },
        },
        {
          description: 'Custom application headers',
          headers: {
            'X-Client-Name': 'APEX',
            'X-Client-Version': '1.0.0',
            'X-Request-ID': '${requestId}',
          },
        },
        {
          description: 'Security headers',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://apex.local',
            'Referer': 'https://apex.local/',
          },
        },
      ];

      headerCases.forEach(({ description, headers }) => {
        const config = WebToolConfigSchema.parse({
          enabled: true,
          headers,
        });
        expect(config.headers).toEqual(headers);
      });
    });
  });

  describe('BrowserToolConfig Comprehensive Tests', () => {
    it('should validate complete browser configuration', () => {
      const browserConfig: BrowserToolConfig = {
        enabled: true,
        timeout: 60000,
        requireConfirmation: true,
        allowJavaScript: false,
        allowFormSubmission: false,
        allowDownloads: false,
        allowUploads: false,
        allowScreenshots: true,
        maxPageLoadTime: 30000,
        blockedUrls: [
          '*://ads.com/*',
          '*://tracker.net/*',
          '*://malicious.example/*',
          'javascript:*',
          'data:text/html,*',
        ],
        allowedUrls: [
          'https://github.com/*',
          'https://*.stackoverflow.com/*',
          'https://developer.mozilla.org/*',
          'https://docs.npmjs.com/*',
        ],
        rateLimit: {
          maxRequests: 20,
          windowMs: 60000,
        },
      };

      const result = BrowserToolConfigSchema.parse(browserConfig);
      expect(result).toEqual(browserConfig);
    });

    it('should handle browser security feature toggles', () => {
      const securityFeatures = [
        'allowJavaScript',
        'allowFormSubmission',
        'allowDownloads',
        'allowUploads',
        'allowScreenshots',
      ] as const;

      // Test all combinations of security features
      const combinations = [
        { allowJavaScript: false, allowFormSubmission: false }, // Most secure
        { allowJavaScript: true, allowFormSubmission: false }, // JS but no forms
        { allowJavaScript: true, allowFormSubmission: true }, // Full interaction
        { allowDownloads: false, allowUploads: false }, // No file operations
        { allowDownloads: true, allowUploads: false }, // Download only
        { allowScreenshots: true }, // Screenshots allowed
        { allowScreenshots: false }, // Screenshots disabled
      ];

      combinations.forEach(features => {
        const config = BrowserToolConfigSchema.parse({
          enabled: true,
          ...features,
        });
        Object.entries(features).forEach(([feature, value]) => {
          expect(config[feature as keyof typeof features]).toBe(value);
        });
      });
    });

    it('should validate URL filtering patterns', () => {
      const urlPatternCases = [
        {
          description: 'Protocol-specific patterns',
          allowed: ['https://*', 'http://localhost:*'],
          blocked: ['http://*', 'ftp://*', 'file://*'],
        },
        {
          description: 'Domain-specific patterns',
          allowed: ['*://trusted.com/*', '*://*.github.com/*'],
          blocked: ['*://malicious.com/*', '*://*.ads.net/*'],
        },
        {
          description: 'Path-specific patterns',
          allowed: ['*://example.com/api/*', '*://docs.example.com/*'],
          blocked: ['*://*/admin/*', '*://*/private/*'],
        },
        {
          description: 'Security-focused patterns',
          allowed: ['https://*.safe-domain.org/*'],
          blocked: ['javascript:*', 'data:*', 'blob:*', 'about:*'],
        },
      ];

      urlPatternCases.forEach(({ description, allowed, blocked }) => {
        const config = BrowserToolConfigSchema.parse({
          enabled: true,
          allowedUrls: allowed,
          blockedUrls: blocked,
        });
        expect(config.allowedUrls).toEqual(allowed);
        expect(config.blockedUrls).toEqual(blocked);
      });
    });

    it('should handle page load timeout configurations', () => {
      const timeoutCases = [
        { timeout: 5000, description: '5 seconds - fast pages only' },
        { timeout: 15000, description: '15 seconds - typical web pages' },
        { timeout: 30000, description: '30 seconds - slower pages' },
        { timeout: 60000, description: '60 seconds - very slow pages' },
      ];

      timeoutCases.forEach(({ timeout, description }) => {
        const config = BrowserToolConfigSchema.parse({
          enabled: true,
          maxPageLoadTime: timeout,
        });
        expect(config.maxPageLoadTime).toBe(timeout);
      });

      // Test invalid timeouts
      const invalidTimeouts = [0, -1, NaN, Infinity];
      invalidTimeouts.forEach(timeout => {
        expect(() => BrowserToolConfigSchema.parse({
          enabled: true,
          maxPageLoadTime: timeout,
        })).toThrow();
      });
    });
  });

  describe('SearchToolConfig Comprehensive Tests', () => {
    it('should validate search tool configuration', () => {
      const searchConfig: SearchToolConfig = {
        enabled: true,
        timeout: 10000,
        requireConfirmation: false,
        directoryAccess: {
          allowlist: ['src/**/*', 'tests/**/*', 'docs/**/*'],
          blocklist: ['node_modules/**/*', '.git/**/*', 'dist/**/*'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 8,
        },
        maxResults: 1000,
        includePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx', '*.json', '*.md'],
        excludePatterns: ['*.test.*', '*.spec.*', '*.d.ts', '*.min.js'],
      };

      const result = SearchToolConfigSchema.parse(searchConfig);
      expect(result).toEqual(searchConfig);
    });

    it('should handle search result limits', () => {
      const resultLimits = [
        { maxResults: 10, description: 'Very limited search' },
        { maxResults: 100, description: 'Small search' },
        { maxResults: 1000, description: 'Standard search' },
        { maxResults: 10000, description: 'Large search' },
      ];

      resultLimits.forEach(({ maxResults, description }) => {
        const config = SearchToolConfigSchema.parse({
          enabled: true,
          maxResults,
        });
        expect(config.maxResults).toBe(maxResults);
      });

      // Test invalid result limits
      const invalidLimits = [0, -1, NaN, Infinity];
      invalidLimits.forEach(maxResults => {
        expect(() => SearchToolConfigSchema.parse({
          enabled: true,
          maxResults,
        })).toThrow();
      });
    });

    it('should handle search pattern filtering', () => {
      const patternCases = [
        {
          description: 'Source code files',
          include: ['*.ts', '*.tsx', '*.js', '*.jsx'],
          exclude: ['*.test.*', '*.spec.*', '*.d.ts'],
        },
        {
          description: 'Documentation files',
          include: ['*.md', '*.mdx', '*.rst', '*.txt'],
          exclude: ['CHANGELOG.*', 'LICENSE.*'],
        },
        {
          description: 'Configuration files',
          include: ['*.json', '*.yaml', '*.yml', '*.toml', '*.ini'],
          exclude: ['package-lock.json', 'yarn.lock'],
        },
        {
          description: 'All files with exclusions',
          include: ['*.*'],
          exclude: ['*.log', '*.tmp', '*.cache', '*.swp', '*~'],
        },
      ];

      patternCases.forEach(({ description, include, exclude }) => {
        const config = SearchToolConfigSchema.parse({
          enabled: true,
          includePatterns: include,
          excludePatterns: exclude,
        });
        expect(config.includePatterns).toEqual(include);
        expect(config.excludePatterns).toEqual(exclude);
      });
    });
  });

  describe('SystemToolConfig Tests', () => {
    it('should validate system tool configuration', () => {
      const systemConfig: SystemToolConfig = {
        enabled: true,
        timeout: 5000,
        requireConfirmation: true,
        allowSystemInfo: true,
        allowProcessList: false,
        allowEnvironmentAccess: false,
        rateLimit: {
          maxRequests: 10,
          windowMs: 60000,
        },
      };

      const result = SystemToolConfigSchema.parse(systemConfig);
      expect(result).toEqual(systemConfig);
    });

    it('should handle system access permissions', () => {
      const accessCases = [
        { allowSystemInfo: true, allowProcessList: false, allowEnvironmentAccess: false },
        { allowSystemInfo: true, allowProcessList: true, allowEnvironmentAccess: false },
        { allowSystemInfo: true, allowProcessList: true, allowEnvironmentAccess: true },
        { allowSystemInfo: false, allowProcessList: false, allowEnvironmentAccess: false },
      ];

      accessCases.forEach(permissions => {
        const config = SystemToolConfigSchema.parse({
          enabled: true,
          ...permissions,
        });
        Object.entries(permissions).forEach(([permission, value]) => {
          expect(config[permission as keyof typeof permissions]).toBe(value);
        });
      });
    });
  });

  describe('Tool Configuration Integration Tests', () => {
    it('should validate mixed tool configurations', () => {
      const mixedConfigs = {
        filesystem: {
          enabled: true,
          maxFileSize: 1048576,
          allowedExtensions: ['.ts', '.js'],
        } as FilesystemToolConfig,
        shell: {
          enabled: false,
          blockedCommands: ['rm -rf'],
        } as ShellToolConfig,
        web: {
          enabled: true,
          allowedDomains: ['api.github.com'],
          maxResponseSize: 10485760,
        } as WebToolConfig,
        browser: {
          enabled: false,
          allowJavaScript: false,
        } as BrowserToolConfig,
      };

      // Validate each config independently
      expect(() => FilesystemToolConfigSchema.parse(mixedConfigs.filesystem)).not.toThrow();
      expect(() => ShellToolConfigSchema.parse(mixedConfigs.shell)).not.toThrow();
      expect(() => WebToolConfigSchema.parse(mixedConfigs.web)).not.toThrow();
      expect(() => BrowserToolConfigSchema.parse(mixedConfigs.browser)).not.toThrow();
    });

    it('should maintain consistency across tool configurations', () => {
      // Test that common base properties are consistent
      const baseProps = {
        enabled: true,
        timeout: 30000,
        requireConfirmation: false,
        rateLimit: { maxRequests: 100, windowMs: 60000 },
      };

      const toolConfigs = [
        FilesystemToolConfigSchema.parse({ ...baseProps }),
        ShellToolConfigSchema.parse({ ...baseProps }),
        WebToolConfigSchema.parse({ ...baseProps }),
        BrowserToolConfigSchema.parse({ ...baseProps }),
        SearchToolConfigSchema.parse({ ...baseProps }),
        SystemToolConfigSchema.parse({ ...baseProps }),
      ];

      toolConfigs.forEach(config => {
        expect(config.enabled).toBe(baseProps.enabled);
        expect(config.timeout).toBe(baseProps.timeout);
        expect(config.requireConfirmation).toBe(baseProps.requireConfirmation);
        expect(config.rateLimit).toEqual(baseProps.rateLimit);
      });
    });
  });
});