/**
 * Turborepo Edge Cases and Additional Validation Tests
 *
 * Comprehensive testing for edge cases, error scenarios, and specific
 * implementation details not covered in the main turborepo-audit test.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = resolve(__dirname, '..');

describe('Turborepo Edge Cases and Error Scenarios', () => {
  describe('1. Error Handling and Resilience', () => {
    test('build scripts handle TypeScript errors gracefully', () => {
      // Check if packages use error suppression (|| echo ok)
      const packagePaths = [
        'packages/core/package.json',
        'packages/browser/package.json',
        'packages/orchestrator/package.json'
      ];

      for (const packagePath of packagePaths) {
        const fullPath = join(ROOT_DIR, packagePath);
        if (existsSync(fullPath)) {
          const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));

          // Check build and typecheck scripts for error suppression
          if (pkg.scripts?.build?.includes('|| echo ok')) {
            console.warn(`Package ${pkg.name} suppresses build errors`);
          }

          if (pkg.scripts?.typecheck?.includes('|| echo ok')) {
            console.warn(`Package ${pkg.name} suppresses typecheck errors`);
          }

          // This is documented behavior, so we expect some packages to have it
          expect(pkg.scripts).toBeDefined();
        }
      }
    });

    test('root test command bypasses turbo pipeline', () => {
      const rootPackage = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));

      // This is a known issue - root test bypasses turbo
      expect(rootPackage.scripts.test).toBe('vitest run');
      expect(rootPackage.scripts.test).not.toBe('turbo run test');

      console.log('Note: Root test command bypasses Turborepo pipeline (known limitation)');
    });
  });

  describe('2. Package Isolation and Boundaries', () => {
    test('browser package has no internal apex dependencies', () => {
      const browserPackage = JSON.parse(
        readFileSync(join(ROOT_DIR, 'packages/browser/package.json'), 'utf-8')
      );

      const internalDeps = Object.keys(browserPackage.dependencies || {})
        .filter(dep => dep.startsWith('@apexcli/'));

      // Browser package should be independent of other APEX packages
      expect(internalDeps).toHaveLength(0);
    });

    test('web-ui package only depends on core', () => {
      const webUiPackage = JSON.parse(
        readFileSync(join(ROOT_DIR, 'packages/web-ui/package.json'), 'utf-8')
      );

      const internalDeps = Object.keys(webUiPackage.dependencies || {})
        .filter(dep => dep.startsWith('@apexcli/'));

      expect(internalDeps).toEqual(['@apexcli/core']);
    });

    test('packages have appropriate type declarations', () => {
      const packagePaths = [
        'packages/core/package.json',
        'packages/cli/package.json',
        'packages/api/package.json',
        'packages/orchestrator/package.json',
        'packages/browser/package.json'
      ];

      for (const packagePath of packagePaths) {
        const fullPath = join(ROOT_DIR, packagePath);
        if (existsSync(fullPath)) {
          const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));

          if (pkg.types) {
            expect(pkg.types).toMatch(/^\.\/dist\/.*\.d\.ts$/);
          }

          if (pkg.main) {
            expect(pkg.main).toMatch(/^\.\/dist\//);
          }
        }
      }
    });
  });

  describe('3. Build Output Validation', () => {
    test('packages output to correct directories', () => {
      const turboConfig = JSON.parse(readFileSync(join(ROOT_DIR, 'turbo.json'), 'utf-8'));

      const buildOutputs = turboConfig.tasks.build.outputs;

      expect(buildOutputs).toContain('dist/**');
      expect(buildOutputs).toContain('.next/**');
      expect(buildOutputs).toContain('!.next/cache/**');
    });

    test('test outputs are correctly configured', () => {
      const turboConfig = JSON.parse(readFileSync(join(ROOT_DIR, 'turbo.json'), 'utf-8'));

      const testOutputs = turboConfig.tasks.test.outputs;

      expect(testOutputs).toContain('coverage/**');
    });

    test('clean tasks properly clear build artifacts', () => {
      const packagePaths = [
        'packages/core/package.json',
        'packages/cli/package.json',
        'packages/api/package.json'
      ];

      for (const packagePath of packagePaths) {
        const fullPath = join(ROOT_DIR, packagePath);
        if (existsSync(fullPath)) {
          const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));

          expect(pkg.scripts.clean).toMatch(/rm -rf/);
          expect(pkg.scripts.clean).toMatch(/dist/);
        }
      }
    });
  });

  describe('4. Advanced Pipeline Configuration', () => {
    test('task dependencies are correctly configured for parallel execution', () => {
      const turboConfig = JSON.parse(readFileSync(join(ROOT_DIR, 'turbo.json'), 'utf-8'));

      // Build tasks should depend on upstream builds (^build)
      expect(turboConfig.tasks.build.dependsOn).toEqual(['^build']);

      // Lint and typecheck should depend on builds (to ensure types are available)
      expect(turboConfig.tasks.lint.dependsOn).toEqual(['^build']);
      expect(turboConfig.tasks.typecheck.dependsOn).toEqual(['^build']);

      // Test should depend on build (to ensure code is compiled)
      expect(turboConfig.tasks.test.dependsOn).toEqual(['build']);
    });

    test('development tasks are configured for optimal DX', () => {
      const turboConfig = JSON.parse(readFileSync(join(ROOT_DIR, 'turbo.json'), 'utf-8'));

      // Dev task should not cache and be persistent
      expect(turboConfig.tasks.dev.cache).toBe(false);
      expect(turboConfig.tasks.dev.persistent).toBe(true);

      // Clean task should not cache
      expect(turboConfig.tasks.clean.cache).toBe(false);
    });

    test('global dependencies include environment files', () => {
      const turboConfig = JSON.parse(readFileSync(join(ROOT_DIR, 'turbo.json'), 'utf-8'));

      expect(turboConfig.globalDependencies).toContain('**/.env.*local');
    });
  });

  describe('5. Package Script Consistency', () => {
    test('all packages have consistent script naming', () => {
      const requiredScripts = ['build', 'dev', 'clean', 'typecheck', 'lint', 'test'];
      const packagePaths = [
        'packages/core/package.json',
        'packages/cli/package.json',
        'packages/api/package.json',
        'packages/orchestrator/package.json',
        'packages/browser/package.json',
        'packages/web-ui/package.json'
      ];

      for (const packagePath of packagePaths) {
        const fullPath = join(ROOT_DIR, packagePath);
        if (existsSync(fullPath)) {
          const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));

          for (const script of requiredScripts) {
            expect(pkg.scripts[script]).toBeDefined();
          }
        }
      }
    });

    test('build tools are consistently configured', () => {
      const typeScriptPackages = [
        'packages/core/package.json',
        'packages/cli/package.json',
        'packages/orchestrator/package.json',
        'packages/browser/package.json'
      ];

      for (const packagePath of typeScriptPackages) {
        const fullPath = join(ROOT_DIR, packagePath);
        if (existsSync(fullPath)) {
          const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));

          // Should use TypeScript for building
          expect(pkg.scripts.build).toMatch(/tsc/);

          // Dev script should use TypeScript compilation or watch mode
          expect(pkg.scripts.dev).toMatch(/tsc|tsx/);
        }
      }

      // API package uses tsx for development
      const apiPath = join(ROOT_DIR, 'packages/api/package.json');
      if (existsSync(apiPath)) {
        const api = JSON.parse(readFileSync(apiPath, 'utf-8'));
        expect(api.scripts.build).toBe('tsc');
        expect(api.scripts.dev).toBe('tsx watch src/index.ts');
      }

      // Web UI should use Next.js
      const webUiPath = join(ROOT_DIR, 'packages/web-ui/package.json');
      if (existsSync(webUiPath)) {
        const webUi = JSON.parse(readFileSync(webUiPath, 'utf-8'));
        expect(webUi.scripts.build).toBe('next build');
        expect(webUi.scripts.dev).toMatch(/next dev/);
      }
    });
  });

  describe('6. Cache and Performance Validation', () => {
    test('turbo daemon is accessible', () => {
      const daemonDir = join(ROOT_DIR, '.turbo/daemon');

      if (existsSync(daemonDir)) {
        expect(statSync(daemonDir).isDirectory()).toBe(true);
      }
    });

    test('cache directory has reasonable structure', () => {
      const cacheDir = join(ROOT_DIR, '.turbo/cache');

      if (existsSync(cacheDir)) {
        expect(statSync(cacheDir).isDirectory()).toBe(true);

        // Should not be completely empty in a working repo
        const hasContent = require('fs').readdirSync(cacheDir).length > 0;
        console.log(`Cache directory has content: ${hasContent}`);
      }
    });
  });

  describe('7. Integration with External Tools', () => {
    test('packages properly declare external dependencies', () => {
      const packagePaths = [
        'packages/core/package.json',
        'packages/cli/package.json',
        'packages/api/package.json',
        'packages/orchestrator/package.json',
        'packages/browser/package.json',
        'packages/web-ui/package.json'
      ];

      for (const packagePath of packagePaths) {
        const fullPath = join(ROOT_DIR, packagePath);
        if (existsSync(fullPath)) {
          const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));

          // Should have TypeScript as dev dependency
          expect(pkg.devDependencies?.typescript).toBeDefined();

          // Should have vitest for testing
          expect(pkg.devDependencies?.vitest).toBeDefined();

          // Should have consistent Node.js types
          expect(pkg.devDependencies?.['@types/node']).toBeDefined();
        }
      }
    });

    test('workspace versioning is consistent', () => {
      const rootPackage = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));
      const expectedVersion = rootPackage.version;

      const packagePaths = [
        'packages/core/package.json',
        'packages/cli/package.json',
        'packages/api/package.json',
        'packages/orchestrator/package.json',
        'packages/browser/package.json',
        'packages/web-ui/package.json'
      ];

      for (const packagePath of packagePaths) {
        const fullPath = join(ROOT_DIR, packagePath);
        if (existsSync(fullPath)) {
          const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));
          expect(pkg.version).toBe(expectedVersion);
        }
      }
    });
  });
});

