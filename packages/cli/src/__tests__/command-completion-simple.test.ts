/**
 * Simple Command Completion Test - Basic Functionality Check
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompletionEngine, CompletionContext } from '../services/CompletionEngine';

describe('Command Completion - Basic Tests', () => {
  let completionEngine: CompletionEngine;
  let mockContext: CompletionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    completionEngine = new CompletionEngine();

    mockContext = {
      projectPath: '/test/project',
      agents: ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'],
      workflows: ['feature', 'bugfix', 'refactor'],
      recentTasks: [
        { id: 'task_123456', description: 'Implement user authentication' },
        { id: 'task_789012', description: 'Fix bug in payment processor' }
      ],
      inputHistory: [
        'add authentication to the login page',
        'fix the payment bug',
        '/status',
        '/help',
        '/session list',
        '/session save'
      ]
    };
  });

  it('should return command suggestions for "/" input', async () => {
    const results = await completionEngine.getCompletions('/', 1, mockContext);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);

    // Check that we have basic commands
    const commandValues = results.map(r => r.value);
    expect(commandValues).toContain('/help');
    expect(commandValues).toContain('/status');
    expect(commandValues).toContain('/session');
  });

  it('should filter commands based on prefix', async () => {
    const results = await completionEngine.getCompletions('/he', 3, mockContext);

    expect(results).toBeInstanceOf(Array);

    // Should include /help
    const helpCommand = results.find(r => r.value === '/help');
    expect(helpCommand).toBeDefined();
    expect(helpCommand?.description).toBe('Show help');
    expect(helpCommand?.type).toBe('command');
  });

  it('should return session subcommands for "/session " input', async () => {
    const results = await completionEngine.getCompletions('/session ', 9, mockContext);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);

    // Check for session subcommands
    const sessionCommands = results.filter(r => r.type === 'subcommand');
    expect(sessionCommands.length).toBeGreaterThan(0);

    const listCommand = sessionCommands.find(r => r.value === '/session list');
    expect(listCommand).toBeDefined();
    expect(listCommand?.description).toBe('List sessions');
  });

  it('should filter session subcommands based on prefix', async () => {
    const results = await completionEngine.getCompletions('/session l', 10, mockContext);

    expect(results).toBeInstanceOf(Array);

    // Should include subcommands starting with 'l'
    const listCommand = results.find(r => r.value === '/session list');
    const loadCommand = results.find(r => r.value === '/session load');

    expect(listCommand).toBeDefined();
    expect(loadCommand).toBeDefined();

    // Should not include non-matching subcommands
    const saveCommand = results.find(r => r.value === '/session save');
    expect(saveCommand).toBeUndefined();
  });

  it('should handle empty input gracefully', async () => {
    const results = await completionEngine.getCompletions('', 0, mockContext);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(0);
  });

  it('should return sorted results by score', async () => {
    const results = await completionEngine.getCompletions('/', 1, mockContext);

    if (results.length > 1) {
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    }
  });
});