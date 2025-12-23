/**
 * End-to-End Tests for VersionMismatchDetector Integration
 *
 * These tests verify the complete workflow from project analysis through
 * task generation and implementation, ensuring the version mismatch detection
 * is properly integrated into the full APEX workflow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor } from './idle-processor.js';
import { IdleTaskGenerator } from './idle-task-generator.js';
import type { DaemonConfig } from '@apexcli/core';
import { TaskStore } from './store.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('VersionMismatchDetector End-to-End Integration', () => {
  let idleProcessor: IdleProcessor;
  let mockTaskStore: TaskStore;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(process.cwd(), 'test-temp-e2e-' + Math.random().toString(36).substring(7));
    await fs.mkdir(tempDir, { recursive: true });

    // Mock TaskStore with realistic behavior
    const mockTasks = new Map();
    let taskIdCounter = 1;

    mockTaskStore = {
      createTask: vi.fn().mockImplementation(async (request) => {
        const task = {
          id: `task-${taskIdCounter++}`,
          ...request,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        mockTasks.set(task.id, task);
        return task;
      }),
      getTasksByStatus: vi.fn().mockImplementation(async (status) => {
        return Array.from(mockTasks.values()).filter((task: any) => task.status === status);
      }),
      getAllTasks: vi.fn().mockImplementation(async () => {
        return Array.from(mockTasks.values()).sort((a: any, b: any) =>
          b.createdAt.getTime() - a.createdAt.getTime()
        );
      })
    } as any;

    // Create comprehensive daemon config
    const config: DaemonConfig = {
      enabled: true,
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 5,
        strategyWeights: {
          maintenance: 0.3,
          refactoring: 0.2,
          documentation: 0.4, // Higher weight for documentation tasks
          testing: 0.1
        }
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

  describe('Complete Workflow Integration', () => {
    it('should detect version mismatches and generate actionable tasks through full workflow', async () => {
      // Setup realistic project with version mismatches
      const packageJson = {
        name: 'my-awesome-project',
        version: '2.1.0',
        description: 'An awesome project with outdated documentation',
        scripts: {
          start: 'node server.js',
          test: 'jest',
          build: 'webpack'
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create comprehensive documentation with multiple version mismatches
      const readmeContent = `# My Awesome Project

Welcome to version v2.0.0 of our awesome project!

## Quick Start

\`\`\`bash
npm install my-awesome-project@2.0.5
\`\`\`

## Current Features

- Feature A (since v1.9.0)
- Feature B (since version 2.0.0)
- Feature C (added in v2.0.1)

## API Reference

Current API version: 2.0.0
Minimum supported: v1.8.0

## Migration Guide

Upgrading from version 1.x.x to 2.0.0:
- Update your code
- Run migration scripts

## Changelog

See CHANGELOG.md for version history.
`;

      await fs.writeFile(path.join(tempDir, 'README.md'), readmeContent);

      // Create API documentation
      const docsDir = path.join(tempDir, 'docs');
      await fs.mkdir(docsDir, { recursive: true });

      const apiContent = `# API Documentation

## Authentication

* @version 2.0.0
* @since 1.5.0

### Login

Current implementation: v2.0.5
Supports: version 2.0.0 and above

## Rate Limiting

* @version 1.9.0
* Updated in: v2.0.1

Current limits: as of version 2.0.0
`;

      await fs.writeFile(path.join(docsDir, 'api.md'), apiContent);

      // Create source files with JSDoc version references
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mainTsContent = `/**
 * Main application module
 * @version 2.0.0
 * @author Development Team
 * @since 1.0.0
 */

export class Application {
  /**
   * Application version
   * @version 2.0.1
   */
  public static readonly VERSION = 'v2.0.0';

