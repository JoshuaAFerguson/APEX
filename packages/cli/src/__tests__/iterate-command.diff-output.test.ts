/**
 * Iterate Command --diff Output Format Tests
 * Verifies that the --diff flag produces correctly formatted output
 * and handles various diff scenarios properly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { IterationDiff } from '@apexcli/core';

describe('Iterate Command --diff Output Format', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  const createMockContext = () => ({
    orchestrator,
    cwd: tempDir,
    initialized: true,
    config: null,
    apiProcess: null,
    webUIProcess: null,
    apiPort: 3000,
    webUIPort: 3001,
  });

  beforeEach(async () => {
    // Create temporary directory for test project
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-diff-test-'));

    // Set up basic project structure
    await fs.ensureDir(path.join(tempDir, '.apex'));

    // Create minimal config
    const configContent = `
project:
  name: diff-output-test
  version: 1.0.0
agents:
  developer:
    model: haiku
    autonomy: high
workflows:
  feature:
    stages:
      - name: implementation
        agent: developer
limits:
  maxTokens: 10000
  maxCost: 1.0
`;

    await fs.writeFile(path.join(tempDir, '.apex', 'config.yaml'), configContent);

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: tempDir });

    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    vi.clearAllMocks();

    // Clean up temp directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Basic Diff Output Format', () => {
    it('should display basic diff information with proper formatting', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');
      expect(iterateCommand).toBeDefined();

      const mockDiff: IterationDiff = {
        iterationId: 'task-123-iter-456',
        previousIterationId: 'task-123-iter-455',
        filesChanged: {
          added: ['src/new-feature.ts', 'tests/new-feature.test.ts'],
          modified: ['src/index.ts', 'package.json'],
          removed: ['src/old-file.ts'],
        },
        tokenUsageDelta: 150,
        costDelta: 0.0075,
        summary: '2 files added, 2 files modified, 1 files removed, 150 tokens used',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['task-123', '--diff']);

      expect(getDiffSpy).toHaveBeenCalledWith('task-123');

      // Verify header
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 Getting iteration diff for task task-123...')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration Diff:')
      );

      // Verify iteration information
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Iteration: task-123-iter-456')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Previous: task-123-iter-455')
      );

      // Verify files changed section
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Files Changed:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added: src/new-feature.ts, tests/new-feature.test.ts')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Modified: src/index.ts, package.json')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Removed: src/old-file.ts')
      );

      // Verify metrics
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token Usage: +150')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cost: +$0.01')
      );

      // Verify summary
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Summary: 2 files added, 2 files modified, 1 files removed, 150 tokens used')
      );

      getDiffSpy.mockRestore();
    });

    it('should handle diff with no file changes', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'task-no-changes-iter-001',
        previousIterationId: 'task-no-changes-iter-000',
        filesChanged: {
          added: [],
          modified: [],
          removed: [],
        },
        tokenUsageDelta: 50,
        costDelta: 0.0025,
        summary: 'No file changes, 50 tokens used for analysis',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['task-no-changes', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Files Changed:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No file changes detected')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token Usage: +50')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Summary: No file changes, 50 tokens used for analysis')
      );

      getDiffSpy.mockRestore();
    });

    it('should handle diff with no previous iteration', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'task-first-iter-001',
        previousIterationId: undefined,
        filesChanged: {
          added: ['src/initial.ts'],
          modified: [],
          removed: [],
        },
        tokenUsageDelta: 100,
        costDelta: 0.005,
        summary: 'First iteration: 1 files added, 100 tokens used',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['task-first', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Iteration: task-first-iter-001')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Previous: (first iteration)')
      );

      getDiffSpy.mockRestore();
    });
  });

  describe('Stage and Status Change Display', () => {
    it('should display stage changes with proper formatting', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'stage-change-iter-001',
        previousIterationId: 'stage-change-iter-000',
        stageChange: { from: 'implementation', to: 'testing' },
        filesChanged: {
          added: ['tests/unit.test.ts'],
          modified: [],
          removed: [],
        },
        tokenUsageDelta: 200,
        costDelta: 0.01,
        summary: 'Stage: implementation → testing; 1 files added, 200 tokens used',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['stage-change', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stage: implementation → testing')
      );

      getDiffSpy.mockRestore();
    });

    it('should display status changes with proper formatting', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'status-change-iter-001',
        previousIterationId: 'status-change-iter-000',
        statusChange: { from: 'in-progress', to: 'review' },
        filesChanged: {
          added: [],
          modified: ['README.md'],
          removed: [],
        },
        tokenUsageDelta: 75,
        costDelta: 0.00375,
        summary: 'Status: in-progress → review; 1 files modified, 75 tokens used',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['status-change', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status: in-progress → review')
      );

      getDiffSpy.mockRestore();
    });

    it('should display both stage and status changes together', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'dual-change-iter-001',
        previousIterationId: 'dual-change-iter-000',
        stageChange: { from: 'implementation', to: 'testing' },
        statusChange: { from: 'in-progress', to: 'review' },
        filesChanged: {
          added: ['tests/integration.test.ts'],
          modified: ['src/main.ts'],
          removed: [],
        },
        tokenUsageDelta: 300,
        costDelta: 0.015,
        summary: 'Stage: implementation → testing; Status: in-progress → review; 1 files added, 1 files modified, 300 tokens used',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['dual-change', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stage: implementation → testing')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status: in-progress → review')
      );

      getDiffSpy.mockRestore();
    });
  });

  describe('File List Formatting', () => {
    it('should handle long file lists with proper formatting', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const manyFiles = Array.from({ length: 10 }, (_, i) => `src/component-${i + 1}.ts`);
      const mockDiff: IterationDiff = {
        iterationId: 'many-files-iter-001',
        previousIterationId: 'many-files-iter-000',
        filesChanged: {
          added: manyFiles,
          modified: ['src/index.ts', 'package.json', 'README.md'],
          removed: ['src/deprecated.ts'],
        },
        tokenUsageDelta: 500,
        costDelta: 0.025,
        summary: '10 files added, 3 files modified, 1 files removed, 500 tokens used',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['many-files', '--diff']);

      // Should display all added files
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added: ' + manyFiles.join(', '))
      );

      getDiffSpy.mockRestore();
    });

    it('should handle files with spaces and special characters', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'special-files-iter-001',
        previousIterationId: 'special-files-iter-000',
        filesChanged: {
          added: ['src/special file.ts', 'src/file-with-dashes.ts', 'src/file_with_underscores.ts'],
          modified: ['package.json'],
          removed: [],
        },
        tokenUsageDelta: 120,
        costDelta: 0.006,
        summary: '3 files added, 1 files modified, 120 tokens used',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['special-files', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added: src/special file.ts, src/file-with-dashes.ts, src/file_with_underscores.ts')
      );

      getDiffSpy.mockRestore();
    });
  });

  describe('Metrics Display', () => {
    it('should format positive token usage correctly', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'positive-tokens-iter-001',
        previousIterationId: 'positive-tokens-iter-000',
        filesChanged: { added: [], modified: [], removed: [] },
        tokenUsageDelta: 1250,
        costDelta: 0.0625,
        summary: '1250 tokens used',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['positive-tokens', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token Usage: +1250')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cost: +$0.06')
      );

      getDiffSpy.mockRestore();
    });

    it('should format negative token usage correctly', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'negative-tokens-iter-001',
        previousIterationId: 'negative-tokens-iter-000',
        filesChanged: { added: [], modified: [], removed: [] },
        tokenUsageDelta: -500,
        costDelta: -0.025,
        summary: 'Optimized: 500 tokens saved',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['negative-tokens', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token Usage: -500')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cost: -$0.03')
      );

      getDiffSpy.mockRestore();
    });

    it('should format zero token usage correctly', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'zero-tokens-iter-001',
        previousIterationId: 'zero-tokens-iter-000',
        filesChanged: { added: [], modified: [], removed: [] },
        tokenUsageDelta: 0,
        costDelta: 0,
        summary: 'No token usage change',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['zero-tokens', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token Usage: 0')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cost: $0.00')
      );

      getDiffSpy.mockRestore();
    });

    it('should handle large numbers with proper formatting', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'large-numbers-iter-001',
        previousIterationId: 'large-numbers-iter-000',
        filesChanged: { added: [], modified: [], removed: [] },
        tokenUsageDelta: 50000,
        costDelta: 2.5,
        summary: '50000 tokens used for large operation',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['large-numbers', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token Usage: +50000')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cost: +$2.50')
      );

      getDiffSpy.mockRestore();
    });
  });

  describe('Error Handling in Diff Display', () => {
    it('should handle missing iteration gracefully', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff')
        .mockRejectedValue(new Error('No iterations found for task missing-task'));

      await iterateCommand!.handler(createMockContext(), ['missing-task', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 Getting iteration diff for task missing-task...')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to get diff: Error: No iterations found for task missing-task')
      );

      getDiffSpy.mockRestore();
    });

    it('should handle database errors gracefully', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff')
        .mockRejectedValue(new Error('Database connection failed'));

      await iterateCommand!.handler(createMockContext(), ['db-error', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to get diff: Error: Database connection failed')
      );

      getDiffSpy.mockRestore();
    });

    it('should handle malformed diff data gracefully', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const malformedDiff = {
        iterationId: 'malformed-iter-001',
        // Missing required fields
      } as IterationDiff;

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(malformedDiff);

      await iterateCommand!.handler(createMockContext(), ['malformed', '--diff']);

      // Should still display available information without crashing
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration Diff:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Iteration: malformed-iter-001')
      );

      getDiffSpy.mockRestore();
    });
  });

  describe('Output Consistency', () => {
    it('should maintain consistent formatting across different diff sizes', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const testCases = [
        {
          name: 'small',
          diff: {
            iterationId: 'small-iter-001',
            previousIterationId: 'small-iter-000',
            filesChanged: { added: ['file.ts'], modified: [], removed: [] },
            tokenUsageDelta: 10,
            costDelta: 0.0005,
            summary: '1 files added, 10 tokens used',
          },
        },
        {
          name: 'medium',
          diff: {
            iterationId: 'medium-iter-001',
            previousIterationId: 'medium-iter-000',
            filesChanged: {
              added: ['a.ts', 'b.ts', 'c.ts'],
              modified: ['d.ts', 'e.ts'],
              removed: ['f.ts'],
            },
            tokenUsageDelta: 500,
            costDelta: 0.025,
            summary: '3 files added, 2 files modified, 1 files removed, 500 tokens used',
          },
        },
        {
          name: 'large',
          diff: {
            iterationId: 'large-iter-001',
            previousIterationId: 'large-iter-000',
            filesChanged: {
              added: Array.from({ length: 20 }, (_, i) => `new${i}.ts`),
              modified: Array.from({ length: 15 }, (_, i) => `mod${i}.ts`),
              removed: Array.from({ length: 5 }, (_, i) => `del${i}.ts`),
            },
            tokenUsageDelta: 5000,
            costDelta: 0.25,
            summary: '20 files added, 15 files modified, 5 files removed, 5000 tokens used',
          },
        },
      ];

      for (const testCase of testCases) {
        consoleSpy.mockClear();
        const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(testCase.diff);

        await iterateCommand!.handler(createMockContext(), [testCase.name, '--diff']);

        // Verify consistent header format
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(`📊 Getting iteration diff for task ${testCase.name}...`)
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('📈 Iteration Diff:')
        );

        // Verify consistent section headers
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Files Changed:')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Token Usage:')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cost:')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Summary:')
        );

        getDiffSpy.mockRestore();
      }
    });

    it('should use consistent emoji and color coding', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: 'emoji-test-iter-001',
        previousIterationId: 'emoji-test-iter-000',
        filesChanged: { added: ['new.ts'], modified: ['existing.ts'], removed: ['old.ts'] },
        tokenUsageDelta: 100,
        costDelta: 0.005,
        summary: 'Test diff with all change types',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['emoji-test', '--diff']);

      // Verify emoji usage in headers
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈')
      );

      getDiffSpy.mockRestore();
    });
  });

  describe('Edge Cases in Display', () => {
    it('should handle empty strings and null values gracefully', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockDiff: IterationDiff = {
        iterationId: '',
        previousIterationId: null as any,
        filesChanged: { added: [], modified: [], removed: [] },
        tokenUsageDelta: 0,
        costDelta: 0,
        summary: '',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['edge-case', '--diff']);

      // Should handle gracefully without crashing
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration Diff:')
      );

      getDiffSpy.mockRestore();
    });

    it('should handle very long file paths and names', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const longPath = 'src/' + 'a'.repeat(200) + '/' + 'b'.repeat(100) + '.ts';
      const mockDiff: IterationDiff = {
        iterationId: 'long-paths-iter-001',
        previousIterationId: 'long-paths-iter-000',
        filesChanged: {
          added: [longPath],
          modified: [],
          removed: [],
        },
        tokenUsageDelta: 50,
        costDelta: 0.0025,
        summary: 'Long path test',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      await iterateCommand!.handler(createMockContext(), ['long-paths', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Added: ${longPath}`)
      );

      getDiffSpy.mockRestore();
    });
  });
});