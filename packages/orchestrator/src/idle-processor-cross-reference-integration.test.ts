/**
 * Tests for CrossReferenceValidator Integration in IdleProcessor
 *
 * This test suite verifies that the CrossReferenceValidator is properly integrated
 * into IdleProcessor.findOutdatedDocumentation() according to the acceptance criteria:
 *
 * 1) CrossReferenceValidator is instantiated in IdleProcessor
 * 2) Symbol index is built using buildIndex()
 * 3) Documentation references are extracted and validated
 * 4) Broken references are added as OutdatedDocumentation with type 'broken-link'
 * 5) Unit tests verify the integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { IdleProcessor } from './idle-processor';
import { CrossReferenceValidator } from './analyzers/cross-reference-validator';
import type { DaemonConfig, OutdatedDocumentation } from '@apexcli/core';
import type { SymbolIndex, DocumentationReference } from './analyzers/cross-reference-validator';
import { TaskStore } from './store';

// Mock the filesystem operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock the CrossReferenceValidator
vi.mock('./analyzers/cross-reference-validator', () => ({
  CrossReferenceValidator: vi.fn(),
}));

describe('IdleProcessor CrossReferenceValidator Integration', () => {
  let idleProcessor: IdleProcessor;
  let mockTaskStore: TaskStore;
  let mockConfig: DaemonConfig;
  let mockCrossRefValidator: any;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    // Setup mocks
    vi.clearAllMocks();

    // Mock config with idle processing enabled
    mockConfig = {
      pollInterval: 5000,
      autoStart: false,
      logLevel: 'info',
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3
      }
    };

    // Mock TaskStore
    mockTaskStore = {
      getTasksByStatus: vi.fn().mockResolvedValue([]),
      getAllTasks: vi.fn().mockResolvedValue([]),
      createTask: vi.fn(),
    } as any;

    // Create mock CrossReferenceValidator instance
    mockCrossRefValidator = {
      buildIndex: vi.fn(),
      extractDocumentationReferences: vi.fn(),
      validateDocumentationReferences: vi.fn(),
      lookupSymbol: vi.fn(),
      getFileSymbols: vi.fn(),
      validateReference: vi.fn()
    };

    // Mock the CrossReferenceValidator constructor
    const MockCrossRefValidator = vi.mocked(CrossReferenceValidator);
    MockCrossRefValidator.mockImplementation(() => mockCrossRefValidator);

    idleProcessor = new IdleProcessor(testProjectPath, mockConfig, mockTaskStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // AC1: CrossReferenceValidator is instantiated in IdleProcessor
  // ============================================================================

  describe('CrossReferenceValidator instantiation', () => {
    it('should instantiate CrossReferenceValidator during findOutdatedDocumentation', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('find') && command.includes('.md')) {
          callback(null, { stdout: './README.md\n', stderr: '' });
        }
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
# Test Documentation
This is a test file with \`SomeFunction()\` reference.
      `);

      // Mock successful validator methods
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map([['SomeFunction', []]]),
        byFile: new Map(),
        stats: { totalSymbols: 1, totalFiles: 1, byType: {} }
      };

      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue([]);
      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue([]);

      // Call the method that should instantiate CrossReferenceValidator
      const processor = idleProcessor as any;
      await processor.findOutdatedDocumentation();

      // Verify CrossReferenceValidator was instantiated
      expect(CrossReferenceValidator).toHaveBeenCalledTimes(1);
      expect(CrossReferenceValidator).toHaveBeenCalledWith();
    });

    it('should handle CrossReferenceValidator instantiation errors gracefully', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './README.md\n', stderr: '' });
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce('# Test Doc');

      // Mock CrossReferenceValidator constructor to throw error
      const MockCrossRefValidator = vi.mocked(CrossReferenceValidator);
      MockCrossRefValidator.mockImplementation(() => {
        throw new Error('Failed to instantiate validator');
      });

      // Should not throw, but handle gracefully
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Should still return array (graceful handling)
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================================
  // AC2: Symbol index is built using buildIndex()
  // ============================================================================

  describe('Symbol index building', () => {
    it('should call buildIndex with correct parameters', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './docs/api.md\n', stderr: '' });
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce('# API Documentation');

      // Mock successful buildIndex
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map([
          ['TestFunction', [{
            name: 'TestFunction',
            type: 'function',
            file: '/src/test.ts',
            line: 10,
            column: 1,
            isExported: true
          }]]
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 1, totalFiles: 1, byType: { function: 1 } }
      };

      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue([]);
      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue([]);

      // Execute the method
      const processor = idleProcessor as any;
      await processor.findOutdatedDocumentation();

      // Verify buildIndex was called with correct parameters
      expect(mockCrossRefValidator.buildIndex).toHaveBeenCalledTimes(1);
      expect(mockCrossRefValidator.buildIndex).toHaveBeenCalledWith(
        testProjectPath,
        {
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
          exclude: ['node_modules/**', 'dist/**', 'build/**', '**/*.test.*', '**/*.spec.*'],
          includePrivate: false,
          includeMembers: true
        }
      );
    });

    it('should handle buildIndex failures gracefully', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './docs/api.md\n', stderr: '' });
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce('# API Documentation');

      // Mock buildIndex to fail
      mockCrossRefValidator.buildIndex.mockRejectedValue(new Error('Failed to build index'));

      // Should handle error gracefully and continue processing other outdated docs
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Should still return array, but without cross-reference validation
      expect(Array.isArray(result)).toBe(true);
      expect(mockCrossRefValidator.buildIndex).toHaveBeenCalledTimes(1);
    });

    it('should use built index for subsequent operations', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './docs/api.md\n', stderr: '' });
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
# API Documentation
Use \`ValidFunction()\` for processing.
      `);

      // Create a mock symbol index
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map([
          ['ValidFunction', [{
            name: 'ValidFunction',
            type: 'function',
            file: '/src/valid.ts',
            line: 5,
            column: 1,
            isExported: true
          }]]
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 1, totalFiles: 1, byType: { function: 1 } }
      };

      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue([]);
      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue([]);

      // Execute the method
      const processor = idleProcessor as any;
      await processor.findOutdatedDocumentation();

      // Verify the built index was passed to subsequent operations
      expect(mockCrossRefValidator.extractDocumentationReferences).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String)
      );
      expect(mockCrossRefValidator.validateDocumentationReferences).toHaveBeenCalledWith(
        mockSymbolIndex,
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // AC3: Documentation references are extracted and validated
  // ============================================================================

  describe('Documentation reference extraction and validation', () => {
    it('should extract documentation references from each documentation file', async () => {
      // Mock finding multiple documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './docs/api.md\n./README.md\n', stderr: '' });
      });

      // Mock file reading for both files
      const mockReadFile = fs.readFile as any;
      mockReadFile
        .mockResolvedValueOnce(`
# API Documentation
Use \`ApiFunction()\` for API calls.
        `)
        .mockResolvedValueOnce(`
# README
The \`MainClass\` handles initialization.
        `);

      // Mock successful operations
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
      };

      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue([]);
      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue([]);

      // Execute the method
      const processor = idleProcessor as any;
      await processor.findOutdatedDocumentation();

      // Verify extractDocumentationReferences was called for each file
      expect(mockCrossRefValidator.extractDocumentationReferences).toHaveBeenCalledTimes(2);

      // Check that each file was processed
      const calls = mockCrossRefValidator.extractDocumentationReferences.mock.calls;
      expect(calls[0][0]).toBe('docs/api.md');
      expect(calls[0][1]).toContain('ApiFunction');
      expect(calls[1][0]).toBe('README.md');
      expect(calls[1][1]).toContain('MainClass');
    });

    it('should validate all extracted references against the symbol index', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './docs/test.md\n', stderr: '' });
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
# Test Documentation
Use \`ValidFunction()\` and \`InvalidFunction()\`.
      `);

      // Mock symbol index with one valid function
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map([
          ['ValidFunction', [{
            name: 'ValidFunction',
            type: 'function',
            file: '/src/valid.ts',
            line: 5,
            column: 1,
            isExported: true
          }]]
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 1, totalFiles: 1, byType: { function: 1 } }
      };

      // Mock extracted references
      const mockReferences: DocumentationReference[] = [
        {
          symbolName: 'ValidFunction',
          referenceType: 'inline-code',
          sourceFile: 'docs/test.md',
          line: 3,
          column: 5,
          context: 'Use `ValidFunction()` and'
        },
        {
          symbolName: 'InvalidFunction',
          referenceType: 'inline-code',
          sourceFile: 'docs/test.md',
          line: 3,
          column: 25,
          context: 'and `InvalidFunction()`.'
        }
      ];

      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue(mockReferences);
      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue([]);

      // Execute the method
      const processor = idleProcessor as any;
      await processor.findOutdatedDocumentation();

      // Verify validateDocumentationReferences was called with extracted references
      expect(mockCrossRefValidator.validateDocumentationReferences).toHaveBeenCalledTimes(1);
      expect(mockCrossRefValidator.validateDocumentationReferences).toHaveBeenCalledWith(
        mockSymbolIndex,
        mockReferences
      );
    });

    it('should handle extraction errors gracefully for individual files', async () => {
      // Mock finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './good.md\n./bad.md\n', stderr: '' });
      });

      // Mock file reading - first succeeds, second fails
      const mockReadFile = fs.readFile as any;
      mockReadFile
        .mockResolvedValueOnce('# Good file')
        .mockRejectedValueOnce(new Error('Cannot read bad file'));

      // Mock successful operations
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
      };

      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue([]);
      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue([]);

      // Should not throw error
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Should still process the good file
      expect(mockCrossRefValidator.extractDocumentationReferences).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================================
  // AC4: Broken references are added as OutdatedDocumentation with type 'broken-link'
  // ============================================================================

  describe('Broken reference detection and reporting', () => {
    it('should add broken references to outdated documentation with correct type and format', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './docs/broken.md\n', stderr: '' });
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
# Documentation with Broken References
Use \`NonExistentFunction()\` for processing.
See \`MissingClass\` for more details.
      `);

      // Mock symbol index without the referenced symbols
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map([
          ['ExistingFunction', [{
            name: 'ExistingFunction',
            type: 'function',
            file: '/src/existing.ts',
            line: 10,
            column: 1,
            isExported: true
          }]]
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 1, totalFiles: 1, byType: { function: 1 } }
      };

      // Mock extracted references
      const mockReferences: DocumentationReference[] = [
        {
          symbolName: 'NonExistentFunction',
          referenceType: 'inline-code',
          sourceFile: 'docs/broken.md',
          line: 3,
          column: 5,
          context: 'Use `NonExistentFunction()` for processing.'
        },
        {
          symbolName: 'MissingClass',
          referenceType: 'inline-code',
          sourceFile: 'docs/broken.md',
          line: 4,
          column: 5,
          context: 'See `MissingClass` for more details.'
        }
      ];

      // Mock broken references returned by validator
      const mockBrokenReferences: OutdatedDocumentation[] = [
        {
          file: 'docs/broken.md',
          type: 'broken-link',
          description: "Reference to non-existent symbol 'NonExistentFunction' in inline-code at line 3. Context: Use `NonExistentFunction()` for processing.",
          line: 3,
          suggestion: 'Symbol not found in codebase',
          severity: 'medium'
        },
        {
          file: 'docs/broken.md',
          type: 'broken-link',
          description: "Reference to non-existent symbol 'MissingClass' in inline-code at line 4. Context: See `MissingClass` for more details.",
          line: 4,
          suggestion: 'Symbol not found in codebase',
          severity: 'medium'
        }
      ];

      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue(mockReferences);
      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue(mockBrokenReferences);

      // Execute the method
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Verify broken references are included in the result
      expect(result).toContainEqual(
        expect.objectContaining({
          file: 'docs/broken.md',
          type: 'broken-link',
          description: expect.stringContaining('NonExistentFunction'),
          line: 3,
          severity: 'medium'
        })
      );

      expect(result).toContainEqual(
        expect.objectContaining({
          file: 'docs/broken.md',
          type: 'broken-link',
          description: expect.stringContaining('MissingClass'),
          line: 4,
          severity: 'medium'
        })
      );
    });

    it('should preserve broken reference details from CrossReferenceValidator', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './docs/test.md\n', stderr: '' });
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce('# Test with `BrokenRef()`');

      // Mock validator components
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
      };

      const mockReferences: DocumentationReference[] = [
        {
          symbolName: 'BrokenRef',
          referenceType: 'see-tag',
          sourceFile: 'docs/test.md',
          line: 1,
          column: 10,
          context: '@see BrokenRef for details'
        }
      ];

      // Mock broken reference with high severity (see-tag)
      const mockBrokenReference: OutdatedDocumentation = {
        file: 'docs/test.md',
        type: 'broken-link',
        description: "Reference to non-existent symbol 'BrokenRef' in see-tag at line 1. Context: @see BrokenRef for details",
        line: 1,
        suggestion: 'Did you mean: BrokenReference?',
        severity: 'high'
      };

      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue(mockReferences);
      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue([mockBrokenReference]);

      // Execute the method
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Verify all details are preserved
      const brokenRef = result.find((item: OutdatedDocumentation) =>
        item.type === 'broken-link' && item.description.includes('BrokenRef')
      );

      expect(brokenRef).toBeDefined();
      expect(brokenRef.file).toBe('docs/test.md');
      expect(brokenRef.type).toBe('broken-link');
      expect(brokenRef.line).toBe(1);
      expect(brokenRef.severity).toBe('high');
      expect(brokenRef.suggestion).toBe('Did you mean: BrokenReference?');
    });

    it('should combine broken references with other outdated documentation types', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './docs/mixed.md\n', stderr: '' });
      });

      // Mock file reading with both deprecated content and broken references
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
# Mixed Documentation
This API is @deprecated.
Use \`NonExistentFunction()\` instead.
      `);

      // Mock validator components
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
      };

      const mockReferences: DocumentationReference[] = [
        {
          symbolName: 'NonExistentFunction',
          referenceType: 'inline-code',
          sourceFile: 'docs/mixed.md',
          line: 3,
          column: 5,
          context: 'Use `NonExistentFunction()` instead.'
        }
      ];

      const mockBrokenReference: OutdatedDocumentation = {
        file: 'docs/mixed.md',
        type: 'broken-link',
        description: "Reference to non-existent symbol 'NonExistentFunction' in inline-code at line 3",
        line: 3,
        suggestion: 'Symbol not found in codebase',
        severity: 'medium'
      };

      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue(mockReferences);
      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue([mockBrokenReference]);

      // Execute the method
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Should contain both deprecated API and broken link
      const deprecatedItems = result.filter((item: OutdatedDocumentation) => item.type === 'deprecated-api');
      const brokenLinkItems = result.filter((item: OutdatedDocumentation) => item.type === 'broken-link');

      expect(deprecatedItems.length).toBeGreaterThan(0);
      expect(brokenLinkItems.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // AC5 & Integration Tests: Complete workflow verification
  // ============================================================================

  describe('Complete integration workflow', () => {
    it('should complete the full cross-reference validation workflow successfully', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './README.md\n./docs/api.md\n', stderr: '' });
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile
        .mockResolvedValueOnce(`
# Project README
Use \`ValidFunction()\` for initialization.
The \`InvalidFunction()\` is no longer available.
        `)
        .mockResolvedValueOnce(`
# API Documentation
Call \`ApiMethod()\` to access the API.
See \`NonExistentClass\` for more details.
        `);

      // Mock symbol index with some valid symbols
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map([
          ['ValidFunction', [{
            name: 'ValidFunction',
            type: 'function',
            file: '/src/main.ts',
            line: 5,
            column: 1,
            isExported: true
          }]],
          ['ApiMethod', [{
            name: 'ApiMethod',
            type: 'method',
            file: '/src/api.ts',
            line: 20,
            column: 5,
            isExported: false,
            parent: 'ApiService'
          }]]
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 2, totalFiles: 2, byType: { function: 1, method: 1 } }
      };

      // Mock extracted references from both files
      const mockReferences: DocumentationReference[] = [
        // From README.md
        {
          symbolName: 'ValidFunction',
          referenceType: 'inline-code',
          sourceFile: 'README.md',
          line: 2,
          column: 5,
          context: 'Use `ValidFunction()` for initialization.'
        },
        {
          symbolName: 'InvalidFunction',
          referenceType: 'inline-code',
          sourceFile: 'README.md',
          line: 3,
          column: 5,
          context: 'The `InvalidFunction()` is no longer available.'
        },
        // From docs/api.md
        {
          symbolName: 'ApiMethod',
          referenceType: 'inline-code',
          sourceFile: 'docs/api.md',
          line: 2,
          column: 5,
          context: 'Call `ApiMethod()` to access the API.'
        },
        {
          symbolName: 'NonExistentClass',
          referenceType: 'see-tag',
          sourceFile: 'docs/api.md',
          line: 3,
          column: 5,
          context: 'See `NonExistentClass` for more details.'
        }
      ];

      // Mock broken references (only the invalid ones)
      const mockBrokenReferences: OutdatedDocumentation[] = [
        {
          file: 'README.md',
          type: 'broken-link',
          description: "Reference to non-existent symbol 'InvalidFunction' in inline-code at line 3. Context: The `InvalidFunction()` is no longer available.",
          line: 3,
          suggestion: 'Symbol not found in codebase',
          severity: 'medium'
        },
        {
          file: 'docs/api.md',
          type: 'broken-link',
          description: "Reference to non-existent symbol 'NonExistentClass' in see-tag at line 3. Context: See `NonExistentClass` for more details.",
          line: 3,
          suggestion: 'Symbol not found in codebase',
          severity: 'high'
        }
      ];

      // Set up all mock methods
      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);

      // Mock extractDocumentationReferences to return references for each file
      mockCrossRefValidator.extractDocumentationReferences
        .mockReturnValueOnce([mockReferences[0], mockReferences[1]]) // README.md
        .mockReturnValueOnce([mockReferences[2], mockReferences[3]]); // docs/api.md

      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue(mockBrokenReferences);

      // Execute the complete workflow
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Verify the complete workflow executed correctly
      expect(CrossReferenceValidator).toHaveBeenCalledTimes(1);
      expect(mockCrossRefValidator.buildIndex).toHaveBeenCalledTimes(1);
      expect(mockCrossRefValidator.extractDocumentationReferences).toHaveBeenCalledTimes(2);
      expect(mockCrossRefValidator.validateDocumentationReferences).toHaveBeenCalledTimes(1);

      // Verify broken references are in the final result
      const brokenLinkResults = result.filter((item: OutdatedDocumentation) => item.type === 'broken-link');
      expect(brokenLinkResults).toHaveLength(2);

      // Verify specific broken references
      expect(brokenLinkResults).toContainEqual(
        expect.objectContaining({
          file: 'README.md',
          type: 'broken-link',
          description: expect.stringContaining('InvalidFunction'),
          severity: 'medium'
        })
      );

      expect(brokenLinkResults).toContainEqual(
        expect.objectContaining({
          file: 'docs/api.md',
          type: 'broken-link',
          description: expect.stringContaining('NonExistentClass'),
          severity: 'high'
        })
      );
    });

    it('should handle empty symbol index gracefully', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './docs/test.md\n', stderr: '' });
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce('# Test with `SomeFunction()`');

      // Mock empty symbol index
      const emptySymbolIndex: SymbolIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
      };

      const mockReferences: DocumentationReference[] = [
        {
          symbolName: 'SomeFunction',
          referenceType: 'inline-code',
          sourceFile: 'docs/test.md',
          line: 1,
          column: 10,
          context: '# Test with `SomeFunction()`'
        }
      ];

      const mockBrokenReference: OutdatedDocumentation = {
        file: 'docs/test.md',
        type: 'broken-link',
        description: "Reference to non-existent symbol 'SomeFunction' in inline-code at line 1",
        line: 1,
        suggestion: 'Symbol not found in codebase',
        severity: 'medium'
      };

      mockCrossRefValidator.buildIndex.mockResolvedValue(emptySymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue(mockReferences);
      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue([mockBrokenReference]);

      // Execute the method
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Should still work and detect all references as broken (since no symbols exist)
      const brokenLinks = result.filter((item: OutdatedDocumentation) => item.type === 'broken-link');
      expect(brokenLinks.length).toBeGreaterThan(0);
    });

    it('should handle no documentation files gracefully', async () => {
      // Mock exec to return no documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      // Should not attempt to build index if no docs exist
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Verify CrossReferenceValidator was not used (no docs to process)
      expect(mockCrossRefValidator.buildIndex).not.toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  describe('Error handling and edge cases', () => {
    it('should continue processing other outdated docs even if cross-reference validation fails', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './deprecated.md\n', stderr: '' });
      });

      // Mock file reading with deprecated content
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
# Deprecated Documentation
This API is @deprecated and should be replaced.
Use \`NewFunction()\` instead of old functions.
      `);

      // Mock buildIndex to fail
      mockCrossRefValidator.buildIndex.mockRejectedValue(new Error('Index build failed'));

      // Should still process other types of outdated documentation
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Should detect deprecated API even though cross-reference validation failed
      const deprecatedItems = result.filter((item: OutdatedDocumentation) => item.type === 'deprecated-api');
      expect(deprecatedItems.length).toBeGreaterThan(0);

      // But should not include broken-link items since validation failed
      const brokenLinkItems = result.filter((item: OutdatedDocumentation) => item.type === 'broken-link');
      expect(brokenLinkItems).toHaveLength(0);
    });

    it('should handle individual file processing failures during cross-reference validation', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './good.md\n./bad.md\n', stderr: '' });
      });

      // Mock file reading - good file succeeds, bad file fails
      const mockReadFile = fs.readFile as any;
      mockReadFile
        .mockResolvedValueOnce('# Good file with `GoodFunction()`')
        .mockRejectedValueOnce(new Error('Cannot read bad file'));

      // Mock validator components
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
      };

      const mockReferences: DocumentationReference[] = [
        {
          symbolName: 'GoodFunction',
          referenceType: 'inline-code',
          sourceFile: 'good.md',
          line: 1,
          column: 10,
          context: '# Good file with `GoodFunction()`'
        }
      ];

      const mockBrokenReference: OutdatedDocumentation = {
        file: 'good.md',
        type: 'broken-link',
        description: "Reference to non-existent symbol 'GoodFunction' in inline-code at line 1",
        line: 1,
        suggestion: 'Symbol not found in codebase',
        severity: 'medium'
      };

      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue(mockReferences);
      mockCrossRefValidator.validateDocumentationReferences.mockReturnValue([mockBrokenReference]);

      // Should process the good file successfully
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Should process the good file
      expect(mockCrossRefValidator.extractDocumentationReferences).toHaveBeenCalledTimes(1);

      // Should include broken reference from good file
      const brokenLinks = result.filter((item: OutdatedDocumentation) => item.type === 'broken-link');
      expect(brokenLinks).toHaveLength(1);
      expect(brokenLinks[0].file).toBe('good.md');
    });

    it('should handle validateDocumentationReferences throwing an error', async () => {
      // Mock exec for finding documentation files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './test.md\n', stderr: '' });
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce('# Test content');

      // Mock validator components
      const mockSymbolIndex: SymbolIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
      };

      mockCrossRefValidator.buildIndex.mockResolvedValue(mockSymbolIndex);
      mockCrossRefValidator.extractDocumentationReferences.mockReturnValue([]);

      // Mock validateDocumentationReferences to throw error
      mockCrossRefValidator.validateDocumentationReferences.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      // Should handle error gracefully
      const processor = idleProcessor as any;
      const result = await processor.findOutdatedDocumentation();

      // Should still return an array (graceful error handling)
      expect(Array.isArray(result)).toBe(true);
      expect(mockCrossRefValidator.validateDocumentationReferences).toHaveBeenCalledTimes(1);
    });
  });
});