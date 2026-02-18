import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Build validation tests to ensure version update didn't break build configuration
 */
describe('Build Configuration Validation', () => {
  const projectRoot = path.resolve(__dirname, '..');

  describe('TypeScript Configuration', () => {
    it('should have valid tsconfig.json files', () => {
      const tsConfigPaths = [
        'tsconfig.json',
        'packages/cli/tsconfig.json',
        'packages/core/tsconfig.json',
        'packages/api/tsconfig.json',
        'packages/browser/tsconfig.json',
        'packages/orchestrator/tsconfig.json',
        'packages/web-ui/tsconfig.json'
      ];

      tsConfigPaths.forEach(configPath => {
        const fullPath = path.join(projectRoot, configPath);

        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          expect(() => JSON.parse(content)).not.toThrow();
        }
      });
    });
  });

  describe('Turbo Configuration', () => {
    it('should have valid turbo.json configuration', () => {
      const turboConfigPath = path.join(projectRoot, 'turbo.json');

      if (fs.existsSync(turboConfigPath)) {
        const content = fs.readFileSync(turboConfigPath, 'utf-8');
        const config = JSON.parse(content);

        expect(config.pipeline).toBeDefined();
        expect(config.pipeline.build).toBeDefined();
        expect(config.pipeline.test).toBeDefined();
      }
    });
  });

  describe('Package Scripts Validation', () => {
    it('should have build scripts in all packages', () => {
      const packagePaths = [
        'package.json',
        'packages/cli/package.json',
        'packages/core/package.json',
        'packages/api/package.json',
        'packages/browser/package.json',
        'packages/orchestrator/package.json',
        'packages/web-ui/package.json'
      ];

      packagePaths.forEach(packagePath => {
        const fullPath = path.join(projectRoot, packagePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const pkg = JSON.parse(content);

        // Root package should have build script
        if (packagePath === 'package.json') {
          expect(pkg.scripts?.build).toBeTruthy();
        }

        // Sub-packages should have build scripts (except root)
        if (packagePath !== 'package.json' && !pkg.private) {
          expect(pkg.scripts?.build).toBeTruthy();
        }
      });
    });

    it('should have consistent script patterns across packages', () => {
      const packagePaths = [
        'packages/cli/package.json',
        'packages/core/package.json',
        'packages/api/package.json',
        'packages/browser/package.json',
        'packages/orchestrator/package.json'
      ];

      packagePaths.forEach(packagePath => {
        const fullPath = path.join(projectRoot, packagePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const pkg = JSON.parse(content);

        // Common scripts that should exist
        expect(pkg.scripts?.build).toBeTruthy();
        expect(pkg.scripts?.clean).toBeTruthy();
        expect(pkg.scripts?.typecheck).toBeTruthy();
      });
    });
  });

  describe('Dependency Resolution', () => {
    it('should have valid internal package references', () => {
      const cliPath = path.join(projectRoot, 'packages/cli/package.json');
      const cliPkg = JSON.parse(fs.readFileSync(cliPath, 'utf-8'));

      // CLI depends on core, orchestrator, and api
      expect(cliPkg.dependencies['@apexcli/core']).toBe('*');
      expect(cliPkg.dependencies['@apexcli/orchestrator']).toBe('*');
      expect(cliPkg.dependencies['@apexcli/api']).toBe('*');
    });

    it('should have valid workspace configuration in root package.json', () => {
      const rootPath = path.join(projectRoot, 'package.json');
      const rootPkg = JSON.parse(fs.readFileSync(rootPath, 'utf-8'));

      expect(rootPkg.workspaces).toBeDefined();
      expect(rootPkg.workspaces).toContain('packages/*');
    });
  });

  describe('Build Outputs', () => {
    it('should have consistent main/types field patterns', () => {
      const packagePaths = [
        'packages/cli/package.json',
        'packages/core/package.json',
        'packages/api/package.json',
        'packages/browser/package.json',
        'packages/orchestrator/package.json'
      ];

      packagePaths.forEach(packagePath => {
        const fullPath = path.join(projectRoot, packagePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const pkg = JSON.parse(content);

        // Should have consistent output patterns
        expect(pkg.main).toMatch(/^\.\/dist\/.+\.js$/);
        expect(pkg.types).toMatch(/^\.\/dist\/.+\.d\.ts$/);
      });
    });
  });

  describe('Version Consistency After Build', () => {
    it('should maintain version consistency post-build', () => {
      // This test ensures that build processes don't inadvertently change versions
      const packagePaths = [
        'package.json',
        'packages/cli/package.json',
        'packages/core/package.json',
        'packages/api/package.json',
        'packages/browser/package.json',
        'packages/orchestrator/package.json',
        'packages/web-ui/package.json'
      ];

      const versions = packagePaths.map(packagePath => {
        const fullPath = path.join(projectRoot, packagePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const pkg = JSON.parse(content);
        return pkg.version;
      });

      // All should be 0.6.0
      expect(versions.every(version => version === '0.6.0')).toBe(true);
    });
  });

  describe('File References Validation', () => {
    it('should not reference non-existent files in package.json', () => {
      const packagePaths = [
        'packages/cli/package.json',
        'packages/core/package.json',
        'packages/api/package.json',
        'packages/browser/package.json',
        'packages/orchestrator/package.json',
        'packages/web-ui/package.json'
      ];

      packagePaths.forEach(packagePath => {
        const packageDir = path.dirname(path.join(projectRoot, packagePath));
        const content = fs.readFileSync(path.join(projectRoot, packagePath), 'utf-8');
        const pkg = JSON.parse(content);

        // Check main file reference (should exist after build or be in dist)
        if (pkg.main) {
          const mainFile = path.join(packageDir, pkg.main);
          // Either the file exists, or it's in dist/ (which gets created during build)
          if (!fs.existsSync(mainFile)) {
            expect(pkg.main).toMatch(/^\.\/dist\//);
          }
        }

        // Check types file reference
        if (pkg.types) {
          const typesFile = path.join(packageDir, pkg.types);
          if (!fs.existsSync(typesFile)) {
            expect(pkg.types).toMatch(/^\.\/dist\//);
          }
        }
      });
    });
  });
});