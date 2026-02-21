import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
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
  type DoctorCheckResult,
} from '../doctor-utils.js';

// Mock fetch for npm registry tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('Doctor Utils Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Version Utilities', () => {
    describe('satisfiesVersion', () => {
      it('should handle basic version comparisons', () => {
        expect(satisfiesVersion('18.17.0', '16.0.0')).toBe(true);
        expect(satisfiesVersion('14.15.0', '16.0.0')).toBe(false);
        expect(satisfiesVersion('16.0.0', '16.0.0')).toBe(true);
        expect(satisfiesVersion('16.0.1', '16.0.0')).toBe(true);
        expect(satisfiesVersion('15.9.9', '16.0.0')).toBe(false);
      });

      it('should handle version prefixes', () => {
        expect(satisfiesVersion('v18.17.0', '16.0.0')).toBe(true);
        expect(satisfiesVersion('18.17.0', 'v16.0.0')).toBe(true);
        expect(satisfiesVersion('v14.15.0', 'v16.0.0')).toBe(false);
      });

      it('should handle pre-release versions', () => {
        expect(satisfiesVersion('16.0.0-beta.1', '16.0.0')).toBe(false);
        expect(satisfiesVersion('16.0.1-beta.1', '16.0.0')).toBe(true);
        expect(satisfiesVersion('16.0.0', '16.0.0-beta.1')).toBe(true);
      });

      it('should handle invalid versions', () => {
        expect(satisfiesVersion('', '16.0.0')).toBe(false);
        expect(satisfiesVersion('18.17.0', '')).toBe(false);
        expect(satisfiesVersion('invalid', '16.0.0')).toBe(false);
        expect(satisfiesVersion('18.17.0', 'invalid')).toBe(false);
      });

      it('should handle edge cases', () => {
        expect(satisfiesVersion('1', '1.0.0')).toBe(true);
        expect(satisfiesVersion('1.0', '1.0.0')).toBe(true);
        expect(satisfiesVersion('1.0.0', '1')).toBe(true);
        expect(satisfiesVersion('1.0.0', '1.0')).toBe(true);
      });
    });

    describe('compareVersionStrings', () => {
      it('should compare versions correctly', () => {
        expect(compareVersionStrings('1.0.0', '1.0.1')).toBe(-1);
        expect(compareVersionStrings('2.0.0', '1.9.9')).toBe(1);
        expect(compareVersionStrings('1.0.0', '1.0.0')).toBe(0);
        expect(compareVersionStrings('1.0.1', '1.0.0')).toBe(1);
        expect(compareVersionStrings('1.0.0', '1.0.1')).toBe(-1);
      });

      it('should handle version prefixes in comparison', () => {
        expect(compareVersionStrings('v1.2.3', '1.2.3')).toBe(0);
        expect(compareVersionStrings('v1.2.4', '1.2.3')).toBe(1);
        expect(compareVersionStrings('v1.2.2', '1.2.3')).toBe(-1);
      });

      it('should handle different version lengths', () => {
        expect(compareVersionStrings('1.0', '1.0.0')).toBe(0);
        expect(compareVersionStrings('1.0.1', '1.0')).toBe(1);
        expect(compareVersionStrings('1.0', '1.0.1')).toBe(-1);
      });
    });

    describe('parseVersionOutput', () => {
      it('should parse various version formats', () => {
        expect(parseVersionOutput('v18.17.0')).toBe('18.17.0');
        expect(parseVersionOutput('18.17.0')).toBe('18.17.0');
        expect(parseVersionOutput('npm version 8.19.2')).toBe('8.19.2');
        expect(parseVersionOutput('git version 2.34.1')).toBe('2.34.1');
        expect(parseVersionOutput('Node.js v16.14.0')).toBe('16.14.0');
        expect(parseVersionOutput('Python 3.9.2')).toBe('3.9.2');
      });

      it('should handle pre-release versions', () => {
        expect(parseVersionOutput('v1.2.3-beta.1')).toBe('1.2.3-beta.1');
        expect(parseVersionOutput('2.0.0-rc.1')).toBe('2.0.0-rc.1');
        expect(parseVersionOutput('1.0.0-alpha.1+build.1')).toBe('1.0.0-alpha.1+build.1');
      });

      it('should return null for invalid formats', () => {
        expect(parseVersionOutput('')).toBeNull();
        expect(parseVersionOutput('invalid output')).toBeNull();
        expect(parseVersionOutput('no numbers here')).toBeNull();
        expect(parseVersionOutput('1.2')).toBeNull(); // Too short
      });

      it('should handle edge cases', () => {
        expect(parseVersionOutput(null as any)).toBeNull();
        expect(parseVersionOutput(undefined as any)).toBeNull();
        expect(parseVersionOutput(123 as any)).toBeNull();
      });
    });
  });

  describe('NPM Registry Utilities', () => {
    describe('queryNpmRegistry', () => {
      it('should successfully query package information', async () => {
        const mockResponse = {
          name: '@apexcli/core',
          version: '0.6.0',
          'dist-tags': { latest: '0.6.0' },
          versions: { '0.5.0': {}, '0.6.0': {} },
          homepage: 'https://github.com/apex-cli/apex',
          repository: { url: 'git+https://github.com/apex-cli/apex.git' },
        };

        mockedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockResponse),
        } as any);

        const result = await queryNpmRegistry('@apexcli/core');

        expect(result).toEqual({
          name: '@apexcli/core',
          version: '0.6.0',
          latestVersion: '0.6.0',
          versions: ['0.5.0', '0.6.0'],
          homepage: 'https://github.com/apex-cli/apex',
          repository: 'git+https://github.com/apex-cli/apex.git',
        });

        expect(mockedFetch).toHaveBeenCalledWith(
          'https://registry.npmjs.org/@apexcli%2Fcore',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Accept': 'application/json',
              'User-Agent': 'APEX-doctor/0.6.0',
            }),
            signal: expect.any(AbortSignal),
          })
        );
      });

      it('should handle scoped package names correctly', async () => {
        const mockResponse = {
          name: '@company/private-pkg',
          'dist-tags': { latest: '1.0.0' },
          versions: { '1.0.0': {} },
        };

        mockedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockResponse),
        } as any);

        await queryNpmRegistry('@company/private-pkg');

        expect(mockedFetch).toHaveBeenCalledWith(
          'https://registry.npmjs.org/@company%2Fprivate-pkg',
          expect.any(Object)
        );
      });

      it('should handle 404 package not found', async () => {
        mockedFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as any);

        const result = await queryNpmRegistry('non-existent-package');

        expect(result).toEqual({
          name: 'non-existent-package',
          version: '',
          latestVersion: '',
          versions: [],
          error: 'Package not found',
        });
      });

      it('should handle HTTP errors', async () => {
        mockedFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as any);

        const result = await queryNpmRegistry('some-package');

        expect(result?.error).toBe('HTTP 500: Internal Server Error');
      });

      it('should handle network timeouts', async () => {
        mockedFetch.mockImplementationOnce(
          () => new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AbortError')), 100);
          })
        );

        const result = await queryNpmRegistry('timeout-package', { timeout: 50 });

        expect(result?.error).toBe('Request timeout');
      });

      it('should use custom registry', async () => {
        const mockResponse = {
          name: 'private-package',
          'dist-tags': { latest: '1.0.0' },
          versions: { '1.0.0': {} },
        };

        mockedFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockResponse),
        } as any);

        await queryNpmRegistry('private-package', {
          registry: 'https://npm.company.com',
        });

        expect(mockedFetch).toHaveBeenCalledWith(
          'https://npm.company.com/private-package',
          expect.any(Object)
        );
      });

      it('should handle empty package name', async () => {
        const result = await queryNpmRegistry('');
        expect(result).toBeNull();
      });

      it('should handle fetch unavailability', async () => {
        const originalFetch = global.fetch;
        delete (global as any).fetch;

        // Re-import to trigger the fetch detection
        jest.resetModules();
        const { queryNpmRegistry: queryWithoutFetch } = await import('../doctor-utils.js');

        const result = await queryWithoutFetch('test-package');

        expect(result?.error).toBe('Fetch API not available');

        // Restore fetch
        global.fetch = originalFetch;
      });
    });

    describe('isPackageVersionAvailable', () => {
      it('should return true for available version', async () => {
        const mockResponse = {
          versions: { '1.0.0': {}, '2.0.0': {} },
        };

        mockedFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse),
        } as any);

        const result = await isPackageVersionAvailable('test-package', '1.0.0');
        expect(result).toBe(true);
      });

      it('should return false for unavailable version', async () => {
        const mockResponse = {
          versions: { '1.0.0': {}, '2.0.0': {} },
        };

        mockedFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse),
        } as any);

        const result = await isPackageVersionAvailable('test-package', '3.0.0');
        expect(result).toBe(false);
      });

      it('should return false on query error', async () => {
        mockedFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await isPackageVersionAvailable('test-package', '1.0.0');
        expect(result).toBe(false);
      });
    });

    describe('getLatestPackageVersion', () => {
      it('should return latest version', async () => {
        const mockResponse = {
          'dist-tags': { latest: '2.1.0' },
        };

        mockedFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse),
        } as any);

        const result = await getLatestPackageVersion('test-package');
        expect(result).toBe('2.1.0');
      });

      it('should return null on error', async () => {
        mockedFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await getLatestPackageVersion('test-package');
        expect(result).toBeNull();
      });

      it('should return null when no latest version exists', async () => {
        const mockResponse = {};

        mockedFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse),
        } as any);

        const result = await getLatestPackageVersion('test-package');
        expect(result).toBeNull();
      });
    });
  });

  describe('Health Check Factory Functions', () => {
    describe('createDoctorCheckResult', () => {
      it('should create check result with defaults', () => {
        const result = createDoctorCheckResult({
          id: 'test-check',
          name: 'Test Check',
          category: 'toolchain',
        });

        expect(result).toMatchObject({
          id: 'test-check',
          name: 'Test Check',
          category: 'toolchain',
          description: 'Health check for Test Check',
          status: 'unknown',
          severity: 'info',
          message: 'Check completed',
          durationMs: 0,
        });

        expect(result.timestamp).toBeInstanceOf(Date);
      });

      it('should override defaults with provided values', () => {
        const result = createDoctorCheckResult({
          id: 'custom-check',
          name: 'Custom Check',
          category: 'config',
          status: 'pass',
          severity: 'warning',
          message: 'Custom message',
          durationMs: 150,
        });

        expect(result).toMatchObject({
          id: 'custom-check',
          name: 'Custom Check',
          category: 'config',
          status: 'pass',
          severity: 'warning',
          message: 'Custom message',
          durationMs: 150,
        });
      });

      it('should include optional fields', () => {
        const result = createDoctorCheckResult({
          id: 'toolchain-check',
          name: 'Toolchain Check',
          category: 'toolchain',
          suggestion: 'Upgrade your tools',
          toolchain: {
            name: 'node',
            currentVersion: '16.0.0',
            requiredVersion: '18.0.0',
            location: '/usr/local/bin/node',
            required: true,
          },
        });

        expect(result.suggestion).toBe('Upgrade your tools');
        expect(result.toolchain).toBeDefined();
        expect(result.toolchain?.name).toBe('node');
      });
    });

    describe('createHealthReport', () => {
      const createMockChecks = (): DoctorCheckResult[] => [
        createDoctorCheckResult({
          id: 'check-1',
          name: 'Check 1',
          category: 'toolchain',
          status: 'pass',
          severity: 'info',
          durationMs: 50,
        }),
        createDoctorCheckResult({
          id: 'check-2',
          name: 'Check 2',
          category: 'config',
          status: 'fail',
          severity: 'error',
          durationMs: 75,
        }),
        createDoctorCheckResult({
          id: 'check-3',
          name: 'Check 3',
          category: 'permissions',
          status: 'skip',
          severity: 'warning',
          durationMs: 25,
        }),
      ];

      it('should create health report with correct summary', () => {
        const checks = createMockChecks();
        const report = createHealthReport(checks);

        expect(report.summary).toEqual({
          total: 3,
          passed: 1,
          failed: 1,
          warnings: 1, // The skipped check with warning severity
          skipped: 1,
        });

        expect(report.overallStatus).toBe('fail'); // Due to failed check
        expect(report.durationMs).toBe(150); // 50 + 75 + 25
        expect(report.apexVersion).toBe('0.6.0');
      });

      it('should set overall status to pass when no failures', () => {
        const checks = [
          createDoctorCheckResult({
            id: 'check-1',
            name: 'Check 1',
            category: 'toolchain',
            status: 'pass',
          }),
          createDoctorCheckResult({
            id: 'check-2',
            name: 'Check 2',
            category: 'config',
            status: 'skip',
          }),
        ];

        const report = createHealthReport(checks);
        expect(report.overallStatus).toBe('pass');
      });

      it('should set overall status to unknown when all checks skipped', () => {
        const checks = [
          createDoctorCheckResult({
            id: 'check-1',
            name: 'Check 1',
            category: 'toolchain',
            status: 'skip',
          }),
        ];

        const report = createHealthReport(checks);
        expect(report.overallStatus).toBe('unknown');
      });

      it('should set overall status to unknown when no checks', () => {
        const report = createHealthReport([]);
        expect(report.overallStatus).toBe('unknown');
        expect(report.summary.total).toBe(0);
      });

      it('should include system information', () => {
        const checks = createMockChecks();
        const report = createHealthReport(checks);

        expect(report.system).toEqual({
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          cwd: process.cwd(),
        });
      });

      it('should use custom apex version', () => {
        const checks = createMockChecks();
        const report = createHealthReport(checks, { apexVersion: '0.7.0' });

        expect(report.apexVersion).toBe('0.7.0');
      });

      it('should generate unique report ID with timestamp', () => {
        const checks = createMockChecks();
        const report1 = createHealthReport(checks);
        const report2 = createHealthReport(checks);

        expect(report1.id).toBeDefined();
        expect(report2.id).toBeDefined();
        expect(report1.id).not.toBe(report2.id);
        expect(report1.id).toMatch(/^health-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
      });

      it('should include timestamp', () => {
        const checks = createMockChecks();
        const beforeReport = new Date();
        const report = createHealthReport(checks);
        const afterReport = new Date();

        expect(report.timestamp).toBeInstanceOf(Date);
        expect(report.timestamp.getTime()).toBeGreaterThanOrEqual(beforeReport.getTime());
        expect(report.timestamp.getTime()).toBeLessThanOrEqual(afterReport.getTime());
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed npm registry responses', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      } as any);

      const result = await queryNpmRegistry('test-package');

      expect(result).toMatchObject({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: [],
      });
    });

    it('should handle JSON parse errors', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any);

      const result = await queryNpmRegistry('test-package');

      expect(result?.error).toBe('Invalid JSON');
    });

    it('should handle repository as string', async () => {
      const mockResponse = {
        name: 'test-package',
        repository: 'git://github.com/user/repo.git',
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': {} },
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await queryNpmRegistry('test-package');

      expect(result?.repository).toBe('git://github.com/user/repo.git');
    });

    it('should handle deprecated packages', async () => {
      const mockResponse = {
        name: 'deprecated-package',
        deprecated: 'This package is no longer maintained',
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': {} },
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await queryNpmRegistry('deprecated-package');

      expect(result?.deprecated).toBe('This package is no longer maintained');
    });
  });
});