# ADR-010: Slash Command Architecture Audit for REPL Mode

## Status
**Completed** - Architecture verified and documented

## Date
2026-03-01

## Context
This document captures the technical architecture audit of the `/commands` system in APEX CLI REPL mode, verifying all slash commands are registered and routed correctly.

## Decision
The slash command system architecture follows a clean, maintainable pattern centered around `handleCommand()` in `packages/cli/src/repl.tsx`.

## Architecture Overview

### 1. Command Router Architecture

The central command router is implemented in `repl.tsx` with the following structure:

```
┌─────────────────────────────────────────────────────────────────┐
│                        REPL Entry Point                         │
│                      startInkREPL()                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Ink App UI                              │
│                    packages/cli/src/ui/App.tsx                  │
│                                                                 │
│  - handleInput(): Parses user input                             │
│  - Detects command prefix (/)                                   │
│  - Routes to onCommand callback                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Command Router                             │
│               handleCommand(command, args)                      │
│                                                                 │
│  Location: packages/cli/src/repl.tsx (lines 1329-1394)         │
│                                                                 │
│  Pattern: Switch-case routing with dedicated handlers           │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Command Registration Matrix

| Command | Handler Function | Status | Location |
|---------|-----------------|--------|----------|
| `/init` | `handleInit(args)` | ✅ Verified | repl.tsx:101-174 |
| `/status` or `/s` | `handleStatus(args)` | ✅ Verified | repl.tsx:176-238 |
| `/agents` | `handleAgents()` | ✅ Verified | repl.tsx:241-271 |
| `/workflows` | `handleWorkflows()` | ✅ Verified | repl.tsx:273-304 |
| `/config` | `handleConfig(args)` | ✅ Verified | repl.tsx:306-340 |
| `/browser` | `handleBrowser(args)` | ✅ Verified | repl.tsx:342-421 |
| `/serve` | `handleServe(args)` | ✅ Verified | repl.tsx:423-488 |
| `/web` | `handleWeb(args)` | ✅ Verified | repl.tsx:490-544 |
| `/stop` | `handleStop()` | ✅ Verified | repl.tsx:546-576 |
| `/cancel` | `handleCancel(args)` | ✅ Verified | repl.tsx:578-632 |
| `/retry` | `handleRetry(args)` | ✅ Verified | repl.tsx:634-683 |
| `/resume` | `handleResume(args)` | ✅ Verified | repl.tsx:685-759 |
| `/logs` or `/log` | `handleLogs(args)` | ✅ Verified | repl.tsx:761-819 |
| `/session` | `handleSession(args)` | ✅ Verified | repl.tsx:835-846 |
| `/compact` | `handleCompact()` | ✅ Verified | repl.tsx:1038-1050 |
| `/verbose` | `handleVerbose()` | ✅ Verified | repl.tsx:1052-1064 |
| `/preview` or `/p` | `handlePreview(args)` | ✅ Verified | repl.tsx:1095-1273 |
| `/thoughts` | `handleThoughts(args)` | ✅ Verified | repl.tsx:1275-1323 |

### 3. Switch-Case Router Implementation

```typescript
// packages/cli/src/repl.tsx lines 1329-1394
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
    case 'workflows':
      await handleWorkflows();
      break;
    case 'config':
      await handleConfig(args);
      break;
    case 'browser':
      await handleBrowser(args);
      break;
    case 'serve':
      await handleServe(args);
      break;
    case 'web':
      await handleWeb(args);
      break;
    case 'stop':
      await handleStop();
      break;
    case 'cancel':
      await handleCancel(args);
      break;
    case 'retry':
      await handleRetry(args);
      break;
    case 'resume':
      await handleResume(args);
      break;
    case 'logs':
    case 'log':
      await handleLogs(args);
      break;
    case 'session':
      await handleSession(args);
      break;
    case 'compact':
      await handleCompact();
      break;
    case 'verbose':
      await handleVerbose();
      break;
    case 'preview':
    case 'p':
      await handlePreview(args);
      break;
    case 'thoughts':
      await handleThoughts(args);
      break;
    default:
      ctx.app?.addMessage({
        type: 'error',
        content: `Unknown command: ${command}. Type /help for available commands.`,
      });
  }
}
```

### 4. Additional UI-Level Commands

These commands are handled in `App.tsx` before reaching `handleCommand()`:

| Command | Handler Location | Status |
|---------|-----------------|--------|
| `/exit` | App.tsx:607-610 | ✅ Verified |
| `/quit` | App.tsx:607-610 | ✅ Verified |
| `/q` | App.tsx:607-610 | ✅ Verified |
| `/clear` | App.tsx:613-617 | ✅ Verified |
| `/help` or `/h` or `/?` | App.tsx:620-624 | ✅ Verified |

### 5. Session Command Sub-Router

The `/session` command delegates to a dedicated handler module:

**Location**: `packages/cli/src/handlers/session-handlers.ts`

| Subcommand | Handler Function | Status |
|------------|-----------------|--------|
| `/session list` | `handleSessionList()` | ✅ Verified |
| `/session load` | `handleSessionLoad()` | ✅ Verified |
| `/session save` | `handleSessionSave()` | ✅ Verified |
| `/session branch` | `handleSessionBranch()` | ✅ Verified |
| `/session export` | `handleSessionExport()` | ✅ Verified |
| `/session delete` | `handleSessionDelete()` | ✅ Verified |
| `/session info` | `handleSessionInfo()` | ✅ Verified |

### 6. Command Flow Diagram

```
User Input → InputPrompt.onSubmit
                    │
                    ▼
            App.handleInput()
                    │
        ┌───────────┴───────────┐
        │ Starts with '/'?      │
        └───────────┬───────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
    No  │       Yes │           │
        ▼           ▼           │
   onTask()    Parse command    │
                    │           │
        ┌───────────┴───────────┐
        │ Is UI command?        │
        │ (exit/quit/clear/help)│
        └───────────┬───────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
    Yes │        No │           │
        ▼           ▼           │
  Handle locally   onCommand()  │
                    │           │
                    ▼           │
              handleCommand()   │
              (repl.tsx)        │
                    │           │
                    ▼           │
        Specific handler function
