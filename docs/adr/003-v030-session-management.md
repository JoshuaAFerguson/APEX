# ADR-003: Session Management for v0.3.0

## Status
Proposed

## Context
The v0.3.0 roadmap includes comprehensive session management features:
- Session persistence - Resume previous sessions
- Session export - Export conversation to markdown
- Session branching - Create branches from any point
- Named sessions - Save and load named sessions
- Session search - Search across session history

Currently, APEX CLI sessions are ephemeral - all conversation history is lost when the REPL exits.

## Decision

### 1. Session Data Model

```typescript
interface Session {
  // Identity
  id: string;                    // Unique session ID (uuid)
  name?: string;                 // User-assigned name
  projectPath: string;           // Project this session belongs to

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;

  // Conversation data
  messages: SessionMessage[];
  inputHistory: string[];        // Command/input history

  // State snapshot
  state: SessionState;

  // Branching
  parentSessionId?: string;      // If branched from another session
  branchPoint?: number;          // Message index where branch occurred
  childSessionIds?: string[];    // Sessions branched from this one

  // Metadata
  tags?: string[];
  description?: string;
}

interface SessionMessage {
  id: string;
  index: number;                 // Position in session
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;

  // Rich content
  codeBlocks?: CodeBlock[];
  toolCalls?: ToolCallRecord[];

  // Metadata
  agent?: string;
  stage?: string;
  taskId?: string;
  tokens?: { input: number; output: number };
  metadata?: Record<string, unknown>;
}

interface SessionState {
  // Usage tracking
  totalTokens: { input: number; output: number };
  totalCost: number;

  // Task tracking
  tasksCreated: string[];
  tasksCompleted: string[];
  currentTaskId?: string;

  // Context
  lastGitBranch?: string;
  workingDirectory?: string;
}

interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
}

interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  output?: string;
  duration?: number;
  status: 'success' | 'error';
}
```

### 2. Storage Architecture

```
.apex/
├── sessions/
│   ├── index.json           # Session index for quick lookup
│   ├── active.json          # Currently active session reference
│   ├── {session-id}.json    # Individual session files
│   └── archive/             # Compressed old sessions
│       └── {session-id}.json.gz
```

```typescript
// Session index for fast lookup
interface SessionIndex {
  version: number;
  sessions: SessionIndexEntry[];
  lastUpdated: Date;
}

interface SessionIndexEntry {
  id: string;
  name?: string;
  projectPath: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  messageCount: number;
  totalCost: number;
  tags?: string[];
  archived: boolean;
}
```

### 3. Session Store Implementation

```typescript
interface SessionStore {
  // CRUD operations
  createSession(projectPath: string, options?: CreateSessionOptions): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  updateSession(sessionId: string, updates: Partial<Session>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  // Query operations
  listSessions(options?: ListSessionsOptions): Promise<SessionIndexEntry[]>;
  searchSessions(query: string): Promise<SessionIndexEntry[]>;

  // Active session
  getActiveSession(projectPath: string): Promise<Session | null>;
  setActiveSession(projectPath: string, sessionId: string): Promise<void>;

  // Branching
  branchSession(sessionId: string, branchPoint: number, name?: string): Promise<Session>;

  // Export
  exportSession(sessionId: string, format: ExportFormat): Promise<string>;

  // Archival
  archiveSession(sessionId: string): Promise<void>;
  unarchiveSession(sessionId: string): Promise<void>;
}

interface CreateSessionOptions {
  name?: string;
  description?: string;
  tags?: string[];
  parentSessionId?: string;
}

interface ListSessionsOptions {
  projectPath?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'lastAccessedAt' | 'name';
  order?: 'asc' | 'desc';
  includeArchived?: boolean;
  tags?: string[];
}

type ExportFormat = 'markdown' | 'json' | 'html';
```

### 4. Session Manager Implementation

