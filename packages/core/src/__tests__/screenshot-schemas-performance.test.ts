/**
 * Performance tests for screenshot schemas
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  ScreenshotOptionsSchema,
  ScreenshotResultSchema,
  CaptureElementOptionsSchema,
  type ScreenshotOptions,
  type ScreenshotResult,
  type CaptureElementOptions
} from '../types';

describe('Screenshot Schema Performance', () => {
  let sampleOptions: ScreenshotOptions;
  let sampleResult: ScreenshotResult;
  let sampleCaptureOptions: CaptureElementOptions;
  let largeBuffer: Buffer;

  beforeAll(() => {
    // Prepare test data
    sampleOptions = {
      format: 'png',
      quality: 80,
      output: 'buffer',
      fullPage: false,
      omitBackground: false
    };

    largeBuffer = Buffer.alloc(1024 * 1024); // 1MB buffer
    sampleResult = {
      buffer: largeBuffer,
      width: 1920,
      height: 1080,
      format: 'png',
      capturedAt: new Date()
    };

    sampleCaptureOptions = {
      selector: '.performance-test-element',
      format: 'jpeg',
      quality: 95,
      output: 'file',
      path: '/tmp/performance-test.jpg',
      padding: 10,
      fullPage: true,
      omitBackground: true
    };
  });

  it('should parse ScreenshotOptions quickly', () => {
    const iterations = 10000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      ScreenshotOptionsSchema.parse({ ...sampleOptions });
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerParse = totalTime / iterations;

    // Should be very fast - less than 0.1ms per parse on average
    expect(avgTimePerParse).toBeLessThan(0.1);

    // Log performance metrics for monitoring
    console.log(`ScreenshotOptions parsing: ${avgTimePerParse.toFixed(4)}ms avg, ${totalTime.toFixed(2)}ms total for ${iterations} iterations`);
  });

  it('should parse ScreenshotResult with large buffer efficiently', () => {
    const iterations = 1000; // Fewer iterations due to large buffer
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      ScreenshotResultSchema.parse({ ...sampleResult });
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerParse = totalTime / iterations;

    // Should handle large buffers efficiently - less than 1ms per parse
    expect(avgTimePerParse).toBeLessThan(1);

    console.log(`ScreenshotResult parsing (1MB buffer): ${avgTimePerParse.toFixed(4)}ms avg, ${totalTime.toFixed(2)}ms total for ${iterations} iterations`);
  });

  it('should parse CaptureElementOptions efficiently', () => {
    const iterations = 10000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      CaptureElementOptionsSchema.parse({ ...sampleCaptureOptions });
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerParse = totalTime / iterations;

    // Should be fast even with complex nested schema
    expect(avgTimePerParse).toBeLessThan(0.2);

    console.log(`CaptureElementOptions parsing: ${avgTimePerParse.toFixed(4)}ms avg, ${totalTime.toFixed(2)}ms total for ${iterations} iterations`);
  });

  it('should handle schema validation errors efficiently', () => {
    const iterations = 1000;
    const invalidData = {
      format: 'invalid-format',
      quality: 150, // Invalid quality
      output: 'invalid-output'
    };

    const startTime = performance.now();
    let errorCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        ScreenshotOptionsSchema.parse(invalidData);
      } catch (error) {
        errorCount++;
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerError = totalTime / iterations;

    expect(errorCount).toBe(iterations); // All should error
    expect(avgTimePerError).toBeLessThan(0.5); // Error handling should be fast

    console.log(`Schema error handling: ${avgTimePerError.toFixed(4)}ms avg, ${totalTime.toFixed(2)}ms total for ${iterations} errors`);
  });

  it('should handle concurrent parsing efficiently', async () => {
    const concurrencyLevel = 100;
    const parsesPerWorker = 100;

    const workers = Array.from({ length: concurrencyLevel }, async () => {
      const startTime = performance.now();

      for (let i = 0; i < parsesPerWorker; i++) {
        ScreenshotOptionsSchema.parse({ ...sampleOptions });
        ScreenshotResultSchema.parse({
          buffer: Buffer.from('test data'),
          width: 100,
          height: 100
        });
      }

      return performance.now() - startTime;
    });

    const times = await Promise.all(workers);
    const maxTime = Math.max(...times);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

    // Concurrent parsing shouldn't be significantly slower
    expect(maxTime).toBeLessThan(100); // 100ms for 100 parses max

    console.log(`Concurrent parsing: ${avgTime.toFixed(2)}ms avg, ${maxTime.toFixed(2)}ms max across ${concurrencyLevel} workers`);
  });

  it('should have minimal memory footprint for schema objects', () => {
    // Test that schemas don't consume excessive memory
    const initialMemory = process.memoryUsage().heapUsed;

    // Create many schema instances
    const schemas = [];
    for (let i = 0; i < 1000; i++) {
      schemas.push({
        options: ScreenshotOptionsSchema,
        result: ScreenshotResultSchema,
        capture: CaptureElementOptionsSchema
      });
    }

    const afterSchemaMemory = process.memoryUsage().heapUsed;
    const schemaMemoryIncrease = afterSchemaMemory - initialMemory;

    // Schema objects should be lightweight - less than 1MB for 1000 instances
    expect(schemaMemoryIncrease).toBeLessThan(1024 * 1024);

    console.log(`Schema memory footprint: ${(schemaMemoryIncrease / 1024).toFixed(2)}KB for 1000 schema instances`);

    // Cleanup
    schemas.length = 0;
  });
});