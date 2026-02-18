/**
 * @fileoverview Performance tests for MultiEditTool - Testing scalability and efficiency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  MultiEditTool,
  type MultiEditFileParams,
} from '../multi-edit-tool.js';

describe('MultiEditTool - Performance Tests', () => {
  let tool: MultiEditTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new MultiEditTool();
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'multi-edit-performance-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Batch Operation Scalability', () => {
    it('should handle small batch operations efficiently (1-10 edits)', async () => {
      const testFile = path.join(testDir, 'small-batch.js');
      const content = `
const config = {
  api: 'http://localhost:3000',
  version: 'v1',
  timeout: 5000,
  retries: 3,
  debug: true
};

function processData(data) {
  console.log('Processing:', data);
  return transformData(data);
}
`.trim();

      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'http://localhost:3000', new_string: 'https://api.production.com' },
          { old_string: 'v1', new_string: 'v2' },
          { old_string: '5000', new_string: '10000' },
          { old_string: 'debug: true', new_string: 'debug: false' },
          { old_string: 'console.log', new_string: 'logger.info' },
        ],
      };

      const startTime = Date.now();
      const result = await tool.execute(params);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output?.editsApplied).toBe(5);

      // Small batches should complete very quickly (under 100ms)
      expect(executionTime).toBeLessThan(100);

      // Verify content quality
      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toContain('https://api.production.com');
      expect(newContent).toContain('logger.info');
    });

    it('should handle medium batch operations efficiently (25-50 edits)', async () => {
      const testFile = path.join(testDir, 'medium-batch.sql');

      // Create a SQL migration file with many similar patterns
      const tableDefinitions = Array.from({ length: 25 }, (_, i) => `
CREATE TABLE table_${i} (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`).join('\n');

      const content = `-- Database Migration Script\n${tableDefinitions}`;
      await fs.writeFile(testFile, content);

      // Create edits to update all table definitions
      const edits = Array.from({ length: 25 }, (_, i) => ({
        old_string: `CREATE TABLE table_${i} (`,
        new_string: `CREATE TABLE IF NOT EXISTS new_table_${i} (`
      }));

      // Add more edits to update data types
      edits.push(
        ...Array.from({ length: 25 }, (_, i) => ({
          old_string: 'VARCHAR(255) NOT NULL',
          new_string: 'TEXT NOT NULL',
          replace_all: false  // Only replace first occurrence per edit
        }))
      );

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits,
      };

      const startTime = Date.now();
      const result = await tool.execute(params);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output?.editsApplied).toBe(50);

      // Medium batches should complete quickly (under 500ms)
      expect(executionTime).toBeLessThan(500);

      // Verify performance didn't degrade accuracy
      const newContent = await fs.readFile(testFile, 'utf-8');
      for (let i = 0; i < 25; i++) {
        expect(newContent).toContain(`CREATE TABLE IF NOT EXISTS new_table_${i}`);
      }
    });

    it('should handle large batch operations efficiently (75-100 edits)', async () => {
      const testFile = path.join(testDir, 'large-batch.json');

      // Create a large configuration file
      const configEntries = Array.from({ length: 100 }, (_, i) => `
  "setting_${i}": {
    "value": "default_value_${i}",
    "type": "string",
    "required": true,
    "description": "Setting ${i} description"
  }`).join(',');

      const content = `{
  "version": "1.0",
  "settings": {${configEntries}
  }
}`;

      await fs.writeFile(testFile, content);

      // Create 100 edits to update all default values
      const edits = Array.from({ length: 100 }, (_, i) => ({
        old_string: `"default_value_${i}"`,
        new_string: `"updated_value_${i}"`
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

      // Large batches should complete in reasonable time (under 2 seconds)
      expect(executionTime).toBeLessThan(2000);

      // Verify all edits were applied correctly
      const newContent = await fs.readFile(testFile, 'utf-8');
      for (let i = 0; i < 100; i++) {
        expect(newContent).toContain(`"updated_value_${i}"`);
        expect(newContent).not.toContain(`"default_value_${i}"`);
      }

      // Verify performance metrics
      expect(result.output?.changePreview).toContain('Applied 100/100 edits');
      expect(result.output?.sizeChange.after).toBeGreaterThan(result.output?.sizeChange.before!);
    });

    it('should maintain consistent performance across multiple batch operations', async () => {
      const executionTimes: number[] = [];

      // Run the same operation 5 times to check for performance degradation
      for (let run = 0; run < 5; run++) {
        const testFile = path.join(testDir, `consistency-test-${run}.py`);
        const content = `
# Python script with repeated patterns
${Array.from({ length: 20 }, (_, i) => `
def function_${i}():
    print("Function ${i}")
    return process_data_${i}()

def process_data_${i}():
    return {"id": ${i}, "name": "item_${i}"}
`).join('')}
`.trim();

        await fs.writeFile(testFile, content);

        const edits = Array.from({ length: 20 }, (_, i) => ({
          old_string: `print("Function ${i}")`,
          new_string: `logging.info("Function ${i} called")`
        }));

        const params: MultiEditFileParams = {
          file_path: testFile,
          edits,
        };

        const startTime = Date.now();
        const result = await tool.execute(params);
        const executionTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(result.output?.editsApplied).toBe(20);

        executionTimes.push(executionTime);
      }

      // Check that performance is consistent (no run should be more than 3x slower than the fastest)
      const minTime = Math.min(...executionTimes);
      const maxTime = Math.max(...executionTimes);
      const performanceRatio = maxTime / minTime;

      expect(performanceRatio).toBeLessThan(3);
      expect(executionTimes.every(time => time < 1000)).toBe(true); // All runs under 1 second
    });
  });

  describe('File Size Scalability', () => {
    it('should handle small files efficiently (< 1KB)', async () => {
      const testFile = path.join(testDir, 'small-file.txt');
      const content = 'Small file content with several words to replace and modify during testing.';
      await fs.writeFile(testFile, content);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'Small file', new_string: 'Tiny document' },
          { old_string: 'several words', new_string: 'multiple terms' },
          { old_string: 'testing', new_string: 'validation' },
        ],
      };

      const startTime = Date.now();
      const result = await tool.execute(params);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(50); // Very small files should be extremely fast
    });

    it('should handle medium files efficiently (10-100KB)', async () => {
      const testFile = path.join(testDir, 'medium-file.js');

      // Create a ~50KB JavaScript file
      const functionTemplate = `
function processItem${'{index}'}(data) {
  const result = validateData${'{index}'}(data);
  if (!result.valid) {
    throw new Error('Invalid data for item ${'{index}'}');
  }

  return {
    id: ${'{index}'},
    processed: true,
    data: transformData${'{index}'}(result.data),
    timestamp: new Date().toISOString()
  };
}

function validateData${'{index}'}(data) {
  return {
    valid: data && data.id === ${'{index}'},
    data: data
  };
}

function transformData${'{index}'}(data) {
  return {
    ...data,
    transformed: true,
    version: '1.0.${'{index}'}'
  };
}
`;

      const content = Array.from({ length: 100 }, (_, i) =>
        functionTemplate.replace(/\{index\}/g, i.toString())
      ).join('\n');

      await fs.writeFile(testFile, content);

      // Verify file size is in expected range
      const stats = await fs.stat(testFile);
      expect(stats.size).toBeGreaterThan(10000);
      expect(stats.size).toBeLessThan(100000);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'validateData', new_string: 'verifyData', replace_all: true },
          { old_string: 'transformData', new_string: 'convertData', replace_all: true },
          { old_string: 'processed: true', new_string: 'processed: true, enhanced: true', replace_all: true },
        ],
      };

      const startTime = Date.now();
      const result = await tool.execute(params);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(1000); // Medium files should complete under 1 second

      // Verify the edits were applied correctly
      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toContain('verifyData');
      expect(newContent).toContain('convertData');
      expect(newContent).toContain('enhanced: true');
      expect(newContent).not.toContain('validateData');
      expect(newContent).not.toContain('transformData');
    });

    it('should handle large files efficiently (1-5MB)', async () => {
      const testFile = path.join(testDir, 'large-file.csv');

      // Create a ~2MB CSV file
      const headerRow = 'id,name,email,phone,address,city,state,country,created_at,updated_at\n';
      const dataRows = Array.from({ length: 20000 }, (_, i) =>
        `${i},user_${i},user${i}@oldomain.com,555-${String(i).padStart(4, '0')},123 Main St,City${i % 100},State${i % 50},Country${i % 10},2023-01-01,2023-01-01`
      ).join('\n');

      const content = headerRow + dataRows;
      await fs.writeFile(testFile, content);

      // Verify file size is in expected range
      const stats = await fs.stat(testFile);
      expect(stats.size).toBeGreaterThan(1000000); // > 1MB
      expect(stats.size).toBeLessThan(5000000);    // < 5MB

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: '@oldomain.com', new_string: '@newdomain.com', replace_all: true },
          { old_string: '123 Main St', new_string: '456 Oak Avenue', replace_all: true },
          { old_string: '2023-01-01', new_string: '2024-01-01', replace_all: true },
        ],
      };

      const startTime = Date.now();
      const result = await tool.execute(params);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Large files should complete under 5 seconds

      // Verify the massive replacement worked correctly
      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toContain('@newdomain.com');
      expect(newContent).toContain('456 Oak Avenue');
      expect(newContent).toContain('2024-01-01');
      expect(newContent).not.toContain('@oldomain.com');
      expect(newContent).not.toContain('123 Main St');
      expect(newContent).not.toContain('2023-01-01');

      // Verify edit statistics
      expect(result.output?.editResults[0].replacements).toBe(20000); // All email addresses
      expect(result.output?.editResults[1].replacements).toBe(20000); // All addresses
      expect(result.output?.editResults[2].replacements).toBe(40000); // All date fields (created_at + updated_at)
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle batch operations without memory leaks', async () => {
      // This test runs multiple operations to check for memory accumulation
      const testPromises: Promise<void>[] = [];

      for (let i = 0; i < 10; i++) {
        const testFile = path.join(testDir, `memory-test-${i}.txt`);

        testPromises.push((async () => {
          const content = `File ${i} content with pattern_${i} to replace multiple times. Pattern_${i} appears here too.`;
          await fs.writeFile(testFile, content);

          const params: MultiEditFileParams = {
            file_path: testFile,
            edits: [
              { old_string: `pattern_${i}`, new_string: `updated_pattern_${i}`, replace_all: true },
              { old_string: `File ${i}`, new_string: `Document ${i}` },
            ],
          };

          const result = await tool.execute(params);
          expect(result.success).toBe(true);
        })());
      }

      const startTime = Date.now();
      await Promise.all(testPromises);
      const totalTime = Date.now() - startTime;

      // All 10 operations should complete quickly
      expect(totalTime).toBeLessThan(2000);
    });

    it('should efficiently handle operations with large replacement strings', async () => {
      const testFile = path.join(testDir, 'large-replacement.html');

      const smallContent = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <div id="placeholder">CONTENT_PLACEHOLDER</div>
</body>
</html>
`.trim();

      // Create a large replacement string (~100KB)
      const largeContent = '<div>' + 'Large content block. '.repeat(5000) + '</div>';

      await fs.writeFile(testFile, smallContent);

      const params: MultiEditFileParams = {
        file_path: testFile,
        edits: [
          { old_string: 'CONTENT_PLACEHOLDER', new_string: largeContent },
        ],
      };

      const startTime = Date.now();
      const result = await tool.execute(params);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(1000);

      // Verify the large content was inserted
      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toContain(largeContent);
      expect(newContent.length).toBeGreaterThan(100000);
    });
  });

  describe('Optimization Verification', () => {
    it('should show performance improvements over sequential single edits', async () => {
      const testFile1 = path.join(testDir, 'sequential-edits.txt');
      const testFile2 = path.join(testDir, 'batch-edits.txt');

      const content = Array.from({ length: 50 }, (_, i) => `line_${i}: value_${i}`).join('\n');

      await fs.writeFile(testFile1, content);
      await fs.writeFile(testFile2, content);

      // Simulate sequential single edits (what users would do without batch editing)
      const sequentialStart = Date.now();
      for (let i = 0; i < 50; i++) {
        const params: MultiEditFileParams = {
          file_path: testFile1,
          edits: [
            { old_string: `value_${i}`, new_string: `updated_${i}` },
          ],
        };
        const result = await tool.execute(params);
        expect(result.success).toBe(true);
      }
      const sequentialTime = Date.now() - sequentialStart;

      // Batch edit approach
      const batchStart = Date.now();
      const batchEdits = Array.from({ length: 50 }, (_, i) => ({
        old_string: `value_${i}`,
        new_string: `updated_${i}`
      }));

      const batchParams: MultiEditFileParams = {
        file_path: testFile2,
        edits: batchEdits,
      };

      const batchResult = await tool.execute(batchParams);
      const batchTime = Date.now() - batchStart;

      expect(batchResult.success).toBe(true);

      // Batch editing should be significantly faster than sequential
      expect(batchTime).toBeLessThan(sequentialTime * 0.5); // At least 50% faster

      // Verify both approaches produce the same result
      const content1 = await fs.readFile(testFile1, 'utf-8');
      const content2 = await fs.readFile(testFile2, 'utf-8');
      expect(content1).toBe(content2);

      console.log(`Sequential: ${sequentialTime}ms, Batch: ${batchTime}ms, Improvement: ${Math.round((1 - batchTime/sequentialTime) * 100)}%`);
    });
  });
});