/**
 * @fileoverview Advanced validation tests for TodoWriteTool
 *
 * These tests focus on complex validation scenarios and edge cases that go
 * beyond basic parameter validation:
 * - Advanced business logic validation
 * - Complex validation combinations
 * - Context-aware validation
 * - Performance-critical validation scenarios
 * - Security considerations in validation
 *
 * @module @apex/core/tools/system/__tests__/todo-write-tool.validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TodoWriteTool } from '../todo-write-tool.js';
import type { TodoWriteInput, TodoItem } from '../../../types.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate todos with specific validation patterns
 */
function generateValidationPatternTodos(): {
  emptyContent: TodoItem[];
  whitespaceContent: TodoItem[];
  specialCharacters: TodoItem[];
  duplicateContent: TodoItem[];
  multipleInProgress: TodoItem[];
  allCompleted: TodoItem[];
  extremeStatuses: TodoItem[];
} {
  return {
    emptyContent: [
      { content: '', status: 'pending', activeForm: 'Working on empty' },
    ],
    whitespaceContent: [
      { content: '   ', status: 'pending', activeForm: 'Working on whitespace' },
      { content: '\t\n\r', status: 'pending', activeForm: 'Working on tabs' },
    ],
    specialCharacters: [
      { content: 'Task with "quotes" and \'apostrophes\'', status: 'pending', activeForm: 'Working with quotes' },
      { content: 'Task with <tags> and &entities;', status: 'pending', activeForm: 'Working with HTML' },
      { content: 'Task with \\ backslashes \\ and / slashes /', status: 'pending', activeForm: 'Working with slashes' },
      { content: 'Task with ${variables} and $(commands)', status: 'pending', activeForm: 'Working with variables' },
    ],
    duplicateContent: [
      { content: 'Same task', status: 'pending', activeForm: 'Working on same task' },
      { content: 'Same task', status: 'in_progress', activeForm: 'Working on same task' },
      { content: 'SAME TASK', status: 'completed', activeForm: 'Working on same task' },
    ],
    multipleInProgress: Array.from({ length: 10 }, (_, i) => ({
      content: `In progress task ${i}`,
      status: 'in_progress' as const,
      activeForm: `Working on task ${i}`,
    })),
    allCompleted: Array.from({ length: 5 }, (_, i) => ({
      content: `Completed task ${i}`,
      status: 'completed' as const,
      activeForm: `Completed task ${i}`,
    })),
    extremeStatuses: [
      { content: 'Pending task', status: 'pending', activeForm: 'Working on pending' },
      { content: 'In progress task', status: 'in_progress', activeForm: 'Working on in progress' },
      { content: 'Completed task', status: 'completed', activeForm: 'Working on completed' },
    ],
  };
}

/**
 * Generate edge case validation scenarios
 */
function generateEdgeCaseScenarios() {
  return {
    sqlInjection: [
      { content: "'; DROP TABLE todos; --", status: 'pending', activeForm: 'Working on SQL injection' },
      { content: "1' OR '1'='1", status: 'pending', activeForm: 'Working on SQL condition' },
    ],
    xssAttempts: [
      { content: '<script>alert("xss")</script>', status: 'pending', activeForm: 'Working on XSS' },
      { content: 'javascript:alert(1)', status: 'pending', activeForm: 'Working on JS execution' },
    ],
    pathTraversal: [
      { content: '../../../etc/passwd', status: 'pending', activeForm: 'Working on path traversal' },
      { content: '..\\..\\windows\\system32', status: 'pending', activeForm: 'Working on Windows path' },
    ],
    nullBytes: [
      { content: 'Task with\x00null byte', status: 'pending', activeForm: 'Working with null byte' },
    ],
    controlCharacters: [
      { content: 'Task with\u0001control\u0002chars', status: 'pending', activeForm: 'Working with control chars' },
    ],
  };
}

// ============================================================================
// Advanced Validation Test Suite
// ============================================================================