  /**
   * Initialize application
   * @returns Promise<void>
   * @since version 1.5.0
   */
  async initialize(): Promise<void> {
    console.log('Starting application version 2.0.0');
  }
}
`;

      await fs.writeFile(path.join(srcDir, 'main.ts'), mainTsContent);

      // Mock execAsync to provide realistic shell command responses
      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        // Console logs for debugging
        if (command.includes('find . -type f')) {
          // Codebase size analysis
          const files = ['./src/main.ts', './README.md', './docs/api.md'];
          return Promise.resolve({ stdout: files.join('\n') });
        }
        if (command.includes('find . -name "*.test.*"')) {
          // Test coverage analysis
          return Promise.resolve({ stdout: './src/main.test.ts' });
        }
        if (command.includes('find . -name "*.md"')) {
          // Documentation analysis
          return Promise.resolve({ stdout: './README.md\n./docs/api.md' });
        }
        if (command.includes('find . -name "*.ts"')) {
          // Source file analysis
          return Promise.resolve({ stdout: './src/main.ts' });
        }
        if (command.includes('npm audit')) {
          // Security analysis
          return Promise.resolve({ stdout: '{}' });
        }
        if (command.includes('eslint')) {
          // Linting
          return Promise.resolve({ stdout: '[]' });
        }
        if (command.includes('wc -l')) {
          // Line counts
          return Promise.resolve({ stdout: '50' });
        }
        if (command.includes('grep')) {
          // Various grep operations
          return Promise.resolve({ stdout: '' });
        }
        // Default empty response
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      // Execute the complete idle processing workflow
      await processor.processIdleTime();

      // Get the analysis results
      const analysis = processor.getLastAnalysis();
      expect(analysis).toBeDefined();

      // Verify version mismatches were detected in documentation analysis
      expect(analysis.documentation.outdatedDocs.length).toBeGreaterThan(0);

      const versionMismatches = analysis.documentation.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );

      expect(versionMismatches.length).toBeGreaterThan(5); // Multiple version mismatches

      // Verify severity distribution
      const severities = versionMismatches.map((doc: any) => doc.severity);
      expect(severities).toContain('medium'); // Minor version differences
      expect(severities).toContain('low'); // Patch version differences

      // Get generated tasks
      const generatedTasks = processor.getGeneratedTasks();
      expect(generatedTasks.length).toBeGreaterThan(0);

      // Find version mismatch related tasks
      const versionTasks = generatedTasks.filter((task: any) =>
        task.title.toLowerCase().includes('version') ||
        task.description.toLowerCase().includes('version') ||
        task.description.toLowerCase().includes('outdated')
      );

      expect(versionTasks.length).toBeGreaterThan(0);

      // Verify task properties
      const versionTask = versionTasks[0];
      expect(versionTask).toMatchObject({
        type: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        priority: expect.any(String),
        estimatedEffort: expect.any(String),
        suggestedWorkflow: expect.any(String),
        rationale: expect.any(String),
        implemented: false
      });

      expect(['low', 'medium', 'high']).toContain(versionTask.estimatedEffort);
      expect(['low', 'normal', 'high', 'critical']).toContain(versionTask.priority);
    });

    it('should implement version mismatch tasks and create real tasks in store', async () => {
      // Setup project with version mismatches
      const packageJson = { name: 'test-project', version: '3.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const docContent = `# Test Project

Current version: v2.5.0
Previous version: v2.4.0
Initial version: v1.0.0
`;

      await fs.writeFile(path.join(tempDir, 'README.md'), docContent);

      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './README.md' });
        }
        return Promise.resolve({ stdout: '' });
      });

      // Process and generate tasks
      await processor.processIdleTime();
      const generatedTasks = processor.getGeneratedTasks();

      // Find a task to implement
      const taskToImplement = generatedTasks.find((task: any) =>
        task.description.toLowerCase().includes('version')
      );

      expect(taskToImplement).toBeDefined();

      // Implement the task
      const implementedTaskId = await processor.implementIdleTask(taskToImplement.id);

      expect(implementedTaskId).toBeTruthy();
      expect(mockTaskStore.createTask).toHaveBeenCalled();

      // Verify the created task
      const createTaskCall = (mockTaskStore.createTask as any).mock.calls[0][0];
      expect(createTaskCall).toMatchObject({
        description: expect.any(String),
        acceptanceCriteria: expect.any(String),
        workflow: expect.any(String),
        priority: expect.any(String),
        projectPath: tempDir
      });

      expect(createTaskCall.acceptanceCriteria).toContain(taskToImplement.title);
      expect(createTaskCall.description).toBe(taskToImplement.description);

      // Verify task is marked as implemented
      const updatedGeneratedTasks = processor.getGeneratedTasks();
      const implementedTask = updatedGeneratedTasks.find((task: any) => task.id === taskToImplement.id);
      expect(implementedTask.implemented).toBe(true);

      // Verify we can't implement the same task twice
      await expect(
        processor.implementIdleTask(taskToImplement.id)
      ).rejects.toThrow('has already been implemented');
    });

    it('should handle task generation with different project sizes and complexities', async () => {
      // Test small project
      const smallPackageJson = { name: 'small-project', version: '1.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(smallPackageJson, null, 2)
      );

      await fs.writeFile(
        path.join(tempDir, 'README.md'),
        'Simple project with version v0.9.0'
      );

      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './README.md' });
        }
        if (command.includes('wc -l')) {
          return Promise.resolve({ stdout: '1' }); // Small project
        }
        return Promise.resolve({ stdout: '' });
      });

      await processor.processIdleTime();
      const smallProjectTasks = processor.getGeneratedTasks();

      // Now test large project by updating the same directory
      await fs.rm(path.join(tempDir, 'README.md'));

      const largePackageJson = { name: 'large-project', version: '5.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(largePackageJson, null, 2)
      );

      // Create multiple documentation files
      const docFiles = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'API.md', 'GUIDE.md'];

      for (const [index, fileName] of docFiles.entries()) {
        const content = `# ${fileName}

