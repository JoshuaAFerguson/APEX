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
  type NpmPackageInfo,
} from './doctor-utils';
import type { DoctorCheckResult, CheckStatus } from './types';

// Mock fetch for npm registry tests
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Version Comparison Utilities', () => {
  describe('satisfiesVersion', () => {
    it('should return true when current version meets requirement', () => {
      expect(satisfiesVersion('18.17.0', '16.0.0')).toBe(true);
      expect(satisfiesVersion('2.1.0', '2.0.0')).toBe(true);
      expect(satisfiesVersion('1.0.0', '1.0.0')).toBe(true);
    });

    it('should return false when current version does not meet requirement', () => {
      expect(satisfiesVersion('14.15.0', '16.0.0')).toBe(false);
      expect(satisfiesVersion('1.9.0', '2.0.0')).toBe(false);
      expect(satisfiesVersion('0.9.0', '1.0.0')).toBe(false);
    });

    it('should handle version prefixes correctly', () => {
      expect(satisfiesVersion('v18.17.0', '16.0.0')).toBe(true);
      expect(satisfiesVersion('18.17.0', 'v16.0.0')).toBe(true);
      expect(satisfiesVersion('v18.17.0', 'v16.0.0')).toBe(true);
    });

    it('should handle prerelease versions', () => {
      expect(satisfiesVersion('2.1.0-beta.1', '2.0.0')).toBe(true);
      expect(satisfiesVersion('2.0.0-beta.1', '2.0.0')).toBe(false);
      expect(satisfiesVersion('2.0.0', '2.0.0-beta.1')).toBe(true);
    });

    it('should return false for empty or invalid inputs', () => {
      expect(satisfiesVersion('', '1.0.0')).toBe(false);
      expect(satisfiesVersion('1.0.0', '')).toBe(false);
      expect(satisfiesVersion('invalid', '1.0.0')).toBe(false);
      expect(satisfiesVersion('1.0.0', 'invalid')).toBe(false);
    });
  });

  describe('compareVersionStrings', () => {
    it('should return correct comparison for different versions', () => {
      expect(compareVersionStrings('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersionStrings('2.0.0', '1.9.9')).toBe(1);
      expect(compareVersionStrings('1.0.0', '1.0.0')).toBe(0);
    });

    it('should handle version prefixes', () => {
      expect(compareVersionStrings('v1.2.3', '1.2.3')).toBe(0);
      expect(compareVersionStrings('v1.2.4', '1.2.3')).toBe(1);
    });

    it('should handle prerelease versions', () => {
      expect(compareVersionStrings('1.0.0-alpha', '1.0.0')).toBe(-1);
      expect(compareVersionStrings('1.0.0-beta', '1.0.0-alpha')).toBe(1);
    });
  });

  describe('parseVersionOutput', () => {
    it('should parse standard version formats', () => {
      expect(parseVersionOutput('v18.17.0')).toBe('18.17.0');
      expect(parseVersionOutput('18.17.0')).toBe('18.17.0');
      expect(parseVersionOutput('1.2.3-beta.1')).toBe('1.2.3-beta.1');
    });

    it('should parse version from tool output', () => {
      expect(parseVersionOutput('npm version 8.19.2')).toBe('8.19.2');
      expect(parseVersionOutput('git version 2.34.1')).toBe('2.34.1');
      expect(parseVersionOutput('Node.js v16.14.0')).toBe('16.14.0');
      expect(parseVersionOutput('Python 3.9.7')).toBe('3.9.7');
    });

    it('should handle complex output formats', () => {
      expect(parseVersionOutput('npm 8.19.2 from /usr/local/bin/npm')).toBe('8.19.2');
      expect(parseVersionOutput('Version: 1.2.3')).toBe('1.2.3');
      expect(parseVersionOutput('version v2.1.0-rc.1')).toBe('2.1.0-rc.1');
    });

    it('should return null for invalid or missing versions', () => {
      expect(parseVersionOutput('')).toBe(null);
      expect(parseVersionOutput('invalid output')).toBe(null);
      expect(parseVersionOutput('no version here')).toBe(null);
      expect(parseVersionOutput(null as any)).toBe(null);
    });

    it('should validate parsed versions using semver', () => {
      expect(parseVersionOutput('v1.2.invalid')).toBe(null);
      expect(parseVersionOutput('version abc.def.ghi')).toBe(null);
    });
  });
});

