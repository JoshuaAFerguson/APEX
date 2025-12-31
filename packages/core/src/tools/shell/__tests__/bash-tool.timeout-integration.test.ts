/**
 * @fileoverview Integration tests for BashTool timeout functionality
 * Validates all acceptance criteria in real-world scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BashTool } from '../bash-tool.js';
import type { BashToolInput } from '../bash-tool.js';

describe('BashTool Timeout Integration Tests', () => {
  let bashTool: BashTool;

  beforeEach(() => {
    bashTool = new BashTool();
  });

  describe('acceptance criteria validation', () => {
    it('AC1: BashTool accepts optional timeout parameter with default 120s and max 600s', async () => {
      // Test default timeout is 120s
      const definition = bashTool.getDefinition();
      expect(definition.parameters.properties.timeout.description).toContain('120000ms');

      // Test parameter is optional
      const inputWithoutTimeout: BashToolInput = {
        command: 'echo "no timeout specified"'
      };
      const validationWithoutTimeout = bashTool.validate(inputWithoutTimeout);
      expect(validationWithoutTimeout.valid).toBe(true);

      // Test execution without timeout uses default
      const resultWithoutTimeout = await bashTool.execute(inputWithoutTimeout);
      expect(resultWithoutTimeout.success).toBe(true);

      // Test parameter accepts valid values
      const inputWithTimeout: BashToolInput = {
        command: 'echo "with timeout"',
        timeout: 30000 // 30 seconds
      };
      const validationWithTimeout = bashTool.validate(inputWithTimeout);
      expect(validationWithTimeout.valid).toBe(true);

      const resultWithTimeout = await bashTool.execute(inputWithTimeout);
      expect(resultWithTimeout.success).toBe(true);

      // Test max timeout validation
      const inputMaxTimeout: BashToolInput = {
        command: 'echo "max timeout"',
        timeout: 600000 // 600 seconds (max allowed)
      };
      const validationMaxTimeout = bashTool.validate(inputMaxTimeout);
      expect(validationMaxTimeout.valid).toBe(true);

      // Test exceeding max timeout
      const inputExceedsMax: BashToolInput = {
        command: 'echo "exceeds max"',
        timeout: 700000 // 700 seconds (exceeds max)
      };
      const validationExceedsMax = bashTool.validate(inputExceedsMax);
      expect(validationExceedsMax.valid).toBe(false);
      expect(validationExceedsMax.errors).toContain('timeout cannot exceed 600000ms');
    });

    it('AC2: Kills process on timeout with appropriate error and partial output', async () => {
      const input: BashToolInput = {
        command: 'echo "before sleep"; sleep 5; echo "after sleep"',
        timeout: 2500 // Should timeout after capturing first echo
      };

      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      // Verify process was killed due to timeout
      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(duration).toBeGreaterThan(2500); // Should timeout after specified time
      expect(duration).toBeLessThan(4000); // But well before the full sleep completes

      // Verify appropriate error message
      expect(result.output!.stderr).toContain('timed out');
      expect(result.output!.exitCode).toBe(-1);

      // Verify partial output was captured
      expect(result.output!.stdout).toContain('before sleep');
      expect(result.output!.stdout).not.toContain('after sleep'); // Should not complete
    }, 15000);

    it('AC3: Respects AbortSignal from execution context', async () => {
      const controller = new AbortController();
      const input: BashToolInput = {
        command: 'sleep 10',
        timeout: 15000 // Long timeout, but should abort via signal
      };

      // Set up abort signal
      const abortPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          controller.abort();
          resolve();
        }, 1000);
      });

      const startTime = Date.now();

      // Execute with abort signal
      const [result] = await Promise.all([
        bashTool.execute(input, { signal: controller.signal }),
        abortPromise
      ]);

      const duration = Date.now() - startTime;

      // Verify abort signal was respected
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
      expect(duration).toBeLessThan(3000); // Should abort quickly, not timeout

      // Test pre-aborted signal
      const preAbortedController = new AbortController();
      preAbortedController.abort();

      const preAbortedResult = await bashTool.execute(input, {
        signal: preAbortedController.signal
      });

      expect(preAbortedResult.success).toBe(false);
      expect(preAbortedResult.error).toContain('cancelled');
    }, 15000);

    it('AC4: End-to-end workflow with all timeout features', async () => {
      // Test scenario: A command that outputs progressively but takes too long
      const progressiveCommand = `
        for i in $(seq 1 10); do
          echo "Progress step $i" >&2
          echo "Data line $i"
          sleep 0.8
        done
        echo "Final result"
      `;

      const input: BashToolInput = {
        command: progressiveCommand,
        timeout: 5000, // 5 second timeout - should capture first ~6 steps
        description: 'Progressive output test with timeout'
      };

      // Validate input first
      const validation = bashTool.validate(input);
      expect(validation.valid).toBe(true);

      // Execute and verify timeout behavior
      const startTime = Date.now();
      const result = await bashTool.execute(input);
      const duration = Date.now() - startTime;

      // Should timeout
      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(duration).toBeGreaterThan(5000);
      expect(duration).toBeLessThan(8000);

      // Should capture partial output
      expect(result.output!.stdout).toContain('Data line 1');
      expect(result.output!.stderr).toContain('Progress step 1');
      expect(result.output!.stderr).toContain('timed out');

      // Should NOT contain final output
      expect(result.output!.stdout).not.toContain('Final result');

      // Should have proper metadata
      expect(result.output!.command).toBe(progressiveCommand);
      expect(result.output!.duration).toBeGreaterThan(5000);
      expect(result.output!.exitCode).toBe(-1);
      expect(result.output!.pid).toBeDefined();
    }, 15000);
  });

  describe('real-world timeout scenarios', () => {
    it('should handle long-running build commands with timeout', async () => {
      // Simulate a build that gets stuck
      const input: BashToolInput = {
        command: 'echo "Build started"; sleep 1; echo "Compiling..."; sleep 10; echo "Build complete"',
        timeout: 3000,
        description: 'Build command with timeout'
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.stdout).toContain('Build started');
      expect(result.output!.stdout).toContain('Compiling...');
      expect(result.output!.stdout).not.toContain('Build complete');
    }, 10000);

    it('should handle network operations with timeout', async () => {
      // Simulate network operation that hangs
      const input: BashToolInput = {
        command: 'echo "Starting download"; sleep 0.5; echo "Progress 50%"; sleep 10; echo "Download complete"',
        timeout: 2000,
        description: 'Network operation with timeout'
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.stdout).toContain('Starting download');
      expect(result.output!.stdout).toContain('Progress 50%');
    }, 10000);

    it('should handle test suite that runs too long', async () => {
      // Simulate test suite with one hanging test
      const input: BashToolInput = {
        command: `
          echo "Running test suite..."
          echo "✓ Test 1 passed"
          echo "✓ Test 2 passed"
          sleep 0.5
          echo "✓ Test 3 passed"
          sleep 10
          echo "✓ Test 4 passed"
        `,
        timeout: 2500,
        description: 'Test suite with hanging test'
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.stdout).toContain('Running test suite...');
      expect(result.output!.stdout).toContain('✓ Test 1 passed');
      expect(result.output!.stdout).toContain('✓ Test 2 passed');
      expect(result.output!.stdout).toContain('✓ Test 3 passed');
      expect(result.output!.stdout).not.toContain('✓ Test 4 passed');
    }, 10000);
  });

  describe('timeout interaction with other features', () => {
    it('should handle timeout with custom working directory', async () => {
      const input: BashToolInput = {
        command: 'pwd; sleep 5',
        timeout: 2000
      };

      const result = await bashTool.execute(input, {
        workingDirectory: '/tmp'
      });

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.stdout).toContain('/tmp');
    }, 10000);

    it('should handle timeout with environment variables', async () => {
      const input: BashToolInput = {
        command: 'echo "User: $TEST_USER"; sleep 5',
        timeout: 2000
      };

      const result = await bashTool.execute(input, {
        environment: { TEST_USER: 'testuser' }
      });

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.stdout).toContain('User: testuser');
    }, 10000);

    it('should handle background execution flag with timeout', async () => {
      const input: BashToolInput = {
        command: 'echo "Background process"; sleep 5',
        timeout: 2000,
        run_in_background: true
      };

      const result = await bashTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.output!.timedOut).toBe(true);
      expect(result.output!.stdout).toContain('Background process');
    }, 10000);
  });
});