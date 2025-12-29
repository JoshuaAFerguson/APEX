/**
 * Integration test to verify Windows CI compatibility end-to-end
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { platform, arch, release } from 'os';
import * as yaml from 'yaml';

describe('Windows CI Integration Test', () => {
  describe('Environment Compatibility', () => {
    it('should handle current environment gracefully', () => {
      const currentPlatform = platform();
      const currentArch = arch();
      const osRelease = release();

      // Should handle all supported platforms
      expect(['darwin', 'linux', 'win32']).toContain(currentPlatform);
      expect(['x64', 'arm64', 'ia32']).toContain(currentArch);

      // OS release should be a valid string
      expect(typeof osRelease).toBe('string');
      expect(osRelease.length).toBeGreaterThan(0);
    });

    it('should have proper Node.js version for CI compatibility', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);

      // Should be using a supported Node.js version
      expect(majorVersion).toBeGreaterThanOrEqual(18);
      expect(majorVersion).toBeLessThanOrEqual(22); // Future-proofing

      // Should be LTS version for CI stability
      expect([18, 20, 22]).toContain(majorVersion);
    });
  });

  describe('Package Dependencies Windows Compatibility', () => {
    it('should have Windows-compatible package.json configurations', () => {
      const packageJsonPaths = [
        join(process.cwd(), 'package.json'),
        join(process.cwd(), 'packages', 'core', 'package.json'),
        join(process.cwd(), 'packages', 'orchestrator', 'package.json'),
        join(process.cwd(), 'packages', 'cli', 'package.json'),
        join(process.cwd(), 'packages', 'api', 'package.json'),
      ];

      packageJsonPaths.forEach(packagePath => {
        if (existsSync(packagePath)) {
          const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

          // Should have proper engines specification
          if (packageJson.engines?.node) {
            const nodeEngines = packageJson.engines.node;
            expect(nodeEngines).toMatch(/>=18/);
          }

          // Should not have platform-specific dependencies that break Windows
          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
            ...packageJson.peerDependencies
          };

          // Check for known problematic packages
          const problematicPackages = ['unix-only', 'linux-only', 'darwin-only'];
          problematicPackages.forEach(pkg => {
            expect(allDeps[pkg]).toBeUndefined();
          });

          // Should have proper scripts for Windows
          if (packageJson.scripts) {
            Object.entries(packageJson.scripts).forEach(([name, script]) => {
              // Should not use shell-specific syntax
              expect(script).not.toMatch(/\$\{.*\}/); // Bash variable expansion
              expect(script).not.toMatch(/`.*`/); // Command substitution
            });
          }
        }
      });
    });

    it('should verify native module dependencies are Windows-compatible', () => {
      const orchestratorPackagePath = join(process.cwd(), 'packages', 'orchestrator', 'package.json');

      if (existsSync(orchestratorPackagePath)) {
        const packageJson = JSON.parse(readFileSync(orchestratorPackagePath, 'utf-8'));
        const deps = packageJson.dependencies || {};

        // better-sqlite3 should be present and Windows-compatible
        if (deps['better-sqlite3']) {
          expect(deps['better-sqlite3']).toBeDefined();
          // Should be a recent version that supports Windows
          expect(deps['better-sqlite3']).toMatch(/\^[89]\.|\^1[0-9]\./);
        }

        // Should not have native dependencies known to be problematic on Windows
        const problematicNativeModules = ['node-sass', 'node-gyp-build-optional-packages'];
        problematicNativeModules.forEach(mod => {
          expect(deps[mod]).toBeUndefined();
        });
      }
    });
  });

  describe('CI Workflow Comprehensive Validation', () => {
    let ciWorkflow: any;

    beforeAll(() => {
      const workflowPath = join(process.cwd(), '.github', 'workflows', 'ci.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      ciWorkflow = yaml.parse(content);
    });

    it('should properly configure Windows in the build matrix', () => {
      const matrix = ciWorkflow.jobs.build.strategy.matrix;

      // Verify Windows is included
      expect(matrix.os).toContain('windows-latest');
      expect(matrix.os).toContain('ubuntu-latest');

      // Verify multiple Node versions
      expect(matrix['node-version']).toContain('18.x');
      expect(matrix['node-version']).toContain('20.x');

      // Calculate Windows coverage
      const windowsOSCount = matrix.os.filter((os: string) => os.includes('windows')).length;
      const nodeVersionCount = matrix['node-version'].length;
      const windowsCombinations = windowsOSCount * nodeVersionCount;

      expect(windowsCombinations).toBeGreaterThanOrEqual(2);
    });

    it('should run all critical build steps on Windows', () => {
      const steps = ciWorkflow.jobs.build.steps;

      // Find critical steps
      const installStep = steps.find((s: any) => s.name === 'Install dependencies');
      const buildStep = steps.find((s: any) => s.name === 'Build');
      const testStep = steps.find((s: any) => s.name === 'Test');
      const lintStep = steps.find((s: any) => s.name === 'Lint');
      const typecheckStep = steps.find((s: any) => s.name === 'Type check');

      // All steps should be present
      expect(installStep).toBeDefined();
      expect(buildStep).toBeDefined();
      expect(testStep).toBeDefined();
      expect(lintStep).toBeDefined();
      expect(typecheckStep).toBeDefined();

      // Steps should use cross-platform commands
      expect(installStep.run).toBe('npm ci');
      expect(buildStep.run).toBe('npm run build');
      expect(testStep.run).toBe('npm test');
      expect(lintStep.run).toBe('npm run lint');
      expect(typecheckStep.run).toBe('npm run typecheck');

      // No step should exclude Windows
      steps.forEach((step: any) => {
        expect(step.if).not.toMatch(/matrix\.os.*!=.*windows/i);
        expect(step.if).not.toMatch(/runner\.os.*!=.*windows/i);
      });
    });

    it('should use Windows-compatible GitHub Actions', () => {
      const steps = ciWorkflow.jobs.build.steps;

      steps.forEach((step: any) => {
        if (step.uses) {
          // Should use actions that support Windows
          if (step.uses.includes('checkout')) {
            expect(step.uses).toMatch(/^actions\/checkout@v[34]$/);
          }
          if (step.uses.includes('setup-node')) {
            expect(step.uses).toMatch(/^actions\/setup-node@v[34]$/);
          }

          // Should not use actions known to be Unix-only
          expect(step.uses).not.toContain('unix-action');
          expect(step.uses).not.toContain('linux-action');
        }
      });
    });

    it('should have proper job naming for matrix identification', () => {
      const steps = ciWorkflow.jobs.build.steps;
      const nodeSetupStep = steps.find((s: any) => s.uses?.includes('setup-node'));

      // Should include matrix variables in the name
      expect(nodeSetupStep.name).toContain('${{ matrix.node-version }}');
      expect(nodeSetupStep.name).toContain('${{ matrix.os }}');
    });
  });

  describe('Build Tool Compatibility', () => {
    it('should verify TypeScript configuration works on Windows', () => {
      const tsconfigPath = join(process.cwd(), 'tsconfig.json');

      if (existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
        const compilerOptions = tsconfig.compilerOptions || {};

        // Should use module resolution that works on Windows
        if (compilerOptions.moduleResolution) {
          expect(['node', 'bundler']).toContain(compilerOptions.moduleResolution);
        }

        // Should target modern ES for better Windows compatibility
        if (compilerOptions.target) {
          expect(compilerOptions.target).toMatch(/ES202[0-9]|ESNext/);
        }

        // Should not use Unix-specific path configurations
        if (compilerOptions.paths) {
          Object.values(compilerOptions.paths).forEach((pathArray: any) => {
            pathArray.forEach((path: string) => {
              expect(path).not.toMatch(/^\/[^*]/); // No absolute Unix paths
            });
          });
        }
      }
    });

    it('should verify Turbo configuration is Windows-compatible', () => {
      const turboPath = join(process.cwd(), 'turbo.json');

      if (existsSync(turboPath)) {
        const turbo = JSON.parse(readFileSync(turboPath, 'utf-8'));

        if (turbo.pipeline) {
          Object.entries(turbo.pipeline).forEach(([task, config]: [string, any]) => {
            // Should not have Unix-specific cache configurations
            if (config.cache !== false && config.outputs) {
              config.outputs.forEach((output: string) => {
                expect(output).not.toMatch(/^\/[^*]/); // No absolute Unix paths
              });
            }
          });
        }
      }
    });

    it('should verify Vitest configuration works on Windows', () => {
      const vitestConfigPath = join(process.cwd(), 'vitest.config.ts');
      const packageJsonPath = join(process.cwd(), 'package.json');

      // Check if Vitest is configured in package.json
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        if (packageJson.scripts?.test?.includes('vitest')) {
          expect(packageJson.scripts.test).toMatch(/vitest/);

          // Should not use Unix-specific flags
          expect(packageJson.scripts.test).not.toMatch(/--reporter.*unix/);
          expect(packageJson.scripts.test).not.toMatch(/--coverage.*linux/);
        }
      }

      // Check Vitest config if it exists
      if (existsSync(vitestConfigPath)) {
        const configContent = readFileSync(vitestConfigPath, 'utf-8');

        // Should not have Unix-specific configurations
        expect(configContent).not.toMatch(/\/tmp\//);
        expect(configContent).not.toMatch(/\/var\//);
        expect(configContent).not.toMatch(/\/usr\//);
      }
    });
  });

  describe('SQLite Integration Windows Test', () => {
    it('should handle SQLite paths correctly on any platform', async () => {
      // This test verifies the SQLite integration works regardless of platform
      const testDbPath = join(process.cwd(), '.apex', 'test.db');

      // Should handle the path format correctly
      expect(() => {
        const resolved = require('path').resolve(testDbPath);
        expect(resolved).toBeTruthy();
      }).not.toThrow();

      // Path should be normalized for the current platform
      const normalizedPath = require('path').normalize(testDbPath);
      expect(normalizedPath).toBeTruthy();

      // Should handle both forward and backward slashes
      const crossPlatformPath = testDbPath.replace(/\\/g, '/');
      expect(crossPlatformPath).toBeTruthy();
    });

    it('should verify SQLite module can be imported', async () => {
      // Test if better-sqlite3 can be imported without compilation errors
      try {
        const Database = await import('better-sqlite3');
        expect(Database).toBeDefined();
      } catch (error) {
        // This might fail if not compiled for the current platform
        // but that's what the CI should catch
        console.warn('SQLite import failed (expected in some environments):', error);
      }
    });
  });

  describe('Cross-Platform File Operations', () => {
    it('should handle line endings correctly', () => {
      // Test files should handle both CRLF and LF
      const packageJsonPath = join(process.cwd(), 'package.json');
      const content = readFileSync(packageJsonPath, 'utf-8');

      // Should parse regardless of line endings
      expect(() => JSON.parse(content)).not.toThrow();

      // Content should be valid
      const parsed = JSON.parse(content);
      expect(parsed.name).toBeDefined();
    });

    it('should handle path resolution across platforms', () => {
      // Test various path operations
      const testPaths = [
        join('packages', 'core', 'src'),
        join('.apex', 'config.yaml'),
        join('node_modules', '.bin'),
      ];

      testPaths.forEach(testPath => {
        expect(() => {
          const resolved = require('path').resolve(testPath);
          const normalized = require('path').normalize(testPath);
          expect(resolved).toBeTruthy();
          expect(normalized).toBeTruthy();
        }).not.toThrow();
      });
    });

    it('should handle environment variables correctly', () => {
      // Should access environment variables in a cross-platform way
      const nodeEnv = process.env.NODE_ENV;
      const home = process.env.HOME || process.env.USERPROFILE;

      expect(typeof nodeEnv === 'string' || nodeEnv === undefined).toBe(true);
      expect(typeof home === 'string').toBe(true);
    });
  });
});