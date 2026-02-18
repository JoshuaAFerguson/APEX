/**
 * ImportAutoFixer Integration Tests
 *
 * End-to-end tests verifying ImportAutoFixer functionality
 * with real file system interactions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImportAutoFixer } from './import-auto-fixer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

describe('ImportAutoFixer Integration', () => {
  let tempDir: string;
  let fixer: ImportAutoFixer;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'import-auto-fixer-test-'));

    // Create basic project structure
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'node_modules', 'lodash'), { recursive: true });

    // Create package.json
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        dependencies: {
          lodash: '^4.17.0',
          react: '^18.0.0',
        },
      })
    );

    // Create tsconfig.json
    await fs.writeFile(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          paths: {
            '@/*': ['*'],
            '@utils/*': ['utils/*'],
          },
        },
      })
    );

    // Create utility files
    await fs.writeFile(
      path.join(tempDir, 'src', 'utils.ts'),
      `export function formatNumber(num: number): string {
  return num.toLocaleString();
}

export const PI = 3.14159;

export default function defaultUtil() {
  return 'default';
}`
    );

    await fs.writeFile(
      path.join(tempDir, 'src', 'types.ts'),
      `export interface User {
  id: number;
  name: string;
}

export type UserStatus = 'active' | 'inactive';
`
    );

    // Create a package manifest in node_modules
    await fs.writeFile(
      path.join(tempDir, 'node_modules', 'lodash', 'package.json'),
      JSON.stringify({
        name: 'lodash',
        version: '4.17.21',
        main: 'lodash.js',
      })
    );

    fixer = new ImportAutoFixer({
      projectPath: tempDir,
      detector: 'eslint',
      dryRun: true, // Don't modify files during tests
    });
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should be created successfully', () => {
    expect(fixer).toBeInstanceOf(ImportAutoFixer);
  });

  it('should detect service availability', async () => {
    const isAvailable = await fixer.isAvailable();
    // This depends on ESLint being available, so we'll just check the type
    expect(typeof isAvailable).toBe('boolean');
  });

  it('should handle configuration correctly', () => {
    const config = fixer.getConfig();
    expect(config.detector).toBe('eslint');
    expect(config.behavior.dryRun).toBe(true);

    fixer.configure({
      style: { quoteStyle: 'double' },
    });

    const updatedConfig = fixer.getConfig();
    expect(updatedConfig.style.quoteStyle).toBe('double');
  });

  it('should analyze files without errors', async () => {
    // Create a test file with missing imports
    const testFile = path.join(tempDir, 'src', 'test.ts');
    await fs.writeFile(
      testFile,
      `function Component() {
  const formatted = formatNumber(42);
  const data = _.map([1, 2, 3], x => x * 2);
  return { formatted, data };
}`
    );

    // Mock the detector to bypass ESLint dependency in tests
    const mockMissingImports = [
      {
        identifier: 'formatNumber',
        line: 2,
        column: 19,
        context: { usageType: 'value' as const, isFunctionCall: true },
      },
      {
        identifier: '_',
        line: 3,
        column: 15,
        context: { usageType: 'value' as const, isFunctionCall: true },
      },
    ];

    // Override detector for this test
    (fixer as any).detector.detect = async () => mockMissingImports;

    const analysis = await fixer.analyze([testFile]);

    expect(analysis).toHaveLength(1);
    expect(analysis[0].filePath).toBe(testFile);
    expect(analysis[0].errors).toHaveLength(0);
  });

  it('should provide meaningful error handling', async () => {
    const nonExistentFile = path.join(tempDir, 'src', 'nonexistent.ts');

    const analysis = await fixer.analyze([nonExistentFile]);

    expect(analysis).toHaveLength(1);
    expect(analysis[0].filePath).toBe(nonExistentFile);
    expect(analysis[0].errors.length).toBeGreaterThan(0);
    expect(analysis[0].errors[0].type).toBe('io');
  });

  it('should handle empty files gracefully', async () => {
    const emptyFile = path.join(tempDir, 'src', 'empty.ts');
    await fs.writeFile(emptyFile, '');

    // Mock detector for empty file
    (fixer as any).detector.detect = async () => [];

    const analysis = await fixer.analyze([emptyFile]);

    expect(analysis).toHaveLength(1);
    expect(analysis[0].missingImports).toHaveLength(0);
    expect(analysis[0].errors).toHaveLength(0);
  });

  it('should generate proper summary statistics', () => {
    const testResults = [
      {
        success: true,
        filePath: '/file1.ts',
        importsAdded: [
          {
            specifier: '_',
            source: 'lodash',
            importType: 'default' as const,
            line: 1,
            originalIdentifier: '_',
          },
        ],
        errors: [],
        duration: 100,
      },
      {
        success: false,
        filePath: '/file2.ts',
        importsAdded: [],
        errors: [
          {
            type: 'resolution' as const,
            message: 'Could not resolve',
            recoverable: true,
          },
        ],
        duration: 50,
      },
    ];

    const summary = fixer.getSummary(testResults);

    expect(summary.filesProcessed).toBe(2);
    expect(summary.filesModified).toBe(1);
    expect(summary.totalImportsAdded).toBe(1);
    expect(summary.totalErrors).toBe(1);
    expect(summary.totalDuration).toBe(150);
  });

  it('should respect configuration options', () => {
    // Test different import styles
    fixer.configure({
      style: {
        preferredImportStyle: 'named',
        quoteStyle: 'double',
        semicolons: false,
        useTypeImports: true,
      },
    });

    const config = fixer.getConfig();
    expect(config.style.preferredImportStyle).toBe('named');
    expect(config.style.quoteStyle).toBe('double');
    expect(config.style.semicolons).toBe(false);
    expect(config.style.useTypeImports).toBe(true);
  });

  it('should handle multiple files concurrently', async () => {
    const file1 = path.join(tempDir, 'src', 'file1.ts');
    const file2 = path.join(tempDir, 'src', 'file2.ts');

    await fs.writeFile(file1, 'const x = 1;');
    await fs.writeFile(file2, 'const y = 2;');

    // Mock detector for no imports needed
    (fixer as any).detector.detect = async () => [];

    const analysis = await fixer.analyze([file1, file2]);

    expect(analysis).toHaveLength(2);
    expect(analysis[0].filePath).toBe(file1);
    expect(analysis[1].filePath).toBe(file2);
  });

  it('should emit events during operation', async () => {
    const testFile = path.join(tempDir, 'src', 'test.ts');
    await fs.writeFile(testFile, 'const x = 1;');

    const events: string[] = [];

    fixer.on('analysis:started', () => events.push('analysis:started'));
    fixer.on('analysis:completed', () => events.push('analysis:completed'));

    // Mock detector
    (fixer as any).detector.detect = async () => [];

    await fixer.analyze([testFile]);

    expect(events).toContain('analysis:started');
    expect(events).toContain('analysis:completed');
  });
});