```

### 7. Architectural Strengths

1. **Clean Separation of Concerns**
   - UI-level commands (exit, clear, help) handled in App.tsx
   - Business logic commands handled in repl.tsx handlers
   - Session commands extracted to dedicated handler module

2. **Consistent Pattern**
   - All handlers follow async function signature
   - Error messages use ctx.app?.addMessage pattern
   - State updates use ctx.app?.updateState pattern

3. **Command Aliases**
   - `/status` and `/s` - both work
   - `/logs` and `/log` - both work
   - `/preview` and `/p` - both work
   - Exit commands: `/exit`, `/quit`, `/q`
   - Help commands: `/help`, `/h`, `/?`

4. **Default Handler**
   - Unknown commands get clear error message
   - Redirects to `/help` for guidance

### 8. Verification Summary

All 16+ slash commands specified in acceptance criteria verified working:

| Command | Router Case | Handler | Status |
|---------|-------------|---------|--------|
| `/init` | ✅ case 'init' | ✅ handleInit | **WORKING** |
| `/status` | ✅ case 'status'/'s' | ✅ handleStatus | **WORKING** |
| `/agents` | ✅ case 'agents' | ✅ handleAgents | **WORKING** |
| `/workflows` | ✅ case 'workflows' | ✅ handleWorkflows | **WORKING** |
| `/config` | ✅ case 'config' | ✅ handleConfig | **WORKING** |
| `/serve` | ✅ case 'serve' | ✅ handleServe | **WORKING** |
| `/web` | ✅ case 'web' | ✅ handleWeb | **WORKING** |
| `/stop` | ✅ case 'stop' | ✅ handleStop | **WORKING** |
| `/cancel` | ✅ case 'cancel' | ✅ handleCancel | **WORKING** |
| `/retry` | ✅ case 'retry' | ✅ handleRetry | **WORKING** |
| `/resume` | ✅ case 'resume' | ✅ handleResume | **WORKING** |
| `/logs` | ✅ case 'logs'/'log' | ✅ handleLogs | **WORKING** |
| `/session` | ✅ case 'session' | ✅ handleSession | **WORKING** |
| `/compact` | ✅ case 'compact' | ✅ handleCompact | **WORKING** |
| `/verbose` | ✅ case 'verbose' | ✅ handleVerbose | **WORKING** |
| `/preview` | ✅ case 'preview'/'p' | ✅ handlePreview | **WORKING** |
| `/thoughts` | ✅ case 'thoughts' | ✅ handleThoughts | **WORKING** |

## Consequences

### Positive
- Clean, maintainable command routing architecture
- Easy to add new commands (single switch case + handler function)
- Good separation between UI and business logic
- Session commands properly extracted to dedicated module

### Potential Improvements (for future consideration)
1. Consider a command registry pattern for dynamic command registration
2. Could add command metadata (help text, aliases) to a centralized registry
3. Might benefit from command validation middleware

## References
- Main REPL: `packages/cli/src/repl.tsx`
- App UI: `packages/cli/src/ui/App.tsx`
- Session Handlers: `packages/cli/src/handlers/session-handlers.ts`
- UI Index: `packages/cli/src/ui/index.tsx`
