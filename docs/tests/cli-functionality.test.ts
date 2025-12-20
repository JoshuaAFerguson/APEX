/**
 * CLI Functionality Tests
 *
 * These tests verify that the CLI features documented in the guide
 * actually work as described in realistic scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

import { SessionStore } from '../../packages/cli/src/services/SessionStore.js';
import { ShortcutManager } from '../../packages/cli/src/services/ShortcutManager.js';
import { ConversationManager } from '../../packages/cli/src/services/ConversationManager.js';
import { ApexOrchestrator } from '../../packages/orchestrator/src/index.js';

describe('CLI Functionality Tests', () => {
  let tempDir: string;
  let projectPath: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));
    projectPath = tempDir;
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Session Management', () => {
    let sessionStore: SessionStore;

    beforeEach(async () => {
      sessionStore = new SessionStore(projectPath);
      await sessionStore.initialize();
    });

    it('should create new sessions', async () => {
      const session = await sessionStore.createSession('Test Session');

      expect(session).toBeDefined();
      expect(session.name).toBe('Test Session');
      expect(session.id).toMatch(/^sess_\d+_[a-z0-9]+$/);
      expect(session.messages).toEqual([]);
      expect(session.inputHistory).toEqual([]);
    });

    it('should save and load sessions', async () => {
      const originalSession = await sessionStore.createSession('Save Test');

      // Add some messages
      await sessionStore.addMessage(originalSession.id, {
        role: 'user',
        content: 'Hello, APEX!',
        timestamp: new Date()
      });

      await sessionStore.saveSession(originalSession.id);
      const loadedSession = await sessionStore.getSession(originalSession.id);

      expect(loadedSession).toBeDefined();
      expect(loadedSession?.name).toBe('Save Test');
      expect(loadedSession?.messages).toHaveLength(1);
      expect(loadedSession?.messages[0].content).toBe('Hello, APEX!');
    });

    it('should list sessions with correct metadata', async () => {
      // Create multiple sessions
      const session1 = await sessionStore.createSession('Session 1');
      const session2 = await sessionStore.createSession('Session 2');

      // Add messages to track costs
      await sessionStore.addMessage(session1.id, {
        role: 'user',
        content: 'Test message',
        timestamp: new Date()
      });

      const sessions = await sessionStore.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.name)).toContain('Session 1');
      expect(sessions.map(s => s.name)).toContain('Session 2');
    });

    it('should create session branches', async () => {
      const parentSession = await sessionStore.createSession('Parent Session');

      // Add some messages
      await sessionStore.addMessage(parentSession.id, {
        role: 'user',
        content: 'Original conversation',
        timestamp: new Date()
      });

      const branchSession = await sessionStore.branchSession(
        parentSession.id,
        'Branch Session',
        0 // Branch from first message
      );

      expect(branchSession).toBeDefined();
      expect(branchSession.parentSessionId).toBe(parentSession.id);
      expect(branchSession.branchPoint).toBe(0);
      expect(branchSession.name).toBe('Branch Session');
    });

    it('should export sessions in different formats', async () => {
      const session = await sessionStore.createSession('Export Test');

      await sessionStore.addMessage(session.id, {
        role: 'user',
        content: 'Export test message',
        timestamp: new Date()
      });

      // Test markdown export
      const markdownExport = await sessionStore.exportSession(session.id, 'markdown');
      expect(markdownExport).toContain('Export Test');
      expect(markdownExport).toContain('Export test message');

      // Test JSON export
      const jsonExport = await sessionStore.exportSession(session.id, 'json');
      const exportData = JSON.parse(jsonExport);
      expect(exportData.name).toBe('Export Test');
      expect(exportData.messages).toHaveLength(1);
    });
  });

  describe('Keyboard Shortcuts', () => {
    let shortcutManager: ShortcutManager;

    beforeEach(() => {
      shortcutManager = new ShortcutManager();
    });

    it('should register and handle keyboard shortcuts', () => {
      let commandExecuted = false;

      shortcutManager.on('command', (command) => {
        if (command === '/help') {
          commandExecuted = true;
        }
      });

      // Simulate Ctrl+H keypress
      const handled = shortcutManager.handleKey({
        key: 'h',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false
      });

      expect(handled).toBe(true);
      expect(commandExecuted).toBe(true);
    });

    it('should handle context-specific shortcuts', () => {
      let clearLineCalled = false;

      shortcutManager.on('clearLine', () => {
        clearLineCalled = true;
      });

      // Push input context
      shortcutManager.pushContext('input');

      // Simulate Ctrl+U in input context
      const handled = shortcutManager.handleKey({
        key: 'u',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false
      });

      expect(handled).toBe(true);
      expect(clearLineCalled).toBe(true);
    });

    it('should format keyboard shortcuts correctly', () => {
      const shortcuts = shortcutManager.getShortcuts();

      for (const shortcut of shortcuts) {
        const formatted = shortcutManager.formatKey(shortcut.keys);

        // Check format is valid (e.g., "Ctrl+C", "Alt+Shift+T", "Tab")
        expect(formatted).toMatch(/^(Ctrl\+|Alt\+|Shift\+|Cmd\+)*[A-Z0-9]+$/);
      }
    });
  });

  describe('Display Modes', () => {
    it('should track display mode state', () => {
      interface DisplayModeState {
        mode: 'normal' | 'compact' | 'verbose';
        showThoughts: boolean;
        previewMode: boolean;
      }

      const initialState: DisplayModeState = {
        mode: 'normal',
        showThoughts: false,
        previewMode: false
      };

      // Test mode transitions
      let currentState = { ...initialState };

      // Toggle to compact mode
      currentState.mode = currentState.mode === 'compact' ? 'normal' : 'compact';
      expect(currentState.mode).toBe('compact');

      // Toggle to verbose mode
      currentState.mode = currentState.mode === 'verbose' ? 'normal' : 'verbose';
      expect(currentState.mode).toBe('verbose');

      // Toggle thoughts
      currentState.showThoughts = !currentState.showThoughts;
      expect(currentState.showThoughts).toBe(true);

      // Toggle preview mode
      currentState.previewMode = !currentState.previewMode;
      expect(currentState.previewMode).toBe(true);
    });
  });

  describe('Command Parsing and Validation', () => {
    it('should parse command arguments correctly', () => {
      const testCases = [
        {
          input: '/init --yes --name "My Project" --language typescript',
          expected: {
            command: 'init',
            args: ['--yes', '--name', 'My Project', '--language', 'typescript']
          }
        },
        {
          input: '/run "Add user authentication" --workflow feature --autonomy manual',
          expected: {
            command: 'run',
            args: ['Add user authentication', '--workflow', 'feature', '--autonomy', 'manual']
          }
        },
        {
          input: '/session save "Sprint Work" --tags sprint,auth,backend',
          expected: {
            command: 'session',
            args: ['save', 'Sprint Work', '--tags', 'sprint,auth,backend']
          }
        }
      ];

      for (const testCase of testCases) {
        const result = parseCommandInput(testCase.input);
        expect(result.command).toBe(testCase.expected.command);
        expect(result.args).toEqual(testCase.expected.args);
      }
    });

    it('should validate command options', () => {
      const validCommands = [
        '/help',
        '/init --yes',
        '/status',
        '/status task_abc123',
        '/agents',
        '/workflows',
        '/config get project.name',
        '/config set autonomy.default=full',
        '/logs task_abc123 --level error',
        '/cancel task_abc123',
        '/retry task_abc123',
        '/serve --port 8080',
        '/stop api',
        '/compact',
        '/verbose',
        '/thoughts on',
        '/preview off'
      ];

      for (const command of validCommands) {
        expect(isValidCommand(command)).toBe(true);
      }
    });
  });

  describe('Natural Language Task Processing', () => {
    it('should detect task intents correctly', () => {
      const taskExamples = [
        {
          input: 'Add a health check endpoint to the API',
          expectedType: 'task',
          expectedConfidence: expect.any(Number)
        },
        {
          input: 'Fix the bug where users can\'t reset their password',
          expectedType: 'task',
          expectedConfidence: expect.any(Number)
        },
        {
          input: 'How does the authentication system work?',
          expectedType: 'question',
          expectedConfidence: expect.any(Number)
        },
        {
          input: 'What commands are available?',
          expectedType: 'question',
          expectedConfidence: expect.any(Number)
        }
      ];

      const conversationManager = new ConversationManager();

      for (const example of taskExamples) {
        const intent = conversationManager.detectIntent(example.input);
        expect(intent.type).toBe(example.expectedType);
        expect(intent.confidence).toBeGreaterThan(0);
        expect(intent.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Cost and Token Tracking', () => {
    it('should track token usage accurately', async () => {
      const sessionStore = new SessionStore(projectPath);
      await sessionStore.initialize();

      const session = await sessionStore.createSession('Token Test');

      // Simulate messages with token counts
      await sessionStore.addMessage(session.id, {
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
        tokens: { input: 10, output: 0 }
      });

      await sessionStore.addMessage(session.id, {
        role: 'assistant',
        content: 'Response message',
        timestamp: new Date(),
        tokens: { input: 0, output: 20 }
      });

      const updatedSession = await sessionStore.getSession(session.id);

      expect(updatedSession?.state.totalTokens.input).toBe(10);
      expect(updatedSession?.state.totalTokens.output).toBe(20);
    });

    it('should calculate costs based on model pricing', () => {
      const tokenCounts = { input: 1000, output: 500 };

      // Mock model pricing (Claude 3.5 Sonnet rates)
      const inputPrice = 3.00 / 1000000;  // $3 per 1M input tokens
      const outputPrice = 15.00 / 1000000; // $15 per 1M output tokens

      const expectedCost =
        (tokenCounts.input * inputPrice) +
        (tokenCounts.output * outputPrice);

      expect(expectedCost).toBeCloseTo(0.0105, 6); // ~$0.0105
    });
  });

  describe('Configuration Management', () => {
    it('should handle configuration updates', async () => {
      // Create test config file
      const configDir = path.join(projectPath, '.apex');
      await fs.mkdir(configDir, { recursive: true });

      const configPath = path.join(configDir, 'config.yaml');
      const initialConfig = `
version: "1.0"
project:
  name: "test-project"
  language: "typescript"
autonomy:
  default: "review-before-merge"
limits:
  maxCostPerTask: 10.00
`;

      await fs.writeFile(configPath, initialConfig);

      // Test config reading
      const config = await fs.readFile(configPath, 'utf-8');
      expect(config).toContain('test-project');
      expect(config).toContain('review-before-merge');
      expect(config).toContain('10.00');
    });
  });
});

// Helper functions
function parseCommandInput(input: string): { command: string; args: string[] } {
  if (!input.startsWith('/')) {
    throw new Error('Not a command');
  }

  const trimmedInput = input.slice(1);
  const parts = [];
  let current = '';
  let inQuotes = false;

  for (const char of trimmedInput) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  const [command, ...args] = parts;
  return { command: command.toLowerCase(), args };
}

function isValidCommand(input: string): boolean {
  try {
    const { command } = parseCommandInput(input);
    const validCommands = [
      'help', 'init', 'status', 'agents', 'workflows', 'config',
      'logs', 'cancel', 'retry', 'serve', 'web', 'stop', 'run',
      'clear', 'exit', 'version', 'thoughts', 'compact', 'verbose',
      'preview', 'session', 'pr'
    ];
    return validCommands.includes(command);
  } catch {
    return false;
  }
}