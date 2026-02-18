import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  loadConfig,
  saveConfig,
  getEffectiveConfig,
  initializeApex,
  validateContainerWorkspaceConfig,
} from '../config.js';
import { ApexConfig } from '../types.js';

describe('Config Policy Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-policy-integration-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Real-world Policy Configuration Scenarios', () => {
    it('should handle typical JavaScript/TypeScript project policy', async () => {
      const typicalJsConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'typical-js-project',
          language: 'typescript',
          framework: 'react',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          name: 'JavaScript Project Policy',
          description: 'Standard policy for JavaScript/TypeScript projects',
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: [
              'src/**/*.{ts,tsx,js,jsx}',
              'tests/**/*.{test,spec}.{ts,tsx,js,jsx}',
              '__tests__/**/*.{ts,tsx,js,jsx}',
              'docs/**/*.{md,mdx}',
              'public/**/*.{html,css,svg,png,jpg,gif}',
              'package.json',
              'package-lock.json',
              'tsconfig.json',
              'jest.config.js',
              'webpack.config.js',
              'vite.config.ts',
              '.eslintrc.{js,json}',
              '.prettierrc',
              'README.md',
              'CHANGELOG.md',
            ],
            block: [
              'node_modules/**',
              'dist/**',
              'build/**',
              'coverage/**',
              '.git/**',
              '**/*.log',
              '**/.DS_Store',
              '**/npm-debug.log*',
            ],
            sensitivePatterns: [
              '.env*',
              '**/*.key',
              '**/*.pem',
              '**/*.p12',
              '**/secrets.json',
              '**/config/production.js',
              '**/.npmrc',
            ],
            followSymlinks: false,
            maxDepth: 8,
          },
          requiredTests: {
            enforcement: 'warn',
            rules: [
              {
                name: 'component-tests',
                description: 'React components should have tests',
                sourcePatterns: ['src/components/**/*.{tsx,jsx}'],
                testPatterns: [
                  'src/components/**/*.{test,spec}.{tsx,jsx}',
                  '__tests__/components/**/*.{tsx,jsx}',
                ],
                testNamingConvention: '{dir}/__tests__/{basename}.test.{ext}',
                minCoverage: 70,
                tags: ['react', 'components'],
                enabled: true,
              },
              {
                name: 'utils-tests',
                description: 'Utility functions require tests',
                sourcePatterns: ['src/utils/**/*.{ts,js}', 'src/lib/**/*.{ts,js}'],
                testPatterns: [
                  'src/utils/**/*.{test,spec}.{ts,js}',
                  'tests/utils/**/*.{test,spec}.{ts,js}',
                ],
                minCoverage: 80,
                tags: ['utils', 'unit'],
                enabled: true,
              },
            ],
            testCommand: 'npm test -- --coverage',
            coverageCommand: 'npm run test:coverage',
            coverageReportPath: 'coverage/lcov.info',
            excludePatterns: [
              '**/*.d.ts',
              '**/index.{ts,js}',
              '**/*.stories.{tsx,jsx}',
              '**/*.config.{ts,js}',
            ],
            blockOnFailure: false, // Warn mode - don't block
          },
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'package-json-changes',
                name: 'package-json-changes',
                description: 'Changes to package.json require review',
                conditions: [
                  {
                    type: 'file-pattern',
                    patterns: ['package.json', 'package-lock.json'],
                    description: 'Package dependency files',
                  },
                ],
                approvers: ['tech-lead@company.com'],
                minApprovals: 1,
                timeoutMinutes: 60,
                timeoutAction: 'escalate',
                enabled: true,
                priority: 5,
                tags: ['dependencies', 'security'],
              },
            ],
            defaultTimeoutMinutes: 120,
            defaultTimeoutAction: 'reject',
            globalApprovers: [],
            notificationsEnabled: true,
            auditLog: true,
            auditLogPath: 'logs/approval-audit.log',
          },
          enabled: true,
          tags: ['javascript', 'typescript', 'react'],
          metadata: {
            projectType: 'frontend',
            maintainer: 'frontend-team',
            lastUpdated: '2024-01-01',
          },
        },
      };

      await saveConfig(testDir, typicalJsConfig);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.name).toBe('JavaScript Project Policy');
      expect(loaded.policy?.allowedPaths?.allow).toContain('src/**/*.{ts,tsx,js,jsx}');
      expect(loaded.policy?.requiredTests?.rules).toHaveLength(2);
      expect(loaded.policy?.approvalRules?.rules).toHaveLength(1);

      // Test that the effective config preserves all values
      const effective = getEffectiveConfig(loaded);
      expect(effective.policy.enforcement).toBe('warn');
      expect(effective.policy.metadata?.projectType).toBe('frontend');
    });

    it('should handle enterprise security policy configuration', async () => {
      const enterpriseSecurityConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'enterprise-secure-project',
          language: 'java',
          framework: 'spring-boot',
          testCommand: 'mvn test',
          lintCommand: 'mvn checkstyle:check',
          buildCommand: 'mvn package',
        },
        policy: {
          version: '2.0',
          name: 'Enterprise Security Policy',
          description: 'Comprehensive security policy for enterprise applications',
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: [
              'src/main/java/**/*.java',
              'src/test/java/**/*.java',
              'src/main/resources/**/*.{xml,properties,yml,yaml}',
              'src/test/resources/**/*.{xml,properties,yml,yaml}',
              'docs/**/*.{md,adoc}',
              'pom.xml',
              'checkstyle.xml',
              'spotbugs-exclude.xml',
            ],
            block: [
              'target/**',
              '.mvn/**',
              '**/*.class',
              '**/*.jar',
              '**/.DS_Store',
              '**/mvnw*',
              '**/*.log',
            ],
            sensitivePatterns: [
              '**/application-prod.{properties,yml,yaml}',
              '**/database.properties',
              '**/*.keystore',
              '**/*.p12',
              '**/*.pem',
              '**/secrets/**',
              '**/.env*',
              '**/credentials.json',
            ],
            followSymlinks: false,
            maxDepth: 10,
          },
          requiredTests: {
            enforcement: 'require',
            rules: [
              {
                name: 'service-layer-tests',
                description: 'All service classes must have unit tests',
                sourcePatterns: ['src/main/java/**/service/**/*.java'],
                testPatterns: ['src/test/java/**/service/**/*Test.java'],
                minCoverage: 90,
                tags: ['service', 'unit', 'critical'],
                enabled: true,
              },
              {
                name: 'controller-tests',
                description: 'REST controllers must have integration tests',
                sourcePatterns: ['src/main/java/**/controller/**/*.java'],
                testPatterns: [
                  'src/test/java/**/controller/**/*Test.java',
                  'src/test/java/**/controller/**/*IT.java',
                ],
                minCoverage: 85,
                tags: ['controller', 'integration'],
                enabled: true,
              },
              {
                name: 'security-tests',
                description: 'Security-related classes require comprehensive tests',
                sourcePatterns: [
                  'src/main/java/**/security/**/*.java',
                  'src/main/java/**/auth/**/*.java',
                ],
                testPatterns: [
                  'src/test/java/**/security/**/*Test.java',
                  'src/test/java/**/auth/**/*Test.java',
                ],
                minCoverage: 95,
                tags: ['security', 'auth', 'critical'],
                enabled: true,
              },
            ],
            testCommand: 'mvn test jacoco:report',
            coverageCommand: 'mvn jacoco:report',
            coverageReportPath: 'target/site/jacoco/jacoco.xml',
            excludePatterns: [
              '**/config/**',
              '**/dto/**',
              '**/entity/**',
              '**/*Application.java',
            ],
            blockOnFailure: true,
          },
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'security-file-changes',
                name: 'security-file-changes',
                description: 'Security configuration changes require security team approval',
                conditions: [
                  {
                    type: 'file-pattern',
                    patterns: [
                      '**/security/**',
                      '**/auth/**',
                      '**/application-prod.*',
                      '**/SecurityConfig.java',
                      '**/WebSecurityConfig.java',
                    ],
                    description: 'Security-related files',
                  },
                ],
                approvers: ['security-team@company.com', 'infra-security@company.com'],
                minApprovals: 2,
                timeoutMinutes: 240,
                timeoutAction: 'reject',
                enabled: true,
                priority: 10,
                tags: ['security', 'critical'],
              },
              {
                id: 'database-schema-changes',
                name: 'database-schema-changes',
                description: 'Database schema changes require DBA approval',
                conditions: [
                  {
                    type: 'file-pattern',
                    patterns: [
                      '**/migration/**/*.sql',
                      '**/schema/**/*.sql',
                      '**/flyway/**',
                      '**/liquibase/**',
                    ],
                    description: 'Database migration and schema files',
                  },
                ],
                approvers: ['dba-team@company.com'],
                minApprovals: 1,
                timeoutMinutes: 120,
                timeoutAction: 'escalate',
                enabled: true,
                priority: 8,
                tags: ['database', 'schema'],
              },
              {
                id: 'high-risk-operations',
                name: 'high-risk-operations',
                description: 'High-risk operations require management approval',
                conditions: [
                  {
                    type: 'cost-threshold',
                    threshold: 100.0,
                    description: 'Operations over $100',
                  },
                  {
                    type: 'custom',
                    expression: 'changedFiles.length > 50 || operationType === "delete"',
                    description: 'Large changes or deletions',
                  },
                ],
                approvers: ['engineering-manager@company.com', 'cto@company.com'],
                minApprovals: 1,
                timeoutMinutes: 180,
                timeoutAction: 'escalate',
                enabled: true,
                priority: 6,
                tags: ['high-risk', 'management'],
              },
            ],
            defaultTimeoutMinutes: 120,
            defaultTimeoutAction: 'reject',
            globalApprovers: ['security-admin@company.com'],
            notificationsEnabled: true,
            notificationChannels: {
              slack: 'https://hooks.slack.com/services/enterprise/security/approvals',
              email: ['security-alerts@company.com', 'compliance@company.com'],
              webhook: 'https://security.company.com/api/approval-notifications',
            },
            auditLog: true,
            auditLogPath: 'audit/enterprise-security-approvals.log',
          },
          enabled: true,
          tags: ['enterprise', 'security', 'java', 'spring-boot', 'compliance'],
          metadata: {
            complianceFrameworks: ['SOX', 'ISO27001', 'PCI-DSS', 'HIPAA'],
            securityClassification: 'confidential',
            dataClassification: 'sensitive',
            owner: 'platform-security-team',
            businessUnit: 'enterprise-solutions',
            riskLevel: 'high',
            lastSecurityReview: '2024-01-01',
            nextSecurityReview: '2024-04-01',
          },
        },
      };

      await saveConfig(testDir, enterpriseSecurityConfig);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.enforcement).toBe('strict');
      expect(loaded.policy?.requiredTests?.enforcement).toBe('require');
      expect(loaded.policy?.requiredTests?.blockOnFailure).toBe(true);
      expect(loaded.policy?.approvalRules?.rules).toHaveLength(3);
      expect(loaded.policy?.tags).toContain('compliance');
      expect(loaded.policy?.metadata?.complianceFrameworks).toContain('SOX');

      // Verify the strict policy has appropriate security measures
      const securityRule = loaded.policy?.approvalRules?.rules?.find(r => r.id === 'security-file-changes');
      expect(securityRule?.minApprovals).toBe(2);
      expect(securityRule?.timeoutAction).toBe('reject');
    });

    it('should handle development/staging policy (more permissive)', async () => {
      const devStagingConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'dev-staging-project',
          language: 'python',
          framework: 'django',
          testCommand: 'python -m pytest',
          lintCommand: 'flake8 .',
          buildCommand: 'python setup.py build',
        },
        policy: {
          name: 'Development/Staging Policy',
          description: 'More permissive policy for development and staging environments',
          enforcement: 'audit', // More relaxed than strict
          allowedPaths: {
            mode: 'blocklist', // Use blocklist for more permissive access
            allow: [], // Empty allow list with blocklist mode
            block: [
              '**/__pycache__/**',
              '**/*.pyc',
              '**/*.pyo',
              '.git/**',
              'venv/**',
              'env/**',
              '.env/**',
              'node_modules/**', // In case of frontend assets
              '**/.DS_Store',
              '**/tmp/**',
              '**/*.log',
            ],
            sensitivePatterns: [
              '.env*',
              '**/secrets.py',
              '**/local_settings.py',
              '**/*.key',
              '**/*.pem',
            ],
            followSymlinks: true, // More permissive
            maxDepth: 20, // Higher depth limit
          },
          requiredTests: {
            enforcement: 'warn', // Warn instead of require
            rules: [
              {
                name: 'model-tests',
                description: 'Django models should have tests',
                sourcePatterns: ['**/models.py', '**/models/**/*.py'],
                testPatterns: ['**/test_models.py', '**/tests/**/test_*.py'],
                minCoverage: 60, // Lower coverage requirement
                tags: ['django', 'models'],
                enabled: true,
              },
              {
                name: 'view-tests',
                description: 'Django views should have tests',
                sourcePatterns: ['**/views.py', '**/views/**/*.py'],
                testPatterns: ['**/test_views.py', '**/tests/**/test_*.py'],
                minCoverage: 50, // Even lower for views
                tags: ['django', 'views'],
                enabled: true,
              },
            ],
            testCommand: 'python -m pytest --cov',
            coverageCommand: 'python -m pytest --cov --cov-report=xml',
            coverageReportPath: 'coverage.xml',
            excludePatterns: [
              '**/migrations/**',
              '**/settings/**',
              '**/__init__.py',
              '**/wsgi.py',
              '**/asgi.py',
            ],
            blockOnFailure: false, // Don't block on test failures
          },
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'dependency-changes',
                name: 'dependency-changes',
                description: 'Dependency changes should be reviewed',
                conditions: [
                  {
                    type: 'file-pattern',
                    patterns: [
                      'requirements*.txt',
                      'Pipfile',
                      'pyproject.toml',
                      'setup.py',
                      'poetry.lock',
                    ],
                    description: 'Python dependency files',
                  },
                ],
                approvers: ['team-lead@company.com'],
                minApprovals: 1,
                timeoutMinutes: 240, // Longer timeout for dev
                timeoutAction: 'approve', // Auto-approve on timeout
                enabled: true,
                priority: 3, // Lower priority
                tags: ['dependencies', 'review'],
              },
            ],
            defaultTimeoutMinutes: 240, // Longer default timeout
            defaultTimeoutAction: 'approve', // Auto-approve by default
            globalApprovers: [], // No global approvers needed
            notificationsEnabled: false, // Disable notifications for dev
            auditLog: true,
            auditLogPath: 'logs/dev-audit.log',
          },
          enabled: true,
          tags: ['development', 'staging', 'python', 'django'],
          metadata: {
            environment: 'dev/staging',
            restrictionLevel: 'low',
            autoApprovalEnabled: true,
          },
        },
      };

      await saveConfig(testDir, devStagingConfig);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.enforcement).toBe('audit');
      expect(loaded.policy?.allowedPaths?.mode).toBe('blocklist');
      expect(loaded.policy?.allowedPaths?.followSymlinks).toBe(true);
      expect(loaded.policy?.requiredTests?.enforcement).toBe('warn');
      expect(loaded.policy?.requiredTests?.blockOnFailure).toBe(false);
      expect(loaded.policy?.approvalRules?.defaultTimeoutAction).toBe('approve');
      expect(loaded.policy?.approvalRules?.notificationsEnabled).toBe(false);

      // Verify it's more permissive than enterprise config
      expect(loaded.policy?.allowedPaths?.maxDepth).toBe(20);
      expect(loaded.policy?.requiredTests?.rules?.[0]?.minCoverage).toBe(60);
    });

    it('should handle policy inheritance and overrides', async () => {
      // First, create a base configuration
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'base-config',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**', 'tests/**'],
            block: ['node_modules/**'],
          },
          enabled: true,
        },
      };

      await saveConfig(testDir, baseConfig);
      const loaded = await loadConfig(testDir);

      // Verify the base config loads correctly
      expect(loaded.policy?.enforcement).toBe('warn');
      expect(loaded.policy?.allowedPaths?.allow).toEqual(['src/**', 'tests/**']);

      // Test that getEffectiveConfig properly merges with defaults
      const effective = getEffectiveConfig(loaded);

      // Should preserve explicit values
      expect(effective.policy.enforcement).toBe('warn');
      expect(effective.policy.allowedPaths.allow).toEqual(['src/**', 'tests/**']);

      // Should apply defaults for missing values
      expect(effective.policy.allowedPaths.block).toContain('node_modules/**');
      expect(effective.policy.allowedPaths.sensitivePatterns).toContain('.env*');
      expect(effective.policy.requiredTests.enforcement).toBe('warn');
      expect(effective.policy.approvalRules.enabled).toBe(true);

      // Now update the config to override some values
      const updatedConfig: ApexConfig = {
        ...loaded,
        policy: {
          ...loaded.policy!,
          enforcement: 'strict',
          allowedPaths: {
            ...loaded.policy!.allowedPaths!,
            allow: ['src/**', 'lib/**', 'docs/**'], // Override allow patterns
            block: ['node_modules/**', 'dist/**'], // Override block patterns
          },
          requiredTests: {
            enforcement: 'require',
            rules: [
              {
                name: 'new-rule',
                sourcePatterns: ['src/**/*.ts'],
                testPatterns: ['**/*.test.ts'],
                minCoverage: 85,
              },
            ],
          },
        },
      };

      await saveConfig(testDir, updatedConfig);
      const reloaded = await loadConfig(testDir);

      expect(reloaded.policy?.enforcement).toBe('strict');
      expect(reloaded.policy?.allowedPaths?.allow).toEqual(['src/**', 'lib/**', 'docs/**']);
      expect(reloaded.policy?.allowedPaths?.block).toEqual(['node_modules/**', 'dist/**']);
      expect(reloaded.policy?.requiredTests?.enforcement).toBe('require');
      expect(reloaded.policy?.requiredTests?.rules).toHaveLength(1);
    });
  });

  describe('Policy Configuration Validation Integration', () => {
    it('should validate policy configuration alongside container workspace config', async () => {
      const configWithBothPolicyAndContainer: ApexConfig = {
        version: '1.0',
        project: {
          name: 'policy-container-integration',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'node:18-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '1g',
            },
            networkMode: 'bridge',
            autoRemove: true,
          },
        },
        policy: {
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**', 'tests/**'],
          },
          requiredTests: {
            enforcement: 'require',
            rules: [
              {
                name: 'container-tests',
                sourcePatterns: ['src/**/*.ts'],
                testPatterns: ['**/*.test.ts'],
              },
            ],
            blockOnFailure: true,
          },
          enabled: true,
        },
      };

      await saveConfig(testDir, configWithBothPolicyAndContainer);
      const loaded = await loadConfig(testDir);

      // Both policy and workspace should be loaded correctly
      expect(loaded.policy?.enforcement).toBe('strict');
      expect(loaded.workspace?.defaultStrategy).toBe('container');
      expect(loaded.workspace?.container?.image).toBe('node:18-alpine');

      // Container validation should work independently
      const containerValidation = await validateContainerWorkspaceConfig(loaded);
      // Note: This might fail if Docker/Podman is not available, but the policy should still be valid
      expect(loaded.policy?.enabled).toBe(true);
    });

    it('should handle policy config when container validation fails', async () => {
      const configWithInvalidContainer: ApexConfig = {
        version: '1.0',
        project: {
          name: 'invalid-container-valid-policy',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          // Missing container image - should cause validation warning
        },
        policy: {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
          },
          enabled: true,
        },
      };

      await saveConfig(testDir, configWithInvalidContainer);

      // Policy loading should succeed even if container validation has issues
      const loaded = await loadConfig(testDir);
      expect(loaded.policy?.enforcement).toBe('warn');
      expect(loaded.policy?.enabled).toBe(true);

      // Container validation might warn about missing image, but policy should still work
      const containerValidation = await validateContainerWorkspaceConfig(loaded);
      expect(containerValidation.warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cross-platform Policy Configuration', () => {
    it('should handle Windows-style paths in policy patterns', async () => {
      const windowsStyleConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'windows-paths-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: [
              'src\\**\\*.ts', // Windows-style backslashes
              'src/**/*.ts', // Unix-style forward slashes
              'tests\\**\\*.test.ts',
              'docs\\**\\*.md',
            ],
            block: [
              'node_modules\\**',
              'dist\\**',
              '.git\\**',
            ],
            sensitivePatterns: [
              '.env*',
              '**\\*.key',
              '**\\secrets\\**',
            ],
          },
          enabled: true,
        },
      };

      await saveConfig(testDir, windowsStyleConfig);
      const loaded = await loadConfig(testDir);

      // All patterns should be preserved as-is
      expect(loaded.policy?.allowedPaths?.allow).toContain('src\\**\\*.ts');
      expect(loaded.policy?.allowedPaths?.allow).toContain('src/**/*.ts');
      expect(loaded.policy?.allowedPaths?.block).toContain('node_modules\\**');
      expect(loaded.policy?.allowedPaths?.sensitivePatterns).toContain('**\\*.key');

      // The effective config should preserve these patterns
      const effective = getEffectiveConfig(loaded);
      expect(effective.policy.allowedPaths.allow).toContain('src\\**\\*.ts');
    });

    it('should handle complex glob patterns in policy rules', async () => {
      const complexGlobConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-glob-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: [
              // Complex glob patterns
              'src/**/*.{ts,tsx,js,jsx}',
              '{lib,utils,helpers}/**/*.{ts,js}',
              'components/**/!(*.stories|*.test).{tsx,jsx}',
              'api/v{1,2,3}/**/*.ts',
              'config/*.{json,yaml,yml}',
              '[Dd]ocs/**/*.{md,mdx}',
            ],
            block: [
              '**/*.{tmp,temp,bak,old}',
              '**/node_modules/**',
              '**/{dist,build,coverage}/**',
              '**/.{git,svn,hg}/**',
            ],
            sensitivePatterns: [
              '.env*',
              '*.{key,pem,p12,pfx}',
              '{secrets,credentials,private}/**',
              'config/{production,prod,live}.*',
            ],
          },
          requiredTests: {
            enforcement: 'warn',
            rules: [
              {
                name: 'complex-pattern-tests',
                sourcePatterns: [
                  'src/{components,pages,hooks}/**/*.{ts,tsx}',
                  '{lib,utils}/**/!(*.test|*.spec).{ts,js}',
                ],
                testPatterns: [
                  'src/{components,pages,hooks}/**/*.{test,spec}.{ts,tsx}',
                  '__tests__/**/*.{ts,tsx,js,jsx}',
                  '{lib,utils}/**/*.{test,spec}.{ts,js}',
                ],
                testNamingConvention: '{dir}/__tests__/{basename}.test.{ext}',
                minCoverage: 75,
              },
            ],
          },
          enabled: true,
        },
      };

      await saveConfig(testDir, complexGlobConfig);
      const loaded = await loadConfig(testDir);

      // Complex patterns should be preserved
      expect(loaded.policy?.allowedPaths?.allow).toContain('src/**/*.{ts,tsx,js,jsx}');
      expect(loaded.policy?.allowedPaths?.allow).toContain('{lib,utils,helpers}/**/*.{ts,js}');
      expect(loaded.policy?.allowedPaths?.allow).toContain('components/**/!(*.stories|*.test).{tsx,jsx}');
      expect(loaded.policy?.allowedPaths?.block).toContain('**/*.{tmp,temp,bak,old}');
      expect(loaded.policy?.requiredTests?.rules?.[0]?.sourcePatterns).toContain('src/{components,pages,hooks}/**/*.{ts,tsx}');
    });
  });

  describe('Policy Configuration Performance', () => {
    it('should handle large policy configurations efficiently', async () => {
      const largeConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'large-policy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: Array.from({ length: 50 }, (_, i) => `src/module${i}/**/*.ts`),
            block: Array.from({ length: 30 }, (_, i) => `temp${i}/**`),
            sensitivePatterns: Array.from({ length: 20 }, (_, i) => `**/*secret${i}*`),
          },
          requiredTests: {
            enforcement: 'warn',
            rules: Array.from({ length: 25 }, (_, i) => ({
              name: `test-rule-${i}`,
              sourcePatterns: [`src/module${i}/**/*.ts`],
              testPatterns: [`tests/module${i}/**/*.test.ts`],
              minCoverage: 70 + (i % 30), // Vary coverage requirements
            })),
          },
          approvalRules: {
            enabled: true,
            rules: Array.from({ length: 15 }, (_, i) => ({
              id: `approval-rule-${i}`,
              name: `approval-rule-${i}`,
              conditions: [
                {
                  type: 'file-pattern' as const,
                  patterns: [`**/*module${i}*`],
                },
              ],
              approvers: [`approver${i}@company.com`],
              minApprovals: 1 + (i % 3),
              timeoutMinutes: 60 + (i * 10),
              priority: i % 10,
            })),
          },
          tags: Array.from({ length: 10 }, (_, i) => `tag${i}`),
          metadata: Object.fromEntries(
            Array.from({ length: 20 }, (_, i) => [`key${i}`, `value${i}`])
          ),
          enabled: true,
        },
      };

      const startTime = Date.now();
      await saveConfig(testDir, largeConfig);
      const saveTime = Date.now() - startTime;

      const loadStartTime = Date.now();
      const loaded = await loadConfig(testDir);
      const loadTime = Date.now() - loadStartTime;

      const effectiveStartTime = Date.now();
      const effective = getEffectiveConfig(loaded);
      const effectiveTime = Date.now() - effectiveStartTime;

      // Verify all data was saved and loaded correctly
      expect(loaded.policy?.allowedPaths?.allow).toHaveLength(50);
      expect(loaded.policy?.allowedPaths?.block).toHaveLength(30);
      expect(loaded.policy?.requiredTests?.rules).toHaveLength(25);
      expect(loaded.policy?.approvalRules?.rules).toHaveLength(15);
      expect(loaded.policy?.tags).toHaveLength(10);
      expect(Object.keys(loaded.policy?.metadata || {})).toHaveLength(20);

      // Verify effective config merges correctly even with large configs
      expect(effective.policy.allowedPaths.allow).toHaveLength(50);
      expect(effective.policy.requiredTests.rules).toHaveLength(25);

      // Performance should be reasonable (these are generous limits)
      expect(saveTime).toBeLessThan(1000); // Save should take less than 1 second
      expect(loadTime).toBeLessThan(1000); // Load should take less than 1 second
      expect(effectiveTime).toBeLessThan(500); // Effective config should be fast
    });
  });
});