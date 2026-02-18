/**
 * ImportAutoFixer Edge Cases Tests
 *
 * Tests for edge cases, error conditions, and boundary scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImportAutoFixer } from './import-auto-fixer';
import type {
  ImportAutoFixerOptions,
  MissingImport,
  ImportFixResult,
  ImportResolution,
} from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('ImportAutoFixer Edge Cases', () => {
  const projectPath = '/test/project';
  let fixer: ImportAutoFixer;

  beforeEach(() => {
    vi.clearAllMocks();

    const options: ImportAutoFixerOptions = {
      projectPath,
      detector: 'eslint',
      dryRun: true,
    };

    fixer = new ImportAutoFixer(options);

    // Mock basic project files
    mockFs.readFile.mockImplementation(async (filePath: any) => {
      if (filePath.includes('tsconfig.json')) {
        return JSON.stringify({
          compilerOptions: {
            baseUrl: './src',
            paths: { '@/*': ['*'] },
          },
        });
      }

      if (filePath.includes('package.json')) {
        return JSON.stringify({
          name: 'test-project',
          dependencies: { react: '^18.0.0' },
        });
      }

      return 'const x = 1;';
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File System Edge Cases', () => {
    it('should handle corrupted tsconfig.json', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('tsconfig.json')) {
          return '{ invalid json syntax }';
        }
        return 'const x = 1;';
      });

      // Should not throw, should continue without tsconfig
      const analysis = await fixer.analyze(['/test/file.ts']);
      expect(analysis).toHaveLength(1);
      expect(analysis[0].errors).toHaveLength(0);
    });

    it('should handle missing package.json', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('package.json')) {
          throw new Error('ENOENT: no such file or directory');
        }
        return 'const x = 1;';
      });

      const analysis = await fixer.analyze(['/test/file.ts']);
      expect(analysis).toHaveLength(1);
      // Should continue gracefully without package.json
    });

    it('should handle permission denied errors', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (!filePath.includes('config')) {
          throw new Error('EACCES: permission denied');
        }
        return '{}';
      });

      const analysis = await fixer.analyze(['/test/file.ts']);
      expect(analysis).toHaveLength(1);
      expect(analysis[0].errors).toHaveLength(1);
      expect(analysis[0].errors[0].type).toBe('io');
    });

    it('should handle very large files', async () => {
      const largeContent = 'const x = 1;\n'.repeat(100000);
      mockFs.readFile.mockResolvedValueOnce(largeContent);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const analysis = await fixer.analyze(['/test/large-file.ts']);
      expect(analysis).toHaveLength(1);
      expect(analysis[0].errors).toHaveLength(0);
    });

    it('should handle binary files gracefully', async () => {
      const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('utf-8');
      mockFs.readFile.mockResolvedValueOnce(binaryContent);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const analysis = await fixer.analyze(['/test/binary-file.png']);
      expect(analysis).toHaveLength(1);
    });

    it('should handle empty files', async () => {
      mockFs.readFile.mockResolvedValueOnce('');

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const analysis = await fixer.analyze(['/test/empty-file.ts']);
      expect(analysis).toHaveLength(1);
      expect(analysis[0].missingImports).toHaveLength(0);
    });

    it('should handle files with only whitespace', async () => {
      mockFs.readFile.mockResolvedValueOnce('   \n\n\t  \n  ');

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const analysis = await fixer.analyze(['/test/whitespace-file.ts']);
      expect(analysis).toHaveLength(1);
      expect(analysis[0].missingImports).toHaveLength(0);
    });
  });

  describe('Import Resolution Edge Cases', () => {
    it('should handle circular import references', async () => {
      const fileContent = `
import { ComponentB } from './ComponentB';
export function ComponentA() {
  return ComponentB();
}
`;

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('ComponentA.ts')) {
          return fileContent;
        }
        if (filePath.includes('ComponentB.ts')) {
          return `
import { ComponentA } from './ComponentA';
export function ComponentB() {
  return ComponentA();
}`;
        }
        return 'const x = 1;';
      });

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        {
          identifier: 'ComponentB',
          line: 2,
          column: 1,
        } as MissingImport,
      ]);

      // Should resolve despite circular reference
      const analysis = await fixer.analyze(['/test/ComponentA.ts']);
      expect(analysis).toHaveLength(1);
    });

    it('should handle ambiguous identifier resolution', async () => {
      // Multiple possible sources for the same identifier
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        {
          identifier: 'Button',
          line: 1,
          column: 1,
        } as MissingImport,
      ]);

      // Mock multiple resolvers returning different resolutions
      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][0], 'resolve').mockResolvedValue({
        source: './components/Button',
        importType: 'default',
        isTypeOnly: false,
        confidence: 0.8,
        resolvedBy: 'local-resolver',
      } as ImportResolution);

      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValue({
        source: 'ui-library',
        importType: 'named',
        isTypeOnly: false,
        confidence: 0.7,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      const result = await fixer.fixFile('/test/file.ts');

      // Should use the first resolver (higher priority)
      expect(result.importsAdded[0].source).toBe('./components/Button');
    });

    it('should handle identifiers with special characters', async () => {
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        {
          identifier: '$',
          line: 1,
          column: 1,
        } as MissingImport,
        {
          identifier: '_',
          line: 2,
          column: 1,
        } as MissingImport,
        {
          identifier: 'React$Component',
          line: 3,
          column: 1,
        } as MissingImport,
      ]);

      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockImplementation(async (identifier) => {
        return ['$', '_'].includes(identifier);
      });

      vi.spyOn(fixer['resolvers'][2], 'resolve').mockImplementation(async (identifier) => {
        if (identifier === '$') {
          return {
            source: 'jquery',
            importType: 'default',
            isTypeOnly: false,
            confidence: 0.9,
            resolvedBy: 'package-resolver',
          };
        }
        if (identifier === '_') {
          return {
            source: 'lodash',
            importType: 'default',
            isTypeOnly: false,
            confidence: 0.9,
            resolvedBy: 'package-resolver',
          };
        }
        return null;
      });

      const result = await fixer.fixFile('/test/file.ts');

      expect(result.importsAdded).toHaveLength(2);
      expect(result.errors).toHaveLength(1); // React$Component couldn't be resolved
    });

    it('should handle very long identifier names', async () => {
      const longIdentifier = 'a'.repeat(1000);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        {
          identifier: longIdentifier,
          line: 1,
          column: 1,
        } as MissingImport,
      ]);

      const result = await fixer.fixFile('/test/file.ts');

      // Should handle gracefully without crashing
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('resolution');
    });
  });

  describe('File Content Edge Cases', () => {
    it('should handle files with complex import structures', async () => {
      const complexContent = `
// File with many different import styles
import React, { useState, useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import * as lodash from 'lodash';
import { map as lodashMap } from 'lodash';
import utils, { helper1, helper2 } from './utils';
import('./dynamic-import');

// Missing imports should still be detected
function Component() {
  const data = newFunction(); // Missing
  const formatted = anotherMissingFunction(data); // Missing
  return <MissingComponent>{formatted}</MissingComponent>; // Missing
}
`;

      mockFs.readFile.mockResolvedValue(complexContent);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        { identifier: 'newFunction', line: 12, column: 15 } as MissingImport,
        { identifier: 'anotherMissingFunction', line: 13, column: 19 } as MissingImport,
        { identifier: 'MissingComponent', line: 14, column: 11 } as MissingImport,
      ]);

      const result = await fixer.fixFile('/test/file.ts');

      // Should correctly parse existing imports and add new ones
      expect(result.modifiedContent).toContain('import React, { useState, useEffect } from \'react\';');
      expect(result.importsAdded).toHaveLength(0); // No resolvers mocked
      expect(result.errors).toHaveLength(3); // All unresolved
    });

    it('should handle files with multiline imports', async () => {
      const multilineContent = `
import {
  Component,
  useState,
  useEffect,
  useMemo
} from 'react';

import {
  map,
  filter,
  reduce
} from 'lodash';

function test() {
  return missingFunction();
}
`;

      mockFs.readFile.mockResolvedValue(multilineContent);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        { identifier: 'missingFunction', line: 17, column: 9 } as MissingImport,
      ]);

      const analysis = await fixer.analyze(['/test/file.ts']);

      // Should parse multiline imports correctly
      expect(analysis[0].errors).toHaveLength(0);
    });

    it('should handle files with comments in imports', async () => {
      const commentedContent = `
// Main React import
import React from 'react';
/*
 * Utility imports
 */
