import { describe, it, expect } from 'vitest';
import type { IterationEntry, IterationHistory, TaskSessionData, Task } from '../types';

describe('IterationHistory Integration Tests', () => {
  describe('Task integration with iteration history', () => {
    it('should support Task with sessionData containing iterationHistory', () => {
      const task: Partial<Task> = {
        id: 'task_with_iterations',
        description: 'Implement user authentication system',
        sessionData: {
          lastCheckpoint: new Date('2024-01-15T12:00:00Z'),
          contextSummary: 'Authentication system implementation with user feedback iterations',
          iterationHistory: {
            entries: [
              {
                id: 'auth_iter_001',
                feedback: 'Use OAuth2 instead of basic auth',
                timestamp: new Date('2024-01-15T10:00:00Z'),
                stage: 'planning',
                agent: 'planner',
                diffSummary: 'Updated authentication strategy to use OAuth2'
              },
              {
                id: 'auth_iter_002',
                feedback: 'Add support for multiple OAuth providers',
                timestamp: new Date('2024-01-15T11:00:00Z'),
                stage: 'implementation',
                agent: 'developer',
                diffSummary: 'Implemented Google, GitHub, and Microsoft OAuth providers',
                modifiedFiles: [
                  '/src/auth/providers/google.ts',
                  '/src/auth/providers/github.ts',
                  '/src/auth/providers/microsoft.ts'
                ]
              }
            ],
            totalIterations: 2,
            lastIterationAt: new Date('2024-01-15T11:00:00Z')
          }
        }
      };

      expect(task.sessionData?.iterationHistory).toBeDefined();
      expect(task.sessionData?.iterationHistory?.entries).toHaveLength(2);
      expect(task.sessionData?.iterationHistory?.entries[0].feedback).toContain('OAuth2');
      expect(task.sessionData?.iterationHistory?.entries[1].modifiedFiles).toHaveLength(3);
    });

    it('should handle multiple tasks each with their own iteration history', () => {
      const task1: Partial<Task> = {
        id: 'auth_task',
        description: 'Authentication system',
        sessionData: {
          lastCheckpoint: new Date(),
          iterationHistory: {
            entries: [
              {
                id: 'auth_iter_001',
                feedback: 'Implement JWT tokens',
                timestamp: new Date('2024-01-15T10:00:00Z')
              }
            ],
            totalIterations: 1,
            lastIterationAt: new Date('2024-01-15T10:00:00Z')
          }
        }
      };

      const task2: Partial<Task> = {
        id: 'ui_task',
        description: 'User interface improvements',
        sessionData: {
          lastCheckpoint: new Date(),
          iterationHistory: {
            entries: [
              {
                id: 'ui_iter_001',
                feedback: 'Make buttons more accessible',
                timestamp: new Date('2024-01-15T11:00:00Z')
              },
              {
                id: 'ui_iter_002',
                feedback: 'Add dark mode support',
                timestamp: new Date('2024-01-15T12:00:00Z')
              }
            ],
            totalIterations: 2,
            lastIterationAt: new Date('2024-01-15T12:00:00Z')
          }
        }
      };

      expect(task1.sessionData?.iterationHistory?.totalIterations).toBe(1);
      expect(task2.sessionData?.iterationHistory?.totalIterations).toBe(2);
      expect(task1.sessionData?.iterationHistory?.entries[0].feedback).toContain('JWT');
      expect(task2.sessionData?.iterationHistory?.entries[0].feedback).toContain('accessible');
      expect(task2.sessionData?.iterationHistory?.entries[1].feedback).toContain('dark mode');
    });
  });

  describe('Cross-agent iteration tracking', () => {
    it('should track iterations across different agents in workflow', () => {
      const workflowIterations: IterationEntry[] = [
        {
          id: 'workflow_001',
          feedback: 'The initial requirements are too vague',
          timestamp: new Date('2024-01-15T09:00:00Z'),
          stage: 'planning',
          agent: 'planner',
          diffSummary: 'Clarified requirements and added acceptance criteria'
        },
        {
          id: 'workflow_002',
          feedback: 'The proposed architecture needs scalability considerations',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          stage: 'architecture',
          agent: 'architect',
          diffSummary: 'Added microservices architecture and load balancing design'
        },
        {
          id: 'workflow_003',
          feedback: 'Implementation needs better error handling',
          timestamp: new Date('2024-01-15T12:00:00Z'),
          stage: 'implementation',
          agent: 'developer',
          diffSummary: 'Added comprehensive error handling and logging',
          modifiedFiles: [
            '/src/services/userService.ts',
            '/src/utils/errorHandler.ts',
            '/src/middleware/errorMiddleware.ts'
          ]
        },
        {
          id: 'workflow_004',
          feedback: 'Need more comprehensive test coverage',
          timestamp: new Date('2024-01-15T14:00:00Z'),
          stage: 'testing',
          agent: 'tester',
          diffSummary: 'Added unit tests, integration tests, and end-to-end tests',
          modifiedFiles: [
            '/tests/services/userService.test.ts',
            '/tests/integration/userFlow.test.ts',
            '/tests/e2e/userJourney.test.ts'
          ]
        },
        {
          id: 'workflow_005',
          feedback: 'Code quality looks good, just minor documentation improvements',
          timestamp: new Date('2024-01-15T15:30:00Z'),
          stage: 'review',
          agent: 'reviewer',
          diffSummary: 'Added comprehensive documentation and code comments',
          modifiedFiles: [
            '/docs/api.md',
            '/docs/architecture.md',
            '/README.md'
          ]
        }
      ];

      const iterationHistory: IterationHistory = {
        entries: workflowIterations,
        totalIterations: 5,
        lastIterationAt: new Date('2024-01-15T15:30:00Z')
      };

      // Verify agent distribution
      const agentCounts = iterationHistory.entries.reduce((counts, entry) => {
        const agent = entry.agent || 'unknown';
        counts[agent] = (counts[agent] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      expect(agentCounts.planner).toBe(1);
      expect(agentCounts.architect).toBe(1);
      expect(agentCounts.developer).toBe(1);
      expect(agentCounts.tester).toBe(1);
      expect(agentCounts.reviewer).toBe(1);

      // Verify stage progression
      const stages = iterationHistory.entries.map(entry => entry.stage);
      expect(stages).toEqual(['planning', 'architecture', 'implementation', 'testing', 'review']);

      // Verify chronological progression
      for (let i = 1; i < iterationHistory.entries.length; i++) {
        expect(iterationHistory.entries[i].timestamp.getTime())
          .toBeGreaterThan(iterationHistory.entries[i - 1].timestamp.getTime());
      }
    });

    it('should handle iterations with agent handoffs and context transfer', () => {
      const handoffIterations: IterationEntry[] = [
        {
          id: 'handoff_001',
          feedback: 'Initial API design complete, passing to developer for implementation',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          stage: 'planning',
          agent: 'planner',
          diffSummary: 'Created API specification and implementation guidelines'
        },
        {
          id: 'handoff_002',
          feedback: 'Implementation started but need clarification on authentication flow',
          timestamp: new Date('2024-01-15T11:00:00Z'),
          stage: 'implementation',
          agent: 'developer',
          diffSummary: 'Partial implementation with questions about auth requirements'
        },
        {
          id: 'handoff_003',
          feedback: 'Clarified auth requirements, developer can proceed with OAuth2',
          timestamp: new Date('2024-01-15T11:30:00Z'),
          stage: 'planning',
          agent: 'planner',
          diffSummary: 'Updated API spec with OAuth2 authentication details'
        },
        {
          id: 'handoff_004',
          feedback: 'OAuth2 implementation complete, ready for testing',
          timestamp: new Date('2024-01-15T13:00:00Z'),
          stage: 'implementation',
          agent: 'developer',
          diffSummary: 'Completed OAuth2 implementation with Google and GitHub providers'
        }
      ];

      const iterationHistory: IterationHistory = {
        entries: handoffIterations,
        totalIterations: 4,
        lastIterationAt: new Date('2024-01-15T13:00:00Z')
      };

      // Verify handoff pattern (planner -> developer -> planner -> developer)
      const agentSequence = iterationHistory.entries.map(entry => entry.agent);
      expect(agentSequence).toEqual(['planner', 'developer', 'planner', 'developer']);

      // Verify context transfer through feedback
      expect(iterationHistory.entries[1].feedback).toContain('need clarification');
      expect(iterationHistory.entries[2].feedback).toContain('Clarified');
      expect(iterationHistory.entries[3].feedback).toContain('complete');
    });
  });

  describe('Iteration history analytics and metrics', () => {
    it('should enable calculation of iteration frequency and patterns', () => {
      const analyticsIterations: IterationEntry[] = [
        { id: '1', feedback: 'Initial feedback', timestamp: new Date('2024-01-15T09:00:00Z'), stage: 'planning' },
        { id: '2', feedback: 'Quick clarification', timestamp: new Date('2024-01-15T09:15:00Z'), stage: 'planning' },
        { id: '3', feedback: 'Implementation feedback', timestamp: new Date('2024-01-15T11:00:00Z'), stage: 'implementation' },
        { id: '4', feedback: 'Code review feedback', timestamp: new Date('2024-01-15T15:00:00Z'), stage: 'review' },
        { id: '5', feedback: 'Final adjustments', timestamp: new Date('2024-01-15T15:30:00Z'), stage: 'review' }
      ];

      const history: IterationHistory = {
        entries: analyticsIterations,
        totalIterations: 5,
        lastIterationAt: new Date('2024-01-15T15:30:00Z')
      };

      // Calculate time between iterations
      const timeBetweenIterations = [];
      for (let i = 1; i < history.entries.length; i++) {
        const timeDiff = history.entries[i].timestamp.getTime() - history.entries[i - 1].timestamp.getTime();
        timeBetweenIterations.push(timeDiff);
      }

      expect(timeBetweenIterations).toHaveLength(4);

      // Quick iteration in planning stage (15 minutes)
      expect(timeBetweenIterations[0]).toBe(15 * 60 * 1000);

      // Longer gap to implementation (1 hour 45 minutes)
      expect(timeBetweenIterations[1]).toBe(105 * 60 * 1000);

      // Calculate iterations per stage
      const stageIterations = history.entries.reduce((counts, entry) => {
        const stage = entry.stage || 'unknown';
        counts[stage] = (counts[stage] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      expect(stageIterations.planning).toBe(2);
      expect(stageIterations.implementation).toBe(1);
      expect(stageIterations.review).toBe(2);
    });

    it('should support filtering and searching iteration history', () => {
      const searchableIterations: IterationEntry[] = [
        {
          id: 'search_001',
          feedback: 'Add authentication to the user login system',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          stage: 'implementation',
          agent: 'developer',
          modifiedFiles: ['/src/auth/login.ts']
        },
        {
          id: 'search_002',
          feedback: 'Fix authentication bug in password validation',
          timestamp: new Date('2024-01-15T11:00:00Z'),
          stage: 'implementation',
          agent: 'developer',
          modifiedFiles: ['/src/auth/validation.ts']
        },
        {
          id: 'search_003',
          feedback: 'Update user interface for better accessibility',
          timestamp: new Date('2024-01-15T12:00:00Z'),
          stage: 'implementation',
          agent: 'developer',
          modifiedFiles: ['/src/components/UserForm.tsx']
        },
        {
          id: 'search_004',
          feedback: 'Add comprehensive authentication tests',
          timestamp: new Date('2024-01-15T13:00:00Z'),
          stage: 'testing',
          agent: 'tester',
          modifiedFiles: ['/tests/auth/login.test.ts']
        }
      ];

      const history: IterationHistory = {
        entries: searchableIterations,
        totalIterations: 4,
        lastIterationAt: new Date('2024-01-15T13:00:00Z')
      };

      // Search by keyword in feedback
      const authRelated = history.entries.filter(entry =>
        entry.feedback.toLowerCase().includes('authentication') ||
        entry.feedback.toLowerCase().includes('auth')
      );
      expect(authRelated).toHaveLength(3);

      // Filter by stage
      const implementationIterations = history.entries.filter(entry => entry.stage === 'implementation');
      expect(implementationIterations).toHaveLength(3);

      // Filter by agent
      const developerIterations = history.entries.filter(entry => entry.agent === 'developer');
      expect(developerIterations).toHaveLength(3);

      // Filter by file changes
      const authFileChanges = history.entries.filter(entry =>
        entry.modifiedFiles?.some(file => file.includes('auth'))
      );
      expect(authFileChanges).toHaveLength(3);

      // Complex query: authentication-related implementation feedback by developer
      const complexFilter = history.entries.filter(entry =>
        entry.feedback.toLowerCase().includes('authentication') &&
        entry.stage === 'implementation' &&
        entry.agent === 'developer'
      );
      expect(complexFilter).toHaveLength(2);
    });

    it('should track iteration impact and effectiveness', () => {
      const impactIterations: IterationEntry[] = [
        {
          id: 'impact_001',
          feedback: 'Add error handling to API endpoints',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          stage: 'implementation',
          diffSummary: 'Added try-catch blocks to all API routes',
          modifiedFiles: [
            '/src/api/users.ts',
            '/src/api/auth.ts',
            '/src/api/products.ts'
          ]
        },
        {
          id: 'impact_002',
          feedback: 'Error handling is too generic, needs specific error types',
          timestamp: new Date('2024-01-15T11:00:00Z'),
          stage: 'review',
          diffSummary: 'Created custom error classes and specific error handling',
          modifiedFiles: [
            '/src/errors/ApiError.ts',
            '/src/errors/ValidationError.ts',
            '/src/api/users.ts',
            '/src/api/auth.ts'
          ]
        },
        {
          id: 'impact_003',
          feedback: 'Error handling looks good now, approved for production',
          timestamp: new Date('2024-01-15T12:00:00Z'),
          stage: 'review',
          diffSummary: 'Final approval with documentation updates',
          modifiedFiles: ['/docs/error-handling.md']
        }
      ];

      const history: IterationHistory = {
        entries: impactIterations,
        totalIterations: 3,
        lastIterationAt: new Date('2024-01-15T12:00:00Z')
      };

      // Track evolution of changes
      const fileChangeEvolution = history.entries.map(entry => ({
        iteration: entry.id,
        filesChanged: entry.modifiedFiles?.length || 0,
        description: entry.diffSummary
      }));

      expect(fileChangeEvolution[0].filesChanged).toBe(3); // Initial broad changes
      expect(fileChangeEvolution[1].filesChanged).toBe(4); // Refinement with more specific changes
      expect(fileChangeEvolution[2].filesChanged).toBe(1); // Final documentation

      // Track approval progression
      const approvalProgression = history.entries.map(entry => entry.feedback);
      expect(approvalProgression[0]).toContain('Add error handling');
      expect(approvalProgression[1]).toContain('too generic');
      expect(approvalProgression[2]).toContain('approved');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle iteration history with missing optional fields gracefully', () => {
      const incompleteIterations: IterationEntry[] = [
        {
          id: 'incomplete_001',
          feedback: 'Basic feedback',
          timestamp: new Date('2024-01-15T10:00:00Z')
          // Missing all optional fields
        },
        {
          id: 'incomplete_002',
          feedback: 'Feedback with stage only',
          timestamp: new Date('2024-01-15T11:00:00Z'),
          stage: 'implementation'
          // Missing other optional fields
        },
        {
          id: 'incomplete_003',
          feedback: 'Feedback with files only',
          timestamp: new Date('2024-01-15T12:00:00Z'),
          modifiedFiles: ['/src/file.ts']
          // Missing stage, agent, diffSummary
        }
      ];

      const history: IterationHistory = {
        entries: incompleteIterations,
        totalIterations: 3,
        lastIterationAt: new Date('2024-01-15T12:00:00Z')
      };

      expect(history.entries).toHaveLength(3);
      expect(history.entries[0].stage).toBeUndefined();
      expect(history.entries[0].agent).toBeUndefined();
      expect(history.entries[1].stage).toBe('implementation');
      expect(history.entries[1].agent).toBeUndefined();
      expect(history.entries[2].modifiedFiles).toEqual(['/src/file.ts']);
    });

    it('should handle concurrent iterations with same timestamp', () => {
      const concurrentTimestamp = new Date('2024-01-15T10:00:00Z');
      const concurrentIterations: IterationEntry[] = [
        {
          id: 'concurrent_001',
          feedback: 'Frontend feedback',
          timestamp: concurrentTimestamp,
          agent: 'ui_developer'
        },
        {
          id: 'concurrent_002',
          feedback: 'Backend feedback',
          timestamp: concurrentTimestamp,
          agent: 'api_developer'
        },
        {
          id: 'concurrent_003',
          feedback: 'DevOps feedback',
          timestamp: concurrentTimestamp,
          agent: 'devops'
        }
      ];

      const history: IterationHistory = {
        entries: concurrentIterations,
        totalIterations: 3,
        lastIterationAt: concurrentTimestamp
      };

      expect(history.entries).toHaveLength(3);
      expect(history.lastIterationAt?.getTime()).toBe(concurrentTimestamp.getTime());

      // All entries have same timestamp
      history.entries.forEach(entry => {
        expect(entry.timestamp.getTime()).toBe(concurrentTimestamp.getTime());
      });

      // Different agents can provide feedback simultaneously
      const agents = history.entries.map(entry => entry.agent);
      expect(agents).toEqual(['ui_developer', 'api_developer', 'devops']);
    });

    it('should handle very large feedback messages and file lists', () => {
      const largeFeedback = 'This is a very detailed feedback message that contains extensive information about the changes needed, including specific technical details, implementation suggestions, code quality improvements, performance optimizations, security considerations, and comprehensive testing requirements. '.repeat(20);

      const manyFiles = Array.from({ length: 100 }, (_, i) => `/src/component${i + 1}.tsx`);

      const largeIteration: IterationEntry = {
        id: 'large_001',
        feedback: largeFeedback,
        timestamp: new Date('2024-01-15T10:00:00Z'),
        diffSummary: 'Major refactoring across entire application with comprehensive changes',
        modifiedFiles: manyFiles
      };

      const history: IterationHistory = {
        entries: [largeIteration],
        totalIterations: 1,
        lastIterationAt: new Date('2024-01-15T10:00:00Z')
      };

      expect(history.entries[0].feedback.length).toBeGreaterThan(1000);
      expect(history.entries[0].modifiedFiles).toHaveLength(100);
      expect(typeof history.entries[0].feedback).toBe('string');
      expect(Array.isArray(history.entries[0].modifiedFiles)).toBe(true);
    });

    it('should handle malformed or unusual timestamps', () => {
      const edgeTimestamps = [
        new Date(0), // Unix epoch
        new Date('2024-01-15T00:00:00.000Z'), // Start of day
        new Date('2024-01-15T23:59:59.999Z'), // End of day
        new Date('2024-02-29T12:00:00Z'), // Leap year
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Future date
      ];

      edgeTimestamps.forEach((timestamp, index) => {
        const entry: IterationEntry = {
          id: `edge_timestamp_${index}`,
          feedback: `Testing edge case timestamp ${index}`,
          timestamp: timestamp
        };

        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.timestamp.getTime()).toBe(timestamp.getTime());
      });

      const history: IterationHistory = {
        entries: edgeTimestamps.map((timestamp, index) => ({
          id: `edge_${index}`,
          feedback: `Entry ${index}`,
          timestamp: timestamp
        })),
        totalIterations: edgeTimestamps.length,
        lastIterationAt: new Date(Math.max(...edgeTimestamps.map(t => t.getTime())))
      };

      expect(history.entries).toHaveLength(edgeTimestamps.length);
      expect(history.lastIterationAt).toBeInstanceOf(Date);
    });
  });
});