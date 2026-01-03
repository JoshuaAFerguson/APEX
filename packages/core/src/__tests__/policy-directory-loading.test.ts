import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  loadConfig,
  saveConfig,
  getEffectiveConfig,
} from '../config.js';
import {
  ApexConfig,
  Policy,
  PolicyConfig,
} from '../types.js';

describe('Policy Directory-Based Loading Tests', () => {
  let testDir: string;
  let policiesDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-policy-dir-loading-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    policiesDir = path.join(testDir, '.apex', 'policies');
    await fs.mkdir(policiesDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('External Policy Files Loading Simulation', () => {
    it('should handle policy configuration with external policy references', async () => {
      // Create base config that might reference external policies
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'external-policy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        // Main policy in config
        policy: {
          name: 'Base Project Policy',
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**/*.ts', 'tests/**/*.test.ts'],
            block: ['node_modules/**'],
          },
          enabled: true,
          tags: ['base'],
        },
        // Additional policies that could be loaded from external files
        policies: [
          {
            id: 'security-policy',
            name: 'Security Policy',
            description: 'Security-focused policy rules',
            rules: [
              {
                id: 'sensitive-files',
                type: 'path',
                name: 'Sensitive Files Rule',
                description: 'Blocks access to sensitive files',
                patterns: ['.env*', '**/*.key', '**/secrets/**'],
                enforcement: 'strict',
                enabled: true,
              },
            ],
            enabled: true,
            enforcement: 'strict',
            tags: ['security', 'external'],
          },
          {
            id: 'testing-policy',
            name: 'Testing Policy',
            description: 'Test coverage requirements',
            rules: [
              {
                id: 'test-coverage',
                type: 'test',
                name: 'Test Coverage Rule',
                description: 'Requires test coverage for source files',
                patterns: ['src/**/*.ts'],
                enforcement: 'warn',
                enabled: true,
              },
            ],
            enabled: true,
            enforcement: 'warn',
            tags: ['testing', 'external'],
          },
        ],
      };

      await saveConfig(testDir, baseConfig);
      const loaded = await loadConfig(testDir);

      // Verify main policy is loaded
      expect(loaded.policy?.name).toBe('Base Project Policy');
      expect(loaded.policy?.enforcement).toBe('warn');

      // Verify external policies are loaded
      expect(loaded.policies).toHaveLength(2);
      expect(loaded.policies?.find(p => p.id === 'security-policy')).toBeDefined();
      expect(loaded.policies?.find(p => p.id === 'testing-policy')).toBeDefined();

      // Verify security policy details
      const securityPolicy = loaded.policies?.find(p => p.id === 'security-policy');
      expect(securityPolicy?.enforcement).toBe('strict');
      expect(securityPolicy?.rules).toHaveLength(1);
      expect(securityPolicy?.rules[0].patterns).toContain('.env*');

      // Verify testing policy details
      const testingPolicy = loaded.policies?.find(p => p.id === 'testing-policy');
      expect(testingPolicy?.enforcement).toBe('warn');
      expect(testingPolicy?.rules).toHaveLength(1);
      expect(testingPolicy?.tags).toContain('external');
    });

    it('should handle policy files in separate YAML files (simulation)', async () => {
      // Simulate loading policies from separate files by creating them in policies directory
      // and then manually loading them to build the config

      // Create individual policy files
      const securityPolicy = {
        id: 'security-from-file',
        name: 'Security Policy from File',
        description: 'Security policy loaded from external file',
        rules: [
          {
            id: 'file-access-security',
            type: 'path',
            name: 'File Access Security',
            description: 'Controls access to security-sensitive files',
            patterns: [
              '.env*',
              '**/*.key',
              '**/*.pem',
              '**/*.p12',
              '**/config/prod*',
              '**/secrets/**',
            ],
            enforcement: 'strict',
            enabled: true,
          },
          {
            id: 'content-security',
            type: 'approval',
            name: 'Content Security',
            description: 'Requires approval for security-sensitive content',
            patterns: ['password', 'api_key', 'secret'],
            enforcement: 'strict',
            enabled: true,
          },
        ],
        severityLevels: {
          default: 'error',
          overrides: {
            'critical': 'error',
            'high': 'warn',
          },
        },
        enabled: true,
        enforcement: 'strict',
        tags: ['security', 'file-based'],
        metadata: {
          source: 'security-team',
          loadedFrom: 'policies/security.yaml',
        },
      };

      const compliancePolicy = {
        id: 'compliance-from-file',
        name: 'Compliance Policy from File',
        description: 'Compliance policy loaded from external file',
        rules: [
          {
            id: 'audit-trail',
            type: 'approval',
            name: 'Audit Trail',
            description: 'Requires audit trail for certain operations',
            patterns: ['**/*'],
            enforcement: 'audit',
            enabled: true,
          },
          {
            id: 'data-protection',
            type: 'path',
            name: 'Data Protection',
            description: 'Protects sensitive data files',
            patterns: ['**/data/**', '**/customer/**', '**/pii/**'],
            enforcement: 'strict',
            enabled: true,
          },
        ],
        enabled: true,
        enforcement: 'audit',
        tags: ['compliance', 'gdpr', 'file-based'],
        metadata: {
          source: 'legal-team',
          loadedFrom: 'policies/compliance.yaml',
          complianceFramework: 'GDPR',
        },
      };

      // Write policy files
      await fs.writeFile(
        path.join(policiesDir, 'security.yaml'),
        yaml.stringify(securityPolicy),
        'utf-8'
      );
      await fs.writeFile(
        path.join(policiesDir, 'compliance.yaml'),
        yaml.stringify(compliancePolicy),
        'utf-8'
      );

      // Simulate loading these policies and merging with main config
      const securityYaml = await fs.readFile(path.join(policiesDir, 'security.yaml'), 'utf-8');
      const complianceYaml = await fs.readFile(path.join(policiesDir, 'compliance.yaml'), 'utf-8');

      const loadedSecurityPolicy = yaml.parse(securityYaml);
      const loadedCompliancePolicy = yaml.parse(complianceYaml);

      // Create main config with loaded policies
      const configWithFileBasedPolicies: ApexConfig = {
        version: '1.0',
        project: {
          name: 'file-based-policy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          name: 'Main Policy',
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**', 'tests/**'],
          },
          enabled: true,
          tags: ['main'],
        },
        policies: [loadedSecurityPolicy, loadedCompliancePolicy],
      };

      await saveConfig(testDir, configWithFileBasedPolicies);
      const loaded = await loadConfig(testDir);

      // Verify all policies are loaded correctly
      expect(loaded.policies).toHaveLength(2);

      const loadedSecurity = loaded.policies?.find(p => p.id === 'security-from-file');
      expect(loadedSecurity).toBeDefined();
      expect(loadedSecurity?.name).toBe('Security Policy from File');
      expect(loadedSecurity?.rules).toHaveLength(2);
      expect(loadedSecurity?.metadata?.source).toBe('security-team');
      expect(loadedSecurity?.metadata?.loadedFrom).toBe('policies/security.yaml');

      const loadedCompliance = loaded.policies?.find(p => p.id === 'compliance-from-file');
      expect(loadedCompliance).toBeDefined();
      expect(loadedCompliance?.name).toBe('Compliance Policy from File');
      expect(loadedCompliance?.rules).toHaveLength(2);
      expect(loadedCompliance?.metadata?.complianceFramework).toBe('GDPR');
    });

    it('should handle policy inheritance and overrides from multiple sources', async () => {
      // Create base organizational policy
      const orgPolicy = {
        id: 'org-base-policy',
        name: 'Organization Base Policy',
        description: 'Base policy for all projects in organization',
        rules: [
          {
            id: 'org-security-baseline',
            type: 'path',
            name: 'Organization Security Baseline',
            description: 'Standard security rules for all projects',
            patterns: ['.env*', '**/*.key', '**/secrets/**'],
            enforcement: 'strict',
            enabled: true,
          },
        ],
        enabled: true,
        enforcement: 'warn', // Base level
        tags: ['organization', 'baseline'],
        metadata: {
          level: 'organization',
          priority: 1,
          inheritable: true,
        },
      };

      // Create team-specific policy
      const teamPolicy = {
        id: 'team-frontend-policy',
        name: 'Frontend Team Policy',
        description: 'Specific policy for frontend team projects',
        rules: [
          {
            id: 'frontend-testing',
            type: 'test',
            name: 'Frontend Testing Rules',
            description: 'Testing requirements for frontend code',
            patterns: ['src/components/**/*.tsx', 'src/hooks/**/*.ts'],
            enforcement: 'warn',
            enabled: true,
          },
          {
            id: 'frontend-assets',
            type: 'path',
            name: 'Frontend Asset Rules',
            description: 'Rules for frontend assets',
            patterns: ['public/**/*.{png,jpg,svg}', 'src/**/*.{css,scss}'],
            enforcement: 'warn',
            enabled: true,
          },
        ],
        enabled: true,
        enforcement: 'warn',
        tags: ['team', 'frontend'],
        metadata: {
          level: 'team',
          priority: 2,
          inherits: ['org-base-policy'],
        },
      };

      // Create project-specific policy (highest priority)
      const projectPolicy = {
        id: 'project-specific-policy',
        name: 'Project Specific Policy',
        description: 'Custom rules for this specific project',
        rules: [
          {
            id: 'project-custom-security',
            type: 'path',
            name: 'Project Custom Security',
            description: 'Project-specific security overrides',
            patterns: ['**/*.secret', 'config/prod/**'],
            enforcement: 'strict', // Override base enforcement
            enabled: true,
          },
        ],
        enabled: true,
        enforcement: 'strict', // Override team/org enforcement
        tags: ['project', 'custom'],
        metadata: {
          level: 'project',
          priority: 3,
          inherits: ['org-base-policy', 'team-frontend-policy'],
          overrides: {
            enforcement: 'strict', // Override inherited enforcement
          },
        },
      };

      // Save policies to files
      await fs.writeFile(
        path.join(policiesDir, 'org-base.yaml'),
        yaml.stringify(orgPolicy),
        'utf-8'
      );
      await fs.writeFile(
        path.join(policiesDir, 'team-frontend.yaml'),
        yaml.stringify(teamPolicy),
        'utf-8'
      );
      await fs.writeFile(
        path.join(policiesDir, 'project-specific.yaml'),
        yaml.stringify(projectPolicy),
        'utf-8'
      );

      // Create config that combines all policy levels
      const hierarchicalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'hierarchical-policy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: [orgPolicy, teamPolicy, projectPolicy],
      };

      await saveConfig(testDir, hierarchicalConfig);
      const loaded = await loadConfig(testDir);

      // Verify all policy levels are loaded
      expect(loaded.policies).toHaveLength(3);

      // Verify inheritance chain
      const orgPol = loaded.policies?.find(p => p.id === 'org-base-policy');
      const teamPol = loaded.policies?.find(p => p.id === 'team-frontend-policy');
      const projPol = loaded.policies?.find(p => p.id === 'project-specific-policy');

      expect(orgPol?.metadata?.priority).toBe(1);
      expect(teamPol?.metadata?.priority).toBe(2);
      expect(projPol?.metadata?.priority).toBe(3);

      // Verify overrides
      expect(orgPol?.enforcement).toBe('warn');
      expect(teamPol?.enforcement).toBe('warn');
      expect(projPol?.enforcement).toBe('strict'); // Override

      // Verify rule accumulation
      expect(orgPol?.rules).toHaveLength(1);
      expect(teamPol?.rules).toHaveLength(2);
      expect(projPol?.rules).toHaveLength(1);

      // Total unique rules across all policies
      const allRules = [
        ...(orgPol?.rules || []),
        ...(teamPol?.rules || []),
        ...(projPol?.rules || []),
      ];
      expect(allRules).toHaveLength(4);
    });

    it('should handle missing policy files gracefully', async () => {
      // Create config that references non-existent policy files
      const configWithMissingFiles: ApexConfig = {
        version: '1.0',
        project: {
          name: 'missing-files-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          name: 'Main Policy',
          enforcement: 'warn',
          allowedPaths: {
            allow: ['src/**'],
          },
          enabled: true,
          metadata: {
            externalPolicies: [
              'policies/non-existent.yaml',
              'policies/also-missing.yaml',
              'policies/phantom-policy.yaml',
            ],
          },
        },
        // Empty policies array - simulates failed loading from missing files
        policies: [],
      };

      // This should work fine - missing files don't break config loading
      await saveConfig(testDir, configWithMissingFiles);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.name).toBe('Main Policy');
      expect(loaded.policies).toEqual([]);
      expect(loaded.policy?.metadata?.externalPolicies).toHaveLength(3);

      // getEffectiveConfig should still work with missing external policies
      const effective = getEffectiveConfig(loaded);
      expect(effective.policy.enforcement).toBe('warn');
      expect(effective.policies).toEqual([]);
    });

    it('should handle policy file conflicts and merging strategies', async () => {
      // Create conflicting policies (same IDs, different rules)
      const policy1 = {
        id: 'conflicting-policy',
        name: 'Policy Version 1',
        description: 'First version of conflicting policy',
        rules: [
          {
            id: 'shared-rule',
            type: 'path',
            name: 'Shared Rule v1',
            description: 'Version 1 of shared rule',
            patterns: ['src/**/*.ts'],
            enforcement: 'warn',
            enabled: true,
          },
        ],
        enabled: true,
        enforcement: 'warn',
        tags: ['version1'],
        metadata: {
          version: '1.0',
          source: 'team-a',
        },
      };

      const policy2 = {
        id: 'conflicting-policy', // Same ID!
        name: 'Policy Version 2',
        description: 'Second version of conflicting policy',
        rules: [
          {
            id: 'shared-rule',
            type: 'path',
            name: 'Shared Rule v2',
            description: 'Version 2 of shared rule',
            patterns: ['src/**/*.ts', 'lib/**/*.ts'], // Extended patterns
            enforcement: 'strict', // Different enforcement
            enabled: true,
          },
          {
            id: 'new-rule',
            type: 'test',
            name: 'New Rule',
            description: 'New rule in version 2',
            patterns: ['**/*.test.ts'],
            enforcement: 'warn',
            enabled: true,
          },
        ],
        enabled: true,
        enforcement: 'strict', // Different enforcement
        tags: ['version2'],
        metadata: {
          version: '2.0',
          source: 'team-b',
        },
      };

      // Save conflicting policies
      await fs.writeFile(
        path.join(policiesDir, 'policy-v1.yaml'),
        yaml.stringify(policy1),
        'utf-8'
      );
      await fs.writeFile(
        path.join(policiesDir, 'policy-v2.yaml'),
        yaml.stringify(policy2),
        'utf-8'
      );

      // Config with both conflicting policies
      const conflictingConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'conflict-resolution-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: [policy1, policy2], // Both versions
      };

      await saveConfig(testDir, conflictingConfig);
      const loaded = await loadConfig(testDir);

      // Should load both policies (even with conflicting IDs)
      // In a real system, conflict resolution would be handled by policy loader
      expect(loaded.policies).toHaveLength(2);

      // Both policies should be preserved as-is
      const policies = loaded.policies || [];
      expect(policies.filter(p => p.id === 'conflicting-policy')).toHaveLength(2);

      // Verify both versions are distinct
      const v1 = policies.find(p => p.metadata?.version === '1.0');
      const v2 = policies.find(p => p.metadata?.version === '2.0');

      expect(v1?.enforcement).toBe('warn');
      expect(v2?.enforcement).toBe('strict');
      expect(v1?.rules).toHaveLength(1);
      expect(v2?.rules).toHaveLength(2);
    });

    it('should handle complex directory structures for policy organization', async () => {
      // Create nested directory structure for policies
      const securityDir = path.join(policiesDir, 'security');
      const complianceDir = path.join(policiesDir, 'compliance');
      const teamDir = path.join(policiesDir, 'teams', 'frontend');
      const projectDir = path.join(policiesDir, 'projects', 'special');

      await fs.mkdir(securityDir, { recursive: true });
      await fs.mkdir(complianceDir, { recursive: true });
      await fs.mkdir(teamDir, { recursive: true });
      await fs.mkdir(projectDir, { recursive: true });

      // Create policies in different directories
      const policies = [
        {
          file: path.join(securityDir, 'authentication.yaml'),
          policy: {
            id: 'security-auth',
            name: 'Authentication Security',
            rules: [{ id: 'auth-rule', type: 'path', name: 'Auth Rule', patterns: ['**/auth/**'], enforcement: 'strict', enabled: true }],
            enabled: true,
            enforcement: 'strict',
            tags: ['security', 'auth'],
            metadata: { directory: 'security' },
          },
        },
        {
          file: path.join(securityDir, 'encryption.yaml'),
          policy: {
            id: 'security-encryption',
            name: 'Encryption Requirements',
            rules: [{ id: 'encrypt-rule', type: 'path', name: 'Encrypt Rule', patterns: ['**/crypto/**'], enforcement: 'strict', enabled: true }],
            enabled: true,
            enforcement: 'strict',
            tags: ['security', 'encryption'],
            metadata: { directory: 'security' },
          },
        },
        {
          file: path.join(complianceDir, 'gdpr.yaml'),
          policy: {
            id: 'compliance-gdpr',
            name: 'GDPR Compliance',
            rules: [{ id: 'gdpr-rule', type: 'approval', name: 'GDPR Rule', patterns: ['**/personal-data/**'], enforcement: 'strict', enabled: true }],
            enabled: true,
            enforcement: 'strict',
            tags: ['compliance', 'gdpr'],
            metadata: { directory: 'compliance' },
          },
        },
        {
          file: path.join(teamDir, 'frontend-standards.yaml'),
          policy: {
            id: 'team-frontend',
            name: 'Frontend Team Standards',
            rules: [{ id: 'frontend-rule', type: 'test', name: 'Frontend Rule', patterns: ['src/components/**'], enforcement: 'warn', enabled: true }],
            enabled: true,
            enforcement: 'warn',
            tags: ['team', 'frontend'],
            metadata: { directory: 'teams/frontend' },
          },
        },
        {
          file: path.join(projectDir, 'custom-rules.yaml'),
          policy: {
            id: 'project-special',
            name: 'Special Project Rules',
            rules: [{ id: 'special-rule', type: 'path', name: 'Special Rule', patterns: ['special/**'], enforcement: 'audit', enabled: true }],
            enabled: true,
            enforcement: 'audit',
            tags: ['project', 'special'],
            metadata: { directory: 'projects/special' },
          },
        },
      ];

      // Write all policy files
      for (const { file, policy } of policies) {
        await fs.writeFile(file, yaml.stringify(policy), 'utf-8');
      }

      // Simulate loading all policies from directory structure
      const loadedPolicies = policies.map(p => p.policy);

      const structuredConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'structured-policy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: loadedPolicies,
      };

      await saveConfig(testDir, structuredConfig);
      const loaded = await loadConfig(testDir);

      // Verify all policies from different directories are loaded
      expect(loaded.policies).toHaveLength(5);

      // Verify policies by category
      const securityPolicies = loaded.policies?.filter(p => p.tags?.includes('security'));
      const compliancePolicies = loaded.policies?.filter(p => p.tags?.includes('compliance'));
      const teamPolicies = loaded.policies?.filter(p => p.tags?.includes('team'));
      const projectPolicies = loaded.policies?.filter(p => p.tags?.includes('project'));

      expect(securityPolicies).toHaveLength(2);
      expect(compliancePolicies).toHaveLength(1);
      expect(teamPolicies).toHaveLength(1);
      expect(projectPolicies).toHaveLength(1);

      // Verify directory metadata
      expect(securityPolicies?.find(p => p.id === 'security-auth')?.metadata?.directory).toBe('security');
      expect(compliancePolicies?.[0]?.metadata?.directory).toBe('compliance');
      expect(teamPolicies?.[0]?.metadata?.directory).toBe('teams/frontend');
      expect(projectPolicies?.[0]?.metadata?.directory).toBe('projects/special');
    });
  });
});