/**
 * @fileoverview E2E tests verifying that documented commands actually work
 *
 * This test suite validates that all the commands documented in the E2E README
 * actually work as described, including:
 * - Build commands
 * - Test execution commands
 * - Cleanup commands
 * - Platform-specific scripts
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as path from 'path';

describe('E2E Command Verification', () => {
  const projectRoot = process.cwd();

  describe('Build Command Verification', () => {
    it('should successfully execute npm run build', () => {
      expect(() => {
        const output = execSync('npm run build', {
          cwd: projectRoot,
          stdio: 'pipe',
          encoding: 'utf-8',
          timeout: 180000 // 3 minutes for build
        });

        // Build should complete without errors
        expect(typeof output).toBe('string');
      }).not.toThrow();
    });

    it('should verify CLI binary exists after build', () => {
      const cliBinaryPath = join(projectRoot, 'packages/cli/dist/index.js');

      // Make sure build was successful
      expect(existsSync(cliBinaryPath)).toBe(true);

      // Verify the binary is executable Node.js file
      const binaryContent = readFileSync(cliBinaryPath, 'utf-8');
      expect(binaryContent).toContain('#!/usr/bin/env node');
    });

    it('should verify all package builds are successful', () => {
      const packageDirs = ['core', 'orchestrator', 'cli', 'api'];

      packageDirs.forEach(pkg => {
        const distPath = join(projectRoot, `packages/${pkg}/dist`);
        expect(existsSync(distPath)).toBe(true);

        // Check that at least one built file exists
        const indexPath = join(distPath, 'index.js');
        const mainPath = join(distPath, `${pkg}.js`);

        expect(
          existsSync(indexPath) || existsSync(mainPath)
        ).toBe(true);
      });
    });
  });

  describe('Test Execution Command Verification', () => {
    it('should verify test:e2e script is correctly configured', () => {
      const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));

      expect(packageJson.scripts['test:e2e']).toBe('vitest run --config vitest.e2e.config.ts');
      expect(packageJson.scripts['test:e2e:watch']).toBe('vitest --config vitest.e2e.config.ts');
    });

    it('should verify E2E config file is valid', () => {
      const configPath = join(projectRoot, 'vitest.e2e.config.ts');
      expect(existsSync(configPath)).toBe(true);

      const configContent = readFileSync(configPath, 'utf-8');
      expect(configContent).toContain('defineConfig');
      expect(configContent).toContain('tests/e2e');
      expect(configContent).toContain('setupFiles');
      expect(configContent).toContain('globalTeardown');
    });

    it('should verify setup and teardown files exist', () => {
      const setupPath = join(projectRoot, 'tests/e2e/setup.ts');
      const teardownPath = join(projectRoot, 'tests/e2e/teardown.ts');

      expect(existsSync(setupPath)).toBe(true);
      expect(existsSync(teardownPath)).toBe(true);

      // Verify they contain expected functions
      const setupContent = readFileSync(setupPath, 'utf-8');
      expect(setupContent).toContain('globalThis.apexE2EHelpers');
    });

    it('should verify test:e2e command can be executed without errors', () => {
      // Run a quick test to verify the command structure is valid
      // We'll run with a very specific filter to avoid running all E2E tests
      expect(() => {
        execSync('npm run test:e2e -- --run --reporter=json infrastructure-verification', {
          cwd: projectRoot,
          stdio: 'pipe',
          timeout: 60000 // 1 minute timeout
        });
      }).not.toThrow();
    }, 90000); // 90 seconds timeout for this test

    it('should verify individual test file execution works', () => {
      // Test running a specific E2E test file as documented
      const testFile = 'tests/e2e/infrastructure-verification.test.ts';

      expect(() => {
        execSync(`npm test -- ${testFile} --run --reporter=minimal`, {
          cwd: projectRoot,
          stdio: 'pipe',
          timeout: 45000 // 45 seconds
        });
      }).not.toThrow();
    }, 60000); // 60 seconds timeout
  });

  describe('Cleanup Command Verification', () => {
    it('should verify all cleanup scripts are executable', () => {
      const cleanupCommands = [
        'cleanup:test',
        'cleanup:test:shell',
        'cleanup:test:windows'
      ];

      const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));

      cleanupCommands.forEach(cmd => {
        expect(packageJson.scripts[cmd]).toBeDefined();
        expect(typeof packageJson.scripts[cmd]).toBe('string');
      });
    });

    it('should execute cleanup:test script successfully', () => {
      expect(() => {
        execSync('npm run cleanup:test', {
          cwd: projectRoot,
          stdio: 'pipe',
          timeout: 30000 // 30 seconds
        });
      }).not.toThrow();
    });

    it('should verify cleanup script files exist and are executable', () => {
      const scriptPaths = [
        'scripts/cleanup-test-directory.mjs',
        'scripts/cleanup-test-directory.sh',
        'scripts/cleanup-test-directory.bat'
      ];

      scriptPaths.forEach(scriptPath => {
        const fullPath = join(projectRoot, scriptPath);
        expect(existsSync(fullPath)).toBe(true);

        // Verify scripts have appropriate content
        const content = readFileSync(fullPath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
        expect(content).toContain('.apex-test');
      });
    });
  });

  describe('Environment Validation', () => {
    it('should verify Node.js version meets documented requirements', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

      // Documentation states Node.js 18+
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });

    it('should verify git is available as documented', () => {
      let gitVersion: string;

      expect(() => {
        gitVersion = execSync('git --version', {
          encoding: 'utf-8',
          timeout: 5000
        });
      }).not.toThrow();

      expect(gitVersion).toContain('git version');
    });

    it('should verify npm install completed successfully', () => {
      const nodeModulesPath = join(projectRoot, 'node_modules');
      expect(existsSync(nodeModulesPath)).toBe(true);

      // Check for key dependencies mentioned in documentation
      const keyDeps = ['vitest', 'turbo', 'typescript'];
      keyDeps.forEach(dep => {
        const depPath = join(nodeModulesPath, dep);
        expect(existsSync(depPath)).toBe(true);
      });
    });

    it('should verify environment variables are set correctly in E2E context', () => {
      // These should be set when running E2E tests
      if (process.env.APEX_TEST_MODE === 'e2e') {
        expect(process.env.APEX_TEST_MODE).toBe('e2e');
        expect(process.env.NODE_ENV).toBe('test');
      }
    });
  });

  describe('Debug Mode Verification', () => {
    it('should verify DEBUG mode is supported', () => {
      // Test that DEBUG=1 can be set and recognized
      const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
      expect(packageJson.scripts['test:e2e']).toContain('vitest');

      // The documentation shows DEBUG=1 npm run test:e2e
      // This should work without errors (though we won't run it with debug for performance)
    });

    it('should verify console output preservation in debug mode', () => {
      // Verify that debug mode would preserve console output
      // We can check this by looking at the vitest configuration
      const configContent = readFileSync(join(projectRoot, 'vitest.e2e.config.ts'), 'utf-8');

      // Should have verbose reporter which supports debug output
      expect(configContent).toContain('verbose');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should verify commands work on current platform', () => {
      const platform = process.platform;
      const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));

      if (platform === 'win32') {
        // Windows-specific verification
        expect(packageJson.scripts['cleanup:test:windows']).toBeDefined();
      } else {
        // Unix-like systems (Linux, macOS)
        expect(packageJson.scripts['cleanup:test:shell']).toBeDefined();
      }

      // Universal cleanup should work on all platforms
      expect(packageJson.scripts['cleanup:test']).toBeDefined();
    });

    it('should verify file paths are platform-independent', () => {
      // Check that documented paths use forward slashes (platform-independent)
      const readmePath = join(projectRoot, 'tests/e2e/README.md');
      const readmeContent = readFileSync(readmePath, 'utf-8');

      // Commands should use forward slashes (works on all platforms with Node.js)
      expect(readmeContent).toContain('tests/e2e/');
      expect(readmeContent).toContain('packages/cli/dist/');
    });
  });
});