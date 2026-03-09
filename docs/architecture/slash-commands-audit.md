# APEX REPL Slash Commands Architecture Audit

## Technical Design Document

**Date:** 2024-03-01
**Version:** 1.0
**Status:** ✅ Verified Working

---

## Executive Summary

This document provides a comprehensive technical audit of the APEX REPL slash command system. All 18 specified slash commands have been verified as correctly registered and routed in REPL mode. The `handleCommand()` router function has been confirmed functional with proper delegation patterns.

---

## Architecture Overview

### Command Flow Pipeline

```
User Input → App.tsx (handleInput) → onCommand → repl.tsx (handleCommand) → Handler Functions
                     ↓
              UI-Level Commands (exit, quit, clear, help)
              handled directly in App.tsx
```

### Component Roles

1. **App.tsx** (`packages/cli/src/ui/App.tsx`)
   - Handles user input via `handleInput()`
   - Processes UI-level commands (exit, quit, clear, help) locally
   - Delegates non-UI commands to `onCommand()` callback

2. **repl.tsx** (`packages/cli/src/repl.tsx`)
   - Provides `handleCommand()` as the `onCommand` callback
   - Routes commands via switch-case statement
   - Manages REPL context (`ApexContext`)

3. **session-handlers.ts** (`packages/cli/src/handlers/session-handlers.ts`)
   - Extracted session subcommand handlers for modularity
   - Handles: list, load, save, branch, export, delete, info

---

## Verified Commands

### Core Commands (17 commands + aliases)

| Command | Alias | Handler | Status |
|---------|-------|---------|--------|
| `/init` | - | `handleInit()` | ✅ |
| `/status` | `/s` | `handleStatus()` | ✅ |
| `/agents` | - | `handleAgents()` | ✅ |
| `/workflows` | - | `handleWorkflows()` | ✅ |
| `/config` | - | `handleConfig()` | ✅ |
| `/serve` | - | `handleServe()` | ✅ |
| `/web` | - | `handleWeb()` | ✅ |
| `/stop` | - | `handleStop()` | ✅ |
| `/cancel` | - | `handleCancel()` | ✅ |
| `/retry` | - | `handleRetry()` | ✅ |
| `/resume` | - | `handleResume()` | ✅ |
| `/logs` | `/log` | `handleLogs()` | ✅ |
| `/session` | - | `handleSession()` | ✅ |
| `/compact` | - | `handleCompact()` | ✅ |
| `/verbose` | - | `handleVerbose()` | ✅ |
| `/preview` | `/p` | `handlePreview()` | ✅ |
| `/thoughts` | - | `handleThoughts()` | ✅ |

### UI-Level Commands (handled in App.tsx)

| Command | Aliases | Description |
|---------|---------|-------------|
| `/exit` | `/quit`, `/q` | Exit the REPL |
| `/clear` | - | Clear message history |
| `/help` | `/h`, `/?` | Show help overlay |

---

## Command Router Implementation

### handleCommand() Function

Location: `packages/cli/src/repl.tsx` (lines 1329-1394)

```typescript
async function handleCommand(command: string, args: string[]): Promise<void> {
  switch (command) {
    case 'init':
      await handleInit(args);
      break;
    case 'status':
    case 's':
      await handleStatus(args);
      break;
    // ... (17 more cases)
    default:
      ctx.app?.addMessage({
        type: 'error',
        content: `Unknown command: ${command}. Type /help for available commands.`,
      });
  }
}
```

### Design Patterns Verified

1. **Async/Await Consistency**: All handlers are async functions returning `Promise<void>`
2. **Error Handling**: Consistent `ctx.app?.addMessage()` pattern for errors
3. **State Updates**: Uniform `ctx.app?.updateState()` for state changes
4. **Initialization Checks**: Handlers verify `ctx.initialized` before execution
5. **Alias Support**: Switch-case fallthrough for command aliases

---

## Session Command Architecture

### Delegation Pattern

The `/session` command delegates to extracted handlers in `session-handlers.ts`:

```typescript
// repl.tsx
async function handleSession(args: string[]): Promise<void> {
  const sessionContext: SessionContext = {
    initialized: ctx.initialized,
    sessionStore: ctx.sessionStore,
    sessionAutoSaver: ctx.sessionAutoSaver,
    app: ctx.app,
  };
  await handleSessionCommand(args, sessionContext);
}
```

### Session Subcommands

| Subcommand | Handler | Description |
|------------|---------|-------------|
| `list` | `handleSessionList()` | List available sessions |
| `load` | `handleSessionLoad()` | Load a session by ID |
| `save` | `handleSessionSave()` | Save current session |
| `branch` | `handleSessionBranch()` | Create branch from session |
| `export` | `handleSessionExport()` | Export session to file |
| `delete` | `handleSessionDelete()` | Delete a session |
| `info` | `handleSessionInfo()` | Show current session info |

---

## Help Suggestions Integration

All commands are registered in `App.tsx` for autocomplete suggestions:

```typescript
const commands = [
  '/help', '/init', '/status', '/agents', '/workflows', '/config',
  '/serve', '/web', '/stop', '/cancel', '/retry', '/resume',
  '/logs', '/session', '/compact', '/verbose', '/preview', '/thoughts',
  '/clear', '/exit', '/quit', '/q',
];
```

---

## Test Coverage

### Test Files

1. `tests/slash-commands-verification.test.ts` - Architecture verification (20 tests)
2. `tests/repl-command-routing-audit.test.ts` - Handler behavior tests (28 tests)

### Test Results

```
Test Files:  2 passed (2)
Tests:       48 passed (48)
```

### Verified Aspects

- ✅ Switch-case mappings for all commands
- ✅ Handler function definitions
- ✅ Function signatures and typing
- ✅ UI-level command routing
- ✅ Session command delegation
- ✅ Error handling patterns
- ✅ State update patterns
- ✅ Command count verification
- ✅ Acceptance criteria compliance

---

## Acceptance Criteria Compliance

| Criteria | Status |
|----------|--------|
| /init verified working | ✅ |
| /status verified working | ✅ |
| /agents verified working | ✅ |
| /workflows verified working | ✅ |
| /config verified working | ✅ |
| /serve verified working | ✅ |
| /web verified working | ✅ |
| /stop verified working | ✅ |
| /cancel verified working | ✅ |
| /retry verified working | ✅ |
| /resume verified working | ✅ |
| /logs verified working | ✅ |
| /session verified working | ✅ |
| /compact verified working | ✅ |
| /verbose verified working | ✅ |
| /preview verified working | ✅ |
| /thoughts verified working | ✅ |
| handleCommand() router functional | ✅ |

---

## Files Involved

| File | Role |
|------|------|
| `packages/cli/src/repl.tsx` | Main REPL with handleCommand() router |
| `packages/cli/src/ui/App.tsx` | UI component with handleInput() |
| `packages/cli/src/handlers/session-handlers.ts` | Extracted session handlers |
| `tests/slash-commands-verification.test.ts` | Architecture verification tests |
| `tests/repl-command-routing-audit.test.ts` | Handler behavior tests |

---

## Recommendations

1. **Consider Command Registry Pattern**: For future extensibility, consider using a command registry instead of a switch statement
2. **Add Command Documentation**: Each handler could include JSDoc with usage examples
3. **Keyboard Shortcut Integration**: Consider adding keyboard shortcuts for frequent commands

---

## Conclusion

The APEX REPL slash command system is well-architected with proper separation of concerns, consistent error handling, and comprehensive test coverage. All 17+ specified commands are correctly registered and routed through the `handleCommand()` function. The session command delegation to extracted handlers demonstrates good modularity practices.