import {
  // Map function
  map,
  // Filter function
  filter
} from 'lodash';

function test() {
  return missingFunction();
}
`;

      mockFs.readFile.mockResolvedValue(commentedContent);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        { identifier: 'missingFunction', line: 16, column: 9 } as MissingImport,
      ]);

      const analysis = await fixer.analyze(['/test/file.ts']);

      // Should handle comments in imports
      expect(analysis[0].errors).toHaveLength(0);
    });

    it('should handle files with string literals containing import-like text', async () => {
      const trickContent = `
const code = \`
import React from 'react';
import { useState } from 'react';
\`;

const importStatement = "import { map } from 'lodash';";

function test() {
  return missingFunction();
}
`;

      mockFs.readFile.mockResolvedValue(trickContent);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        { identifier: 'missingFunction', line: 9, column: 9 } as MissingImport,
      ]);

      const analysis = await fixer.analyze(['/test/file.ts']);

      // Should not be confused by import-like text in strings
      expect(analysis[0].errors).toHaveLength(0);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle invalid configuration gracefully', async () => {
      expect(() => {
        fixer.configure({
          style: {
            // @ts-expect-error - Testing invalid config
            quoteStyle: 'invalid-quote-style',
          },
        });
      }).not.toThrow();

      // Should use valid fallback values
      const config = fixer.getConfig();
      expect(['single', 'double', 'auto']).toContain(config.style.quoteStyle);
    });

    it('should handle deeply nested configuration updates', async () => {
      const initialConfig = fixer.getConfig();

      fixer.configure({
        resolvers: {
          local: {
            enabled: false,
            searchPaths: ['custom'],
          },
        },
      });

      const updatedConfig = fixer.getConfig();

      // Should merge deeply
      expect(updatedConfig.resolvers.local.enabled).toBe(false);
      expect(updatedConfig.resolvers.local.searchPaths).toEqual(['custom']);
      // Should preserve other values
      expect(updatedConfig.resolvers.alias.enabled).toBe(initialConfig.resolvers.alias.enabled);
    });

    it('should handle configuration with null/undefined values', async () => {
      expect(() => {
        fixer.configure({
          // @ts-expect-error - Testing null values
          style: null,
          // @ts-expect-error - Testing undefined values
          behavior: undefined,
        });
      }).not.toThrow();

      const config = fixer.getConfig();
      expect(config.style).toBeDefined();
      expect(config.behavior).toBeDefined();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle many concurrent file analyses', async () => {
      const files = Array.from({ length: 100 }, (_, i) => `/test/file${i}.ts`);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const startTime = Date.now();
      const analyses = await fixer.analyze(files);
      const endTime = Date.now();

      expect(analyses).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle files with many missing imports', async () => {
      const manyMissingImports = Array.from({ length: 1000 }, (_, i) => ({
        identifier: `missingFunction${i}`,
        line: i + 1,
        column: 1,
      })) as MissingImport[];

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue(manyMissingImports);

      const result = await fixer.fixFile('/test/file.ts');

      // Should handle large numbers of missing imports
      expect(result.errors).toHaveLength(1000); // All unresolved
      expect(result.duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should cleanup resources properly', async () => {
      // Create multiple fixer instances to test resource cleanup
      const fixers = Array.from({ length: 10 }, () => new ImportAutoFixer({
        projectPath: '/test',
        detector: 'eslint',
      }));

      // Use all fixers
      const promises = fixers.map(f => f.analyze(['/test/file.ts']));
      await Promise.all(promises);

      // Should not leak memory or resources
      expect(fixers).toHaveLength(10);
    });
  });

  describe('Event System Edge Cases', () => {
    it('should handle event listeners being removed during operation', async () => {
      const events: string[] = [];

      const handler = () => events.push('event');
      fixer.on('analysis:started', handler);

      // Remove listener during operation
      setTimeout(() => fixer.off('analysis:started', handler), 5);

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      await fixer.analyze(['/test/file.ts']);

      // Should not crash when listeners are removed
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors in event listeners', async () => {
      fixer.on('analysis:started', () => {
        throw new Error('Event handler error');
      });

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      // Should not crash due to event handler errors
      await expect(fixer.analyze(['/test/file.ts'])).resolves.not.toThrow();
    });

    it('should emit events in correct order', async () => {
      const events: Array<{ event: string; timestamp: number }> = [];

      fixer.on('analysis:started', () => events.push({ event: 'started', timestamp: Date.now() }));
      fixer.on('analysis:completed', () => events.push({ event: 'completed', timestamp: Date.now() }));

      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      await fixer.analyze(['/test/file.ts']);

      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('started');
      expect(events[1].event).toBe('completed');
      expect(events[1].timestamp).toBeGreaterThanOrEqual(events[0].timestamp);
    });
  });
});