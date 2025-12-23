import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { IdleProcessor } from '../idle-processor.js';
import { TaskStore } from '../store.js';
import { DaemonConfig } from '@apexcli/core';
import { OutdatedDocumentation } from '@apexcli/core';

// Mock fs module
vi.mock('fs');
const mockedFs = vi.mocked(fs);

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

describe('IdleProcessor JSDocDetector Integration', () => {
  let processor: IdleProcessor;
  let mockStore: TaskStore;
  let mockConfig: DaemonConfig;

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
        maxIdleTasks: 3
      }
    } as DaemonConfig;

    processor = new IdleProcessor('/test/project', mockConfig, mockStore);
  });

  describe('validateDeprecatedTags integration', () => {
    it('should call validateDeprecatedTags for source files during documentation analysis', async () => {
      // Mock file operations
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('package.json content') // Package.json
        .mockResolvedValueOnce(`
/**
 * @deprecated This function is outdated
 * Use newMethod() instead
 */
export function oldMethod() {
  return 'old';
}

/**
 * @deprecated
 */
export function poorlyDocumented() {
  return 'bad';
}
        `);

      // Mock exec for finding files
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      // Setup exec responses
      mockExec
        .mockImplementationOnce((cmd, options, callback) => {
          if (cmd.includes('find . -name "*.md"')) {
            callback!(null, { stdout: '1', stderr: '' } as any);
          }
        })
        .mockImplementationOnce((cmd, options, callback) => {
          if (cmd.includes('find . -name "*.ts"') && cmd.includes('wc -l')) {
            callback!(null, { stdout: '10', stderr: '' } as any);
          }
        })
        .mockImplementationOnce((cmd, options, callback) => {
          if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v test')) {
            callback!(null, { stdout: 'src/example.ts', stderr: '' } as any);
          }
        })
        .mockImplementationOnce((cmd, options, callback) => {
          if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
            callback!(null, { stdout: './src/example.ts\n', stderr: '' } as any);
          }
        });

      // Mock validateDeprecatedTags function
      const mockValidateDeprecatedTags = vi.fn().mockReturnValue([
        {
          file: 'src/example.ts',
          type: 'deprecated-api',
          description: '@deprecated tag for poorlyDocumented lacks proper documentation: missing or insufficient explanation',
          line: 10,
          suggestion: 'Add a meaningful explanation (at least 10 characters) describing why this is deprecated',
          severity: 'medium'
        }
      ]);

      // Mock the @apexcli/core import
      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      // Cast to any to access private method
      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();

      // Verify validateDeprecatedTags was called
      expect(mockValidateDeprecatedTags).toHaveBeenCalledWith(
        expect.any(String),
        'src/example.ts'
      );

      // Verify the JSDoc issues are included in outdatedDocs
      expect(analysis.outdatedDocs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            file: 'src/example.ts',
            type: 'deprecated-api',
            description: expect.stringContaining('poorlyDocumented lacks proper documentation'),
            line: 10,
            severity: 'medium'
          })
        ])
      );
    });

    it('should convert JSDoc validation results to OutdatedDocumentation format', async () => {
      // Mock file operations for multiple files
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('package.json content')
        .mockResolvedValueOnce(`
/**
 * @deprecated Old API
 */
export function legacyMethod() {}
        `)
        .mockResolvedValueOnce(`
/**
 * @deprecated
 */
export function badDeprecated() {}
        `);

      // Mock exec
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec
        .mockImplementationOnce((cmd, options, callback) => {
          callback!(null, { stdout: '1', stderr: '' } as any);
        })
        .mockImplementationOnce((cmd, options, callback) => {
          callback!(null, { stdout: '20', stderr: '' } as any);
        })
        .mockImplementationOnce((cmd, options, callback) => {
          callback!(null, { stdout: 'file1.ts\nfile2.ts', stderr: '' } as any);
        })
        .mockImplementationOnce((cmd, options, callback) => {
          callback!(null, { stdout: './file1.ts\n./file2.ts\n', stderr: '' } as any);
        });

      // Mock validateDeprecatedTags to return multiple issues
      const mockValidateDeprecatedTags = vi.fn()
        .mockReturnValueOnce([
          {
            file: 'file1.ts',
            type: 'deprecated-api',
            description: '@deprecated tag for legacyMethod lacks proper documentation: missing migration path',
            line: 3,
            suggestion: 'Add @see tag or include migration path information',
            severity: 'medium'
          }
        ])
        .mockReturnValueOnce([
          {
            file: 'file2.ts',
            type: 'deprecated-api',
            description: '@deprecated tag for badDeprecated lacks proper documentation: missing or insufficient explanation and migration path',
            line: 3,
            suggestion: 'Add a meaningful explanation; Add @see tag or include migration path information',
            severity: 'medium'
          }
        ]);

      // Mock the import
      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();

      // Verify both JSDoc issues are included
      const deprecatedIssues = analysis.outdatedDocs.filter((doc: OutdatedDocumentation) =>
        doc.type === 'deprecated-api'
      );

      expect(deprecatedIssues).toHaveLength(2);
      expect(deprecatedIssues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            file: 'file1.ts',
            type: 'deprecated-api',
            description: expect.stringContaining('legacyMethod lacks proper documentation'),
            severity: 'medium'
          }),
          expect.objectContaining({
            file: 'file2.ts',
            type: 'deprecated-api',
            description: expect.stringContaining('badDeprecated lacks proper documentation'),
            severity: 'medium'
          })
        ])
      );
    });

    it('should handle empty results from validateDeprecatedTags', async () => {
      // Mock file operations
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('package.json content')
        .mockResolvedValueOnce(`
/**
 * @deprecated This is properly documented with explanation
 * Use newAPI() instead for better performance
 */
export function wellDocumentedDeprecated() {}
        `);

      // Mock exec
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec
        .mockImplementation((cmd, options, callback) => {
          if (cmd.includes('find . -name "*.md"')) {
            callback!(null, { stdout: '1', stderr: '' } as any);
          } else if (cmd.includes('find . -name "*.ts"') && cmd.includes('wc -l')) {
            callback!(null, { stdout: '5', stderr: '' } as any);
          } else if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v test')) {
            callback!(null, { stdout: 'good.ts', stderr: '' } as any);
          } else if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
            callback!(null, { stdout: './good.ts\n', stderr: '' } as any);
          } else {
            callback!(null, { stdout: '', stderr: '' } as any);
          }
        });

      // Mock validateDeprecatedTags to return empty array (no issues found)
      const mockValidateDeprecatedTags = vi.fn().mockReturnValue([]);

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();

      // Verify validateDeprecatedTags was called
      expect(mockValidateDeprecatedTags).toHaveBeenCalledWith(
        expect.any(String),
        'good.ts'
      );

      // Verify no JSDoc deprecated issues are reported
      const deprecatedIssues = analysis.outdatedDocs.filter((doc: OutdatedDocumentation) =>
        doc.type === 'deprecated-api'
      );
      expect(deprecatedIssues).toHaveLength(0);
    });

    it('should gracefully handle errors in JSDoc validation', async () => {
      // Mock file operations
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('package.json content')
        .mockResolvedValueOnce('export function test() {}');

      // Mock exec
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec
        .mockImplementation((cmd, options, callback) => {
          if (cmd.includes('find . -name "*.md"')) {
            callback!(null, { stdout: '0', stderr: '' } as any);
          } else if (cmd.includes('find . -name "*.ts"')) {
            if (cmd.includes('wc -l')) {
              callback!(null, { stdout: '1', stderr: '' } as any);
            } else if (cmd.includes('grep -v test')) {
              callback!(null, { stdout: '', stderr: '' } as any);
            } else if (cmd.includes('grep -v node_modules')) {
              callback!(null, { stdout: './error.ts\n', stderr: '' } as any);
            }
          } else {
            callback!(null, { stdout: '', stderr: '' } as any);
          }
        });

      // Mock validateDeprecatedTags to throw an error
      const mockValidateDeprecatedTags = vi.fn().mockImplementation(() => {
        throw new Error('JSDoc parsing error');
      });

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      const processorInternal = processor as any;

      // Should not throw and should return analysis
      const analysis = await processorInternal.analyzeDocumentation();

      expect(analysis).toBeDefined();
      expect(analysis.outdatedDocs).toBeDefined();

      // Verify the error was caught gracefully and no JSDoc issues were added
      const deprecatedIssues = analysis.outdatedDocs.filter((doc: OutdatedDocumentation) =>
        doc.type === 'deprecated-api'
      );
      expect(deprecatedIssues).toHaveLength(0);
    });

    it('should merge JSDoc issues with other outdated documentation findings', async () => {
      // Mock file operations
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('package.json content')
        .mockResolvedValueOnce('README.md content with @deprecated reference')
        .mockResolvedValueOnce(`
/**
 * @deprecated Bad doc
 */
export function poorDoc() {}
        `);

      // Mock exec
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec
        .mockImplementation((cmd, options, callback) => {
          if (cmd.includes('find . -name "*.md"')) {
            callback!(null, { stdout: './README.md\n', stderr: '' } as any);
          } else if (cmd.includes('find . -name "*.ts"') && cmd.includes('wc -l')) {
            callback!(null, { stdout: '5', stderr: '' } as any);
          } else if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v test')) {
            callback!(null, { stdout: 'source.ts', stderr: '' } as any);
          } else if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
            callback!(null, { stdout: './source.ts\n', stderr: '' } as any);
          } else {
            callback!(null, { stdout: '', stderr: '' } as any);
          }
        });

      // Mock validateDeprecatedTags
      const mockValidateDeprecatedTags = vi.fn().mockReturnValue([
        {
          file: 'source.ts',
          type: 'deprecated-api',
          description: '@deprecated tag for poorDoc lacks proper documentation',
          line: 3,
          suggestion: 'Add a meaningful explanation',
          severity: 'medium'
        }
      ]);

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();

      // Should have both types of outdated documentation:
      // 1. From markdown file analysis (deprecated API references)
      // 2. From JSDoc validation
      const allOutdatedDocs = analysis.outdatedDocs;
      expect(allOutdatedDocs.length).toBeGreaterThanOrEqual(1);

      // Should include the JSDoc issue
      const jsDocIssues = allOutdatedDocs.filter((doc: OutdatedDocumentation) =>
        doc.file === 'source.ts' && doc.type === 'deprecated-api'
      );
      expect(jsDocIssues).toHaveLength(1);
      expect(jsDocIssues[0]).toEqual(
        expect.objectContaining({
          file: 'source.ts',
          type: 'deprecated-api',
          description: expect.stringContaining('poorDoc lacks proper documentation'),
          line: 3,
          severity: 'medium'
        })
      );
    });
  });

  describe('error handling', () => {
    it('should continue analysis if JSDoc validation fails for some files', async () => {
      // Mock file operations - one file throws error, one succeeds
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('package.json content')
        .mockRejectedValueOnce(new Error('File read error'))
        .mockResolvedValueOnce(`
/**
 * @deprecated
 */
export function hasIssue() {}
        `);

      // Mock exec
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec
        .mockImplementation((cmd, options, callback) => {
          if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
            callback!(null, { stdout: './error-file.ts\n./good-file.ts\n', stderr: '' } as any);
          } else {
            callback!(null, { stdout: '', stderr: '' } as any);
          }
        });

      // Mock validateDeprecatedTags - should only be called for the successfully read file
      const mockValidateDeprecatedTags = vi.fn().mockReturnValue([
        {
          file: 'good-file.ts',
          type: 'deprecated-api',
          description: '@deprecated tag lacks documentation',
          line: 3,
          suggestion: 'Add explanation',
          severity: 'medium'
        }
      ]);

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();

      // Should still complete analysis successfully
      expect(analysis).toBeDefined();

      // Should have JSDoc issue from the file that was successfully processed
      const jsDocIssues = analysis.outdatedDocs.filter((doc: OutdatedDocumentation) =>
        doc.type === 'deprecated-api'
      );
      expect(jsDocIssues).toHaveLength(1);
      expect(jsDocIssues[0].file).toBe('good-file.ts');

      // validateDeprecatedTags should only be called once (for the good file)
      expect(mockValidateDeprecatedTags).toHaveBeenCalledTimes(1);
    });

    it('should handle missing @apexcli/core dependency gracefully', async () => {
      // Mock file operations
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce('export function test() {}');

      // Mock exec
      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((cmd, options, callback) => {
        callback!(null, { stdout: '', stderr: '' } as any);
      });

      // Simulate missing validateDeprecatedTags function
      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        const { validateDeprecatedTags, ...rest } = actual;
        return rest; // Remove validateDeprecatedTags
      });

      const processorInternal = processor as any;

      // Should not throw error
      expect(async () => {
        await processorInternal.analyzeDocumentation();
      }).not.toThrow();

      const analysis = await processorInternal.analyzeDocumentation();
      expect(analysis).toBeDefined();
      expect(analysis.outdatedDocs).toBeDefined();
    });
  });
});