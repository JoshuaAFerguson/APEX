/**
 * @fileoverview Filesystem Tool Mocks
 *
 * This file provides specialized mock implementations for filesystem-related tools
 * including Read, Write, Edit, and file-related operations.
 */

import { vi } from 'vitest';
import path from 'path';
import type { ToolMock } from '../types.js';
import { createToolMock } from './tool-mock-factory.js';

// ============================================================================
// Filesystem Mock Utilities
// ============================================================================

/**
 * Virtual filesystem for testing
 */
class VirtualFilesystem {
  private files = new Map<string, { content: string; modifiedAt: Date; size: number }>();

  public writeFile(filePath: string, content: string): void {
    const normalizedPath = path.normalize(filePath);
    this.files.set(normalizedPath, {
      content,
      modifiedAt: new Date(),
      size: Buffer.byteLength(content, 'utf-8'),
    });
  }

  public readFile(filePath: string): string {
    const normalizedPath = path.normalize(filePath);
    const file = this.files.get(normalizedPath);
    if (!file) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }
    return file.content;
  }

  public fileExists(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    return this.files.has(normalizedPath);
  }

  public deleteFile(filePath: string): void {
    const normalizedPath = path.normalize(filePath);
    this.files.delete(normalizedPath);
  }

  public listFiles(pattern?: string): string[] {
    const allFiles = Array.from(this.files.keys());
    if (!pattern) {
      return allFiles;
    }

    // Simple pattern matching (could be enhanced with proper glob support)
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\./g, '\\.');

    const regex = new RegExp(`^${regexPattern}$`);
    return allFiles.filter((file) => regex.test(file));
  }

  public getFileInfo(filePath: string) {
    const normalizedPath = path.normalize(filePath);
    return this.files.get(normalizedPath);
  }

  public clear(): void {
    this.files.clear();
  }

  public getAllFiles(): Map<string, { content: string; modifiedAt: Date; size: number }> {
    return new Map(this.files);
  }
}

// ============================================================================
// Read Tool Mocks
// ============================================================================

/**
 * Create a Read tool mock with virtual filesystem support
 */
export function createReadToolMock(
  filesystem?: VirtualFilesystem,
  options: {
    maxFileSize?: number;
    allowedExtensions?: string[];
    encoding?: string;
  } = {}
): ToolMock {
  const fs = filesystem || new VirtualFilesystem();
  const { maxFileSize = 1024 * 1024, allowedExtensions, encoding = 'utf-8' } = options;

  return createToolMock({
    tool: 'Read',
    shouldSucceed: true,
    trackCalls: true,
    response: undefined, // We'll handle this in the implementation
  });
}

/**
 * Create a comprehensive Read tool mock with realistic file system behavior
 */
export function createRealisticReadToolMock(filesystem: VirtualFilesystem): ToolMock {
  const calls: ToolMock['calls'] = [];

  const mockFn = vi.fn().mockImplementation(async (params: {
    file_path: string;
    offset?: number;
    limit?: number;
  }) => {
    const callInfo = {
      args: [params],
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    try {
      const { file_path, offset = 0, limit } = params;

      if (!file_path) {
        const error = new Error('file_path parameter is required');
        callInfo.error = error;
        throw error;
      }

      // Check if file exists
      if (!filesystem.fileExists(file_path)) {
        const error = new Error(`ENOENT: no such file or directory, open '${file_path}'`);
        callInfo.error = error;
        throw error;
      }

      // Read file content
      const content = filesystem.readFile(file_path);
      const lines = content.split('\n');

      // Apply offset and limit
      const startLine = Math.max(0, offset);
      const endLine = limit ? Math.min(lines.length, startLine + limit) : lines.length;
      const selectedLines = lines.slice(startLine, endLine);

      // Format as line-numbered content (similar to cat -n)
      const formattedContent = selectedLines
        .map((line, index) => `${startLine + index + 1}→${line}`)
        .join('\n');

      const result = {
        success: true,
        content: formattedContent,
        file_path,
        total_lines: lines.length,
        lines_read: selectedLines.length,
        offset: startLine,
        encoding: 'utf-8',
      };

      callInfo.result = result;
      return result;
    } finally {
      calls.push(callInfo);
    }
  });

  return {
    mock: mockFn,
    config: { tool: 'Read', shouldSucceed: true, trackCalls: true },
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
    },
    getCallHistory: () => [...calls],
  };
}

// ============================================================================
// Write Tool Mocks
// ============================================================================

/**
 * Create a Write tool mock with virtual filesystem support
 */
