/**
 * Integration Tests for Diff Preview Feature with MultiEdit Tool
 *
 * This test file specifically covers the MultiEdit tool integration with diff preview,
 * ensuring that the generateDiffPreview hook properly handles MultiEdit operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import type { HookContext } from '../hooks';
import type { DiffPreviewEvent } from '../index';
import type { HookInput } from '@anthropic-ai/claude-agent-sdk';

// Mock the fs modules for controlled testing
vi.mock('fs', () => {
  const mock = {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ''),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      rmdir: vi.fn(),
    },
  };
  return { ...mock, default: mock };
});

const mockedFsSync = vi.mocked(fsSync);

// Import the function after mocking fs
async function importGenerateDiffPreview() {
  const hooksModule = await import('../hooks');
  // Access the internal function through the hooks module
  // We need to get it from the created hooks
  const mockContext: HookContext = {
    taskId: 'test',
    store: { addLog: vi.fn() } as any,
    eventEmitter: new EventEmitter(),
    fileSnapshots: new Map(),
    config: { ui: { diffPreview: true } },
  };

  const hooks = hooksModule.createHooks(mockContext);
  const preToolUseHooks = hooks.PreToolUse || [];

  // Find the diff preview hook (it should be one that matches FILE_MODIFYING_TOOLS)
  for (const hookMatcher of preToolUseHooks) {
    if (Array.isArray(hookMatcher.matcher) && hookMatcher.matcher.includes('MultiEdit')) {
      // Return the hooks array - we'll use the second one which should be the diff preview hook
      return hookMatcher.hooks[1]; // 0 = capture snapshots, 1 = diff preview
    }
  }

  throw new Error('Could not find diff preview hook');
}

describe('Diff Preview MultiEdit Integration Tests', () => {
  let tempDir: string;
  let mockEventEmitter: EventEmitter;
  let capturedEvents: DiffPreviewEvent[];
  let mockStore: any;
  let mockFileSnapshots: Map<string, string>;
  let diffPreviewHook: any;

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

    // Get the diff preview hook function
    diffPreviewHook = await importGenerateDiffPreview();
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

  const simulateHookCall = async (hookInput: HookInput, context: HookContext, toolUseId = 'test-id') => {
    const mockContext = {
      taskId: context.taskId,
      store: context.store,
      eventEmitter: context.eventEmitter,
      fileSnapshots: context.fileSnapshots,
      config: context.config,
      cliFlags: context.cliFlags,
    };

    // Re-create the hook with the proper context
    const hooksModule = await import('../hooks');
    const hooks = hooksModule.createHooks(mockContext);
    const preToolUseHooks = hooks.PreToolUse || [];

    for (const hookMatcher of preToolUseHooks) {
      if (Array.isArray(hookMatcher.matcher) && hookMatcher.matcher.includes('MultiEdit')) {
        // Execute the diff preview hook (second hook in the array)
        if (hookMatcher.hooks.length > 1) {
          const hook = hookMatcher.hooks[1];
          return await hook(hookInput, toolUseId, { signal: new AbortController().signal });
        }
      }
    }
  };

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
      const hookInput: HookInput = {
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
      await simulateHookCall(hookInput, context);

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

    it('should handle MultiEdit with replace_all option', async () => {
      const filePath = '/src/repeated.ts';
      const originalContent = `const test1 = "value";
const test2 = "value";
const test3 = "value";`;

      mockFileSnapshots.set(filePath, originalContent);

      const hookInput: HookInput = {
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
      await simulateHookCall(hookInput, context);

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

    it('should respect diffPreview config flag for MultiEdit operations', async () => {
      const filePath = '/src/test.ts';
      mockFileSnapshots.set(filePath, 'const old = "value";');

      const hookInput: HookInput = {
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
      await simulateHookCall(hookInput, contextDisabled);

      expect(capturedEvents).toHaveLength(0);

      // Test with CLI flag override
      capturedEvents.length = 0; // Clear events
      const contextOverride = createHookContext(
        { ui: { diffPreview: false } },
        { diffPreview: true }
      );
      await simulateHookCall(hookInput, contextOverride);

      expect(capturedEvents).toHaveLength(1);
    });

    it('should handle MultiEdit with mixed operations (new files and edits)', async () => {
      const existingFilePath = '/src/existing.ts';
      const newFilePath = '/src/new.ts';

      const existingFileContent = 'export const existing = "old";';

      // Mock existing file
      mockFileSnapshots.set(existingFilePath, existingFileContent);
      // New file has no snapshot (empty string)
      mockFileSnapshots.set(newFilePath, '');

      const hookInput: HookInput = {
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
      await simulateHookCall(hookInput, context);

      expect(capturedEvents).toHaveLength(2);

      const existingFileEvent = capturedEvents.find(e => e.filePath === existingFilePath);
      const newFileEvent = capturedEvents.find(e => e.filePath === newFilePath);

      // Existing file modification
      expect(existingFileEvent!.addedLines).toBe(1);
      expect(existingFileEvent!.removedLines).toBe(1);

      // New file creation
      expect(newFileEvent!.addedLines).toBe(1);
      expect(newFileEvent!.removedLines).toBe(0);
    });

    it('should handle empty MultiEdit operations gracefully', async () => {
      const hookInput: HookInput = {
        tool_name: 'MultiEdit',
        tool_input: {
          edits: [],
        },
      };

      const context = createHookContext();
      await simulateHookCall(hookInput, context);

      expect(capturedEvents).toHaveLength(0);
    });

    it('should handle invalid MultiEdit input structure', async () => {
      const hookInput: HookInput = {
        tool_name: 'MultiEdit',
        tool_input: {
          // Missing edits array
        },
      };

      const context = createHookContext();

      // Should handle gracefully without throwing
      await expect(simulateHookCall(hookInput, context)).resolves.not.toThrow();
      expect(capturedEvents).toHaveLength(0);
    });
  });
});