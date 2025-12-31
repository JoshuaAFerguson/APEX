/**
 * @fileoverview Integration tests for GlobTool with tool registry
 *
 * These tests verify the integration of the GlobTool with:
 * - Tool registry registration and discovery
 * - Schema validation with the Claude Agent SDK
 * - Cross-tool interactions and consistency
 * - Tool lifecycle management
 *
 * @module @apex/core/tools/filesystem/__tests__/glob-tool.integration
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { GlobTool, type GlobToolInput, type GlobToolOutput } from '../glob-tool.js';
import { getToolRegistry, ToolRegistry } from '../../tool-registry.js';
import { registerGlobTool, createGlobTool, registerFilesystemTools } from '../register.js';
import { ReadTool } from '../read-tool.js';
import { WriteTool } from '../write-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a temporary directory for integration tests
 */
async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'apex-glob-integration-test-'));
}

/**
 * Creates a test file with specified content
 */
async function createTestFile(dir: string, filePath: string, content: string = 'test content'): Promise<string> {
  const fullPath = path.join(dir, filePath);
  const fileDir = path.dirname(fullPath);

  // Ensure directory exists
  await fs.mkdir(fileDir, { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');
  return fullPath;
}

/**
 * Removes a directory and all its contents
 */
async function removeDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors during cleanup
  }
}

/**
 * Creates a complex test project structure for integration testing
 */
async function createComplexTestStructure(baseDir: string): Promise<void> {
  const files = {
    // Root files
    'package.json': JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      scripts: { test: 'vitest', build: 'tsc' },
      dependencies: { typescript: '^5.0.0' }
    }, null, 2),
    'README.md': '# Test Project\n\nA test project for APEX integration tests.',
    'tsconfig.json': JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'NodeNext' },
      include: ['src/**/*']
    }, null, 2),
    '.gitignore': 'node_modules/\ndist/\n*.log\n',

    // Source files with various patterns
    'src/index.ts': 'export * from "./core/index.js";\nexport * from "./utils/index.js";',
    'src/core/index.ts': 'export { Engine } from "./engine.js";\nexport { Config } from "./config.js";',
    'src/core/engine.ts': 'export class Engine {\n  start() { console.log("Engine started"); }\n}',
    'src/core/config.ts': 'export interface Config {\n  debug: boolean;\n  port: number;\n}',
    'src/utils/index.ts': 'export { helper } from "./helper.js";\nexport { format } from "./format.js";',
    'src/utils/helper.ts': 'export const helper = (x: string) => x.toUpperCase();',
    'src/utils/format.ts': 'export const format = (x: any) => JSON.stringify(x, null, 2);',

    // Test files
    'tests/unit/engine.test.ts': 'import { Engine } from "../../src/core/engine.js";\n\ntest("engine starts", () => {\n  expect(new Engine().start()).toBe(undefined);\n});',
    'tests/unit/helper.test.ts': 'import { helper } from "../../src/utils/helper.js";\n\ntest("helper works", () => {\n  expect(helper("test")).toBe("TEST");\n});',
    'tests/integration/api.test.ts': 'describe("API integration", () => {\n  it("should respond to requests", () => {\n    expect(true).toBe(true);\n  });\n});',
    'tests/e2e/app.e2e.test.ts': 'describe("E2E tests", () => {\n  it("should load the application", () => {\n    expect(true).toBe(true);\n  });\n});',

    // Documentation
    'docs/README.md': '# Documentation\n\nProject documentation.',
    'docs/api/modules.md': '# API Modules\n\n## Core\n\n- Engine\n- Config',
    'docs/guides/getting-started.md': '# Getting Started\n\n1. Install dependencies\n2. Run tests',

    // Build output
    'dist/index.js': 'function main() { console.log("Built"); }',
    'dist/core/engine.js': 'class Engine { start() { console.log("Engine started"); } }',

    // Config files
    'config/development.json': JSON.stringify({ debug: true, port: 3000 }, null, 2),
    'config/production.json': JSON.stringify({ debug: false, port: 8080 }, null, 2),

    // Various file types
    'assets/logo.svg': '<svg><rect width="100" height="100"/></svg>',
    'assets/styles.css': 'body { margin: 0; padding: 0; }',
    'scripts/build.sh': '#!/bin/bash\necho "Building..."',
    'scripts/deploy.py': '#!/usr/bin/env python3\nprint("Deploying...")',
  };

  for (const [filePath, content] of Object.entries(files)) {
    await createTestFile(baseDir, filePath, content);
  }
}