describe('TodoWriteTool Advanced Validation', () => {
  let tool: TodoWriteTool;

  beforeEach(() => {
    tool = new TodoWriteTool(); // Memory-only mode for validation tests
  });

  // ==========================================================================
  // Business Logic Validation Tests
  // ==========================================================================

  describe('Business Logic Validation', () => {
    it('should handle empty content gracefully', () => {
      const patterns = generateValidationPatternTodos();
      const input: TodoWriteInput = { todos: patterns.emptyContent };

      const result = tool.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Parameter \'content\' must be at least 1 characters long');
    });

    it('should warn about whitespace-only content', () => {
      const patterns = generateValidationPatternTodos();
      const input: TodoWriteInput = { todos: patterns.whitespaceContent };

      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Todo 1: Content is very short - consider being more descriptive');
      expect(result.warnings).toContain('Todo 2: Content is very short - consider being more descriptive');
    });

    it('should handle special characters in content', () => {
      const patterns = generateValidationPatternTodos();
      const input: TodoWriteInput = { todos: patterns.specialCharacters };

      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      // Special characters should not trigger warnings beyond content length
    });

    it('should detect case-insensitive duplicate content', () => {
      const patterns = generateValidationPatternTodos();
      const input: TodoWriteInput = { todos: patterns.duplicateContent };

      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Todo 2: Duplicate content found at position 1');
      expect(result.warnings).toContain('Todo 3: Duplicate content found at position 1');
    });

    it('should warn about many in_progress todos', () => {
      const patterns = generateValidationPatternTodos();
      const input: TodoWriteInput = { todos: patterns.multipleInProgress };

      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        'Found 10 todos marked as in_progress. ' +
        'Consider having only one active task at a time for better focus.'
      );
    });

    it('should handle all completed todos without warnings', () => {
      const patterns = generateValidationPatternTodos();
      const input: TodoWriteInput = { todos: patterns.allCompleted };

      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      // Should not warn about multiple completed todos
      const inProgressWarnings = result.warnings?.filter(w => w.includes('in_progress'));
      expect(inProgressWarnings?.length || 0).toBe(0);
    });

    it('should validate mixed status combinations correctly', () => {
      const patterns = generateValidationPatternTodos();
      const input: TodoWriteInput = { todos: patterns.extremeStatuses };

      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      // Should only have one in_progress, so no warnings expected
      const inProgressWarnings = result.warnings?.filter(w => w.includes('in_progress'));
      expect(inProgressWarnings?.length || 0).toBe(0);
    });
  });

  // ==========================================================================
  // Security Validation Tests
  // ==========================================================================

  describe('Security Validation', () => {
    it('should handle potential SQL injection attempts safely', () => {
      const edgeCases = generateEdgeCaseScenarios();
      const input: TodoWriteInput = { todos: edgeCases.sqlInjection };

      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      // Content should be accepted as-is (validation doesn't sanitize)
      // Security is handled at the storage layer
    });

    it('should handle potential XSS attempts safely', () => {
      const edgeCases = generateEdgeCaseScenarios();
      const input: TodoWriteInput = { todos: edgeCases.xssAttempts };

      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      // XSS prevention is handled at the display layer, not validation
    });

    it('should handle path traversal attempts safely', () => {
      const edgeCases = generateEdgeCaseScenarios();
      const input: TodoWriteInput = { todos: edgeCases.pathTraversal };

      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      // Path traversal protection is handled at the file system layer
    });

    it('should handle null bytes in content', () => {
      const edgeCases = generateEdgeCaseScenarios();
      const input: TodoWriteInput = { todos: edgeCases.nullBytes };

      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      // Null bytes should be preserved in content
    });

    it('should handle control characters in content', () => {
      const edgeCases = generateEdgeCaseScenarios();
      const input: TodoWriteInput = { todos: edgeCases.controlCharacters };

      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      // Control characters should be preserved
    });
  });

  // ==========================================================================
  // Complex Validation Scenarios
  // ==========================================================================

  describe('Complex Validation Scenarios', () => {
    it('should handle mixed valid and edge case todos', () => {
      const mixed: TodoItem[] = [
        { content: 'Normal todo', status: 'pending', activeForm: 'Working normally' },
        { content: 'A', status: 'in_progress', activeForm: 'B' }, // Short content and activeForm
        { content: 'Another normal todo', status: 'completed', activeForm: 'Working on another' },
        { content: '<script>alert("test")</script>', status: 'pending', activeForm: 'Working on XSS' },
        { content: 'Normal todo', status: 'pending', activeForm: 'Working normally' }, // Duplicate
      ];

      const input: TodoWriteInput = { todos: mixed };
      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Todo 2: Content is very short - consider being more descriptive');
      expect(result.warnings).toContain('Todo 2: Active form is very short - consider being more descriptive');
      expect(result.warnings).toContain('Todo 5: Duplicate content found at position 1');
    });

    it('should validate very large todo lists efficiently', () => {
      const largeTodos: TodoItem[] = Array.from({ length: 1000 }, (_, i) => ({
        content: `Large list todo ${i}`,
        status: (i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in_progress' : 'pending') as any,
        activeForm: `Working on large list todo ${i}`,
      }));

      const input: TodoWriteInput = { todos: largeTodos };

      const startTime = performance.now();
      const result = tool.validate(input);
      const endTime = performance.now();

      expect(result.valid).toBe(true);
      // Should validate 1000 todos quickly (under 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Should warn about many in_progress todos
      const inProgressCount = largeTodos.filter(t => t.status === 'in_progress').length;
      if (inProgressCount > 1) {
        expect(result.warnings).toContain(
          `Found ${inProgressCount} todos marked as in_progress. ` +
          'Consider having only one active task at a time for better focus.'
        );
      }
    });

    it('should handle todos with identical content but different cases', () => {
      const caseDuplicates: TodoItem[] = [
        { content: 'test task', status: 'pending', activeForm: 'Working on test' },
        { content: 'Test Task', status: 'in_progress', activeForm: 'Working on Test' },
        { content: 'TEST TASK', status: 'completed', activeForm: 'Working on TEST' },
        { content: 'tEsT tAsK', status: 'pending', activeForm: 'Working on tEsT' },
      ];

      const input: TodoWriteInput = { todos: caseDuplicates };
      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      // Should detect all case-insensitive duplicates
      expect(result.warnings).toContain('Todo 2: Duplicate content found at position 1');
      expect(result.warnings).toContain('Todo 3: Duplicate content found at position 1');
      expect(result.warnings).toContain('Todo 4: Duplicate content found at position 1');
    });

    it('should handle todos with excessive whitespace variations', () => {
      const whitespaceVariations: TodoItem[] = [
        { content: ' normal task ', status: 'pending', activeForm: ' working normally ' },
        { content: '  normal task  ', status: 'in_progress', activeForm: '  working normally  ' },
        { content: '\tnormal task\t', status: 'completed', activeForm: '\tworking normally\t' },
      ];

      const input: TodoWriteInput = { todos: whitespaceVariations };
      const result = tool.validate(input);

      expect(result.valid).toBe(true);
      // These should not be considered duplicates (exact string comparison)
      const duplicateWarnings = result.warnings?.filter(w => w.includes('Duplicate content'));
      expect(duplicateWarnings?.length || 0).toBe(0);
    });
  });

  // ==========================================================================
  // Context-Aware Validation Tests
  // ==========================================================================

  describe('Context-Aware Validation', () => {
    it('should validate consistently with and without context', () => {
      const todos: TodoItem[] = [
        { content: 'Test todo', status: 'in_progress', activeForm: 'Working on test' },
      ];
      const input: TodoWriteInput = { todos };

      const contextlessResult = tool.validate(input);
      const contextResult = tool.validate(input, { taskId: 'test-task' });

      expect(contextlessResult.valid).toBe(contextResult.valid);
      expect(contextlessResult.warnings?.length || 0).toBe(contextResult.warnings?.length || 0);
      expect(contextlessResult.errors?.length || 0).toBe(contextResult.errors?.length || 0);
    });

    it('should handle validation with various context types', () => {
      const todos: TodoItem[] = [
        { content: 'Context test', status: 'pending', activeForm: 'Working on context' },
      ];
      const input: TodoWriteInput = { todos };

      const contexts: ToolExecutionContext[] = [
        { taskId: 'simple-task' },
        { taskId: 'complex-task-with-long-id', agentName: 'test-agent' },
        { taskId: 'task', agentName: 'agent', stageName: 'implementation' },
        {
          taskId: 'full-context-task',
          agentName: 'full-agent',
          stageName: 'testing',
          signal: new AbortController().signal,
        },
      ];

      for (const context of contexts) {
        const result = tool.validate(input, context);
        expect(result.valid).toBe(true);
      }
    });

    it('should handle validation with aborted context signal', () => {
      const todos: TodoItem[] = [
        { content: 'Abort test', status: 'pending', activeForm: 'Working on abort' },
      ];
      const input: TodoWriteInput = { todos };

      const controller = new AbortController();
      controller.abort(); // Pre-abort the signal

      const result = tool.validate(input, { signal: controller.signal });

      // Validation should still work even with aborted signal
      expect(result.valid).toBe(true);
    });
  });

  // ==========================================================================
  // Performance Validation Tests
  // ==========================================================================

  describe('Performance Validation', () => {
    it('should validate complex nested scenarios quickly', () => {
      const complexTodos: TodoItem[] = [];

      // Create a scenario with many validation warnings
      for (let i = 0; i < 100; i++) {
        complexTodos.push(
          { content: 'A', status: 'in_progress', activeForm: 'B' }, // Short content warnings
          { content: 'duplicate', status: 'pending', activeForm: 'Working on duplicate' }, // Duplicate warnings
        );
      }

      const input: TodoWriteInput = { todos: complexTodos };

      const startTime = performance.now();
      const result = tool.validate(input);
      const endTime = performance.now();

      expect(result.valid).toBe(true);
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast even with many warnings

      // Should have many warnings
      expect(result.warnings!.length).toBeGreaterThan(100);
    });

    it('should handle repeated validation calls efficiently', () => {
      const todos: TodoItem[] = [
        { content: 'Repeated validation test', status: 'pending', activeForm: 'Working on repeated' },
      ];
      const input: TodoWriteInput = { todos };

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const result = tool.validate(input);
        expect(result.valid).toBe(true);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Average validation should be very fast (under 1ms)
      expect(avgTime).toBeLessThan(1);
    });
  });
});