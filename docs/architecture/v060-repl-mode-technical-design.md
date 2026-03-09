# APEX v0.6.0 Interactive REPL Mode - Technical Design

## Executive Summary

This document provides the architectural design and verification for the Interactive REPL mode in APEX v0.6.0. The implementation successfully meets all acceptance criteria with a well-structured, maintainable architecture following SOLID principles.

## Architecture Overview

### High-Level Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          REPL Entry Point                              │
│                       (packages/cli/src/repl.tsx)                      │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                      startInkREPL()                             │  │
│  │  - Context initialization                                        │  │
│  │  - Orchestrator event binding                                    │  │
│  │  - Process signal handling                                       │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                   │
│                                    ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                     Command Routing Layer                       │   │
│  │                        handleCommand()                          │   │
│  │                                                                 │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │  Task    │ │ Display  │ │ Session  │ │  Config  │          │   │
│  │  │ Commands │ │ Commands │ │ Commands │ │ Commands │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                    │                                   │
│                                    ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                      Task Execution Layer                       │   │
│  │                         executeTask()                           │   │
│  │  - Natural language processing                                  │   │
│  │  - Orchestrator integration                                     │   │
│  │  - Session tracking                                             │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            Ink UI Layer                                │
│                     (packages/cli/src/ui/index.tsx)                    │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                        startInkApp()                            │  │
│  │  - React Ink rendering                                           │  │
│  │  - State management                                              │  │
│  │  - Message handling                                              │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                   │
│                                    ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                         App Component                            │  │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐      │  │
│  │  │ StatusBar │ │ Messages  │ │ Previews  │ │InputPrompt│      │  │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘      │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Services Layer                                │
│                   (packages/cli/src/services/)                         │
│                                                                        │
│  ┌───────────────┐  ┌───────────────────┐  ┌─────────────────────┐   │
│  │ SessionStore  │  │ SessionAutoSaver  │  │ConversationManager │   │
│  │               │  │                   │  │                     │   │
│  │ - Persistence │  │ - Auto-backup     │  │ - Context tracking  │   │
│  │ - Indexing    │  │ - State tracking  │  │ - Intent detection  │   │
│  │ - Branching   │  │ - Timer management│  │ - Clarification     │   │
│  └───────────────┘  └───────────────────┘  └─────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. startInkREPL() - Main Entry Point

**Location**: `packages/cli/src/repl.tsx:1471-1984`

**Responsibilities**:
- Initialize APEX context (cwd, config, orchestrator)
- Set up orchestrator event listeners
- Initialize session management services
- Start the Ink terminal UI
- Handle process signals (SIGINT, SIGTERM)
- Clean up resources on exit

**Interface**:
```typescript
export async function startInkREPL(): Promise<void>
```

**Context Structure**:
```typescript
interface ApexContext {
  cwd: string;
  initialized: boolean;
  config: ApexConfig | null;
  orchestrator: ApexOrchestrator | null;
  apiProcess: ChildProcess | null;
  webUIProcess: ChildProcess | null;
  apiPort: number | undefined;
  webUIPort: number | undefined;
  app: InkAppInstance | null;
  sessionStore: SessionStore | null;
  sessionAutoSaver: SessionAutoSaver | null;
  conversationManager: ConversationManager | null;
}
```

### 2. handleCommand() - Command Routing

**Location**: `packages/cli/src/repl.tsx:1329-1394`

**Command Categories**:

| Category | Commands | Description |
|----------|----------|-------------|
| Task Management | status/s, cancel, retry, resume, logs/log | Task lifecycle control |
| Display Modes | compact, verbose, preview/p, thoughts | UI rendering options |
| Configuration | config, browser, agents, workflows | System configuration |
| Session | session (list, load, save, branch, export, delete, info) | Session management |
| Services | serve, web, stop | Background services |

**Command Aliases**:
- `s` → `status`
- `p` → `preview`
- `log` → `logs`

### 3. executeTask() - Natural Language Task Execution

**Location**: `packages/cli/src/repl.tsx:853-982`

**Flow**:
1. Track input in ConversationManager
2. Track input in SessionAutoSaver
3. Create task via orchestrator
4. Update UI state with task info
5. Execute task asynchronously
6. Track completion/failure in session

**Integration Points**:
- `conversationManager.addMessage()` - Context tracking
- `sessionAutoSaver.addInputToHistory()` - Input history
- `orchestrator.createTask()` - Task creation
- `orchestrator.executeTask()` - Task execution

### 4. Session Store - Persistence Layer

**Location**: `packages/cli/src/services/SessionStore.ts`

**Data Model**:
```typescript
interface Session {
  id: string;
  name?: string;
  projectPath: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  messages: SessionMessage[];
  inputHistory: string[];
  state: SessionState;
  parentSessionId?: string;
  branchPoint?: number;
  childSessionIds: string[];
  tags: string[];
}
```

**Key Features**:
- File-based persistence (JSON)
- Session indexing for fast lookups
- Branching support for conversation trees
- Export formats: Markdown, JSON, HTML
- Archive with compression (gzip)