// ============================================================================
// Integration Test Suite
// ============================================================================

describe('GlobTool Integration Tests', () => {
  let tempDir: string;
  let originalRegistry: ToolRegistry;

  beforeAll(() => {
    // Save the original registry state
    originalRegistry = getToolRegistry();
  });

  afterAll(() => {
    // Restore the original registry state if needed
    // Note: The registry is a singleton, so we just clear it
    getToolRegistry().clear();
  });

  beforeEach(async () => {
    // Clear the registry before each test
    getToolRegistry().clear();

    // Create temp directory and test structure
    tempDir = await createTempDir();
    await createComplexTestStructure(tempDir);
  });

  afterEach(async () => {
    await removeDir(tempDir);
    getToolRegistry().clear();
  });

  // ========================================================================
  // Registry Integration Tests
  // ========================================================================

  describe('tool registry integration', () => {
    it('should register Glob tool via registerGlobTool()', () => {
      const registry = getToolRegistry();
      expect(registry.has('Glob')).toBe(false);

      registerGlobTool();

      expect(registry.has('Glob')).toBe(true);

      const tool = registry.get('Glob');
      expect(tool).toBeInstanceOf(GlobTool);
      expect(tool.name).toBe('Glob');
      expect(tool.description).toContain('Fast file pattern matching');
    });

    it('should register Glob tool via registerFilesystemTools()', () => {
      const registry = getToolRegistry();
      expect(registry.has('Glob')).toBe(false);

      registerFilesystemTools();

      expect(registry.has('Glob')).toBe(true);
      expect(registry.has('Read')).toBe(true);
      expect(registry.has('Write')).toBe(true);
      expect(registry.has('Edit')).toBe(true);
      expect(registry.has('MultiEdit')).toBe(true);

      const globTool = registry.get('Glob');
      expect(globTool).toBeInstanceOf(GlobTool);
    });

    it('should create tool instance via createGlobTool()', () => {
      const tool = createGlobTool();

      expect(tool).toBeInstanceOf(GlobTool);
      expect(tool.name).toBe('Glob');
      expect(tool.description).toContain('Fast file pattern matching');

      // Should not be registered automatically
      expect(getToolRegistry().has('Glob')).toBe(false);
    });

    it('should prevent duplicate registration', () => {
      registerGlobTool();

      expect(() => {
        registerGlobTool();
      }).toThrow();
    });

    it('should allow tool retrieval and execution via registry', async () => {
      registerGlobTool();

      const registry = getToolRegistry();
      const tool = registry.get('Glob') as GlobTool;

      const result = await tool.execute({
        pattern: '*.json',
        path: tempDir,
      });

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.basename === 'package')).toBe(true);
      expect(result.files.some(f => f.basename === 'tsconfig')).toBe(true);
    });
  });

  // ========================================================================
  // Schema Validation Integration Tests
  // ========================================================================

  describe('schema validation integration', () => {
    it('should provide valid JSON schema for Claude Agent SDK', () => {
      const tool = new GlobTool();
      const schema = tool.getParametersSchema();

      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('pattern');

      // Verify schema structure matches expected format
      expect(schema.properties.pattern).toEqual({
        type: 'string',
        description: 'The glob pattern to match files against (e.g., "**/*.js", "src/**/*.ts")',
      });

      expect(schema.properties.path).toEqual({
        type: 'string',
        description: 'The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.',
      });
    });

    it('should validate input according to schema', () => {
      const tool = new GlobTool();

      // Valid input
      expect(tool.validate({ pattern: '**/*.ts' }).valid).toBe(true);
      expect(tool.validate({ pattern: '*.js', path: tempDir }).valid).toBe(true);

      // Invalid input
      expect(tool.validate({} as any).valid).toBe(false);
      expect(tool.validate({ pattern: '' }).valid).toBe(false);
      expect(tool.validate({ pattern: 'test', path: '' }).valid).toBe(false);
    });

    it('should provide consistent tool metadata', () => {
      const tool = new GlobTool();
      const metadata = tool.getMetadata();

      expect(metadata.name).toBe('Glob');
      expect(metadata.description).toContain('Fast file pattern matching');
      expect(metadata.category).toBe('filesystem');
      expect(metadata.permissions).toContain('read');
      expect(metadata.dangerous).toBe(false);
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.tags).toContain('filesystem');
      expect(metadata.tags).toContain('search');
      expect(metadata.tags).toContain('pattern-matching');
    });
  });

  // ========================================================================
  // Cross-tool Integration Tests
  // ========================================================================

  describe('cross-tool integration', () => {
    it('should work seamlessly with Read tool for file discovery and reading', async () => {
      registerFilesystemTools();
      const registry = getToolRegistry();

      const globTool = registry.get('Glob') as GlobTool;
      const readTool = registry.get('Read') as ReadTool;

      // First, find TypeScript files
      const globResult = await globTool.execute({
        pattern: 'src/**/*.ts',
        path: tempDir,
      });

      expect(globResult.files.length).toBeGreaterThan(0);

      // Then read the contents of the first found file
      const firstFile = globResult.files[0];
      const readResult = await readTool.execute({
        file_path: firstFile.path,
      });

      expect(readResult.content).toBeDefined();
      expect(readResult.file_path).toBe(firstFile.path);
      expect(readResult.lines).toBeGreaterThan(0);
    });

    it('should work with Write tool for creating files then finding them', async () => {
      registerFilesystemTools();
      const registry = getToolRegistry();

      const globTool = registry.get('Glob') as GlobTool;
      const writeTool = registry.get('Write') as WriteTool;

      const testFileName = 'new-test-file.ts';
      const testFilePath = path.join(tempDir, testFileName);
      const testContent = 'export const newFunction = () => "test";';

      // Write a new file
      await writeTool.execute({
        file_path: testFilePath,
        content: testContent,
      });

      // Find it using glob
      const globResult = await globTool.execute({
        pattern: '*.ts',
        path: tempDir,
      });

      const foundFile = globResult.files.find(f => f.basename === 'new-test-file');
      expect(foundFile).toBeDefined();
      expect(foundFile!.extension).toBe('.ts');
      expect(foundFile!.size).toBeGreaterThan(0);
    });

    it('should maintain consistency with other filesystem tools', async () => {
      registerFilesystemTools();
      const registry = getToolRegistry();

      const globTool = registry.get('Glob') as GlobTool;

      // All filesystem tools should use the same path resolution logic
      const context: ToolExecutionContext = {
        workingDirectory: tempDir,
      };

      const result = await globTool.execute({
        pattern: '*.json',
        path: '.',  // Relative path
      }, context);

      expect(result.searchPath).toBe(tempDir);
      expect(result.files.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Complex Workflow Integration Tests
  // ========================================================================

  describe('complex workflow integration', () => {
    it('should support multi-pattern file discovery workflow', async () => {
      const globTool = new GlobTool();

      // Step 1: Find all source files
      const sourceFiles = await globTool.execute({
        pattern: 'src/**/*.ts',
        path: tempDir,
      });

      // Step 2: Find all test files
      const testFiles = await globTool.execute({
        pattern: 'tests/**/*.test.ts',
        path: tempDir,
      });

      // Step 3: Find all documentation files
      const docFiles = await globTool.execute({
        pattern: 'docs/**/*.md',
        path: tempDir,
      });

      expect(sourceFiles.files.length).toBeGreaterThan(0);
      expect(testFiles.files.length).toBeGreaterThan(0);
      expect(docFiles.files.length).toBeGreaterThan(0);

      // Verify no overlap between categories
      const sourceBasenames = new Set(sourceFiles.files.map(f => f.basename));
      const testBasenames = new Set(testFiles.files.map(f => f.basename));
      const docBasenames = new Set(docFiles.files.map(f => f.basename));

      const intersection = new Set([...sourceBasenames].filter(x => testBasenames.has(x) || docBasenames.has(x)));
      expect(intersection.size).toBe(0);
    });

    it('should support code analysis workflow with pattern matching', async () => {
      const globTool = new GlobTool();

      // Find TypeScript implementation files (exclude tests)
      const implFiles = await globTool.execute({
        pattern: 'src/**/*.ts',
        path: tempDir,
      });

      // Find corresponding test files
      const testPromises = implFiles.files.map(async (implFile) => {
        const relativeImplPath = path.relative(path.join(tempDir, 'src'), implFile.path);
        const testPattern = `**/${path.basename(implFile.basename)}.test.ts`;

        return globTool.execute({
          pattern: testPattern,
          path: path.join(tempDir, 'tests'),
        });
      });

      const testResults = await Promise.all(testPromises);
      const hasTests = testResults.filter(result => result.files.length > 0);

      expect(implFiles.files.length).toBeGreaterThan(0);
      expect(hasTests.length).toBeGreaterThan(0);

      // Verify we found some test files
      const allTestFiles = testResults.flatMap(result => result.files);
      expect(allTestFiles.length).toBeGreaterThan(0);
    });

    it('should support build artifact analysis workflow', async () => {
      const globTool = new GlobTool();

      // Find source files
      const sourceFiles = await globTool.execute({
        pattern: 'src/**/*.ts',
        path: tempDir,
      });

      // Find corresponding build outputs
      const buildFiles = await globTool.execute({
        pattern: 'dist/**/*.js',
        path: tempDir,
      });

      // Find configuration files
      const configFiles = await globTool.execute({
        pattern: '{*.json,config/**/*.json}',
        path: tempDir,
      });

      expect(sourceFiles.files.length).toBeGreaterThan(0);
      expect(buildFiles.files.length).toBeGreaterThan(0);
      expect(configFiles.files.length).toBeGreaterThan(0);

      // Verify modification times are properly set for comparison
      for (const file of [...sourceFiles.files, ...buildFiles.files, ...configFiles.files]) {
        expect(file.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(new Date(file.lastModified)).toBeInstanceOf(Date);
      }
    });
  });

  // ========================================================================
  // Performance Integration Tests
  // ========================================================================

  describe('performance integration', () => {
    it('should handle large directory structures efficiently', async () => {
      const globTool = new GlobTool();

      // Create additional files to test performance
      const additionalFiles: Promise<string>[] = [];
      for (let i = 0; i < 100; i++) {
        additionalFiles.push(createTestFile(tempDir, `generated/file${i}.ts`, `export const value${i} = ${i};`));
        additionalFiles.push(createTestFile(tempDir, `generated/test${i}.test.ts`, `test("test${i}", () => { expect(true).toBe(true); });`));
      }

      await Promise.all(additionalFiles);

      const startTime = Date.now();
      const result = await globTool.execute({
        pattern: '**/*.ts',
        path: tempDir,
      });
      const executionTime = Date.now() - startTime;

      expect(result.files.length).toBeGreaterThan(200); // Original + generated files
      expect(result.searchTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(executionTime).toBeLessThan(10000); // Including Node.js overhead
      expect(result.truncated).toBe(false); // Should not hit limits
    });

    it('should respect performance limits with truncation', async () => {
      const globTool = new GlobTool();

      // Test with very broad pattern on a large directory
      const result = await globTool.execute({
        pattern: '**/*',
        path: tempDir,
      });

      expect(result.searchTime).toBeGreaterThan(0);
      expect(result.files.length).toBeLessThanOrEqual(5000); // MAX_RESULTS limit
      expect(typeof result.truncated).toBe('boolean');

      // Verify performance metadata is accurate
      expect(result.totalFiles).toBe(result.files.length);
    });

    it('should maintain consistent performance across multiple executions', async () => {
      const globTool = new GlobTool();
      const pattern = 'src/**/*.ts';
      const executions = 5;
      const times: number[] = [];

      for (let i = 0; i < executions; i++) {
        const result = await globTool.execute({
          pattern,
          path: tempDir,
        });
        times.push(result.searchTime);

        // Verify consistent results
        expect(result.files.length).toBeGreaterThan(0);
      }

      // Performance should be relatively consistent
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxDeviation = Math.max(...times.map(time => Math.abs(time - avgTime)));

      // Allow up to 50% deviation for performance variance
      expect(maxDeviation / avgTime).toBeLessThan(0.5);
    });
  });
});