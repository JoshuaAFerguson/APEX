/**
 * Comprehensive Integration Tests for VersionMismatchDetector in IdleProcessor
 *
 * These tests verify the complete integration of VersionMismatchDetector into
 * IdleProcessor's documentation analysis workflow, testing all edge cases,
 * error scenarios, and integration paths.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor } from './idle-processor.js';
import type { DaemonConfig } from '@apexcli/core';
import { TaskStore } from './store.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('IdleProcessor - VersionMismatchDetector Comprehensive Integration', () => {
  let idleProcessor: IdleProcessor;
  let mockTaskStore: TaskStore;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(process.cwd(), 'test-temp-integration-' + Math.random().toString(36).substring(7));
    await fs.mkdir(tempDir, { recursive: true });

    // Mock TaskStore
    mockTaskStore = {
      createTask: vi.fn(),
      getTasksByStatus: vi.fn().mockResolvedValue([]),
      getAllTasks: vi.fn().mockResolvedValue([])
    } as any;

    // Create comprehensive daemon config
    const config: DaemonConfig = {
      enabled: true,
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3
      },
      documentation: {
        outdatedDocs: {
          staleCommentThreshold: 30,
          gitBlameEnabled: true
        }
      }
    };

    idleProcessor = new IdleProcessor(tempDir, config, mockTaskStore);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    vi.clearAllMocks();
  });

  describe('Full Integration with Real File System', () => {
    it('should integrate version mismatch detection into full documentation analysis', async () => {
      // Setup realistic project structure
      const packageJson = {
        name: 'test-project',
        version: '2.1.0',
        description: 'Test project for version mismatch detection'
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create documentation with version mismatches
      const readmeContent = `# Test Project

This project is currently at version v2.0.0 (should be 2.1.0).

## Installation

Install version 1.5.0 using npm.

## API Documentation

* @version 2.0.1
* Current stable: v2.0.0

The latest features are available in version 2.0.0.
`;

      await fs.writeFile(path.join(tempDir, 'README.md'), readmeContent);

      // Create source file with JSDoc version references
      const srcContent = `/**
 * Main application class
 * @version 1.9.0
 * @since 1.0.0
 */
export class App {
  /**
   * Get version info
   * Current version: v2.0.0
   */
  getVersion() {
    return 'v2.0.0';
  }
}
`;

      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'app.ts'), srcContent);

      // Mock file system operations that IdleProcessor uses
      const processor = idleProcessor as any;

      // Mock execAsync to simulate shell commands
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './README.md' });
        }
        if (command.includes('find . -name "*.ts"')) {
          return Promise.resolve({ stdout: './src/app.ts' });
        }
        if (command.includes('wc -l')) {
          return Promise.resolve({ stdout: '2' });
        }
        if (command.includes('grep')) {
          return Promise.resolve({ stdout: '' });
        }
        return Promise.resolve({ stdout: '' });
      });

      // Run the full documentation analysis
      const analysis = await processor.analyzeDocumentation();

      // Verify version mismatches are detected and included
      expect(analysis.outdatedDocs).toBeDefined();
      const versionMismatches = analysis.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );

      expect(versionMismatches.length).toBeGreaterThan(0);

      // Check that specific mismatches are found
      const readmeMismatches = versionMismatches.filter((doc: any) => doc.file === 'README.md');
      const srcMismatches = versionMismatches.filter((doc: any) => doc.file === 'src/app.ts');

      expect(readmeMismatches.length).toBeGreaterThan(0);
      expect(srcMismatches.length).toBeGreaterThan(0);

      // Verify severity calculation
      const highSeverity = versionMismatches.filter((doc: any) => doc.severity === 'high');
      const mediumSeverity = versionMismatches.filter((doc: any) => doc.severity === 'medium');
      const lowSeverity = versionMismatches.filter((doc: any) => doc.severity === 'low');

      expect(highSeverity.length + mediumSeverity.length + lowSeverity.length).toBe(versionMismatches.length);
    });

    it('should handle projects without package.json gracefully', async () => {
      // No package.json created - should not crash
      const processor = idleProcessor as any;

      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './README.md' });
        }
        return Promise.resolve({ stdout: '' });
      });

      await fs.writeFile(
        path.join(tempDir, 'README.md'),
        'This project has version v1.0.0'
      );

      const analysis = await processor.analyzeDocumentation();

      // Should not include version mismatches when no package.json exists
      const versionMismatches = analysis.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );

      expect(versionMismatches).toHaveLength(0);
    });

    it('should handle invalid package.json gracefully', async () => {
      // Create invalid package.json
      await fs.writeFile(path.join(tempDir, 'package.json'), 'invalid json content');

      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockResolvedValue({ stdout: '' });

      const analysis = await processor.analyzeDocumentation();

      const versionMismatches = analysis.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );

      expect(versionMismatches).toHaveLength(0);
    });
  });

  describe('Version Mismatch Severity Calculation', () => {
    it('should correctly categorize different version mismatches by severity', async () => {
      const packageJson = { name: 'test', version: '3.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const testCases = `# Version Test Cases

