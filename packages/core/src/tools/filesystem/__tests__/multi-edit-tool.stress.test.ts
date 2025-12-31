/**
 * @fileoverview Stress tests for MultiEditTool - Testing rollback behavior under extreme conditions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  MultiEditTool,
  type MultiEditFileParams,
  BatchEditError,
} from '../multi-edit-tool.js';

describe('MultiEditTool - Stress Tests', () => {
  let tool: MultiEditTool;
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    tool = new MultiEditTool();
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'multi-edit-stress-'));
    testFile = path.join(testDir, 'stress-test.txt');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Rollback Behavior Under Stress', () => {
    it('should handle rollback with large number of successful edits before failure', async () => {
      // Create a file with many repeated patterns
      const patterns = Array.from({ length: 50 }, (_, i) => `pattern_${i}=value_${i};`);
      const content = patterns.join('\n');
      await fs.writeFile(testFile, content);

      // Create many edits that will succeed, then one that fails
      const successfulEdits = Array.from({ length: 95 }, (_, i) => ({
        old_string: `pattern_${i}=value_${i};`,
        new_string: `updated_pattern_${i}=new_value_${i};`
      }));

      const failingEdit = {
        old_string: 'nonexistent_pattern=value;',
        new_string: 'replacement=value;'
      };

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [...successfulEdits, failingEdit],
      };

      const result = await tool.execute(params);

      // Should fail due to the last edit
      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');

      // Verify complete rollback - file should be exactly as it was
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(content);

      // Verify none of the successful edits remain
      for (let i = 0; i < 50; i++) {
        expect(fileContent).toContain(`pattern_${i}=value_${i};`);
        expect(fileContent).not.toContain(`updated_pattern_${i}`);
      }
    });

    it('should handle rollback with cascading edits that create conflicts', async () => {
      const content = `
function oldFunction() {
  return callOldFunction();
}

function anotherOldFunction() {
  return oldFunction();
}

function callOldFunction() {
  return "old implementation";
}

const config = {
  useOldFunction: true,
  oldFunctionTimeout: 5000
};

// Multiple references
oldFunction();
oldFunction();
oldFunction();
`.trim();

      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // First rename the function definition
          { old_string: 'function oldFunction()', new_string: 'function newFunction()' },

          // Then rename some calls (this should work)
          { old_string: 'return oldFunction();', new_string: 'return newFunction();' },

          // Update config references
          { old_string: 'useOldFunction: true', new_string: 'useNewFunction: true' },
          { old_string: 'oldFunctionTimeout: 5000', new_string: 'newFunctionTimeout: 5000' },

          // This should fail because there are still multiple 'oldFunction()' calls at the end
          { old_string: 'oldFunction();', new_string: 'newFunction();' }, // Ambiguous - multiple occurrences!

          // These would never be reached
          { old_string: 'old implementation', new_string: 'new implementation' },
        ],
      };

      const result = await tool.execute(params);

      // Should fail due to ambiguous replacement
      expect(result.success).toBe(false);
      expect(result.error).toContain('appears 3 times');

      // Verify complete rollback
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(content);

      // Verify all original content is preserved
      expect(fileContent).toContain('function oldFunction()');
      expect(fileContent).toContain('return oldFunction();');
      expect(fileContent).toContain('useOldFunction: true');
      expect(fileContent).toContain('oldFunctionTimeout: 5000');
      expect(fileContent).toContain('old implementation');

      // Verify no partial changes exist
      expect(fileContent).not.toContain('newFunction');
      expect(fileContent).not.toContain('useNewFunction');
      expect(fileContent).not.toContain('new implementation');
    });

    it('should handle rollback with complex multi-line replacements', async () => {
      const content = `
class DatabaseManager {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      this.connection = await createConnection();
    } catch (error) {
      console.log('Connection failed');
      throw error;
    }
  }

  async query(sql, params) {
    if (!this.connection) {
      await this.connect();
    }

    try {
      const result = await this.connection.query(sql, params);
      return result;
    } catch (error) {
      console.log('Query failed');
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}
`.trim();

      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Update constructor with connection pooling
          {
            old_string: `  constructor() {
    this.connection = null;
  }`,
            new_string: `  constructor(config) {
    this.pool = null;
    this.config = config;
  }`
          },

          // Update connect method
          {
            old_string: `  async connect() {
    try {
      this.connection = await createConnection();
    } catch (error) {
      console.log('Connection failed');
      throw error;
    }
  }`,
            new_string: `  async connect() {
    try {
      this.pool = await createConnectionPool(this.config);
    } catch (error) {
      this.logger.error('Connection failed', error);
      throw error;
    }
  }`
          },

          // This should fail - trying to replace a method that was already modified
          {
            old_string: `  async query(sql, params) {
    if (!this.connection) {
      await this.connect();
    }

    try {
      const result = await this.connection.query(sql, params);
      return result;
    } catch (error) {
      console.log('Query failed');
      throw error;
    }
  }`,
            new_string: `  async query(sql, params) {
    const connection = await this.pool.getConnection();

    try {
      const result = await connection.query(sql, params);
      return result;
    } catch (error) {
      this.logger.error('Query failed', error);
      throw error;
    } finally {
      connection.release();
    }
  }`
          },

          // This would fail because we're trying to reference this.connection which no longer exists after edit 1
          {
            old_string: 'if (this.connection) {',
            new_string: 'if (this.pool) {'
          },
        ],
      };

      const result = await tool.execute(params);

      // Should fail due to string not found (the query method string changed after connect method was modified)
      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');

      // Verify complete rollback
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(content);

      // Verify original content is intact
      expect(fileContent).toContain('this.connection = null');
      expect(fileContent).toContain('this.connection = await createConnection()');
      expect(fileContent).toContain('await this.connection.query(sql, params)');
      expect(fileContent).toContain('console.log(\'Connection failed\')');

      // Verify no partial changes
      expect(fileContent).not.toContain('this.pool');
      expect(fileContent).not.toContain('createConnectionPool');
      expect(fileContent).not.toContain('this.logger.error');
    });

    it('should handle memory stress with many large edits', async () => {
      // Create a large file with repeated content
      const baseContent = 'The quick brown fox jumps over the lazy dog. ';
      const repeatedContent = baseContent.repeat(1000); // ~43KB of text
      const largeContent = `
Header content here.
${repeatedContent}
Middle section with important data.
${repeatedContent}
Footer content here.
`.trim();

      await fs.writeFile(testFile, largeContent);

      // Create edits that will process a lot of data before failing
      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          // Large replacements that should succeed
          { old_string: 'The quick brown fox', new_string: 'The slow red elephant', replace_all: true },
          { old_string: 'jumps over the lazy dog', new_string: 'walks around the active cat', replace_all: true },
          { old_string: 'Header content here.', new_string: 'Updated header content with more details.' },
          { old_string: 'Middle section with important data.', new_string: 'Enhanced middle section with critical information.' },

          // This should fail
          { old_string: 'nonexistent large content block that does not exist anywhere in this file', new_string: 'replacement content' },

          // More edits that would be applied if the above didn't fail
          { old_string: 'Footer content here.', new_string: 'Enhanced footer with additional metadata.' },
        ],
      };

      const result = await tool.execute(params);

      // Should fail due to string not found
      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');

      // Verify complete rollback - this is important for large files
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(largeContent);

      // Verify original content patterns are preserved
      expect(fileContent).toContain('The quick brown fox');
      expect(fileContent).toContain('jumps over the lazy dog');
      expect(fileContent).toContain('Header content here.');
      expect(fileContent).toContain('Middle section with important data.');
      expect(fileContent).toContain('Footer content here.');

      // Verify no partial changes exist
      expect(fileContent).not.toContain('The slow red elephant');
      expect(fileContent).not.toContain('walks around the active cat');
      expect(fileContent).not.toContain('Updated header content');
      expect(fileContent).not.toContain('Enhanced middle section');
    });

    it('should handle rollback when backup file operations fail', async () => {
      const content = 'test content for backup failure simulation';
      await fs.writeFile(testFile, content);

      // Create a readonly directory to simulate backup creation failure
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.mkdir(readOnlyDir, { mode: 0o444 });
      const readOnlyFile = path.join(readOnlyDir, 'readonly.txt');
      await fs.writeFile(readOnlyFile, content);

      const params: MultiEditFileParams = {
        file_path: readOnlyFile,
        edits: [
          { old_string: 'test content', new_string: 'modified content' },
        ],
      };

      // This might fail during backup creation or file writing
      const result = await tool.execute(params);

      // Should fail due to permission issues
      expect(result.success).toBe(false);

      // Cleanup readonly directory
      await fs.chmod(readOnlyDir, 0o755);

      // Verify original file is unchanged
      const fileContent = await fs.readFile(readOnlyFile, 'utf-8');
      expect(fileContent).toBe(content);
    });
  });

  describe('Performance and Limits', () => {
    it('should handle maximum number of edits efficiently', async () => {
      // Create content with 100 unique patterns
      const patterns = Array.from({ length: 100 }, (_, i) => `unique_pattern_${i}_with_specific_value_${i}`);
      const content = patterns.join('\n');
      await fs.writeFile(testFile, content);

      // Create 100 edits (maximum allowed)
      const edits = patterns.map((pattern, i) => ({
        old_string: pattern,
        new_string: `updated_${pattern}_modified`
      }));

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits,
      };

      const startTime = Date.now();
      const result = await tool.execute(params);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output?.editsApplied).toBe(100);

      // Should complete in reasonable time (under 5 seconds for 100 edits)
      expect(executionTime).toBeLessThan(5000);

      // Verify all edits were applied
      const newContent = await fs.readFile(testFile, 'utf-8');
      for (let i = 0; i < 100; i++) {
        expect(newContent).toContain(`updated_unique_pattern_${i}_with_specific_value_${i}_modified`);
        expect(newContent).not.toContain(`unique_pattern_${i}_with_specific_value_${i}`);
      }
    });

    it('should handle edits with very large string replacements', async () => {
      const smallContent = 'small_content_to_replace';
      const largeReplacement = 'large_replacement_content_'.repeat(1000); // ~26KB replacement

      const content = `
Before section.
${smallContent}
After section.
`.trim();

      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: smallContent, new_string: largeReplacement },
        ],
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.sizeChange.before).toBeLessThan(result.output?.sizeChange.after!);

      // Verify the large replacement was applied
      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toContain(largeReplacement);
      expect(newContent).not.toContain(smallContent);
    });

    it('should provide accurate progress tracking for large batch operations', async () => {
      const patterns = Array.from({ length: 50 }, (_, i) => `item_${i}=original_value_${i};`);
      const content = patterns.join('\n');
      await fs.writeFile(testFile, content);

      const edits = patterns.map((pattern, i) => ({
        old_string: pattern,
        new_string: `item_${i}=updated_value_${i};`
      }));

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.editResults).toHaveLength(50);

      // Verify each edit result has correct metadata
      result.output?.editResults.forEach((editResult, index) => {
        expect(editResult.index).toBe(index);
        expect(editResult.replacements).toBe(1);
        expect(editResult.success).toBe(true);
        expect(editResult.modifiedLines).toHaveLength(1);
        expect(editResult.modifiedLines[0]).toBe(index + 1); // Line numbers are 1-based
      });

      // Verify summary data
      expect(result.output?.editsApplied).toBe(50);
      expect(result.output?.changePreview).toContain('Applied 50/50 edits');
    });
  });
});