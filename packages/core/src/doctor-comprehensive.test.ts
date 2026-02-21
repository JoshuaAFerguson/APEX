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
import {
  ToolchainCheckSchema,
  DoctorCheckResultSchema,
  HealthReportSchema,
  type DoctorCheckResult,
  type HealthReport,
  type ToolchainCheck,
} from './types';

describe('Doctor Utils Comprehensive Integration Tests', () => {
  describe('Complete Health Check Workflow Scenarios', () => {
    it('should simulate a complete development environment check', async () => {
      // Simulate version checking for a typical development setup
      const toolOutputs = [
        'Node.js v18.17.0',
        'npm 8.19.2',
        'git version 2.34.1',
        'Python 3.9.7',
        'Docker version 20.10.17',
        'yarn 1.22.19'
      ];

      const requirements = [
        '16.0.0',  // Node.js
        '7.0.0',   // npm
        '2.0.0',   // Git
        '3.8.0',   // Python
        '20.0.0',  // Docker
        '1.20.0'   // Yarn
      ];

      const toolNames = ['node', 'npm', 'git', 'python', 'docker', 'yarn'];

      // Parse all versions
      const versions = toolOutputs.map(output => parseVersionOutput(output));
      const allVersionsParsed = versions.every(v => v !== null);
      expect(allVersionsParsed).toBe(true);

      // Check all requirements
      const satisfiesAll = versions.map((version, index) =>
        version ? satisfiesVersion(version, requirements[index]) : false
      );

      // Create check results
      const checks: DoctorCheckResult[] = versions.map((version, index) => {
        const isRequired = index < 3; // Node, npm, Git are required
        const status = satisfiesAll[index] ? 'pass' : (isRequired ? 'fail' : 'skip');

        return createDoctorCheckResult({
          id: `${toolNames[index]}-version`,
          name: `${toolNames[index]} Version Check`,
          category: 'toolchain',
          description: `Verify ${toolNames[index]} meets minimum version requirements`,
          status: status as any,
          severity: isRequired ? 'error' : 'warning',
          message: version
            ? `${toolNames[index]} ${version} ${satisfiesAll[index] ? 'meets' : 'does not meet'} requirement >= ${requirements[index]}`
            : `${toolNames[index]} not found`,
          suggestion: satisfiesAll[index] ? undefined : `Please update ${toolNames[index]} to version ${requirements[index]} or newer`,
          toolchain: {
            name: toolNames[index],
            currentVersion: version,
            requiredVersion: requirements[index],
            required: isRequired,
            path: `/usr/local/bin/${toolNames[index]}`,
            metadata: {
              category: index < 3 ? 'essential' : 'optional',
              installMethod: 'package-manager'
            }
          },
          timestamp: new Date(Date.now() - (1000 - index * 100)), // Stagger timestamps
          durationMs: 50 + Math.random() * 200 // Realistic check duration
        });
      });

      // Generate comprehensive health report
      const report = createHealthReport(checks, { apexVersion: '0.6.0' });

      // Verify report structure
      expect(report.checks).toHaveLength(6);
      expect(report.summary.total).toBe(6);
      expect(report.summary.passed).toBe(6); // All should pass with our test data
      expect(report.overallStatus).toBe('pass');
      expect(report.apexVersion).toBe('0.6.0');

      // Verify system information is included
      expect(report.system.platform).toBeDefined();
      expect(report.system.arch).toBeDefined();
      expect(report.system.nodeVersion).toBeDefined();
      expect(report.system.cwd).toBeDefined();

      // Verify report ID format
      expect(report.id).toMatch(/^health-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
    });

    it('should handle a mixed success/failure development environment', () => {
      const checks: DoctorCheckResult[] = [
        // Passing checks
        createDoctorCheckResult({
          id: 'node-check',
          name: 'Node.js Version',
          category: 'toolchain',
          status: 'pass',
          severity: 'error',
          message: 'Node.js 18.17.0 meets requirement >= 16.0.0',
          toolchain: {
            name: 'node',
            currentVersion: '18.17.0',
            requiredVersion: '16.0.0',
            required: true
          },
          durationMs: 120
        }),
        // Failing checks
        createDoctorCheckResult({
          id: 'npm-check',
          name: 'npm Version',
          category: 'toolchain',
          status: 'fail',
          severity: 'error',
          message: 'npm 6.14.0 does not meet requirement >= 7.0.0',
          suggestion: 'Update npm with: npm install -g npm@latest',
          toolchain: {
            name: 'npm',
            currentVersion: '6.14.0',
            requiredVersion: '7.0.0',
            required: true
          },
          durationMs: 95
        }),
        // Warning checks (passed but with warnings)
        createDoctorCheckResult({
          id: 'git-check',
          name: 'Git Version',
          category: 'toolchain',
          status: 'pass',
          severity: 'warning',
          message: 'Git 2.25.0 meets requirement >= 2.0.0 but newer version available',
          suggestion: 'Consider updating Git for latest features and security fixes',
          toolchain: {
            name: 'git',
            currentVersion: '2.25.0',
            requiredVersion: '2.0.0',
            required: true
          },
          durationMs: 80
        }),
        // Skipped checks
        createDoctorCheckResult({
          id: 'docker-check',
          name: 'Docker Version',
          category: 'toolchain',
          status: 'skip',
          severity: 'info',
          message: 'Docker not found (optional)',
          toolchain: {
            name: 'docker',
            currentVersion: null,
            requiredVersion: '20.0.0',
            required: false
          },
          durationMs: 10
        })
      ];

      const report = createHealthReport(checks);

      expect(report.summary.total).toBe(4);
      expect(report.summary.passed).toBe(2); // node, git
      expect(report.summary.failed).toBe(1); // npm
      expect(report.summary.skipped).toBe(1); // docker
      expect(report.summary.warnings).toBe(0); // warnings only count for non-passing checks
      expect(report.overallStatus).toBe('fail'); // Due to npm failure
      expect(report.durationMs).toBe(305); // Sum of all durations
    });
  });

  describe('Package Registry Integration Scenarios', () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle checking multiple APEX-related packages', async () => {
      const apexPackages = [
        '@apexcli/core',
        '@apexcli/cli',
        '@apexcli/orchestrator',
        '@apexcli/api',
        '@apexcli/browser'
      ];

      // Mock responses for each package
      apexPackages.forEach((pkg, index) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: pkg,
            version: `0.${5 + index}.0`,
            'dist-tags': { latest: `0.${6 + index}.0` },
            versions: {
              [`0.${4 + index}.0`]: {},
              [`0.${5 + index}.0`]: {},
              [`0.${6 + index}.0`]: {}
            },
            homepage: `https://github.com/apexcli/apex/tree/main/packages/${pkg.split('/')[1]}`,
            repository: {
              type: 'git',
              url: 'git+https://github.com/apexcli/apex.git'
            }
          })
        });
      });

      // Check all packages concurrently
      const results = await Promise.all(
        apexPackages.map(pkg => queryNpmRegistry(pkg))
      );

      // Verify all packages were found
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result?.name).toBe(apexPackages[index]);
        expect(result?.error).toBeUndefined();
        expect(result?.versions).toHaveLength(3);
      });

      // Check specific version availability
      const versionChecks = await Promise.all([
        isPackageVersionAvailable('@apexcli/core', '0.5.0'),
        isPackageVersionAvailable('@apexcli/core', '0.4.0'),
        isPackageVersionAvailable('@apexcli/core', '1.0.0') // Doesn't exist
      ]);

      expect(versionChecks[0]).toBe(true); // 0.5.0 exists
      expect(versionChecks[1]).toBe(true); // 0.4.0 exists
      expect(versionChecks[2]).toBe(false); // 1.0.0 doesn't exist

      // Get latest versions
      const latestVersions = await Promise.all(
        apexPackages.map(pkg => getLatestPackageVersion(pkg))
      );

      latestVersions.forEach((version, index) => {
        expect(version).toBe(`0.${6 + index}.0`);
      });
    });

    it('should handle registry errors gracefully in package checks', async () => {
      const packages = ['existing-package', 'non-existent-package', 'error-package'];

      // Mock different response types
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: 'existing-package',
            'dist-tags': { latest: '2.1.0' },
            versions: { '2.1.0': {} }
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const results = await Promise.all(
        packages.map(pkg => queryNpmRegistry(pkg))
      );

      // First package should succeed
      expect(results[0]?.name).toBe('existing-package');
      expect(results[0]?.latestVersion).toBe('2.1.0');
      expect(results[0]?.error).toBeUndefined();

      // Second package should return 404 error
      expect(results[1]?.name).toBe('non-existent-package');
      expect(results[1]?.error).toBe('Package not found');

      // Third package should return network error
      expect(results[2]?.name).toBe('error-package');
      expect(results[2]?.error).toBe('Network error');
    });
  });

  describe('Type Schema Validation Integration', () => {
    it('should validate complete toolchain check objects', () => {
      const validToolchain: ToolchainCheck = {
        name: 'nodejs',
        currentVersion: '18.17.0',
        requiredVersion: '16.0.0',
        required: true,
        path: '/usr/local/bin/node',
        metadata: {
          lts: true,
          installMethod: 'nvm',
          supportedUntil: '2025-04-30',
          architecture: 'x64'
        }
      };

      const result = ToolchainCheckSchema.safeParse(validToolchain);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validToolchain);
      }

      // Test with missing optional fields
      const minimalToolchain = {
        name: 'npm',
        currentVersion: '8.19.2',
        requiredVersion: '7.0.0',
        required: true
      };

      const minimalResult = ToolchainCheckSchema.safeParse(minimalToolchain);
      expect(minimalResult.success).toBe(true);
    });

    it('should validate complete doctor check result objects', () => {
      const validCheck: DoctorCheckResult = {
        id: 'comprehensive-node-check',
        name: 'Comprehensive Node.js Check',
        category: 'toolchain',
        description: 'Thorough Node.js installation and version check',
        status: 'pass',
        severity: 'error',
        message: 'Node.js 18.17.0 is installed and meets all requirements',
        suggestion: 'Consider updating to the latest LTS version for security updates',
        toolchain: {
          name: 'node',
          currentVersion: '18.17.0',
          requiredVersion: '16.0.0',
          required: true,
          path: '/usr/local/bin/node',
          metadata: {
            lts: true,
            v8Version: '10.2.154.26',
            architecture: 'x64'
          }
        },
        timestamp: new Date(),
        durationMs: 156,
        details: {
          executablePath: '/usr/local/bin/node',
          configPath: '/usr/local/etc/npmrc',
          environmentVariables: {
            NODE_ENV: 'development',
            NODE_PATH: '/usr/local/lib/node_modules'
          }
        }
      };

      const result = DoctorCheckResultSchema.safeParse(validCheck);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validCheck);
      }
    });

    it('should validate complete health report objects', () => {
      const sampleChecks: DoctorCheckResult[] = [
        createDoctorCheckResult({
          id: 'node-check',
          name: 'Node.js Check',
          category: 'toolchain',
          status: 'pass',
          durationMs: 120
        }),
        createDoctorCheckResult({
          id: 'npm-check',
          name: 'npm Check',
          category: 'toolchain',
          status: 'fail',
          severity: 'error',
          durationMs: 95
        })
      ];

      const validReport: HealthReport = {
        id: 'health-2024-01-15T103045',
        timestamp: new Date(),
        overallStatus: 'fail',
        summary: {
          total: 2,
          passed: 1,
          failed: 1,
          warnings: 0,
          skipped: 0
        },
        checks: sampleChecks,
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          cwd: process.cwd()
        },
        durationMs: 215,
        apexVersion: '0.6.0'
      };

      const result = HealthReportSchema.safeParse(validReport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validReport);
      }
    });

    it('should reject invalid objects appropriately', () => {
      // Invalid toolchain check
      const invalidToolchain = {
        name: 123, // Should be string
        currentVersion: '1.0.0',
        requiredVersion: true, // Should be string
        required: 'yes' // Should be boolean
      };

      const toolchainResult = ToolchainCheckSchema.safeParse(invalidToolchain);
      expect(toolchainResult.success).toBe(false);

      // Invalid check result
      const invalidCheck = {
        id: 'test',
        name: 'test',
        // Missing required fields: category, description, status, severity, message, timestamp, durationMs
        status: 'invalid-status'
      };

      const checkResult = DoctorCheckResultSchema.safeParse(invalidCheck);
      expect(checkResult.success).toBe(false);

      // Invalid health report
      const invalidReport = {
        id: 'test',
        timestamp: 'not-a-date', // Should be Date object
        overallStatus: 'maybe', // Invalid status
        summary: {
          total: 'five' // Should be number
        }
        // Missing other required fields
      };

      const reportResult = HealthReportSchema.safeParse(invalidReport);
      expect(reportResult.success).toBe(false);
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should handle a typical CI/CD environment check', () => {
      // Simulate checking a CI/CD environment
      const ciToolVersions = [
        'Node.js v16.14.0',
        'npm 8.3.0',
        'git version 2.34.1',
        'docker version 20.10.12',
        'kubectl v1.23.0',
        'terraform version v1.1.5'
      ];

      const ciRequirements = ['16.0.0', '8.0.0', '2.30.0', '20.0.0', '1.20.0', '1.0.0'];
      const toolNames = ['node', 'npm', 'git', 'docker', 'kubectl', 'terraform'];

      const checks = ciToolVersions.map((versionOutput, index) => {
        const version = parseVersionOutput(versionOutput);
        const meets = version ? satisfiesVersion(version, ciRequirements[index]) : false;

        return createDoctorCheckResult({
          id: `ci-${toolNames[index]}-check`,
          name: `CI ${toolNames[index].toUpperCase()} Check`,
          category: index < 3 ? 'toolchain' : 'deployment',
          status: meets ? 'pass' : 'fail',
          severity: index < 4 ? 'error' : 'warning', // First 4 tools are critical
          message: version
            ? `${toolNames[index]} ${version} ${meets ? 'meets' : 'does not meet'} CI requirement >= ${ciRequirements[index]}`
            : `${toolNames[index]} not found in CI environment`,
          toolchain: {
            name: toolNames[index],
            currentVersion: version,
            requiredVersion: ciRequirements[index],
            required: index < 4, // First 4 are required
            metadata: {
              environment: 'ci',
              category: index < 3 ? 'runtime' : 'deployment'
            }
          },
          durationMs: 50 + Math.random() * 100
        });
      });

      const report = createHealthReport(checks, { apexVersion: '0.6.0' });

      expect(report.checks).toHaveLength(6);
      expect(report.summary.total).toBe(6);

      // In this scenario, all tools should pass (our test data is compatible)
      expect(report.summary.passed).toBe(6);
      expect(report.overallStatus).toBe('pass');
    });

    it('should handle version comparison edge cases in real scenarios', () => {
      // Real version comparison scenarios that might occur
      const versionPairs = [
        // LTS vs Current versions
        ['v16.20.2', '16.0.0'], // LTS Node.js
        ['v18.17.0', '16.0.0'], // Current Node.js

        // npm versions with different formats
        ['8.19.4', '7.0.0'],
        ['9.0.0-pre.0', '8.0.0'], // Pre-release

        // Git versions across platforms
        ['2.39.1.windows.1', '2.30.0'], // Windows Git
        ['2.39.1', '2.30.0'], // Unix Git

        // Docker versions
        ['20.10.21+dfsg1', '20.0.0'], // Ubuntu package version
        ['23.0.0-rc.1', '20.0.0'], // Release candidate

        // Python versions
        ['3.11.1', '3.8.0'],
        ['3.10.6+', '3.8.0'], // Custom build
      ];

      versionPairs.forEach(([current, required], index) => {
        const meets = satisfiesVersion(current, required);
        expect(meets).toBe(true); // All our test cases should pass requirements

        const comparison = compareVersionStrings(current, required);
        expect(comparison).toBeGreaterThanOrEqual(0); // Current should be >= required
      });
    });

    it('should handle package availability checks for common development tools', async () => {
      const commonPackages = [
        'typescript',
        '@types/node',
        'eslint',
        '@vue/cli',
        'create-react-app',
        '@angular/cli'
      ];

      // Mock successful responses for all packages
      mockFetch = vi.fn();
      global.fetch = mockFetch;

      commonPackages.forEach((pkg, index) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: pkg,
            'dist-tags': { latest: `${4 + index}.${index}.0` },
            versions: Object.fromEntries(
              Array.from({ length: 5 }, (_, i) => [`${4 + index - i}.0.0`, {}])
            )
          })
        });
      });

      const packageInfos = await Promise.all(
        commonPackages.map(pkg => queryNpmRegistry(pkg))
      );

      expect(packageInfos).toHaveLength(6);
      packageInfos.forEach((info, index) => {
        expect(info?.name).toBe(commonPackages[index]);
        expect(info?.error).toBeUndefined();
        expect(info?.latestVersion).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from partial failures gracefully', () => {
      // Simulate a scenario where some checks fail but others succeed
      const mixedResults: DoctorCheckResult[] = [
        // Successful checks
        createDoctorCheckResult({
          id: 'success-1',
          name: 'Successful Check 1',
          category: 'toolchain',
          status: 'pass',
          message: 'All good',
          durationMs: 100
        }),

        // Failed check with detailed error
        createDoctorCheckResult({
          id: 'failure-1',
          name: 'Failed Check 1',
          category: 'environment',
          status: 'fail',
          severity: 'error',
          message: 'Environment variable not set',
          suggestion: 'Set the REQUIRED_ENV_VAR environment variable',
          details: {
            expectedVariable: 'REQUIRED_ENV_VAR',
            currentValue: null,
            suggestedValue: 'production'
          },
          durationMs: 50
        }),

        // Warning that passed but with issues
        createDoctorCheckResult({
          id: 'warning-1',
          name: 'Warning Check 1',
          category: 'security',
          status: 'pass',
          severity: 'warning',
          message: 'Using deprecated configuration',
          suggestion: 'Update configuration to use new format',
          durationMs: 75
        }),

        // Skipped optional check
        createDoctorCheckResult({
          id: 'skip-1',
          name: 'Optional Check 1',
          category: 'performance',
          status: 'skip',
          severity: 'info',
          message: 'Optional tool not installed',
          durationMs: 10
        })
      ];

      const report = createHealthReport(mixedResults);

      // System should handle mixed results appropriately
      expect(report.overallStatus).toBe('fail'); // Due to the failed check
      expect(report.summary.passed).toBe(2); // success-1, warning-1
      expect(report.summary.failed).toBe(1); // failure-1
      expect(report.summary.warnings).toBe(0); // No failed warnings
      expect(report.summary.skipped).toBe(1); // skip-1

      // Report should still be valid and complete
      expect(report.id).toMatch(/^health-/);
      expect(report.apexVersion).toBe('0.6.0');
      expect(report.durationMs).toBe(235); // Sum of all durations
    });
  });
});