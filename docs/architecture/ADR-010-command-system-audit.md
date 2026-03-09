# ADR-010: Command System Architecture Audit

## Status
**Verified** - Architecture audit completed 2024-03

## Context
This Architecture Decision Record documents the verification audit of the APEX slash command system in REPL mode. The audit confirms that all slash commands are registered and routed correctly.

## Command System Architecture Overview

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Input                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   App.tsx (UI Layer)                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ handleInput() - Entry point for all user input              │ │
│  │   • UI commands (exit, quit, clear, help) - handled locally │ │
│  │   • Non-UI commands - delegated to onCommand callback       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ onCommand(command, args)
┌─────────────────────────────────────────────────────────────────┐
│                   repl.tsx (Command Layer)                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ handleCommand() - Main router with switch-case              │ │
│  │   • Routes 18 command cases to handler functions            │ │
│  │   • Supports command aliases (s→status, log→logs, p→preview)│ │
│  │   • Default case for unknown commands                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Handler Functions                                 │
│  • handleInit()     • handleConfig()    • handleCompact()       │
│  • handleStatus()   • handleBrowser()   • handleVerbose()       │
│  • handleAgents()   • handleServe()     • handlePreview()       │
│  • handleWorkflows()• handleWeb()       • handleThoughts()      │
│  • handleStop()     • handleCancel()    • handleSession() ──────┼──┐
│  • handleRetry()    • handleResume()    • handleLogs()          │  │
└─────────────────────────────────────────────────────────────────┘  │
                                                                     │
                              ┌───────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              session-handlers.ts (Delegated)                     │
│  • handleSessionList()    • handleSessionBranch()               │
│  • handleSessionLoad()    • handleSessionExport()               │
│  • handleSessionSave()    • handleSessionDelete()               │
│  • handleSessionInfo()                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Command Registry

### Primary Commands (handleCommand router in repl.tsx)

| Command | Alias | Handler | Description | Status |
|---------|-------|---------|-------------|--------|
| `/init` | - | `handleInit(args)` | Initialize APEX project | ✅ Verified |
| `/status` | `/s` | `handleStatus(args)` | Show task status | ✅ Verified |
| `/agents` | - | `handleAgents()` | List available agents | ✅ Verified |
| `/workflows` | - | `handleWorkflows()` | List available workflows | ✅ Verified |
| `/config` | - | `handleConfig(args)` | View/edit configuration | ✅ Verified |
| `/browser` | - | `handleBrowser(args)` | Browser tool config | ✅ Verified |
| `/serve` | - | `handleServe(args)` | Start API server | ✅ Verified |
| `/web` | - | `handleWeb(args)` | Start Web UI | ✅ Verified |
| `/stop` | - | `handleStop()` | Stop services | ✅ Verified |
| `/cancel` | - | `handleCancel(args)` | Cancel a task | ✅ Verified |
| `/retry` | - | `handleRetry(args)` | Retry a task | ✅ Verified |
| `/resume` | - | `handleResume(args)` | Resume paused task | ✅ Verified |
| `/logs` | `/log` | `handleLogs(args)` | View task logs | ✅ Verified |
| `/session` | - | `handleSession(args)` | Session management | ✅ Verified |
| `/compact` | - | `handleCompact()` | Toggle compact mode | ✅ Verified |
| `/verbose` | - | `handleVerbose()` | Toggle verbose mode | ✅ Verified |
| `/preview` | `/p` | `handlePreview(args)` | Preview mode settings | ✅ Verified |
| `/thoughts` | - | `handleThoughts(args)` | Toggle thought visibility | ✅ Verified |

### UI-Level Commands (handled in App.tsx)

| Command | Aliases | Handling | Status |
|---------|---------|----------|--------|
| `/exit` | `/quit`, `/q` | `handleExit()` | ✅ Verified |
| `/clear` | - | State reset | ✅ Verified |
| `/help` | `/h`, `/?` | Show help overlay | ✅ Verified |

### Session Subcommands (delegated to session-handlers.ts)

| Subcommand | Handler | Description | Status |
|------------|---------|-------------|--------|
| `list` | `handleSessionList()` | List sessions | ✅ Verified |
| `load` | `handleSessionLoad()` | Load a session | ✅ Verified |
| `save` | `handleSessionSave()` | Save current session | ✅ Verified |
| `branch` | `handleSessionBranch()` | Create session branch | ✅ Verified |
| `export` | `handleSessionExport()` | Export session | ✅ Verified |
| `delete` | `handleSessionDelete()` | Delete session | ✅ Verified |
| `info` | `handleSessionInfo()` | Session info | ✅ Verified |

## Router Implementation Details

### handleCommand() Switch-Case Structure (repl.tsx:1329-1394)

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
    case 'agents':
      await handleAgents();
      break;
    // ... (15 more cases)
    default:
      ctx.app?.addMessage({
        type: 'error',
        content: `Unknown command: ${command}. Type /help for available commands.`,
      });
  }
}
```

### Error Handling Pattern

All handlers follow consistent error handling:
1. Check `ctx.initialized` for commands requiring APEX setup
2. Validate required arguments
3. Use `ctx.app?.addMessage()` for user feedback
4. Support both `error` and `system` message types

### State Update Pattern

Handlers consistently use:
- `ctx.app?.addMessage()` for displaying messages
- `ctx.app?.updateState()` for updating UI state
- Proper async/await for all handler calls

## Verification Evidence

### Test Coverage

- **tests/slash-commands-verification.test.ts**: 20 tests verifying command architecture
- **tests/repl-command-routing-audit.test.ts**: 28 tests verifying command routing

### Key Verification Points

1. ✅ All 17 specified commands have switch-case entries
2. ✅ All handler functions are defined and properly typed
3. ✅ Command aliases correctly route to their handlers
4. ✅ Default case handles unknown commands gracefully
5. ✅ Session commands properly delegate to session-handlers.ts
6. ✅ UI commands handled at App.tsx level before reaching handleCommand
7. ✅ All handlers follow consistent async/await pattern
8. ✅ Error handling provides clear user feedback

## Decision

The command system architecture is **VERIFIED FUNCTIONAL**:

1. **Router Pattern**: The switch-case router in `handleCommand()` correctly maps all 18 command cases to their handlers
2. **Handler Functions**: All 15 handler functions are properly defined with correct signatures
3. **Aliases**: Command aliases (s, log, p) are correctly implemented
4. **Delegation**: Session commands are properly delegated to external handlers
5. **Error Handling**: Unknown commands receive appropriate error messages

## Consequences

### Positive
- Clean separation between UI-level and business logic commands
- Consistent handler pattern enables easy extension
- Command aliases improve user experience
- Comprehensive test coverage ensures stability

### Maintenance Notes
- Adding new commands requires:
  1. Adding case to `handleCommand()` switch
  2. Implementing handler function
  3. Adding to help system in App.tsx suggestions
  4. Adding verification tests

## Related Documents
- packages/cli/src/repl.tsx - Main command router
- packages/cli/src/ui/App.tsx - UI layer command handling
- packages/cli/src/handlers/session-handlers.ts - Session command handlers
- tests/slash-commands-verification.test.ts - Architecture verification tests
- tests/repl-command-routing-audit.test.ts - Routing audit tests