### 5. Session Auto-Saver

**Location**: `packages/cli/src/services/SessionAutoSaver.ts`

**Configuration**:
```typescript
interface AutoSaveOptions {
  enabled: boolean;        // Default: true
  intervalMs: number;      // Default: 30000 (30s)
  maxUnsavedMessages: number; // Default: 5
}
```

**Behavior**:
- Periodic saves based on interval
- Immediate save when unsaved count threshold reached
- Graceful save on stop/exit

### 6. Conversation Manager

**Location**: `packages/cli/src/services/ConversationManager.ts`

**Features**:
- Message context tracking
- Intent detection (command, task, question, clarification)
- Context pruning (max messages, token limits)
- Smart suggestions based on context
- Clarification request handling

## Event-Driven Architecture

### Orchestrator Events

The REPL subscribes to 14 orchestrator events for real-time updates:

| Event | Handler Behavior |
|-------|------------------|
| `task:started` | Reset subtask progress, initialize verbose data |
| `task:completed` | Clear progress, update state |
| `task:failed` | Track errors, clear state |
| `task:paused` | Display pause reason, clear current task |
| `subtask:created` | Increment total count |
| `subtask:completed` | Increment completed count |
| `agent:message` | Stream text content to UI |
| `agent:thinking` | Display thinking content |
| `agent:tool-use` | Display tool usage info |
| `usage:updated` | Update token/cost display |
| `task:stage-changed` | Track agent handoff |
| `stage:parallel-started` | Show parallel execution panel |
| `stage:parallel-completed` | Hide parallel panel |
| `approval:required` | Show interactive approval prompt |

## Design Patterns

### 1. Single Responsibility Principle (SRP)
- `SessionStore` handles only persistence
- `SessionAutoSaver` handles only auto-saving logic
- `ConversationManager` handles only conversation context
- Command handlers are separated by domain

### 2. Dependency Injection
- Services injected via context
- Orchestrator injected into REPL
- Config injected into UI components

### 3. Event-Driven Architecture
- Loose coupling between REPL and orchestrator
- Real-time updates without polling
- Extensible for new event types

### 4. Command Pattern
- Commands encapsulated as handler functions
- Uniform interface for all commands
- Easy to add new commands

## Cross-Platform Compatibility

Implemented cross-platform support for:
- Shell command execution via `getPlatformShell()`
- Process detection via `getProcessesOnPort()`
- Process termination via `killProcessOnPort()`

See ADR: `docs/adr/cli-ADR-repl-cross-platform-shell.md`

## Test Coverage

### Unit Tests
- **repl-command-routing-audit.test.ts**: 28 tests - Command routing verification
- **repl-task-execution-audit.test.ts**: 17 tests - Task execution flow
- **repl-session-integration-audit.test.ts**: 21 tests - Session management

### Comprehensive Audit
- **v060-repl-mode-comprehensive-audit.test.ts**: 41 tests - Full implementation verification

### Test Categories
1. Core implementation verification
2. Ink UI integration
3. Command routing (all 18+ commands)
4. Task execution flow
5. Session store operations
6. Event handling
7. Error handling and edge cases

## Performance Considerations

### Memory Management
- Event listener cleanup on exit
- Context pruning for conversation history
- Session auto-archiving for old sessions

### Real-Time Updates
- Efficient event streaming
- Throttled state updates
- Lazy loading of session data

### Process Management
- Detached background processes
- Proper cleanup on exit
- Fallback port-based process detection

## Security Considerations

1. **Session Data**: Stored locally in `.apex/sessions/`
2. **No Remote Transmission**: All session data stays local
3. **Process Isolation**: Background services run as detached processes
4. **Input Sanitization**: Command arguments properly parsed

## Acceptance Criteria Verification

| Criteria | Status | Evidence |
|----------|--------|----------|
| REPL mode verified functional via repl.tsx startInkREPL() | ✅ | Function exported at line 1471, initializes context and UI |
| Command routing via handleCommand() | ✅ | Function at line 1329, handles 18+ commands with aliases |
| Task execution via executeTask() | ✅ | Function at line 853, integrates with orchestrator |
| Session store integration | ✅ | SessionStore, SessionAutoSaver, ConversationManager integrated |

## Files Modified/Verified

- `packages/cli/src/repl.tsx` - Main REPL implementation
- `packages/cli/src/ui/index.tsx` - Ink app initialization
- `packages/cli/src/services/SessionStore.ts` - Session persistence
- `packages/cli/src/services/SessionAutoSaver.ts` - Auto-save service
- `packages/cli/src/services/ConversationManager.ts` - Conversation context
- `packages/cli/src/handlers/session-handlers.ts` - Session command handlers

## Conclusion

The Interactive REPL mode implementation demonstrates:
- Clean separation of concerns
- Event-driven architecture for real-time updates
- Comprehensive session management
- Cross-platform compatibility
- Robust error handling
- Extensive test coverage

**Architecture Status: VERIFIED ✅**
