/**
 * Test Report Generator Tests
 *
 * Comprehensive tests for the TestReportGenerator class to verify
 * visual comparison integration and report generation.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { TestReportGenerator, type TestReportGeneratorOptions } from '../test-report-generator';
import type {
  VisualComparisonEventData,
  TestReport,
  TestVisualComparison,
  VisualRegressionSummary,
} from '@apexcli/core';

describe('TestReportGenerator', () => {
  let generator: TestReportGenerator;
  let eventEmitter: EventEmitter;
  let options: TestReportGeneratorOptions;

  beforeEach(() => {
    options = {
      testSuite: 'Visual Regression Test Suite',
      taskId: 'test-task-123',
      agentName: 'test-agent',
      environment: 'test',
      version: '1.0.0',
    };

    generator = new TestReportGenerator(options);
    eventEmitter = new EventEmitter();
    generator.connectEventEmitter(eventEmitter);
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(generator).toBeDefined();

      const report = generator.generateReport();
      expect(report.taskId).toBe(options.taskId);
      expect(report.agentName).toBe(options.agentName);
      expect(report.summary.testSuite).toBe(options.testSuite);
      expect(report.summary.environment).toBe(options.environment);
      expect(report.summary.version).toBe(options.version);
    });
  });

  describe('visual comparison event handling', () => {
    it('should collect visual comparison passed events', () => {
      const visualEvent: VisualComparisonEventData = {
        testId: 'visual-test-1',
        baseline: '/path/to/baseline.png',
        actual: '/path/to/actual.png',
        diffImage: '/path/to/diff.png',
        diffPercentage: 2.5,
        threshold: 5.0,
        passed: true,
        timestamp: new Date('2024-01-15T10:00:00Z'),
        pageUrl: 'https://example.com/page',
        selector: '.main-content',
      };

      eventEmitter.emit('visual:comparison:passed', visualEvent);

      const report = generator.generateReport();

      expect(report.visualComparisons).toBeDefined();
      expect(report.visualComparisons).toHaveLength(1);

      const comparison = report.visualComparisons![0];
      expect(comparison.baseline).toBe(visualEvent.baseline);
      expect(comparison.actual).toBe(visualEvent.actual);
      expect(comparison.diffImage).toBe(visualEvent.diffImage);
      expect(comparison.diffPercentage).toBe(visualEvent.diffPercentage);
      expect(comparison.threshold).toBe(visualEvent.threshold);
      expect(comparison.passed).toBe(true);
      expect(comparison.timestamp).toEqual(visualEvent.timestamp);
      expect(comparison.pageUrl).toBe(visualEvent.pageUrl);
      expect(comparison.selector).toBe(visualEvent.selector);
    });

    it('should collect visual comparison failed events', () => {
      const visualEvent: VisualComparisonEventData = {
        testId: 'visual-test-2',
        baseline: '/path/to/baseline2.png',
        actual: '/path/to/actual2.png',
        diffImage: '/path/to/diff2.png',
        diffPercentage: 8.7,
        threshold: 5.0,
        passed: false,
        timestamp: new Date('2024-01-15T10:05:00Z'),
      };

      eventEmitter.emit('visual:comparison:failed', visualEvent);

      const report = generator.generateReport();

      expect(report.visualComparisons).toBeDefined();
      expect(report.visualComparisons).toHaveLength(1);

      const comparison = report.visualComparisons![0];
      expect(comparison.passed).toBe(false);
      expect(comparison.diffPercentage).toBe(8.7);
      expect(comparison.threshold).toBe(5.0);
    });

    it('should handle multiple visual comparisons', () => {
      const events: VisualComparisonEventData[] = [
        {
          testId: 'test-1',
          baseline: '/baseline1.png',
          actual: '/actual1.png',
          diffPercentage: 1.2,
          threshold: 5.0,
          passed: true,
          timestamp: new Date('2024-01-15T10:00:00Z'),
        },
        {
          testId: 'test-2',
          baseline: '/baseline2.png',
          actual: '/actual2.png',
          diffImage: '/diff2.png',
          diffPercentage: 7.8,
          threshold: 5.0,
          passed: false,
          timestamp: new Date('2024-01-15T10:01:00Z'),
        },
        {
          testId: 'test-3',
          baseline: '/baseline3.png',
          actual: '/actual3.png',
          diffPercentage: 0.5,
          threshold: 2.0,
          passed: true,
          timestamp: new Date('2024-01-15T10:02:00Z'),
        },
      ];

      events.forEach((event, index) => {
        const eventType = event.passed ? 'visual:comparison:passed' : 'visual:comparison:failed';
        eventEmitter.emit(eventType, event);
      });

      const report = generator.generateReport();
      expect(report.visualComparisons).toHaveLength(3);

      // Verify correct collection
      expect(report.visualComparisons!.filter(vc => vc.passed)).toHaveLength(2);
      expect(report.visualComparisons!.filter(vc => !vc.passed)).toHaveLength(1);
    });
  });

  describe('artifacts generation', () => {
    it('should create artifacts for visual comparison images', () => {
      const visualEvent: VisualComparisonEventData = {
        testId: 'artifact-test',
        baseline: '/path/to/baseline.png',
        actual: '/path/to/actual.png',
        diffImage: '/path/to/diff.png',
        diffPercentage: 6.2,
        threshold: 5.0,
        passed: false,
        timestamp: new Date(),
      };

      eventEmitter.emit('visual:comparison:failed', visualEvent);

      const report = generator.generateReport();

      expect(report.artifacts).toHaveLength(3);

      // Baseline artifact
      const baselineArtifact = report.artifacts.find(a => a.path === '/path/to/baseline.png');
      expect(baselineArtifact).toBeDefined();
      expect(baselineArtifact!.type).toBe('screenshot');
      expect(baselineArtifact!.description).toBe('Baseline screenshot for visual comparison');
      expect(baselineArtifact!.testId).toBe('artifact-test');

      // Actual artifact
      const actualArtifact = report.artifacts.find(a => a.path === '/path/to/actual.png');
      expect(actualArtifact).toBeDefined();
      expect(actualArtifact!.type).toBe('screenshot');
      expect(actualArtifact!.description).toBe('Actual screenshot for visual comparison');

      // Diff artifact
      const diffArtifact = report.artifacts.find(a => a.path === '/path/to/diff.png');
      expect(diffArtifact).toBeDefined();
      expect(diffArtifact!.type).toBe('diff');
      expect(diffArtifact!.description).toBe('Diff image showing 6.20% difference');
    });

    it('should handle missing diff image gracefully', () => {
      const visualEvent: VisualComparisonEventData = {
        testId: 'no-diff-test',
        baseline: '/path/to/baseline.png',
        actual: '/path/to/actual.png',
        diffPercentage: 2.1,
        threshold: 5.0,
        passed: true,
        timestamp: new Date(),
      };

      eventEmitter.emit('visual:comparison:passed', visualEvent);

      const report = generator.generateReport();

      // Should have 2 artifacts (baseline and actual), but no diff
      expect(report.artifacts).toHaveLength(2);
      expect(report.artifacts.find(a => a.type === 'diff')).toBeUndefined();
    });
  });

  describe('visual regression summary', () => {
    it('should generate accurate visual regression summary', () => {
      const events: VisualComparisonEventData[] = [
        {
          testId: 'test-1',
          baseline: '/baseline1.png',
          actual: '/actual1.png',
          diffImage: '/diff1.png',
          diffPercentage: 3.0,
          threshold: 5.0,
          passed: true,
          timestamp: new Date(),
        },
        {
          testId: 'test-2',
          baseline: '/baseline2.png',
          actual: '/actual2.png',
          diffImage: '/diff2.png',
          diffPercentage: 8.0,
          threshold: 5.0,
          passed: false,
          timestamp: new Date(),
        },
        {
          testId: 'test-3',
          baseline: '/baseline3.png',
          actual: '/actual3.png',
          diffPercentage: 1.5,
          threshold: 2.0,
          passed: true,
          timestamp: new Date(),
        },
        {
          testId: 'test-4',
          actual: '/actual4.png', // No baseline
          diffPercentage: 12.0,
          threshold: 10.0,
          passed: false,
          timestamp: new Date(),
        },
      ];

      events.forEach(event => {
        const eventType = event.passed ? 'visual:comparison:passed' : 'visual:comparison:failed';
        eventEmitter.emit(eventType, event);
      });

      const report = generator.generateReport();
      const summary = report.visualRegression!;

      expect(summary.totalComparisons).toBe(4);
      expect(summary.passedComparisons).toBe(2);
      expect(summary.failedComparisons).toBe(2);
      expect(summary.thresholdViolations).toBe(2);
      expect(summary.diffImageCount).toBe(2); // Only first two events have diffImage
      expect(summary.averageDiffPercentage).toBe(6.125); // (3.0 + 8.0 + 1.5 + 12.0) / 4
      expect(summary.maxDiffPercentage).toBe(12.0);
      expect(summary.baselineCoverage).toBe(75.0); // 3 out of 4 have baseline
    });

    it('should return undefined visual regression summary when no comparisons', () => {
      const report = generator.generateReport();
      expect(report.visualRegression).toBeUndefined();
      expect(report.visualComparisons).toBeUndefined();
    });
  });

  describe('test result tracking', () => {
    it('should track test completions and link with visual comparisons', () => {
      // First emit a visual comparison event
      const visualEvent: VisualComparisonEventData = {
        testId: 'linked-test',
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffPercentage: 4.2,
        threshold: 5.0,
        passed: true,
        timestamp: new Date(),
      };
      eventEmitter.emit('visual:comparison:passed', visualEvent);

      // Then complete the test
      generator.completeTest({
        testId: 'linked-test',
        status: 'passed',
        executionTime: 1500,
      });

      const report = generator.generateReport();

      expect(report.testResults).toHaveLength(1);
      const testResult = report.testResults[0];

      expect(testResult.testId).toBe('linked-test');
      expect(testResult.status).toBe('passed');
      expect(testResult.executionTime).toBe(1500);
      expect(testResult.visualComparison).toBeDefined();
      expect(testResult.visualComparison!.diffPercentage).toBe(4.2);
      expect(testResult.visualComparison!.passed).toBe(true);
    });

    it('should categorize tests based on visual comparisons', () => {
      // Visual test
      eventEmitter.emit('visual:comparison:passed', {
        testId: 'visual-test',
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffPercentage: 2.0,
        threshold: 5.0,
        passed: true,
        timestamp: new Date(),
      });

      generator.completeTest({
        testId: 'visual-test',
        status: 'passed',
        executionTime: 1000,
      });

      // Non-visual test
      generator.completeTest({
        testId: 'functional-test',
        status: 'passed',
        executionTime: 800,
      });

      const report = generator.generateReport();

      const visualTest = report.testResults.find(t => t.testId === 'visual-test');
      const functionalTest = report.testResults.find(t => t.testId === 'functional-test');

      expect(visualTest!.category).toBe('visual');
      expect(functionalTest!.category).toBe('functional');
    });
  });

  describe('test summary generation', () => {
    it('should generate accurate test summary statistics', () => {
      // Complete various tests
      generator.completeTest({
        testId: 'test-1',
        status: 'passed',
        executionTime: 1000,
      });

      generator.completeTest({
        testId: 'test-2',
        status: 'failed',
        executionTime: 1500,
        errorDetails: 'Assertion failed',
      });

      generator.completeTest({
        testId: 'test-3',
        status: 'skipped',
        executionTime: 0,
      });

      generator.completeTest({
        testId: 'test-4',
        status: 'pending',
        executionTime: 0,
      });

      const report = generator.generateReport();
      const summary = report.summary;

      expect(summary.totalTests).toBe(4);
      expect(summary.passedTests).toBe(1);
      expect(summary.failedTests).toBe(1);
      expect(summary.skippedTests).toBe(1);
      expect(summary.pendingTests).toBe(1);
      expect(summary.passRate).toBe(25.0); // 1 passed out of 4 total
      expect(summary.testSuite).toBe(options.testSuite);
      expect(summary.environment).toBe(options.environment);
      expect(summary.version).toBe(options.version);
    });
  });

  describe('report generation', () => {
    it('should generate a complete test report with all required fields', () => {
      // Add a visual comparison
      eventEmitter.emit('visual:comparison:failed', {
        testId: 'complete-test',
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffImage: '/diff.png',
        diffPercentage: 7.3,
        threshold: 5.0,
        passed: false,
        timestamp: new Date(),
      });

      // Complete the test
      generator.completeTest({
        testId: 'complete-test',
        status: 'failed',
        executionTime: 2000,
        errorDetails: 'Visual regression detected',
        stackTrace: 'Error stack trace here',
      });

      const report = generator.generateReport();

      // Verify all required fields are present
      expect(report.reportId).toBeDefined();
      expect(report.reportId).toMatch(/^test-report-/);
      expect(report.taskId).toBe(options.taskId);
      expect(report.agentName).toBe(options.agentName);
      expect(report.summary).toBeDefined();
      expect(report.visualRegression).toBeDefined();
      expect(report.visualComparisons).toBeDefined();
      expect(report.testResults).toBeDefined();
      expect(report.artifacts).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.schemaVersion).toBe('1.0.0');
    });

    it('should include diff details in failed comparisons', () => {
      const failedEvent: VisualComparisonEventData = {
        testId: 'failed-comparison',
        baseline: '/failed/baseline.png',
        actual: '/failed/actual.png',
        diffImage: '/failed/diff.png',
        diffPercentage: 15.7,
        threshold: 10.0,
        passed: false,
        timestamp: new Date(),
        pageUrl: 'https://example.com/failed-page',
        selector: '.failed-element',
      };

      eventEmitter.emit('visual:comparison:failed', failedEvent);

      const report = generator.generateReport();
      const comparison = report.visualComparisons![0];

      // Verify diff details are included
      expect(comparison.diffPercentage).toBe(15.7);
      expect(comparison.threshold).toBe(10.0);
      expect(comparison.diffImage).toBe('/failed/diff.png');
      expect(comparison.baseline).toBe('/failed/baseline.png');
      expect(comparison.actual).toBe('/failed/actual.png');
      expect(comparison.pageUrl).toBe('https://example.com/failed-page');
      expect(comparison.selector).toBe('.failed-element');
      expect(comparison.passed).toBe(false);

      // Verify artifacts include diff image
      const diffArtifact = report.artifacts.find(a => a.type === 'diff');
      expect(diffArtifact).toBeDefined();
      expect(diffArtifact!.path).toBe('/failed/diff.png');
      expect(diffArtifact!.description).toContain('15.70% difference');
    });
  });

  describe('utility methods', () => {
    it('should provide current statistics', () => {
      // Add some test data
      eventEmitter.emit('visual:comparison:passed', {
        testId: 'stats-test-1',
        baseline: '/baseline1.png',
        actual: '/actual1.png',
        diffPercentage: 2.0,
        threshold: 5.0,
        passed: true,
        timestamp: new Date(),
      });

      eventEmitter.emit('visual:comparison:failed', {
        testId: 'stats-test-2',
        baseline: '/baseline2.png',
        actual: '/actual2.png',
        diffImage: '/diff2.png',
        diffPercentage: 8.0,
        threshold: 5.0,
        passed: false,
        timestamp: new Date(),
      });

      generator.completeTest({
        testId: 'stats-test-1',
        status: 'passed',
        executionTime: 1000,
      });

      generator.completeTest({
        testId: 'stats-test-2',
        status: 'failed',
        executionTime: 1500,
      });

      const stats = generator.getStats();

      expect(stats.totalTests).toBe(2);
      expect(stats.passedTests).toBe(1);
      expect(stats.failedTests).toBe(1);
      expect(stats.visualComparisons).toBe(2);
      expect(stats.failedComparisons).toBe(1);
      expect(stats.artifacts).toBe(5); // 2 baseline + 2 actual + 1 diff
    });

    it('should reset state correctly', () => {
      // Add some data
      eventEmitter.emit('visual:comparison:passed', {
        testId: 'reset-test',
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffPercentage: 1.0,
        threshold: 5.0,
        passed: true,
        timestamp: new Date(),
      });

      generator.completeTest({
        testId: 'reset-test',
        status: 'passed',
        executionTime: 1000,
      });

      // Verify data exists
      expect(generator.getStats().totalTests).toBe(1);
      expect(generator.getStats().visualComparisons).toBe(1);

      // Reset and verify clean state
      generator.reset();

      const stats = generator.getStats();
      expect(stats.totalTests).toBe(0);
      expect(stats.visualComparisons).toBe(0);
      expect(stats.artifacts).toBe(0);

      const report = generator.generateReport();
      expect(report.testResults).toHaveLength(0);
      expect(report.visualComparisons).toBeUndefined();
      expect(report.artifacts).toHaveLength(0);
    });
  });

  describe('acceptance criteria verification', () => {
    it('AC1: TestReport schema includes visualComparisons array', () => {
      const report = generator.generateReport();

      // Schema should support visualComparisons array
      expect(report).toHaveProperty('visualComparisons');
      expect(Array.isArray(report.visualComparisons) || report.visualComparisons === undefined).toBe(true);
    });

    it('AC2: Report generator collects visual comparison events and includes summary', () => {
      // Emit multiple visual comparison events
      eventEmitter.emit('visual:comparison:passed', {
        testId: 'ac2-test-1',
        baseline: '/baseline1.png',
        actual: '/actual1.png',
        diffPercentage: 2.0,
        threshold: 5.0,
        passed: true,
        timestamp: new Date(),
      });

      eventEmitter.emit('visual:comparison:failed', {
        testId: 'ac2-test-2',
        baseline: '/baseline2.png',
        actual: '/actual2.png',
        diffPercentage: 8.0,
        threshold: 5.0,
        passed: false,
        timestamp: new Date(),
      });

      const report = generator.generateReport();

      // Verify events are collected
      expect(report.visualComparisons).toHaveLength(2);

      // Verify summary includes visual regression data
      expect(report.visualRegression).toBeDefined();
      expect(report.visualRegression!.totalComparisons).toBe(2);
      expect(report.visualRegression!.passedComparisons).toBe(1);
      expect(report.visualRegression!.failedComparisons).toBe(1);
    });

    it('AC3: Failed comparisons include diff details', () => {
      const failedEvent: VisualComparisonEventData = {
        testId: 'ac3-test',
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffImage: '/diff.png',
        diffPercentage: 12.5,
        threshold: 8.0,
        passed: false,
        timestamp: new Date(),
      };

      eventEmitter.emit('visual:comparison:failed', failedEvent);

      const report = generator.generateReport();
      const comparison = report.visualComparisons![0];

      // Verify diff details are present
      expect(comparison.diffPercentage).toBe(12.5);
      expect(comparison.threshold).toBe(8.0);
      expect(comparison.diffImage).toBe('/diff.png');
      expect(comparison.baseline).toBe('/baseline.png');
      expect(comparison.actual).toBe('/actual.png');
      expect(comparison.passed).toBe(false);
    });

    it('AC4: Unit tests verify report contains visual regression data', () => {
      // This test itself verifies that visual regression data is included
      eventEmitter.emit('visual:comparison:failed', {
        testId: 'ac4-test',
        baseline: '/baseline.png',
        actual: '/actual.png',
        diffImage: '/diff.png',
        diffPercentage: 6.7,
        threshold: 5.0,
        passed: false,
        timestamp: new Date(),
      });

      const report = generator.generateReport();

      // Verify visual regression data is present and accurate
      expect(report.visualRegression).toBeDefined();
      expect(report.visualRegression!.totalComparisons).toBe(1);
      expect(report.visualRegression!.failedComparisons).toBe(1);
      expect(report.visualRegression!.thresholdViolations).toBe(1);
      expect(report.visualRegression!.diffImageCount).toBe(1);

      expect(report.visualComparisons).toHaveLength(1);
      expect(report.visualComparisons![0].diffPercentage).toBe(6.7);

      expect(report.artifacts.some(a => a.type === 'diff')).toBe(true);
    });
  });
});