/**
 * @fileoverview Unit tests for BashTool
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BashTool } from '../bash-tool.js';
import type { BashToolInput } from '../bash-tool.js';

describe('BashTool', () => {
  let bashTool: BashTool;

  beforeEach(() => {
    bashTool = new BashTool();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and metadata', () => {
    it('should create instance with correct metadata', () => {
      expect(bashTool.name).toBe('Bash');
      expect(bashTool.category).toBe('shell');
      expect(bashTool.enabled).toBe(true);

      const definition = bashTool.getDefinition();
      expect(definition.name).toBe('Bash');
      expect(definition.description).toContain('bash commands');
      expect(definition.dangerous).toBe(true);
      expect(definition.category).toBe('shell');
      expect(definition.permissions).toContain('execute');
    });

    it('should have proper parameter schema', () => {
      const definition = bashTool.getDefinition();
      const params = definition.parameters;

      expect(params.type).toBe('object');
      expect(params.required).toEqual(['command']);
      expect(params.properties.command).toEqual({
        type: 'string',
        description: 'The command to execute',
      });
      expect(params.properties.timeout).toEqual({
        type: 'integer',
        description: expect.stringContaining('timeout'),
        minimum: 1000,
        maximum: 600000,
      });
      expect(params.properties.description).toEqual({
        type: 'string',
        description: expect.stringContaining('description'),
      });
      expect(params.properties.run_in_background).toEqual({
        type: 'boolean',
        description: expect.stringContaining('background'),
      });
    });

    it('should include usage examples', () => {
      const definition = bashTool.getDefinition();
      expect(definition.examples).toBeDefined();
      expect(definition.examples!.length).toBeGreaterThan(0);

      const example = definition.examples![0];
      expect(example.name).toBeDefined();
      expect(example.input).toBeDefined();
      expect(example.input.command).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should validate valid basic input', () => {
      const input: BashToolInput = {
        command: 'echo "hello"',
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate valid input with all parameters', () => {
      const input: BashToolInput = {
        command: 'ls -la',
        timeout: 5000,
        description: 'List files with details',
        run_in_background: false,
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject empty command', () => {
      const input: BashToolInput = {
        command: '',
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('command cannot be empty or only whitespace');
    });

    it('should reject whitespace-only command', () => {
      const input: BashToolInput = {
        command: '   \t\n   ',
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('command cannot be empty or only whitespace');
    });

    it('should reject missing command', () => {
      const input = {} as BashToolInput;

      const result = bashTool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: command');
    });

    it('should reject timeout too small', () => {
      const input: BashToolInput = {
        command: 'echo test',
        timeout: 500,
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timeout must be an integer of at least 1000ms');
    });

    it('should reject timeout too large', () => {
      const input: BashToolInput = {
        command: 'echo test',
        timeout: 700000, // > 600000 max
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timeout cannot exceed 600000ms');
    });

    it('should reject non-integer timeout', () => {
      const input: BashToolInput = {
        command: 'echo test',
        timeout: 5000.5,
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timeout must be an integer of at least 1000ms');
    });

    it('should warn about dangerous commands', () => {
      const input: BashToolInput = {
        command: 'rm -rf *',
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Potentially dangerous command detected: rm - use with caution');
    });

    it('should warn about suspicious patterns', () => {
      const input: BashToolInput = {
        command: 'ls; rm important.txt',
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Command contains potentially suspicious patterns - review carefully');
    });

    it('should warn about empty description when provided', () => {
      const input: BashToolInput = {
        command: 'echo test',
        description: '   ',
      };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('description should not be empty if provided');
    });

    it('should handle unknown parameters', () => {
      const input = {
        command: 'echo test',
        unknown_param: 'value',
      } as BashToolInput & { unknown_param: string };

      const result = bashTool.validate(input);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Unknown parameter: unknown_param');
    });
  });

  describe('execution', () => {
    it('should execute simple command successfully', async () => {
      const input: BashToolInput = {
        command: 'echo "hello world"',
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.stdout).toContain('hello world');
      expect(result.output!.stderr).toBe('');
      expect(result.output!.exitCode).toBe(0);
      expect(result.output!.command).toBe('echo "hello world"');
      expect(result.output!.timedOut).toBe(false);
      expect(result.output!.duration).toBeGreaterThan(0);
    }, 10000);

    it('should handle commands with stderr output', async () => {
      const input: BashToolInput = {
        command: 'echo "error message" >&2',
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.stdout).toBe('');
      expect(result.output!.stderr).toContain('error message');
      expect(result.output!.exitCode).toBe(0);
    }, 10000);

    it('should handle command with non-zero exit code', async () => {
      const input: BashToolInput = {
        command: 'exit 42',
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.exitCode).toBe(42);
    }, 10000);

    it('should handle command timeout', async () => {
      const input: BashToolInput = {
        command: 'sleep 3',
        timeout: 1000,
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.stderr).toContain('timed out');
      expect(result.output!.duration).toBeGreaterThan(1000);
      expect(result.output!.duration).toBeLessThan(2000); // Should not wait full 3 seconds
    }, 15000);

    it('should handle validation failure', async () => {
      const input: BashToolInput = {
        command: '',
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(result.error).toContain('command cannot be empty');
    });

    it('should include timing metadata', async () => {
      const input: BashToolInput = {
        command: 'echo test',
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('Bash');
      expect(result.invokedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThan(0);
    }, 10000);

    it('should handle cancellation via abort signal', async () => {
      const controller = new AbortController();
      const input: BashToolInput = {
        command: 'sleep 5',
      };

      // Cancel after 100ms
      setTimeout(() => controller.abort(), 100);

      const result = await bashTool.execute(input, { signal: controller.signal });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    }, 5000);

    it('should handle already aborted signal', async () => {
      const controller = new AbortController();
      controller.abort(); // Abort immediately

      const input: BashToolInput = {
        command: 'echo test',
      };

      const result = await bashTool.execute(input, { signal: controller.signal });

      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
    });

    it('should respect working directory from context', async () => {
      const input: BashToolInput = {
        command: 'pwd',
      };

      const result = await bashTool.execute(input, {
        workingDirectory: '/tmp'
      });

      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('/tmp');
    }, 10000);

    it('should handle environment variables from context', async () => {
      const input: BashToolInput = {
        command: 'echo $TEST_VAR',
      };

      const result = await bashTool.execute(input, {
        environment: { TEST_VAR: 'hello_from_env' }
      });

      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('hello_from_env');
    }, 10000);
  });

  describe('edge cases', () => {
    it('should handle command with quotes and special characters', async () => {
      const input: BashToolInput = {
        command: 'echo "hello \\"world\\"" && echo \'test\'',
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('hello "world"');
      expect(result.output!.stdout).toContain('test');
    }, 10000);

    it('should handle very long output', async () => {
      const input: BashToolInput = {
        command: 'for i in {1..1000}; do echo "line $i"; done',
        timeout: 10000,
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.stdout).toContain('line 1');
      expect(result.output!.stdout).toContain('line 1000');
    }, 15000);

    it('should handle concurrent executions', async () => {
      const input1: BashToolInput = { command: 'echo "first"' };
      const input2: BashToolInput = { command: 'echo "second"' };
      const input3: BashToolInput = { command: 'echo "third"' };

      const [result1, result2, result3] = await Promise.all([
        bashTool.execute(input1),
        bashTool.execute(input2),
        bashTool.execute(input3),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      expect(result1.output!.stdout).toContain('first');
      expect(result2.output!.stdout).toContain('second');
      expect(result3.output!.stdout).toContain('third');
    }, 10000);
  });
});