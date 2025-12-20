/**
 * Project State Awareness Tests
 * Tests context-aware suggestions and project state tracking as specified in ADR-002
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationManager } from '../ConversationManager';

// Mock project state data
const mockProjectState = {
  path: '/test/project',
  gitBranch: 'feature/auth-system',
  uncommittedChanges: true,
  recentFiles: ['auth.ts', 'login.component.tsx', 'user.model.ts'],
  activeAgents: ['planner'],
  pendingTasks: ['implement-jwt', 'add-password-validation']
};

describe('Project State Awareness', () => {
  let conversationManager: ConversationManager;

  beforeEach(() => {
    conversationManager = new ConversationManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Context-Aware Intent Detection', () => {
    it('should incorporate project state into intent detection', () => {
      // Simulate having recent files in context
      conversationManager.addMessage({
        role: 'system',
        content: 'Project context: Recently modified auth.ts, login.component.tsx',
        metadata: { projectState: mockProjectState }
      });

      // Test ambiguous references that could be resolved with project context
      const ambiguousInputs = [
        'fix the file',
        'update that component',
        'test the new feature',
        'deploy this change'
      ];

      ambiguousInputs.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('task');
        expect(intent.metadata).toBeDefined();
      });
    });

    it('should detect file-specific tasks based on recent activity', () => {
      // Add context about recent file changes
      conversationManager.addMessage({
        role: 'system',
        content: 'Working on authentication system',
        metadata: {
          recentFiles: ['auth.ts', 'login.tsx'],
          currentTask: 'implement-authentication'
        }
      });

      const fileSpecificInputs = [
        'add error handling to the auth file',
        'refactor the login component',
        'test the authentication logic'
      ];

      fileSpecificInputs.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('task');
        expect(intent.confidence).toBeGreaterThan(0.6);
      });
    });

    it('should suggest workflow types based on project state', () => {
      // Set up context suggesting a bug fix workflow
      conversationManager.addMessage({
        role: 'system',
        content: 'Test failures detected in authentication module',
        metadata: {
          testStatus: 'failing',
          failingTests: ['auth.test.ts'],
          errors: ['JWT validation error']
        }
      });

      const bugFixInput = 'fix the authentication issue';
      const intent = conversationManager.detectIntent(bugFixInput);

      expect(intent.type).toBe('task');
      expect(intent.metadata?.suggestedWorkflow).toBe('bugfix');
    });
  });

  describe('Contextual Suggestions', () => {
    it('should suggest actions based on uncommitted changes', () => {
      // Simulate project with uncommitted changes
      conversationManager.addMessage({
        role: 'system',
        content: 'Project has uncommitted changes',
        metadata: { uncommittedChanges: true, gitStatus: 'modified: auth.ts, login.tsx' }
      });

      const suggestions = conversationManager.getSuggestions();

      // Should include git-related suggestions
      const gitSuggestions = suggestions.filter(s =>
        s.toLowerCase().includes('commit') ||
        s.toLowerCase().includes('changes') ||
        s.toLowerCase().includes('review')
      );

      expect(gitSuggestions.length).toBeGreaterThan(0);
    });

    it('should suggest file-specific actions based on recent activity', () => {
      // Add recent file activity
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Modified auth.ts successfully',
        metadata: {
          modifiedFiles: ['auth.ts'],
          fileChanges: ['added JWT validation', 'updated error handling']
        }
      });

      const suggestions = conversationManager.getSuggestions();

      expect(suggestions).toContain('test the implementation');
      expect(suggestions).toContain('show me the changes');
    });

    it('should suggest task-related actions when tasks are active', () => {
      conversationManager.setTask('auth-task-123');
      conversationManager.setAgent('developer');
      conversationManager.setWorkflowStage('implementation');

      const suggestions = conversationManager.getSuggestions();

      expect(suggestions).toContain('/status');
      expect(suggestions).toContain('/logs');
      expect(suggestions).toContain('cancel the task');
      expect(suggestions).toContain('modify the requirements');
    });

    it('should adapt suggestions based on current workflow stage', () => {
      // Test different workflow stages
      const stageTests = [
        {
          stage: 'planning',
          expectedSuggestions: ['refine requirements', 'start implementation']
        },
        {
          stage: 'implementation',
          expectedSuggestions: ['run tests', 'check status']
        },
        {
          stage: 'testing',
          expectedSuggestions: ['deploy changes', 'create pull request']
        }
      ];

      stageTests.forEach(({ stage, expectedSuggestions }) => {
        conversationManager.setWorkflowStage(stage);

        const suggestions = conversationManager.getSuggestions();

        // At least one expected suggestion should be present
        const hasExpectedSuggestion = expectedSuggestions.some(expected =>
          suggestions.some(actual => actual.toLowerCase().includes(expected.toLowerCase()))
        );

        expect(hasExpectedSuggestion).toBe(true);
      });
    });
  });

  describe('Project Context Integration', () => {
    it('should handle project metadata in conversation context', () => {
      conversationManager.addMessage({
        role: 'system',
        content: 'Project initialized',
        metadata: {
          projectPath: '/test/project',
          gitBranch: 'feature/auth',
          dependencies: ['react', 'express', 'jsonwebtoken'],
          framework: 'react'
        }
      });

      // Test framework-specific suggestions
      const intent = conversationManager.detectIntent('create a new component');
      expect(intent.type).toBe('task');
      expect(intent.metadata?.suggestedWorkflow).toBe('feature');
    });

    it('should incorporate git branch information into context', () => {
      conversationManager.addMessage({
        role: 'system',
        content: 'Working on feature/authentication-system branch',
        metadata: {
          gitBranch: 'feature/authentication-system',
          baseBranch: 'main',
          branchCommits: 3
        }
      });

      const suggestions = conversationManager.getSuggestions();

      // Should include branch-related suggestions for feature branches
      const branchSuggestions = suggestions.filter(s =>
        s.toLowerCase().includes('pull request') ||
        s.toLowerCase().includes('merge') ||
        s.toLowerCase().includes('deploy')
      );

      expect(branchSuggestions.length).toBeGreaterThan(0);
    });

    it('should track active agents and suggest appropriate actions', () => {
      conversationManager.setAgent('tester');
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Running comprehensive test suite',
        metadata: {
          agent: 'tester',
          testResults: { passed: 15, failed: 2, total: 17 }
        }
      });

      const suggestions = conversationManager.getSuggestions();

      // Should suggest test-related actions
      expect(suggestions).toContain('show me the logs');
      expect(suggestions).toContain('fix the error');
    });

    it('should maintain project context across conversation restarts', () => {
      // Add project context
      conversationManager.addMessage({
        role: 'system',
        content: 'Project context loaded',
        metadata: {
          projectState: mockProjectState,
          sessionId: 'test-session-123'
        }
      });

      // Clear and restart conversation
      const originalContext = conversationManager.getContext();
      conversationManager.clearContext();

      // Verify context is cleared
      expect(conversationManager.getContext().messages).toHaveLength(0);

      // Should be able to restore context (simulated)
      conversationManager.addMessage({
        role: 'system',
        content: 'Project context restored',
        metadata: originalContext.messages[0].metadata
      });

      const intent = conversationManager.detectIntent('continue the authentication work');
      expect(intent.type).toBe('task');
    });
  });

  describe('Dynamic Project State Updates', () => {
    it('should adapt to changing project state', () => {
      // Initial state - no active tasks
      let suggestions = conversationManager.getSuggestions();
      const initialSuggestionCount = suggestions.length;

      // Add active task
      conversationManager.setTask('new-feature-123');
      suggestions = conversationManager.getSuggestions();

      expect(suggestions).toContain('/status');
      expect(suggestions).toContain('/logs');
      expect(suggestions.length).toBeGreaterThanOrEqual(initialSuggestionCount);

      // Complete task
      conversationManager.clearTask();
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Feature implementation completed successfully'
      });

      suggestions = conversationManager.getSuggestions();
      expect(suggestions).toContain('show me the changes');
      expect(suggestions).toContain('test the implementation');
    });

    it('should handle multiple concurrent project contexts', () => {
      // Add multiple project contexts
      conversationManager.addMessage({
        role: 'system',
        content: 'Frontend project context',
        metadata: {
          project: 'frontend',
          framework: 'react',
          activeFiles: ['App.tsx', 'auth.component.tsx']
        }
      });

      conversationManager.addMessage({
        role: 'system',
        content: 'Backend project context',
        metadata: {
          project: 'backend',
          framework: 'express',
          activeFiles: ['auth.routes.ts', 'user.model.ts']
        }
      });

      // Should handle mixed context gracefully
      const intent = conversationManager.detectIntent('update the authentication system');
      expect(intent.type).toBe('task');
      expect(intent.confidence).toBeGreaterThan(0.5);
    });

    it('should prioritize recent project activity in suggestions', () => {
      // Add older activity
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Completed user interface updates',
        metadata: { timestamp: new Date(Date.now() - 86400000), activity: 'ui-update' } // 1 day ago
      });

      // Add recent activity
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Started authentication implementation',
        metadata: { timestamp: new Date(), activity: 'auth-implementation' }
      });

      const suggestions = conversationManager.getSuggestions();

      // Should prioritize recent authentication work over older UI work
      const authSuggestions = suggestions.filter(s =>
        s.toLowerCase().includes('auth') ||
        s.toLowerCase().includes('login') ||
        s.toLowerCase().includes('security')
      );

      // At least one suggestion should be auth-related
      expect(authSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Error Context Awareness', () => {
    it('should provide error-specific suggestions based on project state', () => {
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Authentication tests are failing due to missing JWT secret',
        metadata: {
          errorType: 'configuration',
          failingTests: ['auth.test.ts'],
          missingConfig: ['JWT_SECRET']
        }
      });

      const suggestions = conversationManager.getSuggestions();

      expect(suggestions).toContain('fix the error');
      expect(suggestions).toContain('try a different approach');
      expect(suggestions).toContain('show me the logs');
    });

    it('should suggest recovery actions for build failures', () => {
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Build failed due to TypeScript compilation errors',
        metadata: {
          buildStatus: 'failed',
          errorCount: 3,
          errorTypes: ['typescript', 'syntax'],
          affectedFiles: ['auth.ts', 'types.ts']
        }
      });

      const suggestions = conversationManager.getSuggestions();

      expect(suggestions).toContain('fix the error');
      expect(suggestions).toContain('retry the task');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large project contexts efficiently', () => {
      const startTime = performance.now();

      // Add many project state updates
      for (let i = 0; i < 100; i++) {
        conversationManager.addMessage({
          role: 'system',
          content: `Project state update ${i}`,
          metadata: {
            files: Array.from({ length: 10 }, (_, j) => `file${i}-${j}.ts`),
            changes: Array.from({ length: 5 }, (_, j) => `change-${i}-${j}`),
            timestamp: new Date(Date.now() + i * 1000)
          }
        });
      }

      // Should still generate suggestions quickly
      const suggestions = conversationManager.getSuggestions();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(8);
    });

    it('should prune project context metadata appropriately', () => {
      // Add many messages with large metadata
      for (let i = 0; i < 150; i++) {
        conversationManager.addMessage({
          role: 'system',
          content: `State update ${i}`,
          metadata: {
            largeProjectData: Array.from({ length: 100 }, (_, j) => ({
              file: `file-${i}-${j}.ts`,
              changes: `changes-${i}-${j}`,
              metadata: { size: j * 1000, complexity: j % 5 }
            }))
          }
        });
      }

      // Should prune messages but maintain functionality
      const context = conversationManager.getContext();
      expect(context.messages.length).toBeLessThanOrEqual(100);

      // Should still work properly
      const intent = conversationManager.detectIntent('create a new feature');
      expect(intent.type).toBe('task');

      const suggestions = conversationManager.getSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});