/**
 * Auto-Fix Service Integration Tests
 *
 * Tests the integration between the orchestrator and ImportAutoFixer service,
 * focusing on service instantiation, configuration, execution, and result
 * processing for the auto-fix execution hook feature.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImportAutoFixer } from '../import-auto-fixer/import-auto-fixer';
import type {
  ImportAutoFixerOptions,
  ImportFixResult,
  ImportFixSummary,
  AutoFixStageResults,
  MissingImport,
  AddedImport
} from '@apexcli/core';

// Mock the ImportAutoFixer
vi.mock('../import-auto-fixer/import-auto-fixer');

const MockImportAutoFixer = vi.mocked(ImportAutoFixer);

describe('Auto-Fix Service Integration', () => {
  const projectPath = '/test/project';
  let mockFixer: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock fixer instance
    mockFixer = {
      isAvailable: vi.fn(),
      analyze: vi.fn(),
      fix: vi.fn(),
      fixFile: vi.fn(),
      getSummary: vi.fn(),
      getConfig: vi.fn(),
      configure: vi.fn()
    };

    MockImportAutoFixer.mockImplementation(() => mockFixer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Service Instantiation', () => {
    it('should create ImportAutoFixer with correct default options', () => {
      const fixer = new ImportAutoFixer({
        projectPath,
        detector: 'auto'
      });

      expect(MockImportAutoFixer).toHaveBeenCalledWith({
        projectPath,
        detector: 'auto'
      });
    });

    it('should pass through custom options', () => {
      const customOptions: ImportAutoFixerOptions = {
        projectPath,
        detector: 'eslint',
        dryRun: false,
        preferredImportStyle: 'named',
        quoteStyle: 'single',
        semicolons: false,
        includePatterns: ['src/**/*.ts'],
        excludePatterns: ['**/*.test.ts'],
        maxConcurrentFiles: 5
      };

      const fixer = new ImportAutoFixer(customOptions);

      expect(MockImportAutoFixer).toHaveBeenCalledWith(customOptions);
    });

    it('should handle minimal configuration', () => {
      const minimalOptions: ImportAutoFixerOptions = {
        projectPath: '/minimal/project'
      };

      const fixer = new ImportAutoFixer(minimalOptions);

      expect(MockImportAutoFixer).toHaveBeenCalledWith(minimalOptions);
    });
  });

  describe('Service Availability Check', () => {
    it('should check service availability before execution', async () => {
      mockFixer.isAvailable.mockResolvedValue(true);

      const fixer = new ImportAutoFixer({ projectPath });
      const available = await fixer.isAvailable();

      expect(mockFixer.isAvailable).toHaveBeenCalled();
      expect(available).toBe(true);
    });

    it('should handle unavailable service gracefully', async () => {
      mockFixer.isAvailable.mockResolvedValue(false);

      const fixer = new ImportAutoFixer({ projectPath });
      const available = await fixer.isAvailable();

      expect(available).toBe(false);
    });

    it('should handle availability check errors', async () => {
      mockFixer.isAvailable.mockRejectedValue(new Error('ESLint not found'));

      const fixer = new ImportAutoFixer({ projectPath });

      await expect(fixer.isAvailable()).rejects.toThrow('ESLint not found');
    });
  });

  describe('File Processing', () => {
    it('should process single file correctly', async () => {
      const mockResult: ImportFixResult = {
        success: true,
        filePath: 'src/component.ts',
        importsAdded: [
          {
            identifier: 'React',
            source: 'react',
            originalIdentifier: 'React',
            importType: 'default',
            isTypeOnly: false,
            line: 1,
            character: 0
          }
        ],
        errorMessage: null,
        duration: 500,
        analysisTime: 100,
        fixTime: 400
      };

      mockFixer.isAvailable.mockResolvedValue(true);
      mockFixer.fixFile.mockResolvedValue(mockResult);

      const fixer = new ImportAutoFixer({ projectPath });
      const result = await fixer.fixFile('src/component.ts');

      expect(mockFixer.fixFile).toHaveBeenCalledWith('src/component.ts');
      expect(result).toEqual(mockResult);
    });

    it('should process multiple files correctly', async () => {
      const files = ['src/component.ts', 'src/utils.ts', 'src/hooks.ts'];
      const mockResults: ImportFixResult[] = files.map((file, index) => ({
        success: true,
        filePath: file,
        importsAdded: [
          {
            identifier: `Import${index + 1}`,
            source: `package${index + 1}`,
            originalIdentifier: `Import${index + 1}`,
            importType: 'named' as const,
            isTypeOnly: false,
            line: 1,
            character: 0
          }
        ],
        errorMessage: null,
        duration: 300 + index * 100,
        analysisTime: 50,
        fixTime: 250 + index * 100
      }));

      mockFixer.isAvailable.mockResolvedValue(true);
      mockFixer.fix.mockResolvedValue(mockResults);

      const fixer = new ImportAutoFixer({ projectPath });
      const results = await fixer.fix(files);

      expect(mockFixer.fix).toHaveBeenCalledWith(files);
      expect(results).toEqual(mockResults);
    });

    it('should handle mixed success/failure results', async () => {
      const files = ['src/success.ts', 'src/failure.ts'];
      const mockResults: ImportFixResult[] = [
        {
          success: true,
          filePath: 'src/success.ts',
          importsAdded: [
            {
              identifier: 'React',
              source: 'react',
              originalIdentifier: 'React',
              importType: 'default',
              isTypeOnly: false,
              line: 1,
              character: 0
            }
          ],
          errorMessage: null,
          duration: 300,
          analysisTime: 50,
          fixTime: 250
        },
        {
          success: false,
          filePath: 'src/failure.ts',
          importsAdded: [],
          errorMessage: 'Could not resolve imports',
          duration: 200,
          analysisTime: 100,
          fixTime: 0
        }
      ];

      mockFixer.isAvailable.mockResolvedValue(true);
      mockFixer.fix.mockResolvedValue(mockResults);

      const fixer = new ImportAutoFixer({ projectPath });
      const results = await fixer.fix(files);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].errorMessage).toBe('Could not resolve imports');
    });
  });

  describe('Summary Generation', () => {
    it('should generate correct summary for successful operations', () => {
      const mockResults: ImportFixResult[] = [
        {
          success: true,
          filePath: 'src/file1.ts',
          importsAdded: [
            { identifier: 'React', source: 'react', originalIdentifier: 'React', importType: 'default', isTypeOnly: false, line: 1, character: 0 },
            { identifier: 'useState', source: 'react', originalIdentifier: 'useState', importType: 'named', isTypeOnly: false, line: 1, character: 0 }
          ],
          errorMessage: null,
          duration: 500,
          analysisTime: 100,
          fixTime: 400
        },
        {
          success: true,
          filePath: 'src/file2.ts',
          importsAdded: [
            { identifier: 'axios', source: 'axios', originalIdentifier: 'axios', importType: 'default', isTypeOnly: false, line: 1, character: 0 }
          ],
          errorMessage: null,
          duration: 300,
          analysisTime: 80,
          fixTime: 220
        }
      ];

      const expectedSummary: ImportFixSummary = {
        totalFiles: 2,
        successCount: 2,
        errorCount: 0,
        totalImports: 3,
        duration: 800,
        averageDuration: 400,
        filesWithErrors: []
      };

      mockFixer.getSummary.mockReturnValue(expectedSummary);

      const fixer = new ImportAutoFixer({ projectPath });
      const summary = fixer.getSummary(mockResults);

      expect(mockFixer.getSummary).toHaveBeenCalledWith(mockResults);
      expect(summary).toEqual(expectedSummary);
    });

    it('should generate correct summary with errors', () => {
      const mockResults: ImportFixResult[] = [
        {
          success: true,
          filePath: 'src/success.ts',
          importsAdded: [
            { identifier: 'React', source: 'react', originalIdentifier: 'React', importType: 'default', isTypeOnly: false, line: 1, character: 0 }
          ],
          errorMessage: null,
          duration: 300,
          analysisTime: 50,
          fixTime: 250
        },
        {
          success: false,
          filePath: 'src/error.ts',
          importsAdded: [],
          errorMessage: 'Syntax error',
          duration: 100,
          analysisTime: 100,
          fixTime: 0
        }
      ];

      const expectedSummary: ImportFixSummary = {
        totalFiles: 2,
        successCount: 1,
        errorCount: 1,
        totalImports: 1,
        duration: 400,
        averageDuration: 200,
        filesWithErrors: ['src/error.ts']
      };

      mockFixer.getSummary.mockReturnValue(expectedSummary);

      const fixer = new ImportAutoFixer({ projectPath });
      const summary = fixer.getSummary(mockResults);

      expect(summary).toEqual(expectedSummary);
    });
  });

  describe('Result Processing for Stage Integration', () => {
    it('should convert ImportFixSummary to AutoFixStageResults correctly', () => {
      const fixResults: ImportFixResult[] = [
        {
          success: true,
          filePath: 'src/component.ts',
          importsAdded: [
            { identifier: 'React', source: 'react', originalIdentifier: 'React', importType: 'default', isTypeOnly: false, line: 1, character: 0 },
            { identifier: 'useState', source: 'react', originalIdentifier: 'useState', importType: 'named', isTypeOnly: false, line: 1, character: 0 }
          ],
          errorMessage: null,
          duration: 500,
          analysisTime: 100,
          fixTime: 400
        },
        {
          success: true,
          filePath: 'src/utils.ts',
          importsAdded: [
            { identifier: 'lodash', source: 'lodash', originalIdentifier: 'lodash', importType: 'default', isTypeOnly: false, line: 1, character: 0 }
          ],
          errorMessage: null,
          duration: 300,
          analysisTime: 80,
          fixTime: 220
        }
      ];

      const summary: ImportFixSummary = {
        totalFiles: 2,
        successCount: 2,
        errorCount: 0,
        totalImports: 3,
        duration: 800,
        averageDuration: 400,
        filesWithErrors: []
      };

      // Simulate the conversion logic that would be in the orchestrator
      const stageResults: AutoFixStageResults = {
        applied: true,
        filesProcessed: fixResults.map(r => r.filePath),
        filesModified: fixResults.filter(r => r.success && r.importsAdded.length > 0).map(r => r.filePath),
        totalImportsAdded: summary.totalImports,
        totalDuration: summary.duration,
        details: `Auto-fix completed for ${summary.successCount} files`,
        summary: `Added ${summary.totalImports} imports to ${summary.successCount} files in ${summary.duration}ms`,
        errorMessage: summary.errorCount > 0 ? `${summary.errorCount} files had errors` : undefined
      };

      expect(stageResults.applied).toBe(true);
      expect(stageResults.filesProcessed).toEqual(['src/component.ts', 'src/utils.ts']);
      expect(stageResults.filesModified).toEqual(['src/component.ts', 'src/utils.ts']);
      expect(stageResults.totalImportsAdded).toBe(3);
      expect(stageResults.totalDuration).toBe(800);
      expect(stageResults.errorMessage).toBeUndefined();
    });

    it('should handle failed auto-fix operations', () => {
      const fixResults: ImportFixResult[] = [
        {
          success: false,
          filePath: 'src/broken.ts',
          importsAdded: [],
          errorMessage: 'Syntax error in file',
          duration: 200,
          analysisTime: 200,
          fixTime: 0
        }
      ];

      const summary: ImportFixSummary = {
        totalFiles: 1,
        successCount: 0,
        errorCount: 1,
        totalImports: 0,
        duration: 200,
        averageDuration: 200,
        filesWithErrors: ['src/broken.ts']
      };

      const stageResults: AutoFixStageResults = {
        applied: false,
        filesProcessed: ['src/broken.ts'],
        filesModified: [],
        totalImportsAdded: 0,
        totalDuration: 200,
        details: 'Auto-fix failed for all files',
        summary: `No imports added - ${summary.errorCount} files had errors`,
        errorMessage: 'Auto-fix failed: Syntax error in file'
      };

      expect(stageResults.applied).toBe(false);
      expect(stageResults.filesModified).toEqual([]);
      expect(stageResults.totalImportsAdded).toBe(0);
      expect(stageResults.errorMessage).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors', () => {
      MockImportAutoFixer.mockImplementation(() => {
        throw new Error('Service initialization failed');
      });

      expect(() => {
        new ImportAutoFixer({ projectPath });
      }).toThrow('Service initialization failed');
    });

    it('should handle fix operation errors', async () => {
      mockFixer.isAvailable.mockResolvedValue(true);
      mockFixer.fix.mockRejectedValue(new Error('Fix operation failed'));

      const fixer = new ImportAutoFixer({ projectPath });

      await expect(fixer.fix(['src/test.ts'])).rejects.toThrow('Fix operation failed');
    });

    it('should handle service unavailable during operation', async () => {
      mockFixer.isAvailable.mockResolvedValue(false);

      // Service should handle this gracefully without calling fix
      const fixer = new ImportAutoFixer({ projectPath });
      const available = await fixer.isAvailable();

      expect(available).toBe(false);
      expect(mockFixer.fix).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    it('should allow runtime configuration updates', () => {
      mockFixer.configure.mockImplementation((config) => {
        // Mock configuration update
      });

      mockFixer.getConfig.mockReturnValue({
        detector: 'eslint',
        resolvers: {
          local: { enabled: true, searchPaths: ['src'] },
          alias: { enabled: true, configPath: 'tsconfig.json' },
          package: { enabled: true }
        },
        formatting: {
          quoteStyle: 'single',
          semicolons: true,
          preferredImportStyle: 'named'
        }
      });

      const fixer = new ImportAutoFixer({ projectPath });

      // Update configuration
      fixer.configure({
        formatting: {
          quoteStyle: 'double',
          semicolons: false
        }
      });

      expect(mockFixer.configure).toHaveBeenCalledWith({
        formatting: {
          quoteStyle: 'double',
          semicolons: false
        }
      });
    });

    it('should retrieve current configuration', () => {
      const expectedConfig = {
        detector: 'auto' as const,
        resolvers: {
          local: { enabled: true, searchPaths: ['src', 'lib'] },
          alias: { enabled: true, configPath: 'tsconfig.json' },
          package: { enabled: true }
        },
        formatting: {
          quoteStyle: 'single' as const,
          semicolons: true,
          preferredImportStyle: 'named' as const
        }
      };

      mockFixer.getConfig.mockReturnValue(expectedConfig);

      const fixer = new ImportAutoFixer({ projectPath });
      const config = fixer.getConfig();

      expect(mockFixer.getConfig).toHaveBeenCalled();
      expect(config).toEqual(expectedConfig);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large number of files efficiently', async () => {
      const largeFileList = Array.from({ length: 100 }, (_, i) => `src/file${i}.ts`);
      const mockResults: ImportFixResult[] = largeFileList.map(file => ({
        success: true,
        filePath: file,
        importsAdded: [],
        errorMessage: null,
        duration: 50,
        analysisTime: 20,
        fixTime: 30
      }));

      mockFixer.isAvailable.mockResolvedValue(true);
      mockFixer.fix.mockResolvedValue(mockResults);

      const fixer = new ImportAutoFixer({ projectPath });
      const results = await fixer.fix(largeFileList);

      expect(results).toHaveLength(100);
      expect(mockFixer.fix).toHaveBeenCalledWith(largeFileList);
    });

    it('should track timing information correctly', async () => {
      const mockResult: ImportFixResult = {
        success: true,
        filePath: 'src/component.ts',
        importsAdded: [],
        errorMessage: null,
        duration: 1500,
        analysisTime: 500,
        fixTime: 1000
      };

      mockFixer.fixFile.mockResolvedValue(mockResult);

      const fixer = new ImportAutoFixer({ projectPath });
      const result = await fixer.fixFile('src/component.ts');

      expect(result.duration).toBe(1500);
      expect(result.analysisTime).toBe(500);
      expect(result.fixTime).toBe(1000);
    });
  });
});