/**
 * Integration Tests for Diff Preview Feature with MultiEdit Tool
 *
 * This test file specifically covers the MultiEdit tool integration with diff preview,
 * which was not fully covered in the comprehensive integration tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { createHooks } from '../hooks';
import type { HookContext } from '../hooks';
import type { DiffPreviewEvent } from '../index';

// Mock the fs modules for controlled testing
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
}));

const mockedFsSync = vi.mocked(fsSync);

describe('Diff Preview MultiEdit Integration Tests', () => {
  let tempDir: string;
  let mockEventEmitter: EventEmitter;
  let capturedEvents: DiffPreviewEvent[];
  let mockStore: any;
  let mockFileSnapshots: Map<string, string>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-diff-multiedit-'));

    // Create real event emitter to capture events
    mockEventEmitter = new EventEmitter();
    capturedEvents = [];

    // Capture diff preview events
    mockEventEmitter.on('diff:preview', (data: DiffPreviewEvent) => {
      capturedEvents.push(data);
    });

    // Mock store
    mockStore = {
      addLog: vi.fn().mockResolvedValue(undefined),
      getTask: vi.fn(),
      updateTask: vi.fn(),
    };

    // Initialize file snapshots
    mockFileSnapshots = new Map();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    capturedEvents = [];
    mockFileSnapshots.clear();

    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  const createHookContext = (config?: any, cliFlags?: { diffPreview?: boolean }): HookContext => ({
    taskId: 'multiedit-test-123',
    store: mockStore,
    eventEmitter: mockEventEmitter,
    fileSnapshots: mockFileSnapshots,
    config: config || { ui: { diffPreview: true } },
    cliFlags,
  });

  describe('MultiEdit Tool Integration', () => {
    it('should generate diff preview for MultiEdit operations on multiple files', async () => {
      const file1Path = '/src/components/Component1.tsx';
      const file2Path = '/src/components/Component2.tsx';
      const file3Path = '/src/utils/helper.ts';

      const file1Original = `import React from 'react';

export const Component1 = () => {
  return <div>Original Component1</div>;
};`;

      const file2Original = `import React from 'react';

export const Component2 = () => {
  return <div>Original Component2</div>;
};`;

      const file3Original = `export function helper() {
  return 'original helper';
}`;

      // Mock original file contents
      mockFileSnapshots.set(file1Path, file1Original);
      mockFileSnapshots.set(file2Path, file2Original);
      mockFileSnapshots.set(file3Path, file3Original);

      // Create mock hook input for MultiEdit
      const hookInput = {
        tool_name: 'MultiEdit',
        tool_input: {
          edits: [
            {
              file_path: file1Path,
              old_string: 'Original Component1',
              new_string: 'Updated Component1',
            },
            {
              file_path: file2Path,
              old_string: 'Original Component2',
              new_string: 'Updated Component2',
            },
            {
              file_path: file3Path,
              old_string: 'original helper',
              new_string: 'updated helper',
            },
          ],
        },
      };

      const context = createHookContext();

      // Create hooks configuration and get the PreToolUse hook
      const hooksConfig = createHooks(context);
      const preToolUseHooks = hooksConfig.PreToolUse || [];

      // Find the diff preview hook (should be the one that matches FILE_MODIFYING_TOOLS)
      let diffPreviewHook = null;
      for (const hookMatcher of preToolUseHooks) {
        if (Array.isArray(hookMatcher.matcher) && hookMatcher.matcher.includes('MultiEdit')) {
          // This is the file modifying tools hook, find the diff preview hook within it
          for (const hook of hookMatcher.hooks) {
            try {
              const result = await hook(hookInput, 'test-multiedit-123', { signal: new AbortController().signal });
              if (result && typeof result === 'object') {
                // If hook returns empty object, it executed successfully
                diffPreviewHook = hook;
                break;
              }
            } catch (error) {
              // Continue to next hook
            }
          }
          if (diffPreviewHook) break;
        }
      }

      // Execute the hook if found
      if (diffPreviewHook) {
        await diffPreviewHook(hookInput, 'test-multiedit-123', { signal: new AbortController().signal });
      }

      // Should generate events for all three files
      expect(capturedEvents).toHaveLength(3);

      // Check each event
      const file1Event = capturedEvents.find(e => e.filePath === file1Path);
      const file2Event = capturedEvents.find(e => e.filePath === file2Path);
      const file3Event = capturedEvents.find(e => e.filePath === file3Path);

      expect(file1Event).toBeDefined();
      expect(file2Event).toBeDefined();
      expect(file3Event).toBeDefined();

      // Verify diff content
      expect(file1Event!.diff).toContain('-  return <div>Original Component1</div>;');
      expect(file1Event!.diff).toContain('+  return <div>Updated Component1</div>;');

      expect(file2Event!.diff).toContain('-  return <div>Original Component2</div>;');
      expect(file2Event!.diff).toContain('+  return <div>Updated Component2</div>;');

      expect(file3Event!.diff).toContain('-  return \'original helper\';');
      expect(file3Event!.diff).toContain('+  return \'updated helper\';');

      // Verify logging for all files
      expect(mockStore.addLog).toHaveBeenCalledTimes(3);
    });

    it('should handle MultiEdit with mixed operations (new files and edits)', async () => {
      const existingFilePath = '/src/existing.ts';
      const newFilePath = '/src/new.ts';

      const existingFileContent = 'export const existing = "old";';

      // Mock existing file
      mockFileSnapshots.set(existingFilePath, existingFileContent);
      // New file has no snapshot

      const hookInput = {
        tool_name: 'MultiEdit',
        tool_input: {
          edits: [
            {
              file_path: existingFilePath,
              old_string: 'old',
              new_string: 'updated',
            },
            {
              file_path: newFilePath,
              old_string: '',
              new_string: 'export const newFunction = () => "hello";',
            },
          ],
        },
      };

      const context = createHookContext();
      await generateDiffPreview(hookInput, 'test-multiedit-mixed', context);

      expect(capturedEvents).toHaveLength(2);

      const existingFileEvent = capturedEvents.find(e => e.filePath === existingFilePath);
      const newFileEvent = capturedEvents.find(e => e.filePath === newFilePath);

      // Existing file modification
      expect(existingFileEvent!.addedLines).toBe(1);
      expect(existingFileEvent!.removedLines).toBe(1);
      expect(existingFileEvent!.diff).toContain('-export const existing = "old";');
      expect(existingFileEvent!.diff).toContain('+export const existing = "updated";');

      // New file creation
      expect(newFileEvent!.addedLines).toBe(1);
      expect(newFileEvent!.removedLines).toBe(0);
      expect(newFileEvent!.diff).toContain('+export const newFunction = () => "hello";');
    });

    it('should respect diffPreview config flag for MultiEdit operations', async () => {
      const filePath = '/src/test.ts';
      mockFileSnapshots.set(filePath, 'const old = "value";');

      const hookInput = {
        tool_name: 'MultiEdit',
        tool_input: {
          edits: [
            {
              file_path: filePath,
              old_string: 'old',
              new_string: 'new',
            },
          ],
        },
      };

      // Test with diffPreview disabled in config
      const contextDisabled = createHookContext({ ui: { diffPreview: false } });
      await generateDiffPreview(hookInput, 'test-disabled', contextDisabled);

      expect(capturedEvents).toHaveLength(0);

      // Test with CLI flag override
      capturedEvents.length = 0; // Clear events
      const contextOverride = createHookContext(
        { ui: { diffPreview: false } },
        { diffPreview: true }
      );
      await generateDiffPreview(hookInput, 'test-override', contextOverride);

      expect(capturedEvents).toHaveLength(1);
    });

    it('should handle MultiEdit with replace_all option', async () => {
      const filePath = '/src/repeated.ts';
      const originalContent = `const test1 = "value";
const test2 = "value";
const test3 = "value";`;

      mockFileSnapshots.set(filePath, originalContent);

      const hookInput = {
        tool_name: 'MultiEdit',
        tool_input: {
          edits: [
            {
              file_path: filePath,
              old_string: 'value',
              new_string: 'updated',
              replace_all: true,
            },
          ],
        },
      };

      const context = createHookContext();
      await generateDiffPreview(hookInput, 'test-replace-all', context);

      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      // Should show all three replacements
      expect(event.addedLines).toBe(3);
      expect(event.removedLines).toBe(3);
      expect(event.diff).toContain('-const test1 = "value";');
      expect(event.diff).toContain('+const test1 = "updated";');
      expect(event.diff).toContain('-const test2 = "value";');
      expect(event.diff).toContain('+const test2 = "updated";');
      expect(event.diff).toContain('-const test3 = "value";');
      expect(event.diff).toContain('+const test3 = "updated";');
    });

    it('should handle MultiEdit error scenarios gracefully', async () => {
      const filePath = '/src/error-test.ts';

      // Mock file that doesn't exist in snapshots
      const hookInput = {
        tool_name: 'MultiEdit',
        tool_input: {
          edits: [
            {
              file_path: filePath,
              old_string: 'nonexistent',
              new_string: 'replacement',
            },
          ],
        },
      };

      const context = createHookContext();

      // Should not throw error
      await expect(generateDiffPreview(hookInput, 'test-error', context)).resolves.not.toThrow();

      // Should still attempt to generate diff (treating as new file)
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].addedLines).toBe(1);
      expect(capturedEvents[0].removedLines).toBe(0);
    });

    it('should skip diff generation when no event emitter is available', async () => {
      const filePath = '/src/no-emitter.ts';
      mockFileSnapshots.set(filePath, 'test content');

      const context = createHookContext();
      context.eventEmitter = undefined;

      const hookInput = {
        tool_name: 'MultiEdit',
        tool_input: {
          edits: [
            {
              file_path: filePath,
              old_string: 'test',
              new_string: 'updated',
            },
          ],
        },
      };

      // Should not throw and not generate events
      await generateDiffPreview(hookInput, 'test-no-emitter', context);
      expect(capturedEvents).toHaveLength(0);
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle large MultiEdit operations efficiently', async () => {
      const files = Array.from({ length: 10 }, (_, i) => `/src/file${i}.ts`);

      files.forEach((filePath, index) => {
        mockFileSnapshots.set(filePath, `export const value${index} = "old";`);
      });

      const hookInput = {
        tool_name: 'MultiEdit',
        tool_input: {
          edits: files.map((filePath, index) => ({
            file_path: filePath,
            old_string: 'old',
            new_string: 'new',
          })),
        },
      };

      const context = createHookContext();

      const start = Date.now();
      await generateDiffPreview(hookInput, 'test-performance', context);
      const duration = Date.now() - start;

      expect(capturedEvents).toHaveLength(10);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle empty MultiEdit operations', async () => {
      const hookInput = {
        tool_name: 'MultiEdit',
        tool_input: {
          edits: [],
        },
      };

      const context = createHookContext();

      await generateDiffPreview(hookInput, 'test-empty', context);

      expect(capturedEvents).toHaveLength(0);
      expect(mockStore.addLog).not.toHaveBeenCalled();
    });

    it('should validate MultiEdit input structure', async () => {
      const hookInput = {
        tool_name: 'MultiEdit',
        tool_input: {
          // Invalid structure - missing edits array
        },
      };

      const context = createHookContext();

      // Should handle gracefully without throwing
      await expect(generateDiffPreview(hookInput, 'test-invalid', context)).resolves.not.toThrow();
      expect(capturedEvents).toHaveLength(0);
    });
  });
});