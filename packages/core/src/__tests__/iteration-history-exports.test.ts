import { describe, it, expect } from 'vitest';
import type { IterationEntry, IterationHistory, TaskSessionData } from '../index';

describe('IterationHistory Types Export Verification', () => {
  it('should properly export IterationEntry from package index', () => {
    // Test that IterationEntry can be imported and used from package index
    const entry: IterationEntry = {
      id: 'export_test_001',
      feedback: 'Testing export from package index',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      stage: 'testing',
      agent: 'tester',
      diffSummary: 'Verified type exports work correctly',
      modifiedFiles: ['/tests/exports.test.ts']
    };

    expect(entry.id).toBe('export_test_001');
    expect(entry.feedback).toBe('Testing export from package index');
    expect(entry.timestamp).toBeInstanceOf(Date);
    expect(entry.stage).toBe('testing');
    expect(entry.agent).toBe('tester');
    expect(entry.diffSummary).toBe('Verified type exports work correctly');
    expect(entry.modifiedFiles).toEqual(['/tests/exports.test.ts']);
  });

  it('should properly export IterationHistory from package index', () => {
    // Test that IterationHistory can be imported and used from package index
    const history: IterationHistory = {
      entries: [
        {
          id: 'export_hist_001',
          feedback: 'First export test entry',
          timestamp: new Date('2024-01-15T10:00:00Z')
        },
        {
          id: 'export_hist_002',
          feedback: 'Second export test entry',
          timestamp: new Date('2024-01-15T11:00:00Z')
        }
      ],
      totalIterations: 2,
      lastIterationAt: new Date('2024-01-15T11:00:00Z')
    };

    expect(history.entries).toHaveLength(2);
    expect(history.totalIterations).toBe(2);
    expect(history.lastIterationAt).toBeInstanceOf(Date);
    expect(history.entries[0].id).toBe('export_hist_001');
    expect(history.entries[1].id).toBe('export_hist_002');
  });

  it('should properly export TaskSessionData with iterationHistory from package index', () => {
    // Test that TaskSessionData with iterationHistory can be imported and used from package index
    const sessionData: TaskSessionData = {
      lastCheckpoint: new Date('2024-01-15T12:00:00Z'),
      contextSummary: 'Testing TaskSessionData export with iteration history',
      iterationHistory: {
        entries: [
          {
            id: 'session_export_001',
            feedback: 'Testing session data export functionality',
            timestamp: new Date('2024-01-15T11:30:00Z'),
            stage: 'testing',
            agent: 'tester'
          }
        ],
        totalIterations: 1,
        lastIterationAt: new Date('2024-01-15T11:30:00Z')
      }
    };

    expect(sessionData.lastCheckpoint).toBeInstanceOf(Date);
    expect(sessionData.contextSummary).toContain('iteration history');
    expect(sessionData.iterationHistory).toBeDefined();
    expect(sessionData.iterationHistory?.entries).toHaveLength(1);
    expect(sessionData.iterationHistory?.totalIterations).toBe(1);
    expect(sessionData.iterationHistory?.entries[0].feedback).toContain('export functionality');
  });

  it('should support full iteration workflow using exported types', () => {
    // Complete workflow test using all exported types together

    // Create individual iteration entries
    const planningIteration: IterationEntry = {
      id: 'workflow_001',
      feedback: 'Initial planning feedback',
      timestamp: new Date('2024-01-15T09:00:00Z'),
      stage: 'planning',
      agent: 'planner',
      diffSummary: 'Created initial project structure'
    };

    const implementationIteration: IterationEntry = {
      id: 'workflow_002',
      feedback: 'Implementation needs error handling',
      timestamp: new Date('2024-01-15T11:00:00Z'),
      stage: 'implementation',
      agent: 'developer',
      diffSummary: 'Added comprehensive error handling and input validation',
      modifiedFiles: [
        '/src/services/userService.ts',
        '/src/utils/errorHandler.ts',
        '/src/middleware/validation.ts'
      ]
    };

    const testingIteration: IterationEntry = {
      id: 'workflow_003',
      feedback: 'Add edge case tests',
      timestamp: new Date('2024-01-15T14:00:00Z'),
      stage: 'testing',
      agent: 'tester',
      diffSummary: 'Added comprehensive test suite with edge cases',
      modifiedFiles: [
        '/tests/services/userService.test.ts',
        '/tests/utils/errorHandler.test.ts',
        '/tests/integration/userFlow.test.ts'
      ]
    };

    // Create iteration history
    const workflowHistory: IterationHistory = {
      entries: [planningIteration, implementationIteration, testingIteration],
      totalIterations: 3,
      lastIterationAt: testingIteration.timestamp
    };

    // Create session data with iteration history
    const workflowSession: TaskSessionData = {
      lastCheckpoint: new Date('2024-01-15T14:30:00Z'),
      contextSummary: 'Complete workflow with planning, implementation, and testing iterations',
      iterationHistory: workflowHistory,
      resumePoint: {
        stage: 'review',
        stepIndex: 0,
        metadata: {
          completedStages: ['planning', 'implementation', 'testing'],
          nextStage: 'review',
          readyForReview: true
        }
      }
    };

    // Verify the complete workflow
    expect(workflowSession.iterationHistory?.entries).toHaveLength(3);
    expect(workflowSession.iterationHistory?.totalIterations).toBe(3);

    // Verify stage progression
    const stages = workflowSession.iterationHistory?.entries.map(entry => entry.stage);
    expect(stages).toEqual(['planning', 'implementation', 'testing']);

    // Verify agents involved
    const agents = workflowSession.iterationHistory?.entries.map(entry => entry.agent);
    expect(agents).toEqual(['planner', 'developer', 'tester']);

    // Verify chronological order
    const timestamps = workflowSession.iterationHistory?.entries.map(entry => entry.timestamp.getTime()) || [];
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
    }

    // Verify file tracking across iterations
    const allModifiedFiles = workflowSession.iterationHistory?.entries
      .flatMap(entry => entry.modifiedFiles || []);
    expect(allModifiedFiles).toContain('/src/services/userService.ts');
    expect(allModifiedFiles).toContain('/tests/services/userService.test.ts');
    expect(allModifiedFiles).toHaveLength(6); // 3 + 3 files

    // Verify session can be resumed
    expect(workflowSession.resumePoint?.stage).toBe('review');
    expect(workflowSession.resumePoint?.metadata?.readyForReview).toBe(true);
  });

  it('should handle type compatibility with existing Task interface', () => {
    // Test that TaskSessionData with iterationHistory is compatible with existing Task interface
    // This ensures our new types integrate seamlessly with the existing codebase

    const mockTask: Partial<{
      id: string;
      description: string;
      sessionData: TaskSessionData
    }> = {
      id: 'compatibility_task_001',
      description: 'Test task for type compatibility',
      sessionData: {
        lastCheckpoint: new Date('2024-01-15T15:00:00Z'),
        contextSummary: 'Testing compatibility with existing Task interface',
        iterationHistory: {
          entries: [
            {
              id: 'compat_iter_001',
              feedback: 'Verify type compatibility',
              timestamp: new Date('2024-01-15T14:00:00Z'),
              stage: 'testing',
              agent: 'tester'
            }
          ],
          totalIterations: 1,
          lastIterationAt: new Date('2024-01-15T14:00:00Z')
        }
      }
    };

    expect(mockTask.id).toBe('compatibility_task_001');
    expect(mockTask.sessionData?.iterationHistory).toBeDefined();
    expect(mockTask.sessionData?.iterationHistory?.entries).toHaveLength(1);
    expect(mockTask.sessionData?.iterationHistory?.entries[0].feedback).toContain('compatibility');
  });

  it('should verify type safety and prevent common errors', () => {
    // Test that TypeScript type checking prevents common mistakes

    // Correct usage should compile
    const correctEntry: IterationEntry = {
      id: 'type_safety_001',
      feedback: 'This should work correctly',
      timestamp: new Date()
    };

    expect(correctEntry.id).toBe('type_safety_001');

    // Test that required fields are enforced by TypeScript
    // These would fail TypeScript compilation if uncommented:

    // const missingId: IterationEntry = {
    //   feedback: 'Missing ID field',
    //   timestamp: new Date()
    // };

    // const missingFeedback: IterationEntry = {
    //   id: 'missing_feedback',
    //   timestamp: new Date()
    // };

    // const missingTimestamp: IterationEntry = {
    //   id: 'missing_timestamp',
    //   feedback: 'Missing timestamp field'
    // };

    // Test that optional fields work correctly
    const withOptionalFields: IterationEntry = {
      id: 'with_optional',
      feedback: 'Has optional fields',
      timestamp: new Date(),
      stage: 'testing', // optional
      agent: 'tester',  // optional
      diffSummary: 'Summary', // optional
      modifiedFiles: ['/test.ts'] // optional
    };

    expect(withOptionalFields.stage).toBe('testing');
    expect(withOptionalFields.agent).toBe('tester');

    // Test that arrays are properly typed
    const filesArray: string[] = withOptionalFields.modifiedFiles || [];
    expect(Array.isArray(filesArray)).toBe(true);
  });
});