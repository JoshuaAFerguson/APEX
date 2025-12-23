/**
 * Integration Tests for VersionMismatchDetector
 *
 * These tests verify the VersionMismatchDetector works correctly as a standalone
 * component and properly integrates with the analyzer framework.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { VersionMismatchDetector } from './version-mismatch-detector';
import type { ProjectAnalysis } from '../idle-processor';

describe('VersionMismatchDetector Integration Tests', () => {
  let detector: VersionMismatchDetector;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(process.cwd(), 'test-temp-detector-' + Math.random().toString(36).substring(7));
    await fs.mkdir(tempDir, { recursive: true });

    detector = new VersionMismatchDetector(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Real Project Structure Integration', () => {
    it('should analyze a complete project structure with multiple file types', async () => {
      // Create a realistic project structure
      const packageJson = {
        name: 'sample-project',
        version: '1.2.3',
        description: 'A sample project for testing version mismatch detection',
        scripts: {
          start: 'node index.js',
          test: 'jest'
        },
        dependencies: {
          'express': '^4.18.0',
          'lodash': '^4.17.21'
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create README with version references
      const readmeContent = `# Sample Project

This is version v1.0.0 of our sample project.

## Installation

\`\`\`bash
npm install sample-project@1.1.0
\`\`\`

## Usage

Current version: 1.2.3 (this should match)
Previous version: v1.2.0
Legacy version: version 0.9.0

See also: https://github.com/user/sample-project/tree/v1.1.5

## Changelog

### v1.2.3 - Current
- Latest updates

### v1.2.2
- Bug fixes

### v1.0.0 - Initial
- Initial release
`;

      await fs.writeFile(path.join(tempDir, 'README.md'), readmeContent);

      // Create API documentation
      const apiDocsDir = path.join(tempDir, 'docs', 'api');
      await fs.mkdir(apiDocsDir, { recursive: true });

      const apiContent = `# API Reference

## Authentication API

* @version 1.1.0
* @since 1.0.0

### Login Endpoint

Current version: v1.2.1
Supported since: version 1.0.0
`;

      await fs.writeFile(path.join(apiDocsDir, 'auth.md'), apiContent);

      // Create TypeScript source files with JSDoc
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const appTsContent = `/**
 * Main application entry point
 * @version 1.1.0
 * @author Developer
 * @since 1.0.0
 */

export class App {
  /**
   * Get application version
   * @returns Current version string (v1.2.0)
   */
  getVersion(): string {
    // This should return v1.2.3 to match package.json
    return 'v1.2.0';
  }

  /**
   * Legacy method from version 1.1.5
   * @deprecated Since version 1.2.0
   */
  legacyMethod(): void {
    console.log('This was added in version 1.1.5');
  }
}
`;

      await fs.writeFile(path.join(srcDir, 'app.ts'), appTsContent);

      const utilsContent = `/**
 * Utility functions
 * @version 1.0.5
 */

/**
 * Format version string
 * @param version - Version in format like v1.2.3
 * @returns Formatted version
 * @example formatVersion('v1.2.3') // returns '1.2.3'
 */
export function formatVersion(version: string): string {
  // Current implementation supports version 1.2.1
  return version.replace(/^v/, '');
}
`;

      await fs.writeFile(path.join(srcDir, 'utils.ts'), utilsContent);

      // Create CHANGELOG
      const changelogContent = `# Changelog

All notable changes to this project will be documented in this file.

## [1.2.3] - 2024-01-15
### Added
- New feature X
- Enhanced feature Y

## [1.2.2] - 2024-01-10
### Fixed
- Bug in feature Z

## [1.2.1] - 2024-01-05
### Changed
- Updated dependencies

## [1.2.0] - 2024-01-01
### Added
- Major feature update
- Breaking changes from v1.1.9

## [1.1.9] - 2023-12-20
### Fixed
- Critical security issue

