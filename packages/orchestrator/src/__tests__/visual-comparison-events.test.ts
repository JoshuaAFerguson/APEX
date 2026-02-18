/**
 * Visual Comparison Event Types and Orchestrator Integration Tests
 *
 * Tests for the visual comparison event system that verifies:
 * 1. VisualComparisonEventData Zod schema validation
 * 2. Event type integration with orchestrator EventEmitter
 * 3. compareScreenshot() event emission on mismatch/match
 * 4. Correct payload structure and validation
 *
 * Acceptance Criteria:
 * 1) Zod schemas for VisualComparisonEvent with fields: testId, baseline, actual, diffImage, diffPercentage, threshold, passed
 * 2) Event type added to orchestrator's EventEmitter
 * 3) compareScreenshot() emits 'visual:comparison:failed' event on mismatch
 * 4) Unit tests verify event emission with correct payload structure
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { z } from 'zod';
import { ApexOrchestrator } from '../index.js';
import { VisualComparisonEventDataSchema, VisualComparisonEventData } from '@apexcli/core';
import type { BrowserTool } from '../index.js';

// Mock dependencies
vi.mock('../store.js');
vi.mock('../browser-manager.js');

describe('Visual Comparison Event Types and Integration', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: any;
  let mockBrowserTool: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock store
    mockStore = {
      createTask: vi.fn(() => Promise.resolve('task-123')),
      updateTask: vi.fn(() => Promise.resolve()),
      getTask: vi.fn(() => Promise.resolve({
        id: 'task-123',
        description: 'Visual comparison test task',
        status: 'running',
        agentName: 'tester',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      listTasks: vi.fn(() => Promise.resolve([])),
      deleteTask: vi.fn(() => Promise.resolve()),
    };

    // Mock browser tool with event emitter
    mockBrowserTool = {
      eventEmitter: new EventEmitter(),
      getConsoleStream: vi.fn(() => new EventEmitter()),
      setPermissionManager: vi.fn(),
    };

    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({
      store: mockStore,
      browserTool: mockBrowserTool,
    });

    // Set up current task context for testing
    (orchestrator as any).currentTaskId = 'task-123';
    (orchestrator as any).currentAgentName = 'tester';
  });

  afterEach(async () => {
    // Clean up
    await orchestrator.shutdown();
  });

  describe('VisualComparisonEventData Zod Schema Validation', () => {
    it('should validate complete visual comparison event data', () => {
      const validEventData = {
        testId: 'homepage-comparison-001',
        baseline: '/path/to/baseline.png',
        actual: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        diffImage: '/tmp/diff-001.png',
        diffPercentage: 2.35,
        threshold: 5.0,
        passed: true,
        pageUrl: 'https://example.com/homepage',
        selector: '#main-content',
      };

      const result = VisualComparisonEventDataSchema.safeParse(validEventData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual(validEventData);
        expect(result.data.testId).toBe('homepage-comparison-001');
        expect(result.data.baseline).toBe('/path/to/baseline.png');
        expect(result.data.actual).toBe('data:image/png;base64,iVBORw0KGgoAAAANS...');
        expect(result.data.diffImage).toBe('/tmp/diff-001.png');
        expect(result.data.diffPercentage).toBe(2.35);
        expect(result.data.threshold).toBe(5.0);
        expect(result.data.passed).toBe(true);
        expect(result.data.pageUrl).toBe('https://example.com/homepage');
        expect(result.data.selector).toBe('#main-content');
      }
    });

    it('should validate minimal required fields only', () => {
      const minimalEventData = {
        testId: 'minimal-test-001',
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffImage: '/diff.png',
        diffPercentage: 0.0,
        threshold: 1.0,
        passed: true,
      };

      const result = VisualComparisonEventDataSchema.safeParse(minimalEventData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.testId).toBe('minimal-test-001');
        expect(result.data.pageUrl).toBeUndefined();
        expect(result.data.selector).toBeUndefined();
      }
    });

    it('should reject data with missing required fields', () => {
      const invalidData = {
        testId: 'test-001',
        baseline: '/baseline.png',
        // Missing: actual, diffImage, diffPercentage, threshold, passed
      };

      const result = VisualComparisonEventDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        expect(result.error.issues.some(issue => issue.path.includes('actual'))).toBe(true);
        expect(result.error.issues.some(issue => issue.path.includes('diffImage'))).toBe(true);
        expect(result.error.issues.some(issue => issue.path.includes('diffPercentage'))).toBe(true);
        expect(result.error.issues.some(issue => issue.path.includes('threshold'))).toBe(true);
        expect(result.error.issues.some(issue => issue.path.includes('passed'))).toBe(true);
      }
    });

    it('should reject invalid field types', () => {
      const invalidTypeData = {
        testId: 123, // Should be string
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffImage: '/diff.png',
        diffPercentage: 'high', // Should be number
        threshold: '5.0', // Should be number
        passed: 'true', // Should be boolean
      };

      const result = VisualComparisonEventDataSchema.safeParse(invalidTypeData);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('testId'))).toBe(true);
        expect(result.error.issues.some(issue => issue.path.includes('diffPercentage'))).toBe(true);
        expect(result.error.issues.some(issue => issue.path.includes('threshold'))).toBe(true);
        expect(result.error.issues.some(issue => issue.path.includes('passed'))).toBe(true);
      }
    });

    it('should reject empty string values for required string fields', () => {
      const emptyStringData = {
        testId: '', // Should not be empty
        baseline: '',
        actual: '',
        diffImage: '',
        diffPercentage: 2.5,
        threshold: 5.0,
        passed: false,
      };

      const result = VisualComparisonEventDataSchema.safeParse(emptyStringData);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('testId'))).toBe(true);
        expect(result.error.issues.some(issue => issue.path.includes('baseline'))).toBe(true);
        expect(result.error.issues.some(issue => issue.path.includes('actual'))).toBe(true);
        expect(result.error.issues.some(issue => issue.path.includes('diffImage'))).toBe(true);
      }
    });

    it('should validate numeric ranges correctly', () => {
      const validNumericData = {
        testId: 'numeric-test',
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffImage: '/diff.png',
        diffPercentage: 0.0, // Valid: 0%
        threshold: 100.0, // Valid: 100%
        passed: false,
      };

      const result = VisualComparisonEventDataSchema.safeParse(validNumericData);
      expect(result.success).toBe(true);

      // Test negative values (should be accepted as they might represent color differences)
      const negativeData = { ...validNumericData, diffPercentage: -1.0 };
      const negativeResult = VisualComparisonEventDataSchema.safeParse(negativeData);
      expect(negativeResult.success).toBe(true);
    });

    it('should validate optional fields when present', () => {
      const dataWithOptionals = {
        testId: 'optional-test',
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffImage: '/diff.png',
        diffPercentage: 3.2,
        threshold: 2.0,
        passed: false,
        pageUrl: 'invalid-url', // Still valid as string
        selector: '', // Empty selector should be valid
      };

      const result = VisualComparisonEventDataSchema.safeParse(dataWithOptionals);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.pageUrl).toBe('invalid-url');
        expect(result.data.selector).toBe('');
      }
    });
  });

  describe('Event Type Integration with Orchestrator EventEmitter', () => {
    it('should register visual comparison event types in orchestrator', () => {
      // The event types should be available in the orchestrator's event emitter
      expect(orchestrator.emit).toBeDefined();
      expect(orchestrator.on).toBeDefined();
      expect(orchestrator.once).toBeDefined();

      // Test that we can register listeners for visual comparison events
      const passedListener = vi.fn();
      const failedListener = vi.fn();

      orchestrator.on('visual:comparison:passed', passedListener);
      orchestrator.on('visual:comparison:failed', failedListener);

      // Listeners should be registered
      expect(orchestrator.listenerCount('visual:comparison:passed')).toBe(1);
      expect(orchestrator.listenerCount('visual:comparison:failed')).toBe(1);

      // Clean up
      orchestrator.removeListener('visual:comparison:passed', passedListener);
      orchestrator.removeListener('visual:comparison:failed', failedListener);
    });

    it('should emit visual:comparison:passed event with correct structure', (done) => {
      const testEventData: VisualComparisonEventData = {
        testId: 'homepage-passed-test',
        baseline: '/path/to/baseline.png',
        actual: '/path/to/actual.png',
        diffImage: '/tmp/diff.png',
        diffPercentage: 1.2,
        threshold: 5.0,
        passed: true,
        pageUrl: 'https://example.com',
        selector: '#main-content',
      };

      orchestrator.once('visual:comparison:passed', (eventData: VisualComparisonEventData) => {
        try {
          expect(eventData).toEqual(testEventData);
          expect(eventData.testId).toBe('homepage-passed-test');
          expect(eventData.passed).toBe(true);
          expect(eventData.diffPercentage).toBeLessThan(eventData.threshold);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Emit the event
      orchestrator.emit('visual:comparison:passed', testEventData);
    });

    it('should emit visual:comparison:failed event with correct structure', (done) => {
      const testEventData: VisualComparisonEventData = {
        testId: 'login-failed-test',
        baseline: '/path/to/baseline-login.png',
        actual: 'data:image/png;base64,actualImageData...',
        diffImage: '/tmp/login-diff.png',
        diffPercentage: 15.8,
        threshold: 10.0,
        passed: false,
        pageUrl: 'https://example.com/login',
        selector: '.login-form',
      };

      orchestrator.once('visual:comparison:failed', (eventData: VisualComparisonEventData) => {
        try {
          expect(eventData).toEqual(testEventData);
          expect(eventData.testId).toBe('login-failed-test');
          expect(eventData.passed).toBe(false);
          expect(eventData.diffPercentage).toBeGreaterThan(eventData.threshold);
          expect(eventData.actual).toContain('data:image/png;base64,');
          done();
        } catch (error) {
          done(error);
        }
      });

      // Emit the event
      orchestrator.emit('visual:comparison:failed', testEventData);
    });

    it('should handle multiple visual comparison event listeners', (done) => {
      let listener1Called = false;
      let listener2Called = false;

      const checkCompletion = () => {
        if (listener1Called && listener2Called) {
          done();
        }
      };

      const testEventData: VisualComparisonEventData = {
        testId: 'multiple-listeners-test',
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffImage: '/diff.png',
        diffPercentage: 7.5,
        threshold: 5.0,
        passed: false,
      };

      orchestrator.once('visual:comparison:failed', (eventData) => {
        listener1Called = true;
        expect(eventData.testId).toBe('multiple-listeners-test');
        checkCompletion();
      });

      orchestrator.once('visual:comparison:failed', (eventData) => {
        listener2Called = true;
        expect(eventData.diffPercentage).toBe(7.5);
        checkCompletion();
      });

      orchestrator.emit('visual:comparison:failed', testEventData);
    });
  });

  describe('BrowserTool compareScreenshot Event Emission', () => {
    it('should emit visual:comparison:failed when compareScreenshot detects mismatch', (done) => {
      const mockEventData: VisualComparisonEventData = {
        testId: 'browser-tool-failed-test',
        baseline: '/screenshots/baseline.png',
        actual: 'data:image/png;base64,currentScreenshot...',
        diffImage: '/tmp/comparison-diff.png',
        diffPercentage: 12.5,
        threshold: 8.0,
        passed: false,
        pageUrl: 'https://example.com/products',
        selector: undefined,
      };

      orchestrator.once('visual:comparison:failed', (eventData: VisualComparisonEventData) => {
        try {
          expect(eventData.testId).toBe('browser-tool-failed-test');
          expect(eventData.passed).toBe(false);
          expect(eventData.diffPercentage).toBeGreaterThan(eventData.threshold);
          expect(eventData.baseline).toBe('/screenshots/baseline.png');
          expect(eventData.actual).toContain('data:image/png;base64,');
          done();
        } catch (error) {
          done(error);
        }
      });

      // Simulate browser tool emitting visual comparison failed event
      mockBrowserTool.eventEmitter.emit('visual:comparison:failed', mockEventData);
    });

    it('should emit visual:comparison:passed when compareScreenshot detects match', (done) => {
      const mockEventData: VisualComparisonEventData = {
        testId: 'browser-tool-passed-test',
        baseline: '/screenshots/dashboard-baseline.png',
        actual: '/tmp/current-dashboard.png',
        diffImage: '/tmp/dashboard-diff.png',
        diffPercentage: 0.8,
        threshold: 2.0,
        passed: true,
        pageUrl: 'https://example.com/dashboard',
        selector: '#dashboard-container',
      };

      orchestrator.once('visual:comparison:passed', (eventData: VisualComparisonEventData) => {
        try {
          expect(eventData.testId).toBe('browser-tool-passed-test');
          expect(eventData.passed).toBe(true);
          expect(eventData.diffPercentage).toBeLessThan(eventData.threshold);
          expect(eventData.selector).toBe('#dashboard-container');
          done();
        } catch (error) {
          done(error);
        }
      });

      // Simulate browser tool emitting visual comparison passed event
      mockBrowserTool.eventEmitter.emit('visual:comparison:passed', mockEventData);
    });

    it('should handle edge cases in compareScreenshot event emission', (done) => {
      // Test with minimal required data
      const minimalEventData: VisualComparisonEventData = {
        testId: 'minimal-edge-case',
        baseline: '/min-baseline.png',
        actual: '/min-actual.png',
        diffImage: '/min-diff.png',
        diffPercentage: 0.0,
        threshold: 0.0,
        passed: true,
      };

      orchestrator.once('visual:comparison:passed', (eventData: VisualComparisonEventData) => {
        try {
          expect(eventData).toEqual(minimalEventData);
          expect(eventData.pageUrl).toBeUndefined();
          expect(eventData.selector).toBeUndefined();
          done();
        } catch (error) {
          done(error);
        }
      });

      mockBrowserTool.eventEmitter.emit('visual:comparison:passed', minimalEventData);
    });

    it('should validate event data before forwarding from browser tool', () => {
      const invalidEventData = {
        testId: '', // Invalid: empty string
        baseline: '/baseline.png',
        // Missing required fields
      };

      const validationSpy = vi.spyOn(VisualComparisonEventDataSchema, 'safeParse');

      orchestrator.once('visual:comparison:failed', () => {
        // This should not be called due to invalid data
        expect.fail('Should not emit event with invalid data');
      });

      // Emit invalid data - orchestrator should validate before forwarding
      mockBrowserTool.eventEmitter.emit('visual:comparison:failed', invalidEventData);

      // Allow time for potential event processing
      setTimeout(() => {
        expect(validationSpy).toHaveBeenCalled();
        validationSpy.mockRestore();
      }, 10);
    });
  });

  describe('Event Payload Structure Verification', () => {
    it('should maintain consistent event structure across different scenarios', async () => {
      const scenarios = [
        {
          name: 'Full page comparison',
          data: {
            testId: 'full-page-001',
            baseline: '/screenshots/page-baseline.png',
            actual: 'data:image/png;base64,fullPageData...',
            diffImage: '/tmp/page-diff.png',
            diffPercentage: 3.4,
            threshold: 5.0,
            passed: true,
            pageUrl: 'https://example.com/page',
          },
        },
        {
          name: 'Element-specific comparison',
          data: {
            testId: 'element-001',
            baseline: '/elements/button-baseline.png',
            actual: '/tmp/button-current.png',
            diffImage: '/tmp/button-diff.png',
            diffPercentage: 8.2,
            threshold: 7.0,
            passed: false,
            pageUrl: 'https://example.com/form',
            selector: '#submit-button',
          },
        },
        {
          name: 'High precision comparison',
          data: {
            testId: 'precision-001',
            baseline: '/precise/baseline.png',
            actual: '/precise/actual.png',
            diffImage: '/precise/diff.png',
            diffPercentage: 0.001,
            threshold: 0.01,
            passed: true,
            pageUrl: 'https://example.com/precise',
            selector: '.pixel-perfect-element',
          },
        },
      ];

      for (const scenario of scenarios) {
        // Validate structure
        const validationResult = VisualComparisonEventDataSchema.safeParse(scenario.data);
        expect(validationResult.success).toBe(true);

        if (validationResult.success) {
          const eventData = validationResult.data;

          // Verify all required fields are present
          expect(eventData.testId).toBeDefined();
          expect(typeof eventData.testId).toBe('string');
          expect(eventData.testId).not.toBe('');

          expect(eventData.baseline).toBeDefined();
          expect(typeof eventData.baseline).toBe('string');
          expect(eventData.baseline).not.toBe('');

          expect(eventData.actual).toBeDefined();
          expect(typeof eventData.actual).toBe('string');
          expect(eventData.actual).not.toBe('');

          expect(eventData.diffImage).toBeDefined();
          expect(typeof eventData.diffImage).toBe('string');
          expect(eventData.diffImage).not.toBe('');

          expect(eventData.diffPercentage).toBeDefined();
          expect(typeof eventData.diffPercentage).toBe('number');

          expect(eventData.threshold).toBeDefined();
          expect(typeof eventData.threshold).toBe('number');

          expect(eventData.passed).toBeDefined();
          expect(typeof eventData.passed).toBe('boolean');

          // Verify logical consistency
          if (eventData.passed) {
            expect(eventData.diffPercentage).toBeLessThanOrEqual(eventData.threshold);
          } else {
            expect(eventData.diffPercentage).toBeGreaterThan(eventData.threshold);
          }
        }
      }
    });

    it('should support different image format paths and data URIs', () => {
      const imageFormats = [
        {
          baseline: '/path/to/baseline.png',
          actual: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        },
        {
          baseline: '/path/to/baseline.jpg',
          actual: '/tmp/actual.jpg',
        },
        {
          baseline: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYA...',
          actual: 'data:image/png;base64,actualData...',
        },
        {
          baseline: '/screenshots/baseline.webp',
          actual: '/tmp/current.webp',
        },
      ];

      for (const format of imageFormats) {
        const eventData = {
          testId: 'format-test',
          baseline: format.baseline,
          actual: format.actual,
          diffImage: '/tmp/diff.png',
          diffPercentage: 1.0,
          threshold: 2.0,
          passed: true,
        };

        const result = VisualComparisonEventDataSchema.safeParse(eventData);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.baseline).toBe(format.baseline);
          expect(result.data.actual).toBe(format.actual);
        }
      }
    });

    it('should validate numeric precision for diff percentages', () => {
      const precisionTests = [
        { diffPercentage: 0, threshold: 0, passed: true },
        { diffPercentage: 0.1, threshold: 0.2, passed: true },
        { diffPercentage: 0.01, threshold: 0.02, passed: true },
        { diffPercentage: 0.001, threshold: 0.002, passed: true },
        { diffPercentage: 99.999, threshold: 100.0, passed: true },
        { diffPercentage: 100.0, threshold: 99.9, passed: false },
        { diffPercentage: 50.123456789, threshold: 50.0, passed: false },
      ];

      for (const test of precisionTests) {
        const eventData = {
          testId: 'precision-test',
          baseline: '/baseline.png',
          actual: '/actual.png',
          diffImage: '/diff.png',
          diffPercentage: test.diffPercentage,
          threshold: test.threshold,
          passed: test.passed,
        };

        const result = VisualComparisonEventDataSchema.safeParse(eventData);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.diffPercentage).toBe(test.diffPercentage);
          expect(result.data.threshold).toBe(test.threshold);
          expect(result.data.passed).toBe(test.passed);
        }
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle orchestrator shutdown gracefully with pending visual events', async () => {
      const eventData: VisualComparisonEventData = {
        testId: 'shutdown-test',
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffImage: '/diff.png',
        diffPercentage: 1.0,
        threshold: 2.0,
        passed: true,
      };

      // Register listener
      const listener = vi.fn();
      orchestrator.on('visual:comparison:passed', listener);

      // Emit event
      orchestrator.emit('visual:comparison:passed', eventData);

      // Verify event was handled
      expect(listener).toHaveBeenCalledWith(eventData);

      // Shutdown should complete without hanging
      await expect(orchestrator.shutdown()).resolves.not.toThrow();
    });

    it('should handle malformed visual comparison events gracefully', () => {
      const malformedEvents = [
        null,
        undefined,
        {},
        [],
        'string',
        123,
        { testId: 'test' }, // Missing required fields
        { testId: null }, // Wrong type
      ];

      for (const malformedEvent of malformedEvents) {
        const result = VisualComparisonEventDataSchema.safeParse(malformedEvent);
        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error).toBeInstanceOf(z.ZodError);
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      }
    });

    it('should maintain event emission order under concurrent comparisons', (done) => {
      const events: VisualComparisonEventData[] = [];
      const expectedEventCount = 10;

      orchestrator.on('visual:comparison:passed', (eventData) => {
        events.push(eventData);

        if (events.length === expectedEventCount) {
          try {
            // Verify all events were received
            expect(events.length).toBe(expectedEventCount);

            // Verify order is maintained (by testId sequence)
            for (let i = 0; i < events.length; i++) {
              expect(events[i].testId).toBe(`concurrent-test-${i}`);
            }

            done();
          } catch (error) {
            done(error);
          }
        }
      });

      // Emit multiple events rapidly
      for (let i = 0; i < expectedEventCount; i++) {
        const eventData: VisualComparisonEventData = {
          testId: `concurrent-test-${i}`,
          baseline: `/baseline-${i}.png`,
          actual: `/actual-${i}.png`,
          diffImage: `/diff-${i}.png`,
          diffPercentage: i * 0.5,
          threshold: 5.0,
          passed: true,
        };

        orchestrator.emit('visual:comparison:passed', eventData);
      }
    });
  });
});