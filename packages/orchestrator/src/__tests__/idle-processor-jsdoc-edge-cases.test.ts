import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { IdleProcessor } from '../idle-processor.js';
import { TaskStore } from '../store.js';
import { DaemonConfig } from '@apexcli/core';

// Mock fs module
vi.mock('fs');
const mockedFs = vi.mocked(fs);

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

describe('IdleProcessor JSDocDetector Edge Cases', () => {
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

  describe('file processing edge cases', () => {
    it('should handle empty source files', async () => {
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}') // package.json
        .mockResolvedValueOnce(''); // empty file

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
          callback!(null, { stdout: './empty.ts\n', stderr: '' } as any);
        } else {
          callback!(null, { stdout: '', stderr: '' } as any);
        }
      });

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

      expect(mockValidateDeprecatedTags).toHaveBeenCalledWith('', 'empty.ts');
      expect(analysis.outdatedDocs).toBeDefined();
    });

    it('should handle files with only whitespace', async () => {
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce('   \n\n  \t  \n  '); // whitespace only

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
          callback!(null, { stdout: './whitespace.ts\n', stderr: '' } as any);
        } else {
          callback!(null, { stdout: '', stderr: '' } as any);
        }
      });

      const mockValidateDeprecatedTags = vi.fn().mockReturnValue([]);

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      const processorInternal = processor as any;
      await processorInternal.analyzeDocumentation();

      expect(mockValidateDeprecatedTags).toHaveBeenCalledWith('   \n\n  \t  \n  ', 'whitespace.ts');
    });

    it('should handle files with unusual encoding or binary content', async () => {
      // Simulate file with unusual characters
      const unusualContent = 'export function test(): void {} // 🚀 emoji and special chars: ñáéíóú';

      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce(unusualContent);

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
          callback!(null, { stdout: './special.ts\n', stderr: '' } as any);
        } else {
          callback!(null, { stdout: '', stderr: '' } as any);
        }
      });

      const mockValidateDeprecatedTags = vi.fn().mockReturnValue([]);

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      const processorInternal = processor as any;
      await processorInternal.analyzeDocumentation();

      expect(mockValidateDeprecatedTags).toHaveBeenCalledWith(unusualContent, 'special.ts');
    });

    it('should handle very large files gracefully', async () => {
      // Create a large file content (simulating a large file)
      const largeContent = `
/**
 * @deprecated This is a very large file with deprecated content
 */
export function hugeFunction(): void {
  ${Array(1000).fill('// This is a comment line').join('\n')}
}
      `.repeat(10); // Repeat to make it even larger

      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce(largeContent);

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
          callback!(null, { stdout: './large.ts\n', stderr: '' } as any);
        } else {
          callback!(null, { stdout: '', stderr: '' } as any);
        }
      });

      const mockValidateDeprecatedTags = vi.fn().mockReturnValue([
        {
          file: 'large.ts',
          type: 'deprecated-api',
          description: '@deprecated tag for hugeFunction lacks proper documentation',
          line: 3,
          suggestion: 'Add migration path information',
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

      expect(mockValidateDeprecatedTags).toHaveBeenCalledWith(largeContent, 'large.ts');
      expect(analysis.outdatedDocs).toContainEqual(
        expect.objectContaining({
          file: 'large.ts',
          type: 'deprecated-api'
        })
      );
    });

    it('should handle files that cannot be read due to permissions', async () => {
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}')
        .mockRejectedValueOnce(new Error('EACCES: permission denied'));

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
          callback!(null, { stdout: './protected.ts\n', stderr: '' } as any);
        } else {
          callback!(null, { stdout: '', stderr: '' } as any);
        }
      });

      const mockValidateDeprecatedTags = vi.fn();

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();

      // Should not call validateDeprecatedTags for files that can't be read
      expect(mockValidateDeprecatedTags).not.toHaveBeenCalled();
      expect(analysis.outdatedDocs).toBeDefined();
    });

    it('should handle malformed file paths', async () => {
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce('export function test() {}');

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      // Return malformed paths
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
          callback!(null, { stdout: './malformed/path/../file.ts\n./normal.ts\n', stderr: '' } as any);
        } else {
          callback!(null, { stdout: '', stderr: '' } as any);
        }
      });

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

      // Should normalize paths and still process
      expect(mockValidateDeprecatedTags).toHaveBeenCalled();
      expect(analysis.outdatedDocs).toBeDefined();
    });
  });

  describe('validateDeprecatedTags function edge cases', () => {
    it('should handle validateDeprecatedTags throwing unexpected errors', async () => {
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce('export function test() {}');

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
          callback!(null, { stdout: './error.ts\n', stderr: '' } as any);
        } else {
          callback!(null, { stdout: '', stderr: '' } as any);
        }
      });

      // Mock validateDeprecatedTags to throw various types of errors
      const mockValidateDeprecatedTags = vi.fn()
        .mockImplementationOnce(() => {
          throw new SyntaxError('Invalid syntax');
        });

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();

      // Should not crash and should continue processing
      expect(analysis).toBeDefined();
      expect(analysis.outdatedDocs).toBeDefined();
    });

    it('should handle validateDeprecatedTags returning malformed data', async () => {
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce('export function test() {}');

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
          callback!(null, { stdout: './malformed.ts\n', stderr: '' } as any);
        } else {
          callback!(null, { stdout: '', stderr: '' } as any);
        }
      });

      // Mock validateDeprecatedTags to return malformed data
      const mockValidateDeprecatedTags = vi.fn().mockReturnValue([
        null, // null value
        undefined, // undefined value
        { // missing required fields
          file: 'test.ts'
          // missing type, description, etc.
        },
        { // valid issue
          file: 'malformed.ts',
          type: 'deprecated-api',
          description: 'Valid issue',
          line: 1,
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

      // Should handle malformed data gracefully and include valid issues
      expect(analysis.outdatedDocs).toBeDefined();

      const deprecatedIssues = analysis.outdatedDocs.filter((doc: any) =>
        doc.type === 'deprecated-api' && doc.file === 'malformed.ts'
      );
      expect(deprecatedIssues.length).toBeGreaterThan(0);
    });

    it('should handle validateDeprecatedTags returning non-array data', async () => {
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce('export function test() {}');

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
          callback!(null, { stdout: './nonarray.ts\n', stderr: '' } as any);
        } else {
          callback!(null, { stdout: '', stderr: '' } as any);
        }
      });

      // Mock validateDeprecatedTags to return non-array
      const mockValidateDeprecatedTags = vi.fn()
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('string')
        .mockReturnValueOnce({ object: 'not array' });

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      const processorInternal = processor as any;

      // Should not crash despite non-array returns
      expect(async () => {
        await processorInternal.analyzeDocumentation();
      }).not.toThrow();

      const analysis = await processorInternal.analyzeDocumentation();
      expect(analysis).toBeDefined();
      expect(analysis.outdatedDocs).toBeDefined();
    });
  });

  describe('system edge cases', () => {
    it('should handle system commands failing', async () => {
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce('export function test() {}');

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      // Mock exec to fail
      mockExec.mockImplementation((cmd, options, callback) => {
        callback!(new Error('Command failed'), { stdout: '', stderr: 'Permission denied' } as any);
      });

      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();

      // Should complete despite system command failures
      expect(analysis).toBeDefined();
      expect(analysis.outdatedDocs).toBeDefined();
      expect(Array.isArray(analysis.outdatedDocs)).toBe(true);
    });

    it('should handle no source files found', async () => {
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}');

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      // Mock exec to return no files
      mockExec.mockImplementation((cmd, options, callback) => {
        callback!(null, { stdout: '', stderr: '' } as any);
      });

      const mockValidateDeprecatedTags = vi.fn();

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      const processorInternal = processor as any;
      const analysis = await processorInternal.analyzeDocumentation();

      // Should not call validateDeprecatedTags when no files found
      expect(mockValidateDeprecatedTags).not.toHaveBeenCalled();
      expect(analysis.outdatedDocs).toBeDefined();
      expect(Array.isArray(analysis.outdatedDocs)).toBe(true);
    });

    it('should handle package.json not existing', async () => {
      // Mock fs.readFile to fail for package.json
      mockedFs.readFile = vi.fn()
        .mockRejectedValueOnce(new Error('ENOENT: no such file'))
        .mockResolvedValueOnce('export function test() {}');

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
          callback!(null, { stdout: './test.ts\n', stderr: '' } as any);
        } else {
          callback!(null, { stdout: '', stderr: '' } as any);
        }
      });

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

      // Should still process source files even without package.json
      expect(mockValidateDeprecatedTags).toHaveBeenCalledWith(
        'export function test() {}',
        'test.ts'
      );
      expect(analysis.outdatedDocs).toBeDefined();
    });

    it('should respect file limits to avoid performance issues', async () => {
      mockedFs.readFile = vi.fn()
        .mockResolvedValueOnce('{}');

      // Mock reading many files
      for (let i = 0; i < 50; i++) {
        mockedFs.readFile.mockResolvedValueOnce(`export function test${i}() {}`);
      }

      const { exec } = await import('child_process');
      const mockExec = vi.mocked(exec);

      // Return many files
      const manyFiles = Array.from({ length: 50 }, (_, i) => `./file${i}.ts`).join('\n');
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v node_modules')) {
          callback!(null, { stdout: manyFiles + '\n', stderr: '' } as any);
        } else {
          callback!(null, { stdout: '', stderr: '' } as any);
        }
      });

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

      // Should limit the number of files processed (based on slice(0, 30) in implementation)
      expect(mockValidateDeprecatedTags.mock.calls.length).toBeLessThanOrEqual(30);
      expect(analysis.outdatedDocs).toBeDefined();
    });
  });
});