```typescript
class SessionManager implements SessionStore {
  private sessionsDir: string;
  private indexPath: string;
  private activePath: string;
  private index: SessionIndex;

  constructor(projectPath: string) {
    this.sessionsDir = path.join(projectPath, '.apex', 'sessions');
    this.indexPath = path.join(this.sessionsDir, 'index.json');
    this.activePath = path.join(this.sessionsDir, 'active.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    await fs.mkdir(path.join(this.sessionsDir, 'archive'), { recursive: true });

    try {
      this.index = JSON.parse(await fs.readFile(this.indexPath, 'utf-8'));
    } catch {
      this.index = { version: 1, sessions: [], lastUpdated: new Date() };
      await this.saveIndex();
    }
  }

  async createSession(
    projectPath: string,
    options: CreateSessionOptions = {}
  ): Promise<Session> {
    const session: Session = {
      id: generateUUID(),
      name: options.name,
      projectPath,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
      messages: [],
      inputHistory: [],
      state: {
        totalTokens: { input: 0, output: 0 },
        totalCost: 0,
        tasksCreated: [],
        tasksCompleted: [],
      },
      parentSessionId: options.parentSessionId,
      tags: options.tags,
      description: options.description,
    };

    await this.saveSession(session);
    await this.addToIndex(session);

    return session;
  }

  async addMessage(sessionId: string, message: Omit<SessionMessage, 'id' | 'index' | 'timestamp'>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const newMessage: SessionMessage = {
      ...message,
      id: generateUUID(),
      index: session.messages.length,
      timestamp: new Date(),
    };

    session.messages.push(newMessage);
    session.updatedAt = new Date();

    // Update token counts if present
    if (message.tokens) {
      session.state.totalTokens.input += message.tokens.input;
      session.state.totalTokens.output += message.tokens.output;
    }

    await this.saveSession(session);
    await this.updateIndexEntry(session);
  }

  async branchSession(
    sessionId: string,
    branchPoint: number,
    name?: string
  ): Promise<Session> {
    const parent = await this.getSession(sessionId);
    if (!parent) throw new Error(`Session not found: ${sessionId}`);

    if (branchPoint < 0 || branchPoint >= parent.messages.length) {
      throw new Error(`Invalid branch point: ${branchPoint}`);
    }

    // Create new session with messages up to branch point
    const branch: Session = {
      id: generateUUID(),
      name: name || `${parent.name || 'Session'} (branch)`,
      projectPath: parent.projectPath,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
      messages: parent.messages.slice(0, branchPoint + 1).map((m, i) => ({
        ...m,
        id: generateUUID(),
        index: i,
      })),
      inputHistory: parent.inputHistory.slice(),
      state: this.recalculateState(parent.messages.slice(0, branchPoint + 1)),
      parentSessionId: sessionId,
      branchPoint,
      tags: parent.tags,
    };

    // Update parent with child reference
    parent.childSessionIds = parent.childSessionIds || [];
    parent.childSessionIds.push(branch.id);

    await this.saveSession(branch);
    await this.saveSession(parent);
    await this.addToIndex(branch);

    return branch;
  }

  async exportSession(sessionId: string, format: ExportFormat): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    switch (format) {
      case 'markdown':
        return this.exportAsMarkdown(session);
      case 'json':
        return JSON.stringify(session, null, 2);
      case 'html':
        return this.exportAsHTML(session);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private exportAsMarkdown(session: Session): string {
    const lines: string[] = [
      `# Session: ${session.name || session.id}`,
      '',
      `**Project:** ${session.projectPath}`,
      `**Created:** ${session.createdAt.toISOString()}`,
      `**Messages:** ${session.messages.length}`,
      `**Total Cost:** $${session.state.totalCost.toFixed(4)}`,
      '',
      '---',
      '',
    ];

    for (const msg of session.messages) {
      const roleIcon = {
        user: '👤',
        assistant: '🤖',
        system: '⚙️',
        tool: '🔧',
      }[msg.role];

      lines.push(`## ${roleIcon} ${msg.role.toUpperCase()}`);
      if (msg.agent) lines.push(`*Agent: ${msg.agent}*`);
      lines.push(`*${msg.timestamp.toISOString()}*`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');

      if (msg.codeBlocks) {
        for (const block of msg.codeBlocks) {
          if (block.filename) lines.push(`**${block.filename}**`);
          lines.push('```' + block.language);
          lines.push(block.code);
          lines.push('```');
          lines.push('');
        }
      }

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  private exportAsHTML(session: Session): string {
    // Generate HTML export with styling
    return `<!DOCTYPE html>
<html>
<head>
  <title>Session: ${session.name || session.id}</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 20px; }
    .message { margin: 20px 0; padding: 15px; border-radius: 8px; }
    .user { background: #e3f2fd; }
    .assistant { background: #f5f5f5; }
    .system { background: #fff3e0; }
    .tool { background: #e8f5e9; }
    pre { background: #263238; color: #eee; padding: 15px; border-radius: 4px; overflow-x: auto; }
    code { font-family: 'Fira Code', monospace; }
  </style>
</head>
<body>
  <h1>Session: ${session.name || session.id}</h1>
  <p><strong>Project:</strong> ${session.projectPath}</p>
  <p><strong>Created:</strong> ${session.createdAt.toISOString()}</p>
  <hr>
  ${session.messages.map(m => `
    <div class="message ${m.role}">
      <strong>${m.role.toUpperCase()}</strong>
      ${m.agent ? `<em>(${m.agent})</em>` : ''}
      <small>${m.timestamp.toISOString()}</small>
      <div>${this.escapeHtml(m.content).replace(/\n/g, '<br>')}</div>
    </div>
  `).join('')}
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async searchSessions(query: string): Promise<SessionIndexEntry[]> {
    const results: SessionIndexEntry[] = [];
    const queryLower = query.toLowerCase();

    for (const entry of this.index.sessions) {
      // Search in name and tags
      if (entry.name?.toLowerCase().includes(queryLower)) {
        results.push(entry);
        continue;
      }
      if (entry.tags?.some(t => t.toLowerCase().includes(queryLower))) {
        results.push(entry);
        continue;
      }

      // Search in message content (load session)
      const session = await this.getSession(entry.id);
      if (session?.messages.some(m => m.content.toLowerCase().includes(queryLower))) {
        results.push(entry);
      }
    }

    return results;
  }

  private recalculateState(messages: SessionMessage[]): SessionState {
    const state: SessionState = {
      totalTokens: { input: 0, output: 0 },
      totalCost: 0,
      tasksCreated: [],
      tasksCompleted: [],
    };

    for (const msg of messages) {
      if (msg.tokens) {
        state.totalTokens.input += msg.tokens.input;
        state.totalTokens.output += msg.tokens.output;
      }
      if (msg.taskId && !state.tasksCreated.includes(msg.taskId)) {
        state.tasksCreated.push(msg.taskId);
      }
    }

    // Recalculate cost based on tokens
    state.totalCost = calculateCost(state.totalTokens.input, state.totalTokens.output);

    return state;
  }

  // ... other methods
}
```

### 5. CLI Commands for Session Management

```typescript
const sessionCommands = [
  {
    name: 'session',
    aliases: ['ses'],
    description: 'Session management commands',
    usage: '/session [list|load|save|branch|export|delete]',
    subcommands: {
      list: {
        description: 'List all sessions',
        usage: '/session list [--all] [--search <query>]',
        handler: handleSessionList,
      },
      load: {
        description: 'Load a previous session',
        usage: '/session load <session-id|name>',
        handler: handleSessionLoad,
      },
      save: {
        description: 'Save current session with a name',
        usage: '/session save <name> [--description <desc>] [--tags <tag1,tag2>]',
        handler: handleSessionSave,
      },
      branch: {
        description: 'Create a branch from current point',
        usage: '/session branch [<name>] [--from <message-index>]',
        handler: handleSessionBranch,
      },
      export: {
        description: 'Export session to file',
        usage: '/session export [<session-id>] [--format md|json|html] [--output <file>]',
        handler: handleSessionExport,
      },
      delete: {
        description: 'Delete a session',
        usage: '/session delete <session-id>',
        handler: handleSessionDelete,
      },
      info: {
        description: 'Show current session info',
        usage: '/session info',
        handler: handleSessionInfo,
      },
    },
  },
];
```

### 6. Auto-save and Recovery

```typescript
interface AutoSaveConfig {
  enabled: boolean;
  intervalMs: number;        // Auto-save interval (default: 30000)
  maxUnsavedMessages: number; // Force save after N messages
}

class SessionAutoSaver {
  private saveTimer: NodeJS.Timeout | null = null;
  private unsavedCount = 0;
  private config: AutoSaveConfig;

  constructor(
    private sessionManager: SessionManager,
    private currentSessionId: string,
    config: Partial<AutoSaveConfig> = {}
  ) {
    this.config = {
      enabled: true,
      intervalMs: 30000,
      maxUnsavedMessages: 10,
      ...config,
    };
  }

  start(): void {
    if (!this.config.enabled) return;

    this.saveTimer = setInterval(() => {
      this.save();
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  }

  markDirty(): void {
    this.unsavedCount++;
    if (this.unsavedCount >= this.config.maxUnsavedMessages) {
      this.save();
    }
  }

  async save(): Promise<void> {
    if (this.unsavedCount === 0) return;

    try {
      // Session is saved as messages are added, but we update the index
      await this.sessionManager.updateIndexEntry(
        await this.sessionManager.getSession(this.currentSessionId)
      );
      this.unsavedCount = 0;
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }

  // Crash recovery: check for incomplete sessions on startup
  static async recoverIncompleteSessions(
    sessionManager: SessionManager,
    projectPath: string
  ): Promise<Session | null> {
    const active = await sessionManager.getActiveSession(projectPath);
    if (active && active.messages.length > 0) {
      // Check if last message was recent (within 1 hour)
      const lastMessage = active.messages[active.messages.length - 1];
      const hourAgo = Date.now() - 60 * 60 * 1000;

      if (new Date(lastMessage.timestamp).getTime() > hourAgo) {
        return active; // Return for potential resume
      }
    }
    return null;
  }
}
```

### 7. Session UI Components

```typescript
// Session list view
interface SessionListProps {
  sessions: SessionIndexEntry[];
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  selectedId?: string;
}

function SessionList({ sessions, onSelect, onDelete, selectedId }: SessionListProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      <Text bold color="cyan">Sessions</Text>
      <Box marginTop={1} flexDirection="column">
        {sessions.map(session => (
          <Box key={session.id}>
            <Text
              color={session.id === selectedId ? 'cyan' : 'white'}
              bold={session.id === selectedId}
            >
              {session.id === selectedId ? '→ ' : '  '}
              {session.name || session.id.slice(0, 8)}
            </Text>
            <Text color="gray"> ({session.messageCount} messages)</Text>
            <Text color="green"> ${session.totalCost.toFixed(4)}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// Session info panel
function SessionInfo({ session }: { session: Session }) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
      <Text bold>Current Session</Text>
      <Text>Name: {session.name || '(unnamed)'}</Text>
      <Text>Messages: {session.messages.length}</Text>
      <Text>Tokens: {session.state.totalTokens.input + session.state.totalTokens.output}</Text>
      <Text>Cost: ${session.state.totalCost.toFixed(4)}</Text>
      <Text>Started: {formatRelativeTime(session.createdAt)}</Text>
      {session.parentSessionId && (
        <Text color="yellow">Branched from: {session.parentSessionId.slice(0, 8)}</Text>
      )}
    </Box>
  );
}
```

## Consequences

### Positive
- Users can resume work across CLI restarts
- Session history provides context for future interactions
- Export feature enables documentation and sharing
- Branching allows experimentation without losing original work
- Search enables finding past solutions

### Negative
- Increased disk usage for session storage
- Additional complexity in session management
- Potential performance impact with large session files
- Privacy concerns with stored conversation history

### Risks
- Large sessions could slow down loading
- Concurrent access from multiple terminals needs handling
- Session corruption could lose work

## Implementation Notes

1. **Phase 1**: Basic session persistence (save/load current session)
2. **Phase 2**: Named sessions and listing
3. **Phase 3**: Export functionality (markdown, json)
4. **Phase 4**: Session branching
5. **Phase 5**: Search and archival

### Storage Limits
- Individual session files should be limited to ~10MB
- Sessions with >1000 messages should be compressed
- Old sessions (>30 days) automatically archived
- Index should be kept small for fast startup

## Related ADRs
- ADR-001: Rich Terminal UI Architecture
- ADR-002: Natural Language Interface
