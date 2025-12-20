# ADR-050: Session Management Documentation Architecture

## Status

Proposed

## Context

The v0.3.0 roadmap includes comprehensive session management features that are now fully implemented:

1. **Session persistence** - Resume previous sessions
2. **Session export** - Export to markdown/JSON/HTML formats
3. **Session branching** - Create branches from any point
4. **Named sessions** - Save and load named sessions
5. **Session search** - Search across session history
6. **Auto-save** - Automatic session persistence with interval + threshold triggers
7. **Session commands** - All REPL commands for session management

The current CLI Guide (`docs/cli-guide.md`) documents these features but requires enhancement to:
- Provide detailed command examples for all 7 session features
- Document export formats with output samples
- Explain branching workflows with visual diagrams
- Cover auto-save configuration options
- Include troubleshooting guidance

## Decision

### 1. Documentation Structure Enhancement

The Session Management section in `docs/cli-guide.md` will be reorganized into the following structure:

```
## Session Management
### Overview
### The 7 Session Features
  1. Session Persistence
  2. Session Export Formats
  3. Session Branching
  4. Named Sessions
  5. Session Search
  6. Auto-Save
  7. Session Commands Reference
### Session Workflows
### Configuration
### Troubleshooting
```

### 2. Feature Documentation Template

Each of the 7 session features will be documented with:

```markdown
#### Feature Name

**Description**: Brief explanation of the feature

**Commands**:
| Command | Description | Example |
|---------|-------------|---------|
| ... | ... | ... |

**Examples**:
```bash
# Example 1: Basic usage
/session <command>

# Example 2: Advanced usage
/session <command> --option value
```

**Output**: (if applicable)
```
Sample output format
```

**Configuration**: (if applicable)
```yaml
# .apex/config.yaml settings
```

**Tips**: Best practices and common patterns
```

### 3. Technical Design for Each Feature

#### 3.1 Session Persistence

**Implementation**: `SessionStore.ts`, `SessionAutoSaver.ts`

**Documentation Requirements**:
- Explain session storage location (`.apex/sessions/`)
- Document session resume on APEX restart
- Cover crash recovery behavior
- Show session lifecycle diagram

**Command Examples**:
```bash
# Session is automatically persisted
apex> # Work normally, session auto-saves

# Resume last session on restart
$ apex
Resuming session: sess_1703123456789_abc123def...

# Start fresh session
$ apex --new-session
```

#### 3.2 Session Export Formats

**Implementation**: `SessionStore.exportSession()`, `session-handlers.ts`

**Documentation Requirements**:
- Document all 3 export formats: `md`, `json`, `html`
- Show sample output for each format
- Explain use cases for each format
- Cover file output vs. preview modes

**Command Examples**:
```bash
# Export to markdown (default)
/session export
/session export --format md

# Export to JSON for programmatic use
/session export --format json --output session.json

# Export to HTML for sharing
/session export --format html --output report.html
```

**Sample Outputs**:

Markdown format:
```markdown
# APEX Session: My Feature Work

**Created:** 2024-12-15T10:30:00.000Z
**Last Updated:** 2024-12-15T12:45:00.000Z
**Total Messages:** 45
**Total Cost:** $1.2345

---

### **User**

Add a health check endpoint to the API

### **Assistant (planner)**

I'll analyze your codebase and create a plan...
```

JSON format:
```json
{
  "id": "sess_1703123456789_abc123def",
  "name": "My Feature Work",
  "messages": [...],
  "state": {
    "totalTokens": { "input": 45000, "output": 12000 },
    "totalCost": 1.2345
  }
}
```

HTML format:
```html
<!DOCTYPE html>
<html>
<head><title>APEX Session: My Feature Work</title></head>
<body>
  <h1>APEX Session: My Feature Work</h1>
  <div class="message user">...</div>
  <div class="message assistant">...</div>
</body>
</html>
```

#### 3.3 Session Branching

