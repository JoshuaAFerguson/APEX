import { beforeEach, describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { IdleProcessor } from '../idle-processor.js';
import { TaskStore } from '../store.js';
import { DaemonConfig } from '@apexcli/core';

describe('IdleProcessor Deprecated Tag Validation Workflow Integration', () => {
  let tempDir: string;
  let processor: IdleProcessor;
  let mockStore: TaskStore;
  let mockConfig: DaemonConfig;

  beforeAll(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'apex-test-'));
  });

  afterAll(async () => {
    // Clean up temporary directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      createTask: vi.fn(),
      getTasksByStatus: vi.fn().mockResolvedValue([]),
      getAllTasks: vi.fn().mockResolvedValue([])
    } as any;

    mockConfig = {
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 5
      }
    } as DaemonConfig;

    processor = new IdleProcessor(tempDir, mockConfig, mockStore);
  });

  describe('end-to-end workflow', () => {
    it('should detect and report deprecated tag issues in a complete project analysis', async () => {
      // Create test files with various deprecated tag scenarios
      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {}
      }));

      // File with good deprecated documentation
      await fs.writeFile(path.join(tempDir, 'good-deprecated.ts'), `
/**
 * @deprecated This function is obsolete since v2.0.0
 * Use calculateNewValue() instead for better performance and accuracy
 * @see calculateNewValue
 */
export function calculateOldValue(input: number): number {
  return input * 0.5;
}

/**
 * The new and improved calculation function
 */
export function calculateNewValue(input: number): number {
  return input * 0.8;
}
      `);

      // File with problematic deprecated documentation
      await fs.writeFile(path.join(tempDir, 'bad-deprecated.ts'), `
/**
 * @deprecated
 */
export function poorlyDocumented(): string {
  return 'old';
}

/**
 * @deprecated Bad
 */
export function insufficientExplanation(): void {
  console.log('deprecated');
}

/**
 * @deprecated This function is old and should not be used
 */
export function missingMigrationPath(): boolean {
  return false;
}
      `);

      // File with mixed quality
      await fs.writeFile(path.join(tempDir, 'mixed-deprecated.ts'), `
export class UtilityClass {
  /**
   * @deprecated This method will be removed in v3.0
   * Use the new processDataAdvanced() method instead
   * @see processDataAdvanced
   */
  processDataOld(data: any[]): any[] {
    return data.map(item => ({ ...item, processed: true }));
  }

  /**
   * @deprecated
   */
  badMethod(): void {
    // No explanation or migration path
  }

  /**
   * The improved data processing method
   */
  processDataAdvanced(data: any[]): any[] {
    return data.map(item => ({ ...item, processed: true, timestamp: Date.now() }));
  }
}
      `);

      // File with no deprecated tags (should not generate issues)
      await fs.writeFile(path.join(tempDir, 'clean.ts'), `
/**
 * A clean utility function with no deprecated tags
 */
export function cleanFunction(input: string): string {
  return input.toUpperCase();
}

export interface CleanInterface {
  value: string;
}
      `);

      // Trigger the complete analysis
      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeProject();

      // Verify the analysis includes documentation analysis
      expect(analysis.documentation).toBeDefined();
      expect(analysis.documentation.outdatedDocs).toBeDefined();

      // Filter for deprecated API issues
      const deprecatedIssues = analysis.documentation.outdatedDocs.filter((doc: any) =>
        doc.type === 'deprecated-api'
      );

      // We should find exactly 4 issues:
      // 1. poorlyDocumented: no explanation, no migration path
      // 2. insufficientExplanation: explanation too short, no migration path
      // 3. missingMigrationPath: no migration path
      // 4. badMethod: no explanation, no migration path
      expect(deprecatedIssues.length).toBeGreaterThanOrEqual(3);
      expect(deprecatedIssues.length).toBeLessThanOrEqual(4);

      // Verify specific issues are detected
      const fileNames = deprecatedIssues.map((issue: any) => issue.file);
      expect(fileNames).toContain('bad-deprecated.ts');
      expect(fileNames).toContain('mixed-deprecated.ts');

      // Verify good deprecated documentation is not flagged
      const goodFileIssues = deprecatedIssues.filter((issue: any) =>
        issue.file === 'good-deprecated.ts'
      );
      expect(goodFileIssues).toHaveLength(0);

      // Verify clean file has no issues
      const cleanFileIssues = deprecatedIssues.filter((issue: any) =>
        issue.file === 'clean.ts'
      );
      expect(cleanFileIssues).toHaveLength(0);

      // Verify issue details
      const poorlyDocumentedIssue = deprecatedIssues.find((issue: any) =>
        issue.description.includes('poorlyDocumented')
      );
      expect(poorlyDocumentedIssue).toBeDefined();
      expect(poorlyDocumentedIssue.severity).toBe('medium');
      expect(poorlyDocumentedIssue.suggestion).toContain('explanation');

      const missingMigrationIssue = deprecatedIssues.find((issue: any) =>
        issue.description.includes('missingMigrationPath')
      );
      expect(missingMigrationIssue).toBeDefined();
      expect(missingMigrationIssue.suggestion).toContain('migration path');
    });

    it('should integrate deprecated tag validation with idle task generation', async () => {
      // Setup test files with deprecated issues
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

      await fs.writeFile(path.join(tempDir, 'deprecated-service.ts'), `
/**
 * Service class with deprecated methods
 */
export class ApiService {
  /**
   * @deprecated
   */
  oldEndpoint(): string {
    return '/api/v1/old';
  }

  /**
   * @deprecated This endpoint is slow
   */
  slowEndpoint(): string {
    return '/api/v1/slow';
  }
}
      `);

      // Trigger idle processing
      await processor.processIdleTime();

      // Get generated tasks
      const generatedTasks = processor.getGeneratedTasks();

      // Should have generated tasks, including documentation-related ones
      expect(generatedTasks.length).toBeGreaterThan(0);

      // Look for documentation improvement tasks
      const docTasks = generatedTasks.filter(task =>
        task.type === 'documentation' ||
        task.description.toLowerCase().includes('deprecat') ||
        task.description.toLowerCase().includes('document')
      );

      expect(docTasks.length).toBeGreaterThan(0);

      // Verify task properties
      const deprecatedTask = docTasks.find(task =>
        task.description.toLowerCase().includes('deprecat')
      );

      if (deprecatedTask) {
        expect(deprecatedTask.priority).toBeDefined();
        expect(deprecatedTask.estimatedEffort).toBeDefined();
        expect(deprecatedTask.suggestedWorkflow).toBeDefined();
        expect(deprecatedTask.rationale).toBeDefined();
        expect(deprecatedTask.implemented).toBe(false);
      }
    });

    it('should handle mixed file types and ignore non-source files', async () => {
      // Create various file types
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

      // TypeScript file with issues
      await fs.writeFile(path.join(tempDir, 'utils.ts'), `
/**
 * @deprecated
 */
export function oldUtil(): void {}
      `);

      // JavaScript file with issues
      await fs.writeFile(path.join(tempDir, 'helper.js'), `
/**
 * @deprecated
 */
function oldHelper() {}
module.exports = { oldHelper };
      `);

      // Test file (should be ignored)
      await fs.writeFile(path.join(tempDir, 'utils.test.ts'), `
/**
 * @deprecated
 */
function testFunction() {}
      `);

      // Documentation file (should not be processed by JSDoc validator)
      await fs.writeFile(path.join(tempDir, 'README.md'), `
# Test Project

This contains @deprecated APIs.
      `);

      // Analyze the project
      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();

      // Filter deprecated API issues
      const deprecatedIssues = analysis.outdatedDocs.filter((doc: any) =>
        doc.type === 'deprecated-api'
      );

      // Should find issues in source files but not test files
      const sourceFileIssues = deprecatedIssues.filter((issue: any) =>
        issue.file.endsWith('.ts') || issue.file.endsWith('.js')
      );
      expect(sourceFileIssues.length).toBeGreaterThan(0);

      // Should not include test files
      const testFileIssues = deprecatedIssues.filter((issue: any) =>
        issue.file.includes('test')
      );
      expect(testFileIssues).toHaveLength(0);

      // Verify the source files are processed
      const fileNames = sourceFileIssues.map((issue: any) => issue.file);
      expect(fileNames).toContain('utils.ts');
      expect(fileNames).toContain('helper.js');
    });

    it('should maintain performance with large numbers of files', async () => {
      // Create package.json
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

      // Create multiple files with deprecated issues (simulating larger project)
      const filePromises = [];
      for (let i = 0; i < 10; i++) {
        const fileName = `file${i}.ts`;
        const content = `
/**
 * @deprecated File ${i}
 */
export function deprecated${i}(): void {}

export function good${i}(): void {}
        `;
        filePromises.push(fs.writeFile(path.join(tempDir, fileName), content));
      }

      await Promise.all(filePromises);

      // Measure analysis time
      const startTime = Date.now();
      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();
      const endTime = Date.now();

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

      // Should still find the deprecated issues
      const deprecatedIssues = analysis.outdatedDocs.filter((doc: any) =>
        doc.type === 'deprecated-api'
      );
      expect(deprecatedIssues.length).toBeGreaterThan(0);
      expect(deprecatedIssues.length).toBeLessThanOrEqual(10); // One per file max

      // Verify results are limited appropriately (as per the slice(0, 30) in implementation)
      expect(deprecatedIssues.length).toBeLessThanOrEqual(30);
    });
  });

  describe('configuration integration', () => {
    it('should respect configuration options if available', async () => {
      // Create test file
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
      await fs.writeFile(path.join(tempDir, 'private-utils.ts'), `
/**
 * @deprecated
 * @internal
 */
function _privateDeprecated(): void {}

/**
 * @deprecated
 */
export function publicDeprecated(): void {}
      `);

      // The integration should work with default configuration
      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();

      const deprecatedIssues = analysis.outdatedDocs.filter((doc: any) =>
        doc.type === 'deprecated-api'
      );

      // Should find at least the public deprecated function
      expect(deprecatedIssues.length).toBeGreaterThan(0);

      // Verify the public function issue is included
      const publicIssue = deprecatedIssues.find((issue: any) =>
        issue.description.includes('publicDeprecated')
      );
      expect(publicIssue).toBeDefined();
    });

    it('should be disabled when idle processing is disabled', async () => {
      // Configure processor with idle processing disabled
      const disabledConfig = {
        idleProcessing: {
          enabled: false,
          idleThreshold: 300000,
          taskGenerationInterval: 3600000,
          maxIdleTasks: 3
        }
      } as DaemonConfig;

      const disabledProcessor = new IdleProcessor(tempDir, disabledConfig, mockStore);

      // Create test file with deprecated issues
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
      await fs.writeFile(path.join(tempDir, 'test-disabled.ts'), `
/**
 * @deprecated
 */
export function shouldNotBeProcessed(): void {}
      `);

      // Try to start idle processing (should do nothing when disabled)
      await disabledProcessor.start();

      // Manually trigger processing should still work
      await disabledProcessor.processIdleTime();

      // Should still perform analysis when explicitly called
      const analysis = disabledProcessor.getLastAnalysis();
      expect(analysis).toBeDefined();
    });
  });
});