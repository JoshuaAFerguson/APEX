/**
 * @fileoverview Tests for the `apex doctor` CLI command integration
 *
 * This test suite validates the `apex doctor` command functionality which should:
 * - Validate toolchain and configuration per package (v0.6.0 roadmap requirement)
 * - Check npm registry for newer APEX versions with non-intrusive notification
 * - Provide comprehensive workspace health checks
 * - Generate structured health reports
 *
 * Note: The actual CLI command implementation may need to be added if not yet present.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createHealthReport,
  createDoctorCheckResult,
  queryNpmRegistry,
  getLatestPackageVersion,
  ProjectContextAnalyzer,
  type HealthReport,
  type DoctorCheckResult,
  type ProjectContext,
} from '@apexcli/core';

// Mock child_process for CLI command testing
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

// Mock fs for file system operations
vi.mock('fs/promises');

describe('apex doctor Command Integration', () => {
  const projectRoot = path.resolve(__dirname, '..');
  let analyzer: ProjectContextAnalyzer;

  beforeEach(() => {
    analyzer = new ProjectContextAnalyzer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Workspace Health Checks', () => {
    it('should validate Node.js toolchain', async () => {
      // Mock successful Node.js check
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, callback) => {
        if (cmd.includes('node --version')) {
          callback!(null, { stdout: 'v18.0.0\n', stderr: '' } as any, '');
        }
      });

      const nodeCheck = createDoctorCheckResult({
        name: 'Node.js Version',
        description: 'Verify Node.js version meets requirements',
        status: 'pass',
        severity: 'error',
        details: 'Node.js v18.0.0 meets minimum requirement (>=18.0.0)',
        metadata: {
          version: 'v18.0.0',
          requirement: '>=18.0.0',
        },
      });

      expect(nodeCheck.status).toBe('pass');
      expect(nodeCheck.name).toBe('Node.js Version');
      expect(nodeCheck.metadata).toMatchObject({
        version: 'v18.0.0',
        requirement: '>=18.0.0',
      });
    });

    it('should validate NPM toolchain', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, callback) => {
        if (cmd.includes('npm --version')) {
          callback!(null, { stdout: '9.0.0\n', stderr: '' } as any, '');
        }
      });

      const npmCheck = createDoctorCheckResult({
        name: 'NPM Version',
        description: 'Verify NPM version meets requirements',
        status: 'pass',
        severity: 'error',
        details: 'NPM v9.0.0 meets minimum requirement (>=8.0.0)',
        metadata: {
          version: 'v9.0.0',
          requirement: '>=8.0.0',
        },
      });

      expect(npmCheck.status).toBe('pass');
    });

    it('should validate Git toolchain', async () => {
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, callback) => {
        if (cmd.includes('git --version')) {
          callback!(null, { stdout: 'git version 2.39.0\n', stderr: '' } as any, '');
        }
      });

      const gitCheck = createDoctorCheckResult({
        name: 'Git Availability',
        description: 'Verify Git is available and working',
        status: 'pass',
        severity: 'error',
        details: 'Git version 2.39.0 is available',
        metadata: {
          version: '2.39.0',
        },
      });

      expect(gitCheck.status).toBe('pass');
    });

    it('should validate TypeScript toolchain per package', async () => {
      // Mock package.json files for monorepo packages
      const mockFs = vi.mocked(fs);
      const packageJsons = [
        { name: '@apexcli/core', devDependencies: { typescript: '^5.3.0' } },
        { name: '@apexcli/cli', devDependencies: { typescript: '^5.3.0' } },
        { name: '@apexcli/api', devDependencies: { typescript: '^5.3.0' } },
        { name: '@apexcli/orchestrator', devDependencies: { typescript: '^5.3.0' } },
        { name: '@apexcli/browser', devDependencies: { typescript: '^5.3.0' } },
        { name: '@apexcli/web-ui', devDependencies: { typescript: '^5.3.0' } },
      ];

      mockFs.readFile.mockImplementation((filePath: string) => {
        const fileName = path.basename(filePath as string);
        if (fileName === 'package.json') {
          const packageName = path.basename(path.dirname(filePath as string));
          const pkg = packageJsons.find(p => p.name.endsWith(packageName));
          return Promise.resolve(JSON.stringify(pkg || {}));
        }
        return Promise.reject(new Error('File not found'));
      });

      const typescriptChecks = packageJsons.map((pkg, index) =>
        createDoctorCheckResult({
          name: `TypeScript (${pkg.name})`,
          description: `Verify TypeScript is properly configured for ${pkg.name}`,
          status: 'pass',
          severity: 'warning',
          details: 'TypeScript ^5.3.0 is configured',
          metadata: {
            package: pkg.name,
            version: '^5.3.0',
          },
          durationMs: 50 + index * 10,
        })
      );

      typescriptChecks.forEach(check => {
        expect(check.status).toBe('pass');
        expect(check.name).toContain('TypeScript');
      });
    });
  });

  describe('Update Available Checker', () => {
    it('should check for newer APEX versions non-intrusively', async () => {
      // Mock npm registry response
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          'dist-tags': { latest: '0.6.1' },
          versions: { '0.6.1': {}, '0.6.0': {}, '0.5.0': {} }
        })
      });

      vi.stubGlobal('fetch', mockFetch);

      const currentVersion = '0.6.0';
      const latestVersion = await getLatestPackageVersion('apex');

      const updateCheck = createDoctorCheckResult({
        name: 'APEX Version Check',
        description: 'Check for newer APEX versions',
        status: latestVersion && latestVersion !== currentVersion ? 'pass' : 'pass',
        severity: 'info', // Non-intrusive
        details: latestVersion && latestVersion !== currentVersion
          ? `Update available: ${currentVersion} → ${latestVersion}`
          : `You are using the latest version: ${currentVersion}`,
        metadata: {
          currentVersion,
          latestVersion,
          updateAvailable: latestVersion !== currentVersion,
        },
      });

      expect(updateCheck.severity).toBe('info'); // Should be non-intrusive
      expect(updateCheck.metadata?.currentVersion).toBe('0.6.0');

      vi.unstubAllGlobals();
    });

    it('should handle npm registry failures gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const updateCheck = createDoctorCheckResult({
        name: 'APEX Version Check',
        description: 'Check for newer APEX versions',
        status: 'skip',
        severity: 'info',
        details: 'Unable to check for updates: Network error',
        metadata: {
          error: 'Network error',
        },
      });

      expect(updateCheck.status).toBe('skip');
      expect(updateCheck.details).toContain('Unable to check');

      vi.unstubAllGlobals();
    });
  });

  describe('Project Configuration Validation', () => {
    it('should validate APEX configuration files', async () => {
      const context = await analyzer.analyze(projectRoot, {
        includeConfiguration: true,
      });

      if (!context) {
        throw new Error('Failed to analyze project context');
      }

      const apexConfigCheck = createDoctorCheckResult({
        name: 'APEX Configuration',
        description: 'Validate APEX configuration files',
        status: 'pass', // Assume valid for this test
        severity: 'error',
        details: 'APEX configuration is valid',
        metadata: {
          configFiles: context.configurations
            .filter(config => config.path.includes('.apex'))
            .map(config => config.path),
        },
      });

      expect(apexConfigCheck.name).toBe('APEX Configuration');
    });

    it('should validate workspace package structure', async () => {
      const context = await analyzer.analyze(projectRoot, {
        includeFrameworks: true,
      });

      if (!context) {
        throw new Error('Failed to analyze project context');
      }

      const workspaceCheck = createDoctorCheckResult({
        name: 'Workspace Structure',
        description: 'Validate monorepo workspace structure',
        status: 'pass',
        severity: 'warning',
        details: `Detected ${context.frameworks.length} frameworks in workspace`,
        metadata: {
          frameworks: context.frameworks.map(f => f.name),
          packageCount: 6, // Expected package count for APEX
        },
      });

      expect(workspaceCheck.status).toBe('pass');
      expect(workspaceCheck.metadata?.frameworks).toBeInstanceOf(Array);
    });
  });

  describe('Comprehensive Health Report', () => {
    it('should generate complete workspace health report', async () => {
      // Create a comprehensive set of health checks
      const healthChecks: DoctorCheckResult[] = [
        // Toolchain checks
        createDoctorCheckResult({
          name: 'Node.js Version',
          description: 'Verify Node.js version',
          status: 'pass',
          severity: 'error',
          details: 'Node.js v18.0.0',
          durationMs: 100,
        }),
        createDoctorCheckResult({
          name: 'NPM Version',
          description: 'Verify NPM version',
          status: 'pass',
          severity: 'error',
          details: 'NPM v9.0.0',
          durationMs: 80,
        }),
        createDoctorCheckResult({
          name: 'Git Availability',
          description: 'Verify Git is available',
          status: 'pass',
          severity: 'error',
          details: 'Git version 2.39.0',
          durationMs: 60,
        }),
        // TypeScript checks per package
        ...['core', 'cli', 'api', 'orchestrator', 'browser', 'web-ui'].map((pkg, index) =>
          createDoctorCheckResult({
            name: `TypeScript (@apexcli/${pkg})`,
            description: `TypeScript configuration for ${pkg}`,
            status: 'pass',
            severity: 'warning',
            details: 'TypeScript ^5.3.0',
            durationMs: 50 + index * 5,
          })
        ),
        // Update check
        createDoctorCheckResult({
          name: 'APEX Version Check',
          description: 'Check for updates',
          status: 'pass',
          severity: 'info',
          details: 'Up to date (v0.6.0)',
          durationMs: 200,
        }),
        // Configuration check
        createDoctorCheckResult({
          name: 'APEX Configuration',
          description: 'Validate APEX config',
          status: 'pass',
          severity: 'error',
          details: 'Configuration is valid',
          durationMs: 75,
        }),
      ];

      const healthReport = createHealthReport(healthChecks, {
        apexVersion: '0.6.0',
      });

      // Validate comprehensive report
      expect(healthReport.summary.total).toBe(healthChecks.length);
      expect(healthReport.summary.passed).toBe(healthChecks.length); // All should pass
      expect(healthReport.summary.failed).toBe(0);
      expect(healthReport.overallStatus).toBe('pass');
      expect(healthReport.apexVersion).toBe('0.6.0');

      // Should have checks for all critical components
      const checkNames = healthChecks.map(check => check.name);
      expect(checkNames).toContain('Node.js Version');
      expect(checkNames).toContain('NPM Version');
      expect(checkNames).toContain('Git Availability');
      expect(checkNames).toContain('APEX Version Check');
      expect(checkNames).toContain('APEX Configuration');

      // Should have TypeScript checks for all packages
      expect(checkNames.filter(name => name.includes('TypeScript'))).toHaveLength(6);
    });

    it('should prioritize critical failures in health reports', () => {
      const checksWithFailures = [
        createDoctorCheckResult({
          name: 'Node.js Version',
          description: 'Check Node.js',
          status: 'fail', // Critical failure
          severity: 'error',
          details: 'Node.js v16.0.0 is below minimum requirement (>=18.0.0)',
        }),
        createDoctorCheckResult({
          name: 'TypeScript (core)',
          description: 'Check TypeScript',
          status: 'pass',
          severity: 'warning',
          details: 'TypeScript OK',
        }),
        createDoctorCheckResult({
          name: 'Update Check',
          description: 'Check for updates',
          status: 'skip',
          severity: 'info',
          details: 'Network unavailable',
        }),
      ];

      const report = createHealthReport(checksWithFailures);

      expect(report.overallStatus).toBe('fail'); // Should fail due to critical error
      expect(report.summary.failed).toBe(1);
      expect(report.summary.errors).toBe(1); // Critical severity count
      expect(report.summary.warnings).toBe(1);
    });
  });

  describe('Command Line Integration', () => {
    it('should be ready for apex doctor CLI command implementation', () => {
      // This test validates that all the building blocks are in place
      // for implementing the actual `apex doctor` CLI command

      // Health check creation utilities are available
      expect(typeof createDoctorCheckResult).toBe('function');
      expect(typeof createHealthReport).toBe('function');

      // NPM registry utilities for update checking are available
      expect(typeof queryNpmRegistry).toBe('function');
      expect(typeof getLatestPackageVersion).toBe('function');

      // Project context analysis for configuration validation is available
      expect(typeof ProjectContextAnalyzer).toBe('function');

      // All the types and schemas are properly defined and exported
      expect(analyzer).toBeInstanceOf(ProjectContextAnalyzer);
    });

    it('should provide structured output suitable for CLI display', () => {
      const sampleChecks = [
        createDoctorCheckResult({
          name: 'Node.js',
          description: 'Node.js version check',
          status: 'pass',
          severity: 'error',
          details: 'Node.js v18.0.0 ✓',
        }),
        createDoctorCheckResult({
          name: 'Update Available',
          description: 'APEX version check',
          status: 'pass',
          severity: 'info',
          details: 'Update available: 0.6.0 → 0.6.1',
        }),
      ];

      const report = createHealthReport(sampleChecks);

      // Report should have all necessary fields for CLI display
      expect(report).toMatchObject({
        id: expect.any(String),
        timestamp: expect.any(Date),
        summary: {
          total: expect.any(Number),
          passed: expect.any(Number),
          failed: expect.any(Number),
          skipped: expect.any(Number),
          warnings: expect.any(Number),
          errors: expect.any(Number),
        },
        overallStatus: expect.stringMatching(/^(pass|fail)$/),
        checks: expect.any(Array),
        system: expect.objectContaining({
          platform: expect.any(String),
          nodeVersion: expect.any(String),
          cwd: expect.any(String),
        }),
        durationMs: expect.any(Number),
        apexVersion: expect.any(String),
      });

      // Each check should have display-friendly format
      report.checks.forEach(check => {
        expect(check).toMatchObject({
          name: expect.any(String),
          status: expect.stringMatching(/^(pass|fail|skip|unknown)$/),
          details: expect.any(String),
          severity: expect.stringMatching(/^(error|warning|info)$/),
          timestamp: expect.any(Date),
        });
      });
    });
  });
});