Major version difference (high): v1.0.0
Another major difference (high): v2.5.3
Minor version difference (medium): v3.1.0
Another minor difference (medium): v3.2.1
Patch version difference (low): v3.0.1
Another patch difference (low): v3.0.5
Matching version (ignored): v3.0.0
`;

      await fs.writeFile(path.join(tempDir, 'versions.md'), testCases);

      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './versions.md' });
        }
        return Promise.resolve({ stdout: '' });
      });

      const analysis = await processor.analyzeDocumentation();
      const versionMismatches = analysis.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );

      // Should find all mismatches except the matching version
      expect(versionMismatches).toHaveLength(6);

      const bySeverity = {
        high: versionMismatches.filter((doc: any) => doc.severity === 'high'),
        medium: versionMismatches.filter((doc: any) => doc.severity === 'medium'),
        low: versionMismatches.filter((doc: any) => doc.severity === 'low')
      };

      expect(bySeverity.high).toHaveLength(2); // 1.0.0 and 2.5.3
      expect(bySeverity.medium).toHaveLength(2); // 3.1.0 and 3.2.1
      expect(bySeverity.low).toHaveLength(2); // 3.0.1 and 3.0.5
    });

    it('should handle unparseable version strings with medium severity', async () => {
      const packageJson = { name: 'test', version: '2.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const testCases = `# Edge Case Versions

Invalid version: vInvalid
Another invalid: version abc
Partial version: v1.0
Empty version: v
Complex version: v2.0.0-alpha.beta.1+build.123
`;

      await fs.writeFile(path.join(tempDir, 'edge-cases.md'), testCases);

      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './edge-cases.md' });
        }
        return Promise.resolve({ stdout: '' });
      });

      const analysis = await processor.analyzeDocumentation();
      const versionMismatches = analysis.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );

      // Should handle edge cases gracefully
      expect(versionMismatches.length).toBeGreaterThan(0);

      // Complex semver should be properly detected
      const complexVersion = versionMismatches.find((doc: any) =>
        doc.description.includes('2.0.0-alpha.beta.1+build.123')
      );
      expect(complexVersion).toBeDefined();
      expect(complexVersion.severity).toBe('high'); // Major version difference
    });
  });

  describe('Integration with Other Documentation Analysis', () => {
    it('should merge version mismatches with stale comments and other outdated docs', async () => {
      const packageJson = { name: 'test', version: '2.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const docContent = `# Documentation

Version reference: v1.0.0

