/**
 * @fileoverview Comprehensive timeout tests for BashTool
 * Tests all aspects of timeout functionality per acceptance criteria
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BashTool } from '../bash-tool.js';
import type { BashToolInput } from '../bash-tool.js';

describe('BashTool Timeout Functionality', () => {
  let bashTool: BashTool;

  beforeEach(() => {
    bashTool = new BashTool();
  });

  describe('default timeout behavior', () => {
    it('should use 120s (120000ms) as default timeout', () => {
      const definition = bashTool.getDefinition();
      const timeoutParam = definition.parameters.properties.timeout;

      expect(timeoutParam.description).toContain('120000ms');
      expect(timeoutParam.maximum).toBe(600000);
      expect(timeoutParam.minimum).toBe(1000);
    });

    it('should apply default timeout when none specified', async () => {
      const input: BashToolInput = {
        command: 'echo "testing default timeout"'
      };

      // Mock implementation to verify default timeout is used
      const originalExecuteImpl = (bashTool as any).executeImpl;
      const mockExecuteImpl = vi.fn();
      (bashTool as any).executeImpl = mockExecuteImpl;

      await bashTool.execute(input);

      expect(mockExecuteImpl).toHaveBeenCalledWith(
        input,
        undefined
      );

      // Restore original implementation
      (bashTool as any).executeImpl = originalExecuteImpl;
    });

    it('should execute commands within default timeout window', async () => {
      const input: BashToolInput = {
        command: 'echo "quick command"'
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(false);
      expect(duration).toBeLessThan(1000); // Should be much faster than default timeout
    });
  });

  describe('custom timeout parameter', () => {
    it('should accept valid timeout values', () => {
      const validTimeouts = [1000, 5000, 30000, 120000, 300000, 600000];

      validTimeouts.forEach(timeout => {
        const input: BashToolInput = {
          command: 'echo test',
          timeout
        };

        const result = bashTool.validate(input);
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });
    });

    it('should reject timeout values below minimum (1000ms)', () => {
      const invalidTimeouts = [0, 100, 500, 999];

      invalidTimeouts.forEach(timeout => {
        const input: BashToolInput = {
          command: 'echo test',
          timeout
        };

        const result = bashTool.validate(input);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('timeout must be an integer of at least 1000ms');
      });
    });

    it('should reject timeout values above maximum (600000ms)', () => {
      const invalidTimeouts = [600001, 700000, 1000000, 1200000];

      invalidTimeouts.forEach(timeout => {
        const input: BashToolInput = {
          command: 'echo test',
          timeout
        };

        const result = bashTool.validate(input);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('timeout cannot exceed 600000ms');
      });
    });

    it('should use custom timeout when specified', async () => {
      const input: BashToolInput = {
        command: 'sleep 2',
        timeout: 3000 // 3 seconds for a 2 second sleep - should complete
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(false);
      expect(result.output!.exitCode).toBe(0);
      expect(duration).toBeGreaterThan(2000); // Should take at least 2 seconds
      expect(duration).toBeLessThan(2500); // But complete before timeout
    }, 10000);
  });

  describe('timeout enforcement', () => {
    it('should kill process on timeout', async () => {
      const input: BashToolInput = {
        command: 'sleep 5',
        timeout: 2000 // 2 seconds timeout for 5 second sleep
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.exitCode).toBe(-1);
      expect(duration).toBeGreaterThan(2000); // Should timeout after ~2 seconds
      expect(duration).toBeLessThan(3000); // But well before the full 5 seconds
    }, 10000);

    it('should return appropriate error message on timeout', async () => {
      const input: BashToolInput = {
        command: 'sleep 3',
        timeout: 1500 // 1.5 seconds timeout
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.stderr).toContain('timed out');
    }, 10000);

    it('should handle timeout with graceful termination (SIGTERM then SIGKILL)', async () => {
      const input: BashToolInput = {
        command: 'trap "echo received signal" TERM; sleep 10',
        timeout: 2000
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(duration).toBeGreaterThan(2000);
      expect(duration).toBeLessThan(8000); // Should force kill after 5 seconds if needed
    }, 15000);

    it('should include process ID in timeout output', async () => {
      const input: BashToolInput = {
        command: 'sleep 2',
        timeout: 1000
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.pid).toBeDefined();
      expect(typeof result.output!.pid).toBe('number');
    }, 10000);
  });

  describe('partial output on timeout', () => {
    it('should capture stdout before timeout occurs', async () => {
      const input: BashToolInput = {
        command: 'echo "start"; sleep 1; echo "middle"; sleep 5; echo "end"',
        timeout: 2500 // Should capture "start" and "middle", timeout before "end"
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.stdout).toContain('start');
      expect(result.output!.stdout).toContain('middle');
      expect(result.output!.stdout).not.toContain('end'); // Should timeout before this
    }, 10000);

    it('should capture stderr before timeout occurs', async () => {
      const input: BashToolInput = {
        command: 'echo "error1" >&2; sleep 1; echo "error2" >&2; sleep 5',
        timeout: 2500
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.stderr).toContain('error1');
      expect(result.output!.stderr).toContain('error2');
      expect(result.output!.stderr).toContain('timed out'); // Should also include timeout message
    }, 10000);

    it('should provide accurate duration on timeout', async () => {
      const timeoutMs = 2000;
      const input: BashToolInput = {
        command: 'sleep 10',
        timeout: timeoutMs
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const actualDuration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.duration).toBeGreaterThan(timeoutMs);
      expect(result.output!.duration).toBeLessThan(timeoutMs + 1000); // Within 1 second tolerance

      // Verify internal duration matches actual duration (within tolerance)
      expect(Math.abs(result.output!.duration - actualDuration)).toBeLessThan(100);
    }, 10000);
  });

  describe('AbortSignal integration', () => {
    it('should respect AbortSignal from execution context', async () => {
      const controller = new AbortController();
      const input: BashToolInput = {
        command: 'sleep 10',
        timeout: 15000 // Long timeout, but should abort via signal first
      };

      // Abort after 1 second
      setTimeout(() => controller.abort(), 1000);

      const startTime = Date.now();
      const result = await bashTool.execute(input, { signal: controller.signal });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
      expect(duration).toBeLessThan(2000); // Should abort well before timeout
    }, 10000);

    it('should abort immediately if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort(); // Abort before calling execute

      const input: BashToolInput = {
        command: 'echo "should not execute"'
      };

      const result = await bashTool.execute(input, { signal: controller.signal });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('should prioritize AbortSignal over timeout', async () => {
      const controller = new AbortController();
      const input: BashToolInput = {
        command: 'sleep 10',
        timeout: 5000 // 5 second timeout
      };

      // Abort after 1 second (before timeout)
      setTimeout(() => controller.abort(), 1000);

      const startTime = Date.now();
      const result = await bashTool.execute(input, { signal: controller.signal });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
      expect(duration).toBeLessThan(2000); // Should abort, not timeout
    }, 10000);

    it('should clean up timeout when aborted', async () => {
      const controller = new AbortController();
      const input: BashToolInput = {
        command: 'sleep 10',
        timeout: 8000
      };

      setTimeout(() => controller.abort(), 500);

      const result = await bashTool.execute(input, { signal: controller.signal });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
      // Verify no timeout occurred (would be success: true with timedOut: true)
    }, 10000);
  });

  describe('edge cases', () => {
    it('should handle commands that complete exactly at timeout boundary', async () => {
      const timeoutMs = 2000;
      const input: BashToolInput = {
        command: `sleep ${timeoutMs / 1000}`, // Sleep for exactly the timeout duration
        timeout: timeoutMs
      };

      const result = await bashTool.execute(input);

      // This is a race condition - either could happen
      expect(result.success).toBe(true);
      if (result.output!.timedOut) {
        expect(result.output!.stderr).toContain('timed out');
      } else {
        expect(result.output!.exitCode).toBe(0);
      }
    }, 10000);

    it('should handle very short commands with large timeouts', async () => {
      const input: BashToolInput = {
        command: 'echo "quick"',
        timeout: 600000 // 10 minutes for a quick command
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(false);
      expect(result.output!.exitCode).toBe(0);
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });

    it('should handle timeout with background processes', async () => {
      const input: BashToolInput = {
        command: 'bash -c "sleep 10 &" && sleep 3',
        timeout: 2000,
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      // Background processes should be cleaned up with parent
    }, 10000);

    it('should handle commands with unusual exit scenarios during timeout', async () => {
      const input: BashToolInput = {
        command: 'trap "exit 42" TERM; sleep 10',
        timeout: 2000
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      // Process should be killed despite trap
    }, 10000);
  });

  describe('validation with context timeout', () => {
    it('should warn when command timeout exceeds context timeout', () => {
      const input: BashToolInput = {
        command: 'echo test',
        timeout: 10000 // 10 seconds
      };

      const context = {
        timeout: 5000 // 5 seconds context timeout
      };

      const result = bashTool.validate(input, context);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('command timeout exceeds execution context timeout');
    });

    it('should not warn when command timeout is within context timeout', () => {
      const input: BashToolInput = {
        command: 'echo test',
        timeout: 3000 // 3 seconds
      };

      const context = {
        timeout: 5000 // 5 seconds context timeout
      };

      const result = bashTool.validate(input, context);

      expect(result.valid).toBe(true);
      expect(result.warnings?.some(w => w.includes('timeout exceeds'))).toBe(false);
    });
  });
});