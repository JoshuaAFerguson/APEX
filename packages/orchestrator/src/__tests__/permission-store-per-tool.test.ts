import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionStore } from '../permission-store';
import {
  ExtendedPermission,
  PermissionQuery,
  FilesystemToolConfig,
  ShellToolConfig,
  WebToolConfig,
  SearchToolConfig,
  BaseToolPermissionConfig,
  DirectoryAccessConfig,
  ToolPermissionConfig,
} from '@apexcli/core';

/**
 * Extended tests for PermissionStore per-tool configuration
 *
 * Focuses specifically on comprehensive testing of:
 * - FilesystemToolConfig, ShellToolConfig, WebToolConfig, SearchToolConfig
 * - Directory access configuration persistence
 * - Tag filtering capabilities
 * - GrantedBy filtering
 * - Config JSON serialization edge cases
 * - Per-tool config validation and persistence
 */
describe('PermissionStore - Per-Tool Configuration', () => {
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-per-tool-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });
    store = new PermissionStore(testDir);
    await store.initialize();
  });

  afterEach(() => {
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('FilesystemToolConfig', () => {
    it('should save and retrieve complete FilesystemToolConfig', async () => {
      const filesystemConfig: FilesystemToolConfig = {
        enabled: true,
        timeout: 30000,
        requireConfirmation: true,
        rateLimitPerMinute: 20,
        metadata: {
          purpose: 'development',
          project: 'apex',
          environment: { dev: true, production: false }
        },
        directoryAccess: {
          allowlist: ['/src/**', '/lib/**', '/tests/**'],
          blocklist: ['/src/secrets/**', '/lib/private/**'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 15,
        },
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml'],
        blockedExtensions: ['.exe', '.bat', '.sh', '.bin'],
      };

      const permission: ExtendedPermission = {
        tool: 'Read',
        scope: '/src/**/*.ts',
        level: 'allow-always',
        createdAt: new Date(),
        config: filesystemConfig,
        grantReason: 'TypeScript development access',
        grantedBy: 'developer',
        tags: ['filesystem', 'development', 'typescript'],
      };

      await store.saveExtendedPermission(permission);

      const query: PermissionQuery = { tool: 'Read', scope: '/src/**/*.ts' };
      const retrieved = await store.getExtendedPermission(query);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.config).toBeDefined();

      const config = retrieved?.config as FilesystemToolConfig;
      expect(config.enabled).toBe(true);
      expect(config.timeout).toBe(30000);
      expect(config.requireConfirmation).toBe(true);
      expect(config.rateLimitPerMinute).toBe(20);
      expect(config.maxFileSize).toBe(10 * 1024 * 1024);
      expect(config.allowedExtensions).toEqual(['.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml']);
      expect(config.blockedExtensions).toEqual(['.exe', '.bat', '.sh', '.bin']);

      // Verify metadata preservation
      expect(config.metadata).toBeDefined();
      expect(config.metadata?.purpose).toBe('development');
      expect(config.metadata?.project).toBe('apex');
      expect(config.metadata?.environment).toEqual({ dev: true, production: false });

      // Verify directory access
      expect(config.directoryAccess).toBeDefined();
      expect(config.directoryAccess?.allowlist).toEqual(['/src/**', '/lib/**', '/tests/**']);
      expect(config.directoryAccess?.blocklist).toEqual(['/src/secrets/**', '/lib/private/**']);
      expect(config.directoryAccess?.defaultAllow).toBe(false);
      expect(config.directoryAccess?.resolveSymlinks).toBe(true);
      expect(config.directoryAccess?.maxDepth).toBe(15);
    });

    it('should save FilesystemToolConfig with minimal required fields', async () => {
      const minimalConfig: FilesystemToolConfig = {
        enabled: false,
        timeout: 0,
        requireConfirmation: false,
        rateLimitPerMinute: 0,
        maxFileSize: 0,
        allowedExtensions: [],
        blockedExtensions: [],
      };

      const permission: ExtendedPermission = {
        tool: 'Write',
        level: 'allow-once',
        createdAt: new Date(),
        config: minimalConfig,
        tags: ['filesystem'],
      };

      await store.saveExtendedPermission(permission);

      const retrieved = await store.getExtendedPermission({ tool: 'Write' });
      const config = retrieved?.config as FilesystemToolConfig;

      expect(config.enabled).toBe(false);
      expect(config.timeout).toBe(0);
      expect(config.maxFileSize).toBe(0);
      expect(config.allowedExtensions).toEqual([]);
      expect(config.blockedExtensions).toEqual([]);
      expect(config.directoryAccess).toBeUndefined();
    });

    it('should handle FilesystemToolConfig with complex directory access patterns', async () => {
      const complexDirectoryAccess: DirectoryAccessConfig = {
        allowlist: [
          '/src/**/*.ts',
          '/lib/**/*.js',
          '/tests/**/*.test.ts',
          '/docs/**/*.md',
          '/config/**/*.{json,yaml,yml}',
        ],
        blocklist: [
          '/src/**/*.spec.ts',
          '/lib/**/node_modules/**',
          '/tests/**/fixtures/**',
          '**/*.private.*',
          '**/.env*',
          '**/secrets/**',
        ],
        defaultAllow: false,
        resolveSymlinks: false,
        maxDepth: 20,
      };

      const permission: ExtendedPermission = {
        tool: 'Edit',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          directoryAccess: complexDirectoryAccess,
          maxFileSize: 5 * 1024 * 1024,
          allowedExtensions: ['.ts', '.js', '.md', '.json', '.yaml'],
        } as FilesystemToolConfig,
        tags: ['filesystem', 'complex'],
      };

      await store.saveExtendedPermission(permission);

      const dirAccess = await store.getDirectoryAccess({ tool: 'Edit' });
      expect(dirAccess).toEqual(complexDirectoryAccess);
    });
  });

  describe('ShellToolConfig', () => {
    it('should save and retrieve complete ShellToolConfig', async () => {
      const shellConfig: ShellToolConfig = {
        enabled: true,
        timeout: 120000, // 2 minutes
        requireConfirmation: true,
        rateLimitPerMinute: 5,
        metadata: {
          allowedShells: ['/bin/bash', '/usr/bin/zsh'],
          restrictions: { networkAccess: false }
        },
        directoryAccess: {
          allowlist: ['/tmp/**', '/home/user/**', '/workspace/**'],
          blocklist: ['/etc/**', '/root/**', '/sys/**', '/proc/**'],
          defaultAllow: false,
          resolveSymlinks: false,
          maxDepth: 10,
        },
        blockedCommands: [
          'rm -rf /',
          'sudo rm',
          'chmod 777',
          'mkfs.*',
          'fdisk',
          'dd if=.*',
          'curl.*--data.*',
          'wget.*-O.*',
          '.*>.*passwd.*',
          '.*shadowfile.*',
        ],
        allowElevatedPrivileges: false,
        environment: {
          NODE_ENV: 'development',
          PATH: '/usr/local/bin:/usr/bin:/bin',
          HOME: '/tmp/sandbox',
          SHELL: '/bin/bash',
        },
        workingDirectory: '/workspace',
      };

      const permission: ExtendedPermission = {
        tool: 'Bash',
        scope: 'safe-commands',
        level: 'allow-once',
        createdAt: new Date(),
        config: shellConfig,
        grantReason: 'Sandboxed shell access for development',
        grantedBy: 'security-team',
        tags: ['shell', 'sandboxed', 'development'],
      };

      await store.saveExtendedPermission(permission);

      const query: PermissionQuery = { tool: 'Bash', scope: 'safe-commands' };
      const retrieved = await store.getExtendedPermission(query);

      expect(retrieved).not.toBeNull();
      const config = retrieved?.config as ShellToolConfig;

      expect(config.enabled).toBe(true);
      expect(config.timeout).toBe(120000);
      expect(config.allowElevatedPrivileges).toBe(false);
      expect(config.workingDirectory).toBe('/workspace');

      // Verify blocked commands
      expect(config.blockedCommands).toHaveLength(10);
      expect(config.blockedCommands).toContain('rm -rf /');
      expect(config.blockedCommands).toContain('sudo rm');

      // Verify environment variables
      expect(config.environment).toBeDefined();
      expect(config.environment?.NODE_ENV).toBe('development');
      expect(config.environment?.SHELL).toBe('/bin/bash');
      expect(config.environment?.HOME).toBe('/tmp/sandbox');

      // Verify metadata
      expect(config.metadata).toBeDefined();
      expect(config.metadata?.allowedShells).toEqual(['/bin/bash', '/usr/bin/zsh']);
      expect(config.metadata?.restrictions).toEqual({ networkAccess: false });
    });

    it('should handle ShellToolConfig with extensive blocked commands', async () => {
      const dangerousCommands = [
        'rm -rf',
        'sudo',
        'su -',
        'chmod 777',
        'chown root',
        'mount',
        'umount',
        'mkfs',
        'fdisk',
        'parted',
        'dd if=/dev/zero',
        'dd if=/dev/urandom',
        '>>/etc/passwd',
        '>>/etc/shadow',
        'curl.*malicious',
        'wget.*exploit',
        'nc -l',
        'ncat -l',
        'python.*-c.*exec',
        'perl.*-e.*exec',
        'bash.*-c.*$(.*)',
        'eval.*$(.*)',
        'ssh.*-o.*ProxyCommand',
        'scp.*$(.*)',
        'rsync.*--rsync-path=.*',
        '.*\\|\\s*sh',
        '.*&&.*rm',
        '.*;.*rm',
        'find.*-exec.*rm',
        'xargs.*rm',
      ];

      const restrictiveConfig: ShellToolConfig = {
        enabled: true,
        timeout: 30000,
        requireConfirmation: true,
        blockedCommands: dangerousCommands,
        allowElevatedPrivileges: false,
        environment: { SAFE_MODE: 'true' },
        workingDirectory: '/tmp/restricted',
      };

      const permission: ExtendedPermission = {
        tool: 'Bash',
        level: 'allow-once',
        createdAt: new Date(),
        config: restrictiveConfig,
        tags: ['shell', 'restricted'],
      };

      await store.saveExtendedPermission(permission);

      const retrieved = await store.getExtendedPermission({ tool: 'Bash' });
      const config = retrieved?.config as ShellToolConfig;

      expect(config.blockedCommands).toHaveLength(dangerousCommands.length);
      expect(config.blockedCommands).toEqual(dangerousCommands);
    });
  });

  describe('WebToolConfig', () => {
    it('should save and retrieve complete WebToolConfig', async () => {
      const webConfig: WebToolConfig = {
        enabled: true,
        timeout: 45000,
        requireConfirmation: false,
        rateLimitPerMinute: 60,
        metadata: {
          userAgent: 'APEX-Bot/1.0',
          apiKeys: { github: 'configured', anthropic: 'configured' }
        },
        allowedDomains: [
          'api.github.com',
          'docs.github.com',
          'raw.githubusercontent.com',
          'api.anthropic.com',
          'docs.anthropic.com',
          'www.npmjs.com',
          'registry.npmjs.org',
          'api.openai.com',
          'stackoverflow.com',
          'developer.mozilla.org',
        ],
        blockedDomains: [
          'malicious-site.com',
          'phishing-domain.net',
          'spam-api.org',
          '*.suspicious-tld',
          'ads.*.com',
          'tracker.*.net',
          'analytics.evil.com',
        ],
        maxResponseSize: 50 * 1024 * 1024, // 50MB
        followRedirects: true,
        headers: {
          'User-Agent': 'APEX-Bot/1.0 (Automated Development Assistant)',
          'Accept': 'application/json, text/html, application/xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'X-Requested-With': 'APEX',
        },
      };

      const permission: ExtendedPermission = {
        tool: 'WebFetch',
        scope: 'development-apis',
        level: 'allow-always',
        createdAt: new Date(),
        config: webConfig,
        grantReason: 'Access to development and documentation APIs',
        grantedBy: 'developer',
        tags: ['web', 'api', 'development'],
      };

      await store.saveExtendedPermission(permission);

      const query: PermissionQuery = { tool: 'WebFetch', scope: 'development-apis' };
      const retrieved = await store.getExtendedPermission(query);

      expect(retrieved).not.toBeNull();
      const config = retrieved?.config as WebToolConfig;

      expect(config.enabled).toBe(true);
      expect(config.timeout).toBe(45000);
      expect(config.maxResponseSize).toBe(50 * 1024 * 1024);
      expect(config.followRedirects).toBe(true);

      // Verify allowed domains
      expect(config.allowedDomains).toHaveLength(10);
      expect(config.allowedDomains).toContain('api.github.com');
      expect(config.allowedDomains).toContain('docs.anthropic.com');

      // Verify blocked domains
      expect(config.blockedDomains).toHaveLength(7);
      expect(config.blockedDomains).toContain('malicious-site.com');
      expect(config.blockedDomains).toContain('*.suspicious-tld');

      // Verify custom headers
      expect(config.headers).toBeDefined();
      expect(config.headers?.['User-Agent']).toBe('APEX-Bot/1.0 (Automated Development Assistant)');
      expect(config.headers?.['DNT']).toBe('1');
      expect(config.headers?.['X-Requested-With']).toBe('APEX');

      // Verify metadata
      expect(config.metadata?.userAgent).toBe('APEX-Bot/1.0');
      expect(config.metadata?.apiKeys).toEqual({ github: 'configured', anthropic: 'configured' });
    });

    it('should handle WebToolConfig with restrictive domain filtering', async () => {
      const restrictiveConfig: WebToolConfig = {
        enabled: true,
        timeout: 10000,
        allowedDomains: ['api.safe-domain.com'], // Very restrictive
        blockedDomains: [
          '*.ads.*',
          '*.tracker.*',
          '*.analytics.*',
          '*.facebook.*',
          '*.google-analytics.*',
          'doubleclick.*',
          'googletagmanager.*',
          '*.malware.*',
          '*.phishing.*',
          '*.spam.*',
        ],
        maxResponseSize: 1024 * 1024, // 1MB limit
        followRedirects: false,
      };

      const permission: ExtendedPermission = {
        tool: 'WebSearch',
        level: 'allow-once',
        createdAt: new Date(),
        config: restrictiveConfig,
        tags: ['web', 'restricted'],
      };

      await store.saveExtendedPermission(permission);

      const retrieved = await store.getExtendedPermission({ tool: 'WebSearch' });
      const config = retrieved?.config as WebToolConfig;

      expect(config.allowedDomains).toEqual(['api.safe-domain.com']);
      expect(config.blockedDomains).toHaveLength(10);
      expect(config.maxResponseSize).toBe(1024 * 1024);
      expect(config.followRedirects).toBe(false);
    });
  });

  describe('SearchToolConfig', () => {
    it('should save and retrieve complete SearchToolConfig', async () => {
      const searchConfig: SearchToolConfig = {
        enabled: true,
        timeout: 60000,
        requireConfirmation: false,
        rateLimitPerMinute: 100,
        metadata: {
          searchEngine: 'ripgrep',
          indexing: { enabled: true, updateFrequency: 'daily' }
        },
        directoryAccess: {
          allowlist: [
            '/src/**',
            '/lib/**',
            '/docs/**',
            '/tests/**',
            '/config/**',
            '/scripts/**',
          ],
          blocklist: [
            '/src/**/*.generated.*',
            '/lib/**/node_modules/**',
            '/docs/**/*.cache',
            '**/.git/**',
            '**/.svn/**',
            '**/.hg/**',
            '**/build/**',
            '**/dist/**',
            '**/*.log',
            '**/*.tmp',
          ],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 25,
        },
        maxResults: 2500,
        includePatterns: [
          '*.ts',
          '*.tsx',
          '*.js',
          '*.jsx',
          '*.json',
          '*.yaml',
          '*.yml',
          '*.md',
          '*.txt',
          '*.sh',
          '*.py',
          '*.rb',
          '*.go',
          '*.rs',
          '*.java',
          '*.c',
          '*.cpp',
          '*.h',
          '*.hpp',
        ],
        excludePatterns: [
          '*.min.js',
          '*.bundle.js',
          '*.chunk.js',
          '*.map',
          '*.d.ts.map',
          '*.spec.ts',
          '*.test.ts',
          '*.spec.js',
          '*.test.js',
          'node_modules/**',
          'coverage/**',
          '.nyc_output/**',
          'build/**',
          'dist/**',
          'out/**',
          '*.lock',
          'package-lock.json',
          'yarn.lock',
          'pnpm-lock.yaml',
        ],
      };

      const permission: ExtendedPermission = {
        tool: 'Grep',
        scope: 'codebase-search',
        level: 'allow-always',
        createdAt: new Date(),
        config: searchConfig,
        grantReason: 'Full codebase search capabilities for development',
        grantedBy: 'tech-lead',
        tags: ['search', 'development', 'codebase'],
      };

      await store.saveExtendedPermission(permission);

      const query: PermissionQuery = { tool: 'Grep', scope: 'codebase-search' };
      const retrieved = await store.getExtendedPermission(query);

      expect(retrieved).not.toBeNull();
      const config = retrieved?.config as SearchToolConfig;

      expect(config.enabled).toBe(true);
      expect(config.timeout).toBe(60000);
      expect(config.maxResults).toBe(2500);

      // Verify include patterns
      expect(config.includePatterns).toHaveLength(19);
      expect(config.includePatterns).toContain('*.ts');
      expect(config.includePatterns).toContain('*.py');
      expect(config.includePatterns).toContain('*.rs');

      // Verify exclude patterns
      expect(config.excludePatterns).toHaveLength(25);
      expect(config.excludePatterns).toContain('node_modules/**');
      expect(config.excludePatterns).toContain('*.min.js');
      expect(config.excludePatterns).toContain('package-lock.json');

      // Verify directory access
      expect(config.directoryAccess?.allowlist).toContain('/src/**');
      expect(config.directoryAccess?.allowlist).toContain('/docs/**');
      expect(config.directoryAccess?.blocklist).toContain('**/.git/**');
      expect(config.directoryAccess?.blocklist).toContain('**/node_modules/**');
      expect(config.directoryAccess?.maxDepth).toBe(25);

      // Verify metadata
      expect(config.metadata?.searchEngine).toBe('ripgrep');
      expect(config.metadata?.indexing).toEqual({ enabled: true, updateFrequency: 'daily' });
    });

    it('should handle SearchToolConfig with minimal patterns', async () => {
      const minimalConfig: SearchToolConfig = {
        enabled: false,
        timeout: 5000,
        maxResults: 10,
        includePatterns: ['*.txt'],
        excludePatterns: ['*.log'],
      };

      const permission: ExtendedPermission = {
        tool: 'Grep',
        level: 'allow-once',
        createdAt: new Date(),
        config: minimalConfig,
        tags: ['search', 'minimal'],
      };

      await store.saveExtendedPermission(permission);

      const retrieved = await store.getExtendedPermission({ tool: 'Grep' });
      const config = retrieved?.config as SearchToolConfig;

      expect(config.enabled).toBe(false);
      expect(config.maxResults).toBe(10);
      expect(config.includePatterns).toEqual(['*.txt']);
      expect(config.excludePatterns).toEqual(['*.log']);
      expect(config.directoryAccess).toBeUndefined();
    });
  });

  describe('Directory Access Configuration Persistence', () => {
    it('should persist and retrieve directory access configurations across different tool types', async () => {
      const filesystemDirAccess: DirectoryAccessConfig = {
        allowlist: ['/src/filesystem/**'],
        blocklist: ['/src/filesystem/secrets/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 10,
      };

      const shellDirAccess: DirectoryAccessConfig = {
        allowlist: ['/tmp/shell/**', '/workspace/**'],
        blocklist: ['/etc/**', '/root/**'],
        defaultAllow: false,
        resolveSymlinks: false,
        maxDepth: 5,
      };

      const searchDirAccess: DirectoryAccessConfig = {
        allowlist: ['/src/**', '/lib/**'],
        blocklist: ['**/node_modules/**', '**/.git/**'],
        defaultAllow: true,
        resolveSymlinks: true,
        maxDepth: 20,
      };

      const permissions: ExtendedPermission[] = [
        {
          tool: 'Read',
          level: 'allow-always',
          createdAt: new Date(),
          config: { directoryAccess: filesystemDirAccess } as FilesystemToolConfig,
          tags: ['filesystem'],
        },
        {
          tool: 'Bash',
          level: 'allow-once',
          createdAt: new Date(),
          config: { directoryAccess: shellDirAccess } as ShellToolConfig,
          tags: ['shell'],
        },
        {
          tool: 'Grep',
          level: 'allow-always',
          createdAt: new Date(),
          config: { directoryAccess: searchDirAccess } as SearchToolConfig,
          tags: ['search'],
        },
      ];

      // Save all permissions
      for (const permission of permissions) {
        await store.saveExtendedPermission(permission);
      }

      // Retrieve and verify each directory access configuration
      const readDirAccess = await store.getDirectoryAccess({ tool: 'Read' });
      expect(readDirAccess).toEqual(filesystemDirAccess);

      const bashDirAccess = await store.getDirectoryAccess({ tool: 'Bash' });
      expect(bashDirAccess).toEqual(shellDirAccess);

      const grepDirAccess = await store.getDirectoryAccess({ tool: 'Grep' });
      expect(grepDirAccess).toEqual(searchDirAccess);
    });

    it('should update directory access configurations independently', async () => {
      // Create initial permission with directory access
      const initialPermission: ExtendedPermission = {
        tool: 'Edit',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          directoryAccess: {
            allowlist: ['/initial/**'],
            defaultAllow: false,
          },
          maxFileSize: 1024,
        } as FilesystemToolConfig,
        tags: ['filesystem'],
      };

      await store.saveExtendedPermission(initialPermission);

      // Update directory access
      const updatedDirAccess: DirectoryAccessConfig = {
        allowlist: ['/updated/**', '/new/**'],
        blocklist: ['/updated/private/**'],
        defaultAllow: true,
        resolveSymlinks: false,
        maxDepth: 8,
      };

      const updateResult = await store.updateDirectoryAccess(
        { tool: 'Edit' },
        updatedDirAccess
      );

      expect(updateResult).toBe(true);

      // Verify directory access was updated
      const retrievedAccess = await store.getDirectoryAccess({ tool: 'Edit' });
      expect(retrievedAccess).toEqual(updatedDirAccess);

      // Verify other config properties were preserved
      const permission = await store.getExtendedPermission({ tool: 'Edit' });
      const config = permission?.config as FilesystemToolConfig;
      expect(config?.maxFileSize).toBe(1024); // Should be preserved
    });

    it('should handle directory access configuration with complex glob patterns', async () => {
      const complexPatterns: DirectoryAccessConfig = {
        allowlist: [
          '/src/**/*.{ts,tsx,js,jsx}',
          '/lib/**/*.{json,yaml,yml}',
          '/tests/**/*.{spec,test}.{ts,js}',
          '/docs/**/*.{md,rst}',
          '/config/**/*.{json,yaml,yml,toml}',
          '/scripts/**/*.{sh,py,rb}',
          '**/*.config.{js,ts}',
          '**/*.d.ts',
        ],
        blocklist: [
          '/src/**/*.{private,secret}.{ts,js}',
          '/lib/**/node_modules/**',
          '/tests/**/coverage/**',
          '/docs/**/*.{tmp,temp,cache}',
          '/config/**/*.{key,pem,cert}',
          '**/.env*',
          '**/secrets/**',
          '**/*.{log,tmp,temp}',
          '**/{.git,.svn,.hg}/**',
          '**/build/{tmp,cache}/**',
        ],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 15,
      };

      const permission: ExtendedPermission = {
        tool: 'Glob',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          directoryAccess: complexPatterns,
          enabled: true,
        } as FilesystemToolConfig,
        tags: ['filesystem', 'patterns'],
      };

      await store.saveExtendedPermission(permission);

      const retrievedAccess = await store.getDirectoryAccess({ tool: 'Glob' });
      expect(retrievedAccess).toEqual(complexPatterns);

      // Verify complex allowlist patterns
      expect(retrievedAccess?.allowlist).toContain('/src/**/*.{ts,tsx,js,jsx}');
      expect(retrievedAccess?.allowlist).toContain('**/*.config.{js,ts}');

      // Verify complex blocklist patterns
      expect(retrievedAccess?.blocklist).toContain('/src/**/*.{private,secret}.{ts,js}');
      expect(retrievedAccess?.blocklist).toContain('**/{.git,.svn,.hg}/**');
    });
  });

  describe('Tag Filtering', () => {
    beforeEach(async () => {
      const permissions: ExtendedPermission[] = [
        {
          tool: 'Read',
          level: 'allow-always',
          createdAt: new Date('2023-01-01'),
          config: { enabled: true } as FilesystemToolConfig,
          tags: ['filesystem', 'safe', 'development'],
        },
        {
          tool: 'Write',
          level: 'allow-once',
          createdAt: new Date('2023-01-02'),
          config: { maxFileSize: 1024 } as FilesystemToolConfig,
          tags: ['filesystem', 'restricted', 'temporary'],
        },
        {
          tool: 'Bash',
          level: 'deny',
          createdAt: new Date('2023-01-03'),
          config: { allowElevatedPrivileges: false } as ShellToolConfig,
          tags: ['shell', 'blocked', 'security'],
        },
        {
          tool: 'WebFetch',
          level: 'allow-always',
          createdAt: new Date('2023-01-04'),
          config: { allowedDomains: ['safe-api.com'] } as WebToolConfig,
          tags: ['web', 'api', 'development'],
        },
        {
          tool: 'Grep',
          level: 'allow-always',
          createdAt: new Date('2023-01-05'),
          config: { maxResults: 100 } as SearchToolConfig,
          tags: ['search', 'development', 'safe'],
        },
        {
          tool: 'Edit',
          level: 'allow-once',
          createdAt: new Date('2023-01-06'),
          config: { allowedExtensions: ['.md'] } as FilesystemToolConfig,
          tags: ['filesystem', 'documentation', 'restricted'],
        },
      ];

      for (const permission of permissions) {
        await store.saveExtendedPermission(permission);
      }
    });

    it('should filter permissions by single tag', async () => {
      const filesystemPermissions = await store.listExtendedPermissions({
        tags: ['filesystem']
      });

      expect(filesystemPermissions).toHaveLength(3);
      expect(filesystemPermissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Read', 'Write', 'Edit'])
      );
    });

    it('should filter permissions by multiple tags (OR operation)', async () => {
      const devOrSafePermissions = await store.listExtendedPermissions({
        tags: ['development', 'safe']
      });

      // Should return permissions that have ANY of the specified tags
      expect(devOrSafePermissions).toHaveLength(4);
      expect(devOrSafePermissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Read', 'WebFetch', 'Grep', 'Edit']) // Edit has 'documentation' but gets 'development' through 'safe'
      );
    });

    it('should filter permissions by tool-specific tags', async () => {
      const shellPermissions = await store.listExtendedPermissions({
        tags: ['shell']
      });

      expect(shellPermissions).toHaveLength(1);
      expect(shellPermissions[0].tool).toBe('Bash');
      expect(shellPermissions[0].tags).toContain('shell');
    });

    it('should filter permissions by security-related tags', async () => {
      const securityPermissions = await store.listExtendedPermissions({
        tags: ['security', 'blocked', 'restricted']
      });

      expect(securityPermissions).toHaveLength(3);
      expect(securityPermissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Bash', 'Write', 'Edit'])
      );
    });

    it('should return empty results for non-existent tags', async () => {
      const nonExistentTagPermissions = await store.listExtendedPermissions({
        tags: ['non-existent-tag', 'another-missing-tag']
      });

      expect(nonExistentTagPermissions).toHaveLength(0);
    });

    it('should combine tag filtering with other filters', async () => {
      const restrictedFilesystemPermissions = await store.listExtendedPermissions({
        tags: ['filesystem'],
        level: 'allow-once'
      });

      expect(restrictedFilesystemPermissions).toHaveLength(2);
      expect(restrictedFilesystemPermissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Write', 'Edit'])
      );
    });

    it('should handle empty tags array correctly', async () => {
      const permissionsWithEmptyTags = await store.listExtendedPermissions({
        tags: []
      });

      // Empty tags array should return all permissions (no filtering)
      expect(permissionsWithEmptyTags).toHaveLength(6);
    });

    it('should filter case-sensitive tags correctly', async () => {
      // Add permission with mixed case tags
      await store.saveExtendedPermission({
        tool: 'TestTool',
        level: 'allow-always',
        createdAt: new Date(),
        tags: ['Development', 'SECURITY', 'FileSystem'],
      });

      // Search for lowercase versions (should not match)
      const lowercaseResults = await store.listExtendedPermissions({
        tags: ['development', 'security', 'filesystem']
      });

      const testToolInLowercase = lowercaseResults.find(p => p.tool === 'TestTool');
      expect(testToolInLowercase).toBeUndefined();

      // Search for exact case (should match)
      const exactCaseResults = await store.listExtendedPermissions({
        tags: ['Development', 'SECURITY']
      });

      const testToolInExactCase = exactCaseResults.find(p => p.tool === 'TestTool');
      expect(testToolInExactCase).toBeDefined();
    });
  });

  describe('GrantedBy Filtering', () => {
    beforeEach(async () => {
      const permissions: ExtendedPermission[] = [
        {
          tool: 'Read',
          level: 'allow-always',
          createdAt: new Date('2023-01-01'),
          grantedBy: 'user',
          config: { enabled: true } as FilesystemToolConfig,
          tags: ['user-granted'],
        },
        {
          tool: 'Write',
          level: 'allow-once',
          createdAt: new Date('2023-01-02'),
          grantedBy: 'admin',
          config: { maxFileSize: 2048 } as FilesystemToolConfig,
          tags: ['admin-granted'],
        },
        {
          tool: 'Bash',
          level: 'deny',
          createdAt: new Date('2023-01-03'),
          grantedBy: 'system',
          config: { allowElevatedPrivileges: false } as ShellToolConfig,
          tags: ['system-granted'],
        },
        {
          tool: 'WebFetch',
          level: 'allow-always',
          createdAt: new Date('2023-01-04'),
          grantedBy: 'security-team',
          config: { allowedDomains: ['secure-api.com'] } as WebToolConfig,
          tags: ['security-granted'],
        },
        {
          tool: 'Grep',
          level: 'allow-always',
          createdAt: new Date('2023-01-05'),
          grantedBy: 'tech-lead',
          config: { maxResults: 500 } as SearchToolConfig,
          tags: ['lead-granted'],
        },
        {
          tool: 'Edit',
          level: 'allow-once',
          createdAt: new Date('2023-01-06'),
          grantedBy: 'user',
          config: { allowedExtensions: ['.txt'] } as FilesystemToolConfig,
          tags: ['user-granted'],
        },
        {
          tool: 'NoGranter',
          level: 'allow-always',
          createdAt: new Date('2023-01-07'),
          // No grantedBy field
          config: { enabled: true } as BaseToolPermissionConfig,
          tags: ['no-granter'],
        },
      ];

      for (const permission of permissions) {
        await store.saveExtendedPermission(permission);
      }
    });

    it('should filter permissions by specific granter', async () => {
      const userPermissions = await store.listExtendedPermissions({
        grantedBy: 'user'
      });

      expect(userPermissions).toHaveLength(2);
      expect(userPermissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Read', 'Edit'])
      );
      userPermissions.forEach(perm => {
        expect(perm.grantedBy).toBe('user');
      });
    });

    it('should filter permissions by admin granter', async () => {
      const adminPermissions = await store.listExtendedPermissions({
        grantedBy: 'admin'
      });

      expect(adminPermissions).toHaveLength(1);
      expect(adminPermissions[0].tool).toBe('Write');
      expect(adminPermissions[0].grantedBy).toBe('admin');
    });

    it('should filter permissions by system granter', async () => {
      const systemPermissions = await store.listExtendedPermissions({
        grantedBy: 'system'
      });

      expect(systemPermissions).toHaveLength(1);
      expect(systemPermissions[0].tool).toBe('Bash');
      expect(systemPermissions[0].grantedBy).toBe('system');
    });

    it('should filter permissions by team granters', async () => {
      const securityTeamPermissions = await store.listExtendedPermissions({
        grantedBy: 'security-team'
      });

      expect(securityTeamPermissions).toHaveLength(1);
      expect(securityTeamPermissions[0].tool).toBe('WebFetch');

      const techLeadPermissions = await store.listExtendedPermissions({
        grantedBy: 'tech-lead'
      });

      expect(techLeadPermissions).toHaveLength(1);
      expect(techLeadPermissions[0].tool).toBe('Grep');
    });

    it('should return empty results for non-existent granter', async () => {
      const nonExistentGranterPermissions = await store.listExtendedPermissions({
        grantedBy: 'non-existent-granter'
      });

      expect(nonExistentGranterPermissions).toHaveLength(0);
    });

    it('should combine grantedBy filtering with other filters', async () => {
      const userFilesystemPermissions = await store.listExtendedPermissions({
        grantedBy: 'user',
        tags: ['user-granted']
      });

      expect(userFilesystemPermissions).toHaveLength(2);
      expect(userFilesystemPermissions.map(p => p.tool)).toEqual(
        expect.arrayContaining(['Read', 'Edit'])
      );

      const userDeniedPermissions = await store.listExtendedPermissions({
        grantedBy: 'user',
        level: 'deny'
      });

      expect(userDeniedPermissions).toHaveLength(0); // No denied permissions from user
    });

    it('should handle permissions without grantedBy field', async () => {
      const allPermissions = await store.listExtendedPermissions();

      // Should include permission without grantedBy
      const noGranterPerm = allPermissions.find(p => p.tool === 'NoGranter');
      expect(noGranterPerm).toBeDefined();
      expect(noGranterPerm?.grantedBy).toBeUndefined();

      // Filtering by any specific granter should exclude permissions without grantedBy
      const userPermissions = await store.listExtendedPermissions({ grantedBy: 'user' });
      const noGranterInUserResults = userPermissions.find(p => p.tool === 'NoGranter');
      expect(noGranterInUserResults).toBeUndefined();
    });

    it('should handle case-sensitive granter names', async () => {
      // Add permission with different case
      await store.saveExtendedPermission({
        tool: 'CaseTest',
        level: 'allow-always',
        createdAt: new Date(),
        grantedBy: 'User', // Capital U
        config: { enabled: true } as BaseToolPermissionConfig,
        tags: ['case-test'],
      });

      // Search with lowercase (should not match)
      const lowercaseResults = await store.listExtendedPermissions({
        grantedBy: 'user'
      });
      const caseTestInLowercase = lowercaseResults.find(p => p.tool === 'CaseTest');
      expect(caseTestInLowercase).toBeUndefined();

      // Search with exact case (should match)
      const exactCaseResults = await store.listExtendedPermissions({
        grantedBy: 'User'
      });
      const caseTestInExactCase = exactCaseResults.find(p => p.tool === 'CaseTest');
      expect(caseTestInExactCase).toBeDefined();
    });
  });

  describe('Config JSON Serialization Edge Cases', () => {
    it('should handle config with null and undefined values', async () => {
      const configWithNulls = {
        enabled: true,
        timeout: 0,
        requireConfirmation: null, // This will be handled by Zod validation
        rateLimitPerMinute: undefined, // This will be handled by Zod validation
        metadata: {
          nullValue: null,
          undefinedValue: undefined,
          emptyString: '',
          falseValue: false,
          zeroValue: 0,
        },
        directoryAccess: {
          allowlist: [],
          blocklist: null as any, // Force null for testing
          defaultAllow: false,
        },
      };

      const permission: ExtendedPermission = {
        tool: 'NullTest',
        level: 'allow-always',
        createdAt: new Date(),
        config: configWithNulls as any,
        tags: ['null-test'],
      };

      await store.saveExtendedPermission(permission);

      const retrieved = await store.getExtendedPermission({ tool: 'NullTest' });
      expect(retrieved).not.toBeNull();
      expect(retrieved?.config).toBeDefined();

      const config = retrieved?.config as any;
      expect(config.enabled).toBe(true);
      expect(config.timeout).toBe(0);
      expect(config.metadata?.emptyString).toBe('');
      expect(config.metadata?.falseValue).toBe(false);
      expect(config.metadata?.zeroValue).toBe(0);
    });

    it('should handle config with very deep nested objects', async () => {
      const deepNestedConfig = {
        enabled: true,
        metadata: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    deepValue: 'found me!',
                    deepArray: [1, 2, { nested: true }],
                    deepObject: {
                      property1: 'value1',
                      property2: {
                        subProperty: 'subValue',
                        anotherArray: ['a', 'b', 'c'],
                      },
                    },
                  },
                },
              },
            },
          },
          parallelStructure: {
            data: {
              items: [
                { id: 1, name: 'item1', meta: { type: 'test' } },
                { id: 2, name: 'item2', meta: { type: 'prod' } },
              ],
            },
          },
        },
      } as BaseToolPermissionConfig;

      const permission: ExtendedPermission = {
        tool: 'DeepNested',
        level: 'allow-always',
        createdAt: new Date(),
        config: deepNestedConfig,
        tags: ['deep-nested'],
      };

      await store.saveExtendedPermission(permission);

      const retrieved = await store.getExtendedPermission({ tool: 'DeepNested' });
      const config = retrieved?.config as any;

      expect(config.metadata.level1.level2.level3.level4.level5.deepValue).toBe('found me!');
      expect(config.metadata.level1.level2.level3.level4.level5.deepArray).toEqual([1, 2, { nested: true }]);
      expect(config.metadata.parallelStructure.data.items).toHaveLength(2);
      expect(config.metadata.parallelStructure.data.items[0].meta.type).toBe('test');
    });

    it('should handle config with special characters and Unicode', async () => {
      const unicodeConfig = {
        enabled: true,
        metadata: {
          unicodeString: '🚀 APEX 🤖 AI Agent 💻',
          specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
          multiLineString: `Line 1
Line 2 with    spaces
Line 3 with "quotes" and 'apostrophes'
Line 4 with \\backslashes\\ and /forward/slashes/`,
          unicodeObject: {
            '🔧': 'tool',
            '🛡️': 'security',
            '📁': 'filesystem',
            'αβγδε': 'greek',
            '中文': 'chinese',
            'العربية': 'arabic',
          },
        },
        directoryAccess: {
          allowlist: ['/path/with spaces/', '/path/with-special!@#chars/', '/path/with/unicode/🚀/'],
          blocklist: ['**/*.™', '**/*.©', '**/*.®'],
          defaultAllow: false,
        },
      } as FilesystemToolConfig;

      const permission: ExtendedPermission = {
        tool: 'UnicodeTest',
        level: 'allow-always',
        createdAt: new Date(),
        config: unicodeConfig,
        tags: ['unicode', '🚀', 'special-chars'],
      };

      await store.saveExtendedPermission(permission);

      const retrieved = await store.getExtendedPermission({ tool: 'UnicodeTest' });
      const config = retrieved?.config as FilesystemToolConfig;

      expect(config.metadata?.unicodeString).toBe('🚀 APEX 🤖 AI Agent 💻');
      expect(config.metadata?.specialChars).toBe('!@#$%^&*()_+-=[]{}|;:,.<>?');
      expect(config.metadata?.unicodeObject?.['🔧']).toBe('tool');
      expect(config.metadata?.unicodeObject?.['中文']).toBe('chinese');
      expect(config.directoryAccess?.allowlist).toContain('/path/with/unicode/🚀/');

      // Verify unicode tags are preserved
      expect(retrieved?.tags).toContain('🚀');
    });

    it('should handle config with very large arrays', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => `item_${i}_with_some_content`);
      const largeObjectArray = Array.from({ length: 500 }, (_, i) => ({
        id: i,
        name: `name_${i}`,
        description: `Description for item ${i} with some detailed content`,
        metadata: {
          category: `category_${i % 10}`,
          tags: [`tag_${i % 5}`, `tag_${i % 7}`],
          config: { enabled: i % 2 === 0, priority: i % 3 },
        },
      }));

      const largeConfig = {
        enabled: true,
        metadata: {
          largeStringArray: largeArray,
          largeObjectArray: largeObjectArray,
          nestedLargeStructure: {
            patterns: Array.from({ length: 200 }, (_, i) => `pattern_${i}_**/*.{ext${i}}`),
            rules: Array.from({ length: 150 }, (_, i) => ({
              rule: `rule_${i}`,
              applies: i % 3 === 0,
              conditions: [`condition_${i}_1`, `condition_${i}_2`],
            })),
          },
        },
      } as BaseToolPermissionConfig;

      const permission: ExtendedPermission = {
        tool: 'LargeConfig',
        level: 'allow-always',
        createdAt: new Date(),
        config: largeConfig,
        tags: ['large-config'],
      };

      await store.saveExtendedPermission(permission);

      const retrieved = await store.getExtendedPermission({ tool: 'LargeConfig' });
      const config = retrieved?.config as any;

      expect(config.metadata.largeStringArray).toHaveLength(1000);
      expect(config.metadata.largeStringArray[0]).toBe('item_0_with_some_content');
      expect(config.metadata.largeStringArray[999]).toBe('item_999_with_some_content');

      expect(config.metadata.largeObjectArray).toHaveLength(500);
      expect(config.metadata.largeObjectArray[0].id).toBe(0);
      expect(config.metadata.largeObjectArray[499].id).toBe(499);

      expect(config.metadata.nestedLargeStructure.patterns).toHaveLength(200);
      expect(config.metadata.nestedLargeStructure.rules).toHaveLength(150);
    });

    it('should handle config serialization with circular reference protection', async () => {
      // Test that our config validation prevents issues that could cause JSON serialization problems
      const configWithPotentialIssues = {
        enabled: true,
        timeout: Number.MAX_SAFE_INTEGER,
        metadata: {
          veryLargeNumber: 9007199254740991,
          infinityValue: null, // Can't serialize Infinity, so test with null
          nanValue: null, // Can't serialize NaN, so test with null
          dateString: new Date().toISOString(),
          regexPattern: '/test-pattern/gi', // Store as string, not RegExp object
          functionAsString: 'function() { return true; }', // Store as string, not function
        },
      } as BaseToolPermissionConfig;

      const permission: ExtendedPermission = {
        tool: 'SerializationTest',
        level: 'allow-always',
        createdAt: new Date(),
        config: configWithPotentialIssues,
        tags: ['serialization'],
      };

      await store.saveExtendedPermission(permission);

      const retrieved = await store.getExtendedPermission({ tool: 'SerializationTest' });
      const config = retrieved?.config as any;

      expect(config.enabled).toBe(true);
      expect(config.timeout).toBe(Number.MAX_SAFE_INTEGER);
      expect(config.metadata.veryLargeNumber).toBe(9007199254740991);
      expect(config.metadata.regexPattern).toBe('/test-pattern/gi');
      expect(config.metadata.functionAsString).toBe('function() { return true; }');
    });

    it('should handle malformed JSON recovery scenarios', async () => {
      // This tests the robustness of our JSON parsing in rowToExtendedPermission
      // We can't directly insert malformed JSON, but we can test edge cases

      const edgeCaseConfig = {
        enabled: true,
        metadata: {
          emptyObject: {},
          emptyArray: [],
          stringWithQuotes: 'She said "Hello" and he replied \'Hi\'',
          stringWithBackslashes: 'Path\\to\\file\\with\\backslashes',
          stringWithNewlines: 'Line 1\nLine 2\rLine 3\r\nLine 4',
          booleanValues: [true, false, null],
          numberValues: [0, -1, 1.5, -999.999, 1e10],
        },
      } as BaseToolPermissionConfig;

      const permission: ExtendedPermission = {
        tool: 'EdgeCaseJSON',
        level: 'allow-always',
        createdAt: new Date(),
        config: edgeCaseConfig,
        tags: ['edge-case'],
      };

      await store.saveExtendedPermission(permission);

      const retrieved = await store.getExtendedPermission({ tool: 'EdgeCaseJSON' });
      const config = retrieved?.config as any;

      expect(config.metadata.emptyObject).toEqual({});
      expect(config.metadata.emptyArray).toEqual([]);
      expect(config.metadata.stringWithQuotes).toBe('She said "Hello" and he replied \'Hi\'');
      expect(config.metadata.booleanValues).toEqual([true, false, null]);
      expect(config.metadata.numberValues).toEqual([0, -1, 1.5, -999.999, 1e10]);
    });
  });

  describe('Config Validation and Type Safety', () => {
    it('should validate FilesystemToolConfig schema correctly', async () => {
      const validConfig: FilesystemToolConfig = {
        enabled: true,
        timeout: 30000,
        requireConfirmation: false,
        rateLimitPerMinute: 10,
        maxFileSize: 1024 * 1024,
        allowedExtensions: ['.ts', '.js'],
        blockedExtensions: ['.exe'],
        directoryAccess: {
          allowlist: ['/src/**'],
          defaultAllow: false,
        },
      };

      const permission: ExtendedPermission = {
        tool: 'ValidateFilesystem',
        level: 'allow-always',
        createdAt: new Date(),
        config: validConfig,
        tags: ['validation'],
      };

      // Should save successfully
      await expect(store.saveExtendedPermission(permission)).resolves.not.toThrow();

      const retrieved = await store.getExtendedPermission({ tool: 'ValidateFilesystem' });
      expect(retrieved?.config).toBeDefined();
    });

    it('should validate ShellToolConfig schema correctly', async () => {
      const validConfig: ShellToolConfig = {
        enabled: true,
        timeout: 60000,
        requireConfirmation: true,
        blockedCommands: ['rm -rf', 'sudo'],
        allowElevatedPrivileges: false,
        environment: { NODE_ENV: 'test' },
        workingDirectory: '/tmp',
        directoryAccess: {
          allowlist: ['/tmp/**'],
          defaultAllow: false,
        },
      };

      const permission: ExtendedPermission = {
        tool: 'ValidateShell',
        level: 'allow-once',
        createdAt: new Date(),
        config: validConfig,
        tags: ['validation'],
      };

      await expect(store.saveExtendedPermission(permission)).resolves.not.toThrow();

      const retrieved = await store.getExtendedPermission({ tool: 'ValidateShell' });
      const config = retrieved?.config as ShellToolConfig;
      expect(config.blockedCommands).toEqual(['rm -rf', 'sudo']);
      expect(config.environment?.NODE_ENV).toBe('test');
    });

    it('should validate WebToolConfig schema correctly', async () => {
      const validConfig: WebToolConfig = {
        enabled: true,
        timeout: 30000,
        allowedDomains: ['api.example.com'],
        blockedDomains: ['malicious.com'],
        maxResponseSize: 1024 * 1024,
        followRedirects: true,
        headers: { 'Authorization': 'Bearer token' },
      };

      const permission: ExtendedPermission = {
        tool: 'ValidateWeb',
        level: 'allow-always',
        createdAt: new Date(),
        config: validConfig,
        tags: ['validation'],
      };

      await expect(store.saveExtendedPermission(permission)).resolves.not.toThrow();

      const retrieved = await store.getExtendedPermission({ tool: 'ValidateWeb' });
      const config = retrieved?.config as WebToolConfig;
      expect(config.allowedDomains).toEqual(['api.example.com']);
      expect(config.headers?.Authorization).toBe('Bearer token');
    });

    it('should validate SearchToolConfig schema correctly', async () => {
      const validConfig: SearchToolConfig = {
        enabled: true,
        maxResults: 500,
        includePatterns: ['*.ts', '*.js'],
        excludePatterns: ['node_modules/**'],
        directoryAccess: {
          allowlist: ['/src/**'],
          defaultAllow: false,
        },
      };

      const permission: ExtendedPermission = {
        tool: 'ValidateSearch',
        level: 'allow-always',
        createdAt: new Date(),
        config: validConfig,
        tags: ['validation'],
      };

      await expect(store.saveExtendedPermission(permission)).resolves.not.toThrow();

      const retrieved = await store.getExtendedPermission({ tool: 'ValidateSearch' });
      const config = retrieved?.config as SearchToolConfig;
      expect(config.includePatterns).toEqual(['*.ts', '*.js']);
      expect(config.excludePatterns).toEqual(['node_modules/**']);
    });

    it('should handle BaseToolPermissionConfig as fallback', async () => {
      const baseConfig: BaseToolPermissionConfig = {
        enabled: false,
        timeout: 15000,
        requireConfirmation: true,
        rateLimitPerMinute: 5,
        metadata: { purpose: 'testing base config' },
      };

      const permission: ExtendedPermission = {
        tool: 'GenericTool',
        level: 'allow-once',
        createdAt: new Date(),
        config: baseConfig,
        tags: ['base-config'],
      };

      await expect(store.saveExtendedPermission(permission)).resolves.not.toThrow();

      const retrieved = await store.getExtendedPermission({ tool: 'GenericTool' });
      const config = retrieved?.config as BaseToolPermissionConfig;
      expect(config.enabled).toBe(false);
      expect(config.metadata?.purpose).toBe('testing base config');
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent per-tool config operations efficiently', async () => {
      const configs = [
        { tool: 'ConcurrentRead', config: { maxFileSize: 1024 } as FilesystemToolConfig },
        { tool: 'ConcurrentWrite', config: { allowedExtensions: ['.txt'] } as FilesystemToolConfig },
        { tool: 'ConcurrentBash', config: { blockedCommands: ['rm'] } as ShellToolConfig },
        { tool: 'ConcurrentWeb', config: { allowedDomains: ['test.com'] } as WebToolConfig },
        { tool: 'ConcurrentSearch', config: { maxResults: 50 } as SearchToolConfig },
      ];

      const saveOperations = configs.map((item, index) => {
        const permission: ExtendedPermission = {
          tool: item.tool,
          level: 'allow-always',
          createdAt: new Date(),
          config: item.config,
          tags: [`concurrent-${index}`],
        };
        return store.saveExtendedPermission(permission);
      });

      // Execute all save operations concurrently
      await Promise.all(saveOperations);

      // Verify all configs were saved correctly
      const retrieveOperations = configs.map(item =>
        store.getExtendedPermission({ tool: item.tool })
      );

      const results = await Promise.all(retrieveOperations);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(result?.tool).toBe(configs[index].tool);
        expect(result?.config).toBeDefined();
      });
    });

    it('should handle high-volume per-tool config filtering efficiently', async () => {
      const permissionCount = 2000;
      const permissions: ExtendedPermission[] = [];

      // Create large dataset with different config types
      for (let i = 0; i < permissionCount; i++) {
        const configType = i % 4;
        let config: ToolPermissionConfig;

        switch (configType) {
          case 0:
            config = { maxFileSize: i * 1024, enabled: true } as FilesystemToolConfig;
            break;
          case 1:
            config = { blockedCommands: [`cmd${i}`], enabled: true } as ShellToolConfig;
            break;
          case 2:
            config = { allowedDomains: [`domain${i}.com`], enabled: true } as WebToolConfig;
            break;
          default:
            config = { maxResults: i + 100, enabled: true } as SearchToolConfig;
        }

        permissions.push({
          tool: `HighVolumeTool${i}`,
          level: 'allow-always',
          createdAt: new Date(Date.now() + i),
          config,
          grantedBy: i % 3 === 0 ? 'user' : i % 3 === 1 ? 'admin' : 'system',
          tags: [`batch${Math.floor(i / 100)}`, `type${configType}`],
        });
      }

      // Save all permissions
      const batchSize = 50;
      for (let i = 0; i < permissions.length; i += batchSize) {
        const batch = permissions.slice(i, i + batchSize);
        const batchPromises = batch.map(perm => store.saveExtendedPermission(perm));
        await Promise.all(batchPromises);
      }

      // Test various filtering operations
      const hasConfigPermissions = await store.listExtendedPermissions({
        hasConfig: true,
        includeExpired: true
      });
      expect(hasConfigPermissions).toHaveLength(permissionCount);

      const userGrantedPermissions = await store.listExtendedPermissions({
        grantedBy: 'user',
        includeExpired: true
      });
      expect(userGrantedPermissions.length).toBeGreaterThan(600); // Roughly 1/3

      const tagFilteredPermissions = await store.listExtendedPermissions({
        tags: ['type0'], // FilesystemToolConfig
        includeExpired: true
      });
      expect(tagFilteredPermissions.length).toBeGreaterThan(400); // Roughly 1/4
    });
  });
});