/**
 * @fileoverview Comprehensive unit tests for JSON Task Export Formatter
 *
 * Tests cover all functionality defined in ADR-019 including:
 * - Input validation
 * - Basic functionality
 * - All export options
 * - Task data transformation
 * - Date handling
 * - Edge cases
 * - Error scenarios
 *
 * Target: 100% test coverage of formatTasksToJSON function and all helpers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { formatTasksToJSON } from '../json-formatter.js';
import type { Task, TaskLog, TaskArtifact, PartialExportOptions } from '../../types.js';
import {
  createTask,
  createTaskLog,
  createTaskArtifact,
  createTaskUsage,
  createTasks,
} from '../../factories/task-factory.js';

describe('formatTasksToJSON', () => {
  // ============================================================================
  // Input Validation Tests
  // ============================================================================

  describe('Input Validation', () => {
    it('should throw TypeError when tasks is null', () => {
      expect(() => {
        formatTasksToJSON(null as any);
      }).toThrow(TypeError);
      expect(() => {
        formatTasksToJSON(null as any);
      }).toThrow('Tasks parameter cannot be null or undefined');
    });

    it('should throw TypeError when tasks is undefined', () => {
      expect(() => {
        formatTasksToJSON(undefined as any);
      }).toThrow(TypeError);
      expect(() => {
        formatTasksToJSON(undefined as any);
      }).toThrow('Tasks parameter cannot be null or undefined');
    });

    it('should throw TypeError when tasks is not an array', () => {
      expect(() => {
        formatTasksToJSON('not-an-array' as any);
      }).toThrow(TypeError);
      expect(() => {
        formatTasksToJSON('not-an-array' as any);
      }).toThrow('Tasks parameter must be an array');

      expect(() => {
        formatTasksToJSON({ id: 'task-1' } as any);
      }).toThrow(TypeError);

      expect(() => {
        formatTasksToJSON(123 as any);
      }).toThrow(TypeError);
    });

    it('should handle empty array without error', () => {
      const result = formatTasksToJSON([]);
      expect(result).toBe('[]');
    });

    it('should throw error for invalid options via Zod validation', () => {
      const task = createTask();

      expect(() => {
        formatTasksToJSON([task], { format: 'invalid' as any });
      }).toThrow();

      expect(() => {
        formatTasksToJSON([task], { maxDepth: -1 });
      }).toThrow();

      expect(() => {
        formatTasksToJSON([task], { maxItems: -1 });
      }).toThrow();
    });
  });

  // ============================================================================
  // Basic Functionality Tests
  // ============================================================================

  describe('Basic Functionality', () => {
    it('should export a single task with default options', () => {
      const task = createTask({
        id: 'test-task-1',
        description: 'Test task for export',
        status: 'completed',
      });

      const result = formatTasksToJSON([task]);
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('test-task-1');
      expect(parsed[0].description).toBe('Test task for export');
      expect(parsed[0].status).toBe('completed');
    });

    it('should export multiple tasks', () => {
      const tasks = createTasks(3, { description: 'Multi-task test' });

      const result = formatTasksToJSON(tasks);
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].description).toContain('Multi-task test');
      expect(parsed[1].description).toContain('Multi-task test');
      expect(parsed[2].description).toContain('Multi-task test');
    });

    it('should include all required task fields', () => {
      const task = createTask({
        id: 'field-test',
        description: 'Field test task',
        acceptanceCriteria: 'All fields should be present',
        workflow: 'test-workflow',
        autonomy: 'full-auto',
        status: 'in-progress',
        priority: 'high',
        effort: 'large',
        currentStage: 'implementation',
        projectPath: '/test/project',
        branchName: 'feature/test',
        prUrl: 'https://github.com/test/test/pull/123',
        retryCount: 2,
        maxRetries: 5,
        resumeAttempts: 1,
        dependsOn: ['task-1', 'task-2'],
        blockedBy: ['task-3'],
        parentTaskId: 'parent-task',
        subtaskIds: ['subtask-1', 'subtask-2'],
        subtaskStrategy: 'parallel',
        dryRun: true,
        pauseReason: 'rate_limit',
        error: 'Test error message',
      });

      const result = formatTasksToJSON([task]);
      const parsed = JSON.parse(result);
      const exportedTask = parsed[0];

      // Verify all core fields
      expect(exportedTask.id).toBe('field-test');
      expect(exportedTask.description).toBe('Field test task');
      expect(exportedTask.acceptanceCriteria).toBe('All fields should be present');
      expect(exportedTask.workflow).toBe('test-workflow');
      expect(exportedTask.autonomy).toBe('full-auto');
      expect(exportedTask.status).toBe('in-progress');
      expect(exportedTask.priority).toBe('high');
      expect(exportedTask.effort).toBe('large');
      expect(exportedTask.currentStage).toBe('implementation');
      expect(exportedTask.projectPath).toBe('/test/project');
      expect(exportedTask.branchName).toBe('feature/test');
      expect(exportedTask.prUrl).toBe('https://github.com/test/test/pull/123');
      expect(exportedTask.retryCount).toBe(2);
      expect(exportedTask.maxRetries).toBe(5);
      expect(exportedTask.resumeAttempts).toBe(1);
      expect(exportedTask.dependsOn).toEqual(['task-1', 'task-2']);
      expect(exportedTask.blockedBy).toEqual(['task-3']);
      expect(exportedTask.parentTaskId).toBe('parent-task');
      expect(exportedTask.subtaskIds).toEqual(['subtask-1', 'subtask-2']);
      expect(exportedTask.subtaskStrategy).toBe('parallel');
      expect(exportedTask.dryRun).toBe(true);
      expect(exportedTask.pauseReason).toBe('rate_limit');
      expect(exportedTask.error).toBe('Test error message');

      // Verify timestamps are ISO strings
      expect(exportedTask.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(exportedTask.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verify usage object structure
      expect(exportedTask.usage).toMatchObject({
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        totalTokens: expect.any(Number),
        estimatedCost: expect.any(Number),
        totalCostCents: expect.any(Number),
        executionTimeMs: expect.any(Number),
      });

      // Verify logs and artifacts arrays exist
      expect(Array.isArray(exportedTask.logs)).toBe(true);
      expect(Array.isArray(exportedTask.artifacts)).toBe(true);
    });

    it('should handle tasks with default factory values', () => {
      const task = createTask(); // Use all factory defaults

      const result = formatTasksToJSON([task]);
      const parsed = JSON.parse(result);

      expect(parsed[0]).toMatchObject({
        workflow: 'feature-development',
        autonomy: 'review-before-commit',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        currentStage: 'planning',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
      });
    });
  });

  // ============================================================================
  // Export Options Tests
  // ============================================================================

  describe('Options Handling', () => {
    let task: Task;

    beforeEach(() => {
      task = createTask({
        id: 'options-test',
        description: 'Testing export options',
      });
    });

    describe('pretty option', () => {
      it('should format with pretty printing when pretty: true', () => {
        const result = formatTasksToJSON([task], { pretty: true });

        // Should contain newlines and indentation
        expect(result).toContain('\n');
        expect(result).toMatch(/^\[\s*\{/);
      });

      it('should format as compact JSON when pretty: false', () => {
        const result = formatTasksToJSON([task], { pretty: false });

        // Should not contain unnecessary whitespace
        expect(result).not.toContain('\n');
        expect(result).not.toMatch(/\s{2,}/);
        expect(result.startsWith('[{')).toBe(true);
      });

      it('should default to pretty: true', () => {
        const result = formatTasksToJSON([task]);

        // Default should be pretty
        expect(result).toContain('\n');
      });
    });

    describe('indent option', () => {
      it('should use specified number of spaces for indentation', () => {
        const result = formatTasksToJSON([task], { pretty: true, indent: 4 });

        const lines = result.split('\n');
        // Look for any line with 4-space indentation
        const indentedLine = lines.find(line => line.match(/^    \S/)); // 4 spaces followed by non-whitespace
        expect(indentedLine).toBeTruthy();
      });

      it('should use string indent when provided', () => {
        const result = formatTasksToJSON([task], { pretty: true, indent: '\t' });

        const lines = result.split('\n');
        const tabIndentedLine = lines.find(line => line.startsWith('\t'));
        expect(tabIndentedLine).toBeTruthy();
      });

      it('should default to 2 spaces', () => {
        const result = formatTasksToJSON([task], { pretty: true });

        const lines = result.split('\n');
        // Look for any line with 2-space indentation
        const twoSpaceIndent = lines.find(line => line.match(/^  \S/)); // 2 spaces followed by non-whitespace
        expect(twoSpaceIndent).toBeTruthy();
      });
    });

    describe('includeMetadata option', () => {
      it('should wrap tasks in metadata document when includeMetadata: true', () => {
        const result = formatTasksToJSON([task], { includeMetadata: true });
        const parsed = JSON.parse(result);

        expect(parsed).toMatchObject({
          metadata: {
            exportedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
            version: '1.0.0',
            taskCount: 1,
            format: 'json',
          },
          tasks: expect.arrayContaining([
            expect.objectContaining({
              id: 'options-test',
            }),
          ]),
        });
      });

      it('should return tasks array directly when includeMetadata: false', () => {
        const result = formatTasksToJSON([task], { includeMetadata: false });
        const parsed = JSON.parse(result);

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed[0].id).toBe('options-test');
        expect(parsed.metadata).toBeUndefined();
      });

      it('should default to includeMetadata: false', () => {
        const result = formatTasksToJSON([task]);
        const parsed = JSON.parse(result);

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.metadata).toBeUndefined();
      });
    });

    describe('maxItems option', () => {
      it('should limit logs array when maxItems is specified', () => {
        const logsTask = createTask({
          logs: [
            createTaskLog({ message: 'Log 1' }),
            createTaskLog({ message: 'Log 2' }),
            createTaskLog({ message: 'Log 3' }),
            createTaskLog({ message: 'Log 4' }),
            createTaskLog({ message: 'Log 5' }),
          ],
        });

        const result = formatTasksToJSON([logsTask], { maxItems: 3 });
        const parsed = JSON.parse(result);

        expect(parsed[0].logs).toHaveLength(3);
        expect(parsed[0].logs[0].message).toBe('Log 1');
        expect(parsed[0].logs[2].message).toBe('Log 3');
      });

      it('should limit artifacts array when maxItems is specified', () => {
        const artifactsTask = createTask({
          artifacts: [
            createTaskArtifact({ name: 'File 1' }),
            createTaskArtifact({ name: 'File 2' }),
            createTaskArtifact({ name: 'File 3' }),
            createTaskArtifact({ name: 'File 4' }),
          ],
        });

        const result = formatTasksToJSON([artifactsTask], { maxItems: 2 });
        const parsed = JSON.parse(result);

        expect(parsed[0].artifacts).toHaveLength(2);
        expect(parsed[0].artifacts[0].name).toBe('File 1');
        expect(parsed[0].artifacts[1].name).toBe('File 2');
      });

      it('should not limit arrays when maxItems: 0', () => {
        const manyLogsTask = createTask({
          logs: Array.from({ length: 100 }, (_, i) => createTaskLog({ message: `Log ${i}` })),
        });

        const result = formatTasksToJSON([manyLogsTask], { maxItems: 0 });
        const parsed = JSON.parse(result);

        expect(parsed[0].logs).toHaveLength(100);
      });

      it('should not limit arrays when count is below maxItems', () => {
        const fewLogsTask = createTask({
          logs: [createTaskLog({ message: 'Only log' })],
        });

        const result = formatTasksToJSON([fewLogsTask], { maxItems: 10 });
        const parsed = JSON.parse(result);

        expect(parsed[0].logs).toHaveLength(1);
      });
    });

    describe('includeFields option', () => {
      it('should only include specified fields when includeFields is set', () => {
        const result = formatTasksToJSON([task], {
          includeFields: ['id', 'description', 'status'],
        });
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        // Should only have the specified fields
        expect(Object.keys(exportedTask)).toEqual(['id', 'description', 'status']);
        expect(exportedTask.id).toBe('options-test');
        expect(exportedTask.description).toBe('Testing export options');
        expect(exportedTask.status).toBeTruthy();
      });

      it('should include all fields when includeFields is empty (default)', () => {
        const result = formatTasksToJSON([task], { includeFields: [] });
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        // Should have many fields
        expect(Object.keys(exportedTask).length).toBeGreaterThan(10);
        expect(exportedTask.id).toBe('options-test');
        expect(exportedTask.workflow).toBeTruthy();
        expect(exportedTask.usage).toBeTruthy();
      });
    });

    describe('excludeFields option', () => {
      it('should exclude specified fields when excludeFields is set', () => {
        const result = formatTasksToJSON([task], {
          excludeFields: ['conversation', 'workspace', 'sessionData'],
        });
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        expect(exportedTask.conversation).toBeUndefined();
        expect(exportedTask.workspace).toBeUndefined();
        expect(exportedTask.sessionData).toBeUndefined();

        // Other fields should still be present
        expect(exportedTask.id).toBe('options-test');
        expect(exportedTask.description).toBe('Testing export options');
      });

      it('should not exclude any fields when excludeFields is empty (default)', () => {
        const result = formatTasksToJSON([task], { excludeFields: [] });
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        // Core fields should be present
        expect(exportedTask.id).toBeTruthy();
        expect(exportedTask.description).toBeTruthy();
        expect(exportedTask.workflow).toBeTruthy();
        // Optional fields may be undefined and filtered out by JSON.stringify
        // This is the expected behavior - JSON.stringify automatically removes undefined values
      });
    });

    describe('sortKeys option', () => {
      it('should sort object keys alphabetically when sortKeys: true', () => {
        const result = formatTasksToJSON([task], { sortKeys: true, pretty: true });
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        const keys = Object.keys(exportedTask);
        const sortedKeys = [...keys].sort();
        expect(keys).toEqual(sortedKeys);
      });

      it('should preserve original key order when sortKeys: false', () => {
        const result = formatTasksToJSON([task], { sortKeys: false });
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        const keys = Object.keys(exportedTask);
        // Should start with core identification fields as defined in transform
        expect(keys[0]).toBe('id');
        expect(keys[1]).toBe('description');
      });

      it('should default to sortKeys: false', () => {
        const result = formatTasksToJSON([task]);
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        const keys = Object.keys(exportedTask);
        expect(keys[0]).toBe('id');
      });
    });

    describe('includeNulls option', () => {
      it('should include null/undefined values when includeNulls: true', () => {
        const taskWithNulls = createTask({
          acceptanceCriteria: null, // Use null instead of undefined (JSON.stringify removes undefined)
          currentStage: null,
          error: null,
        });

        const result = formatTasksToJSON([taskWithNulls], { includeNulls: true });
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        // Null values should be preserved
        expect(exportedTask.acceptanceCriteria).toBe(null);
        expect(exportedTask.currentStage).toBe(null);
        expect(exportedTask.error).toBe(null);
      });

      it('should exclude null/undefined values when includeNulls: false', () => {
        const taskWithNulls = createTask({
          acceptanceCriteria: null,
          currentStage: null,
          error: null,
        });

        const result = formatTasksToJSON([taskWithNulls], { includeNulls: false });
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        expect(Object.keys(exportedTask)).not.toContain('acceptanceCriteria');
        expect(Object.keys(exportedTask)).not.toContain('currentStage');
        expect(Object.keys(exportedTask)).not.toContain('error');
      });

      it('should default to includeNulls: true', () => {
        const taskWithNulls = createTask({
          acceptanceCriteria: null, // Use null instead of undefined
        });

        const result = formatTasksToJSON([taskWithNulls]);
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        expect(exportedTask.acceptanceCriteria).toBe(null);
      });
    });

    describe('includeEmpty option', () => {
      it('should include empty arrays/objects/strings when includeEmpty: true', () => {
        const taskWithEmpties = createTask({
          logs: [],
          artifacts: [],
          dependsOn: [],
        });

        const result = formatTasksToJSON([taskWithEmpties], { includeEmpty: true });
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        expect(exportedTask.logs).toEqual([]);
        expect(exportedTask.artifacts).toEqual([]);
        expect(exportedTask.dependsOn).toEqual([]);
      });

      it('should exclude empty arrays/objects/strings when includeEmpty: false', () => {
        const taskWithEmpties = createTask({
          logs: [],
          artifacts: [],
          dependsOn: [],
        });

        const result = formatTasksToJSON([taskWithEmpties], { includeEmpty: false });
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        expect(Object.keys(exportedTask)).not.toContain('dependsOn');
        // Note: logs and artifacts might still be present if they have default empty values
      });

      it('should default to includeEmpty: true', () => {
        const taskWithEmpties = createTask({
          dependsOn: [],
        });

        const result = formatTasksToJSON([taskWithEmpties]);
        const parsed = JSON.parse(result);
        const exportedTask = parsed[0];

        expect(exportedTask.dependsOn).toEqual([]);
      });
    });

    describe('combined options', () => {
      it('should apply multiple options together correctly', () => {
        const complexTask = createTask({
          id: 'complex-test',
          acceptanceCriteria: undefined,
          logs: Array.from({ length: 10 }, (_, i) => createTaskLog({ message: `Log ${i}` })),
          artifacts: [],
        });

        const result = formatTasksToJSON([complexTask], {
          pretty: true,
          indent: 4,
          includeMetadata: true,
          maxItems: 3,
          excludeFields: ['workspace', 'sessionData'],
          sortKeys: true,
          includeNulls: false,
          includeEmpty: false,
        });

        const parsed = JSON.parse(result);

        // Should have metadata wrapper
        expect(parsed.metadata).toBeTruthy();
        expect(parsed.tasks).toHaveLength(1);

        const exportedTask = parsed.tasks[0];

        // Should have limited logs
        expect(exportedTask.logs).toHaveLength(3);

        // Should not have empty artifacts
        expect(Object.keys(exportedTask)).not.toContain('artifacts');

        // Should not have excluded fields
        expect(Object.keys(exportedTask)).not.toContain('workspace');
        expect(Object.keys(exportedTask)).not.toContain('sessionData');

        // Should not have null values
        expect(Object.keys(exportedTask)).not.toContain('acceptanceCriteria');

        // Should have sorted keys
        const keys = Object.keys(exportedTask);
        const sortedKeys = [...keys].sort();
        expect(keys).toEqual(sortedKeys);

        // Should be pretty formatted with 4-space indent
        const resultString = JSON.stringify(parsed, null, 4);
        expect(result).toContain('\n');
        const lines = result.split('\n');
        const indentedLine = lines.find(line => line.match(/^    "/));
        expect(indentedLine).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // Task Data Transformation Tests
  // ============================================================================

  describe('Task Data Transformation', () => {
    describe('TaskStatus values', () => {
      const statuses: Array<Task['status']> = [
        'pending', 'queued', 'planning', 'in-progress',
        'awaiting-approval', 'paused', 'completed', 'failed', 'cancelled'
      ];

      statuses.forEach(status => {
        it(`should handle TaskStatus: ${status}`, () => {
          const task = createTask({ status });
          const result = formatTasksToJSON([task]);
          const parsed = JSON.parse(result);

          expect(parsed[0].status).toBe(status);
        });
      });
    });

    describe('TaskPriority values', () => {
      const priorities: Array<Task['priority']> = ['low', 'normal', 'high', 'urgent'];

      priorities.forEach(priority => {
        it(`should handle TaskPriority: ${priority}`, () => {
          const task = createTask({ priority });
          const result = formatTasksToJSON([task]);
          const parsed = JSON.parse(result);

          expect(parsed[0].priority).toBe(priority);
        });
      });
    });

    describe('TaskEffort values', () => {
      const efforts: Array<Task['effort']> = ['xs', 'small', 'medium', 'large', 'xl'];

      efforts.forEach(effort => {
        it(`should handle TaskEffort: ${effort}`, () => {
          const task = createTask({ effort });
          const result = formatTasksToJSON([task]);
          const parsed = JSON.parse(result);

          expect(parsed[0].effort).toBe(effort);
        });
      });
    });

    describe('AutonomyLevel values', () => {
      const autonomyLevels: Array<Task['autonomy']> = ['full-auto', 'review-before-commit', 'review-all'];

      autonomyLevels.forEach(autonomy => {
        it(`should handle AutonomyLevel: ${autonomy}`, () => {
          const task = createTask({ autonomy });
          const result = formatTasksToJSON([task]);
          const parsed = JSON.parse(result);

          expect(parsed[0].autonomy).toBe(autonomy);
        });
      });
    });

    describe('SubtaskStrategy values', () => {
      const strategies: Array<Task['subtaskStrategy']> = ['sequential', 'parallel', 'dependency-based'];

      strategies.forEach(strategy => {
        it(`should handle SubtaskStrategy: ${strategy}`, () => {
          const task = createTask({ subtaskStrategy: strategy });
          const result = formatTasksToJSON([task]);
          const parsed = JSON.parse(result);

          expect(parsed[0].subtaskStrategy).toBe(strategy);
        });
      });
    });

    describe('Logs transformation', () => {
      const logLevels: Array<TaskLog['level']> = ['debug', 'info', 'warn', 'error'];

      logLevels.forEach(level => {
        it(`should handle log level: ${level}`, () => {
          const task = createTask({
            logs: [createTaskLog({ level, message: `Test ${level} message` })],
          });

          const result = formatTasksToJSON([task]);
          const parsed = JSON.parse(result);

          expect(parsed[0].logs[0].level).toBe(level);
          expect(parsed[0].logs[0].message).toBe(`Test ${level} message`);
          expect(parsed[0].logs[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
      });

      it('should transform log metadata correctly', () => {
        const metadata = { step: 5, total: 10, custom: { nested: 'value' } };
        const task = createTask({
          logs: [createTaskLog({
            level: 'info',
            stage: 'testing',
            agent: 'tester',
            message: 'Running tests',
            metadata,
          })],
        });

        const result = formatTasksToJSON([task]);
        const parsed = JSON.parse(result);
        const log = parsed[0].logs[0];

        expect(log.stage).toBe('testing');
        expect(log.agent).toBe('tester');
        expect(log.metadata).toEqual(metadata);
      });
    });

    describe('Artifacts transformation', () => {
      const artifactTypes: Array<TaskArtifact['type']> = ['file', 'diff', 'report', 'log'];

      artifactTypes.forEach(type => {
        it(`should handle artifact type: ${type}`, () => {
          const task = createTask({
            artifacts: [createTaskArtifact({
              name: `Test ${type}`,
              type,
              path: `/path/to/${type}`,
              content: `Content for ${type}`,
            })],
          });

          const result = formatTasksToJSON([task]);
          const parsed = JSON.parse(result);
          const artifact = parsed[0].artifacts[0];

          expect(artifact.name).toBe(`Test ${type}`);
          expect(artifact.type).toBe(type);
          expect(artifact.path).toBe(`/path/to/${type}`);
          expect(artifact.content).toBe(`Content for ${type}`);
          expect(artifact.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
      });
    });

    describe('Usage metrics transformation', () => {
      it('should transform TaskUsage object correctly', () => {
        const usage = createTaskUsage({
          inputTokens: 1500,
          outputTokens: 800,
          totalTokens: 2300,
          estimatedCost: 0.045,
          totalCostCents: 45,
          executionTimeMs: 12000,
        });

        const task = createTask({ usage });
        const result = formatTasksToJSON([task]);
        const parsed = JSON.parse(result);

        expect(parsed[0].usage).toEqual({
          inputTokens: 1500,
          outputTokens: 800,
          totalTokens: 2300,
          estimatedCost: 0.045,
          totalCostCents: 45,
          executionTimeMs: 12000,
        });
      });
    });
  });

  // ============================================================================
  // Date Handling Tests
  // ============================================================================

  describe('Date Handling', () => {
    it('should convert Date objects to ISO 8601 strings', () => {
      const fixedDate = new Date('2023-10-15T14:30:00.000Z');
      const task = createTask({
        createdAt: fixedDate,
        updatedAt: fixedDate,
        completedAt: fixedDate,
      });

      const result = formatTasksToJSON([task]);
      const parsed = JSON.parse(result);

      expect(parsed[0].createdAt).toBe('2023-10-15T14:30:00.000Z');
      expect(parsed[0].updatedAt).toBe('2023-10-15T14:30:00.000Z');
      expect(parsed[0].completedAt).toBe('2023-10-15T14:30:00.000Z');
    });

    it('should handle undefined optional dates', () => {
      const task = createTask({
        completedAt: undefined,
        pausedAt: undefined,
        resumeAfter: undefined,
        trashedAt: undefined,
        archivedAt: undefined,
      });

      const result = formatTasksToJSON([task]);
      const parsed = JSON.parse(result);

      expect(parsed[0].completedAt).toBeUndefined();
      expect(parsed[0].pausedAt).toBeUndefined();
      expect(parsed[0].resumeAfter).toBeUndefined();
      expect(parsed[0].trashedAt).toBeUndefined();
      expect(parsed[0].archivedAt).toBeUndefined();
    });

    it('should handle dates in logs and artifacts', () => {
      const logDate = new Date('2023-10-15T15:45:00.000Z');
      const artifactDate = new Date('2023-10-15T16:00:00.000Z');

      const task = createTask({
        logs: [createTaskLog({ timestamp: logDate })],
        artifacts: [createTaskArtifact({ createdAt: artifactDate })],
      });

      const result = formatTasksToJSON([task]);
      const parsed = JSON.parse(result);

      expect(parsed[0].logs[0].timestamp).toBe('2023-10-15T15:45:00.000Z');
      expect(parsed[0].artifacts[0].createdAt).toBe('2023-10-15T16:00:00.000Z');
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty logs and artifacts arrays', () => {
      const task = createTask({
        logs: [],
        artifacts: [],
      });

      const result = formatTasksToJSON([task]);
      const parsed = JSON.parse(result);

      expect(parsed[0].logs).toEqual([]);
      expect(parsed[0].artifacts).toEqual([]);
    });

    it('should handle tasks with very large arrays', () => {
      const manyLogs = Array.from({ length: 1000 }, (_, i) =>
        createTaskLog({ message: `Log entry ${i}` })
      );
      const manyArtifacts = Array.from({ length: 500 }, (_, i) =>
        createTaskArtifact({ name: `Artifact ${i}` })
      );

      const task = createTask({
        logs: manyLogs,
        artifacts: manyArtifacts,
      });

      const result = formatTasksToJSON([task], { maxItems: 10 });
      const parsed = JSON.parse(result);

      expect(parsed[0].logs).toHaveLength(10);
      expect(parsed[0].artifacts).toHaveLength(10);
    });

    it('should handle Unicode content in strings', () => {
      const unicodeTask = createTask({
        description: '测试任务 with émojis 🚀 and symbols ∆∇∈∉',
        logs: [createTaskLog({ message: 'Unicode log: 日本語 русский العربية' })],
        artifacts: [createTaskArtifact({
          name: 'unicode-file.txt',
          content: 'File with unicode: ñáéíóú çüöäß 中文',
        })],
      });

      const result = formatTasksToJSON([unicodeTask]);
      const parsed = JSON.parse(result);

      expect(parsed[0].description).toBe('测试任务 with émojis 🚀 and symbols ∆∇∈∉');
      expect(parsed[0].logs[0].message).toBe('Unicode log: 日本語 русский العربية');
      expect(parsed[0].artifacts[0].content).toBe('File with unicode: ñáéíóú çüöäß 中文');
    });

    it('should handle special characters in field values', () => {
      const specialTask = createTask({
        description: 'Task with "quotes" and \\backslashes\\ and \nnewlines\n and \ttabs\t',
        error: 'Error message with special chars: &lt;script&gt;alert("xss")&lt;/script&gt;',
      });

      const result = formatTasksToJSON([specialTask]);
      const parsed = JSON.parse(result);

      expect(parsed[0].description).toBe('Task with "quotes" and \\backslashes\\ and \nnewlines\n and \ttabs\t');
      expect(parsed[0].error).toBe('Error message with special chars: &lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should handle very deeply nested metadata objects', () => {
      const deepMetadata = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep nested value',
                  array: [1, 2, { nested: 'object' }],
                },
              },
            },
          },
        },
      };

      const task = createTask({
        logs: [createTaskLog({ metadata: deepMetadata })],
      });

      const result = formatTasksToJSON([task]);
      const parsed = JSON.parse(result);

      expect(parsed[0].logs[0].metadata.level1.level2.level3.level4.level5.value).toBe('deep nested value');
    });

    it('should handle tasks with all optional fields undefined', () => {
      const minimalTask: Task = {
        id: 'minimal-task',
        description: 'Minimal task with only required fields',
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

      const result = formatTasksToJSON([minimalTask]);
      const parsed = JSON.parse(result);

      expect(parsed[0].id).toBe('minimal-task');
      expect(parsed[0].description).toBe('Minimal task with only required fields');
      expect(parsed[0].logs).toEqual([]);
      expect(parsed[0].artifacts).toEqual([]);
    });
  });

  // ============================================================================
  // Error Scenarios Tests
  // ============================================================================

  describe('Error Scenarios', () => {
    it('should handle JSON serialization of very large data structures', () => {
      // Create a task with extensive data
      const largeTask = createTask({
        logs: Array.from({ length: 1000 }, (_, i) => createTaskLog({
          message: `Large log entry ${i}`.repeat(100), // Very long messages
          metadata: {
            iteration: i,
            data: Array.from({ length: 100 }, (_, j) => ({ index: j, value: `value_${j}` }))
          }
        })),
        artifacts: Array.from({ length: 500 }, (_, i) => createTaskArtifact({
          name: `large-artifact-${i}`,
          content: 'Large content '.repeat(1000),
        })),
      });

      // Should not throw an error, but might be large
      expect(() => {
        const result = formatTasksToJSON([largeTask], { maxItems: 5 });
        expect(result).toBeTruthy();
      }).not.toThrow();
    });

    it('should provide helpful error message for circular references', () => {
      // Create a task with a circular reference in metadata
      const circularTask = createTask();

      // Add circular reference to log metadata
      const circularMetadata: any = { task: circularTask };
      circularMetadata.self = circularMetadata;

      circularTask.logs = [createTaskLog({ metadata: circularMetadata })];

      expect(() => {
        formatTasksToJSON([circularTask]);
      }).toThrow('Failed to serialize tasks: circular reference detected');
    });

    it('should handle corrupted or malformed task data gracefully', () => {
      // Task with malformed dates (should not occur in practice but testing robustness)
      const baseTask = createTask();
      const malformedTask = {
        ...baseTask,
        createdAt: new Date('invalid-date'), // Invalid date but still Date object
      };

      // The date serialization will throw for invalid dates, which is expected behavior
      expect(() => {
        const result = formatTasksToJSON([malformedTask]);
      }).toThrow('Invalid time value');
    });
  });
});