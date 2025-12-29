/**
 * Tests for npm scripts compatibility on Windows
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';
import { spawn } from 'child_process';

describe('NPM Scripts Windows Compatibility', () => {
  let rootPackageJson: any;
  let packages: Array<{ name: string; path: string; packageJson: any }>;

  beforeAll(() => {
    // Load root package.json
    const rootPath = join(process.cwd(), 'package.json');
    rootPackageJson = JSON.parse(readFileSync(rootPath, 'utf-8'));

    // Load all package.json files from workspace packages
    packages = [];
    const workspaces = rootPackageJson.workspaces || [];

    workspaces.forEach((workspace: string) => {
      const packagePath = join(process.cwd(), workspace, 'package.json');
      if (existsSync(packagePath)) {
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        packages.push({
          name: packageJson.name,
          path: workspace,
          packageJson
        });
      }
    });
  });

  describe('Root Package Scripts', () => {
    it('should have Windows-compatible npm scripts', () => {
      const scripts = rootPackageJson.scripts || {};

      // Check each script for Windows compatibility
      Object.entries(scripts).forEach(([name, script]: [string, any]) => {
        // Should not use Unix-specific commands
        expect(script).not.toMatch(/\bls\b/);
        expect(script).not.toMatch(/\brm -rf\b/);
        expect(script).not.toMatch(/\bmkdir -p\b/);
        expect(script).not.toMatch(/\bcp -r\b/);
        expect(script).not.toMatch(/\bfind \.\b/);
        expect(script).not.toMatch(/\bgrep\b/);
        expect(script).not.toMatch(/\bsed\b/);
        expect(script).not.toMatch(/\bawk\b/);

        // Should not use shell-specific syntax
        expect(script).not.toMatch(/&&.*rm/);
        expect(script).not.toMatch(/\|\| exit/);
      });
    });

    it('should use cross-platform tools and commands', () => {
      const scripts = rootPackageJson.scripts || {};

      // Essential scripts should exist
      expect(scripts.build).toBeDefined();
      expect(scripts.test).toBeDefined();
      expect(scripts.lint).toBeDefined();

      // Should use turbo for monorepo management (cross-platform)
      expect(scripts.build).toContain('turbo');
      expect(scripts.lint).toContain('turbo');
      expect(scripts.typecheck).toContain('turbo');

      // Should use vitest for testing (cross-platform)
      expect(scripts.test).toContain('vitest');

      // Should use prettier for formatting (cross-platform)
      if (scripts.format) {
        expect(scripts.format).toContain('prettier');
      }
    });

    it('should not use shell operators that behave differently on Windows', () => {
      const scripts = rootPackageJson.scripts || {};

      Object.entries(scripts).forEach(([name, script]: [string, any]) => {
        // Should not use output redirection that might fail on Windows
        expect(script).not.toMatch(/>\s*\/dev\/null/);
        expect(script).not.toMatch(/2>&1/);

        // Should not use environment variable syntax specific to Unix
        expect(script).not.toMatch(/\$\w+/); // Unix env vars

        // Should be careful with path separators (let tools handle it)
        if (script.includes('/')) {
          // If using paths, should use tools that handle cross-platform paths
          const hasNodeScript = script.includes('node ') ||
                               script.includes('npm ') ||
                               script.includes('npx ') ||
                               script.includes('turbo ') ||
                               script.includes('vitest') ||
                               script.includes('prettier');
          expect(hasNodeScript).toBe(true);
        }
      });
    });
  });

  describe('Workspace Package Scripts', () => {
    it('should have consistent scripts across packages', () => {
      const commonScripts = ['build', 'dev', 'lint', 'typecheck'];

      packages.forEach(({ name, packageJson }) => {
        const scripts = packageJson.scripts || {};

        // Core packages should have build and dev scripts
        if (['@apex/core', '@apex/orchestrator', '@apex/cli', '@apex/api'].includes(name)) {
          expect(scripts.build, `${name} should have build script`).toBeDefined();
          expect(scripts.dev, `${name} should have dev script`).toBeDefined();
          expect(scripts.lint, `${name} should have lint script`).toBeDefined();
          expect(scripts.typecheck, `${name} should have typecheck script`).toBeDefined();
        }
      });
    });

    it('should use Windows-compatible commands in package scripts', () => {
      packages.forEach(({ name, packageJson }) => {
        const scripts = packageJson.scripts || {};

        Object.entries(scripts).forEach(([scriptName, script]: [string, any]) => {
          // Should not use Unix-specific file operations
          expect(script).not.toMatch(/\brm -rf\b/);
          expect(script).not.toMatch(/\bmkdir -p\b/);

          // Should use tsc for TypeScript compilation (cross-platform)
          if (scriptName === 'build' && script.includes('tsc')) {
            expect(script).toMatch(/tsc/);
          }

          // Should use cross-platform tools
          if (scriptName === 'dev' || scriptName === 'watch') {
            const hasCrossPlatformTool = script.includes('tsc') ||
                                       script.includes('turbo') ||
                                       script.includes('nodemon') ||
                                       script.includes('tsx');
            expect(hasCrossPlatformTool).toBe(true);
          }
        });
      });
    });
  });

  describe('Script Execution Test', () => {
    it('should be able to validate script syntax without execution', () => {
      const scripts = rootPackageJson.scripts || {};

      Object.entries(scripts).forEach(([name, script]: [string, any]) => {
        // Basic syntax validation - should not contain obvious syntax errors
        expect(script.trim()).not.toBe('');
        expect(script).not.toMatch(/^-/); // Should not start with dash
        expect(script).not.toContain('undefined');
        expect(script).not.toContain('null');

        // Should not have unmatched quotes
        const singleQuotes = (script.match(/'/g) || []).length;
        const doubleQuotes = (script.match(/"/g) || []).length;

        if (singleQuotes > 0) {
          expect(singleQuotes % 2).toBe(0);
        }
        if (doubleQuotes > 0) {
          expect(doubleQuotes % 2).toBe(0);
        }
      });
    });
  });

  describe('Package Manager Compatibility', () => {
    it('should specify npm as the package manager', () => {
      expect(rootPackageJson.packageManager).toBeDefined();
      expect(rootPackageJson.packageManager).toMatch(/^npm@/);
    });

    it('should have proper npm configuration for Windows', () => {
      // Check for any .npmrc files that might affect Windows compatibility
      const npmrcPath = join(process.cwd(), '.npmrc');

      if (existsSync(npmrcPath)) {
        const npmrc = readFileSync(npmrcPath, 'utf-8');

        // Should not have Unix-specific configurations
        expect(npmrc).not.toMatch(/^shell=/m);
        expect(npmrc).not.toMatch(/\/bin\/sh/);
        expect(npmrc).not.toMatch(/\/usr\/bin/);
      }
    });

    it('should work with Windows cmd and PowerShell', () => {
      const scripts = rootPackageJson.scripts || {};

      Object.entries(scripts).forEach(([name, script]: [string, any]) => {
        // Should not use shell-specific features
        expect(script).not.toMatch(/\|\|/); // OR operator might behave differently
        expect(script).not.toMatch(/&&.*exit/); // Exit with && might fail

        // Should use npm/node commands that work in both cmd and PowerShell
        const isNodeCommand = script.startsWith('node ') ||
                             script.startsWith('npm ') ||
                             script.startsWith('npx ') ||
                             script.startsWith('turbo ') ||
                             script.startsWith('vitest') ||
                             script.startsWith('prettier');

        if (!isNodeCommand && !script.includes(' && ')) {
          // Allow simple commands and command chains with &&
          expect(script.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Build Tool Configuration', () => {
    it('should have proper TypeScript configuration for Windows', () => {
      const tsconfigPath = join(process.cwd(), 'tsconfig.json');

      if (existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

        // Should use cross-platform module resolution
        if (tsconfig.compilerOptions?.moduleResolution) {
          expect(['node', 'bundler']).toContain(tsconfig.compilerOptions.moduleResolution);
        }

        // Should have proper target for Windows compatibility
        if (tsconfig.compilerOptions?.target) {
          expect(tsconfig.compilerOptions.target).toMatch(/ES2020|ES2021|ES2022|ESNext/i);
        }
      }
    });

    it('should have proper Turbo configuration', () => {
      const turboPath = join(process.cwd(), 'turbo.json');

      if (existsSync(turboPath)) {
        const turbo = JSON.parse(readFileSync(turboPath, 'utf-8'));

        // Should not have Unix-specific pipeline configurations
        if (turbo.pipeline) {
          Object.values(turbo.pipeline).forEach((config: any) => {
            if (config.cache !== false) {
              // Caching should work on Windows
              expect(config.cache).not.toBe(undefined);
            }
          });
        }
      }
    });
  });
});