describe('NPM Registry Query Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('queryNpmRegistry', () => {
    it('should successfully query package information', async () => {
      const mockResponse = {
        name: 'test-package',
        version: '1.0.0',
        'dist-tags': { latest: '1.2.0' },
        versions: { '1.0.0': {}, '1.1.0': {}, '1.2.0': {} },
        homepage: 'https://example.com',
        repository: { url: 'https://github.com/test/repo' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await queryNpmRegistry('test-package');

      expect(result).toEqual({
        name: 'test-package',
        version: '1.0.0',
        latestVersion: '1.2.0',
        versions: ['1.0.0', '1.1.0', '1.2.0'],
        homepage: 'https://example.com',
        repository: 'https://github.com/test/repo'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test-package',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': 'APEX-doctor/0.6.0'
          })
        })
      );
    });

    it('should handle scoped packages', async () => {
      const mockResponse = {
        name: '@scope/package',
        'dist-tags': { latest: '2.0.0' },
        versions: { '2.0.0': {} }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await queryNpmRegistry('@scope/package');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/@scope%2Fpackage',
        expect.any(Object)
      );
    });

    it('should handle 404 not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await queryNpmRegistry('non-existent-package');

      expect(result).toEqual({
        name: 'non-existent-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'Package not found'
      });
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await queryNpmRegistry('test-package');

      expect(result).toEqual({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'HTTP 500: Internal Server Error'
      });
    });

    it('should handle request timeout', async () => {
      vi.useFakeTimers();

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const queryPromise = queryNpmRegistry('test-package', { timeout: 1000 });

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(1000);

      const result = await queryPromise;

      expect(result).toEqual({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'Request timeout'
      });

      vi.useRealTimers();
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(networkError);

      const result = await queryNpmRegistry('test-package');

      expect(result).toEqual({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'Network error'
      });
    });

    it('should return null for empty package name', async () => {
      const result = await queryNpmRegistry('');
      expect(result).toBe(null);
    });

    it('should use custom registry and timeout', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ name: 'test', 'dist-tags': { latest: '1.0.0' }, versions: {} })
      });

      await queryNpmRegistry('test-package', {
        registry: 'https://npm.company.com',
        timeout: 10000
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://npm.company.com/test-package',
        expect.any(Object)
      );
    });

    it('should handle deprecated packages', async () => {
      const mockResponse = {
        name: 'deprecated-package',
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': {} },
        deprecated: 'This package is deprecated'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await queryNpmRegistry('deprecated-package');

      expect(result?.deprecated).toBe('This package is deprecated');
    });
  });

  describe('isPackageVersionAvailable', () => {
    it('should return true for available versions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          name: 'test-package',
          'dist-tags': { latest: '1.2.0' },
          versions: { '1.0.0': {}, '1.1.0': {}, '1.2.0': {} }
        })
      });

      const result = await isPackageVersionAvailable('test-package', '1.1.0');
      expect(result).toBe(true);
    });

    it('should return false for unavailable versions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          name: 'test-package',
          'dist-tags': { latest: '1.2.0' },
          versions: { '1.0.0': {}, '1.2.0': {} }
        })
      });

      const result = await isPackageVersionAvailable('test-package', '1.1.0');
      expect(result).toBe(false);
    });

    it('should return false on query error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await isPackageVersionAvailable('test-package', '1.0.0');
      expect(result).toBe(false);
    });
  });

  describe('getLatestPackageVersion', () => {
    it('should return latest version', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          name: 'test-package',
          'dist-tags': { latest: '2.5.0' },
          versions: {}
        })
      });

      const result = await getLatestPackageVersion('test-package');
      expect(result).toBe('2.5.0');
    });

    it('should return null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getLatestPackageVersion('test-package');
      expect(result).toBe(null);
    });
  });
});