**Implementation**: `SessionStore.branchSession()`

**Documentation Requirements**:
- Explain branching concept and use cases
- Document parent-child session relationships
- Show branch visualization
- Cover branch switching workflow

**Command Examples**:
```bash
# Create branch from current point
/session branch "Alternative Approach"

# Create branch from specific message
/session branch "Try Redux" --from 15

# View branch relationships in session info
/session info
```

**Visual Diagram** (to include in docs):
```
Session: "Main Development"
├── Message 1: User request
├── Message 2: AI response
├── Message 3: User follow-up
├── Message 4: AI response ◄─── Branch point (--from 4)
│   └── Branch: "Alternative Approach"
│       ├── Message 5 (branch): Different direction
│       └── Message 6 (branch): Continued exploration
├── Message 5: Original continuation
└── Message 6: Original completion
```

#### 3.4 Named Sessions

**Implementation**: `SessionAutoSaver.updateSessionInfo()`, `session-handlers.ts`

**Documentation Requirements**:
- Explain named session benefits
- Document naming conventions
- Cover tag system for organization
- Show session listing with names

**Command Examples**:
```bash
# Save current session with a name
/session save "Auth Implementation"

# Save with tags for organization
/session save "Sprint 5 Work" --tags sprint5,auth,backend

# List sessions (shows names)
/session list

# Load by name or ID
/session load "Auth Implementation"
/session load sess_1703123456789_abc123def
```

#### 3.5 Session Search

**Implementation**: `SessionStore.listSessions()` with search parameter

**Documentation Requirements**:
- Explain search capabilities
- Document search by name, ID, tags
- Cover filtering options
- Show search result format

**Command Examples**:
```bash
# Search by name
/session list --search "auth"

# Include archived sessions
/session list --all --search "feature"

# Filter by specific criteria
/session list --all
```

#### 3.6 Auto-Save

**Implementation**: `SessionAutoSaver` class

**Documentation Requirements**:
- Explain auto-save triggers (interval + message threshold)
- Document configuration options
- Cover manual save override
- Show unsaved changes indicator

**Configuration**:
```yaml
# .apex/config.yaml
session:
  autoSave:
    enabled: true
    intervalMs: 30000        # Save every 30 seconds
    maxUnsavedMessages: 5    # Save after 5 unsaved messages
```

**Command Examples**:
```bash
# Force immediate save
/session save "My Work"

# Check unsaved changes in session info
/session info
# Shows: Unsaved changes: 3

# Auto-save callback notification (in verbose mode)
# [Session auto-saved: 5 messages]
```

#### 3.7 Session Commands Reference

**Documentation Requirements**:
- Complete command reference table
- All subcommands with options
- Cross-references to detailed sections

**Quick Reference Table**:

| Command | Description | Options |
|---------|-------------|---------|
| `/session list` | List available sessions | `--all`, `--search <query>` |
| `/session load <id>` | Load a session | - |
| `/session save <name>` | Save current session | `--tags <tag1,tag2>` |
| `/session branch [name]` | Create a branch | `--from <message_index>` |
| `/session export` | Export session | `--format md\|json\|html`, `--output <file>` |
| `/session delete <id>` | Delete a session | - |
| `/session info` | Show current session info | - |

### 4. Session Workflows Section

Document common workflow patterns:

**Workflow 1: Long-Running Feature Development**
```bash
# Start work
apex> Add authentication to the API

# Save progress periodically
/session save "Auth Feature - Day 1"

# End of day - session auto-saves

# Next day - resume
$ apex
# Automatically resumes last session

# Continue work
apex> Now add password reset functionality
```

**Workflow 2: Exploring Alternatives**
```bash
# Working on a feature
apex> Implement caching layer

# AI suggests approach A
# You want to try approach B as well

/session branch "Try Redis Approach"
apex> Let's try using Redis instead

# If Redis approach works better, continue
# If not, load original session
/session load <original-session-id>
```

