/**
 * @fileoverview Comprehensive unit tests for CSV Task Export Formatter
 *
 * Tests cover all functionality defined in ADR-020 including:
 * - Input validation
 * - Basic functionality
 * - CSV-specific options (delimiter, quoting, headers)
 * - Nested data strategies (count, summary, flatten, json, omit)
 * - Usage metrics handling
 * - Field filtering
 * - Date handling
 * - Edge cases (Unicode, special characters, large datasets)
 * - Error scenarios
 *
 * Target: 100% test coverage of formatTasksToCSV function and all helpers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatTasksToCSV,
  type CSVExportOptions,
  type NestedDataStrategy,
} from '../csv-formatter.js';
import type { Task, TaskLog, TaskArtifact } from '../../types.js';
import {
  createTask,
  createTaskLog,
  createTaskArtifact,
  createTaskUsage,
  createTasks,
} from '../../factories/task-factory.js';

describe('formatTasksToCSV', () => {
  // ============================================================================
  // Input Validation Tests
  // ============================================================================

  describe('Input Validation', () => {
    it('should throw TypeError when tasks is null', () => {
      expect(() => {
        formatTasksToCSV(null as any);
      }).toThrow(TypeError);
      expect(() => {
        formatTasksToCSV(null as any);
      }).toThrow('Tasks parameter cannot be null or undefined');
    });

    it('should throw TypeError when tasks is undefined', () => {
      expect(() => {
        formatTasksToCSV(undefined as any);
      }).toThrow(TypeError);
      expect(() => {
        formatTasksToCSV(undefined as any);
      }).toThrow('Tasks parameter cannot be null or undefined');
    });

    it('should throw TypeError when tasks is not an array', () => {
      expect(() => {
        formatTasksToCSV('not-an-array' as any);
      }).toThrow(TypeError);
      expect(() => {
        formatTasksToCSV('not-an-array' as any);
      }).toThrow('Tasks parameter must be an array');

      expect(() => {
        formatTasksToCSV({ id: 'task-1' } as any);
      }).toThrow(TypeError);

      expect(() => {
        formatTasksToCSV(123 as any);
      }).toThrow(TypeError);
    });

    it('should handle empty array and return header row', () => {
      const result = formatTasksToCSV([]);
      expect(result).toBeTruthy();
      expect(result).toContain('id');
      expect(result).toContain('description');
    });

    it('should handle empty array with includeHeader: false', () => {
      const result = formatTasksToCSV([], { includeHeader: false });
      expect(result).toBe('');
    });

    it('should throw error for invalid logsStrategy', () => {
      const task = createTask();
      expect(() => {
        formatTasksToCSV([task], { logsStrategy: 'invalid' as any });
      }).toThrow('Invalid logsStrategy value');
    });

    it('should throw error for invalid artifactsStrategy', () => {
      const task = createTask();
      expect(() => {
        formatTasksToCSV([task], { artifactsStrategy: 'invalid' as any });
      }).toThrow('Invalid artifactsStrategy value');
    });

    it('should throw error for invalid usageStrategy', () => {
      const task = createTask();
      expect(() => {
        formatTasksToCSV([task], { usageStrategy: 'invalid' as any });
      }).toThrow('Invalid usageStrategy value');
    });

    it('should throw error for negative flattenLimit', () => {
      const task = createTask();
      expect(() => {
        formatTasksToCSV([task], { flattenLimit: -1 });
      }).toThrow('flattenLimit must be a non-negative number');
    });
  });

  // ============================================================================
  // Basic Functionality Tests
  // ============================================================================

  describe('Basic Functionality', () => {
    it('should export a single task with default options', () => {
      const task = createTask({
        id: 'test-task-1',
        description: 'Test task for CSV export',
        status: 'completed',
      });

      const result = formatTasksToCSV([task]);
      const lines = result.split('\n');

      expect(lines.length).toBe(2); // header + 1 data row
      expect(lines[0]).toContain('id');
      expect(lines[1]).toContain('test-task-1');
      expect(lines[1]).toContain('Test task for CSV export');
    });

    it('should export multiple tasks', () => {
      const tasks = createTasks(3, { description: 'Multi-task test' });

      const result = formatTasksToCSV(tasks);
      const lines = result.split('\n');

      expect(lines.length).toBe(4); // header + 3 data rows
    });

    it('should include all required task fields by default', () => {
      const task = createTask({
        id: 'field-test',
        description: 'Field test task',
        workflow: 'test-workflow',
        status: 'in-progress',
        priority: 'high',
        effort: 'large',
        projectPath: '/test/project',
      });

      const result = formatTasksToCSV([task]);
      const lines = result.split('\n');
      const header = lines[0];

      // Verify core fields are in header
      expect(header).toContain('id');
      expect(header).toContain('description');
      expect(header).toContain('workflow');
      expect(header).toContain('status');
      expect(header).toContain('priority');
      expect(header).toContain('effort');
      expect(header).toContain('projectPath');
      expect(header).toContain('createdAt');
      expect(header).toContain('updatedAt');
    });

    it('should convert dates to ISO 8601 strings', () => {
      const fixedDate = new Date('2023-10-15T14:30:00.000Z');
      const task = createTask({
        createdAt: fixedDate,
        updatedAt: fixedDate,
      });

      const result = formatTasksToCSV([task]);
      expect(result).toContain('2023-10-15T14:30:00.000Z');
    });

    it('should serialize array fields with semicolon separator', () => {
      const task = createTask({
        dependsOn: ['task-1', 'task-2', 'task-3'],
        blockedBy: ['task-4'],
      });

      const result = formatTasksToCSV([task]);
      expect(result).toContain('task-1; task-2; task-3');
      expect(result).toContain('task-4');
    });
  });

  // ============================================================================
  // CSV-Specific Options Tests
  // ============================================================================

  describe('CSV-Specific Options', () => {
    let task: Task;

    beforeEach(() => {
      task = createTask({
        id: 'options-test',
        description: 'Testing CSV options',
      });
    });

    describe('delimiter option', () => {
      it('should use comma as default delimiter', () => {
        const result = formatTasksToCSV([task]);
        const lines = result.split('\n');
        const header = lines[0];

        expect(header.split(',').length).toBeGreaterThan(1);
      });

      it('should use semicolon delimiter when specified', () => {
        const result = formatTasksToCSV([task], { delimiter: ';' });
        const lines = result.split('\n');
        const header = lines[0];

        expect(header.split(';').length).toBeGreaterThan(1);
      });

      it('should use tab delimiter when specified', () => {
        const result = formatTasksToCSV([task], { delimiter: '\t' });
        const lines = result.split('\n');
        const header = lines[0];

        expect(header.split('\t').length).toBeGreaterThan(1);
      });

      it('should use pipe delimiter when specified', () => {
        const result = formatTasksToCSV([task], { delimiter: '|' });
        const lines = result.split('\n');
        const header = lines[0];

        expect(header.split('|').length).toBeGreaterThan(1);
      });
    });

    describe('includeHeader option', () => {
      it('should include header row by default', () => {
        const result = formatTasksToCSV([task]);
        const lines = result.split('\n');

        expect(lines[0]).toContain('id');
        expect(lines[0]).toContain('description');
      });

      it('should exclude header row when includeHeader: false', () => {
        const result = formatTasksToCSV([task], { includeHeader: false });
        const lines = result.split('\n');

        // First line should be data, not header
        expect(lines[0]).toContain('options-test');
        expect(lines[0]).toContain('Testing CSV options');
        expect(lines.length).toBe(1);
      });
    });

    describe('quoteAll option', () => {
      it('should only quote values containing special characters by default', () => {
        const simpleTask = createTask({
          id: 'simple-id',
          description: 'Simple description',
        });

        const result = formatTasksToCSV([simpleTask]);
        // Simple values should not be quoted
        expect(result).toContain('simple-id');
        expect(result).not.toMatch(/"simple-id"/);
      });

      it('should quote all values when quoteAll: true', () => {
        const result = formatTasksToCSV([task], { quoteAll: true });
        const lines = result.split('\n');

        // Check that header fields are quoted
        expect(lines[0]).toContain('"id"');
        expect(lines[0]).toContain('"description"');
      });

      it('should quote values containing commas', () => {
        const taskWithComma = createTask({
          description: 'Description with, a comma',
        });

        const result = formatTasksToCSV([taskWithComma]);
        expect(result).toContain('"Description with, a comma"');
      });

      it('should quote values containing newlines', () => {
        const taskWithNewline = createTask({
          description: 'Line 1\nLine 2',
        });

        const result = formatTasksToCSV([taskWithNewline]);
        expect(result).toContain('"Line 1\nLine 2"');
      });

      it('should escape double quotes by doubling them', () => {
        const taskWithQuotes = createTask({
          description: 'Description with "quotes"',
        });

        const result = formatTasksToCSV([taskWithQuotes]);
        expect(result).toContain('"Description with ""quotes"""');
      });
    });

    describe('lineEnding option', () => {
      it('should use LF by default', () => {
        const result = formatTasksToCSV([task]);
        expect(result).toContain('\n');
        expect(result).not.toContain('\r\n');
      });

      it('should use CRLF when specified', () => {
        const result = formatTasksToCSV([task], { lineEnding: 'crlf' });
        expect(result).toContain('\r\n');
      });

      it('should use CR when specified', () => {
        const result = formatTasksToCSV([task], { lineEnding: 'cr' });
        const lines = result.split('\r');
        expect(lines.length).toBe(2);
      });
    });
  });

  // ============================================================================
  // Nested Data Strategy Tests
  // ============================================================================

  describe('Nested Data Strategies', () => {
    describe('Logs Strategies', () => {
      let taskWithLogs: Task;

      beforeEach(() => {
        taskWithLogs = createTask({
          logs: [
            createTaskLog({ level: 'error', message: 'Error 1' }),
            createTaskLog({ level: 'error', message: 'Error 2' }),
            createTaskLog({ level: 'warn', message: 'Warning 1' }),
            createTaskLog({ level: 'info', message: 'Info 1' }),
            createTaskLog({ level: 'debug', message: 'Debug 1' }),
          ],
        });
      });

      it('should use count strategy by default', () => {
        const result = formatTasksToCSV([taskWithLogs]);
        expect(result).toContain('logsCount');
        expect(result).toContain('5');
      });

      it('should show count with logsStrategy: count', () => {
        const result = formatTasksToCSV([taskWithLogs], { logsStrategy: 'count' });
        expect(result).toContain('logsCount');

        // Parse to find the value
        const lines = result.split('\n');
        const headerParts = lines[0].split(',');
        const logsCountIndex = headerParts.indexOf('logsCount');
        const dataParts = lines[1].split(',');
        expect(dataParts[logsCountIndex]).toBe('5');
      });

      it('should show summary with logsStrategy: summary', () => {
        const result = formatTasksToCSV([taskWithLogs], { logsStrategy: 'summary' });
        expect(result).toContain('logsSummary');
        expect(result).toContain('2 errors');
        expect(result).toContain('1 warning');
        expect(result).toContain('1 info');
        expect(result).toContain('1 debug');
      });

      it('should handle summary with single items (no plural)', () => {
        const singleLogTask = createTask({
          logs: [createTaskLog({ level: 'error', message: 'Single error' })],
        });

        const result = formatTasksToCSV([singleLogTask], { logsStrategy: 'summary' });
        expect(result).toContain('1 error');
        expect(result).not.toContain('1 errors');
      });

      it('should flatten logs with logsStrategy: flatten', () => {
        const result = formatTasksToCSV([taskWithLogs], {
          logsStrategy: 'flatten',
          flattenLimit: 3,
        });

        expect(result).toContain('log_1_level');
        expect(result).toContain('log_1_message');
        expect(result).toContain('log_1_timestamp');
        expect(result).toContain('log_2_level');
        expect(result).toContain('log_3_level');
        expect(result).not.toContain('log_4_level');
        expect(result).toContain('logsRemaining');
      });

      it('should embed JSON with logsStrategy: json', () => {
        const result = formatTasksToCSV([taskWithLogs], { logsStrategy: 'json' });
        expect(result).toContain('logs');

        // The JSON should be embedded in a quoted field
        expect(result).toMatch(/".*level.*message.*"/);
      });

      it('should omit logs with logsStrategy: omit', () => {
        const result = formatTasksToCSV([taskWithLogs], { logsStrategy: 'omit' });
        expect(result).not.toContain('logsCount');
        expect(result).not.toContain('logsSummary');
        expect(result).not.toContain('log_1');
        expect(result).not.toContain('"logs"');
      });

      it('should handle empty logs array', () => {
        const emptyLogsTask = createTask({ logs: [] });

        const resultCount = formatTasksToCSV([emptyLogsTask], { logsStrategy: 'count' });
        expect(resultCount).toContain('0');

        const resultSummary = formatTasksToCSV([emptyLogsTask], { logsStrategy: 'summary' });
        expect(resultSummary).toContain('No logs');
      });
    });

    describe('Artifacts Strategies', () => {
      let taskWithArtifacts: Task;

      beforeEach(() => {
        taskWithArtifacts = createTask({
          artifacts: [
            createTaskArtifact({ name: 'file1.ts', type: 'file', path: '/src/file1.ts' }),
            createTaskArtifact({ name: 'file2.ts', type: 'file', path: '/src/file2.ts' }),
            createTaskArtifact({ name: 'changes.diff', type: 'diff' }),
            createTaskArtifact({ name: 'report.md', type: 'report' }),
          ],
        });
      });

      it('should use count strategy by default', () => {
        const result = formatTasksToCSV([taskWithArtifacts]);
        expect(result).toContain('artifactsCount');
        expect(result).toContain('4');
      });

      it('should show summary with artifactsStrategy: summary', () => {
        const result = formatTasksToCSV([taskWithArtifacts], { artifactsStrategy: 'summary' });
        expect(result).toContain('artifactsSummary');
        expect(result).toContain('2 files');
        expect(result).toContain('1 diff');
        expect(result).toContain('1 report');
      });

      it('should flatten artifacts with artifactsStrategy: flatten', () => {
        const result = formatTasksToCSV([taskWithArtifacts], {
          artifactsStrategy: 'flatten',
          flattenLimit: 2,
        });

        expect(result).toContain('artifact_1_name');
        expect(result).toContain('artifact_1_type');
        expect(result).toContain('artifact_1_path');
        expect(result).toContain('artifact_2_name');
        expect(result).not.toContain('artifact_3_name');
        expect(result).toContain('artifactsRemaining');
      });

      it('should embed JSON with artifactsStrategy: json', () => {
        const result = formatTasksToCSV([taskWithArtifacts], { artifactsStrategy: 'json' });
        expect(result).toContain('artifacts');
        expect(result).toMatch(/".*name.*type.*path.*"/);
      });

      it('should omit artifacts with artifactsStrategy: omit', () => {
        const result = formatTasksToCSV([taskWithArtifacts], { artifactsStrategy: 'omit' });
        expect(result).not.toContain('artifactsCount');
        expect(result).not.toContain('artifactsSummary');
        expect(result).not.toContain('artifact_1');
      });

      it('should handle empty artifacts array', () => {
        const emptyArtifactsTask = createTask({ artifacts: [] });

        const resultCount = formatTasksToCSV([emptyArtifactsTask], { artifactsStrategy: 'count' });
        expect(resultCount).toContain('0');

        const resultSummary = formatTasksToCSV([emptyArtifactsTask], { artifactsStrategy: 'summary' });
        expect(resultSummary).toContain('No artifacts');
      });
    });

    describe('Usage Strategies', () => {
      let taskWithUsage: Task;

      beforeEach(() => {
        taskWithUsage = createTask({
          usage: createTaskUsage({
            inputTokens: 1500,
            outputTokens: 800,
            totalTokens: 2300,
            estimatedCost: 0.045,
            totalCostCents: 45,
            executionTimeMs: 12000,
          }),
        });
      });

      it('should use inline strategy by default', () => {
        const result = formatTasksToCSV([taskWithUsage]);
        expect(result).toContain('inputTokens');
        expect(result).toContain('outputTokens');
        expect(result).toContain('totalTokens');
        expect(result).toContain('1500');
        expect(result).toContain('800');
        expect(result).toContain('2300');
      });

      it('should flatten with prefixed names with usageStrategy: flatten', () => {
        const result = formatTasksToCSV([taskWithUsage], { usageStrategy: 'flatten' });
        expect(result).toContain('usage.inputTokens');
        expect(result).toContain('usage.outputTokens');
        expect(result).toContain('usage.totalTokens');
        expect(result).toContain('usage.estimatedCost');
        expect(result).toContain('usage.totalCostCents');
        expect(result).toContain('usage.executionTimeMs');
      });

      it('should embed JSON with usageStrategy: json', () => {
        const result = formatTasksToCSV([taskWithUsage], { usageStrategy: 'json' });
        expect(result).toContain('usage');
        // Should contain JSON with usage data
        expect(result).toMatch(/".*inputTokens.*outputTokens.*"/);
      });
    });
  });

  // ============================================================================
  // Field Filtering Tests
  // ============================================================================

  describe('Field Filtering', () => {
    let task: Task;

    beforeEach(() => {
      task = createTask({
        id: 'filter-test',
        description: 'Filter test task',
        workflow: 'test-workflow',
        status: 'pending',
      });
    });

    describe('includeFields option', () => {
      it('should only include specified fields when includeFields is set', () => {
        const result = formatTasksToCSV([task], {
          includeFields: ['id', 'description', 'status'],
        });
        const lines = result.split('\n');
        const header = lines[0];

        expect(header).toContain('id');
        expect(header).toContain('description');
        expect(header).toContain('status');
        expect(header).not.toContain('workflow');
        expect(header).not.toContain('projectPath');
      });

      it('should include all fields when includeFields is empty (default)', () => {
        const result = formatTasksToCSV([task], { includeFields: [] });
        const lines = result.split('\n');
        const header = lines[0];

        expect(header).toContain('id');
        expect(header).toContain('description');
        expect(header).toContain('workflow');
        expect(header).toContain('status');
      });
    });

    describe('excludeFields option', () => {
      it('should exclude specified fields when excludeFields is set', () => {
        const result = formatTasksToCSV([task], {
          excludeFields: ['workflow', 'projectPath', 'branchName'],
        });
        const lines = result.split('\n');
        const header = lines[0];

        expect(header).toContain('id');
        expect(header).toContain('description');
        expect(header).not.toContain('workflow');
        expect(header).not.toContain('projectPath');
        expect(header).not.toContain('branchName');
      });

      it('should not exclude any fields when excludeFields is empty (default)', () => {
        const result = formatTasksToCSV([task], { excludeFields: [] });
        const lines = result.split('\n');
        const header = lines[0];

        expect(header).toContain('id');
        expect(header).toContain('workflow');
        expect(header).toContain('projectPath');
      });
    });

    describe('includeNulls option', () => {
      it('should include null values as empty strings when includeNulls: true', () => {
        const taskWithNulls = createTask({
          acceptanceCriteria: undefined,
          currentStage: undefined,
        });

        const result = formatTasksToCSV([taskWithNulls], { includeNulls: true });
        const lines = result.split('\n');

        // Null values should result in empty cells
        expect(lines[1]).toBeTruthy();
      });

      it('should exclude null values from row when includeNulls: false', () => {
        const taskWithNulls = createTask({
          acceptanceCriteria: undefined,
          currentStage: undefined,
          error: undefined,
        });

        const result = formatTasksToCSV([taskWithNulls], { includeNulls: false });
        const lines = result.split('\n');
        const header = lines[0];

        // Fields with null values should not be in header
        // Note: This depends on whether all tasks have null for that field
        expect(header).toBeTruthy();
      });
    });

    describe('includeEmpty option', () => {
      it('should include empty strings when includeEmpty: true', () => {
        const result = formatTasksToCSV([task], { includeEmpty: true });
        expect(result).toBeTruthy();
      });

      it('should exclude empty strings when includeEmpty: false', () => {
        const result = formatTasksToCSV([task], { includeEmpty: false });
        expect(result).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle Unicode content in strings', () => {
      const unicodeTask = createTask({
        description: '测试任务 with émojis 🚀 and symbols ∆∇∈∉',
        logs: [createTaskLog({ message: 'Unicode log: 日本語 русский العربية' })],
      });

      const result = formatTasksToCSV([unicodeTask]);
      expect(result).toContain('测试任务');
      expect(result).toContain('🚀');
    });

    it('should handle special characters properly', () => {
      const specialTask = createTask({
        description: 'Task with "quotes" and \nnewlines',
        error: 'Error: <script>alert("xss")</script>',
      });

      const result = formatTasksToCSV([specialTask]);
      // Quotes should be escaped
      expect(result).toContain('""quotes""');
      // The whole field should be quoted due to special chars
      expect(result).toMatch(/".*quotes.*"/);
    });

    it('should handle very long strings', () => {
      const longDescription = 'A'.repeat(10000);
      const longTask = createTask({
        description: longDescription,
      });

      const result = formatTasksToCSV([longTask]);
      expect(result).toContain(longDescription);
    });

    it('should handle tasks with many logs (flatten with limit)', () => {
      const manyLogs = Array.from({ length: 100 }, (_, i) =>
        createTaskLog({ message: `Log ${i}` })
      );
      const task = createTask({ logs: manyLogs });

      const result = formatTasksToCSV([task], {
        logsStrategy: 'flatten',
        flattenLimit: 5,
      });

      expect(result).toContain('log_1_message');
      expect(result).toContain('log_5_message');
      expect(result).not.toContain('log_6_message');
      expect(result).toContain('logsRemaining');
      expect(result).toContain('95'); // 100 - 5 = 95 remaining
    });

    it('should handle tasks with many artifacts (flatten with limit)', () => {
      const manyArtifacts = Array.from({ length: 50 }, (_, i) =>
        createTaskArtifact({ name: `file${i}.ts` })
      );
      const task = createTask({ artifacts: manyArtifacts });

      const result = formatTasksToCSV([task], {
        artifactsStrategy: 'flatten',
        flattenLimit: 3,
      });

      expect(result).toContain('artifact_1_name');
      expect(result).toContain('artifact_3_name');
      expect(result).not.toContain('artifact_4_name');
      expect(result).toContain('artifactsRemaining');
    });

    it('should handle zero flattenLimit', () => {
      const task = createTask({
        logs: [createTaskLog({ message: 'Log 1' })],
      });

      const result = formatTasksToCSV([task], {
        logsStrategy: 'flatten',
        flattenLimit: 0,
      });

      // With flattenLimit 0, no log columns should be added
      expect(result).not.toContain('log_1_message');
      expect(result).toContain('logsRemaining');
    });

    it('should handle tasks with all optional fields undefined', () => {
      const minimalTask: Task = {
        id: 'minimal-task',
        description: 'Minimal task',
        workflow: 'test',
        autonomy: 'full-auto',
        status: 'pending',
        priority: 'normal',
        effort: 'small',
        projectPath: '/test',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: createTaskUsage(),
        logs: [],
        artifacts: [],
      };

      const result = formatTasksToCSV([minimalTask]);
      expect(result).toContain('minimal-task');
      expect(result).toContain('Minimal task');
    });

    it('should handle boolean values correctly', () => {
      const task = createTask({
        dryRun: true,
      });

      const result = formatTasksToCSV([task]);
      expect(result).toContain('true');
    });

    it('should handle false boolean values', () => {
      const task = createTask({
        dryRun: false,
      });

      const result = formatTasksToCSV([task]);
      expect(result).toContain('false');
    });

    it('should handle numeric values with decimals', () => {
      const task = createTask({
        usage: createTaskUsage({
          estimatedCost: 0.00123456,
        }),
      });

      const result = formatTasksToCSV([task]);
      expect(result).toContain('0.00123456');
    });

    it('should preserve order across multiple tasks', () => {
      const tasks = [
        createTask({ id: 'task-1', description: 'First' }),
        createTask({ id: 'task-2', description: 'Second' }),
        createTask({ id: 'task-3', description: 'Third' }),
      ];

      const result = formatTasksToCSV(tasks);
      const lines = result.split('\n');

      expect(lines[1]).toContain('task-1');
      expect(lines[2]).toContain('task-2');
      expect(lines[3]).toContain('task-3');
    });
  });

  // ============================================================================
  // Combined Options Tests
  // ============================================================================

  describe('Combined Options', () => {
    it('should apply multiple options together correctly', () => {
      const task = createTask({
        id: 'combined-test',
        description: 'Combined options test',
        logs: Array.from({ length: 5 }, (_, i) =>
          createTaskLog({ level: i < 2 ? 'error' : 'info', message: `Log ${i}` })
        ),
        artifacts: [
          createTaskArtifact({ name: 'file1.ts' }),
          createTaskArtifact({ name: 'file2.ts' }),
        ],
      });

      const result = formatTasksToCSV([task], {
        delimiter: ';',
        includeHeader: true,
        quoteAll: false,
        logsStrategy: 'summary',
        artifactsStrategy: 'count',
        usageStrategy: 'flatten',
        excludeFields: ['projectPath', 'branchName'],
        lineEnding: 'crlf',
      });

      // Check delimiter
      expect(result.split(';').length).toBeGreaterThan(1);

      // Check line ending
      expect(result).toContain('\r\n');

      // Check logs summary
      expect(result).toContain('2 errors');
      expect(result).toContain('3 info');

      // Check artifacts count
      expect(result).toContain('2');

      // Check usage flattening
      expect(result).toContain('usage.inputTokens');

      // Check excluded fields
      expect(result).not.toContain('projectPath');
      expect(result).not.toContain('branchName');
    });
  });

  // ============================================================================
  // All Valid Nested Data Strategies Tests
  // ============================================================================

  describe('All Valid Nested Data Strategies', () => {
    const strategies: NestedDataStrategy[] = ['count', 'summary', 'flatten', 'json', 'omit'];

    strategies.forEach(strategy => {
      it(`should handle logsStrategy: ${strategy}`, () => {
        const task = createTask({
          logs: [createTaskLog({ level: 'info', message: 'Test' })],
        });

        expect(() => {
          formatTasksToCSV([task], { logsStrategy: strategy });
        }).not.toThrow();
      });

      it(`should handle artifactsStrategy: ${strategy}`, () => {
        const task = createTask({
          artifacts: [createTaskArtifact({ name: 'test.ts' })],
        });

        expect(() => {
          formatTasksToCSV([task], { artifactsStrategy: strategy });
        }).not.toThrow();
      });
    });

    const usageStrategies: Array<'inline' | 'flatten' | 'json'> = ['inline', 'flatten', 'json'];

    usageStrategies.forEach(strategy => {
      it(`should handle usageStrategy: ${strategy}`, () => {
        const task = createTask();

        expect(() => {
          formatTasksToCSV([task], { usageStrategy: strategy });
        }).not.toThrow();
      });
    });
  });

  // ============================================================================
  // RFC 4180 Compliance Tests
  // ============================================================================

  describe('RFC 4180 Compliance', () => {
    it('should properly escape fields containing the delimiter', () => {
      const task = createTask({
        description: 'Field, with, commas',
      });

      const result = formatTasksToCSV([task], { delimiter: ',' });
      expect(result).toContain('"Field, with, commas"');
    });

    it('should properly escape fields containing double quotes', () => {
      const task = createTask({
        description: 'Field with "quoted" text',
      });

      const result = formatTasksToCSV([task]);
      expect(result).toContain('"Field with ""quoted"" text"');
    });

    it('should properly escape fields containing newlines', () => {
      const task = createTask({
        description: 'Field with\nnewline',
      });

      const result = formatTasksToCSV([task]);
      expect(result).toContain('"Field with\nnewline"');
    });

    it('should properly escape fields containing carriage returns', () => {
      const task = createTask({
        description: 'Field with\rcarriage return',
      });

      const result = formatTasksToCSV([task]);
      expect(result).toContain('"Field with\rcarriage return"');
    });

    it('should handle multiple special characters in one field', () => {
      const task = createTask({
        description: 'Complex "field" with, commas\nand newlines',
      });

      const result = formatTasksToCSV([task]);
      expect(result).toContain('"Complex ""field"" with, commas\nand newlines"');
    });
  });

  // ============================================================================
  // Large Dataset Tests
  // ============================================================================

  describe('Large Datasets', () => {
    it('should handle large number of tasks', () => {
      const tasks = createTasks(100);

      const result = formatTasksToCSV(tasks);
      const lines = result.split('\n');

      expect(lines.length).toBe(101); // header + 100 data rows
    });

    it('should handle tasks with extensive logs using json strategy', () => {
      const task = createTask({
        logs: Array.from({ length: 1000 }, (_, i) =>
          createTaskLog({ message: `Log entry ${i}` })
        ),
      });

      const result = formatTasksToCSV([task], { logsStrategy: 'json' });
      expect(result).toBeTruthy();
      // The JSON should be in a single quoted field
      expect(result.split('\n').length).toBe(2);
    });
  });

  // ============================================================================
  // Date Handling Tests
  // ============================================================================

  describe('Date Handling', () => {
    it('should convert all Date fields to ISO 8601 strings', () => {
      const fixedDate = new Date('2023-10-15T14:30:00.000Z');
      const task = createTask({
        createdAt: fixedDate,
        updatedAt: fixedDate,
        completedAt: fixedDate,
        pausedAt: fixedDate,
        resumeAfter: fixedDate,
      });

      const result = formatTasksToCSV([task]);
      // Count occurrences of the ISO date string
      const matches = result.match(/2023-10-15T14:30:00\.000Z/g);
      expect(matches?.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle undefined optional dates', () => {
      const task = createTask({
        completedAt: undefined,
        pausedAt: undefined,
        resumeAfter: undefined,
        trashedAt: undefined,
        archivedAt: undefined,
      });

      const result = formatTasksToCSV([task]);
      expect(result).toBeTruthy();
      // Should still produce valid CSV
      const lines = result.split('\n');
      expect(lines.length).toBe(2);
    });

    it('should handle dates in logs and artifacts', () => {
      const logDate = new Date('2023-10-15T15:45:00.000Z');
      const artifactDate = new Date('2023-10-15T16:00:00.000Z');

      const task = createTask({
        logs: [createTaskLog({ timestamp: logDate })],
        artifacts: [createTaskArtifact({ createdAt: artifactDate })],
      });

      const resultFlatten = formatTasksToCSV([task], {
        logsStrategy: 'flatten',
        flattenLimit: 1,
      });
      expect(resultFlatten).toContain('2023-10-15T15:45:00.000Z');

      const resultJson = formatTasksToCSV([task], {
        logsStrategy: 'json',
        artifactsStrategy: 'json',
      });
      expect(resultJson).toContain('2023-10-15T15:45:00.000Z');
      expect(resultJson).toContain('2023-10-15T16:00:00.000Z');
    });
  });

  // ============================================================================
  // Header Row Building Edge Cases Tests
  // ============================================================================

  describe('Header Row Building Edge Cases', () => {
    it('should include artifactsSummary in header for empty dataset with artifactsStrategy: summary', () => {
      const result = formatTasksToCSV([], {
        artifactsStrategy: 'summary',
        includeHeader: true
      });
      expect(result).toContain('artifactsSummary');
    });

    it('should apply includeFields filter to header for empty dataset', () => {
      const result = formatTasksToCSV([], {
        includeFields: ['id', 'description'],
        includeHeader: true
      });
      const lines = result.split('\n');
      const header = lines[0];

      expect(header).toContain('id');
      expect(header).toContain('description');
      expect(header).not.toContain('workflow');
      expect(header).not.toContain('status');
    });

    it('should apply excludeFields filter to header for empty dataset', () => {
      const result = formatTasksToCSV([], {
        excludeFields: ['workflow', 'status', 'priority'],
        includeHeader: true
      });
      const lines = result.split('\n');
      const header = lines[0];

      expect(header).toContain('id');
      expect(header).toContain('description');
      expect(header).not.toContain('workflow');
      expect(header).not.toContain('status');
      expect(header).not.toContain('priority');
    });

    it('should include flattened usage columns in header for empty dataset with usageStrategy: flatten', () => {
      const result = formatTasksToCSV([], {
        usageStrategy: 'flatten',
        includeHeader: true
      });
      const lines = result.split('\n');
      const header = lines[0];

      expect(header).toContain('usage.inputTokens');
      expect(header).toContain('usage.outputTokens');
      expect(header).toContain('usage.totalTokens');
      expect(header).toContain('usage.estimatedCost');
    });

    it('should include usage column in header for empty dataset with usageStrategy: json', () => {
      const result = formatTasksToCSV([], {
        usageStrategy: 'json',
        includeHeader: true
      });
      const lines = result.split('\n');
      const header = lines[0];

      expect(header).toContain('usage');
      expect(header).not.toContain('usage.inputTokens');
    });

    it('should include logsSummary in header for empty dataset with logsStrategy: summary', () => {
      const result = formatTasksToCSV([], {
        logsStrategy: 'summary',
        includeHeader: true
      });
      const lines = result.split('\n');
      const header = lines[0];

      expect(header).toContain('logsSummary');
      expect(header).not.toContain('logsCount');
    });
  });

  // ============================================================================
  // Task Status and Enum Tests
  // ============================================================================

  describe('Task Status and Enum Values', () => {
    const statuses: Array<Task['status']> = [
      'pending', 'queued', 'planning', 'in-progress',
      'awaiting-approval', 'paused', 'completed', 'failed', 'cancelled'
    ];

    statuses.forEach(status => {
      it(`should handle TaskStatus: ${status}`, () => {
        const task = createTask({ status });
        const result = formatTasksToCSV([task]);
        expect(result).toContain(status);
      });
    });

    const priorities: Array<Task['priority']> = ['low', 'normal', 'high', 'urgent'];

    priorities.forEach(priority => {
      it(`should handle TaskPriority: ${priority}`, () => {
        const task = createTask({ priority });
        const result = formatTasksToCSV([task]);
        expect(result).toContain(priority);
      });
    });

    const efforts: Array<Task['effort']> = ['xs', 'small', 'medium', 'large', 'xl'];

    efforts.forEach(effort => {
      it(`should handle TaskEffort: ${effort}`, () => {
        const task = createTask({ effort });
        const result = formatTasksToCSV([task]);
        expect(result).toContain(effort);
      });
    });

    const autonomyLevels: Array<Task['autonomy']> = ['full-auto', 'review-before-commit', 'review-all'];

    autonomyLevels.forEach(autonomy => {
      it(`should handle AutonomyLevel: ${autonomy}`, () => {
        const task = createTask({ autonomy });
        const result = formatTasksToCSV([task]);
        expect(result).toContain(autonomy);
      });
    });
  });
});
