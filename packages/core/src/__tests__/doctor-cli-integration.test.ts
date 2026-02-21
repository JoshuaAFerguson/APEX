import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Integration tests for CLI handler functions that use doctor-utils
 * These tests verify that the CLI handlers properly integrate with the core utilities
 */

describe('Doctor CLI Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CLI Handler Function Integration', () => {
    it('should verify CLI handler imports from doctor-utils', async () => {
      // Test that all required functions are exported from doctor-utils
      const doctorUtils = await import('../doctor-utils.js');

      const requiredExports = [
        'satisfiesVersion',
        'parseVersionOutput',
        'createDoctorCheckResult',
        'createHealthReport',
        'getLatestPackageVersion',
        'detectTypeScript',
        'detectYarn',
        'detectPnpm',
        'detectClaudeApiKey',
        'queryNpmRegistry',
      ];

      requiredExports.forEach(exportName => {
        expect(doctorUtils[exportName]).toBeDefined();
        expect(typeof doctorUtils[exportName]).toBe('function');
      });
    });

    it('should verify ToolchainCheck type compatibility', async () => {
      // Test that detection functions return compatible ToolchainCheck objects
      const { detectTypeScript, detectYarn, detectPnpm, detectClaudeApiKey } = await import('../doctor-utils.js');

      const results = await Promise.all([
        detectTypeScript({ local: true }),
        detectYarn(),
        detectPnpm(),
        detectClaudeApiKey(),
      ]);

      results.forEach(result => {
        // Verify ToolchainCheck structure matches what CLI handlers expect
        expect(result).toHaveProperty('name');
        expect(typeof result.name).toBe('string');

        expect(result).toHaveProperty('currentVersion');
        expect(result.currentVersion === null || typeof result.currentVersion === 'string').toBe(true);

        expect(result).toHaveProperty('requiredVersion');
        expect(typeof result.requiredVersion).toBe('string');

        expect(result).toHaveProperty('required');
        expect(typeof result.required).toBe('boolean');

        expect(result).toHaveProperty('metadata');
        expect(typeof result.metadata).toBe('object');

        // Optional properties that CLI handlers may use
        if (result.path !== undefined) {
          expect(typeof result.path).toBe('string');
        }
      });
    });

    it('should verify DoctorCheckResult creation works for CLI scenarios', async () => {
      const { createDoctorCheckResult } = await import('../doctor-utils.js');

      // Test scenarios that CLI handlers use
      const testCases = [
        {
          id: 'node-version',
          name: 'Node.js Version',
          category: 'toolchain' as const,
          status: 'pass' as const,
          severity: 'info' as const,
        },
        {
          id: 'npm-version',
          name: 'npm Package Manager',
          category: 'toolchain' as const,
          status: 'fail' as const,
          severity: 'error' as const,
        },
        {
          id: 'git-version',
          name: 'Git Version Control',
          category: 'toolchain' as const,
          status: 'skip' as const,
          severity: 'warning' as const,
        },
      ];

      testCases.forEach(testCase => {
        const result = createDoctorCheckResult(testCase);

        expect(result.id).toBe(testCase.id);
        expect(result.name).toBe(testCase.name);
        expect(result.category).toBe(testCase.category);
        expect(result.status).toBe(testCase.status);
        expect(result.severity).toBe(testCase.severity);
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(typeof result.durationMs).toBe('number');
      });
    });

    it('should verify HealthReport generation for CLI display', async () => {
      const { createHealthReport, createDoctorCheckResult } = await import('../doctor-utils.js');

      // Create a realistic set of checks like CLI would generate
      const checks = [
        createDoctorCheckResult({
          id: 'node-version',
          name: 'Node.js Version',
          category: 'toolchain',
          status: 'pass',
          severity: 'info',
          durationMs: 50,
        }),
        createDoctorCheckResult({
          id: 'npm-version',
          name: 'npm Package Manager',
          category: 'toolchain',
          status: 'pass',
          severity: 'info',
          durationMs: 120,
        }),
        createDoctorCheckResult({
          id: 'git-version',
          name: 'Git Version Control',
          category: 'toolchain',
          status: 'skip',
          severity: 'info',
          durationMs: 75,
        }),
        createDoctorCheckResult({
          id: 'claude-api-key',
          name: 'Claude API Key',
          category: 'config',
          status: 'fail',
          severity: 'error',
          durationMs: 25,
        }),
      ];

      const report = createHealthReport(checks, { apexVersion: '0.6.0' });

      // Verify structure that CLI display functions expect
      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('overallStatus');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('checks');
      expect(report).toHaveProperty('system');
      expect(report).toHaveProperty('durationMs');
      expect(report).toHaveProperty('apexVersion');

      // Verify summary calculations
      expect(report.summary.total).toBe(4);
      expect(report.summary.passed).toBe(2);
      expect(report.summary.failed).toBe(1);
      expect(report.summary.skipped).toBe(1);
      expect(report.overallStatus).toBe('fail'); // Due to failed API key check

      // Verify system info is populated
      expect(report.system.platform).toBe(process.platform);
      expect(report.system.arch).toBe(process.arch);
      expect(report.system.nodeVersion).toBe(process.version);
      expect(report.system.cwd).toBe(process.cwd());

      // Verify APEX version
      expect(report.apexVersion).toBe('0.6.0');
    });
  });

  describe('Version parsing integration', () => {
    it('should handle real-world Node.js version formats', async () => {
      const { parseVersionOutput, satisfiesVersion } = await import('../doctor-utils.js');

      const realNodeVersions = [
        'v18.17.0',
        'v16.20.0',
        'v20.5.1',
        'v19.9.0',
      ];

      realNodeVersions.forEach(version => {
        const parsed = parseVersionOutput(version);
        expect(parsed).toBeTruthy();
        expect(parsed).toMatch(/^\d+\.\d+\.\d+$/);

        // Test against realistic requirements
        const meetsMinimum = satisfiesVersion(parsed!, '16.0.0');
        expect(typeof meetsMinimum).toBe('boolean');
      });
    });

    it('should handle real-world npm version formats', async () => {
      const { parseVersionOutput } = await import('../doctor-utils.js');

      const realNpmVersions = [
        '8.19.2',
        '9.8.1',
        '10.1.0',
        'npm version 8.19.2',
      ];

      realNpmVersions.forEach(version => {
        const parsed = parseVersionOutput(version);
        expect(parsed).toBeTruthy();
        expect(parsed).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });

    it('should handle real-world Git version formats', async () => {
      const { parseVersionOutput } = await import('../doctor-utils.js');

      const realGitVersions = [
        'git version 2.34.1',
        'git version 2.39.2.windows.1',
        'git version 2.40.0',
      ];

      realGitVersions.forEach(version => {
        const parsed = parseVersionOutput(version);
        expect(parsed).toBeTruthy();
        // Git versions may have additional components
        expect(parsed).toMatch(/^\d+\.\d+\.\d+/);
      });
    });
  });

  describe('Error scenarios CLI handlers must handle', () => {
    it('should provide meaningful error information for missing tools', async () => {
      const { detectYarn, detectPnpm } = await import('../doctor-utils.js');

      // These might fail if tools aren't installed
      const yarnResult = await detectYarn();
      const pnpmResult = await detectPnpm();

      // Whether they succeed or fail, they should provide useful info
      [yarnResult, pnpmResult].forEach(result => {
        if (result.currentVersion === null) {
          // If tool is not found, should have error info
          expect(result.metadata?.error).toBeDefined();
          expect(typeof result.metadata.error).toBe('string');
        } else {
          // If tool is found, should have version info
          expect(typeof result.currentVersion).toBe('string');
          expect(result.metadata?.raw).toBeDefined();
        }

        // Should have package manager metadata
        expect(result.metadata?.packageManager).toBe(true);
      });
    });

    it('should handle environment-specific detection correctly', async () => {
      const { detectClaudeApiKey } = await import('../doctor-utils.js');

      const result = await detectClaudeApiKey();

      // Should provide clear information about API key status
      expect(result.name).toBe('claude-api-key');
      expect(result.required).toBe(true);
      expect(result.requiredVersion).toBe('present');

      if (result.currentVersion === 'present') {
        // If found, should indicate source
        expect(result.path).toBeDefined();
        expect(result.metadata?.source).toBeDefined();
      } else {
        // If not found, should be clear about that
        expect(result.currentVersion).toBeNull();
        expect(result.path).toBeUndefined();
      }
    });
  });

  describe('Cross-platform compatibility', () => {
    it('should work consistently across platforms', async () => {
      const { detectTypeScript } = await import('../doctor-utils.js');

      // Test both global and local detection
      const globalResult = await detectTypeScript({ local: false });
      const localResult = await detectTypeScript({ local: true });

      // Both should have consistent structure regardless of platform
      [globalResult, localResult].forEach(result => {
        expect(result.name).toBe('typescript');
        expect(result.required).toBe(false);
        expect(result.requiredVersion).toBe('4.0.0');
        expect(result.metadata?.installation).toBeDefined();
      });

      // Local detection should indicate correct installation type
      if (localResult.currentVersion) {
        expect(['local', 'package.json'].includes(localResult.metadata?.installation as string)).toBe(true);
      }

      // Global detection should indicate global installation
      if (globalResult.currentVersion) {
        expect(globalResult.metadata?.installation).toBe('global');
      }
    });
  });

  describe('Package registry integration', () => {
    it('should handle npm registry queries for update checking', async () => {
      const { getLatestPackageVersion } = await import('../doctor-utils.js');

      // Test with a known package (with timeout to avoid hanging tests)
      const result = await getLatestPackageVersion('react', { timeout: 5000 });

      // Should either return a version string or null (if network issues)
      if (result !== null) {
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^\d+\.\d+\.\d+/);
      }
    });

    it('should handle scoped package queries', async () => {
      const { queryNpmRegistry } = await import('../doctor-utils.js');

      // Test with a known scoped package
      const result = await queryNpmRegistry('@types/node', { timeout: 5000 });

      if (result && !result.error) {
        expect(result.name).toBe('@types/node');
        expect(result.latestVersion).toBeTruthy();
        expect(Array.isArray(result.versions)).toBe(true);
      }
    });
  });
});