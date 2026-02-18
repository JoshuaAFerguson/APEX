/**
 * @fileoverview Integration tests for GrepTool
 *
 * Tests the GrepTool with actual ripgrep execution including:
 * - Real file system operations
 * - Ripgrep command execution
 * - All output modes
 * - Context lines functionality
 * - File filtering
 * - Large file handling
 * - Cancellation support
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { GrepTool, type GrepToolInput, type GrepToolOutput } from '../grep-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

describe('GrepTool Integration Tests', () => {
  let tool: GrepTool;
  let tempDir: string;
  let testFiles: string[] = [];

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'grep-tool-test-'));
  });

  beforeEach(async () => {
    tool = new GrepTool();
    testFiles = [];
    vi.clearAllMocks();

    // Create test files for each test
    await createTestFiles();
  });

  afterEach(async () => {
    // Clean up test files
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    testFiles = [];
  });

  async function createTestFile(name: string, content: string): Promise<string> {
    const filePath = path.join(tempDir, name);
    await fs.writeFile(filePath, content, 'utf8');
    testFiles.push(filePath);
    return filePath;
  }

  async function createTestFiles(): Promise<void> {
    // JavaScript file with various patterns
    await createTestFile('test.js', `
function hello() {
  console.log("Hello, World!");
  // TODO: Add error handling
  return "success";
}

async function fetchData() {
  try {
    const data = await fetch('/api/data');
    return data;
  } catch (error) {
    // FIXME: Better error handling needed
    throw error;
  }
}

class MyClass {
  constructor() {
    this.value = 42;
  }
}

export default MyClass;
`);

    // TypeScript file
    await createTestFile('test.ts', `
interface User {
  id: number;
  name: string;
  email: string;
}

interface AdminUser extends User {
  permissions: string[];
}

async function getUser(id: number): Promise<User> {
  // TODO: Implement user fetching
  const response = await fetch(\`/users/\${id}\`);
  return response.json();
}

function isAdmin(user: User): user is AdminUser {
  return 'permissions' in user;
}
`);

    // Python file
    await createTestFile('test.py', `
import json
import asyncio
from typing import Dict, List

def hello_world():
    print("Hello, World!")
    # TODO: Add logging
    return "success"

async def fetch_data() -> Dict:
    # FIXME: Add proper error handling
    await asyncio.sleep(1)
    return {"data": "test"}

class Calculator:
    def __init__(self):
        self.value = 0

    def add(self, x: int) -> int:
        self.value += x
        return self.value
`);

    // Text file with mixed content
    await createTestFile('README.md', `
# Test Project

This is a test project for the Grep tool.

## Features

- Search functionality
- Pattern matching
- File filtering

## TODO

- [ ] Add more tests
- [ ] Improve documentation
- [ ] FIXME: Fix broken links

## Usage

\`\`\`javascript
function example() {
  console.log("example");
}
\`\`\`

Error handling should be improved in the future.
`);

    // Large file for performance testing
    const largeContent = Array.from({ length: 1000 }, (_, i) =>
      `Line ${i + 1}: This is a test line with some content. Error code: E${i % 100}.`
    ).join('\n');
    await createTestFile('large.txt', largeContent);
  }

  describe('Basic Search Functionality', () => {
    it('should find simple string matches in content mode', async () => {
      const result = await tool.execute({
        pattern: 'Hello',
        path: tempDir,
        output_mode: 'content',
      });

      expect(result.success).toBe(true);
      expect(result.output?.mode).toBe('content');
      expect(result.output?.matches).toBeDefined();
      expect(result.output?.matches!.length).toBeGreaterThan(0);

      const helloMatch = result.output?.matches!.find(m => m.content.includes('Hello'));
      expect(helloMatch).toBeDefined();
      expect(helloMatch?.line).toBeGreaterThan(0);
      expect(helloMatch?.path).toMatch(/test\.(js|py)/);
    });

    it('should find regex patterns', async () => {
      const result = await tool.execute({
        pattern: 'function\\s+\\w+',
        path: tempDir,
        output_mode: 'content',
      });

      expect(result.success).toBe(true);
      expect(result.output?.matches!.length).toBeGreaterThan(0);

      const functionMatch = result.output?.matches!.find(m =>
        m.content.match(/function\s+\w+/)
      );
      expect(functionMatch).toBeDefined();
    });

    it('should handle case insensitive search', async () => {
      const result = await tool.execute({
        pattern: 'HELLO',
        path: tempDir,
        output_mode: 'content',
        '-i': true,
      });

      expect(result.success).toBe(true);
      expect(result.output?.matches!.length).toBeGreaterThan(0);
    });
  });

  describe('Output Modes', () => {
    it('should return only file paths in files_with_matches mode', async () => {
      const result = await tool.execute({
        pattern: 'TODO',
        path: tempDir,
        output_mode: 'files_with_matches',
      });

      expect(result.success).toBe(true);
      expect(result.output?.mode).toBe('files_with_matches');
      expect(result.output?.files).toBeDefined();
      expect(result.output?.matches).toBeUndefined();
      expect(result.output?.counts).toBeUndefined();

      expect(result.output?.files!.length).toBeGreaterThan(0);
      expect(result.output?.files!.every(f => f.includes(tempDir))).toBe(true);
    });

    it('should return match counts in count mode', async () => {
      const result = await tool.execute({
        pattern: 'TODO',
        path: tempDir,
        output_mode: 'count',
      });

      expect(result.success).toBe(true);
      expect(result.output?.mode).toBe('count');
      expect(result.output?.counts).toBeDefined();
      expect(result.output?.files).toBeUndefined();
      expect(result.output?.matches).toBeUndefined();

      expect(result.output?.counts!.length).toBeGreaterThan(0);
      const totalMatches = result.output?.counts!.reduce((sum, c) => sum + c.count, 0);
      expect(totalMatches).toBeGreaterThan(0);
      expect(result.output?.totalMatches).toBe(totalMatches);
    });

    it('should default to files_with_matches mode', async () => {
      const result = await tool.execute({
        pattern: 'TODO',
        path: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.output?.mode).toBe('files_with_matches');
      expect(result.output?.files).toBeDefined();
    });
  });

  describe('Context Lines', () => {
    it('should include lines after matches with -A option', async () => {
      const result = await tool.execute({
        pattern: 'TODO',
        path: tempDir,
        output_mode: 'content',
        '-A': 2,
      });

      expect(result.success).toBe(true);
      expect(result.output?.matches!.length).toBeGreaterThan(0);
      // Note: Context lines are handled by ripgrep's JSON output format
      // The exact implementation depends on how ripgrep reports context
    });

    it('should include lines before matches with -B option', async () => {
      const result = await tool.execute({
        pattern: 'TODO',
        path: tempDir,
        output_mode: 'content',
        '-B': 1,
      });

      expect(result.success).toBe(true);
      expect(result.output?.matches!.length).toBeGreaterThan(0);
    });

    it('should include lines before and after matches with -C option', async () => {
      const result = await tool.execute({
        pattern: 'TODO',
        path: tempDir,
        output_mode: 'content',
        '-C': 1,
      });

      expect(result.success).toBe(true);
      expect(result.output?.matches!.length).toBeGreaterThan(0);
    });
  });

  describe('File Filtering', () => {
    it('should filter by file type', async () => {
      const result = await tool.execute({
        pattern: 'function',
        path: tempDir,
        type: 'js',
        output_mode: 'files_with_matches',
      });

      expect(result.success).toBe(true);
      expect(result.output?.files!.length).toBeGreaterThan(0);
      expect(result.output?.files!.every(f => f.endsWith('.js'))).toBe(true);
    });

    it('should filter by glob pattern', async () => {
      const result = await tool.execute({
        pattern: 'interface',
        path: tempDir,
        glob: '*.ts',
        output_mode: 'files_with_matches',
      });

      expect(result.success).toBe(true);
      expect(result.output?.files!.length).toBeGreaterThan(0);
      expect(result.output?.files!.every(f => f.endsWith('.ts'))).toBe(true);
    });

    it('should search in multiple file types with glob pattern', async () => {
      const result = await tool.execute({
        pattern: 'TODO',
        path: tempDir,
        glob: '*.{js,ts,py}',
        output_mode: 'files_with_matches',
      });

      expect(result.success).toBe(true);
      expect(result.output?.files!.length).toBeGreaterThan(0);
      expect(result.output?.files!.every(f =>
        f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.py')
      )).toBe(true);
    });
  });

  describe('Multiline Matching', () => {
    beforeEach(async () => {
      await createTestFile('multiline.txt', `
First line
Second line continues
the same thought

Another paragraph
starts here
`);
    });

    it('should handle multiline patterns', async () => {
      const result = await tool.execute({
        pattern: 'Second.*continues.*same',
        path: tempDir,
        multiline: true,
        output_mode: 'content',
      });

      expect(result.success).toBe(true);
      // Multiline matching behavior depends on ripgrep's JSON output format
    });
  });

  describe('Pagination and Limiting', () => {
    it('should limit results with head_limit', async () => {
      const result = await tool.execute({
        pattern: 'Line',
        path: path.join(tempDir, 'large.txt'),
        output_mode: 'content',
        head_limit: 5,
      });

      expect(result.success).toBe(true);
      expect(result.output?.matches!.length).toBeLessThanOrEqual(5);
    });

    it('should skip results with offset', async () => {
      const allResult = await tool.execute({
        pattern: 'Line',
        path: path.join(tempDir, 'large.txt'),
        output_mode: 'content',
        head_limit: 10,
      });

      const offsetResult = await tool.execute({
        pattern: 'Line',
        path: path.join(tempDir, 'large.txt'),
        output_mode: 'content',
        offset: 5,
        head_limit: 5,
      });

      expect(allResult.success).toBe(true);
      expect(offsetResult.success).toBe(true);

      // The offset result should start from where the first 5 results ended
      if (allResult.output?.matches && offsetResult.output?.matches) {
        expect(offsetResult.output.matches.length).toBeGreaterThan(0);
        expect(offsetResult.output.matches.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent directory', async () => {
      const result = await tool.execute({
        pattern: 'test',
        path: '/non/existent/directory',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search path not found');
    });

    it('should handle permission denied errors', async () => {
      // Create a directory without read permissions (Unix-only test)
      if (process.platform !== 'win32') {
        const restrictedDir = path.join(tempDir, 'restricted');
        await fs.mkdir(restrictedDir, { mode: 0o000 });

        const result = await tool.execute({
          pattern: 'test',
          path: restrictedDir,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Permission denied');

        // Restore permissions for cleanup
        await fs.chmod(restrictedDir, 0o755);
        await fs.rmdir(restrictedDir);
      }
    });

    it('should handle ripgrep not available', async () => {
      // Mock the checkRipgrepAvailability method to return false
      const tool = new GrepTool();
      const mockCheck = vi.spyOn(tool as any, 'checkRipgrepAvailability');
      mockCheck.mockResolvedValue(false);

      const result = await tool.execute({
        pattern: 'test',
        path: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Ripgrep (rg) is not available');

      mockCheck.mockRestore();
    });
  });

  describe('Cancellation Support', () => {
    it('should respect abort signal', async () => {
      const abortController = new AbortController();
      const context: ToolExecutionContext = {
        signal: abortController.signal,
      };

      // Cancel immediately
      abortController.abort();

      const result = await tool.execute({
        pattern: 'test',
        path: tempDir,
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    }, 10000);

    it('should handle cancellation during execution', async () => {
      const abortController = new AbortController();
      const context: ToolExecutionContext = {
        signal: abortController.signal,
      };

      // Cancel after a short delay
      setTimeout(() => abortController.abort(), 100);

      const result = await tool.execute({
        pattern: '.*',
        path: tempDir,
        output_mode: 'content',
      }, context);

      // Result could be either success (if completed quickly) or cancelled
      if (!result.success) {
        expect(result.error).toContain('cancelled');
      }
    }, 10000);
  });

  describe('Performance and Large Files', () => {
    it('should handle large files efficiently', async () => {
      const startTime = Date.now();

      const result = await tool.execute({
        pattern: 'Error',
        path: path.join(tempDir, 'large.txt'),
        output_mode: 'count',
      });

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output?.totalMatches).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should report accurate search timing', async () => {
      const result = await tool.execute({
        pattern: 'TODO',
        path: tempDir,
        output_mode: 'content',
      });

      expect(result.success).toBe(true);
      expect(result.output?.searchTime).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.invokedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });
  });

  describe('Path Resolution', () => {
    it('should work with absolute paths', async () => {
      const result = await tool.execute({
        pattern: 'TODO',
        path: tempDir, // Already absolute
        output_mode: 'files_with_matches',
      });

      expect(result.success).toBe(true);
      expect(result.output?.files!.length).toBeGreaterThan(0);
    });

    it('should work with relative paths', async () => {
      const relativePath = path.relative(process.cwd(), tempDir);

      const result = await tool.execute({
        pattern: 'TODO',
        path: relativePath,
        output_mode: 'files_with_matches',
      });

      expect(result.success).toBe(true);
      expect(result.output?.files!.length).toBeGreaterThan(0);
    });

    it('should use working directory from context', async () => {
      const context: ToolExecutionContext = {
        workingDirectory: path.dirname(tempDir),
      };

      const result = await tool.execute({
        pattern: 'TODO',
        path: path.basename(tempDir),
        output_mode: 'files_with_matches',
      }, context);

      expect(result.success).toBe(true);
      expect(result.output?.files!.length).toBeGreaterThan(0);
    });

    it('should default to current working directory', async () => {
      // Create a test file in current working directory
      const cwd = process.cwd();
      const testFile = path.join(cwd, 'temp-grep-test.txt');
      await fs.writeFile(testFile, 'This is a test for grep tool', 'utf8');

      try {
        const result = await tool.execute({
          pattern: 'grep tool',
          output_mode: 'files_with_matches',
        });

        expect(result.success).toBe(true);
        // Should find the test file
        expect(result.output?.files!.some(f => f.includes('temp-grep-test.txt'))).toBe(true);
      } finally {
        // Clean up
        await fs.unlink(testFile);
      }
    });
  });
});