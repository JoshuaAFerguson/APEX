import { describe, it, expect } from 'vitest';
import type { IterationEntry, IterationHistory, TaskSessionData } from '../types';

describe('IterationHistory Edge Cases and Validation', () => {
  describe('IterationEntry validation edge cases', () => {
    it('should handle empty string values', () => {
      const entry: IterationEntry = {
        id: '',
        feedback: '',
        timestamp: new Date(),
        diffSummary: '',
        stage: '',
        agent: ''
      };

      expect(entry.id).toBe('');
      expect(entry.feedback).toBe('');
      expect(entry.diffSummary).toBe('');
      expect(entry.stage).toBe('');
      expect(entry.agent).toBe('');
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.feedback).toBe('string');
    });

    it('should handle Unicode and special characters in all string fields', () => {
      const entry: IterationEntry = {
        id: 'iter_🎯_001',
        feedback: 'Please fix the issue with émojis 🐛 and "quotes" & special chars: <>&',
        timestamp: new Date(),
        diffSummary: 'Fixed Unicode handling: ñáéíóú and symbols ±∞√',
        stage: 'implémèntation',
        agent: 'dévelôpeur',
        modifiedFiles: [
          '/src/ünicöde/file.ts',
          '/src/émoji-🎉-test.tsx',
          '/tests/"quoted-file".test.ts'
        ]
      };

      expect(entry.id).toContain('🎯');
      expect(entry.feedback).toContain('🐛');
      expect(entry.feedback).toContain('"quotes"');
      expect(entry.diffSummary).toContain('ñáéíóú');
      expect(entry.stage).toContain('é');
      expect(entry.agent).toContain('ô');
      expect(entry.modifiedFiles?.[0]).toContain('ünicöde');
      expect(entry.modifiedFiles?.[1]).toContain('🎉');
      expect(entry.modifiedFiles?.[2]).toContain('"quoted-file"');
    });

    it('should handle very long string values', () => {
      const longId = 'a'.repeat(1000);
      const longFeedback = 'This is a very long feedback message. '.repeat(100);
      const longDiffSummary = 'Long diff summary. '.repeat(50);
      const longStage = 'very-long-stage-name'.repeat(10);
      const longAgent = 'very-long-agent-name'.repeat(10);

      const entry: IterationEntry = {
        id: longId,
        feedback: longFeedback,
        timestamp: new Date(),
        diffSummary: longDiffSummary,
        stage: longStage,
        agent: longAgent
      };

      expect(entry.id.length).toBe(1000);
      expect(entry.feedback.length).toBeGreaterThan(3000);
      expect(entry.diffSummary?.length).toBeGreaterThan(900);
      expect(entry.stage?.length).toBeGreaterThan(190);
      expect(entry.agent?.length).toBeGreaterThan(200);
    });

    it('should handle modifiedFiles with various path formats', () => {
      const entry: IterationEntry = {
        id: 'paths_test',
        feedback: 'Testing various file path formats',
        timestamp: new Date(),
        modifiedFiles: [
          '/absolute/unix/path.ts',
          'relative/path.tsx',
          './current/dir/file.js',
          '../parent/dir/file.vue',
          'C:\\Windows\\path\\file.cs',
          '/very/deeply/nested/path/to/some/very/long/file/name.tsx',
          'file-with-special-chars@#$%^&*().ts',
          'file with spaces.ts',
          'file.with.multiple.dots.test.ts',
          'UPPERCASE-FILE.TS',
          'mixedCase-File_Name123.tsx'
        ]
      };

      expect(entry.modifiedFiles).toHaveLength(11);
      expect(entry.modifiedFiles?.[0]).toBe('/absolute/unix/path.ts');
      expect(entry.modifiedFiles?.[4]).toBe('C:\\Windows\\path\\file.cs');
      expect(entry.modifiedFiles?.[6]).toContain('@#$%^&*()');
      expect(entry.modifiedFiles?.[7]).toContain(' ');
      expect(entry.modifiedFiles?.[8]).toContain('.test.');
      expect(entry.modifiedFiles?.[10]).toBe('mixedCase-File_Name123.tsx');
    });

    it('should handle extreme timestamp values', () => {
      const extremeTimestamps = [
        new Date(0), // Unix epoch start
        new Date(-62167219200000), // Year 0001-01-01
        new Date(253402300799999), // Year 9999-12-31
        new Date('1900-01-01T00:00:00Z'),
        new Date('2100-12-31T23:59:59Z'),
        new Date('2024-02-29T12:00:00Z'), // Leap year
        new Date('2024-12-31T23:59:59.999Z') // End of year with milliseconds
      ];

      extremeTimestamps.forEach((timestamp, index) => {
        const entry: IterationEntry = {
          id: `extreme_time_${index}`,
          feedback: `Testing extreme timestamp ${index}`,
          timestamp: timestamp
        };

        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.timestamp.getTime()).toBe(timestamp.getTime());
        expect(Number.isFinite(entry.timestamp.getTime())).toBe(true);
      });
    });

    it('should handle modifiedFiles with empty array and null-like values', () => {
      const entry: IterationEntry = {
        id: 'empty_files',
        feedback: 'Testing empty file arrays',
        timestamp: new Date(),
        modifiedFiles: []
      };

      expect(entry.modifiedFiles).toEqual([]);
      expect(Array.isArray(entry.modifiedFiles)).toBe(true);
      expect(entry.modifiedFiles.length).toBe(0);
    });

    it('should handle modifiedFiles with duplicate paths', () => {
      const entry: IterationEntry = {
        id: 'duplicate_files',
        feedback: 'Testing duplicate file paths',
        timestamp: new Date(),
        modifiedFiles: [
          '/src/file.ts',
          '/src/file.ts', // Duplicate
          '/src/other.ts',
          '/src/file.ts', // Another duplicate
          '/src/other.ts'  // Another duplicate
        ]
      };

      expect(entry.modifiedFiles).toHaveLength(5);
      expect(entry.modifiedFiles?.filter(file => file === '/src/file.ts')).toHaveLength(3);
      expect(entry.modifiedFiles?.filter(file => file === '/src/other.ts')).toHaveLength(2);
    });

    it('should handle modifiedFiles with very long file paths', () => {
      const longPath = '/very/long/path/that/goes/on/and/on/through/many/directories/and/subdirectories/until/it/reaches/an/extremely/long/filename/that/exceeds/normal/filesystem/limits/and/tests/edge/cases/in/path/handling/functionality.tsx';
      const veryLongFilename = 'this-is-an-extremely-long-filename-that-tests-the-limits-of-what-can-be-handled-by-the-system-when-dealing-with-very-long-file-names-that-might-exceed-normal-expectations-for-file-naming-conventions.test.integration.spec.tsx';

      const entry: IterationEntry = {
        id: 'long_paths',
        feedback: 'Testing very long file paths',
        timestamp: new Date(),
        modifiedFiles: [
          longPath,
          `/src/${veryLongFilename}`,
          '/short.ts'
        ]
      };

      expect(entry.modifiedFiles?.[0]).toBe(longPath);
      expect(entry.modifiedFiles?.[0].length).toBeGreaterThan(200);
      expect(entry.modifiedFiles?.[1]).toContain(veryLongFilename);
      expect(entry.modifiedFiles?.[2]).toBe('/short.ts');
    });
  });

  describe('IterationHistory validation edge cases', () => {
    it('should handle large numbers for totalIterations', () => {
      const history: IterationHistory = {
        entries: [],
        totalIterations: Number.MAX_SAFE_INTEGER,
        lastIterationAt: new Date()
      };

      expect(history.totalIterations).toBe(Number.MAX_SAFE_INTEGER);
      expect(Number.isSafeInteger(history.totalIterations)).toBe(true);
    });

    it('should handle zero and negative totalIterations', () => {
      const zeroHistory: IterationHistory = {
        entries: [],
        totalIterations: 0
      };

      const negativeHistory: IterationHistory = {
        entries: [],
        totalIterations: -1 // Might represent an error state
      };

      expect(zeroHistory.totalIterations).toBe(0);
      expect(negativeHistory.totalIterations).toBe(-1);
    });

    it('should handle mismatched entries array and totalIterations count', () => {
      // Real scenario: keeping only recent entries but tracking total count
      const history: IterationHistory = {
        entries: [
          { id: 'recent_1', feedback: 'Recent', timestamp: new Date('2024-01-15T15:00:00Z') },
          { id: 'recent_2', feedback: 'Most recent', timestamp: new Date('2024-01-15T16:00:00Z') }
        ],
        totalIterations: 100, // Much larger than entries array
        lastIterationAt: new Date('2024-01-15T16:00:00Z')
      };

      expect(history.entries.length).toBe(2);
      expect(history.totalIterations).toBe(100);
      expect(history.totalIterations).toBeGreaterThan(history.entries.length);
    });

    it('should handle entries with inconsistent chronological order', () => {
      // Real scenario: entries might not be perfectly ordered due to async processing
      const history: IterationHistory = {
        entries: [
          { id: '1', feedback: 'First', timestamp: new Date('2024-01-15T10:00:00Z') },
          { id: '2', feedback: 'Third (out of order)', timestamp: new Date('2024-01-15T10:20:00Z') },
          { id: '3', feedback: 'Second (out of order)', timestamp: new Date('2024-01-15T10:10:00Z') },
          { id: '4', feedback: 'Fourth', timestamp: new Date('2024-01-15T10:30:00Z') }
        ],
        totalIterations: 4,
        lastIterationAt: new Date('2024-01-15T10:30:00Z')
      };

      expect(history.entries).toHaveLength(4);
      // Verify that the system can handle out-of-order entries
      expect(history.entries[1].timestamp.getTime()).toBeGreaterThan(history.entries[2].timestamp.getTime());
      expect(history.lastIterationAt?.getTime()).toBe(new Date('2024-01-15T10:30:00Z').getTime());
    });

    it('should handle lastIterationAt that does not match any entry timestamp', () => {
      // Scenario: lastIterationAt represents when the system last processed iterations,
      // not necessarily when the last entry was created
      const history: IterationHistory = {
        entries: [
          { id: '1', feedback: 'Entry', timestamp: new Date('2024-01-15T10:00:00Z') }
        ],
        totalIterations: 1,
        lastIterationAt: new Date('2024-01-15T10:05:00Z') // 5 minutes later
      };

      expect(history.lastIterationAt?.getTime()).toBeGreaterThan(history.entries[0].timestamp.getTime());
    });

    it('should handle very large iteration history with many entries', () => {
      const manyEntries: IterationEntry[] = [];
      const baseTime = new Date('2024-01-15T10:00:00Z').getTime();

      // Create 10,000 iteration entries
      for (let i = 0; i < 10000; i++) {
        manyEntries.push({
          id: `bulk_${i.toString().padStart(5, '0')}`,
          feedback: `Bulk iteration ${i + 1}`,
          timestamp: new Date(baseTime + i * 60000) // 1 minute apart
        });
      }

      const largeHistory: IterationHistory = {
        entries: manyEntries,
        totalIterations: 10000,
        lastIterationAt: manyEntries[manyEntries.length - 1].timestamp
      };

      expect(largeHistory.entries).toHaveLength(10000);
      expect(largeHistory.entries[0].id).toBe('bulk_00000');
      expect(largeHistory.entries[9999].id).toBe('bulk_09999');
      expect(largeHistory.totalIterations).toBe(10000);
    });

    it('should handle concurrent iterations with identical timestamps', () => {
      const concurrentTime = new Date('2024-01-15T10:00:00.000Z');
      const history: IterationHistory = {
        entries: [
          {
            id: 'concurrent_a',
            feedback: 'Feedback from agent A',
            timestamp: concurrentTime,
            agent: 'agent_a'
          },
          {
            id: 'concurrent_b',
            feedback: 'Feedback from agent B',
            timestamp: concurrentTime,
            agent: 'agent_b'
          },
          {
            id: 'concurrent_c',
            feedback: 'Feedback from agent C',
            timestamp: concurrentTime,
            agent: 'agent_c'
          }
        ],
        totalIterations: 3,
        lastIterationAt: concurrentTime
      };

      expect(history.entries).toHaveLength(3);
      history.entries.forEach(entry => {
        expect(entry.timestamp.getTime()).toBe(concurrentTime.getTime());
      });

      // Verify different agents can provide concurrent feedback
      const agents = history.entries.map(e => e.agent);
      expect(new Set(agents).size).toBe(3); // All unique agents
    });
  });

  describe('TaskSessionData integration edge cases', () => {
    it('should handle TaskSessionData with null and undefined optional fields', () => {
      const sessionData: TaskSessionData = {
        lastCheckpoint: new Date(),
        contextSummary: undefined,
        conversationHistory: undefined,
        stageState: undefined,
        resumePoint: undefined,
        iterationHistory: undefined
      };

      expect(sessionData.lastCheckpoint).toBeInstanceOf(Date);
      expect(sessionData.contextSummary).toBeUndefined();
      expect(sessionData.iterationHistory).toBeUndefined();
    });

    it('should handle TaskSessionData with complex nested structures', () => {
      const complexSessionData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T12:00:00Z'),
        contextSummary: 'Complex session with nested data structures',
        conversationHistory: [
          {
            type: 'user',
            content: [
              {
                type: 'text',
                text: 'Please implement feature X'
              }
            ]
          }
        ],
        stageState: {
          currentStage: 'implementation',
          progress: 0.75,
          metadata: {
            nestedObject: {
              deepProperty: 'value',
              arrayProperty: [1, 2, 3]
            }
          }
        },
        resumePoint: {
          stage: 'implementation',
          stepIndex: 5,
          metadata: {
            lastAction: 'code_generation',
            nextAction: 'test_execution',
            context: {
              variables: ['a', 'b', 'c'],
              functions: ['func1', 'func2']
            }
          }
        },
        iterationHistory: {
          entries: [
            {
              id: 'complex_iter_001',
              feedback: 'Complex feedback with special requirements',
              timestamp: new Date('2024-01-15T11:00:00Z'),
              stage: 'implementation',
              agent: 'developer',
              diffSummary: 'Implemented complex feature with nested logic',
              modifiedFiles: [
                '/src/complex/feature.ts',
                '/src/utils/helpers.ts',
                '/tests/complex/feature.test.ts'
              ]
            }
          ],
          totalIterations: 1,
          lastIterationAt: new Date('2024-01-15T11:00:00Z')
        }
      };

      expect(complexSessionData.stageState?.metadata?.nestedObject?.deepProperty).toBe('value');
      expect(complexSessionData.resumePoint?.metadata?.context?.variables).toHaveLength(3);
      expect(complexSessionData.iterationHistory?.entries[0].modifiedFiles).toHaveLength(3);
    });

    it('should handle TaskSessionData checkpoint time consistency', () => {
      const checkpointTime = new Date('2024-01-15T12:00:00Z');
      const iterationTime = new Date('2024-01-15T11:30:00Z');

      const sessionData: TaskSessionData = {
        lastCheckpoint: checkpointTime,
        iterationHistory: {
          entries: [
            {
              id: 'timing_test',
              feedback: 'Testing time relationships',
              timestamp: iterationTime
            }
          ],
          totalIterations: 1,
          lastIterationAt: iterationTime
        }
      };

      // Verify checkpoint is after last iteration
      expect(sessionData.lastCheckpoint.getTime()).toBeGreaterThan(
        sessionData.iterationHistory!.lastIterationAt!.getTime()
      );
    });

    it('should handle memory-efficient iteration history storage', () => {
      // Scenario: Very large iteration history with memory optimization
      const limitedEntries: IterationEntry[] = [
        { id: 'keep_98', feedback: 'Keep recent 1', timestamp: new Date('2024-01-15T10:58:00Z') },
        { id: 'keep_99', feedback: 'Keep recent 2', timestamp: new Date('2024-01-15T10:59:00Z') },
        { id: 'keep_100', feedback: 'Keep latest', timestamp: new Date('2024-01-15T11:00:00Z') }
      ];

      const sessionData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T11:05:00Z'),
        contextSummary: 'Session with memory-optimized iteration history (keeping only 3 most recent)',
        iterationHistory: {
          entries: limitedEntries, // Only recent entries kept in memory
          totalIterations: 100, // Total count including historical entries
          lastIterationAt: new Date('2024-01-15T11:00:00Z')
        }
      };

      expect(sessionData.iterationHistory?.entries).toHaveLength(3);
      expect(sessionData.iterationHistory?.totalIterations).toBe(100);
      expect(sessionData.iterationHistory?.totalIterations).toBeGreaterThan(
        sessionData.iterationHistory?.entries.length
      );
    });

    it('should handle invalid or corrupted iteration data gracefully', () => {
      // Simulate partially corrupted data that might occur in edge cases
      const sessionDataWithPartialData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T12:00:00Z'),
        contextSummary: 'Session with some missing iteration data',
        iterationHistory: {
          entries: [
            {
              id: 'valid_entry',
              feedback: 'This is a valid entry',
              timestamp: new Date('2024-01-15T11:00:00Z'),
              stage: 'implementation'
            },
            // Minimal entry with only required fields
            {
              id: 'minimal_entry',
              feedback: '', // Empty feedback
              timestamp: new Date('2024-01-15T11:30:00Z')
              // Missing all optional fields
            }
          ],
          totalIterations: 2,
          lastIterationAt: new Date('2024-01-15T11:30:00Z')
        }
      };

      expect(sessionDataWithPartialData.iterationHistory?.entries).toHaveLength(2);
      expect(sessionDataWithPartialData.iterationHistory?.entries[0].stage).toBe('implementation');
      expect(sessionDataWithPartialData.iterationHistory?.entries[1].stage).toBeUndefined();
      expect(sessionDataWithPartialData.iterationHistory?.entries[1].feedback).toBe('');
    });
  });

  describe('Performance and memory edge cases', () => {
    it('should handle rapid iteration creation (stress test)', () => {
      const rapidIterations: IterationEntry[] = [];
      const startTime = Date.now();

      // Create 1000 iterations rapidly
      for (let i = 0; i < 1000; i++) {
        rapidIterations.push({
          id: `rapid_${i}`,
          feedback: `Rapid feedback ${i}`,
          timestamp: new Date(startTime + i) // 1ms apart
        });
      }

      const history: IterationHistory = {
        entries: rapidIterations,
        totalIterations: 1000,
        lastIterationAt: rapidIterations[rapidIterations.length - 1].timestamp
      };

      expect(history.entries).toHaveLength(1000);
      expect(history.entries[0].id).toBe('rapid_0');
      expect(history.entries[999].id).toBe('rapid_999');

      // Verify timestamps are incrementing
      for (let i = 1; i < 10; i++) {
        expect(history.entries[i].timestamp.getTime())
          .toBeGreaterThan(history.entries[i - 1].timestamp.getTime());
      }
    });

    it('should handle iteration history with mixed data sizes', () => {
      const mixedSizeEntries: IterationEntry[] = [
        // Small entry
        {
          id: 'small',
          feedback: 'Small',
          timestamp: new Date('2024-01-15T10:00:00Z')
        },
        // Medium entry
        {
          id: 'medium',
          feedback: 'Medium feedback with more details about the changes needed.',
          timestamp: new Date('2024-01-15T10:30:00Z'),
          stage: 'implementation',
          agent: 'developer',
          diffSummary: 'Made several changes to improve functionality'
        },
        // Large entry
        {
          id: 'large',
          feedback: 'Large feedback entry with extensive details. '.repeat(100),
          timestamp: new Date('2024-01-15T11:00:00Z'),
          stage: 'testing',
          agent: 'tester',
          diffSummary: 'Comprehensive changes across multiple areas. '.repeat(50),
          modifiedFiles: Array.from({ length: 50 }, (_, i) => `/src/large/file${i}.ts`)
        }
      ];

      const history: IterationHistory = {
        entries: mixedSizeEntries,
        totalIterations: 3,
        lastIterationAt: new Date('2024-01-15T11:00:00Z')
      };

      expect(history.entries[0].feedback.length).toBeLessThan(20);
      expect(history.entries[1].feedback.length).toBeLessThan(200);
      expect(history.entries[2].feedback.length).toBeGreaterThan(1000);
      expect(history.entries[2].modifiedFiles).toHaveLength(50);
    });

    it('should handle iteration history serialization/deserialization patterns', () => {
      const originalHistory: IterationHistory = {
        entries: [
          {
            id: 'serialization_test',
            feedback: 'Testing serialization behavior',
            timestamp: new Date('2024-01-15T10:00:00Z'),
            stage: 'testing',
            agent: 'tester',
            modifiedFiles: ['/test/serialization.test.ts']
          }
        ],
        totalIterations: 1,
        lastIterationAt: new Date('2024-01-15T10:00:00Z')
      };

      // Simulate JSON serialization/deserialization
      const serialized = JSON.stringify(originalHistory);
      const deserialized = JSON.parse(serialized);

      // Restore Date objects (as they become strings in JSON)
      deserialized.entries[0].timestamp = new Date(deserialized.entries[0].timestamp);
      deserialized.lastIterationAt = new Date(deserialized.lastIterationAt);

      const restoredHistory: IterationHistory = deserialized;

      expect(restoredHistory.entries[0].id).toBe(originalHistory.entries[0].id);
      expect(restoredHistory.entries[0].timestamp).toBeInstanceOf(Date);
      expect(restoredHistory.entries[0].timestamp.getTime())
        .toBe(originalHistory.entries[0].timestamp.getTime());
      expect(restoredHistory.lastIterationAt).toBeInstanceOf(Date);
    });
  });
});