## [1.0.0] - 2023-12-01
### Added
- Initial release
- Core features
`;

      await fs.writeFile(path.join(tempDir, 'CHANGELOG.md'), changelogContent);

      // Run detection
      const mismatches = await detector.detectMismatches();

      // Analyze results
      expect(mismatches.length).toBeGreaterThan(0);

      // Group by file for analysis
      const byFile = mismatches.reduce((acc, mismatch) => {
        if (!acc[mismatch.file]) acc[mismatch.file] = [];
        acc[mismatch.file].push(mismatch);
        return acc;
      }, {} as Record<string, typeof mismatches>);

      // Verify README.md mismatches
      expect(byFile['README.md']).toBeDefined();
      const readmeMismatches = byFile['README.md'];

      // Should find multiple version mismatches in README
      expect(readmeMismatches.length).toBeGreaterThan(3);

      // Check specific mismatches
      const foundVersions = readmeMismatches.map(m => m.foundVersion);
      expect(foundVersions).toContain('1.0.0'); // Line: "This is version v1.0.0"
      expect(foundVersions).toContain('1.1.0'); // Line: "npm install sample-project@1.1.0"
      expect(foundVersions).toContain('1.2.0'); // Line: "Previous version: v1.2.0"

      // Verify API docs mismatches
      expect(byFile['docs/api/auth.md']).toBeDefined();
      const apiMismatches = byFile['docs/api/auth.md'];
      expect(apiMismatches.length).toBeGreaterThan(0);

      // Verify TypeScript file mismatches
      expect(byFile['src/app.ts']).toBeDefined();
      const appMismatches = byFile['src/app.ts'];
      expect(appMismatches.length).toBeGreaterThan(2);

      expect(byFile['src/utils.ts']).toBeDefined();
      const utilsMismatches = byFile['src/utils.ts'];
      expect(utilsMismatches.length).toBeGreaterThan(0);

      // Verify CHANGELOG mismatches - should have many historical versions
      expect(byFile['CHANGELOG.md']).toBeDefined();
      const changelogMismatches = byFile['CHANGELOG.md'];
      expect(changelogMismatches.length).toBeGreaterThan(5); // Many historical versions

      // Verify all mismatches have expected version 1.2.3
      mismatches.forEach(mismatch => {
        expect(mismatch.expectedVersion).toBe('1.2.3');
        expect(mismatch.line).toBeGreaterThan(0);
        expect(mismatch.lineContent).toBeTruthy();
        expect(mismatch.file).toBeTruthy();
      });
    });

    it('should handle monorepo structure with multiple package.json files', async () => {
      // Create root package.json
      const rootPackage = { name: 'monorepo-root', version: '2.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(rootPackage, null, 2)
      );

      // Create workspace packages
      const packagesDir = path.join(tempDir, 'packages');
      await fs.mkdir(packagesDir, { recursive: true });

      // Package A
      const pkgADir = path.join(packagesDir, 'package-a');
      await fs.mkdir(pkgADir, { recursive: true });

      const pkgAPackage = { name: '@monorepo/package-a', version: '1.5.0' };
      await fs.writeFile(
        path.join(pkgADir, 'package.json'),
        JSON.stringify(pkgAPackage, null, 2)
      );

      // Package B
      const pkgBDir = path.join(packagesDir, 'package-b');
      await fs.mkdir(pkgBDir, { recursive: true });

      const pkgBPackage = { name: '@monorepo/package-b', version: '3.1.0' };
      await fs.writeFile(
        path.join(pkgBDir, 'package.json'),
        JSON.stringify(pkgBPackage, null, 2)
      );

      // Create documentation with version references
      const rootReadme = `# Monorepo

This monorepo is at version v1.9.0.
Package A is at version 1.4.0.
Package B is at version 3.0.0.
`;

      await fs.writeFile(path.join(tempDir, 'README.md'), rootReadme);

      const pkgAReadme = `# Package A

