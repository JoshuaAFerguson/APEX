import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TasksAutoResumedEvent } from './index';

describe('TasksAutoResumedEvent', () => {
  describe('Interface Type Validation', () => {
    it('should accept basic event without optional fields', () => {
      const basicEvent: TasksAutoResumedEvent = {
        reason: 'capacity_restored',
        totalTasks: 3,
        resumedCount: 2,
        errors: [],
        timestamp: new Date(),
      };

      expect(basicEvent).toMatchObject({
        reason: 'capacity_restored',
        totalTasks: 3,
        resumedCount: 2,
        errors: [],
        timestamp: expect.any(Date),
      });
      expect(basicEvent.resumeReason).toBeUndefined();
      expect(basicEvent.contextSummary).toBeUndefined();
    });

    it('should accept event with resumeReason only', () => {
      const eventWithResumeReason: TasksAutoResumedEvent = {
        reason: 'budget_reset',
        totalTasks: 1,
        resumedCount: 1,
        errors: [],
        timestamp: new Date(),
        resumeReason: 'Budget reset triggered at midnight, capacity restored for urgent priority tasks',
      };

      expect(eventWithResumeReason.resumeReason).toBe(
        'Budget reset triggered at midnight, capacity restored for urgent priority tasks'
      );
      expect(eventWithResumeReason.contextSummary).toBeUndefined();
    });

    it('should accept event with contextSummary only', () => {
      const eventWithContextSummary: TasksAutoResumedEvent = {
        reason: 'mode_switch',
        totalTasks: 2,
        resumedCount: 2,
        errors: [],
        timestamp: new Date(),
        contextSummary: 'Resumed 2 tasks: feature implementation (auth-service) and bug fix (session timeout)',
      };

      expect(eventWithContextSummary.contextSummary).toBe(
        'Resumed 2 tasks: feature implementation (auth-service) and bug fix (session timeout)'
      );
      expect(eventWithContextSummary.resumeReason).toBeUndefined();
    });

    it('should accept event with both new optional fields', () => {
      const fullEvent: TasksAutoResumedEvent = {
        reason: 'capacity_dropped',
        totalTasks: 5,
        resumedCount: 4,
        errors: [{ taskId: 'task-5', error: 'Resume failed due to missing dependencies' }],
        timestamp: new Date(),
        resumeReason: 'System load decreased below threshold, additional capacity available for paused tasks',
        contextSummary: 'Successfully resumed 4 of 5 tasks: 2 feature developments, 1 refactoring task, 1 documentation update. 1 task failed due to dependency issues.',
      };

      expect(fullEvent).toMatchObject({
        reason: 'capacity_dropped',
        totalTasks: 5,
        resumedCount: 4,
        errors: [{ taskId: 'task-5', error: 'Resume failed due to missing dependencies' }],
        timestamp: expect.any(Date),
        resumeReason: 'System load decreased below threshold, additional capacity available for paused tasks',
        contextSummary: 'Successfully resumed 4 of 5 tasks: 2 feature developments, 1 refactoring task, 1 documentation update. 1 task failed due to dependency issues.',
      });
    });

    it('should handle empty strings for optional fields', () => {
      const eventWithEmptyStrings: TasksAutoResumedEvent = {
        reason: 'usage_limit',
        totalTasks: 0,
        resumedCount: 0,
        errors: [],
        timestamp: new Date(),
        resumeReason: '',
        contextSummary: '',
      };

      expect(eventWithEmptyStrings.resumeReason).toBe('');
      expect(eventWithEmptyStrings.contextSummary).toBe('');
    });

    it('should preserve all required fields', () => {
      const event: TasksAutoResumedEvent = {
        reason: 'midnight_reset',
        totalTasks: 10,
        resumedCount: 8,
        errors: [
          { taskId: 'task-1', error: 'Network timeout' },
          { taskId: 'task-2', error: 'Invalid state' },
        ],
        timestamp: new Date('2024-01-15T00:00:00Z'),
        resumeReason: 'Daily budget reset occurred',
        contextSummary: 'Resumed high-priority tasks after daily reset',
      };

      // Verify all required fields are present
      expect(event.reason).toBe('midnight_reset');
      expect(event.totalTasks).toBe(10);
      expect(event.resumedCount).toBe(8);
      expect(event.errors).toHaveLength(2);
      expect(event.timestamp).toBeInstanceOf(Date);

      // Verify new optional fields
      expect(event.resumeReason).toBe('Daily budget reset occurred');
      expect(event.contextSummary).toBe('Resumed high-priority tasks after daily reset');
    });
  });

  describe('Real-world Event Scenarios', () => {
    it('should handle capacity restoration event with detailed context', () => {
      const event: TasksAutoResumedEvent = {
        reason: 'capacity_restored',
        totalTasks: 7,
        resumedCount: 5,
        errors: [
          { taskId: 'task-feature-auth', error: 'Missing API credentials' },
          { taskId: 'task-migrate-db', error: 'Database connection failed' },
        ],
        timestamp: new Date(),
        resumeReason: 'System capacity increased after completing batch job processing. CPU usage dropped below 60% threshold, enabling task resumption.',
        contextSummary: 'Resumed 5 development tasks: 2 feature implementations, 2 bug fixes, and 1 refactoring task. Failed to resume 2 tasks due to infrastructure dependencies.',
      };

      expect(event.resumedCount).toBeLessThan(event.totalTasks);
      expect(event.errors).toHaveLength(event.totalTasks - event.resumedCount);
      expect(event.resumeReason).toContain('capacity');
      expect(event.contextSummary).toContain('development tasks');
    });

    it('should handle budget reset scenario', () => {
      const event: TasksAutoResumedEvent = {
        reason: 'budget_reset',
        totalTasks: 3,
        resumedCount: 3,
        errors: [],
        timestamp: new Date(),
        resumeReason: 'Daily budget limit reset at midnight UTC. All paused tasks eligible for resumption based on priority queue.',
        contextSummary: 'All 3 paused tasks successfully resumed: urgent bug fix for production issue, high-priority feature development, and routine maintenance task.',
      };

      expect(event.resumedCount).toBe(event.totalTasks);
      expect(event.errors).toHaveLength(0);
      expect(event.resumeReason).toContain('budget');
      expect(event.contextSummary).toContain('urgent');
    });

    it('should handle mode switch scenario', () => {
      const event: TasksAutoResumedEvent = {
        reason: 'mode_switch',
        totalTasks: 4,
        resumedCount: 2,
        errors: [
          { taskId: 'task-low-priority', error: 'Task priority below night mode threshold' },
          { taskId: 'task-requires-human', error: 'Manual approval required for sensitive operation' },
        ],
        timestamp: new Date(),
        resumeReason: 'Switched from day mode to night mode. Relaxed capacity constraints allow for additional concurrent task execution.',
        contextSummary: 'Resumed 2 high-priority tasks suitable for night mode execution. 2 tasks remain paused due to priority and approval requirements.',
      };

      expect(event.reason).toBe('mode_switch');
      expect(event.errors).toHaveLength(2);
      expect(event.resumeReason).toContain('night mode');
      expect(event.contextSummary).toContain('high-priority');
    });

    it('should handle no tasks resumed scenario', () => {
      const event: TasksAutoResumedEvent = {
        reason: 'capacity_dropped',
        totalTasks: 2,
        resumedCount: 0,
        errors: [
          { taskId: 'task-blocked', error: 'Dependency task still running' },
          { taskId: 'task-failed', error: 'Previous execution resulted in non-recoverable error' },
        ],
        timestamp: new Date(),
        resumeReason: 'Capacity monitoring detected available resources, but paused tasks could not be resumed due to blocking conditions.',
        contextSummary: 'No tasks resumed. All paused tasks have unmet dependencies or are in non-resumable states.',
      };

      expect(event.resumedCount).toBe(0);
      expect(event.errors).toHaveLength(event.totalTasks);
      expect(event.resumeReason).toContain('available resources');
      expect(event.contextSummary).toContain('No tasks resumed');
    });

    it('should handle partial success with mixed error types', () => {
      const event: TasksAutoResumedEvent = {
        reason: 'usage_limit',
        totalTasks: 6,
        resumedCount: 3,
        errors: [
          { taskId: 'task-timeout', error: 'Resume operation timed out after 30 seconds' },
          { taskId: 'task-conflict', error: 'Task conflicts with currently running operation' },
          { taskId: 'task-invalid', error: 'Task state corrupted, cannot resume safely' },
        ],
        timestamp: new Date(),
        resumeReason: 'Usage limits reset for new billing period. Token quota restored to full capacity.',
        contextSummary: 'Resumed 3 of 6 tasks successfully. Mix of feature development and maintenance tasks now active. 3 tasks failed resume due to technical issues requiring investigation.',
      };

      expect(event.resumedCount).toBe(event.totalTasks / 2);
      expect(event.errors).toHaveLength(3);
      expect(event.errors.every(error => error.error.length > 0)).toBe(true);
      expect(event.resumeReason).toContain('billing period');
      expect(event.contextSummary).toContain('technical issues');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should work with existing code that does not use new fields', () => {
      const legacyEvent: TasksAutoResumedEvent = {
        reason: 'capacity_restored',
        totalTasks: 1,
        resumedCount: 1,
        errors: [],
        timestamp: new Date(),
      };

      // Legacy processing should work without issues
      const processLegacyEvent = (event: TasksAutoResumedEvent) => {
        return {
          success: event.resumedCount > 0,
          hasErrors: event.errors.length > 0,
          efficiency: event.resumedCount / event.totalTasks,
        };
      };

      const result = processLegacyEvent(legacyEvent);
      expect(result.success).toBe(true);
      expect(result.hasErrors).toBe(false);
      expect(result.efficiency).toBe(1);
    });

    it('should enhance existing event processing with new fields when available', () => {
      const enhancedEvent: TasksAutoResumedEvent = {
        reason: 'budget_reset',
        totalTasks: 4,
        resumedCount: 3,
        errors: [{ taskId: 'task-1', error: 'Resume failed' }],
        timestamp: new Date(),
        resumeReason: 'Budget reset at midnight',
        contextSummary: 'Resumed development and maintenance tasks',
      };

      // Enhanced processing can utilize new fields
      const processEnhancedEvent = (event: TasksAutoResumedEvent) => {
        const basicInfo = {
          success: event.resumedCount > 0,
          hasErrors: event.errors.length > 0,
          efficiency: event.resumedCount / event.totalTasks,
        };

        if (event.resumeReason || event.contextSummary) {
          return {
            ...basicInfo,
            hasDetailedInfo: true,
            reasonProvided: !!event.resumeReason,
            summaryProvided: !!event.contextSummary,
          };
        }

        return { ...basicInfo, hasDetailedInfo: false };
      };

      const result = processEnhancedEvent(enhancedEvent);
      expect(result.hasDetailedInfo).toBe(true);
      expect(result.reasonProvided).toBe(true);
      expect(result.summaryProvided).toBe(true);
      expect(result.efficiency).toBe(0.75);
    });
  });

  describe('Field Content Validation', () => {
    it('should allow detailed resumeReason content', () => {
      const detailedReason = `
        Capacity restoration triggered by the following conditions:
        1. System load average dropped below 2.0
        2. Memory usage decreased to under 70%
        3. Background task processing completed
        4. Priority queue has 3 urgent tasks waiting
        5. Night mode budget constraints lifted

        Resuming tasks in order of priority with staggered execution to prevent resource spikes.
      `.trim();

      const event: TasksAutoResumedEvent = {
        reason: 'capacity_dropped',
        totalTasks: 3,
        resumedCount: 3,
        errors: [],
        timestamp: new Date(),
        resumeReason: detailedReason,
      };

      expect(event.resumeReason).toContain('Capacity restoration triggered');
      expect(event.resumeReason).toContain('staggered execution');
      expect(event.resumeReason?.length).toBeGreaterThan(100);
    });

    it('should allow structured contextSummary content', () => {
      const structuredSummary = `
        Resume Summary:

        Successfully Resumed (3):
        • task-auth-feature: User authentication system implementation
        • task-db-migration: Database schema migration for v2.1
        • task-ui-refactor: Component library restructuring

        Failed to Resume (1):
        • task-integration-test: Requires staging environment access

        Resource Allocation:
        • CPU: 45% of capacity reserved
        • Memory: 2.1GB allocated
        • Estimated completion: 2-4 hours
      `.trim();

      const event: TasksAutoResumedEvent = {
        reason: 'mode_switch',
        totalTasks: 4,
        resumedCount: 3,
        errors: [{ taskId: 'task-integration-test', error: 'Staging environment unavailable' }],
        timestamp: new Date(),
        contextSummary: structuredSummary,
      };

      expect(event.contextSummary).toContain('Successfully Resumed (3)');
      expect(event.contextSummary).toContain('Resource Allocation');
      expect(event.contextSummary).toContain('CPU: 45%');
    });

    it('should handle unicode and special characters', () => {
      const unicodeContent = {
        resumeReason: 'Système restauré après mise à jour 🔄 • Capacité: 85% ✅ • Priorité: haute ⚡',
        contextSummary: 'Tâches reprises: développement (frontend 📱), backend (API 🔧), tests (QA ✓)',
      };

      const event: TasksAutoResumedEvent = {
        reason: 'capacity_restored',
        totalTasks: 3,
        resumedCount: 3,
        errors: [],
        timestamp: new Date(),
        ...unicodeContent,
      };

      expect(event.resumeReason).toContain('🔄');
      expect(event.resumeReason).toContain('à jour');
      expect(event.contextSummary).toContain('📱');
      expect(event.contextSummary).toContain('Tâches');
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle extremely long content in new fields', () => {
      const longReason = 'Long reason: ' + 'a'.repeat(5000);
      const longSummary = 'Long summary: ' + 'b'.repeat(10000);

      const event: TasksAutoResumedEvent = {
        reason: 'capacity_dropped',
        totalTasks: 1,
        resumedCount: 1,
        errors: [],
        timestamp: new Date(),
        resumeReason: longReason,
        contextSummary: longSummary,
      };

      expect(event.resumeReason?.length).toBeGreaterThan(5000);
      expect(event.contextSummary?.length).toBeGreaterThan(10000);
    });

    it('should handle null-like values gracefully', () => {
      // TypeScript prevents null/undefined assignment, but test runtime behavior
      const event: TasksAutoResumedEvent = {
        reason: 'usage_limit',
        totalTasks: 0,
        resumedCount: 0,
        errors: [],
        timestamp: new Date(),
        resumeReason: undefined,
        contextSummary: undefined,
      };

      expect(event.resumeReason).toBeUndefined();
      expect(event.contextSummary).toBeUndefined();
    });

    it('should handle complex error arrays with new context', () => {
      const complexErrors = [
        { taskId: 'task-1', error: 'Network timeout during dependency check' },
        { taskId: 'task-2', error: 'Insufficient memory for large dataset processing' },
        { taskId: 'task-3', error: 'Security validation failed for external API access' },
        { taskId: 'task-4', error: 'Concurrent modification detected in shared resource' },
        { taskId: 'task-5', error: 'Rate limit exceeded for third-party service integration' },
      ];

      const event: TasksAutoResumedEvent = {
        reason: 'capacity_restored',
        totalTasks: 10,
        resumedCount: 5,
        errors: complexErrors,
        timestamp: new Date(),
        resumeReason: 'Capacity restored but multiple tasks encountered blocking conditions during resume attempt',
        contextSummary: 'Mixed results: 5 tasks resumed successfully (data processing, UI updates), 5 tasks failed due to various technical and security constraints. Investigation required for blocked tasks.',
      };

      expect(event.errors).toHaveLength(5);
      expect(event.errors.every(error => error.error.includes('task'))).toBe(false); // Some errors don't contain "task"
      expect(event.errors.every(error => error.taskId.startsWith('task-'))).toBe(true);
      expect(event.resumeReason).toContain('blocking conditions');
      expect(event.contextSummary).toContain('Investigation required');
    });
  });
});