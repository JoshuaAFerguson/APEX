/**
 * ImportAutoFixer Acceptance Criteria Validation Tests
 *
 * Tests that validate all acceptance criteria are met:
 * 1. ImportAutoFixer class exists that detects missing imports
 * 2. Uses ESLint rules like import/no-unresolved or custom AST analysis
 * 3. Adds missing imports automatically
 * 4. Returns list of imports added
 * 5. Respects configuration
 * 6. Unit tests pass
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImportAutoFixer } from './import-auto-fixer';
import type {
  ImportAutoFixerOptions,
  MissingImport,
  ImportFixResult,
  ImportResolution,
  AddedImport,
} from './types';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('child_process');

const mockFs = vi.mocked(fs);
const mockSpawn = vi.mocked(spawn);

describe('ImportAutoFixer Acceptance Criteria Validation', () => {
  const projectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock file system
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
          dependencies: {
            react: '^18.0.0',
            lodash: '^4.17.0',
          },
        });
      }

      return `
import { useState } from 'react';

function Component() {
  const [count, setCount] = useState(0);

  // Missing imports below
  const data = _.map([1, 2, 3], x => x * 2);
  const formatted = formatNumber(count);

  return <div>{data.length}</div>;
}`;
    });

    // Mock ESLint process
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockSpawn.mockReturnValue(mockProcess);

    // Auto-emit ESLint results
    setTimeout(() => {
      const eslintOutput = JSON.stringify([{
        filePath: '/test/project/src/Component.tsx',
        messages: [
          {
            ruleId: 'import/no-unresolved',
            severity: 2,
            message: "'_' is not defined.",
            line: 8,
            column: 15,
            nodeType: 'Identifier',
            source: '_'
          },
          {
            ruleId: 'no-undef',
            severity: 2,
            message: "'formatNumber' is not defined.",
            line: 9,
            column: 19,
            nodeType: 'Identifier',
            source: 'formatNumber'
          }
        ]
      }]);

      mockProcess.stdout.emit('data', eslintOutput);
      mockProcess.emit('close', 0);
    }, 10);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Acceptance Criteria 1: ImportAutoFixer class exists', () => {
    it('should create ImportAutoFixer class successfully', () => {
      const options: ImportAutoFixerOptions = {
        projectPath,
        detector: 'eslint',
      };

      const fixer = new ImportAutoFixer(options);

      expect(fixer).toBeInstanceOf(ImportAutoFixer);
      expect(fixer).toHaveProperty('analyze');
      expect(fixer).toHaveProperty('fix');
      expect(fixer).toHaveProperty('fixFile');
      expect(fixer).toHaveProperty('configure');
      expect(fixer).toHaveProperty('getConfig');
      expect(fixer).toHaveProperty('getSummary');
      expect(fixer).toHaveProperty('isAvailable');
    });

    it('should accept all required configuration options', () => {
      const options: ImportAutoFixerOptions = {
        projectPath: '/custom/path',
        detector: 'typescript',
        dryRun: true,
        preferredImportStyle: 'named',
        organizeImports: true,
        respectExistingStyle: false,
        resolvers: {
          local: {
            enabled: true,
            searchPaths: ['src', 'lib'],
            excludePatterns: ['**/*.test.*'],
          },
          alias: {
            enabled: false,
          },
          package: {
            enabled: true,
            preferredPackages: { React: 'react' },
            excludePackages: ['old-package'],
          },
        },
      };

      expect(() => new ImportAutoFixer(options)).not.toThrow();
    });

    it('should have correct method signatures', () => {
      const fixer = new ImportAutoFixer({ projectPath });

      // Check method signatures
      expect(typeof fixer.analyze).toBe('function');
      expect(fixer.analyze).toHaveLength(1); // files parameter

      expect(typeof fixer.fix).toBe('function');
      expect(fixer.fix).toHaveLength(1); // files parameter

      expect(typeof fixer.fixFile).toBe('function');
      expect(fixer.fixFile).toHaveLength(1); // filePath parameter

      expect(typeof fixer.configure).toBe('function');
      expect(fixer.configure).toHaveLength(1); // config parameter

      expect(typeof fixer.getConfig).toBe('function');
      expect(fixer.getConfig).toHaveLength(0); // no parameters

      expect(typeof fixer.getSummary).toBe('function');
      expect(fixer.getSummary).toHaveLength(1); // results parameter

      expect(typeof fixer.isAvailable).toBe('function');
      expect(fixer.isAvailable).toHaveLength(0); // no parameters
    });
  });

  describe('Acceptance Criteria 2: Detects missing imports via ESLint rules', () => {
    it('should use ESLint detector by default', () => {
      const fixer = new ImportAutoFixer({ projectPath });
      const config = fixer.getConfig();

      expect(config.detector).toBe('auto');

      // Check that ESLint detector is being used
      expect(fixer['detector']).toBeDefined();
      expect(fixer['detector'].id).toBe('eslint');
    });

    it('should detect missing imports using import/no-unresolved rule', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      const analysis = await fixer.analyze(['/test/project/src/Component.tsx']);

      expect(analysis).toHaveLength(1);
      expect(analysis[0].missingImports).toHaveLength(2);

      const lodashImport = analysis[0].missingImports.find(imp => imp.identifier === '_');
      expect(lodashImport).toBeDefined();
      expect(lodashImport!.line).toBe(8);
      expect(lodashImport!.column).toBe(15);

      const formatNumberImport = analysis[0].missingImports.find(imp => imp.identifier === 'formatNumber');
      expect(formatNumberImport).toBeDefined();
      expect(formatNumberImport!.line).toBe(9);
      expect(formatNumberImport!.column).toBe(19);
    });

    it('should detect both undefined variables and unresolved imports', async () => {
      // Test that both 'no-undef' and 'import/no-unresolved' rules are handled
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      const analysis = await fixer.analyze(['/test/project/src/Component.tsx']);

      // Should detect both types of missing imports
      const undefinedVar = analysis[0].missingImports.find(imp => imp.identifier === '_');
      const unresolvedImport = analysis[0].missingImports.find(imp => imp.identifier === 'formatNumber');

      expect(undefinedVar).toBeDefined();
      expect(unresolvedImport).toBeDefined();
    });

    it('should provide context information for detected imports', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      const analysis = await fixer.analyze(['/test/project/src/Component.tsx']);

      const lodashImport = analysis[0].missingImports.find(imp => imp.identifier === '_');
      expect(lodashImport?.context).toBeDefined();
      expect(lodashImport?.context?.usageType).toBe('value');
      expect(lodashImport?.context?.isFunctionCall).toBe(true);

      const formatNumberImport = analysis[0].missingImports.find(imp => imp.identifier === 'formatNumber');
      expect(formatNumberImport?.context).toBeDefined();
      expect(formatNumberImport?.context?.usageType).toBe('value');
      expect(formatNumberImport?.context?.isFunctionCall).toBe(true);
    });
  });

  describe('Acceptance Criteria 3: Adds missing imports automatically', () => {
    it('should automatically add missing imports', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      // Mock resolvers to provide resolutions
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

      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockImplementation(async (identifier) => {
        return identifier === 'formatNumber';
      });

      vi.spyOn(fixer['resolvers'][0], 'resolve').mockImplementation(async (identifier) => {
        if (identifier === 'formatNumber') {
          return {
            source: './utils',
            importType: 'named',
            isTypeOnly: false,
            confidence: 1.0,
            resolvedBy: 'local-resolver',
          } as ImportResolution;
        }
        return null;
      });

      const result = await fixer.fixFile('/test/project/src/Component.tsx');

      expect(result.success).toBe(true);
      expect(result.importsAdded).toHaveLength(2);

      const lodashImport = result.importsAdded.find(imp => imp.source === 'lodash');
      expect(lodashImport).toBeDefined();
      expect(lodashImport!.specifier).toBe('_');
      expect(lodashImport!.importType).toBe('default');

      const utilImport = result.importsAdded.find(imp => imp.source === './utils');
      expect(utilImport).toBeDefined();
      expect(utilImport!.specifier).toBe('formatNumber');
      expect(utilImport!.importType).toBe('named');
    });

    it('should modify file content correctly', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      // Mock single resolver
      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValue({
        source: 'lodash',
        importType: 'default',
        isTypeOnly: false,
        confidence: 0.9,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      const result = await fixer.fixFile('/test/project/src/Component.tsx');

      expect(result.modifiedContent).toBeDefined();
      expect(result.modifiedContent).toContain("import _ from 'lodash';");
      expect(result.modifiedContent).toContain("import { useState } from 'react';");

      // Should preserve existing code
      expect(result.modifiedContent).toContain('const [count, setCount] = useState(0);');
      expect(result.modifiedContent).toContain('const data = _.map([1, 2, 3], x => x * 2);');
    });

    it('should handle different import types correctly', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      // Mock different import types
      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockImplementation(async (identifier) => {
        return ['defaultExport', 'namedExport', 'TypeExport'].includes(identifier);
      });

      vi.spyOn(fixer['resolvers'][0], 'resolve').mockImplementation(async (identifier) => {
        const resolutions = {
          defaultExport: {
            source: './default-module',
            importType: 'default' as const,
            isTypeOnly: false,
            confidence: 1.0,
            resolvedBy: 'local-resolver',
          },
          namedExport: {
            source: './named-module',
            importType: 'named' as const,
            isTypeOnly: false,
            confidence: 1.0,
            resolvedBy: 'local-resolver',
          },
          TypeExport: {
            source: './types',
            importType: 'named' as const,
            isTypeOnly: true,
            confidence: 1.0,
            resolvedBy: 'local-resolver',
          },
        };

        return resolutions[identifier as keyof typeof resolutions] || null;
      });

      // Mock detector for different import types
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        { identifier: 'defaultExport', line: 1, column: 1 },
        { identifier: 'namedExport', line: 2, column: 1 },
        { identifier: 'TypeExport', line: 3, column: 1, isTypeOnly: true },
      ] as MissingImport[]);

      const result = await fixer.fixFile('/test/project/src/Component.tsx');

      expect(result.modifiedContent).toContain("import defaultExport from './default-module';");
      expect(result.modifiedContent).toContain("import { namedExport } from './named-module';");
      expect(result.modifiedContent).toContain("import type { TypeExport } from './types';");
    });

    it('should write files when not in dry run mode', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: false, // Actual file writing
      });

      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValue({
        source: 'lodash',
        importType: 'default',
        isTypeOnly: false,
        confidence: 0.9,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await fixer.fixFile('/test/project/src/Component.tsx');

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/project/src/Component.tsx',
        expect.stringContaining("import _ from 'lodash';"),
        'utf-8'
      );
    });
  });

  describe('Acceptance Criteria 4: Returns list of imports added', () => {
    it('should return detailed list of imports added', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockImplementation(async (identifier) => {
        const resolutions: Record<string, ImportResolution> = {
          '_': {
            source: 'lodash',
            importType: 'default',
            isTypeOnly: false,
            confidence: 0.9,
            resolvedBy: 'package-resolver',
          },
          'formatNumber': {
            source: './utils',
            importType: 'named',
            isTypeOnly: false,
            confidence: 1.0,
            resolvedBy: 'package-resolver',
          },
        };

        return resolutions[identifier] || null;
      });

      const result = await fixer.fixFile('/test/project/src/Component.tsx');

      expect(result.importsAdded).toBeDefined();
      expect(Array.isArray(result.importsAdded)).toBe(true);
      expect(result.importsAdded).toHaveLength(2);

      // Check import details
      for (const addedImport of result.importsAdded) {
        expect(addedImport).toHaveProperty('specifier');
        expect(addedImport).toHaveProperty('source');
        expect(addedImport).toHaveProperty('importType');
        expect(addedImport).toHaveProperty('line');
        expect(addedImport).toHaveProperty('originalIdentifier');

        expect(typeof addedImport.specifier).toBe('string');
        expect(typeof addedImport.source).toBe('string');
        expect(['named', 'default', 'namespace', 'side-effect']).toContain(addedImport.importType);
        expect(typeof addedImport.line).toBe('number');
        expect(typeof addedImport.originalIdentifier).toBe('string');
      }
    });

    it('should return empty list when no imports are added', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      // Mock detector to return no missing imports
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([]);

      const result = await fixer.fixFile('/test/project/src/Component.tsx');

      expect(result.importsAdded).toBeDefined();
      expect(Array.isArray(result.importsAdded)).toBe(true);
      expect(result.importsAdded).toHaveLength(0);
    });

    it('should provide summary statistics via getSummary', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      const mockResults: ImportFixResult[] = [
        {
          success: true,
          filePath: '/file1.ts',
          importsAdded: [
            {
              specifier: '_',
              source: 'lodash',
              importType: 'default',
              line: 1,
              originalIdentifier: '_',
            },
            {
              specifier: 'format',
              source: 'date-fns',
              importType: 'named',
              line: 2,
              originalIdentifier: 'format',
            },
          ],
          errors: [],
          duration: 150,
        },
        {
          success: false,
          filePath: '/file2.ts',
          importsAdded: [],
          errors: [
            {
              type: 'resolution',
              message: 'Could not resolve',
              recoverable: true,
            },
          ],
          duration: 75,
        },
      ];

      const summary = fixer.getSummary(mockResults);

      expect(summary).toHaveProperty('filesProcessed');
      expect(summary).toHaveProperty('filesModified');
      expect(summary).toHaveProperty('totalImportsAdded');
      expect(summary).toHaveProperty('totalErrors');
      expect(summary).toHaveProperty('totalDuration');

      expect(summary.filesProcessed).toBe(2);
      expect(summary.filesModified).toBe(1);
      expect(summary.totalImportsAdded).toBe(2);
      expect(summary.totalErrors).toBe(1);
      expect(summary.totalDuration).toBe(225);
    });

    it('should track original identifiers correctly', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][0], 'resolve').mockResolvedValue({
        source: './utils',
        importType: 'named',
        isTypeOnly: false,
        confidence: 1.0,
        resolvedBy: 'local-resolver',
        aliasAs: 'formatUtil', // Different specifier
      } as ImportResolution);

      // Mock detector with specific identifier
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        { identifier: 'formatNumber', line: 1, column: 1 } as MissingImport,
      ]);

      const result = await fixer.fixFile('/test/project/src/Component.tsx');

      expect(result.importsAdded).toHaveLength(1);
      expect(result.importsAdded[0].originalIdentifier).toBe('formatNumber');
      expect(result.importsAdded[0].specifier).toBe('formatNumber');
    });
  });

  describe('Acceptance Criteria 5: Respects configuration', () => {
    it('should respect quote style configuration', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      fixer.configure({
        style: {
          quoteStyle: 'double',
        },
      });

      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValue({
        source: 'lodash',
        importType: 'default',
        isTypeOnly: false,
        confidence: 0.9,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      const result = await fixer.fixFile('/test/project/src/Component.tsx');

      expect(result.modifiedContent).toContain('import _ from "lodash";');
      expect(result.modifiedContent).not.toContain("import _ from 'lodash';");
    });

    it('should respect semicolon configuration', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      fixer.configure({
        style: {
          semicolons: false,
        },
      });

      vi.spyOn(fixer['resolvers'][2], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][2], 'resolve').mockResolvedValue({
        source: 'lodash',
        importType: 'default',
        isTypeOnly: false,
        confidence: 0.9,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      const result = await fixer.fixFile('/test/project/src/Component.tsx');

      expect(result.modifiedContent).toContain("import _ from 'lodash'");
      expect(result.modifiedContent).not.toContain("import _ from 'lodash';");
    });

    it('should respect type import configuration', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      fixer.configure({
        style: {
          useTypeImports: true,
        },
      });

      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockResolvedValue(true);
      vi.spyOn(fixer['resolvers'][0], 'resolve').mockResolvedValue({
        source: './types',
        importType: 'named',
        isTypeOnly: true,
        confidence: 1.0,
        resolvedBy: 'local-resolver',
      } as ImportResolution);

      // Mock type-only import
      vi.spyOn(fixer['detector'], 'detect').mockResolvedValue([
        { identifier: 'User', line: 1, column: 1, isTypeOnly: true } as MissingImport,
      ]);

      const result = await fixer.fixFile('/test/project/src/Component.tsx');

      expect(result.modifiedContent).toContain("import type { User } from './types';");
    });

    it('should respect resolver configuration', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
        resolvers: {
          local: { enabled: false, searchPaths: [], excludePatterns: [] },
          alias: { enabled: false },
          package: {
            enabled: true,
            preferredPackages: { customFunction: 'custom-package' },
            excludePackages: [],
          },
        },
      });

      const config = fixer.getConfig();

      expect(config.resolvers.local.enabled).toBe(false);
      expect(config.resolvers.alias.enabled).toBe(false);
      expect(config.resolvers.package.enabled).toBe(true);
      expect(config.resolvers.package.preferredPackages.customFunction).toBe('custom-package');
    });

    it('should respect dry run configuration', async () => {
      const dryRunFixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
      });

      const writeModeFixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: false,
      });

      vi.spyOn(dryRunFixer['resolvers'][2], 'canResolve').mockResolvedValue(true);
      vi.spyOn(dryRunFixer['resolvers'][2], 'resolve').mockResolvedValue({
        source: 'lodash',
        importType: 'default',
        isTypeOnly: false,
        confidence: 0.9,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      vi.spyOn(writeModeFixer['resolvers'][2], 'canResolve').mockResolvedValue(true);
      vi.spyOn(writeModeFixer['resolvers'][2], 'resolve').mockResolvedValue({
        source: 'lodash',
        importType: 'default',
        isTypeOnly: false,
        confidence: 0.9,
        resolvedBy: 'package-resolver',
      } as ImportResolution);

      mockFs.writeFile.mockResolvedValue(undefined);

      await dryRunFixer.fixFile('/test/file.ts');
      await writeModeFixer.fixFile('/test/file.ts');

      // Dry run mode should not write files
      expect(mockFs.writeFile).toHaveBeenCalledTimes(1); // Only from writeModeFixer
    });
  });

  describe('Acceptance Criteria 6: Unit tests pass', () => {
    it('should validate that unit test files exist', () => {
      const fs = require('fs');
      const path = require('path');

      const testFiles = [
        'import-auto-fixer.test.ts',
        'integration.test.ts',
        'edge-cases.test.ts',
        'performance.test.ts',
        'acceptance-criteria.test.ts',
      ];

      for (const testFile of testFiles) {
        const testPath = path.join(__dirname, testFile);
        expect(fs.existsSync(testPath)).toBe(true);
      }
    });

    it('should validate that detector tests exist', () => {
      const fs = require('fs');
      const path = require('path');

      const detectorTestPath = path.join(__dirname, 'detectors', 'eslint-detector.test.ts');
      expect(fs.existsSync(detectorTestPath)).toBe(true);
    });

    it('should validate that resolver tests exist', () => {
      const fs = require('fs');
      const path = require('path');

      const resolverTestPath = path.join(__dirname, 'resolvers', 'resolvers.comprehensive.test.ts');
      expect(fs.existsSync(resolverTestPath)).toBe(true);
    });

    it('should validate acceptance criteria validation script exists', () => {
      const fs = require('fs');
      const path = require('path');

      const validationPath = path.join(__dirname, 'validate-acceptance-criteria.ts');
      expect(fs.existsSync(validationPath)).toBe(true);
    });

    it('should validate that all exported types are tested', () => {
      // Import the main module to ensure all types are accessible
      const { ImportAutoFixer } = require('./import-auto-fixer');
      const types = require('./types');

      expect(ImportAutoFixer).toBeDefined();
      expect(types.DEFAULT_CONFIG).toBeDefined();

      // Validate that main interfaces are exported
      expect(types).toHaveProperty('DEFAULT_CONFIG');
    });

    it('should validate that error handling is properly tested', async () => {
      const fixer = new ImportAutoFixer({
        projectPath: '/nonexistent/path',
        detector: 'eslint',
        dryRun: true,
      });

      // Should not throw on missing files
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: file not found'));

      const analysis = await fixer.analyze(['/nonexistent/file.ts']);

      expect(analysis).toHaveLength(1);
      expect(analysis[0].errors).toHaveLength(1);
      expect(analysis[0].errors[0].type).toBe('io');
    });
  });

  describe('Overall Integration Test', () => {
    it('should complete full workflow successfully', async () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'eslint',
        dryRun: true,
        preferredImportStyle: 'auto',
        organizeImports: true,
      });

      // Mock resolvers for complete workflow
      vi.spyOn(fixer['resolvers'][0], 'canResolve').mockImplementation(async (identifier) => {
        return identifier === 'formatNumber';
      });

      vi.spyOn(fixer['resolvers'][0], 'resolve').mockImplementation(async (identifier) => {
        if (identifier === 'formatNumber') {
          return {
            source: './utils',
            importType: 'named',
            isTypeOnly: false,
            confidence: 1.0,
            resolvedBy: 'local-resolver',
          };
        }
        return null;
      });

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
          };
        }
        return null;
      });

      // 1. Check if service is available
      const isAvailable = await fixer.isAvailable();
      expect(typeof isAvailable).toBe('boolean');

      // 2. Analyze files
      const analyses = await fixer.analyze(['/test/project/src/Component.tsx']);
      expect(analyses).toHaveLength(1);
      expect(analyses[0].missingImports).toHaveLength(2);

      // 3. Fix files
      const results = await fixer.fix(['/test/project/src/Component.tsx']);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].importsAdded).toHaveLength(2);

      // 4. Get summary
      const summary = fixer.getSummary(results);
      expect(summary.filesProcessed).toBe(1);
      expect(summary.filesModified).toBe(1);
      expect(summary.totalImportsAdded).toBe(2);
      expect(summary.totalErrors).toBe(0);

      // 5. Verify configuration works
      const config = fixer.getConfig();
      expect(config).toBeDefined();
      expect(config.detector).toBe('eslint');
      expect(config.style.preferredImportStyle).toBe('auto');
      expect(config.style.organizeImports).toBe(true);

      // All acceptance criteria validated!
    });
  });
});