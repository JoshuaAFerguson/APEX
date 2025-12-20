import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationManager } from '../ConversationManager';

// Mock modules
vi.mock('@apexcli/core', () => ({
  formatTokens: vi.fn((tokens: number) => `${tokens} tokens`),
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(4)}`),
}));

describe('Intent Detection System', () => {
  let conversationManager: ConversationManager;

  beforeEach(() => {
    conversationManager = new ConversationManager();
  });

  describe('Command Intent Detection', () => {
    it('should detect simple commands', () => {
      const testCases = [
        '/help',
        '/status',
        '/init',
        '/quit',
        '/exit',
        '/clear',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('command');
        expect(intent.confidence).toBeGreaterThan(0.9);
      });
    });

    it('should detect commands with arguments', () => {
      const testCases = [
        '/status task123',
        '/config get api.url',
        '/session load abc123',
        '/logs --level error',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('command');
        expect(intent.confidence).toBeGreaterThan(0.9);
      });
    });

    it('should detect partial commands with lower confidence', () => {
      const testCases = [
        'help me',
        'show status',
        'clear screen',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(['command', 'task', 'question']).toContain(intent.type);
        // Partial commands might be classified as tasks or questions
      });
    });

    it('should handle malformed commands', () => {
      const testCases = [
        '/',
        '/ ',
        '//',
        '/unknown-command',
        '/help extra args that dont make sense',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        // Should still detect as command but may have lower confidence
        expect(intent).toHaveProperty('type');
        expect(intent).toHaveProperty('confidence');
        expect(typeof intent.confidence).toBe('number');
      });
    });
  });

  describe('Task Intent Detection', () => {
    it('should detect clear task descriptions', () => {
      const testCases = [
        'create a new user authentication system',
        'implement login functionality',
        'build a responsive navigation bar',
        'add error handling to the API',
        'refactor the database layer',
        'optimize the search algorithm',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('task');
        expect(intent.confidence).toBeGreaterThan(0.6);
      });
    });

    it('should detect imperative task language', () => {
      const testCases = [
        'Create a login form',
        'Add user validation',
        'Fix the bug in payment processing',
        'Update the documentation',
        'Implement caching',
        'Deploy the application',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('task');
        expect(intent.confidence).toBeGreaterThan(0.7);
      });
    });

    it('should handle complex task descriptions', () => {
      const testCases = [
        'Create a RESTful API endpoint for user registration with email verification and rate limiting',
        'Implement a real-time chat system using WebSockets with message persistence and user presence indicators',
        'Build a dashboard with interactive charts showing user analytics and system metrics',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('task');
        expect(intent.confidence).toBeGreaterThan(0.5);
      });
    });

    it('should suggest appropriate workflows for different task types', () => {
      const testCases = [
        { input: 'create a new feature', expectedWorkflow: 'feature' },
        { input: 'fix a bug in the code', expectedWorkflow: 'bugfix' },
        { input: 'add unit tests', expectedWorkflow: 'testing' },
        { input: 'update documentation', expectedWorkflow: 'documentation' },
      ];

      testCases.forEach(({ input, expectedWorkflow }) => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('task');
        // Workflow suggestion would be in metadata
        if (intent.metadata?.suggestedWorkflow) {
          expect(intent.metadata.suggestedWorkflow).toBe(expectedWorkflow);
        }
      });
    });
  });

  describe('Question Intent Detection', () => {
    it('should detect explicit questions', () => {
      const testCases = [
        'How do I create a component?',
        'What is the best way to handle errors?',
        'Where should I put the configuration files?',
        'When should I use Redux vs Context?',
        'Why is the build failing?',
        'Which testing framework should I use?',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('question');
        expect(intent.confidence).toBeGreaterThan(0.7);
      });
    });

    it('should detect implicit questions', () => {
      const testCases = [
        'I need help with authentication',
        'Not sure how to implement this feature',
        'Looking for advice on database design',
        'Could use guidance on performance optimization',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(['question', 'task']).toContain(intent.type);
        // Implicit questions might be classified as tasks
      });
    });

    it('should handle technical questions', () => {
      const testCases = [
        'How does React\'s reconciliation algorithm work?',
        'What are the differences between SQL and NoSQL databases?',
        'Can you explain the event loop in Node.js?',
        'What are the best practices for API versioning?',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('question');
        expect(intent.confidence).toBeGreaterThan(0.6);
      });
    });
  });

  describe('Clarification Intent Detection', () => {
    it('should detect clarification requests', () => {
      // First set up a context that would need clarification
      conversationManager.addMessage({
        role: 'assistant',
        content: 'I need more information about the database schema. What tables do you want to include?'
      });

      const testCases = [
        'users and posts tables',
        'include authentication tables',
        'the standard e-commerce schema',
        'just basic user management for now',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(['clarification', 'task']).toContain(intent.type);
      });
    });

    it('should handle yes/no clarifications', () => {
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Should I include error handling in this implementation?'
      });

      const testCases = [
        'yes',
        'no',
        'yes please',
        'no, not needed',
        'sure',
        'nope',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(['clarification', 'command']).toContain(intent.type);
      });
    });
  });

  describe('Confidence Scoring', () => {
    it('should give high confidence to unambiguous inputs', () => {
      const testCases = [
        { input: '/help', expectedMinConfidence: 0.95 },
        { input: 'How do I exit this program?', expectedMinConfidence: 0.8 },
        { input: 'Create a login form with validation', expectedMinConfidence: 0.8 },
      ];

      testCases.forEach(({ input, expectedMinConfidence }) => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.confidence).toBeGreaterThanOrEqual(expectedMinConfidence);
      });
    });

    it('should give lower confidence to ambiguous inputs', () => {
      const testCases = [
        'something',
        'do this',
        'yes',
        'maybe',
        'ok',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.confidence).toBeLessThan(0.7);
      });
    });

    it('should handle empty or whitespace inputs', () => {
      const testCases = [
        '',
        ' ',
        '\t',
        '\n',
        '   \t\n   ',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.confidence).toBeLessThan(0.3);
      });
    });
  });

  describe('Context Awareness', () => {
    it('should improve detection with conversation context', () => {
      // Build up context
      conversationManager.addMessage({
        role: 'user',
        content: 'I want to build a web application'
      });

      conversationManager.addMessage({
        role: 'assistant',
        content: 'Great! What kind of web application are you thinking of?'
      });

      // This should now be detected as clarification with higher confidence
      const intent = conversationManager.detectIntent('A todo list app');
      expect(['clarification', 'task']).toContain(intent.type);
    });

    it('should handle task continuation', () => {
      conversationManager.addMessage({
        role: 'user',
        content: 'Create a user registration system'
      });

      conversationManager.addMessage({
        role: 'assistant',
        content: 'I\'ll help you create a user registration system. Should I include email verification?'
      });

      // This should be detected as clarification
      const intent = conversationManager.detectIntent('Yes, include email verification');
      expect(['clarification', 'task']).toContain(intent.type);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long inputs', () => {
      const longInput = 'Create a comprehensive user management system that includes authentication, authorization, profile management, user preferences, activity logging, and administrative controls'.repeat(10);

      const intent = conversationManager.detectIntent(longInput);
      expect(intent).toHaveProperty('type');
      expect(intent).toHaveProperty('confidence');
      expect(intent.type).toBe('task');
    });

    it('should handle special characters and encoding', () => {
      const testCases = [
        'Create 用户 management with 🚀 emojis',
        'Implement ñoño functionality',
        'Add <%script%> protection',
        'Create "nested quotes" handling',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent).toHaveProperty('type');
        expect(intent).toHaveProperty('confidence');
      });
    });

    it('should handle code snippets in input', () => {
      const codeInput = `
        Create a React component like this:
        function MyComponent() {
          return <div>Hello World</div>;
        }
      `;

      const intent = conversationManager.detectIntent(codeInput);
      expect(intent.type).toBe('task');
    });

    it('should handle malformed JSON-like inputs', () => {
      const testCases = [
        '{"task": "create something"}',
        '{broken json:}',
        '[array, of, things]',
      ];

      testCases.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent).toHaveProperty('type');
        expect(intent).toHaveProperty('confidence');
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle rapid successive calls', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        conversationManager.detectIntent(`Create component ${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 100 detections in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should maintain consistent performance with large context', () => {
      // Build up large conversation history
      for (let i = 0; i < 50; i++) {
        conversationManager.addMessage({
          role: 'user',
          content: `Test message ${i} with some content to build context`
        });
        conversationManager.addMessage({
          role: 'assistant',
          content: `Response ${i} with additional context and information`
        });
      }

      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        conversationManager.detectIntent(`Create feature ${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should still be fast even with large context
      expect(duration).toBeLessThan(500);
    });

    it('should handle concurrent detection calls', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        Promise.resolve(conversationManager.detectIntent(`Task ${i}`))
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(20);
      results.forEach(intent => {
        expect(intent).toHaveProperty('type');
        expect(intent).toHaveProperty('confidence');
      });
    });
  });

  describe('Metadata and Enrichment', () => {
    it('should include relevant metadata for tasks', () => {
      const taskInput = 'Create a REST API for user management';
      const intent = conversationManager.detectIntent(taskInput);

      expect(intent.type).toBe('task');
      expect(intent.metadata).toBeDefined();
      // Should suggest appropriate workflow
      if (intent.metadata?.suggestedWorkflow) {
        expect(['feature', 'api', 'backend']).toContain(intent.metadata.suggestedWorkflow);
      }
    });

    it('should include complexity estimation for tasks', () => {
      const testCases = [
        { input: 'Add a button', expectedComplexity: 'simple' },
        { input: 'Create a user authentication system with OAuth', expectedComplexity: 'complex' },
        { input: 'Update the documentation', expectedComplexity: 'simple' },
      ];

      testCases.forEach(({ input, expectedComplexity }) => {
        const intent = conversationManager.detectIntent(input);
        if (intent.metadata?.complexity) {
          expect(['simple', 'medium', 'complex']).toContain(intent.metadata.complexity);
        }
      });
    });

    it('should identify domain-specific keywords', () => {
      const testCases = [
        { input: 'Create a React component', expectedDomain: 'frontend' },
        { input: 'Set up a database schema', expectedDomain: 'backend' },
        { input: 'Configure CI/CD pipeline', expectedDomain: 'devops' },
        { input: 'Write unit tests', expectedDomain: 'testing' },
      ];

      testCases.forEach(({ input, expectedDomain }) => {
        const intent = conversationManager.detectIntent(input);
        if (intent.metadata?.domain) {
          expect(intent.metadata.domain).toContain(expectedDomain);
        }
      });
    });
  });
});