import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  satisfiesVersion,
  compareVersionStrings,
  parseVersionOutput,
  queryNpmRegistry,
  isPackageVersionAvailable,
  getLatestPackageVersion,
  createDoctorCheckResult,
  createHealthReport,
  detectTypeScript,
  detectYarn,
  detectPnpm,
  detectClaudeApiKey,
  NpmPackageInfo,
} from '../doctor-utils.js';
import type { DoctorCheckResult, HealthReport } from '../types.js';

describe('Doctor Utils', () => {
  describe('Version Comparison Utilities', () => {
    describe('satisfiesVersion', () => {
      it('should return true when current version meets minimum requirement', () => {
        expect(satisfiesVersion('18.17.0', '16.0.0')).toBe(true);
        expect(satisfiesVersion('2.1.0', '2.0.0')).toBe(true);
        expect(satisfiesVersion('1.0.0', '1.0.0')).toBe(true);
        expect(satisfiesVersion('v3.2.1', '3.0.0')).toBe(true);
      });

      it('should return false when current version does not meet requirement', () => {
        expect(satisfiesVersion('14.15.0', '16.0.0')).toBe(false);
        expect(satisfiesVersion('1.9.9', '2.0.0')).toBe(false);
        expect(satisfiesVersion('v1.5.0', '2.0.0')).toBe(false);
      });

      it('should handle prerelease versions correctly', () => {
        expect(satisfiesVersion('2.0.0-alpha.1', '2.0.0')).toBe(false);
        expect(satisfiesVersion('2.0.0', '2.0.0-alpha.1')).toBe(true);
        expect(satisfiesVersion('2.0.0-beta.2', '2.0.0-beta.1')).toBe(true);
      });

      it('should return false for invalid versions', () => {
        expect(satisfiesVersion('invalid', '1.0.0')).toBe(false);
        expect(satisfiesVersion('1.0.0', 'invalid')).toBe(false);
        expect(satisfiesVersion('', '1.0.0')).toBe(false);
        expect(satisfiesVersion('1.0.0', '')).toBe(false);
      });

      it('should handle null and undefined gracefully', () => {
        expect(satisfiesVersion(null as any, '1.0.0')).toBe(false);
        expect(satisfiesVersion('1.0.0', null as any)).toBe(false);
        expect(satisfiesVersion(undefined as any, '1.0.0')).toBe(false);
        expect(satisfiesVersion('1.0.0', undefined as any)).toBe(false);
      });
    });

    describe('compareVersionStrings', () => {
      it('should correctly compare version strings', () => {
        expect(compareVersionStrings('1.0.0', '1.0.1')).toBe(-1);
        expect(compareVersionStrings('2.0.0', '1.9.9')).toBe(1);
        expect(compareVersionStrings('1.0.0', '1.0.0')).toBe(0);
        expect(compareVersionStrings('v1.2.3', '1.2.3')).toBe(0);
      });

      it('should handle prerelease versions', () => {
        expect(compareVersionStrings('1.0.0-alpha.1', '1.0.0')).toBe(-1);
        expect(compareVersionStrings('1.0.0', '1.0.0-alpha.1')).toBe(1);
        expect(compareVersionStrings('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1);
        expect(compareVersionStrings('1.0.0-beta.1', '1.0.0-alpha.1')).toBe(1);
      });

      it('should handle invalid versions by treating as 0.0.0', () => {
        expect(compareVersionStrings('invalid', '1.0.0')).toBe(-1);
        expect(compareVersionStrings('1.0.0', 'invalid')).toBe(1);
        expect(compareVersionStrings('invalid', 'invalid')).toBe(0);
      });
    });

    describe('parseVersionOutput', () => {
      it('should parse common version output formats', () => {
        expect(parseVersionOutput('v18.17.0')).toBe('18.17.0');
        expect(parseVersionOutput('18.17.0')).toBe('18.17.0');
        expect(parseVersionOutput('npm version 8.19.2')).toBe('8.19.2');
        expect(parseVersionOutput('git version 2.34.1')).toBe('2.34.1');
        expect(parseVersionOutput('Node.js v16.14.0')).toBe('16.14.0');
        expect(parseVersionOutput('Python 3.9.7')).toBe('3.9.7');
      });

      it('should handle complex version strings', () => {
        expect(parseVersionOutput('v1.2.3-beta.1')).toBe('1.2.3-beta.1');
        expect(parseVersionOutput('npm 8.19.2-pre+build.123')).toBe('8.19.2-pre+build.123');
        expect(parseVersionOutput('Version: 2.1.0')).toBe('2.1.0');
      });

      it('should return null for invalid input', () => {
        expect(parseVersionOutput('invalid output')).toBeNull();
        expect(parseVersionOutput('no version here')).toBeNull();
        expect(parseVersionOutput('')).toBeNull();
        expect(parseVersionOutput(null as any)).toBeNull();
        expect(parseVersionOutput(undefined as any)).toBeNull();
      });

      it('should handle case-insensitive matching', () => {
        expect(parseVersionOutput('Version 2.1.0')).toBe('2.1.0');
        expect(parseVersionOutput('NODE.JS v16.14.0')).toBe('16.14.0');
        expect(parseVersionOutput('GIT version 2.34.1')).toBe('2.34.1');
      });
    });
  });

  describe('NPM Registry Query Utilities', () => {
    // Mock fetch for testing
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    beforeEach(() => {
      mockFetch.mockReset();
      vi.clearAllTimers();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('queryNpmRegistry', () => {
      it('should successfully query package information', async () => {
        const mockResponse = {
          name: 'react',
          version: '18.2.0',
          'dist-tags': { latest: '18.2.0' },
          versions: { '18.2.0': {}, '18.1.0': {}, '17.0.2': {} },
          homepage: 'https://reactjs.org',
          repository: { url: 'git+https://github.com/facebook/react.git' },
        };

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await queryNpmRegistry('react');
        vi.runAllTimers(); // Process any pending timers

        expect(result).toEqual({
          name: 'react',
          version: '18.2.0',
          latestVersion: '18.2.0',
          versions: ['18.2.0', '18.1.0', '17.0.2'],
          homepage: 'https://reactjs.org',
          repository: 'git+https://github.com/facebook/react.git',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://registry.npmjs.org/react',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Accept': 'application/json',
              'User-Agent': 'APEX-doctor/0.6.0',
            }),
          })
        );
      });

      it('should handle scoped packages correctly', async () => {
        const mockResponse = {
          name: '@apexcli/core',
          'dist-tags': { latest: '0.6.0' },
          versions: { '0.6.0': {}, '0.5.0': {} },
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        await queryNpmRegistry('@apexcli/core');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://registry.npmjs.org/@apexcli%2Fcore',
          expect.any(Object)
        );
      });

      it('should handle 404 responses gracefully', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        const result = await queryNpmRegistry('non-existent-package');

        expect(result).toEqual({
          name: 'non-existent-package',
          version: '',
          latestVersion: '',
          versions: [],
          error: 'Package not found',
        });
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const result = await queryNpmRegistry('some-package');

        expect(result).toEqual({
          name: 'some-package',
          version: '',
          latestVersion: '',
          versions: [],
          error: 'Network error',
        });
      });

      it('should handle timeout errors', async () => {
        mockFetch.mockImplementation(() => {
          return new Promise((resolve) => {
            // Simulate a request that takes longer than timeout
            setTimeout(() => {
              resolve({
                ok: true,
                json: () => Promise.resolve({ name: 'test' }),
              });
            }, 10000); // 10 seconds
          });
        });

        const resultPromise = queryNpmRegistry('test-package', { timeout: 1000 });

        // Fast-forward time to trigger timeout
        vi.advanceTimersByTime(1000);

        const result = await resultPromise;

        expect(result).toEqual({
          name: 'test-package',
          version: '',
          latestVersion: '',
          versions: [],
          error: 'Request timeout',
        });
      });

      it('should use custom registry when provided', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ name: 'test', 'dist-tags': {} }),
        });

        await queryNpmRegistry('test-package', {
          registry: 'https://custom-registry.com',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://custom-registry.com/test-package',
          expect.any(Object)
        );
      });

      it('should return null for empty package name', async () => {
        const result = await queryNpmRegistry('');
        expect(result).toBeNull();
      });
    });

    describe('isPackageVersionAvailable', () => {
      it('should return true when version exists', async () => {
        const mockInfo: NpmPackageInfo = {
          name: 'react',
          version: '',
          latestVersion: '18.2.0',
          versions: ['18.2.0', '18.1.0', '17.0.2'],
        };

        vi.doMock('../doctor-utils.js', () => ({
          ...vi.importActual('../doctor-utils.js'),
          queryNpmRegistry: vi.fn().mockResolvedValue(mockInfo),
        }));

        const result = await isPackageVersionAvailable('react', '18.1.0');
        expect(result).toBe(true);
      });

      it('should return false when version does not exist', async () => {
        const mockInfo: NpmPackageInfo = {
          name: 'react',
          version: '',
          latestVersion: '18.2.0',
          versions: ['18.2.0', '18.1.0'],
        };

        // Mock queryNpmRegistry for this test
        const originalQuery = await import('../doctor-utils.js');
        vi.spyOn(originalQuery, 'queryNpmRegistry').mockResolvedValue(mockInfo);

        const result = await isPackageVersionAvailable('react', '19.0.0');
        expect(result).toBe(false);
      });

      it('should return false when query fails', async () => {
        const originalQuery = await import('../doctor-utils.js');
        vi.spyOn(originalQuery, 'queryNpmRegistry').mockResolvedValue(null);

        const result = await isPackageVersionAvailable('react', '18.0.0');
        expect(result).toBe(false);
      });
    });

    describe('getLatestPackageVersion', () => {
      it('should return latest version when available', async () => {
        const mockInfo: NpmPackageInfo = {
          name: 'react',
          version: '',
          latestVersion: '18.2.0',
          versions: ['18.2.0', '18.1.0'],
        };

        const originalQuery = await import('../doctor-utils.js');
        vi.spyOn(originalQuery, 'queryNpmRegistry').mockResolvedValue(mockInfo);

        const result = await getLatestPackageVersion('react');
        expect(result).toBe('18.2.0');
      });

      it('should return null when query fails', async () => {
        const originalQuery = await import('../doctor-utils.js');
        vi.spyOn(originalQuery, 'queryNpmRegistry').mockResolvedValue(null);

        const result = await getLatestPackageVersion('react');
        expect(result).toBeNull();
      });
    });
  });

  describe('Health Check Factory Functions', () => {
    describe('createDoctorCheckResult', () => {
      it('should create check result with required fields and defaults', () => {
        const result = createDoctorCheckResult({
          id: 'test-check',
          name: 'Test Check',
          category: 'toolchain',
        });

        expect(result.id).toBe('test-check');
        expect(result.name).toBe('Test Check');
        expect(result.category).toBe('toolchain');
        expect(result.description).toBe('Health check for Test Check');
        expect(result.status).toBe('unknown');
        expect(result.severity).toBe('info');
        expect(result.message).toBe('Check completed');
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(result.durationMs).toBe(0);
      });

      it('should override defaults with provided values', () => {
        const customTimestamp = new Date('2024-01-01T00:00:00Z');

        const result = createDoctorCheckResult({
          id: 'custom-check',
          name: 'Custom Check',
          category: 'network',
          status: 'pass',
          severity: 'error',
          message: 'Custom message',
          description: 'Custom description',
          timestamp: customTimestamp,
          durationMs: 150,
          toolchain: {
            name: 'node',
            currentVersion: '18.0.0',
            required: true,
          },
        });

        expect(result.id).toBe('custom-check');
        expect(result.status).toBe('pass');
        expect(result.severity).toBe('error');
        expect(result.message).toBe('Custom message');
        expect(result.description).toBe('Custom description');
        expect(result.timestamp).toBe(customTimestamp);
        expect(result.durationMs).toBe(150);
        expect(result.toolchain?.name).toBe('node');
      });

      it('should include suggestion and details when provided', () => {
        const result = createDoctorCheckResult({
          id: 'detailed-check',
          name: 'Detailed Check',
          category: 'config',
          suggestion: 'Update your configuration',
          details: { configPath: '/path/to/config', validated: true },
        });

        expect(result.suggestion).toBe('Update your configuration');
        expect(result.details).toEqual({
          configPath: '/path/to/config',
          validated: true,
        });
      });
    });

    describe('createHealthReport', () => {
      it('should create health report with summary statistics', () => {
        const checks: DoctorCheckResult[] = [
          createDoctorCheckResult({
            id: 'check1',
            name: 'Check 1',
            category: 'toolchain',
            status: 'pass',
            durationMs: 100,
          }),
          createDoctorCheckResult({
            id: 'check2',
            name: 'Check 2',
            category: 'config',
            status: 'fail',
            severity: 'error',
            durationMs: 200,
          }),
          createDoctorCheckResult({
            id: 'check3',
            name: 'Check 3',
            category: 'network',
            status: 'skip',
            durationMs: 50,
          }),
        ];

        const report = createHealthReport(checks, { apexVersion: '0.6.0' });

        expect(report.summary.total).toBe(3);
        expect(report.summary.passed).toBe(1);
        expect(report.summary.failed).toBe(1);
        expect(report.summary.skipped).toBe(1);
        expect(report.summary.warnings).toBe(0);
        expect(report.durationMs).toBe(350); // Sum of all check durations
        expect(report.overallStatus).toBe('fail'); // Has failed checks
        expect(report.apexVersion).toBe('0.6.0');
      });

      it('should determine overall status correctly', () => {
        // All passing
        const passingChecks = [
          createDoctorCheckResult({
            id: 'check1',
            name: 'Check 1',
            category: 'toolchain',
            status: 'pass',
          }),
        ];
        const passingReport = createHealthReport(passingChecks);
        expect(passingReport.overallStatus).toBe('pass');

        // Has failures
        const failingChecks = [
          createDoctorCheckResult({
            id: 'check1',
            name: 'Check 1',
            category: 'toolchain',
            status: 'pass',
          }),
          createDoctorCheckResult({
            id: 'check2',
            name: 'Check 2',
            category: 'toolchain',
            status: 'fail',
          }),
        ];
        const failingReport = createHealthReport(failingChecks);
        expect(failingReport.overallStatus).toBe('fail');

        // All skipped
        const skippedChecks = [
          createDoctorCheckResult({
            id: 'check1',
            name: 'Check 1',
            category: 'toolchain',
            status: 'skip',
          }),
        ];
        const skippedReport = createHealthReport(skippedChecks);
        expect(skippedReport.overallStatus).toBe('unknown');

        // Empty checks
        const emptyReport = createHealthReport([]);
        expect(emptyReport.overallStatus).toBe('unknown');
      });

      it('should count warnings correctly', () => {
        const checks: DoctorCheckResult[] = [
          createDoctorCheckResult({
            id: 'check1',
            name: 'Check 1',
            category: 'toolchain',
            status: 'fail',
            severity: 'warning',
          }),
          createDoctorCheckResult({
            id: 'check2',
            name: 'Check 2',
            category: 'toolchain',
            status: 'pass',
            severity: 'warning', // Should not count as warning since it passed
          }),
        ];

        const report = createHealthReport(checks);
        expect(report.summary.warnings).toBe(1); // Only failed checks with warning severity
      });

      it('should include system information', () => {
        const report = createHealthReport([]);

        expect(report.system.platform).toBe(process.platform);
        expect(report.system.arch).toBe(process.arch);
        expect(report.system.nodeVersion).toBe(process.version);
        expect(report.system.cwd).toBe(process.cwd());
      });

      it('should generate unique report IDs', () => {
        const report1 = createHealthReport([]);
        const report2 = createHealthReport([]);

        expect(report1.id).toBeDefined();
        expect(report2.id).toBeDefined();
        expect(report1.id).not.toBe(report2.id);
        expect(report1.id).toMatch(/^health-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
      });

      it('should use default APEX version when not provided', () => {
        const report = createHealthReport([]);
        expect(report.apexVersion).toBe('0.6.0');
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should work together for comprehensive health checking', () => {
      // Simulate parsing version output
      const nodeVersion = parseVersionOutput('Node.js v18.17.0');
      const npmVersion = parseVersionOutput('npm 8.19.2');

      expect(nodeVersion).toBe('18.17.0');
      expect(npmVersion).toBe('8.19.2');

      // Check versions against requirements
      const nodeValid = satisfiesVersion(nodeVersion!, '16.0.0');
      const npmValid = satisfiesVersion(npmVersion!, '7.0.0');

      expect(nodeValid).toBe(true);
      expect(npmValid).toBe(true);

      // Create check results
      const nodeCheck = createDoctorCheckResult({
        id: 'node-version',
        name: 'Node.js Version Check',
        category: 'toolchain',
        status: nodeValid ? 'pass' : 'fail',
        severity: 'error',
        message: nodeValid ?
          `Node.js ${nodeVersion} meets requirement >= 16.0.0` :
          `Node.js ${nodeVersion} does not meet requirement >= 16.0.0`,
        toolchain: {
          name: 'node',
          currentVersion: nodeVersion,
          requiredVersion: '16.0.0',
          required: true,
        },
        durationMs: 150,
      });

      const npmCheck = createDoctorCheckResult({
        id: 'npm-version',
        name: 'npm Version Check',
        category: 'toolchain',
        status: npmValid ? 'pass' : 'fail',
        severity: 'error',
        message: npmValid ?
          `npm ${npmVersion} meets requirement >= 7.0.0` :
          `npm ${npmVersion} does not meet requirement >= 7.0.0`,
        toolchain: {
          name: 'npm',
          currentVersion: npmVersion,
          requiredVersion: '7.0.0',
          required: true,
        },
        durationMs: 120,
      });

      // Create comprehensive health report
      const report = createHealthReport([nodeCheck, npmCheck], {
        apexVersion: '0.6.0',
      });

      expect(report.summary.total).toBe(2);
      expect(report.summary.passed).toBe(2);
      expect(report.summary.failed).toBe(0);
      expect(report.overallStatus).toBe('pass');
      expect(report.durationMs).toBe(270);
      expect(report.checks).toHaveLength(2);
      expect(report.checks[0].toolchain?.name).toBe('node');
      expect(report.checks[1].toolchain?.name).toBe('npm');
    });
  });
});