This is version v4.${index}.0
Previous version: v4.${index - 1 >= 0 ? index - 1 : 0}.0
Legacy version: v3.${index}.0
Historical: v2.${index}.0
Initial: v1.0.0
`;
        await fs.writeFile(path.join(tempDir, fileName), content);
      }

      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: docFiles.map(f => `./${f}`).join('\n') });
        }
        if (command.includes('wc -l')) {
          return Promise.resolve({ stdout: '500' }); // Large project
        }
        return Promise.resolve({ stdout: '' });
      });

      // Reset task generator to get fresh results
      const taskGenerator = (processor as any).taskGenerator;
      taskGenerator.reset();

      await processor.processIdleTime();
      const largeProjectTasks = processor.getGeneratedTasks();

      // Large project should generate more tasks due to more issues
      expect(largeProjectTasks.length).toBeGreaterThanOrEqual(smallProjectTasks.length);

      // Large project tasks might have higher priority due to more issues
      const hasHighPriorityTasks = largeProjectTasks.some((task: any) =>
        ['high', 'critical'].includes(task.priority)
      );

      // Should have some documentation-related tasks due to version mismatches
      const hasDocumentationTasks = largeProjectTasks.some((task: any) =>
        task.type === 'documentation' ||
        task.suggestedWorkflow.includes('documentation') ||
        task.description.toLowerCase().includes('documentation') ||
        task.description.toLowerCase().includes('version')
      );

      expect(hasDocumentationTasks).toBe(true);
    });
  });

  describe('Task Generation Strategy Integration', () => {
    it('should prioritize version mismatch tasks based on strategy weights', async () => {
      // Create config with high documentation weight
      const docFocusedConfig: DaemonConfig = {
        enabled: true,
        idleProcessing: {
          enabled: true,
          maxIdleTasks: 3,
          strategyWeights: {
            maintenance: 0.1,
            refactoring: 0.1,
            documentation: 0.7, // Very high weight for documentation
            testing: 0.1
          }
        }
      };

      const docFocusedProcessor = new IdleProcessor(tempDir, docFocusedConfig, mockTaskStore);

      // Setup project with both version mismatches and other issues
      const packageJson = { name: 'doc-focused', version: '2.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create documentation with version issues
      const docContent = `# Documentation

Version v1.5.0 documentation
API version: 1.8.0
Legacy version 1.3.0
`;

      await fs.writeFile(path.join(tempDir, 'README.md'), docContent);

      // Create source file with potential refactoring issues
      const srcContent = `
function veryLongFunctionNameThatDoesLotsOfThings() {
  // TODO: Refactor this complex function
  for (let i = 0; i < 100; i++) {
    for (let j = 0; j < 100; j++) {
      // Nested loops indicating complexity
      console.log('Complex logic');
    }
  }
}
`.repeat(20); // Make it a large file

      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'complex.js'), srcContent);

      const processor = docFocusedProcessor as any;
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './README.md' });
        }
        if (command.includes('find . -name "*.js"') && command.includes('wc -l')) {
          return Promise.resolve({ stdout: '500\t./src/complex.js' }); // Large file
        }
        if (command.includes('grep -r "TODO\\|FIXME"')) {
          return Promise.resolve({ stdout: './src/complex.js:2: // TODO: Refactor this complex function' });
        }
        return Promise.resolve({ stdout: '' });
      });

      await processor.processIdleTime();
      const tasks = processor.getGeneratedTasks();

      expect(tasks.length).toBeGreaterThan(0);

      // With high documentation weight, should prioritize documentation tasks
      const documentationTasks = tasks.filter((task: any) =>
        task.type === 'documentation' ||
        task.suggestedWorkflow === 'documentation' ||
        task.description.toLowerCase().includes('version') ||
        task.description.toLowerCase().includes('documentation')
      );

      // Should have documentation-focused tasks due to high weight
      expect(documentationTasks.length).toBeGreaterThan(0);
    });

    it('should handle multiple idle task generation cycles correctly', async () => {
      const packageJson = { name: 'cycling-test', version: '1.5.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const docContent = `# Test

