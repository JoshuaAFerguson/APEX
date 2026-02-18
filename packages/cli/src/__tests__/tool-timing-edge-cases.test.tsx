import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { ToolCall } from '../ui/components/ToolCall.js';

/**
 * Edge case tests for tool timing display functionality
 *
 * Tests verify robust handling of:
 * - Invalid duration values
 * - Extreme durations
 * - Concurrent operations
 * - Performance under stress
 * - Error recovery
 */
describe('Tool Timing Edge Cases', () => {
  // Mock the ink-spinner component
  vi.mock('ink-spinner', () => ({
    default: () => '⠋',
  }));

  describe('Invalid Duration Values', () => {
    it('should handle NaN duration gracefully', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Read"
          status="success"
          duration={NaN}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Read');
      // Should either show NaN or handle gracefully without crashing
      expect(() => lastFrame()).not.toThrow();
    });

    it('should handle Infinity duration', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Write"
          status="success"
          duration={Infinity}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Write');
      expect(() => lastFrame()).not.toThrow();
    });

    it('should handle negative Infinity duration', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Edit"
          status="success"
          duration={-Infinity}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Edit');
      expect(() => lastFrame()).not.toThrow();
    });

    it('should handle negative durations', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Bash"
          status="success"
          duration={-1000}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Bash');
      expect(() => lastFrame()).not.toThrow();
    });
  });

  describe('Extreme Duration Values', () => {
    it('should handle very small positive durations', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="FastOp"
          status="success"
          duration={0.1}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('FastOp');
      expect(() => lastFrame()).not.toThrow();
    });

    it('should handle maximum safe integer duration', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="ExtremeLongOp"
          status="success"
          duration={Number.MAX_SAFE_INTEGER}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('ExtremeLongOp');
      expect(() => lastFrame()).not.toThrow();
    });

    it('should handle minimum safe integer duration', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="NegativeOp"
          status="success"
          duration={Number.MIN_SAFE_INTEGER}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('NegativeOp');
      expect(() => lastFrame()).not.toThrow();
    });

    it('should handle floating point precision edge cases', () => {
      const precisionCases = [
        0.1 + 0.2, // Known floating point precision issue
        1000.9999999,
        999.0000001,
        59999.999999,
        3599999.999999,
      ];

      precisionCases.forEach((duration, index) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={`PrecisionTest${index}`}
            status="success"
            duration={duration}
            displayMode="normal"
          />
        );

        const output = lastFrame();
        expect(() => lastFrame()).not.toThrow();
      });
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle exact boundary values correctly', () => {
      const boundaries = [
        { duration: 999, expectFormat: /\d+ms/ },
        { duration: 1000, expectFormat: /\d+\.\d+s/ },
        { duration: 59999, expectFormat: /\d+\.\d+s/ },
        { duration: 60000, expectFormat: /\d+m \d+s/ },
        { duration: 3599999, expectFormat: /\d+m \d+s/ },
        { duration: 3600000, expectFormat: /\d+h \d+m/ },
      ];

      boundaries.forEach(({ duration, expectFormat }, index) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={`Boundary${index}`}
            status="success"
            duration={duration}
            displayMode="normal"
          />
        );

        const output = lastFrame();
        expect(output).toMatch(expectFormat);
      });
    });

    it('should handle values just above boundaries', () => {
      const justAbove = [
        { duration: 1000.1, expectFormat: /\d+\.\d+s/ },
        { duration: 60000.1, expectFormat: /\d+m \d+s/ },
        { duration: 3600000.1, expectFormat: /\d+h \d+m/ },
      ];

      justAbove.forEach(({ duration, expectFormat }, index) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={`JustAbove${index}`}
            status="success"
            duration={duration}
            displayMode="normal"
          />
        );

        const output = lastFrame();
        expect(output).toMatch(expectFormat);
      });
    });
  });

  describe('Concurrent Operation Simulation', () => {
    it('should handle multiple tool components with different timings', () => {
      const operations = Array.from({ length: 20 }, (_, i) => ({
        toolName: `Tool${i}`,
        duration: Math.random() * 10000, // Random duration 0-10s
        status: 'success' as const,
      }));

      const results = operations.map(({ toolName, duration, status }) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={toolName}
            status={status}
            duration={duration}
            displayMode="compact"
          />
        );
        return lastFrame();
      });

      // All should render without errors
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should handle rapid state changes with timing updates', () => {
      const states: Array<{ status: 'pending' | 'running' | 'success'; duration?: number }> = [
        { status: 'pending' },
        { status: 'running' },
        { status: 'success', duration: 1500 },
      ];

      states.forEach(({ status, duration }) => {
        const { lastFrame } = render(
          <ToolCall
            toolName="RapidChange"
            status={status}
            duration={duration}
            displayMode="normal"
          />
        );

        const output = lastFrame();
        expect(output).toContain('RapidChange');
        expect(() => lastFrame()).not.toThrow();
      });
    });
  });

  describe('Memory and Performance Stress Tests', () => {
    it('should handle many rapid re-renders with different durations', () => {
      const durations = Array.from({ length: 100 }, () => Math.random() * 60000);

      const startTime = Date.now();
      durations.forEach((duration, index) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={`StressTest${index % 10}`}
            status="success"
            duration={duration}
            displayMode="compact"
          />
        );
        lastFrame(); // Force render
      });
      const endTime = Date.now();

      // Should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle very long tool names with timing', () => {
      const longToolName = 'A'.repeat(100);
      const { lastFrame } = render(
        <ToolCall
          toolName={longToolName}
          status="success"
          duration={1234}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('(1.2s)');
      expect(output.length).toBeLessThan(200); // Should not be excessively long
    });

    it('should handle tools with very large input objects', () => {
      const largeInput = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`param${i}`, `value${i}`.repeat(10)])
      );

      const { lastFrame } = render(
        <ToolCall
          toolName="LargeInput"
          status="success"
          duration={5000}
          displayMode="compact"
          input={largeInput}
        />
      );

      const output = lastFrame();
      expect(output).toContain('LargeInput');
      expect(output).toContain('5.0s');
      expect(() => lastFrame()).not.toThrow();
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should handle tools that fail with timing information', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="FailedTool"
          status="error"
          duration={2500}
          displayMode="normal"
          output="Error: Operation failed after significant time"
        />
      );

      const output = lastFrame();
      expect(output).toContain('FailedTool');
      expect(output).toContain('(2.5s)');
      expect(output).toContain('✗'); // Error icon
    });

    it('should handle incomplete or corrupted duration data', () => {
      const corruptedValues = [
        undefined,
        null,
        '',
        '1000',
        {},
        [],
        true,
        false,
      ];

      corruptedValues.forEach((value, index) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={`Corrupted${index}`}
            status="success"
            duration={value as any}
            displayMode="normal"
          />
        );

        expect(() => lastFrame()).not.toThrow();
      });
    });

    it('should handle tools with extremely long output and timing', () => {
      const extremelyLongOutput = 'x'.repeat(100000);
      const { lastFrame } = render(
        <ToolCall
          toolName="VerboseTool"
          status="success"
          duration={15000}
          displayMode="verbose"
          output={extremelyLongOutput}
        />
      );

      const output = lastFrame();
      expect(output).toContain('VerboseTool');
      expect(output).toContain('(15.0s)');
      expect(() => lastFrame()).not.toThrow();
    });
  });

  describe('Unicode and Special Character Handling', () => {
    it('should handle timing display with Unicode tool names', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="Tool🚀"
          status="success"
          duration={1000}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Tool🚀');
      expect(output).toContain('(1.0s)');
    });

    it('should handle timing with special characters in input', () => {
      const { lastFrame } = render(
        <ToolCall
          toolName="SpecialChars"
          status="success"
          duration={500}
          displayMode="normal"
          input={{
            pattern: '*.{js,ts}',
            content: 'Hello 世界 💻',
          }}
        />
      );

      const output = lastFrame();
      expect(output).toContain('SpecialChars');
      expect(output).toContain('(500ms)');
      expect(output).toContain('pattern');
    });
  });

  describe('Platform-specific Edge Cases', () => {
    it('should handle high-resolution timer values', () => {
      // Simulate high-resolution timer output
      const highResValues = [
        123.456789,
        1000.123456,
        59999.987654,
      ];

      highResValues.forEach((duration, index) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={`HighRes${index}`}
            status="success"
            duration={duration}
            displayMode="normal"
          />
        );

        const output = lastFrame();
        expect(() => lastFrame()).not.toThrow();
        expect(output).toContain(`HighRes${index}`);
      });
    });

    it('should handle timing during system time changes', () => {
      // Simulate potential timestamp issues
      const timestampEdgeCases = [
        0,
        -0,
        Date.now(),
        Date.now() + 86400000, // Tomorrow
        1, // Epoch + 1ms
      ];

      timestampEdgeCases.forEach((duration, index) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={`TimeEdge${index}`}
            status="success"
            duration={duration}
            displayMode="normal"
          />
        );

        expect(() => lastFrame()).not.toThrow();
      });
    });
  });

  describe('Integration with Complex Tool Scenarios', () => {
    it('should handle nested tool calls with timing', () => {
      // Simulate a complex operation with multiple phases
      const phases = [
        { name: 'Validation', duration: 100 },
        { name: 'Processing', duration: 2500 },
        { name: 'Cleanup', duration: 300 },
      ];

      phases.forEach(({ name, duration }) => {
        const { lastFrame } = render(
          <ToolCall
            toolName={name}
            status="success"
            duration={duration}
            displayMode="verbose"
            input={{ phase: name.toLowerCase() }}
            output={`${name} completed successfully`}
          />
        );

        const output = lastFrame();
        expect(output).toContain(name);
        if (duration < 1000) {
          expect(output).toContain(`${duration}ms`);
        } else {
          expect(output).toMatch(/\d+\.\d+s/);
        }
      });
    });

    it('should handle tool chains with cumulative timing', () => {
      let cumulativeDuration = 0;
      const chain = [
        'Initialize',
        'Configure',
        'Execute',
        'Validate',
        'Finalize',
      ];

      chain.forEach((toolName, index) => {
        cumulativeDuration += Math.random() * 1000 + 100;

        const { lastFrame } = render(
          <ToolCall
            toolName={toolName}
            status="success"
            duration={cumulativeDuration}
            displayMode="compact"
          />
        );

        const output = lastFrame();
        expect(output).toContain(toolName);
        expect(() => lastFrame()).not.toThrow();
      });
    });
  });
});