describe('Real-world usage patterns and integration', () => {
  it('should support common iteration history queries and filters', () => {
    const realWorldHistory: IterationHistory = {
      entries: [
        { id: 'rw_001', feedback: 'Fix authentication bug', timestamp: new Date('2024-01-15T09:00:00Z'), stage: 'implementation', agent: 'developer' },
        { id: 'rw_002', feedback: 'Add error handling to auth flow', timestamp: new Date('2024-01-15T10:00:00Z'), stage: 'implementation', agent: 'developer' },
        { id: 'rw_003', feedback: 'Authentication tests failing', timestamp: new Date('2024-01-15T11:00:00Z'), stage: 'testing', agent: 'tester' },
        { id: 'rw_004', feedback: 'Fix test assertions', timestamp: new Date('2024-01-15T12:00:00Z'), stage: 'testing', agent: 'tester' },
        { id: 'rw_005', feedback: 'Code looks good for authentication', timestamp: new Date('2024-01-15T13:00:00Z'), stage: 'review', agent: 'reviewer' }
      ],
      totalIterations: 5,
      lastIterationAt: new Date('2024-01-15T13:00:00Z')
    };

    // Common queries that applications might perform:

    // 1. Get all feedback for a specific stage
    const implementationFeedback = realWorldHistory.entries.filter(e => e.stage === 'implementation');
    expect(implementationFeedback).toHaveLength(2);

    // 2. Get latest feedback
    const latestFeedback = realWorldHistory.entries[realWorldHistory.entries.length - 1];
    expect(latestFeedback.stage).toBe('review');

    // 3. Get feedback containing specific keywords
    const authFeedback = realWorldHistory.entries.filter(e =>
      e.feedback.toLowerCase().includes('auth')
    );
    expect(authFeedback).toHaveLength(4);

    // 4. Get feedback from specific agent
    const developerFeedback = realWorldHistory.entries.filter(e => e.agent === 'developer');
    expect(developerFeedback).toHaveLength(2);

    // 5. Get chronological progression of stages
    const stageProgression = realWorldHistory.entries.map(e => e.stage);
    expect(stageProgression).toEqual(['implementation', 'implementation', 'testing', 'testing', 'review']);
  });

  it('should support iteration history aggregation and analysis', () => {
    const analyticsHistory: IterationHistory = {
      entries: [
        { id: 'a_001', feedback: 'Initial requirement', timestamp: new Date('2024-01-15T09:00:00Z'), stage: 'planning', agent: 'planner' },
        { id: 'a_002', feedback: 'Refine requirements', timestamp: new Date('2024-01-15T09:30:00Z'), stage: 'planning', agent: 'planner' },
        { id: 'a_003', feedback: 'Start implementation', timestamp: new Date('2024-01-15T10:00:00Z'), stage: 'implementation', agent: 'developer' },
        { id: 'a_004', feedback: 'Fix implementation issue', timestamp: new Date('2024-01-15T11:00:00Z'), stage: 'implementation', agent: 'developer' },
        { id: 'a_005', feedback: 'Another implementation fix', timestamp: new Date('2024-01-15T12:00:00Z'), stage: 'implementation', agent: 'developer' },
        { id: 'a_006', feedback: 'Add comprehensive tests', timestamp: new Date('2024-01-15T14:00:00Z'), stage: 'testing', agent: 'tester' },
        { id: 'a_007', feedback: 'Final review approval', timestamp: new Date('2024-01-15T15:00:00Z'), stage: 'review', agent: 'reviewer' }
      ],
      totalIterations: 7,
      lastIterationAt: new Date('2024-01-15T15:00:00Z')
    };

    // Analytics that might be performed:

    // 1. Count iterations per stage
    const stageIterationCounts = analyticsHistory.entries.reduce((counts, entry) => {
      const stage = entry.stage || 'unknown';
      counts[stage] = (counts[stage] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    expect(stageIterationCounts.planning).toBe(2);
    expect(stageIterationCounts.implementation).toBe(3);
    expect(stageIterationCounts.testing).toBe(1);
    expect(stageIterationCounts.review).toBe(1);

    // 2. Calculate time spent in each stage
    const stageTimings = analyticsHistory.entries.reduce((timings, entry, index) => {
      const stage = entry.stage || 'unknown';
      if (index === 0) {
        timings[stage] = { start: entry.timestamp, end: entry.timestamp };
      } else {
        if (!timings[stage]) {
          timings[stage] = { start: entry.timestamp, end: entry.timestamp };
        } else {
          timings[stage].end = entry.timestamp;
        }
      }
      return timings;
    }, {} as Record<string, { start: Date; end: Date }>);

    // Implementation stage took longest (3 iterations over 2 hours)
    const implDuration = stageTimings.implementation.end.getTime() - stageTimings.implementation.start.getTime();
    expect(implDuration).toBe(2 * 60 * 60 * 1000); // 2 hours in milliseconds

    // 3. Identify stages with high iteration counts (indicating complexity or issues)
    const highIterationStages = Object.entries(stageIterationCounts)
      .filter(([_, count]) => count >= 3)
      .map(([stage]) => stage);

    expect(highIterationStages).toContain('implementation');
  });

  it('should support workflow resumption using iteration history context', () => {
    const resumptionHistory: IterationHistory = {
      entries: [
        {
          id: 'resume_001',
          feedback: 'Database connection failing intermittently',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          stage: 'debugging',
          agent: 'developer',
          diffSummary: 'Added connection retry logic'
        },
        {
          id: 'resume_002',
          feedback: 'Retry logic helps but timeouts still occur',
          timestamp: new Date('2024-01-15T11:00:00Z'),
          stage: 'debugging',
          agent: 'developer',
          diffSummary: 'Increased timeout values and added connection pooling'
        },
        {
          id: 'resume_003',
          feedback: 'Connection pooling improved stability, need monitoring',
          timestamp: new Date('2024-01-15T12:00:00Z'),
          stage: 'implementation',
          agent: 'developer',
          diffSummary: 'Added monitoring and alerting for connection health'
        }
      ],
      totalIterations: 3,
      lastIterationAt: new Date('2024-01-15T12:00:00Z')
    };

    const sessionData: TaskSessionData = {
      lastCheckpoint: new Date('2024-01-15T12:30:00Z'),
      contextSummary: 'Database connection stability improvements - implemented retry logic, connection pooling, and monitoring',
      resumePoint: {
        stage: 'testing',
        stepIndex: 1,
        metadata: {
          lastKnownState: 'connection_monitoring_added',
          nextActions: ['test_connection_stability', 'verify_monitoring_alerts'],
          appliedFixes: ['retry_logic', 'connection_pooling', 'health_monitoring']
        }
      },
      iterationHistory: resumptionHistory
    };

    // Verify workflow context can be reconstructed from iteration history
    const progressSummary = sessionData.iterationHistory?.entries.map(entry => ({
      stage: entry.stage,
      issue: entry.feedback,
      solution: entry.diffSummary
    }));

    expect(progressSummary?.[0].issue).toContain('connection failing');
    expect(progressSummary?.[0].solution).toContain('retry logic');
    expect(progressSummary?.[1].solution).toContain('connection pooling');
    expect(progressSummary?.[2].solution).toContain('monitoring');

    // Verify next steps can be determined from context
    const nextActions = sessionData.resumePoint?.metadata?.nextActions as string[];
    expect(nextActions).toContain('test_connection_stability');
    expect(nextActions).toContain('verify_monitoring_alerts');
  });
});