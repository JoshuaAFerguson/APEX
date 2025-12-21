import { describe, it, expect } from 'vitest';
import { createContextSummary } from './context';
import { buildResumePrompt } from './prompts';
import type { AgentMessage, Task, TaskCheckpoint } from '@apexcli/core';

describe('Resume Context Unit Tests', () => {
  const createMockTask = (): Task => ({
    id: 'task_123',
    description: 'Test resume functionality',
    workflow: 'feature',
    autonomy: 'full',
    status: 'in-progress',
    projectPath: '/test',
    branchName: 'apex/test-branch',
    createdAt: new Date('2024-12-20T10:00:00Z'),
    updatedAt: new Date('2024-12-20T10:30:00Z'),
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      estimatedCost: 0.01,
    },
    logs: [],
    artifacts: [],
  });

  const createMockCheckpoint = (): TaskCheckpoint => ({
    taskId: 'task_123',
    checkpointId: 'checkpoint_456',
    stage: 'testing',
    stageIndex: 2,
    createdAt: new Date('2024-12-20T10:15:00Z'),
  });

  describe('createContextSummary integration with resume functionality', () => {
    it('should create context summary that works with buildResumePrompt', () => {
      const conversationState: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Build a user authentication system' }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement JWT-based authentication. I\'ve decided to use bcrypt for password hashing. The approach will be to create middleware for token validation.'
          }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: { file_path: '/src/auth/jwt-service.ts', content: 'export class JwtService {}' }
          }],
        },
        {
          type: 'user',
          content: [{
            type: 'tool_result',
            toolResult: 'File written successfully'
          }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed the JWT service implementation. Built the authentication middleware. Currently working on user registration endpoints.'
          }],
        },
      ];

      // Test createContextSummary output
      const contextSummary = createContextSummary(conversationState);

      // Verify context summary contains expected elements
      expect(contextSummary).toContain('Messages exchanged: 5');
      expect(contextSummary).toContain('JWT-based authentication');
      expect(contextSummary).toContain('bcrypt for password hashing');
      expect(contextSummary).toContain('JWT service implementation');
      expect(contextSummary).toContain('Files written: /src/auth/jwt-service.ts');

      // Test that buildResumePrompt works with this context summary
      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

      // Verify resume prompt integrates the context summary
      expect(resumePrompt).toContain('🔄 SESSION RESUME CONTEXT');
      expect(resumePrompt).toContain('Build a user authentication system');
      expect(resumePrompt).toContain(contextSummary);
      expect(resumePrompt).toContain('JWT-based authentication');
      expect(resumePrompt).toContain('JWT service implementation');
    });

    it('should handle empty conversation state gracefully', () => {
      const conversationState: AgentMessage[] = [];

      const contextSummary = createContextSummary(conversationState);
      expect(contextSummary).toContain('Messages exchanged: 0');

      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(resumePrompt).toContain('🔄 SESSION RESUME CONTEXT');
      expect(resumePrompt).toContain('No specific accomplishments identified');
      expect(resumePrompt).toContain('No significant decisions identified');
    });

    it('should extract and format file modifications correctly', () => {
      const conversationState: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: '/src/config.ts' }
          }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: { file_path: '/src/services/email.ts', content: 'export class EmailService {}' }
          }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: { file_path: '/src/services/sms.ts', content: 'export class SmsService {}' }
          }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Edit',
            toolInput: { file_path: '/src/config.ts', old_string: 'old', new_string: 'new' }
          }],
        },
      ];

      const contextSummary = createContextSummary(conversationState);

      expect(contextSummary).toContain('Files read: /src/config.ts');
      expect(contextSummary).toContain('Files written: /src/services/email.ts, /src/services/sms.ts');
      expect(contextSummary).toContain('Files edited: /src/config.ts');

      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(resumePrompt).toContain('Files read: /src/config.ts');
      expect(resumePrompt).toContain('Files written: /src/services/email.ts, /src/services/sms.ts');
      expect(resumePrompt).toContain('Files edited: /src/config.ts');
    });

    it('should extract key decisions with proper categorization', () => {
      const conversationState: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement the payment system. I\'ve decided to use Stripe for payment processing because of reliability. Architecture: microservices pattern for scalability. The workflow will include webhook validation.'
          }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Using TypeScript for better type safety. Plan to use Docker for containerization. Because of security requirements, we chose OAuth2 authentication.'
          }],
        },
      ];

      const contextSummary = createContextSummary(conversationState);

      // Verify key decisions are extracted
      expect(contextSummary).toContain('Stripe for payment processing');
      expect(contextSummary).toContain('microservices pattern for scalability');
      expect(contextSummary).toContain('TypeScript for better type safety');
      expect(contextSummary).toContain('Docker for containerization');
      expect(contextSummary).toContain('OAuth2 authentication');

      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

      // Verify decisions are properly formatted in resume prompt
      expect(resumePrompt).toContain('Key Decisions Made');
      expect(resumePrompt).toContain('Stripe for payment processing');
      expect(resumePrompt).toContain('microservices pattern');
      expect(resumePrompt).toContain('OAuth2 authentication');
    });

    it('should extract progress information accurately', () => {
      const conversationState: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed the database schema design. Finished implementing the user model. Built the authentication service. Currently working on implementing the email verification system.'
          }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Done with the password reset functionality. Now implementing two-factor authentication.'
          }],
        },
      ];

      const contextSummary = createContextSummary(conversationState);

      // Verify progress tracking
      expect(contextSummary).toContain('database schema design');
      expect(contextSummary).toContain('user model');
      expect(contextSummary).toContain('authentication service');
      expect(contextSummary).toContain('password reset functionality');
      expect(contextSummary).toContain('two-factor authentication'); // Current work

      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(resumePrompt).toContain('What Was Accomplished');
      expect(resumePrompt).toContain('database schema design');
      expect(resumePrompt).toContain('user model');
      expect(resumePrompt).toContain('authentication service');
    });

    it('should handle malformed conversation gracefully', () => {
      const conversationState: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{ type: 'text', text: null as unknown as string }], // Malformed
        },
        {
          type: 'assistant',
          content: [], // Empty content
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: null as unknown as string, // Malformed
            toolInput: null
          }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Successfully implemented error handling. Built robust logging system.'
          }],
        },
      ];

      // Should not throw error
      expect(() => createContextSummary(conversationState)).not.toThrow();

      const contextSummary = createContextSummary(conversationState);
      expect(contextSummary).toContain('Messages exchanged: 4');
      expect(contextSummary).toContain('error handling');
      expect(contextSummary).toContain('logging system');

      const task = createMockTask();
      const checkpoint = createMockCheckpoint();

      // Should not throw error
      expect(() => buildResumePrompt(task, checkpoint, contextSummary)).not.toThrow();

      const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);
      expect(resumePrompt).toContain('🔄 SESSION RESUME CONTEXT');
      expect(resumePrompt).toContain('error handling');
    });
  });

  describe('buildResumePrompt format and content', () => {
    it('should format checkpoint age correctly', () => {
      const task = createMockTask();
      const contextSummary = 'Previous work completed.';

      // Test different time differences
      const now = Date.now();

      // 30 seconds ago
      const checkpoint30s = {
        ...createMockCheckpoint(),
        createdAt: new Date(now - 30 * 1000)
      };
      const prompt30s = buildResumePrompt(task, checkpoint30s, contextSummary);
      expect(prompt30s).toMatch(/30s ago/);

      // 2 minutes 30 seconds ago
      const checkpoint2m30s = {
        ...createMockCheckpoint(),
        createdAt: new Date(now - 150 * 1000)
      };
      const prompt2m30s = buildResumePrompt(task, checkpoint2m30s, contextSummary);
      expect(prompt2m30s).toMatch(/2m 30s ago/);

      // 1 hour 45 minutes ago
      const checkpoint1h45m = {
        ...createMockCheckpoint(),
        createdAt: new Date(now - 6300 * 1000)
      };
      const prompt1h45m = buildResumePrompt(task, checkpoint1h45m, contextSummary);
      expect(prompt1h45m).toMatch(/1h 45m ago/);
    });

    it('should include all required resume prompt sections', () => {
      const task = createMockTask();
      task.description = 'Complete integration testing';
      const checkpoint = createMockCheckpoint();
      checkpoint.stage = 'testing';
      checkpoint.stageIndex = 2;
      const contextSummary = 'Built comprehensive test suite. Decided to use Jest framework.';

      const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

      // Required header sections
      expect(resumePrompt).toContain('🔄 SESSION RESUME CONTEXT');
      expect(resumePrompt).toMatch(/\*\*Resuming Task\*\*: Complete integration testing/);
      expect(resumePrompt).toMatch(/\*\*Resume Point\*\*: Stage "testing" \(index 2\)/);
      expect(resumePrompt).toMatch(/\*\*Last Checkpoint\*\*: .* ago/);

      // Required content sections
      expect(resumePrompt).toContain('### Prior Context Summary');
      expect(resumePrompt).toContain('### What Was Accomplished');
      expect(resumePrompt).toContain('### Key Decisions Made');
      expect(resumePrompt).toContain('### What Happens Next');

      // Content verification
      expect(resumePrompt).toContain('Built comprehensive test suite');
      expect(resumePrompt).toContain('Jest framework');
      expect(resumePrompt).toContain('continuation of previous work');
      expect(resumePrompt).toContain('avoid repeating completed work');
    });

    it('should handle undefined/missing checkpoint stage', () => {
      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      checkpoint.stage = undefined;
      const contextSummary = 'Work in progress.';

      const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(resumePrompt).toContain('Stage "unknown"');
      expect(resumePrompt).toContain('🔄 SESSION RESUME CONTEXT');
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large conversation state efficiently', () => {
      // Create large conversation with 500 messages
      const conversationState: AgentMessage[] = Array.from({ length: 500 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: [{
          type: 'text',
          text: `Message ${i}: Implementing feature ${i} with detailed progress tracking and comprehensive logging for debugging purposes.`
        }],
      }));

      const startTime = Date.now();
      const contextSummary = createContextSummary(conversationState);
      const contextTime = Date.now() - startTime;

      expect(contextTime).toBeLessThan(1000); // Should complete within 1 second
      expect(contextSummary).toContain('Messages exchanged: 500');

      const task = createMockTask();
      const checkpoint = createMockCheckpoint();

      const startTime2 = Date.now();
      const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);
      const resumeTime = Date.now() - startTime2;

      expect(resumeTime).toBeLessThan(100); // Should be very fast
      expect(resumePrompt).toContain('🔄 SESSION RESUME CONTEXT');
    });

    it('should handle conversation with many file operations', () => {
      // Create conversation with many file operations
      const conversationState: AgentMessage[] = [];

      // Add 50 file operations
      for (let i = 0; i < 50; i++) {
        conversationState.push({
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: i % 3 === 0 ? 'Read' : i % 3 === 1 ? 'Write' : 'Edit',
            toolInput: { file_path: `/src/components/component${i}.tsx` }
          }],
        });
      }

      const contextSummary = createContextSummary(conversationState);

      // Should track file operations efficiently
      expect(contextSummary).toContain('Files read:');
      expect(contextSummary).toContain('Files written:');
      expect(contextSummary).toContain('Files edited:');

      const task = createMockTask();
      const checkpoint = createMockCheckpoint();
      const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);

      expect(resumePrompt).toContain('🔄 SESSION RESUME CONTEXT');
      expect(resumePrompt.length).toBeLessThan(20000); // Should not be excessively long
    });
  });
});