describe('Health Check Factory Functions', () => {
  describe('createDoctorCheckResult', () => {
    it('should create check result with required fields', () => {
      const result = createDoctorCheckResult({
        id: 'test-check',
        name: 'Test Check',
        category: 'toolchain'
      });

      expect(result).toEqual({
        id: 'test-check',
        name: 'Test Check',
        category: 'toolchain',
        description: 'Health check for Test Check',
        status: 'unknown',
        severity: 'info',
        message: 'Check completed',
        timestamp: expect.any(Date),
        durationMs: 0
      });
    });

    it('should allow overriding default values', () => {
      const customTimestamp = new Date('2024-01-01T00:00:00Z');
      const result = createDoctorCheckResult({
        id: 'custom-check',
        name: 'Custom Check',
        category: 'environment',
        status: 'pass',
        severity: 'warning',
        message: 'Custom message',
        description: 'Custom description',
        timestamp: customTimestamp,
        durationMs: 100,
        suggestion: 'Custom suggestion'
      });

      expect(result).toEqual({
        id: 'custom-check',
        name: 'Custom Check',
        category: 'environment',
        status: 'pass',
        severity: 'warning',
        message: 'Custom message',
        description: 'Custom description',
        timestamp: customTimestamp,
        durationMs: 100,
        suggestion: 'Custom suggestion'
      });
    });

    it('should include toolchain information when provided', () => {
      const toolchain = {
        name: 'node',
        currentVersion: '18.17.0',
        requiredVersion: '16.0.0',
        location: '/usr/local/bin/node'
      };

      const result = createDoctorCheckResult({
        id: 'node-check',
        name: 'Node.js Check',
        category: 'toolchain',
        toolchain
      });

      expect(result.toolchain).toEqual(toolchain);
    });
  });

  describe('createHealthReport', () => {
    const mockChecks: DoctorCheckResult[] = [
      {
        id: 'check-1',
        name: 'Check 1',
        category: 'toolchain',
        description: 'First check',
        status: 'pass',
        severity: 'info',
        message: 'Passed',
        timestamp: new Date(),
        durationMs: 50
      },
      {
        id: 'check-2',
        name: 'Check 2',
        category: 'environment',
        description: 'Second check',
        status: 'fail',
        severity: 'error',
        message: 'Failed',
        timestamp: new Date(),
        durationMs: 75
      },
      {
        id: 'check-3',
        name: 'Check 3',
        category: 'dependencies',
        description: 'Third check',
        status: 'pass',
        severity: 'warning',
        message: 'Passed with warning',
        timestamp: new Date(),
        durationMs: 25
      },
      {
        id: 'check-4',
        name: 'Check 4',
        category: 'security',
        description: 'Fourth check',
        status: 'skip',
        severity: 'info',
        message: 'Skipped',
        timestamp: new Date(),
        durationMs: 0
      }
    ];

    it('should create health report with correct summary', () => {
      const report = createHealthReport(mockChecks);

      expect(report.summary).toEqual({
        total: 4,
        passed: 2,
        failed: 1,
        warnings: 0, // warnings count checks with warning severity that didn't pass
        skipped: 1
      });
    });

    it('should calculate correct overall status', () => {
      // Test with failures - should be 'fail'
      let report = createHealthReport(mockChecks);
      expect(report.overallStatus).toBe('fail');

      // Test with only passes - should be 'pass'
      const passingChecks = mockChecks.filter(c => c.status === 'pass');
      report = createHealthReport(passingChecks);
      expect(report.overallStatus).toBe('pass');

      // Test with empty checks - should be 'unknown'
      report = createHealthReport([]);
      expect(report.overallStatus).toBe('unknown');

      // Test with only skipped checks - should be 'unknown'
      const skippedChecks = mockChecks.filter(c => c.status === 'skip');
      report = createHealthReport(skippedChecks);
      expect(report.overallStatus).toBe('unknown');
    });

    it('should calculate total duration', () => {
      const report = createHealthReport(mockChecks);
      expect(report.durationMs).toBe(150); // 50 + 75 + 25 + 0
    });

    it('should include system information', () => {
      const report = createHealthReport(mockChecks);

      expect(report.system).toEqual({
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cwd: process.cwd()
      });
    });

    it('should generate proper report ID and timestamp', () => {
      const beforeTime = Date.now();
      const report = createHealthReport(mockChecks);
      const afterTime = Date.now();

      expect(report.id).toMatch(/^health-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
      expect(report.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(report.timestamp.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it('should use provided APEX version', () => {
      const report = createHealthReport(mockChecks, { apexVersion: '1.2.3' });
      expect(report.apexVersion).toBe('1.2.3');
    });

    it('should use default APEX version when not provided', () => {
      const report = createHealthReport(mockChecks);
      expect(report.apexVersion).toBe('0.6.0');
    });

    it('should include all provided checks', () => {
      const report = createHealthReport(mockChecks);
      expect(report.checks).toEqual(mockChecks);
    });

    it('should count warnings correctly', () => {
      const checksWithWarnings: DoctorCheckResult[] = [
        {
          id: 'warn-pass',
          name: 'Warning Pass',
          category: 'test',
          description: 'Warning that passed',
          status: 'pass',
          severity: 'warning',
          message: 'Passed with warning',
          timestamp: new Date(),
          durationMs: 0
        },
        {
          id: 'warn-fail',
          name: 'Warning Fail',
          category: 'test',
          description: 'Warning that failed',
          status: 'fail',
          severity: 'warning',
          message: 'Failed with warning',
          timestamp: new Date(),
          durationMs: 0
        }
      ];

      const report = createHealthReport(checksWithWarnings);

      // Only the failed warning should count in warnings (passed warnings don't count)
      expect(report.summary.warnings).toBe(1);
      expect(report.summary.passed).toBe(1);
      expect(report.summary.failed).toBe(1);
    });
  });
});