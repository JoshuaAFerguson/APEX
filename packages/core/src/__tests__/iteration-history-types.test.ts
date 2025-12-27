import { describe, it, expect, beforeEach } from 'vitest';
import type { IterationEntry, IterationHistory, TaskSessionData } from '../types';

describe('IterationEntry', () => {
  describe('interface structure', () => {
    it('should accept valid IterationEntry with all required fields', () => {
      const entry: IterationEntry = {
        id: 'iter_001',
        feedback: 'Please add more error handling to the authentication flow',
        timestamp: new Date('2024-01-15T10:30:00Z'),
      };

      expect(entry.id).toBe('iter_001');
      expect(entry.feedback).toBe('Please add more error handling to the authentication flow');
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.timestamp.toISOString()).toBe('2024-01-15T10:30:00Z');
    });

    it('should accept IterationEntry with all optional fields', () => {
      const entry: IterationEntry = {
        id: 'iter_002',
        feedback: 'The validation logic needs to be more robust',
        timestamp: new Date('2024-01-15T11:45:00Z'),
        diffSummary: 'Added input validation, error handling, and user feedback messages',
        stage: 'implementation',
        modifiedFiles: [
          '/src/auth/validator.ts',
          '/src/auth/types.ts',
          '/src/components/LoginForm.tsx'
        ],
        agent: 'developer'
      };

      expect(entry.id).toBe('iter_002');
      expect(entry.feedback).toBe('The validation logic needs to be more robust');
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.diffSummary).toBe('Added input validation, error handling, and user feedback messages');
      expect(entry.stage).toBe('implementation');
      expect(entry.modifiedFiles).toEqual([
        '/src/auth/validator.ts',
        '/src/auth/types.ts',
        '/src/components/LoginForm.tsx'
      ]);
      expect(entry.agent).toBe('developer');
    });

    it('should handle IterationEntry with minimal required fields only', () => {
      const entry: IterationEntry = {
        id: 'minimal_001',
        feedback: 'Fix the bug',
        timestamp: new Date()
      };

      expect(entry.id).toBe('minimal_001');
      expect(entry.feedback).toBe('Fix the bug');
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.diffSummary).toBeUndefined();
      expect(entry.stage).toBeUndefined();
      expect(entry.modifiedFiles).toBeUndefined();
      expect(entry.agent).toBeUndefined();
    });
  });

  describe('field validation', () => {
    it('should enforce string type for id field', () => {
      const entry: IterationEntry = {
        id: 'string_id_123',
        feedback: 'Test feedback',
        timestamp: new Date()
      };

      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
    });

    it('should enforce string type for feedback field', () => {
      const entry: IterationEntry = {
        id: 'test_001',
        feedback: 'This is a detailed feedback message with specific requirements',
        timestamp: new Date()
      };

      expect(typeof entry.feedback).toBe('string');
      expect(entry.feedback.length).toBeGreaterThan(0);
    });

    it('should enforce Date type for timestamp field', () => {
      const now = new Date();
      const entry: IterationEntry = {
        id: 'time_001',
        feedback: 'Time test',
        timestamp: now
      };

      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.timestamp.getTime()).toBe(now.getTime());
    });

    it('should enforce string type for optional diffSummary field', () => {
      const entry: IterationEntry = {
        id: 'diff_001',
        feedback: 'Testing diff summary',
        timestamp: new Date(),
        diffSummary: 'Modified 3 files, added error handling, updated tests'
      };

      expect(typeof entry.diffSummary).toBe('string');
      expect(entry.diffSummary?.length).toBeGreaterThan(0);
    });

    it('should enforce string type for optional stage field', () => {
      const entry: IterationEntry = {
        id: 'stage_001',
        feedback: 'Testing stage field',
        timestamp: new Date(),
        stage: 'testing'
      };

      expect(typeof entry.stage).toBe('string');
    });

    it('should enforce string array type for optional modifiedFiles field', () => {
      const files = ['/src/file1.ts', '/src/file2.ts', '/test/file1.test.ts'];
      const entry: IterationEntry = {
        id: 'files_001',
        feedback: 'Testing modified files',
        timestamp: new Date(),
        modifiedFiles: files
      };

      expect(Array.isArray(entry.modifiedFiles)).toBe(true);
      expect(entry.modifiedFiles).toEqual(files);
      entry.modifiedFiles?.forEach(file => {
        expect(typeof file).toBe('string');
      });
    });

    it('should enforce string type for optional agent field', () => {
      const entry: IterationEntry = {
        id: 'agent_001',
        feedback: 'Testing agent field',
        timestamp: new Date(),
        agent: 'architect'
      };

      expect(typeof entry.agent).toBe('string');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle iteration from planning stage', () => {
      const planningIteration: IterationEntry = {
        id: 'plan_iter_001',
        feedback: 'The API design needs to include rate limiting and authentication middleware',
        timestamp: new Date('2024-01-15T09:00:00Z'),
        diffSummary: 'Updated API specification, added middleware requirements, documented authentication flow',
        stage: 'planning',
        modifiedFiles: [
          '/docs/api-spec.md',
          '/docs/architecture.md',
          '/planning/middleware-requirements.md'
        ],
        agent: 'planner'
      };

      expect(planningIteration.stage).toBe('planning');
      expect(planningIteration.agent).toBe('planner');
      expect(planningIteration.modifiedFiles?.some(file => file.includes('api-spec'))).toBe(true);
    });

    it('should handle iteration from implementation stage', () => {
      const implementationIteration: IterationEntry = {
        id: 'impl_iter_001',
        feedback: 'Add comprehensive error handling and input validation to the user service',
        timestamp: new Date('2024-01-15T14:30:00Z'),
        diffSummary: 'Implemented try-catch blocks, added Zod validation schemas, created custom error classes',
        stage: 'implementation',
        modifiedFiles: [
          '/src/services/userService.ts',
          '/src/types/validation.ts',
          '/src/errors/UserError.ts',
          '/src/middleware/validation.ts'
        ],
        agent: 'developer'
      };

      expect(implementationIteration.stage).toBe('implementation');
      expect(implementationIteration.agent).toBe('developer');
      expect(implementationIteration.modifiedFiles?.length).toBe(4);
    });

    it('should handle iteration from testing stage', () => {
      const testingIteration: IterationEntry = {
        id: 'test_iter_001',
        feedback: 'Tests are missing edge cases for null values and boundary conditions',
        timestamp: new Date('2024-01-15T16:15:00Z'),
        diffSummary: 'Added edge case tests, boundary condition tests, and improved test coverage',
        stage: 'testing',
        modifiedFiles: [
          '/tests/services/userService.test.ts',
          '/tests/validation/schemas.test.ts',
          '/tests/fixtures/testData.ts'
        ],
        agent: 'tester'
      };

      expect(testingIteration.stage).toBe('testing');
      expect(testingIteration.agent).toBe('tester');
      expect(testingIteration.modifiedFiles?.every(file => file.includes('test'))).toBe(true);
    });

    it('should handle iteration from review stage', () => {
      const reviewIteration: IterationEntry = {
        id: 'review_iter_001',
        feedback: 'Code needs better documentation and the variable names could be more descriptive',
        timestamp: new Date('2024-01-15T18:45:00Z'),
        diffSummary: 'Added JSDoc comments, renamed variables for clarity, updated README documentation',
        stage: 'review',
        modifiedFiles: [
          '/src/services/userService.ts',
          '/src/utils/helpers.ts',
          '/README.md',
          '/docs/api.md'
        ],
        agent: 'reviewer'
      };

      expect(reviewIteration.stage).toBe('review');
      expect(reviewIteration.agent).toBe('reviewer');
      expect(reviewIteration.diffSummary).toContain('JSDoc');
    });
  });

  describe('edge cases', () => {
    it('should handle very long feedback messages', () => {
      const longFeedback = 'This is an extremely detailed feedback message that goes into great depth about the specific changes needed. '.repeat(10);

      const entry: IterationEntry = {
        id: 'long_feedback_001',
        feedback: longFeedback,
        timestamp: new Date()
      };

      expect(entry.feedback.length).toBeGreaterThan(100);
      expect(typeof entry.feedback).toBe('string');
    });

    it('should handle empty modifiedFiles array', () => {
      const entry: IterationEntry = {
        id: 'empty_files_001',
        feedback: 'Conceptual feedback with no file changes',
        timestamp: new Date(),
        modifiedFiles: []
      };

      expect(Array.isArray(entry.modifiedFiles)).toBe(true);
      expect(entry.modifiedFiles).toHaveLength(0);
    });

    it('should handle large number of modified files', () => {
      const manyFiles = Array.from({ length: 50 }, (_, i) => `/src/file${i + 1}.ts`);

      const entry: IterationEntry = {
        id: 'many_files_001',
        feedback: 'Major refactoring across multiple files',
        timestamp: new Date(),
        modifiedFiles: manyFiles
      };

      expect(entry.modifiedFiles).toHaveLength(50);
      expect(entry.modifiedFiles?.[0]).toBe('/src/file1.ts');
      expect(entry.modifiedFiles?.[49]).toBe('/src/file50.ts');
    });

    it('should handle different timestamp formats', () => {
      const timestamps = [
        new Date('2024-01-15'),
        new Date('2024-01-15T10:30:00.000Z'),
        new Date(1705312200000), // Unix timestamp
        new Date('Jan 15, 2024 10:30:00 GMT')
      ];

      timestamps.forEach((timestamp, index) => {
        const entry: IterationEntry = {
          id: `timestamp_${index}`,
          feedback: `Testing timestamp format ${index}`,
          timestamp: timestamp
        };

        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.timestamp.getTime()).toBe(timestamp.getTime());
      });
    });

    it('should handle special characters in feedback and file paths', () => {
      const entry: IterationEntry = {
        id: 'special_chars_001',
        feedback: 'Add support for UTF-8 characters: émojis 🎉, symbols ±√π, and quotes "testing"',
        timestamp: new Date(),
        modifiedFiles: [
          '/src/components/Émoji-Component.tsx',
          '/src/utils/math±operations.ts',
          '/tests/"quoted-file".test.ts'
        ]
      };

      expect(entry.feedback).toContain('🎉');
      expect(entry.feedback).toContain('±√π');
      expect(entry.modifiedFiles?.[0]).toContain('Émoji');
      expect(entry.modifiedFiles?.[2]).toContain('"quoted-file"');
    });
  });
});