Version v1.0.0 content
Also version v1.2.0
`;

      await fs.writeFile(path.join(tempDir, 'README.md'), docContent);

      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './README.md' });
        }
        return Promise.resolve({ stdout: '' });
      });

      // First cycle
      await processor.processIdleTime();
      const firstCycleTasks = processor.getGeneratedTasks();

      // Generate more tasks (simulating periodic generation)
      await processor.generateImprovementTasks();
      const secondCycleTasks = processor.getGeneratedTasks();

      // Should not duplicate tasks across cycles
      const taskTitles = secondCycleTasks.map((task: any) => task.title);
      const uniqueTitles = new Set(taskTitles);
      expect(uniqueTitles.size).toBe(taskTitles.length);

      // Should respect maxIdleTasks limit
      const maxTasks = processor.config.idleProcessing?.maxIdleTasks || 3;
      expect(secondCycleTasks.length).toBeLessThanOrEqual(maxTasks);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should gracefully handle partial failures in version detection', async () => {
      const packageJson = { name: 'resilient-test', version: '2.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await fs.writeFile(path.join(tempDir, 'valid.md'), 'Version v1.0.0');

      // Create an unreadable file (simulate permission issues)
      await fs.writeFile(path.join(tempDir, 'problem.md'), 'Version v1.5.0');

      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockImplementation((command: string) => {
        if (command.includes('find . -name "*.md"')) {
          return Promise.resolve({ stdout: './valid.md\n./problem.md' });
        }
        return Promise.resolve({ stdout: '' });
      });

      // Mock file system read to fail for problem.md
      const originalReadFile = fs.readFile;
      vi.spyOn(fs, 'readFile').mockImplementation((filePath, options) => {
        if (filePath.toString().includes('problem.md')) {
          return Promise.reject(new Error('Permission denied'));
        }
        return originalReadFile(filePath, options);
      });

      // Should not throw error despite file read failure
      await expect(processor.processIdleTime()).resolves.not.toThrow();

      const analysis = processor.getLastAnalysis();
      expect(analysis).toBeDefined();

      // Should still process the valid file
      const versionMismatches = analysis.documentation.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );

      expect(versionMismatches.length).toBeGreaterThan(0);
      const validFileMismatch = versionMismatches.find((doc: any) => doc.file === 'valid.md');
      expect(validFileMismatch).toBeDefined();

      // Restore original implementation
      vi.restoreAllMocks();
    });

    it('should handle missing VersionMismatchDetector module gracefully', async () => {
      const packageJson = { name: 'missing-module-test', version: '1.0.0' };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await fs.writeFile(path.join(tempDir, 'README.md'), 'Version v0.9.0');

      const processor = idleProcessor as any;
      processor.execAsync = vi.fn().mockResolvedValue({ stdout: './README.md' });

      // Mock the import to fail
      processor.findVersionMismatches = vi.fn().mockImplementation(async () => {
        throw new Error('Cannot resolve module version-mismatch-detector');
      });

      // Should complete analysis without version mismatches
      await processor.processIdleTime();

      const analysis = processor.getLastAnalysis();
      expect(analysis).toBeDefined();

      // Should have documentation analysis but no version mismatches
      expect(analysis.documentation).toBeDefined();
      const versionMismatches = analysis.documentation.outdatedDocs.filter(
        (doc: any) => doc.type === 'version-mismatch'
      );
      expect(versionMismatches).toHaveLength(0);

      // Should still generate other types of tasks
      const tasks = processor.getGeneratedTasks();
      expect(Array.isArray(tasks)).toBe(true);
    });
  });
});