This package is version v1.5.0 (should match).
Also references v1.4.5 from previous release.
`;

      await fs.writeFile(path.join(pkgADir, 'README.md'), pkgAReadme);

      // Detector should use root package.json (2.0.0) for analysis
      const mismatches = await detector.detectMismatches();

      // Should find mismatches based on root version (2.0.0)
      expect(mismatches.length).toBeGreaterThan(0);
      mismatches.forEach(mismatch => {
        expect(mismatch.expectedVersion).toBe('2.0.0');
      });

      // Should find the 1.9.0 reference in root README
      const rootMismatch = mismatches.find(m =>
        m.file === 'README.md' && m.foundVersion === '1.9.0'
      );
      expect(rootMismatch).toBeDefined();
    });

    it('should skip node_modules and other excluded directories', async () => {
      // Create package.json
      const packageJson = { name: 'test', version: '1.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create excluded directories with version references
      const excludedDirs = ['node_modules', '.git', 'dist', 'build', '.next'];

      for (const dir of excludedDirs) {
        await fs.mkdir(path.join(tempDir, dir), { recursive: true });
        await fs.writeFile(
          path.join(tempDir, dir, 'test.md'),
          'This should be ignored: version v2.0.0'
        );
      }

      // Create included file
      await fs.writeFile(
        path.join(tempDir, 'included.md'),
        'This should be found: version v0.9.0'
      );

      const mismatches = await detector.detectMismatches();

      // Should only find the included file
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0].file).toBe('included.md');
      expect(mismatches[0].foundVersion).toBe('0.9.0');
    });
  });

  describe('BaseAnalyzer Integration', () => {
    it('should implement BaseAnalyzer interface correctly', () => {
      expect(detector.type).toBe('docs');
      expect(typeof detector.analyze).toBe('function');
      expect(typeof detector.prioritize).toBe('function');
    });

    it('should return empty candidates from analyze method', () => {
      const mockAnalysis = {} as ProjectAnalysis;
      const candidates = detector.analyze(mockAnalysis);

      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates).toHaveLength(0);
    });

    it('should prioritize candidates correctly', () => {
      const candidates = [
        {
          candidateId: 'test-1',
          title: 'Low priority task',
          description: 'Low priority',
          priority: 'low' as const,
          estimatedEffort: 'low' as const,
          suggestedWorkflow: 'docs',
          rationale: 'Test',
          score: 0.3
        },
        {
          candidateId: 'test-2',
          title: 'High priority task',
          description: 'High priority',
          priority: 'high' as const,
          estimatedEffort: 'medium' as const,
          suggestedWorkflow: 'docs',
          rationale: 'Test',
          score: 0.8
        }
      ];

      const selected = detector.prioritize(candidates);
      expect(selected).toBe(candidates[1]); // Higher score
    });

    it('should return null when prioritizing empty candidates', () => {
      const selected = detector.prioritize([]);
      expect(selected).toBeNull();
    });
  });

  describe('Task Creation Integration', () => {
    it('should create comprehensive task candidates from detected mismatches', async () => {
      // Setup project with version mismatches
      const packageJson = { name: 'test', version: '2.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create multiple files with various mismatch counts
      const files = [
        { name: 'README.md', content: 'Version v1.0.0\nAlso v1.1.0' }, // 2 mismatches
        { name: 'CHANGELOG.md', content: 'v1.5.0\nv1.6.0\nv1.7.0' }, // 3 mismatches
        { name: 'docs/api.md', content: 'API version 1.8.0' } // 1 mismatch
      ];

      for (const file of files) {
        const filePath = path.join(tempDir, file.name);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content);
      }

      const mismatches = await detector.detectMismatches();
      expect(mismatches.length).toBe(6); // Total mismatches

      // Test different priority levels based on mismatch count
      const lowCountMismatches = mismatches.slice(0, 2); // 2 mismatches
      const mediumCountMismatches = mismatches.slice(0, 5); // 5 mismatches
      const highCountMismatches = Array.from({ length: 15 }, (_, i) => ({
        file: `file-${i}.md`,
        line: 1,
        foundVersion: '1.0.0',
        expectedVersion: '2.0.0',
        lineContent: 'Version v1.0.0'
      }));

      // Test low priority task
      const lowTask = detector.createVersionMismatchTask(lowCountMismatches);
      expect(lowTask).not.toBeNull();
      expect(lowTask!.priority).toBe('low');
      expect(lowTask!.estimatedEffort).toBe('low');
      expect(lowTask!.description).toContain('2 outdated version references');

      // Test normal priority task
      const mediumTask = detector.createVersionMismatchTask(mediumCountMismatches);
      expect(mediumTask).not.toBeNull();
      expect(mediumTask!.priority).toBe('normal');
      expect(mediumTask!.estimatedEffort).toBe('medium');

      // Test high priority task
      const highTask = detector.createVersionMismatchTask(highCountMismatches);
      expect(highTask).not.toBeNull();
      expect(highTask!.priority).toBe('high');
      expect(highTask!.estimatedEffort).toBe('high');
      expect(highTask!.description).toContain('15 outdated version references');
    });

    it('should handle edge cases in task creation', () => {
      // Test null for empty mismatches
      expect(detector.createVersionMismatchTask([])).toBeNull();

      // Test single mismatch
      const singleMismatch = [{
        file: 'test.md',
        line: 1,
        foundVersion: '1.0.0',
        expectedVersion: '2.0.0',
        lineContent: 'Version v1.0.0'
      }];

      const task = detector.createVersionMismatchTask(singleMismatch);
      expect(task).not.toBeNull();
      expect(task!.description).toContain('1 outdated version reference in 1 file');

      // Test multiple mismatches in same file
      const samFileMismatches = [
        {
          file: 'README.md',
          line: 1,
          foundVersion: '1.0.0',
          expectedVersion: '2.0.0',
          lineContent: 'Version v1.0.0'
        },
        {
          file: 'README.md',
          line: 5,
          foundVersion: '1.1.0',
          expectedVersion: '2.0.0',
          lineContent: 'Also version 1.1.0'
        }
      ];

      const sameFileTask = detector.createVersionMismatchTask(samFileMismatches);
      expect(sameFileTask!.description).toContain('2 outdated version references in 1 file');
    });
  });

  describe('Performance with Large Codebases', () => {
    it('should efficiently process projects with many files', async () => {
      // Setup large project simulation
      const packageJson = { name: 'large-project', version: '5.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create many files with version references
      const fileCount = 50;
      const filesPerDir = 10;

      for (let i = 0; i < fileCount; i++) {
        const dirName = `dir-${Math.floor(i / filesPerDir)}`;
        const dirPath = path.join(tempDir, 'docs', dirName);
        await fs.mkdir(dirPath, { recursive: true });

        const content = `# File ${i}

