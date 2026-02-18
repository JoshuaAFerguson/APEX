/**
 * @fileoverview Search Tool Mocks
 *
 * This file provides mock implementations for search-related tools
 * including Grep and Glob for file content and pattern searching.
 */

import { vi } from 'vitest';
import path from 'path';
import type { ToolMock } from '../types.js';

// ============================================================================
// Search Result Types
// ============================================================================

interface GrepMatch {
  file: string;
  line: number;
  content: string;
  column?: number;
}

interface GlobMatch {
  file: string;
  relativePath: string;
  modifiedTime?: Date;
  size?: number;
}

// ============================================================================
// Grep Tool Mock
// ============================================================================

/**
 * Create a Grep tool mock with configurable search results
 */
export function createGrepMock(
  mockFileSystem: Map<string, string> = new Map(),
  options: {
    caseSensitive?: boolean;
    maxResults?: number;
    simulateDelay?: boolean;
  } = {}
): ToolMock {
  const calls: ToolMock['calls'] = [];
  const { caseSensitive = true, maxResults = 100, simulateDelay = true } = options;

  const mockFn = vi.fn().mockImplementation(async (params: {
    pattern: string;
    path?: string;
    glob?: string;
    type?: string;
    output_mode?: 'content' | 'files_with_matches' | 'count';
    '-i'?: boolean;
    '-n'?: boolean;
    '-A'?: number;
    '-B'?: number;
    '-C'?: number;
    head_limit?: number;
    offset?: number;
    multiline?: boolean;
  }) => {
    const callInfo = {
      args: [params],
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    try {
      const {
        pattern,
        path: searchPath = '.',
        glob,
        type,
        output_mode = 'files_with_matches',
        '-i': ignoreCase = false,
        '-n': showLineNumbers = true,
        '-A': after = 0,
        '-B': before = 0,
        '-C': context = 0,
        head_limit = 0,
        offset = 0,
        multiline = false,
      } = params;

      if (!pattern) {
        const error = new Error('Pattern parameter is required');
        callInfo.error = error;
        throw error;
      }

      // Simulate search delay
      if (simulateDelay) {
        await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
      }

      const searchFlags = ignoreCase || !caseSensitive ? 'gi' : 'g';
      const searchRegex = multiline
        ? new RegExp(pattern, searchFlags + 'm')
        : new RegExp(pattern, searchFlags);

      const matches: GrepMatch[] = [];
      const filesWithMatches = new Set<string>();
      const fileCounts: Record<string, number> = {};

      // Search through mock file system
      for (const [filePath, content] of mockFileSystem) {
        // Apply file filtering
        if (!shouldSearchFile(filePath, { glob, type, searchPath })) {
          continue;
        }

        const lines = content.split('\n');
        let fileMatchCount = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = line.match(searchRegex);

          if (match) {
            matches.push({
              file: filePath,
              line: i + 1,
              content: line,
              column: match.index,
            });
            filesWithMatches.add(filePath);
            fileMatchCount++;

            if (matches.length >= maxResults) {
              break;
            }
          }
        }

        if (fileMatchCount > 0) {
          fileCounts[filePath] = fileMatchCount;
        }

        if (matches.length >= maxResults) {
          break;
        }
      }

      // Apply head_limit and offset
      let finalMatches = matches;
      if (offset > 0) {
        finalMatches = finalMatches.slice(offset);
      }
      if (head_limit > 0) {
        finalMatches = finalMatches.slice(0, head_limit);
      }

      // Format output based on mode
      let result: any;
      switch (output_mode) {
        case 'content':
          const contentLines = finalMatches.map((match) => {
            let line = showLineNumbers ? `${match.line}→${match.content}` : match.content;

            // Add context lines if requested
            if (context > 0 || before > 0 || after > 0) {
              const contextBefore = Math.max(before, context);
              const contextAfter = Math.max(after, context);
              // This is simplified - full implementation would include context
              line = `${match.file}:${line}`;
            } else {
              line = `${match.file}:${line}`;
            }

            return line;
          });

          result = {
            success: true,
            pattern,
            output_mode,
            matches: contentLines,
            total_matches: matches.length,
            files_searched: mockFileSystem.size,
          };
          break;

        case 'files_with_matches':
          result = {
            success: true,
            pattern,
            output_mode,
            files: Array.from(filesWithMatches).slice(offset, head_limit > 0 ? offset + head_limit : undefined),
            total_files_with_matches: filesWithMatches.size,
            files_searched: mockFileSystem.size,
          };
          break;

        case 'count':
          const countEntries = Object.entries(fileCounts).slice(
            offset,
            head_limit > 0 ? offset + head_limit : undefined
          );
          result = {
            success: true,
            pattern,
            output_mode,
            counts: countEntries.map(([file, count]) => ({ file, count })),
            total_files_with_matches: filesWithMatches.size,
            total_matches: matches.length,
            files_searched: mockFileSystem.size,
          };
          break;

        default:
          result = {
            success: true,
            pattern,
            files: Array.from(filesWithMatches),
            total_matches: matches.length,
            files_searched: mockFileSystem.size,
          };
      }

      callInfo.result = result;
      return result;
    } finally {
      calls.push(callInfo);
    }
  });

  return {
    mock: mockFn,
    config: { tool: 'Grep', shouldSucceed: true, trackCalls: true },
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
    },
    getCallHistory: () => [...calls],
  };
}

