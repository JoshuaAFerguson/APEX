/**
 * ImportAutoFixer Unit Tests
 *
 * Comprehensive tests for the ImportAutoFixer service functionality.
 * Tests cover detection, resolution, and application of missing imports.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImportAutoFixer } from './import-auto-fixer';
import type {
  ImportAutoFixerOptions,
  MissingImport,
  ImportFixResult,
  ImportAutoFixerEvents,
  ImportResolution,
} from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

// Mock child_process for ESLint detector
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('ImportAutoFixer', () => {
  const projectPath = '/test/project';
  const testFilePath = path.join(projectPath, 'src/test.ts');

  let fixer: ImportAutoFixer;
  let events: Array<{ event: keyof ImportAutoFixerEvents; data: any }>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset events array
    events = [];

    // Create fixer with test options
    const options: ImportAutoFixerOptions = {
      projectPath,
      detector: 'eslint',
      dryRun: true, // Don't actually write files in tests
    };

    fixer = new ImportAutoFixer(options);

    // Capture all events
    fixer.on('analysis:started', (data) => events.push({ event: 'analysis:started', data }));
    fixer.on('analysis:completed', (data) => events.push({ event: 'analysis:completed', data }));
    fixer.on('fix:started', (data) => events.push({ event: 'fix:started', data }));
    fixer.on('fix:import-added', (data) => events.push({ event: 'fix:import-added', data }));
    fixer.on('fix:completed', (data) => events.push({ event: 'fix:completed', data }));
    fixer.on('fix:error', (data) => events.push({ event: 'fix:error', data }));

    // Mock file system operations
    mockFs.readFile.mockImplementation(async (filePath: any) => {
      if (filePath.includes('tsconfig.json')) {
        return JSON.stringify({
          compilerOptions: {
            baseUrl: './src',
            paths: {
              '@/*': ['*'],
              '@utils/*': ['utils/*'],
            },
          },
        });
      }

      if (filePath.includes('package.json')) {
        return JSON.stringify({
          name: 'test-project',
          dependencies: {
            react: '^18.0.0',
            lodash: '^4.17.0',
          },
          devDependencies: {
            '@types/node': '^20.0.0',
          },
        });
      }

      // Test file content
      return `
import { useState } from 'react';

function Component() {
  const [count, setCount] = useState(0);

  // Missing import: lodash
  const data = _.map([1, 2, 3], x => x * 2);

  // Missing import: local utility
  const result = formatNumber(count);

  return <div>{data.length}</div>;
}
`;
    });

    mockFs.writeFile.mockImplementation(async () => {
      // Mock successful write
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const instance = new ImportAutoFixer({ projectPath: '/test' });
      expect(instance).toBeInstanceOf(ImportAutoFixer);
    });

    it('should merge custom options with defaults', () => {
      const options: ImportAutoFixerOptions = {
        projectPath: '/test',
        detector: 'typescript',
        dryRun: true,
        preferredImportStyle: 'named',
      };

      const instance = new ImportAutoFixer(options);
      const config = instance.getConfig();

      expect(config.detector).toBe('typescript');
      expect(config.behavior.dryRun).toBe(true);
      expect(config.style.preferredImportStyle).toBe('named');
    });
  });

  describe('analyze()', () => {
    beforeEach(() => {
      // Mock the detector to return some missing imports
      vi.spyOn(fixer['detector'], 'detect').mockImplementation(async () => [
        {
          identifier: '_',
          line: 7,
          column: 15,
          context: { usageType: 'value', isFunctionCall: true },
        },
        {
          identifier: 'formatNumber',
          line: 10,
          column: 17,
          context: { usageType: 'value', isFunctionCall: true },
        },
      ] as MissingImport[]);
    });

    it('should analyze files and return missing imports', async () => {
      const results = await fixer.analyze([testFilePath]);

      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe(testFilePath);
      expect(results[0].missingImports).toHaveLength(2);
      expect(results[0].missingImports[0].identifier).toBe('_');
      expect(results[0].missingImports[1].identifier).toBe('formatNumber');
    });

    it('should emit analysis events', async () => {
      await fixer.analyze([testFilePath]);

      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('analysis:started');
      expect(events[0].data.files).toEqual([testFilePath]);
      expect(events[1].event).toBe('analysis:completed');
      expect(events[1].data.results).toHaveLength(1);
    });

    it('should handle multiple files', async () => {
      const files = [testFilePath, path.join(projectPath, 'src/other.ts')];
      const results = await fixer.analyze(files);

      expect(results).toHaveLength(2);
      expect(fixer['detector'].detect).toHaveBeenCalledTimes(2);
    });

    it('should handle analysis errors gracefully', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('File not found'));

      const results = await fixer.analyze([testFilePath]);

      expect(results).toHaveLength(1);
      expect(results[0].errors).toHaveLength(1);
      expect(results[0].errors[0].type).toBe('io');
    });
  });

  describe('fix()', () => {
    beforeEach(() => {
      // Mock the detector
      vi.spyOn(fixer['detector'], 'detect').mockImplementation(async () => [
        {
          identifier: '_',
          line: 7,
          column: 15,
          context: { usageType: 'value', isFunctionCall: true },
        },
      ] as MissingImport[]);

      // Mock the resolvers
      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockImplementation(async (identifier) => {
        return identifier === '_';
      });

      vi.spyOn(fixer['resolvers'][2], 'resolve').mockImplementation(async (identifier) => {
        if (identifier === '_') {
          return {
            source: 'lodash',
            importType: 'default',
            isTypeOnly: false,
            confidence: 0.9,
            resolvedBy: 'package-resolver',
          } as ImportResolution;
        }
        return null;
      });
    });

    it('should fix missing imports and return results', async () => {
      const results = await fixer.fix([testFilePath]);

      expect(results).toHaveLength(1);

      const result = results[0];
      expect(result.success).toBe(true);
      expect(result.filePath).toBe(testFilePath);
      expect(result.importsAdded).toHaveLength(1);
      expect(result.importsAdded[0].specifier).toBe('_');
      expect(result.importsAdded[0].source).toBe('lodash');
      expect(result.importsAdded[0].importType).toBe('default');
    });

    it('should not write files in dry run mode', async () => {
      await fixer.fix([testFilePath]);

      // writeFile should not have been called because dryRun is true
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should write files when not in dry run mode', async () => {
      // Configure fixer for actual file writing
      fixer.configure({ behavior: { ...fixer.getConfig().behavior, dryRun: false } });

      await fixer.fix([testFilePath]);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testFilePath,
        expect.stringContaining("import _ from 'lodash';"),
        'utf-8'
      );
    });

    it('should emit fix events', async () => {
      await fixer.fix([testFilePath]);

      expect(events.some(e => e.event === 'fix:started')).toBe(true);
      expect(events.some(e => e.event === 'fix:import-added')).toBe(true);
      expect(events.some(e => e.event === 'fix:completed')).toBe(true);
    });

    it('should handle fix errors gracefully', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('Permission denied'));

      const results = await fixer.fix([testFilePath]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].errors).toHaveLength(1);
      expect(results[0].errors[0].type).toBe('io');
    });

    it('should skip files with no missing imports', async () => {
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValueOnce([]);

      const results = await fixer.fix([testFilePath]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].importsAdded).toHaveLength(0);
    });

    it('should handle unresolved imports', async () => {
      // Make resolver return null (unresolved)
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValueOnce(null);

      const results = await fixer.fix([testFilePath]);

      expect(results).toHaveLength(1);
      expect(results[0].errors).toHaveLength(1);
      expect(results[0].errors[0].type).toBe('resolution');
      expect(results[0].errors[0].identifier).toBe('_');
    });
  });

  describe('fixFile()', () => {
    beforeEach(() => {
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);
    });

    it('should fix a single file', async () => {
      const result = await fixer.fixFile(testFilePath);

      expect(result.filePath).toBe(testFilePath);
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should return modified content in dry run mode', async () => {
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValueOnce([
        { identifier: 'test', line: 1, column: 1 } as MissingImport,
      ]);

      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockResolvedValueOnce(true);
      vi.spyOn(fixer['resolvers'][0], 'resolve').mockResolvedValueOnce({
        source: './test',
        importType: 'named',
        isTypeOnly: false,
        confidence: 1.0,
        resolvedBy: 'local-resolver',
      } as ImportResolution);

      const result = await fixer.fixFile(testFilePath);

      expect(result.modifiedContent).toBeDefined();
      expect(result.modifiedContent).toContain("import { test } from './test';");
    });

    it('should handle relative file paths', async () => {
      const relativePath = 'src/test.ts';
      const result = await fixer.fixFile(relativePath);

      expect(result.filePath).toBe(path.join(projectPath, relativePath));
    });
  });

  describe('getSummary()', () => {
    it('should calculate summary statistics', () => {
      const results: ImportFixResult[] = [
        {
          success: true,
          filePath: '/file1.ts',
          importsAdded: [
            { specifier: '_', source: 'lodash', importType: 'default', line: 1, originalIdentifier: '_' },
            { specifier: '{ map }', source: 'lodash', importType: 'named', line: 2, originalIdentifier: 'map' },
          ],
          errors: [],
          duration: 100,
        },
        {
          success: false,
          filePath: '/file2.ts',
          importsAdded: [],
          errors: [{ type: 'io', message: 'Error', recoverable: false }],
          duration: 50,
        },
        {
          success: true,
          filePath: '/file3.ts',
          importsAdded: [
            { specifier: 'React', source: 'react', importType: 'default', line: 1, originalIdentifier: 'React' },
          ],
          errors: [],
          duration: 75,
        },
      ];

      const summary = fixer.getSummary(results);

      expect(summary.filesProcessed).toBe(3);
      expect(summary.filesModified).toBe(2);
      expect(summary.totalImportsAdded).toBe(3);
      expect(summary.totalErrors).toBe(1);
      expect(summary.totalDuration).toBe(225);
    });
  });

  describe('configure()', () => {
    it('should update configuration', () => {
      const initialConfig = fixer.getConfig();
      expect(initialConfig.style.quoteStyle).toBe('single');

      fixer.configure({
        style: {
          quoteStyle: 'double',
          useTypeImports: false,
        },
      });

      const updatedConfig = fixer.getConfig();
      expect(updatedConfig.style.quoteStyle).toBe('double');
      expect(updatedConfig.style.useTypeImports).toBe(false);
      // Other config should remain unchanged
      expect(updatedConfig.detector).toBe(initialConfig.detector);
    });
  });

  describe('isAvailable()', () => {
    it('should check if detector is available', async () => {
      vi.spyOn(fixer['detector'], 'isAvailable').mockResolvedValueOnce(true);

      const isAvailable = await fixer.isAvailable();

      expect(isAvailable).toBe(true);
      expect(fixer['detector'].isAvailable).toHaveBeenCalled();
    });
  });

  describe('import insertion logic', () => {
    it('should insert imports at the correct position', async () => {
      const fileContent = `// File header comment
'use strict';

function test() {
  return true;
}`;

      mockFs.readFile.mockResolvedValueOnce(fileContent);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValueOnce([
        { identifier: '_', line: 4, column: 1 } as MissingImport,
      ]);

      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValueOnce(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValueOnce({
        source: 'lodash',
        importType: 'default',
        isTypeOnly: false,
        confidence: 1.0,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      const result = await fixer.fixFile(testFilePath);

      expect(result.modifiedContent).toContain("import _ from 'lodash';");
      // Import should be inserted after 'use strict'
      expect(result.modifiedContent).toMatch(
        /'use strict';\n\nimport _ from 'lodash';\n/
      );
    });

    it('should preserve existing imports', async () => {
      const fileContent = `import React from 'react';
import { useState } from 'react';

function Component() {
  const data = _.map([1, 2, 3], x => x);
  return <div>{data}</div>;
}`;

      mockFs.readFile.mockResolvedValueOnce(fileContent);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValueOnce([
        { identifier: '_', line: 5, column: 15 } as MissingImport,
      ]);

      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValueOnce(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValueOnce({
        source: 'lodash',
        importType: 'default',
        isTypeOnly: false,
        confidence: 1.0,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      const result = await fixer.fixFile(testFilePath);

      // Should preserve existing imports
      expect(result.modifiedContent).toContain("import React from 'react';");
      expect(result.modifiedContent).toContain("import { useState } from 'react';");
      // Should add new import after existing ones
      expect(result.modifiedContent).toContain("import _ from 'lodash';");
    });
  });

  describe('error handling', () => {
    it('should handle detector errors gracefully', async () => {
      vi.spyOn(fixer['detector'], 'detect').mockRejectedValueOnce(
        new Error('ESLint failed')
      );

      const result = await fixer.fixFile(testFilePath);

      expect(result.success).toBe(true); // Should not fail
      expect(result.importsAdded).toHaveLength(0); // No imports added due to detection failure
    });

    it('should handle resolver errors gracefully', async () => {
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValueOnce([
        { identifier: 'test', line: 1, column: 1 } as MissingImport,
      ]);

      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockRejectedValueOnce(
        new Error('Resolver error')
      );

      const result = await fixer.fixFile(testFilePath);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('resolution');
    });
  });

  describe('configuration compliance', () => {
    it('should respect quote style configuration', async () => {
      fixer.configure({
        style: { quoteStyle: 'double' },
      });

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValueOnce([
        { identifier: '_', line: 1, column: 1 } as MissingImport,
      ]);

      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValueOnce(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValueOnce({
        source: 'lodash',
        importType: 'default',
        isTypeOnly: false,
        confidence: 1.0,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      const result = await fixer.fixFile(testFilePath);

      expect(result.modifiedContent).toContain('import _ from "lodash";');
    });

    it('should respect semicolon configuration', async () => {
      fixer.configure({
        style: { semicolons: false },
      });

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValueOnce([
        { identifier: '_', line: 1, column: 1 } as MissingImport,
      ]);

      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValueOnce(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValueOnce({
        source: 'lodash',
        importType: 'default',
        isTypeOnly: false,
        confidence: 1.0,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      const result = await fixer.fixFile(testFilePath);

      expect(result.modifiedContent).toContain("import _ from 'lodash'");
      expect(result.modifiedContent).not.toContain("import _ from 'lodash';");
    });

    it('should respect type imports configuration', async () => {
      fixer.configure({
        style: { useTypeImports: true },
      });

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValueOnce([
        { identifier: 'User', line: 1, column: 1, isTypeOnly: true } as MissingImport,
      ]);

      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockResolvedValueOnce(true);
      vi.spyOn(fixer['resolvers'][0], 'resolve').mockResolvedValueOnce({
        source: './types',
        importType: 'named',
        isTypeOnly: true,
        confidence: 1.0,
        resolvedBy: 'local-resolver',
      } as ImportResolution);

      const result = await fixer.fixFile(testFilePath);

      expect(result.modifiedContent).toContain("import type { User } from './types';");
    });
  });
});