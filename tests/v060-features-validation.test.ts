/**
 * @fileoverview Comprehensive test suite for v0.6.0 "Context & Memory" features validation
 *
 * This test suite validates all implemented v0.6.0 features:
 * - Project Context: Git status, project structure, dependency detection, framework detection, configuration awareness
 * - Workspace Health Checks: Doctor utilities, health metrics, connection health
 * - Test Framework Detection: Test runners, coverage tools, testing patterns
 * - Update Available Checker: NPM registry utilities
 *
 * Tests verify both implementation completeness and integration with the broader APEX system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ProjectContextAnalyzer,
  createHealthReport,
  queryNpmRegistry,
  getLatestPackageVersion,
  isPackageVersionAvailable,
  createDoctorCheckResult,
  type ProjectContext,
  type GitStatus,
  type FrameworkDetection,
  type ConfigurationInfo,
  type TestFrameworkInfo,
  type HealthReport,
  type DoctorCheckResult,
  GitStatusSchema,
  ProjectStructureSchema,
  FrameworkDetectionSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  HealthReportSchema,
  DoctorCheckResultSchema,
} from '@apexcli/core';

describe('v0.6.0 Context & Memory Features Validation', () => {
  const projectRoot = path.resolve(__dirname, '..');
  let analyzer: ProjectContextAnalyzer;

  beforeEach(() => {
    analyzer = new ProjectContextAnalyzer(projectRoot);
    vi.clearAllMocks();
  });

  describe('Project Context Features', () => {
    describe('Git Status Awareness', () => {
      it('should provide comprehensive git status information', async () => {
        const gitStatus = await analyzer.getGitStatus(projectRoot);

        // Validate schema compliance
        expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();

        // Test core git information
        expect(gitStatus).toMatchObject({
          isRepository: expect.any(Boolean),
          branch: expect.any(String),
          isClean: expect.any(Boolean),
          hasUncommittedChanges: expect.any(Boolean),
          hasUntrackedFiles: expect.any(Boolean),
          hasStagedChanges: expect.any(Boolean),
        });

        if (gitStatus.isRepository) {
          expect(gitStatus.branch).toBeTruthy();
          expect(gitStatus.changedFiles).toBeInstanceOf(Array);
          expect(gitStatus.stashCount).toBeTypeOf('number');
        }
      });

      it('should detect branch tracking information', async () => {
        const gitStatus = await analyzer.getGitStatus(projectRoot);

        if (gitStatus.isRepository && gitStatus.tracking) {
          expect(gitStatus.tracking).toMatchObject({
            remote: expect.any(String),
            remoteBranch: expect.any(String),
            aheadCount: expect.any(Number),
            behindCount: expect.any(Number),
          });
        }
      });

      it('should handle non-git directories gracefully', async () => {
        const tempDir = '/tmp/non-git-dir';
        const gitStatus = await analyzer.getGitStatus(tempDir);

        expect(gitStatus.isRepository).toBe(false);
        expect(gitStatus.branch).toBe('');
        expect(gitStatus.isClean).toBe(true);
        expect(gitStatus.changedFiles).toEqual([]);
      });
    });

    describe('Project Structure Analysis', () => {
      it('should analyze project structure comprehensively', async () => {
        const structure = await analyzer.getProjectStructure(projectRoot, {
          maxDepth: 3,
          includeHidden: false
        });

        // Validate schema compliance
        expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();

        // Test structure information
        expect(structure).toMatchObject({
          totalFiles: expect.any(Number),
          totalDirectories: expect.any(Number),
          totalSize: expect.any(Number),
          maxDepth: expect.any(Number),
          entries: expect.any(Array),
        });

        expect(structure.totalFiles).toBeGreaterThan(0);
        expect(structure.totalDirectories).toBeGreaterThan(0);
        expect(structure.entries.length).toBeGreaterThan(0);

        // Test that entries have proper structure
        if (structure.entries.length > 0) {
          const entry = structure.entries[0];
          expect(entry).toMatchObject({
            name: expect.any(String),
            path: expect.any(String),
            type: expect.stringMatching(/^(file|directory)$/),
            size: expect.any(Number),
            modified: expect.any(Date),
          });
        }
      });

      it('should detect common project directories', async () => {
        const structure = await analyzer.getProjectStructure(projectRoot);

        // Check for common directories that should exist in APEX
        const directoryNames = structure.entries
          .filter(entry => entry.type === 'directory')
          .map(entry => entry.name);

        expect(directoryNames).toContain('packages');
        expect(directoryNames).toContain('tests');
      });
    });

    describe('Framework Detection', () => {
      it('should detect multiple frameworks in monorepo', async () => {
        const frameworkDetection = await analyzer.detectFrameworks(projectRoot);

        // Validate schema compliance
        expect(() => FrameworkDetectionSchema.parse(frameworkDetection)).not.toThrow();

        // Test that we detect expected frameworks in APEX
        const frameworks = frameworkDetection.frameworks;
        const frameworkNames = frameworks.map(f => f.name.toLowerCase());

        // Should detect TypeScript, Node.js, Vitest, etc.
        expect(frameworkNames.some(name => name.includes('typescript'))).toBe(true);
        expect(frameworkNames.some(name => name.includes('node'))).toBe(true);
        expect(frameworkNames.some(name => name.includes('vitest'))).toBe(true);

        // Test framework categories
        const categories = frameworks.map(f => f.category);
        expect(categories).toContain('testing');
        expect(categories).toContain('language');
      });

      it('should provide confidence levels for framework detection', async () => {
        const frameworkDetection = await analyzer.detectFrameworks(projectRoot);
        const frameworks = frameworkDetection.frameworks;

        frameworks.forEach(framework => {
          expect(framework.confidence).toMatch(/^(high|medium|low)$/);
          expect(framework.detectionReasons).toBeInstanceOf(Array);
          expect(framework.detectionReasons.length).toBeGreaterThan(0);
        });
      });
    });

    describe('Configuration Awareness', () => {
      it('should detect and analyze configuration files', async () => {
        const configs = await analyzer.getConfigurationInfoList(projectRoot);

        // Validate schema compliance
        configs.forEach(config => {
          expect(() => ConfigurationInfoSchema.parse(config)).not.toThrow();
        });

        // Should detect common config files in APEX
        const configNames = configs.map(c => path.basename(c.path));

        expect(configNames).toContain('package.json');
        expect(configNames).toContain('tsconfig.json');
        expect(configNames.some(name => name.includes('vitest'))).toBe(true);

        // Test configuration purposes
        const purposes = configs.flatMap(c => c.purposes);
        expect(purposes).toContain('package_management');
        expect(purposes).toContain('testing');
      });

      it('should safely extract configuration settings', async () => {
        const configs = await analyzer.getConfigurationInfoList(projectRoot);

        configs.forEach(config => {
          if (config.settings) {
            expect(config.isValid).toBe(true);
            expect(typeof config.settings).toBe('object');
            // Should not contain sensitive information
            const settingsString = JSON.stringify(config.settings);
            expect(settingsString.toLowerCase()).not.toMatch(/password|secret|key|token/);
          }
        });
      });
    });

    describe('Test Framework Detection', () => {
      it('should detect test frameworks and their configurations', async () => {
        const testFrameworks = await analyzer.getTestFrameworkInfoList(projectRoot);

        // Validate schema compliance
        testFrameworks.forEach(framework => {
          expect(() => TestFrameworkInfoSchema.parse(framework)).not.toThrow();
        });

        // Should detect Vitest in APEX
        const frameworkNames = testFrameworks.map(f => f.name.toLowerCase());
        expect(frameworkNames).toContain('vitest');

        // Test framework capabilities
        const vitestFramework = testFrameworks.find(f => f.name.toLowerCase() === 'vitest');
        if (vitestFramework) {
          expect(vitestFramework.runnerType).toBe('vitest');
          expect(vitestFramework.configFiles.length).toBeGreaterThan(0);
          expect(vitestFramework.testPatterns.length).toBeGreaterThan(0);
        }
      });

      it('should count test files correctly', async () => {
        const testFrameworks = await analyzer.getTestFrameworkInfoList(projectRoot);

        const vitestFramework = testFrameworks.find(f => f.name.toLowerCase() === 'vitest');
        if (vitestFramework) {
          expect(vitestFramework.testFileCount).toBeGreaterThan(0);
          expect(vitestFramework.coverageEnabled).toBe(true);
        }
      });
    });

    describe('Comprehensive Project Analysis', () => {
      it('should perform complete project context analysis', async () => {
        const options = {
          includeGit: true,
          includeFrameworks: true,
          includeConfiguration: true,
          includeTestFrameworks: true,
          maxDepth: 2,
        };

        const context = await analyzer.analyze(projectRoot, options);

        // Validate complete context schema
        expect(() => context && ProjectContextSchema.parse(context)).not.toThrow();

        if (context) {
          expect(context.git).toBeDefined();
          expect(context.structure).toBeDefined();
          expect(context.frameworks).toBeDefined();
          expect(context.configurations).toBeDefined();
          expect(context.testFrameworks).toBeDefined();

          expect(context.frameworks.length).toBeGreaterThan(0);
          expect(context.configurations.length).toBeGreaterThan(0);
          expect(context.testFrameworks.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Workspace Health Checks', () => {
    describe('Doctor Check Results', () => {
      it('should create valid doctor check results', () => {
        const checkResult = createDoctorCheckResult({
          name: 'Node.js Version',
          description: 'Check Node.js version compatibility',
          status: 'pass',
          severity: 'error',
          details: 'Node.js v18.0.0 is compatible',
          durationMs: 150,
        });

        // Validate schema compliance
        expect(() => DoctorCheckResultSchema.parse(checkResult)).not.toThrow();

        expect(checkResult).toMatchObject({
          id: expect.any(String),
          name: 'Node.js Version',
          status: 'pass',
          severity: 'error',
          timestamp: expect.any(Date),
          durationMs: 150,
        });
      });

      it('should handle different check statuses', () => {
        const statuses = ['pass', 'fail', 'skip', 'unknown'] as const;

        statuses.forEach(status => {
          const checkResult = createDoctorCheckResult({
            name: `Test ${status}`,
            description: 'Test check',
            status,
            severity: 'info',
          });

          expect(checkResult.status).toBe(status);
        });
      });
    });

    describe('Health Report Generation', () => {
      it('should generate comprehensive health reports', () => {
        const checks = [
          createDoctorCheckResult({
            name: 'Node.js',
            description: 'Node.js version check',
            status: 'pass',
            severity: 'error',
            durationMs: 100,
          }),
          createDoctorCheckResult({
            name: 'NPM',
            description: 'NPM version check',
            status: 'pass',
            severity: 'warning',
            durationMs: 80,
          }),
          createDoctorCheckResult({
            name: 'Git',
            description: 'Git availability check',
            status: 'fail',
            severity: 'error',
            durationMs: 50,
          }),
        ];

        const report = createHealthReport(checks, { apexVersion: '0.6.0' });

        // Validate schema compliance
        expect(() => HealthReportSchema.parse(report)).not.toThrow();

        expect(report).toMatchObject({
          id: expect.stringMatching(/^health-/),
          timestamp: expect.any(Date),
          apexVersion: '0.6.0',
          summary: {
            total: 3,
            passed: 2,
            failed: 1,
            skipped: 0,
            warnings: 1,
            errors: 2,
          },
          overallStatus: 'fail', // Has failed checks
          durationMs: 230, // Sum of durations
        });
      });

      it('should calculate correct overall status', () => {
        // All pass
        const allPassChecks = [
          createDoctorCheckResult({
            name: 'Check 1',
            description: 'Test',
            status: 'pass',
            severity: 'info',
          }),
        ];
        const allPassReport = createHealthReport(allPassChecks);
        expect(allPassReport.overallStatus).toBe('pass');

        // Has failures
        const hasFailuresChecks = [
          createDoctorCheckResult({
            name: 'Check 1',
            description: 'Test',
            status: 'pass',
            severity: 'info',
          }),
          createDoctorCheckResult({
            name: 'Check 2',
            description: 'Test',
            status: 'fail',
            severity: 'error',
          }),
        ];
        const hasFailuresReport = createHealthReport(hasFailuresChecks);
        expect(hasFailuresReport.overallStatus).toBe('fail');

        // Has warnings
        const hasWarningsChecks = [
          createDoctorCheckResult({
            name: 'Check 1',
            description: 'Test',
            status: 'pass',
            severity: 'warning',
          }),
        ];
        const hasWarningsReport = createHealthReport(hasWarningsChecks);
        expect(hasWarningsReport.overallStatus).toBe('pass'); // Warnings don't fail overall
      });
    });

    describe('NPM Registry Utilities', () => {
      it('should query npm registry with proper headers', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            'dist-tags': { latest: '0.6.0' },
            versions: { '0.6.0': {}, '0.5.0': {} }
          })
        });

        // Mock global fetch
        vi.stubGlobal('fetch', mockFetch);

        const packageInfo = await queryNpmRegistry('@apexcli/core');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://registry.npmjs.org/@apexcli/core',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Accept': 'application/json',
              'User-Agent': 'APEX-doctor/0.6.0',
            }),
          })
        );

        expect(packageInfo).toMatchObject({
          'dist-tags': { latest: '0.6.0' },
          versions: expect.any(Object),
        });

        vi.unstubAllGlobals();
      });

      it('should get latest package version', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            'dist-tags': { latest: '0.6.0' }
          })
        });

        vi.stubGlobal('fetch', mockFetch);

        const latestVersion = await getLatestPackageVersion('@apexcli/core');
        expect(latestVersion).toBe('0.6.0');

        vi.unstubAllGlobals();
      });

      it('should check if package version is available', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            versions: { '0.6.0': {}, '0.5.0': {} }
          })
        });

        vi.stubGlobal('fetch', mockFetch);

        const available = await isPackageVersionAvailable('@apexcli/core', '0.6.0');
        expect(available).toBe(true);

        const notAvailable = await isPackageVersionAvailable('@apexcli/core', '0.7.0');
        expect(notAvailable).toBe(false);

        vi.unstubAllGlobals();
      });

      it('should handle network failures gracefully', async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
        vi.stubGlobal('fetch', mockFetch);

        const result = await queryNpmRegistry('@apexcli/core');
        expect(result).toBeNull();

        vi.unstubAllGlobals();
      });
    });
  });

  describe('v0.6.0 Integration Tests', () => {
    it('should validate all v0.6.0 features work together', async () => {
      // This test ensures that all v0.6.0 features are properly integrated
      const context = await analyzer.analyze(projectRoot, {
        includeGit: true,
        includeFrameworks: true,
        includeConfiguration: true,
        includeTestFrameworks: true,
      });

      expect(context).toBeDefined();
      if (!context) return;

      // All context components should be present
      expect(context.git).toBeDefined();
      expect(context.structure).toBeDefined();
      expect(context.frameworks).toBeDefined();
      expect(context.configurations).toBeDefined();
      expect(context.testFrameworks).toBeDefined();

      // Create a health check based on project context
      const healthChecks = [
        createDoctorCheckResult({
          name: 'Project Git Repository',
          description: 'Check if project is a valid git repository',
          status: context.git.isRepository ? 'pass' : 'fail',
          severity: 'error',
          details: context.git.isRepository ?
            `Repository on branch: ${context.git.branch}` :
            'Not a git repository',
        }),
        createDoctorCheckResult({
          name: 'Framework Detection',
          description: 'Check if project frameworks are detected',
          status: context.frameworks.length > 0 ? 'pass' : 'fail',
          severity: 'warning',
          details: `Detected ${context.frameworks.length} frameworks`,
        }),
        createDoctorCheckResult({
          name: 'Test Framework Configuration',
          description: 'Check if test frameworks are configured',
          status: context.testFrameworks.length > 0 ? 'pass' : 'fail',
          severity: 'warning',
          details: `Found ${context.testFrameworks.length} test frameworks`,
        }),
      ];

      const healthReport = createHealthReport(healthChecks, { apexVersion: '0.6.0' });

      // Validate the integrated health report
      expect(healthReport.summary.total).toBe(3);
      expect(healthReport.apexVersion).toBe('0.6.0');
      expect(healthReport.overallStatus).toMatch(/^(pass|fail)$/);
    });

    it('should demonstrate v0.6.0 features are properly typed and validated', () => {
      // This test ensures all the Zod schemas are working correctly
      const testGitStatus: GitStatus = {
        isRepository: true,
        branch: 'main',
        isClean: false,
        hasUncommittedChanges: true,
        hasUntrackedFiles: false,
        hasStagedChanges: true,
        changedFiles: [
          {
            path: 'test.ts',
            status: 'M',
            staged: true,
          }
        ],
        stashCount: 0,
        lastCommit: {
          hash: 'abc123',
          message: 'Test commit',
          timestamp: new Date(),
        },
        tracking: {
          remote: 'origin',
          remoteBranch: 'main',
          aheadCount: 0,
          behindCount: 0,
        },
      };

      expect(() => GitStatusSchema.parse(testGitStatus)).not.toThrow();

      const testFramework: FrameworkDetection = {
        frameworks: [
          {
            name: 'Test Framework',
            version: '1.0.0',
            category: 'testing',
            language: 'typescript',
            runtime: 'node',
            packageManager: 'npm',
            confidence: 'high',
            detectionReasons: ['package.json dependency'],
            configFiles: ['test.config.js'],
          }
        ],
        languages: [
          {
            name: 'TypeScript',
            extensions: ['.ts', '.tsx'],
            percentage: 100,
          }
        ],
        runtime: 'node',
        packageManager: 'npm',
      };

      expect(() => FrameworkDetectionSchema.parse(testFramework)).not.toThrow();
    });
  });

  describe('Future v0.6.0 Feature Preparation', () => {
    it('should have foundations for unimplemented features', () => {
      // This test validates that the foundations are in place for
      // features that are not yet implemented but are planned for v0.6.0

      // Project context analyzer provides the data needed for:
      // - Brownfield codebase analysis
      // - Codebase intelligence
      // - Smart context management
      expect(analyzer).toBeDefined();
      expect(typeof analyzer.analyze).toBe('function');
      expect(typeof analyzer.getGitStatus).toBe('function');
      expect(typeof analyzer.detectFrameworks).toBe('function');

      // Health check utilities provide foundations for apex doctor command
      expect(typeof createHealthReport).toBe('function');
      expect(typeof createDoctorCheckResult).toBe('function');
      expect(typeof queryNpmRegistry).toBe('function');
    });
  });
});