export function createWriteToolMock(filesystem: VirtualFilesystem): ToolMock {
  const calls: ToolMock['calls'] = [];

  const mockFn = vi.fn().mockImplementation(async (params: {
    file_path: string;
    content: string;
  }) => {
    const callInfo = {
      args: [params],
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    try {
      const { file_path, content } = params;

      if (!file_path) {
        const error = new Error('file_path parameter is required');
        callInfo.error = error;
        throw error;
      }

      if (content === undefined || content === null) {
        const error = new Error('content parameter is required');
        callInfo.error = error;
        throw error;
      }

      // Write to virtual filesystem
      filesystem.writeFile(file_path, content);

      const result = {
        success: true,
        file_path,
        bytes_written: Buffer.byteLength(content, 'utf-8'),
        lines_written: content.split('\n').length,
        created: !filesystem.fileExists(file_path),
      };

      callInfo.result = result;
      return result;
    } finally {
      calls.push(callInfo);
    }
  });

  return {
    mock: mockFn,
    config: { tool: 'Write', shouldSucceed: true, trackCalls: true },
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
    },
    getCallHistory: () => [...calls],
  };
}

// ============================================================================
// Edit Tool Mocks
// ============================================================================

/**
 * Create an Edit tool mock with virtual filesystem support
 */
export function createEditToolMock(filesystem: VirtualFilesystem): ToolMock {
  const calls: ToolMock['calls'] = [];

  const mockFn = vi.fn().mockImplementation(async (params: {
    file_path: string;
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  }) => {
    const callInfo = {
      args: [params],
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    try {
      const { file_path, old_string, new_string, replace_all = false } = params;

      if (!file_path) {
        const error = new Error('file_path parameter is required');
        callInfo.error = error;
        throw error;
      }

      if (!filesystem.fileExists(file_path)) {
        const error = new Error(`File not found: ${file_path}`);
        callInfo.error = error;
        throw error;
      }

      // Read current content
      const currentContent = filesystem.readFile(file_path);

      // Perform replacement
      let newContent: string;
      let replacements = 0;

      if (replace_all) {
        const regex = new RegExp(escapeRegExp(old_string), 'g');
        newContent = currentContent.replace(regex, () => {
          replacements++;
          return new_string;
        });
      } else {
        // Replace only first occurrence
        const index = currentContent.indexOf(old_string);
        if (index === -1) {
          const error = new Error(`String not found in file: "${old_string}"`);
          callInfo.error = error;
          throw error;
        }

        newContent =
          currentContent.substring(0, index) +
          new_string +
          currentContent.substring(index + old_string.length);
        replacements = 1;
      }

      // Check if replace_all was false but multiple occurrences exist
      if (!replace_all && currentContent.split(old_string).length > 2) {
        const error = new Error(
          `Multiple occurrences of "${old_string}" found. Use replace_all: true to replace all occurrences.`
        );
        callInfo.error = error;
        throw error;
      }

      // Write updated content back to filesystem
      filesystem.writeFile(file_path, newContent);

      const result = {
        success: true,
        file_path,
        replacements_made: replacements,
        bytes_changed: Buffer.byteLength(newContent, 'utf-8') - Buffer.byteLength(currentContent, 'utf-8'),
        lines_changed: newContent.split('\n').length - currentContent.split('\n').length,
      };

      callInfo.result = result;
      return result;
    } finally {
      calls.push(callInfo);
    }
  });

  return {
    mock: mockFn,
    config: { tool: 'Edit', shouldSucceed: true, trackCalls: true },
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
    },
    getCallHistory: () => [...calls],
  };
}

// ============================================================================
// Filesystem Test Scenarios
// ============================================================================

/**
 * Set up a complete filesystem mock suite for comprehensive testing
 */
export function createFilesystemMockSuite(options: {
  initialFiles?: Record<string, string>;
  maxFileSize?: number;
  readOnly?: boolean;
} = {}): {
  filesystem: VirtualFilesystem;
  readMock: ToolMock;
  writeMock: ToolMock;
  editMock: ToolMock;
} {
  const filesystem = new VirtualFilesystem();
  const { initialFiles = {}, readOnly = false } = options;

  // Set up initial files
  Object.entries(initialFiles).forEach(([path, content]) => {
    filesystem.writeFile(path, content);
  });

  const readMock = createRealisticReadToolMock(filesystem);
  const writeMock = readOnly
    ? createToolMock({
        tool: 'Write',
        shouldSucceed: false,
        error: new Error('Filesystem is read-only'),
        trackCalls: true,
      })
    : createWriteToolMock(filesystem);

  const editMock = readOnly
    ? createToolMock({
        tool: 'Edit',
        shouldSucceed: false,
        error: new Error('Filesystem is read-only'),
        trackCalls: true,
      })
    : createEditToolMock(filesystem);

  return {
    filesystem,
    readMock,
    writeMock,
    editMock,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Escape string for use in regular expressions
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}