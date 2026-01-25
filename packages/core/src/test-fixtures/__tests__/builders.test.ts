/**
 * @fileoverview Tests for fixture builders
 *
 * Tests the builder pattern classes for creating response and execution fixtures
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolResponseBuilder,
  ToolExecutionBuilder,
  ResponseBuilders,
  ExecutionBuilders
} from '../builders/response-builder.js';

describe('Fixture Builders', () => {
  describe('ToolResponseBuilder', () => {
    let builder: ToolResponseBuilder;

    beforeEach(() => {
      builder = ToolResponseBuilder.create();
    });

    it('should create a new builder instance', () => {
      expect(builder).toBeInstanceOf(ToolResponseBuilder);
    });

    it('should build basic successful response', () => {
      const result = builder
        .withToolName('TestTool')
        .withOutput('test output')
        .build();

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('TestTool');
      expect(result.output).toBe('test output');
      expect(result.invokedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should build error response', () => {
      const result = builder
        .withToolName('ErrorTool')
        .withError('Something went wrong')
        .build();

      expect(result.success).toBe(false);
      expect(result.toolName).toBe('ErrorTool');
      expect(result.error).toBe('Something went wrong');
    });

    it('should set custom timestamps and calculate duration', () => {
      const invokedAt = new Date('2024-01-01T10:00:00Z');
      const completedAt = new Date('2024-01-01T10:00:05Z');

      const result = builder
        .withTimestamps(invokedAt, completedAt)
        .build();

      expect(result.invokedAt).toEqual(invokedAt);
      expect(result.completedAt).toEqual(completedAt);
      expect(result.duration).toBe(5000); // 5 seconds
    });

    it('should add and merge metadata', () => {
      const result = builder
        .withMetadata({ version: '1.0', type: 'test' })
        .addMetadata('extra', 'value')
        .build();

      expect(result.metadata).toEqual({
        version: '1.0',
        type: 'test',
        extra: 'value'
      });
    });

    describe('Tool-specific response methods', () => {
      it('should create file read response', () => {
        const result = builder
          .asFileRead('Hello, World!', '/test/file.txt')
          .build();

        expect(result.toolName).toBe('Read');
        expect(result.success).toBe(true);
        expect(result.output).toEqual({
          content: 'Hello, World!',
          encoding: 'utf-8',
          size: 13,
          path: '/test/file.txt'
        });
      });

      it('should create file write response', () => {
        const result = builder
          .asFileWrite('/test/output.txt', 1024)
          .build();

        expect(result.toolName).toBe('Write');
        expect(result.success).toBe(true);
        expect(result.output).toEqual({
          written: true,
          path: '/test/output.txt',
          size: 1024
        });
      });

      it('should create bash execution response', () => {
        const result = builder
          .asBashExecution('echo "hello"', 'hello\n', 0)
          .build();

        expect(result.toolName).toBe('Bash');
        expect(result.success).toBe(true);
        expect(result.output).toEqual({
          stdout: 'hello\n',
          stderr: '',
          exitCode: 0,
          command: 'echo "hello"'
        });
      });

      it('should create bash error response', () => {
        const result = builder
          .asBashExecution('invalid-command', '', 127)
          .build();

        expect(result.toolName).toBe('Bash');
        expect(result.success).toBe(false);
      });

      it('should create glob result response', () => {
        const matches = ['/src/file1.ts', '/src/file2.ts'];
        const result = builder
          .asGlobResult('**/*.ts', matches)
          .build();

        expect(result.toolName).toBe('Glob');
        expect(result.output).toEqual({
          matches,
          pattern: '**/*.ts',
          count: 2
        });
      });

      it('should create grep result response', () => {
        const matches = [
          { file: '/src/test.ts', line: 10, content: 'const test = "hello";' },
          { file: '/src/app.ts', line: 5, content: 'test("description", () => {' }
        ];
        const result = builder
          .asGrepResult('test', matches)
          .build();

        expect(result.toolName).toBe('Grep');
        expect(result.output).toEqual({
          matches,
          pattern: 'test',
          totalMatches: 2
        });
      });

      it('should create web fetch response', () => {
        const result = builder
          .asWebFetch('https://example.com', '<html>Hello</html>', 200)
          .build();

        expect(result.toolName).toBe('WebFetch');
        expect(result.success).toBe(true);
        expect(result.output).toEqual({
          content: '<html>Hello</html>',
          statusCode: 200,
          url: 'https://example.com',
          contentType: 'text/html',
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'content-length': '18'
          }
        });
      });

      it('should create web fetch error response for 4xx status', () => {
        const result = builder
          .asWebFetch('https://example.com/notfound', 'Not Found', 404)
          .build();

        expect(result.toolName).toBe('WebFetch');
        expect(result.success).toBe(false);
        expect(result.output.statusCode).toBe(404);
      });
    });

    describe('Builder state management', () => {
      it('should clone builder state', () => {
        const original = builder
          .withToolName('Original')
          .withOutput('original output');

        const cloned = original.clone()
          .withToolName('Cloned')
          .withOutput('cloned output');

        const originalResult = original.build();
        const clonedResult = cloned.build();

        expect(originalResult.toolName).toBe('Original');
        expect(originalResult.output).toBe('original output');
        expect(clonedResult.toolName).toBe('Cloned');
        expect(clonedResult.output).toBe('cloned output');
      });

      it('should reset builder state', () => {
        const result1 = builder
          .withToolName('Tool1')
          .withError('Error1')
          .build();

        const result2 = builder
          .reset()
          .withToolName('Tool2')
          .withOutput('Output2')
          .build();

        expect(result1.success).toBe(false);
        expect(result1.error).toBe('Error1');
        expect(result2.success).toBe(true);
        expect(result2.output).toBe('Output2');
        expect(result2.error).toBeUndefined();
      });
    });
  });

  describe('ToolExecutionBuilder', () => {
    let builder: ToolExecutionBuilder;

    beforeEach(() => {
      builder = ToolExecutionBuilder.create();
    });

    it('should create a new builder instance', () => {
      expect(builder).toBeInstanceOf(ToolExecutionBuilder);
    });

    it('should build basic execution', () => {
      const result = builder
        .withCallId('call-123')
        .withToolName('TestTool')
        .withInput({ param: 'value' })
        .build();

      expect(result.callId).toBe('call-123');
      expect(result.toolName).toBe('TestTool');
      expect(result.input).toEqual({ param: 'value' });
      expect(result.status).toBe('completed');
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should build with task and agent context', () => {
      const result = builder
        .withTaskId('task-456')
        .withAgentName('test-agent')
        .withStageName('test-stage')
        .build();

      expect(result.taskId).toBe('task-456');
      expect(result.agentName).toBe('test-agent');
      expect(result.stageName).toBe('test-stage');
    });

    it('should set execution result', () => {
      const result = builder
        .withSuccessResult({ data: 'success' })
        .build();

      expect(result.result).toEqual({
        success: true,
        output: { data: 'success' }
      });
    });

    it('should set failure result and update status', () => {
      const result = builder
        .withFailureResult('Execution failed')
        .build();

      expect(result.result).toEqual({
        success: false,
        error: 'Execution failed'
      });
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Execution failed');
    });

    it('should configure as running execution', () => {
      const result = builder
        .asRunning()
        .build();

      expect(result.status).toBe('running');
      expect(result.endTime).toBeUndefined();
      expect(result.duration).toBeUndefined();
      expect(result.result).toBeUndefined();
    });

    it('should add input parameters incrementally', () => {
      const result = builder
        .addInput('param1', 'value1')
        .addInput('param2', 'value2')
        .withInput({ param3: 'value3' })
        .build();

      expect(result.input).toEqual({
        param1: 'value1',
        param2: 'value2',
        param3: 'value3'
      });
    });

    it('should set custom timestamps with duration calculation', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:00:03Z');

      const result = builder
        .withStartTime(startTime)
        .withEndTime(endTime)
        .build();

      expect(result.startTime).toEqual(startTime);
      expect(result.endTime).toEqual(endTime);
      expect(result.duration).toBe(3000); // 3 seconds
    });

    describe('Tool-specific execution methods', () => {
      it('should create file read execution', () => {
        const result = builder
          .asFileReadExecution('/test/file.txt')
          .build();

        expect(result.toolName).toBe('Read');
        expect(result.input).toEqual({ file_path: '/test/file.txt' });
        expect(result.result.success).toBe(true);
        expect(result.result.output).toEqual({ content: 'File content' });
      });

      it('should create failed file read execution', () => {
        const result = builder
          .asFileReadExecution('/nonexistent.txt', false)
          .build();

        expect(result.toolName).toBe('Read');
        expect(result.result.success).toBe(false);
        expect(result.result.error).toBe('File not found');
      });

      it('should create bash execution', () => {
        const result = builder
          .asBashExecution('echo "hello"', 0)
          .build();

        expect(result.toolName).toBe('Bash');
        expect(result.input).toEqual({ command: 'echo "hello"' });
        expect(result.result.success).toBe(true);
        expect(result.result.output).toEqual({
          exitCode: 0,
          stdout: 'Command executed',
          stderr: ''
        });
      });

      it('should create failed bash execution', () => {
        const result = builder
          .asBashExecution('invalid-command', 127)
          .build();

        expect(result.result.success).toBe(false);
        expect(result.result.output.exitCode).toBe(127);
      });
    });

    describe('Builder state management', () => {
      it('should clone builder state with deep copy', () => {
        const original = builder
          .withInput({ original: 'value' })
          .withMetadata({ type: 'original' });

        const cloned = original.clone()
          .addInput('cloned', 'value')
          .addMetadata('type', 'cloned');

        const originalResult = original.build();
        const clonedResult = cloned.build();

        expect(originalResult.input).toEqual({ original: 'value' });
        expect(originalResult.metadata.type).toBe('original');
        expect(clonedResult.input).toEqual({ original: 'value', cloned: 'value' });
        expect(clonedResult.metadata.type).toBe('cloned');
      });

      it('should reset builder state', () => {
        const result1 = builder
          .withToolName('Tool1')
          .withFailureResult('Error1')
          .build();

        const result2 = builder
          .reset()
          .withToolName('Tool2')
          .withSuccessResult('Success2')
          .build();

        expect(result1.result.success).toBe(false);
        expect(result1.status).toBe('failed');
        expect(result2.result.success).toBe(true);
        expect(result2.status).toBe('completed');
      });
    });
  });

  describe('ResponseBuilders convenience functions', () => {
    it('should create success response', () => {
      const result = ResponseBuilders.success('TestTool', { data: 'test' }).build();

      expect(result.toolName).toBe('TestTool');
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ data: 'test' });
    });

    it('should create failure response', () => {
      const result = ResponseBuilders.failure('ErrorTool', 'Test error').build();

      expect(result.toolName).toBe('ErrorTool');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should create file read response', () => {
      const result = ResponseBuilders.fileRead('content', '/path').build();

      expect(result.toolName).toBe('Read');
      expect(result.output.content).toBe('content');
      expect(result.output.path).toBe('/path');
    });

    it('should create file write response', () => {
      const result = ResponseBuilders.fileWrite('/path', 1024).build();

      expect(result.toolName).toBe('Write');
      expect(result.output.path).toBe('/path');
      expect(result.output.size).toBe(1024);
    });

    it('should create bash response', () => {
      const result = ResponseBuilders.bash('echo test', 'test\n').build();

      expect(result.toolName).toBe('Bash');
      expect(result.output.command).toBe('echo test');
      expect(result.output.stdout).toBe('test\n');
    });

    it('should create glob response', () => {
      const matches = ['file1.ts', 'file2.ts'];
      const result = ResponseBuilders.glob('*.ts', matches).build();

      expect(result.toolName).toBe('Glob');
      expect(result.output.pattern).toBe('*.ts');
      expect(result.output.matches).toEqual(matches);
    });

    it('should create grep response', () => {
      const matches = [{ file: 'test.ts', line: 1, content: 'test' }];
      const result = ResponseBuilders.grep('pattern', matches).build();

      expect(result.toolName).toBe('Grep');
      expect(result.output.pattern).toBe('pattern');
      expect(result.output.matches).toEqual(matches);
    });

    it('should create web fetch response', () => {
      const result = ResponseBuilders.webFetch('http://test.com', 'content').build();

      expect(result.toolName).toBe('WebFetch');
      expect(result.output.url).toBe('http://test.com');
      expect(result.output.content).toBe('content');
    });
  });

  describe('ExecutionBuilders convenience functions', () => {
    it('should create completed execution', () => {
      const result = ExecutionBuilders.completed(
        'TestTool',
        { param: 'value' },
        { result: 'success' }
      ).build();

      expect(result.toolName).toBe('TestTool');
      expect(result.input).toEqual({ param: 'value' });
      expect(result.result.success).toBe(true);
      expect(result.result.output).toEqual({ result: 'success' });
    });

    it('should create failed execution', () => {
      const result = ExecutionBuilders.failed(
        'ErrorTool',
        { param: 'value' },
        'Error message'
      ).build();

      expect(result.toolName).toBe('ErrorTool');
      expect(result.input).toEqual({ param: 'value' });
      expect(result.result.success).toBe(false);
      expect(result.result.error).toBe('Error message');
      expect(result.status).toBe('failed');
    });

    it('should create running execution', () => {
      const result = ExecutionBuilders.running(
        'RunningTool',
        { param: 'value' }
      ).build();

      expect(result.toolName).toBe('RunningTool');
      expect(result.input).toEqual({ param: 'value' });
      expect(result.status).toBe('running');
      expect(result.result).toBeUndefined();
    });

    it('should create file read execution', () => {
      const result = ExecutionBuilders.fileRead('/test/file.txt').build();

      expect(result.toolName).toBe('Read');
      expect(result.input).toEqual({ file_path: '/test/file.txt' });
      expect(result.result.success).toBe(true);
    });

    it('should create bash execution', () => {
      const result = ExecutionBuilders.bash('echo test').build();

      expect(result.toolName).toBe('Bash');
      expect(result.input).toEqual({ command: 'echo test' });
      expect(result.result.success).toBe(true);
    });
  });
});