// ============================================================================
// Glob Tool Mock
// ============================================================================

/**
 * Create a Glob tool mock with configurable file matching
 */
export function createGlobMock(
  mockFileSystem: Set<string> = new Set(),
  options: {
    sortByTime?: boolean;
    simulateDelay?: boolean;
    maxResults?: number;
  } = {}
): ToolMock {
  const calls: ToolMock['calls'] = [];
  const { sortByTime = true, simulateDelay = true, maxResults = 1000 } = options;

  const mockFn = vi.fn().mockImplementation(async (params: {
    pattern: string;
    path?: string;
  }) => {
    const callInfo = {
      args: [params],
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    try {
      const { pattern, path: searchPath = '.' } = params;

      if (!pattern) {
        const error = new Error('Pattern parameter is required');
        callInfo.error = error;
        throw error;
      }

      // Simulate search delay
      if (simulateDelay) {
        await new Promise((resolve) => setTimeout(resolve, 25 + Math.random() * 50));
      }

      // Convert glob pattern to regex
      const globRegex = globToRegex(pattern);
      const matches: string[] = [];

      for (const filePath of mockFileSystem) {
        // Check if file is within search path
        if (!filePath.startsWith(searchPath === '.' ? '' : searchPath)) {
          continue;
        }

        // Test against pattern
        const relativePath = path.relative(searchPath === '.' ? '' : searchPath, filePath);
        if (globRegex.test(relativePath) || globRegex.test(filePath)) {
          matches.push(filePath);

          if (matches.length >= maxResults) {
            break;
          }
        }
      }

      // Sort results
      if (sortByTime) {
        // Mock sort by modification time (newest first)
        matches.sort((a, b) => {
          // Generate consistent but pseudo-random timestamps
          const timeA = generateMockFileTime(a);
          const timeB = generateMockFileTime(b);
          return timeB.getTime() - timeA.getTime();
        });
      } else {
        // Alphabetical sort
        matches.sort();
      }

      const result = {
        success: true,
        pattern,
        search_path: searchPath,
        files: matches,
        total_files: matches.length,
        files_searched: mockFileSystem.size,
      };

      callInfo.result = result;
      return result;
    } finally {
      calls.push(callInfo);
    }
  });

  return {
    mock: mockFn,
    config: { tool: 'Glob', shouldSucceed: true, trackCalls: true },
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
    },
    getCallHistory: () => [...calls],
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert glob pattern to regular expression
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/\./g, '\\.')
    .replace(/\?/g, '.')
    .replace(/\*/g, '[^/]*')
    .replace(/\*\*/g, '.*');

  return new RegExp(`^${escaped}$`);
}

/**
 * Check if a file should be searched based on filters
 */
function shouldSearchFile(
  filePath: string,
  filters: {
    glob?: string;
    type?: string;
    searchPath?: string;
  }
): boolean {
  const { glob, type, searchPath } = filters;

  // Check if file is within search path
  if (searchPath && searchPath !== '.' && !filePath.startsWith(searchPath)) {
    return false;
  }

  // Check glob filter
  if (glob) {
    const globRegex = globToRegex(glob);
    const relativePath = searchPath ? path.relative(searchPath, filePath) : filePath;
    if (!globRegex.test(relativePath)) {
      return false;
    }
  }

  // Check type filter
  if (type) {
    const extension = path.extname(filePath).slice(1).toLowerCase();
    const typeExtensions: Record<string, string[]> = {
      js: ['js', 'mjs', 'cjs'],
      ts: ['ts', 'tsx'],
      py: ['py', 'pyx', 'pyi'],
      java: ['java'],
      go: ['go'],
      rust: ['rs'],
      cpp: ['cpp', 'cxx', 'cc', 'c'],
      html: ['html', 'htm'],
      css: ['css', 'scss', 'sass'],
      md: ['md', 'markdown'],
      json: ['json'],
      yaml: ['yaml', 'yml'],
      xml: ['xml'],
    };

    const allowedExtensions = typeExtensions[type];
    if (allowedExtensions && !allowedExtensions.includes(extension)) {
      return false;
    }
  }

  return true;
}

/**
 * Generate a consistent mock file modification time
 */
function generateMockFileTime(filePath: string): Date {
  // Generate pseudo-random but consistent time based on file path
  let hash = 0;
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use hash to generate time within last 30 days
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const timeOffset = Math.abs(hash) % thirtyDaysMs;

  return new Date(now - timeOffset);
}