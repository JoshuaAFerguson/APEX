import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FixAttemptTracker, FixAttemptTrackerOptions } from './fix-attempt-tracker';
import { TaskStore } from './store';
import {
  FixAttempt,
  FixAttemptHistory,
  FixAttemptDecision,
  ErrorFingerprint,
  TaskStatus,
  TaskUsage,
} from '@apexcli/core';

// Mock TaskStore
const mockTaskStore = {
  getFixAttemptHistory: vi.fn(),
  addFixAttempt: vi.fn(),
  clearFixAttempts: vi.fn(),
} as unknown as TaskStore;

describe('FixAttemptTracker', () => {
  let tracker: FixAttemptTracker;
  let options: FixAttemptTrackerOptions;

  beforeEach(async () => {
    vi.clearAllMocks();

    options = {
      taskId: 'test-task-123',
      store: mockTaskStore,
      config: {
        maxAttemptsPerError: 3,
        maxTotalAttempts: 10,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        groupSimilarErrors: true,
        similarityThreshold: 0.8,
      },
    };

    // Mock empty history by default
    vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue({
      entries: [],
      totalAttempts: 0,
      resolvedCount: 0,
      failedCount: 0,
      errorAttemptCounts: {},
    });

    tracker = new FixAttemptTracker(options);
    await tracker.initialize();
  });

  describe('Configuration Validation and Defaults', () => {
    it('should apply default configuration when none provided', async () => {
      const minimumOptions: FixAttemptTrackerOptions = {
        taskId: 'minimal-test',
        store: mockTaskStore,
      };

      const minimalTracker = new FixAttemptTracker(minimumOptions);
      await minimalTracker.initialize();

      const history = minimalTracker.getHistory();
      expect(history.totalAttempts).toBe(0);

      // Test that defaults are working by checking decision for first attempt
      const error = minimalTracker.createErrorFingerprint('test', 'test');
      const decision = minimalTracker.shouldAttemptFix(error);

      expect(decision.shouldAttempt).toBe(true);
      expect(decision.maxAttempts).toBe(3); // Default maxAttemptsPerError
    });

    it('should override default config with partial config', async () => {
      const partialConfigOptions: FixAttemptTrackerOptions = {
        taskId: 'partial-config-test',
        store: mockTaskStore,
        config: {
          maxAttemptsPerError: 5, // Override default
          backoffStrategy: 'linear', // Override default
          // Other values should use defaults
        },
      };

      const partialTracker = new FixAttemptTracker(partialConfigOptions);
      await partialTracker.initialize();

      const error = partialTracker.createErrorFingerprint('test', 'test');
      const decision = partialTracker.shouldAttemptFix(error);

      expect(decision.maxAttempts).toBe(5); // Custom value
    });

    it('should validate config boundaries', async () => {
      const extremeConfigOptions: FixAttemptTrackerOptions = {
        taskId: 'extreme-config-test',
        store: mockTaskStore,
        config: {
          maxAttemptsPerError: 1, // Minimum
          maxTotalAttempts: 2, // Low total
          baseDelayMs: 0, // No base delay
          maxDelayMs: 0, // No max delay
          similarityThreshold: 1.0, // Perfect match required
        },
      };

      const extremeTracker = new FixAttemptTracker(extremeConfigOptions);
      await extremeTracker.initialize();

      const error = extremeTracker.createErrorFingerprint('test', 'test');
      const decision = extremeTracker.shouldAttemptFix(error);

      expect(decision.shouldAttempt).toBe(true);
      expect(decision.maxAttempts).toBe(1);
    });
  });

  describe('Error Fingerprinting', () => {
    it('should create consistent fingerprints for same error', () => {
      const error1 = tracker.createErrorFingerprint(
        'TypeError: Cannot read property "foo" of undefined',
        'runtime',
        { filePath: '/src/test.js', line: 42 }
      );

      const error2 = tracker.createErrorFingerprint(
        'TypeError: Cannot read property "foo" of undefined',
        'runtime',
        { filePath: '/src/test.js', line: 42 }
      );

      expect(error1.hash).toBe(error2.hash);
      expect(error1.message).toBe(error2.message);
      expect(error1.category).toBe(error2.category);
    });

    it('should create different fingerprints for different errors', () => {
      const error1 = tracker.createErrorFingerprint(
        'TypeError: Cannot read property "foo" of undefined',
        'runtime'
      );

      const error2 = tracker.createErrorFingerprint(
        'SyntaxError: Unexpected token',
        'syntax'
      );

      expect(error1.hash).not.toBe(error2.hash);
    });

    it('should truncate long error messages', () => {
      const longMessage = 'Error: ' + 'a'.repeat(600);
      const error = tracker.createErrorFingerprint(longMessage, 'runtime');

      expect(error.message).toHaveLength(500);
      expect(error.message).toBe(longMessage.slice(0, 500));
    });

    it('should include optional location information', () => {
      const error = tracker.createErrorFingerprint(
        'Test error',
        'compilation',
        {
          filePath: '/src/component.tsx',
          line: 15,
          column: 23,
          code: 'TS2322',
        }
      );

      expect(error.filePath).toBe('/src/component.tsx');
      expect(error.line).toBe(15);
      expect(error.column).toBe(23);
      expect(error.code).toBe('TS2322');
    });

    it('should handle edge cases in error fingerprinting', () => {
      // Empty message
      const emptyError = tracker.createErrorFingerprint('', 'test');
      expect(emptyError.hash).toBeTruthy();
      expect(emptyError.message).toBe('');

      // Special characters and Unicode
      const unicodeError = tracker.createErrorFingerprint(
        'Error: Cannot find module 你好 with emoji 🚨',
        'module'
      );
      expect(unicodeError.hash).toBeTruthy();
      expect(unicodeError.message).toContain('你好');
      expect(unicodeError.message).toContain('🚨');

      // Very long category name
      const longCategory = 'a'.repeat(100);
      const longCategoryError = tracker.createErrorFingerprint(
        'Test error',
        longCategory
      );
      expect(longCategoryError.category).toBe(longCategory);

      // Numbers and special characters in file paths
      const specialPathError = tracker.createErrorFingerprint(
        'Test error',
        'test',
        {
          filePath: '/path/with spaces/file-123.test.js',
          line: 0,
          column: 999999,
        }
      );
      expect(specialPathError.filePath).toBe('/path/with spaces/file-123.test.js');
      expect(specialPathError.line).toBe(0);
      expect(specialPathError.column).toBe(999999);
    });

    it('should normalize error messages consistently', () => {
      // Access private method for testing
      const normalizeErrorMessage = tracker['normalizeErrorMessage'];

      expect(normalizeErrorMessage.call(tracker, 'TypeError: Cannot read property "foo" of undefined'))
        .toBe('typeerror: cannot read property foo of undefined');

      expect(normalizeErrorMessage.call(tracker, 'Error:    Multiple   spaces   here'))
        .toBe('error: multiple spaces here');

      expect(normalizeErrorMessage.call(tracker, 'Line 42 has error'))
        .toBe('line N has error');

      expect(normalizeErrorMessage.call(tracker, 'Property `test` is invalid'))
        .toBe('property test is invalid');
    });

    it('should calculate error similarity correctly', () => {
      // Access private method for testing
      const calculateSimilarity = tracker['calculateSimilarity'];

      // Identical strings
      expect(calculateSimilarity.call(tracker, 'hello world', 'hello world')).toBe(1);

      // Completely different
      expect(calculateSimilarity.call(tracker, 'hello world', 'foo bar')).toBeLessThan(0.5);

      // Partial overlap
      const similarity = calculateSimilarity.call(tracker, 'hello world test', 'hello world example');
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);

      // Empty strings
      expect(calculateSimilarity.call(tracker, '', '')).toBe(0);
      expect(calculateSimilarity.call(tracker, 'test', '')).toBe(0);
    });
  });

  describe('Fix Attempt Decision Logic', () => {
    it('should allow first attempt for new error', () => {
      const error: ErrorFingerprint = {
        hash: 'test-hash-1',
        message: 'Test error',
        category: 'test',
      };

      const decision = tracker.shouldAttemptFix(error);

      expect(decision.shouldAttempt).toBe(true);
      expect(decision.attemptCount).toBe(1);
      expect(decision.maxAttempts).toBe(3);
      expect(decision.suggestedDelayMs).toBe(0); // No delay for first attempt
    });

    it('should prevent attempts when max per error is reached', async () => {
      const error: ErrorFingerprint = {
        hash: 'test-hash-1',
        message: 'Test error',
        category: 'test',
      };

      // Mock history with max attempts for this error
      vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue({
        entries: [],
        totalAttempts: 3,
        resolvedCount: 0,
        failedCount: 3,
        errorAttemptCounts: { 'test-hash-1': 3 },
      });

      // Reinitialize to load the mocked history
      tracker = new FixAttemptTracker(options);
      await tracker.initialize();

      const decision = tracker.shouldAttemptFix(error);

      expect(decision.shouldAttempt).toBe(false);
      expect(decision.reason).toBe('max_per_error');
      expect(decision.attemptCount).toBe(3);
    });

    it('should prevent attempts when max total is reached', async () => {
      const error: ErrorFingerprint = {
        hash: 'test-hash-new',
        message: 'New error',
        category: 'test',
      };

      // Mock history with max total attempts
      vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue({
        entries: [],
        totalAttempts: 10, // Reached max total
        resolvedCount: 0,
        failedCount: 10,
        errorAttemptCounts: {},
      });

      tracker = new FixAttemptTracker(options);
      await tracker.initialize();

      const decision = tracker.shouldAttemptFix(error);

      expect(decision.shouldAttempt).toBe(false);
      expect(decision.reason).toBe('max_total');
    });

    it('should apply backoff delay for repeated attempts', async () => {
      const error: ErrorFingerprint = {
        hash: 'test-hash-1',
        message: 'Test error',
        category: 'test',
      };

      // Mock history with one previous attempt
      vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue({
        entries: [],
        totalAttempts: 1,
        resolvedCount: 0,
        failedCount: 1,
        errorAttemptCounts: { 'test-hash-1': 1 },
      });

      tracker = new FixAttemptTracker(options);
      await tracker.initialize();

      // Mock that the last attempt was recent (should trigger backoff)
      tracker['lastAttemptByError'].set('test-hash-1', new Date());

      const decision = tracker.shouldAttemptFix(error);

      expect(decision.shouldAttempt).toBe(false);
      expect(decision.reason).toBe('backoff_active');
      expect(decision.retryAfter).toBeInstanceOf(Date);
    });
  });

  describe('Backoff Strategy Calculation', () => {
    it('should calculate exponential backoff correctly', () => {
      // Access private method for testing
      const calculateBackoffDelay = tracker['calculateBackoffDelay'];

      expect(calculateBackoffDelay.call(tracker, 1)).toBe(1000); // 1000 * 2^0
      expect(calculateBackoffDelay.call(tracker, 2)).toBe(2000); // 1000 * 2^1
      expect(calculateBackoffDelay.call(tracker, 3)).toBe(4000); // 1000 * 2^2
      expect(calculateBackoffDelay.call(tracker, 4)).toBe(8000); // 1000 * 2^3
    });

    it('should respect max delay cap', () => {
      const calculateBackoffDelay = tracker['calculateBackoffDelay'];

      // Attempt that would exceed max delay
      const delay = calculateBackoffDelay.call(tracker, 10); // Would be 1000 * 2^9 = 512000

      expect(delay).toBe(30000); // Should be capped at maxDelayMs
    });

    it('should calculate linear backoff correctly', async () => {
      // Create tracker with linear backoff
      const linearOptions = { ...options };
      linearOptions.config!.backoffStrategy = 'linear';

      tracker = new FixAttemptTracker(linearOptions);
      await tracker.initialize();

      const calculateBackoffDelay = tracker['calculateBackoffDelay'];

      expect(calculateBackoffDelay.call(tracker, 1)).toBe(1000); // 1000 * 1
      expect(calculateBackoffDelay.call(tracker, 2)).toBe(2000); // 1000 * 2
      expect(calculateBackoffDelay.call(tracker, 3)).toBe(3000); // 1000 * 3
    });

    it('should calculate constant backoff correctly', async () => {
      // Create tracker with constant backoff
      const constantOptions = { ...options };
      constantOptions.config!.backoffStrategy = 'constant';

      tracker = new FixAttemptTracker(constantOptions);
      await tracker.initialize();

      const calculateBackoffDelay = tracker['calculateBackoffDelay'];

      expect(calculateBackoffDelay.call(tracker, 1)).toBe(1000);
      expect(calculateBackoffDelay.call(tracker, 2)).toBe(1000);
      expect(calculateBackoffDelay.call(tracker, 3)).toBe(1000);
    });

    it('should return zero for none backoff strategy', async () => {
      // Create tracker with no backoff
      const noneOptions = { ...options };
      noneOptions.config!.backoffStrategy = 'none';

      tracker = new FixAttemptTracker(noneOptions);
      await tracker.initialize();

      const calculateBackoffDelay = tracker['calculateBackoffDelay'];

      expect(calculateBackoffDelay.call(tracker, 1)).toBe(0);
      expect(calculateBackoffDelay.call(tracker, 5)).toBe(0);
    });
  });

  describe('Fix Attempt Workflow', () => {
    it('should successfully start and complete a fix attempt', async () => {
      const error: ErrorFingerprint = {
        hash: 'test-hash-1',
        message: 'Test error',
        category: 'compilation',
      };

      const beforeState = {
        timestamp: new Date(),
        stage: 'build',
        status: 'running' as TaskStatus,
        files: { created: [], modified: ['src/test.js'] },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 } as TaskUsage,
        errorCount: 1,
      };

      // Start fix attempt
      const attempt = await tracker.startFixAttempt(
        error,
        'Fix import statement',
        {
          agent: 'developer',
          stage: 'build',
          beforeState,
        }
      );

      expect(attempt.id).toContain('test-task-123-fix');
      expect(attempt.error.hash).toBe('test-hash-1');
      expect(attempt.approach).toBe('Fix import statement');
      expect(attempt.agent).toBe('developer');
      expect(attempt.beforeState).toEqual(beforeState);

      // Complete fix attempt
      const afterState = { ...beforeState, errorCount: 0 };
      const completedAttempt = await tracker.completeFixAttempt(
        {
          success: true,
          resolved: true,
        },
        afterState
      );

      expect(completedAttempt.completedAt).toBeInstanceOf(Date);
      expect(completedAttempt.result.success).toBe(true);
      expect(completedAttempt.result.resolved).toBe(true);
      expect(completedAttempt.afterState).toEqual(afterState);

      // Verify store was called
      expect(mockTaskStore.addFixAttempt).toHaveBeenCalledWith('test-task-123', completedAttempt);
    });

    it('should prevent starting multiple concurrent attempts', async () => {
      const error: ErrorFingerprint = {
        hash: 'test-hash-1',
        message: 'Test error',
        category: 'test',
      };

      await tracker.startFixAttempt(error, 'First attempt');

      await expect(
        tracker.startFixAttempt(error, 'Second attempt')
      ).rejects.toThrow('A fix attempt is already in progress');
    });

    it('should throw error when completing without active attempt', async () => {
      await expect(
        tracker.completeFixAttempt({ success: false, resolved: false })
      ).rejects.toThrow('No active fix attempt to complete');
    });

    it('should allow cancelling current attempt', async () => {
      const error: ErrorFingerprint = {
        hash: 'test-hash-1',
        message: 'Test error',
        category: 'test',
      };

      await tracker.startFixAttempt(error, 'Test attempt');
      tracker.cancelCurrentAttempt();

      // Should be able to start new attempt after cancelling
      await expect(
        tracker.startFixAttempt(error, 'New attempt')
      ).resolves.toBeDefined();
    });
  });

  describe('Loop Detection', () => {
    beforeEach(async () => {
      // Create tracker with history for loop detection tests
      const historyWithEntries: FixAttemptHistory = {
        entries: [
          createMockFixAttempt('attempt-1', 'hash-A', false),
          createMockFixAttempt('attempt-2', 'hash-A', false),
          createMockFixAttempt('attempt-3', 'hash-A', false),
        ],
        totalAttempts: 3,
        resolvedCount: 0,
        failedCount: 3,
        errorAttemptCounts: { 'hash-A': 3 },
      };

      vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue(historyWithEntries);

      tracker = new FixAttemptTracker(options);
      await tracker.initialize();
    });

    it('should detect same-error loop', () => {
      const loopResult = tracker.detectLoop();

      expect(loopResult.loopDetected).toBe(true);
      expect(loopResult.loopType).toBe('same_error');
      expect(loopResult.description).toContain('same error has been attempted 3 times');
      expect(loopResult.suggestedAction).toContain('different approach');
    });

    it('should detect oscillating pattern between two errors', async () => {
      const oscillatingHistory: FixAttemptHistory = {
        entries: [
          createMockFixAttempt('attempt-1', 'hash-A', false),
          createMockFixAttempt('attempt-2', 'hash-B', false),
          createMockFixAttempt('attempt-3', 'hash-A', false),
          createMockFixAttempt('attempt-4', 'hash-B', false),
        ],
        totalAttempts: 4,
        resolvedCount: 0,
        failedCount: 4,
        errorAttemptCounts: { 'hash-A': 2, 'hash-B': 2 },
      };

      vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue(oscillatingHistory);

      tracker = new FixAttemptTracker(options);
      await tracker.initialize();

      const loopResult = tracker.detectLoop();

      expect(loopResult.loopDetected).toBe(true);
      expect(loopResult.loopType).toBe('oscillating_state');
      expect(loopResult.description).toBe('Fixes are oscillating between two errors');
      expect(loopResult.involvedErrors).toHaveLength(2);
    });

    it('should detect circular pattern with multiple errors', async () => {
      const circularHistory: FixAttemptHistory = {
        entries: [
          createMockFixAttempt('attempt-1', 'hash-A', false),
          createMockFixAttempt('attempt-2', 'hash-B', false),
          createMockFixAttempt('attempt-3', 'hash-C', false),
          createMockFixAttempt('attempt-4', 'hash-A', false), // Back to first error
        ],
        totalAttempts: 4,
        resolvedCount: 0,
        failedCount: 4,
        errorAttemptCounts: { 'hash-A': 2, 'hash-B': 1, 'hash-C': 1 },
      };

      vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue(circularHistory);

      tracker = new FixAttemptTracker(options);
      await tracker.initialize();

      const loopResult = tracker.detectLoop();

      expect(loopResult.loopDetected).toBe(true);
      expect(loopResult.loopType).toBe('circular_fixes');
      expect(loopResult.description).toContain('cycling through multiple errors');
    });

    it('should not detect loop when errors are resolved', async () => {
      const resolvedHistory: FixAttemptHistory = {
        entries: [
          createMockFixAttempt('attempt-1', 'hash-A', true), // Resolved
          createMockFixAttempt('attempt-2', 'hash-A', false),
          createMockFixAttempt('attempt-3', 'hash-A', false),
        ],
        totalAttempts: 3,
        resolvedCount: 1,
        failedCount: 2,
        errorAttemptCounts: { 'hash-A': 3 },
      };

      vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue(resolvedHistory);

      tracker = new FixAttemptTracker(options);
      await tracker.initialize();

      const loopResult = tracker.detectLoop();

      expect(loopResult.loopDetected).toBe(false);
    });

    it('should not detect loop with insufficient attempts', async () => {
      const shortHistory: FixAttemptHistory = {
        entries: [
          createMockFixAttempt('attempt-1', 'hash-A', false),
          createMockFixAttempt('attempt-2', 'hash-B', false),
        ],
        totalAttempts: 2,
        resolvedCount: 0,
        failedCount: 2,
        errorAttemptCounts: { 'hash-A': 1, 'hash-B': 1 },
      };

      vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue(shortHistory);

      tracker = new FixAttemptTracker(options);
      await tracker.initialize();

      const loopResult = tracker.detectLoop();

      expect(loopResult.loopDetected).toBe(false);
    });

    it('should prevent fix attempts when loop is detected', () => {
      const error: ErrorFingerprint = {
        hash: 'hash-A',
        message: 'Test error A',
        category: 'test',
      };

      const decision = tracker.shouldAttemptFix(error);

      expect(decision.shouldAttempt).toBe(false);
      expect(decision.reason).toBe('loop_detected');
    });

    it('should handle edge cases in loop detection', async () => {
      // Test with exactly 3 attempts (minimum for same-error detection)
      const exactThreeHistory: FixAttemptHistory = {
        entries: [
          createMockFixAttempt('attempt-1', 'hash-A', false),
          createMockFixAttempt('attempt-2', 'hash-A', false),
          createMockFixAttempt('attempt-3', 'hash-A', false),
        ],
        totalAttempts: 3,
        resolvedCount: 0,
        failedCount: 3,
        errorAttemptCounts: { 'hash-A': 3 },
      };

      vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue(exactThreeHistory);

      tracker = new FixAttemptTracker(options);
      await tracker.initialize();

      const loopResult = tracker.detectLoop();
      expect(loopResult.loopDetected).toBe(true);
      expect(loopResult.loopType).toBe('same_error');
    });
  });

  describe('Similar Error Grouping', () => {
    it('should group similar error messages', () => {
      const error1 = tracker.createErrorFingerprint(
        'TypeError: Cannot read property "length" of null',
        'runtime'
      );

      const error2 = tracker.createErrorFingerprint(
        'TypeError: Cannot read property "length" of undefined',
        'runtime'
      );

      // Mock some similarity calculation - both are very similar null/undefined errors
      const findMatchingErrorHash = tracker['findMatchingErrorHash'];

      // Add first error to history
      tracker['history'].errorAttemptCounts[error1.hash] = 1;
      tracker['history'].entries.push(createMockFixAttempt('attempt-1', error1.hash, false, error1));

      // Check if second error matches first
      const matchingHash = findMatchingErrorHash.call(tracker, error2);

      // Should find matching hash due to similarity if groupSimilarErrors is enabled
      expect(matchingHash).toBeTruthy();
    });

    it('should not group dissimilar errors', () => {
      const error1 = tracker.createErrorFingerprint(
        'TypeError: Cannot read property "length" of null',
        'runtime'
      );

      const error2 = tracker.createErrorFingerprint(
        'SyntaxError: Unexpected token',
        'syntax'
      );

      const findMatchingErrorHash = tracker['findMatchingErrorHash'];

      // Add first error to history
      tracker['history'].errorAttemptCounts[error1.hash] = 1;
      tracker['history'].entries.push(createMockFixAttempt('attempt-1', error1.hash, false, error1));

      // Check if second error matches first
      const matchingHash = findMatchingErrorHash.call(tracker, error2);

      // Should not find matching hash due to dissimilarity
      expect(matchingHash).toBeNull();
    });
  });

  describe('Event Emission', () => {
    it('should emit events during fix attempt lifecycle', async () => {
      const startedSpy = vi.fn();
      const completedSpy = vi.fn();
      const resolvedSpy = vi.fn();

      tracker.on('fix:started', startedSpy);
      tracker.on('fix:completed', completedSpy);
      tracker.on('fix:resolved', resolvedSpy);

      const error: ErrorFingerprint = {
        hash: 'test-hash-1',
        message: 'Test error',
        category: 'test',
      };

      const attempt = await tracker.startFixAttempt(error, 'Test fix');
      expect(startedSpy).toHaveBeenCalledWith(attempt);

      const completedAttempt = await tracker.completeFixAttempt({
        success: true,
        resolved: true,
      });

      expect(completedSpy).toHaveBeenCalledWith(completedAttempt);
      expect(resolvedSpy).toHaveBeenCalledWith(completedAttempt);
    });

    it('should emit max-attempts event', () => {
      const maxAttemptsSpy = vi.fn();
      tracker.on('error:max-attempts', maxAttemptsSpy);

      const error: ErrorFingerprint = {
        hash: 'test-hash-1',
        message: 'Test error',
        category: 'test',
      };

      // Set up history to show max attempts reached
      tracker['history'].errorAttemptCounts['test-hash-1'] = 3;

      const decision = tracker.shouldAttemptFix(error);

      expect(decision.shouldAttempt).toBe(false);
      expect(maxAttemptsSpy).toHaveBeenCalledWith(error, 3);
    });

    it('should emit failed event for unsuccessful attempts', async () => {
      const failedSpy = vi.fn();
      tracker.on('fix:failed', failedSpy);

      const error: ErrorFingerprint = {
        hash: 'test-hash-1',
        message: 'Test error',
        category: 'test',
      };

      await tracker.startFixAttempt(error, 'Test fix');
      const completedAttempt = await tracker.completeFixAttempt({
        success: false,
        resolved: false,
        reason: 'Compilation failed',
      });

      expect(failedSpy).toHaveBeenCalledWith(completedAttempt);
    });

    it('should emit loop detection events', () => {
      const loopSpy = vi.fn();
      tracker.on('loop:detected', loopSpy);

      // Set up a state that will trigger loop detection
      tracker['history'].entries = [
        createMockFixAttempt('attempt-1', 'hash-A', false),
        createMockFixAttempt('attempt-2', 'hash-A', false),
        createMockFixAttempt('attempt-3', 'hash-A', false),
      ];

      const error: ErrorFingerprint = {
        hash: 'hash-A',
        message: 'Test error A',
        category: 'test',
      };

      const decision = tracker.shouldAttemptFix(error);

      expect(decision.shouldAttempt).toBe(false);
      expect(loopSpy).toHaveBeenCalled();
    });

    it('should emit backoff waiting events', () => {
      const backoffSpy = vi.fn();
      tracker.on('backoff:waiting', backoffSpy);

      const error: ErrorFingerprint = {
        hash: 'test-hash-1',
        message: 'Test error',
        category: 'test',
      };

      // Set recent attempt to trigger backoff
      tracker['lastAttemptByError'].set('test-hash-1', new Date());
      tracker['history'].errorAttemptCounts['test-hash-1'] = 1;

      const decision = tracker.shouldAttemptFix(error);

      expect(decision.shouldAttempt).toBe(false);
      expect(backoffSpy).toHaveBeenCalledWith(error, expect.any(Number));
    });
  });

  describe('State Management and Persistence', () => {
    it('should maintain current error state correctly', async () => {
      const error: ErrorFingerprint = {
        hash: 'persistent-error',
        message: 'Persistent test error',
        category: 'test',
      };

      // Start and fail an attempt
      await tracker.startFixAttempt(error, 'First attempt');
      await tracker.completeFixAttempt({
        success: false,
        resolved: false,
      });

      const history = tracker.getHistory();
      expect(history.currentError).toBeDefined();
      expect(history.currentError!.fingerprint.hash).toBe('persistent-error');
      expect(history.currentError!.attemptCount).toBe(1);

      // Start and resolve an attempt
      await tracker.startFixAttempt(error, 'Second attempt');
      await tracker.completeFixAttempt({
        success: true,
        resolved: true,
      });

      const updatedHistory = tracker.getHistory();
      expect(updatedHistory.currentError).toBeUndefined();
    });

    it('should persist attempts to store correctly', async () => {
      const error: ErrorFingerprint = {
        hash: 'store-test',
        message: 'Store test error',
        category: 'test',
      };

      await tracker.startFixAttempt(error, 'Store test');
      const completed = await tracker.completeFixAttempt({
        success: true,
        resolved: true,
      });

      expect(mockTaskStore.addFixAttempt).toHaveBeenCalledWith(
        'test-task-123',
        completed
      );
    });

    it('should load and rebuild state from store on initialization', async () => {
      const existingHistory: FixAttemptHistory = {
        entries: [
          createMockFixAttempt('existing-1', 'hash-1', false),
          createMockFixAttempt('existing-2', 'hash-2', true),
        ],
        totalAttempts: 2,
        resolvedCount: 1,
        failedCount: 1,
        errorAttemptCounts: { 'hash-1': 1, 'hash-2': 1 },
      };

      vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue(existingHistory);

      const newTracker = new FixAttemptTracker(options);
      await newTracker.initialize();

      const history = newTracker.getHistory();
      expect(history.totalAttempts).toBe(2);
      expect(history.resolvedCount).toBe(1);
      expect(history.errorAttemptCounts['hash-1']).toBe(1);
    });

    it('should handle store failures gracefully during persistence', async () => {
      vi.mocked(mockTaskStore.addFixAttempt).mockRejectedValue(new Error('Store error'));

      const error: ErrorFingerprint = {
        hash: 'store-fail-test',
        message: 'Store failure test',
        category: 'test',
      };

      await tracker.startFixAttempt(error, 'Store failure test');

      // Should still complete the attempt even if store fails
      await expect(
        tracker.completeFixAttempt({
          success: true,
          resolved: true,
        })
      ).rejects.toThrow('Store error');
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle multiple concurrent error types correctly', async () => {
      const errors = [
        tracker.createErrorFingerprint('Type Error A', 'runtime'),
        tracker.createErrorFingerprint('Syntax Error B', 'syntax'),
        tracker.createErrorFingerprint('Import Error C', 'module'),
      ];

      // Process multiple different errors
      for (let i = 0; i < errors.length; i++) {
        await tracker.startFixAttempt(errors[i], `Fix approach ${i + 1}`);
        await tracker.completeFixAttempt({
          success: false,
          resolved: false,
        });
      }

      const history = tracker.getHistory();
      expect(history.totalAttempts).toBe(3);
      expect(Object.keys(history.errorAttemptCounts)).toHaveLength(3);

      // Each error should have one attempt
      errors.forEach(error => {
        expect(history.errorAttemptCounts[error.hash]).toBe(1);
      });
    });

    it('should handle error resolution chain correctly', async () => {
      const primaryError = tracker.createErrorFingerprint('Primary Error', 'test');
      const secondaryError = tracker.createErrorFingerprint('Secondary Error', 'test');

      // Attempt primary error fix which introduces secondary error
      await tracker.startFixAttempt(primaryError, 'Fix primary');
      await tracker.completeFixAttempt({
        success: true,
        resolved: false,
        newErrors: [secondaryError],
      });

      // Now fix secondary error successfully
      await tracker.startFixAttempt(secondaryError, 'Fix secondary');
      await tracker.completeFixAttempt({
        success: true,
        resolved: true,
      });

      const history = tracker.getHistory();
      expect(history.totalAttempts).toBe(2);
      expect(history.resolvedCount).toBe(1);
      expect(history.failedCount).toBe(1);
    });

    it('should handle tracker reset correctly', async () => {
      const error: ErrorFingerprint = {
        hash: 'reset-test',
        message: 'Reset test error',
        category: 'test',
      };

      // Add some history
      await tracker.startFixAttempt(error, 'Before reset');
      await tracker.completeFixAttempt({
        success: false,
        resolved: false,
      });

      expect(tracker.getHistory().totalAttempts).toBe(1);

      // Reset
      await tracker.reset();

      expect(tracker.getHistory().totalAttempts).toBe(0);
      expect(tracker.getHistory().errorAttemptCounts).toEqual({});
      expect(mockTaskStore.clearFixAttempts).toHaveBeenCalledWith('test-task-123');

      // Should be able to start fresh
      await tracker.startFixAttempt(error, 'After reset');
      const decision = tracker.shouldAttemptFix(error);
      expect(decision.attemptCount).toBe(1); // Fresh start
    });

    it('should handle attempt snapshots and state tracking', async () => {
      const error: ErrorFingerprint = {
        hash: 'snapshot-test',
        message: 'Snapshot test error',
        category: 'test',
      };

      const beforeState = {
        timestamp: new Date(),
        stage: 'build',
        status: 'running' as TaskStatus,
        files: { created: ['new.js'], modified: ['existing.js'] },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 } as TaskUsage,
        errorCount: 1,
      };

      const afterState = {
        ...beforeState,
        errorCount: 0,
        files: { created: ['new.js'], modified: ['existing.js', 'fixed.js'] },
      };

      await tracker.startFixAttempt(error, 'Snapshot test', {
        agent: 'developer',
        stage: 'build',
        beforeState,
      });

      const completed = await tracker.completeFixAttempt({
        success: true,
        resolved: true,
      }, afterState);

      expect(completed.beforeState).toEqual(beforeState);
      expect(completed.afterState).toEqual(afterState);
      expect(completed.agent).toBe('developer');
      expect(completed.stage).toBe('build');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed error fingerprints gracefully', () => {
      // Test with null/undefined values
      const error1 = tracker.createErrorFingerprint(
        'Test error',
        'test',
        {
          filePath: undefined,
          line: undefined,
          column: undefined,
          code: undefined,
        }
      );

      expect(error1.hash).toBeTruthy();
      expect(error1.filePath).toBeUndefined();
      expect(error1.line).toBeUndefined();
      expect(error1.column).toBeUndefined();
      expect(error1.code).toBeUndefined();
    });

    it('should handle extremely large attempt counts', async () => {
      // Mock a history with large numbers
      const largeCountHistory: FixAttemptHistory = {
        entries: [],
        totalAttempts: 999999,
        resolvedCount: 500000,
        failedCount: 499999,
        errorAttemptCounts: { 'large-count-hash': 50000 },
      };

      vi.mocked(mockTaskStore.getFixAttemptHistory).mockResolvedValue(largeCountHistory);

      const largeCountTracker = new FixAttemptTracker(options);
      await largeCountTracker.initialize();

      const error: ErrorFingerprint = {
        hash: 'large-count-hash',
        message: 'Large count test',
        category: 'test',
      };

      const decision = largeCountTracker.shouldAttemptFix(error);
      expect(decision.shouldAttempt).toBe(false);
      expect(decision.reason).toBe('max_total');
    });

    it('should handle timing edge cases in backoff calculation', () => {
      // Test edge cases in timing
      tracker['lastAttemptByError'].set('timing-test', new Date(Date.now() - 500)); // 500ms ago
      tracker['history'].errorAttemptCounts['timing-test'] = 1;

      const error: ErrorFingerprint = {
        hash: 'timing-test',
        message: 'Timing test error',
        category: 'test',
      };

      const decision = tracker.shouldAttemptFix(error);

      // With exponential backoff, 1000ms delay should be applied for attempt 1
      // 500ms have passed, so should still be in backoff period
      expect(decision.shouldAttempt).toBe(false);
      expect(decision.reason).toBe('backoff_active');
    });
  });
});

// Helper function to create mock fix attempts
function createMockFixAttempt(
  id: string,
  errorHash: string,
  resolved: boolean,
  error?: ErrorFingerprint
): FixAttempt {
  return {
    id,
    taskId: 'test-task-123',
    attemptNumber: 1,
    error: error || {
      hash: errorHash,
      message: 'Mock error',
      category: 'test',
    },
    startedAt: new Date(),
    completedAt: new Date(),
    approach: 'Mock fix approach',
    result: {
      success: true,
      resolved,
    },
  };
}