This contains @deprecated API calls.
Also has http://broken-link-404.com
`;

      await fs.writeFile(path.join(tempDir, 'docs.md'), docContent);

      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './docs.md' });
        }
        return Promise.resolve({ stdout: '' });
      });

      // Mock stale comment detector to return empty (to isolate version mismatch testing)
      vi.doMock('./stale-comment-detector', () => ({
        StaleCommentDetector: vi.fn(() => ({
          findStaleComments: vi.fn().mockResolvedValue([])
        }))
      }));

      const analysis = await processor.analyzeDocumentation();

      // Should have multiple types of outdated docs
      const outdatedDocs = analysis.outdatedDocs;

      // Check for version mismatch
      const versionMismatches = outdatedDocs.filter((doc: any) => doc.type === 'version-mismatch');
      expect(versionMismatches).toHaveLength(1);

      // Check for deprecated API references
      const deprecatedRefs = outdatedDocs.filter((doc: any) => doc.type === 'deprecated-api');
      expect(deprecatedRefs).toHaveLength(1);

      // Check for broken links
      const brokenLinks = outdatedDocs.filter((doc: any) => doc.type === 'broken-link');
      expect(brokenLinks).toHaveLength(1);

      // Verify they're all in the same array
      expect(outdatedDocs.length).toBe(versionMismatches.length + deprecatedRefs.length + brokenLinks.length);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle VersionMismatchDetector import failures gracefully', async () => {
      const processor = idleProcessor as any;

      // Mock the dynamic import to fail
      const originalImport = processor.findVersionMismatches;
      processor.findVersionMismatches = vi.fn().mockImplementation(async () => {
        // Simulate import failure
        throw new Error('Module not found: version-mismatch-detector');
      });

      processor.execAsync = vi.fn().mockResolvedValue({ stdout: '' });

      // Should not throw error, should return empty array
      const result = await processor.findVersionMismatches();
      expect(result).toEqual([]);
    });

    it('should handle VersionMismatchDetector detectMismatches failures gracefully', async () => {
      const processor = idleProcessor as any;

      // Mock detector that throws during detection
      const mockDetector = {
        detectMismatches: vi.fn().mockRejectedValue(new Error('Detection failed'))
      };

      vi.doMock('./analyzers/version-mismatch-detector.js', () => ({
        VersionMismatchDetector: vi.fn(() => mockDetector)
      }));

      const result = await processor.findVersionMismatches();
      expect(result).toEqual([]);
    });

    it('should handle file system permission errors during analysis', async () => {
      const packageJson = { name: 'test', version: '2.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const processor = idleProcessor as any;

      // Mock detector that returns empty results due to file system issues
      const mockDetector = {
        detectMismatches: vi.fn().mockResolvedValue([])
      };

      vi.doMock('./analyzers/version-mismatch-detector.js', () => ({
        VersionMismatchDetector: vi.fn(() => mockDetector)
      }));

      processor.execAsync = vi.fn().mockResolvedValue({ stdout: '' });

      const analysis = await processor.analyzeDocumentation();

      // Should complete successfully even with file system issues
      expect(analysis).toBeDefined();
      expect(analysis.outdatedDocs).toEqual([]);
    });

    it('should handle missing project path in detector gracefully', async () => {
      // Create processor with invalid path
      const invalidProcessor = new IdleProcessor('', mockTaskStore);
      const processor = invalidProcessor as any;

      processor.execAsync = vi.fn().mockResolvedValue({ stdout: '' });

      // Should handle gracefully and not throw
      const result = await processor.findVersionMismatches();
      expect(result).toEqual([]);
    });
  });

  describe('Performance and Large Projects', () => {
    it('should handle projects with many version references efficiently', async () => {
      const packageJson = { name: 'test', version: '5.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create multiple files with many version references
      for (let i = 0; i < 5; i++) {
        const content = Array.from({ length: 20 }, (_, j) =>
          `Line ${j}: This refers to version v${i}.${j}.0`
        ).join('\n');

        await fs.writeFile(path.join(tempDir, `doc-${i}.md`), content);
      }

      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          const files = Array.from({ length: 5 }, (_, i) => `./doc-${i}.md`);
          return Promise.resolve({ stdout: files.join('\n') });
        }
        return Promise.resolve({ stdout: '' });
      });

      const startTime = Date.now();
      const analysis = await processor.analyzeDocumentation();
      const endTime = Date.now();

      // Should complete in reasonable time (less than 5 seconds for test)
      expect(endTime - startTime).toBeLessThan(5000);

      // Should detect many version mismatches
      const versionMismatches = analysis.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );

      expect(versionMismatches.length).toBeGreaterThan(50);
    });

    it('should handle nested directory structures with version references', async () => {
      const packageJson = { name: 'test', version: '3.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create nested directory structure
      const nestedDirs = ['docs/api', 'docs/guides', 'src/components', 'tests/integration'];

      for (const dir of nestedDirs) {
        await fs.mkdir(path.join(tempDir, dir), { recursive: true });
        await fs.writeFile(
          path.join(tempDir, dir, 'file.md'),
          `This file references version v2.0.0`
        );
      }

      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          const files = nestedDirs.map(dir => `./${dir}/file.md`);
          return Promise.resolve({ stdout: files.join('\n') });
        }
        return Promise.resolve({ stdout: '' });
      });

      const analysis = await processor.analyzeDocumentation();
      const versionMismatches = analysis.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );

      // Should detect version mismatches in all nested files
      expect(versionMismatches).toHaveLength(nestedDirs.length);

      // Verify each nested directory is represented
      nestedDirs.forEach(dir => {
        const found = versionMismatches.some((doc: any) => doc.file.includes(dir));
        expect(found).toBe(true);
      });
    });
  });

  describe('Configuration and Customization', () => {
    it('should respect documentation configuration if provided', async () => {
      // Test with custom configuration
      const customConfig: DaemonConfig = {
        enabled: true,
        idleProcessing: { enabled: true },
        documentation: {
          outdatedDocs: {
            staleCommentThreshold: 60, // Custom threshold
            gitBlameEnabled: false     // Disabled git blame
          }
        }
      };

      const customProcessor = new IdleProcessor(tempDir, customConfig, mockTaskStore);
      const processor = customProcessor as any;

      const packageJson = { name: 'test', version: '2.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await fs.writeFile(
        path.join(tempDir, 'README.md'),
        'Version reference: v1.0.0'
      );

      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './README.md' });
        }
        return Promise.resolve({ stdout: '' });
      });

      const analysis = await processor.analyzeDocumentation();

      // Should still detect version mismatches regardless of other config
      const versionMismatches = analysis.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );

      expect(versionMismatches).toHaveLength(1);
    });

    it('should work when documentation config is not provided', async () => {
      // Test with minimal config (no documentation section)
      const minimalConfig: DaemonConfig = {
        enabled: true,
        idleProcessing: { enabled: true }
      };

      const minimalProcessor = new IdleProcessor(tempDir, minimalConfig, mockTaskStore);
      const processor = minimalProcessor as any;

      const packageJson = { name: 'test', version: '2.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await fs.writeFile(
        path.join(tempDir, 'README.md'),
        'Version reference: v1.5.0'
      );

      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './README.md' });
        }
        return Promise.resolve({ stdout: '' });
      });

      const analysis = await processor.analyzeDocumentation();

      // Should still work with default configuration
      const versionMismatches = analysis.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );

      expect(versionMismatches).toHaveLength(1);
      expect(versionMismatches[0].severity).toBe('medium'); // Minor version difference
    });
  });
});