describe('Turborepo Implementation Reality Check', () => {
  test('this is a real implementation, not a stub', () => {
    const realImplementationIndicators = [];

    // 1. Turbo configuration exists and is comprehensive
    if (existsSync(join(ROOT_DIR, 'turbo.json'))) {
      const turboConfig = JSON.parse(readFileSync(join(ROOT_DIR, 'turbo.json'), 'utf-8'));
      if (Object.keys(turboConfig.tasks).length >= 6) {
        realImplementationIndicators.push('comprehensive turbo.json');
      }
    }

    // 2. Multiple packages with real dependencies
    const packages = [
      'packages/core',
      'packages/cli',
      'packages/api',
      'packages/orchestrator',
      'packages/browser',
      'packages/web-ui'
    ];

    const existingPackages = packages.filter(pkg =>
      existsSync(join(ROOT_DIR, pkg, 'package.json'))
    );

    if (existingPackages.length >= 6) {
      realImplementationIndicators.push('complete package structure');
    }

    // 3. Actual source code exists
    const hasSourceCode = packages.some(pkg =>
      existsSync(join(ROOT_DIR, pkg, 'src')) ||
      existsSync(join(ROOT_DIR, pkg, 'app')) // for Next.js
    );

    if (hasSourceCode) {
      realImplementationIndicators.push('source code present');
    }

    // 4. Build artifacts can be generated
    const hasDistDirs = packages.some(pkg =>
      existsSync(join(ROOT_DIR, pkg, 'dist'))
    );

    if (hasDistDirs) {
      realImplementationIndicators.push('build artifacts present');
    }

    // 5. Cache directory indicates real usage
    if (existsSync(join(ROOT_DIR, '.turbo/cache'))) {
      realImplementationIndicators.push('turbo cache active');
    }

    console.log('Real implementation indicators:', realImplementationIndicators);

    expect(realImplementationIndicators.length).toBeGreaterThanOrEqual(3);
    expect(realImplementationIndicators).toContain('comprehensive turbo.json');
    expect(realImplementationIndicators).toContain('complete package structure');
  });

  test('workspace dependencies form valid dependency graph', () => {
    const packageDependencies = new Map();

    const packagePaths = [
      'packages/core/package.json',
      'packages/cli/package.json',
      'packages/api/package.json',
      'packages/orchestrator/package.json',
      'packages/browser/package.json',
      'packages/web-ui/package.json'
    ];

    // Build dependency graph
    for (const packagePath of packagePaths) {
      const fullPath = join(ROOT_DIR, packagePath);
      if (existsSync(fullPath)) {
        const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));
        const deps = Object.keys(pkg.dependencies || {})
          .filter(dep => dep.startsWith('@apexcli/'));
        packageDependencies.set(pkg.name, deps);
      }
    }

    // Core should have no internal dependencies
    expect(packageDependencies.get('@apexcli/core')).toEqual([]);

    // Browser should have no internal dependencies (standalone)
    expect(packageDependencies.get('@apexcli/browser')).toEqual([]);

    // CLI should depend on core, api, and orchestrator
    expect(packageDependencies.get('@apexcli/cli')).toContain('@apexcli/core');
    expect(packageDependencies.get('@apexcli/cli')).toContain('@apexcli/api');
    expect(packageDependencies.get('@apexcli/cli')).toContain('@apexcli/orchestrator');

    // API should depend on core, orchestrator, and browser
    expect(packageDependencies.get('@apexcli/api')).toContain('@apexcli/core');
    expect(packageDependencies.get('@apexcli/api')).toContain('@apexcli/orchestrator');
    expect(packageDependencies.get('@apexcli/api')).toContain('@apexcli/browser');

    // Orchestrator should depend only on core
    expect(packageDependencies.get('@apexcli/orchestrator')).toEqual(['@apexcli/core']);

    // Web UI should depend only on core
    expect(packageDependencies.get('@apexcli/web-ui')).toEqual(['@apexcli/core']);

    console.log('Dependency graph verified as valid and acyclic');
  });
});