/**
 * Getting Started Features Integration Tests
 *
 * This test suite validates that the v0.3.0 features documented in
 * getting-started.md actually work as described:
 * - Tab completion functionality
 * - Session management commands
 * - Keyboard shortcuts integration
 * - Rich terminal UI components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionStore } from '../../packages/cli/src/services/SessionStore.js';
import { CompletionEngine } from '../../packages/cli/src/services/CompletionEngine.js';
import { ShortcutManager } from '../../packages/cli/src/services/ShortcutManager.js';
import { App } from '../../packages/cli/src/ui/App.js';
import { ApexOrchestrator } from '../../packages/orchestrator/src/index.js';
import * as path from 'path';
import * as fs from 'fs/promises';

// Mock external dependencies
vi.mock('../../packages/orchestrator/src/index.js');
vi.mock('process', () => ({
  stdout: { columns: 80, rows: 24 },
  stdin: { setRawMode: vi.fn(), resume: vi.fn(), pause: vi.fn() },
  exit: vi.fn(),
  cwd: vi.fn(() => '/test/project')
}));

describe('Getting Started Features Integration', () => {
  let sessionStore: SessionStore;
  let completionEngine: CompletionEngine;
  let shortcutManager: ShortcutManager;
  let tempDir: string;

  beforeEach(async () => {
    // Setup temporary directory for testing
    tempDir = path.join(__dirname, '../../test-temp-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize services
    sessionStore = new SessionStore();
    completionEngine = new CompletionEngine();
    shortcutManager = new ShortcutManager();
  });

  afterEach(async () => {
    // Cleanup temporary directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Tab Completion Features', () => {
    it('should provide command completions as documented', async () => {
      const completions = await completionEngine.complete('apex ');

      // Verify the commands mentioned in getting-started.md are available
      const expectedCommands = ['init', 'run', 'status', 'logs', 'sessions', 'serve'];

      for (const command of expectedCommands) {
        expect(completions.some(c => c.value === command),
          `Command '${command}' should be available in tab completion`
        ).toBe(true);
      }
    });

    it('should complete task IDs for session commands', async () => {
      // Create a mock session
      const mockTaskId = 'task_abc123_def456';
      await sessionStore.createSession({
        id: mockTaskId,
        description: 'Test task',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const completions = await completionEngine.complete('apex resume task_');

      expect(completions.some(c => c.value === mockTaskId),
        'Task ID completion should work for session commands'
      ).toBe(true);
    });

    it('should complete autonomy levels as documented', async () => {
      const completions = await completionEngine.complete('apex run "task" --autonomy ');

      const expectedLevels = ['full', 'review-before-commit', 'review-before-merge', 'manual'];

      for (const level of expectedLevels) {
        expect(completions.some(c => c.value === level),
          `Autonomy level '${level}' should be available in completion`
        ).toBe(true);
      }
    });

    it('should complete workflow names', async () => {
      const completions = await completionEngine.complete('apex run "task" --workflow ');

      // Should include default workflows mentioned in docs
      expect(completions.some(c => c.value === 'feature'),
        'Feature workflow should be available in completion'
      ).toBe(true);
    });
  });

  describe('Session Management Commands', () => {
    it('should list active sessions as documented', async () => {
      // Create test sessions
      const sessions = [
        {
          id: 'task_abc123_def456',
          description: 'Add health check endpoint',
          status: 'in-progress' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'task_xyz789_ghi012',
          description: 'Fix authentication bug',
          status: 'pending' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const session of sessions) {
        await sessionStore.createSession(session);
      }

      const activeSessions = await sessionStore.listSessions();

      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.some(s => s.id === 'task_abc123_def456')).toBe(true);
      expect(activeSessions.some(s => s.id === 'task_xyz789_ghi012')).toBe(true);
    });

    it('should resume paused sessions', async () => {
      const sessionId = 'task_test123_resume';

      // Create and pause a session
      await sessionStore.createSession({
        id: sessionId,
        description: 'Test resume functionality',
        status: 'paused',
        createdAt: new Date(),
        updatedAt: new Date(),
        context: { stage: 'implementation', progress: 50 }
      });

      const session = await sessionStore.getSession(sessionId);
      expect(session).toBeTruthy();
      expect(session!.status).toBe('paused');

      // Test resuming
      await sessionStore.updateSession(sessionId, { status: 'in-progress' });

      const resumedSession = await sessionStore.getSession(sessionId);
      expect(resumedSession!.status).toBe('in-progress');
      expect(resumedSession!.context.progress).toBe(50);
    });

    it('should attach to running sessions', async () => {
      const sessionId = 'task_test456_attach';

      await sessionStore.createSession({
        id: sessionId,
        description: 'Test attach functionality',
        status: 'in-progress',
        createdAt: new Date(),
        updatedAt: new Date(),
        logs: ['Starting task...', 'Planning phase complete']
      });

      const session = await sessionStore.getSession(sessionId);
      expect(session).toBeTruthy();
      expect(session!.logs).toContain('Planning phase complete');
    });

    it('should handle background task execution', async () => {
      const backgroundSession = await sessionStore.createSession({
        id: 'task_bg789_background',
        description: 'Background task test',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
        isBackground: true
      });

      expect(backgroundSession.isBackground).toBe(true);

      const backgroundTasks = await sessionStore.listSessions({ background: true });
      expect(backgroundTasks.some(t => t.id === 'task_bg789_background')).toBe(true);
    });
  });

  describe('Keyboard Shortcuts Integration', () => {
    beforeEach(() => {
      shortcutManager.initialize();
    });

    afterEach(() => {
      shortcutManager.destroy();
    });

    it('should register essential shortcuts as documented', () => {
      const shortcuts = shortcutManager.getShortcuts();

      // Verify documented shortcuts are registered
      const documentedShortcuts = [
        { keys: ['ctrl', 'c'], description: 'Cancel' },
        { keys: ['ctrl', 'z'], description: 'Pause' },
        { keys: ['ctrl', 'l'], description: 'Clear' },
        { keys: ['tab'], description: 'Complete' }
      ];

      for (const documented of documentedShortcuts) {
        const found = shortcuts.find(s =>
          s.keys.every(key => documented.keys.includes(key)) &&
          s.description.toLowerCase().includes(documented.description.toLowerCase())
        );

        expect(found, `Shortcut ${documented.keys.join('+')} should be registered`)
          .toBeTruthy();
      }
    });

    it('should handle graceful task termination on Ctrl+C', async () => {
      const terminationHandler = vi.fn();
      shortcutManager.onTermination(terminationHandler);

      // Simulate Ctrl+C
      shortcutManager.handleKey('ctrl+c');

      expect(terminationHandler).toHaveBeenCalled();
    });

    it('should handle task pause/resume on Ctrl+Z', async () => {
      const pauseHandler = vi.fn();
      shortcutManager.onPause(pauseHandler);

      // Simulate Ctrl+Z
      shortcutManager.handleKey('ctrl+z');

      expect(pauseHandler).toHaveBeenCalled();
    });

    it('should clear screen while preserving task state on Ctrl+L', async () => {
      const clearHandler = vi.fn();
      shortcutManager.onClear(clearHandler);

      // Simulate Ctrl+L
      shortcutManager.handleKey('ctrl+l');

      expect(clearHandler).toHaveBeenCalledWith({ preserveState: true });
    });
  });

  describe('Rich Terminal UI Components', () => {
    it('should display progress indicators as documented', () => {
      const mockTaskState = {
        id: 'task_test_ui',
        description: 'Add authentication middleware',
        stage: 'implementation',
        agent: 'developer',
        progress: 0.7,
        recentActions: [
          'Created auth middleware structure',
          'Added JWT validation logic',
          'Writing error handling...'
        ],
        tokens: 12456,
        cost: 0.0425,
        elapsed: 83000 // 1m 23s
      };

      render(<App initialTask={mockTaskState} />);

      // Verify progress display matches documentation
      expect(screen.getByText(/Add authentication middleware/)).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/developer/)).toBeInTheDocument();
      expect(screen.getByText(/70%/)).toBeInTheDocument();
    });

    it('should display interactive controls properly', () => {
      const mockTaskState = {
        id: 'task_test_controls',
        description: 'Test task',
        stage: 'planning',
        agent: 'planner',
        progress: 0.3
      };

      render(<App initialTask={mockTaskState} />);

      // Check for control hints in the UI
      expect(screen.getByText(/Space.*Pause\/resume/i)).toBeInTheDocument();
      expect(screen.getByText(/q.*Quit/i)).toBeInTheDocument();
    });

    it('should use color-coded status indicators', () => {
      const statuses = [
        { status: 'completed', expectedColor: 'green', emoji: '🟢' },
        { status: 'warning', expectedColor: 'yellow', emoji: '🟡' },
        { status: 'error', expectedColor: 'red', emoji: '🔴' },
        { status: 'info', expectedColor: 'blue', emoji: '🔵' }
      ];

      for (const { status, emoji } of statuses) {
        const mockState = {
          id: 'task_test_color',
          description: 'Test color coding',
          status,
          messages: [`${emoji} Test message`]
        };

        render(<App initialTask={mockState} />);
        expect(screen.getByText(new RegExp(emoji))).toBeInTheDocument();
      }
    });

    it('should show cost and token information', () => {
      const mockTaskState = {
        id: 'task_test_metrics',
        description: 'Test metrics display',
        tokens: 45234,
        cost: 0.1523,
        elapsed: 222000 // 3m 42s
      };

      render(<App initialTask={mockTaskState} />);

      expect(screen.getByText(/45,234/)).toBeInTheDocument(); // Tokens
      expect(screen.getByText(/\$0\.15/)).toBeInTheDocument(); // Cost
      expect(screen.getByText(/3m 42s/)).toBeInTheDocument(); // Duration
    });
  });

  describe('Installation and Setup Validation', () => {
    it('should validate package.json structure for global installation', async () => {
      const packageJsonPath = path.join(__dirname, '../../packages/cli/package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      expect(packageJson.name).toBe('@apexcli/cli');
      expect(packageJson.bin).toBeDefined();
      expect(packageJson.bin.apex).toBeDefined();
    });

    it('should verify completion command availability', async () => {
      // This would test if `apex completion` command works
      const completionCommands = ['bash', 'zsh', 'fish'];

      for (const shell of completionCommands) {
        const completionOutput = await completionEngine.generateCompletion(shell);
        expect(completionOutput).toBeTruthy();
        expect(completionOutput.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle session not found gracefully', async () => {
      const nonExistentId = 'task_nonexistent_123';
      const session = await sessionStore.getSession(nonExistentId);

      expect(session).toBeNull();
    });

    it('should handle completion with invalid input', async () => {
      const completions = await completionEngine.complete('invalid_command_xyz ');

      // Should return empty array or fallback completions
      expect(Array.isArray(completions)).toBe(true);
    });

    it('should handle keyboard shortcuts in different contexts', () => {
      const contexts = ['input', 'menu', 'confirmation'];

      for (const context of contexts) {
        shortcutManager.setContext(context);

        // Should still handle basic shortcuts
        const shortcuts = shortcutManager.getActiveShortcuts();
        expect(shortcuts.some(s => s.keys.includes('ctrl') && s.keys.includes('c'))).toBe(true);
      }
    });

    it('should validate autonomy level inputs', () => {
      const validLevels = ['full', 'review-before-commit', 'review-before-merge', 'manual'];
      const invalidLevels = ['invalid', 'unknown', '', null];

      for (const level of validLevels) {
        expect(completionEngine.isValidAutonomyLevel(level)).toBe(true);
      }

      for (const level of invalidLevels) {
        expect(completionEngine.isValidAutonomyLevel(level)).toBe(false);
      }
    });
  });
});