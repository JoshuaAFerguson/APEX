/**
 * Comprehensive Slash Commands Verification Test Suite
 *
 * This test suite verifies the complete slash command system architecture
 * as documented in ADR-010. It tests:
 *
 * 1. Command router switch-case mappings in repl.tsx
 * 2. Command aliases (status/s, logs/log, preview/p, etc.)
 * 3. UI-level command routing in App.tsx
 * 4. Session command delegation to session-handlers.ts
 * 5. Default handler for unknown commands
 *
 * The tests use source code analysis to verify the command routing
 * architecture is correctly implemented.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

// Expected command mappings based on ADR-010
const EXPECTED_COMMAND_MAPPINGS = {
  // Main repl.tsx handleCommand() switch-case mappings
  'init': 'handleInit',
  'status': 'handleStatus',
  's': 'handleStatus', // alias for status
  'agents': 'handleAgents',
  'workflows': 'handleWorkflows',
  'config': 'handleConfig',
  'browser': 'handleBrowser',
  'serve': 'handleServe',
  'web': 'handleWeb',
  'stop': 'handleStop',
  'cancel': 'handleCancel',
  'retry': 'handleRetry',
  'resume': 'handleResume',
  'logs': 'handleLogs',
  'log': 'handleLogs', // alias for logs
  'session': 'handleSession',
  'compact': 'handleCompact',
  'verbose': 'handleVerbose',
  'preview': 'handlePreview',
  'p': 'handlePreview', // alias for preview
  'thoughts': 'handleThoughts',
};

// UI-level commands handled in App.tsx
const EXPECTED_UI_COMMANDS = {
  'exit': true,
  'quit': true,
  'q': true, // alias for quit
  'clear': true,
  'help': true,
  'h': true, // alias for help
  '?': true, // alias for help
};

// Session subcommands expected to be handled in session-handlers.ts
const EXPECTED_SESSION_SUBCOMMANDS = [
  'list',
  'load',
  'save',
  'branch',
  'export',
  'delete',
  'info',
];

let replSourceCode: string;
let appSourceCode: string;
let sessionHandlersSourceCode: string;

beforeAll(async () => {
  // Read source files for analysis
  const packagesCliSrc = path.join(process.cwd(), 'packages/cli/src');

  replSourceCode = await fs.readFile(path.join(packagesCliSrc, 'repl.tsx'), 'utf-8');
  appSourceCode = await fs.readFile(path.join(packagesCliSrc, 'ui/App.tsx'), 'utf-8');
  sessionHandlersSourceCode = await fs.readFile(
    path.join(packagesCliSrc, 'handlers/session-handlers.ts'),
    'utf-8'
  );
});

describe('Slash Commands Architecture Verification', () => {
  describe('handleCommand() Router Switch-Case Mappings', () => {
    test('should have handleCommand function with correct switch statement', () => {
      expect(replSourceCode).toContain('async function handleCommand(command: string, args: string[]): Promise<void>');
      expect(replSourceCode).toContain('switch (command)');
    });

    test('should map all expected commands to their handlers in switch-case', () => {
      for (const [command, expectedHandler] of Object.entries(EXPECTED_COMMAND_MAPPINGS)) {
        // Check for case statement
        expect(replSourceCode).toContain(`case '${command}':`);

        // Check that the handler is called
        const regex = new RegExp(`case '${command}':[\\s\\S]*?await ${expectedHandler}\\(`, 'm');
        expect(replSourceCode).toMatch(regex);
      }
    });

    test('should have default case with error message', () => {
      expect(replSourceCode).toContain('default:');
      expect(replSourceCode).toContain('Unknown command');
      expect(replSourceCode).toContain('Type /help for available commands');
    });
  });

  describe('Command Handler Function Definitions', () => {
    test('should define all expected handler functions', () => {
      const uniqueHandlers = [...new Set(Object.values(EXPECTED_COMMAND_MAPPINGS))];

      for (const handler of uniqueHandlers) {
        // Check function definition exists
        const regex = new RegExp(`async function ${handler}\\(`, 'm');
        expect(replSourceCode).toMatch(regex);
      }
    });

    test('should have proper function signatures for handlers', () => {
      // Test a few key handlers have correct signatures
      expect(replSourceCode).toMatch(/async function handleInit\(args: string\[\]\): Promise<void>/);
      expect(replSourceCode).toMatch(/async function handleStatus\(args: string\[\]\): Promise<void>/);
      expect(replSourceCode).toMatch(/async function handleSession\(args: string\[\]\): Promise<void>/);
      expect(replSourceCode).toMatch(/async function handleCompact\(\): Promise<void>/);
      expect(replSourceCode).toMatch(/async function handleVerbose\(\): Promise<void>/);
    });
  });

  describe('UI-Level Command Routing', () => {
    test('should handle UI commands in App.tsx before reaching handleCommand', () => {
      // Check for handleInput function
      expect(appSourceCode).toContain('const handleInput = useCallback');

      // Check exit commands handling
      expect(appSourceCode).toMatch(/if \(command === 'exit' \|\| command === 'quit' \|\| command === 'q'\)/);
      expect(appSourceCode).toContain('handleExit()');

      // Check clear command handling
      expect(appSourceCode).toMatch(/if \(command === 'clear'\)/);
      expect(appSourceCode).toContain('messages: []');

      // Check help command handling - verify help aliases exist in the code
      expect(appSourceCode).toContain("command === 'help'");
      expect(appSourceCode).toContain("command === 'h'");
      expect(appSourceCode).toContain("command === '?'");
      expect(appSourceCode).toContain('setShowHelp(true)');
    });

    test('should delegate non-UI commands to onCommand callback', () => {
      // Check that commands that are not UI-level get passed to onCommand
      expect(appSourceCode).toContain('onCommand(command, args)');
    });
  });

  describe('Session Command Delegation', () => {
    test('should delegate session commands to session-handlers.ts', () => {
      // Check that handleSession imports and calls the external handler
      expect(replSourceCode).toContain('handleSession as handleSessionCommand');
      expect(replSourceCode).toContain('await handleSessionCommand(args, sessionContext)');
    });

    test('should define session subcommand handlers in session-handlers.ts', () => {
      for (const subcommand of EXPECTED_SESSION_SUBCOMMANDS) {
        // Check for handler functions like handleSessionList, handleSessionLoad, etc.
        const handlerName = `handleSession${subcommand.charAt(0).toUpperCase() + subcommand.slice(1)}`;
        const regex = new RegExp(`(export\\s+)?async function ${handlerName}\\(`, 'm');
        expect(sessionHandlersSourceCode).toMatch(regex);
      }
    });

    test('should export main handleSession function from session-handlers.ts', () => {
      expect(sessionHandlersSourceCode).toMatch(/export\s+(async\s+)?function\s+handleSession\(/);
    });
  });

  describe('Command Flow Integration', () => {
    test('should have proper error handling pattern in handlers', () => {
      // Check that handlers use ctx.app?.addMessage pattern for errors
      expect(replSourceCode).toContain("ctx.app?.addMessage({");
      expect(replSourceCode).toContain("type: 'error'");
      expect(replSourceCode).toContain("type: 'system'");
      expect(replSourceCode).toContain("type: 'assistant'");
    });

    test('should use consistent state update pattern', () => {
      // Check ctx.app?.updateState usage
      expect(replSourceCode).toContain('ctx.app?.updateState');
    });

    test('should have context initialization check pattern', () => {
      // Many handlers check if APEX is initialized
      expect(replSourceCode).toContain('if (!ctx.initialized');
      expect(replSourceCode).toContain('APEX not initialized. Run /init first');
    });
  });

  describe('Command Discovery and Help Integration', () => {
    test('should include all commands in help suggestions', () => {
      // Check that App.tsx includes command suggestions
      const expectedCommands = [
        '/help', '/init', '/status', '/agents', '/workflows', '/config',
        '/serve', '/web', '/stop', '/cancel', '/retry', '/resume',
        '/logs', '/session', '/compact', '/verbose', '/preview', '/thoughts',
        '/clear', '/exit', '/quit'
      ];

      for (const command of expectedCommands) {
        expect(appSourceCode).toContain(`'${command}'`);
      }
    });
  });

  describe('Command Architecture Consistency', () => {
    test('should maintain consistent async/await pattern', () => {
      // All handlers should be async
      const handlerFunctions = replSourceCode.match(/async function handle\w+/g) || [];
      expect(handlerFunctions.length).toBeGreaterThan(10);

      // handleCommand should await all handler calls
      const awaitHandlerCalls = replSourceCode.match(/await handle\w+\(/g) || [];
      expect(awaitHandlerCalls.length).toBeGreaterThanOrEqual(handlerFunctions.length - 1);
    });

    test('should have proper TypeScript typing', () => {
      // Check function signatures have proper typing
      expect(replSourceCode).toContain('Promise<void>');
      expect(replSourceCode).toContain('string[]');
      expect(replSourceCode).toContain('ApexContext');
    });
  });

  describe('Command Router Architecture Verification', () => {
    test('should verify complete command routing pipeline', () => {
      // Test the full pipeline described in ADR-010:
      // Input → handleInput() → onCommand() → handleCommand() → handler functions

      // 1. App.tsx has handleInput
      expect(appSourceCode).toContain('const handleInput = useCallback');

      // 2. App.tsx calls onCommand for non-UI commands
      expect(appSourceCode).toContain('onCommand(command, args)');

      // 3. repl.tsx provides handleCommand as onCommand callback
      expect(replSourceCode).toContain('onCommand: handleCommand');

      // 4. handleCommand has switch-case for all expected commands
      expect(replSourceCode).toContain('switch (command)');
    });

    test('should verify command count matches ADR-010 specification', () => {
      // Count unique commands (excluding aliases) from switch statement
      const switchCases = replSourceCode.match(/case '[^']+'/g) || [];

      // Remove duplicates for aliases and count unique commands
      const uniqueCommands = new Set();
      switchCases.forEach(caseStatement => {
        const command = caseStatement.match(/case '([^']+)'/)?.[1];
        if (command) uniqueCommands.add(command);
      });

      // Should have at least 17 unique commands as specified in acceptance criteria
      expect(uniqueCommands.size).toBeGreaterThanOrEqual(17);
    });
  });

  describe('Acceptance Criteria Compliance', () => {
    test('should verify all specified commands from acceptance criteria are working', () => {
      const requiredCommands = [
        '/init', '/status', '/agents', '/workflows', '/config', '/serve',
        '/web', '/stop', '/cancel', '/retry', '/resume', '/logs',
        '/session', '/compact', '/verbose', '/preview', '/thoughts'
      ];

      for (const command of requiredCommands) {
        const cmdName = command.substring(1); // Remove leading slash

        // Verify command is in switch-case
        expect(replSourceCode).toContain(`case '${cmdName}':`);

        // Verify corresponding handler function exists
        const expectedHandler = EXPECTED_COMMAND_MAPPINGS[cmdName];
        if (expectedHandler) {
          const regex = new RegExp(`async function ${expectedHandler}\\(`, 'm');
          expect(replSourceCode).toMatch(regex);
        }
      }
    });

    test('should confirm command router in handleCommand() is functional', () => {
      // Verify the router structure matches ADR-010 specification
      expect(replSourceCode).toContain('async function handleCommand(command: string, args: string[]): Promise<void>');
      expect(replSourceCode).toContain('switch (command)');
      expect(replSourceCode).toContain('default:');
      expect(replSourceCode).toContain('Unknown command');
    });
  });
});