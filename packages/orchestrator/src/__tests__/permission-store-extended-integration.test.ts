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
  DirectoryAccessConfig,
} from '@apexcli/core';

/**
 * Integration tests for extended PermissionStore functionality
 * Tests real-world scenarios and complex workflows with extended permissions
 */
describe('PermissionStore Extended Integration Tests', () => {
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-extended-integration-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
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

  describe('Complete Development Workflow Scenarios', () => {
    it('should handle full-stack web development permission setup', async () => {
      // Frontend development permissions
      const frontendReadPermission: ExtendedPermission = {
        tool: 'Read',
        scope: '/src/frontend/**',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          maxFileSize: 5 * 1024 * 1024, // 5MB
          allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.html'],
          directoryAccess: {
            allowlist: ['/src/frontend/**', '/public/**'],
            blocklist: ['/src/frontend/secrets/**'],
            defaultAllow: false,
            resolveSymlinks: true,
            maxDepth: 10,
          },
        } as FilesystemToolConfig,
        grantReason: 'Frontend development requires read access to source files',
        grantedBy: 'developer',
        tags: ['frontend', 'development', 'readonly'],
      };

      const frontendWritePermission: ExtendedPermission = {
        tool: 'Write',
        scope: '/src/frontend/**',
        level: 'allow-once',
        expiry: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 30000,
          requireConfirmation: true,
          maxFileSize: 2 * 1024 * 1024, // 2MB per file
          allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss'],
          directoryAccess: {
            allowlist: ['/src/frontend/components/**', '/src/frontend/pages/**', '/src/frontend/styles/**'],
            blocklist: ['/src/frontend/config/**'],
            defaultAllow: false,
          },
        } as FilesystemToolConfig,
        grantReason: 'Limited write access for feature implementation',
        grantedBy: 'tech-lead',
        tags: ['frontend', 'development', 'write', 'temporary'],
      };

      // Backend API permissions
      const backendEditPermission: ExtendedPermission = {
        tool: 'Edit',
        scope: '/src/backend/api/**',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          directoryAccess: {
            allowlist: ['/src/backend/api/**', '/src/backend/models/**'],
            blocklist: ['/src/backend/api/admin/**'],
            defaultAllow: false,
          },
        } as FilesystemToolConfig,
        grantReason: 'API development and maintenance',
        grantedBy: 'backend-team',
        tags: ['backend', 'api', 'development'],
      };

      // Database migration permissions
      const dbMigrationPermission: ExtendedPermission = {
        tool: 'Bash',
        scope: 'npm run migrate',
        level: 'allow-once',
        expiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 300000, // 5 minutes
          requireConfirmation: true,
          directoryAccess: {
            allowlist: ['/src/backend/migrations/**', '/database/**'],
            defaultAllow: false,
          },
          blockedCommands: ['rm -rf', 'sudo', 'chmod 777'],
          allowElevatedPrivileges: false,
          environment: { NODE_ENV: 'development' },
          workingDirectory: '/project/root',
        } as ShellToolConfig,
        grantReason: 'Database schema migration for new feature',
        grantedBy: 'database-admin',
        tags: ['database', 'migration', 'critical', 'temporary'],
      };

      // External API access
      const apiAccessPermission: ExtendedPermission = {
        tool: 'WebFetch',
        scope: 'https://api.github.com/**',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 10000,
          allowedDomains: ['api.github.com', 'raw.githubusercontent.com'],
          blockedDomains: [],
          maxResponseSize: 10 * 1024 * 1024, // 10MB
          followRedirects: true,
          headers: {
            'User-Agent': 'APEX-Development-Bot/1.0',
            'Accept': 'application/json',
          },
        } as WebToolConfig,
        grantReason: 'Access to GitHub API for repository analysis',
        grantedBy: 'security-team',
        tags: ['api', 'github', 'external', 'approved'],
      };

      // Code search permissions
      const codeSearchPermission: ExtendedPermission = {
        tool: 'Grep',
        scope: 'security-patterns',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          maxResults: 500,
          includePatterns: ['*.ts', '*.js', '*.tsx', '*.jsx'],
          excludePatterns: ['node_modules/**', '*.test.*', 'dist/**'],
          directoryAccess: {
            allowlist: ['/src/**', '/lib/**'],
            blocklist: ['/src/secrets/**', '/src/config/private/**'],
            defaultAllow: false,
          },
        } as SearchToolConfig,
        grantReason: 'Security audit and code analysis',
        grantedBy: 'security-team',
        tags: ['security', 'audit', 'search'],
      };

      // Save all permissions
      const permissions = [
        frontendReadPermission,
        frontendWritePermission,
        backendEditPermission,
        dbMigrationPermission,
        apiAccessPermission,
        codeSearchPermission,
      ];

      for (const permission of permissions) {
        await store.saveExtendedPermission(permission);
      }

      // Test comprehensive queries
      const allPermissions = await store.listExtendedPermissions();
      expect(allPermissions).toHaveLength(6);

      // Test filtering by development team
      const frontendPerms = await store.listExtendedPermissions({ tags: ['frontend'] });
      expect(frontendPerms).toHaveLength(2);

      const securityPerms = await store.listExtendedPermissions({ tags: ['security'] });
      expect(securityPerms).toHaveLength(2);

      // Test filtering by permission level
      const temporaryPerms = await store.listExtendedPermissions({ level: 'allow-once' });
      expect(temporaryPerms).toHaveLength(2);

      // Test filtering by granter
      const securityTeamPerms = await store.listExtendedPermissions({ grantedBy: 'security-team' });
      expect(securityTeamPerms).toHaveLength(2);

      // Test specific permission retrieval
      const frontendRead = await store.getExtendedPermission({
        tool: 'Read',
        scope: '/src/frontend/**'
      });
      expect(frontendRead?.config).toBeDefined();
      expect((frontendRead?.config as FilesystemToolConfig)?.allowedExtensions).toContain('.tsx');

      // Test directory access configuration
      const dbMigrationDirAccess = await store.getDirectoryAccess({
        tool: 'Bash',
        scope: 'npm run migrate'
      });
      expect(dbMigrationDirAccess?.allowlist).toContain('/src/backend/migrations/**');

      // Test permission updates (e.g., extending expiry)
      const updatedFrontendWrite: ExtendedPermission = {
        ...frontendWritePermission,
        expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // Extended to 24 hours
        grantReason: 'Extended for critical feature completion',
        tags: [...frontendWritePermission.tags!, 'extended'],
      };

      await store.saveExtendedPermission(updatedFrontendWrite);

      const extendedPerm = await store.getExtendedPermission({
        tool: 'Write',
        scope: '/src/frontend/**'
      });
      expect(extendedPerm?.tags).toContain('extended');
      expect(extendedPerm?.grantReason).toContain('Extended for critical');
    });

    it('should handle DevOps automation workflow permissions', async () => {
      // CI/CD pipeline permissions
      const buildPermission: ExtendedPermission = {
        tool: 'Bash',
        scope: 'npm run build',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 600000, // 10 minutes
          requireConfirmation: false,
          rateLimitPerMinute: 5,
          directoryAccess: {
            allowlist: ['/src/**', '/dist/**', '/build/**'],
            blocklist: ['/src/secrets/**'],
            defaultAllow: false,
          },
          blockedCommands: [],
          allowElevatedPrivileges: false,
          environment: {
            NODE_ENV: 'production',
            BUILD_TARGET: 'web',
          },
        } as ShellToolConfig,
        grantReason: 'Automated build process for CI/CD pipeline',
        grantedBy: 'ci-system',
        tags: ['ci-cd', 'build', 'automation', 'production'],
      };

      const testPermission: ExtendedPermission = {
        tool: 'Bash',
        scope: 'npm test',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 900000, // 15 minutes
          requireConfirmation: false,
          rateLimitPerMinute: 10,
          directoryAccess: {
            allowlist: ['/src/**', '/tests/**', '/coverage/**'],
            defaultAllow: false,
          },
          environment: {
            NODE_ENV: 'test',
          },
        } as ShellToolConfig,
        grantReason: 'Automated test execution',
        grantedBy: 'ci-system',
        tags: ['ci-cd', 'testing', 'automation'],
      };

      // Deployment permissions
      const deployPermission: ExtendedPermission = {
        tool: 'Bash',
        scope: 'deploy-staging',
        level: 'allow-once',
        expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 1200000, // 20 minutes
          requireConfirmation: true,
          rateLimitPerMinute: 1,
          blockedCommands: ['rm -rf /', 'sudo rm', 'format'],
          allowElevatedPrivileges: false,
          environment: {
            ENVIRONMENT: 'staging',
            DEPLOY_KEY: 'staging-key',
          },
        } as ShellToolConfig,
        grantReason: 'Staging deployment for feature testing',
        grantedBy: 'devops-team',
        tags: ['deployment', 'staging', 'critical', 'supervised'],
      };

      // Monitoring and logging permissions
      const logAccessPermission: ExtendedPermission = {
        tool: 'Read',
        scope: '/var/log/application/**',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          maxFileSize: 100 * 1024 * 1024, // 100MB
          allowedExtensions: ['.log', '.txt'],
          directoryAccess: {
            allowlist: ['/var/log/application/**', '/var/log/nginx/**'],
            blocklist: ['/var/log/system/**'],
            defaultAllow: false,
            maxDepth: 5,
          },
        } as FilesystemToolConfig,
        grantReason: 'Application monitoring and debugging',
        grantedBy: 'devops-team',
        tags: ['monitoring', 'logs', 'debugging'],
      };

      // Health check permissions
      const healthCheckPermission: ExtendedPermission = {
        tool: 'WebFetch',
        scope: 'https://api.internal.company.com/health',
        level: 'allow-always',
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 5000,
          allowedDomains: ['api.internal.company.com'],
          maxResponseSize: 1024, // 1KB
          followRedirects: false,
          headers: {
            'User-Agent': 'APEX-Health-Monitor/1.0',
          },
        } as WebToolConfig,
        grantReason: 'Automated health monitoring',
        grantedBy: 'monitoring-system',
        tags: ['monitoring', 'health-check', 'automation', 'internal'],
      };

      // Save all DevOps permissions
      const devopsPermissions = [
        buildPermission,
        testPermission,
        deployPermission,
        logAccessPermission,
        healthCheckPermission,
      ];

      for (const permission of devopsPermissions) {
        await store.saveExtendedPermission(permission);
      }

      // Test DevOps-specific queries
      const automationPerms = await store.listExtendedPermissions({ tags: ['automation'] });
      expect(automationPerms).toHaveLength(3);

      const ciSystemPerms = await store.listExtendedPermissions({ grantedBy: 'ci-system' });
      expect(ciSystemPerms).toHaveLength(2);

      const criticalPerms = await store.listExtendedPermissions({ tags: ['critical'] });
      expect(criticalPerms).toHaveLength(1);

      // Test configuration-based filtering
      const confirmationRequired = await store.listExtendedPermissions({ hasConfig: true });
      const requireConfirmation = confirmationRequired.filter(p => {
        const config = p.config as any;
        return config?.requireConfirmation === true;
      });
      expect(requireConfirmation).toHaveLength(1);
      expect(requireConfirmation[0].tool).toBe('Bash');
      expect(requireConfirmation[0].scope).toBe('deploy-staging');

      // Test environment variable access
      const deployPerm = await store.getExtendedPermission({
        tool: 'Bash',
        scope: 'deploy-staging'
      });
      const deployConfig = deployPerm?.config as ShellToolConfig;
      expect(deployConfig?.environment?.ENVIRONMENT).toBe('staging');

      // Test rate limiting configuration
      const buildPerm = await store.getExtendedPermission({
        tool: 'Bash',
        scope: 'npm run build'
      });
      const buildConfig = buildPerm?.config as ShellToolConfig;
      expect(buildConfig?.rateLimitPerMinute).toBe(5);
    });
  });

  describe('Permission Management Workflows', () => {
    it('should handle permission escalation and review workflow', async () => {
      // Initial restrictive permission
      const initialPermission: ExtendedPermission = {
        tool: 'Write',
        scope: '/src/critical/**',
        level: 'deny',
        createdAt: new Date(),
        grantReason: 'Critical files require special approval',
        grantedBy: 'security-policy',
        tags: ['critical', 'restricted', 'security'],
      };

      await store.saveExtendedPermission(initialPermission);

      // Developer requests access
      const requestedPermission: ExtendedPermission = {
        tool: 'Write',
        scope: '/src/critical/**',
        level: 'allow-once',
        expiry: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        createdAt: new Date(),
        config: {
          enabled: true,
          timeout: 30000,
          requireConfirmation: true,
          rateLimitPerMinute: 2,
          maxFileSize: 500 * 1024, // 500KB
          directoryAccess: {
            allowlist: ['/src/critical/components/**'],
            blocklist: ['/src/critical/security/**', '/src/critical/config/**'],
            defaultAllow: false,
          },
        } as FilesystemToolConfig,
        grantReason: 'Bug fix in critical component - JIRA-123',
        grantedBy: 'developer-john',
        tags: ['critical', 'bugfix', 'temporary', 'pending-review'],
      };

      await store.saveExtendedPermission(requestedPermission);

      // Security review and approval
      const approvedPermission: ExtendedPermission = {
        ...requestedPermission,
        grantReason: 'Bug fix approved by security team - JIRA-123',
        grantedBy: 'security-team-lead',
        tags: ['critical', 'bugfix', 'temporary', 'approved'],
      };

      await store.saveExtendedPermission(approvedPermission);

      // Verify approval workflow
      const finalPermission = await store.getExtendedPermission({
        tool: 'Write',
        scope: '/src/critical/**'
      });

      expect(finalPermission?.level).toBe('allow-once');
      expect(finalPermission?.grantedBy).toBe('security-team-lead');
      expect(finalPermission?.tags).toContain('approved');
      expect(finalPermission?.tags).not.toContain('pending-review');

      // Test audit trail
      const approvedPerms = await store.listExtendedPermissions({ tags: ['approved'] });
      expect(approvedPerms).toHaveLength(1);

      const securityTeamPerms = await store.listExtendedPermissions({ grantedBy: 'security-team-lead' });
      expect(securityTeamPerms).toHaveLength(1);

      // Test configuration restrictions
      const config = finalPermission?.config as FilesystemToolConfig;
      expect(config?.requireConfirmation).toBe(true);
      expect(config?.rateLimitPerMinute).toBe(2);
      expect(config?.directoryAccess?.blocklist).toContain('/src/critical/security/**');
    });

    it('should handle bulk permission management for team onboarding', async () => {
      // Define team-based permission templates
      const juniorDeveloperPermissions: ExtendedPermission[] = [
        {
          tool: 'Read',
          scope: '/src/frontend/**',
          level: 'allow-always',
          createdAt: new Date(),
          config: {
            enabled: true,
            directoryAccess: {
              allowlist: ['/src/frontend/components/**', '/src/frontend/utils/**'],
              blocklist: ['/src/frontend/admin/**'],
              defaultAllow: false,
            },
          } as FilesystemToolConfig,
          grantReason: 'Junior developer onboarding - read access',
          grantedBy: 'hr-system',
          tags: ['junior-dev', 'onboarding', 'frontend', 'readonly'],
        },
        {
          tool: 'Write',
          scope: '/src/frontend/components/**',
          level: 'allow-once',
          expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          createdAt: new Date(),
          config: {
            enabled: true,
            requireConfirmation: true,
            maxFileSize: 100 * 1024, // 100KB
            allowedExtensions: ['.tsx', '.css'],
            directoryAccess: {
              allowlist: ['/src/frontend/components/ui/**'],
              defaultAllow: false,
            },
          } as FilesystemToolConfig,
          grantReason: 'Junior developer onboarding - limited write access',
          grantedBy: 'hr-system',
          tags: ['junior-dev', 'onboarding', 'frontend', 'write', 'supervised'],
        },
      ];

      const seniorDeveloperPermissions: ExtendedPermission[] = [
        {
          tool: 'Read',
          scope: '/**',
          level: 'allow-always',
          createdAt: new Date(),
          config: {
            enabled: true,
            directoryAccess: {
              blocklist: ['/secrets/**', '/config/production/**'],
              defaultAllow: true,
            },
          } as FilesystemToolConfig,
          grantReason: 'Senior developer - full read access',
          grantedBy: 'hr-system',
          tags: ['senior-dev', 'onboarding', 'full-access'],
        },
        {
          tool: 'Edit',
          scope: '/src/**',
          level: 'allow-always',
          createdAt: new Date(),
          config: {
            enabled: true,
            directoryAccess: {
              allowlist: ['/src/**'],
              blocklist: ['/src/config/production/**'],
              defaultAllow: false,
            },
          } as FilesystemToolConfig,
          grantReason: 'Senior developer - source code edit access',
          grantedBy: 'hr-system',
          tags: ['senior-dev', 'onboarding', 'edit-access'],
        },
        {
          tool: 'Bash',
          scope: 'npm run *',
          level: 'allow-always',
          createdAt: new Date(),
          config: {
            enabled: true,
            timeout: 300000,
            blockedCommands: ['sudo', 'rm -rf /', 'chmod 777'],
            environment: { NODE_ENV: 'development' },
          } as ShellToolConfig,
          grantReason: 'Senior developer - npm script execution',
          grantedBy: 'hr-system',
          tags: ['senior-dev', 'onboarding', 'shell-access'],
        },
      ];

      // Simulate onboarding multiple developers
      const onboardingBatch = [
        ...juniorDeveloperPermissions.map(p => ({ ...p, tags: [...p.tags!, 'batch-onboarding-junior'] })),
        ...seniorDeveloperPermissions.map(p => ({ ...p, tags: [...p.tags!, 'batch-onboarding-senior'] })),
      ];

      // Save all permissions
      for (const permission of onboardingBatch) {
        await store.saveExtendedPermission(permission);
      }

      // Test batch operations
      const allOnboardingPerms = await store.listExtendedPermissions({ tags: ['onboarding'] });
      expect(allOnboardingPerms).toHaveLength(5);

      const juniorPerms = await store.listExtendedPermissions({ tags: ['junior-dev'] });
      expect(juniorPerms).toHaveLength(2);

      const seniorPerms = await store.listExtendedPermissions({ tags: ['senior-dev'] });
      expect(seniorPerms).toHaveLength(3);

      // Test permission level distribution
      const writeOncePerms = await store.listExtendedPermissions({
        level: 'allow-once',
        tags: ['onboarding']
      });
      expect(writeOncePerms).toHaveLength(1); // Only junior write permission

      const alwaysPerms = await store.listExtendedPermissions({
        level: 'allow-always',
        tags: ['onboarding']
      });
      expect(alwaysPerms).toHaveLength(4);

      // Test configuration consistency
      const supervisedPerms = await store.listExtendedPermissions({ tags: ['supervised'] });
      expect(supervisedPerms).toHaveLength(1);

      const supervisedConfig = supervisedPerms[0].config as FilesystemToolConfig;
      expect(supervisedConfig?.requireConfirmation).toBe(true);
      expect(supervisedConfig?.maxFileSize).toBe(100 * 1024);
    });
  });

  describe('Complex Query Scenarios', () => {
    beforeEach(async () => {
      // Set up a complex permission dataset
      const complexPermissions: ExtendedPermission[] = [
        // Frontend team permissions
        {
          tool: 'Read',
          scope: '/frontend/**',
          level: 'allow-always',
          createdAt: new Date('2024-01-01'),
          grantedBy: 'frontend-lead',
          tags: ['frontend', 'team-perm', 'stable'],
        },
        {
          tool: 'Write',
          scope: '/frontend/components/**',
          level: 'allow-once',
          expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date('2024-01-02'),
          grantedBy: 'frontend-lead',
          tags: ['frontend', 'temporary', 'feature-work'],
        },
        // Backend team permissions
        {
          tool: 'Edit',
          scope: '/backend/**',
          level: 'allow-always',
          createdAt: new Date('2024-01-01'),
          config: { enabled: true, timeout: 30000 } as any,
          grantedBy: 'backend-lead',
          tags: ['backend', 'team-perm', 'stable'],
        },
        {
          tool: 'Bash',
          scope: 'docker-compose *',
          level: 'allow-once',
          expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdAt: new Date('2024-01-03'),
          config: { enabled: true, requireConfirmation: true } as any,
          grantedBy: 'devops-team',
          tags: ['backend', 'docker', 'infrastructure', 'temporary'],
        },
        // Security team permissions
        {
          tool: 'Grep',
          scope: 'security-audit',
          level: 'allow-always',
          createdAt: new Date('2024-01-01'),
          config: {
            enabled: true,
            maxResults: 1000,
            excludePatterns: ['*.test.*'],
          } as any,
          grantedBy: 'security-team',
          tags: ['security', 'audit', 'monitoring'],
        },
        // External access permissions
        {
          tool: 'WebFetch',
          scope: 'https://api.external.com/**',
          level: 'deny',
          createdAt: new Date('2024-01-04'),
          grantReason: 'Security policy - external access restricted',
          grantedBy: 'security-policy',
          tags: ['external', 'security', 'blocked'],
        },
      ];

      for (const permission of complexPermissions) {
        await store.saveExtendedPermission(permission);
      }
    });

    it('should handle complex multi-criteria queries', async () => {
      // Test multiple tag filtering
      const frontendAndTemp = await store.listExtendedPermissions({
        tags: ['frontend', 'temporary']
      });
      expect(frontendAndTemp).toHaveLength(1);
      expect(frontendAndTemp[0].scope).toBe('/frontend/components/**');

      // Test granter and level combination
      const frontendLeadAlways = await store.listExtendedPermissions({
        grantedBy: 'frontend-lead',
        level: 'allow-always'
      });
      expect(frontendLeadAlways).toHaveLength(1);
      expect(frontendLeadAlways[0].scope).toBe('/frontend/**');

      // Test config presence with other filters
      const backendWithConfig = await store.listExtendedPermissions({
        tags: ['backend'],
        hasConfig: true
      });
      expect(backendWithConfig).toHaveLength(2);

      // Test security permissions
      const securityPerms = await store.listExtendedPermissions({
        tags: ['security']
      });
      expect(securityPerms).toHaveLength(2);

      const securityBlocked = await store.listExtendedPermissions({
        tags: ['security'],
        level: 'deny'
      });
      expect(securityBlocked).toHaveLength(1);
    });

    it('should handle temporal queries and expiry management', async () => {
      // Test including expired permissions
      const allPermsWithExpired = await store.listExtendedPermissions({
        includeExpired: true
      });
      expect(allPermsWithExpired).toHaveLength(6);

      // Test filtering by temporary permissions (has expiry)
      const allPerms = await store.listExtendedPermissions();
      const temporaryPerms = allPerms.filter(p => p.expiry !== undefined);
      expect(temporaryPerms).toHaveLength(2);

      // Test stable permissions (no expiry)
      const stablePerms = await store.listExtendedPermissions({ tags: ['stable'] });
      expect(stablePerms).toHaveLength(2);
      stablePerms.forEach(perm => {
        expect(perm.expiry).toBeUndefined();
      });

      // Clean up expired permissions and verify
      const expiredCount = await store.clearExpired();
      expect(expiredCount).toBe(0); // None should be expired yet

      // Test team-based grouping
      const teamPerms = await store.listExtendedPermissions({ tags: ['team-perm'] });
      expect(teamPerms).toHaveLength(2);
    });
  });

  describe('Real-world Performance and Scale', () => {
    it('should handle realistic enterprise permission load', async () => {
      const startTime = Date.now();

      // Simulate enterprise-scale permission dataset
      const enterprisePermissions: ExtendedPermission[] = [];

      // 1000 developers across 50 teams
      for (let teamId = 1; teamId <= 50; teamId++) {
        for (let devId = 1; devId <= 20; devId++) {
          const userId = `dev${teamId}-${devId}`;

          // Basic read permissions
          enterprisePermissions.push({
            tool: 'Read',
            scope: `/team${teamId}/**`,
            level: 'allow-always',
            createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Random within 90 days
            config: {
              enabled: true,
              directoryAccess: {
                allowlist: [`/team${teamId}/**`, '/shared/**'],
                defaultAllow: false,
              },
            } as any,
            grantedBy: `team-lead-${teamId}`,
            tags: [`team-${teamId}`, 'developer', 'read-access'],
          });

          // Conditional write permissions (50% of developers)
          if (devId <= 10) {
            enterprisePermissions.push({
              tool: 'Write',
              scope: `/team${teamId}/src/**`,
              level: 'allow-always',
              createdAt: new Date(),
              config: {
                enabled: true,
                requireConfirmation: teamId <= 10, // High-security teams
                maxFileSize: 5 * 1024 * 1024,
                directoryAccess: {
                  allowlist: [`/team${teamId}/src/**`],
                  blocklist: [`/team${teamId}/src/config/**`],
                  defaultAllow: false,
                },
              } as any,
              grantedBy: `tech-lead-${teamId}`,
              tags: [`team-${teamId}`, 'senior-dev', 'write-access'],
            });
          }

          // Shell access for senior developers (20% of developers)
          if (devId <= 4) {
            enterprisePermissions.push({
              tool: 'Bash',
              scope: 'development-commands',
              level: 'allow-always',
              createdAt: new Date(),
              config: {
                enabled: true,
                timeout: 300000,
                blockedCommands: ['sudo', 'rm -rf /', 'chmod 777'],
                environment: { TEAM_ID: teamId.toString() },
              } as any,
              grantedBy: `devops-lead-${teamId}`,
              tags: [`team-${teamId}`, 'senior-dev', 'shell-access'],
            });
          }
        }
      }

      // Add some cross-cutting permissions
      for (let i = 1; i <= 100; i++) {
        enterprisePermissions.push({
          tool: 'WebFetch',
          scope: 'https://internal-api.company.com/**',
          level: 'allow-always',
          createdAt: new Date(),
          config: {
            enabled: true,
            allowedDomains: ['internal-api.company.com'],
            headers: { 'Team-ID': `team-${i % 50 + 1}` },
          } as any,
          grantedBy: 'api-gateway',
          tags: ['api-access', 'internal', `team-${i % 50 + 1}`],
        });
      }

      // Save all permissions (should be 50*20 + 50*10 + 50*4 + 100 = 1000 + 500 + 200 + 100 = 1800 permissions)
      console.log(`Creating ${enterprisePermissions.length} permissions...`);

      const batchSize = 100;
      for (let i = 0; i < enterprisePermissions.length; i += batchSize) {
        const batch = enterprisePermissions.slice(i, i + batchSize);
        const batchPromises = batch.map(p => store.saveExtendedPermission(p));
        await Promise.all(batchPromises);
      }

      const createTime = Date.now() - startTime;
      console.log(`Created ${enterprisePermissions.length} permissions in ${createTime}ms`);
      expect(createTime).toBeLessThan(60000); // Should complete within 60 seconds

      // Test various enterprise queries
      const queryStart = Date.now();

      // Team-based queries
      const team1Permissions = await store.listExtendedPermissions({ tags: ['team-1'] });
      expect(team1Permissions.length).toBe(22); // 20 read + 10 write + 4 shell + some API access

      const allSeniorDevs = await store.listExtendedPermissions({ tags: ['senior-dev'] });
      expect(allSeniorDevs.length).toBe(700); // 50 teams * (10 write + 4 shell)

      const apiAccessPerms = await store.listExtendedPermissions({ tags: ['api-access'] });
      expect(apiAccessPerms.length).toBe(100);

      // Security-focused queries
      const confirmationRequired = await store.listExtendedPermissions({ hasConfig: true });
      const requireConfirmation = confirmationRequired.filter(p => {
        const config = p.config as any;
        return config?.requireConfirmation === true;
      });
      expect(requireConfirmation.length).toBe(100); // Teams 1-10 write permissions

      const shellAccess = await store.listExtendedPermissions({ tool: 'Bash' });
      expect(shellAccess.length).toBe(200); // 50 teams * 4 senior devs

      // Test granter-based queries
      const team1Leader = await store.listExtendedPermissions({ grantedBy: 'team-lead-1' });
      expect(team1Leader.length).toBe(20);

      const queryTime = Date.now() - queryStart;
      console.log(`Executed enterprise queries in ${queryTime}ms`);
      expect(queryTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Test cleanup operations
      const cleanupStart = Date.now();

      // Clear permissions for one team
      const team50Perms = await store.listExtendedPermissions({ tags: ['team-50'] });
      const initialCount = team50Perms.length;
      expect(initialCount).toBeGreaterThan(0);

      for (const perm of team50Perms) {
        await store.clearPermission({ tool: perm.tool, scope: perm.scope });
      }

      const afterCleanup = await store.listExtendedPermissions({ tags: ['team-50'] });
      expect(afterCleanup.length).toBe(0);

      const cleanupTime = Date.now() - cleanupStart;
      console.log(`Cleaned up ${initialCount} permissions in ${cleanupTime}ms`);
      expect(cleanupTime).toBeLessThan(5000);
    });
  });
});