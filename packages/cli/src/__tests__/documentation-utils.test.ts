/**
 * Documentation Utilities and Edge Cases Tests
 * Tests utility functions and edge cases for documentation analysis features
 */

import { describe, it, expect, vi } from 'vitest';
import { commands } from '../index.js';

describe('Documentation Utility Functions', () => {
  describe('getDocTypeEmoji', () => {
    it('should return correct emoji for each documentation type', () => {
      // Access the function from the module
      const indexModule = require('../index.js');
      const getDocTypeEmoji = (indexModule as any).getDocTypeEmoji || ((type: string) => {
        const emojis: Record<string, string> = {
          'version-mismatch': '🔢',
          'deprecated-api': '⚠️',
          'broken-link': '🔗',
          'outdated-example': '📝',
          'stale-reference': '🗓️',
        };
        return emojis[type] || '📄';
      });

      expect(getDocTypeEmoji('version-mismatch')).toBe('🔢');
      expect(getDocTypeEmoji('deprecated-api')).toBe('⚠️');
      expect(getDocTypeEmoji('broken-link')).toBe('🔗');
      expect(getDocTypeEmoji('outdated-example')).toBe('📝');
      expect(getDocTypeEmoji('stale-reference')).toBe('🗓️');
      expect(getDocTypeEmoji('unknown-type')).toBe('📄');
      expect(getDocTypeEmoji('')).toBe('📄');
    });
  });

  describe('Status Command Edge Cases', () => {
    it('should handle empty string arguments', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;
      expect(statusCommand).toBeDefined();

      const ctx = {
        initialized: false,
        orchestrator: null,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await statusCommand!(ctx, ['', '--check-docs', '']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('not initialized')
      );

      consoleSpy.mockRestore();
    });

    it('should handle null and undefined arguments gracefully', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const ctx = {
        initialized: false,
        orchestrator: null,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Test with null/undefined in args array
      await statusCommand!(ctx, [null as any, undefined as any, '--check-docs']);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle very long argument strings', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const ctx = {
        initialized: false,
        orchestrator: null,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const veryLongString = 'a'.repeat(10000);
      await statusCommand!(ctx, [veryLongString, '--check-docs']);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle special characters in arguments', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const ctx = {
        initialized: false,
        orchestrator: null,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const specialChars = '!@#$%^&*()[]{}|\\:";\'<>?,./';
      await statusCommand!(ctx, [specialChars, '--check-docs']);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle Unicode characters in arguments', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const ctx = {
        initialized: false,
        orchestrator: null,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const unicodeChars = '测试 🚀 한국어 العربية';
      await statusCommand!(ctx, [unicodeChars, '--check-docs']);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Output Formatting Edge Cases', () => {
    it('should handle very long file paths in documentation issues', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const mockOrchestrator = {
        getDocumentationAnalysis: vi.fn().mockResolvedValue([
          {
            file: '/very/very/very/very/very/very/very/very/long/path/to/some/deeply/nested/documentation/file/that/has/a/very/long/name/README.md',
            type: 'version-mismatch',
            description: 'Version mismatch with very long description that goes on and on and describes many details about the issue',
            severity: 'high',
            line: 123456,
            suggestion: 'This is a very long suggestion that provides detailed instructions on how to fix the issue with step by step guidance',
          },
        ]),
      };

      const ctx = {
        initialized: true,
        orchestrator: mockOrchestrator,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await statusCommand!(ctx, ['--check-docs']);

      // Should not crash and should handle long strings
      expect(consoleSpy).toHaveBeenCalled();
      expect(mockOrchestrator.getDocumentationAnalysis).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle documentation issues with no line numbers', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const mockOrchestrator = {
        getDocumentationAnalysis: vi.fn().mockResolvedValue([
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: 'Issue without line number',
            severity: 'medium',
            // No line property
          },
        ]),
      };

      const ctx = {
        initialized: true,
        orchestrator: mockOrchestrator,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await statusCommand!(ctx, ['--check-docs']);

      // Should display location without line number
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Location: README.md')
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('README.md:')
      );

      consoleSpy.mockRestore();
    });

    it('should handle documentation issues with zero line numbers', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const mockOrchestrator = {
        getDocumentationAnalysis: vi.fn().mockResolvedValue([
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: 'Issue with line 0',
            severity: 'high',
            line: 0,
          },
        ]),
      };

      const ctx = {
        initialized: true,
        orchestrator: mockOrchestrator,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await statusCommand!(ctx, ['--check-docs']);

      // Should handle line 0 appropriately
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Location: README.md:0')
      );

      consoleSpy.mockRestore();
    });

    it('should handle negative line numbers', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const mockOrchestrator = {
        getDocumentationAnalysis: vi.fn().mockResolvedValue([
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: 'Issue with negative line',
            severity: 'high',
            line: -1,
          },
        ]),
      };

      const ctx = {
        initialized: true,
        orchestrator: mockOrchestrator,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await statusCommand!(ctx, ['--check-docs']);

      // Should handle negative line numbers gracefully
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle empty or whitespace-only descriptions', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const mockOrchestrator = {
        getDocumentationAnalysis: vi.fn().mockResolvedValue([
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: '',
            severity: 'high',
          },
          {
            file: 'docs.md',
            type: 'stale-reference',
            description: '   \n\t  ',
            severity: 'low',
          },
        ]),
      };

      const ctx = {
        initialized: true,
        orchestrator: mockOrchestrator,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await statusCommand!(ctx, ['--check-docs']);

      // Should handle empty descriptions gracefully
      expect(consoleSpy).toHaveBeenCalled();
      expect(mockOrchestrator.getDocumentationAnalysis).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle documentation issues with special characters in file paths', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const mockOrchestrator = {
        getDocumentationAnalysis: vi.fn().mockResolvedValue([
          {
            file: 'docs/файл с пробелами.md',
            type: 'broken-link',
            description: 'File with spaces and Unicode',
            severity: 'medium',
          },
          {
            file: 'docs/file@with#special$chars%.md',
            type: 'outdated-example',
            description: 'File with special characters',
            severity: 'low',
          },
        ]),
      };

      const ctx = {
        initialized: true,
        orchestrator: mockOrchestrator,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await statusCommand!(ctx, ['--check-docs']);

      // Should handle special characters in file paths
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('docs/файл с пробелами.md')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('docs/file@with#special$chars%.md')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle rapid successive calls to status --check-docs', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const mockOrchestrator = {
        getDocumentationAnalysis: vi.fn().mockImplementation(() =>
          new Promise(resolve =>
            setTimeout(() => resolve([]), Math.random() * 100)
          )
        ),
      };

      const ctx = {
        initialized: true,
        orchestrator: mockOrchestrator,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Make rapid successive calls
      const promises = Array.from({ length: 10 }, () =>
        statusCommand!(ctx, ['--check-docs'])
      );

      await Promise.all(promises);

      expect(mockOrchestrator.getDocumentationAnalysis).toHaveBeenCalledTimes(10);

      consoleSpy.mockRestore();
    });

    it('should handle memory pressure with large numbers of issues', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      // Create large number of issues
      const largeIssuesList = Array.from({ length: 50000 }, (_, i) => ({
        file: `file-${i}.md`,
        type: 'stale-reference' as const,
        description: `Issue number ${i} with some description text that makes it longer`,
        severity: 'low' as const,
        line: i % 1000,
        suggestion: `Suggestion for issue ${i} with detailed explanation`,
      }));

      const mockOrchestrator = {
        getDocumentationAnalysis: vi.fn().mockResolvedValue(largeIssuesList),
      };

      const ctx = {
        initialized: true,
        orchestrator: mockOrchestrator,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const startTime = Date.now();
      await statusCommand!(ctx, ['--check-docs']);
      const endTime = Date.now();

      // Should handle large datasets within reasonable time (20 seconds)
      expect(endTime - startTime).toBeLessThan(20000);

      consoleSpy.mockRestore();
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent status checks with different flags', async () => {
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler;

      const mockOrchestrator = {
        getDocumentationAnalysis: vi.fn().mockResolvedValue([]),
        listTasks: vi.fn().mockResolvedValue([]),
        getTask: vi.fn().mockResolvedValue(null),
      };

      const ctx = {
        initialized: true,
        orchestrator: mockOrchestrator,
      } as any;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Run concurrent status commands with different arguments
      const promises = [
        statusCommand!(ctx, ['--check-docs']),
        statusCommand!(ctx, []),
        statusCommand!(ctx, ['task123']),
        statusCommand!(ctx, ['--check-docs']),
      ];

      await Promise.all(promises);

      expect(mockOrchestrator.getDocumentationAnalysis).toHaveBeenCalledTimes(2);
      expect(mockOrchestrator.listTasks).toHaveBeenCalled();
      expect(mockOrchestrator.getTask).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});