**Workflow 3: Documentation and Sharing**
```bash
# Complete a complex task
apex> Refactor the payment module

# Export for team documentation
/session export --format html --output payment-refactor-session.html

# Export for AI training/analysis
/session export --format json --output session-data.json
```

### 5. Keyboard Shortcuts Integration

Document session-related keyboard shortcuts:

| Shortcut | Description |
|----------|-------------|
| `Ctrl+S` | Quick save session (triggers immediate save) |
| `Ctrl+Shift+I` | Show session info |
| `Ctrl+Shift+L` | List sessions |

### 6. Troubleshooting Section

Document common issues:

| Issue | Solution |
|-------|----------|
| "No active session" | Run `/session info` or restart APEX |
| Session not found | Check ID with `/session list --all` |
| Export fails | Ensure output path is writable |
| Auto-save not working | Check config: `session.autoSave.enabled: true` |
| Branch index out of range | Use `/session info` to check message count |

## Consequences

### Positive

- Users will have comprehensive documentation for all 7 session features
- Command examples provide copy-paste ready usage
- Workflow documentation helps users adopt best practices
- Troubleshooting section reduces support burden

### Negative

- Increased documentation length may overwhelm new users
- Need to maintain synchronization with code changes

### Risks

- Documentation may become stale if features change
- Complex workflows may still require user experimentation

## Implementation Notes

1. **Phase 1**: Enhance Session Management section in `docs/cli-guide.md` with all 7 features
2. **Phase 2**: Add visual diagrams for branching and workflow examples
3. **Phase 3**: Create cross-references to related documentation

### Files to Modify

| File | Changes |
|------|---------|
| `docs/cli-guide.md` | Enhance Session Management section with all 7 features |

### Acceptance Criteria

1. Session Management section documents all 7 session features
2. Each feature includes command examples
3. Export formats include sample output
4. Branching workflow includes visual diagram
5. Auto-save configuration is documented
6. Keyboard shortcuts are listed
7. Troubleshooting section covers common issues

## Related Documents

- ADR-003: Session Management for v0.3.0 (original architecture)
- `packages/cli/src/services/SessionStore.ts` - Implementation reference
- `packages/cli/src/services/SessionAutoSaver.ts` - Auto-save implementation
- `packages/cli/src/handlers/session-handlers.ts` - Command handlers

## Appendix: Implementation Reference

### SessionStore API

```typescript
interface SessionStore {
  // Core CRUD
  createSession(name?: string): Promise<Session>;
  getSession(id: string): Promise<Session | null>;
  updateSession(id: string, updates: Partial<Session>): Promise<void>;
  deleteSession(id: string): Promise<void>;

  // Query
  listSessions(options?: ListOptions): Promise<SessionSummary[]>;

  // Branching
  branchSession(id: string, fromIndex: number, name?: string): Promise<Session>;

  // Export
  exportSession(id: string, format: 'md' | 'json' | 'html'): Promise<string>;

  // Archive
  archiveSession(id: string): Promise<void>;

  // Active session
  getActiveSessionId(): Promise<string | null>;
  setActiveSession(id: string): Promise<void>;
}
```

### SessionAutoSaver API

```typescript
interface SessionAutoSaver {
  // Lifecycle
  start(sessionId?: string): Promise<Session>;
  stop(): Promise<void>;

  // Message management
  addMessage(message: Omit<SessionMessage, 'id' | 'index' | 'timestamp'>): Promise<void>;

  // State management
  updateState(updates: Partial<SessionState>): Promise<void>;
  updateSessionInfo(updates: Partial<Pick<Session, 'name' | 'tags'>>): Promise<void>;

  // Save operations
  save(): Promise<void>;

  // Queries
  getSession(): Session | null;
  hasUnsavedChanges(): boolean;
  getUnsavedChangesCount(): number;

  // Configuration
  updateOptions(options: Partial<AutoSaveOptions>): void;
  onAutoSave(callback: (session: Session) => void): void;
}
```