This file references version v${(i % 4) + 1}.0.0
Also mentions version ${(i % 3) + 1}.${i % 10}.0
Previous version: v${(i % 5) + 1}.${(i % 8) + 1}.${i % 5}
`;

        await fs.writeFile(path.join(dirPath, `file-${i}.md`), content);
      }

      const startTime = Date.now();
      const mismatches = await detector.detectMismatches();
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (less than 10 seconds)
      expect(duration).toBeLessThan(10000);

      // Should find many mismatches (3 per file, 50 files = 150 potential mismatches)
      // Minus any that accidentally match 5.0.0
      expect(mismatches.length).toBeGreaterThan(100);
      expect(mismatches.length).toBeLessThanOrEqual(150);

      // Verify performance characteristics
      console.log(`Processed ${fileCount} files in ${duration}ms`);
      console.log(`Found ${mismatches.length} version mismatches`);

      // Should maintain accuracy
      mismatches.forEach(mismatch => {
        expect(mismatch.expectedVersion).toBe('5.0.0');
        expect(mismatch.foundVersion).not.toBe('5.0.0');
        expect(mismatch.line).toBeGreaterThan(0);
      });
    });
  });

  describe('Cross-platform File Handling', () => {
    it('should handle different file encodings and line endings', async () => {
      const packageJson = { name: 'encoding-test', version: '1.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create files with different line endings
      const contentWithCRLF = 'Version v0.9.0\r\nAnother line\r\nVersion 0.8.0\r\n';
      const contentWithLF = 'Version v0.9.0\nAnother line\nVersion 0.8.0\n';
      const contentWithCR = 'Version v0.9.0\rAnother line\rVersion 0.8.0\r';

      await fs.writeFile(path.join(tempDir, 'crlf.md'), contentWithCRLF);
      await fs.writeFile(path.join(tempDir, 'lf.md'), contentWithLF);
      await fs.writeFile(path.join(tempDir, 'cr.md'), contentWithCR);

      const mismatches = await detector.detectMismatches();

      // Should handle all line ending types
      const crlfMismatches = mismatches.filter(m => m.file === 'crlf.md');
      const lfMismatches = mismatches.filter(m => m.file === 'lf.md');
      const crMismatches = mismatches.filter(m => m.file === 'cr.md');

      expect(crlfMismatches.length).toBe(2);
      expect(lfMismatches.length).toBe(2);
      expect(crMismatches.length).toBe(2);

      // Line numbers should be correct regardless of line ending
      crlfMismatches.forEach(mismatch => {
        expect([1, 3]).toContain(mismatch.line);
      });
    });
  });
});