describe('IterationHistory', () => {
  describe('interface structure', () => {
    it('should accept valid IterationHistory with empty entries', () => {
      const history: IterationHistory = {
        entries: [],
        totalIterations: 0
      };

      expect(Array.isArray(history.entries)).toBe(true);
      expect(history.entries).toHaveLength(0);
      expect(history.totalIterations).toBe(0);
      expect(history.lastIterationAt).toBeUndefined();
    });

    it('should accept IterationHistory with single entry', () => {
      const entry: IterationEntry = {
        id: 'single_001',
        feedback: 'First iteration feedback',
        timestamp: new Date('2024-01-15T10:00:00Z')
      };

      const history: IterationHistory = {
        entries: [entry],
        totalIterations: 1,
        lastIterationAt: new Date('2024-01-15T10:00:00Z')
      };

      expect(history.entries).toHaveLength(1);
      expect(history.entries[0]).toBe(entry);
      expect(history.totalIterations).toBe(1);
      expect(history.lastIterationAt).toBeInstanceOf(Date);
    });

    it('should accept IterationHistory with multiple entries in chronological order', () => {
      const entries: IterationEntry[] = [
        {
          id: 'chrono_001',
          feedback: 'First iteration',
          timestamp: new Date('2024-01-15T10:00:00Z')
        },
        {
          id: 'chrono_002',
          feedback: 'Second iteration',
          timestamp: new Date('2024-01-15T11:00:00Z')
        },
        {
          id: 'chrono_003',
          feedback: 'Third iteration',
          timestamp: new Date('2024-01-15T12:00:00Z')
        }
      ];

      const history: IterationHistory = {
        entries: entries,
        totalIterations: 3,
        lastIterationAt: new Date('2024-01-15T12:00:00Z')
      };

      expect(history.entries).toHaveLength(3);
      expect(history.totalIterations).toBe(3);
      expect(history.lastIterationAt?.toISOString()).toBe('2024-01-15T12:00:00.000Z');

      // Verify chronological order
      for (let i = 1; i < history.entries.length; i++) {
        expect(history.entries[i].timestamp.getTime())
          .toBeGreaterThanOrEqual(history.entries[i - 1].timestamp.getTime());
      }
    });
  });

  describe('field validation', () => {
    it('should enforce IterationEntry array type for entries field', () => {
      const entry: IterationEntry = {
        id: 'validation_001',
        feedback: 'Test entry',
        timestamp: new Date()
      };

      const history: IterationHistory = {
        entries: [entry],
        totalIterations: 1
      };

      expect(Array.isArray(history.entries)).toBe(true);
      expect(history.entries[0]).toEqual(entry);
    });

    it('should enforce number type for totalIterations field', () => {
      const history: IterationHistory = {
        entries: [],
        totalIterations: 42
      };

      expect(typeof history.totalIterations).toBe('number');
      expect(history.totalIterations).toBe(42);
    });

    it('should enforce Date type for optional lastIterationAt field', () => {
      const lastDate = new Date('2024-01-15T15:30:00Z');
      const history: IterationHistory = {
        entries: [],
        totalIterations: 0,
        lastIterationAt: lastDate
      };

      expect(history.lastIterationAt).toBeInstanceOf(Date);
      expect(history.lastIterationAt?.getTime()).toBe(lastDate.getTime());
    });
  });

  describe('logical consistency', () => {
    it('should maintain consistency between entries length and totalIterations', () => {
      const entries: IterationEntry[] = [
        { id: '1', feedback: 'First', timestamp: new Date('2024-01-15T10:00:00Z') },
        { id: '2', feedback: 'Second', timestamp: new Date('2024-01-15T11:00:00Z') },
        { id: '3', feedback: 'Third', timestamp: new Date('2024-01-15T12:00:00Z') }
      ];

      const history: IterationHistory = {
        entries: entries,
        totalIterations: entries.length,
        lastIterationAt: entries[entries.length - 1].timestamp
      };

      expect(history.entries.length).toBe(history.totalIterations);
      expect(history.lastIterationAt?.getTime())
        .toBe(history.entries[history.entries.length - 1].timestamp.getTime());
    });

    it('should handle case where totalIterations exceeds entries length (truncated history)', () => {
      // This scenario represents keeping only recent entries while tracking total count
      const recentEntries: IterationEntry[] = [
        { id: '98', feedback: 'Recent iteration 1', timestamp: new Date('2024-01-15T14:00:00Z') },
        { id: '99', feedback: 'Recent iteration 2', timestamp: new Date('2024-01-15T15:00:00Z') },
        { id: '100', feedback: 'Latest iteration', timestamp: new Date('2024-01-15T16:00:00Z') }
      ];

      const history: IterationHistory = {
        entries: recentEntries,
        totalIterations: 100, // Total count includes historical entries not in the array
        lastIterationAt: new Date('2024-01-15T16:00:00Z')
      };

      expect(history.totalIterations).toBe(100);
      expect(history.entries.length).toBe(3);
      expect(history.totalIterations).toBeGreaterThan(history.entries.length);
    });

    it('should handle chronological ordering verification', () => {
      const entries: IterationEntry[] = [
        { id: '1', feedback: 'First', timestamp: new Date('2024-01-15T09:00:00Z') },
        { id: '2', feedback: 'Second', timestamp: new Date('2024-01-15T10:30:00Z') },
        { id: '3', feedback: 'Third', timestamp: new Date('2024-01-15T14:15:00Z') },
        { id: '4', feedback: 'Fourth', timestamp: new Date('2024-01-15T16:45:00Z') }
      ];

      const history: IterationHistory = {
        entries: entries,
        totalIterations: 4,
        lastIterationAt: entries[entries.length - 1].timestamp
      };

      // Verify all entries are in chronological order
      for (let i = 1; i < history.entries.length; i++) {
        expect(history.entries[i].timestamp.getTime())
          .toBeGreaterThan(history.entries[i - 1].timestamp.getTime());
      }

      // Verify lastIterationAt matches the latest entry
      expect(history.lastIterationAt?.getTime())
        .toBe(Math.max(...history.entries.map(e => e.timestamp.getTime())));
    });
  });

  describe('real-world usage scenarios', () => {
    let sampleHistory: IterationHistory;

    beforeEach(() => {
      const entries: IterationEntry[] = [
        {
          id: 'planning_iter_001',
          feedback: 'The authentication flow needs to be more secure',
          timestamp: new Date('2024-01-15T09:00:00Z'),
          stage: 'planning',
          agent: 'planner',
          diffSummary: 'Updated security requirements and authentication flow design'
        },
        {
          id: 'impl_iter_001',
          feedback: 'Implement OAuth2 and JWT token management',
          timestamp: new Date('2024-01-15T11:30:00Z'),
          stage: 'implementation',
          agent: 'developer',
          diffSummary: 'Added OAuth2 provider integration and JWT utilities',
          modifiedFiles: [
            '/src/auth/oauth.ts',
            '/src/auth/jwt.ts',
            '/src/middleware/auth.ts'
          ]
        },
        {
          id: 'test_iter_001',
          feedback: 'Add comprehensive tests for authentication edge cases',
          timestamp: new Date('2024-01-15T14:45:00Z'),
          stage: 'testing',
          agent: 'tester',
          diffSummary: 'Implemented unit and integration tests for auth flow',
          modifiedFiles: [
            '/tests/auth/oauth.test.ts',
            '/tests/auth/jwt.test.ts',
            '/tests/integration/auth-flow.test.ts'
          ]
        },
        {
          id: 'review_iter_001',
          feedback: 'Code looks good, just add some documentation',
          timestamp: new Date('2024-01-15T16:00:00Z'),
          stage: 'review',
          agent: 'reviewer',
          diffSummary: 'Added comprehensive documentation and inline comments',
          modifiedFiles: [
            '/docs/authentication.md',
            '/src/auth/oauth.ts',
            '/README.md'
          ]
        }
      ];

      sampleHistory = {
        entries: entries,
        totalIterations: 4,
        lastIterationAt: new Date('2024-01-15T16:00:00Z')
      };
    });

    it('should represent complete workflow iteration cycle', () => {
      expect(sampleHistory.entries).toHaveLength(4);
      expect(sampleHistory.totalIterations).toBe(4);

      const stages = sampleHistory.entries.map(e => e.stage);
      expect(stages).toEqual(['planning', 'implementation', 'testing', 'review']);

      const agents = sampleHistory.entries.map(e => e.agent);
      expect(agents).toEqual(['planner', 'developer', 'tester', 'reviewer']);
    });

    it('should track progression through workflow stages', () => {
      const stageProgression = sampleHistory.entries.map(entry => ({
        stage: entry.stage,
        timestamp: entry.timestamp,
        agent: entry.agent
      }));

      expect(stageProgression).toEqual([
        { stage: 'planning', timestamp: new Date('2024-01-15T09:00:00Z'), agent: 'planner' },
        { stage: 'implementation', timestamp: new Date('2024-01-15T11:30:00Z'), agent: 'developer' },
        { stage: 'testing', timestamp: new Date('2024-01-15T14:45:00Z'), agent: 'tester' },
        { stage: 'review', timestamp: new Date('2024-01-15T16:00:00Z'), agent: 'reviewer' }
      ]);
    });

    it('should aggregate all modified files across iterations', () => {
      const allModifiedFiles = sampleHistory.entries
        .filter(entry => entry.modifiedFiles)
        .flatMap(entry => entry.modifiedFiles!);

      expect(allModifiedFiles).toContain('/src/auth/oauth.ts');
      expect(allModifiedFiles).toContain('/tests/auth/oauth.test.ts');
      expect(allModifiedFiles).toContain('/docs/authentication.md');
      expect(allModifiedFiles.filter(file => file.includes('oauth.ts'))).toHaveLength(2); // Source and test
    });

    it('should enable filtering iterations by stage', () => {
      const implementationIterations = sampleHistory.entries.filter(entry => entry.stage === 'implementation');
      const testingIterations = sampleHistory.entries.filter(entry => entry.stage === 'testing');

      expect(implementationIterations).toHaveLength(1);
      expect(implementationIterations[0].agent).toBe('developer');

      expect(testingIterations).toHaveLength(1);
      expect(testingIterations[0].agent).toBe('tester');
    });

    it('should enable filtering iterations by agent', () => {
      const developerIterations = sampleHistory.entries.filter(entry => entry.agent === 'developer');
      const reviewerIterations = sampleHistory.entries.filter(entry => entry.agent === 'reviewer');

      expect(developerIterations).toHaveLength(1);
      expect(developerIterations[0].stage).toBe('implementation');

      expect(reviewerIterations).toHaveLength(1);
      expect(reviewerIterations[0].stage).toBe('review');
    });

    it('should calculate iteration duration and frequency', () => {
      const durations: number[] = [];

      for (let i = 1; i < sampleHistory.entries.length; i++) {
        const duration = sampleHistory.entries[i].timestamp.getTime() -
                        sampleHistory.entries[i - 1].timestamp.getTime();
        durations.push(duration);
      }

      // Verify we have calculated durations between each iteration
      expect(durations).toHaveLength(3);

      // Verify all durations are positive (chronological order)
      durations.forEach(duration => {
        expect(duration).toBeGreaterThan(0);
      });

      // Calculate total workflow duration
      const totalDuration = sampleHistory.lastIterationAt!.getTime() -
                          sampleHistory.entries[0].timestamp.getTime();
      expect(totalDuration).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very large iteration history', () => {
      const largeNumberOfEntries = Array.from({ length: 1000 }, (_, i) => ({
        id: `large_${i + 1}`,
        feedback: `Iteration ${i + 1} feedback`,
        timestamp: new Date(Date.now() + i * 60000) // 1 minute apart
      }));

      const largeHistory: IterationHistory = {
        entries: largeNumberOfEntries,
        totalIterations: 1000,
        lastIterationAt: largeNumberOfEntries[largeNumberOfEntries.length - 1].timestamp
      };

      expect(largeHistory.entries).toHaveLength(1000);
      expect(largeHistory.totalIterations).toBe(1000);
      expect(largeHistory.entries[0].id).toBe('large_1');
      expect(largeHistory.entries[999].id).toBe('large_1000');
    });

    it('should handle mixed chronological order (realistic scenario)', () => {
      // In real scenarios, entries might not be perfectly ordered due to async processing
      const entries: IterationEntry[] = [
        { id: '1', feedback: 'First', timestamp: new Date('2024-01-15T10:00:00Z') },
        { id: '2', feedback: 'Second', timestamp: new Date('2024-01-15T10:05:00Z') },
        { id: '3', feedback: 'Third', timestamp: new Date('2024-01-15T10:03:00Z') }, // Out of order
        { id: '4', feedback: 'Fourth', timestamp: new Date('2024-01-15T10:07:00Z') }
      ];

      const history: IterationHistory = {
        entries: entries,
        totalIterations: 4,
        lastIterationAt: new Date('2024-01-15T10:07:00Z') // Latest regardless of array order
      };

      expect(history.entries).toHaveLength(4);
      expect(history.lastIterationAt?.toISOString()).toBe('2024-01-15T10:07:00.000Z');

      // The implementation can handle out-of-order entries
      const actualLatest = Math.max(...history.entries.map(e => e.timestamp.getTime()));
      expect(history.lastIterationAt?.getTime()).toBe(actualLatest);
    });

    it('should handle empty feedback strings and minimal data', () => {
      const minimalEntry: IterationEntry = {
        id: 'minimal',
        feedback: '', // Empty feedback
        timestamp: new Date()
      };

      const history: IterationHistory = {
        entries: [minimalEntry],
        totalIterations: 1
      };

      expect(history.entries[0].feedback).toBe('');
      expect(typeof history.entries[0].feedback).toBe('string');
    });
  });
});

