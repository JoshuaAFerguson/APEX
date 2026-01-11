import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index';
import {
  ToolStartHookContext,
  ToolCompleteHookContext,
  ToolErrorHookContext,
  ToolStartHookContextSchema,
  ToolCompleteHookContextSchema,
  ToolErrorHookContextSchema,
  generateTaskId,
} from '@apexcli/core';
import path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('Tool Execution Hooks - Validation Tests', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), '.test-tool-hooks-validation');
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
    mkdirSync(tempDir, { recursive: true });

    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
    });

    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('Hook Context Schema Validation', () => {
    describe('ToolStartHookContext', () => {
      it('should validate valid ToolStartHookContext objects', () => {
        const validContext: ToolStartHookContext = {
          toolName: 'Read',
          input: { filePath: 'test.txt' },
          callId: 'test-call-1',
          taskId: generateTaskId(),
          timestamp: new Date(),
        };

        const result = ToolStartHookContextSchema.safeParse(validContext);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data).toEqual(validContext);
        }
      });

      it('should validate ToolStartHookContext with optional fields', () => {
        const contextWithOptionals: ToolStartHookContext = {
          toolName: 'Write',
          input: { filePath: 'test.txt', content: 'hello' },
          callId: 'test-call-2',
          taskId: generateTaskId(),
          timestamp: new Date(),
          agentName: 'developer',
          stageName: 'implementation',
        };

        const result = ToolStartHookContextSchema.safeParse(contextWithOptionals);
        expect(result.success).toBe(true);
      });

      it('should reject invalid ToolStartHookContext objects', () => {
        const invalidContexts = [
          // Missing required fields
          {
            toolName: 'Read',
            // missing input, callId, taskId, timestamp
          },
          // Invalid types
          {
            toolName: 123, // should be string
            input: { filePath: 'test.txt' },
            callId: 'test-call-3',
            taskId: generateTaskId(),
            timestamp: new Date(),
          },
          // Invalid timestamp
          {
            toolName: 'Read',
            input: { filePath: 'test.txt' },
            callId: 'test-call-4',
            taskId: generateTaskId(),
            timestamp: 'invalid-date',
          },
        ];

        invalidContexts.forEach(context => {
          const result = ToolStartHookContextSchema.safeParse(context);
          expect(result.success).toBe(false);
        });
      });
    });

    describe('ToolCompleteHookContext', () => {
      it('should validate valid ToolCompleteHookContext objects', () => {
        const validContext: ToolCompleteHookContext = {
          toolName: 'Read',
          input: { filePath: 'test.txt' },
          callId: 'test-call-5',
          taskId: generateTaskId(),
          timestamp: new Date(),
          result: { success: true, output: 'file content' },
          timing: {
            startTime: new Date(),
            endTime: new Date(),
            duration: 100,
          },
        };

        const result = ToolCompleteHookContextSchema.safeParse(validContext);
        expect(result.success).toBe(true);
      });

      it('should validate ToolCompleteHookContext with optional fields', () => {
        const contextWithOptionals: ToolCompleteHookContext = {
          toolName: 'Write',
          input: { filePath: 'test.txt', content: 'hello' },
          callId: 'test-call-6',
          taskId: generateTaskId(),
          timestamp: new Date(),
          result: { success: true, output: 'written successfully' },
          timing: {
            startTime: new Date(),
            endTime: new Date(),
            duration: 200,
          },
          agentName: 'developer',
          stageName: 'implementation',
        };

        const result = ToolCompleteHookContextSchema.safeParse(contextWithOptionals);
        expect(result.success).toBe(true);
      });

      it('should reject invalid ToolCompleteHookContext objects', () => {
        const invalidContexts = [
          // Missing required fields
          {
            toolName: 'Read',
            input: { filePath: 'test.txt' },
            callId: 'test-call-7',
            taskId: generateTaskId(),
            timestamp: new Date(),
            // missing result and timing
          },
          // Invalid result structure
          {
            toolName: 'Read',
            input: { filePath: 'test.txt' },
            callId: 'test-call-8',
            taskId: generateTaskId(),
            timestamp: new Date(),
            result: { invalid: 'result' }, // missing success field
            timing: {
              startTime: new Date(),
              endTime: new Date(),
              duration: 100,
            },
          },
        ];

        invalidContexts.forEach(context => {
          const result = ToolCompleteHookContextSchema.safeParse(context);
          expect(result.success).toBe(false);
        });
      });
    });

    describe('ToolErrorHookContext', () => {
      it('should validate valid ToolErrorHookContext objects', () => {
        const validContext: ToolErrorHookContext = {
          toolName: 'Read',
          input: { filePath: 'nonexistent.txt' },
          callId: 'test-call-9',
          taskId: generateTaskId(),
          timestamp: new Date(),
          error: 'File not found',
          timing: {
            startTime: new Date(),
            endTime: new Date(),
            duration: 50,
          },
        };

        const result = ToolErrorHookContextSchema.safeParse(validContext);
        expect(result.success).toBe(true);
      });

      it('should validate ToolErrorHookContext with optional fields', () => {
        const contextWithOptionals: ToolErrorHookContext = {
          toolName: 'Write',
          input: { filePath: 'readonly.txt', content: 'test' },
          callId: 'test-call-10',
          taskId: generateTaskId(),
          timestamp: new Date(),
          error: 'Permission denied',
          timing: {
            startTime: new Date(),
            endTime: new Date(),
            duration: 25,
          },
          agentName: 'developer',
          stageName: 'implementation',
        };

        const result = ToolErrorHookContextSchema.safeParse(contextWithOptionals);
        expect(result.success).toBe(true);
      });

      it('should reject invalid ToolErrorHookContext objects', () => {
        const invalidContexts = [
          // Missing error field
          {
            toolName: 'Read',
            input: { filePath: 'test.txt' },
            callId: 'test-call-11',
            taskId: generateTaskId(),
            timestamp: new Date(),
            // missing error field
            timing: {
              startTime: new Date(),
              endTime: new Date(),
              duration: 50,
            },
          },
          // Invalid error type
          {
            toolName: 'Read',
            input: { filePath: 'test.txt' },
            callId: 'test-call-12',
            taskId: generateTaskId(),
            timestamp: new Date(),
            error: 123, // should be string
            timing: {
              startTime: new Date(),
              endTime: new Date(),
              duration: 50,
            },
          },
        ];

        invalidContexts.forEach(context => {
          const result = ToolErrorHookContextSchema.safeParse(context);
          expect(result.success).toBe(false);
        });
      });
    });
  });

  describe('Real Hook Context Validation', () => {
    it('should produce valid ToolStartHookContext in real execution', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'real-validation-start',
        timestamp: new Date(),
      });

      expect(hook).toHaveBeenCalledTimes(1);
      const context = hook.mock.calls[0][0];

      // Validate against schema
      const result = ToolStartHookContextSchema.safeParse(context);
      expect(result.success).toBe(true);

      unsubscribe();
    });

    it('should produce valid ToolCompleteHookContext in real execution', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolComplete(hook);

      // Mock tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'real-validation-complete',
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        startTime: new Date(),
        taskId: generateTaskId(),
        status: 'in_progress' as const,
      });

      orchestrator.emit('tool:complete', {
        taskId: generateTaskId(),
        toolName: 'Read',
        callId: 'real-validation-complete',
        result: { success: true, output: 'file content' },
        timing: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
        },
        timestamp: new Date(),
      });

      expect(hook).toHaveBeenCalledTimes(1);
      const context = hook.mock.calls[0][0];

      // Validate against schema
      const result = ToolCompleteHookContextSchema.safeParse(context);
      expect(result.success).toBe(true);

      unsubscribe();
    });

    it('should produce valid ToolErrorHookContext in real execution', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolError(hook);

      // Mock tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'real-validation-error',
        toolName: 'Read',
        input: { filePath: 'nonexistent.txt' },
        startTime: new Date(),
        taskId: generateTaskId(),
        status: 'in_progress' as const,
      });

      orchestrator.emit('tool:complete', {
        taskId: generateTaskId(),
        toolName: 'Read',
        callId: 'real-validation-error',
        result: { success: false, error: 'File not found' },
        timing: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 50,
        },
        timestamp: new Date(),
      });

      expect(hook).toHaveBeenCalledTimes(1);
      const context = hook.mock.calls[0][0];

      // Validate against schema
      const result = ToolErrorHookContextSchema.safeParse(context);
      expect(result.success).toBe(true);

      unsubscribe();
    });
  });

  describe('Hook Type Safety', () => {
    it('should enforce correct callback signature for onToolStart', () => {
      // This test ensures TypeScript type safety at runtime
      const correctCallback = (context: ToolStartHookContext) => {
        expect(context.toolName).toBeDefined();
        expect(context.input).toBeDefined();
        expect(context.callId).toBeDefined();
        expect(context.taskId).toBeDefined();
        expect(context.timestamp).toBeDefined();
      };

      const unsubscribe = orchestrator.onToolStart(correctCallback);

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        callId: 'type-safety-start',
        timestamp: new Date(),
      });

      unsubscribe();
    });

    it('should enforce correct callback signature for onToolComplete', () => {
      const correctCallback = (context: ToolCompleteHookContext) => {
        expect(context.toolName).toBeDefined();
        expect(context.input).toBeDefined();
        expect(context.callId).toBeDefined();
        expect(context.taskId).toBeDefined();
        expect(context.timestamp).toBeDefined();
        expect(context.result).toBeDefined();
        expect(context.timing).toBeDefined();
      };

      const unsubscribe = orchestrator.onToolComplete(correctCallback);

      // Mock tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'type-safety-complete',
        toolName: 'Read',
        input: { filePath: 'test.txt' },
        startTime: new Date(),
        taskId: generateTaskId(),
        status: 'in_progress' as const,
      });

      orchestrator.emit('tool:complete', {
        taskId: generateTaskId(),
        toolName: 'Read',
        callId: 'type-safety-complete',
        result: { success: true, output: 'content' },
        timing: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
        },
        timestamp: new Date(),
      });

      unsubscribe();
    });

    it('should enforce correct callback signature for onToolError', () => {
      const correctCallback = (context: ToolErrorHookContext) => {
        expect(context.toolName).toBeDefined();
        expect(context.input).toBeDefined();
        expect(context.callId).toBeDefined();
        expect(context.taskId).toBeDefined();
        expect(context.timestamp).toBeDefined();
        expect(context.error).toBeDefined();
        expect(context.timing).toBeDefined();
      };

      const unsubscribe = orchestrator.onToolError(correctCallback);

      // Mock tool execution
      vi.spyOn(orchestrator, 'getToolExecution').mockReturnValue({
        callId: 'type-safety-error',
        toolName: 'Read',
        input: { filePath: 'nonexistent.txt' },
        startTime: new Date(),
        taskId: generateTaskId(),
        status: 'in_progress' as const,
      });

      orchestrator.emit('tool:complete', {
        taskId: generateTaskId(),
        toolName: 'Read',
        callId: 'type-safety-error',
        result: { success: false, error: 'File not found' },
        timing: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 50,
        },
        timestamp: new Date(),
      });

      unsubscribe();
    });
  });

  describe('Input Object Validation', () => {
    it('should handle various input object types correctly', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      const inputVariations = [
        // Simple object
        { filePath: 'test.txt' },
        // Complex nested object
        {
          filePath: 'complex.txt',
          options: {
            encoding: 'utf8',
            flags: ['read', 'write'],
            metadata: {
              author: 'test',
              created: new Date(),
            },
          },
        },
        // Array inputs
        {
          paths: ['file1.txt', 'file2.txt', 'file3.txt'],
          options: { recursive: true },
        },
        // Empty object
        {},
        // Object with null/undefined values
        {
          filePath: 'test.txt',
          nullValue: null,
          undefinedValue: undefined,
        },
      ];

      inputVariations.forEach((input, index) => {
        orchestrator.emit('tool:start', {
          taskId: generateTaskId(),
          toolName: 'Read',
          input,
          callId: `input-validation-${index}`,
          timestamp: new Date(),
        });

        const context = hook.mock.calls[index][0];
        expect(context.input).toEqual(input);

        // Validate context structure
        const result = ToolStartHookContextSchema.safeParse(context);
        expect(result.success).toBe(true);
      });

      expect(hook).toHaveBeenCalledTimes(inputVariations.length);
      unsubscribe();
    });

    it('should preserve input object immutability', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      const originalInput = {
        filePath: 'test.txt',
        options: {
          nested: {
            value: 'original',
          },
        },
      };

      // Create a deep clone to compare later
      const inputCopy = JSON.parse(JSON.stringify(originalInput));

      orchestrator.emit('tool:start', {
        taskId: generateTaskId(),
        toolName: 'Read',
        input: originalInput,
        callId: 'immutability-test',
        timestamp: new Date(),
      });

      const context = hook.mock.calls[0][0];

      // Try to modify the input through the context
      (context.input as any).options.nested.value = 'modified';
      (context.input as any).newProperty = 'added';

      // Original input should remain unchanged
      expect(originalInput).toEqual(inputCopy);

      unsubscribe();
    });
  });

  describe('Timestamp Validation', () => {
    it('should handle various timestamp formats correctly', () => {
      const hook = vi.fn();
      const unsubscribe = orchestrator.onToolStart(hook);

      const timestamps = [
        new Date(), // Current time
        new Date(0), // Unix epoch
        new Date('2023-01-01T00:00:00Z'), // ISO string
        new Date(Date.now() - 86400000), // Yesterday
        new Date(Date.now() + 86400000), // Tomorrow (future)
      ];

      timestamps.forEach((timestamp, index) => {
        orchestrator.emit('tool:start', {
          taskId: generateTaskId(),
          toolName: 'Read',
          input: { filePath: `test-${index}.txt` },
          callId: `timestamp-test-${index}`,
          timestamp,
        });

        const context = hook.mock.calls[index][0];
        expect(context.timestamp).toBe(timestamp);
        expect(context.timestamp instanceof Date).toBe(true);

        // Validate context structure
        const result = ToolStartHookContextSchema.safeParse(context);
        expect(result.success).toBe(true);
      });

      unsubscribe();
    });
  });
});