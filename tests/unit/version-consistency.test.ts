import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Unit tests for version consistency across the APEX monorepo
 * This test suite ensures version 0.6.0 is properly applied
 */
describe('Version Consistency Unit Tests', () => {
  const projectRoot = path.resolve(__dirname, '../../..');

  // All package.json paths in the monorepo that should have version 0.6.0
  const packagePaths = [
    'package.json',
    'packages/api/package.json',
    'packages/browser/package.json',
    'packages/cli/package.json',
    'packages/core/package.json',
    'packages/orchestrator/package.json',
    'packages/web-ui/package.json'
  ];

  describe('JSON Syntax Validation', () => {
    packagePaths.forEach((packagePath) => {
      it(`should have valid JSON syntax in ${packagePath}`, () => {
        const fullPath = path.join(projectRoot, packagePath);
        const content = fs.readFileSync(fullPath, 'utf-8');

        expect(() => JSON.parse(content)).not.toThrow();
      });
    });
  });

  describe('Version Verification', () => {
    packagePaths.forEach((packagePath) => {
      it(`should have version 0.6.0 in ${packagePath}`, () => {
        const fullPath = path.join(projectRoot, packagePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const pkg = JSON.parse(content);

        expect(pkg.version).toBe('0.6.0');
      });
    });
  });

  describe('Internal Dependencies', () => {
    it('should use "*" for internal package dependencies in CLI', () => {
      const cliPath = path.join(projectRoot, 'packages/cli/package.json');
      const cliPkg = JSON.parse(fs.readFileSync(cliPath, 'utf-8'));

      const internalDeps = Object.keys(cliPkg.dependencies || {})
        .filter(dep => dep.startsWith('@apexcli/'));

      internalDeps.forEach(dep => {
        expect(cliPkg.dependencies[dep]).toBe('*');
      });
    });

    it('should use "*" for internal package dependencies in API', () => {
      const apiPath = path.join(projectRoot, 'packages/api/package.json');
      const apiPkg = JSON.parse(fs.readFileSync(apiPath, 'utf-8'));

      const internalDeps = Object.keys(apiPkg.dependencies || {})
        .filter(dep => dep.startsWith('@apexcli/'));

      internalDeps.forEach(dep => {
        expect(apiPkg.dependencies[dep]).toBe('*');
      });
    });
  });

  describe('Package Structure Validation', () => {
    packagePaths.forEach((packagePath) => {
      it(`should have required fields in ${packagePath}`, () => {
        const fullPath = path.join(projectRoot, packagePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const pkg = JSON.parse(content);

        expect(pkg.name).toBeTruthy();
        expect(pkg.version).toBeTruthy();
        expect(pkg.description).toBeTruthy();

        if (packagePath !== 'package.json') {
          // Non-root packages should have proper scoped names
          expect(pkg.name).toMatch(/^@apexcli\//);
        }
      });
    });
  });

  describe('Version Upgrade Completeness', () => {
    it('should have no references to old version 0.5.0 in package.json files', () => {
      packagePaths.forEach(packagePath => {
        const fullPath = path.join(projectRoot, packagePath);
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Should not contain any references to 0.5.0
        expect(content).not.toContain('0.5.0');
      });
    });

    it('should have consistent version across all packages', () => {
      const versions = packagePaths.map(packagePath => {
        const fullPath = path.join(projectRoot, packagePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const pkg = JSON.parse(content);
        return pkg.version;
      });

      // All versions should be identical
      const uniqueVersions = new Set(versions);
      expect(uniqueVersions.size).toBe(1);
      expect(uniqueVersions.has('0.6.0')).toBe(true);
    });
  });

  describe('ROADMAP.md Validation', () => {
    it('should mark v0.5.0 as complete in ROADMAP.md', () => {
      const roadmapPath = path.join(projectRoot, 'ROADMAP.md');
      const content = fs.readFileSync(roadmapPath, 'utf-8');

      // Should contain v0.5.0 marked as complete
      expect(content).toMatch(/## v0\.5\.0.*Complete/i);
    });

    it('should have proper version section ordering in ROADMAP.md', () => {
      const roadmapPath = path.join(projectRoot, 'ROADMAP.md');
      const content = fs.readFileSync(roadmapPath, 'utf-8');
      const lines = content.split('\n');

      const v050Line = lines.findIndex(line => line.includes('## v0.5.0'));
      const v060Line = lines.findIndex(line => line.includes('## v0.6.0'));

      expect(v050Line).toBeGreaterThan(-1);
      expect(v060Line).toBeGreaterThan(-1);
      expect(v050Line).toBeLessThan(v060Line);
    });
  });
});