describe('TaskSessionData integration with IterationHistory', () => {
  describe('iterationHistory field in TaskSessionData', () => {
    it('should accept TaskSessionData with iterationHistory field', () => {
      const iterationHistory: IterationHistory = {
        entries: [
          {
            id: 'session_iter_001',
            feedback: 'Improve error handling in the API',
            timestamp: new Date('2024-01-15T10:00:00Z'),
            stage: 'implementation',
            agent: 'developer'
          }
        ],
        totalIterations: 1,
        lastIterationAt: new Date('2024-01-15T10:00:00Z')
      };

      const sessionData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T09:30:00Z'),
        contextSummary: 'Working on API error handling improvements',
        iterationHistory: iterationHistory
      };

      expect(sessionData.iterationHistory).toBeDefined();
      expect(sessionData.iterationHistory?.entries).toHaveLength(1);
      expect(sessionData.iterationHistory?.totalIterations).toBe(1);
      expect(sessionData.iterationHistory?.entries[0].feedback).toBe('Improve error handling in the API');
    });

    it('should accept TaskSessionData without iterationHistory field', () => {
      const sessionData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T09:30:00Z'),
        contextSummary: 'Initial session without iterations'
      };

      expect(sessionData.iterationHistory).toBeUndefined();
      expect(sessionData.lastCheckpoint).toBeInstanceOf(Date);
      expect(sessionData.contextSummary).toBe('Initial session without iterations');
    });

    it('should accept TaskSessionData with empty iterationHistory', () => {
      const emptyIterationHistory: IterationHistory = {
        entries: [],
        totalIterations: 0
      };

      const sessionData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T09:30:00Z'),
        iterationHistory: emptyIterationHistory
      };

      expect(sessionData.iterationHistory).toBeDefined();
      expect(sessionData.iterationHistory?.entries).toHaveLength(0);
      expect(sessionData.iterationHistory?.totalIterations).toBe(0);
    });

    it('should handle complete TaskSessionData with all fields including iterationHistory', () => {
      const fullIterationHistory: IterationHistory = {
        entries: [
          {
            id: 'complete_iter_001',
            feedback: 'Add authentication middleware',
            timestamp: new Date('2024-01-15T10:00:00Z'),
            stage: 'implementation',
            agent: 'developer',
            diffSummary: 'Added JWT authentication middleware',
            modifiedFiles: ['/src/middleware/auth.ts', '/tests/middleware/auth.test.ts']
          },
          {
            id: 'complete_iter_002',
            feedback: 'Improve test coverage',
            timestamp: new Date('2024-01-15T11:00:00Z'),
            stage: 'testing',
            agent: 'tester',
            diffSummary: 'Added edge case tests and improved coverage to 95%',
            modifiedFiles: ['/tests/auth.test.ts', '/tests/integration/auth-flow.test.ts']
          }
        ],
        totalIterations: 2,
        lastIterationAt: new Date('2024-01-15T11:00:00Z')
      };

      const completeSessionData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T11:30:00Z'),
        contextSummary: 'Completed authentication implementation with comprehensive tests',
        conversationHistory: [
          {
            type: 'user',
            content: [
              {
                type: 'text',
                text: 'Please implement JWT authentication'
              }
            ]
          },
          {
            type: 'assistant',
            content: [
              {
                type: 'text',
                text: 'I\'ll implement JWT authentication with middleware'
              }
            ]
          }
        ],
        stageState: {
          currentStage: 'testing',
          completedStages: ['planning', 'implementation'],
          testCoverage: 95
        },
        resumePoint: {
          stage: 'testing',
          stepIndex: 2,
          metadata: {
            lastAction: 'test_execution',
            nextAction: 'coverage_report'
          }
        },
        iterationHistory: fullIterationHistory
      };

      expect(completeSessionData.iterationHistory).toBeDefined();
      expect(completeSessionData.iterationHistory?.entries).toHaveLength(2);
      expect(completeSessionData.iterationHistory?.totalIterations).toBe(2);
      expect(completeSessionData.lastCheckpoint).toBeInstanceOf(Date);
      expect(completeSessionData.contextSummary).toContain('authentication');
      expect(completeSessionData.conversationHistory).toHaveLength(2);
      expect(completeSessionData.stageState).toBeDefined();
      expect(completeSessionData.resumePoint).toBeDefined();
    });
  });

  describe('session recovery scenarios with iteration history', () => {
    it('should enable session recovery using iteration history context', () => {
      const iterationHistory: IterationHistory = {
        entries: [
          {
            id: 'recovery_iter_001',
            feedback: 'Database connection is failing in production',
            timestamp: new Date('2024-01-15T09:00:00Z'),
            stage: 'debugging',
            agent: 'developer',
            diffSummary: 'Added database connection retry logic'
          },
          {
            id: 'recovery_iter_002',
            feedback: 'Connection timeouts are still occurring',
            timestamp: new Date('2024-01-15T10:00:00Z'),
            stage: 'debugging',
            agent: 'developer',
            diffSummary: 'Increased timeout values and added connection pooling'
          }
        ],
        totalIterations: 2,
        lastIterationAt: new Date('2024-01-15T10:00:00Z')
      };

      const sessionData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T10:30:00Z'),
        contextSummary: 'Debugging database connection issues - applied retry logic and connection pooling',
        resumePoint: {
          stage: 'debugging',
          stepIndex: 3,
          metadata: {
            lastKnownIssue: 'connection_timeout',
            appliedFixes: ['retry_logic', 'connection_pooling'],
            nextStep: 'test_production_environment'
          }
        },
        iterationHistory: iterationHistory
      };

      // Verify session can be reconstructed from iteration history
      const latestIteration = sessionData.iterationHistory?.entries[
        sessionData.iterationHistory.entries.length - 1
      ];

      expect(latestIteration?.feedback).toContain('timeouts');
      expect(latestIteration?.diffSummary).toContain('connection pooling');
      expect(sessionData.resumePoint?.metadata?.appliedFixes).toContain('connection_pooling');
    });

    it('should track iteration patterns for session analysis', () => {
      const iterationHistory: IterationHistory = {
        entries: [
          {
            id: 'pattern_iter_001',
            feedback: 'Add input validation',
            timestamp: new Date('2024-01-15T10:00:00Z'),
            stage: 'implementation'
          },
          {
            id: 'pattern_iter_002',
            feedback: 'Validation is too strict',
            timestamp: new Date('2024-01-15T10:30:00Z'),
            stage: 'implementation'
          },
          {
            id: 'pattern_iter_003',
            feedback: 'Validation is now too permissive',
            timestamp: new Date('2024-01-15T11:00:00Z'),
            stage: 'implementation'
          },
          {
            id: 'pattern_iter_004',
            feedback: 'Find the right balance',
            timestamp: new Date('2024-01-15T11:30:00Z'),
            stage: 'implementation'
          }
        ],
        totalIterations: 4,
        lastIterationAt: new Date('2024-01-15T11:30:00Z')
      };

      const sessionData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T12:00:00Z'),
        iterationHistory: iterationHistory
      };

      // Analyze iteration patterns
      const iterationCount = sessionData.iterationHistory?.totalIterations;
      const sameStageIterations = sessionData.iterationHistory?.entries.filter(
        entry => entry.stage === 'implementation'
      ).length;

      expect(iterationCount).toBe(4);
      expect(sameStageIterations).toBe(4); // All iterations in same stage indicates refinement process

      // Pattern indicates iterative refinement within same stage
      const validationFeedback = sessionData.iterationHistory?.entries.filter(
        entry => entry.feedback.toLowerCase().includes('validation')
      );
      expect(validationFeedback).toHaveLength(3);
    });
  });
});