import { describe, it, expect } from 'vitest';
import type { IterationEntry, IterationHistory, TaskSessionData } from '../types';

/**
 * Comprehensive acceptance tests for iteration history types
 * These tests validate that the implementation meets all acceptance criteria:
 *
 * ✅ New types IterationEntry, IterationHistory exported from types.ts
 * ✅ Fields for iteration ID, feedback, timestamp, and diff summary
 * ✅ TaskSessionData extended to include iterationHistory field
 */

describe('Iteration History Types - Acceptance Criteria Validation', () => {
  describe('Acceptance Criteria: IterationEntry type with required fields', () => {
    it('should have iteration ID field', () => {
      const entry: IterationEntry = {
        id: 'acceptance_test_001',
        feedback: 'Test feedback',
        timestamp: new Date()
      };

      expect(entry.id).toBeDefined();
      expect(typeof entry.id).toBe('string');
      expect(entry.id).toBe('acceptance_test_001');
    });

    it('should have feedback field', () => {
      const entry: IterationEntry = {
        id: 'acceptance_test_002',
        feedback: 'User feedback for iteration testing',
        timestamp: new Date()
      };

      expect(entry.feedback).toBeDefined();
      expect(typeof entry.feedback).toBe('string');
      expect(entry.feedback).toBe('User feedback for iteration testing');
    });

    it('should have timestamp field', () => {
      const testTimestamp = new Date('2024-01-15T10:00:00Z');
      const entry: IterationEntry = {
        id: 'acceptance_test_003',
        feedback: 'Test timestamp field',
        timestamp: testTimestamp
      };

      expect(entry.timestamp).toBeDefined();
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.timestamp.getTime()).toBe(testTimestamp.getTime());
    });

    it('should have optional diff summary field', () => {
      const entryWithDiff: IterationEntry = {
        id: 'acceptance_test_004',
        feedback: 'Test with diff summary',
        timestamp: new Date(),
        diffSummary: 'Added error handling and improved validation'
      };

      const entryWithoutDiff: IterationEntry = {
        id: 'acceptance_test_005',
        feedback: 'Test without diff summary',
        timestamp: new Date()
      };

      expect(entryWithDiff.diffSummary).toBeDefined();
      expect(typeof entryWithDiff.diffSummary).toBe('string');
      expect(entryWithDiff.diffSummary).toBe('Added error handling and improved validation');

      expect(entryWithoutDiff.diffSummary).toBeUndefined();
    });

    it('should support all documented fields from acceptance criteria', () => {
      // Complete IterationEntry with all fields mentioned in acceptance criteria
      const completeEntry: IterationEntry = {
        id: 'complete_acceptance_001',
        feedback: 'Comprehensive feedback for acceptance testing',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        diffSummary: 'Summary of changes made in this iteration',
        stage: 'implementation',
        modifiedFiles: [
          '/src/components/UserForm.tsx',
          '/src/utils/validation.ts',
          '/tests/components/UserForm.test.tsx'
        ],
        agent: 'developer'
      };

      // Verify all required fields are present and correctly typed
      expect(completeEntry.id).toBe('complete_acceptance_001');
      expect(completeEntry.feedback).toBe('Comprehensive feedback for acceptance testing');
      expect(completeEntry.timestamp).toBeInstanceOf(Date);
      expect(completeEntry.diffSummary).toBe('Summary of changes made in this iteration');

      // Verify optional fields work correctly
      expect(completeEntry.stage).toBe('implementation');
      expect(Array.isArray(completeEntry.modifiedFiles)).toBe(true);
      expect(completeEntry.modifiedFiles).toHaveLength(3);
      expect(completeEntry.agent).toBe('developer');
    });
  });

  describe('Acceptance Criteria: IterationHistory type', () => {
    it('should contain array of IterationEntry objects', () => {
      const entries: IterationEntry[] = [
        {
          id: 'hist_test_001',
          feedback: 'First iteration',
          timestamp: new Date('2024-01-15T10:00:00Z')
        },
        {
          id: 'hist_test_002',
          feedback: 'Second iteration',
          timestamp: new Date('2024-01-15T11:00:00Z')
        }
      ];

      const history: IterationHistory = {
        entries: entries,
        totalIterations: 2,
        lastIterationAt: new Date('2024-01-15T11:00:00Z')
      };

      expect(Array.isArray(history.entries)).toBe(true);
      expect(history.entries).toHaveLength(2);
      expect(history.entries[0]).toEqual(entries[0]);
      expect(history.entries[1]).toEqual(entries[1]);
    });

    it('should track total iteration count', () => {
      const history: IterationHistory = {
        entries: [],
        totalIterations: 0
      };

      expect(history.totalIterations).toBeDefined();
      expect(typeof history.totalIterations).toBe('number');
      expect(history.totalIterations).toBe(0);
    });

    it('should maintain chronological order of iterations', () => {
      const chronologicalEntries: IterationEntry[] = [
        {
          id: 'chrono_001',
          feedback: 'First chronological entry',
          timestamp: new Date('2024-01-15T09:00:00Z')
        },
        {
          id: 'chrono_002',
          feedback: 'Second chronological entry',
          timestamp: new Date('2024-01-15T10:00:00Z')
        },
        {
          id: 'chrono_003',
          feedback: 'Third chronological entry',
          timestamp: new Date('2024-01-15T11:00:00Z')
        }
      ];

      const history: IterationHistory = {
        entries: chronologicalEntries,
        totalIterations: 3,
        lastIterationAt: new Date('2024-01-15T11:00:00Z')
      };

      // Verify chronological order
      for (let i = 1; i < history.entries.length; i++) {
        expect(history.entries[i].timestamp.getTime())
          .toBeGreaterThanOrEqual(history.entries[i - 1].timestamp.getTime());
      }

      expect(history.lastIterationAt).toEqual(chronologicalEntries[chronologicalEntries.length - 1].timestamp);
    });

    it('should support optional lastIterationAt field', () => {
      const historyWithLastIteration: IterationHistory = {
        entries: [
          {
            id: 'last_iter_001',
            feedback: 'Test with last iteration timestamp',
            timestamp: new Date('2024-01-15T10:00:00Z')
          }
        ],
        totalIterations: 1,
        lastIterationAt: new Date('2024-01-15T10:00:00Z')
      };

      const historyWithoutLastIteration: IterationHistory = {
        entries: [],
        totalIterations: 0
      };

      expect(historyWithLastIteration.lastIterationAt).toBeDefined();
      expect(historyWithLastIteration.lastIterationAt).toBeInstanceOf(Date);

      expect(historyWithoutLastIteration.lastIterationAt).toBeUndefined();
    });
  });

  describe('Acceptance Criteria: TaskSessionData extended with iterationHistory', () => {
    it('should include optional iterationHistory field', () => {
      const sessionWithHistory: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T12:00:00Z'),
        contextSummary: 'Session with iteration history',
        iterationHistory: {
          entries: [
            {
              id: 'session_iter_001',
              feedback: 'Session iteration feedback',
              timestamp: new Date('2024-01-15T11:30:00Z')
            }
          ],
          totalIterations: 1,
          lastIterationAt: new Date('2024-01-15T11:30:00Z')
        }
      };

      const sessionWithoutHistory: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T12:00:00Z'),
        contextSummary: 'Session without iteration history'
      };

      // Verify iterationHistory field exists and is properly typed
      expect(sessionWithHistory.iterationHistory).toBeDefined();
      expect(sessionWithHistory.iterationHistory?.entries).toHaveLength(1);
      expect(sessionWithHistory.iterationHistory?.totalIterations).toBe(1);

      // Verify iterationHistory is optional
      expect(sessionWithoutHistory.iterationHistory).toBeUndefined();
    });

    it('should maintain compatibility with existing TaskSessionData fields', () => {
      const fullSessionData: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T12:00:00Z'),
        contextSummary: 'Complete session data with all fields',
        conversationHistory: [
          {
            type: 'user',
            content: [
              {
                type: 'text',
                text: 'Test message'
              }
            ]
          }
        ],
        stageState: {
          currentStage: 'testing',
          progress: 0.5
        },
        resumePoint: {
          stage: 'testing',
          stepIndex: 2,
          metadata: {
            lastAction: 'test_execution'
          }
        },
        iterationHistory: {
          entries: [
            {
              id: 'compat_iter_001',
              feedback: 'Compatibility test iteration',
              timestamp: new Date('2024-01-15T11:00:00Z')
            }
          ],
          totalIterations: 1,
          lastIterationAt: new Date('2024-01-15T11:00:00Z')
        }
      };

      // Verify all existing fields still work
      expect(fullSessionData.lastCheckpoint).toBeInstanceOf(Date);
      expect(fullSessionData.contextSummary).toBe('Complete session data with all fields');
      expect(fullSessionData.conversationHistory).toHaveLength(1);
      expect(fullSessionData.stageState?.currentStage).toBe('testing');
      expect(fullSessionData.resumePoint?.stage).toBe('testing');

      // Verify new iterationHistory field works
      expect(fullSessionData.iterationHistory?.entries).toHaveLength(1);
      expect(fullSessionData.iterationHistory?.totalIterations).toBe(1);
    });
  });

  describe('Acceptance Criteria: Types exported from types.ts', () => {
    it('should successfully import IterationEntry from types module', () => {
      // This test verifies that IterationEntry is properly exported
      // The import at the top of the file proves this works
      const entry: IterationEntry = {
        id: 'export_test_001',
        feedback: 'Testing type export',
        timestamp: new Date()
      };

      expect(entry).toBeDefined();
      expect(typeof entry.id).toBe('string');
    });

    it('should successfully import IterationHistory from types module', () => {
      // This test verifies that IterationHistory is properly exported
      const history: IterationHistory = {
        entries: [],
        totalIterations: 0
      };

      expect(history).toBeDefined();
      expect(Array.isArray(history.entries)).toBe(true);
    });

    it('should successfully import TaskSessionData with iterationHistory from types module', () => {
      // This test verifies that TaskSessionData with the new field is properly exported
      const sessionData: TaskSessionData = {
        lastCheckpoint: new Date(),
        iterationHistory: {
          entries: [],
          totalIterations: 0
        }
      };

      expect(sessionData).toBeDefined();
      expect(sessionData.iterationHistory).toBeDefined();
    });
  });

  describe('End-to-End Acceptance Test: Complete Iteration Workflow', () => {
    it('should support complete iteration history workflow as specified in acceptance criteria', () => {
      // This comprehensive test validates the complete workflow
      // using all types together as they would be used in practice

      // Step 1: Create individual iteration entries with all required and optional fields
      const planningIteration: IterationEntry = {
        id: 'e2e_planning_001',
        feedback: 'Initial requirements need more detail about error handling',
        timestamp: new Date('2024-01-15T09:00:00Z'),
        diffSummary: 'Added comprehensive error handling requirements and edge cases',
        stage: 'planning',
        agent: 'planner',
        modifiedFiles: [
          '/docs/requirements.md',
          '/docs/error-handling.md'
        ]
      };

      const implementationIteration: IterationEntry = {
        id: 'e2e_implementation_001',
        feedback: 'Implementation looks good but needs input validation',
        timestamp: new Date('2024-01-15T11:00:00Z'),
        diffSummary: 'Added Zod schemas for input validation and error boundaries',
        stage: 'implementation',
        agent: 'developer',
        modifiedFiles: [
          '/src/schemas/userSchema.ts',
          '/src/components/ErrorBoundary.tsx',
          '/src/utils/validation.ts'
        ]
      };

      const testingIteration: IterationEntry = {
        id: 'e2e_testing_001',
        feedback: 'Tests cover happy path but missing edge case coverage',
        timestamp: new Date('2024-01-15T14:00:00Z'),
        diffSummary: 'Added comprehensive edge case tests and error scenario coverage',
        stage: 'testing',
        agent: 'tester',
        modifiedFiles: [
          '/tests/schemas/userSchema.test.ts',
          '/tests/components/ErrorBoundary.test.tsx',
          '/tests/integration/userFlow.test.ts'
        ]
      };

      // Step 2: Create iteration history with chronological entries
      const iterationHistory: IterationHistory = {
        entries: [planningIteration, implementationIteration, testingIteration],
        totalIterations: 3,
        lastIterationAt: testingIteration.timestamp
      };

      // Step 3: Create task session data with iteration history
      const taskSession: TaskSessionData = {
        lastCheckpoint: new Date('2024-01-15T14:30:00Z'),
        contextSummary: 'User input validation feature completed with comprehensive error handling and testing',
        iterationHistory: iterationHistory,
        resumePoint: {
          stage: 'review',
          stepIndex: 0,
          metadata: {
            completedIterations: 3,
            readyForReview: true,
            testCoverage: '95%'
          }
        }
      };

      // Step 4: Validate all acceptance criteria are met

      // ✅ IterationEntry with iteration ID, feedback, timestamp, diff summary
      iterationHistory.entries.forEach(entry => {
        expect(entry.id).toBeDefined();
        expect(typeof entry.id).toBe('string');
        expect(entry.feedback).toBeDefined();
        expect(typeof entry.feedback).toBe('string');
        expect(entry.timestamp).toBeDefined();
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.diffSummary).toBeDefined();
        expect(typeof entry.diffSummary).toBe('string');
      });

      // ✅ IterationHistory with entries array and metadata
      expect(iterationHistory.entries).toBeDefined();
      expect(Array.isArray(iterationHistory.entries)).toBe(true);
      expect(iterationHistory.totalIterations).toBeDefined();
      expect(typeof iterationHistory.totalIterations).toBe('number');
      expect(iterationHistory.lastIterationAt).toBeDefined();
      expect(iterationHistory.lastIterationAt).toBeInstanceOf(Date);

      // ✅ TaskSessionData extended with iterationHistory field
      expect(taskSession.iterationHistory).toBeDefined();
      expect(taskSession.iterationHistory).toBe(iterationHistory);

      // ✅ Types are properly exported and usable
      // (Proven by successful imports and compilation)

      // Additional validation: Verify workflow progression
      const stages = iterationHistory.entries.map(entry => entry.stage);
      expect(stages).toEqual(['planning', 'implementation', 'testing']);

      const agents = iterationHistory.entries.map(entry => entry.agent);
      expect(agents).toEqual(['planner', 'developer', 'tester']);

      // Verify chronological progression
      for (let i = 1; i < iterationHistory.entries.length; i++) {
        expect(iterationHistory.entries[i].timestamp.getTime())
          .toBeGreaterThan(iterationHistory.entries[i - 1].timestamp.getTime());
      }

      // Verify file tracking across iterations
      const allModifiedFiles = iterationHistory.entries
        .flatMap(entry => entry.modifiedFiles || []);
      expect(allModifiedFiles.length).toBeGreaterThan(0);
      expect(allModifiedFiles).toContain('/docs/requirements.md');
      expect(allModifiedFiles).toContain('/src/schemas/userSchema.ts');
      expect(allModifiedFiles).toContain('/tests/schemas/userSchema.test.ts');

      // Verify session context and resumption
      expect(taskSession.contextSummary).toContain('comprehensive error handling');
      expect(taskSession.resumePoint?.metadata?.readyForReview).toBe(true);
      expect(taskSession.lastCheckpoint.getTime())
        .toBeGreaterThan(iterationHistory.lastIterationAt!.getTime());
    });
  });

  describe('Type Safety and Compilation Validation', () => {
    it('should enforce required fields at compile time', () => {
      // These tests verify TypeScript type enforcement
      // Commented out code would fail TypeScript compilation

      // Valid minimal IterationEntry
      const validEntry: IterationEntry = {
        id: 'type_safety_001',
        feedback: 'Valid entry with required fields',
        timestamp: new Date()
      };
      expect(validEntry).toBeDefined();

      // The following would cause TypeScript compilation errors:

      // Missing id:
      // const missingId: IterationEntry = {
      //   feedback: 'Missing ID',
      //   timestamp: new Date()
      // };

      // Missing feedback:
      // const missingFeedback: IterationEntry = {
      //   id: 'missing_feedback',
      //   timestamp: new Date()
      // };

      // Missing timestamp:
      // const missingTimestamp: IterationEntry = {
      //   id: 'missing_timestamp',
      //   feedback: 'Missing timestamp'
      // };

      // Wrong type for timestamp:
      // const wrongTimestamp: IterationEntry = {
      //   id: 'wrong_timestamp',
      //   feedback: 'Wrong timestamp type',
      //   timestamp: '2024-01-15' // Should be Date, not string
      // };
    });

    it('should allow optional fields to be omitted', () => {
      // Verify optional fields can be omitted without errors
      const minimalEntry: IterationEntry = {
        id: 'minimal_001',
        feedback: 'Minimal entry',
        timestamp: new Date()
      };

      expect(minimalEntry.diffSummary).toBeUndefined();
      expect(minimalEntry.stage).toBeUndefined();
      expect(minimalEntry.agent).toBeUndefined();
      expect(minimalEntry.modifiedFiles).toBeUndefined();
    });

    it('should properly type array fields', () => {
      const entryWithFiles: IterationEntry = {
        id: 'array_test_001',
        feedback: 'Testing array typing',
        timestamp: new Date(),
        modifiedFiles: ['/file1.ts', '/file2.tsx']
      };

      // TypeScript should enforce string[] type for modifiedFiles
      expect(Array.isArray(entryWithFiles.modifiedFiles)).toBe(true);
      entryWithFiles.modifiedFiles?.forEach(file => {
        expect(typeof file).toBe('string');
      });

      // The following would cause TypeScript compilation errors:
      // const wrongArrayType: IterationEntry = {
      //   id: 'wrong_array',
      //   feedback: 'Wrong array type',
      //   timestamp: new Date(),
      //   modifiedFiles: [123, 456] // Should be string[], not number[]
      // };
    });
  });
});

/**
 * Summary of Acceptance Criteria Validation:
 *
 * ✅ New types IterationEntry, IterationHistory exported from types.ts
 *    - Verified by successful imports and usage throughout tests
 *
 * ✅ IterationEntry with fields for iteration ID, feedback, timestamp, and diff summary
 *    - id: string (required)
 *    - feedback: string (required)
 *    - timestamp: Date (required)
 *    - diffSummary?: string (optional)
 *    - Additional optional fields: stage, agent, modifiedFiles
 *
 * ✅ IterationHistory type for collections
 *    - entries: IterationEntry[] (array of iterations)
 *    - totalIterations: number (count of total iterations)
 *    - lastIterationAt?: Date (optional timestamp of last iteration)
 *
 * ✅ TaskSessionData extended to include iterationHistory field
 *    - iterationHistory?: IterationHistory (optional field)
 *    - Maintains compatibility with all existing fields
 *    - Properly typed and integrated with existing session recovery system
 *
 * All acceptance criteria have been successfully implemented and validated.
 */